// app/api/settings/email-domain/route.js
//
// Manages the calling company's own email sending domain.
//
//   GET    — current domain, status and the DNS records still to be added
//   POST   — register a domain with Resend (or re-check an existing one)
//   PATCH  — change the from-address local part (quotes@, hello@, ...)
//
// Every answer carries the same view (viewOf below): the row, plus "what
// clients see" computed by the send path itself (lib/email/senderStatus.js)
// and the proposals built from Company.email. Company.email is NOT written
// here — the "Replies go to" row on the page saves it through
// /api/settings/business-info, the one writer the company profile uses
// (lib/email/companyReplyTo.js).
//   DELETE — disconnect, falling back to FieldQuo's shared sending domain
//
// Owners/admins only, and every handler is scoped to the caller's own company
// so one tenant can never touch another's domain.
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { isPlatformEmailDomain } from "@/lib/email/platformDomains";
import { memberOrRefusalPlain } from "@/lib/apiMember";
import { requirePermission } from "@/lib/permissions";
import {
  createDomain,
  findDomainByName,
  getDomain,
  verifyDomain,
  deleteDomain,
  normalizeStatus,
  isPlausibleDomain,
} from "@/lib/email/resendDomains";
import { senderStatusFor } from "@/lib/email/senderStatus";
import { FROM_LOCAL_PATTERN } from "@/lib/email/senderSuggestion";

const SELECT = {
  emailDomain: true,
  emailDomainId: true,
  emailDomainStatus: true,
  emailFromLocal: true,
  emailDomainRecords: true,
  emailDomainCheckedAt: true,
  email: true,
  name: true,
  // Read for the domain prefill only; viewOf keeps it out of the response.
  website: true,
};

/**
 * The one response shape, for every handler. It was the bare row, so the page
 * replaced its state with whatever a POST/PATCH/DELETE returned — had the
 * status line lived only on GET, a save would have wiped it until a reload.
 */
async function viewOf(company, companyId) {
  if (!company) return {};
  const { website, ...rest } = company;
  return { ...rest, ...(await senderStatusFor(company, companyId)) };
}

/**
 * @param read  true only on GET. Non-negotiable #3: the platform console views
 *              everything and edits nothing. A support session's role is
 *              "viewer", which holds no permission at all, so requirePermission
 *              refused it — on the screen support is most often asked to look
 *              at, since "our quotes aren't arriving" is usually an unverified
 *              DNS record. The carve-out is an argument the READ opts into
 *              rather than a line inside the shared gate, so a write cannot
 *              acquire it by editing one place: POST (registers a domain at
 *              Resend), PATCH and DELETE all call requireAdmin(request) with no
 *              options and stay closed to impersonation.
 */
async function requireAdmin(request, { read = false } = {}) {
  // memberOrRefusalPlain, not getCurrentMember: this helper's callers turn a
  // returned { error, status } into the response themselves, and the gates
  // inside getCurrentMember THROW. A locked-for-non-payment company hitting
  // this got a 500 with an empty body instead of the 402 that names the
  // billing screen. The plain variant is exactly for helpers shaped like this.
  const { member, refusal } = await memberOrRefusalPlain(request);
  if (refusal) return refusal;
  if (read && member.impersonation) return { member };
  try {
    requirePermission(member.role, "user:manage");
  } catch {
    return {
      error: "Only owners/admins can manage the sending domain",
      status: 403,
    };
  }
  return { member };
}

export async function GET(request) {
  const { member, error, status } = await requireAdmin(request, { read: true });
  if (error) return NextResponse.json({ error }, { status });

  const company = await db.company.findUnique({
    where: { id: member.companyId },
    select: SELECT,
  });

  // domainPrefill: the company email's own domain when it can be sent as,
  // else the website from signup turned into a send. subdomain
  // (lib/email/senderSuggestion.js says when each declines). The raw website
  // stays out of the response: the form needs the proposal only.
  return NextResponse.json(await viewOf(company, member.companyId));
}

