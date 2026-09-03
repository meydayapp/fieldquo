// app/api/platform/sales/playbooks/objections/route.js
//
// The objection library, for the superadmin screen that writes it.
//
// §22 asks for objection responses as configurable data, and standing rule 1
// names them explicitly. Nothing here is generated: an objection response is
// often about our own price and our own limits, and there is no evidence row
// for a model to cite — so these are a superadmin's words, rendered verbatim,
// and answerable for by the person who wrote them.
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { superadminOrRefusal } from "@/lib/sales/intel/configAdmin";
import {
  OBJECTION_PROBLEMS,
  seedObjections,
  validateObjection,
} from "@/lib/sales/playbook/objections";
import { selectorCatalogue } from "@/lib/sales/playbook/selectors";
import { loadObjections, storeState } from "@/lib/sales/playbook/store";
import { sayProblems, shapeObjectionInput } from "@/lib/sales/playbook/admin";

const say = (codes) => sayProblems(codes, OBJECTION_PROBLEMS);

export async function GET(request) {
  const { refusal } = await superadminOrRefusal(request);
  if (refusal) return NextResponse.json(refusal.body, { status: refusal.status });

  const store = storeState();
  const objections = await loadObjections({ includeInactive: true });
  const installed = new Set(objections.map((o) => o.code));

  return NextResponse.json({
    store,
    objections: objections.map((o) => {
      const { ok, problems } = validateObjection(o);
      return { ...o, valid: ok, problems: say(problems) };
    }),
    // The same closed vocabulary the playbooks select on. An objection may name
    // one to pick up THIS prospect's observations; naming anything else is
    // refused, because a context rule nothing implements would attach nothing
    // and look like it had.
    selectors: selectorCatalogue(),
    availableDefaults: store.ready
      ? seedObjections()
          .filter((o) => !installed.has(o.code))
          .map((o) => ({ code: o.code, label: o.label }))
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
          "objection library is being served read-only.",
        missingModels: store.missing,
        pendingSchemaFile: store.pendingSchemaFile,
      },
      { status: 503 },
    );
  }

  const body = await request.json().catch(() => ({}));
  const shaped = shapeObjectionInput(body);
  if (shaped.error) return NextResponse.json({ error: shaped.error }, { status: 400 });

  const row = { ...shaped.value, active: shaped.value.active ?? true, version: "1" };
  const { ok, problems } = validateObjection(row);
  if (!ok) {
    return NextResponse.json(
      { error: "This objection could not be saved as written.", problems: say(problems) },
      { status: 400 },
    );
  }

  const existing = await db.salesObjection.findUnique({ where: { code: row.code } });
  if (existing) {
    return NextResponse.json(
      { error: `An objection with the code ${row.code} already exists.` },
      { status: 409 },
    );
  }

  const created = await db.$transaction(async (tx) => {
    const objection = await tx.salesObjection.create({
      data: { ...row, createdByAdminId: admin.id },
    });
    await tx.platformAuditLog.create({
      data: {
        platformAdminId: admin.id,
        action: "sales_objection_created",
        details: { code: objection.code, contextSelectorKey: objection.contextSelectorKey },
      },
    });
    return objection;
  });

  return NextResponse.json({ objection: created }, { status: 201 });
}
