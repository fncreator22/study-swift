import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth";
import { GraduationCap, ArrowLeft, KeyRound } from "lucide-react";

export const Route = createFileRoute("/forgot-password")({ component: ForgotPassword });

function ForgotPassword() {
  const nav = useNavigate();
  const { user, isAdmin, loading: authLoading } = useAuth();
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  useEffect(() => {
    if (!authLoading && user) {
      if (isAdmin) {
        nav({ to: "/admin" });
      } else {
        nav({ to: "/dashboard" });
      }
    }
  }, [user, isAdmin, authLoading, nav]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim()) return toast.error("Email is required");
    setLoading(true);
    
    // redirectTo coordinates with auth callback to drop user on /reset-password
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: `${window.location.origin}/auth/callback?next=/reset-password`,
    });
    
    setLoading(false);
    if (error) return toast.error(error.message);
    
    setSubmitted(true);
    toast.success("Reset link sent to your email!");
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
            <h1 className="font-display text-2xl font-bold">Forgot password</h1>
          </div>
          
          {submitted ? (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground leading-relaxed">
                We've sent a password reset link to <strong className="text-foreground">{email}</strong>. Please check your inbox and click the link to reset your password.
              </p>
              <div className="border-t border-border/50 pt-4 flex flex-col gap-2">
                <Button variant="outline" onClick={() => setSubmitted(false)} className="w-full rounded-xl">
                  Try another email
                </Button>
                <Link to="/login" className="w-full">
                  <Button variant="ghost" className="w-full rounded-xl">
                    Back to Sign In
                  </Button>
                </Link>
              </div>
            </div>
          ) : (
            <>
              <p className="text-sm text-muted-foreground">Enter your email and we'll send you a link to reset your password.</p>
              <form onSubmit={onSubmit} className="mt-6 space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="email">Email Address</Label>
                  <Input 
                    id="email"
                    type="email" 
                    required 
                    value={email} 
                    onChange={(e) => setEmail(e.target.value)} 
                    placeholder="name@example.com"
                    disabled={loading}
                  />
                </div>
                <Button type="submit" className="w-full rounded-xl h-11" disabled={loading}>
                  {loading ? "Sending link..." : "Send Reset Link"}
                </Button>
              </form>
              <p className="mt-6 text-center text-sm text-muted-foreground">
                Remember your password? <Link to="/login" className="text-primary hover:underline font-semibold">Sign in</Link>
              </p>
            </>
          )}
          
          <div className="mt-6 text-center border-t border-border/50 pt-4">
            <Link to="/support" className="text-xs text-muted-foreground hover:text-primary hover:underline">
              Having issues? Contact Support
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
