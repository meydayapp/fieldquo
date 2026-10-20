// scripts/check-copy-link.mjs
//
//   npm run check:copy-link
//
// "Copy quote link", and the rule that makes it work on a phone.
//
// ══ The bug ════════════════════════════════════════════════════════════════
//
// The owner, signed in as the owner, pressed Copy link on his own quote and
// got: "The request is not allowed by the user agent or the platform in the
// current context, possibly because the user denied permission." That is
// WebKit's NotAllowedError, and it was earned honestly: the handler fetched
// the share token first and wrote to the clipboard second —
//
//     const url = await fetchClientLink(id);        // the gesture ends here
//     await navigator.clipboard.writeText(url);     // …so this is refused
//
// Safari grants the clipboard to the gesture that asked for it and takes it
// back at the first await. Chrome does not, which is how this shipped.
//
// ══ What this executes ═════════════════════════════════════════════════════
//
// A clipboard double with WebKit's rule — the permission dies when the task
// that started it does — and both shapes run against it: the old one is
// refused, lib/quotes/clipboardCopy's is not. That is the whole claim, and
// reading the source could never settle it.
//
//   node --import ./scripts/alias-loader.mjs scripts/check-copy-link.mjs

import { readFileSync } from "node:fs";
import { balanced } from "./tenantScopeScan.mjs";
import { copyFromPromise, ClipboardRefused } from "@/lib/clipboardCopy";
import { APP_MESSAGES } from "@/app/i18n/appMessages.js";

let pass = 0;
let fail = 0;
const ok = (name, cond, got) => {
  if (cond) {
    pass++;
    console.log(`  ok   ${name}`);
  } else {
    fail++;
    console.log(`  FAIL ${name}${got !== undefined ? `  got: ${JSON.stringify(got)}` : ""}`);
  }
};
const section = (s) => console.log(`\n${s}\n`);
const read = (p) => readFileSync(p, "utf8");

function notAllowed() {
  // WebKit's own words, which is what the owner saw.
  const err = new Error(
    "The request is not allowed by the user agent or the platform in the current context, possibly because the user denied permission.",
  );
  err.name = "NotAllowedError";
  return err;
}

/**
 * A clipboard that behaves like Safari's: the user gesture is live for the
 * task that began it and gone by the next one. `calls` records what was
 * attempted, so a refusal cannot pass as a copy.
 */
function webkitClipboard() {
  const state = { gesture: true, calls: [], wrote: null };
  setTimeout(() => {
    state.gesture = false;
  }, 0);
  state.clipboard = {
    write: async (items) => {
      state.calls.push("write");
      if (!state.gesture) throw notAllowed();
      // Safari resolves the promised contents AFTER the permission is taken —
      // the point of the API. Modelled, so a blob that arrives late still lands.
      const blob = await items[0].items["text/plain"];
      state.wrote = await blob.text();
      return undefined;
    },
    writeText: async (text) => {
      state.calls.push("writeText");
      if (!state.gesture) throw notAllowed();
      state.wrote = text;
      return undefined;
    },
  };
  return state;
}

/** The share-token round trip: resolves on a later task, like a network does. */
const slowLink = (url = "https://www.fieldquo.com/q/TOKEN") =>
  new Promise((resolve) => setTimeout(() => resolve(url), 5));

function installClipboard(state) {
  globalThis.ClipboardItem = class ClipboardItem {
    constructor(items) {
      this.items = items;
    }
  };
  Object.defineProperty(globalThis, "navigator", {
    value: { clipboard: state?.clipboard },
    configurable: true,
    writable: true,
  });
}

// ───────────────────────────────────────────────────────────────────────────
section("1. The old shape is genuinely refused — the bug reproduces");

{
  const state = webkitClipboard();
  installClipboard(state);
  let refusal = null;
  try {
    // Exactly what the handler used to do.
    const url = await slowLink();
    await navigator.clipboard.writeText(url);
  } catch (err) {
    refusal = err;
  }
  ok("await the link, then copy → NotAllowedError", refusal?.name === "NotAllowedError", refusal?.message);
  ok("…and nothing reached the clipboard", state.wrote === null, state.wrote);
}

// ───────────────────────────────────────────────────────────────────────────
section("2. copyFromPromise keeps the gesture");

{
  const state = webkitClipboard();
  installClipboard(state);
  const copied = await copyFromPromise(slowLink());
  ok("the link is copied, on the same browser that just refused", state.wrote === "https://www.fieldquo.com/q/TOKEN", state.wrote);
  ok("…through write(), inside the gesture", state.calls.join(",") === "write", state.calls);
  ok("…and the text comes back to the caller", copied === "https://www.fieldquo.com/q/TOKEN", copied);
}

