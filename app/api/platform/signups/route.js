// app/api/platform/signups/route.js
//
// GET — the people who started a FieldQuo signup and never finished it.
//
// ══ Why this is its own endpoint and not a filter on /api/platform/companies ═
//
// It is also a filter there (`?status=incomplete`), because somebody searching
// the company list needs to see the state on the row. This endpoint exists for
// the other job: these are the warmest leads FieldQuo has — somebody wanted the
// product enough to type their business into it — and calling them needs
// something the company list does not carry. Who to ask for. What number to
// ring. Whether a recovery email has already gone out, so a rep does not open
// with news the person already has. Whether they are on FieldQuo's own
// do-not-contact list, which is the one fact that must be on the screen BEFORE
// the phone is picked up rather than discoverable on another one.
//
// ══ Why it does not create a SalesLead ═════════════════════════════════════
//
// SalesLead is the natural shape and was the first thing tried. It cannot hold
// these, for a reason that is structural rather than stylistic:
// `SalesLead.salesRepId` is required, with no unassigned state, and none of
// these signups is attributed to a rep — they arrived self-serve. Filing them
// would mean choosing a rep, and SalesLead feeds commission
// (lib/sales/commission.js) and carries `convertedCompanyId @unique`, so an
// invented attribution is an invented commission on a sale nobody made. That
// is padding absent data with a default, on the one field where the default
// costs money.
//
// The honest fix — making salesRepId nullable and giving reps an unassigned
// queue to claim from — is a product decision about how FieldQuo's sales team
// works, not something to slip in unasked. Flagged for the owner. Until then
// this list stands on its own and nobody owns a row.
//
// ══ Read-only ══════════════════════════════════════════════════════════════
//
// No POST, no PATCH, no DELETE, and none should be added. Non-negotiable #3:
// the platform console views everything on a company's data and edits nothing.
// The one write in this whole feature is the cron's own `signupNudgeSentAt`
// stamp, which is FieldQuo's record of what FieldQuo sent.
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentPlatformAdmin } from "@/lib/platform/currentPlatformAdmin";
import { requirePlatformPermission } from "@/lib/platform/permissions";
import { checkSuppression } from "@/lib/sales/suppression";
import {
  NUDGE_DELAY_HOURS,
  NUDGE_WINDOW_DAYS,
  incompleteSignupWhere,
  nudgeRecipient,
  decideSignupNudge,
} from "@/lib/signup/abandoned";

export async function GET(request) {
  const admin = await getCurrentPlatformAdmin(request);
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    requirePlatformPermission(admin.role, "company:view");
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: err.status || 403 });
  }

  // Demos are excluded here rather than by incompleteSignupWhere(), the same
  // split lib/platform/trialCounting.js keeps: the fragment states one rule and
  // every caller spreads its own NOT_DEMO beside it.
  const rows = await db.company.findMany({
    where: { isDemo: false, ...incompleteSignupWhere() },
    select: {
      id: true,
      name: true,
      email: true,
      phone: true,
      city: true,
      province: true,
      country: true,
      industries: true,
      defaultLanguage: true,
      createdAt: true,
      trialEndsAt: true,
      signupNudgeSentAt: true,
      isDemo: true,
      subscription: { select: { id: true } },
      _count: { select: { members: true, quotes: true, clients: true } },
      // Who to ask for. The Company row carries the address the signup was made
      // with; the owner's own name is on the User behind the Member, and it is
      // the thing a rep actually opens a call with.
      members: {
        where: { role: "owner" },
        select: { user: { select: { name: true, email: true } } },
        take: 1,
      },
    },
    orderBy: { createdAt: "desc" },
  });

  const now = new Date();

  // One suppression read per distinct address, not per row — four of the live
  // rows share one inbox.
  const addresses = [...new Set(rows.map((c) => nudgeRecipient(c.email)).filter(Boolean))];
  const suppressed = new Map();
  for (const email of addresses) {
    const verdict = await checkSuppression(db, { channel: "email", email });
    suppressed.set(email, verdict);
  }

  const signups = rows.map((c) => {
    const to = nudgeRecipient(c.email);
    const verdict = to ? suppressed.get(to) : null;
    // The SAME predicate the cron uses, so the screen cannot print a different
    // answer from the one the send path will reach — the failure
    // lib/platform/trialCounting.js exists because of, where a banner and a
    // tile disagreed about the same population.
    const decision = decideSignupNudge({
      company: { ...c, memberCount: c._count.members },
      suppressed: Boolean(verdict?.suppressed),
      now,
    });

    return {
      id: c.id,
      name: c.name,
      email: c.email,
      phone: c.phone,
      ownerName: c.members[0]?.user?.name || null,
      ownerEmail: c.members[0]?.user?.email || null,
      where: [c.city, c.province, c.country].filter(Boolean).join(", "),
      industries: c.industries,
      language: c.defaultLanguage,
      createdAt: c.createdAt,
      trialEndsAt: c.trialEndsAt,
      members: c._count.members,
      quotes: c._count.quotes,
      clients: c._count.clients,
      nudgeSentAt: c.signupNudgeSentAt,
      // Both halves. "Suppressed" alone would not tell a rep WHY the phone is
      // off-limits, and the reason is what they would otherwise ring support to
      // find out.
      doNotContact: Boolean(verdict?.suppressed),
      doNotContactReason: verdict?.suppressed ? verdict.reason : null,
      nudgeState: decision.reason,
    };
  });

  return NextResponse.json({
    signups,
    // Printed on the screen so the delay is stated where somebody reads it
    // rather than only in a source comment.
    policy: { delayHours: NUDGE_DELAY_HOURS, windowDays: NUDGE_WINDOW_DAYS },
  });
}
