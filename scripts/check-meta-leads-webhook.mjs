// scripts/check-meta-leads-webhook.mjs
//
// The Page webhook object holds ONE callback URL, and that URL is the
// messaging webhook. This proves a `leadgen` change delivered there is
// imported by the same loop the leads route runs — executed, not read.
//
//   node --import ./scripts/alias-loader.mjs --import ./scripts/db-stub-loader.mjs scripts/check-meta-leads-webhook.mjs
import { readFileSync } from "node:fs";
import { register } from "node:module";
import { createHmac } from "node:crypto";
import { rows, resetDbStub } from "./fixtures/dbStub.mjs";
import { hasLeadgenChanges, ingestLeadgenChanges } from "@/lib/meta/leadsWebhookIngest";

let pass = 0;
let fail = 0;
function ok(label, cond, detail = "") {
  if (cond) pass++;
  else {
    fail++;
    console.error(`  ✗ ${label}${detail ? ` — ${detail}` : ""}`);
  }
}
const PAGE = "918147324721528";
function leadgenBody(overrides = {}) {
  return {
    object: "page",
    entry: [
      {
        id: PAGE,
        time: 1789234342,
        changes: [
          { field: "leadgen", value: { leadgen_id: "lg_1", page_id: PAGE, form_id: "form_1", created_time: 1789234342, ...overrides } },
        ],
      },
    ],
  };
}

// ── A. The shared loop ─────────────────────────────────────────────────────
ok("hasLeadgenChanges: a leadgen change is seen", hasLeadgenChanges(leadgenBody()));
ok("…a messaging-only batch is not", !hasLeadgenChanges({ object: "page", entry: [{ id: PAGE, messaging: [{}] }] }));
ok("…garbage is not", !hasLeadgenChanges(null) && !hasLeadgenChanges({ entry: "x" }));

resetDbStub();
let r = await ingestLeadgenChanges(leadgenBody());
ok("no company registered the Page → skipped unknown_page (acknowledged, never retried)", r.results.length === 1 && r.results[0].reason === "unknown_page" && r.retryNeeded === false, JSON.stringify(r));

rows.metaLeadForm = [{ id: "f1", companyId: "company_A", pageId: PAGE, formId: "form_1", active: false }];
r = await ingestLeadgenChanges(leadgenBody());
ok("form switched off → skipped form_inactive", r.results[0].reason === "form_inactive" && !r.retryNeeded);

rows.metaLeadForm[0].active = true;
const silenced = [];
const realError = console.error;
console.error = (...a) => silenced.push(a.join(" "));
r = await ingestLeadgenChanges(leadgenBody(), { log: "meta-messaging-webhook/leadgen" });
console.error = realError;
ok("form on, no ad-account connection → skipped no_connection, logged under the caller's tag", r.results[0].reason === "no_connection" && silenced.some((l) => l.startsWith("[meta-messaging-webhook/leadgen]")), JSON.stringify({ r, silenced }));

r = await ingestLeadgenChanges(leadgenBody({ leadgen_id: null }));
ok("no leadgen_id → incomplete_payload", r.results[0].reason === "incomplete_payload");

r = await ingestLeadgenChanges({ object: "page", entry: [{ id: PAGE, changes: [{ field: "feed", value: {} }] }] });
ok("another field's change is not a lead", r.results.length === 0);

// ── B. Both routes run it ──────────────────────────────────────────────────
const leadsSrc = readFileSync("app/api/meta/leads/webhook/route.js", "utf8");
const msgSrc = readFileSync("app/api/meta/messaging/webhook/route.js", "utf8");
ok("the leads route calls the shared loop and no longer carries its own", /ingestLeadgenChanges\(body\)/.test(leadsSrc) && !/change\?\.field !== "leadgen"/.test(leadsSrc));
ok("the messaging route runs it for a Page batch", /payload\?\.object === "page" && hasLeadgenChanges\(payload\)/.test(msgSrc) && /await ingestLeadgenChanges\(payload/.test(msgSrc));
ok("…and answers 200 regardless (Meta must not redeliver the messages in the batch)", /retryNeeded\) \{\s*console\.warn/.test(msgSrc) && !/status: 500/.test(msgSrc));

// ── C. The messaging route, executed with a signed leadgen delivery ────────
register(
  `data:text/javascript,${encodeURIComponent(`
export async function resolve(specifier, context, nextResolve) {
  if (specifier === "next/server") return { url: "fq-stub:next", shortCircuit: true };
  return nextResolve(specifier, context);
}
export async function load(url, context, nextLoad) {
  if (url === "fq-stub:next") {
    return { format: "module", shortCircuit: true, source: \`
export class NextResponse {
  constructor(body, init) { this.body = body; this.status = init?.status ?? 200; }
  static json(body, init) { const r = new NextResponse(body, init); r.json = async () => body; return r; }
}\` };
  }
  return nextLoad(url, context);
}
`)}`,
);
process.env.META_APP_SECRET = "test-secret";
const route = await import("@/app/api/meta/messaging/webhook/route.js");
async function post(body) {
  const raw = JSON.stringify(body);
  const sig = "sha256=" + createHmac("sha256", process.env.META_APP_SECRET).update(raw).digest("hex");
  const req = new Request("http://www.fieldquo.com/api/meta/messaging/webhook", {
    method: "POST",
    headers: { "content-type": "application/json", "x-hub-signature-256": sig, "x-forwarded-for": "10.9.9.9" },
    body: raw,
  });
  const res = await route.POST(req);
  return { status: res.status, json: typeof res.json === "function" ? await res.json() : null };
}
resetDbStub();
const realWarn = console.warn;
console.warn = () => {};
let out = await post(leadgenBody());
console.warn = realWarn;
ok("a signed leadgen delivery to the MESSAGING url is 200 with one lead handled and zero message events", out.status === 200 && out.json?.leads === 1 && out.json?.events === 0, JSON.stringify(out));
out = await post({ object: "instagram", entry: [{ id: "17841480173629186", changes: [{ field: "leadgen", value: { leadgen_id: "x", page_id: PAGE } }] }] });
ok("an Instagram-object batch never runs the lead loop", out.status === 200 && out.json?.leads === 0, JSON.stringify(out));

console.log(`check-meta-leads-webhook: ${pass} passed, ${fail} failed`);
if (fail) process.exit(1);
