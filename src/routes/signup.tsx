import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth";
import { GraduationCap } from "lucide-react";

export const Route = createFileRoute("/signup")({ component: Signup });

function Signup() {
  const nav = useNavigate();
  const { user, isAdmin, loading: authLoading } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [college, setCollege] = useState("");
  const [loading, setLoading] = useState(false);
  const [emailError, setEmailError] = useState("");

  useEffect(() => {
    if (!authLoading && user) {
      if (isAdmin) {
        nav({ to: "/admin" });
      } else {
        nav({ to: "/dashboard" });
      }
    }
  }, [user, isAdmin, authLoading, nav]);

  async function checkEmailExists(val: string) {
    if (!val || !val.includes("@") || !val.includes(".")) {
      setEmailError("");
      return;
    }
    try {
      const { data, error } = await supabase.rpc("check_email_exists", {
        _email: val.trim().toLowerCase()
      });
      if (data) {
        setEmailError("This email address is already registered. Please sign in or use Forgot Password.");
      } else {
        setEmailError("");
      }
    } catch {
      setEmailError("");
    }
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (emailError) {
      return toast.error("An account with this email address already exists. Please sign in or reset your password.");
    }
    setLoading(true);

    const { data: existing, error: checkError } = await supabase.rpc("check_email_exists", {
      _email: email.trim().toLowerCase()
    });

    if (checkError) {
      setLoading(false);
      return toast.error("Verification failed. Please try again.");
    }

    if (existing) {
      setLoading(false);
      setEmailError("This email address is already registered. Please sign in or use Forgot Password.");
      return toast.error("An account with this email address already exists. Please sign in or reset your password.");
    }

    const { error } = await supabase.auth.signUp({
      email, password,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback?next=/dashboard`,
        data: { full_name: name, college },
      },
    });
    setLoading(false);
    if (error) return toast.error(error.message);
    toast.success("Account created! Please check your email inbox to verify your address.");
  }

  return (
    <div className="grid min-h-screen place-items-center bg-background px-4 py-10">
      <div className="w-full max-w-sm">
        <Link to="/" className="mb-8 flex items-center justify-center gap-2 font-display text-lg font-bold">
          <span className="grid h-8 w-8 place-items-center rounded-lg bg-primary text-primary-foreground"><GraduationCap className="h-4 w-4" /></span>
          Examly
        </Link>
        <div className="rounded-2xl border border-border bg-card p-8 shadow-card">
          <h1 className="font-display text-2xl font-bold">Create your account</h1>
          <p className="mt-1 text-sm text-muted-foreground">Start practicing in minutes.</p>
          <form onSubmit={onSubmit} className="mt-6 space-y-4">
            <div><Label htmlFor="name">Full name</Label><Input id="name" required value={name} onChange={(e) => setName(e.target.value)} /></div>
            <div><Label htmlFor="college">College / University</Label><Input id="college" required value={college} onChange={(e) => setCollege(e.target.value)} /></div>
            <div>
              <Label htmlFor="email">Email</Label>
              <Input 
                id="email" 
                type="email" 
                required 
                value={email} 
                onChange={(e) => {
                  setEmail(e.target.value);
                  setEmailError("");
                }} 
                onBlur={(e) => checkEmailExists(e.target.value)}
              />
              {emailError && (
                <p className="text-xs text-destructive mt-1 font-semibold">{emailError}</p>
              )}
            </div>
            <div><Label htmlFor="password">Password</Label><Input id="password" type="password" required minLength={6} value={password} onChange={(e) => setPassword(e.target.value)} /></div>
            <Button type="submit" className="w-full" disabled={loading}>{loading ? "Creating..." : "Create account"}</Button>
          </form>
          <p className="mt-4 text-center text-sm text-muted-foreground">
            Have an account? <Link to="/login" className="text-primary hover:underline">Sign in</Link>
          </p>
          <div className="mt-4 text-center border-t border-border/50 pt-4">
            <Link to="/support" className="text-xs text-muted-foreground hover:text-primary hover:underline">
              Need technical help or registration assistance? Contact Support
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
