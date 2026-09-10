// app/api/platform/support/[id]/route.js
//
// One escalation: read it, move it, write on it.
//
// ══ Why the status change and the note are ONE request ═════════════════════
//
// "In progress — this is the Neon cold-start, I am watching it" is one act.
// Two endpoints would make it two, and the pair can half-fail: the status moves
// and the explanation does not, so the rep sees a ticket change state with
// nothing said about why. They are written in one transaction, and the
// status-change trace is written there too — the discipline MigrationWrite
// established, that the record of a change belongs in the same transaction as
// the change.
//
// ══ Superadmin only ════════════════════════════════════════════════════════
//
// "support:manage" — see SUPERADMIN_ONLY_PERMISSIONS.
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentPlatformAdmin } from "@/lib/platform/currentPlatformAdmin";
import { requirePlatformPermission } from "@/lib/platform/permissions";
import {
  MAX_NOTE_LENGTH,
  decideStatusChange,
  sanitiseBody,
  statusChangeSentence,
} from "@/lib/support/escalation";

const DETAIL_SELECT = {
  id: true,
  subject: true,
  body: true,
  status: true,
  priority: true,
  createdAt: true,
  updatedAt: true,
  resolvedAt: true,
  assignedAdminId: true,
  assignedAdmin: { select: { id: true, email: true } },
  company: { select: { id: true, name: true, slug: true } },
  salesRep: { select: { id: true, name: true, email: true } },
  notes: {
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      kind: true,
      authorKind: true,
      body: true,
      internal: true,
      createdAt: true,
      authorAdmin: { select: { email: true } },
      authorRep: { select: { name: true, email: true } },
    },
  },
};

async function gate(request) {
  const admin = await getCurrentPlatformAdmin(request);
  if (!admin) {
    return { admin: null, refusal: { status: 401, body: { error: "Unauthorized" } } };
  }
  try {
    requirePlatformPermission(admin.role, "support:manage");
  } catch {
    return {
      admin: null,
      refusal: {
        status: 403,
        body: { error: "Only a superadmin can work the support queue." },
      },
    };
  }
  return { admin, refusal: null };
}

export async function GET(request, { params }) {
  const { refusal } = await gate(request);
  if (refusal) return NextResponse.json(refusal.body, { status: refusal.status });

  // Next 16: params is a Promise.
  const { id } = await params;
  const ticket = await db.supportTicket.findUnique({ where: { id }, select: DETAIL_SELECT });
  if (!ticket) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ ticket });
}

/**
 * Move the status, add a note, or both.
 *
 * Body: `{ status?, note?, internal? }`. At least one of status/note, because
 * a PATCH that changes nothing and answers 200 is a control that appears to
 * work and doesn't.
 */
export async function PATCH(request, { params }) {
  const { admin, refusal } = await gate(request);
  if (refusal) return NextResponse.json(refusal.body, { status: refusal.status });

  const { id } = await params;
  const payload = await request.json().catch(() => null);
  if (!payload) {
    return NextResponse.json({ error: "Expected a JSON body." }, { status: 400 });
  }

  const wantsStatus = typeof payload.status === "string" && payload.status !== "";
  const note = sanitiseBody(payload.note, MAX_NOTE_LENGTH);
  const internal = payload.internal === true;
  if (!wantsStatus && !note) {
    return NextResponse.json(
      { error: "Nothing to change — pick a status or write a note." },
      { status: 400 },
    );
  }

  // Read fresh in the request that writes. A status a caller remembered from
  // an earlier page load is exactly what must not be trusted — the same
  // argument lib/migrations/state.js's canWrite() makes at greater cost.
  const current = await db.supportTicket.findUnique({
    where: { id },
    select: { id: true, status: true },
  });
  if (!current) return NextResponse.json({ error: "Not found" }, { status: 404 });

  let change = null;
  if (wantsStatus) {
    change = decideStatusChange({ ticket: current, to: payload.status });
    if (!change.ok) {
      return NextResponse.json(
        { error: change.error, code: change.code },
        { status: change.status },
      );
    }
  }

  // ── Interactive, not an array of promises ────────────────────────────────
  //
  // The first version of this batched the writes into db.$transaction([...]).
  // That runs them all and reports afterwards — so a LOST RACE still wrote the
  // "moved this to in_progress" note, and the 409 below would have been sent
  // over a thread that already claimed the move happened. An interactive
  // transaction can throw the moment the compare-and-set matches nothing, and
  // Prisma rolls the note back with it.
  const RACED = "support-ticket-raced";
  try {
    await db.$transaction(async (tx) => {
      if (change) {
        // Compare-and-set on the status we decided against, so two admins
        // working the queue at once cannot both be told they moved it.
        const moved = await tx.supportTicket.updateMany({
          where: { id, status: change.from },
          data: change.data,
        });
        if (moved.count === 0) throw new Error(RACED);
        await tx.supportTicketNote.create({
          data: {
            ticketId: id,
            kind: "status_change",
            authorKind: "admin",
            authorAdminId: admin.id,
            body: statusChangeSentence({ from: change.from, to: change.to }),
            // A status change is always visible to the rep. It is the progress
            // they came to see — hiding it behind `internal` would leave the
            // ticket looking untouched.
            internal: false,
          },
        });
      }
      if (note) {
        await tx.supportTicketNote.create({
          data: {
            ticketId: id,
            kind: "message",
            authorKind: "admin",
            authorAdminId: admin.id,
            body: note,
            internal,
          },
        });
        // A note with no status change still bumps the ticket, so a reply moves
        // it up the rep's list rather than leaving an answered question looking
        // unanswered.
        if (!change) {
          await tx.supportTicket.update({ where: { id }, data: { updatedAt: new Date() } });
        }
      }
    });
  } catch (err) {
    if (err?.message === RACED) {
      return NextResponse.json(
        { error: "Somebody moved this ticket a moment ago. Reload it.", code: "raced" },
        { status: 409 },
      );
    }
    throw err;
  }

  const ticket = await db.supportTicket.findUnique({ where: { id }, select: DETAIL_SELECT });
  return NextResponse.json({ ticket });
}
