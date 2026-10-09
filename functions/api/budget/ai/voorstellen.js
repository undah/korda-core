/**
 * POST /api/budget/ai/voorstellen  { householdId }  ->  { bekeken, voorgesteld } | { overgeslagen }
 *
 * Asks Claude for pot suggestions on this household's unsorted payments (see
 * functions/_shared/budgetAI.js). The app calls it in the background after a
 * bank sync; the cron job does the same for households nobody opened.
 */
import { foutAntwoord, json, leesBody, vereisLid } from '../../../_shared/budgetBank.js';
import { maakVoorstellen } from '../../../_shared/budgetAI.js';

export async function onRequestPost({ request, env, data }) {
  try {
    const { householdId } = await leesBody(request);
    await vereisLid(env, householdId, data.userId);
    return json(await maakVoorstellen(env, householdId));
  } catch (e) {
    return foutAntwoord(e);
  }
}
