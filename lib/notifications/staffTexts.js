// lib/notifications/staffTexts.js
//
// The text messages — and the new alert emails — a company's OWN staff get
// about a client event, for the people who asked for them in Settings ›
// Notifications (lib/notifications/clientAlerts.js decides who; this sends).
// Called by notifyEvent only after the feed row exists, never throws, and is
// loaded lazily so Twilio and Resend stay off the import graph of every route
// that merely writes a bell row.
//
// ══ The company's own number when it has one (owner, 2026-11-08) ══════════
//
// The owner: "the notification to the company should leave from the
// company's text number too." So the `from` is clientSmsFrom(company) — the
// same one decision every client-facing text makes — and only a company
// with no number of its own falls back to FieldQuo's system number
// (lib/sms/systemNumber.js), which is where these all used to leave from.
//
// That one argument carries the billing with it. sendSms meters an outbound
// text by matching its `from` against the company's active BroughtNumber
// (lib/businessNumber/meter.js meterOutboundIfBrought) — keyed on the
// number, not on the purpose — so a text from the company's own line is
// charged to that company's phone balance at TEXT_CENTS the moment it goes,
// and one from the system number is not. Nothing here does the billing; it
// chose the number, and the billing followed.
//
// ══ Which makes the daily cap conditional ═════════════════════════════════
//
// STAFF_TEXT_DAILY_CAP guards FIELDQUO's bill. Once a company's own balance
// is paying, rationing it at twenty is FieldQuo limiting spending it does
// not fund — and it would withhold the alert on the company's busiest day,
// which is the day the alert is worth most. So the cap is applied only on
// the fallback path. A company paying for its own texts is limited by its
// own balance, which it can see and top up.
//
// Every text, sent or not, is still a StaffAlertText row; the metered ones
// additionally appear in the phone ledger as `brought_text`, joinable on the
// SID this row stores.
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
import { sendSms } from "@/lib/sms/twilioClient";
import { clientSmsFrom } from "@/lib/sms/clientLine";
import { maySms } from "@/lib/sms/optOut";
import { letterLanguage } from "@/lib/i18n/letterLanguage";
import { staffAlertSms, smsSegments, clientAlertHas } from "@/lib/i18n/clientAlertCopy";
import { teamNoticeHas } from "@/lib/i18n/teamNoticeCopy";
import { formatAppMoney } from "@/lib/format/money";
import { getAppOrigin } from "@/lib/appUrl";
import { hrefFor } from "@/lib/notifications/render";
import { typeMeta } from "@/lib/notifications/catalog";
import { amountForReader, underDailyCap, STAFF_TEXT_DAILY_CAP } from "@/lib/notifications/clientAlerts";
import { loadAlertFacts, factsForReader } from "@/lib/notifications/alertFacts";
import { staffPhoneFor, verifiedPhonesFor } from "@/lib/notifications/staffPhone";

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
 *
 * `send` and `mayText` are injectable for the same reason
 * bookingTextVerdict is exported (lib/booking/finalizeBooking.js): the thing
 * worth asserting about this function is WHICH NUMBER the text left from,
 * and that is an argument to sendSms, invisible in the return value.
 * scripts/check-staff-alert-from.mjs runs the real body and reads the `from`
 * it chose, rather than reading the source and hoping. Defaults are the real
 * ones, so no caller changes.
 */
export async function sendStaffTexts({ prisma = defaultDb, companyId, type, entityId = null, params = {}, amount = null, members = [], company = null, now = new Date() }, { send = sendSms, mayText = maySms } = {}) {
  const out = [];
  if (!members.length) return out;
  const ids = members.map((m) => m.id);
  const rows = await prisma.member.findMany({
    where: { companyId, id: { in: ids }, active: true },
    select: MEMBER_SELECT,
  });
  const link = alertLink(type, entityId);
  // The company's own line when it has one, else undefined — which sendSms
  // resolves to the system number. Same call every client text makes, so a
  // company never sends from two numbers. See the header: this one argument
  // also decides who is billed and whether the cap applies.
  const from = clientSmsFrom(company);
  const fieldquoPays = !from;
  // ── What the record says RIGHT NOW ──────────────────────────────────────
  //
  // One read, for the events that have an enricher (today: a new enquiry's
  // phone, email and what they want). Null for every other event, which then
  // builds its text from the feed row's params exactly as before. See
  // lib/notifications/alertFacts.js for why these are not catalog params.
  const facts = await loadAlertFacts({ prisma, companyId, type, entityId });
  // The numbers FieldQuo already holds for these people — see
  // lib/notifications/staffPhone.js. One query above the loop, not one
  // inside it.
  const verified = await verifiedPhonesFor(prisma, { companyId, userIds: rows.map((r) => r.userId) });
  for (const m of rows) {
    const base = { companyId, memberId: m.id, userId: m.userId, event: type, entityId: entityId || null };
    const { e164, source: phoneSource } = staffPhoneFor(m, verified);
    if (!e164) {
      await record(prisma, { ...base, toE164: null, status: "refused", reason: "no_phone", segments: 0 });
      out.push({ memberId: m.id, sent: false, reason: "no_phone" });
      continue;
    }
    // Only while FieldQuo is buying the text — see the header.
    if (fieldquoPays) {
      const sentToday = await prisma.staffAlertText.count({
        where: { userId: m.userId, status: "sent", createdAt: { gte: new Date(now.getTime() - DAY_MS) } },
      });
      if (!underDailyCap(sentToday, STAFF_TEXT_DAILY_CAP)) {
        await record(prisma, { ...base, toE164: e164, status: "refused", reason: "rate_limited", segments: 0 });
        out.push({ memberId: m.id, sent: false, reason: "rate_limited" });
        continue;
      }
    }
    // STOP is honoured per company and phone, exactly as for every other
    // text this company sends (lib/sms/optOut.js); a STOP to the shared
    // number from a staff phone is recorded by app/api/sms/inbound.
    const allowed = await mayText({ companyId, phone: e164 }).catch(() => false);
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
      // The fresh facts win over the stored params where they overlap (the
      // name): a lead corrected after the row was written must not be texted
      // under its old name. Everything the enricher could not find is simply
      // absent, and the copy omits that line.
      params: { ...params, ...(factsForReader(facts, language) || {}) },
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
      result = await send({ to: e164, body, from, companyId, purpose: "staff_alert", ref: { type: typeMeta(type)?.entityType || "alert", id: entityId || "" } });
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
    out.push({ memberId: m.id, sent: status === "sent", reason, body, segments, language, to: e164, from: from || null, phoneSource });
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
      // smsFromNumber because clientSmsFrom reads it — a select that omits
      // it would silently send every alert from the system number and bill
      // FieldQuo, with nothing to show the mistake.
      select: { name: true, defaultLanguage: true, currency: true, timezone: true, smsFromNumber: true },
    });
    const texts = await sendStaffTexts({ prisma, companyId, type, entityId, params, amount, members: sms, company });
    const mails = await sendAlertEmails({ prisma, companyId, type, entityId, params, amount, members: email, company, context });
    return { texted: texts.filter((t) => t.sent).length, emailed: mails.sent, texts };
  } catch (err) {
    console.error(`[staff texts] ${type} failed:`, err?.message);
    return { texted: 0, emailed: 0, texts: [], error: err?.message || "failed" };
  }
}
