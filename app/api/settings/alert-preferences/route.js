// app/api/settings/alert-preferences/route.js
//
// The signed-in person's OWN client-activity alerts — Settings ›
// Notifications, "Client activity alerts" (the owner, 2026-10-14: "send me a
// text when the client has opened / approved a quote / change order /
// request"). Which of the four events reach them by bell + push, email and
// text, and the mobile number the texts go to.
//
// Per member, and only ever the caller's own row: an owner cannot switch a
// text on for somebody else's phone. The company-wide switch per event is a
// different door (POST /api/settings/notification-rules, owners and admins)
// and is only READ here, so the screen can say "turned off for the company"
// rather than offer a switch that does nothing.
//
// Every row the screen draws is one the person can actually receive: an
// event the catalog's resolver would never send them (a money event without
// showPricing, a quote event with quotes access off) comes back `eligible:
// false`, and the PUT refuses it — a switch for an alert that can never
// arrive is the dead control AGENTS.md's first rule forbids.
//
// A support session (impersonation) is read-only: middleware refuses the PUT,
// and it is refused again here (non-negotiable #2).
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { memberOrRefusal } from "@/lib/apiMember";
import { loadEnforceableMember, UNRESTRICTED_ROLES } from "@/lib/permissions/enforce";
import { selectRecipients } from "@/lib/notifications/recipients";
import { typeMeta } from "@/lib/notifications/catalog";
import {
  CLIENT_ALERTS,
  CLIENT_ALERT_EVENTS,
  STAFF_TEXT_DAILY_CAP,
  channelOn,
  companyAlertOn,
  validateAlertPatch,
} from "@/lib/notifications/clientAlerts";
import { toE164 } from "@/lib/sms/twilioClient";
import { maySms } from "@/lib/sms/optOut";

/** Could this member ever receive this event? The resolver, asked directly. */
function eligibleFor(member, event) {
  if (!member) return false;
  return selectRecipients({ members: [{ ...member, active: true }], type: event, peopleUserIds: [member.userId] }).length === 1;
}

async function state(member) {
  const enforceable = await loadEnforceableMember(db, member.id);
  const [rules, prefs, me] = await Promise.all([
    db.notificationRule.findMany({
      where: { companyId: member.companyId, type: { in: CLIENT_ALERT_EVENTS.map((e) => CLIENT_ALERTS[e].rule) } },
      select: { type: true, active: true },
    }),
    db.memberAlertPreference.findMany({
      where: { companyId: member.companyId, memberId: member.id },
      select: { event: true, inApp: true, email: true, sms: true },
    }),
    db.member.findFirst({ where: { id: member.id, companyId: member.companyId }, select: { phone: true } }),
  ]);
  const ruleBy = new Map(rules.map((r) => [r.type, r]));
  const prefBy = new Map(prefs.map((p) => [p.event, p]));
  const phone = me?.phone || "";
  const e164 = toE164(phone);
  const smsOptedOut = e164 ? !(await maySms({ companyId: member.companyId, phone: e164 }).catch(() => true)) : false;
  const unrestricted = UNRESTRICTED_ROLES.has(enforceable?.role);
  return {
    events: CLIENT_ALERT_EVENTS.map((event) => {
      const meta = CLIENT_ALERTS[event];
      const pref = prefBy.get(event) || null;
      return {
        event,
        // The company switch's NotificationRule type — the screen posts it to
        // /api/settings/notification-rules rather than keeping a copy of the
        // table.
        rule: meta.rule,
        eligible: eligibleFor(enforceable, event),
        companyOn: companyAlertOn(ruleBy.get(meta.rule) || null),
        // Only the record's own people, for a non-owner on a people-scoped
        // event — the screen says so rather than letting them expect every
        // quote in the company.
        ownOnly: typeMeta(event)?.peopleScoped === true && !unrestricted,
        // The ticket email goes to whoever holds the request; the switch
        // decides whether that is still sent when it is you.
        emailHolderOnly: meta.email === "holder",
        channels: {
          inApp: channelOn(pref, event, "inApp", enforceable || {}),
          email: channelOn(pref, event, "email", enforceable || {}),
          sms: channelOn(pref, event, "sms", enforceable || {}),
        },
      };
    }),
    phone,
    phoneValid: Boolean(e164),
    smsOptedOut,
    dailyCap: STAFF_TEXT_DAILY_CAP,
    canManageCompany: unrestricted,
  };
}

export async function GET(request) {
  const { member, response } = await memberOrRefusal(request);
  if (response) return response;
  return NextResponse.json(await state(member));
}

export async function PUT(request) {
  const { member, response } = await memberOrRefusal(request);
  if (response) return response;
  if (member.impersonation) {
    return NextResponse.json({ error: "A support session is read-only." }, { status: 403 });
  }
  const checked = validateAlertPatch(await request.json().catch(() => null));
  if (!checked.ok) return NextResponse.json({ error: checked.error }, { status: 400 });
  const data = checked.data;

  // ── The person's own mobile number ──────────────────────────────────────
  //
  // Member.phone — the same column Settings › Team holds for them, so there
  // is one number per person per company, not a second "alerts phone" that
  // drifts from it. Stored as E.164 so the text and a STOP reply match it.
  if ("phone" in data) {
    if (data.phone === "") {
      await db.member.updateMany({ where: { id: member.id, companyId: member.companyId }, data: { phone: null } });
      return NextResponse.json(await state(member));
    }
    const e164 = toE164(data.phone);
    if (!e164) return NextResponse.json({ error: "Enter a valid mobile number.", code: "bad_phone" }, { status: 400 });
    await db.member.updateMany({ where: { id: member.id, companyId: member.companyId }, data: { phone: e164 } });
    return NextResponse.json(await state(member));
  }

  // ── One switch ──────────────────────────────────────────────────────────
  const enforceable = await loadEnforceableMember(db, member.id);
  if (!eligibleFor(enforceable, data.event)) {
    return NextResponse.json({ error: "This alert can't reach you with your current access.", code: "not_eligible" }, { status: 403 });
  }
  if (data.channel === "sms" && data.on) {
    const me = await db.member.findFirst({ where: { id: member.id, companyId: member.companyId }, select: { phone: true } });
    if (!toE164(me?.phone || "")) {
      return NextResponse.json({ error: "Add your mobile number first.", code: "phone_needed" }, { status: 400 });
    }
  }
  await db.memberAlertPreference.upsert({
    where: { memberId_event: { memberId: member.id, event: data.event } },
    update: { [data.channel]: data.on },
    create: { companyId: member.companyId, memberId: member.id, event: data.event, [data.channel]: data.on },
  });
  return NextResponse.json(await state(member));
}
