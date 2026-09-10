// app/api/platform/support/route.js
//
// The escalation queue, for FieldQuo's own console.
//
// ══ Superadmin only, and why reading is gated too ══════════════════════════
//
// "support:manage" is in SUPERADMIN_ONLY_PERMISSIONS (lib/platform/
// permissions.js). Every row names a customer and describes something wrong
// with their account in a rep's own words, and the audience for that is the
// person who is going to fix it. Same argument the data-deletion register
// makes one screen over.
//
// ══ Reads FieldQuo's own table ═════════════════════════════════════════════
//
// Nothing here touches a company's records. Non-negotiable #3 stands: the
// console can see that a contractor's invoice email failed and can write about
// it here — it cannot open their invoice and change it.
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentPlatformAdmin } from "@/lib/platform/currentPlatformAdmin";
import { requirePlatformPermission } from "@/lib/platform/permissions";
import { SUPPORT_STATUSES, SUPPORT_PRIORITIES } from "@/lib/support/escalation";

export const LIST_SELECT = {
  id: true,
  subject: true,
  status: true,
  priority: true,
  createdAt: true,
  updatedAt: true,
  resolvedAt: true,
  assignedAdminId: true,
  assignedAdmin: { select: { id: true, email: true } },
  company: { select: { id: true, name: true } },
  salesRep: { select: { id: true, name: true, email: true } },
  _count: { select: { notes: true } },
};

export async function GET(request) {
  const admin = await getCurrentPlatformAdmin(request);
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    requirePlatformPermission(admin.role, "support:manage");
  } catch {
    return NextResponse.json(
      { error: "Only a superadmin can work the support queue." },
      { status: 403 },
    );
  }

  const { searchParams } = new URL(request.url);
  const status = searchParams.get("status");
  if (status && !SUPPORT_STATUSES.includes(status)) {
    return NextResponse.json({ error: "Unknown status." }, { status: 400 });
  }

  const [rows, counts] = await Promise.all([
    db.supportTicket.findMany({
      where: status ? { status } : {},
      // Worst first, then oldest first inside a priority. A queue sorted only
      // by date buries the urgent ticket somebody raised this morning under a
      // fortnight of low-priority ones — and a queue sorted only by priority
      // lets an old `normal` sit forever.
      orderBy: [{ priority: "desc" }, { createdAt: "asc" }],
      take: 300,
      select: LIST_SELECT,
    }),
    db.supportTicket.groupBy({ by: ["status"], _count: true }),
  ]);

  // Prisma cannot order by an enum-of-strings the way this queue means it —
  // "urgent" > "normal" alphabetically is luck, and "low" > "high" is not. So
  // the final ordering is applied here, over the rows already read, against
  // the list in lib/support/escalation.js rather than a second copy of it.
  const rank = (p) => {
    const i = SUPPORT_PRIORITIES.indexOf(p);
    // An unrecognised priority sorts LAST rather than first: a row with a
    // value this product does not have must not jump the queue.
    return i === -1 ? -1 : i;
  };
  const sorted = [...rows].sort(
    (a, b) => rank(b.priority) - rank(a.priority) || new Date(a.createdAt) - new Date(b.createdAt),
  );

  return NextResponse.json({
    tickets: sorted.map((t) => ({
      ...t,
      noteCount: t._count?.notes ?? 0,
      _count: undefined,
    })),
    counts: Object.fromEntries(counts.map((c) => [c.status, c._count])),
  });
}
