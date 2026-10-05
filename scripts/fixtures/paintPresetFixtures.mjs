// scripts/fixtures/paintPresetFixtures.mjs
//
// Painting takeoffs for the painting preset's height and prep figures
// (lib/pricing/paintHeightPrep.js), as LITERALS — never built through
// newPaintSubstrate, so a fixture cannot move with the code under test. Run
// through the engine before the preset landed (origin/main e78e7cea) and
// after; scripts/check-plan-read-first-pass.mjs pins both answers:
//
//   same   rooms of 8 ft or less, the owner's 9 ft den the rates were
//          recovered from, a situation rate already for its height
//          ("16 ft walls"), the two-storey wall substrate — byte for byte
//   moves  a wall or a ceiling above the rates' 9 ft, a row with its own
//          working height, a row with a condition chosen
//
// Imports nothing.

const sub = (key, patch = {}) => ({ key, label: key, coats: 2, prepHours: 0, quantity: null, optional: false, rateKey: key, rate: null, ...patch });
const area = (patch, substrates) => ({
  areaType: "den", label: "Room", surface: "interior", measurement: "area",
  lengthFt: 12, widthFt: 14, heightFt: 8, linearFt: 0, surfaceSqft: 0,
  prepHours: 0, optional: false, substrates, options: [], ...patch,
});
const t = (estimateType, areas) => ({ model: "area_substrate", estimateType, areas, notes: "" });

export const SAME = Object.freeze([
  "room_8ft",
  "room_7ft",
  "den_9ft",
  "living_9ft",
  "walls_16ft_situation",
  "two_storey_18ft",
  "exterior_surface_measured",
  "baseboard_doors_10ft",
]);
export const MOVES = Object.freeze(["walls_16ft_default", "ceiling_15ft", "row_height_14ft", "condition_painted_plaster", "exterior_24ft"]);

export function presetFixtures() {
  return {
    room_8ft: t("interior", [area({}, [sub("walls", { driver: "wallSqft" }), sub("ceiling", { driver: "ceilingSqft" }), sub("baseboard", { driver: "linearFt" }), sub("crown_moulding", { driver: "linearFt" })])]),
    room_7ft: t("interior", [area({ heightFt: 7 }, [sub("walls", { driver: "wallSqft" }), sub("ceiling", { driver: "ceilingSqft" })])]),
    den_9ft: t(null, [area({ lengthFt: 10, widthFt: 13, heightFt: 9, prepHours: 0 }, [sub("ceiling", { driver: "ceilingSqft", rateKey: null }), sub("walls", { driver: "wallSqft", rateKey: null }), sub("baseboard", { driver: "linearFt", rateKey: null }), sub("door", { quantity: 3, rateKey: null })])]),
    living_9ft: t("interior", [area({ lengthFt: 14, widthFt: 16, heightFt: 9, prepHours: 2 }, [sub("ceiling", { driver: "ceilingSqft" }), sub("walls", { driver: "wallSqft" }), sub("baseboard", { driver: "linearFt" }), sub("door", { quantity: 2 })])]),
    walls_16ft_situation: t("interior", [area({ heightFt: 16 }, [sub("walls", { driver: "wallSqft", rateKey: "walls_16ft" })])]),
    two_storey_18ft: t("interior", [area({ heightFt: 18, measurement: "wall", linearFt: 14 }, [sub("wall_two_storey", { quantity: 252 })])]),
    exterior_surface_measured: t("exterior", [area({ areaType: "exterior", surface: "exterior", measurement: "surface", heightFt: 0, surfaceSqft: 1800 }, [sub("siding_trim", { driver: "wallSqft", coats: 1 })])]),
    baseboard_doors_10ft: t("interior", [area({ heightFt: 10 }, [sub("baseboard", { driver: "linearFt" }), sub("door", { quantity: 2 })])]),
    walls_16ft_default: t("interior", [area({ heightFt: 16 }, [sub("walls", { driver: "wallSqft" })])]),
    ceiling_15ft: t("interior", [area({ heightFt: 15 }, [sub("ceiling", { driver: "ceilingSqft" })])]),
    row_height_14ft: t("interior", [area({}, [sub("walls", { quantity: 300, heightFt: 14 })])]),
    condition_painted_plaster: t("interior", [area({}, [sub("walls", { driver: "wallSqft", prepCondition: "painted_plaster" })])]),
    exterior_24ft: t("exterior", [area({ areaType: "exterior", surface: "exterior", lengthFt: 40, widthFt: 30, heightFt: 24 }, [sub("siding_trim", { driver: "wallSqft", coats: 1 })])]),
  };
}
