"use client";

// app/sales/welcome/page.js
//
// The first thing a rep sees after they set their password.
//
// ══ What was missing ══════════════════════════════════════════════════════
//
// Accepting an invitation collected a password and nothing else, then dropped
// the rep on the Today screen. Two facts about them stayed unknown until
// somebody thought to ask in a chat window:
//
//   · Where their commission goes. The ledger has always known what a rep is
//     OWED; nothing knew how to pay it. A rep could close three companies and
//     still have nowhere for the money to land.
//   · What language they work in. app/sales/layout.js asserted English on
//     everybody's behalf — see lib/sales/repLanguage.js for the whole story.
//
// Both are asked here, in one pass, at the one moment a new hire is sitting in
// front of the portal expecting to be asked things.
//
// ══ Why this is NOT a wall ════════════════════════════════════════════════
//
// A blocking first-run screen is worse than the gap it closes. A rep who does
// not have their Wise details to hand, or whose first day is a phone in a
// truck, would be locked out of the portal by a question that can wait — and
// the way people get past a wall like that is by typing something wrong into
// it, which leaves the record confidently incorrect rather than honestly
// empty. So: nothing here is required, the skip is a first-class control
// rather than small print, and every question is re-enterable from /sales/pay
// forever.
//
// The safety net is not this screen. It is /sales/pay's readiness banner,
// which names every missing fact by name and does not go away until they are
// there (lib/sales/payoutDetails.js's payoutReadiness).
//
// ══ Why no "have they seen it" column ═════════════════════════════════════
//
// The obvious alternative was SalesRep.onboardedAt, and it was rejected: it
// would be a column written on one screen and read by nothing else, which is
// AGENTS.md failure class #1, and it would tempt the next change into
// re-showing this wall on every sign-in until it was ticked. The invite route
// sends a rep here once, by URL. Coming back later is a normal visit to a
// normal screen.
import { useState } from "react";
import Link from "next/link";
import { ArrowRight, Check } from "lucide-react";

import PayoutDestinationForm from "@/app/components/sales/PayoutDestinationForm";
import RepLanguageChoice from "@/app/components/sales/RepLanguageChoice";
import { useTranslation } from "@/app/hooks/useTranslation";

export default function SalesWelcomePage() {
  const { t } = useTranslation();
  // Purely so the two steps can tick. Nothing gates on them — see the header.
  const [payoutDone, setPayoutDone] = useState(false);
  const [languageDone, setLanguageDone] = useState(false);

  // Computed HERE rather than inline in the link below, so that the block
  // marked "the way out" is free of every conditional. That is not tidiness:
  // scripts/check-rep-settings.mjs asserts that region contains no `&&` and no
  // ternary, which is how "the skip is never gated on an answer" stays true
  // after the next edit. A guard added to that link would fail the check.
  const exitLabel =
    payoutDone || languageDone ? t("app.salesPay.exitGoToPortal") : t("app.salesPay.exitSkip");

  // One sentence with one {tab} placeholder, split around it rather than
  // written as three JSX fragments: where the tab name falls in the sentence
  // differs by language, and a translator must never be handed markup to
  // reassemble. Resolving the key with no values leaves {tab} in place to
  // split on.
  const introParts = t("app.salesPay.welcomeIntro").split("{tab}");

  return (
    <div className="space-y-10 max-w-2xl">
      <header className="space-y-2">
        <h1 className="text-xl font-semibold text-foreground">{t("app.salesPay.welcomeTitle")}</h1>
        <p className="text-sm text-muted-foreground">
          {introParts[0]}
          <strong className="font-semibold">{t("app.salesPay.payTabName")}</strong>
          {introParts[1] || ""}
        </p>
      </header>

      <section className="space-y-4">
        <div className="flex items-center gap-2">
          <StepMark done={payoutDone} n={1} />
          <h2 className="text-base font-semibold text-foreground">
            {t("app.salesPay.payoutStepTitle")}
          </h2>
        </div>
        <p className="text-sm text-muted-foreground">{t("app.salesPay.payoutStepBody")}</p>
        {/* The engagement panel is left off here. It is FieldQuo's statement
            about the rep, not a question for them, and on a first-run screen it
            reads as another thing to fill in. It is on /sales/pay, where a rep
            goes to check what is on record about them. */}
        <PayoutDestinationForm showEngagement={false} onSaved={(v) => setPayoutDone(Boolean(v?.ready))} />
      </section>

      <section className="space-y-4 border-t border-border pt-8">
        <div className="flex items-center gap-2">
          <StepMark done={languageDone} n={2} />
          <h2 className="text-base font-semibold text-foreground">
            {t("app.salesPay.languageStepTitle")}
          </h2>
        </div>
        <RepLanguageChoice onSaved={(code) => setLanguageDone(Boolean(code))} />
      </section>

      {/* THE WAY OUT — a control, not small print, and never gated. */}
      <div className="border-t border-border pt-6 flex flex-wrap items-center gap-4">
        <Link
          href="/sales"
          className="inline-flex items-center gap-2 min-h-[44px] rounded-full bg-inverted text-inverted-foreground px-5 text-sm font-semibold"
        >
          {exitLabel}
          <ArrowRight size={14} aria-hidden="true" />
        </Link>
        <span className="text-sm text-muted-foreground">
          {t("app.salesPay.bothOnPayTab")}
        </span>
      </div>
    </div>
  );
}

/** A step number, or a tick once that step has been answered. */
function StepMark({ done, n }) {
  return (
    <span
      className={`inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-bold ${
        done ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
      }`}
      aria-hidden="true"
    >
      {done ? <Check size={14} /> : n}
    </span>
  );
}
