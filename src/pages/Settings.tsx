import { useEffect, useMemo, useState } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import {
  User,
  Bell,
  Shield,
  Database,
  CreditCard,
  Loader2,
  AlertTriangle,
} from "lucide-react";
import { supabase } from "@/lib/supabaseClient";
import { useAuth } from "@/auth/AuthProvider";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";

type SettingsRow = {
  id: string;
  display_name: string | null;

  notify_trade_sync: boolean | null;
  notify_ai_insights: boolean | null;
  notify_weekly_reports: boolean | null;

  currency: "USD" | "EUR" | null;
  pnl_format: "money" | "percent" | "both" | null;
  risk_unit: "R" | "money" | null;
  timezone: string | null;
};

function downloadTextFile(
  filename: string,
  text: string,
  mime = "application/json"
) {
  const blob = new Blob([text], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export default function Settings() {
  const { user } = useAuth();

  const [loading, setLoading] = useState(true);

  // ----- persisted settings -----
  const [displayName, setDisplayName] = useState("");
  const [notifyTradeSync, setNotifyTradeSync] = useState(true);
  const [notifyAiInsights, setNotifyAiInsights] = useState(true);
  const [notifyWeeklyReports, setNotifyWeeklyReports] = useState(false);

  // (kept in state because your profile row stores them,
  // but UI is hidden for now)
  const [currency, setCurrency] = useState<"USD" | "EUR">("USD");
  const [pnlFormat, setPnlFormat] = useState<"money" | "percent" | "both">(
    "money"
  );
  const [riskUnit, setRiskUnit] = useState<"R" | "money">("R");
  const [timezone, setTimezone] = useState("Europe/Amsterdam");

  // ----- UI states -----
  const [savingField, setSavingField] = useState<
    | null
    | "notify_trade_sync"
    | "notify_ai_insights"
    | "notify_weekly_reports"
    | "currency"
    | "pnl_format"
    | "risk_unit"
    | "timezone"
  >(null);

  const [profileSaving, setProfileSaving] = useState(false);

  // delete dialog
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteText, setDeleteText] = useState("");
  const deleteAllowed = deleteText.trim().toUpperCase() === "DELETE";

  // Snapshot to know when profile is dirty
  const [initialDisplayName, setInitialDisplayName] = useState("");
  const profileDirty = useMemo(
    () => displayName.trim() !== initialDisplayName.trim(),
    [displayName, initialDisplayName]
  );

  // If you have Stripe / billing later, flip this true and wire it up
  const hasBilling = false;

  useEffect(() => {
    if (!user) return;

    (async () => {
      setLoading(true);

      const { data, error } = await supabase
        .from("profiles")
        .select(
          "id, display_name, notify_trade_sync, notify_ai_insights, notify_weekly_reports, currency, pnl_format, risk_unit, timezone"
        )
        .eq("id", user.id)
        .maybeSingle();

      if (error) {
        console.error("Fetch settings error:", error);
        setLoading(false);
        return;
      }

      // If no row exists yet, create one with defaults
      if (!data) {
        const defaults: Partial<SettingsRow> = {
          id: user.id,
          display_name: user.email?.split("@")[0] ?? "Trader",
          notify_trade_sync: true,
          notify_ai_insights: true,
          notify_weekly_reports: false,
          currency: "USD",
          pnl_format: "money",
          risk_unit: "R",
          timezone: "Europe/Amsterdam",
        };

        const { error: insertErr } = await supabase
          .from("profiles")
          .insert([defaults]);
        if (insertErr)
          console.error("Insert default settings error:", insertErr);

        const dn = (defaults.display_name ?? "Trader").toString();
        setDisplayName(dn);
        setInitialDisplayName(dn);

        setNotifyTradeSync(true);
        setNotifyAiInsights(true);
        setNotifyWeeklyReports(false);

        setCurrency("USD");
        setPnlFormat("money");
        setRiskUnit("R");
        setTimezone("Europe/Amsterdam");

        setLoading(false);
        return;
      }

      const row = data as SettingsRow;

      const dn = (
        row.display_name ??
        user.email?.split("@")[0] ??
        "Trader"
      ).toString();
      setDisplayName(dn);
      setInitialDisplayName(dn);

      setNotifyTradeSync(row.notify_trade_sync ?? true);
      setNotifyAiInsights(row.notify_ai_insights ?? true);
      setNotifyWeeklyReports(row.notify_weekly_reports ?? false);

      setCurrency((row.currency ?? "USD") as any);
      setPnlFormat((row.pnl_format ?? "money") as any);
      setRiskUnit((row.risk_unit ?? "R") as any);
      setTimezone(row.timezone ?? "Europe/Amsterdam");

      setLoading(false);
    })();
  }, [user]);

  const saveProfile = async () => {
    if (!user) return;

    const next = displayName.trim();
    if (next.length < 2) {
      alert("Display name must be at least 2 characters.");
      return;
    }
    if (next.length > 24) {
      alert("Display name must be 24 characters or less.");
      return;
    }

    setProfileSaving(true);
    try {
      const { error } = await supabase
        .from("profiles")
        .update({ display_name: next })
        .eq("id", user.id);

      if (error) {
        console.error("Save display name error:", error);
        alert(error.message);
        return;
      }

      setInitialDisplayName(next);
    } finally {
      setProfileSaving(false);
    }
  };

  const updateSetting = async <K extends keyof SettingsRow>(
    key: K,
    value: SettingsRow[K]
  ) => {
    if (!user) return;

    setSavingField(key as any);
    try {
      const { error } = await supabase
        .from("profiles")
        .update({ [key]: value } as any)
        .eq("id", user.id);
      if (error) {
        console.error("Update setting error:", error);
        alert(error.message);
      }
    } finally {
      setSavingField(null);
    }
  };

  const handleExportAllData = async () => {
    if (!user) return;

    try {
      const [tradesRes, journalRes, profileRes] = await Promise.all([
        supabase.from("trades").select("*").order("created_at", { ascending: false }),
        supabase
          .from("journal_entries")
          .select("*")
          .order("entry_time", { ascending: false }),
        supabase.from("profiles").select("*").eq("id", user.id).maybeSingle(),
      ]);

      if (tradesRes.error) throw tradesRes.error;
      if (journalRes.error) throw journalRes.error;
      if (profileRes.error) throw profileRes.error;

      const payload = {
        exported_at: new Date().toISOString(),
        user_id: user.id,
        profile: profileRes.data ?? null,
        trades: tradesRes.data ?? [],
        journal_entries: journalRes.data ?? [],
      };

      downloadTextFile(
        `korda_export_${new Date().toISOString().slice(0, 10)}.json`,
        JSON.stringify(payload, null, 2)
      );
    } catch (e: any) {
      console.error("Export error:", e);
      alert(e?.message ?? "Export failed.");
    }
  };

  const handleDeleteAccount = async () => {
    alert(
      "Delete Account isn’t wired yet.\n\nNext step: create a Supabase Edge Function that deletes this user's data and auth user safely."
    );
    setDeleteOpen(false);
    setDeleteText("");
  };

  if (!user) {
    return (
      <MainLayout>
        <div className="text-sm text-muted-foreground">
          Please log in to view settings.
        </div>
      </MainLayout>
    );
  }

  return (
    <MainLayout>
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">Settings</h1>
        <p className="text-muted-foreground">
          Manage your account and preferences
        </p>
      </div>

      <div className="max-w-2xl space-y-6">
        {/* Profile */}
        <div className="glass-card p-6 animate-fade-in">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
              <User className="w-5 h-5 text-primary" />
            </div>
            <div>
              <h3 className="font-semibold">Profile</h3>
              <p className="text-sm text-muted-foreground">
                Your personal information
              </p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium mb-2 block">
                Display Name
              </label>
              <input
                type="text"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                disabled={loading}
                maxLength={24}
                className="w-full px-4 py-2 bg-muted border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
              />
              <p className="mt-2 text-xs text-muted-foreground">
                2–24 characters.
              </p>
            </div>

            <div>
              <label className="text-sm font-medium mb-2 block">Email</label>
              <input
                type="email"
                value={user.email ?? ""}
                readOnly
                className="w-full px-4 py-2 bg-muted border border-border rounded-lg text-sm opacity-80 cursor-not-allowed"
              />
              <p className="mt-2 text-xs text-muted-foreground">
                Email changes are handled in your login provider.
              </p>
            </div>
          </div>

          {/* Only show actions when dirty */}
          {profileDirty && (
            <div className="flex justify-end gap-3 mt-5">
              <Button
                variant="outline"
                onClick={() => setDisplayName(initialDisplayName)}
                disabled={profileSaving}
              >
                Cancel
              </Button>
              <Button
                variant="glow"
                onClick={saveProfile}
                disabled={profileSaving}
              >
                {profileSaving ? (
                  <span className="inline-flex items-center gap-2">
                    <Loader2 className="w-4 h-4 animate-spin" /> Saving…
                  </span>
                ) : (
                  "Save"
                )}
              </Button>
            </div>
          )}
        </div>

        {/* Notifications (auto-save toggles) */}
        <div className="glass-card p-6 animate-fade-in">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
              <Bell className="w-5 h-5 text-primary" />
            </div>
            <div>
              <h3 className="font-semibold">Notifications</h3>
              <p className="text-sm text-muted-foreground">
                Configure alerts and notifications
              </p>
            </div>
          </div>

          <div className="space-y-4">
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="font-medium">Trade Sync Alerts</p>
                <p className="text-sm text-muted-foreground">
                  Get notified when new trades are imported
                </p>
              </div>

              <div className="flex items-center gap-2">
                {savingField === "notify_trade_sync" && (
                  <Loader2 className="w-4 h-4 animate-spin" />
                )}
                <Switch
                  checked={notifyTradeSync}
                  disabled={loading || savingField !== null}
                  onCheckedChange={(v) => {
                    setNotifyTradeSync(v);
                    updateSetting("notify_trade_sync", v);
                  }}
                />
              </div>
            </div>

            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="font-medium">AI Coach Insights</p>
                <p className="text-sm text-muted-foreground">
                  Daily coaching tips based on your trades
                </p>
              </div>

              <div className="flex items-center gap-2">
                {savingField === "notify_ai_insights" && (
                  <Loader2 className="w-4 h-4 animate-spin" />
                )}
                <Switch
                  checked={notifyAiInsights}
                  disabled={loading || savingField !== null}
                  onCheckedChange={(v) => {
                    setNotifyAiInsights(v);
                    updateSetting("notify_ai_insights", v);
                  }}
                />
              </div>
            </div>

            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="font-medium">Weekly Reports</p>
                <p className="text-sm text-muted-foreground">
                  Receive weekly performance summaries
                </p>
              </div>

              <div className="flex items-center gap-2">
                {savingField === "notify_weekly_reports" && (
                  <Loader2 className="w-4 h-4 animate-spin" />
                )}
                <Switch
                  checked={notifyWeeklyReports}
                  disabled={loading || savingField !== null}
                  onCheckedChange={(v) => {
                    setNotifyWeeklyReports(v);
                    updateSetting("notify_weekly_reports", v);
                  }}
                />
              </div>
            </div>
          </div>
        </div>

        {/* ✅ Trading Preferences HIDDEN for now */}
        {false && (
          <div className="glass-card p-6 animate-fade-in">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                <Database className="w-5 h-5 text-primary" />
              </div>
              <div>
                <h3 className="font-semibold">Trading Preferences</h3>
                <p className="text-sm text-muted-foreground">
                  How performance is displayed across the app
                </p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium mb-2 block">
                  Currency
                </label>
                <div className="flex items-center gap-2">
                  {savingField === "currency" && (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  )}
                  <select
                    value={currency}
                    disabled={loading || savingField !== null}
                    onChange={(e) => {
                      const v = e.target.value as "USD" | "EUR";
                      setCurrency(v);
                      updateSetting("currency", v);
                    }}
                    className="w-full px-4 py-2 bg-muted border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
                  >
                    <option value="USD">USD ($)</option>
                    <option value="EUR">EUR (€)</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="text-sm font-medium mb-2 block">
                  PnL format
                </label>
                <div className="flex items-center gap-2">
                  {savingField === "pnl_format" && (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  )}
                  <select
                    value={pnlFormat}
                    disabled={loading || savingField !== null}
                    onChange={(e) => {
                      const v = e.target.value as
                        | "money"
                        | "percent"
                        | "both";
                      setPnlFormat(v);
                      updateSetting("pnl_format", v);
                    }}
                    className="w-full px-4 py-2 bg-muted border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
                  >
                    <option value="money">$</option>
                    <option value="percent">%</option>
                    <option value="both">$ + %</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="text-sm font-medium mb-2 block">
                  Default risk unit
                </label>
                <div className="flex items-center gap-2">
                  {savingField === "risk_unit" && (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  )}
                  <select
                    value={riskUnit}
                    disabled={loading || savingField !== null}
                    onChange={(e) => {
                      const v = e.target.value as "R" | "money";
                      setRiskUnit(v);
                      updateSetting("risk_unit", v);
                    }}
                    className="w-full px-4 py-2 bg-muted border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
                  >
                    <option value="R">R</option>
                    <option value="money">$</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="text-sm font-medium mb-2 block">
                  Timezone
                </label>
                <div className="flex items-center gap-2">
                  {savingField === "timezone" && (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  )}
                  <select
                    value={timezone}
                    disabled={loading || savingField !== null}
                    onChange={(e) => {
                      const v = e.target.value;
                      setTimezone(v);
                      updateSetting("timezone", v);
                    }}
                    className="w-full px-4 py-2 bg-muted border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
                  >
                    <option value="Europe/Amsterdam">Europe/Amsterdam</option>
                    <option value="Europe/London">Europe/London</option>
                    <option value="America/New_York">America/New_York</option>
                    <option value="Asia/Dubai">Asia/Dubai</option>
                  </select>
                </div>
              </div>
            </div>

            <p className="text-xs text-muted-foreground mt-4">
              These settings auto-save and will be used for formatting across
              Trades, Journal and Analytics.
            </p>
          </div>
        )}

        {/* Data & Privacy */}
        <div className="glass-card p-6 animate-fade-in">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
              <Shield className="w-5 h-5 text-primary" />
            </div>
            <div>
              <h3 className="font-semibold">Data & Privacy</h3>
              <p className="text-sm text-muted-foreground">
                Manage your data and privacy settings
              </p>
            </div>
          </div>

          <div className="space-y-3">
            <Button
              variant="outline"
              className="w-full justify-start gap-2"
              onClick={handleExportAllData}
            >
              <Database className="w-4 h-4" />
              Download my data (JSON)
            </Button>

            <Button
              variant="outline"
              className="w-full justify-start gap-2 text-destructive hover:text-destructive"
              onClick={() => {
                setDeleteText("");
                setDeleteOpen(true);
              }}
            >
              <AlertTriangle className="w-4 h-4" />
              Delete Account
            </Button>

            <p className="text-xs text-muted-foreground">
              Deleting your account will remove your trades, journal entries and
              settings permanently.
            </p>
          </div>
        </div>

        {/* Subscription */}
        <div className="glass-card p-6 animate-fade-in gradient-border overflow-hidden relative">
          <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-transparent pointer-events-none" />
          <div className="relative">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                <CreditCard className="w-5 h-5 text-primary" />
              </div>
              <div>
                <h3 className="font-semibold">Subscription</h3>
                <p className="text-sm text-muted-foreground">Manage your plan</p>
              </div>
            </div>

            {!hasBilling ? (
              <>
                <div className="bg-muted/50 rounded-lg p-4 mb-4">
                  <p className="font-medium">Billing coming soon</p>
                  <p className="text-sm text-muted-foreground mt-1">
                    Payments aren’t enabled yet. When you connect Stripe, this
                    will show current plan, renewal date, and a “Manage billing”
                    link.
                  </p>
                </div>
                <Button variant="outline" className="w-full" disabled>
                  Upgrade to Pro (Coming soon)
                </Button>
              </>
            ) : (
              <>
                <div className="bg-muted/50 rounded-lg p-4 mb-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-semibold text-primary">Pro Plan</p>
                      <p className="text-sm text-muted-foreground">
                        Unlimited trades • AI Coach • All integrations
                      </p>
                    </div>
                    <p className="text-2xl font-bold">
                      $29
                      <span className="text-sm font-normal text-muted-foreground">
                        /mo
                      </span>
                    </p>
                  </div>
                </div>
                <Button variant="glow" className="w-full">
                  Manage billing
                </Button>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Delete confirm dialog */}
      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete account</DialogTitle>
          </DialogHeader>

          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              This is permanent. To confirm, type <b>DELETE</b>.
            </p>

            <input
              value={deleteText}
              onChange={(e) => setDeleteText(e.target.value)}
              placeholder="Type DELETE"
              className="w-full px-4 py-2 bg-muted border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
            />
          </div>

          <DialogFooter className="mt-4 flex items-center justify-between gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => setDeleteOpen(false)}
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="destructive"
              disabled={!deleteAllowed}
              onClick={handleDeleteAccount}
            >
              Delete permanently
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </MainLayout>
  );
}
