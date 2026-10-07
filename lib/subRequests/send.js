// lib/subRequests/send.js
//
// Sending a price request (or its one reminder) to one sub: build the email
// from the allow-listed view (model.js subFacingRequest → email.js), send it
// from the GC's company (resolveSender), and stamp the recipient only once
// the mail provider accepted it. The I/O half of lib/subRequests/ — kept out
// of server.js so that file stays runnable against an in-memory database.

import { db } from "@/lib/db";
import { sendEmail } from "@/lib/email/resend";
import { resolveSender } from "@/lib/email/companySender";
import { resolveClientLanguage } from "@/lib/i18n/clientLanguage";
import { buildPriceRequestEmail } from "@/lib/subRequests/email";
import { loadRecipientByToken, markSent, viewForRecipient } from "@/lib/subRequests/server";
import { priceRequestPath } from "@/lib/subRequests/model";

/** The four links the email carries, absolute. */
export function priceRequestUrls(origin, token) {
  const page = `${origin}${priceRequestPath(token)}`;
  const path = priceRequestPath(token);
  return {
    page,
    login: `${origin}/login?next=${encodeURIComponent(path)}`,
    // Through the page's own signup hop, which leaves the way-back cookie
    // and opens /signup prefilled (app/price-request/[token]/signup).
    signup: `${page}/signup`,
    reply: `${page}#reply`,
  };
}

function dateFormatter(language) {
  return (iso) => {
    try {
      return new Intl.DateTimeFormat(language, { dateStyle: "long", timeZone: "UTC" }).format(new Date(`${iso}T12:00:00Z`));
    } catch {
      return iso;
    }
  };
}

/**
 * @returns {{ ok: boolean, error?: string, skipped?: boolean }}
 */
export async function sendPriceRequestEmail({ recipientId, origin, reminder = false }) {
  const row = await db.subPriceRequestRecipient.findUnique({ where: { id: recipientId }, select: { token: true } });
  if (!row) return { ok: false, error: "not_found" };
  const r = await loadRecipientByToken(db, row.token);
  const to = String(r?.subcontractor?.email || "").trim();
  if (!r || !to.includes("@")) return { ok: false, error: "no_email" };
  const gcCompany = r.request.company;
  const language = resolveClientLanguage({ company: gcCompany });
  const view = viewForRecipient(r);
  const mail = buildPriceRequestEmail({
    view,
    gcCompany,
    subName: r.subcontractor?.contactName || "",
    urls: priceRequestUrls(origin, r.token),
    language,
    reminder,
    formatDate: dateFormatter(language),
  });
  const { from, replyTo } = await resolveSender(gcCompany, gcCompany.id);
  const result = await sendEmail({
    to,
    from,
    replyTo,
    subject: mail.subject,
    html: mail.html,
    text: mail.text,
    companyId: gcCompany.id,
  });
  if (result?.skipped) return { ok: false, skipped: true, error: "Email isn't configured on this deployment." };
  if (result?.error) return { ok: false, error: typeof result.error === "string" ? result.error : result.error?.message || "send failed" };
  // A reminder's stamp was claimed before the send (runPriceRequestReminders).
  if (!reminder) await markSent(db, { recipientId: r.id, email: to });
  return { ok: true };
}
