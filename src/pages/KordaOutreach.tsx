import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { supabase } from "@/lib/supabaseClient";
import { Loader2 } from "lucide-react";

const ACCENT = "232,150,68"; // amber — Outreach's own colour across card, landing, and console

const features = [
  {
    title: "Niche configs",
    desc: "One row per vertical: what to search, where, which quality gates, and which enrichment steps run. Add a market without touching code.",
    icon: (
      <svg viewBox="0 0 36 36" fill="none" style={{ width: 36, height: 36 }}>
        <rect x="5" y="7" width="26" height="7" rx="1.5" stroke={`rgba(${ACCENT},0.5)`} strokeWidth="1.2" />
        <rect x="5" y="17" width="26" height="7" rx="1.5" stroke={`rgba(${ACCENT},0.3)`} strokeWidth="1.2" />
        <rect x="5" y="27" width="26" height="5" rx="1.5" stroke={`rgba(${ACCENT},0.2)`} strokeWidth="1.2" />
        <circle cx="26" cy="10.5" r="2" fill={`rgba(${ACCENT},0.7)`} />
        <circle cx="26" cy="20.5" r="2" fill={`rgba(${ACCENT},0.35)`} />
      </svg>
    ),
  },
  {
    title: "Provenance on every row",
    desc: "Each contact records where it came from — the exact page the name or address was read from. If anyone asks how you got their details, you can answer.",
    icon: (
      <svg viewBox="0 0 36 36" fill="none" style={{ width: 36, height: 36 }}>
        <path d="M18 4 L30 10 V20 C30 26 24 30 18 32 C12 30 6 26 6 20 V10 Z" stroke={`rgba(${ACCENT},0.5)`} strokeWidth="1.2" />
        <path d="M13 18 l4 4 l7 -8" stroke={`rgba(${ACCENT},0.8)`} strokeWidth="1.5" />
      </svg>
    ),
  },
  {
    title: "Confidence, not guesswork",
    desc: "A personal address on the company domain outranks a generic info@. Guessed addresses are labelled as guesses. You see the score before you send.",
    icon: (
      <svg viewBox="0 0 36 36" fill="none" style={{ width: 36, height: 36 }}>
        <rect x="5" y="24" width="6" height="8" rx="1" fill={`rgba(${ACCENT},0.3)`} />
        <rect x="15" y="17" width="6" height="15" rx="1" fill={`rgba(${ACCENT},0.55)`} />
        <rect x="25" y="8" width="6" height="24" rx="1" fill={`rgba(${ACCENT},0.8)`} />
      </svg>
    ),
  },
  {
    title: "Opt-outs that stick",
    desc: "Unsubscribes and hard bounces suppress themselves at the database level. Once someone is out, no future run can put them back in front of you.",
    icon: (
      <svg viewBox="0 0 36 36" fill="none" style={{ width: 36, height: 36 }}>
        <circle cx="18" cy="18" r="13" stroke={`rgba(${ACCENT},0.5)`} strokeWidth="1.3" />
        <line x1="9" y1="27" x2="27" y2="9" stroke={`rgba(${ACCENT},0.8)`} strokeWidth="1.5" />
      </svg>
    ),
  },
];

