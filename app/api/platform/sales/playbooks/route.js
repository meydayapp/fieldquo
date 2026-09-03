// app/api/platform/sales/playbooks/route.js
//
// The playbooks, for the superadmin screen that writes them.
//
// ══ Why this route exists ═════════════════════════════════════════════════
//
// Standing rule 1: every setting and every rule is editable from the
// superadmin UI — playbooks and objection responses are named in it
// explicitly. A seed library plus "a superadmin could edit the row" is not a
// UI, and which words open a call is the most revisable judgement in the whole
// sales system.
//
// ══ The store may not be there yet, and that is REPORTED, not hidden ══════
//
// `storeState()` probes the generated Prisma client for the five delegates
// lib/sales/playbook/schema.pending.prisma defines. While they are absent this
// route serves the built-in library read-only and every write returns 503 with
// the model names in it. The screen renders no edit control at all in that
// state — the computed banner, not a hard-coded one, which is the lesson from
// the TechnologySignature screen whose asserted "nothing reads these yet" went
// stale the day a detector shipped.
//
// ══ ONE validator ═════════════════════════════════════════════════════════
//
// `validatePlaybook` from lib/sales/playbook/defaults.js is the only thing that
// decides whether a playbook may be written, and the seed library is validated
// by the same function. A looser second opinion for the form is how a playbook
// saves cleanly and then renders a hole mid-call.
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { superadminOrRefusal } from "@/lib/sales/intel/configAdmin";
import { PLAYBOOK_PROBLEMS, PLAYBOOK_VARS, seedPlaybooks, validatePlaybook } from "@/lib/sales/playbook/defaults";
import { SELECTION_REFUSALS } from "@/lib/sales/playbook/select";
import { selectorCatalogue } from "@/lib/sales/playbook/selectors";
import { STAGES } from "@/lib/sales/playbook/stages";
import { loadPlaybooks, storeState } from "@/lib/sales/playbook/store";
import { sayProblems, shapePlaybookInput } from "@/lib/sales/playbook/admin";

/** The validator's own sentences, so no screen invents a second set. */
const say = (codes) => sayProblems(codes, PLAYBOOK_PROBLEMS);

export async function GET(request) {
  const { refusal } = await superadminOrRefusal(request);
  if (refusal) return NextResponse.json(refusal.body, { status: refusal.status });

  const store = storeState();
  const playbooks = await loadPlaybooks({ includeInactive: true });

  // How many talking points each playbook has already produced. This is what
  // makes "never delete a playbook that has been used" a fact on screen rather
  // than a policy in a comment — the delete control is not rendered when the
  // count is non-zero. Zero for every playbook while the tables are absent,
  // which is true rather than convenient.
  const counts = new Map();
  if (store.ready) {
    const produced = await db.prospectTalkingPoint.groupBy({
      by: ["playbookKey"],
      _count: { _all: true },
    });
    for (const row of produced) counts.set(row.playbookKey, row._count._all);
  }

  const installedKeys = new Set(playbooks.map((p) => p.key));

  return NextResponse.json({
    store,
    playbooks: playbooks.map((p) => {
      const { ok, problems } = validatePlaybook(p);
      const usedCount = counts.get(p.key) || 0;
      return {
        ...p,
        usedCount,
        deletable: store.ready && usedCount === 0,
        valid: ok,
        problems: say(problems),
      };
    }),
    // Every rule a playbook may be selected by, with what each one reads. The
    // editor offers choices rather than asking somebody to remember a key, and
    // `needsCompetitor` is shown because it is the one classification that
    // changes what the playbook is allowed to say.
    selectors: selectorCatalogue(),
    stages: STAGES.map((s) => ({ ...s })),
    variables: PLAYBOOK_VARS,
    selectionRefusals: SELECTION_REFUSALS,
    // Which of the built-in four are not in the database. Drives an "install"
    // control that creates exactly these and never overwrites an edit.
    availableDefaults: store.ready
      ? seedPlaybooks()
          .filter((p) => !installedKeys.has(p.key))
          .map((p) => ({ key: p.key, name: p.name, selectorKey: p.selectorKey }))
      : [],
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
          "The playbook tables are not in the database yet, so nothing can be saved. The built-in " +
          "playbooks are being served read-only.",
        missingModels: store.missing,
        pendingSchemaFile: store.pendingSchemaFile,
      },
      { status: 503 },
    );
  }

  const body = await request.json().catch(() => ({}));
  const shaped = shapePlaybookInput(body);
  if (shaped.error) return NextResponse.json({ error: shaped.error }, { status: 400 });

  const row = { ...shaped.value, active: shaped.value.active ?? false, version: "1" };

  // Validated as it would be STORED. A playbook whose {competitor} line is
  // legal only under a competitor selector has to be checked against the
  // selector it is being saved with, not against the one in the form a moment
  // ago.
  const { ok, problems } = validatePlaybook(row);
  if (!ok) {
    return NextResponse.json(
      { error: "This playbook could never be used as written, so it was not saved.", problems: say(problems) },
      { status: 400 },
    );
  }

  const existing = await db.salesPlaybook.findUnique({ where: { key: row.key } });
  if (existing) {
    return NextResponse.json(
      { error: `A playbook with the key ${row.key} already exists.` },
      { status: 409 },
    );
  }

  const created = await db.$transaction(async (tx) => {
    const playbook = await tx.salesPlaybook.create({
      data: { ...row, createdByAdminId: admin.id },
    });
    await tx.platformAuditLog.create({
      data: {
        platformAdminId: admin.id,
        action: "sales_playbook_created",
        details: { key: playbook.key, selectorKey: playbook.selectorKey, priority: playbook.priority },
      },
    });
    return playbook;
  });

  return NextResponse.json({ playbook: created }, { status: 201 });
}
