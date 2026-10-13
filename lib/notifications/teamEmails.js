// lib/notifications/teamEmails.js
//
// What each team notice SAYS — one pure builder per notice, on the envelope in
// lib/email/teamNotice.js. The routes and crons that send them keep deciding
// WHO and WHEN; these decide the words, the facts card and the button, so a
// check can render every one of them in every language for every kind of
// reader without a database (scripts/check-team-notices.mjs).
//
// The sentences are the ones each notice already sent, now in the reader's
// language (lib/i18n/teamNoticeCopy.js). Amounts are formatted in the
// COMPANY's currency and the READER's locale (lib/format/money.js), which is
// the fix for the "$" every one of these hardcoded — a UK contractor's large
// quote alert said "$12,000" about a £12,000 quote.
//
// Every `url` is the exact record: /app/quotes/<id>, /app/invoices/<id>,
// /app/leads?lead=<id> (the leads board opens that lead's drawer —
// app/app/leads/page.js), /app/quotes/<id>/kitchen, /app/jobs/<id>,
// /app/tickets/<id>, /app/appointments?appointment=<id>.

import { buildTeamNotice, readerSeesMoney, noticeWhen } from "@/lib/email/teamNotice";
import { teamNoticeCopy } from "@/lib/i18n/teamNoticeCopy";
import { formatAppMoney } from "@/lib/format/money";

const base = (origin) => String(origin || "").replace(/\/+$/, "");
const str = (v) => (v === null || v === undefined ? "" : String(v).trim());

/**
 * The large-quote alert (app/api/cron/large-quote-check). An alert ABOUT an
 * amount: a reader who may not see money gets no letter at all (null).
 */
export function largeQuoteNotice({ language, company = {}, quote = {}, threshold, writtenBy = null, reader, origin }) {
  if (!readerSeesMoney(reader)) return null;
  const c = teamNoticeCopy(language);
  const money = (n) => formatAppMoney(n, company.currency, language);
  const client = str(quote.client?.name) || str(quote.clientName);
  const amount = money(quote.total);
  const limit = money(threshold);
  return buildTeamNotice({
    language,
    reader,
    origin,
    subject: c.largeQuote.subject(amount),
    heading: c.largeQuote.heading,
    sub: str(company.name) || null,
    intro: [c.largeQuote.intro(client, amount, limit)],
    facts: [
      { label: c.labels.client, value: client },
      { label: c.labels.quote, value: str(quote.quoteNumber) },
      { label: c.labels.quoteTotal, value: amount, money: true },
      { label: c.labels.threshold, value: limit, money: true },
      { label: c.labels.writtenBy, value: str(writtenBy) },
      { label: c.labels.created, value: noticeWhen(quote.createdAt, { timezone: company.timezone, language }) },
    ],
    cta: { url: `${base(origin)}/app/quotes/${quote.id}`, label: c.cta.quote },
    note: c.settingsNote,
    noteUrl: `${base(origin)}/app/settings/notifications`,
  });
}

/**
 * "Payment received" (lib/notifications/invoicePaymentNotice.js). About an
 * amount: null for a reader without money sight.
 *
 * @param methodLabel  the payment method in the reader's language, or null
 */
