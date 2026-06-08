import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { ArrowLeft, User, Mail, GraduationCap, Coins, Crown, BookOpen, ShoppingBag, History, LifeBuoy, Activity } from "lucide-react";

export const Route = createFileRoute("/_admin/admin/users/$userId")({ component: UserDetail });

function UserDetail() {
  const { userId } = Route.useParams();
  const [profile, setProfile] = useState<any>(null);
  const [attempts, setAttempts] = useState<any[]>([]);
  const [purchases, setPurchases] = useState<any[]>([]);
  const [wallet, setWallet] = useState<any[]>([]);
  const [memberships, setMemberships] = useState<any[]>([]);
  const [tickets, setTickets] = useState<any[]>([]);

  useEffect(() => {
    (async () => {
      const [{ data: p }, { data: a }, { data: pur }, { data: w }, { data: m }, { data: tk }] = await Promise.all([
        supabase.from("profiles").select("*").eq("id", userId).maybeSingle(),
        supabase.from("test_attempts").select("id,score,total,status,submitted_at,tests(title)").eq("user_id", userId).order("started_at", { ascending: false }).limit(20),
        supabase.from("purchases").select("id,created_at,tests(title),courses(title)").eq("user_id", userId).order("created_at", { ascending: false }),
        supabase.from("wallet_transactions").select("*").eq("user_id", userId).order("created_at", { ascending: false }).limit(20),
        supabase.from("memberships").select("*, subscriptions(name)").eq("user_id", userId).order("created_at", { ascending: false }),
        supabase.from("support_tickets" as any).select("*").eq("user_id", userId).order("updated_at", { ascending: false }),
      ]);
      setProfile(p);
      setAttempts(a ?? []);
      setPurchases(pur ?? []);
      setWallet(w ?? []);
      setMemberships(m ?? []);
      setTickets((tk as any[]) ?? []);
    })();
  }, [userId]);

  if (!profile) return <div className="grid h-64 place-items-center text-sm text-muted-foreground animate-pulse">Loading profile…</div>;

  const isPremium = profile.membership_status === "premium" && profile.subscription_expiry && new Date(profile.subscription_expiry) > new Date();

  return (
    <div className="mx-auto max-w-6xl pb-10">
      <Link to="/admin/users" className="inline-flex items-center gap-2 text-sm font-bold text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> All users
      </Link>

      <div className="mt-4 rounded-3xl border border-border bg-card p-6 shadow-soft">
        <div className="flex flex-wrap items-start gap-6">
          <div className="grid h-16 w-16 place-items-center rounded-2xl bg-primary/10 text-primary text-xl font-bold">
            {profile.full_name?.[0] || "U"}
          </div>
          <div className="flex-1">
            <h1 className="font-display text-2xl font-bold">{profile.full_name || "Unnamed user"}</h1>
            <div className="mt-2 grid gap-1 text-sm text-muted-foreground sm:grid-cols-2">
              <span className="flex items-center gap-2"><Mail className="h-3.5 w-3.5" /> {profile.email || "—"}</span>
              <span className="flex items-center gap-2"><GraduationCap className="h-3.5 w-3.5" /> {profile.college || "—"}</span>
              <span className="flex items-center gap-2"><User className="h-3.5 w-3.5" /> Joined {new Date(profile.created_at).toLocaleDateString()}</span>
              <span className="flex items-center gap-2"><Coins className="h-3.5 w-3.5" /> {profile.tokens} tokens</span>
            </div>
          </div>
          <div className="flex flex-col items-end gap-2">
            <span className={`rounded-full px-3 py-1 text-[10px] font-bold uppercase ${profile.blocked ? "bg-destructive/10 text-destructive" : "bg-success/10 text-success"}`}>{profile.blocked ? "Blocked" : "Active"}</span>
            <span className={`rounded-full px-3 py-1 text-[10px] font-bold uppercase ${isPremium ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`}>
              <Crown className="mr-1 inline h-3 w-3" />{isPremium ? `Premium · ${new Date(profile.subscription_expiry).toLocaleDateString()}` : "Free"}
            </span>
          </div>
        </div>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <Section icon={BookOpen} title="Test attempts" count={attempts.length}>
          {attempts.map((a) => (
            <Row key={a.id} title={a.tests?.title || "Test"} subtitle={a.status} right={a.total ? `${a.score}/${a.total}` : "—"} date={a.submitted_at} />
          ))}
        </Section>
        <Section icon={ShoppingBag} title="Purchases" count={purchases.length}>
          {purchases.map((p) => (
            <Row key={p.id} title={p.tests?.title || p.courses?.title || "Item"} subtitle={p.tests ? "Test" : "Course"} date={p.created_at} />
          ))}
        </Section>
        <Section icon={Coins} title="Token history" count={wallet.length}>
          {wallet.map((w) => (
            <Row key={w.id} title={w.description || w.type} subtitle={w.type} right={`${w.amount > 0 ? "+" : ""}${w.amount}`} date={w.created_at} />
          ))}
        </Section>
        <Section icon={Crown} title="Subscription history" count={memberships.length}>
          {memberships.map((m) => (
            <Row key={m.id} title={m.subscriptions?.name || m.plan} subtitle={m.status} right={m.valid_until ? `until ${new Date(m.valid_until).toLocaleDateString()}` : ""} date={m.created_at} />
          ))}
        </Section>
        <Section icon={LifeBuoy} title="Support tickets" count={tickets.length}>
          {tickets.map((t) => (
            <Row key={t.id} title={`${t.ticket_number} · ${t.subject || t.subcategory}`} subtitle={`${t.category} · ${t.status}`} date={t.updated_at} />
          ))}
        </Section>
        <Section icon={Activity} title="Activity" count={attempts.length + purchases.length + wallet.length}>
          <p className="px-4 py-3 text-xs text-muted-foreground italic">Combined event log derived from attempts, purchases, and token movements above.</p>
        </Section>
      </div>
    </div>
  );
}

function Section({ icon: Icon, title, count, children }: { icon: any; title: string; count: number; children: any }) {
  return (
    <div className="rounded-3xl border border-border bg-card shadow-soft">
      <div className="flex items-center justify-between border-b border-border p-4">
        <div className="flex items-center gap-2"><Icon className="h-4 w-4 text-primary" /><h3 className="font-bold">{title}</h3></div>
        <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">{count}</span>
      </div>
      <div className="max-h-72 divide-y divide-border overflow-y-auto">
        {count === 0 ? <p className="px-4 py-8 text-center text-xs text-muted-foreground italic">No records.</p> : children}
      </div>
    </div>
  );
}

function Row({ title, subtitle, right, date }: { title: string; subtitle?: string; right?: string; date?: string }) {
  return (
    <div className="flex items-center justify-between gap-3 px-4 py-3">
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-bold">{title}</p>
        {subtitle && <p className="truncate text-[10px] uppercase tracking-wider text-muted-foreground">{subtitle}</p>}
      </div>
      <div className="text-right">
        {right && <p className="text-sm font-mono font-bold text-primary">{right}</p>}
        {date && <p className="text-[10px] text-muted-foreground">{new Date(date).toLocaleDateString()}</p>}
      </div>
    </div>
  );
}
