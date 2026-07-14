import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

type AuthCtx = {
  user: User | null;
  session: Session | null;
  loading: boolean;
  isAdmin: boolean;
  isBlocked: boolean;
  tokens: number;
  profileVersion: number;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
};

const Ctx = createContext<AuthCtx>({
  user: null, session: null, loading: true, isAdmin: false, isBlocked: false, tokens: 0, profileVersion: 0,
  signOut: async () => {}, refreshProfile: async () => {},
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [isBlocked, setIsBlocked] = useState(false);
  const [tokens, setTokens] = useState(0);
  const [profileVersion, setProfileVersion] = useState(0);

  async function fetchProfile(uid: string) {
    supabase.rpc("claim_anonymous_reports").then(() => {});
    const { data: prof } = await supabase.from("profiles").select("tokens, blocked").eq("id", uid).maybeSingle();
    if (prof) {
      setTokens(prof.tokens);
      setIsBlocked(prof.blocked);
    }

    const { data: role } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", uid)
      .eq("role", "admin")
      .maybeSingle();
    setIsAdmin(!!role);
  }

  useEffect(() => {
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => {
      setSession(s);
      if (s?.user) {
        fetchProfile(s.user.id);
      } else {
        setIsAdmin(false);
        setIsBlocked(false);
        setTokens(0);
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

  useEffect(() => {
    if (session?.user) {
      supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", session.user.id)
        .eq("role", "admin")
        .maybeSingle()
        .then(({ data }) => setIsAdmin(!!data));
    } else {
      setIsAdmin(false);
    }
  }, [session]);

  return (
    <Ctx.Provider
      value={{
        user: session?.user ?? null,
        session,
        loading,
        isAdmin,
        isBlocked,
        tokens,
        profileVersion,
        signOut: async () => { await supabase.auth.signOut(); },
        refreshProfile: async () => { 
          if (session?.user) {
            await fetchProfile(session.user.id);
            setProfileVersion((v) => v + 1);
          }
        },
      }}
    >
      {children}
    </Ctx.Provider>
  );
}

export const useAuth = () => useContext(Ctx);
