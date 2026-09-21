// lib/materials/printSheet.js
//
// The material list as a sheet of paper — the one that goes on the dashboard
// of the van. Grouped the way the screen is, with the need, the unit, what is
// on hand and the reason; a box to tick per line.
//
// NO PRICES. A printed list changes hands at a trade counter and gets left on
// a passenger seat; the estimate and what was paid stay on the screen, behind
// the jobCosting toggle that already decides who sees them. Nothing on the
// sheet names FieldQuo: the company's name heads it.
//
// Pure: HTML in, HTML out. app/api/jobs/[id]/materials/print serves it.
import { escapeHtml } from "@/lib/email/emailTheme";
import { documentTheme } from "@/lib/documents/theme";
import { groupRows } from "./list";

const GROUP_LABELS = {
  primary: "Primary",
  sundries: "Sundries",
  consumables: "Consumables",
  fasteners: "Fasteners / adhesives",
  transitions: "Transitions / trim",
  other: "Other",
};

/**
 * @param company    { name, brandColor, brandColors }
 * @param job        { title, client: { name }, siteAddress }
 * @param materials  the shaped rows from the materials route (qty, unit,
 *                   group, reason, onHand, status, purchasedAt)
 * @param printLabel the toolbar word, in the reader's language
 */
export function materialListPrintHtml({ company = {}, job = {}, materials = [], printLabel = "Print" }) {
  const theme = documentTheme(company);
  const groups = groupRows(materials);
  const short = materials.filter((m) => m.status === "short" && !m.purchasedAt).length;

  const rows = groups
    .map(
      (g) => `
      <tr class="grp"><td colspan="6">${escapeHtml(GROUP_LABELS[g.group] || g.group)}</td></tr>
      ${g.rows
        .map(
          (m) => `
        <tr class="${m.purchasedAt ? "done" : ""}">
          <td class="box"><span class="chk${m.purchasedAt ? " on" : ""}"></span></td>
          <td>${escapeHtml(m.name)}${m.reason ? `<div class="why">${escapeHtml(m.reason)}</div>` : ""}</td>
          <td class="num">${escapeHtml(String(m.qty))}</td>
          <td>${escapeHtml(m.unit || "")}</td>
          <td class="num">${m.wastePct ? `+${escapeHtml(String(m.wastePct))}%` : "—"}</td>
          <td class="num">${
            m.status === "untracked" || m.onHand === null || m.onHand === undefined
              ? "—"
              : `${escapeHtml(String(m.onHand))}${m.status === "short" ? ` <b>short ${escapeHtml(String(m.short))}</b>` : ""}`
          }</td>
        </tr>`,
        )
        .join("")}`,
    )
    .join("");

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex">
<title>${escapeHtml(job.title || "Material list")} — material list</title>
<style>
  :root { color-scheme: light; }
  * { box-sizing: border-box; }
  body { margin: 0; font: 12px/1.45 -apple-system, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; color: ${theme.ink}; background: #fff; }
  .bar { display: flex; justify-content: flex-end; padding: 10px 16px; border-bottom: 1px solid ${theme.border}; }
  .bar button { font: inherit; font-weight: 600; padding: 8px 14px; border: 1px solid ${theme.border}; background: #fff; border-radius: 6px; cursor: pointer; }
  main { max-width: 820px; margin: 0 auto; padding: 24px 16px 40px; }
  h1 { font-size: 18px; margin: 0; }
  .sub { color: ${theme.inkMuted}; margin-top: 2px; }
  .head { display: flex; justify-content: space-between; gap: 12px; border-bottom: 2px solid ${theme.ink}; padding-bottom: 8px; flex-wrap: wrap; }
  .co { font-weight: 700; color: ${theme.accentText}; }
  table { width: 100%; border-collapse: collapse; margin-top: 12px; }
  th { text-align: left; font-size: 10px; text-transform: uppercase; letter-spacing: .04em; color: ${theme.inkMuted}; padding: 6px 6px; border-bottom: 1px solid ${theme.border}; }
  td { padding: 6px; border-bottom: 1px solid ${theme.borderSoft || theme.border}; vertical-align: top; }
  td.num, th.num { text-align: right; font-variant-numeric: tabular-nums; white-space: nowrap; }
  tr.grp td { background: ${theme.accentWash || "#f3f4f6"}; font-weight: 700; font-size: 10px; text-transform: uppercase; letter-spacing: .04em; color: ${theme.inkOnWash || theme.ink}; padding: 4px 6px; }
  tr.done td { color: ${theme.inkMuted}; text-decoration: line-through; }
  .why { color: ${theme.inkMuted}; font-size: 11px; text-decoration: none; }
  td.box { width: 22px; }
  .chk { display: inline-block; width: 13px; height: 13px; border: 1.5px solid ${theme.inkMuted}; border-radius: 3px; vertical-align: -2px; }
  .chk.on { background: ${theme.ink}; border-color: ${theme.ink}; }
  .foot { margin-top: 12px; color: ${theme.inkMuted}; font-size: 11px; }
  @media print { .bar { display: none; } main { padding: 0; } @page { margin: 14mm; } }
</style>
</head>
<body>
<div class="bar"><button type="button" onclick="window.print()">${escapeHtml(printLabel)}</button></div>
<main>
  <div class="head">
    <div>
      <h1>${escapeHtml(job.title || "Material list")}</h1>
      <div class="sub">${escapeHtml([job.client?.name, job.siteAddress].filter(Boolean).join(" · "))}</div>
    </div>
    <div class="co">${escapeHtml(company.name || "")}</div>
  </div>
  <table>
    <thead><tr><th></th><th>Item</th><th class="num">Need</th><th>Unit</th><th class="num">Waste</th><th class="num">On hand</th></tr></thead>
    <tbody>${rows}</tbody>
  </table>
  <div class="foot">${materials.length} lines · ${short} short in stock · printed ${escapeHtml(new Date().toISOString().slice(0, 10))}</div>
</main>
</body>
</html>`;
}
