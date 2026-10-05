// integrations/zapier/index.js
//
// The FieldQuo Marketing app for Zapier — ONE app on Zapier's side; which
// company a connection reads is decided entirely by the agency key the
// company created in FieldQuo (Settings › Marketing agency access).
// Publishing steps: README.md. The API it calls: /developers/marketing-api.

const { version } = require("./package.json");
const { version: platformVersion } = require("zapier-platform-core");
const { call } = require("./lib");
const { triggers } = require("./triggers/events");
const { creates } = require("./creates/leads");
const { searches } = require("./searches/leads");

const authentication = {
  type: "custom",
  fields: [
    {
      key: "apiKey",
      label: "Agency key",
      type: "password",
      required: true,
      helpText:
        "The key your client created for you in FieldQuo: Settings → Marketing agency access → Create key. It starts with fqa_.",
    },
  ],
  // GET /me answers with the key's company — the connection's name.
  test: async (z) => call(z, { path: "/me" }),
  connectionLabel: "{{company.name}} — {{key.name}}",
};

// Every request carries the key as a bearer token. Never as a query
// parameter: a key in a URL lands in every log on the way.
const addKey = (request, z, bundle) => {
  if (bundle.authData && bundle.authData.apiKey) {
    request.headers = { ...(request.headers || {}), Authorization: `Bearer ${bundle.authData.apiKey}` };
  }
  request.headers = { Accept: "application/json", ...(request.headers || {}) };
  return request;
};

const keyed = (list) => Object.fromEntries(list.map((x) => [x.key, x]));

module.exports = {
  version,
  platformVersion,
  authentication,
  beforeRequest: [addKey],
  triggers: keyed(triggers),
  creates: keyed(creates),
  searches: keyed(searches),
  // Search-or-create pairs: find a lead by email/phone, else create it.
  searchOrCreates: {
    find_lead_by_contact: {
      key: "find_lead_by_contact",
      display: { label: "Find or Create Lead", description: "Finds a lead by email or phone, or creates it from your funnel." },
      search: "find_lead_by_contact",
      create: "create_lead",
    },
  },
};
