// app/api/ai-employee/suggestions/[id]/route.js
//
// What a person did with one draft.
//
//   PATCH { action: "sent" }      — it went out through the messaging feature's
//                                   own reply route; stamp it.
//   PATCH { action: "dismissed" } — nobody is sending this one.
//   PATCH { action: "resume" }    — un-stop a thread the employee handed off.
//
// ══ Why "sent" is stamped here and the SEND happens elsewhere ══════════════
//
// The send belongs to /api/messaging/threads/[id]/reply: it holds the
// permission check, the rate limit, the Meta call, the failure recording, and
// the honest 409 for a channel Meta has not approved. A second send path here
// would be a second copy of all of that, and the copy is the one that rots.
//
// So the screen posts the draft to THAT route and, on a 200, calls this to
// stamp the row. If this second call fails the suggestion stays in the list —
// a duplicate suggestion is something a person notices and ignores; a message
// silently sent twice to a homeowner is not recoverable.
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { memberOrRefusal } from "@/lib/apiMember";
import { requirePermission } from "@/lib/permissions";

const ACTIONS = ["sent", "dismissed", "resume"];

export async function PATCH(request, { params }) {
  const { id } = await params;

  const { member, response } = await memberOrRefusal(request);
  if (response) return response;
  try {
    requirePermission(member.role, "user:manage");
  } catch {
    return NextResponse.json(
      { error: "Only an owner or admin can act on the AI employee's drafts." },
      { status: 403 },
    );
  }

  const body = await request.json().catch(() => ({}));
  const action = String(body.action || "");
  if (!ACTIONS.includes(action)) {
    return NextResponse.json({ error: "Unknown action." }, { status: 400 });
  }

  const row = await db.aiEmployeeReply.findFirst({
    where: { id, companyId: member.companyId },
  });
  if (!row) return NextResponse.json({ error: "Not found." }, { status: 404 });

  if (action === "sent") {
    // Not re-stamped. A second "sent" for the same row means the screen
    // retried; the first timestamp is the true one.
    if (!row.sentAt) {
      await db.aiEmployeeReply.update({ where: { id: row.id }, data: { sentAt: new Date() } });
    }
    return NextResponse.json({ ok: true });
  }

  if (action === "dismissed") {
    // The draft TEXT survives. Dismissing is "not this one", not "erase the
    // record of what it cost to write" — the row is a spend record first.
    await db.aiEmployeeReply.update({
      where: { id: row.id },
      data: { suppressedReason: "dismissed_by_user" },
    });
    return NextResponse.json({ ok: true });
  }

  // resume: clear the handoff so the employee may answer this thread again.
  // Scoped to the THREAD rather than the row, because the stop is a property of
  // the conversation (lib/aiEmployee/decide.js reads a count over the thread)
  // and clearing one row of several would leave it stopped for a reason nobody
  // could see.
  await db.aiEmployeeReply.updateMany({
    where: { companyId: member.companyId, threadId: row.threadId, handedOff: true },
    data: { handedOff: false, handoffReason: null },
  });
  return NextResponse.json({ ok: true });
}
