import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import {
  ArrowRight,
  BookOpen,
  Brain,
  CandlestickChart,
  ShieldCheck,
  Target,
  TrendingUp,
  Activity,
} from "lucide-react";
import { useState } from "react";
import { useNavigate } from "react-router-dom";

type ViewMode = "live" | "backtest";

const statCards = [
  {
    label: "Win Rate",
    value: "61.4%",
    note: "Measured across tagged executions",
  },
  {
    label: "Profit Factor",
    value: "1.92",
    note: "Built for process-driven review",
  },
  {
    label: "Average RR",
    value: "2.37R",
    note: "Track quality, not just outcome",
  },
  {
    label: "Mistake Rate",
    value: "14%",
    note: "Spot recurring execution leaks",
  },
];

const featureCards = [
  {
    icon: BookOpen,
    title: "Structured Journaling",
    text: "Log trades, screenshots, execution notes, and psychology without slowing down your workflow.",
  },
  {
    icon: TrendingUp,
    title: "Performance Insight",
    text: "See what pairs, sessions, and setups actually perform so your edge becomes measurable.",
  },
  {
    icon: Brain,
    title: "Psychology Tracking",
    text: "Review confidence, hesitation, FOMO, and discipline patterns directly beside your results.",
  },
  {
    icon: ShieldCheck,
    title: "Rule-Based Review",
    text: "Turn avoidable mistakes into rules you can track, review, and improve over time.",
  },
];

const workflowSteps = [
  "Plan the trade before execution",
  "Journal the setup, reasoning, and outcome",
  "Review screenshots, tags, and emotions",
  "Refine your edge with repeatable data",
];

