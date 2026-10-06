// lib/meta/capi/testEvent.js
//
// The one event "Send a test event" sends. Pure. Shaped like a CRM stage
// (action_source system_generated, custom_data event_source "crm") so it
// exercises the same dataset, token and field names the real sends use, but
// with no lead id and no person: Meta requires one customer parameter, and
// the only one here is a hash of the company's own id.
import { sha256Hex } from "./hash";
import { LEAD_EVENT_SOURCE } from "./events";

export const TEST_EVENT_NAME = "FieldQuo test";

/** Meta's test codes are short runs of letters and digits ("TEST12345"). Pure. */
export function cleanTestEventCode(raw) {
  const v = typeof raw === "string" ? raw.trim() : "";
  return /^[A-Za-z0-9]{4,40}$/.test(v) ? v : null;
}

export function testEvent({ companyId, now = new Date() }) {
  return {
    event_name: TEST_EVENT_NAME,
    event_time: Math.floor(new Date(now).getTime() / 1000),
    event_id: `test:${companyId}:${Math.floor(new Date(now).getTime() / 1000)}`,
    action_source: "system_generated",
    user_data: { external_id: [sha256Hex(`fieldquo-test:${companyId}`)] },
    custom_data: { lead_event_source: LEAD_EVENT_SOURCE, event_source: "crm" },
  };
}
