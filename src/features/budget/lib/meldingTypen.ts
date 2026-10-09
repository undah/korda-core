// src/features/budget/lib/meldingTypen.ts — every kind of notification KordaBudget sends.
//
// One list for both sides: the background job tags each notification with its
// type and skips the ones a person turned off; the settings screen shows this
// list. Plain TypeScript, so the Cloudflare functions can import it too.

export const MELDING_TYPEN = [
  { id: "potje_bijna", groep: "Potjes", titel: "Potje bijna op", uitleg: "Als een potje over de 80% van de limiet gaat." },
  { id: "potje_over", groep: "Potjes", titel: "Over de limiet", uitleg: "Als een potje over de limiet gaat." },
  { id: "tempo", groep: "Potjes", titel: "Op dit tempo te veel", uitleg: "Midden in de maand, als een potje op dit tempo over de limiet gaat." },
  { id: "salaris", groep: "Geld in en uit", titel: "Salaris binnen", uitleg: "Als je inkomen binnen is, met een voorstel om iets opzij te zetten." },
  { id: "grote_uitgave", groep: "Geld in en uit", titel: "Grote uitgave", uitleg: "Een betaling van € 150 of meer die nog geen potje heeft." },
  { id: "vaste_last", groep: "Geld in en uit", titel: "Vaste last morgen", uitleg: "De avond voordat een vaste last eraf gaat." },
  { id: "dubbel", groep: "Geld in en uit", titel: "Mogelijk dubbel afgeschreven", uitleg: "Dezelfde partij, hetzelfde bedrag, binnen een paar dagen." },
  { id: "week", groep: "Overzicht", titel: "Je week", uitleg: "Zondagavond: wat er deze week uit de gedeelde potjes ging." },
  { id: "maand_afsluiten", groep: "Overzicht", titel: "Maand afsluiten", uitleg: "Begin van de maand: wat er over is, en waar het heen kan." },
  { id: "inzichten", groep: "Overzicht", titel: "Nieuwe inzichten", uitleg: "Zondagavond en op de 1e: wat Korda AI opviel." },
  { id: "indelen", groep: "Overzicht", titel: "Betalingen indelen", uitleg: "Hooguit wekelijks, als er 10 of meer op een potje wachten." },
  { id: "mijlpaal", groep: "Doelen", titel: "Mijlpalen", uitleg: "Een spaardoel op 25, 50, 75 of 100%, en maanden op rij binnen budget." },
  { id: "toestemming", groep: "Bankkoppeling", titel: "Koppeling verloopt", uitleg: "14 en 3 dagen voordat je ING-koppeling verloopt." },
] as const;

export type MeldingType = (typeof MELDING_TYPEN)[number]["id"];
