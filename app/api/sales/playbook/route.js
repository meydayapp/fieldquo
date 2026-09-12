// app/api/sales/playbook/route.js
//
// The script, for the rep who is about to say it out loud.
//
// ══ Why this exists beside the superadmin preview ═════════════════════════
//
// /api/platform/sales/playbooks/preview runs the same engine, and it is
// superadmin-only. So until now the objection library, the nine stages and the
// per-prospect talking points were reachable ONLY by the people who never make
// a call, and the closer on their fortieth dial of the day worked from memory.
// lib/sales/playbook/objections.js says a label "is what a rep scans for
// mid-call" — this is the route that finally puts it in front of one.
//
// ══ Read-only, and structurally so ════════════════════════════════════════
//
// GET only, and `assignVariant: false`. The queue gate declares exactly one
// writable model (REP_QUEUE_WRITES = ["prospect"]) and check-prospect-ui
// asserts that list stays one model long, so a route sitting behind it may not
// create a SalesPlaybookAssignment on a page load. That is not a workaround —
// assembleProspectPlaybook's own comment argues it is the correct place for the
// refusal: a rep who opens a prospect card has not phoned anybody, and §38 asks
// for the arm to be fixed before the CALL, which is the dial POST on
// /api/sales/calls, not this.
//
// ══ Scoped to a prospect this rep holds ═══════════════════════════════════
//
// assembleProspectPlaybook takes a bare id and reads the row itself — it was
// written for a superadmin who may look at anything. So the id is resolved
// through queueWhere() FIRST and a miss returns 404 before the engine runs. A
// rep who can pull a script for an unclaimed prospect can read the whole
// researched pool one id at a time, which is the exact thing the queue route's
// header explains there is no endpoint for.
//
// ══ No model is called, ever, on this path ════════════════════════════════
//
// `useAi: false`. Two reasons and either would be enough. A generated sentence
// costs money and the rep opens this on every prospect in the queue; and it
// would put latency between claiming a prospect and being able to dial. The
// deterministic path renders the rule's own evidence-cited sentences — plainer
// copy, never a blank panel, the property lib/site/generateSite.js holds for
// the same reason. Nothing here touches lib/ai/provider.js, so there is no
// quota to check and no top-up to offer.
//
// The AI script the owner asked for does exist — and it is a ROW, not a call.
// GENERATE_CALL_SCRIPT (lib/sales/pipeline/handlers/generateCallScript.js)
// writes ProspectCallScript once per claimed prospect per crawl, in the
// background, metered; this route reads it with one findUnique and reports
// `callScript: null` when there is none yet. The rules-built script below it
// is unchanged either way, so a prospect whose script has not been written
// gets exactly the screen it got before.
//
// ══ The one exception: another language, on demand ════════════════════════
//
// The owner asked for the script in English, French and Spanish. The
// pipeline writes the prospect's DEFAULT language only (Quebec → fr, else
// the rep's portal language when it is one of the three, else en), so the
// backlog costs what it did. When a rep flips the switch to another
// language and no current row exists for it, THIS route writes it —
// synchronously, through the same generateCallScript() the stage uses:
// same prompt, same lint, same meter, ≈ a tenth of a cent. The paragraph
// above still holds for every ordinary open: the default language is never
// generated here, and a language that already has a current row spends
// nothing. Two limits keep a rep's switch from being a spend button:
//
//   · ON_DEMAND_PER_HOUR generations per rep, counted off the ledger
//     (PlatformAiUsage rows with trigger "on_demand" and this rep's id);
//   · the platform AI budget, checked inside generateCallScript() as it is
//     for the pipeline.
//
// A refused or failed generation returns the DEFAULT language's script with
// `scriptLanguage.fallback` saying why — never an empty panel, because the
// rep is dialling.
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import * as pipelineProgress from "@/lib/sales/pipeline/progress";
import {
  CALL_SCRIPT_AI_AREA,
  CALL_SCRIPT_VERSION,
  SCRIPT_LANGUAGES,
  defaultScriptLanguage,
  normalizeScriptLanguage,
} from "@/lib/sales/intel/callScript";
import { generateCallScript } from "@/lib/sales/pipeline/handlers/generateCallScript";
import { ON_DEMAND_PER_HOUR, ON_DEMAND_REF_PREFIX, scriptRowStale } from "@/lib/sales/scriptOnDemand";
import { requiredLanguageFor } from "@/lib/sales/leadLanguage";
import { db } from "@/lib/db";
import { requireQueueRep } from "@/lib/sales/queueGate";
import { queueWhere } from "@/lib/sales/prospectView";
import { assembleProspectPlaybook } from "@/lib/sales/playbook/assemble";

