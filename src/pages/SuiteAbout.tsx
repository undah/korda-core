// src/pages/About.tsx
import React, { useEffect } from "react";
import { Link } from "react-router-dom";

export default function About() {
  useEffect(() => {
    const link = document.createElement("link");
    link.href = "https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,400;0,700;1,400&family=IBM+Plex+Mono:wght@400;500&family=DM+Sans:wght@300;400;500&display=swap";
    link.rel = "stylesheet";
    document.head.appendChild(link);

    const style = document.createElement("style");
    style.id = "about-global";
    style.textContent = `
      body.about-page { overflow: hidden; }
      .about-portal { position: fixed; inset: 0; z-index: 9999; overflow-y: auto; background: #080809; }
      .about-root { min-height: 100vh; background: #080809; color: #e8e6e1; font-family: 'DM Sans', sans-serif; font-weight: 300; }
      .about-root *, .about-root *::before, .about-root *::after { box-sizing: border-box; margin: 0; padding: 0; }

      .about-noise { position: fixed; inset: 0; z-index: 0; pointer-events: none;
        background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.88' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='0.04'/%3E%3C/svg%3E");
        opacity: .45; }

      /* NAV */
      .about-nav { position: fixed; top: 0; left: 0; right: 0; z-index: 10000; display: flex; align-items: center; justify-content: space-between; padding: 1.4rem 4rem; border-bottom: 1px solid rgba(255,255,255,0.04); background: rgba(8,8,9,0.88); backdrop-filter: blur(20px); }
      .about-nav-logo { font-family: 'Playfair Display', serif; font-size: 1.1rem; font-weight: 400; color: #e8e6e1; text-decoration: none; }
      .about-nav-logo sup { font-size: 0.5rem; color: rgba(232,230,225,0.3); vertical-align: super; margin-left: 1px; }
      .about-nav-links { display: flex; gap: 2.5rem; align-items: center; }
      .about-nav-links a { font-size: 0.75rem; letter-spacing: 0.12em; text-transform: uppercase; color: rgba(232,230,225,0.35); text-decoration: none; transition: color 0.2s; }
      .about-nav-links a:hover { color: #e8e6e1; }
      .about-nav-links a.active { color: #e8e6e1; }

      /* CONTENT */
      .about-content { position: relative; z-index: 1; max-width: 900px; margin: 0 auto; padding: 10rem 4rem 8rem; }

      .about-eyebrow { font-family: 'IBM Plex Mono', monospace; font-size: 0.62rem; letter-spacing: 0.28em; text-transform: uppercase; color: rgba(232,230,225,0.25); margin-bottom: 2rem; display: flex; align-items: center; gap: 0.75rem; }
      .about-eyebrow::before { content: '//'; color: rgba(232,230,225,0.15); }

      .about-h1 { font-family: 'Playfair Display', serif; font-size: clamp(2.5rem, 5vw, 4.5rem); font-weight: 400; line-height: 1.08; letter-spacing: -0.01em; margin-bottom: 3rem; }
      .about-h1 em { font-style: italic; color: rgba(232,230,225,0.35); }

      .about-divider { height: 1px; background: rgba(255,255,255,0.06); margin: 4rem 0; }

      .about-section { margin-bottom: 4rem; }
      .about-section-label { font-family: 'IBM Plex Mono', monospace; font-size: 0.6rem; letter-spacing: 0.25em; text-transform: uppercase; color: rgba(232,230,225,0.2); margin-bottom: 1.5rem; }
      .about-section-title { font-family: 'Playfair Display', serif; font-size: 1.8rem; font-weight: 400; margin-bottom: 1.25rem; line-height: 1.2; }
      .about-section-title em { font-style: italic; color: rgba(232,230,225,0.4); }
      .about-p { font-size: 1rem; line-height: 1.95; color: rgba(232,230,225,0.55); margin-bottom: 1.25rem; }
      .about-p:last-child { margin-bottom: 0; }

      /* values grid */
      .about-values { display: grid; grid-template-columns: repeat(3, 1fr); gap: 2px; margin-top: 3rem; }
      .about-value { background: #0e0e10; padding: 2rem; border-top: 1px solid rgba(255,255,255,0.06); }
      .about-value-num { font-family: 'IBM Plex Mono', monospace; font-size: 0.6rem; letter-spacing: 0.2em; color: rgba(232,230,225,0.2); margin-bottom: 1rem; }
      .about-value-title { font-family: 'Playfair Display', serif; font-size: 1.1rem; font-weight: 400; margin-bottom: 0.6rem; }
      .about-value-desc { font-size: 0.82rem; line-height: 1.75; color: rgba(232,230,225,0.4); }

      /* quote */
      .about-quote { border-left: 1px solid rgba(232,230,225,0.12); padding-left: 2rem; margin: 3rem 0; }
      .about-quote p { font-family: 'Playfair Display', serif; font-size: 1.4rem; font-style: italic; font-weight: 400; line-height: 1.6; color: rgba(232,230,225,0.5); }
      .about-quote cite { display: block; margin-top: 1rem; font-family: 'IBM Plex Mono', monospace; font-size: 0.6rem; letter-spacing: 0.2em; text-transform: uppercase; color: rgba(232,230,225,0.2); font-style: normal; }

      /* cta */
      .about-cta { margin-top: 5rem; padding-top: 3rem; border-top: 1px solid rgba(255,255,255,0.06); display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 2rem; }
      .about-cta-text { font-family: 'Playfair Display', serif; font-size: 1.6rem; font-weight: 400; }
      .about-cta-text em { font-style: italic; color: rgba(232,230,225,0.35); }
      .about-cta-btn { font-family: 'IBM Plex Mono', monospace; font-size: 0.75rem; letter-spacing: 0.1em; text-transform: uppercase; background: #e8e6e1; color: #080809; padding: 0.9rem 2.4rem; text-decoration: none; font-weight: 500; transition: opacity 0.2s; white-space: nowrap; }
      .about-cta-btn:hover { opacity: 0.85; }

      /* footer */
      .about-footer { position: relative; z-index: 1; border-top: 1px solid rgba(255,255,255,0.04); padding: 2.5rem 4rem; display: flex; align-items: center; justify-content: space-between; max-width: 1300px; margin: 0 auto; }
      .about-footer-logo { font-family: 'Playfair Display', serif; font-size: 0.9rem; color: rgba(232,230,225,0.3); }
      .about-footer-copy { font-family: 'IBM Plex Mono', monospace; font-size: 0.58rem; letter-spacing: 0.12em; color: rgba(232,230,225,0.15); }
      .about-footer-links { display: flex; gap: 2rem; }
      .about-footer-links a { font-size: 0.72rem; color: rgba(232,230,225,0.2); text-decoration: none; transition: color 0.2s; }
      .about-footer-links a:hover { color: rgba(232,230,225,0.5); }

      @keyframes about-fadeUp { from { opacity: 0; transform: translateY(16px); } to { opacity: 1; transform: translateY(0); } }
      .about-content { animation: about-fadeUp 0.6s ease both; }

      @media (max-width: 768px) {
        .about-nav { padding: 1rem 1.5rem; }
        .about-nav-links { display: none; }
        .about-content { padding: 8rem 1.5rem 5rem; }
        .about-values { grid-template-columns: 1fr; }
        .about-cta { flex-direction: column; }
        .about-footer { flex-direction: column; gap: 1.5rem; text-align: center; padding: 2rem 1.5rem; }
        .about-footer-links { justify-content: center; }
      }
    `;
    document.head.appendChild(style);
    document.body.classList.add("about-page");
    return () => {
      document.head.removeChild(link);
      const el = document.getElementById("about-global");
      if (el) document.head.removeChild(el);
      document.body.classList.remove("about-page");
    };
  }, []);

  return (
    <div className="about-portal">
      <div className="about-root">
        <div className="about-noise" />

        {/* NAV */}
        <nav className="about-nav">
          <Link to="/" className="about-nav-logo">Korda<sup>™</sup></Link>
          <div className="about-nav-links">
            <Link to="/about" className="active">About</Link>
            <Link to="/pricing">Pricing</Link>
            <Link to="/">← Suite</Link>
          </div>
        </nav>

        {/* CONTENT */}
        <div className="about-content">
          <p className="about-eyebrow">About Korda</p>
          <h1 className="about-h1">
            Built for people who<br />
            measure <em>everything.</em>
          </h1>

          <div className="about-section">
            <p className="about-section-label">The story</p>
            <p className="about-p">
              Korda started with a simple frustration — the best traders and the most disciplined people share one thing in common: they track everything. But the tools to do it were scattered, generic, or built for institutions rather than individuals.
            </p>
            <p className="about-p">
              We built Korda as a suite of precision tools for people who take their performance seriously. Whether you're a discretionary trader trying to identify the patterns behind your results, or someone tracking body composition with clinical precision — the principle is the same: data beats memory, and structure beats intention.
            </p>
          </div>

          <div className="about-quote">
            <p>"The traders and athletes who win aren't the most talented — they're the ones who measure with the most precision."</p>
            <cite>— Korda™ design principle</cite>
          </div>

          <div className="about-divider" />

          <div className="about-section">
            <p className="about-section-label">The mission</p>
            <h2 className="about-section-title">Give individuals the tools that <em>institutions use.</em></h2>
            <p className="about-p">
              Professional trading desks have risk systems, performance analysts, and structured review processes. Elite athletes have coaches, biomechanists, and data teams. Individual performers have spreadsheets and good intentions.
            </p>
            <p className="about-p">
              Korda closes that gap. We build tools that bring structure, measurement, and honest feedback to people who are serious about improving — without the complexity or cost of enterprise software.
            </p>
          </div>

          <div className="about-divider" />

          <div className="about-section">
            <p className="about-section-label">What we value</p>
            <div className="about-values">
              <div className="about-value">
                <p className="about-value-num">01</p>
                <h3 className="about-value-title">Precision over noise</h3>
                <p className="about-value-desc">Every feature we build has to make your data clearer or your review faster. We cut everything else.</p>
              </div>
              <div className="about-value">
                <p className="about-value-num">02</p>
                <h3 className="about-value-title">Honesty over comfort</h3>
                <p className="about-value-desc">Good data tells you what you don't want to hear. We build for people who want to know the truth about their performance.</p>
              </div>
              <div className="about-value">
  <p className="about-value-num">06</p>
  <h3 className="about-value-title">Privacy by default</h3>
  <p className="about-value-desc">Your performance data is personal. We never sell it, never share it, and never use it to train models. It belongs to you.</p>
</div>
              <div className="about-value">
                <p className="about-value-num">03</p>
                <h3 className="about-value-title">Tools, not motivation</h3>
                <p className="about-value-desc">We don't send push notifications telling you to believe in yourself. We give you the data to make better decisions.</p>
              </div>
              <div className="about-value">
                <p className="about-value-num">04</p>
                <h3 className="about-value-title">Built to last</h3>
                <p className="about-value-desc">Your journal and your progress data are yours. We build with long-term data integrity as a core requirement, not an afterthought.</p>
              </div>
              <div className="about-value">
                <p className="about-value-num">05</p>
                <h3 className="about-value-title">Serious aesthetics</h3>
                <p className="about-value-desc">Premium tools should look and feel premium. Design isn't decoration — it's how we signal that we take your work seriously.</p>
              </div>
            </div>
          </div>

          {/* CTA */}
          <div className="about-cta">
            <p className="about-cta-text">Ready to start <em>measuring?</em></p>
            <Link to="/pricing" className="about-cta-btn">View pricing →</Link>
          </div>
        </div>

        {/* FOOTER */}
        <footer className="about-footer">
          <div className="about-footer-logo">Korda<sup style={{ fontSize: "0.5rem", color: "rgba(232,230,225,0.2)", marginLeft: 1 }}>™</sup></div>
          <div className="about-footer-links">
            <a href="#">Privacy</a>
            <a href="#">Terms</a>
            <a href="#">Contact</a>
          </div>
          <p className="about-footer-copy">© 2025 Korda™. All rights reserved.</p>
        </footer>
      </div>
    </div>
  );
}
