// app/api/public/change-orders/[token]/route.js
//
// The homeowner's side of a change order: read the addendum, approve it with
// a signature. Token-only, no session — a stranger with a link.
//
// ── What leaves the building ───────────────────────────────────────────────
//
// An allow-list, the same discipline as app/api/portal/[token]/route.js. The
// change order's own figures (its delta, the tax on it at the quote's rate,
// the new total) are the point of the page and are sent; nothing else about
// the job is — no internal notes, no other steps, no costs, no staff names
// beyond the company's. The quote's line the change is against comes from
// the snapshot taken when the change order was raised, so a later edit to the
// quote cannot change what the client sees next to their signature.
//
// ── The browser posts a decision and a mark, never an amount ───────────────
//
// AGENTS.md #5. The POST body is { signature: { name, dataUrl, consent } }.
// The amount the client is agreeing to is re-read from the row inside this
// request and hashed into the signature record; nothing the browser sends
// can move it.
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { resolveClientLanguage } from "@/lib/i18n/clientLanguage";
import { recordActivity } from "@/lib/activity/log";
import { changeOrderSummary } from "@/lib/jobs/changeOrderValue";
import {
  changeOrderLabel,
  sanitiseChangeOrderBody,
  quoteTaxRate,
  addendumMoney,
  buildChangeOrderSignature,
} from "@/lib/jobs/changeOrderAddendum";
import { applyChangeOrderDecision } from "@/lib/jobs/changeOrderDecision";

// First hop of x-forwarded-for is the client on Vercel. Best-effort — an audit
// record with a null IP is still a valid signature, just weaker evidence.
function clientIp(request) {
  const xff = request.headers.get("x-forwarded-for");
  if (xff) return xff.split(",")[0].trim();
  return request.headers.get("x-real-ip") || null;
}

const SELECT = {
  id: true,
  jobId: true,
  seq: true,
  createdAt: true,
  description: true,
  bodyHtml: true,
  priceDelta: true,
  scheduleDeltaDays: true,
  photos: true,
  quoteLineKey: true,
  originalLine: true,
  taskId: true,
  status: true,
  sentAt: true,
  viewedAt: true,
  decidedAt: true,
  signature: true,
  invoiceId: true,
  job: {
    select: {
      id: true,
      companyId: true,
      endDate: true,
      client: { select: { name: true, address: true, city: true, language: true } },
      quote: {
        select: {
          id: true,
          quoteNumber: true,
          language: true,
          acceptedAt: true,
          total: true,
          acceptedTotal: true,
          subtotal: true,
          acceptedSubtotal: true,
          tax: true,
          acceptedTax: true,
          discount: true,
        },
      },
      company: {
        select: { name: true, logoUrl: true, brandColor: true, phone: true, email: true, currency: true, defaultLanguage: true },
      },
    },
  },
};

async function load(token) {
  if (!token || typeof token !== "string" || token.length > 128) return null;
  return db.changeOrder.findUnique({ where: { shareToken: token }, select: SELECT });
}

