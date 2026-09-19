// lib/email/templateBody.js
//
// The ONE place DocumentTemplate.sentMode is read.
//
// A template may hold both a block list and a canvas design. Which one goes
// out is written on the row (`sentMode`) — never worked out from which half
// is empty — and every send path, test send and preview asks this function
// rather than branching on the column itself. Four copies of
// `if (template.sentMode === "canvas")` is four places for the fifth caller
// to disagree with; scripts/check-canvas-email.mjs asserts this is the only
// file that mentions the column outside the schema and the editor.
//
// A canvas mode with an EMPTY canvas falls back to nothing, not to the
// blocks: the company chose the canvas, and silently sending the blocks
// instead would be sending an email nobody looked at. The caller gets "" and
// treats it as "no body" — the same as a rule with no template.

import { renderTemplateSections } from "./renderTemplateSections.js";
import { compileCanvasEmail, canvasText } from "./canvasEmail.js";

export const SENT_MODES = Object.freeze(["blocks", "canvas"]);

/** Normalise whatever is on the row to a known mode. Unknown → blocks. */
export function sentModeOf(template) {
  return template?.sentMode === "canvas" ? "canvas" : "blocks";
}

/**
 * @param template   the DocumentTemplate row (sections, canvas, sentMode, theme)
 * @param mergeData  {{token}} values
 * @param options    renderTemplateSections' options (company, unsubscribe, preview);
 *                   `theme` is taken from the template unless overridden
 * @returns {string} full HTML document, or "" when the chosen body is empty
 */
export function templateBody(template, mergeData = {}, options = {}) {
  const opts = { ...options, theme: options.theme ?? template?.theme ?? null };
  if (sentModeOf(template) === "canvas") {
    return compileCanvasEmail(template?.canvas, mergeData, opts).html;
  }
  const sections = Array.isArray(template?.sections) ? template.sections : [];
  return renderTemplateSections(sections, mergeData, opts);
}

/**
 * Compile the chosen body and also say what was lost — for previews, which
 * show the warnings beside the picture. Same decision as templateBody().
 */
export function templateBodyWithWarnings(template, mergeData = {}, options = {}) {
  const opts = { ...options, theme: options.theme ?? template?.theme ?? null };
  if (sentModeOf(template) === "canvas") {
    return compileCanvasEmail(template?.canvas, mergeData, opts);
  }
  const sections = Array.isArray(template?.sections) ? template.sections : [];
  return { html: renderTemplateSections(sections, mergeData, opts), warnings: [] };
}

/** The plain-text alternative for the chosen body (canvas only; blocks have none today). */
export function templateText(template, mergeData = {}) {
  if (sentModeOf(template) === "canvas") return canvasText(template?.canvas, mergeData);
  return "";
}
