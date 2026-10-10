// scripts/portal-links-stub-hooks.mjs
//
// Points every outward dependency of the portal-link routes at
// scripts/fixtures/portalLinksStub.mjs — the database, Resend, the sender,
// the activity log, the plan gate, the permission grid, the session and
// next/server's after() — so scripts/check-portal-account-links.mjs can
// execute the real route handlers offline. The real lib/email/resend.js is
// never resolved under this hook, so the check cannot send an email.
//
// Registered AFTER alias-loader so it resolves FIRST:
//
//   node --import ./scripts/alias-loader.mjs \
//        --import ./scripts/portal-links-stub-loader.mjs scripts/check-portal-account-links.mjs
import { pathToFileURL } from "node:url";
import { dirname, join, resolve as resolvePath } from "node:path";

const HERE = resolvePath(dirname(new URL(import.meta.url).pathname));
const STUB = pathToFileURL(join(HERE, "fixtures", "portalLinksStub.mjs")).href;

const STUBBED = new Set([
  "@/lib/db",
  "next/server",
  "@/lib/email/resend",
  "@/lib/email/companySender",
  "@/lib/activity/log",
  "@/lib/signup/planGate",
  "@/lib/permissions/enforce",
  "@/lib/apiMember",
]);

export async function resolve(specifier, context, nextResolve) {
  if (STUBBED.has(specifier)) return { url: STUB, shortCircuit: true };
  return nextResolve(specifier, context);
}
