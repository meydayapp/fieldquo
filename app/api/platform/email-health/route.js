// app/api/platform/email-health/route.js
//
// Can FieldQuo actually deliver mail on behalf of its companies?
//
// ── The failure this exists to catch ────────────────────────────────────────
//
// Every company without its own verified domain sends through FieldQuo's
// shared sender. That's the correct design — a sole trader with a Gmail
// address can never be authorised to send as gmail.com, so the platform's
// domain is the only honest option, with their name as the display name and
// replies routed to their inbox.
//
// It only works if FieldQuo's OWN domain is verified. The sender is discovered
// from the Resend account (lib/email/platformSender.js) rather than configured,
// but when NO verified domain belongs to FieldQuo the fallback is
// `onboarding@resend.dev` — and Resend delivers that ONLY to the address that
// owns the account. Mail to anyone else is accepted by the API and dropped.
//
// So the send succeeds. The route records sentAt. The company sees "Emailed
// 3 July" and a green banner. The client gets nothing. There is no error
// anywhere in the system, because nothing failed — the mail was simply thrown
// away by the provider.
//
// That is invisible from inside a tenant account and catastrophic across all
// of them at once, which makes it a platform-console problem rather than a
// per-company one.
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentPlatformAdmin } from "@/lib/platform/currentPlatformAdmin";
import { getPlatformFrom } from "@/lib/email/platformSender";
import { listDomains } from "@/lib/email/resendDomains";

// Resend's sandbox sender. Present in a From header means undelivered mail for
// everyone except the account owner.
const SANDBOX = "onboarding@resend.dev";

function addressOf(from) {
  return (String(from || "").match(/<(.+)>/)?.[1] || String(from || "")).trim();
}

export async function GET(request) {
  const admin = await getCurrentPlatformAdmin(request);
  if (!admin)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const configured = Boolean(process.env.RESEND_API_KEY);
  // Same resolution the send paths use, so this reports the truth rather
  // than re-deriving it and drifting.
  const from = await getPlatformFrom();
  const address = addressOf(from);
  const domain = address.split("@")[1] || null;
  const isSandbox = address.endsWith(SANDBOX);

  // How many tenants depend on the shared sender. This is the blast radius:
  // a company with its own verified domain is unaffected by any of this.
  const [onShared, withOwnDomain] = await Promise.all([
    db.company.count({
      where: {
        OR: [
          { emailDomainStatus: { not: "verified" } },
          { emailDomainStatus: null },
          { emailDomain: null },
        ],
      },
    }),
    db.company.count({
      where: { emailDomainStatus: "verified", emailDomain: { not: null } },
    }),
  ]);

  let platformDomainStatus = null;
  if (configured && domain && !isSandbox) {
    try {
      const domains = await listDomains();
      const match = domains.find(
        (d) => String(d.name).toLowerCase() === domain.toLowerCase(),
      );
      platformDomainStatus = match ? match.status : "not_registered";
    } catch {
      // A failed lookup shouldn't take the dashboard down; it just means we
      // can't confirm, which is reported as its own state rather than as OK.
      platformDomainStatus = "unknown";
    }
  }

  const healthy =
    configured && !isSandbox && platformDomainStatus === "verified";

  return NextResponse.json({
    healthy,
    configured,
    from,
    domain,
    isSandbox,
    platformDomainStatus,
    onShared,
    withOwnDomain,
    problem: describe({ configured, isSandbox, platformDomainStatus, onShared }),
  });
}

function describe({ configured, isSandbox, platformDomainStatus, onShared }) {
  if (!configured) {
    return "RESEND_API_KEY isn't set. No email leaves this deployment at all — sends are skipped and logged.";
  }
  if (isSandbox) {
    return (
      `No verified FieldQuo domain was found on the Resend account, so every send ` +
      `falls back to Resend's sandbox address. ` +
      `Resend delivers that ONLY to the address that owns the Resend account — mail to anyone ` +
      `else is accepted and silently dropped. ${onShared} compan${onShared === 1 ? "y is" : "ies are"} ` +
      `currently relying on this sender, so none of their clients are receiving quotes or invoices.`
    );
  }
  if (platformDomainStatus === "not_registered") {
    return "EMAIL_FROM points at a domain that isn't registered with Resend. Remove the override to let the sender be discovered, or register that domain.";
  }
  if (platformDomainStatus && platformDomainStatus !== "verified") {
    return `FieldQuo's sending domain is "${platformDomainStatus}" rather than verified. Mail will be rejected until the DNS records are in place.`;
  }
  if (platformDomainStatus === "unknown") {
    return "Couldn't reach Resend to confirm the sending domain. Check again shortly.";
  }
  return null;
}
