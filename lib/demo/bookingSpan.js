// lib/demo/bookingSpan.js
//
// How long a DemoBooking row blocks the host's calendar.
//
// DemoBooking has no duration column — it was shaped for the homepage demo,
// which is always one thirty-minute slot — and the sales walkthrough
// (lib/sales/nextSteps.js) is an hour on the same calendar. Rather than add
// a column for one constant, the length is derived from `source`, which the
// walkthrough writes as "walkthrough" and nothing else does. Both loaders
// (lib/demo/hosts.js, lib/migrations/hosts.js) map rows through this before
// assembleHosts, so a walkthrough blocks its second half for a homepage demo
// and for a migration call alike.
import { SLOT_MINUTES } from "./slots";
import { NEXT_STEP_MINUTES, WALKTHROUGH_SOURCE } from "@/lib/sales/nextSteps";

/** A row → the same row with `minutes`. Pure. */
export function bookingSpan(row) {
  const minutes = row?.source === WALKTHROUGH_SOURCE ? NEXT_STEP_MINUTES.walkthrough : SLOT_MINUTES;
  return { ...row, minutes };
}
