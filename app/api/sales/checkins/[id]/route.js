// app/api/sales/checkins/[id]/route.js
//
// The rep changes their mind: different words, a different moment, or put it
// away. Nothing here sends anything.
//
// ══ Reschedule is the owner's own ask ══════════════════════════════════════
//
// "when it should be set should be able to be changed by the sales rep". So
// the moment is editable, and the same validation the create route runs is run
// again here — parseScheduleRequest, in the CONTRACTOR's zone, against the
// texting window. Validating on create and not on edit would let a rep move a
// draft to six in the morning by taking the second route.
//
// ══ Why PATCH and not POST ═════════════════════════════════════════════════
//
// It changes part of a row that exists. requireSmsRep permits it for the same
// reason it permits the create — see that file's header — and lib/sales/gate.js
// still refuses every non-GET everywhere else.
//
// ══ `params` is a Promise ══════════════════════════════════════════════════
//
// Next 16. Awaited, not destructured synchronously.
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { requireSmsRep } from "@/lib/sales/smsGate";
import { parseScheduleRequest } from "@/lib/sales/checkin/schedule";
import { readCheckIn, threadContext, updateCheckIn } from "@/lib/sales/checkin/store";

export async function PATCH(request, { params }) {
  const { rep, refusal } = await requireSmsRep(request);
  if (refusal) return NextResponse.json(refusal.body, { status: refusal.status });

  const { id } = await params;
  const body = await request.json().catch(() => null);

  const row = await readCheckIn({ salesRepId: rep.id, id });
  if (!row) return NextResponse.json({ error: "That draft is not one of yours." }, { status: 404 });

  const patch = { salesRepId: rep.id, id };

  if (body?.dismiss === true) {
    patch.dismiss = true;
  }

  if (typeof body?.text === "string") {
    patch.text = body.text;
  }

  if (body?.scheduledFor !== undefined) {
    if (body.scheduledFor === null) {
      // "Send it whenever I get to it" is a real answer and clearing the
      // moment is how a rep says it. It is not the same as a moment we could
      // not read, which is refused below.
      patch.scheduledFor = null;
    } else {
      // The zone is re-read from the lead rather than stored on the draft: a
      // rep who corrected the prospect's time zone since writing the draft has
      // corrected what "Thursday 2pm" means, and the draft should follow.
      const { timeZone } = await threadContext({ salesRepId: rep.id, toE164: row.toE164 });
      const verdict = parseScheduleRequest({ raw: body.scheduledFor, timeZone });
      if (!verdict.ok) {
        return NextResponse.json(
          { error: verdict.error, code: verdict.code, suggestion: verdict.suggestion },
          { status: 409 },
        );
      }
      patch.scheduledFor = verdict.at;
    }
  }

  const result = await updateCheckIn(patch);
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status || 400 });
  return NextResponse.json({ ok: true, checkIn: result.checkIn });
}
