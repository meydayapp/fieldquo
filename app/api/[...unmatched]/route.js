// app/api/[...unmatched]/route.js
//
// JSON 404 for any /api path that no route handler claims.
//
// Next's default for an unmatched path is the HTML 404 page — a full document,
// <!DOCTYPE html> and all. Every caller of an API expects JSON, and this
// codebase's own error handling assumes it: lib/fetchJson.js and
// reportResponseError read the body as JSON to find a message, so an HTML 404
// surfaces to the user as "The string did not match the expected pattern",
// which points nowhere near the actual problem. That exact confusion is
// documented in lib/appUrl.js, from a different cause with the same symptom.
//
// ── Why this cannot shadow a real route ────────────────────────────────────
//
// A catch-all segment is the LOWEST priority match in the App Router: any
// static segment (/api/quotes, /api/auth, …) and any single dynamic segment
// wins over it. There is no dynamic segment directly under app/api/, so this
// file only ever answers paths that genuinely have no handler. Verified by
// hitting a known-good route after adding it, not by reasoning alone.
import { NextResponse } from "next/server";

function unmatched() {
  return NextResponse.json({ error: "Not found" }, { status: 404 });
}

// Every method, not just GET. A POST to a mistyped endpoint is the more likely
// mistake, and it's the one whose HTML response breaks a fetch caller.
export const GET = unmatched;
export const POST = unmatched;
export const PUT = unmatched;
export const PATCH = unmatched;
export const DELETE = unmatched;
export const HEAD = unmatched;
export const OPTIONS = unmatched;
