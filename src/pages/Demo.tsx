import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  Zap, Sun, ShieldCheck, Clock, CheckCircle2, Check, CheckCheck,
  RotateCcw, ArrowLeft, Battery, Mic, Send, Sparkles, PhoneCall,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";

// ─────────────────────────────────────────────────────────────────────────
// Types & script
// ─────────────────────────────────────────────────────────────────────────

type PanelStatus = "Ja" | "Nee" | "Binnenkort" | "";

interface LeadInfo {
  naam: string;
  telefoon: string;
  email: string;
  postcode: string;
  panelen: PanelStatus;
}

type Sender = "agent" | "lead";

interface ScriptMessage {
  sender: Sender;
  text: string;
  /** how long the typing indicator shows before this message lands, ms */
  typingMs: number;
  /** gap after this message before the next typing indicator starts, ms */
  gapMs: number;
}

const firstName = (naam: string) => naam.trim().split(/\s+/)[0] || "daar";

function panelClause(status: PanelStatus): string {
  switch (status) {
    case "Ja":
      return " — mooi te combineren met je zonnepanelen";
    case "Binnenkort":
      return ", dat timet perfect met je nieuwe zonnepanelen";
    case "Nee":
      return " — ook zonder zonnepanelen kun je flink besparen";
    default:
      return "";
  }
}

function buildScript(lead: LeadInfo): ScriptMessage[] {
  const naam = firstName(lead.naam);
  return [
    {
      sender: "agent",
      typingMs: 1400,
      gapMs: 900,
      text: `Hoi ${naam}! 👋 Leuk dat je gratis batterij-advies hebt aangevraagd${panelClause(lead.panelen)}. Ik ben de digitale assistent van EnergieThuis en help je meteen op weg. Heb je 30 seconden voor 2 korte vragen?`,
    },
    {
      sender: "lead",
      typingMs: 800,
      gapMs: 900,
      text: "Ja hoor, prima! 🙂",
    },
    {
      sender: "agent",
      typingMs: 1300,
      gapMs: 900,
      text: "Top! Even kort: woon je in een koopwoning, en wanneer zou je de batterij het liefst geregeld willen hebben?",
    },
    {
      sender: "lead",
      typingMs: 1000,
      gapMs: 900,
      text: "Ja, koopwoning. Het liefst zo snel mogelijk, mijn energierekening is nu best hoog 😅",
    },
    {
      sender: "agent",
      typingMs: 1500,
      gapMs: 900,
      text: "Helder, dat pakken we snel op! Ik kan je inplannen voor een gratis adviesgesprek (15 min) met een van onze energie-experts. Schikt een van deze twee momenten?\n🗓️ Morgen 14:00 uur\n🗓️ Donderdag 10:30 uur",
    },
    {
      sender: "lead",
      typingMs: 900,
      gapMs: 900,
      text: "Donderdag 10:30 uur werkt goed voor mij",
    },
    {
      sender: "agent",
      typingMs: 1300,
      gapMs: 0,
      text: `Top, ${naam}! Je staat ingepland voor donderdag 10:30 uur ✅ Je ontvangt zo een bevestiging per e-mail. Tot dan — dan kijken we samen hoeveel je kunt besparen met een thuisbatterij! 🔋`,
    },
  ];
}

const FIRST_RESPONSE_MS = 6200;

// index (in delivered-message count) at which each timeline stage lights up
const STAGE_AT = {
  ontvangen: 0,
  contact: 1, // after agent's greeting (1 message delivered)
  gekwalificeerd: 4, // after lead's qualification answer (4 messages delivered)
  afspraak: 7, // after final agent confirmation (all 7 delivered)
};

const TIMELINE_STEPS = [
  { key: "ontvangen", label: "Lead ontvangen" },
  { key: "contact", label: "Contact gelegd" },
  { key: "gekwalificeerd", label: "Gekwalificeerd" },
  { key: "afspraak", label: "Afspraak geboekt" },
] as const;

function formatClock(offsetSeconds: number) {
  const d = new Date(Date.now() + offsetSeconds * 1000);
  return d.toLocaleTimeString("nl-NL", { hour: "2-digit", minute: "2-digit" });
}

// ─────────────────────────────────────────────────────────────────────────
// Phase 1 — Lead capture
// ─────────────────────────────────────────────────────────────────────────

const BENEFITS = [
  { icon: Battery, text: "Tot €800 besparing per jaar op je energierekening" },
  { icon: ShieldCheck, text: "Onafhankelijk & 100% vrijblijvend advies" },
  { icon: Zap, text: "Reactie binnen enkele seconden, dag en nacht" },
];

