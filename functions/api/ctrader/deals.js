// Cloudflare Pages Function — WebSocket bridge for cTrader deal history
// POST { token, ctidTraderAccountId, clientId, clientSecret, from, to }
// Returns { deals: TradeEntry[] }

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

const toArr   = (v) => v == null ? [] : Array.isArray(v) ? v : [v];
const num     = (v) => v == null ? 0 : Number(typeof v === 'bigint' ? v : v);
const signed  = (v) => { const n = typeof v === 'bigint' ? v : 0n; return n >= 9223372036854775808n ? n - 18446744073709551616n : n; };
const str     = (v) => v instanceof Uint8Array ? new TextDecoder().decode(v) : String(v ?? '');

// ── Messages ──────────────────────────────────────────────────────────────────

const msgAppAuth  = (id, sec)        => frame(2100, concat(sf(1, id), sf(2, sec)));
const msgAccAuth  = (accId, token)   => frame(2102, concat(vf(1, accId), sf(2, token)));
const msgSymbols  = (accId)          => frame(2115, vf(1, accId));
const msgDeals    = (accId, f, t)    => frame(2155, concat(vf(1, accId), vf(3, BigInt(f)), vf(4, BigInt(t)), vf(5, 5000)));

// ── Deal parser ───────────────────────────────────────────────────────────────

function parseDeal(bytes, symMap) {
  const d = decode(bytes);
  if (!d[10]) return null; // No closePositionDetail = opening deal, skip

  const cp      = decode(d[10]);
  const gross   = signed(cp[2] ?? 0n);
  const swap    = signed(cp[3] ?? 0n);
  const comm    = signed(cp[4] ?? 0n);
  const pnl     = Number(gross + swap + comm) / 100;

  const symbolId = num(d[6] ?? 0n);
  const closeMs  = num(d[8] ?? d[7] ?? 0n);
  const openMs   = cp[14] != null ? num(cp[14]) : null;

  return {
    id:           String(d[1] ?? '?'),
    pair:         (symMap[symbolId] ?? String(symbolId)).replace(/[^A-Z0-9]/gi, '').toUpperCase(),
    side:         num(d[12]) === 2 ? 'sell' : 'buy',
    pnl,
    pnl_percent:  null,
    trade_time:   closeMs ? new Date(closeMs).toISOString() : new Date().toISOString(),
    open_time:    openMs  ? new Date(openMs).toISOString()  : null,
    account_type: 'live',
  };
}

// ── Handler ───────────────────────────────────────────────────────────────────

export async function onRequest(context) {
  const { request } = context;

  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS });
  if (request.method !== 'POST') return new Response('Method not allowed', { status: 405, headers: CORS });

  let body;
  try { body = await request.json(); } catch { return json({ error: 'Invalid JSON' }, 400); }

  const { token, ctidTraderAccountId, clientId, clientSecret, from: fromMs = 0, to: toMs = Date.now() } = body;
  if (!token || !ctidTraderAccountId || !clientId || !clientSecret)
    return json({ error: 'Missing: token, ctidTraderAccountId, clientId, clientSecret' }, 400);

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
    const symMap = {};
    let done = false;

    const finish = (data, status = 200) => {
      if (done) return; done = true;
      try { ws.close(1000); } catch {}
      resolve(new Response(JSON.stringify(data), { status, headers: { ...CORS, 'Content-Type': 'application/json' } }));
    };

    const timer = setTimeout(() => finish({ error: 'cTrader timeout' }, 504), 25_000);

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
          state = 'acc_auth';
          ws.send(msgAccAuth(ctidTraderAccountId, token));
        } else if (state === 'acc_auth' && pt === 2103) {
          state = 'symbols';
          ws.send(msgSymbols(ctidTraderAccountId));
        } else if (state === 'symbols' && pt === 2116) {
          const sr = decode(payload);
          for (const sb of toArr(sr[2])) {
            const s = decode(sb);
            if (s[1] && s[2]) symMap[num(s[1])] = str(s[2]);
          }
          state = 'deals';
          ws.send(msgDeals(ctidTraderAccountId, fromMs, toMs));
        } else if (state === 'deals' && pt === 2156) {
          clearTimeout(timer);
          const dr = decode(payload);
          const deals = toArr(dr[2]).map(b => parseDeal(b, symMap)).filter(Boolean);
          finish({ deals });
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
