import React, { useEffect, useState } from "react";
import { Link, useLocation, Outlet } from "react-router-dom";
import { LayoutDashboard, TrendingUp, BookOpen, Camera, BarChart2, Settings, Sun, Moon } from "lucide-react";
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
  const [theme, setTheme] = useState<"dark" | "light">(() => {
    try { return (localStorage.getItem("kt-theme") as "dark" | "light") ?? "dark"; }
    catch { return "dark"; }
  });
  useNotificationCheck();

  useEffect(() => { setDrawerOpen(false); }, [pathname]);

  useEffect(() => {
    document.body.style.overflow = drawerOpen ? "hidden" : "";
    return () => { document.body.style.overflow = ""; };
  }, [drawerOpen]);

  useEffect(() => {
    document.body.style.background = theme === "dark" ? "#0C0C14" : "#F4F4F8";
    localStorage.setItem("kt-theme", theme);
  }, [theme]);

  useEffect(() => {
    const link = document.createElement("link");
    link.href = "https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,400;1,400&family=IBM+Plex+Mono:wght@400;500&family=DM+Sans:wght@300;400;500&display=swap";
    link.rel = "stylesheet";
    document.head.appendChild(link);

    const style = document.createElement("style");
    style.id = "kt-app-global";
    style.textContent = `
      html, body { margin: 0; }
      .kt-app *, .kt-app *::before, .kt-app *::after { box-sizing: border-box; }

      /* ── DARK THEME (default) ── */
      .kt-app {
        --kt-bg:           #0C0C14;
        --kt-surface:      #15151E;
        --kt-surface2:     #1A1A26;
        --kt-border:       rgba(255,255,255,0.07);
        --kt-border2:      rgba(255,255,255,0.04);
        --kt-text:         #E8E8F0;
        --kt-muted:        rgba(232,232,240,0.5);
        --kt-dim:          rgba(232,232,240,0.3);
        --kt-accent:       #00C8FF;
        --kt-accent-bg:    rgba(0,200,255,0.1);
        --kt-green:        #22C55E;
        --kt-green-bg:     rgba(34,197,94,0.1);
        --kt-red:          #EF4444;
        --kt-red-bg:       rgba(239,68,68,0.1);
        --kt-shadow:       0 1px 3px rgba(0,0,0,0.3);
        --kt-sidebar-bg:   #10101A;
        --kt-sidebar-b:    rgba(255,255,255,0.05);
        --kt-input-bg:     #1A1A26;
        --kt-hover:        rgba(255,255,255,0.05);
        display: flex; min-height: 100vh; background: var(--kt-bg); color: var(--kt-text);
        font-family: 'DM Sans', sans-serif; font-weight: 400;
      }

      /* ── LIGHT THEME ── */
      .kt-app.light {
        --kt-bg:           #F4F4F8;
        --kt-surface:      #FFFFFF;
        --kt-surface2:     #EEEEF3;
        --kt-border:       rgba(0,0,0,0.09);
        --kt-border2:      rgba(0,0,0,0.05);
        --kt-text:         #111118;
        --kt-muted:        rgba(17,17,24,0.55);
        --kt-dim:          rgba(17,17,24,0.38);
        --kt-accent:       #0099BB;
        --kt-accent-bg:    rgba(0,153,187,0.1);
        --kt-green:        #16A34A;
        --kt-green-bg:     rgba(22,163,74,0.1);
        --kt-red:          #DC2626;
        --kt-red-bg:       rgba(220,38,38,0.1);
        --kt-shadow:       0 1px 3px rgba(0,0,0,0.07), 0 4px 16px rgba(0,0,0,0.05);
        --kt-sidebar-bg:   #FFFFFF;
        --kt-sidebar-b:    rgba(0,0,0,0.08);
        --kt-input-bg:     #EEEEF3;
        --kt-hover:        rgba(0,0,0,0.04);
      }

      /* ── SIDEBAR ── */
      .kt-sidebar { width: 220px; min-height: 100vh; background: var(--kt-sidebar-bg); border-right: 1px solid var(--kt-sidebar-b); display: flex; flex-direction: column; padding: 1.5rem 0; position: fixed; top: 0; left: 0; z-index: 50; transition: transform 0.3s cubic-bezier(0.16,1,0.3,1); }
      .kt-sidebar-logo { padding: 0 1rem 1.25rem; border-bottom: 1px solid var(--kt-sidebar-b); margin-bottom: 1rem; display: flex; align-items: center; gap: 0.6rem; }
      .kt-sidebar-logo a { font-family: 'DM Sans', sans-serif; font-size: 0.9rem; font-weight: 700; color: var(--kt-text); text-decoration: none; letter-spacing: -0.02em; }
      .kt-sidebar-logo span { font-size: 0.45rem; vertical-align: super; color: var(--kt-dim); }
      .kt-nav-item { display: flex; align-items: center; gap: 0.65rem; padding: 0.55rem 0.85rem; margin: 1px 0.65rem; font-size: 0.83rem; font-weight: 400; color: var(--kt-muted); text-decoration: none; transition: all 0.12s; border-radius: 8px; }
      .kt-nav-item:hover { color: var(--kt-text); background: var(--kt-hover); }
      .kt-nav-item.active { color: var(--kt-accent); background: var(--kt-accent-bg); font-weight: 500; }
      .kt-sidebar-bottom { margin-top: auto; padding: 1rem 1rem 0; border-top: 1px solid var(--kt-sidebar-b); }
      .kt-back-link { font-family: 'DM Sans', sans-serif; font-size: 0.75rem; color: var(--kt-dim); text-decoration: none; transition: color 0.2s; display: flex; align-items: center; gap: 0.4rem; }
      .kt-back-link:hover { color: var(--kt-muted); }

      /* ── MAIN ── */
      .kt-main { margin-left: 220px; flex: 1; padding: 2rem 2.5rem; max-width: 1100px; overflow-x: hidden; }

      /* ── MOBILE TOPBAR ── */
      .kt-topbar { display: none; position: fixed; top: 0; left: 0; right: 0; z-index: 60; height: 52px; background: var(--kt-sidebar-bg); border-bottom: 1px solid var(--kt-sidebar-b); align-items: center; justify-content: space-between; padding: 0 1.25rem; }
      .kt-topbar-logo { font-family: 'DM Sans', sans-serif; font-size: 0.88rem; font-weight: 700; color: var(--kt-text); text-decoration: none; letter-spacing: -0.02em; }
      .kt-hamburger { background: none; border: none; cursor: pointer; display: flex; flex-direction: column; gap: 5px; padding: 4px; }
      .kt-hamburger span { display: block; width: 20px; height: 1.5px; background: var(--kt-muted); transition: all 0.2s; }
      .kt-hamburger.open span:nth-child(1) { transform: translateY(6.5px) rotate(45deg); }
      .kt-hamburger.open span:nth-child(2) { opacity: 0; }
      .kt-hamburger.open span:nth-child(3) { transform: translateY(-6.5px) rotate(-45deg); }

      /* ── DRAWER ── */
      .kt-drawer-overlay { display: none; position: fixed; inset: 0; z-index: 55; background: rgba(0,0,0,0.6); backdrop-filter: blur(6px); opacity: 0; transition: opacity 0.25s; pointer-events: none; }
      .kt-drawer-overlay.open { opacity: 1; pointer-events: all; }

      /* ── PAGE ── */
      .kt-page-header { margin-bottom: 1.75rem; }
      .kt-page-eyebrow { font-family: 'DM Sans', sans-serif; font-size: 0.7rem; font-weight: 600; letter-spacing: 0.08em; text-transform: uppercase; color: var(--kt-accent); margin-bottom: 0.4rem; display: flex; align-items: center; gap: 0.5rem; opacity: 0.8; }
      .kt-page-title { font-family: 'Playfair Display', serif; font-size: 1.85rem; font-weight: 400; line-height: 1.1; letter-spacing: -0.01em; color: var(--kt-text); }
      .kt-page-title em { font-style: italic; color: var(--kt-accent); }

      /* ── CARD ── */
      .kt-card { background: var(--kt-surface); border: 1px solid var(--kt-border); padding: 1.35rem 1.5rem; border-radius: 12px; overflow-x: hidden; box-shadow: var(--kt-shadow); }
      .kt-card-label { font-family: 'DM Sans', sans-serif; font-size: 0.72rem; font-weight: 500; color: var(--kt-muted); margin-bottom: 0.4rem; }
      .kt-card-value { font-family: 'DM Sans', sans-serif; font-size: 1.6rem; font-weight: 700; color: var(--kt-accent); line-height: 1; letter-spacing: -0.02em; }
      .kt-card-sub { font-size: 0.72rem; color: var(--kt-dim); margin-top: 0.35rem; }

      /* ── INPUTS ── */
      .kt-input { box-sizing: border-box; background: var(--kt-input-bg); border: 1px solid var(--kt-border); color: var(--kt-text); padding: 0.6rem 0.9rem; font-family: 'DM Sans', sans-serif; font-size: 0.85rem; width: 100%; max-width: 100%; min-width: 0; outline: none; transition: border-color 0.2s, box-shadow 0.2s; border-radius: 8px; }
      .kt-input:focus { border-color: var(--kt-accent); box-shadow: 0 0 0 3px var(--kt-accent-bg); }
      .kt-input::placeholder { color: var(--kt-dim); }
      .kt-label { font-family: 'DM Sans', sans-serif; font-size: 0.73rem; font-weight: 500; color: var(--kt-muted); display: block; margin-bottom: 0.4rem; }
      .kt-btn { font-family: 'DM Sans', sans-serif; font-size: 0.83rem; font-weight: 500; padding: 0.6rem 1.35rem; cursor: pointer; border: none; transition: all 0.15s; border-radius: 8px; }
      .kt-btn-blue { background: var(--kt-accent); color: #080810; font-weight: 600; }
      .kt-btn-blue:hover { opacity: 0.88; }
      .kt-btn-outline { background: transparent; color: var(--kt-accent); border: 1px solid var(--kt-border); }
      .kt-btn-outline:hover { border-color: var(--kt-accent); background: var(--kt-accent-bg); }

      /* ── GRIDS ── */
      .kt-grid-4 { display: grid; grid-template-columns: repeat(4,1fr); gap: 12px; }
      .kt-grid-3 { display: grid; grid-template-columns: repeat(3,1fr); gap: 12px; }
      .kt-grid-2 { display: grid; grid-template-columns: repeat(2,1fr); gap: 12px; }
      .kt-grid-4 > *, .kt-grid-3 > *, .kt-grid-2 > * { min-width: 0; }
      .kt-divider { border: none; border-top: 1px solid var(--kt-border); margin: 1.5rem 0; }
      .kt-badge { font-family: 'DM Sans', sans-serif; font-size: 0.68rem; font-weight: 500; padding: 0.2rem 0.6rem; border: 1px solid; display: inline-block; border-radius: 20px; }
      .kt-badge-blue { color: var(--kt-accent); border-color: var(--kt-border); background: var(--kt-accent-bg); }
      .kt-badge-green { color: var(--kt-green); border-color: var(--kt-green-bg); background: var(--kt-green-bg); }
      .kt-badge-red { color: var(--kt-red); border-color: var(--kt-red-bg); background: var(--kt-red-bg); }
      textarea.kt-input { resize: vertical; min-height: 90px; }
      select.kt-input { appearance: none; cursor: pointer; }

      /* ── DATE / NUMBER INPUTS ── */
      input[type=date]::-webkit-date-and-time-value { text-align: center; }
      input[type=date] { text-align: center; }
      input[type=number]::-webkit-inner-spin-button,
      input[type=number]::-webkit-outer-spin-button { -webkit-appearance: none; margin: 0; }
      input[type=number] { -moz-appearance: textfield; }

      /* ── CHART ── */
      .kt-chart-wrap { height: 240px; }
      @media (max-width: 768px) { .kt-chart-wrap { height: 190px; } }

      /* ── RESPONSIVE ── */
      .kt-mobile-only { display: none; }
      .kt-desktop-only { display: block; }
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
    <div className={`kt-app${theme === "light" ? " light" : ""}`}>
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
          {/* Theme toggle */}
          <button
            onClick={() => setTheme(t => t === "dark" ? "light" : "dark")}
            style={{ display: "flex", alignItems: "center", gap: "0.55rem", width: "100%", background: "none", border: "none", cursor: "pointer", padding: "0.55rem 0.25rem", color: "var(--kt-dim)", fontSize: "0.78rem", fontFamily: "'DM Sans',sans-serif", transition: "color 0.15s", marginBottom: "0.85rem", borderRadius: 8 }}
            onMouseEnter={e => (e.currentTarget.style.color = "var(--kt-text)")}
            onMouseLeave={e => (e.currentTarget.style.color = "var(--kt-dim)")}
          >
            {theme === "dark" ? <Sun size={14} /> : <Moon size={14} />}
            {theme === "dark" ? "Light mode" : "Dark mode"}
          </button>
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
