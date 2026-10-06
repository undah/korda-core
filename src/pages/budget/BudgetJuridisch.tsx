// src/pages/budget/BudgetJuridisch.tsx — privacy statement and terms, public.
// Enable Banking links to both from the ING consent screen, so they must load
// without signing in.
import { useEffect, type ReactNode } from "react";
import { Link } from "react-router-dom";

const CONTACT = "gdionne.p@gmail.com";
const BIJGEWERKT = "6 oktober 2026";

function Blok({ titel, children }: { titel: string; children: ReactNode }) {
  return (
    <section className="mt-8">
      <h2 className="text-lg font-semibold tracking-tight">{titel}</h2>
      <div className="mt-2 space-y-3 text-[0.95rem] leading-relaxed text-kb-ink2">{children}</div>
    </section>
  );
}

function Omhulsel({ titel, children }: { titel: string; children: ReactNode }) {
  useEffect(() => {
    const vorige = document.body.style.background;
    document.body.style.background = "#f4f3ee";
    document.title = `${titel} · KordaBudget`;
    return () => {
      document.body.style.background = vorige;
    };
  }, [titel]);

  return (
    <div className="kb-root min-h-screen bg-kb-bg text-kb-ink">
      <header className="mx-auto flex w-full max-w-3xl items-center justify-between px-4 py-5 sm:px-6">
        <Link to="/budget" className="text-sm font-semibold tracking-tight">
          Korda<span className="text-kb-accent-ink">Budget</span>
        </Link>
        <nav className="flex gap-1 text-sm">
          <Link to="/budget/privacy" className="rounded-lg px-2.5 py-1.5 text-kb-ink2 hover:bg-kb-sunk hover:text-kb-ink">
            Privacy
          </Link>
          <Link to="/budget/voorwaarden" className="rounded-lg px-2.5 py-1.5 text-kb-ink2 hover:bg-kb-sunk hover:text-kb-ink">
            Voorwaarden
          </Link>
        </nav>
      </header>
      <main className="mx-auto w-full max-w-3xl px-4 pb-20 pt-6 sm:px-6">
        <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">{titel}</h1>
        <p className="mt-2 text-sm text-kb-ink3">Bijgewerkt op {BIJGEWERKT}</p>
        {children}
        <p className="mt-12 border-t border-kb-line pt-6 text-sm text-kb-ink2">
          Vragen? Mail naar <span className="font-medium text-kb-ink">{CONTACT}</span>.
        </p>
      </main>
    </div>
  );
}

