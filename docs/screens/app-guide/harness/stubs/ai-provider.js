// Harness stub for @/lib/ai/provider: the only module that talks to a model
// vendor, and it constructs its client from process.env at import time —
// which a file:// page has no process for. lib/i18n/translateContent.js
// imports it for the server-side translation path and also exports the pure
// label helpers the quote builder reads, so the page pulls this in without
// ever calling it. Every entry point throws: a screen that reached a model
// during a capture would be a screen the fixtures do not describe.
const never = async () => { throw new Error("harness: no model vendor"); };
export const AI_MODEL = "harness";
export const AI_WRITING_MODEL = "harness";
export const AI_IMAGE_MODEL = "harness";
export const AI_FAILURE = { UNCONFIGURED: "unconfigured", VENDOR_ERROR: "vendor_error", REFUSED: "refused", EMPTY: "empty", TRUNCATED: "truncated", UNPARSEABLE: "unparseable", SCHEMA_MISMATCH: "schema_mismatch", BAD_SCHEMA: "bad_schema" };
export function isAiConfigured() { return false; }
export function stripJsonFence(text) { return String(text ?? "").replace(/^```(?:json)?\s*|\s*```$/g, ""); }
export const complete = never;
export const generateImage = never;
export const runToolLoop = never;
