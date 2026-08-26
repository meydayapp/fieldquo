// lib/auth.js
import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { organization, twoFactor } from "better-auth/plugins";
import { nextCookies } from "better-auth/next-js";

import { db } from "./db";
import { sendTeamInviteEmail } from "./email/teamInvite";
import { resetPasswordEmail, verifyEmail } from "./email/authEmails";
import { sendEmail } from "./email/resend";
import { getPlatformFrom } from "./email/platformSender";
import { recordError, errorDetail } from "./platform/errorLog";
import { resolveUserLanguage } from "./i18n/resolveLanguage";

// How long each emailed link lives.
//
// Set explicitly rather than left to Better Auth's defaults because the email
// SAYS the number out loud: authEmails.js takes `expiresMinutes` and renders
// "It expires in 1 hour". Nothing else knows the real figure, so the option and
// the sentence have to come from one constant — a security email that states
// the wrong expiry is worse than one that states none.
//
// An hour for a reset (it is a live credential sitting in an inbox) and a day
// for a verification (it proves an address, grants nothing, and a contractor
// who reads their mail in the evening should not have to ask for a second one).
const RESET_LINK_MINUTES = 60;
const VERIFY_LINK_MINUTES = 60 * 24;

// Where Better Auth's own link hands the reader over to a FieldQuo page.
//
// Both emailed links point at the auth API first, on purpose: those endpoints
// check the token and then redirect to the page with `?token=…`, or with
// `?error=TOKEN_EXPIRED` if it has run out. Linking the page directly would
// skip that check and the reader would only learn the link was stale AFTER
// typing a new password.
const RESET_PAGE = "/reset-password";
const VERIFY_PAGE = "/verify-email";

/**
 * Forces the landing page on a link Better Auth built.
 *
 * Better Auth writes `callbackURL=` (empty) or `callbackURL=%2F` when the
 * caller passed no `redirectTo` — both mean "nobody chose", so both are
 * replaced here. A caller that DID choose is left alone, so a future flow can
 * still send someone back where they started.
 *
 * Never throws: a link we could not parse is passed through untouched, and
 * authEmails.js refuses to send a mail whose button is dead.
 */
function withLandingPage(url, page) {
  try {
    const parsed = new URL(url);
    // `new URL` parses javascript: and data: perfectly happily, and appending a
    // query string to one of those is nonsense. authEmails.js refuses to send
    // them either way; this just declines to dress one up first.
    if (parsed.protocol !== "https:" && parsed.protocol !== "http:") return url;
    const chosen = parsed.searchParams.get("callbackURL");
    if (!chosen || chosen === "/") parsed.searchParams.set("callbackURL", page);
    return parsed.href;
  } catch {
    return url;
  }
}

/**
 * The company and language to write to this person in.
 *
 * Two things Better Auth's `user` cannot tell us. `User.language` is not
 * declared to Better Auth, so it is absent from the object handed to these
 * hooks; and the company is a FieldQuo concept entirely.
 *
 * The company is the EARLIEST active membership. Someone who runs two
 * businesses on one login has two, and the first one is the one they signed up
 * with — the name they will recognise beside a login they are being asked
 * about. It is context in a sentence, never authority: authEmails.js uses it as
 * plain text and nothing about the link depends on it.
 *
 * Never throws. A lookup failure costs the reader a personalised sentence; it
 * must not cost them the reset email, which is the same call teamInvite.js
 * makes about its own language lookup.
 */
async function recipientContext(user) {
  try {
    const row = await db.user.findUnique({
      where: { id: user.id },
      select: {
        language: true,
        memberships: {
          where: { active: true },
          orderBy: { createdAt: "asc" },
          take: 1,
          select: { company: { select: { name: true, defaultLanguage: true } } },
        },
      },
    });
    const company = row?.memberships?.[0]?.company || null;
    return { company, language: resolveUserLanguage(row, company) };
  } catch {
    return { company: null, language: "en" };
  }
}

/**
 * Sends one of the two account emails, and makes sure a failure is visible.
 *
 * ── Why the outcome goes to the error log and not to the caller ─────────────
 *
 * teamInvite.js stashes its outcome for the route to report, because an owner
 * watching an invite go out deserves to be told it didn't. These two are the
 * opposite case: /request-password-reset answers "if this email exists in our
 * system, check your email" WHATEVER happened, deliberately, so that the
 * response cannot be used to test which addresses have FieldQuo accounts.
 * Reporting the send outcome to the browser would hand back exactly the
 * distinction that message exists to hide.
 *
 * So the person is told nothing new and the operator is told everything:
 * recordError() puts it in the platform error log where support already looks.
 * Silence is the one option not on the table — Better Auth calls these through
 * runInBackgroundOrAwait, which catches whatever they throw and writes a line
 * to the console nobody is tailing (context/create-context.mjs:214).
 */
