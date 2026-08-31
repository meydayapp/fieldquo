// app/api/quotes/estimate-reviews/route.js
//
// The review queue: draft quotes the public instant estimator produced that
// nobody has signed off yet. A homeowner saw a range; these are waiting for
// someone accountable to confirm the price before it can be sent.
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { memberOrRefusal } from "@/lib/apiMember";
import { levelOrRefusal } from "@/lib/permissions/apiGate";
import { can } from "@/lib/permissions";
import { redactClient, redactQuoteMoney } from "@/lib/permissions/enforce";
import { callRecordingHref } from "@/lib/voice/recording";

export async function GET(request) {
  const { member, response } = await memberOrRefusal(request);
  if (response) return response;

  // A queue of quotes is still quotes. The nav row has been role-gated for a
  // while, which hid the screen from an employee and left the endpoint open.
  const { full, response: denied } = await levelOrRefusal(
    member,
    "quotes",
    "view_only",
    "see quotes",
  );
  if (denied) return denied;

  const quotes = await db.quote.findMany({
    where: { companyId: member.companyId, autoEstimated: true, needsReview: true },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      quoteNumber: true,
      total: true,
      estimateSource: true,
      estimateData: true,
      // What the caller asked for that this automatic price does not carry.
      // Internal — Quote.reviewNotes is never on a client-facing surface — and
      // the reviewer is exactly who it was written for, so a queue that showed
      // the figure but not the caveat would be the wrong half of the story.
      reviewNotes: true,
      // The call this was drafted from, so the reviewer can hear it before
      // approving a figure. An ID — never the recording URL, which is a bearer
      // link (see Quote.sourceCallId). Turned into a gated path below.
      sourceCallId: true,
      createdAt: true,
      client: { select: { name: true, email: true, phone: true, address: true } },
      // Nobody was signed in when the instant-quote flow created this draft,
      // so it lands here with no assignee by construction — see
      // createEstimateDraft. Surfaced here rather than invented at creation:
      // this queue IS the "leave it for review" the schema comment on
      // Quote.assignedToId points to.
      assignedTo: { select: { id: true, name: true } },
    },
  });

  // ── The filter this route missed ─────────────────────────────────────────
  //
  // GET /api/quotes was redacted; this sibling was not, and QA found the
  // screen still printing a homeowner's email, phone and full street address
  // to an employee restricted to name_address_only. Same data, different
  // handler, no filter — which is exactly the shape of miss that a shared
  // helper is supposed to prevent and only prevents where it is called.
  // ── And the money half, which the first pass here also missed ───────────
  //
  // The client filter landed; `total` and `estimateData` did not. estimateData
  // is the estimator's verbatim snapshot — the range the homeowner was shown,
  // the itemised breakdown and its amounts, the budget they stated — so the
  // whole price survived inside a Json column while `total` sat beside it in
  // plain sight. QA read 6750 / 2250 / 11250 out of it.
  //
  // redactQuoteMoney rather than a hand-written delete: this route's select is
  // a subset of a Quote, and the next column added to that select should not
  // need a second person to remember this line exists.
  const redacted = quotes.map(({ sourceCallId, ...q }) => ({
    ...redactQuoteMoney(full, q),
    client: redactClient(full, q.client),
    // The id is swapped for the path that plays it, so the browser never holds
    // a raw call id it could go hunting with either. /api/voice/calls/[id]/recording
    // re-checks the session, the tenant and the permission before it streams
    // anything, so an unlucky href is a 401 rather than a leak.
    recordingHref: sourceCallId ? callRecordingHref(sourceCallId) : null,
  }));

  return NextResponse.json({
    quotes: redacted,
    // Whether THIS member may approve — drives the button state, but the
    // approve route enforces it again server-side. Hiding a button is not
    // access control.
    canApprove: can(member.role, "quote:approve-estimate"),
    // So the page can offer "Assign to me" without a second round trip, and
    // so it can tell "assigned to me" apart from "assigned to someone else"
    // for the reassign gate (PATCH /api/quotes/[id] needs quote:assign for
    // the second case, not the first).
    currentUserId: member.userId,
  });
}
