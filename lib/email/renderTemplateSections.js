// lib/email/renderTemplateSections.js
//
// Pure function: turns a DocumentTemplate.sections block array (see
// app/data/emailTemplateBlocks.js) into inline-styled HTML for Resend,
// substituting {{mergeField}} tokens along the way. No I/O — easy to
// unit-test, and reused by every send path (quote/instructions/receipt/
// follow-up/marketing) instead of each one having its own HTML.
//
// Everything is table + inline-style based. Email clients (Outlook in
// particular) ignore <style> blocks, flexbox and grid, so layout that looks
// fine in the preview iframe but uses modern CSS will collapse in a real
// inbox. Percentage-width tables and inline styles are the boring, reliable
// option.

import {
  resolveTheme,
  escapeHtml,
  escapeAttr,
  safeUrl,
  safeColor,
} from "./emailTheme.js";
// Not emailTheme's contrastText — that one is a luminance threshold and fails
// 4.5:1 on mid-tones. See the button block below.
import { documentTheme, fillPair } from "@/lib/documents/theme";
import { unsubscribeFooterRow } from "@/lib/marketing/unsubscribe";
// The itemised block's words and money: the document's own labels and
// formatter, the ones the PDF and the approval page use.
import { documentLabels, documentFormatters } from "@/lib/i18n/documentLabels";
// The words FieldQuo itself prints around a company's blocks (the progress
// tracker's states and default stages, the unsubscribe line).
import { emailCopy } from "@/lib/i18n/emailCopy";
import { lineShowsAmount } from "@/lib/quotes/textBlocks";
import { richTextToHtml } from "@/lib/quotes/richText";

// Replaces {{token}} with mergeData[token] (blank if missing) — never
// throws on an unknown token, so a template written before some field
// existed still renders.
export function applyMergeFields(text, mergeData = {}) {
  return String(text ?? "").replace(
    /\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g,
    (_, token) => escapeHtml(mergeData[token] ?? ""),
  );
}

// Same substitution but for values heading into an attribute (href, src).
// Kept separate so quotes are escaped — see the note in emailTheme.js.
function mergeIntoAttr(text, mergeData = {}) {
  const raw = String(text ?? "").replace(
    /\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g,
    (_, token) => String(mergeData[token] ?? ""),
  );
  return escapeAttr(safeUrl(raw));
}

// Normalise an alignment value to a safe CSS text-align.
function align(value) {
  return value === "center" || value === "right" ? value : "left";
}

// Heading size → font-size. Defaults to "large" so templates written before
// the size field existed look exactly as they did.
const HEADING_SIZES = { small: 16, medium: 20, large: 25 };

// ── Which words are FieldQuo's ──────────────────────────────────────────────
//
// A template is the COMPANY's text: a heading, a paragraph or a button label
// it typed is sent exactly as written, in whatever language it wrote it —
// nothing here translates it. What this file prints ON ITS OWN is FieldQuo's,
// and those words follow the email's language (options.language, which the
// follow-up cron resolves as the document's language, else the client's):
//
//   summary   "Quote" / "Invoice" beside the number — documentLabels, the
//             same word the document itself is titled with
//   progress  "Done" / "Pending", and the stage names while they are still
//             FieldQuo's defaults (see stageLabel)
//   lineItems the column and totals labels (documentLabels, in the
//             document's language), and the block's default title
//   footer    the marketing unsubscribe line (lib/marketing/unsubscribe.js)
//
// All of these used to be English on every send.

// The progress block's stage names are stored ON the block (newBlock copies
// the defaults in, so a company can rename them). A name that is still one of
// FieldQuo's default English names was never typed by anyone — it is our
// default sitting in their row — so it is printed in the email's language. A
// renamed stage is the company's text and stays exactly as written.
const DEFAULT_STAGE_KEYS = {
  Quote: "stageQuote",
  "Deposit & scheduling": "stageDeposit",
  "Invoice & scheduling": "stageInvoice",
  "Project start": "stageStart",
  "Project complete": "stageComplete",
};

function stageLabel(label, words) {
  const text = String(label ?? "");
  const key = Object.prototype.hasOwnProperty.call(DEFAULT_STAGE_KEYS, text) ? DEFAULT_STAGE_KEYS[text] : null;
  return key ? words[key] : text;
}

// The itemised block's default title, likewise: the phrase newBlock stores,
// never typed by the company, printed as the document's own "What's included".
const DEFAULT_LINE_ITEMS_TITLE = "What's included";

