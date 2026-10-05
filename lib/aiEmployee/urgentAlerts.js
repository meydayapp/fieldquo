// lib/aiEmployee/urgentAlerts.js
//
// "Urgent → text the company's on-call person" (owner, 2026-10-04) — the
// reads, the sends and the writes. Every decision is made by the pure half,
// lib/aiEmployee/onCall.js; this file acts on them.
//
// ══ The ladder ═════════════════════════════════════════════════════════════
//
// raiseUrgentAlert() texts the first person on the company's on-call list
// (plus their bell and push), immediately, from inside the reply that found
// the problem. /api/cron/urgent-alerts runs every two minutes and, when
// nobody has pressed "I've got it" within the company's ackTimeoutMinutes,
// texts the next person; after the last, the alert is "exhausted" and the
// owner and admins are told on the bell (ai_employee.urgent_unrouted). A
// person who can't be texted right now (opted out with STOP, a send that
// failed) is logged and the next one is tried at once — waiting ten minutes
// to find out a number is dead is ten minutes of water on the floor.
//
// ══ Paid from the company's phone & text credit ════════════════════════════
//
// The same prepaid balance crew texts and the business line draw from
// (lib/voice/credits.js, the VOICE pool), at the same price: the floor now
// (lib/phoneUsage/pricing.js — 2¢ a segment), settled to Twilio's cost × 2
// by lib/phoneUsage/settle.js once the price is known. Its own ledger kind,
// "urgent_alert_text", so "what is this 2¢?" is answerable from the
// statement. A balance that can't cover one text sends none: the alert is
// "not_sent", reason "no_credit", the customer still gets the company's
// number and an urgent callback, and the settings screen says why.
//
// ══ Never the customer's channel ═══════════════════════════════════════════
//
// These texts go to the company's own staff, from FieldQuo's system number
// (lib/sms/systemNumber.js) — never to the customer and never from the
// company's brought business number (whose texts are metered separately,
// lib/businessNumber/meter.js, and would be charged twice).

import { db } from "@/lib/db";
import { sendSms } from "@/lib/sms/twilioClient";
import { maySms } from "@/lib/sms/optOut";
import { balanceFor, debitCredit } from "@/lib/voice/credits";
import { enqueueUsage, countryOfE164 } from "@/lib/phoneUsage/settle";
import { notifyEvent } from "@/lib/notifications/notify";
import { getAppOrigin } from "@/lib/appUrl";
import { withinBusinessHours } from "./decide";
import { buildLadder, onCallNow, alertSmsBody, alertTextCents, alertTextSegments, escalationStep } from "./onCall";

/** One alert per conversation inside this window — a customer who writes
 *  three times about the same burst pipe texts the on-call person once. */
export const DEDUPE_WINDOW_MS = 6 * 60 * 60 * 1000;

/** The ledger kind (lib/voice/spendGate.js SPEND_KINDS). */
export const ALERT_LEDGER_KIND = "urgent_alert_text";

/** How many open alerts one cron run advances. */
export const ESCALATION_BATCH = 100;

const MEMBER_SELECT = Object.freeze({ id: true, userId: true, phone: true, active: true, user: { select: { name: true } } });

const realDeps = () => ({
  sendSms,
  maySms,
  balanceFor,
  debitCredit,
  enqueueUsage,
  notify: notifyEvent,
  origin: getAppOrigin,
  businessHoursOpen: withinBusinessHours,
});

/** This company's members, as onCall.js reads them. */
export async function companyMembers(prisma, companyId) {
  const rows = await prisma.member.findMany({ where: { companyId, active: true }, select: MEMBER_SELECT });
  return rows.map((m) => ({ id: m.id, userId: m.userId, phone: m.phone || null, active: m.active !== false, name: m.user?.name || null }));
}

/** The alert link the text carries. */
export function alertLink(origin, alertId) {
  return `${String(origin || "").replace(/\/+$/, "")}/app/urgent/${encodeURIComponent(alertId)}`;
}

async function logStep(prisma, { companyId, alertId, memberId = null, channel, ok, reason = null, sid = null, chargedCents = null }) {
  try {
    await prisma.urgentAlertStep.create({ data: { companyId, alertId, memberId, channel, ok, reason, sid, chargedCents } });
  } catch (err) {
    console.error("[urgent] step log failed:", err?.message);
  }
}

/**
 * Text ladder[index] — or, when that person can't be texted, the next one
 * that can. Returns the index actually texted, or -1 with the reason.
 */
