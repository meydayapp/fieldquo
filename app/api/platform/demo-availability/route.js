// app/api/platform/demo-availability/route.js
//
// When FieldQuo's own staff are free to run a product demo. Read AND write.
//
// ── Why writing is correct here, unlike everywhere else in /platform ───────
//
// The non-negotiable is that the platform console can view everything and edit
// NOTHING on a COMPANY's data — FieldQuo must never alter a customer's quote.
// DemoHostAvailability is not a customer's data. It is FieldQuo's own sales
// calendar, owned by PlatformAdmin rows, and if it were read-only here the
// hours would have to live in a constant again, which is exactly the problem
// this replaced. Do not "fix" this route by making it read-only.
//
// ── Who may edit whom ──────────────────────────────────────────────────────
//
// Anyone on the platform team may edit their OWN hours — they are the only
// person who knows them. A superadmin may edit anyone's, because somebody has
// to be able to clear a departing colleague's calendar. Deliberately not tied
// to the PLATFORM_PERMISSIONS table: those permissions are all about reaching
// into customer accounts, and "can state my own working hours" is not that.
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentPlatformAdmin } from "@/lib/platform/currentPlatformAdmin";

const bad = (error, status = 400) => NextResponse.json({ error }, { status });

/** A timezone the runtime actually knows. An unknown one silently produces no slots. */
function isKnownTimezone(tz) {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

const TIME = /^([01]\d|2[0-3]):([0-5]\d)$/;
const minutes = (t) => Number(t.slice(0, 2)) * 60 + Number(t.slice(3, 5));

export async function GET(request) {
  const me = await getCurrentPlatformAdmin(request);
  if (!me) return bad("Unauthorized", 401);

  // Inactive admins are listed too, greyed out by the page. Their rows still
  // exist and would otherwise be invisible data — and /api/demo/slots already
  // ignores them, so the page has to be able to say why.
  const admins = await db.platformAdmin.findMany({
    select: {
      id: true,
      email: true,
      role: true,
      active: true,
      demoAvailability: {
        select: { id: true, dayOfWeek: true, startTime: true, endTime: true, timezone: true },
        orderBy: [{ dayOfWeek: "asc" }, { startTime: "asc" }],
      },
    },
    orderBy: { createdAt: "asc" },
  });

  return NextResponse.json({ admins, me });
}

export async function PUT(request) {
  const me = await getCurrentPlatformAdmin(request);
  if (!me) return bad("Unauthorized", 401);

  const body = await request.json().catch(() => ({}));
  const adminId = String(body?.adminId || "");
  if (!adminId) return bad("adminId is required.");

  if (adminId !== me.id && me.role !== "superadmin") {
    return bad("You can only change your own demo availability.", 403);
  }

  const target = await db.platformAdmin.findUnique({
    where: { id: adminId },
    select: { id: true, email: true },
  });
  if (!target) return bad("No such platform admin.", 404);

  const input = Array.isArray(body?.windows) ? body.windows : null;
  if (!input) return bad("windows must be an array.");
  if (input.length > 40) return bad("That's more windows than a week can hold.");

  // Validated, never coerced. A row that doesn't say something complete is
  // rejected with a reason — quietly dropping it would leave the console
  // showing hours that were never saved, which is the same class of bug as a
  // toggle that writes a column nothing reads.
  const windows = [];
  const seen = new Set();
  for (const w of input) {
    const dayOfWeek = Number(w?.dayOfWeek);
    const startTime = String(w?.startTime ?? "");
    const endTime = String(w?.endTime ?? "");
    const timezone = String(w?.timezone ?? "").trim();

    if (!Number.isInteger(dayOfWeek) || dayOfWeek < 0 || dayOfWeek > 6) {
      return bad("Each window needs a day of the week (0–6).");
    }
    if (!TIME.test(startTime) || !TIME.test(endTime)) {
      return bad("Times must look like 09:00 or 18:30.");
    }
    if (minutes(endTime) <= minutes(startTime)) {
      return bad(`${startTime}–${endTime} ends before it starts.`);
    }
    if (!isKnownTimezone(timezone)) {
      return bad(`"${timezone}" isn't a timezone this server recognises.`);
    }

    const key = `${dayOfWeek}:${startTime}`;
    if (seen.has(key)) return bad("Two windows on the same day can't start at the same time.");
    seen.add(key);

    windows.push({ adminId, dayOfWeek, startTime, endTime, timezone });
  }

  // Replace wholesale, in one transaction: the page sends the complete set for
  // one admin, so a partial write would publish a half-edited week.
  await db.$transaction([
    db.demoHostAvailability.deleteMany({ where: { adminId } }),
    ...(windows.length ? [db.demoHostAvailability.createMany({ data: windows })] : []),
  ]);

  await db.platformAuditLog.create({
    data: {
      platformAdminId: me.id,
      action: "demo_availability_updated",
      details: { adminEmail: target.email, windows: windows.length },
    },
  });

  const saved = await db.demoHostAvailability.findMany({
    where: { adminId },
    select: { id: true, dayOfWeek: true, startTime: true, endTime: true, timezone: true },
    orderBy: [{ dayOfWeek: "asc" }, { startTime: "asc" }],
  });

  return NextResponse.json({ adminId, windows: saved });
}
