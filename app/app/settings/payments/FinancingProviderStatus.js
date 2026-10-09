"use client";

// The pay-over-time card's Klarna lines and the quote-note warning, beside
// the Affirm sentence and reason the card already prints (page.js
// affirmSentence, ./AffirmReason.js). A file of its own so the card's Affirm
// wording and this can change without touching each other.
//
// Every line here is STRIPE's answer, read on the status poll
// (app/api/stripe/connect/status/route.js) — never an assumption. The poll
// returns `klarna` in the same shape as `affirm` (status, requirements, the
// reason code and whether Stripe support is the next step) and
// `financingNoteProviders` (the providers the company's own financing note
// names; which of them the pay link cannot offer is worked out here, against
// the switch as it is now).

import Link from "next/link";
import { useTranslation } from "@/app/hooks/useTranslation";
import { useCompanyMoney } from "@/app/providers/CompanyPreferencesProvider";
import { financingBounds, unofferedNamedProviders } from "@/lib/stripe/financingMethods";
import AffirmReason from "./AffirmReason";

function countryName(code, language) {
  if (!code) return "";
  try {
    return new Intl.DisplayNames([language || "en"], { type: "region" }).of(code) || code;
  } catch {
    return code;
  }
}

// Literal keys per state, so check:translations can see each one is used.
function klarnaSentence({ klarna, currency, money, t, language }) {
  const status = klarna?.status || null;
  if (status === "unavailable") {
    return t("app.setPayments.klarnaUnavailable", { country: countryName(klarna?.country, language) });
  }
  if (status === "active") {
    const bounds = financingBounds("klarna", String(currency || "").toLowerCase());
    // A billing currency Klarna does not serve (a GBP company on a Canadian
    // account): Stripe granted the capability, but no invoice in that
    // currency can use it — said, rather than printing a range for CAD.
    if (!bounds) return t("app.setPayments.klarnaWrongCurrency");
    return t("app.setPayments.klarnaActive", {
      min: money(bounds.minCents / 100),
      max: money(bounds.maxCents / 100),
    });
  }
  if (status === "pending") return t("app.setPayments.klarnaPending");
  if (status === "inactive") return t("app.setPayments.klarnaInactive");
  return t("app.setPayments.klarnaNotRequested");
}

export default function FinancingProviderStatus({ status, offerFinancing, currency, accountId = null, businessName = "" }) {
  const { t, language } = useTranslation();
  const money = useCompanyMoney();
  if (!status) return null;
  const klarna = status.klarna || null;
  const affirmStatus = status.affirm?.status || null;
  // With the switch's CURRENT position, so turning financing off shows the
  // warning at once rather than on the next poll.
  const warnings = unofferedNamedProviders(status.financingNoteProviders, {
    offerFinancing,
    stripeAffirmStatus: affirmStatus,
    stripeKlarnaStatus: klarna?.status || null,
  });
  const klarnaOn = offerFinancing && klarna?.status === "active";

  return (
    <div data-financing-providers>
      {/* Klarna: the sentence is printed whenever the poll answered — with
          financing off it still says when Klarna is unavailable, like
          Affirm's line, and otherwise stays quiet until the switch is on. */}
      {klarna && (offerFinancing || klarna.status === "unavailable") && (
        <div className="mt-3">
          <p
            className={`text-xs ${
              klarnaOn
                ? "text-green-700 dark:text-green-400"
                : offerFinancing && klarna.status
                  ? "text-amber-700 dark:text-amber-400"
                  : "text-muted-foreground"
            }`}
            data-klarna-status={klarna.status || "none"}
          >
            {klarnaSentence({ klarna, currency, money, t, language })}
          </p>
          {offerFinancing && (klarna.status === "pending" || klarna.status === "inactive") && (
            <>
              {klarna.requirements?.length > 0 && (
                <p className="text-xs text-muted-foreground mt-1">
                  {t("app.setPayments.klarnaAsking", {
                    items: klarna.requirements.map((r) => r.label).join("; "),
                  })}
                </p>
              )}
              {/* Stripe's reason in plain words, the next step, and — when
                  that step is Stripe support — the message to send, ready to
                  copy: the same component and 22-code table as Affirm's,
                  with Klarna's name (./AffirmReason.js,
                  lib/stripe/financingReasons.js). Never the raw key. */}
              <AffirmReason provider="klarna" affirm={klarna} accountId={accountId} businessName={businessName} t={t} />
              {klarna.pendingVerification && !klarna.requirements?.length && (
                <p className="text-xs text-muted-foreground mt-1">{t("app.setPayments.klarnaVerifying")}</p>
              )}
            </>
          )}
        </div>
      )}

      {/* The company's own financing note (printed on its quotes) names a
          provider the pay link can't offer right now. Their words are never
          changed — the owner is told, and shown where to edit them. */}
      {warnings.length > 0 && (
        <p className="text-xs text-amber-700 dark:text-amber-400 mt-3" data-financing-note-warning>
          {t("app.setPayments.financingNoteWarning", {
            providers: warnings.map((w) => w.name).join(", "),
          })}{" "}
          <Link href="/app/settings/instant-quotes" className="underline font-medium">
            {t("app.setPayments.financingNoteWarningLink")}
          </Link>
        </p>
      )}
    </div>
  );
}
