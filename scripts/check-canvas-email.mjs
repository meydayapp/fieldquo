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
  // Found by the title's own style rather than its words: the default title
  // is printed in the document's language now ("Ce qui est inclus" on a
  // French quote), so "What's included" only marks an English table.
  const tableOf = (html) => {
    const at = html.search(/letter-spacing:0\.08em;text-transform:uppercase/);
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
  ok("quote: the block's default title is the document's own words (Ce qui est inclus), not English", q.includes(frLabels.whatsIncluded) && !q.includes("What's included"));
  const typed = tableOf(renderTemplateSections([{ ...block, title: "Votre soumission" }], { lineItems: qLines }, { company }));
  ok("…a title the company typed is printed exactly as written", typed.includes("Votre soumission"));

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
  // The builder moved to lib/followUps/mergeData.js so it can be executed
  // (the section below runs it); the cron imports it.
  const builder = code(read("lib/followUps/mergeData.js"));
  ok("the cron builds the block's input with the document helpers", /quoteTemplateLines\(/.test(builder) && /invoiceTemplateLines\(/.test(builder) && /lineItems: lineItemsFor\(entityType, entity\)/.test(builder) && /mergeDataFor\(finder\.entityType, entity, request, portalToken, language\)/.test(cron));
  ok("the cron loads a quote's scope groups and an invoice's quote's groups", /include: \{ client: true, company: true, scopeGroups: SCOPE_GROUPS_FOR_LINES \}/.test(cron) && /quote: \{ select: \{ scopeGroups: SCOPE_GROUPS_FOR_LINES \} \}/.test(cron));
  for (const f of ["app/app/settings/email-templates/[id]/page.js", "app/api/settings/document-templates/[id]/test/route.js", "lib/email/documentEmailPreview.js", "lib/email/renderTemplateSections.js", "app/api/cron/follow-ups/route.js", "lib/followUps/mergeData.js"]) {
    ok(`${f} carries no name/unitPrice/total line shape`, !/unitPrice\s*:|item\.unitPrice|item\.total\b/.test(code(read(f))));
  }
  const editor = code(read("app/app/settings/email-templates/[id]/page.js"));
  ok("the editor previews the shared sample", /sampleMergeData\(/.test(editor));
  ok("the editor says which sends fill the block", /app\.emailEditor\.lineItemsWhereFilled/.test(editor) && !/app\.emailEditor\.lineItemsHelp/.test(editor));
}

console.log("\nThe tokens and the blocks' own words follow the document\n");

// {{quoteTotal}}, {{invoiceTotal}}, {{balanceDue}} and every other money token
// went through the cron's local money(): "$" + toLocaleString(undefined), so a
// EUR company's Spanish invoice chase said "$1,210.00" and a French quote's
// said "$4,250.00" under a document reading "4 250,00 $". The summary block
// printed "Quote #" / "Invoice #", the progress block "Done" / "Pending" and
// the unsubscribe line was English, whatever the document said.
//
// Executed, not read: the cron's own builder (lib/followUps/mergeData.js)
// against three documents, poured through templateBody exactly as the cron
// does. Imported defensively so that code missing the builder FAILS these
// assertions rather than crashing the whole check.
{
  const mergeMod = await import("../lib/followUps/mergeData.js").catch(() => null);
  const mergeFieldsMod = await import("../lib/email/templateMergeFields.js").catch(() => null);
  const { emailCopy } = await import("../lib/i18n/emailCopy.js");
  const { defaultSectionsFor } = await import("../app/data/emailTemplateBlocks.js");
  ok("the cron's merge builder is a module a check can execute", Boolean(mergeMod?.mergeDataFor && mergeMod?.followUpLanguage));

  const build = (type, entity, portalToken = null) => {
    if (!mergeMod) return { language: "en", data: {} };
    const language = mergeMod.followUpLanguage(type, entity);
    return { language, data: mergeMod.mergeDataFor(type, entity, null, portalToken, language) };
  };
  // The cron's call, verbatim: company, the resolved language, no unsubscribe
  // on a transactional chase.
  const send = (sections, data, language, co) => templateBody({ sections, sentMode: "blocks" }, data, { company: co, language });
  const norm = (x) => String(x).replace(/\s+/g, " ");
  const plain = (html) => html.replace(/<[^>]+>/g, " ").replace(/&amp;/g, "&").replace(/&#39;/g, "'").replace(/\s+/g, " ");

  // Every block the editor offers that prints words of its own, plus text
  // that carries every money token and date token.
  const tokensText = { id: "t", type: "text", text: "QT[{{quoteTotal}}] IT[{{invoiceTotal}}] BD[{{balanceDue}}] AP[{{amountPaid}}] ST[{{subtotal}}] DC[{{discount}}] TX[{{tax}}] DD[{{dueDate}}]" };
  const blocks = [
    tokensText,
    { id: "s", type: "summary" },
    { id: "p", type: "progress", stages: ["Quote", "Deposit & scheduling", "Project start", "Project complete"], activeStage: 0, useMergeField: true },
    { id: "l", type: "lineItems", title: "What's included", showQuantity: true, showUnitPrice: true, showSubtotals: true },
  ];

  // ── 1. A CAD company's French quote, for an English-speaking client ──────
  // The DOCUMENT's language wins over the client's (clientLanguage.js).
  const caCo = { name: "Rénovations Tremblay", currency: "CAD", defaultLanguage: "en", brandColor: "#06356b" };
  const frQuote = {
    id: "q1", language: "fr", quoteNumber: "Q-2026-0042", shareToken: "sharetok", quoteType: "Peinture",
    subtotal: 3900, discount: 150, tax: 500, total: 4250,
    client: { name: "Jane Doe", language: "en" }, company: caCo,
    scopeGroups: [{ label: "Peinture", subtotal: 3900, lineItems: [{ description: "Murs", quantity: 3, unit: "room", rate: 1300, amount: 3900 }] }],
  };
  const fq = build("quote", frQuote);
  const frF = documentFormatters("fr", "CAD");
  const frL = documentLabels("fr");
  const frW = emailCopy("fr").templateBlocks || {};
  ok("CAD French quote: the email's language is the document's (fr), not the client's (en)", fq.language === "fr");
  ok("CAD French quote: {{quoteTotal}} is the document's figure, French-formatted (4 250,00 $)", fq.data.quoteTotal === frF.money(4250) && /^4\s250,00\s\$$/u.test(fq.data.quoteTotal || ""), JSON.stringify(fq.data.quoteTotal));
  ok("CAD French quote: {{subtotal}}/{{tax}}/{{discount}} likewise", fq.data.subtotal === frF.money(3900) && fq.data.tax === frF.money(500) && fq.data.discount === frF.money(150));
  const fqHtml = send([...blocks, ...defaultSectionsFor("follow_up_email")], fq.data, fq.language, caCo);
  const fqText = plain(fqHtml);
  ok("CAD French quote: no \"$4,250.00\" anywhere in the email", !fqHtml.includes("$4,250.00") && !fqHtml.includes("$3,900.00"));
  ok("CAD French quote: the token prints the French figure inside the text block", fqText.includes(`QT[${norm(frF.money(4250))}]`), fqText.slice(0, 200));
  ok("CAD French quote: the summary says \"Devis Q-2026-0042\", not \"Quote #\"", fqText.includes(`${frL.quote} Q-2026-0042`) && !/Quote #/.test(fqText));
  ok("CAD French quote: the progress tracker's words are French (Terminé / En attente)", fqText.includes(frW.done) && fqText.includes(frW.pending) && !/\bDone\b|\bPending\b/.test(fqText));
  ok("CAD French quote: the default stage names are French (Devis, Début du projet)", fqText.includes(frW.stageStart) && fqText.includes(frW.stageComplete) && !/Project start|Project complete|Deposit & scheduling/.test(fqText));
  ok("CAD French quote: the itemised block is French under its default title", fqText.includes(frL.whatsIncluded) && fqText.includes(frL.subtotal) && !/What's included/.test(fqText));
  ok("CAD French quote: the company's own starter text is sent exactly as written (not translated)", fqText.includes("Still thinking it over?") && fqText.includes("View your quote"));

  // ── 2. A EUR company's Spanish invoice ──────────────────────────────────
  const euCo = { name: "Reformas Sol", currency: "EUR", defaultLanguage: "es" };
  const esInvoice = {
    id: "inv1", language: "es", invoiceNumber: "F-0007", total: 1210, amountPaid: 200, subtotal: 1000, tax: 210, discount: 0,
    dueDate: "2026-10-01T00:00:00Z",
    lineItems: [{ description: "Alicatado baño", quantity: 1, unit: "flat", rate: 1000, amount: 1000 }],
    client: { name: "Lucía", language: "en" }, company: euCo, quote: null,
  };
  const ei = build("invoice", esInvoice, "ptok");
  const esF = documentFormatters("es", "EUR");
  const esL = documentLabels("es");
  const esW = emailCopy("es").templateBlocks || {};
  ok("EUR Spanish invoice: the email's language is the invoice's (es)", ei.language === "es");
  ok("EUR Spanish invoice: {{invoiceTotal}} is in euros, formatted for Spanish", ei.data.invoiceTotal === esF.money(1210) && /EUR|€/.test(ei.data.invoiceTotal || "") && !/\$/.test(ei.data.invoiceTotal || ""), JSON.stringify(ei.data.invoiceTotal));
  ok("EUR Spanish invoice: {{balanceDue}} is total − paid, in euros", ei.data.balanceDue === esF.money(1010));
  ok("EUR Spanish invoice: {{amountPaid}} in euros", ei.data.amountPaid === esF.money(200));
  ok("EUR Spanish invoice: {{dueDate}} is the Spanish calendar date, read as UTC (1 de octubre de 2026)", ei.data.dueDate === esF.date("2026-10-01T00:00:00Z") && /octubre/.test(ei.data.dueDate || ""), JSON.stringify(ei.data.dueDate));
  ok("EUR Spanish invoice: a nil discount stays blank, as it always did", ei.data.discount === "");
  const eiText = plain(send(blocks, ei.data, ei.language, euCo));
  ok("EUR Spanish invoice: no dollar sign anywhere in the email", !/\$/.test(eiText), eiText.slice(0, 240));
  ok("EUR Spanish invoice: the summary says \"Factura F-0007\" with its euro total", eiText.includes(`${esL.invoice} F-0007`) && eiText.includes(norm(esF.money(1210))));
  ok("EUR Spanish invoice: progress words in Spanish (Completado / Pendiente)", eiText.includes(esW.done) && eiText.includes(esW.pending) && !/\bDone\b|\bPending\b/.test(eiText));

  // ── 3. A USD company's English quote ────────────────────────────────────
  const usCo = { name: "Lone Star Painting", currency: "USD", defaultLanguage: "en" };
  const enQuote = { id: "q2", language: "en", quoteNumber: "Q-7", total: 4250, subtotal: 4250, tax: 0, discount: 0, client: { name: "Sam" }, company: usCo, scopeGroups: [] };
  const eq = build("quote", enQuote);
  const usF = documentFormatters("en", "USD");
  ok("USD English quote: {{quoteTotal}} is the quote email's own figure (US$4,250.00)", eq.data.quoteTotal === usF.money(4250) && eq.data.quoteTotal.includes("4,250.00"), JSON.stringify(eq.data.quoteTotal));
  const eqText = plain(send(blocks, eq.data, eq.language, usCo));
  ok("USD English quote: the summary reads \"Quote Q-7\" and the tracker \"Done\"", eqText.includes("Quote Q-7") && /\bDone\b/.test(eqText));

  // ── 4. GBP / AUD: the company's currency, never "$" by default ──────────
  for (const [cur, lang, sign] of [["GBP", "en", "£"], ["AUD", "en", "A$"], ["EUR", "de", "€"]]) {
    const d = build("quote", { language: lang, total: 99.5, client: {}, company: { currency: cur }, scopeGroups: [] }).data;
    ok(`${cur} ${lang} quote: {{quoteTotal}} carries ${sign}`, (d.quoteTotal || "").includes(sign) && d.quoteTotal === documentFormatters(lang, cur).money(99.5), JSON.stringify(d.quoteTotal));
  }

  // ── 5. Sends with no document: the client's language ───────────────────
  const job = build("job", { title: "Deck", status: "completed", client: { name: "Ana", language: "es" }, company: { currency: "CAD", defaultLanguage: "en" } });
  ok("a completed-job chase is written in the client's language (es)", job.language === "es");
  const lead = build("lead", { client: { name: "Olena", language: "uk" }, company: { defaultLanguage: "en" }, category: { label: "Roof" } });
  ok("an enquiry chase is written in the language the form was filled in (uk)", lead.language === "uk");
  const cron = code(read("app/api/cron/follow-ups/route.js"));
  ok("…and the cron's lead finder carries LeadRequest.language into the client slot", /language: lead\.language/.test(cron));
  ok("the cron hands the resolved language to the blocks", /templateBody\(rule\.template, mergeData, \{[\s\S]{0,300}?language,/.test(cron));
  ok("the cron has no money formatter of its own any more", !/function money\(/.test(cron) && !/`\$\$\{/.test(cron));

  // ── 6. The unsubscribe line (campaigns, job-completed chases) ───────────
  const unsub = (language) => plain(renderTemplateSections([{ id: "h", type: "heading", text: "Hola" }], {}, { company: { name: "Acme" }, language, unsubscribe: { token: "tok" } }));
  ok("the unsubscribe line is French on a French email", unsub("fr").includes("Se désabonner") && !unsub("fr").includes("Unsubscribe"), unsub("fr").slice(-200));
  ok("the unsubscribe line stays English on an English email", unsub("en").includes("Unsubscribe") && unsub("en").includes("customer of Acme"));
  const campaign = code(read("app/api/marketing/campaigns/[id]/send/route.js"));
  ok("the campaign send resolves each recipient's language and passes it", /resolveClientLanguage\(/.test(campaign) && /templateBody\(campaign\.template, mergeData, \{[\s\S]{0,200}?language:/.test(campaign));
  const canvasFr = plain(templateBody({ sentMode: "canvas", canvas: { objects: [ws, text({ text: "Bonjour" })] } }, {}, { company: { name: "Acme" }, language: "fr", unsubscribe: { token: "tok" } }));
  ok("a canvas email's unsubscribe line follows the same language", canvasFr.includes("Se désabonner"), canvasFr.slice(-200));

  // ── 7. Every client language, and company text left alone ──────────────
  for (const lang of ["en", "fr", "es", "it", "de", "uk", "pa", "tl"]) {
    const w = emailCopy(lang).templateBlocks || {};
    const L = documentLabels(lang);
    const html = plain(renderTemplateSections(
      [{ id: "s", type: "summary" }, { id: "p", type: "progress", stages: ["Quote", "Invoice & scheduling", "Project start", "Project complete"], activeStage: 1, useMergeField: false }],
      { quoteNumber: "Q-1", quoteTotal: "x" },
      { language: lang, company: { name: "Acme" }, unsubscribe: { token: "t" } },
    ));
    const complete = w && w.done && w.pending && w.stageQuote && w.stageInvoice && w.stageStart && w.stageComplete && typeof w.marketingFooter === "function";
    ok(`${lang}: summary, tracker and unsubscribe line in ${lang}`,
      complete && html.includes(`${L.quote} Q-1`) && html.includes(w.done) && html.includes(w.pending) && html.includes(w.stageInvoice)
        && (lang === "en" || !/\bDone\b|\bPending\b|Project start|Unsubscribe\b/.test(html)),
      html.slice(0, 260));
  }
  const renamed = plain(renderTemplateSections([{ id: "p", type: "progress", stages: ["Site visit", "Quote", "Build"], activeStage: 0, useMergeField: false }], {}, { language: "fr" }));
  ok("a stage the company renamed is its own text and is printed as written", renamed.includes("Site visit") && renamed.includes("Build") && renamed.includes(frW.stageQuote));
  const noLang = plain(renderTemplateSections([{ id: "s", type: "summary" }], { quoteNumber: "Q-1", quoteTotal: "t", lineItems: { language: "de", groups: [] } }, {}));
  ok("with no language given, the itemised block's document language is used (Angebot)", noLang.includes("Angebot Q-1"));

  // ── 8. The preview and the test send: the same sample, in the company's currency
  ok("the shared sample exists (lib/email/templateMergeFields.js)", Boolean(mergeFieldsMod?.sampleMergeData));
  if (mergeFieldsMod?.sampleMergeData) {
    const eur = mergeFieldsMod.sampleMergeData({ language: "fr", currency: "EUR" });
    const expected = { quoteTotal: 4250, invoiceTotal: 4250, balanceDue: 1250, amountPaid: 3000, subtotal: 3900, discount: 150, tax: 500 };
    const frEur = documentFormatters("fr", "EUR");
    ok("sample in fr/EUR: every money token is euros, French-formatted", Object.entries(expected).every(([k, v]) => eur[k] === frEur.money(v) && /€/.test(eur[k])), JSON.stringify(eur.quoteTotal));
    ok("sample in fr/EUR: the dates are French", eur.dueDate === frEur.date("2026-08-01T00:00:00Z") && /août/.test(eur.dueDate));
    ok("sample in fr/EUR: the itemised sample is in the same pair", eur.lineItems?.language === "fr" && eur.lineItems?.currency === "EUR");
    const cad = mergeFieldsMod.sampleMergeData({ language: "en", currency: "CAD" });
    ok("sample in en/CAD reads as it always did ($4,250.00 / $1,250.00)", cad.quoteTotal === "$4,250.00" && cad.balanceDue === "$1,250.00" && cad.amountPaid === "$3,000.00");
  }
  for (const f of ["app/app/settings/email-templates/[id]/page.js", "app/api/settings/document-templates/[id]/test/route.js"]) {
    const src = code(read(f));
    ok(`${f.split("/").slice(-2).join("/")} carries no "$" figure of its own and draws the shared sample`, !/"\$\d/.test(src) && /sampleMergeData\(/.test(src) && /language/.test(src));
  }
}

console.log("\nNine languages for the chrome\n");

for (const key of ["app.emailModes.blocks", "app.emailModes.canvas", "app.emailModes.canvasIsSent", "app.emailModes.blocksKept", "app.emailModes.canvasKept", "app.emailCanvas.linkTo", "app.emailCanvas.howItSends", "app.emailEditor.lineItemsWhereFilled"]) {
  const missing = Object.keys(APP_MESSAGES).filter((l) => !APP_MESSAGES[l][key]);
  ok(`${key} in every language`, missing.length === 0, missing.join(","));
}

console.log(`\n${checks} checks, ${failures} failure(s).`);
process.exit(failures ? 1 : 0);