function LeadCaptureForm({ onSubmit }: { onSubmit: (lead: LeadInfo) => void }) {
  const [naam, setNaam] = useState("");
  const [telefoon, setTelefoon] = useState("");
  const [email, setEmail] = useState("");
  const [postcode, setPostcode] = useState("");
  const [panelen, setPanelen] = useState<PanelStatus>("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!panelen) return;
    onSubmit({ naam, telefoon, email, postcode, panelen });
  };

  return (
    <div className="min-h-screen w-full flex items-center justify-center px-4 py-16 sm:py-20">
      <div className="w-full max-w-6xl grid lg:grid-cols-[1.1fr_0.9fr] gap-12 lg:gap-16 items-center">
        {/* Left: hero copy */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: [0.4, 0, 0.2, 1] }}
        >
          <div className="inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-3.5 py-1.5 text-xs font-medium text-primary mb-6">
            <Sun size={14} />
            Gratis batterij-check
          </div>

          <h1 className="text-4xl sm:text-5xl lg:text-[3.4rem] font-semibold leading-[1.08] tracking-tight text-foreground mb-5">
            Ontdek hoeveel je bespaart<br className="hidden sm:block" />
            met een <span className="text-primary">thuisbatterij</span>.
          </h1>

          <p className="text-base sm:text-lg text-muted-foreground max-w-lg mb-8 leading-relaxed">
            Vul je gegevens in en ontvang direct persoonlijk advies van onze
            energie-expert — geen wachttijd, geen verplichtingen.
          </p>

          <div className="flex flex-col gap-3.5">
            {BENEFITS.map(({ icon: Icon, text }) => (
              <div key={text} className="flex items-center gap-3">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                  <Icon size={16} />
                </span>
                <span className="text-sm text-foreground/80">{text}</span>
              </div>
            ))}
          </div>
        </motion.div>

        {/* Right: form card */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.1, ease: [0.4, 0, 0.2, 1] }}
        >
          <Card className="p-6 sm:p-8 border-border/60 shadow-xl">
            <h2 className="text-lg font-semibold text-foreground mb-1">Gratis advies aanvragen</h2>
            <p className="text-sm text-muted-foreground mb-6">
              We nemen direct contact met je op via WhatsApp.
            </p>

            <form onSubmit={handleSubmit} className="flex flex-col gap-4">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="naam">Naam</Label>
                <Input
                  id="naam"
                  required
                  placeholder="Voor- en achternaam"
                  value={naam}
                  onChange={(e) => setNaam(e.target.value)}
                  autoComplete="off"
                />
              </div>

              <div className="grid sm:grid-cols-2 gap-4">
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="telefoon">Telefoonnummer</Label>
                  <Input
                    id="telefoon"
                    required
                    type="tel"
                    placeholder="06 12345678"
                    value={telefoon}
                    onChange={(e) => setTelefoon(e.target.value)}
                    autoComplete="off"
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="postcode">Postcode</Label>
                  <Input
                    id="postcode"
                    required
                    placeholder="1234 AB"
                    value={postcode}
                    onChange={(e) => setPostcode(e.target.value)}
                    autoComplete="off"
                  />
                </div>
              </div>

              <div className="flex flex-col gap-1.5">
                <Label htmlFor="email">E-mailadres</Label>
                <Input
                  id="email"
                  required
                  type="email"
                  placeholder="naam@voorbeeld.nl"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  autoComplete="off"
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <Label htmlFor="panelen">Heb je al zonnepanelen?</Label>
                <Select value={panelen} onValueChange={(v) => setPanelen(v as PanelStatus)}>
                  <SelectTrigger id="panelen">
                    <SelectValue placeholder="Kies een optie" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Ja">Ja</SelectItem>
                    <SelectItem value="Nee">Nee</SelectItem>
                    <SelectItem value="Binnenkort">Binnenkort</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <Button type="submit" size="lg" variant="glow" className="mt-2">
                Gratis advies aanvragen
              </Button>

              <p className="text-[0.7rem] text-muted-foreground text-center mt-1">
                Demo-omgeving — er wordt geen data verzonden of opgeslagen.
              </p>
            </form>
          </Card>
        </motion.div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────
// Phase 2 — Agent chat
// ─────────────────────────────────────────────────────────────────────────

function TypingDots() {
  return (
    <span className="inline-flex items-center gap-1">
      {[0, 1, 2].map((i) => (
        <motion.span
          key={i}
          className="h-1.5 w-1.5 rounded-full bg-current opacity-60"
          animate={{ y: [0, -3, 0] }}
          transition={{ duration: 0.9, repeat: Infinity, delay: i * 0.15, ease: "easeInOut" }}
        />
      ))}
    </span>
  );
}

