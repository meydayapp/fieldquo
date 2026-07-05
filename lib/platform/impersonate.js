// lib/platform/impersonate.js
//
// "View as company" for support. This deliberately crosses the platform/company
// isolation boundary described earlier — that's the whole point of the feature — so
// it's built narrowly on purpose: very short-lived, single company, fully audit-logged,
// and issued through its own token type (never the real Better Auth session, never the
// platform-token). A platform admin using this never gets a real Member row or a real
// company login — just a temporary, revocable, logged read/write window.

import { SignJWT, jwtVerify } from "jose";
import { db } from "@/lib/db";

const IMPERSONATION_SECRET = new TextEncoder().encode(
  process.env.IMPERSONATION_JWT_SECRET,
);
const IMPERSONATION_DURATION = "30m";

export async function startImpersonation({
  platformAdminId,
  companyId,
  reason,
}) {
  const company = await db.company.findUnique({ where: { id: companyId } });
  if (!company) throw new Error("Company not found");

  await db.platformAuditLog.create({
    data: {
      platformAdminId,
      action: "impersonation_started",
      targetCompanyId: companyId,
      details: { reason: reason || null },
    },
  });

  const token = await new SignJWT({
    platformAdminId,
    companyId,
    impersonation: true,
  })
    .setProtectedHeader({ alg: "HS256" })
    .setExpirationTime(IMPERSONATION_DURATION)
    .setIssuedAt()
    .sign(IMPERSONATION_SECRET);

  return token;
}

export async function verifyImpersonationToken(token) {
  const { payload } = await jwtVerify(token, IMPERSONATION_SECRET);
  if (!payload.impersonation) return null;
  return {
    platformAdminId: payload.platformAdminId,
    companyId: payload.companyId,
  };
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
