// lib/notify/push.js
//
// Web Push — the half of browser notifications that works with the tab
// closed. lib/notify/browser.js is the in-tab half; public/sw.js is the
// service worker that receives what this file sends.
//
// ══ Feature-detected, end to end ═══════════════════════════════════════════
//
// Three variables make it real (docs/VERCEL.md):
//
//   WEB_PUSH_VAPID_PUBLIC_KEY    handed to the browser so it can subscribe
//   WEB_PUSH_VAPID_PRIVATE_KEY   signs every push; never leaves the server
//   WEB_PUSH_SUBJECT             mailto: the push services can reach us at
//
// The owner generates the pair with `npx web-push generate-vapid-keys` and
// sets them in Vercel; this code never generates, logs or stores a key.
// Without them pushConfigured() is false, the settings block says "push is
// not set up on this deployment" beside a switch that still governs the
// in-tab half, no browser is ever asked to subscribe, and every sender below
// returns { sent: 0, reason: "not_configured" } without touching the
// database. The `web-push` module is imported lazily so a deployment
// without keys never loads it.
//
// ══ Best-effort, never on the request path ═════════════════════════════════
//
// A push is a courtesy about something that already happened. The webhook
// that stored the text, the route that filed the ticket, the fan-out that
// wrote the feed row — none of them may fail or slow down because a push
// service was down. So every entry point here is fire-and-forget: it
// returns a promise the caller is expected to drop (`void pushToUsers(…)`)
// and reports its own failures to recordError under area "push". Nothing
// here throws.
//
// ══ 410 / 404 ══════════════════════════════════════════════════════════════
//
// The push service answers 410 Gone (or 404) when the browser unsubscribed
// — the person revoked the permission, cleared site data, or the
// subscription expired. The row is marked disabledAt then and there, so
// the next event does not pay for a request that cannot arrive. Any other
// failure (429, 5xx, network) is recorded and the row is left alone: it is
// the service's bad day, not the browser's.
//
// ══ Who gets what ══════════════════════════════════════════════════════════
//
// Recipients are identities, never rows: pushToUsers({ userIds }),
// pushToReps({ salesRepIds }), pushToPlatformAdmins({ platformAdminIds }).
// The payload is `{ title, body, tag, url }` — or a FUNCTION of the
// recipient's language, because a system notification is prose in the
// reader's language and the sender knows the User.language / SalesRep.
// language column (platform admins read English; the console is English).
// `tag` is the same one the page's own notify() uses for the event, so the
// OS collapses the two into one notification when both arrive.
//
// Money never travels in a push. A notification sits on a lock screen; the
// feed row's amount is withheld from readers without showPricing and the
// push says less than the row, never more.

import { db } from "@/lib/db";

/** Env names, exported so docs, the settings route and the check script all
 *  spell them the same way. */
export const PUSH_ENV = {
  publicKey: "WEB_PUSH_VAPID_PUBLIC_KEY",
  privateKey: "WEB_PUSH_VAPID_PRIVATE_KEY",
  subject: "WEB_PUSH_SUBJECT",
};

/** Reads the three variables. Exported for the check script; `env` is
 *  injectable so it can be executed against a stub. */
export function pushConfig(env = null) {
  // process.env.X spelled out, not env[name]: scripts/check-env-docs.mjs
  // finds a variable by that literal, and a name it cannot find is one it
  // reports as "documented but nothing reads it".
  const publicKey = String((env ? env.WEB_PUSH_VAPID_PUBLIC_KEY : process.env.WEB_PUSH_VAPID_PUBLIC_KEY) || "").trim();
  const privateKey = String((env ? env.WEB_PUSH_VAPID_PRIVATE_KEY : process.env.WEB_PUSH_VAPID_PRIVATE_KEY) || "").trim();
  const subject = String((env ? env.WEB_PUSH_SUBJECT : process.env.WEB_PUSH_SUBJECT) || "").trim();
  const configured = Boolean(publicKey && privateKey && /^mailto:.+@.+/.test(subject));
  return { configured, publicKey: configured ? publicKey : null, privateKey: configured ? privateKey : null, subject: configured ? subject : null };
}

