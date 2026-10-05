// app/api/marketing/video-pack/route.js
//
// The month's video allowance, and the "Video pack" add-on that raises it.
//
//   GET                   → this month's count, the allowance, the packs held
//   GET  ?session_id=…     → confirm a just-completed pack checkout (the
//                            browser-return door; the webhook is the other)
//   POST { returnPath? }   → a Stripe Checkout URL for one more pack
//   DELETE ?id=…           → stop a pack renewing at the end of its paid month
//
// Buying and cancelling are for an owner or admin (lib/billing/billingAdmin.js
// — a standing monthly charge on the company's card, the same authority as
// the plan itself). Everyone who can make video posts may SEE the count,
// because it is what decides whether their next upload is accepted.
//
// Economics, the rule and the worked example: lib/marketing/videoAllowance.js.
// Stripe and idempotency: lib/marketing/videoPack.js.
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { memberOrRefusal } from "@/lib/apiMember";
import { stripe } from "@/lib/stripe";
import { getAppOrigin } from "@/lib/appUrl";
import { recordError } from "@/lib/platform/errorLog";
import { BILLING_ADMIN_ERROR, isBillingAdmin } from "@/lib/billing/billingAdmin";
import { allowanceBody, loadVideoAllowance } from "@/lib/marketing/videoPostServer";
import { planLimits } from "@/lib/media/directUploadServer";
import { videoUploadCap } from "@/lib/marketing/videoUpload";
import { megabytes } from "@/lib/media/validate";
import {
  VIDEO_PACK_KIND,
  cancelVideoPack,
  createVideoPackCheckoutSession,
  packAvailability,
  publicPack,
  settleVideoPackCheckoutSession,
} from "@/lib/marketing/videoPack";

/** Where Checkout may send the browser back to — our own screens only. */
const RETURN_PATHS = [/^\/app\/settings\/account-billing$/, /^\/app\/marketing\/designer(\/video\/[A-Za-z0-9_-]{1,64})?$/];
function safeReturnPath(value) {
  const path = typeof value === "string" ? value : "";
  return RETURN_PATHS.some((re) => re.test(path)) ? path : "/app/settings/account-billing";
}

async function body(member) {
  const a = await loadVideoAllowance(member.companyId);
  // The one limit that depends on FieldQuo's Cloudinary plan: the size of a
  // single upload (Free 100 MB, Plus much more). Read from the plan at the
  // same place the upload is signed, so the card can never quote a figure the
  // upload would not honour. The COUNT a pack buys does not depend on it.
  const uploadMaxBytes = videoUploadCap(await planLimits().catch(() => null));
  return {
    allowance: allowanceBody(a, member),
    packs: a.packs.filter((p) => p.status !== "canceled" || publicPack(p).counts).map((p) => publicPack(p)),
    availability: packAvailability(a.currency),
    uploadMaxBytes,
    uploadMaxLabel: megabytes(uploadMaxBytes),
  };
}

export async function GET(request) {
  const { member, response } = await memberOrRefusal(request);
  if (response) return response;

  const sessionId = new URL(request.url).searchParams.get("session_id");
  // Settling writes the pack row; a read-only support session gets the plain
  // read instead, as the AI bundle route does.
  if (sessionId && member.impersonationMode !== "read_only") {
    let session;
    try {
      session = await stripe.checkout.sessions.retrieve(sessionId, { expand: ["subscription"] });
    } catch {
      return NextResponse.json({ ok: false, reason: "stripe_unavailable" }, { status: 502 });
    }
    if (session?.metadata?.companyId !== member.companyId || session?.metadata?.kind !== VIDEO_PACK_KIND) {
      return NextResponse.json({ ok: false, reason: "session_mismatch" }, { status: 403 });
    }
    const result = await settleVideoPackCheckoutSession(session);
    return NextResponse.json({ ...(await body(member)), settled: result });
  }
  return NextResponse.json(await body(member));
}

export async function POST(request) {
  const { member, response } = await memberOrRefusal(request);
  if (response) return response;
  if (!isBillingAdmin(member.role)) return NextResponse.json({ error: BILLING_ADMIN_ERROR, code: "billing_admin_only" }, { status: 403 });

  const payload = await request.json().catch(() => ({}));
  const company = await db.company.findUnique({ where: { id: member.companyId } });
  if (!company) return NextResponse.json({ error: "Company not found" }, { status: 404 });

  const availability = packAvailability(company.currency);
  if (!availability.ok) return NextResponse.json({ error: availability.reason, code: availability.code }, { status: 409 });

  const origin = getAppOrigin(request);
  const returnPath = safeReturnPath(payload?.returnPath);
  try {
    const result = await createVideoPackCheckoutSession({
      company,
      successUrl: `${origin}${returnPath}?videopack={CHECKOUT_SESSION_ID}`,
      cancelUrl: `${origin}${returnPath}`,
    });
    if (!result.ok) return NextResponse.json({ error: availability.reason || "Video packs can't be sold to this account.", code: result.reason }, { status: 409 });
    return NextResponse.json({ checkoutUrl: result.checkoutUrl });
  } catch (err) {
    await recordError({
      area: "billing",
      code: err?.code || err?.type || null,
      message: `Video pack checkout failed: ${err?.message}`,
      companyId: member.companyId,
      detail: { currency: company.currency },
    }).catch(() => {});
    return NextResponse.json(
      {
        error: err?.message ? `Stripe refused to start the video pack: ${err.message}` : "Couldn't reach the payment provider just now. Nothing was charged.",
        code: err?.message ? "stripe_refused" : "stripe_unavailable",
      },
      { status: 502 },
    );
  }
}

export async function DELETE(request) {
  const { member, response } = await memberOrRefusal(request);
  if (response) return response;
  if (!isBillingAdmin(member.role)) return NextResponse.json({ error: BILLING_ADMIN_ERROR, code: "billing_admin_only" }, { status: 403 });

  const id = new URL(request.url).searchParams.get("id");
  const result = await cancelVideoPack(member.companyId, id);
  if (!result.ok) {
    return NextResponse.json(
      {
        error:
          result.reason === "not_found"
            ? "That video pack wasn't found."
            : "Couldn't reach the payment provider to cancel just now. Nothing has changed — the pack is still active and still billing.",
        code: result.reason,
      },
      { status: result.reason === "not_found" ? 404 : 502 },
    );
  }
  return NextResponse.json(await body(member));
}
