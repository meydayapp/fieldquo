// app/api/quotes/[id]/add-ons/route.js
//
// The optional extras offered at the bottom of a quote.
//
// GET — list them.  PUT — replace the whole list.
//
// Replace-the-list rather than per-row create/update/delete because that's
// what the editor actually is: a small array the user reorders and edits in
// place, saved in one go. Diffing it on the client to produce three kinds of
// request would be more code and more ways to end up out of sync.
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentMember } from "@/lib/currentMember";
import { requirePermission } from "@/lib/permissions";
import { TAKEOFF_ADD_ON_SOURCE } from "@/lib/quotes/takeoffAddOns";

const money = (v) => {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? Math.round(n * 100) / 100 : 0;
};

export async function GET(request, { params }) {
  const _params = await params;
  const member = await getCurrentMember(request);
  if (!member)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const quote = await db.quote.findFirst({
    where: { id: _params.id, companyId: member.companyId },
    select: { id: true },
  });
  if (!quote) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const addOns = await db.quoteAddOn.findMany({
    where: { quoteId: _params.id },
    orderBy: { sortOrder: "asc" },
  });

  return NextResponse.json(
    addOns.map((a) => ({ ...a, amount: Number(a.amount) })),
  );
}

export async function PUT(request, { params }) {
  const _params = await params;
  const member = await getCurrentMember(request);
  if (!member)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    requirePermission(member.role, "quote:create");
  } catch (err) {
    return NextResponse.json(
      { error: err.message },
      { status: err.status || 403 },
    );
  }

  const quote = await db.quote.findFirst({
    where: { id: _params.id, companyId: member.companyId },
    select: { id: true, status: true },
  });
  if (!quote) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // Once the client has decided, the offer is settled. Editing the extras on
  // an accepted quote would rewrite the thing they agreed to — and because
  // the invoice is built from the selected rows, it would also silently
  // change what they get billed. Revise by issuing a new quote.
  if (quote.status === "accepted" || quote.status === "declined") {
    return NextResponse.json(
      {
        error: `This quote has already been ${quote.status}. Create a new quote to change what's on offer.`,
      },
      { status: 409 },
    );
  }

  const body = await request.json().catch(() => ({}));
  const incoming = Array.isArray(body?.addOns) ? body.addOns : [];

  // Rows a takeoff owns are not editable here. They are derived from the scope
  // group's own takeoff every time the quote is saved (see
  // lib/quotes/takeoffAddOns.js), so an edit accepted here would be silently
  // overwritten by the next save — which is worse than refusing it. They are
  // dropped from the incoming list and excluded from the delete below, so this
  // handler replaces exactly the rows it is allowed to own.
  const rows = incoming
    .filter((a) => a?.source !== TAKEOFF_ADD_ON_SOURCE)
    .filter((a) => String(a?.description || "").trim())
    .slice(0, 8) // more than a handful of extras is a second quote, not an upsell
    .map((a, i) => ({
      quoteId: _params.id,
      description: String(a.description).trim().slice(0, 200),
      detail: a.detail ? String(a.detail).trim().slice(0, 400) : null,
      amount: money(a.amount),
      taxable: a.taxable !== false,
      // Offset past the takeoff-derived rows, which number themselves from 0.
      // Without this the two sets interleave arbitrarily on `orderBy sortOrder`
      // and the client's list reshuffles every time the quote is re-saved.
      sortOrder: 100 + i,
      source: ["manual", "history", "ai"].includes(a.source)
        ? a.source
        : "manual",
    }));

  // An extra with no price can't be ticked — the client would be approving an
  // unknown amount. Caught here rather than in the browser because the browser
  // isn't the thing that has to be right.
  const unpriced = rows.filter((r) => r.amount <= 0);
  if (unpriced.length) {
    return NextResponse.json(
      {
        error: `Give every optional extra a price before saving: ${unpriced
          .map((r) => r.description)
          .join(", ")}.`,
      },
      { status: 400 },
    );
  }

  // Wholesale replace in a transaction, so a failure halfway can't leave the
  // quote showing no extras at all.
  await db.$transaction([
    db.quoteAddOn.deleteMany({
      where: { quoteId: _params.id, source: { not: TAKEOFF_ADD_ON_SOURCE } },
    }),
    ...(rows.length ? [db.quoteAddOn.createMany({ data: rows })] : []),
  ]);

  const saved = await db.quoteAddOn.findMany({
    where: { quoteId: _params.id },
    orderBy: { sortOrder: "asc" },
  });

  return NextResponse.json(
    saved.map((a) => ({ ...a, amount: Number(a.amount) })),
  );
}
