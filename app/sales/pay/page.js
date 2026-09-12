"use client";

// app/sales/pay/page.js
//
// The rep's pay: what they have earned, each closed week and how it was
// paid, and where FieldQuo sends it. Money only.
//
// ══ Why the language pickers left this screen ═════════════════════════════
//
// They lived here — the argument was that a rep has two things to set and
// visits both on the same errand, so one settings screen beat two. The owner
// read the result and said "Pay and languages should not be in the same
// page", and he was right about the errand: somebody opening a tab labelled
// Pay is asking how much, and a language picker under a payout form is
// noise on the one screen a salesperson opens to decide whether to keep
// making calls. The portal language, the languages they sell in, browser
// notifications and the profile are on /sales/settings now. The payout
// destination stays: where the money goes is a money question.
//
// ══ Why the form itself is a component ════════════════════════════════════
//
// /sales/welcome asks for the payout destination too. Two forms posting the
// same body to the same route is AGENTS.md failure class #4, so the control
// lives in app/components/sales/PayoutDestinationForm.js and both screens
// render it. The prose below is this screen's own, because the first-run pass
// says something different to somebody who has not been paid yet.
import EarningsPanel from "@/app/components/sales/EarningsPanel";
import PayoutDestinationForm from "@/app/components/sales/PayoutDestinationForm";
import { useTranslation } from "@/app/hooks/useTranslation";

export default function SalesPayPage() {
  const { t } = useTranslation();

  return (
    <div className="space-y-10 max-w-2xl" data-tour="sales-pay">
      <header className="space-y-2">
        <h1 className="text-xl font-semibold text-foreground">{t("app.salesPay.title")}</h1>
        <p className="text-sm text-muted-foreground">{t("app.salesPay.intro")}</p>
      </header>

      {/* Above the destination form, and that order changed with this
          screen. A tab labelled "Pay" was answering "where do we send it"
          and never "how much" — the question a salesperson actually opens
          it for. */}
      <EarningsPanel />

      <section className="border-t border-border pt-8">
        <PayoutDestinationForm />
      </section>
    </div>
  );
}