// POST { domain } to register a new one, or POST {} to re-check the existing
// domain's verification state.
export async function POST(request) {
  const { member, error, status } = await requireAdmin(request);
  if (error) return NextResponse.json({ error }, { status });

  const company = await db.company.findUnique({
    where: { id: member.companyId },
    select: SELECT,
  });

  const body = await request.json().catch(() => ({}));
  const requested = String(body.domain || "").trim().toLowerCase();

  try {
    // ── Re-check an already-registered domain ──────────────────────────
    if (!requested) {
      if (!company?.emailDomainId) {
        return NextResponse.json(
          { error: "No domain has been set up yet." },
          { status: 400 },
        );
      }
      const result = await verifyDomain(company.emailDomainId);
      const updated = await db.company.update({
        where: { id: member.companyId },
        data: {
          emailDomainStatus: normalizeStatus(result.status),
          emailDomainRecords: result.records,
          emailDomainCheckedAt: new Date(),
        },
        select: SELECT,
      });
      return NextResponse.json(await viewOf(updated, member.companyId));
    }

    // ── Register a new domain ──────────────────────────────────────────
    if (!isPlausibleDomain(requested)) {
      return NextResponse.json(
        {
          error:
            "That doesn't look like a domain. Use something like send.yourcompany.com (no @, no https://).",
        },
        { status: 400 },
      );
    }

    // ── FieldQuo's own domain is not adoptable ─────────────────────────
    //
    // getPlatformFrom() DEFINES FieldQuo's sending domain as "a verified
    // Resend domain that no Company row claims". fieldquo.com is exactly that,
    // so the heldByAnother guard below — which only refuses domains ANOTHER
    // Company holds — waved it straight through: a tenant POSTed fieldquo.com,
    // adopted the platform's own verified domain, and every FieldQuo platform
    // email (invites, billing, password resets) fell back to the Resend
    // sandbox for everyone. Same security shape as RESERVED_SUBDOMAINS in
    // lib/site/subdomain.js — the platform's own name is a boundary, not a
    // first-come-first-served handle. Its subdomains are reserved too, so a
    // tenant can't verify send.fieldquo.com and send as us either.
    if (isPlatformEmailDomain(requested)) {
      return NextResponse.json(
        {
          error:
            "That domain belongs to FieldQuo and can't be used as your sending domain. Use your own company's domain, like send.yourcompany.com.",
        },
        { status: 409 },
      );
    }

    // ── Register the new one BEFORE removing the old one ────────────────
    //
    // This used to delete first, "so we don't leave orphaned domains
    // accumulating on the Resend account" — a housekeeping reason, paid for
    // with the company's ability to send mail.
    //
    // Everything below this point can fail: createDomain can throw, and the
    // heldByAnother branch deliberately returns a 409. On either path the old
    // registration was already gone, while Company.emailDomainStatus still
    // said "verified" and Company.emailDomainId still pointed at it. So
    // lib/email/resend.js kept building quotes@theirdomain.com as the From
    // line for every client email, with nothing behind it — and this screen
    // kept showing the green Verified badge, because the row was untouched.
    //
    // Registering first means a failure leaves the working state exactly as
    // it was. The old registration is cleaned up after the row has been
    // repointed, and only when it is genuinely a different one — adopting an
    // existing registration returns the SAME id, and deleting that would undo
    // the write two lines above it.
    const previousDomainId = company?.emailDomainId || null;

    let created;
    try {
      created = await createDomain(requested);
    } catch (err) {
      // "Already registered" is not really a failure — it's Resend telling us
      // the domain exists on the account, which is a state we can adopt. This
      // is the ONLY path out of the contradiction users hit: the screen saying
      // the domain is registered while also saying nothing is connected.
      if (!/already/i.test(err.message || "")) throw err;

      const existing = await findDomainByName(requested);
      if (!existing) {
        // Resend says it exists but won't show it to us. Nothing to adopt.
        throw err;
      }

      // ── The guard that makes adoption safe ────────────────────────────
      // Resend has no tenants: adopting a domain blindly would let company B
      // claim a domain company A verified, and then send mail as them. Only
      // adopt a registration that no other company on this platform holds.
      const heldByAnother = await db.company.findFirst({
        where: {
          emailDomainId: existing.id,
          NOT: { id: member.companyId },
        },
        select: { id: true },
      });

      if (heldByAnother) {
        return NextResponse.json(
          {
            error: `${requested} is already connected to another account on FieldQuo. Get in touch if you believe this domain is yours.`,
          },
          { status: 409 },
        );
      }

      created = existing;
    }

    const updated = await db.company.update({
      where: { id: member.companyId },
      data: {
        emailDomain: created.name,
        emailDomainId: created.id,
        emailDomainStatus: normalizeStatus(created.status),
        emailDomainRecords: created.records,
        emailDomainCheckedAt: new Date(),
        emailFromLocal: company?.emailFromLocal || "quotes",
      },
      select: SELECT,
    });

    // Only now, and only if it is genuinely a different registration. Best
    // effort: an orphan left on the Resend account is untidy, and a company
    // unable to send is not — so a failure here must not undo the row above.
    // …and NEVER when the previous registration is FieldQuo's own domain. A
    // tenant row can point at fieldquo.com (the QA night's adoption did, and
    // the read side was guarded on 2026-09-06 while this write side was not),
    // and "tidy up the old registration" would then be Resend deleting the
    // platform sender for every company. The row is repointed; the platform
    // domain is left exactly where it is.
    if (previousDomainId && previousDomainId !== created.id && !isPlatformEmailDomain(company?.emailDomain)) {
      await deleteDomain(previousDomainId).catch(() => {});
    }

    return NextResponse.json(await viewOf(updated, member.companyId), { status: 201 });
  } catch (err) {
    // Surfacing Resend's message verbatim is genuinely useful here — it says
    // things like "domain already exists" that the company can act on.
    return NextResponse.json(
      { error: err.message || "Could not reach Resend." },
      { status: err.status === 422 ? 400 : 502 },
    );
  }
}

