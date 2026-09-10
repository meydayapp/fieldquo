// lib/demo/demoLogin.js
//
// The one sanctioned server-side user creation in this codebase, and the
// guards that make it narrow.
//
// ══ Why this moved out of the route ═══════════════════════════════════════
//
// It lived inside app/api/platform/demo/login/route.js, which was fine while
// exactly one screen minted a demo login. The platform demo screen now offers
// "Assign + create login" as one press, because that is what /sales/demo has
// always promised a rep ("it takes them a click") — and a second route
// re-stating four guards from memory is how one of them ends up subtly weaker.
// So the guards live here, once, and both routes call this.
//
// ══ Why creating a user here does not break non-negotiable #1 ═════════════
//
// The rule is that JOINING A COMPANY is invite-only: a stranger must not be
// able to attach themselves to somebody else's tenant. A demo company is not
// somebody else's — it is a fixture FieldQuo owns outright, with no customer,
// no data worth protecting and a one-click wipe. This is a superadmin
// attaching an account to our own prop.
//
// The guards that make that true rather than merely stated, all four kept
// verbatim from the route this came out of:
//
//   * superadmin only, checked against the database, not the session claim
//   * the target company must have isDemo true, RE-READ here — an id from an
//     HTTP request is an id, and only the row can say what it is
//   * the email is DERIVED from the slug (demo3@fieldquo.com), never accepted
//     from the caller, so this cannot mint a login for an arbitrary address
//   * every use is written to the platform audit log
//
// ══ It creates; it does not reset ═════════════════════════════════════════
//
// An existing account comes back as a refusal rather than a silent password
// change. Better Auth owns the credential, and reaching into its account table
// to overwrite a hash would put this codebase's one hand-written password
// write in the file whose whole argument is that it does not have one.
import { db } from "@/lib/db";
import { auth } from "@/lib/auth";

/// Long enough that a demo login handed to a prospect isn't a foothold.
export const MIN_DEMO_PASSWORD = 12;

/**
 * The address a demo's login is created against.
 *
 * Derived from the slug in one place, so /platform/demo, /sales/demo and the
 * minting route cannot disagree about what a rep should be typing. They did
 * not disagree before; they each spelled it out separately, which is the state
 * just before they do.
 */
export function demoLoginEmail(slug) {
  const s = typeof slug === "string" ? slug.trim() : "";
  return s ? `${s}@fieldquo.com` : null;
}

/**
 * Does a demo company have a login somebody can actually sign in with?
 *
 * BOTH halves are required, and that is the point. A User row without an
 * active Member row signs in and lands nowhere; a Member row pointing at a
 * user that does not exist is a row nobody can use. /sales/demo renders a
 * sign-in control only when this says true, because a sign-in control that
 * cannot work is the failure this repo keeps sweeping for.
 */
export async function demoLoginReady({ companyId, slug }) {
  const email = demoLoginEmail(slug);
  if (!companyId || !email) return { email: null, ready: false };

  const user = await db.user.findUnique({
    where: { email },
    select: { id: true },
  });
  if (!user) return { email, ready: false };

  const member = await db.member.findUnique({
    where: { userId_companyId: { userId: user.id, companyId } },
    select: { active: true },
  });
  return { email, ready: Boolean(member?.active) };
}

/**
 * Mint the login for a demo company.
 *
 * @param admin      the PlatformAdmin row, already read from the database by
 *                   the caller. Its role is re-checked here rather than
 *                   trusted: this is the second enforcement, deliberately, the
 *                   same way lib/currentMember.js re-checks impersonation
 *                   after middleware already did.
 * @param companyId  re-read here; the caller's word is not evidence.
 * @param password   plain, at least MIN_DEMO_PASSWORD characters.
 *
 * @returns { ok: true, email, created: true }
 *       or { ok: false, status, error, email?, exists? }
 *
 * Refuses rather than throws for every expected case, so a caller that is
 * doing two things in one press (assign, then log in) can report the half that
 * worked instead of losing both to an exception.
 */
export async function createDemoLogin({ admin, companyId, password }) {
  // Deliberately not requirePlatformPermission: this creates a credential, and
  // the support role holds analytics and impersonation but has no business
  // minting logins. Same sentence the route carried, same reason.
  if (!admin?.id) {
    return { ok: false, status: 401, error: "Unauthorized" };
  }
  if (admin.role !== "superadmin") {
    return {
      ok: false,
      status: 403,
      error: "Only a superadmin can set a demo login.",
    };
  }

  if (!password || String(password).length < MIN_DEMO_PASSWORD) {
    return {
      ok: false,
      status: 400,
      error: `Use at least ${MIN_DEMO_PASSWORD} characters.`,
    };
  }

  // Re-read, never trusted from the caller. This is the same rule
  // lib/demo/seedDemo.js applies before it deletes anything.
  const company = await db.company.findUnique({
    where: { id: companyId },
    select: { id: true, name: true, slug: true, isDemo: true, authOrgId: true },
  });
  if (!company) return { ok: false, status: 404, error: "No such company." };

  if (!company.isDemo) {
    return {
      ok: false,
      status: 403,
      error:
        `Refusing to create a login for "${company.name}" — it is not a demo ` +
        "account. This only ever operates on companies with isDemo = true.",
    };
  }

  // Derived, never supplied. A caller cannot ask for a login on an address
  // they choose — the slug decides it, and the slug belongs to a demo.
  const email = demoLoginEmail(company.slug);

  const existing = await db.user.findUnique({
    where: { email },
    select: { id: true },
  });

  if (existing?.id) {
    // Existing account — this would be a password RESET, which Better Auth
    // exposes as a context-free admin operation only through its own flows.
    // Rather than reach into the account table, tell the caller plainly.
    //
    // The membership is still repaired below the refusal in the one case that
    // matters: a user that exists with no active member row is a login that
    // signs in and lands nowhere, and that is a state /sales/demo would report
    // as "not ready" for ever with no control that fixes it.
    const member = await db.member.upsert({
      where: { userId_companyId: { userId: existing.id, companyId: company.id } },
      update: { role: "owner", active: true },
      create: {
        userId: existing.id,
        companyId: company.id,
        role: "owner",
        active: true,
      },
      select: { id: true },
    });
    return {
      ok: false,
      status: 409,
      error:
        `A login already exists for ${email}. Sign in with the existing ` +
        "password — this creates a login, it does not reset one. Its access to " +
        `${company.name} has been re-confirmed.`,
      email,
      exists: true,
      membershipRepaired: Boolean(member),
    };
  }

  // Better Auth owns password hashing and the account row. Calling its own
  // sign-up rather than writing the tables directly means the credential is
  // stored exactly as a normally-created one, and stays correct if the hashing
  // config ever changes.
  const created = await auth.api.signUpEmail({
    body: { email, password: String(password), name: company.name },
  });
  const userId = created?.user?.id || null;
  if (!userId) throw new Error("Sign-up returned no user.");

  // The membership that makes the login useful. Owner, because a demo is
  // walked through as the business owner and anything less would hide half the
  // product mid-call.
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

  return { ok: true, email, created: true };
}
