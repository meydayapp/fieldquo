// lib/i18n/autoTranslateSchedule.js
//
// The route-side half of auto-translation on save: queue the drafting to run
// AFTER the response, and tell the browser what was queued.
//
// Split from lib/i18n/autoTranslate.js so the drafter stays importable under
// plain node for scripts/check-auto-translate.mjs; `after` comes from
// next/server, which only exists inside a Next request.
//
// `after()` runs the callback once the response has gone out, inside the same
// function invocation, so Vercel does not freeze the lambda under it — the
// documented way to do a side effect a save should not wait for
// (node_modules/next/dist/docs/01-app/03-api-reference/04-functions/after.md).
// The save answers in the time it always did; the drafts land seconds later.
// Every failure is logged and leaves the row pending, which every reader
// treats as "use the source language".

import { after } from "next/server";
import { db } from "@/lib/db";
import { autoTranslateOnSave, autoTranslateSummary } from "./autoTranslate";
import { phraseFields } from "./phrases";

/**
 * Queue drafting for one namespace of short texts (lib/i18n/phrases.js) —
 * captions, stage labels, appointment type names. `texts` is every current
 * text of that namespace the save wrote; unchanged ones cost nothing (their
 * key is their hash, and the rows already exist). Returns the summary the
 * response carries as `autoTranslate`, or null.
 */
export function schedulePhrases({ companyId, ns, texts, sourceLanguage = "en" }) {
  const fields = phraseFields(ns, texts);
  if (!Object.keys(fields).length) return null;
  return scheduleAutoTranslate({ companyId, model: "phrase", fields, sourceLanguage });
}

/**
 * Several namespaces in one save — a document's title and summary — as ONE
 * summary for the banner. `groups` is [{ ns, texts }].
 */
export function schedulePhraseGroups({ companyId, groups, sourceLanguage = "en" }) {
  const fields = Object.assign({}, ...(groups || []).map((g) => phraseFields(g.ns, g.texts)));
  if (!Object.keys(fields).length) return null;
  return scheduleAutoTranslate({ companyId, model: "phrase", fields, sourceLanguage });
}

/** The company's default language — the assumed source of what it types. */
export async function companyWritingLanguage(companyId) {
  const row = await db.company.findUnique({ where: { id: companyId }, select: { defaultLanguage: true } });
  return row?.defaultLanguage || "en";
}

/**
 * Queue drafting for the fields that were just saved and return the summary
 * the response should carry as `autoTranslate` (null when nothing applies —
 * an empty field, or a model with nothing in the list).
 */
export function scheduleAutoTranslate({ companyId, model, id = null, fields = {}, sourceLanguage = "en" }) {
  const summary = autoTranslateSummary({ model, fields, sourceLanguage });
  if (!summary?.queued) return summary;
  after(async () => {
    try {
      const r = await autoTranslateOnSave({ companyId, model, id, fields, sourceLanguage }, { db });
      if (r.pending || r.reason) {
        console.warn(`[autoTranslate] ${model}${id ? `#${id}` : ""} for ${companyId}: drafted ${r.drafted}, pending ${r.pending}, skipped ${r.skipped}${r.reason ? ` (${r.reason})` : ""}`);
      }
    } catch (err) {
      console.error(`[autoTranslate] ${model} for ${companyId} failed:`, err?.message);
    }
  });
  return summary;
}
