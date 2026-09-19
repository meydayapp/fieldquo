// lib/email/canvasEmail.js
//
// Turns a canvas design — the designer's fabric document — into email HTML.
//
// ── Why a compiler and not a screenshot ─────────────────────────────────────
//
// The ad designer (app/app/marketing/designer) rasterises: a social post is a
// picture. An email cannot be one. A picture-email is clipped by Gmail, blocked
// by Outlook until the reader clicks "show images", unreadable to a screen
// reader, and — the reason that matters here — it cannot carry a merge field.
// "{{clientName}}" painted into a PNG is the letters, not the name. So the
// canvas is read as OBJECTS and written out as the same table-and-inline-style
// HTML the block editor produces, with the text still text.
//
// ── Banding ─────────────────────────────────────────────────────────────────
//
// A canvas is a bag of boxes with x and y. Email has no `position`. The
// translation, borrowed from the owner's other product (Sunset Space's
// compile-email), is BANDING:
//
//   * objects whose vertical extents overlap form one band → one <tr>;
//   * inside a band, objects whose horizontal extents do not overlap form
//     columns → one <td> each, in x order;
//   * a column holding several objects is banded again, recursively;
//   * objects that overlap in BOTH axes cannot both exist in email. A shape
//     that CONTAINS the others becomes their coloured background cell — that
//     is what "text on a band" is — and anything else is stacked in stacking
//     order and named in a warning, because the alternative is a silent
//     approximation the company only discovers in a homeowner's inbox.
//
// Geometry is scaled so the artboard's width maps onto the shell's body
// width. TYPE IS NOT SCALED (also Sunset's rule): 16px shrunk to 9px because
// the artboard was wide is unreadable. The email canvas opens at EMAIL_CANVAS
// (600 wide) so the scale is 1 and the artboard is a true picture.
//
// ── Contrast is measured ────────────────────────────────────────────────────
//
// Every text layer's ink is measured against the ground it actually sits on
// (its container's fill, else the page), with lib/brand/colour.js's
// contrastRatio — the same arithmetic lib/documents/theme.js uses. A pair
// under 4.5:1 is stepped toward readable with ensureContrast and the layer is
// named in `warnings`, so the designer keeps its colour intent where that is
// possible and the client can read the email where it is not.
//
// ── Pure ────────────────────────────────────────────────────────────────────
//
// No fabric, no DOM, no I/O. scripts/check-canvas-email.mjs executes this
// against hostile documents. The shell (header, footer, unsubscribe row) is
// lib/email/renderTemplateSections.js's emailShell — the same one the block
// mode uses, so the canvas cannot leave the legal row out.

import { resolveTheme, escapeHtml, escapeAttr, safeUrl, safeColor } from "./emailTheme.js";
import { applyMergeFields, emailShell } from "./renderTemplateSections.js";
import { contrastRatio, ensureContrast, accessiblePair } from "@/lib/brand/colour";

/** The artboard an email canvas opens on. 600 is the width mail clients agree on. */
export const EMAIL_CANVAS = Object.freeze({ width: 600, height: 800 });

// emailShell's body cell is the 600px card less 30px padding a side.
const SHELL_BODY_WIDTH = 540;

// Same number as the editor's snap threshold: the editor snapped two objects
// into a row, so the compiler must agree they are one.
const BAND_TOLERANCE = 5;

const TEXT_TYPES = new Set(["textbox", "i-text", "text"]);
const SHAPE_TYPES = new Set(["rect", "circle", "triangle", "ellipse", "polygon"]);

const num = (v, d = 0) => (Number.isFinite(Number(v)) ? Number(v) : d);

function parseDoc(doc) {
  if (!doc) return null;
  if (typeof doc === "string") {
    try {
      return JSON.parse(doc);
    } catch {
      return null;
    }
  }
  return typeof doc === "object" ? doc : null;
}

/**
 * Every object as an axis-aligned box relative to the workspace, with the
 * fields the emitters read. Rotation is not expressible in email; the box is
 * the unrotated one and the layer is named in a warning.
 */
