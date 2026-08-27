// app/api/marketing/subscribers/route.js
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { memberOrRefusal } from "@/lib/apiMember";
import { requirePermission } from "@/lib/permissions";

export async function GET(request) {
  const { member, response } = await memberOrRefusal(request);
  if (response) return response;

  // Every subscriber's email, name, phone and address, to anybody with a login.
  // POST below has required user:manage since it was written, so the list was
  // the one door left open on the same table — and a mailing list is the
  // exportable-customer-list exposure that redactClient exists to prevent,
  // handed over whole.
  //
  // A gate rather than a redactor: strip the email off a mailing list and what
  // remains is a row count. There is nothing here a crew member needs a shaped
  // version of. Impersonation carved out on the read, as with the campaigns
  // beside it.
  if (!member.impersonation) {
    try {
      requirePermission(member.role, "user:manage");
    } catch (err) {
      return NextResponse.json(
        { error: "Only owners, admins, or supervisors can see marketing subscribers" },
        { status: err.status || 403 },
      );
    }
  }

  const subscribers = await db.marketingSubscriber.findMany({
    where: { companyId: member.companyId },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json(subscribers);
}

// Manual add — POST { email, name? }. Client imports go through
// /import-clients instead, which upserts many at once.
export async function POST(request) {
  const { member, response } = await memberOrRefusal(request);
  if (response) return response;

  try {
    requirePermission(member.role, "user:manage");
  } catch (err) {
    return NextResponse.json(
      { error: "Only owners, admins, or supervisors can manage subscribers" },
      { status: err.status || 403 },
    );
  }

  const { email, name, phone, address } = await request.json();
  if (!email?.trim()) {
    return NextResponse.json({ error: "email is required" }, { status: 400 });
  }

  try {
    const created = await db.marketingSubscriber.upsert({
      where: {
        companyId_email: { companyId: member.companyId, email: email.trim().toLowerCase() },
      },
      update: {
        subscribed: true,
        ...(name !== undefined && { name }),
        ...(phone !== undefined && { phone }),
        ...(address !== undefined && { address }),
      },
      create: {
        companyId: member.companyId,
        email: email.trim().toLowerCase(),
        name: name || null,
        phone: phone || null,
        address: address || null,
        source: "manual",
      },
    });
    return NextResponse.json(created, { status: 201 });
  } catch (err) {
    console.error("[subscribers POST]", err);
    return NextResponse.json(
      {
        error:
          "Could not add subscriber. If you just changed the schema, run `npx prisma db push` and restart the dev server.",
        detail: process.env.NODE_ENV === "development" ? err.message : undefined,
      },
      { status: 500 },
    );
  }
}
