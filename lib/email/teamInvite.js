// lib/email/teamInvite.js
//
// The one place that builds and sends "you're invited to join X on FieldQuo",
// and the only place that knows whether the send actually happened.
//
// ── Why this file exists ────────────────────────────────────────────────────
//
// An owner invited an employee, the app said the invite was sent, and nothing
// arrived — while referral mail from the same Resend account was being
// delivered the same afternoon. Two separate faults stacked up:
//
// 1. The From address. Every other email in the product resolves its sender:
//    tenant mail through lib/email/companySender.js, FieldQuo's own mail
//    through getPlatformFrom(). The invitation was the last path still
//    letting sendEmail() fall back to its default, which is
//    `EMAIL_FROM || onboarding@resend.dev`. EMAIL_FROM is not set on the
//    deployment, so invitations were posted from Resend's sandbox address —
//    and Resend refuses sandbox mail addressed to anyone but the account
//    owner. A refused send is an API error, not an email, so it never shows
//    up in the Resend dashboard either: the invite looked sent from every
//    angle except the recipient's inbox. getPlatformFrom() asks Resend which
//    domains are verified instead of requiring someone to have typed one into
//    Vercel, which is exactly the failure it was written for.
//
// 2. The failure was unreportable. Better Auth invokes sendInvitationEmail
//    through runInBackgroundOrAwait, which swallows anything the hook throws
//    (node_modules/better-auth/dist/context/create-context.mjs:214), and
//    sendEmail() returns its errors rather than throwing. So the route that
//    created the invitation had no way to find out the mail never went, and
//    answered 201 "invite sent". The outcome is therefore stashed here and
//    taken by the route — see takeInviteEmailOutcome.

import { sendEmail } from "./resend";
import { getPlatformFrom } from "./platformSender";
import { inviteEmailHTML } from "./inviteEmail";
import { getAppOrigin } from "@/lib/appUrl";

// ── Outcome hand-off ────────────────────────────────────────────────────────
//
// A module-level map rather than a return value because the send is triggered
// by Better Auth from inside auth.api.createInvitation(), not by the route.
// It is safe to read straight afterwards: no `advanced.backgroundTasks.handler`
// is configured in lib/auth.js, so runInBackgroundOrAwait AWAITS the hook —
// by the time createInvitation resolves, the entry is written. The key is
// org + email, and the duplicate guards in both invite routes already refuse a
// second in-flight invitation for the same pair, so two concurrent requests
// can't collide on one key.
const outcomes = new Map();
const OUTCOME_TTL_MS = 60_000;

const outcomeKey = (organizationId, email) =>
  `${organizationId || "?"}:${String(email || "").trim().toLowerCase()}`;

function recordOutcome(organizationId, email, outcome) {
  const now = Date.now();
  // Entries are normally removed on read. Sweep anyway: a caller that never
  // reads (Better Auth's own /api/auth/organization/invite-member endpoint)
  // would otherwise leak one entry per invite for the life of the process.
  for (const [k, v] of outcomes) {
    if (now - v.at > OUTCOME_TTL_MS) outcomes.delete(k);
  }
  outcomes.set(outcomeKey(organizationId, email), { ...outcome, at: now });
}

/**
 * Reads and clears the send outcome for an invitation just created.
 *
 * @returns {{ sent: boolean, error?: string, id?: string|null }}
 *
 * A missing entry means the hook never ran — which is itself a fault worth
 * reporting rather than defaulting to "sent". Silence is not success; that
 * assumption is what hid this bug in the first place.
 */
export function takeInviteEmailOutcome(organizationId, email) {
  const key = outcomeKey(organizationId, email);
  const found = outcomes.get(key);
  outcomes.delete(key);
  if (found) return { sent: found.sent, error: found.error, id: found.id };
  return {
    sent: false,
    error:
      "The invitation was created but no email was attempted. Cancel it on the Team page and try again.",
  };
}

/**
 * Sends one invitation email. Never throws — the caller (Better Auth) would
 * swallow it anyway; the outcome is recorded instead.
 */
export async function sendTeamInviteEmail({
  invitationId,
  email,
  organizationId,
  orgName,
  inviterName,
  role,
  request,
}) {
  const outcome = await deliver({
    invitationId,
    email,
    orgName,
    inviterName,
    role,
    request,
  });
  recordOutcome(organizationId, email, outcome);
  return outcome;
}

async function deliver({
  invitationId,
  email,
  orgName,
  inviterName,
  role,
  request,
}) {
  if (!invitationId) {
    return { sent: false, error: "The invitation has no id to link to." };
  }

  // A link built from `undefined` is worse than no email — the person clicks
  // it, lands nowhere, and nobody finds out. Refuse the send instead, with a
  // message that names the variable to set. getAppOrigin throws exactly that.
  let origin;
  try {
    origin = getAppOrigin(request);
  } catch (err) {
    return { sent: false, error: err.message };
  }

  const acceptUrl = `${origin}/accept-invitation/${invitationId}`;
  const company = orgName || "the team";
  const inviter = inviterName || "A teammate";

  try {
    const from = await getPlatformFrom();
    const result = await sendEmail({
      from,
      to: email,
      subject: `You're invited to join ${company} on FieldQuo`,
      html: inviteEmailHTML({
        orgName: company,
        inviterName: inviter,
        role,
        acceptUrl,
      }),
      // Plain-text alternative, same reason as every other send in the
      // product: HTML-only mail scores worse with corporate filters, and an
      // invitation in a junk folder is an invitation nobody got.
      text:
        `${inviter} has invited you to join ${company} on FieldQuo.\n\n` +
        `Accept the invitation: ${acceptUrl}\n\n` +
        `If you weren't expecting this, you can ignore this email.`,
    });

    if (result?.error) {
      // sendEmail has already written this to the platform error log.
      const message =
        typeof result.error === "string"
          ? result.error
          : result.error?.message || "Resend rejected the message.";
      return { sent: false, error: `Email provider refused the send: ${message}` };
    }
    if (result?.skipped) {
      return {
        sent: false,
        error:
          "Email isn't configured on this deployment (RESEND_API_KEY is missing), so no invitation was sent.",
      };
    }
    return { sent: true, id: result?.id || null };
  } catch (err) {
    return {
      sent: false,
      error: err?.message || "The invitation email could not be sent.",
    };
  }
}
