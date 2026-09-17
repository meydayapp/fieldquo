// app/api/sales/voicemail/route.js
//
// The messages left for THIS rep.
//
// Until this route existed the only screen that played a sales voicemail was
// the superadmin floor board, so a contractor could ring the number a rep gave
// them, leave that rep a message, and the rep had no way to hear it. See
// lib/sales/calls/voicemail.js for who owns a message and why the rule has two
// halves.
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireOutreachRep } from "@/lib/sales/outreachGate";
import { voicemailWhere, voicemailView } from "@/lib/sales/calls/voicemail";
import { missedWhere, missedView } from "@/lib/sales/calls/missed";

/** How many to show. A rep works the recent ones; the rest are history. */
const LIMIT = 50;

export async function GET(request) {
  const { rep, refusal } = await requireOutreachRep(request);
  if (refusal) return NextResponse.json(refusal.body, { status: refusal.status });

  // The numbers assigned to this rep. Read here rather than inside the pure
  // module so that file stays synchronous and executable by the check.
  const assigned = await db.platformSmsNumber.findMany({
    where: { assignedRepId: rep.id, active: true },
    select: { e164: true },
  });
  const ourNumbers = assigned.map((n) => n.e164).filter(Boolean);

  const rows = await db.salesCallAttempt.findMany({
    where: voicemailWhere({ salesRepId: rep.id, ourNumbers }),
    orderBy: { dialledAt: "desc" },
    take: LIMIT,
    select: {
      id: true,
      salesRepId: true,
      direction: true,
      toE164: true,
      fromE164: true,
      dialledAt: true,
      voicemailUrl: true,
      voicemailSeconds: true,
      prospectId: true,
      leadId: true,
      matchedBy: true,
      prospect: { select: { businessName: true } },
      lead: { select: { businessName: true } },
    },
  });

  // The same screen, the other outcome: rang, nobody picked up, no message.
  // Listed beside the voicemails rather than on a screen of its own because
  // the question a rep is answering is "who tried to reach me" — see
  // lib/sales/calls/missed.js for why this record exists at all.
  const missedRows = await db.salesCallAttempt.findMany({
    where: missedWhere({ salesRepId: rep.id, ourNumbers }),
    orderBy: { dialledAt: "desc" },
    take: LIMIT,
    select: {
      id: true,
      salesRepId: true,
      direction: true,
      toE164: true,
      fromE164: true,
      dialledAt: true,
      missedAt: true,
      providerStatus: true,
      disposition: true,
      prospectId: true,
      leadId: true,
      prospect: { select: { businessName: true } },
      lead: { select: { businessName: true } },
    },
  });

  return NextResponse.json({
    missed: missedRows.map(missedView),
    // `contactE164` is not a column — an inbound attempt records the caller in
    // `toE164`. Mapped here so the view helper reads one name for it.
    voicemails: rows.map((r) => voicemailView({ ...r, contactE164: r.toE164, ourE164: r.fromE164 })),
    numbers: ourNumbers,
    limit: LIMIT,
  });
}
