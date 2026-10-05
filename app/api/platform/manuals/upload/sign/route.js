// app/api/platform/manuals/upload/sign/route.js
//
// Step one of a FieldQuo upload into the shared manual library: sign a
// direct browser → Cloudinary upload into FieldQuo's OWN private folder
// (lib/aiEmployee/sharedLibrary.js SHARED_LIBRARY_SCOPE, purpose
// "reference", delivery type "authenticated"). The same signing a company's
// reference upload goes through (lib/media/directUpload.js), pointed at a
// folder no company id can name. Platform admins with
// manual_library:manage only.
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { getCurrentPlatformAdmin } from "@/lib/platform/currentPlatformAdmin";
import { requirePlatformPermission } from "@/lib/platform/permissions";
import { uploadScope } from "@/lib/media/directUpload";
import { signResponse, readJsonBody } from "@/lib/media/directUploadServer";
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
  return signResponse(uploadScope("member", { companyId: SHARED_LIBRARY_SCOPE, purpose: "reference" }), body);
}
