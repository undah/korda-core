import { Bot, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";

export function AIInsight() {
  const navigate = useNavigate();

  return (
    <div className="glass-card p-6 animate-fade-in gradient-border overflow-hidden relative">
      <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-transparent pointer-events-none" />
      <div className="relative">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-xl bg-primary/20 flex items-center justify-center animate-glow-pulse">
            <Bot className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h3 className="font-semibold">AI Coach Insight</h3>
            <p className="text-sm text-muted-foreground">Based on your recent trades</p>
          </div>
        </div>

        <div className="bg-muted/50 rounded-lg p-4 mb-4">
          <div className="flex items-start gap-2">
            <Sparkles className="w-4 h-4 text-primary mt-0.5 shrink-0" />
            <p className="text-sm leading-relaxed">
              I noticed you're performing well on <span className="text-primary font-medium">EUR/USD</span> trades 
              with a 78% win rate. However, your <span className="text-destructive font-medium">USD/CAD</span> trades 
              show early exits. Consider adjusting your take-profit levels on CAD pairs.
            </p>
          </div>
        </div>

        <Button 
          variant="glow" 
          className="w-full"
          onClick={() => navigate("/coach")}
        >
          <Bot className="w-4 h-4" />
          Chat with AI Coach
        </Button>
      </div>
    </div>
  );
}