async function textFrom(prisma, { alert, index, company, deps, now }) {
  const ladder = Array.isArray(alert.ladder) ? alert.ladder : [];
  const members = await companyMembers(prisma, alert.companyId);
  const { ladder: live } = buildLadder({ onCallMemberIds: ladder }, members);
  const byId = new Map(live.map((m) => [m.memberId, m]));
  let lastReason = "no_phone";
  for (let i = index; i < ladder.length; i++) {
    const person = byId.get(ladder[i]);
    if (!person) {
      await logStep(prisma, { companyId: alert.companyId, alertId: alert.id, memberId: ladder[i], channel: "sms", ok: false, reason: "no_phone" });
      lastReason = "no_phone";
      continue;
    }
    const body = alertSmsBody({
      companyName: company?.name,
      tier: alert.tier,
      category: alert.category,
      customerName: alert.customerName,
      summary: alert.summary,
      link: alertLink(deps.origin(), alert.id),
      language: company?.defaultLanguage || "en",
    });
    const cents = alertTextCents(body);
    const balance = await deps.balanceFor(alert.companyId);
    if (Number(balance) < cents) {
      await logStep(prisma, { companyId: alert.companyId, alertId: alert.id, memberId: person.memberId, channel: "sms", ok: false, reason: "no_credit" });
      return { index: -1, reason: "no_credit" };
    }
    const allowed = await deps.maySms({ companyId: alert.companyId, phone: person.phone }).catch(() => false);
    if (!allowed) {
      await logStep(prisma, { companyId: alert.companyId, alertId: alert.id, memberId: person.memberId, channel: "sms", ok: false, reason: "opted_out" });
      lastReason = "opted_out";
      continue;
    }
    let sent;
    try {
      sent = await deps.sendSms({ to: person.phone, body, companyId: alert.companyId, purpose: "urgent_alert", ref: { type: "urgentAlert", id: alert.id } });
    } catch (err) {
      // No system number is the one throw sendSms makes on purpose.
      sent = { success: false, error: String(err?.message || err), noNumber: /No SMS 'from' number/i.test(String(err?.message || "")) };
    }
    if (!sent?.success) {
      const reason = sent?.noNumber ? "no_sms_number" : "send_failed";
      await logStep(prisma, { companyId: alert.companyId, alertId: alert.id, memberId: person.memberId, channel: "sms", ok: false, reason });
      if (reason === "no_sms_number") return { index: -1, reason };
      lastReason = reason;
      continue;
    }
    // Charged for a text that LEFT (we hold its SID) — never for one we
    // only meant to send. Idempotent on the SID.
    const ref = `urgent_out:${sent.sid}`;
    let charged = null;
    if (sent.sid && !sent.simulated) {
      const entry = await deps
        .debitCredit({ companyId: alert.companyId, cents, kind: ALERT_LEDGER_KIND, ref, note: `Urgent alert text to ${person.name || "on-call"} ·${person.phone.slice(-4)} — ${cents}¢` })
        .catch((err) => {
          console.error("[urgent] metering failed:", err?.message);
          return null;
        });
      charged = entry ? cents : null;
      await deps
        .enqueueUsage({
          companyId: alert.companyId, sid: sent.sid, resource: "message", direction: "out", ledgerKind: ALERT_LEDGER_KIND, ledgerRef: ref,
          provisionalCents: cents, units: alertTextSegments(body), hasMedia: false, country: countryOfE164(person.phone),
        })
        .catch(() => null);
    }
    await logStep(prisma, { companyId: alert.companyId, alertId: alert.id, memberId: person.memberId, channel: "sms", ok: true, sid: sent.sid || null, chargedCents: charged });
    // The bell and the push, to the same person. Named, so the audience
    // floor (every preset) is narrowed to exactly them.
    if (person.userId) {
      await deps
        .notify({
          companyId: alert.companyId,
          type: "ai_employee.urgent",
          entityId: alert.threadId,
          params: { category: alert.category, customerName: alert.customerName || "" },
          recipientUserIds: [person.userId],
        })
        .then(() => logStep(prisma, { companyId: alert.companyId, alertId: alert.id, memberId: person.memberId, channel: "bell", ok: true }))
        .catch(() => {});
    }
    return { index: i, reason: null, at: now };
  }
  return { index: -1, reason: lastReason };
}

