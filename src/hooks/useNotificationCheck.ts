import { useEffect } from "react";

export interface NotifPrefs {
  enabled: boolean;
  time: string; // "HH:MM"
}

export const NOTIF_PREFS_KEY  = "kt_notification_prefs";
export const NOTIF_LAST_KEY   = "kt_last_notified";

async function fireNotification() {
  const title = "KordaTracker";
  const body  = "Time to log your daily weigh-in 💪";
  const url   = "/tracker/progress";

  if ("serviceWorker" in navigator && navigator.serviceWorker.controller) {
    navigator.serviceWorker.controller.postMessage({ type: "SHOW_NOTIFICATION", title, body, url });
  } else if (Notification.permission === "granted") {
    new Notification(title, { body, icon: "/web-app-manifest-192x192.png" });
  }

  localStorage.setItem(NOTIF_LAST_KEY, new Date().toISOString().split("T")[0]);
}

async function checkNotification() {
  if (typeof Notification === "undefined") return;
  if (Notification.permission !== "granted") return;

  const raw = localStorage.getItem(NOTIF_PREFS_KEY);
  if (!raw) return;

  const prefs: NotifPrefs = JSON.parse(raw);
  if (!prefs.enabled || !prefs.time) return;

  const today = new Date().toISOString().split("T")[0];
  if (localStorage.getItem(NOTIF_LAST_KEY) === today) return;

  const now = new Date();
  const [h, m] = prefs.time.split(":").map(Number);
  const notifyAt = new Date();
  notifyAt.setHours(h, m, 0, 0);

  if (now >= notifyAt) await fireNotification();
}

export function useNotificationCheck() {
  useEffect(() => {
    checkNotification();

    const onVisible = () => { if (!document.hidden) checkNotification(); };
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, []);
}
