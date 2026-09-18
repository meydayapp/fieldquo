// docs/screens/app-guide/harness/fixtures/takeoffs.js
//
// The seeds behind TakeoffFrame.jsx: a filled takeoff per trade so the card
// photographs with numbers in it, one house for the trades that draw on a
// satellite still, and the fixed measurement the roof and gutter panels are
// answered with. Values are the kind an estimator types — a 2,400 sqft
// two-storey roof, a 620 sqft driveway — not round placeholders.
//
// The still is a live Google Static Maps tile: the key rides in on
// ?mapsKey= (shoot.mjs adds it from HARNESS_MAPS_KEY) and nothing is stored.
// Without a key the URL is empty, the paver designer draws on its grid and
// the roof panel shows the numbers without a picture — the frame still
// renders, it is just plainer.
import { fieldsForCategory } from "@/app/data/quoteIntakeFields";
import { imageScaleFromUrl } from "@/lib/measure/imageScale";

// A detached house in Kanata, Ontario — the whole roof and the driveway in
// one frame at zoom 20.
const LAT = 45.2845;
const LNG = -75.8935;
export const SITE_ADDRESS = "42 Windermere Dr, Kanata, ON K2K 1S8";

const mapsKey = (() => {
  try {
    return new URLSearchParams(window.location.search).get("mapsKey") || "";
  } catch {
    return "";
  }
})();

const stillUrl = mapsKey
  ? "https://maps.googleapis.com/maps/api/staticmap" +
    `?center=${LAT},${LNG}&zoom=20&size=640x400&scale=2&maptype=satellite&key=${mapsKey}`
  : "";

export const SITE_IMAGE = {
  url: stillUrl,
  scale: stillUrl ? imageScaleFromUrl(stillUrl) : null,
  location: { lat: LAT, lng: LNG },
};

// The driveway at the top-left of the still, traced. Points are in the
// polygon canvas's 1000×640 view units (PolygonMeasure.js VIEW_W/VIEW_H).
const DRIVEWAY = [
  { x: 300, y: 30 },
  { x: 440, y: 30 },
  { x: 500, y: 118 },
  { x: 360, y: 128 },
];
// The lawn at the back: the green patch right of the house.
const LAWN = [
  { x: 620, y: 240 },
  { x: 770, y: 205 },
  { x: 795, y: 300 },
  { x: 645, y: 335 },
];

export const TAKEOFF_SEEDS = {
  roofing_service: {
    areaSqft: 2400,
    pitchRise: 8,
    layers: 2,
    storeys: "two",
    valleyFt: 40,
    ridgeHipFt: 60,
    dripEdgeFt: 180,
    ventBoots: 3,
    chimneys: 1,
    deckSheets: 2,
    crewSize: 3,
  },
  paving: {
    drivewaySqft: 620,
    patioSqft: 0,
    walkwaySqft: 0,
    complexityLevel: "standard",
    crewSize: 3,
    paverDesign: {
      scale: null,
      imageOpacity: 0.65,
      shapes: [{ id: "shape_driveway", surface: "driveway", points: DRIVEWAY }],
    },
  },
  gutter_services: {
    workType: "replacement",
    gutterFt: 200,
    storeys: "two",
    materialKey: "alum_6",
    guard: "micro_mesh",
    guardFt: 120,
    downspoutsInstalled: 4,
    repairSections: 2,
    heatCableFt: 40,
    soffitFasciaRinse: true,
  },
  siding: { sqft: 2000, storeys: "two", rotRepairSqft: 40, trimFt: 200, fasciaFt: 120, soffitSqft: 260 },
  insulation: { assembly: "attic", climateZone: "6", sqft: 1200, existingDepthIn: 4, airSeal: true, baffles: 14, crewSize: 2 },
  interior_painting: {
    model: "area_substrate",
    areas: [
      {
        areaType: "living_room",
        label: "Living room",
        surface: "interior",
        measurement: "area",
        lengthFt: 16,
        widthFt: 14,
        heightFt: 9,
        prepHours: 2,
        optional: false,
        roundGallonsUp: null,
        crewNote: "",
        clientNote: "",
        substrates: [
          { key: "ceiling", label: "Ceiling", coats: 2, quantity: null, driver: "ceilingSqft", productKey: "ceiling_flat" },
          { key: "walls", label: "Walls", coats: 2, quantity: null, driver: "wallSqft", productKey: "wall_interior", showFormula: true },
          { key: "baseboard", label: "Baseboard", coats: 2, quantity: null, driver: "linearFt", productKey: "trim_enamel" },
          { key: "door", label: "Doors", coats: 2, quantity: 2, productKey: "trim_enamel" },
        ],
      },
    ],
  },
  exterior_painting: {
    model: "area_substrate",
    areas: [
      {
        areaType: "exterior",
        label: "Exterior",
        surface: "exterior",
        measurement: "surface",
        surfaceSqft: 2340,
        linearFt: 260,
        substrates: [
          { key: "siding_trim", label: "Siding & trim", coats: 1, quantity: null, driver: "wallSqft" },
          { key: "soffit_fascia", label: "Soffit & fascia", coats: 2, quantity: 260 },
          { key: "garage_door", label: "Garage door", coats: 2, quantity: 1 },
        ],
      },
    ],
  },
  stairs: {
    sections: [{ title: "Main staircase", complexityLevel: "standard", treads: 14, risers: 15, balusters: 28, posts: 2, handrailFt: 18, landingSqft: 12, paintRisers: true, paintBalusters: true, paintPosts: false, twoTone: true, stainColour: "Minwax Jacobean", notes: "" }],
    basement: false,
    basementTreads: 0,
  },
  countertop: {
    materialType: "Quartz",
    markupPct: 30,
    items: [
      { id: "countertop", label: "Countertop Supply & Installation", kind: "supply", enabled: true, supplierCost: 3400, override: 0 },
      { id: "backsplash", label: "Backsplash", kind: "supply", heightOption: "4in", enabled: true, supplierCost: 420, override: 0 },
      { id: "sink", label: "Sink / Undermount Cutout", kind: "supply", enabled: true, supplierCost: 180, override: 0 },
    ],
  },
  garage_door: {
    installIncluded: true,
    doors: [{ id: "d16x7_black_flush", quantity: 1, override: 0 }, { id: "d8x7_top_window", quantity: 1, override: 0 }],
    capping: [{ id: "cap_16x7", quantity: 1, override: 0 }],
  },
  flooring: {
    sections: [{ title: "Main floor", complexityLevel: "standard", sqft: 860, rooms: 4, woodSpecies: "Red oak", finishType: "Satin water-based", stainChange: true, waterDamageRepair: false, gapFilling: true, furnitureMoving: true, stairBlending: false, notes: "" }],
  },
  driveway_sealing: { complexityLevel: "standard", sqft: 620, twoCoats: true, crackFilling: true, crackFt: 30, pressureWash: true, stainTreatment: false, premiumSealer: true, travelSurcharge: false },
  home_inspection: { sqft: 2100, ancillary: { radon_short: 1, radon_long: 0, wett: 1, septic: 0, well_water: 0, air_quality: 0, thermal: 1, reinspection: 0, age_surcharge: 1, travel_km: 0 }, warrantyVisits: 0 },
  snow_removal: { plan: "premium", drivewaySize: "double", shovelling: true, salting: true, saltApplications: 8, extraVisits: 0, newClient: true },
};

