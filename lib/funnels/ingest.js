// lib/funnels/ingest.js
//
// Turn a completed funnel run into the input for a scored lead. A funnel lead is
// not a special kind of lead — it lands in the SAME pipeline, scored the same
// way, so all this does is translate "tap answers keyed by step" into the
// budget / timeline / message / intake that createScoredLead already understands.
// Pure so it can be unit-tested against hostile answer payloads.

// The answer payload the public client posts:
//   { answers: { [stepId]: value | value[] }, name, email, phone, media }
// where each single-choice value is an answer `value`, multi is an array.

function labelForValue(step, value) {
  const a = (step.answers || []).find((x) => x.value === value);
  return a?.label || value;
}

/**
 * @param {object} funnel  { steps, channel, slug }
 * @param {object} payload { answers, name, email, phone, media }
 * @returns {object} createScoredLead input (minus companyId, added by caller)
 */
export function buildLeadFromFunnel(funnel, payload = {}) {
  const steps = Array.isArray(funnel?.steps) ? funnel.steps : [];
  const answers = payload.answers && typeof payload.answers === "object" ? payload.answers : {};

  let budgetBand = null;
  let timeline = null;
  const intake = {};
  const messageLines = [];

  for (const step of steps) {
    if (step.kind !== "question_single" && step.kind !== "question_multi") continue;
    const raw = answers[step.id];
    if (raw == null || raw === "" || (Array.isArray(raw) && raw.length === 0)) continue;

    // Feed the scorer where the question is tagged.
    if (step.kind === "question_single" && step.maps === "budget") budgetBand = raw;
    if (step.kind === "question_single" && step.maps === "timeline") timeline = raw;

    // Human-readable line + structured intake entry, keyed by the question.
    const key = (step.question || step.id).slice(0, 80);
    if (Array.isArray(raw)) {
      const labels = raw.map((v) => labelForValue(step, v));
      intake[key] = labels;
      messageLines.push(`${key}: ${labels.join(", ")}`);
    } else {
      const label = labelForValue(step, raw);
      intake[key] = label;
      // Skip budget/timeline from the message blob — they surface on the lead as
      // their own fields; duplicating them just makes the note noisy.
      if (step.maps !== "budget" && step.maps !== "timeline") {
        messageLines.push(`${key}: ${label}`);
      }
    }
  }

  return {
    name: (payload.name || "Funnel enquiry").slice(0, 200),
    email: payload.email || null,
    phone: payload.phone || null,
    message: messageLines.length ? messageLines.join("\n") : null,
    source: `funnel${funnel?.channel ? `:${funnel.channel}` : ""}`,
    intake: Object.keys(intake).length ? intake : null,
    budgetBand,
    timeline,
  };
}
