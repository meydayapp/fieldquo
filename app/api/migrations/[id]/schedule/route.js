// app/api/migrations/[id]/schedule/route.js
//
// Book (or re-book) the consultation for one migration request.
//
// Same shape as app/api/demo/book/route.js: re-derive who is genuinely free
// at the requested instant server-side (a hand-posted timestamp is never
// trusted), assign the least-loaded free host, and let the DB's own
// uniqueness guard settle the race where two callers grab the same host's
// slot between the check and the write.
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { memberOrRefusal } from "@/lib/apiMember";
import { isBillingAdmin } from "@/lib/billing/billingAdmin";
import { canSchedule, describeStatus } from "@/lib/migrations/state";
import { loadMigrationHosts } from "@/lib/migrations/hosts";
import { hostsFreeAt, pickHost } from "@/lib/demo/slots";

const bad = (error, status = 400) => NextResponse.json({ error }, { status });

export async function POST(request, { params }) {
  const { member, response } = await memberOrRefusal(request);
  if (response) return response;
  if (member.impersonation) return bad("Support access can't book on the company's behalf.", 403);
  if (!isBillingAdmin(member.role)) {
    return bad("Only an owner or admin can book a migration consultation.", 403);
  }

  const { id } = await params;
  const body = await request.json().catch(() => ({}));
  const slot = String(body?.slot || "");

  const migration = await db.migrationRequest.findUnique({ where: { id } });
  if (!migration || migration.companyId !== member.companyId) {
    return bad("Not found", 404);
  }
  if (!canSchedule(migration.status)) {
    return bad(
      `This migration is ${describeStatus(migration.status)} — a consultation can't be booked or changed from there.`,
      409,
    );
  }

  const now = new Date();
  const hosts = await loadMigrationHosts(now);
  const free = hostsFreeAt(hosts, slot, now);
  if (free.length === 0) {
    return bad("That time isn't available anymore — please pick another slot.");
  }
  const host = pickHost(free);
  const scheduledAt = new Date(slot);

  try {
    const updated = await db.migrationRequest.update({
      where: { id },
      data: { status: "scheduled", hostAdminId: host.adminId, scheduledAt },
    });
    return NextResponse.json({ request: updated });
  } catch {
    // Unique violation on (hostAdminId, scheduledAt) via MigrationRequest's
    // own index/DemoBooking's — that host was taken between the check and the
    // write by a demo prospect or another company's migration call.
    return bad("Someone just booked that slot — please pick another.", 409);
  }
}