function readObjects(objects, warnings) {
  const ws = objects.find((o) => o?.name === "clip");
  const origin = { x: num(ws?.left), y: num(ws?.top) };
  const width = Math.max(1, num(ws?.width, EMAIL_CANVAS.width) * num(ws?.scaleX, 1));
  const height = Math.max(1, num(ws?.height, EMAIL_CANVAS.height) * num(ws?.scaleY, 1));
  const ground = safeColor(typeof ws?.fill === "string" ? ws.fill : null, "#ffffff");

  const items = [];
  objects.forEach((o, index) => {
    if (!o || o === ws || o.visible === false) return;
    const type = String(o.type || "").toLowerCase();
    const sx = num(o.scaleX, 1);
    const sy = num(o.scaleY, 1);
    const box = {
      x: num(o.left) - origin.x,
      y: num(o.top) - origin.y,
      w: Math.max(1, num(o.width) * sx),
      h: Math.max(1, num(o.height) * sy),
    };
    const label = TEXT_TYPES.has(type)
      ? `"${String(o.text || "").slice(0, 24)}"`
      : `${type} #${index + 1}`;
    if (Math.abs(num(o.angle)) > 2) {
      warnings.push({ layer: label, kind: "rotation", message: `${label} is rotated; email draws it straight.` });
    }
    if (TEXT_TYPES.has(type)) {
      items.push({
        id: index,
        kind: "text",
        label,
        box,
        text: String(o.text || ""),
        fontSize: Math.round(num(o.fontSize, 16) * sy),
        fontFamily: String(o.fontFamily || "Arial"),
        fontWeight: o.fontWeight === "bold" || num(o.fontWeight) >= 600 ? 700 : 400,
        italic: o.fontStyle === "italic",
        underline: Boolean(o.underline),
        align: ["center", "right"].includes(o.textAlign) ? o.textAlign : "left",
        lineHeight: num(o.lineHeight, 1.16),
        fill: typeof o.fill === "string" ? o.fill : null,
        opacity: num(o.opacity, 1),
        link: o.linkData?.url ? String(o.linkData.url) : null,
      });
      return;
    }
    if (type === "image") {
      const src = safeUrl(o.src);
      if (!src) {
        warnings.push({ layer: label, kind: "image", message: `${label} has no usable image address and was left out.` });
        return;
      }
      items.push({ id: index, kind: "image", label, box, src, alt: String(o.alt || ""), link: o.linkData?.url ? String(o.linkData.url) : null });
      return;
    }
    if (SHAPE_TYPES.has(type)) {
      items.push({
        id: index,
        kind: "shape",
        label,
        box,
        fill: typeof o.fill === "string" ? o.fill : null,
        round: type === "circle" || type === "ellipse",
        stroke: typeof o.stroke === "string" ? o.stroke : null,
        strokeWidth: num(o.strokeWidth),
        link: o.linkData?.url ? String(o.linkData.url) : null,
      });
      if (type === "triangle" || type === "polygon") {
        warnings.push({ layer: label, kind: "shape", message: `${label} is drawn as a rectangle; email has no ${type}.` });
      }
      return;
    }
    // Free-drawn paths, groups, lines: nothing in email stands in for them.
    warnings.push({ layer: label, kind: "unsupported", message: `${label} (${type || "unknown"}) cannot be expressed in email and was left out.` });
  });

  return { width, height, ground, items };
}

const right = (b) => b.x + b.w;
const bottom = (b) => b.y + b.h;

function contains(outer, inner, tol = 1) {
  return (
    inner.x >= outer.x - tol &&
    inner.y >= outer.y - tol &&
    right(inner) <= right(outer) + tol &&
    bottom(inner) <= bottom(outer) + tol
  );
}

/**
 * Shapes that enclose other objects become containers. Each object is given
 * to the SMALLEST shape that contains it, so a band inside a panel nests.
 */
function buildTree(items) {
  const shapes = items.filter((i) => i.kind === "shape");
  const area = (i) => i.box.w * i.box.h;
  const nodes = items.map((i) => ({ item: i, children: [] }));
  const byId = new Map(nodes.map((n) => [n.item.id, n]));
  const roots = [];
  for (const n of nodes) {
    const parent = shapes
      .filter((s) => s.id !== n.item.id && contains(s.box, n.item.box) && area(s) > area(n.item))
      .sort((a, b) => area(a) - area(b))[0];
    if (parent) byId.get(parent.id).children.push(n);
    else roots.push(n);
  }
  return roots;
}

