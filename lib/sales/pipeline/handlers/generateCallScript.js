// lib/sales/pipeline/handlers/generateCallScript.js
//
// GENERATE_CALL_SCRIPT — the script for one claimed prospect, written once.
//
// ══ Once per crawl, never per page view ════════════════════════════════════
//
// /api/sales/playbook says it in its header: a rep opens the playbook on every
// prospect in the queue, and a generated sentence costs money. So the route
// calls no model and never will. This stage is where the money is spent —
// once, in the background, at the end of the claimed lane
// (lib/sales/pipeline/chain.js CLAIMED_TAIL) — and the route reads the row.
//
// "Once" is enforced by the input hash, not by a flag: everything the model is
// shown is hashed (lib/sales/intel/callScript.js), and a stored script whose
// hash matches is left alone. A new crawl changes the brief, the brief
// changes the hash, the next claim regenerates. Two claims between the same
// two crawls spend nothing the second time.
//
// ══ The lane gate is real, not decorative ══════════════════════════════════
//
// The chain only queues this stage on the claimed lane, and ensureResearchQueued
// only plans it there. The check below is the third copy of the same rule,
// kept because it is the one that costs money if the other two are ever
// wrong: a task that reaches this handler without the lane is refused,
// terminally, with the reason in the row.
//
// ══ Spend ══════════════════════════════════════════════════════════════════
//
// Metered exactly as GENERATE_RESEARCH_BRIEF is: lib/ai/platformUsage.js,
// checkPlatformAiBudget BEFORE the call and recordPlatformAiUsage from the
// vendor's own token counts after, under area "call_script" so a spike is
// traceable to this stage. A budget that is spent refuses the task rather
// than warning — the pipeline is unattended — and the refusal is terminal,
// because retrying against a spent daily budget at 1, 2, 4 and 8 minutes is
// five refusals for one; the next claim re-queues it, bounded by
// research.js's MAX_REQUEUES.
//
// ══ What a rep gets when this stage fails ══════════════════════════════════
//
// The same screen as before it existed. The rules-built script and the
// objection library render whether or not a ProspectCallScript row exists,
// and the route reports the AI script as absent rather than inventing one.
// A failure here costs the rep the generated page, never the call.
//
// ══ The voice lint, and the one retry ══════════════════════════════════════
//
// The owner read the first live script and said it did not sound like a
// person. lib/sales/scriptVoice.js is the mechanical half of his correction
// and every reply goes through it after the shape check. A reply that fails
// is asked for ONCE more, with the failing sentences quoted back, and both
// calls are metered — the vendor generated both. A second failure is
// terminal for this claim, like a digit: the rules-built script is still on
// the screen, and paying a third time for the same tic is not an economy.
//
// The lint also holds the script to THIS company: when the prompt carried
// page text or inferences, the opener and whyThemNow must cite a detail from
// them, verified against the material. With nothing crawled the script is
// honestly generic and the note says so.
//
// ══ Three languages, and who pays for which ═══════════════════════════════
//
// The script comes in English, French and Spanish (callScript.js
// SCRIPT_LANGUAGES), one ProspectCallScript row per language. This stage
// writes ONE — the prospect's default (defaultScriptLanguage: Quebec → fr,
// else the rep's portal language when it is one of the three, else en) — so
// the backlog costs what it did. A rep who flips the switch to another
// language on the Script tab has it written then, by /api/sales/playbook,
// through generateCallScript() below: the SAME function, the same prompt,
// the same lint, the same meter, with `trigger: "on_demand"` and the rep's
// id in the ledger row so a spike reads as "French, on demand, this rep".
// The route rate-limits those; this stage is bounded by the lane.
import { db } from "@/lib/db";
import { registerHandler } from "@/lib/sales/pipeline/registry";
import { withChain } from "@/lib/sales/pipeline/chain";
import { taskPriority } from "@/lib/sales/pipeline/priority";
import { AI_FAILURE, complete } from "@/lib/ai/provider";
import { checkPlatformAiBudget, recordPlatformAiUsage } from "@/lib/ai/platformUsage";
import { composeBrief } from "@/lib/sales/intel/brief";
import {
  CALL_SCRIPT_AI_AREA,
  CALL_SCRIPT_MAX_TOKENS,
  CALL_SCRIPT_SYSTEM,
  CALL_SCRIPT_VERSION,
  callScriptCurrent,
  callScriptInputHash,
  callScriptInputs,
  callScriptPrompt,
  callScriptSchema,
  citationSources,
  defaultScriptLanguage,
  normalizeScriptLanguage,
  validateCallScript,
  validationRetryNote,
} from "@/lib/sales/intel/callScript";
import { selectPageExcerpts } from "@/lib/sales/intel/pageExcerpts";
import { longSentences, voiceLint, voiceRetryNote } from "@/lib/sales/scriptVoice";
import { assembleProspectPlaybook } from "@/lib/sales/playbook/assemble";
import { loadBriefInputs } from "./generateResearchBrief";

