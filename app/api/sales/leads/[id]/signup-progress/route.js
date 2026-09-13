// app/api/sales/leads/[id]/signup-progress/route.js
//
// Where the prospect is in the signup the rep just texted them — for the
// rep who texted it, polled every ten seconds while the call is live.
//
// ══ Scope ═════════════════════════════════════════════════════════════════
//
// Two reads, both scoped to the caller: the lead must be THEIRS
// (lib/sales/outreach.js leadWhere, the same 404 every other lead read
// answers with), and the progress row must be one THEIR link created
// (SalesSignupProgress.salesRepId — lib/sales/signupProgress.js
// signupProgressForRep). A rep who has the lead but never texted the link
// gets 404 too: there is no progress to show, and "no row" and "not yours"
// look the same on purpose.
//
// ══ What comes back ═══════════════════════════════════════════════════════
//
// signupProgressView(): the six steps with their instants, the current one,
// whether it is stuck and for how long, and the poll interval the panel
// should use — computed on the server's clock, so a browser with a wrong
// clock still says "3 min". Nothing about the contractor beyond instants.
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireOutreachRep } from "@/lib/sales/outreachGate";
import { leadWhere } from "@/lib/sales/outreach";
import { PROGRESS_POLL_MS, STUCK_AFTER_MS, signupProgressForRep } from "@/lib/sales/signupProgress";

export async function GET(request, { params }) {
  const { rep, refusal } = await requireOutreachRep(request);
  if (refusal) return NextResponse.json(refusal.body, { status: refusal.status });
  const { id } = await params;

  const lead = await db.salesLead.findFirst({ where: leadWhere(rep.id, id), select: { id: true } });
  if (!lead) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const now = new Date();
  const progress = await signupProgressForRep({ client: db, leadId: lead.id, salesRepId: rep.id, now });
  if (!progress) return NextResponse.json({ error: "Not found" }, { status: 404 });

  return NextResponse.json({
    progress,
    pollMs: PROGRESS_POLL_MS,
    stuckAfterMs: STUCK_AFTER_MS,
    serverNow: now.toISOString(),
  });
}
