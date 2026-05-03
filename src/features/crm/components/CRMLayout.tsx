import React, { useEffect, useState } from 'react';
import { Link, Navigate, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { LayoutDashboard, PhoneCall, Users, CalendarDays, LogOut, Shield, Loader2, BookOpen } from 'lucide-react';
import { useAuth } from '@/auth/AuthProvider';
import { useMyProfile, useUpsertProfile } from '../hooks/useCRMProfiles';
import { getRepColor, REP_COLOR } from '../constants';
import type { CRMOutletContext } from '../types';

const NAV_ITEMS = [
  { path: '/crm/dashboard', label: 'Dashboard',     icon: LayoutDashboard },
  { path: '/crm/log',       label: 'Log een Call',  icon: PhoneCall },
  { path: '/crm/leads',     label: 'Leads',         icon: Users },
  { path: '/crm/week',      label: 'Weekoverzicht', icon: CalendarDays },
  { path: '/crm/scripts',   label: 'Scripts',       icon: BookOpen },
];

const CRM_CSS = `
body.crm-active {
  --background: 42 25% 97%;
  --foreground: 224 15% 12%;
  --card: 0 0% 100%;
  --card-foreground: 224 15% 12%;
  --popover: 0 0% 100%;
  --popover-foreground: 224 15% 12%;
  --primary: 221 83% 53%;
  --primary-foreground: 0 0% 100%;
  --secondary: 30 10% 93%;
  --secondary-foreground: 224 15% 12%;
  --muted: 30 10% 93%;
  --muted-foreground: 220 9% 46%;
  --accent: 30 10% 93%;
  --accent-foreground: 224 15% 12%;
  --destructive: 0 84% 60%;
  --destructive-foreground: 0 0% 100%;
  --border: 30 12% 88%;
  --input: 30 12% 88%;
  --ring: 221 83% 53%;
  --radius: 0.5rem;
  background-color: hsl(42, 25%, 97%) !important;
  color: hsl(224, 15%, 12%) !important;
}

.crm-app {
  min-height: 100vh;
  display: flex;
  background-color: hsl(42, 25%, 97%);
  color: hsl(224, 15%, 12%);
  font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
}

.crm-sidebar {
  width: 240px;
  min-height: 100vh;
  background: #ffffff;
  border-right: 1px solid #e8e4dc;
  display: flex;
  flex-direction: column;
  padding: 1.5rem 0;
  position: fixed;
  top: 0; left: 0;
  z-index: 50;
  transition: transform 0.3s cubic-bezier(0.16,1,0.3,1);
}

.crm-logo {
  padding: 0 1.5rem 1.5rem;
  border-bottom: 1px solid #f0ece4;
  margin-bottom: 0.75rem;
  font-size: 1.1rem;
  font-weight: 700;
  color: #1c1a17;
  letter-spacing: -0.02em;
}
.crm-logo span { color: #3B82F6; }

.crm-nav-item {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.6rem 1.5rem;
  font-size: 0.875rem;
  color: #706d66;
  text-decoration: none;
  border-left: 3px solid transparent;
  transition: all 0.15s;
  margin: 1px 0;
}
.crm-nav-item:hover { color: #1c1a17; background: #f8f7f4; }
.crm-nav-item.active { color: #1c1a17; border-left-color: #3B82F6; background: #EFF6FF; font-weight: 500; }

.crm-sidebar-bottom {
  margin-top: auto;
  padding: 1.25rem 1.5rem;
  border-top: 1px solid #f0ece4;
}

.crm-main {
  margin-left: 240px;
  flex: 1;
  padding: 2rem 2.5rem;
  min-height: 100vh;
}

.crm-topbar {
  display: none;
  position: fixed;
  top: 0; left: 0; right: 0;
  z-index: 60;
  height: 56px;
  background: #ffffff;
  border-bottom: 1px solid #e8e4dc;
  align-items: center;
  justify-content: space-between;
  padding: 0 1.25rem;
}

.crm-hamburger {
  background: none; border: none; cursor: pointer;
  display: flex; flex-direction: column; gap: 5px; padding: 4px;
}
.crm-hamburger span { display: block; width: 22px; height: 2px; background: #706d66; transition: all 0.2s; border-radius: 1px; }
.crm-hamburger.open span:nth-child(1) { transform: translateY(7px) rotate(45deg); }
.crm-hamburger.open span:nth-child(2) { opacity: 0; }
.crm-hamburger.open span:nth-child(3) { transform: translateY(-7px) rotate(-45deg); }

.crm-overlay {
  display: none;
  position: fixed; inset: 0; z-index: 55;
  background: rgba(28,26,23,0.35);
  backdrop-filter: blur(2px);
  opacity: 0; transition: opacity 0.3s; pointer-events: none;
}
.crm-overlay.open { opacity: 1; pointer-events: all; }

@media (max-width: 768px) {
  .crm-topbar { display: flex; }
  .crm-overlay { display: block; }
  .crm-sidebar { transform: translateX(-100%); width: 280px; z-index: 65; }
  .crm-sidebar.open { transform: translateX(0); }
  .crm-main { margin-left: 0; padding: 1.25rem; padding-top: calc(56px + 1.25rem); }
}
`;

function ProfileSetup({ userId, onDone }: { userId: string; onDone: () => void }) {
  const [name, setName] = useState('');
  const upsert = useUpsertProfile();
  const knownNames = Object.keys(REP_COLOR);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    await upsert.mutateAsync({ id: userId, rep_name: name.trim() });
    onDone();
  };

  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(255,255,255,0.95)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      zIndex: 200, backdropFilter: 'blur(4px)',
    }}>
      <div style={{
        background: '#fff', border: '1px solid #e8e4dc', borderRadius: 12,
        padding: '2.5rem', maxWidth: 400, width: '100%', margin: '0 1rem',
        boxShadow: '0 20px 60px rgba(0,0,0,0.08)',
      }}>
        <div style={{ marginBottom: '0.5rem', fontSize: '1.25rem', fontWeight: 700, color: '#1c1a17' }}>
          Korda<span style={{ color: '#3B82F6' }}>CRM</span>
        </div>
        <p style={{ fontSize: '0.875rem', color: '#706d66', marginBottom: '1.5rem' }}>
          Kies je naam om te beginnen.
        </p>
        <form onSubmit={handleSubmit}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginBottom: '1rem' }}>
            {knownNames.map(n => (
              <button
                key={n}
                type="button"
                onClick={() => setName(n)}
                style={{
                  padding: '0.7rem 1rem',
                  border: `2px solid ${name === n ? getRepColor(n) : '#e8e4dc'}`,
                  borderRadius: 8,
                  background: name === n ? `${getRepColor(n)}10` : '#fff',
                  color: name === n ? getRepColor(n) : '#1c1a17',
                  cursor: 'pointer', textAlign: 'left',
                  fontWeight: name === n ? 600 : 400,
                  fontSize: '0.9rem',
                  display: 'flex', alignItems: 'center', gap: '0.6rem',
                  transition: 'all 0.15s',
                }}
              >
                <span style={{
                  width: 10, height: 10, borderRadius: '50%',
                  background: getRepColor(n), flexShrink: 0,
                }} />
                {n}
              </button>
            ))}
          </div>
          <button
            type="submit"
            disabled={!name || upsert.isPending}
            style={{
              width: '100%', padding: '0.75rem',
              background: name ? '#3B82F6' : '#E5E7EB',
              color: name ? '#fff' : '#9CA3AF',
              border: 'none', borderRadius: 8,
              fontWeight: 600, fontSize: '0.9rem',
              cursor: name ? 'pointer' : 'not-allowed',
              transition: 'all 0.15s',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem',
            }}
          >
            {upsert.isPending && <Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} />}
            Doorgaan
          </button>
        </form>
      </div>
    </div>
  );
}

