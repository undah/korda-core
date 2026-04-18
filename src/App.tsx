import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, useLocation } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";

import SuiteAbout from "./pages/SuiteAbout";
import SuitePricing from "./pages/SuitePricing";
import SuiteHome from "./pages/SuiteHome";

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
import TrackerProgress from "./pages/tracker/TrackerProgress";
import TrackerJournal from "./pages/tracker/TrackerJournal";
import TrackerCalories from "./pages/tracker/TrackerCalories";
import TrackerPhotos from "./pages/tracker/TrackerPhotos";
import TrackerAnalysis from "./pages/tracker/TrackerAnalysis";
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

          {/* Tracker app — protected, own layout */}
          <Route element={<ProtectedRoute />}>
            <Route element={<TrackerLayout />}>
              <Route path="/tracker/dashboard" element={<TrackerDashboard />} />
              <Route path="/tracker/progress"  element={<TrackerProgress />} />
              <Route path="/tracker/journal"   element={<TrackerJournal />} />
              <Route path="/tracker/calories"  element={<TrackerCalories />} />
              <Route path="/tracker/photos"    element={<TrackerPhotos />} />
              <Route path="/tracker/analysis"  element={<TrackerAnalysis />} />
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
