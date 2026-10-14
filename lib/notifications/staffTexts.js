// lib/notifications/staffTexts.js
//
// The text messages — and the new alert emails — a company's OWN staff get
// about a client event, for the people who asked for them in Settings ›
// Notifications (lib/notifications/clientAlerts.js decides who; this sends).
// Called by notifyEvent only after the feed row exists, never throws, and is
// loaded lazily so Twilio and Resend stay off the import graph of every route
// that merely writes a bell row.
//
// ══ Texts: FieldQuo's number, FieldQuo's bill ═════════════════════════════
//
// From the system number (lib/sms/systemNumber.js) — the number the urgent
// on-call texts (lib/aiEmployee/urgentAlerts.js) already reach staff from —
// never the company's brought business number, whose texts are metered to
// the company (lib/businessNumber/meter.js) and are its CLIENT channel.
// Nothing is debited from the company's phone & text credit: the brief for
// this feature is that FieldQuo pays for these. Every text, sent or not, is a
// StaffAlertText row, and the daily cap is a count over those rows.
//
// The phone is the member's own Member.phone — the number Settings › Team
// already holds for them, which they can now set themselves from Settings ›
// Notifications. Entered, not verified: see the report for that decision.
//
// ══ What the text may say ═════════════════════════════════════════════════
//
// The fan-out already refused a money type to anybody without showPricing.
// The amount is still formatted per reader through amountForReader, so a
// text can never carry a figure its reader could not open in the app.

import { db as defaultDb } from "@/lib/db";
import { sendSms, toE164 } from "@/lib/sms/twilioClient";
import { maySms } from "@/lib/sms/optOut";
import { letterLanguage } from "@/lib/i18n/letterLanguage";
import { staffAlertSms, smsSegments, clientAlertHas } from "@/lib/i18n/clientAlertCopy";
import { teamNoticeHas } from "@/lib/i18n/teamNoticeCopy";
import { formatAppMoney } from "@/lib/format/money";
import { getAppOrigin } from "@/lib/appUrl";
import { hrefFor } from "@/lib/notifications/render";
import { typeMeta } from "@/lib/notifications/catalog";
import { amountForReader, underDailyCap, STAFF_TEXT_DAILY_CAP } from "@/lib/notifications/clientAlerts";

const DAY_MS = 24 * 60 * 60 * 1000;

const MEMBER_SELECT = Object.freeze({
  id: true,
  userId: true,
  role: true,
  permissions: true,
  phone: true,
  user: { select: { name: true, email: true, language: true } },
});

function origin() {
  try {
    return getAppOrigin();
  } catch {
    return "https://fieldquo.com";
  }
}

/** The app link a text or email carries — the same destination the bell row opens. */
export function alertLink(type, entityId, base = origin()) {
  const href = hrefFor({ entityType: typeMeta(type)?.entityType || null, entityId: entityId || null });
  return href ? `${String(base || "").replace(/\/+$/, "")}${href}` : `${String(base || "").replace(/\/+$/, "")}/app`;
}

async function record(prisma, row) {
  try {
    await prisma.staffAlertText.create({ data: row });
  } catch (err) {
    console.error("[staff texts] record failed:", err?.message);
  }
}

/**
 * Text each member in `members` (already chosen by the plan). Returns the
 * outcome per member — the check reads it, and notifyEvent counts the sent.
 */
