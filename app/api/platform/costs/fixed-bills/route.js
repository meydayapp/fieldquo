// app/api/platform/costs/fixed-bills/route.js
//
// The bills no API reports, typed in from the invoice — PlatformFixedBill.
//
// ══ Superadmin-only, like the rest of /platform/costs ════════════════════
//
// This is FieldQuo's own money and the owner's number, on the precedent
// app/api/platform/costs/route.js states. `admin.role !== "superadmin"` is
// tested directly. A support admin gets a 403 that says so.
//
// GET   ?from=YYYY-MM&to=YYYY-MM  → the rows, each with its statement
// POST  { provider, periodMonth: "YYYY-MM", amount: "113.18" | amountCents, currency?, invoiceRef?, note? }
// PATCH { id, …same fields…, voided?: true|false }  — edits in place; a
//       wrong row is voided, never deleted, and keeps who entered it.
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { getCurrentPlatformAdmin } from "@/lib/platform/currentPlatformAdmin";
import { createFixedBill, listFixedBills, monthDate, parseFixedBillInput, updateFixedBill, FIXED_BILL_PROVIDERS } from "@/lib/platform/costs/fixedBills";

async function gate(request) {
  const admin = await getCurrentPlatformAdmin(request);
  if (!admin) return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  if (admin.role !== "superadmin") {
    return { error: NextResponse.json({ error: "Only superadmins can enter what FieldQuo pays" }, { status: 403 }) };
  }
  return { admin };
}

export async function GET(request) {
  const { error } = await gate(request);
  if (error) return error;
  const url = new URL(request.url);
  const now = new Date();
  const from = monthDate(url.searchParams.get("from")) || new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 11, 1));
  const to = monthDate(url.searchParams.get("to")) || new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  try {
    const rows = await listFixedBills({ from, to });
    return NextResponse.json({ rows, providers: FIXED_BILL_PROVIDERS });
  } catch (err) {
    return NextResponse.json({ error: err?.message || "Could not read the bills." }, { status: 503 });
  }
}

export async function POST(request) {
  const { error, admin } = await gate(request);
  if (error) return error;
  const body = await request.json().catch(() => ({}));
  const parsed = parseFixedBillInput(body);
  if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 });
  try {
    const row = await createFixedBill({ data: parsed.data, adminId: admin.id });
    return NextResponse.json({ row }, { status: 201 });
  } catch (err) {
    return NextResponse.json({ error: err?.message || "Could not save the bill." }, { status: 503 });
  }
}

export async function PATCH(request) {
  const { error } = await gate(request);
  if (error) return error;
  const body = await request.json().catch(() => ({}));
  const id = typeof body?.id === "string" ? body.id : "";
  if (!id) return NextResponse.json({ error: "Which bill?" }, { status: 400 });
  const voided = body.voided === true ? true : body.voided === false ? false : undefined;
  let data;
  if (body.provider !== undefined || body.periodMonth !== undefined || body.amount !== undefined || body.amountCents !== undefined) {
    const parsed = parseFixedBillInput(body);
    if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 });
    data = parsed.data;
  }
  if (!data && voided === undefined) return NextResponse.json({ error: "Nothing to change." }, { status: 400 });
  try {
    const row = await updateFixedBill({ id, data, voided });
    return NextResponse.json({ row });
  } catch (err) {
    const missing = err?.code === "P2025";
    return NextResponse.json({ error: missing ? "That bill does not exist." : err?.message || "Could not update the bill." }, { status: missing ? 404 : 503 });
  }
}
