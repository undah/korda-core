// src/pages/Pricing.tsx
import React, { useEffect } from "react";
import { Link } from "react-router-dom";

const FREE_FEATURES = [
  "Korda Trading — up to 50 trades/month",
  "KordaTracker — unlimited check-ins",
  "Basic dashboard & stats",
  "Journal entries",
  "Progress photos (up to 20)",
  "7-day data retention on analytics",
];

const PRO_FEATURES = [
  "Everything in Free",
  "Korda Trading — unlimited trades",
  "Full analytics & performance breakdown",
  "CSV import & export",
  "Advanced psychology tracking",
  "KordaTracker — full analysis & projections",
  "Unlimited progress photos",
  "Caloric deficit tracking & macro logging",
  "Session logs & charting tools",
  "Priority support",
  "Early access to new features",
];

export default function Pricing() {
  useEffect(() => {
    const link = document.createElement("link");
    link.href = "https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,400;0,700;1,400&family=IBM+Plex+Mono:wght@400;500&family=DM+Sans:wght@300;400;500&display=swap";
    link.rel = "stylesheet";
    document.head.appendChild(link);

    const style = document.createElement("style");
    style.id = "pricing-global";
    style.textContent = `
      body.pricing-page { overflow: hidden; }
      .pricing-portal { position: fixed; inset: 0; z-index: 9999; overflow-y: auto; background: #080809; }
      .pricing-root { min-height: 100vh; background: #080809; color: #e8e6e1; font-family: 'DM Sans', sans-serif; font-weight: 300; }
      .pricing-root *, .pricing-root *::before, .pricing-root *::after { box-sizing: border-box; margin: 0; padding: 0; }

      .pricing-noise { position: fixed; inset: 0; z-index: 0; pointer-events: none;
        background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.88' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='0.04'/%3E%3C/svg%3E");
        opacity: .45; }

      /* NAV */
      .pricing-nav { position: fixed; top: 0; left: 0; right: 0; z-index: 10000; display: flex; align-items: center; justify-content: space-between; padding: 1.4rem 4rem; border-bottom: 1px solid rgba(255,255,255,0.04); background: rgba(8,8,9,0.88); backdrop-filter: blur(20px); }
      .pricing-nav-logo { font-family: 'Playfair Display', serif; font-size: 1.1rem; font-weight: 400; color: #e8e6e1; text-decoration: none; }
      .pricing-nav-logo sup { font-size: 0.5rem; color: rgba(232,230,225,0.3); vertical-align: super; margin-left: 1px; }
      .pricing-nav-links { display: flex; gap: 2.5rem; align-items: center; }
      .pricing-nav-links a { font-size: 0.75rem; letter-spacing: 0.12em; text-transform: uppercase; color: rgba(232,230,225,0.35); text-decoration: none; transition: color 0.2s; }
      .pricing-nav-links a:hover { color: #e8e6e1; }
      .pricing-nav-links a.active { color: #e8e6e1; }

      /* HERO */
      .pricing-hero { position: relative; z-index: 1; text-align: center; padding: 10rem 2rem 5rem; }
      .pricing-eyebrow { font-family: 'IBM Plex Mono', monospace; font-size: 0.62rem; letter-spacing: 0.28em; text-transform: uppercase; color: rgba(232,230,225,0.25); margin-bottom: 1.5rem; display: flex; align-items: center; gap: 0.75rem; justify-content: center; }
      .pricing-eyebrow::before, .pricing-eyebrow::after { content: ''; display: block; width: 24px; height: 1px; background: rgba(232,230,225,0.1); }
      .pricing-h1 { font-family: 'Playfair Display', serif; font-size: clamp(2.5rem, 5vw, 4rem); font-weight: 400; line-height: 1.1; margin-bottom: 1.25rem; }
      .pricing-h1 em { font-style: italic; color: rgba(232,230,225,0.35); }
      .pricing-sub { font-size: 1rem; color: rgba(232,230,225,0.45); line-height: 1.8; max-width: 480px; margin: 0 auto; }

      /* CARDS */
      .pricing-cards { position: relative; z-index: 1; display: grid; grid-template-columns: 1fr 1fr; gap: 3px; max-width: 1000px; margin: 4rem auto 0; padding: 0 4rem; }

      .pricing-card { background: #0e0e10; padding: 3rem; border-top: 1px solid rgba(255,255,255,0.06); position: relative; }
      .pricing-card-pro { background: #0c0f0e; border-top: 1px solid rgba(232,230,225,0.25); }

      .pricing-card-tag { font-family: 'IBM Plex Mono', monospace; font-size: 0.6rem; letter-spacing: 0.2em; text-transform: uppercase; margin-bottom: 1.5rem; display: block; }
      .pricing-card .pricing-card-tag { color: rgba(232,230,225,0.3); }
      .pricing-card-pro .pricing-card-tag { color: rgba(232,230,225,0.6); }

      .pricing-card-name { font-family: 'Playfair Display', serif; font-size: 2rem; font-weight: 400; margin-bottom: 0.5rem; }
      .pricing-card-pro .pricing-card-name em { font-style: italic; }

      .pricing-price { display: flex; align-items: baseline; gap: 0.3rem; margin-bottom: 0.5rem; }
      .pricing-amount { font-family: 'IBM Plex Mono', monospace; font-size: 2.8rem; font-weight: 500; color: #e8e6e1; }
      .pricing-card-pro .pricing-amount { color: #e8e6e1; }
      .pricing-period { font-family: 'IBM Plex Mono', monospace; font-size: 0.72rem; color: rgba(232,230,225,0.3); }

      .pricing-trial { font-family: 'IBM Plex Mono', monospace; font-size: 0.62rem; letter-spacing: 0.12em; color: rgba(232,230,225,0.35); margin-bottom: 2rem; }
      .pricing-card-pro .pricing-trial { color: rgba(232,230,225,0.5); }

      .pricing-divider { height: 1px; background: rgba(255,255,255,0.05); margin-bottom: 2rem; }

      .pricing-features { list-style: none; display: flex; flex-direction: column; gap: 0.75rem; margin-bottom: 2.5rem; }
      .pricing-features li { font-size: 0.85rem; color: rgba(232,230,225,0.45); display: flex; align-items: flex-start; gap: 0.75rem; line-height: 1.5; }
      .pricing-check { flex-shrink: 0; width: 14px; height: 14px; margin-top: 1px; }
      .pricing-card .pricing-check { color: rgba(232,230,225,0.25); }
      .pricing-card-pro .pricing-check { color: #e8e6e1; }
      .pricing-card-pro .pricing-features li { color: rgba(232,230,225,0.6); }

      .pricing-btn { display: block; width: 100%; text-align: center; font-family: 'IBM Plex Mono', monospace; font-size: 0.75rem; letter-spacing: 0.1em; text-transform: uppercase; padding: 0.9rem 2rem; text-decoration: none; transition: all 0.2s; cursor: pointer; border: none; }
      .pricing-btn-free { background: transparent; border: 1px solid rgba(255,255,255,0.1); color: rgba(232,230,225,0.5); }
      .pricing-btn-free:hover { border-color: rgba(255,255,255,0.25); color: #e8e6e1; }
      .pricing-btn-pro { background: #e8e6e1; color: #080809; font-weight: 500; }
      .pricing-btn-pro:hover { opacity: 0.88; }

      /* most popular badge */
      .pricing-badge { position: absolute; top: -1px; right: 2rem; font-family: 'IBM Plex Mono', monospace; font-size: 0.58rem; letter-spacing: 0.15em; text-transform: uppercase; background: #e8e6e1; color: #080809; padding: 0.3rem 0.8rem; font-weight: 500; }

      /* FAQ */
      .pricing-faq { position: relative; z-index: 1; max-width: 700px; margin: 6rem auto 0; padding: 0 4rem 8rem; }
      .pricing-faq-title { font-family: 'Playfair Display', serif; font-size: 1.8rem; font-weight: 400; margin-bottom: 3rem; text-align: center; }
      .pricing-faq-title em { font-style: italic; color: rgba(232,230,225,0.35); }
      .pricing-faq-item { border-top: 1px solid rgba(255,255,255,0.05); padding: 1.5rem 0; }
      .pricing-faq-q { font-size: 0.95rem; font-weight: 400; color: rgba(232,230,225,0.8); margin-bottom: 0.75rem; }
      .pricing-faq-a { font-size: 0.85rem; line-height: 1.8; color: rgba(232,230,225,0.4); }

      /* footer */
      .pricing-footer { position: relative; z-index: 1; border-top: 1px solid rgba(255,255,255,0.04); padding: 2.5rem 4rem; display: flex; align-items: center; justify-content: space-between; max-width: 1300px; margin: 0 auto; }
      .pricing-footer-logo { font-family: 'Playfair Display', serif; font-size: 0.9rem; color: rgba(232,230,225,0.3); }
      .pricing-footer-copy { font-family: 'IBM Plex Mono', monospace; font-size: 0.58rem; letter-spacing: 0.12em; color: rgba(232,230,225,0.15); }
      .pricing-footer-links { display: flex; gap: 2rem; }
      .pricing-footer-links a { font-size: 0.72rem; color: rgba(232,230,225,0.2); text-decoration: none; transition: color 0.2s; }
      .pricing-footer-links a:hover { color: rgba(232,230,225,0.5); }

      @keyframes pricing-fadeUp { from { opacity: 0; transform: translateY(16px); } to { opacity: 1; transform: translateY(0); } }
      .pricing-hero { animation: pricing-fadeUp 0.5s ease both; }
      .pricing-cards { animation: pricing-fadeUp 0.5s 0.1s ease both; }
      .pricing-faq { animation: pricing-fadeUp 0.5s 0.2s ease both; }

      @media (max-width: 768px) {
        .pricing-nav { padding: 1rem 1.5rem; }
        .pricing-nav-links { display: none; }
        .pricing-cards { grid-template-columns: 1fr; padding: 0 1.5rem; }
        .pricing-faq { padding: 0 1.5rem 5rem; }
        .pricing-footer { flex-direction: column; gap: 1.5rem; text-align: center; padding: 2rem 1.5rem; }
        .pricing-footer-links { justify-content: center; }
      }
    `;
    document.head.appendChild(style);
    document.body.classList.add("pricing-page");
    return () => {
      document.head.removeChild(link);
      const el = document.getElementById("pricing-global");
      if (el) document.head.removeChild(el);
      document.body.classList.remove("pricing-page");
    };
  }, []);

  const CheckIcon = ({ pro }: { pro?: boolean }) => (
    <svg className="pricing-check" viewBox="0 0 14 14" fill="none" style={{ color: pro ? "#e8e6e1" : "rgba(232,230,225,0.25)" }}>
      <path d="M2 7l3.5 3.5L12 3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );

  return (
    <div className="pricing-portal">
      <div className="pricing-root">
        <div className="pricing-noise" />

        {/* NAV */}
        <nav className="pricing-nav">
          <Link to="/" className="pricing-nav-logo">Korda<sup>™</sup></Link>
          <div className="pricing-nav-links">
            <Link to="/about">About</Link>
            <Link to="/pricing" className="active">Pricing</Link>
            <Link to="/">← Suite</Link>
          </div>
        </nav>

        {/* HERO */}
        <div className="pricing-hero">
          <p className="pricing-eyebrow">Pricing</p>
          <h1 className="pricing-h1">Simple. <em>Honest.</em> Flat.</h1>
          <p className="pricing-sub">One price covers both products. No per-seat fees, no hidden limits, no annual lock-in.</p>
        </div>

        {/* CARDS */}
        <div className="pricing-cards">

          {/* FREE */}
          <div className="pricing-card">
            <span className="pricing-card-tag">Free plan</span>
            <h2 className="pricing-card-name">Free</h2>
            <div className="pricing-price">
              <span className="pricing-amount">$0</span>
              <span className="pricing-period">/ forever</span>
            </div>
            <p className="pricing-trial">No credit card required</p>
            <div className="pricing-divider" />
            <ul className="pricing-features">
              {FREE_FEATURES.map(f => (
                <li key={f}><CheckIcon />{f}</li>
              ))}
            </ul>
            <Link to="/login" className="pricing-btn pricing-btn-free">Get started free</Link>
          </div>

          {/* PRO */}
          <div className="pricing-card pricing-card-pro">
            <span className="pricing-badge">Most popular</span>
            <span className="pricing-card-tag">Pro plan</span>
            <h2 className="pricing-card-name"><em>Pro</em></h2>
            <div className="pricing-price">
              <span className="pricing-amount">$99</span>
              <span className="pricing-period">/ month</span>
            </div>
            <p className="pricing-trial">14-day free trial — cancel anytime</p>
            <div className="pricing-divider" />
            <ul className="pricing-features">
              {PRO_FEATURES.map(f => (
                <li key={f}><CheckIcon pro />{f}</li>
              ))}
            </ul>
            <Link to="/login" className="pricing-btn pricing-btn-pro">Start free trial →</Link>
          </div>

        </div>

        {/* FAQ */}
        <div className="pricing-faq">
          <h2 className="pricing-faq-title">Common <em>questions</em></h2>

          {[
            {
              q: "Does the free trial require a credit card?",
              a: "No. You can start your 14-day Pro trial without entering any payment details. We'll ask for a card before the trial ends if you want to continue."
            },
            {
              q: "Does the $99/month cover both Korda and KordaTracker?",
              a: "Yes — one subscription gives you full Pro access to both products. There are no separate plans or add-ons."
            },
            {
              q: "Can I cancel anytime?",
              a: "Yes. Cancel from your settings page at any time. You'll keep Pro access until the end of your billing period."
            },
            {
              q: "What happens to my data if I downgrade?",
              a: "Your data is always yours. If you downgrade to Free, your data is preserved — you just lose access to Pro features. You can upgrade again at any time."
            },
            {
              q: "Is there a discount for annual billing?",
              a: "Not yet — we're working on it. For now, monthly is the only option and there's no lock-in."
            },
          ].map(item => (
            <div key={item.q} className="pricing-faq-item">
              <p className="pricing-faq-q">{item.q}</p>
              <p className="pricing-faq-a">{item.a}</p>
            </div>
          ))}
        </div>

        {/* FOOTER */}
        <footer className="pricing-footer">
          <div className="pricing-footer-logo">Korda<sup style={{ fontSize: "0.5rem", color: "rgba(232,230,225,0.2)", marginLeft: 1 }}>™</sup></div>
          <div className="pricing-footer-links">
            <a href="#">Privacy</a>
            <a href="#">Terms</a>
            <a href="#">Contact</a>
          </div>
          <p className="pricing-footer-copy">© 2025 Korda™. All rights reserved.</p>
        </footer>
      </div>
    </div>
  );
}
