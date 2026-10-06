// src/pages/budget/BudgetBankTerug.tsx — where ING sends you back after approving the link
import { useEffect, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { CheckCircle2, Loader2, XCircle } from "lucide-react";
import { Kaart, Pagina, foutTekst } from "@/features/budget/components/ui";
import { useRondKoppelingAf } from "@/features/budget/hooks/useBudgetData";

type Stand = { soort: "bezig" } | { soort: "klaar"; rekeningen: number; nieuw: number } | { soort: "fout"; tekst: string };

export default function BudgetBankTerug() {
  const [params] = useSearchParams();
  const afronden = useRondKoppelingAf();
  const [stand, setStand] = useState<Stand>({ soort: "bezig" });
  // The code works once; StrictMode and re-renders must not send it twice.
  const verstuurd = useRef(false);

  useEffect(() => {
    if (verstuurd.current) return;
    verstuurd.current = true;
    const code = params.get("code");
    const state = params.get("state");
    const fout = params.get("error");
    if (fout || !code || !state) {
      setStand({
        soort: "fout",
        tekst:
          fout === "access_denied"
            ? "Je hebt de koppeling bij ING geannuleerd. Er is niets gekoppeld."
            : params.get("error_description") ?? "ING stuurde je terug zonder toestemming. Probeer het opnieuw.",
      });
      return;
    }
    afronden
      .mutateAsync({ code, state })
      .then((u) => setStand({ soort: "klaar", rekeningen: u.rekeningen, nieuw: u.nieuw }))
      .catch((e) => setStand({ soort: "fout", tekst: foutTekst(e) }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <Pagina titel="ING koppelen">
      <Kaart className="max-w-md px-6 py-10 text-center">
        {stand.soort === "bezig" && (
          <>
            <Loader2 className="mx-auto h-8 w-8 animate-spin text-kb-accent" />
            <p className="mt-4 font-medium">Je rekeningen ophalen…</p>
            <p className="mt-1 text-sm text-kb-ink2">De eerste keer halen we drie maanden op. Dat duurt even.</p>
          </>
        )}
        {stand.soort === "klaar" && (
          <>
            <CheckCircle2 className="mx-auto h-9 w-9 text-kb-good-ink" />
            <p className="mt-4 font-medium">
              {stand.rekeningen === 1 ? "1 rekening gekoppeld" : `${stand.rekeningen} rekeningen gekoppeld`}
            </p>
            <p className="mt-1 text-sm text-kb-ink2">
              {stand.nieuw ? `${stand.nieuw} transacties binnengehaald.` : "Nog geen transacties gevonden."} Ze staan op
              privé; kies per rekening of je hem deelt.
            </p>
            <div className="mt-6 flex flex-col gap-2">
              <Link
                to="/budget/rekeningen"
                className="inline-flex min-h-[2.75rem] items-center justify-center rounded-xl bg-kb-accent px-4 text-sm font-medium text-white hover:bg-kb-accent-ink"
              >
                Rekeningen instellen
              </Link>
              <Link
                to="/budget/transacties"
                className="inline-flex min-h-[2.75rem] items-center justify-center rounded-xl border border-kb-line-strong px-4 text-sm font-medium hover:bg-kb-sunk"
              >
                Transacties indelen
              </Link>
            </div>
          </>
        )}
        {stand.soort === "fout" && (
          <>
            <XCircle className="mx-auto h-9 w-9 text-kb-crit-ink" />
            <p className="mt-4 font-medium">Koppelen is niet gelukt</p>
            <p className="mt-1 text-sm text-kb-ink2">{stand.tekst}</p>
            <Link
              to="/budget/rekeningen"
              className="mt-6 inline-flex min-h-[2.75rem] items-center justify-center rounded-xl bg-kb-accent px-4 text-sm font-medium text-white hover:bg-kb-accent-ink"
            >
              Terug naar rekeningen
            </Link>
          </>
        )}
      </Kaart>
    </Pagina>
  );
}
