import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate, useLocation } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";

import SuiteAbout from "./pages/SuiteAbout";
import SuitePricing from "./pages/SuitePricing";
import SuiteHome from "./pages/SuiteHome";

import KordaCRM from "./pages/KordaCRM";
import CRMLayout from "./features/crm/components/CRMLayout";
import CRMDashboard from "./pages/crm/CRMDashboard";
import CRMLog from "./pages/crm/CRMLog";
import CRMLeads from "./pages/crm/CRMLeads";
import CRMWeek from "./pages/crm/CRMWeek";
import CRMScripts from "./pages/crm/CRMScripts";

import TrainingLayout from "./features/training/components/TrainingLayout";
import TrainingNew from "./pages/training/TrainingNew";
import TrainingHistory from "./pages/training/TrainingHistory";
import TrainingScheduler from "./pages/training/TrainingScheduler";
import TrainingMistakes from "./pages/training/TrainingMistakes";
import TrainingConcepts from "./pages/training/TrainingConcepts";
import TrainingPerformance from "./pages/training/TrainingPerformance";
import TrainingRules from "./pages/training/TrainingRules";
import TrainingFinetune from "./pages/training/TrainingFinetune";
import TrainingChat from "./pages/training/TrainingChat";

import Demo from "./pages/Demo";
import KordaTrading from "./pages/KordaTrading";
import Index from "./pages/Index";
import Journal from "./pages/Journal";
import Analytics from "./pages/Analytics";
import Settings from "./pages/Settings";
import NotFound from "./pages/NotFound";
import Login from "./pages/Login";
import ComingSoon from "./pages/ComingSoon";

import TrackerLogin from "./pages/TrackerLogin";
import KordaTracker from "./pages/KordaTracker";
import TrackerLayout from "./features/tracker/components/TrackerLayout";
import TrackerDashboard from "./pages/tracker/TrackerDashboard";
import TrackerGraph from "./pages/tracker/TrackerGraph";
import TrackerProgress from "./pages/tracker/TrackerProgress";
import TrackerJournal from "./pages/tracker/TrackerJournal";
import TrackerPhotos from "./pages/tracker/TrackerPhotos";
import TrackerAnalysis from "./pages/tracker/TrackerAnalysis";
import TrackerSettings from "./pages/tracker/TrackerSettings";
import TrackerStrava from "./pages/tracker/TrackerStrava";
import SessionLog from "./pages/SessionLog";
import Charting from "./pages/Charting";
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
