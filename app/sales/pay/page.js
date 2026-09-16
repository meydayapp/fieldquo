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
//
// ══ Two accounts this screen is not for, and one it is for twice ══════════
//
// A call-centre agency's EMPLOYEE (lib/sales/agency.js) is paid by the
// agency, not by FieldQuo. Both routes behind this screen refuse them with
// the agency's name, and so does this page, before either panel mounts: a
// figure "awaiting payout" beside a bank-details form would promise a
// transfer that will never reach them. The AGENCY sees the same two panels
// every rep sees — the earnings are the pool, with the split by employee
// that /api/sales/earnings adds for it, and the destination is its own.
import { useEffect, useState } from "react";
import EarningsPanel from "@/app/components/sales/EarningsPanel";
import PayoutDestinationForm from "@/app/components/sales/PayoutDestinationForm";
import { useTranslation } from "@/app/hooks/useTranslation";
import { fetchJson } from "@/lib/fetchJson";

export default function SalesPayPage() {
  const { t } = useTranslation();
  // null until /api/sales/me answers; the panels wait, because rendering
  // them for an employee and then swapping in a refusal is a screen that
  // showed a number and took it back.
  const [me, setMe] = useState(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    let cancelled = false;
    fetchJson("/api/sales/me")
      .then((body) => { if (!cancelled) setMe(body); })
      .catch(() => { if (!cancelled) setFailed(true); });
    return () => { cancelled = true; };
  }, []);

  if (me?.agencyEmployee) {
    return (
      <div className="space-y-6 max-w-2xl" data-tour="sales-pay">
        <header className="space-y-2">
          <h1 className="text-xl font-semibold text-foreground">{t("app.salesPay.title")}</h1>
        </header>
        <p className="rounded-lg border border-border bg-card p-4 text-sm text-foreground" data-agency-employee>
          {t("app.salesPay.agencyEmployeeRefusal", { agency: me.agency?.name || "" })}
        </p>
      </div>
    );
  }

  if (!me && !failed) {
    return (
      <div className="space-y-6 max-w-2xl" data-tour="sales-pay">
        <header className="space-y-2">
          <h1 className="text-xl font-semibold text-foreground">{t("app.salesPay.title")}</h1>
          <p className="text-sm text-muted-foreground">{t("app.salesPay.loading")}</p>
        </header>
      </div>
    );
  }

  return (
    <div className="space-y-10 max-w-2xl" data-tour="sales-pay">
      <header className="space-y-2">
        <h1 className="text-xl font-semibold text-foreground">{t("app.salesPay.title")}</h1>
        <p className="text-sm text-muted-foreground">{me?.isAgency ? t("app.salesPay.agencyIntro") : t("app.salesPay.intro")}</p>
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
