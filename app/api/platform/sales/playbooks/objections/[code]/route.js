// app/api/platform/sales/playbooks/objections/[code]/route.js
//
// Edit one objection response, switch it off, or remove it.
//
// ══ Deleting IS allowed here, unlike a playbook ══════════════════════════
//
// Nothing stamps an objection code onto a stored row: an objection is read off
// the screen mid-call and never recorded as having been used. So there is no
// provenance to break, and the argument that keeps a used playbook undeletable
// simply does not apply. The audit log carries the whole row, so a deletion is
// recoverable by hand.
//
// That asymmetry is worth stating rather than leaving as an inconsistency
// somebody later "fixes" in the wrong direction.
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { superadminOrRefusal } from "@/lib/sales/intel/configAdmin";
import { OBJECTION_PROBLEMS, validateObjection } from "@/lib/sales/playbook/objections";
import { playbookVersionBump, sayProblems, shapeObjectionInput } from "@/lib/sales/playbook/admin";
import { storeState } from "@/lib/sales/playbook/store";

const say = (codes) => sayProblems(codes, OBJECTION_PROBLEMS);

function storeRefusal() {
  const store = storeState();
  if (store.ready) return null;
  return NextResponse.json(
    {
      error:
        "The playbook tables are not in the database yet, so nothing can be saved. The built-in " +
        "objection library is being served read-only.",
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
  const { code } = await params;
  const body = await request.json().catch(() => ({}));

  if ("code" in body) {
    return NextResponse.json(
      { error: "An objection's code cannot change. Switch this one off and add a new one." },
      { status: 400 },
    );
  }
  if ("version" in body) {
    return NextResponse.json(
      { error: "The version is set by what you change, not by hand." },
      { status: 400 },
    );
  }

  const existing = await db.salesObjection.findUnique({ where: { code } });
  if (!existing) {
    return NextResponse.json({ error: `No objection with the code ${code}.` }, { status: 404 });
  }

  const shaped = shapeObjectionInput(body, { partial: true });
  if (shaped.error) return NextResponse.json({ error: shaped.error }, { status: 400 });

  const patch = { ...shaped.value };
  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ error: "Nothing to change" }, { status: 400 });
  }

  const merged = { ...existing, ...patch };
  const { ok, problems } = validateObjection(merged);
  const deactivatingOnly = patch.active === false && Object.keys(patch).length === 1;
  if (!ok && !deactivatingOnly) {
    return NextResponse.json(
      { error: "This objection could not be saved as written.", problems: say(problems) },
      { status: 400 },
    );
  }

  const { bump, changed, version } = playbookVersionBump("salesObjection", existing, patch);
  if (bump) patch.version = version;

  const updated = await db.$transaction(async (tx) => {
    const row = await tx.salesObjection.update({ where: { code }, data: patch });
    await tx.platformAuditLog.create({
      data: {
        platformAdminId: admin.id,
        action: bump ? "sales_objection_edited" : "sales_objection_relabelled",
        details: {
          code,
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

  return NextResponse.json({ objection: updated, bumped: bump });
}

export async function DELETE(request, { params }) {
  const { admin, refusal } = await superadminOrRefusal(request);
  if (refusal) return NextResponse.json(refusal.body, { status: refusal.status });

  const blocked = storeRefusal();
  if (blocked) return blocked;

  const { code } = await params;

  const existing = await db.salesObjection.findUnique({ where: { code } });
  if (!existing) {
    return NextResponse.json({ error: `No objection with the code ${code}.` }, { status: 404 });
  }

  await db.$transaction(async (tx) => {
    await tx.salesObjection.delete({ where: { code } });
    await tx.platformAuditLog.create({
      data: {
        platformAdminId: admin.id,
        action: "sales_objection_deleted",
        // The whole row. See the header — this is the only recovery there is.
        details: {
          code,
          label: existing.label,
          cues: existing.cues,
          response: existing.response,
          contextSelectorKey: existing.contextSelectorKey,
          priority: existing.priority,
        },
      },
    });
  });

  return NextResponse.json({ deleted: code });
}
