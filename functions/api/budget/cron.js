/**
 * POST /api/budget/cron   (header x-cron-secret)  ->  { bijgewerkt, nieuw, fouten, overgeslagen }
 *
 * The background job, called 4 times a day by the budget-cron Worker
 * (workers/budget-cron). Pages Functions can't run on a schedule themselves.
 * The middleware checks the secret instead of a user session.
 *
 * Every linked account that hasn't been updated for a few hours is synced
 * through one of its consents (the owner's first). For ING these reads are
 * unattended, capped at 4 a day per account, which is why the job runs 4 times
 * and skips anything the app itself updated recently.
 *
 * Stalest first, and a cap per run: a Pages Function may make a limited number
 * of outgoing requests, and one account takes several.
 */
import { db, foutAntwoord, isActief, json, syncRekening, werkSamenvattingBij } from '../../_shared/budgetBank.js';

const OUD_NA_UREN = 5;
const MAX_PER_RUN = 6;

export async function onRequestPost({ env }) {
  try {
    const [rekeningen, toegangen, leden] = await Promise.all([
      db(env, 'budget_accounts?provider=eq.enable_banking&select=id,household_id,owner_id,last_synced_at'),
      db(env, 'budget_account_links?select=*,link:budget_bank_links(status,valid_until)&order=created_at.asc'),
      db(env, 'budget_members?select=household_id,user_id'),
    ]);
    const lid = new Set((leden ?? []).map((m) => `${m.household_id}|${m.user_id}`));
    const grens = Date.now() - OUD_NA_UREN * 3600_000;

    const teDoen = (rekeningen ?? [])
      .filter((r) => !r.last_synced_at || new Date(r.last_synced_at).getTime() < grens)
      .map((r) => ({
        r,
        // Usable consents of people still in the household, the owner's first.
        via: (toegangen ?? [])
          .filter((t) => t.account_id === r.id && isActief(t) && lid.has(`${r.household_id}|${t.user_id}`))
          .sort((a, b) => Number(b.user_id === r.owner_id) - Number(a.user_id === r.owner_id)),
      }))
      .filter((x) => x.via.length)
      .sort((a, b) => (a.r.last_synced_at ?? '').localeCompare(b.r.last_synced_at ?? ''));

    let bijgewerkt = 0;
    let nieuw = 0;
    const fouten = [];
    for (const { r, via } of teDoen.slice(0, MAX_PER_RUN)) {
      let gelukt = false;
      for (const t of via) {
        const u = await syncRekening(env, r, t);
        if (!u.fout) {
          gelukt = true;
          nieuw += u.nieuw;
          break;
        }
        fouten.push({ rekening: r.id, fout: u.fout });
      }
      if (gelukt) bijgewerkt += 1;
      else await werkSamenvattingBij(env, r.id).catch(() => {});
    }

    return json({ bijgewerkt, nieuw, fouten, overgeslagen: Math.max(0, teDoen.length - MAX_PER_RUN) });
  } catch (e) {
    return foutAntwoord(e);
  }
}
