// app/api/ai-employee/sources/[id]/route.js
//
// Remove one piece of resource material.
//
// A real delete, and it is labelled as one on the screen. This is the one
// destructive control in the feature and the row is the ONLY copy of the text
// — there is no file on a CDN behind it (see the sources route's header), so
// "remove" cannot mean "unlink and keep". Saying so is the whole of the
// difference between this and a destructive operation labelled as cosmetic.
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { memberOrRefusal } from "@/lib/apiMember";
import { requirePermission } from "@/lib/permissions";

export async function DELETE(request, { params }) {
  // Promises in Next 16 — both params and searchParams.
  const { id } = await params;

  const { member, response } = await memberOrRefusal(request);
  if (response) return response;
  try {
    requirePermission(member.role, "user:manage");
  } catch {
    return NextResponse.json(
      { error: "Only an owner or admin can manage the AI employee's material." },
      { status: 403 },
    );
  }

  // deleteMany with the company in the WHERE rather than delete-by-id: an id
  // from another tenant deletes nothing instead of throwing a 500 that
  // confirms the row exists.
  const { count } = await db.aiEmployeeSource.deleteMany({
    where: { id, companyId: member.companyId },
  });

  if (!count) return NextResponse.json({ error: "Not found." }, { status: 404 });
  return NextResponse.json({ ok: true });
}