// PATCH { emailFromLocal } — the part before the @.
export async function PATCH(request) {
  const { member, error, status } = await requireAdmin(request);
  if (error) return NextResponse.json({ error }, { status });

  const { emailFromLocal } = await request.json().catch(() => ({}));
  const local = String(emailFromLocal || "")
    .trim()
    .toLowerCase();

  // The pattern the page's "Use info@…" suggestion is held to as well, so a
  // suggestion is never one this refuses (lib/email/senderSuggestion.js).
  if (!FROM_LOCAL_PATTERN.test(local)) {
    return NextResponse.json(
      {
        error:
          "Use letters, numbers, dots, dashes or underscores — for example 'quotes' or 'hello'.",
      },
      { status: 400 },
    );
  }

  const updated = await db.company.update({
    where: { id: member.companyId },
    data: { emailFromLocal: local },
    select: SELECT,
  });

  return NextResponse.json(await viewOf(updated, member.companyId));
}

export async function DELETE(request) {
  const { member, error, status } = await requireAdmin(request);
  if (error) return NextResponse.json({ error }, { status });

  const company = await db.company.findUnique({
    where: { id: member.companyId },
    select: SELECT,
  });

  // Best-effort: if Resend already lost it, clearing our side is still the
  // right outcome — otherwise the company is stuck unable to re-add it.
  //
  // But NEVER for FieldQuo's own domain. If a tenant row points at
  // fieldquo.com — the QA night's adoption did, before the adoption route
  // refused it — "remove my sending domain" must un-adopt the row and leave
  // the platform sender standing. Without this line the button was one click
  // from Resend deleting the From address of every company on the platform.
  if (company?.emailDomainId && !isPlatformEmailDomain(company?.emailDomain)) {
    await deleteDomain(company.emailDomainId).catch(() => {});
  }

  const updated = await db.company.update({
    where: { id: member.companyId },
    data: {
      emailDomain: null,
      emailDomainId: null,
      emailDomainStatus: "not_started",
      emailDomainRecords: null,
      emailDomainCheckedAt: null,
    },
    select: SELECT,
  });

  return NextResponse.json(await viewOf(updated, member.companyId));
}
