/**
 * POST /api/budget/bank/sync  { householdId, alleenOud? }  ->  { nieuw, bijgewerkt, fouten }
 *
 * Fetches new transactions for the household's linked accounts.
 *
 * Every account can carry a consent per holder (budget_account_links). The
 * one used is yours when you have one: you have the app open, so for ING
 * you're present and its cap on unattended reads doesn't apply. Then an
 * account is synced on every call, or with `alleenOud` (sent when the app
 * opens or comes back to the foreground) when it's more than a few minutes old.
 *
 * Accounts you have no consent for (a partner's, or a joint account only they
 * linked) are synced through their consent when hours old: for ING that's
 * unattended access, capped at 4 a day. Only counts for accounts you hold
 * are returned; someone else's private account stays theirs.
 */
import { db, foutAntwoord, isActief, json, leesBody, syncRekening, vereisLid, werkSamenvattingBij } from '../../../_shared/budgetBank.js';

const q = encodeURIComponent;
const EIGEN_OUD_NA_MIN = 5;
const ANDER_OUD_NA_UREN = 6;

export async function onRequestPost({ request, env, data }) {
  try {
    const { householdId, alleenOud = false } = await leesBody(request);
    await vereisLid(env, householdId, data.userId);

    const [rekeningen, leden] = await Promise.all([
      db(env, `budget_accounts?household_id=eq.${q(householdId)}&provider=eq.enable_banking&select=id,household_id,owner_id,last_synced_at`),
      db(env, `budget_members?household_id=eq.${q(householdId)}&select=user_id`),
    ]);
    if (!rekeningen?.length) return json({ nieuw: 0, bijgewerkt: 0, fouten: [] });
    const lid = new Set((leden ?? []).map((m) => m.user_id));

    const toegangen =
      (await db(
        env,
        `budget_account_links?account_id=in.(${rekeningen.map((r) => q(r.id)).join(',')})` +
          `&select=*,link:budget_bank_links(status,valid_until)&order=created_at.asc`,
      )) ?? [];

    const leeftijd = (r) => (r.last_synced_at ? Date.now() - new Date(r.last_synced_at).getTime() : Infinity);

    let nieuw = 0;
    let bijgewerkt = 0;
    const fouten = [];
    for (const r of rekeningen) {
      const vanRekening = toegangen.filter((t) => t.account_id === r.id);
      if (!vanRekening.length) continue;
      const mijn = vanRekening.find((t) => t.user_id === data.userId);
      // Someone who left the household no longer feeds it, even if their consent still runs.
      const anderen = vanRekening.filter((t) => t.user_id !== data.userId && lid.has(t.user_id) && isActief(t));
      const ikHoudBij = !!mijn || r.owner_id === data.userId;

      const pogingen = [];
      if (mijn && isActief(mijn) && (!alleenOud || leeftijd(r) > EIGEN_OUD_NA_MIN * 60_000)) pogingen.push(mijn);
      if (leeftijd(r) > ANDER_OUD_NA_UREN * 3600_000) pogingen.push(...anderen);
      if (!pogingen.length) {
        if (ikHoudBij && mijn && !isActief(mijn) && !anderen.length) {
          fouten.push({ rekening: r.id, fout: 'Toestemming verlopen: koppel opnieuw' });
        }
        continue;
      }

      let gelukt = false;
      let laatsteFout = null;
      for (const t of pogingen) {
        const uitkomst = await syncRekening(env, r, t);
        if (!uitkomst.fout) {
          gelukt = true;
          if (ikHoudBij) nieuw += uitkomst.nieuw;
          break;
        }
        laatsteFout = uitkomst.fout;
      }
      if (!gelukt) await werkSamenvattingBij(env, r.id);
      if (ikHoudBij) {
        bijgewerkt += 1;
        if (!gelukt) fouten.push({ rekening: r.id, fout: laatsteFout });
      }
    }

    return json({ nieuw, bijgewerkt, fouten });
  } catch (e) {
    return foutAntwoord(e);
  }
}
