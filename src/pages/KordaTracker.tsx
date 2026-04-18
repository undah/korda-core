import { useEffect } from "react";
import { Link } from "react-router-dom";

// ─── types ────────────────────────────────────────────────────────────────────

interface HeroStat {
  val: string;
  lbl: string;
}

interface JourneyStep {
  num: string;
  title: string;
  desc: string;
  icon: React.ReactNode;
}

interface FeatureCard {
  title: string;
  desc: string;
  icon: React.ReactNode;
}

interface RingCard {
  label: string;
  value: string;
  meta: string;
  dasharray: string;
}

// ─── data ─────────────────────────────────────────────────────────────────────

const heroStats: HeroStat[] = [
  { val: "840k+", lbl: "Check-ins recorded" },
  { val: "−12.4 kg", lbl: "Avg. user loss (90d)" },
  { val: "91%", lbl: "Users hit first goal" },
  { val: "Daily", lbl: "Trend analysis" },
];

const journeySteps: JourneyStep[] = [
  {
    num: "01",
    title: "Log your data",
    desc: "Daily weigh-ins, body measurements, and optional photos. Takes under 60 seconds. Consistency is everything — we make it frictionless.",
    icon: (
      <svg viewBox="0 0 28 28" fill="none" style={{ width: 28, height: 28 }}>
        <rect x="4" y="4" width="20" height="20" rx="2" stroke="rgba(90,180,212,0.6)" strokeWidth="1.2" />
        <line x1="9" y1="14" x2="19" y2="14" stroke="rgba(90,180,212,0.6)" strokeWidth="1.2" />
        <line x1="14" y1="9" x2="14" y2="19" stroke="rgba(90,180,212,0.6)" strokeWidth="1.2" />
      </svg>
    ),
  },
  {
    num: "02",
    title: "See your trends",
    desc: "Rolling averages filter out daily noise. See the actual direction of your progress — not the chaos of day-to-day fluctuation.",
    icon: (
      <svg viewBox="0 0 28 28" fill="none" style={{ width: 28, height: 28 }}>
        <polyline points="4,22 10,14 16,17 22,8" stroke="rgba(90,180,212,0.6)" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
        <circle cx="22" cy="8" r="2" fill="rgba(90,180,212,0.6)" />
      </svg>
    ),
  },
  {
    num: "03",
    title: "Hit your targets",
    desc: "Set a goal weight or measurement target. KordaTracker projects your timeline based on real trend data — not optimistic guesses.",
    icon: (
      <svg viewBox="0 0 28 28" fill="none" style={{ width: 28, height: 28 }}>
        <circle cx="14" cy="14" r="9" stroke="rgba(90,180,212,0.6)" strokeWidth="1.2" />
        <path d="M14 9 L14 14 L18 16" stroke="rgba(90,180,212,0.6)" strokeWidth="1.2" strokeLinecap="round" />
      </svg>
    ),
  },
];

