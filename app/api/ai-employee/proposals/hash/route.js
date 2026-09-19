// app/api/ai-employee/proposals/hash/route.js
//
// The hash of an edited proposal's arguments, computed by the server with
// the one canonicalisation lib/aiEmployee/permission.js's argsHash uses.
//
// Exists because the approve route binds an approval to the hash of what
// the person READ, and after an edit what they read is the edited text. A
// browser-side hash would be a second implementation of the canonical form
// — the copy that drifts — so the screen asks the server for it and sends
// both back. The approve route recomputes from the arguments it receives
// and refuses a mismatch; this endpoint cannot be used to make anything run.
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { memberOrRefusal } from "@/lib/apiMember";
import { argsHash } from "@/lib/aiEmployee/permission";

export async function POST(request) {
  const { response } = await memberOrRefusal(request);
  if (response) return response;
  const body = await request.json().catch(() => ({}));
  const args = body?.args && typeof body.args === "object" && !Array.isArray(body.args) ? body.args : null;
  if (!args) return NextResponse.json({ error: "Send the arguments as an object." }, { status: 400 });
  return NextResponse.json({ argsHash: argsHash(args) });
}
