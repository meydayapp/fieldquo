# Resuming the service-seed authoring (paused 2026-09-21)

Not shipped — this folder is the authoring rig, kept so the work resumes from
here instead of from memory.

1. `node parse.mjs` (from a scratch dir) reads the benchmark capture at
   `fq-wt-hcp/docs/research/hcp-price-books-by-trade.md` into `hcp.json`.
2. `node slice.mjs` writes one slice per authoring agent (`slices/A01..A14.json`)
   plus `source-sentence-hashes.json` (copy to `../source-sentence-hashes.json`).
   The slices carry the source text and are NEVER committed.
3. Each agent gets `BRIEF.md` (edit the two absolute scratchpad paths in it to
   wherever the slices were written) and its slice, writes
   `app/data/serviceSeeds/<trade>.js` + `scripts/service-seeds/source-map/<trade>.json`,
   and validates with
   `node --import ./scripts/alias-loader.mjs --import ./scripts/db-stub-loader.mjs scripts/check-service-seeds.mjs --file <trade>`.
4. When every file exists: register each in `app/data/serviceSeeds/index.js`,
   run the check without `--file`, finish the UI (see the commit message), and
   run `npm run build`.

Agent → files (A11 skips snow_removal; it is the exemplar):
A01 hvac_install, hvac_repair · A02 plumbing · A03 electrical, lighting ·
A04 general_contracting · A05 handyman, garage_door, appliance_repair ·
A06 carpet_cleaning, residential_cleaning, window_cleaning, janitorial, air_duct_cleaning ·
A07 interior_painting, exterior_painting, carpentry, drywall, doors_windows, demolition, deck_patio, tiling ·
A08 fence_services, concrete · A09 chimney_sweep, gutter_services, siding, insulation ·
A10 flooring_install, roofing_service · A11 lawn_care, tree_care_service, pest_control, pool_spa, junk_removal, auto_detailing ·
A12 security_systems, smart_home, solar_energy, locksmith · A13 restoration, sewer_septic, well_water, home_inspection ·
A14 moving, wildlife_control, caulking_sealants, deep_cleaning, installation_services, furniture_upholstery, glass, marine_services, home_organization, property_maintenance, baby_proofing