export default function CRMLayout() {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const { user, signOut, loading: authLoading } = useAuth();
  const { data: profile, isLoading: profileLoading } = useMyProfile();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [adminMode, setAdminMode] = useState(false);
  const [setupDone, setSetupDone] = useState(false);

  useEffect(() => { setDrawerOpen(false); }, [pathname]);

  useEffect(() => {
    document.body.style.overflow = drawerOpen ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [drawerOpen]);

  useEffect(() => {
    const style = document.createElement('style');
    style.id = 'crm-global-styles';
    style.textContent = CRM_CSS;
    document.head.appendChild(style);
    document.body.classList.add('crm-active');
    return () => {
      document.body.classList.remove('crm-active');
      const el = document.getElementById('crm-global-styles');
      if (el) document.head.removeChild(el);
    };
  }, []);

  if (authLoading || profileLoading) {
    return (
      <div className="crm-app" style={{ alignItems: 'center', justifyContent: 'center' }}>
        <Loader2 size={24} style={{ color: '#3B82F6', animation: 'spin 1s linear infinite' }} />
      </div>
    );
  }

  if (!user) return <Navigate to="/login" replace state={{ from: pathname }} />;

  const showSetup = !profile && !setupDone;
  const repName = profile?.rep_name ?? '';
  const repColor = getRepColor(repName);

  const handleSignOut = async () => {
    await signOut();
    navigate('/login');
  };

  const outletCtx: CRMOutletContext = { adminMode, setAdminMode, profile };

  return (
    <div className="crm-app">
      {showSetup && (
        <ProfileSetup userId={user.id} onDone={() => setSetupDone(true)} />
      )}

      {/* Mobile topbar */}
      <div className="crm-topbar">
        <span style={{ fontWeight: 700, fontSize: '1rem', color: '#1c1a17', letterSpacing: '-0.02em' }}>
          Korda<span style={{ color: '#3B82F6' }}>CRM</span>
        </span>
        <button
          className={`crm-hamburger${drawerOpen ? ' open' : ''}`}
          onClick={() => setDrawerOpen(v => !v)}
          aria-label="Toggle menu"
        >
          <span /><span /><span />
        </button>
      </div>

      {/* Overlay */}
      <div className={`crm-overlay${drawerOpen ? ' open' : ''}`} onClick={() => setDrawerOpen(false)} />

      {/* Sidebar */}
      <aside className={`crm-sidebar${drawerOpen ? ' open' : ''}`}>
        <div className="crm-logo">Korda<span>CRM</span></div>

        {profile?.is_admin && (
          <div style={{ padding: '0 1.25rem 0.75rem' }}>
            <button
              onClick={() => setAdminMode(v => !v)}
              style={{
                fontSize: '0.68rem', fontWeight: 600, letterSpacing: '0.06em',
                padding: '0.25rem 0.65rem', borderRadius: 9999,
                border: `1px solid ${adminMode ? '#FCA5A5' : '#E5E7EB'}`,
                background: adminMode ? '#FEF2F2' : '#F9FAFB',
                color: adminMode ? '#DC2626' : '#9CA3AF',
                cursor: 'pointer',
                display: 'flex', alignItems: 'center', gap: '0.35rem',
                transition: 'all 0.15s',
              }}
            >
              <Shield size={10} />
              ADMIN {adminMode ? 'ON' : 'OFF'}
            </button>
          </div>
        )}

        <nav style={{ flex: 1 }}>
          {NAV_ITEMS.map((item) => (
            <Link
              key={item.path}
              to={item.path}
              className={`crm-nav-item${pathname.startsWith(item.path) ? ' active' : ''}`}
            >
              <item.icon size={15} style={{ flexShrink: 0 }} />
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="crm-sidebar-bottom">
          {repName && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.75rem' }}>
              <div style={{ width: 8, height: 8, borderRadius: '50%', background: repColor, flexShrink: 0 }} />
              <span style={{ fontSize: '0.82rem', fontWeight: 500, color: '#1c1a17' }}>{repName}</span>
            </div>
          )}
          <Link
            to="/"
            style={{
              display: 'block', fontSize: '0.75rem', color: '#B0A99A',
              textDecoration: 'none', marginBottom: '0.5rem',
              transition: 'color 0.15s',
            }}
            onMouseEnter={e => (e.currentTarget.style.color = '#706d66')}
            onMouseLeave={e => (e.currentTarget.style.color = '#B0A99A')}
          >
            ← Terug naar Korda
          </Link>
          <button
            onClick={handleSignOut}
            style={{
              display: 'flex', alignItems: 'center', gap: '0.45rem',
              fontSize: '0.78rem', color: '#B0A99A',
              background: 'none', border: 'none', cursor: 'pointer',
              padding: 0, transition: 'color 0.15s',
            }}
            onMouseEnter={e => (e.currentTarget.style.color = '#DC2626')}
            onMouseLeave={e => (e.currentTarget.style.color = '#B0A99A')}
          >
            <LogOut size={13} />
            Uitloggen
          </button>
        </div>
      </aside>

      <main className="crm-main">
        <Outlet context={outletCtx} />
      </main>
    </div>
  );
}
