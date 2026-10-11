// scripts/billing-lifecycle-stub-hooks.mjs
//
// Points the specifiers a FieldQuo → contractor email path reaches for at
// scripts/fixtures/billingLifecycleStubs.mjs, so check-billing-lifecycle-emails.mjs can
// EXECUTE the real send paths — the self-serve cancel route, the Stripe
// webhook, lib/billing/notify.js, the referral grant, the AI-credit ledger —
// offline, against a FakePrisma that evaluates `where`, a Stripe that
// records, and a sendEmail that records instead of mailing anybody.
//
// Same mechanism as db-stub-hooks.mjs and platform-cancel-stub-hooks.mjs:
// registered after alias-loader, so it resolves first. Everything not named
// here is the shipped file — notify.js, billingEmail.js, the cancel route,
// stripeBilling.js, the referral rules.
//
//   node --import ./scripts/alias-loader.mjs \
//        --import ./scripts/billing-lifecycle-stub-loader.mjs scripts/check-billing-lifecycle-emails.mjs
import { pathToFileURL } from "node:url";
import { dirname, join, resolve as resolvePath } from "node:path";

const HERE = resolvePath(dirname(new URL(import.meta.url).pathname));
const STUBS = pathToFileURL(join(HERE, "fixtures", "billingLifecycleStubs.mjs")).href;

const REDIRECTED = new Set([
  "@/lib/db",
  "@/lib/stripe",
  "@/lib/email/resend",
  "@/lib/email/platformSender",
  "@/lib/platform/errorLog",
  "@/lib/apiMember",
  "@/lib/activity/log",
]);

export async function resolve(specifier, context, nextResolve) {
  if (REDIRECTED.has(specifier)) return { url: STUBS, shortCircuit: true };
  // The monthly-digest CRON's audience is what the check executes there; the
  // letter itself (loadMonthlySummary's dozen loaders) is check:monthly-
  // summary's. So for that one importer only, generateMonthlyDigest is the
  // recorder in billingLifecycleStubs.mjs — every other importer gets the real file.
  if (specifier === "@/lib/ai/monthlyDigest" && /\/app\/api\/cron\/monthly-digest\/route\.js$/.test(context.parentURL || "")) {
    return { url: STUBS, shortCircuit: true };
  }
  // companySender.js imports its siblings relatively ("./resend",
  // "./platformSender"). Those must land on the same recorder, or a send
  // made through resolveSender would reach the real Resend client.
  if ((specifier === "./resend" || specifier === "./platformSender") && /\/lib\/email\//.test(context.parentURL || "")) {
    return { url: STUBS, shortCircuit: true };
  }
  if (specifier === "next/server") return nextResolve("next/server.js", context);
  return nextResolve(specifier, context);
}
