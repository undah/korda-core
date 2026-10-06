// src/pages/BudgetLogin.tsx — KordaBudget sign-in / sign-up (light, mobile-first)
import { useEffect, useState, type FormEvent } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { supabase } from "@/lib/supabaseClient";
import { useAuth } from "@/auth/AuthProvider";
import { Kaart, Knop, Veld } from "@/features/budget/components/ui";

type LocationState = { from?: string };

export default function BudgetLogin() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  const naar = (location.state as LocationState | null)?.from ?? "/budget/overzicht";
  const [modus, setModus] = useState<"inloggen" | "registreren">("inloggen");
  const [email, setEmail] = useState("");
  const [wachtwoord, setWachtwoord] = useState("");
  const [bezig, setBezig] = useState(false);

  useEffect(() => {
    document.body.style.background = "#f3f3ef";
  }, []);

  // Already signed in (Korda shares one account across its apps): skip the form.
  useEffect(() => {
    if (user) navigate(naar, { replace: true });
  }, [user, naar, navigate]);

  const verstuur = async (e: FormEvent) => {
    e.preventDefault();
    setBezig(true);
    try {
      if (modus === "inloggen") {
        const { error } = await supabase.auth.signInWithPassword({ email, password: wachtwoord });
        if (error) throw error;
      } else {
        const { data, error } = await supabase.auth.signUp({
          email,
          password: wachtwoord,
          options: { emailRedirectTo: `${window.location.origin}/budget/overzicht` },
        });
        if (error) throw error;
        if (!data.session) {
          toast.success("Check je mail om je account te bevestigen");
          setModus("inloggen");
        }
      }
    } catch (err) {
      const bericht = (err as Error).message;
      toast.error(
        bericht === "Invalid login credentials" ? "E-mailadres of wachtwoord klopt niet" : bericht,
      );
    } finally {
      setBezig(false);
    }
  };

  return (
    <div className="kb-root min-h-screen bg-[#f3f3ef] text-[#1a1a19]">
      <div className="mx-auto flex min-h-screen w-full max-w-md flex-col justify-center px-4 py-10">
        <Link to="/budget" className="text-sm font-semibold tracking-tight text-[#1d46b0]">
          KordaBudget
        </Link>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight">
          {modus === "inloggen" ? "Inloggen" : "Account maken"}
        </h1>
        <p className="mt-2 text-sm text-[#5c5c58]">
          {modus === "inloggen"
            ? "Met je Korda-account. Heb je die al voor een andere Korda-app, dan werkt hij hier ook."
            : "Je partner maakt straks een eigen account en sluit aan met een code."}
        </p>

        <Kaart className="mt-6 p-5">
          <form onSubmit={verstuur} className="space-y-4">
            <Veld
              label="E-mailadres"
              type="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
            <Veld
              label="Wachtwoord"
              type="password"
              autoComplete={modus === "inloggen" ? "current-password" : "new-password"}
              minLength={modus === "registreren" ? 8 : undefined}
              hint={modus === "registreren" ? "Minimaal 8 tekens" : undefined}
              value={wachtwoord}
              onChange={(e) => setWachtwoord(e.target.value)}
              required
            />
            <Knop type="submit" className="w-full" disabled={bezig}>
              {modus === "inloggen" ? "Inloggen" : "Account maken"}
            </Knop>
          </form>
        </Kaart>

        <button
          type="button"
          onClick={() => setModus((m) => (m === "inloggen" ? "registreren" : "inloggen"))}
          className="mt-5 text-sm text-[#5c5c58] underline-offset-4 hover:text-[#1a1a19] hover:underline"
        >
          {modus === "inloggen" ? "Nog geen account? Maak er een" : "Al een account? Log in"}
        </button>
      </div>
    </div>
  );
}
