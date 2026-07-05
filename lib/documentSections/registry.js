// lib/documentSections/registry.js
import * as header from "./HeaderSection";
import * as clientInfo from "./ClientInfoSection";
import * as scopeGroups from "./ScopeGroupsSection";
import * as totals from "./TotalsSection";
import * as notes from "./NotesSection";
import * as footer from "./FooterSection";

// Single source of truth. Every section type used by the drag-and-drop builder,
// email renderer, and PDF renderer must be registered here — nowhere else.
export const SECTION_REGISTRY = {
  header,
  client_info: clientInfo,
  scope_groups: scopeGroups,
  totals,
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
