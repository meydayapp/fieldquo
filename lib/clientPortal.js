// lib/clientPortal.js
//
// Mints and resolves the client portal token.
//
// `Client.portalToken` was in the schema and read by four API routes
// (portal/[token], .../pay, .../refer, .../request) but nothing ever wrote
// one, so the whole portal was unreachable. This is the missing half.
//
// Kept in lib rather than inline in a route because both the "share portal
// link" action and the "request payment" email need a token, and neither
// should care whether one already exists.

import { randomBytes } from "crypto";
import { getAppOrigin } from "@/lib/appUrl";

// 32 bytes of CSPRNG output. This token is the only thing between a stranger
// and a client's full billing history, so it has to be unguessable — cuid,
// which is sequential and timestamp-prefixed, would not be.
export function newPortalToken() {
  return randomBytes(32).toString("base64url");
}

// `request` is optional only so callers without one (a cron job, say) still
// work off the env var. Pass it whenever you have one — see lib/appUrl.js for
// why deriving the host from the request beats a build-time constant.
export function portalUrl(token, request) {
  return `${getAppOrigin(request)}/portal/${token}`;
}

// Deep-link straight to one invoice inside the portal — the page that actually
// shows the Pay button. The invoice email used to link to the portal HOME, so a
// client landed on a list and had to hunt for the invoice before they could
// pay. Sending them one click from a card payment is the whole point of an
// online invoice.
export function portalInvoiceUrl(token, invoiceId, request) {
  return `${getAppOrigin(request)}/portal/${token}/invoices/${invoiceId}`;
}

/**
 * Returns this client's portal token, creating one on first use.
 *
 * Idempotent on purpose: existing links stay valid, so emailing a client a
 * second time doesn't invalidate the first email they're still looking at.
 * Rotation is a separate, deliberate act — see rotatePortalToken.
 */
export async function ensurePortalToken(db, clientId, companyId) {
  const client = await db.client.findFirst({
    where: { id: clientId, ...(companyId ? { companyId } : {}) },
    select: { id: true, portalToken: true },
  });
  if (!client) return null;

  if (client.portalToken) return client.portalToken;

  const token = newPortalToken();
  await db.client.update({
    where: { id: client.id },
    data: { portalToken: token },
  });
  return token;
}

/** Burns the old link. For when the wrong person ended up with a copy. */
export async function rotatePortalToken(db, clientId, companyId) {
  const client = await db.client.findFirst({
    where: { id: clientId, ...(companyId ? { companyId } : {}) },
    select: { id: true },
  });
  if (!client) return null;

  const token = newPortalToken();
  await db.client.update({
    where: { id: client.id },
    data: { portalToken: token },
  });
  return token;
}
