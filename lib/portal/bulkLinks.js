// lib/portal/bulkLinks.js
//
// "Email clients their portal link" — the owner/admin action on the Clients
// page (owner, 2026-10-10). Each ELIGIBLE client gets the same email the
// client page's "Email portal link" sends (lib/portal/loginEmail.js, the
// office-sent wording), in their language, from the company.
//
// ── Who is eligible ────────────────────────────────────────────────────────
//
// All four, checked again in code after the query (a check runs this against
// a stub that ignores the where, the way scripts/check-client-portal.mjs
// proves loginLink.js):
//
//   1. the client belongs to THIS company;
//   2. a usable email address (normaliseLoginEmail — the same test the
//      website's Client login applies to what a visitor types);
//   3. not opted out: no Client.doNotContactAt ("don't contact me", set by a
//      callback outcome) and no MarketingSubscriber row for that address with
//      subscribed false (they clicked unsubscribe on this company's mail);
//   4. something OPEN with the company, by the real enums:
//        a quote whose QuoteStatus is `sent` or `accepted` and that has no
//        job in JobStatus `completed` or `cancelled`; or
//        a job whose JobStatus is neither `completed` nor `cancelled`.
//      Archived rows and past jobs entered after the fact
//      (historicalImportedAt) are not open work — they are filed history,
//      and a link about them is a letter about nothing.
//
// Then one exclusion: a client emailed a portal link (SentEmail kind
// "portal_link" — this action, or the client page's single send) in the last
// RECENT_LINK_DAYS days is skipped. That is also what makes a second press
// safe: whoever the first press reached is skipped by the second.
//
// ── Nothing sends by default ───────────────────────────────────────────────
//
// sendBulkPortalLinks is a DRY RUN unless the caller passes BOTH
// `dryRun: false` and `confirm: true`. A dry run reads only: it mints no
// token (the preview's link is a placeholder), sends nothing and writes no
// SentEmail row. The route answers GET with a dry run (the count and the
// preview the screen shows first) and sends only on a POST carrying
// confirm: true; scripts/portal-links-dry-run.mjs can only ever dry-run.

import { normaliseLoginEmail } from "@/lib/portal/view";
import { buildPortalLinkEmail } from "@/lib/portal/loginEmail";
import { ensurePortalToken } from "@/lib/clientPortal";
import { resolveClientLanguage } from "@/lib/i18n/clientLanguage";
import { recordSentEmail } from "@/lib/email/sentEmailHistory";

/** The SentEmail kind every portal-link email is kept under. */
export const PORTAL_LINK_KIND = "portal_link";

/** A client emailed a portal link more recently than this is skipped. */
export const RECENT_LINK_DAYS = 30;

/** At most this many emails per press. More eligible → press again; the
 *  recent-link exclusion means the second press starts where this one ended. */
export const BULK_BATCH = 150;

/** Resend's default ceiling is two requests a second; one every 600ms stays
 *  under it with room for the SentEmail write between. */
export const SEND_SPACING_MS = 600;

export const ACTIVE_QUOTE_STATUSES = Object.freeze(["sent", "accepted"]);
export const CLOSED_JOB_STATUSES = Object.freeze(["completed", "cancelled"]);

const DAY = 24 * 60 * 60 * 1000;

/** The placeholder a dry run puts where a client's real link will go. */
export const DRY_RUN_LINK = "/portal/<link minted on send>";

// Each row is re-checked against the CLIENT and the company it is filed
// under, not only its status: a relation query that came back wider than
// asked (another household's job, another company's quote) must not make
// this client eligible. scripts/check-portal-account-links.mjs runs these
// against a stub that ignores every where clause.
const isOpenJob = (j, client, companyId) =>
  Boolean(j) &&
  j.companyId === companyId &&
  j.clientId === client.id &&
  !CLOSED_JOB_STATUSES.includes(j.status) &&
  !j.archivedAt &&
  !j.historicalImportedAt;

const isOpenQuote = (q, client, companyId) =>
  Boolean(q) &&
  q.companyId === companyId &&
  q.clientId === client.id &&
  ACTIVE_QUOTE_STATUSES.includes(q.status) &&
  !q.archivedAt &&
  !q.historicalImportedAt &&
  !(Array.isArray(q.jobs) ? q.jobs : []).some((j) => j?.quoteId === q.id && CLOSED_JOB_STATUSES.includes(j?.status));

