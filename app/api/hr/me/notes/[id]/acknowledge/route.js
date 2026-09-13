// app/api/hr/me/notes/[id]/acknowledge/route.js — "I have seen this." A
// typed name, once; a second tap answers the existing stamp.
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { hrSelfOrRefusal } from "@/lib/hr/gate";
import { NOTE_SELECT, serialiseForWorker } from "@/lib/hr/notes";

export async function POST(request, { params }) {
  const { id } = await params;
  const { member, worker, response } = await hrSelfOrRefusal(request);
  if (response) return response;

  const note = await db.workerNote.findFirst({
    where: { id, companyId: member.companyId, workerId: worker.id, visibleToWorker: true },
    select: NOTE_SELECT,
  });
  if (!note) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (!note.requiresAcknowledgement) return NextResponse.json({ error: "This note doesn't ask for an acknowledgement." }, { status: 400 });
  if (note.acknowledgedAt) return NextResponse.json({ note: serialiseForWorker(note), already: true });

  const raw = await request.json().catch(() => ({}));
  const signatureName = typeof raw?.signatureName === "string" ? raw.signatureName.trim().slice(0, 80) : "";
  if (!signatureName) return NextResponse.json({ error: "Type your full name to acknowledge." }, { status: 400 });

  const updated = await db.workerNote.update({
    where: { id: note.id },
    data: { acknowledgedAt: new Date(), acknowledgedName: signatureName },
    select: NOTE_SELECT,
  });
  return NextResponse.json({ note: serialiseForWorker(updated) });
}
