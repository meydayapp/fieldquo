// scripts/platform-cancel-stub-hooks.mjs
//
// Points `@/lib/db`, `@/lib/stripe` and `@/lib/platform/currentPlatformAdmin`
// at scripts/fixtures/platformCancelStubs.mjs, so check-platform-cancel-lock
// can execute the real cancel route (and lib/billing/access.js's
// accessForCompany) offline and read every call they make. Registered by the
// check itself, after alias-loader, so it resolves first. Everything else —
// the route, cancelOptions.js, access.js's rules, subscriptionFields.js — is
// the shipped file.
import { pathToFileURL } from "node:url";
import { dirname, join, resolve as resolvePath } from "node:path";

const HERE = resolvePath(dirname(new URL(import.meta.url).pathname));
const STUBS = pathToFileURL(join(HERE, "fixtures", "platformCancelStubs.mjs")).href;

export async function resolve(specifier, context, nextResolve) {
  if (specifier === "@/lib/db" || specifier === "@/lib/stripe" || specifier === "@/lib/platform/currentPlatformAdmin") {
    return { url: STUBS, shortCircuit: true };
  }
  // The exports-map entry bare node does not resolve; the file behind it does.
  // Resolved from the repo root, not the importer: `--baseline` replays a
  // copy of the old route kept OUTSIDE the repo, which has no node_modules.
  if (specifier === "next/server") {
    return nextResolve("next/server.js", { ...context, parentURL: pathToFileURL(join(HERE, "..", "package.json")).href });
  }
  return nextResolve(specifier, context);
}
