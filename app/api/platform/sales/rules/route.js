// app/api/platform/sales/rules/route.js
//
// The opportunity rules, for the superadmin screen that writes them.
//
// ══ Why this route exists ═════════════════════════════════════════════════
//
// `OpportunityRule` shipped with a table, a seed and a validator, and no way
// to write a row except by hand. The owner's standing rule (docs/sales-intel/
// STATUS.md) names that case specifically: shipping the table and the seed and
// calling it configurable because a superadmin COULD edit the row is not a UI.
// A rule decides what a rep says to a stranger, and that judgement changes
// monthly — lib/sales/intel/rules.js's own header says as much.
//
// ══ ONE validator ═════════════════════════════════════════════════════════
//
// `validateRule` from lib/sales/intel/opportunity.js is the only thing that
// decides whether a rule may be written. Not a copy of its conditions, not a
// looser version for the form. A second validator that can disagree with the
// evaluator is how a rule saves cleanly and then never fires — and the
// disagreement would surface weeks later, on a call, as a rep with nothing to
// say.
//
// The matrix it validates against is loaded from the DATABASE, including
// inactive capabilities, for two reasons: the evaluator reads the database too
// (see loadCapabilityMatrix's header), and passing the active-only list would
// report a switched-off capability as `unknown_capability` — the wrong
// sentence, sending somebody to fix a typo that is not there.
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { CONDITION_KINDS, validateRule } from "@/lib/sales/intel/opportunity";
import { OBSERVABLE_CAPABILITY_CODES } from "@/lib/sales/intel/capabilities";
import { loadCapabilityMatrix } from "@/lib/sales/intel/db";
import { say, shapeRuleInput, superadminOrRefusal } from "@/lib/sales/intel/configAdmin";

export async function GET(request) {
  const { refusal } = await superadminOrRefusal(request);
  if (refusal) return NextResponse.json(refusal.body, { status: refusal.status });

  const [rules, matrix, produced] = await Promise.all([
    db.opportunityRule.findMany({ orderBy: [{ priority: "desc" }, { code: "asc" }] }),
    loadCapabilityMatrix({ includeInactive: true }),
    // How many recommendations each rule has already produced. This is what
    // makes "never delete a rule that has produced results" a fact on screen
    // rather than a policy in a comment: the count travels with the row, and
    // the delete control is not rendered when it is non-zero.
    db.prospectOpportunity.groupBy({ by: ["ruleCode"], _count: { _all: true } }),
  ]);

  const counts = new Map(produced.map((r) => [r.ruleCode, r._count._all]));

  return NextResponse.json({
    rules: rules.map((r) => {
      const { ok, problems } = validateRule(r, { matrix });
      const resultCount = counts.get(r.code) || 0;
      return {
        ...r,
        resultCount,
        deletable: resultCount === 0,
        valid: ok,
        problems: say(problems),
      };
    }),
    // Everything a rule may name, so the editor offers choices instead of
    // asking somebody to remember a code. A switched-off capability is
    // included and marked — hiding it would make an existing rule's target
    // vanish out of the form it is selected in.
    capabilities: matrix.map((c) => ({
      code: c.code,
      name: c.name,
      active: c.active,
      tableStakes: c.recommendedTalkingPoints.tableStakes !== false,
    })),
    conditionKinds: CONDITION_KINDS,
    // The codes a condition may name and still be able to fire. validateRule
    // refuses anything else as `unobservable_condition`; the screen shows the
    // list so the refusal is avoidable rather than surprising.
    observableCapabilityCodes: OBSERVABLE_CAPABILITY_CODES,
  });
}

/**
 * Write a new rule.
 *
 * Validated before it is stored, by the evaluator's own validator, and the
 * problems come back in the evaluator's own words. A rule that saves and can
 * never fire is what this refuses.
 */
export async function POST(request) {
  const { admin, refusal } = await superadminOrRefusal(request);
  if (refusal) return NextResponse.json(refusal.body, { status: refusal.status });

  const body = await request.json().catch(() => ({}));
  const shaped = shapeRuleInput(body);
  if (shaped.error) return NextResponse.json({ error: shaped.error }, { status: 400 });

  const row = shaped.value;

  const existing = await db.opportunityRule.findUnique({ where: { code: row.code } });
  if (existing) {
    return NextResponse.json(
      { error: `A rule with the code ${row.code} already exists.` },
      { status: 409 },
    );
  }

  const matrix = await loadCapabilityMatrix({ includeInactive: true });
  const { ok, problems } = validateRule({ ...row, active: true }, { matrix });
  if (!ok) {
    return NextResponse.json(
      {
        error: "This rule could never produce a recommendation, so it was not saved.",
        problems: say(problems),
      },
      { status: 400 },
    );
  }

  // A new rule starts at version 1, matching the seed. That string is stamped
  // onto every recommendation it produces — see lib/sales/intel/versioning.js.
  const created = await db.$transaction(async (tx) => {
    const rule = await tx.opportunityRule.create({
      data: { ...row, active: true, version: "1" },
    });
    await tx.platformAuditLog.create({
      data: {
        platformAdminId: admin.id,
        action: "sales_rule_created",
        details: {
          code: rule.code,
          name: rule.name,
          capabilityCode: rule.capabilityCode,
          priority: rule.priority,
          conditions: rule.conditions,
          reasonTemplate: rule.reasonTemplate,
          version: rule.version,
        },
      },
    });
    return rule;
  });

  return NextResponse.json({ rule: created });
}
