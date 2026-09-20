// app/api/calendar/google/route.js
//
// The signed-in member's own connection: GET reads it, PATCH flips the two
// switches. Nobody can read or change anybody else's — the member id comes
// from the session, never from the request.
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { memberOrRefusal } from "@/lib/apiMember";
import { googleCalendarConfigured, googleCalendarMissing } from "@/lib/calendar/googleClient";
import { getConnectionForMember, updateSwitches, publicConnectionShape } from "@/lib/calendar/googleConnection";
import { removeMemberMirrors, reconcileMember } from "@/lib/calendar/googleSync";
import { clearBusyCache } from "@/lib/calendar/googleBusy";

export async function GET(request) {
  const { member, response } = await memberOrRefusal(request);
  if (response) return response;

  const connection = await getConnectionForMember(member.id);
  return NextResponse.json({
    configured: googleCalendarConfigured(),
    // Which var is missing, for the operator reading the panel on a
    // deployment nobody has set up yet. Names only — never a value.
    missing: googleCalendarMissing(),
    connection: publicConnectionShape(connection),
  });
}

/**
 * { writeEnabled?: boolean, busyReadEnabled?: boolean }
 *
 * Each switch is honoured the moment it is saved, not at the next cron:
 *   write → off   every FieldQuo event leaves the calendar now
 *   write → on    everything on their schedule goes back on now
 *   busy → off    the cache is dropped, so the next availability read
 *                 sees no personal blocks at all
 */
export async function PATCH(request) {
  const { member, response } = await memberOrRefusal(request);
  if (response) return response;

  const connection = await getConnectionForMember(member.id);
  if (!connection) return NextResponse.json({ error: "Google Calendar is not connected." }, { status: 404 });

  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  const patch = {};
  if (typeof body?.writeEnabled === "boolean") patch.writeEnabled = body.writeEnabled;
  if (typeof body?.busyReadEnabled === "boolean") patch.busyReadEnabled = body.busyReadEnabled;
  if (!Object.keys(patch).length) {
    return NextResponse.json({ error: "Nothing to change." }, { status: 400 });
  }

  const updated = await updateSwitches(member.id, patch);
  clearBusyCache(member.id);

  const effects = { eventsRemoved: 0, eventsCreated: 0 };
  if (patch.writeEnabled === false && connection.writeEnabled !== false) {
    const r = await removeMemberMirrors(member.id, { connection });
    effects.eventsRemoved = r.deleted;
  } else if (patch.writeEnabled === true && connection.writeEnabled === false) {
    const fresh = await getConnectionForMember(member.id);
    const r = await reconcileMember(fresh);
    effects.eventsCreated = r.created;
  }

  return NextResponse.json({ connection: publicConnectionShape(await getConnectionForMember(member.id) || updated), ...effects });
}
