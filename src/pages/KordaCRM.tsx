import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { supabase } from "@/lib/supabaseClient";
import { Loader2 } from "lucide-react";

const features = [
  {
    title: "Live Dashboard",
    desc: "Real-time progress bars per rep toward the 25-call daily goal. Leaderboard, status breakdown, and week totals — all on one screen.",
    icon: (
      <svg viewBox="0 0 36 36" fill="none" style={{ width: 36, height: 36 }}>
        <rect x="4" y="18" width="7" height="14" rx="1" fill="rgba(59,130,246,0.6)" />
        <rect x="14" y="12" width="7" height="20" rx="1" fill="rgba(59,130,246,0.4)" />
        <rect x="24" y="6" width="7" height="26" rx="1" fill="rgba(59,130,246,0.8)" />
        <line x1="4" y1="33" x2="32" y2="33" stroke="rgba(59,130,246,0.25)" strokeWidth="1" />
      </svg>
    ),
  },
  {
    title: "Log een Call",
    desc: "Voeg een gesprek toe in seconden. Status, resultaat, deal waarde, follow-up datum — één formulier, alles erin.",
    icon: (
      <svg viewBox="0 0 36 36" fill="none" style={{ width: 36, height: 36 }}>
        <rect x="6" y="4" width="24" height="28" rx="2" stroke="rgba(59,130,246,0.5)" strokeWidth="1.2" />
        <line x1="11" y1="12" x2="25" y2="12" stroke="rgba(59,130,246,0.5)" strokeWidth="1.2" />
        <line x1="11" y1="17" x2="25" y2="17" stroke="rgba(59,130,246,0.35)" strokeWidth="1.2" />
        <line x1="11" y1="22" x2="19" y2="22" stroke="rgba(59,130,246,0.35)" strokeWidth="1.2" />
        <circle cx="26" cy="27" r="6" fill="rgba(59,130,246,0.15)" stroke="rgba(59,130,246,0.6)" strokeWidth="1.2" />
        <line x1="26" y1="24" x2="26" y2="30" stroke="rgba(59,130,246,0.8)" strokeWidth="1.2" />
        <line x1="23" y1="27" x2="29" y2="27" stroke="rgba(59,130,246,0.8)" strokeWidth="1.2" />
      </svg>
    ),
  },
  {
    title: "Weekoverzicht",
    desc: "Grid van rep × dag. Rood onder 15, geel 15–24, groen op 25+. In één oogopslag zie je wie achterloopt en wie het doel haalt.",
    icon: (
      <svg viewBox="0 0 36 36" fill="none" style={{ width: 36, height: 36 }}>
        <rect x="4" y="8" width="28" height="24" rx="2" stroke="rgba(59,130,246,0.4)" strokeWidth="1.2" />
        <line x1="4" y1="14" x2="32" y2="14" stroke="rgba(59,130,246,0.2)" strokeWidth="1" />
        <line x1="13" y1="8" x2="13" y2="32" stroke="rgba(59,130,246,0.15)" strokeWidth="1" />
        <line x1="22" y1="8" x2="22" y2="32" stroke="rgba(59,130,246,0.15)" strokeWidth="1" />
        <rect x="6" y="17" width="5" height="5" rx="0.5" fill="rgba(220,38,38,0.5)" />
        <rect x="15" y="17" width="5" height="5" rx="0.5" fill="rgba(180,83,9,0.5)" />
        <rect x="24" y="17" width="5" height="5" rx="0.5" fill="rgba(21,128,61,0.6)" />
        <rect x="6" y="24" width="5" height="5" rx="0.5" fill="rgba(21,128,61,0.6)" />
        <rect x="15" y="24" width="5" height="5" rx="0.5" fill="rgba(21,128,61,0.6)" />
        <rect x="24" y="24" width="5" height="5" rx="0.5" fill="rgba(180,83,9,0.5)" />
        <rect x="6" y="4" width="4" height="4" rx="0.5" fill="rgba(59,130,246,0.5)" />
        <rect x="15" y="4" width="4" height="4" rx="0.5" fill="rgba(59,130,246,0.3)" />
        <rect x="24" y="4" width="4" height="4" rx="0.5" fill="rgba(59,130,246,0.3)" />
      </svg>
    ),
  },
  {
    title: "Leads Tabel",
    desc: "Filteren op rep, status of datumbereik. Klik een rij aan voor een zijpaneel om te bewerken. Exporteer alles met één klik naar CSV.",
    icon: (
      <svg viewBox="0 0 36 36" fill="none" style={{ width: 36, height: 36 }}>
        <rect x="4" y="6" width="28" height="24" rx="2" stroke="rgba(59,130,246,0.45)" strokeWidth="1.2" />
        <line x1="4" y1="13" x2="32" y2="13" stroke="rgba(59,130,246,0.25)" strokeWidth="1" />
        <line x1="4" y1="20" x2="32" y2="20" stroke="rgba(59,130,246,0.15)" strokeWidth="1" />
        <line x1="14" y1="6" x2="14" y2="30" stroke="rgba(59,130,246,0.15)" strokeWidth="1" />
        <line x1="24" y1="6" x2="24" y2="30" stroke="rgba(59,130,246,0.15)" strokeWidth="1" />
        <circle cx="9" cy="9.5" r="1.5" fill="rgba(59,130,246,0.7)" />
        <line x1="16" y1="9.5" x2="29" y2="9.5" stroke="rgba(59,130,246,0.4)" strokeWidth="1" />
        <line x1="6" y1="16.5" x2="11" y2="16.5" stroke="rgba(59,130,246,0.25)" strokeWidth="1" />
        <line x1="16" y1="16.5" x2="29" y2="16.5" stroke="rgba(59,130,246,0.2)" strokeWidth="1" />
      </svg>
    ),
  },
];

