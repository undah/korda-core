import { MainLayout } from "@/components/layout/MainLayout";
import { Button } from "@/components/ui/button";
import { Link2, CheckCircle, AlertCircle, Settings, RefreshCw } from "lucide-react";
import { cn } from "@/lib/utils";

interface Platform {
  id: string;
  name: string;
  description: string;
  status: "connected" | "disconnected" | "syncing";
  lastSync?: string;
  account?: string;
  logo: string;
}

const platforms: Platform[] = [
  {
    id: "ctrader",
    name: "cTrader",
    description: "Connect your cTrader account to automatically import trades",
    status: "connected",
    lastSync: "2 minutes ago",
    account: "Demo Account #12345",
    logo: "https://upload.wikimedia.org/wikipedia/commons/thumb/8/8f/CTrader_logo.svg/1200px-CTrader_logo.svg.png",
  },
  {
    id: "mt5",
    name: "MetaTrader 5",
    description: "Sync your MT5 trading history and open positions",
    status: "connected",
    lastSync: "5 minutes ago",
    account: "Live Account #67890",
    logo: "https://upload.wikimedia.org/wikipedia/commons/thumb/5/5c/MetaTrader_5_logo.svg/1200px-MetaTrader_5_logo.svg.png",
  },
  {
    id: "mt4",
    name: "MetaTrader 4",
    description: "Legacy MT4 support for trade importing",
    status: "disconnected",
    logo: "https://upload.wikimedia.org/wikipedia/commons/thumb/5/5c/MetaTrader_5_logo.svg/1200px-MetaTrader_5_logo.svg.png",
  },
  {
    id: "tradingview",
    name: "TradingView",
    description: "Import alerts and chart annotations from TradingView",
    status: "disconnected",
    logo: "https://upload.wikimedia.org/wikipedia/commons/8/88/TradingView_logo.svg",
  },
];

const statusConfig = {
  connected: { icon: CheckCircle, color: "text-success", bg: "bg-success/10", label: "Connected" },
  disconnected: { icon: AlertCircle, color: "text-muted-foreground", bg: "bg-muted", label: "Disconnected" },
  syncing: { icon: RefreshCw, color: "text-primary", bg: "bg-primary/10", label: "Syncing..." },
};

export default function Connections() {
  return (
    <MainLayout>
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">Platform Connections</h1>
        <p className="text-muted-foreground">Connect your trading platforms to automatically import trades</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {platforms.map((platform) => {
          const status = statusConfig[platform.status];
          const StatusIcon = status.icon;

          return (
            <div key={platform.id} className="glass-card p-6 animate-fade-in">
              <div className="flex items-start gap-4">
                <div className="w-14 h-14 rounded-xl bg-muted flex items-center justify-center overflow-hidden">
                  <img 
                    src={platform.logo} 
                    alt={platform.name}
                    className="w-10 h-10 object-contain"
                    onError={(e) => {
                      e.currentTarget.src = "";
                      e.currentTarget.parentElement!.innerHTML = `<div class="w-10 h-10 flex items-center justify-center text-primary"><svg class="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" /><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" /></svg></div>`;
                    }}
                  />
                </div>
                <div className="flex-1">
                  <div className="flex items-center justify-between mb-1">
                    <h3 className="font-semibold text-lg">{platform.name}</h3>
                    <div className={cn(
                      "flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium",
                      status.bg, status.color
                    )}>
                      <StatusIcon className={cn("w-3.5 h-3.5", platform.status === "syncing" && "animate-spin")} />
                      {status.label}
                    </div>
                  </div>
                  <p className="text-sm text-muted-foreground mb-4">{platform.description}</p>
                  
                  {platform.status === "connected" && (
                    <div className="bg-muted/50 rounded-lg p-3 mb-4">
                      <p className="text-sm font-medium">{platform.account}</p>
                      <p className="text-xs text-muted-foreground">Last synced: {platform.lastSync}</p>
                    </div>
                  )}

                  <div className="flex gap-3">
                    {platform.status === "connected" ? (
                      <>
                        <Button variant="outline" size="sm">
                          <RefreshCw className="w-4 h-4" />
                          Sync Now
                        </Button>
                        <Button variant="ghost" size="sm">
                          <Settings className="w-4 h-4" />
                          Settings
                        </Button>
                      </>
                    ) : (
                      <Button variant="glow" size="sm">
                        <Link2 className="w-4 h-4" />
                        Connect
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* API Key Section */}
      <div className="mt-8">
        <h2 className="text-xl font-semibold mb-4">API Configuration</h2>
        <div className="glass-card p-6">
          <p className="text-muted-foreground mb-4">
            For advanced integrations, you can configure API keys to connect directly to your broker.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium mb-2 block">API Key</label>
              <input
                type="password"
                placeholder="Enter your API key"
                className="w-full px-4 py-2 bg-muted border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
              />
            </div>
            <div>
              <label className="text-sm font-medium mb-2 block">API Secret</label>
              <input
                type="password"
                placeholder="Enter your API secret"
                className="w-full px-4 py-2 bg-muted border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
              />
            </div>
          </div>
          <Button variant="glow" className="mt-4">
            Save API Configuration
          </Button>
        </div>
      </div>
    </MainLayout>
  );
}
