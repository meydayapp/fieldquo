// app/api/price-requests/route.js
//
// The GC's side of "Request prices from subs" (lib/subRequests/): what the
// dialog may offer for this quote or job, the requests already out with each
// sub's status, and — POST — a new request, sent.
//
// Gates. The roster sits behind user:manage (lib/subcontractors/access.js);
// a request names subs, so it does too. Sending also edits what the quote
// is priced from: quotes view_create_edit. A reply's figure is the GC's
// COST, so it is included only for jobCosting (the compare's own rule).
//
// No figure is ever read from the browser here: a request is ids and text.
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { memberOrRefusal } from "@/lib/apiMember";
import { loadEnforceableMember, requireLevel, hasLevel, hasToggle, permissionErrorResponse } from "@/lib/permissions/enforce";
import { canWriteSubcontractors, requireSubcontractorRead, requireSubcontractorWrite } from "@/lib/subcontractors/access";
import { parseRequestInput, pickOnFilePhotos, jobAddressFor } from "@/lib/subRequests/model";
import {
  RequestError,
  createPriceRequest,
  listRequestsForQuote,
  loadRequestContext,
  quoteTakesRequests,
} from "@/lib/subRequests/server";
import { sendPriceRequestEmail } from "@/lib/subRequests/send";
import { getAppOrigin } from "@/lib/appUrl";
import { recordActivity } from "@/lib/activity/log";
import { staffFileLink } from "@/lib/media/fileOpen";

const ID = /^[A-Za-z0-9_-]{1,64}$/;

async function gate(member, { write }) {
  const full = await loadEnforceableMember(db, member.id);
  requireLevel(full, "quotes", write ? "view_create_edit" : "view_only", write ? "ask subcontractors for prices" : "see price requests");
  requireSubcontractorRead(full);
  if (write) requireSubcontractorWrite(full);
  return full;
}

export async function GET(request) {
  const { member, response } = await memberOrRefusal(request);
  if (response) return response;
  let full;
  try {
    full = await gate(member, { write: false });
  } catch (err) {
    const { body, status } = permissionErrorResponse(err);
    return NextResponse.json(body, { status });
  }
  const url = new URL(request.url);
  const quoteId = url.searchParams.get("quoteId");
  const jobId = url.searchParams.get("jobId");
  if ((quoteId && !ID.test(quoteId)) || (jobId && !ID.test(jobId)))
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  try {
    const ctx = await loadRequestContext(db, { companyId: member.companyId, quoteId, jobId });
    const listed = await listRequestsForQuote(db, {
      companyId: member.companyId,
      quoteId: ctx.quote.id,
      mayCost: hasToggle(full, "jobCosting"),
    });
    // A reply's file is opened through /api/files/open, never by its stored
    // URL: the Cloudinary account refuses to deliver a PDF from its plain
    // URL (401 — scripts/check-cloudinary-pdf.mjs, lib/media/signedFile.js),
    // so that link would look right and never open. The stored URL is not
    // sent at all, so nothing on the screen can fall back to it.
    const requests = listed.map((r) => ({
      ...r,
      recipients: r.recipients.map((x) =>
        x.reply?.file
          ? {
              ...x,
              reply: {
                ...x.reply,
                file: {
                  filename: typeof x.reply.file.filename === "string" ? x.reply.file.filename : null,
                  openUrl: staffFileLink(member, { kind: "price-reply-file", id: x.id }),
                },
              },
            }
          : x,
      ),
    }));
    const company = await db.company.findUnique({
      where: { id: member.companyId },
      select: { subRequestReminderDays: true },
    });
    return NextResponse.json({
      quoteId: ctx.quote.id,
      quoteNumber: ctx.quote.quoteNumber,
      quoteStatus: ctx.quote.status,
      // Whether the button is drawn at all: the quote takes requests, and
      // this member may send one. Never a button the POST would refuse.
      canSend:
        quoteTakesRequests(ctx.quote.status) &&
        hasLevel(full, "quotes", "view_create_edit") &&
        canWriteSubcontractors(full) &&
        Boolean(member.userId),
      canConfirm: hasLevel(full, "quotes", "view_create_edit") && hasToggle(full, "showPricing") && Boolean(member.userId),
      subs: ctx.subs.map((s) => ({
        id: s.id,
        name: s.name,
        trade: s.trade || "",
        hasEmail: Boolean(s.email && String(s.email).includes("@")),
        onFieldQuo: Boolean(s.linkedCompanyId),
      })),
      photos: ctx.photosOnFile,
      jobAddress: jobAddressFor(ctx.quote),
      reminderDays: company?.subRequestReminderDays ?? 3,
      requests,
    });
  } catch (err) {
    if (err instanceof RequestError) return NextResponse.json({ error: err.message, code: err.code }, { status: err.status });
    console.error("[price-requests GET]", err);
    return NextResponse.json({ error: "Couldn't load price requests." }, { status: 500 });
  }
}

