// scripts/check-rbac-redaction.mjs
//
//   npm run check:rbac-redaction
//
// The read half of the granular permission grid, executed.
//
// Every assertion here is a hole QA found in production by probing as a real
// employee account. They are regression guards, not hypotheticals:
//
//   * an employee set to clientsProperties "name_address_only" received every
//     client's email, phone, private notes and portal token
//   * the same employee could read a quote's shareToken and open the priced
//     public page logged out
//
// The gates (403s) were already right. Nothing shaped a PAYLOAD, which is why
// every read-shaped dial in the grid did nothing at all.
import {
  redactClient,
  redactClients,
  redactQuote,
  redactShareToken,
  hasLevel,
} from "../lib/permissions/enforce.js";

let pass = 0;
const failures = [];
const check = (label, ok) => {
  if (ok) { pass += 1; console.log(`  ok   ${label}`); }
  else { failures.push(label); console.log(`  FAIL ${label}`); }
};

// Daniel's real grid, as saved in production.
const restricted = {
  role: "employee",
  permissions: {
    jobs: "view_only", notes: "jobs_visits_only", quotes: "view_only",
    payroll: "view_own", expenses: "view_record_edit_own", invoices: "view_only",
    payments: false, requests: "view_only", schedule: "view_complete_own",
    jobCosting: false, showPricing: false, timeTracking: "view_record_own",
    clientsProperties: "name_address_only",
  },
};
const fullView = { role: "employee", permissions: { ...restricted.permissions, clientsProperties: "full_view", quotes: "view_create_edit" } };
const owner = { role: "owner", permissions: null };
const admin = { role: "admin", permissions: restricted.permissions };
const legacy = { role: "employee", permissions: null };

const CLIENT = {
  id: "c1", companyId: "co1", name: "Marie Tremblay", type: "residential",
  contactName: "Marie", email: "castes-query.8v@icloud.com", phone: "819-238-7263",
  address: "755 Rue Saint-Louis", city: "Gatineau", province: "QC",
  notes: "Difficult about scheduling", language: "fr",
  portalToken: "tok_live_abc123", createdAt: "2026-08-01",
  _count: { quotes: 1, invoices: 0 },
};

console.log("\nclientsProperties: name_address_only\n");
const r = redactClient(restricted, CLIENT);
check("name survives", r.name === "Marie Tremblay");
check("address survives", r.address === "755 Rue Saint-Louis");
check("city and province survive", r.city === "Gatineau" && r.province === "QC");
check("email is gone", r.email === undefined);
check("phone is gone", r.phone === undefined);
check("contactName is gone", r.contactName === undefined);
check("private notes are gone", r.notes === undefined);
check("portalToken is gone", r.portalToken === undefined);
check("history counts are gone", r._count === undefined);
check("marked restricted so the UI can say why", r.restricted === true);
check("the source row is not mutated", CLIENT.email === "castes-query.8v@icloud.com");

console.log("\nWho still sees everything\n");
check("owner sees the full record", redactClient(owner, CLIENT).email === CLIENT.email);
check("admin sees it even with a restrictive grid", redactClient(admin, CLIENT).email === CLIENT.email);
check("employee at full_view sees it", redactClient(fullView, CLIENT).email === CLIENT.email);
check("a member predating the grid is not locked out", redactClient(legacy, CLIENT).email === CLIENT.email);

console.log("\nLists and hostile input\n");
check("a list redacts every element", redactClients(restricted, [CLIENT, CLIENT]).every((c) => c.email === undefined));
check("a non-array passes through", redactClients(restricted, null) === null);
check("null client doesn't throw", redactClient(restricted, null) === null);
check("undefined client doesn't throw", redactClient(restricted, undefined) === undefined);
check("a string isn't treated as a record", redactClient(restricted, "nope") === "nope");
check("no member means no access to detail", redactClient(null, CLIENT).email === undefined);

console.log("\nshareToken — a distribution capability, not a number\n");
const QUOTE = {
  id: "q1", quoteNumber: "Q-2026-0002", total: "27000",
  shareToken: "TaOVwgtMyn4OqPw1YKIwkBC9JHhp1u2P_hEAuTjlRzA",
  client: { ...CLIENT },
};
check("view_only cannot read the token", redactShareToken(restricted, QUOTE).shareToken === undefined);
check("view_create_edit keeps it", redactShareToken(fullView, QUOTE).shareToken === QUOTE.shareToken);
check("owner keeps it", redactShareToken(owner, QUOTE).shareToken === QUOTE.shareToken);

console.log("\nredactQuote does both halves — the bug was remembering one\n");
const rq = redactQuote(restricted, QUOTE);
check("token stripped", rq.shareToken === undefined);
check("nested client email stripped too", rq.client.email === undefined);
check("nested client name kept", rq.client.name === "Marie Tremblay");
check("source quote not mutated", QUOTE.shareToken.length > 10 && QUOTE.client.email === CLIENT.email);

console.log("\nThe level ladder still reads correctly\n");
check("name_address_only is below full_view", !hasLevel(restricted, "clientsProperties", "full_view"));
check("full_view meets full_view", hasLevel(fullView, "clientsProperties", "full_view"));
check("name_address_only still meets its own level", hasLevel(restricted, "clientsProperties", "name_address_only"));

console.log(`\n${pass + failures.length} checks, ${failures.length} failure(s).\n`);
if (failures.length) process.exitCode = 1;