/** Transitive runs along one axis: [start, end] pairs that overlap chain together. */
function runs(nodes, start, end) {
  const sorted = [...nodes].sort((a, b) => start(a) - start(b) || a.item.id - b.item.id);
  const out = [];
  for (const n of sorted) {
    const last = out[out.length - 1];
    if (last && start(n) < last.end - BAND_TOLERANCE) {
      last.nodes.push(n);
      last.end = Math.max(last.end, end(n));
    } else {
      out.push({ nodes: [n], start: start(n), end: end(n) });
    }
  }
  return out;
}

/**
 * Nodes → rows of columns, recursively. A column with several nodes that
 * cannot be separated on either axis is a "stack": emitted top to bottom in
 * stacking order and reported.
 */
export function tabulate(nodes, warnings, depth = 0) {
  if (depth > 12) return [];
  const bands = runs(nodes, (n) => n.item.box.y, (n) => bottom(n.item.box));
  return bands.map((band) => {
    const columns = runs(band.nodes, (n) => n.item.box.x, (n) => right(n.item.box));
    return {
      top: band.start,
      bottom: band.end,
      columns: columns.map((col) => {
        if (col.nodes.length === 1) {
          return { left: col.start, right: col.end, node: col.nodes[0] };
        }
        // Several in one column: band them again. If that yields ONE band
        // holding everything, they overlap both ways and are stacked.
        const inner = runs(col.nodes, (n) => n.item.box.y, (n) => bottom(n.item.box));
        if (inner.length === 1 && inner[0].nodes.length === col.nodes.length) {
          const stacked = [...col.nodes].sort((a, b) => a.item.id - b.item.id);
          warnings.push({
            layer: stacked.map((n) => n.item.label).join(", "),
            kind: "overlap",
            message: `${stacked.map((n) => n.item.label).join(" and ")} overlap; email shows them one under the other.`,
          });
          return { left: col.start, right: col.end, stack: stacked };
        }
        return { left: col.start, right: col.end, rows: tabulate(col.nodes, warnings, depth + 1) };
      }),
    };
  });
}

// ── Emitters ────────────────────────────────────────────────────────────────

const FONT_STACKS = {
  arial: "Arial,Helvetica,sans-serif",
  helvetica: "Helvetica,Arial,sans-serif",
  georgia: "Georgia,'Times New Roman',serif",
  "times new roman": "'Times New Roman',Times,serif",
  verdana: "Verdana,Geneva,sans-serif",
  tahoma: "Tahoma,Geneva,sans-serif",
  "trebuchet ms": "'Trebuchet MS',Helvetica,sans-serif",
  "courier new": "'Courier New',Courier,monospace",
};

function fontStack(name, warnings, label) {
  const key = String(name || "").toLowerCase();
  if (FONT_STACKS[key]) return FONT_STACKS[key];
  // A web font the designer offers cannot be loaded by a mail client; say so
  // once per layer and draw the nearest thing every client has.
  warnings.push({ layer: label, kind: "font", message: `${label} uses ${name}, which mail clients cannot load; Arial is drawn instead.` });
  return FONT_STACKS.arial;
}

function linkAttrs(url, mergeData, preview) {
  if (!url) return null;
  // A merge token at the START of a link is the quote/invoice link, filled
  // by the send path. Anywhere else, or anything that is not https/mailto/
  // tel, is refused — "javascript:{{x}}" also contains a token.
  const raw = String(url).replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (_, tok) => String(mergeData[tok] ?? ""));
  const safe = safeUrl(raw);
  if (!safe) return null;
  return `href="${escapeAttr(safe)}"${preview ? "" : ' target="_blank" rel="noopener noreferrer"'}`;
}

function textCss(item, stack, ink) {
  const lh = Math.round(item.fontSize * Math.max(1, item.lineHeight));
  return [
    `margin:0`,
    `font-family:${stack}`,
    `font-size:${item.fontSize}px`,
    `line-height:${lh}px`,
    `font-weight:${item.fontWeight}`,
    item.italic ? "font-style:italic" : "",
    item.underline ? "text-decoration:underline" : "",
    `color:${ink}`,
    `text-align:${item.align}`,
  ]
    .filter(Boolean)
    .join(";");
}

