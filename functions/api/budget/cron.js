/**
 * POST /api/budget/cron?stap=sync|meldingen   (header x-cron-secret)
 *
 * The background job, driven 4 times a day by the budget-cron Worker
 * (workers/budget-cron); Pages Functions can't run on a schedule themselves.
 * The middleware checks the secret instead of a user session.
 *
 * stap=sync       Syncs linked accounts not updated for a few hours, stalest
 *                 first, a few per call: a Function may only make so many
 *                 outgoing requests, and one account takes several. Answers
 *                 { meer: true } while work remains; the Worker calls again.
 *                 For ING these reads are unattended (capped at 4 a day per
 *                 account), hence 4 runs and skipping what the app synced.
 *                 After the last sync round, Claude suggests pots for the
 *                 households' new unsorted payments (a few per call).
 * stap=meldingen  Push notifications, each sent once per person: a pot
 *                 crossing 80% or its limit, a possible double charge, and
 *                 on Sunday evening the week's shared spending.
 */
import { db, foutAntwoord, isActief, json, syncRekening, werkSamenvattingBij } from '../../_shared/budgetBank.js';
import { stuurPush } from '../../_shared/webpush.js';
import { maakVoorstellen } from '../../_shared/budgetAI.js';
import { potStatus } from '../../../src/features/budget/lib/budget.ts';
import { dubbeleAfschrijvingen } from '../../../src/features/budget/lib/inzicht.ts';

const q = encodeURIComponent;
const OUD_NA_UREN = 5;
const PER_AANROEP = 3;

export async function onRequestPost({ request, env }) {
  try {
    const stap = new URL(request.url).searchParams.get('stap') ?? 'sync';
    if (stap === 'meldingen') return json(await meldingen(env));
    return json(await sync(env));
  } catch (e) {
    return foutAntwoord(e);
  }
}

// ─── sync ────────────────────────────────────────────────────────────────────

async function sync(env) {
  const [rekeningen, toegangen, leden] = await Promise.all([
    db(env, 'budget_accounts?provider=eq.enable_banking&select=id,household_id,owner_id,last_synced_at'),
    db(env, 'budget_account_links?select=*,link:budget_bank_links(status,valid_until)&order=created_at.asc'),
    db(env, 'budget_members?select=household_id,user_id'),
  ]);
  const lid = new Set((leden ?? []).map((m) => `${m.household_id}|${m.user_id}`));
  const grens = Date.now() - OUD_NA_UREN * 3600_000;

  const teDoen = (rekeningen ?? [])
    .filter((r) => !r.last_synced_at || new Date(r.last_synced_at).getTime() < grens)
    .map((r) => ({
      r,
      // Usable consents of people still in the household, the owner's first.
      via: (toegangen ?? [])
        .filter((t) => t.account_id === r.id && isActief(t) && lid.has(`${r.household_id}|${t.user_id}`))
        .sort((a, b) => Number(b.user_id === r.owner_id) - Number(a.user_id === r.owner_id)),
    }))
    .filter((x) => x.via.length)
    .sort((a, b) => (a.r.last_synced_at ?? '').localeCompare(b.r.last_synced_at ?? ''));

  let bijgewerkt = 0;
  let nieuw = 0;
  const fouten = [];
  for (const { r, via } of teDoen.slice(0, PER_AANROEP)) {
    let gelukt = false;
    for (const t of via) {
      const u = await syncRekening(env, r, t);
      if (!u.fout) {
        gelukt = true;
        nieuw += u.nieuw;
        break;
      }
      fouten.push({ rekening: r.id, fout: u.fout });
    }
    if (gelukt) bijgewerkt += 1;
    // A failed account is marked (sync_error) so the next call moves on to others.
    else await werkSamenvattingBij(env, r.id).catch(() => {});
  }
  const meer = teDoen.length > PER_AANROEP;
  // Once everything is synced: suggestions for what came in. One Claude call
  // per household, a couple of households per call to stay quick.
  const ai = meer ? [] : await aiVoorstellen(env);
  return { bijgewerkt, nieuw, fouten, ai, meer };
}

const AI_PER_AANROEP = 2;

