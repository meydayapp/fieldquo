// scripts/check-embed-snippet.mjs
//
// lib/embed/snippet.js builds a string that is pasted into a website FieldQuo
// cannot see, and then never looked at again. Nothing downstream of it — no
// build step, no lint, no page — will ever tell us it stopped working.
//
// So this file does two things a static read cannot:
//
//   1. Feeds the builder the input that breaks strings: a missing origin, a
//      title carrying a quotation mark, a slug with a slash in it, a widget
//      name borrowed from Object.prototype.
//
//   2. EXECUTES the <script> half against a fake DOM. The listener is the part
//      that makes an embed usable, and it is the part nobody can test by
//      looking at it. The case that matters most is two embeds on one page —
//      a contractor pasting reviews next to a quote form, which is exactly
//      what putting the snippet on Settings → Reviews makes ordinary.
//
//   node --import ./scripts/alias-loader.mjs scripts/check-embed-snippet.mjs
import { embedSnippet, EMBED_HEIGHTS, EMBED_WIDGETS } from "@/lib/embed/snippet";

let bad = 0;
const ok = (label, cond, extra = "") => {
  console.log(`${cond ? "  ok  " : "  FAIL"} ${label}${extra ? `  ${extra}` : ""}`);
  if (!cond) bad++;
};

const ORIGIN = "https://app.fieldquo.com";

console.log("\nembedSnippet — refuses to build half a snippet\n");

ok("no args", embedSnippet() === "");
ok("empty object", embedSnippet({}) === "");
ok("no origin (pre-mount)", embedSnippet({ slug: "acme", widget: "reviews" }) === "");
ok("no slug", embedSnippet({ origin: ORIGIN, widget: "reviews" }) === "");
ok("unknown widget", embedSnippet({ origin: ORIGIN, slug: "acme", widget: "pricing" }) === "");
// Object.hasOwn rather than `in`/truthiness: "constructor" and "toString" are
// on every object, and a lookup that accepted them would emit an iframe whose
// height is a function.
ok(
  "widget from Object.prototype",
  ["constructor", "toString", "__proto__", "hasOwnProperty"].every(
    (w) => embedSnippet({ origin: ORIGIN, slug: "acme", widget: w }) === "",
  ),
);
ok(
  "origin carrying a quote is refused, not escaped",
  embedSnippet({ origin: 'https://x"onload="alert(1)', slug: "a", widget: "book" }) === "",
);

console.log("\nembedSnippet — the string itself\n");

for (const widget of EMBED_WIDGETS) {
  const s = embedSnippet({ origin: ORIGIN, slug: "acme-painting", widget, title: "T" });
  ok(
    `${widget}: id, src and height`,
    s.includes(`id="fieldquo-${widget}"`) &&
      s.includes(`src="${ORIGIN}/embed/acme-painting/${widget}"`) &&
      s.includes(`height="${EMBED_HEIGHTS[widget]}"`),
  );
  ok(`${widget}: never starts at zero height`, EMBED_HEIGHTS[widget] > 0);
  ok(
    `${widget}: both message checks present`,
    s.includes(`if (e.origin !== "${ORIGIN}") return;`) &&
      s.includes("f.contentWindow === e.source"),
  );
}

// The French title for the reviews frame is "Avis de clients"; nothing in the
// six languages carries a quotation mark today, and this is what makes it safe
// for one to.
const quoted = embedSnippet({
  origin: ORIGIN,
  slug: "acme",
  widget: "reviews",
  title: 'Say "hi" <b>& goodbye</b>',
});
ok(
  "title escaped for an HTML attribute",
  quoted.includes('title="Say &quot;hi&quot; &lt;b&gt;&amp; goodbye&lt;/b&gt;"'),
);
ok(
  "attribute cannot be broken out of",
  quoted.split("></iframe>")[0].split('title="')[1].indexOf('"') ===
    quoted.split("></iframe>")[0].split('title="')[1].length - 1,
);
ok("missing title is empty, not undefined", embedSnippet({ origin: ORIGIN, slug: "a", widget: "book" }).includes('title=""'));

ok(
  "slug is URL-encoded",
  embedSnippet({ origin: ORIGIN, slug: "a/b?c", widget: "book" }).includes(
    `src="${ORIGIN}/embed/a%2Fb%3Fc/book"`,
  ),
);
ok(
  "an ordinary slug is untouched by encoding",
  embedSnippet({ origin: ORIGIN, slug: "acme-painting-2", widget: "book" }).includes(
    "/embed/acme-painting-2/book",
  ),
);

