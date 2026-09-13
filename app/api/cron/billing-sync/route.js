// app/api/cron/billing-sync/route.js
//
// Every six hours: pull every live subscription from Stripe and write what
// Stripe says. A row that disagreed is filed as `billing_drift` in the
// platform error log with the fields that differed.
//
// ══ Why a pull on a schedule ═══════════════════════════════════════════════
//
// The Subscription row's Stripe-side columns were written by webhooks and by
// nothing else. A webhook outage is silent: an endpoint that is unregistered,
// pointed at another URL or signed with a rotated secret delivers nothing
// and errors nowhere. On 2026-09-13 six hours of production logs held zero
// Stripe POSTs, and the only symptom was the owner's own cancelled test plan
// still reading "active".
//
// With this cron a webhook outage becomes VISIBLE within six hours — as a
// billing_drift row per affected company on /platform/errors — instead of
// never. It is not a replacement for the webhooks (an invoice.payment_failed
// still needs to start the grace clock the hour it happens); it is the
// backstop that says when they have stopped.
//
// ══ What it never does ═════════════════════════════════════════════════════
//
// "No such subscription" is NOT written as cancelled — see
// lib/platform/stripeSync.js. A key from the other mode would otherwise lock
// every paying company out in one run. Those are filed as billing_sync_missing
// and left for a human. Demo companies are skipped: their rows are fixtures.
//
// ══ Cost ═══════════════════════════════════════════════════════════════════
//
// 4 invocations a day. One Stripe retrieve per subscription with a
// stripeSubscriptionId (no list call — the id is known), sequential, so a
// 200-company book is ~200 reads spread over a few seconds and well inside
// Stripe's rate limit; one DB write per row that drifted, none otherwise.
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { requireCronSecret } from "@/lib/security/cronAuth";
import { db } from "@/lib/db";
import { recordError } from "@/lib/platform/errorLog";
import { syncSubscriptionFromStripe } from "@/lib/platform/stripeSync";

const BILLING_SYNC_AREA = "billing";
const DRIFT_CODE = "billing_drift";

// A book longer than this does not exist yet; leftovers are next run's.
const BATCH = 1000;

export async function GET(request) {
  const denied = requireCronSecret(request);
  if (denied) return denied;

  const rows = await db.subscription.findMany({
    where: {
      stripeSubscriptionId: { not: null },
      company: { isDemo: false },
    },
    select: { companyId: true, stripeSubscriptionId: true, status: true },
    orderBy: { updatedAt: "asc" },
    take: BATCH,
  });

  const summary = { checked: 0, drifted: 0, missing: 0, errors: 0, companies: [] };

  for (const row of rows) {
    summary.checked += 1;
    let result;
    try {
      result = await syncSubscriptionFromStripe(row.companyId);
    } catch (err) {
      summary.errors += 1;
      await recordError({
        area: BILLING_SYNC_AREA,
        code: "billing_sync_failed",
        message: `Subscription sync threw for ${row.stripeSubscriptionId}: ${err?.message}`,
        companyId: row.companyId,
      });
      continue;
    }

    if (!result.ok) {
      if (result.reason === "stripe_missing") {
        summary.missing += 1;
        await recordError({
          area: BILLING_SYNC_AREA,
          code: "billing_sync_missing",
          message: `Stripe has no subscription ${row.stripeSubscriptionId} on this key — not written as cancelled; check which mode the id belongs to.`,
          companyId: row.companyId,
          detail: { stripeSubscriptionId: row.stripeSubscriptionId, rowStatus: row.status },
        });
      } else if (result.reason === "stripe_error") {
        summary.errors += 1;
        await recordError({
          area: BILLING_SYNC_AREA,
          code: "billing_sync_failed",
          message: `Stripe could not be read for ${row.stripeSubscriptionId}: ${result.error}`,
          companyId: row.companyId,
        });
      }
      continue;
    }

    if (result.changed.length) {
      summary.drifted += 1;
      summary.companies.push({ companyId: row.companyId, changed: result.changed });
      // The row was WRONG until this run: for however long, every screen
      // that read it was offering or refusing the wrong things. That is the
      // fact worth a row on /platform/errors, whichever field it was.
      await recordError({
        area: BILLING_SYNC_AREA,
        code: DRIFT_CODE,
        message:
          `Subscription row disagreed with Stripe (${result.stripeStatus}) — corrected: ` +
          result.changed.map((c) => `${c.field} ${fmt(c.before)} → ${fmt(c.after)}`).join(", ") +
          ". A drift that recurs means the Stripe webhook is not reaching this deployment.",
        companyId: row.companyId,
        detail: {
          stripeSubscriptionId: result.stripeSubscriptionId,
          stripeStatus: result.stripeStatus,
          changed: result.changed,
        },
      });
    }
  }

  return NextResponse.json({ ok: true, ...summary });
}

const fmt = (v) => (v instanceof Date ? v.toISOString() : v === null || v === undefined ? "∅" : String(v));
