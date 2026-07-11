import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Coins, Check, Crown, Sparkles, Clock, Upload, GraduationCap, ArrowRight } from "lucide-react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/welcome-subscription")({ component: WelcomeSubscriptionPage });

type Plan = {
  id: string;
  name: string;
  description: string;
  token_price: number;
  price_inr?: number;
  duration_days: number;
  test_ids: string[];
  course_ids: string[];
  is_active: boolean;
};

function WelcomeSubscriptionPage() {
  const { user, tokens, refreshProfile } = useAuth();
  const nav = useNavigate();
  const [plans, setPlans] = useState<Plan[]>([]);
  const [tokenPrice, setTokenPrice] = useState(10);
  const [loading, setLoading] = useState(true);
  const [buying, setBuying] = useState<string | null>(null);
  const buyingRef = useRef<string | null>(null);

  // States for uploading payment receipt
  const [uploadingPlan, setUploadingPlan] = useState<Plan | null>(null);
  const [receiptFile, setReceiptFile] = useState<File | null>(null);
  const [submittingReq, setSubmittingReq] = useState(false);

  async function load() {
    setLoading(true);
    const [{ data: ps }, { data: setting }] = await Promise.all([
      supabase.from("subscriptions" as any).select("*").eq("is_active", true).order("token_price"),
      supabase.from("settings" as any).select("value").eq("key", "token_price").maybeSingle(),
    ]);
    setPlans((ps as any) ?? []);
    const v = (setting as any)?.value;
    if (v && typeof v.inr === "number") setTokenPrice(v.inr);
    setLoading(false);
  }

  useEffect(() => {
    if (user) load();
  }, [user]);

  async function buy(planId: string) {
    if (buyingRef.current) return;
    buyingRef.current = planId;
    setBuying(planId);
    
    const { data, error } = await supabase.rpc("purchase_subscription" as any, { _subscription_id: planId });
    
    buyingRef.current = null;
    setBuying(null);
    
    if (error) return toast.error(error.message);
    toast.success("Subscription activated!");
    await refreshProfile();
    nav({ to: "/dashboard" });
  }

  async function handlePaidUpgradeSubmit() {
    if (!uploadingPlan || !receiptFile || submittingReq) return;
    setSubmittingReq(true);
    try {
      const fileExt = receiptFile.name.split('.').pop();
      const fileName = `${user.id}-${Date.now()}.${fileExt}`;
      const filePath = `${fileName}`;
      
      const { error: uploadError } = await supabase.storage.from('receipts').upload(filePath, receiptFile);
      if (uploadError) throw uploadError;
      
      const { data: { publicUrl } } = supabase.storage.from('receipts').getPublicUrl(filePath);

      // Insert subscription request
      const { error: reqError } = await supabase.from("subscription_requests").insert({
        user_id: user.id,
        subscription_id: uploadingPlan.id,
        receipt_url: publicUrl,
        status: "pending"
      });
      if (reqError) throw reqError;

      // Automatically activate Free basic plan in the background
      const freePlan = plans.find(p => p.price_inr === 0 || p.token_price === 0);
      if (freePlan) {
        await supabase.rpc("purchase_subscription" as any, { _subscription_id: freePlan.id });
      }

      toast.success("Upgrade request submitted! Basic access activated.");
      setUploadingPlan(null);
      setReceiptFile(null);
      await refreshProfile();
      nav({ to: "/dashboard" });
    } catch (err: any) {
      toast.error(err.message || "Failed to submit request");
    } finally {
      setSubmittingReq(false);
    }
  }

  if (loading) return <div className="grid min-h-screen place-items-center text-sm text-muted-foreground bg-background">Loading subscription plans…</div>;

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col justify-between py-10 px-4">
      <div className="mx-auto max-w-5xl w-full space-y-10">
        
        {/* Logo and Header section */}
        <div className="text-center space-y-4">
          <div className="flex items-center justify-center gap-2 font-display text-2xl font-bold">
            <span className="grid h-10 w-10 place-items-center rounded-xl bg-primary text-primary-foreground">
              <GraduationCap className="h-5 w-5" />
            </span>
            <span>Examly</span>
          </div>
          <div className="space-y-2">
            <h1 className="font-display text-2xl sm:text-3xl font-extrabold tracking-tight">Choose Your Subscription Plan</h1>
            <p className="text-sm text-muted-foreground max-w-md mx-auto">Select a subscription option to activate your access and proceed to the dashboard.</p>
          </div>
        </div>

        {/* Plans Grid */}
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {plans.map((p) => {
            const isPlanFree = (p.price_inr ?? 0) === 0 || p.token_price === 0;

            return (
              <Card key={p.id} className="relative flex flex-col border border-border shadow-soft bg-card hover:border-primary/20 transition-all rounded-3xl p-2">
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle className="font-display text-xl font-bold">{p.name}</CardTitle>
                    {isPlanFree ? (
                      <Sparkles className="h-4 w-4 text-muted-foreground" />
                    ) : (
                      <Crown className="h-4 w-4 text-amber-500 animate-pulse" />
                    )}
                  </div>
                  {p.description ? (
                    <ul className="text-xs text-muted-foreground space-y-1 list-disc pl-4 mt-2">
                      {p.description.split(/•|\n/).map(x => x.trim()).filter(Boolean).map((pt, i) => (
                        <li key={i}>{pt}</li>
                      ))}
                    </ul>
                  ) : (
                    <CardDescription className="italic">Subscription bundle</CardDescription>
                  )}
                </CardHeader>
                <CardContent className="flex flex-1 flex-col gap-4">
                  <div className="flex items-baseline gap-1">
                    <span className="font-display text-3xl font-bold">₹{p.price_inr ?? p.token_price * tokenPrice}</span>
                    {p.token_price > 0 && (
                      <span className="text-xs text-muted-foreground">({p.token_price} tokens included)</span>
                    )}
                  </div>
                  <ul className="space-y-2 text-xs flex-1 border-t pt-3">
                    {isPlanFree ? (
                      <>
                        <li className="flex items-center gap-2"><Check className="h-4 w-4 text-success" /> Access all free tests</li>
                        <li className="flex items-center gap-2"><Check className="h-4 w-4 text-success" /> Access all free courses</li>
                        <li className="flex items-center gap-2"><Check className="h-4 w-4 text-success" /> Pay-as-you-go for premium</li>
                      </>
                    ) : (
                      <>
                        <li className="flex items-center gap-2"><Check className="h-4 w-4 text-success" /> {p.duration_days} days access</li>
                        <li className="flex items-center gap-2"><Check className="h-4 w-4 text-success" /> {p.test_ids?.length ?? 0} tests included</li>
                        <li className="flex items-center gap-2"><Check className="h-4 w-4 text-success" /> {p.course_ids?.length ?? 0} courses included</li>
                      </>
                    )}
                  </ul>
                  <Button
                    disabled={buying === p.id}
                    onClick={() => {
                      if (isPlanFree) {
                        buy(p.id);
                      } else {
                        setUploadingPlan(p);
                      }
                    }}
                    className="w-full rounded-xl mt-2 font-bold"
                    variant={isPlanFree ? "outline" : "default"}
                  >
                    {isPlanFree ? (
                      <Sparkles className="mr-2 h-4 w-4" />
                    ) : (
                      <Crown className="mr-2 h-4 w-4" />
                    )}
                    {buying === p.id 
                      ? "Processing…" 
                      : isPlanFree 
                        ? "Activate Free Basic" 
                        : "Upgrade (Submit Receipt)"}
                  </Button>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>

      {/* Footer link to skip directly to basic */}
      <div className="text-center mt-8 text-xs text-muted-foreground">
        Need help? Contact support or read terms of services.
      </div>

      <Dialog open={!!uploadingPlan} onOpenChange={(o) => { if(!o) { setUploadingPlan(null); setReceiptFile(null); } }}>
        <DialogContent className="sm:max-w-[450px] rounded-3xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 font-bold">
              <Crown className="h-5 w-5 text-amber-500" />
              <span>Upgrade to {uploadingPlan?.name}</span>
            </DialogTitle>
            <DialogDescription>
              Submit your payment receipt to request subscription upgrade approval.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-4 text-sm">
            <div className="rounded-2xl border p-4 bg-muted/30 space-y-2">
              <p className="font-semibold text-xs uppercase tracking-wider text-muted-foreground">Admin Payment Details</p>
              <p className="text-xs text-foreground font-medium">Please transfer <strong className="text-primary font-bold text-sm">₹{uploadingPlan?.price_inr}</strong> using UPI or Bank details:</p>
              <div className="bg-card p-3 rounded-xl border border-border/50 font-mono text-[11px] text-muted-foreground space-y-1">
                <div><strong>UPI ID:</strong> examy@upi</div>
                <div><strong>Bank:</strong> HDFC Bank</div>
                <div><strong>A/c Number:</strong> 50200012345678</div>
                <div><strong>IFSC Code:</strong> HDFC0000123</div>
              </div>
            </div>

            <div className="space-y-2">
              <Label className="font-semibold text-xs text-muted-foreground uppercase tracking-wider">Upload Receipt / Screenshot</Label>
              <div className="flex items-center justify-center border border-dashed border-border rounded-xl p-4 bg-muted/10">
                {receiptFile ? (
                  <div className="text-center space-y-2 w-full">
                    <p className="text-xs font-semibold text-primary truncate max-w-[300px] mx-auto">✓ {receiptFile.name}</p>
                    <Button variant="ghost" size="xs" onClick={() => setReceiptFile(null)} className="text-[10px] text-destructive hover:bg-destructive/10">Remove file</Button>
                  </div>
                ) : (
                  <label className="flex flex-col items-center justify-center gap-2 cursor-pointer w-full text-center py-2">
                    <Upload className="h-5 w-5 text-muted-foreground animate-bounce" />
                    <span className="text-xs font-semibold text-muted-foreground">Select Receipt Image / PDF</span>
                    <input 
                      type="file" 
                      accept="image/*,application/pdf" 
                      onChange={(e) => setReceiptFile(e.target.files?.[0] || null)} 
                      className="hidden" 
                    />
                  </label>
                )}
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setUploadingPlan(null)} className="rounded-xl">Cancel</Button>
            <Button 
              disabled={!receiptFile || submittingReq} 
              onClick={handlePaidUpgradeSubmit} 
              className="rounded-xl bg-primary text-primary-foreground shadow-lg shadow-primary/10"
            >
              {submittingReq ? "Submitting..." : "Submit Receipt"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
