import { lazy, Suspense } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate, useLocation } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";

const SuiteAbout = lazy(() => import("./pages/SuiteAbout"));
const SuitePricing = lazy(() => import("./pages/SuitePricing"));
import SuiteHome from "./pages/SuiteHome";

const KordaCRM = lazy(() => import("./pages/KordaCRM"));
const CRMLayout = lazy(() => import("./features/crm/components/CRMLayout"));
const CRMDashboard = lazy(() => import("./pages/crm/CRMDashboard"));
const CRMLog = lazy(() => import("./pages/crm/CRMLog"));
const CRMLeads = lazy(() => import("./pages/crm/CRMLeads"));
const CRMWeek = lazy(() => import("./pages/crm/CRMWeek"));
const CRMScripts = lazy(() => import("./pages/crm/CRMScripts"));

const TrainingLayout = lazy(() => import("./features/training/components/TrainingLayout"));
const TrainingNew = lazy(() => import("./pages/training/TrainingNew"));
const TrainingHistory = lazy(() => import("./pages/training/TrainingHistory"));
const TrainingScheduler = lazy(() => import("./pages/training/TrainingScheduler"));
const TrainingMistakes = lazy(() => import("./pages/training/TrainingMistakes"));
const TrainingConcepts = lazy(() => import("./pages/training/TrainingConcepts"));
const TrainingPerformance = lazy(() => import("./pages/training/TrainingPerformance"));
const TrainingRules = lazy(() => import("./pages/training/TrainingRules"));
const TrainingFinetune = lazy(() => import("./pages/training/TrainingFinetune"));
const TrainingChat = lazy(() => import("./pages/training/TrainingChat"));

const KordaOutreach = lazy(() => import("./pages/KordaOutreach"));
const OutreachLayout = lazy(() => import("./features/outreach/components/OutreachLayout"));
const OutreachLeads = lazy(() => import("./pages/outreach/OutreachLeads"));
const OutreachNiches = lazy(() => import("./pages/outreach/OutreachNiches"));
const OutreachNicheForm = lazy(() => import("./pages/outreach/OutreachNicheForm"));
const OutreachBusiness = lazy(() => import("./pages/outreach/OutreachBusiness"));
const OutreachRuns = lazy(() => import("./pages/outreach/OutreachRuns"));
const OutreachSuppression = lazy(() => import("./pages/outreach/OutreachSuppression"));
const OutreachSenders = lazy(() => import("./pages/outreach/OutreachSenders"));
const OutreachSettings = lazy(() => import("./pages/outreach/OutreachSettings"));
const OutreachAnalytics = lazy(() => import("./pages/outreach/OutreachAnalytics"));
const OutreachMessages = lazy(() => import("./pages/outreach/OutreachMessages"));
const OutreachUsage = lazy(() => import("./pages/outreach/OutreachUsage"));
const OutreachCampaigns = lazy(() => import("./pages/outreach/OutreachCampaigns"));
const OutreachCampaign = lazy(() => import("./pages/outreach/OutreachCampaign"));
const OutreachCampaignNew = lazy(() => import("./pages/outreach/OutreachCampaignNew"));
const OutreachTemplates = lazy(() => import("./pages/outreach/OutreachTemplates"));

const Demo = lazy(() => import("./pages/Demo"));
const KordaTrading = lazy(() => import("./pages/KordaTrading"));
const Index = lazy(() => import("./pages/Index"));
const Journal = lazy(() => import("./pages/Journal"));
const Analytics = lazy(() => import("./pages/Analytics"));
const Settings = lazy(() => import("./pages/Settings"));
import NotFound from "./pages/NotFound";
const Login = lazy(() => import("./pages/Login"));
const ComingSoon = lazy(() => import("./pages/ComingSoon"));

