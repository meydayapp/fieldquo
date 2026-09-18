// app/api/platform/sales/prospects/bbb-batch/route.js
//
// The prospects a BBB browser run should visit next, in enrichment order,
// for a script running somewhere WITHOUT the database (the direct path in
// scripts/bbb-principal.mjs reads the same order through the library).
//
//   GET ?scope=claimed|next&limit=60&ids=a,b,c
//   → { rows: [{ id, businessName, city, province, country, phoneE164,
//                licenceNumber, tradeKey, searchUrl }], order }
//
// Never the pool: `scope=next` is the trades being worked in dispatch
// order, the same tier 2 every other pass walks. Rows checked inside 180
// days are left out — the script would only re-read the same profile.
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { superadminOrRefusal } from "@/lib/sales/intel/configAdmin";
import { bbbBatch } from "@/lib/sales/intel/bbbBatch";

export async function GET(request) {
  const { refusal } = await superadminOrRefusal(request);
  if (refusal) return NextResponse.json(refusal.body, { status: refusal.status });
  const url = new URL(request.url);
  const scope = url.searchParams.get("scope") || "claimed";
  const limit = Math.max(1, Math.min(500, Number(url.searchParams.get("limit")) || 60));
  const ids = (url.searchParams.get("ids") || "").split(",").map((s) => s.trim()).filter(Boolean);
  if (!["claimed", "next", "ids"].includes(scope)) return NextResponse.json({ error: "scope must be claimed, next or ids." }, { status: 400 });
  const out = await bbbBatch({ db, scope, limit, ids, now: new Date() });
  return NextResponse.json(out);
}
