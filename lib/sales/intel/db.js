// lib/sales/intel/db.js
//
// The only file in lib/sales/intel that touches the database.
//
// Everything else here is pure and takes already-loaded rows — the shape
// lib/marketing/jobPhotoContext.js uses, and for the reason its header gives:
// the decisions that break (unknown read as absent, a recommendation with
// nothing behind it, two rules fighting over one slot) are executed against
// hostile input in scripts/check-sales-opportunity.mjs rather than reasoned
// about. That is only possible while the deciding functions have no `db` in
// them.
//
// So this file stays deliberately thin: load rows, hand them to the pure
// functions, write what they decided.
import { db } from "@/lib/db";
import { capabilityMatrix, mergeTalkingPoints } from "./capabilities";
import { seedConfidenceRules } from "./confidence";
import { buildOpportunities } from "./opportunity";
import { seedOpportunityRules } from "./rules";

/**
 * The matrix, as the database holds it.
 *
 * Read from `FieldQuoCapability` rather than from capabilityMatrix(), because
 * a superadmin can switch a capability off or re-prioritise it and the
 * evaluator must obey what they did, not what the seed said. The seed is the
 * starting position; the table is the truth.
 */
export async function loadCapabilityMatrix({ includeInactive = false, deps = {} } = {}) {
  const prisma = deps.db || db;
  const rows = await prisma.fieldQuoCapability.findMany({
    where: includeInactive ? {} : { active: true },
    orderBy: [{ salesPriority: "desc" }, { code: "asc" }],
  });
  return rows.map(shapeCapability);
}

/**
 * A stored row, in the shape the pure evaluator expects.
 *
 * `recommendedTalkingPoints` and `requiredEvidence` are Json columns, so they
 * arrive as whatever was written. Coerced rather than trusted: a row edited to
 * a bare array, or nulled out by hand, must degrade to "no talking points"
 * instead of throwing out of a function a rep's screen depends on.
 */
function shapeCapability(row) {
  const talking =
    row.recommendedTalkingPoints && typeof row.recommendedTalkingPoints === "object" &&
    !Array.isArray(row.recommendedTalkingPoints)
      ? row.recommendedTalkingPoints
      : {};
  const required =
    row.requiredEvidence && typeof row.requiredEvidence === "object" && !Array.isArray(row.requiredEvidence)
      ? row.requiredEvidence
      : {};
  return {
    code: row.code,
    name: row.name,
    description: row.description,
    active: row.active === true,
    salesPriority: Number(row.salesPriority) || 0,
    incompatibilities: Array.isArray(row.incompatibilities) ? row.incompatibilities : [],
    requiredEvidence: {
      minEvidence: Number(required.minEvidence) || 1,
      observableAs: required.observableAs ?? null,
      requires: Array.isArray(required.requires) ? required.requires : [],
    },
    recommendedTalkingPoints: {
      points: Array.isArray(talking.points) ? talking.points : [],
      caveats: Array.isArray(talking.caveats) ? talking.caveats : [],
      planNote: talking.planNote ?? null,
      usageNote: talking.usageNote ?? null,
      // Not defaulted to false. A row whose classification is missing is
      // treated as table stakes by everything downstream, which is the safe
      // direction: it removes a displacement talking point, it never invents
      // one. `=== false` below is what makes that so.
      tableStakes: talking.tableStakes === false ? false : true,
      matrixKeys: Array.isArray(talking.matrixKeys) ? talking.matrixKeys : [],
      featureKeys: Array.isArray(talking.featureKeys) ? talking.featureKeys : [],
    },
  };
}

/**
 * Everything one prospect's opportunity analysis reads. Three queries, no N+1.
 *
 * `deps.db` is injectable for the same reason every pipeline handler's is: the
 * DETECT_OPPORTUNITIES stage calls this, and a check that cannot substitute the
 * client can only assert about this function rather than run it.
 */
export async function loadOpportunityInputs(prospectId, { deps = {} } = {}) {
  const prisma = deps.db || db;
  const [capabilities, technologies, rules, matrix] = await Promise.all([
    prisma.prospectCapability.findMany({
      where: { prospectId },
      select: { code: true, value: true, confidence: true, evidenceIds: true, detectedAt: true },
    }),
    prisma.prospectTechnology.findMany({
      where: { prospectId },
      select: {
        technologyCode: true,
        isCompetitor: true,
        confidence: true,
        evidenceIds: true,
      },
    }),
    prisma.opportunityRule.findMany({ where: { active: true } }),
    loadCapabilityMatrix({ deps }),
  ]);
  return { capabilities, technologies, rules, matrix };
}

/**
 * Recompute one prospect's opportunities and store them.
 *
 * ── Why the old rows go ────────────────────────────────────────────────────
 *
 * `ProspectOpportunity` is DERIVED. Every row is reproducible from the
 * evidence, the capability matrix and the rules, and a stale one is not a
 * record of anything — it is a rep being handed "they have no booking page"
 * about a business that built one last month. Leaving it standing is the
 * expensive direction, so a regeneration replaces the set inside one
 * transaction.
 *
 * Nothing else is touched. The evidence, capabilities, technologies and
 * inferences the recommendations were derived FROM are untouched history and
 * are never deleted here — that is the difference between clearing a cache and
 * losing provenance.
 *
 * @param {string} prospectId
 * @param {{ dryRun?: boolean, deps?: object }} options  dryRun computes and
 *        writes nothing, which is what the superadmin screen's preview uses.
 *        `deps.db` is the injected client the pipeline handler passes, so the
 *        stage can be executed by a check without Postgres.
 */
