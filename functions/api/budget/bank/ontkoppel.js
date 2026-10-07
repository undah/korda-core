/**
 * POST /api/budget/bank/ontkoppel  { accountId, verwijderen? }  ->  { ok: true }
 *
 * Without `verwijderen`: withdraw your own consent for this account. Its
 * history stays, and when another holder linked it too, it keeps updating
 * through theirs. When your consent covered no other account, the session at
 * Enable Banking is closed, which also revokes it at ING.
 *
 * With `verwijderen` (owner only): delete the account and its transactions,
 * and close every holder's consent that has nothing left to read.
 */
import { Fout, db, foutAntwoord, json, leesBody, sluitLinkAlsLeeg, werkSamenvattingBij } from '../../../_shared/budgetBank.js';

const q = encodeURIComponent;

export async function onRequestPost({ request, env, data }) {
  try {
    const { accountId, verwijderen = false } = await leesBody(request);
    const [rekening] =
      (await db(env, `budget_accounts?id=eq.${q(accountId)}&provider=eq.enable_banking&select=id,owner_id`)) ?? [];
    const toegangen =
      (await db(env, `budget_account_links?account_id=eq.${q(accountId)}&select=user_id,link_id`)) ?? [];
    const mijn = toegangen.find((t) => t.user_id === data.userId);
    if (!rekening || (rekening.owner_id !== data.userId && !mijn)) throw new Fout(404, 'Rekening niet gevonden');

    if (verwijderen) {
      if (rekening.owner_id !== data.userId) throw new Fout(403, 'Alleen wie de rekening toevoegde kan hem verwijderen');
      // Transactions, splits and consents go with it (on delete cascade).
      await db(env, `budget_accounts?id=eq.${q(accountId)}`, { method: 'DELETE', headers: { Prefer: 'return=minimal' } });
      for (const id of new Set(toegangen.map((t) => t.link_id))) await sluitLinkAlsLeeg(env, id).catch(() => {});
      return json({ ok: true });
    }

    if (mijn) {
      await db(env, `budget_account_links?account_id=eq.${q(accountId)}&user_id=eq.${q(data.userId)}`, {
        method: 'DELETE',
        headers: { Prefer: 'return=minimal' },
      });
      await sluitLinkAlsLeeg(env, mijn.link_id);
    }
    await werkSamenvattingBij(env, accountId);
    return json({ ok: true });
  } catch (e) {
    return foutAntwoord(e);
  }
}