/**
 * The ink a text layer is drawn in: its own fill, measured against its
 * ground and stepped only when it has to be.
 */
function readableInk(fill, ground, warnings, label) {
  const wanted = safeColor(fill, "#1a1917");
  const bg = safeColor(ground, "#ffffff");
  const ratio = contrastRatio(wanted, bg);
  if (ratio >= 4.5) return wanted;
  // Step the ink first (keeps the hue), then fall back to whichever pure end
  // wins: ensureContrast's own dark endpoint is the brand navy, which is
  // 4.43:1 on a mid grey — close, and not enough.
  let fixed = ensureContrast(wanted, bg, 4.5);
  if (contrastRatio(fixed, bg) < 4.5) {
    fixed = contrastRatio("#000000", bg) >= contrastRatio("#ffffff", bg) ? "#000000" : "#ffffff";
  }
  warnings.push({
    layer: label,
    kind: "contrast",
    message: `${label}: ${wanted} on ${bg} measures ${ratio.toFixed(2)}:1; drawn as ${fixed} so it reads.`,
  });
  return fixed;
}

/**
 * A container's fill, moved only when NO ink could read on it — the mid-tone
 * case lib/documents/theme.js's fillPair exists for. A yellow band with white
 * text keeps its yellow (the text goes dark); a #777 band that no text can
 * clear 4.5:1 on is deepened until one can, and the layer is named.
 */
function readableGround(fill, node, warnings) {
  const hasText = node.children.some((c) => c.item.kind === "text");
  if (!hasText) return fill;
  const best = Math.max(contrastRatio("#000000", fill), contrastRatio("#ffffff", fill));
  if (best >= 4.5) return fill;
  const pair = accessiblePair(fill, { light: "#ffffff", dark: "#000000", target: 4.5 });
  warnings.push({
    layer: node.item.label,
    kind: "contrast",
    message: `${node.item.label}: no text can read on ${fill} (best ${best.toFixed(2)}:1); drawn as ${pair.bg}.`,
  });
  return pair.bg;
}

function emitText(item, ctx, ground) {
  const stack = fontStack(item.fontFamily, ctx.warnings, item.label);
  const ink = readableInk(item.fill, ground, ctx.warnings, item.label);
  if (item.fontSize > 40) {
    ctx.warnings.push({ layer: item.label, kind: "bigType", message: `${item.label} is ${item.fontSize}px; anything over 40px wraps badly on a phone.` });
  }
  // Escaped BEFORE the merge: text typed on a canvas is literal — a company
  // that writes "<3" meant a heart, not a tag. Block text is company-authored
  // HTML by long-standing convention; canvas text never was.
  const body = applyMergeFields(escapeHtml(item.text), ctx.mergeData).replace(/\n/g, "<br />");
  const link = ctx.insideLink ? null : linkAttrs(item.link, ctx.mergeData, ctx.preview);
  const inner = link ? `<a ${link} style="color:${ink};text-decoration:underline;">${body}</a>` : body;
  return `<p style="${textCss(item, stack, ink)}">${inner}</p>`;
}

function emitImage(item, ctx, widthPx) {
  const w = Math.max(1, Math.round(Math.min(widthPx, item.box.w * ctx.scale)));
  const h = Math.max(1, Math.round((item.box.h * ctx.scale * w) / Math.max(1, item.box.w * ctx.scale)));
  const img = `<img src="${escapeAttr(item.src)}" alt="${escapeAttr(item.alt)}" width="${w}" height="${h}" style="width:${w}px;height:${h}px;max-width:100%;display:block;border:0;outline:none;text-decoration:none;-ms-interpolation-mode:bicubic;" />`;
  const link = ctx.insideLink ? null : linkAttrs(item.link, ctx.mergeData, ctx.preview);
  return link ? `<a ${link}>${img}</a>` : img;
}

