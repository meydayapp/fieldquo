// scripts/check-app-messages-kit.mjs
//
//   npm run check:app-messages-kit
//
// The contractor's inbox (/app/messages) on the shared chat kit: what the
// rebuild claims, executed rather than eyeballed.
//
// ══ What this proves ═══════════════════════════════════════════════════════
//
//   1. The screen is drawn by app/components/chat — the same ChatLayout,
//      RoomList, Thread, Composer and ContextBar /sales/messages and the
//      team chat render — and not by a private copy of any of them.
//   2. The three groups the owner asked for (plus Snoozed, which the status
//      vocabulary already had and which cannot be allowed to vanish) are
//      decided by lib/messaging/rooms.js, and every rule in it is run on a
//      fixture: outcome set → Done, resolved → Done, snoozed → Snoozed,
//      pending → Waiting, open + waiting → Needs a reply, open + we answered
//      → Waiting, a pre-columns row filed by its last direction.
//   3. The unread line is placed from the stored COUNT, before the read is
//      recorded: never read, everything read, and mid-thread.
//   4. The blocked state for a real company is still keyed to the missing
//      Meta permission — composerState.js decides it, the page prints it,
//      and the card links to the screen where the Page gets connected. A
//      demo company gets the mock and only a demo company: the list route
//      tests `connection.mock` before it touches MessageThread.
//   5. The composer is the last flex child, never `fixed`, and nothing on
//      the screen registers with useBottomDock.
//   6. Every chip row scrolls sideways inside its own container — the
//      owner's second live report — and the page itself never does.
//   7. Every key the page calls with parameters carries THOSE placeholders
//      in all nine languages. "Conversation {n}" rendered literally on the
//      live inbox because the page passed `number`; a grep cannot catch a
//      placeholder mismatch, so this walks them.
//   8. The four kit props the rebuild added (Avatar `badge`, Thread
//      `renderBody`, Composer `allowEmpty` / `inputDisabled` /
//      `textareaStyle`) exist and default to the old behaviour.
//
// Mutations that must fail this script: reorder GROUP_ORDER; file an
// outcome-set thread under Needs a reply; drop the SOCIAL_SETTINGS_PATH link;
// add `fixed bottom-0` to the composer; pass `{ number }` to threadNumber.
//
// Run:
//   node --import ./scripts/alias-loader.mjs scripts/check-app-messages-kit.mjs
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

import {
  GROUP_ORDER,
  GROUP_NEEDS_REPLY,
  GROUP_WAITING,
  GROUP_SNOOZED,
  GROUP_DONE,
  groupOf,
  groupThreads,
  groupTitleKey,
  messageItem,
  lastReadInstant,
} from "@/lib/messaging/rooms";
import { layoutThread, ROW_UNREAD, ROW_MESSAGE } from "@/lib/chat/threadLayout";
import { composerBlock, connectionBlurb } from "@/lib/messaging/composerState";
import { THREAD_STATUSES, THREAD_OUTCOMES, statusLabelKey, outcomeLabelKey } from "@/lib/messaging/outcomes";
import { MESSAGING_PLATFORMS, platformLabelKey } from "@/lib/messaging/platforms";
import { ACTIVITY_TYPES, LINK_KINDS, activityLabel } from "@/lib/messaging/activity";
import { waitedLabel } from "@/lib/messaging/waiting";
import { APP_MESSAGES } from "../app/i18n/appMessages.js";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const read = (p) => readFileSync(join(ROOT, p), "utf8");

let pass = 0;
const failures = [];
function ok(label, condition, detail = "") {
  if (condition) {
    pass++;
    console.log(`  ok   ${label}`);
  } else {
    failures.push(label + (detail ? `  — ${detail}` : ""));
    console.log(`  FAIL ${label}${detail ? `  — ${detail}` : ""}`);
  }
}
const section = (t) => console.log(`\n${t}\n`);
function orderedInSource(source, a, b) {
  const ia = source.indexOf(a);
  const ib = source.indexOf(b, ia === -1 ? 0 : ia);
  return ia >= 0 && ib > ia;
}

const page = read("app/app/messages/page.js");
const bits = read("app/app/messages/ConversationBits.js");
const listRoute = read("app/api/messaging/threads/route.js");
const LANGS = ["en", "fr", "es", "uk", "pa", "tl", "de", "zh", "it"];

