// scripts/job-selections-stub-hooks.mjs
//
// Points `@/lib/db` at scripts/fixtures/selectionsDb.mjs (an in-memory client
// that evaluates nested WHERE filters — see its header) and `@/lib/apiMember`
// at the shared scripted session (scripts/fixtures/apiMemberStub.mjs), so
// scripts/check-job-selections.mjs can EXECUTE the colours-and-materials
// route handlers, the quote → job copy and job creation itself.
//
// Registered AFTER alias-loader so it resolves FIRST:
//
//   node --import ./scripts/alias-loader.mjs \
//        --import ./scripts/job-selections-stub-loader.mjs scripts/check-job-selections.mjs
import { pathToFileURL } from "node:url";
import { dirname, join, resolve as resolvePath } from "node:path";

const HERE = resolvePath(dirname(new URL(import.meta.url).pathname));
const DB = pathToFileURL(join(HERE, "fixtures", "selectionsDb.mjs")).href;
const MEMBER = pathToFileURL(join(HERE, "fixtures", "apiMemberStub.mjs")).href;

export async function resolve(specifier, context, nextResolve) {
  if (specifier === "@/lib/db") return { url: DB, shortCircuit: true };
  if (specifier === "@/lib/apiMember") return { url: MEMBER, shortCircuit: true };
  if (specifier === "next/server") return nextResolve("next/server.js", context);
  return nextResolve(specifier, context);
}
