// app/api/sales/calls/unlogged/route.js
//
// The rep's calls with no outcome — the list behind "N calls to write up".
//
// Its own small GET rather than a field on GET /api/sales/calls, for the
// reason app/api/sales/calls/state gives: the console's load reads today's
// attempts, activity, stats and the caller pool, and the log-out gate, the
// Today card and the release gate want one list. Reads only; every outcome
// is still written through POST /api/sales/calls `disposition`.
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { requireCallingRep } from "@/lib/sales/calls/gate";
import { callStoreState, unloggedAttempts } from "@/lib/sales/calls/store";

export async function GET(request) {
  const { rep, refusal } = await requireCallingRep(request);
  if (refusal) return NextResponse.json(refusal.body, { status: refusal.status });
  const now = new Date();
  const store = callStoreState();
  if (!store.ready) return NextResponse.json({ store, count: null, items: [], serverNow: now.toISOString() });
  const items = await unloggedAttempts({ salesRepId: rep.id });
  return NextResponse.json({ store, count: items.length, items, serverNow: now.toISOString() });
}
