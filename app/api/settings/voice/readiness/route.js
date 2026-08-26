// app/api/settings/voice/readiness/route.js
//
//   GET  ask the provider about every link between a stranger dialling and a
//        lead landing, and report each one in plain words
//
// ── Why this is a route and not a column ───────────────────────────────────
//
// The owner was told the receptionist worked, repeatedly, on the strength of
// code that read correctly and columns that agreed with it. His number was
// stuck on `provisioning`, his agent was switched off, and the webhook verifier
// rejected every delivery — and no screen in the app could have shown him any
// of that, because every screen was reading the same columns.
//
// So this endpoint's rule is that it asks Retell, every time, and reports
// "we could not check" rather than inventing a pass. See lib/voice/readiness.js.
//
// Read-only. It provisions nothing and pushes nothing: a check that changes the
// thing it is measuring cannot be run twice. The repair lives on
// /api/settings/voice/number/repair, which the page calls next.
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { memberOrRefusalPlain } from "@/lib/apiMember";
import { checkReadiness } from "@/lib/voice/readiness";
import { getAppOrigin } from "@/lib/appUrl";

export async function GET(request) {
  // ── The refusal has to be turned into a Response ─────────────────────────
  //
  // memberOrRefusalPlain returns a plain `{ error, status }` object, not a
  // NextResponse — it exists for the HELPER functions that shape their own
  // reply, which is every other caller of it. Returning it straight out of a
  // route handler gives Next something it cannot serialise, so this endpoint
  // answered 500 to an unauthenticated request instead of 401, and would have
  // answered 500 to a permission refusal too.
  //
  // Caught by curling production rather than by any check: an auth failure that
  // 500s looks exactly like a broken endpoint, which on THIS endpoint is the
  // worst possible confusion — it is the screen someone opens when they already
  // suspect their phone is broken.
  const { member, refusal } = await memberOrRefusalPlain(request);
  if (refusal) {
    const { status, ...body } = refusal;
    return NextResponse.json(body, { status: status || 401 });
  }

  // Deliberately readable by an impersonating support session — non-negotiable
  // #3: the platform console views everything and edits nothing, and this is
  // the one screen that answers "why is this contractor's phone not working".
  // Nothing here writes to the company's own data.

  try {
    const result = await checkReadiness(member.companyId, getAppOrigin(request));
    return NextResponse.json(result);
  } catch (err) {
    // An honest failure, not an empty chain. A readiness check that renders
    // nothing when it breaks reads exactly like a readiness check that passed.
    console.error("[voice/readiness] failed", err);
    return NextResponse.json(
      { error: "Couldn't run the check just now.", detail: err?.message || null },
      { status: 502 },
    );
  }
}
