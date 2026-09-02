// app/api/platform/sales/rules/[code]/route.js
//
// Edit one opportunity rule, switch it on or off, and — only when it has
// produced nothing — remove it.
//
// ══ Deactivate, never delete, once a rule has produced a result ═══════════
//
// `ProspectOpportunity.ruleCode` and `.ruleVersion` are the provenance of
// every recommendation a rep has ever read out. Deleting the rule turns each
// of those rows into a citation of nothing, so a bad recommendation stops
// being traceable to a rule and becomes traceable to "the AI" — which is
// exactly what the schema comment on that column says it exists to prevent.
//
// The count is re-read INSIDE the transaction rather than trusted from the
// GET that rendered the button. Same discipline as canWrite() in
// lib/migrations/state.js: the state at the moment of the write is the only
// state that matters, and a rule that produced its first recommendation
// between the page load and the click is the case this catches.
//
// ══ Version-on-edit ═══════════════════════════════════════════════════════
//
// Decided in lib/sales/intel/versioning.js, applied here. Editing the
// conditions, the capability, the reason or the priority bumps the version;
// renaming it or switching it off does not. The reasoning is in that file's
// header — a stored result citing v1 has to keep meaning what it meant.
//
// ══ One validator, and one deliberate exception to what blocks a write ════
//
// `validateRule` is the only opinion about whether a rule is writable, and its
// `problems` are its own vocabulary. This route makes ONE policy decision on
// top of that output, which is not a second validator: `inactive_capability`
// is a fact about a DIFFERENT row (somebody switched the capability off on the
// matrix screen), not a defect in this rule. It blocks ACTIVATION — a rule
// that is on and can never fire is the dead control — and is returned as a
// warning on any other edit, so a superadmin is not locked out of renaming a
// rule by a decision taken on another screen.
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { validateRule } from "@/lib/sales/intel/opportunity";
import { loadCapabilityMatrix } from "@/lib/sales/intel/db";
import { versionBumpFor } from "@/lib/sales/intel/versioning";
import { say, shapeRuleInput, superadminOrRefusal } from "@/lib/sales/intel/configAdmin";

/** The only problem that describes another row's state rather than this rule. */
const OTHER_ROWS_PROBLEM = "inactive_capability";

export async function PATCH(request, { params }) {
  const { admin, refusal } = await superadminOrRefusal(request);
  if (refusal) return NextResponse.json(refusal.body, { status: refusal.status });

  // Next 16: params is a Promise.
  const { code } = await params;
  const body = await request.json().catch(() => ({}));

  if ("code" in body) {
    return NextResponse.json(
      {
        error:
          "A rule's code cannot change — every recommendation it has produced cites it. " +
          "Switch this one off and add a new rule under the code you want.",
      },
      { status: 400 },
    );
  }
  if ("version" in body) {
    return NextResponse.json(
      {
        error:
          "The version is set by what you change, not by hand — see the note on the screen.",
      },
      { status: 400 },
    );
  }

  const existing = await db.opportunityRule.findUnique({ where: { code } });
  if (!existing) {
    return NextResponse.json({ error: `No rule with the code ${code}.` }, { status: 404 });
  }

  const shaped = shapeRuleInput(body, { partial: true });
  if (shaped.error) return NextResponse.json({ error: shaped.error }, { status: 400 });

  const patch = { ...shaped.value };
  let activating = false;
  if ("active" in body) {
    if (typeof body.active !== "boolean") {
      return NextResponse.json({ error: "active must be true or false" }, { status: 400 });
    }
    patch.active = body.active;
    activating = body.active === true && existing.active !== true;
  }

  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ error: "Nothing to change" }, { status: 400 });
  }

  // Validate the rule AS IT WOULD BE STORED, never the patch alone: a change
  // to the capability has to be checked against the conditions that stay, and
  // vice versa.
  const merged = { ...existing, ...patch };
  const matrix = await loadCapabilityMatrix({ includeInactive: true });
  const { problems } = validateRule(merged, { matrix });

  // Deactivating is always allowed. A rule you cannot switch off because it is
  // already broken is the worst possible lock — the broken rule is precisely
  // the one somebody is trying to stop.
  const deactivatingOnly = patch.active === false && Object.keys(patch).length === 1;
  const blocking = deactivatingOnly
    ? []
    : problems.filter((p) => p !== OTHER_ROWS_PROBLEM || activating);

  if (blocking.length) {
    return NextResponse.json(
      {
        error: activating
          ? "This rule cannot be switched on: as written it could never produce a recommendation."
          : "This rule could never produce a recommendation, so the change was not saved.",
        problems: say(blocking),
      },
      { status: 400 },
    );
  }

  const { bump, changed, version } = versionBumpFor("opportunityRule", existing, patch);
  if (bump) patch.version = version;

  const updated = await db.$transaction(async (tx) => {
    const row = await tx.opportunityRule.update({ where: { code }, data: patch });
    await tx.platformAuditLog.create({
      data: {
        platformAdminId: admin.id,
        action: bump ? "sales_rule_edited" : "sales_rule_relabelled",
        details: {
          code,
          fields: Object.keys(patch),
          semanticChanges: changed,
          versionFrom: existing.version,
          versionTo: row.version,
          // The whole before/after of what moved, so the log answers "what did
          // this rule say last month" without a second table.
          before: Object.fromEntries(Object.keys(patch).map((f) => [f, existing[f] ?? null])),
          after: Object.fromEntries(Object.keys(patch).map((f) => [f, row[f] ?? null])),
        },
      },
    });
    return row;
  });

  return NextResponse.json({
    rule: updated,
    bumped: bump,
    // Not an error, and not silence either: the superadmin is told the rule
    // they just edited is pointed at a capability somebody switched off.
    warnings: say(problems.filter((p) => !blocking.includes(p))),
  });
}

/**
 * Remove a rule that has never produced anything.
 *
 * Kept rather than dropped because the alternative is a permanent row for
 * every typo'd code — and a list nobody trusts is a list nobody edits. The
 * guard is the count, re-read inside the transaction.
 */
export async function DELETE(request, { params }) {
  const { admin, refusal } = await superadminOrRefusal(request);
  if (refusal) return NextResponse.json(refusal.body, { status: refusal.status });

  const { code } = await params;

  const existing = await db.opportunityRule.findUnique({ where: { code } });
  if (!existing) {
    return NextResponse.json({ error: `No rule with the code ${code}.` }, { status: 404 });
  }

  try {
    await db.$transaction(async (tx) => {
      const produced = await tx.prospectOpportunity.count({ where: { ruleCode: code } });
      if (produced > 0) {
        const err = new Error(
          `${code} has produced ${produced} recommendation${produced === 1 ? "" : "s"}. ` +
            "Deleting it would leave those citing a rule that no longer exists, so it cannot be " +
            "deleted — switch it off instead. It stops producing immediately and the trail survives.",
        );
        err.status = 409;
        throw err;
      }
      await tx.opportunityRule.delete({ where: { code } });
      await tx.platformAuditLog.create({
        data: {
          platformAdminId: admin.id,
          action: "sales_rule_deleted",
          details: {
            code,
            name: existing.name,
            capabilityCode: existing.capabilityCode,
            conditions: existing.conditions,
            reasonTemplate: existing.reasonTemplate,
            version: existing.version,
          },
        },
      });
    });
  } catch (err) {
    if (err?.status === 409) return NextResponse.json({ error: err.message }, { status: 409 });
    throw err;
  }

  return NextResponse.json({ deleted: code });
}
