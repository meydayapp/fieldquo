// lib/tenant/ownedIds.js
//
// The OTHER half of tenant isolation, and the half that was missing.
//
// ══ What this is for ═══════════════════════════════════════════════════════
//
// Every route in this codebase already scopes the record it LOADS:
// `findFirst({ where: { id, companyId: member.companyId } })`, hundreds of
// times, and an audit of all 298 API routes found no exception to it.
//
// The hole was on the other side. A route that correctly refuses to LOAD
// another tenant's row would happily WRITE a foreign key pointing at one:
//
//     POST /api/quotes  { clientId: "<another company's client>", total: 1 }
//
// created a quote inside YOUR company whose `clientId` names THEIR client —
// and the response, and every subsequent GET, includes that client. On
// POST /api/jobs the create even ran `include: { client: true }`, so a single
// request handed back the foreign client's email, phone, address, private
// notes and `portalToken` — the credential to that client's own portal.
//
// The same shape existed on assignedToId (another tenant's staff name comes
// back in `include: { assignedTo: { name } }`), on jobId (a time entry booked
// against another tenant's job pollutes THEIR job costing), and on templateId,
// workerId, workAreaId and eventType.userId.
//
// The failure is easy to miss because the route looks careful: it checks the
// permission, it scopes the thing it loads, and the id it does NOT check is
// three lines further down inside a `data:` object.
//
// ══ Why one module rather than a check per route ═══════════════════════════
//
// Because it was already a check per route, unevenly. POST /api/tasks got it
// right and its comment says "Mirrors the guard on the jobs route" — but the
// jobs route guarded `quoteId` and not `clientId`, so the mirror copied half a
// rule. lib/jobs/createJob.js carries a header explaining, correctly and at
// length, why `quoteId` must be proved to belong to the caller, immediately
// above a `clientId` that never was. That is AGENTS.md failure class #4 with a
// tenant boundary on the end of it.
//
// So: one table naming how each foreign key is proved, one function, and
// scripts/check-tenant-scope.mjs fails the build when a route writes one of
// these keys from request data without going through here (or proving it
// inline). A foreign key added to the table tomorrow is enforced everywhere
// the same day.
//
// ══ What "owned" means per key ═════════════════════════════════════════════
//
// Most are `{ id, companyId }` on their own model. Two are not:
//
//   * assignedToId / userId hold a USER id, not a row id of a company-scoped
//     model. Ownership there means "this person is on your team", proved
//     against Member — the same test /api/leads/[id] already does by hand.
//   * A JobVisit has no companyId of its own; it hangs off Job. Callers pass
//     the already-proven job, so nothing here needs to walk that relation.

/**
 * Foreign key name → how to prove the row it points at belongs to a company.
 *
 * `model` is the Prisma delegate name; `where` builds the uniqueness test.
 * Deliberately a table rather than a switch: the check script imports it and
 * asserts that every key it can find in a route's `data:` block is named here,
 * so a new foreign key cannot be enforced in one route and forgotten in five.
 */
