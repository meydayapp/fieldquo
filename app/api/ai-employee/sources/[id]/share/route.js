// app/api/ai-employee/sources/[id]/share/route.js
//
// "Share this manufacturer's manual with FieldQuo's library" — the ONE door
// from a company's private reference library into the library every
// company's AI team reads (lib/aiEmployee/sharedLibrary.js).
//
//   POST   { confirmed: true } → the company confirms this is the
//          manufacturer's own, unmodified manual. The page text is copied
//          into the library as "pending"; nothing reaches another company
//          until FieldQuo reviews it on /platform/manuals.
//   DELETE → stop sharing. A copy still pending review is withdrawn; one
//          FieldQuo has made live stays in the library (it is the
//          manufacturer's document), and this manual is simply no longer
//          marked as shared.
//
// Only a `kind: "manual"` PDF that was read and tagged with its brand can be
// shared (canShare) — never a policy, a troubleshooting guide or an SOP.
// Owner/admin only; a support session is refused (non-negotiable #3).
export const runtime = "nodejs";
export const maxDuration = 60;

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { memberOrRefusal } from "@/lib/apiMember";
import { requirePermission } from "@/lib/permissions";
import { recordActivity } from "@/lib/activity/log";
import { shareSource, withdrawShare } from "@/lib/aiEmployee/sharedLibrary";

async function admin(request) {
  const { member, response } = await memberOrRefusal(request);
  if (response) return { response };
  if (member.impersonation) return { response: NextResponse.json({ error: "Support sessions are read-only." }, { status: 403 }) };
  try {
    requirePermission(member.role, "user:manage");
  } catch {
    return { response: NextResponse.json({ error: "Only an owner or admin can manage the AI employee's material." }, { status: 403 }) };
  }
  return { member };
}

const REFUSALS = Object.freeze({
  not_confirmed: "Confirm it's the manufacturer's own, unmodified manual first.",
  not_a_manual: "Only a manufacturer's manual can be shared — not a policy, a guide or your own procedures.",
  no_file: "This one has no stored file to share.",
  not_a_pdf: "Only a PDF manual can be shared.",
  not_read: "This manual hasn't been read yet.",
  no_brand: "Tag the brand first, so the right manual reaches the right furnace.",
  not_found: "Not found",
});

export async function POST(request, { params }) {
  const { member, response } = await admin(request);
  if (response) return response;
  const { id } = await params;
  const body = await request.json().catch(() => ({}));
  const res = await shareSource({ prisma: db, companyId: member.companyId, sourceId: String(id || ""), confirmed: body?.confirmed === true });
  if (!res.ok) return NextResponse.json({ error: REFUSALS[res.reason] || "That didn't work.", reason: res.reason }, { status: res.status || 400 });
  if (!res.already) {
    await recordActivity(member, {
      action: "ai_employee.manual_shared",
      entityType: "settings",
      entityId: member.companyId,
      summary: "Shared a manufacturer's manual with FieldQuo's library",
      summaryKey: "app.activity.event.aiEmployee.manualShared",
      summaryParams: {},
    }).catch(() => {});
  }
  return NextResponse.json({ ok: true, shared: true, deduplicated: Boolean(res.deduplicated) });
}

export async function DELETE(request, { params }) {
  const { member, response } = await admin(request);
  if (response) return response;
  const { id } = await params;
  const res = await withdrawShare({ prisma: db, companyId: member.companyId, sourceId: String(id || "") });
  if (!res.ok) return NextResponse.json({ error: "Not found" }, { status: res.status || 404 });
  return NextResponse.json({ ok: true, shared: false, libraryStatus: res.manualStatus || null });
}
