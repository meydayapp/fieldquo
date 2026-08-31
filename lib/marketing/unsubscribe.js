// lib/marketing/unsubscribe.js
//
// CASL (and CAN-SPAM) require every COMMERCIAL electronic message to carry a
// working, one-click, no-login unsubscribe mechanism. Company.subscribed on
// MarketingSubscriber already existed and was already checked before a send —
// the missing half was a public route anyone could reach FROM the email
// itself, with no session. This is that half.
//
// ══ Which of FieldQuo's emails are "commercial"? ═══════════════════════════
//
// CASL's definition is broad — any message that "encourages participation in
// a commercial activity" — but it carves out messages that facilitate,
// confirm or complete a transaction the recipient already asked for. Applying
// that here:
//
//   COMMERCIAL (this file's link goes on these):
//     - marketing campaign sends (app/api/marketing/campaigns/[id]/send) —
//       a promotional blast by definition.
//     - review requests (lib/reviews/reviewEmail.js via cron/review-requests)
//       — asking a past customer to promote the business publicly is outreach
//       ON BEHALF OF the business's reputation, not a message they need to
//       receive to complete something already in motion. The task brief that
//       commissioned this file says it plainly too: a missing unsubscribe on
//       a review request is the violation, not an edge case.
//     - "job completed" follow-ups (FollowUpRule.triggerEvent ===
//       "job_completed", sent by cron/follow-ups) — its own TRIGGER_META
//       description says what this is for verbatim: "e.g. a thank-you /
//       review request." The job is finished; there is no pending decision
//       left to facilitate. This is discretionary post-service outreach with
//       staff-authored content, i.e. the same category as a review request,
//       just sent through the customisable template path instead of the
//       fixed one.
//
//   TRANSACTIONAL (no link, and MUST NOT get one — CASL doesn't require it
//   and a stray unsubscribe on a message like this is its own defect: it
//   invites someone to switch off mail they need):
//     - a sent quote or invoice — the document they asked for.
//     - "quote sent, no response" / "invoice overdue" follow-ups — both are
//       about a specific quote or bill the recipient is already IN a
//       transaction with; CASL's transaction-facilitation carve-out is built
//       for exactly this.
//     - self-quote / instant-quote / demo-booking confirmations — direct
//       responses to something the recipient just submitted.
//     - password reset, email verification, team invites — account/security
//       mail, not marketing to a customer at all.
//     - Stripe/billing notices to a CONTRACTOR about their own FieldQuo
//       subscription — B2B account admin, not client-facing marketing.
//
// scripts/check-consent-mechanisms.mjs executes the real template builders
// and asserts this split holds: every commercial one contains the link,
// every transactional one doesn't.
//
// ══ The token follows Client.portalToken's shape on purpose ════════════════
//
// Same reasoning lib/clientPortal.js already wrote down: 32 bytes of CSPRNG
// output, unique per ROW rather than derived from the email address, so a
// token can resolve to exactly one company's subscriber. Deriving it from
// (companyId, email) with a secret would also "work", but would mean a leaked
// secret unsubscribes every customer of every company at once instead of one
// row — the stored-random-token shape is the one where a compromise is
// bounded to whatever leaked.
//
// ══ Not every recipient of a commercial email is already a "subscriber" ════
//
// MarketingSubscriber rows are created explicitly (manual add, client import)
// or implicitly the first time someone is emailed something commercial. A
// review-request recipient usually has no row at all — the cron only reads
// one to check for a PRIOR unsubscribe. ensureSubscriber() is what every
// commercial send path calls first: it upserts a row (creating one with
// subscribed: true if there wasn't one) and guarantees it carries a token,
// so "the link goes in every commercial message" is actually true rather
// than true-for-people-already-on-a-list.

import { randomBytes } from "crypto";
import { getAppOrigin } from "@/lib/appUrl";
import { escapeAttr, escapeHtml } from "@/lib/email/emailTheme";

