// scripts/memory-db-hooks.mjs
//
// Resolves `@/lib/db` to scripts/fixtures/memoryPrisma.mjs — a general
// in-memory Prisma — so a check can execute a path that writes fifty models
// (the demo-content seed) against one store that every module-level `db`
// import lands in.
//
// Same mechanism and the same registration order as db-stub-hooks.mjs: after
// alias-loader, so it runs first and short-circuits before the alias hook
// maps the specifier to the real file.
//
//   node --import ./scripts/alias-loader.mjs \
//        --import ./scripts/memory-db-loader.mjs scripts/check-demo-content.mjs
import { pathToFileURL } from "node:url";
import { dirname, join, resolve as resolvePath } from "node:path";

const HERE = resolvePath(dirname(new URL(import.meta.url).pathname));
const STORE = pathToFileURL(join(HERE, "fixtures", "memoryPrisma.mjs")).href;

export async function resolve(specifier, context, nextResolve) {
  if (specifier === "@/lib/db") return { url: STORE, shortCircuit: true };
  if (specifier === "next/server") return nextResolve("next/server.js", context);
  return nextResolve(specifier, context);
}
