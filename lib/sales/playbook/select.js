// lib/sales/playbook/select.js
//
// Which playbook, and — the part that matters — why.
//
// ══ The output is a TRACE, not an answer ══════════════════════════════════
//
// §58 draws the line and it is not negotiable: AI may personalise language;
// the reason a playbook was selected must remain deterministic and inspectable.
// A rep who asks "why am I saying this?" gets a rule and the observations it
// read, and a superadmin who asks "why does my new playbook never open?" gets
// the refusal for every playbook that was considered — not silence.
//
// So this function returns every playbook it looked at, in the order it looked
// at them, with a refusal code on each. That is the same shape
// `buildOpportunities` returns its `skipped` list in, and for the same reason:
// "it produced nothing" is not an answer anybody can act on.
//
// ══ Deterministic ordering, and the tie-break is part of the contract ═════
//
// Priority descending, then key ascending. The second half is not a
// tidiness measure — it is what makes the answer independent of the order
// Postgres happened to return the rows in. Two playbooks at the same priority
// must select the same one on every run, or a rep's script quietly changes
// between two page loads and nobody can reproduce the one they complained
// about.
//
// ══ The competitor guard outranks priority, deliberately ══════════════════
//
// A playbook whose selector describes a GAP (no website, no booking page, no
// enquiry form) may not be selected for a business already running a
// field-service platform. That is not a preference a superadmin should be able
// to override with a priority number: telling somebody on Jobber that they
// need online booking tells them we did not look, and it ends the call. Same
// argument, same direction, as `competitor_table_stakes` in
// lib/sales/intel/opportunity.js — and enforced here as well as there for the
// reason the impersonation gate is in two files.
import { runSelector, selector } from "./selectors";

/** Why one playbook was not the one. A closed vocabulary the screens render off. */
export const SELECTION_REFUSALS = Object.freeze({
  inactive_playbook: "The playbook is switched off.",
  unknown_selector:
    "The playbook names a selection rule this engine does not implement, so it could never open.",
  conditions_not_met: "This prospect does not match the playbook's selection rule.",
  not_yet_observed:
    "This prospect does not match, and at least one thing the rule reads has never been observed — we have not looked, rather than looked and found nothing.",
  pitches_what_they_have:
    "A competitor's platform is already installed. This playbook opens on a gap that any such platform would already fill, so it would tell them we had not looked.",
  lower_priority: "It matched, and a higher-priority playbook matched too.",
  tie_broken_by_key:
    "It matched at the same priority as the selected playbook, and the tie is broken on the key so the answer is the same on every run.",
});

/** Why nothing was selected, when nothing was. Distinct from a per-playbook refusal. */
export const SELECTION_REASONS = Object.freeze({
  no_playbooks: "There are no active playbooks to choose from.",
  nothing_observed:
    "Nothing has been observed about this business yet — no capabilities, no technologies. There is nothing for a rule to read.",
  nothing_matched:
    "Everything we know about this business was checked against every playbook and none of their rules matched.",
  all_refused:
    "A playbook's rule matched and every match was refused before it could open.",
});

/**
 * @param {object} args
 * @param {Array} args.playbooks  rows: { key, name, selectorKey, priority, active, version }
 * @param {object} args.index     the output of indexProspect() from lib/sales/intel/opportunity
 * @returns {{
 *   selected: object|null,
 *   alternatives: Array,
 *   reason: string|null,
 *   reasonText: string|null,
 *   trace: Array,
 *   competitorDetected: boolean,
 * }}
 */
export function selectPlaybook({ playbooks = [], index = {} } = {}) {
  const list = Array.isArray(playbooks) ? playbooks : [];
  const competitors = Array.isArray(index?.competitors) ? index.competitors : [];
  const competitorDetected = competitors.length > 0;

  const ordered = [...list].sort(
    (a, b) =>
      (Number(b?.priority) || 0) - (Number(a?.priority) || 0) ||
      String(a?.key || "").localeCompare(String(b?.key || "")),
  );

  const trace = [];
  let selected = null;
  const alternatives = [];

  for (const pb of ordered) {
    const priority = Number(pb?.priority) || 0;
    const base = {
      key: pb?.key ?? null,
      name: pb?.name ?? null,
      selectorKey: pb?.selectorKey ?? null,
      priority,
      version: pb?.version ?? null,
    };

    const push = (refusal, extra = {}) => {
      trace.push({
        ...base,
        ...extra,
        matched: extra.matched === true,
        refusal,
        refusalText: refusal ? SELECTION_REFUSALS[refusal] || refusal : null,
      });
    };

    if (pb?.active === false) {
      push("inactive_playbook");
      continue;
    }

    const def = selector(pb?.selectorKey);
    if (!def) {
      push("unknown_selector");
      continue;
    }

    // Before the rule, not after. A refusal that says "a competitor is
    // installed" is the sentence a superadmin needs; "conditions not met"
    // would send them to debug a rule that is working correctly.
    if (competitorDetected && def.needsCompetitor === false) {
      push("pitches_what_they_have", {
        facts: [
          {
            label: "competitor detected",
            value: competitors.map((c) => c.technologyCode).join(", "),
          },
        ],
      });
      continue;
    }

    const run = runSelector(pb.selectorKey, index);
    if (!run.matched) {
      push(run.unknown ? "not_yet_observed" : "conditions_not_met", {
        facts: run.facts,
        describe: run.describe,
        unresolved: run.unresolved,
      });
      continue;
    }

    if (selected) {
      const refusal =
        priority === selected.priority ? "tie_broken_by_key" : "lower_priority";
      push(refusal, { matched: true, facts: run.facts, describe: run.describe });
      alternatives.push({ ...base, refusal, facts: run.facts });
      continue;
    }

    selected = {
      ...base,
      matched: true,
      describe: run.describe,
      facts: run.facts,
      observationEvidenceIds: run.observationEvidenceIds,
    };
    push(null, {
      matched: true,
      facts: run.facts,
      describe: run.describe,
      observationEvidenceIds: run.observationEvidenceIds,
    });
  }

  let reason = null;
  if (!selected) {
    if (ordered.length === 0) reason = "no_playbooks";
    else if (!index?.sampleSize) reason = "nothing_observed";
    else if (trace.every((t) => t.refusal === "conditions_not_met" || t.refusal === "not_yet_observed")) {
      reason = "nothing_matched";
    } else reason = "all_refused";
  }

  return {
    selected,
    alternatives,
    reason,
    reasonText: reason ? SELECTION_REASONS[reason] || reason : null,
    trace,
    competitorDetected,
  };
}
