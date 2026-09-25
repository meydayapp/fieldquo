// app/data/checklistSeeds/index.js
//
// Every per-trade checklist a company can start from, registered so the
// bundler sees them. Read ./_build.js for the format and the rules.
//
// ── Offered by trade, attached by estimate type ────────────────────────────
//
// `trades` decides which companies get a list installed (a trade switched on
// at signup or in Settings); `autoAddFor` decides which of those lists a NEW
// job carries without anyone picking it — one list per estimate type, the way
// the reference products pair a checklist with an estimate template. A GC
// has seven lists installed and one auto-attached, because a kitchen and a
// deck are both "general contracting" to the job and only a person knows
// which this one is.
//
// Installed by lib/checklists/seedTemplates.js; validated by
// scripts/check-checklist-templates.mjs.

import { CHECKLISTS as appliance_repair } from "./appliance_repair.js";
import { CHECKLISTS as cabinet_refinishing } from "./cabinet_refinishing.js";
import { CHECKLISTS as carpet_cleaning } from "./carpet_cleaning.js";
import { CHECKLISTS as electrical } from "./electrical.js";
import { CHECKLISTS as exterior_painting } from "./exterior_painting.js";
import { CHECKLISTS as flooring_install } from "./flooring_install.js";
import { CHECKLISTS as garage_door } from "./garage_door.js";
import { CHECKLISTS as general_contracting } from "./general_contracting.js";
import { CHECKLISTS as generic } from "./generic.js";
import { CHECKLISTS as handyman } from "./handyman.js";
import { CHECKLISTS as hvac_install } from "./hvac_install.js";
import { CHECKLISTS as hvac_repair } from "./hvac_repair.js";
import { CHECKLISTS as interior_painting } from "./interior_painting.js";
import { CHECKLISTS as lawn_care } from "./lawn_care.js";
import { CHECKLISTS as plumbing } from "./plumbing.js";
import { CHECKLISTS as residential_cleaning } from "./residential_cleaning.js";
import { CHECKLISTS as roofing_service } from "./roofing_service.js";
import { CHECKLISTS as snow_removal } from "./snow_removal.js";
import { CHECKLISTS as tree_care_service } from "./tree_care_service.js";
import { CHECKLISTS as window_cleaning } from "./window_cleaning.js";

export { LANGS as CHECKLIST_SEED_LANGUAGES } from "./_build.js";

export const CHECKLIST_SEEDS_BY_FILE = {
  appliance_repair,
  cabinet_refinishing,
  carpet_cleaning,
  electrical,
  exterior_painting,
  flooring_install,
  garage_door,
  general_contracting,
  generic,
  handyman,
  hvac_install,
  hvac_repair,
  interior_painting,
  lawn_care,
  plumbing,
  residential_cleaning,
  roofing_service,
  snow_removal,
  tree_care_service,
  window_cleaning,
};

export const ALL_CHECKLIST_SEEDS = Object.values(CHECKLIST_SEEDS_BY_FILE).flat();

/** The seeds a company in `tradeKey` gets: that trade's lists plus the generic set. */
export function checklistSeedsForTrade(tradeKey) {
  return ALL_CHECKLIST_SEEDS.filter(
    (c) => c.trades.includes(tradeKey) || c.trades.includes("*"),
  );
}
