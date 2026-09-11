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
  validateCallScript,
} from "@/lib/sales/intel/callScript";
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
export async function loadCallScriptInputs(prisma, prospectId) {
  const rows = await loadBriefInputs(prisma, prospectId);
  if (!rows.prospect) return { prospect: null };

  const playbook = await assembleProspectPlaybook({
    prospectId,
    rep: null,
    useAi: false,
    persist: false,
    assignVariant: false,
  });

  const brief = composeBrief(rows);
  return {
    prospect: rows.prospect,
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
 * @param payload { prospectId?, priority }
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

  const load = deps.loadInputs || loadCallScriptInputs;
  const inputsRows = await load(prisma, prospectId);
  if (!inputsRows?.prospect) {
    return { done: false, retry: false, reason: "call_script: prospect not found" };
  }

  const inputs = callScriptInputs(inputsRows);
  const inputHash = callScriptInputHash(inputs);

  const existing = await prisma.prospectCallScript.findUnique({
    where: { prospectId },
    select: { inputHash: true, promptVersion: true, generatedAt: true },
  });
  if (callScriptCurrent(existing, { inputHash })) {
    return {
      done: true,
      note: `unchanged — script from ${existing.generatedAt?.toISOString?.() || "before"} still stands for these inputs; nothing spent`,
    };
  }

  const checkBudget = deps.checkBudget || checkPlatformAiBudget;
  const budget = await checkBudget(prisma, { campaignId: inputsRows.prospect.campaignId ?? null, now });
  if (!budget.allowed) {
    // Terminal: see the header. The row says why, and the next claim asks again.
    return { done: false, retry: false, reason: `call_script: no script — ${budget.reason}` };
  }

  const askModel = deps.complete || complete;
  const recordUsage = deps.recordUsage || recordPlatformAiUsage;
  let usedModel = null;

  const result = await askModel({
    system: CALL_SCRIPT_SYSTEM,
    prompt: callScriptPrompt(inputs),
    maxTokens: CALL_SCRIPT_MAX_TOKENS,
    schema: callScriptSchema(),
    schemaName: CALL_SCRIPT_AI_AREA,
    // Metered on what the vendor generated, whatever became of it — the same
    // rule the brief keeps: a rejected answer cost real money.
    onUsage: async ({ model, promptTokens, completionTokens }) => {
      usedModel = model;
      await recordUsage(prisma, {
        area: CALL_SCRIPT_AI_AREA,
        model,
        promptTokens,
        completionTokens,
        prospectId,
        campaignId: inputsRows.prospect.campaignId ?? null,
        salesRepId: inputsRows.prospect.assignedRepId ?? null,
        ref: idempotencyKey || task?.idempotencyKey || null,
      });
    },
  });

  if (!result?.ok) {
    // A vendor outage is unlucky and retried on the ladder. Everything else —
    // unconfigured, refused, truncated, a schema the model would not fill —
    // is the same answer tomorrow and is not paid for five times.
    const retry = result?.reason === AI_FAILURE.VENDOR_ERROR;
    return { done: false, retry, reason: `call_script: ${result?.reason || "unknown"}${result?.message ? ` — ${String(result.message).slice(0, 200)}` : ""}` };
  }

  const checked = validateCallScript(result.data);
  if (!checked.ok) {
    return { done: false, retry: false, reason: `call_script: rejected — ${checked.problems.join(", ")}` };
  }

  await prisma.prospectCallScript.upsert({
    where: { prospectId },
    create: {
      prospectId,
      script: checked.script,
      model: usedModel || "unknown",
      promptVersion: CALL_SCRIPT_VERSION,
      inputHash,
      crawledAt: inputsRows.crawledAt ?? null,
      generatedAt: now,
    },
    update: {
      script: checked.script,
      model: usedModel || "unknown",
      promptVersion: CALL_SCRIPT_VERSION,
      inputHash,
      crawledAt: inputsRows.crawledAt ?? null,
      generatedAt: now,
    },
  });

  return {
    done: true,
    note: [
      existing ? "regenerated" : "generated",
      usedModel || "model unknown",
      checked.trimmed.length ? `trimmed ${checked.trimmed.join(", ")} to bounds` : null,
      budget.capped ? null : "no platform AI budget configured — spend recorded, not capped",
    ]
      .filter(Boolean)
      .join("; "),
  };
}

registerHandler(
  "GENERATE_CALL_SCRIPT",
  withChain("GENERATE_CALL_SCRIPT", async ({ task, payload, idempotencyKey, now, db: prisma }) =>
    handleGenerateCallScript({ task, payload, idempotencyKey, now, db: prisma || db }),
  ),
);
