// lib/designer/aiImageAdapter.js
//
// The ONE seam between the designer's two AI-image actions — remove
// background, generate — and an actual vendor call. Both meter on the SAME
// `image_generation` spend kind (lib/voice/spendGate.js), the same price
// (IMAGE_GENERATION_CENTS, lib/ai/imageEconomics.js), the same "ai" wallet.
// That was an explicit instruction, not a shortcut: removing a background is
// the same cost CLASS as generating one — an AI image edit, billed per call
// at any vendor — and inventing a second price for it would be exactly the
// kind of number nobody could later explain the reasoning for.
//
// ── Why this file does not call a vendor yet ────────────────────────────────
//
// A different agent is concurrently building lib/ai/images.js and an image
// entry point on lib/ai/provider.js in a SEPARATE worktree — the same role
// lib/ai/provider.js already plays for text (AGENTS.md: "the only file that
// talks to a model vendor"). Defining either here would collide with that
// work the moment the two branches merge. So this file stops at the seam:
// AI_IMAGE_VENDOR_READY is false, and requestAiImage() returns a clean
// "vendor_unavailable" refusal instead of attempting a call. Flip that one
// constant to true and replace the block marked TODO below with the real
// import once lib/ai/images.js lands — nothing else in this port, including
// the two API routes that call this file, needs to change.
//
// ── Why a status check exists separately from requestAiImage ───────────────
//
// The coordinator's own words: "never a button that appears to work." A
// control the vendor can't actually serve must render disabled with the
// reason BEFORE anyone clicks it, not click-then-reserve-then-refund-then-
// error. statusForCompany() answers three genuinely different questions up
// front — is the feature switched on, can this vendor call even be
// attempted, can this company afford it — so the sidebar can disable the
// button on whichever is false and say which, rather than "something went
// wrong".
import { featureAllowsSpend } from "@/lib/features/gate";
import { checkSpend, reserveSpend, refundReservation } from "@/lib/voice/spendGate";
import { generateMarketingImage } from "@/lib/ai/images";
import { can } from "@/lib/permissions";
import { publicTopupOffer } from "@/lib/ai/topupOffer";

/** Flip to true the moment lib/ai/images.js exists and is wired in below. */
export // Was false while the vendor call lived in another worktree, so both AI
// controls rendered DISABLED with a reason rather than pretending to work.
// lib/ai/images.js has landed; the controls are live.
const AI_IMAGE_VENDOR_READY = true;

const KIND = "image_generation";
// The literal "marketing_designer" string is written directly into each
// featureAllowsSpend() call below rather than lifted into a shared constant
// on purpose: scripts/check-feature-flags.mjs proves a registry key has a
// real consumer by finding that exact literal inside a featureAllowsSpend()/
// featureStateFor() call, not by tracing a variable back to its
// declaration — the same reason a config value gets inlined instead of
// imported when a static checker needs to see it. Keep both call sites
// using the same string if this ever gets refactored.

/**
 * Everything the sidebar needs to decide what to show. Read-only — no debit,
 * safe to call on every mount/re-render of the AI sidebar.
 *
 * ── Why the top-up offer rides on the STATUS, not only on a failed POST ────
 *
 * The owner's report was about this endpoint, not about a 402: he opened the
 * designer, clicked AI, and was told he had no credit — by the disabled state
 * below, before anything was submitted. A refusal that names a shortfall and
 * offers no way to close it is the dead end, and it is reached without ever
 * pressing Generate. So the offer is part of the answer to "can this company
 * afford it": `insufficient_balance` and no `topup` would be the same dead end
 * with a longer payload.
 *
 * `canBuy` is a genuinely separate question from `allowed`. A crew member can
 * be standing in the designer, see the refusal, and have no permission to
 * purchase — app/api/ai/topup/route.js requires "user:manage". Telling the
 * dialog up front is what stops it rendering a button that 403s.
 *
 * @param {string} companyId
 * @param {string} [role]  the member's role, for the purchase permission. Left
 *   optional rather than required: omitting it says "assume they cannot buy",
 *   which fails in the direction of showing "ask an owner" to somebody who
 *   could have bought it — the harmless one of the two mistakes.
 * @returns {Promise<{
 *   vendorReady: boolean,
 *   featureAvailable: boolean,
 *   allowed: boolean,
 *   priceCents: number,
 *   balanceCents: number,
 *   shortfallCents: number,
 *   reason: "feature_unavailable"|"vendor_unavailable"|"insufficient_balance"|"ok",
 *   topup: null | { tiers: Array<{id: string, label: string, covers: boolean}>,
 *                   recommendedId: string, canBuy: boolean },
 * }>}
 */
