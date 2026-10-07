/**
 * Shared code for /api/budget/bank/*: talking to Enable Banking and to Supabase.
 *
 * Nothing here is a route (no onRequest export), so Pages doesn't serve it.
 *
 * Enable Banking authenticates the app, not a user: every call carries a JWT
 * signed with the app's private key (ENABLE_BANKING_PRIVATE_KEY, a Cloudflare
 * secret), with the app id (ENABLE_BANKING_APP_ID) as the key id. Which bank
 * accounts we may read is decided by the session the user created in the ING
 * app; those session ids live in budget_bank_links, which only the service role
 * can touch.
 */

const EB = 'https://api.enablebanking.com';

/** Registered in the Enable Banking portal; the bank refuses any other. */
export const REDIRECT_URL = 'https://kordacore.com/budget/bank/terug';

/** PSD2 guarantees 90 days of history; anything beyond is up to the bank. */
const EERSTE_SYNC_DAGEN = 89;
/**
 * Right after you approve a link, many banks hand out more. We ask for this
 * much then, and fall back to 89 days when the bank says no.
 */
const DIEPE_SYNC_DAGEN = 730;
/** Later syncs overlap a week, so late-booked payments still come in. */
const OVERLAP_DAGEN = 7;

// ─── small helpers ───────────────────────────────────────────────────────────

export class Fout extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

export const json = (data, status = 200) => Response.json(data, { status });

export function foutAntwoord(e) {
  const status = e instanceof Fout ? e.status : 500;
  return json({ error: e?.message ?? 'Er ging iets mis' }, status);
}

export async function leesBody(request) {
  try {
    return await request.json();
  } catch {
    throw new Fout(400, 'Ongeldig verzoek');
  }
}

const dagen = (n) => n * 86400000;
const isoDatum = (d) => d.toISOString().slice(0, 10);

// ─── Enable Banking: JWT signing ─────────────────────────────────────────────

const b64url = (bytes) => {
  let s = '';
  for (const b of new Uint8Array(bytes)) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
};
const b64urlJson = (o) => b64url(new TextEncoder().encode(JSON.stringify(o)));

/** DER length bytes. */
const derLen = (n) => (n < 128 ? [n] : n < 256 ? [0x81, n] : [0x82, n >> 8, n & 0xff]);

/**
 * WebCrypto only imports PKCS#8. `openssl genrsa` (and older openssl req) write
 * PKCS#1 ("BEGIN RSA PRIVATE KEY"), so wrap that in the PKCS#8 envelope.
 */
function pemNaarPkcs8(pem) {
  const tekst = String(pem).replace(/\\n/g, '\n');
  const pkcs1 = tekst.includes('BEGIN RSA PRIVATE KEY');
  const inhoud = tekst.replace(/-----[^-]+-----/g, '').replace(/\s+/g, '');
  const der = Uint8Array.from(atob(inhoud), (c) => c.charCodeAt(0));
  if (!pkcs1) return der;
  // SEQUENCE { INTEGER 0, SEQUENCE { OID rsaEncryption, NULL }, OCTET STRING <pkcs1> }
  const algoritme = [0x30, 0x0d, 0x06, 0x09, 0x2a, 0x86, 0x48, 0x86, 0xf7, 0x0d, 0x01, 0x01, 0x01, 0x05, 0x00];
  const octet = [0x04, ...derLen(der.length), ...der];
  const binnen = [0x02, 0x01, 0x00, ...algoritme, ...octet];
  return new Uint8Array([0x30, ...derLen(binnen.length), ...binnen]);
}

let sleutelCache = null; // { pem, key } — one import per isolate

