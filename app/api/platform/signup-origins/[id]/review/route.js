// app/api/platform/signup-origins/[id]/review/route.js
//
// POST — "I looked at this signup." The ONE write on /platform/signup-origins,
// and it writes to SignupOrigin — FieldQuo's own record of where a request
// came from — never to the company's data. Non-negotiable #3 is intact.
//
// `signup:review` (admin and superadmin; support is refused with a 403 —
// scripts/check-signup-origin.mjs executes that). One direction: a reviewed
// row stays reviewed, and a second click is told so rather than re-stamping
// who looked first. The stamp and its audit row are one transaction
// (lib/platform/signupOrigin.js reviewSignupOrigin).
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { getCurrentPlatformAdmin } from "@/lib/platform/currentPlatformAdmin";
import { requirePlatformPermission } from "@/lib/platform/permissions";
import { containsMarkupCharacters } from "@/lib/security/rejectMarkupCharacters";
import { reviewSignupOrigin, shapeOrigin } from "@/lib/platform/signupOrigin";

const bad = (error, status = 400) => NextResponse.json({ error }, { status });

export async function POST(request, { params }) {
  const admin = await getCurrentPlatformAdmin(request);
  if (!admin) return bad("Unauthorized", 401);
  try {
    requirePlatformPermission(admin.role, "signup:review");
  } catch {
    return bad("Only an admin or a superadmin can mark a signup reviewed.", 403);
  }

  const { id } = await params;
  const body = await request.json().catch(() => ({}));
  const note = typeof body?.note === "string" ? body.note : "";
  // The note lands on the console and in the audit log; `<`/`>` have no
  // business in it (lib/security/rejectMarkupCharacters.js).
  if (containsMarkupCharacters(note)) return bad("The note can't contain < or >");

  const result = await reviewSignupOrigin({ id, adminId: admin.id, note });
  if (!result.ok) return bad(result.error, result.status || 400);
  return NextResponse.json({ ok: true, origin: shapeOrigin(result.origin) });
}
