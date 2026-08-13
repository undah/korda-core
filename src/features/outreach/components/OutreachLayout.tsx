import { useEffect, useState } from 'react';
import { Link, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '@/auth/AuthProvider';

// Tabs live in a top command bar, not a left rail — the first thing that sets
// this console apart from the other Korda sections.
const TABS = [
  { path: '/outreach/leads',       label: 'leads',       match: ['/outreach/leads', '/outreach/businesses'] },
  { path: '/outreach/niches',      label: 'niches',      match: ['/outreach/niches'] },
  { path: '/outreach/runs',        label: 'runs',        match: ['/outreach/runs'] },
  { path: '/outreach/suppression', label: 'suppression', match: ['/outreach/suppression'] },
];

const OUTREACH_CSS = `
/* ── Korda Outreach — amber-phosphor operator console ─────────────────────── */

body.outreach-active {
  /* Shadcn tokens, retuned warm/amber so the installed components inherit this
     console's identity instead of the cool-blue Suite defaults. */
  --background: 36 30% 4%;
  --foreground: 40 30% 85%;
  --card: 34 26% 6%;
  --card-foreground: 40 30% 85%;
  --popover: 34 30% 5%;
  --popover-foreground: 40 30% 85%;
  --primary: 30 80% 59%;
  --primary-foreground: 36 40% 6%;
  --secondary: 34 20% 10%;
  --secondary-foreground: 40 30% 85%;
  --muted: 34 18% 10%;
  --muted-foreground: 38 18% 52%;
  --accent: 30 40% 14%;
  --accent-foreground: 40 40% 88%;
  --destructive: 8 74% 58%;
  --destructive-foreground: 0 0% 100%;
  --border: 32 40% 16%;
  --input: 32 30% 14%;
  --ring: 30 80% 59%;
  --radius: 2px;
  background-color: #0b0a07 !important;
  color: #e8ddc9 !important;
}

.o-app {
  --o-bg:        #0b0a07;
  --o-bg-2:      #100d09;
  --o-bg-3:      #16110b;
  --o-line:      rgba(232,150,68,0.16);
  --o-line-soft: rgba(232,150,68,0.08);
  --o-amber:     #e89644;
  --o-amber-hi:  #f5ad57;
  --o-amber-dim: rgba(232,150,68,0.45);
  --o-text:      #e8ddc9;
  --o-dim:       rgba(232,221,201,0.5);
  --o-faint:     rgba(232,221,201,0.28);
  --o-green:     #63cf8e;
  --o-red:       #e8705a;

  --o-mono: 'IBM Plex Mono', ui-monospace, SFMono-Regular, Menlo, monospace;
  --o-sans: 'IBM Plex Sans', -apple-system, BlinkMacSystemFont, sans-serif;

  min-height: 100vh;
  background: var(--o-bg);
  color: var(--o-text);
  font-family: var(--o-sans);
  position: relative;
}
.o-app *, .o-app *::before, .o-app *::after { box-sizing: border-box; }

/* Background layers: warm grid, faint scanlines, top vignette. All barely there. */
.o-bg-layer { position: fixed; inset: 0; z-index: 0; pointer-events: none; }
.o-bg-grid {
  background-image:
    linear-gradient(var(--o-line-soft) 1px, transparent 1px),
    linear-gradient(90deg, var(--o-line-soft) 1px, transparent 1px);
  background-size: 52px 52px;
  opacity: 0.5;
  -webkit-mask-image: radial-gradient(ellipse 90% 70% at 50% 0%, #000 40%, transparent 100%);
  mask-image: radial-gradient(ellipse 90% 70% at 50% 0%, #000 40%, transparent 100%);
}
.o-bg-scan {
  background: repeating-linear-gradient(to bottom, rgba(232,150,68,0.025) 0, rgba(232,150,68,0.025) 1px, transparent 1px, transparent 3px);
  opacity: 0.5;
}
.o-bg-glow { background: radial-gradient(ellipse 60% 40% at 50% -5%, rgba(232,150,68,0.08), transparent 70%); }

/* ── Top command bar ──────────────────────────────────────────────────────── */
.o-bar {
  position: fixed; top: 0; left: 0; right: 0; z-index: 60;
  height: 52px;
  display: flex; align-items: center; gap: 2rem;
  padding: 0 1.5rem;
  background: rgba(11,10,7,0.86);
  backdrop-filter: blur(14px);
  border-bottom: 1px solid var(--o-line);
}
.o-brand {
  font-family: var(--o-mono); font-size: 0.82rem; font-weight: 600;
  letter-spacing: 0.06em; color: var(--o-text); white-space: nowrap;
  display: flex; align-items: center; gap: 0.5rem; text-decoration: none;
}
.o-brand-glyph { color: var(--o-amber); font-size: 0.9rem; }
.o-brand-sep { color: var(--o-amber); opacity: 0.6; }
.o-brand-dim { color: var(--o-faint); }

.o-tabs { display: flex; align-items: stretch; gap: 0.25rem; height: 100%; overflow-x: auto; scrollbar-width: none; }
.o-tabs::-webkit-scrollbar { display: none; }
.o-tab {
  position: relative;
  display: flex; align-items: center;
  padding: 0 0.9rem;
  font-family: var(--o-mono); font-size: 0.72rem; letter-spacing: 0.08em;
  color: var(--o-faint); text-decoration: none; white-space: nowrap;
  transition: color 0.15s; border: none; background: none;
}
.o-tab::before { content: '['; margin-right: 0.35rem; opacity: 0; transition: opacity 0.15s; color: var(--o-amber); }
.o-tab::after  { content: ']'; margin-left: 0.35rem;  opacity: 0; transition: opacity 0.15s; color: var(--o-amber); }
.o-tab:hover { color: var(--o-dim); }
.o-tab.active { color: var(--o-amber-hi); }
.o-tab.active::before, .o-tab.active::after { opacity: 1; }
.o-tab.active .o-tab-underline {
  position: absolute; left: 0.5rem; right: 0.5rem; bottom: 0; height: 2px;
  background: var(--o-amber); box-shadow: 0 0 8px rgba(232,150,68,0.7);
}

.o-sys { margin-left: auto; display: flex; align-items: center; gap: 0.9rem; font-family: var(--o-mono); font-size: 0.66rem; color: var(--o-faint); white-space: nowrap; }
.o-sys-dot { width: 6px; height: 6px; border-radius: 50%; background: var(--o-green); box-shadow: 0 0 6px var(--o-green); animation: o-pulse 2.4s ease-in-out infinite; }
@keyframes o-pulse { 0%,100% { opacity: 1; } 50% { opacity: 0.35; } }
.o-sys-exit { font-family: var(--o-mono); font-size: 0.66rem; letter-spacing: 0.06em; color: var(--o-faint); background: none; border: none; cursor: pointer; transition: color 0.15s; padding: 0; }
.o-sys-exit:hover { color: var(--o-red); }

/* ── Main / HUD viewport ──────────────────────────────────────────────────── */
.o-main { position: relative; z-index: 1; padding: calc(52px + 1.75rem) 1.75rem 4rem; max-width: 1400px; margin: 0 auto; }
.o-viewport { position: relative; border: 1px solid var(--o-line); background: rgba(16,13,9,0.35); padding: 1.75rem; min-height: calc(100vh - 52px - 5.75rem); }
.o-corner { position: absolute; width: 11px; height: 11px; border: 1px solid var(--o-amber); pointer-events: none; }
.o-corner-tl { top: -1px; left: -1px;  border-right: 0; border-bottom: 0; }
.o-corner-tr { top: -1px; right: -1px; border-left: 0;  border-bottom: 0; }
.o-corner-bl { bottom: -1px; left: -1px;  border-right: 0; border-top: 0; }
.o-corner-br { bottom: -1px; right: -1px; border-left: 0;  border-top: 0; }

/* ── Prompt-style page header (redefines the old classes so pages need no JSX change) ── */
.outreach-page-title {
  font-family: var(--o-sans); font-size: 1.4rem; font-weight: 600;
  color: var(--o-text); letter-spacing: -0.01em; line-height: 1.1;
}
.outreach-page-sub { font-family: var(--o-mono); font-size: 0.72rem; color: var(--o-dim); margin-top: 0.4rem; line-height: 1.6; max-width: 620px; }
.o-prompt { font-family: var(--o-mono); font-size: 0.66rem; letter-spacing: 0.05em; color: var(--o-amber-dim); margin-bottom: 0.55rem; }
.o-prompt b { color: var(--o-amber); font-weight: 500; }
.o-prompt .o-caret { color: var(--o-amber); animation: o-blink 1.1s steps(1) infinite; }
@keyframes o-blink { 0%,50% { opacity: 1; } 51%,100% { opacity: 0; } }

.o-mono, .outreach-mono { font-family: var(--o-mono); font-variant-numeric: tabular-nums; }

/* ── Panels + table re-skin (sharp corners, mono headers, cursor-hover rows) ── */
.o-panel { border: 1px solid var(--o-line); background: rgba(16,13,9,0.4); }
.o-app table { width: 100%; border-collapse: collapse; }
.o-app thead th {
  font-family: var(--o-mono) !important; text-transform: uppercase;
  letter-spacing: 0.1em; font-size: 0.6rem !important; font-weight: 500;
  color: var(--o-faint) !important; height: auto; padding: 0.7rem 1rem;
  border-bottom: 1px solid var(--o-line);
}
.o-app tbody td { padding: 0.75rem 1rem; vertical-align: top; border-bottom: 1px solid var(--o-line-soft); }
.o-app tbody tr { transition: background 0.12s, box-shadow 0.12s; }
.o-app tbody tr:hover { background: var(--o-bg-3); box-shadow: inset 2px 0 0 var(--o-amber); }
.o-app tbody tr:last-child td { border-bottom: 0; }

/* ── Bracketed status + source tags ───────────────────────────────────────── */
.o-tag { font-family: var(--o-mono); font-size: 0.62rem; letter-spacing: 0.05em; white-space: nowrap; }
.o-tag-verified   { color: var(--o-green); }
.o-tag-guessed    { color: var(--o-amber); }
.o-tag-bounced    { color: var(--o-red); }
.o-tag-unverified { color: var(--o-faint); }
.o-src { font-family: var(--o-mono); font-size: 0.64rem; color: var(--o-dim); }
.o-src::before { content: '» '; color: var(--o-amber-dim); }

/* ── ASCII confidence meter ───────────────────────────────────────────────── */
.o-meter { font-family: var(--o-mono); font-size: 0.72rem; letter-spacing: -0.05em; display: inline-flex; align-items: baseline; gap: 0.5rem; }
.o-meter-empty { color: rgba(232,150,68,0.15); }
.o-meter-num { letter-spacing: 0; font-size: 0.68rem; color: var(--o-dim); }

/* ── Terminal empty / error readouts ──────────────────────────────────────── */
.o-readout { font-family: var(--o-mono); border: 1px solid var(--o-line); background: rgba(16,13,9,0.5); padding: 2.5rem 1.75rem; }
.o-readout-line { font-size: 0.8rem; color: var(--o-text); }
.o-readout-hint { font-size: 0.7rem; color: var(--o-dim); margin-top: 0.5rem; }
.o-readout-err  { font-size: 0.72rem; color: var(--o-red); }

/* ── Shadcn primitive nudges within the console ───────────────────────────── */
.o-app input, .o-app [role="combobox"], .o-app textarea { font-family: var(--o-mono); }
.o-app .outreach-page-title { font-family: var(--o-sans); }

@media (max-width: 820px) {
  .o-bar { gap: 1rem; padding: 0 1rem; }
  .o-brand-full { display: none; }
  .o-sys-label { display: none; }
  .o-main { padding: calc(52px + 1rem) 0.75rem 3rem; }
  .o-viewport { padding: 1rem; }
}
`;

export default function OutreachLayout() {
  const { pathname } = useLocation();
  const { signOut } = useAuth();
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), 1000);
    return () => window.clearInterval(id);
  }, []);

  useEffect(() => {
    const style = document.createElement('style');
    style.id = 'outreach-global-styles';
    style.textContent = OUTREACH_CSS;
    document.head.appendChild(style);
    document.body.classList.add('outreach-active');

    const font = document.createElement('link');
    font.id = 'outreach-fonts';
    font.rel = 'stylesheet';
    font.href = 'https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500;600&family=IBM+Plex+Sans:wght@300;400;500;600&display=swap';
    document.head.appendChild(font);

    return () => {
      document.body.classList.remove('outreach-active');
      document.getElementById('outreach-global-styles')?.remove();
      document.getElementById('outreach-fonts')?.remove();
    };
  }, []);

  const clock = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false });

  return (
    <div className="o-app">
      <div className="o-bg-layer o-bg-glow" />
      <div className="o-bg-layer o-bg-grid" />
      <div className="o-bg-layer o-bg-scan" />

      <header className="o-bar">
        <Link to="/outreach" className="o-brand">
          <span className="o-brand-glyph">◈</span>
          <span className="o-brand-full">KORDA<span className="o-brand-sep">·</span>OUTREACH</span>
        </Link>

        <nav className="o-tabs">
          {TABS.map(tab => {
            const active = tab.match.some(m => pathname.startsWith(m));
            return (
              <Link key={tab.path} to={tab.path} className={`o-tab${active ? ' active' : ''}`}>
                {tab.label}
                {active && <span className="o-tab-underline" />}
              </Link>
            );
          })}
        </nav>

        <div className="o-sys">
          <span className="o-sys-dot" />
          <span className="o-sys-label o-mono">{clock}</span>
          <button className="o-sys-exit" onClick={() => { void signOut(); }}>exit_</button>
        </div>
      </header>

      <main className="o-main">
        <div className="o-viewport">
          <span className="o-corner o-corner-tl" />
          <span className="o-corner o-corner-tr" />
          <span className="o-corner o-corner-bl" />
          <span className="o-corner o-corner-br" />
          <Outlet />
        </div>
      </main>
    </div>
  );
}
