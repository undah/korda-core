import React from "react";
import { Sidebar } from "./Sidebar";

interface MainLayoutProps {
  children: React.ReactNode;
}

export function MainLayout({ children }: MainLayoutProps) {
  
  return (
    <div className="min-h-screen bg-background">
      {/* Sidebar fixed so the main page scroll is the window (best for sticky) */}
      <div className="fixed inset-y-0 left-0 w-64">
        <Sidebar />
      </div>

      {/* IMPORTANT: do NOT add overflow-hidden/auto here */}
      <main className="ml-64 min-h-screen overflow-visible">
        <div className="p-8">{children}</div>
      </main>
    </div>
  );
}
