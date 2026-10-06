/**
 * POST /api/budget/bank/start  { householdId }  ->  { url }
 *
 * Starts a link with ING: asks Enable Banking for an authorisation URL, and
 * remembers the random `state` with who asked and for which household. The
 * browser then goes to ING; ING sends it back to /budget/bank/terug, which
 * calls terug.js with the code and that same state.
 */
import { REDIRECT_URL, Fout, db, eb, foutAntwoord, ingInfo, json, leesBody, vereisLid } from '../../../_shared/budgetBank.js';

const MAX_DAGEN = 180;

export async function onRequestPost({ request, env, data }) {
  try {
    const { householdId } = await leesBody(request);
    await vereisLid(env, householdId, data.userId);

    // Ask for as long as ING allows (capped at 180 days), minus a minute of margin.
    const ing = await ingInfo(env);
    const seconden = Math.min(Number(ing?.maximum_consent_validity) || 90 * 86400, MAX_DAGEN * 86400);
    const geldigTot = new Date(Date.now() + seconden * 1000 - 60_000).toISOString();

    const state = crypto.randomUUID();
    await db(env, 'budget_bank_links', {
      method: 'POST',
      headers: { Prefer: 'return=minimal' },
      body: JSON.stringify({ household_id: householdId, user_id: data.userId, state, valid_until: geldigTot }),
    });

    const auth = await eb(env, '/auth', {
      method: 'POST',
      body: JSON.stringify({
        access: { valid_until: geldigTot },
        aspsp: { name: ing?.name ?? 'ING', country: 'NL' },
        state,
        redirect_url: REDIRECT_URL,
        psu_type: 'personal',
      }),
    });
    if (!auth?.url) throw new Fout(502, 'De bank gaf geen inloglink terug');
    return json({ url: auth.url });
  } catch (e) {
    return foutAntwoord(e);
  }
}
