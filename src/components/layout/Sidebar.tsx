import {
  LayoutDashboard,
  BookOpen,
  CalendarDays,
  Link2,
  Bot,
  BarChart3,
  Settings,
  LogOut,
  User as UserIcon,
  CandlestickChart,
  Brain,
  ArrowLeft,
} from "lucide-react";
import { NavLink, Link, useLocation } from "react-router-dom";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/auth/AuthProvider";

const navItems = [
  { icon: LayoutDashboard, label: "Dashboard", path: "/dashboard" },
  { icon: BookOpen, label: "Journal", path: "/journal" },

  { icon: CalendarDays, label: "Session Log", path: "/session-log" },
  { icon: BarChart3, label: "Analytics", path: "/analytics" },
  { icon: CandlestickChart, label: "Charts", path: "/charting" },
  { icon: Link2, label: "Connections", path: "/connections" },
  { icon: Bot, label: "AI Coach", path: "/coach" },
  { icon: Settings, label: "Settings", path: "/settings" },
];

export function Sidebar() {
  const location = useLocation();
  const { user, signOut } = useAuth();

  return (
    <aside className="fixed left-0 top-0 h-screen w-64 bg-sidebar border-r border-sidebar-border flex flex-col">
      {/* Logo */}
      <div className="p-6 border-b border-sidebar-border">
        <div className="flex items-center gap-3">
          <img src="/korda-icon.svg" width="36" height="36" style={{ flexShrink: 0, borderRadius: 6 }} />
          <div>
            <h1 className="font-semibold text-foreground">Korda™</h1>
            <p className="text-xs text-muted-foreground">Trading Journal</p>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-4 space-y-1">
        {navItems.map((item) => {
          const isActive = location.pathname === item.path;
          return (
            <NavLink
              key={item.path}
              to={item.path}
              className={cn(
                "flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-all duration-200",
                isActive
                  ? "bg-primary/10 text-primary border border-primary/20"
                  : "text-muted-foreground hover:text-foreground hover:bg-sidebar-accent"
              )}
            >
              <item.icon className={cn("w-5 h-5", isActive && "text-primary")} />
              {item.label}
            </NavLink>
          );
        })}
      </nav>

      {/* Back to Suite */}
      <div className="px-4 pb-1">
        <Link
          to="/"
          className="flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 text-muted-foreground hover:text-foreground hover:bg-sidebar-accent"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Suite
        </Link>
      </div>

      {/* AI Training shortcut */}
      <div className="px-4 pb-2">
        <NavLink
          to="/training/new"
          className="flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 border border-cyan-500/20 bg-cyan-500/5 text-cyan-400 hover:bg-cyan-500/10 hover:border-cyan-500/40"
        >
          <Brain className="w-4 h-4" />
          AI Training Data
        </NavLink>
      </div>

      {/* Account */}
      <div className="p-4 border-t border-sidebar-border">
        <div className="glass-card p-4 rounded-lg space-y-3">
          <div className="flex items-center gap-2">
            <UserIcon className="w-4 h-4 text-muted-foreground" />
            <div className="min-w-0">
              <p className="text-sm font-medium truncate">{user?.email ?? "Signed in"}</p>
              <p className="text-xs text-muted-foreground">Personal workspace</p>
            </div>
          </div>

          <Button
            variant="secondary"
            className="w-full justify-start"
            onClick={async () => {
              await signOut();
            }}
          >
            <LogOut className="w-4 h-4 mr-2" />
            Log out
          </Button>
        </div>
      </div>
    </aside>
  );
}
