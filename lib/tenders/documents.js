// lib/tenders/documents.js
//
// What a browser may file as a document on a tender. The bytes went straight
// to Cloudinary through the shared uploader (uploadFile in
// lib/media/uploadClient.js — signed, verified), so this route never sees a
// file; it sees a URL, and a URL is a claim. Proved here: it is OUR Cloudinary (isOurCloudinaryUrl), and it sits
// in THIS company's folder for the purpose tender files are uploaded under
// (lib/media/directUpload.js uploadScope). A URL into another company's
// folder, another cloud, or a lookalike host is refused — otherwise a tender
// could be made to link someone else's drawings under our name.
import { isOurCloudinaryUrl } from "@/lib/receipts/pdf";
import { uploadScope } from "@/lib/media/directUpload";
import { TENDER_DOCUMENT_KINDS, TENDER_UPLOAD_PURPOSE, LIMITS } from "./constants";

/** Is this URL an upload in this company's tender-file folder? */
export function isCompanyTenderUpload(url, companyId, cloudName = process.env.CLOUDINARY_CLOUD_NAME) {
  if (!isOurCloudinaryUrl(url, cloudName)) return false;
  const scope = uploadScope("member", { companyId, purpose: TENDER_UPLOAD_PURPOSE });
  if (!scope.ok) return false;
  let pathname;
  try {
    pathname = decodeURIComponent(new URL(url).pathname);
  } catch {
    return false;
  }
  if (pathname.includes("..")) return false;
  // /<cloud>/<image|raw|video>/upload/v123/<folder>/<uuid>[.ext]
  const marker = `/${scope.folder}/`;
  const at = pathname.indexOf(marker);
  if (at < 0) return false;
  const rest = pathname.slice(at + marker.length);
  return /^[0-9a-f-]{36}(\.[a-z0-9]{1,5})?$/i.test(rest);
}

/**
 * @returns {{ ok: true, data } | { ok: false, status, error }}
 */
export function parseTenderDocument(body, { companyId, cloudName } = {}) {
  if (!body || typeof body !== "object") return { ok: false, status: 400, error: "Send the uploaded file's details." };
  const url = typeof body.url === "string" ? body.url.trim() : "";
  if (!url || !isCompanyTenderUpload(url, companyId, cloudName)) {
    return { ok: false, status: 400, error: "That file wasn't uploaded here. Upload it again." };
  }
  const rawName = typeof body.name === "string" ? body.name.trim() : "";
  if (!rawName) return { ok: false, status: 400, error: "Give the document a name." };
  if (rawName.length > LIMITS.documentName) return { ok: false, status: 400, error: `The name is longer than ${LIMITS.documentName} characters.` };
  const kind = body.kind === undefined || body.kind === null || body.kind === "" ? "other" : body.kind;
  if (!TENDER_DOCUMENT_KINDS.includes(kind)) return { ok: false, status: 400, error: "Pick what kind of document this is from the list." };
  const mimeType = typeof body.mimeType === "string" && body.mimeType.length <= 120 ? body.mimeType : null;
  const size = Number(body.sizeBytes);
  const sizeBytes = Number.isInteger(size) && size >= 0 && size < 2_000_000_000 ? size : null;
  return { ok: true, data: { name: rawName, kind, url, mimeType, sizeBytes } };
}
