/**
 * POST /api/budget/bank/terug  { code, state }  ->  { rekeningen, nieuw }
 *
 * Finishes a link after ING sent the user back. The state must belong to a
 * pending link this same user started, so a stolen or replayed return URL
 * can't attach someone's bank account to another household.
 *
 * Accounts are matched on IBAN within the household: linking again (after the
 * consent ran out) re-attaches the existing account and keeps its history and
 * settings instead of creating a twin.
 */
import { Fout, db, eb, foutAntwoord, json, leesBody, sluitLinkAlsLeeg, syncRekening } from '../../../_shared/budgetBank.js';

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

    const rekeningen = [];
    const oudeLinks = new Set();
    for (const a of sessie?.accounts ?? []) {
      const iban = a?.account_id?.iban ?? null;
      const naam = (a?.name || a?.product || (iban ? `ING ••${iban.slice(-4)}` : 'ING-rekening')).slice(0, 80);
      const velden = {
        provider_account_id: a.uid,
        link_id: link.id,
        consent_valid_until: geldigTot,
        sync_error: null,
      };

      const [bestaand] = iban
        ? ((await db(
            env,
            `budget_accounts?household_id=eq.${q(link.household_id)}&owner_id=eq.${q(data.userId)}` +
              `&provider=eq.enable_banking&iban=eq.${q(iban)}&select=*`,
          )) ?? [])
        : [];

      let rij;
      if (bestaand) {
        if (bestaand.link_id && bestaand.link_id !== link.id) oudeLinks.add(bestaand.link_id);
        [rij] = await db(env, `budget_accounts?id=eq.${q(bestaand.id)}`, {
          method: 'PATCH',
          body: JSON.stringify(velden),
        });
      } else {
        [rij] = await db(env, 'budget_accounts', {
          method: 'POST',
          body: JSON.stringify({
            ...velden,
            household_id: link.household_id,
            owner_id: data.userId,
            name: naam,
            iban,
            // Private until the owner says otherwise: nothing leaks by default.
            visibility: 'private',
            provider: 'enable_banking',
          }),
        });
      }
      rekeningen.push(rij);
    }

    // The previous consent for these accounts is now unused: close it at the bank.
    for (const id of oudeLinks) await sluitLinkAlsLeeg(env, id).catch(() => {});

    let nieuw = 0;
    for (const r of rekeningen) nieuw += (await syncRekening(env, r)).nieuw;

    return json({ rekeningen: rekeningen.length, nieuw });
  } catch (e) {
    return foutAntwoord(e);
  }
}