export async function sendStaffTexts({ prisma = defaultDb, companyId, type, entityId = null, params = {}, amount = null, members = [], company = null, now = new Date() }) {
  const out = [];
  if (!members.length) return out;
  const ids = members.map((m) => m.id);
  const rows = await prisma.member.findMany({
    where: { companyId, id: { in: ids }, active: true },
    select: MEMBER_SELECT,
  });
  const link = alertLink(type, entityId);
  for (const m of rows) {
    const base = { companyId, memberId: m.id, userId: m.userId, event: type, entityId: entityId || null };
    const e164 = toE164(m.phone || "");
    if (!e164) {
      await record(prisma, { ...base, toE164: null, status: "refused", reason: "no_phone", segments: 0 });
      out.push({ memberId: m.id, sent: false, reason: "no_phone" });
      continue;
    }
    const sentToday = await prisma.staffAlertText.count({
      where: { userId: m.userId, status: "sent", createdAt: { gte: new Date(now.getTime() - DAY_MS) } },
    });
    if (!underDailyCap(sentToday, STAFF_TEXT_DAILY_CAP)) {
      await record(prisma, { ...base, toE164: e164, status: "refused", reason: "rate_limited", segments: 0 });
      out.push({ memberId: m.id, sent: false, reason: "rate_limited" });
      continue;
    }
    // STOP is honoured per company and phone, exactly as for every other
    // text this company sends (lib/sms/optOut.js); a STOP to the shared
    // number from a staff phone is recorded by app/api/sms/inbound.
    const allowed = await maySms({ companyId, phone: e164 }).catch(() => false);
    if (!allowed) {
      await record(prisma, { ...base, toE164: e164, status: "refused", reason: "opted_out", segments: 0 });
      out.push({ memberId: m.id, sent: false, reason: "opted_out" });
      continue;
    }
    const language = letterLanguage(m.user, company, clientAlertHas);
    const shown = amountForReader(m, amount);
    const body = staffAlertSms({
      event: type,
      language,
      params,
      amountText: shown === null ? null : formatAppMoney(shown, company?.currency, language),
      link,
    });
    if (!body) {
      out.push({ memberId: m.id, sent: false, reason: "no_copy" });
      continue;
    }
    const segments = smsSegments(body);
    let result;
    try {
      result = await sendSms({ to: e164, body, companyId, purpose: "staff_alert", ref: { type: typeMeta(type)?.entityType || "alert", id: entityId || "" } });
    } catch (err) {
      result = { success: false, error: String(err?.message || err), noNumber: /No SMS 'from' number/i.test(String(err?.message || "")) };
    }
    let status = "sent";
    let reason = null;
    if (result?.simulated) {
      status = "refused";
      reason = "simulated";
    } else if (!result?.success) {
      status = "refused";
      reason = result?.noNumber ? "no_sms_number" : result?.phoneVerification ? "trial_phone_gate" : "send_failed";
    }
    await record(prisma, { ...base, toE164: e164, status, reason, sid: result?.sid || null, segments: status === "sent" ? segments : 0 });
    out.push({ memberId: m.id, sent: status === "sent", reason, body, segments, language });
  }
  return out;
}

/**
 * The new alert emails (quote.viewed, changeOrder.approved) — one per
 * (language, money) group, on the team-notice envelope. The two older emails
 * (a quote approved, a request filed) keep sending from where they always
 * did and only ASK emailAllowed (lib/notifications/alertPlan.js).
 */
export async function sendAlertEmails({ prisma = defaultDb, companyId, type, entityId = null, params = {}, amount = null, members = [], company = null, context = {}, now = new Date() }) {
  if (!members.length) return { sent: 0 };
  const [{ sendEmail }, { memberReaders }, { groupReaders, teamNoticeFrom }, emails] = await Promise.all([
    import("@/lib/email/resend"),
    import("@/lib/notifications/teamReaders"),
    import("@/lib/email/teamNotice"),
    import("@/lib/notifications/teamEmails"),
  ]);
  const rows = await prisma.member.findMany({
    where: { companyId, id: { in: members.map((m) => m.id) }, active: true },
    select: MEMBER_SELECT,
  });
  const readers = memberReaders(rows, company || {}, teamNoticeHas);
  const base = origin();
  let sent = 0;
  for (const group of groupReaders(readers)) {
    let mail = null;
    if (type === "quote.viewed") {
      mail = emails.quoteViewedNotice({
        language: group.language,
        company: company || {},
        quote: { id: entityId, quoteNumber: params.quoteNumber },
        clientName: params.clientName || null,
        count: params.count,
        openedAt: now,
        reader: group.reader,
        origin: base,
      });
    } else if (type === "changeOrder.approved") {
      mail = emails.changeOrderApprovedNotice({
        language: group.language,
        company: company || {},
        job: { id: entityId },
        clientName: params.clientName || null,
        label: params.label || "",
        amount,
        signedBy: context.signedBy || null,
        decidedAt: now,
        reader: group.reader,
        origin: base,
      });
    }
    if (!mail) continue;
    const result = await sendEmail({
      companyId,
      from: teamNoticeFrom(company?.name),
      to: group.to,
      subject: mail.subject,
      html: mail.html,
      text: mail.text,
    }).catch((err) => ({ error: err?.message || "send failed" }));
    if (!result?.error && !result?.skipped) sent += group.to.length;
  }
  return { sent };
}

/**
 * Both channels for one event. Never throws — the feed row is already
 * written, and the client's open or approval already committed.
 */
export async function deliverAlertChannels({ prisma = defaultDb, companyId, type, entityId = null, params = {}, amount = null, sms = [], email = [], context = {} }) {
  try {
    const company = await prisma.company.findUnique({
      where: { id: companyId },
      select: { name: true, defaultLanguage: true, currency: true, timezone: true },
    });
    const texts = await sendStaffTexts({ prisma, companyId, type, entityId, params, amount, members: sms, company });
    const mails = await sendAlertEmails({ prisma, companyId, type, entityId, params, amount, members: email, company, context });
    return { texted: texts.filter((t) => t.sent).length, emailed: mails.sent, texts };
  } catch (err) {
    console.error(`[staff texts] ${type} failed:`, err?.message);
    return { texted: 0, emailed: 0, texts: [], error: err?.message || "failed" };
  }
}