// ═══════════════════════════════════════════════════════════════════════════
section("1. The screen is the shared kit");
// ═══════════════════════════════════════════════════════════════════════════

const kitImport = /import \{([^}]+)\} from "@\/app\/components\/chat"/.exec(page);
const imported = kitImport ? kitImport[1].split(",").map((s) => s.trim()).filter(Boolean) : [];
for (const name of ["ChatLayout", "RoomList", "Thread", "Composer", "ContextBar", "Avatar", "initialsOf"]) {
  ok(`the page imports ${name} from the kit`, imported.includes(name));
}
ok("the three panes are handed to ChatLayout", /<ChatLayout[\s\S]{0,400}list=\{listPane\}[\s\S]{0,80}thread=\{threadPane\}[\s\S]{0,80}context=\{contextPane\}/.test(page));
ok("the thread's rows come from layoutThread", /layoutThread\(items, \{ lastReadAt: openedReadAt \}\)/.test(page));
ok("the list is a RoomList of groups", /<RoomList\s[\s\S]{0,80}groups=\{groups\}/.test(page));
ok("the context bar has the three tabs", /key: "details"/.test(page) && /key: "outcome"/.test(page) && /key: "history"/.test(page));
// No second copy of what the kit draws.
for (const gone of ["export function Avatar", "export function Bubble", "export function StatusFilter", "export function dayLabel", "export function clockTime", "export function ActivityLine"]) {
  ok(`ConversationBits no longer carries "${gone}" — the kit draws it`, !bits.includes(gone));
}
ok("ConversationBits still carries what the kit does not draw", ["PlatformBadge", "Attachments", "AttachControl", "NoteBody", "WaitingBadge", "StatusPicker", "ComposerTabs", "ServiceWindowNotice", "TemplatePicker", "AssigneePicker", "OutcomePicker"].every((n) => bits.includes(`export function ${n}`)));

// ═══════════════════════════════════════════════════════════════════════════
section("2. The groups, executed");
// ═══════════════════════════════════════════════════════════════════════════

