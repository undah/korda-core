// src/features/budget/lib/meldingen.ts — notifications and "install as app".
//
// Two routes to the same notices, with the same tags so one never doubles the
// other: the app shows them itself when it's opened, and the background job
// (functions/api/budget/cron.js) pushes them to devices that turned
// notifications on, when the app is closed.
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";

/** Public half of the VAPID key; the private half is a Cloudflare secret. */
const VAPID_PUBLIC = "BGFItmB0B59Df1pvoU7RwID7JmHpRJI5Fr51oPThIU-imjfeWT5d_yKHTFCRI31S2zyd7jAVxI_UiZDwHOGg8sQ";

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

const vanB64url = (s: string) => {
  const b = atob(s.replace(/-/g, "+").replace(/_/g, "/") + "=".repeat((4 - (s.length % 4)) % 4));
  return Uint8Array.from(b, (c) => c.charCodeAt(0));
};

/** Push needs PushManager; on iPhone only once KordaBudget is on the home screen. */
export const pushOndersteund = () => meldingenOndersteund() && "PushManager" in window;

/** Register this device with the push service and remember it for the signed-in user. */
async function abonneer() {
  if (!pushOndersteund()) return;
  const reg = await navigator.serviceWorker.ready;
  const sub =
    (await reg.pushManager.getSubscription()) ??
    (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: vanB64url(VAPID_PUBLIC) }));
  const json = sub.toJSON();
  const { error } = await supabase.rpc("budget_bewaar_push", {
    p_endpoint: json.endpoint,
    p_p256dh: json.keys?.p256dh,
    p_auth: json.keys?.auth,
  });
  if (error) throw error;
}

async function zegOp() {
  if (!pushOndersteund()) return;
  const reg = await navigator.serviceWorker.ready;
  const sub = await reg.pushManager.getSubscription();
  if (!sub) return;
  await supabase.from("budget_push_abonnementen").delete().eq("endpoint", sub.endpoint);
  await sub.unsubscribe();
}

export async function zetMeldingen(aan: boolean): Promise<boolean> {
  if (!aan) {
    schrijf(VOORKEUR, "uit");
    await zegOp().catch(() => {});
    return false;
  }
  if (!meldingenOndersteund()) return false;
  const toestemming = Notification.permission === "granted" ? "granted" : await Notification.requestPermission();
  schrijf(VOORKEUR, toestemming === "granted" ? "aan" : "uit");
  // Local notices work without push; push failing (e.g. before budget_push.sql) isn't fatal.
  if (toestemming === "granted") await abonneer().catch(() => {});
  return toestemming === "granted";
}

/**
 * Keep this device's push subscription current: browsers sometimes rotate it,
 * and someone who turned notifications on before push existed gets it now.
 */
export function useHoudPushBij() {
  useEffect(() => {
    if (meldingenAan()) void abonneer().catch(() => {});
  }, []);
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
