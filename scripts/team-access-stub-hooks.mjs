// scripts/team-access-stub-hooks.mjs
//
// Resolves the specifiers the invite, accept and kitchen code reach for to ONE
// fixture, scripts/fixtures/teamAccessStub.mjs, so the database, the session
// and the side effects share state across the route modules under test.
// Everything not listed here — the routes themselves, reconcilePendingProfiles,
// the permission grid, inviteGuard, seatCheck, the kitchen gate — is the
// shipped file.
//
//   node --import ./scripts/alias-loader.mjs --import ./scripts/jsx-loader.mjs \
//        --import ./scripts/team-access-stub-loader.mjs scripts/check-invite-accept-access.mjs
//
// Registered last so it resolves first and short-circuits before the alias
// hook maps "@/…" to the real file.
import { pathToFileURL } from "node:url";
import { dirname, join, resolve as resolvePath } from "node:path";

const HERE = resolvePath(dirname(new URL(import.meta.url).pathname));
const STUB = pathToFileURL(join(HERE, "fixtures", "teamAccessStub.mjs")).href;

const REDIRECT = new Set([
  "@/lib/db",
  "@/lib/auth",
  "@/lib/currentMember",
  "@/lib/team/ensureWorker",
  "@/lib/onboarding/service",
  "@/lib/email/teamInvite",
  "@/lib/platform/planLimits",
  "@/lib/platform/errorLog",
  "@/lib/activity/log",
  "next/headers",
  "next/navigation",
]);

export async function resolve(specifier, context, nextResolve) {
  if (REDIRECT.has(specifier)) return { url: STUB, shortCircuit: true };
  // The kitchen page's client component: replaced by a props recorder, see
  // the fixture. Matched on the importer so no other "./KitchenPage" moves.
  if (specifier === "./KitchenPage" && /\/app\/app\/quotes\/\[id\]\/kitchen\/page\.js$/.test(decodeURIComponent(context.parentURL || ""))) {
    return { url: STUB, shortCircuit: true };
  }
  if (specifier === "next/server") return nextResolve("next/server.js", context);
  return nextResolve(specifier, context);
}
