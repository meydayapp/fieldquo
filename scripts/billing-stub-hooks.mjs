// scripts/billing-stub-hooks.mjs
//
// Resolves `@/lib/stripe` and `@/lib/billing/notify` to recording fakes, so a
// check can execute the billing code that talks to Stripe — the plan-change
// scheduler, the webhook — without a key, a network, or a mailbox.
//
// Same mechanism as db-stub-hooks.mjs, and used alongside it: lib/stripe.js
// builds its client lazily so importing it is harmless, but the first call
// would go to api.stripe.com, and "does schedulePlanChange send
// create_prorations" is a question about the ARGUMENTS of that call, which
// only a fake that records them can answer.
//
//   node --import ./scripts/alias-loader.mjs \
//        --import ./scripts/db-stub-loader.mjs \
//        --import ./scripts/billing-stub-loader.mjs scripts/check-plan-change.mjs
//
// Only those two specifiers are intercepted. Everything else — planChange.js,
// stripeBilling.js, the interval maths — is the shipped file.
import { pathToFileURL } from "node:url";
import { dirname, join, resolve as resolvePath } from "node:path";

const HERE = resolvePath(dirname(new URL(import.meta.url).pathname));
const STRIPE_STUB = pathToFileURL(join(HERE, "fixtures", "stripeStub.mjs")).href;
const NOTIFY_STUB = pathToFileURL(join(HERE, "fixtures", "notifyStub.mjs")).href;

export async function resolve(specifier, context, nextResolve) {
  if (specifier === "@/lib/stripe") return { url: STRIPE_STUB, shortCircuit: true };
  if (specifier === "@/lib/billing/notify") return { url: NOTIFY_STUB, shortCircuit: true };
  return nextResolve(specifier, context);
}