async function sendAccountEmail({ kind, render, user, url, expiresMinutes }) {
  try {
    const { company, language } = await recipientContext(user);

    const { subject, html, text } = render({
      url,
      userName: user?.name,
      language,
      company,
      expiresMinutes,
    });

    // Resolved, never defaulted — the fault teamInvite.js documents at length.
    // sendEmail's own fallback is Resend's sandbox address, which is refused
    // for every recipient but the account owner, so the send fails in a way
    // that shows up nowhere except the missing email.
    const from = await getPlatformFrom();
    const result = await sendEmail({ from, to: user.email, subject, html, text });

    // sendEmail has already recorded a provider rejection. It only warns to the
    // console for a missing key, and "the deployment lost RESEND_API_KEY" is
    // precisely the fault that must not be silent on a password reset.
    if (result?.skipped) {
      await recordError({
        area: "email",
        code: `${kind}_email_skipped`,
        message: `No ${kind} email was sent to ${user.email}: RESEND_API_KEY is not set on this deployment.`,
      });
    }
  } catch (err) {
    await recordError({
      area: "email",
      code: `${kind}_email_failed`,
      message: `The ${kind} email to ${user?.email || "an unknown address"} could not be sent: ${err?.message || "unknown error"}`,
      detail: errorDetail(err, { kind }),
    });
  }
}

