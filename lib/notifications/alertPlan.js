// lib/notifications/alertPlan.js
//
// For one client event and the people the catalog already admits for it: is
// the company switch on, and which of them get the bell, an email, a text?
// Two reads — the company's NotificationRule and these people's
// MemberAlertPreference rows — and then lib/notifications/clientAlerts.js
// decides. Imported statically by notifyEvent, so it imports nothing but the
// pure table and the resolver notifyEvent already loads: the senders (Twilio,
// Resend) are loaded only when somebody is actually to be texted or emailed
// (lib/notifications/staffTexts.js).
//
// Tenant-scoped twice: the rule by companyId, and the preferences by companyId
// AND the member ids the company's own resolver returned — a preference row
// from another company cannot switch a channel on here.

import { clientAlertMeta, channelOn, companyAlertOn } from "@/lib/notifications/clientAlerts";
import { selectRecipients } from "@/lib/notifications/recipients";

/** Is the company switch on for this event? No row = ON. */
export async function companySwitchOn(prisma, companyId, type) {
  const meta = clientAlertMeta(type);
  if (!meta || !companyId) return false;
  const rule = await prisma.notificationRule.findFirst({
    where: { companyId, type: meta.rule },
    select: { active: true },
  });
  return companyAlertOn(rule);
}

/** memberId → that member's preference row for this event. */
export async function preferencesFor(prisma, companyId, type, memberIds) {
  const ids = [...new Set((memberIds || []).filter(Boolean))];
  if (!ids.length) return new Map();
  const rows = await prisma.memberAlertPreference.findMany({
    where: { companyId, event: type, memberId: { in: ids } },
    select: { memberId: true, inApp: true, email: true, sms: true },
  });
  return new Map((rows || []).map((r) => [r.memberId, r]));
}

/**
 * @param recipients  the catalog resolver's answer — [{ id, userId, role, permissions }]
 * @returns {{ companyOn, inApp: [], email: [], sms: [], prefs: Map }}
 */
export async function loadAlertPlan({ prisma, companyId, type, recipients }) {
  const companyOn = await companySwitchOn(prisma, companyId, type);
  if (!companyOn) return { companyOn: false, inApp: [], email: [], sms: [], prefs: new Map() };
  const list = Array.isArray(recipients) ? recipients : [];
  const prefs = await preferencesFor(prisma, companyId, type, list.map((m) => m.id));
  const on = (channel) => list.filter((m) => channelOn(prefs.get(m.id) || null, type, channel, m));
  return { companyOn: true, inApp: on("inApp"), email: on("email"), sms: on("sms"), prefs };
}

/**
 * Who gets an alert's EMAIL when the email is sent by its own route (the
 * quote-approval team email): the members the catalog admits for the type,
 * narrowed by the company switch and each person's email choice. `select`
 * is the caller's member select (it must include id, userId, role and
 * permissions); the rows come back in that shape.
 *
 * With nobody having chosen anything this is exactly the owners and admins —
 * clientAlerts.js "managers" — which is who that email always went to.
 */
export async function emailMembersFor(prisma, { companyId, type, select }) {
  if (!(await companySwitchOn(prisma, companyId, type))) return [];
  const members = await prisma.member.findMany({ where: { companyId, active: true }, select });
  const eligible = selectRecipients({ members, type });
  const prefs = await preferencesFor(prisma, companyId, type, eligible.map((m) => m.id));
  return eligible.filter((m) => channelOn(prefs.get(m.id) || null, type, "email", m));
}

/**
 * The question the two emails that predate this ask: may this one member be
 * emailed about this event? Company switch first, then their own choice
 * (default per clientAlerts.js — owners/admins ON for approvals, the holder
 * ON for a request). Used by the quote-approval route and the ticket email.
 */
export async function emailAllowed(prisma, { companyId, type, member }) {
  if (!(await companySwitchOn(prisma, companyId, type))) return false;
  if (!member?.id) return true;
  const prefs = await preferencesFor(prisma, companyId, type, [member.id]);
  return channelOn(prefs.get(member.id) || null, type, "email", member);
}
