// lib/sales/gate.js
//
// The one door into every /api/sales route, and the one place that says no.
//
// ══ Why a rep has NO write path, rather than a narrow one ═════════════════
//
// Commission-on-influence pays real money on events the rep is, by the job's
// nature, close to: which prospects get logged, when a demo happens, who a
// signup is credited to. A rep who can write their own ledger is a rep who can
// pay themselves. So the answer is not a clamped write, or a restricted one, or
// one behind a confirmation. It is none.
//
// The discipline is lib/migrations/state.js's canWrite(): the check runs on a
// row read FRESH from the database in the same request that would perform the
// action, never on something the caller remembered from an earlier one. Here
// that is doubly load-bearing, because the rep's own JWT is valid for twelve
// hours — a rep deactivated at 9am would otherwise keep reading other people's
// companies until 9pm. requireSalesRep() re-reads the SalesRep row on every
// single call for exactly that reason.
//
// ══ Why the method check is in the gate and not in each route ═════════════
//
// Same argument middleware.js's impersonation block makes for itself: "a check
// each route has to remember is a check that will be forgotten the next time
// someone adds a route." A sales route that needs to write does not exist and
// must not be addable by accident — adding a POST handler under /api/sales
// fails here, loudly, rather than working.
//
// This is enforcement number two. Number one is the /sales gate in
// middleware.js, and the two are deliberately independent — the same reason
// lib/currentMember.js's assertReadOnly duplicates the impersonation gate
// rather than trusting it: "the whole reason it exists is that it must not
// agree with the first by copying it."

import { db } from "@/lib/db";
import { getCurrentSalesRep } from "./auth";
import { canAuthenticate } from "./invite";

/**
 * Tables a sales rep's identity may never write to, at any status, ever.
 *
 * Listed by name rather than left implicit so the rule is discoverable from
 * the file rather than only from the absence of code — the same reason
 * SUPERADMIN_ONLY_PERMISSIONS is written down in lib/platform/permissions.js.
 * Asserted by scripts/check-sales-auth.mjs against the real route files.
 */
export const REP_FORBIDDEN_WRITES = [
  // Who a company is credited to. A rep writing this is a rep choosing who
  // gets paid — including themselves, over a colleague's sale.
  "salesAttribution",
  "salesAttributionTouch",
  "salesAttributionAudit",
  // The ledger itself.
  "salesCommissionEntry",
  "salesPayoutBatch",
  // FieldQuo's own billing state. Milestone 2 keys on money actually collected;
  // a rep who can mark a subscription paid has invented a payment.
  "subscription",
  "payment",
  // The rep's own row — active, code, commission plan, acceptedAt. Rotating
  // your own code or reactivating yourself is the same escalation in a
  // different shape.
  //
  // ONE column is exempt and it is written HERE, by the gate, never by a
  // route: `lastSeenAt`. See stampLastSeen() below for why that is not a
  // widening of this rule.
  "salesRep",
];

/**
 * The single column of SalesRep this file writes, and the only one.
 *
 * Named as data so scripts/check-sales-call-handling.mjs can assert the gate
 * touches this and nothing else, rather than trusting the sentence above.
 */
export const GATE_WRITES_ON_SALES_REP = ["lastSeenAt"];

/**
 * How long a stamp stays good before it is rewritten.
 *
 * The portal shell beats and every screen fetches, so an unconditional write
 * would be a row update per request for a fact the board prints to the minute.
 * A minute of granularity is all "last seen 17:02" needs.
 */
export const SEEN_REFRESH_MS = 60 * 1000;

