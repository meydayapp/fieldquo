import fs from "node:fs";
import crypto from "node:crypto";
const d = JSON.parse(fs.readFileSync("hcp.json", "utf8"));
// agent -> [[industry, tradeKey(s) note]]
const GROUPS = {
  A01: { "Heating & Air Conditioning": "hvac_repair (every category) EXCEPT the 'System Installation' category, which goes to hvac_install — two files" },
  A02: { "Plumbing": "plumbing", "Water Heater": "plumbing (merge into the plumbing file under a 'Water heaters' category; the symptom rows become diagnostic/repair services)" },
  A03: { "Electrical": "electrical (the four code-less rows are generic visits — keep them)", "Lighting": "lighting (NEW trade)" },
  A04: { "General Contractor": "general_contracting" },
  A05: { "Handyman": "handyman", "Garage": "garage_door", "Appliances": "appliance_repair" },
  A06: { "Carpet Cleaning": "carpet_cleaning", "Carpet Repair": "carpet_cleaning (same file)", "Rug Cleaning": "carpet_cleaning (same file; one row)", "Home Cleaning": "residential_cleaning", "Window & Exterior Cleaning": "window_cleaning", "Janitorial": "janitorial", "Air Duct Cleaning": "air_duct_cleaning (NEW trade)" },
  A07: { "Painting": "interior_painting (everything except 'Exterior Components') and exterior_painting ('Exterior Components') — two files", "Cabinetry": "carpentry", "Drywall": "drywall", "Doors": "doors_windows (NEW trade)", "Windows": "doors_windows (same file as Doors)", "Demolition": "demolition", "Deck & Patio": "deck_patio (NEW trade)", "Tile & Grout": "tiling (both rows)" },
  A08: { "Fencing": "fence_services", "Concrete & Asphalt": "concrete" },
  A09: { "Fireplace & Chimney": "chimney_sweep", "Gutters": "gutter_services", "Siding": "siding", "Insulation": "insulation" },
  A10: { "Flooring": "flooring_install", "Roof & Attic": "roofing_service" },
  A11: { "Landscaping & Lawn": "lawn_care", "Tree Services": "tree_care_service", "Snow Removal": "snow_removal", "Pest Control": "pest_control", "Pool & Spa": "pool_spa", "Junk Removal": "junk_removal", "Automotive": "auto_detailing" },
  A12: { "Security": "security_systems (NEW trade)", "Smart Home": "smart_home (NEW trade)", "Audio & TV": "smart_home (same file as Smart Home)", "Solar & Energy": "solar_energy (NEW trade)", "Locksmith": "locksmith" },
  A13: { "Restoration": "restoration", "Sewer & Septic": "sewer_septic (NEW trade)", "Water Treatment": "well_water", "Well Pumps": "well_water (same file as Water Treatment; one row)", "Home Inspection": "home_inspection" },
  A14: { "Moving": "moving (NEW trade)", "Wildlife Control": "wildlife_control (NEW trade; one row)", "Caulking & Sealants": "caulking_sealants (NEW trade; one row)", "Interior & Surface Cleaning": "deep_cleaning (one row)", "Install & Assemble": "installation_services (one row)", "Furniture & Upholstery": "furniture_upholstery (NEW trade; one row)", "Glass": "glass (NEW trade; one row)", "Marine Services": "marine_services (NEW trade; one row)", "Organization & Interior Design": "home_organization (NEW trade; one row)", "Neighborhood Chores": "property_maintenance (one row)", "Baby Proof": "baby_proofing (NEW trade; one row)" },
};
const PLACEHOLDER = /something else|i don't know|i don'?t know|^custom job$|book an appointment/i;
fs.mkdirSync("slices", { recursive: true });
let total = 0;
for (const [agent, inds] of Object.entries(GROUPS)) {
  const out = {};
  for (const [ind, trade] of Object.entries(inds)) {
    const r = d[ind]; if (!r) throw new Error("missing " + ind);
    const services = r.services.map((s) => ({
      industry: ind, category: s.category, service: s.service, taskCode: s.taskCode || null, unit: s.unit || null, low: s.p25, median: s.median, high: s.p75,
      durationMinutes: s.durationMinutes, bookable: s.bookable, sourceDescription: s.description,
    }));
    total += services.length;
    out[ind] = { mapTo: trade, medianOfMedians: r.medianOfMedians, count: services.length, services };
  }
  fs.writeFileSync(`slices/${agent}.json`, JSON.stringify(out, null, 1));
  console.log(agent, Object.entries(out).map(([k, v]) => `${k}=${v.count}`).join(", "));
}
console.log("total services to author:", total);
// Hash list of every source sentence (normalised) — the check asserts none appears in a seed.
const norm = (s) => s.toLowerCase().replace(/[’']/g, "'").replace(/[^a-z0-9' ]+/g, " ").replace(/\s+/g, " ").trim();
const hashes = new Set();
for (const r of Object.values(d)) for (const s of r.services) {
  for (const part of s.description.split(/ \/ |(?<=[.!?])\s+/)) {
    const n = norm(part);
    if (n.split(" ").length >= 5) hashes.add(crypto.createHash("sha256").update(n).digest("hex").slice(0, 24));
  }
}
fs.writeFileSync("source-sentence-hashes.json", JSON.stringify([...hashes].sort()));
console.log("sentence hashes", hashes.size);
