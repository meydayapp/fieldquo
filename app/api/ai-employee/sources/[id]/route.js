// app/api/ai-employee/sources/[id]/route.js
//
//   PATCH  → a reference-library file's tags (brand, model, equipment, trade)
//   DELETE → remove one piece of resource material
//
// The DELETE is a real delete, and it is labelled as one on the screen. For
// a text source the row is the ONLY copy of the text, so "remove" cannot mean
// "unlink and keep". For a reference-library file (2026-10-04) the row, its
// pages and the error codes extracted from it go together (the schema
// cascades them); the stored PDF itself is left in the company's private
// Cloudinary folder rather than deleted — the same no-deletion rule every
// upload follows (lib/media/directUpload.js) — and nothing links to it any
// more. Saying so is the whole of the difference between this and a
// destructive operation labelled as cosmetic.
//
// The tags are WRITTEN here and READ by the retrieval (lib/aiEmployee/
// sources.js equipmentTier / sourceTagScore, via respond.js) and by "Extract
// error codes" (the brand every extracted row is filed under).
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { memberOrRefusal } from "@/lib/apiMember";
import { requirePermission } from "@/lib/permissions";
import { cleanTags } from "@/lib/aiEmployee/reference";
import { SOURCE_KINDS } from "@/lib/aiEmployee/sources";

async function admin(request) {
  const { member, response } = await memberOrRefusal(request);
  if (response) return { response };
  try {
    requirePermission(member.role, "user:manage");
  } catch {
    return {
      response: NextResponse.json(
        { error: "Only an owner or admin can manage the AI employee's material." },
        { status: 403 },
      ),
    };
  }
  return { member };
}

export async function PATCH(request, { params }) {
  const { id } = await params;
  const { member, response } = await admin(request);
  if (response) return response;
  const body = await request.json().catch(() => ({}));
  const data = { ...cleanTags(body?.tags || {}) };
  if (SOURCE_KINDS.includes(body?.kind)) data.kind = body.kind;
  // updateMany with the company in the WHERE: another tenant's id updates
  // nothing and says "Not found".
  const { count } = await db.aiEmployeeSource.updateMany({ where: { id, companyId: member.companyId }, data });
  if (!count) return NextResponse.json({ error: "Not found." }, { status: 404 });
  return NextResponse.json({ ok: true, tags: { trade: data.trade, brand: data.brand, modelPattern: data.modelPattern, category: data.category } });
}

export async function DELETE(request, { params }) {
  // Promises in Next 16 — both params and searchParams.
  const { id } = await params;

  const { member, response } = await admin(request);
  if (response) return response;

  // deleteMany with the company in the WHERE rather than delete-by-id: an id
  // from another tenant deletes nothing instead of throwing a 500 that
  // confirms the row exists.
  const { count } = await db.aiEmployeeSource.deleteMany({
    where: { id, companyId: member.companyId },
  });

  if (!count) return NextResponse.json({ error: "Not found." }, { status: 404 });
  return NextResponse.json({ ok: true });
}
