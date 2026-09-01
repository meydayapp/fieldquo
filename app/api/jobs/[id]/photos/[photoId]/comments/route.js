// app/api/jobs/[id]/photos/[photoId]/comments/route.js
//
// Comments (and @mentions) on ONE job photo. Internal only — see
// prisma/schema.prisma's JobPhotoComment doc comment for the two guards that
// keep this off every client-facing surface.
//
// ══ Why view_only, not view_create_edit ═════════════════════════════════════
//
// This mirrors the change made to POST /api/jobs/[id]/photos in this same
// change: commenting on a photo you can see is communication about the job,
// not an edit to its record — the same distinction that already lets a Crew
// member (jobs:view_only) tick off their own visit's checklist
// (app/api/jobs/[id]/visits/[visitId]/route.js) without holding jobs edit
// rights. Featuring a photo onto the public website stays gated at
// view_create_edit on PATCH /api/jobs/[id]/photos — that's still a curation
// decision, and unrelated to talking about the photo.
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { memberOrRefusal } from "@/lib/apiMember";
import { levelOrRefusal } from "@/lib/permissions/apiGate";
import { assignedJobWhere } from "@/lib/permissions/enforce";
import { resolveMentions } from "@/lib/photoComments/mentionable";
import { notifyMentions } from "@/lib/photoComments/notify";

const MAX_BODY_CHARS = 2000;

/** The job AND the photo, proven to be this company's and to belong to each other. */
async function loadScopedPhoto({ jobId, photoId, companyId, full }) {
  const job = await db.job.findFirst({
    where: { id: jobId, companyId, ...assignedJobWhere(full) },
    select: { id: true },
  });
  if (!job) return null;

  // A photo whose job was reassigned, or whose id is stale, or that was
  // deleted between the page loading and this request — all the same
  // "nothing to comment on" answer. Comments have no delete route today
  // (see the JobPhoto model comment), so this branch is defensive rather
  // than reachable through the current UI, and it stays defensive on
  // purpose: the next feature that adds photo deletion must not have to
  // remember to come back here.
  const photo = await db.jobPhoto.findFirst({
    where: { id: photoId, jobId, companyId },
    select: { id: true },
  });
  if (!photo) return null;

  return { job, photo };
}

export async function GET(request, { params }) {
  const { id, photoId } = await params;
  const { member, response } = await memberOrRefusal(request);
  if (response) return response;

  const { full, response: denied } = await levelOrRefusal(
    member,
    "jobs",
    "view_only",
    "see jobs",
  );
  if (denied) return denied;

  const scoped = await loadScopedPhoto({ jobId: id, photoId, companyId: member.companyId, full });
  if (!scoped) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const comments = await db.jobPhotoComment.findMany({
    where: { jobPhotoId: photoId, companyId: member.companyId },
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      body: true,
      createdAt: true,
      authorMember: {
        select: { id: true, role: true, user: { select: { name: true } } },
      },
      mentions: {
        select: {
          memberId: true,
          notifiedVia: true,
          member: { select: { user: { select: { name: true } } } },
        },
      },
    },
  });

  return NextResponse.json({
    comments: comments.map((c) => ({
      id: c.id,
      body: c.body,
      createdAt: c.createdAt,
      author: {
        memberId: c.authorMember.id,
        name: c.authorMember.user?.name || "",
        role: c.authorMember.role,
      },
      mentions: c.mentions.map((m) => ({
        memberId: m.memberId,
        name: m.member.user?.name || "",
        notified: m.notifiedVia !== "none",
      })),
    })),
  });
}

export async function POST(request, { params }) {
  const { id, photoId } = await params;
  const { member, response } = await memberOrRefusal(request);
  if (response) return response;

  const { full, response: denied } = await levelOrRefusal(
    member,
    "jobs",
    "view_only",
    "comment on a job photo",
  );
  if (denied) return denied;

  const scoped = await loadScopedPhoto({ jobId: id, photoId, companyId: member.companyId, full });
  if (!scoped) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const body = await request.json().catch(() => ({}));
  const text = typeof body?.body === "string" ? body.body.trim().slice(0, MAX_BODY_CHARS) : "";
  if (!text) {
    return NextResponse.json(
      { error: "A comment needs some words in it.", reason: "empty_body" },
      { status: 400 },
    );
  }

  // Filters to real, active, same-company members who can actually see THIS
  // job — dropping (never erroring on) another tenant's id, a deactivated
  // member, someone scoped off this job, a duplicate, the author's own id, or
  // an id that matches nobody. Recomputed here rather than trusting the
  // picker's earlier answer, for the same reason every write route in this
  // codebase re-checks scope at the door instead of a client-supplied claim.
  const mentionMemberIds = await resolveMentions(db, {
    companyId: member.companyId,
    jobId: id,
    authorMemberId: member.id,
    requestedMemberIds: body?.mentionMemberIds,
  });

  const comment = await db.jobPhotoComment.create({
    data: {
      companyId: member.companyId,
      jobPhotoId: photoId,
      authorMemberId: member.id,
      body: text,
      ...(mentionMemberIds.length
        ? {
            mentions: {
              create: mentionMemberIds.map((memberId) => ({
                companyId: member.companyId,
                memberId,
              })),
            },
          }
        : {}),
    },
    select: {
      id: true,
      body: true,
      createdAt: true,
      authorMember: { select: { id: true, role: true, user: { select: { name: true } } } },
      mentions: {
        select: { memberId: true, member: { select: { user: { select: { name: true } } } } },
      },
    },
  });

  // Detached — see lib/photoComments/notify.js's header on why a Twilio or
  // Resend hiccup must never turn an already-saved comment into a retried
  // request. Every mention row already exists at "not yet attempted" before
  // this fires.
  if (mentionMemberIds.length) {
    notifyMentions({
      commentId: comment.id,
      photoId,
      jobId: id,
      companyId: member.companyId,
      authorMemberId: member.id,
      mentionMemberIds,
    }).catch((err) => console.error("[photo-comment] notify failed:", err.message));
  }

  return NextResponse.json({
    comment: {
      id: comment.id,
      body: comment.body,
      createdAt: comment.createdAt,
      author: {
        memberId: comment.authorMember.id,
        name: comment.authorMember.user?.name || "",
        role: comment.authorMember.role,
      },
      mentions: comment.mentions.map((m) => ({
        memberId: m.memberId,
        name: m.member.user?.name || "",
      })),
    },
  });
}
