// lib/currentMember.js
import { auth } from "./auth";
import { db } from "./db";
// The billing gate below calls these on every authenticated request. They were
// referenced but never imported — a runtime ReferenceError that `next build`
// can't see (the identifiers only execute at request time), so every logged-in
// data route 500'd in production while the build stayed green.
import { accessForCompany, denyReason } from "./billing/access";
// From impersonationToken, not impersonate — the latter pulls in Prisma for
// its audit-log writes, and this module is imported by ~135 route handlers
// that have no reason to load it.
import {
  IMPERSONATION_COOKIE,
  verifyImpersonationToken,
} from "./platform/impersonationToken";
// Seat-sharing guard. Hooked in HERE for the same reason the two gates below
// are: this is the one function every authenticated request goes through. It
// is throttled and fire-and-forget internally — see the notes in that file
// before calling it from anywhere hotter.
import { noteAccountActivity } from "./security/deviceGuard";
// Feature availability. Hooked in here for the same reason the two gates below
// are — see the header of lib/features/gate.js for why it is NOT in
// middleware.js (no Prisma on the Edge runtime) and why the page layer gets its
// own copy of the same guard rather than trusting this one.
import { assertFeatureAccess } from "./features/gate";

/**
 * Resolves a read-only support session from the impersonation cookie.
 *
 * This is the half that was missing. The platform console minted a token and
 * set the cookie, then redirected to /app — where nothing read it, so the
 * admin (who has no Better Auth session as a company user) was bounced
 * straight back to login. "Sign in as" had never worked.
 *
 * The returned member carries `impersonation: true` and role "viewer", which
 * requireWritable() below uses to reject every mutating request.
 */
async function getImpersonatedMember(request) {
  // Read the cookie off the request rather than next/headers so this stays
  // usable from route handlers, which is where every caller lives.
  const raw = request.headers.get("cookie") || "";
  const match = raw.match(
    new RegExp(`(?:^|;\\s*)${IMPERSONATION_COOKIE}=([^;]+)`),
  );
  if (!match) return null;

  const claims = await verifyImpersonationToken(
    decodeURIComponent(match[1]),
  ).catch(() => null);
  if (!claims) return null;

  const company = await db.company.findUnique({
    where: { id: claims.companyId },
    select: { id: true, authOrgId: true },
  });
  if (!company) return null;

  // ── A demo sandbox becomes the demo company's owner ─────────────────────
  //
  // The read-only stub below is deliberately incapable: id null, userId null,
  // role "viewer", which nothing in PERMISSIONS grants anything. That is
  // correct for a support session and useless for a demo — running a demo
  // means CREATING a quote, and a quote needs a createdById and a role that
  // may create one.
  //
  // So for a demo company only, this resolves the seeded owner and hands back
  // a genuine member. The session is a real login to a fixture FieldQuo owns,
  // which is exactly what a sales demo is.
  //
  // Scoped by companyId, so it can only ever find the owner OF THE DEMO
  // COMPANY the token names. And reachable only when the token says
  // demo_sandbox — a mode minted solely from Company.isDemo read out of the
  // database, never from anything a caller sends.
  if (claims.mode === "demo_sandbox") {
    const owner = await db.member.findFirst({
      where: { companyId: company.id, active: true, role: "owner" },
      select: { id: true, userId: true, role: true },
      orderBy: { createdAt: "asc" },
    });

    if (owner) {
      return {
        id: owner.id,
        userId: owner.userId,
        companyId: company.id,
        authOrgId: company.authOrgId,
        role: owner.role,
        impersonation: true,
        impersonationMode: "demo_sandbox",
        platformAdminId: claims.platformAdminId,
      };
    }
    // No owner on the demo company — fall through to the read-only stub
    // rather than inventing a session. A demo that can't write is a worse
    // demo; a session attributed to nobody is a worse bug.
  }

  return {
    // No Member row exists for a platform admin viewing a company, so there is
    // no id to hand to loadEnforceableMember. It returns a read-only stand-in
    // for this case rather than querying with undefined.
    id: null,
    // No real user is attached. Anything that writes createdById would get
    // null, which is another reason writes are blocked outright.
    userId: null,
    companyId: company.id,
    authOrgId: company.authOrgId,
    // Not a real Member role. Nothing in PERMISSIONS grants "viewer"
    // anything, so even if a write slipped past requireWritable the coarse
    // permission check would still refuse it.
    role: "viewer",
    impersonation: true,
    impersonationMode: "read_only",
    platformAdminId: claims.platformAdminId,
  };
}

/**
 * Rejects mutating requests made under an impersonation session.
 *
 * Called by getCurrentMember on every request, so it covers routes written
 * before this feature existed and routes nobody remembers to update. Hiding
 * buttons in the UI is not access control; this is.
 */
/**
 * Billing gate. Read-only for 7 days after a payment fails, then locked.
 *
 * Enforced HERE, beside the impersonation gate and for the same reason: this
 * function runs on every authenticated request, so it covers routes written
 * before this existed and routes nobody remembers to update. Retrofitting a
 * check into 142 route handlers would miss some, and the ones it missed would
 * be the write endpoints that keep working after someone stops paying.
 *
 * Method-based, which is what "read-only" actually means: GET works, POST
 * doesn't. Billing paths stay open in every state, because the only thing a
 * locked-out company needs to do is pay, and paying is a POST.
 */
