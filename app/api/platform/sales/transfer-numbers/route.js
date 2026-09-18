// app/api/platform/sales/transfer-numbers/route.js
//
// The phones a live caller may be handed to — the owner's mobile, the office
// line: read by every platform admin, written by a superadmin.
//
// ══ What a number here changes ════════════════════════════════════════════
//
// lib/sales/transferNumbers.js: every rep's transfer picker offers it, by
// LABEL, under "A phone", and a warm or cold transfer to it places an
// outbound leg from FieldQuo's own number. The rep never sees or sends the
// number; the browser echoes an id and the transfer route resolves it against
// this list in the same request. Nothing about the calling window applies —
// this is not a prospect being rung, it is a colleague's phone.
//
// ══ Superadmin writes, everyone reads ═════════════════════════════════════
//
// A number on this list is a destination every rep can send a live call to
// on FieldQuo's account. A stranger's number here is toll fraud with a
// label, so the write sits behind superadminOrRefusal like the test lines,
// is audit-logged with the list before and after, and is capped at
// MAX_TRANSFER_NUMBERS — more than that is a phone book, and the picker is
// read on a live call.
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentPlatformAdmin } from "@/lib/platform/currentPlatformAdmin";
import { superadminOrRefusal } from "@/lib/sales/intel/configAdmin";
import {
  MAX_TRANSFER_LABEL_CHARS,
  MAX_TRANSFER_NUMBERS,
  rejectedTransferNumbers,
  standingTransferEntry,
} from "@/lib/sales/transferNumbers";
import { loadTransferNumbers, saveTransferNumbers } from "@/lib/sales/transferNumbersStore";
import { TRANSFER_RING_SECONDS } from "@/lib/sales/calls/transfer";

const bad = (error, status = 400) => NextResponse.json({ error }, { status });

async function payload() {
  const standing = standingTransferEntry(process.env.FIELDQUO_SALES_TRANSFER_TO);
  return {
    numbers: await loadTransferNumbers(),
    max: MAX_TRANSFER_NUMBERS,
    maxLabel: MAX_TRANSFER_LABEL_CHARS,
    // How long a phone rings before the caller comes back to the rep — the
    // constant the transfer actually uses, so the card cannot say 25 while
    // the leg rings for 30.
    ringSeconds: TRANSFER_RING_SECONDS,
    // Shown on the card so the console can say where the env var's entry
    // sits relative to the list. Never editable here: it is a deployment
    // variable, and a screen that pretends to edit one is a dead control.
    standing: standing ? { e164: standing.e164, label: standing.label } : null,
    serverNow: new Date().toISOString(),
  };
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
  if (!body || !Array.isArray(body.numbers)) {
    return bad("Send { numbers: [{ e164: '+1…', label: '…' }, …] }.");
  }
  if (body.numbers.length > MAX_TRANSFER_NUMBERS) {
    return bad(`At most ${MAX_TRANSFER_NUMBERS} transfer numbers. More than that is a phone book, not a hand-off list.`);
  }

  // Every entry must survive the normaliser: an entry the list would
  // silently drop is a control that appears to work and doesn't, so the
  // request is refused naming the offending entry rather than saved short.
  const rejected = rejectedTransferNumbers(body.numbers);
  if (rejected.length) {
    const first = rejected[0];
    const shown = first.entry && typeof first.entry === "object" ? `${first.entry.label ?? ""} ${first.entry.e164 ?? ""}`.trim() : String(first.entry);
    return bad(`Entry ${first.index + 1} (${JSON.stringify(shown)}): ${first.reason}. Use E.164, e.g. +14165550100, and a label of up to ${MAX_TRANSFER_LABEL_CHARS} characters.`);
  }

  const before = (await loadTransferNumbers()).map(({ e164, label }) => ({ e164, label }));
  const after = (await saveTransferNumbers({ numbers: body.numbers })).map(({ e164, label }) => ({ e164, label }));

  await db.platformAuditLog.create({
    data: {
      platformAdminId: admin.id,
      action: "sales_transfer_numbers_updated",
      details: { before, after },
    },
  });

  return NextResponse.json(await payload());
}
