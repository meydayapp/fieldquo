// app/api/platform/mailbox-health/route.js
//
// GET — connected work mailboxes across every company, for the /platform
// overview: how many by provider and status, how many are failing to sync
// and why, and whether each connection route is configured on this
// deployment. Counts and error SENTENCES only — never an address, a subject
// or a body. The platform console views; it does not read client mail.
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentPlatformAdmin } from "@/lib/platform/currentPlatformAdmin";
import { providerAvailability } from "@/lib/mailbox/config";

export async function GET(request) {
  const admin = await getCurrentPlatformAdmin(request);
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const [byProvider, errors, sending] = await Promise.all([
    db.mailboxConnection.groupBy({ by: ["provider", "status"], _count: { _all: true } }),
    db.mailboxConnection.findMany({
      where: { status: { in: ["connected", "error"] }, lastError: { not: null } },
      orderBy: { lastErrorAt: "desc" },
      take: 20,
      select: { id: true, provider: true, status: true, lastError: true, lastErrorAt: true, lastSyncAt: true, company: { select: { id: true, name: true } } },
    }),
    db.mailboxConnection.count({ where: { sendEnabled: true, status: "connected" } }),
  ]);

  const counts = {};
  for (const row of byProvider) {
    counts[row.provider] = counts[row.provider] || { connected: 0, error: 0, disconnected: 0 };
    counts[row.provider][row.status] = (counts[row.provider][row.status] || 0) + row._count._all;
  }

  return NextResponse.json({
    providers: providerAvailability(),
    counts,
    sending,
    errors: errors.map((e) => ({
      id: e.id,
      provider: e.provider,
      status: e.status,
      error: e.lastError,
      at: e.lastErrorAt,
      lastSyncAt: e.lastSyncAt,
      company: e.company ? { id: e.company.id, name: e.company.name } : null,
    })),
  });
}
