// app/api/platform/manuals/upload/verify/route.js
//
// Step two of a FieldQuo upload into the shared manual library: confirm what
// Cloudinary stored, under the same FieldQuo-only scope the sign used — a
// public_id minted for any company's folder does not match it and is
// refused. See ../sign/route.js.
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { getCurrentPlatformAdmin } from "@/lib/platform/currentPlatformAdmin";
import { requirePlatformPermission } from "@/lib/platform/permissions";
import { uploadScope } from "@/lib/media/directUpload";
import { verifyResponse, readJsonBody } from "@/lib/media/directUploadServer";
import { SHARED_LIBRARY_SCOPE } from "@/lib/aiEmployee/sharedLibrary";

export async function POST(request) {
  const admin = await getCurrentPlatformAdmin(request);
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    requirePlatformPermission(admin.role, "manual_library:manage");
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: err.status || 403 });
  }
  const body = await readJsonBody(request);
  return verifyResponse(uploadScope("member", { companyId: SHARED_LIBRARY_SCOPE, purpose: "reference" }), body);
}
