// docs/screens/app-guide/harness/fixtures/funnel.js
//
// The fixture company's kitchen landing-page funnel, split out of
// routes-help.js (2026-09-25) so the /signup side panel can draw the REAL
// funnel builder preview (app/app/funnels/[id]) from it without importing
// routes-help, which pulls in the whole fixture set. Moved, not changed:
// routes-help.js imports and re-exports both names.
import { day, iso } from "./company.js";
import { sanitiseFunnelSteps } from "@/app/data/funnelBlocks";

// ── /f/<slug>/<funnel> — the kitchen landing page ───────────────────────────
// One funnel, shared by the builder (app/app/funnels/[id], GET /api/funnels/
// [id]) and the public runner (GET /api/funnels/public/…): the steps go
// through the same sanitiser the save route and the public route apply, so a
// step this file gets wrong is dropped here the way it would be there.
export const FUNNEL_STEPS = sanitiseFunnelSteps([
  { id: "s_intro", kind: "intro", headline: "A new kitchen, priced in two minutes", subhead: "Answer four quick questions and we'll come back with a range — no visit needed for a first number.", buttonText: "Start" },
  {
    id: "s_style", kind: "question_single", question: "What look are you after?", help: "Pick the closest — we can mix.",
    answers: [
      { id: "a_shaker", label: "Shaker, painted", value: "shaker", weight: 10 },
      { id: "a_slab", label: "Flat slab, wood veneer", value: "slab", weight: 10 },
      { id: "a_mixed", label: "Painted perimeter, wood island", value: "mixed", weight: 20 },
      { id: "a_unsure", label: "Not sure yet", value: "unsure", weight: 0 },
    ],
  },
  {
    id: "s_scope", kind: "question_multi", question: "What's in scope?", buttonText: "Next",
    answers: [
      { id: "b_uppers", label: "Upper cabinets", value: "uppers", weight: 5 },
      { id: "b_bases", label: "Base cabinets", value: "bases", weight: 5 },
      { id: "b_island", label: "An island", value: "island", weight: 15 },
      { id: "b_pantry", label: "A pantry wall", value: "pantry", weight: 10 },
    ],
  },
  {
    id: "s_budget", kind: "question_single", question: "Roughly what budget do you have in mind?", maps: "budget",
    answers: [
      { id: "c_1", label: "Under $15,000", value: "under_15k", weight: 0, maps: "budget" },
      { id: "c_2", label: "$15,000 – $30,000", value: "15_30k", weight: 10, maps: "budget" },
      { id: "c_3", label: "$30,000 – $50,000", value: "30_50k", weight: 20, maps: "budget" },
      { id: "c_4", label: "Over $50,000", value: "over_50k", weight: 25, maps: "budget" },
    ],
  },
  { id: "s_form", kind: "form", headline: "Where should we send your range?", subhead: "We reply within one business day.", buttonText: "Send me my range", fields: ["name", "email", "phone"], consent: "By sending this you agree to be contacted about your kitchen." },
  { id: "s_thanks", kind: "thankyou", headline: "Thanks — your range is on its way.", subhead: "Marc or Samuel will call to talk through it and book a measure if you'd like one." },
]);
export const FUNNEL = {
  id: "fn_kitchen",
  name: "Kitchen quote — landing page",
  slug: "kitchen-quote",
  status: "published",
  channel: "web",
  steps: FUNNEL_STEPS,
  theme: null,
  metaPixelId: null,
  tiktokPixelId: null,
  ga4Id: null,
  createdAt: iso(day(-40, 9)),
  updatedAt: iso(day(-3, 15)),
  publishedAt: iso(day(-30, 11)),
  _count: { responses: 14 },
};
