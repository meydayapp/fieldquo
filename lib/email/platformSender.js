// lib/email/platformSender.js
//
// Works out FieldQuo's own sending address, without being told.
//
// ── Why this exists instead of a required env var ───────────────────────────
//
// The previous design read EMAIL_FROM and fell back to Resend's sandbox
// address when it was unset. That made a verified domain sitting right there
// on the Resend account useless until someone also typed it into Vercel — and
// forgetting to do so didn't fail loudly, it silently dropped every client
// email in the product. A configuration step whose omission is invisible and
// catastrophic is a design flaw, not a deployment checklist item.
//
// Resend already knows which domains are verified. So does this module: it
// asks, and uses the answer.
//
// ── Telling FieldQuo's domain apart from a tenant's ─────────────────────────
//
// Resend has no tenants — every company that verifies its own domain adds it
// to the same flat account list. Sending FieldQuo's shared mail from a
// customer's domain would be both wrong and a small scandal, so the rule is:
// a verified domain is FieldQuo's only if NO Company row claims it. Tenant
// domains are all recorded on Company.emailDomainId, which makes that check
// exact rather than a guess about naming.
//
// ── EMAIL_FROM still wins when set ──────────────────────────────────────────
//
// Discovery is the default, not a straitjacket. An explicit EMAIL_FROM is
// honoured untouched — useful when the account has several verified domains
// and the automatic pick isn't the one you want.

//
// ── The sandbox is for a machine with no key, never for production ──────────
//
// Until 2026-09-15 every failure path here returned Resend's sandbox address.
// In production that is not "degraded", it is a rejection: Resend refuses
// sandbox mail to anyone but the account owner, so the client never got the
// email and the company was told it was sent. The error log showed it
// happening on 08-19, 08-26, 08-30, 09-06, 09-10 and 09-14 — always one
// send in a burst, always on a fresh lambda: a cold instance has an empty
// cache, several sends call listDomains at once, Resend's rate limit
// answers one of them with 429, and that one send went out as sandbox.
//
// Three things fix that. The discovered sender is PERSISTED (PlatformSetting
// "platform_sender"), so a cold instance reads a row instead of calling
// Resend; a discovery failure keeps the last-known-good answer rather than
// downgrading; and when there is nothing known at all but there IS a key, the
// fallback is FieldQuo's own apex — which is verified — never the sandbox.
// The sandbox is now reserved for a machine with no RESEND_API_KEY, where
// nothing is sent anyway. Each failure is written to the error log once per
// instance so it is visible on /platform rather than only in a lambda's
// stdout.

import { db } from "@/lib/db";
import { listDomains } from "./resendDomains";
import { isPlatformEmailDomain, PLATFORM_APEX } from "./platformDomains";
import { recordError } from "@/lib/platform/errorLog";

export const SANDBOX_ADDRESS = "onboarding@resend.dev";
const SANDBOX_FROM = `FieldQuo <${SANDBOX_ADDRESS}>`;
/** PlatformSetting key the discovered sender is kept under. */
export const PLATFORM_SENDER_SETTING = "platform_sender";
/** A persisted answer older than this is refreshed, but still used meanwhile. */
const PERSISTED_TTL_MS = 24 * 60 * 60 * 1000;

// Local part of the discovered address. quotes@ reads correctly on the
// documents this actually sends.
const LOCAL_PART = process.env.EMAIL_FROM_LOCAL || "quotes";

// Discovery costs a Resend call and a database query. Sends happen in loops —
// a marketing campaign hits every subscriber — so the answer is cached. Ten
// minutes is long enough that a campaign never re-checks and short enough that
// verifying a domain takes effect without a redeploy.
const TTL_MS = 10 * 60 * 1000;
let cache = { value: null, at: 0 };
let failureLogged = false;

/** Drops the cache. Called after a domain is verified so it takes effect now. */
export function invalidatePlatformSender() {
  cache = { value: null, at: 0 };
  db.platformSetting.deleteMany({ where: { key: PLATFORM_SENDER_SETTING } }).catch(() => {});
}

/**
 * What production sends from when nothing better is known: the apex, which
 * is verified. `quotes@fieldquo.com` is exactly what discovery returns on a
 * good day, so a failed lookup and a successful one put the same address in
 * the client's inbox.
 */
