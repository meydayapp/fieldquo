// lib/rateLimit.js
//
// A throttle for the public, unauthenticated POST endpoints — the ones a
// stranger can hit without a session: lead forms, self-quote, funnel
// submissions, instant-quote requests, demo bookings. Each of those fans out
// into consent records, queued outbound phone calls and branded emails, so an
// unthrottled endpoint is not just noise in a pipeline: it spends the tenant's
// call credits and burns their sending-domain reputation.
//
// BE HONEST ABOUT WHAT THIS IS. The window lives in this process's memory. On
// Vercel that means PER LAMBDA INSTANCE, and instances come and go — a flood
// spread across a scaled-out deployment gets a fresh allowance on each one, and
// a cold start forgets everything. It stops the naive case (one script, one
// loop, one IP, which is the case we actually see) and nothing more. A durable
// counter — Redis, Postgres, or Vercel's own KV — is the next step if abuse
// ever gets deliberate, and this module's shape is the one to keep so only the
// storage swaps out. Deliberately dependency-free until then.
//
// Sliding window, not fixed: a fixed window lets 2× the limit through across a
// boundary (ten at 09:59:59, ten more at 10:00:00), which on a ten-per-ten-
// minutes budget is most of the protection gone.

import { NextResponse } from "next/server";

// key -> number[] of request timestamps (ms), oldest first.
const hits = new Map();

// Prune keys nothing has touched in a while, so a long-lived instance doesn't
// accumulate a map entry per IP that ever hit us. Cheap and amortised: it runs
// on a request, not a timer, because a timer keeps a serverless instance alive.
const PRUNE_EVERY = 500;
let sincePrune = 0;

function prune(now) {
  for (const [key, stamps] of hits) {
    // The longest window any caller uses; anything older is dead whatever the
    // caller's own window was.
    if (!stamps.length || now - stamps[stamps.length - 1] > 60 * 60 * 1000) {
      hits.delete(key);
    }
  }
}

/**
 * The caller's IP, best-effort. First hop of x-forwarded-for is the client on
 * Vercel. A null IP is treated as its own bucket rather than skipping the limit
 * — "we couldn't identify you" is not a reason to hand out unlimited requests.
 */
export function clientIp(request) {
  const xff = request.headers.get("x-forwarded-for");
  if (xff) return xff.split(",")[0].trim();
  return request.headers.get("x-real-ip") || "unknown";
}

/**
 * Record a hit and say whether it's allowed.
 *
 * @param {string} key        bucket identity — IP + route, so a flood of leads
 *                            doesn't lock the same person out of booking a demo
 * @param {number} limit      requests permitted per window
 * @param {number} windowMs   window length
 * @returns {{ ok: boolean, remaining: number, retryAfter: number }}
 *          retryAfter is seconds until the oldest hit falls out of the window.
 */
export function hit(key, { limit = 10, windowMs = 10 * 60 * 1000 } = {}) {
  const now = Date.now();

  if (++sincePrune >= PRUNE_EVERY) {
    sincePrune = 0;
    prune(now);
  }

  const cutoff = now - windowMs;
  const stamps = (hits.get(key) || []).filter((t) => t > cutoff);

  if (stamps.length >= limit) {
    // Don't record the rejected attempt. Otherwise a client that keeps hammering
    // keeps pushing its own window forward and can never come back — a throttle
    // that turns into a permanent ban on the strength of an IP is the wrong
    // trade for a form a real customer might double-submit.
    hits.set(key, stamps);
    const retryAfter = Math.max(1, Math.ceil((stamps[0] + windowMs - now) / 1000));
    return { ok: false, remaining: 0, retryAfter };
  }

  stamps.push(now);
  hits.set(key, stamps);
  return { ok: true, remaining: limit - stamps.length, retryAfter: 0 };
}

/**
 * The whole guard in one call, for route handlers.
 *
 * Returns a 429 Response to return immediately, or null to carry on:
 *
 *   const limited = rateLimit(request, "leads-public");
 *   if (limited) return limited;
 *
 * `message` is client-facing and lands in a form's error slot, so it says what
 * happened and what to do — not "429".
 */
export function rateLimit(request, route, opts = {}) {
  const {
    limit = 10,
    windowMs = 10 * 60 * 1000,
    message = "Too many requests from this connection. Please wait a few minutes and try again.",
  } = opts;

  const result = hit(`${route}:${clientIp(request)}`, { limit, windowMs });
  if (result.ok) return null;

  return NextResponse.json(
    { error: message },
    { status: 429, headers: { "retry-after": String(result.retryAfter) } },
  );
}
