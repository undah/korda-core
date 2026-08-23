import { useEffect, useState } from 'react';
import { Link, Outlet, useLocation } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Users, Layers, Send, History, Ban, AtSign, Settings, LogOut, Menu, X, BarChart3 } from 'lucide-react';
import { useAuth } from '@/auth/AuthProvider';

const NAV_ITEMS = [
  { path: '/outreach/leads',       label: 'Leads',       icon: Users,   match: ['/outreach/leads', '/outreach/businesses'] },
  { path: '/outreach/niches',      label: 'Niches',      icon: Layers,  match: ['/outreach/niches'] },
  { path: '/outreach/campaigns',   label: 'Campaigns',   icon: Send,    match: ['/outreach/campaigns', '/outreach/templates'] },
  { path: '/outreach/analytics',   label: 'Analytics',   icon: BarChart3, match: ['/outreach/analytics'] },
  { path: '/outreach/runs',        label: 'Runs',        icon: History, match: ['/outreach/runs'] },
  { path: '/outreach/senders',     label: 'Senders',     icon: AtSign,  match: ['/outreach/senders'] },
  { path: '/outreach/suppression', label: 'Suppression', icon: Ban,     match: ['/outreach/suppression'] },
  { path: '/outreach/settings',    label: 'Settings',    icon: Settings, match: ['/outreach/settings'] },
];

