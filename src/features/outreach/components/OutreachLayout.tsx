import { useEffect, useState } from 'react';
import { Link, Outlet, useLocation } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Users, Layers, Send, History, Ban, AtSign, Settings, LogOut, Menu, X, BarChart3, Gauge, Mail } from 'lucide-react';
import { useAuth } from '@/auth/AuthProvider';

const NAV_ITEMS = [
  { path: '/outreach/leads',       label: 'Leads',       icon: Users,   match: ['/outreach/leads', '/outreach/businesses'] },
  { path: '/outreach/niches',      label: 'Niches',      icon: Layers,  match: ['/outreach/niches'] },
  { path: '/outreach/campaigns',   label: 'Campaigns',   icon: Send,    match: ['/outreach/campaigns', '/outreach/templates'] },
  { path: '/outreach/messages',    label: 'Messages',    icon: Mail,    match: ['/outreach/messages'] },
  { path: '/outreach/analytics',   label: 'Analytics',   icon: BarChart3, match: ['/outreach/analytics'] },
  { path: '/outreach/usage',       label: 'Usage',       icon: Gauge,   match: ['/outreach/usage'] },
  { path: '/outreach/runs',        label: 'Runs',        icon: History, match: ['/outreach/runs'] },
  { path: '/outreach/senders',     label: 'Senders',     icon: AtSign,  match: ['/outreach/senders'] },
  { path: '/outreach/suppression', label: 'Suppression', icon: Ban,     match: ['/outreach/suppression'] },
  { path: '/outreach/settings',    label: 'Settings',    icon: Settings, match: ['/outreach/settings'] },
];

