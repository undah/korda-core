import { useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { supabase } from "@/lib/supabaseClient";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "@/components/ui/use-toast";

type LocationState = { from?: string };

export default function Login() {
  const navigate = useNavigate();
  const location = useLocation();
  const from = (location.state as LocationState | null)?.from || "/dashboard";

  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const title = useMemo(() => (mode === "signin" ? "Sign in" : "Create account"), [mode]);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      if (mode === "signin") {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        navigate(from, { replace: true });
      } else {
        const { error } = await supabase.auth.signUp({ email, password });
        if (error) throw error;

        // Depending on your Supabase email confirmation settings, the user might need to confirm first.
        toast({
          title: "Account created",
          description: "If email confirmations are enabled, check your inbox to confirm your account.",
        });
        navigate(from, { replace: true });
      }
    } catch (err: any) {
      toast({
        title: "Auth error",
        description: err?.message ?? "Something went wrong",
        variant: "destructive",
      });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-background">
  <Card className="w-full max-w-md">
    <CardHeader>
      <div className="mb-2">
        <button
          onClick={() => navigate("/trading")}
          className="text-xs text-muted-foreground hover:text-foreground transition flex items-center gap-1"
        >
          ← Back to dashboard
        </button>
      </div>
          <CardTitle>{title}</CardTitle>
          <CardDescription>
            {mode === "signin"
              ? "Log in to access your trading journal."
              : "Create an account to start tracking your trades."}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                autoComplete={mode === "signin" ? "current-password" : "new-password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                required
                minLength={8}
              />
              <p className="text-xs text-muted-foreground">Use at least 8 characters.</p>
            </div>

            <Button type="submit" className="w-full" disabled={busy}>
              {busy ? "Please wait…" : mode === "signin" ? "Sign in" : "Create account"}
            </Button>

            <div className="text-sm text-muted-foreground text-center">
              {mode === "signin" ? (
                <>
                  No account yet?{" "}
                  <button
                    type="button"
                    className="underline underline-offset-4 hover:text-foreground"
                    onClick={() => setMode("signup")}
                  >
                    Create one
                  </button>
                </>
              ) : (
                <>
                  Already have an account?{" "}
                  <button
                    type="button"
                    className="underline underline-offset-4 hover:text-foreground"
                    onClick={() => setMode("signin")}
                  >
                    Sign in
                  </button>
                </>
              )}
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
