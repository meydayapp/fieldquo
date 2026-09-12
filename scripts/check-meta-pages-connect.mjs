// scripts/check-meta-pages-connect.mjs
//
//   npm run check:meta-pages-connect
//
// The Facebook/Instagram publishing code was written months before anything
// could connect a Page to it: lib/social/metaConnection.js calls itself "THE
// SEAM" and returned "not_built" for every real company, so a complete
// publish path could never run. This file guards the connection that replaced
// that stub.
//
// Two things are worth failing a build over.
//
// A Page access token is a credential that can post publicly as somebody
// else's business. It is encrypted at rest, and it must never leave the
// server — not in a JSON body, not in a redirect URL, not in a log line.
//
// And the seam has a CONTRACT the publish flow was written against: a shape,
// a demo branch that must stay fabricated, and a dead token that must be
// REPORTED rather than thrown, because the settings screen is where a
// contractor finds out their connection lapsed.
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { connectionStatusKey } from "../lib/social/metaConnection.js";
import { publicPageConnectionShape } from "../lib/meta/pageConnection.js";
import {
  subscribePageWebhook,
  unsubscribePageWebhook,
  missingWebhookPermissions,
  inboxPlatformsGranted,
} from "../lib/meta/pageConnect.js";
import {
  PAGE_MESSAGING_WEBHOOK_FIELDS,
  META_OAUTH_SCOPE,
  META_MESSAGING_SCOPE,
  META_PAGES_SCOPE,
  metaPagesRequestedScope,
  buildAuthorizeUrl,
  metaPagesConfigId,
  classifyEmptyPageList,
} from "../lib/meta/client.js";
import { parseMessagingEnvelope } from "../lib/messaging/envelope.js";
import {
  savePageMessagingChannels,
  disconnectPageMessagingChannels,
  missingPageChannels,
} from "../lib/messaging/pageChannels.js";
import { ingestEvent } from "../lib/messaging/ingest.js";
import { rows, resetDbStub } from "./fixtures/dbStub.mjs";
import { APP_MESSAGES } from "../app/i18n/appMessages.js";

let passed = 0;
let failed = 0;
function ok(name, cond, extra) {
  if (cond) passed += 1;
  else {
    failed += 1;
    console.error(`  ✗ ${name}`, extra === undefined ? "" : String(JSON.stringify(extra)).slice(0, 220));
  }
}
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (p) => fs.readFileSync(path.join(ROOT, p), "utf8");
// Only code may satisfy a pin — a comment explaining a rule is not the rule.
const code = (p) => read(p).split("\n").filter((l) => {
  const t = l.trim();
  return !t.startsWith("//") && !t.startsWith("*") && !t.startsWith("/*");
}).join("\n");

// ── The token never leaves the server ──────────────────────────────────────
{
  const shaped = publicPageConnectionShape({
    id: "pc1", companyId: "co1", pageId: "123", pageName: "Northline Painting",
    pageAccessToken: "ENCRYPTED-BYTES-THAT-MUST-NOT-TRAVEL",
    instagramUserId: "ig1", instagramUsername: "northline",
    connectedAt: new Date(), disconnectedAt: null,
  });
  const json = JSON.stringify(shaped ?? {});
  ok("the browser-visible shape carries no token", !/ENCRYPTED-BYTES/.test(json) && !/token/i.test(json), json.slice(0, 200));
  ok("...but does carry what the screen has to show",
    /Northline Painting/.test(json) && /northline/.test(json), json.slice(0, 200));
  ok("a missing connection shapes to nothing, not an empty-looking connection",
    publicPageConnectionShape(null) === null || publicPageConnectionShape(null) === undefined);
}
// A token passed INTO the store is correct; a token passed OUT to a browser
// is the bug. So this reads what each route actually answers with, rather
// than whether the word appears in the file.
function responsePayloads(src) {
  const out = [];
  for (const m of src.matchAll(/NextResponse\.json\(/g)) {
    // Balance the parens rather than taking a fixed window — a window long
    // enough to hold a real payload also swallows the lines after it, and
    // then an unrelated `pageToken` two statements later reads as a leak.
    let depth = 0;
    let i = m.index + m[0].length - 1;
    for (; i < src.length; i++) {
      if (src[i] === "(") depth += 1;
      else if (src[i] === ")" && --depth === 0) break;
    }
    out.push(src.slice(m.index, i + 1));
  }
  return out;
}
for (const f of [
  "app/api/settings/social/status/route.js",
  "app/api/settings/social/callback/route.js",
  "app/api/settings/social/finalize/route.js",
  "app/api/settings/social/connect/route.js",
  "app/api/settings/social/disconnect/route.js",
]) {
  const name = f.split("/").slice(-2)[0];
  const src = code(f);
  // Strip quoted text first: "Meta returned no access token for that Page."
  // is prose telling a contractor what went wrong, not a credential. What
  // would be a leak is an identifier — pageToken, access_token — used as a
  // VALUE in the payload.
  const withoutProse = (p) => p.replace(/"(?:[^"\\]|\\.)*"/g, '""').replace(/'(?:[^'\\]|\\.)*'/g, "''");
  const leaks = responsePayloads(src)
    .map(withoutProse)
    .filter((p) => /[Tt]oken/.test(p) && !/csrf|state/i.test(p));
  ok(`${name}: nothing it answers with carries a token`, leaks.length === 0, leaks.map((l) => l.slice(0, 120)));
  ok(`${name}: no token is logged`,
    !/console\.(log|error|warn)\([^)]*[Tt]oken/.test(src), f);
}
{
  // A redirect URL ends up in browser history and in server access logs.
  const cb = code("app/api/settings/social/callback/route.js");
  ok("the callback never puts a token in a redirect",
    !/redirect\([^)]*[Tt]oken/.test(cb));
}

