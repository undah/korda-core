import { useState } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { Button } from "@/components/ui/button";
import { Bot, Send, Sparkles, TrendingUp, AlertTriangle, Lightbulb } from "lucide-react";
import { cn } from "@/lib/utils";

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: string;
}

const initialMessages: Message[] = [
  {
    id: "1",
    role: "assistant",
    content: "Hey! I'm your AI Trading Coach. I've been analyzing your recent trades and journal entries. I noticed some interesting patterns. Would you like me to share my observations, or do you have a specific question about your trading?",
    timestamp: "Just now",
  },
];

const suggestions = [
  { icon: TrendingUp, text: "Analyze my win rate patterns" },
  { icon: AlertTriangle, text: "Review my biggest losses" },
  { icon: Lightbulb, text: "Suggest improvements for my strategy" },
];

export default function Coach() {
  const [messages, setMessages] = useState<Message[]>(initialMessages);
  const [input, setInput] = useState("");

  const handleSend = () => {
    if (!input.trim()) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      role: "user",
      content: input,
      timestamp: "Just now",
    };

    setMessages([...messages, userMessage]);
    setInput("");

    // Simulate AI response
    setTimeout(() => {
      const aiResponse: Message = {
        id: (Date.now() + 1).toString(),
        role: "assistant",
        content: "Based on your journal notes, I can see you've been struggling with FOMO trades, particularly on USD/CAD. Your notes mention chasing moves instead of waiting for proper entries. Here's what I suggest:\n\n1. **Set price alerts** instead of watching the charts constantly\n2. **Wait for a pullback** to your identified support/resistance levels\n3. **Use a checklist** before entering any trade\n\nWould you like me to create a pre-trade checklist based on your winning trades?",
        timestamp: "Just now",
      };
      setMessages((prev) => [...prev, aiResponse]);
    }, 1000);
  };

  return (
    <MainLayout>
      <div className="h-[calc(100vh-8rem)] flex flex-col">
        {/* Header */}
        <div className="mb-6">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-primary/20 flex items-center justify-center animate-glow-pulse">
              <Bot className="w-6 h-6 text-primary" />
            </div>
            <div>
              <h1 className="text-2xl font-bold">AI Trading Coach</h1>
              <p className="text-muted-foreground">Get personalized insights based on your trading journal</p>
            </div>
          </div>
        </div>

        {/* Chat Container */}
        <div className="flex-1 glass-card rounded-xl overflow-hidden flex flex-col">
          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-6 space-y-6">
            {messages.map((message) => (
              <div
                key={message.id}
                className={cn(
                  "flex gap-4 animate-fade-in",
                  message.role === "user" && "flex-row-reverse"
                )}
              >
                <div className={cn(
                  "w-10 h-10 rounded-xl flex items-center justify-center shrink-0",
                  message.role === "assistant" ? "bg-primary/20" : "bg-muted"
                )}>
                  {message.role === "assistant" ? (
                    <Bot className="w-5 h-5 text-primary" />
                  ) : (
                    <span className="text-sm font-medium">You</span>
                  )}
                </div>
                <div className={cn(
                  "max-w-[70%] rounded-xl p-4",
                  message.role === "assistant" 
                    ? "bg-muted/50 rounded-tl-sm" 
                    : "bg-primary text-primary-foreground rounded-tr-sm"
                )}>
                  <p className="text-sm whitespace-pre-wrap leading-relaxed">{message.content}</p>
                  <p className={cn(
                    "text-xs mt-2",
                    message.role === "assistant" ? "text-muted-foreground" : "text-primary-foreground/70"
                  )}>
                    {message.timestamp}
                  </p>
                </div>
              </div>
            ))}
          </div>

          {/* Suggestions */}
          {messages.length <= 2 && (
            <div className="px-6 pb-4">
              <p className="text-sm text-muted-foreground mb-3">Quick suggestions:</p>
              <div className="flex flex-wrap gap-2">
                {suggestions.map((suggestion, i) => (
                  <button
                    key={i}
                    onClick={() => setInput(suggestion.text)}
                    className="flex items-center gap-2 px-4 py-2 bg-muted/50 hover:bg-muted rounded-full text-sm transition-colors"
                  >
                    <suggestion.icon className="w-4 h-4 text-primary" />
                    {suggestion.text}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Input */}
          <div className="p-4 border-t border-border">
            <div className="flex gap-4">
              <div className="relative flex-1">
                <input
                  type="text"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleSend()}
                  placeholder="Ask your trading coach anything..."
                  className="w-full px-4 py-3 bg-muted border border-border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 pr-12"
                />
                <Sparkles className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-primary/50" />
              </div>
              <Button variant="glow" size="lg" onClick={handleSend}>
                <Send className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </div>
      </div>
    </MainLayout>
  );
}
