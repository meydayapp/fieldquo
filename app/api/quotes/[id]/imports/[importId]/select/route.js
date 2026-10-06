// app/api/quotes/[id]/imports/[importId]/select/route.js
//
// "Use this one" / "Offer as extra work" on the quote page's subcontractor
// comparison (app/app/quotes/[id]/ImportedCostsPanel.js). Puts ONE held sub
// price in front of the client:
//
//   open quote      → the trade's line on the quote; a competing line for
//                     the same trade steps back to being an option.
//   approved quote  → a pending change order (the signed quote untouched),
//                     sent to the client from the change-order list.
//
// The body is empty. The browser names the import in the URL and nothing
// else — the price is the stored snapshot × (1 + stored markup), worked out
// in lib/quotes/importQuote.js placeImportOption (AGENTS.md #5).
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { memberOrRefusal } from "@/lib/apiMember";
import { placeImportOption, ImportError } from "@/lib/quotes/importQuote";
import { recordActivity } from "@/lib/activity/log";
import {
  loadEnforceableMember,
  requireLevel,
  requireToggle,
  permissionErrorResponse,
  assignedJobWhere,
} from "@/lib/permissions/enforce";

export async function POST(request, { params }) {
  // Next 16: params is a Promise.
  const { id, importId } = await params;

  const { member, response } = await memberOrRefusal(request);
  if (response) return response;
  // A write, so read-only impersonation (userId null) is refused.
  if (!member.userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // Choosing which price the client is charged is a quote edit AND a price
  // decision — the same pair the markup PATCH asks. On an approved quote it
  // also raises a change order, so the change-order gates are asked too
  // (POST /api/jobs/[id]/change-orders: jobs view_create_edit + showPricing).
  const quote = await db.quote.findFirst({
    where: { id, companyId: member.companyId },
    select: { id: true, status: true, quoteNumber: true },
  });
  if (!quote) return NextResponse.json({ error: "Not found" }, { status: 404 });
  let full = null;
  try {
    full = await loadEnforceableMember(db, member.id);
    requireLevel(full, "quotes", "view_create_edit", "choose a subcontractor's price");
    requireToggle(full, "showPricing", "choose a subcontractor's price");
    if (quote.status === "accepted") requireLevel(full, "jobs", "view_create_edit", "add extra work to an approved quote");
  } catch (err) {
    const { body, status } = permissionErrorResponse(err);
    return NextResponse.json(body, { status });
  }
  // The change order lands on the quote's job — one this member must be able
  // to reach, the same scope the change-order route applies.
  if (quote.status === "accepted") {
    const job = await db.job.findFirst({
      where: { quoteId: quote.id, companyId: member.companyId },
      orderBy: { createdAt: "asc" },
      select: { id: true },
    });
    const reachable = job
      ? await db.job.findFirst({ where: { id: job.id, companyId: member.companyId, ...assignedJobWhere(full) }, select: { id: true } })
      : null;
    if (job && !reachable) return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const targetCompany = await db.company.findUnique({
    where: { id: member.companyId },
    select: { taxRate: true },
  });

  try {
    const result = await placeImportOption({ db, member, quoteId: id, importId, targetCompany });
    await recordActivity(member, {
      action: result.changeOrder ? "quote.cost_offered_as_change" : "quote.cost_selected",
      entityType: "quote",
      entityId: id,
      summary: result.changeOrder
        ? `Offered a subcontractor's price to the client as change order CO-${result.changeOrder.seq} on ${quote.quoteNumber}`
        : `Chose a subcontractor's price for ${quote.quoteNumber}`,
      metadata: {
        importId,
        placement: result.placement,
        swappedOut: result.swappedOut,
        ...(result.changeOrder ? { changeOrderId: result.changeOrder.id } : {}),
      },
    });
    return NextResponse.json({
      ok: true,
      placement: result.placement,
      swappedOut: result.swappedOut,
      targetTotal: result.targetTotal,
      changeOrder: result.changeOrder ? { id: result.changeOrder.id, label: `CO-${result.changeOrder.seq}` } : null,
    });
  } catch (err) {
    if (err instanceof ImportError)
      return NextResponse.json({ error: err.message }, { status: err.status });
    console.error("[select import] failed:", err);
    return NextResponse.json({ error: "Couldn't use that price. Please try again." }, { status: 500 });
  }
}
