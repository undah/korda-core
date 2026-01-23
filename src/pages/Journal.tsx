import { useState } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Plus, Search, Filter, Calendar, Tag, ArrowUpRight, ArrowDownRight, BookOpen, LineChart } from "lucide-react";
import { cn } from "@/lib/utils";
import { TradesSection } from "@/components/journal/TradesSection";

interface JournalEntry {
  id: string;
  pair: string;
  type: "buy" | "sell";
  date: string;
  pnl: number;
  notes: string;
  tags: string[];
  emotion: "confident" | "fearful" | "neutral" | "greedy";
}

const mockEntries: JournalEntry[] = [
  {
    id: "1",
    pair: "EUR/USD",
    type: "buy",
    date: "Jan 21, 2024",
    pnl: 420,
    notes: "Entered on a clear breakout of the 1.0850 resistance level. Waited for the pullback and confirmation. Managed the trade well, moved SL to breakeven after 20 pips profit.",
    tags: ["breakout", "trend-following"],
    emotion: "confident",
  },
  {
    id: "2",
    pair: "GBP/JPY",
    type: "sell",
    date: "Jan 21, 2024",
    pnl: 530,
    notes: "Nice reversal setup at a key supply zone. The daily timeframe showed bearish divergence. Took partial profits at 1:1 RR and let the rest run.",
    tags: ["reversal", "supply-demand"],
    emotion: "confident",
  },
  {
    id: "3",
    pair: "USD/CAD",
    type: "buy",
    date: "Jan 20, 2024",
    pnl: -280,
    notes: "FOMO trade. I chased the move instead of waiting for a proper entry. Should have waited for the pullback. Need to be more patient.",
    tags: ["fomo", "mistake"],
    emotion: "greedy",
  },
];

const emotionColors = {
  confident: "bg-success/20 text-success",
  fearful: "bg-warning/20 text-warning",
  neutral: "bg-muted text-muted-foreground",
  greedy: "bg-destructive/20 text-destructive",
};

export default function Journal() {
  const [selectedEntry, setSelectedEntry] = useState<JournalEntry | null>(mockEntries[0]);
  const [notes, setNotes] = useState(selectedEntry?.notes || "");
  const [activeTab, setActiveTab] = useState("trades");

  return (
    <MainLayout>
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold mb-2">Trade Journal</h1>
          <p className="text-muted-foreground">Document your trades and compare live vs backtest performance</p>
        </div>
        <Button variant="glow">
          <Plus className="w-4 h-4" />
          Add Entry
        </Button>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="mb-6">
          <TabsTrigger value="trades" className="flex items-center gap-2">
            <LineChart className="w-4 h-4" />
            Trades
          </TabsTrigger>
          <TabsTrigger value="journal" className="flex items-center gap-2">
            <BookOpen className="w-4 h-4" />
            Journal Entries
          </TabsTrigger>
        </TabsList>

        <TabsContent value="trades" className="animate-fade-in">
          <TradesSection />
        </TabsContent>

        <TabsContent value="journal" className="animate-fade-in">
          {/* Search and Filter */}
          <div className="flex gap-4 mb-6">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <input
                type="text"
                placeholder="Search entries..."
                className="w-full pl-10 pr-4 py-2 bg-secondary border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
              />
            </div>
            <Button variant="outline" size="default">
              <Filter className="w-4 h-4" />
              Filter
            </Button>
            <Button variant="outline" size="default">
              <Calendar className="w-4 h-4" />
              Date Range
            </Button>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Entry List */}
            <div className="space-y-4">
              {mockEntries.map((entry) => (
                <div
                  key={entry.id}
                  onClick={() => {
                    setSelectedEntry(entry);
                    setNotes(entry.notes);
                  }}
                  className={cn(
                    "glass-card p-4 cursor-pointer transition-all hover:border-primary/30",
                    selectedEntry?.id === entry.id && "border-primary/50 bg-primary/5"
                  )}
                >
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <div className={cn(
                        "w-8 h-8 rounded-lg flex items-center justify-center",
                        entry.type === "buy" ? "bg-success/10" : "bg-destructive/10"
                      )}>
                        {entry.type === "buy" ? (
                          <ArrowUpRight className="w-4 h-4 text-success" />
                        ) : (
                          <ArrowDownRight className="w-4 h-4 text-destructive" />
                        )}
                      </div>
                      <span className="font-medium">{entry.pair}</span>
                    </div>
                    <span className={cn(
                      "font-mono font-medium",
                      entry.pnl >= 0 ? "text-success" : "text-destructive"
                    )}>
                      {entry.pnl >= 0 ? "+" : ""}{entry.pnl}
                    </span>
                  </div>
                  <p className="text-sm text-muted-foreground line-clamp-2 mb-3">
                    {entry.notes}
                  </p>
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-muted-foreground">{entry.date}</span>
                    <span className={cn(
                      "text-xs px-2 py-1 rounded-full capitalize",
                      emotionColors[entry.emotion]
                    )}>
                      {entry.emotion}
                    </span>
                  </div>
                </div>
              ))}
            </div>

            {/* Entry Details */}
            <div className="lg:col-span-2">
              {selectedEntry && (
                <div className="glass-card p-6 animate-fade-in">
                  <div className="flex items-center justify-between mb-6">
                    <div className="flex items-center gap-4">
                      <div className={cn(
                        "w-12 h-12 rounded-xl flex items-center justify-center",
                        selectedEntry.type === "buy" ? "bg-success/10" : "bg-destructive/10"
                      )}>
                        {selectedEntry.type === "buy" ? (
                          <ArrowUpRight className="w-6 h-6 text-success" />
                        ) : (
                          <ArrowDownRight className="w-6 h-6 text-destructive" />
                        )}
                      </div>
                      <div>
                        <h2 className="text-xl font-semibold">{selectedEntry.pair}</h2>
                        <p className="text-sm text-muted-foreground">{selectedEntry.date}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className={cn(
                        "text-2xl font-mono font-semibold",
                        selectedEntry.pnl >= 0 ? "text-success" : "text-destructive"
                      )}>
                        {selectedEntry.pnl >= 0 ? "+" : ""}${Math.abs(selectedEntry.pnl)}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        {selectedEntry.type.toUpperCase()} Trade
                      </p>
                    </div>
                  </div>

                  {/* Tags */}
                  <div className="flex items-center gap-2 mb-6">
                    <Tag className="w-4 h-4 text-muted-foreground" />
                    {selectedEntry.tags.map((tag) => (
                      <span
                        key={tag}
                        className="px-3 py-1 bg-primary/10 text-primary text-sm rounded-full"
                      >
                        {tag}
                      </span>
                    ))}
                    <button className="px-3 py-1 border border-dashed border-border text-muted-foreground text-sm rounded-full hover:border-primary/50 transition-colors">
                      + Add Tag
                    </button>
                  </div>

                  {/* Notes */}
                  <div>
                    <label className="text-sm font-medium mb-2 block">Trade Notes</label>
                    <Textarea
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      placeholder="Document your thoughts about this trade..."
                      className="min-h-[200px] bg-muted/50 border-border resize-none"
                    />
                  </div>

                  <div className="flex justify-end gap-4 mt-6">
                    <Button variant="outline">Cancel</Button>
                    <Button variant="glow">Save Changes</Button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </TabsContent>
      </Tabs>
    </MainLayout>
  );
}