export async function regenerateOpportunities(prospectId, { dryRun = false, deps = {} } = {}) {
  const prisma = deps.db || db;
  const inputs = await loadOpportunityInputs(prospectId, { deps });
  const result = buildOpportunities(inputs);

  if (dryRun) return result;

  await prisma.$transaction(async (tx) => {
    await tx.prospectOpportunity.deleteMany({ where: { prospectId } });
    if (result.opportunities.length) {
      await tx.prospectOpportunity.createMany({
        data: result.opportunities.map((o) => ({
          prospectId,
          capabilityCode: o.capabilityCode,
          rank: o.rank,
          // The stored column is a Decimal(3,2); the envelope goes to the API,
          // not to the database. A null confidence cannot occur here — an
          // opportunity with no contributing observation is refused by the
          // evidence gate — and 0 would be a claim, so it fails loudly instead.
          confidence: requireConfidence(o),
          reason: o.reason,
          evidenceIds: o.evidenceIds,
          ruleCode: o.ruleCode,
          ruleVersion: o.ruleVersion,
        })),
      });
    }
    await tx.prospect.update({
      where: { id: prospectId },
      data: { lastOpportunityAnalysisAt: new Date() },
    });
  });

  return result;
}

/**
 * A superadmin's edit to one capability.
 *
 * `caveats`, `planNote`, `usageNote` and `tableStakes` are NOT editable and are
 * not read off the request. A caveat exists because a marketing claim is
 * partial and `check:feature-matrix` refuses a partial claim with no limits —
 * letting somebody delete it here would move the hedge out from under that
 * check without moving the claim, which is the "written and never read"
 * failure with the reader removed instead of the writer.
 */
export async function updateCapability(code, { active, salesPriority, points } = {}) {
  const existing = await db.fieldQuoCapability.findUnique({ where: { code } });
  if (!existing) return null;

  const data = {};
  if (typeof active === "boolean") data.active = active;
  if (salesPriority != null) data.salesPriority = salesPriority;

  if (Array.isArray(points)) {
    const shaped = shapeCapability(existing).recommendedTalkingPoints;
    data.recommendedTalkingPoints = { ...shaped, points };
  }

  if (Object.keys(data).length === 0) return shapeCapability(existing);

  const row = await db.fieldQuoCapability.update({ where: { code }, data });
  return shapeCapability(row);
}

function requireConfidence(opportunity) {
  const value = opportunity?.confidence?.value;
  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new Error(
      `regenerateOpportunities: ${opportunity?.capabilityCode} has no confidence. ` +
        "That means it was produced with no contributing observation, which the " +
        "evidence gate in lib/sales/intel/opportunity.js is supposed to make " +
        "impossible — fix the gate rather than defaulting a number here.",
    );
  }
  return value;
}

/**
 * Write the starter configuration: the capability matrix, the rules, the weights.
 *
 * Additive and idempotent, in the shape scripts/seed-categories.mjs uses.
 * DELETES NOTHING: a capability a superadmin switched off stays off, a weight
 * they tuned stays tuned, and a rule they wrote is never removed by a re-run.
 *
 * ── What a re-seed overwrites, and what it must not ───────────────────────
 *
 * The DERIVED half of a capability is refreshed every time: the caveats that
 * come from a `partial` marketing claim, the plan note, the metered-usage note,
 * the table-stakes classification, the matrix keys. If a marketing claim gains
 * a caveat, a rep's script has to gain it too, and an "additive" seed that left
 * the old sentence standing is exactly how a hedge stops existing.
 *
 * The AUTHORED half is not: `points` (the sentences a rep says), `active` and
 * `salesPriority` belong to whoever edits the matrix screen, and a re-seed that
 * reset them would make the screen a control that appears to work and doesn't.
 * They are written on creation and never again.
 */
export async function seedIntelConfig({ log = () => {} } = {}) {
  const matrix = capabilityMatrix();
  const counts = { capabilities: { created: 0, updated: 0 }, rules: { created: 0, updated: 0 }, signals: { created: 0, updated: 0 } };

  for (const c of matrix) {
    const before = await db.fieldQuoCapability.findUnique({ where: { code: c.code } });
    await db.fieldQuoCapability.upsert({
      where: { code: c.code },
      update: {
        name: c.name,
        description: c.description,
        requiredEvidence: c.requiredEvidence,
        incompatibilities: c.incompatibilities,
        recommendedTalkingPoints: mergeTalkingPoints(before, c),
      },
      create: { ...c },
    });
    if (before) counts.capabilities.updated++;
    else {
      counts.capabilities.created++;
      log(`  + capability ${c.code}`);
    }
  }

  // After the capabilities, never before: every rule has a foreign key into
  // them, and seeding rules first would fail on a fresh database in a way that
  // reads as a rule problem.
  for (const r of seedOpportunityRules({ matrix })) {
    const before = await db.opportunityRule.findUnique({ where: { code: r.code } });
    await db.opportunityRule.upsert({
      where: { code: r.code },
      update: {
        name: r.name,
        capabilityCode: r.capabilityCode,
        conditions: r.conditions,
        reasonTemplate: r.reasonTemplate,
      },
      create: { ...r },
    });
    if (before) counts.rules.updated++;
    else {
      counts.rules.created++;
      log(`  + rule ${r.code}`);
    }
  }

  for (const s of seedConfidenceRules()) {
    const before = await db.confidenceRule.findUnique({ where: { signal: s.signal } });
    // A tuned weight is a superadmin's decision and survives a re-seed —
    // update touches the category only, which is this file's classification
    // and not theirs. See confidence.js's header on why category is a boundary
    // rather than a dial.
    await db.confidenceRule.upsert({
      where: { signal: s.signal },
      update: { category: s.category },
      create: { ...s },
    });
    if (before) counts.signals.updated++;
    else {
      counts.signals.created++;
      log(`  + signal ${s.signal}`);
    }
  }

  return counts;
}