export function BudgetPrivacy() {
  return (
    <Omhulsel titel="Privacyverklaring">
      <p className="mt-6 text-[0.95rem] leading-relaxed text-kb-ink2">
        KordaBudget is een huishoudbudget voor eigen gebruik. Deze verklaring legt uit welke gegevens de
        app gebruikt, waarvoor, en wat je ermee kunt.
      </p>

      <Blok titel="Welke gegevens">
        <p>
          <strong className="text-kb-ink">Je account:</strong> je e-mailadres en de naam die je in een
          huishouden gebruikt.
        </p>
        <p>
          <strong className="text-kb-ink">Je bankgegevens</strong>, alleen als je zelf een rekening koppelt: de
          naam en het IBAN van de rekeningen die je bij ING aanvinkt, en hun transacties (datum, bedrag,
          tegenpartij en omschrijving).
        </p>
        <p>
          <strong className="text-kb-ink">Wat je zelf invult:</strong> potjes, limieten, spaardoelen, notities en
          handmatige uitgaven.
        </p>
      </Blok>

      <Blok titel="Waarvoor">
        <p>
          Alleen om je budget te laten werken: uitgaven in potjes verdelen, laten zien hoeveel er over is,
          vaste lasten herkennen en verrekenen tussen huisgenoten. De app kan alleen lezen; er kan nooit geld
          worden overgemaakt. Je gegevens worden niet verkocht en niet gebruikt voor reclame.
        </p>
        <p>De grondslag is je toestemming: je koppelt zelf, en je kunt dat op elk moment stoppen.</p>
      </Blok>

      <Blok titel="Wie het kan zien">
        <p>
          Jij, en de leden van het huishouden waarin je de rekening koppelt, volgens jouw instelling per
          rekening. Een privé-rekening blijft privé: anderen zien daarvan alleen de uitgaven die jij in een
          gedeeld potje zet. Een gedeelde rekening zien ze helemaal.
        </p>
      </Blok>

      <Blok titel="Diensten die we gebruiken">
        <p>
          <strong className="text-kb-ink">Enable Banking</strong> (Enable Banking Oy, Finland) maakt de
          verbinding met ING. Het is een onder PSD2 erkende dienst voor rekeninginformatie. Jij geeft de
          toestemming in je eigen ING-omgeving; die loopt na hooguit 180 dagen vanzelf af.
        </p>
        <p>
          <strong className="text-kb-ink">Supabase</strong> bewaart de gegevens in een beveiligde database.{" "}
          <strong className="text-kb-ink">Cloudflare</strong> host de app.
        </p>
        <p>
          <strong className="text-kb-ink">Anthropic (Claude)</strong> kan worden gebruikt om een potje voor te
          stellen bij een uitgave. Daarvoor gaan alleen de tegenpartij, omschrijving en het bedrag mee, en
          Anthropic gebruikt die niet om modellen te trainen. Jij bevestigt altijd zelf.
        </p>
      </Blok>

      <Blok titel="Hoe lang">
        <p>
          Zolang je de app gebruikt. Ontkoppel je een rekening, dan wordt er niets nieuws meer opgehaald en
          trekt ING je toestemming in. Verwijder je een rekening, je huishouden of je account, dan worden de
          bijbehorende transacties gewist.
        </p>
      </Blok>

      <Blok titel="Je rechten">
        <p>
          Je mag je gegevens inzien, laten verbeteren of laten verwijderen, en je toestemming intrekken. Veel
          daarvan kan direct in de app (Meer → Rekeningen). Voor de rest, of als je een kopie wilt, mail ons.
          Ben je het niet eens met hoe we met je gegevens omgaan, dan kun je een klacht indienen bij de
          Autoriteit Persoonsgegevens.
        </p>
      </Blok>
    </Omhulsel>
  );
}

export function BudgetVoorwaarden() {
  return (
    <Omhulsel titel="Voorwaarden">
      <Blok titel="Wat KordaBudget is">
        <p>
          Een app om samen een huishoudbudget bij te houden. Het is een hulpmiddel, geen financieel advies.
          Beslissingen over je geld neem je zelf.
        </p>
      </Blok>

      <Blok titel="De bankkoppeling">
        <p>
          De app leest alleen de transacties van de rekeningen die jij bij ING aanvinkt. Er kunnen
          geen betalingen worden gedaan. De koppeling loopt via Enable Banking en duurt hooguit 180 dagen;
          daarna vraagt de app je opnieuw te koppelen. Je kunt de koppeling altijd intrekken in de app of
          bij ING.
        </p>
      </Blok>

      <Blok titel="Jouw verantwoordelijkheid">
        <p>
          Houd je inloggegevens voor jezelf. Koppel alleen rekeningen waarvan je zelf rekeninghouder bent.
          Bedenk bij het delen van een rekening dat de andere leden van je huishouden dan alle transacties
          daarvan zien.
        </p>
      </Blok>

      <Blok titel="Geen garanties">
        <p>
          We doen ons best om alles juist en beschikbaar te houden, maar bedragen kunnen afwijken van je
          bankafschrift (bijvoorbeeld door een vertraging bij de bank), en de app kan soms niet werken. Je
          bankafschrift is altijd leidend. We zijn niet aansprakelijk voor schade door het gebruik van de
          app, behalve als de wet dat anders bepaalt.
        </p>
      </Blok>

      <Blok titel="Stoppen en wijzigingen">
        <p>
          Je kunt op elk moment stoppen: ontkoppel je rekeningen en verwijder je huishouden. Veranderen deze
          voorwaarden, dan zie je dat aan de datum bovenaan.
        </p>
      </Blok>
    </Omhulsel>
  );
}
