// app/api/jobs/[id]/work-order/route.js
//
// The crew work order for one job. GET returns the model — per area, the
// scope, the hours, the crew note, the tick and the photos; never a price —
// and PATCH lets the office decide which of the quote's items the crew's
// copy leaves out.
//
// Read at jobs:view_only, scoped to assigned jobs, because the crew are the
// readers. Write at jobs:view_create_edit, because hiding a line is editing
// what the crew are told. Next 16: params is a Promise.
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { memberOrRefusal } from "@/lib/apiMember";
import { levelOrRefusal } from "@/lib/permissions/apiGate";
import { loadWorkOrder } from "@/lib/workOrder/load";
import { findWorkOrderMoneyKey } from "@/lib/workOrder/build";

const KEY = /^g:[A-Za-z0-9_-]{1,64}(:[al]:\d{1,4})?$/;

export async function GET(request, { params }) {
  const { id } = await params;
  const { member, response } = await memberOrRefusal(request);
  if (response) return response;
  const { full, response: denied } = await levelOrRefusal(member, "jobs", "view_only", "see jobs");
  if (denied) return denied;

  const loaded = await loadWorkOrder(id, full);
  if (!loaded) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // Belt and braces on the one rule: a model that grew a money key is
  // refused at the door rather than served to a phone in a driveway.
  const leak = findWorkOrderMoneyKey(loaded.model);
  if (leak) {
    console.error(`[work-order] money key in model: ${leak}`);
    return NextResponse.json({ error: "The work order couldn't be prepared." }, { status: 500 });
  }
  return NextResponse.json({ workOrder: loaded.model });
}

export async function PATCH(request, { params }) {
  const { id } = await params;
  const { member, response } = await memberOrRefusal(request);
  if (response) return response;
  const { full, response: denied } = await levelOrRefusal(
    member,
    "jobs",
    "view_create_edit",
    "change what the crew's work order shows",
  );
  if (denied) return denied;

  const loaded = await loadWorkOrder(id, full);
  if (!loaded) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const body = await request.json().catch(() => ({}));
  const key = String(body.key || "");
  if (!KEY.test(key)) return NextResponse.json({ error: "Which item?" }, { status: 400 });
  // Only a key the model actually has. A key for an area that does not exist
  // would be stored and read by nothing — the first failure class.
  const known = new Set();
  for (const a of loaded.model.areas) {
    known.add(a.key);
    for (const l of a.lines || []) if (l.key) known.add(l.key);
  }
  if (!known.has(key)) return NextResponse.json({ error: "That item isn't on this work order." }, { status: 400 });

  const current = new Set(loaded.job.workOrderHidden || []);
  if (body.hidden === true) current.add(key);
  else if (body.hidden === false) current.delete(key);
  else return NextResponse.json({ error: "Say whether to hide it or show it." }, { status: 400 });

  await db.job.update({ where: { id }, data: { workOrderHidden: [...current] } });
  const again = await loadWorkOrder(id, full);
  return NextResponse.json({ workOrder: again.model });
}