/**
 * Everything the prompt is built from, in one place so a check can hand the
 * handler fixture rows through `deps.loadInputs` and drive it to the write
 * without a database or a model.
 *
 * The playbook is loaded through assembleProspectPlaybook with `useAi: false`,
 * `persist: false`, `assignVariant: false` — the exact call the rep's route
 * makes — so the stage lines the model sees are the ones the rep reads below
 * the generated script.
 */
export async function loadCallScriptInputs(prisma, prospectId, { assemble = assembleProspectPlaybook } = {}) {
  const rows = await loadBriefInputs(prisma, prospectId);
  if (!rows.prospect) return { prospect: null };

  const [playbook, rep, pageRows, directory] = await Promise.all([
    assemble({
      prospectId,
      rep: null,
      useAi: false,
      persist: false,
      assignVariant: false,
    }),
    // The rep's first name goes in the opener. Read fresh: a prospect handed
    // to another rep is read by another voice, and the hash knows it. Their
    // portal language decides the default script language for a row with
    // no required language of its own (callScript.js defaultScriptLanguage).
    rows.prospect.assignedRepId
      ? prisma.salesRep.findUnique({ where: { id: rows.prospect.assignedRepId }, select: { name: true, language: true } })
      : null,
    // What the crawler read. The text rows only — the fingerprint rows are
    // a thousand per prospect and say nothing a person would.
    prisma.prospectEvidence.findMany({
      where: { prospectId, type: "page_content" },
      select: { type: true, sourceUrl: true, normalizedValue: true, rawValue: true },
    }),
    // The directory's own facts. Not in the brief's select, which is shaped
    // for the card; read here rather than widening a query the brief owns.
    prisma.prospect.findUnique({
      where: { id: prospectId },
      select: { googleRating: true, googleReviewCount: true },
    }),
  ]);

  const brief = composeBrief(rows);
  return {
    prospect: { ...rows.prospect, ...(directory || {}) },
    repName: rep?.name || null,
    // Decided here, from the rows, so the stage and the route agree on what
    // "default" means for this prospect and this rep.
    defaultLanguage: defaultScriptLanguage({ prospect: rows.prospect, rep }),
    pages: selectPageExcerpts(pageRows),
    inferences: rows.inferences || [],
    brief,
    playbook: playbook?.found && playbook.selection?.selected
      ? {
          name: playbook.selection.selected.name,
          describe: playbook.selection.selected.describe,
          selectorLabel: playbook.selection.selectorLabel,
        }
      : null,
    stages: playbook?.found ? playbook.script?.stages || [] : [],
    objections: playbook?.found ? playbook.objections || [] : [],
    unchecked: playbook?.found ? playbook.unchecked || [] : [],
    // Kept beside the script so the screen can say which crawl it describes,
    // and research.js can tell a script that predates a newer one.
    crawledAt: rows.prospect.lastCrawledAt ?? null,
  };
}

/**
 * Write the script for ONE prospect in ONE language, or say why not.
 *
 * The whole of the work: load, hash, skip-if-current, budget, ask, validate,
 * lint, retry once, store, meter. Shared by the pipeline stage (below) and
 * the on-demand path in /api/sales/playbook, so there is exactly one prompt,
 * one lint and one meter for a script whoever asked for it — a second copy
 * in the route would be the one that rots (AGENTS.md failure class 4).
 *
 * @param prisma      a Prisma client
 * @param prospectId
 * @param language    "en" | "fr" | "es", or null for the prospect's default
 * @param trigger     "pipeline" | "on_demand" — into the ledger row's meta
 * @param salesRepId  who asked, for the ledger; null for the pipeline (the
 *                    assigned rep is recorded there instead)
 * @param ref         the ledger's idempotency key
 * @param now
 * @param deps        { loadInputs, complete, checkBudget, recordUsage } for a check
 *
 * @returns { done, retry?, reason?, note?, script?, language, existing? }
 *   `done: true` with `script` when a current script exists or was written;
 *   `done: false` with `reason` otherwise, `retry` saying whether the
 *   pipeline ladder should try again (a vendor outage) or not (everything
 *   else — the same answer tomorrow, and not paid for five times).
 */