export const OWNED_ID_FIELDS = {
  clientId: { model: "client", where: (id, companyId) => ({ id, companyId }) },
  quoteId: { model: "quote", where: (id, companyId) => ({ id, companyId }) },
  invoiceId: { model: "invoice", where: (id, companyId) => ({ id, companyId }) },
  jobId: { model: "job", where: (id, companyId) => ({ id, companyId }) },
  leadId: { model: "leadRequest", where: (id, companyId) => ({ id, companyId }) },
  appointmentId: { model: "appointment", where: (id, companyId) => ({ id, companyId }) },
  workAreaId: { model: "workArea", where: (id, companyId) => ({ id, companyId }) },
  workerId: { model: "worker", where: (id, companyId) => ({ id, companyId }) },
  templateId: { model: "documentTemplate", where: (id, companyId) => ({ id, companyId }) },
  eventTypeId: { model: "eventType", where: (id, companyId) => ({ id, companyId }) },
  campaignId: { model: "marketingCampaign", where: (id, companyId) => ({ id, companyId }) },
  funnelId: { model: "funnel", where: (id, companyId) => ({ id, companyId }) },
  productId: { model: "product", where: (id, companyId) => ({ id, companyId }) },
  taxRateId: { model: "taxRate", where: (id, companyId) => ({ id, companyId }) },
  servicePlanId: { model: "servicePlan", where: (id, companyId) => ({ id, companyId }) },
  policyId: { model: "leavePolicy", where: (id, companyId) => ({ id, companyId }) },
  payRunId: { model: "payRun", where: (id, companyId) => ({ id, companyId }) },
  // An Asset points at the Debt that bought it, and that link decides whether
  // the loan is charged to overhead at interest or in full — so a foreign one
  // would move this company's price floor using another company's loan.
  debtId: { model: "debt", where: (id, companyId) => ({ id, companyId }) },
  // AssetUseLog.assetId: a foreign asset would move ANOTHER company's
  // depreciation register onto this one's job costing — see
  // lib/costing/equipmentUsage.js.
  assetId: { model: "asset", where: (id, companyId) => ({ id, companyId }) },
  // SafetyIncident.involvedWorkerId — a foreign worker would name a stranger
  // as the injured party on this company's incident record. Separate key from
  // `workerId` above (not merged onto it) so a route that legitimately writes
  // both a `workerId` and an `involvedWorkerId` on the same request — none do
  // today, but the two mean different things — cannot have one silently prove
  // the other.
  involvedWorkerId: { model: "worker", where: (id, companyId) => ({ id, companyId }) },

  // A user id, proved by team membership rather than by owning a row. An
  // INACTIVE member still counts: deactivating someone must not orphan the
  // work already assigned to them, and `active` is a separate question the
  // assignment screens ask for themselves.
  assignedToId: {
    model: "member",
    where: (userId, companyId) => ({ userId, companyId }),
    label: "That person isn't on your team.",
  },
  userId: {
    model: "member",
    where: (userId, companyId) => ({ userId, companyId }),
    label: "That person isn't on your team.",
  },
};

/**
 * Prove every supplied id belongs to `companyId`.
 *
 * Null/undefined/empty ids pass — "not linked to anything" is a legitimate
 * value for all of these columns, and refusing it would break every create
 * that doesn't set them.
 *
 * @param db        the Prisma client (passed in so this stays testable and so
 *                  a transaction can be scoped through it)
 * @param companyId the caller's company — NEVER anything off the request
 * @param ids       { [fkName]: id } — unknown names throw, so a typo is a
 *                  build-time-visible bug rather than a silently skipped check
 * @returns {{ ok: true }} | {{ ok: false, error: string, status: number }}
 *
 * Returns rather than throws, matching lib/jobs/createJob.js: the two shapes of
 * refusal in this codebase are a thrown `err.status` (permissions) and a
 * returned `{ error, status }` (validation), and this is validation.
 */
export async function assertOwnedIds(db, companyId, ids) {
  if (!companyId) {
    // No company means no way to prove anything. Refusing is the safe
    // direction — the alternative is a check that passes when it can't run.
    return { ok: false, error: "A linked record wasn't found for your company.", status: 400 };
  }

  const checks = [];
  for (const [field, id] of Object.entries(ids || {})) {
    if (id === null || id === undefined || id === "") continue;
    const spec = OWNED_ID_FIELDS[field];
    if (!spec) {
      throw new Error(
        `assertOwnedIds: no ownership rule for "${field}". Add it to OWNED_ID_FIELDS.`,
      );
    }
    checks.push(
      db[spec.model]
        .findFirst({ where: spec.where(id, companyId), select: { id: true } })
        .then((row) => (row ? null : spec.label || "A linked record wasn't found for your company.")),
    );
  }

  const failures = (await Promise.all(checks)).filter(Boolean);
  if (failures.length) return { ok: false, error: failures[0], status: 400 };
  return { ok: true };
}

/**
 * The same test, as a NextResponse-shaped refusal.
 *
 * Convenience for the majority of call sites, which do
 *
 *   const bad = await ownedIdsRefusal(db, member.companyId, { clientId });
 *   if (bad) return bad;
 *
 * Kept separate from assertOwnedIds so lib/ helpers that return plain
 * `{ error, status }` objects (createJob) don't have to import next/server.
 */
export async function ownedIdsRefusal(NextResponse, db, companyId, ids) {
  const result = await assertOwnedIds(db, companyId, ids);
  if (result.ok) return null;
  return NextResponse.json({ error: result.error }, { status: result.status });
}