console.log("\nThe listener, executed against a fake DOM\n");

/** Everything between <script> and </script>, which is what a browser runs. */
const scriptBody = (snippet) => snippet.split("<script>")[1].split("</script>")[0];

/**
 * A page with the given snippets pasted into it. Each iframe gets a distinct
 * object standing in for its contentWindow — identity is the whole point of
 * the e.source check, and identity is all the real thing offers cross-origin.
 */
function pageWith(snippets) {
  const frames = new Map();
  for (const s of snippets) {
    const id = s.split('id="')[1].split('"')[0];
    const height = s.split('height="')[1].split('"')[0];
    frames.set(id, { id, style: { height: `${height}px` }, contentWindow: { id } });
  }
  const listeners = [];
  const win = { addEventListener: (type, fn) => type === "message" && listeners.push(fn) };
  const doc = { getElementById: (id) => frames.get(id) || null };
  for (const s of snippets) new Function("window", "document", scriptBody(s))(win, doc);
  return {
    frames,
    post: (event) => listeners.forEach((fn) => fn(event)),
    heightOf: (id) => frames.get(id).style.height,
    // The posting frame's contentWindow — the SAME object the listener will
    // compare against, because identity is the whole mechanism. A real browser
    // hands back one stable Window proxy per frame; a harness that minted a
    // fresh object per call would fail every check for the wrong reason.
    sourceOf: (id) => frames.get(id).contentWindow,
  };
}

// A frame on the host page that is not one of ours.
const STRANGER = { id: "someone-else" };

const reviews = embedSnippet({ origin: ORIGIN, slug: "acme", widget: "reviews", title: "R" });
const quote = embedSnippet({ origin: ORIGIN, slug: "acme", widget: "quote", title: "Q" });

let page = pageWith([reviews]);
ok("starts at the height baked into the snippet", page.heightOf("fieldquo-reviews") === "220px");

page.post({
  origin: ORIGIN,
  source: page.sourceOf("fieldquo-reviews"),
  data: { type: "fieldquo:embed-height", height: 812 },
});
ok("resizes on its own frame's message", page.heightOf("fieldquo-reviews") === "812px");

// The empty case: the reviews embed renders nothing and measures zero, and the
// frame must actually collapse. A falsy-height bug here leaves a 220px blank
// rectangle on a customer's homepage — put there by us, on a page nobody at
// FieldQuo can see.
page.post({
  origin: ORIGIN,
  source: page.sourceOf("fieldquo-reviews"),
  data: { type: "fieldquo:embed-height", height: 0 },
});
ok("a zero height collapses the box", page.heightOf("fieldquo-reviews") === "0px");

page = pageWith([reviews]);
for (const [label, event] of [
  ["a different origin", { origin: "https://evil.example", source: page.sourceOf("fieldquo-reviews"), data: { type: "fieldquo:embed-height", height: 9 } }],
  ["no data", { origin: ORIGIN, source: page.sourceOf("fieldquo-reviews"), data: null }],
  ["another message type", { origin: ORIGIN, source: page.sourceOf("fieldquo-reviews"), data: { type: "something:else", height: 9 } }],
  ["a frame that isn't ours", { origin: ORIGIN, source: STRANGER, data: { type: "fieldquo:embed-height", height: 9 } }],
]) {
  page.post(event);
  ok(`ignored: ${label}`, page.heightOf("fieldquo-reviews") === "220px");
}

// The reason the source check exists. Both snippets on one page, both
// listening on the same window, and the height message is broadcast to all of
// them — so without it the quote form adopts the reviews strip's height.
page = pageWith([reviews, quote]);
page.post({
  origin: ORIGIN,
  source: page.sourceOf("fieldquo-reviews"),
  data: { type: "fieldquo:embed-height", height: 240 },
});
ok("two embeds: the addressed one resized", page.heightOf("fieldquo-reviews") === "240px");
ok("two embeds: the other one untouched", page.heightOf("fieldquo-quote") === "640px");

page.post({
  origin: ORIGIN,
  source: page.sourceOf("fieldquo-quote"),
  data: { type: "fieldquo:embed-height", height: 1100 },
});
ok("two embeds: and the same in reverse", page.heightOf("fieldquo-quote") === "1100px");
ok("two embeds: reviews stayed put", page.heightOf("fieldquo-reviews") === "240px");

console.log(bad === 0 ? "\nAll good.\n" : `\n${bad} FAILURES\n`);
process.exit(bad === 0 ? 0 : 1);
