/**
 * POST /api/budget/ai/vraag  { householdId, vraag, geschiedenis? }  ->  { antwoord } | { fout }
 *
 * Ask Korda AI something about your money. The facts include your own pots
 * and accounts besides the shared ones; the answer goes to you only, and
 * nothing is stored.
 */
import { Fout, foutAntwoord, json, leesBody, vereisLid } from '../../../_shared/budgetBank.js';
import { beantwoord } from '../../../_shared/kordaAI.js';

export async function onRequestPost({ request, env, data }) {
  try {
    const { householdId, vraag, geschiedenis = [] } = await leesBody(request);
    if (!vraag || !String(vraag).trim()) throw new Fout(400, 'Stel een vraag');
    await vereisLid(env, householdId, data.userId);
    return json(await beantwoord(env, householdId, data.userId, String(vraag).trim(), Array.isArray(geschiedenis) ? geschiedenis : []));
  } catch (e) {
    return foutAntwoord(e);
  }
}
