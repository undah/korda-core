/**
 * POST /api/budget/bank/sync  { householdId, alleenOud? }  ->  { nieuw, bijgewerkt, fouten }
 *
 * Fetches new transactions for the household's linked accounts.
 *
 * - Your own accounts are always synced (the "Bijwerken" button), unless
 *   `alleenOud` is set: then only those not synced in the last few minutes.
 *   The app sends that when it opens or comes back to the foreground. You're
 *   using the app then, so PSD2's cap on unattended bank calls doesn't apply.
 * - A partner's linked accounts are synced too when hours old, so a joint
 *   account linked by one of you is fresh whoever opens the app. For them it
 *   counts as unattended access (max 4 a day at ING), hence the longer gap. Only the
 *   count for your own accounts is returned; their private ones stay theirs.
 */
import { db, foutAntwoord, json, leesBody, syncRekening, vereisLid } from '../../../_shared/budgetBank.js';

const q = encodeURIComponent;
const EIGEN_OUD_NA_MIN = 5;
const ANDER_OUD_NA_UREN = 6;

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

    const leeftijd = (r) => (r.last_synced_at ? Date.now() - new Date(r.last_synced_at).getTime() : Infinity);
    const isOud = (r) =>
      leeftijd(r) > (r.owner_id === data.userId ? EIGEN_OUD_NA_MIN * 60_000 : ANDER_OUD_NA_UREN * 3600_000);

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
