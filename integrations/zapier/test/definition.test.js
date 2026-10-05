// integrations/zapier/test/definition.test.js
//
//   npm test   (after npm install in integrations/zapier)
//
// The app's shape, checked without calling FieldQuo: every trigger is a REST
// hook with subscribe, unsubscribe and a perform-list fallback; the three
// actions and two searches exist; nothing messages a client; auth sends the
// key as a bearer header. `zapier validate` (README) checks Zapier's own
// schema on top of this. The main repo's scripts/check-agency-api.mjs checks
// this app's event list and lead fields against the API's own.

const assert = require("node:assert/strict");
const App = require("../index");

const triggers = Object.values(App.triggers);
assert.equal(triggers.length, 13, "one trigger per FieldQuo event");
for (const t of triggers) {
  assert.equal(t.operation.type, "hook", `${t.key} is a REST hook`);
  for (const fn of ["performSubscribe", "performUnsubscribe", "perform", "performList"]) {
    assert.equal(typeof t.operation[fn], "function", `${t.key}.${fn}`);
  }
}
assert.deepEqual(Object.keys(App.creates).sort(), ["create_lead", "move_lead_stage", "update_appointment_request"]);
assert.deepEqual(Object.keys(App.searches).sort(), ["find_lead_by_contact", "find_lead_by_ref"]);
const everything = JSON.stringify(Object.keys({ ...App.triggers, ...App.creates, ...App.searches }));
assert.ok(!/message|sms|text|email_client|send/i.test(everything), "no action messages a client");

const req = App.beforeRequest[0]({ headers: {} }, null, { authData: { apiKey: "fqa_x" } });
assert.equal(req.headers.Authorization, "Bearer fqa_x");
assert.ok(!/apiKey|fqa_/.test(JSON.stringify(req.params || {})), "the key never rides in the query string");

console.log("definition ok:", triggers.length, "triggers,", Object.keys(App.creates).length, "actions,", Object.keys(App.searches).length, "searches");