/** Tell the owner and admins nobody could be texted — the bell, never silence. */
async function tellManagers(deps, alert, reason) {
  await deps
    .notify({
      companyId: alert.companyId,
      type: "ai_employee.urgent_unrouted",
      entityId: alert.threadId,
      params: { category: alert.category, reason },
    })
    .catch(() => {});
}

/**
 * Raise (or find) the alert for an urgent conversation, and text the first
 * person. Never throws.
 *
 * @returns {{ alertId, alerted: "sms"|"bell"|null, status, reason, deduped }}
 */
export async function raiseUrgentAlert({
  companyId,
  threadId,
  replyId = null,
  tier = "urgent",
  category = "other",
  summary = null,
  customerName = null,
  settings = {},
  company = null,
  now = new Date(),
  prisma = db,
  deps: injected = {},
} = {}) {
  const deps = { ...realDeps(), ...injected };
  try {
    if (!companyId || !threadId) return { alertId: null, alerted: null, status: null, reason: "no_thread", deduped: false };

    // ── One alert per conversation per window ────────────────────────────
    const prior = await prisma.urgentAlert.findFirst({
      where: { companyId, threadId, createdAt: { gte: new Date(now.getTime() - DEDUPE_WINDOW_MS) } },
      orderBy: { createdAt: "desc" },
      select: { id: true, status: true, reason: true, steps: { where: { channel: "sms", ok: true }, select: { id: true }, take: 1 } },
    });
    if (prior) {
      return { alertId: prior.id, alerted: prior.steps?.length ? "sms" : "bell", status: prior.status, reason: prior.reason, deduped: true };
    }

    const members = await companyMembers(prisma, companyId);
    const { ladder } = buildLadder(settings, members);
    const onCall = onCallNow({
      settings,
      businessHoursOpen: company ? deps.businessHoursOpen(company) : null,
      timezone: company?.timezone || "America/Toronto",
      now,
    });

    // Why no text can go, decided BEFORE a row is written, so the row says it.
    const blocked = settings.urgentAlertsEnabled === false
      ? "alerts_off"
      : !(settings.onCallMemberIds || []).length
        ? "no_on_call"
        : !ladder.length
          ? "no_phone"
          : !onCall.on
            ? onCall.reason || "off_hours"
            : null;

    const alert = await prisma.urgentAlert.create({
      data: {
        companyId,
        threadId,
        replyId,
        tier: tier === "emergency" ? "emergency" : "urgent",
        category: String(category || "other").slice(0, 30),
        summary: summary ? String(summary).replace(/\s+/g, " ").trim().slice(0, 300) : null,
        customerName: customerName ? String(customerName).trim().slice(0, 120) : null,
        // The owner's whole list, in order — not only the textable ones — so
        // a person skipped for having no phone is LOGGED as skipped on this
        // alert ("Sam has no number"), not silently absent from it.
        ladder: (settings.onCallMemberIds || []).slice(),
        step: -1,
        status: blocked ? "not_sent" : "open",
        reason: blocked,
        nextAt: null,
      },
    });

    if (blocked) {
      await tellManagers(deps, alert, blocked);
      await logStep(prisma, { companyId, alertId: alert.id, channel: "bell", ok: true, reason: blocked });
      return { alertId: alert.id, alerted: "bell", status: "not_sent", reason: blocked, deduped: false };
    }

    const sent = await textFrom(prisma, { alert, index: 0, company, deps, now });
    if (sent.index === -1) {
      await prisma.urgentAlert.update({ where: { id: alert.id }, data: { status: "not_sent", reason: sent.reason } });
      await tellManagers(deps, alert, sent.reason);
      return { alertId: alert.id, alerted: "bell", status: "not_sent", reason: sent.reason, deduped: false };
    }
    await prisma.urgentAlert.update({
      where: { id: alert.id },
      data: { step: sent.index, nextAt: new Date(now.getTime() + (Number(settings.ackTimeoutMinutes) || 10) * 60_000) },
    });
    return { alertId: alert.id, alerted: "sms", status: "open", reason: null, deduped: false };
  } catch (err) {
    console.error("[urgent] raise failed:", err?.message);
    return { alertId: null, alerted: null, status: null, reason: "error", deduped: false };
  }
}

/**
 * The cron's work: every open alert whose wait has run out texts the next
 * person, or is exhausted. Never throws.
 */