export const auth = betterAuth({
  database: prismaAdapter(db, {
    provider: "postgresql",
  }),

  emailAndPassword: {
    enabled: true,

    // ── requireEmailVerification stays OFF, and this is the reasoning ───────
    //
    // Turning it on would break the signup this product is sold through, not
    // merely inconvenience it. Better Auth skips auto sign-in when it is set
    // (api/routes/sign-up.mjs:161-162 — requireEmailVerification forces
    // shouldSkipAutoSignIn), so `signUp.email` returns no session. The very
    // next thing app/signup/page.js does is POST /api/companies to create the
    // company and start the trial, which needs that session. A contractor who
    // has just paid would land on a 401 with their money taken and no company.
    //
    // The cost of leaving it off is real and worth naming: the address on the
    // account is unproven, and that address is the one a password reset is
    // sent to. A typo would hand the reset to whoever owns the typo'd mailbox.
    // Three things bound it. The verification email goes out at signup
    // (sendOnSignUp below), so a wrong address announces itself immediately —
    // while they are still at the keyboard — rather than months later at the
    // worst possible moment. The stranger who receives it is asked to confirm
    // an address, which grants nothing if ignored. And the reset link is
    // one-use and expires in an hour.
    //
    // Blocking sign-in would catch the typo too, and would catch it harder —
    // but it catches it by locking someone out of software they paid for sixty
    // seconds ago, with no way back in, because the only door left needs the
    // mailbox that doesn't exist. Between "unverified but working" and "safe
    // and unusable", this product takes the first and makes the mistake loud.
    requireEmailVerification: false,

    // Must match RESET_LINK_MINUTES: the email prints this number.
    resetPasswordTokenExpiresIn: RESET_LINK_MINUTES * 60,

    // A reset is what someone does when they think their account is not theirs
    // any more. Leaving the old sessions alive would leave whoever they are
    // resetting AGAINST signed in.
    revokeSessionsOnPasswordReset: true,

    async sendResetPassword({ user, url }) {
      await sendAccountEmail({
        kind: "password_reset",
        render: resetPasswordEmail,
        user,
        url: withLandingPage(url, RESET_PAGE),
        expiresMinutes: RESET_LINK_MINUTES,
      });
    },
  },

  emailVerification: {
    // Must match VERIFY_LINK_MINUTES: the email prints this number.
    expiresIn: VERIFY_LINK_MINUTES * 60,

    // Explicit rather than inherited. Left undefined it follows
    // requireEmailVerification, which is false above — so nothing would ever be
    // sent and the whole verification path would be dead code that looks
    // configured.
    sendOnSignUp: true,

    // Deliberately NOT autoSignInAfterVerification. The person is already
    // signed in on the device they signed up from, so it would buy nothing —
    // and it would turn an emailed link into a session-granting one, for a back
    // office holding every client's name and address.

    async sendVerificationEmail({ user, url }) {
      await sendAccountEmail({
        kind: "email_verification",
        render: verifyEmail,
        user,
        url: withLandingPage(url, VERIFY_PAGE),
        expiresMinutes: VERIFY_LINK_MINUTES,
      });
    },
  },

  // ── Rate limiting ──────────────────────────────────────────────────────────
  //
  // Better Auth's defaults, which apply already: enabled in production only,
  // 100 requests / 10s per IP per path, tightened to 3 / 10s on sign-in and
  // sign-up and 3 / 60s on the two paths that send mail
  // (api/rate-limiter/index.mjs, getDefaultSpecialRules).
  //
  // 3 per minute is not enough for an endpoint that mails a THIRD PARTY. The
  // person hit by a reset-request flood never asked for an account and cannot
  // make it stop; 180 messages an hour from one address is a usable harassment
  // tool, and it is FieldQuo's sending reputation that pays for it. Five an
  // hour is past anything a contractor who lost their password would ever do.
  //
  // What this does NOT fix, stated plainly: storage defaults to `memory`, so
  // the counter lives in one serverless instance and every cold start or
  // scale-out begins again at zero — the real ceiling is 5/hour multiplied by
  // however many instances Vercel happens to be running, and an attacker with
  // several IPs is not slowed at all. The fix is a shared counter
  // (`secondaryStorage`, i.e. Redis). `storage: "database"` is NOT that fix:
  // the limiter runs on every request into /api/auth, /get-session included, so
  // it would put a write on Neon behind every session poll in the product.
  // Both are deployment decisions with a bill attached, so they are the owner's
  // to make, not this file's.
  rateLimit: {
    customRules: {
      "/request-password-reset": { window: 3600, max: 5 },
      "/send-verification-email": { window: 3600, max: 5 },
    },
  },

  plugins: [
    organization({
      creatorRole: "owner",

      schema: {
        member: {
          modelName: "OrgMember",
        },
      },

      // Actually deliver the invite. Without this, createInvitation only wrote
      // a DB row and no email ever went out. `data` carries the invitation id,
      // email, role, the organization, and the inviter.
      //
      // The body of it lives in lib/email/teamInvite.js, for two reasons that
      // are documented at length there: the From address has to be RESOLVED
      // (this hook used to let sendEmail fall back to Resend's sandbox
      // address, which silently delivers to nobody), and Better Auth swallows
      // whatever this hook throws — so the outcome has to be left somewhere
      // the API route can pick it up and report.
      async sendInvitationEmail(data, request) {
        await sendTeamInviteEmail({
          invitationId: data.id || data.invitation?.id,
          email: data.email,
          organizationId:
            data.organization?.id || data.invitation?.organizationId,
          orgName: data.organization?.name,
          inviterName: data.inviter?.user?.name || data.inviter?.name,
          role: data.role,
          request,
        });
      },
    }),

    // ── Two-factor authentication: available, never imposed ────────────────
    //
    // Opt-in per user, which is the plugin's own shape — nothing here turns it
    // on for anybody. It earns its place on the accounts that hold billing and
    // payroll: an owner or admin whose login is taken can move where the money
    // lands. A crew member clocking in on a shared phone in a van, made to
    // fetch a code from an authenticator app, is a person who stops clocking
    // in, so a company-wide mandate would cost more than it buys.
    //
    // NOTE, since a half-wired feature is the one thing this codebase refuses
    // to ship: the endpoints below are live and correct, and there is no UI
    // yet — no screen to enable 2FA and no screen to answer the challenge at
    // sign-in. Nothing renders, so nothing lies; a user cannot reach a control
    // that does nothing. Both screens have to land before this is a feature
    // rather than a capability, and `twoFactorPage` on the client is
    // deliberately left unset until the challenge screen exists, because
    // pointing sign-in at a 404 is exactly the dead control we don't ship.
    twoFactor({
      // What the authenticator app lists the account under. FieldQuo, not the
      // company: this is a staff login to the back office, and the white-label
      // rule covers what a HOMEOWNER sees. A phone showing the contractor's own
      // brand for a code that unlocks FieldQuo would be lying about which door
      // the key opens.
      issuer: "FieldQuo",

      // Defaults kept on purpose, both of them safety rails:
      // skipVerificationOnEnable stays false, so 2FA only switches on after the
      // user has proved their authenticator produces the right code — nobody
      // locks themselves out of a mis-scanned QR. accountLockout stays enabled
      // (10 failed codes, 15 minutes), which is the brute-force ceiling on a
      // six-digit secret.
    }),

    // Keep this as the final plugin.
    nextCookies(),
  ],

  secret: process.env.BETTER_AUTH_SECRET,
  baseURL: process.env.BETTER_AUTH_URL,
});
