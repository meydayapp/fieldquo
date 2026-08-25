// lib/email/quoteEmail.js
//
// The email a client actually receives when a quote is sent.
//
// ── Why this file exists at all ─────────────────────────────────────────────
//
// The "Send" button on the quote page called PATCH { status: "sent" } and
// nothing else. There was no quote-send route anywhere in the app. The button
// changed a word on screen, the button then disappeared because the status was
// no longer "draft", and the user reasonably concluded a quote had gone out.
// Nothing had. That's the worst class of bug in a product like this — it
// doesn't fail, it lies, and the person only finds out when a client says they
// never heard back.
//
// ── Design of the email itself ──────────────────────────────────────────────
//
// This file used to argue for the opposite of what it now does, and the old
// argument is worth keeping because it is not wrong: an email that reproduces
// the whole quote gives the client a second, worse copy to read and a reason
// not to click through to the one with the approve button on it. The link was
// the point.
//
// What changed is not the reasoning, it is the competition. A homeowner has
// three quotes in the inbox and reads them side by side. The contractors who
// came to FieldQuo from their own hand-built systems were sending letters that
// argued for the job — what's included, what happens on which day, past
// clients who will take a call — and a bare link next to one of those reads as
// the company that couldn't be bothered. The owner has seen both and chosen
// this one.
//
// So the email carries the substance, and the click-through is protected by
// ORDER rather than by scarcity: the approve button sits directly under the
// total, above every word of detail, and repeats once at the very bottom for
// the reader who scrolled all the way. There is exactly one call to action in
// the message and it appears twice in the same clothes.
//
// Everything below the button comes from data that already exists:
// lib/documents/serviceContent.js (what's included, the steps and their
// timelines, what could change this price) and the quote's own scope groups.
// Nothing here writes new claims on a contractor's behalf.
//
// The two OPTIONAL sections — references and before/after photos — are the
// company's, not the quote's, and they carry a rule: switched on and empty is
// never sent. See lib/quotes/emailSections.js for where that is enforced and
// why it is enforced twice.
//
// Everything is inline-styled and table-based: Gmail strips <style> blocks,
// and Outlook's renderer is Word. The furniture — brand band, amount block,
// button, footer — lives in documentEmailLayout.js so the invoice that follows
// this quote is unmistakably from the same company. The body sections live in
// quoteSections.js, shared with the PDF sections' own email renderers.

import { documentTheme, fillPair } from "@/lib/documents/theme";
import { emailCopy } from "@/lib/i18n/emailCopy";
import { documentFormatters, documentLabels } from "@/lib/i18n/documentLabels";
import {
  documentEmailHtml,
  amountBlock,
  emailButton,
  escapeHtml,
  EMAIL_FONT,
} from "@/lib/email/documentEmailLayout";
import { dominantProcessSteps } from "@/lib/documents/serviceContent";
import {
  scopeBreakdownHtml,
  processStepsHtml,
  referencesHtml,
  beforeAfterHtml,
  quoteSectionsText,
} from "@/lib/email/quoteSections";
import {
  resolveQuoteEmailSections,
  assertQuoteEmailSectionsReady,
  assertSectionFieldsLoaded,
  renderableItems,
} from "@/lib/quotes/emailSections";

const num = (v) => Number(v ?? 0);

// ── SEAM: the financing block slots in here ─────────────────────────────────
//
// A pay-over-time offer belongs between "here is what it costs and what you
// get" and "here are the people who will vouch for us": it answers the
// objection the total has just raised, ahead of the proof that the work is
// good. That position is the decision this constant records.
//
// It renders NOTHING, and there is deliberately no flag switching a financing
// section on — a feature flag for a feature that doesn't exist is its own
// failure class. lib/financing/* and lib/estimate/financing.js are being built
// separately; when they land, this constant becomes a call to their builder
// with company.offerFinancing as the condition, and nothing else in this file
// moves.
//
// An empty STRING rather than an HTML comment on purpose: comments travel to
// the recipient, and Gmail clips a message at 102KB — that budget is not for
// notes to ourselves.
const FINANCING_SEAM = "";

/**
 * @param kind        "quote" | "follow_up" — same layout, different opening
 *                    line. A follow-up that looks like a fresh quote reads as
 *                    a company that has lost track of what it sent.
 * @param language    the CLIENT's language, resolved by the caller. Not the
 *                    company's and not a viewer preference — a francophone
 *                    homeowner gets a French email whichever language the
 *                    contractor works in.
 * @param scopeGroups the quote's groups WITH `companySettings` attached
 *                    (lib/documents/loadServiceSettings.js), so a company that
 *                    customised its wording sees its own words in the email
 *                    and in the attached PDF rather than two different
 *                    documents. Omitted, the email falls back to the quote's
 *                    flat lineItems, which is what a quote with no groups has.
 *
 * @throws QuoteEmailSectionsIncomplete when an optional section is switched on
 *         with nothing in it. Deliberately a throw and not a silent skip: the
 *         send route gates this before it gets here and answers 409 with the
 *         two ways out, and this is what catches the send path that hasn't
 *         been written yet.
 */
