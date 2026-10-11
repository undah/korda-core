// src/pages/BudgetLogin.tsx — KordaBudget sign-in and sign-up, with a link or code by email
//
// One form for both: enter your email, get a mail with a link and a code.
// New addresses get an account on the spot. The code is there for the iPhone
// home-screen app: a link from Mail opens in Safari, which has its own
// storage, so the app itself would stay signed out. Typing the code signs in
// right where you are. Password sign-in stays for accounts that have one.
import { useEigenDocument } from "@/features/budget/lib/eigenDocument";
import { useEffect, useState, type FormEvent } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { Mail } from "lucide-react";
import { supabase } from "@/lib/supabaseClient";
import { useAuth } from "@/auth/AuthProvider";
import { Kaart, Knop, Veld } from "@/features/budget/components/ui";

type LocationState = { from?: string };
type Stap = "email" | "code" | "wachtwoord";

const WACHTTIJD = 60;

function foutTekst(bericht: string) {
  if (bericht === "Invalid login credentials") return "E-mailadres of wachtwoord klopt niet";
  if (/expired|invalid/i.test(bericht) && /token|otp/i.test(bericht)) return "Die code klopt niet of is verlopen. Vraag een nieuwe aan.";
  if (/rate limit|only request this after/i.test(bericht)) return "Even wachten voor je een nieuwe mail vraagt.";
  if (/signups not allowed/i.test(bericht)) return "Nieuwe accounts zijn nog niet open.";
  return bericht;
}

