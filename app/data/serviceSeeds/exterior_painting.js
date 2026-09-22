// app/data/serviceSeeds/exterior_painting.js
//
// The exterior half of the painting book — read ./interior_painting.js and
// ./index.js. Exterior siding, trim, fascia, decks and fences are priced per
// sq ft by the painting takeoff and the exterior_painting price book; those
// rows are kept as references with `pricedBy: "takeoff"`.
const BM = (low, median, high) => ({ low, median, high, currency: "USD", source: "benchmark", asOf: "2026-09-21" });
const S = (seedKey, category, unit, benchmark, [en, fr, es], [den, dfr, des], extra = {}) => ({
  seedKey, category, name: { en, fr, es }, description: { en: den, fr: dfr, es: des },
  unit, benchmark, durationMinutes: null, bookable: false, ...extra,
});

export const SEED = {
  trade: "exterior_painting",
  categories: [
    { key: "exterior", name: { en: "Exterior components", fr: "Éléments extérieurs", es: "Elementos exteriores" } },
  ],
  services: [
    S("fq.exterior_painting.exterior.deck_fence", "exterior", "sqft", null,
      ["Deck and fence painting or staining", "Peinture ou teinture de terrasse et de clôture", "Pintura o tinte de terraza y cerca"],
      ["Decks and fences washed, sanded where needed and stained or painted to protect the wood from weather.",
       "Terrasses et clôtures lavées, sablées au besoin et teintes ou peintes pour protéger le bois des intempéries.",
       "Terrazas y cercas lavadas, lijadas donde haga falta y teñidas o pintadas para proteger la madera del clima."],
      { pricedBy: "takeoff", existing: "exterior_painting deck / fence per sq ft." }),
    S("fq.exterior_painting.exterior.fascia_soffit", "exterior", "linear_ft", null,
      ["Fascia and soffit painting", "Peinture de bordures de toit et soffites", "Pintura de fascia y sofito"],
      ["Fascia boards and soffits scraped, primed and painted to protect the roofline and sharpen the look.",
       "Bordures de toit et soffites grattés, apprêtés et peints pour protéger la ligne de toit et soigner l'apparence.",
       "Fascias y sofitos raspados, imprimados y pintados para proteger la línea del techo y mejorar el aspecto."],
      { pricedBy: "takeoff", existing: "exterior_painting fascia per linear ft." }),
    S("fq.exterior_painting.exterior.garage_door", "exterior", "each", null,
      ["Garage door painting", "Peinture de porte de garage", "Pintura de puerta de garaje"],
      ["The garage door cleaned, scuffed and painted to match or refresh the exterior.",
       "Porte de garage nettoyée, dépolie et peinte pour s'agencer à l'extérieur ou le rafraîchir.",
       "Puerta de garaje limpiada, lijada y pintada para combinar con el exterior o renovarlo."]),
    S("fq.exterior_painting.exterior.paint_stain_residential", "exterior", "flat", BM(950, 1541, 2862),
      ["Exterior painting and staining — decks, fences and masonry", "Peinture et teinture extérieures — terrasses, clôtures et maçonnerie", "Pintura y tinte exterior — terrazas, cercas y mampostería"],
      ["Decks, fences and masonry surfaces painted or stained with the right coating for each material.",
       "Terrasses, clôtures et surfaces de maçonnerie peintes ou teintes avec le bon revêtement pour chaque matériau.",
       "Terrazas, cercas y superficies de mampostería pintadas o teñidas con el recubrimiento adecuado para cada material."],
      { existing: "exterior_painting deck / fence per sq ft; masonry is not in the takeoff." }),
    S("fq.exterior_painting.exterior.surfaces_and_trim", "exterior", "flat", BM(2100, 4500, 6500),
      ["Exterior painting — siding, trim and fences", "Peinture extérieure — revêtement, moulures et clôtures", "Pintura exterior — revestimiento, molduras y cercas"],
      ["Siding, trim and fences washed, prepped and painted as one exterior project.",
       "Revêtement, moulures et clôtures lavés, préparés et peints en un seul projet extérieur.",
       "Revestimiento, molduras y cercas lavados, preparados y pintados como un solo proyecto exterior."],
      { pricedBy: "takeoff", existing: "exterior_painting siding / trim / fence per sq ft." }),
  ],
};
