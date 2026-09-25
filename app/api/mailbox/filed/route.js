// app/api/mailbox/filed/route.js
//
// GET ?clientId=… | ?jobId=… — the email conversations filed to one client
// or one job, for the "Email" section on the client page and the job page.
//
// ══ Who sees what ═════════════════════════════════════════════════════════
//
//   client page  clientsProperties ≥ full_view — the same level that opens
//                the client record itself (an email is contact data).
//   job page     jobs ≥ view_only, AND the job must be in the member's own
//                scope (assignedJobWhere: a crew member sees their jobs
//                only; somebody else's job reads as not there). Below
//                clientsProperties full_view the addresses are withheld —
//                "Client" / the company's side are shown instead — because
//                that level exists to keep the client book's contact
//                details from people who only need the job.
//
// Bodies are the stored TEXT (lib/mailbox/text.js); nothing here is HTML and
// the component renders it as text.
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { memberOrRefusal } from "@/lib/apiMember";
import { loadEnforceableMember, hasLevel, assignedJobWhere } from "@/lib/permissions/enforce";
import { publicAttachments } from "@/lib/messaging/attachments";

const MAX_THREADS = 50;

export async function GET(request) {
  const { member, response } = await memberOrRefusal(request);
  if (response) return response;
  const full = await loadEnforceableMember(db, member.id);

  const url = new URL(request.url);
  const clientId = url.searchParams.get("clientId");
  const jobId = url.searchParams.get("jobId");
  if (!clientId && !jobId) return NextResponse.json({ error: "clientId or jobId is required." }, { status: 400 });

  const seesContacts = hasLevel(full, "clientsProperties", "full_view");
  let where;
  let job = null;
  if (clientId) {
    if (!seesContacts) return NextResponse.json({ error: "You don't have access to client contact details." }, { status: 403 });
    const client = await db.client.findFirst({ where: { id: clientId, companyId: member.companyId }, select: { id: true } });
    if (!client) return NextResponse.json({ error: "Not found" }, { status: 404 });
    where = { companyId: member.companyId, clientId: client.id, channel: { platform: "email" } };
  } else {
    if (!hasLevel(full, "jobs", "view_only")) return NextResponse.json({ error: "You don't have access to jobs." }, { status: 403 });
    job = await db.job.findFirst({ where: { id: jobId, companyId: member.companyId, ...assignedJobWhere(full) }, select: { id: true, clientId: true, quoteId: true } });
    if (!job) return NextResponse.json({ error: "Not found" }, { status: 404 });
    where = { companyId: member.companyId, jobId: job.id, channel: { platform: "email" } };
  }

  const threads = await db.messageThread.findMany({
    where,
    orderBy: { lastMessageAt: "desc" },
    take: MAX_THREADS,
    select: {
      id: true,
      threadNumber: true,
      participantName: true,
      lastMessageAt: true,
      jobId: true,
      quoteId: true,
      clientId: true,
      messages: {
        where: { private: false, direction: { in: ["in", "out"] } },
        orderBy: { sentAt: "asc" },
        select: {
          id: true,
          direction: true,
          body: true,
          sentAt: true,
          attachments: true,
          failedReason: true,
          email: { select: { subject: true, fromAddress: true, toAddresses: true, ccAddresses: true, sentVia: true } },
        },
      },
    },
  });

  // Names for "filed to …", in one query each, company-scoped.
  const jobIds = [...new Set(threads.map((t) => t.jobId).filter(Boolean))];
  const quoteIds = [...new Set(threads.map((t) => t.quoteId).filter(Boolean))];
  const [jobs, quotes] = await Promise.all([
    jobIds.length ? db.job.findMany({ where: { id: { in: jobIds }, companyId: member.companyId }, select: { id: true, title: true } }) : [],
    quoteIds.length ? db.quote.findMany({ where: { id: { in: quoteIds }, companyId: member.companyId }, select: { id: true, quoteNumber: true } }) : [],
  ]);
  const jobTitle = new Map(jobs.map((j) => [j.id, j.title]));
  const quoteNumber = new Map(quotes.map((q) => [q.id, q.quoteNumber]));

  // What the thread can be re-filed to: this client's jobs and quotes.
  // Offered only to someone who may change a conversation's links (the same
  // gate the inbox's PATCH applies) — anyone else gets no "change" link.
  const canRefile = hasLevel(full, "requests", "view_create_edit") && seesContacts;
  const targetClientId = clientId || job?.clientId || null;
  let targets = null;
  if (canRefile && targetClientId) {
    const [cj, cq] = await Promise.all([
      db.job.findMany({ where: { companyId: member.companyId, clientId: targetClientId }, orderBy: { createdAt: "desc" }, take: 30, select: { id: true, title: true, status: true } }),
      db.quote.findMany({ where: { companyId: member.companyId, clientId: targetClientId, archivedAt: null }, orderBy: { createdAt: "desc" }, take: 30, select: { id: true, quoteNumber: true, status: true } }),
    ]);
    targets = { jobs: cj, quotes: cq };
  }

  const hide = (s) => (seesContacts ? s : null);
  return NextResponse.json({
    threads: threads.map((t) => ({
      id: t.id,
      threadNumber: t.threadNumber,
      participantName: t.participantName,
      lastMessageAt: t.lastMessageAt,
      subject: t.messages.find((m) => m.email?.subject)?.email?.subject || "",
      filedTo: {
        jobId: t.jobId,
        jobTitle: t.jobId ? jobTitle.get(t.jobId) || null : null,
        quoteId: t.quoteId,
        quoteNumber: t.quoteId ? quoteNumber.get(t.quoteId) || null : null,
      },
      messages: t.messages.map((m) => ({
        id: m.id,
        direction: m.direction,
        body: m.body,
        sentAt: m.sentAt,
        failed: Boolean(m.failedReason),
        subject: m.email?.subject || "",
        from: hide(m.email?.fromAddress || null),
        to: hide(m.email?.toAddresses || null),
        cc: hide(m.email?.ccAddresses || null),
        sentVia: m.email?.sentVia || null,
        attachments: publicAttachments(m.attachments),
      })),
    })),
    canRefile,
    targets,
    seesContacts,
  });
}
