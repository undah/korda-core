// src/features/budget/lib/eigenDocument.ts — make sure the page was loaded as KordaBudget.
//
// The server gives /budget pages KordaBudget's name, icon and manifest
// (functions/budget/_middleware.js). But the site is one single-page app: arrive
// from the suite home or another Korda app by tapping a link, and the browser
// still holds the document it first loaded, with KordaTracker's manifest. iOS
// reads the manifest only at load, so "Add to Home Screen" offered KordaTracker
// and the tracker's start page. When that's the case, load this page once more.
import { useEffect } from "react";

export function useEigenDocument() {
  useEffect(() => {
    const nav = performance.getEntriesByType?.("navigation")[0] as PerformanceNavigationTiming | undefined;
    const geladenOp = nav?.name ? new URL(nav.name).pathname : window.location.pathname;
    // After the reload the document itself starts on /budget, so this runs once.
    if (!geladenOp.startsWith("/budget")) window.location.replace(window.location.href);
  }, []);
}
