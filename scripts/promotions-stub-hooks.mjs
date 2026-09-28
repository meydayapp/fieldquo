// scripts/promotions-stub-hooks.mjs
//
// Points `@/lib/db` and `@/lib/stripe` at scripts/fixtures/promotionsStubs.mjs
// and `@/lib/billing/notify` at the notify stub, so check-promotions-live can
// execute the real checkout builders, plan-change paths and the resolver
// offline and read every Stripe call they make. Registered by the check
// itself, after alias-loader, so it resolves first. Everything else — the
// resolver, planOffer, stripeBilling.js, the ladder — is the shipped file
// (or, with a baseline tree, the file as it was).
import { pathToFileURL } from "node:url";
import { dirname, join, resolve as resolvePath } from "node:path";

const HERE = resolvePath(dirname(new URL(import.meta.url).pathname));
const STUBS = pathToFileURL(join(HERE, "fixtures", "promotionsStubs.mjs")).href;
const NOTIFY = pathToFileURL(join(HERE, "fixtures", "notifyStub.mjs")).href;

export async function resolve(specifier, context, nextResolve) {
  if (specifier === "@/lib/db" || specifier === "@/lib/stripe") return { url: STUBS, shortCircuit: true };
  if (specifier === "@/lib/billing/notify") return { url: NOTIFY, shortCircuit: true };
  if (specifier === "next/server") {
    return nextResolve("next/server.js", context);
  }
  return nextResolve(specifier, context);
}
