// app/api/invoices/[id]/deep-read/route.js
//
// The PAID deep photo read over an invoice's photos — app/api/quotes/[id]/
// vision/route.js's twin. POST spends VISION_PASS_CENTS of the company's AI
// credit and runs it; GET returns whatever passes are on record, free.
//
// Reserve first, vendor second, refund on failure — the same order the
// quote's route keeps and lib/voice/spendGate.js's header explains: the
// credit is taken BEFORE lib/ai/visionPass.js calls the model, and put back
// into the SAME "ai" wallet (forKind) if the call fails or comes back
// unusable. Passes accumulate on Invoice.aiVisionPasses, newest first, for
// the reason the column's own comment gives.
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { db } from "@/lib/db";
import { memberOrRefusal } from "@/lib/apiMember";
import { levelOrRefusal } from "@/lib/permissions/apiGate";
import { can } from "@/lib/permissions";
import { featureAllowsSpend } from "@/lib/features/gate";
import { publicTopupOffer } from "@/lib/ai/topupOffer";
import { checkSpend, reserveSpend, refundReservation } from "@/lib/voice/spendGate";
import { photosFromQuote } from "@/lib/ai/quoteReview";
import { loadInvoice, invoiceServicesContext } from "@/lib/ai/invoiceReview";
import { runVisionPass } from "@/lib/ai/visionPass";
import { deepReadView, DEEP_READ_SCOPE_SELECT } from "@/lib/ai/deepReadView";
import { tradeKeysOf } from "@/lib/ai/deepReadEvidence";

export async function GET(request, { params }) {
  // Next 16: params is a Promise.
  const { id } = await params;
  const { member, response } = await memberOrRefusal(request);
  if (response) return response;

  const { response: denied } = await levelOrRefusal(member, "invoices", "view_only", "see invoices");
  if (denied) return denied;

  const invoice = await db.invoice.findFirst({
    where: { id, companyId: member.companyId },
    // The source quote's scope groups: an invoice carries no trade of its
    // own, so the photo check and the measured-beside rows judge against the
    // quote it was raised from. No quote → no trade → no verdict, never a
    // guessed one (lib/ai/deepReadEvidence.js deepReadMismatch "unknown").
    select: { aiVisionPasses: true, quote: { select: { scopeGroups: DEEP_READ_SCOPE_SELECT } } },
  });
  if (!invoice) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const view = await deepReadView(
    Array.isArray(invoice.aiVisionPasses) ? invoice.aiVisionPasses : [],
    invoice.quote?.scopeGroups || [],
  );

  // The read-only verdict on whether the wallet covers one read — the same
  // verdict POST takes the money on, minus the taking. Never a 402 from GET.
  const spend = await checkSpend({ companyId: member.companyId, kind: "image_vision" });

  return NextResponse.json({
    passes: view.passes,
    tradeNames: view.tradeNames,
    spend: {
      allowed: spend.allowed,
      reason: spend.reason,
      needCents: spend.needCents,
      balanceCents: spend.balanceCents,
      shortfallCents: spend.shortfallCents,
    },
  });
}

export async function POST(request, { params }) {
  const { id } = await params;
  const { member, response } = await memberOrRefusal(request);
  if (response) return response;

  const { response: denied } = await levelOrRefusal(member, "invoices", "view_create_edit", "edit invoices");
  if (denied) return denied;

  // Loaded, and the photo count checked, BEFORE any credit moves.
  const invoice = await loadInvoice(id, member.companyId);
  if (!invoice) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const photoCount = photosFromQuote(invoice).length;
  if (!photoCount) {
    return NextResponse.json(
      { error: "This invoice has no photos attached yet — there's nothing for a deep read to look at." },
      { status: 400 },
    );
  }

  // Named explicitly — this literal is what makes ai_vision a real consumer
  // of its registry entry (scripts/check-feature-flags.mjs).
  const offered = await featureAllowsSpend(member.companyId, "ai_vision");

  const ref = `image_vision:invoice:${id}:${randomUUID()}`;
  const reserved = await reserveSpend({
    companyId: member.companyId,
    kind: "image_vision",
    ref,
    note: `Deep photo read — invoice ${id}`,
    available: offered,
  });

  if (!reserved.allowed) {
    if (reserved.reason === "feature_unavailable") {
      return NextResponse.json({ error: "The deep photo read isn't available on your account yet." }, { status: 403 });
    }
    // The whole truth before they commit, and the way past it — the same
    // offer the quote's route carries, off the same wallet.
    return NextResponse.json(
      {
        error:
          `A deep photo read costs $${(reserved.needCents / 100).toFixed(2)} of AI credit. ` +
          `Your balance is $${(reserved.balanceCents / 100).toFixed(2)} — add at least ` +
          `$${(reserved.shortfallCents / 100).toFixed(2)} first.`,
        needCents: reserved.needCents,
        balanceCents: reserved.balanceCents,
        shortfallCents: reserved.shortfallCents,
        topup: publicTopupOffer(reserved.shortfallCents, can(member.role, "user:manage")),
      },
      { status: 402 },
    );
  }

  const refund = (note) =>
    refundReservation({
      companyId: member.companyId,
      ref,
      cents: reserved.needCents,
      // Debited under "image_vision" → the "ai" wallet; the refund has to be
      // told the same, or it credits the voice balance instead.
      forKind: "image_vision",
      note,
    }).catch(() => {});

  try {
    // The invoice's own lines as the services context — the prompt judges
    // the photos against the document being billed, not a quote it may not
    // have (lib/ai/visionPass.js `services`).
    const scopeGroups = invoice.quote?.scopeGroups || [];
    const result = await runVisionPass({
      quote: invoice,
      services: invoiceServicesContext(invoice),
      trades: tradeKeysOf(scopeGroups),
    });

    if (!result) {
      await refund("Refund — the deep read couldn't run");
      return NextResponse.json({ error: "Couldn't run the deep read just now. Nothing was charged." }, { status: 502 });
    }

    const fresh = await db.invoice.findUnique({ where: { id }, select: { aiVisionPasses: true } });
    const existing = Array.isArray(fresh?.aiVisionPasses) ? fresh.aiVisionPasses : [];
    const pass = {
      at: new Date().toISOString(),
      notes: result.notes,
      photosRead: result.photosRead,
      costCents: reserved.needCents,
      // Observations only; the mismatch verdict is computed on read.
      photos: result.photos,
      evidence: result.evidence,
      evidenceFamilies: result.evidenceFamilies,
    };
    const passes = [pass, ...existing];

    // The only write: the pass itself. No estimate reaches a line.
    await db.invoice.update({ where: { id }, data: { aiVisionPasses: passes } });

    const view = await deepReadView(passes, scopeGroups);
    return NextResponse.json({ passes: view.passes, tradeNames: view.tradeNames, chargedCents: reserved.needCents });
  } catch (err) {
    await refund("Refund — the deep read couldn't run");
    console.error("[invoices/deep-read]", err);
    return NextResponse.json({ error: "Couldn't run the deep read just now. Nothing was charged." }, { status: 502 });
  }
}
