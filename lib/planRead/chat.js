// lib/planRead/chat.js
//
// One chat turn on a finished drawing read: "the bell tower needs a 60 ft
// lift", "exclude the basement", "premium paint on the trim".
//
// ══ What the model gets, and what it does not ══════════════════════════════
//
// The compact project model, the fixed context (catalogue, sheet notes,
// printed dimensions with ids, the scope sheet, the photo surfaces), the last
// eight messages and the new one. Never the raw drawings — unless it asks to
// re-open a sheet ("openSheets"), in which case ONE more call is made with
// that sheet's images attached (at most two sheets), on the same cached
// prefix.
//
// It returns ops (lib/planRead/projectModel.js applyOps), which this file
// applies, and a short reply. The server then writes BOTH messages and the
// new model in one transaction, so the history and the model can never
// disagree about what was asked and what changed.
//
// ══ Money ══════════════════════════════════════════════════════════════════
//
// Through the wallet meter (lib/ai/featurePayer.js meterFor("plan_read_chat")
// → lib/ai/walletMeter.js): checked before the call against the stated
// estimate, debited after from each call's own token counts — the cached part
// of the prompt at the cached rate. A turn that produced nothing usable is
// NOT charged (the tokens are still recorded as usage, paidFromWallet, so
// FieldQuo sees its own cost) — the photo deep read's "nothing was charged".

import { db as realDb } from "@/lib/db";
import { complete as realComplete } from "@/lib/ai/provider";
import { meterFor as realMeterFor } from "@/lib/ai/featurePayer";
import { recordAiUsage as realRecordUsage } from "@/lib/ai/usage";
import { applyOps, buildDimIndex } from "./projectModel";
import { catalogueForModel, planSubstrateKeys } from "./catalogue";
import { scopeSheetDigest } from "./excel";
import { sheetImageUrls } from "./images";
import { CHAT_SYSTEM, CHAT_SCHEMA, chatPrompt, projectContext } from "./prompts";
import { loadPaintBooks, readInputs } from "./run";

export const MAX_MESSAGE_CHARS = 2000;
export const HISTORY_TURNS = 8;
/** The chat's context is the synthesis's, trimmed — see projectContext. */
export const CHAT_CONTEXT_LIMITS = Object.freeze({ maxDims: 250, maxExcelChars: 6000 });

/** The fixed part of every turn's prompt for this read. Deterministic. */
export function chatContext(read, interiorBook) {
  const { sheets, excel } = readInputs(read);
  return projectContext({
    catalogue: catalogueForModel(interiorBook),
    sheets,
    excelDigest: scopeSheetDigest(excel, { maxChars: CHAT_CONTEXT_LIMITS.maxExcelChars }),
    photoRead: read.photoRead || null,
    trade: read.trade,
    clientRequest: read.clientRequest,
    maxDims: CHAT_CONTEXT_LIMITS.maxDims,
    schedules: false,
  });
}

function opsContext(read, interiorBook) {
  const { sheets, excel } = readInputs(read);
  const dims = buildDimIndex(sheets);
  return {
    dimIds: new Set(dims.keys()),
    itemKeys: new Set(planSubstrateKeys(interiorBook)),
    productKeys: new Set(Object.keys(interiorBook?.products || {})),
    photoIds: new Set((read.photoRead?.surfaces || []).map((s) => s.id)),
    excel,
  };
}

function sheetsByName(read, names) {
  const { sheets, docs } = readInputs(read);
  const wanted = (Array.isArray(names) ? names : []).map((n) => String(n).toUpperCase().replace(/\s+/g, "")).slice(0, 2);
  const out = [];
  for (const w of wanted) {
    const s = sheets.find((x) => String(x.sheetNumber || "").toUpperCase().replace(/\s+/g, "") === w || x.key.toUpperCase() === w);
    if (!s || out.some((o) => o.key === s.key)) continue;
    const doc = docs.find((d) => d.id === s.docId);
    const page = (Array.isArray(doc?.pages) ? doc.pages : []).find((p) => p.page === s.docPage);
    if (page) out.push({ key: s.key, name: s.sheetNumber || `Page ${s.page}`, images: sheetImageUrls(page) });
  }
  return out;
}

