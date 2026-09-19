// scripts/check-canvas-email.mjs
//
// The two modes of an email template — Blocks and Canvas — and the compiler
// that turns a canvas into email HTML.
//
//   npm run check:canvas-email
//
// Executed against hostile documents (lib/email/canvasEmail.js):
//   * banding: a band of two columns, text on a coloured shape, overlaps;
//   * the footer and the unsubscribe row are the SAME shell the block mode
//     uses, and an empty canvas produces no email at all (never a footer-only
//     one);
//   * every text layer's ink measures ≥ 4.5:1 against its ground after the
//     compile, using lib/brand/colour.js's own contrastRatio — the maths
//     lib/documents/theme.js is built on;
//   * merge fields fill and are escaped; a link may start with a token, and
//     a javascript: link is refused; text is escaped;
//   * a linked shape with text becomes a bulletproof button.
// Read:
//   * `sentMode` is read by exactly one module (lib/email/templateBody.js);
//     the cron, the campaign send and the test send go through it;
//   * the PATCH routes record the mode and never null the other body;
//   * the editor's preview renders the mode that would be sent.

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { compileCanvasBody, compileCanvasEmail, canvasText, tabulate, EMAIL_CANVAS } from "../lib/email/canvasEmail.js";
import { templateBody, templateBodyWithWarnings, sentModeOf, SENT_MODES } from "../lib/email/templateBody.js";
import { renderTemplateSections } from "../lib/email/renderTemplateSections.js";
import { contrastRatio } from "../lib/brand/colour.js";
import { APP_MESSAGES } from "../app/i18n/appMessages.js";

process.env.NEXT_PUBLIC_APP_URL ||= "https://www.fieldquo.com";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (p) => fs.readFileSync(path.join(ROOT, p), "utf8");
const code = (src) => src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
const walk = (dir) =>
  fs.readdirSync(path.join(ROOT, dir), { withFileTypes: true }).flatMap((d) =>
    d.isDirectory() ? (d.name === "node_modules" ? [] : walk(path.join(dir, d.name))) : d.name.endsWith(".js") ? [path.join(dir, d.name)] : [],
  );

let failures = 0;
let checks = 0;
function ok(name, pass, detail = "") {
  checks++;
  if (!pass) failures++;
  console.log(`  ${pass ? "ok  " : "FAIL"} ${name}${detail ? `  — ${detail}` : ""}`);
}

const ws = { type: "rect", name: "clip", left: 0, top: 0, width: 600, height: 800, fill: "#ffffff" };
const text = (over) => ({ type: "textbox", left: 30, top: 30, width: 300, height: 30, fontSize: 16, fill: "#1a1917", text: "Hello", ...over });
const company = { name: "Acme", brandColor: "#06356b", phone: "555" };

console.log("\nBanding\n");

{
  const doc = { objects: [ws, text({ top: 100, text: "Left" }), text({ top: 100, left: 340, width: 200, text: "Right" }), text({ top: 300, text: "Below" })] };
  const out = compileCanvasBody(doc, {});
  const rows = (out.body.match(/<table role="presentation" width="100%"[^>]*><tr>/g) || []).length;
  ok("two texts on one line become two columns of one row; a lower text is a second row", rows === 2 && /width="5\d%"/.test(out.body) && out.body.indexOf("Left") < out.body.indexOf("Right") && out.body.indexOf("Right") < out.body.indexOf("Below"));
  ok("column shares add up to 100", (() => { const p = [...out.body.matchAll(/<td width="(\d+)%"/g)].map((m) => Number(m[1])); return p.slice(0, 2).reduce((a, b) => a + b, 0) === 100; })());
}
{
  const doc = { objects: [ws, { type: "rect", left: 0, top: 0, width: 600, height: 100, fill: "#06356b" }, text({ top: 30, fill: "#ffffff", text: "Band title" })] };
  const out = compileCanvasBody(doc, {});
  ok("text inside a coloured shape becomes a coloured cell with the text in it", /bgcolor="#06356b"[^>]*>[\s\S]*Band title/.test(out.body) && !out.warnings.some((w) => w.kind === "overlap"));
}
{
  const doc = { objects: [ws, text({ text: "A" }), text({ left: 40, top: 40, text: "B" })] };
  const out = compileCanvasBody(doc, {});
  ok("two texts overlapping both ways are stacked and named", out.body.indexOf(">A<") < out.body.indexOf(">B<") && out.warnings.some((w) => w.kind === "overlap" && /"A" and "B"/.test(w.message)));
}
{
  const rows = tabulate([{ item: { id: 1, box: { x: 0, y: 0, w: 10, h: 10 }, label: "a", kind: "text" } }], []);
  ok("tabulate on one node is one row, one column", rows.length === 1 && rows[0].columns.length === 1);
  ok("tabulate on nothing is nothing", tabulate([], []).length === 0);
}

