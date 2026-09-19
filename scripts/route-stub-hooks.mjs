// scripts/route-stub-hooks.mjs
//
// Points `@/lib/db` at the shared scripted db (scripts/fixtures/dbStub.mjs)
// AND `@/lib/apiMember` at scripts/fixtures/apiMemberStub.mjs, so a check can
// EXECUTE an app/api route handler — status codes and all — without a
// database or a session.
//
// A separate hook from db-stub-hooks.mjs because it redirects a second
// specifier: every other db-stub check imports lib modules that never ask who
// is calling, and pointing `@/lib/apiMember` at a stub underneath them would
// change what those checks mean. timeclock-stub-hooks.mjs does the same pair
// with its own richer fixture; this one keeps the shared db stub so the rows
// and writes a route touches are the same `rows`/`writes` every other check
// already reads.
//
// Registered AFTER alias-loader so it resolves FIRST (node runs resolve hooks
// in reverse registration order):
//
//   node --import ./scripts/alias-loader.mjs \
//        --import ./scripts/route-stub-loader.mjs scripts/check-review-notes.mjs
import { pathToFileURL } from "node:url";
import { dirname, join, resolve as resolvePath } from "node:path";

const HERE = resolvePath(dirname(new URL(import.meta.url).pathname));
const DB = pathToFileURL(join(HERE, "fixtures", "dbStub.mjs")).href;
const MEMBER = pathToFileURL(join(HERE, "fixtures", "apiMemberStub.mjs")).href;

export async function resolve(specifier, context, nextResolve) {
  if (specifier === "@/lib/db") return { url: DB, shortCircuit: true };
  if (specifier === "@/lib/apiMember") return { url: MEMBER, shortCircuit: true };
  // `next/server` is an "exports"-map entry the bundler understands and bare
  // node does not. The file behind it loads and works — NextResponse.json
  // returns a real Response with the right status and body.
  if (specifier === "next/server") return nextResolve("next/server.js", context);
  return nextResolve(specifier, context);
}