const REFUSALS = {
  bad_body: "We couldn't read that request.",
  no_subs: "Pick at least one subcontractor.",
  too_many_subs: "Pick at most 20 subcontractors.",
  no_trade: "Say which trade you need priced.",
  no_scope: "Describe what you need priced.",
  bad_date: "Pick a valid wanted-by date.",
  date_past: "The wanted-by date has already passed.",
};

export async function POST(request) {
  const { member, response } = await memberOrRefusal(request);
  if (response) return response;
  // A write: a read-only support session (no userId) never gets further.
  if (!member.userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    await gate(member, { write: true });
  } catch (err) {
    const { body, status } = permissionErrorResponse(err);
    return NextResponse.json(body, { status });
  }
  const body = await request.json().catch(() => null);
  const parsed = parseRequestInput(body);
  if (!parsed.ok) return NextResponse.json({ error: REFUSALS[parsed.error] || REFUSALS.bad_body, code: parsed.error }, { status: 400 });
  const quoteId = typeof body?.quoteId === "string" && ID.test(body.quoteId) ? body.quoteId : null;
  const jobId = typeof body?.jobId === "string" && ID.test(body.jobId) ? body.jobId : null;

  try {
    const context = await loadRequestContext(db, { companyId: member.companyId, quoteId, jobId });
    const photos = pickOnFilePhotos(parsed.data.photoUrls, context.photosOnFile);
    const { request: made, recipients } = await createPriceRequest(db, {
      member,
      input: parsed.data,
      context,
      photos,
      siteAddress: jobAddressFor(context.quote),
    });

    // Sent one by one, AFTER the rows exist: a failure leaves that sub
    // "not sent" with a Send again button, never "sent" to nobody.
    const origin = getAppOrigin(request);
    const results = [];
    for (const r of recipients) {
      let out;
      try {
        out = await sendPriceRequestEmail({ recipientId: r.id, origin });
      } catch (err) {
        out = { ok: false, error: err?.message || "send failed" };
      }
      results.push({ recipientId: r.id, ok: out.ok, error: out.ok ? null : out.error });
    }
    const sent = results.filter((x) => x.ok).length;

    await recordActivity(member, {
      action: "quote.price_request_sent",
      entityType: "quote",
      entityId: context.quote.id,
      summary: `Asked ${recipients.length} subcontractor${recipients.length === 1 ? "" : "s"} to price ${parsed.data.trade} on ${context.quote.quoteNumber}`,
      metadata: { requestId: made.id, sent, failed: results.length - sent },
    });

    return NextResponse.json({ ok: true, requestId: made.id, sent, failed: results.length - sent, results }, { status: 201 });
  } catch (err) {
    if (err instanceof RequestError) return NextResponse.json({ error: err.message, code: err.code }, { status: err.status });
    console.error("[price-requests POST]", err);
    return NextResponse.json({ error: "Couldn't send the request. Please try again." }, { status: 500 });
  }
}
