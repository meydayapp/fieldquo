// lib/email/dataDeletionEmail.js
//
// The three emails a data-deletion request produces: the receipt to the
// person who asked, the notice to FieldQuo's own inbox, and the completion
// notice once the owner has done the deletion by hand.
//
// ── FieldQuo's own mail, not a tenant's ──────────────────────────────────
//
// From is the platform sender (getPlatformFrom — discovered, not configured)
// and no companyId is passed, so lib/email/resend.js's demo interception never
// fires: a deletion request is FieldQuo talking to a person about FieldQuo,
// whichever contractor's records it concerns. The white-label rule does not
// apply — this is the one relationship where "FieldQuo" in the From line is
// the truth the reader needs.
//
// ── Why not buildPlatformNotice ──────────────────────────────────────────
//
// lib/email/billingEmail.js's shell signs off "you're receiving this because
// you manage this company's billing", which is false for a homeowner who has
// never heard of FieldQuo and asked us to forget them. The layout is borrowed;
// the footer says what is true here.
//
// ── The builders are pure ────────────────────────────────────────────────
//
// They take a row and return { subject, html, text } so
// scripts/check-data-deletion.mjs can execute them and assert the reference,
// the date and "30 business days" are in the message, and that a name typed
// as markup is escaped rather than rendered.

import { escapeHtml } from "@/lib/email/emailTheme";
import { sendEmail } from "@/lib/email/resend";
import { getPlatformFrom } from "@/lib/email/platformSender";
import { SUPPORT_EMAIL } from "@/lib/supportContact";
import { formatLegalDate } from "@/lib/legal/effectiveDates";
import { DELETION_BUSINESS_DAYS } from "@/lib/dataDeletion/requests";

const INK = "#111827";
const MUTED = "#4b5563";
const FAINT = "#595f6b";

/** "September 8, 2026" — the same fixed form the legal pages use, in UTC. */
export function formatRequestDate(date) {
  const d = date instanceof Date ? date : new Date(date);
  if (Number.isNaN(d.getTime())) return "";
  return formatLegalDate(d.toISOString().slice(0, 10));
}

function shell({ heading, sub, body, footer }) {
  return `<!DOCTYPE html>
<html>
  <head><meta charset="utf-8" /><meta name="viewport" content="width=device-width,initial-scale=1" /></head>
  <body style="margin:0;padding:0;background:#f5f5f5;font-family:Arial,Helvetica,sans-serif;color:${INK};">
    <div style="max-width:560px;margin:0 auto;">
      <div style="background:${INK};color:#ffffff;padding:32px 30px;text-align:center;">
        <h1 style="margin:0;font-size:22px;font-weight:700;">${escapeHtml(heading)}</h1>
        ${sub ? `<p style="margin:8px 0 0 0;opacity:0.85;font-size:14px;">${escapeHtml(sub)}</p>` : ""}
      </div>
      <div style="background:#ffffff;padding:32px 30px;">
        ${body}
      </div>
      <div style="text-align:center;padding:20px;color:${FAINT};font-size:12px;">
        ${escapeHtml(footer)}
      </div>
    </div>
  </body>
</html>`;
}

const p = (html) => `<p style="font-size:15px;line-height:1.7;margin:0 0 16px 0;">${html}</p>`;

function facts(pairs) {
  const rows = pairs
    .filter(([, v]) => v !== null && v !== undefined && String(v).trim() !== "")
    .map(
      ([l, v]) => `<tr>
    <td style="padding:8px 0;font-size:14px;color:${MUTED};vertical-align:top;">${escapeHtml(l)}</td>
    <td style="padding:8px 0;font-size:14px;font-weight:700;text-align:right;vertical-align:top;white-space:pre-wrap;">${escapeHtml(v)}</td>
  </tr>`,
    )
    .join("");
  return rows
    ? `<table role="presentation" width="100%" style="border-collapse:collapse;margin:0 0 8px 0;border-top:1px solid #e5e7eb;">${rows}</table>`
    : "";
}

/**
 * To the requester: we have it, here is your reference, here is what happens.
 * The sentence about "manually" is not decoration — it is the owner's stated
 * process and the reason the email cannot promise a date sooner than the
 * business-day window.
 */
