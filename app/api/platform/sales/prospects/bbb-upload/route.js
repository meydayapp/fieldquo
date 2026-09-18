// app/api/platform/sales/prospects/bbb-upload/route.js
//
// Rows a browser read off bbb.org, matched server-side and written through
// the same never-overwrite path as every other source.
//
// ══ Why an upload exists beside the direct path ═══════════════════════════
//
// scripts/bbb-principal.mjs writes straight to the database when it runs
// on a machine with DATABASE_URL. It also writes a JSON-lines file as it
// goes, so a run on a machine WITHOUT the database (a laptop, a helper's
// home computer) can hand its file to a superadmin, who uploads it here.
// The server does not trust the file's own matching: every row is re-put
// through lib/sales/intel/listingMatch.js against the prospect it names,
// and a row whose profile does not agree with that prospect's name and
// city/phone is refused with the reason — the file is a browser's reading
// of a page, not a verdict.
//
//   POST { rows: [{ prospectId, profile: parseBbbProfile() output,
//                   candidates?: [...] }] }
//   → { matched, refused, alreadyKnown, peopleAdded, rows: [...] }
export const runtime = "nodejs";
export const maxDuration = 300;

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { superadminOrRefusal } from "@/lib/sales/intel/configAdmin";
import { applyBbbRows } from "@/lib/sales/intel/bbbApply";

export async function POST(request) {
  const { admin, refusal } = await superadminOrRefusal(request);
  if (refusal) return NextResponse.json(refusal.body, { status: refusal.status });
  const body = await request.json().catch(() => null);
  const rows = Array.isArray(body?.rows) ? body.rows : null;
  if (!rows) return NextResponse.json({ error: "Expected { rows: [...] }." }, { status: 400 });
  if (rows.length > 2000) return NextResponse.json({ error: "At most 2,000 rows per upload." }, { status: 400 });
  const report = await applyBbbRows({ db, rows, now: new Date(), by: admin?.email || admin?.id || "superadmin" });
  return NextResponse.json(report);
}
