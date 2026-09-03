// app/api/platform/sales/playbooks/experiments/[id]/route.js
//
// Start an experiment, stop it, or edit it before it has assigned anybody.
//
// ══ The variants freeze the moment the first assignment exists ═══════════
//
// Editing an arm's wording mid-test means half the calls under variant B heard
// one script and half heard another, both filed as B. There is no way to
// separate them afterwards, so the edit is refused rather than warned about —
// and the refusal names the assignment count, which is the number that makes
// the reason obvious.
//
// Weights are the deliberate exception. Changing them moves who is assigned
// NEXT and cannot move anybody already assigned, because a stored assignment is
// never recomputed (lib/sales/playbook/experiments.js's header). Stopping the
// flow into an arm without discarding what it has already collected is a real
// thing an operator needs.
//
// ══ Stopping is not deleting ═════════════════════════════════════════════
//
// `stoppedAt` ends the assignment; the rows stay. Deleting an experiment
// cascades to every assignment, which erases the record of what a rep actually
// read out — so DELETE is only offered while nothing has been assigned.
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { superadminOrRefusal } from "@/lib/sales/intel/configAdmin";
import { EXPERIMENT_PROBLEMS, validateExperiment } from "@/lib/sales/playbook/experiments";
import { STAGE_KEYS } from "@/lib/sales/playbook/stages";
import { playbookVersionBump, sayProblems, shapeExperimentInput } from "@/lib/sales/playbook/admin";
import { storeState } from "@/lib/sales/playbook/store";

const say = (codes) => sayProblems(codes, EXPERIMENT_PROBLEMS);

/** Fields an experiment with assignments may still change. See the header. */
const EDITABLE_ONCE_RUNNING = new Set(["active", "name", "hypothesis"]);

function storeRefusal() {
  const store = storeState();
  if (store.ready) return null;
  return NextResponse.json(
    {
      error:
        "An experiment cannot run: there is nowhere to store an assignment, and an assignment " +
        "that is not stored before the call is not an experiment.",
      missingModels: store.missing,
      pendingSchemaFile: store.pendingSchemaFile,
    },
    { status: 503 },
  );
}

