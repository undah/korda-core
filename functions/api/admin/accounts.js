/**
 * /api/admin/accounts — every Korda account, and what an admin can change.
 *
 *   GET   → { accounts, log, ik }
 *   POST  { actie, userId?, ... } → { ok, ... }
 *
 * Only reachable through ./_middleware.js (signed in + admin). Uses the
 * service role against Supabase Auth's admin API and the korda_* tables from
 * supabase/suite_toegang.sql. Every change is written to korda_admin_log.
 */

const APPS = ['outreach', 'crm', 'training'];
const BAN_ALTIJD = '876000h'; // ~100 years: blocked until unblocked
const json = (data, status = 200) => Response.json(data, { status });

class Fout extends Error {
  constructor(status, bericht) {
    super(bericht);
    this.status = status;
  }
}

function maakClient(env) {
  const basis = env.SUPABASE_URL.replace(/\/$/, '');
  const sleutel = env.SUPABASE_SERVICE_ROLE_KEY;
  const kop = { apikey: sleutel, Authorization: `Bearer ${sleutel}`, 'Content-Type': 'application/json' };
  async function roep(pad, init = {}) {
    const res = await fetch(`${basis}${pad}`, { ...init, headers: { ...kop, ...(init.headers ?? {}) } });
    const tekst = await res.text();
    const data = tekst ? JSON.parse(tekst) : null;
    if (!res.ok) throw new Fout(res.status >= 500 ? 502 : 400, data?.msg ?? data?.message ?? data?.error_description ?? data?.error ?? `HTTP ${res.status}`);
    return data;
  }
  return {
    auth: (pad, init) => roep(`/auth/v1${pad}`, init),
    db: (pad, init) => roep(`/rest/v1/${pad}`, { ...init, headers: { Prefer: 'return=representation', ...(init?.headers ?? {}) } }),
  };
}

async function alleGebruikers(c) {
  const lijst = [];
  for (let pagina = 1; pagina <= 50; pagina++) {
    const r = await c.auth(`/admin/users?page=${pagina}&per_page=200`);
    const users = r?.users ?? [];
    lijst.push(...users);
    if (users.length < 200) break;
  }
  return lijst;
}

const geblokkeerd = (u) => !!u.banned_until && new Date(u.banned_until) > new Date();

export async function onRequestGet({ env, data }) {
  try {
    const c = maakClient(env);
    const [users, toegang, admins, leden, log] = await Promise.all([
      alleGebruikers(c),
      c.db('korda_app_toegang?select=user_id,app'),
      c.db('korda_admins?select=user_id'),
      c.db('budget_members?select=user_id,household_id,display_name').catch(() => []),
      c.db('korda_admin_log?select=door_email,wie_email,actie,details,at&order=at.desc&limit=40').catch(() => []),
    ]);
    const appsVan = new Map();
    for (const t of toegang ?? []) appsVan.set(t.user_id, [...(appsVan.get(t.user_id) ?? []), t.app]);
    const adminIds = new Set((admins ?? []).map((a) => a.user_id));
    const huishoudens = new Map();
    const budgetNaam = new Map();
    for (const l of leden ?? []) {
      huishoudens.set(l.user_id, (huishoudens.get(l.user_id) ?? 0) + 1);
      if (l.display_name && !budgetNaam.has(l.user_id)) budgetNaam.set(l.user_id, l.display_name);
    }

    const accounts = users
      .map((u) => ({
        id: u.id,
        email: u.email ?? u.phone ?? '(geen e-mail)',
        naam: u.user_metadata?.display_name ?? u.user_metadata?.full_name ?? u.user_metadata?.name ?? budgetNaam.get(u.id) ?? null,
        aangemaakt: u.created_at,
        laatstIngelogd: u.last_sign_in_at ?? null,
        bevestigd: !!(u.email_confirmed_at ?? u.confirmed_at),
        geblokkeerd: geblokkeerd(u),
        providers: u.app_metadata?.providers ?? (u.app_metadata?.provider ? [u.app_metadata.provider] : []),
        apps: (appsVan.get(u.id) ?? []).sort(),
        admin: adminIds.has(u.id),
        huishoudens: huishoudens.get(u.id) ?? 0,
      }))
      .sort((a, b) => (b.aangemaakt ?? '').localeCompare(a.aangemaakt ?? ''));

    return json({ accounts, log: log ?? [], ik: data.userId });
  } catch (e) {
    return json({ error: e.message }, e.status ?? 500);
  }
}

