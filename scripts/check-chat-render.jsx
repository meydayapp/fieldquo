// scripts/check-chat-render.jsx
//
//   npm run check:chat-render
//
// The chat kit's Thread, RENDERED, with the rows the company and staff chats
// actually hand it — the half scripts/check-chat-kit.mjs cannot do, because
// that one reads the components as text.
//
// Why a render and not a read: from 2026-09-19 to 2026-10-03 every message
// that @mentioned the reader drew as "[object Object]". The chats passed a
// <span> as `body` for the amber tint; the kit's displayBody String()s the
// body. Each file read correctly on its own — the bug was only in the two
// together, and only rendering the two together shows it. The repo's own
// screenshot (docs/screens/app-guide/en/13-chat.png) carried the bug for two
// weeks.
//
// Bundled with esbuild like check-currency-render.jsx: Thread is JSX behind
// the @/ alias, which bare Node resolves neither of.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import Thread from "../app/components/chat/Thread.js";
import { LanguageProvider } from "../app/providers/LanguageProvider.js";
import { layoutThread } from "../lib/chat/threadLayout.js";

let pass = 0;
const failures = [];
function ok(name, condition, detail = "") {
  if (condition) {
    pass += 1;
    console.log(`  ok   ${name}`);
  } else {
    failures.push(name);
    console.log(`  FAIL ${name}${detail !== "" ? ` — ${JSON.stringify(detail).slice(0, 400)}` : ""}`);
  }
}
function section(title) {
  console.log(`\n── ${title}`);
}

const NOW = Date.UTC(2026, 9, 3, 14, 0, 0);
const at = (minutesAgo) => new Date(NOW - minutesAgo * 60000).toISOString();

/** The item shape CompanyChat.js and StaffChat.js build, field for field. */
function item(id, body, { mentionsMe = false, mine = false, minutesAgo = 5, who = "Ana Côté" } = {}) {
  return { id, direction: mine ? "out" : "in", mine, body, mentionsMe, at: at(minutesAgo), kind: "message", who, meta: null };
}

function render(items) {
  const rows = layoutThread(items, { lastReadAt: null, timeZone: "UTC" });
  return renderToStaticMarkup(
    <LanguageProvider initialLanguage="en">
      <Thread rows={rows} them="#general" initialsFor={(m) => (m.who || "?").slice(0, 2)} ariaLabel="#general" />
    </LanguageProvider>,
  );
}

/** The inner HTML of the first element carrying `attr`, or "". */
function elementWith(html, attr) {
  const start = html.indexOf(attr);
  if (start < 0) return "";
  const open = html.lastIndexOf("<", start);
  const tag = /^<(\w+)/.exec(html.slice(open))[1];
  const close = html.indexOf(`</${tag}>`, start);
  return html.slice(html.indexOf(">", start) + 1, close);
}

// ═══════════════════════════════════════════════════════════════════════════
section("1. A message that names the reader draws its words, tinted");
// ═══════════════════════════════════════════════════════════════════════════
{
  const html = render([
    item("a", "@Daniel can you grab the primer?", { mentionsMe: true, minutesAgo: 9 }),
    item("b", "Plain message, nobody named", { minutesAgo: 6 }),
    item("c", "Thanks @Daniel and @Ana — see you at 8", { mentionsMe: true, minutesAgo: 3, who: "Luc" }),
  ]);
  ok("no row draws [object Object]", !html.includes("[object Object]"), html.match(/.{60}\[object Object\].{20}/)?.[0]);
  ok("the mention's words are on the page", html.includes("@Daniel can you grab the primer?"));
  ok("…and so are the second mention's", html.includes("Thanks @Daniel and @Ana — see you at 8"));
  const tinted = [...html.matchAll(/data-mentions-me="true"/g)].length;
  ok("both mentioning rows are tinted, and only those", tinted === 2, tinted);
  ok("the tint is the amber wash", /data-mentions-me="true"[^>]*bg-amber-100/.test(html));
  ok("the tinted element holds the words, not a nested node", elementWith(html, 'data-mentions-me="true"') === "@Daniel can you grab the primer?", elementWith(html, 'data-mentions-me="true"'));
  ok("the plain message is drawn and not tinted", html.includes("Plain message, nobody named") && !/data-mentions-me="true"[^>]*>Plain message/.test(html));
}

// ═══════════════════════════════════════════════════════════════════════════
section("2. Plain messages are unchanged");
// ═══════════════════════════════════════════════════════════════════════════
{
  const html = render([item("p", "Running ten minutes late", { mine: true, who: "You" })]);
  ok("a plain row draws its words", html.includes("Running ten minutes late"));
  ok("…with no tint attribute at all", !html.includes("data-mentions-me"));
  ok("…and no [object Object]", !html.includes("[object Object]"));
}

// ═══════════════════════════════════════════════════════════════════════════
section("3. HTML in a body is text, never markup");
// ═══════════════════════════════════════════════════════════════════════════
{
  const html = render([item("h", '<img src=x onerror="alert(1)"><b>bold</b>', { mentionsMe: true })]);
  ok("no <img> element is produced", !/<img/i.test(html));
  ok("…the angle brackets are escaped", html.includes("&lt;img src=x onerror=&quot;alert(1)&quot;&gt;&lt;b&gt;bold&lt;/b&gt;"));
}

// ═══════════════════════════════════════════════════════════════════════════
section("4. The two chats hand the kit text, and the flag");
// ═══════════════════════════════════════════════════════════════════════════
{
  // The render above proves the kit draws a string body and a flag. This
  // proves the screens SEND that shape — a node handed back in as `body` is
  // the exact regression, and it is invisible to every other check.
  const decomment = (src) => src.replace(/\/\*[\s\S]*?\*\//g, " ").replace(/(^|[^:])\/\/[^\n]*/g, "$1 ");
  for (const file of ["app/components/company/CompanyChat.js", "app/components/staff/StaffChat.js"]) {
    const src = decomment(readFileSync(join(process.cwd(), file), "utf8"));
    const block = src.slice(src.indexOf("const rows = useMemo"), src.indexOf("layoutThread(items"));
    ok(`${file}: the rows block is found`, block.length > 50, block.length);
    ok(`${file}: body is the message's text`, /\bbody: m\.body,/.test(block), block.match(/body:[^\n]*/)?.[0]);
    ok(`${file}: no JSX rides in the item`, !/</.test(block));
    ok(`${file}: the mention rides as the flag`, /mentionsMe: Boolean\(m\.mentionsMe\)/.test(block));
  }
}

console.log(`\n${failures.length ? "FAILED" : "PASSED"} — ${pass} assertions, ${failures.length} failures`);
if (failures.length) {
  for (const f of failures) console.log(`  · ${f}`);
  process.exit(1);
}
