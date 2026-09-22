// app/api/jobs/[id]/materials/build/route.js
//
// The PAID AI material list. POST spends MATERIAL_LIST_CENTS of the company's
// AI credit and builds it; nothing here runs on a GET, so reopening a job
// never silently spends money (the same split as the deep photo read,
// app/api/quotes/[id]/vision/route.js, and for the same reason).
//
// ── Reserve first, model second, refund on failure ──────────────────────────
//
// The credit is taken BEFORE lib/materials/build.js calls the model and put
// back — into the SAME "ai" wallet, via `forKind` — when the model returns
// nothing usable. See lib/voice/spendGate.js's header for why reserve-then-
// buy is the shape and never the other order.
//
// Two gates, both asked: the token quota (lib/ai/usage.js) because the call
// is metered like every other, and the wallet because this one is paid for.
// Next 16: params is a Promise.
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { db } from "@/lib/db";
import { memberOrRefusal } from "@/lib/apiMember";
import { can } from "@/lib/permissions";
import {
  loadEnforceableMember,
  requireLevel,
  permissionErrorResponse,
  assignedJobWhere,
} from "@/lib/permissions/enforce";
import { featureAllowsSpend } from "@/lib/features/gate";
import { publicTopupOffer } from "@/lib/ai/topupOffer";
import { checkAiQuota, recordAiUsage } from "@/lib/ai/usage";
import { checkSpend, reserveSpend, refundReservation } from "@/lib/voice/spendGate";
import { buildMaterialList } from "@/lib/materials/build";
import { taskForJobMaterials } from "@/lib/tasks/autoCreate";

export async function POST(request, { params }) {
  const { id } = await params;
  const { member, response } = await memberOrRefusal(request);
  if (response) return response;

  let full = null;
  try {
    full = await loadEnforceableMember(db, member.id);
    requireLevel(full, "jobs", "view_create_edit", "build a job's material list");
  } catch (err) {
    const { body, status } = permissionErrorResponse(err);
    return NextResponse.json(body, { status });
  }

  const job = await db.job.findFirst({
    where: { id, companyId: member.companyId, ...assignedJobWhere(full) },
    select: { id: true, quoteId: true },
  });
  if (!job) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (!job.quoteId) {
    // Checked BEFORE any credit moves: a job with no quote has nothing to
    // read, and the honest refusal is that sentence, not a reserve-then-
    // refund round trip on the ledger.
    return NextResponse.json(
      { error: "This job has no quote to build a material list from." },
      { status: 400 },
    );
  }

  const quota = await checkAiQuota(member.companyId);
  if (!quota.allowed) {
    return NextResponse.json({ error: quota.reason, quotaExceeded: true }, { status: 429 });
  }

  // This literal call is what makes ai_material_list a REAL consumer of its
  // registry entry — scripts/check-feature-flags.mjs greps for it.
  const offered = await featureAllowsSpend(member.companyId, "ai_material_list");

  const ref = `material_list:${id}:${randomUUID()}`;
  const reserved = await reserveSpend({
    companyId: member.companyId,
    kind: "material_list",
    ref,
    note: `AI material list — job ${id}`,
    available: offered,
  });

  if (!reserved.allowed) {
    if (reserved.reason === "feature_unavailable") {
      return NextResponse.json(
        { error: "The AI material list isn't available on your account yet." },
        { status: 403 },
      );
    }
    // The whole truth before they commit — what it costs, what they have,
    // how short — and the way past it, gated on the permission the top-up
    // route itself asks for.
    return NextResponse.json(
      {
        error:
          `Building the list costs $${(reserved.needCents / 100).toFixed(2)} of AI credit. ` +
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
      forKind: "material_list",
      note,
    }).catch(() => {});

  try {
    const result = await buildMaterialList({
      jobId: id,
      companyId: member.companyId,
      userId: member.userId,
      onUsage: (u) =>
        recordAiUsage({
          companyId: member.companyId,
          feature: "material_list",
          userId: member.userId,
          ...u,
        }),
    });

    if (!result || result.error) {
      await refund("Refund — the material list couldn't be built");
      const message =
        result?.error === "no_quote"
          ? "This job has no quote to build a material list from."
          : "Couldn't build the list just now. Nothing was charged.";
      return NextResponse.json({ error: message }, { status: result?.error === "no_quote" ? 400 : 502 });
    }

    // The same "buy the materials" to-do the hand-built list maintains.
    await taskForJobMaterials(id);

    const spend = await checkSpend({ companyId: member.companyId, kind: "material_list" });
    return NextResponse.json({
      build: result,
      chargedCents: reserved.needCents,
      spend: {
        allowed: spend.allowed,
        reason: spend.reason,
        needCents: spend.needCents,
        balanceCents: spend.balanceCents,
        shortfallCents: spend.shortfallCents,
      },
    });
  } catch (err) {
    await refund("Refund — the material list couldn't be built");
    console.error("[jobs/materials/build]", err);
    return NextResponse.json(
      { error: "Couldn't build the list just now. Nothing was charged." },
      { status: 502 },
    );
  }
}
