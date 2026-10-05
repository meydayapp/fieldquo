// lib/meta/capi/afterResponse.js
//
// Run a "Send lead results to Meta" capture after the response has gone, so
// queueing an event can never slow down or fail the contractor's delete or
// the homeowner's form.
//
// Next's `after()` is the mechanism. It is reached through the module
// namespace rather than a named import because the route files this is called
// from are also loaded by check scripts that stub `next/server` with
// NextResponse alone (scripts/check-lead-delete.mjs and six others) — a named
// `import { after }` fails to LINK there, which would break every one of
// those checks for a feature they do not exercise. Outside a request (a
// script, a check) `after` is absent or throws, and the task simply runs on
// the next tick instead; every capture function is best-effort and never
// throws, so either way nothing waits on it.
import * as nextServer from "next/server";

export function afterResponse(task) {
  if (typeof task !== "function") return;
  if (typeof nextServer.after === "function") {
    try {
      nextServer.after(task);
      return;
    } catch {
      /* not inside a request scope — fall through */
    }
  }
  Promise.resolve()
    .then(task)
    .catch(() => {});
}
