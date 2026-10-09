/**
 * POST /api/budget/ai/inzichten  { householdId }  ->  the latest insights row, fresh if due
 *
 * Korda AI writes new insights when the newest set is more than an hour old,
 * so tapping "Ververs" repeatedly doesn't run up the bill. The background job
 * also writes them on Sunday evening and on the 1st of the month.
 */
import { db, foutAntwoord, json, leesBody, vereisLid } from '../../../_shared/budgetBank.js';
import { maakInzichten } from '../../../_shared/kordaAI.js';

const q = encodeURIComponent;
const MIN_TUSSEN_MS = 60 * 60 * 1000;

export async function onRequestPost({ request, env, data }) {
  try {
    const { householdId } = await leesBody(request);
    await vereisLid(env, householdId, data.userId);
    const [laatste] =
      (await db(env, `budget_inzichten?household_id=eq.${q(householdId)}&user_id=is.null&order=created_at.desc&limit=1`)) ?? [];
    if (laatste && Date.now() - new Date(laatste.created_at).getTime() < MIN_TUSSEN_MS) return json(laatste);
    const nieuw = await maakInzichten(env, householdId);
    return json(nieuw?.overgeslagen && laatste ? { ...laatste, overgeslagen: nieuw.overgeslagen } : nieuw);
  } catch (e) {
    return foutAntwoord(e);
  }
}
