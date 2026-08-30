// app/api/quotes/[id]/vision/route.js
//
// The PAID deep photo read. POST spends VISION_PASS_CENTS of the company's
// AI credit and runs it; GET returns whatever passes are already on record,
// free. Same split as /api/quotes/[id]/review, and for the same reason:
// reopening a quote must never silently spend money.
//
// ── Reserve first, vendor second, refund on failure ─────────────────────────
//
// Same shape as buying a phone number in app/api/settings/voice/number/route.js:
// the credit is taken BEFORE lib/ai/visionPass.js calls the model, and put
// back — into the SAME "ai" wallet it came out of, via `forKind` — if the
// model call fails or comes back unusable. See lib/voice/spendGate.js's header
// for why reserve-then-buy is the shape and never the other order.
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { db } from "@/lib/db";
import { memberOrRefusal } from "@/lib/apiMember";
import { levelOrRefusal } from "@/lib/permissions/apiGate";
import { requirePermission } from "@/lib/permissions";
import { featureAllowsSpend } from "@/lib/features/gate";
import { reserveSpend, refundReservation } from "@/lib/voice/spendGate";
import { loadQuote, photosFromQuote } from "@/lib/ai/quoteReview";
import { runVisionPass } from "@/lib/ai/visionPass";

export async function GET(request, { params }) {
  // Next 16: params is a Promise.
  const _params = await params;
  const { member, response } = await memberOrRefusal(request);
  if (response) return response;

  const { response: denied } = await levelOrRefusal(member, "quotes", "view_only", "see quotes");
  if (denied) return denied;

  const quote = await db.quote.findFirst({
    where: { id: _params.id, companyId: member.companyId },
    select: { aiVisionPasses: true },
  });
  if (!quote) return NextResponse.json({ error: "Not found" }, { status: 404 });

  return NextResponse.json({
    passes: Array.isArray(quote.aiVisionPasses) ? quote.aiVisionPasses : [],
  });
}

export async function POST(request, { params }) {
  const _params = await params;
  const { member, response } = await memberOrRefusal(request);
  if (response) return response;

  try {
    requirePermission(member.role, "quote:create");
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: err.status || 403 });
  }

  const { response: denied } = await levelOrRefusal(
    member,
    "quotes",
    "view_create_edit",
    "edit quotes",
  );
  if (denied) return denied;

  // Loaded, and the photo count checked, BEFORE any credit moves. A quote with
  // no photos has nothing for a deep read to do, and the honest refusal is
  // "there's nothing to read" — never a reserve-then-refund round trip on the
  // ledger for a request that was never going to spend anything real.
  const quote = await loadQuote(_params.id, member.companyId);
  if (!quote) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const photoCount = photosFromQuote(quote).length;
  if (!photoCount) {
    return NextResponse.json(
      { error: "This quote has no photos attached yet — there's nothing for a deep read to look at." },
      { status: 400 },
    );
  }

  // Named explicitly, rather than left to reserveSpend's own kind→feature
  // lookup (lib/voice/spendGate.js's FEATURE_FOR_KIND) — this literal call is
  // what makes ai_vision a REAL consumer of its registry entry, the thing
  // scripts/check-feature-flags.mjs greps for.
  const offered = await featureAllowsSpend(member.companyId, "ai_vision");

  const ref = `image_vision:${_params.id}:${randomUUID()}`;
  const reserved = await reserveSpend({
    companyId: member.companyId,
    kind: "image_vision",
    ref,
    note: `Deep photo read — quote ${_params.id}`,
    available: offered,
  });

  if (!reserved.allowed) {
    if (reserved.reason === "feature_unavailable") {
      return NextResponse.json(
        { error: "The deep photo read isn't available on your account yet." },
        { status: 403 },
      );
    }
    // The whole truth before they commit — what it costs, what they have, how
    // short. "Insufficient balance" with no numbers is the dead control
    // AGENTS.md forbids.
    return NextResponse.json(
      {
        error:
          `A deep photo read costs $${(reserved.needCents / 100).toFixed(2)} of AI credit. ` +
          `Your balance is $${(reserved.balanceCents / 100).toFixed(2)} — add at least ` +
          `$${(reserved.shortfallCents / 100).toFixed(2)} first.`,
        needCents: reserved.needCents,
        balanceCents: reserved.balanceCents,
        shortfallCents: reserved.shortfallCents,
      },
      // 402: they may do this, they just haven't paid for it yet.
      { status: 402 },
    );
  }

  const refund = (note) =>
    refundReservation({
      companyId: member.companyId,
      ref,
      cents: reserved.needCents,
      // The reservation was debited under kind "image_vision", which is what
      // routes it to the "ai" wallet (lib/voice/credits.js poolForKind). The
      // refund has to be told the same thing, explicitly — omitting `forKind`
      // would credit the VOICE balance instead, which is a transfer between
      // wallets dressed as a refund.
      forKind: "image_vision",
      note,
    }).catch(() => {});

  try {
    const result = await runVisionPass({ quote });

    if (!result) {
      await refund("Refund — the deep read couldn't run");
      return NextResponse.json(
        { error: "Couldn't run the deep read just now. Nothing was charged." },
        { status: 502 },
      );
    }

    // Newest first. Every earlier paid pass stays on the row — see the schema
    // comment on Quote.aiVisionPasses for why this accumulates instead of
    // overwriting the way the free aiReview does.
    const fresh = await db.quote.findUnique({
      where: { id: _params.id },
      select: { aiVisionPasses: true },
    });
    const existing = Array.isArray(fresh?.aiVisionPasses) ? fresh.aiVisionPasses : [];
    const pass = {
      at: new Date().toISOString(),
      notes: result.notes,
      photosRead: result.photosRead,
      costCents: reserved.needCents,
    };
    const passes = [pass, ...existing];

    await db.quote.update({
      where: { id: _params.id },
      data: { aiVisionPasses: passes },
    });

    return NextResponse.json({ passes, chargedCents: reserved.needCents });
  } catch (err) {
    await refund("Refund — the deep read couldn't run");
    console.error("[quotes/vision]", err);
    return NextResponse.json(
      { error: "Couldn't run the deep read just now. Nothing was charged." },
      { status: 502 },
    );
  }
}
