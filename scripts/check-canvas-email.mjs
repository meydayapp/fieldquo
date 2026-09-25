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
import { quoteTemplateLines, invoiceTemplateLines, sampleTemplateLines } from "../lib/email/templateLineItems.js";
import { documentFormatters, documentLabels } from "../lib/i18n/documentLabels.js";

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

console.log("\nThe itemised block draws stored lines\n");

// The "Itemized list" block read name/unitPrice/total — a shape no stored
// quote or invoice line has ({ description, detail?, quantity, unit, rate,
// amount }). Only the editor's preview and the test send ever fed it, and
// the follow-up cron handed it Quote.lineItems, which the builder does not
// write (a quote's lines live on its scope groups). These render the block
// for a real-shape invoice and quote and require every line's amount.
{
  const block = { id: "li", type: "lineItems", title: "What's included", showQuantity: true, showUnitPrice: true, showSubtotals: true };
  const tableOf = (html) => {
    const at = html.indexOf("What's included");
    return at === -1 ? "" : html.slice(at, html.indexOf("</table>", at));
  };
  const zeroCad = /(^|[^\d.,])\$0\.00(?!\d)/;

  // An invoice raised from a two-trade quote: createInvoiceFromQuote writes
  // "<group label>: <description>", and one line was added by hand.
  const invoice = {
    language: "en",
    subtotal: 1270.5,
    discount: 0,
    tax: 165.17,
    total: 1435.67,
    lineItems: [
      { description: "Painting: Walls — two coats", quantity: 2, unit: "room", rate: 450, amount: 900 },
      { description: "Painting: Trim", detail: "Semi-gloss, **two** coats", quantity: 1, unit: "flat", rate: 275.5, amount: 275.5 },
      { description: "Callout", quantity: 1, unit: "flat", rate: 95, amount: 95 },
    ],
  };
  const invLines = invoiceTemplateLines({ invoice, scopeGroups: [{ id: "g1", label: "Painting", sortOrder: 0 }], company: { currency: "CAD" } });
  const invHtml = renderTemplateSections([block], { lineItems: invLines }, { company });
  const inv = tableOf(invHtml);
  ok("invoice: the block renders at all", inv.length > 0);
  const invAmounts = ["$900.00", "$275.50", "$95.00"].every((a) => inv.includes(`>${a}<`));
  ok("invoice: every line's amount is printed in its own cell ($900.00, $275.50, $95.00)", invAmounts, invAmounts ? "" : inv.replace(/style="[^"]*"/g, "").slice(0, 600));
  ok("invoice: no line prints $0.00", !zeroCad.test(inv));
  ok("invoice: quantity × rate from the stored rate (2 × $450.00)", inv.includes("2 × $450.00"));
  ok("invoice: grouped under its quote's trade, prefix stripped (documentGroups.js)", /Painting[\s\S]*Walls — two coats/.test(inv) && !inv.includes("Painting: Walls"));
  ok("invoice: a hand-added line stays, ungrouped", inv.includes("Callout"));
  ok("invoice: the line's detail is drawn through the rich-text subset", inv.includes("Semi-gloss, <strong>two</strong> coats"));
  ok("invoice: the totals ladder is the document's (tax $165.17, total $1,435.67)", inv.includes("$165.17") && inv.includes("$1,435.67"));
  ok("invoice: a zero discount is not a row", !/Discount/.test(inv));

  // A French quote whose lines live on its scope groups, with an unpriced
  // text block (lib/quotes/textBlocks.js) and a blended import line that
  // repeats its group head word for word (scopeGroupDisplay.js).
  const quote = { language: "fr", lineItems: null, subtotal: 12000, discount: 500, tax: 1725, total: 13225 };
  const scopeGroups = [
    { label: "Peinture", subtotal: 3000, lineItems: [
      { description: "Murs", quantity: 3, unit: "room", rate: 800, amount: 2400 },
      { description: "Plafonds", quantity: 1, unit: "flat", rate: 600, amount: 600 },
    ] },
    { label: "Travaux sous-traités", subtotal: 9000, lineItems: [
      { description: "Travaux sous-traités", quantity: 1, unit: "flat", rate: 9000, amount: 9000 },
    ] },
    { label: "Exclusions", subtotal: 0, lineItems: [
      { description: "Exclusions", detail: "Pas de plâtrage.", kind: "text", priceMode: "none", quantity: 1, amount: 0 },
    ] },
  ];
  const fr = documentFormatters("fr", "CAD");
  const frLabels = documentLabels("fr");
  const qLines = quoteTemplateLines({ quote, scopeGroups, company: { currency: "CAD" } });
  const q = tableOf(renderTemplateSections([block], { lineItems: qLines }, { company }));
  ok("quote: the block renders from the scope groups (Quote.lineItems is null)", q.length > 0);
  // `>…<`: the figure as a whole cell, so "0,00 $" cannot match the tail
  // of "12 000,00 $".
  const qAmounts = [2400, 600, 9000].every((a) => q.includes(`>${fr.money(a)}<`));
  ok("quote: every priced line's amount, in the document's language and currency", qAmounts, qAmounts ? "" : q.replace(/style="[^"]*"/g, "").slice(0, 900));
  ok("quote: the unpriced text block prints no amount (never 0,00 $)", !q.includes(`>${fr.money(0)}<`) && q.includes("Pas de plâtrage."));
  ok("quote: the document's labels, not English (Sous-total / Rabais / Taxes)", q.includes(frLabels.subtotal) && q.includes(frLabels.discount) && q.includes(frLabels.tax) && !/>Subtotal</.test(q));
  ok("quote: the blended line that repeats its head is drawn once", q.split("Travaux sous-traités").length - 1 === 1);
  ok("quote: the unit code is never printed", !/\broom\b|\bflat\b/.test(q));

  // Toggles and hostile input.
  const noTotals = tableOf(renderTemplateSections([{ ...block, showSubtotals: false }], { lineItems: invLines }, { company }));
  ok("line totals off: no line amount, the document total still stands", !noTotals.includes("$900.00") && noTotals.includes("$1,435.67"));
  const hostile = invoiceTemplateLines({ invoice: { language: "en", total: 10, lineItems: [{ description: "<script>x</script>", detail: "[click](javascript:alert(1))", quantity: 1, rate: 10, amount: 10 }] }, company: { currency: "CAD" } });
  const h = renderTemplateSections([block], { lineItems: hostile }, { company });
  ok("a description is escaped; a javascript: link in a detail is not a link", h.includes("&lt;script&gt;x&lt;/script&gt;") && !/javascript:/.test(h));
  const legacy = renderTemplateSections([block], { lineItems: [{ name: "Doors", quantity: 2, unitPrice: 100, total: 200 }] }, { company });
  ok("the old array shape draws nothing, not an empty shell", !legacy.includes("What's included"));
  ok("no document (a lead chase, a campaign) draws nothing", !renderTemplateSections([block], { lineItems: null }, { company }).includes("What's included"));

  // The preview is the send's shape.
  const sample = tableOf(renderTemplateSections([block], { lineItems: sampleTemplateLines({ language: "en", currency: "CAD" }) }, { company }));
  ok("the editor's sample draws every sample amount and no $0.00", ["$3,000.00", "$750.00", "$150.00", "$4,250.00"].every((a) => sample.includes(a)) && !zeroCad.test(sample));

  // Who feeds it.
  const cron = code(read("app/api/cron/follow-ups/route.js"));
  ok("the cron builds the block's input with the document helpers", /quoteTemplateLines\(/.test(cron) && /invoiceTemplateLines\(/.test(cron) && /lineItems: lineItemsFor\(entityType, entity\)/.test(cron));
  ok("the cron loads a quote's scope groups and an invoice's quote's groups", /include: \{ client: true, company: true, scopeGroups: SCOPE_GROUPS_FOR_LINES \}/.test(cron) && /quote: \{ select: \{ scopeGroups: SCOPE_GROUPS_FOR_LINES \} \}/.test(cron));
  for (const f of ["app/app/settings/email-templates/[id]/page.js", "app/api/settings/document-templates/[id]/test/route.js", "lib/email/documentEmailPreview.js", "lib/email/renderTemplateSections.js", "app/api/cron/follow-ups/route.js"]) {
    ok(`${f} carries no name/unitPrice/total line shape`, !/unitPrice\s*:|item\.unitPrice|item\.total\b/.test(code(read(f))));
  }
  const editor = code(read("app/app/settings/email-templates/[id]/page.js"));
  ok("the editor previews the shared sample", /sampleTemplateLines\(/.test(editor));
  ok("the editor says which sends fill the block", /app\.emailEditor\.lineItemsWhereFilled/.test(editor) && !/app\.emailEditor\.lineItemsHelp/.test(editor));
}

console.log("\nNine languages for the chrome\n");

for (const key of ["app.emailModes.blocks", "app.emailModes.canvas", "app.emailModes.canvasIsSent", "app.emailModes.blocksKept", "app.emailModes.canvasKept", "app.emailCanvas.linkTo", "app.emailCanvas.howItSends", "app.emailEditor.lineItemsWhereFilled"]) {
  const missing = Object.keys(APP_MESSAGES).filter((l) => !APP_MESSAGES[l][key]);
  ok(`${key} in every language`, missing.length === 0, missing.join(","));
}

console.log(`\n${checks} checks, ${failures} failure(s).`);
process.exit(failures ? 1 : 0);