async function assertBillingAccess(member, request, skip = false) {
  if (!member?.companyId) return member;
  if (skip) {
    // Still ATTACH the access state — the caller asked to skip enforcement, not
    // to be kept in the dark about it.
    return { ...member, billingAccess: await accessForCompany(member.companyId) };
  }

  // Support sessions are already read-only and shouldn't be billing-gated on
  // top — a platform admin looking at an overdue account still needs to see it.
  if (member.impersonation) return member;

  const url = (() => {
    try {
      return new URL(request.url).pathname;
    } catch {
      return "";
    }
  })();

  const access = await accessForCompany(member.companyId);
  const denial = denyReason(access, { method: request.method, pathname: url });
  if (denial) {
    const err = new Error(denial.error);
    // 402, not 403. "Forbidden" reads as a permissions problem and sends people
    // to their admin; Payment Required sends them to the billing screen, which
    // is the only place the problem can actually be fixed.
    err.status = denial.status;
    err.billing = access;
    throw err;
  }

  return { ...member, billingAccess: access };
}

function assertReadOnly(member, request) {
  if (!member?.impersonation) return member;

  // ── The demo sandbox is the one write-capable session ───────────────────
  //
  // Deliberately re-derived here rather than trusted from the middleware
  // header: this is the SECOND enforcement point, and the whole reason it
  // exists is that it must not agree with the first by copying it. The mode
  // comes off the verified token claims that produced `member.impersonation`.
  //
  // A demo company is a FieldQuo-owned sales fixture. Non-negotiable #2
  // protects a CUSTOMER's data from support access; there is no customer here,
  // and a read-only demo could not create the quote the demo exists to show.
  if (member.impersonationMode === "demo_sandbox") return member;

  const method = (request.method || "GET").toUpperCase();
  if (method === "GET" || method === "HEAD" || method === "OPTIONS") {
    return member;
  }
  const err = new Error(
    "You're viewing this account read-only. Support access can't change a customer's data — talk them through the change, or ask them to make it.",
  );
  err.status = 403;
  throw err;
}

/**
 * @param request
 * @param opts.skipBillingGate  resolve the member WITHOUT enforcing billing.
 *   For the app layout only, which has to know a company is locked in order to
 *   render the lock screen — gating it there would throw before it could show
 *   the one page that fixes the problem.
 */
export async function getCurrentMember(request, opts = {}) {
  // Checked first: a platform admin has no Better Auth session for this
  // company, so the normal path below would return null and 401 them.
  const impersonated = await getImpersonatedMember(request);
  if (impersonated) {
    // Gated too. Support must see exactly what the customer sees — "it works on
    // my screen" while the customer's is empty is the bug this prevents.
    return await assertFeatureAccess(assertReadOnly(impersonated, request), request);
  }

  const session = await auth.api.getSession({ headers: request.headers });
  if (!session?.user?.id) {
    console.error("[getCurrentMember] No authenticated user");
    return null;
  }

  const userId = session.user.id;
  const activeOrganizationId = session.session?.activeOrganizationId || null;

  if (activeOrganizationId) {
    const company = await db.company.findUnique({
      where: { authOrgId: activeOrganizationId },
      select: { id: true, authOrgId: true },
    });

    if (company) {
      const member = await db.member.findUnique({
        where: { userId_companyId: { userId, companyId: company.id } },
        select: { id: true, role: true, active: true },
      });

      if (member?.active) {
        // Fire-and-forget, and unreachable for a support session: the
        // impersonation branch above returned already. That ordering is the
        // enforcement — the platform console must not write a row into a
        // customer's tenant just by looking at it (non-negotiable #3).
        noteAccountActivity({ userId, companyId: company.id, request });

        const resolved = {
          // The Member ROW id, distinct from userId. Every granular permission
          // check does loadEnforceableMember(db, member.id) — omitting this
          // made that call `findUnique({ where: { id: undefined } })`, which
          // Prisma rejects outright. Fourteen write routes 500'd on it.
          id: member.id,
          userId,
          companyId: company.id,
          authOrgId: company.authOrgId,
          role: member.role,
        };

        // Feature gate BEFORE the billing gate, deliberately. A hidden feature
        // has to answer 404 whatever else is true of the account — a 402 on
        // /api/voice/calls would confirm the route exists, which is the one
        // thing `hidden` promises not to do. It also costs nothing on the ~150
        // ungated routes: assertFeatureAccess matches the path against the
        // registry first and only touches the database when it hits one.
        await assertFeatureAccess(resolved, request);

        return assertBillingAccess(resolved, request, opts.skipBillingGate);
      }
    }
  }

  // Fallback — covers sessions where activeOrganizationId never got set
  // (e.g. accounts created before nextCookies() was wired in).
  const fallbackMember = await db.member.findFirst({
    where: { userId, active: true },
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      companyId: true,
      role: true,
      company: { select: { authOrgId: true } },
    },
  });

  if (!fallbackMember) {
    console.error(
      `[getCurrentMember] No active Member record for user ${userId}`,
    );
    return null;
  }

  if (!fallbackMember.company.authOrgId) {
    console.error(
      `[getCurrentMember] Company ${fallbackMember.companyId} has no authOrgId`,
    );
    return null;
  }

  // Same seat-sharing sample as the primary path, for the same reason the
  // billing gate is repeated below: a session that never got an
  // activeOrganizationId is still a real person on a real device.
  noteAccountActivity({ userId, companyId: fallbackMember.companyId, request });

  const resolved = {
    id: fallbackMember.id,
    userId,
    companyId: fallbackMember.companyId,
    authOrgId: fallbackMember.company.authOrgId,
    role: fallbackMember.role,
  };

  // BOTH gates, in the same order as the primary path. Without them a session
  // that never got an activeOrganizationId — which is the whole reason this
  // fallback exists — would skip billing and feature enforcement completely.
  // That is not hypothetical: this branch used to be the one that forgot.
  await assertFeatureAccess(resolved, request);

  return assertBillingAccess(resolved, request, opts.skipBillingGate);
}
