// app/api/upload/verify/route.js
//
// Step two of a staff upload: confirm what the browser says Cloudinary stored
// before anything is saved against it. Answers the same { url, publicId,
// kind, filename } /api/upload always answered, plus the authoritative byte
// count. See lib/media/directUpload.js.
export const runtime = "nodejs";

import { memberOrRefusal } from "@/lib/apiMember";
import { uploadScope } from "@/lib/media/directUpload";
import { verifyResponse, readJsonBody } from "@/lib/media/directUploadServer";

export async function POST(request) {
  const { member, response } = await memberOrRefusal(request);
  if (response) return response;
  const body = await readJsonBody(request);
  // Same scope as the sign — a public_id minted for another company or
  // another purpose's folder does not match it and is refused.
  const scope = uploadScope("member", { companyId: member.companyId, purpose: body.purpose });
  return verifyResponse(scope, body);
}
