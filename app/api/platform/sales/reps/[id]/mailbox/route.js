// app/api/platform/sales/reps/[id]/mailbox/route.js
//
// The owner connects a rep's work mailbox — address and password in one
// step — re-tests it, or disconnects it.
//
// ══ Superadmin only, like every write to a rep's row ══════════════════════
//
// The same gate app/api/platform/sales/reps/[id]/route.js applies, for the
// same reason: the sales team is managed by the owner. An admin or support
// role can see the card's status line; only a superadmin can put a password
// on it.
//
// ══ The password crosses once, and never back ═════════════════════════════
//
//   POST   { workEmail, password, imapHost?, imapPort?, smtpHost?, smtpPort? }
//          → tests IMAP and SMTP, seals the password, writes the rep's
//            workEmail and the SalesMailbox row together. A failed test
//            still saves (status "error", the two results in words) so the
//            card can show what failed and offer Retry.
//   POST   { retry: true }  → re-tests with the stored password.
//   DELETE                  → revokes: the secret is cleared, the sync stops,
//                             the threads stay.
//
// Every answer is the row in its public shape (lib/sales/mailbox/store.js's
// MAILBOX_PUBLIC_SELECT) — no `secret`, ever. The request body is never
// logged; a thrown error is recorded without it.
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentPlatformAdmin } from "@/lib/platform/currentPlatformAdmin";
import { recordError } from "@/lib/platform/errorLog";
import { connectMailbox, retryMailbox, revokeMailbox } from "@/lib/sales/mailbox/store";

async function superadminAnd(request, params) {
  const { id } = await params;
  const admin = await getCurrentPlatformAdmin(request);
  if (!admin) return { refusal: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  if (admin.role !== "superadmin") {
    return { refusal: NextResponse.json({ error: "Only superadmins can manage the sales team" }, { status: 403 }) };
  }
  const rep = await db.salesRep.findUnique({ where: { id }, select: { id: true, email: true, workEmail: true, name: true } });
  if (!rep) return { refusal: NextResponse.json({ error: "Not found." }, { status: 404 }) };
  return { admin, rep };
}

export async function POST(request, { params }) {
  const { refusal, rep, admin } = await superadminAnd(request, params);
  if (refusal) return refusal;

  const body = await request.json().catch(() => null);
  if (!body) return NextResponse.json({ error: "Expected a JSON body." }, { status: 400 });

  try {
    const result = body.retry === true ? await retryMailbox(db, rep.id) : await connectMailbox(db, rep, body);
    if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status });
    return NextResponse.json({ mailbox: result.mailbox, tested: result.tested });
  } catch (err) {
    await recordError({
      area: "sales_mailbox",
      code: "connect_threw",
      message: `Connecting ${rep.name}'s mailbox threw: ${err?.message || "unknown"}`,
      detail: { salesRepId: rep.id, by: admin.id },
    }).catch(() => {});
    return NextResponse.json({ error: "Couldn't connect the mailbox. The error is in the platform error log." }, { status: 500 });
  }
}

export async function DELETE(request, { params }) {
  const { refusal, rep } = await superadminAnd(request, params);
  if (refusal) return refusal;
  const result = await revokeMailbox(db, rep.id);
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status });
  return NextResponse.json({ mailbox: result.mailbox });
}
