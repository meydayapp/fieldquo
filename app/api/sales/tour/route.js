// app/api/sales/tour/route.js
//
// Where a rep got to in the portal tour — the read and the write.
//
// ══ Why requireOutreachRep and not requireSalesRep ════════════════════════
//
// requireSalesRep refuses every non-GET method under /api/sales, deliberately
// — see lib/sales/gate.js. requireOutreachRep is the named exception in front
// of the writes that are the rep's own work, and /api/sales/payout and
// /api/sales/language already use it for this exact shape: a rep changing a
// fact about themselves that decides no money. Same gate, same reasoning.
//
// What the gate does NOT grant matters more here than usual: REP_OUTREACH_WRITES
// does not list `salesRep`, and this route does not want it to. The write goes
// to SalesRepTourProgress, a table of its own, precisely so the tour needs no
// exemption on the commission-and-attribution boundary — lib/sales/tourProgress.js
// argues that trade at length.
//
// ══ Why the read is a route at all, rather than a prop off the layout ═════
//
// app/sales/layout.js already queries the rep for their language, so a second
// column on that query would have been cheaper. It was rejected: that layout
// renders /sales/login and /sales/invite too, and its own header explains that
// it must never throw, because a database hiccup there takes down the only
// doors into the portal. Hanging the tour off it would put a walkthrough's
// query in front of the sign-in page. The panel is client-side and can simply
// not appear when this route fails.
export const runtime = "nodejs";

import { NextResponse } from "next/server";

import { requireOutreachRep } from "@/lib/sales/outreachGate";
import { readTourProgress, saveTourProgress } from "@/lib/sales/tourProgress";

export async function GET(request) {
  const { rep, refusal } = await requireOutreachRep(request);
  if (refusal) return NextResponse.json(refusal.body, { status: refusal.status });

  return NextResponse.json(await readTourProgress({ salesRepId: rep.id }));
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

  // `dismissed` is passed through as undefined when absent rather than coerced
  // to false. saveTourProgress treats the three cases differently on purpose —
  // "I pressed Next" must not un-dismiss a tour the rep told to go away — and
  // a `Boolean(body.dismissed)` here would have thrown that distinction away
  // before the module that cares about it ever saw it.
  const dismissed =
    body?.dismissed === undefined || body?.dismissed === null
      ? undefined
      : body.dismissed === true;

  // `step` is not validated here and deliberately not: clampTourStep in
  // app/sales/tourSteps.js is the one place that decides what a position may
  // be, it is executed against hostile input by scripts/check-sales-tour.mjs,
  // and a second opinion in this route is how the two come to disagree. It
  // accepts anything and answers with a real index, so there is no shape of
  // body that produces a stored value the panel cannot render.
  const view = await saveTourProgress({
    salesRepId: rep.id,
    step: body?.step,
    dismissed,
  });
  return NextResponse.json(view);
}
