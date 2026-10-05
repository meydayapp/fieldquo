// app/components/marketing/home/research.js
//
// The industry figures the homepage's results section prints — and the only
// numbers on the homepage that are not FieldQuo's own.
//
// ══ What these numbers ARE ═════════════════════════════════════════════════
//
// "2026 Customer Benchmark Report" (an industry survey, April 2026): 54 commercial
// contractors were surveyed after moving to one connected platform. Every
// `share` below is the proportion of those 54 who REPORTED an improvement.
// It is not the size of the improvement, and they are not FieldQuo
// customers. "76% report more revenue per tech" is the statement;
// "76% more revenue" is a different statement the report does not make, and
// the page never makes it. `toolsReplaced` is the one average, and it is
// labelled as one.
//
// Owner-approved wording, 2026-09-29. Change a figure only against the report
// itself; check:homepage-sections pins every value to the brief so an edit
// here is a deliberate act, not a typo.
//
// No invented testimonials, customer counts, logos or metrics go in this file
// or beside it. FieldQuo's own results appear when the owner has real ones.
export const RESEARCH_SOURCE = Object.freeze({
  // A title, printed as-is in every language: it is the name of a document.
  report: "2026 Customer Benchmark Report",
  contractors: 54,
  // Year and month only; rendered as a month name in the reader's language.
  published: { year: 2026, month: 4 },
});

export const RESEARCH_STATS = Object.freeze([
  { key: "volume", share: 0.8 },
  { key: "revenuePerTech", share: 0.76 },
  { key: "margins", share: 0.76 },
  { key: "growth", share: 0.72 },
  { key: "invoicing", share: 0.75 },
  { key: "quoteTurnaround", share: 0.76 },
  { key: "winRate", share: 0.64 },
  { key: "tools", average: 2.6 },
]);