const TrackerLogin = lazy(() => import("./pages/TrackerLogin"));
const KordaTracker = lazy(() => import("./pages/KordaTracker"));
const TrackerLayout = lazy(() => import("./features/tracker/components/TrackerLayout"));
const KordaBudget = lazy(() => import("./pages/KordaBudget"));
const BudgetLogin = lazy(() => import("./pages/BudgetLogin"));
const BudgetLayout = lazy(() => import("./features/budget/components/BudgetLayout"));
const BudgetOverzicht = lazy(() => import("./pages/budget/BudgetOverzicht"));
const BudgetPotjes = lazy(() => import("./pages/budget/BudgetPotjes"));
const BudgetMeer = lazy(() => import("./pages/budget/BudgetMeer"));
const BudgetPotDetail = lazy(() => import("./pages/budget/BudgetPotDetail"));
const BudgetHuishoudens = lazy(() => import("./pages/budget/BudgetHuishoudens"));
const BudgetTransacties = lazy(() => import("./pages/budget/BudgetTransacties"));
const BudgetDoelen = lazy(() => import("./pages/budget/BudgetDoelen"));
const BudgetVasteLasten = lazy(() => import("./pages/budget/BudgetVasteLasten"));
const BudgetVerrekenen = lazy(() => import("./pages/budget/BudgetVerrekenen"));
const BudgetRekeningen = lazy(() => import("./pages/budget/BudgetRekeningen"));
const BudgetWeek = lazy(() => import("./pages/budget/BudgetWeek"));
const BudgetSnelIndelen = lazy(() => import("./pages/budget/BudgetSnelIndelen"));
const BudgetBankTerug = lazy(() => import("./pages/budget/BudgetBankTerug"));
const BudgetPrivacy = lazy(() => import("./pages/budget/BudgetJuridisch").then((m) => ({ default: m.BudgetPrivacy })));
const BudgetVoorwaarden = lazy(() => import("./pages/budget/BudgetJuridisch").then((m) => ({ default: m.BudgetVoorwaarden })));
const TrackerDashboard = lazy(() => import("./pages/tracker/TrackerDashboard"));
const TrackerGraph = lazy(() => import("./pages/tracker/TrackerGraph"));
const TrackerProgress = lazy(() => import("./pages/tracker/TrackerProgress"));
const TrackerJournal = lazy(() => import("./pages/tracker/TrackerJournal"));
const TrackerPhotos = lazy(() => import("./pages/tracker/TrackerPhotos"));
const TrackerAnalysis = lazy(() => import("./pages/tracker/TrackerAnalysis"));
const TrackerSettings = lazy(() => import("./pages/tracker/TrackerSettings"));
const TrackerStrava = lazy(() => import("./pages/tracker/TrackerStrava"));
const SessionLog = lazy(() => import("./pages/SessionLog"));
const Charting = lazy(() => import("./pages/Charting"));
import { ProtectedRoute } from "./auth/ProtectedRoute";


const queryClient = new QueryClient({
  defaultOptions: {
    queries: { staleTime: 1000 * 60 * 5, retry: 1 },
  },
});

const pageVariants = {
  initial: { opacity: 0, y: 10 },
  animate: { opacity: 1, y: 0 },
  exit:    { opacity: 0, y: -10 },
};

const pageTransition = {
  duration: 0.18,
  ease: [0.4, 0, 0.2, 1] as const,
};

