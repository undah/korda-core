/**
 * KordaBudget's push notifications, decided and sent by the background job
 * (functions/api/budget/cron.js, stap=meldingen).
 *
 * Every candidate has a type (src/features/budget/lib/meldingTypen.ts) and a
 * key. A notification goes out once per person per key (budget_meldingen_log),
 * only to people who may see what it's about, and never when that person
 * turned its type off (budget_melding_voorkeuren). Keys match the app's own
 * notices where both exist, so the two never double up.
 *
 * Nothing here is a route.
 */
import { db } from './budgetBank.js';
import { stuurPush } from './webpush.js';
import { maakInzichten } from './kordaAI.js';
import { potStatus } from '../../src/features/budget/lib/budget.ts';
import { dubbeleAfschrijvingen, maandRestant } from '../../src/features/budget/lib/inzicht.ts';

const q = encodeURIComponent;
const INDELEN_VANAF = 10;
const GROTE_UITGAVE = 150;
const MIJLPALEN = [25, 50, 75, 100];

const euro = (n) => new Intl.NumberFormat('nl-NL', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(n);
const euroPrecies = (n) => new Intl.NumberFormat('nl-NL', { style: 'currency', currency: 'EUR' }).format(n);
const norm = (s) => (s ?? '').trim().toLowerCase().replace(/\s+/g, ' ');

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
    dag: Number(delen.day),
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
const maandStart = (jaar, maand) => `${jaar}-${String(maand).padStart(2, '0')}-01`;
const vorigeMaand = (jaar, maand) => (maand === 1 ? { jaar: jaar - 1, maand: 12 } : { jaar, maand: maand - 1 });
const dagenIn = (jaar, maand) => new Date(Date.UTC(jaar, maand, 0)).getUTCDate();
const maandNaam = (jaar, maand) =>
  new Intl.DateTimeFormat('nl-NL', { month: 'long', timeZone: 'UTC' }).format(new Date(Date.UTC(jaar, maand - 1, 15)));

/** Same week key as the app's meldingen.ts, so a push and a local notice share a tag. */
function weekSleutel(d = new Date()) {
  const start = new Date(d.getFullYear(), 0, 1);
  const week = Math.ceil(((d.getTime() - start.getTime()) / 86400000 + start.getDay() + 1) / 7);
  return `${d.getFullYear()}-w${week}`;
}

export async function meldingen(env) {
  if (!env.VAPID_PRIVATE_KEY) return { verstuurd: 0, reden: 'VAPID_PRIVATE_KEY ontbreekt' };
  const abonnementen = (await db(env, 'budget_push_abonnementen?select=id,user_id,endpoint,p256dh,auth')) ?? [];
  if (!abonnementen.length) return { verstuurd: 0 };
  const perGebruiker = new Map();
  for (const a of abonnementen) perGebruiker.set(a.user_id, [...(perGebruiker.get(a.user_id) ?? []), a]);
  const gebruikers = [...perGebruiker.keys()];

  const [leden, voorkeuren, toestemmingen] = await Promise.all([
    db(env, `budget_members?user_id=in.(${gebruikers.map(q).join(',')})&select=household_id,user_id`),
    // Before budget_meldingen.sql has run nobody has turned anything off.
    db(env, `budget_melding_voorkeuren?user_id=in.(${gebruikers.map(q).join(',')})&select=user_id,uit`).catch(() => []),
    db(
      env,
      `budget_account_links?user_id=in.(${gebruikers.map(q).join(',')})&select=account_id,user_id,valid_until,link:budget_bank_links(status)`,
    ).catch(() => []),
  ]);
  const uitVoor = new Map((voorkeuren ?? []).map((v) => [v.user_id, new Set(v.uit ?? [])]));
  const huishoudens = [...new Set((leden ?? []).map((m) => m.household_id))];
  const nl = nuInNL();
  const maandVan = maandStart(nl.jaar, nl.maand);
  const vm = vorigeMaand(nl.jaar, nl.maand);
  const vorigeVan = maandStart(vm.jaar, vm.maand);
  const drieTerug = (() => {
    let m = { jaar: nl.jaar, maand: nl.maand };
    for (let i = 0; i < 3; i++) m = vorigeMaand(m.jaar, m.maand);
    return maandStart(m.jaar, m.maand);
  })();
  const voortgang = nl.dag / dagenIn(nl.jaar, nl.maand);
  const avond = nl.uur >= 17;

  // Candidates: { type, aan: [userIds], sleutel, titel, tekst, url, ookLoggen? }
  const kandidaten = [];
  const inzichtDag = (nl.zondag && avond) || nl.dag === 1;
  let inzichtenGemaakt = 0;

  for (const hh of huishoudens) {
    const ledenHier = (await db(env, `budget_members?household_id=eq.${q(hh)}&select=user_id`)) ?? [];
    const iedereen = ledenHier.map((m) => m.user_id);

    const [potjes, regels, recent, rekeningen, lasten, doelen, stortingen, afgesloten, huishouden] = await Promise.all([
      db(env, `budget_pots?household_id=eq.${q(hh)}&archived_at=is.null&select=id,name,emoji,monthly_limit,scope,owner_id,kind`),
      // budget_tx_lines: a split payment counts per part, like in the app.
      db(env, `budget_tx_lines?household_id=eq.${q(hh)}&booked_on=gte.${drieTerug}&select=pot_id,amount,booked_on`),
      db(
        env,
        `budget_transactions?household_id=eq.${q(hh)}&booked_on=gte.${isoMin(nl.datum, 30)}` +
          `&select=id,account_id,amount,counterparty,description,booked_on,soort,pot_id,splits:budget_tx_splits(id)&limit=3000`,
      ),
      db(env, `budget_accounts?household_id=eq.${q(hh)}&select=id,owner_id,visibility,name`),
      db(env, `budget_recurring?household_id=eq.${q(hh)}&select=id,name,counterparty,amount,cadence,day_of_month,month_of_year,scope,owner_id`).catch(() => []),
      db(env, `budget_goals?household_id=eq.${q(hh)}&archived_at=is.null&select=id,name,emoji,target,scope,owner_id,receives_leftover`).catch(() => []),
      db(env, `budget_goal_entries?household_id=eq.${q(hh)}&select=goal_id,amount`).catch(() => []),
      db(env, `budget_month_closes?household_id=eq.${q(hh)}&month=eq.${vorigeVan}&select=month`).catch(() => []),
      db(env, `budget_households?id=eq.${q(hh)}&select=created_at`),
    ]);

    const rek = new Map((rekeningen ?? []).map((r) => [r.id, r]));
    /** Who may hear about a payment: everyone for a shared account, else its owner. */
    const aanVoorRekening = (accountId) => {
      const r = rek.get(accountId);
      return !r ? [] : r.visibility === 'shared' ? iedereen : [r.owner_id];
    };
    const aanVoorScope = (x) => (x.scope === 'shared' ? iedereen : [x.owner_id]);
    const uitIn = (potId, van, tot) =>
      -(regels ?? []).filter((l) => l.pot_id === potId && l.booked_on >= van && l.booked_on < tot).reduce((s, l) => s + Number(l.amount), 0);
    const volgendeVan = (() => {
      const v = nl.maand === 12 ? { jaar: nl.jaar + 1, maand: 1 } : { jaar: nl.jaar, maand: nl.maand + 1 };
      return maandStart(v.jaar, v.maand);
    })();

    // ── Korda AI's weekly / monthly look ──
    if (inzichtDag && inzichtenGemaakt < 2) {
      const [laatste] =
        (await db(env, `budget_inzichten?household_id=eq.${q(hh)}&user_id=is.null&order=created_at.desc&limit=1`).catch(() => [])) ?? [];
      if (!laatste || Date.now() - new Date(laatste.created_at).getTime() > 20 * 3600_000) {
        inzichtenGemaakt += 1;
        const rij = await maakInzichten(env, hh).catch(() => null);
        if (rij?.id && rij.items?.length) {
          kandidaten.push({ type: 'inzichten', aan: iedereen, sleutel: `inzicht:${rij.id}`, titel: 'Korda AI heeft nieuwe inzichten', tekst: rij.items[0].titel, url: '/budget/ai' });
        }
      }
    }

    // ── Pots: 80%, over the limit, and over at this pace ──
    for (const p of potjes ?? []) {
      const limiet = Number(p.monthly_limit);
      if (!(limiet > 0)) continue;
      const uit = uitIn(p.id, maandVan, volgendeVan);
      const status = p.kind === 'vast' ? (uit > limiet ? 'over' : 'ok') : potStatus(uit, limiet);
      const aan = aanVoorScope(p);
      const m = `${nl.jaar}-${nl.maand}`;
      if (status === 'over') {
        kandidaten.push({ type: 'potje_over', aan, sleutel: `${p.id}:${m}:over`, titel: `${p.emoji} ${p.name} is over de limiet`, tekst: `${euro(uit - limiet)} meer dan de ${euro(limiet)} van deze maand.`, url: `/budget/potjes/${p.id}` });
      } else if (status === 'bijna') {
        kandidaten.push({ type: 'potje_bijna', aan, sleutel: `${p.id}:${m}:bijna`, titel: `${p.emoji} ${p.name} is bijna op`, tekst: `Nog ${euro(limiet - uit)} van ${euro(limiet)} deze maand.`, url: `/budget/potjes/${p.id}` });
      } else if (p.kind !== 'vast' && nl.dag >= 8 && nl.dag <= 24 && uit >= limiet * 0.3) {
        // Mid-month, still under 80%, but heading over: the warning you can still act on.
        const verwacht = uit / voortgang;
        if (verwacht > limiet * 1.1) {
          const dagenOver = dagenIn(nl.jaar, nl.maand) - nl.dag + 1;
          const rest = Math.max(0, limiet - uit);
          kandidaten.push({
            type: 'tempo',
            aan,
            sleutel: `tempo:${p.id}:${m}`,
            titel: `${p.emoji} ${p.name} gaat op dit tempo over de limiet`,
            tekst: `Zo kom je rond ${euro(verwacht)} uit, ${euro(verwacht - limiet)} te veel. Nog ${euro(rest)} voor ${dagenOver} dagen: ${euroPrecies(rest / dagenOver)} per dag.`,
            url: `/budget/potjes/${p.id}`,
          });
        }
      }
    }

    const tx = (recent ?? []).map((t) => ({ ...t, amount: Number(t.amount) }));

    // ── Possible double charges ──
    for (const paar of dubbeleAfschrijvingen(tx.filter((t) => t.booked_on >= isoMin(nl.datum, 14)).map((t) => ({ ...t, splits: [] })))) {
      const betrokken = [rek.get(paar.a.account_id), rek.get(paar.b.account_id)].filter(Boolean);
      const aan = betrokken.some((r) => r.visibility === 'shared') ? iedereen : [...new Set(betrokken.map((r) => r.owner_id))];
      kandidaten.push({ type: 'dubbel', aan, sleutel: `dubbel:${paar.sleutel}`, titel: 'Mogelijk dubbel afgeschreven', tekst: `${paar.a.counterparty ?? paar.a.description ?? 'Zelfde partij'}: 2 × ${euroPrecies(Math.abs(paar.a.amount))}`, url: '/budget/overzicht' });
    }

    // ── Salary in: with an offer to put something aside ──
    const doelInZicht = (doelen ?? []).filter((d) => d.scope === 'shared');
    const gespaard = new Map();
    for (const e of stortingen ?? []) gespaard.set(e.goal_id, (gespaard.get(e.goal_id) ?? 0) + Number(e.amount));
    const spaarDoel =
      doelInZicht.find((d) => d.receives_leftover && (gespaard.get(d.id) ?? 0) < Number(d.target)) ??
      doelInZicht.find((d) => (gespaard.get(d.id) ?? 0) < Number(d.target));
    for (const t of tx) {
      if (t.soort !== 'inkomen' || t.amount <= 0 || t.booked_on < isoMin(nl.datum, 2)) continue;
      const opzij = Math.max(5, Math.round((t.amount * 0.1) / 5) * 5);
      kandidaten.push({
        type: 'salaris',
        aan: aanVoorRekening(t.account_id),
        sleutel: `salaris:${t.id}`,
        titel: `💸 ${euroPrecies(t.amount)} binnen${t.counterparty ? ` van ${t.counterparty}` : ''}`,
        tekst: spaarDoel ? `Zal ik ${euro(opzij)} opzij zetten voor ${spaarDoel.emoji} ${spaarDoel.name}? Tik om het te regelen.` : 'Kijk wat er deze maand nog kan.',
        url: spaarDoel ? `/budget/ai?vraag=${q(`Zet ${euro(opzij)} opzij in ${spaarDoel.emoji} ${spaarDoel.name}`)}` : '/budget/overzicht',
      });
    }

    // ── A big payment without a pot ──
    for (const t of tx) {
      if (t.amount > -GROTE_UITGAVE || t.pot_id || t.soort || t.splits?.length || t.booked_on < isoMin(nl.datum, 2)) continue;
      kandidaten.push({
        type: 'grote_uitgave',
        aan: aanVoorRekening(t.account_id),
        sleutel: `groot:${t.id}`,
        titel: `${euroPrecies(-t.amount)} bij ${t.counterparty ?? t.description ?? 'onbekend'}`,
        tekst: 'In welk potje hoort die? Tik om hem in te delen.',
        url: '/budget/indelen',
      });
    }

    // ── Evening: a fixed cost goes out tomorrow ──
    if (avond) {
      const morgen = new Date(`${nl.datum}T12:00:00Z`);
      morgen.setUTCDate(morgen.getUTCDate() + 1);
      const mj = morgen.getUTCFullYear();
      const mm = morgen.getUTCMonth() + 1;
      const md = morgen.getUTCDate();
      const vanMaand = maandStart(mj, mm);
      for (const l of lasten ?? []) {
        const dag = Math.min(Number(l.day_of_month) || 1, dagenIn(mj, mm));
        if (dag !== md) continue;
        if (l.cadence === 'jaar' && Number(l.month_of_year) !== mm) continue;
        // Already went out this month (some charge a day early): no reminder.
        const al = l.counterparty && tx.some((t) => t.amount < 0 && t.booked_on >= vanMaand && norm(t.counterparty).includes(norm(l.counterparty)));
        if (al) continue;
        kandidaten.push({
          type: 'vaste_last',
          aan: aanVoorScope(l),
          sleutel: `vast:${l.id}:${mj}-${mm}`,
          titel: `Morgen: ${l.name} (${euroPrecies(Number(l.amount))})`,
          tekst: 'Die gaat er morgen af.',
          url: '/budget/vaste-lasten',
        });
      }
    }

    // ── Start of the month: close last month ──
    const bestondAl = huishouden?.[0]?.created_at?.slice(0, 10) < maandVan;
    if (nl.dag <= 3 && bestondAl && !(afgesloten ?? []).length && (potjes ?? []).length) {
      const uitgaven = Object.fromEntries((potjes ?? []).map((p) => [p.id, uitIn(p.id, vorigeVan, maandVan)]));
      const restant = maandRestant((potjes ?? []).map((p) => ({ ...p, monthly_limit: Number(p.monthly_limit) })), uitgaven);
      const naam = maandNaam(vm.jaar, vm.maand);
      kandidaten.push({
        type: 'maand_afsluiten',
        aan: iedereen,
        sleutel: `afsluiten:${hh}:${vorigeVan.slice(0, 7)}`,
        titel: `${naam.charAt(0).toUpperCase()}${naam.slice(1)} zit erop`,
        tekst: restant.totaal > 0 ? `${euro(restant.totaal)} over in de gedeelde potjes. Zet het opzij voor een doel.` : `Kijk hoe ${naam} ging en sluit de maand af.`,
        url: '/budget/overzicht',
      });
    }

    // ── Milestones: goals at 25/50/75/100%, and months in a row within budget ──
    for (const d of doelen ?? []) {
      const doel = Number(d.target);
      if (!(doel > 0)) continue;
      const pct = ((gespaard.get(d.id) ?? 0) / doel) * 100;
      const gehaald = MIJLPALEN.filter((m) => pct >= m);
      if (!gehaald.length) continue;
      const hoogste = gehaald[gehaald.length - 1];
      kandidaten.push({
        type: 'mijlpaal',
        aan: aanVoorScope(d),
        sleutel: `doel:${d.id}:${hoogste}`,
        // The lower ones are passed too: don't announce them later.
        ookLoggen: gehaald.slice(0, -1).map((m) => `doel:${d.id}:${m}`),
        titel: hoogste === 100 ? `🎉 ${d.emoji} ${d.name} is gehaald!` : `${d.emoji} ${d.name}: ${hoogste}% gespaard`,
        tekst: `${euro(gespaard.get(d.id) ?? 0)} van ${euro(doel)}.`,
        url: '/budget/doelen',
      });
    }
    if (nl.dag <= 3) {
      for (const p of potjes ?? []) {
        if (p.kind === 'vast' || !(Number(p.monthly_limit) > 0)) continue;
        let reeks = 0;
        let m = { jaar: nl.jaar, maand: nl.maand };
        for (let i = 0; i < 3; i++) {
          const v = vorigeMaand(m.jaar, m.maand);
          const uit = uitIn(p.id, maandStart(v.jaar, v.maand), maandStart(m.jaar, m.maand));
          if (uit > 0 && uit <= Number(p.monthly_limit)) reeks += 1;
          else break;
          m = v;
        }
        if (reeks >= 3) {
          kandidaten.push({
            type: 'mijlpaal',
            aan: aanVoorScope(p),
            sleutel: `reeks:${p.id}:${maandVan.slice(0, 7)}`,
            titel: `${p.emoji} ${p.name}: ${reeks} maanden op rij binnen budget`,
            tekst: 'Mooi volgehouden.',
            url: `/budget/potjes/${p.id}`,
          });
        }
      }
    }

    // ── Sunday evening: the week ──
    if (nl.zondag && avond) {
      const gedeeld = new Set((potjes ?? []).filter((p) => p.scope === 'shared' && p.kind !== 'vast').map((p) => p.id));
      const som = (van, tot) =>
        -(regels ?? []).filter((l) => gedeeld.has(l.pot_id) && l.booked_on > van && l.booked_on <= tot).reduce((s, l) => s + Number(l.amount), 0);
      const deze = som(isoMin(nl.datum, 7), nl.datum);
      const vorige = som(isoMin(nl.datum, 14), isoMin(nl.datum, 7));
      if (deze > 0) {
        const vergelijk = vorige > 0 ? `, ${euro(Math.abs(deze - vorige))} ${deze > vorige ? 'meer' : 'minder'} dan vorige week` : '';
        kandidaten.push({ type: 'week', aan: iedereen, sleutel: `week:${hh}:${weekSleutel()}`, titel: 'Je week in KordaBudget', tekst: `${euro(deze)} uit de gedeelde potjes${vergelijk}.`, url: '/budget/week' });
      }
    }

    // ── Evening, at most weekly: payments waiting for a pot ──
    if (avond) {
      const onverdeeld = tx.filter((t) => !t.pot_id && !t.soort && !t.splits?.length);
      for (const lid of iedereen) {
        const aantal = onverdeeld.filter((t) => {
          const r = rek.get(t.account_id);
          return r && (r.visibility === 'shared' || r.owner_id === lid);
        }).length;
        if (aantal < INDELEN_VANAF) continue;
        kandidaten.push({ type: 'indelen', aan: [lid], sleutel: `indelen:${hh}:${weekSleutel()}`, titel: `${aantal} betalingen wachten op een potje`, tekst: 'Met Snel indelen ben je er in een paar minuten doorheen.', url: '/budget/indelen' });
      }
    }
  }

  // ── The bank link: 14 and 3 days before your consent ends ──
  for (const t of toestemmingen ?? []) {
    if (t.link?.status !== 'active' || !t.valid_until) continue;
    const dagen = Math.ceil((new Date(t.valid_until).getTime() - Date.now()) / 86400000);
    const drempel = dagen <= 3 ? 3 : dagen <= 14 ? 14 : null;
    if (!drempel || dagen < 0) continue;
    kandidaten.push({
      type: 'toestemming',
      aan: [t.user_id],
      sleutel: `toestemming:${t.account_id}:${t.valid_until.slice(0, 10)}:${drempel}`,
      titel: dagen <= 1 ? 'Je ING-koppeling verloopt morgen' : `Je ING-koppeling verloopt over ${dagen} dagen`,
      tekst: 'Koppel opnieuw om je betalingen binnen te blijven krijgen. Het duurt een minuut.',
      url: '/budget/rekeningen',
    });
  }

  // ── Send: once per person per key, and not when they turned the type off ──
  const verzonden = new Set(
    // The whole log for these people: a milestone or link warning must never come twice.
    ((await db(env, `budget_meldingen_log?user_id=in.(${gebruikers.map(q).join(',')})&select=user_id,sleutel&limit=50000`)) ?? []).map(
      (r) => `${r.user_id}|${r.sleutel}`,
    ),
  );
  let verstuurd = 0;
  let uitgezet = 0;
  const log = [];
  for (const k of kandidaten) {
    for (const userId of new Set(k.aan)) {
      const subs = perGebruiker.get(userId);
      if (!subs || verzonden.has(`${userId}|${k.sleutel}`)) continue;
      verzonden.add(`${userId}|${k.sleutel}`);
      if (uitVoor.get(userId)?.has(k.type)) {
        uitgezet += 1;
        continue;
      }
      let aangekomen = false;
      for (const s of subs) {
        const uitkomst = await stuurPush(env, s, { title: k.titel, body: k.tekst, tag: `kb-${k.sleutel}`, url: k.url });
        if (uitkomst === 'ok') aangekomen = true;
        if (uitkomst === 'weg') await db(env, `budget_push_abonnementen?id=eq.${q(s.id)}`, { method: 'DELETE', headers: { Prefer: 'return=minimal' } });
      }
      if (aangekomen) {
        verstuurd += 1;
        log.push({ user_id: userId, sleutel: k.sleutel });
        for (const extra of k.ookLoggen ?? []) log.push({ user_id: userId, sleutel: extra });
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
  return { verstuurd, uitgezet, kandidaten: kandidaten.length };
}
