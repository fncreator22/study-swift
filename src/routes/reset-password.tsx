import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth";
import { GraduationCap, KeyRound, AlertTriangle } from "lucide-react";

export const Route = createFileRoute("/reset-password")({ component: ResetPassword });

function ResetPassword() {
  const nav = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [sessionCheckComplete, setSessionCheckComplete] = useState(false);

  useEffect(() => {
    if (!authLoading) {
      setSessionCheckComplete(true);
    }
  }, [authLoading]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (password.length < 6) return toast.error("Password must be at least 6 characters");
    if (password !== confirmPassword) return toast.error("Passwords do not match");
    
    setLoading(true);
    const { error } = await supabase.auth.updateUser({ password });
    setLoading(false);
    
    if (error) return toast.error(error.message);
    
    toast.success("Password reset successfully. Please sign in.");
    // Force sign out to ensure clean session state
    await supabase.auth.signOut();
    nav({ to: "/login" });
  }

  if (!sessionCheckComplete) {
    return (
      <div className="grid min-h-screen place-items-center bg-background">
        <p className="text-sm text-muted-foreground animate-pulse">Verifying recovery session...</p>
      </div>
    );
  }

  // If check is complete but user is null, the recovery session is missing or expired
  if (!user) {
    return (
      <div className="grid min-h-screen place-items-center bg-background px-4 py-10 animate-in fade-in duration-500">
        <div className="w-full max-w-sm">
          <Link to="/" className="mb-8 flex items-center justify-center gap-2 font-display text-lg font-bold">
            <span className="grid h-8 w-8 place-items-center rounded-lg bg-primary text-primary-foreground font-black">
              <GraduationCap className="h-4 w-4" />
            </span>
            Examly
          </Link>
          <div className="rounded-2xl border border-destructive/20 bg-destructive/5 p-8 shadow-card text-center space-y-4">
            <div className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-destructive/10 text-destructive">
              <AlertTriangle className="h-6 w-6" />
            </div>
            <h1 className="font-display text-xl font-bold text-foreground">Session Invalid or Expired</h1>
            <p className="text-sm text-muted-foreground leading-relaxed">
              Your password recovery session has expired or is invalid. Please request a new password reset link.
            </p>
            <div className="pt-2">
              <Link to="/forgot-password" className="w-full">
                <Button className="w-full rounded-xl">Request New Link</Button>
              </Link>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="grid min-h-screen place-items-center bg-background px-4 py-10 animate-in fade-in duration-500">
      <div className="w-full max-w-sm">
        <Link to="/" className="mb-8 flex items-center justify-center gap-2 font-display text-lg font-bold">
          <span className="grid h-8 w-8 place-items-center rounded-lg bg-primary text-primary-foreground font-black">
            <GraduationCap className="h-4 w-4" />
          </span>
          Examly
        </Link>
        <div className="rounded-2xl border border-border bg-card p-8 shadow-card">
          <div className="flex items-center gap-2.5 mb-4">
            <div className="grid h-8 w-8 place-items-center rounded-lg bg-primary/10 text-primary">
              <KeyRound className="h-4 w-4" />
            </div>
            <h1 className="font-display text-2xl font-bold">Set new password</h1>
          </div>
          <p className="text-sm text-muted-foreground">Type and confirm your new secure password below.</p>
          
          <form onSubmit={onSubmit} className="mt-6 space-y-4">
            <div className="space-y-2">
              <Label htmlFor="password">New Password</Label>
              <Input 
                id="password"
                type="password" 
                required 
                minLength={6}
                value={password} 
                onChange={(e) => setPassword(e.target.value)} 
                placeholder="6+ characters"
                disabled={loading}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirm-password">Confirm Password</Label>
              <Input 
                id="confirm-password"
                type="password" 
                required 
                minLength={6}
                value={confirmPassword} 
                onChange={(e) => setConfirmPassword(e.target.value)} 
                placeholder="Repeat new password"
                disabled={loading}
              />
            </div>
            <Button type="submit" className="w-full rounded-xl h-11" disabled={loading}>
              {loading ? "Updating password..." : "Reset Password"}
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
}
