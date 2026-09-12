// scripts/check-browser-notifications.mjs
//
//   npm run check:browser-notifications
//
// The toast layer and browser notifications, EXECUTED where they can be and
// asserted structurally where they cannot.
//
// ══ What this proves ═══════════════════════════════════════════════════════
//
//   1. There is ONE toast layer, it is a portal at document.body with
//      `position: fixed`, and its bottom offset reads the dock variables
//      (--fq-tab-bar-height + --fq-dock-height) — the owner's "the pop-ups
//      are half hidden" was the sales queue's own toast at the tour pill's
//      offset and z-index, and /app's bell popover anchored inside the rail.
//   2. All three surfaces mount it, the old ErrorToast is an alias of it,
//      and the sales queue's top-up goes through notify() rather than a
//      toast of its own. The bell popover is a portal, never `absolute`.
//   3. lib/notify/browser.js — RUN against a stubbed window: a focused tab
//      gets a toast and no Notification; a background tab gets a system
//      notification only when the browser granted permission AND this
//      person turned the switch on here; otherwise the toast.
//   4. lib/notify/push.js — RUN against a stub client: no keys → every
//      sender answers not_configured and calls nothing; with keys, a send is
//      counted, 410 and 404 disable the row, a 500 is recorded and the row
//      is kept, and a sender never rejects.
//   5. The three subscription routes each use their own surface's gate, the
//      /app one refuses an impersonation session, and the shared handler's
//      owner and subscription parsers refuse what they must (RUN).
//   6. Every event the brief named has a server-side push and an in-tab
//      notify() — asserted by name in the file that owns each event.
//   7. Every catalogue key the block and the events use exists in all nine
//      languages.
//
// ══ Mutation-tested ═══════════════════════════════════════════════════════
//
// Each of these was applied to the real file, this script run, and the
// named assertion went red; then the mutation was reverted:
//
//   M1  ToastLayer.js: createPortal(…, host) → plain return of the tree
//       (no portal)                                → §1 "portal at document.body"
//   M2  globals.css: `position: fixed` on .fq-toast-layer → `absolute`
//                                                  → §1 "position: fixed"
//   M3  browser.js notify(): `tabFocused() ||` dropped, so a focused tab
//       gets a system notification                 → §3 "focused → toast"
//   M4  push.js: GONE_STATUSES loses 404          → §4 "404 disables"
//   M5  push-subscription (app) route: the `!member.userId` refusal removed
//                                                  → §5 "impersonation refused"
//
// Judged by EXIT CODE: 1 on any failure and on an uncaught throw.

import { readFileSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const read = (p) => readFileSync(join(ROOT, p), "utf8");
const decomment = (src) =>
  src.replace(/\/\*[\s\S]*?\*\//g, " ").replace(/(^|[^:\\])\/\/[^\n]*/g, "$1 ");

let pass = 0;
const failures = [];
function ok(name, cond, got) {
  if (cond) {
    pass++;
    console.log(`  ok   ${name}`);
  } else {
    failures.push(name);
    console.log(`  FAIL ${name}${got !== undefined ? `  — got: ${JSON.stringify(got)}` : ""}`);
  }
}
const section = (h) => console.log(`\n${h}\n`);

// ═══════════════════════════════════════════════════════════════════════════
section("1. One toast layer, a portal, fixed, above the dock");

const layer = decomment(read("app/components/ToastLayer.js"));
const css = decomment(read("app/globals.css"));
const rule = (css.match(/\.fq-toast-layer\s*\{[^}]*\}/) || [""])[0];

ok("ToastLayer renders through createPortal into document.body", /createPortal\(/.test(layer) && /setHost\(document\.body\)/.test(layer) && /,\s*host,?\s*\)/.test(layer));
ok("globals.css has a .fq-toast-layer rule", rule.length > 0);
ok("…position: fixed", /position:\s*fixed/.test(rule));
ok(
  "…bottom reads --fq-tab-bar-height and --fq-dock-height (with the safe-area inset for a surface with no bar)",
  /bottom:\s*calc\(max\(var\(--fq-tab-bar-height\),\s*env\(safe-area-inset-bottom\)\)\s*\+\s*var\(--fq-dock-height\)\s*\+\s*[\d.]+rem\)/.test(rule),
);
ok("…z-index above every drawer, dialog, dock, tour and the plan prompt (≥ 120)", Number((rule.match(/z-index:\s*(\d+)/) || [])[1]) >= 120);
ok("…centred below lg (left 50% + translateX)", /left:\s*50%/.test(rule) && /translateX\(-50%\)/.test(rule));
const lgRule = (css.match(/@media \(min-width: 64rem\)\s*\{\s*\.fq-toast-layer\s*\{[^}]*\}/) || [""])[0];
ok("…bottom-right from lg up, offset from the edge", /right:\s*var\(--fq-toast-right/.test(lgRule) && /left:\s*auto/.test(lgRule));
ok("the layer's root carries the surface shell class so the tab-bar term resolves outside the shell", /fq-app-shell/.test(layer) && /fq-sales-shell/.test(layer));
ok("the region is aria-live polite", /aria-live="polite"/.test(layer) && /role="status"/.test(layer));
ok("at most three toasts", /MAX_TOASTS = 3/.test(layer) && /next\.length > MAX_TOASTS/.test(layer));
ok("a toast dismisses on click", /onClick=\{dismiss\}/.test(layer));
ok("reduced motion turns the enter animation off", /motion-reduce:animate-none/.test(layer));

// ═══════════════════════════════════════════════════════════════════════════
section("2. Mounted on every surface; the old toasts route through it");

const appLayout = decomment(read("app/app/layout.js"));
const salesShell = decomment(read("app/sales/SalesShell.js"));
const platformLayout = decomment(read("app/platform/layout.js"));
ok("/app mounts <ToastLayer surface=\"app\" />", /<ToastLayer surface="app" \/>/.test(appLayout));
ok("/sales mounts <ToastLayer surface=\"sales\" />", /<ToastLayer surface="sales" \/>/.test(salesShell));
ok("/sales login and invite (chromeless) mount a bare layer too", /<ToastLayer surface="bare" \/>/.test(salesShell));
ok("/platform mounts <ToastLayer surface=\"platform\" />", /<ToastLayer surface="platform" \/>/.test(platformLayout));
ok("no surface still mounts <ErrorToast />", ![appLayout, salesShell, platformLayout].some((s) => /<ErrorToast/.test(s)));
const errorToast = decomment(read("app/components/ErrorToast.js"));
ok("ErrorToast.js is an alias of ToastLayer, not a second layer", /export \{ default \} from "@\/app\/components\/ToastLayer"/.test(errorToast) && !/fixed/.test(errorToast));
const clientErrors = decomment(read("lib/clientErrors.js"));
ok("showError() dispatches through showToast (one event, one listener)", /showToast\(\{ message, tone: "error" \}\)/.test(clientErrors) && !/fieldquo:error/.test(clientErrors));

const queue = decomment(read("app/sales/queue/page.js"));
ok("the sales queue draws no toast of its own any more", !/data-top-up-toast/.test(queue) && !/setToast\(/.test(queue));
ok("…the top-up goes through notify() with the same sentence", /notify\(\{\s*title: t\("app\.salesQueue\.topUpTitle"\),\s*body: topUpToast\(t, body\)/.test(queue));

const bell = decomment(read("app/components/layout/NotificationBell.js"));
ok("the bell popover is a portal at document.body", /createPortal\(/.test(bell) && /document\.body,?\s*\)/.test(bell));
ok("…never `absolute` inside the rail again", !/sm:absolute/.test(bell) && /className="fixed inset-x-2/.test(bell));
ok("…placed from the bell's rect and clamped into the viewport", /getBoundingClientRect\(\)/.test(bell) && /Math\.max\(PANEL_MARGIN_PX, Math\.min\(r\.left/.test(bell));

// ═══════════════════════════════════════════════════════════════════════════
section("3. lib/notify/browser.js — notify() against a stubbed window");

const toastEvents = [];
let constructed = [];
function stubWindow({ focused, hidden = false, permission = "granted", enabled = true }) {
  toastEvents.length = 0;
  constructed = [];
  const store = new Map();
  if (enabled) store.set("fq-browser-notifications", "1");
  class Notification {
    constructor(title, options) {
      this.title = title;
      this.options = options;
      constructed.push(this);
    }
    close() {}
  }
  Notification.permission = permission;
  Notification.requestPermission = async () => permission;
  globalThis.window = {
    Notification,
    localStorage: { getItem: (k) => store.get(k) ?? null, setItem: (k, v) => store.set(k, v), removeItem: (k) => store.delete(k) },
    dispatchEvent: (e) => toastEvents.push(e),
    focus() {},
    location: { assign() {} },
  };
  globalThis.CustomEvent = class {
    constructor(type, init) {
      this.type = type;
      this.detail = init?.detail;
    }
  };
  globalThis.document = { hidden, hasFocus: () => focused };
  globalThis.navigator = {};
}

const browser = await import("@/lib/notify/browser");

stubWindow({ focused: true });
ok("focused tab → toast, no Notification", browser.notify({ title: "Hi", body: "there", url: "/x" }) === "toast" && toastEvents.length === 1 && constructed.length === 0);
ok("…the toast carries the message, the href and the tag", (() => {
  toastEvents.length = 0;
  browser.notify({ title: "New text", body: "yes", url: "/sales/messages", tag: "sms:1" });
  const d = toastEvents[0]?.detail;
  return d?.message === "New text — yes" && d?.href === "/sales/messages" && d?.tag === "sms:1";
})());

stubWindow({ focused: false, permission: "granted", enabled: true });
ok("background tab + granted + switched on → system Notification", browser.notify({ title: "Ring", body: "+1 555", url: "/sales/queue", tag: "ring" }) === "system" && constructed.length === 1 && toastEvents.length === 0);
ok("…with the tag and the URL for the click", constructed[0]?.options?.tag === "ring" && constructed[0]?.options?.data?.url === "/sales/queue");

stubWindow({ focused: false, hidden: true, permission: "granted", enabled: false });
ok("background tab, granted, but NOT switched on here → toast, never a Notification", browser.notify({ title: "x" }) === "toast" && constructed.length === 0);

stubWindow({ focused: false, permission: "denied", enabled: true });
ok("background tab, permission denied → toast", browser.notify({ title: "x" }) === "toast" && constructed.length === 0);

stubWindow({ focused: false, permission: "default", enabled: true });
ok("background tab, permission never asked → toast", browser.notify({ title: "x" }) === "toast" && constructed.length === 0);

stubWindow({ focused: true });
ok("quietWhenFocused: a focused tab gets nothing (the caller draws its own notice)", browser.notify({ title: "Ring", quietWhenFocused: true }) === "none" && toastEvents.length === 0 && constructed.length === 0);
stubWindow({ focused: false, permission: "granted", enabled: true });
ok("…and a background tab still gets the system notification", browser.notify({ title: "Ring", quietWhenFocused: true }) === "system" && constructed.length === 1);
ok("the incoming-call drawer uses it, being its own in-tab notice", /quietWhenFocused: true/.test(decomment(read("app/components/sales/IncomingCallDock.js"))));
stubWindow({ focused: true });
ok("no title → nothing at all", browser.notify({}) === "none" && toastEvents.length === 0);
ok("permissionState() reads the browser's answer", browser.permissionState() === "granted");
delete globalThis.window;
ok("…and says unsupported with no window", browser.permissionState() === "unsupported");
delete globalThis.document;
delete globalThis.navigator;

// ═══════════════════════════════════════════════════════════════════════════
section("4. lib/notify/push.js — the sender against a stub client");

const push = await import("@/lib/notify/push");

ok("no keys → not configured", push.pushConfig({}).configured === false && push.pushPublicKey({}) === null);
ok("a public key alone → not configured", push.pushConfig({ WEB_PUSH_VAPID_PUBLIC_KEY: "a" }).configured === false);
ok("a subject that is not mailto: → not configured", push.pushConfig({ WEB_PUSH_VAPID_PUBLIC_KEY: "a", WEB_PUSH_VAPID_PRIVATE_KEY: "b", WEB_PUSH_SUBJECT: "https://x" }).configured === false);
const CONF = push.pushConfig({ WEB_PUSH_VAPID_PUBLIC_KEY: "pub", WEB_PUSH_VAPID_PRIVATE_KEY: "priv", WEB_PUSH_SUBJECT: "mailto:a@b.co" });
ok("all three, mailto: subject → configured, public key exposed", CONF.configured && CONF.publicKey === "pub");
ok("the three names are spelled once, in PUSH_ENV", push.PUSH_ENV.publicKey === "WEB_PUSH_VAPID_PUBLIC_KEY" && push.PUSH_ENV.privateKey === "WEB_PUSH_VAPID_PRIVATE_KEY" && push.PUSH_ENV.subject === "WEB_PUSH_SUBJECT");

function stubClient(plan) {
  const calls = [];
  return {
    calls,
    webpush: {
      setVapidDetails() {},
      async sendNotification(sub, body) {
        calls.push({ endpoint: sub.endpoint, body: JSON.parse(body) });
        const status = plan[sub.endpoint];
        if (status) {
          const err = new Error(`push ${status}`);
          err.statusCode = status;
          throw err;
        }
        return { statusCode: 201 };
      },
    },
  };
}
function stubDb() {
  const updates = [];
  return {
    updates,
    pushSubscription: {
      async updateMany(args) {
        updates.push(args);
        return { count: 1 };
      },
      async findMany() {
        return [];
      },
    },
    user: { async findMany() { return []; } },
    salesRep: { async findMany() { return []; } },
    platformAdmin: { async findMany() { return []; } },
  };
}
const ROWS = [
  { id: "s1", endpoint: "https://push/ok", keysP256dh: "k", keysAuth: "a", language: "fr" },
  { id: "s2", endpoint: "https://push/gone", keysP256dh: "k", keysAuth: "a", language: "en" },
  { id: "s3", endpoint: "https://push/404", keysP256dh: "k", keysAuth: "a", language: "en" },
  { id: "s4", endpoint: "https://push/500", keysP256dh: "k", keysAuth: "a", language: "en" },
];

{
  const client = stubClient({});
  const db = stubDb();
  const r = await push.sendToSubscriptions(ROWS, { title: "t" }, { config: push.pushConfig({}), webpush: client.webpush, db });
  ok("unconfigured → not_configured, the client is never called, the database untouched", r.reason === "not_configured" && client.calls.length === 0 && db.updates.length === 0);
}
{
  const client = stubClient({ "https://push/gone": 410, "https://push/404": 404, "https://push/500": 500 });
  const db = stubDb();
  const errors = [];
  const r = await push.sendToSubscriptions(ROWS, async (lang) => ({ title: lang === "fr" ? "Bonjour" : "Hello", tag: "x", url: "/u" }), {
    config: CONF,
    webpush: client.webpush,
    db,
    recordError: async (e) => errors.push(e),
  });
  ok("configured → one send per live row", client.calls.length === 4);
  ok("the payload is rendered per recipient language", client.calls.find((c) => c.endpoint === "https://push/ok")?.body.title === "Bonjour" && client.calls.find((c) => c.endpoint === "https://push/gone")?.body.title === "Hello");
  ok("a delivered push counts as sent and stamps lastUsedAt", r.sent === 1 && db.updates.some((u) => u.where.id === "s1" && u.data.lastUsedAt));
  ok("410 disables the row (disabledAt), and counts as disabled", r.disabled >= 1 && db.updates.some((u) => u.where.id === "s2" && u.data.disabledAt));
  ok("404 disables too", db.updates.some((u) => u.where.id === "s3" && u.data.disabledAt) && r.disabled === 2);
  ok("500 is recorded to the error log and the row is KEPT", r.failed === 1 && errors.length === 1 && errors[0].area === "push" && !db.updates.some((u) => u.where.id === "s4" && u.data.disabledAt));
  ok("the GONE set is exactly 404 and 410", [...push.GONE_STATUSES].sort().join() === "404,410");
}
{
  const r = await push.pushToUsers({ userIds: ["u1"], payload: { title: "x" } }, { config: push.pushConfig({}), db: stubDb() });
  ok("pushToUsers with no keys → not_configured without a query", r.reason === "not_configured");
  const r2 = await push.pushToReps({ salesRepIds: [], payload: { title: "x" } }, { config: CONF, db: stubDb() });
  ok("pushToReps with nobody → no_recipients", r2.reason === "no_recipients");
  const throwing = { ...stubDb(), user: { async findMany() { throw new Error("db down"); } } };
  const errors = [];
  const r3 = await push.pushToUsers({ userIds: ["u1"], payload: { title: "x" } }, { config: CONF, db: throwing, recordError: async (e) => errors.push(e) });
  ok("a sender never rejects — a thrown query is recorded and answered", r3.reason === "threw" && errors.length === 1);
}
ok("resolvePayload caps title, body and tag and defaults the URL", await (async () => {
  const p = await push.resolvePayload({ title: "a".repeat(200), body: "b".repeat(300), tag: "t".repeat(100) }, "en");
  return p.title.length === 120 && p.body.length === 240 && p.tag.length === 80 && p.url === "/";
})());
ok("appSentence renders the catalogue sentence in the reader's language", (await push.appSentence("fr", "app.notif.type.lead.created", { leadName: "Dan" })) === "Nouvelle demande de Dan");
ok("…and falls back to English for a language that lacks the key", (await push.appSentence("xx", "app.notif.type.lead.created", { leadName: "Dan" })) === "New enquiry from Dan");

const pushSrc = decomment(read("lib/notify/push.js"));
ok("web-push is imported lazily, never at module load", /await import\("web-push"\)/.test(pushSrc) && !/^import .* from "web-push"/m.test(pushSrc));
ok("the three variables are read as process.env.NAME (so check-env-docs can see them)", ["WEB_PUSH_VAPID_PUBLIC_KEY", "WEB_PUSH_VAPID_PRIVATE_KEY", "WEB_PUSH_SUBJECT"].every((n) => pushSrc.includes(`process.env.${n}`)));
ok("web-push is a dependency", Boolean(JSON.parse(read("package.json")).dependencies["web-push"]));
ok("public/sw.js exists, handles push and notificationclick, and never intercepts fetch", (() => {
  const sw = decomment(read("public/sw.js"));
  return /addEventListener\("push"/.test(sw) && /addEventListener\("notificationclick"/.test(sw) && !/addEventListener\("fetch"/.test(sw);
})());
ok("the worker hands a push to a VISIBLE tab instead of showing it over the screen", /visibilityState === "visible"/.test(decomment(read("public/sw.js"))) && /postMessage\(\{ type: "fq:push"/.test(decomment(read("public/sw.js"))));
ok("…and the toast layer listens for that hand-over", /onPushMessage\(/.test(layer));
ok("the worker is registered only from the settings block, never on page load", (() => {
  const sw = decomment(read("lib/notify/swClient.js"));
  const block = decomment(read("app/components/notifications/BrowserNotifications.js"));
  return /serviceWorker\.register\(SW_PATH/.test(sw) && /subscribePush\(/.test(block) && !/serviceWorker\.register/.test(appLayout + salesShell + platformLayout + layer);
})());

// ═══════════════════════════════════════════════════════════════════════════
section("5. Subscription routes, gated per surface");

const routeLib = await import("@/lib/notify/pushSubscription");
ok("ownerData refuses no owner", routeLib.ownerData({}) === null);
ok("ownerData refuses two owners", routeLib.ownerData({ userId: "u", salesRepId: "r" }) === null);
ok("ownerData sets one column and nulls the other two", JSON.stringify(routeLib.ownerData({ salesRepId: "r" })) === JSON.stringify({ userId: null, salesRepId: "r", platformAdminId: null }));
ok("parseSubscription refuses http:// endpoints", routeLib.parseSubscription({ endpoint: "http://push.example/abc123456789", keys: { p256dh: "k", auth: "a" } }) === null);
ok("parseSubscription refuses missing keys", routeLib.parseSubscription({ endpoint: "https://push.example/abc123456789", keys: { p256dh: "k" } }) === null);
ok("parseSubscription accepts a real one", routeLib.parseSubscription({ endpoint: "https://push.example/abc123456789", keys: { p256dh: "k", auth: "a" } })?.keysAuth === "a");

const appRoute = decomment(read("app/api/notifications/push-subscription/route.js"));
const salesRoute = decomment(read("app/api/sales/push-subscription/route.js"));
const platformRoute = decomment(read("app/api/platform/push-subscription/route.js"));
ok("/app route: memberOrRefusalPlain, owner = User", /memberOrRefusalPlain\(request\)/.test(appRoute) && /owner: \{ userId: member\.userId \}/.test(appRoute));
ok("/app route: an impersonation session (userId null) is refused", /if \(!member\.userId\)/.test(appRoute) && /status: 403/.test(appRoute));
ok("/sales route: requireOutreachRep (the rep's-own-preference gate), owner = SalesRep", /requireOutreachRep\(request\)/.test(salesRoute) && /owner: \{ salesRepId: rep\.id \}/.test(salesRoute));
ok("/platform route: getCurrentPlatformAdmin, owner = PlatformAdmin", /getCurrentPlatformAdmin\(request\)/.test(platformRoute) && /owner: \{ platformAdminId: admin\.id \}/.test(platformRoute));
ok("all three export GET, POST and DELETE from the shared handlers", [appRoute, salesRoute, platformRoute].every((r) => /export const GET = handlers\.GET/.test(r) && /export const POST = handlers\.POST/.test(r) && /export const DELETE = handlers\.DELETE/.test(r)));
const handlerSrc = decomment(read("lib/notify/pushSubscriptionRoute.js"));
ok("the handler never deletes a row — DELETE sets disabledAt", /disabledAt: new Date\(\)/.test(handlerSrc) && !/pushSubscription\.delete/.test(handlerSrc));
ok("POST refuses when push is not configured (409), so no dead subscription is stored", /status: 409/.test(handlerSrc));
ok("the sales route writes only pushSubscription (through the handler), nothing on REP_FORBIDDEN_WRITES", !/\bdb\./.test(salesRoute) && [...handlerSrc.matchAll(/\bdb\.(\w+)\./g)].every((m) => m[1] === "pushSubscription"));

// ═══════════════════════════════════════════════════════════════════════════
section("6. The events, wired on each surface");

const wired = [
  ["lib/notifications/notify.js", /pushToUsers\(\{/, "/app: every feed event (new lead, quote approved…) is pushed"],
  ["lib/messaging/ingest.js", /pushInboundMessage\(\{/, "/app: a new inbound inbox message is pushed"],
  ["lib/messaging/pushInbound.js", /hasLevel\(m, "requests", "view_only"\)/, "…to members who can read the inbox, by the route's own level"],
  ["lib/sales/salesSms.js", /pushToReps\(\{/, "/sales: an inbound text is pushed to its rep"],
  ["app/api/rep-dial/inbound/route.js", /pushRing\(ring/, "/sales: a ringing call is pushed to the reps being rung"],
  ["lib/staff/store.js", /pushMentions\(\{/, "/sales + /platform: an @mention is pushed to the people named"],
  ["app/api/sales/support/route.js", /pushToPlatformAdmins\(\{/, "/platform: a new support ticket is pushed to the assigned admin"],
  ["lib/ai/jennifer/conversations.js", /pushToPlatformRoles\(\{/, "/platform: a Jennifer escalation is pushed"],
  ["app/components/layout/NotificationBell.js", /notify\(\{/, "/app in-tab: the bell's poll announces a risen count"],
  ["app/app/messages/page.js", /notify\(\{/, "/app in-tab: the inbox announces a thread whose unread rose"],
  ["app/components/sales/IncomingCallDock.js", /notify\(\{ title: tRef\.current\("app\.notify\.incomingCall\.title"\)/, "/sales in-tab: the ring"],
  ["app/sales/SalesShell.js", /notify\(\{\s*title: tRef\.current\("app\.notify\.newTexts\.title"/, "/sales in-tab: the texts badge rising"],
  ["app/components/staff/StaffChat.js", /notify\(\{\s*title: tRef\.current\("app\.notify\.mention\.title"/, "/sales + /platform in-tab: an @mention"],
  ["app/sales/queue/page.js", /notify\(\{\s*title: t\("app\.salesQueue\.topUpTitle"\)/, "/sales in-tab: the auto top-up"],
  ["app/components/platform/PlatformSidebar.js", /notify\(\{ title: "New support ticket"/, "/platform in-tab: a new ticket"],
  ["app/components/platform/PlatformSidebar.js", /notify\(\{ title: "Jennifer escalated a conversation"/, "/platform in-tab: an escalation"],
];
for (const [file, re, why] of wired) ok(`${why} (${file})`, re.test(decomment(read(file))));
ok("every server push is fire-and-forget (void …), never awaited on the request path", [
  "lib/notifications/notify.js",
  "lib/messaging/pushInbound.js",
  "lib/sales/salesSms.js",
  "app/api/rep-dial/inbound/route.js",
  "app/api/sales/support/route.js",
  "lib/ai/jennifer/conversations.js",
].every((f) => !/await push(ToUsers|ToReps|ToPlatformAdmins|ToPlatformRoles)\(/.test(decomment(read(f)))));
ok("the in-tab announcers only announce a RISE from the second read on", [
  ["app/components/layout/NotificationBell.js", /seen\.current !== null && next > seen\.current/],
  ["app/sales/SalesShell.js", /textsSeen\.current !== null && texts > textsSeen\.current/],
  ["app/components/platform/PlatformSidebar.js", /if \(prev\) \{/],
  ["app/app/messages/page.js", /if \(prev\) \{/],
  ["app/components/staff/StaffChat.js", /if \(prev\) \{/],
].every(([f, re]) => re.test(decomment(read(f)))));
ok("the platform count route is gated and answers null where not permitted", (() => {
  const r = decomment(read("app/api/platform/notifications/count/route.js"));
  return /getCurrentPlatformAdmin\(request\)/.test(r) && /canPlatform\(admin\.role, "support:manage"\)/.test(r) && /: null,/.test(r);
})());

// ═══════════════════════════════════════════════════════════════════════════
section("7. Settings blocks and nine-language copy");

const block = decomment(read("app/components/notifications/BrowserNotifications.js"));
ok("the block has a role=switch, a permission line, a push line and a test button", /role="switch"/.test(block) && /data-browser-notify-permission/.test(block) && /data-browser-notify-push/.test(block) && /data-browser-notify-test/.test(block));
ok("the switch asks the browser from the click (requestPermission)", /await requestPermission\(\)/.test(block));
ok("'not set up on this deployment' is said in words when there are no keys", /pushNotSetUp/.test(block) && /!server\.configured/.test(block));
ok("error and not-configured are different sentences", /pushLoadError/.test(block) && /server\.error/.test(block));
ok("/app settings mounts the block on its own endpoint", /<BrowserNotifications endpoint="\/api\/notifications\/push-subscription" \/>/.test(decomment(read("app/app/settings/notifications/page.js"))));
ok("/sales/pay mounts the block on its own endpoint", /<BrowserNotifications endpoint="\/api\/sales\/push-subscription" \/>/.test(decomment(read("app/sales/pay/page.js"))));
ok("/platform/settings mounts the block on its own endpoint", existsSync(join(ROOT, "app/platform/settings/page.js")) && /<BrowserNotifications endpoint="\/api\/platform\/push-subscription" \/>/.test(decomment(read("app/platform/settings/page.js"))));
ok("the platform rail links to /platform/settings", /href: "\/platform\/settings"/.test(decomment(read("app/components/platform/PlatformSidebar.js"))));

const { APP_MESSAGES } = await import("@/app/i18n/appMessages");
const LANGS = Object.keys(APP_MESSAGES);
ok("nine catalogue languages", LANGS.length === 9, LANGS);
const usedKeys = new Set();
for (const f of [
  "app/components/notifications/BrowserNotifications.js",
  "app/components/ToastLayer.js",
  "app/sales/queue/page.js",
  "app/components/sales/IncomingCallDock.js",
  "app/sales/SalesShell.js",
  "app/components/staff/StaffChat.js",
  "app/app/messages/page.js",
  "lib/messaging/pushInbound.js",
  "lib/sales/salesSms.js",
  "lib/staff/store.js",
  "app/api/rep-dial/inbound/route.js",
]) {
  for (const m of decomment(read(f)).matchAll(/"(app\.(?:browserNotif|notify|toast)\.[A-Za-z0-9_.]+)"/g)) usedKeys.add(m[1]);
  if (f === "app/sales/queue/page.js") usedKeys.add("app.salesQueue.topUpTitle");
}
ok("the block and the events use catalogue keys", usedKeys.size >= 30, usedKeys.size);
const missing = [];
for (const key of usedKeys) for (const lang of LANGS) if (typeof APP_MESSAGES[lang][key] !== "string") missing.push(`${lang}:${key}`);
ok("every one of them exists in all nine languages", missing.length === 0, missing.slice(0, 10));
// The feed's own sentences (app.notif.type.*) predate this work and are in
// six of the nine languages; appSentence() falls back to English for the
// other three, exactly as the bell's t() does — asserted in §4 above.
ok("the feed sentences the push reuses exist in English (the fallback every language reaches)", typeof APP_MESSAGES.en["app.notif.type.lead.created"] === "string" && typeof APP_MESSAGES.en["app.notif.type.quote.accepted"] === "string");

// ═══════════════════════════════════════════════════════════════════════════
console.log(`\n${failures.length ? "FAILED" : "PASSED"} — ${pass} passed, ${failures.length} failed`);
if (failures.length) {
  for (const f of failures) console.log(`  ✗ ${f}`);
  process.exit(1);
}
