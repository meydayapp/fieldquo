// app/api/platform/demo/assign/route.js
//
// The click /sales/demo has always promised.
//
// ══ What was missing ══════════════════════════════════════════════════════
//
// /sales/demo told a rep with no demo: "ask a FieldQuo admin to assign you one
// on the platform demo screen — it takes them a click." There was no such
// click. `SalesRep.demoCompanyId` was read in three places and written in
// none, on either side of the product, so the only way to assign a demo was a
// hand-written UPDATE against production. A sentence promising a control that
// does not exist is the same failure as a button that does nothing; it just
// takes longer to find.
//
// ══ Two things in one press, and why ══════════════════════════════════════
//
// Assigning a demo to a rep who then cannot sign into it is half a chain. A
// demo becomes usable only when BOTH are true: some SalesRep row points at it,
// and demoN@fieldquo.com exists as an active owner of it. So POST takes an
// optional password and does both, reporting each half separately — because
// the halves have different gates and can genuinely differ in outcome.
//
// ══ Why the two halves have different gates ═══════════════════════════════
//
// Assignment is a pointer between two rows FieldQuo owns. It creates no
// credential, touches no customer, and moves no money (lib/sales/scope.js
// keeps the demo predicate separate from attribution precisely so a fixture
// cannot read as a sale). Any platform admin may do it, the same way any
// platform admin may already reset a demo or re-dress it as another trade
// through /api/platform/demo.
//
// Minting the login is user creation, and that is superadmin-only — the
// argument and the four guards are in lib/demo/demoLogin.js, which re-checks
// the role itself rather than trusting this route. So an "admin" pressing
// Assign + create login gets the assignment and an honest refusal for the
// login, not a silent half-success and not a 403 that loses the assignment
// too.
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentPlatformAdmin } from "@/lib/platform/currentPlatformAdmin";
import { assignDemoToRep, releaseDemoFromRep } from "@/lib/sales/demoAssign";
import { createDemoLogin, demoLoginReady } from "@/lib/demo/demoLogin";

async function requireAdmin(request) {
  const admin = await getCurrentPlatformAdmin(request);
  if (!admin) {
    const err = new Error("Unauthorized");
    err.status = 401;
    throw err;
  }
  return admin;
}

function fail(err) {
  const status = err?.status || 500;
  if (status === 500) console.error("[platform/demo/assign]", err);
  return NextResponse.json(
    { error: err?.message || "Something went wrong." },
    { status },
  );
}

/**
 * POST — assign a demo to a rep, and optionally mint its login in the same
 * press.
 *
 * Body: { companyId, salesRepId, password? }
 */
export async function POST(request) {
  try {
    const admin = await requireAdmin(request);
    const { companyId, salesRepId, password } = await request
      .json()
      .catch(() => ({}));

    if (!companyId || !salesRepId) {
      return NextResponse.json(
        { error: "companyId and salesRepId are required." },
        { status: 400 },
      );
    }

    const assigned = await assignDemoToRep({ repId: salesRepId, companyId });
    if (!assigned.ok) {
      return NextResponse.json({ error: assigned.error }, { status: assigned.status });
    }

    // The login half. Skipped entirely when no password was typed — a demo
    // that already has one does not need a second, and this route must not
    // invent a credential nobody asked for.
    let login = await demoLoginReady({
      companyId: assigned.company.id,
      slug: assigned.company.slug,
    });
    let loginError = null;

    if (password) {
      const minted = await createDemoLogin({
        admin,
        companyId: assigned.company.id,
        password,
      });
      if (minted.ok) {
        login = { email: minted.email, ready: true };
      } else {
        // Reported, not thrown. The assignment above already happened and is
        // correct; losing it to a 403 about the password would be the console
        // undoing work it had done.
        loginError = minted.error;
        login = await demoLoginReady({
          companyId: assigned.company.id,
          slug: assigned.company.slug,
        });
      }
    }

    return NextResponse.json({
      ok: true,
      company: assigned.company,
      rep: { id: assigned.rep.id, name: assigned.rep.name },
      alreadyAssigned: assigned.alreadyAssigned,
      loginEmail: login.email,
      loginReady: login.ready,
      loginError,
    });
  } catch (err) {
    return fail(err);
  }
}

/**
 * DELETE — take a rep's demo back so somebody else can have it.
 *
 * Clears one pointer. The company, its data, its login and its member row all
 * stay exactly where they are: releasing is how a departed rep's demo returns
 * to the pool, and wiping it on the way out would destroy a walkthrough
 * somebody may still be mid-way through. Resetting the data is a separate,
 * separately-confirmed control on the same screen.
 */
export async function DELETE(request) {
  try {
    await requireAdmin(request);
    const { salesRepId } = await request.json().catch(() => ({}));
    if (!salesRepId) {
      return NextResponse.json({ error: "salesRepId is required." }, { status: 400 });
    }

    const result = await releaseDemoFromRep({ repId: salesRepId });
    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: result.status });
    }
    return NextResponse.json({
      ok: true,
      released: result.released,
      alreadyFree: result.alreadyFree,
    });
  } catch (err) {
    return fail(err);
  }
}

/**
 * GET — the reps a demo can be assigned to.
 *
 * Only reps who can actually sign into the portal: canAuthenticate()'s own
 * conditions, expressed as a query. Listing somebody who left would offer a
 * console control that parks a demo where nobody can use it and only a release
 * gets it back.
 */
export async function GET(request) {
  try {
    await requireAdmin(request);
    const reps = await db.salesRep.findMany({
      // canAuthenticate()'s four conditions, spelled as a query. passwordHash
      // is FILTERED on and never selected — a rep who was invited and never
      // finished cannot sign in, and a demo parked on them is out of the pool
      // doing nothing.
      where: {
        active: true,
        endedAt: null,
        acceptedAt: { not: null },
        passwordHash: { not: null },
      },
      select: { id: true, name: true, email: true, demoCompanyId: true },
      orderBy: { name: "asc" },
    });
    return NextResponse.json({ reps });
  } catch (err) {
    return fail(err);
  }
}
