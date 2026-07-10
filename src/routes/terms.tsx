import { createFileRoute, Link } from "@tanstack/react-router";
import { GraduationCap, ArrowLeft, FileText } from "lucide-react";

export const Route = createFileRoute("/terms")({ component: TermsPage });

function TermsPage() {
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
            <FileText className="h-5 w-5" />
          </div>
          <div>
            <h1 className="font-display text-3xl font-black tracking-tight sm:text-4xl">Terms of Service</h1>
            <p className="text-xs text-muted-foreground mt-1">Last updated: July 10, 2026</p>
          </div>
        </div>

        <div className="rounded-3xl border border-border bg-card p-6 sm:p-10 shadow-soft space-y-8 text-sm sm:text-base leading-relaxed text-muted-foreground">
          <section className="space-y-3">
            <h2 className="font-display text-xl font-bold text-foreground">1. Agreement to Terms</h2>
            <p>
              By accessing or using Examly Enterprise ("the Platform"), you agree to be bound by these Terms of Service ("Terms") and all applicable laws and regulations. If you do not agree with any of these terms, you are prohibited from using or accessing this site.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="font-display text-xl font-bold text-foreground">2. User Accounts and Platform Access</h2>
            <p>To access certain features of the platform, such as mock exams, tracking history, or courses, you must create a registered account. You agree to:</p>
            <ul className="list-disc pl-5 space-y-1">
              <li>Provide accurate, current, and complete details during registration.</li>
              <li>Maintain the security and confidentiality of your login credentials.</li>
              <li>Take full responsibility for all activities occurring under your account.</li>
            </ul>
            <p>
              We reserve the right to suspend, terminate, or block accounts at our discretion if we suspect unauthorized usage, cheating, security breaches, or any violation of these Terms.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="font-display text-xl font-bold text-foreground">3. Tokens, Purchases, and Subscription Terms</h2>
            <p>
              Examly Enterprise operates on a token-based micro-transaction model. 1 Token equals ₹10 (subject to change). Tokens can be bought to unlock tests or courses individually. Premium subscription plans are also available for bulk access.
            </p>
            <p>
              All purchases are verified manually by administrators using the uploaded payment proof screenshot. Any attempts to manipulate or submit fake screenshots or fraudulent payment details will result in immediate and permanent account suspension and potential legal action.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="font-display text-xl font-bold text-foreground">4. Acceptable Platform Use & Conduct</h2>
            <p>You agree not to engage in any prohibited activities, including:</p>
            <ul className="list-disc pl-5 space-y-1">
              <li>Using scripting, scraping, bots, or automation tools to copy mock tests, questions, or video modules.</li>
              <li>Cheating during mock exam attempts or sharing solutions/materials with other users.</li>
              <li>Attempting to bypass Supabase security constraints, headers, or API tokens.</li>
              <li>Uploading malicious files, corrupted image screenshots, or spamming the support tickets workspace.</li>
              <li>Impersonating other students, instructors, or system administrators.</li>
            </ul>
          </section>

          <section className="space-y-3">
            <h2 className="font-display text-xl font-bold text-foreground">5. Intellectual Property</h2>
            <p>
              All mock test questions, answer options, explanations, video lessons, course files, code, design graphics, and trademarks on the Platform are owned by Examly Enterprise or licensed educators. Your purchase grants you a personal, non-transferable, revocable license for individual preparation purposes only.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="font-display text-xl font-bold text-foreground">6. Limitation of Liability</h2>
            <p>
              The Platform and all its materials are provided "as is" and "as available". We make no warranties, expressed or implied, regarding exam success rates, continuous server uptime, or complete correctness of all practice modules. In no event shall Examly Enterprise be liable for any damages arising out of the use or inability to use the platform.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="font-display text-xl font-bold text-foreground">7. Changes to Terms</h2>
            <p>
              We reserve the right, at our sole discretion, to modify or replace these Terms at any time. We will indicate the date of the latest update at the top of this page. Your continued use of the platform after updates constitutes acceptance of the revised Terms.
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