function renderBlock(block, mergeData, theme, language) {
  switch (block.type) {
    case "heading": {
      const size = HEADING_SIZES[block.size] || HEADING_SIZES.large;
      return `<h1 style="margin:0 0 12px 0;font-size:${size}px;line-height:1.3;font-weight:700;letter-spacing:-0.01em;color:${safeColor(block.color, theme.text)};text-align:${align(block.align)};">${applyMergeFields(block.text, mergeData)}</h1>`;
    }

    case "text":
      // Newlines become <br> so a company can write a simple bullet list
      // ("• Item one\n• Item two") in one block without a dedicated list
      // block type.
      return `<p style="margin:0 0 16px 0;font-size:15px;line-height:1.75;color:${safeColor(block.color, theme.muted)};text-align:${align(block.align)};">${applyMergeFields(block.text, mergeData).replace(/\n/g, "<br/>")}</p>`;

    case "image": {
      const url = safeUrl(block.url);
      if (!url) return "";
      const maxWidth = block.width === "half" ? "50%" : "100%";
      const img = `<img src="${escapeAttr(url)}" alt="${escapeAttr(block.alt || "")}" style="max-width:${maxWidth};height:auto;display:inline-block;border:0;border-radius:10px;" />`;
      return `<div style="margin:0 0 18px 0;text-align:${align(block.align)};">${img}</div>`;
    }

    case "button": {
      const chosen = safeColor(block.bg, theme.accent);

      // ── Measured, not thresholded ─────────────────────────────────────────
      //
      // This used to be contrastText(bg), a luminance threshold: over 0.55 use
      // dark ink, under it use white. Measuring it shows why that isn't good
      // enough — mid grey lands at 3.95:1, hot pink 3.64, safety orange 2.94,
      // all below the 4.5:1 minimum, and NO choice of foreground fixes them,
      // because a mid-tone is roughly equidistant from black and white.
      //
      // fillPair moves the FILL in small steps until the pair measures 4.5:1,
      // so the button stays recognisably their colour rather than being
      // replaced. It only shifts when it has to.
      //
      // The fill is adjusted even when the company picked it explicitly. An
      // invisible CTA is worse than a slightly deeper one: the recipient
      // doesn't see a subtle colour difference, they see an email with no
      // button, and the company sees a campaign that got no clicks.
      const pair = fillPair(documentTheme({ brandColor: chosen }));

      // An explicit text colour is still honoured — that's a deliberate
      // decision, and this function is not the place to overrule it.
      const bg = block.color ? chosen : pair.bg;
      const color = safeColor(block.color, pair.fg);
      const href = mergeIntoAttr(block.url, mergeData);
      return `<div style="margin:4px 0 22px 0;text-align:${align(block.align)};"><a href="${href}" style="display:inline-block;padding:13px 30px;background:${bg};color:${color} !important;text-decoration:none;border-radius:6px;font-weight:700;font-size:14px;letter-spacing:0.01em;">${applyMergeFields(block.label, mergeData)}</a></div>`;
    }

    case "divider":
      return `<hr style="border:none;border-top:1px solid ${theme.border};margin:22px 0;" />`;

    case "spacer": {
      // Height-based spacer that survives Outlook/Gmail (an empty div with a
      // set height gets collapsed, so pad it with a non-breaking space).
      const h = Math.max(4, Math.min(120, Number(block.height) || 24));
      return `<div style="height:${h}px;line-height:${h}px;font-size:1px;">&nbsp;</div>`;
    }

    case "summary":
      return renderSummary(mergeData, theme, language);

    case "lineItems":
      return renderLineItems(block, mergeData, theme);

    case "progress":
      return renderProgress(block, mergeData, theme, language);

    default:
      return "";
  }
}

