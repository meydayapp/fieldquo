// app/api/platform/sales/test-lines/route.js
//
// The phones FieldQuo itself owns for testing the dialler outside calling
// hours: read by every platform admin, written by a superadmin.
//
// ══ What a number here changes, and what it cannot ═══════════════════════
//
// lib/sales/testLines.js: a dial to a number on this list is exempt from the
// calling window, the 24-hour cap and the retry pool's hold for EVERY rep,
// because the phone is ours. It is never exempt from do-not-contact or the
// suppression list — those are read before the number is judged — and every
// dial to it is recorded with `jurisdictionCode = "test"` and left out of
// every count. Nothing about a rep's account changes; the exemption is on
// the number, and an owner who wants to test from his own rep login adds
// his own mobile here.
//
// ══ Superadmin writes, everyone reads ═════════════════════════════════════
//
// A number on this list can be rung at any hour. Putting a stranger's number
// here would be exactly the unlawful call the window exists to prevent, so
// the write sits behind superadminOrRefusal like the window override, is
// audit-logged with the numbers before and after, and is capped at
// MAX_TEST_LINES — more than that is not a test list.
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentPlatformAdmin } from "@/lib/platform/currentPlatformAdmin";
import { superadminOrRefusal } from "@/lib/sales/intel/configAdmin";
import { MAX_TEST_LINES, normaliseTestLines } from "@/lib/sales/testLines";
import { loadTestLines, saveTestLines } from "@/lib/sales/testLinesStore";

const bad = (error, status = 400) => NextResponse.json({ error }, { status });

async function payload() {
  return { numbers: await loadTestLines(), max: MAX_TEST_LINES, serverNow: new Date().toISOString() };
}

export async function GET(request) {
  const admin = await getCurrentPlatformAdmin(request);
  if (!admin) return bad("Unauthorized", 401);
  return NextResponse.json(await payload());
}

export async function PUT(request) {
  const { admin, refusal } = await superadminOrRefusal(request);
  if (refusal) return NextResponse.json(refusal.body, { status: refusal.status });

  const body = await request.json().catch(() => null);
  if (!body || !Array.isArray(body.numbers)) return bad("Send { numbers: ['+1…', …] }.");
  if (body.numbers.length > MAX_TEST_LINES) {
    return bad(`At most ${MAX_TEST_LINES} test lines. More than that is not a test list.`);
  }

  // Every entry must survive the normaliser: a number the list would
  // silently drop is a control that appears to work and doesn't, so the
  // request is refused with the offending entry rather than saved short.
  const rejected = body.numbers.filter((n) => typeof n !== "string" || normaliseTestLines([n]).length === 0);
  if (rejected.length) {
    return bad(`Not a number that can be dialled: ${rejected.map((n) => JSON.stringify(n)).join(", ")}. Use E.164, e.g. +14165550100.`);
  }

  const before = await loadTestLines();
  const after = await saveTestLines({ numbers: body.numbers });

  await db.platformAuditLog.create({
    data: {
      platformAdminId: admin.id,
      action: "sales_test_lines_updated",
      details: { before, after },
    },
  });

  return NextResponse.json(await payload());
}