const featureCards: FeatureCard[] = [
  {
    title: "Daily weigh-ins",
    desc: "Log your weight each day. Rolling 7-day averages smooth out water retention, meals, and natural fluctuation so you see real progress.",
    icon: (
      <svg viewBox="0 0 36 36" fill="none" style={{ width: 36, height: 36 }}>
        <rect x="4" y="4" width="28" height="28" rx="3" stroke="rgba(90,180,212,0.5)" strokeWidth="1.2" />
        <line x1="4" y1="12" x2="32" y2="12" stroke="rgba(90,180,212,0.3)" strokeWidth="1" />
        <line x1="12" y1="4" x2="12" y2="32" stroke="rgba(90,180,212,0.3)" strokeWidth="1" />
        <circle cx="22" cy="22" r="4" fill="rgba(90,180,212,0.2)" stroke="rgba(90,180,212,0.6)" strokeWidth="1" />
      </svg>
    ),
  },
  {
    title: "Trend analysis",
    desc: "Your actual trajectory calculated from real data. Know exactly if you're ahead, on track, or need to adjust — before it's too late.",
    icon: (
      <svg viewBox="0 0 36 36" fill="none" style={{ width: 36, height: 36 }}>
        <line x1="6" y1="30" x2="6" y2="6" stroke="rgba(90,180,212,0.4)" strokeWidth="1" />
        <line x1="6" y1="30" x2="32" y2="30" stroke="rgba(90,180,212,0.4)" strokeWidth="1" />
        <polyline points="6,24 12,20 18,22 24,14 30,10" stroke="rgba(90,180,212,0.7)" strokeWidth="1.5" fill="none" strokeLinecap="round" />
        <polyline points="6,24 12,20 18,22 24,14 30,10" stroke="rgba(90,180,212,0.12)" strokeWidth="8" fill="none" />
      </svg>
    ),
  },
  {
    title: "Goal projections",
    desc: "Set a target. KordaTracker calculates your estimated arrival date based on your current rate of change. Dynamic — updates as you do.",
    icon: (
      <svg viewBox="0 0 36 36" fill="none" style={{ width: 36, height: 36 }}>
        <circle cx="18" cy="18" r="12" stroke="rgba(90,180,212,0.3)" strokeWidth="1" />
        <path d="M18 6 A12 12 0 0 1 30 18" stroke="rgba(90,180,212,0.8)" strokeWidth="1.5" strokeLinecap="round" />
        <circle cx="18" cy="18" r="2" fill="rgba(90,180,212,0.6)" />
      </svg>
    ),
  },
  {
    title: "Body measurements",
    desc: "Waist, chest, arms, hips, thighs. Track multiple measurement points over time. Sometimes the scale lies — measurements don't.",
    icon: (
      <svg viewBox="0 0 36 36" fill="none" style={{ width: 36, height: 36 }}>
        <rect x="8" y="4" width="20" height="28" rx="2" stroke="rgba(90,180,212,0.5)" strokeWidth="1.2" />
        <line x1="12" y1="12" x2="24" y2="12" stroke="rgba(90,180,212,0.4)" strokeWidth="1" />
        <line x1="12" y1="17" x2="24" y2="17" stroke="rgba(90,180,212,0.4)" strokeWidth="1" />
        <line x1="12" y1="22" x2="18" y2="22" stroke="rgba(90,180,212,0.4)" strokeWidth="1" />
      </svg>
    ),
  },
  {
    title: "Progress photos",
    desc: "Upload front, side, and back photos at any interval you choose. Visual timeline of your transformation — private, secure, yours.",
    icon: (
      <svg viewBox="0 0 36 36" fill="none" style={{ width: 36, height: 36 }}>
        <rect x="6" y="8" width="24" height="20" rx="2" stroke="rgba(90,180,212,0.5)" strokeWidth="1.2" />
        <circle cx="13" cy="15" r="3" stroke="rgba(90,180,212,0.5)" strokeWidth="1" />
        <path d="M6 28 Q13 20 20 24 Q26 28 30 22" stroke="rgba(90,180,212,0.5)" strokeWidth="1" fill="none" />
        <rect x="20" y="4" width="10" height="6" rx="1" fill="rgba(90,180,212,0.1)" stroke="rgba(90,180,212,0.4)" strokeWidth="1" />
      </svg>
    ),
  },
];

const ringCards: RingCard[] = [
  { label: "Goal progress",   value: "60%", meta: "12.4 of 20 kg",  dasharray: "106 176" },
  { label: "Waist target",    value: "75%", meta: "84 → 80 cm",     dasharray: "132 176" },
  { label: "Check-in streak", value: "90",  meta: "days in a row",  dasharray: "158 176" },
  { label: "On-track score",  value: "84%", meta: "ahead of target", dasharray: "148 176" },
];

// ─── sub-components ────────────────────────────────────────────────────────────

function SectionLabel({ children, center = false }: { children: string; center?: boolean }) {
  return (
    <p style={{
      fontFamily: "'IBM Plex Mono', monospace",
      fontSize: "0.62rem",
      letterSpacing: "0.28em",
      textTransform: "uppercase",
      color: "rgba(90,180,212,0.5)",
      marginBottom: "1rem",
      display: "flex",
      alignItems: "center",
      gap: "0.75rem",
      justifyContent: center ? "center" : "flex-start",
    }}>
      <span style={{ color: "rgba(221,232,237,0.25)" }}>//</span>
      {children}
    </p>
  );
}

