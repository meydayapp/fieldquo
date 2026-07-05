// lib/currentMember.js
import { auth } from "./auth";
import { db } from "./db";

export async function getCurrentMember(request) {
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session?.user) return null;

  // activeOrganizationId comes from better-auth's organization plugin session
  const companyId = session.session.activeOrganizationId;
  if (!companyId) return null;

  const member = await db.member.findUnique({
    where: { userId_companyId: { userId: session.user.id, companyId } },
  });
  if (!member || !member.active) return null;

  return { userId: session.user.id, companyId, role: member.role };
}
