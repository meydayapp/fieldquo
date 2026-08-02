// app/api/demo/slots/route.js
//
// Public: the open 30-minute demo slots (6–10pm ET, two weeks out), minus the
// ones already booked. No auth — this is on the marketing homepage, where the
// visitor has no account. Prices/tenant data are never involved, so there's
// nothing to gate.
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { generateSlots, availableSlotsByDay } from "@/lib/demo/slots";

export async function GET() {
  const now = new Date();
  const all = generateSlots(now);
  if (!all.length) return NextResponse.json({ days: [] });

  const booked = await db.demoBooking.findMany({
    where: {
      status: "booked",
      scheduledAt: { gte: all[0], lte: all[all.length - 1] },
    },
    select: { scheduledAt: true },
  });
  const taken = new Set(booked.map((b) => b.scheduledAt.toISOString()));

  return NextResponse.json({ days: availableSlotsByDay(now, taken) });
}