function ProgressRing({ ring }: { ring: RingCard }) {
  return (
    <div style={{ background: "#0c1217", padding: "2rem", textAlign: "center" }}>
      <p style={{
        fontFamily: "'IBM Plex Mono', monospace",
        fontSize: "0.62rem",
        letterSpacing: "0.18em",
        textTransform: "uppercase",
        color: "rgba(221,232,237,0.25)",
        marginBottom: "1rem",
      }}>
        {ring.label}
      </p>
      <div style={{ position: "relative", width: 72, height: 72, margin: "0 auto 1rem" }}>
        <svg viewBox="0 0 72 72" style={{ width: "100%", height: "100%" }}>
          <circle cx="36" cy="36" r="28" fill="none" stroke="rgba(90,180,212,0.1)" strokeWidth="5" />
          <circle cx="36" cy="36" r="28" fill="none" stroke="rgba(90,180,212,0.75)"
            strokeWidth="5" strokeDasharray={ring.dasharray}
            strokeDashoffset="44" strokeLinecap="round" />
        </svg>
        <span style={{
          position: "absolute", inset: 0,
          display: "flex", alignItems: "center", justifyContent: "center",
          fontFamily: "'IBM Plex Mono', monospace",
          fontSize: "0.75rem", fontWeight: 500,
          color: "#5ab4d4",
        }}>
          {ring.value}
        </span>
      </div>
      <p style={{ fontSize: "0.78rem", color: "rgba(221,232,237,0.5)" }}>{ring.meta}</p>
    </div>
  );
}

// ─── main component ────────────────────────────────────────────────────────────

