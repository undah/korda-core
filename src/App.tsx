import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";

import Index from "./pages/Index";
import Journal from "./pages/Journal";
import Analytics from "./pages/Analytics";
import Settings from "./pages/Settings";
import NotFound from "./pages/NotFound";
import Login from "./pages/Login";
import ComingSoon from "./pages/ComingSoon";

// ✅ existing
import SessionLog from "./pages/SessionLog";

// ✅ NEW: charting page
import Charting from "./pages/Charting";

import { ProtectedRoute } from "./auth/ProtectedRoute";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Routes>
          {/* Public */}
          <Route path="/login" element={<Login />} />

          {/* Protected */}
          <Route element={<ProtectedRoute />}>
            <Route path="/" element={<Index />} />
            <Route path="/journal" element={<Journal />} />
            <Route path="/analytics" element={<Analytics />} />
            <Route path="/session-log" element={<SessionLog />} />

            {/* ✅ NEW */}
            <Route path="/Charting" element={<Charting />} />

            {/* Disabled for now */}
            <Route
              path="/connections"
              element={
                <ComingSoon
                  title="Platform Connections"
                  subtitle="Connecting brokers (cTrader/MT5/TradingView) is coming soon."
                />
              }
            />
            <Route
              path="/coach"
              element={
                <ComingSoon
                  title="AI Coach"
                  subtitle="AI coaching, insights, and chat are coming soon."
                />
              }
            />

            <Route path="/settings" element={<Settings />} />
          </Route>

          {/* Fallback */}
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
