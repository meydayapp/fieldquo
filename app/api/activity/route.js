// app/api/activity/route.js
//
// The company's own view of its activity trail — who did what inside their
// account. Owner/admin only: it exposes actions across every user (payments,
// deletions, price changes), which isn't line-staff's to browse.
//
// Optional ?entityType & ?entityId narrow it to one record's history — the
// "what happened to THIS quote" view.
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { memberOrRefusal } from "@/lib/apiMember";

export async function GET(request) {
  const { member, response } = await memberOrRefusal(request);
  if (response) return response;

  // Impersonation reads it. Non-negotiable #3 is "the platform console views
  // everything and edits nothing", and this log is where support answers "who
  // changed that price" — the question they are called about. A support
  // session's role is "viewer", which is neither owner nor admin, so without
  // this line the console got the 403 below. There is no write on this route to
  // let through: the log is appended by recordActivity from other routes, and
  // an impersonated session's own actions are stamped viaImpersonation.
  if (!member.impersonation && member.role !== "owner" && member.role !== "admin") {
    return NextResponse.json(
      { error: "Only an owner or admin can view the activity log." },
      { status: 403 },
    );
  }

  const { searchParams } = new URL(request.url);
  const entityType = searchParams.get("entityType");
  const entityId = searchParams.get("entityId");
  const limit = Math.min(200, Math.max(1, Number(searchParams.get("limit")) || 100));

  const where = { companyId: member.companyId };
  if (entityType) where.entityType = entityType;
  if (entityId) where.entityId = entityId;

  const entries = await db.activityLog.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take: limit,
    select: {
      id: true,
      action: true,
      entityType: true,
      entityId: true,
      summary: true,
      // For metadata.i18n only — see below. Selected whole because Prisma
      // cannot project into a Json column.
      metadata: true,
      actorName: true,
      actorRole: true,
      viaImpersonation: true,
      createdAt: true,
    },
  });

  // ── Only the i18n pair leaves, never the rest of metadata ────────────────
  //
  // recordActivity puts a translation key and its parameters in
  // `metadata.i18n` so a row written today renders in the READER's language
  // rather than in the language of whoever triggered it. The rest of metadata
  // is per-event bookkeeping — ids, amounts, provider payloads — that this
  // screen has never shown and has no reason to ship to a browser, so it is
  // dropped here rather than widened into the response by accident.
  //
  // A row with no key (every row written before this existed) comes back with
  // neither field and renders its stored English summary, which is what it has
  // always said and what it will keep saying.
  return NextResponse.json({
    entries: entries.map(({ metadata, ...entry }) => {
      const i18n = metadata && typeof metadata === "object" ? metadata.i18n : null;
      return {
        ...entry,
        ...(i18n?.key ? { summaryKey: i18n.key } : {}),
        ...(i18n?.params && typeof i18n.params === "object"
          ? { summaryParams: i18n.params }
          : {}),
      };
    }),
  });
}
