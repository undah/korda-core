// src/features/budget/components/KordaAI.tsx — Korda AI's face, and the floating button that opens it.
import { Link, useLocation } from "react-router-dom";

/** Remembered per household, so the floating button's dot clears once the insights are seen. */
export const gezienSleutel = (householdId: string) => `kb-ai-gezien:${householdId}`;

/**
 * Korda AI as a little helper: a round indigo body, a light face with eyes that
 * blink now and then, a smile, and an antenna that glows. Drawn, not a photo,
 * so it stays crisp at any size. Motion stops for people who ask for less.
 */
export function KordaAIFiguur({ grootte = 56, zweeft = true }: { grootte?: number; zweeft?: boolean }) {
  return (
    <span className="relative inline-flex flex-col items-center" style={{ width: grootte, height: grootte * 1.12 }} aria-hidden>
      <svg
        viewBox="0 0 64 64"
        width={grootte}
        height={grootte}
        className={zweeft ? "motion-safe:animate-zweef" : undefined}
        style={{ overflow: "visible" }}
      >
        <defs>
          <radialGradient id="kai-lijf" cx="35%" cy="30%" r="75%">
            <stop offset="0%" stopColor="#7b79f6" />
            <stop offset="60%" stopColor="#4d4be0" />
            <stop offset="100%" stopColor="#3330b8" />
          </radialGradient>
          <radialGradient id="kai-gloed" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#e9e8ff" />
            <stop offset="100%" stopColor="#a9a7ff" stopOpacity="0" />
          </radialGradient>
        </defs>
        {/* antenna */}
        <line x1="32" y1="9" x2="32" y2="3.5" stroke="#4d4be0" strokeWidth="2.2" strokeLinecap="round" />
        <circle cx="32" cy="2.5" r="5" fill="url(#kai-gloed)" className="motion-safe:animate-antenne-gloei" />
        <circle cx="32" cy="2.5" r="2.4" fill="#e9e8ff" />
        {/* body */}
        <circle cx="32" cy="35" r="26" fill="url(#kai-lijf)" />
        <ellipse cx="24" cy="22" rx="7" ry="4" fill="#ffffff" opacity="0.18" transform="rotate(-25 24 22)" />
        {/* face plate */}
        <ellipse cx="32" cy="37" rx="18" ry="14" fill="#f4f3ff" />
        {/* eyes, blinking together */}
        <g className="motion-safe:animate-knipper" style={{ transformOrigin: "32px 35px", transformBox: "view-box" }}>
          <ellipse cx="25.5" cy="35" rx="3.1" ry="3.8" fill="#17181c" />
          <ellipse cx="38.5" cy="35" rx="3.1" ry="3.8" fill="#17181c" />
          <circle cx="26.6" cy="33.6" r="1.1" fill="#ffffff" />
          <circle cx="39.6" cy="33.6" r="1.1" fill="#ffffff" />
        </g>
        {/* cheeks and smile */}
        <ellipse cx="20.5" cy="41" rx="2.6" ry="1.6" fill="#ff8fb1" opacity="0.45" />
        <ellipse cx="43.5" cy="41" rx="2.6" ry="1.6" fill="#ff8fb1" opacity="0.45" />
        <path d="M27.5 42 Q32 46 36.5 42" stroke="#3d3bd4" strokeWidth="2" fill="none" strokeLinecap="round" />
      </svg>
      {/* shadow on the "floor", shrinking as it floats up */}
      {zweeft && (
        <span
          className="motion-safe:animate-schaduw mt-auto block rounded-[50%] bg-kb-ink"
          style={{ width: grootte * 0.6, height: Math.max(3, grootte * 0.08), filter: "blur(2px)", opacity: 0.3 }}
        />
      )}
    </span>
  );
}

/**
 * The floating way into Korda AI, on every KordaBudget page but its own. On
 * Transacties it sits above the + button. A dot means there are insights you
 * haven't seen yet.
 */
export function KordaAIKnop({ nieuw }: { nieuw: boolean }) {
  const { pathname } = useLocation();
  // Not on its own page, and not on a page of switches it would cover.
  if (pathname.startsWith("/budget/ai") || pathname.startsWith("/budget/meldingen")) return null;
  const boven = pathname.startsWith("/budget/transacties");
  return (
    <Link
      to="/budget/ai"
      aria-label={nieuw ? "Korda AI openen, er zijn nieuwe inzichten" : "Korda AI openen"}
      title="Korda AI"
      className={`fixed right-3 z-30 rounded-full p-1 transition-transform focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-kb-accent active:scale-95 md:right-6 ${
        boven
          ? "bottom-[calc(9.25rem+env(safe-area-inset-bottom))] md:bottom-28"
          : "bottom-[calc(4.75rem+env(safe-area-inset-bottom))] md:bottom-6"
      }`}
    >
      <KordaAIFiguur grootte={54} />
      {nieuw && (
        <span className="absolute right-1 top-2 h-3.5 w-3.5 rounded-full border-2 border-kb-bg bg-kb-accent">
          <span className="sr-only">Nieuw</span>
        </span>
      )}
    </Link>
  );
}