// Compact version: document number + grand total only.
//
// The word is the document's own title in the email's language — the same
// `documentLabels(language).quote` the approval page prints above the number
// ("Devis Q-1042"). It used to be "Quote #" / "Invoice #" in English on every
// send; the "#" went with it, because "n°", "Nr." and "No." are not "#" and
// the approval page writes the word and the number with nothing between.
// The total is the {{quoteTotal}} / {{invoiceTotal}} token, already formatted
// by the send path (lib/email/templateMergeFields.js).
function renderSummary(mergeData, theme, language) {
  const labels = documentLabels(language);
  const rows = [
    [labels.quote, mergeData.quoteNumber, mergeData.quoteTotal],
    [labels.invoice, mergeData.invoiceNumber, mergeData.invoiceTotal],
  ].filter(([, num]) => num);

  if (rows.length === 0) return "";

  return `<table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="width:100%;border-collapse:collapse;margin:0 0 22px 0;background:${theme.bg};border:1px solid ${theme.border};border-radius:10px;">
      ${rows
        .map(
          ([label, num, total]) => `
        <tr>
          <td style="padding:14px 16px;font-size:13px;color:${theme.muted};">${escapeHtml(label)} ${escapeHtml(num)}</td>
          <td style="padding:14px 16px;font-size:16px;color:${theme.text};font-weight:700;text-align:right;white-space:nowrap;">${escapeHtml(total)}</td>
        </tr>`,
        )
        .join("")}
    </table>`;
}