const OUTREACH_CSS = `
/* ── Marvero Outreach — technical light console ───────────────────────────────
 *
 * Matches the Marvero marketing site: warm off-white plane, near-black ink,
 * one electric blue accent, uppercase monospace for every label, and hairline
 * borders instead of shadows. The previous theme was a dark amber "glass"
 * console — good-looking, but it shared no visual language with the site the
 * business actually sells through, which made the two read as different
 * companies.
 *
 * Two rules carry most of the look, and both are the opposite of the old one:
 *   • Structure is drawn with 1px lines and whitespace, never with elevation.
 *     No blur, no glow, no gradient fills on surfaces.
 *   • Monospace is the labelling voice — section eyebrows, table headers,
 *     status pills, meta. Sans is reserved for headings and prose.
 */

body.outreach-active {
  /* Scoped Shadcn tokens, so the installed Table/Switch/Select/Dialog inherit
     this section automatically rather than each being restyled by hand. */
  --background: 60 20% 98%;
  --foreground: 0 0% 5%;
  --card: 0 0% 100%;
  --card-foreground: 0 0% 5%;
  --popover: 0 0% 100%;
  --popover-foreground: 0 0% 5%;
  --primary: 231 88% 55%;
  --primary-foreground: 0 0% 100%;
  --secondary: 60 10% 95%;
  --secondary-foreground: 0 0% 5%;
  --muted: 60 10% 95%;
  --muted-foreground: 40 3% 42%;
  --accent: 231 88% 96%;
  --accent-foreground: 231 88% 40%;
  --destructive: 0 63% 53%;
  --destructive-foreground: 0 0% 100%;
  --border: 45 8% 89%;
  --input: 45 8% 89%;
  --ring: 231 88% 55%;
  /* Near-square. The site's boxes are effectively unrounded; anything softer
     immediately reads as a different product. */
  --radius: 0.25rem;
  background-color: #fafaf8 !important;
  color: #0d0d0d !important;
}

.o-app {
  --o-accent:     #2743f0;
  --o-accent-ink: #1b31c4;
  --o-accent-wash:#eef1fe;
  --o-ink:        #0d0d0d;
  --o-text:       #0d0d0d;
  --o-dim:        #56554f;
  --o-faint:      #86847d;
  --o-plane:      #fafaf8;
  --o-surface:    #ffffff;
  --o-hairline:   #e4e3dd;
  --o-hairline-2: #efeeea;
  --o-dark:       #0d0d0d;

  --o-good:       #008300;
  --o-warn:       #b57500;
  --o-bad:        #d03b3b;

  --o-sans: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
  --o-mono: ui-monospace, 'SFMono-Regular', 'JetBrains Mono', Menlo, Consolas, monospace;

  min-height: 100vh;
  background: var(--o-plane);
  color: var(--o-ink);
  font-family: var(--o-sans);
  position: relative;
  display: flex;
}
.o-app *, .o-app *::before, .o-app *::after { box-sizing: border-box; }

/* The old theme's ambient blobs are deliberately inert rather than deleted —
   the elements still render from the layout, and a light technical surface
   with drifting colour washes behind it would undo the whole point. */
.o-aurora, .o-blob { display: none !important; }

/* ── Sidebar ──────────────────────────────────────────────────────────────── */
.o-side {
  position: fixed; top: 0; left: 0; bottom: 0; z-index: 60;
  width: 236px; padding: 1.6rem 0.75rem 1.1rem;
  display: flex; flex-direction: column;
  background: var(--o-surface);
  border-right: 1px solid var(--o-hairline);
  transition: transform 0.28s cubic-bezier(0.16,1,0.3,1);
}

.o-logo { display: flex; align-items: center; gap: 0.6rem; padding: 0 0.5rem 1.5rem; text-decoration: none; }
.o-logo-mark {
  width: 26px; height: 26px; border-radius: 3px; flex-shrink: 0;
  background: var(--o-accent);
  display: flex; align-items: center; justify-content: center;
  color: #fff; font-weight: 700; font-size: 0.78rem;
}
.o-logo-text { font-size: 0.9rem; font-weight: 620; letter-spacing: -0.02em; color: var(--o-ink); line-height: 1.15; }
.o-logo-sub {
  font-family: var(--o-mono); font-size: 0.6rem; color: var(--o-faint);
  letter-spacing: 0.1em; text-transform: uppercase;
}

.o-nav { display: flex; flex-direction: column; gap: 1px; flex: 1; }
.o-nav-item {
  position: relative;
  display: flex; align-items: center; gap: 0.65rem;
  padding: 0.5rem 0.6rem; border-radius: 3px;
  font-size: 0.83rem; font-weight: 450; color: var(--o-dim);
  text-decoration: none; transition: color 0.14s, background 0.14s;
}
.o-nav-item svg { width: 15px; height: 15px; opacity: 0.75; }
.o-nav-item:hover { color: var(--o-ink); background: #f4f3ef; }
/* Active is a filled block, not a glow — the site marks state with solid
   colour and a left rule, never with light. */
.o-nav-item.active { color: var(--o-accent-ink); background: var(--o-accent-wash); font-weight: 550; }
.o-nav-item.active svg { color: var(--o-accent); opacity: 1; }
.o-nav-item.active::before {
  content: ''; position: absolute; left: 0; top: 6px; bottom: 6px;
  width: 2px; background: var(--o-accent);
}

.o-side-foot { padding: 0.8rem 0.25rem 0; border-top: 1px solid var(--o-hairline); display: flex; flex-direction: column; gap: 0.35rem; }
.o-side-link {
  display: flex; align-items: center; gap: 0.5rem;
  font-family: var(--o-mono); font-size: 0.68rem; letter-spacing: 0.04em;
  color: var(--o-faint); text-decoration: none;
  background: none; border: none; cursor: pointer; padding: 0.3rem 0.35rem; border-radius: 3px;
  transition: color 0.14s, background 0.14s; text-align: left;
}
.o-side-link:hover { color: var(--o-ink); background: #f4f3ef; }

/* ── Topbar (mobile) ──────────────────────────────────────────────────────── */
.o-topbar {
  display: none; position: fixed; top: 0; left: 0; right: 0; z-index: 65; height: 54px;
  align-items: center; justify-content: space-between; padding: 0 1rem;
  background: var(--o-surface);
  border-bottom: 1px solid var(--o-hairline);
}
.o-icon-btn {
  background: var(--o-surface); border: 1px solid var(--o-hairline); color: var(--o-ink);
  cursor: pointer; width: 34px; height: 34px; border-radius: 3px;
  display: flex; align-items: center; justify-content: center;
}
.o-scrim { display: none; position: fixed; inset: 0; z-index: 55; background: rgba(13,13,13,0.32); }

/* ── Main ─────────────────────────────────────────────────────────────────── */
.o-main { position: relative; z-index: 1; margin-left: 236px; flex: 1; padding: 2.5rem 2.5rem 5rem; max-width: 1500px; }

/* ── Surfaces ─────────────────────────────────────────────────────────────── */
.o-panel, .o-card {
  background: var(--o-surface);
  border: 1px solid var(--o-hairline);
  border-radius: 4px;
  box-shadow: none;
  overflow: hidden;
}

/* ── Tables ───────────────────────────────────────────────────────────────── */
.o-app table { width: 100%; border-collapse: collapse; }
.o-app thead th {
  font-family: var(--o-mono);
  font-size: 0.63rem !important; font-weight: 500; letter-spacing: 0.11em;
  text-transform: uppercase; color: var(--o-faint) !important;
  padding: 0.7rem 1rem; height: auto;
  border-bottom: 1px solid var(--o-hairline);
  background: transparent;
}
.o-app tbody td { padding: 0.8rem 1rem; vertical-align: top; border-bottom: 1px solid var(--o-hairline-2); font-size: 0.85rem; }
.o-app tbody tr { transition: background 0.14s; }
.o-app tbody tr:hover { background: #f8f7f4; }
.o-app tbody tr:last-child td { border-bottom: 0; }

.o-num { font-family: var(--o-mono); font-variant-numeric: tabular-nums; font-size: 0.8rem; }
.o-mono, .outreach-mono {
  font-family: var(--o-mono); font-variant-numeric: tabular-nums; font-feature-settings: 'tnum';
}

/* ── Page header ──────────────────────────────────────────────────────────── */
.outreach-page-title { font-size: 1.75rem; font-weight: 680; letter-spacing: -0.035em; color: var(--o-ink); line-height: 1.1; }
.outreach-page-sub { font-size: 0.875rem; color: var(--o-dim); margin-top: 0.5rem; line-height: 1.6; max-width: 640px; }
/* The site numbers its sections "01 — SALESSYSTEMEN". Same voice here, minus
   the numeral: a console's sections aren't read in order. */
.o-eyebrow {
  display: inline-flex; align-items: center; gap: 0.5rem;
  font-family: var(--o-mono);
  font-size: 0.63rem; font-weight: 500; letter-spacing: 0.14em; text-transform: uppercase;
  color: var(--o-accent); margin-bottom: 0.7rem;
}
.o-eyebrow::before { content: '—'; color: var(--o-accent); }

/* ── Pills ────────────────────────────────────────────────────────────────── */
/* Square, mono, hairline — the site's "LEAD → KWALIFICATIE" chips, not badges. */
.o-pill {
  display: inline-flex; align-items: center; gap: 0.35rem;
  padding: 0.2rem 0.45rem; border-radius: 2px;
  font-family: var(--o-mono);
  font-size: 0.63rem; font-weight: 500; letter-spacing: 0.07em; text-transform: uppercase;
  border: 1px solid var(--o-hairline); background: var(--o-surface); color: var(--o-dim);
  white-space: nowrap;
}
.o-pill-dot { width: 4px; height: 4px; border-radius: 50%; flex-shrink: 0; }
.o-pill-verified   { color: var(--o-good); border-color: rgba(0,131,0,0.35); background: rgba(0,131,0,0.05); }
.o-pill-guessed    { color: var(--o-warn); border-color: rgba(181,117,0,0.35); background: rgba(181,117,0,0.05); }
.o-pill-bounced    { color: var(--o-bad);  border-color: rgba(208,59,59,0.35); background: rgba(208,59,59,0.05); }
.o-pill-unverified { color: var(--o-faint); }
.o-pill-neutral    { color: var(--o-dim); }

/* ── Meters ───────────────────────────────────────────────────────────────── */
.o-meter { display: flex; align-items: center; gap: 0.5rem; }
.o-meter-track { width: 64px; height: 4px; border-radius: 2px; background: #eceae4; overflow: hidden; flex-shrink: 0; }
.o-meter-fill { height: 100%; border-radius: 2px; transition: width 0.45s cubic-bezier(0.16,1,0.3,1); }
.o-meter-num { font-family: var(--o-mono); font-size: 0.72rem; color: var(--o-dim); font-variant-numeric: tabular-nums; }

/* ── States ───────────────────────────────────────────────────────────────── */
.o-state { text-align: center; padding: 3.5rem 1.5rem; }
.o-state-icon {
  width: 38px; height: 38px; border-radius: 3px; margin: 0 auto 1rem;
  display: flex; align-items: center; justify-content: center;
  background: var(--o-accent-wash);
  border: 1px solid rgba(39,67,240,0.18); color: var(--o-accent);
}
.o-state-title { font-size: 0.95rem; font-weight: 580; color: var(--o-ink); }
.o-state-hint { font-size: 0.82rem; color: var(--o-dim); margin-top: 0.4rem; }

/* ── Buttons ──────────────────────────────────────────────────────────────── */
/* The site's primary is a solid blue rectangle with no radius to speak of. */
.o-app button { font-family: inherit; }
.o-app .o-btn-primary,
.o-app button[data-variant='default'] { border-radius: 3px; }

@media (max-width: 900px) {
  .o-topbar { display: flex; }
  .o-scrim { display: block; }
  .o-side { transform: translateX(-100%); width: 262px; }
  .o-side.open { transform: translateX(0); }
  .o-main { margin-left: 0; padding: calc(54px + 1.2rem) 1rem 4rem; }
}
`;

