import React, { useEffect, useState } from 'react';
import { Link, Outlet, useLocation } from 'react-router-dom';
import { Users, Layers, History, Ban, LogOut } from 'lucide-react';
import { useAuth } from '@/auth/AuthProvider';

const NAV_ITEMS = [
  { path: '/outreach/leads',       label: 'Leads',       icon: Users },
  { path: '/outreach/niches',      label: 'Niches',      icon: Layers },
  { path: '/outreach/runs',        label: 'Runs',        icon: History },
  { path: '/outreach/suppression', label: 'Suppression', icon: Ban },
];

// Scoped theme, same approach as the other product sections: redefine the
// Shadcn CSS vars under a body class so the installed components inherit this
// section's palette instead of being restyled per-component.
const OUTREACH_CSS = `
body.outreach-active {
  --background: 240 20% 5%;
  --foreground: 210 40% 90%;
  --card: 240 15% 7%;
  --card-foreground: 210 40% 90%;
  --popover: 240 15% 8%;
  --popover-foreground: 210 40% 90%;
  --primary: 30 78% 59%;
  --primary-foreground: 240 20% 5%;
  --secondary: 240 15% 10%;
  --secondary-foreground: 210 40% 90%;
  --muted: 240 15% 10%;
  --muted-foreground: 215 20% 55%;
  --accent: 240 15% 12%;
  --accent-foreground: 210 40% 90%;
  --destructive: 0 84% 60%;
  --destructive-foreground: 0 0% 100%;
  --border: 240 15% 15%;
  --input: 240 15% 15%;
  --ring: 30 78% 59%;
  --radius: 0.5rem;
  background-color: #0A0A0F !important;
  color: #dde8ed !important;
}

.outreach-app {
  min-height: 100vh;
  display: flex;
  background-color: #0A0A0F;
  color: #dde8ed;
  font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
}

.outreach-sidebar {
  width: 240px;
  min-height: 100vh;
  background: #0A0A0F;
  border-right: 1px solid rgba(255,255,255,0.06);
  display: flex;
  flex-direction: column;
  padding: 1.5rem 0;
  position: fixed;
  top: 0; left: 0;
  z-index: 50;
  transition: transform 0.3s cubic-bezier(0.16,1,0.3,1);
}

.outreach-logo {
  padding: 0 1.5rem 1.5rem;
  border-bottom: 1px solid rgba(255,255,255,0.06);
  margin-bottom: 0.75rem;
  font-size: 1.1rem;
  font-weight: 700;
  color: #f0f6fc;
  letter-spacing: -0.02em;
  display: flex;
  align-items: center;
  gap: 0.6rem;
}
.outreach-logo span { color: #E89644; }

.outreach-nav-item {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.6rem 1.5rem;
  font-size: 0.875rem;
  color: rgba(240,246,252,0.45);
  text-decoration: none;
  border-left: 3px solid transparent;
  transition: all 0.15s;
  margin: 1px 0;
}
.outreach-nav-item:hover { color: rgba(240,246,252,0.85); background: rgba(255,255,255,0.03); }
.outreach-nav-item.active { color: #E89644; border-left-color: #E89644; background: rgba(232,150,68,0.07); font-weight: 500; }

.outreach-sidebar-bottom {
  margin-top: auto;
  padding: 1.25rem 1.5rem;
  border-top: 1px solid rgba(255,255,255,0.06);
}

.outreach-main {
  margin-left: 240px;
  flex: 1;
  padding: 2rem 2.5rem;
  min-height: 100vh;
  max-width: 1400px;
}

.outreach-topbar {
  display: none;
  position: fixed;
  top: 0; left: 0; right: 0;
  z-index: 60;
  height: 56px;
  background: #0A0A0F;
  border-bottom: 1px solid rgba(255,255,255,0.06);
  align-items: center;
  justify-content: space-between;
  padding: 0 1.25rem;
}

.outreach-hamburger {
  background: none; border: none; cursor: pointer;
  display: flex; flex-direction: column; gap: 5px; padding: 4px;
}
.outreach-hamburger span { display: block; width: 22px; height: 2px; background: rgba(240,246,252,0.6); transition: all 0.2s; border-radius: 1px; }
.outreach-hamburger.open span:nth-child(1) { transform: translateY(7px) rotate(45deg); }
.outreach-hamburger.open span:nth-child(2) { opacity: 0; }
.outreach-hamburger.open span:nth-child(3) { transform: translateY(-7px) rotate(-45deg); }

.outreach-overlay {
  display: none;
  position: fixed; inset: 0; z-index: 55;
  background: rgba(0,0,0,0.6);
  backdrop-filter: blur(4px);
  opacity: 0; transition: opacity 0.3s; pointer-events: none;
}
.outreach-overlay.open { opacity: 1; pointer-events: all; }

/* Identifiers read as data, not prose. */
.outreach-mono {
  font-family: 'JetBrains Mono', ui-monospace, SFMono-Regular, Menlo, monospace;
  font-variant-numeric: tabular-nums;
}

.outreach-page-title {
  font-size: 1.35rem;
  font-weight: 700;
  color: #f0f6fc;
  letter-spacing: -0.02em;
}
.outreach-page-sub {
  font-size: 0.82rem;
  color: rgba(240,246,252,0.4);
  margin-top: 0.25rem;
}

@media (max-width: 768px) {
  .outreach-topbar { display: flex; }
  .outreach-overlay { display: block; }
  .outreach-sidebar { transform: translateX(-100%); width: 280px; z-index: 65; }
  .outreach-sidebar.open { transform: translateX(0); }
  .outreach-main { margin-left: 0; padding: 1.25rem; padding-top: calc(56px + 1.25rem); }
}
`;

