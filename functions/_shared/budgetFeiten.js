/**
 * The facts Korda AI may talk about, computed here, not by the model.
 *
 * Korda AI (functions/_shared/kordaAI.js) only puts these into words, so every
 * number it says comes from this file. Two scopes:
 * - household (userId null): shared pots and shared accounts only, so an
 *   insight both partners see never reveals someone's private side;
 * - one person (userId): adds that person's own pots and accounts, for the
 *   questions they ask (only they see the answer).
 *
 * Nothing here is a route.
 */
import { db } from './budgetBank.js';
import { potStatus } from '../../src/features/budget/lib/budget.ts';
import { dubbeleAfschrijvingen, inkomenPerMaand } from '../../src/features/budget/lib/inzicht.ts';

const q = encodeURIComponent;
const euro = (n) => new Intl.NumberFormat('nl-NL', { style: 'currency', currency: 'EUR' }).format(n);
const maandSleutel = (iso) => iso.slice(0, 7);

function vandaagNL() {
  const d = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Amsterdam', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
  return d; // YYYY-MM-DD
}

function maandTerug(iso, n) {
  const [j, m] = iso.split('-').map(Number);
  const d = new Date(Date.UTC(j, m - 1 - n, 1));
  return d.toISOString().slice(0, 7);
}

/**
 * Returns { tekst, alias, transacties }: tekst is the fact sheet for the
 * model, alias maps short pot codes (p1..) to pot ids for links in the answer,
 * and transacties lists every payment in view (newest first), so a question
 * like "how often did we get pizza" can be answered from the payments
 * themselves rather than from totals.
 */
