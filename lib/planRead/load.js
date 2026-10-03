// lib/planRead/load.js
//
// One drawing read, loaded for its own company — the only way the routes
// read a PlanRead, so the tenant filter is written once.

import { db } from "@/lib/db";

export const MESSAGE_HISTORY = 60;

export async function loadPlanRead(id, companyId, { messages = true, prisma = db } = {}) {
  if (typeof id !== "string" || !companyId) return null;
  return prisma.planRead.findFirst({
    where: { id, companyId },
    include: {
      documents: { where: { companyId }, orderBy: { uploadedAt: "asc" } },
      ...(messages ? { messages: { where: { companyId }, orderBy: { createdAt: "asc" }, take: -MESSAGE_HISTORY } } : {}),
    },
  });
}
