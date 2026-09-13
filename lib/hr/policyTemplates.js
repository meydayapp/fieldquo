// lib/hr/policyTemplates.js
//
// The starter policies, by language. Offered on Settings → Policies as
// "Start from a template"; the company gets a copy to edit, and the row
// remembers which starter it began from (CompanyPolicy.templateKey) for the
// hint only — the text is theirs from the first save.
//
// Three languages because these are read by the crew, and a company whose
// default language is French gets French starters. A language outside the
// three falls back to English — a starter is a draft to edit, not a signed
// document, so the "keeps the language it was created in" rule for quotes
// does not apply until the company publishes.
import { POLICY_TEMPLATES as EN } from "../../content/hr/policies/en.js";
import { POLICY_TEMPLATES as FR } from "../../content/hr/policies/fr.js";
import { POLICY_TEMPLATES as ES } from "../../content/hr/policies/es.js";

const BY_LANG = { en: EN, fr: FR, es: ES };

export const POLICY_TEMPLATE_KEYS = Object.freeze(Object.keys(EN));

export function policyTemplates(language) {
  const set = BY_LANG[language] || EN;
  return POLICY_TEMPLATE_KEYS.map((key) => ({ key, title: set[key].title, body: set[key].body }));
}

export function policyTemplate(key, language) {
  if (!POLICY_TEMPLATE_KEYS.includes(key)) return null;
  const set = BY_LANG[language] || EN;
  return { key, title: set[key].title, body: set[key].body };
}
