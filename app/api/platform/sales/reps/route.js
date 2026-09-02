// app/api/platform/sales/reps/route.js
//
// FieldQuo's own sales reps: the list, and adding one by invitation.
//
// ══ Superadmin only, and stated rather than assumed ═══════════════════════
//
// Hiring FieldQuo staff is not a support task. This follows POST
// /api/platform/admins' own bar (`admin.role !== "superadmin"` → 403) rather
// than canPlatform(), because there is no sales permission in
// PLATFORM_PERMISSIONS and adding one would imply the permission map has a
// scoping concept it does not have — see docs/sales/RESEARCH-auth-rbac.md §1 on
// why SALES_REP is deliberately NOT a fourth row in that table.
//
// ══ Why this route establishes a new pattern rather than copying one ══════
//
// POST /api/platform/admins creates FieldQuo staff by having a superadmin type
// the new person's password server-side and hand it over out of band. That
// means the credential briefly exists in two heads and travels through whatever
// channel was handy. This route does what the owner asked for instead — "add
// the salespeople the same way a company adds an employee" — an emailed link,
// a password only the invitee ever knows, and acceptedAt stamped when they use
// it. lib/sales/invite.js's header records why none of the tenant invite
// machinery could be reused to do it.
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentPlatformAdmin } from "@/lib/platform/currentPlatformAdmin";
import {
  codeFromName,
  inviteExpiry,
  isValidCode,
  newInviteToken,
} from "@/lib/sales/invite";
import { sendSalesInviteEmail } from "@/lib/sales/inviteEmail";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

async function superadminOrRefusal(request) {
  const admin = await getCurrentPlatformAdmin(request);
  if (!admin) {
    return { admin: null, refusal: { status: 401, body: { error: "Unauthorized" } } };
  }
  if (admin.role !== "superadmin") {
    return {
      admin: null,
      refusal: {
        status: 403,
        body: { error: "Only superadmins can manage the sales team" },
      },
    };
  }
  return { admin, refusal: null };
}

export async function GET(request) {
  const { refusal } = await superadminOrRefusal(request);
  if (refusal) return NextResponse.json(refusal.body, { status: refusal.status });

  const reps = await db.salesRep.findMany({
    select: {
      id: true,
      name: true,
      email: true,
      code: true,
      active: true,
      invitedAt: true,
      acceptedAt: true,
      endedAt: true,
      inviteExpiresAt: true,
      // The count is what makes "deactivate, never delete" legible on the
      // screen: a rep with attributions has history that stops being reachable
      // if the row goes.
      _count: { select: { attributions: true } },
    },
    orderBy: [{ active: "desc" }, { name: "asc" }],
  });

  return NextResponse.json(
    reps.map((r) => ({
      id: r.id,
      name: r.name,
      email: r.email,
      code: r.code,
      active: r.active,
      invitedAt: r.invitedAt,
      acceptedAt: r.acceptedAt,
      endedAt: r.endedAt,
      inviteExpiresAt: r.inviteExpiresAt,
      companyCount: r._count.attributions,
    })),
  );
}

export async function POST(request) {
  const { admin, refusal } = await superadminOrRefusal(request);
  if (refusal) return NextResponse.json(refusal.body, { status: refusal.status });

  const body = await request.json().catch(() => ({}));
  const name = String(body.name || "").trim();
  const email = String(body.email || "").toLowerCase().trim();
  const wantedCode = String(body.code || "").toLowerCase().trim();

  if (!name || !email) {
    return NextResponse.json(
      { error: "A name and an email address are required" },
      { status: 400 },
    );
  }
  if (!EMAIL_RE.test(email)) {
    return NextResponse.json(
      { error: "That doesn't look like an email address" },
      { status: 400 },
    );
  }
  if (wantedCode && !isValidCode(wantedCode)) {
    return NextResponse.json(
      {
        error:
          "A code is lowercase letters, numbers and hyphens, 2–31 characters — it ends up in a link somebody reads off a card.",
      },
      { status: 400 },
    );
  }

  const existing = await db.salesRep.findUnique({ where: { email } });
  if (existing) {
    return NextResponse.json(
      { error: "A sales rep with that email already exists" },
      { status: 409 },
    );
  }

  // The code is @unique. Rather than a read-then-write that two concurrent
  // superadmins can both walk through, this lets the constraint decide and
  // retries with a suffix — the same reasoning lib/voice/credits.js gives for
  // preferring an index over a check.
  const base = wantedCode || codeFromName(name);
  const { token, hash } = newInviteToken();

  let rep = null;
  let lastError = null;
  for (let attempt = 0; attempt < 5 && !rep; attempt++) {
    const code = attempt === 0 ? base : `${base}-${attempt + 1}`;
    try {
      rep = await db.salesRep.create({
        data: {
          name,
          email,
          code,
          inviteTokenHash: hash,
          inviteExpiresAt: inviteExpiry(),
        },
        select: { id: true, name: true, email: true, code: true, active: true },
      });
    } catch (err) {
      lastError = err;
      // P2002 is a unique-constraint collision. Any other failure is not
      // something a different code would fix, so it stops here rather than
      // retrying four more times into the same wall.
      if (err?.code !== "P2002") break;
      // A collision on `email` cannot be fixed by a suffix either — but the
      // findUnique above already answered that, so a P2002 at this point is a
      // code race. If it turns out to be the email after all, the loop exits
      // on the last attempt and the error is reported.
      if (wantedCode) break;
    }
  }

  if (!rep) {
    const taken =
      lastError?.code === "P2002"
        ? "That code is already taken — choose another."
        : "Couldn't create the sales rep.";
    return NextResponse.json({ error: taken }, { status: 409 });
  }

  // The send outcome is reported, never assumed. lib/email/teamInvite.js's
  // header is the story of an invite that looked sent from every angle except
  // the recipient's inbox; the rep row exists either way, and the screen offers
  // "Resend invite" rather than a green tick over nothing.
  // getCurrentPlatformAdmin returns { id, role } off the JWT and no address, so
  // the inviter's email is looked up rather than left out: "somebody at
  // FieldQuo added you" with no name attached is exactly the shape of email
  // people delete.
  const inviter = await db.platformAdmin.findUnique({
    where: { id: admin.id },
    select: { email: true },
  });

  const outcome = await sendSalesInviteEmail({
    request,
    to: rep.email,
    name: rep.name,
    token,
    inviterEmail: inviter?.email,
  });

  await db.platformAuditLog.create({
    data: {
      platformAdminId: admin.id,
      action: "sales_rep_invited",
      details: {
        salesRepId: rep.id,
        email: rep.email,
        code: rep.code,
        emailSent: outcome.sent,
        ...(outcome.error ? { emailError: outcome.error } : {}),
      },
    },
  });

  return NextResponse.json(
    { ...rep, invite: { sent: outcome.sent, error: outcome.error || null } },
    { status: 201 },
  );
}
