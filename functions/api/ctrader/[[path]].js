// Cloudflare Pages Function — cTrader API bridge
// Uses cloudflare:sockets (raw TCP) to reach live.ctraderapi.com:5035
// which is not reachable via fetch() due to CF port restrictions.

import { connect } from 'cloudflare:sockets';

const CTRADER_REST = 'https://openapi.ctrader.com/apps';
const CT_HOST      = 'live.ctraderapi.com';
const CT_PORT      = 5035;

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Authorization, Content-Type',
};

function jsonRes(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...CORS, 'Content-Type': 'application/json' },
  });
}

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

const toArr  = (v) => v == null ? [] : Array.isArray(v) ? v : [v];
const num    = (v) => v == null ? 0 : Number(typeof v === 'bigint' ? v : v);
const signed = (v) => { const n = typeof v === 'bigint' ? v : 0n; return n >= 9223372036854775808n ? n - 18446744073709551616n : n; };
const str    = (v) => v instanceof Uint8Array ? new TextDecoder().decode(v) : String(v ?? '');

const msgAppAuth     = (id, sec)   => frame(2100, concat(sf(1, id), sf(2, sec)));
const msgAccountList = (token)     => frame(2149, sf(1, token));
const msgAccAuth     = (aid, tok)  => frame(2102, concat(vf(1, aid), sf(2, tok)));
const msgSymbols     = (aid)       => frame(2115, vf(1, aid));
const msgDeals       = (aid, f, t) => frame(2155, concat(vf(1, aid), vf(3, BigInt(f)), vf(4, BigInt(t)), vf(5, 5000)));

// ── WebSocket frame encoder (client→server, must be masked) ──────────────────

function wsEncode(data) {
  const payload = data instanceof ArrayBuffer ? new Uint8Array(data) : data;
  const len = payload.length;
  const mask = crypto.getRandomValues(new Uint8Array(4));
  const masked = new Uint8Array(len);
  for (let i = 0; i < len; i++) masked[i] = payload[i] ^ mask[i % 4];

  let hdr;
  if (len < 126)
    hdr = new Uint8Array([0x82, 0x80 | len, ...mask]);
  else if (len < 65536)
    hdr = new Uint8Array([0x82, 0xfe, len >> 8, len & 0xff, ...mask]);
  else
    hdr = new Uint8Array([0x82, 0xff, 0, 0, 0, 0, (len >>> 24) & 0xff, (len >>> 16) & 0xff, (len >>> 8) & 0xff, len & 0xff, ...mask]);

  const out = new Uint8Array(hdr.length + len);
  out.set(hdr); out.set(masked, hdr.length);
  return out;
}

// ── WebSocket frame decoder (server→client, unmasked) ────────────────────────

class WSDec {
  constructor(init) { this.b = init ?? new Uint8Array(0); }
  push(chunk) {
    const n = new Uint8Array(this.b.length + chunk.length);
    n.set(this.b); n.set(chunk, this.b.length); this.b = n;
  }
  next() {
    if (this.b.length < 2) return null;
    const opc = this.b[0] & 0x0f;
    const msk = (this.b[1] & 0x80) !== 0;
    let len = this.b[1] & 0x7f, off = 2;
    if (len === 126) {
      if (this.b.length < 4) return null;
      len = (this.b[2] << 8) | this.b[3]; off = 4;
    } else if (len === 127) {
      if (this.b.length < 10) return null;
      len = ((this.b[6] << 24) | (this.b[7] << 16) | (this.b[8] << 8) | this.b[9]) >>> 0;
      off = 10;
    }
    if (msk) off += 4;
    if (this.b.length < off + len) return null;
    let data = this.b.slice(off, off + len);
    if (msk) { const mk = this.b.slice(off - 4, off); data = data.map((b, i) => b ^ mk[i % 4]); }
    this.b = this.b.slice(off + len);
    if (opc === 0x08) return { type: 'close' };
    if (opc === 0x02 || opc === 0x00) return { type: 'binary', data };
    return this.next(); // skip control frames
  }
}

// ── Raw TCP + TLS WebSocket connection ────────────────────────────────────────

