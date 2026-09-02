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
  "salesRep",
];

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

  return { rep, refusal: null };
}