// Itemized version: one row per stored line, grouped the way the document
// groups them.
//
// mergeData.lineItems is the object lib/email/templateLineItems.js builds —
// { language, currency, groups: [{ label, subtotal, items }], totals } — from
// the quote's scope groups or the invoice's own lines. Every send path that
// can name a document (the follow-up cron, for a quote or an invoice) builds
// it with those helpers; the editor preview and the test send build it from
// the same helper's sample, so the preview is the send's shape.
//
// Lines are read in the shape they are STORED in: description, detail,
// quantity, rate, amount. This used to read name / unitPrice / total, which
// no stored line has. The preview fed it its own fixture in that shape; the
// cron renamed an invoice's lines into it (with "$" and English labels
// whatever the document said) and, for a quote, read Quote.lineItems — a
// column the builder does not write — so a quote chase drew nothing.
//
// `unit` is deliberately not printed. It is a code the builder writes
// ("flat", "each", "sqft"), not a translated word, and no client-facing
// document prints it — the PDF, the approval page and the quote email all
// show "× quantity" and the amount. Printing "flat" in a French email would
// be the one place the covering note is in a different language from the
// document it covers.
//
// Anything that is not that object — nothing, or an array from a caller
// that never built one — renders nothing at all, not an empty shell. So a
// template carrying this block still reads as intentional on an email with
// no document behind it (a lead chase, a campaign), and the editor says so
// beside the block.
function renderLineItems(block, mergeData, theme) {
  const doc = mergeData.lineItems;
  if (!doc || typeof doc !== "object" || Array.isArray(doc)) return "";
  // A group draws when it has a line or a name. A named group with no visible
  // line is the blended import whose single line repeats its head
  // (scopeGroupDisplay.js) — the head row carries its figure.
  const hasLine = (g) => Array.isArray(g.items) && g.items.some((it) => it && typeof it === "object");
  const groups = (Array.isArray(doc.groups) ? doc.groups : []).filter(
    (g) => g && (hasLine(g) || (g.label && Number(g.subtotal) > 0)),
  );
  if (groups.length === 0) return "";

  const showQty = block.showQuantity !== false;
  const showUnit = block.showUnitPrice !== false;
  const showSub = block.showSubtotals !== false;
  // Two columns always — the totals ladder is label + figure whatever the
  // toggles say — so with line totals off, the description spans both
  // rather than squeezing into the left half of an emptier table.
  const span = showSub ? "" : ` colspan="2"`;

  // The DOCUMENT's language and the company's currency — the same two
  // arguments the PDF, the approval page and the quote email format with, so
  // "4 250,00 $" in a French quote is "4 250,00 $" in its follow-up too.
  const labels = documentLabels(doc.language || "en");
  const { money, locale } = documentFormatters(doc.language || "en", doc.currency);
  const fmtQty = (q) => {
    try {
      return new Intl.NumberFormat(locale, { maximumFractionDigits: 2 }).format(q);
    } catch {
      return String(q);
    }
  };
  const finite = (v) => v !== null && v !== undefined && v !== "" && Number.isFinite(Number(v));

  const cellTop = `border-top:1px solid ${theme.border};`;

  const lineRow = (item) => {
    if (!item || typeof item !== "object") return "";
    const description = String(item.description ?? item.title ?? "");
    // An unpriced text block (lib/quotes/textBlocks.js) has no amount cell on
    // the PDF or the approval page — "Exclusions … $0.00" would be the email
    // saying a number the document does not. Same test they use.
    const priced = lineShowsAmount(item);
    if (!description && !priced) return "";

    const qty = finite(item.quantity) ? Number(item.quantity) : null;
    // A stored line without a rate is read the way the builder reopens it
    // (lib/quotes/builderPayload.js lineItemsFromStored): amount ÷ quantity.
    const rate = !priced
      ? null
      : finite(item.rate)
        ? Number(item.rate)
        : finite(item.amount) && qty
          ? Number(item.amount) / qty
          : null;

    // "24 × $125.00" says quantity and unit price without a word that needs
    // translating; with one toggle off it falls back to the document's own
    // "Qty" label, or to the rate alone.
    const meta = !priced
      ? ""
      : showQty && showUnit && qty !== null && rate !== null
        ? `${escapeHtml(fmtQty(qty))} × ${escapeHtml(money(rate))}`
        : showQty && qty !== null
          ? `${escapeHtml(labels.qty)} ${escapeHtml(fmtQty(qty))}`
          : showUnit && rate !== null
            ? `@ ${escapeHtml(money(rate))}`
            : "";

    // `detail` is the line's stored scope paragraph in the rich-text subset;
    // richTextToHtml escapes every character of it and emits only its own
    // tags. Ink is the theme's measured text colour, not the accent, so a
    // link in it cannot vanish on a pale brand.
    const detail = item.detail
      ? `<div style="font-size:12px;line-height:1.5;color:${theme.muted};margin-top:4px;">${richTextToHtml(String(item.detail).trim(), { linkColor: theme.text })}</div>`
      : "";

    const amount = showSub
      ? `<td style="padding:12px 16px;${cellTop}text-align:right;font-size:14px;font-weight:700;color:${theme.text};white-space:nowrap;vertical-align:top;">${priced ? escapeHtml(money(item.amount)) : ""}</td>`
      : "";

    return `<tr>
        <td${span} style="padding:12px 16px;${cellTop}vertical-align:top;">
          <div style="font-size:14px;font-weight:600;color:${theme.text};">${escapeHtml(description)}</div>
          ${detail}
          ${meta ? `<div style="font-size:12px;color:${theme.muted};margin-top:3px;">${meta}</div>` : ""}
        </td>
        ${amount}
      </tr>`;
  };

  const body = groups
    .map((g) => {
      // A labelled group is a trade the document names; the unlabelled bucket
      // (a hand-raised invoice, or lines that match no trade) draws with no
      // heading rather than an invented one — documentGroups.js's rule.
      const head = g.label
        ? `<tr>
        <td${span} style="padding:14px 16px 6px;${cellTop}font-size:13px;font-weight:700;color:${theme.text};">${escapeHtml(g.label)}</td>
        ${showSub ? `<td style="padding:14px 16px 6px;${cellTop}text-align:right;font-size:13px;font-weight:700;color:${theme.text};white-space:nowrap;">${Number(g.subtotal) > 0 ? escapeHtml(money(g.subtotal)) : ""}</td>` : ""}
      </tr>`
        : "";
      return head + (Array.isArray(g.items) ? g.items : []).map(lineRow).join("");
    })
    .join("");

  // Totals ladder — only the rows that have a value, so a job with no
  // discount doesn't show a "$0.00 discount" line, and a document whose tax
  // is nil or unresolved states nothing here rather than "$0.00" (see
  // lib/tax/documentTax.js on why a zero is a statement).
  const totals = doc.totals || {};
  const pos = (v) => finite(v) && Number(v) > 0;
  const totalsRows = [
    [labels.subtotal, totals.subtotal, false, false],
    [labels.discount, totals.discount, false, true],
    [labels.tax, totals.tax, false, false],
    [labels.total, totals.total, true, false],
  ]
    .filter(([, v]) => pos(v))
    .map(([label, value, strong, negative]) => {
      const cell = `padding:${strong ? "12px 16px" : "6px 16px"};font-size:${strong ? 15 : 13}px;color:${strong ? theme.text : theme.muted};font-weight:${strong ? 700 : 400};${strong ? `border-top:1px solid ${theme.border};` : ""}`;
      return `<tr>
        <td style="${cell}">${escapeHtml(label)}</td>
        <td style="${cell}text-align:right;white-space:nowrap;">${negative ? "-" : ""}${escapeHtml(money(value))}</td>
      </tr>`;
    })
    .join("");

  // Section title carries the secondary brand colour — the one place a second
  // hue reads as intentional rather than noisy.
  const title = block.title === DEFAULT_LINE_ITEMS_TITLE ? labels.whatsIncluded : block.title;
  const heading = title
    ? `<div style="padding:14px 16px 0;font-size:12px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;color:${theme.secondary};">${applyMergeFields(title, mergeData)}</div>`
    : "";

  return `<table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="width:100%;border-collapse:collapse;margin:0 0 22px 0;border:1px solid ${theme.border};border-radius:10px;background:${theme.card};">
      ${heading ? `<tr><td colspan="2">${heading}</td></tr>` : ""}
      ${body}
      ${totalsRows}
    </table>`;
}

