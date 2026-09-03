// app/api/ai/topup/route.js
//
// Buying AI credit from wherever you ran out — the endpoint behind
// app/components/ai/AiCreditTopupDialog.js.
//
// ══ How this differs from /api/settings/ai/topup, and why both exist ═══════
//
// That route serves a page whose entire subject is "how much credit do you
// want", with a custom-amount box; it takes `{ cents }` and clamps it. This one
// serves a dialog that opens over a canvas because something was refused, and
// it takes a TIER ID from a closed list, priced server-side by
// lib/ai/topupOffer.js. AGENTS.md non-negotiable #5 — the browser never sends
// money amounts — and a body that names one is REFUSED rather than sanitised,
// so the contract is readable off the wire.
//
// Neither route creates its own Checkout Session or credits anything: both call
// lib/ai/topupIntent.js, which calls lib/ai/topup.js's creditAiTopup, which is
// also what the checkout.session.completed webhook calls. One creation path,
// one settlement, one demo branch.
//
// ══ Why the GET is here as well as on the settings route ═══════════════════
//
// Because the redirect comes back to the DESIGNER, not to settings, and the
// dialog has to confirm the payment from wherever it landed. Both GETs are two
// lines around confirmAiTopup for exactly that reason.
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { memberOrRefusalPlain } from "@/lib/apiMember";
import { requirePermission } from "@/lib/permissions";
import { getAppOrigin } from "@/lib/appUrl";
import { tierCentsFor, bodyNamesAnAmount, safeReturnPath } from "@/lib/ai/topupOffer";
import { startAiTopup, confirmAiTopup } from "@/lib/ai/topupIntent";

async function requireBuyer(request) {
  const { member, refusal } = await memberOrRefusalPlain(request);
  if (refusal) return refusal;
  try {
    requirePermission(member.role, "user:manage");
  } catch {
    // The same permission the settings route enforces. It is also the reason
    // the dialog is told `canBuy` up front (lib/ai/topupOffer.js): a crew
    // member can be inside the designer, see the refusal, and have no way to
    // buy — and they must be told to ask an owner rather than shown a button
    // that lands here.
    return { error: "Only an owner or admin can buy AI credit.", status: 403 };
  }
  return { member };
}

export async function POST(request) {
  const { member, error, status } = await requireBuyer(request);
  if (error) return NextResponse.json({ error }, { status });

  const body = await request.json().catch(() => ({}));

  if (bodyNamesAnAmount(body)) {
    return NextResponse.json(
      {
        error: "This top-up is priced by the server. Send a tier, not an amount.",
        reason: "amount_from_client",
      },
      { status: 400 },
    );
  }

  const cents = tierCentsFor(body?.tierId);
  if (!cents) {
    return NextResponse.json(
      { error: "Pick one of the offered top-up amounts.", reason: "bad_tier" },
      { status: 400 },
    );
  }

  const company = await db.company.findUnique({ where: { id: member.companyId } });
  if (!company) return NextResponse.json({ error: "Company not found" }, { status: 404 });

  const result = await startAiTopup({
    company,
    cents,
    origin: getAppOrigin(request),
    // Null when it fails validation, which lands them on the AI credit page
    // instead of refusing the purchase — a worse landing, not a dead end.
    returnPath: safeReturnPath(body?.returnTo),
  });

  if (!result.ok) {
    return NextResponse.json(
      { error: "Couldn't reach the payment provider just now. Nothing was charged.", reason: result.reason },
      { status: 502 },
    );
  }

  return NextResponse.json(result);
}

export async function GET(request) {
  const { member, error, status } = await requireBuyer(request);
  if (error) return NextResponse.json({ error }, { status });

  const sessionId = new URL(request.url).searchParams.get("session_id");
  const result = await confirmAiTopup({ sessionId, companyId: member.companyId, member });

  if (!result.ok) {
    const httpStatus =
      result.reason === "wrong_company" ? 403 : result.reason === "no_session" ? 400 : 502;
    return NextResponse.json(
      {
        error:
          result.reason === "wrong_company"
            ? "That payment isn't for this account."
            : result.reason === "no_session"
              ? "No session"
              : "Couldn't confirm that payment just now.",
        reason: result.reason,
      },
      { status: httpStatus },
    );
  }

  return NextResponse.json(result);
}
