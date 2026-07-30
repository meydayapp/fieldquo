// app/components/layout/AccountLocked.js
//
// What a locked-out company sees instead of the app.
//
// ── Why a whole screen and not just the banner ─────────────────────────────
//
// When an account is locked every data request is refused, so rendering the
// normal app would give them twenty empty panels and a scattering of error
// toasts. Somewhere in that mess is a banner explaining how to fix it. That's a
// worse experience than a wall, and it hides the one thing they need.
//
// So: one screen, one message, one button. It also makes the promise verifiable
// rather than hopeful — the only route out of this component is the billing
// page, and every request that page makes is on the allow-list in
// lib/billing/access.js.
//
// ── Tone ───────────────────────────────────────────────────────────────────
//
// Not punitive. Someone's card expired; they didn't do anything wrong, and they
// are two minutes from being a paying customer again. The copy says what
// happened, that their work is safe, and what to press.

import Link from "next/link";
import { Lock, CreditCard, ShieldCheck } from "lucide-react";

export default function AccountLocked({ reason, companyName }) {
  const cancelled = reason === "canceled";

  return (
    <main className="min-h-screen grid place-items-center p-6 bg-background">
      <div className="max-w-md w-full text-center">
        <div className="mx-auto h-14 w-14 rounded-full bg-muted grid place-items-center">
          <Lock size={24} className="text-muted-foreground" />
        </div>

        <h1 className="text-xl font-bold text-foreground mt-5">
          {cancelled ? "This subscription was cancelled" : "Your account is locked"}
        </h1>

        <p className="text-sm text-muted-foreground mt-2">
          {cancelled ? (
            <>
              {companyName ? <strong>{companyName}</strong> : "This account"} was
              cancelled, so the app is switched off. Starting it again turns
              everything back on straight away.
            </>
          ) : (
            <>
              We couldn&apos;t take payment, and the seven-day grace period has
              run out. Updating your card restores everything immediately.
            </>
          )}
        </p>

        {/* The first fear is that the work is gone. Answered before they have to
            ask, and given its own emphasis rather than buried in a paragraph. */}
        <div className="mt-6 flex items-start gap-2.5 text-left bg-card border border-border rounded-xl px-4 py-3">
          <ShieldCheck size={17} className="text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
          <p className="text-sm text-foreground">
            <strong>Nothing has been deleted.</strong> Your quotes, invoices,
            clients, jobs and photos are exactly where you left them, and they
            come back the moment payment goes through.
          </p>
        </div>

        <Link
          href="/app/settings/account-billing"
          className="mt-6 inline-flex items-center gap-2 px-6 py-3 rounded-full bg-inverted text-inverted-foreground text-sm font-bold"
        >
          <CreditCard size={16} />
          {cancelled ? "Start my subscription again" : "Update my card"}
        </Link>

        <p className="text-xs text-muted-foreground mt-5">
          Stuck, or think this is wrong?{" "}
          <Link href="/app/help" className="underline">
            Tell us
          </Link>{" "}
          — that still works.
        </p>
      </div>
    </main>
  );
}