export default function KordaOutreach() {
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
    style.id = "kout-global";
    style.textContent = `
      .kout-root { background: #0b0906; color: #ece7e0; font-family: 'DM Sans', sans-serif; font-weight: 300; overflow-x: hidden; min-height: 100vh; }
      .kout-root *, .kout-root *::before, .kout-root *::after { box-sizing: border-box; }
      .kout-noise { position: fixed; inset: 0; z-index: 0; pointer-events: none;
        background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='0.03'/%3E%3C/svg%3E"); opacity: .5; }
      .kout-grid-bg { position: fixed; inset: 0; z-index: 0; pointer-events: none;
        background-image: linear-gradient(rgba(${ACCENT},0.025) 1px, transparent 1px), linear-gradient(90deg, rgba(${ACCENT},0.025) 1px, transparent 1px);
        background-size: 60px 60px; }
      .kout-root section { position: relative; z-index: 1; }
      .kout-nav-link { font-size: 0.75rem; letter-spacing: 0.12em; text-transform: uppercase; color: rgba(236,231,224,0.25); text-decoration: none; transition: color 0.2s; }
      .kout-nav-link:hover { color: #ece7e0; }
      .kout-nav-cta { font-family: 'IBM Plex Mono', monospace; font-size: 0.72rem; letter-spacing: 0.08em; color: rgb(${ACCENT}); text-decoration: none; border: 1px solid rgba(${ACCENT},0.25); padding: 0.5rem 1.4rem; transition: background 0.2s, border-color 0.2s; }
      .kout-nav-cta:hover { background: rgba(${ACCENT},0.1); border-color: rgba(${ACCENT},0.5); }
      .kout-feat-card { background: #12100c; padding: 2.5rem; border-top: 1px solid rgba(${ACCENT},0.1); transition: background 0.3s; }
      .kout-feat-card:hover { background: #171410; }
      .kout-footer-link { font-size: 0.75rem; color: rgba(236,231,224,0.2); text-decoration: none; transition: color 0.2s; }
      .kout-footer-link:hover { color: #ece7e0; }
      @keyframes kout-fadeUp { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } }
      .kout-a1 { animation: kout-fadeUp 0.7s ease both; }
      .kout-a2 { animation: kout-fadeUp 0.7s 0.1s ease both; }
      .kout-a3 { animation: kout-fadeUp 0.7s 0.2s ease both; }
      .kout-a4 { animation: kout-fadeUp 0.7s 0.3s ease both; }
      .kout-a5 { animation: kout-fadeUp 0.7s 0.4s ease both; }
      @media (max-width: 900px) {
        .kout-nav-links { display: none !important; }
        .kout-hero-inner { grid-template-columns: 1fr !important; gap: 3rem !important; }
        .kout-hero { padding: 0 1.5rem !important; }
        .kout-feat-grid { grid-template-columns: 1fr 1fr !important; }
        .kout-footer-inner { flex-direction: column; gap: 1.5rem; text-align: center; padding: 2rem 1.5rem !important; }
        .kout-footer-links { justify-content: center !important; }
      }
      @media (max-width: 540px) {
        .kout-feat-grid { grid-template-columns: 1fr !important; }
      }
    `;
    document.head.appendChild(style);

    return () => {
      document.head.removeChild(link);
      const el = document.getElementById("kout-global");
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
      navigate("/outreach/leads");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Sign in failed");
    } finally {
      setBusy(false);
    }
  };

  const inputStyle: React.CSSProperties = {
    width: "100%",
    padding: "0.65rem 0.9rem",
    background: "rgba(255,255,255,0.04)",
    border: `1px solid rgba(${ACCENT},0.2)`,
    borderRadius: 6,
    color: "#ece7e0",
    fontSize: "0.875rem",
    fontFamily: "inherit",
    outline: "none",
    transition: "border-color 0.2s",
  };

  return (
    <div className="kout-root">
      <div className="kout-noise" />
      <div className="kout-grid-bg" />

      {/* NAV */}
      <nav style={{
        position: "fixed", top: 0, left: 0, right: 0, zIndex: 100,
        display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "1.2rem 4rem",
        borderBottom: `1px solid rgba(${ACCENT},0.08)`,
        background: "rgba(11,9,6,0.9)",
        backdropFilter: "blur(20px)",
      }}>
        <div style={{ display: "flex", alignItems: "baseline", gap: "0.4rem" }}>
          <span style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: "0.9rem", fontWeight: 500, color: `rgb(${ACCENT})`, letterSpacing: "0.03em" }}>
            KordaOutreach
          </span>
          <span style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: "0.65rem", color: "rgba(236,231,224,0.2)" }}>™</span>
        </div>
        <div className="kout-nav-links" style={{ display: "flex", gap: "2.5rem", alignItems: "center" }}>
          <a href="#features" className="kout-nav-link">Features</a>
          <Link to="/" className="kout-nav-link" style={{ color: `rgba(${ACCENT},0.4)`, fontSize: "0.7rem" }}>↗ Korda Suite</Link>
        </div>
        <a href="#signin" className="kout-nav-cta">Sign in_</a>
      </nav>

      {/* HERO */}
      <section className="kout-hero" style={{
        minHeight: "100vh",
        display: "flex", alignItems: "center",
        padding: "0 4rem", maxWidth: 1200, margin: "0 auto",
        paddingTop: "7rem",
      }}>
        <div className="kout-hero-inner" style={{
          display: "grid", gridTemplateColumns: "1fr 420px", gap: "5rem",
          alignItems: "center", width: "100%",
        }}>
          <div>
            <p className="kout-a1" style={{
              fontFamily: "'IBM Plex Mono',monospace",
              fontSize: "0.65rem", letterSpacing: "0.28em", textTransform: "uppercase",
              color: `rgba(${ACCENT},0.6)`, marginBottom: "2rem",
              display: "flex", alignItems: "center", gap: "1rem",
            }}>
              <span style={{ display: "block", width: 32, height: 1, background: `rgba(${ACCENT},0.5)`, flexShrink: 0 }} />
              KordaOutreach™ — B2B lead engine
            </p>

            <h1 className="kout-a2" style={{
              fontFamily: "'Playfair Display',serif",
              fontSize: "clamp(2.8rem,6vw,5.5rem)",
              fontWeight: 400, lineHeight: 1.07,
              letterSpacing: "-0.02em", marginBottom: "1.75rem",
            }}>
              Find them.<br /><em style={{ fontStyle: "italic", color: `rgba(${ACCENT},0.6)` }}>Verify</em> them.<br />Own the list.
            </h1>

            <p className="kout-a3" style={{
              fontSize: "1rem", fontWeight: 300, lineHeight: 1.85,
              color: "rgba(236,231,224,0.45)", maxWidth: 460, marginBottom: "2.5rem",
            }}>
              A pipeline finds local businesses, reads the public web for the owner and their email,
              and scores what it finds. This is where you review the result and decide who's worth contacting.
            </p>

            <div className="kout-a4" style={{ display: "flex", flexDirection: "column", gap: "0.6rem", marginBottom: "2.5rem" }}>
              {[
                "Configure a market once — the pipeline works the list",
                "Every contact carries the page it was found on",
                "Opt-outs suppress themselves and stay suppressed",
              ].map(f => (
                <div key={f} style={{ display: "flex", alignItems: "center", gap: "0.65rem" }}>
                  <span style={{ width: 4, height: 4, borderRadius: "50%", background: `rgba(${ACCENT},0.7)`, flexShrink: 0 }} />
                  <span style={{ fontSize: "0.85rem", color: "rgba(236,231,224,0.4)" }}>{f}</span>
                </div>
              ))}
            </div>

            <div className="kout-a5" style={{
              display: "flex", gap: "3rem", paddingTop: "2rem",
              borderTop: `1px solid rgba(${ACCENT},0.1)`,
            }}>
              {[
                { val: "2", lbl: "discovery sources" },
                { val: "0.0–1.0", lbl: "confidence scored" },
                { val: "GDPR", lbl: "provenance kept" },
              ].map(s => (
                <div key={s.lbl}>
                  <span style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: "1.5rem", fontWeight: 500, color: `rgb(${ACCENT})`, display: "block", marginBottom: "0.2rem" }}>
                    {s.val}
                  </span>
                  <span style={{ fontSize: "0.68rem", letterSpacing: "0.15em", textTransform: "uppercase", color: "rgba(236,231,224,0.22)" }}>
                    {s.lbl}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Sign-in card */}
          <div id="signin" className="kout-a3" style={{
            background: "#12100c",
            border: `1px solid rgba(${ACCENT},0.15)`,
            borderTop: `2px solid rgba(${ACCENT},0.6)`,
            borderRadius: 12,
            padding: "2.25rem",
          }}>
            <div style={{ marginBottom: "1.75rem" }}>
              <p style={{
                fontFamily: "'IBM Plex Mono',monospace",
                fontSize: "0.62rem", letterSpacing: "0.2em", textTransform: "uppercase",
                color: `rgba(${ACCENT},0.5)`, marginBottom: "0.5rem",
              }}>
                // console_access
              </p>
              <h2 style={{ fontFamily: "'Playfair Display',serif", fontSize: "1.5rem", fontWeight: 400, color: "#ece7e0", margin: 0 }}>
                Sign in
              </h2>
              <p style={{ fontSize: "0.8rem", color: "rgba(236,231,224,0.3)", marginTop: "0.4rem" }}>
                Use your Korda account.
              </p>
            </div>

            <form onSubmit={handleSignIn} style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
              <div>
                <label style={{
                  display: "block", fontSize: "0.68rem", fontWeight: 600,
                  letterSpacing: "0.1em", textTransform: "uppercase",
                  color: "rgba(236,231,224,0.3)", marginBottom: "0.4rem",
                  fontFamily: "'IBM Plex Mono',monospace",
                }}>
                  Email
                </label>
                <input
                  required
                  type="email"
                  autoComplete="email"
                  style={inputStyle}
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  onFocus={e => (e.target.style.borderColor = `rgba(${ACCENT},0.5)`)}
                  onBlur={e => (e.target.style.borderColor = `rgba(${ACCENT},0.2)`)}
                />
              </div>

              <div>
                <label style={{
                  display: "block", fontSize: "0.68rem", fontWeight: 600,
                  letterSpacing: "0.1em", textTransform: "uppercase",
                  color: "rgba(236,231,224,0.3)", marginBottom: "0.4rem",
                  fontFamily: "'IBM Plex Mono',monospace",
                }}>
                  Password
                </label>
                <input
                  required
                  type="password"
                  autoComplete="current-password"
                  style={inputStyle}
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="••••••••"
                  onFocus={e => (e.target.style.borderColor = `rgba(${ACCENT},0.5)`)}
                  onBlur={e => (e.target.style.borderColor = `rgba(${ACCENT},0.2)`)}
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
                  background: busy ? `rgba(${ACCENT},0.5)` : `rgb(${ACCENT})`,
                  color: "#0b0906",
                  border: "none", borderRadius: 7,
                  fontFamily: "'IBM Plex Mono',monospace",
                  fontWeight: 500, fontSize: "0.82rem",
                  letterSpacing: "0.06em",
                  cursor: busy ? "not-allowed" : "pointer",
                  transition: "all 0.2s",
                  display: "flex", alignItems: "center", justifyContent: "center", gap: "0.5rem",
                }}
              >
                {busy ? <><Loader2 size={14} style={{ animation: "spin 1s linear infinite" }} /> Signing in…</> : "Open console →"}
              </button>

              <p style={{
                fontFamily: "'IBM Plex Mono',monospace",
                fontSize: "0.62rem", letterSpacing: "0.1em",
                color: "rgba(236,231,224,0.18)", textAlign: "center", marginTop: "0.25rem",
              }}>
                // internal tool — Korda team only
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
          color: `rgba(${ACCENT},0.5)`, marginBottom: "1rem",
          display: "flex", alignItems: "center", gap: "0.75rem",
        }}>
          <span style={{ color: "rgba(236,231,224,0.2)" }}>//</span>
          What it does
        </p>
        <h2 style={{
          fontFamily: "'Playfair Display',serif",
          fontSize: "clamp(2rem,4vw,3rem)", fontWeight: 400, lineHeight: 1.15,
          marginBottom: "4rem",
        }}>
          A list you can defend.<br />
          <em style={{ fontStyle: "italic", color: `rgba(${ACCENT},0.5)` }}>Not a scrape you can't.</em>
        </h2>

        <div className="kout-feat-grid" style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 2 }}>
          {features.map(f => (
            <div key={f.title} className="kout-feat-card">
              <div style={{ marginBottom: "1.5rem" }}>{f.icon}</div>
              <h4 style={{ fontSize: "1rem", fontWeight: 500, marginBottom: "0.6rem", color: "#ece7e0" }}>{f.title}</h4>
              <p style={{ fontSize: "0.84rem", lineHeight: 1.75, color: "rgba(236,231,224,0.45)" }}>{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* FOOTER */}
      <footer style={{ borderTop: `1px solid rgba(${ACCENT},0.07)`, maxWidth: 1200, margin: "0 auto" }}>
        <div className="kout-footer-inner" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "2.5rem 4rem" }}>
          <div>
            <div style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: "0.85rem", fontWeight: 500, color: `rgb(${ACCENT})` }}>
              KordaOutreach<sup style={{ fontSize: "0.5rem", color: "rgba(236,231,224,0.2)", marginLeft: 1 }}>™</sup>
            </div>
            <p style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: "0.6rem", color: "rgba(236,231,224,0.18)", marginTop: "0.35rem" }}>
              Part of the Korda™ Suite
            </p>
          </div>
          <div className="kout-footer-links" style={{ display: "flex", gap: "2rem" }}>
            <Link to="/" className="kout-footer-link" style={{ color: `rgba(${ACCENT},0.4)` }}>↗ Korda Suite</Link>
          </div>
          <p style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: "0.6rem", color: "rgba(236,231,224,0.2)", letterSpacing: "0.1em" }}>
            © 2026 Korda™. All rights reserved.
          </p>
        </div>
      </footer>
    </div>
  );
}