export async function statusForCompany(companyId, role = null) {
  const featureAvailable = await featureAllowsSpend(companyId, "marketing_designer");

  // Pre-resolved `available` passed straight through — checkSpend's own doc:
  // "omitting it asks for real, so this cannot fail open by forgetting." It
  // also saves a second, identical database round trip.
  const verdict = await checkSpend({ companyId, kind: KIND, available: featureAvailable });

  const reason = !featureAvailable
    ? "feature_unavailable"
    : !AI_IMAGE_VENDOR_READY
      ? "vendor_unavailable"
      : verdict.reason;

  return {
    vendorReady: AI_IMAGE_VENDOR_READY,
    featureAvailable,
    allowed: featureAvailable && AI_IMAGE_VENDOR_READY && verdict.allowed,
    priceCents: verdict.needCents,
    balanceCents: verdict.balanceCents,
    shortfallCents: verdict.shortfallCents,
    reason,
    // Null on every other reason on purpose. Money is not the answer to "this
    // feature is switched off for your account" or "the vendor isn't wired on
    // this deployment", and offering a top-up against either would take a
    // payment that changes nothing.
    topup:
      reason === "insufficient_balance"
        ? publicTopupOffer(verdict.shortfallCents, can(role, "user:manage"))
        : null,
  };
}

/**
 * Spend the money and (once wired) call the vendor.
 *
 * "Reserve first, buy second" — the same rule spendGate.js's own header
 * explains for phone numbers: the debit happens BEFORE the vendor call, and
 * if that call fails, refundReservation puts the money back with a note
 * saying why, rather than owning a charge for a picture nobody got.
 *
 * @param {Object} args
 * @param {string} args.companyId
 * @param {"generate"|"remove-bg"} args.action
 * @param {object} [args.payload]  action-specific input (a prompt, an image
 *   URL…) — unused today, carried through so the real vendor call has
 *   somewhere to receive it once wired.
 * @param {string} [args.note]
 * @param {string} [args.role]  the member's role, so a refusal for money can
 *   carry the same top-up offer statusForCompany does. The balance can drain
 *   between the status check and the click — a second image finished first, a
 *   photo review ran — so the 402 has to be able to open the dialog on its
 *   own rather than assuming the sidebar's cached status is still true.
 * @returns {Promise<{ ok: boolean, reason?: string, priceCents?: number,
 *   balanceCents?: number, shortfallCents?: number, url?: string,
 *   topup?: object }>}
 */
export async function requestAiImage({ companyId, action, payload, note, role = null }) {
  const featureAvailable = await featureAllowsSpend(companyId, "marketing_designer");
  if (!featureAvailable) {
    return { ok: false, reason: "feature_unavailable" };
  }

  // Refuses BEFORE reserving any money — see the module doc. Everything past
  // this line is the complete real flow, ready for the vendor call the
  // moment AI_IMAGE_VENDOR_READY flips; it does not run today.
  if (!AI_IMAGE_VENDOR_READY) {
    return { ok: false, reason: "vendor_unavailable" };
  }

  const ref = `designer-${action}:${crypto.randomUUID()}`;
  const verdict = await reserveSpend({
    companyId,
    kind: KIND,
    ref,
    note: note || `AI image — ${action}`,
    available: featureAvailable,
  });
  if (!verdict.allowed) {
    return {
      ok: false,
      reason: verdict.reason,
      priceCents: verdict.needCents,
      balanceCents: verdict.balanceCents,
      shortfallCents: verdict.shortfallCents,
      // Same rule as statusForCompany: an offer only where money is the
      // problem. reserveSpend can also refuse for a withdrawn feature or a
      // lapsed subscription, and neither is fixed by buying credit.
      topup:
        verdict.reason === "insufficient_balance"
          ? publicTopupOffer(verdict.shortfallCents, can(role, "user:manage"))
          : null,
    };
  }

  try {
    // ── The seam, closed ────────────────────────────────────────────────
    //
    // This stood at a TODO while the vendor call was built in a separate
    // worktree. lib/ai/images.js has landed, so the adapter calls it — and
    // calls it through lib/ai/provider.js like everything else, which is why
    // there is no OpenAI client anywhere near this file.
    //
    // Background removal is expressed as a generation FROM the photograph
    // rather than as its own vendor endpoint: gpt-image-1 edits an image it is
    // given, and "remove the background" is an instruction to that edit. It
    // costs the same as any other edit, which is exactly why it is metered on
    // the same kind and not quietly given away.
    const result =
      action === "remove-bg"
        ? await generateMarketingImage({
            prompt:
              "Remove the background from this photograph completely, keeping " +
              "the main subject exactly as it is — same colours, same edges, " +
              "same detail. Output the subject on a plain transparent " +
              "background. Do not add, remove, restyle or invent any part of " +
              "the subject itself.",
            referencePhotoUrl: payload?.image || null,
          })
        : await generateMarketingImage({
            prompt: payload?.prompt || "",
            referencePhotoUrl: payload?.referencePhotoUrl || null,
          });

    // A null return is the vendor refusing or AI being unconfigured — images.js
    // documents it as the caller's signal to refund rather than charge. It is
    // NOT an exception, so it would sail straight past the catch below; the
    // sibling worktree's own mutation testing found exactly this shape of
    // un-refunded charge, and this is the branch that prevents it here.
    if (!result?.url) throw new Error("the image service didn't return a picture");

    return { ok: true, url: result.url };
  } catch (err) {
    await refundReservation({
      companyId,
      ref,
      cents: verdict.needCents,
      note: `Refund — ${err.message}`,
      forKind: KIND,
    });
    return { ok: false, reason: "vendor_unavailable" };
  }
}
