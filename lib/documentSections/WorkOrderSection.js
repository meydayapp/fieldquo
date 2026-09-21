// lib/documentSections/WorkOrderSection.js
//
// The crew work order as a PDF: masthead (job, address, client name, dates,
// crew, hours), then one block per area — a tick box, the area's label and
// hours, the scope sentence, the crew note — and a foot saying what is not
// on the page.
//
// The model comes from lib/workOrder/build.js (data.workOrder) and carries no
// money, so nothing here has a price to print even if asked. Same palette
// rules as every document: every text/background pair measured through
// lib/documents/theme.js. Listed in sectionMeta with
// `types: ["work_order_pdf"]` so the template editor never offers it on a
// quote or invoice. Rendered on a document with no `workOrder` it prints
// nothing.

import { View, Text } from "@react-pdf/renderer";
import { PDF_FONT_BOLD } from "@/lib/documents/pdfFont";
import { reportPalette } from "./reportShared";
import { workOrderCopy } from "@/lib/workOrder/copy";

export const meta = { type: "work_order", label: "Work order" };

export function renderEmailHtml() {
  // The work order is a PDF and a page; there is no covering email.
  return "";
}


function fmtDate(d, language) {
  if (!d) return null;
  const date = new Date(d);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleDateString(language === "fr" ? "fr-CA" : language === "es" ? "es" : "en-CA", {
    day: "numeric",
    month: "short",
  });
}

export function PdfSection({ company = {}, data = {}, language = "en" }) {
  const wo = data?.workOrder;
  if (!wo || typeof wo !== "object") return null;
  const palette = reportPalette(company);
  const { theme } = palette;
  const c = workOrderCopy(language);
  const start = fmtDate(wo.job?.startDate, language);
  const end = fmtDate(wo.job?.endDate, language);
  const dates = start && end && start !== end ? `${start} – ${end}` : start || end || null;
  const sub = [wo.job?.siteAddress, wo.client?.name, dates].filter(Boolean).join(" · ");

  return (
    <View>
      <Text style={{ fontSize: 8, fontFamily: PDF_FONT_BOLD, letterSpacing: 1, color: theme.accentText }}>
        {String(company.name || "").toUpperCase()}
      </Text>
      <Text style={{ fontSize: 9, color: theme.inkMuted, marginTop: 2 }}>{c.title}</Text>
      <View
        style={{
          flexDirection: "row",
          justifyContent: "space-between",
          alignItems: "flex-end",
          borderBottom: `1.5 solid ${theme.ink}`,
          paddingBottom: 8,
          marginTop: 6,
        }}
      >
        <View style={{ flex: 1, paddingRight: 12 }}>
          <Text style={{ fontSize: 15, fontFamily: PDF_FONT_BOLD, color: theme.ink }}>{wo.job?.title || ""}</Text>
          {sub ? <Text style={{ fontSize: 9, color: theme.inkMuted, marginTop: 2 }}>{sub}</Text> : null}
        </View>
        <View style={{ alignItems: "flex-end" }}>
          <Text style={{ fontSize: 14, fontFamily: PDF_FONT_BOLD, color: theme.ink }}>{wo.displayHours} h</Text>
          <Text style={{ fontSize: 8, color: theme.inkMuted }}>{c.across(wo.stats?.areas ?? wo.areas.length)}</Text>
          {wo.crew?.length ? (
            <Text style={{ fontSize: 8, color: theme.inkMuted, marginTop: 2 }}>
              {c.crew}: {wo.crew.join(", ")}
            </Text>
          ) : null}
        </View>
      </View>

      {wo.areas
        .filter((a) => !a.hidden)
        .map((a) => (
          <View
            key={a.key}
            wrap={false}
            style={{ flexDirection: "row", paddingVertical: 8, borderBottom: `0.5 solid ${theme.borderSoft}` }}
          >
            <View
              style={{
                width: 11,
                height: 11,
                borderRadius: 2,
                border: `1 solid ${a.done ? theme.ink : theme.inkMuted}`,
                backgroundColor: a.done ? theme.ink : undefined,
                marginRight: 8,
                marginTop: 1,
              }}
            />
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 10, fontFamily: PDF_FONT_BOLD, color: theme.ink }}>
                {a.label}
                <Text style={{ fontFamily: undefined, color: theme.inkMuted }}>
                  {`  ·  ${a.displayHours} h`}
                  {a.done ? `  ·  ${c.done}` : ""}
                </Text>
              </Text>
              {a.scope ? (
                <Text style={{ fontSize: 9, color: theme.ink, marginTop: 2, lineHeight: 1.4 }}>{a.scope}</Text>
              ) : null}
              {a.lines?.some((l) => l.detail) ? (
                <Text style={{ fontSize: 8.5, color: theme.inkMuted, marginTop: 2, lineHeight: 1.4 }}>
                  {a.lines.filter((l) => l.detail && !l.hidden).map((l) => l.detail).join(" ")}
                </Text>
              ) : null}
              {a.crewNote ? (
                <Text style={{ fontSize: 9, color: theme.warning || theme.accentText, marginTop: 3 }}>
                  {c.crewNote}: {a.crewNote}
                </Text>
              ) : null}
              {a.assignee ? (
                <Text style={{ fontSize: 8, color: theme.inkMuted, marginTop: 2 }}>{a.assignee}</Text>
              ) : null}
            </View>
          </View>
        ))}

      <Text style={{ fontSize: 7.5, color: theme.inkMuted, lineHeight: 1.4, marginTop: 14 }}>
        {wo.hiddenCount > 0 ? c.hiddenNote(wo.hiddenCount) : c.noPrices}
      </Text>
    </View>
  );
}