// ── The token is encrypted at rest, through the one door ───────────────────
{
  const store = code("lib/meta/pageConnection.js");
  ok("the store encrypts on write", /encryptToken\(/.test(store));
  ok("...and decrypts only at the point of use", /decryptToken\(/.test(store));
  ok("...and writing is the one door", /savePageConnection/.test(store));
  // The column is the ENCRYPTED one; nulling it is what actually removes the
  // credential, and the row survives so the history of the connection does.
  ok("disconnect removes the token from the database",
    /disconnectPageConnection/.test(store) && /pageAccessTokenEnc:\s*null/.test(store));
  ok("...and stamps when it happened, rather than deleting the history",
    /disconnectedAt:\s*new Date\(\)/.test(store));
  ok("a live connection is one that has not been disconnected",
    /disconnectedAt:\s*null/.test(store));
}

// ── The seam's contract ────────────────────────────────────────────────────
{
  const seam = code("lib/social/metaConnection.js");
  ok("the seam still returns the shape the publish flow was written against",
    ["connected", "pageId", "pageName", "pageAccessToken", "instagramUserId", "instagramUsername"]
      .every((k) => new RegExp(`${k}\\b`).test(seam)));
  // The whole point of the demo branch: a mock company gets a working-looking
  // connection, and must never get bytes that could be mistaken for real.
  ok("the demo branch is still fabricated, never a real token",
    /mock:\s*true/.test(seam) && /demo-token-not-a-real-credential/.test(seam));
  ok("a real company is decided by Company.isDemo, read fresh", /isDemo/.test(seam));
  // A lapsed token is the failure a contractor has to be TOLD about. Throwing
  // turns the settings screen into an error page that says nothing useful.
  ok("a dead token is reported, not thrown",
    /notConnected\("token_expired"\)/.test(seam) && !/throw new Error\([^)]*expired/i.test(seam));
  ok("...and a token that cannot be decrypted is its own reason, not 'expired'",
    /unreadable_token/.test(seam));
  ok("the seam no longer answers not_built for a real company",
    !/reason:\s*"not_built"/.test(seam), "not_built should be gone now the connection exists");
}
ok("every reason the seam returns has a status key the screen can print", (() => {
  const keys = ["token_expired", "unreadable_token", "revoked", null].map((reason) =>
    connectionStatusKey({ connected: false, reason }),
  );
  return keys.every((k) => typeof k === "string" && k.length > 0);
})());
ok("a connected connection does not read as an error",
  connectionStatusKey({ connected: true, reason: null }) !== connectionStatusKey({ connected: false, reason: "token_expired" }));

// ── The flag, and not drawing a control that cannot work ───────────────────
{
  const client = code("lib/meta/client.js");
  ok("the ads consent screen is unchanged", /META_OAUTH_SCOPE\s*=\s*"ads_read"/.test(client));
  ok("the Pages scope is its own constant", /META_PAGES_SCOPE/.test(client));
  ok("...and asks for exactly the five the Graph calls need",
    ["pages_show_list", "pages_manage_posts", "pages_read_engagement", "instagram_basic", "instagram_content_publish"]
      .every((s) => new RegExp(s).test(client)));
  ok("a flag decides whether the Pages flow is offered at all", /metaPagesConnectEnabled/.test(client));

  const connect = code("app/api/settings/social/connect/route.js");
  ok("the connect route refuses server-side when the flag is off",
    /metaPagesConnectEnabled\(\)/.test(connect),
    "hiding a button is not a gate — the route must refuse too");

  const panel = code("app/components/settings/SocialPublishingPanel.js");
  ok("the panel decides from the server's answer, not from a guess",
    /connectEnabled/.test(panel) && /fullyConfigured/.test(panel));
  // Both entry points, not just the first one.
  ok("neither Connect nor Reconnect is drawn when the flow is unavailable",
    (panel.match(/canConnect &&/g) || []).length >= 2,
    (panel.match(/canConnect &&/g) || []).length);
  // Taking a credential away must never depend on being able to grant one.
  ok("...but Disconnect is always available", /setShowDisconnectConfirm\(true\)/.test(panel));
}

// ── Tenancy and CSRF ───────────────────────────────────────────────────────
{
  const cb = code("app/api/settings/social/callback/route.js");
  ok("the callback verifies the state cookie it set", /state/i.test(cb) && /cookie/i.test(cb.toLowerCase()));
  const store = code("lib/meta/pageConnection.js");
  ok("every read of a connection is scoped to one company", /companyId/.test(store));
}


// ═══════════════════════════════════════════════════════════════════════════
// The subscription — the call without which a connected Page delivers nothing
// ═══════════════════════════════════════════════════════════════════════════
//
// The bug this section exists for: the connect flow stored a Page token and
// never called POST /<page-id>/subscribed_apps, so app/api/meta/messaging/
// webhook — a correct, signature-verifying, idempotent endpoint — was pointed
// at by nothing. The inbox, the outcomes, the AI employee, the monthly review
// and the attribution rollup were all waiting on messages Meta had never been
// asked to send. lib/meta/whatsappConnect.js had solved the same problem for
// WhatsApp and said so in a comment ("without this, no webhook ever fires");
// the Page half was simply missing.
//
// Everything below EXECUTES rather than greps wherever it can: the Graph calls
// run against a stubbed global fetch, so the URL, the method, the fields and —
// the one that matters most — WHICH TOKEN went out are read off the real
// request the real code built.

// ── The fields are exactly what the envelope parser reads ──────────────────
{
  const fields = [...PAGE_MESSAGING_WEBHOOK_FIELDS];
  const ev = (payload) => parseMessagingEnvelope(payload).events;
  const page = (item) => ({
    object: "page",
    entry: [{ id: "PAGE_1", time: 1, messaging: [item] }],
  });

  // Each field is claimed to exist because a branch of the parser reads it.
  // So: run that branch, and only subscribe to a field whose branch produces
  // an event. A field nothing reads is traffic that costs a signature check
  // and produces no row (AGENTS.md failure class 1, aimed at a webhook).
  const READS = {
    messages: ev(page({
      sender: { id: "HOMEOWNER" }, recipient: { id: "PAGE_1" }, timestamp: 1,
      message: { mid: "m1", text: "Can you quote a kitchen?" },
    }))[0],
    message_echoes: ev(page({
      sender: { id: "PAGE_1" }, recipient: { id: "HOMEOWNER" }, timestamp: 2,
      message: { mid: "m2", text: "Yes — Tuesday?", is_echo: true },
    }))[0],
    message_deliveries: ev(page({
      sender: { id: "HOMEOWNER" }, recipient: { id: "PAGE_1" },
      delivery: { mids: ["m2"], watermark: 3 },
    }))[0],
    message_reads: ev(page({
      sender: { id: "HOMEOWNER" }, recipient: { id: "PAGE_1" },
      read: { watermark: 4 },
    }))[0],
  };

  ok("the subscribed fields are exactly the four the parser reads",
    fields.slice().sort().join(",") === Object.keys(READS).sort().join(","), fields);
  ok("`messages` produces an inbound message event",
    READS.messages?.kind === "message" && READS.messages?.direction === "in", READS.messages);
  ok("`message_echoes` produces the OUTBOUND half — without it the review has no reply to time",
    READS.message_echoes?.kind === "message" && READS.message_echoes?.direction === "out", READS.message_echoes);
  ok("`message_deliveries` produces a delivery receipt", READS.message_deliveries?.kind === "delivery");
  ok("`message_reads` produces a read receipt", READS.message_reads?.kind === "read");

  // The brief for this change named messaging_postbacks. The parser drops a
  // postback (its own final branch counts it alongside opt-ins, reactions and
  // referrals), so subscribing to it would be asking Meta for traffic nothing
  // turns into a row. It goes in the day a branch reads it.
  const postback = parseMessagingEnvelope(page({
    sender: { id: "HOMEOWNER" }, recipient: { id: "PAGE_1" },
    postback: { title: "Get started", payload: "START" },
  }));
  ok("a postback is still dropped by the parser, so it is NOT subscribed",
    postback.events.length === 0 && postback.dropped === 1 && !fields.includes("messaging_postbacks"),
    fields);
}

// ── Connecting subscribes, with the PAGE token and never the user token ────
//
// A user token on /<page-id>/subscribed_apps is refused by Meta. This runs the
// real function against a stubbed fetch and reads the token out of the request
// body, so passing the wrong one at the call site cannot pass this check.
const GRANTED = "pages_show_list,pages_read_engagement,pages_messaging,pages_manage_metadata,instagram_basic";
function stubFetch(reply) {
  const calls = [];
  const original = globalThis.fetch;
  globalThis.fetch = async (url, init = {}) => {
    const body = init.body ? new URLSearchParams(String(init.body)) : null;
    calls.push({
      url: String(url),
      method: init.method || "GET",
      query: new URL(String(url)).searchParams,
      body,
    });
    return {
      ok: reply.status < 400,
      status: reply.status,
      headers: new Headers(),
      json: async () => reply.body,
    };
  };
  return { calls, restore: () => { globalThis.fetch = original; } };
}

{
  const { calls, restore } = stubFetch({ status: 200, body: { success: true } });
  const res = await subscribePageWebhook({
    pageToken: "PAGE-TOKEN", pageId: "PAGE_1", grantedScopes: GRANTED,
  });
  restore();

  ok("connecting subscribes the Page", calls.length === 1, calls.length);
  ok("...on the subscribed_apps edge of that Page",
    calls[0]?.url.includes("/PAGE_1/subscribed_apps"), calls[0]?.url);
  ok("...as a POST", calls[0]?.method === "POST", calls[0]?.method);
  ok("...with the PAGE token",
    calls[0]?.body?.get("access_token") === "PAGE-TOKEN", calls[0]?.body?.get("access_token"));
  ok("...and NEVER the user token",
    !String(calls[0]?.url).includes("USER-TOKEN") &&
      calls[0]?.body?.get("access_token") !== "USER-TOKEN");
  ok("...naming exactly the parser's fields",
    calls[0]?.body?.get("subscribed_fields") === PAGE_MESSAGING_WEBHOOK_FIELDS.join(","),
    calls[0]?.body?.get("subscribed_fields"));
  ok("a confirmed subscribe stamps when it happened",
    res.webhookSubscribedAt instanceof Date && res.webhookSubscribeError === null, res);
}

// ── THE PIN: not connected until subscribed ────────────────────────────────
{
  const { calls, restore } = stubFetch({
    status: 403,
    body: { error: { code: 200, message: "(#200) Requires pages_manage_metadata" } },
  });
  const res = await subscribePageWebhook({
    pageToken: "PAGE-TOKEN", pageId: "PAGE_1", grantedScopes: GRANTED,
  });
  restore();
  ok("a REFUSED subscribe was still attempted", calls.length === 1);
  ok("a refused subscribe never stamps a subscription",
    res.webhookSubscribedAt === null, res);
  ok("...and records why, so the panel can say it and offer a retry",
    typeof res.webhookSubscribeError === "string" && res.webhookSubscribeError.length > 0, res);
}
{
  // Meta's own shape for a refusal dressed as a 200. Treating it as a
  // subscription is precisely the connection that looks perfect and receives
  // nothing.
  const { restore } = stubFetch({ status: 200, body: { success: false } });
  const res = await subscribePageWebhook({
    pageToken: "PAGE-TOKEN", pageId: "PAGE_1", grantedScopes: GRANTED,
  });
  restore();
  ok("a 200 that does not confirm is not a subscription",
    res.webhookSubscribedAt === null && Boolean(res.webhookSubscribeError), res);
}
{
  // The third state: never attempted, because the permissions the call needs
  // were not granted. Two nulls — not a failure, because nobody asked Meta
  // anything, and telling a contractor Meta refused sends them to a retry that
  // cannot work.
  const { calls, restore } = stubFetch({ status: 200, body: { success: true } });
  const res = await subscribePageWebhook({
    pageToken: "PAGE-TOKEN", pageId: "PAGE_1",
    grantedScopes: "pages_show_list,pages_manage_posts,instagram_basic",
  });
  restore();
  ok("no permission, no call — Meta is not asked something it must refuse", calls.length === 0);
  ok("...and 'never attempted' is stored as neither subscribed nor failed",
    res.webhookSubscribedAt === null && res.webhookSubscribeError === null, res);

  ok("missingWebhookPermissions names both, and names them from what Meta GRANTED",
    missingWebhookPermissions("pages_show_list").sort().join(",") === "pages_manage_metadata,pages_messaging");
  ok("...and an unreadable granted list is not permission to assume anything",
    missingWebhookPermissions(null).length === 2 && missingWebhookPermissions("").length === 2);
  ok("...and a fully granted list leaves nothing missing",
    missingWebhookPermissions(GRANTED).length === 0);
}

// ── Disconnecting unsubscribes ─────────────────────────────────────────────
{
  const { calls, restore } = stubFetch({ status: 200, body: { success: true } });
  const res = await unsubscribePageWebhook({
    pageToken: "PAGE-TOKEN", pageId: "PAGE_1", wasSubscribed: true,
  });
  restore();
  ok("disconnecting removes the subscription", calls.length === 1 && res.ok === true);
  ok("...with a DELETE on the same edge",
    calls[0]?.method === "DELETE" && calls[0]?.url.includes("/PAGE_1/subscribed_apps"), calls[0]);
  ok("...carrying the PAGE token in the query string, where a DELETE takes it",
    calls[0]?.query.get("access_token") === "PAGE-TOKEN", calls[0]?.url);
}
{
  const { calls, restore } = stubFetch({ status: 500, body: { error: { message: "nope" } } });
  const res = await unsubscribePageWebhook({
    pageToken: "PAGE-TOKEN", pageId: "PAGE_1", wasSubscribed: true,
  });
  restore();
  ok("a refused unsubscribe is recorded, never silently skipped",
    calls.length === 1 && res.ok === false && typeof res.error === "string" && res.error.length > 0, res);
}
{
  const { calls, restore } = stubFetch({ status: 200, body: { success: true } });
  const res = await unsubscribePageWebhook({ pageToken: "PAGE-TOKEN", pageId: "PAGE_1", wasSubscribed: false });
  restore();
  ok("nothing subscribed means nothing to remove, and no invented failure",
    calls.length === 0 && res.skipped === true && res.error === null, res);
}

// ── The wiring: both connect paths, the disconnect, and the panel ──────────
{
  const cb = code("app/api/settings/social/callback/route.js");
  const fin = code("app/api/settings/social/finalize/route.js");
  ok("the single-Page callback subscribes before it stores the connection",
    /subscribePageWebhook\(/.test(cb) && cb.indexOf("subscribePageWebhook") < cb.indexOf("savePageConnection("),
    "the row must never claim a state Meta has not confirmed");
  ok("...passing the PAGE token, not the long-lived USER token",
    /subscribePageWebhook\(\{\s*pageToken,/.test(cb) && !/subscribePageWebhook\([^)]*longToken/.test(cb));
  ok("...and storing the outcome on the connection", /\.\.\.webhook,/.test(cb));
  ok("the Page-picker finalize does the same",
    /subscribePageWebhook\(\{/.test(fin) && /pageToken: page\.access_token/.test(fin) && /\.\.\.webhook,/.test(fin));

  const dis = code("app/api/settings/social/disconnect/route.js");
  ok("disconnect tells Meta to stop", /unsubscribePageWebhook\(/.test(dis));
  // The CALL sites, not the identifiers: every name here also appears in the
  // import block at the top of the file, so comparing indexOf on the bare
  // names compares two import lines and passes whatever the body does.
  ok("...BEFORE the token that could tell it is destroyed",
    dis.indexOf("await unsubscribePageWebhook(") < dis.indexOf("await disconnectPageConnection("),
    "nulling the token first leaves a subscription nothing can remove");
  ok("...and a failure is reported to the screen, not swallowed",
    /webhookUnsubscribed/.test(dis) && /webhookSubscribeError/.test(dis));

  const store = code("lib/meta/pageConnection.js");
  ok("a reconnect cannot inherit the previous connection's subscription",
    /webhookSubscribedAt: webhookSubscribedAt \?\? null/.test(store));
  ok("a disconnect clears it", /webhookSubscribedAt: null/.test(store));
}
{
  const panel = code("app/components/settings/SocialPublishingPanel.js");
  // The three states, as three branches. A grep for the field name alone
  // would survive a mutation that collapsed the branch, so this pins the
  // ternary itself.
  ok("the panel decides from the stored subscription, not from 'a row exists'",
    /\{connection\.webhookSubscribedAt \? \(/.test(panel));
  ok("a FAILED subscribe has its own branch — it must not read as working",
    /\) : connection\.webhookSubscribeErrorKind \? \(/.test(panel));
  ok("...which offers a retry rather than a dead end",
    /handleRetryWebhook/.test(panel) && /"\/api\/settings\/social\/subscribe"/.test(panel));
  ok("...and 'never attempted' says which permissions are missing",
    /webhookMissingPermissions/.test(panel));
  ok("a disconnect Meta would not confirm is said out loud",
    /webhookUnsubscribed === false/.test(panel));

  const retry = code("app/api/settings/social/subscribe/route.js");
  ok("the retry route exists and is a POST", /export async function POST\(/.test(retry));
  ok("...gated on the same billing-admin check as every other social route",
    /isBillingAdmin\(member\.role\)/.test(retry));
  ok("...and takes its Page from the stored connection, never from the body",
    /getPageConnection\(member\.companyId\)/.test(retry) && !/request\.json\(\)/.test(retry));
}

// ── The scopes ─────────────────────────────────────────────────────────────
{
  ok("the ads consent screen is still exactly ads_read", META_OAUTH_SCOPE === "ads_read", META_OAUTH_SCOPE);
  ok("pages_manage_metadata is in the MESSAGING scope — the permission the subscribe needs",
    META_MESSAGING_SCOPE.split(",").includes("pages_manage_metadata"), META_MESSAGING_SCOPE);
  ok("...and is NOT in the ads scope",
    !META_OAUTH_SCOPE.split(",").includes("pages_manage_metadata"), META_OAUTH_SCOPE);
}

// ── The shape, and nine languages ──────────────────────────────────────────
{
  const shaped = publicPageConnectionShape({
    pageId: "123", pageName: "Northline Painting", connectedAt: new Date(),
    webhookSubscribedAt: new Date("2026-09-01"),
    webhookSubscribeError: "auth_error: Error validating access token: the session is invalid",
  });
  ok("the panel is told WHEN the subscription happened", Boolean(shaped.webhookSubscribedAt));
  ok("...and the failure KIND, never Meta's own prose",
    shaped.webhookSubscribeErrorKind === "auth_error" &&
      !JSON.stringify(shaped).includes("session is invalid"), shaped);
  ok("an unrecognised stored kind cannot become an i18n key nobody wrote",
    publicPageConnectionShape({ pageId: "1", webhookSubscribeError: "surprise: x" })
      .webhookSubscribeErrorKind === "unknown_error");
  ok("no error means no kind",
    publicPageConnectionShape({ pageId: "1" }).webhookSubscribeErrorKind === null);
}
{
  const NEW_KEYS = [
    "app.setSocial.webhookOn",
    "app.setSocial.webhookOffTitle",
    "app.setSocial.webhookFailedBody",
    "app.setSocial.webhookRetry",
    "app.setSocial.webhookPendingBody",
    "app.setSocial.webhookRetryOk",
    "app.setSocial.disconnectStillSubscribed",
  ];
  const langs = Object.keys(APP_MESSAGES);
  ok("nine language blocks", langs.length === 9, langs);
  const missing = [];
  for (const lang of langs) {
    for (const k of NEW_KEYS) {
      const v = APP_MESSAGES[lang][k];
      if (typeof v !== "string" || !v.trim()) missing.push(`${lang}:${k}`);
      else if (v.includes("$")) missing.push(`${lang}:${k} contains a literal $`);
    }
  }
  ok("every new key is written in all nine, with no literal currency sign", missing.length === 0, missing);
  ok("the two keys that interpolate do so in all nine",
    langs.every((l) => APP_MESSAGES[l]["app.setSocial.webhookOn"].includes("{date}") &&
      APP_MESSAGES[l]["app.setSocial.webhookPendingBody"].includes("{scopes}")));
}

// ═══════════════════════════════════════════════════════════════════════════
// ONE connection, both halves — the Page connect creates the inbox channels
// ═══════════════════════════════════════════════════════════════════════════
//
// The bug: lib/messaging/ingest.js resolves a tenant with
// channelForExternalId(platform, entry.id) against MessagingChannel rows, and
// saveChannel had exactly ONE caller — the WhatsApp callback. Nothing anywhere
// created a channel with platform `facebook` or `instagram`, so even with the
// Page subscribed to Meta's messaging webhook, every inbound message was
// answered `unknown_page` and dropped. The inbox, the outcomes, the AI
// employee, the monthly review and the attribution all hang off a message that
// could not arrive.
//
// So the round trip is EXECUTED end to end against the database stub: connect
// a Page, then feed the real ingest a real webhook envelope carrying that Page
// id, and assert it resolves. A grep for `saveChannel(` in the callback would
// have passed on a version that keyed the row on the wrong id.

// ── The union scope: one consent screen, not two ───────────────────────────
{
  const before = process.env.META_MESSAGING_APPROVED;

  process.env.META_MESSAGING_APPROVED = "";
  const publishingOnly = metaPagesRequestedScope();
  ok("with messaging unapproved the Pages dialog asks for exactly the publishing scope",
    publishingOnly === META_PAGES_SCOPE, publishingOnly);

  process.env.META_MESSAGING_APPROVED = "true";
  const union = metaPagesRequestedScope();
  const asked = union.split(",");
  ok("once Meta approves messaging the SAME dialog asks for both halves",
    META_PAGES_SCOPE.split(",").every((s) => asked.includes(s)) &&
      META_MESSAGING_SCOPE.split(",").every((s) => asked.includes(s)), union);
  ok("...composed, not concatenated — no permission is asked for twice",
    asked.length === new Set(asked).size, union);
  ok("...and pages_messaging is in it, which is the whole point",
    asked.includes("pages_messaging"), union);

  process.env.META_MESSAGING_APPROVED = before;
  if (before === undefined) delete process.env.META_MESSAGING_APPROVED;

  // The ads consent screen is a different dialog and must not have moved.
  ok("the ads consent screen is STILL exactly ads_read", META_OAUTH_SCOPE === "ads_read", META_OAUTH_SCOPE);
  ok("...and the Pages dialog is not the ads one", metaPagesRequestedScope() !== META_OAUTH_SCOPE);

  const connect = code("app/api/settings/social/connect/route.js");
  ok("the connect route asks for the composed scope, not a hand-written list",
    /buildAuthorizeUrl\(\{[^}]*scope: metaPagesRequestedScope\(\)/.test(connect), "one flow, one scope");

  // ── Facebook Login for Business: a configuration, when the owner has one ──
  //
  // Meta: "config_id has replaced scope (which should not be used)". The
  // scope-only dialog completed for an admin of five Pages and /me/accounts
  // answered nothing. With META_PAGES_CONFIG_ID set the dialog carries the
  // configuration and NOT the scope — the two are exclusive on the dialog.
  ok("…and hands the Pages configuration id through when one is set",
    /configId: metaPagesConfigId\(\)/.test(connect));
  ok("…and asks Facebook to re-ask (a once-emptied Page grant stays empty otherwise)", /rerequest: true/.test(connect));
  {
    const saved = process.env.META_APP_ID; process.env.META_APP_ID = "123";
    const u = new URL(buildAuthorizeUrl({ redirectUri: "https://x/cb", state: "s", scope: "pages_show_list", rerequest: true }));
    ok("rerequest puts auth_type=rerequest on the dialog", u.searchParams.get("auth_type") === "rerequest");
    const v = new URL(buildAuthorizeUrl({ redirectUri: "https://x/cb", state: "s", scope: "ads_read" }));
    ok("…and the ads dialog, which never asked for it, carries none", v.searchParams.get("auth_type") === null);
    process.env.META_APP_ID = saved; if (saved === undefined) delete process.env.META_APP_ID;
  }
  {
    const saved = { id: process.env.META_APP_ID, cfg: process.env.META_PAGES_CONFIG_ID };
    process.env.META_APP_ID = "123";
    process.env.META_PAGES_CONFIG_ID = "987654321";
    const withCfg = new URL(buildAuthorizeUrl({ redirectUri: "https://x/cb", state: "s", scope: "pages_show_list", configId: metaPagesConfigId() }));
    ok("with a configuration the dialog gets config_id and override_default_response_type", withCfg.searchParams.get("config_id") === "987654321" && withCfg.searchParams.get("override_default_response_type") === "true" && withCfg.searchParams.get("response_type") === "code");
    ok("…and NOT scope — the two are mutually exclusive on Meta's dialog", withCfg.searchParams.get("scope") === null);
    delete process.env.META_PAGES_CONFIG_ID;
    const without = new URL(buildAuthorizeUrl({ redirectUri: "https://x/cb", state: "s", scope: "pages_show_list", configId: metaPagesConfigId() }));
    ok("without one the scope dialog stands, unchanged", without.searchParams.get("scope") === "pages_show_list" && without.searchParams.get("config_id") === null);
    process.env.META_APP_ID = saved.id; if (saved.id === undefined) delete process.env.META_APP_ID;
    if (saved.cfg !== undefined) process.env.META_PAGES_CONFIG_ID = saved.cfg;
  }

  // ── An empty Page list is three different facts ───────────────────────────
  ok("pages_show_list granted with no Page ticked is 'no_pages_selected'",
    classifyEmptyPageList({ data: { scopes: ["pages_show_list", "public_profile"], granular_scopes: [{ scope: "pages_show_list", target_ids: [] }] } }) === "no_pages_selected");
  ok("…also when the granular entry is absent altogether",
    classifyEmptyPageList({ data: { scopes: ["pages_show_list"], granular_scopes: [] } }) === "no_pages_selected");
  ok("pages_show_list missing from the token is 'pages_scope_missing'",
    classifyEmptyPageList({ data: { scopes: ["public_profile"], granular_scopes: [] } }) === "pages_scope_missing");
  ok("granted, Pages ticked, none listed is the original 'no_pages'",
    classifyEmptyPageList({ data: { scopes: ["pages_show_list"], granular_scopes: [{ scope: "pages_show_list", target_ids: ["1", "2"] }] } }) === "no_pages");
  ok("garbage is 'pages_scope_missing', never a crash", classifyEmptyPageList(null) === "pages_scope_missing");
  const cb = code("app/api/settings/social/callback/route.js");
  ok("the callback asks debug_token before saying 'no Page' and forwards the reason", /debugUserToken\(\{ accessToken: longToken \}\)/.test(cb) && /classifyEmptyPageList\(debug\.data\)/.test(cb) && /socialError: why/.test(cb));
  const panel = code("app/components/settings/SocialPublishingPanel.js");
  ok("…and the panel has a sentence for each of the three", /no_pages_selected: "app\.setSocial\.errorNoPagesSelected"/.test(panel) && /pages_scope_missing: "app\.setSocial\.errorPagesScopeMissing"/.test(panel));
}

// ── The grant, read per platform off what Meta ANSWERED ────────────────────
{
  const g = (s) => inboxPlatformsGranted(s);
  ok("publishing alone grants no inbox at all",
    !g(META_PAGES_SCOPE).facebook && !g(META_PAGES_SCOPE).instagram, g(META_PAGES_SCOPE));
  ok("pages_messaging grants the Facebook inbox",
    g("pages_show_list,pages_messaging").facebook === true);
  ok("...but not the Instagram one, whose composer needs instagram_manage_messages",
    g("pages_show_list,pages_messaging").instagram === false);
  ok("both together grant both",
    g("pages_messaging,instagram_manage_messages").instagram === true);
  ok("an unreadable granted list is not permission to assume anything",
    g(null).facebook === false && g(null).instagram === false && g("").facebook === false);
}

// ── The round trip: connect -> channel -> a webhook that RESOLVES ──────────
//
// Every assertion below runs the shipped functions against the db stub. The
// encryption key is set here because saveChannel encrypts at rest and refuses
// to guess; it is a throwaway 32 bytes and never leaves this process.
process.env.META_TOKEN_ENCRYPTION_KEY = "0".repeat(64);

const GRANT_BOTH = "pages_show_list,pages_read_engagement,pages_messaging,pages_manage_metadata,instagram_basic,instagram_manage_messages";

function connectedPage(overrides = {}) {
  return savePageMessagingChannels({
    companyId: "company_REAL",
    pageId: "PAGE_1",
    pageName: "Northline Painting",
    pageToken: "PAGE-TOKEN",
    instagramUserId: "IG_1",
    instagramUsername: "northline",
    grantedScopes: GRANT_BOTH,
    webhookSubscribedAt: new Date(),
    connectedByUserId: "user_1",
    ...overrides,
  });
}

// A real Meta body, not a hand-made event: the id in `entry.id` is the only
// thing the ingest is allowed to resolve a tenant from.
const inbound = (object, entryId) =>
  parseMessagingEnvelope({
    object,
    entry: [
      {
        id: entryId,
        time: 1757000000000,
        messaging: [
          {
            sender: { id: "PSID_1" },
            recipient: { id: entryId },
            timestamp: 1757000000000,
            message: { mid: `mid.${object}.1`, text: "Can you quote a kitchen?" },
          },
        ],
      },
    ],
  }).events[0];

{
  resetDbStub();
  const created = await connectedPage();
  ok("connecting a Page with the messaging grant creates the Facebook channel", created.facebook === true, created);
  ok("...and the Instagram one, because an account was linked", created.instagram === true, created);

  const fb = rows.messagingChannel.find((c) => c.platform === "facebook");
  const ig = rows.messagingChannel.find((c) => c.platform === "instagram");
  ok("the Facebook channel is keyed on the PAGE id — what Meta puts in entry.id",
    fb?.externalId === "PAGE_1", fb);
  ok("the Instagram channel is keyed on the INSTAGRAM account id, not the Page id",
    ig?.externalId === "IG_1", ig);
  ok("both belong to the connecting company", fb?.companyId === "company_REAL" && ig?.companyId === "company_REAL");
  ok("both are live", fb?.status === "connected" && !fb?.disconnectedAt && !ig?.disconnectedAt);
  ok("the Page token is stored ENCRYPTED, never in plain text",
    typeof fb?.accessTokenEnc === "string" && !JSON.stringify(rows.messagingChannel).includes("PAGE-TOKEN"),
    fb?.accessTokenEnc?.slice(0, 12));
  ok("...and there is no second writer — saveChannel is the one door",
    !code("lib/messaging/pageChannels.js").includes("db.messagingChannel.upsert"),
    "pageChannels must reuse lib/messaging/channels.js");

  // THE assertion this whole change exists for.
  const fbHit = await ingestEvent(inbound("page", "PAGE_1"));
  ok("an inbound Page message now RESOLVES instead of unknown_page",
    fbHit.handled === true && fbHit.companyId === "company_REAL", fbHit);
  const igHit = await ingestEvent(inbound("instagram", "IG_1"));
  ok("...and so does an Instagram DM", igHit.handled === true && igHit.companyId === "company_REAL", igHit);
  ok("the messages were actually filed", rows.message.length === 2, rows.message.length);
}

// ── THE PIN: no messaging grant, no channel ────────────────────────────────
{
  resetDbStub();
  const created = await connectedPage({ grantedScopes: META_PAGES_SCOPE });
  ok("a Page connected for PUBLISHING ONLY gets no channel",
    created.facebook === false && created.instagram === false && rows.messagingChannel.length === 0,
    rows.messagingChannel);
  const miss = await ingestEvent(inbound("page", "PAGE_1"));
  ok("...so its webhook is still refused, honestly, rather than filed into a dead inbox",
    miss.handled === false && miss.reason === "unknown_page", miss);
  ok("...and the panel is offered nothing to press",
    (await missingPageChannels({
      companyId: "company_REAL", grantedScopes: META_PAGES_SCOPE, instagramUserId: "IG_1",
    })).length === 0);
}
{
  resetDbStub();
  const created = await connectedPage({
    grantedScopes: "pages_show_list,pages_messaging,pages_manage_metadata,instagram_basic",
  });
  ok("un-ticking instagram_manage_messages gives a Facebook inbox and NO Instagram one",
    created.facebook === true && created.instagram === false &&
      rows.messagingChannel.length === 1 && rows.messagingChannel[0].platform === "facebook",
    rows.messagingChannel.map((c) => c.platform));
  ok("...and an Instagram DM finds nothing, rather than a composer that would 403 on Send",
    (await ingestEvent(inbound("instagram", "IG_1"))).reason === "unknown_page");
}
{
  resetDbStub();
  const created = await connectedPage({ instagramUserId: null, instagramUsername: null });
  ok("a Page with no linked Instagram account gets one channel, not an invented second",
    created.facebook === true && created.instagram === false && rows.messagingChannel.length === 1);
}
{
  resetDbStub();
  const created = await connectedPage({ webhookSubscribedAt: null });
  ok("a subscription Meta never confirmed produces NO channel — an inbox that cannot receive is worse than none",
    created.facebook === false && rows.messagingChannel.length === 0, rows.messagingChannel);
}

// ── The backfill a Page connected before this code needs ───────────────────
{
  resetDbStub();
  const missing = await missingPageChannels({
    companyId: "company_REAL", grantedScopes: GRANT_BOTH, instagramUserId: "IG_1",
  });
  ok("a Page connected before channels existed is reported as missing both inboxes",
    missing.join(",") === "facebook,instagram", missing);
  await connectedPage();
  ok("...and nothing is missing once the one press has run",
    (await missingPageChannels({
      companyId: "company_REAL", grantedScopes: GRANT_BOTH, instagramUserId: "IG_1",
    })).length === 0);

  const status = code("app/api/settings/social/status/route.js");
  ok("the status route REPORTS the gap and never writes it away",
    /missingInboxChannels: await missingPageChannels\(/.test(status) &&
      !/savePageMessagingChannels/.test(status),
    "a GET is reachable under an impersonation cookie — non-negotiable #3");
  const retry = code("app/api/settings/social/subscribe/route.js");
  ok("the one press runs the SAME route as the subscribe retry",
    /savePageMessagingChannels\(/.test(retry));
  ok("...after the subscription, never before it",
    retry.indexOf("await subscribePageWebhook(") < retry.indexOf("savePageMessagingChannels("));
}

// ── Disconnect takes the inbox with it ─────────────────────────────────────
{
  resetDbStub();
  await connectedPage();
  const stamped = await disconnectPageMessagingChannels("company_REAL");
  ok("disconnecting stamps both channels", stamped === 2, stamped);
  ok("...and never deletes them — the conversations survive", rows.messagingChannel.length === 2);
  ok("...marking WHEN, which is what listChannels filters on",
    rows.messagingChannel.every((c) => c.disconnectedAt instanceof Date));
  const after = await ingestEvent(inbound("page", "PAGE_1"));
  ok("a later webhook is no longer filed into a disconnected inbox",
    after.handled === false && after.reason === "channel_disconnected", after);

  // Reconnecting the same Page revives the row rather than orphaning history.
  const again = await connectedPage();
  ok("reconnecting revives the same rows", again.facebook === true && rows.messagingChannel.length === 2);
  ok("...and messages resolve again", (await ingestEvent(inbound("page", "PAGE_1"))).handled === true);
}
{
  resetDbStub();
  // A company that switched Pages: the old Page's channel must not keep
  // ingesting into an inbox nobody is watching.
  await connectedPage();
  await disconnectPageMessagingChannels("company_REAL");
  await connectedPage({ pageId: "PAGE_2", instagramUserId: "IG_2" });
  ok("switching Page leaves the OLD Page's channel disconnected",
    rows.messagingChannel.find((c) => c.externalId === "PAGE_1")?.disconnectedAt instanceof Date);
  ok("...and only the new one live",
    (await ingestEvent(inbound("page", "PAGE_2"))).handled === true &&
      (await ingestEvent(inbound("page", "PAGE_1"))).reason === "channel_disconnected");
}
{
  resetDbStub();
  // WhatsApp is a different platform, a different panel and a different
  // credential. Disconnecting the Page must not silence a number.
  rows.messagingChannel.push({
    id: "wa_1", companyId: "company_REAL", platform: "whatsapp",
    externalId: "PHONE_1", status: "connected", disconnectedAt: null,
  });
  await connectedPage();
  await disconnectPageMessagingChannels("company_REAL");
  ok("a WhatsApp channel is untouched by a Facebook disconnect",
    rows.messagingChannel.find((c) => c.platform === "whatsapp")?.disconnectedAt == null);
}

// ── The wiring: both connect paths and the disconnect ──────────────────────
{
  const cb = code("app/api/settings/social/callback/route.js");
  const fin = code("app/api/settings/social/finalize/route.js");
  const dis = code("app/api/settings/social/disconnect/route.js");
  ok("the single-Page callback creates the inbox channels",
    /savePageMessagingChannels\(\{/.test(cb));
  ok("...with the PAGE token and the granted scopes Meta answered with",
    /pageToken,/.test(cb.slice(cb.indexOf("savePageMessagingChannels("))) &&
      /grantedScopes: scopes,/.test(cb));
  ok("...gated on the subscription the same request just earned",
    /webhookSubscribedAt: webhook\.webhookSubscribedAt,/.test(cb));
  ok("the Page-picker finalize does the same",
    /savePageMessagingChannels\(\{/.test(fin) && /pageToken: page\.access_token,/.test(fin) &&
      /webhookSubscribedAt: webhook\.webhookSubscribedAt,/.test(fin));
  ok("disconnect marks the channels disconnected",
    /await disconnectPageMessagingChannels\(member\.companyId\)/.test(dis));
}
{
  const panel = code("app/components/settings/SocialPublishingPanel.js");
  ok("the panel draws the one press only when the server says a channel is missing",
    /connection\.missingInboxChannels\.length > 0/.test(panel));
  ok("...and it runs the subscribe route rather than a second endpoint",
    /handleRetryWebhook\(\{ inbox: true \}\)/.test(panel));
}

// ── The keys, in all nine ──────────────────────────────────────────────────
{
  const INBOX_KEYS = [
    "app.setSocial.inboxOffTitle",
    "app.setSocial.inboxOffBody",
    "app.setSocial.inboxConnect",
    "app.setSocial.inboxConnectedOk",
  ];
  const missing = [];
  for (const lang of Object.keys(APP_MESSAGES)) {
    for (const k of INBOX_KEYS) {
      const v = APP_MESSAGES[lang][k];
      if (typeof v !== "string" || !v.trim()) missing.push(`${lang}:${k}`);
      else if (v.includes("$")) missing.push(`${lang}:${k} contains a literal $`);
    }
  }
  ok("every inbox key is written in all nine, with no literal currency sign", missing.length === 0, missing);
}

console.log(`\ncheck-meta-pages-connect: ${passed} passed, ${failed} failed`);
if (process.argv.includes("--no-mutate")) process.exit(failed ? 1 : 0);

// ═══════════════════════════════════════════════════════════════════════════
// Mutation pass — is "not connected until subscribed" actually load-bearing?
// ═══════════════════════════════════════════════════════════════════════════
//
// Every pin above passes on correct code. That proves nothing on its own: the
// bug this file was extended for was code that passed every check it had.
// So each guarantee is broken on disk, one at a time, and this file is re-run
// as a subprocess. A mutant that SURVIVES is a check that certifies nothing.

const SELF = fileURLToPath(import.meta.url);
const LOADER = path.join(ROOT, "scripts/alias-loader.mjs");
// The round-trip section executes the real ingest against the scripted
// database, so the re-run needs the same stub the npm script gives it —
// registered second so it resolves `@/lib/db` first (see db-stub-hooks.mjs).
const DB_STUB = path.join(ROOT, "scripts/db-stub-loader.mjs");
const abs = (p) => path.join(ROOT, p);

const MUTATIONS = [
  [
    "lib/meta/pageConnect.js",
    "a refused subscribe still stamps the connection as subscribed",
    (s) => s.replace("  if (!res?.ok) {\n    return {\n      webhookSubscribedAt: null,", "  if (false) {\n    return {\n      webhookSubscribedAt: null,"),
  ],
  [
    "lib/meta/pageConnect.js",
    "a 200 that does not confirm is treated as a subscription",
    (s) => s.replace("if (res.data && res.data.success === false) {", "if (false) {"),
  ],
  [
    "lib/meta/pageConnect.js",
    "the subscribe is attempted even when the permissions it needs were never granted",
    (s) => s.replace("  if (missing.length) {", "  if (false) {"),
  ],
  [
    "lib/meta/pageConnect.js",
    "the disconnect skips the unsubscribe and reports success anyway",
    (s) => s.replace("  if (!wasSubscribed) return { ok: false, skipped: true, error: null };", "  return { ok: true, skipped: false, error: null };"),
  ],
  [
    "lib/meta/client.js",
    "the USER token is sent to an edge that only accepts a Page token",
    (s) => s.replace("    accessToken: pageAccessToken,\n    method: \"POST\",", "    accessToken: \"USER-TOKEN\",\n    method: \"POST\","),
  ],
  [
    "lib/meta/client.js",
    "the outbound echo is dropped from the subscription — replies stop being seen",
    (s) => s.replace('  "message_echoes",\n', ""),
  ],
  [
    "lib/meta/client.js",
    "a field nothing parses is subscribed alongside the ones that are",
    (s) => s.replace('  "messages",\n', '  "messages",\n  "messaging_postbacks",\n'),
  ],
  [
    "lib/meta/client.js",
    "pages_manage_metadata is dropped from the messaging scope",
    (s) => s.replace('  "pages_manage_metadata",\n  "instagram_basic",', '  "instagram_basic",'),
  ],
  [
    "lib/meta/pageConnection.js",
    "Meta's own error prose is handed to the browser instead of the kind",
    (s) => s.replace(
      "    webhookSubscribeErrorKind: webhookErrorKind(connection.webhookSubscribeError),",
      "    webhookSubscribeErrorKind: connection.webhookSubscribeError,",
    ),
  ],
  [
    "app/components/settings/SocialPublishingPanel.js",
    "the panel shows every connected Page as delivering messages",
    (s) => s.replace("{connection.webhookSubscribedAt ? (", "{true ? ("),
  ],
  [
    "app/components/settings/SocialPublishingPanel.js",
    "a failed subscribe falls through to the 'waiting on Meta' sentence, with no retry",
    (s) => s.replace(") : connection.webhookSubscribeErrorKind ? (", ") : false ? ("),
  ],
  [
    "app/api/settings/social/disconnect/route.js",
    "the disconnect destroys the token before it can remove the subscription",
    (s) => s.replace(
      "  const removed = await unsubscribePageWebhook({",
      "  await disconnectPageConnection(member.companyId);\n  const removed = await unsubscribePageWebhook({",
    ),
  ],
  [
    "app/api/settings/social/callback/route.js",
    "the callback subscribes with the long-lived user token",
    (s) => s.replace("subscribePageWebhook({ pageToken,", "subscribePageWebhook({ pageToken: longToken,"),
  ],
  // ── The inbox half ───────────────────────────────────────────────────────
  [
    "lib/messaging/pageChannels.js",
    "a Page connected for publishing alone still gets a Facebook channel",
    (s) => s.replace("  if (granted.facebook) {", "  if (true) {"),
  ],
  [
    "lib/messaging/pageChannels.js",
    "an Instagram inbox is created without instagram_manage_messages",
    (s) => s.replace("  if (granted.instagram && instagramUserId) {", "  if (instagramUserId) {"),
  ],
  [
    "lib/messaging/pageChannels.js",
    "a channel is written for a subscription Meta never confirmed",
    (s) => s.replace("  if (!webhookSubscribedAt) return created;", ""),
  ],
  [
    "lib/messaging/pageChannels.js",
    "the Instagram channel is keyed on the Page id, so no Instagram DM ever resolves",
    (s) => s.replace("      externalId: instagramUserId,", "      externalId: pageId,"),
  ],
  [
    "lib/messaging/pageChannels.js",
    "the disconnect stamps nothing, so messages keep arriving after access is revoked",
    (s) => s.replace(
      "      disconnectedAt: null,\n    },\n    data: { disconnectedAt: new Date() },",
      "      disconnectedAt: null,\n    },\n    data: {},",
    ),
  ],
  [
    "lib/meta/pageConnect.js",
    "instagram_manage_messages is dropped from what the Instagram inbox requires",
    (s) => s.replace('  "pages_messaging",\n  "instagram_manage_messages",\n]);', '  "pages_messaging",\n]);'),
  ],
  [
    "lib/meta/client.js",
    "the Pages dialog stops asking for messaging even once Meta approved it",
    (s) => s.replace(
      "  if (metaMessagingApproved()) parts.push(META_MESSAGING_SCOPE);\n  // pages_show_list",
      "  // pages_show_list",
    ),
  ],
  [
    "app/api/settings/social/callback/route.js",
    "the callback stores the connection and never creates the inbox channels",
    (s) => s.replace("    await savePageMessagingChannels({", "    await Promise.resolve({"),
  ],
  [
    "app/api/settings/social/disconnect/route.js",
    "the disconnect leaves the inbox channels live",
    (s) => s.replace(
      "await disconnectPageMessagingChannels(member.companyId)",
      "await Promise.resolve(0)",
    ),
  ],
  [
    "app/api/settings/social/status/route.js",
    "the status route hides the missing inbox, so nobody is ever offered the press",
    (s) => s.replace("missingInboxChannels: await missingPageChannels({", "missingInboxChannels: false && await missingPageChannels({"),
  ],
];

const originals = new Map();
for (const [file] of MUTATIONS) {
  if (!originals.has(file)) originals.set(file, fs.readFileSync(abs(file), "utf8"));
}

console.log("\nMutation pass\n");
let caught = 0;
const escaped = [];
try {
  for (const [file, label, mutate] of MUTATIONS) {
    const original = originals.get(file);
    const mutated = mutate(original);
    if (mutated === original) {
      escaped.push(`${file}: ${label} — the mutation did not apply (the source moved under it)`);
      continue;
    }
    fs.writeFileSync(abs(file), mutated);
    let survived = false;
    try {
      execFileSync(process.execPath, ["--import", LOADER, "--import", DB_STUB, SELF, "--no-mutate"], {
        stdio: ["ignore", "pipe", "pipe"],
      });
      survived = true;
    } catch {
      /* non-zero exit = caught */
    }
    fs.writeFileSync(abs(file), original);
    if (survived) escaped.push(`${file}: ${label} — NOT caught`);
    else {
      caught += 1;
      console.log(`  ✓ caught: ${label}`);
    }
  }
} finally {
  for (const [file, src] of originals) fs.writeFileSync(abs(file), src);
}
ok(`all ${MUTATIONS.length} mutants caught`, escaped.length === 0, escaped.join(" | "));
console.log(`\ncheck-meta-pages-connect: ${passed} passed, ${failed} failed (mutants caught: ${caught}/${MUTATIONS.length})`);

process.exit(failed ? 1 : 0);