async function present(co) {
  const job = co.job;
  const quote = job.quote;
  const company = job.company;
  const client = job.client;
  const language = resolveClientLanguage({ document: quote, client, company });

  const [all, siblings] = await Promise.all([
    db.changeOrder.findMany({ where: { jobId: job.id }, select: { id: true, seq: true, createdAt: true } }),
    db.changeOrder.findMany({
      where: { jobId: job.id, NOT: { id: co.id } },
      select: { priceDelta: true, status: true, invoiceId: true },
    }),
  ]);
  const priorApproved = changeOrderSummary(siblings).approvedTotal;
  const quoteTotal = quote ? Number(quote.acceptedTotal ?? quote.total) : null;
  const money = quote
    ? addendumMoney({ quoteTotal, priorApproved, delta: Number(co.priceDelta), taxRate: quoteTaxRate(quote) })
    : null;

  const finish = job.endDate ? new Date(job.endDate) : null;
  let finishAfter = null;
  if (finish && Number.isInteger(co.scheduleDeltaDays) && co.scheduleDeltaDays !== 0) {
    finishAfter = new Date(finish);
    finishAfter.setDate(finishAfter.getDate() + co.scheduleDeltaDays);
  }

  return {
    language,
    company: {
      name: company.name,
      logoUrl: company.logoUrl,
      brandColor: company.brandColor,
      phone: company.phone,
      email: company.email,
      currency: company.currency,
    },
    client: {
      name: client?.name || "",
      address: [client?.address, client?.city].filter(Boolean).join(", "),
    },
    quote: quote ? { quoteNumber: quote.quoteNumber, acceptedAt: quote.acceptedAt } : null,
    changeOrder: {
      id: co.id,
      label: changeOrderLabel(co, all),
      description: co.description,
      // Sanitised again on the way out — the boundary holds even if a row
      // was written by something other than the form.
      bodyHtml: sanitiseChangeOrderBody(co.bodyHtml || ""),
      priceDelta: Number(co.priceDelta),
      scheduleDeltaDays: co.scheduleDeltaDays,
      photos: Array.isArray(co.photos) ? co.photos : [],
      originalLine: co.originalLine || null,
      createdAt: co.createdAt,
      status: co.status,
      signedBy: co.signature?.name || null,
      signedAt: co.signature?.signedAt || null,
    },
    money,
    schedule: {
      // The finish as the job records it — already shifted once approved, so
      // "before" is derived back for an approved row rather than re-shifted.
      finishBefore: co.status === "approved" && finish && Number.isInteger(co.scheduleDeltaDays)
        ? new Date(finish.getTime() - co.scheduleDeltaDays * 86400000)
        : finish,
      finishAfter: co.status === "approved" ? finish : finishAfter,
    },
  };
}

export async function GET(request, { params }) {
  // Next 16: params is a Promise.
  const { token } = await params;
  const co = await load(token);
  if (!co) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // First open, once. Best effort and never on the row's decision.
  if (!co.viewedAt) {
    db.changeOrder
      .updateMany({ where: { id: co.id, viewedAt: null }, data: { viewedAt: new Date() } })
      .catch(() => {});
  }

  return NextResponse.json(await present(co));
}

export async function POST(request, { params }) {
  const { token } = await params;
  const co = await load(token);
  if (!co) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // Only a change order that is OUT with the client can be signed. One a
  // staff member took back to pending, withdrew, or already approved answers
  // with its state so the page can say so — a signature landing on a
  // withdrawn change would approve something the company no longer offers.
  if (co.status !== "waiting_client") {
    return NextResponse.json({ error: "This change order is not open for signature.", status: co.status }, { status: 409 });
  }

  const body = await request.json().catch(() => ({}));
  const signature = buildChangeOrderSignature({
    changeOrder: co,
    name: body?.signature?.name,
    signatureDataUrl: body?.signature?.dataUrl,
    consent: body?.signature?.consent === true,
    ip: clientIp(request),
    userAgent: request.headers.get("user-agent"),
  });
  if (!signature) {
    return NextResponse.json(
      {
        error: "A signature is required to approve. Add your name, sign in the box, and tick the agreement.",
        needsSignature: true,
      },
      { status: 400 },
    );
  }

  // updateMany with the status in the predicate: two taps on Approve & sign
  // race here, and the second finds no row to move. Its signature is not
  // written over the first — the first is the one that counts.
  const moved = await db.changeOrder.updateMany({
    where: { id: co.id, status: "waiting_client" },
    data: {
      status: "approved",
      signature,
      decidedAt: new Date(),
      // The client decided, not a staff member.
      decidedById: null,
    },
  });
  if (moved.count === 0) {
    return NextResponse.json({ error: "This change order is not open for signature.", status: "approved" }, { status: 409 });
  }

  await applyChangeOrderDecision(co.id, "approved", { byUserId: null, previousStatus: "waiting_client" });

  const label = changeOrderLabel(co, await db.changeOrder.findMany({ where: { jobId: co.jobId }, select: { id: true, seq: true, createdAt: true } }));
  await recordActivity(
    { companyId: co.job.companyId },
    {
      action: "change_order.approved",
      entityType: "job",
      entityId: co.jobId,
      actorName: "Client (approval link)",
      summary: `Change order ${label} approved and signed by ${signature.name} (${Number(co.priceDelta) >= 0 ? "+" : ""}${Number(co.priceDelta).toFixed(2)})`,
      metadata: { changeOrderId: co.id, priceDelta: Number(co.priceDelta), signedBy: signature.name },
    },
  );

  const fresh = await load(token);
  return NextResponse.json(await present(fresh));
}
