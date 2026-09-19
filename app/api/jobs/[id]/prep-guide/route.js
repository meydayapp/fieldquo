// app/api/jobs/[id]/prep-guide/route.js
//
// The job page's view of, and controls over, the client preparation guide.
//
//   GET    what will happen and why — sent on, scheduled for, or the reason
//          it will not go ("no start date", "no client email", "don't send")
//   POST   "Send now" / "Send again": a person sends it this minute
//   PATCH  { suppressed: true|false } — "Don't send for this job" and undo
//
// The rule is lib/prepGuide/schedule.js's and the send is
// lib/prepGuide/send.js's; this file decides nothing about either. It does
// decide who may: anyone who may see the job may read this, and anyone who
// may edit jobs may send or suppress — the same ladder the job's own dates
// sit on, because "send the guide" is a fact about the job's schedule.

export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { memberOrRefusal } from "@/lib/apiMember";
import { levelOrRefusal } from "@/lib/permissions/apiGate";
import { assignedJobWhere, hasLevel } from "@/lib/permissions/enforce";
import { recordActivity } from "@/lib/activity/log";
import { prepGuideDecision, clampLeadDays } from "@/lib/prepGuide/schedule";
import { sendPrepGuide, PREP_GUIDE_DOCUMENT_KIND } from "@/lib/prepGuide/send";
import { resolveClientLanguage } from "@/lib/i18n/clientLanguage";

const JOB_SELECT = {
  id: true,
  companyId: true,
  title: true,
  status: true,
  startDate: true,
  archivedAt: true,
  historicalImportedAt: true,
  prepGuideSentAt: true,
  prepGuideSuppressedAt: true,
  client: { select: { email: true, language: true } },
  company: { select: { prepGuideLeadDays: true, defaultLanguage: true } },
  quote: { select: { language: true, scopeGroups: { select: { category: { select: { key: true, label: true } } } } } },
};

async function ownJob(id, companyId, member) {
  return db.job.findFirst({ where: { id, companyId, ...assignedJobWhere(member) }, select: JOB_SELECT });
}

async function statusFor(job, full) {
  const decision = prepGuideDecision({ job, company: job.company, client: job.client, now: new Date() });
  const lastDocument = await db.jobDocument.findFirst({
    where: { jobId: job.id, kind: PREP_GUIDE_DOCUMENT_KIND, supersededBy: { is: null } },
    orderBy: { uploadedAt: "desc" },
    select: { id: true, url: true, uploadedAt: true },
  });
  return {
    sentAt: job.prepGuideSentAt,
    suppressedAt: job.prepGuideSuppressedAt,
    startDate: job.startDate,
    leadDays: clampLeadDays(job.company?.prepGuideLeadDays),
    dueAt: decision.dueAt,
    // The decision the cron would make right now, by name, so the page can
    // say "will go on 12 October" or "won't go: no client email".
    willSend: decision.send,
    reason: decision.reason,
    hasClientEmail: Boolean(String(job.client?.email || "").trim()),
    language: resolveClientLanguage({ document: job.quote, client: job.client, company: job.company }),
    // One name per trade, not per scope group — two rooms of painting are
    // one trade, and the builder sends one section for them.
    trades: [...new Set((job.quote?.scopeGroups || []).map((g) => g.category?.label).filter(Boolean))],
    document: lastDocument,
    canSend: hasLevel(full, "jobs", "view_create_edit"),
  };
}

export async function GET(request, { params }) {
  const { id } = await params;
  const { member, response } = await memberOrRefusal(request);
  if (response) return response;
  const { full, response: denied } = await levelOrRefusal(member, "jobs", "view_only", "see this job");
  if (denied) return denied;

  const job = await ownJob(id, member.companyId, full);
  if (!job) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(await statusFor(job, full));
}

export async function POST(request, { params }) {
  const { id } = await params;
  const { member, response } = await memberOrRefusal(request);
  if (response) return response;
  const { full, response: denied } = await levelOrRefusal(member, "jobs", "view_create_edit", "send the preparation guide");
  if (denied) return denied;

  const job = await ownJob(id, member.companyId, full);
  if (!job) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const result = await sendPrepGuide({ jobId: job.id, companyId: member.companyId, member, force: true }, { db });
  if (!result.sent) {
    const messages = {
      no_start_date: "This job has no start date, so there is no date to prepare for. Set one first.",
      no_client_email: "The client has no email address on file. Add one to their record first.",
      cancelled: "This job is cancelled.",
      archived: "This job is archived.",
      historical: "This is a past job entered after the fact; nothing is sent for it.",
      started: "The start date has passed. A guide arriving after the crew would read as a mistake.",
      render_failed: "The guide could not be built. The error has been logged.",
      send_failed: "The email could not be sent. The error has been logged.",
      email_unconfigured: "Email isn't configured on this deployment, so nothing was sent.",
    };
    return NextResponse.json(
      { error: messages[result.reason] || "The guide was not sent.", reason: result.reason },
      { status: result.reason === "send_failed" || result.reason === "email_unconfigured" ? 503 : 409 },
    );
  }
  const fresh = await ownJob(id, member.companyId, full);
  return NextResponse.json({ ...(await statusFor(fresh, full)), result });
}

export async function PATCH(request, { params }) {
  const { id } = await params;
  const { member, response } = await memberOrRefusal(request);
  if (response) return response;
  const { full, response: denied } = await levelOrRefusal(member, "jobs", "view_create_edit", "change the preparation guide");
  if (denied) return denied;

  const job = await ownJob(id, member.companyId, full);
  if (!job) return NextResponse.json({ error: "Not found" }, { status: 404 });

  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }
  if (typeof body?.suppressed !== "boolean") {
    return NextResponse.json({ error: "Send { suppressed: true } or { suppressed: false }." }, { status: 400 });
  }

  await db.job.update({
    where: { id: job.id },
    data: { prepGuideSuppressedAt: body.suppressed ? new Date() : null },
  });
  await recordActivity(member, {
    action: body.suppressed ? "job.prep_guide_suppressed" : "job.prep_guide_allowed",
    entityType: "job",
    entityId: job.id,
    summary: body.suppressed
      ? `Preparation guide won't be sent for ${job.title}`
      : `Preparation guide allowed again for ${job.title}`,
    summaryKey: body.suppressed ? "app.activity.event.prepGuideSuppressed" : "app.activity.event.prepGuideAllowed",
    summaryParams: { job: job.title },
  });

  const fresh = await ownJob(id, member.companyId, full);
  return NextResponse.json(await statusFor(fresh, full));
}
