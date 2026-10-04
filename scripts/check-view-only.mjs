// scripts/check-view-only.mjs
//
//   npm run check:view-only
//
// "View as company" hides its edits (owner, 2026-10-03). The server has
// always refused a support session's writes; this holds the BROWSER half —
// lib/impersonation/viewOnly.js and app/providers/ViewOnlyProvider.js — to
// three claims, executed where they can be:
//
//   1. COVERED. Every POST/PUT/PATCH/DELETE a control in /app can make goes
//      through window.fetch, XMLHttpRequest or navigator.sendBeacon — the
//      three the guard wraps. Proven by a static scan of the whole client
//      import graph (every "use client" file under app/app, app/components,
//      app/hooks, app/providers, and everything they import): each non-GET
//      request is built inside a fetch / fetchJson / uploadFile(fetchImpl)
//      call, nothing captures fetch before the guard can wrap it, no other
//      HTTP client, no server action, no native <form action> post.
//   2. REFUSED. The guard, installed on a fake window, refuses exactly what
//      middleware refuses (the same rule functions, every write-shaped GET,
//      staff surfaces open, cross-origin open), never calls the real fetch
//      for a refused request, answers middleware's 403 shape marked
//      viewOnly, stops same-origin XHR and beacons, and unwinds cleanly.
//   3. UNCHANGED outside a support session. The shared primitives render
//      byte-identical markup (md5) to the version before this change — the
//      fingerprints are pinned below, recorded from HEAD before the edit —
//      and with ViewOnlyProvider viewOnly={false}; the layout sets
//      data-view-only only from the server's viewOnly; every CSS rule is
//      under [data-view-only]; the provider installs nothing when false.
//
// Plus the personal pages (their own hours, pay, time off) and the bell,
// which show a notice in a support session, and the strings in all nine
// languages.

import fs from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";
import { fileURLToPath } from "node:url";
import { register } from "node:module";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";

register(
  "data:text/javascript," +
    encodeURIComponent(
      "export async function resolve(s, c, n) { return /^next\\/(link|navigation)$/.test(s) ? n(s + '.js', c) : n(s, c); }",
    ),
);

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (p) => fs.readFileSync(path.join(ROOT, p), "utf8");
const md5 = (s) => createHash("md5").update(s).digest("hex");

let fail = 0;
let count = 0;
const ok = (cond, msg) => {
  count++;
  console.log(`${cond ? "✓" : "✗"} ${msg}`);
  if (!cond) fail++;
};

const VO = await import("@/lib/impersonation/viewOnly");
const { isReadOnlyMethod, isWriteShapedGet, WRITE_SHAPED_GET_PATHS } = await import("@/lib/platform/readOnlyRequests");
const tokenMod = await import("@/lib/platform/impersonationToken");
const { APP_MESSAGES } = await import("@/app/i18n/appMessages");

// ══ 1. Covered: the static scan ═══════════════════════════════════════════
console.log("\n1. Every write in /app goes through a seam the guard wraps\n");
const walk = (d) =>
  fs.readdirSync(path.join(ROOT, d), { withFileTypes: true }).flatMap((e) =>
    e.isDirectory() ? walk(path.join(d, e.name)) : /\.(js|jsx|mjs)$/.test(e.name) ? [path.join(d, e.name)] : [],
  );
