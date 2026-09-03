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
import { getAppOrigin } from "@/lib/appUrl";
import { inviteExpiry, newInviteToken } from "@/lib/sales/invite";
import { sendSalesInviteEmail } from "@/lib/sales/inviteEmail";
import {
  NUMBER_CAPABILITIES,
  codeCandidates,
  codeProblem,
  normaliseWorkEmail,
  salesNumberState,
  workEmailProblem,
} from "@/lib/sales/repAdmin";
import { signupLinkFor } from "@/lib/sales/repStats";
import { outreachStatus } from "@/lib/sales/outreachSender";

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
      // The mailbox they SEND from. Returned so the screen can show whether one
      // exists AND offer to set it — it had neither before, which made
      // SalesRep.workEmail a column with no way to fill it while
      // lib/sales/outreachSender.js refused every send for want of it.
      workEmail: true,
      code: true,
      active: true,
      invitedAt: true,
      acceptedAt: true,
      endedAt: true,
      inviteExpiresAt: true,
      commissionPlanId: true,
      commissionPlan: { select: { id: true, name: true } },
      // The count is what makes "deactivate, never delete" legible on the
      // screen: a rep with attributions has history that stops being reachable
      // if the row goes.
      _count: { select: { attributions: true } },
    },
    orderBy: [{ active: "desc" }, { name: "asc" }],
  });

  const origin = getAppOrigin(request);

  // ── Whether each rep can actually send, from the SAME function the rep's
  //    own portal asks ─────────────────────────────────────────────────────
  //
  // outreachStatus() and not a local "does workEmail exist" test. Two opinions
  // about whether sending works is how a console reports a rep as ready while
  // their compose box refuses to render — the admin would then be looking at a
  // green tick and the rep at a blocker, and the rep would be right. The
  // verified-domain lookup behind it is cached for ten minutes across all reps,
  // so this is one Resend call per page load, not one per rep.
  const sending = await Promise.all(
    reps.map((r) =>
      outreachStatus(r).catch((err) => ({
        canSend: false,
        blockers: [
          {
            code: "status_unavailable",
            title: "Couldn't work out whether this rep can send.",
            fix: `Reading the sending configuration failed: ${err?.message || "no reason given"}. Nothing has changed.`,
          },
        ],
        warnings: [],
      })),
    ),
  );

  // FieldQuo's own sales texting number — one, shared, not per rep. See
  // NUMBER_CAPABILITIES for why there is no per-rep picker beside it.
  let salesNumber;
  try {
    const row = await db.platformSmsNumber.findFirst({
      where: { purpose: "sales", active: true },
      orderBy: { createdAt: "asc" },
      select: { e164: true },
    });
    salesNumber = salesNumberState({ e164: row?.e164 || null });
  } catch {
    // "Could not look" is a third state, distinct from "holds none" — reporting
    // a failed query as an empty table would tell a superadmin to go and buy a
    // number they may already own.
    salesNumber = salesNumberState({ lookupFailed: true });
  }

  return NextResponse.json({
    reps: reps.map((r, i) => ({
      id: r.id,
      name: r.name,
      email: r.email,
      workEmail: r.workEmail,
      code: r.code,
      // Built from this deployment's own origin, so a preview hands out a
      // preview link instead of quietly pointing testers at production.
      signupLink: signupLinkFor(origin, r.code),
      active: r.active,
      invitedAt: r.invitedAt,
      acceptedAt: r.acceptedAt,
      endedAt: r.endedAt,
      inviteExpiresAt: r.inviteExpiresAt,
      commissionPlan: r.commissionPlan ? r.commissionPlan.name : null,
      companyCount: r._count.attributions,
      sending: {
        canSend: sending[i].canSend,
        blockers: sending[i].blockers,
        warnings: sending[i].warnings,
      },
    })),
    salesNumber,
    numberCapabilities: NUMBER_CAPABILITIES,
  });
}

