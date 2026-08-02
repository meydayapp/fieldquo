// app/api/platform/demos/route.js
//
// The internal console's view of booked product demos (DemoBooking). GET lists
// upcoming and recent; PATCH marks one cancelled/completed. Superadmin session
// only, same as every other platform route.
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentPlatformAdmin } from "@/lib/platform/currentPlatformAdmin";

export async function GET(request) {
  const admin = await getCurrentPlatformAdmin(request);
  if (!admin)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const now = new Date();
  const [upcoming, past] = await Promise.all([
    db.demoBooking.findMany({
      where: { status: "booked", scheduledAt: { gte: now } },
      orderBy: { scheduledAt: "asc" },
    }),
    db.demoBooking.findMany({
      where: { OR: [{ scheduledAt: { lt: now } }, { status: { not: "booked" } }] },
      orderBy: { scheduledAt: "desc" },
      take: 50,
    }),
  ]);

  return NextResponse.json({ upcoming, past });
}

export async function PATCH(request) {
  const admin = await getCurrentPlatformAdmin(request);
  if (!admin)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json().catch(() => ({}));
  const id = String(body?.id || "");
  const status = String(body?.status || "");
  if (!id || !["booked", "cancelled", "completed"].includes(status)) {
    return NextResponse.json({ error: "Bad request" }, { status: 400 });
  }

  const updated = await db.demoBooking.update({ where: { id }, data: { status } });
  return NextResponse.json(updated);
}
