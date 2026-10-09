// scripts/fixtures/apiMemberStub.mjs
//
// lib/apiMember's `memberOrRefusal`, scripted: a check sets `session.member`
// to the member the route should see, or null to be refused. The refusal is
// shaped like the real one — a Response with status 401 — so a route's early
// return reads exactly as it does in production.
import { NextResponse } from "next/server";

export const session = { member: null };

export async function memberOrRefusal() {
  if (!session.member) {
    return { member: null, response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  }
  return { member: session.member, response: null };
}

// The plain variant (lib/apiMember.js's memberOrRefusalPlain) for helpers that
// build their own response from { error, status } — the email-domain route's
// requireAdmin. Same scripted session, same 401 when there is none.
export async function memberOrRefusalPlain() {
  if (!session.member) return { refusal: { error: "Unauthorized", status: 401 } };
  return { member: session.member };
}
