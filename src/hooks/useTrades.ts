import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { useAuth } from "@/auth/AuthProvider";

export type AccountType = "all" | "live" | "backtest";
export type Side = "buy" | "sell";

export interface TradeRow {
  id: string;
  user_id: string;
  account_type: "live" | "backtest";
  pair: string;
  side: Side;
  pnl: number | null;
  pnl_percent: number | null;
  risk_reward: number | null;
  created_at: string; // or your close_time
}

export function useTrades(params?: {
  accountType?: AccountType;
  from?: string; // YYYY-MM-DD
  to?: string;   // YYYY-MM-DD
}) {
  const { user } = useAuth();
  const [trades, setTrades] = useState<TradeRow[]>([]);
  const [loading, setLoading] = useState(false);

  const accountType = params?.accountType ?? "all";
  const from = params?.from ?? "";
  const to = params?.to ?? "";

  useEffect(() => {
    if (!user) return;

    (async () => {
      setLoading(true);

      let q = supabase
        .from("trades")
        .select("id,user_id,account_type,pair,side,pnl,pnl_percent,risk_reward,created_at")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });

      if (accountType !== "all") q = q.eq("account_type", accountType);

      if (from) q = q.gte("created_at", `${from}T00:00:00.000Z`);
      if (to) q = q.lte("created_at", `${to}T23:59:59.999Z`);

      const { data, error } = await q;

      if (error) {
        console.error("Fetch trades error:", error);
        setTrades([]);
      } else {
        setTrades((data ?? []) as any);
      }

      setLoading(false);
    })();
  }, [user, accountType, from, to]);

  return { trades, loading };
}
