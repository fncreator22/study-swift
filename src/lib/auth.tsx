import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

type AuthCtx = {
  user: User | null;
  session: Session | null;
  loading: boolean;
  isAdmin: boolean;
  tokens: number;
  blocked: boolean;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
};

const Ctx = createContext<AuthCtx>({
  user: null, session: null, loading: true, isAdmin: false, tokens: 0, blocked: false,
  signOut: async () => {}, refreshProfile: async () => {},
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [tokens, setTokens] = useState(0);
  const [blocked, setBlocked] = useState(false);

  async function fetchProfile(uid: string): Promise<boolean> {
    const { data: prof } = await supabase
      .from("profiles")
      .select("tokens, blocked")
      .eq("id", uid)
      .maybeSingle();
    if (prof) {
      setTokens(prof.tokens ?? 0);
      setBlocked(!!prof.blocked);
      if (prof.blocked) {
        toast.error("Your account has been blocked. Please contact support.");
        await supabase.auth.signOut();
        return false;
      }
    }
    const { data: role } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", uid)
      .eq("role", "admin")
      .maybeSingle();
    setIsAdmin(!!role);
    return true;
  }

  useEffect(() => {
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => {
      setSession(s);
      if (s?.user) {
        fetchProfile(s.user.id);
      } else {
        setIsAdmin(false);
        setTokens(0);
        setBlocked(false);
      }
    });

    supabase.auth.getSession().then(async ({ data }) => {
      setSession(data.session);
      if (data.session?.user) {
        await fetchProfile(data.session.user.id);
      }
      setLoading(false);
    });

    return () => sub.subscription.unsubscribe();
  }, []);

  return (
    <Ctx.Provider
      value={{
        user: blocked ? null : (session?.user ?? null),
        session: blocked ? null : session,
        loading,
        isAdmin,
        tokens,
        blocked,
        signOut: async () => { await supabase.auth.signOut(); },
        refreshProfile: async () => { if (session?.user) await fetchProfile(session.user.id); },
      }}
    >
      {children}
    </Ctx.Provider>
  );
}

export const useAuth = () => useContext(Ctx);
