// app/api/leads/review-conversations/route.js
//
// "Review leads made from conversations" (lib/leads/conversationReview.js).
//
//   GET   the list with a suggestion per lead — reads only, writes nothing.
//   POST  { ids } — the leads a PERSON confirmed are deleted with "don't
//         create a lead from this conversation again", through the same
//         deleteLeads every other delete uses. Only ids the review itself
//         suggests removing are acted on.
//
// Owner and admin only (the owner's ask), AND the requests delete rung the
// board's own delete asks — both, so an admin whose grid was narrowed below
// delete is refused here too. A read-only support session may READ the list
// (support must see exactly what the owner sees — check:impersonation) but
// is refused the POST before anything else (supportSessionRefusal), as on
// every lead delete.
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { memberOrRefusal } from "@/lib/apiMember";
import { levelOrRefusal } from "@/lib/permissions/apiGate";
import { supportSessionRefusal } from "@/lib/leads/deleteLead";
import { buildConversationReview, applyConversationReview } from "@/lib/leads/conversationReview";
import { captureDeletedNotALead } from "@/lib/meta/capi/capture";
import { afterResponse } from "@/lib/meta/capi/afterResponse";

async function gate(request, { write }) {
  const { member, response } = await memberOrRefusal(request);
  if (response) return { response };
  const support = write ? supportSessionRefusal(member) : null;
  if (support) return { response: NextResponse.json(support.body, { status: support.status }) };
  if (member.role !== "owner" && member.role !== "admin") {
    return { response: NextResponse.json({ error: "Only an owner or an admin can review leads made from conversations." }, { status: 403 }) };
  }
  const { response: denied } = await levelOrRefusal(member, "requests", "view_create_edit_delete", "delete requests");
  if (denied) return { response: denied };
  return { member };
}

export async function GET(request) {
  const { member, response } = await gate(request, { write: false });
  if (response) return response;
  const review = await buildConversationReview(db, { companyId: member.companyId });
  return NextResponse.json(review);
}

export async function POST(request) {
  const { member, response } = await gate(request, { write: true });
  if (response) return response;
  const body = await request.json().catch(() => null);
  const result = await applyConversationReview(db, {
    companyId: member.companyId,
    ids: body?.ids,
    actor: { userId: member.userId, memberId: member.id, role: member.role },
  });
  if (!result.ok) return NextResponse.json({ error: result.error, refused: result.refused || [] }, { status: result.status });
  // Every lead removed here is removed as "not a lead": a Facebook lead-form
  // one is a Disqualified stage for Meta (lib/meta/capi/capture.js), queued
  // after the response so Meta can never slow the review down.
  const { metaDisqualify = [], ...body2 } = result;
  if (metaDisqualify.length) afterResponse(() => captureDeletedNotALead(db, { companyId: member.companyId, leads: metaDisqualify }));
  return NextResponse.json(body2);
}
