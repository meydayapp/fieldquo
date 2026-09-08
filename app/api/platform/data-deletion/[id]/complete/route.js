// app/api/platform/data-deletion/[id]/complete/route.js
//
// The owner says "I have deleted it." The ONE write this feature makes from
// the console, and it writes to DataDeletionRequest — FieldQuo's own register
// — never to a company's data. Non-negotiable #3 is intact: the deletion
// this row records happened by hand, outside this route, and this route
// records the fact and tells the person.
//
// Superadmin only ("data_deletion:manage"). Idempotent-by-refusal: a request
// already completed answers 409 rather than re-stamping the date and mailing
// the person twice — the completion email is the promise kept, and a second
// one with a later date would contradict the first.
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentPlatformAdmin } from "@/lib/platform/currentPlatformAdmin";
import { requirePlatformPermission } from "@/lib/platform/permissions";
import { META_CALLBACK_PLACEHOLDER_EMAIL } from "@/lib/dataDeletion/requests";
import {
  buildDeletionCompleted,
  sendDataDeletionEmail,
} from "@/lib/email/dataDeletionEmail";

const bad = (error, status = 400) => NextResponse.json({ error }, { status });

export async function POST(request, { params }) {
  const admin = await getCurrentPlatformAdmin(request);
  if (!admin) return bad("Unauthorized", 401);
  try {
    requirePlatformPermission(admin.role, "data_deletion:manage");
  } catch {
    return bad("Only a superadmin can mark a data deletion request completed.", 403);
  }

  const { id } = await params;
  const row = await db.dataDeletionRequest.findUnique({ where: { id } });
  if (!row) return bad("Not found", 404);
  if (row.status === "completed") {
    return bad("This request is already marked completed.", 409);
  }

  // updateMany with the status in the where, so two clicks racing each other
  // produce one completion: the second finds no row still "received" and is
  // told so, rather than both stamping and both mailing.
  const completedAt = new Date();
  const stamped = await db.dataDeletionRequest.updateMany({
    where: { id, status: "received" },
    data: { status: "completed", completedAt, completedById: admin.id },
  });
  if (!stamped.count) return bad("This request was completed a moment ago.", 409);

  const updated = { ...row, status: "completed", completedAt, completedById: admin.id };

  // A Meta-callback row has no address — the person removed the app on
  // Facebook and Meta gave us a user id. Nothing to email; the status URL
  // Meta showed them now reads "completed", which is the confirmation.
  if (updated.email === META_CALLBACK_PLACEHOLDER_EMAIL) {
    return NextResponse.json({ ok: true, request: updated, emailSent: false, noAddress: true });
  }

  const mail = buildDeletionCompleted(updated);
  const result = await sendDataDeletionEmail({ to: updated.email, ...mail });
  if (result?.error || result?.skipped) {
    const why = result?.skipped
      ? "email sending is not configured on this server"
      : typeof result.error === "string"
        ? result.error
        : result.error?.message || "the mail provider refused the message";
    // The stamp stands — the deletion DID happen — but the response says the
    // person has not been told, so the console can show it instead of a tick.
    return NextResponse.json(
      {
        ok: true,
        request: updated,
        emailSent: false,
        warning: `Marked completed, but the confirmation email to ${updated.email} could not be sent: ${why}. Tell them by hand.`,
      },
      { status: 200 },
    );
  }

  return NextResponse.json({ ok: true, request: updated, emailSent: true });
}
