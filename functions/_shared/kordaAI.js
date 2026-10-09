/**
 * Korda AI: KordaBudget's assistant (phase 3C).
 *
 * The facts come from budgetFeiten.js; Korda AI only puts them into words. It
 * may not invent numbers, and says so when the facts don't cover a question.
 * Two jobs:
 * - maakInzichten: 3–5 short insights for the household (shared data only),
 *   stored in budget_inzichten for everyone in it;
 * - beantwoord: an answer to one person's question, with their own pots and
 *   accounts included, returned to them only.
 *
 * Nothing here is a route.
 */
import Anthropic from '@anthropic-ai/sdk';
import { db } from './budgetBank.js';
import { verzamelFeiten } from './budgetFeiten.js';

const MODEL = 'claude-opus-5-5';

const KARAKTER = `Je bent Korda AI, de assistent in KordaBudget: een huishoudbudget-app voor stellen in Nederland, met potjes per categorie.
Je praat Nederlands, je zegt "jullie" tegen het huishouden, en je bent kort, warm en concreet: een behulpzame huisgenoot die goed met geld is, geen bank en geen leraar.
Gebruik alleen de getallen uit de feiten hieronder. Reken gerust met die getallen, maar verzin er geen bij. Weet je iets niet uit de feiten, zeg dat dan eerlijk.
Geen beleggings-, belasting- of juridisch advies; verwijs daarvoor naar een adviseur. Geen oordeel over waar mensen hun geld aan uitgeven.`;

function client(env) {
  return new Anthropic({ apiKey: env.ANTHROPIC_API_KEY });
}

/** The text of a response, after checking it wasn't declined or cut off. */
function tekstVan(antwoord) {
  if (antwoord.stop_reason === 'refusal') return { fout: 'Korda AI kon hier geen antwoord op geven' };
  if (antwoord.stop_reason === 'max_tokens') return { fout: 'Het antwoord werd te lang' };
  return { tekst: antwoord.content.filter((b) => b.type === 'text').map((b) => b.text).join('') };
}

function apiFout(e) {
  if (e instanceof Anthropic.RateLimitError) return 'Korda AI is even druk, probeer het zo nog eens';
  if (e instanceof Anthropic.AuthenticationError) return 'ANTHROPIC_API_KEY klopt niet';
  if (e instanceof Anthropic.APIError) return `Korda AI: ${e.status} ${e.message}`.slice(0, 200);
  return null;
}

// ─── insights ────────────────────────────────────────────────────────────────

const INZICHT_SCHEMA = {
  type: 'object',
  properties: {
    inzichten: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          soort: { type: 'string', enum: ['let_op', 'goed', 'tip'] },
          titel: { type: 'string' },
          tekst: { type: 'string' },
          potje: { type: 'string' },
        },
        required: ['soort', 'titel', 'tekst', 'potje'],
        additionalProperties: false,
      },
    },
  },
  required: ['inzichten'],
  additionalProperties: false,
};

/**
 * Write and store a fresh set of insights for the household. Returns the
 * stored row, or { overgeslagen: reden }.
 */