export function apexFrom() {
  return `FieldQuo <${LOCAL_PART}@${PLATFORM_APEX}>`;
}

async function readPersisted() {
  try {
    const row = await db.platformSetting.findUnique({ where: { key: PLATFORM_SENDER_SETTING } });
    const from = row?.value?.from;
    const at = row?.value?.at ? new Date(row.value.at).getTime() : 0;
    return typeof from === "string" && from ? { from, at } : null;
  } catch {
    return null;
  }
}

async function writePersisted(from) {
  const value = { from, at: new Date().toISOString() };
  await db.platformSetting
    .upsert({ where: { key: PLATFORM_SENDER_SETTING }, create: { key: PLATFORM_SENDER_SETTING, value }, update: { value } })
    .catch(() => {});
}

async function noteFailure(message) {
  console.error("[email] couldn't resolve the platform sender:", message);
  if (failureLogged) return;
  failureLogged = true;
  await recordError({
    area: "email",
    code: "sender_discovery_failed",
    message: `Resend's domain list could not be read (${message}); mail is going out from the last known sender or the apex, never the sandbox.`,
  }).catch(() => {});
}

/**
 * The From header FieldQuo sends under when a company has no domain of its own.
 *
 * Never throws. Every failure path returns the sandbox address, because a
 * degraded sender is recoverable and an exception thrown mid-send is not — it
 * would take down quote sending entirely over a Resend hiccup.
 */
export async function getPlatformFrom() {
  // Explicit configuration always wins.
  if (process.env.EMAIL_FROM) return process.env.EMAIL_FROM;

  if (cache.value && Date.now() - cache.at < TTL_MS) return cache.value;
  // No key: nothing is sent, and the sandbox address is the honest label for
  // that — lib/email/resend.js skips the send and logs it.
  if (!process.env.RESEND_API_KEY) return SANDBOX_FROM;

  // A cold instance answers from the persisted row and refreshes only when
  // that row is a day old — one Resend call per day, not one per lambda.
  const persisted = await readPersisted();
  if (persisted && Date.now() - persisted.at < PERSISTED_TTL_MS) {
    cache = { value: persisted.from, at: Date.now() };
    return persisted.from;
  }
  // Whatever discovery below cannot improve on: the stale row, else the apex.
  const lastKnown = persisted?.from || apexFrom();

  try {
    const domains = await listDomains();
    const verified = domains.filter((d) => d.status === "verified");
    if (!verified.length) {
      await noteFailure("no verified domain on the account");
      return lastKnown;
    }

    // Exclude anything a tenant owns.
    const claimed = await db.company.findMany({
      where: { emailDomainId: { in: verified.map((d) => d.id) } },
      select: { emailDomainId: true },
    });
    const claimedIds = new Set(claimed.map((c) => c.emailDomainId));

    // Ours: unclaimed by any tenant — OR a platform domain regardless. The
    // second clause is the read-side of lib/email/platformDomains.js: a
    // Company row that claims fieldquo.com (a QA test once did) must not be
    // able to take FieldQuo's own mail down to the sandbox.
    const ours = verified.filter(
      (d) => isPlatformEmailDomain(d.name) || !claimedIds.has(d.id),
    );
    if (!ours.length) {
      await noteFailure("every verified domain is claimed by a tenant");
      return lastKnown;
    }

    // Prefer a sending subdomain when one exists. A root domain usually
    // carries the company's real mailbox; a `send.` or `mail.` subdomain was
    // set up for exactly this.
    const preferred =
      ours.find((d) => /^(send|mail|email|notifications)\./i.test(d.name)) ||
      ours[0];

    const from = `FieldQuo <${LOCAL_PART}@${preferred.name}>`;
    cache = { value: from, at: Date.now() };
    await writePersisted(from);
    return from;
  } catch (err) {
    await noteFailure(err?.message || "unknown error");
    // Not cached: the next send tries discovery again, but it never goes
    // out as sandbox while it waits.
    return lastKnown;
  }
}

/** True when we're on the sandbox, i.e. nothing reaches real clients. */
export function isSandbox(from) {
  return String(from || "").includes(SANDBOX_ADDRESS);
}
