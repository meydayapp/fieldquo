// lib/auth-client.js

import { createAuthClient } from "better-auth/react";
import {
  organizationClient,
  twoFactorClient,
} from "better-auth/client/plugins";

export const authClient = createAuthClient({
  // You can actually omit baseURL when the auth API is on
  // the same domain as the Next.js application.
  baseURL: process.env.NEXT_PUBLIC_APP_URL,

  // twoFactorClient takes a `twoFactorPage` that sign-in redirects to when the
  // account has 2FA on. Left unset until that screen exists — configuring it
  // now would point a successful password check at a 404.
  plugins: [organizationClient(), twoFactorClient()],
});

export const { signIn, signUp, signOut, useSession } = authClient;

// ── Password reset and email verification ──────────────────────────────────
//
// requestPasswordReset is the real endpoint in Better Auth 1.6
// (POST /request-password-reset). `forgetPassword` is the name it had before,
// and it is exported here as the same function rather than dropped, because
// the client is a proxy: authClient.forgetPassword(...) type-checks, autocompletes
// and returns a function whatever you ask it for, then POSTs to a path that
// 404s at runtime. A page written against the old name would fail only when a
// real person had already lost their password. One name, two doors.
//
// Neither call needs `redirectTo`: lib/auth.js puts the landing page on the
// emailed link itself, so a caller that forgets it still gets a working email.
// verifyEmail belongs here too. /verify-email was reaching for
// authClient.verifyEmail directly while its three siblings were destructured —
// and on a proxy client, an undestructured name is exactly the mistake that
// type-checks, autocompletes, and 404s at runtime. Naming it here is what makes
// a typo fail at import instead of in front of a locked-out contractor.
export const { requestPasswordReset, resetPassword, sendVerificationEmail, verifyEmail } =
  authClient;
export const forgetPassword = authClient.requestPasswordReset;

// Opt-in second factor: enable / disable / verifyTotp / verifyBackupCode /
// generateBackupCodes. Exported so the settings and challenge screens have it
// the day they are built; nothing calls it yet.
export const { twoFactor } = authClient;