function ChatBubble({ msg, timeOffset }: { msg: ScriptMessage; timeOffset: number }) {
  const isAgent = msg.sender === "agent";
  return (
    <motion.div
      initial={{ opacity: 0, y: 10, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.25, ease: [0.4, 0, 0.2, 1] }}
      className={`flex ${isAgent ? "justify-start" : "justify-end"}`}
    >
      <div
        className={`max-w-[82%] rounded-2xl px-3.5 py-2.5 text-[0.83rem] leading-relaxed whitespace-pre-line shadow-sm ${
          isAgent
            ? "bg-white text-neutral-900 rounded-tl-sm"
            : "bg-[#DCF8C6] text-neutral-900 rounded-tr-sm"
        }`}
      >
        {msg.text}
        <div
          className={`mt-1 flex items-center gap-1 text-[0.62rem] ${
            isAgent ? "text-neutral-400 justify-end" : "text-neutral-500 justify-end"
          }`}
        >
          {formatClock(timeOffset)}
          {!isAgent && <CheckCheck size={13} className="text-sky-500" />}
        </div>
      </div>
    </motion.div>
  );
}

function TypingBubble({ sender }: { sender: Sender }) {
  const isAgent = sender === "agent";
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0 }}
      className={`flex ${isAgent ? "justify-start" : "justify-end"}`}
    >
      <div
        className={`rounded-2xl px-4 py-2.5 shadow-sm ${
          isAgent ? "bg-white text-neutral-400 rounded-tl-sm" : "bg-[#DCF8C6] text-neutral-500 rounded-tr-sm"
        }`}
      >
        <TypingDots />
      </div>
    </motion.div>
  );
}

