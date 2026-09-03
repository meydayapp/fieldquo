// app/api/platform/sales/playbooks/[key]/route.js
//
// Edit one playbook, switch it on or off, and — only when nothing has been
// said out of it — remove it.
//
// ══ Why `[key]` does not swallow its sibling routes ══════════════════════
//
// `objections`, `experiments`, `install-defaults` and `preview` sit beside
// this dynamic segment. Next resolves a static segment before a dynamic one,
// and on top of that a playbook key can never collide: `CODE_RE` requires
// upper case and every sibling is lower case, so `/playbooks/objections` is
// not a key this route could ever have been asked for.
//
// ══ Deactivate, never delete, once something has been said ═══════════════
//
// `ProspectTalkingPoint.playbookKey` and `SalesPlaybookAssignment` are the
// provenance of every sentence a rep has read out of this playbook. Deleting
// it turns those rows into citations of nothing — a script that can no longer
// be traced to the words somebody approved. The count is re-read INSIDE the
// transaction rather than trusted from the GET that rendered the button, on
// the `canWrite()` discipline in lib/migrations/state.js: a playbook that was
// used for the first time between the page load and the click is exactly what
// that catches.
//
// ══ The key cannot change ════════════════════════════════════════════════
//
// Same reason as an OpportunityRule code. It is stamped on every stored
// talking point and every experiment assignment, and renaming it would make
// each of those cite a playbook that does not exist.
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { superadminOrRefusal } from "@/lib/sales/intel/configAdmin";
import { PLAYBOOK_PROBLEMS, validatePlaybook } from "@/lib/sales/playbook/defaults";
import { playbookVersionBump, sayProblems, shapePlaybookInput } from "@/lib/sales/playbook/admin";
import { storeState } from "@/lib/sales/playbook/store";

const say = (codes) => sayProblems(codes, PLAYBOOK_PROBLEMS);

function storeRefusal() {
  const store = storeState();
  if (store.ready) return null;
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

export async function PATCH(request, { params }) {
  const { admin, refusal } = await superadminOrRefusal(request);
  if (refusal) return NextResponse.json(refusal.body, { status: refusal.status });

  const blocked = storeRefusal();
  if (blocked) return blocked;

  // Next 16: params is a Promise.
  const { key } = await params;
  const body = await request.json().catch(() => ({}));

  if ("key" in body) {
    return NextResponse.json(
      {
        error:
          "A playbook's key cannot change — every talking point and every experiment assignment " +
          "cites it. Switch this one off and add a new playbook under the key you want.",
      },
      { status: 400 },
    );
  }
  if ("version" in body) {
    return NextResponse.json(
      { error: "The version is set by what you change, not by hand." },
      { status: 400 },
    );
  }

  const existing = await db.salesPlaybook.findUnique({ where: { key } });
  if (!existing) {
    return NextResponse.json({ error: `No playbook with the key ${key}.` }, { status: 404 });
  }

  const shaped = shapePlaybookInput(body, { partial: true });
  if (shaped.error) return NextResponse.json({ error: shaped.error }, { status: 400 });

  const patch = { ...shaped.value };
  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ error: "Nothing to change" }, { status: 400 });
  }

  // Validated AS IT WOULD BE STORED. A change of selector has to be checked
  // against the stages that stay — moving BOOKING_GAP onto the competitor
  // selector is fine, moving COMPETITIVE_DISPLACEMENT off it leaves a
  // {competitor} line that would be read out with a hole in it.
  const merged = { ...existing, ...patch };
  const { ok, problems } = validatePlaybook(merged);

  // Switching a playbook OFF is always allowed. A playbook you cannot disable
  // because it is already broken is the worst possible lock — the broken one
  // is precisely what somebody is trying to stop.
  const deactivatingOnly = patch.active === false && Object.keys(patch).length === 1;
  if (!ok && !deactivatingOnly) {
    return NextResponse.json(
      {
        error:
          patch.active === true
            ? "This playbook cannot be switched on: as written it could never be used."
            : "This playbook could never be used as written, so the change was not saved.",
        problems: say(problems),
      },
      { status: 400 },
    );
  }

  const { bump, changed, version } = playbookVersionBump("salesPlaybook", existing, patch);
  if (bump) patch.version = version;

  const updated = await db.$transaction(async (tx) => {
    const row = await tx.salesPlaybook.update({ where: { key }, data: patch });
    await tx.platformAuditLog.create({
      data: {
        platformAdminId: admin.id,
        action: bump ? "sales_playbook_edited" : "sales_playbook_relabelled",
        details: {
          key,
          fields: Object.keys(patch),
          semanticChanges: changed,
          versionFrom: existing.version,
          versionTo: row.version,
          before: Object.fromEntries(Object.keys(patch).map((f) => [f, existing[f] ?? null])),
          after: Object.fromEntries(Object.keys(patch).map((f) => [f, row[f] ?? null])),
        },
      },
    });
    return row;
  });

  return NextResponse.json({ playbook: updated, bumped: bump });
}

export async function DELETE(request, { params }) {
  const { admin, refusal } = await superadminOrRefusal(request);
  if (refusal) return NextResponse.json(refusal.body, { status: refusal.status });

  const blocked = storeRefusal();
  if (blocked) return blocked;

  const { key } = await params;

  const existing = await db.salesPlaybook.findUnique({ where: { key } });
  if (!existing) {
    return NextResponse.json({ error: `No playbook with the key ${key}.` }, { status: 404 });
  }

  try {
    await db.$transaction(async (tx) => {
      // Checked BEFORE the talking-point count and refused separately,
      // because the schema cascades: SalesPlaybookExperiment has
      // `onDelete: Cascade` to this row, and SalesPlaybookAssignment cascades
      // from that. So deleting a playbook with an experiment on it would
      // silently take every stored assignment with it — a destructive
      // operation behind a control labelled as a tidy-up.
      const experiments = await tx.salesPlaybookExperiment.count({ where: { playbookKey: key } });
      if (experiments > 0) {
        const err = new Error(
          `${key} has ${experiments} experiment${experiments === 1 ? "" : "s"} on it, and every ` +
            "variant assignment already made would be deleted along with it. Delete the " +
            "experiments first if that is really what you want.",
        );
        err.status = 409;
        throw err;
      }

      const used = await tx.prospectTalkingPoint.count({ where: { playbookKey: key } });
      if (used > 0) {
        const err = new Error(
          `${key} has produced ${used} talking point${used === 1 ? "" : "s"}. Deleting it would ` +
            "leave those citing a playbook that no longer exists, so it cannot be deleted — " +
            "switch it off instead. It stops opening immediately and the trail survives.",
        );
        err.status = 409;
        throw err;
      }
      await tx.salesPlaybook.delete({ where: { key } });
      await tx.platformAuditLog.create({
        data: {
          platformAdminId: admin.id,
          action: "sales_playbook_deleted",
          details: {
            key,
            name: existing.name,
            selectorKey: existing.selectorKey,
            priority: existing.priority,
            // The whole row, so a deletion can be undone by hand.
            stages: existing.stages,
          },
        },
      });
    });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: err.status || 500 });
  }

  return NextResponse.json({ deleted: key });
}