export function buildQuoteEmail({
  quote,
  client,
  company,
  url,
  kind = "quote",
  language = "en",
  scopeGroups = [],
}) {
  const t = documentTheme(company);
  const fill = fillPair(t);
  const c = emailCopy(language);
  // The document word on the brand band ("Quote" / "Devis" / "Presupuesto"),
  // from the same catalogue the PDF and the approval page use. Same language as
  // everything else here: the client's.
  const labels = documentLabels(language);
  // Currency is the COMPANY's, not the reader's — a Ukrainian-speaking
  // homeowner buying from a Toronto contractor is billed in Canadian dollars,
  // and the same homeowner buying from a Boston one is billed in US dollars.
  // Language changes the formatting; it never changes the money.
  //
  // The old comment had that reasoning right and then hardcoded CAD anyway, so
  // every non-Canadian company's emails quoted Canadian formatting.
  const { money, date } = documentFormatters(language, company?.currency);

  // Resolved here rather than taken as an argument, so no caller can build
  // this email having forgotten to ask. assertSectionFieldsLoaded turns "the
  // Prisma select didn't include those columns" into a loud failure instead of
  // an email that quietly leaves the sections out.
  assertSectionFieldsLoaded(company, quote);
  const sections = assertQuoteEmailSectionsReady(
    resolveQuoteEmailSections({ company, quote }),
  );

  const clientName = String(client?.name || "").split(" ")[0] || "";
  const total = money(quote.total);

  const isFollowUp = kind === "follow_up";
  const opening = isFollowUp ? c.followUpIntro() : c.quoteIntro();

  const subject = isFollowUp
    ? c.followUpSubject(company.name, quote.quoteNumber)
    : c.quoteSubject(company.name, quote.quoteNumber);

  const expiry = quote.validUntil ? date(quote.validUntil) : null;

  // inkMuted, not inkFaint, for the "or paste this" fallback below. inkFaint is
  // built to a 3:1 target — fine for a hairline — and measures 3.27:1 on white,
  // under the body bar for a 12px line. That line is what a client falls back
  // to when their mail client ate the button; it is the last thing in the email
  // allowed to be hard to read.
  const fallbackInk = t.inkMuted;

  // The data the body sections read. `scopeGroups` when the caller loaded
  // them, otherwise the quote's own flat lineItems — toGroups() handles both.
  const data = {
    lineItems: quote.lineItems,
    processNotes: quote.processNotes,
    scopeGroups,
  };

  const steps = dominantProcessSteps(
    (Array.isArray(scopeGroups) ? scopeGroups : []).map((g) => ({
      categoryKey: g.category?.key || null,
      override: g.companySettings || null,
      subtotal: num(g.subtotal),
    })),
  );

  const cta = emailButton({ url, label: escapeHtml(c.quoteCta), fill });

  const divider = `
        <div style="border-top:1px solid ${t.borderSoft};margin:22px 0 18px;font-size:0;line-height:0;">&nbsp;</div>`;

  const body = `
        <p style="font-family:${EMAIL_FONT};font-size:15px;line-height:1.6;margin:0 0 14px;color:${t.ink};">
          ${escapeHtml(c.greeting(clientName))}
        </p>
        <p style="font-family:${EMAIL_FONT};font-size:15px;line-height:1.6;margin:0 0 22px;color:${t.inkMuted};">
          ${opening}
        </p>
${amountBlock({
  theme: t,
  // The quote number moved up to the brand band, where a reference belongs.
  // This block now says what the figure IS, which is the question a client
  // actually has when they see a number that size.
  label: escapeHtml(labels.total.toUpperCase()),
  amount: total,
  sub: expiry ? escapeHtml(c.validUntil(expiry)) : "",
})}
${cta}
        <p style="font-family:${EMAIL_FONT};font-size:12px;line-height:1.6;color:${fallbackInk};margin:16px 0 0;text-align:center;">
          ${escapeHtml(c.orPaste)}<br />
          <span style="word-break:break-all;">${escapeHtml(url)}</span>
        </p>
${divider}
${scopeBreakdownHtml({ data, company, language })}
${processStepsHtml({ data, company, language, steps })}
${FINANCING_SEAM}
${referencesHtml({ items: renderableItems(sections, "references"), company, language })}
${beforeAfterHtml({ items: renderableItems(sections, "beforeAfter"), company, language })}
${divider}
${cta}`;

  const html = documentEmailHtml({
    company,
    theme: t,
    fill,
    label: labels.quote,
    reference: quote.quoteNumber,
    body,
    footerNote: escapeHtml(c.questions(company.phone)),
  });

  // A plain-text alternative is not optional here. Some corporate filters
  // score HTML-only mail as spam, and a quote landing in junk is the same
  // outcome as never sending it. It carries the same argument as the HTML —
  // a text part that is only a link is a different, thinner email for the
  // reader whose client refuses HTML.
  const text = [
    c.greeting(clientName),
    "",
    opening,
    "",
    `${quote.quoteNumber} — ${total}`,
    expiry ? c.validUntil(expiry) : "",
    "",
    `${c.quoteCta}: ${url}`,
    "",
    quoteSectionsText({
      data,
      company,
      language,
      steps,
      references: renderableItems(sections, "references"),
      beforeAfter: renderableItems(sections, "beforeAfter"),
    }),
    c.questions(company.phone),
    company.name,
  ]
    .filter((l) => l !== "")
    .join("\n");

  return { subject, html, text };
}
