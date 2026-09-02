// app/api/platform/sales/attribution/route.js
//
// Capture path #2: a company attributed to a rep BY HAND, rather than by the
// rep's /signup?sales=CODE link. Same waterfall, same lock, same self-dealing
// checks — lib/sales/attribution.js is the only place any of that is decided,
// so this route is an actor and a body, nothing else.
//
// ── Why this lives on the PLATFORM surface and not the rep's ──────────────
//
// The brief's path #2 says "a rep enters the company from their own portal".
// It cannot be built on the rep surface as that surface is designed:
// lib/sales/gate.js — the single door onto every /api/sales route — refuses
// non-GET methods outright, and says why in its own header: "a sales route
// that needs to write does not exist and must not be addable by accident".
// docs/sales/PLAN.md §10 makes the same call ("a rep has zero write path to
// SalesAttribution"), for the reason that decides it: commission-on-influence
// means a rep who can write their own attribution is a rep who can pay
// themselves.
//
// Those two rules and the brief cannot all be true, so this takes the safe
// side and says so rather than quietly building a write door a security
// design just closed: manual attribution is a platform action, superadmin
// only. If the owner decides a rep really should claim a company themselves,
// the rules do not move — a rep-side route calls this same
// captureSalesAttribution() with `salesRepId` forced to the session's own rep
// and never read from a body — but the no-writes rule in lib/sales/gate.js has
// to be reopened deliberately, by whoever owns it.
//
// ── What a manual claim may and may not do ────────────────────────────────
//
// Claim a company nothing has claimed yet. It may never move, overwrite or
// delete an attribution that already exists — a second claim becomes a
// SalesAttributionTouch and the first rep keeps the company. Moving one is the
// correction route next door: superadmin, reasoned, audited.
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentPlatformAdmin } from "@/lib/platform/currentPlatformAdmin";
import { requirePlatformPermission } from "@/lib/platform/permissions";
import { captureSalesAttribution } from "@/lib/sales/attribution";

const bad = (error, status = 400) => NextResponse.json({ error }, { status });

// Why each refusal reads the way it does: a platform console user has to be
// able to tell "your input was wrong" from "the rules say no", because the
// second one is not something they can fix by retyping.
const REFUSALS = {
  invalid_source: "Unrecognised attribution source.",
  malformed_code: "That isn't a usable sales code.",
  unknown_rep: "No sales rep matches that.",
  inactive_rep: "That rep is deactivated or has left — reactivate them first.",
  unknown_company: "No such company.",
  self_dealing:
    "A rep can't be attributed to their own company. Their email matches the " +
    "company's, or they're a member of it.",
};

export async function POST(request) {
  const admin = await getCurrentPlatformAdmin(request);
  if (!admin) return bad("Unauthorized", 401);
  try {
    // Not listed in SUPERADMIN_ONLY_PERMISSIONS, which is a documentation
    // array in a file this change does not own. The gate is real regardless:
    // canPlatform() grants an unlisted permission only to superadmin, via
    // its "*", so "admin" and "support" are refused. Add it to that list when
    // the sales portal's permissions land properly.
    requirePlatformPermission(admin.role, "sales_attribution:manage");
  } catch {
    return bad("Only a superadmin can attribute a company to a rep.", 403);
  }

  const body = await request.json().catch(() => ({}));
  const companyId = String(body?.companyId || "").trim();
  const salesRepId = String(body?.salesRepId || "").trim();
  if (!companyId) return bad("companyId is required");
  if (!salesRepId) return bad("salesRepId is required");

  // The rows themselves are re-read fresh inside the transaction; this only
  // separates "no such company" from a rules refusal for the message above.
  const company = await db.company.findUnique({ where: { id: companyId }, select: { id: true } });
  if (!company) return bad("Not found", 404);

  const result = await captureSalesAttribution({
    companyId,
    salesRepId,
    source: "manual",
    note: `Entered by hand by platform admin ${admin.id}.`,
  });

  if (result.outcome === "attribute" || result.outcome === "already_attributed") {
    return NextResponse.json(
      { outcome: result.outcome, attribution: result.attribution },
      { status: result.outcome === "attribute" ? 201 : 200 },
    );
  }

  // A touch is a SUCCESS, not a refusal: the company stayed with the rep who
  // had it, this rep's involvement was recorded, and nothing failed. Saying
  // "409 conflict" would read as "try again", which is the one thing that
  // must not happen — see the lock note in lib/sales/attribution.js.
  if (result.outcome === "touch") {
    return NextResponse.json(
      {
        outcome: "touch",
        touch: result.touch,
        message:
          "That company is already attributed to another rep. The touch was recorded; " +
          "the attribution did not move.",
      },
      { status: 200 },
    );
  }

  return bad(REFUSALS[result.outcome] || "Couldn't attribute that company.", 409);
}