export async function verzamelFeiten(env, householdId, userId = null) {
  const vandaag = vandaagNL();
  const dezeMaand = maandSleutel(vandaag);
  const vanaf = `${maandTerug(vandaag, 3)}-01`;

  const [potjes, regels, tx, rekeningen, lasten, doelen] = await Promise.all([
    db(env, `budget_pots?household_id=eq.${q(householdId)}&archived_at=is.null&select=id,name,emoji,monthly_limit,kind,scope,owner_id,groep&order=sort_order`),
    db(env, `budget_tx_lines?household_id=eq.${q(householdId)}&booked_on=gte.${vanaf}&select=pot_id,amount,booked_on`),
    db(
      env,
      `budget_transactions?household_id=eq.${q(householdId)}&booked_on=gte.${vanaf}` +
        `&select=id,account_id,amount,counterparty,description,booked_on,soort,pot_id,splits:budget_tx_splits(pot_id)`,
    ),
    db(env, `budget_accounts?household_id=eq.${q(householdId)}&select=id,owner_id,visibility`),
    db(env, `budget_recurring?household_id=eq.${q(householdId)}&select=name,amount,previous_amount,price_changed_at,cadence,scope,owner_id,is_subscription`),
    db(env, `budget_goals?household_id=eq.${q(householdId)}&archived_at=is.null&select=id,name,emoji,target,deadline,scope,owner_id`),
  ]);

  const zichtbaarPot = (p) => p.scope === 'shared' || (userId && p.owner_id === userId);
  const pots = (potjes ?? []).filter(zichtbaarPot);
  const potIds = new Set(pots.map((p) => p.id));
  const rek = new Map((rekeningen ?? []).map((r) => [r.id, r]));
  // A payment is in view when its account is shared (or yours), or it sits in a pot in view.
  const zichtbaarTx = (t) => {
    const r = rek.get(t.account_id);
    return (r && (r.visibility === 'shared' || (userId && r.owner_id === userId))) || potIds.has(t.pot_id) || (t.splits ?? []).some((s) => potIds.has(s.pot_id));
  };
  const txs = (tx ?? []).filter(zichtbaarTx).map((t) => ({ ...t, amount: Number(t.amount), splits: [] }));

  // Spending per pot per month, from the per-part lines (splits count per part).
  const perPotMaand = new Map();
  for (const l of regels ?? []) {
    if (!potIds.has(l.pot_id)) continue;
    const k = `${l.pot_id}|${maandSleutel(l.booked_on)}`;
    perPotMaand.set(k, (perPotMaand.get(k) ?? 0) - Number(l.amount));
  }
  const uit = (potId, maand) => perPotMaand.get(`${potId}|${maand}`) ?? 0;
  const vorigeMaanden = [1, 2, 3].map((n) => maandTerug(vandaag, n));
  // A month counts towards an average only when the data covers all of it:
  // an account linked mid-August makes August look cheap otherwise.
  const oudsteData = (tx ?? []).reduce((m, t) => (t.booked_on < m ? t.booked_on : m), vandaag);
  const volleMaanden = vorigeMaanden.filter((m) => oudsteData <= `${m}-01`);

  const [jaar, maand, dag] = vandaag.split('-').map(Number);
  const dagenInMaand = new Date(Date.UTC(jaar, maand, 0)).getUTCDate();
  const voortgang = dag / dagenInMaand;

  const alias = new Map(pots.map((p, i) => [`p${i + 1}`, p.id]));
  const potAlias = new Map(pots.map((p, i) => [p.id, `p${i + 1}`]));
  const regelsPot = [];
  for (const p of pots) {
    const limiet = Number(p.monthly_limit);
    const nu = uit(p.id, dezeMaand);
    const gem = volleMaanden.length ? volleMaanden.reduce((s, m) => s + uit(p.id, m), 0) / volleMaanden.length : null;
    const status = p.kind === 'vast' ? (nu > limiet ? 'over' : 'ok') : potStatus(nu, limiet);
    const verwacht = p.kind === 'vast' || voortgang < 0.15 ? null : nu / voortgang;
    // Months in a row the pot stayed within its limit (full months only).
    let reeks = 0;
    for (const m of volleMaanden) {
      if (uit(p.id, m) <= limiet && uit(p.id, m) > 0) reeks += 1;
      else break;
    }
    regelsPot.push(
      [
        `${potAlias.get(p.id)} ${p.emoji} ${p.name}${p.kind === 'vast' ? ' (vaste lasten)' : ''}${p.scope === 'shared' ? '' : ' (persoonlijk)'}`,
        `limiet ${euro(limiet)}`,
        `deze maand ${euro(nu)} (${status === 'over' ? 'over de limiet' : status === 'bijna' ? 'bijna op' : 'binnen'})`,
        gem !== null ? `gemiddeld ${euro(gem)} per maand (${volleMaanden.length} mnd)` : 'nog geen eerdere maand',
        verwacht !== null ? `op dit tempo eind van de maand ~${euro(verwacht)}` : null,
        reeks >= 2 ? `${reeks} maanden op rij binnen de limiet` : null,
      ]
        .filter(Boolean)
        .join(' · '),
    );
  }

  const totaalLimiet = pots.reduce((s, p) => s + Number(p.monthly_limit), 0);
  const totaalNu = pots.reduce((s, p) => s + uit(p.id, dezeMaand), 0);
  const inkomen = inkomenPerMaand(txs).perMaand;
  const nogIndelen = txs.filter((t) => !t.pot_id && !t.soort && t.booked_on >= `${dezeMaand}-01`).length;

  const groot = txs
    .filter((t) => t.amount < 0 && !t.soort && t.booked_on >= `${dezeMaand}-01`)
    .sort((a, b) => a.amount - b.amount)
    .slice(0, 3)
    .map((t) => `${t.counterparty ?? t.description ?? 'onbekend'} ${euro(-t.amount)} (${t.booked_on})`);

  const dubbel = dubbeleAfschrijvingen(txs.filter((t) => t.booked_on >= maandTerug(vandaag, 1))).map(
    (d) => `${d.a.counterparty ?? d.a.description}: 2 × ${euro(-d.a.amount)} (${d.a.booked_on} en ${d.b.booked_on})`,
  );

  const sinds60 = new Date(Date.now() - 60 * 86400000).toISOString();
  const prijzen = (lasten ?? [])
    .filter((l) => (l.scope === 'shared' || (userId && l.owner_id === userId)) && l.previous_amount && l.price_changed_at >= sinds60)
    .map((l) => `${l.name}: van ${euro(Number(l.previous_amount))} naar ${euro(Number(l.amount))} per ${l.cadence}`);
  const abonnementen = (lasten ?? []).filter((l) => l.is_subscription && (l.scope === 'shared' || (userId && l.owner_id === userId)));

  const doelRegels = (doelen ?? [])
    .filter((d) => d.scope === 'shared' || (userId && d.owner_id === userId))
    .map((d) => `${d.emoji} ${d.name}: doel ${euro(Number(d.target))}${d.deadline ? `, uiterlijk ${d.deadline}` : ''}`);

  const tekst = [
    `Vandaag: ${vandaag} (dag ${dag} van ${dagenInMaand}, ${Math.round(voortgang * 100)}% van de maand).`,
    `Potjes${userId ? '' : ' (alleen gedeelde)'}:`,
    ...regelsPot,
    `Totaal: budget ${euro(totaalLimiet)}, deze maand uitgegeven ${euro(totaalNu)}.`,
    inkomen > 0 ? `Inkomen: gemiddeld ${euro(inkomen)} per maand (gemarkeerd inkomen${userId ? '' : ' op gedeelde rekeningen'}).` : 'Inkomen: nog niet gemarkeerd.',
    groot.length ? `Grootste uitgaven deze maand: ${groot.join('; ')}.` : null,
    dubbel.length ? `Mogelijk dubbel afgeschreven: ${dubbel.join('; ')}.` : null,
    prijzen.length ? `Prijsverhogingen (laatste 60 dagen): ${prijzen.join('; ')}.` : null,
    abonnementen.length ? `Abonnementen: ${abonnementen.map((a) => `${a.name} ${euro(Number(a.amount))}/${a.cadence}`).join('; ')}.` : null,
    doelRegels.length ? `Spaardoelen: ${doelRegels.join('; ')}.` : null,
    nogIndelen ? `Nog niet ingedeeld deze maand: ${nogIndelen} betalingen.` : null,
  ]
    .filter(Boolean)
    .join('\n');

  // Every payment in view, one line each. Pot names only for pots in view; a
  // split payment says so (its parts are in the pot totals above).
  const potNaam = new Map(pots.map((p) => [p.id, p.name]));
  const splitIds = new Set((tx ?? []).filter((t) => t.splits?.length).map((t) => t.id));
  const transacties = [...txs]
    .sort((a, b) => b.booked_on.localeCompare(a.booked_on))
    .slice(0, 1000)
    .map((t) => {
      const waar = t.soort === 'inkomen'
        ? 'inkomen'
        : t.soort === 'overboeking'
          ? 'overboeking'
          : splitIds.has(t.id)
            ? 'verdeeld over potjes'
            : potNaam.get(t.pot_id) ?? 'nog niet ingedeeld';
      const naam = t.counterparty ?? (t.description ? t.description.slice(0, 60) : 'onbekend');
      const extra = t.counterparty && t.description && t.description !== t.counterparty ? ` (${t.description.slice(0, 50)})` : '';
      return `${t.booked_on} · ${t.amount < 0 ? '-' : '+'}${euro(Math.abs(t.amount))} · ${naam}${extra} · ${waar}`;
    })
    .join('\n');

  return { tekst, alias, transacties };
}
