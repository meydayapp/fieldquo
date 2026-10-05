// lib/agency/delivery.js
//
// Posting outbox events to the agency's hook URLs (Zapier REST hooks), with
// retries, and stopping for good on a 410.
//
// ══ Zapier's contract ══════════════════════════════════════════════════════
//
// Zapier answers 410 Gone when a Zap is turned off or deleted and it did not
// manage to call our unsubscribe. That is an instruction: the subscription is
// ended (endedReason "gone_410") and every delivery still pending for it is
// cancelled. Any other non-2xx, or no answer within DELIVERY_TIMEOUT_MS, is a
// failure retried on BACKOFF_MINUTES; after the last one the delivery is
// "failed" and stays in the log with the last status and error.
//
// ══ The URL is checked before anything is sent ════════════════════════════
//
// A subscription's targetUrl came from the agency. It must be https, and may
// not name localhost, a private or link-local address, or an IP literal at
// all — a webhook is not a way to make FieldQuo's servers fetch their own
// network (cleanTargetUrl, also applied at subscribe time).

import { loadLeadFacts } from "@/lib/agency/leadFacts";
import { buildLeadRow } from "@/lib/agency/leadRow";
import { payloadFor } from "@/lib/agency/events";

/** Minutes to wait after attempt 1, 2, 3… before the next. Seven attempts over ~a day and a half. */
export const BACKOFF_MINUTES = Object.freeze([1, 5, 30, 120, 360, 720]);
export const MAX_ATTEMPTS = BACKOFF_MINUTES.length + 1;
export const DELIVERY_TIMEOUT_MS = 10 * 1000;

const BLOCKED_HOST = /^(localhost|.*\.localhost|.*\.local|.*\.internal|.*\.lan|metadata\.google\.internal)$/i;

/** An https URL safe to POST to, normalised — or null. Pure. */
export function cleanTargetUrl(value) {
  if (typeof value !== "string" || value.length > 2000) return null;
  let u;
  try {
    u = new URL(value.trim());
  } catch {
    return null;
  }
  if (u.protocol !== "https:") return null;
  if (u.username || u.password) return null;
  const host = u.hostname.toLowerCase();
  if (!host || BLOCKED_HOST.test(host)) return null;
  // No IP literals, v4 or v6: a hook target is a named service.
  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(host) || host.startsWith("[") || host.includes(":")) return null;
  if (!host.includes(".")) return null;
  if (u.port && u.port !== "443") return null;
  return u.toString();
}

/** When the next attempt is due after `attempts` failures, or null when there is none. */
export function nextAttemptAfter(attempts, now = new Date()) {
  if (attempts >= MAX_ATTEMPTS) return null;
  const minutes = BACKOFF_MINUTES[Math.max(0, attempts - 1)] ?? BACKOFF_MINUTES[BACKOFF_MINUTES.length - 1];
  return new Date(now.getTime() + minutes * 60 * 1000);
}

/** What one response means: "delivered" | "gone" | "retry". Pure. */
export function classifyResponse(status) {
  if (status >= 200 && status < 300) return "delivered";
  if (status === 410) return "gone";
  return "retry";
}