export default function OutreachLayout() {
  const { pathname } = useLocation();
  const { signOut } = useAuth();
  const [navOpen, setNavOpen] = useState(false);

  useEffect(() => { setNavOpen(false); }, [pathname]);

  useEffect(() => {
    document.body.style.overflow = navOpen ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [navOpen]);

  useEffect(() => {
    const style = document.createElement('style');
    style.id = 'outreach-global-styles';
    style.textContent = OUTREACH_CSS;
    document.head.appendChild(style);
    document.body.classList.add('outreach-active');
    return () => {
      document.body.classList.remove('outreach-active');
      document.getElementById('outreach-global-styles')?.remove();
    };
  }, []);

  const nav = (
    <>
      <Link to="/outreach" className="o-logo">
        <span className="o-logo-mark">K</span>
        <span>
          <span className="o-logo-text">Outreach</span>
          <span className="o-logo-sub" style={{ display: 'block' }}>Lead engine</span>
        </span>
      </Link>

      <nav className="o-nav">
        {NAV_ITEMS.map(item => {
          const active = item.match.some(m => pathname.startsWith(m));
          return (
            <Link key={item.path} to={item.path} className={`o-nav-item${active ? ' active' : ''}`}>
              <item.icon size={16} />
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div className="o-side-foot">
        <Link to="/" className="o-side-link">← Back to Korda</Link>
        <button className="o-side-link" onClick={() => { void signOut(); }}>
          <LogOut size={13} /> Sign out
        </button>
      </div>
    </>
  );

  return (
    <div className="o-app">
      <div className="o-aurora">
        <span className="o-blob o-blob-1" />
        <span className="o-blob o-blob-2" />
        <span className="o-blob o-blob-3" />
      </div>

      <div className="o-topbar">
        <Link to="/outreach" className="o-logo" style={{ padding: 0 }}>
          <span className="o-logo-mark">K</span>
          <span className="o-logo-text">Outreach</span>
        </Link>
        <button className="o-icon-btn" onClick={() => setNavOpen(v => !v)} aria-label="Toggle menu">
          {navOpen ? <X size={17} /> : <Menu size={17} />}
        </button>
      </div>

      {navOpen && <div className="o-scrim" onClick={() => setNavOpen(false)} />}

      <aside className={`o-side${navOpen ? ' open' : ''}`}>{nav}</aside>

      <main className="o-main">
        <motion.div
          key={pathname}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
        >
          <Outlet />
        </motion.div>
      </main>
    </div>
  );
}
