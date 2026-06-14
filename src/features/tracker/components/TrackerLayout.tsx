import React, { useEffect, useState } from "react";
import { Link, useLocation, Outlet } from "react-router-dom";
import { LayoutDashboard, TrendingUp, BookOpen, Camera, BarChart2, Settings } from "lucide-react";
import { useNotificationCheck } from "@/hooks/useNotificationCheck";

const NAV_ITEMS = [
  { path: "/tracker/dashboard", label: "Overview",  icon: LayoutDashboard },
  { path: "/tracker/progress",  label: "Progress",  icon: TrendingUp },
  { path: "/tracker/journal",   label: "Journal",   icon: BookOpen },
  { path: "/tracker/photos",    label: "Photos",    icon: Camera },
  { path: "/tracker/analysis",  label: "Analysis",  icon: BarChart2 },
  { path: "/tracker/settings",  label: "Settings",  icon: Settings },
];

export default function TrackerLayout() {
  const { pathname } = useLocation();
  const [drawerOpen, setDrawerOpen] = useState(false);
  useNotificationCheck();

  useEffect(() => { setDrawerOpen(false); }, [pathname]);

  useEffect(() => {
    document.body.style.overflow = drawerOpen ? "hidden" : "";
    return () => { document.body.style.overflow = ""; };
  }, [drawerOpen]);

  useEffect(() => {
    const link = document.createElement("link");
    link.href = "https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,400;1,400&family=IBM+Plex+Mono:wght@400;500&family=DM+Sans:wght@300;400;500&display=swap";
    link.rel = "stylesheet";
    document.head.appendChild(link);

    const style = document.createElement("style");
    style.id = "kt-app-global";
    style.textContent = `
      html, body { background: #0C0C14; margin: 0; }
      .kt-app { display: flex; min-height: 100vh; background: #0C0C14; color: #E8E8F0; font-family: 'DM Sans', sans-serif; font-weight: 400; }
      .kt-app *, .kt-app *::before, .kt-app *::after { box-sizing: border-box; }

      /* ── SIDEBAR ── */
      .kt-sidebar { width: 220px; min-height: 100vh; background: #10101A; border-right: 1px solid rgba(255,255,255,0.05); display: flex; flex-direction: column; padding: 1.5rem 0; position: fixed; top: 0; left: 0; z-index: 50; transition: transform 0.3s cubic-bezier(0.16,1,0.3,1); }
      .kt-sidebar-logo { padding: 0 1rem 1.25rem; border-bottom: 1px solid rgba(255,255,255,0.05); margin-bottom: 1rem; display: flex; align-items: center; gap: 0.6rem; }
      .kt-sidebar-logo a { font-family: 'DM Sans', sans-serif; font-size: 0.9rem; font-weight: 700; color: #E8E8F0; text-decoration: none; letter-spacing: -0.02em; }
      .kt-sidebar-logo span { font-size: 0.45rem; vertical-align: super; color: rgba(232,232,240,0.2); }
      .kt-nav-item { display: flex; align-items: center; gap: 0.65rem; padding: 0.55rem 0.85rem; margin: 1px 0.65rem; font-size: 0.83rem; font-weight: 400; letter-spacing: 0; color: rgba(232,232,240,0.4); text-decoration: none; transition: all 0.12s; border-radius: 8px; border-left: none; }
      .kt-nav-item:hover { color: rgba(232,232,240,0.8); background: rgba(255,255,255,0.05); }
      .kt-nav-item.active { color: #00C8FF; background: rgba(0,200,255,0.1); font-weight: 500; }
      .kt-sidebar-bottom { margin-top: auto; padding: 1rem 1rem 0; border-top: 1px solid rgba(255,255,255,0.05); }
      .kt-back-link { font-family: 'DM Sans', sans-serif; font-size: 0.75rem; color: rgba(232,232,240,0.22); text-decoration: none; transition: color 0.2s; display: flex; align-items: center; gap: 0.4rem; }
      .kt-back-link:hover { color: rgba(232,232,240,0.5); }

      /* ── MAIN ── */
      .kt-main { margin-left: 220px; flex: 1; padding: 2rem 2.5rem; max-width: 1100px; overflow-x: hidden; }

      /* ── MOBILE TOPBAR ── */
      .kt-topbar { display: none; position: fixed; top: 0; left: 0; right: 0; z-index: 60; height: 52px; background: #10101A; border-bottom: 1px solid rgba(255,255,255,0.05); align-items: center; justify-content: space-between; padding: 0 1.25rem; }
      .kt-topbar-logo { font-family: 'DM Sans', sans-serif; font-size: 0.88rem; font-weight: 700; color: #E8E8F0; text-decoration: none; letter-spacing: -0.02em; }
      .kt-hamburger { background: none; border: none; cursor: pointer; display: flex; flex-direction: column; gap: 5px; padding: 4px; }
      .kt-hamburger span { display: block; width: 20px; height: 1.5px; background: rgba(232,232,240,0.5); transition: all 0.2s; }
      .kt-hamburger.open span:nth-child(1) { transform: translateY(6.5px) rotate(45deg); }
      .kt-hamburger.open span:nth-child(2) { opacity: 0; }
      .kt-hamburger.open span:nth-child(3) { transform: translateY(-6.5px) rotate(-45deg); }

      /* ── DRAWER OVERLAY ── */
      .kt-drawer-overlay { display: none; position: fixed; inset: 0; z-index: 55; background: rgba(4,4,10,0.75); backdrop-filter: blur(6px); opacity: 0; transition: opacity 0.25s; pointer-events: none; }
      .kt-drawer-overlay.open { opacity: 1; pointer-events: all; }

      /* ── PAGE COMPONENTS ── */
      .kt-page-header { margin-bottom: 1.75rem; }
      .kt-page-eyebrow { font-family: 'DM Sans', sans-serif; font-size: 0.7rem; font-weight: 600; letter-spacing: 0.08em; text-transform: uppercase; color: rgba(0,200,255,0.7); margin-bottom: 0.4rem; display: flex; align-items: center; gap: 0.5rem; }
      .kt-page-title { font-family: 'Playfair Display', serif; font-size: 1.85rem; font-weight: 400; line-height: 1.1; letter-spacing: -0.01em; color: #E8E8F0; }
      .kt-page-title em { font-style: italic; color: #00C8FF; }

      /* ── CARD ── */
      .kt-card { background: #15151E; border: 1px solid rgba(255,255,255,0.07); padding: 1.35rem 1.5rem; border-radius: 12px; overflow-x: hidden; box-shadow: 0 1px 3px rgba(0,0,0,0.3); }
      .kt-card-label { font-family: 'DM Sans', sans-serif; font-size: 0.72rem; font-weight: 500; letter-spacing: 0; text-transform: none; color: rgba(232,232,240,0.45); margin-bottom: 0.4rem; }
      .kt-card-value { font-family: 'DM Sans', sans-serif; font-size: 1.6rem; font-weight: 700; color: #00C8FF; line-height: 1; letter-spacing: -0.02em; }
      .kt-card-sub { font-size: 0.72rem; color: rgba(232,232,240,0.4); margin-top: 0.35rem; }

      /* ── INPUTS ── */
      .kt-input { box-sizing: border-box; background: #1A1A26; border: 1px solid rgba(255,255,255,0.08); color: #E8E8F0; padding: 0.6rem 0.9rem; font-family: 'DM Sans', sans-serif; font-size: 0.85rem; width: 100%; max-width: 100%; min-width: 0; outline: none; transition: border-color 0.2s, box-shadow 0.2s; border-radius: 8px; }
      .kt-input:focus { border-color: rgba(0,200,255,0.45); box-shadow: 0 0 0 3px rgba(0,200,255,0.08); }
      .kt-input::placeholder { color: rgba(232,232,240,0.2); }
      .kt-label { font-family: 'DM Sans', sans-serif; font-size: 0.73rem; font-weight: 500; letter-spacing: 0; text-transform: none; color: rgba(232,232,240,0.55); display: block; margin-bottom: 0.4rem; }
      .kt-btn { font-family: 'DM Sans', sans-serif; font-size: 0.83rem; font-weight: 500; letter-spacing: 0; padding: 0.6rem 1.35rem; cursor: pointer; border: none; transition: all 0.15s; border-radius: 8px; }
      .kt-btn-blue { background: #00C8FF; color: #080810; font-weight: 600; }
      .kt-btn-blue:hover { background: #00B4E8; }
      .kt-btn-outline { background: transparent; color: rgba(0,200,255,0.85); border: 1px solid rgba(0,200,255,0.2); }
      .kt-btn-outline:hover { border-color: rgba(0,200,255,0.45); background: rgba(0,200,255,0.06); }

      /* ── GRIDS ── */
      .kt-grid-4 { display: grid; grid-template-columns: repeat(4,1fr); gap: 12px; }
      .kt-grid-3 { display: grid; grid-template-columns: repeat(3,1fr); gap: 12px; }
      .kt-grid-2 { display: grid; grid-template-columns: repeat(2,1fr); gap: 12px; }
      .kt-grid-4 > *, .kt-grid-3 > *, .kt-grid-2 > * { min-width: 0; }
      .kt-divider { border: none; border-top: 1px solid rgba(255,255,255,0.06); margin: 1.5rem 0; }
      .kt-badge { font-family: 'DM Sans', sans-serif; font-size: 0.68rem; font-weight: 500; letter-spacing: 0; padding: 0.2rem 0.6rem; border: 1px solid; display: inline-block; border-radius: 20px; }
      .kt-badge-blue { color: #00C8FF; border-color: rgba(0,200,255,0.2); background: rgba(0,200,255,0.08); }
      .kt-badge-green { color: #22C55E; border-color: rgba(34,197,94,0.2); background: rgba(34,197,94,0.08); }
      .kt-badge-red { color: #EF4444; border-color: rgba(239,68,68,0.2); background: rgba(239,68,68,0.08); }
      textarea.kt-input { resize: vertical; min-height: 90px; }
      select.kt-input { appearance: none; cursor: pointer; }

      /* ── DATE INPUT ── */
      input[type=date]::-webkit-date-and-time-value { text-align: center; }
      input[type=date] { text-align: center; }

      /* ── NUMBER SPINNERS ── */
      input[type=number]::-webkit-inner-spin-button,
      input[type=number]::-webkit-outer-spin-button { -webkit-appearance: none; margin: 0; }
      input[type=number] { -moz-appearance: textfield; }

      /* ── CHART ── */
      .kt-chart-wrap { height: 240px; }
      @media (max-width: 768px) { .kt-chart-wrap { height: 190px; } }

      /* ── RESPONSIVE UTILS ── */
      .kt-mobile-only { display: none; }
      .kt-desktop-only { display: block; }

      /* ── MOBILE ── */
      @media (max-width: 768px) {
        .kt-mobile-only { display: block; }
        .kt-desktop-only { display: none; }
        .kt-topbar { display: flex; }
        .kt-drawer-overlay { display: block; }
        .kt-sidebar { transform: translateX(-100%); width: 260px; z-index: 65; }
        .kt-sidebar.open { transform: translateX(0); }
        .kt-main { margin-left: 0; padding: 1rem; padding-top: calc(52px + 1rem); }
        .kt-card { padding: 1rem; }
        .kt-grid-4 { grid-template-columns: repeat(2,1fr); gap: 10px; }
        .kt-grid-3 { grid-template-columns: repeat(2,1fr); gap: 10px; }
        .kt-grid-2 { grid-template-columns: 1fr; gap: 10px; }
        .kt-page-title { font-size: 1.45rem; }
        .kt-page-header { margin-bottom: 1.25rem; }
      }
    `;
    document.head.appendChild(style);
    return () => {
      document.head.removeChild(link);
      const el = document.getElementById("kt-app-global");
      if (el) document.head.removeChild(el);
    };
  }, []);

  return (
    <div className="kt-app">
      {/* Mobile topbar */}
      <div className="kt-topbar">
        <Link to="/tracker" className="kt-topbar-logo">KordaTracker™</Link>
        <button className={`kt-hamburger${drawerOpen ? " open" : ""}`} onClick={() => setDrawerOpen(v => !v)} aria-label="Toggle menu">
          <span /><span /><span />
        </button>
      </div>

      {/* Drawer overlay */}
      <div className={`kt-drawer-overlay${drawerOpen ? " open" : ""}`} onClick={() => setDrawerOpen(false)} />

      {/* Sidebar */}
      <aside className={`kt-sidebar${drawerOpen ? " open" : ""}`}>
        <div className="kt-sidebar-logo">
          <img src="/korda-icon.svg" width="20" height="20" style={{ flexShrink: 0 }} />
          <a href="/tracker">KordaTracker<span>™</span></a>
        </div>

        <nav style={{ flex: 1 }}>
          {NAV_ITEMS.map((item) => (
            <Link key={item.path} to={item.path} className={`kt-nav-item${pathname === item.path ? " active" : ""}`}>
              <item.icon size={14} style={{ flexShrink: 0 }} />
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="kt-sidebar-bottom">
          <Link to="/" className="kt-back-link">← Back to Korda</Link>
        </div>
      </aside>

      {/* Main content */}
      <main className="kt-main">
        <Outlet />
      </main>
    </div>
  );
}