export async function onRequestPost({ request, env, data }) {
  let body;
  try {
    body = await request.json();
  } catch {
    return json({ error: 'Invalid JSON' }, 400);
  }
  const { actie, userId } = body ?? {};
  const ik = data.userId;
  const c = maakClient(env);

  try {
    // Who it's about, for the checks and the log (not needed when creating).
    const doel = actie === 'maak' ? null : await c.auth(`/admin/users/${encodeURIComponent(String(userId ?? ''))}`);
    if (actie !== 'maak' && !doel?.id) throw new Fout(404, 'Account not found');
    const zelf = doel?.id === ik;
    let details = null;
    let antwoord = { ok: true };

    switch (actie) {
      case 'wachtwoord': {
        const w = String(body.wachtwoord ?? '');
        if (w.length < 8) throw new Fout(400, 'Password must be at least 8 characters');
        await c.auth(`/admin/users/${doel.id}`, { method: 'PUT', body: JSON.stringify({ password: w }) });
        break;
      }
      case 'email': {
        const email = String(body.email ?? '').trim().toLowerCase();
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Fout(400, 'That is not an e-mail address');
        // email_confirm: the admin vouches for it, no confirmation mail round-trip.
        await c.auth(`/admin/users/${doel.id}`, { method: 'PUT', body: JSON.stringify({ email, email_confirm: true }) });
        details = `${doel.email} → ${email}`;
        break;
      }
      case 'naam': {
        const naam = String(body.naam ?? '').trim().slice(0, 60);
        await c.auth(`/admin/users/${doel.id}`, {
          method: 'PUT',
          body: JSON.stringify({ user_metadata: { ...(doel.user_metadata ?? {}), display_name: naam || null } }),
        });
        details = naam || '(leeg)';
        break;
      }
      case 'blokkeer':
      case 'deblokkeer': {
        if (zelf) throw new Fout(400, "You can't block yourself");
        await c.auth(`/admin/users/${doel.id}`, {
          method: 'PUT',
          body: JSON.stringify({ ban_duration: actie === 'blokkeer' ? BAN_ALTIJD : 'none' }),
        });
        break;
      }
      case 'verwijder': {
        if (zelf) throw new Fout(400, "You can't delete yourself");
        if (String(body.bevestig ?? '').trim().toLowerCase() !== String(doel.email ?? '').toLowerCase()) {
          throw new Fout(400, 'Type the e-mail address to confirm');
        }
        await c.auth(`/admin/users/${doel.id}`, { method: 'DELETE' });
        break;
      }
      case 'app': {
        const app = String(body.app ?? '');
        if (!APPS.includes(app)) throw new Fout(400, 'Unknown app');
        if (body.aan) {
          await c.db('korda_app_toegang', {
            method: 'POST',
            headers: { Prefer: 'resolution=ignore-duplicates,return=minimal' },
            body: JSON.stringify({ user_id: doel.id, app }),
          });
        } else {
          await c.db(`korda_app_toegang?user_id=eq.${doel.id}&app=eq.${app}`, { method: 'DELETE' });
        }
        details = `${app} ${body.aan ? 'aan' : 'uit'}`;
        break;
      }
      case 'admin': {
        if (zelf && !body.aan) throw new Fout(400, "You can't remove your own admin rights");
        if (body.aan) {
          await c.db('korda_admins', {
            method: 'POST',
            headers: { Prefer: 'resolution=ignore-duplicates,return=minimal' },
            body: JSON.stringify({ user_id: doel.id }),
          });
        } else {
          await c.db(`korda_admins?user_id=eq.${doel.id}`, { method: 'DELETE' });
        }
        details = body.aan ? 'aan' : 'uit';
        break;
      }
      case 'link': {
        // A one-time sign-in link and code, to pass on by hand (e.g. when mail doesn't arrive).
        const origin = new URL(request.url).origin;
        const r = await c.auth('/admin/generate_link', {
          method: 'POST',
          body: JSON.stringify({ type: 'magiclink', email: doel.email, redirect_to: `${origin}/budget/login` }),
        });
        antwoord = { ok: true, link: r?.action_link ?? r?.properties?.action_link ?? null, code: r?.email_otp ?? r?.properties?.email_otp ?? null };
        break;
      }
      case 'maak': {
        const email = String(body.email ?? '').trim().toLowerCase();
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Fout(400, 'That is not an e-mail address');
        const w = body.wachtwoord ? String(body.wachtwoord) : null;
        if (w && w.length < 8) throw new Fout(400, 'Password must be at least 8 characters');
        const nieuw = await c.auth('/admin/users', {
          method: 'POST',
          body: JSON.stringify({ email, email_confirm: true, ...(w ? { password: w } : {}) }),
        });
        const apps = (Array.isArray(body.apps) ? body.apps : []).filter((a) => APPS.includes(a));
        if (apps.length) {
          await c.db('korda_app_toegang', {
            method: 'POST',
            headers: { Prefer: 'resolution=ignore-duplicates,return=minimal' },
            body: JSON.stringify(apps.map((app) => ({ user_id: nieuw.id, app }))),
          });
        }
        await schrijfLog(c, data, { id: nieuw.id, email }, 'maak', apps.length ? `apps: ${apps.join(', ')}` : null);
        return json({ ok: true, id: nieuw.id });
      }
      default:
        throw new Fout(400, 'Unknown action');
    }

    await schrijfLog(c, data, doel, actie, details);
    return json(antwoord);
  } catch (e) {
    return json({ error: e.message }, e.status ?? 500);
  }
}

async function schrijfLog(c, data, doel, actie, details) {
  // Never let the log stop the change itself; it's already done.
  await c
    .db('korda_admin_log', {
      method: 'POST',
      headers: { Prefer: 'return=minimal' },
      body: JSON.stringify({ door: data.userId, door_email: data.userEmail, wie: doel?.id ?? null, wie_email: doel?.email ?? null, actie, details }),
    })
    .catch(() => {});
}
