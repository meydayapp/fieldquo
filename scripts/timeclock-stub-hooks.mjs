// scripts/timeclock-stub-hooks.mjs
//
// Points `@/lib/db` and `@/lib/apiMember` at scripts/fixtures/timeClockDb.mjs,
// so scripts/check-time-clock-job.mjs can EXECUTE app/api/time-clock/route.js
// instead of reading it.
//
// A separate hook from db-stub-hooks.mjs because it redirects a second
// specifier (`@/lib/apiMember`) and points at a fixture with a filter engine
// that actually applies nested Prisma operators — see that fixture's header for
// why the shared stub could not be widened without changing what every other
// check's fixtures mean.
//
// Registered AFTER alias-loader so it resolves FIRST (node runs resolve hooks
// in reverse registration order) and short-circuits before the alias hook maps
// the specifier to the real file:
//
//   node --import ./scripts/alias-loader.mjs \
//        --import ./scripts/timeclock-stub-loader.mjs scripts/check-time-clock-job.mjs
//
// Everything else — jobChoices, unattributedHours, the permissions grid, the
// timezone maths — is the shipped file.
import { pathToFileURL } from "node:url";
import { dirname, join, resolve as resolvePath } from "node:path";

const HERE = resolvePath(dirname(new URL(import.meta.url).pathname));
const STUB = pathToFileURL(join(HERE, "fixtures", "timeClockDb.mjs")).href;

const REDIRECTED = new Set(["@/lib/db", "@/lib/apiMember"]);

export async function resolve(specifier, context, nextResolve) {
  if (REDIRECTED.has(specifier)) return { url: STUB, shortCircuit: true };
  // `next/server` is an "exports"-map entry the bundler understands and bare
  // node does not. The FILE behind it loads and works — NextResponse.json
  // returns a real Response with the right status and body — so this is a
  // resolution fix, not a substitute: the check reads the status codes the
  // shipped route actually produces, not a fake's idea of them.
  if (specifier === "next/server") return nextResolve("next/server.js", context);
  return nextResolve(specifier, context);
}
