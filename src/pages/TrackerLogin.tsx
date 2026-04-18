// src/pages/TrackerLogin.tsx
import React, { useEffect, useState, useMemo } from "react";
import { useLocation, useNavigate, Link } from "react-router-dom";
import { supabase } from "@/lib/supabaseClient";
import { toast } from "sonner";

type LocationState = { from?: string };

export default function TrackerLogin() {
  const navigate = useNavigate();
  const location = useLocation();
  const from = (location.state as LocationState | null)?.from || "/tracker/dashboard";

  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);

  const title = useMemo(() => mode === "signin" ? "Sign in" : "Create account", [mode]);

  useEffect(() => {
    const link = document.createElement("link");
    link.href = "https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500&family=Playfair+Display:ital,wght@0,400;1,400&family=DM+Sans:wght@300;400;500&display=swap";
    link.rel = "stylesheet";
    document.head.appendChild(link);

    const style = document.createElement("style");
    style.id = "tlogin-global";
    style.textContent = `
      body.tlogin-page { overflow: hidden; }
      .tlogin-portal { position: fixed; inset: 0; z-index: 9999; overflow-y: auto; background: #07090b; display: flex; flex-direction: column; }
      .tlogin-root { min-height: 100vh; background: #07090b; color: #dde8ed; font-family: 'DM Sans', sans-serif; font-weight: 300; display: flex; flex-direction: column; }
      .tlogin-root *, .tlogin-root *::before, .tlogin-root *::after { box-sizing: border-box; margin: 0; padding: 0; }

      /* grid bg */
      .tlogin-grid { position: fixed; inset: 0; z-index: 0; pointer-events: none;
        background-image: linear-gradient(rgba(90,180,212,0.025) 1px, transparent 1px), linear-gradient(90deg, rgba(90,180,212,0.025) 1px, transparent 1px);
        background-size: 60px 60px; }
      .tlogin-noise { position: fixed; inset: 0; z-index: 0; pointer-events: none;
        background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.88' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='0.035'/%3E%3C/svg%3E");
        opacity: .45; }

      /* nav */
      .tlogin-nav { position: relative; z-index: 10; display: flex; align-items: center; justify-content: space-between; padding: 1.4rem 4rem; border-bottom: 1px solid rgba(90,180,212,0.08); }
      .tlogin-nav-logo { font-family: 'IBM Plex Mono', monospace; font-size: 0.88rem; font-weight: 500; color: #5ab4d4; text-decoration: none; letter-spacing: 0.05em; }
      .tlogin-nav-back { font-family: 'IBM Plex Mono', monospace; font-size: 0.65rem; letter-spacing: 0.1em; color: rgba(221,232,237,0.25); text-decoration: none; transition: color 0.2s; }
      .tlogin-nav-back:hover { color: rgba(221,232,237,0.6); }

      /* main */
      .tlogin-main { flex: 1; display: flex; align-items: center; justify-content: center; padding: 4rem 2rem; position: relative; z-index: 1; }

      /* card */
      .tlogin-card { width: 100%; max-width: 420px; background: #0c1217; border: 1px solid rgba(90,180,212,0.08); border-top: 1px solid rgba(90,180,212,0.22); padding: 3rem; }

      .tlogin-eyebrow { font-family: 'IBM Plex Mono', monospace; font-size: 0.58rem; letter-spacing: 0.25em; text-transform: uppercase; color: rgba(90,180,212,0.45); margin-bottom: 1rem; display: flex; align-items: center; gap: 0.5rem; }
      .tlogin-eyebrow::before { content: '//'; color: rgba(221,232,237,0.2); }

      .tlogin-title { font-family: 'Playfair Display', serif; font-size: 2rem; font-weight: 400; color: #dde8ed; margin-bottom: 0.5rem; line-height: 1.1; }
      .tlogin-title em { font-style: italic; color: rgba(90,180,212,0.6); }
      .tlogin-desc { font-size: 0.82rem; color: rgba(221,232,237,0.35); margin-bottom: 2.5rem; line-height: 1.7; }

      .tlogin-label { font-family: 'IBM Plex Mono', monospace; font-size: 0.6rem; letter-spacing: 0.18em; text-transform: uppercase; color: rgba(221,232,237,0.35); display: block; margin-bottom: 0.45rem; }
      .tlogin-input { width: 100%; background: #0a0e12; border: 1px solid rgba(90,180,212,0.12); color: #dde8ed; padding: 0.7rem 1rem; font-family: 'IBM Plex Mono', monospace; font-size: 0.82rem; outline: none; transition: border-color 0.2s; margin-bottom: 1.25rem; }
      .tlogin-input:focus { border-color: rgba(90,180,212,0.45); }
      .tlogin-input::placeholder { color: rgba(221,232,237,0.15); }

      .tlogin-hint { font-size: 0.72rem; color: rgba(221,232,237,0.2); margin-top: -0.85rem; margin-bottom: 1.25rem; }

      .tlogin-btn { width: 100%; font-family: 'IBM Plex Mono', monospace; font-size: 0.78rem; letter-spacing: 0.1em; background: #5ab4d4; color: #07090b; padding: 0.85rem; border: none; cursor: pointer; font-weight: 500; transition: opacity 0.2s; margin-top: 0.5rem; }
      .tlogin-btn:hover { opacity: 0.85; }
      .tlogin-btn:disabled { opacity: 0.5; cursor: not-allowed; }

      .tlogin-switch { margin-top: 1.5rem; text-align: center; font-size: 0.8rem; color: rgba(221,232,237,0.3); }
      .tlogin-switch button { background: none; border: none; cursor: pointer; font-family: 'IBM Plex Mono', monospace; font-size: 0.75rem; color: rgba(90,180,212,0.7); letter-spacing: 0.05em; text-decoration: underline; transition: color 0.2s; }
      .tlogin-switch button:hover { color: #5ab4d4; }

      .tlogin-divider { border: none; border-top: 1px solid rgba(90,180,212,0.06); margin: 2rem 0 1.5rem; }

      /* footer */
      .tlogin-footer { position: relative; z-index: 1; padding: 1.5rem 4rem; border-top: 1px solid rgba(90,180,212,0.06); display: flex; align-items: center; justify-content: space-between; }
      .tlogin-footer-logo { font-family: 'IBM Plex Mono', monospace; font-size: 0.7rem; color: rgba(221,232,237,0.15); }
      .tlogin-footer-copy { font-family: 'IBM Plex Mono', monospace; font-size: 0.58rem; letter-spacing: 0.1em; color: rgba(221,232,237,0.12); }

      @keyframes tlogin-fadeUp { from { opacity: 0; transform: translateY(16px); } to { opacity: 1; transform: translateY(0); } }
      .tlogin-card { animation: tlogin-fadeUp 0.5s ease both; }

      @media (max-width: 600px) {
        .tlogin-nav { padding: 1rem 1.5rem; }
        .tlogin-card { padding: 2rem 1.5rem; }
        .tlogin-footer { padding: 1.5rem; flex-direction: column; gap: 0.5rem; text-align: center; }
      }
    `;
    document.head.appendChild(style);
    document.body.classList.add("tlogin-page");

    return () => {
      document.head.removeChild(link);
      const el = document.getElementById("tlogin-global");
      if (el) document.head.removeChild(el);
      document.body.classList.remove("tlogin-page");
    };
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      if (mode === "signin") {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        navigate(from, { replace: true });
      } else {
        const { error } = await supabase.auth.signUp({ email, password });
        if (error) throw error;
        toast.success("Account created — check your inbox to confirm.");
        navigate(from, { replace: true });
      }
    } catch (err: any) {
      toast.error(err?.message ?? "Something went wrong.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="tlogin-portal">
      <div className="tlogin-root">
        <div className="tlogin-grid" />
        <div className="tlogin-noise" />

        {/* NAV */}
        <nav className="tlogin-nav">
          <span className="tlogin-nav-logo">KordaTracker™</span>
          <Link to="/tracker" className="tlogin-nav-back">← Back to overview</Link>
        </nav>

        {/* MAIN */}
        <main className="tlogin-main">
          <div className="tlogin-card">
            <p className="tlogin-eyebrow">
              {mode === "signin" ? "Authentication" : "Registration"}
            </p>

            <h1 className="tlogin-title">
              {mode === "signin" ? (
                <>Sign <em>in</em></>
              ) : (
                <>Create <em>account</em></>
              )}
            </h1>

            <p className="tlogin-desc">
              {mode === "signin"
                ? "Access your body data, progress logs, and analysis."
                : "Start tracking your weight, measurements, and progress today."}
            </p>

            <form onSubmit={handleSubmit}>
              <label className="tlogin-label" htmlFor="email">Email</label>
              <input
                className="tlogin-input"
                id="email"
                type="email"
                autoComplete="email"
                placeholder="you@example.com"
                value={email}
                onChange={e => setEmail(e.target.value)}
                required
              />

              <label className="tlogin-label" htmlFor="password">Password</label>
              <input
                className="tlogin-input"
                id="password"
                type="password"
                autoComplete={mode === "signin" ? "current-password" : "new-password"}
                placeholder="••••••••"
                value={password}
                onChange={e => setPassword(e.target.value)}
                required
                minLength={8}
              />
              <p className="tlogin-hint">Minimum 8 characters.</p>

              <button className="tlogin-btn" type="submit" disabled={busy}>
                {busy ? "Please wait..." : mode === "signin" ? "Sign in →" : "Create account →"}
              </button>
            </form>

            <hr className="tlogin-divider" />

            <div className="tlogin-switch">
              {mode === "signin" ? (
                <>
                  No account yet?{" "}
                  <button type="button" onClick={() => setMode("signup")}>Create one</button>
                </>
              ) : (
                <>
                  Already have an account?{" "}
                  <button type="button" onClick={() => setMode("signin")}>Sign in</button>
                </>
              )}
            </div>
          </div>
        </main>

        {/* FOOTER */}
        <footer className="tlogin-footer">
          <span className="tlogin-footer-logo">KordaTracker™</span>
          <span className="tlogin-footer-copy">© 2025 Korda™. All rights reserved.</span>
        </footer>
      </div>
    </div>
  );
}
