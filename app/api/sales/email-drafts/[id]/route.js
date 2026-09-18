// app/api/sales/email-drafts/[id]/route.js
//
// Discard one draft. The rep's own, or nothing happens and the answer says
// so — the one delete in the outreach paths, and it deletes a draft, never a
// message or a thread (lib/sales/outreachGate.js).
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireOutreachRep } from "@/lib/sales/outreachGate";
import { discardDraft } from "@/lib/sales/emailDrafts";

export async function DELETE(request, { params }) {
  const { rep, refusal } = await requireOutreachRep(request);
  if (refusal) return NextResponse.json(refusal.body, { status: refusal.status });
  const { id } = await params;
  const gone = await discardDraft(db, rep.id, id);
  if (!gone) return NextResponse.json({ error: "Not found." }, { status: 404 });
  return NextResponse.json({ discarded: true });
}
