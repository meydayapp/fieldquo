// scripts/check-chat-kit.mjs
//
//   npm run check:chat-kit
//
// The shared chat kit (app/components/chat + lib/chat), executed rather than
// eyeballed.
//
// ══ Why the arithmetic is run and the components are read ═════════════════
//
// Where the day dividers land, where the unread line sits, which rows are
// sequential, how `!chk` ranks the catalogue — all of it is pure and all of
// it is the kind of thing that is wrong by one in a way no screenshot with
// four messages shows. So the functions are driven here with fixtures built
// on a fixed clock, and the assertions say what a rep would see.
//
// The components are React and are not mounted here; they are READ, with
// comments stripped, for the promises a screen depends on: every string goes
// through t(), every key exists in all nine languages, and nothing sends
// from an effect. scripts/check-sales-messages.mjs makes the same "no send
// outside a press" promise for the screen; this makes it for the kit the
// screen is built from.
//
// Judged by exit code. Do not read a run by grepping for FAIL.
import { readFileSync, readdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import {
  layoutThread,
  firstUnreadId,
  unreadCount,
  dayLabelKind,
  filterCanned,
  cannedScore,
  bangTokenAt,
  replaceBangToken,
  ROW_DAY,
  ROW_UNREAD,
  ROW_MESSAGE,
} from "@/lib/chat/threadLayout";
import { APP_MESSAGES } from "@/app/i18n/appMessages";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const read = (p) => readFileSync(join(ROOT, p), "utf8");
const decomment = (src) => src.replace(/\/\*[\s\S]*?\*\//g, " ").replace(/(^|[^:])\/\/[^\n]*/g, "$1 ");

let pass = 0;
const failures = [];
function ok(name, condition, detail = "") {
  if (condition) {
    pass += 1;
    console.log(`  ok   ${name}`);
  } else {
    failures.push(name);
    console.log(`  FAIL ${name}${detail !== "" ? ` — ${JSON.stringify(detail)}` : ""}`);
  }
}
function section(title) {
  console.log(`\n── ${title}`);
}

// A fixed clock: Friday 11 September 2026, 14:00 UTC. Every fixture is built
// relative to it, and the layout is asked to draw days in UTC so the answer
// does not depend on the machine running the check.
const NOW = new Date("2026-09-11T14:00:00Z");
const UTC = { timeZone: "UTC" };
const at = (minutesAgo) => new Date(NOW.getTime() - minutesAgo * 60 * 1000);
const msg = (id, direction, minutesAgo, extra = {}) => ({
  id,
  direction,
  body: `${id} says`,
  at: at(minutesAgo),
  ...extra,
});

// ═══════════════════════════════════════════════════════════════════════════
section("1. Day dividers land where the day turns");
// ═══════════════════════════════════════════════════════════════════════════
{
  // Three days: the day before yesterday (one message), yesterday (two),
  // today (three). Dividers: exactly three, one above the first row of each.
  const items = [
    msg("a", "in", 2 * 24 * 60 + 60),
    msg("b", "out", 24 * 60 + 30),
    msg("c", "in", 24 * 60 + 20),
    msg("d", "in", 30),
    msg("e", "in", 28),
    msg("f", "out", 5),
  ];
  const rows = layoutThread(items, { ...UTC, lastReadAt: NOW });
  const days = rows.filter((r) => r.kind === ROW_DAY);
  ok("three days → three dividers", days.length === 3, days.map((d) => d.dayKey));
  ok("…in date order", days.map((d) => d.dayKey).join() === "2026-09-09,2026-09-10,2026-09-11");
  ok("the very first row is a divider", rows[0].kind === ROW_DAY);
  const shape = rows.map((r) => (r.kind === ROW_MESSAGE ? r.item.id : r.kind)).join(",");
  ok("each divider sits directly above its day's first message", shape === "day,a,day,b,c,day,d,e,f", shape);

  const labels = days.map((d) => dayLabelKind(d.dayKey, { now: NOW, timeZone: "UTC" }).kind);
  ok('labels decide "date", "yesterday", "today"', labels.join() === "date,yesterday,today", labels);
  const dated = dayLabelKind("2026-09-09", { now: NOW, timeZone: "UTC" });
  ok("…and a plain date carries a Date to format", dated.date instanceof Date && dated.sameYear === true);
  ok("…while last year's is marked so the year is printed", dayLabelKind("2025-09-09", { now: NOW, timeZone: "UTC" }).sameYear === false);
  ok("rubbish is a date with nothing to format, not a crash", dayLabelKind("banana", { now: NOW }).date === null);
}

// ═══════════════════════════════════════════════════════════════════════════
section("2. Sequential grouping: same author within the window");
// ═══════════════════════════════════════════════════════════════════════════
{
  const items = [
    msg("a", "in", 10),
    msg("b", "in", 9), // 60s later, same side → sequential
    msg("c", "out", 8), // other side → new group
    msg("d", "out", 2), // 6 min later, same side → new group (window is 5 min)
    msg("e", "out", 1.5), // 30s later → sequential
  ];
  const rows = layoutThread(items, { ...UTC, lastReadAt: NOW });
  const seq = rows.filter((r) => r.kind === ROW_MESSAGE).map((r) => `${r.item.id}:${r.sequential ? "s" : "h"}`);
  ok("a h, b s, c h, d h, e s", seq.join() === "a:h,b:s,c:h,d:h,e:s", seq);
  const heads = rows.filter((r) => r.kind === ROW_MESSAGE).map((r) => r.showSender);
  ok("the avatar and name are shown exactly on the heads", heads.join() === "true,false,true,true,false", heads);
  const times = rows.filter((r) => r.kind === ROW_MESSAGE).map((r) => r.showTime);
  ok("…and so is the time (the hover time on grouped rows is the renderer's)", times.join() === heads.join());
}

// ═══════════════════════════════════════════════════════════════════════════
section("3. System rows never group and never carry a header");
// ═══════════════════════════════════════════════════════════════════════════
{
  const items = [
    msg("a", "in", 10),
    { id: "s1", kind: "system", direction: "in", body: "They replied STOP", at: at(9.5) },
    msg("b", "in", 9),
  ];
  const rows = layoutThread(items, { ...UTC, lastReadAt: NOW });
  const list = rows.filter((r) => r.kind === ROW_MESSAGE);
  ok("the system row is flagged", list[1].system === true && list[1].item.id === "s1");
  ok("…draws no sender and no time header", list[1].showSender === false && list[1].showTime === false);
  ok("…is never marked unread", list[1].unread === false);
  ok("the message after it starts a new group even though it is the same side 30s later", list[2].sequential === false);
  ok("the message before it ends its group", list[0].groupEnd === true);
  ok("…and no second day divider is invented under the system row", rows.filter((r) => r.kind === ROW_DAY).length === 1,
    rows.map((r) => r.kind));

  // The same trap with a draft in the middle of a day.
  const withDraft = [
    msg("a", "in", 10),
    { id: "dr", kind: "draft", direction: "out", body: "draft", at: at(9) },
    msg("b", "out", 8),
  ];
  ok("a draft mid-day does not split the day either",
    layoutThread(withDraft, { ...UTC, lastReadAt: NOW }).filter((r) => r.kind === ROW_DAY).length === 1);
}

// ═══════════════════════════════════════════════════════════════════════════
section("4. The unread divider");
// ═══════════════════════════════════════════════════════════════════════════
{
  const items = [msg("a", "in", 60), msg("b", "out", 50), msg("c", "in", 40), msg("d", "in", 39), msg("e", "out", 5)];

  // Never read: the line goes above their FIRST message.
  {
    const rows = layoutThread(items, { ...UTC, lastReadAt: null });
    const i = rows.findIndex((r) => r.kind === ROW_UNREAD);
    ok("never read → exactly one unread divider", rows.filter((r) => r.kind === ROW_UNREAD).length === 1);
    ok("…above their first message", rows[i + 1]?.item?.id === "a", rows[i + 1]?.item?.id);
    ok("…after the day divider that shares the row", rows[i - 1]?.kind === ROW_DAY);
    ok("firstUnreadId agrees", firstUnreadId(items, { lastReadAt: null }) === "a");
    ok("unreadCount counts theirs only: a, c, d", unreadCount(items, { lastReadAt: null }) === 3);
  }
  // Read at 45 minutes ago: a is read, c and d are not; the line goes above c.
  {
    const rows = layoutThread(items, { ...UTC, lastReadAt: at(45) });
    const i = rows.findIndex((r) => r.kind === ROW_UNREAD);
    ok("read mid-thread → the line sits above the first message after the read", rows[i + 1]?.item?.id === "c");
    ok("…and only c and d are marked unread", rows.filter((r) => r.unread).map((r) => r.item.id).join() === "c,d");
    ok("unreadCount is 2", unreadCount(items, { lastReadAt: at(45) }) === 2);
  }
  // Read after everything: no line at all. Our own message after the read
  // does not count — the reader wrote it.
  {
    const rows = layoutThread(items, { ...UTC, lastReadAt: at(20) });
    ok("read after their last message → no unread divider", !rows.some((r) => r.kind === ROW_UNREAD));
    ok("…our own later message is not unread", unreadCount(items, { lastReadAt: at(20) }) === 0);
  }
  // Read exactly at the message's instant: not unread. `>` not `>=`.
  ok("a message AT the read instant is read", unreadCount([msg("x", "in", 40)], { lastReadAt: at(40) }) === 0);
  // Drafts and system rows are not "unread" whatever their time.
  {
    const withNoise = [
      ...items,
      { id: "dr", kind: "draft", direction: "out", body: "draft", at: at(1) },
      { id: "sy", kind: "system", direction: "in", body: "called", at: at(1) },
    ];
    ok("a draft and a system row do not count", unreadCount(withNoise, { lastReadAt: at(20) }) === 0);
    ok("…and cannot be where the line goes", firstUnreadId(withNoise, { lastReadAt: at(20) }) === null);
  }
  // A room with named authors uses `mine`, not direction.
  {
    const room = [
      { id: "r1", direction: "in", who: "Ana", mine: false, body: "hi", at: at(10) },
      { id: "r2", direction: "in", who: "Me", mine: true, body: "hi", at: at(9) },
    ];
    ok("a row marked mine is never unread even when its direction says in", unreadCount(room, { lastReadAt: null }) === 1);
  }
  ok("an empty thread lays out to nothing", layoutThread([], UTC).length === 0 && layoutThread(null, UTC).length === 0);
}

// ═══════════════════════════════════════════════════════════════════════════
section("5. The canned-response filter");
// ═══════════════════════════════════════════════════════════════════════════
{
  const catalogue = [
    { id: "c1", title: "Check-in after first week", text: "Hi, it is Sam from FieldQuo. How is it going so far?" },
    { id: "c2", title: "Signup link", text: "Here is your link to get started." },
    { id: "c3", title: "Chunky desk", text: "A desk that is chunky." },
    { id: "c4", title: "Call back tomorrow", text: "Can I ring you tomorrow morning?" },
  ];
  ok("an empty query returns everything, in order", filterCanned(catalogue, "").map((e) => e.id).join() === "c1,c2,c3,c4");
  ok("a substring of the title wins", filterCanned(catalogue, "check")[0].id === "c1");
  ok('"chk" finds check-in by subsequence', filterCanned(catalogue, "chk").some((e) => e.id === "c1"));
  ok("…ranked above the desk", filterCanned(catalogue, "chk")[0].id === "c1", filterCanned(catalogue, "chk").map((e) => e.id));
  ok("a word in the text matches when the title does not", filterCanned(catalogue, "ring").map((e) => e.id).join() === "c4");
  // The group is searchable: the check-in wordings are titled by REASON.
  const grouped = [
    { id: "g1", title: "Nothing looks wrong", group: "Check-in", text: "How is it going so far?" },
    { id: "g2", title: "Signup link", group: "Sales", text: "Here is the link." },
  ];
  ok('"chk" finds the check-in group', filterCanned(grouped, "chk").map((e) => e.id).join() === "g1");
  ok("…and a title match still outranks a group match",
    filterCanned([{ id: "t", title: "Check the roof", group: "Sales", text: "x" }, ...grouped], "check")[0].id === "t");
  ok("case does not matter", filterCanned(catalogue, "SIGNUP")[0].id === "c2");
  ok("no match → empty, not everything", filterCanned(catalogue, "zzzz").length === 0);
  ok("rubbish catalogue → empty", filterCanned(null, "x").length === 0 && filterCanned([null, undefined], "x").length === 0);
  ok("cannedScore is null for no match and a number otherwise", cannedScore(catalogue[0], "qqq") === null && typeof cannedScore(catalogue[0], "check") === "number");

  // The `!` token: start of text or after whitespace only.
  ok("! at the start opens", bangTokenAt("!ch", 3)?.query === "ch");
  ok("! after a space opens", bangTokenAt("hello !si", 9)?.query === "si");
  ok("! mid-word does not", bangTokenAt("wow!", 4) === null && bangTokenAt("call me at 5!", 13) === null);
  ok("a bare ! opens with an empty query", bangTokenAt("!", 1)?.query === "");
  ok("the caret decides: text after the caret is ignored", bangTokenAt("!ch and more", 3)?.query === "ch");
  ok("no ! → null", bangTokenAt("plain words", 11) === null);
  const tok = bangTokenAt("hi !si there", 6);
  ok("replacing the token keeps what is around it", replaceBangToken("hi !si there", tok, "LINK") === "hi LINK there");
  const tail = bangTokenAt("!si", 3);
  ok("…and adds nothing after the text at the end", replaceBangToken("!si", tail, "LINK") === "LINK");
  const glued = bangTokenAt("!si-x", 3);
  ok("…and a space before glued text", replaceBangToken("!si-x", glued, "LINK") === "LINK -x");
}

// ═══════════════════════════════════════════════════════════════════════════
section("6. The components: every string is translated, nothing sends itself");
// ═══════════════════════════════════════════════════════════════════════════
{
  const dir = "app/components/chat";
  const files = readdirSync(join(ROOT, dir)).filter((f) => f.endsWith(".js")).map((f) => `${dir}/${f}`);
  ok("the kit has its five components and an index", files.length >= 6, files);
  for (const need of ["ChatLayout", "RoomList", "Thread", "Composer", "ContextBar", "index"]) {
    ok(`${need}.js exists`, files.includes(`${dir}/${need}.js`));
  }

  const TEXT_NODE = />\s*([A-Za-z][A-Za-z0-9 ,.'’!?;:—–…-]{2,})\s*</g;
  const ATTR = /\b(aria-label|title|placeholder|alt)=("([^"]*)")/g;
  const NEUTRAL = new Set(["SMS", "Tab", "Esc", "Enter"]);
  const LANGS = Object.keys(APP_MESSAGES);
  ok("nine languages in the catalogue", LANGS.length === 9, LANGS);
  const missing = [];
  for (const file of files) {
    const code = decomment(read(file));
    const literals = [];
    for (const m of code.matchAll(TEXT_NODE)) {
      const v = m[1].trim();
      if (!v.split(/\s+/).every((w) => NEUTRAL.has(w))) literals.push(v);
    }
    for (const m of code.matchAll(ATTR)) {
      if (m[3] && /\p{L}{2}/u.test(m[3])) literals.push(`${m[1]}="${m[3]}"`);
    }
    ok(`${file} renders nothing in hardcoded English`, literals.length === 0, literals.slice(0, 6));
    for (const m of code.matchAll(/\bt\(\s*"(app\.[A-Za-z0-9.]+)"/g)) {
      for (const lang of LANGS) {
        if (APP_MESSAGES[lang]?.[m[1]] === undefined) missing.push(`${m[1]} (${lang})`);
      }
    }
  }
  ok("every key the kit asks for exists in all nine languages", missing.length === 0, [...new Set(missing)].slice(0, 12));

  const composer = decomment(read(`${dir}/Composer.js`));
  const effects = [...composer.matchAll(/useEffect\s*\(\s*(?:\(\)\s*=>\s*)?\{[\s\S]*?\}\s*,\s*\[[^\]]*\]\s*\)/g)].map((m) => m[0]);
  ok("the composer has effects to scan", effects.length >= 2, effects.length);
  ok("no effect in the composer calls onSend", effects.every((e) => !/onSend/.test(e)));
  ok("onSend is reached from the Send button", /onClick=\{onSend\}/.test(composer));
  ok("…and from Enter without Shift", /e\.key === "Enter" && !e\.shiftKey/.test(composer) && /if \(canSend\) onSend\(\);/.test(composer));
  ok("Shift+Enter is left to the textarea (a newline)", !/shiftKey[^\n]*onSend/.test(composer));
  ok("inserting a canned response never sends", !/insert\([\s\S]{0,400}onSend\(\)/.test(composer.slice(composer.indexOf("const insert"))));
  ok("the popup opens on the ! token only", /bangTokenAt\(value, caret\)/.test(composer));

  const thread = decomment(read(`${dir}/Thread.js`));
  ok("the thread draws the unread divider from the layout's row kind", /row\.kind === ROW_UNREAD/.test(thread));
  ok("…in red", /data-unread-divider[\s\S]{0,400}bg-red-500/.test(thread));
  ok("…draws system rows in italics", /data-system-row[\s\S]{0,300}italic/.test(thread));
  ok("…shows the time in the gutter on hover for grouped rows", /group-hover:inline[^"]*text-\[10px\]|text-\[10px\][^"]*group-hover:inline/.test(thread) || /hidden group-hover:inline/.test(thread));
  ok("…has the new-messages pill", /data-new-messages-pill/.test(thread) && /app\.chat\.newMessages/.test(thread));
  ok("…and a sticky day bubble", /stickyDay/.test(thread) && /DayBubble/.test(thread));
  ok("every spinner honours prefers-reduced-motion", [...thread.matchAll(/animate-spin[^"']*/g), ...[...composer.matchAll(/animate-spin[^"']*/g)]].every((m) => m[0].includes("motion-reduce:animate-none")));

  const layout = decomment(read(`${dir}/ChatLayout.js`));
  ok("the list is 280 wide from md, the context bar 340 from lg", /md:w-\[280px\]/.test(layout) && /lg:flex w-\[340px\]/.test(layout));
  ok("below md exactly one pane shows", /pane === PANE_LIST \? "flex" : "hidden"/.test(layout) && /pane === PANE_THREAD \? "flex" : "hidden"/.test(layout));
  ok("…and the context bar is a sheet there", /context-sheet/.test(layout) && /lg:hidden/.test(layout));

  const list = decomment(read(`${dir}/RoomList.js`));
  ok("the list moves with the arrow keys", /ArrowDown/.test(list) && /ArrowUp/.test(list) && /Home/.test(list));
  ok("…and opens on Enter", /e\.key === "Enter"/.test(list));
  ok("a selected room gets the left accent bar", /selected \?[\s\S]{0,200}left-0 w-1[^"]*bg-primary/.test(list));
  ok("an unread room is bold", /unread \? "font-semibold/.test(list));
  ok("the group header sums unread", /reduce\(\(n, r\) => n \+ \(Number\(r\.unread\) \|\| 0\), 0\)/.test(list));

  const index = read(`${dir}/index.js`);
  for (const name of ["ChatLayout", "RoomList", "RoomListGroup", "RoomListItem", "Thread", "Composer", "ContextBar", "Avatar"]) {
    ok(`index exports ${name}`, new RegExp(`\\b${name}\\b`).test(index));
  }
}

console.log(`\n${failures.length ? "FAILED" : "PASSED"} — ${pass} assertions, ${failures.length} failures`);
if (failures.length) {
  for (const f of failures) console.log(`  · ${f}`);
  process.exit(1);
}
