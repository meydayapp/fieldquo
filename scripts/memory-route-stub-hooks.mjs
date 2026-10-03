// scripts/memory-route-stub-hooks.mjs
//
// `@/lib/db` → the general in-memory Prisma (fixtures/memoryPrisma.mjs) AND
// `@/lib/apiMember` → fixtures/apiMemberStub.mjs, so a check can EXECUTE an
// app/api GET handler against rows it seeded, as whichever member it names.
//
// route-stub-hooks.mjs is the same pair over the scripted dbStub, which
// answers only the queries a check scripts one by one; the inbox and filed-
// email routes read threads → messages → email → mailbox through nested
// selects and relation filters, which the memory store evaluates for real.
//
//   node --import ./scripts/alias-loader.mjs \
//        --import ./scripts/memory-route-stub-loader.mjs scripts/check-support-view-google.mjs
import { pathToFileURL } from "node:url";
import { dirname, join, resolve as resolvePath } from "node:path";

const HERE = resolvePath(dirname(new URL(import.meta.url).pathname));
const STORE = pathToFileURL(join(HERE, "fixtures", "memoryPrisma.mjs")).href;
const MEMBER = pathToFileURL(join(HERE, "fixtures", "apiMemberStub.mjs")).href;

export async function resolve(specifier, context, nextResolve) {
  if (specifier === "@/lib/db") return { url: STORE, shortCircuit: true };
  if (specifier === "@/lib/apiMember") return { url: MEMBER, shortCircuit: true };
  if (specifier === "next/server") return nextResolve("next/server.js", context);
  return nextResolve(specifier, context);
}
