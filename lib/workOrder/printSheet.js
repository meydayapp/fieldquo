// lib/workOrder/printSheet.js
//
// The work order as a sheet of paper, for a browser's print dialog. The
// crew's copy: hidden items absent, no prices, no client phone number unless
// the caller's redaction left one in the model. Pure: HTML in, HTML out.
import { escapeHtml } from "@/lib/email/emailTheme";
import { documentTheme } from "@/lib/documents/theme";
import { workOrderCopy } from "./copy";

function fmtDate(d, language) {
  if (!d) return null;
  const date = new Date(d);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleDateString(language === "fr" ? "fr-CA" : language === "es" ? "es" : "en-CA", { day: "numeric", month: "short" });
}

export function workOrderPrintHtml({ company = {}, workOrder, language = "en", printLabel = "Print" }) {
  if (!workOrder) return null;
  const theme = documentTheme(company);
  const c = workOrderCopy(language);
  const wo = workOrder;
  const start = fmtDate(wo.job?.startDate, language);
  const end = fmtDate(wo.job?.endDate, language);
  const dates = start && end && start !== end ? `${start} – ${end}` : start || end || "";
  const areas = wo.areas.filter((a) => !a.hidden);

  return `<!doctype html>
<html lang="${escapeHtml(language)}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex">
<title>${escapeHtml(wo.job?.title || "")} — ${escapeHtml(c.title)}</title>
<style>
  :root { color-scheme: light; }
  * { box-sizing: border-box; }
  body { margin: 0; font: 12.5px/1.45 -apple-system, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; color: ${theme.ink}; background: #fff; }
  .bar { display: flex; justify-content: flex-end; padding: 10px 16px; border-bottom: 1px solid ${theme.border}; }
  .bar button { font: inherit; font-weight: 600; padding: 8px 14px; border: 1px solid ${theme.border}; background: #fff; border-radius: 6px; cursor: pointer; }
  main { max-width: 820px; margin: 0 auto; padding: 24px 16px 40px; }
  .co { font-size: 11px; font-weight: 700; letter-spacing: .08em; text-transform: uppercase; color: ${theme.accentText}; }
  .kind { color: ${theme.inkMuted}; font-size: 12px; }
  .hd { display: flex; justify-content: space-between; gap: 12px; border-bottom: 2px solid ${theme.ink}; padding-bottom: 10px; margin-top: 6px; flex-wrap: wrap; }
  .hd h1 { font-size: 18px; margin: 0; }
  .hd .sub { color: ${theme.inkMuted}; font-size: 12px; margin-top: 2px; }
  .hd .r { text-align: right; }
  .hd .r b { font-size: 18px; display: block; }
  .hd .r span { color: ${theme.inkMuted}; font-size: 11px; }
  .area { display: grid; grid-template-columns: 22px 1fr; gap: 10px; padding: 12px 0; border-bottom: 1px solid ${theme.borderSoft}; break-inside: avoid; }
  .chk { display: inline-block; width: 15px; height: 15px; border: 1.5px solid ${theme.inkMuted}; border-radius: 3px; margin-top: 2px; }
  .chk.on { background: ${theme.ink}; border-color: ${theme.ink}; }
  .h { font-weight: 700; }
  .h span { font-weight: 400; color: ${theme.inkMuted}; }
  .area p { margin: 3px 0 0; }
  .detail { color: ${theme.inkMuted}; font-size: 11.5px; }
  .cn { color: ${theme.warning}; font-size: 12px; margin-top: 3px; }
  .who { color: ${theme.inkMuted}; font-size: 11px; margin-top: 2px; }
  .foot { margin-top: 14px; color: ${theme.inkMuted}; font-size: 11px; }
  @media print { .bar { display: none; } main { padding: 0; } @page { margin: 14mm; } }
</style>
</head>
<body>
<div class="bar"><button type="button" onclick="window.print()">${escapeHtml(printLabel)}</button></div>
<main>
  <div class="co">${escapeHtml(company.name || "")}</div>
  <div class="kind">${escapeHtml(c.title)}</div>
  <div class="hd">
    <div>
      <h1>${escapeHtml(wo.job?.title || "")}</h1>
      <div class="sub">${escapeHtml([wo.job?.siteAddress, wo.client?.name, dates].filter(Boolean).join(" · "))}</div>
    </div>
    <div class="r"><b>${escapeHtml(String(wo.displayHours))} h</b><span>${escapeHtml(c.across(areas.length))}</span>${
      wo.crew?.length ? `<br><span>${escapeHtml(c.crew)}: ${escapeHtml(wo.crew.join(", "))}</span>` : ""
    }</div>
  </div>
  ${areas
    .map(
      (a) => `
  <div class="area">
    <div><span class="chk${a.done ? " on" : ""}"></span></div>
    <div>
      <div class="h">${escapeHtml(a.label)} <span>· ${escapeHtml(String(a.displayHours))} h${a.done ? ` · ${escapeHtml(c.done)}` : ""}</span></div>
      ${a.scope ? `<p>${escapeHtml(a.scope)}</p>` : ""}
      ${(a.lines || []).filter((l) => l.detail && !l.hidden).map((l) => `<p class="detail">${escapeHtml(l.detail)}</p>`).join("")}
      ${a.crewNote ? `<div class="cn">${escapeHtml(c.crewNote)}: ${escapeHtml(a.crewNote)}</div>` : ""}
      ${a.assignee ? `<div class="who">${escapeHtml(a.assignee)}</div>` : ""}
    </div>
  </div>`,
    )
    .join("")}
  <div class="foot">${escapeHtml(wo.hiddenCount > 0 ? c.hiddenNote(wo.hiddenCount) : c.noPrices)}</div>
</main>
</body>
</html>`;
}
