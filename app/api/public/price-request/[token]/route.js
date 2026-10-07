// app/api/public/price-request/[token]/route.js
//
// What the request page needs about one price request, for whoever holds
// its token (the sub it was emailed to): the allow-listed view
// (lib/subRequests/model.js subFacingRequest — trade, scope, job address,
// photos, wanted-by, the GC's own name and brand; never the homeowner), and,
// for a signed-in reader, whether they can link it to their FieldQuo.
//
// The first read marks the request "opened" for the GC — unless the reader
// is a member of the GC's own company previewing their own request.
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { memberOrRefusal } from "@/lib/apiMember";
import { loadEnforceableMember, hasLevel } from "@/lib/permissions/enforce";
import { rateLimit } from "@/lib/rateLimit";
import { canAccept, canDecline, canReply } from "@/lib/subRequests/model";
import { loadRecipientByToken, markOpened, viewForRecipient } from "@/lib/subRequests/server";

export async function GET(request, { params }) {
  const limited = rateLimit(request, "price-request-read", { limit: 60, windowMs: 10 * 60 * 1000 });
  if (limited) return limited;
  // Next 16: params is a Promise.
  const { token } = await params;
  const r = await loadRecipientByToken(db, String(token || ""));
  if (!r) return NextResponse.json({ error: "This request link isn't valid." }, { status: 404 });

  // A lapsed or absent session is "signed out", never an error on a public
  // page: the shared shaper's refusal (401, or a billing/feature gate) is read
  // as "no member" and the page answers as it would to a stranger.
  let { member = null, response: signedOut } = await memberOrRefusal(request).catch(() => ({ member: null, response: true }));
  if (signedOut) member = null;
  const authenticated = Boolean(member && member.userId);
  const ownCompany = Boolean(member && member.companyId === r.request.companyId);
  if (!ownCompany) await markOpened(db, { recipientId: r.id }).catch(() => {});

  let accept = null;
  if (authenticated) {
    const verdict = canAccept({
      recipient: r,
      member,
      gcCompanyId: r.request.companyId,
      rosterLinkedCompanyId: r.subcontractor?.linkedCompanyId || null,
    });
    const full = verdict.ok ? await loadEnforceableMember(db, member.id) : null;
    accept = {
      ok: verdict.ok && hasLevel(full, "requests", "view_create_edit"),
      reason: verdict.ok ? (hasLevel(full, "requests", "view_create_edit") ? null : "no_access") : verdict.reason,
      // Already in THIS company's FieldQuo: where it is.
      leadUrl:
        verdict.ok && r.leadId && r.linkedCompanyId === member.companyId
          ? `/app/leads?lead=${encodeURIComponent(r.leadId)}`
          : null,
    };
  }

  return NextResponse.json({
    view: viewForRecipient(r),
    authenticated,
    ownCompany,
    accept,
    canReply: canReply(r).ok,
    canDecline: canDecline(r).ok && !r.declinedAt,
    declined: Boolean(r.declinedAt),
  });
}
