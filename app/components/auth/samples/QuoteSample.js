// app/components/auth/samples/QuoteSample.js
//
// The trades step's sample (and "Look professional"'s): the page a homeowner
// opens from the quote email — the REAL client quote page, app/q/[token]/
// QuoteApproval.js, rendered from a payload in exactly the shape
// GET /api/public/quotes/[token] answers (its `sample` prop; it fetches
// nothing and posts nothing), at a phone's width, because that is where a
// homeowner reads it.
//
// ── Which quote ────────────────────────────────────────────────────────────
//
// Once a trade is picked and its two seed services have prices: the
// visitor's company, the trade's two services at the price a company in that
// trade STARTS with (the seed median in their currency — see
// lib/signup/sampleServices.js), the scope wording, "what's included" and
// the "what happens next" steps the real quote page prints for that trade,
// and tax at the rate the address resolved to (or "To be confirmed" when it
// has not, which is what the real page prints).
//
// Before a trade is picked, or for a trade whose seed carries no price: the
// harness fixture's own quote page, Q-1042 — the cabinet maker's kitchen,
// with its own figures — said to be exactly that under the frame. The owner
// rejected round placeholder amounts as unbelievable; a real sample of
// somebody's work, labelled as such, is the honest alternative to inventing
// a price for work we have no figure for.
"use client";

import { useMemo } from "react";
import QuoteApproval from "@/app/q/[token]/QuoteApproval";
import { useTranslation } from "@/app/hooks/useTranslation";
import { COMPANY, CLIENT, QUOTE } from "@/docs/screens/app-guide/harness/fixtures/company.js";
import { QUOTE_PAGE_HEAD, QUOTE_PAGE_TAIL } from "@/docs/screens/app-guide/harness/fixtures/public-quote.js";
import { documentTheme } from "@/lib/documents/theme";
import SampleFrame from "./SampleFrame";
import { sampleCompany, sampleCurrency, sampleLines, sampleTotals } from "./sampleCompany";

// The page's paper, as the neutral brand's theme defines it — the frame
// behind the page must not show a band of the panel's colour as it loads.
const PAPER = documentTheme({ brandColor: null }).paper;

/** The public company shape the quote page reads (the public route's select). */
function publicCompany(c) {
  return {
    name: c.name,
    logoUrl: c.logoUrl,
    brandColor: c.brandColor,
    email: c.email,
    phone: c.phone,
    website: c.website,
    address: c.address,
    paymentTerms: c.paymentTerms,
    paymentMethods: c.paymentMethods,
    currency: c.currency,
    defaultLanguage: c.defaultLanguage,
    province: c.province,
    country: c.country,
    taxIdName: c.taxIdName,
    taxIdNumber: c.taxIdNumber,
  };
}

/**
 * The payload QuoteApproval renders — exported so the check can assert what
 * the panel shows.
 *
 * @param trade  the /api/signup/sample-services answer for the first trade
 *               ({ services, group, processSteps, glossary }) or null
 * @param tax    taxPreviewFor's answer for the address, or null
 * @returns {{ fromTrade: boolean, payload: object }}
 */
export function sampleQuotePayload({ form, language = "en", trade = null, groupLabel = "", currency = null, placeholder = "", tax = null }) {
  const { fromTrade, lines } = sampleLines(trade);
  const base = { quoteNumber: QUOTE.quoteNumber, status: "sent", language, proposal: { sections: [] } };
  if (!fromTrade) {
    // The fixture's own page: its company (in the neutral brand — the
    // signup never asks for a colour), its figures, its steps.
    const fixture = sampleCompany(
      { companyName: COMPANY.name, email: COMPANY.email, phone: COMPANY.phone, city: COMPANY.city, province: COMPANY.province, country: COMPANY.country, language },
      { currency: COMPANY.currency },
    );
    return {
      fromTrade: false,
      payload: {
        ...base,
        ...QUOTE_PAGE_HEAD,
        company: { ...publicCompany(fixture), address: `${COMPANY.address}, ${COMPANY.city}, ${COMPANY.province} ${COMPANY.postalCode}`, paymentTerms: COMPANY.paymentTerms, paymentMethods: COMPANY.paymentMethods },
        ...QUOTE_PAGE_TAIL,
        proposal: { sections: [] },
      },
    };
  }
  const company = sampleCompany(form, { placeholder, currency: sampleCurrency(trade?.currency || currency) });
  const totals = sampleTotals(lines, tax?.rate ?? null);
  const group = trade?.group || {};
  return {
    fromTrade: true,
    payload: {
      ...base,
      notes: null,
      processNotes: null,
      validUntil: QUOTE.validUntil,
      sentAt: QUOTE.sentAt,
      subtotal: totals.subtotal,
      discount: 0,
      tax: totals.tax,
      // "charged" with a figure when the address gave a rate; otherwise the
      // page's own "To be confirmed" — never a $0.00 that reads as no tax.
      taxKind: totals.ratePct ? "charged" : "unresolved",
      taxAssumedRegion: null,
      total: totals.total,
      acceptedTotal: null,
      taxRate: totals.ratePct ? totals.ratePct / 100 : 0,
      addOns: [],
      client: { name: CLIENT.name },
      company: publicCompany(company),
      financing: null,
      scopeGroups: [
        {
          label: groupLabel || lines[0]?.name || "",
          subtotal: totals.subtotal,
          accent: group.accent || null,
          description: group.description || "",
          included: Array.isArray(group.included) ? group.included : [],
          mayChange: Array.isArray(group.mayChange) ? group.mayChange : [],
          lineItems: lines.map((l) => ({ description: l.name, quantity: l.quantity, amount: l.total, detail: l.description })),
        },
      ],
      glossary: Array.isArray(trade?.glossary) ? trade.glossary : [],
      processSteps: Array.isArray(trade?.processSteps) ? trade.processSteps : [],
      paymentTerms: null,
      paymentSchedule: [],
    },
  };
}

export default function QuoteSample({ form, language = "en", trade = null, groupLabel = "", currency = null, tax = null, maxHeight = 1100 }) {
  const { t } = useTranslation();
  const placeholder = t("app.signup.aside.email.yourCompany", "Your company name");
  const { fromTrade, payload } = useMemo(
    () => sampleQuotePayload({ form, language, trade, groupLabel, currency, placeholder, tax }),
    [form, language, trade, groupLabel, currency, placeholder, tax],
  );
  return (
    <div data-quote-sample={fromTrade ? "trade" : "fixture"}>
      <SampleFrame width={390} maxHeight={maxHeight} background={PAPER} label={t("app.signup.aside.doc.label", "the quote page your client opens from the email")}>
        <QuoteApproval token={null} sample={payload} />
      </SampleFrame>
      <p className="mt-2 text-[11px] text-muted-foreground">
        {fromTrade
          ? t("app.signup.aside.doc.tradeCaption", "Your trade's services at the prices a new company in your trade starts with — change them any time.")
          : trade?.services?.length
            ? t("app.signup.aside.doc.unpricedCaption", "A sample quote from a cabinet maker — we have no typical price for your trade's work, so you set your own rates.")
            : t("app.signup.aside.doc.fixtureCaption", "A sample quote from a cabinet maker. Pick your trade and it shows your services at your starting prices.")}
      </p>
    </div>
  );
}