/** 32 bytes of CSPRNG output, base64url — same construction as newPortalToken. */
export function newUnsubscribeToken() {
  return randomBytes(32).toString("base64url");
}

export function unsubscribeUrl(token, request) {
  return `${getAppOrigin(request)}/unsubscribe/${token}`;
}

/**
 * The exact copy shown on the unsubscribe page's confirm button, per
 * company. Stored verbatim on the row when someone clicks it — the same
 * "the defence is what they actually saw" reasoning as CallConsent.disclosure,
 * applied to the other end of the relationship. A function rather than a
 * template string embedded at the call site, so the page and the stored
 * record can never drift onto different wording.
 */
export function unsubscribeDisclosureText(companyName) {
  const name = String(companyName || "this company").trim() || "this company";
  return (
    `Unsubscribe from marketing emails from ${name}. ` +
    `You may still receive quotes, invoices, receipts and other messages ` +
    `about work you've requested — this only stops promotional email.`
  );
}

/**
 * Ensure a MarketingSubscriber row exists for (companyId, email) and carries
 * an unsubscribeToken, creating or backfilling either as needed.
 *
 * Idempotent, same shape as ensurePortalToken: an existing row keeps its
 * state (in particular, a prior unsubscribe is never overwritten back to
 * subscribed: true just because we're about to email them again — that
 * would silently undo the thing this whole feature exists to make durable).
 */
export async function ensureSubscriber(db, { companyId, email, name, phone, address, source = "manual" }) {
  const cleanEmail = String(email || "").trim().toLowerCase();
  if (!companyId || !cleanEmail) return null;

  const existing = await db.marketingSubscriber.findUnique({
    where: { companyId_email: { companyId, email: cleanEmail } },
  });

  if (existing) {
    if (existing.unsubscribeToken) return existing;
    // Backfill: a row created before this feature shipped, or by
    // /import-clients, /subscribers (manual add) — neither mints a token
    // because neither sends anything at creation time.
    return db.marketingSubscriber.update({
      where: { id: existing.id },
      data: { unsubscribeToken: newUnsubscribeToken() },
    });
  }

  return db.marketingSubscriber.create({
    data: {
      companyId,
      email: cleanEmail,
      name: name || null,
      phone: phone || null,
      address: address || null,
      source,
      unsubscribeToken: newUnsubscribeToken(),
    },
  });
}

/**
 * Backfill a token onto an ALREADY-LOADED MarketingSubscriber row.
 *
 * For a send path that queries its recipient list directly (the campaign
 * sender pulls every `subscribed: true` row) rather than going through
 * ensureSubscriber — re-running ensureSubscriber per recipient there would
 * mean one extra `findUnique` per row on top of the `findMany` that already
 * loaded it. This just tops up the one row it's handed.
 */
export async function ensureSubscriberToken(db, subscriber) {
  if (subscriber.unsubscribeToken) return subscriber.unsubscribeToken;
  const token = newUnsubscribeToken();
  await db.marketingSubscriber.update({
    where: { id: subscriber.id },
    data: { unsubscribeToken: token },
  });
  return token;
}

/** Has this email actively unsubscribed from this company's mail? */
export async function isUnsubscribed(db, companyId, email) {
  const cleanEmail = String(email || "").trim().toLowerCase();
  if (!companyId || !cleanEmail) return false;
  const sub = await db.marketingSubscriber.findUnique({
    where: { companyId_email: { companyId, email: cleanEmail } },
    select: { subscribed: true },
  });
  return sub?.subscribed === false;
}

