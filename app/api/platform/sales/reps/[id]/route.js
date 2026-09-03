// app/api/platform/sales/reps/[id]/route.js
//
// Deactivating (and reactivating) a sales rep, and assigning their work mailbox.
//
// ══ Two edits, one handler, and why the code is not a third ═══════════════
//
// `active` and `workEmail` are both here because both are things a superadmin
// does to an existing rep from the same row on the same screen.
//
// `code` deliberately is NOT. It is the slug in /signup?sales=<code> — the link
// is on a business card, in a text message, in an email footer — and changing
// it silently stops crediting the rep for every copy already handed out.
// Attribution rows are keyed on salesRepId and are safe, but the LINK is not,
// and a control whose real effect is "quietly stop some of your signups
// counting" is exactly the destructive-operation-labelled-as-cosmetic failure
// AGENTS.md names. The code is chosen once, at creation, where it can still be
// overridden; after that the screen says why it is fixed rather than offering
// an edit that would look harmless.
//
// ══ Deactivate, never delete ══════════════════════════════════════════════
//
// There is no DELETE handler in this file, and that is the decision rather than
// an omission. A rep's SalesAttribution rows say who brought each company in,
// and their SalesCommissionEntry rows say what FieldQuo owed and paid. Both are
// history, and history does not stop being true when somebody leaves. The
// schema says the same thing in its own words on SalesRep.endedAt.
//
// So `active: false` closes the door — lib/sales/gate.js re-reads this column on
// every single request, so a deactivation takes effect within one request
// rather than waiting out a twelve-hour token — and `endedAt` records when. A
// reactivation clears endedAt, because somebody who comes back has not left.
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentPlatformAdmin } from "@/lib/platform/currentPlatformAdmin";
import { normaliseWorkEmail, workEmailProblem } from "@/lib/sales/repAdmin";

export async function PATCH(request, { params }) {
  // Next 16: `params` is a Promise; reading it synchronously gives undefined.
  const _params = await params;

  const admin = await getCurrentPlatformAdmin(request);
  if (!admin) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (admin.role !== "superadmin") {
    return NextResponse.json(
      { error: "Only superadmins can manage the sales team" },
      { status: 403 },
    );
  }

  const existing = await db.salesRep.findUnique({
    where: { id: _params.id },
    select: { id: true, active: true, email: true, workEmail: true },
  });
  if (!existing) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const body = await request.json().catch(() => ({}));
  const { active } = body;
  // `undefined` means "this request isn't about the mailbox". `null` and `""`
  // both mean "clear it", which is a real thing to want — a mailbox is closed
  // when somebody leaves, and leaving a dead address on the row would keep
  // sending mail whose replies bounce. The two are deliberately different, so
  // `in` rather than a truthiness test.
  const touchesMailbox = "workEmail" in body;
  const workEmail = touchesMailbox ? normaliseWorkEmail(body.workEmail) : undefined;

  if (typeof active !== "boolean" && !touchesMailbox) {
    return NextResponse.json(
      { error: "Send active (true/false), or workEmail, or both." },
      { status: 400 },
    );
  }
  if (active !== undefined && typeof active !== "boolean") {
    return NextResponse.json(
      { error: "active must be true or false" },
      { status: 400 },
    );
  }

  if (touchesMailbox) {
    const problem = workEmailProblem(workEmail, existing.email);
    if (problem) return NextResponse.json({ error: problem }, { status: 400 });

    if (workEmail && workEmail !== existing.workEmail) {
      const taken = await db.salesRep.findUnique({
        where: { workEmail },
        select: { id: true },
      });
      if (taken && taken.id !== existing.id) {
        return NextResponse.json(
          { error: `${workEmail} is already another rep's work mailbox.` },
          { status: 409 },
        );
      }
    }
  }

  const updated = await db.salesRep.update({
    where: { id: _params.id },
    data: {
      ...(typeof active === "boolean"
        ? {
            active,
            // Only ever set alongside active: false, and cleared on the way
            // back. Leaving a stale endedAt on a reactivated rep would make
            // canAuthenticate refuse them forever — it treats endedAt as final,
            // on purpose.
            endedAt: active ? null : new Date(),
          }
        : {}),
      ...(touchesMailbox ? { workEmail } : {}),
    },
    select: {
      id: true,
      name: true,
      email: true,
      workEmail: true,
      code: true,
      active: true,
      endedAt: true,
      acceptedAt: true,
    },
  });

  // One row per thing that changed, rather than one row saying "edited". The
  // deactivation actions already had their own vocabulary and other screens
  // read it; a mailbox assignment decides who a prospect ends up talking to and
  // deserves to be findable on its own.
  const actions = [];
  if (typeof active === "boolean") {
    actions.push({
      action: active ? "sales_rep_reactivated" : "sales_rep_deactivated",
      details: { salesRepId: updated.id, email: updated.email },
    });
  }
  if (touchesMailbox && workEmail !== existing.workEmail) {
    actions.push({
      action: "sales_rep_work_mailbox_set",
      details: {
        salesRepId: updated.id,
        email: updated.email,
        from: existing.workEmail || null,
        to: updated.workEmail || null,
      },
    });
  }
  for (const entry of actions) {
    await db.platformAuditLog.create({
      data: { platformAdminId: admin.id, ...entry },
    });
  }

  return NextResponse.json(updated);
}
