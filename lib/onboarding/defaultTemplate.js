// lib/onboarding/defaultTemplate.js
//
// The checklist a company gets before it has written one.
//
// ══ Lazily, not by migration ═══════════════════════════════════════════════
//
// Created the first time somebody opens the onboarding screen for the
// company (app/api/hr/onboarding/templates GET), by the route calling
// `defaultTemplateFor(company)` and inserting the result when the company
// has no template at all. A migration that seeded every company would give
// eleven hundred contractors who never hire a "New hire checklist" row they
// cannot explain. PURE: the function takes a country and returns a list, and
// scripts/check-hr.mjs executes it for CA, US and unknown.
//
// ══ What is on it ══════════════════════════════════════════════════════════
//
// The five things every small contractor actually collects, in the order
// they happen: contact and emergency details, a piece of ID, the tax form
// for the country, the safety walk-through, the phone set-up. The tax form
// is the ONE country-dependent item — Canada asks for the federal TD1 and
// the provincial one; the US asks for a W-4 — and a company whose country
// cannot be resolved gets no form item at all rather than the wrong one.
//
// No policy items: the default is created before the company has any policy
// to point at. The screen says "add your policies" once some exist.
import { resolveCountry } from "@/lib/company/resolveCountry";

export const DEFAULT_TEMPLATE_NAME = "New hire checklist";

/** The tax-form items per country, in the order the forms are usually filled. */
export const TAX_FORM_ITEMS_BY_COUNTRY = Object.freeze({
  CA: [
    { key: "td1-federal", label: "Fill in the federal TD1", kind: "form", formKind: "td1_federal", required: true, dueDays: 3 },
    { key: "td1-provincial", label: "Fill in the provincial TD1", kind: "form", formKind: "td1_provincial", required: true, dueDays: 3 },
  ],
  US: [{ key: "w4", label: "Fill in the W-4", kind: "form", formKind: "w4", required: true, dueDays: 3 }],
});

/**
 * @param company  { country?, address?, province? } — whatever resolveCountry
 *                 reads; null resolves to no tax-form item.
 * @returns {{ name, items }} ready for OnboardingTemplate.create
 */
export function defaultTemplateFor(company) {
  const { country } = resolveCountry(company || {});
  const taxItems = TAX_FORM_ITEMS_BY_COUNTRY[country] || [];
  return {
    name: DEFAULT_TEMPLATE_NAME,
    items: [
      { key: "contact-details", label: "Confirm your contact and emergency-contact details", kind: "task", required: true, dueDays: 1 },
      { key: "photo-id", label: "Upload a piece of photo ID", kind: "document", documentKind: "id", required: true, dueDays: 3 },
      ...taxItems,
      { key: "direct-deposit", label: "Hand in your direct-deposit details", kind: "task", required: true, dueDays: 7 },
      { key: "safety-walkthrough", label: "Safety walk-through with your supervisor", kind: "task", required: true, dueDays: 1 },
      { key: "ppe-issued", label: "PPE issued and fitted", kind: "task", required: true, dueDays: 1 },
      { key: "tickets", label: "Upload your trade tickets and certifications", kind: "document", documentKind: "certification", required: false, dueDays: 14 },
      { key: "app-setup", label: "FieldQuo installed on your phone, notifications on", kind: "task", required: false, dueDays: 2 },
    ],
  };
}
