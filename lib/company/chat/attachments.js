// lib/company/chat/attachments.js
//
// What a chat message may carry as files, checked on the way IN.
//
// ══ Private, like an HR document (owner decision 2026-10-04) ═══════════════
//
// The composer uploads through the one upload helper with purpose "chat"
// (lib/media/uploadClient.js — sign → Cloudinary → verify). "chat" is a
// PRIVATE purpose (lib/media/directUpload.js PRIVATE_MEMBER_PURPOSES): the
// sign step signs `type=authenticated`, so Cloudinary itself refuses the
// plain URL, and verify refuses an asset stored under any other type. The
// browser then posts the verified entries with the message.
//
// An entry the browser relays is a CLAIM. It is accepted here only when its
// URL is one of OUR cloud's "authenticated" URLs, its public id is exactly
// one the chat scope could have minted for THIS company (isOwnPublicId — the
// tenant boundary for signing later: the file route signs whatever the row
// names, so a row must only ever name a file inside its own company's chat
// folder), and the URL and the id agree. The same two locks HR uses
// (lib/hr/documentFile.js isPrivateHrFileUrl), not a copy of them.
//
// What is stored: { type, url, publicId, mimeType, filename, bytes, width,
// height }. `url` and `publicId` never leave the server again — the thread
// carries display facts plus a short-lived, per-reader link
// (lib/company/chat/fileLinks.js).
//
// Pure: no SDK, no database. scripts/check-company-chat.mjs runs it against
// hostile input.
import { uploadScope, isOwnPublicId } from "@/lib/media/directUpload";
import { parseCloudinaryFileUrl } from "@/lib/hr/documentFile";
import { safeFilename } from "@/lib/media/validate";
import { CHAT_ATTACHMENTS_MAX, CHAT_DOCUMENT_MAX_BYTES } from "./rules";

/** The delivery type every chat file is stored under. */
export const CHAT_DELIVERY_TYPE = "authenticated";

/** The upload purpose the composer names, and the folder it maps to. */
export const CHAT_PURPOSE = "chat";

// What a document's extension says it is — for the file row's icon and the
// Content-Type the browser is told. Never trusted for a decision.
const DOC_MIME = {
  pdf: "application/pdf",
  txt: "text/plain",
  doc: "application/msword",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  xls: "application/vnd.ms-excel",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  ppt: "application/vnd.ms-powerpoint",
  pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
};
const PHOTO_MIME = { jpg: "image/jpeg", jpeg: "image/jpeg", png: "image/png", webp: "image/webp", gif: "image/gif", heic: "image/heic", heif: "image/heif" };

const positiveInt = (v, max) => {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 && n <= max ? Math.round(n) : null;
};

/**
 * The attachments a browser sent with a message, checked.
 *
 * @param list  [{ url, publicId, kind, filename, bytes, width?, height? }] —
 *              uploadFile's entries
 * @returns { ok: true, attachments } | { ok: false, code: "bad_attachment", error }
 */
export function parseChatAttachments(list, { companyId, cloudName } = {}) {
  const refuse = (error) => ({ ok: false, code: "bad_attachment", error });
  if (list === undefined || list === null) return { ok: true, attachments: [] };
  if (!Array.isArray(list)) return refuse("Those files couldn't be attached. Attach them again.");
  if (list.length > CHAT_ATTACHMENTS_MAX) return refuse(`Send at most ${CHAT_ATTACHMENTS_MAX} files in one message.`);
  if (!cloudName) return refuse("Files can't be attached right now — file storage isn't configured.");
  const scope = uploadScope("member", { companyId, purpose: CHAT_PURPOSE });
  if (!scope.ok) return refuse("Those files couldn't be attached. Attach them again.");

  const out = [];
  for (const raw of list) {
    if (!raw || typeof raw !== "object") return refuse("Those files couldn't be attached. Attach them again.");
    const parsed = parseCloudinaryFileUrl(typeof raw.url === "string" ? raw.url : "", { cloudName });
    if (!parsed || parsed.deliveryType !== CHAT_DELIVERY_TYPE) return refuse("Those files couldn't be attached. Attach them again.");
    if (parsed.resourceType === "video") return refuse("Photos and documents only — videos can't be sent in chat.");
    if (parsed.resourceType !== "image" && parsed.resourceType !== "raw") return refuse("Those files couldn't be attached. Attach them again.");
    const publicId = typeof raw.publicId === "string" ? raw.publicId : "";
    if (publicId !== parsed.publicId) return refuse("Those files couldn't be attached. Attach them again.");
    if (!isOwnPublicId(publicId, scope, parsed.resourceType)) return refuse("Those files couldn't be attached. Attach them again.");

    const type = parsed.resourceType === "image" ? "photo" : "document";
    const ext = type === "document" ? (publicId.split(".").pop() || "").toLowerCase() : parsed.format;
    const bytes = positiveInt(raw.bytes, 200 * 1024 * 1024);
    if (type === "document" && bytes && bytes > CHAT_DOCUMENT_MAX_BYTES) {
      return refuse("That document is larger than 25 MB. Send a smaller copy.");
    }
    out.push({
      type,
      url: `https://res.cloudinary.com/${cloudName}/${parsed.resourceType}/${CHAT_DELIVERY_TYPE}/v${parsed.version}/${parsed.tail}`,
      publicId,
      mimeType: (type === "photo" ? PHOTO_MIME[ext] : DOC_MIME[ext]) || null,
      filename: safeFilename(typeof raw.filename === "string" ? raw.filename : "") || null,
      bytes,
      width: type === "photo" ? positiveInt(raw.width, 20000) : null,
      height: type === "photo" ? positiveInt(raw.height, 20000) : null,
    });
  }
  return { ok: true, attachments: out };
}

/**
 * Where a STORED attachment's file is, for signing — or null when the row
 * does not name a private file in this company's chat folder (the second
 * lock, for a row written before the first existed).
 */
export function chatFileLocation(attachment, { companyId, cloudName } = {}) {
  if (!attachment || typeof attachment.url !== "string") return null;
  const parsed = parseCloudinaryFileUrl(attachment.url, { cloudName });
  if (!parsed || parsed.deliveryType !== CHAT_DELIVERY_TYPE) return null;
  const scope = uploadScope("member", { companyId, purpose: CHAT_PURPOSE });
  if (!scope.ok || !isOwnPublicId(parsed.publicId, scope, parsed.resourceType)) return null;
  return parsed;
}
