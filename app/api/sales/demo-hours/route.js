// app/api/sales/demo-hours/route.js
//
// The rep's demo page settings: the zone their hours are read in and the
// hours a prospect may book. GET answers what the settings card shows —
// including the page's own URL and whether the default hours are in use —
// and PUT saves through lib/sales/demoHoursWrite.js, the one fenced writer,
// after lib/sales/demoBooking/slots.js has judged the values.
//
// Behind requireOutreachRep like the language and sells-in routes: a rep
// row is written, and the id comes from the gate's fresh read, never the
// body.
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireOutreachRep } from "@/lib/sales/outreachGate";
import { saveRepDemoHours } from "@/lib/sales/demoHoursWrite";
import { DEFAULT_DEMO_HOURS, parseDemoHours, repDemoZone, usableTimeZone } from "@/lib/sales/demoBooking/slots";
import { repDemoUrl } from "@/lib/sales/demoBooking/url";
import { ensureReferralToken } from "@/lib/sales/repLink";
import { getAppOrigin } from "@/lib/appUrl";

// `linkCode` is the rep's opaque referralToken (lib/sales/repLink.js). The
// page used to be addressed by SalesRep.code — the rep's real name, slugged —
// so every prospect who opened it read the rep's real name in the address
// bar. Old /demo/<code> links still open (book.js loadRepForDemo).
function view(row, request, linkCode) {
  const zone = repDemoZone(row);
  return {
    timeZone: zone.stated ? zone.timeZone : null,
    effectiveTimeZone: zone.timeZone,
    demoHours: Array.isArray(row.demoHours) ? row.demoHours : null,
    defaultHours: DEFAULT_DEMO_HOURS,
    url: linkCode ? repDemoUrl(getAppOrigin(request), linkCode) : null,
  };
}

const SELECT = { code: true, timeZone: true, demoHours: true };

export async function GET(request) {
  const { rep, refusal } = await requireOutreachRep(request);
  if (refusal) return NextResponse.json(refusal.body, { status: refusal.status });
  const row = await db.salesRep.findUnique({ where: { id: rep.id }, select: SELECT });
  if (!row) return NextResponse.json({ error: "No such rep." }, { status: 404 });
  return NextResponse.json(view(row, request, await ensureReferralToken(rep)));
}

export async function PUT(request) {
  const { rep, refusal } = await requireOutreachRep(request);
  if (refusal) return NextResponse.json(refusal.body, { status: refusal.status });
  let body = null;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Send a JSON body." }, { status: 400 });
  }
  let timeZone = null;
  if (body?.timeZone !== null && body?.timeZone !== undefined && body?.timeZone !== "") {
    if (!usableTimeZone(body.timeZone)) return NextResponse.json({ error: "That is not a time zone." }, { status: 400 });
    timeZone = String(body.timeZone).trim();
  }
  let demoHours = null;
  if (body?.demoHours !== null && body?.demoHours !== undefined) {
    const parsed = parseDemoHours(body.demoHours);
    if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 });
    demoHours = parsed.hours;
  }
  await saveRepDemoHours({ salesRepId: rep.id, timeZone, demoHours });
  const row = await db.salesRep.findUnique({ where: { id: rep.id }, select: SELECT });
  return NextResponse.json(view(row, request, await ensureReferralToken(rep)));
}