export async function POST(request) {
  const { admin, refusal } = await superadminOrRefusal(request);
  if (refusal) return NextResponse.json(refusal.body, { status: refusal.status });

  const body = await request.json().catch(() => ({}));
  const name = String(body.name || "").trim();
  const email = String(body.email || "").toLowerCase().trim();
  const wantedCode = String(body.code || "").toLowerCase().trim();
  // Optional at creation, and that is the sequence of events rather than
  // laxity: a mailbox is bought, so the owner adds a rep on Monday and the
  // inbox exists on Thursday. What must not happen is the gap being silent —
  // outreachStatus() blocks every send while it is absent and the screen says
  // so in those words.
  const workEmail = normaliseWorkEmail(body.workEmail);

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
  // Both problems come from lib/sales/repAdmin.js so the sentence the field
  // goes red with on the screen is literally the sentence the server refuses
  // with. A field validated twice with two wordings is two rules pretending to
  // be one.
  const badCode = codeProblem(wantedCode);
  if (badCode) return NextResponse.json({ error: badCode }, { status: 400 });

  const badMailbox = workEmailProblem(workEmail, email);
  if (badMailbox) return NextResponse.json({ error: badMailbox }, { status: 400 });

  const existing = await db.salesRep.findUnique({ where: { email } });
  if (existing) {
    return NextResponse.json(
      { error: "A sales rep with that email already exists" },
      { status: 409 },
    );
  }

  if (workEmail) {
    // @unique, and a collision here is not a race worth retrying past: two reps
    // sharing an outbound mailbox means either one's replies land in a thread
    // attributed to the other.
    const mailboxTaken = await db.salesRep.findUnique({ where: { workEmail } });
    if (mailboxTaken) {
      return NextResponse.json(
        { error: `${workEmail} is already another rep's work mailbox.` },
        { status: 409 },
      );
    }
  }

  // The code is @unique. Rather than a read-then-write that two concurrent
  // superadmins can both walk through, this lets the constraint decide and
  // retries with a suffix — the same reasoning lib/voice/credits.js gives for
  // preferring an index over a check.
  //
  // The candidate sequence comes from lib/sales/repAdmin.js because the SCREEN
  // uses the same function to prefill the field. Two implementations of "what
  // is the next free code" would show the admin `dana-2` and store `dana-3`,
  // and the difference would be invisible until somebody printed a card.
  const candidates = wantedCode ? [wantedCode] : codeCandidates(name);
  const { token, hash } = newInviteToken();

  let rep = null;
  let lastError = null;
  for (const code of candidates) {
    if (rep) break;
    try {
      rep = await db.salesRep.create({
        data: {
          name,
          email,
          workEmail,
          code,
          inviteTokenHash: hash,
          inviteExpiresAt: inviteExpiry(),
        },
        select: {
          id: true,
          name: true,
          email: true,
          workEmail: true,
          code: true,
          active: true,
        },
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
    // `meta.target` names the constraint that fired. Reporting "that code is
    // taken" over a work-mailbox collision would send a superadmin to change
    // the wrong field, which is the sort of wrong-but-plausible error message
    // that costs ten minutes every time.
    const target = String(lastError?.meta?.target || "");
    const taken =
      lastError?.code !== "P2002"
        ? "Couldn't create the sales rep."
        : target.includes("workEmail")
          ? "That work mailbox is already assigned to another rep."
          : "That code is already taken — choose another.";
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
        // Recorded because it decides who a prospect ends up talking to, and
        // because "who assigned this mailbox" is the question asked after a
        // reply lands in the wrong inbox.
        workEmail: rep.workEmail || null,
        codeSource: wantedCode ? "chosen_by_admin" : "generated",
        emailSent: outcome.sent,
        ...(outcome.error ? { emailError: outcome.error } : {}),
      },
    },
  });

  return NextResponse.json(
    {
      ...rep,
      // Returned with the row so the screen can show the link the moment the
      // rep exists, rather than after a refetch — the link IS the rep's job.
      signupLink: signupLinkFor(getAppOrigin(request), rep.code),
      invite: { sent: outcome.sent, error: outcome.error || null },
    },
    { status: 201 },
  );
}