/** The response shape of one stored row. */
function shapeScript(row) {
  return row?.script
    ? { ...row.script, language: row.language, generatedAt: row.generatedAt, crawledAt: row.crawledAt, model: row.model, version: row.promptVersion }
    : null;
}

export async function GET(request) {
  const { rep, refusal } = await requireQueueRep(request);
  if (refusal) return NextResponse.json(refusal.body, { status: refusal.status });

  const url = new URL(request.url);
  const prospectId = (url.searchParams.get("prospectId") || "").trim().slice(0, 40);
  if (!prospectId) {
    return NextResponse.json({ error: "Which prospect?" }, { status: 400 });
  }
  // Absent means the default; present and not one of the three is a
  // request the screen could not have made, and is refused rather than
  // quietly read as English.
  const rawLanguage = url.searchParams.get("language");
  const requestedLanguage = rawLanguage == null || rawLanguage === "" ? null : normalizeScriptLanguage(rawLanguage);
  if (rawLanguage != null && rawLanguage !== "" && !requestedLanguage) {
    return NextResponse.json({ error: `Scripts come in ${SCRIPT_LANGUAGES.join(", ")}.` }, { status: 400 });
  }

  const now = new Date();
  const mine = await db.prospect.findFirst({
    where: { id: prospectId, ...queueWhere(rep.id, { now }) },
    // The published address rides along on the same ownership read: the call
    // panel prints it with a copy control beside the script, so a rep who
    // hears "email me" has it in front of them without leaving the call.
    // province and lastCrawledAt decide the default script language and
    // whether an asked-for language's row is stale.
    select: { id: true, email: true, emailSource: true, province: true, lastCrawledAt: true, assignedRepId: true },
  });
  if (!mine) {
    return NextResponse.json(
      { error: "That prospect is not yours to work. Claims are one rep at a time." },
      { status: 404 },
    );
  }

  // The default language: the lead's required language, else this rep's
  // portal language when it is one of the three, else English. The rep here
  // is the one asking, who holds the claim — the same rep the pipeline read
  // as assignedRepId when it wrote the default row.
  const repRow = typeof db.salesRep?.findUnique === "function"
    ? await db.salesRep.findUnique({ where: { id: rep.id }, select: { language: true } })
    : null;
  const defaultLanguage = defaultScriptLanguage({ prospect: mine, rep: repRow });
  const language = requestedLanguage || defaultLanguage;

  const [result, rows] = await Promise.all([
    assembleProspectPlaybook({
      prospectId,
      rep: { id: rep.id, name: rep.name },
      useAi: false,
      persist: false,
      assignVariant: false,
    }),
    // Guarded on the client having the model: a client generated before the
    // table was added reads as "no script yet", never as a crash on a screen
    // a rep is dialling from. Every language's row in one read: the one
    // asked for, and the default to fall back on.
    typeof db.prospectCallScript?.findMany === "function"
      ? db.prospectCallScript.findMany({
          where: { prospectId },
          select: { language: true, script: true, model: true, generatedAt: true, crawledAt: true, promptVersion: true },
        })
      : Promise.resolve([]),
  ]);
  if (!result.found) {
    return NextResponse.json({ error: "No prospect with that id." }, { status: 404 });
  }
  const byLanguage = new Map(rows.map((r) => [r.language || "en", r]));
  const stored = byLanguage.get(defaultLanguage) || null;

  // ── The asked-for language, written now if it has to be ─────────────────
  //
  // Only for a language OTHER than the default: the default is the
  // pipeline's job (below), and this route still never spends on an
  // ordinary open. A current row for the asked-for language spends nothing
  // either — generateCallScript's hash check is the second gate.
  let shown = byLanguage.get(language) || null;
  let fallback = null;
  if (language !== defaultLanguage && scriptRowStale(shown, { lastCrawledAt: mine.lastCrawledAt })) {
    const since = new Date(now.getTime() - 60 * 60 * 1000);
    const recent = typeof db.platformAiUsage?.count === "function"
      ? await db.platformAiUsage.count({
          where: { area: CALL_SCRIPT_AI_AREA, salesRepId: rep.id, createdAt: { gte: since }, ref: { startsWith: ON_DEMAND_REF_PREFIX } },
        })
      : 0;
    if (recent >= ON_DEMAND_PER_HOUR) {
      fallback = { requested: language, shown: defaultLanguage, reason: "rate_limited" };
      shown = stored;
    } else {
      try {
        const generated = await generateCallScript({
          prisma: db,
          prospectId,
          language,
          trigger: "on_demand",
          salesRepId: rep.id,
          // Unique per ask, so the ledger keeps every one and the hour's
          // count above is a count of asks.
          ref: `${ON_DEMAND_REF_PREFIX}${rep.id}:${prospectId}:${language}:${now.getTime()}`,
          now,
        });
        if (generated.done && generated.row) {
          shown = { language, ...generated.row, script: generated.script };
        } else {
          console.error("[sales/playbook] on-demand script refused:", generated.reason);
          fallback = { requested: language, shown: defaultLanguage, reason: "generation_failed", detail: generated.reason || null };
          shown = stored;
        }
      } catch (err) {
        console.error("[sales/playbook] on-demand script failed:", err?.message || err);
        fallback = { requested: language, shown: defaultLanguage, reason: "generation_failed", detail: null };
        shown = stored;
      }
    }
  }

  // ── A script from an older prompt is re-queued on open ──────────────────
  //
  // The route still calls no model and writes no row of its own. What it
  // does when the stored script predates the current prompt version (or
  // there is none for a claimed prospect) is what the claim route does on
  // claim: ask the pipeline to queue the claimed tail. Fire-and-forget —
  // never awaited on the response path, never a reason the page fails — and
  // the handler's hash check refuses to spend on a row already current, so
  // two opens in a minute queue one task and pay once.
  if ((!stored || stored.promptVersion !== CALL_SCRIPT_VERSION) && typeof pipelineProgress.ensureResearchQueued === "function") {
    Promise.resolve()
      .then(() => pipelineProgress.ensureResearchQueued({ db, prospectIds: [prospectId], priority: "claimed" }))
      .catch((err) => console.error("[sales/playbook] ensureResearchQueued failed:", err?.message || err));
  }

  // Shaped rather than passed through. `selection.trace` is the superadmin's
  // answer to "why does my playbook never open?" and it is forty rows of
  // refusals; what a rep needs is the one that DID open and the sentence saying
  // why. The experiment block is dropped entirely — no arm was assigned here,
  // and reporting a variantKey of null beside a running experiment would read
  // as a derivation that failed.
  return NextResponse.json({
    prospect: {
      id: result.prospect.id,
      businessName: result.prospect.businessName,
      // Null when the crawler saw none — never "" — so the screen can draw
      // nothing rather than a copy button for an empty string.
      email: mine.email || null,
      emailSource: mine.email ? mine.emailSource || null : null,
    },
    playbook: result.selection.selected
      ? {
          key: result.selection.selected.key,
          name: result.selection.selected.name,
          selectorLabel: result.selection.selectorLabel,
          describe: result.selection.selected.describe,
          facts: result.selection.selected.facts || [],
        }
      : null,
    // Present exactly when `playbook` is null, and it is the true sentence — a
    // prospect nothing has crawled has no script, and inventing one is a rep
    // phoning a stranger with words that claim to know something about them.
    noPlaybookReason: result.selection.selected ? null : result.selection.reasonText,
    script: result.script,
    // Present exactly when a row exists for the language shown. Null is a
    // true answer — "not generated yet" — and the screen renders the rules
    // alone. `language` on it says which of the three it is in.
    callScript: shapeScript(shown),
    // The switch's state: what is shown, what the default is, what the
    // three are, and — when the asked-for language could not be written —
    // why the default is on screen instead. `leadLanguage` is what the
    // screen remembers a rep's choice against (a Quebec lead and a Texas
    // lead are two different habits).
    scriptLanguage: {
      current: shown ? shown.language || "en" : language,
      default: defaultLanguage,
      leadLanguage: requiredLanguageFor(mine),
      available: SCRIPT_LANGUAGES,
      fallback,
      repId: rep.id,
    },
    objections: result.objections,
    talkingPoints: result.talkingPoints,
    // Carried up so a three-line script off a business whose site timed out
    // reads as "we could not look" rather than as a confident three.
    unchecked: result.unchecked,
    generation: {
      source: result.generation.source,
      degraded: result.generation.degraded,
      reasonText: result.generation.reasonText,
    },
    // Computed from the generated Prisma client, never asserted. While the
    // playbook tables are absent these words are the built-in starter library
    // and nobody can edit them — which is what a rep needs to know before they
    // report a line as wrong.
    store: result.store,
  });
}
