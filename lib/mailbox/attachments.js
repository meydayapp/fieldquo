// lib/mailbox/attachments.js
//
// A filed email's attachments → Cloudinary, in Message.attachments' shape.
//
// The upload itself is lib/sales/inboundAttachments.js's storeAttachmentBuffers
// — the same path the sales mailbox uses, so "a stored file" means one thing
// to lib/messaging/attachments.js's publicAttachments whichever door the
// email came through. What this adds is the CAP, tighter than that file's
// 25 MB, because a contractor's client mail is full of phone photos and
// forwarded PDFs and every byte is Cloudinary storage FieldQuo pays for:
//
//   · at most MAX_FILES per message, each at most MAX_FILE_BYTES;
//   · anything over either is recorded by name with no url — the inbox draws
//     it as a file that is not here ("still in your mailbox"), never as a
//     broken link and never with a Retry that could not succeed (an entry
//     with a fetchError reads as retryable; these carry none).

import { storeAttachmentBuffers, attachmentTypeFor } from "@/lib/sales/inboundAttachments";

export const MAX_FILE_BYTES = 10 * 1024 * 1024;
export const MAX_FILES = 10;

export async function storeEmailAttachments({ files, companyId, upload } = {}) {
  const list = Array.isArray(files) ? files : [];
  const keep = [];
  const named = [];
  list.forEach((f, i) => {
    const bytes = Buffer.isBuffer(f?.content) ? f.content.length : Number(f?.size) || null;
    if (i >= MAX_FILES || !Buffer.isBuffer(f?.content) || (bytes && bytes > MAX_FILE_BYTES)) {
      named.push({ type: attachmentTypeFor(f?.contentType), url: null, mimeType: f?.contentType || null, filename: f?.filename || "attachment", bytes });
    } else {
      keep.push(f);
    }
  });
  let stored = [];
  if (keep.length) {
    const result = await storeAttachmentBuffers({ files: keep, folder: `mailbox/${companyId}`, ...(upload ? { uploadImpl: upload } : {}) });
    // An upload that failed keeps its name and loses its error, for the
    // reason in the header: no retry path exists for bytes we no longer hold.
    stored = (result.stored || []).map(({ fetchError, fetchAttempts, ...rest }) => rest);
  }
  return [...stored, ...named];
}
