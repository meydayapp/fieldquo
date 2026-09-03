// app/api/platform/sales/playbooks/preview/route.js
//
// Exactly what a rep would see for one prospect, plus the whole reason why.
//
// ══ Why a preview exists on the console at all ═══════════════════════════
//
// A playbook screen that only lets you edit words is a screen where nobody
// finds out that a playbook never opens. This route runs the real engine over
// a real prospect and returns `selection.trace` — every playbook considered and
// the refusal for each. "Why does my new playbook never fire?" is answerable
// on the page that writes it.
//
// It is also the surface that answers §58's own test: a rep asking "why am I
// saying this?" gets a rule key, the observations it read, and the evidence
// behind every sentence — never "the AI chose it".
//
// ══ GET never spends money. POST does, and says so. ══════════════════════
//
// Opening the page runs the deterministic path only: the script renders from
// the rules, plainer, and nothing is sent to a model. Generating is an explicit
// POST behind a button, metered against FieldQuo's own PlatformAiBudget. A page
// that quietly bills the company on every load is the kind of thing found on an
// invoice rather than in a review.
//
// ══ There is no `variant` parameter, and there must not be ═══════════════
//
// §38. `shapeAssignmentRequest` refuses a body naming one rather than ignoring
// it, and the same refusal applies here even though the caller is a superadmin:
// a preview that could force an arm would silently write an assignment the
// experiment then counts.
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { superadminOrRefusal } from "@/lib/sales/intel/configAdmin";
import { assembleProspectPlaybook } from "@/lib/sales/playbook/assemble";
import { shapeAssignmentRequest } from "@/lib/sales/playbook/experiments";

export async function GET(request) {
  const { refusal } = await superadminOrRefusal(request);
  if (refusal) return NextResponse.json(refusal.body, { status: refusal.status });

  // Next 16: searchParams on a Request is read off the URL, not awaited — that
  // rule is about the page/layout props.
  const prospectId = new URL(request.url).searchParams.get("prospectId");
  if (!prospectId) {
    return NextResponse.json({ error: "A prospectId is required." }, { status: 400 });
  }

  const result = await assembleProspectPlaybook({ prospectId, useAi: false });
  if (!result.found) {
    return NextResponse.json({ error: "No prospect with that id." }, { status: 404 });
  }
  return NextResponse.json(result);
}

export async function POST(request) {
  const { refusal } = await superadminOrRefusal(request);
  if (refusal) return NextResponse.json(refusal.body, { status: refusal.status });

  const body = await request.json().catch(() => ({}));

  // Refused, not stripped. See the header.
  const shaped = shapeAssignmentRequest(body);
  if (shaped.error) {
    return NextResponse.json(
      { error: shaped.error, refusal: shaped.refusal, fields: shaped.keys || [] },
      { status: 400 },
    );
  }

  const result = await assembleProspectPlaybook({
    prospectId: shaped.value.prospectId,
    useAi: true,
    // Stored when the tables exist; `generation.persisted` says whether it was,
    // so the screen never implies a save that did not happen.
    persist: true,
  });
  if (!result.found) {
    return NextResponse.json({ error: "No prospect with that id." }, { status: 404 });
  }
  return NextResponse.json(result);
}
