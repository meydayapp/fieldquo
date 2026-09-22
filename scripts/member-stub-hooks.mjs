// scripts/member-stub-hooks.mjs
//
// Points `@/lib/currentMember` at scripts/fixtures/currentMemberStub.mjs, so a
// check can execute a route as the world AND as a signed-in member without
// standing up Better Auth.
//
// Stacked on top of db-stub-loader rather than replacing it — this redirects
// one specifier and nothing else:
//
//   node --import ./scripts/alias-loader.mjs \
//        --import ./scripts/db-stub-loader.mjs \
//        --import ./scripts/member-stub-loader.mjs scripts/check-quote-preview.mjs
//
// Registered LAST so it resolves FIRST (node runs resolve hooks in reverse
// registration order) and short-circuits before the alias hook maps the
// specifier to the real file. Everything else — the route, the gate, the
// presenter, the theme — is the shipped file.
import { pathToFileURL } from "node:url";
import { dirname, join, resolve as resolvePath } from "node:path";

const HERE = resolvePath(dirname(new URL(import.meta.url).pathname));
const STUB = pathToFileURL(join(HERE, "fixtures", "currentMemberStub.mjs")).href;

export async function resolve(specifier, context, nextResolve) {
  if (specifier === "@/lib/currentMember") return { url: STUB, shortCircuit: true };
  return nextResolve(specifier, context);
}
