type TradeRow = {
  pnl?: number | string | null;
  pnl_percent?: number | string | null;
};

function safeNumber(v: any, fallback = 0) {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

export function calcSummary(trades: TradeRow[]) {
  const list = trades ?? [];

  let totalPnL = 0;
  let grossProfit = 0;
  let grossLossAbs = 0;
  let wins = 0;
  let losses = 0;

  for (const t of list) {
    const pnl = safeNumber(t.pnl, 0);
    totalPnL += pnl;

    if (pnl > 0) {
      wins++;
      grossProfit += pnl;
    } else if (pnl < 0) {
      losses++;
      grossLossAbs += Math.abs(pnl);
    }
  }

  const totalTrades = list.length;
  const winRate = totalTrades ? (wins / totalTrades) * 100 : 0;

  // Profit factor: grossProfit / grossLoss
  const profitFactor =
    grossLossAbs > 0 ? grossProfit / grossLossAbs : grossProfit > 0 ? Infinity : 0;

  return {
    totalPnL,
    grossProfit,
    grossLossAbs,
    wins,
    losses,
    totalTrades,
    winRate,
    profitFactor,
  };
}
