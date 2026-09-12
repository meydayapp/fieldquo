// lib/sales/demoGate.js
//
// The door for POST /api/sales/demo — a rep acting on their own demo tenant.
//
// ══ Why this exists at all, and what was broken without it ════════════════
//
// /api/sales/demo's POST went through lib/sales/gate.js's requireSalesRep(),
// which refuses EVERY non-GET method under /api/sales and is right to. The
// result was that "Reset the data" and the trade picker on /sales/demo both
// returned 403 "The sales portal is read-only" — two controls that rendered,
// spun, and did nothing, in a codebase whose first rule is that a control must
// not appear to work and not.
//
// Nobody noticed because no rep has ever had a demo assigned to them: the
// screen those buttons live on only renders past the "you don't have one yet"
// panel once demoCompanyId is set, and until today nothing in the codebase
// wrote that column.
//
// ══ Why a named gate rather than a flag on gate.js ════════════════════════
//
// This is the seventh narrow, named exception, after outreachGate, smsGate,
// queueGate, calls/gate, calendar/gate and support. Its header argument is
// theirs: a single gate with a mode parameter would be one edit away from
// granting a write anywhere under /api/sales, and what is worth protecting is
// that each writable surface is short, explicit, and impossible to extend by
// accident.
//
// ══ What a rep may write through this door ════════════════════════════════
//
// DEMO_GATE_WRITES below, and it is the whole list. Note what is NOT on it:
// their own `active`, `code`, `commissionPlanId` or `acceptedAt` — the
// escalations REP_FORBIDDEN_WRITES names. The one SalesRep column reachable
// here is `demoCompanyId`, write-once from a rep's side (the claim's WHERE
// requires it to be null), pointable only at an isDemo company, and read by
// nothing that decides money. lib/sales/demoAssign.js's header makes that case
// in full.
//
// The identity half is NOT re-implemented: canAuthenticate() is imported from
// lib/sales/invite.js, the same function gate.js and outreachGate.js call, so
// the gates cannot disagree about who is allowed in without one of them
// failing to compile. What is duplicated is the fresh read, and that
// duplication is the point — a rep deactivated at 9am must stop being able to
// wipe a demo at 9:01, not when their twelve-hour token expires.
import { db } from "@/lib/db";
import { getCurrentSalesRep } from "./auth";
import { canAuthenticate } from "./invite";

/**
 * Everything a rep may write through /api/sales/demo, named.
 *
 * Written down for the reason gate.js writes REP_FORBIDDEN_WRITES down: the
 * rule should be discoverable from the file rather than only from the absence
 * of code. Asserted by scripts/check-demo-assignment.mjs.
 *
 * `company`, `quote`, `job`, `client` and `invoice` appear because resetDemo()
 * and applyIndustry() clear and rebuild them — inside a company that
 * lib/demo/seedDemo.js re-reads and refuses unless isDemo is true, which is
 * the guard that makes a tenant-shaped write list acceptable here and nowhere
 * else under /api/sales.
 */
export const DEMO_GATE_WRITES = [
  // The pointer, and only while it is null. See demoAssign.js.
  "salesRep.demoCompanyId",
  // The fixture's own contents, via lib/demo/seedDemo.js only.
  "company.demoIndustry",
  "demo fixture rows (quotes, jobs, clients, invoices) via seedDemo",
  // The fixture day-1 check-in draft on the demo — FieldQuo's own table, not
  // the tenant's, keyed so a re-claim or re-reset writes nothing new, and
  // refused by the send path on the company row. lib/sales/checkin/
  // materialise.js's materialiseDemoCheckIn(), and only that.
  "salesCheckIn (the demo's fixture draft) via checkin/materialise",
];

/**
 * The signed-in, still-employed rep — or a refusal to return verbatim.
 *
 *   const { rep, refusal } = await requireDemoRep(request);
 *   if (refusal) return NextResponse.json(refusal.body, { status: refusal.status });
 *
 * A plain `{ body, status }` rather than a NextResponse, matching gate.js and
 * outreachGate.js, so this module stays importable by a check script that
 * cannot resolve "next/server" — and so the route builds its own response,
 * which check:refusal-shape requires.
 */
export async function requireDemoRep(request) {
  const claims = await getCurrentSalesRep(request);
  if (!claims) {
    return {
      rep: null,
      refusal: { status: 401, body: { error: "Sign in to the sales portal." } },
    };
  }

  const row = await db.salesRep.findUnique({
    where: { id: claims.salesRepId },
    select: {
      id: true,
      email: true,
      name: true,
      // The demo this rep holds. Read here, in the request that acts, rather
      // than taken from the GET that rendered the button — a remembered null
      // is exactly what would hand somebody a second demo.
      demoCompanyId: true,
      active: true,
      endedAt: true,
      acceptedAt: true,
      // Read only so canAuthenticate can answer its own question rather than
      // being handed a boolean somebody else decided, and stripped again below
      // before the row can be spread into a response.
      passwordHash: true,
    },
  });

  if (!canAuthenticate(row)) {
    return {
      rep: null,
      refusal: {
        status: 401,
        body: { error: "This sales account is no longer active." },
      },
    };
  }

  const { passwordHash: _passwordHash, ...rep } = row;
  return { rep, refusal: null };
}
