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
import * as footer from "./FooterSection";
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
  footer,
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