export default function KordaCRM() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const link = document.createElement("link");
    link.href = "https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,400;0,700;1,400&family=IBM+Plex+Mono:wght@400;500&family=DM+Sans:wght@300;400;500&display=swap";
    link.rel = "stylesheet";
    document.head.appendChild(link);

    const style = document.createElement("style");
    style.id = "kcrm-global";
    style.textContent = `
      .kcrm-root { background: #07090d; color: #e8eaf0; font-family: 'DM Sans', sans-serif; font-weight: 300; overflow-x: hidden; min-height: 100vh; }
      .kcrm-root *, .kcrm-root *::before, .kcrm-root *::after { box-sizing: border-box; }
      .kcrm-noise { position: fixed; inset: 0; z-index: 0; pointer-events: none;
        background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='0.03'/%3E%3C/svg%3E"); opacity: .5; }
      .kcrm-grid { position: fixed; inset: 0; z-index: 0; pointer-events: none;
        background-image: linear-gradient(rgba(59,130,246,0.03) 1px, transparent 1px), linear-gradient(90deg, rgba(59,130,246,0.03) 1px, transparent 1px);
        background-size: 60px 60px; }
      .kcrm-root section { position: relative; z-index: 1; }
      .kcrm-nav-link { font-size: 0.75rem; letter-spacing: 0.12em; text-transform: uppercase; color: rgba(232,234,240,0.25); text-decoration: none; transition: color 0.2s; }
      .kcrm-nav-link:hover { color: #e8eaf0; }
      .kcrm-nav-cta { font-family: 'IBM Plex Mono', monospace; font-size: 0.72rem; letter-spacing: 0.08em; color: #3B82F6; text-decoration: none; border: 1px solid rgba(59,130,246,0.25); padding: 0.5rem 1.4rem; transition: background 0.2s, border-color 0.2s; }
      .kcrm-nav-cta:hover { background: rgba(59,130,246,0.1); border-color: rgba(59,130,246,0.5); }
      .kcrm-feat-card { background: #0c1018; padding: 2.5rem; border-top: 1px solid rgba(59,130,246,0.1); transition: background 0.3s; }
      .kcrm-feat-card:hover { background: #0e1320; }
      .kcrm-footer-link { font-size: 0.75rem; color: rgba(232,234,240,0.2); text-decoration: none; transition: color 0.2s; }
      .kcrm-footer-link:hover { color: #e8eaf0; }
      @keyframes kcrm-fadeUp { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } }
      .kcrm-a1 { animation: kcrm-fadeUp 0.7s ease both; }
      .kcrm-a2 { animation: kcrm-fadeUp 0.7s 0.1s ease both; }
      .kcrm-a3 { animation: kcrm-fadeUp 0.7s 0.2s ease both; }
      .kcrm-a4 { animation: kcrm-fadeUp 0.7s 0.3s ease both; }
      .kcrm-a5 { animation: kcrm-fadeUp 0.7s 0.4s ease both; }
      @media (max-width: 900px) {
        .kcrm-nav-links { display: none !important; }
        .kcrm-hero-inner { grid-template-columns: 1fr !important; gap: 3rem !important; }
        .kcrm-hero { padding: 0 1.5rem !important; }
        .kcrm-feat-grid { grid-template-columns: 1fr 1fr !important; }
        .kcrm-footer-inner { flex-direction: column; gap: 1.5rem; text-align: center; padding: 2rem 1.5rem !important; }
        .kcrm-footer-links { justify-content: center !important; }
      }
      @media (max-width: 540px) {
        .kcrm-feat-grid { grid-template-columns: 1fr !important; }
      }
    `;
    document.head.appendChild(style);

    return () => {
      document.head.removeChild(link);
      const el = document.getElementById("kcrm-global");
      if (el) document.head.removeChild(el);
    };
  }, []);

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setBusy(true);
    try {
      const { error: authError } = await supabase.auth.signInWithPassword({ email, password });
      if (authError) throw authError;
      navigate("/crm/dashboard");
    } catch (err: any) {
      setError(err?.message ?? "Inloggen mislukt");
    } finally {
      setBusy(false);
    }
  };

  const inputStyle: React.CSSProperties = {
    width: "100%",
    padding: "0.65rem 0.9rem",
    background: "rgba(255,255,255,0.04)",
    border: "1px solid rgba(59,130,246,0.2)",
    borderRadius: 6,
    color: "#e8eaf0",
    fontSize: "0.875rem",
    fontFamily: "inherit",
    outline: "none",
    transition: "border-color 0.2s",
  };

  return (
    <div className="kcrm-root">
      <div className="kcrm-noise" />
      <div className="kcrm-grid" />

      {/* NAV */}
      <nav style={{
        position: "fixed", top: 0, left: 0, right: 0, zIndex: 100,
        display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "1.2rem 4rem",
        borderBottom: "1px solid rgba(59,130,246,0.08)",
        background: "rgba(7,9,13,0.9)",
        backdropFilter: "blur(20px)",
      }}>
        <div style={{ display: "flex", alignItems: "baseline", gap: "0.4rem" }}>
          <span style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: "0.9rem", fontWeight: 500, color: "#3B82F6", letterSpacing: "0.03em" }}>
            KordaCRM
          </span>
          <span style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: "0.65rem", color: "rgba(232,234,240,0.2)" }}>™</span>
        </div>
        <div className="kcrm-nav-links" style={{ display: "flex", gap: "2.5rem", alignItems: "center" }}>
          <a href="#features" className="kcrm-nav-link">Features</a>
          <Link to="/" className="kcrm-nav-link" style={{ color: "rgba(59,130,246,0.4)", fontSize: "0.7rem" }}>↗ Korda Suite</Link>
        </div>
        <a href="#signin" className="kcrm-nav-cta">Inloggen_</a>
      </nav>

      {/* HERO */}
      <section className="kcrm-hero" style={{
        minHeight: "100vh",
        display: "flex", alignItems: "center",
        padding: "0 4rem", maxWidth: 1200, margin: "0 auto",
        paddingTop: "7rem",
      }}>
        <div className="kcrm-hero-inner" style={{
          display: "grid", gridTemplateColumns: "1fr 420px", gap: "5rem",
          alignItems: "center", width: "100%",
        }}>
          {/* Left: headline */}
          <div>
            <p className="kcrm-a1" style={{
              fontFamily: "'IBM Plex Mono',monospace",
              fontSize: "0.65rem", letterSpacing: "0.28em", textTransform: "uppercase",
              color: "rgba(59,130,246,0.6)", marginBottom: "2rem",
              display: "flex", alignItems: "center", gap: "1rem",
            }}>
              <span style={{ display: "block", width: 32, height: 1, background: "rgba(59,130,246,0.5)", flexShrink: 0 }} />
              KordaCRM™ — Sales call tracking
            </p>

            <h1 className="kcrm-a2" style={{
              fontFamily: "'Playfair Display',serif",
              fontSize: "clamp(2.8rem,6vw,5.5rem)",
              fontWeight: 400, lineHeight: 1.07,
              letterSpacing: "-0.02em", marginBottom: "1.75rem",
            }}>
              Elke call<br />telt. <em style={{ fontStyle: "italic", color: "rgba(59,130,246,0.5)" }}>Bewijs</em><br />het.
            </h1>

            <p className="kcrm-a3" style={{
              fontSize: "1rem", fontWeight: 300, lineHeight: 1.85,
              color: "rgba(232,234,240,0.45)", maxWidth: 460, marginBottom: "2.5rem",
            }}>
              Eén plek voor het team om calls te loggen, voortgang bij te houden en dealwaarde te zien groeien. Transparant. In real-time.
            </p>

            <div className="kcrm-a4" style={{ display: "flex", flexDirection: "column", gap: "0.6rem", marginBottom: "2.5rem" }}>
              {[
                "25 calls per dag per rep — live voortgangsbalk",
                "Dashboard, weekgrid, en leadsoverzicht in één",
                "Filteer op rep, status of datum — export naar CSV",
              ].map(f => (
                <div key={f} style={{ display: "flex", alignItems: "center", gap: "0.65rem" }}>
                  <span style={{ width: 4, height: 4, borderRadius: "50%", background: "rgba(59,130,246,0.7)", flexShrink: 0 }} />
                  <span style={{ fontSize: "0.85rem", color: "rgba(232,234,240,0.4)" }}>{f}</span>
                </div>
              ))}
            </div>

            <div className="kcrm-a5" style={{
              display: "flex", gap: "3rem", paddingTop: "2rem",
              borderTop: "1px solid rgba(59,130,246,0.1)",
            }}>
              {[
                { val: "25", lbl: "calls / dag / rep" },
                { val: "3", lbl: "reps in het team" },
                { val: "6", lbl: "call statussen" },
              ].map(s => (
                <div key={s.lbl}>
                  <span style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: "1.6rem", fontWeight: 500, color: "#3B82F6", display: "block", marginBottom: "0.2rem" }}>
                    {s.val}
                  </span>
                  <span style={{ fontSize: "0.68rem", letterSpacing: "0.15em", textTransform: "uppercase", color: "rgba(232,234,240,0.22)" }}>
                    {s.lbl}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Right: sign-in card */}
          <div id="signin" className="kcrm-a3" style={{
            background: "#0c1018",
            border: "1px solid rgba(59,130,246,0.15)",
            borderTop: "2px solid rgba(59,130,246,0.6)",
            borderRadius: 12,
            padding: "2.25rem",
          }}>
            <div style={{ marginBottom: "1.75rem" }}>
              <p style={{
                fontFamily: "'IBM Plex Mono',monospace",
                fontSize: "0.62rem", letterSpacing: "0.2em", textTransform: "uppercase",
                color: "rgba(59,130,246,0.5)", marginBottom: "0.5rem",
              }}>
                // team_access
              </p>
              <h2 style={{ fontFamily: "'Playfair Display',serif", fontSize: "1.5rem", fontWeight: 400, color: "#e8eaf0", margin: 0 }}>
                Inloggen
              </h2>
              <p style={{ fontSize: "0.8rem", color: "rgba(232,234,240,0.3)", marginTop: "0.4rem" }}>
                Gebruik je Korda account.
              </p>
            </div>

            <form onSubmit={handleSignIn} style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
              <div>
                <label style={{
                  display: "block", fontSize: "0.68rem", fontWeight: 600,
                  letterSpacing: "0.1em", textTransform: "uppercase",
                  color: "rgba(232,234,240,0.3)", marginBottom: "0.4rem",
                  fontFamily: "'IBM Plex Mono',monospace",
                }}>
                  E-mailadres
                </label>
                <input
                  required
                  type="email"
                  autoComplete="email"
                  style={inputStyle}
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="jij@voorbeeld.nl"
                  onFocus={e => (e.target.style.borderColor = "rgba(59,130,246,0.5)")}
                  onBlur={e => (e.target.style.borderColor = "rgba(59,130,246,0.2)")}
                />
              </div>

              <div>
                <label style={{
                  display: "block", fontSize: "0.68rem", fontWeight: 600,
                  letterSpacing: "0.1em", textTransform: "uppercase",
                  color: "rgba(232,234,240,0.3)", marginBottom: "0.4rem",
                  fontFamily: "'IBM Plex Mono',monospace",
                }}>
                  Wachtwoord
                </label>
                <input
                  required
                  type="password"
                  autoComplete="current-password"
                  style={inputStyle}
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="••••••••"
                  onFocus={e => (e.target.style.borderColor = "rgba(59,130,246,0.5)")}
                  onBlur={e => (e.target.style.borderColor = "rgba(59,130,246,0.2)")}
                />
              </div>

              {error && (
                <div style={{
                  padding: "0.6rem 0.85rem",
                  background: "rgba(220,38,38,0.08)",
                  border: "1px solid rgba(220,38,38,0.2)",
                  borderRadius: 6,
                  fontSize: "0.8rem",
                  color: "#F87171",
                }}>
                  {error}
                </div>
              )}

              <button
                type="submit"
                disabled={busy}
                style={{
                  marginTop: "0.25rem",
                  padding: "0.8rem",
                  background: busy ? "rgba(59,130,246,0.5)" : "#3B82F6",
                  color: "#fff",
                  border: "none", borderRadius: 7,
                  fontFamily: "'IBM Plex Mono',monospace",
                  fontWeight: 500, fontSize: "0.82rem",
                  letterSpacing: "0.06em",
                  cursor: busy ? "not-allowed" : "pointer",
                  transition: "all 0.2s",
                  display: "flex", alignItems: "center", justifyContent: "center", gap: "0.5rem",
                }}
                onMouseEnter={e => { if (!busy) e.currentTarget.style.background = "#2563EB"; }}
                onMouseLeave={e => { if (!busy) e.currentTarget.style.background = "#3B82F6"; }}
              >
                {busy ? <><Loader2 size={14} style={{ animation: "spin 1s linear infinite" }} /> Bezig…</> : "Inloggen →"}
              </button>

              <p style={{
                fontFamily: "'IBM Plex Mono',monospace",
                fontSize: "0.62rem", letterSpacing: "0.1em",
                color: "rgba(232,234,240,0.18)", textAlign: "center", marginTop: "0.25rem",
              }}>
                // alleen voor het Korda team
              </p>
            </form>
          </div>
        </div>
      </section>

      {/* FEATURES */}
      <section id="features" style={{ padding: "8rem 4rem", maxWidth: 1200, margin: "0 auto" }}>
        <p style={{
          fontFamily: "'IBM Plex Mono',monospace",
          fontSize: "0.62rem", letterSpacing: "0.28em", textTransform: "uppercase",
          color: "rgba(59,130,246,0.5)", marginBottom: "1rem",
          display: "flex", alignItems: "center", gap: "0.75rem",
        }}>
          <span style={{ color: "rgba(232,234,240,0.2)" }}>//</span>
          Features
        </p>
        <h2 style={{
          fontFamily: "'Playfair Display',serif",
          fontSize: "clamp(2rem,4vw,3rem)", fontWeight: 400, lineHeight: 1.15,
          marginBottom: "4rem",
        }}>
          Alles wat je nodig hebt.<br />
          <em style={{ fontStyle: "italic", color: "rgba(59,130,246,0.5)" }}>Niets wat je niet nodig hebt.</em>
        </h2>

        <div className="kcrm-feat-grid" style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 2 }}>
          {features.map(f => (
            <div key={f.title} className="kcrm-feat-card">
              <div style={{ marginBottom: "1.5rem" }}>{f.icon}</div>
              <h4 style={{ fontSize: "1rem", fontWeight: 500, marginBottom: "0.6rem", color: "#e8eaf0" }}>{f.title}</h4>
              <p style={{ fontSize: "0.84rem", lineHeight: 1.75, color: "rgba(232,234,240,0.45)" }}>{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* STATUS LEGEND */}
      <section style={{ padding: "0 4rem 8rem", maxWidth: 1200, margin: "0 auto" }}>
        <div style={{ background: "#0c1018", border: "1px solid rgba(59,130,246,0.1)", borderRadius: 10, padding: "2.5rem" }}>
          <p style={{
            fontFamily: "'IBM Plex Mono',monospace", fontSize: "0.62rem",
            letterSpacing: "0.2em", textTransform: "uppercase",
            color: "rgba(59,130,246,0.4)", marginBottom: "1.5rem",
          }}>
            // call_statuses
          </p>
          <div style={{ display: "flex", flexWrap: "wrap", gap: "0.75rem" }}>
            {[
              { label: "Niet bereikt",        color: "#6B7280", bg: "rgba(107,114,128,0.1)",  border: "rgba(107,114,128,0.25)" },
              { label: "Geen Gehoor",          color: "#9CA3AF", bg: "rgba(156,163,175,0.08)", border: "rgba(156,163,175,0.2)"  },
              { label: "Niet Geïnteresseerd",  color: "#F87171", bg: "rgba(248,113,113,0.08)", border: "rgba(248,113,113,0.2)"  },
              { label: "Terugbellen",          color: "#FCD34D", bg: "rgba(252,211,77,0.08)",  border: "rgba(252,211,77,0.2)"   },
              { label: "Geïnteresseerd",       color: "#4ADE80", bg: "rgba(74,222,128,0.08)",  border: "rgba(74,222,128,0.2)"   },
              { label: "Gesloten",             color: "#34D399", bg: "rgba(52,211,153,0.1)",   border: "rgba(52,211,153,0.25)"  },
            ].map(s => (
              <span
                key={s.label}
                style={{
                  display: "inline-flex", alignItems: "center", gap: "0.45rem",
                  padding: "0.35rem 0.85rem",
                  border: `1px solid ${s.border}`,
                  borderRadius: 9999,
                  background: s.bg,
                  fontSize: "0.78rem", fontWeight: 500,
                  color: s.color,
                }}
              >
                <span style={{ width: 6, height: 6, borderRadius: "50%", background: s.color, flexShrink: 0 }} />
                {s.label}
              </span>
            ))}
          </div>
        </div>
      </section>

      {/* FOOTER */}
      <footer style={{ borderTop: "1px solid rgba(59,130,246,0.07)", maxWidth: 1200, margin: "0 auto" }}>
        <div className="kcrm-footer-inner" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "2.5rem 4rem" }}>
          <div>
            <div style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: "0.85rem", fontWeight: 500, color: "#3B82F6" }}>
              KordaCRM<sup style={{ fontSize: "0.5rem", color: "rgba(232,234,240,0.2)", marginLeft: 1 }}>™</sup>
            </div>
            <p style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: "0.6rem", color: "rgba(232,234,240,0.18)", marginTop: "0.35rem" }}>
              Part of the Korda™ Suite
            </p>
          </div>
          <div className="kcrm-footer-links" style={{ display: "flex", gap: "2rem" }}>
            <Link to="/" className="kcrm-footer-link" style={{ color: "rgba(59,130,246,0.4)" }}>↗ Korda Suite</Link>
          </div>
          <p style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: "0.6rem", color: "rgba(232,234,240,0.2)", letterSpacing: "0.1em" }}>
            © 2025 Korda™. All rights reserved.
          </p>
        </div>
      </footer>
    </div>
  );
}