async function ondertekenSleutel(env) {
  const pem = env.ENABLE_BANKING_PRIVATE_KEY;
  if (!pem || !env.ENABLE_BANKING_APP_ID) {
    throw new Fout(500, 'De bankkoppeling is nog niet ingesteld (ENABLE_BANKING_APP_ID / ENABLE_BANKING_PRIVATE_KEY).');
  }
  if (sleutelCache?.pem === pem) return sleutelCache.key;
  let key;
  try {
    key = await crypto.subtle.importKey(
      'pkcs8',
      pemNaarPkcs8(pem),
      { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
      false,
      ['sign'],
    );
  } catch {
    throw new Fout(500, 'ENABLE_BANKING_PRIVATE_KEY is geen geldige RSA-sleutel.');
  }
  sleutelCache = { pem, key };
  return key;
}

async function ebToken(env) {
  const key = await ondertekenSleutel(env);
  const nu = Math.floor(Date.now() / 1000);
  const kop = b64urlJson({ typ: 'JWT', alg: 'RS256', kid: env.ENABLE_BANKING_APP_ID });
  const claims = b64urlJson({ iss: 'enablebanking.com', aud: 'api.enablebanking.com', iat: nu, exp: nu + 3600 });
  const handtekening = await crypto.subtle.sign('RSASSA-PKCS1-v1_5', key, new TextEncoder().encode(`${kop}.${claims}`));
  return `${kop}.${claims}.${b64url(handtekening)}`;
}

/** Call Enable Banking. Throws Fout with the bank's own message on failure. */
export async function eb(env, pad, init = {}) {
  const res = await fetch(EB + pad, {
    ...init,
    headers: {
      Authorization: `Bearer ${await ebToken(env)}`,
      'Content-Type': 'application/json',
      ...(init.headers ?? {}),
    },
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const melding = data?.message ?? data?.detail ?? data?.error ?? `status ${res.status}`;
    const fout = new Fout(res.status === 401 || res.status === 403 ? 502 : res.status >= 500 ? 502 : 400, `Bank: ${melding}`);
    fout.bankStatus = res.status;
    fout.bankCode = data?.error ?? data?.code ?? null;
    throw fout;
  }
  return data;
}

/** ING's entry in Enable Banking's bank list, for its maximum consent length. */
export async function ingInfo(env) {
  try {
    const data = await eb(env, '/aspsps?country=NL&psu_type=personal');
    return (data?.aspsps ?? []).find((a) => /^ing$/i.test(a.name)) ?? null;
  } catch {
    return null; // fall back to defaults; /auth will say so if ING is really missing
  }
}

// ─── Supabase (service role) ─────────────────────────────────────────────────

/** PostgREST call with the service role. `pad` is relative to /rest/v1/. */
export async function db(env, pad, init = {}) {
  const sleutel = env.SUPABASE_SERVICE_ROLE_KEY;
  const res = await fetch(`${env.SUPABASE_URL.replace(/\/$/, '')}/rest/v1/${pad}`, {
    ...init,
    headers: {
      apikey: sleutel,
      Authorization: `Bearer ${sleutel}`,
      'Content-Type': 'application/json',
      Prefer: 'return=representation',
      ...(init.headers ?? {}),
    },
  });
  const tekst = await res.text();
  const data = tekst ? JSON.parse(tekst) : null;
  if (!res.ok) throw new Fout(500, `Database: ${data?.message ?? res.status}`);
  return data;
}

const q = encodeURIComponent;

export async function vereisLid(env, householdId, userId) {
  if (!householdId) throw new Fout(400, 'Geen huishouden gekozen');
  const rijen = await db(env, `budget_members?household_id=eq.${q(householdId)}&user_id=eq.${q(userId)}&select=user_id`);
  if (!rijen?.length) throw new Fout(403, 'Je zit niet in dit huishouden');
}

// ─── transactions ────────────────────────────────────────────────────────────

const isGeboekt = (t) => !t.status || t.status === 'BOOK';
const isPending = (t) => t.status === 'PDNG' || t.status === 'PEND';

/**
 * Turn Enable Banking transactions into budget_transactions rows: booked ones,
 * or with `pending` the ones still pending (card payments not yet booked).
 *
 * The bank's entry reference is the stable id. When a bank leaves both ids
 * empty, a fingerprint of the payment stands in, numbered so two identical
 * coffees on the same day stay two rows. Pending ids get a "p:" prefix so they
 * never collide with the booked version of the same payment.
 */
export function naarRijen(transacties, rekening, { pending = false } = {}) {
  const gezien = new Map();
  const rijen = [];
  for (const t of transacties) {
    if (pending ? !isPending(t) : !isGeboekt(t)) continue;
    const datum = t.booking_date ?? t.value_date ?? t.transaction_date;
    const bedrag = Math.abs(Number(t.transaction_amount?.amount));
    if (!datum || !Number.isFinite(bedrag) || bedrag === 0) continue;
    const af = t.credit_debit_indicator !== 'CRDT';
    const amount = Math.round((af ? -bedrag : bedrag) * 100) / 100;
    const omschrijving = (t.remittance_information ?? []).filter(Boolean).join(' ').replace(/\s+/g, ' ').trim() || null;
    const naam = (af ? t.creditor?.name : t.debtor?.name)?.trim() || null;
    // Card payments often carry no counterparty; the shop is the start of the description.
    // Split the raw first line: its double spaces separate the shop from the town.
    const eersteRegel = String((t.remittance_information ?? []).find(Boolean) ?? '');
    const tegenpartij =
      naam ?? (eersteRegel.split(/ {2,}|,|\bPasvolgnr/)[0].replace(/\s+/g, ' ').trim().slice(0, 80) || null);

    let id = t.entry_reference || t.transaction_id;
    if (!id) {
      const basis = `v:${datum}:${amount}:${tegenpartij ?? ''}:${omschrijving ?? ''}`;
      const n = (gezien.get(basis) ?? 0) + 1;
      gezien.set(basis, n);
      id = `${basis}#${n}`;
    }

    rijen.push({
      account_id: rekening.id,
      household_id: rekening.household_id,
      booked_on: datum,
      amount,
      currency: t.transaction_amount?.currency ?? 'EUR',
      counterparty: tegenpartij,
      description: omschrijving,
      provider_tx_id: `${pending ? 'p:' : ''}${id}`.slice(0, 300),
    });
  }
  return rijen;
}

/** Bank errors that mean the consent is gone and the user has to link again. */
const consentWeg = (e) =>
  [401, 403].includes(e?.bankStatus) ||
  /expired|revoked|not authori[sz]ed|closed/i.test(`${e?.bankCode ?? ''} ${e?.message ?? ''}`);

const nuIso = () => new Date().toISOString();
const patch = (env, pad, velden) =>
  db(env, pad, { method: 'PATCH', headers: { Prefer: 'return=minimal' }, body: JSON.stringify(velden) });

/** A consent is usable while its link is active and not past its end date. */
export const isActief = (toegang) =>
  toegang?.link?.status === 'active' &&
  (!toegang.valid_until || new Date(toegang.valid_until).getTime() > Date.now());

/**
 * Headers telling the bank the account holder is using the app right now. With
 * them, ING doesn't count the read against its 4-a-day cap for unattended
 * access. Only for a request from the person whose consent it is: never from
 * the background job, never with someone else's consent.
 */
export function aanwezig(request) {
  const ip = request.headers.get('CF-Connecting-IP');
  if (!ip) return null;
  return { 'Psu-Ip-Address': ip, 'Psu-User-Agent': (request.headers.get('User-Agent') ?? '').slice(0, 300) };
}

const normNaam = (s) => (s ?? '').trim().toLowerCase().replace(/\s+/g, ' ');
const dagVan = (iso) => Math.round(new Date(`${iso}T12:00:00Z`).getTime() / 86400000);

/**
 * Pending card payments, kept in step with the bank. The sorting someone did on
 * a pending payment must survive its booking, so a booked payment that matches
 * a pending row (same amount, same party or none known, within 4 days) turns
 * that row into the booked one instead of arriving as a new, unsorted twin.
 * Pending rows the bank no longer lists, and that didn't get booked, are gone
 * (a cancelled reservation) and are removed. Returns how many pending rows were
 * new, or null when the database doesn't have the column yet.
 */
export async function werkPendingBij(env, rekening, alles, geboekt) {
  let bestaand;
  try {
    bestaand = await db(
      env,
      `budget_transactions?account_id=eq.${q(rekening.id)}&in_behandeling=eq.true&select=id,provider_tx_id,amount,counterparty,booked_on`,
    );
  } catch {
    return null; // budget_pending.sql hasn't run: booked only, as before
  }
  const pending = naarRijen(alles, rekening, { pending: true }).map((r) => ({ ...r, in_behandeling: true }));
  const nogPending = new Set(pending.map((r) => r.provider_tx_id));

  // Pair existing pending rows with booked payments.
  const gebruikt = new Set();
  const paren = [];
  for (const e of bestaand ?? []) {
    const b = geboekt.find(
      (g) =>
        !gebruikt.has(g.provider_tx_id) &&
        g.amount === Number(e.amount) &&
        Math.abs(dagVan(g.booked_on) - dagVan(e.booked_on)) <= 4 &&
        (!e.counterparty || !g.counterparty || normNaam(e.counterparty) === normNaam(g.counterparty)),
    );
    if (b) {
      gebruikt.add(b.provider_tx_id);
      paren.push({ e, b });
    }
  }

  // A booked payment that's already stored means its pending row is a leftover.
  const alGeboekt = new Set();
  if (paren.length) {
    const lijst = paren.map((x) => `"${x.b.provider_tx_id.replace(/["\\]/g, (c) => `\\${c}`)}"`).join(',');
    const rijen = await db(
      env,
      `budget_transactions?account_id=eq.${q(rekening.id)}&provider_tx_id=in.(${q(lijst)})&select=provider_tx_id`,
    );
    for (const r of rijen ?? []) alGeboekt.add(r.provider_tx_id);
  }

  const weg = [];
  for (const { e, b } of paren) {
    if (alGeboekt.has(b.provider_tx_id)) weg.push(e.id);
    else
      await patch(env, `budget_transactions?id=eq.${q(e.id)}`, {
        provider_tx_id: b.provider_tx_id,
        booked_on: b.booked_on,
        counterparty: b.counterparty ?? e.counterparty,
        description: b.description,
        in_behandeling: false,
      });
  }
  const gekoppeld = new Set(paren.map((x) => x.e.id));
  for (const e of bestaand ?? []) if (!gekoppeld.has(e.id) && !nogPending.has(e.provider_tx_id)) weg.push(e.id);
  if (weg.length) {
    await db(env, `budget_transactions?id=in.(${weg.map(q).join(',')})`, {
      method: 'DELETE',
      headers: { Prefer: 'return=minimal' },
    });
  }

  // Still pending at the bank: add what's new, leave what's there (and sorted).
  const bekend = new Set((bestaand ?? []).map((e) => e.provider_tx_id));
  const nieuwePending = pending.filter((r) => !bekend.has(r.provider_tx_id));
  if (nieuwePending.length) {
    await db(env, 'budget_transactions?on_conflict=account_id,provider_tx_id', {
      method: 'POST',
      headers: { Prefer: 'resolution=ignore-duplicates,return=minimal' },
      body: JSON.stringify(nieuwePending),
    });
  }
  return nieuwePending.length;
}

/**
 * Fetch new transactions for one account through one holder's consent and
 * store them. `rekening` needs id, household_id, last_synced_at; `toegang` is
 * a budget_account_links row (provider_account_id, link_id, user_id).
 * With `diep` (right after linking) it reaches back as far as the bank allows;
 * `psu` marks the holder as present (see aanwezig).
 * Returns { nieuw, fout, ... }.
 */
export async function syncRekening(env, rekening, toegang, { diep = false, psu = null } = {}) {
  const deze = `budget_account_links?account_id=eq.${q(rekening.id)}&user_id=eq.${q(toegang.user_id)}`;

  const haal = async (vanaf, langst = false) => {
    const alles = [];
    let sleutel = null;
    for (let pagina = 0; pagina < 60; pagina++) {
      const params = new URLSearchParams({ date_from: isoDatum(vanaf) });
      // "longest": Enable Banking searches for the earliest transaction the bank
      // will give, treating date_from as a hint, instead of failing when the
      // period is too long. It may answer with an empty page plus a continuation key.
      if (langst) params.set('strategy', 'longest');
      if (sleutel) params.set('continuation_key', sleutel);
      const data = await eb(env, `/accounts/${q(toegang.provider_account_id)}/transactions?${params}`, {
        headers: psu ?? {},
      });
      alles.push(...(data?.transactions ?? []));
      sleutel = data?.continuation_key;
      if (!sleutel) break;
    }
    return alles;
  };

  try {
    let alles;
    let diepFout = null;
    if (diep) {
      try {
        alles = await haal(new Date(Date.now() - dagen(DIEPE_SYNC_DAGEN)), true);
      } catch (e) {
        if (consentWeg(e)) throw e;
        // Keep the bank's own words: they say whether it's a limit or a hiccup.
        diepFout = (e?.message ?? 'onbekend').slice(0, 200);
        alles = await haal(new Date(Date.now() - dagen(EERSTE_SYNC_DAGEN)));
      }
    } else {
      alles = await haal(
        rekening.last_synced_at
          ? new Date(new Date(rekening.last_synced_at).getTime() - dagen(OVERLAP_DAGEN))
          : new Date(Date.now() - dagen(EERSTE_SYNC_DAGEN)),
      );
    }

    const rijen = naarRijen(alles, rekening);
    // Pending first: it may turn pending rows into these booked ones.
    const nieuwPending = await werkPendingBij(env, rekening, alles, rijen);
    if (nieuwPending !== null) for (const r of rijen) r.in_behandeling = false;
    let nieuw = nieuwPending ?? 0;
    for (let i = 0; i < rijen.length; i += 500) {
      const ingevoegd = await db(env, 'budget_transactions?on_conflict=account_id,provider_tx_id&select=id', {
        method: 'POST',
        headers: { Prefer: 'resolution=ignore-duplicates,return=representation' },
        body: JSON.stringify(rijen.slice(i, i + 500)),
      });
      nieuw += ingevoegd?.length ?? 0;
    }

    // "Always income" / "always a transfer" rules apply without asking: a weekly
    // salary shouldn't need marking every week. Pot rules stay suggestions.
    if (nieuw > 0) {
      await db(env, 'rpc/budget_pas_soortregels', {
        method: 'POST',
        headers: { Prefer: 'return=minimal' },
        body: JSON.stringify({ p_household: rekening.household_id }),
      }).catch(() => {}); // before budget_soortregels.sql has run there's nothing to apply
    }

    await patch(env, `budget_accounts?id=eq.${q(rekening.id)}`, { last_synced_at: nuIso(), sync_error: null });
    await patch(env, deze, { sync_error: null }).catch(() => {});
    const datums = rijen.map((r) => r.booked_on).sort();
    return { nieuw, fout: null, opgehaald: rijen.length, oudste: datums[0] ?? null, diepFout };
  } catch (e) {
    const verlopen = consentWeg(e);
    const melding = verlopen ? 'Toestemming verlopen: koppel opnieuw' : (e?.message ?? 'Bijwerken mislukt').slice(0, 200);
    await patch(env, deze, { sync_error: melding }).catch(() => {});
    if (verlopen && toegang.link_id) {
      await patch(env, `budget_bank_links?id=eq.${q(toegang.link_id)}`, { status: 'expired', updated_at: nuIso() }).catch(
        () => {},
      );
    }
    return { nieuw: 0, fout: melding };
  }
}

/**
 * Keep the summary on budget_accounts in step with its consents: linked while
 * any consent exists (an expired one too, so the app can ask to renew), valid
 * until the latest active one ends.
 */
export async function werkSamenvattingBij(env, accountId) {
  const toegang =
    (await db(
      env,
      `budget_account_links?account_id=eq.${q(accountId)}&select=link_id,valid_until,sync_error,link:budget_bank_links(status)`,
    )) ?? [];
  const actief = toegang.filter(isActief);
  const eind = actief.map((t) => t.valid_until).filter(Boolean).sort().at(-1) ?? null;
  await patch(env, `budget_accounts?id=eq.${q(accountId)}`, {
    link_id: (actief[0] ?? toegang[0])?.link_id ?? null,
    consent_valid_until: eind,
    sync_error: toegang.length && !actief.length ? (toegang[0].sync_error ?? 'Toestemming verlopen: koppel opnieuw') : null,
  });
}

/** Close a session at Enable Banking (which revokes the bank consent) once no account uses it. */
export async function sluitLinkAlsLeeg(env, linkId) {
  if (!linkId) return;
  const nogInGebruik = await db(env, `budget_account_links?link_id=eq.${q(linkId)}&select=account_id&limit=1`);
  if (nogInGebruik?.length) return;
  const [link] = (await db(env, `budget_bank_links?id=eq.${q(linkId)}&select=session_id,status`)) ?? [];
  if (link?.session_id && link.status === 'active') {
    await eb(env, `/sessions/${q(link.session_id)}`, { method: 'DELETE' }).catch(() => {});
  }
  await patch(env, `budget_bank_links?id=eq.${q(linkId)}`, { status: 'revoked', updated_at: nuIso() });
}