export async function generateCallScript({
  prisma,
  prospectId,
  language = null,
  trigger = "pipeline",
  salesRepId = null,
  ref = null,
  now = new Date(),
  deps = {},
} = {}) {
  const load = deps.loadInputs || loadCallScriptInputs;
  const inputsRows = await load(prisma, prospectId);
  if (!inputsRows?.prospect) {
    return { done: false, retry: false, reason: "call_script: prospect not found", language: null };
  }

  const lang = normalizeScriptLanguage(language) || inputsRows.defaultLanguage || defaultScriptLanguage({ prospect: inputsRows.prospect, rep: null });
  const inputs = callScriptInputs({ ...inputsRows, language: lang });
  const inputHash = callScriptInputHash(inputs);
  const key = { prospectId_language: { prospectId, language: lang } };

  const existing = await prisma.prospectCallScript.findUnique({
    where: key,
    select: { inputHash: true, promptVersion: true, generatedAt: true, script: true, model: true, crawledAt: true },
  });
  if (callScriptCurrent(existing, { inputHash })) {
    return {
      done: true,
      language: lang,
      existing: true,
      script: existing.script,
      row: existing,
      note: `unchanged — ${lang} script from ${existing.generatedAt?.toISOString?.() || "before"} still stands for these inputs; nothing spent`,
    };
  }

  const checkBudget = deps.checkBudget || checkPlatformAiBudget;
  const budget = await checkBudget(prisma, { campaignId: inputsRows.prospect.campaignId ?? null, now });
  if (!budget.allowed) {
    // Terminal: see the header. The row says why, and the next claim asks again.
    return { done: false, retry: false, reason: `call_script: no script — ${budget.reason}`, language: lang };
  }

  const askModel = deps.complete || complete;
  const recordUsage = deps.recordUsage || recordPlatformAiUsage;
  let usedModel = null;
  const meter = (suffix) => async ({ model, promptTokens, completionTokens }) => {
    usedModel = model;
    await recordUsage(prisma, {
      area: CALL_SCRIPT_AI_AREA,
      model,
      promptTokens,
      completionTokens,
      prospectId,
      campaignId: inputsRows.prospect.campaignId ?? null,
      // The pipeline's row names the assigned rep; an on-demand row names
      // the rep who pressed the switch, which is what the rate limit counts.
      salesRepId: salesRepId ?? inputsRows.prospect.assignedRepId ?? null,
      ref: ref ? `${ref}${suffix}` : null,
      meta: { language: lang, trigger },
    });
  };

  const result = await askModel({
    system: CALL_SCRIPT_SYSTEM,
    prompt: callScriptPrompt(inputs),
    maxTokens: CALL_SCRIPT_MAX_TOKENS,
    schema: callScriptSchema(),
    schemaName: CALL_SCRIPT_AI_AREA,
    // Metered on what the vendor generated, whatever became of it — the same
    // rule the brief keeps: a rejected answer cost real money.
    onUsage: meter(""),
  });

  if (!result?.ok) {
    // A vendor outage is unlucky and retried on the ladder. Everything else —
    // unconfigured, refused, truncated, a schema the model would not fill —
    // is the same answer tomorrow and is not paid for five times.
    const retry = result?.reason === AI_FAILURE.VENDOR_ERROR;
    return { done: false, retry, language: lang, reason: `call_script: ${result?.reason || "unknown"}${result?.message ? ` — ${String(result.message).slice(0, 200)}` : ""}` };
  }

  // ── One retry, for the shape rules OR the voice rules, never both ───────
  //
  // The first live French and Spanish drafts were both thrown away on a
  // digit, terminally, with no second draft and no line named — while a
  // draft that failed the voice lint got a retry with the sentence quoted
  // back. Same vendor, same money, same fix: whichever check the first draft
  // fails, it is asked for ONCE more with the fault named. A second failure
  // of either kind is terminal, as before.
  const sources = citationSources(inputs);
  const lintOptions = { sources, ignoreWords: [inputs.business], language: lang };
  const where = (findings) => findings.slice(0, 3).map((f) => `${f.field}: ${f.problem || f.problems.join("/")}${f.snippet ? ` "${f.snippet.slice(0, 80)}"` : ""}`).join("; ");
  const retryOnce = async (note) => {
    const again = await askModel({
      system: CALL_SCRIPT_SYSTEM,
      prompt: `${callScriptPrompt(inputs)}\n\n${note}`,
      maxTokens: CALL_SCRIPT_MAX_TOKENS,
      schema: callScriptSchema(),
      schemaName: CALL_SCRIPT_AI_AREA,
      onUsage: meter(":retry"),
    });
    if (!again?.ok) {
      const retry = again?.reason === AI_FAILURE.VENDOR_ERROR;
      return { failed: { done: false, retry, language: lang, reason: `call_script: retry — ${again?.reason || "unknown"}` } };
    }
    const second = validateCallScript(again.data);
    if (!second.ok) {
      return { failed: { done: false, retry: false, language: lang, reason: `call_script: rejected on retry — ${second.problems.join(", ")} (${where(second.findings)})` } };
    }
    const secondVoice = voiceLint(second.script, lintOptions);
    if (!secondVoice.ok) {
      return { failed: { done: false, retry: false, language: lang, reason: `call_script: rejected on retry — voice (${where(secondVoice.findings)})` } };
    }
    return { checked: second };
  };

  let checked = validateCallScript(result.data);
  let retried = false;
  if (!checked.ok) {
    retried = true;
    const out = await retryOnce(validationRetryNote(checked, { language: lang }));
    if (out.failed) return out.failed;
    checked = out.checked;
  } else {
    // ── Does it sound like a person, and is it about this company? ────────
    const voice = voiceLint(checked.script, lintOptions);
    if (!voice.ok) {
      retried = true;
      const out = await retryOnce(voiceRetryNote(voice, { long: longSentences(checked.script) }));
      if (out.failed) return out.failed;
      checked = out.checked;
    }
  }

  const data = {
    script: checked.script,
    model: usedModel || "unknown",
    promptVersion: CALL_SCRIPT_VERSION,
    inputHash,
    crawledAt: inputsRows.crawledAt ?? null,
    generatedAt: now,
  };
  const row = await prisma.prospectCallScript.upsert({
    where: key,
    create: { prospectId, language: lang, ...data },
    update: data,
  });

  return {
    done: true,
    language: lang,
    existing: false,
    script: checked.script,
    row: row || { ...data, language: lang },
    note: [
      existing ? "regenerated" : "generated",
      lang,
      usedModel || "model unknown",
      retried ? "second draft — the first did not pass the shape rules or the voice lint" : null,
      sources.length
        ? `cites ${checked.script.citations.length} detail(s) from ${inputs.pages.length} page(s) and ${inputs.inferences.length} inference(s)`
        : "generic — no page text and no inferences to cite, so the opener is the plain one",
      checked.trimmed.length ? `trimmed ${checked.trimmed.join(", ")} to bounds` : null,
      budget.capped ? null : "no platform AI budget configured — spend recorded, not capped",
    ]
      .filter(Boolean)
      .join("; "),
  };
}

