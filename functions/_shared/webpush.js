/**
 * Web Push from a Cloudflare Function, with WebCrypto only.
 *
 * A push message to a browser has two parts:
 * - VAPID (RFC 8292): a short ES256-signed JWT that proves the message comes
 *   from us. The browser only accepts pushes signed by the key it subscribed
 *   with (the public half is in the app; VAPID_PRIVATE_KEY is a secret).
 * - Encryption (RFC 8291, aes128gcm): the push service (Google, Apple,
 *   Mozilla) relays the message but can't read it. Only the subscribed browser
 *   holds the key to decrypt.
 *
 * Nothing here is a route.
 */

export const VAPID_PUBLIC = 'BGFItmB0B59Df1pvoU7RwID7JmHpRJI5Fr51oPThIU-imjfeWT5d_yKHTFCRI31S2zyd7jAVxI_UiZDwHOGg8sQ';
const CONTACT = 'https://kordacore.com/budget';

const enc = new TextEncoder();

const b64url = (bytes) => {
  let s = '';
  for (const b of new Uint8Array(bytes)) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
};
const vanB64url = (s) => {
  const b = atob(s.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - (s.length % 4)) % 4));
  return Uint8Array.from(b, (c) => c.charCodeAt(0));
};
const samen = (...delen) => {
  const uit = new Uint8Array(delen.reduce((n, d) => n + d.length, 0));
  let i = 0;
  for (const d of delen) {
    uit.set(d, i);
    i += d.length;
  }
  return uit;
};

let sleutelCache = null;
async function vapidSleutel(pem) {
  if (sleutelCache?.pem === pem) return sleutelCache.key;
  const inhoud = String(pem).replace(/\\n/g, '\n').replace(/-----[^-]+-----/g, '').replace(/\s+/g, '');
  const key = await crypto.subtle.importKey(
    'pkcs8',
    Uint8Array.from(atob(inhoud), (c) => c.charCodeAt(0)),
    { name: 'ECDSA', namedCurve: 'P-256' },
    false,
    ['sign'],
  );
  sleutelCache = { pem, key };
  return key;
}

/** VAPID Authorization header for one push service (audience = its origin). */
async function vapidKop(env, endpoint) {
  const nu = Math.floor(Date.now() / 1000);
  const kop = b64url(enc.encode(JSON.stringify({ typ: 'JWT', alg: 'ES256' })));
  const claims = b64url(enc.encode(JSON.stringify({ aud: new URL(endpoint).origin, exp: nu + 12 * 3600, sub: CONTACT })));
  // WebCrypto's ECDSA signature is already r||s, the form a JWT wants.
  const sig = await crypto.subtle.sign(
    { name: 'ECDSA', hash: 'SHA-256' },
    await vapidSleutel(env.VAPID_PRIVATE_KEY),
    enc.encode(`${kop}.${claims}`),
  );
  return `vapid t=${kop}.${claims}.${b64url(sig)}, k=${VAPID_PUBLIC}`;
}

async function hkdf(salt, ikm, info, lengte) {
  const key = await crypto.subtle.importKey('raw', ikm, 'HKDF', false, ['deriveBits']);
  return new Uint8Array(await crypto.subtle.deriveBits({ name: 'HKDF', hash: 'SHA-256', salt, info }, key, lengte * 8));
}

/** RFC 8291 aes128gcm body for one subscription (keys: p256dh, auth, base64url). */
export async function versleutel(tekst, p256dh, auth) {
  const uaPublic = vanB64url(p256dh);
  const authSecret = vanB64url(auth);

  const paar = await crypto.subtle.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, true, ['deriveBits']);
  const asPublic = new Uint8Array(await crypto.subtle.exportKey('raw', paar.publicKey));
  const uaKey = await crypto.subtle.importKey('raw', uaPublic, { name: 'ECDH', namedCurve: 'P-256' }, false, []);
  const gedeeld = new Uint8Array(await crypto.subtle.deriveBits({ name: 'ECDH', public: uaKey }, paar.privateKey, 256));

  const ikm = await hkdf(authSecret, gedeeld, samen(enc.encode('WebPush: info\0'), uaPublic, asPublic), 32);
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const cek = await hkdf(salt, ikm, enc.encode('Content-Encoding: aes128gcm\0'), 16);
  const nonce = await hkdf(salt, ikm, enc.encode('Content-Encoding: nonce\0'), 12);

  // One record: the message, then the 0x02 delimiter that marks the last record.
  const aes = await crypto.subtle.importKey('raw', cek, 'AES-GCM', false, ['encrypt']);
  const cipher = new Uint8Array(
    await crypto.subtle.encrypt({ name: 'AES-GCM', iv: nonce }, aes, samen(enc.encode(tekst), new Uint8Array([2]))),
  );

  const rs = new Uint8Array([0, 0, 16, 0]); // record size 4096
  return samen(salt, rs, new Uint8Array([asPublic.length]), asPublic, cipher);
}

/**
 * Send one notification. Returns 'ok', 'weg' (the subscription is gone: the
 * caller should delete it) or 'fout'.
 */
export async function stuurPush(env, abonnement, bericht) {
  if (!env.VAPID_PRIVATE_KEY) return 'fout';
  try {
    const body = await versleutel(JSON.stringify(bericht), abonnement.p256dh, abonnement.auth);
    const res = await fetch(abonnement.endpoint, {
      method: 'POST',
      headers: {
        Authorization: await vapidKop(env, abonnement.endpoint),
        'Content-Encoding': 'aes128gcm',
        'Content-Type': 'application/octet-stream',
        TTL: '86400',
        Urgency: 'normal',
      },
      body,
    });
    if (res.status === 404 || res.status === 410) return 'weg';
    return res.ok ? 'ok' : 'fout';
  } catch {
    return 'fout';
  }
}
