// app/api/appointments/[id]/outcome/route.js
//
// POST { outcome: "held" | "no_show" | "rescheduled" | "cancelled" } — what
// became of a visit whose time has passed. The one-tap row on the calendar
// and the "Did this visit happen?" nudge both land here.
//
// Its own route, not the office PATCH, on purpose (lib/appointments/
// outcome.js): the PATCH's cancel writes the client a "your visit is
// cancelled" letter and text, and an outcome is a record about a day that is
// over — nobody is written to. It never moves the time either; a rescheduled
// visit's new time is its own appointment.
//
// Who: the person it is assigned to, or schedule "edit_all" — the PATCH's
// rule, so a crew member marks their own visits and only those. A support
// (impersonation) session is refused upstream by middleware and
// lib/currentMember.js, like every other write.
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { memberOrRefusal } from "@/lib/apiMember";
import { loadEnforceableMember, hasLevel } from "@/lib/permissions/enforce";
import { OUTCOME_STATUS, mayMarkOutcome } from "@/lib/appointments/outcome";
import { recordSiteVisit } from "@/lib/quotes/siteVisitActivity";
import { siteVisitVerbForStatus } from "@/lib/quotes/siteVisit";
import { nudgeAgencyEvents } from "@/lib/agency/nudge";

// The same blind answer the appointment routes give for "no such row" and
// "not yours to see" — a 403 would confirm the id exists.
const NOT_FOUND = {
  error:
    "That appointment isn't on your schedule. If it should be, ask an owner, " +
    "admin or whoever runs the calendar to assign it to you.",
};

export async function POST(request, { params }) {
  const { id } = await params;
  const { member, response } = await memberOrRefusal(request);
  if (response) return response;

  const existing = await db.appointment.findFirst({
    where: { id, companyId: member.companyId },
    select: {
      id: true,
      status: true,
      scheduledAt: true,
      assignedToId: true,
      quote: { select: { id: true, language: true, quoteNumber: true } },
      company: { select: { timezone: true } },
    },
  });
  if (!existing) return NextResponse.json(NOT_FOUND, { status: 404 });

  const body = await request.json().catch(() => ({}));
  const outcome = typeof body?.outcome === "string" ? body.outcome : "";
  const full = await loadEnforceableMember(db, member.id);
  const verdict = mayMarkOutcome({
    appt: existing,
    outcome,
    userId: member.userId || null,
    hasEditAll: hasLevel(full, "schedule", "edit_all"),
  });
  if (!verdict.ok) {
    if (verdict.reason === "not_yours") {
      // Seeing a colleague's visit (an unassigned one, say) is not the same
      // as recording what happened at it.
      const canSee = existing.assignedToId === null;
      if (!canSee) return NextResponse.json(NOT_FOUND, { status: 404 });
      return NextResponse.json(
        { error: "You can only record what happened at visits assigned to you. Ask whoever runs the calendar to mark this one.", code: "not_yours" },
        { status: 403 },
      );
    }
    if (verdict.reason === "not_yet") {
      return NextResponse.json({ error: "This visit hasn't happened yet. Mark what happened once its time has passed.", code: "not_yet" }, { status: 409 });
    }
    return NextResponse.json({ error: "Pick held, no-show, rescheduled or cancelled.", code: "bad_outcome" }, { status: 400 });
  }

  const status = OUTCOME_STATUS[outcome];
  const updated = await db.appointment.update({
    where: { id: existing.id },
    data: {
      status,
      // A reason typed for an earlier office cancel belongs to that cancel;
      // an outcome carries none of its own.
      ...(status !== "cancelled" ? { cancelReason: null } : {}),
    },
    // What the quote's history sentence names (lib/quotes/siteVisit.js) —
    // the answer below carries none of it.
    include: {
      client: { select: { id: true, name: true } },
      assignedTo: { select: { id: true, name: true } },
    },
  });

  // A measure's completion or cancellation is the quote's history, exactly
  // as the PATCH records it (held = completed). A no-show or a reschedule is
  // not a verb that history has.
  const verb = existing.quote ? siteVisitVerbForStatus(existing.status, status) : null;
  if (verb) {
    await recordSiteVisit(member, verb, { appointment: updated, quote: existing.quote, timeZone: existing.company?.timezone || null }).catch((err) =>
      console.error("[appointments] outcome history:", err?.message),
    );
  }

  // appointment.outcome for the marketing agency (held / no_show /
  // rescheduled / cancelled) — after the response, never in its way.
  nudgeAgencyEvents(member.companyId);

  return NextResponse.json({ id: updated.id, status: updated.status, outcome });
}
