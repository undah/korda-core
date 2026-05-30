// Cloudflare Pages Function — WebSocket bridge for cTrader account list
// POST { token, clientId, clientSecret }
// Returns { accounts: [{ ctidTraderAccountId, isLive, traderLogin }] }

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

// ── Protobuf helpers ──────────────────────────────────────────────────────────

function encodeVarint(n) {
  if (typeof n !== 'bigint') n = BigInt(Math.trunc(Number(n)));
  const b = [];
  do {
    let byte = Number(n & 0x7fn);
    n >>= 7n;
    if (n > 0n) byte |= 0x80;
    b.push(byte);
  } while (n > 0n);
  return new Uint8Array(b);
}

function concat(...arrs) {
  const len = arrs.reduce((s, a) => s + a.length, 0);
  const r = new Uint8Array(len); let off = 0;
  for (const a of arrs) { r.set(a, off); off += a.length; }
  return r;
}

const vf = (f, n) => concat(encodeVarint(BigInt(f << 3) | 0n), encodeVarint(BigInt(n)));
const sf = (f, s) => { const b = new TextEncoder().encode(s); return concat(encodeVarint(BigInt(f << 3) | 2n), encodeVarint(b.length), b); };
const bf = (f, b) => concat(encodeVarint(BigInt(f << 3) | 2n), encodeVarint(b.length), b);

function frame(pt, payload) {
  const msg = concat(vf(1, pt), bf(2, payload));
  const out = new Uint8Array(4 + msg.length);
  new DataView(out.buffer).setUint32(0, msg.length, false);
  out.set(msg, 4);
  return out;
}

function readVarint(b, i) {
  let v = 0n, s = 0n;
  while (i < b.length) { const x = b[i++]; v |= BigInt(x & 0x7f) << s; s += 7n; if (!(x & 0x80)) break; }
  return [v, i];
}

function decode(b) {
  const f = {}; let i = 0;
  while (i < b.length) {
    let tag; [tag, i] = readVarint(b, i);
    const fn = Number(tag >> 3n), wt = Number(tag & 7n);
    let v;
    if      (wt === 0) { [v, i] = readVarint(b, i); }
    else if (wt === 2) { let l; [l, i] = readVarint(b, i); v = b.slice(i, i + Number(l)); i += Number(l); }
    else if (wt === 1) { v = b.slice(i, i + 8); i += 8; }
    else if (wt === 5) { v = b.slice(i, i + 4); i += 4; }
    else break;
    if (fn in f) { if (!Array.isArray(f[fn])) f[fn] = [f[fn]]; f[fn].push(v); } else f[fn] = v;
  }
  return f;
}

const toArr = (v) => v == null ? [] : Array.isArray(v) ? v : [v];
const num   = (v) => v == null ? 0 : Number(typeof v === 'bigint' ? v : BigInt.asIntN(64, v));
const str   = (v) => v instanceof Uint8Array ? new TextDecoder().decode(v) : String(v ?? '');

// ── Messages ──────────────────────────────────────────────────────────────────

const msgAppAuth     = (id, sec) => frame(2100, concat(sf(1, id), sf(2, sec)));
const msgAccountList = (token)   => frame(2149, sf(1, token));

// ── Handler ───────────────────────────────────────────────────────────────────

export async function onRequest(context) {
  const { request } = context;

  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS });
  if (request.method !== 'POST') return new Response('Method not allowed', { status: 405, headers: CORS });

  let body;
  try { body = await request.json(); } catch { return json({ error: 'Invalid JSON' }, 400); }

  const { token, clientId, clientSecret } = body;
  if (!token || !clientId || !clientSecret)
    return json({ error: 'Missing: token, clientId, clientSecret' }, 400);

  const wsResp = await fetch('https://live.ctraderapi.com:5035/', {
    headers: { Upgrade: 'websocket', Connection: 'Upgrade' },
  }).catch(() => null);

  if (!wsResp || wsResp.status !== 101)
    return json({ error: `WebSocket connect failed: ${wsResp?.status ?? 'network error'}` }, 502);

  const ws = wsResp.webSocket;
  ws.accept();
  ws.send(msgAppAuth(clientId, clientSecret));

  return new Promise((resolve) => {
    let state = 'app_auth';
    let done = false;

    const finish = (data, status = 200) => {
      if (done) return; done = true;
      try { ws.close(1000); } catch {}
      resolve(new Response(JSON.stringify(data), { status, headers: { ...CORS, 'Content-Type': 'application/json' } }));
    };

    const timer = setTimeout(() => finish({ error: 'cTrader timeout' }, 504), 20_000);

    ws.addEventListener('message', (evt) => {
      try {
        const raw = new Uint8Array(evt.data instanceof ArrayBuffer ? evt.data : evt.data.buffer);
        const msg = decode(raw.slice(4));
        const pt = num(msg[1]);
        const payload = msg[2] instanceof Uint8Array ? msg[2] : new Uint8Array(0);

        if (pt === 50 || pt === 2142) {
          const e = decode(payload);
          finish({ error: `cTrader: ${str(e[2])} (${str(e[1])})` }, 500); return;
        }

        if (state === 'app_auth' && pt === 2101) {
          state = 'acc_list';
          ws.send(msgAccountList(token));
        } else if (state === 'acc_list' && pt === 2150) {
          clearTimeout(timer);
          const res = decode(payload);
          const accounts = toArr(res[2]).map((b) => {
            const a = decode(b);
            return {
              ctidTraderAccountId: num(a[1]),
              isLive: num(a[2]) === 1,
              traderLogin: num(a[3]),
            };
          });
          finish({ accounts });
        }
      } catch (e) { finish({ error: String(e) }, 500); }
    });

    ws.addEventListener('error', () => finish({ error: 'WebSocket error' }, 502));
    ws.addEventListener('close', () => { if (!done) finish({ error: 'WebSocket closed unexpectedly' }, 502); });
  });
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { ...CORS, 'Content-Type': 'application/json' } });
}