/**
 * One client's answer. Pure.
 *
 * @param client        { id, companyId, name, email, doNotContactAt, quotes: [{ id, companyId, clientId, quoteNumber, status, archivedAt, historicalImportedAt, jobs: [{ quoteId, status }] }], jobs: [{ id, companyId, clientId, title, status, archivedAt, historicalImportedAt }] }
 * @param unsubscribed  Set of lower-cased addresses that unsubscribed from this company
 * @param recentlySent  Set of client ids emailed a portal link inside the window
 * @returns {{ eligible: true, email, why: Array<{ kind, label }> } | { eligible: false, skip }}
 *          skip: "other_company" | "no_email" | "opted_out" | "inactive" | "recent"
 */
export function classifyClient(client, { companyId, unsubscribed = new Set(), recentlySent = new Set() } = {}) {
  if (!client || !companyId || client.companyId !== companyId) return { eligible: false, skip: "other_company" };
  const email = normaliseLoginEmail(client.email);
  if (!email) return { eligible: false, skip: "no_email" };
  if (client.doNotContactAt || unsubscribed.has(email)) return { eligible: false, skip: "opted_out" };

  const why = [];
  for (const j of Array.isArray(client.jobs) ? client.jobs : []) {
    if (isOpenJob(j, client, companyId)) why.push({ kind: "job", id: j.id, label: j.title || "", status: j.status });
  }
  for (const q of Array.isArray(client.quotes) ? client.quotes : []) {
    if (isOpenQuote(q, client, companyId)) why.push({ kind: "quote", id: q.id, label: q.quoteNumber || "", status: q.status });
  }
  if (why.length === 0) return { eligible: false, skip: "inactive" };
  if (recentlySent.has(client.id)) return { eligible: false, skip: "recent" };
  return { eligible: true, email, why };
}

/**
 * Every client of the company, sorted into who gets the email and why the
 * rest don't. Reads only.
 *
 * @returns {{ recipients: Array<{ id, name, email, language, why }>, skipped: Record<string, number>, total: number, windowDays: number }}
 */
export async function eligiblePortalRecipients(db, { companyId, now = new Date(), windowDays = RECENT_LINK_DAYS } = {}) {
  const skipped = { no_email: 0, opted_out: 0, inactive: 0, recent: 0, other_company: 0 };
  if (!companyId) return { recipients: [], skipped, total: 0, windowDays };

  const clients = await db.client.findMany({
    where: { companyId },
    orderBy: [{ name: "asc" }, { id: "asc" }],
    select: {
      id: true,
      companyId: true,
      name: true,
      email: true,
      language: true,
      doNotContactAt: true,
      quotes: {
        where: { companyId, status: { in: [...ACTIVE_QUOTE_STATUSES] }, archivedAt: null, historicalImportedAt: null },
        select: { id: true, companyId: true, clientId: true, quoteNumber: true, status: true, archivedAt: true, historicalImportedAt: true, jobs: { select: { quoteId: true, status: true } } },
      },
      jobs: {
        where: { companyId, status: { notIn: [...CLOSED_JOB_STATUSES] }, archivedAt: null, historicalImportedAt: null },
        select: { id: true, companyId: true, clientId: true, title: true, status: true, archivedAt: true, historicalImportedAt: true },
      },
    },
  });

  const emails = [...new Set(clients.map((c) => normaliseLoginEmail(c.email)).filter(Boolean))];
  const [subs, recent] = await Promise.all([
    emails.length
      ? db.marketingSubscriber.findMany({
          where: { companyId, subscribed: false },
          select: { email: true, companyId: true, subscribed: true },
        })
      : [],
    db.sentEmail.findMany({
      where: { companyId, kind: PORTAL_LINK_KIND, createdAt: { gte: new Date(now.getTime() - windowDays * DAY) } },
      select: { clientId: true, companyId: true, kind: true, createdAt: true },
    }),
  ]);
  const unsubscribed = new Set(
    subs.filter((s) => s.companyId === companyId && s.subscribed === false).map((s) => String(s.email || "").trim().toLowerCase()),
  );
  const since = now.getTime() - windowDays * DAY;
  const recentlySent = new Set(
    recent
      .filter((r) => r.companyId === companyId && r.kind === PORTAL_LINK_KIND && r.clientId && new Date(r.createdAt).getTime() >= since)
      .map((r) => r.clientId),
  );

  const recipients = [];
  for (const client of clients) {
    const verdict = classifyClient(client, { companyId, unsubscribed, recentlySent });
    if (!verdict.eligible) {
      skipped[verdict.skip] = (skipped[verdict.skip] || 0) + 1;
      continue;
    }
    recipients.push({ id: client.id, name: client.name || "", email: client.email.trim(), language: client.language || null, why: verdict.why });
  }
  return { recipients, skipped, total: clients.length, windowDays };
}

/**
 * The email one recipient would get. Pure; `url` is theirs, or the dry-run
 * placeholder.
 */