const isClient = (f) => /^\s*["']use client["']/m.test(read(f).slice(0, 4000));
const seeds = ["app/app", "app/components", "app/hooks", "app/providers"].flatMap(walk).filter(isClient);
const resolveSpec = (spec, from) => {
  let base;
  if (spec.startsWith("@/")) base = path.join(ROOT, spec.slice(2));
  else if (spec.startsWith(".")) base = path.resolve(path.dirname(path.join(ROOT, from)), spec);
  else return null;
  for (const c of [base, `${base}.js`, `${base}.jsx`, `${base}.mjs`, path.join(base, "index.js")]) {
    if (fs.existsSync(c) && fs.statSync(c).isFile()) return path.relative(ROOT, c);
  }
  return null;
};
const graph = new Set();
const queue = [...seeds];
const bareImports = new Set();
while (queue.length) {
  const f = queue.pop();
  if (graph.has(f)) continue;
  graph.add(f);
  for (const m of read(f).matchAll(/(?:import|export)[^'"]*?from\s*["']([^"']+)["']|import\(\s*["']([^"']+)["']\s*\)/g)) {
    const spec = m[1] || m[2];
    const r = resolveSpec(spec, f);
    if (r) {
      if (!graph.has(r)) queue.push(r);
    } else if (!spec.startsWith(".") && !spec.startsWith("@/")) bareImports.add(spec.split("/").slice(0, spec.startsWith("@") ? 2 : 1).join("/"));
  }
}
ok(seeds.length > 300 && graph.size > seeds.length, `the client graph: ${seeds.length} "use client" files, ${graph.size} modules reached`);

const HTTP_LIBS = ["axios", "ky", "superagent", "got", "node-fetch", "cross-fetch", "isomorphic-fetch", "undici", "graphql-request", "@apollo/client", "swr", "@tanstack/react-query"];
const foreign = HTTP_LIBS.filter((l) => bareImports.has(l));
ok(foreign.length === 0, `no other HTTP client in the client graph ${foreign.join(", ")}`);
const serverActions = [...graph].filter((f) => /^\s*["']use server["']/m.test(read(f)));
ok(serverActions.length === 0, `no server action ("use server") a control could post to ${serverActions.join(", ")}`);
const formActions = [...graph].filter((f) => /<form\b[^>]*\baction=/.test(read(f)));
ok(formActions.length === 0, `no native <form action> post ${formActions.join(", ")}`);
// A module-level capture of fetch would keep the unwrapped function.
const captures = [...graph].filter((f) => /^(?:export\s+)?(?:const|let|var)\s+\w+\s*=\s*(?:window\.|globalThis\.)?fetch\s*(?:;|$|\.bind)/m.test(read(f)));
ok(captures.length === 0, `nothing captures fetch at module load, before the guard wraps it ${captures.join(", ")}`);

// Every non-GET request: the call it is built inside.
const TRANSPORTS = new Set(["fetch", "fetchJson", "doFetch"]);
const METHOD_RE = /method:\s*(?:["'`](POST|PUT|PATCH|DELETE)["'`]|(?!["'`](?:GET|HEAD|OPTIONS)["'`])([A-Za-z_$][\w.$]*(?:\s*\?\s*["'`][A-Z]+["'`]\s*:\s*["'`][A-Z]+["'`])?))/g;
const NOT_A_REQUEST = /^(true|false|null|undefined|the|String)$/;
const sites = [];
const unknown = [];
const notHttp = [];
for (const f of graph) {
  if (f === "lib/impersonation/viewOnly.js" || f.startsWith("docs/")) continue;
  const src = read(f);
  for (const m of src.matchAll(METHOD_RE)) {
    if (m[2] && NOT_A_REQUEST.test(m[2])) continue;
    const before = src.slice(Math.max(0, m.index - 1500), m.index);
    // The innermost call still OPEN at the method literal: walk back over
    // balanced parentheses to the first unclosed "(".
    let depth = 0;
    let callee = null;
    for (let i = before.length - 1; i >= 0; i--) {
      const ch = before[i];
      if (ch === ")") depth++;
      else if (ch === "(") {
        if (depth === 0) {
          const id = before.slice(0, i).match(/([A-Za-z_$][\w$.]*)\s*$/);
          callee = id ? id[1] : "";
          break;
        }
        depth--;
      }
    }
    const line = src.slice(0, m.index).split("\n").length;
    // A function in the same file that hands its options to a transport:
    // const mutate = async (url, options) => fetch(url, { ...options }).
    const localWrapper = (name) => {
      if (!name || TRANSPORTS.has(name)) return false;
      const def = src.search(new RegExp(`(?:function\\s+${name.replace(/[$.]/g, "\\$&")}\\s*\\(|(?:const|let)\\s+${name.replace(/[$.]/g, "\\$&")}\\s*=\\s*(?:async\\s*)?(?:\\([^)]*\\)|\\w+)\\s*=>)`));
      return def >= 0 && /\b(?:fetch|fetchJson)\(/.test(src.slice(def, def + 1500));
    };
    if (TRANSPORTS.has(callee)) sites.push({ f, line, callee });
    else if (localWrapper(callee)) sites.push({ f, line, callee: `${callee} → fetch` });
    else {
      const assigned = before.match(/(?:const|let|var)\s+(\w+)\s*=\s*\{[^{}]*$/);
      if (assigned && new RegExp(`\\b(?:fetch|fetchJson)\\(\\s*[^,]+,\\s*${assigned[1]}\\b`).test(src)) sites.push({ f, line, callee: `fetch via ${assigned[1]}` });
      else if (f === "lib/media/uploadClient.js") sites.push({ f, line, callee: "fetchImpl → fetch" });
      else if (m[2]) {
        // A computed `method:` outside any transport, in an object with no
        // body or headers: a payment method ("cash", invoice.method), not an
        // HTTP verb. Counted so the number is visible, not a request.
        const objStart = before.lastIndexOf("{");
        const after = src.slice(m.index, m.index + 400);
        const obj = before.slice(objStart) + after.slice(0, after.indexOf("}") + 1);
        if (/\b(?:body|headers):/.test(obj)) unknown.push(`${f}:${line} ${m[0].slice(0, 50)}`);
        else notHttp.push(`${f}:${line}`);
      } else unknown.push(`${f}:${line} ${m[0].slice(0, 50)} (inside ${callee || "nothing"})`);
    }
  }
}
const inApp = sites.filter((s) => s.f.startsWith("app/app/"));
ok(sites.length > 500 && inApp.length > 150, `${sites.length} non-GET requests in the client graph (${inApp.length} in app/app), each found inside its transport`);
ok(unknown.length === 0, `no non-GET request built anywhere the scan cannot place inside fetch/fetchJson${unknown.length ? `\n     ${unknown.join("\n     ")}` : ""}`);
ok(notHttp.length < 20, `${notHttp.length} computed "method:" fields outside any request are payment methods, not HTTP (no body/headers beside them)`);
const upload = read("lib/media/uploadClient.js");
ok(/fetchImpl \|\| \(\(\.\.\.args\) => fetch\(\.\.\.args\)\)/.test(upload), "uploadFile's transport resolves the global fetch at call time (wrapped), its XHR goes to Cloudinary only after our sign request");
ok(/res = await fetch\(url, withJsonBody\(options\)\)/.test(read("lib/fetchJson.js")), "fetchJson calls the global fetch (wrapped)");
const beacons = [...graph].filter((f) => /sendBeacon\(/.test(read(f)) && f !== "lib/impersonation/viewOnly.js");
ok(beacons.every((f) => /navigator\.sendBeacon\(/.test(read(f))), `every beacon is navigator.sendBeacon (wrapped): ${beacons.join(", ")}`);

// ══ 2. Refused: the guard, executed ═══════════════════════════════════════
console.log("\n2. The guard refuses what middleware refuses\n");
ok(tokenMod.isReadOnlyMethod === isReadOnlyMethod && tokenMod.isWriteShapedGet === isWriteShapedGet, "middleware's import and the guard's are the SAME functions (re-exported, not copied)");
const mw = read("middleware.js");
ok(/import \{[^}]*\bisReadOnlyMethod\b[^}]*\bisWriteShapedGet\b[^}]*\} from "@\/lib\/platform\/impersonationToken"/.test(mw) && /!isReadOnlyMethod\(request\.method\) \|\| isWriteShapedGet\(pathname\)/.test(mw),
  "middleware still refuses on exactly those two");
const staffInMw = ["/platform", "/api/platform", "/sales", "/api/sales"].every((p) => mw.includes(`pathname.startsWith("${p}")`));
ok(staffInMw && JSON.stringify(VO.STAFF_SURFACE_PREFIXES) === JSON.stringify(["/platform", "/api/platform", "/sales", "/api/sales"]), "the staff surfaces the guard leaves open are middleware's own four");
const ORIGIN = "https://www.fieldquo.com";
const mwDecision = (method, pathname) => {
  const staff = VO.STAFF_SURFACE_PREFIXES.some((p) => pathname.startsWith(p));
  if (staff) return false;
  if (!(pathname.startsWith("/app") || pathname.startsWith("/api"))) return false;
  return !isReadOnlyMethod(method) || isWriteShapedGet(pathname);
};
const PATHS = ["/api/quotes", "/api/quotes/q1", "/api/invoices/i1/send", "/api/settings/company", "/api/leave", "/api/notifications/read", "/api/track", "/app/quotes", "/api/platform/companies/c1/impersonate", "/api/sales/presence", "/platform/x", "/quote/abc/approve", "/api/stripe/connect/status", ...WRITE_SHAPED_GET_PATHS];
const METHODS = ["GET", "HEAD", "OPTIONS", "POST", "PUT", "PATCH", "DELETE", "post"];
let agree = 0;
const disagree = [];
for (const p of PATHS) for (const m of METHODS) {
  const g = VO.isBlockedRequest({ url: p, method: m, origin: ORIGIN });
  if (g === mwDecision(m.toUpperCase(), p)) agree++;
  else disagree.push(`${m} ${p}`);
}
ok(disagree.length === 0, `guard = middleware on ${agree} method × path pairs ${disagree.join(", ")}`);
ok(VO.isBlockedRequest({ url: "https://api.cloudinary.com/v1_1/x/upload", method: "POST", origin: ORIGIN }) === false, "cross-origin (Cloudinary's bytes) is not ours to refuse");
ok(VO.isBlockedRequest({ url: `${ORIGIN}/api/quotes`, method: "POST", origin: ORIGIN }) === true, "an absolute same-origin URL is refused like a relative one");
ok(VO.isBlockedRequest({ url: "/api/quotes?x=1", method: "DELETE", origin: ORIGIN }) === true, "a query string does not hide the path");
ok(VO.isBlockedRequest({ url: "http://[bad", method: "POST", origin: ORIGIN }) === false, "an unparseable URL is left to fetch to reject");

// A fake window.
function fakeWindow() {
  const calls = [];
  class FakeXHR {
    constructor() {
      this.sent = false;
      this.events = [];
    }
    dispatchEvent(e) {
      this.events.push(e.type);
    }
  }
  FakeXHR.prototype.open = function (method, url) {
    this.m = method;
    this.u = url;
  };
  FakeXHR.prototype.send = function () {
    this.sent = true;
    calls.push({ kind: "xhr", method: this.m, url: this.u });
  };
  const realFetch = async (input, init) => {
    calls.push({ kind: "fetch", input: typeof input === "string" ? input : input.url, method: init?.method || input?.method || "GET" });
    return new Response("{}", { status: 200 });
  };
  const beacon = (url) => {
    calls.push({ kind: "beacon", url });
    return true;
  };
  return { win: { location: { origin: ORIGIN }, fetch: realFetch, XMLHttpRequest: FakeXHR, navigator: { sendBeacon: beacon }, Response, Event }, calls, realFetch, FakeXHR, beacon };
}
const fw = fakeWindow();
const origOpen = fw.FakeXHR.prototype.open;
const blocked = [];
const uninstall = VO.installViewOnlyGuard(fw.win, { onBlocked: (r) => blocked.push(r) });
let res = await fw.win.fetch("/api/quotes", { method: "POST", body: "{}" });
let body = await res.json();
ok(res.status === 403 && body.viewOnly === true && body.readOnly === true && /read-only/.test(body.error), "POST /api/quotes → 403 { readOnly, viewOnly } — middleware's shape");
ok(!fw.calls.some((c) => c.kind === "fetch"), "…and the real fetch was never called");
ok(blocked.length === 1 && blocked[0].method === "POST", "…and the guard reported it once");
res = await fw.win.fetch(new Request(`${ORIGIN}/api/invoices/i1`, { method: "DELETE" }));
ok(res.status === 403 && fw.calls.length === 0, "fetch(Request DELETE) → refused (the Request's own method is read)");
res = await fw.win.fetch("/api/quotes");
ok(res.status === 200 && fw.calls.length === 1 && fw.calls[0].method === "GET", "GET passes through to the real fetch");
res = await fw.win.fetch(`/api/platform/companies/c1/impersonate`, { method: "DELETE" });
ok(res.status === 200 && fw.calls.length === 2, "ending the session (DELETE /api/platform/…) passes — the banner's way out");
res = await fw.win.fetch("/api/calendar/google/connect");
ok(res.status === 403 && fw.calls.length === 2, "a GET that acts (OAuth connect) is refused like a write");
const xhr = new fw.win.XMLHttpRequest();
xhr.open("PATCH", "/api/jobs/j1");
xhr.send("{}");
ok(xhr.sent === false && !fw.calls.some((c) => c.kind === "xhr"), "same-origin XHR PATCH is never sent");
await new Promise((r) => setTimeout(r, 5));
ok(xhr.events.includes("error"), "…the caller gets an error event, as offline");
const xhr2 = new fw.win.XMLHttpRequest();
xhr2.open("POST", "https://api.cloudinary.com/v1_1/x/upload");
xhr2.send("bytes");
ok(xhr2.sent === true, "cross-origin XHR (Cloudinary) is untouched");
ok(fw.win.navigator.sendBeacon("/api/track", "{}") === false && !fw.calls.some((c) => c.kind === "beacon"), "same-origin beacon → false, never queued");
uninstall();
ok(fw.win.fetch === fw.realFetch && fw.win.navigator.sendBeacon === fw.beacon && fw.FakeXHR.prototype.open === origOpen, "uninstall restores fetch, XHR and sendBeacon exactly");

// ══ 3. Unchanged outside a support session ════════════════════════════════
console.log("\n3. Nothing changes for a real member\n");
const { default: ViewOnlyProvider, PersonalPageGate, useViewOnly } = await import("@/app/providers/ViewOnlyProvider");
const { default: SendConfirmModal } = await import("@/app/components/SendConfirmModal");
const { default: NotificationBell } = await import("@/app/components/layout/NotificationBell");
const { LanguageProvider } = await import("@/app/providers/LanguageProvider");
const h = React.createElement;
// Every render inside the shell's language provider, as on a real page.
const html = (el) => renderToStaticMarkup(h(LanguageProvider, { initialLanguage: "en" }, el));
const SEND_PROPS = { isOpen: true, onClose() {}, onConfirm() {}, title: "Send quote Q-1?", recipient: "jane@example.com", detail: "From Cedar & Co", confirmLabel: "Send now" };

// Fingerprints of the markup BEFORE this change, recorded by rendering the
// HEAD versions of these two files with these props (no provider existed).
// A real member's screen must not move by one byte.
const PINNED = {
  sendModal: "d1fe2a405b901db47a3d0d110e69b42e",
  bellRail: "2b8454e747172d50d875d30476e199cc",
  bellBar: "ce5d767da2e4068fbea01ae4a434fd9b",
};
const sendNow = html(h(SendConfirmModal, SEND_PROPS));
const sendNowFalse = html(h(ViewOnlyProvider, { viewOnly: false }, h(SendConfirmModal, SEND_PROPS)));
ok(md5(sendNow) === PINNED.sendModal, `SendConfirmModal, no provider: md5 ${md5(sendNow)} = the version before`);
ok(sendNowFalse === sendNow, "SendConfirmModal under viewOnly={false}: identical markup");
const bellRail = html(h(NotificationBell, {}));
const bellBar = html(h(NotificationBell, { tone: "bar", className: "x" }));
ok(md5(bellRail) === PINNED.bellRail && md5(bellBar) === PINNED.bellBar, `NotificationBell (rail, bar): md5 ${md5(bellRail)} / ${md5(bellBar)} = the versions before`);
ok(html(h(ViewOnlyProvider, { viewOnly: false }, h(NotificationBell, {}))) === bellRail, "NotificationBell under viewOnly={false}: identical markup");
const child = h("section", { id: "page" }, "Quotes");
ok(html(h(ViewOnlyProvider, { viewOnly: false }, h(PersonalPageGate, null, child))) === html(child), "the provider + personal-page gate pass a page through untouched (viewOnly false)");
let seenFlag = null;
const Probe = () => {
  seenFlag = useViewOnly();
  return null;
};
html(h(Probe));
ok(seenFlag === false, "useViewOnly() is false with no provider (every screen outside the shell)");
html(h(ViewOnlyProvider, { viewOnly: true }, h(Probe)));
ok(seenFlag === true, "…and true under viewOnly={true}");
const providerSrc = read("app/providers/ViewOnlyProvider.js");
ok(/\{viewOnly \? <ViewOnlyGuard \/> : null\}/.test(providerSrc), "the guard (fetch wrap, listeners, observer) mounts ONLY when viewOnly");

const layout = read("app/app/layout.js");
ok(/viewOnly: !!member\.impersonation && member\.impersonationMode === "read_only"/.test(layout), "the layout decides viewOnly from the server-resolved member: read-only impersonation only (a demo sandbox may write)");
ok(/data-view-only=\{settingsShell\.access\?\.viewOnly \? "1" : undefined\}/.test(layout), "data-view-only is set only then (undefined renders no attribute)");
ok(/<ViewOnlyProvider viewOnly=\{Boolean\(settingsShell\.access\?\.viewOnly\)\}>/.test(layout) && /<PersonalPageGate>\{children\}<\/PersonalPageGate>/.test(layout), "the shell provides the context and gates the page");

const css = read("app/globals.css");
const voBlock = css.slice(css.indexOf("/* ── \"View as company\": write controls drawn off"));
const selectors = [...voBlock.matchAll(/([^{}]+)\{[^{}]*\}/g)].map((m) => m[1].replace(/\/\*[\s\S]*?\*\//g, "").trim()).filter(Boolean);
ok(selectors.length >= 3 && selectors.every((sel) => sel.split(/,\s*\n/).every((part) => part.trim().startsWith("[data-view-only]"))), `every view-only CSS rule is under [data-view-only] (${selectors.length} rules) — inert for a real member`);
const cssList = 'button[type="submit"], input[type="submit"], input[type="file"], [role="switch"], [contenteditable="true"], [data-write], form input:not([type="hidden"]), form textarea, form select';
ok(voBlock.includes(cssList) && VO.WRITE_CONTROL_SELECTOR === cssList, "the CSS list and WRITE_CONTROL_SELECTOR are the same list");

// ══ 4. In a support session ═══════════════════════════════════════════════
console.log("\n4. In a support session\n");
const sendVO = html(h(ViewOnlyProvider, { viewOnly: true }, h(SendConfirmModal, SEND_PROPS)));
ok(/<button type="button" disabled="" class="flex-1 bg-inverted[^"]*">Send now<\/button>/.test(sendVO) && sendVO.includes("data-view-only-note"), "SendConfirmModal: Send drawn disabled, with the View only note");
const bellVO = html(h(ViewOnlyProvider, { viewOnly: true }, h(NotificationBell, {})));
ok(bellVO.includes("data-view-only-bell") && bellVO.includes(APP_MESSAGES.en["app.viewOnly.bell"]) && !bellVO.includes("aria-expanded"), "the bell: inert, says notifications are personal, the live bell (and its poll) not mounted");

for (const pg of VO.PERSONAL_PAGES) {
  ok(VO.personalPageFor(pg.prefix)?.prefix === pg.prefix && VO.personalPageFor(`${pg.prefix}/x?y=1`)?.prefix === pg.prefix, `${pg.prefix} is a personal page (and below it)`);
  ok(fs.existsSync(path.join(ROOT, "app", pg.prefix.replace(/^\/app/, "app"), "page.js")) || fs.existsSync(path.join(ROOT, pg.prefix.slice(1), "page.js")), `…the page exists (${pg.prefix})`);
  const routeDir = path.join(ROOT, "app", pg.endpoint.replace(/^\//, ""));
  ok(fs.existsSync(path.join(routeDir, "route.js")), `…and its "my" endpoint ${pg.endpoint} exists`);
}
for (const p of ["/app/me", "/app/settings/availability-x", "/app/quotes", "/app/time-offs", "/app/settings/company"]) {
  ok(VO.personalPageFor(p) === null, `${p} is not a personal page`);
}
// The gate, rendered at a path: Next's own PathnameContext, the one
// usePathname() reads.
const { PathnameContext } = await import("next/dist/shared/lib/hooks-client-context.shared-runtime.js");
const at = (pathname, viewOnly) =>
  html(h(PathnameContext.Provider, { value: pathname }, h(ViewOnlyProvider, { viewOnly }, h(PersonalPageGate, null, h("section", { id: "owner-pay" }, "Owner's pay: $4,200")))));
for (const pg of VO.PERSONAL_PAGES) {
  const vo = at(pg.prefix, true);
  ok(vo.includes(`data-personal-page-notice="${pg.what}"`) && vo.includes(APP_MESSAGES.en["app.viewOnly.personalTitle"]) && !vo.includes("owner-pay"),
    `${pg.prefix}, support session: the notice, and the page (its data) not rendered`);
  ok(at(pg.prefix, false).includes("owner-pay") && !at(pg.prefix, false).includes("data-personal-page-notice"), `${pg.prefix}, a real member: the page, untouched`);
}
ok(at("/app/quotes", true).includes("owner-pay"), "a company page in a support session renders normally (only personal pages are gated)");
const gateSrc = providerSrc.slice(providerSrc.indexOf("export function PersonalPageGate"));
ok(/const page = viewOnly \? personalPageFor\(pathname\) : null;\s*\n\s*if \(!page\) return children;/.test(gateSrc), "the gate renders the notice only when viewOnly AND the path is personal — the page never mounts, so its endpoint is never asked");

// ══ 5. Strings ════════════════════════════════════════════════════════════
console.log("\n5. Strings\n");
const KEYS = ["app.viewOnly.title", "app.viewOnly.toast", "app.viewOnly.personalTitle", "app.viewOnly.personalBody", "app.viewOnly.bell"];
for (const code of ["en", "fr", "es", "uk", "pa", "tl", "de", "zh", "it"]) {
  const missing = KEYS.filter((k) => !APP_MESSAGES[code]?.[k]);
  ok(missing.length === 0, `${code}: every View only string${missing.length ? ` (missing ${missing.join(", ")})` : ""}`);
}
const cli = read("lib/clientErrors.js");
ok(/if \(data\?\.viewOnly === true\) return message;/.test(cli), "reportResponseError stays quiet for the guard's own answer (one note, not a red error too)");

console.log(`\n${count - fail}/${count} passed`);
if (fail) process.exit(1);
