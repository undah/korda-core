import { MainLayout } from "@/components/layout/MainLayout";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { User, Bell, Shield, Palette, Database, CreditCard } from "lucide-react";

export default function Settings() {
  return (
    <MainLayout>
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">Settings</h1>
        <p className="text-muted-foreground">Manage your account and preferences</p>
      </div>

      <div className="max-w-2xl space-y-6">
        {/* Profile */}
        <div className="glass-card p-6 animate-fade-in">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
              <User className="w-5 h-5 text-primary" />
            </div>
            <div>
              <h3 className="font-semibold">Profile</h3>
              <p className="text-sm text-muted-foreground">Your personal information</p>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium mb-2 block">Display Name</label>
              <input
                type="text"
                defaultValue="Trader"
                className="w-full px-4 py-2 bg-muted border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
              />
            </div>
            <div>
              <label className="text-sm font-medium mb-2 block">Email</label>
              <input
                type="email"
                defaultValue="trader@example.com"
                className="w-full px-4 py-2 bg-muted border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
              />
            </div>
          </div>
        </div>

        {/* Notifications */}
        <div className="glass-card p-6 animate-fade-in">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
              <Bell className="w-5 h-5 text-primary" />
            </div>
            <div>
              <h3 className="font-semibold">Notifications</h3>
              <p className="text-sm text-muted-foreground">Configure alerts and notifications</p>
            </div>
          </div>
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium">Trade Sync Alerts</p>
                <p className="text-sm text-muted-foreground">Get notified when new trades are imported</p>
              </div>
              <Switch defaultChecked />
            </div>
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium">AI Coach Insights</p>
                <p className="text-sm text-muted-foreground">Daily coaching tips based on your trades</p>
              </div>
              <Switch defaultChecked />
            </div>
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium">Weekly Reports</p>
                <p className="text-sm text-muted-foreground">Receive weekly performance summaries</p>
              </div>
              <Switch />
            </div>
          </div>
        </div>

        {/* Data & Privacy */}
        <div className="glass-card p-6 animate-fade-in">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
              <Shield className="w-5 h-5 text-primary" />
            </div>
            <div>
              <h3 className="font-semibold">Data & Privacy</h3>
              <p className="text-sm text-muted-foreground">Manage your data and privacy settings</p>
            </div>
          </div>
          <div className="space-y-4">
            <Button variant="outline" className="w-full justify-start">
              <Database className="w-4 h-4" />
              Export All Data
            </Button>
            <Button variant="outline" className="w-full justify-start text-destructive hover:text-destructive">
              Delete Account
            </Button>
          </div>
        </div>

        {/* Subscription */}
        <div className="glass-card p-6 animate-fade-in gradient-border overflow-hidden relative">
          <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-transparent pointer-events-none" />
          <div className="relative">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                <CreditCard className="w-5 h-5 text-primary" />
              </div>
              <div>
                <h3 className="font-semibold">Subscription</h3>
                <p className="text-sm text-muted-foreground">Manage your plan</p>
              </div>
            </div>
            <div className="bg-muted/50 rounded-lg p-4 mb-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-semibold text-primary">Pro Plan</p>
                  <p className="text-sm text-muted-foreground">Unlimited trades • AI Coach • All integrations</p>
                </div>
                <p className="text-2xl font-bold">$29<span className="text-sm font-normal text-muted-foreground">/mo</span></p>
              </div>
            </div>
            <Button variant="glow" className="w-full">
              Upgrade to Pro
            </Button>
          </div>
        </div>

        <div className="flex justify-end gap-4 pt-4">
          <Button variant="outline">Cancel</Button>
          <Button variant="glow">Save Changes</Button>
        </div>
      </div>
    </MainLayout>
  );
}
