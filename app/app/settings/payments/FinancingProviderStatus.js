"use client";

// The pay-over-time card's per-provider lines, beside the Affirm sentence the
// card already prints (page.js affirmSentence). A file of its own so the
// card's Affirm wording — which is being reworded separately — and this can
// change without touching each other.
//
// Every line here is STRIPE's answer, read on the status poll
// (app/api/stripe/connect/status/route.js) — never an assumption. The poll
// returns `klarna` in the same shape as `affirm`, `financingSupport` (the
// message to paste to Stripe support, only for someone allowed to see the
// account id) and `financingNoteProviders` (the providers the company's own
// financing note names; which of them the pay link cannot offer is worked
// out here, against the switch as it is now).

import { useState } from "react";
import Link from "next/link";
import { Copy, Check } from "lucide-react";
import { useTranslation } from "@/app/hooks/useTranslation";
import { useCompanyMoney } from "@/app/providers/CompanyPreferencesProvider";
import { FINANCING_PROVIDERS, financingBounds, unofferedNamedProviders } from "@/lib/stripe/financingMethods";

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

function SupportMessage({ provider, message, t }) {
  const [copied, setCopied] = useState(false);
  // A Copy button that silently does nothing is the dead control this
  // codebase hunts — clipboard is refused on plain HTTP or an unfocused
  // tab, so a failure says so and the text stays selectable.
  const [failed, setFailed] = useState(false);
  async function copy() {
    setFailed(false);
    try {
      await navigator.clipboard.writeText(message);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
      setFailed(true);
    }
  }
  return (
    <div className="mt-2 rounded-lg border border-border bg-muted/40 px-3 py-2.5" data-financing-support={provider}>
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs font-medium text-foreground">
          {t("app.setPayments.financingSupportLabel", { provider: FINANCING_PROVIDERS[provider].name })}
        </span>
        <button
          type="button"
          onClick={copy}
          className="inline-flex items-center gap-1 text-xs font-medium text-foreground hover:underline"
        >
          {copied ? <Check size={12} /> : <Copy size={12} />}
          {copied ? t("app.setPayments.financingSupportCopied") : t("app.setPayments.financingSupportCopy")}
        </button>
      </div>
      <p className="mt-1.5 text-xs text-muted-foreground select-all whitespace-pre-wrap">{message}</p>
      {failed && <p className="mt-1 text-xs text-amber-700 dark:text-amber-400">{t("app.setPayments.financingSupportCopyFailed")}</p>}
    </div>
  );
}

/**
 * What to do when Stripe has declined (inactive) or is holding (pending) a
 * provider, plus the paste-to-Stripe message when the poll gave one.
 */
function ProviderHelp({ provider, status, message, t }) {
  if (status !== "inactive" && status !== "pending") return null;
  return (
    <>
      <p className="text-xs text-muted-foreground mt-1">
        {status === "inactive" ? t("app.setPayments.financingDeclinedHelp") : t("app.setPayments.financingPendingHelp")}
      </p>
      {message && <SupportMessage provider={provider} message={message} t={t} />}
    </>
  );
}

export default function FinancingProviderStatus({ status, offerFinancing, currency }) {
  const { t, language } = useTranslation();
  const money = useCompanyMoney();
  if (!status) return null;
  const klarna = status.klarna || null;
  const affirmStatus = status.affirm?.status || null;
  const support = status.financingSupport || {};
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
      {/* Affirm's own sentence is printed above (affirmSentence); this adds
          only what to do when Stripe says no, and the message for Stripe. */}
      {offerFinancing && (
        <ProviderHelp provider="affirm" status={affirmStatus} message={support.affirm} t={t} />
      )}

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
              {klarna.disabledReason && <p className="text-xs text-muted-foreground mt-1">{klarna.disabledReason}</p>}
              {klarna.pendingVerification && !klarna.requirements?.length && (
                <p className="text-xs text-muted-foreground mt-1">{t("app.setPayments.klarnaVerifying")}</p>
              )}
              <ProviderHelp provider="klarna" status={klarna.status} message={support.klarna} t={t} />
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