export function pushConfigured(env = null) {
  return pushConfig(env).configured;
}

/** The public key the browser subscribes with, or null when push is not set
 *  up. Safe to hand to a client: it is the PUBLIC half. */
export function pushPublicKey(env = null) {
  return pushConfig(env).publicKey;
}

/** HTTP statuses from the push service that mean "this browser is gone". */
export const GONE_STATUSES = new Set([404, 410]);

/**
 * Resolve the payload for one recipient. `payload` is an object or a
 * (possibly async) function of the recipient's language code — async so a
 * caller can look the sentence up in the app catalogue without every
 * module that sends a push importing the whole catalogue. Returns null when
 * there is nothing to say, which skips the recipient.
 */
export async function resolvePayload(payload, language) {
  const p = typeof payload === "function" ? await payload(language || "en") : payload;
  if (!p || !p.title) return null;
  return {
    title: String(p.title).slice(0, 120),
    body: p.body ? String(p.body).slice(0, 240) : "",
    tag: p.tag ? String(p.tag).slice(0, 80) : undefined,
    url: p.url ? String(p.url) : "/",
  };
}

/**
 * The core: send one payload to a set of subscription rows. Returns
 * { sent, failed, disabled }. `deps` lets the check script substitute the
 * web-push client and the database.
 */
export async function sendToSubscriptions(rows, payloadFor, deps = {}) {
  const config = deps.config || pushConfig();
  if (!config.configured) return { sent: 0, failed: 0, disabled: 0, reason: "not_configured" };
  if (!rows.length) return { sent: 0, failed: 0, disabled: 0, reason: "no_subscriptions" };

  const client = deps.webpush || (await import("web-push")).default;
  client.setVapidDetails(config.subject, config.publicKey, config.privateKey);
  const database = deps.db || db;
  const recordError = deps.recordError || (await import("@/lib/platform/errorLog")).recordError;

  let sent = 0;
  let failed = 0;
  let disabled = 0;
  const now = new Date();

  await Promise.all(
    rows.map(async (row) => {
      const payload = await resolvePayload(payloadFor, row.language).catch(() => null);
      if (!payload) return;
      try {
        await client.sendNotification(
          { endpoint: row.endpoint, keys: { p256dh: row.keysP256dh, auth: row.keysAuth } },
          JSON.stringify(payload),
          // A notification about a text or a call is stale after a few
          // hours; the push service drops it rather than delivering it
          // tomorrow morning. "high" so a phone wakes for it.
          { TTL: 4 * 3600, urgency: "high" },
        );
        sent++;
        await database.pushSubscription.updateMany({ where: { id: row.id }, data: { lastUsedAt: now } }).catch(() => {});
      } catch (err) {
        const status = Number(err?.statusCode);
        if (GONE_STATUSES.has(status)) {
          disabled++;
          await database.pushSubscription
            .updateMany({ where: { id: row.id, disabledAt: null }, data: { disabledAt: now } })
            .catch(() => {});
          return;
        }
        failed++;
        await recordError({
          area: "push",
          message: `push failed (${status || "network"}) for subscription ${row.id}`,
          detail: { status: status || null, body: String(err?.body || err?.message || "").slice(0, 300) },
        }).catch(() => {});
      }
    }),
  );

  return { sent, failed, disabled };
}

/** Rows for a set of owners, live only, with the owner's language beside. */
async function liveRows(where, ownerKey, languages, database) {
  const rows = await database.pushSubscription.findMany({
    where: { ...where, disabledAt: null },
    select: { id: true, endpoint: true, keysP256dh: true, keysAuth: true, [ownerKey]: true },
  });
  return rows.map((r) => ({ ...r, language: languages.get(r[ownerKey]) || "en" }));
}

/** Guard every public sender: a configured deployment, non-empty ids. */
function ready(ids, deps) {
  const config = deps.config || pushConfig();
  const list = [...new Set((ids || []).filter(Boolean))];
  if (!config.configured) return { skip: { sent: 0, failed: 0, disabled: 0, reason: "not_configured" } };
  if (!list.length) return { skip: { sent: 0, failed: 0, disabled: 0, reason: "no_recipients" } };
  return { list };
}

