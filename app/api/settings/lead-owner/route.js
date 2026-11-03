// app/api/settings/lead-owner/route.js
//
// "New enquiries go to …" — the company-level choice of who a new lead lands
// on, from Settings › Notifications. The owner, 2026-11-03: "We can then in
// the settings assign it to a different employee (future appointment setter)
// from the list of employees so they get notified."
//
// A COMPANY setting, which is why it is its own door and not part of
// /api/settings/alert-preferences: that route is each person's own row only
// ("an owner cannot switch a text on for somebody else's phone"), and a
// company-wide write filed behind that promise would quietly break it.
// Owners and admins, the same coarse rule the notification-rules route
// enforces and for the reason stated there.
//
// The options are only members the new-enquiry alert can actually reach
// (lib/notifications/leadOwner.js asks the catalog's own resolver). Offering
// anybody else would save a setting, assign them the lead, and never tell
// them it arrived — the dead control AGENTS.md's first rule forbids.
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { memberOrRefusal } from "@/lib/apiMember";
import { leadOwnerCandidates, leadOwnerMember } from "@/lib/notifications/leadOwner";

function manageRefusal(member) {
  if (!["owner", "admin"].includes(member.role)) {
    return NextResponse.json({ error: "Only owners and admins can choose who new enquiries go to." }, { status: 403 });
  }
  return null;
}

async function state(companyId) {
  const [candidates, owner] = await Promise.all([leadOwnerCandidates(db, companyId), leadOwnerMember(db, companyId)]);
  return {
    // The member who is CURRENTLY in force, which is not always the stored
    // id: a setter who left or was deactivated reads as nobody, and the
    // screen must say nobody rather than name a dead account.
    memberId: owner?.id || null,
    options: candidates.map((m) => ({
      memberId: m.id,
      name: m.user?.name || m.user?.email || "",
      role: m.role,
    })),
  };
}

export async function GET(request) {
  const { member, response } = await memberOrRefusal(request);
  if (response) return response;
  const refusal = manageRefusal(member);
  if (refusal) return refusal;
  return NextResponse.json(await state(member.companyId));
}

export async function PUT(request) {
  const { member, response } = await memberOrRefusal(request);
  if (response) return response;
  // A support session reads everything and changes nothing (non-negotiable
  // #2) — refused here as well as in middleware, deliberately twice.
  if (member.impersonation) {
    return NextResponse.json({ error: "A support session is read-only." }, { status: 403 });
  }
  const refusal = manageRefusal(member);
  if (refusal) return refusal;

  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object" || Array.isArray(body) || !("memberId" in body)) {
    return NextResponse.json({ error: "memberId required" }, { status: 400 });
  }
  const memberId = body.memberId === null || body.memberId === "" ? null : String(body.memberId);

  if (memberId) {
    // Re-proved against this company's own candidate list rather than
    // trusted from the body: a member id from another tenant, a deactivated
    // member, or somebody whose access cannot receive the alert is refused
    // by name instead of stored as a setting that would never fire.
    const candidates = await leadOwnerCandidates(db, member.companyId);
    if (!candidates.some((m) => m.id === memberId)) {
      return NextResponse.json({ error: "That person can't receive new-enquiry alerts.", code: "not_eligible" }, { status: 400 });
    }
  }

  await db.company.update({ where: { id: member.companyId }, data: { leadOwnerId: memberId } });
  return NextResponse.json(await state(member.companyId));
}
