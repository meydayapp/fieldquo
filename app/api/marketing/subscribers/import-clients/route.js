// app/api/marketing/subscribers/import-clients/route.js
//
// Pulls every Client with an email on file into MarketingSubscriber
// (upsert — safe to run repeatedly as new clients get added). Existing
// subscribers keep whatever subscribed/unsubscribed state they already
// have; only brand-new rows default to subscribed.
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { memberOrRefusal } from "@/lib/apiMember";
import { requirePermission } from "@/lib/permissions";

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

  const clients = await db.client.findMany({
    where: { companyId: member.companyId, email: { not: null } },
    select: { id: true, name: true, contactName: true, email: true, phone: true, address: true },
  });

  let imported = 0;
  let skipped = 0;

  for (const client of clients) {
    const email = client.email?.trim().toLowerCase();
    if (!email) {
      skipped++;
      continue;
    }
    try {
      await db.marketingSubscriber.upsert({
        where: { companyId_email: { companyId: member.companyId, email } },
        // Don't touch subscribed on an existing row — respect a prior
        // unsubscribe even if we re-import.
        update: { clientId: client.id, phone: client.phone, address: client.address },
        create: {
          companyId: member.companyId,
          email,
          name: client.contactName || client.name,
          phone: client.phone || null,
          address: client.address || null,
          clientId: client.id,
          source: "client_import",
        },
      });
      imported++;
    } catch (err) {
      console.error("[import-clients]", client.id, err.message);
      skipped++;
    }
  }

  return NextResponse.json({ ok: true, imported, skipped, total: clients.length });
}