export function invoicePaidNotice({ language, company = {}, invoice = {}, amount, methodLabel = null, paidAt = null, reader, origin }) {
  if (!readerSeesMoney(reader)) return null;
  const c = teamNoticeCopy(language);
  const money = (n) => formatAppMoney(n, company.currency, language);
  const paid = money(amount || 0);
  const due = Number(invoice.amountDue || 0);
  const owing = due > 0.005;
  const client = str(invoice.client?.name) || c.invoicePaid.aClient;
  return buildTeamNotice({
    language,
    reader,
    origin,
    subject: c.invoicePaid.subject(invoice.invoiceNumber),
    heading: c.invoicePaid.heading,
    sub: str(company.name) || null,
    intro: [c.invoicePaid.intro(paid, invoice.invoiceNumber, client), owing ? c.invoicePaid.owing(money(due)) : c.invoicePaid.paidInFull],
    facts: [
      { label: c.labels.client, value: str(invoice.client?.name) },
      { label: c.labels.invoice, value: str(invoice.invoiceNumber) },
      { label: c.labels.amountPaid, value: paid, money: true },
      { label: c.labels.method, value: str(methodLabel) },
      owing
        ? { label: c.labels.stillOwing, value: money(due), money: true }
        : { label: c.labels.status, value: c.invoicePaid.paidInFullStatus },
      { label: c.labels.paidAt, value: noticeWhen(paidAt, { timezone: company.timezone, language }) },
    ],
    cta: { url: `${base(origin)}/app/invoices/${invoice.id}`, label: c.cta.invoice },
    note: c.settingsNote,
    noteUrl: `${base(origin)}/app/settings/notifications`,
  });
}

/**
 * A quote approved or declined, to the team (app/api/public/quotes/[token]).
 * A reader without money sight still hears that it happened — the subject
 * drops the extras figure, the card drops every amount, and the extras are
 * listed by name alone.
 *
 * @param priced     { total, extras, chosen: [{ description, amount }] } | null
 * @param plansTaken [{ name, pricePerVisit, discountPct }]
 */
export function quoteDecisionNotice({ language, company = {}, quote = {}, clientName = null, decision, priced = null, plansTaken = [], signedBy = null, decidedAt = null, reader, origin }) {
  const c = teamNoticeCopy(language);
  const d = c.decision;
  const seesMoney = readerSeesMoney(reader);
  const money = (n) => formatAppMoney(n, company.currency, language);
  const accepted = decision === "accepted";
  const client = str(clientName) || d.aClient;
  const number = str(quote.quoteNumber);
  const chosen = accepted && Array.isArray(priced?.chosen) ? priced.chosen : [];
  const tookExtras = chosen.length > 0;

  const subject = tookExtras && seesMoney
    ? d.subjectExtras(client, number, money(priced.extras))
    : accepted
      ? d.subjectApproved(client, number)
      : d.subjectDeclined(client, number);

  const sections = [];
  if (tookExtras) {
    sections.push({
      title: d.alsoAdded,
      rows: chosen.map((a) => (seesMoney
        ? { label: str(a.description), value: money(Number(a.amount)), money: true }
        : { label: str(a.description), labelOnly: true })),
    });
  }
  const plans = accepted && Array.isArray(plansTaken) ? plansTaken : [];
  if (plans.length) {
    sections.push({
      title: d.plansTitle(plans.length),
      rows: plans.map((o) => (seesMoney
        ? {
            label: str(o.name),
            value: [d.perVisit(money(Number(o.pricePerVisit))), ...(Number(o.discountPct) > 0 ? [d.offEveryVisit(Number(o.discountPct))] : [])].join(", "),
            money: true,
          }
        : { label: str(o.name), labelOnly: true })),
    });
  }

  return buildTeamNotice({
    language,
    reader,
    origin,
    subject,
    heading: accepted ? d.headingApproved : d.headingDeclined,
    sub: str(company.name) || null,
    intro: [accepted ? d.introApproved(client, number) : d.introDeclined(client, number)],
    facts: [
      { label: c.labels.client, value: str(clientName) },
      { label: c.labels.quote, value: number },
      ...(accepted && priced ? [{ label: c.labels.approvedTotal, value: money(priced.total), money: true }] : []),
      ...(accepted ? [{ label: c.labels.signedBy, value: str(signedBy) }] : []),
      { label: c.labels.decidedAt, value: noticeWhen(decidedAt, { timezone: company.timezone, language }) },
    ],
    sections,
    cta: { url: `${base(origin)}/app/quotes/${quote.id}`, label: c.cta.quote },
  });
}