async function tcpConnect() {
  const socket = connect({ hostname: CT_HOST, port: CT_PORT }, { secureTransport: 'on' });
  const writer = socket.writable.getWriter();
  const reader = socket.readable.getReader();

  // HTTP/1.1 WebSocket upgrade handshake
  const key = btoa(String.fromCharCode(...Array.from(crypto.getRandomValues(new Uint8Array(16)))));
  await writer.write(new TextEncoder().encode(
    `GET / HTTP/1.1\r\nHost: ${CT_HOST}:${CT_PORT}\r\nUpgrade: websocket\r\nConnection: Upgrade\r\nSec-WebSocket-Key: ${key}\r\nSec-WebSocket-Version: 13\r\n\r\n`
  ));

  // Read until \r\n\r\n (end of HTTP response headers)
  let acc = new Uint8Array(0);
  let sepAt = -1;
  while (sepAt === -1) {
    const { value, done } = await reader.read();
    if (done) throw new Error('Connection closed during WS handshake');
    const n = new Uint8Array(acc.length + value.length);
    n.set(acc); n.set(value, acc.length); acc = n;
    for (let i = 0; i <= acc.length - 4; i++) {
      if (acc[i] === 13 && acc[i + 1] === 10 && acc[i + 2] === 13 && acc[i + 3] === 10) {
        sepAt = i; break;
      }
    }
  }

  const httpResp = new TextDecoder().decode(acc.slice(0, sepAt));
  if (!httpResp.includes('101')) throw new Error(`WS handshake rejected: ${httpResp.slice(0, 200)}`);

  // Any bytes after the HTTP headers are the start of the WebSocket stream
  const dec = new WSDec(acc.slice(sepAt + 4));

  const readBinary = async (timeoutMs = 12000) => {
    const deadline = Date.now() + timeoutMs;
    while (true) {
      const f = dec.next();
      if (f) {
        if (f.type === 'close') throw new Error('WS closed by server');
        if (f.type === 'binary') return f.data;
      }
      const remain = deadline - Date.now();
      if (remain <= 0) throw new Error('Timeout waiting for WS frame');
      const { value, done } = await Promise.race([
        reader.read(),
        new Promise((_, rej) => setTimeout(() => rej(new Error('Timeout waiting for WS frame')), remain)),
      ]);
      if (done) throw new Error('WS stream ended');
      dec.push(value);
    }
  };

  return {
    send:      async (data) => writer.write(wsEncode(data instanceof ArrayBuffer ? new Uint8Array(data) : data)),
    readBinary,
    close:     () => { try { socket.close(); } catch {} },
  };
}

// ── cTrader error check ───────────────────────────────────────────────────────

function checkCtError(pt, payload) {
  if (pt === 50 || pt === 2142) {
    const e = decode(payload);
    throw new Error(`cTrader error: ${str(e[2] ?? e[1])}`);
  }
}

// ── Accounts bridge ───────────────────────────────────────────────────────────

async function handleAccounts(request) {
  let body;
  try { body = await request.json(); } catch { return jsonRes({ error: 'Invalid JSON' }, 400); }

  const { token, clientId, clientSecret } = body;
  if (!token || !clientId || !clientSecret)
    return jsonRes({ error: 'Missing: token, clientId, clientSecret' }, 400);

  let ws;
  try { ws = await tcpConnect(); }
  catch (e) { return jsonRes({ error: 'TCP connect failed: ' + String(e?.message ?? e) }, 502); }

  try {
    // App authentication
    await ws.send(msgAppAuth(clientId, clientSecret).buffer);
    while (true) {
      const raw = await ws.readBinary();
      const msg = decode(raw.slice(4));
      const pt = num(msg[1]);
      const pl = msg[2] instanceof Uint8Array ? msg[2] : new Uint8Array(0);
      checkCtError(pt, pl);
      if (pt === 2101) break;
    }

    // Account list
    await ws.send(msgAccountList(token).buffer);
    while (true) {
      const raw = await ws.readBinary();
      const msg = decode(raw.slice(4));
      const pt = num(msg[1]);
      const pl = msg[2] instanceof Uint8Array ? msg[2] : new Uint8Array(0);
      checkCtError(pt, pl);
      if (pt === 2150) {
        const res = decode(pl);
        const accounts = toArr(res[2]).map(b => {
          const a = decode(b);
          return { ctidTraderAccountId: num(a[1]), isLive: num(a[2]) === 1, traderLogin: num(a[3]) };
        });
        ws.close();
        return jsonRes({ accounts });
      }
    }
  } catch (e) {
    ws.close();
    return jsonRes({ error: String(e?.message ?? e) }, 500);
  }
}

// ── Deals bridge ──────────────────────────────────────────────────────────────

