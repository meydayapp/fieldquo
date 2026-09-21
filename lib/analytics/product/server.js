// lib/analytics/product/server.js
//
// The server-side emitters: the events a browser is not allowed to send.
//
// ══ Called AFTER the real write, never before ══════════════════════════════
//
// recordFeatureUse("quote_sent", …) sits after the quote's status moved and
// the email left, the same place recordActivity() does — a count of quotes
// sent must be a count of quotes that were sent. And like recordActivity it
// NEVER throws: a metrics table failing must not fail, or roll back, the
// customer's actual action. Errors go to console.error and the row is
// simply missing.
//
// ══ Why this does not hook recordActivity ══════════════════════════════════
//
// It could — three of the seven features already write an activity row. It
// does not, because the activity log's `action` strings are a tenant-facing
// vocabulary ("quote.followed_up" is a different row from "quote.sent") and
// an implicit mapping from them is exactly the kind of coupling AGENTS.md's
// "grep for the field you just added" is meant to catch: nobody grepping the
// activity log would find the analytics. Seven explicit calls, one per
// writer, each named in events.js FEATURES — and the check script asserts
// each writer file contains its call.

import { db } from "@/lib/db";
import { FEATURE_KEYS } from "./events";
import { recordRows, analyticsAvailable } from "./store";
import { cleanCardSource } from "@/lib/reviews/card";

/** Company → isDemo, remembered for a few minutes so a burst of sends costs one read. */
const demoCache = new Map();
const DEMO_TTL_MS = 5 * 60 * 1000;

async function isDemoCompany(client, companyId) {
  if (!companyId) return false;
  const hit = demoCache.get(companyId);
  if (hit && hit.until > Date.now()) return hit.value;
  const row = await client.company.findUnique({ where: { id: companyId }, select: { isDemo: true } });
  const value = Boolean(row?.isDemo);
  demoCache.set(companyId, { value, until: Date.now() + DEMO_TTL_MS });
  return value;
}

/**
 * One explicit product action, by a company (and, when a person did it, a
 * member). `feature` must be one of events.js FEATURE_KEYS — an unknown key
 * is refused here rather than written, so a typo cannot create a bar nobody
 * can explain.
 *
 * @param {string} feature
 * @param {{ companyId: string, memberId?: string|null, language?: string|null }} ctx
 * @param {{ client?: object }} deps  the Prisma client to write through. A
 *   writer that was itself handed a client (lib/invoices/recordStripePayment.js
 *   takes `db` as an argument so checks can pass a fake) forwards it here, so
 *   a check's fake database is the one this touches and never the real one.
 * @returns {Promise<boolean>} true when a row was written
 */
export async function recordFeatureUse(feature, ctx = {}, deps = {}) {
  const client = deps.client || db;
  try {
    if (!FEATURE_KEYS.includes(feature)) {
      console.error(`[analytics] unknown feature "${feature}" — not recorded`);
      return false;
    }
    if (!ctx.companyId || !analyticsAvailable(client)) return false;
    const isDemo = await isDemoCompany(client, ctx.companyId);
    const n = await recordRows(client, [
      {
        event: "feature_used",
        surface: "app",
        path: feature,
        language: typeof ctx.language === "string" ? ctx.language.slice(0, 2).toLowerCase() : "",
        // The member is the "visitor" so distinct users per feature is a real
        // figure; a server-only action (a Stripe webhook) has none.
        visitorId: ctx.memberId || null,
        companyId: ctx.companyId,
        memberId: ctx.memberId || null,
        isDemo,
        meta: null,
      },
    ]);
    return n > 0;
  } catch (err) {
    console.error("[analytics] feature use not recorded:", err?.message || err);
    return false;
  }
}

/**
 * The last bar of the signup funnel: a Subscription row exists for this
 * company. Called from lib/platform/stripeBilling.js beside the rep-panel
 * stamp. No visitor — the browser that started the funnel is long gone and
 * was never tied to the company on purpose.
 */
export async function recordSignupCompleted({ companyId, language = "" } = {}, deps = {}) {
  const client = deps.client || db;
  try {
    if (!companyId || !analyticsAvailable(client)) return false;
    const isDemo = await isDemoCompany(client, companyId);
    const n = await recordRows(client, [
      {
        event: "signup_step",
        surface: "marketing",
        path: "completed",
        language: typeof language === "string" ? language.slice(0, 2).toLowerCase() : "",
        visitorId: null,
        companyId,
        isDemo,
        meta: null,
      },
    ]);
    return n > 0;
  } catch (err) {
    console.error("[analytics] signup completion not recorded:", err?.message || err);
    return false;
  }
}

/**
 * One tap on a company's digital business card, by source. Called from
 * app/c/[slug]/page.js as the page renders — a server event, so the count
 * is a count of pages served, not of beacons a browser chose to send. The
 * anonymous visitor id is not available to a server component and is not
 * needed: the question this answers is "how many taps from the sticker",
 * not "how many people".
 *
 * @param {{ companyId: string, source: string, language?: string }} ctx
 */
export async function recordCardTap({ companyId, source, language = "" } = {}, deps = {}) {
  const client = deps.client || db;
  try {
    if (!companyId || !analyticsAvailable(client)) return false;
    const isDemo = await isDemoCompany(client, companyId);
    const n = await recordRows(client, [
      {
        event: "card_tap",
        surface: "client",
        path: cleanCardSource(source),
        language: typeof language === "string" ? language.slice(0, 2).toLowerCase() : "",
        visitorId: null,
        companyId,
        isDemo,
        meta: null,
      },
    ]);
    return n > 0;
  } catch (err) {
    console.error("[analytics] card tap not recorded:", err?.message || err);
    return false;
  }
}
