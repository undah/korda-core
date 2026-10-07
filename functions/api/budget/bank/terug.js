/**
 * POST /api/budget/bank/terug  { code, state }  ->  { rekeningen, nieuw, aangesloten }
 *
 * Finishes a link after ING sent the user back. The state must belong to a
 * pending link this same user started, so a stolen or replayed return URL
 * can't attach someone's bank account to another household.
 *
 * Accounts are matched on IBAN within the household, whoever linked them:
 * - linking again after the consent ran out re-attaches your own account and
 *   keeps its history and settings instead of creating a twin;
 * - the second holder of a joint account linking it with their own ING login
 *   adds their consent to the same account (`aangesloten`), so both can keep
 *   it current and nothing is counted twice.
 */
import {
  Fout,
  db,
  eb,
  foutAntwoord,
  json,
  leesBody,
  sluitLinkAlsLeeg,
  syncRekening,
  werkSamenvattingBij,
} from '../../../_shared/budgetBank.js';

const q = encodeURIComponent;

export async function onRequestPost({ request, env, data }) {
  try {
    const { code, state } = await leesBody(request);
    if (!code || !state) throw new Fout(400, 'De bank stuurde geen code mee');

    const [link] =
      (await db(
        env,
        `budget_bank_links?state=eq.${q(state)}&user_id=eq.${q(data.userId)}&status=eq.pending&select=*`,
      )) ?? [];
    if (!link) throw new Fout(400, 'Deze koppeling is verlopen of al afgerond. Begin opnieuw.');
    // Claim it first, so a double submit can't use the code twice.
    const geclaimd = await db(env, `budget_bank_links?id=eq.${q(link.id)}&status=eq.pending`, {
      method: 'PATCH',
      body: JSON.stringify({ status: 'failed', updated_at: new Date().toISOString() }),
    });
    if (!geclaimd?.length) throw new Fout(409, 'Deze koppeling wordt al afgerond');

    const sessie = await eb(env, '/sessions', { method: 'POST', body: JSON.stringify({ code }) });
    const geldigTot = sessie?.access?.valid_until ?? link.valid_until;
    await db(env, `budget_bank_links?id=eq.${q(link.id)}`, {
      method: 'PATCH',
      headers: { Prefer: 'return=minimal' },
      body: JSON.stringify({
        session_id: sessie.session_id,
        status: 'active',
        valid_until: geldigTot,
        updated_at: new Date().toISOString(),
      }),
    });

    const gekoppeld = []; // [{ rekening, toegang }]
    const oudeLinks = new Set();
    let aangesloten = 0;
    for (const a of sessie?.accounts ?? []) {
      const iban = a?.account_id?.iban ?? null;
      const naam = (a?.name || a?.product || (iban ? `ING ••${iban.slice(-4)}` : 'ING-rekening')).slice(0, 80);

      const [bestaand] = iban
        ? ((await db(
            env,
            `budget_accounts?household_id=eq.${q(link.household_id)}&provider=eq.enable_banking` +
              `&iban=eq.${q(iban)}&select=*&order=created_at.asc&limit=1`,
          )) ?? [])
        : [];

      let rekening = bestaand;
      if (!rekening) {
        [rekening] = await db(env, 'budget_accounts', {
          method: 'POST',
          body: JSON.stringify({
            household_id: link.household_id,
            owner_id: data.userId,
            name: naam,
            iban,
            // Private until the owner says otherwise: nothing leaks by default.
            visibility: 'private',
            provider: 'enable_banking',
          }),
        });
      } else if (bestaand.owner_id !== data.userId) {
        aangesloten += 1;
        // Two holders: a joint account, and one both already see in full at
        // ING, so keeping it private from one of them would hide nothing.
        await db(env, `budget_accounts?id=eq.${q(bestaand.id)}`, {
          method: 'PATCH',
          headers: { Prefer: 'return=minimal' },
          body: JSON.stringify({ is_joint: true, visibility: 'shared' }),
        });
      }

      const [vorige] =
        (await db(
          env,
          `budget_account_links?account_id=eq.${q(rekening.id)}&user_id=eq.${q(data.userId)}&select=link_id`,
        )) ?? [];
      if (vorige?.link_id && vorige.link_id !== link.id) oudeLinks.add(vorige.link_id);

      const [toegang] = await db(env, 'budget_account_links?on_conflict=account_id,user_id', {
        method: 'POST',
        headers: { Prefer: 'resolution=merge-duplicates,return=representation' },
        body: JSON.stringify({
          account_id: rekening.id,
          user_id: data.userId,
          link_id: link.id,
          provider_account_id: a.uid,
          valid_until: geldigTot,
          sync_error: null,
        }),
      });
      await werkSamenvattingBij(env, rekening.id);
      gekoppeld.push({ rekening, toegang });
    }

    // The previous consent for these accounts is now unused: close it at the bank.
    for (const id of oudeLinks) await sluitLinkAlsLeeg(env, id).catch(() => {});

    let nieuw = 0;
    for (const { rekening, toegang } of gekoppeld) nieuw += (await syncRekening(env, rekening, toegang)).nieuw;

    return json({ rekeningen: gekoppeld.length, nieuw, aangesloten });
  } catch (e) {
    return foutAntwoord(e);
  }
}
