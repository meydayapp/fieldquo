// lib/platform/impersonate.js
//
// "View as company" for support. READ-ONLY, superadmin only.
//
// This deliberately crosses the platform/company isolation boundary — that's
// the point of the feature — so it's built as narrowly as it can be:
//
//   * superadmin only. Support-tier admins never get it.
//   * read-only, enforced server-side in lib/currentMember.js. Not "the UI
//     hides the buttons" — every non-GET request under an impersonation
//     session is rejected before it reaches a handler. A crafted POST fails
//     the same way a clicked one does.
//   * 30 minutes, then dead.
//   * its own token type. Never the real Better Auth session, never the
//     platform-token. A platform admin using this gets no Member row and no
//     company login.
//   * every start and end written to PlatformAuditLog with a name attached.
//
// Because it can't write, it needs no consent code from the customer: there
// is nothing an admin can do through it that they couldn't do by reading the
// database directly. If write access is ever added, that changes — a consent
// code becomes mandatory at that point, because support could otherwise alter
// a customer's records without them knowing.

import { SignJWT } from "jose";
import { db } from "@/lib/db";
import {
  IMPERSONATION_COOKIE,
  IMPERSONATION_DURATION_SECONDS,
  impersonationSecret,
  verifyImpersonationToken,
} from "./impersonationToken";

// Re-exported so callers have one import site and don't have to know which
// half of this pair is Edge-safe.
export {
  IMPERSONATION_COOKIE,
  IMPERSONATION_DURATION_SECONDS,
  verifyImpersonationToken,
};

export async function startImpersonation({
  platformAdminId,
  companyId,
  reason,
}) {
  const company = await db.company.findUnique({ where: { id: companyId } });
  if (!company) {
    const err = new Error("Company not found");
    err.status = 404;
    throw err;
  }

  // Authorisation is re-checked here rather than trusted from the caller.
  // This function mints a credential that crosses a tenant boundary; it
  // shouldn't be obtainable by finding a route that forgot to check the role.
  const admin = await db.platformAdmin.findUnique({
    where: { id: platformAdminId },
    select: { id: true, role: true, active: true, email: true },
  });

  if (!admin?.active) {
    const err = new Error("Your platform account is no longer active.");
    err.status = 403;
    throw err;
  }

  if (admin.role !== "superadmin") {
    const err = new Error(
      "Only superadmins can view a company's account. Work from the company record and audit log instead, or ask a superadmin.",
    );
    err.status = 403;
    throw err;
  }

  await db.platformAuditLog.create({
    data: {
      platformAdminId,
      action: "impersonation_started",
      targetCompanyId: companyId,
      details: { reason: reason || null, mode: "read_only" },
    },
  });

  return new SignJWT({
    platformAdminId,
    companyId,
    impersonation: true,
    // Explicit, not implied. If a write-capable mode is ever added, tokens
    // minted today must not silently qualify for it.
    mode: "read_only",
  })
    .setProtectedHeader({ alg: "HS256" })
    .setExpirationTime(`${IMPERSONATION_DURATION_SECONDS}s`)
    .setIssuedAt()
    .sign(impersonationSecret());
}

export async function endImpersonation({ platformAdminId, companyId }) {
  await db.platformAuditLog.create({
    data: {
      platformAdminId,
      action: "impersonation_ended",
      targetCompanyId: companyId,
    },
  });
}
