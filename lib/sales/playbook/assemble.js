// lib/sales/playbook/assemble.js
//
// The one function that turns a prospect id into what a rep says.
//
// ══ Order matters, and each step is the input to the next ════════════════
//
//   1. load the observations                (db)
//   2. index them three-valued              (lib/sales/intel — not re-implemented)
//   3. select a playbook, deterministically (select.js, returns the whole trace)
//   4. assign an experiment variant BEFORE anything is said (§38)
//   5. build talking points, AI or rules    (generate.js, gated by talkingPoints.js)
//   6. attach the objection library         (objections.js)
//   7. render the nine stages               (script.js)
//
// Step 4 is before step 5 on purpose. A variant can override the FIT stage's
// wording, and generating talking points against the base playbook and then
// swapping the stage under them would produce a script whose two halves argue
// different things.
//
// ══ Everything needed to answer "why am I saying this?" comes back ════════
//
// `selection.trace` carries every playbook that was considered and the refusal
// for each. `points[].evidenceIds`, `.ruleCode` and `.capabilityCode` carry the
// chain for every sentence. `degraded` and `reason` say why the script is
// plainer than it could have been. None of it is optional or behind a flag: a
// rep who cannot see why is a rep who will defend it badly.
import { indexProspect } from "@/lib/sales/intel/opportunity";
import { loadCapabilityMatrix } from "@/lib/sales/intel/db";
import { selectorCatalogue } from "./selectors";
import { selectPlaybook } from "./select";
import { objectionsForProspect } from "./objections";
import { talkingPointContext, deterministicTalkingPoints } from "./talkingPoints";
import { generateTalkingPoints } from "./generate";
import { deriveVariant } from "./experiments";
import { buildCallScript } from "./script";
import {
  loadExperiments,
  loadObjections,
  loadPlaybooks,
  loadProspectInputs,
  readOrCreateAssignment,
  storeState,
  storeTalkingPoints,
} from "./store";

/**
 * @param {object} args
 * @param {string} args.prospectId
 * @param {object|null} args.rep         { id, name } — whose script this is
 * @param {boolean} args.useAi           false renders from the rules alone and
 *                                       never calls a model. The preview screen
 *                                       defaults to false so that opening a
 *                                       page does not spend money.
 * @param {boolean} args.persist         store the generated points. Silently
 *                                       impossible while the tables are absent,
 *                                       which is reported rather than hidden.
 * @param {boolean} args.assignVariant   write the §38 assignment row when an
 *                                       experiment is running. See below — the
 *                                       rep's own call screen passes false.
 */
export async function assembleProspectPlaybook({
  prospectId,
  rep = null,
  useAi = false,
  persist = false,
  campaignId = null,
  assignVariant = true,
} = {}) {
  const store = storeState();

  const { prospect, capabilities, technologies, opportunities } =
    await loadProspectInputs(prospectId);
  if (!prospect) return { found: false, prospectId };

  const index = indexProspect({ capabilities, technologies });

  const playbooks = await loadPlaybooks();
  const selection = selectPlaybook({ playbooks, index });

  const catalogue = selectorCatalogue();
  const selectorLabel = selection.selected
    ? catalogue.find((s) => s.key === selection.selected.selectorKey)?.label || null
    : null;

  // ── The variant, before a word is generated ─────────────────────────────
  //
  // `assignVariant: false` is not a way to opt out of §38 — it is where the
  // assignment does NOT belong. A rep opening a prospect card has not called
  // anybody; assigning there burns an arm on every prospect that gets read and
  // skipped, and it makes a GET write. The rep's own route passes false for
  // exactly that reason, and a second one: the queue gate declares ONE writable
  // model (REP_QUEUE_WRITES = ["prospect"]) and check-prospect-ui asserts that
  // list stays one, so a read route under it may not create an assignment row.
  //
  // When the playbook tables land, the assignment belongs on the dial POST —
  // /api/sales/calls, requireCallingRep — which is literally "before the call"
  // and already writes. Nothing here does it on a page load.
  let experiment = null;
  let assignment = null;
  let variant = null;
  let assignmentRefusal = null;

  if (selection.selected) {
    const running = await loadExperiments({ playbookKey: selection.selected.key });
    experiment = running[0] || null;
    if (experiment && store.ready && assignVariant) {
      const result = await readOrCreateAssignment({
        experiment,
        prospectId,
        salesRepId: rep?.id ?? null,
        derive: deriveVariant,
      });
      assignment = result.assignment;
      assignmentRefusal = result.refusal;
      variant =
        (Array.isArray(experiment.variants) ? experiment.variants : []).find(
          (v) => v?.key === assignment?.variantKey,
        ) || null;
    }
  }

  // ── The sentences ───────────────────────────────────────────────────────
  const matrix = await loadCapabilityMatrix({ includeInactive: true });
  const ctx = talkingPointContext({ opportunities, matrix });

  let generation;
  if (!useAi) {
    const { accepted, refused } = deterministicTalkingPoints(ctx);
    generation = {
      points: accepted,
      refused,
      source: "rule",
      degraded: true,
      reason: "not_requested",
      reasonText:
        "Built from the rules alone. Nothing was sent to a model — generating costs money and a page view should not spend it.",
      model: null,
    };
  } else {
    generation = await generateTalkingPoints({
      prospect,
      playbook: selection.selected ? { ...selection.selected, selectorLabel } : null,
      ctx,
      campaignId,
      salesRepId: rep?.id ?? null,
      // Idempotent per prospect per playbook: a retried pipeline task must not
      // bill FieldQuo twice for the same three sentences.
      ref: `playbook:${prospectId}:${selection.selected?.key || "none"}`,
    });
  }

  let persisted = false;
  if (persist && store.ready && selection.selected) {
    await storeTalkingPoints({
      prospectId,
      playbookKey: selection.selected.key,
      points: generation.points,
      model: generation.model,
    });
    persisted = true;
  }

  const objections = objectionsForProspect({ objections: await loadObjections(), index });

  const script = selection.selected
    ? buildCallScript({
        playbook: playbooks.find((p) => p.key === selection.selected.key) || null,
        variant,
        prospect,
        index,
        rep,
        points: generation.points,
        objections,
      })
    : null;

  return {
    found: true,
    prospect: {
      id: prospect.id,
      businessName: prospect.businessName,
      city: prospect.city,
      tradeKey: prospect.tradeKey,
      phoneE164: prospect.phoneE164,
      domain: prospect.domain,
    },
    // The whole inspectable answer to "why am I saying this?", every time.
    selection: { ...selection, selectorLabel },
    // What we have NOT looked at. Carried up from the index rather than
    // recomputed, so a rep reading a two-point script off a business whose site
    // timed out sees that instead of a confident two.
    unchecked: index.unchecked,
    conflicts: index.conflicts,
    experiment: experiment
      ? {
          key: experiment.key,
          name: experiment.name,
          hypothesis: experiment.hypothesis,
          variantKey: assignment?.variantKey ?? null,
          assignedAt: assignment?.assignedAt ?? null,
          assignedBy: assignment?.assignedBy ?? null,
          refusal: assignmentRefusal,
        }
      : null,
    talkingPoints: generation.points,
    refusedPoints: generation.refused,
    generation: {
      source: generation.source,
      degraded: generation.degraded,
      reason: generation.reason,
      reasonText: generation.reasonText,
      model: generation.model,
      persisted,
    },
    objections,
    script,
    store,
  };
}