/**
 * Run one turn. Writes nothing itself except through `persist`, so the
 * route owns the transaction. Returns what the route needs to answer.
 */
export async function chatTurn({ read, companyId, userId, message, history }, deps = {}) {
  const complete = deps.complete || realComplete;
  const meterFor = deps.meterFor || realMeterFor;
  const recordAiUsage = deps.recordAiUsage || realRecordUsage;
  const prisma = deps.db || realDb;

  const text = String(message || "").replace(/\s+/g, " ").trim().slice(0, MAX_MESSAGE_CHARS);
  if (!text) return { ok: false, status: 400, error: "empty" };
  if (!read.model) return { ok: false, status: 409, error: "not_read" };

  const meter = await meterFor("plan_read_chat", { companyId, userId });
  const gate = await meter.check();
  if (!gate.allowed) return { ok: false, status: 402, error: "no_credit", reason: gate.reason, needCents: gate.needCents, balanceCents: gate.balanceCents };

  const { books } = deps.books ? { books: deps.books } : await loadPaintBooks(companyId, { prisma });
  const book = books.interior_painting;
  const context = chatContext(read, book);
  const usages = [];
  const call = (prompt, images = []) =>
    complete({
      system: CHAT_SYSTEM,
      prompt,
      images,
      maxImages: images.length,
      imageDetail: "high",
      tier: "best",
      maxTokens: 6000,
      schema: CHAT_SCHEMA,
      schemaName: "plan_read_chat",
      promptCacheKey: `plan_read:${read.id}`,
      onUsage: (u) => {
        usages.push(u);
      },
    });

  const recent = (history || []).slice(-HISTORY_TURNS);
  const firstPrompt = chatPrompt({ context, model: read.model, history: recent, message: text });
  let res = await call(firstPrompt);
  let opened = [];
  if (res?.ok && (res.data.openSheets || []).length && !(res.data.ops || []).length) {
    opened = sheetsByName(read, res.data.openSheets);
    if (opened.length) {
      const second = chatPrompt({ context, model: read.model, history: recent, message: text, openedSheets: opened.map((o) => o.name) });
      const again = await call(second, opened.flatMap((o) => o.images).slice(0, 10));
      if (again?.ok) res = again;
    }
  }

  const ok = Boolean(res?.ok);
  let chargedCents = 0;
  for (const [i, u] of usages.entries()) {
    if (ok) {
      const r = await meter.record(u, { ref: `plan_read_chat:${read.id}:${deps.turnId || Date.now()}:${i}`, note: `Drawing read chat — ${String(read.title || "").slice(0, 60)}` });
      chargedCents += r?.chargedCents || 0;
    } else {
      await recordAiUsage({
        companyId,
        feature: "plan_read_chat",
        model: u.model,
        promptTokens: u.promptTokens || 0,
        completionTokens: u.completionTokens || 0,
        cachedTokens: u.cachedTokens || 0,
        imageCount: u.imageCount || 0,
        userId,
        paidFromWallet: true,
      });
    }
  }
  const usage = usages.reduce(
    (t, u) => ({
      model: u.model,
      promptTokens: t.promptTokens + (u.promptTokens || 0),
      cachedTokens: t.cachedTokens + (u.cachedTokens || 0),
      completionTokens: t.completionTokens + (u.completionTokens || 0),
      calls: t.calls + 1,
    }),
    { model: null, promptTokens: 0, cachedTokens: 0, completionTokens: 0, calls: 0 },
  );
  if (!ok) return { ok: false, status: 502, error: "model_failed", usage, message: text };

  const { model, changes, dropped } = applyOps(read.model, res.data.ops || [], opsContext(read, book), { actor: "model" });
  const reply = String(res.data.reply || "").replace(/\s+/g, " ").trim().slice(0, 1200) || (changes.length ? "Done." : "I didn't change anything.");
  return { ok: true, model, reply, changes, dropped, usage, chargedCents, opened: opened.map((o) => o.name), message: text };
}
