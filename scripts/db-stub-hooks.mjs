// scripts/db-stub-hooks.mjs
//
// Resolves `@/lib/db` to a scriptable fake, so a check can execute the parts of
// the product that talk to Postgres.
//
// ── Why this exists ─────────────────────────────────────────────────────────
//
// The interesting half of the call-to-quote path is the half that writes: does
// a phone call actually land a Quote row with estimateSource "phone_call", the
// right total, the right line items and a scope group under the right service
// category? Every check in this repo up to now stopped at the last pure
// function and asserted the rest by reading it — which is exactly the habit
// AGENTS.md says produced the bugs.
//
// Importing the real lib/db is not an option: it constructs a PrismaClient
// against Neon at module load, so a check that touched it would need a live
// database, a network, and a tenant to write into. Redirecting the specifier
// is the smallest thing that makes the write path executable offline.
//
// Registered AFTER alias-loader so it runs FIRST (node calls resolve hooks in
// reverse registration order) and can short-circuit before the alias hook maps
// the specifier to the real file:
//
//   node --import ./scripts/alias-loader.mjs \
//        --import ./scripts/db-stub-loader.mjs scripts/check-whatever.mjs
//
// Only `@/lib/db` is intercepted. Everything else — the estimators, the price
// book, createEstimateDraft itself — is the shipped file.
import { pathToFileURL } from "node:url";
import { dirname, join, resolve as resolvePath } from "node:path";

const HERE = resolvePath(dirname(new URL(import.meta.url).pathname));
const STUB = pathToFileURL(join(HERE, "fixtures", "dbStub.mjs")).href;

export async function resolve(specifier, context, nextResolve) {
  if (specifier === "@/lib/db") return { url: STUB, shortCircuit: true };
  return nextResolve(specifier, context);
}
