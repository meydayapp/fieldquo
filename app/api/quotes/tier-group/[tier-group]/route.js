// app/api/quotes/tier-group/[tier-group]/route.js
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentMember } from "@/lib/currentMember";
import {
  loadEnforceableMember,
  redactQuotes,
} from "@/lib/permissions/enforce";

export async function GET(request, { params }) {
  // Next 16: `params` is a Promise; reading it synchronously gives undefined.
  const _params = await params;
  const member = await getCurrentMember(request);
  if (!member)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // ── The filter never applied ────────────────────────────────────────────
  //
  // The segment directory is [tier-group], so the resolved params carry a
  // "tier-group" key. This read `_params.tierGroupId`, which is always
  // undefined — and Prisma treats an undefined value as "condition omitted",
  // not "match null". So this endpoint returned EVERY quote in the company
  // rather than the two or three in one tier group, with each row's client
  // and share token attached.
  //
  // Silent because it fails in the direction of more data: nothing errors, the
  // response is well-formed, and only the count is wrong. The file's own
  // header comment says [tier-group] and is stale in the same way.
  //
  // Refusing a missing id rather than defaulting: without it, a caller that
  // gets the key wrong is handed the whole table again.
  const tierGroupId = _params["tier-group"];
  if (!tierGroupId) {
    return NextResponse.json(
      { error: "A tier group id is required." },
      { status: 400 },
    );
  }

  const quotes = await db.quote.findMany({
    where: { tierGroupId, companyId: member.companyId },
    include: { scopeGroups: true, client: true },
    orderBy: { tierLabel: "asc" }, // best, better, good — alphabetical happens to work here; fine either way
  });

  // Same redaction as GET /api/quotes — this is that list filtered to one tier
  // group, so it has no business being more generous. `client: true` is the
  // whole row here (email, phone, notes, portalToken) and each quote carries
  // its own shareToken; three tiers means three public links, not one.
  const full = await loadEnforceableMember(db, member.id);
  return NextResponse.json(redactQuotes(full, quotes));
}