export async function PATCH(request, { params }) {
  const { admin, refusal } = await superadminOrRefusal(request);
  if (refusal) return NextResponse.json(refusal.body, { status: refusal.status });

  const blocked = storeRefusal();
  if (blocked) return blocked;

  // Next 16: params is a Promise.
  const { id } = await params;
  const body = await request.json().catch(() => ({}));

  if ("key" in body) {
    return NextResponse.json(
      { error: "An experiment's key cannot change — its assignments cite it." },
      { status: 400 },
    );
  }

  const existing = await db.salesPlaybookExperiment.findUnique({ where: { id } });
  if (!existing) {
    return NextResponse.json({ error: "No experiment with that id." }, { status: 404 });
  }

  const shaped = shapeExperimentInput(body, { partial: true });
  if (shaped.error) return NextResponse.json({ error: shaped.error }, { status: 400 });

  const patch = { ...shaped.value };
  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ error: "Nothing to change" }, { status: 400 });
  }

  // Re-read inside the write, not trusted from the GET that rendered the form:
  // the first assignment can land between the page load and the save, and that
  // is exactly the case this guard exists for.
  let updated;
  try {
    updated = await db.$transaction(async (tx) => {
      const assigned = await tx.salesPlaybookAssignment.count({ where: { experimentId: id } });

      if (assigned > 0) {
        const structural = Object.keys(patch).filter((f) => !EDITABLE_ONCE_RUNNING.has(f));
        // Weights alone are allowed; a stage rewrite is not. Distinguished
        // rather than lumped in, because "you may still close an arm" is a real
        // operational need and "you may rewrite what B says" is not.
        const weightsOnly =
          structural.length === 1 &&
          structural[0] === "variants" &&
          weightsOnlyChange(existing.variants, patch.variants);
        if (structural.length > 0 && !weightsOnly) {
          const err = new Error(
            `${assigned} prospect${assigned === 1 ? " has" : "s have"} already been assigned to an ` +
              "arm of this experiment. Changing what a variant says now would file two different " +
              "scripts under one arm with no way to separate them. Stop this experiment and start " +
              "a new one.",
          );
          err.status = 409;
          throw err;
        }
      }

      const merged = { ...existing, ...patch };
      const { ok, problems } = validateExperiment(merged, { stageKeys: STAGE_KEYS });
      const stoppingOnly = patch.active === false && Object.keys(patch).length === 1;
      if (!ok && !stoppingOnly) {
        const err = new Error("This experiment could not be saved as written.");
        err.status = 400;
        err.problems = problems;
        throw err;
      }

      if ("active" in patch) {
        if (patch.active === true && !existing.startedAt) patch.startedAt = new Date();
        if (patch.active === false && !existing.stoppedAt) patch.stoppedAt = new Date();
        // Restarting clears the stop, so `stoppedAt` always means "not running
        // now" rather than "ran at some point".
        if (patch.active === true) patch.stoppedAt = null;
      }

      const { bump, changed, version } = playbookVersionBump(
        "salesPlaybookExperiment",
        existing,
        patch,
      );
      // The experiment has no version column of its own — the bump is recorded
      // in the audit log so an edit that changed what an arm MEANS is findable,
      // which is the part that matters.
      const row = await tx.salesPlaybookExperiment.update({ where: { id }, data: patch });
      await tx.platformAuditLog.create({
        data: {
          platformAdminId: admin.id,
          action: bump ? "sales_experiment_edited" : "sales_experiment_relabelled",
          details: {
            key: existing.key,
            fields: Object.keys(patch),
            semanticChanges: changed,
            proposedVersion: version,
            assignedAtEditTime: assigned,
            before: Object.fromEntries(Object.keys(patch).map((f) => [f, existing[f] ?? null])),
            after: Object.fromEntries(Object.keys(patch).map((f) => [f, row[f] ?? null])),
          },
        },
      });
      return row;
    });
  } catch (err) {
    return NextResponse.json(
      { error: err.message, ...(err.problems ? { problems: say(err.problems) } : {}) },
      { status: err.status || 500 },
    );
  }

  return NextResponse.json({ experiment: updated });
}

/** Did only the weights move? Keys, labels and stage bodies compared. */
function weightsOnlyChange(before, after) {
  const a = Array.isArray(before) ? before : [];
  const b = Array.isArray(after) ? after : [];
  if (a.length !== b.length) return false;
  return a.every((v, i) => {
    const w = b[i];
    return (
      v?.key === w?.key &&
      JSON.stringify(v?.stages ?? []) === JSON.stringify(w?.stages ?? [])
    );
  });
}

export async function DELETE(request, { params }) {
  const { admin, refusal } = await superadminOrRefusal(request);
  if (refusal) return NextResponse.json(refusal.body, { status: refusal.status });

  const blocked = storeRefusal();
  if (blocked) return blocked;

  const { id } = await params;
  const existing = await db.salesPlaybookExperiment.findUnique({ where: { id } });
  if (!existing) {
    return NextResponse.json({ error: "No experiment with that id." }, { status: 404 });
  }

  try {
    await db.$transaction(async (tx) => {
      const assigned = await tx.salesPlaybookAssignment.count({ where: { experimentId: id } });
      if (assigned > 0) {
        const err = new Error(
          `${assigned} assignment${assigned === 1 ? "" : "s"} would be deleted with it, and an ` +
            "assignment is the record of which script a rep actually read out. Stop the " +
            "experiment instead — it stops assigning immediately and the rows survive.",
        );
        err.status = 409;
        throw err;
      }
      await tx.salesPlaybookExperiment.delete({ where: { id } });
      await tx.platformAuditLog.create({
        data: {
          platformAdminId: admin.id,
          action: "sales_experiment_deleted",
          details: {
            key: existing.key,
            playbookKey: existing.playbookKey,
            hypothesis: existing.hypothesis,
            variants: existing.variants,
          },
        },
      });
    });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: err.status || 500 });
  }

  return NextResponse.json({ deleted: existing.key });
}
