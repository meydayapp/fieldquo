// app/api/platform/sales/playbooks/refresh-builtins/route.js
//
// Bring the built-in words up to what this build ships — and only the ones
// nobody has touched.
//
// ══ Why this is not the install button ════════════════════════════════════
//
// install-defaults CREATES and never updates, so a superadmin's rewrite cannot
// be replaced by a control labelled "install the defaults". That is right and
// it stays.
//
// It also meant that when the cold-call scripts were rebuilt from the selling
// literature, the correction reached nobody. The seeds in source were new; the
// rows in production were the old script word for word; and a deploy changed
// nothing. The owner opened a live prospect and read back the exact sentence
// the rebuild had deleted. There was no path in the product to fix it.
//
// ══ How this one is safe ══════════════════════════════════════════════════
//
// It updates a row only when the row still says, character for character, what
// SOME shipped version of that seed said — see lib/sales/playbook/seedHistory.js.
// A row like that is nobody's writing. Anything else is skipped and named in
// the response, so "left alone" is a list of keys rather than a number.
//
// It never creates. A missing built-in is install-defaults's job, and doing
// both here would make one button mean two things.
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { superadminOrRefusal } from "@/lib/sales/intel/configAdmin";
import { refreshBuiltIns, storeState } from "@/lib/sales/playbook/store";

export async function POST(request) {
  const { admin, refusal } = await superadminOrRefusal(request);
  if (refusal) return NextResponse.json(refusal.body, { status: refusal.status });

  const store = storeState();
  if (!store.ready) {
    return NextResponse.json(
      {
        error: "The playbook tables are not in the database yet, so there is nothing to refresh.",
        missingModels: store.missing,
        pendingSchemaFile: store.pendingSchemaFile,
      },
      { status: 503 },
    );
  }

  // Audited inside refreshBuiltIns's own transaction, for the reason
  // install-defaults gives: an update that succeeded with an attribution that
  // did not is rows in a customer-facing script with nobody's name on them.
  return NextResponse.json(await refreshBuiltIns({ adminId: admin.id }));
}
