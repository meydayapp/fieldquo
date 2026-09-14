// app/api/sales/messages/read/route.js
//
// The rep opened a text conversation, or filed it as done.
//
// ══ Why requireOutreachRep and not requireSalesRep ════════════════════════
//
// requireSalesRep refuses every non-GET under /api/sales, deliberately — see
// lib/sales/gate.js. requireOutreachRep is the named exception in front of
// writes that are the rep's own work and decide no money; /api/sales/tour
// uses it for the same shape, a rep recording where they got to. The write
// goes to SalesSmsThreadRead, a table of its own, declared in
// lib/sales/messages/readState.js, so the rep row's write list stays where
// it is.
//
// ══ Nothing here sends anything ═══════════════════════════════════════════
//
// Read receipts are FieldQuo's own bookkeeping. No carrier is reached, no
// prospect is told they were read, and the texting rules in
// lib/sales/salesSms.js are not consulted because nothing leaves.
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { requireOutreachRep } from "@/lib/sales/outreachGate";
import { normalisePhone } from "@/lib/sales/suppressionRules";
import { markThreadDone, markThreadRead } from "@/lib/sales/messages/readState";
import { resolveBusiness } from "@/lib/sales/messages/businessResolve";
import { mergeReadStates } from "@/lib/sales/messages/business";
import { db } from "@/lib/db";

export async function POST(request) {
  const { rep, refusal } = await requireOutreachRep(request);
  if (refusal) return NextResponse.json(refusal.body, { status: refusal.status });

  const body = await request.json().catch(() => null);
  const withE164 = normalisePhone(body?.with);
  if (!withE164) return NextResponse.json({ error: "Which conversation?" }, { status: 400 });

  // The conversation is with a BUSINESS and the marker is per number, so
  // every number of theirs is marked: a rep who has the room open has read
  // the reply that came from the owner's cell as surely as the one from the
  // shop line, and an unread badge that survives opening the thread is a
  // control that appears to work and does not.
  const business = await resolveBusiness({ salesRepId: rep.id, withE164, client: db }).catch(() => null);
  const numbers = business?.numbers?.length ? business.numbers : [withE164];

  // `done` absent → a read receipt. `done: true|false` → file or unfile,
  // which also counts as a read. The server's clock in both cases, and the
  // same instant for every number so the merged state is one moment.
  const at = new Date();
  const states = await Promise.all(
    numbers.map((e164) =>
      typeof body?.done === "boolean"
        ? markThreadDone({ salesRepId: rep.id, e164, done: body.done, at })
        : markThreadRead({ salesRepId: rep.id, e164, at }),
    ),
  );
  const state = mergeReadStates(states) || { readAt: null, doneAt: null };

  return NextResponse.json({ ok: true, with: withE164, numbers, readAt: state.readAt, doneAt: state.doneAt });
}
