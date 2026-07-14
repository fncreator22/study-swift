import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

export const Route = createFileRoute("/auth/callback")({ component: AuthCallback });

function AuthCallback() {
  const nav = useNavigate();
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [statusMsg, setStatusMsg] = useState("Establishing secure session...");
  const processingRef = useRef(false);

  useEffect(() => {
    if (processingRef.current) return;
    processingRef.current = true;

    const params = new URLSearchParams(window.location.search);
    const code = params.get("code");
    const next = params.get("next") || "/dashboard";

    if (!code) {
      // If there's no code, check if there's already a session loaded via implicit hash flow
      supabase.auth.getSession().then(({ data: { session } }) => {
        if (session) {
          nav({ to: next as any });
        } else {
          setErrorMsg("No authorization code or active session was detected in the redirect link.");
        }
      });
      return;
    }

    setStatusMsg("Exchanging authorization code...");
    
    supabase.auth.exchangeCodeForSession(code)
      .then(({ data, error }) => {
        if (error) {
          console.error("[AuthCallback] Exchange error:", error);
          setErrorMsg(error.message || "Failed to exchange authorization code.");
        } else if (data?.session) {
          setStatusMsg("Session established! Redirecting...");
          toast.success("Authenticated successfully");
          // Small timeout to allow state to settle
          setTimeout(() => {
            nav({ to: next as any });
          }, 600);
        } else {
          setErrorMsg("Failed to establish session after authorization exchange.");
        }
      })
      .catch((err: any) => {
        console.error("[AuthCallback] Unexpected error:", err);
        setErrorMsg(err.message || "An unexpected error occurred during auth verification.");
      });
  }, [nav]);

  return (
    <div className="grid min-h-screen place-items-center bg-background px-4 py-10 animate-in fade-in duration-500">
      <div className="w-full max-w-sm text-center">
        {errorMsg ? (
          <div className="rounded-2xl border border-destructive/20 bg-destructive/5 p-8 shadow-card space-y-4">
            <div className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-destructive/10 text-destructive">
              <AlertCircle className="h-6 w-6" />
            </div>
            <h1 className="font-display text-xl font-bold text-foreground">Authentication Error</h1>
            <p className="text-sm text-muted-foreground leading-relaxed">
              {errorMsg}
            </p>
            <div className="pt-2 flex flex-col gap-2">
              <Button onClick={() => nav({ to: "/login" })} className="w-full rounded-xl">
                Back to Sign In
              </Button>
              <Button variant="outline" onClick={() => nav({ to: "/" })} className="w-full rounded-xl">
                Go to Home
              </Button>
            </div>
            <div className="mt-4 text-center border-t border-border/20 pt-4">
              <Link to="/support" className="text-xs text-muted-foreground hover:text-primary hover:underline">
                Verification failing? Contact Support
              </Link>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <Loader2 className="mx-auto h-8 w-8 animate-spin text-primary" />
            <h2 className="font-display text-lg font-bold text-foreground">Verifying access...</h2>
            <p className="text-sm text-muted-foreground">{statusMsg}</p>
          </div>
        )}
      </div>
    </div>
  );
}