function parseDeal(bytes, symMap) {
  const d = decode(bytes);
  if (!d[10]) return null;
  const cp    = decode(d[10]);
  const gross = signed(cp[2] ?? 0n);
  const swap  = signed(cp[3] ?? 0n);
  const comm  = signed(cp[4] ?? 0n);
  const pnl   = Number(gross + swap + comm) / 100;
  const symbolId = num(d[6] ?? 0n);
  const closeMs  = num(d[8] ?? d[7] ?? 0n);
  const openMs   = cp[14] != null ? num(cp[14]) : null;
  return {
    id:          String(d[1] ?? '?'),
    pair:        (symMap[symbolId] ?? String(symbolId)).replace(/[^A-Z0-9]/gi, '').toUpperCase(),
    side:        num(d[12]) === 2 ? 'sell' : 'buy',
    pnl,
    pnl_percent: null,
    trade_time:  closeMs ? new Date(closeMs).toISOString() : new Date().toISOString(),
    open_time:   openMs  ? new Date(openMs).toISOString()  : null,
    account_type: 'live',
  };
}

async function handleDeals(request) {
  let body;
  try { body = await request.json(); } catch { return jsonRes({ error: 'Invalid JSON' }, 400); }

  const { token, ctidTraderAccountId, clientId, clientSecret, from: fromMs = 0, to: toMs = Date.now() } = body;
  if (!token || !ctidTraderAccountId || !clientId || !clientSecret)
    return jsonRes({ error: 'Missing: token, ctidTraderAccountId, clientId, clientSecret' }, 400);

  let ws;
  try { ws = await tcpConnect(); }
  catch (e) { return jsonRes({ error: 'TCP connect failed: ' + String(e?.message ?? e) }, 502); }

  try {
    const symMap = {};

    // App authentication
    await ws.send(msgAppAuth(clientId, clientSecret).buffer);
    while (true) {
      const raw = await ws.readBinary();
      const msg = decode(raw.slice(4));
      const pt = num(msg[1]);
      const pl = msg[2] instanceof Uint8Array ? msg[2] : new Uint8Array(0);
      checkCtError(pt, pl);
      if (pt === 2101) break;
    }

    // Account authentication
    await ws.send(msgAccAuth(ctidTraderAccountId, token).buffer);
    while (true) {
      const raw = await ws.readBinary();
      const msg = decode(raw.slice(4));
      const pt = num(msg[1]);
      const pl = msg[2] instanceof Uint8Array ? msg[2] : new Uint8Array(0);
      checkCtError(pt, pl);
      if (pt === 2103) break;
    }

    // Symbol list (to build symbolId → name map)
    await ws.send(msgSymbols(ctidTraderAccountId).buffer);
    while (true) {
      const raw = await ws.readBinary();
      const msg = decode(raw.slice(4));
      const pt = num(msg[1]);
      const pl = msg[2] instanceof Uint8Array ? msg[2] : new Uint8Array(0);
      checkCtError(pt, pl);
      if (pt === 2116) {
        const sr = decode(pl);
        for (const sb of toArr(sr[2])) {
          const s = decode(sb);
          if (s[1] && s[2]) symMap[num(s[1])] = str(s[2]);
        }
        break;
      }
    }

    // Deal list
    await ws.send(msgDeals(ctidTraderAccountId, fromMs, toMs).buffer);
    while (true) {
      const raw = await ws.readBinary();
      const msg = decode(raw.slice(4));
      const pt = num(msg[1]);
      const pl = msg[2] instanceof Uint8Array ? msg[2] : new Uint8Array(0);
      checkCtError(pt, pl);
      if (pt === 2156) {
        const dr = decode(pl);
        const deals = toArr(dr[2]).map(b => parseDeal(b, symMap)).filter(Boolean);
        ws.close();
        return jsonRes({ deals });
      }
    }
  } catch (e) {
    ws.close();
    return jsonRes({ error: String(e?.message ?? e) }, 500);
  }
}

// ── Main handler ──────────────────────────────────────────────────────────────

export async function onRequest(context) {
  const { request } = context;

  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS });

  const url  = new URL(request.url);
  const path = url.pathname.replace(/^\/api\/ctrader\/?/, '');

  if (request.method === 'POST' && path === 'accounts') return handleAccounts(request);
  if (request.method === 'POST' && path === 'deals')    return handleDeals(request);

  // Proxy everything else to cTrader REST API (token, etc.)
  const targetUrl = `${CTRADER_REST}${url.pathname.replace(/^\/api\/ctrader/, '')}${url.search}`;
  const res  = await fetch(new Request(targetUrl, {
    method:  request.method,
    headers: request.headers,
    body:    request.method !== 'GET' && request.method !== 'HEAD' ? request.body : undefined,
  }));
  const text = await res.text();
  return new Response(text, {
    status:  res.status,
    headers: { 'Content-Type': res.headers.get('Content-Type') ?? 'application/json', ...CORS },
  });
}
