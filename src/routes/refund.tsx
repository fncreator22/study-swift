import { createFileRoute, Link } from "@tanstack/react-router";
import { GraduationCap, ArrowLeft, Coins } from "lucide-react";

export const Route = createFileRoute("/refund")({ component: RefundPage });

function RefundPage() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Header */}
      <header className="border-b border-border bg-card/80 backdrop-blur sticky top-0 z-50">
        <div className="container mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2 font-display text-lg font-bold">
            <span className="grid h-8 w-8 place-items-center rounded-lg bg-primary text-primary-foreground font-black">
              <GraduationCap className="h-4 w-4" />
            </span>
            Examly
          </Link>
          <Link to="/">
            <button className="inline-flex items-center gap-2 text-sm font-semibold text-muted-foreground hover:text-foreground transition-colors cursor-pointer">
              <ArrowLeft className="h-4 w-4" /> Back to Home
            </button>
          </Link>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 sm:px-6 py-12 max-w-4xl animate-in fade-in duration-500">
        <div className="flex items-center gap-3 mb-6">
          <div className="grid h-10 w-10 place-items-center rounded-xl bg-primary/10 text-primary">
            <Coins className="h-5 w-5" />
          </div>
          <div>
            <h1 className="font-display text-3xl font-black tracking-tight sm:text-4xl">Refund & Cancellation</h1>
            <p className="text-xs text-muted-foreground mt-1">Last updated: July 10, 2026</p>
          </div>
        </div>

        <div className="rounded-3xl border border-border bg-card p-6 sm:p-10 shadow-soft space-y-8 text-sm sm:text-base leading-relaxed text-muted-foreground">
          <section className="space-y-3">
            <h2 className="font-display text-xl font-bold text-foreground">1. Token Purchase Refunds</h2>
            <p>
              Tokens are digital assets used to unlock individual mock exams and video courses on Examly. Because tokens are credited immediately to your balance once administrators verify your manual payment proof screenshot, <strong>all token purchases are strictly non-refundable</strong>.
            </p>
            <p>
              Please double-check your required token amounts before completing UPI payments and uploading screenshots.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="font-display text-xl font-bold text-foreground">2. Subscription Cancelations</h2>
            <p>
              If you purchase a Premium Subscription Plan using tokens from your wallet, you gain instant access to all included courses and tests for the specified duration (e.g. 30 days). 
            </p>
            <ul className="list-disc pl-5 space-y-1">
              <li>Subscriptions do not auto-renew or charge cards automatically, as they are fully pre-paid using wallet tokens.</li>
              <li>You may request to terminate your subscription early, but no refunds or token credit pro-rations will be granted.</li>
            </ul>
          </section>

          <section className="space-y-3">
            <h2 className="font-display text-xl font-bold text-foreground">3. Processing Discrepancies & Disputed Requests</h2>
            <p>
              If you submit a payment verification request and complete the UPI transfer but your tokens are not credited within 24 hours:
            </p>
            <ul className="list-disc pl-5 space-y-1">
              <li>Do not open multiple duplicate requests as this slows down the verification queue.</li>
              <li>Contact our team at <a href="mailto:support@examly.app" className="text-primary hover:underline font-semibold">support@examly.app</a> or open a ticket through the <Link to="/support" className="text-primary hover:underline font-semibold">Help & Support</Link> portal.</li>
              <li>Provide your username, email address, transaction reference ID, and date of payment.</li>
            </ul>
            <p>
              If we verify that a payment went through but was rejected or missed, we will manually credit the appropriate tokens to your wallet.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="font-display text-xl font-bold text-foreground">4. Fraudulent Behavior</h2>
            <p>
              Any attempt to chargeback verified payments or submit manipulated payment screenshot images to trick administrators will lead to immediate and permanent account blockage, forfeiture of all wallet token balances, and permanent exclusion from the platform.
            </p>
          </section>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-border/40 py-8 bg-muted/20 text-center text-xs text-muted-foreground">
        <div className="container mx-auto px-4 sm:px-6">
          <p>© {new Date().getFullYear()} Examly. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
}