export default function OutreachLayout() {
  const { pathname } = useLocation();
  const { signOut } = useAuth();
  const [drawerOpen, setDrawerOpen] = useState(false);

  useEffect(() => { setDrawerOpen(false); }, [pathname]);

  useEffect(() => {
    document.body.style.overflow = drawerOpen ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [drawerOpen]);

  useEffect(() => {
    const style = document.createElement('style');
    style.id = 'outreach-global-styles';
    style.textContent = OUTREACH_CSS;
    document.head.appendChild(style);
    document.body.classList.add('outreach-active');
    return () => {
      document.body.classList.remove('outreach-active');
      const el = document.getElementById('outreach-global-styles');
      if (el) document.head.removeChild(el);
    };
  }, []);

  return (
    <div className="outreach-app">
      <div className="outreach-topbar">
        <span style={{ fontWeight: 700, fontSize: '1rem', color: '#f0f6fc', letterSpacing: '-0.02em' }}>
          Korda<span style={{ color: '#E89644' }}>Outreach</span>
        </span>
        <button
          className={`outreach-hamburger${drawerOpen ? ' open' : ''}`}
          onClick={() => setDrawerOpen(v => !v)}
          aria-label="Toggle menu"
        >
          <span /><span /><span />
        </button>
      </div>

      <div className={`outreach-overlay${drawerOpen ? ' open' : ''}`} onClick={() => setDrawerOpen(false)} />

      <aside className={`outreach-sidebar${drawerOpen ? ' open' : ''}`}>
        <div className="outreach-logo">
          <img src="/korda-icon.svg" width="28" height="28" style={{ flexShrink: 0 }} alt="" />
          Korda<span>Outreach</span>
        </div>

        <nav style={{ flex: 1 }}>
          {NAV_ITEMS.map(item => (
            <Link
              key={item.path}
              to={item.path}
              className={`outreach-nav-item${pathname.startsWith(item.path) ? ' active' : ''}`}
            >
              <item.icon size={15} style={{ flexShrink: 0 }} />
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="outreach-sidebar-bottom">
          <Link
            to="/"
            style={{ display: 'block', fontSize: '0.75rem', color: 'rgba(240,246,252,0.3)', textDecoration: 'none', marginBottom: '0.5rem' }}
          >
            ← Back to Korda
          </Link>
          <button
            onClick={() => { void signOut(); }}
            style={{
              display: 'flex', alignItems: 'center', gap: '0.45rem',
              fontSize: '0.78rem', color: 'rgba(240,246,252,0.3)',
              background: 'none', border: 'none', cursor: 'pointer', padding: 0,
            }}
          >
            <LogOut size={13} />
            Sign out
          </button>
        </div>
      </aside>

      <main className="outreach-main">
        <Outlet />
      </main>
    </div>
  );
}
