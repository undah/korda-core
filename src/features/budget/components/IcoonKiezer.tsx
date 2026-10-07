// src/features/budget/components/IcoonKiezer.tsx — pick a pot's icon.
//
// Icons are emoji: they look right on every phone without shipping an icon
// set, and they read at a glance in a pot tile. Grouped so the grid stays
// small, searchable by Dutch words, and any other emoji can be typed in.
// Only emoji up to Unicode 14, so older iPhones show them too.
import { useMemo, useState } from "react";
import { Search } from "lucide-react";

type Icoon = [emoji: string, woorden: string];

const GROEPEN: Array<{ id: string; titel: string; iconen: Icoon[] }> = [
  {
    id: "wonen",
    titel: "Wonen",
    iconen: [
      ["🏠", "huis hypotheek huur wonen"], ["🏡", "huis tuin wonen"], ["🏢", "appartement flat kantoor"],
      ["🔑", "sleutel huur verhuizen"], ["🛋️", "bank meubels interieur"], ["🛏️", "bed slaapkamer meubels"],
      ["🪴", "plant tuin"], ["🌳", "tuin boom"], ["🧹", "schoonmaak"], ["🧺", "was wasmiddel"],
      ["🧼", "zeep schoonmaak drogisterij"], ["🧻", "wc papier huishouden"], ["🔧", "onderhoud reparatie klusjes"],
      ["🔨", "klussen bouwmarkt"], ["🧰", "gereedschap klussen"], ["🪜", "klussen trap"],
      ["🎨", "verf schilderen"], ["💡", "energie stroom licht"], ["🔥", "gas verwarming"],
      ["💧", "water"], ["⚡", "stroom energie elektra"], ["🌡️", "verwarming energie"],
      ["🚿", "badkamer water"], ["🛁", "badkamer"], ["🚪", "deur huis"], ["🗑️", "afval gemeente belasting"],
    ],
  },
  {
    id: "eten",
    titel: "Eten & drinken",
    iconen: [
      ["🛒", "boodschappen supermarkt"], ["🧺", "boodschappen markt"], ["🥖", "brood bakker"], ["🧀", "kaas"],
      ["🥩", "vlees slager"], ["🐟", "vis"], ["🍎", "fruit"], ["🥦", "groente"], ["🥚", "eieren ontbijt"],
      ["🍝", "pasta uit eten restaurant"], ["🍕", "pizza bezorgen"], ["🍔", "burger fastfood"],
      ["🍟", "patat snackbar"], ["🌮", "taco mexicaans"], ["🍣", "sushi japans"], ["🍜", "noodles aziatisch"],
      ["🥗", "salade lunch"], ["🥪", "lunch broodje"], ["🍰", "taart gebak"], ["🍩", "donut snoep"],
      ["🍫", "chocola snoep"], ["🍦", "ijs"], ["☕", "koffie"], ["🍵", "thee"], ["🍺", "bier kroeg"],
      ["🍷", "wijn"], ["🥂", "feest borrel"], ["🍹", "cocktail uitgaan"], ["🥤", "frisdrank"],
      ["🍽️", "uit eten restaurant"], ["🥡", "afhalen bezorgen"],
    ],
  },
  {
    id: "vervoer",
    titel: "Vervoer",
    iconen: [
      ["🚗", "auto"], ["🚙", "auto suv"], ["⛽", "benzine tanken brandstof"], ["🔋", "laden elektrisch"],
      ["🅿️", "parkeren"], ["🛞", "banden onderhoud auto"], ["🚲", "fiets"], ["🛵", "scooter brommer"],
      ["🏍️", "motor"], ["🛴", "step"], ["🚌", "bus ov"], ["🚆", "trein ns ov"], ["🚇", "metro ov"],
      ["🚊", "tram ov"], ["🚕", "taxi"], ["✈️", "vliegen vakantie"], ["🚢", "boot veerboot"],
      ["🛣️", "tol snelweg reizen"],
    ],
  },
  {
    id: "gezondheid",
    titel: "Zorg & sport",
    iconen: [
      ["💊", "medicijnen apotheek zorg"], ["🩺", "dokter huisarts zorg"], ["🏥", "ziekenhuis zorg"],
      ["🦷", "tandarts"], ["👓", "bril opticien"], ["💉", "vaccinatie"], ["🩹", "pleister ehbo"],
      ["🧠", "therapie"], ["💇", "kapper"], ["💅", "nagels beauty"], ["💄", "make-up beauty"],
      ["🧴", "verzorging crème drogisterij"], ["🪒", "scheren"], ["🧘", "yoga"],
      ["🏋️", "fitness sportschool gym"], ["⚽", "voetbal sport club"], ["🎾", "tennis padel"],
      ["🏊", "zwemmen"], ["🚴", "wielrennen"], ["🏃", "hardlopen"], ["🥊", "boksen vechtsport"],
    ],
  },
  {
    id: "gezin",
    titel: "Kinderen & dieren",
    iconen: [
      ["👶", "baby kind"], ["🍼", "baby fles"], ["🧸", "speelgoed"], ["🎒", "school tas"], ["🏫", "school opvang"],
      ["✏️", "school schrijven"], ["🎓", "studie opleiding"], ["👪", "gezin familie"], ["🐶", "hond"],
      ["🐱", "kat"], ["🐾", "huisdier dierenarts"], ["🐠", "vissen aquarium"], ["🐦", "vogel"],
      ["🐴", "paard manege"], ["🐰", "konijn"],
    ],
  },
  {
    id: "vrije-tijd",
    titel: "Vrije tijd",
    iconen: [
      ["🎉", "feest misc overig"], ["🎁", "cadeau verjaardag"], ["🎂", "verjaardag taart"], ["🎄", "kerst"],
      ["🎬", "film bioscoop"], ["🎟️", "tickets concert evenement"], ["🎭", "theater"], ["🎵", "muziek"],
      ["🎸", "gitaar muziek hobby"], ["🎮", "games gamen"], ["🎲", "spel spelletjes"], ["🧩", "puzzel hobby"],
      ["📚", "boeken"], ["📖", "lezen boek"], ["📷", "foto camera"], ["🖌️", "hobby schilderen"],
      ["🧶", "breien hobby"], ["🎳", "bowlen uitje"], ["🏖️", "vakantie strand"], ["⛺", "kamperen"],
      ["🏕️", "camping"], ["🧳", "vakantie reizen koffer"], ["🗺️", "reizen"], ["🎢", "pretpark uitje"],
      ["⛷️", "skiën wintersport"],
    ],
  },
  {
    id: "spullen",
    titel: "Kleding & spullen",
    iconen: [
      ["👕", "kleding"], ["👖", "kleding broek"], ["👗", "jurk kleding"], ["🧥", "jas kleding"], ["👟", "schoenen"],
      ["👠", "schoenen"], ["👜", "tas"], ["🕶️", "zonnebril"], ["⌚", "horloge"], ["💍", "sieraden"],
      ["🛍️", "shoppen winkelen"], ["📦", "pakketje online bestellen"], ["🧸", "speelgoed"],
    ],
  },
  {
    id: "tech",
    titel: "Tech & abonnementen",
    iconen: [
      ["📺", "tv streaming netflix abonnement"], ["📱", "telefoon abonnement"], ["💻", "laptop computer"],
      ["🖥️", "computer"], ["🎧", "muziek spotify koptelefoon"], ["📡", "internet tv"], ["📶", "internet wifi"],
      ["🔌", "stroom elektronica"], ["🖨️", "printer"], ["☁️", "cloud opslag"], ["🎮", "games abonnement"],
      ["📰", "krant tijdschrift"], ["📬", "post"],
    ],
  },
  {
    id: "geld",
    titel: "Geld & werk",
    iconen: [
      ["💶", "geld euro"], ["💰", "geld sparen"], ["🐷", "spaarpot sparen"], ["🪙", "munten"], ["🏦", "bank"],
      ["💳", "creditcard betalen"], ["🧾", "rekening bon"], ["📈", "beleggen"], ["📉", "schuld"],
      ["💼", "werk zakelijk"], ["🏛️", "belasting overheid gemeente"], ["📊", "budget"], ["🧮", "rekenen"],
      ["⚖️", "advocaat juridisch"], ["📄", "documenten"], ["🛡️", "verzekering"], ["☂️", "verzekering buffer"],
      ["🤝", "verrekenen lening"], ["🎯", "doel"],
    ],
  },
  {
    id: "overig",
    titel: "Overig",
    iconen: [
      ["❤️", "liefde goed doel"], ["🙏", "goed doel donatie"], ["⭐", "ster favoriet"], ["✨", "extra"],
      ["🔔", "melding"], ["📌", "vast"], ["🌍", "wereld goed doel"], ["🌱", "duurzaam"], ["♻️", "recycling"],
      ["💐", "bloemen"], ["🕯️", "kaarsen"], ["🧷", "overig"], ["❓", "onbekend overig"], ["🌈", "regenboog"],
    ],
  },
];

