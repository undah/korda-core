/**
 * POST /api/budget/bank/ontkoppel  { accountId }  ->  { ok: true }
 *
 * Stops syncing one of your own accounts. Its history stays in the app (delete
 * the account for that). When it was the last account on that consent, the
 * session at Enable Banking is closed, which also revokes the consent at ING.
 */
import { Fout, db, foutAntwoord, json, leesBody, sluitLinkAlsLeeg } from '../../../_shared/budgetBank.js';

const q = encodeURIComponent;

export async function onRequestPost({ request, env, data }) {
  try {
    const { accountId } = await leesBody(request);
    const [rekening] =
      (await db(
        env,
        `budget_accounts?id=eq.${q(accountId)}&owner_id=eq.${q(data.userId)}&provider=eq.enable_banking&select=id,link_id`,
      )) ?? [];
    if (!rekening) throw new Fout(404, 'Rekening niet gevonden');

    await db(env, `budget_accounts?id=eq.${q(rekening.id)}`, {
      method: 'PATCH',
      headers: { Prefer: 'return=minimal' },
      body: JSON.stringify({ link_id: null, provider_account_id: null, consent_valid_until: null, sync_error: null }),
    });
    await sluitLinkAlsLeeg(env, rekening.link_id);
    return json({ ok: true });
  } catch (e) {
    return foutAntwoord(e);
  }
}
