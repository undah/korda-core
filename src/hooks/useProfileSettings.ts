import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { useAuth } from "@/auth/AuthProvider";

export type ProfileSettings = {
  display_name: string | null;
  currency: "USD" | "EUR";
  pnl_format: "money" | "percent" | "both";
  risk_unit: "R" | "money";
  timezone: string;
};

const DEFAULTS: ProfileSettings = {
  display_name: null,
  currency: "USD",
  pnl_format: "money",
  risk_unit: "R",
  timezone: "Europe/Amsterdam",
};

export function useProfileSettings() {
  const { user } = useAuth();
  const [settings, setSettings] = useState<ProfileSettings>(DEFAULTS);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) {
      setSettings(DEFAULTS);
      setLoading(false);
      return;
    }

    let cancelled = false;

    (async () => {
      setLoading(true);

      const { data, error } = await supabase
        .from("profiles")
        .select("display_name, currency, pnl_format, risk_unit, timezone")
        .eq("id", user.id)
        .maybeSingle();

      if (!cancelled) {
        if (error) {
          console.error("useProfileSettings fetch error:", error);
          setSettings(DEFAULTS);
        } else {
          setSettings({
            display_name: data?.display_name ?? null,
            currency: (data?.currency ?? "USD") as "USD" | "EUR",
            pnl_format: (data?.pnl_format ?? "money") as "money" | "percent" | "both",
            risk_unit: (data?.risk_unit ?? "R") as "R" | "money",
            timezone: data?.timezone ?? "Europe/Amsterdam",
          });
        }
        setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [user]);

  return { settings, loading };
}