export function portalLinkEmailFor({ company, recipient, url }) {
  const language = resolveClientLanguage({ client: recipient, company });
  const mail = buildPortalLinkEmail({ company, client: recipient, url, language, requested: false });
  return { ...mail, language };
}

const pauseFor = (ms) => new Promise((r) => setTimeout(r, ms));

/**
 * The tool. A DRY RUN unless `dryRun: false` AND `confirm: true`.
 *
 * @param company   the company row (SENDER_SELECT + logoUrl, brandColor,
 *                  phone, defaultLanguage), read under companyId by the caller
 * @param linkFor   (token) => absolute portal URL
 * @param send      sendEmail, injectable
 * @param resolveSender  lib/email/companySender resolveSender, injectable
 * @param expected  optional: the recipient count the person was shown. If the
 *                  list changed since (a client added, a send from another
 *                  tab), nothing is sent and the caller re-previews — a
 *                  confirm is for the list that was on screen.
 * @returns dry run:  { dryRun: true, recipients, skipped, total, windowDays, batch, sample }
 *          send:     { dryRun: false, attempted, sent, failed, remaining, results }
 *          refused:  { refused: "not_confirmed" | "list_changed" | "no_company", ... }
 */
export async function sendBulkPortalLinks({
  db,
  companyId,
  company,
  linkFor,
  dryRun = true,
  confirm = false,
  expected = null,
  now = new Date(),
  windowDays = RECENT_LINK_DAYS,
  batch = BULK_BATCH,
  send = null,
  resolveSender = null,
  sentByUserId = null,
  sentByName = null,
  pause = pauseFor,
  spacingMs = SEND_SPACING_MS,
} = {}) {
  if (!companyId || !company) return { refused: "no_company" };
  const list = await eligiblePortalRecipients(db, { companyId, now, windowDays });
  const toSend = list.recipients.slice(0, batch);

  if (dryRun !== false) {
    const first = toSend[0] || null;
    const sample = first
      ? { name: first.name, to: first.email, ...portalLinkEmailFor({ company, recipient: first, url: DRY_RUN_LINK }) }
      : null;
    return { dryRun: true, ...list, batch: toSend.length, sample };
  }

  // Past here, a real send. Both switches, or nothing.
  if (confirm !== true) return { refused: "not_confirmed", dryRun: false };
  if (expected != null && Number(expected) !== toSend.length) {
    return { refused: "list_changed", dryRun: false, now: toSend.length };
  }
  if (typeof send !== "function" || typeof resolveSender !== "function" || typeof linkFor !== "function") {
    return { refused: "no_sender", dryRun: false };
  }

  const { from, replyTo } = await resolveSender(company, companyId);
  const results = [];
  let sent = 0;
  let failed = 0;
  for (let i = 0; i < toSend.length; i++) {
    const r = toSend[i];
    if (i > 0 && spacingMs > 0) await pause(spacingMs);
    const token = await ensurePortalToken(db, r.id, companyId).catch(() => null);
    if (!token) {
      failed += 1;
      results.push({ id: r.id, ok: false, error: "no_token" });
      continue;
    }
    const mail = portalLinkEmailFor({ company, recipient: r, url: linkFor(token) });
    let result = await send({ companyId, from, replyTo, to: r.email, subject: mail.subject, html: mail.html, text: mail.text, clientMail: true }).catch((err) => ({ error: err?.message || "send failed" }));
    // One patient retry on a rate-limit answer, never more: a second refusal
    // is a reason to stop pressing, and the person can press again later.
    if (result?.error && /rate|too many/i.test(String(result.error?.message || result.error))) {
      await pause(1500);
      result = await send({ companyId, from, replyTo, to: r.email, subject: mail.subject, html: mail.html, text: mail.text, clientMail: true }).catch((err) => ({ error: err?.message || "send failed" }));
    }
    if (!result || result.error || result.skipped) {
      failed += 1;
      results.push({ id: r.id, ok: false, error: result?.skipped ? "email_not_configured" : String(result?.error?.message || result?.error || "send failed").slice(0, 200) });
      // Unconfigured mail fails every row the same way; stop rather than
      // walk the whole list to say so 150 times.
      if (result?.skipped) break;
      continue;
    }
    sent += 1;
    results.push({ id: r.id, ok: true });
    await recordSentEmail(db, {
      companyId,
      kind: PORTAL_LINK_KIND,
      clientId: r.id,
      mail: { to: r.email, from, replyTo, subject: mail.subject, html: mail.html, text: mail.text },
      result,
      sentByUserId,
      sentByName,
      language: mail.language,
      now: new Date(),
    });
  }
  return {
    dryRun: false,
    attempted: results.length,
    sent,
    failed,
    remaining: Math.max(0, list.recipients.length - sent),
    results,
  };
}
