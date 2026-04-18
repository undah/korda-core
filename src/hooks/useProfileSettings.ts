// src/hooks/useProfileSettings.ts
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { useAuth } from "@/auth/AuthProvider";
import type { PnlFormat } from "@/lib/format";


export type ProfileSettings = {
  displayName: string;
  currency: string; // keep flexible
  pnlFormat: PnlFormat;
  timezone: string;
  locale: string; // we'll default from currency if you want later
};

const DEFAULTS: ProfileSettings = {
  displayName: "Trader",
  currency: "USD",
  pnlFormat: "money",
  timezone: "Europe/Amsterdam",
  locale: "en-US",
};

export function useProfileSettings() {
  const { user } = useAuth();
  const [settings, setSettings] = useState<ProfileSettings>(DEFAULTS);
  const [loadingSettings, setLoadingSettings] = useState(true);

  useEffect(() => {
    if (!user) {
      setSettings(DEFAULTS);
      setLoadingSettings(false);
      return;
    }

    (async () => {
      setLoadingSettings(true);

      const { data, error } = await supabase
        .from("profiles")
        .select("display_name, currency, pnl_format, timezone")
        .eq("id", user.id)
        .maybeSingle();

      if (error) {
        console.error("useProfileSettings fetch error:", error);
        setSettings(DEFAULTS);
        setLoadingSettings(false);
        return;
      }

      // If no profile row exists, stick to defaults (your Settings page creates it anyway)
      const currency = (data?.currency ?? DEFAULTS.currency) as string;
      const pnlFormat = (data?.pnl_format ?? DEFAULTS.pnlFormat) as any;
      const timezone = (data?.timezone ?? DEFAULTS.timezone) as string;

      // Simple locale choice: EUR -> nl-NL, else en-US.
      const locale = currency?.toUpperCase() === "EUR" ? "nl-NL" : "en-US";

      setSettings({
        displayName: (data?.display_name ?? DEFAULTS.displayName) as string,
        currency,
        pnlFormat,
        timezone,
        locale,
      });

      setLoadingSettings(false);
    })();
  }, [user]);

  return { settings, loadingSettings };
}