console.log("\nThe shell: footer and unsubscribe kept\n");

{
  const doc = { objects: [ws, text({ text: "Hi {{clientName}}" })] };
  const canvas = compileCanvasEmail(doc, { clientName: "Jane" }, { company, unsubscribe: { token: "tok" } });
  const blocks = renderTemplateSections([{ id: "1", type: "text", text: "Hi {{clientName}}" }], { clientName: "Jane" }, { company, unsubscribe: { token: "tok" } });
  // From the footer row on: footer, unsubscribe row, closing tags. The
  // footer is the one row with a top rule.
  const footerOf = (h) => { const rule = h.indexOf("border-top:1px solid"); return h.slice(h.lastIndexOf("<tr>", rule)); };
  ok("canvas email carries the unsubscribe row", /unsubscribe/i.test(canvas.html));
  ok("canvas email carries the company footer", /Acme/.test(footerOf(canvas.html)));
  ok("the footer + unsubscribe tail is byte-identical to the block mode's", footerOf(canvas.html) === footerOf(blocks));
  const header = (h) => h.slice(0, h.indexOf('<tr><td style="padding:30px;">'));
  ok("the header is byte-identical to the block mode's", header(canvas.html) === header(blocks));
  ok("an empty canvas produces NO email, not a footer-only one", compileCanvasEmail({ objects: [ws] }, {}, { company, unsubscribe: { token: "tok" } }).html === "");
  ok("garbage in → empty out, with a reason", compileCanvasEmail("{not json", {}, { company }).html === "" && compileCanvasEmail("{not json", {}, { company }).warnings.length > 0);
  ok("a null document is an empty canvas", compileCanvasEmail(null, {}, { company }).html === "");
}

console.log("\nContrast is measured\n");

