// lib/documentSections/registry.js
import * as header from "./HeaderSection";
import * as clientInfo from "./ClientInfoSection";
import * as scopeGroups from "./ScopeGroupsSection";
import * as totals from "./TotalsSection";
import * as paymentSummary from "./PaymentSummarySection";
import * as paymentTerms from "./PaymentTermsSection";
import * as processSteps from "./ProcessStepsSection";
import * as signature from "./SignatureSection";
import * as notes from "./NotesSection";
import * as kitchenPlan from "./KitchenPlanSection";
import * as footer from "./FooterSection";
// The instant-estimate report (lib/estimate/report). Six sections, one
// document kind ("estimate_report_pdf"); rendered through the same
// renderDocumentPdfBuffer as a quote so there is one PDF engine, not two.
import * as reportHeader from "./ReportHeaderSection";
import * as reportOptions from "./ReportOptionsSection";
import * as reportQuestions from "./ReportQuestionsSection";
import * as reportMeasurement from "./ReportMeasurementSection";
import * as reportProperty from "./ReportPropertySection";
import * as reportNotes from "./ReportNotesSection";
import { assertSectionMetaInSync } from "./sectionMeta";

export const SECTION_REGISTRY = {
  header,
  client_info: clientInfo,
  scope_groups: scopeGroups,
  totals,
  payment_summary: paymentSummary,
  payment_terms: paymentTerms,
  process_steps: processSteps,
  signature,
  notes,
  kitchen_plan: kitchenPlan,
  footer,
  report_header: reportHeader,
  report_options: reportOptions,
  report_questions: reportQuestions,
  report_measurement: reportMeasurement,
  report_property: reportProperty,
  report_notes: reportNotes,
};

export const AVAILABLE_SECTION_TYPES = Object.keys(SECTION_REGISTRY).map(
  (type) => ({
    type,
    label: SECTION_REGISTRY[type].meta.label,
  }),
);

export function getSectionModule(type) {
  const mod = SECTION_REGISTRY[type];
  if (!mod) throw new Error(`Unknown section type: "${type}"`);
  return mod;
}

// Catch drift between the editor's section list and what can actually be
// rendered. Runs once, server-side, when this module is first imported — a
// mismatch surfaces here rather than as a 500 the first time someone
// downloads a PDF built from the offending template.
assertSectionMetaInSync(Object.keys(SECTION_REGISTRY));
