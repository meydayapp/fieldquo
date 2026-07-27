// app/data/sectionPresets.js
// Common section labels for trades that are genuinely priced by phase, not one
// lump sum. Purely a UI convenience — clicking one just creates a normal
// QuoteScopeGroup with that label already set, same as any other scope group.
// No new schema, no new model.

export const SECTION_PRESETS = {
  plumbing: [
    "Groundworks",
    "Drainage",
    "Garage Drain",
    "Waterlines",
    "Tubs/Showers",
    "Steamer",
    "Recirc Lines",
    "Gas",
    "Finishing",
    "Insulating",
  ],
  hvac_install: [
    "Inslab",
    "Boiler Systems",
    "Quick Track",
    "Supply/Return Mains",
    "Main Slab Heat",
    "Upper Floor Slab Heat",
    "Wiring",
    "Venting",
  ],
};

export function getSectionPresets(categoryKey) {
  return SECTION_PRESETS[categoryKey] || null;
}
