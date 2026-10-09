/**
 * POST /api/budget/cron?stap=sync|meldingen   (header x-cron-secret)
 *
 * The background job, driven 4 times a day by the budget-cron Worker
 * (workers/budget-cron); Pages Functions can't run on a schedule themselves.
 * The middleware checks the secret instead of a user session.
 *
 * stap=sync       Syncs linked accounts not updated for a few hours, stalest
 *                 first, a few per call: a Function may only make so many
 *                 outgoing requests, and one account takes several. Answers
 *                 { meer: true } while work remains; the Worker calls again.
 *                 For ING these reads are unattended (capped at 4 a day per
 *                 account), hence 4 runs and skipping what the app synced.
 *                 After the last sync round, Claude suggests pots for the
 *                 households' new unsorted payments (a few per call).
 * stap=meldingen  Push notifications (functions/_shared/budgetMeldingen.js):
 *                 pots, pace, salary, big payments, fixed costs, double
 *                 charges, the week, month close, Korda AI's insights,
 *                 sorting nudges, milestones and the bank link. Each once
 *                 per person, and only the types they left on.
 */
import { db, foutAntwoord, isActief, json, syncRekening, werkSamenvattingBij } from '../../_shared/budgetBank.js';
import { maakVoorstellen } from '../../_shared/budgetAI.js';
import { meldingen } from '../../_shared/budgetMeldingen.js';

const q = encodeURIComponent;
const OUD_NA_UREN = 5;
const PER_AANROEP = 3;

export async function onRequestPost({ request, env }) {
  try {
    const stap = new URL(request.url).searchParams.get('stap') ?? 'sync';
    if (stap === 'meldingen') return json(await meldingen(env));
    return json(await sync(env));
  } catch (e) {
    return foutAntwoord(e);
  }
}

// ─── sync ────────────────────────────────────────────────────────────────────

async function sync(env) {
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
  for (const { r, via } of teDoen.slice(0, PER_AANROEP)) {
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
    // A failed account is marked (sync_error) so the next call moves on to others.
    else await werkSamenvattingBij(env, r.id).catch(() => {});
  }
  const meer = teDoen.length > PER_AANROEP;
  // Once everything is synced: suggestions for what came in. One Claude call
  // per household, a couple of households per call to stay quick.
  const ai = meer ? [] : await aiVoorstellen(env);
  return { bijgewerkt, nieuw, fouten, ai, meer };
}

const AI_PER_AANROEP = 2;

async function aiVoorstellen(env) {
  const vanaf = new Date(Date.now() - 90 * 86400000).toISOString().slice(0, 10);
  let open;
  try {
    open = await db(
      env,
      `budget_transactions?pot_id=is.null&soort=is.null&ai_at=is.null&booked_on=gte.${vanaf}&select=household_id&limit=1000`,
    );
  } catch {
    return []; // budget_ai.sql hasn't run yet
  }
  const huishoudens = [...new Set((open ?? []).map((t) => t.household_id))].slice(0, AI_PER_AANROEP);
  const uit = [];
  for (const hh of huishoudens) uit.push({ hh, ...(await maakVoorstellen(env, hh).catch((e) => ({ overgeslagen: e?.message }))) });
  return uit;
}
