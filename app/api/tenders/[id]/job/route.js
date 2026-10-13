// app/api/tenders/[id]/job/route.js
//
// POST — "Convert to job" on a won tender.
//
// Uses the EXISTING job creation, lib/jobs/createJob.js — the one POST
// /api/jobs, the invoice page and client tickets already share — with the
// tender's buyer, our bid quote (so imported sub costs, checklists and the
// quote's colours carry over exactly as they do from the jobs screen) and the
// tender's title. Gated exactly as POST /api/jobs is: job:create plus jobs ≥
// view_create_edit.
//
// Deliberately NOT "mark the quote accepted": that path runs the quote's
// deposit schedule, which can email the buyer a deposit invoice
// automatically (lib/paymentSchedule/run.js). A government award is signed on
// the buyer's own paper; nothing here sends them anything.
//
// Once per tender. The tender row is locked for the transaction, so a double
// tap cannot raise two jobs; a second call answers with the job the first
// made. If the bid quote already has a job (somebody converted it from the
// quote), that job is linked instead of a second one being raised.
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { memberOrRefusal } from "@/lib/apiMember";
import { recordActivity } from "@/lib/activity/log";
import { createJob } from "@/lib/jobs/createJob";
import { requireTenderWrite, canConvertTender } from "@/lib/tenders/access";
import { TENDER_SELECT } from "@/lib/tenders/load";
import { detailPayload } from "@/lib/tenders/detail";
import { gateMember, findTender } from "@/lib/tenders/server";

function requireConvert(member) {
  requireTenderWrite(member);
  if (!canConvertTender(member)) {
    const err = new Error("Your access level for Jobs doesn't allow you to create jobs.");
    err.status = 403;
    throw err;
  }
}

export async function POST(request, { params }) {
  const { id } = await params;
  const { member, response } = await memberOrRefusal(request);
  if (response) return response;
  const gate = await gateMember(db, member, requireConvert);
  if (gate.response) return gate.response;

  const found = await findTender(db, member.companyId, id);
  if (found.response) return found.response;
  if (found.tender.status !== "won") {
    return NextResponse.json({ error: "Only a won tender becomes a job. Mark it won first." }, { status: 409 });
  }

  const outcome = await db.$transaction(
    async (tx) => {
      await tx.$queryRaw`SELECT id FROM "Tender" WHERE id = ${found.tender.id} FOR UPDATE`;
      const tender = await tx.tender.findFirst({
        where: { id: found.tender.id, companyId: member.companyId },
        select: { id: true, jobId: true, quoteId: true, clientId: true, title: true, contractNumber: true },
      });
      if (!tender) return { error: "Not found", status: 404 };

      if (tender.jobId) {
        const existing = await tx.job.findFirst({ where: { id: tender.jobId, companyId: member.companyId }, select: { id: true } });
        if (existing) return { jobId: existing.id, created: false };
      }
      if (tender.quoteId) {
        const fromQuote = await tx.job.findFirst({
          where: { quoteId: tender.quoteId, companyId: member.companyId },
          select: { id: true },
          orderBy: { createdAt: "asc" },
        });
        if (fromQuote) {
          await tx.tender.update({ where: { id: tender.id, companyId: member.companyId }, data: { jobId: fromQuote.id } });
          return { jobId: fromQuote.id, created: false };
        }
      }

      const title = tender.contractNumber ? `${tender.title} (${tender.contractNumber})` : tender.title;
      const made = await createJob(tx, {
        companyId: member.companyId,
        createdByUserId: member.userId,
        clientId: tender.clientId,
        quoteId: tender.quoteId || null,
        title: title.slice(0, 200),
        // Not asked: the site is often not the buyer's mailing address, and
        // Job.siteAddress null means "not asked", never "same as client".
        siteAddress: null,
      });
      if (made.error) return { error: made.error, status: made.status };
      await tx.tender.update({ where: { id: tender.id, companyId: member.companyId }, data: { jobId: made.job.id } });
      return { jobId: made.job.id, created: true };
    },
    // createJob geocodes a site address when there is one (none here) and
    // attaches waivers and checklists; the default 5 s is tight for that.
    { timeout: 20000 },
  );
  if (outcome.error) return NextResponse.json({ error: outcome.error }, { status: outcome.status || 400 });

  if (outcome.created) {
    await recordActivity(member, {
      action: "tender.converted",
      entityType: "tender",
      entityId: found.tender.id,
      summary: `Created a job from won tender ${found.tender.title}`,
      metadata: { tenderId: found.tender.id, jobId: outcome.jobId },
    });
  }

  const fresh = await db.tender.findFirst({ where: { id: found.tender.id, companyId: member.companyId }, select: TENDER_SELECT });
  return NextResponse.json(
    { ...(await detailPayload(db, member, gate.full, fresh)), jobId: outcome.jobId, created: outcome.created },
    { status: outcome.created ? 201 : 200 },
  );
}
