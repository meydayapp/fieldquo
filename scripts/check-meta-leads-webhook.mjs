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
// Leads are read through the Facebook PAGE connection (resolveLeadsCredential),
// so "no connection" now means no Page connection — an ad account alone does
// not count, and is not what is checked for.
ok("form on, no Page connection → skipped no_page_connection, logged under the caller's tag", r.results[0].reason === "no_page_connection" && silenced.some((l) => l.startsWith("[meta-messaging-webhook/leadgen]")), JSON.stringify({ r, silenced }));

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

// ── D. Messages, through the same signed route ────────────────────────────
//
// 2026-09-28: the owner wrote to the TrueFinish Page from Facebook and from
// Instagram and nothing arrived until a manual Sync. Production logs held no
// request to this route at all, so Meta never posted — but "the receiver is
// fine" was a claim, not a result, until the real route had been handed the
// real shapes. These are Meta's documented bodies with the owner's real Page
// and Instagram ids: an inbound Page message, a re-delivery of it, an
// inbound Instagram DM, an Instagram echo (sender is the business account,
// which is how Instagram reports a reply sent from the Instagram app), an
// Instagram `messaging_seen` (a read with a mid and no watermark), a forged
// signature, and a Page the company has DISCONNECTED.
const IG = "17841480173629186";
const pageMsg = (mid, text, ts) => ({
  object: "page",
  entry: [{ id: PAGE, time: ts, messaging: [{ sender: { id: "PSID_OWNER" }, recipient: { id: PAGE }, timestamp: ts, message: { mid, text } }] }],
});
const igMsg = (item) => ({ object: "instagram", entry: [{ id: IG, time: 1790636400000, messaging: [item] }] });
resetDbStub();
rows.messagingChannel.push(
  { id: "ch_fb", companyId: "company_TF", platform: "facebook", externalId: PAGE, status: "connected", disconnectedAt: null, accessTokenEnc: "x" },
  { id: "ch_ig", companyId: "company_TF", platform: "instagram", externalId: IG, status: "connected", disconnectedAt: null, accessTokenEnc: "x" },
);
console.warn = () => {};
out = await post(pageMsg("m_fb_1", "Hello", 1790636936000));
ok("a signed Page message → 200, one event, one created", out.status === 200 && out.json?.events === 1 && out.json?.created === 1, JSON.stringify(out));
const fbThread = rows.messageThread.find((t) => t.channelId === "ch_fb");
ok("…filed under the Page's company, keyed on the sender's PSID", fbThread?.companyId === "company_TF" && fbThread?.externalThreadId === "PSID_OWNER", JSON.stringify(fbThread));
ok("…as an inbound message with the text and Meta's timestamp", rows.message.some((m) => m.externalId === "m_fb_1" && m.direction === "in" && m.body === "Hello" && m.sentAt instanceof Date && m.sentAt.getTime() === 1790636936000));
out = await post(pageMsg("m_fb_1", "Hello", 1790636936000));
ok("a re-delivery is 200 and creates nothing", out.status === 200 && out.json?.created === 0 && rows.message.filter((m) => m.externalId === "m_fb_1").length === 1, JSON.stringify(out));
ok("…and does not bump the unread badge twice", fbThread?.unread === 1, fbThread?.unread);

out = await post(igMsg({ sender: { id: "IGSID_OWNER" }, recipient: { id: IG }, timestamp: 1790636400000, message: { mid: "aWdfig_1", text: "Hey" } }));
const igThread = rows.messageThread.find((t) => t.channelId === "ch_ig");
ok("a signed Instagram DM → 200 and a thread on the Instagram channel", out.status === 200 && out.json?.created === 1 && igThread?.externalThreadId === "IGSID_OWNER", JSON.stringify(out));
out = await post(igMsg({ sender: { id: IG }, recipient: { id: "IGSID_OWNER" }, timestamp: 1790636460000, message: { mid: "aWdfig_2", text: "Hi! How can we help?", is_echo: true } }));
ok("an Instagram echo lands in the SAME thread as an outbound reply", out.json?.created === 1 && rows.message.some((m) => m.externalId === "aWdfig_2" && m.direction === "out" && m.threadId === igThread?.id), JSON.stringify(out));
ok("…and clears the waiting badge", igThread?.unread === 0, igThread?.unread);
out = await post(igMsg({ sender: { id: "IGSID_OWNER" }, recipient: { id: IG }, timestamp: 1790636500000, read: { mid: "aWdfig_2" } }));
ok("an Instagram `messaging_seen` (mid, no watermark) is acknowledged with 200 and writes no message", out.status === 200 && rows.message.length === 3, JSON.stringify(out));