// Horizontal stage tracker for the project lifecycle:
// Quote → Deposit & scheduling → Project start → Project complete.
// Rendered as a single-row table of equal-width cells — the one layout that
// behaves in Outlook. Each cell is a filled or unfilled bar plus a label.
function renderProgress(block, mergeData, theme, language) {
  const words = emailCopy(language).templateBlocks;
  const stages = (
    Array.isArray(block.stages) && block.stages.length
      ? block.stages
      : ["Quote", "Deposit & scheduling", "Project start", "Project complete"]
  ).map((label) => stageLabel(label, words));

  // At send time the stage comes from the record's status via the
  // {{progressStage}} merge field; in the editor the company picks a fixed
  // index so they can see how each state looks.
  const fromMerge = Number(mergeData.progressStage);
  const activeIndex =
    block.useMergeField !== false && Number.isFinite(fromMerge)
      ? fromMerge
      : Number(block.activeStage) || 0;

  const width = (100 / stages.length).toFixed(4);

  const cells = stages
    .map((label, i) => {
      const done = i <= activeIndex;
      return `<td align="center" valign="top" style="width:${width}%;vertical-align:top;">
        <div style="height:6px;background:${done ? theme.accent : theme.track};border-radius:3px;margin:0 2px 9px;font-size:1px;line-height:6px;">&nbsp;</div>
        <div style="font-size:12px;font-weight:700;color:${theme.text};line-height:1.35;padding:0 4px;">${escapeHtml(label)}</div>
        <div style="font-size:11px;color:${done ? theme.done : theme.pending};margin-top:3px;">${escapeHtml(done ? words.done : words.pending)}</div>
      </td>`;
    })
    .join("");

  return `<table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="width:100%;margin:6px 0 24px;"><tr>${cells}</tr></table>`;
}

// ── Shell ───────────────────────────────────────────────────────────────

function renderHeader(theme) {
  if (!theme.showHeader) return "";

  // Logo when the company has uploaded one, otherwise a letter-spaced
  // wordmark in the accent colour — the Sunset treatment, which reads as
  // deliberate branding rather than a missing-image placeholder.
  const inner = theme.logoUrl
    ? `<img src="${escapeAttr(theme.logoUrl)}" alt="${escapeAttr(theme.companyName)}" height="34" style="height:34px;width:auto;max-width:220px;border:0;display:block;" />`
    : `<span style="color:${theme.accent};font-size:13px;font-weight:700;letter-spacing:0.18em;text-transform:uppercase;">${escapeHtml(theme.companyName)}</span>`;

  return `<tr><td style="background:${theme.headerBg};padding:22px 30px;">${inner}</td></tr>`;
}

function renderFooter(theme) {
  if (!theme.showFooter) return "";

  const lines = [
    theme.companyName
      ? `<div style="font-weight:700;color:${theme.text};font-size:12px;">${escapeHtml(theme.companyName)}</div>`
      : "",
    theme.footerAddress
      ? `<div style="margin-top:3px;">${escapeHtml(theme.footerAddress)}</div>`
      : "",
    theme.footerContact
      ? `<div style="margin-top:3px;">${escapeHtml(theme.footerContact)}</div>`
      : "",
  ]
    .filter(Boolean)
    .join("");

  return `<tr><td style="background:${theme.bg};border-top:1px solid ${theme.border};padding:20px 30px;font-size:11px;line-height:1.6;color:${theme.muted};">${lines}</td></tr>`;
}

// The language FieldQuo's own words in this email are printed in. The send
// path says (options.language); failing that, the itemised block's document
// language — the only other place a language is recorded — and then English.
function emailLanguage(options = {}, mergeData = {}) {
  return options.language || mergeData?.lineItems?.language || "en";
}

