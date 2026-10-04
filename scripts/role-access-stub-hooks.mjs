// scripts/role-access-stub-hooks.mjs
//
// Points `@/lib/db` at scripts/fixtures/prismaShapeStub.mjs (a stub that
// honours select/include, so a FIELD-level question has a real answer) and
// `@/lib/apiMember` at scripts/fixtures/apiMemberStub.mjs (the session a
// check sets), so scripts/check-role-access.mjs can execute the shipped route
// handlers as each role. Everything else — the gates, the redactors, the
// routes — is the shipped file.
//
// Its own hook rather than route-stub-hooks.mjs, because that one points the
// db at the shared whole-row stub, and changing it underneath the checks that
// use it would change what they mean.
//
//   node --import ./scripts/alias-loader.mjs \
//        --import ./scripts/role-access-stub-loader.mjs scripts/check-role-access.mjs
import { pathToFileURL } from "node:url";
import { dirname, join, resolve as resolvePath } from "node:path";

const HERE = resolvePath(dirname(new URL(import.meta.url).pathname));
const DB = pathToFileURL(join(HERE, "fixtures", "prismaShapeStub.mjs")).href;
const MEMBER = pathToFileURL(join(HERE, "fixtures", "apiMemberStub.mjs")).href;

export async function resolve(specifier, context, nextResolve) {
  if (specifier === "@/lib/db") return { url: DB, shortCircuit: true };
  if (specifier === "@/lib/apiMember") return { url: MEMBER, shortCircuit: true };
  if (specifier === "next/server") return nextResolve("next/server.js", context);
  return nextResolve(specifier, context);
}
