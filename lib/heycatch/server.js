// lib/heycatch/server.js
//
// HeyCatch business events the SERVER knows about: a company created
// (trial_started), a subscription started or its plan changed
// (subscription_started / plan_selected), a company's first quote sent
// (first_quote_sent). Sent from the route that made the thing true, after the
// write committed — an adblocker cannot eat a server event, and the outcome
// is the database's word rather than the browser's.
//
// ══ Rules ═════════════════════════════════════════════════════════════════
//
// · Never throws and never slows a customer's action for long: the SDK's
//   server calls resolve once ingest answers and never reject, and this
//   wrapper catches anything else. A metrics vendor being down must not fail
//   a signup, a payment webhook or a quote send.
// · Production only (VERCEL_ENV = production, via currentEnvironment). A
//   preview deploy and the owner's laptop are FieldQuo testing itself, and
//   their events would sit in the real funnel as fake signups.
// · userId is the same internal user id the browser passes to setIdentity
//   (app/components/analytics/AnalyticsIdentity.js) — that is what joins the
//   two. Properties are ids, tier keys and statuses only; never a name, an
//   email, a phone number or a client's anything (see identityPayload in
//   ./gate.js for why).
// · Demo and test companies are skipped by the callers' own data: pass
//   `skip: true` when the company is a demo or a FieldQuo test company.

import { analytics } from "@heycatch/sdk/server";
import { currentEnvironment } from "@/lib/platform/errorKinds";
import { HEYCATCH_PROJECT_KEY } from "./gate";

let initialised = false;

function ready() {
  if (currentEnvironment() !== "production") return false;
  if (!initialised) {
    analytics.init({ projectKey: HEYCATCH_PROJECT_KEY });
    initialised = true;
  }
  return true;
}

/** The business events this file may send, so a typo is a refusal rather than a new event. */
export const SERVER_EVENTS = Object.freeze(["trial_started", "subscription_started", "plan_selected", "first_quote_sent"]);

/**
 * Send one business event. Resolves to true when it was handed to HeyCatch,
 * false when it was skipped (not production, no user, unknown event, demo).
 */
export async function trackServerEvent(name, properties = {}, { userId, request = null, skip = false } = {}) {
  try {
    if (skip || !userId || !SERVER_EVENTS.includes(name)) return false;
    if (!ready()) return false;
    const clean = {};
    for (const [key, value] of Object.entries(properties || {})) {
      if (value === null || ["string", "number", "boolean"].includes(typeof value)) clean[key] = value;
    }
    await analytics.trackEvent(name, clean, request ? { userId, request } : { userId });
    return true;
  } catch (err) {
    console.warn(`[heycatch] ${name} not sent:`, err?.message || err);
    return false;
  }
}
