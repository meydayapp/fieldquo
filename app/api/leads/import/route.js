// app/api/leads/import/route.js
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { memberOrRefusal } from "@/lib/apiMember";
import { createScoredLead } from "@/lib/leads/createLead";
import { normaliseLeadRow } from "@/lib/leads/importMap";
import { db } from "@/lib/db";
import {
  loadEnforceableMember,
  requireLevel,
  permissionErrorResponse,
} from "@/lib/permissions/enforce";

// Bulk-import leads a company bought or exported elsewhere. Each row goes through
// the SAME createScoredLead as an inbound lead, so imported leads land triaged
// hot/warm/cold in the same pipeline — best we can do with whatever budget/
// timeline the source happened to carry (mapped leniently, null when absent).
//
// Expects rows already parsed client-side (Papa Parse). One create per row
// rather than createMany, because scoring is per-lead.
export async function POST(request) {
  const { member, response } = await memberOrRefusal(request);
  if (response) return response;

  // Bulk-creating requests is creating requests. The single-lead paths beside
  // this one now check the grid; an import route that does not is the same
  // door with a bigger handle.
  try {
    const full = await loadEnforceableMember(db, member.id);
    requireLevel(full, "requests", "view_create_edit", "import requests");
  } catch (err) {
    const { body, status } = permissionErrorResponse(err);
    return NextResponse.json(body, { status });
  }

  const { rows } = await request.json();
  if (!Array.isArray(rows) || rows.length === 0) {
    return NextResponse.json({ error: "No rows to import" }, { status: 400 });
  }
  // Bound the batch so a giant paste can't tie up the request.
  if (rows.length > 2000) {
    return NextResponse.json(
      { error: "Please import at most 2000 leads at a time." },
      { status: 400 },
    );
  }

  const normalised = rows.map(normaliseLeadRow);
  // A lead with no name AND no way to reach them is noise, not a lead.
  const valid = normalised.filter((r) => r.name || r.email || r.phone);
  const skipped = rows.length - valid.length;

  let imported = 0;
  for (const r of valid) {
    try {
      await createScoredLead({
        companyId: member.companyId,
        name: r.name || "Imported lead",
        email: r.email || null,
        phone: r.phone || null,
        message: r.message || null,
        source: "imported",
        budgetBand: r.budgetBand,
        timeline: r.timeline,
      });
      imported += 1;
    } catch (err) {
      // Skip a bad row rather than fail the whole batch.
      console.error("[leads/import] row failed:", err?.message);
    }
  }

  return NextResponse.json({ imported, skipped: skipped + (valid.length - imported) });
}
