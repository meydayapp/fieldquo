// lib/tenders/server.js
//
// The few server-side steps every /api/tenders route repeats: load the grid,
// apply one of the access.js gates, and find the tender in THIS company.
// Each route still calls memberOrRefusal itself — scripts/check-feature-flags.mjs
// requires it in every route under a gated prefix, so the `tenders` feature's
// 404 comes out of the right door.
import { NextResponse } from "next/server";
import { loadEnforceableMember, permissionErrorResponse } from "@/lib/permissions/enforce";
import { TENDER_SELECT } from "./load";

/**
 * @param {Function} requireFn  requireTenderRead / requireTenderWrite / a custom check
 * @returns {Promise<{ full } | { response }>}
 */
export async function gateMember(db, member, requireFn) {
  const full = await loadEnforceableMember(db, member.id);
  try {
    requireFn(full);
  } catch (err) {
    if (typeof err?.status !== "number") throw err;
    const { body, status } = permissionErrorResponse(err);
    return { response: NextResponse.json(body, { status }) };
  }
  return { full };
}

/** The tender, scoped to the caller's company, or a 404 response. */
export async function findTender(db, companyId, id) {
  if (typeof id !== "string" || !id) return { response: NextResponse.json({ error: "Not found" }, { status: 404 }) };
  const tender = await db.tender.findFirst({ where: { id, companyId }, select: TENDER_SELECT });
  if (!tender) return { response: NextResponse.json({ error: "Not found" }, { status: 404 }) };
  return { tender };
}

/** Company.timezone, the default zone for a new tender. */
export async function companyZone(db, companyId) {
  const row = await db.company.findUnique({ where: { id: companyId }, select: { timezone: true } }).catch(() => null);
  return row?.timezone || null;
}
