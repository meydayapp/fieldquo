// lib/jobs/changeOrderSend.js
//
// "Send for approval": the homeowner gets a link to the change order's
// one-page addendum (app/co/[token]) by email and, when they have a phone we
// may text, by SMS. The database half — mint the token, send, record what
// actually went out, put the change order and its step into waiting.
//
// ── Sent means accepted by a carrier ───────────────────────────────────────
//
// `sentAt`/`sentVia` are written only after at least one channel ACCEPTED the
// message — the same rule Invoice.sentAt keeps ("stamped only after Resend
// accepts the email, never by a button that merely changes a word"). A send
// where both channels failed leaves the row exactly as it was, with the
// reasons returned to the screen, so "Waiting on client approval" is never
// shown for a link nobody received.
//
// ── Which channels ─────────────────────────────────────────────────────────
//
// Email always, when the client has an address. SMS when they have a phone,
// the company asked for it, and lib/sms/optOut.js says we may — the same
// gate every client text in this codebase passes through. The from-number is
// the company's own when it has one, else the shared line
// (lib/sms/clientLine.js), so a STOP filed against it lands on the right
// tenant. A demo tenant's text is simulated, not sent (lib/sms/demoSms.js).
//
// Cost: one Resend email and, when texted, one Twilio SMS per send. Both are
// explicit staff actions on one change order — nothing here runs on a
// schedule or fans out.
//
// ── Language ───────────────────────────────────────────────────────────────
//
// The quote's language wins, then the client's, then the company's
// (lib/i18n/clientLanguage.js): the addendum is an addition to a signed
// document and must read in that document's language (AGENTS.md #6).

import { randomBytes } from "crypto";
import { db } from "@/lib/db";
import { getAppOrigin } from "@/lib/appUrl";
import { sendEmail, SENDER_SELECT } from "@/lib/email/resend";
import { resolveSender } from "@/lib/email/companySender";
import { sendOutcome } from "@/lib/email/sendFailure";
import { documentEmailHtml, emailButton, amountBlock, escapeHtml, EMAIL_FONT } from "@/lib/email/documentEmailLayout";
import { documentTheme, fillPair } from "@/lib/documents/theme";
import { documentFormatters } from "@/lib/i18n/documentLabels";
import { clientDocCopy } from "@/lib/i18n/clientDocCopy";
import { resolveClientLanguage } from "@/lib/i18n/clientLanguage";
import { sendSms, toE164 } from "@/lib/sms/twilioClient";
import { maySms } from "@/lib/sms/optOut";
import { clientSmsFrom } from "@/lib/sms/clientLine";
import { changeOrderLabel, changeOrderBodyText } from "@/lib/jobs/changeOrderAddendum";
import { applyChangeOrderDecision } from "@/lib/jobs/changeOrderDecision";
import { recordActivity } from "@/lib/activity/log";

export function changeOrderPublicUrl(token, request) {
  return `${getAppOrigin(request)}/co/${token}`;
}

/** The covering email. Exported so the check script can render it. */
export function buildChangeOrderEmail({ changeOrder, label, client, company, quote, url, language = "en" }) {
  const copy = clientDocCopy(language).changeOrder;
  const theme = documentTheme(company);
  const fill = fillPair(theme);
  const { money } = documentFormatters(language, company?.currency);
  const delta = Number(changeOrder.priceDelta) || 0;
  const signed = `${delta > 0 ? "+" : ""}${money(delta)}`;
  const bodyText = changeOrderBodyText(changeOrder.bodyHtml);

  const intro = copy.emailIntro(client?.name || "", label, quote?.quoteNumber || "");
  const body = `
              <p style="margin:0 0 16px;font-size:15px;line-height:1.6;">${escapeHtml(intro)}</p>
              <p style="margin:0 0 12px;font-size:15px;line-height:1.6;font-weight:700;">${escapeHtml(changeOrder.description)}</p>
              ${bodyText ? `<p style="margin:0 0 18px;font-size:14px;line-height:1.6;color:${theme.inkMuted};white-space:pre-line;">${escapeHtml(bodyText)}</p>` : ""}
              ${amountBlock({ theme, label: escapeHtml(copy.thisChange.toUpperCase()), amount: escapeHtml(signed) })}
              ${emailButton({ url, label: escapeHtml(copy.emailButton), fill })}
              <p style="margin:18px 0 0;font-size:12px;line-height:1.6;color:${theme.inkMuted};font-family:${EMAIL_FONT};">${escapeHtml(copy.emailFooter)}</p>`;

  const html = documentEmailHtml({
    company,
    theme,
    fill,
    label: copy.kicker,
    reference: label,
    body,
    footerNote: quote?.quoteNumber ? escapeHtml(copy.toQuote(quote.quoteNumber)) : "",
  });
  const text = [intro, "", changeOrder.description, bodyText, "", `${copy.thisChange}: ${signed}`, "", `${copy.emailButton}: ${url}`, "", copy.emailFooter]
    .filter((l) => l !== null && l !== undefined)
    .join("\n");
  return { subject: copy.emailSubject(label, company?.name || ""), html, text };
}