/**
 * A client opened or replied to a ticket from their portal
 * (lib/clientTickets/service.js). The heading and the button are the
 * catalogue sentences the notice already used (app.clientTickets.email.*),
 * resolved by the caller in the reader's language and passed in.
 */
export function clientTicketNotice({ language, company = {}, ticket = {}, clientName = "", heading, ctaLabel, message = "", receivedAt = null, reader, origin }) {
  const c = teamNoticeCopy(language);
  const text = String(message || "");
  return buildTeamNotice({
    language,
    reader,
    origin,
    subject: heading,
    heading,
    sub: str(company.name) || null,
    // The client's own words, escaped — text a stranger typed, going into
    // staff's inbox — with their line breaks kept.
    bodyHtml: text
      ? text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/\n/g, "<br>")
      : "",
    bodyText: text,
    facts: [
      { label: c.labels.client, value: str(clientName) },
      { label: c.labels.subject, value: str(ticket.subject) },
      { label: c.labels.received, value: noticeWhen(receivedAt, { timezone: company.timezone, language }) },
    ],
    cta: { url: `${base(origin)}/app/tickets/${ticket.id}`, label: ctaLabel },
  });
}

/** A kitchen designed on the company's website (app/api/self-quote/kitchen). */
export function kitchenRequestNotice({ language, company = {}, lead = {}, name, cabinets = 0, finish = "", receivedAt = null, reader, origin }) {
  const c = teamNoticeCopy(language);
  return buildTeamNotice({
    language,
    reader,
    origin,
    subject: c.kitchen.subject(name),
    heading: c.kitchen.heading,
    sub: str(company.name) || null,
    intro: [c.kitchen.intro(name)],
    facts: [
      { label: c.labels.client, value: str(name) },
      { label: c.labels.cabinets, value: String(Number(cabinets) || 0) },
      { label: c.labels.finish, value: str(finish) },
      { label: c.labels.received, value: noticeWhen(receivedAt, { timezone: company.timezone, language }) },
    ],
    outro: [c.kitchen.next],
    cta: { url: `${base(origin)}/app/leads?lead=${encodeURIComponent(lead.id || "")}`, label: c.cta.request },
  });
}

/** A client saved their own version of a kitchen layout (app/api/kitchen-design/[token]). */
export function kitchenDesignSavedNotice({ language, company = {}, quote = {}, clientName = null, savedAt = null, reader, origin }) {
  const c = teamNoticeCopy(language);
  const when = noticeWhen(savedAt, { timezone: company.timezone, language });
  const client = str(clientName) || c.design.aClient;
  return buildTeamNotice({
    language,
    reader,
    origin,
    subject: c.design.subject(quote.quoteNumber),
    heading: c.design.heading,
    sub: str(company.name) || null,
    intro: [c.design.intro(client, quote.quoteNumber, when), c.design.next],
    facts: [
      { label: c.labels.client, value: str(clientName) },
      { label: c.labels.quote, value: str(quote.quoteNumber) },
      { label: c.labels.saved, value: when },
    ],
    cta: { url: `${base(origin)}/app/quotes/${quote.id}/kitchen`, label: c.cta.designer },
  });
}

/** An @mention on a job photo, when no crew-line text could reach the person (lib/photoComments/notify.js). */
export function photoMentionNotice({ language, company = {}, job = {}, authorName = null, reader, origin }) {
  const c = teamNoticeCopy(language);
  const author = str(authorName) || c.mention.someone;
  const where = str(job.client?.name) || str(job.title) || c.mention.aJob;
  return buildTeamNotice({
    language,
    reader,
    origin,
    subject: c.mention.subject(author),
    heading: c.mention.heading,
    sub: str(company.name) || null,
    intro: [c.mention.intro(author, where)],
    facts: [
      { label: c.labels.job, value: str(job.title) },
      { label: c.labels.client, value: str(job.client?.name) },
      { label: c.labels.mentionedBy, value: str(authorName) },
    ],
    cta: { url: `${base(origin)}/app/jobs/${job.id}`, label: c.cta.job },
  });
}