/** One emoji (a single grapheme with a pictograph), or null. */
type Segmenter = { segment(t: string): Iterable<{ segment: string }> };
type MetSegmenter = { Segmenter?: new (taal: string, o: { granularity: "grapheme" }) => Segmenter };

function eersteEmoji(tekst: string): string | null {
  // A grapheme keeps multi-part emoji (👨‍👩‍👧, 🏳️‍🌈) whole; older browsers fall back to one code point.
  const Seg = (Intl as unknown as MetSegmenter).Segmenter;
  const eerste = Seg ? [...new Seg("nl", { granularity: "grapheme" }).segment(tekst.trim())][0]?.segment : [...tekst.trim()][0];
  return eerste && /\p{Extended_Pictographic}/u.test(eerste) ? eerste : null;
}

export function IcoonKiezer({ waarde, onChange }: { waarde: string; onChange: (emoji: string) => void }) {
  const [groep, setGroep] = useState(() => GROEPEN.find((g) => g.iconen.some(([e]) => e === waarde))?.id ?? GROEPEN[0].id);
  const [zoek, setZoek] = useState("");
  const [eigen, setEigen] = useState("");

  const lijst = useMemo(() => {
    const z = zoek.trim().toLowerCase();
    if (!z) return GROEPEN.find((g) => g.id === groep)?.iconen.map(([e]) => e) ?? [];
    const gevonden = GROEPEN.flatMap((g) => g.iconen).filter(([, w]) => w.split(" ").some((x) => x.startsWith(z)) || w.includes(z));
    return [...new Set(gevonden.map(([e]) => e))];
  }, [groep, zoek]);

  return (
    <div className="min-w-0">
      <div className="flex items-center gap-3">
        <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-kb-accent-soft text-2xl" aria-label="Gekozen icoon">
          {waarde}
        </span>
        <label className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-kb-ink3" />
          <input
            type="search"
            value={zoek}
            onChange={(e) => setZoek(e.target.value)}
            placeholder="Zoek: auto, hond, sparen…"
            aria-label="Icoon zoeken"
            className="h-11 w-full rounded-xl border border-kb-line-strong bg-white pl-9 pr-3 text-base outline-none focus:border-kb-accent"
          />
        </label>
      </div>

      {!zoek && (
        <div className="-mx-1 mt-3 flex gap-1.5 overflow-x-auto px-1 pb-1" role="tablist" aria-label="Soort icoon">
          {GROEPEN.map((g) => (
            <button
              key={g.id}
              type="button"
              role="tab"
              aria-selected={groep === g.id}
              onClick={() => setGroep(g.id)}
              className={`shrink-0 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ${
                groep === g.id ? "border-kb-accent bg-kb-accent-soft text-kb-accent-ink" : "border-kb-line-strong bg-white text-kb-ink2 hover:bg-kb-sunk"
              }`}
            >
              {g.titel}
            </button>
          ))}
        </div>
      )}

      <div className="mt-2 grid grid-cols-8 gap-1.5">
        {lijst.map((e) => (
          <button
            key={e}
            type="button"
            aria-label={`Icoon ${e}`}
            aria-pressed={waarde === e}
            onClick={() => onChange(e)}
            className={`flex aspect-square items-center justify-center rounded-xl text-xl transition-colors ${
              waarde === e ? "bg-kb-accent-soft ring-2 ring-kb-accent" : "bg-kb-bg hover:bg-kb-sunk"
            }`}
          >
            {e}
          </button>
        ))}
      </div>
      {zoek && lijst.length === 0 && <p className="mt-2 text-sm text-kb-ink2">Niets gevonden. Typ hieronder je eigen emoji.</p>}

      <label className="mt-3 flex items-center gap-2 text-sm text-kb-ink2">
        Eigen emoji:
        <input
          value={eigen}
          onChange={(e) => {
            setEigen(e.target.value);
            const emoji = eersteEmoji(e.target.value);
            if (emoji) onChange(emoji);
          }}
          placeholder="🙂"
          aria-label="Eigen emoji typen of plakken"
          className="h-10 w-16 rounded-lg border border-kb-line-strong bg-white text-center text-xl outline-none placeholder:opacity-30 focus:border-kb-accent"
        />
      </label>
    </div>
  );
}