ok("the order is Needs a reply · Waiting on them · Snoozed · Done", GROUP_ORDER.join(",") === "needsReply,waiting,snoozed,done");
ok("an outcome-set thread is Done whatever its status", groupOf({ status: "open", outcome: "won", waitingSince: "2026-09-01T00:00:00Z" }) === GROUP_DONE);
ok("a resolved thread is Done", groupOf({ status: "resolved", outcome: null }) === GROUP_DONE);
ok("the legacy 'closed' status is Done too", groupOf({ status: "closed" }) === GROUP_DONE);
ok("a snoozed thread is Snoozed, not Waiting", groupOf({ status: "snoozed", waitingSince: "2026-09-01T00:00:00Z" }) === GROUP_SNOOZED);
ok("a pending thread is Waiting on them", groupOf({ status: "pending", waitingSince: null }) === GROUP_WAITING);
ok("an open thread with someone waiting Needs a reply", groupOf({ status: "open", waitingSince: "2026-09-01T00:00:00Z" }) === GROUP_NEEDS_REPLY);
ok("an open thread we answered (nobody waiting) is Waiting on them", groupOf({ status: "open", waitingSince: null, lastDirection: "out" }) === GROUP_WAITING);
ok("a pre-columns open row whose last message is theirs Needs a reply", groupOf({ status: "open", waitingSince: null, lastDirection: "in" }) === GROUP_NEEDS_REPLY);
ok("an unknown status reads as open (nobody can classify it, somebody must look)", groupOf({ status: "archived", waitingSince: "2026-09-01T00:00:00Z" }) === GROUP_NEEDS_REPLY);
ok("an empty or hostile list gives four empty buckets", (() => {
  const g = groupThreads([null, 4, "x", undefined]);
  return GROUP_ORDER.every((k) => Array.isArray(g[k]) && g[k].length === 0);
})());
const fx = [
  { id: "a", status: "open", waitingSince: "2026-09-10T10:00:00Z", lastMessageAt: "2026-09-10T10:00:00Z" },
  { id: "b", status: "open", waitingSince: "2026-09-11T10:00:00Z", lastMessageAt: "2026-09-11T10:00:00Z" },
  { id: "c", status: "pending", lastMessageAt: "2026-09-09T10:00:00Z" },
  { id: "d", status: "snoozed", lastMessageAt: "2026-09-08T10:00:00Z" },
  { id: "e", status: "open", outcome: "lost", lastMessageAt: "2026-09-07T10:00:00Z" },
  { id: "f", status: "resolved", lastMessageAt: "2026-09-12T10:00:00Z" },
];
const grouped = groupThreads(fx);
ok("each thread lands in exactly one bucket", GROUP_ORDER.reduce((n, k) => n + grouped[k].length, 0) === fx.length);
ok("newest activity first within a bucket", grouped[GROUP_NEEDS_REPLY].map((t) => t.id).join(",") === "b,a");
ok("Done holds the outcome-set and the resolved, newest first", grouped[GROUP_DONE].map((t) => t.id).join(",") === "f,e");
for (const lang of LANGS) {
  const missing = GROUP_ORDER.filter((k) => !APP_MESSAGES[lang]?.[groupTitleKey(k)]);
  ok(`${lang}: every group has a title`, missing.length === 0, missing.join(", "));
}
ok("the page draws the groups from GROUP_ORDER, not a hand-typed list", /GROUP_ORDER\.map\(\(key\) => \(\{\s*key,\s*title: t\(groupTitleKey\(key\)\)/.test(page));
ok("Done starts collapsed, as on the sales inbox", /useState\(\[GROUP_DONE\]\)/.test(page));
ok("the list route emits the direction the grouping reads", /lastDirection: t\.messages\[0\]\?\.direction \|\| null/.test(listRoute));
ok("…and the demo summaries do too", /lastDirection:/.test(read("lib/messaging/demoThreads.js")));

// ═══════════════════════════════════════════════════════════════════════════
section("3. The unread line, from the stored count");
// ═══════════════════════════════════════════════════════════════════════════

const msgs = [
  { id: 1, direction: "in", sentAt: "2026-09-10T10:00:00Z", body: "hi" },
  { id: 2, direction: "out", sentAt: "2026-09-10T10:05:00Z", body: "hello" },
  { id: 3, direction: "note", sentAt: "2026-09-10T10:06:00Z", body: "fussy" },
  { id: 4, direction: "in", sentAt: "2026-09-11T09:00:00Z", body: "photos?" },
  { id: 5, direction: "activity", sentAt: "2026-09-11T09:30:00Z", activity: { type: "assigned", to: "Dave" } },
  { id: 6, direction: "in", sentAt: "2026-09-11T10:00:00Z", body: "here" },
];
const rowsFor = (unread) =>
  layoutThread(msgs.map(messageItem).map((m) => (m.kind === "system" ? { ...m, body: "x" } : m)), { lastReadAt: lastReadInstant(msgs, unread) });
const unreadAbove = (rows) => {
  const i = rows.findIndex((r) => r.kind === ROW_UNREAD);
  if (i < 0) return null;
  const next = rows.slice(i + 1).find((r) => r.kind === ROW_MESSAGE);
  return next?.item?.id ?? null;
};
ok("never read (count = every inbound) → the line sits above their first message", unreadAbove(rowsFor(3)) === 1);
ok("two unread → the line sits above their second-to-last message", unreadAbove(rowsFor(2)) === 4);
ok("one unread → the line sits above their last message", unreadAbove(rowsFor(1)) === 6);
ok("nothing unread → no line", unreadAbove(rowsFor(0)) === null);
ok("a count larger than the inbound rows reads as never read", lastReadInstant(msgs, 99) === null);
ok("a hostile count is not a crash", lastReadInstant(msgs, "lots") instanceof Date && lastReadInstant(null, 2) instanceof Date);
ok("the instant is captured BEFORE the read is recorded", orderedInSource(page, "setOpenedReadAt(lastReadInstant(data.messages, data.unread))", 'JSON.stringify({ read: true })'));
ok("…and frozen per thread", /if \(openedFor\.current !== activeId\) \{/.test(page));
ok("a demo thread is never marked read (nothing is stored)", /String\(data\.id\)\.startsWith\("demo_"\)\) return;/.test(page));

// The four stored directions → three kinds.
ok("an activity row is a system row", messageItem(msgs[4]).kind === "system");
ok("a note is its own kind, never grouped with a reply", messageItem(msgs[2]).kind === "note");
ok("a failed reply is marked failed with Meta's sentence", (() => {
  const m = messageItem({ id: 9, direction: "out", sentAt: "2026-09-11T10:00:00Z", body: "x", failedReason: "No Page is connected." });
  return m.status === "failed" && m.error === "No Page is connected.";
})());
ok("a delivered reply is not", messageItem(msgs[1]).status === "sent" && messageItem(msgs[1]).error === null);
ok("garbage is dropped, not thrown", messageItem(null) === null && messageItem("x") === null);
ok("the page translates an activity row through activityLabel and drops unknown ones", /const sentence = activitySentence\(item\.activity, t\);\s*if \(!sentence\) continue;/.test(page) && /const label = activityLabel\(activity\);\s*if \(!label\) return null;/.test(page));
ok("the WhatsApp window row is drawn only where the send path enforces a window", /if \(windowClosed\) \{/.test(page) && /id: "window:closed", kind: "system"/.test(page) && !/platform === "facebook"[\s\S]{0,80}window/.test(page));

// ═══════════════════════════════════════════════════════════════════════════
section("4. The blocked state, still keyed to the missing permission");
// ═══════════════════════════════════════════════════════════════════════════

const real = { connected: false, mock: false, reason: "awaiting_meta_approval", channels: [] };
ok("a real company waiting on Meta gets the awaiting-approval sentence", connectionBlurb(real) === "app.messages.connect.awaitingApproval");
ok("…and its composer is blocked with the same reason", composerBlock(real) === "app.messages.compose.disabled.awaitingApproval");
ok("a real company with nothing connected is told to connect", connectionBlurb({ connected: false, mock: false, reason: "not_connected" }) === "app.messages.connect.notConnected");
ok("a demo company gets no banner", connectionBlurb({ connected: true, mock: true, reason: null }) === null);
ok("…but its composer is off with the demo reason", composerBlock({ connected: true, mock: true }) === "app.messages.compose.disabled.demo");
ok("the page prints the blurb", /\{blurbKey && \(/.test(page) && /t\(blurbKey\)/.test(page));
ok("the card links to the Meta settings screen", /href=\{SOCIAL_SETTINGS_PATH\}/.test(page));
ok("…except for FieldQuo's own misconfiguration, where there is nothing to do there", /connection\?\.reason !== "not_configured" && \(/.test(page));
ok("the empty list never says 'no conversations' over a blocked connection without the card", /!blurbKey && \(/.test(page));
ok("the list route serves the mock only on connection.mock, before touching the table", orderedInSource(listRoute, "if (connection.mock) {", "db.messageThread.findMany"));
ok("…and the mock is decided from Company.isDemo, not from the request", /company\?\.isDemo/.test(read("lib/messaging/channels.js")) && !/searchParams\.get\("demo"\)/.test(listRoute));
ok("the channel filter is a server parameter, validated against the platform list", /isMessagingPlatform\(searchParams\.get\("platform"\)\)/.test(listRoute) && /channel: \{ platform: platformFilter \}/.test(listRoute));
ok("the page sends it", /search\.set\("platform", platform\)/.test(page));
ok("the read gate on the list is unchanged", /requireLevel\(full, "requests", "view_only", "read messages"\)/.test(listRoute));
ok("the page hides the write controls from a view-only member by the same ladder", /useHasLevel\("requests", "view_create_edit"\)/.test(page));

// ═══════════════════════════════════════════════════════════════════════════
section("5. The composer is the last flex child, never fixed");
// ═══════════════════════════════════════════════════════════════════════════

// Comments stripped first: the header comment NAMES the rejected `fixed`
// alternative, and a doc comment may say "a fixed amber wash". Only code
// counts.
const code = (src) => src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
ok("nothing on the screen is position: fixed", !/\bfixed\b/.test(code(page)) && !/\bfixed\b/.test(code(bits)));
ok("nothing registers with useBottomDock", !/useBottomDock\(/.test(page) && !/from "@\/app\/hooks\/useBottomDock"/.test(page));
ok("the header comment still says why", /`fixed bottom-…` composer would have to register with\s*(?:\/\/\s*)?useBottomDock/.test(page));
ok("the composer area comes after the Thread in the thread pane", orderedInSource(page, "<Thread\n", "<ComposerArea"));
ok("the kit's Composer is used, with the page's own send", /<Composer\s[\s\S]{0,200}onSend=\{send\}/.test(page));
ok("the server's refusal is shown under the box", /reportResponseError\(\s*res,\s*setSendError,/.test(page) && /data-send-error/.test(page));
ok("no `!` catalogue is offered — there is none for this screen", !/canned=/.test(page));

// ═══════════════════════════════════════════════════════════════════════════
section("6. Chip rows scroll inside their own container");
// ═══════════════════════════════════════════════════════════════════════════

for (const marker of ["data-channel-filter", "data-thread-actions"]) {
  const at = page.indexOf(marker);
  const around = page.slice(Math.max(0, at - 400), at + 50);
  ok(`${marker} scrolls sideways in its own row`, at >= 0 && /overflow-x-auto/.test(around) && !/flex-wrap/.test(around.slice(around.lastIndexOf("className"))));
}
ok("the page body never scrolls sideways", !/overflow-x-auto"[^>]*data-tour="messages-inbox"/.test(page));

// ═══════════════════════════════════════════════════════════════════════════
section("7. Placeholders match the catalogue");
// ═══════════════════════════════════════════════════════════════════════════

// Every t("key", { a, b }) call in the page, with its parameter names.
const calls = [...page.matchAll(/t\(\s*"(app\.messages\.[\w.]+)"\s*,\s*\{([^}]*)\}\s*\)/g)].map((m) => ({
  key: m[1],
  params: m[2].split(",").map((s) => s.trim().split(":")[0].trim()).filter(Boolean),
}));
ok("the page calls at least three keys with parameters", calls.length >= 3, String(calls.length));
for (const { key, params } of calls) {
  for (const lang of LANGS) {
    const raw = APP_MESSAGES[lang]?.[key];
    const wanted = raw ? [...String(raw).matchAll(/\{(\w+)\}/g)].map((m) => m[1]) : null;
    ok(
      `${lang}: ${key} carries {${params.join("}, {")}}`,
      Boolean(raw) && wanted.every((w) => params.includes(w)) && params.every((p) => wanted.includes(p)),
      raw ? `catalogue has {${wanted.join("}, {")}}` : "missing",
    );
  }
}
ok("the conversation number is passed as {n}, the placeholder the catalogue carries", /threadNumber", \{ n: /.test(page) && !/threadNumber", \{ number/.test(page));
for (const lang of LANGS) {
  ok(`${lang}: every status label the groups replaced still exists`, THREAD_STATUSES.every((s) => APP_MESSAGES[lang]?.[statusLabelKey(s)]));
  ok(`${lang}: every outcome and its meaning has words`, [...THREAD_OUTCOMES, "open"].every((o) => APP_MESSAGES[lang]?.[`app.messages.outcome.meaning.${o}`]) && THREAD_OUTCOMES.every((o) => APP_MESSAGES[lang]?.[outcomeLabelKey(o)]));
  ok(`${lang}: every platform chip has a label`, MESSAGING_PLATFORMS.every((p) => APP_MESSAGES[lang]?.[platformLabelKey(p)]));
}

// ── The two catalogues nothing executed before ─────────────────────────────
//
// Every activity row rendered its RAW KEY ("app.messages.activity.linkedBy")
// and every waiting badge read "Waiting {n} min" on the live inbox, because
// activityLabel() and waitedLabel() build keys from closed lists and nothing
// walked those lists through the catalogue. Both walk now, with the
// placeholders each function actually returns.
const placeholders = (raw) => [...String(raw || "").matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort().join(",");
const activityFixtures = [];
for (const type of ACTIVITY_TYPES) {
  const base = { type, by: "Dave", to: "Nadia", outcome: "won", kind: "quote" };
  if (type === "status_changed") {
    for (const to of THREAD_STATUSES) activityFixtures.push({ ...base, to }, { ...base, to, by: null });
  } else if (type === "linked" || type === "unlinked") {
    for (const kind of LINK_KINDS) activityFixtures.push({ ...base, kind }, { ...base, kind, by: null });
  } else {
    activityFixtures.push(base, { ...base, by: null });
  }
}
for (const fxRow of activityFixtures) {
  const label = activityLabel(fxRow);
  ok(`activity ${fxRow.type}${fxRow.to ? ":" + fxRow.to : ""}${fxRow.kind && /link/.test(fxRow.type) ? ":" + fxRow.kind : ""} ${fxRow.by ? "by" : "auto"} → a key`, Boolean(label?.key));
  if (!label) continue;
  const want = Object.keys(label.params).sort().join(",");
  for (const lang of LANGS) {
    const raw = APP_MESSAGES[lang]?.[label.key];
    ok(`${lang}: ${label.key} exists with {${want}}`, Boolean(raw) && placeholders(raw) === want, raw ? `has {${placeholders(raw)}}` : "missing");
  }
}
for (const lang of LANGS) {
  ok(`${lang}: every link kind has a word`, LINK_KINDS.every((k) => APP_MESSAGES[lang]?.[`app.messages.activity.kind.${k}`]));
}
ok("the page translates the outcome and the kind inside the sentence", /params\.outcome = t\(outcomeLabelKey\(params\.outcome\)\)/.test(page) && /params\.kind = t\(`app\.messages\.activity\.kind\.\$\{params\.kind\}`\)/.test(page));
const nowFx = new Date("2026-09-12T12:00:00Z");
for (const [ago, key] of [[30 * 1000, "app.messages.waiting.justNow"], [5 * 60 * 1000, "app.messages.waiting.minutes"], [3 * 3600 * 1000, "app.messages.waiting.hours"], [2 * 86400 * 1000, "app.messages.waiting.days"]]) {
  const label = waitedLabel(new Date(nowFx.getTime() - ago), nowFx);
  ok(`waiting ${ago / 1000}s → ${key}`, label?.key === key);
  const want = Object.keys(label?.params || {}).sort().join(",");
  for (const lang of LANGS) {
    const raw = APP_MESSAGES[lang]?.[key];
    ok(`${lang}: ${key} carries {${want}}`, Boolean(raw) && placeholders(raw) === want, raw ? `has {${placeholders(raw)}}` : "missing");
  }
}

// ═══════════════════════════════════════════════════════════════════════════
section("8. The kit props the rebuild added, backwards compatible");
// ═══════════════════════════════════════════════════════════════════════════

const avatar = read("app/components/chat/Avatar.js");
const thread = read("app/components/chat/Thread.js");
const composer = read("app/components/chat/Composer.js");
const roomList = read("app/components/chat/RoomList.js");
ok("Avatar takes a caller-drawn badge, defaulting to the glyph lookup", /badge = null,/.test(avatar) && /const Badge = !badge && channel \? CHANNEL_ICONS\[channel\] : null;/.test(avatar));
ok("RoomListItem forwards room.channelBadge", /badge=\{room\.channelBadge \|\| null\}/.test(roomList));
ok("Thread takes renderBody and falls back to the plain paragraph", /renderBody = null,/.test(thread) && /\(renderBody \? renderBody\(m\) : null\) \?\? \(/.test(thread));
ok("Composer takes allowEmpty, off by default", /allowEmpty = false,/.test(composer) && /\(allowEmpty \|\| String\(value \|\| ""\)\.trim\(\)\.length > 0\)/.test(composer));
ok("Composer takes inputDisabled, off by default, and disabled still wins", /inputDisabled = false,/.test(composer) && /disabled=\{disabled \|\| inputDisabled\}/.test(composer));
ok("Composer takes textareaStyle", /textareaStyle = undefined,/.test(composer) && /style=\{textareaStyle\}/.test(composer));
ok("the page uses the badge for the three brand marks the kit has no glyph for", /channelBadge: row\.platform \? <SocialGlyph platform=\{row\.platform\}/.test(page));
ok("the page renders notes and attachments through renderBody", /renderBody=\{\(m\) => \(\s*<MessageBody/.test(page) && /if \(item\.kind === "note"\) return <NoteBody/.test(page));

// ═══════════════════════════════════════════════════════════════════════════
section("9. Wired into check:all");
// ═══════════════════════════════════════════════════════════════════════════

const pkg = JSON.parse(read("package.json"));
ok("check:app-messages-kit exists", typeof pkg.scripts["check:app-messages-kit"] === "string");
ok("…and check:all runs it", /check:app-messages-kit/.test(pkg.scripts["check:all"] || ""));

console.log(`\n${pass} passed, ${failures.length} failed\n`);
if (failures.length) {
  for (const f of failures) console.log(`  ✗ ${f}`);
  process.exit(1);
}
