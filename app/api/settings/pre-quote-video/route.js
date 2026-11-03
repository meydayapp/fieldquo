// app/api/settings/pre-quote-video/route.js
//
// The company's pre-quote video — Company.preQuoteVideoUrl, the film a
// homeowner watches before the estimator turns up.
//
// ── Why it lives on Settings › Client messages ────────────────────────────
//
// Because that page already owns everything a client HEARS from the company
// between enquiring and being quoted: the booking texts, the document texts,
// the follow-up texts, and whether conversations link to a client. The video
// is read by exactly those follow-ups (lib/followUps/defaults.js
// buildBuiltInLeadEmail and lib/sms/templates.js leadFollowUpText), so the
// field sits beside the wording it appears in and a company editing one sees
// the other.
//
// The two places it did NOT go:
//
//   · Settings › Company profile holds the brand, the logo, the address —
//     what a document looks like, not what it says.
//   · Settings › Follow-ups holds the RULES. A video is not a rule; it is a
//     thing the rules mention, and putting it there would mean a company with
//     no rules on could not find the field at all. That page links here
//     instead.
//
// GET → { url, note }      anyone who can open Settings › Client messages
// PUT { url } → { url }    owners and admins (user:manage), the same rung
//                          that edits the client texts on that page. Never a
//                          support session: impersonation is read-only.
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { memberOrRefusal } from "@/lib/apiMember";
import { requirePermission } from "@/lib/permissions";
import { recordActivity } from "@/lib/activity/log";
import { normalisePreQuoteVideoUrl } from "@/lib/followUps/preQuoteVideo";

export async function GET(request) {
  const { member, response } = await memberOrRefusal(request);
  if (response) return response;
  const row = await db.company.findUnique({
    where: { id: member.companyId },
    select: { preQuoteVideoUrl: true },
  });
  if (!row) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ url: row.preQuoteVideoUrl || null });
}

export async function PUT(request) {
  const { member, response } = await memberOrRefusal(request);
  if (response) return response;
  if (member.impersonation) {
    return NextResponse.json({ error: "Support sessions are read-only." }, { status: 403 });
  }
  try {
    requirePermission(member.role, "user:manage");
  } catch {
    return NextResponse.json({ error: "Only owners and admins can change this." }, { status: 403 });
  }

  const body = await request.json().catch(() => ({}));
  // The same validator the follow-ups read the stored value back through, so
  // a value that saves is a value that sends. Validating differently here
  // would let somebody store an address the send path then silently drops.
  const check = normalisePreQuoteVideoUrl(body?.url);
  if (!check.ok) {
    // The reason travels with the refusal so the screen can say which of the
    // three things is wrong rather than "invalid". `not_a_url` is nearly
    // always a pasted "youtu.be/abc" with no scheme — the one mistake worth
    // naming precisely, because the fix is eight characters.
    return NextResponse.json(
      { error: "Paste the full https:// link to the video.", reason: check.reason },
      { status: 400 },
    );
  }

  const row = await db.company.update({
    where: { id: member.companyId },
    data: { preQuoteVideoUrl: check.url },
    select: { preQuoteVideoUrl: true },
  });

  await recordActivity(member, {
    action: "settings.pre_quote_video",
    entityType: "company",
    entityId: member.companyId,
    summary: check.url ? "Set the pre-quote video link" : "Removed the pre-quote video link",
    // The url itself, not just that it changed: this is a thing clients are
    // sent, so "who pointed our homeowners at what" is the question the log
    // has to be able to answer.
    metadata: { url: check.url },
  });

  return NextResponse.json({ url: row.preQuoteVideoUrl || null });
}
