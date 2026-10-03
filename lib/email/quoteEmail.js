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
import { effectiveProcessNotes } from "@/lib/quotes/completeness";
import { emailCopy } from "@/lib/i18n/emailCopy";
import { documentFormatters, documentLabels } from "@/lib/i18n/documentLabels";
import { documentFacts, customFactsHtml, customFactsText } from "@/lib/documentSections/customFacts";
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
  financingHtml,
  quoteEmailFinancing,
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
import { fillWording } from "@/lib/email/documentEmailWording";
import { compileCanvasBody, canvasText } from "@/lib/email/canvasEmail";
import { addToQuoteUrl, isBusinessClient } from "@/lib/quotes/addToQuoteLink";

// documentEmailHtml's card is 560 wide with 22px gutters: what a canvas
// letter has to fit in.
const LETTER_WIDTH = 516;

const num = (v) => Number(v ?? 0);

// ── Financing: where it sits, and when it appears ────────────────────────────
//
// A pay-over-time offer belongs between "here is what it costs and what you
// get" and "here are the people who will vouch for us": it answers the
// objection the total has just raised, ahead of the proof that the work is
// good. That position was recorded here as an empty seam before the setting
// existed; the owner's decision of 2026-09-29 filled it.
//
// The condition is the company's own Financing card (Settings › Client-facing
// › Instant Quotes, stored on Company.financing) — the same switch that shows
// the panel on the approval page, read through the same financingOffer. There
// is no separate "put it in the email" flag: a company that offers financing
// on the quote it links to and then says nothing about it in the letter
// carrying that link is two surfaces disagreeing. What it may say, and why it
// never says a monthly figure, is quoteEmailFinancing in quoteSections.js.
//
// Switched off, or on with neither a note nor a link, it renders "" — the
// email is then byte-for-byte what it was before this section existed, which
// check-quote-email-sections proves rather than asserts.

