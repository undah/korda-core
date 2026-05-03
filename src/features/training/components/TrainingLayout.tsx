import { useState, useEffect } from 'react';
import { Link, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { PlusCircle, Clock, Brain, ArrowLeft, LogOut, Menu, X, Camera } from 'lucide-react';
import { useAuth } from '@/auth/AuthProvider';

const NAV_ITEMS = [
  { path: '/training/new',                  label: 'New Entry',   icon: PlusCircle },
  { path: '/training/history',              label: 'History',     icon: Clock },
  { path: '/training/screenshot-scheduler', label: 'Screenshots', icon: Camera },
];

export default function TrainingLayout() {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const { signOut, loading } = useAuth();
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => { setMobileOpen(false); }, [pathname]);

  useEffect(() => {
    document.body.style.overflow = mobileOpen ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [mobileOpen]);

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', background: '#0d1117', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ width: 24, height: 24, border: '2px solid #00d4ff', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }


  const handleSignOut = async () => {
    await signOut();
    navigate('/login');
  };

  return (
    <div style={{ minHeight: '100vh', background: '#0d1117', display: 'flex', fontFamily: "'Inter', -apple-system, sans-serif" }}>
      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }

        .training-sidebar {
          width: 220px;
          min-height: 100vh;
          background: #0d1117;
          border-right: 1px solid rgba(255,255,255,0.06);
          display: flex;
          flex-direction: column;
          padding: 1.5rem 0;
          position: fixed;
          top: 0; left: 0;
          z-index: 50;
          transition: transform 0.3s cubic-bezier(0.16,1,0.3,1);
        }

        .training-logo {
          padding: 0 1.25rem 1.5rem;
          border-bottom: 1px solid rgba(255,255,255,0.06);
          margin-bottom: 1rem;
          font-size: 1rem;
          font-weight: 700;
          color: #f0f6fc;
          letter-spacing: -0.02em;
          display: flex;
          align-items: center;
          gap: 0.5rem;
        }
        .training-logo-accent { color: #00d4ff; }
        .training-logo-tag {
          font-size: 0.6rem;
          font-weight: 600;
          letter-spacing: 0.08em;
          color: #00d4ff;
          background: rgba(0,212,255,0.08);
          border: 1px solid rgba(0,212,255,0.2);
          padding: 0.1rem 0.4rem;
          border-radius: 4px;
          text-transform: uppercase;
        }

        .training-nav-item {
          display: flex;
          align-items: center;
          gap: 0.65rem;
          padding: 0.55rem 1.25rem;
          font-size: 0.825rem;
          color: rgba(240,246,252,0.45);
          text-decoration: none;
          border-left: 2px solid transparent;
          transition: all 0.15s;
          margin: 1px 0;
        }
        .training-nav-item:hover { color: rgba(240,246,252,0.85); background: rgba(255,255,255,0.03); }
        .training-nav-item.active {
          color: #00d4ff;
          border-left-color: #00d4ff;
          background: rgba(0,212,255,0.06);
          font-weight: 500;
        }

        .training-sidebar-bottom {
          margin-top: auto;
          padding: 1.25rem;
          border-top: 1px solid rgba(255,255,255,0.06);
          display: flex;
          flex-direction: column;
          gap: 0.5rem;
        }

        .training-main {
          margin-left: 220px;
          flex: 1;
          min-height: 100vh;
          padding: 2rem 2.5rem;
        }

        .training-topbar {
          display: none;
          position: fixed;
          top: 0; left: 0; right: 0;
          height: 52px;
          background: #0d1117;
          border-bottom: 1px solid rgba(255,255,255,0.06);
          align-items: center;
          justify-content: space-between;
          padding: 0 1.25rem;
          z-index: 60;
        }

        .training-overlay {
          display: none;
          position: fixed;
          inset: 0; z-index: 55;
          background: rgba(0,0,0,0.6);
          backdrop-filter: blur(2px);
          opacity: 0;
          transition: opacity 0.25s;
          pointer-events: none;
        }
        .training-overlay.open { opacity: 1; pointer-events: all; }

        .t-btn-ghost {
          display: flex;
          align-items: center;
          gap: 0.4rem;
          font-size: 0.75rem;
          color: rgba(240,246,252,0.35);
          background: none;
          border: none;
          cursor: pointer;
          padding: 0.25rem 0;
          text-decoration: none;
          transition: color 0.15s;
        }
        .t-btn-ghost:hover { color: rgba(240,246,252,0.7); }
        .t-btn-ghost.danger:hover { color: #f87171; }

        @media (max-width: 768px) {
          .training-topbar { display: flex; }
          .training-overlay { display: block; }
          .training-sidebar { transform: translateX(-100%); z-index: 65; }
          .training-sidebar.open { transform: translateX(0); }
          .training-main { margin-left: 0; padding: 1.25rem; padding-top: calc(52px + 1.25rem); }
        }
      `}</style>

      {/* Mobile topbar */}
      <div className="training-topbar">
        <span style={{ fontWeight: 700, fontSize: '0.95rem', color: '#f0f6fc', letterSpacing: '-0.02em' }}>
          Korda<span style={{ color: '#00d4ff' }}>AI</span>
        </span>
        <button
          onClick={() => setMobileOpen(v => !v)}
          style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(240,246,252,0.6)', padding: 4, display: 'flex' }}
        >
          {mobileOpen ? <X size={20} /> : <Menu size={20} />}
        </button>
      </div>

      {/* Overlay */}
      <div
        className={`training-overlay${mobileOpen ? ' open' : ''}`}
        onClick={() => setMobileOpen(false)}
      />

      {/* Sidebar */}
      <aside className={`training-sidebar${mobileOpen ? ' open' : ''}`}>
        <div className="training-logo">
          <Brain size={16} style={{ color: '#00d4ff' }} />
          Korda<span className="training-logo-accent">AI</span>
          <span className="training-logo-tag">Training</span>
        </div>

        <nav style={{ flex: 1 }}>
          {NAV_ITEMS.map(item => (
            <Link
              key={item.path}
              to={item.path}
              className={`training-nav-item${pathname.startsWith(item.path) ? ' active' : ''}`}
            >
              <item.icon size={14} style={{ flexShrink: 0 }} />
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="training-sidebar-bottom">
          <Link to="/dashboard" className="t-btn-ghost">
            <ArrowLeft size={13} />
            Back to KordaTrading
          </Link>
          <button onClick={handleSignOut} className="t-btn-ghost danger" style={{ textAlign: 'left' }}>
            <LogOut size={13} />
            Sign out
          </button>
        </div>
      </aside>

      <main className="training-main">
        <Outlet />
      </main>
    </div>
  );
}
