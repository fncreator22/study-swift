import { useState, useRef } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { toast } from "sonner";
import { Info, Upload, QrCode } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

interface TokenRequestModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  requiredTokens?: number;
}

export function TokenRequestModal({ open, onOpenChange, requiredTokens = 0 }: TokenRequestModalProps) {
  const { user } = useAuth();
  const [amount, setAmount] = useState(requiredTokens > 0 ? requiredTokens.toString() : "50");
  const [message, setMessage] = useState("");
  const [screenshot, setScreenshot] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const submittingRef = useRef(false);

  const inrValue = parseInt(amount || "0") * 10;

  async function handleSubmit() {
    if (submittingRef.current) return;
    if (!user) return;
    if (!amount || parseInt(amount) <= 0) return toast.error("Please enter a valid amount");
    if (!screenshot) return toast.error("Please upload a payment screenshot");

    submittingRef.current = true;
    setSubmitting(true);
    try {
      // 1. Upload screenshot
      const fileExt = screenshot.name.split('.').pop();
      const filePath = `${user.id}/${Math.random()}.${fileExt}`;
      const { error: uploadError } = await supabase.storage
        .from('payments')
        .upload(filePath, screenshot);

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage.from('payments').getPublicUrl(filePath);

      // 2. Create request
      const { error: requestError } = await supabase.from('token_requests').insert({
        user_id: user.id,
        amount: parseInt(amount),
        screenshot_url: publicUrl,
        message: message.trim(),
        status: 'pending'
      });

      if (requestError) throw requestError;

      toast.success("Request submitted successfully. Admin will verify it soon.");
      onOpenChange(false);
    } catch (error: any) {
      toast.error(error.message || "Failed to submit request");
    } finally {
      submittingRef.current = false;
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            Purchase Tokens
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Info className="h-4 w-4 text-muted-foreground cursor-help" />
                </TooltipTrigger>
                <TooltipContent>
                  <p>1 Token = ₹10</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </DialogTitle>
          <DialogDescription>
            Complete payment via UPI/QR and upload the screenshot below.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-4">
          <div className="rounded-xl bg-primary/5 p-4 border border-primary/10">
            <h4 className="text-sm font-semibold mb-2 flex items-center gap-2">
              <QrCode className="h-4 w-4" /> Payment Info
            </h4>
            <div className="space-y-1 text-xs text-muted-foreground">
              <p>UPI ID: <span className="font-mono font-medium text-foreground">sagarm2201@okaxis</span></p>
              <p>Name: <span className="font-medium text-foreground">Sagar M</span></p>
              <p className="mt-2 italic">Instructions: Complete payment using UPI or QR code, then upload the payment screenshot and submit the request for admin verification.</p>
            </div>
          </div>

          <div className="grid gap-2">
            <Label htmlFor="tokens">Token Amount</Label>
            <div className="relative">
              <Input
                id="tokens"
                type="number"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="e.g. 50"
                disabled={submitting}
              />
              <div className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-medium text-muted-foreground">
                ≈ ₹{inrValue}
              </div>
            </div>
          </div>

          <div className="grid gap-2">
            <Label htmlFor="message">Message (Optional)</Label>
            <Textarea
              id="message"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Any details about your payment..."
              className="resize-none"
              rows={2}
              disabled={submitting}
            />
          </div>

          <div className="grid gap-2">
            <Label>Payment Screenshot</Label>
            <div className="flex items-center gap-4">
              <Input
                type="file"
                accept="image/*"
                onChange={(e) => setScreenshot(e.target.files?.[0] || null)}
                className="cursor-pointer"
                disabled={submitting}
              />
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={submitting}>Cancel</Button>
          <Button onClick={handleSubmit} disabled={submitting}>
            {submitting ? "Submitting..." : "Submit Request"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