/**
 * @param payload { prospectId?, priority, language? }
 *
 * `language` is honoured when a caller queues a specific one; absent, the
 * prospect's default is written — which is what the research chain queues.
 */
export async function handleGenerateCallScript({
  task,
  payload = {},
  idempotencyKey = null,
  db: prisma,
  now = new Date(),
  deps = {},
} = {}) {
  const prospectId = payload.prospectId || task?.prospectId || null;
  if (!prospectId) {
    return { done: false, retry: false, reason: "call_script: no prospectId on the task or its payload" };
  }

  // The gate that costs money if it is wrong. See the header.
  if (taskPriority({ payload }) !== "claimed" && taskPriority(task) !== "claimed") {
    return { done: false, retry: false, reason: "call_script: only the claimed lane gets a script — the backlog is not charged for one" };
  }

  const result = await generateCallScript({
    prisma,
    prospectId,
    language: normalizeScriptLanguage(payload.language) || null,
    trigger: "pipeline",
    ref: idempotencyKey || task?.idempotencyKey || null,
    now,
    deps,
  });
  const { script: _script, row: _row, ...rest } = result;
  return rest;
}

registerHandler(
  "GENERATE_CALL_SCRIPT",
  withChain("GENERATE_CALL_SCRIPT", async ({ task, payload, idempotencyKey, now, db: prisma }) =>
    handleGenerateCallScript({ task, payload, idempotencyKey, now, db: prisma || db }),
  ),
);
