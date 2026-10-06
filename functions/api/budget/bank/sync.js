/**
 * POST /api/budget/bank/sync  { householdId, alleenOud? }  ->  { nieuw, bijgewerkt, fouten }
 *
 * Fetches new transactions for the household's linked accounts.
 *
 * - Your own accounts are always synced (the "Bijwerken" button), unless
 *   `alleenOud` is set: then only those not synced in the last few hours. The
 *   app sends that when it opens, so opening it ten times a day doesn't call
 *   ING ten times.
 * - A partner's linked accounts are synced too when they're stale, so a joint
 *   account linked by one of you is fresh whoever opens the app. Only the
 *   count for your own accounts is returned; their private ones stay theirs.
 */
import { db, foutAntwoord, json, leesBody, syncRekening, vereisLid } from '../../../_shared/budgetBank.js';

const q = encodeURIComponent;
const OUD_NA_UREN = 4;

export async function onRequestPost({ request, env, data }) {
  try {
    const { householdId, alleenOud = false } = await leesBody(request);
    await vereisLid(env, householdId, data.userId);

    const rekeningen =
      (await db(
        env,
        `budget_accounts?household_id=eq.${q(householdId)}&provider=eq.enable_banking&link_id=not.is.null` +
          `&select=id,household_id,owner_id,provider_account_id,last_synced_at,link_id,link:budget_bank_links(status,valid_until)`,
      )) ?? [];

    const grens = Date.now() - OUD_NA_UREN * 3600_000;
    const isOud = (r) => !r.last_synced_at || new Date(r.last_synced_at).getTime() < grens;

    let nieuw = 0;
    let bijgewerkt = 0;
    const fouten = [];
    for (const r of rekeningen) {
      const eigen = r.owner_id === data.userId;
      if (!(eigen && !alleenOud) && !isOud(r)) continue;
      if (r.link?.status !== 'active' || !r.provider_account_id) continue;
      if (r.link.valid_until && new Date(r.link.valid_until).getTime() < Date.now()) {
        await db(env, `budget_accounts?id=eq.${q(r.id)}`, {
          method: 'PATCH',
          headers: { Prefer: 'return=minimal' },
          body: JSON.stringify({ sync_error: 'Toestemming verlopen: koppel opnieuw' }),
        });
        if (eigen) fouten.push({ rekening: r.id, fout: 'Toestemming verlopen: koppel opnieuw' });
        continue;
      }
      const uitkomst = await syncRekening(env, r);
      if (eigen) {
        nieuw += uitkomst.nieuw;
        bijgewerkt += 1;
        if (uitkomst.fout) fouten.push({ rekening: r.id, fout: uitkomst.fout });
      }
    }

    return json({ nieuw, bijgewerkt, fouten });
  } catch (e) {
    return foutAntwoord(e);
  }
}