/**
 * Record that this rep opened the portal.
 *
 * ══ Why this write is not the escalation REP_FORBIDDEN_WRITES forbids ══════
 *
 * That list exists because a rep who can write their own row can reactivate
 * themselves, rotate their code, or move themselves onto a richer commission
 * plan — every one of those is the rep DECIDING something about themselves.
 * `lastSeenAt` is the opposite shape: the value is the server's clock, it comes
 * from no part of the request, there is no input that can change what gets
 * written, and nothing pays out on it. The most a rep can do by hammering the
 * portal is be honestly recorded as present.
 *
 * ══ Why it is here and not in the five other gates ═════════════════════════
 *
 * Every authenticated screen in the portal renders through app/sales/layout.js
 * → SalesShell, which fetches /api/sales/me on mount, and that route is this
 * gate. So one place covers "a rep opened the portal" for every page, without
 * the stamp being sprinkled through the call, outreach, SMS, queue and calendar
 * gates where four copies would drift.
 *
 * A platform admin reading the floor board cannot reach this: verifySalesToken
 * refuses a token that does not carry scope "sales", so a superadmin's cookie
 * never produces a rep here, and /api/platform/* never calls this function.
 * That is the difference between an observation about the rep and a record of
 * somebody looking at them.
 *
 * ══ What it deliberately does NOT do ═══════════════════════════════════════
 *
 * It does not touch SalesRepActivity, and it must never grow to. Being signed
 * in is not a rep saying they are available; a stamp that opened an activity
 * row would put somebody who has only opened a browser tab into the routing
 * pool for the next inbound call.
 *
 * Never throws. A failed stamp is a fact we did not record, and turning that
 * into a failed read would take the portal down over a presence dot — the same
 * contract lib/platform/errorLog.js's recordError holds for the same reason.
 */
async function stampLastSeen(salesRepId, now = new Date()) {
  try {
    await db.salesRep.updateMany({
      // Conditional in the WHERE rather than read-then-write: two tabs beating
      // at once would otherwise both decide to write.
      where: {
        id: salesRepId,
        OR: [
          { lastSeenAt: null },
          { lastSeenAt: { lt: new Date(now.getTime() - SEEN_REFRESH_MS) } },
        ],
      },
      data: { lastSeenAt: now },
    });
  } catch (err) {
    console.error("[sales gate] could not stamp lastSeenAt:", err?.message);
  }
}

/** Methods that can only read. Same list middleware's impersonation gate uses. */
function isReadOnly(method) {
  return ["GET", "HEAD", "OPTIONS"].includes(
    String(method || "GET").toUpperCase(),
  );
}

/**
 * The signed-in, still-employed rep — or a refusal to return verbatim.
 *
 *   const { rep, refusal } = await requireSalesRep(request);
 *   if (refusal) return NextResponse.json(refusal.body, { status: refusal.status });
 *
 * A plain `{ body, status }` rather than a NextResponse, so this module stays
 * importable by scripts/check-sales-auth.mjs without pulling in next/server —
 * which bare node cannot resolve. The shape is lib/permissions/enforce.js's
 * permissionErrorResponse, and check:refusal-shape's rule still holds: routes
 * must build the NextResponse themselves rather than returning this object.
 *
 * Refuses, in order:
 *   401  no sales cookie, a bad signature, or a token minted for the platform
 *        console (verifySalesToken requires the sales scope).
 *   401  a token for a rep who has since been deactivated, has left, or never
 *        accepted their invitation. Read fresh, every request.
 *   403  any method that could write. See REP_FORBIDDEN_WRITES above.
 *
 * On the way out — and only on the way out — it stamps SalesRep.lastSeenAt.
 * See stampLastSeen() for why that one column is not the write this gate
 * exists to refuse.
 */
export async function requireSalesRep(request) {
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
      code: true,
      // The mailbox they SEND from, which is not the address they sign in
      // with. Selected here because every screen that offers to compose has to
      // know whether there is one yet — a rep is created before the inbox is
      // bought, so "no work mailbox" is a normal state, not an error.
      workEmail: true,
      // The demo tenant this rep shows a prospect. Selected because /sales/demo
      // has to know whether one exists before it renders anything, and because
      // repDemoWhere() scopes every write to this exact id — a route that read
      // it from the request instead would let one rep reset another's demo
      // mid-walkthrough.
      demoCompanyId: true,
      active: true,
      endedAt: true,
      acceptedAt: true,
      // Loaded only so canAuthenticate can ask its own question rather than
      // being handed a boolean somebody else decided. Stripped again three
      // lines down, before the row goes anywhere a route could spread it into
      // a response body.
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

  if (!isReadOnly(request.method)) {
    return {
      rep: null,
      refusal: {
        status: 403,
        body: {
          error:
            "The sales portal is read-only. Attribution, commission and billing are recorded by FieldQuo's own systems, never by a rep — ask a superadmin to make a correction.",
          readOnly: true,
        },
      },
    };
  }

  // After the refusals, not before. "Seen in the portal" is a claim about a
  // request we actually served — a POST that this gate turned away, or a token
  // for somebody who has left, is not evidence that a working rep is at their
  // desk.
  await stampLastSeen(rep.id);

  return { rep, refusal: null };
}