/**
 * The pure decision behind the unsubscribe POST: given the row (a plain
 * object — id/subscribed/unsubscribedAt are all it needs) and the disclosure
 * text the page showed, what to write.
 *
 * Split out from the route for the same reason lib/reviews/request.js splits
 * shouldRequestReview from the cron that calls it: this is the part with
 * rules worth running against hostile/edge input without a database, and it
 * is what scripts/check-consent-mechanisms.mjs executes directly.
 *
 * Rules:
 *   - subscribed always becomes false. Never true — this function has no
 *     "resubscribe" mode; that only happens by a company re-adding someone.
 *   - unsubscribedAt is set ONCE. A second click (a client double-tapping,
 *     or a mail scanner that follows a POST — unlikely, but the same
 *     philosophy as reviewRequestedAt/portalToken: idempotent claims don't
 *     move a timestamp that's already true) keeps the original moment.
 *   - unsubscribeDisclosure is likewise set once, so a copy edit made next
 *     month can't retroactively rewrite what an EARLIER unsubscriber saw.
 *   - Nothing here ever produces a delete. The row, the email address, the
 *     history — all kept. Only `subscribed` moves.
 */
export function applyUnsubscribe({ subscriber, disclosure, now = new Date() }) {
  if (!subscriber) return null;
  const alreadyUnsubscribed = subscriber.subscribed === false;
  return {
    alreadyUnsubscribed,
    data: {
      subscribed: false,
      unsubscribedAt: alreadyUnsubscribed && subscriber.unsubscribedAt ? subscriber.unsubscribedAt : now,
      unsubscribeDisclosure:
        alreadyUnsubscribed && subscriber.unsubscribeDisclosure
          ? subscriber.unsubscribeDisclosure
          : disclosure,
    },
  };
}

/**
 * RFC 8058 one-click headers. Gmail, Yahoo and other major mailbox providers
 * render their OWN "Unsubscribe" chip next to the sender when a message
 * carries these — a true zero-render-page unsubscribe that is the actual
 * current bar for a "commercial sender in good standing", on top of the
 * visible in-body link CASL asks for. List-Unsubscribe-Post tells the mail
 * provider it may POST with no user interaction beyond their own click, so
 * the endpoint this points at (app/api/unsubscribe/[token]/route.js POST)
 * must be — and is — safe to call with no session and no confirmation step.
 */
export function unsubscribeHeaders({ token, request }) {
  const url = unsubscribeUrl(token, request);
  return {
    "List-Unsubscribe": `<${url}>`,
    "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
  };
}

/**
 * The visible footer link for an email BUILT ON renderTemplateSections'
 * shell (marketing campaigns, follow-ups). Matches that shell's existing
 * footer styling (theme.muted on theme.bg) rather than inventing a new
 * colour pair — that pairing is already in use elsewhere in the same footer,
 * so reusing it carries forward whatever contrast guarantee it already has.
 */
export function unsubscribeFooterRow({ token, request, theme }) {
  const url = unsubscribeUrl(token, request);
  return `<tr><td style="background:${theme.bg};border-top:1px solid ${theme.border};padding:14px 30px 20px;font-size:11px;line-height:1.6;color:${theme.muted};">You're receiving this because you're a customer of ${escapeHtml(theme.companyName || "this company")}. <a href="${escapeAttr(url)}" style="color:${theme.muted};text-decoration:underline;">Unsubscribe</a> from marketing email.</td></tr>`;
}

/**
 * The visible footer line for lib/reviews/reviewEmail.js's bespoke (non-shell)
 * markup — a plain div-based card, not the table shell above, so it needs its
 * own small block. Uses #6b7280, the SAME grey that file's other footnote
 * paragraph already renders on the same white card — not a lighter one: a
 * lighter "quieter" grey here measures 2.54:1 on white (checked, not
 * assumed — see AGENTS.md), well under 4.5:1, and would make an unsubscribe
 * link CASL requires be visible harder to read than the rest of the email.
 */
export function unsubscribeFooterHtml({ token, request, companyName }) {
  const url = unsubscribeUrl(token, request);
  return `<p style="margin:10px 0 0;font-size:12px;line-height:1.5;color:#6b7280;">You're receiving this because ${escapeHtml(companyName || "this company")} did work for you. <a href="${escapeAttr(url)}" style="color:#6b7280;text-decoration:underline;">Unsubscribe</a> from these emails.</p>`;
}
