// lib/businessNumber/bridge.js
//
// The call button's server half: which record, which phone, and may this
// member ring it now. Shared by app/api/calls/bridge (the member's request)
// and app/api/business-number/bridge (Twilio's TwiML callbacks), so the phone
// is read from the record by ONE function in both places — the callback never
// trusts a phone from its own URL, because there isn't one in it.

import { db } from "@/lib/db";
import { toE164 } from "@/lib/voice/numbers";
import { withinCallingHours } from "@/lib/voice/outbound";
import { suggestZoneForNumber } from "@/lib/sales/areaCodeZone";
import { activeBroughtNumber } from "./store";
import { bridgeVerdict } from "./twiml";

export const BRIDGE_KINDS = Object.freeze(["lead", "client", "job"]);

/** The record's callable phone and name, inside `companyId`. Null when not found. */
export async function bridgeTarget(companyId, kind, id, prisma = db) {
  if (!companyId || !BRIDGE_KINDS.includes(kind) || !id) return null;
  if (kind === "lead") {
    const l = await prisma.leadRequest.findFirst({ where: { id, companyId }, select: { id: true, name: true, phone: true } });
    return l ? { name: l.name, phone: toE164(l.phone), doNotContact: false } : null;
  }
  if (kind === "client") {
    const c = await prisma.client.findFirst({ where: { id, companyId }, select: { id: true, name: true, phone: true, doNotContactAt: true } });
    return c ? { name: c.name, phone: toE164(c.phone), doNotContact: Boolean(c.doNotContactAt) } : null;
  }
  const j = await prisma.job.findFirst({
    where: { id, companyId },
    select: { id: true, client: { select: { name: true, phone: true, doNotContactAt: true } } },
  });
  return j?.client ? { name: j.client.name, phone: toE164(j.client.phone), doNotContact: Boolean(j.client.doNotContactAt) } : null;
}

/** Everything the decision needs, read for one member and one record. */
export async function bridgeCheck({ companyId, memberId, kind, id, now = new Date() }, prisma = db) {
  const [line, target, me, company] = await Promise.all([
    activeBroughtNumber(companyId, prisma),
    bridgeTarget(companyId, kind, id, prisma),
    prisma.member.findFirst({ where: { id: memberId, companyId }, select: { phone: true } }),
    prisma.company.findUnique({ where: { id: companyId }, select: { timezone: true } }),
  ]);
  if (!target) return { verdict: { allowed: false, reasonKey: "not_found", reason: "Not found." }, notFound: true };
  const optedOut = target.phone
    ? await prisma.callConsent.findFirst({ where: { companyId, e164: target.phone, optedOutAt: { not: null } }, select: { id: true } })
    : null;
  // The client's own zone from their area code; the company's when the code
  // spans two zones or is not in the table.
  const zone = suggestZoneForNumber(target.phone || "")?.timeZone || company?.timezone || "America/Toronto";
  const memberPhone = toE164(me?.phone);
  const verdict = bridgeVerdict({
    numberActive: Boolean(line),
    path: line?.path || null,
    memberPhone,
    clientPhone: target.phone,
    doNotCall: Boolean(optedOut) || target.doNotContact,
    withinHours: withinCallingHours(now, zone),
  });
  return { verdict, line, target, memberPhone };
}