/**
 * @param kind        "quote" | "follow_up" — same layout, different opening
 *                    line. A follow-up that looks like a fresh quote reads as
 *                    a company that has lost track of what it sent.
 * @param language    the CLIENT's language, resolved by the caller. Not the
 *                    company's and not a viewer preference — a francophone
 *                    homeowner gets a French email whichever language the
 *                    contractor works in.
 * @param wording     the company's wording copy for this email, from
 *                    chooseWording() in lib/email/documentEmailWording.js, or
 *                    null for the original. Only the five slots change; the
 *                    amount, scope, steps, button and legal lines below are
 *                    derived from the quote exactly as before. Ignored for a
 *                    follow-up: the copy is of the QUOTE email.
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
  wording = null,
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

  // ── The five wording slots ────────────────────────────────────────────────
  //
  // The company's copy when one is active for this language, else the
  // original's sentences. `tokens` is everything a slot may name; the money
  // in it is already formatted, so a slot never sees a raw number.
  const slots = !isFollowUp && wording?.source === "copy" ? wording.slots : null;
  const tokens = {
    clientName,
    companyName: company.name || "",
    companyPhone: company.phone || "",
    quoteNumber: quote.quoteNumber || "",
    invoiceNumber: "",
    amount: total,
  };
  const greeting = slots ? fillWording(slots.greeting, tokens) : c.greeting(clientName);
  const opening = slots
    ? fillWording(slots.intro, tokens)
    : isFollowUp
      ? c.followUpIntro()
      : c.quoteIntro();
  const closing = slots ? fillWording(slots.closing, tokens) : c.questions(company.phone);
  const signature = slots ? fillWording(slots.signature, tokens) : company.name || "";

  const subject = slots
    ? fillWording(slots.subject, tokens)
    : isFollowUp
      ? c.followUpSubject(company.name, quote.quoteNumber)
      : c.quoteSubject(company.name, quote.quoteNumber);

  // A copy in canvas mode draws the LETTER — the greeting and intro — on the
  // canvas; everything under the amount block is still the document's.
  const canvasLetter =
    slots && wording.canvas
      ? compileCanvasBody(wording.canvas, tokens, { bodyWidth: LETTER_WIDTH })
      : null;

  const expiry = quote.validUntil ? date(quote.validUntil) : null;
  // The company's own boxes flagged for the document (a PO number), attached
  // by the send route as quote.customFields. Same words as the PDF and the
  // web copy — lib/documentSections/customFacts.js is the one formatter.
  const customFacts = documentFacts(quote, { date, labels });

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
    // The same resolution the document and the client page use — the quote's
    // own words, else the company's default (lib/quotes/completeness.js
    // effectiveProcessNotes). The email used to read the column alone, so a
    // company whose wording lives in Settings had a "what happens next"
    // section on the PDF and none in the covering email about it.
    processNotes: effectiveProcessNotes({ ...quote, company }) || null,
    scopeGroups,
    // The quote's own age: a trade paragraph added after it was written does
    // not appear in its email either (resolveServiceContent).
    createdAt: quote.createdAt,
  };

  // Resolved once, in the client's language, and handed to both the HTML and
  // the text part so the two cannot disagree about whether it is there.
  const financing = quoteEmailFinancing(company?.financing, { language });

  const steps = dominantProcessSteps(
    (Array.isArray(scopeGroups) ? scopeGroups : []).map((g) => ({
      categoryKey: g.category?.key || null,
      override: g.companySettings || null,
      subtotal: num(g.subtotal),
      // A drywall group's finish level, named in the Drywall step.
      intake: g.intakeValues,
    })),
  );

  const cta = emailButton({ url, label: escapeHtml(c.quoteCta), fill });

  // ── "Add this price to your own quote →" — business clients only ─────────
  //
  // A quote addressed to another business (Client.type "company") is often a
  // subcontractor pricing work for a general contractor, who will want this
  // number inside their OWN quote. One quiet line under the first button,
  // never a second button competing with approve. A homeowner never sees it,
  // and for them this is "" — their email is byte-for-byte what it was
  // (scripts/check-quote-email-sections.mjs). In the reader's language, like
  // every other word here. The page it opens is app/q/[token]/add.
  const business = isBusinessClient(client);
  const addLine = business
    ? `
        <p style="font-family:${EMAIL_FONT};font-size:13px;line-height:1.6;margin:12px 0 0;text-align:center;">
          <a href="${escapeHtml(addToQuoteUrl(url))}" style="color:${t.inkMuted};text-decoration:underline;">${escapeHtml(c.addToOwnQuote)}</a>
        </p>`
    : "";

  const divider = `
        <div style="border-top:1px solid ${t.borderSoft};margin:22px 0 18px;font-size:0;line-height:0;">&nbsp;</div>`;

  const letter =
    canvasLetter && !canvasLetter.empty
      ? `
        <div style="margin:0 0 22px;">${canvasLetter.body}</div>`
      : `
        <p style="font-family:${EMAIL_FONT};font-size:15px;line-height:1.6;margin:0 0 14px;color:${t.ink};">
          ${escapeHtml(greeting)}
        </p>
        <p style="font-family:${EMAIL_FONT};font-size:15px;line-height:1.6;margin:0 0 22px;color:${t.inkMuted};">
          ${slots ? escapeHtml(opening) : opening}
        </p>`;

  const body = `${letter}
${amountBlock({
  theme: t,
  // The quote number moved up to the brand band, where a reference belongs.
  // This block now says what the figure IS, which is the question a client
  // actually has when they see a number that size.
  label: escapeHtml(labels.total.toUpperCase()),
  amount: total,
  sub: expiry ? escapeHtml(c.validUntil(expiry)) : "",
})}
${customFactsHtml(customFacts, { theme: t, font: EMAIL_FONT, escape: escapeHtml })}
${cta}${addLine}
        <p style="font-family:${EMAIL_FONT};font-size:12px;line-height:1.6;color:${fallbackInk};margin:16px 0 0;text-align:center;">
          ${escapeHtml(c.orPaste)}<br />
          <span style="word-break:break-all;">${escapeHtml(url)}</span>
        </p>
${divider}
${scopeBreakdownHtml({ data, company, language })}
${processStepsHtml({ data, company, language, steps })}
${financingHtml({ financing, company, language, quoteUrl: url })}
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
    footerNote: escapeHtml(closing),
    signature: escapeHtml(signature),
  });

  // A plain-text alternative is not optional here. Some corporate filters
  // score HTML-only mail as spam, and a quote landing in junk is the same
  // outcome as never sending it. It carries the same argument as the HTML —
  // a text part that is only a link is a different, thinner email for the
  // reader whose client refuses HTML.
  const text = [
    ...(canvasLetter && !canvasLetter.empty
      ? [canvasText(wording.canvas, tokens)]
      : [greeting, "", opening]),
    "",
    `${quote.quoteNumber} — ${total}`,
    expiry ? c.validUntil(expiry) : "",
    ...customFactsText(customFacts),
    "",
    `${c.quoteCta}: ${url}`,
    // Filtered out below when empty, so a homeowner's text part is unchanged.
    business ? `${c.addToOwnQuote.replace(/\s*→\s*$/, "")}: ${addToQuoteUrl(url)}` : "",
    "",
    quoteSectionsText({
      data,
      company,
      language,
      steps,
      financing,
      quoteUrl: url,
      references: renderableItems(sections, "references"),
      beforeAfter: renderableItems(sections, "beforeAfter"),
    }),
    closing,
    signature,
  ]
    .filter((l) => l !== "")
    .join("\n");

  return { subject, html, text };
}
