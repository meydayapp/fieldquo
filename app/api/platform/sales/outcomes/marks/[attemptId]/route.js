// app/api/platform/sales/outcomes/marks/[attemptId]/route.js
//
// A superadmin's bookmarks on a recording, on playback
// (lib/sales/calls/recordingMarks.js). GET lists every mark on the call —
// the rep's and the platform's — and POST { atSeconds, note } adds one at
// the second the player was at. Superadmin only.
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { requireSuperadmin } from "@/lib/platform/superadminGate";
import { MARK_AUTHOR_PLATFORM, addMark, listMarks, parseMark } from "@/lib/sales/calls/recordingMarks";

export async function GET(request, { params }) {
  const { attemptId } = await params;
  const { refusal } = await requireSuperadmin(request, "read recording marks");
  if (refusal) return refusal;
  return NextResponse.json({ marks: await listMarks({ attemptId: String(attemptId || "") }) });
}

export async function POST(request, { params }) {
  const { attemptId } = await params;
  const { admin, refusal } = await requireSuperadmin(request, "mark a recording");
  if (refusal) return refusal;
  const body = await request.json().catch(() => ({}));
  // On playback the second is the player's, and required: a platform mark
  // with no second would be stamped "now − answeredAt" of a call that
  // ended days ago.
  const parsed = parseMark(body, { requireSeconds: true });
  if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 });
  const r = await addMark({ where: { id: String(attemptId || "") }, author: { kind: MARK_AUTHOR_PLATFORM, id: admin.id, name: admin.name || "FieldQuo" }, body });
  if (!r.ok) return NextResponse.json({ error: r.error }, { status: r.status });
  return NextResponse.json({ ok: true, mark: r.mark });
}