const forged = JSON.stringify(pageMsg("m_forged", "Pay this invoice", 1790636999000));
const realErr = console.error;
console.error = () => {};
const forgedRes = await route.POST(new Request("http://www.fieldquo.com/api/meta/messaging/webhook", {
  method: "POST",
  headers: { "content-type": "application/json", "x-hub-signature-256": "sha256=" + "0".repeat(64), "x-forwarded-for": "10.9.9.9" },
  body: forged,
}));
ok("a forged signature is 403 and writes nothing", forgedRes.status === 403 && !rows.message.some((m) => m.externalId === "m_forged"), forgedRes.status);

rows.messagingChannel[0].disconnectedAt = new Date();
out = await post(pageMsg("m_fb_2", "Still there?", 1790637000000));
ok("a Page the company DISCONNECTED is 200 (Meta keeps the subscription) and files nothing", out.status === 200 && !rows.message.some((m) => m.externalId === "m_fb_2"), JSON.stringify(out));
console.warn = realWarn;
console.error = realErr;

// ── E. Which token reads the lead — the REAL client, Graph stubbed at fetch ─
//
// 2026-09-28, TrueFinish: an ad-account connection (ads_read) AND a Facebook
// Page connection (leads_retrieval, pages_manage_ads, … and a stored page
// token). "Find my lead forms" said 0 and the Lead Ads Testing Tool's lead
// never arrived: every lead read minted a page token from GET /me/accounts
// with the AD connection's user token. Here nothing between the route and
// fetch() is stubbed except the database and the session — lib/meta/client.js,
// lib/meta/leadsFetch.js, lib/meta/pageConnection.js and the real AES-GCM
// token crypto all run — and each Graph request records the token it carried.
process.env.META_TOKEN_ENCRYPTION_KEY = "11".repeat(32);
const { encryptToken } = await import("@/lib/meta/tokenCrypto");
const graphHits = [];
let graphAnswer = () => ({ status: 404, body: { error: { message: "unscripted", code: 803 } } });
const realFetch = globalThis.fetch;
globalThis.fetch = async (input, init) => {
  const url = new URL(String(input));
  if (url.hostname !== "graph.facebook.com") return realFetch(input, init);
  const token = url.searchParams.get("access_token") || new URLSearchParams(String(init?.body || "")).get("access_token");
  const path = url.pathname.replace(/^\/v[\d.]+/, "");
  graphHits.push({ path, token });
  const { status, body } = graphAnswer(path);
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
};
const TF_SCOPES =
  "pages_show_list,ads_read,pages_messaging,instagram_basic,instagram_content_publish,leads_retrieval,instagram_manage_messages,pages_read_engagement,pages_manage_metadata,pages_manage_ads,pages_manage_posts,public_profile";
function seedTruefinish() {
  resetDbStub();
  graphHits.length = 0;
  rows.metaLeadForm = [{ id: "f_tf", companyId: "company_TF", pageId: PAGE, pageName: "Truefinish Cabinets", formId: "form_1", name: "free quote", active: true }];
  rows.metaAdConnection = [{ id: "ad_tf", companyId: "company_TF", adAccountId: "act_14771954", status: "connected", accessTokenEnc: encryptToken("AD_USER_TOKEN") }];
  rows.metaPageConnection = [{
    id: "pc_tf", companyId: "company_TF", pageId: PAGE, pageName: "Truefinish Cabinets",
    pageAccessTokenEnc: encryptToken("TF_PAGE_TOKEN"), scopes: TF_SCOPES, connectedAt: new Date(), disconnectedAt: null,
  }];
}
const LAM_REFUSAL = { status: 400, body: { error: { message: "CRM access has been revoked from Lead Access Manager", type: "OAuthException", code: 200 } } };

seedTruefinish();
graphAnswer = (path) =>
  path === "/lg_1"
    ? { status: 200, body: { id: "lg_1", created_time: "2026-09-28T20:10:00+0000", ad_id: "AD_1", form_id: "form_1", field_data: [{ name: "full_name", values: ["Test Lead"] }, { name: "phone_number", values: ["+15145550100"] }] } }
    : path === "/AD_1"
      ? { status: 200, body: { id: "AD_1", campaign: { id: "C_1", name: "Spring" } } }
      : { status: 404, body: { error: { message: "unscripted " + path, code: 803 } } };
