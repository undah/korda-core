/**
 * POST /api/budget/ai/vraag  { householdId, vraag, geschiedenis? }
 *   ->  a stream of newline-delimited JSON: {"t": "..."} per piece of text,
 *       then {"klaar": true} or {"fout": "..."}
 *
 * Ask Korda AI something about your money. Streamed, so the answer appears
 * word by word instead of after the whole thing is written. The facts include
 * your own pots and accounts besides the shared ones; the answer goes to you
 * only, and nothing is stored.
 */
import { Fout, foutAntwoord, leesBody, vereisLid } from '../../../_shared/budgetBank.js';
import { beantwoordStream } from '../../../_shared/kordaAI.js';

export async function onRequestPost({ request, env, data }) {
  try {
    const { householdId, vraag, geschiedenis = [] } = await leesBody(request);
    if (!vraag || !String(vraag).trim()) throw new Fout(400, 'Stel een vraag');
    await vereisLid(env, householdId, data.userId);
    const stroom = await beantwoordStream(
      env,
      householdId,
      data.userId,
      String(vraag).trim(),
      Array.isArray(geschiedenis) ? geschiedenis : [],
    );
    return new Response(stroom, {
      headers: { 'content-type': 'application/x-ndjson; charset=utf-8', 'cache-control': 'no-store' },
    });
  } catch (e) {
    return foutAntwoord(e);
  }
}
