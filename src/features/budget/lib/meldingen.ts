// src/features/budget/lib/meldingen.ts — local notifications and "install as app".
//
// These are shown by the service worker when the app is opened, not pushed by a
// server: a pot crossing 80% or a weekly recap appears the next time you open
// KordaBudget. True background push needs a scheduled server job, which comes
// with the bank sync (that job has to run anyway).
import { useEffect, useState } from "react";

const VOORKEUR = "kb-meldingen";

const lees = (k: string) => {
  try {
    return localStorage.getItem(k);
  } catch {
    return null;
  }
};
const schrijf = (k: string, v: string) => {
  try {
    localStorage.setItem(k, v);
  } catch {
    // Private mode: nothing remembered, nothing broken.
  }
};

export const meldingenOndersteund = () => typeof window !== "undefined" && "Notification" in window && "serviceWorker" in navigator;

export function meldingenAan(): boolean {
  return meldingenOndersteund() && Notification.permission === "granted" && lees(VOORKEUR) === "aan";
}

export async function zetMeldingen(aan: boolean): Promise<boolean> {
  if (!aan) {
    schrijf(VOORKEUR, "uit");
    return false;
  }
  if (!meldingenOndersteund()) return false;
  const toestemming = Notification.permission === "granted" ? "granted" : await Notification.requestPermission();
  schrijf(VOORKEUR, toestemming === "granted" ? "aan" : "uit");
  return toestemming === "granted";
}

async function toon(titel: string, tekst: string, tag: string, url: string) {
  const reg = await navigator.serviceWorker.ready;
  reg.active?.postMessage({ type: "SHOW_NOTIFICATION", title: titel, body: tekst, tag, url });
}

/** Show a notification once per key (e.g. per pot per month). */
export function meldEenmalig(sleutel: string, titel: string, tekst: string, url = "/budget/overzicht") {
  if (!meldingenAan()) return;
  const k = `kb-gemeld:${sleutel}`;
  if (lees(k)) return;
  schrijf(k, new Date().toISOString());
  void toon(titel, tekst, `kb-${sleutel}`, url);
}

/** ISO-ish week key, so the weekly recap fires at most once a week. */
export function weekSleutel(d = new Date()) {
  const start = new Date(d.getFullYear(), 0, 1);
  const week = Math.ceil(((d.getTime() - start.getTime()) / 86400000 + start.getDay() + 1) / 7);
  return `${d.getFullYear()}-w${week}`;
}

type InstallPrompt = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: string }> };

/** Chrome/Edge/Android offer an install prompt; iOS needs Share → Add to Home Screen. */
export function useInstalleren() {
  const [prompt, setPrompt] = useState<InstallPrompt | null>(null);
  const geinstalleerd =
    typeof window !== "undefined" &&
    (window.matchMedia?.("(display-mode: standalone)").matches ||
      (navigator as Navigator & { standalone?: boolean }).standalone === true);
  const ios = typeof navigator !== "undefined" && /iphone|ipad|ipod/i.test(navigator.userAgent);

  useEffect(() => {
    const vang = (e: Event) => {
      e.preventDefault();
      setPrompt(e as InstallPrompt);
    };
    window.addEventListener("beforeinstallprompt", vang);
    return () => window.removeEventListener("beforeinstallprompt", vang);
  }, []);

  return {
    geinstalleerd,
    ios,
    kan: !!prompt,
    installeer: async () => {
      if (!prompt) return;
      await prompt.prompt();
      setPrompt(null);
    },
  };
}
