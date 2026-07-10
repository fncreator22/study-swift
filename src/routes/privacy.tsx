import { createFileRoute, Link } from "@tanstack/react-router";
import { GraduationCap, ArrowLeft, Shield } from "lucide-react";

export const Route = createFileRoute("/privacy")({ component: PrivacyPage });

function PrivacyPage() {
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
            <Shield className="h-5 w-5" />
          </div>
          <div>
            <h1 className="font-display text-3xl font-black tracking-tight sm:text-4xl">Privacy Policy</h1>
            <p className="text-xs text-muted-foreground mt-1">Last updated: July 10, 2026</p>
          </div>
        </div>

        <div className="rounded-3xl border border-border bg-card p-6 sm:p-10 shadow-soft space-y-8 text-sm sm:text-base leading-relaxed text-muted-foreground">
          <section className="space-y-3">
            <h2 className="font-display text-xl font-bold text-foreground">1. Introduction</h2>
            <p>
              Welcome to Examly Enterprise ("we," "our," or "us"). We are committed to protecting your personal information and your right to privacy. This Privacy Policy governs the privacy practices of our online learning and testing platform, located at examy-hazel.vercel.app.
            </p>
            <p>
              By accessing or using our platform, you consent to the collection, storage, use, and disclosure of your personal data as described in this policy.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="font-display text-xl font-bold text-foreground">2. Information We Collect</h2>
            <p>We collect personal information that you voluntarily provide to us when registering on the platform, purchasing tokens, taking tests, or contacting support. This includes:</p>
            <ul className="list-disc pl-5 space-y-1">
              <li><strong>Account Credentials:</strong> Full name, email address, password, and college/university affiliation.</li>
              <li><strong>Transaction Records:</strong> Payment screenshots, payment proof transaction messages, and wallet transaction history (amount, type, description). We do not store direct credit card details; all transaction metadata is processed securely via Supabase.</li>
              <li><strong>Test Attempt Metrics:</strong> Started times, submission times, scores, answered questions, word counts for essay answers, and rankings.</li>
              <li><strong>Support Interaction History:</strong> Support tickets, messages, attachments, and chats (including anonymous token-based chats).</li>
            </ul>
          </section>

          <section className="space-y-3">
            <h2 className="font-display text-xl font-bold text-foreground">3. How We Use Your Data</h2>
            <p>We use the collected information for the following business purposes:</p>
            <ul className="list-disc pl-5 space-y-1">
              <li>To provide and maintain the platform's core assessment and learning features.</li>
              <li>To grade written and hybrid mock tests manually or automatically.</li>
              <li>To display public ranking leaderboards to facilitate academic competition (only your display name, college, and scores are visible).</li>
              <li>To manage your token wallet, verify token purchases, and activate premium subscriptions.</li>
              <li>To answer support requests, chats, and resolve complaints.</li>
              <li>To secure the platform against cheating, duplicate submissions, and fraud.</li>
            </ul>
          </section>

          <section className="space-y-3">
            <h2 className="font-display text-xl font-bold text-foreground">4. Cookies and Analytical Tracking</h2>
            <p>
              We use secure, local storage and cookies to maintain authenticated sessions and remember preferences. We do not engage in behavioral cross-site tracking or sell user analytical data to third-party advertisers. All analytical metrics are kept strictly within our database.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="font-display text-xl font-bold text-foreground">5. Data Retention and Security</h2>
            <p>
              We implement robust technical and organizational security measures via Supabase Row-Level Security (RLS) to protect your personal data from unauthorized access, modification, or deletion. 
            </p>
            <p>
              You may update your profile details or request password changes at any time. Under the "Danger Zone" in your Profile Settings, you can permanently delete your account, which will irreversibly purge all personal info, attempt history, and purchases from our active database.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="font-display text-xl font-bold text-foreground">6. Contact Information</h2>
            <p>
              If you have any questions, feedback, or concerns regarding this Privacy Policy or our data handling practices, please contact us at <a href="mailto:support@examly.app" className="text-primary hover:underline font-semibold">support@examly.app</a> or open a ticket on our <Link to="/support" className="text-primary hover:underline font-semibold">Help & Support</Link> portal.
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
