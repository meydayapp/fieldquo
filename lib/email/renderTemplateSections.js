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
  contrastText,
} from "./emailTheme.js";

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

function renderBlock(block, mergeData, theme) {
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
      const bg = safeColor(block.bg, theme.accent);
      // If the company never picked a text colour, derive one that's actually
      // readable on their chosen button colour.
      const color = safeColor(block.color, contrastText(bg));
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
      return renderSummary(mergeData, theme);

    case "lineItems":
      return renderLineItems(block, mergeData, theme);

    case "progress":
      return renderProgress(block, mergeData, theme);

    default:
      return "";
  }
}

// Compact version: document number + grand total only.
function renderSummary(mergeData, theme) {
  const rows = [
    ["Quote", mergeData.quoteNumber, mergeData.quoteTotal],
    ["Invoice", mergeData.invoiceNumber, mergeData.invoiceTotal],
  ].filter(([, num]) => num);

  if (rows.length === 0) return "";

  return `<table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="width:100%;border-collapse:collapse;margin:0 0 22px 0;background:${theme.bg};border:1px solid ${theme.border};border-radius:10px;">
      ${rows
        .map(
          ([label, num, total]) => `
        <tr>
          <td style="padding:14px 16px;font-size:13px;color:${theme.muted};">${label} #${escapeHtml(num)}</td>
          <td style="padding:14px 16px;font-size:16px;color:${theme.text};font-weight:700;text-align:right;white-space:nowrap;">${escapeHtml(total)}</td>
        </tr>`,
        )
        .join("")}
    </table>`;
}

// Itemized version: one row per line, driven by mergeData.lineItems (which
// the send paths populate from Quote.lineItems / Invoice.lineItems — both
// `Json?` columns). Falls back to rendering nothing rather than an empty
// shell, so a template carrying this block still looks intentional on an
// email that has no line items (a plain follow-up, say).
function renderLineItems(block, mergeData, theme) {
  const items = Array.isArray(mergeData.lineItems) ? mergeData.lineItems : [];
  if (items.length === 0) return "";

  const showQty = block.showQuantity !== false;
  const showUnit = block.showUnitPrice !== false;
  const showSub = block.showSubtotals !== false;

  const money = (v) =>
    typeof v === "number"
      ? `$${v.toFixed(2)}`
      : escapeHtml(v ?? "");

  const rows = items
    .map((item) => {
      const meta = [
        showQty && item.quantity != null ? `Qty ${escapeHtml(item.quantity)}` : "",
        showUnit && item.unitPrice != null ? `${money(item.unitPrice)} each` : "",
      ]
        .filter(Boolean)
        .join("  ·  ");

      const cellTop = `border-top:1px solid ${theme.border};`;

      const lineTotal =
        showSub && item.total != null
          ? `<td style="padding:12px 16px;${cellTop}text-align:right;font-size:14px;font-weight:700;color:${theme.text};white-space:nowrap;vertical-align:top;">${money(item.total)}</td>`
          : "";

      return `<tr>
        <td style="padding:12px 16px;${cellTop}vertical-align:top;">
          <div style="font-size:14px;font-weight:600;color:${theme.text};">${escapeHtml(item.name || item.description || "")}</div>
          ${meta ? `<div style="font-size:12px;color:${theme.muted};margin-top:3px;">${meta}</div>` : ""}
        </td>
        ${lineTotal}
      </tr>`;
    })
    .join("");

  // Totals ladder — only the rows that have a value, so a job with no
  // discount doesn't show a "$0.00 discount" line.
  const totalsRows = [
    ["Subtotal", mergeData.subtotal, false],
    ["Discount", mergeData.discount, false],
    ["Tax", mergeData.tax, false],
    ["Total", mergeData.quoteTotal || mergeData.invoiceTotal, true],
  ]
    .filter(([, v]) => v)
    .map(
      ([label, value, strong]) => `<tr>
        <td style="padding:${strong ? "12px 16px" : "6px 16px"};font-size:${strong ? 15 : 13}px;color:${strong ? theme.text : theme.muted};font-weight:${strong ? 700 : 400};${strong ? `border-top:1px solid ${theme.border};` : ""}">${label}</td>
        <td style="padding:${strong ? "12px 16px" : "6px 16px"};font-size:${strong ? 15 : 13}px;color:${strong ? theme.text : theme.muted};font-weight:${strong ? 700 : 400};text-align:right;white-space:nowrap;${strong ? `border-top:1px solid ${theme.border};` : ""}">${escapeHtml(value)}</td>
      </tr>`,
    )
    .join("");

  // Section title carries the secondary brand colour — the one place a second
  // hue reads as intentional rather than noisy.
  const heading = block.title
    ? `<div style="padding:14px 16px 0;font-size:12px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;color:${theme.secondary};">${applyMergeFields(block.title, mergeData)}</div>`
    : "";

  return `<table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="width:100%;border-collapse:collapse;margin:0 0 22px 0;border:1px solid ${theme.border};border-radius:10px;background:${theme.card};">
      ${heading ? `<tr><td colspan="2">${heading}</td></tr>` : ""}
      ${rows}
      ${totalsRows}
    </table>`;
}

// Horizontal stage tracker for the project lifecycle:
// Quote → Deposit & scheduling → Project start → Project complete.
// Rendered as a single-row table of equal-width cells — the one layout that
// behaves in Outlook. Each cell is a filled or unfilled bar plus a label.
function renderProgress(block, mergeData, theme) {
  const stages =
    Array.isArray(block.stages) && block.stages.length
      ? block.stages
      : ["Quote", "Deposit & scheduling", "Project start", "Project complete"];

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
        <div style="font-size:11px;color:${done ? theme.done : theme.pending};margin-top:3px;">${done ? "Done" : "Pending"}</div>
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

/**
 * sections → full HTML document.
 *
 * @param {Array}  sections  DocumentTemplate.sections
 * @param {object} mergeData {{token}} values, plus `lineItems` (array) and
 *                           `progressStage` (number) for the richer blocks
 * @param {object} options   { preview?: boolean, company?: object, theme?: object }
 *                           `company` is the Company row (name/logoUrl/
 *                           brandColor/contact); `theme` is the template's
 *                           per-template override (DocumentTemplate.theme).
 */
export function renderTemplateSections(sections = [], mergeData = {}, options = {}) {
  const theme = resolveTheme(options.company || {}, options.theme || null);

  const body = (Array.isArray(sections) ? sections : [])
    .map((block) => renderBlock(block, mergeData, theme))
    .join("\n");

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
