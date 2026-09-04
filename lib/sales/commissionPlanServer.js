// lib/sales/commissionPlanServer.js
//
// The server half of the two commission-plan routes: who may write, and what a
// plan looks like on the way out.
//
// ══ Why this is a second file ═════════════════════════════════════════════
//
// lib/sales/commissionPlanAdmin.js is imported by the SCREEN, so it must stay
// free of anything that drags @/lib/db (and pg) into a client bundle. The gate
// below reads a platform-admin JWT and the payload reads Prisma rows, so both
// belong on this side of that line. Same split, same reason, as
// lib/sales/repAdmin.js sitting apart from the reps route.
//
// Shared rather than copied because what is duplicated here would be a
// PERMISSION CHECK, and AGENTS.md's fourth failure class is that the copy is
// the one that rots.
import { getCurrentPlatformAdmin } from "@/lib/platform/currentPlatformAdmin";
import { PLAN_MONEY_FIELDS, dollarsFromCents } from "@/lib/sales/commissionPlanAdmin";

/**
 * Superadmin, or a refusal to return verbatim.
 *
 * The same bar as POST /api/platform/sales/reps and for the reason stated
 * there: there is no sales permission in PLATFORM_PERMISSIONS, and these four
 * numbers are the whole of what FieldQuo owes a salesperson — the company of
 * SUPERADMIN_ONLY_PERMISSIONS' billing:manage, not of anything "admin" holds.
 *
 * The sentence is its own rather than borrowed from
 * lib/sales/intel/configAdmin's: a refusal that names the wrong subject sends
 * the reader to the wrong screen.
 */
export async function superadminOrRefusal(request) {
  const admin = await getCurrentPlatformAdmin(request);
  if (!admin) {
    return { admin: null, refusal: { status: 401, body: { error: "Unauthorized" } } };
  }
  if (admin.role !== "superadmin") {
    return {
      admin: null,
      refusal: {
        status: 403,
        body: { error: "Only superadmins can set what FieldQuo pays a sales rep" },
      },
    };
  }
  return { admin, refusal: null };
}

/**
 * The plan a rep is being put on, checked against the table rather than
 * trusted from the form.
 *
 * `undefined` is not handled here — the caller decides whether the request is
 * about the plan at all, with `"commissionPlanId" in body`, for the same reason
 * app/api/platform/sales/reps/[id] gives about workEmail: "leave it alone" and
 * "clear it" are different requests and a truthiness test collapses them.
 *
 * A DEACTIVATED plan is refused for a NEW assignment and accepted when it is
 * already the rep's own: deactivating means "stop offering this", not "take it
 * away from the people on it", and a route that silently moved somebody off
 * their plan would be the destructive-operation-labelled-as-cosmetic case.
 *
 * @param {{ db: object, planId: string|null, currentPlanId?: string|null }} args
 * @returns {Promise<{ commissionPlanId: string|null } | { error: string }>}
 */
export async function resolvePlanAssignment({ db, planId, currentPlanId = null }) {
  if (planId === null || planId === "") return { commissionPlanId: null };
  if (typeof planId !== "string") {
    return { error: "Send a commission plan id, or null to leave the rep without one." };
  }
  const plan = await db.salesCommissionPlan.findUnique({
    where: { id: planId },
    select: { id: true, name: true, active: true },
  });
  if (!plan) return { error: "That commission plan no longer exists." };
  if (!plan.active && plan.id !== currentPlanId) {
    return {
      error: `${plan.name} isn't offered any more. Reactivate it, or pick a plan that is.`,
    };
  }
  return { commissionPlanId: plan.id };
}

/**
 * The shape the screen renders a plan from.
 *
 * The dollar strings are computed HERE, through dollarsFromCents, so the edit
 * form is filled by the exact inverse of the one function that stores the
 * column. A screen dividing by 100 itself is the second opinion that ends up
 * disagreeing about a factor of a hundred.
 */
export function planPayload(plan) {
  return {
    id: plan.id,
    name: plan.name,
    active: plan.active,
    activationCents: plan.activationCents,
    firstPaymentCents: plan.firstPaymentCents,
    retentionCents: plan.retentionCents,
    retentionDays: plan.retentionDays,
    createdAt: plan.createdAt,
    totalCents: plan.activationCents + plan.firstPaymentCents + plan.retentionCents,
    dollars: Object.fromEntries(
      PLAN_MONEY_FIELDS.map((f) => [f.dollarKey, dollarsFromCents(plan[f.key])]),
    ),
    repCount: plan._count?.reps ?? 0,
  };
}