export default function BudgetLogin() {
  useEigenDocument();
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  const naar = (location.state as LocationState | null)?.from ?? "/budget/overzicht";
  const [stap, setStap] = useState<Stap>("email");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [wachtwoord, setWachtwoord] = useState("");
  const [bezig, setBezig] = useState(false);
  const [wacht, setWacht] = useState(0);

  useEffect(() => {
    document.body.style.background = "#f3f3ef";
  }, []);

  // Back from a link that didn't work (#error=…&error_code=otp_expired): say so, then tidy the address.
  const [linkFout, setLinkFout] = useState<string | null>(null);
  useEffect(() => {
    const p = new URLSearchParams(window.location.hash.slice(1));
    const code = p.get("error_code") ?? p.get("error");
    if (!code) return;
    setLinkFout(
      code === "otp_expired"
        ? "Die link is al gebruikt of verlopen. Vraag hieronder een nieuwe aan; de code uit de mail werkt ook."
        : "Inloggen met die link lukte niet. Vraag hieronder een nieuwe aan.",
    );
    window.history.replaceState(null, "", window.location.pathname + window.location.search);
  }, []);

  // Signed in (from the link, the code, or another Korda app): straight in.
  useEffect(() => {
    if (user) navigate(naar, { replace: true });
  }, [user, naar, navigate]);

  useEffect(() => {
    if (wacht <= 0) return;
    const t = window.setTimeout(() => setWacht((w) => w - 1), 1000);
    return () => window.clearTimeout(t);
  }, [wacht]);

  const stuurMail = async () => {
    setBezig(true);
    try {
      const { error } = await supabase.auth.signInWithOtp({
        email: email.trim(),
        options: {
          shouldCreateUser: true,
          // Back to this page: it sends you on once the session from the link is in.
          emailRedirectTo: `${window.location.origin}/budget/login`,
        },
      });
      if (error) throw error;
      setStap("code");
      setCode("");
      setWacht(WACHTTIJD);
    } catch (err) {
      toast.error(foutTekst((err as Error).message));
    } finally {
      setBezig(false);
    }
  };

  const verstuur = async (e: FormEvent) => {
    e.preventDefault();
    if (stap === "email") return stuurMail();
    setBezig(true);
    try {
      if (stap === "code") {
        const { error } = await supabase.auth.verifyOtp({ email: email.trim(), token: code.replace(/\s/g, ""), type: "email" });
        if (error) throw error;
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password: wachtwoord });
        if (error) throw error;
      }
    } catch (err) {
      toast.error(foutTekst((err as Error).message));
    } finally {
      setBezig(false);
    }
  };

  return (
    <div className="kb-root min-h-screen bg-kb-bg text-kb-ink">
      <div className="mx-auto flex min-h-screen w-full max-w-md flex-col justify-center px-4 py-10">
        <Link to="/budget" className="text-sm font-semibold tracking-tight text-kb-accent-ink">
          KordaBudget
        </Link>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight">
          {stap === "code" ? "Check je mail" : stap === "wachtwoord" ? "Inloggen met wachtwoord" : "Inloggen of account maken"}
        </h1>
        <p className="mt-2 text-sm text-kb-ink2">
          {stap === "code" ? (
            <>
              We stuurden een mail naar <span className="font-medium text-kb-ink">{email.trim()}</span>. Tik op de link, of
              vul de code uit de mail hier in.
            </>
          ) : stap === "wachtwoord" ? (
            "Voor een Korda-account met een wachtwoord."
          ) : (
            "Vul je e-mailadres in. Je krijgt een mail met een link en een code, geen wachtwoord nodig. Nieuw? Dan maken we meteen je account."
          )}
        </p>

        {linkFout && stap === "email" && (
          <p role="alert" className="mt-5 rounded-xl border border-kb-warn/40 bg-kb-warn-soft px-4 py-3 text-sm text-kb-warn-ink">
            {linkFout}
          </p>
        )}

        <Kaart className="mt-6 p-5">
          <form onSubmit={verstuur} className="space-y-4">
            {stap !== "code" && (
              <Veld
                label="E-mailadres"
                type="email"
                autoComplete="email"
                inputMode="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            )}
            {stap === "code" && (
              <Veld
                label="Code uit de mail"
                inputMode="numeric"
                autoComplete="one-time-code"
                pattern="[0-9 ]{6,10}"
                maxLength={10}
                placeholder="123456"
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/[^0-9 ]/g, ""))}
                className="[&_input]:text-center [&_input]:text-xl [&_input]:tabular-nums [&_input]:tracking-[0.3em]"
                required
                autoFocus
              />
            )}
            {stap === "wachtwoord" && (
              <Veld
                label="Wachtwoord"
                type="password"
                autoComplete="current-password"
                value={wachtwoord}
                onChange={(e) => setWachtwoord(e.target.value)}
                required
              />
            )}
            <Knop type="submit" className="w-full" disabled={bezig}>
              {stap === "email" ? (
                <>
                  <Mail className="h-4 w-4" /> Stuur me een link
                </>
              ) : (
                "Inloggen"
              )}
            </Knop>
          </form>
        </Kaart>

        <div className="mt-5 flex flex-col items-start gap-3 text-sm text-kb-ink2">
          {stap === "code" && (
            <>
              <button
                type="button"
                disabled={wacht > 0 || bezig}
                onClick={stuurMail}
                className="underline-offset-4 hover:text-kb-ink hover:underline disabled:no-underline disabled:opacity-60"
              >
                {wacht > 0 ? `Geen mail? Opnieuw sturen kan over ${wacht} s` : "Geen mail gekregen? Stuur opnieuw"}
              </button>
              <button type="button" onClick={() => setStap("email")} className="underline-offset-4 hover:text-kb-ink hover:underline">
                Ander e-mailadres
              </button>
            </>
          )}
          {stap === "email" && (
            <button type="button" onClick={() => setStap("wachtwoord")} className="underline-offset-4 hover:text-kb-ink hover:underline">
              Inloggen met wachtwoord
            </button>
          )}
          {stap === "wachtwoord" && (
            <button type="button" onClick={() => setStap("email")} className="underline-offset-4 hover:text-kb-ink hover:underline">
              Liever een link per mail
            </button>
          )}
        </div>

        <p className="mt-8 text-xs text-kb-ink3">
          Door verder te gaan ga je akkoord met de{" "}
          <Link to="/budget/voorwaarden" className="underline">
            voorwaarden
          </Link>{" "}
          en het{" "}
          <Link to="/budget/privacy" className="underline">
            privacybeleid
          </Link>
          . Je partner maakt een eigen account en sluit aan met een code.
        </p>
      </div>
    </div>
  );
}