export async function maakInzichten(env, householdId) {
  if (!env.ANTHROPIC_API_KEY) return { overgeslagen: 'ANTHROPIC_API_KEY ontbreekt' };
  const { tekst: feiten, alias } = await verzamelFeiten(env, householdId, null);

  let antwoord;
  try {
    antwoord = await client(env).beta.messages.create({
      model: MODEL,
      max_tokens: 6000,
      betas: ['server-side-fallback-2026-07-01'],
      fallbacks: 'default',
      output_config: { effort: 'medium', format: { type: 'json_schema', schema: INZICHT_SCHEMA } },
      system: `${KARAKTER}

Schrijf 3 tot 5 inzichten voor het overzicht van de app. Kies wat er voor dit huishouden nu het meest toe doet:
- "let_op": iets om op te letten (een potje dat op dit tempo over de limiet gaat, een prijsverhoging, een mogelijke dubbele afschrijving);
- "goed": iets dat goed gaat (een reeks maanden binnen de limiet, minder uitgegeven dan gemiddeld);
- "tip": één concrete, haalbare stap.
Titel: maximaal 6 woorden. Tekst: één of twee korte zinnen met een getal erin. Zet bij "potje" de code (p1, p2, ...) als het over één potje gaat, anders een lege string. Herhaal niet hetzelfde punt.`,
      messages: [{ role: 'user', content: `Feiten:\n${feiten}` }],
    });
  } catch (e) {
    const fout = apiFout(e);
    if (fout) return { overgeslagen: fout };
    throw e;
  }
  const { tekst, fout } = tekstVan(antwoord);
  if (fout) return { overgeslagen: fout };

  let items;
  try {
    items = (JSON.parse(tekst).inzichten ?? [])
      .slice(0, 5)
      .map((i) => ({
        soort: ['let_op', 'goed', 'tip'].includes(i.soort) ? i.soort : 'tip',
        titel: String(i.titel ?? '').slice(0, 80),
        tekst: String(i.tekst ?? '').slice(0, 400),
        // The alias points back at a real pot; anything else is dropped.
        pot_id: alias.get(i.potje) ?? null,
      }))
      .filter((i) => i.titel && i.tekst);
  } catch {
    return { overgeslagen: 'onleesbaar antwoord' };
  }
  if (!items.length) return { overgeslagen: 'geen inzichten' };

  const [rij] = await db(env, 'budget_inzichten', {
    method: 'POST',
    body: JSON.stringify({ household_id: householdId, user_id: null, items }),
  });
  return rij;
}

// ─── questions ───────────────────────────────────────────────────────────────

/**
 * Answer one person's question. `geschiedenis` is the conversation so far on
 * their screen ([{ rol: 'jij' | 'ai', tekst }]); nothing is stored.
 */
export async function beantwoord(env, householdId, userId, vraag, geschiedenis = []) {
  if (!env.ANTHROPIC_API_KEY) return { fout: 'ANTHROPIC_API_KEY ontbreekt' };
  const { tekst: feiten, transacties } = await verzamelFeiten(env, householdId, userId);

  // The last few turns, alternating, ending with the new question.
  const berichten = [];
  for (const b of geschiedenis.slice(-8)) {
    const rol = b.rol === 'ai' ? 'assistant' : 'user';
    const tekst = String(b.tekst ?? '').slice(0, 1500);
    if (!tekst) continue;
    if (berichten.length === 0 && rol === 'assistant') continue;
    if (berichten.at(-1)?.role === rol) berichten.at(-1).content += `\n\n${tekst}`;
    else berichten.push({ role: rol, content: tekst });
  }
  if (berichten.at(-1)?.role === 'user') berichten.pop();
  berichten.push({ role: 'user', content: String(vraag).slice(0, 1000) });

  let antwoord;
  try {
    antwoord = await client(env).beta.messages.create({
      model: MODEL,
      max_tokens: 4000,
      betas: ['server-side-fallback-2026-07-01'],
      fallbacks: 'default',
      output_config: { effort: 'medium' },
      system: [
        {
          type: 'text',
          text: `${KARAKTER}

Je beantwoordt een vraag in de app. Antwoord in gewone tekst zonder opmaak: geen kopjes, geen tabellen, hooguit een kort lijstje met streepjes. Meestal 2 tot 5 zinnen.

Je krijgt een samenvatting en de lijst met alle transacties die deze persoon in de app kan zien (de laatste drie maanden). Gebruik die lijst om te tellen, op te tellen en te zoeken: "hoe vaak", "hoeveel bij", "wanneer voor het laatst". Gebruik je kennis van winkels en merken om te herkennen wat iets is (Domino's of New York Pizza is pizza, Albert Heijn en Jumbo zijn boodschappen, NS is de trein). Noem bij tellingen de datums of bedragen erbij, zodat het te controleren is. Staat iets niet in de lijst, zeg dan dat je het niet ziet.`,
        },
        {
          type: 'text',
          // The big, stable part: cached, so follow-up questions read it at a tenth of the price.
          text: `Samenvatting:
${feiten}

Transacties (nieuwste eerst; datum · bedrag · tegenpartij (omschrijving) · potje):
${transacties || '(geen)'}`,
          cache_control: { type: 'ephemeral' },
        },
      ],
      messages: berichten,
    });
  } catch (e) {
    const fout = apiFout(e);
    if (fout) return { fout };
    throw e;
  }
  const { tekst, fout } = tekstVan(antwoord);
  return fout ? { fout } : { antwoord: tekst.trim() };
}
