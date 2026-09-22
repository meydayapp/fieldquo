// app/api/waivers/route.js
//
// Staff side of waivers: GET lists the ones attached to a quote, a job or
// an invoice (?quoteId= | ?jobId= | ?invoiceId=); POST attaches one from
// the library. Attaching creates the pending DocumentSignature row the
// client signs — see lib/waivers/service.js — and answers with it.
//
// Permission: attaching a release the client must sign is the same weight
// as editing the thing it is attached to, so the quote/job/invoice edit
// level is what is required.
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { memberOrRefusal } from "@/lib/apiMember";
import { levelOrRefusal } from "@/lib/permissions/apiGate";
import { loadEnforceableMember, requireLevel, permissionErrorResponse } from "@/lib/permissions/enforce";
import { recordActivity } from "@/lib/activity/log";
import { attachWaiver } from "@/lib/waivers/service";
import { presentSignature } from "@/lib/waivers/present";

const AREA = { quoteId: "quotes", jobId: "jobs", invoiceId: "invoices" };

function targetOf(src) {
  const keys = ["quoteId", "jobId", "invoiceId"].filter((k) => typeof src?.[k] === "string" && src[k]);
  if (keys.length !== 1) return null;
  return { key: keys[0], id: src[keys[0]] };
}

async function ownsTarget(companyId, target) {
  const table = target.key === "quoteId" ? db.quote : target.key === "jobId" ? db.job : db.invoice;
  return Boolean(await table.findFirst({ where: { id: target.id, companyId }, select: { id: true } }));
}

export async function GET(request) {
  const { member, response } = await memberOrRefusal(request);
  if (response) return response;
  const url = new URL(request.url);
  const target = targetOf({ quoteId: url.searchParams.get("quoteId"), jobId: url.searchParams.get("jobId"), invoiceId: url.searchParams.get("invoiceId") });
  if (!target) return NextResponse.json({ error: "Pass one of quoteId, jobId or invoiceId." }, { status: 400 });
  const { response: denied } = await levelOrRefusal(member, AREA[target.key], "view_only", "see this");
  if (denied) return denied;
  if (!(await ownsTarget(member.companyId, target))) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const rows = await db.documentSignature.findMany({
    where: { companyId: member.companyId, [target.key]: target.id },
    orderBy: { createdAt: "asc" },
    include: { document: { select: { title: true } } },
  });
  const library = await db.companyDocument.findMany({
    where: { companyId: member.companyId, archivedAt: null, type: "waiver" },
    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
    select: { id: true, title: true, body: true },
  });
  const { waiverIsSignable } = await import("@/lib/company/documents");
  return NextResponse.json({
    waivers: rows.map(presentSignature),
    library: library.map((d) => ({ id: d.id, title: d.title, signable: waiverIsSignable(d.body) })),
  });
}

export async function POST(request) {
  const { member, response } = await memberOrRefusal(request);
  if (response) return response;
  const body = await request.json().catch(() => ({}));
  const target = targetOf(body);
  if (!target) return NextResponse.json({ error: "Pass one of quoteId, jobId or invoiceId." }, { status: 400 });
  try {
    const full = await loadEnforceableMember(db, member.id);
    requireLevel(full, AREA[target.key], "view_create_edit", "attach a waiver");
  } catch (err) {
    const { body: b, status } = permissionErrorResponse(err);
    return NextResponse.json(b, { status });
  }
  if (!(await ownsTarget(member.companyId, target))) return NextResponse.json({ error: "Not found" }, { status: 404 });

  try {
    const row = await attachWaiver({
      companyId: member.companyId,
      documentId: String(body.documentId || ""),
      quoteId: target.key === "quoteId" ? target.id : null,
      jobId: target.key === "jobId" ? target.id : null,
      invoiceId: target.key === "invoiceId" ? target.id : null,
    });
    const full = await db.documentSignature.findUnique({ where: { id: row.id }, include: { document: { select: { title: true } } } });
    await recordActivity(member, {
      action: "waiver.attached",
      entityType: target.key === "quoteId" ? "quote" : target.key === "jobId" ? "job" : "invoice",
      entityId: target.id,
      summary: `Attached waiver "${full.document?.title || ""}"`,
      metadata: { signatureId: row.id, documentId: body.documentId },
    });
    return NextResponse.json({ waiver: presentSignature(full) }, { status: 201 });
  } catch (err) {
    return NextResponse.json({ error: err.message || "Could not attach the waiver." }, { status: err.status || 500 });
  }
}
