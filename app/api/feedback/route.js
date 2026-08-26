// app/api/feedback/route.js
//
// TENANT-side submission. Any signed-in member can report a problem — gating
// this behind a role would mean the person who actually hit the bug often
// can't report it.
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { memberOrRefusal } from "@/lib/apiMember";

const TYPES = ["bug", "feature_request", "billing", "question", "other"];

export async function POST(request) {
  const { member, response } = await memberOrRefusal(request);
  if (response) return response;

  const { type, subject, body, pageUrl } = await request
    .json()
    .catch(() => ({}));

  if (!subject?.trim() || !body?.trim()) {
    return NextResponse.json(
      { error: "Subject and message are required." },
      { status: 400 },
    );
  }

  // Denormalise identity now. If the company is deleted later, the report
  // still says who sent it and where to reply.
  const [user, company] = await Promise.all([
    db.user.findUnique({
      where: { id: member.userId },
      select: { email: true },
    }),
    db.company.findUnique({
      where: { id: member.companyId },
      select: { name: true },
    }),
  ]);

  const feedback = await db.feedback.create({
    data: {
      companyId: member.companyId,
      userId: member.userId,
      email: user?.email || null,
      companyName: company?.name || null,
      type: TYPES.includes(type) ? type : "other",
      subject: subject.trim().slice(0, 200),
      body: body.trim().slice(0, 5000),
      pageUrl: pageUrl?.slice(0, 500) || null,
    },
  });

  // Deliberately returns only the id — the tenant has no reason to read back
  // triage fields like adminNotes.
  return NextResponse.json({ ok: true, id: feedback.id }, { status: 201 });
}