// The landscaping trades draw on the still: the lawn traced, the intake the
// builder shows beside it.
const lotDrawing = { scale: null, imageOpacity: 0.65, shapes: [{ id: "shape_lawn", surface: "lawn", points: LAWN }] };
export const LOT_INTAKE = Object.fromEntries(
  ["landscaping_design", "lawn_care", "lawn_mowing", "irrigation"].map((key) => [
    key,
    { fields: fieldsForCategory({ key }), intakeValues: { lotSize: 1480, edgingFt: 160, frequency: "weekly", lotDrawing } },
  ]),
);

// What /api/measure/roof answers the roofing panel — the shape
// lib/measure/roofMeasurement.js measureRoof returns for a hip roof.
export const ROOF_MEASUREMENT = {
  ok: true,
  source: "google_solar",
  areaSqft: 2412.5,
  squares: 24.1,
  predominantPitch: { rise: 8, degrees: 33.7, tier: "steep" },
  segmentCount: 6,
  footprintSqft: 1980,
  linear: {
    shape: "hip",
    facets: 6,
    directions: ["N", "E", "S", "W"],
    perimeterFt: 184,
    eaveFt: 184,
    rakeFt: 0,
    ridgeFt: 38,
    hipFt: 96,
    valleyFt: 22,
    internalFt: 156,
  },
  lowSlopeShare: 0,
  pinDistanceM: 4,
  searchWidened: false,
  buildingsConsidered: 1,
  imageryQuality: "HIGH",
  trustworthy: true,
  warnings: [],
  location: { lat: LAT, lng: LNG },
  formattedAddress: SITE_ADDRESS,
  precise: true,
  satelliteImageUrl: stillUrl || null,
  imageryDate: { year: 2025, month: 6, day: 12 },
};

// What /api/measure/gutters answers — lib/measure/gutterMeasurement.js's
// shape, derived from the same roof.
export const GUTTER_MEASUREMENT = {
  ok: true,
  gutterFt: 184,
  downspouts: 4,
  eaveRuns: 4,
  basis: "eave",
  lowSlopeShare: 0,
  perimeterFt: 184,
  eaveFt: 184,
  rakeFt: 0,
  shape: "hip",
  imagery: { date: "June 2025", year: 2025, quality: "HIGH", text: "Measured from satellite — imagery June 2025 (high quality)." },
  trustworthy: true,
  flags: [],
  formattedAddress: SITE_ADDRESS,
  satelliteImageUrl: stillUrl || null,
  imageryDate: { year: 2025, month: 6, day: 12 },
  imageryQuality: "HIGH",
  searchWidened: false,
  buildingsConsidered: 1,
};