async function post(fetchImpl, url, body, headers) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), DELIVERY_TIMEOUT_MS);
  try {
    const res = await fetchImpl(url, {
      method: "POST",
      headers: { "content-type": "application/json", "user-agent": "FieldQuo-Webhooks/1", ...headers },
      body: JSON.stringify(body),
      signal: ctrl.signal,
      redirect: "manual",
    });
    return { status: res.status, error: null };
  } catch (err) {
    return { status: null, error: err?.name === "AbortError" ? "timeout" : String(err?.message || err).slice(0, 200) };
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Send every due delivery (optionally for one company). Returns a tally.
 * `fetchImpl` is injectable so the check can play Zapier, 410 included.
 */
export async function deliverDue({ db, companyId = null, now = new Date(), fetchImpl = globalThis.fetch, limit = 200 }) {
  const due = await db.agencyHookDelivery.findMany({
    where: {
      status: "pending",
      nextAttemptAt: { lte: now },
      ...(companyId ? { subscription: { companyId } } : {}),
    },
    select: {
      id: true,
      attempts: true,
      eventId: true,
      subscriptionId: true,
      event: { select: { id: true, companyId: true, event: true, leadId: true, occurredAt: true, facts: true } },
      subscription: { select: { id: true, companyId: true, targetUrl: true, endedAt: true } },
    },
    orderBy: { nextAttemptAt: "asc" },
    take: limit,
  });
  const tally = { due: due.length, delivered: 0, retried: 0, failed: 0, gone: 0, cancelled: 0 };
  if (!due.length) return tally;

  // One load per company: its switches and the facts of the leads owed.
  const byCompany = new Map();
  for (const d of due) {
    // A delivery whose event and subscription disagree about the tenant is
    // never sent — it cannot happen through fanOut, and if it ever did, the
    // agency on the other end is not entitled to it.
    if (d.event.companyId !== d.subscription.companyId) continue;
    if (!byCompany.has(d.event.companyId)) byCompany.set(d.event.companyId, new Set());
    byCompany.get(d.event.companyId).add(d.event.leadId);
  }
  const context = new Map();
  for (const [cid, leadIds] of byCompany) {
    const [company, loaded] = await Promise.all([
      db.company.findUnique({ where: { id: cid }, select: { agencyShareContacts: true, agencyShareMoney: true, currency: true, country: true } }),
      loadLeadFacts({ db, companyId: cid, where: { id: { in: [...leadIds] } }, now }),
    ]);
    context.set(cid, { company, facts: new Map(loaded.facts.map((f) => [f.id, f])) });
  }

  const goneSubs = new Set();
  for (const d of due) {
    const cid = d.event.companyId;
    const ctx = context.get(cid);
    if (!ctx || d.subscription.endedAt || goneSubs.has(d.subscriptionId) || d.subscription.companyId !== cid) {
      await db.agencyHookDelivery.update({ where: { id: d.id }, data: { status: "cancelled", lastError: "subscription ended" } });
      tally.cancelled++;
      continue;
    }
    const fact = ctx.facts.get(d.event.leadId);
    if (!fact) {
      // The lead was deleted since: nothing to describe, nothing to send.
      await db.agencyHookDelivery.update({ where: { id: d.id }, data: { status: "cancelled", lastError: "lead no longer exists" } });
      tally.cancelled++;
      continue;
    }
    const settings = {
      shareContacts: ctx.company?.agencyShareContacts === true,
      shareMoney: ctx.company?.agencyShareMoney !== false,
      currency: ctx.company?.currency || null,
      country: ctx.company?.country || null,
      now,
    };
    const body = payloadFor(d.event, buildLeadRow(fact, settings), settings);
    const url = cleanTargetUrl(d.subscription.targetUrl);
    const result = url
      ? await post(fetchImpl, url, body, { "x-fieldquo-event": d.event.event, "x-fieldquo-delivery": d.id })
      : { status: null, error: "target URL refused" };
    const attempts = d.attempts + 1;
    const verdict = result.status === null ? "retry" : classifyResponse(result.status);
    if (verdict === "delivered") {
      await db.agencyHookDelivery.update({ where: { id: d.id }, data: { status: "delivered", attempts, lastAttemptAt: now, lastStatusCode: result.status, lastError: null, deliveredAt: now } });
      tally.delivered++;
    } else if (verdict === "gone") {
      goneSubs.add(d.subscriptionId);
      await db.agencyHookDelivery.update({ where: { id: d.id }, data: { status: "gone", attempts, lastAttemptAt: now, lastStatusCode: 410 } });
      await db.agencyHookSubscription.updateMany({ where: { id: d.subscriptionId, companyId: cid, endedAt: null }, data: { endedAt: now, endedReason: "gone_410" } });
      await db.agencyHookDelivery.updateMany({ where: { subscriptionId: d.subscriptionId, status: "pending" }, data: { status: "cancelled", lastError: "subscription ended (410)" } });
      tally.gone++;
    } else {
      const next = url ? nextAttemptAfter(attempts, now) : null;
      await db.agencyHookDelivery.update({
        where: { id: d.id },
        data: {
          status: next ? "pending" : "failed",
          attempts,
          lastAttemptAt: now,
          lastStatusCode: result.status,
          lastError: result.error || (result.status ? `HTTP ${result.status}` : null),
          ...(next ? { nextAttemptAt: next } : {}),
        },
      });
      if (next) tally.retried++;
      else tally.failed++;
    }
  }
  return tally;
}
