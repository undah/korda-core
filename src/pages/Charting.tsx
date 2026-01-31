// src/pages/Charting.tsx
import { useEffect, useMemo, useRef, useState } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { ExternalLink, LineChart } from "lucide-react";

/**
 * TradingView Advanced Chart widget (script embed)
 * - This is the "advanced chart" embed TradingView provides for websites.
 * - Drawings/toolbars availability is controlled by TradingView's widget capabilities.
 * - You cannot programmatically read/save drawings from this embed (it's sandboxed).
 */

type Interval = "1" | "5" | "15" | "60" | "240" | "D";

const INTERVALS: { label: string; value: Interval }[] = [
  { label: "5m", value: "5" },
  { label: "15m", value: "15" },
  { label: "1h", value: "60" },
  { label: "4h", value: "240" },
  { label: "1D", value: "D" },
];

type SymbolPreset = {
  label: string;
  tvSymbol: string; // EXCHANGE:SYMBOL
};

const SYMBOLS: SymbolPreset[] = [
  { label: "XAUUSD (OANDA)", tvSymbol: "OANDA:XAUUSD" },
  { label: "EURUSD (OANDA)", tvSymbol: "OANDA:EURUSD" },
  { label: "GBPUSD (OANDA)", tvSymbol: "OANDA:GBPUSD" },
  { label: "SPY (AMEX)", tvSymbol: "AMEX:SPY" },
  { label: "AAPL (NASDAQ)", tvSymbol: "NASDAQ:AAPL" },
  { label: "TSLA (NASDAQ)", tvSymbol: "NASDAQ:TSLA" },
];

function prettyInterval(interval: string) {
  const hit = INTERVALS.find((x) => x.value === interval);
  return hit?.label ?? interval;
}

function encodeTvSymbol(sym: string) {
  return encodeURIComponent(sym);
}

export default function Charting() {
  const [tvSymbol, setTvSymbol] = useState<string>(SYMBOLS[0].tvSymbol);
  const [interval, setInterval] = useState<Interval>("60");

  // container where TradingView will render
  const containerRef = useRef<HTMLDivElement | null>(null);

  // unique id per mount (TradingView expects a container id)
  const containerId = useMemo(() => `tv-advanced-${Math.random().toString(36).slice(2)}`, []);

  useEffect(() => {
    if (!containerRef.current) return;

    // Clear any previous widget markup when symbol/interval changes
    containerRef.current.innerHTML = "";

    // TradingView Advanced Chart widget script
    const script = document.createElement("script");
    script.src = "https://s3.tradingview.com/external-embedding/embed-widget-advanced-chart.js";
    script.async = true;

    // IMPORTANT: script.innerHTML must be JSON string config
    script.innerHTML = JSON.stringify({
      autosize: true,
      symbol: tvSymbol,
      interval: interval, // "60", "240", "D", etc.
      timezone: "Etc/UTC",
      theme: "light",
      style: "1",
      locale: "en",
      withdateranges: true,
      hide_side_toolbar: false, // left drawing tools (if allowed)
      allow_symbol_change: true,
      save_image: true,
      calendar: false,
      support_host: "https://www.tradingview.com",
    });

    containerRef.current.appendChild(script);

    return () => {
      // cleanup
      if (containerRef.current) containerRef.current.innerHTML = "";
    };
  }, [tvSymbol, interval]);

  return (
    <MainLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
          <div>
            <div className="flex items-center gap-2">
              <LineChart className="h-5 w-5 text-muted-foreground" />
              <h1 className="text-3xl font-bold tracking-tight">Charting</h1>
            </div>
            <p className="text-muted-foreground mt-1">
              TradingView Advanced Chart embed. Drawings live inside the widget (not saved in Korda).
            </p>
          </div>

          <Button variant="outline" asChild className="flex items-center gap-2">
            <a
              href={`https://www.tradingview.com/chart/?symbol=${encodeTvSymbol(tvSymbol)}`}
              target="_blank"
              rel="noreferrer"
              title="Open the same symbol on TradingView"
            >
              <ExternalLink className="h-4 w-4" />
              Open on TradingView
            </a>
          </Button>
        </div>

        {/* Controls */}
        <div className="glass-card p-4">
          <div className="grid grid-cols-1 gap-3 md:grid-cols-3 md:items-end">
            <div className="space-y-1">
              <div className="text-xs text-muted-foreground">Symbol</div>
              <select
                value={tvSymbol}
                onChange={(e) => setTvSymbol(e.target.value)}
                className={cn(
                  "w-full h-10 rounded-xl border border-border bg-secondary/60 px-3 text-sm text-white outline-none",
                  "focus:ring-2 focus:ring-primary/40"
                )}
              >
                {SYMBOLS.map((s) => (
                  <option key={s.tvSymbol} value={s.tvSymbol}>
                    {s.label}
                  </option>
                ))}
              </select>
              <div className="text-[11px] text-muted-foreground">Tip: add more presets anytime (EXCHANGE:SYMBOL).</div>
            </div>

            <div className="space-y-1">
              <div className="text-xs text-muted-foreground">Timeframe</div>
              <select
                value={interval}
                onChange={(e) => setInterval(e.target.value as Interval)}
                className={cn(
                  "w-full h-10 rounded-xl border border-border bg-secondary/60 px-3 text-sm text-white outline-none",
                  "focus:ring-2 focus:ring-primary/40"
                )}
              >
                {INTERVALS.map((i) => (
                  <option key={i.value} value={i.value}>
                    {i.label}
                  </option>
                ))}
              </select>
              <div className="text-[11px] text-muted-foreground">
                Toolbar visibility depends on TradingView embed permissions.
              </div>
            </div>

            <div className="text-xs text-muted-foreground md:text-right">
              <div className="font-medium text-foreground">{tvSymbol}</div>
              <div>{prettyInterval(interval)}</div>
            </div>
          </div>
        </div>

        {/* Advanced Chart */}
        <div className="glass-card overflow-hidden">
          <div className="p-4 border-b border-border flex items-center justify-between">
            <div className="text-sm font-semibold">TradingView</div>
            <div className="text-xs text-muted-foreground">
              {tvSymbol} • {prettyInterval(interval)}
            </div>
          </div>

          {/* Height is controlled here */}
          <div className="relative w-full" style={{ height: 920 }}>
            <div id={containerId} ref={containerRef} className="absolute inset-0 w-full h-full" />
          </div>

          <div className="p-3 border-t border-border text-[11px] text-muted-foreground">
            Drawings are inside TradingView’s embed. Korda can’t save them.
          </div>
        </div>
      </div>
    </MainLayout>
  );
}
