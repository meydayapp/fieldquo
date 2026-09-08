// lib/jobs/pastJobsGate.js
//
// Who may enter a past job — shared by the three /api/jobs/import routes
// (commit, preview, template) so they cannot disagree about it.
//
// One request creates a quote AND an invoice AND a job, so it asks for the
// level each of those creates asks for on its own — quotes/view_create_edit
// (POST /api/quotes), invoices/view_create_edit plus showPricing (POST
// /api/invoices), jobs/view_create_edit plus the coarse job:create (POST
// /api/jobs) — and creates a client only when a row names one that isn't on
// file, at clientsProperties/full_edit (POST /api/clients). A member who could
// not do one of those by hand cannot do all four at once here.
//
// A lib module rather than helpers exported from the route file: a route.js
// may only export handlers and segment config, and next/server is imported
// here for the same reason lib/permissions/apiGate.js imports it.

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requirePermission } from "@/lib/permissions";
import {
  loadEnforceableMember,
  requireLevel,
  requireToggle,
  permissionErrorResponse,
} from "@/lib/permissions/enforce";

/** @returns {{ full, response: null }} or {{ full: null, response }} to return as-is. */
export async function pastJobsGate(member) {
  try {
    requirePermission(member.role, "quote:create");
    requirePermission(member.role, "job:create");
    const full = await loadEnforceableMember(db, member.id);
    requireLevel(full, "quotes", "view_create_edit", "create quotes");
    requireLevel(full, "invoices", "view_create_edit", "create invoices");
    requireLevel(full, "jobs", "view_create_edit", "create jobs");
    requireToggle(full, "showPricing", "enter what a job was charged");
    return { full, response: null };
  } catch (err) {
    const { body, status } = permissionErrorResponse(err);
    return { full: null, response: NextResponse.json(body, { status }) };
  }
}

/** Rows that will create a client need the client-creation level too. Null when fine. */
export function clientCreateRefusal(full, previewRows) {
  const createsClient = (previewRows || []).some((r) => !r?.value?.clientId);
  if (!createsClient) return null;
  try {
    requireLevel(full, "clientsProperties", "full_edit", "add clients");
    return null;
  } catch (err) {
    const { body, status } = permissionErrorResponse(err);
    return NextResponse.json(body, { status });
  }
}
