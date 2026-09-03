// app/api/platform/sales/playbooks/install-defaults/route.js
//
// Write the built-in playbooks and objections into the database, once.
//
// ══ Why this is a button and not a seed script ═══════════════════════════
//
// Standing rule 1 is explicit that a seed script is not a UI. It is also the
// wrong shape operationally: a seed runs at deploy time, when nobody is
// looking, and either overwrites a superadmin's edits or is quietly skipped.
//
// ══ It CREATES and never updates ═════════════════════════════════════════
//
// `installDefaults` compares keys and inserts only what is missing. A
// superadmin who has rewritten COMPETITIVE_DISPLACEMENT must not have their
// words replaced by a control labelled "install the defaults" — that is a
// destructive operation labelled as cosmetic, which is failure class 7.
//
// The response says how many were skipped and why, so "nothing happened" is
// never the whole answer a superadmin gets back.
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { superadminOrRefusal } from "@/lib/sales/intel/configAdmin";
import { installDefaults, storeState } from "@/lib/sales/playbook/store";

export async function POST(request) {
  const { admin, refusal } = await superadminOrRefusal(request);
  if (refusal) return NextResponse.json(refusal.body, { status: refusal.status });

  const store = storeState();
  if (!store.ready) {
    return NextResponse.json(
      {
        error:
          "The playbook tables are not in the database yet, so there is nowhere to install them.",
        missingModels: store.missing,
        pendingSchemaFile: store.pendingSchemaFile,
      },
      { status: 503 },
    );
  }

  // The audit row is written by installDefaults inside the SAME transaction as
  // the inserts. Writing it here afterwards would leave the case where the
  // install succeeded and the attribution did not — rows in a customer-facing
  // script with nobody's name on them.
  const result = await installDefaults({ adminId: admin.id });

  return NextResponse.json(result);
}
