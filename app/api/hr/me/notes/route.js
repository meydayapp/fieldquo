// app/api/hr/me/notes/route.js — what my managers wrote that I may see.
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { hrSelfOrRefusal } from "@/lib/hr/gate";
import { NOTE_SELECT, serialiseForWorker } from "@/lib/hr/notes";

export async function GET(request) {
  const { member, worker, response } = await hrSelfOrRefusal(request);
  if (response) return response;
  const notes = await db.workerNote.findMany({
    where: { companyId: member.companyId, workerId: worker.id, visibleToWorker: true },
    select: NOTE_SELECT,
    orderBy: { occurredAt: "desc" },
  });
  return NextResponse.json({ worker: { id: worker.id, name: worker.name }, notes: notes.map(serialiseForWorker) });
}