const CO_SEND_SELECT = {
  id: true,
  seq: true,
  createdAt: true,
  description: true,
  bodyHtml: true,
  priceDelta: true,
  status: true,
  shareToken: true,
  taskId: true,
  invoiceId: true,
  job: {
    select: {
      id: true,
      companyId: true,
      client: { select: { id: true, name: true, email: true, phone: true, language: true } },
      quote: { select: { id: true, quoteNumber: true, language: true } },
      company: {
        select: {
          ...SENDER_SELECT,
          id: true,
          name: true,
          logoUrl: true,
          brandColor: true,
          phone: true,
          email: true,
          website: true,
          currency: true,
          defaultLanguage: true,
          smsFromNumber: true,
          taxIdName: true,
          taxIdNumber: true,
        },
      },
    },
  },
};

/**
 * @param {object} args
 * @param {string} args.changeOrderId
 * @param {object} args.member  the staff member sending (companyId, userId, id, role)
 * @param {Request} args.request  for the public origin
 * @param {{ sms?: boolean, email?: boolean }} [args.channels]
 * @returns {{ ok, sentVia, status, url, errors: string[] }}
 */
export async function sendChangeOrderToClient({ changeOrderId, member, request, channels = {} }) {
  const wantEmail = channels.email !== false;
  const wantSms = channels.sms !== false;
  const errors = [];

  const co = await db.changeOrder.findFirst({
    where: { id: changeOrderId, job: { companyId: member.companyId } },
    select: CO_SEND_SELECT,
  });
  if (!co) return { ok: false, errors: ["Not found"], status: 404 };
  if (co.status === "approved" || co.status === "rejected") {
    return { ok: false, errors: ["This change order has already been decided — there is nothing left to sign."], status: 409 };
  }
  if (co.invoiceId) {
    return { ok: false, errors: ["This change order is already on an invoice."], status: 409 };
  }

  const client = co.job.client;
  const company = co.job.company;
  const quote = co.job.quote;
  const email = String(client?.email || "").trim();
  const phone = String(client?.phone || "").trim();
  if (!email && !phone) {
    return { ok: false, errors: ["The client has no email address or phone number on file."], status: 409 };
  }

  // Mint once; a resend reuses the link the client already has.
  let token = co.shareToken;
  if (!token) {
    token = randomBytes(32).toString("base64url");
    await db.changeOrder.update({ where: { id: co.id }, data: { shareToken: token } });
  }
  const url = changeOrderPublicUrl(token, request);
  const language = resolveClientLanguage({ document: quote, client, company });
  const allRows = await db.changeOrder.findMany({ where: { jobId: co.job.id }, select: { id: true, seq: true, createdAt: true } });
  const label = changeOrderLabel(co, allRows);
  const copy = clientDocCopy(language).changeOrder;

  const via = [];

  if (wantEmail && email) {
    try {
      const { subject, html, text } = buildChangeOrderEmail({ changeOrder: co, label, client, company, quote, url, language });
      const { from, replyTo } = await resolveSender(company, company.id);
      const result = await sendEmail({ companyId: company.id, to: email, subject, html, text, from, replyTo });
      // sendOutcome reads { id } / { skipped } / { error } the one way every
      // send route reads them — a { skipped } from a deployment with no mail
      // key is a failure here, not a send.
      const outcome = sendOutcome(result);
      if (outcome.ok) via.push("email");
      else errors.push(outcome.message);
    } catch (err) {
      errors.push(`Email: ${err?.message || "failed"}`);
    }
  } else if (wantEmail && !email) {
    errors.push("No email address on the client record.");
  }

  if (wantSms && phone) {
    try {
      if (!toE164(phone)) {
        errors.push("The client's phone number could not be read as a mobile number.");
      } else if (!(await maySms({ companyId: company.id, phone }))) {
        errors.push("This number has opted out of texts.");
      } else {
        const result = await sendSms({
          to: phone,
          from: clientSmsFrom(company),
          companyId: company.id,
          body: copy.smsText(company.name, label, url),
          purpose: "change_order",
          ref: { type: "change_order", id: co.id },
          clientId: client?.id || null,
        });
        if (result?.success) via.push("sms");
        else errors.push(result?.error || "The text was not accepted.");
      }
    } catch (err) {
      errors.push(`SMS: ${err?.message || "failed"}`);
    }
  } else if (wantSms && !phone) {
    errors.push("No phone number on the client record.");
  }

  if (!via.length) return { ok: false, errors, status: 502, url };

  const previous = co.status;
  const updated = await db.changeOrder.update({
    where: { id: co.id },
    data: {
      status: "waiting_client",
      sentAt: new Date(),
      sentVia: via.join("+"),
      // Out with the client means nobody on staff has decided it.
      decidedAt: null,
      decidedById: null,
    },
    select: { id: true, status: true, sentAt: true, sentVia: true },
  });
  await applyChangeOrderDecision(co.id, "waiting_client", { byUserId: member.userId, previousStatus: previous });

  await recordActivity(member, {
    action: "change_order.sent",
    entityType: "job",
    entityId: co.job.id,
    summary: `Change order ${label} sent to ${client?.name || "the client"} for approval by ${via.join(" and ")}`,
    metadata: { changeOrderId: co.id, via, url },
  });

  return { ok: true, sentVia: updated.sentVia, status: updated.status, sentAt: updated.sentAt, url, errors };
}
