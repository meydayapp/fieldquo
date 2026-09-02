// app/api/platform/sales/capabilities/[code]/route.js
//
// Edit one capability: its priority, whether it is on, and what a rep says.
//
// ══ What is NOT editable here, and why the refusal is explicit ════════════
//
// `caveats`, `planNote`, `usageNote` and `tableStakes` are derived from
// lib/marketing/featureMatrix.js and are ignored if sent. They are not merely
// absent from the form:
//
//   * a caveat exists because a marketing claim is `partial`, and
//     check:feature-matrix refuses a partial claim with no `limits`. Deleting
//     it here would move the hedge out from under that check without moving
//     the claim it hedges.
//   * `tableStakes` decides whether a capability may be pitched to a business
//     already running a competitor's platform. Editable, it becomes a dial
//     somebody turns to get more talking points, and the displacement property
//     stops being a property.
//
// A request that tries is answered 400 rather than silently ignored — a field
// that appears to save and doesn't is the failure this codebase is swept for.
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { getCurrentPlatformAdmin } from "@/lib/platform/currentPlatformAdmin";
import { updateCapability } from "@/lib/sales/intel/db";

/** Sentences a rep reads out. Bounded so a script stays a script. */
const MAX_POINTS = 12;
const MAX_POINT_LENGTH = 400;

const DERIVED_FIELDS = ["caveats", "planNote", "usageNote", "tableStakes", "matrixKeys", "featureKeys"];

export async function PATCH(request, { params }) {
  const admin = await getCurrentPlatformAdmin(request);
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (admin.role !== "superadmin") {
    return NextResponse.json(
      { error: "Only superadmins can edit what the sales team is allowed to promise" },
      { status: 403 },
    );
  }

  // Next 16: params is a Promise.
  const { code } = await params;
  const body = await request.json().catch(() => ({}));

  const offered = DERIVED_FIELDS.filter((f) => f in body);
  if (offered.length) {
    return NextResponse.json(
      {
        error:
          `${offered.join(", ")} ${offered.length === 1 ? "is" : "are"} derived from the ` +
          "marketing feature matrix and cannot be edited here — change the claim in " +
          "lib/marketing/featureMatrix.js and re-run the seed.",
      },
      { status: 400 },
    );
  }

  const patch = {};

  if ("active" in body) {
    if (typeof body.active !== "boolean") {
      return NextResponse.json({ error: "active must be true or false" }, { status: 400 });
    }
    patch.active = body.active;
  }

  if ("salesPriority" in body) {
    const n = Number(body.salesPriority);
    if (!Number.isInteger(n) || n < 0 || n > 100) {
      return NextResponse.json(
        { error: "salesPriority is a whole number from 0 to 100" },
        { status: 400 },
      );
    }
    patch.salesPriority = n;
  }

  if ("points" in body) {
    if (!Array.isArray(body.points)) {
      return NextResponse.json({ error: "points must be a list of sentences" }, { status: 400 });
    }
    const points = body.points
      .map((p) => (typeof p === "string" ? p.trim() : ""))
      .filter(Boolean);
    if (points.length > MAX_POINTS) {
      return NextResponse.json(
        { error: `${MAX_POINTS} talking points is the most a rep will read. Trim the list.` },
        { status: 400 },
      );
    }
    if (points.some((p) => p.length > MAX_POINT_LENGTH)) {
      return NextResponse.json(
        { error: `A talking point is one sentence — ${MAX_POINT_LENGTH} characters at most.` },
        { status: 400 },
      );
    }
    // An empty list is allowed and means "no script yet", which is honest. It
    // is not the same as leaving the seed's sentences in place, so it is stored
    // as written rather than being treated as "no change".
    patch.points = points;
  }

  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ error: "Nothing to change" }, { status: 400 });
  }

  const updated = await updateCapability(code, patch);
  if (!updated) {
    return NextResponse.json(
      { error: `No capability with the code ${code}. Run the seed first.` },
      { status: 404 },
    );
  }

  return NextResponse.json(updated);
}
