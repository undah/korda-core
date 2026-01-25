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

import { ProtectedRoute } from "./auth/ProtectedRoute";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<Login />} />

          <Route element={<ProtectedRoute />}>
            <Route path="/" element={<Index />} />
            <Route path="/journal" element={<Journal />} />
            <Route path="/analytics" element={<Analytics />} />

            {/* Disabled for now (easy to revert later) */}
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

          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
