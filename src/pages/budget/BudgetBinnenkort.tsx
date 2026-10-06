// src/pages/budget/BudgetBinnenkort.tsx — Transacties and Doelen until their phases land
import { ArrowLeftRight, Target } from "lucide-react";
import { Binnenkort, Pagina } from "@/features/budget/components/ui";

export function BudgetTransacties() {
  return (
    <Pagina titel="Transacties">
      <div className="max-w-2xl">
        <Binnenkort
          icon={<ArrowLeftRight className="h-5 w-5" />}
          titel="Na het koppelen van ING"
          tekst="Hier komen je bij- en afschrijvingen binnen. Claude stelt per transactie een potje voor; jij bevestigt met één tik."
        />
      </div>
    </Pagina>
  );
}

export function BudgetDoelen() {
  return (
    <Pagina titel="Doelen">
      <div className="max-w-2xl">
        <Binnenkort
          icon={<Target className="h-5 w-5" />}
          titel="Spaardoelen"
          tekst="Bijvoorbeeld vakantie €2.000 in juni: hoeveel per maand en of je op schema ligt. Wat aan het eind van de maand in je potjes over is, gaat hier naartoe."
        />
      </div>
    </Pagina>
  );
}
