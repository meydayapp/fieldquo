// app/api/leads/[id]/attempts/route.js
//
// The log of attempts to reach one lead — a call, a voicemail, a text, an
// email (model LeadContactAttempt, arithmetic in lib/leads/attempts.js).
//
// GET  → { attempts, standing }   whoever may see the lead
// POST { kind, note? } → the row  whoever may change the lead
//
// ── An attempt is outbound, and this route cannot pretend otherwise ───────
//
// Recording one does NOT stop the follow-up sequence: a call nobody answered
// is evidence somebody tried and evidence of nothing about whether the
// homeowner was reached. The two things that stop the chase are an inbound
// reply and the explicit "I've spoken to them" mark on the lead, and neither
// is written here. The route is incapable of touching LeadRequest at all.
//
// ── And it only records kinds a person can honestly claim ────────────────
//
// `source` is always "manual" on this route. FieldQuo writes "system" rows
// for sends it genuinely made itself (the follow-up cron, as it sends), and
// a route driven by a browser is by definition not that. So a client cannot
// post a "system" attempt and dress a guess up as a fact FieldQuo observed.
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { memberOrRefusal } from "@/lib/apiMember";
import { levelOrRefusal } from "@/lib/permissions/apiGate";
import { requireLevel, permissionErrorResponse } from "@/lib/permissions/enforce";
import { cleanAttemptKind, attemptStanding } from "@/lib/leads/attempts";

const ATTEMPT_SELECT = {
  id: true,
  kind: true,
  source: true,
  note: true,
  at: true,
  by: { select: { id: true, name: true } },
};

/** The lead, tenant-checked. An id reached from a URL is trusted no further. */
async function ownedLead(id, companyId) {
  return db.leadRequest.findFirst({
    where: { id, companyId },
    select: { id: true, companyId: true },
  });
}

export async function GET(request, { params }) {
  const { member, response } = await memberOrRefusal(request);
  if (response) return response;

  // Seeing the attempts is seeing the lead: "rang twice, no answer" is the
  // same record one field over, the reasoning the notes route gives.
  const { response: denied } = await levelOrRefusal(member, "requests", "view_only", "see requests");
  if (denied) return denied;

  const { id } = await params;
  const lead = await ownedLead(id, member.companyId);
  if (!lead) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const [attempts, company] = await Promise.all([
    db.leadContactAttempt.findMany({
      where: { companyId: member.companyId, leadId: id },
      select: ATTEMPT_SELECT,
      orderBy: { at: "desc" },
      take: 50,
    }),
    db.company.findUnique({
      where: { id: member.companyId },
      select: { leadCallsPerDay: true, timezone: true },
    }),
  ]);

  return NextResponse.json({
    attempts,
    // The same arithmetic the dashboard uses, so one lead never stands at
    // "1 of 2" on one screen and "0 of 2" on another.
    standing: attemptStanding({ attempts, company }),
  });
}

export async function POST(request, { params }) {
  const { member, response } = await memberOrRefusal(request);
  if (response) return response;
  if (member.impersonation) {
    return NextResponse.json({ error: "Support sessions are read-only." }, { status: 403 });
  }

  const { full, response: denied } = await levelOrRefusal(member, "requests", "view_create_edit", "change a request");
  if (denied) return denied;
  // The notes dial on top of the requests one, the same pair the call-back log
  // asks: an attempt with a note on it IS a note.
  try {
    requireLevel(full, "notes", "view_edit_all", "add notes to requests");
  } catch (err) {
    const { body, status } = permissionErrorResponse(err);
    return NextResponse.json(body, { status });
  }

  const { id } = await params;
  const lead = await ownedLead(id, member.companyId);
  if (!lead) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const body = await request.json().catch(() => ({}));
  const kind = cleanAttemptKind(body?.kind);
  // Refused, not folded into "other": an unknown kind is a client sending
  // nonsense, and storing it would put a word nobody can translate on a
  // contractor's screen.
  if (!kind) {
    return NextResponse.json({ error: "Say what kind of attempt it was.", reason: "bad_kind" }, { status: 400 });
  }
  const note = typeof body?.note === "string" ? body.note.trim().slice(0, 500) || null : null;

  const created = await db.leadContactAttempt.create({
    data: {
      companyId: member.companyId,
      leadId: id,
      kind,
      // Always manual here — see this file's header.
      source: "manual",
      byId: member.userId || null,
      note,
    },
    select: ATTEMPT_SELECT,
  });

  const company = await db.company.findUnique({
    where: { id: member.companyId },
    select: { leadCallsPerDay: true, timezone: true },
  });
  const attempts = await db.leadContactAttempt.findMany({
    where: { companyId: member.companyId, leadId: id },
    select: { kind: true, at: true },
  });

  // The new standing comes back with the row, so the screen that just logged
  // a call can say "1 of 2 today" without a second request.
  return NextResponse.json({ attempt: created, standing: attemptStanding({ attempts, company }) }, { status: 201 });
}