export default function KordaTracker() {

  // inject fonts + global page styles
  useEffect(() => {
    // fonts
    const link = document.createElement("link");
    link.href = "https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,400;0,700;1,400&family=IBM+Plex+Mono:wght@400;500&family=DM+Sans:wght@300;400;500&display=swap";
    link.rel = "stylesheet";
    document.head.appendChild(link);

    // page-level overrides
    const style = document.createElement("style");
    style.id = "kt-global";
    style.textContent = `
      .kt-root { background: #07090b; color: #dde8ed; font-family: 'DM Sans', sans-serif; font-weight: 300; overflow-x: hidden; min-height: 100vh; }
      .kt-root *, .kt-root *::before, .kt-root *::after { box-sizing: border-box; }
      .kt-noise { position: fixed; inset: 0; z-index: 0; pointer-events: none;
        background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='0.035'/%3E%3C/svg%3E");
        opacity: .5; }
      .kt-grid { position: fixed; inset: 0; z-index: 0; pointer-events: none;
        background-image: linear-gradient(rgba(90,180,212,0.025) 1px, transparent 1px), linear-gradient(90deg, rgba(90,180,212,0.025) 1px, transparent 1px);
        background-size: 60px 60px; }
      .kt-root section { position: relative; z-index: 1; }
      .kt-btn-primary { font-family: 'IBM Plex Mono', monospace; font-size: 0.75rem; letter-spacing: 0.1em; background: #5ab4d4; color: #07090b; padding: 0.9rem 2.4rem; text-decoration: none; font-weight: 500; transition: opacity 0.2s; display: inline-block; }
      .kt-btn-primary:hover { opacity: 0.85; }
      .kt-btn-ghost { font-family: 'IBM Plex Mono', monospace; font-size: 0.75rem; letter-spacing: 0.1em; color: rgba(221,232,237,0.5); text-decoration: none; border: 1px solid rgba(255,255,255,0.1); padding: 0.9rem 2rem; transition: color 0.2s, border-color 0.2s; display: inline-block; }
      .kt-btn-ghost:hover { color: #dde8ed; border-color: rgba(255,255,255,0.25); }
      .kt-nav-link { font-size: 0.75rem; letter-spacing: 0.14em; text-transform: uppercase; color: rgba(221,232,237,0.25); text-decoration: none; transition: color 0.2s; }
      .kt-nav-link:hover { color: #dde8ed; }
      .kt-nav-cta { font-family: 'IBM Plex Mono', monospace; font-size: 0.72rem; letter-spacing: 0.08em; color: #5ab4d4; text-decoration: none; border: 1px solid rgba(90,180,212,0.18); padding: 0.5rem 1.4rem; transition: background 0.2s, border-color 0.2s; }
      .kt-nav-cta:hover { background: rgba(90,180,212,0.08); border-color: rgba(90,180,212,0.5); }
      .kt-journey-step { background: #0c1217; padding: 2.5rem; position: relative; overflow: hidden; border-top: 1px solid rgba(90,180,212,0.12); }
      .kt-feature-card { background: #0c1217; padding: 2.5rem; border-top: 1px solid rgba(90,180,212,0.08); transition: background 0.3s; }
      .kt-feature-card:hover { background: #0f151a; }
      .kt-footer-link { font-size: 0.75rem; color: rgba(221,232,237,0.25); text-decoration: none; transition: color 0.2s; }
      .kt-footer-link:hover { color: #dde8ed; }
      @keyframes kt-fadeUp { from { opacity: 0; transform: translateY(24px); } to { opacity: 1; transform: translateY(0); } }
      .kt-anim-1 { animation: kt-fadeUp 0.7s ease both; }
      .kt-anim-2 { animation: kt-fadeUp 0.7s 0.12s ease both; }
      .kt-anim-3 { animation: kt-fadeUp 0.7s 0.22s ease both; }
      .kt-anim-4 { animation: kt-fadeUp 0.7s 0.32s ease both; }
      .kt-anim-5 { animation: kt-fadeUp 0.7s 0.42s ease both; }
      @media (max-width: 900px) {
        .kt-nav-links { display: none !important; }
        .kt-hero { padding: 0 1.5rem !important; }
        .kt-hero-data-strip { flex-wrap: wrap; gap: 2rem !important; }
        .kt-journey-grid, .kt-features-grid, .kt-features-grid-2 { grid-template-columns: 1fr !important; }
        .kt-ba-container { grid-template-columns: 1fr !important; }
        .kt-ring-strip { grid-template-columns: repeat(2,1fr) !important; }
        .kt-section { padding: 5rem 1.5rem !important; }
        .kt-footer-inner { flex-direction: column; gap: 1.5rem; text-align: center; padding: 2rem 1.5rem !important; }
        .kt-footer-links { justify-content: center !important; }
      }
    `;
    document.head.appendChild(style);

    return () => {
      document.head.removeChild(link);
      const el = document.getElementById("kt-global");
      if (el) document.head.removeChild(el);
    };
  }, []);

  return (
    <div className="kt-root">
      {/* background layers */}
      <div className="kt-noise" />
      <div className="kt-grid" />

      {/* ── NAV ── */}
      <nav style={{
        position: "fixed", top: 0, left: 0, right: 0, zIndex: 100,
        display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "1.2rem 4rem",
        borderBottom: "1px solid rgba(90,180,212,0.08)",
        background: "rgba(7,9,11,0.88)",
        backdropFilter: "blur(20px)",
      }}>
        <div style={{ display: "flex", alignItems: "baseline", gap: "0.5rem" }}>
          <span style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: "0.9rem", fontWeight: 500, letterSpacing: "0.05em", color: "#5ab4d4" }}>
            KordaTracker
          </span>
          <span style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: "0.7rem", color: "rgba(221,232,237,0.25)", letterSpacing: "0.05em" }}>™</span>
        </div>
        <div className="kt-nav-links" style={{ display: "flex", gap: "2.5rem", alignItems: "center" }}>
          <a href="#how" className="kt-nav-link">How it works</a>
          <a href="#features" className="kt-nav-link">Features</a>
          <a href="#data" className="kt-nav-link">Data</a>
          <Link to="/" className="kt-nav-link" style={{ color: "rgba(90,180,212,0.4)", fontSize: "0.7rem" }}>↗ Korda Suite</Link>
        </div>
        <Link to="/tracker/login" className="kt-nav-cta">Start tracking_</Link>
      </nav>

      {/* ── HERO ── */}
      <section className="kt-hero" style={{
        minHeight: "100vh", display: "flex", flexDirection: "column",
        alignItems: "flex-start", justifyContent: "center",
        padding: "0 4rem", maxWidth: 1200, margin: "0 auto",
      }}>
        <p className="kt-anim-1" style={{
          fontFamily: "'IBM Plex Mono',monospace",
          fontSize: "0.68rem", letterSpacing: "0.25em", textTransform: "uppercase",
          color: "rgba(90,180,212,0.5)", marginBottom: "2rem",
          display: "flex", alignItems: "center", gap: "1rem",
        }}>
          <span style={{ display: "block", width: 32, height: 1, background: "rgba(90,180,212,0.5)", flexShrink: 0 }} />
          KordaTracker™ — Body data, engineered
        </p>

        <h1 className="kt-anim-2" style={{
          fontFamily: "'Playfair Display',serif",
          fontSize: "clamp(3.2rem,7vw,6.5rem)",
          fontWeight: 400, lineHeight: 1.05,
          letterSpacing: "-0.02em", marginBottom: "1.8rem", maxWidth: 800,
        }}>
          Your body<br />runs on <em style={{ fontStyle: "italic", color: "rgba(90,180,212,0.5)" }}>data.</em><br />Start reading it.
        </h1>

        <p className="kt-anim-3" style={{
          fontSize: "1rem", fontWeight: 300, lineHeight: 1.9,
          color: "rgba(221,232,237,0.5)", maxWidth: 520, marginBottom: "3rem",
        }}>
          Clinical precision tracking for weight, measurements, and body composition. No motivation speeches — just numbers, trends, and the truth.
        </p>

        <div className="kt-anim-4" style={{ display: "flex", gap: "1rem", alignItems: "center", flexWrap: "wrap", marginBottom: "5rem" }}>
          <Link to="/tracker/login" className="kt-btn-primary">Begin tracking →</Link>
          <a href="#how" className="kt-btn-ghost">See how it works</a>
        </div>

        <div className="kt-anim-5 kt-hero-data-strip" style={{
          display: "flex", gap: "3rem", paddingTop: "2rem",
          borderTop: "1px solid rgba(90,180,212,0.1)", width: "100%",
        }}>
          {heroStats.map((s) => (
            <div key={s.lbl}>
              <span style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: "1.6rem", fontWeight: 500, color: "#5ab4d4", display: "block", marginBottom: "0.25rem" }}>
                {s.val}
              </span>
              <span style={{ fontSize: "0.72rem", letterSpacing: "0.15em", textTransform: "uppercase", color: "rgba(221,232,237,0.25)" }}>
                {s.lbl}
              </span>
            </div>
          ))}
        </div>
      </section>

      {/* ── HOW IT WORKS ── */}
      <section id="how" className="kt-section" style={{ padding: "8rem 4rem", maxWidth: 1200, margin: "0 auto" }}>
        <div style={{ marginBottom: "5rem" }}>
          <SectionLabel>How it works</SectionLabel>
          <h2 style={{ fontFamily: "'Playfair Display',serif", fontSize: "clamp(2rem,4vw,3.2rem)", fontWeight: 400, lineHeight: 1.15 }}>
            Log. Analyse.<br /><em style={{ fontStyle: "italic", color: "rgba(90,180,212,0.5)" }}>Transform.</em>
          </h2>
        </div>

        <div className="kt-journey-grid" style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 2, marginBottom: "6rem" }}>
          {journeySteps.map((step) => (
            <div key={step.num} className="kt-journey-step">
              <span style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: "3.5rem", fontWeight: 500, color: "rgba(90,180,212,0.06)", position: "absolute", top: "1rem", right: "1.5rem", lineHeight: 1 }}>
                {step.num}
              </span>
              <div style={{ marginBottom: "1.5rem" }}>{step.icon}</div>
              <h3 style={{ fontFamily: "'Playfair Display',serif", fontSize: "1.3rem", fontWeight: 400, marginBottom: "0.75rem" }}>{step.title}</h3>
              <p style={{ fontSize: "0.875rem", lineHeight: 1.8, color: "rgba(221,232,237,0.5)" }}>{step.desc}</p>
            </div>
          ))}
        </div>

        {/* Before / After */}
        <div className="kt-ba-container" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 2 }}>
          {/* Before */}
          <div style={{ background: "#0c1217", padding: "2.5rem" }}>
            <p style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: "0.65rem", letterSpacing: "0.2em", textTransform: "uppercase", color: "rgba(255,255,255,0.2)", marginBottom: "1.5rem" }}>// before</p>
            <div style={{ fontFamily: "'Playfair Display',serif", fontSize: "3.5rem", fontWeight: 400, lineHeight: 1, color: "rgba(255,255,255,0.2)", marginBottom: "0.3rem" }}>94.2</div>
            <p style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: "0.75rem", color: "rgba(221,232,237,0.25)", marginBottom: "1.5rem" }}>kg — Day 1</p>
            {[["Waist","96 cm"],["Chest","108 cm"],["Body fat est.","28%"],["7d avg","94.6 kg"]].map(([k,v]) => (
              <div key={k} style={{ display: "flex", justifyContent: "space-between", padding: "0.5rem 0", borderBottom: "1px solid rgba(255,255,255,0.04)", fontSize: "0.82rem" }}>
                <span style={{ color: "rgba(221,232,237,0.25)" }}>{k}</span>
                <span style={{ color: "rgba(255,255,255,0.25)" }}>{v}</span>
              </div>
            ))}
          </div>
          {/* After */}
          <div style={{ background: "#0c1217", padding: "2.5rem" }}>
            <p style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: "0.65rem", letterSpacing: "0.2em", textTransform: "uppercase", color: "#5ab4d4", marginBottom: "1.5rem" }}>// after — 90 days</p>
            <div style={{ fontFamily: "'Playfair Display',serif", fontSize: "3.5rem", fontWeight: 400, lineHeight: 1, color: "#5ab4d4", marginBottom: "0.3rem" }}>81.8</div>
            <p style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: "0.75rem", color: "rgba(221,232,237,0.25)", marginBottom: "1.5rem" }}>kg — Day 90</p>
            {[["Waist","84 cm"],["Chest","98 cm"],["Body fat est.","19%"],["7d avg","82.1 kg"]].map(([k,v]) => (
              <div key={k} style={{ display: "flex", justifyContent: "space-between", padding: "0.5rem 0", borderBottom: "1px solid rgba(255,255,255,0.04)", fontSize: "0.82rem" }}>
                <span style={{ color: "rgba(221,232,237,0.25)" }}>{k}</span>
                <span style={{ fontFamily: "'IBM Plex Mono',monospace", color: "#dde8ed" }}>{v}</span>
              </div>
            ))}
            <div style={{ marginTop: "1.5rem", padding: "0.75rem 1rem", background: "rgba(90,180,212,0.08)", border: "1px solid rgba(90,180,212,0.15)", display: "flex", alignItems: "center", gap: "0.5rem", fontFamily: "'IBM Plex Mono',monospace", fontSize: "0.75rem", color: "#5ab4d4" }}>
              ↓ −12.4 kg · −12 cm waist · −9% body fat
            </div>
          </div>
        </div>
      </section>

      {/* ── FEATURES ── */}
      <section id="features" className="kt-section" style={{ padding: "8rem 4rem", maxWidth: 1200, margin: "0 auto" }}>
        <SectionLabel>Features</SectionLabel>
        <h2 style={{ fontFamily: "'Playfair Display',serif", fontSize: "clamp(2rem,4vw,3.2rem)", fontWeight: 400, marginBottom: "5rem", lineHeight: 1.15 }}>
          Everything you need.<br /><em style={{ fontStyle: "italic", color: "rgba(90,180,212,0.5)" }}>Nothing you don't.</em>
        </h2>

        <div className="kt-features-grid" style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 2, marginBottom: 2 }}>
          {featureCards.slice(0, 3).map((f) => (
            <div key={f.title} className="kt-feature-card">
              <div style={{ marginBottom: "1.5rem" }}>{f.icon}</div>
              <h4 style={{ fontSize: "1rem", fontWeight: 500, marginBottom: "0.6rem", color: "#dde8ed" }}>{f.title}</h4>
              <p style={{ fontSize: "0.85rem", lineHeight: 1.8, color: "rgba(221,232,237,0.5)" }}>{f.desc}</p>
            </div>
          ))}
        </div>
        <div className="kt-features-grid-2" style={{ display: "grid", gridTemplateColumns: "repeat(2,1fr)", gap: 2 }}>
          {featureCards.slice(3).map((f) => (
            <div key={f.title} className="kt-feature-card">
              <div style={{ marginBottom: "1.5rem" }}>{f.icon}</div>
              <h4 style={{ fontSize: "1rem", fontWeight: 500, marginBottom: "0.6rem", color: "#dde8ed" }}>{f.title}</h4>
              <p style={{ fontSize: "0.85rem", lineHeight: 1.8, color: "rgba(221,232,237,0.5)" }}>{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── DATA / CHART ── */}
      <section id="data" className="kt-section" style={{ padding: "8rem 4rem", maxWidth: 1200, margin: "0 auto" }}>
        <SectionLabel>Data view</SectionLabel>
        <h2 style={{ fontFamily: "'Playfair Display',serif", fontSize: "clamp(2rem,4vw,3.2rem)", fontWeight: 400, marginBottom: "1rem" }}>
          Your progress,<br /><em style={{ fontStyle: "italic", color: "rgba(90,180,212,0.5)" }}>visualised.</em>
        </h2>
        <p style={{ fontSize: "0.95rem", color: "rgba(221,232,237,0.5)", lineHeight: 1.8, maxWidth: 500, marginBottom: "4rem" }}>
          Every check-in feeds a live dashboard. See your 7-day rolling average, raw weight, and trend line — all on one clean chart.
        </p>

        {/* chart card */}
        <div style={{ background: "#0c1217", padding: "2.5rem", border: "1px solid rgba(90,180,212,0.08)", borderTop: "1px solid rgba(90,180,212,0.2)" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "2rem", flexWrap: "wrap", gap: "1rem" }}>
            <div>
              <p style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: "0.62rem", letterSpacing: "0.2em", textTransform: "uppercase", color: "rgba(221,232,237,0.25)", marginBottom: "0.4rem" }}>Current weight</p>
              <p style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: "2rem", fontWeight: 500, color: "#5ab4d4" }}>81.8 kg</p>
              <p style={{ fontSize: "0.75rem", color: "rgba(221,232,237,0.25)", marginTop: "0.2rem" }}>↓ 0.4 kg this week · on track</p>
            </div>
            <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
              {["90d","30d","7d","All"].map((b, i) => (
                <span key={b} style={{
                  fontFamily: "'IBM Plex Mono',monospace", fontSize: "0.62rem", letterSpacing: "0.1em",
                  padding: "0.3rem 0.7rem", border: "1px solid rgba(90,180,212,0.18)",
                  color: i === 0 ? "#5ab4d4" : "rgba(90,180,212,0.5)",
                  background: i === 0 ? "rgba(90,180,212,0.08)" : "transparent",
                  cursor: "pointer",
                }}>
                  {b}
                </span>
              ))}
            </div>
          </div>

          <div style={{ width: "100%", overflow: "hidden" }}>
            <svg viewBox="0 0 900 260" xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="none" style={{ width: "100%", height: "auto", display: "block" }}>
              {/* grid lines */}
              {[52,104,156,208].map(y => <line key={y} x1="0" y1={y} x2="900" y2={y} stroke="rgba(90,180,212,0.07)" strokeWidth="1" />)}
              {/* y labels */}
              {[["94",56],["91",108],["88",160],["85",212]].map(([l,y]) => (
                <text key={l} x="4" y={y} fill="rgba(90,180,212,0.3)" fontFamily="IBM Plex Mono,monospace" fontSize="11">{l}</text>
              ))}
              {/* raw dots */}
              {[[30,60],[60,75],[90,55],[120,80],[150,90],[180,70],[210,100],[240,115],[270,105],[300,120],[330,130],[360,118],[390,135],[420,145],[450,138],[480,155],[510,165],[540,160],[570,172],[600,180],[630,188],[660,196],[690,190],[720,200],[750,208],[780,205],[810,212],[840,218],[870,222]].map(([cx,cy]) => (
                <circle key={`${cx}-${cy}`} cx={cx} cy={cy} r="2.5" fill="rgba(90,180,212,0.25)" />
              ))}
              {/* area fill */}
              <path d="M30,68 C80,72 130,82 180,95 C230,108 280,118 330,128 C380,138 430,148 480,157 C530,165 580,174 630,183 C680,190 730,200 780,206 C810,209 840,214 870,218 L870,260 L30,260 Z" fill="rgba(90,180,212,0.05)" />
              {/* avg line */}
              <path d="M30,68 C80,72 130,82 180,95 C230,108 280,118 330,128 C380,138 430,148 480,157 C530,165 580,174 630,183 C680,190 730,200 780,206 C810,209 840,214 870,218" fill="none" stroke="rgba(90,180,212,0.8)" strokeWidth="2" strokeLinecap="round" />
              {/* goal line */}
              <line x1="30" y1="230" x2="900" y2="230" stroke="rgba(90,180,212,0.2)" strokeWidth="1" strokeDasharray="6 4" />
              <text x="876" y="234" fill="rgba(90,180,212,0.4)" fontFamily="IBM Plex Mono,monospace" fontSize="10">goal</text>
              {/* x labels */}
              {[["Day 1",25],["Day 30",285],["Day 60",565],["Day 90",845]].map(([l,x]) => (
                <text key={l} x={x} y="252" fill="rgba(90,180,212,0.25)" fontFamily="IBM Plex Mono,monospace" fontSize="10">{l}</text>
              ))}
            </svg>
          </div>
        </div>

        {/* progress rings */}
        <div className="kt-ring-strip" style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 2, marginTop: 2 }}>
          {ringCards.map((r) => <ProgressRing key={r.label} ring={r} />)}
        </div>
      </section>

      {/* ── CTA ── */}
      <section style={{ padding: "10rem 4rem", textAlign: "center", maxWidth: 800, margin: "0 auto" }}>
        <SectionLabel center>Get started</SectionLabel>
        <h2 style={{ fontFamily: "'Playfair Display',serif", fontSize: "clamp(2.2rem,5vw,4rem)", fontWeight: 400, lineHeight: 1.1, marginBottom: "1.5rem" }}>
          Your data is<br />waiting to be <em style={{ fontStyle: "italic", color: "rgba(90,180,212,0.5)" }}>read.</em>
        </h2>
        <p style={{ fontSize: "1rem", color: "rgba(221,232,237,0.5)", lineHeight: 1.8, marginBottom: "3rem", maxWidth: 440, margin: "0 auto 3rem" }}>
          Start your first check-in today. No subscriptions required to begin — just open an account and log your first number.
        </p>
        <div style={{ display: "flex", gap: "1rem", justifyContent: "center", flexWrap: "wrap" }}>
          <Link to="/tracker/login" className="kt-btn-primary">Create free account →</Link>
          <a href="#" className="kt-btn-ghost">View pricing</a>
        </div>
        <p style={{ marginTop: "1.5rem", fontFamily: "'IBM Plex Mono',monospace", fontSize: "0.65rem", letterSpacing: "0.15em", color: "rgba(221,232,237,0.25)" }}>
          // free to start &nbsp;·&nbsp; no credit card &nbsp;·&nbsp; cancel anytime
        </p>
      </section>

      {/* ── FOOTER ── */}
      <footer style={{ borderTop: "1px solid rgba(90,180,212,0.07)", maxWidth: 1200, margin: "0 auto" }}>
        <div className="kt-footer-inner" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "3rem 4rem" }}>
          <div>
            <div style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: "0.85rem", fontWeight: 500, color: "#5ab4d4" }}>
              KordaTracker<sup style={{ fontSize: "0.5rem", color: "rgba(221,232,237,0.25)", marginLeft: 1 }}>™</sup>
            </div>
            <p style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: "0.6rem", color: "rgba(221,232,237,0.2)", marginTop: "0.4rem" }}>Part of the Korda™ Suite</p>
          </div>
          <div className="kt-footer-links" style={{ display: "flex", gap: "2rem" }}>
            <a href="#" className="kt-footer-link">Privacy</a>
            <a href="#" className="kt-footer-link">Terms</a>
            <a href="#" className="kt-footer-link">Contact</a>
            <Link to="/" className="kt-footer-link" style={{ color: "rgba(90,180,212,0.4)" }}>↗ Korda Suite</Link>
          </div>
          <p style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: "0.6rem", color: "rgba(221,232,237,0.25)", letterSpacing: "0.1em" }}>
            © 2025 Korda™. All rights reserved.
          </p>
        </div>
      </footer>
    </div>
  );
}