export async function advanceUrgentAlerts({ prisma = db, now = new Date(), batch = ESCALATION_BATCH, loadSettings, deps: injected = {} } = {}) {
  const deps = { ...realDeps(), ...injected };
  const due = await prisma.urgentAlert.findMany({
    where: { status: "open", nextAt: { lte: now } },
    orderBy: { nextAt: "asc" },
    take: batch,
  });
  const out = { checked: due.length, texted: 0, exhausted: 0, failed: 0 };
  for (const alert of due) {
    try {
      const step = escalationStep(alert, { now });
      if (step.action === "exhausted") {
        await prisma.urgentAlert.update({ where: { id: alert.id }, data: { status: "exhausted", nextAt: null } });
        await tellManagers(deps, alert, "nobody_acknowledged");
        out.exhausted++;
        continue;
      }
      if (step.action !== "text_next") continue;
      const [company, settings] = await Promise.all([
        prisma.company.findUnique({ where: { id: alert.companyId }, select: { id: true, name: true, defaultLanguage: true, timezone: true, businessHours: true } }),
        loadSettings ? loadSettings(prisma, alert.companyId) : null,
      ]);
      const sent = await textFrom(prisma, { alert, index: step.nextIndex, company, deps, now });
      if (sent.index === -1) {
        await prisma.urgentAlert.update({ where: { id: alert.id }, data: { status: "exhausted", nextAt: null, reason: sent.reason } });
        await tellManagers(deps, alert, sent.reason);
        out.failed++;
        continue;
      }
      await prisma.urgentAlert.update({
        where: { id: alert.id },
        data: { step: sent.index, nextAt: new Date(now.getTime() + (Number(settings?.ackTimeoutMinutes) || 10) * 60_000) },
      });
      out.texted++;
    } catch (err) {
      console.error("[urgent] escalation step failed:", err?.message);
      out.failed++;
    }
  }
  return out;
}

/**
 * "I've got it." Any active member of the company may take it — the on-call
 * person, or the owner who saw the bell first. Read and written under the
 * companyId of the session, never the alert's own word for it.
 */
export async function acknowledgeUrgentAlert({ prisma = db, companyId, alertId, memberId, now = new Date() }) {
  const alert = await prisma.urgentAlert.findFirst({ where: { id: alertId, companyId }, select: { id: true, status: true, acknowledgedAt: true } });
  if (!alert) return { ok: false, status: 404, reason: "not_found" };
  if (alert.acknowledgedAt) return { ok: true, already: true };
  // Only the alert itself moves — compare-and-set on "not yet acknowledged",
  // so two people pressing at once leave one name on it.
  const res = await prisma.urgentAlert.updateMany({
    where: { id: alertId, companyId, acknowledgedAt: null },
    data: { acknowledgedAt: now, acknowledgedByMemberId: memberId, nextAt: null, ...(alert.status === "open" || alert.status === "exhausted" || alert.status === "not_sent" ? { status: "acknowledged" } : {}) },
  });
  return { ok: true, already: !res?.count };
}

/** One alert as the /app/urgent page reads it. Shaped; ids and words only. */
export async function alertView(prisma = db, { companyId, alertId }) {
  const a = await prisma.urgentAlert.findFirst({
    where: { id: alertId, companyId },
    include: { steps: { orderBy: { createdAt: "asc" }, select: { memberId: true, channel: true, ok: true, reason: true, createdAt: true } } },
  });
  if (!a) return null;
  const ids = [...new Set([...(a.ladder || []), a.acknowledgedByMemberId].filter(Boolean))];
  const members = ids.length
    ? await prisma.member.findMany({ where: { companyId, id: { in: ids } }, select: { id: true, user: { select: { name: true } } } })
    : [];
  const nameOf = new Map(members.map((m) => [m.id, m.user?.name || null]));
  return {
    id: a.id,
    threadId: a.threadId,
    tier: a.tier,
    category: a.category,
    summary: a.summary,
    customerName: a.customerName,
    status: a.status,
    reason: a.reason,
    createdAt: a.createdAt,
    acknowledgedAt: a.acknowledgedAt,
    acknowledgedBy: a.acknowledgedByMemberId ? nameOf.get(a.acknowledgedByMemberId) || null : null,
    ladder: (a.ladder || []).map((id, i) => ({ memberId: id, name: nameOf.get(id) || null, texted: i <= a.step })),
    steps: a.steps.map((s) => ({ name: s.memberId ? nameOf.get(s.memberId) || null : null, channel: s.channel, ok: s.ok, reason: s.reason, at: s.createdAt })),
  };
}
