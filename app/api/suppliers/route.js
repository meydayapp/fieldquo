// app/api/suppliers/route.js
//
// Who the company buys from.
//
// ── Why this is an entity and not a string ──────────────────────────────────
//
// Purchasing exists today as free text: `Bill.vendor`, `JobMaterial.supplier`.
// Free text answers "who did we buy this from" and cannot answer "what did we
// spend at this merchant this year", because "Home Depot", "home depot" and
// "HD Brossard" are three merchants as far as a string is concerned.
//
// The level this requires, and why, is in lib/purchasing/access.js.
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

export async function GET(request) {
  const { member, response } = await memberOrRefusal(request);
  if (response) return response;

  const { response: denied } = await levelOrRefusal(
    member,
    PURCHASING_CATEGORY,
    PURCHASING_LEVEL,
    "see the supplier list",
  );
  if (denied) return denied;

  const includeInactive =
    new URL(request.url).searchParams.get("includeInactive") === "1";

  const suppliers = await db.supplier.findMany({
    where: {
      companyId: member.companyId,
      ...(includeInactive ? {} : { active: true }),
    },
    orderBy: [{ active: "desc" }, { name: "asc" }],
  });

  return NextResponse.json({ suppliers: suppliers.map(shapeSupplier) });
}

export async function POST(request) {
  const { member, response } = await memberOrRefusal(request);
  if (response) return response;

  const { response: denied } = await levelOrRefusal(
    member,
    PURCHASING_CATEGORY,
    PURCHASING_LEVEL,
    "add a supplier",
  );
  if (denied) return denied;

  const body = await request.json().catch(() => ({}));
  const name = text(body.name, 200);
  if (!name) {
    return NextResponse.json({ error: "A supplier needs a name." }, { status: 400 });
  }

  // A near-duplicate is reported rather than merged. Merging two suppliers is a
  // decision with money attached — every purchase order and every receipt moves
  // with it — and it is not one a create endpoint should make on somebody's
  // behalf. The existing id goes back so the screen can offer to open it.
  const clash = await db.supplier.findFirst({
    where: {
      companyId: member.companyId,
      name: { equals: name, mode: "insensitive" },
    },
    select: { id: true, name: true },
  });
  if (clash) {
    return NextResponse.json(
      { error: `You already have a supplier called "${clash.name}".`, existingId: clash.id },
      { status: 409 },
    );
  }

  const supplier = await db.supplier.create({
    data: {
      companyId: member.companyId,
      name,
      accountRef: text(body.accountRef, 60),
      contactName: text(body.contactName, 120),
      email: text(body.email, 200),
      phone: text(body.phone, 40),
      address: text(body.address, 300),
      notes: text(body.notes, 2000),
    },
  });

  await recordActivity(member, {
    action: "supplier.created",
    entityType: "supplier",
    entityId: supplier.id,
    summary: `Added supplier ${supplier.name}`,
  });

  return NextResponse.json({ supplier: shapeSupplier(supplier) }, { status: 201 });
}