export function buildDeletionAcknowledgement(row) {
  const date = formatRequestDate(row.receivedAt);
  const code = row.confirmationCode;
  const subject = `We received your data deletion request (${code})`;
  const html = shell({
    heading: "Data deletion request received",
    sub: `Reference ${code}`,
    body:
      p(
        `We received your request on <strong>${escapeHtml(date)}</strong>. Your reference is <strong>${escapeHtml(code)}</strong> — please quote it if you write to us about this request.`,
      ) +
      p(
        `FieldQuo's owner will delete the data manually within <strong>${DELETION_BUSINESS_DAYS} business days</strong> and confirm by email when it is done. Deletion is carried out by a person, not an automated process, which is why it is not instant.`,
      ) +
      p(
        `If we need to confirm who you are before deleting anything, we will reply to this address. Nothing is deleted on the strength of a request we cannot place.`,
      ) +
      facts([
        ["Reference", code],
        ["Received", date],
        ["Name", row.name],
        ["Company the records concern", row.companyName],
      ]),
    footer: `FieldQuo · you're receiving this because a data deletion request was made for ${row.email}. Questions: ${SUPPORT_EMAIL}`,
  });
  const text =
    `We received your data deletion request on ${date}.\n` +
    `Reference: ${code}\n\n` +
    `FieldQuo's owner will delete the data manually within ${DELETION_BUSINESS_DAYS} business days and confirm by email when it is done.\n\n` +
    `Questions: ${SUPPORT_EMAIL}`;
  return { subject, html, text };
}

/**
 * To FieldQuo's own inbox: who asked, what they said, the reference. Every
 * field was typed by a stranger and is escaped — this mail is read by the
 * person deciding what to delete, and a message containing a link must render
 * as text, not as our own control.
 */
export function buildDeletionNotice(row) {
  const date = formatRequestDate(row.receivedAt);
  const code = row.confirmationCode;
  const sourceLabel =
    row.source === "meta_callback"
      ? "Meta data deletion callback (the person removed the FieldQuo app on Facebook)"
      : row.source === "email"
        ? "Registered from an email"
        : "The /data-deletion form";
  const subject = `Data deletion request ${code}`;
  const html = shell({
    heading: "New data deletion request",
    sub: `Reference ${code}`,
    body:
      p(
        `A data deletion request arrived on <strong>${escapeHtml(date)}</strong>. The requester has been told the deletion is done manually within ${DELETION_BUSINESS_DAYS} business days. Mark it completed in the platform console once it is done — that is what sends them the confirmation.`,
      ) +
      facts([
        ["Reference", code],
        ["Source", sourceLabel],
        ["Email", row.email],
        ["Name", row.name],
        ["Company named", row.companyName],
        ["Meta user id", row.metaUserId],
        ["Message", row.message],
      ]),
    footer: "FieldQuo · internal notice to the support inbox.",
  });
  const text =
    `Data deletion request ${code} (${sourceLabel})\n` +
    `Received: ${date}\n` +
    `Email: ${row.email}\n` +
    (row.name ? `Name: ${row.name}\n` : "") +
    (row.companyName ? `Company named: ${row.companyName}\n` : "") +
    (row.metaUserId ? `Meta user id: ${row.metaUserId}\n` : "") +
    (row.message ? `\n${row.message}\n` : "");
  return { subject, html, text };
}

/** To the requester, once the owner has pressed "Mark completed". */
export function buildDeletionCompleted(row) {
  const date = formatRequestDate(row.completedAt);
  const code = row.confirmationCode;
  const subject = `Your data was deleted (${code})`;
  const html = shell({
    heading: "Your data was deleted",
    sub: `Reference ${code}`,
    body:
      p(
        `Your data was deleted on <strong>${escapeHtml(date)}</strong>, reference <strong>${escapeHtml(code)}</strong>.`,
      ) +
      p(
        `This was done by hand by FieldQuo's owner. Anything we were required to keep — an invoice, a payment record, an opt-out you gave — was described on our data deletion page and is retained for that reason only.`,
      ) +
      facts([
        ["Reference", code],
        ["Completed", date],
      ]),
    footer: `FieldQuo · this closes data deletion request ${code}. Questions: ${SUPPORT_EMAIL}`,
  });
  const text =
    `Your data was deleted on ${date}, reference ${code}.\n\n` +
    `Questions: ${SUPPORT_EMAIL}`;
  return { subject, html, text };
}

/**
 * Sends one of the above under FieldQuo's platform sender.
 *
 * Returns sendEmail's own result rather than throwing: `{ error }` on a
 * Resend refusal, `{ skipped: true }` with no key. The routes turn those into
 * an honest response — a request that was recorded but whose receipt did not
 * go out says so, and never reads as a success.
 */
export async function sendDataDeletionEmail({ to, subject, html, text }) {
  const from = await getPlatformFrom();
  return sendEmail({ from, to, subject, html, text, replyTo: SUPPORT_EMAIL });
}
