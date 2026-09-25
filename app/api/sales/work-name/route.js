// app/api/sales/work-name/route.js
//
// The rep's own work name — the name prospects see. Read and write.
//
// Behind requireOutreachRep, the named write gate the language and sells-in
// routes use; the write goes through lib/sales/workNameWrite.js, which
// scripts/check-sales-auth.mjs fences to the one column. The rep id is the
// gate's, never the body's.
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { requireOutreachRep } from "@/lib/sales/outreachGate";
import { saveRepWorkName } from "@/lib/sales/workNameWrite";
import { repPublicName, validateWorkName, workNameOf, WORK_NAME_MAX, WORK_NAME_MIN } from "@/lib/sales/repIdentity";

/**
 * `publicName` is what a prospect will actually read — the work name, or the
 * first-name fallback — so the screen can show the consequence of an empty
 * box rather than implying "no name at all".
 */
function view(rep) {
  return { workName: workNameOf(rep), publicName: repPublicName(rep), min: WORK_NAME_MIN, max: WORK_NAME_MAX };
}

export async function GET(request) {
  const { rep, refusal } = await requireOutreachRep(request);
  if (refusal) return NextResponse.json(refusal.body, { status: refusal.status });
  return NextResponse.json(view(rep));
}

export async function PUT(request) {
  const { rep, refusal } = await requireOutreachRep(request);
  if (refusal) return NextResponse.json(refusal.body, { status: refusal.status });

  let body = null;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Send a JSON body." }, { status: 400 });
  }

  const parsed = validateWorkName(body?.workName ?? null);
  if (!parsed.ok) {
    // A stable code beside the English sentence, so the screen can say it in
    // the rep's own language.
    return NextResponse.json(
      {
        error: `A work name is ${WORK_NAME_MIN}–${WORK_NAME_MAX} letters, spaces or hyphens.`,
        code: `work_name_${parsed.error}`,
      },
      { status: 400 },
    );
  }

  const row = await saveRepWorkName({ salesRepId: rep.id, workName: parsed.value });
  return NextResponse.json(view(row));
}
