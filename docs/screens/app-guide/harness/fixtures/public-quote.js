// docs/screens/app-guide/harness/fixtures/public-quote.js
//
// The document half of the /q/<token> figure — Q-1042 as Sophie opens it,
// the moment before she taps Approve: the scope groups, the add-ons, the
// steps, the terms. Split out of routes-help.js (2026-09-25) so the /signup
// side panel can render the REAL client quote page (app/q/[token]/
// QuoteApproval.js, `sample` prop) from it without importing routes-help,
// which pulls in the whole fixture set. routes-help.js's publicQuote()
// spreads these two halves back in the same key order, around the company
// and the proposal it still builds itself.
import { COMPANY, CLIENT, QUOTE } from "./company.js";

export const ADD_ONS = [
  { id: "ao1", description: "Under-cabinet LED lighting", detail: "Warm white strip under every upper run, hard-wired to a wall switch", amount: 640, taxable: true, selected: false },
  { id: "ao2", description: "Pull-out waste and recycling", detail: "Two-bin unit in the base beside the sink", amount: 385, taxable: true, selected: false },
  { id: "ao3", description: "Soft-close upgrade on all drawers", detail: "Blum undermount runners", amount: 520, taxable: true, selected: true },
];
export const SCOPE_GROUPS = [
  {
    label: "Kitchen cabinets",
    subtotal: 17620,
    accent: null,
    description: "Every box and door built in our Laval shop, sprayed in the booth, installed level and plumb.",
    included: ["Site measure and shop drawings for approval", "Soft-close hinges on every door", "Removal and disposal of the old cabinets", "Two-year workmanship warranty"],
    mayChange: [{ title: "Countertops", body: "Quoted separately once the boxes are set — the template is taken on site." }],
    lineItems: QUOTE.items.slice(0, 3).map((it) => ({ description: `${it.name} — ${it.description}`, quantity: it.quantity, amount: it.total })),
  },
  {
    label: "Installation",
    subtotal: 830,
    accent: null,
    description: "",
    included: ["Two installers, two days", "Hardware fitted and hinges adjusted before we leave"],
    mayChange: [],
    lineItems: [{ description: "Installation — 2 installers, 2 days", quantity: 2, amount: 830 }],
  },
];
// Everything publicQuote() carries between `language` and `company`…
export const QUOTE_PAGE_HEAD = {
  notes: "Colour: Benjamin Moore OC-17 White Dove on the perimeter; the island stays natural white oak with a matte clear coat.",
  processNotes: COMPANY.defaultProcessNotes,
  validUntil: QUOTE.validUntil,
  sentAt: QUOTE.sentAt,
  subtotal: QUOTE.subtotal,
  discount: 0,
  tax: QUOTE.taxTotal,
  taxKind: "charged",
  taxAssumedRegion: null,
  total: QUOTE.total,
  acceptedTotal: null,
  taxRate: COMPANY.taxRate / 100,
  addOns: ADD_ONS,
  client: { name: CLIENT.name },
};
// …and between `company` and `proposal`.
export const QUOTE_PAGE_TAIL = {
  financing: null,
  scopeGroups: SCOPE_GROUPS,
  glossary: [
    { term: "Shaker", body: "A flat centre panel framed by four square-edged rails — the plainest door profile, and the one that hides wear best." },
    { term: "Rift sawn", body: "White oak cut so the grain runs straight and tight across the face, with none of the cathedral figure of plain-sawn boards." },
  ],
  processSteps: [
    { num: 1, title: "Measure", body: "We measure on site and draw every elevation for your approval.", timeline: "Week 1" },
    { num: 2, title: "Build", body: "Boxes, doors and the island are built and sprayed in our Laval shop.", timeline: "Weeks 2–5" },
    { num: 3, title: "Install", body: "Day one we remove the old cabinets and set the boxes; day two we hang doors and fit hardware.", timeline: "Week 6" },
  ],
  paymentTerms: COMPANY.paymentTerms,
  paymentSchedule: [
    { pct: "50%", label: "Deposit to book the shop time" },
    { pct: "50%", label: "Balance on installation" },
  ],
};