async function aiVoorstellen(env) {
  const vanaf = new Date(Date.now() - 90 * 86400000).toISOString().slice(0, 10);
  let open;
  try {
    open = await db(
      env,
      `budget_transactions?pot_id=is.null&soort=is.null&ai_at=is.null&booked_on=gte.${vanaf}&select=household_id&limit=1000`,
    );
  } catch {
    return []; // budget_ai.sql hasn't run yet
  }
  const huishoudens = [...new Set((open ?? []).map((t) => t.household_id))].slice(0, AI_PER_AANROEP);
  const uit = [];
  for (const hh of huishoudens) uit.push({ hh, ...(await maakVoorstellen(env, hh).catch((e) => ({ overgeslagen: e?.message }))) });
  return uit;
}

// ─── meldingen ───────────────────────────────────────────────────────────────

/** Today in the Netherlands, whatever the server's clock zone. */
function nuInNL() {
  const delen = Object.fromEntries(
    new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Europe/Amsterdam',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      hour12: false,
      weekday: 'short',
    })
      .formatToParts(new Date())
      .map((p) => [p.type, p.value]),
  );
  return {
    jaar: Number(delen.year),
    maand: Number(delen.month),
    datum: `${delen.year}-${delen.month}-${delen.day}`,
    uur: Number(delen.hour) % 24,
    zondag: delen.weekday === 'Sun',
  };
}

