// src/pages/KordaBudget.tsx — public landing for KordaBudget
import { useEffect } from "react";
import { Link } from "react-router-dom";
import { Landmark, PiggyBank, Sparkles, Users } from "lucide-react";
import { useAuth } from "@/auth/AuthProvider";
import { useEigenDocument } from "@/features/budget/lib/eigenDocument";

const PUNTEN = [
  {
    icon: PiggyBank,
    titel: "Potjes per categorie",
    tekst: "Een limiet per maand voor boodschappen, vaste lasten en uit eten. Wat over is, gaat naar sparen.",
  },
  {
    icon: Users,
    titel: "Samen, met privacy",
    tekst: "Eén huishouden, ieder een eigen login. Per rekening kies je: gedeeld of privé.",
  },
  {
    icon: Landmark,
    titel: "ING gekoppeld",
    tekst: "Je uitgaven komen vanzelf binnen. Geen afschriften downloaden, niets overtypen.",
  },
  {
    icon: Sparkles,
    titel: "Slim ingedeeld",
    tekst: "Claude stelt voor in welk potje een uitgave hoort. Jij bevestigt, de app onthoudt het.",
  },
];

export default function KordaBudget() {
  const { user } = useAuth();
  useEigenDocument();

  useEffect(() => {
    const vorige = document.body.style.background;
    document.body.style.background = "#f3f3ef";
    return () => {
      document.body.style.background = vorige;
    };
  }, []);

  return (
    <div className="kb-root min-h-screen bg-kb-bg text-kb-ink">
      <header className="mx-auto flex w-full max-w-5xl items-center justify-between px-4 py-5 sm:px-6">
        <Link to="/" className="text-sm font-semibold tracking-tight">
          Korda<span className="text-kb-accent-ink">Budget</span>
        </Link>
        <Link
          to={user ? "/budget/overzicht" : "/budget/login"}
          className="rounded-xl px-3 py-2 text-sm font-medium text-kb-accent-ink hover:bg-kb-accent-soft"
        >
          {user ? "Openen" : "Inloggen"}
        </Link>
      </header>

      <main className="mx-auto w-full max-w-5xl px-4 pb-16 pt-10 sm:px-6 sm:pt-20">
        <p className="text-sm font-medium text-kb-accent-ink">Huishoudbudget</p>
        <h1 className="mt-3 max-w-2xl text-4xl font-semibold leading-[1.1] tracking-tight sm:text-6xl">
          Samen grip op je geld, zonder spreadsheet.
        </h1>
        <p className="mt-5 max-w-xl text-base text-kb-ink2 sm:text-lg">
          Verdeel je maand over potjes, zie in één oogopslag wat er nog over is, en laat de rest
          vanzelf gaan.
        </p>
        <Link
          to={user ? "/budget/overzicht" : "/budget/login"}
          className="mt-8 inline-flex min-h-[3rem] items-center rounded-xl bg-kb-accent px-6 text-sm font-medium text-white transition-colors hover:bg-kb-accent-ink"
        >
          {user ? "Naar mijn budget" : "Begin met je budget"}
        </Link>

        <ul className="mt-16 grid gap-4 sm:grid-cols-2">
          {PUNTEN.map((p) => (
            <li key={p.titel} className="rounded-2xl border border-kb-line bg-kb-surface p-5">
              <p.icon className="h-5 w-5 text-kb-accent-ink" strokeWidth={1.75} />
              <p className="mt-3 font-medium">{p.titel}</p>
              <p className="mt-1 text-sm text-kb-ink2">{p.tekst}</p>
            </li>
          ))}
        </ul>
      </main>
    </div>
  );
}
