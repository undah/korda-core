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

/** First sync after linking reaches back this far; PSD2 guarantees 90 days. */
const EERSTE_SYNC_DAGEN = 89;
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

/**
 * Turn Enable Banking transactions into budget_transactions rows. Only booked
 * ones: pending card payments change amount or vanish, and would leave ghosts.
 *
 * The bank's entry reference is the stable id. When a bank leaves both ids
 * empty, a fingerprint of the payment stands in, numbered so two identical
 * coffees on the same day stay two rows.
 */
export function naarRijen(transacties, rekening) {
  const gezien = new Map();
  const rijen = [];
  for (const t of transacties) {
    if (t.status && t.status !== 'BOOK') continue;
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
      provider_tx_id: String(id).slice(0, 300),
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
 * Fetch new transactions for one account through one holder's consent and
 * store them. `rekening` needs id, household_id, last_synced_at; `toegang` is
 * a budget_account_links row (provider_account_id, link_id, user_id).
 * Returns { nieuw, fout }.
 */
export async function syncRekening(env, rekening, toegang) {
  const vanaf = rekening.last_synced_at
    ? new Date(new Date(rekening.last_synced_at).getTime() - dagen(OVERLAP_DAGEN))
    : new Date(Date.now() - dagen(EERSTE_SYNC_DAGEN));
  const deze = `budget_account_links?account_id=eq.${q(rekening.id)}&user_id=eq.${q(toegang.user_id)}`;

  try {
    const alles = [];
    let sleutel = null;
    for (let pagina = 0; pagina < 25; pagina++) {
      const params = new URLSearchParams({ date_from: isoDatum(vanaf) });
      if (sleutel) params.set('continuation_key', sleutel);
      const data = await eb(env, `/accounts/${q(toegang.provider_account_id)}/transactions?${params}`);
      alles.push(...(data?.transactions ?? []));
      sleutel = data?.continuation_key;
      if (!sleutel) break;
    }

    const rijen = naarRijen(alles, rekening);
    let nieuw = 0;
    for (let i = 0; i < rijen.length; i += 500) {
      const ingevoegd = await db(env, 'budget_transactions?on_conflict=account_id,provider_tx_id&select=id', {
        method: 'POST',
        headers: { Prefer: 'resolution=ignore-duplicates,return=representation' },
        body: JSON.stringify(rijen.slice(i, i + 500)),
      });
      nieuw += ingevoegd?.length ?? 0;
    }

    await patch(env, `budget_accounts?id=eq.${q(rekening.id)}`, { last_synced_at: nuIso(), sync_error: null });
    await patch(env, deze, { sync_error: null }).catch(() => {});
    return { nieuw, fout: null };
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
