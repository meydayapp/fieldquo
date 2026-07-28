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

import { db } from "@/lib/db";
import { listDomains } from "./resendDomains";

export const SANDBOX_ADDRESS = "onboarding@resend.dev";
const SANDBOX_FROM = `FieldQuo <${SANDBOX_ADDRESS}>`;

// Local part of the discovered address. quotes@ reads correctly on the
// documents this actually sends.
const LOCAL_PART = process.env.EMAIL_FROM_LOCAL || "quotes";

// Discovery costs a Resend call and a database query. Sends happen in loops —
// a marketing campaign hits every subscriber — so the answer is cached. Ten
// minutes is long enough that a campaign never re-checks and short enough that
// verifying a domain takes effect without a redeploy.
const TTL_MS = 10 * 60 * 1000;
let cache = { value: null, at: 0 };

/** Drops the cache. Called after a domain is verified so it takes effect now. */
export function invalidatePlatformSender() {
  cache = { value: null, at: 0 };
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
  if (!process.env.RESEND_API_KEY) return SANDBOX_FROM;

  try {
    const domains = await listDomains();
    const verified = domains.filter((d) => d.status === "verified");
    if (!verified.length) return SANDBOX_FROM;

    // Exclude anything a tenant owns.
    const claimed = await db.company.findMany({
      where: { emailDomainId: { in: verified.map((d) => d.id) } },
      select: { emailDomainId: true },
    });
    const claimedIds = new Set(claimed.map((c) => c.emailDomainId));

    const ours = verified.filter((d) => !claimedIds.has(d.id));
    if (!ours.length) return SANDBOX_FROM;

    // Prefer a sending subdomain when one exists. A root domain usually
    // carries the company's real mailbox; a `send.` or `mail.` subdomain was
    // set up for exactly this.
    const preferred =
      ours.find((d) => /^(send|mail|email|notifications)\./i.test(d.name)) ||
      ours[0];

    const from = `FieldQuo <${LOCAL_PART}@${preferred.name}>`;
    cache = { value: from, at: Date.now() };
    return from;
  } catch (err) {
    console.error("[email] couldn't resolve the platform sender:", err?.message);
    return SANDBOX_FROM;
  }
}

/** True when we're on the sandbox, i.e. nothing reaches real clients. */
export function isSandbox(from) {
  return String(from || "").includes(SANDBOX_ADDRESS);
}
