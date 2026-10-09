// lib/email/companyReplyTo.js
//
// Saving Company.email — the Reply-To on every client email (senderFor in
// lib/email/resend.js) — from a screen that isn't the company profile.
//
// ══ One writer ═══════════════════════════════════════════════════════════
//
// Company.email is edited on Settings › Company, which PATCHes
// /api/settings/business-info. Settings › Email domain shows the same value in
// its "Replies go to" row and ReplyToPromptModal asks for it where it is
// missing; both save through this function, so all three land on the SAME
// route with the SAME validation. A second writer (say, an `email` field on
// /api/settings/email-domain's PATCH) would be the copy that drifts — the
// profile would trim and check while the domain page stored whatever it got.
//
// The check is lib/validation.js's emailProblem(), run here so a typo is
// caught before the round trip and again by the route, which is the one that
// counts.

import { emailProblem } from "@/lib/validation";

/** The route that writes Company.email. Exported for the check script. */
export const COMPANY_EMAIL_WRITER = "/api/settings/business-info";

/**
 * @param value     what was typed
 * @param deps      { fetchImpl } — the check script passes a recorder
 * @returns { ok: true, email } | { ok: false, problem } (refused before sending)
 *        | { ok: false, error, status } (the route refused or the request failed)
 */
export async function saveCompanyEmail(value, { fetchImpl } = {}) {
  const email = String(value ?? "").trim();
  const problem = emailProblem(email);
  if (problem) return { ok: false, problem };
  const doFetch = fetchImpl || ((...args) => fetch(...args));
  let res;
  try {
    res = await doFetch(COMPANY_EMAIL_WRITER, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email }),
    });
  } catch {
    return { ok: false, error: null, status: 0 };
  }
  const json = await res.json().catch(() => ({}));
  if (!res.ok) return { ok: false, error: json?.error || null, status: res.status };
  return { ok: true, email: typeof json?.email === "string" ? json.email : email };
}
