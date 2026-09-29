// lib/hr/documentOpen.js
//
// May this member open this HR document, and if so, where to send them.
// GET /api/hr/documents/[id]/open is two lines around this; the database and
// the Cloudinary signer are injected so scripts/check-hr.mjs runs the exact
// decision against two companies. Storage rules: lib/hr/documentFile.js.
import { canManageHr, myWorker } from "@/lib/hr/access";
import { hrFileLocation, signedOpenLink } from "@/lib/hr/documentFile";

const NOT_FOUND = { status: 404, error: "Not found" };

/**
 * Two doors, exactly as the rest of the HR file (lib/hr/access.js):
 *   - a manager (`user:manage`) may open any document in their company,
 *     archived ones included — the manager screen lists those;
 *   - anybody else may open a document only when it is on their OWN file and
 *     not archived — exactly the rows /api/hr/me/documents shows them.
 * Everything else is "Not found", the same answer as a document that does not
 * exist, so the route cannot be used to learn which ids are real.
 *
 * @returns {Promise<{ status: 302, url, expiresAt } | { status, error }>}
 */
export async function openHrDocument(db, { member, id, cloudName, sign, now = Date.now() } = {}) {
  if (!member?.companyId || typeof id !== "string" || !id || id.length > 64) return NOT_FOUND;
  const doc = await db.workerDocument.findFirst({
    where: { id, companyId: member.companyId },
    select: { id: true, workerId: true, fileUrl: true, archivedAt: true },
  });
  if (!doc) return NOT_FOUND;

  if (!canManageHr(member)) {
    const mine = await myWorker(db, member);
    if (!mine || mine.id !== doc.workerId || doc.archivedAt) return NOT_FOUND;
  }

  if (!cloudName || typeof sign !== "function") {
    return { status: 503, error: "Files can't be opened right now — file storage isn't configured." };
  }
  const location = hrFileLocation(doc.fileUrl, { cloudName, companyId: member.companyId });
  if (!location.ok) {
    return { status: 409, error: "This file isn't stored where FieldQuo can open it. Upload it again." };
  }
  const link = signedOpenLink(location, { sign, now });
  return { status: 302, url: link.url, expiresAt: link.expiresAt };
}