{
  // `color:` on text — not `background-color:` on a cell.
  const inkOf = (body) => [...body.matchAll(/(?<![a-z-])color:(#[0-9a-f]{6})/gi)].map((m) => m[1].toLowerCase());
  const groundOf = (body, fallback) => (body.match(/bgcolor="(#[0-9a-f]{6})"/i) || [null, fallback])[1].toLowerCase();
  const cases = [
    ["#999999 on white", { objects: [ws, text({ fill: "#999999" })] }, "#ffffff"],
    ["#ffff00 on white", { objects: [ws, text({ fill: "#ffff00" })] }, "#ffffff"],
    ["mid grey on a mid-grey band", { objects: [ws, { type: "rect", left: 0, top: 0, width: 600, height: 80, fill: "#808080" }, text({ top: 20, fill: "#9a9a9a" })] }, "#808080"],
    ["grey on a #777 band nothing can read on", { objects: [ws, { type: "rect", left: 0, top: 0, width: 600, height: 80, fill: "#777777" }, text({ top: 20, fill: "#888888" })] }, "#777777"],
    ["white on a yellow band", { objects: [ws, { type: "rect", left: 0, top: 0, width: 600, height: 80, fill: "#ffd400" }, text({ top: 20, fill: "#ffffff" })] }, "#ffd400"],
  ];
  for (const [name, doc, ground] of cases) {
    const out = compileCanvasBody(doc, {});
    const inks = inkOf(out.body);
    // The ground the text actually sits on after the compile — a band no
    // ink could read on is allowed to have moved (fillPair's rule).
    const g = groundOf(out.body, ground);
    ok(`${name}: drawn ink measures ≥ 4.5:1 against its ground`, inks.length > 0 && inks.every((ink) => contrastRatio(ink, g) >= 4.5), inks.map((i) => `${i}=${contrastRatio(i, g).toFixed(2)} on ${g}`).join(" "));
    ok(`${name}: the layer is named in a warning`, out.warnings.some((w) => w.kind === "contrast"));
  }
  const fine = compileCanvasBody({ objects: [ws, text({ fill: "#1a1917" })] }, {});
  ok("readable ink is left exactly as drawn", /color:#1a1917/.test(fine.body) && !fine.warnings.some((w) => w.kind === "contrast"));
}

console.log("\nMerge fields, links, escaping\n");

{
  const doc = { objects: [ws, text({ text: "Hi {{clientName}} <3" }), { type: "rect", left: 100, top: 200, width: 200, height: 50, fill: "#06356b", linkData: { url: "{{quoteUrl}}" } }, text({ top: 212, left: 110, width: 180, fill: "#ffffff", text: "View quote", linkData: { url: "{{quoteUrl}}" } }), text({ top: 400, text: "evil", linkData: { url: "javascript:alert(1)" } }), text({ top: 500, text: "tok", linkData: { url: "https://x.test/?u={{quoteUrl}}" } })] };
  const out = compileCanvasBody(doc, { clientName: "Jane <Doe>", quoteUrl: "https://x.test/q/1" });
  ok("merge field filled and escaped; typed text escaped", out.body.includes("Hi Jane &lt;Doe&gt; &lt;3"));
  ok("a linked shape with text is a button: the cell is the link, the label is not underlined", /<a href="https:\/\/x\.test\/q\/1"[^>]*style="display:block;text-decoration:none;">[\s\S]*View quote/.test(out.body) && !/text-decoration:underline;">View quote/.test(out.body));
  ok("a javascript: link is dropped", !/javascript:/.test(out.body));
  ok("a token elsewhere in a link is filled and the link kept only if it is a real URL", /https:\/\/x\.test\/\?u=https:\/\/x\.test\/q\/1/.test(out.body));
  ok("text/plain alternative lists every text layer, tokens filled", canvasText(doc, { clientName: "Jane" }).startsWith("Hi Jane <3"));
  ok("preview links carry no target", !/target=/.test(compileCanvasBody(doc, {}, { preview: true }).body));
}
{
  const doc = { objects: [ws, { type: "image", left: 0, top: 0, width: 1200, height: 600, scaleX: 0.5, scaleY: 0.5, src: "https://img.test/a.jpg" }, { type: "image", left: 0, top: 400, width: 100, height: 100, src: "javascript:x" }, { type: "path", left: 0, top: 600, width: 10, height: 10 }, { type: "textbox", left: 0, top: 700, width: 300, height: 30, fontSize: 60, text: "Huge", fontFamily: "Pacifico" }] };
  const out = compileCanvasBody(doc, {});
  ok("an image keeps its drawn size and never exceeds the body", /<img src="https:\/\/img\.test\/a\.jpg"[^>]*width="540"/.test(out.body));
  ok("an image with a bad address is left out and named", !/javascript:x/.test(out.body) && out.warnings.some((w) => w.kind === "image"));
  ok("a free-drawn path is left out and named", out.warnings.some((w) => w.kind === "unsupported"));
  ok("a web font and 60px type are named, not silently changed", out.warnings.some((w) => w.kind === "font") && out.warnings.some((w) => w.kind === "bigType"));
  ok("the email canvas is 600 wide so what is drawn is what is sent", EMAIL_CANVAS.width === 600);
}
{
  // A wide artboard scales geometry but not type.
  const doc = { objects: [{ ...ws, width: 1080 }, { type: "textbox", left: 0, top: 0, width: 1080, height: 40, fontSize: 24, text: "T" }] };
  const out = compileCanvasBody(doc, {});
  ok("type is not scaled with the artboard", /font-size:24px/.test(out.body));
}

console.log("\nOne reader of sentMode\n");

{
  const readers = [...walk("lib"), ...walk("app")].filter((f) => /\bsentMode\b/.test(code(read(f))));
  const allowed = new Set([
    "lib/email/templateBody.js", // THE reader
    "lib/email/documentEmailWording.js", // chooseWording, for the document-email copies (feeds the builders, not a send)
    "lib/email/documentEmailCopies.js", // stores it
    "app/api/settings/document-templates/[id]/route.js", // records it
    "app/api/settings/document-emails/[id]/route.js", // records it
    "app/api/settings/document-emails/preview/route.js", // previews it
    "app/app/settings/email-templates/[id]/page.js", // the switch
    "app/app/settings/email-templates/DocumentEmails.js", // the switch, for copies
    "lib/email/documentEmailPreview.js", // preview shape
  ]);
  const stray = readers.filter((f) => !allowed.has(f));
  ok("no send path branches on sentMode itself", stray.length === 0, stray.join(", "));
  ok("SENT_MODES are blocks and canvas; unknown reads as blocks", SENT_MODES.join(",") === "blocks,canvas" && sentModeOf({ sentMode: "weird" }) === "blocks");
  for (const f of ["app/api/cron/follow-ups/route.js", "app/api/marketing/campaigns/[id]/send/route.js", "app/api/settings/document-templates/[id]/test/route.js"]) {
    const src = code(read(f));
    ok(`${f} renders through templateBody, not the block renderer directly`, /templateBody\(/.test(src) && !/renderTemplateSections\(/.test(src));
  }
}
{
  const tpl = { sections: [{ id: "1", type: "text", text: "Blocks body" }], canvas: { objects: [ws, text({ text: "Canvas body" })] }, theme: null };
  ok("blocks mode sends the blocks", templateBody({ ...tpl, sentMode: "blocks" }, {}, { company }).includes("Blocks body"));
  ok("canvas mode sends the canvas and not the blocks", (() => { const h = templateBody({ ...tpl, sentMode: "canvas" }, {}, { company }); return h.includes("Canvas body") && !h.includes("Blocks body"); })());
  ok("canvas mode with an empty canvas sends nothing (never the blocks by accident)", templateBody({ ...tpl, canvas: null, sentMode: "canvas" }, {}, { company }) === "");
  ok("warnings ride along for previews", Array.isArray(templateBodyWithWarnings({ ...tpl, sentMode: "canvas" }, {}, { company }).warnings));
}

console.log("\nThe mode is recorded; switching keeps both bodies\n");

{
  const route = code(read("app/api/settings/document-templates/[id]/route.js"));
  ok("PATCH records sentMode and canvas", /sentMode !== undefined && \{ sentMode \}/.test(route) && /canvas !== undefined && \{ canvas \}/.test(route));
  ok("PATCH refuses an empty canvas as the body", /sentMode === "canvas"[\s\S]*drawn\.length === 0/.test(route));
  ok("PATCH never clears the other body on a switch", !/sections: null/.test(route) && !/canvas: null/.test(route));
  const copies = code(read("lib/email/documentEmailCopies.js"));
  ok("a copy's mode switch never clears the other body either", !/canvas: null/.test(copies) && !/sections: \[\]/.test(copies));
  const editor = code(read("app/app/settings/email-templates/[id]/page.js"));
  ok("the editor's preview renders the mode that would be sent", /sentMode === "canvas"[\s\S]*compileCanvasEmail\(canvas/.test(editor));
  ok("the editor saves both bodies and the mode", /JSON\.stringify\(\{ name, subject, sections, theme, sentMode, canvas \}\)/.test(editor));
  ok("the editor says the other body is kept", /app\.emailModes\.canvasKept/.test(editor) && /app\.emailModes\.blocksKept/.test(editor));
  ok("the canvas editor is the designer's canvas, not a third editor", /DesignerLoader/.test(read("app/components/emailCanvas/EmailCanvasEditor.js")) && !/new fabric/.test(read("app/components/emailCanvas/EmailCanvasEditor.js")));
  ok("the schema records sentMode with blocks as the default", /sentMode String @default\("blocks"\)/.test(read("prisma/schema.prisma")));
}

console.log("\nNine languages for the chrome\n");

for (const key of ["app.emailModes.blocks", "app.emailModes.canvas", "app.emailModes.canvasIsSent", "app.emailModes.blocksKept", "app.emailModes.canvasKept", "app.emailCanvas.linkTo", "app.emailCanvas.howItSends"]) {
  const missing = Object.keys(APP_MESSAGES).filter((l) => !APP_MESSAGES[l][key]);
  ok(`${key} in every language`, missing.length === 0, missing.join(","));
}

console.log(`\n${checks} checks, ${failures} failure(s).`);
process.exit(failures ? 1 : 0);
