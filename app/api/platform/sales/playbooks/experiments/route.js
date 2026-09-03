// app/api/platform/sales/playbooks/experiments/route.js
//
// A/B playbook variants — the seam, and no verdict.
//
// ══ What this route will never return ════════════════════════════════════
//
// A winner, a lift, a confidence interval or a conversion rate. §39 forbids
// declaring a winner without the sample to support it, and with a team this
// size a significance test would say "not enough data" for months while
// training everybody to look for the number that eventually appears.
// `summariseExperiment` returns counts per arm and a permanent sentence saying
// no winner is declared here, and the check asserts this file computes no rate.
//
// ══ A hypothesis is required before the test runs ════════════════════════
//
// Written down first, or whatever the numbers do afterwards will read as
// though it had been predicted. `shapeExperimentInput` refuses a create
// without one.
//
// ══ Reps are not in this route at all ════════════════════════════════════
//
// §38: assignment is stored before the call and a rep cannot choose their arm.
// This is the superadmin's route — it creates and configures experiments.
// Assignment happens in lib/sales/playbook/store.js's `readOrCreateAssignment`,
// which has no parameter that takes a variant, and any request body naming one
// is refused by `shapeAssignmentRequest` rather than ignored.
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { superadminOrRefusal } from "@/lib/sales/intel/configAdmin";
import {
  EXPERIMENT_PROBLEMS,
  WINNER_POLICY,
  summariseExperiment,
  validateExperiment,
} from "@/lib/sales/playbook/experiments";
import { STAGE_KEYS } from "@/lib/sales/playbook/stages";
import { loadPlaybooks, storeState } from "@/lib/sales/playbook/store";
import { sayProblems, shapeExperimentInput } from "@/lib/sales/playbook/admin";

const say = (codes) => sayProblems(codes, EXPERIMENT_PROBLEMS);

export async function GET(request) {
  const { refusal } = await superadminOrRefusal(request);
  if (refusal) return NextResponse.json(refusal.body, { status: refusal.status });

  const store = storeState();
  const playbooks = await loadPlaybooks({ includeInactive: true });

  if (!store.ready) {
    // Not an empty list dressed up as "no experiments yet". There is nowhere to
    // store an assignment, so §38's "stored before the call" cannot be
    // satisfied, so no experiment may run — and the screen says exactly that
    // instead of offering a create button that would 503.
    return NextResponse.json({
      store,
      experiments: [],
      playbooks: playbooks.map((p) => ({ key: p.key, name: p.name })),
      stageKeys: STAGE_KEYS,
      winnerPolicy: WINNER_POLICY,
    });
  }

  const experiments = await db.salesPlaybookExperiment.findMany({
    orderBy: [{ createdAt: "desc" }],
    include: { assignments: { select: { variantKey: true } } },
  });

  return NextResponse.json({
    store,
    experiments: experiments.map((e) => {
      const { ok, problems } = validateExperiment(e, { stageKeys: STAGE_KEYS });
      const { assignments, ...row } = e;
      return {
        ...row,
        valid: ok,
        problems: say(problems),
        // Counts only. See the header.
        summary: summariseExperiment(e, assignments),
      };
    }),
    playbooks: playbooks.map((p) => ({ key: p.key, name: p.name })),
    stageKeys: STAGE_KEYS,
    winnerPolicy: WINNER_POLICY,
  });
}

export async function POST(request) {
  const { admin, refusal } = await superadminOrRefusal(request);
  if (refusal) return NextResponse.json(refusal.body, { status: refusal.status });

  const store = storeState();
  if (!store.ready) {
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

  const body = await request.json().catch(() => ({}));
  const shaped = shapeExperimentInput(body);
  if (shaped.error) return NextResponse.json({ error: shaped.error }, { status: 400 });

  // Created switched OFF whatever the request said. An experiment that starts
  // assigning the instant it is saved would file the calls made while somebody
  // was still checking the wording, and those calls cannot be un-assigned.
  const row = { ...shaped.value, active: false, startedAt: null, stoppedAt: null };

  const { ok, problems } = validateExperiment(row, { stageKeys: STAGE_KEYS });
  if (!ok) {
    return NextResponse.json(
      { error: "This experiment could not be saved as written.", problems: say(problems) },
      { status: 400 },
    );
  }

  const playbook = await db.salesPlaybook.findUnique({ where: { key: row.playbookKey } });
  if (!playbook) {
    return NextResponse.json(
      { error: `No playbook with the key ${row.playbookKey}.` },
      { status: 400 },
    );
  }

  const existing = await db.salesPlaybookExperiment.findUnique({ where: { key: row.key } });
  if (existing) {
    return NextResponse.json(
      { error: `An experiment with the key ${row.key} already exists.` },
      { status: 409 },
    );
  }

  const created = await db.$transaction(async (tx) => {
    const experiment = await tx.salesPlaybookExperiment.create({
      data: { ...row, createdByAdminId: admin.id },
    });
    await tx.platformAuditLog.create({
      data: {
        platformAdminId: admin.id,
        action: "sales_experiment_created",
        details: {
          key: experiment.key,
          playbookKey: experiment.playbookKey,
          hypothesis: experiment.hypothesis,
          variantKeys: (experiment.variants || []).map((v) => v.key),
        },
      },
    });
    return experiment;
  });

  return NextResponse.json({ experiment: created }, { status: 201 });
}