function AnimatedRoutes() {
  const location = useLocation();

  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={location.pathname}
        variants={pageVariants}
        initial="initial"
        animate="animate"
        exit="exit"
        transition={pageTransition}
        style={{ minHeight: "100vh" }}
      >
        <Suspense fallback={<div style={{ minHeight: "100vh" }} />}>
        <Routes location={location}>
          {/* Public */}
          <Route path="/" element={<SuiteHome />} />
          <Route path="/about" element={<SuiteAbout />} />
<Route path="/pricing" element={<SuitePricing />} />
          <Route path="/trading" element={<KordaTrading />} />
          <Route path="/login" element={<Login />} />
          <Route path="/tracker" element={<KordaTracker />} />
          <Route path="/tracker/login" element={<TrackerLogin />} />
          <Route path="/demo" element={<Demo />} />

          {/* Tracker app — protected, own layout */}
          <Route element={<ProtectedRoute />}>
            <Route element={<TrackerLayout />}>
              <Route path="/tracker/dashboard" element={<TrackerDashboard />} />
              <Route path="/tracker/graph"     element={<TrackerGraph />} />
              <Route path="/tracker/progress"  element={<TrackerProgress />} />
              <Route path="/tracker/journal"   element={<TrackerJournal />} />
              <Route path="/tracker/photos"    element={<TrackerPhotos />} />
              <Route path="/tracker/analysis"  element={<TrackerAnalysis />} />
              <Route path="/tracker/settings" element={<TrackerSettings />} />
              <Route path="/tracker/strava"   element={<TrackerStrava />} />
            </Route>
          </Route>

          {/* KordaBudget — public landing + own sign-in, then the protected app */}
          <Route path="/budget" element={<KordaBudget />} />
          <Route path="/budget/login" element={<BudgetLogin />} />
          <Route path="/budget/privacy" element={<BudgetPrivacy />} />
          <Route path="/budget/voorwaarden" element={<BudgetVoorwaarden />} />
          <Route element={<ProtectedRoute loginPath="/budget/login" />}>
            <Route element={<BudgetLayout />}>
              <Route path="/budget/overzicht"   element={<BudgetOverzicht />} />
              <Route path="/budget/potjes"      element={<BudgetPotjes />} />
              <Route path="/budget/potjes/:potId" element={<BudgetPotDetail />} />
              <Route path="/budget/transacties" element={<BudgetTransacties />} />
              <Route path="/budget/doelen"      element={<BudgetDoelen />} />
              <Route path="/budget/meer"        element={<BudgetMeer />} />
              <Route path="/budget/huishoudens" element={<BudgetHuishoudens />} />
              <Route path="/budget/vaste-lasten" element={<BudgetVasteLasten />} />
              <Route path="/budget/verrekenen"  element={<BudgetVerrekenen />} />
              <Route path="/budget/rekeningen"  element={<BudgetRekeningen />} />
              <Route path="/budget/week"        element={<BudgetWeek />} />
              <Route path="/budget/indelen"     element={<BudgetSnelIndelen />} />
              <Route path="/budget/bank/terug"  element={<BudgetBankTerug />} />
            </Route>
          </Route>

          {/* Trading app — protected */}
          <Route element={<ProtectedRoute />}>
            <Route path="/dashboard"   element={<Index />} />
            <Route path="/journal"     element={<Journal />} />
            <Route path="/analytics"   element={<Analytics />} />
            <Route path="/session-log" element={<SessionLog />} />
            <Route path="/Charting"    element={<Charting />} />
            <Route path="/connections" element={<ComingSoon title="Platform Connections" subtitle="Connecting brokers (cTrader/MT5/TradingView) is coming soon." />} />
            <Route path="/coach"       element={<ComingSoon title="AI Coach" subtitle="AI coaching, insights, and chat are coming soon." />} />
            <Route path="/settings"    element={<Settings />} />
          </Route>

          {/* KordaAI Training */}
          <Route element={<TrainingLayout />}>
            <Route path="/training/new"                  element={<TrainingNew />} />
            <Route path="/training/history"              element={<TrainingHistory />} />
            <Route path="/training/mistakes"             element={<TrainingMistakes />} />
            <Route path="/training/screenshot-scheduler" element={<TrainingScheduler />} />
            <Route path="/training/concepts"             element={<TrainingConcepts />} />
            <Route path="/training/performance"          element={<TrainingPerformance />} />
            <Route path="/training/rules"               element={<TrainingRules />} />
            <Route path="/training/finetune"            element={<TrainingFinetune />} />
            <Route path="/training/chat"               element={<TrainingChat />} />
          </Route>

          {/* Korda Outreach — public landing + sign-in */}
          <Route path="/outreach" element={<KordaOutreach />} />

          {/* Korda Outreach — protected console */}
          <Route element={<ProtectedRoute />}>
            <Route element={<OutreachLayout />}>
              <Route path="/outreach/leads" element={<OutreachLeads />} />
              <Route path="/outreach/niches" element={<OutreachNiches />} />
              <Route path="/outreach/niches/new" element={<OutreachNicheForm />} />
              <Route path="/outreach/niches/:id" element={<OutreachNicheForm />} />
              <Route path="/outreach/businesses/:id" element={<OutreachBusiness />} />
              <Route path="/outreach/campaigns" element={<OutreachCampaigns />} />
              <Route path="/outreach/campaigns/new" element={<OutreachCampaignNew />} />
              <Route path="/outreach/campaigns/:id" element={<OutreachCampaign />} />
              <Route path="/outreach/templates" element={<OutreachTemplates />} />
              <Route path="/outreach/messages" element={<OutreachMessages />} />
              <Route path="/outreach/analytics" element={<OutreachAnalytics />} />
              <Route path="/outreach/usage" element={<OutreachUsage />} />
              <Route path="/outreach/runs" element={<OutreachRuns />} />
              <Route path="/outreach/senders" element={<OutreachSenders />} />
              <Route path="/outreach/suppression" element={<OutreachSuppression />} />
              <Route path="/outreach/settings" element={<OutreachSettings />} />
            </Route>
          </Route>

          {/* KordaCRM — public landing */}
          <Route path="/crm" element={<KordaCRM />} />

          {/* KordaCRM — protected app */}
          <Route element={<CRMLayout />}>
            <Route path="/crm/dashboard" element={<CRMDashboard />} />
            <Route path="/crm/log"       element={<CRMLog />} />
            <Route path="/crm/leads"     element={<CRMLeads />} />
            <Route path="/crm/week"      element={<CRMWeek />} />
            <Route path="/crm/scripts"   element={<CRMScripts />} />
          </Route>

          {/* Fallback */}
          <Route path="*" element={<NotFound />} />
        </Routes>
        </Suspense>
      </motion.div>
    </AnimatePresence>
  );
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AnimatedRoutes />
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