function emitNode(node, ctx, ground, widthPx) {
  const { item } = node;
  if (item.kind === "text") return emitText(item, ctx, ground);
  if (item.kind === "image") return emitImage(item, ctx, widthPx);
  // A shape: a coloured cell, with its children banded inside it. An empty
  // shape is a coloured block of its own height — a rule, a band, a spacer.
  const fill = readableGround(safeColor(item.fill, ground), node, ctx.warnings);
  const h = Math.max(1, Math.round(item.box.h * ctx.scale));
  const radius = item.round ? `border-radius:${Math.round(Math.min(item.box.w, item.box.h) * ctx.scale) / 2}px;` : "";
  const border = item.stroke && item.strokeWidth > 0 ? `border:${Math.max(1, Math.round(item.strokeWidth * ctx.scale))}px solid ${safeColor(item.stroke, fill)};` : "";
  if (node.children.length === 0) {
    const inner = `<div style="height:${h}px;line-height:${h}px;font-size:1px;">&nbsp;</div>`;
    const link = linkAttrs(item.link, ctx.mergeData, ctx.preview);
    return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:separate;width:100%;"><tr><td bgcolor="${fill}" style="background-color:${fill};${radius}${border}">${link ? `<a ${link} style="display:block;">${inner}</a>` : inner}</td></tr></table>`;
  }
  // Padding inside the shape: where its first/last child sit relative to it.
  const kids = node.children.map((c) => c.item.box);
  const padTop = Math.max(0, Math.round((Math.min(...kids.map((b) => b.y)) - item.box.y) * ctx.scale));
  const padBottom = Math.max(0, Math.round((bottom(item.box) - Math.max(...kids.map(bottom))) * ctx.scale));
  const padLeft = Math.max(0, Math.round((Math.min(...kids.map((b) => b.x)) - item.box.x) * ctx.scale));
  const padRight = Math.max(0, Math.round((right(item.box) - Math.max(...kids.map(right))) * ctx.scale));
  const innerWidth = Math.max(1, widthPx - padLeft - padRight);
  // A linked shape with text in it is a BUTTON: the whole coloured cell is
  // the link and the label is not underlined — the "bulletproof button", the
  // one shape of link Outlook paints padding on. Children inside a link get
  // no link of their own (nested <a> is invalid and mail clients split it).
  const link = ctx.insideLink ? null : linkAttrs(item.link, ctx.mergeData, ctx.preview);
  const innerCtx = link ? { ...ctx, insideLink: true } : ctx;
  const rows = emitRows(tabulate(node.children, ctx.warnings), innerCtx, fill, innerWidth, item.box.x + padLeft / ctx.scale, item.box.y + padTop / ctx.scale, innerWidth / ctx.scale);
  const cell = `<td bgcolor="${fill}" style="background-color:${fill};padding:${padTop}px ${padRight}px ${padBottom}px ${padLeft}px;${radius}${border}">${link ? `<a ${link} style="display:block;text-decoration:none;">${rows}</a>` : rows}</td>`;
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:separate;width:100%;"><tr>${cell}</tr></table>`;
}

function emitColumn(col, ctx, ground, widthPx) {
  if (col.node) return emitNode(col.node, ctx, ground, widthPx);
  if (col.stack) {
    return col.stack.map((n) => emitNode(n, ctx, ground, widthPx)).join("\n");
  }
  return emitRows(col.rows, ctx, ground, widthPx, col.left, null, col.right - col.left);
}

/**
 * Rows → nested tables. `originX`/`spanW` are the band's own frame in canvas
 * units, so column widths are shares of the space the row actually has.
 */
