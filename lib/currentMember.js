// lib/currentMember.js
import { auth } from "./auth";
import { db } from "./db";

export async function getCurrentMember(request) {
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session?.user?.id) {
    console.error("[getCurrentMember] No authenticated user");
    return null;
  }

  const userId = session.user.id;
  const activeOrganizationId = session.session?.activeOrganizationId || null;

  if (activeOrganizationId) {
    const company = await db.company.findUnique({
      where: { authOrgId: activeOrganizationId },
      select: { id: true, authOrgId: true },
    });

    if (company) {
      const member = await db.member.findUnique({
        where: { userId_companyId: { userId, companyId: company.id } },
        select: { role: true, active: true },
      });

      if (member?.active) {
        return {
          userId,
          companyId: company.id,
          authOrgId: company.authOrgId,
          role: member.role,
        };
      }
    }
  }

  // Fallback — covers sessions where activeOrganizationId never got set
  // (e.g. accounts created before nextCookies() was wired in).
  const fallbackMember = await db.member.findFirst({
    where: { userId, active: true },
    orderBy: { createdAt: "asc" },
    select: {
      companyId: true,
      role: true,
      company: { select: { authOrgId: true } },
    },
  });

  if (!fallbackMember) {
    console.error(
      `[getCurrentMember] No active Member record for user ${userId}`,
    );
    return null;
  }

  if (!fallbackMember.company.authOrgId) {
    console.error(
      `[getCurrentMember] Company ${fallbackMember.companyId} has no authOrgId`,
    );
    return null;
  }

  return {
    userId,
    companyId: fallbackMember.companyId,
    authOrgId: fallbackMember.company.authOrgId,
    role: fallbackMember.role,
  };
}
