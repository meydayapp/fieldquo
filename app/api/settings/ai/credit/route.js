// app/api/settings/ai/credit/route.js
//
// The unified view: AI receptionist, crew texting, image generation and the
// paid vision pass, in one place — what the owner asked for.
//
// ══ Two wallets, shown side by side, never merged ══════════════════════════
//
// lib/voice/credits.js's own header is the source of truth here: the
// receptionist's per-minute cost AND crew texting both draw the VOICE wallet
// (a monthly floor, Retell's number rental, whether or not the phone rings);
// image generation and the paid vision pass draw the AI wallet (nothing
// recurs — a company that generates nothing owes nothing). Merging them into
// one number would put a recurring floor underneath a usage-only product, so
// this endpoint returns two balances and two statements, never a sum.
//
// The voice wallet's own purchase mechanics — top-up, auto-topup, the full
// statement — already exist and work at /app/settings/voice#credit. This
// route does not rebuild them; it links to them, and only builds new purchase
// plumbing for the wallet that had none: the AI one (lib/ai/topup.js,
// lib/ai/creditBundle.js).
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { memberOrRefusalPlain } from "@/lib/apiMember";
import { requirePermission } from "@/lib/permissions";
import { isAiConfigured } from "@/lib/ai/provider";
import { BUNDLES, IMAGE_GENERATION_CENTS, VISION_PASS_CENTS } from "@/lib/ai/imageEconomics";
import {
  balanceFor,
  POOLS,
  recentEntries,
  isLowBalance,
  ratePerMinute,
  TOPUP_OPTIONS,
} from "@/lib/voice/credits";
import { aiCreditBundleFor, publicAiBundle, BUNDLE_ROLLOVER_NOTICE } from "@/lib/ai/creditBundle";

export async function GET(request) {
  const { member, refusal } = await memberOrRefusalPlain(request);
  if (refusal) {
    return NextResponse.json({ error: refusal.error || "Unauthorized" }, { status: refusal.status || 401 });
  }
  // Same gate as both wallets' own settings screens — a company's money, an
  // owner or admin's decision to CHANGE. But this is the READ every other
  // route on this page defers to for "what does support see" — the topup and
  // bundle routes' own GETs are deliberately excused instead (see
  // scripts/check-settings-access.mjs's IMPERSONATION_STILL_REFUSED) — so a
  // read-only support session is waved through here, same as
  // app/api/settings/voice/route.js's identical carve-out. Non-negotiable #3:
  // the platform console views everything and edits nothing, and this route
  // has nothing to edit.
  if (!member.impersonation) {
    try {
      requirePermission(member.role, "user:manage");
    } catch {
      return NextResponse.json(
        { error: "Only an owner or admin can see AI credit." },
        { status: 403 },
      );
    }
  }

  const [voiceCents, aiCents, voiceEntries, aiEntries, bundleRow] = await Promise.all([
    balanceFor(member.companyId, undefined, POOLS.VOICE),
    balanceFor(member.companyId, undefined, POOLS.AI),
    recentEntries(member.companyId, 20, POOLS.VOICE),
    recentEntries(member.companyId, 20, POOLS.AI),
    aiCreditBundleFor(member.companyId),
  ]);

  const entryShape = (e) => ({
    at: e.createdAt,
    kind: e.kind,
    note: e.note,
    cents: e.cents,
  });

  return NextResponse.json({
    // Distinguishes "nothing spent here yet" from "this AI feature can't
    // spend at all on this deployment" — see AGENTS.md's rule against a
    // refusal with no reason. `vendorConfigured: false` means every spend
    // below will refuse with `vendor_unavailable`/`not_configured` no matter
    // what the balance says — buying credit still works, but it will sit
    // unspent until an OPENAI_API_KEY is set.
    vendorConfigured: isAiConfigured(),
    voice: {
      cents: voiceCents,
      low: isLowBalance(voiceCents),
      centsPerMinute: ratePerMinute("local"),
      entries: voiceEntries.map(entryShape),
      // Not a second top-up form — the real one, with auto-topup and the full
      // statement, already lives here.
      topupHref: "/app/settings/voice#credit",
    },
    ai: {
      cents: aiCents,
      entries: aiEntries.map(entryShape),
      priceCents: {
        image_generation: IMAGE_GENERATION_CENTS,
        image_vision: VISION_PASS_CENTS,
      },
      topups: TOPUP_OPTIONS,
      bundles: BUNDLES,
      bundle: publicAiBundle(bundleRow),
      bundleRolloverNotice: BUNDLE_ROLLOVER_NOTICE,
    },
  });
}