/** Swallow-and-record wrapper so no sender can reject. */
async function guarded(fn, deps) {
  try {
    return await fn();
  } catch (err) {
    try {
      const recordError = deps.recordError || (await import("@/lib/platform/errorLog")).recordError;
      await recordError({ area: "push", message: err?.message || "push sender threw" });
    } catch {
      /* the error log is itself best-effort */
    }
    return { sent: 0, failed: 1, disabled: 0, reason: "threw" };
  }
}

/**
 * /app: members of a company, by User id. `fallbackLanguage` is the
 * company's default, used for a User with no stated language (null there
 * means "follow the company", the same rule the shell applies).
 */
export function pushToUsers({ userIds, payload, fallbackLanguage = "en" }, deps = {}) {
  return guarded(async () => {
    const { list, skip } = ready(userIds, deps);
    if (skip) return skip;
    const database = deps.db || db;
    const users = await database.user.findMany({ where: { id: { in: list } }, select: { id: true, language: true } });
    const languages = new Map(users.map((u) => [u.id, u.language || fallbackLanguage || "en"]));
    const rows = await liveRows({ userId: { in: list } }, "userId", languages, database);
    return sendToSubscriptions(rows, payload, deps);
  }, deps);
}

/** /sales: reps, by SalesRep id. Language from SalesRep.language. */
export function pushToReps({ salesRepIds, payload }, deps = {}) {
  return guarded(async () => {
    const { list, skip } = ready(salesRepIds, deps);
    if (skip) return skip;
    const database = deps.db || db;
    const reps = await database.salesRep.findMany({ where: { id: { in: list } }, select: { id: true, language: true } });
    const languages = new Map(reps.map((r) => [r.id, r.language || "en"]));
    const rows = await liveRows({ salesRepId: { in: list } }, "salesRepId", languages, database);
    return sendToSubscriptions(rows, payload, deps);
  }, deps);
}

/** /platform: admins, by PlatformAdmin id. The console is English. */
export function pushToPlatformAdmins({ platformAdminIds, payload }, deps = {}) {
  return guarded(async () => {
    const { list, skip } = ready(platformAdminIds, deps);
    if (skip) return skip;
    const database = deps.db || db;
    const rows = await liveRows({ platformAdminId: { in: list } }, "platformAdminId", new Map(), database);
    return sendToSubscriptions(rows, payload, deps);
  }, deps);
}

/**
 * Every active platform admin of the given roles — for events with no
 * single owner (a new ticket before assignment, an escalation).
 */
export function pushToPlatformRoles({ roles = ["superadmin", "admin"], payload }, deps = {}) {
  return guarded(async () => {
    const config = deps.config || pushConfig();
    if (!config.configured) return { sent: 0, failed: 0, disabled: 0, reason: "not_configured" };
    const database = deps.db || db;
    const admins = await database.platformAdmin.findMany({ where: { active: true, role: { in: roles } }, select: { id: true } });
    return pushToPlatformAdmins({ platformAdminIds: admins.map((a) => a.id), payload }, deps);
  }, deps);
}

/**
 * The sentence a feed row renders, in a language — for /app events that go
 * through lib/notifications/notify.js. Reads the app catalogue the way
 * lib/email/signupRecoveryEmail.js does: the key in the reader's language,
 * English when the language lacks it. Interpolates {param} the way the
 * client's t() does, and calls a function value the same way.
 */
export async function appSentence(language, key, params = {}) {
  const { APP_MESSAGES } = await import("@/app/i18n/appMessages");
  const dict = APP_MESSAGES[String(language || "en").toLowerCase()] || {};
  let raw = dict[key] ?? APP_MESSAGES.en[key];
  if (raw == null) return null;
  if (typeof raw === "function") return String(raw(params));
  for (const [k, v] of Object.entries(params || {})) raw = String(raw).split(`{${k}}`).join(String(v ?? ""));
  return String(raw);
}