/**
 * sections → full HTML document.
 *
 * @param {Array}  sections  DocumentTemplate.sections
 * @param {object} mergeData {{token}} values, plus `lineItems` (the object
 *                           lib/email/templateLineItems.js builds) and
 *                           `progressStage` (number) for the richer blocks
 * @param {object} options   { preview?: boolean, company?: object, theme?: object,
 *                             language?: string,
 *                             unsubscribe?: { token: string, request?: Request } }
 *                           `language` is the email's language — the document's
 *                           for a quote or invoice follow-up, else the
 *                           client's (lib/i18n/clientLanguage.js). It governs
 *                           only the words FieldQuo prints; see the note above
 *                           renderBlock.
 *                           `company` is the Company row (name/logoUrl/
 *                           brandColor/contact); `theme` is the template's
 *                           per-template override (DocumentTemplate.theme).
 *                           `unsubscribe` is passed ONLY by commercial send
 *                           paths (marketing campaigns, "job completed"
 *                           follow-ups) — see lib/marketing/unsubscribe.js for
 *                           which sends that is and why. Omitted (the default,
 *                           and every OTHER caller of this shared shell — a
 *                           quote follow-up, an overdue-invoice follow-up, the
 *                           editor's preview) renders with no unsubscribe row
 *                           at all, because CASL doesn't require one on a
 *                           transactional message and adding one anyway would
 *                           be its own defect.
 */
export function renderTemplateSections(sections = [], mergeData = {}, options = {}) {
  const theme = resolveTheme(options.company || {}, options.theme || null);
  const language = emailLanguage(options, mergeData);

  const body = (Array.isArray(sections) ? sections : [])
    .map((block) => renderBlock(block, mergeData, theme, language))
    .join("\n");

  // The resolved language rides into the shell so the unsubscribe line
  // speaks the same language as the blocks above it.
  return emailShell({ theme, body, options: { ...options, language } });
}

/**
 * The document around a body: header, the 600px card, footer, and the
 * unsubscribe row when the send is commercial.
 *
 * Exported so the canvas compiler (lib/email/canvasEmail.js) pours its output
 * into the SAME shell. That is what makes "the canvas keeps the footer and
 * the unsubscribe block" a property of the code rather than a promise: there
 * is one shell, both modes use it, and neither can leave the legal row out.
 *
 * @param theme   from resolveTheme()
 * @param body    the inner HTML of the 30px-padded body cell
 * @param options the same options renderTemplateSections takes
 */
export function emailShell({ theme, body = "", options = {} }) {
  // Editor preview only. The preview is an <iframe srcDoc>, and the sample
  // merge data points CTAs at placeholder URLs (https://example.com/...).
  // A click would navigate the iframe's own browsing context away from the
  // preview — stranding the user on IANA's "Example Domain" page with no way
  // back, because srcDoc is only re-written when `sections` changes. Making
  // links inert keeps the frame showing the email. Real sends never pass
  // `preview`, so their links stay live.
  const previewStyles = options.preview
    ? `<style>a{pointer-events:none !important;cursor:default !important;}</style>`
    : "";

  return `<!DOCTYPE html>
<html>
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width,initial-scale=1" />
    <meta name="color-scheme" content="light only" />
    ${previewStyles}
  </head>
  <body style="margin:0;padding:24px 12px;background:${theme.bg};font-family:${theme.font};color:${theme.text};-webkit-font-smoothing:antialiased;">
    <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="background:${theme.bg};">
      <tr>
        <td align="center">
          <table width="600" cellpadding="0" cellspacing="0" role="presentation" style="width:100%;max-width:600px;background:${theme.card};border:1px solid ${theme.border};border-radius:10px;overflow:hidden;">
            ${renderHeader(theme)}
            <tr><td style="padding:30px;">
${body}
            </td></tr>
            ${renderFooter(theme)}
            ${options.unsubscribe?.token ? unsubscribeFooterRow({ token: options.unsubscribe.token, request: options.unsubscribe.request, theme, language: emailLanguage(options) }) : ""}
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}

// Subject lines support the same {{tokens}} as the body. Exported separately
// because the send paths need the subject before they build the HTML.
export function renderSubject(subject, mergeData = {}, fallback = "") {
  const out = String(subject ?? "")
    .replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (_, token) =>
      String(mergeData[token] ?? ""),
    )
    .trim();
  return out || fallback;
}