console.error = () => {};
console.warn = () => {};
console.log = ((log) => (...a) => (String(a[0]).startsWith("[meta/leads]") ? undefined : log(...a)))(console.log);
r = await ingestLeadgenChanges(leadgenBody());
console.error = realErr;
console.warn = realWarn;
const leadHit = graphHits.find((h) => h.path === "/lg_1");
ok("the webhook's lead is read with the Page connection's STORED page token", leadHit?.token === "TF_PAGE_TOKEN", JSON.stringify(graphHits));
ok("…and nothing asks /me/accounts, or reads the lead with the ad-account token", !graphHits.some((h) => h.path === "/me/accounts") && !graphHits.some((h) => h.path === "/lg_1" && h.token === "AD_USER_TOKEN"), JSON.stringify(graphHits));
ok("campaign attribution still reads the ad with the ad-account token", graphHits.some((h) => h.path === "/AD_1" && h.token === "AD_USER_TOKEN"), JSON.stringify(graphHits));
ok("the lead is imported", r.results[0]?.status === "created" && !r.retryNeeded, JSON.stringify(r.results));

seedTruefinish();
graphAnswer = (path) => (path === "/lg_1" ? LAM_REFUSAL : { status: 404, body: { error: { message: "unscripted", code: 803 } } });
console.error = () => {};
r = await ingestLeadgenChanges(leadgenBody());
console.error = realErr;
ok("Meta's Leads Access Manager refusal is classified leads_access and not retried", r.results[0]?.reason === "leads_access" && r.retryNeeded === false, JSON.stringify(r));

// "Find my lead forms", through the real route and the real client.
const { setCurrentMember } = await import("./fixtures/currentMemberStub.mjs");
const refreshRoute = await import("@/app/api/meta/leads/forms/refresh/route.js");
process.env.META_LEADS_ENABLED = "1";
setCurrentMember({ companyId: "company_TF", role: "owner", userId: "u_owner" });
async function refresh() {
  const res = await refreshRoute.POST(new Request("http://www.fieldquo.com/api/meta/leads/forms/refresh", { method: "POST" }));
  return { status: res.status, json: typeof res.json === "function" ? await res.json() : null };
}
seedTruefinish();
rows.metaLeadForm = [];
graphAnswer = (path) =>
  path === `/${PAGE}/leadgen_forms`
    ? { status: 200, body: { data: [{ id: "form_free_quote", name: "free quote", status: "ACTIVE" }] } }
    : { status: 200, body: { data: [] } }; // what /me/accounts answered TrueFinish
out = await refresh();
const formsHit = graphHits.find((h) => h.path === `/${PAGE}/leadgen_forms`);
ok("\"Find my lead forms\" reads the connected Page's forms with the stored page token", formsHit?.token === "TF_PAGE_TOKEN" && !graphHits.some((h) => h.path === "/me/accounts"), JSON.stringify(graphHits));
ok("…finds \"free quote\", names the Page, and stores it OFF", out.status === 200 && out.json?.found === 1 && out.json?.page?.name === "Truefinish Cabinets" && rows.metaLeadForm.some((f) => f.formId === "form_free_quote" && f.active === false && f.pageId === PAGE), JSON.stringify({ out, forms: rows.metaLeadForm }));

seedTruefinish();
graphAnswer = (path) => (path === `/${PAGE}/leadgen_forms` ? LAM_REFUSAL : { status: 200, body: { data: [] } });
out = await refresh();
ok("a Leads Access Manager refusal on discovery answers code leads_access with the Page", out.status === 502 && out.json?.code === "leads_access" && out.json?.page?.id === PAGE, JSON.stringify(out));

seedTruefinish();
rows.metaPageConnection = [];
out = await refresh();
ok("with only the ad-account connection, discovery refuses no_page_connection and calls nothing", out.status === 409 && out.json?.code === "no_page_connection" && graphHits.length === 0, JSON.stringify({ out, graphHits }));
delete process.env.META_LEADS_ENABLED;
globalThis.fetch = realFetch;

console.log(`check-meta-leads-webhook: ${pass} passed, ${fail} failed`);
if (fail) process.exit(1);
