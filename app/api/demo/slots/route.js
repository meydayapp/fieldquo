// app/api/demo/slots/route.js
//
// Public: the open 30-minute demo slots — the union of what FieldQuo's own demo
// hosts have said they are free for, minus what is already booked. No auth —
// this is on the marketing homepage, where the visitor has no account.
// Prices/tenant data are never involved, so there's nothing to gate.
//
// Returns `{ days: [{ day, slots: [{ iso, label }] }] }`, which is what
// app/components/marketing/DemoBooking.js renders. Unchanged from when the
// grid was hardcoded — the shape was never the problem.
//
// An empty `days` is a real answer, not a failure: nobody has stated any
// availability, and the hero says so. It does NOT fall back to an invented
// 6–10pm grid, which is what this endpoint published before.
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { loadDemoHosts } from "@/lib/demo/hosts";
import { availableSlotsByDay } from "@/lib/demo/slots";

export async function GET() {
  const now = new Date();
  const hosts = await loadDemoHosts(now);
  return NextResponse.json({ days: availableSlotsByDay(hosts, now) });
}
