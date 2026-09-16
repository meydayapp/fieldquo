#!/usr/bin/env node
// scripts/build-sred-log.mjs
//
//   node scripts/build-sred-log.mjs            # rewrites docs/sred/LOG.md
//
// The contemporaneous SR&ED record, generated from the commit history of the
// modules where the technological uncertainty actually lives. A claim
// reconstructed at tax time from memory is the claim CRA rejects; a log that
// grew with the work is the one it accepts. This script is re-run after
// merges so the log never lags the repository.
//
// ── What counts and what does not ──────────────────────────────────────────
//
// SR&ED is systematic investigation to resolve technological uncertainty —
// not "we wrote software". Wiring Stripe, a scheduling grid or a settings
// page is routine engineering and is deliberately NOT in the path list
// below. The five projects here are the threads where the repository shows
// hypotheses, failed attempts and revisions: the voice receptionist, the
// crawler's evidence model, extraction from conversations, constrained AI
// review, and multilingual generation under shape rules. docs/sred/README.md
// says what each uncertainty was; this file is the dated evidence beside it.
//
// Every entry is a real commit: sha, date, subject. Nothing is written that
// git does not hold.
import { execFileSync } from "node:child_process";
import { writeFileSync } from "node:fs";

const PROJECTS = [
  {
    key: "voice",
    title: "P1 · Autonomous voice receptionist",
    paths: ["lib/voice", "app/api/voice", "app/api/webhooks/retell", "app/api/webhooks/twilio"],
  },
  {
    key: "crawl",
    title: "P2 · Evidence-grounded capability detection (web crawler)",
    paths: ["lib/sales/crawl", "lib/sales/intel", "lib/sales/discovery/reviewFolder.js", "lib/sales/discovery/mergeProspects.js"],
  },
  {
    key: "extract",
    title: "P3 · Structured extraction from conversations",
    paths: ["lib/ai/callQuoteDraft.js", "lib/ai/callLeadRecovery.js", "lib/ai/callTranscriptDigest.js", "lib/ai/conversationReview.js", "lib/ai/conversationTemperature.js", "lib/ai/copilotTools.js"],
  },
  {
    key: "review",
    title: "P4 · Constrained AI review of commercial documents",
    paths: ["lib/ai/quoteReview.js", "lib/ai/visionPass.js", "lib/ai/jsonSchema.js", "lib/ai/provider.js", "lib/ai/quoteSuggestions.js", "lib/quotes/completeness.js"],
  },
  {
    key: "script",
    title: "P5 · Multilingual generation under shape rules (call scripts, playbooks, site copy)",
    paths: ["lib/sales/playbook", "lib/sales/pipeline", "lib/site/generateSite.js", "lib/i18n/clientLanguage.js"],
  },
];

function commits(paths) {
  const out = execFileSync(
    "git",
    ["log", "--no-merges", "--date=short", "--format=%h%x09%ad%x09%an%x09%s", "--", ...paths],
    { encoding: "utf8" },
  );
  return out
    .split("\n")
    .filter(Boolean)
    .map((line) => {
      const [sha, date, author, ...rest] = line.split("\t");
      return { sha, date, author, subject: rest.join("\t") };
    });
}

const seen = new Set();
let md = `# SR&ED contemporaneous log — FieldQuo Inc.\n\n`;
md += `Generated ${new Date().toISOString().slice(0, 10)} by \`scripts/build-sred-log.mjs\` from the repository's own history. `;
md += `Each line is a commit (short sha · date · author · subject). The technological uncertainty each project addresses is stated in [README.md](./README.md); this file is the dated evidence of the systematic work.\n\n`;
md += `Routine engineering (payments, scheduling, settings, marketing pages) is excluded by construction — only the paths listed in the script are read.\n\n`;

let total = 0;
for (const p of PROJECTS) {
  const rows = commits(p.paths).filter((c) => !seen.has(c.sha));
  rows.forEach((c) => seen.add(c.sha));
  total += rows.length;
  md += `## ${p.title}\n\n`;
  md += `Paths: ${p.paths.map((x) => `\`${x}\``).join(", ")} — ${rows.length} commits.\n\n`;
  const byMonth = new Map();
  for (const c of rows) {
    const m = c.date.slice(0, 7);
    if (!byMonth.has(m)) byMonth.set(m, []);
    byMonth.get(m).push(c);
  }
  for (const [month, list] of [...byMonth.entries()].sort((a, b) => b[0].localeCompare(a[0]))) {
    md += `### ${month} (${list.length})\n\n`;
    for (const c of list) md += `- \`${c.sha}\` ${c.date} — ${c.subject}\n`;
    md += `\n`;
  }
}
md += `---\n\n${total} commits across ${PROJECTS.length} projects.\n`;
writeFileSync("docs/sred/LOG.md", md);
console.log(`docs/sred/LOG.md: ${total} commits across ${PROJECTS.length} projects`);