{
  // A browser with no ClipboardItem (older Firefox, plain http) still copies
  // through writeText when the value is already in hand.
  const state = webkitClipboard();
  installClipboard(state);
  delete globalThis.ClipboardItem;
  const copied = await copyFromPromise(Promise.resolve("https://www.fieldquo.com/q/NOW"));
  ok("no ClipboardItem → writeText, and it still copies", state.wrote === "https://www.fieldquo.com/q/NOW" && state.calls.join(",") === "writeText", state.calls);
  ok("…returns the text too", copied === "https://www.fieldquo.com/q/NOW");
}

// ───────────────────────────────────────────────────────────────────────────
section("3. A refusal still hands over the link");

{
  const state = webkitClipboard();
  state.gesture = false; // an embedded browser that refuses outright
  installClipboard(state);
  let err = null;
  try {
    await copyFromPromise(slowLink("https://www.fieldquo.com/q/BLOCKED"));
  } catch (e) {
    err = e;
  }
  ok("refused → ClipboardRefused", err instanceof ClipboardRefused && err.code === "clipboard_refused", err?.code);
  ok("…carrying the link, so the page can show it", err?.text === "https://www.fieldquo.com/q/BLOCKED", err?.text);
}

{
  // No clipboard API at all — plain http, which is where navigator.clipboard
  // is simply undefined.
  installClipboard({ clipboard: undefined });
  let err = null;
  try {
    await copyFromPromise(Promise.resolve("https://www.fieldquo.com/q/HTTP"));
  } catch (e) {
    err = e;
  }
  ok("no clipboard API → still ClipboardRefused with the link", err instanceof ClipboardRefused && err.text === "https://www.fieldquo.com/q/HTTP", err?.text);
}

{
  // The FETCH failing is a different thing: there is no link to show by hand,
  // so the caller's own error must come through untouched.
  const state = webkitClipboard();
  installClipboard(state);
  let err = null;
  try {
    await copyFromPromise(Promise.reject(new Error("Couldn't get the client link.")));
  } catch (e) {
    err = e;
  }
  ok("the share route failing is NOT a clipboard refusal", !(err instanceof ClipboardRefused), err?.message);
  ok("…and its message survives for the red banner", err?.message === "Couldn't get the client link.", err?.message);
}

// ───────────────────────────────────────────────────────────────────────────
section("4. Both buttons go through it, and the link is never lost");

{
  const page = read("app/app/quotes/[id]/page.js");
  const builder = read("app/components/quotes/builder/DocumentBuilder.js");

  // Scoped to the COPY handler's own body. The file-wide version of this
  // assertion failed on `handlePreview`, which awaits the same link and is
  // right to: it opens a window, and a window needs no gesture kept alive.
  const bodyAt = (src, marker) => {
    const i = src.indexOf(marker);
    if (i === -1) return "";
    const brace = src.indexOf("{", i);
    // balanced() returns the TEXT of the run, not its end index.
    return brace === -1 ? "" : balanced(src, brace);
  };

  for (const [name, src, marker, call] of [
    ["the quote page", page, "async function handleCopyLink()", "copyFromPromise(clientLink())"],
    ["the builder's Send… menu", builder, 'menuAction("link"', "copyFromPromise(fetchClientLink(quoteId))"],
  ]) {
    const body = bodyAt(src, marker);
    ok(`${name}: the copy handler was found`, body.length > 0);
    ok(`${name} copies through the helper`, body.includes(call), call);
    ok(`${name} does not await the link first`, !/await (fetchClientLink|clientLink)\(/.test(body), body.slice(0, 200));
    ok(`${name} shows the link when the browser refuses`, /ClipboardRefused/.test(body) && /linkCopyBlocked/.test(body));
  }

  ok("the quote page puts it in a field to select", /data-link-fallback/.test(page) && /readOnly/.test(page));
  ok("…selected on arrival, not left to a hand-drag", /el\?\.select\(\)/.test(page));
  ok("wired into check:all", /npm run check:copy-link/.test(JSON.parse(read("package.json")).scripts["check:all"]));
}

// ───────────────────────────────────────────────────────────────────────────
section("5. The sentence exists in every app language");

{
  const missing = Object.keys(APP_MESSAGES).filter((l) => !APP_MESSAGES[l]["app.sendMenu.linkCopyBlocked"]);
  ok(`app.sendMenu.linkCopyBlocked in all ${Object.keys(APP_MESSAGES).length} languages`, missing.length === 0, missing);
  const en = APP_MESSAGES.en["app.sendMenu.linkCopyBlocked"];
  ok("…and it says what to do, not just that it failed", /select|copy/i.test(en), en);
}

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
