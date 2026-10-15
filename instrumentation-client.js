// instrumentation-client.js
//
// Runs in the browser on every page of this deployment, before hydration
// (Next 16 — node_modules/next/dist/docs/01-app/03-api-reference/
// 03-file-conventions/instrumentation-client.md). Its one job today is to
// start HeyCatch, FieldQuo's product analytics, on FieldQuo's OWN pages.
//
// Every page includes contractor and homeowner pages — the quote, the
// portal, the contractor's website on their subdomain — which is why this
// file does not import the SDK. lib/heycatch/client.js loads it behind
// lib/heycatch/gate.js, and the reasoning (white-label, Law 25, and the SDK's
// own top-level redirect) is written there.
import { startAnalytics } from "@/lib/heycatch/client";

startAnalytics();

// A client-side navigation from a page where the gate said no (a 404, a
// token page) INTO one of FieldQuo's own starts analytics there. The reverse
// direction — already running, navigating into a client-facing page — is
// handled by the gate re-run in beforeSend, which drops those events.
export function onRouterTransitionStart(url) {
  try {
    const next = new URL(url, window.location.href);
    // Same origin only: the gate is asked about the DESTINATION, because
    // window.location has not changed yet when a transition starts.
    if (next.origin === window.location.origin) startAnalytics(next);
  } catch {
    // An unparseable URL is not ours to measure.
  }
}
