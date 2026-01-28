import {
  LayoutDashboard,
  BookOpen,
  CalendarDays,
  Link2,
  Bot,
  BarChart3,
  Settings,
  TrendingUp,
  LogOut,
  User as UserIcon,
  CandlestickChart, // ✅ NEW
} from "lucide-react";
import { NavLink, useLocation } from "react-router-dom";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/auth/AuthProvider";

const navItems = [
  { icon: LayoutDashboard, label: "Dashboard", path: "/" },
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
          <div className="w-10 h-10 rounded-xl bg-primary/20 flex items-center justify-center glow-effect">
            <TrendingUp className="w-5 h-5 text-primary" />
          </div>
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
