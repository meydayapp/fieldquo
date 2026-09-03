// app/api/suppliers/[id]/route.js
//
// Edit one supplier, or retire it.
//
// ── There is no DELETE, on purpose ─────────────────────────────────────────
//
// A supplier is referenced by every purchase order raised against it. Deleting
// one either orphans that history or takes it with it, and neither is
// something a contractor asked for when they clicked a bin icon on a merchant
// they stopped using. `Supplier.active` is the switch — the same reasoning
// behind Job.archivedAt and Worker archiving elsewhere in this product — so a
// retired merchant leaves the pickers and keeps its spend history.
//
// Next 16: params is a Promise.
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { memberOrRefusal } from "@/lib/apiMember";
import { levelOrRefusal } from "@/lib/permissions/apiGate";
import { recordActivity } from "@/lib/activity/log";
import {
  PURCHASING_CATEGORY,
  PURCHASING_LEVEL,
  shapeSupplier,
  text,
} from "@/lib/purchasing/access";

export async function PATCH(request, { params }) {
  const { id } = await params;
  const { member, response } = await memberOrRefusal(request);
  if (response) return response;

  const { response: denied } = await levelOrRefusal(
    member,
    PURCHASING_CATEGORY,
    PURCHASING_LEVEL,
    "edit a supplier",
  );
  if (denied) return denied;

  // findFirst with the companyId in the where, never findUnique on the id
  // alone — an id arriving from a URL is an id, and nothing more.
  const existing = await db.supplier.findFirst({
    where: { id, companyId: member.companyId },
  });
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const body = await request.json().catch(() => ({}));

  // Only the keys the request actually carried. A PATCH that does not mention
  // `notes` is not a request to erase the notes.
  const data = {};
  if (Object.hasOwn(body, "name")) {
    const name = text(body.name, 200);
    if (!name) return NextResponse.json({ error: "A supplier needs a name." }, { status: 400 });
    data.name = name;
  }
  for (const [key, max] of [
    ["accountRef", 60],
    ["contactName", 120],
    ["email", 200],
    ["phone", 40],
    ["address", 300],
    ["notes", 2000],
  ]) {
    if (Object.hasOwn(body, key)) data[key] = text(body[key], max);
  }
  if (Object.hasOwn(body, "active")) data.active = body.active !== false;

  if (!Object.keys(data).length) {
    return NextResponse.json({ error: "Nothing to change." }, { status: 400 });
  }

  const supplier = await db.supplier.update({ where: { id: existing.id }, data });

  await recordActivity(member, {
    action: Object.hasOwn(data, "active") && data.active === false ? "supplier.retired" : "supplier.updated",
    entityType: "supplier",
    entityId: supplier.id,
    summary:
      data.active === false
        ? `Retired supplier ${supplier.name}`
        : `Updated supplier ${supplier.name}`,
  });

  return NextResponse.json({ supplier: shapeSupplier(supplier) });
}
