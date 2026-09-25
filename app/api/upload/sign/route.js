// app/api/upload/sign/route.js
//
// Step one of a staff upload: sign a direct browser → Cloudinary upload.
// The file never passes through this server — Vercel refuses a request body
// over ~4.5 MB at the edge, which is most phone photos. See
// lib/media/directUpload.js for what is decided here and what is re-checked
// at /api/upload/verify. /api/upload (multipart through this server) is kept
// for anything that has not moved.
export const runtime = "nodejs";

import { memberOrRefusal } from "@/lib/apiMember";
import { uploadScope } from "@/lib/media/directUpload";
import { signResponse, readJsonBody } from "@/lib/media/directUploadServer";

export async function POST(request) {
  const { member, response } = await memberOrRefusal(request);
  if (response) return response;
  const body = await readJsonBody(request);
  // The company comes from the session; the purpose only picks a sub-folder
  // from a closed list (MEMBER_PURPOSES).
  const scope = uploadScope("member", { companyId: member.companyId, purpose: body.purpose });
  return signResponse(scope, body);
}
