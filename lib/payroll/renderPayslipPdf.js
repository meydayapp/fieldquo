// lib/payroll/renderPayslipPdf.js
//
// A payslip PDF, branded like every other document the company sends.
//
// ── This prints the run, it does not recompute it ───────────────────────────
//
// Every number here comes from the stored PayRunLine. The engine already ran,
// the company already approved the figures, and the person may already have
// been paid them. Re-deriving anything at render time risks a payslip that
// disagrees with the pay — so `items` is printed in the order it was computed,
// and the renderer decides nothing.
//
// ── It is a record, not a legal filing ──────────────────────────────────────
//
// The header says which regime's labels are in use and says plainly that
// FieldQuo neither remitted nor filed anything. A document that looks like a T4
// or a P60 and isn't would be worse than no document.

import { Document, Page, Text, View, Image, renderToBuffer } from "@react-pdf/renderer";
import { documentTheme, fillPair, ruleColor } from "@/lib/documents/theme";
import { formatDateOnly } from "@/lib/format/companyDate";
import { REGION_LABELS } from "@/lib/payroll/computePayRun";

function money(n, currency = "$") {
  const v = Number(n || 0);
  const s = Math.abs(v).toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  return `${v < 0 ? "-" : ""}${currency}${s}`;
}

// Pay period boundaries are calendar days stored as midnight UTC. Rendering
// them with a local formatter puts a Toronto reader four hours behind midnight
// and prints the previous day — a payslip saying the period ended on the 25th
// when it ended on the 26th. See the note in lib/format/companyDate.js.
const shortDate = (d) => formatDateOnly(d);

// paidAt is a real instant, not a calendar day, so it keeps a locale formatter.
// The PDF is rendered on a server, so it pins a timezone rather than inheriting
// whichever region the function happened to run in.
function stamp(d) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("en-CA", {
    year: "numeric",
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });
}

function Row({ label, value, bold, theme, muted }) {
  return (
    <View
      style={{
        flexDirection: "row",
        justifyContent: "space-between",
        paddingVertical: 3,
      }}
    >
      <Text
        style={{
          fontSize: 9.5,
          fontFamily: bold ? "Helvetica-Bold" : "Helvetica",
          color: muted ? theme.inkMuted : theme.ink,
          flex: 1,
          paddingRight: 12,
        }}
      >
        {label}
      </Text>
      <Text
        style={{
          fontSize: 9.5,
          fontFamily: bold ? "Helvetica-Bold" : "Helvetica",
          color: muted ? theme.inkMuted : theme.ink,
        }}
      >
        {value}
      </Text>
    </View>
  );
}

function Divider({ theme }) {
  return (
    <View
      style={{
        borderBottomWidth: 0.7,
        borderBottomColor: ruleColor(theme),
        marginVertical: 6,
      }}
    />
  );
}

/**
 * @param line     a PayRunLine row (items already an array)
 * @param run      the PayRun it belongs to
 * @param company  for branding
 * @param currency symbol only — the run stores no currency, so the caller
 *                 passes the company's. Defaulting to "$" silently would print
 *                 a euro payroll with a dollar sign.
 */