function SpeedToLeadCard({
  elapsedMs,
  resolved,
  responseSeconds,
}: {
  elapsedMs: number;
  resolved: boolean;
  responseSeconds: number;
}) {
  return (
    <div className="relative">
      <AnimatePresence mode="wait">
        {!resolved ? (
          <motion.div
            key="waiting"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="rounded-xl border border-border/60 bg-card px-5 py-4"
          >
            <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground mb-1">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-60" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-primary" />
              </span>
              Agent verwerkt de aanvraag…
            </div>
            <div className="font-mono text-2xl font-semibold text-foreground tabular-nums">
              {(elapsedMs / 1000).toFixed(1)}s
            </div>
          </motion.div>
        ) : (
          <motion.div
            key="resolved"
            initial={{ opacity: 0, scale: 0.92 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ type: "spring", stiffness: 260, damping: 18 }}
            className="rounded-xl border border-primary/40 bg-primary/10 px-5 py-4 animate-glow-pulse"
          >
            <div className="flex items-center gap-2 text-xs font-medium text-primary mb-1">
              <Zap size={14} />
              Speed-to-lead
            </div>
            <div className="flex items-baseline gap-2">
              <span className="font-mono text-2xl font-semibold text-foreground tabular-nums">
                {responseSeconds} sec
              </span>
              <span className="text-sm text-foreground/70">reactietijd</span>
            </div>
            <p className="text-[0.72rem] text-muted-foreground mt-1">
              24/7 — geen enkele lead wacht ooit op een medewerker.
            </p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function StatusTimeline({ deliveredCount }: { deliveredCount: number }) {
  return (
    <div className="rounded-xl border border-border/60 bg-card px-5 py-5">
      <p className="text-xs font-medium text-muted-foreground mb-4 uppercase tracking-wide">Voortgang</p>
      <div className="flex flex-col gap-0">
        {TIMELINE_STEPS.map((step, i) => {
          const active = deliveredCount >= STAGE_AT[step.key];
          const isLast = i === TIMELINE_STEPS.length - 1;
          const isFinal = active && step.key === "afspraak";
          return (
            <div key={step.key} className="flex gap-3">
              <div className="flex flex-col items-center">
                <motion.span
                  initial={false}
                  animate={{
                    backgroundColor: active ? (isFinal ? "hsl(var(--success))" : "hsl(var(--primary))") : "hsl(var(--muted))",
                    scale: active ? 1 : 0.85,
                  }}
                  transition={{ duration: 0.3 }}
                  className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full"
                >
                  {active ? (
                    <Check size={13} className="text-primary-foreground" />
                  ) : (
                    <span className="h-1.5 w-1.5 rounded-full bg-foreground/30" />
                  )}
                </motion.span>
                {!isLast && (
                  <span
                    className={`w-px flex-1 min-h-[1.5rem] transition-colors duration-300 ${
                      deliveredCount > STAGE_AT[step.key] ? "bg-primary/50" : "bg-border"
                    }`}
                  />
                )}
              </div>
              <div className={`pb-6 text-sm ${active ? "text-foreground font-medium" : "text-muted-foreground"}`}>
                {step.label}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function PhoneMockup({
  messages,
  typingSender,
  leadName,
}: {
  messages: ScriptMessage[];
  typingSender: Sender | null;
  leadName: string;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages.length, typingSender]);

  return (
    <div className="mx-auto w-full max-w-[380px]">
      <div className="rounded-[2.5rem] border-[6px] border-neutral-800 bg-neutral-800 shadow-2xl overflow-hidden">
        {/* status bar */}
        <div className="bg-[#075E54] px-4 pt-2.5 pb-0 flex items-center justify-between text-white text-[0.65rem]">
          <span>{new Date().toLocaleTimeString("nl-NL", { hour: "2-digit", minute: "2-digit" })}</span>
          <span className="flex items-center gap-1">
            <span className="h-2 w-2 rounded-full bg-white/80" />
            5G
          </span>
        </div>
        {/* chat header */}
        <div className="bg-[#075E54] px-4 py-3 flex items-center gap-3 text-white">
          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-white/15 text-sm font-semibold">
            ET
          </div>
          <div className="flex-1">
            <div className="text-sm font-medium leading-none">EnergieThuis</div>
            <div className="text-[0.68rem] text-white/70 mt-0.5">
              {typingSender ? "aan het typen…" : "online"}
            </div>
          </div>
          <PhoneCall size={16} className="text-white/80" />
        </div>

        {/* messages */}
        <div
          ref={scrollRef}
          className="h-[440px] overflow-y-auto px-3 py-4 flex flex-col gap-2.5"
          style={{
            backgroundColor: "#e5ddd5",
            backgroundImage:
              "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='60' height='60' viewBox='0 0 60 60'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23d9d0c7' fill-opacity='0.4'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E\")",
          }}
        >
          {messages.length === 0 && !typingSender && (
            <div className="flex-1 flex items-center justify-center text-center px-6">
              <p className="text-xs text-neutral-500">
                Zodra {firstName(leadName) || "de lead"} het formulier verstuurt, start het gesprek hier automatisch.
              </p>
            </div>
          )}
          {messages.map((m, i) => (
            <ChatBubble key={i} msg={m} timeOffset={i} />
          ))}
          <AnimatePresence>
            {typingSender && <TypingBubble key="typing" sender={typingSender} />}
          </AnimatePresence>
        </div>

        {/* input bar (decorative) */}
        <div className="bg-[#f0f0f0] px-3 py-2.5 flex items-center gap-2">
          <div className="flex-1 rounded-full bg-white px-4 py-2 text-xs text-neutral-400">
            Typ een bericht
          </div>
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[#075E54] text-white">
            {typingSender ? <Mic size={14} /> : <Send size={13} />}
          </div>
        </div>
      </div>
    </div>
  );
}

function AgentDemo({ lead, runId, onBack, onReplay }: {
  lead: LeadInfo;
  runId: number;
  onBack: () => void;
  onReplay: () => void;
}) {
  const script = useRef(buildScript(lead));
  const [delivered, setDelivered] = useState<ScriptMessage[]>([]);
  const [typingSender, setTypingSender] = useState<Sender | null>(null);
  const [elapsedMs, setElapsedMs] = useState(0);
  const [firstReplyResolved, setFirstReplyResolved] = useState(false);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const interval = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    script.current = buildScript(lead);
    timers.current.forEach(clearTimeout);
    timers.current = [];
    if (interval.current) clearInterval(interval.current);
    setDelivered([]);
    setTypingSender(null);
    setElapsedMs(0);
    setFirstReplyResolved(false);

    const schedule = (fn: () => void, ms: number) => {
      const id = setTimeout(fn, ms);
      timers.current.push(id);
    };

    const startedAt = performance.now();
    interval.current = setInterval(() => {
      setElapsedMs(performance.now() - startedAt);
    }, 50);

    // cumulative timeline: typing indicator -> message land -> gap -> next typing indicator ...
    let t = FIRST_RESPONSE_MS;
    schedule(() => setTypingSender("agent"), Math.max(0, FIRST_RESPONSE_MS - script.current[0].typingMs));

    script.current.forEach((msg, i) => {
      schedule(() => {
        if (i === 0) {
          if (interval.current) clearInterval(interval.current);
          setFirstReplyResolved(true);
        }
        setTypingSender(null);
        setDelivered((prev) => [...prev, msg]);
      }, t);

      const next = script.current[i + 1];
      t += msg.gapMs;
      if (next) {
        schedule(() => setTypingSender(next.sender), t);
        t += next.typingMs;
      }
    });

    return () => {
      timers.current.forEach(clearTimeout);
      timers.current = [];
      if (interval.current) clearInterval(interval.current);
    };
  }, [runId, lead]);

  const responseSeconds = Math.round(FIRST_RESPONSE_MS / 1000);
  const done = delivered.length >= script.current.length;

  return (
    <div className="min-h-screen w-full px-4 py-10 sm:py-14">
      <div className="max-w-6xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <button
            onClick={onBack}
            className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft size={15} />
            Nieuwe aanvraag
          </button>
          <Button variant="outline" size="sm" onClick={onReplay} className="gap-1.5">
            <RotateCcw size={14} />
            Replay demo
          </Button>
        </div>

        <div className="text-center mb-10">
          <div className="inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-3.5 py-1.5 text-xs font-medium text-primary mb-4">
            <Sparkles size={13} />
            AI lead follow-up agent
          </div>
          <h1 className="text-2xl sm:text-3xl font-semibold text-foreground">
            {firstName(lead.naam)}, je aanvraag wordt nu live opgepakt
          </h1>
          <p className="text-sm text-muted-foreground mt-2">
            Geen wachtrij, geen medewerker nodig — de agent neemt het gesprek direct over.
          </p>
        </div>

        <div className="grid lg:grid-cols-[340px_1fr] gap-8 items-start">
          {/* Left sidebar: speed + timeline */}
          <div className="flex flex-col gap-4 order-2 lg:order-1">
            <SpeedToLeadCard elapsedMs={elapsedMs} resolved={firstReplyResolved} responseSeconds={responseSeconds} />
            <StatusTimeline deliveredCount={delivered.length} />

            <div className="rounded-xl border border-border/60 bg-card px-5 py-4">
              <p className="text-xs font-medium text-muted-foreground mb-3 uppercase tracking-wide">Lead</p>
              <div className="flex flex-col gap-1.5 text-sm">
                <div className="flex justify-between"><span className="text-muted-foreground">Naam</span><span className="text-foreground font-medium">{lead.naam || "—"}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Telefoon</span><span className="text-foreground">{lead.telefoon || "—"}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Postcode</span><span className="text-foreground">{lead.postcode || "—"}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Zonnepanelen</span><span className="text-foreground">{lead.panelen || "—"}</span></div>
              </div>
            </div>

            <AnimatePresence>
              {done && (
                <motion.div
                  initial={{ opacity: 0, y: 10, scale: 0.96 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  transition={{ type: "spring", stiffness: 240, damping: 20 }}
                  className="rounded-xl border border-success/40 bg-success/10 px-5 py-4"
                >
                  <div className="flex items-center gap-2 text-success font-semibold text-sm mb-1">
                    <CheckCircle2 size={16} />
                    Afspraak geboekt
                  </div>
                  <p className="text-xs text-foreground/70">
                    Lead warm &amp; gekwalificeerd — klaar voor de sales-agenda.
                  </p>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Right: phone */}
          <div className="order-1 lg:order-2">
            <PhoneMockup messages={delivered} typingSender={typingSender} leadName={lead.naam} />
          </div>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────
// Page
// ─────────────────────────────────────────────────────────────────────────

const EMPTY_LEAD: LeadInfo = { naam: "", telefoon: "", email: "", postcode: "", panelen: "" };

export default function Demo() {
  const [lead, setLead] = useState<LeadInfo>(EMPTY_LEAD);
  const [phase, setPhase] = useState<"capture" | "agent">("capture");
  const [runId, setRunId] = useState(0);

  const handleSubmit = (l: LeadInfo) => {
    setLead(l);
    setRunId((n) => n + 1);
    setPhase("agent");
  };

  const handleBack = () => {
    setPhase("capture");
  };

  const handleReplay = () => {
    setRunId((n) => n + 1);
  };

  return (
    <div className="min-h-screen bg-background">
      <AnimatePresence mode="wait">
        {phase === "capture" ? (
          <motion.div key="capture" exit={{ opacity: 0 }} transition={{ duration: 0.2 }}>
            <LeadCaptureForm onSubmit={handleSubmit} />
          </motion.div>
        ) : (
          <motion.div
            key="agent"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.3 }}
          >
            <AgentDemo lead={lead} runId={runId} onBack={handleBack} onReplay={handleReplay} />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
