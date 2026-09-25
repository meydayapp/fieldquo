// lib/followUps/mergeData.js
//
// What a follow-up rule's template is filled with for one quote, invoice,
// completed job or unanswered enquiry — the {{tokens}}, the itemised block's
// lines, the progress stage — and which language all of it is written in.
//
// Moved out of app/api/cron/follow-ups/route.js so it can be EXECUTED against
// fixtures (scripts/check-canvas-email.mjs) instead of read with a regex. The
// cron is the only caller; nothing here does I/O.
//
// ── The language, and why it is decided here ────────────────────────────────
//
// {{quoteTotal}} used to go through a local money() that printed "$" and
// English grouping whatever the company billed in and whatever language the
// quote was written in, and the "Quote/Invoice summary" block labelled it
// "Quote" in English. The rule is the one every other client send follows
// (lib/i18n/clientLanguage.js): the DOCUMENT's language when there is a
// document — the covering note matches the paper it covers — else the
// client's, else the company default. A lead's language is the one the
// homeowner filled the form in (LeadRequest.language), shaped into the client
// slot by the cron's finder.

import { getAppOrigin } from "@/lib/appUrl";
import { portalInvoiceUrl } from "@/lib/clientPortal";
import { resolveClientLanguage } from "@/lib/i18n/clientLanguage";
import { quoteTemplateLines, invoiceTemplateLines } from "@/lib/email/templateLineItems";
import { mergeFormatters } from "@/lib/email/templateMergeFields";

const DOCUMENT_ENTITIES = new Set(["quote", "invoice"]);

/** The language a follow-up for this entity is written in. */
export function followUpLanguage(entityType, entity) {
  return resolveClientLanguage({
    document: DOCUMENT_ENTITIES.has(entityType) ? entity : null,
    client: entity?.client,
    company: entity?.company,
  });
}

// The "Itemized list" block's input, for the two entities that ARE a
// document. It used to be a local normaliser over `entity.lineItems` that
// renamed stored lines into a shape (name/unitPrice/total) nothing else uses:
// on an invoice it printed "$"-and-English whatever the document's currency
// and language; on a quote it read a column the builder does not write, so
// the block was empty. Now the document's own grouping, language and
// currency, via lib/email/templateLineItems.js.
//
// A lead and a completed job have no document of their own — a job has no
// lines, and picking one of its quotes or invoices would be this function
// deciding which paper the email is "about". They get nothing, and the block
// renders nothing; the editor says which rules fill it.
function lineItemsFor(entityType, entity) {
  if (entityType === "quote") {
    return quoteTemplateLines({ quote: entity, scopeGroups: entity.scopeGroups, company: entity.company });
  }
  if (entityType === "invoice") {
    return invoiceTemplateLines({
      invoice: entity,
      scopeGroups: entity.quote?.scopeGroups || [],
      company: entity.company,
    });
  }
  return null;
}

// Which project-lifecycle stage a follow-up is sent at. Mirrors
// LIFECYCLE_STAGES in app/data/emailTemplateBlocks.js:
//   0 Quote · 1 Deposit & scheduling · 2 Project start · 3 Project complete
function stageFor(entityType, entity) {
  if (entityType === "quote") return 0;
  if (entityType === "invoice") {
    return Number(entity.amountPaid || 0) > 0 ? 1 : 0;
  }
  if (entityType === "job") {
    return entity.status === "completed" ? 3 : 2;
  }
  return 0;
}

/**
 * The {{token}} values for one entity.
 *
 * `portalToken` is resolved by the caller, not looked up here, so this stays
 * synchronous and pure. It is the client's portal token — minting one is a
 * WRITE, and a write does not belong inside a formatter.
 *
 * `language` is the caller's followUpLanguage(); passed rather than
 * re-derived so the tokens, the blocks' own labels and the built-in wording
 * of one email can never disagree.
 */
export function mergeDataFor(entityType, entity, request, portalToken, language = followUpLanguage(entityType, entity)) {
  const fmt = mergeFormatters({ language, currency: entity.company?.currency || null });
  const base = {
    clientName: entity.client?.contactName || entity.client?.name || "",
    clientAddress: entity.client?.address || "",
    clientPhone: entity.client?.phone || "",
    companyName: entity.company?.name || "",
    companyPhone: entity.company?.phone || "",
    companyEmail: entity.company?.email || "",
    progressStage: stageFor(entityType, entity),
    lineItems: lineItemsFor(entityType, entity),
    subtotal: fmt.money(entity.subtotal),
    discount: fmt.money(entity.discount),
    tax: fmt.money(entity.tax),
  };
  if (entityType === "quote") {
    return {
      ...base,
      quoteNumber: entity.quoteNumber,
      quoteTotal: fmt.money(entity.total),
      jobTitle: entity.quoteType || "",
      quoteUrl: entity.shareToken
        ? `${getAppOrigin(request)}/q/${entity.shareToken}`
        : "",
    };
  }
  if (entityType === "invoice") {
    const balanceDue = Number(entity.total || 0) - Number(entity.amountPaid || 0);
    return {
      ...base,
      invoiceNumber: entity.invoiceNumber,
      invoiceTotal: fmt.money(entity.total),
      amountPaid: fmt.money(entity.amountPaid),
      balanceDue: fmt.money(balanceDue),
      // documentFormatters' date: the document's language, read as UTC. This
      // was toLocaleDateString() with no arguments — the server's locale and
      // zone, so a due date of the 30th could print as "9/29/2026".
      dueDate: fmt.date(entity.dueDate),
      // The default "Payment received" template ships a "View your invoice"
      // button whose url is {{invoiceUrl}}, and nothing had ever supplied it.
      // mergeIntoAttr resolves an unknown token to "", so that button rendered
      // with an EMPTY href — a link to nowhere, in a homeowner's inbox, under
      // the contractor's brand. Deep-linked to the invoice rather than the
      // portal home for the reason portalInvoiceUrl's own comment gives: a
      // client landing on a list has to hunt for the thing they came to pay.
      invoiceUrl: portalToken ? portalInvoiceUrl(portalToken, entity.id, request) : "",
      projectStartDate: fmt.date(entity.startDate),
      projectEndDate: fmt.date(entity.endDate),
    };
  }
  if (entityType === "job") {
    return { ...base, jobTitle: entity.title };
  }
  if (entityType === "lead") {
    // No quote tokens: there is no quote yet, and a template that prints
    // the quote link on an enquiry renders an empty href. The settings page
    // says which fields a lead can fill (app.followFlow.leadFields).
    return { ...base, jobTitle: entity.category?.label || "" };
  }
  return base;
}