export async function renderPayslipPdfBuffer({ line, run, company, currency = "$" }) {
  const theme = documentTheme(company || {});
  const band = fillPair(theme);
  const items = Array.isArray(line.items) ? line.items : [];

  const earnings = items.filter((i) => i.kind !== "deduction");
  const deductions = items.filter((i) => i.kind === "deduction");
  const regionLabel = REGION_LABELS[run.region]?.slipName || "Payslip";

  const doc = (
    <Document title={`Payslip — ${line.workerName}`}>
      <Page size="LETTER" style={{ padding: 40, fontFamily: "Helvetica", color: theme.ink }}>
        {/* Header — the company's identity, not FieldQuo's. */}
        <View
          style={{
            flexDirection: "row",
            justifyContent: "space-between",
            alignItems: "flex-start",
            marginBottom: 4,
          }}
        >
          <View style={{ flex: 1 }}>
            {company?.logoUrl ? (
              <Image src={company.logoUrl} style={{ maxHeight: 42, maxWidth: 150, marginBottom: 6 }} />
            ) : (
              <Text style={{ fontSize: 15, fontFamily: "Helvetica-Bold" }}>
                {company?.name || "Payslip"}
              </Text>
            )}
            {company?.address ? (
              <Text style={{ fontSize: 8.5, color: theme.inkMuted }}>{company.address}</Text>
            ) : null}
          </View>
          <View style={{ alignItems: "flex-end" }}>
            {/* accentText, not accent: the same hex is 5.6:1 as a fill and
                2.9:1 as text. theme.js measures both; this is the text one. */}
            <Text style={{ fontSize: 16, fontFamily: "Helvetica-Bold", color: theme.accentText }}>
              Payslip
            </Text>
            <Text style={{ fontSize: 8.5, color: theme.inkMuted }}>{regionLabel}</Text>
          </View>
        </View>

        <View
          style={{
            backgroundColor: band.bg,
            paddingVertical: 8,
            paddingHorizontal: 12,
            borderRadius: 4,
            marginTop: 12,
            marginBottom: 14,
          }}
        >
          <Text style={{ fontSize: 12, fontFamily: "Helvetica-Bold", color: band.fg }}>
            {line.workerName}
          </Text>
          <Text style={{ fontSize: 9, color: band.fg }}>
            {shortDate(run.periodStart)} – {shortDate(run.periodEnd)}
            {"   ·   "}
            {line.workerType === "contractor" ? "Contractor" : "Employee"}
            {line.hourlyRate != null ? `   ·   ${money(line.hourlyRate, currency)}/hr` : ""}
          </Text>
        </View>

        {/* Hours, when there are any. A salaried line has none and printing
            "0.00 hours" would read as a mistake rather than a salary. */}
        {Number(line.regularHours) > 0 || Number(line.overtimeHours) > 0 ? (
          <View style={{ marginBottom: 6 }}>
            <Text
              style={{
                fontSize: 8.5,
                fontFamily: "Helvetica-Bold",
                color: theme.inkMuted,
                marginBottom: 2,
              }}
            >
              HOURS
            </Text>
            <Row theme={theme} label="Regular" value={Number(line.regularHours).toFixed(2)} />
            {Number(line.overtimeHours) > 0 && (
              <Row theme={theme} label="Overtime" value={Number(line.overtimeHours).toFixed(2)} />
            )}
            <Divider theme={theme} />
          </View>
        ) : null}

        <Text
          style={{
            fontSize: 8.5,
            fontFamily: "Helvetica-Bold",
            color: theme.inkMuted,
            marginBottom: 2,
          }}
        >
          EARNINGS
        </Text>
        {earnings.length ? (
          earnings.map((i, idx) => (
            <Row key={idx} theme={theme} label={i.label} value={money(i.amount, currency)} />
          ))
        ) : (
          <Row theme={theme} muted label="No earnings recorded for this period" value="" />
        )}
        <Divider theme={theme} />
        <Row theme={theme} bold label="Gross pay" value={money(line.gross, currency)} />

        <View style={{ height: 14 }} />

        <Text
          style={{
            fontSize: 8.5,
            fontFamily: "Helvetica-Bold",
            color: theme.inkMuted,
            marginBottom: 2,
          }}
        >
          DEDUCTIONS
        </Text>
        {deductions.length ? (
          deductions.map((i, idx) => (
            <Row key={idx} theme={theme} label={i.label} value={money(i.amount, currency)} />
          ))
        ) : (
          // Said out loud. A blank deductions block on a gross-only run looks
          // like a rendering failure, not a company that hasn't set them up.
          <Row
            theme={theme}
            muted
            label="None set up — this payslip shows gross figures"
            value=""
          />
        )}
        <Divider theme={theme} />
        <Row theme={theme} bold label="Total deductions" value={money(line.deductions, currency)} />

        <View
          style={{
            marginTop: 18,
            backgroundColor: band.bg,
            paddingVertical: 10,
            paddingHorizontal: 12,
            borderRadius: 4,
            flexDirection: "row",
            justifyContent: "space-between",
          }}
        >
          <Text style={{ fontSize: 12, fontFamily: "Helvetica-Bold", color: band.fg }}>
            Net pay
          </Text>
          <Text style={{ fontSize: 12, fontFamily: "Helvetica-Bold", color: band.fg }}>
            {money(line.net, currency)}
          </Text>
        </View>

        <View style={{ marginTop: 20 }}>
          <Text style={{ fontSize: 7.5, color: theme.inkMuted, lineHeight: 1.5 }}>
            Pay period {shortDate(run.periodStart)} to {shortDate(run.periodEnd)}.
            {run.paidAt
              ? ` Recorded as paid on ${stamp(run.paidAt)}.`
              : run.status === "approved"
                ? " Approved, not yet recorded as paid."
                : " Draft — not yet approved."}
          </Text>
          <Text style={{ fontSize: 7.5, color: theme.inkMuted, lineHeight: 1.5, marginTop: 4 }}>
            Deduction names follow {run.region} conventions. This is a record of
            what was calculated and paid — it is not a government form, and no
            tax has been remitted or filed on your behalf through this system.
            Keep it for your records and check figures with your employer.
          </Text>
        </View>
      </Page>
    </Document>
  );

  return renderToBuffer(doc);
}
