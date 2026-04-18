// src/pages/SuiteHome.tsx
import React, { useEffect } from "react";
import { Link } from "react-router-dom";

export default function SuiteHome() {

  useEffect(() => {
    const link = document.createElement("link");
    link.href = "https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,400;0,700;1,400&family=IBM+Plex+Mono:wght@400;500&family=DM+Sans:wght@300;400;500&display=swap";
    link.rel = "stylesheet";
    document.head.appendChild(link);

    const style = document.createElement("style");
    style.id = "suite-global";
    style.textContent = `
      body.suite-page { overflow: hidden; }
      .suite-portal { position: fixed; inset: 0; z-index: 9999; overflow-y: auto; background: #080809; }
      .suite-root { min-height: 100vh; background: #080809; color: #e8e6e1; font-family: 'DM Sans', sans-serif; font-weight: 300; overflow-x: hidden; position: relative; }
      .suite-root *, .suite-root *::before, .suite-root *::after { box-sizing: border-box; margin: 0; padding: 0; }
      .suite-noise { position: fixed; inset: 0; z-index: 0; pointer-events: none; background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.88' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='0.04'/%3E%3C/svg%3E"); opacity: .45; }
      .suite-orb { position: fixed; border-radius: 50%; filter: blur(120px); pointer-events: none; z-index: 0; }
      .suite-orb-1 { width: 600px; height: 600px; top: -200px; left: -150px; background: radial-gradient(circle, rgba(0,184,148,0.05) 0%, transparent 70%); animation: orb-drift 18s ease-in-out infinite alternate; }
      .suite-orb-2 { width: 500px; height: 500px; bottom: -150px; right: -100px; background: radial-gradient(circle, rgba(90,180,212,0.07) 0%, transparent 70%); animation: orb-drift 22s ease-in-out infinite alternate-reverse; }
      @keyframes orb-drift { from { transform: translate(0,0) scale(1); } to { transform: translate(40px,30px) scale(1.1); } }
      .suite-nav { position: fixed; top: 0; left: 0; right: 0; z-index: 10000; display: flex; align-items: center; justify-content: space-between; padding: 1.4rem 4rem; border-bottom: 1px solid rgba(255,255,255,0.04); background: rgba(8,8,9,0.88); backdrop-filter: blur(20px); }
      .suite-nav-logo { font-family: 'Playfair Display', serif; font-size: 1.1rem; font-weight: 400; color: #e8e6e1; letter-spacing: 0.01em; }
      .suite-nav-logo sup { font-size: 0.5rem; color: rgba(232,230,225,0.3); vertical-align: super; margin-left: 1px; }
      .suite-nav-links { display: flex; gap: 2.5rem; align-items: center; }
      .suite-nav-links a { font-size: 0.75rem; letter-spacing: 0.12em; text-transform: uppercase; color: rgba(232,230,225,0.35); text-decoration: none; transition: color 0.2s; }
      .suite-nav-links a:hover { color: #e8e6e1; }
      .suite-hero { min-height: 100vh; display: flex; flex-direction: column; align-items: center; justify-content: center; text-align: center; padding: 8rem 2rem 4rem; position: relative; z-index: 1; }
      .suite-eyebrow { font-family: 'IBM Plex Mono', monospace; font-size: 0.65rem; letter-spacing: 0.28em; text-transform: uppercase; color: rgba(232,230,225,0.25); margin-bottom: 2rem; display: flex; align-items: center; gap: 1rem; justify-content: center; }
      .suite-eyebrow::before, .suite-eyebrow::after { content: ''; display: block; width: 24px; height: 1px; background: rgba(232,230,225,0.15); }
      .suite-h1 { font-family: 'Playfair Display', serif; font-size: clamp(3rem, 7vw, 6.5rem); font-weight: 400; line-height: 1.05; letter-spacing: -0.02em; margin-bottom: 1.5rem; }
      .suite-h1 em { font-style: italic; color: rgba(232,230,225,0.35); }
      .suite-sub { font-size: 1rem; font-weight: 300; line-height: 1.9; color: rgba(232,230,225,0.45); max-width: 480px; margin: 0 auto 1rem; }
      .suite-scroll-hint { margin-top: 3.5rem; font-family: 'IBM Plex Mono', monospace; font-size: 0.6rem; letter-spacing: 0.2em; text-transform: uppercase; color: rgba(232,230,225,0.15); display: flex; flex-direction: column; align-items: center; gap: 0.75rem; }
      .suite-scroll-hint::after { content: ''; display: block; width: 1px; height: 40px; background: linear-gradient(to bottom, rgba(232,230,225,0.15), transparent); }
      .suite-cards-section { position: relative; z-index: 1; padding: 2rem 4rem 8rem; max-width: 1300px; margin: 0 auto; }
      .suite-cards-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 3px; }
      .suite-card { position: relative; padding: 3.5rem; min-height: 520px; display: flex; flex-direction: column; justify-content: space-between; overflow: hidden; transition: transform 0.4s cubic-bezier(0.16,1,0.3,1); cursor: pointer; text-decoration: none; color: inherit; }
      .suite-card:hover { transform: translateY(-4px); }
      .suite-card-top-line { position: absolute; top: 0; left: 0; right: 0; height: 1px; }

      /* ── TRADING — teal to match trading app ── */
      .suite-card-trading { background: #0e0e10; }
      .suite-card-trading .suite-card-top-line { background: linear-gradient(to right, transparent, rgba(0,184,148,0.7), transparent); }
      .suite-card-trading:hover { background: #0d1a17; }
      .suite-card-trading .suite-card-tag { color: rgba(0,184,148,0.8); border-color: rgba(0,184,148,0.2); background: rgba(0,184,148,0.04); }
      .suite-card-trading .suite-card-tagline { color: rgba(0,184,148,0.5); }
      .suite-card-trading .suite-card-desc { color: rgba(232,230,225,0.4); }
      .suite-card-trading .suite-feat-dot { background: rgba(0,184,148,0.6); }
      .suite-card-trading .suite-card-cta { color: rgba(0,184,148,0.9); border-color: rgba(0,184,148,0.25); background: rgba(0,184,148,0.06); }
      .suite-card-trading:hover .suite-card-cta { background: rgba(0,184,148,0.12); border-color: rgba(0,184,148,0.5); }

      /* ── TRACKER — steel blue ── */
      .suite-card-tracker { background: #090c0e; }
      .suite-card-tracker .suite-card-top-line { background: linear-gradient(to right, transparent, rgba(90,180,212,0.6), transparent); }
      .suite-card-tracker:hover { background: #0c1014; }
      .suite-card-tracker .suite-card-tag { color: rgba(90,180,212,0.7); border-color: rgba(90,180,212,0.2); background: rgba(90,180,212,0.04); }
      .suite-card-tracker .suite-card-tagline { font-family: 'IBM Plex Mono', monospace; font-size: 0.65rem; color: rgba(90,180,212,0.4); }
      .suite-card-tracker .suite-card-desc { color: rgba(200,220,230,0.4); }
      .suite-card-tracker .suite-feat-dot { background: rgba(90,180,212,0.5); }
      .suite-card-tracker .suite-card-cta { color: rgba(90,180,212,0.85); border-color: rgba(90,180,212,0.2); background: rgba(90,180,212,0.05); }
      .suite-card-tracker:hover .suite-card-cta { background: rgba(90,180,212,0.12); border-color: rgba(90,180,212,0.45); }

      .suite-card-tag { display: inline-flex; align-items: center; gap: 0.5rem; font-family: 'IBM Plex Mono', monospace; font-size: 0.6rem; letter-spacing: 0.2em; text-transform: uppercase; padding: 0.3rem 0.8rem; margin-bottom: 2rem; border: 1px solid; }
      .suite-card-icon { width: 48px; height: 48px; margin-bottom: 2rem; }
      .suite-card-name { font-family: 'Playfair Display', serif; font-size: 2.6rem; font-weight: 400; line-height: 1; margin-bottom: 0.5rem; }
      .suite-card-trading .suite-card-name { color: #e8e6e1; }
      .suite-card-tracker .suite-card-name { color: #c8dce6; font-style: italic; }
      .suite-card-tagline { font-size: 0.78rem; letter-spacing: 0.06em; margin-bottom: 1.5rem; }
      .suite-card-features { list-style: none; margin-bottom: 3rem; display: flex; flex-direction: column; gap: 0.55rem; }
      .suite-card-features li { font-size: 0.8rem; color: rgba(232,230,225,0.35); display: flex; align-items: center; gap: 0.65rem; }
      .suite-feat-dot { width: 3px; height: 3px; border-radius: 50%; flex-shrink: 0; }
      .suite-card-cta { display: inline-flex; align-items: center; gap: 0.75rem; font-family: 'IBM Plex Mono', monospace; font-size: 0.75rem; letter-spacing: 0.1em; text-transform: uppercase; padding: 0.85rem 2rem; border: 1px solid; transition: all 0.2s; width: fit-content; }
      .suite-cta-arrow { transition: transform 0.2s; }
      .suite-card:hover .suite-cta-arrow { transform: translateX(5px); }
      .suite-card-deco { position: absolute; bottom: -10px; right: -10px; width: 220px; opacity: 0.07; pointer-events: none; transition: opacity 0.4s; }
      .suite-card:hover .suite-card-deco { opacity: 0.14; }
      .suite-divider { position: relative; z-index: 1; display: flex; align-items: center; justify-content: center; gap: 2rem; padding: 3rem 4rem; margin: 0 auto; max-width: 1300px; }
      .suite-divider-line { flex: 1; height: 1px; background: rgba(255,255,255,0.04); }
      .suite-divider-text { font-family: 'IBM Plex Mono', monospace; font-size: 0.6rem; letter-spacing: 0.25em; text-transform: uppercase; color: rgba(232,230,225,0.15); white-space: nowrap; }
      .suite-footer { position: relative; z-index: 1; border-top: 1px solid rgba(255,255,255,0.04); padding: 2.5rem 4rem; display: flex; align-items: center; justify-content: space-between; max-width: 1300px; margin: 0 auto; }
      .suite-footer-logo { font-family: 'Playfair Display', serif; font-size: 0.9rem; color: rgba(232,230,225,0.3); }
      .suite-footer-copy { font-family: 'IBM Plex Mono', monospace; font-size: 0.58rem; letter-spacing: 0.12em; color: rgba(232,230,225,0.15); }
      .suite-footer-links { display: flex; gap: 2rem; }
      .suite-footer-links a { font-size: 0.72rem; color: rgba(232,230,225,0.2); text-decoration: none; transition: color 0.2s; }
      .suite-footer-links a:hover { color: rgba(232,230,225,0.5); }
      @keyframes suite-fadeUp { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } }
      .suite-anim-1 { animation: suite-fadeUp 0.7s ease both; }
      .suite-anim-2 { animation: suite-fadeUp 0.7s 0.1s ease both; }
      .suite-anim-3 { animation: suite-fadeUp 0.7s 0.2s ease both; }
      .suite-anim-4 { animation: suite-fadeUp 0.7s 0.32s ease both; }
      .suite-anim-5 { animation: suite-fadeUp 0.7s 0.44s ease both; }
      @media (max-width: 900px) {
        .suite-nav { padding: 1rem 1.5rem; }
        .suite-nav-links { display: none; }
        .suite-cards-section { padding: 2rem 1.5rem 5rem; }
        .suite-cards-grid { grid-template-columns: 1fr; }
        .suite-card { padding: 2.5rem; min-height: auto; }
        .suite-footer { flex-direction: column; gap: 1.5rem; text-align: center; padding: 2rem 1.5rem; }
        .suite-footer-links { justify-content: center; }
        .suite-divider { padding: 2rem 1.5rem; }
      }
    `;
    document.head.appendChild(style);
    document.body.classList.add("suite-page");

    return () => {
      document.head.removeChild(link);
      const el = document.getElementById("suite-global");
      if (el) document.head.removeChild(el);
      document.body.classList.remove("suite-page");
    };
  }, []);

  return (
    <div className="suite-portal">
      <div className="suite-root">
        <div className="suite-noise" />
        <div className="suite-orb suite-orb-1" />
        <div className="suite-orb suite-orb-2" />

        {/* NAV */}
        <nav className="suite-nav">
          <span className="suite-nav-logo">Korda<sup>™</sup></span>
          <div className="suite-nav-links">
            <Link to="/about" className="suite-nav-links">About</Link>
<Link to="/pricing" className="suite-nav-links">Pricing</Link>
          </div>
        </nav>

        {/* HERO */}
        <section className="suite-hero">
          <p className="suite-eyebrow suite-anim-1">The Korda™ Suite</p>
          <h1 className="suite-h1 suite-anim-2">
            One platform.<br />
            Two <em>disciplines.</em>
          </h1>
          <p className="suite-sub suite-anim-3">
            Korda is built for people who measure what matters — whether that's trades, capital, body composition, or progress. Choose your product below.
          </p>
          <div className="suite-scroll-hint suite-anim-4">choose a product</div>
        </section>

        {/* DIVIDER */}
        <div className="suite-divider">
          <div className="suite-divider-line" />
          <span className="suite-divider-text">Select your product</span>
          <div className="suite-divider-line" />
        </div>

        {/* PRODUCT CARDS */}
        <section className="suite-cards-section">
          <div className="suite-cards-grid">

            {/* KORDA TRADING */}
            <Link to="/trading" className="suite-card suite-card-trading suite-anim-4">
              <div className="suite-card-top-line" />
              <div>
                <div className="suite-card-icon">
                  <svg viewBox="0 0 48 48" fill="none" style={{ width: 48, height: 48 }}>
                    <line x1="10" y1="8"  x2="10" y2="15" stroke="rgba(0,184,148,0.5)" strokeWidth="1.5"/>
                    <rect x="6"  y="15" width="8"  height="13" fill="rgba(0,184,148,0.7)" rx="1"/>
                    <line x1="10" y1="28" x2="10" y2="35" stroke="rgba(0,184,148,0.5)" strokeWidth="1.5"/>
                    <line x1="24" y1="11" x2="24" y2="19" stroke="rgba(0,184,148,0.35)" strokeWidth="1.5"/>
                    <rect x="20" y="19" width="8"  height="16" fill="rgba(50,50,60,0.9)" rx="1" stroke="rgba(0,184,148,0.4)" strokeWidth="1"/>
                    <line x1="24" y1="35" x2="24" y2="41" stroke="rgba(0,184,148,0.35)" strokeWidth="1.5"/>
                    <line x1="38" y1="6"  x2="38" y2="13" stroke="rgba(0,184,148,0.6)" strokeWidth="1.5"/>
                    <rect x="34" y="13" width="8"  height="18" fill="rgba(0,184,148,0.7)" rx="1"/>
                    <line x1="38" y1="31" x2="38" y2="39" stroke="rgba(0,184,148,0.6)" strokeWidth="1.5"/>
                  </svg>
                </div>
                <span className="suite-card-tag">Trading Journal</span>
                <h2 className="suite-card-name">KordaCore</h2>
                <p className="suite-card-tagline">Trade With Clarity</p>
                <p className="suite-card-desc">A precision trading journal for discretionary traders. Log trades, review psychology, analyse patterns, and build the discipline that separates consistent traders from the rest.</p>
                <ul className="suite-card-features">
                  {["Full trade CRUD — PnL, RR, strategy tagging","Dashboard analytics — win rate, profit factor, streaks","Psychology journaling with emotion tracking","Chart screenshot uploads & session logs","Live vs backtest account separation"].map(f => (
                    <li key={f}><span className="suite-feat-dot" />{f}</li>
                  ))}
                </ul>
              </div>
              <div className="suite-card-cta">Open KordaCore <span className="suite-cta-arrow">→</span></div>
              <svg className="suite-card-deco" viewBox="0 0 220 140" fill="none">
                <polyline points="0,110 40,80 80,90 120,45 160,60 200,20 220,30" stroke="rgba(0,184,148,1)" strokeWidth="2" fill="none"/>
              </svg>
            </Link>

            {/* KORDATRACKER */}
            <Link to="/tracker" className="suite-card suite-card-tracker suite-anim-5">
              <div className="suite-card-top-line" />
              <div>
                <div className="suite-card-icon">
                  <svg viewBox="0 0 48 48" fill="none" style={{ width: 48, height: 48 }}>
                    <line x1="8"  y1="40" x2="8"  y2="8"  stroke="rgba(90,180,212,0.3)" strokeWidth="1"/>
                    <line x1="8"  y1="40" x2="44" y2="40" stroke="rgba(90,180,212,0.3)" strokeWidth="1"/>
                    <polyline points="8,16 17,20 26,24 35,18 43,12" stroke="rgba(90,180,212,0.8)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" fill="none"/>
                    <circle cx="8"  cy="16" r="2.5" fill="rgba(90,180,212,0.5)"/>
                    <circle cx="17" cy="20" r="2.5" fill="rgba(90,180,212,0.5)"/>
                    <circle cx="26" cy="24" r="2.5" fill="rgba(90,180,212,0.5)"/>
                    <circle cx="35" cy="18" r="2.5" fill="rgba(90,180,212,0.5)"/>
                    <circle cx="43" cy="12" r="3"   fill="rgba(90,180,212,1)"/>
                    <line x1="8" y1="28" x2="44" y2="28" stroke="rgba(90,180,212,0.08)" strokeWidth="1" strokeDasharray="3 3"/>
                  </svg>
                </div>
                <span className="suite-card-tag">Health Tracker</span>
                <h2 className="suite-card-name">KordaTracker</h2>
                <p className="suite-card-tagline">// measure_body.track_progress()</p>
                <p className="suite-card-desc">Clinical-grade body composition tracking. Log weight, measurements, and progress photos daily. See the data behind the changes — no guesswork, no motivation speeches.</p>
                <ul className="suite-card-features">
                  {["Daily weigh-ins with 7-day rolling averages","Body measurements — waist, chest, hips, arms","Progress photo timeline with lightbox viewer","Caloric intake vs deficit tracking","Goal projections & in-depth trend analysis"].map(f => (
                    <li key={f}><span className="suite-feat-dot" />{f}</li>
                  ))}
                </ul>
              </div>
              <div className="suite-card-cta">Open KordaTracker <span className="suite-cta-arrow">→</span></div>
              <svg className="suite-card-deco" viewBox="0 0 220 140" fill="none">
                <polyline points="0,20 40,34 80,44 120,58 160,50 200,65 220,78" stroke="rgba(90,180,212,1)" strokeWidth="2" fill="none"/>
              </svg>
            </Link>

          </div>
        </section>

        {/* FOOTER */}
        <footer className="suite-footer">
          <div className="suite-footer-logo">Korda<sup style={{ fontSize: "0.5rem", color: "rgba(232,230,225,0.2)", marginLeft: 1 }}>™</sup></div>
          <div className="suite-footer-links">
            <a href="#">Privacy</a>
            <a href="#">Terms</a>
            <a href="#">Contact</a>
          </div>
          <p className="suite-footer-copy">© 2025 Korda™. All rights reserved.</p>
        </footer>
      </div>
    </div>
  );
}
