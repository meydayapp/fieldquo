// app/api/platform/demo/login/route.js
//
// POST — give a demo company a real login, or reset its password.
//
// ── Why this is allowed to create a user when nothing else is ──────────────
//
// Non-negotiable #1 says joining a company is invite-only, and this codebase
// deliberately has no server-side user-creation path other than Better Auth's
// own sign-up and the invitation flow. scripts/seed-demos.mjs records that as
// the reason it creates no logins.
//
// A demo company is the one case the rule was never aimed at. It is a fixture
// FieldQuo owns outright, with no customer, no data worth protecting and a
// one-click wipe. The rule exists so a stranger cannot join somebody else's
// company; this route is a superadmin attaching an account to our own prop.
//
// The guards that make that true rather than merely stated:
//
//   * superadmin only, checked against the database, not the session claim
//   * the target company must have isDemo true, re-read here — an id from an
//     HTTP request is an id, and only the row can say what it is
//   * the email is DERIVED from the slug (demo3@fieldquo.com), never accepted
//     from the caller, so this cannot mint a login for an arbitrary address
//   * every use is written to the platform audit log
//
// ── Why a password at all ──────────────────────────────────────────────────
//
// "Run the demo" already gets an agent in without one. This exists for the
// case that doesn't: handing a prospect the keys for a few days, or an agent
// on a machine that isn't signed into the platform console.
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { auth } from "@/lib/auth";
import { getCurrentPlatformAdmin } from "@/lib/platform/currentPlatformAdmin";

/// Long enough that a demo login handed to a prospect isn't a foothold.
const MIN_PASSWORD = 12;

export async function POST(request) {
  const admin = await getCurrentPlatformAdmin(request);
  if (!admin)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // Deliberately not requirePlatformPermission: this creates a credential, and
  // the support role holds analytics and impersonation but has no business
  // minting logins.
  if (admin.role !== "superadmin") {
    return NextResponse.json(
      { error: "Only a superadmin can set a demo login." },
      { status: 403 },
    );
  }

  const { companyId, password } = await request.json().catch(() => ({}));

  if (!password || String(password).length < MIN_PASSWORD) {
    return NextResponse.json(
      { error: `Use at least ${MIN_PASSWORD} characters.` },
      { status: 400 },
    );
  }

  // Re-read, never trusted from the caller. This is the same rule
  // lib/demo/seedDemo.js applies before it deletes anything.
  const company = await db.company.findUnique({
    where: { id: companyId },
    select: { id: true, name: true, slug: true, isDemo: true, authOrgId: true },
  });
  if (!company)
    return NextResponse.json({ error: "No such company." }, { status: 404 });

  if (!company.isDemo) {
    return NextResponse.json(
      {
        error:
          `Refusing to create a login for "${company.name}" — it is not a demo ` +
          "account. This only ever operates on companies with isDemo = true.",
      },
      { status: 403 },
    );
  }

  // Derived, never supplied. A caller cannot ask for a login on an address
  // they choose — the slug decides it, and the slug belongs to a demo.
  const email = `${company.slug}@fieldquo.com`;

  try {
    const existing = await db.user.findUnique({
      where: { email },
      select: { id: true },
    });

    let userId = existing?.id || null;

    if (!userId) {
      // Better Auth owns password hashing and the account row. Calling its own
      // sign-up rather than writing the tables directly means the credential is
      // stored exactly as a normally-created one, and stays correct if the
      // hashing config ever changes.
      const created = await auth.api.signUpEmail({
        body: { email, password: String(password), name: company.name },
      });
      userId = created?.user?.id || null;
      if (!userId) throw new Error("Sign-up returned no user.");
    } else {
      // Existing account — this is a password RESET, which Better Auth exposes
      // as a context-free admin operation only through its own flows. Rather
      // than reach into the account table, tell the caller plainly.
      return NextResponse.json(
        {
          error:
            `A login already exists for ${email}. Delete that user first, or ` +
            "sign in with the existing password — this route creates, it does " +
            "not reset.",
          email,
          exists: true,
        },
        { status: 409 },
      );
    }

    // The membership that makes the login useful. Owner, because a demo is
    // walked through as the business owner and anything less would hide half
    // the product mid-call.
    await db.member.upsert({
      where: { userId_companyId: { userId, companyId: company.id } },
      update: { role: "owner", active: true },
      create: { userId, companyId: company.id, role: "owner", active: true },
    });

    await db.platformAuditLog.create({
      data: {
        platformAdminId: admin.id,
        action: "demo_login_created",
        targetCompanyId: company.id,
        details: { email, slug: company.slug },
      },
    });

    return NextResponse.json({ email, created: true });
  } catch (err) {
    console.error("[platform/demo/login]", err);
    return NextResponse.json(
      { error: err?.message || "Couldn't create that login." },
      { status: 500 },
    );
  }
}
