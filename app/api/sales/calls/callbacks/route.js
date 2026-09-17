// app/api/sales/calls/callbacks/route.js
//
// The call-backs this rep promised and has not yet made — the list behind
// "Call now" on the queue (app/components/sales/CallbacksStrip.js).
//
// Its own small GET, like ../unlogged, rather than a field on the queue
// payload: the queue's read is the one every row click repeats, and a
// promise list changes only when an outcome is written. Reads only; the
// call itself goes through the console's one dial path.
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { requireCallingRep } from "@/lib/sales/calls/gate";
import { callStoreState, promisedCallbacks } from "@/lib/sales/calls/store";

export async function GET(request) {
  const { rep, refusal } = await requireCallingRep(request);
  if (refusal) return NextResponse.json(refusal.body, { status: refusal.status });
  const now = new Date();
  const store = callStoreState();
  if (!store.ready) return NextResponse.json({ store, count: null, due: null, items: [], serverNow: now.toISOString() });
  const items = await promisedCallbacks({ salesRepId: rep.id, now });
  return NextResponse.json({
    store,
    count: items.length,
    due: items.filter((i) => i.due).length,
    items: items.map((i) => ({ ...i, callbackAt: i.callbackAt.toISOString(), promisedAt: i.promisedAt ? i.promisedAt.toISOString() : null })),
    serverNow: now.toISOString(),
  });
}
