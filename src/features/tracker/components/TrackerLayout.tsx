// src/features/tracker/components/TrackerLayout.tsx
import React, { useEffect, useState } from "react";
import { Link, useLocation, Outlet } from "react-router-dom";

const NAV_ITEMS = [
  { path: "/tracker/dashboard", label: "Overview",  icon: "⬡" },
  { path: "/tracker/progress",  label: "Progress",  icon: "↗" },
  { path: "/tracker/journal",   label: "Journal",   icon: "◈" },
  { path: "/tracker/calories",  label: "Calories",  icon: "◎" },
  { path: "/tracker/photos",    label: "Photos",    icon: "▣" },
  { path: "/tracker/analysis",  label: "Analysis",  icon: "∿" },
];

export default function TrackerLayout() {
  const { pathname } = useLocation();
  const [drawerOpen, setDrawerOpen] = useState(false);

  // close drawer on route change
  useEffect(() => { setDrawerOpen(false); }, [pathname]);

  // lock body scroll when drawer open
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
      .kt-app { display: flex; min-height: 100vh; background: #07090b; color: #dde8ed; font-family: 'DM Sans', sans-serif; font-weight: 300; }
      .kt-app *, .kt-app *::before, .kt-app *::after { box-sizing: border-box; }

      /* ── SIDEBAR (desktop) ── */
      .kt-sidebar { width: 220px; min-height: 100vh; background: #0a0e12; border-right: 1px solid rgba(90,180,212,0.08); display: flex; flex-direction: column; padding: 2rem 0; position: fixed; top: 0; left: 0; z-index: 50; transition: transform 0.3s cubic-bezier(0.16,1,0.3,1); }
      .kt-sidebar-logo { padding: 0 1.5rem 2rem; border-bottom: 1px solid rgba(90,180,212,0.06); margin-bottom: 1.5rem; }
      .kt-sidebar-logo a { font-family: 'IBM Plex Mono', monospace; font-size: 0.85rem; font-weight: 500; color: #5ab4d4; text-decoration: none; }
      .kt-sidebar-logo span { font-size: 0.5rem; vertical-align: super; color: rgba(221,232,237,0.2); }
      .kt-nav-item { display: flex; align-items: center; gap: 0.75rem; padding: 0.7rem 1.5rem; font-size: 0.82rem; letter-spacing: 0.04em; color: rgba(221,232,237,0.35); text-decoration: none; transition: all 0.15s; border-left: 2px solid transparent; }
      .kt-nav-item:hover { color: rgba(221,232,237,0.7); background: rgba(90,180,212,0.04); }
      .kt-nav-item.active { color: #5ab4d4; border-left-color: #5ab4d4; background: rgba(90,180,212,0.06); }
      .kt-nav-icon { font-size: 0.9rem; width: 16px; text-align: center; }
      .kt-sidebar-bottom { margin-top: auto; padding: 1.5rem; border-top: 1px solid rgba(90,180,212,0.06); }
      .kt-back-link { font-family: 'IBM Plex Mono', monospace; font-size: 0.65rem; letter-spacing: 0.1em; color: rgba(221,232,237,0.2); text-decoration: none; transition: color 0.2s; }
      .kt-back-link:hover { color: rgba(221,232,237,0.5); }

      /* ── MAIN ── */
      .kt-main { margin-left: 220px; flex: 1; padding: 2.5rem 3rem; max-width: 1100px; }

      /* ── MOBILE TOPBAR ── */
      .kt-topbar { display: none; position: fixed; top: 0; left: 0; right: 0; z-index: 60; height: 56px; background: #0a0e12; border-bottom: 1px solid rgba(90,180,212,0.08); align-items: center; justify-content: space-between; padding: 0 1.25rem; }
      .kt-topbar-logo { font-family: 'IBM Plex Mono', monospace; font-size: 0.82rem; font-weight: 500; color: #5ab4d4; text-decoration: none; }
      .kt-hamburger { background: none; border: none; cursor: pointer; display: flex; flex-direction: column; gap: 5px; padding: 4px; }
      .kt-hamburger span { display: block; width: 22px; height: 1.5px; background: rgba(221,232,237,0.6); transition: all 0.2s; }
      .kt-hamburger.open span:nth-child(1) { transform: translateY(6.5px) rotate(45deg); }
      .kt-hamburger.open span:nth-child(2) { opacity: 0; }
      .kt-hamburger.open span:nth-child(3) { transform: translateY(-6.5px) rotate(-45deg); }

      /* ── DRAWER OVERLAY ── */
      .kt-drawer-overlay { display: none; position: fixed; inset: 0; z-index: 55; background: rgba(7,9,11,0.7); backdrop-filter: blur(4px); opacity: 0; transition: opacity 0.3s; pointer-events: none; }
      .kt-drawer-overlay.open { opacity: 1; pointer-events: all; }

      /* ── PAGE COMPONENTS ── */
      .kt-page-header { margin-bottom: 2.5rem; }
      .kt-page-eyebrow { font-family: 'IBM Plex Mono', monospace; font-size: 0.6rem; letter-spacing: 0.25em; text-transform: uppercase; color: rgba(90,180,212,0.5); margin-bottom: 0.5rem; display: flex; align-items: center; gap: 0.5rem; }
      .kt-page-eyebrow::before { content: '//'; color: rgba(221,232,237,0.2); }
      .kt-page-title { font-family: 'Playfair Display', serif; font-size: 2rem; font-weight: 400; line-height: 1.1; }
      .kt-page-title em { font-style: italic; color: rgba(90,180,212,0.6); }
      .kt-card { background: #0c1217; border: 1px solid rgba(90,180,212,0.08); border-top: 1px solid rgba(90,180,212,0.18); padding: 1.5rem; }
      .kt-card-label { font-family: 'IBM Plex Mono', monospace; font-size: 0.6rem; letter-spacing: 0.2em; text-transform: uppercase; color: rgba(221,232,237,0.25); margin-bottom: 0.4rem; }
      .kt-card-value { font-family: 'IBM Plex Mono', monospace; font-size: 1.6rem; font-weight: 500; color: #5ab4d4; }
      .kt-card-sub { font-size: 0.75rem; color: rgba(221,232,237,0.3); margin-top: 0.2rem; }
      .kt-input { background: #0a0e12; border: 1px solid rgba(90,180,212,0.12); color: #dde8ed; padding: 0.6rem 0.9rem; font-family: 'IBM Plex Mono', monospace; font-size: 0.82rem; width: 100%; outline: none; transition: border-color 0.2s; }
      .kt-input:focus { border-color: rgba(90,180,212,0.4); }
      .kt-input::placeholder { color: rgba(221,232,237,0.2); }
      .kt-label { font-family: 'IBM Plex Mono', monospace; font-size: 0.62rem; letter-spacing: 0.15em; text-transform: uppercase; color: rgba(221,232,237,0.35); display: block; margin-bottom: 0.4rem; }
      .kt-btn { font-family: 'IBM Plex Mono', monospace; font-size: 0.75rem; letter-spacing: 0.08em; padding: 0.7rem 1.6rem; cursor: pointer; border: none; transition: opacity 0.2s; }
      .kt-btn-blue { background: #5ab4d4; color: #07090b; font-weight: 500; }
      .kt-btn-blue:hover { opacity: 0.85; }
      .kt-btn-outline { background: transparent; color: rgba(90,180,212,0.7); border: 1px solid rgba(90,180,212,0.2); }
      .kt-btn-outline:hover { border-color: rgba(90,180,212,0.5); color: #5ab4d4; }
      .kt-grid-4 { display: grid; grid-template-columns: repeat(4,1fr); gap: 2px; }
      .kt-grid-3 { display: grid; grid-template-columns: repeat(3,1fr); gap: 2px; }
      .kt-grid-2 { display: grid; grid-template-columns: repeat(2,1fr); gap: 1.5rem; }
      .kt-divider { border: none; border-top: 1px solid rgba(90,180,212,0.07); margin: 2rem 0; }
      .kt-badge { font-family: 'IBM Plex Mono', monospace; font-size: 0.6rem; letter-spacing: 0.1em; text-transform: uppercase; padding: 0.25rem 0.6rem; border: 1px solid; display: inline-block; }
      .kt-badge-blue { color: #5ab4d4; border-color: rgba(90,180,212,0.3); background: rgba(90,180,212,0.06); }
      .kt-badge-green { color: #5ad4a0; border-color: rgba(90,212,160,0.3); background: rgba(90,212,160,0.06); }
      .kt-badge-red { color: #d4705a; border-color: rgba(212,112,90,0.3); background: rgba(212,112,90,0.06); }
      textarea.kt-input { resize: vertical; min-height: 100px; }
      select.kt-input { appearance: none; cursor: pointer; }

      /* ── MOBILE ── */
      @media (max-width: 768px) {
        .kt-topbar { display: flex; }
        .kt-drawer-overlay { display: block; }
        .kt-sidebar { transform: translateX(-100%); width: 260px; z-index: 65; }
        .kt-sidebar.open { transform: translateX(0); }
        .kt-main { margin-left: 0; padding: 1.25rem; padding-top: calc(56px + 1.25rem); }
        .kt-grid-4 { grid-template-columns: repeat(2,1fr); }
        .kt-grid-3 { grid-template-columns: repeat(2,1fr); }
        .kt-grid-2 { grid-template-columns: 1fr; gap: 1rem; }
        .kt-page-title { font-size: 1.6rem; }
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

      {/* ── MOBILE TOPBAR ── */}
      <div className="kt-topbar">
        <Link to="/tracker" className="kt-topbar-logo">KordaTracker™</Link>
        <button
          className={`kt-hamburger${drawerOpen ? " open" : ""}`}
          onClick={() => setDrawerOpen(v => !v)}
          aria-label="Toggle menu"
        >
          <span /><span /><span />
        </button>
      </div>

      {/* ── DRAWER OVERLAY ── */}
      <div
        className={`kt-drawer-overlay${drawerOpen ? " open" : ""}`}
        onClick={() => setDrawerOpen(false)}
      />

      {/* ── SIDEBAR / DRAWER ── */}
      <aside className={`kt-sidebar${drawerOpen ? " open" : ""}`}>
        <div className="kt-sidebar-logo">
          <a href="/tracker">KordaTracker<span>™</span></a>
        </div>

        <nav style={{ flex: 1 }}>
          {NAV_ITEMS.map((item) => (
            <Link
              key={item.path}
              to={item.path}
              className={`kt-nav-item${pathname === item.path ? " active" : ""}`}
            >
              <span className="kt-nav-icon">{item.icon}</span>
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="kt-sidebar-bottom">
          <Link to="/" className="kt-back-link">← Back to Korda</Link>
        </div>
      </aside>

      {/* ── MAIN CONTENT ── */}
      <main className="kt-main">
        <Outlet />
      </main>

    </div>
  );
}
