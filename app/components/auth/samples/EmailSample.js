// app/components/auth/samples/EmailSample.js
//
// The account step's sample: the quote email a homeowner receives, built by
// the REAL template — buildQuoteEmail (lib/email/quoteEmail.js), the same
// call app/api/quotes/[id]/send makes — with the visitor's company name in
// the From line and on the brand band, and shown as the HTML it is, in a
// frame at the width a mail client gives it.
//
// Before 2026-09-25 this was a Tailwind drawing of an inbox that borrowed
// the email's sentences; the owner looked at it and said it did not look
// like a real sample. The drawing is gone. What is left outside the frame is
// one line of metadata — From and Subject, the two things an inbox shows
// before the email is opened — both taken from what the template returned
// and from how lib/email/resend.js addresses a document email (the
// company's name as the sender's name).
"use client";

import { useMemo } from "react";
import { buildQuoteEmail } from "@/lib/email/quoteEmail";
import { getAppOrigin } from "@/lib/appUrl";
import { useTranslation } from "@/app/hooks/useTranslation";
import SampleFrame from "./SampleFrame";
import { SCOPE_GROUPS } from "@/docs/screens/app-guide/harness/fixtures/public-quote.js";
import { SAMPLE_CLIENT, SAMPLE_QUOTE, sampleCompany, sampleLines, sampleTotals } from "./sampleCompany";

/** Where the button points: the real /q address shape, on a token nobody holds. */
function sampleLink() {
  let origin = "";
  try {
    origin = getAppOrigin();
  } catch {
    origin = typeof window !== "undefined" ? window.location.origin : "";
  }
  return `${origin}/q/${"sample"}`;
}

/**
 * The template's arguments for the signup's state — exported so the check
 * can call buildQuoteEmail with exactly what the panel calls it with.
 */
export function sampleEmailArgs({ form, language = "en", trade = null, groupLabel = "", currency = null, placeholder = "", taxRatePct = null }) {
  const company = sampleCompany(form, { placeholder, currency });
  const { fromTrade, lines } = sampleLines(trade);
  const totals = sampleTotals(lines, taxRatePct);
  // The rows exactly as the send route hands them over: QuoteLineItem's own
  // fields (description / quantity / unitPrice / amount), inside the quote's
  // scope groups with their category — which is what the email's scope
  // breakdown and "what happens next" read. With the trade's lines, one
  // group in the trade's category; without, the fixture quote's own groups.
  const row = (l) => ({ description: l.name, quantity: l.quantity, unitPrice: l.unitPrice, amount: l.total, detail: l.description || "" });
  const scopeGroups = fromTrade
    ? [{ label: groupLabel || "", category: trade?.categoryKey ? { key: trade.categoryKey, label: groupLabel || "" } : null, companySettings: null, subtotal: totals.subtotal, lineItems: lines.map(row) }]
    : SCOPE_GROUPS.map((g) => ({ label: g.label, category: null, companySettings: null, subtotal: g.subtotal, lineItems: g.lineItems.map((li) => ({ ...li, unitPrice: li.quantity ? li.amount / li.quantity : li.amount, detail: "" })) }));
  return {
    quote: {
      quoteNumber: SAMPLE_QUOTE.quoteNumber,
      total: totals.total,
      validUntil: SAMPLE_QUOTE.validUntil,
      lineItems: lines.map(row),
      processNotes: null,
      customFields: [],
      emailReferences: null,
      emailBeforeAfter: null,
      emailIncludeReferences: null,
      emailIncludeBeforeAfter: null,
    },
    client: { name: SAMPLE_CLIENT.name },
    company,
    url: sampleLink(),
    language,
    scopeGroups,
  };
}

export default function EmailSample({ form, language = "en", trade = null, groupLabel = "", currency = null, taxRatePct = null }) {
  const { t } = useTranslation();
  const placeholder = t("app.signup.aside.email.yourCompany", "Your company name");
  const built = useMemo(() => {
    try {
      return buildQuoteEmail(sampleEmailArgs({ form, language, trade, groupLabel, currency, placeholder, taxRatePct }));
    } catch {
      // The template throws only on a missing section switch, which
      // sampleCompany always sets; a picture must never take the form down.
      return null;
    }
  }, [form, language, trade, groupLabel, currency, placeholder, taxRatePct]);
  if (!built) return null;
  const sender = sampleCompany(form, { placeholder }).name;
  return (
    <div className="space-y-2" data-email-sample>
      <div className="rounded-lg border border-border bg-card px-3 py-2 text-[13px] leading-snug">
        <p className="truncate">
          <span className="text-muted-foreground">{t("app.signup.aside.email.from", "From")}: </span>
          <span className="font-semibold text-foreground" data-email-from>
            {sender}
          </span>
        </p>
        <p className="truncate">
          <span className="text-muted-foreground">{t("app.signup.aside.email.subject", "Subject")}: </span>
          <span className="text-foreground" data-email-subject>
            {built.subject}
          </span>
        </p>
      </div>
      <SampleFrame
        html={built.html}
        width={600}
        maxHeight={760}
        label={t("app.signup.aside.email.label", "the quote email your client receives")}
      />
    </div>
  );
}
