// app/api/track/route.js
//
// Where the page-view beacon lands. Public — a stranger reading the pricing
// page has no session and must never be asked for one — and strict about
// what it will write.
//
// ══ What it accepts ════════════════════════════════════════════════════════
//
// A text/plain body (navigator.sendBeacon's simple request) of at most
// MAX_BATCH_BYTES holding the envelope lib/analytics/product/events.js
// sanitiseBatch() understands. Event names are allow-listed; a page_view's
// path must resolve to one of the product's own route patterns (the catalogue
// generated from app/); a help query is bounded; everything else is dropped
// silently. Rate-limited per IP the way every public POST is.
//
// ══ Who the hit belongs to is decided HERE, from the session ═══════════════
//
// The browser says nothing about who it is on a signed-in surface. For /app
// events the member and company come from getCurrentMember(); for /sales the
// rep from the sales cookie; for /platform the admin cookie decides whether
// the hit counts at all. A beacon claiming /app hits with no session is
// dropped. An impersonation session (a superadmin reading a customer's
// account) is dropped too: it is not that company using the product, and
// counting it would put support's clicks in the owner's usage report.
//
// ══ Always 204 ═════════════════════════════════════════════════════════════
//
// A good batch, an empty one, a malformed event inside a good envelope, a
// table that is not pushed yet — the answer is the same, because the page
// never reads it and a different status per outcome is an oracle for what
// the allow-list holds. Only an over-long body and a broken envelope get a
// 400, so a developer wiring a new event learns the shape is wrong.

export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { rateLimit } from "@/lib/rateLimit";
import { getCurrentMember } from "@/lib/currentMember";
import { getCurrentSalesRep } from "@/lib/sales/auth";
import { getCurrentPlatformAdmin } from "@/lib/platform/currentPlatformAdmin";
import { sanitiseBatch, MAX_BATCH_BYTES } from "@/lib/analytics/product/events";
import { recordRows, analyticsAvailable } from "@/lib/analytics/product/store";

/** One beacon per page view; two hundred in ten minutes is a very busy tab. */
const TRACK_LIMIT = { limit: 200, windowMs: 10 * 60 * 1000 };

const noContent = () => new NextResponse(null, { status: 204 });

/**
 * The context each surface's rows carry. Resolved once per batch, and only
 * for the surfaces the batch actually holds — getCurrentMember() logs a
 * console error for a missing session, which every marketing beacon would
 * otherwise print.
 */
async function contextFor(request, surfaces) {
  const ctx = { app: null, sales: null, platform: null };
  if (surfaces.has("app")) {
    try {
      const member = await getCurrentMember(request, { skipBillingGate: true });
      if (member?.companyId && !member.impersonation) {
        const company = await db.company.findUnique({ where: { id: member.companyId }, select: { isDemo: true } });
        ctx.app = { companyId: member.companyId, memberId: member.id || null, isDemo: Boolean(company?.isDemo) };
      }
    } catch {
      ctx.app = null;
    }
  }
  if (surfaces.has("sales")) {
    try {
      const rep = await getCurrentSalesRep(request);
      if (rep?.salesRepId) ctx.sales = { repId: rep.salesRepId };
    } catch {
      ctx.sales = null;
    }
  }
  if (surfaces.has("platform")) {
    try {
      const admin = await getCurrentPlatformAdmin(request);
      if (admin?.id) ctx.platform = { adminId: admin.id };
    } catch {
      ctx.platform = null;
    }
  }
  return ctx;
}

export async function POST(request) {
  const limited = rateLimit(request, "track", TRACK_LIMIT);
  if (limited) return limited;

  const text = await request.text().catch(() => "");
  if (!text || text.length > MAX_BATCH_BYTES) {
    return NextResponse.json({ error: "body must be a JSON envelope under 8KB" }, { status: 400 });
  }
  let body;
  try {
    body = JSON.parse(text);
  } catch {
    return NextResponse.json({ error: "body must be JSON" }, { status: 400 });
  }
  const batch = sanitiseBatch(body);
  if (!batch) return NextResponse.json({ error: "unknown envelope" }, { status: 400 });
  if (!batch.events.length || !analyticsAvailable(db)) return noContent();

  const surfaces = new Set(batch.events.map((e) => e.surface));
  const ctx = await contextFor(request, surfaces);

  const rows = [];
  for (const e of batch.events) {
    const base = {
      ...e,
      language: batch.language,
      viewport: batch.viewport,
      visitorId: null,
      companyId: null,
      memberId: null,
      repId: null,
      isDemo: false,
    };
    if (e.surface === "app") {
      if (!ctx.app) continue;
      rows.push({ ...base, visitorId: ctx.app.memberId, companyId: ctx.app.companyId, memberId: ctx.app.memberId, isDemo: ctx.app.isDemo });
    } else if (e.surface === "sales") {
      if (!ctx.sales) continue;
      rows.push({ ...base, visitorId: ctx.sales.repId, repId: ctx.sales.repId });
    } else if (e.surface === "platform") {
      if (!ctx.platform) continue;
      rows.push({ ...base, visitorId: ctx.platform.adminId });
    } else {
      // marketing, help, client: the anonymous id, when the browser has one.
      rows.push({ ...base, visitorId: batch.visitorId });
    }
  }

  try {
    await recordRows(db, rows);
  } catch (err) {
    console.error("[track] batch not recorded:", err?.message || err);
  }
  return noContent();
}
