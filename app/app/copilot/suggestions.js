// app/app/copilot/suggestions.js
//
// The "Try asking" chips for /app/copilot, as a pure function so the check
// script can execute the same gating the page renders. Kept out of page.js
// because a page module exports a page and nothing else.
import { hasLevel, hasToggle } from "@/lib/permissions/enforce";

// ── Suggestions the asker can actually get an answer to ──────────────────
//
// Each chip names the tool that answers it, and is shown only when that
// tool's own access rule (TOOL_ACCESS in lib/ai/copilotTools.js) holds for
// the caller. A tappable suggestion that reliably fails is the dead control
// this codebase keeps being swept for, and it is worse coming from an
// assistant: the model has to refuse a question the app itself proposed —
// which is exactly what the owner saw when "Which clients haven't been
// invoiced yet?" was a chip and there was no tool behind it.
//
// The conditions are written out here rather than imported, because
// copilotTools.js reaches the database and this is a client component.
// scripts/check-assistant-tools.mjs executes both against the same members
// and fails if they ever disagree.
export function copilotSuggestions(t, caller) {
  const seesMoney = hasToggle(caller, "showPricing");
  const seesQuotes = hasLevel(caller, "quotes", "view_only");
  const seesInvoices = hasLevel(caller, "invoices", "view_only");
  const seesJobs = hasLevel(caller, "jobs", "view_only");

  const chips = [];
  if (seesQuotes && seesInvoices)
    chips.push({ tool: "getUnbilledWork", text: t("app.copilot.suggest1", "Which clients haven't been invoiced yet?") });
  if (seesQuotes && seesMoney)
    chips.push({ tool: "getAverageQuoteValue", text: t("app.copilot.suggest2", "What's my average quote value this month?") });
  if (seesMoney && hasLevel(caller, "expenses", "view_record_edit_all"))
    chips.push({ tool: "getMaterialCostChanges", text: t("app.copilot.suggest3", "Which material costs went up the most?") });
  if (seesQuotes)
    chips.push({ tool: "countQuotesByStatus", text: t("app.copilot.suggest4", "How many quotes are still waiting on a response?") });
  if (seesInvoices && seesMoney && hasToggle(caller, "payments"))
    chips.push({ tool: "getReceivables", text: t("app.copilot.suggest5", "How much money is still owed to us?") });
  // What is left for someone with no money tools: the schedule, which
  // getJobsThisWeek serves to anyone who may see jobs — narrowed to their
  // own jobs when that is all they may see.
  if (seesJobs && !seesMoney) {
    chips.push({ tool: "getJobsThisWeek", text: t("app.copilot.suggestWork1", "What work is coming up this week?") });
    chips.push({ tool: "getJobsThisWeek", text: t("app.copilot.suggestWork2", "Which jobs am I assigned to?") });
  }
  return chips;
}

