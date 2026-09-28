// scripts/impersonation-stub-hooks.mjs
//
// The resolve hook behind impersonation-stub-loader.mjs, for
// scripts/check-impersonation-view-all.mjs.
//
// Unlike member-stub-hooks.mjs, this does NOT replace lib/currentMember.js:
// the resolver IS the thing under test (the superadmin's view-all grant is
// decided there), so the real file runs and only what it stands on is swapped:
//
//   lib/db.js                  → fixtures/impersonationDb.mjs (scriptable,
//                                 records every write)
//   lib/auth.js                → fixtures/authStub.mjs (a real member's
//                                 Better Auth session, when a check wants one)
//   lib/security/deviceGuard.js → a no-op (fire-and-forget seat sampling)
//
// Matched on the RESOLVED file, not the specifier, because lib/currentMember
// imports "./db" and "./auth" while routes import "@/lib/db" — both must land
// on the same fake or the resolver and the route would read two databases.
import { pathToFileURL } from "node:url";
import { dirname, join, resolve as resolvePath } from "node:path";

const HERE = resolvePath(dirname(new URL(import.meta.url).pathname));
const ROOT = resolvePath(HERE, "..");
const STUBS = {
  [pathToFileURL(join(ROOT, "lib", "db.js")).href]: pathToFileURL(join(HERE, "fixtures", "impersonationDb.mjs")).href,
  [pathToFileURL(join(ROOT, "lib", "auth.js")).href]: pathToFileURL(join(HERE, "fixtures", "authStub.mjs")).href,
  [pathToFileURL(join(ROOT, "lib", "security", "deviceGuard.js")).href]:
    "data:text/javascript,export function noteAccountActivity(){}",
};

export async function resolve(specifier, context, nextResolve) {
  if (specifier === "next/server") return nextResolve("next/server.js", context);
  if (specifier === "next/headers") return nextResolve("next/headers.js", context);
  const out = await nextResolve(specifier, context);
  const stub = STUBS[out.url];
  return stub ? { url: stub, shortCircuit: true } : out;
}