function emitRows(rows, ctx, ground, widthPx, originX = 0, originY = null, spanW = null) {
  const span = spanW || ctx.width;
  let prevBottom = originY;
  return rows
    .map((row) => {
      const gap = prevBottom == null ? 0 : Math.max(0, Math.round((row.top - prevBottom) * ctx.scale));
      prevBottom = row.bottom;
      const cols = row.columns;
      // Column shares from the columns' own extents, each owning the gap on
      // either side of it, as whole percentages that sum to 100.
      const edges = [];
      for (let i = 0; i < cols.length; i++) {
        const l = i === 0 ? originX : (cols[i - 1].right + cols[i].left) / 2;
        const r = i === cols.length - 1 ? originX + span : (cols[i].right + cols[i + 1].left) / 2;
        edges.push({ l, r });
      }
      const total = Math.max(1, edges.reduce((s, e) => s + (e.r - e.l), 0));
      let acc = 0;
      const cells = cols.map((col, i) => {
        const pct = i === cols.length - 1 ? 100 - acc : Math.max(1, Math.round(((edges[i].r - edges[i].l) / total) * 100));
        acc += pct;
        const cellPx = Math.max(1, Math.round((widthPx * pct) / 100));
        const padL = Math.max(0, Math.round((col.left - edges[i].l) * ctx.scale));
        const padR = Math.max(0, Math.round((edges[i].r - col.right) * ctx.scale));
        const inner = emitColumn(col, ctx, ground, Math.max(1, cellPx - padL - padR));
        return `<td width="${pct}%" valign="top" style="width:${pct}%;vertical-align:top;padding:${gap}px ${padR}px 0 ${padL}px;">${inner}</td>`;
      });
      return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;width:100%;"><tr>${cells.join("")}</tr></table>`;
    })
    .join("\n");
}

/**
 * Canvas document → the body HTML (no shell) plus what was lost in translation.
 *
 * @param doc        fabric toJSON() document, or its string
 * @param mergeData  the same {{token}} values the block renderer takes
 * @param options    { preview?: boolean, bodyWidth?: number }
 * @returns {{ body: string, warnings: Array<{layer,kind,message}>, ground: string, empty: boolean }}
 */
export function compileCanvasBody(doc, mergeData = {}, options = {}) {
  const warnings = [];
  const parsed = parseDoc(doc);
  const objects = Array.isArray(parsed?.objects) ? parsed.objects : [];
  const read = readObjects(objects, warnings);
  if (read.items.length === 0) {
    warnings.push({ layer: "", kind: "empty", message: "The canvas has nothing on it." });
    return { body: "", warnings, ground: read.ground, empty: true };
  }
  const bodyWidth = Math.max(100, num(options.bodyWidth, SHELL_BODY_WIDTH));
  // Never above 1: a 320px design blown up to 540 enlarges every gap and
  // blurs every picture past what was drawn.
  const scale = Math.min(1, bodyWidth / read.width);
  const ctx = { mergeData: mergeData || {}, preview: Boolean(options.preview), warnings, scale, width: read.width };
  const rows = tabulate(buildTree(read.items), warnings);
  const body = emitRows(rows, ctx, read.ground, Math.round(read.width * scale), 0, 0, read.width);
  return { body, warnings, ground: read.ground, empty: false };
}

/**
 * The full email: the canvas body inside the SAME shell as the block mode.
 * Options are renderTemplateSections' — company, theme, unsubscribe, preview.
 *
 * An empty canvas returns an empty string, never a shell with only a footer
 * in it: a message containing nothing but a legal notice would send fine.
 */
export function compileCanvasEmail(doc, mergeData = {}, options = {}) {
  const compiled = compileCanvasBody(doc, mergeData, { preview: options.preview });
  if (compiled.empty) return { html: "", warnings: compiled.warnings };
  const theme = resolveTheme(options.company || {}, options.theme || null);
  // The canvas's own page colour is the ground the body sits on; the card
  // around it keeps the theme's card colour so header and footer match the
  // block mode exactly.
  const body = `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;width:100%;"><tr><td bgcolor="${compiled.ground}" style="background-color:${compiled.ground};">${compiled.body}</td></tr></table>`;
  return { html: emailShell({ theme, body, options }), warnings: compiled.warnings };
}

/** The text/plain alternative: every text layer, top to bottom. */
export function canvasText(doc, mergeData = {}) {
  const parsed = parseDoc(doc);
  const objects = Array.isArray(parsed?.objects) ? parsed.objects : [];
  const read = readObjects(objects, []);
  return read.items
    .filter((i) => i.kind === "text")
    .sort((a, b) => a.box.y - b.box.y || a.box.x - b.box.x)
    .map((i) => String(i.text).replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (_, tok) => String(mergeData[tok] ?? "")))
    .join("\n\n");
}

// escapeHtml is re-exported for the check script, which asserts the text of
// a layer arrives escaped and its merge token arrives filled.
export { escapeHtml };