const OUTREACH_CSS = `
/* ── Korda Outreach — glass + gradient console ────────────────────────────── */

body.outreach-active {
  /* Scoped Shadcn tokens: translucent surfaces + amber accent, so the installed
     Table/Switch/Select/Dialog inherit this section's look automatically. */
  --background: 28 20% 5%;
  --foreground: 36 24% 92%;
  --card: 28 18% 9%;
  --card-foreground: 36 24% 92%;
  --popover: 28 20% 8%;
  --popover-foreground: 36 24% 92%;
  --primary: 28 92% 60%;
  --primary-foreground: 28 30% 8%;
  --secondary: 28 14% 14%;
  --secondary-foreground: 36 24% 92%;
  --muted: 28 12% 15%;
  --muted-foreground: 32 12% 62%;
  --accent: 28 22% 18%;
  --accent-foreground: 36 30% 94%;
  --destructive: 4 78% 60%;
  --destructive-foreground: 0 0% 100%;
  --border: 30 16% 20%;
  --input: 30 16% 20%;
  --ring: 28 92% 60%;
  --radius: 0.85rem;
  background-color: #0c0a09 !important;
  color: #f0e9e2 !important;
}

.o-app {
  --o-accent:     #f7a14a;
  --o-accent-2:   #ef6f5a;
  --o-text:       #f0e9e2;
  --o-dim:        rgba(240,233,226,0.62);
  --o-faint:      rgba(240,233,226,0.38);
  --o-glass:      rgba(255,255,255,0.045);
  --o-glass-2:    rgba(255,255,255,0.07);
  --o-hairline:   rgba(255,255,255,0.09);
  --o-sans: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;

  min-height: 100vh;
  background: #0c0a09;
  color: var(--o-text);
  font-family: var(--o-sans);
  position: relative;
  display: flex;
}
.o-app *, .o-app *::before, .o-app *::after { box-sizing: border-box; }

/* Ambient gradient blooms — the "premium" depth, kept slow and subtle. */
.o-aurora { position: fixed; inset: 0; z-index: 0; pointer-events: none; overflow: hidden; }
.o-blob { position: absolute; border-radius: 50%; filter: blur(90px); opacity: 0.5; }
.o-blob-1 { width: 620px; height: 620px; top: -220px; left: -140px; background: radial-gradient(circle, rgba(247,161,74,0.30), transparent 70%); animation: o-drift-1 26s ease-in-out infinite; }
.o-blob-2 { width: 520px; height: 520px; top: 30%; right: -180px; background: radial-gradient(circle, rgba(239,111,90,0.22), transparent 70%); animation: o-drift-2 32s ease-in-out infinite; }
.o-blob-3 { width: 460px; height: 460px; bottom: -200px; left: 35%; background: radial-gradient(circle, rgba(180,120,255,0.13), transparent 70%); animation: o-drift-1 38s ease-in-out infinite reverse; }
@keyframes o-drift-1 { 0%,100% { transform: translate(0,0) scale(1); } 50% { transform: translate(60px,50px) scale(1.1); } }
@keyframes o-drift-2 { 0%,100% { transform: translate(0,0) scale(1); } 50% { transform: translate(-70px,40px) scale(1.08); } }
@media (prefers-reduced-motion: reduce) { .o-blob { animation: none !important; } }

/* ── Glass sidebar ────────────────────────────────────────────────────────── */
.o-side {
  position: fixed; top: 0; left: 0; bottom: 0; z-index: 60;
  width: 244px; padding: 1.5rem 0.85rem;
  display: flex; flex-direction: column;
  background: rgba(20,16,14,0.62);
  backdrop-filter: blur(22px) saturate(140%);
  -webkit-backdrop-filter: blur(22px) saturate(140%);
  border-right: 1px solid var(--o-hairline);
  transition: transform 0.32s cubic-bezier(0.16,1,0.3,1);
}

.o-logo { display: flex; align-items: center; gap: 0.65rem; padding: 0 0.65rem 1.35rem; text-decoration: none; }
.o-logo-mark {
  width: 30px; height: 30px; border-radius: 9px; flex-shrink: 0;
  background: linear-gradient(135deg, var(--o-accent), var(--o-accent-2));
  box-shadow: 0 6px 18px rgba(247,161,74,0.35);
  display: flex; align-items: center; justify-content: center;
  color: #241405; font-weight: 700; font-size: 0.82rem;
}
.o-logo-text { font-size: 0.95rem; font-weight: 600; letter-spacing: -0.02em; color: var(--o-text); line-height: 1.15; }
.o-logo-sub { font-size: 0.64rem; color: var(--o-faint); letter-spacing: 0.04em; }

.o-nav { display: flex; flex-direction: column; gap: 2px; flex: 1; }
.o-nav-item {
  position: relative;
  display: flex; align-items: center; gap: 0.7rem;
  padding: 0.6rem 0.75rem; border-radius: 0.7rem;
  font-size: 0.855rem; font-weight: 450; color: var(--o-dim);
  text-decoration: none; transition: color 0.16s, background 0.16s;
}
.o-nav-item:hover { color: var(--o-text); background: var(--o-glass); }
.o-nav-item.active { color: #fff; background: linear-gradient(100deg, rgba(247,161,74,0.20), rgba(239,111,90,0.10)); box-shadow: inset 0 0 0 1px rgba(247,161,74,0.25); }
.o-nav-item.active svg { color: var(--o-accent); }

.o-side-foot { padding: 0.85rem 0.35rem 0; border-top: 1px solid var(--o-hairline); display: flex; flex-direction: column; gap: 0.5rem; }
.o-side-link {
  display: flex; align-items: center; gap: 0.55rem;
  font-size: 0.78rem; color: var(--o-faint); text-decoration: none;
  background: none; border: none; cursor: pointer; padding: 0.3rem 0.4rem; border-radius: 0.5rem;
  transition: color 0.15s, background 0.15s; text-align: left; font-family: inherit;
}
.o-side-link:hover { color: var(--o-text); background: var(--o-glass); }

/* ── Topbar (mobile) ──────────────────────────────────────────────────────── */
.o-topbar {
  display: none; position: fixed; top: 0; left: 0; right: 0; z-index: 65; height: 58px;
  align-items: center; justify-content: space-between; padding: 0 1rem;
  background: rgba(20,16,14,0.75);
  backdrop-filter: blur(20px); -webkit-backdrop-filter: blur(20px);
  border-bottom: 1px solid var(--o-hairline);
}
.o-icon-btn { background: var(--o-glass); border: 1px solid var(--o-hairline); color: var(--o-text); cursor: pointer; width: 36px; height: 36px; border-radius: 0.6rem; display: flex; align-items: center; justify-content: center; }
.o-scrim { display: none; position: fixed; inset: 0; z-index: 55; background: rgba(0,0,0,0.55); backdrop-filter: blur(3px); }

/* ── Main ─────────────────────────────────────────────────────────────────── */
.o-main { position: relative; z-index: 1; margin-left: 244px; flex: 1; padding: 2.25rem 2.25rem 5rem; max-width: 1500px; }

/* ── Glass surfaces ───────────────────────────────────────────────────────── */
.o-panel, .o-card {
  background: linear-gradient(155deg, rgba(255,255,255,0.055), rgba(255,255,255,0.02));
  backdrop-filter: blur(16px) saturate(130%);
  -webkit-backdrop-filter: blur(16px) saturate(130%);
  border: 1px solid var(--o-hairline);
  border-radius: 1rem;
  box-shadow: 0 10px 34px rgba(0,0,0,0.34), inset 0 1px 0 rgba(255,255,255,0.05);
  overflow: hidden;
}

/* Table inside glass: airy rows, no heavy chrome. */
.o-app table { width: 100%; border-collapse: collapse; }
.o-app thead th {
  font-size: 0.68rem !important; font-weight: 600; letter-spacing: 0.06em;
  text-transform: uppercase; color: var(--o-faint) !important;
  padding: 0.85rem 1.1rem; height: auto;
  border-bottom: 1px solid var(--o-hairline);
  background: rgba(255,255,255,0.022);
}
.o-app tbody td { padding: 0.9rem 1.1rem; vertical-align: top; border-bottom: 1px solid rgba(255,255,255,0.05); font-size: 0.875rem; }
.o-app tbody tr { transition: background 0.16s; }
.o-app tbody tr:hover { background: rgba(255,255,255,0.035); }
.o-app tbody tr:last-child td { border-bottom: 0; }

.o-num { font-variant-numeric: tabular-nums; }
.o-mono, .outreach-mono { font-variant-numeric: tabular-nums; font-feature-settings: 'tnum'; }

/* ── Page header ──────────────────────────────────────────────────────────── */
.outreach-page-title { font-size: 1.6rem; font-weight: 650; letter-spacing: -0.025em; color: var(--o-text); line-height: 1.15; }
.outreach-page-sub { font-size: 0.875rem; color: var(--o-dim); margin-top: 0.4rem; line-height: 1.6; max-width: 640px; }
.o-eyebrow {
  display: inline-flex; align-items: center; gap: 0.4rem;
  font-size: 0.66rem; font-weight: 600; letter-spacing: 0.13em; text-transform: uppercase;
  color: var(--o-accent); margin-bottom: 0.6rem;
}
.o-eyebrow::before { content: ''; width: 14px; height: 1px; background: linear-gradient(to right, var(--o-accent), transparent); }

/* ── Pills / meters ───────────────────────────────────────────────────────── */
.o-pill {
  display: inline-flex; align-items: center; gap: 0.32rem;
  padding: 0.16rem 0.55rem; border-radius: 999px;
  font-size: 0.7rem; font-weight: 500; letter-spacing: 0.005em;
  border: 1px solid transparent; white-space: nowrap;
}
.o-pill-dot { width: 5px; height: 5px; border-radius: 50%; flex-shrink: 0; }
.o-pill-verified   { background: rgba(52,211,153,0.13); color: #6ee7b7; border-color: rgba(52,211,153,0.26); }
.o-pill-guessed    { background: rgba(247,161,74,0.14); color: #fbbf6e; border-color: rgba(247,161,74,0.28); }
.o-pill-bounced    { background: rgba(248,113,113,0.13); color: #fca5a5; border-color: rgba(248,113,113,0.26); }
.o-pill-unverified { background: rgba(255,255,255,0.05); color: var(--o-faint); border-color: var(--o-hairline); }
.o-pill-neutral    { background: rgba(255,255,255,0.05); color: var(--o-dim); border-color: var(--o-hairline); }

.o-meter { display: flex; align-items: center; gap: 0.55rem; }
.o-meter-track { width: 68px; height: 5px; border-radius: 999px; background: rgba(255,255,255,0.08); overflow: hidden; flex-shrink: 0; }
.o-meter-fill { height: 100%; border-radius: 999px; transition: width 0.5s cubic-bezier(0.16,1,0.3,1); }
.o-meter-num { font-size: 0.75rem; color: var(--o-dim); font-variant-numeric: tabular-nums; }

/* ── States ───────────────────────────────────────────────────────────────── */
.o-state { text-align: center; padding: 3.25rem 1.5rem; }
.o-state-icon {
  width: 42px; height: 42px; border-radius: 12px; margin: 0 auto 1rem;
  display: flex; align-items: center; justify-content: center;
  background: linear-gradient(135deg, rgba(247,161,74,0.16), rgba(239,111,90,0.09));
  border: 1px solid rgba(247,161,74,0.22); color: var(--o-accent);
}
.o-state-title { font-size: 0.95rem; font-weight: 550; color: var(--o-text); }
.o-state-hint { font-size: 0.82rem; color: var(--o-dim); margin-top: 0.35rem; }

@media (max-width: 900px) {
  .o-topbar { display: flex; }
  .o-scrim { display: block; }
  .o-side { transform: translateX(-100%); width: 270px; }
  .o-side.open { transform: translateX(0); }
  .o-main { margin-left: 0; padding: calc(58px + 1.1rem) 1rem 4rem; }
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
