// app/api/clients/portal-links/route.js
//
// "Email clients their portal link" — the Clients page's bulk action (owner,
// 2026-10-10). Owners and admins only.
//
//   GET   the DRY RUN: who would get it, why each is eligible, why the rest
//         are skipped, and the rendered email for the first recipient. Reads
//         only — no token minted, nothing sent, nothing written.
//   POST  { confirm: true, expected: <count shown> } — sends. Without
//         confirm: true it answers 400 and sends nothing; if the list changed
//         since the preview (expected ≠ now) it answers 409 and sends
//         nothing, so a confirm is always for the list the person saw.
//
// Who is eligible, the recent-link window and the batch size are
// lib/portal/bulkLinks.js — the one rule, shared with
// scripts/portal-links-dry-run.mjs.
//
// POST for the send: it writes (mints tokens, keeps SentEmail rows), and
// getCurrentMember refuses a read-only support session on any non-GET.
export const runtime = "nodejs";
// One press sends at most BULK_BATCH emails, spaced under Resend's rate
// ceiling — about a minute and a half at the full batch.
export const maxDuration = 300;

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { memberOrRefusal } from "@/lib/apiMember";
import { planOrRefusal } from "@/lib/signup/planGate";
import { loadEnforceableMember, requireLevel, permissionErrorResponse } from "@/lib/permissions/enforce";
import { portalUrl } from "@/lib/clientPortal";
import { sendEmail, SENDER_SELECT } from "@/lib/email/resend";
import { resolveSender } from "@/lib/email/companySender";
import { actorName } from "@/lib/email/sentEmailHistory";
import { recordActivity } from "@/lib/activity/log";
import { sendBulkPortalLinks } from "@/lib/portal/bulkLinks";

/** How many recipients the preview lists by name. The count is always whole. */
const PREVIEW_LIST = 500;

const COMPANY_SELECT = { ...SENDER_SELECT, logoUrl: true, brandColor: true, phone: true, defaultLanguage: true };

/** Owners and admins, and never a support session acting as one. */
function ownerOrAdmin(member) {
  return Boolean(member && !member.impersonation && (member.role === "owner" || member.role === "admin"));
}

async function gate(request, { write }) {
  const { member, response } = await memberOrRefusal(request);
  if (response) return { response };
  // A support session (which resolves to the owner's membership) may READ the
  // preview — the platform console sees everything; only the company's own
  // owner or admin may send.
  const isOwnerRole = member?.role === "owner" || member?.role === "admin";
  const allowed = write ? ownerOrAdmin(member) : isOwnerRole;
  if (!allowed) {
    return { response: NextResponse.json({ error: "Only an owner or admin can email clients their portal links." }, { status: 403 }) };
  }
  try {
    const full = await loadEnforceableMember(db, member.id);
    // The level that may mint and copy ONE client's link
    // (app/api/clients/[id]/portal-link). An owner or admin always has it;
    // checked anyway, so a narrowed grid narrows this too.
    requireLevel(full, "clientsProperties", "full_view", "email clients their portal links");
  } catch (err) {
    const { body, status } = permissionErrorResponse(err);
    return { response: NextResponse.json(body, { status }) };
  }
  return { member };
}

export async function GET(request) {
  const { member, response } = await gate(request, { write: false });
  if (response) return response;

  const company = await db.company.findUnique({ where: { id: member.companyId }, select: COMPANY_SELECT });
  if (!company) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const preview = await sendBulkPortalLinks({ db, companyId: member.companyId, company, dryRun: true });
  return NextResponse.json({
    count: preview.recipients.length,
    batch: preview.batch,
    total: preview.total,
    windowDays: preview.windowDays,
    skipped: preview.skipped,
    recipients: preview.recipients.slice(0, PREVIEW_LIST).map((r) => ({ id: r.id, name: r.name, email: r.email, why: r.why })),
    sample: preview.sample
      ? { name: preview.sample.name, to: preview.sample.to, subject: preview.sample.subject, html: preview.sample.html, text: preview.sample.text, language: preview.sample.language }
      : null,
  });
}

export async function POST(request) {
  const { member, response } = await gate(request, { write: true });
  if (response) return response;

  const body = await request.json().catch(() => ({}));
  // Explicit or nothing. A body that merely exists — an empty POST, a stray
  // retry, `confirm: "yes"` — sends nobody anything.
  if (body?.confirm !== true) {
    return NextResponse.json({ error: "Nothing was sent. Review the list, then confirm.", code: "not_confirmed" }, { status: 400 });
  }

  // An email to many clients under the company's name — the same outward act
  // as a quote send, so the same plan gate (lib/signup/planGate.js).
  const { response: unpaid } = await planOrRefusal(member, "email clients their portal links");
  if (unpaid) return unpaid;

  const company = await db.company.findUnique({ where: { id: member.companyId }, select: COMPANY_SELECT });
  if (!company) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const expected = Number.isInteger(body?.expected) && body.expected >= 0 ? body.expected : null;
  if (expected == null) {
    return NextResponse.json({ error: "Nothing was sent. Review the list again, then confirm.", code: "list_changed" }, { status: 409 });
  }

  const out = await sendBulkPortalLinks({
    db,
    companyId: member.companyId,
    company,
    dryRun: false,
    confirm: true,
    expected,
    linkFor: (token) => portalUrl(token, request),
    send: sendEmail,
    resolveSender,
    sentByUserId: member.userId || null,
    sentByName: await actorName(db, member.userId),
  });

  if (out.refused === "list_changed") {
    return NextResponse.json(
      { error: "The list changed since you looked at it. Nothing was sent — review it again, then confirm.", code: "list_changed", count: out.now },
      { status: 409 },
    );
  }
  if (out.refused) {
    return NextResponse.json({ error: "Nothing was sent.", code: out.refused }, { status: 400 });
  }
  if (out.sent === 0 && out.results.some((r) => r.error === "email_not_configured")) {
    return NextResponse.json(
      { error: "Email isn't configured on this deployment yet — RESEND_API_KEY is missing, so nothing was sent.", code: "send_failed" },
      { status: 503 },
    );
  }

  // One trail row for the press; each email is its own SentEmail row on the
  // client's History tab. Never throws.
  await recordActivity(member, {
    action: "client.portal_links_bulk_sent",
    entityType: "client",
    entityId: null,
    summary: `Emailed portal links to ${out.sent} client${out.sent === 1 ? "" : "s"}${out.failed ? ` (${out.failed} not sent)` : ""}`,
    metadata: { sent: out.sent, failed: out.failed, remaining: out.remaining },
  });

  return NextResponse.json({ sent: out.sent, failed: out.failed, attempted: out.attempted, remaining: out.remaining });
}
