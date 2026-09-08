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
import { fileURLToPath } from "node:url";
import { connectionStatusKey } from "../lib/social/metaConnection.js";
import { publicPageConnectionShape } from "../lib/meta/pageConnection.js";

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

console.log(`\ncheck-meta-pages-connect: ${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
