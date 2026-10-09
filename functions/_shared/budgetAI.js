/**
 * Claude suggests a pot for payments no rule covers (phase 3B).
 *
 * One request per batch: the household's pots, how it sorted similar payments
 * before, and the payments to place. The answer is structured output (a JSON
 * schema), and the schema only allows the ids we gave it, so Claude can't name
 * a pot that doesn't exist. Every answer is checked again here before it's
 * stored, and stored as a suggestion only: someone confirms it in the app.
 *
 * What leaves the server: the counterparty, description, amount and date of a
 * payment, and the names of the pots. No IBANs, account names or people.
 *
 * Nothing here is a route.
 */
import Anthropic from '@anthropic-ai/sdk';
import { db } from './budgetBank.js';

const q = encodeURIComponent;
const MODEL = 'claude-opus-5-5';
const PER_KEER = 60;
const DAGEN_TERUG = 90;

const norm = (s) => (s ?? '').trim().toLowerCase().replace(/\s+/g, ' ');

const SYSTEEM = `Je deelt banktransacties van een Nederlands huishouden in. Het huishouden heeft eigen potjes (budgetcategorieën). Kies per transactie de beste keuze uit de toegestane opties:

- een potje-id (p1, p2, ...) als de uitgave (of terugbetaling) in dat potje hoort;
- "inkomen" voor geld dat binnenkomt als inkomen: salaris, uitkering, toeslag, belastingteruggave;
- "overboeking" voor geld tussen eigen rekeningen of naar/van een spaarrekening;
- "onbekend" als je het niet redelijk zeker weet.

Gebruik de voorbeelden van hoe dit huishouden eerder indeelde: die wegen zwaarder dan algemene kennis. Let op de naam van de winkel of partij en de omschrijving (pinbetalingen bevatten vaak een plaatsnaam). Geef bij zekerheid een eerlijk getal tussen 0 en 1: 0.9 of hoger alleen als het duidelijk is, onder 0.5 als je twijfelt. Kies liever "onbekend" dan te gokken.`;

/**
 * Suggest pots for up to PER_KEER unsorted payments of one household.
 * Returns { bekeken, voorgesteld } or { overgeslagen: reden }.
 */
