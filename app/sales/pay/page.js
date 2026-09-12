"use client";

// app/sales/pay/page.js
//
// The rep's own settings screen: how they get paid, and what language the
// portal speaks to them in.
//
// ══ Why the language picker lives HERE and not on a screen of its own ═════
//
// A rep has exactly two things to set about themselves, and both are visited
// on the same errand — the first morning, and again when something changes. A
// second settings tab would have been a "group of one" twice over, and would
// have put the two questions a new hire has to answer in two different places
// in a nav they already have eleven tabs in. /sales/welcome asks both together
// on day one; this screen is where they are changed afterwards, so there is
// ONE place a rep changes their own settings rather than two.
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
import RepLanguageChoice from "@/app/components/sales/RepLanguageChoice";
import RepSellsInChoice from "@/app/components/sales/RepSellsInChoice";
import BrowserNotifications from "@/app/components/notifications/BrowserNotifications";
import { useTranslation } from "@/app/hooks/useTranslation";

export default function SalesPayPage() {
  const { t } = useTranslation();

  return (
    <div className="space-y-10 max-w-2xl" data-tour="sales-pay">
      <header className="space-y-2">
        <h1 className="text-xl font-semibold text-foreground">{t("app.salesPay.title")}</h1>
        <p className="text-sm text-muted-foreground">{t("app.salesPay.intro")}</p>
      </header>

      {/* Above the settings, and that order changed with this screen. A tab
          labelled "Pay" was answering "where do we send it" and never "how
          much" — the question a salesperson actually opens it for. */}
      <EarningsPanel />

      <section className="border-t border-border pt-8">
        <PayoutDestinationForm />
      </section>

      {/* Below the payout details rather than above them: this screen is
          reached from a tab labelled "Pay", and a rep who followed that word
          should not have to scroll past a language question to find the thing
          they came for. */}
      <section className="border-t border-border pt-8">
        <RepLanguageChoice />
      </section>

      {/* Directly under the portal language, because it is the question a rep
          confuses it with: that one is which words the tabs are drawn in,
          this one is which prospects the queue may hand them. Quebec rows go
          only to a rep with French here — lib/sales/leadLanguage.js. */}
      <section className="border-t border-border pt-8">
        <RepSellsInChoice />
      </section>

      {/* A ringing call, a text back, an @mention, a topped-up queue — as a
          system notification when the portal is in a background tab, and
          with the tab closed where the deployment has push keys. The same
          block /app and /platform mount; the endpoint is this surface's. */}
      <section className="border-t border-border pt-8">
        <BrowserNotifications endpoint="/api/sales/push-subscription" />
      </section>
    </div>
  );
}