export default function KordaCoreHomepage() {
  const [viewMode, setViewMode] = useState<ViewMode>("live");
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="relative">
        <div className="absolute inset-0 pointer-events-none">
          <div
            className="absolute inset-0 opacity-100"
            style={{
              background:
                "radial-gradient(circle at top right, hsl(173 80% 40% / 0.12), transparent 28%), radial-gradient(circle at top left, hsl(220 80% 35% / 0.10), transparent 30%)",
            }}
          />
        </div>

        <header className="relative z-10 border-b border-border/60 backdrop-blur-xl">
          <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-5 lg:px-10">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/15 glow-effect">
                <TrendingUp className="h-5 w-5 text-primary" />
              </div>
              <div>
                <h1 className="text-lg font-semibold text-foreground">KordaCore™</h1>
                
              </div>
            </div>

            <nav className="hidden items-center gap-8 md:flex">
  <button
    onClick={() => {
      const el = document.getElementById("features");
      el?.scrollIntoView({ behavior: "smooth" });
    }}
    className="text-sm text-muted-foreground transition hover:text-foreground"
  >
    Features
  </button>
  <button
    onClick={() => {
      const el = document.getElementById("workflow");
      el?.scrollIntoView({ behavior: "smooth" });
    }}
    className="text-sm text-muted-foreground transition hover:text-foreground"
  >
    Workflow
  </button>
  <button
    onClick={() => navigate("/login")}
    className="text-sm text-muted-foreground transition hover:text-foreground"
  >
    Login
  </button>
  <button
    onClick={() => navigate("/")}
    className="text-sm transition hover:text-foreground"
    style={{ color: "hsl(173 80% 40% / 0.5)", fontSize: "0.75rem", letterSpacing: "0.05em" }}
  >
    ↗ Korda Suite
  </button>
</nav>

            <div className="flex items-center gap-3">
            
              <Button className="glow-effect" onClick={() => navigate("/login")}>
                Start Journaling
              </Button>
            </div>
          </div>
        </header>

        <main className="relative z-10">
          <section className="mx-auto max-w-7xl px-6 pb-8 pt-10 lg:px-10 lg:pb-12 lg:pt-14">
            <div className="glass-card relative overflow-hidden rounded-3xl p-8 lg:p-10 xl:p-12">
              <div className="pointer-events-none absolute inset-0">
                <div
                  className="absolute -top-20 right-[-100px] h-80 w-80 rounded-full blur-3xl"
                  style={{ background: "var(--gradient-glow)" }}
                />
                <div className="absolute inset-0 bg-[linear-gradient(90deg,transparent,rgba(255,255,255,0.02),transparent)]" />
              </div>

              <div className="relative z-10 grid grid-cols-1 gap-10 xl:grid-cols-[1.2fr_0.8fr]">
                <div className="max-w-4xl">
                  <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
                    <CandlestickChart className="h-3.5 w-3.5" />
                    KordaCore Trading Workspace
                  </div>

                  <h1 className="text-4xl font-bold tracking-tight text-foreground sm:text-5xl lg:text-6xl xl:text-7xl">
                    Precision journaling for traders who want clarity, not noise.
                  </h1>

                  <p className="mt-6 max-w-2xl text-base leading-8 text-muted-foreground lg:text-lg">
                    KordaCore helps you track execution, measure performance, review
                    psychology, and identify the behaviors behind your results. Built
                    for traders who want a cleaner process and sharper decision-making.
                  </p>

                  <div className="mt-8 flex flex-wrap gap-3">
                    <Button
                      size="lg"
                      className="gap-2 glow-effect"
                      onClick={() => navigate("/login")}
                    >
                      Start Journaling
                      <ArrowRight className="h-4 w-4" />
                    </Button>

                    <Button
                      size="lg"
                      variant="secondary"
                      onClick={() => {
                        const el = document.getElementById("features");
                        el?.scrollIntoView({ behavior: "smooth" });
                      }}
                    >
                      Explore Features
                    </Button>
                  </div>
                </div>

                <div className="glass-card rounded-2xl p-5">
                  <div className="mb-4">
                    <p className="text-sm font-medium text-foreground">Workspace Mode</p>
                    <p className="text-xs text-muted-foreground">
                      Preview the KordaCore workflow by account type
                    </p>
                  </div>

                  <Tabs value={viewMode} onValueChange={(v) => setViewMode(v as ViewMode)}>
                    <TabsList className="grid w-full grid-cols-2">
                      <TabsTrigger value="live">Live</TabsTrigger>
                      <TabsTrigger value="backtest">Backtest</TabsTrigger>
                    </TabsList>
                  </Tabs>

                  <div className="mt-5 rounded-xl border border-primary/15 bg-primary/5 p-4">
                    <p className="text-xs uppercase tracking-wide text-primary">
                      Current focus
                    </p>
                    <p className="mt-2 text-sm font-medium text-foreground">
                      {viewMode === "live"
                        ? "Review real execution, discipline, and performance under pressure."
                        : "Test setups, refine models, and validate ideas before risking capital."}
                    </p>
                  </div>

                  <div className="mt-5 grid grid-cols-2 gap-3">
                    <div className="rounded-xl border border-border bg-background/60 p-4">
                      <p className="text-xs text-muted-foreground">Trades Logged</p>
                      <p className="stat-value mt-2">428</p>
                    </div>
                    <div className="rounded-xl border border-border bg-background/60 p-4">
                      <p className="text-xs text-muted-foreground">Session Reviews</p>
                      <p className="stat-value mt-2">91</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </section>

          <section className="mx-auto max-w-7xl px-6 py-4 lg:px-10">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
              {statCards.map((card) => (
                <div
                  key={card.label}
                  className="glass-card rounded-2xl p-5 transition-all duration-200 hover:border-primary/30"
                >
                  <p className="text-sm font-medium text-muted-foreground">{card.label}</p>
                  <p className="mt-3 stat-value text-foreground">{card.value}</p>
                  <p className="mt-2 text-sm text-muted-foreground">{card.note}</p>
                </div>
              ))}
            </div>
          </section>

          <section
            id="features"
            className="mx-auto max-w-7xl px-6 py-6 lg:px-10 lg:py-8"
          >
            <div className="glass-card rounded-3xl p-8 lg:p-10">
              <div className="mb-8 flex items-start justify-between gap-4">
                <div>
                  <h2 className="text-2xl font-semibold tracking-tight text-foreground lg:text-3xl">
                    Built like a real trading operating system
                  </h2>
                  <p className="mt-2 max-w-2xl text-muted-foreground">
                    KordaCore is designed around one goal: helping traders improve
                    through structure, review, and repeatable feedback loops.
                  </p>
                </div>
                <Target className="hidden h-6 w-6 text-primary lg:block" />
              </div>

              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                {featureCards.map((feature) => {
                  const Icon = feature.icon;

                  return (
                    <div
                      key={feature.title}
                      className="rounded-2xl border border-border bg-background/60 p-6"
                    >
                      <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10 text-primary">
                        <Icon className="h-5 w-5" />
                      </div>

                      <h3 className="text-lg font-semibold text-foreground">
                        {feature.title}
                      </h3>

                      <p className="mt-3 text-sm leading-7 text-muted-foreground">
                        {feature.text}
                      </p>
                    </div>
                  );
                })}
              </div>
            </div>
          </section>

          <section
            id="workflow"
            className="mx-auto max-w-7xl px-6 py-6 lg:px-10 lg:py-8"
          >
            <div className="grid grid-cols-1 gap-6 xl:grid-cols-[0.7fr_1.3fr]">
              <div className="glass-card rounded-3xl p-6 lg:p-8">
                <h3 className="text-xl font-semibold text-foreground">Core workflow</h3>
                <p className="mt-2 text-sm text-muted-foreground">
                  The daily loop KordaCore is built around.
                </p>

                <div className="mt-6 space-y-4">
                  {workflowSteps.map((step, index) => (
                    <div key={step} className="flex gap-4">
                      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-primary/20 bg-primary/10 text-sm font-semibold text-primary">
                        {index + 1}
                      </div>
                      <div className="pt-1 text-sm text-foreground">{step}</div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="glass-card rounded-3xl p-8 lg:p-10">
                <div className="mb-6 flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
                    <Activity className="h-5 w-5" />
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-foreground">
                      Why KordaCore works
                    </h3>
                    <p className="text-sm text-muted-foreground">
                      A system focused on measurable improvement
                    </p>
                  </div>
                </div>

                <div className="grid gap-4 md:grid-cols-3">
                  <div className="rounded-xl border border-border bg-background/60 p-5">
                    <p className="text-sm font-medium text-foreground">Execution</p>
                    <p className="mt-2 text-sm leading-7 text-muted-foreground">
                      Record what you saw, what you did, and whether you followed your plan.
                    </p>
                  </div>

                  <div className="rounded-xl border border-border bg-background/60 p-5">
                    <p className="text-sm font-medium text-foreground">Reflection</p>
                    <p className="mt-2 text-sm leading-7 text-muted-foreground">
                      Review chart screenshots, emotions, and mistakes while the context is still clear.
                    </p>
                  </div>

                  <div className="rounded-xl border border-border bg-background/60 p-5">
                    <p className="text-sm font-medium text-foreground">Refinement</p>
                    <p className="mt-2 text-sm leading-7 text-muted-foreground">
                      Use repeatable patterns in your data to improve discipline and decision quality.
                    </p>
                  </div>
                </div>

                <div className="mt-6 rounded-2xl border border-primary/20 bg-primary/5 p-5">
                  <h4 className="text-base font-semibold text-foreground">
                    Start with the data. Improve the decisions.
                  </h4>
                  <p className="mt-2 text-sm leading-7 text-muted-foreground">
                    Most traders remember feelings. Very few record patterns. KordaCore
                    helps you turn scattered executions into measurable feedback so you
                    can build a cleaner process over time.
                  </p>

                  <div className="mt-5 flex flex-wrap gap-3">
                    <Button onClick={() => navigate("/login")}>Login to KordaCore</Button>
                    
                  </div>
                </div>
              </div>
            </div>
          </section>
        </main>
      </div>
    </div>
  );
}