export async function maakVoorstellen(env, householdId) {
  if (!env.ANTHROPIC_API_KEY) return { overgeslagen: 'ANTHROPIC_API_KEY ontbreekt' };
  const vanaf = new Date(Date.now() - DAGEN_TERUG * 86400000).toISOString().slice(0, 10);

  const [open, potjes, rekeningen, regels, eerder] = await Promise.all([
    db(
      env,
      `budget_transactions?household_id=eq.${q(householdId)}&pot_id=is.null&soort=is.null&ai_at=is.null` +
        `&booked_on=gte.${vanaf}&select=id,account_id,amount,counterparty,description,booked_on,splits:budget_tx_splits(id)` +
        `&order=booked_on.desc&limit=${PER_KEER * 2}`,
    ),
    db(env, `budget_pots?household_id=eq.${q(householdId)}&archived_at=is.null&select=id,name,emoji,groep,kind,scope,owner_id&order=sort_order`),
    db(env, `budget_accounts?household_id=eq.${q(householdId)}&select=id,owner_id`),
    db(env, `budget_rules?household_id=eq.${q(householdId)}&select=counterparty`),
    db(
      env,
      `budget_transactions?household_id=eq.${q(householdId)}&pot_id=not.is.null&select=counterparty,description,amount,pot_id` +
        `&order=booked_on.desc&limit=150`,
    ),
  ]);
  if (!potjes?.length) return { overgeslagen: 'geen potjes' };

  // A rule already says where these go; the app suggests that one itself.
  const metRegel = new Set((regels ?? []).map((r) => r.counterparty));
  const teDoen = (open ?? [])
    .filter((t) => !t.splits?.length && !metRegel.has(norm(t.counterparty)))
    .slice(0, PER_KEER);
  if (!teDoen.length) return { bekeken: 0, voorgesteld: 0 };

  // Short aliases keep the request small and the schema closed.
  const potAlias = new Map(potjes.map((p, i) => [p.id, `p${i + 1}`]));
  const aliasPot = new Map(potjes.map((p, i) => [`p${i + 1}`, p]));
  const eigenaar = new Map((rekeningen ?? []).map((r) => [r.id, r.owner_id]));
  // A personal pot is only an option for payments from its owner's accounts.
  const magIn = (t, p) => p.scope === 'shared' || p.owner_id === eigenaar.get(t.account_id);

  const groepTekst = { nodig: 'nodig', wil: 'wil', sparen: 'sparen' };
  const potRegels = potjes.map((p) =>
    [`${potAlias.get(p.id)}: ${p.emoji} ${p.name}`, p.kind === 'vast' ? 'vaste lasten' : null, groepTekst[p.groep] ?? null, p.scope === 'shared' ? null : 'persoonlijk']
      .filter(Boolean)
      .join(' · '),
  );

  // How this household sorted before: one line per counterparty, newest first.
  const gezien = new Set();
  const voorbeelden = [];
  for (const t of eerder ?? []) {
    const k = norm(t.counterparty || t.description);
    if (!k || gezien.has(k) || !potAlias.has(t.pot_id)) continue;
    gezien.add(k);
    voorbeelden.push(`${t.counterparty ?? ''}${t.description ? ` | ${t.description.slice(0, 60)}` : ''} → ${potAlias.get(t.pot_id)}`);
    if (voorbeelden.length >= 60) break;
  }

  const txAlias = new Map(teDoen.map((t, i) => [`t${i + 1}`, t]));
  const persoonlijk = potjes.some((p) => p.scope !== 'shared');
  const txRegels = [...txAlias.entries()].map(([a, t]) => {
    const bedrag = Number(t.amount);
    const delen = [
      a,
      t.booked_on,
      `${bedrag < 0 ? 'af' : 'bij'} €${Math.abs(bedrag).toFixed(2)}`,
      t.counterparty ?? '(geen naam)',
      t.description ? `"${t.description.slice(0, 140)}"` : null,
    ];
    if (persoonlijk) delen.push(`mag: ${potjes.filter((p) => magIn(t, p)).map((p) => potAlias.get(p.id)).join(',')}`);
    return delen.filter(Boolean).join(' · ');
  });

  const inhoud = [
    `Potjes:\n${potRegels.join('\n')}`,
    voorbeelden.length ? `Zo deelde dit huishouden eerder in:\n${voorbeelden.join('\n')}` : 'Er zijn nog geen eerdere indelingen.',
    `In te delen:\n${txRegels.join('\n')}`,
  ].join('\n\n');

  const schema = {
    type: 'object',
    properties: {
      voorstellen: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            id: { type: 'string', enum: [...txAlias.keys()] },
            keuze: { type: 'string', enum: [...aliasPot.keys(), 'inkomen', 'overboeking', 'onbekend'] },
            zekerheid: { type: 'number' },
          },
          required: ['id', 'keuze', 'zekerheid'],
          additionalProperties: false,
        },
      },
    },
    required: ['voorstellen'],
    additionalProperties: false,
  };

  const client = new Anthropic({ apiKey: env.ANTHROPIC_API_KEY });
  let antwoord;
  try {
    antwoord = await client.beta.messages.create({
      model: MODEL,
      max_tokens: 8000,
      // If a safety classifier declines, the API retries on another model itself.
      betas: ['server-side-fallback-2026-07-01'],
      fallbacks: 'default',
      // Sorting is routine work: low effort keeps it quick and cheap.
      output_config: { effort: 'low', format: { type: 'json_schema', schema } },
      system: SYSTEEM,
      messages: [{ role: 'user', content: inhoud }],
    });
  } catch (e) {
    if (e instanceof Anthropic.RateLimitError) return { overgeslagen: 'even te druk bij Claude' };
    if (e instanceof Anthropic.AuthenticationError) return { overgeslagen: 'ANTHROPIC_API_KEY klopt niet' };
    if (e instanceof Anthropic.APIError) return { overgeslagen: `Claude: ${e.status} ${e.message}`.slice(0, 200) };
    throw e;
  }
  if (antwoord.stop_reason === 'refusal') return { overgeslagen: 'Claude weigerde deze aanvraag' };
  if (antwoord.stop_reason === 'max_tokens') return { overgeslagen: 'antwoord was te lang' };

  let uitkomst;
  try {
    const tekst = antwoord.content.filter((b) => b.type === 'text').map((b) => b.text).join('');
    uitkomst = JSON.parse(tekst);
  } catch {
    return { overgeslagen: 'onleesbaar antwoord' };
  }

  // Check every answer again: allowed pot, income only for money in.
  const opslag = [];
  const behandeld = new Set();
  for (const v of uitkomst?.voorstellen ?? []) {
    const t = txAlias.get(v.id);
    if (!t || behandeld.has(t.id)) continue;
    behandeld.add(t.id);
    const zeker = Math.max(0, Math.min(1, Number(v.zekerheid) || 0));
    const pot = aliasPot.get(v.keuze);
    if (pot && magIn(t, pot)) opslag.push({ id: t.id, pot: pot.id, soort: null, zeker });
    else if (v.keuze === 'inkomen' && Number(t.amount) > 0) opslag.push({ id: t.id, pot: null, soort: 'inkomen', zeker });
    else if (v.keuze === 'overboeking') opslag.push({ id: t.id, pot: null, soort: 'overboeking', zeker });
    else opslag.push({ id: t.id, pot: null, soort: null, zeker: 0 });
  }
  // Payments Claude skipped are marked looked-at too, so they aren't sent again.
  for (const t of teDoen) if (!behandeld.has(t.id)) opslag.push({ id: t.id, pot: null, soort: null, zeker: 0 });

  await db(env, 'rpc/budget_zet_ai', {
    method: 'POST',
    headers: { Prefer: 'return=minimal' },
    body: JSON.stringify({ p_household: householdId, p_voorstellen: opslag }),
  });
  return { bekeken: teDoen.length, voorgesteld: opslag.filter((o) => o.pot || o.soort).length };
}