const isoMin = (iso, dagen) => {
  const d = new Date(`${iso}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() - dagen);
  return d.toISOString().slice(0, 10);
};

/** Same week key as the app's meldingen.ts, so a push and a local notice share a tag. */
function weekSleutel(d = new Date()) {
  const start = new Date(d.getFullYear(), 0, 1);
  const week = Math.ceil(((d.getTime() - start.getTime()) / 86400000 + start.getDay() + 1) / 7);
  return `${d.getFullYear()}-w${week}`;
}

const euro = (n) =>
  new Intl.NumberFormat('nl-NL', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(n);

async function meldingen(env) {
  if (!env.VAPID_PRIVATE_KEY) return { verstuurd: 0, reden: 'VAPID_PRIVATE_KEY ontbreekt' };
  const abonnementen = (await db(env, 'budget_push_abonnementen?select=id,user_id,endpoint,p256dh,auth')) ?? [];
  if (!abonnementen.length) return { verstuurd: 0 };
  const perGebruiker = new Map();
  for (const a of abonnementen) perGebruiker.set(a.user_id, [...(perGebruiker.get(a.user_id) ?? []), a]);

  const leden = (await db(env, `budget_members?user_id=in.(${[...perGebruiker.keys()].map(q).join(',')})&select=household_id,user_id`)) ?? [];
  const huishoudens = [...new Set(leden.map((m) => m.household_id))];
  const nl = nuInNL();
  const maandVan = `${nl.jaar}-${String(nl.maand).padStart(2, '0')}-01`;

  // Candidate notifications: { aan: [userIds], sleutel, titel, tekst, url }
  const kandidaten = [];
  for (const hh of huishoudens) {
    const ledenHier = (await db(env, `budget_members?household_id=eq.${q(hh)}&select=user_id`)) ?? [];
    const iedereen = ledenHier.map((m) => m.user_id);
    const [potjes, regels, recent, rekeningen] = await Promise.all([
      db(env, `budget_pots?household_id=eq.${q(hh)}&archived_at=is.null&select=id,name,emoji,monthly_limit,scope,owner_id,kind`),
      // budget_tx_lines: a split payment counts per part, like in the app.
      db(env, `budget_tx_lines?household_id=eq.${q(hh)}&booked_on=gte.${isoMin(maandVan, 14)}&select=pot_id,amount,booked_on`),
      db(
        env,
        `budget_transactions?household_id=eq.${q(hh)}&booked_on=gte.${isoMin(nl.datum, 14)}` +
          `&select=id,account_id,amount,counterparty,description,booked_on,soort`,
      ),
      db(env, `budget_accounts?household_id=eq.${q(hh)}&select=id,owner_id,visibility`),
    ]);

    // Pots: 80% and over the limit, once per pot per month (same keys as the app).
    for (const p of potjes ?? []) {
      const limiet = Number(p.monthly_limit);
      if (!(limiet > 0)) continue;
      const uit = -(regels ?? []).filter((l) => l.pot_id === p.id && l.booked_on >= maandVan).reduce((s, l) => s + Number(l.amount), 0);
      // Rent being paid isn't news: a fixed pot only signals when it goes over.
      const status = p.kind === 'vast' ? (uit > limiet ? 'over' : 'ok') : potStatus(uit, limiet);
      if (status === 'ok') continue;
      const aan = p.scope === 'shared' ? iedereen : [p.owner_id];
      const m = `${nl.jaar}-${nl.maand}`;
      kandidaten.push(
        status === 'over'
          ? { aan, sleutel: `${p.id}:${m}:over`, titel: `${p.emoji} ${p.name} is over de limiet`, tekst: `${euro(uit - limiet)} meer dan de ${euro(limiet)} van deze maand.`, url: `/budget/potjes/${p.id}` }
          : { aan, sleutel: `${p.id}:${m}:bijna`, titel: `${p.emoji} ${p.name} is bijna op`, tekst: `Nog ${euro(limiet - uit)} van ${euro(limiet)} deze maand.`, url: `/budget/potjes/${p.id}` },
      );
    }

    // Possible double charges: to whoever can see the account(s) involved.
    const rek = new Map((rekeningen ?? []).map((r) => [r.id, r]));
    const tx = (recent ?? []).map((t) => ({ ...t, amount: Number(t.amount), splits: [], pot_id: null }));
    for (const paar of dubbeleAfschrijvingen(tx)) {
      const betrokken = [rek.get(paar.a.account_id), rek.get(paar.b.account_id)].filter(Boolean);
      const aan = betrokken.some((r) => r.visibility === 'shared') ? iedereen : [...new Set(betrokken.map((r) => r.owner_id))];
      kandidaten.push({
        aan,
        sleutel: `dubbel:${paar.sleutel}`,
        titel: 'Mogelijk dubbel afgeschreven',
        tekst: `${paar.a.counterparty ?? paar.a.description ?? 'Zelfde partij'}: 2 × ${euro(Math.abs(paar.a.amount))}`,
        url: '/budget/overzicht',
      });
    }

    // Sunday evening: the week's spending in shared, flexible pots (everyone sees those).
    if (nl.zondag && nl.uur >= 17) {
      const gedeeld = new Set((potjes ?? []).filter((p) => p.scope === 'shared' && p.kind !== 'vast').map((p) => p.id));
      const som = (van, tot) =>
        -(regels ?? [])
          .filter((l) => gedeeld.has(l.pot_id) && l.booked_on > van && l.booked_on <= tot)
          .reduce((s, l) => s + Number(l.amount), 0);
      const deze = som(isoMin(nl.datum, 7), nl.datum);
      const vorige = som(isoMin(nl.datum, 14), isoMin(nl.datum, 7));
      if (deze > 0) {
        const vergelijk = vorige > 0 ? `, ${euro(Math.abs(deze - vorige))} ${deze > vorige ? 'meer' : 'minder'} dan vorige week` : '';
        kandidaten.push({
          aan: iedereen,
          sleutel: `week:${hh}:${weekSleutel()}`,
          titel: 'Je week in KordaBudget',
          tekst: `${euro(deze)} uit de gedeelde potjes${vergelijk}.`,
          url: '/budget/week',
        });
      }
    }
  }

  // Send each once per person: the log remembers what went out.
  const verzonden = new Set(
    ((await db(env, `budget_meldingen_log?created_at=gte.${isoMin(nl.datum, 45)}&select=user_id,sleutel`)) ?? []).map(
      (r) => `${r.user_id}|${r.sleutel}`,
    ),
  );
  let verstuurd = 0;
  const log = [];
  for (const k of kandidaten) {
    for (const userId of new Set(k.aan)) {
      const subs = perGebruiker.get(userId);
      if (!subs || verzonden.has(`${userId}|${k.sleutel}`)) continue;
      verzonden.add(`${userId}|${k.sleutel}`);
      let aangekomen = false;
      for (const s of subs) {
        const uitkomst = await stuurPush(env, s, { title: k.titel, body: k.tekst, tag: `kb-${k.sleutel}`, url: k.url });
        if (uitkomst === 'ok') aangekomen = true;
        if (uitkomst === 'weg') {
          await db(env, `budget_push_abonnementen?id=eq.${q(s.id)}`, { method: 'DELETE', headers: { Prefer: 'return=minimal' } });
        }
      }
      if (aangekomen) {
        verstuurd += 1;
        log.push({ user_id: userId, sleutel: k.sleutel });
      }
    }
  }
  if (log.length) {
    await db(env, 'budget_meldingen_log?on_conflict=user_id,sleutel', {
      method: 'POST',
      headers: { Prefer: 'resolution=ignore-duplicates,return=minimal' },
      body: JSON.stringify(log),
    });
  }
  return { verstuurd, kandidaten: kandidaten.length };
}
