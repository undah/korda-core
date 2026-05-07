import React, { useState } from "react";
import { Sidebar } from "./Sidebar";
import { Menu } from "lucide-react";

interface MainLayoutProps {
  children: React.ReactNode;
}

export function MainLayout({ children }: MainLayoutProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="min-h-screen bg-background">
      {/* Mobile topbar — hidden on md+ */}
      <div className="md:hidden fixed top-0 left-0 right-0 z-40 h-14 bg-sidebar border-b border-sidebar-border flex items-center justify-between px-4">
        <button
          onClick={() => setSidebarOpen(true)}
          className="p-2 rounded-lg hover:bg-sidebar-accent transition-colors"
          aria-label="Open menu"
        >
          <Menu className="w-5 h-5 text-muted-foreground" />
        </button>
        <div className="flex items-center gap-2">
          <img src="/korda-icon.svg" width="26" height="26" style={{ borderRadius: 5, flexShrink: 0 }} alt="Korda" />
          <span className="font-semibold text-sm text-foreground">Korda™</span>
        </div>
        {/* right spacer to keep logo centred */}
        <div className="w-9" />
      </div>

      {/* Mobile overlay */}
      {sidebarOpen && (
        <div
          className="md:hidden fixed inset-0 z-40 bg-black/50 backdrop-blur-sm"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      {/* Main content — offset for fixed sidebar on md+, offset for topbar on mobile */}
      <main className="md:ml-64 min-h-screen overflow-visible">
        <div className="p-4 pt-[calc(3.5rem+1rem)] md:p-8 md:pt-8">{children}</div>
      </main>
    </div>
  );
}
