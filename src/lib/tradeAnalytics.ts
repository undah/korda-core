type TradeRow = {
  pnl?: number | string | null;
  pnl_percent?: number | string | null;

  // Optional fields (supported if your rows have them)
  status?: string | null;         // e.g. "planned" | "completed"
  trade_status?: string | null;   // alternative naming
  state?: string | null;          // alternative naming
  is_planned?: boolean | null;    // boolean flag
};

function safeNumber(v: any, fallback = 0) {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

function normalizeStatus(t: TradeRow) {
  const raw =
    (t.status ?? t.trade_status ?? t.state ?? "")
      .toString()
      .trim()
      .toLowerCase();

  return raw;
}

function isPlannedOrOpen(t: TradeRow) {
  // explicit boolean flag wins
  if (t.is_planned === true) return true;

  const s = normalizeStatus(t);

  // treat these as NOT closed => exclude from analytics
  if (
    s === "planned" ||
    s === "plan" ||
    s === "open" ||
    s === "active" ||
    s === "pending" ||
    s === "draft" ||
    s === "in_progress"
  ) {
    return true;
  }

  return false;
}

export function calcSummary(trades: TradeRow[]) {
  const list = (trades ?? []).filter((t) => !isPlannedOrOpen(t));

  let totalPnL = 0;
  let grossProfit = 0;
  let grossLossAbs = 0;
  let wins = 0;
  let losses = 0;
  let breakeven = 0;

  for (const t of list) {
    const pnl = safeNumber(t.pnl, 0);
    totalPnL += pnl;

    if (pnl > 0) {
      wins++;
      grossProfit += pnl;
    } else if (pnl < 0) {
      losses++;
      grossLossAbs += Math.abs(pnl);
    } else {
      breakeven++;
    }
  }

  const totalTrades = list.length;
  const winRate = totalTrades ? (wins / totalTrades) * 100 : 0;

  const profitFactor =
    grossLossAbs > 0 ? grossProfit / grossLossAbs : grossProfit > 0 ? Infinity : 0;

  return {
    totalPnL,
    grossProfit,
    grossLossAbs,
    wins,
    losses,
    breakeven,
    totalTrades,
    winRate,
    profitFactor,
  };
}
