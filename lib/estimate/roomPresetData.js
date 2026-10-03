// lib/estimate/roomPresetData.js
//
// Typical room floor dimensions and ceiling heights by region — the table the
// interior-painting room picker assumes sizes from (lib/estimate/
// roomPresets.js). Every figure is cited by source id; the research, the kind
// of every figure (measured / minimum / recommended / guide / INFERRED) and
// every guess are written up in docs/research/ROOM-SIZES-2026.md, which is
// the place to read before changing a number here.
//
// Each pair is [length, width] in the region's own unit — feet for North
// America, metres everywhere else — because that is the unit its sources
// state. Most sources give an AREA and no shape; the area is the sourced part,
// the length/width split is ours (the research file says so per row).
//
// `kind` lists the kind of the Small / Medium / Large figures in that order.
// A cell marked INFERRED is our estimate, not a source's, and the research
// file says what it was inferred from.
//
// Data only — no imports, no logic — so it can be diffed against the research
// file line by line.

export const ROOM_SOURCES = Object.freeze({
  S1: { title: "Room size guide: how big should rooms be?", publisher: "Plan7Architect", url: "https://plan7architect.com/room-size-guide-how-big-should-rooms-be-ai2/?v=5435c69ed3bc", date: null, accessed: "2026-10-03" },
  S2: { title: "How big should a hallway/foyer be? Size guide", publisher: "Plan7Architect", url: "https://plan7architect.com/?p=74547", date: null, accessed: "2026-10-03" },
  S3: { title: "Average Room Sizes: Guide for Interior Designers & DIYers", publisher: "DesignFiles", url: "https://blog.designfiles.co/average-room-size/", date: "2025-09-15", accessed: "2026-10-03" },
  S4: { title: "Design Walkthroughs - Common Room Sizes and Square Footage", publisher: "Punch! Software", url: "https://www.punchsoftware.com/blog/post/common-room-sizes", date: "2019-03-05", accessed: "2026-10-03" },
  S6: { title: "Standard ceiling height", publisher: "Bob Vila", url: "https://www.bobvila.com/articles/standard-ceiling-height/", date: "2019-12-19", accessed: "2026-10-03" },
  S7: { title: "Hey, that's not a bedroom (IRC R304/R305)", publisher: "EVstudio", url: "https://evstudio.com/hey-thats-not-a-bedroom/", date: "2022-05-20", accessed: "2026-10-03" },
  S8: { title: "Wood Straight Staircase Length", publisher: "Ask the Builder", url: "https://www.askthebuilder.com/wood-straight-staircase-length/", date: null, accessed: "2026-10-03" },
  S9: { title: "Laundry room sizing guide: minimums, averages & more", publisher: "Block Renovation", url: "https://www.blockrenovation.com/guides/laundry-room-sizing-guide-minimums-averages-more", date: "2026-04-23", accessed: "2026-10-03" },
  S10: { title: "What Is the Average Size of a Home Office?", publisher: "Engineer Fix", url: "https://engineerfix.com/what-is-the-average-size-of-a-home-office/", date: "2026-01-08", accessed: "2026-10-03" },
  S11: { title: "How to Set Up a Home Office in a Spare Bedroom", publisher: "FindOfficeFurniture.com", url: "https://www.findofficefurniture.com/plan/home-office-spare-bedroom.html", date: "2026-03-27", accessed: "2026-10-03" },
  S12: { title: "How Wide is a Hallway? Standard Width Requirements & Building Codes", publisher: "Planner 5D", url: "https://planner5d.com/blog/how-wide-is-a-hallway/", date: "2025-10-22", accessed: "2026-10-03" },
  S13: { title: "Basement: Size, Functionality, Uses, Furniture and Renovation", publisher: "ArchitectureLab", url: "https://dev.architecturelab.net/house/room/basement/", date: "2024-05-15", accessed: "2026-10-03" },
  S14: { title: "Family Room: Size, Functionality, Uses, Furniture and Renovation", publisher: "ArchitectureLab", url: "https://dev.architecturelab.net/house/room/family-room/", date: "2024-05-15", accessed: "2026-10-03" },
  S15: { title: "Home Office: Size, Functionality, Uses, Furniture and Renovation", publisher: "ArchitectureLab", url: "https://dev.architecturelab.net/house/room/home-office/", date: "2024-05-15", accessed: "2026-10-03" },
  S16: { title: "Residential Stairs (IRC/CRC R311.7 handout)", publisher: "Placer County, California", url: "https://www.placer.ca.gov/DocumentCenter/View/3303/Residential-Stairs-PDF", date: null, accessed: "2026-10-03" },
  S17: { title: "Vancouver Building By-law 2019, Part 9, Section 9.5", publisher: "City of Vancouver / BC Publications", url: "https://free.bcpublications.ca/civix/document/id/public/vbbl2019/1102895854", date: "2021-01-01", accessed: "2026-10-03" },
  S18: { title: "Technical housing standards - nationally described space standard", publisher: "UK Government (MHCLG)", url: "https://www.gov.uk/government/publications/technical-housing-standards-nationally-described-space-standard/technical-housing-standards-nationally-described-space-standard", date: "2015-03-27", accessed: "2026-10-03" },
  S19: { title: "Shrinking homes: the average British house is 20% smaller than in the 1970s", publisher: "Which? (LABC Warranty analysis)", url: "https://www.which.co.uk/news/article/shrinking-homes-the-average-british-house-20-smaller-than-in-1970s-ac9jJ2N0HtVF", date: "2018-04-14", accessed: "2026-10-03" },
  S20: { title: "UK Homes Are Getting Smaller", publisher: "Hunters (LABC Warranty study)", url: "https://www.hunters.com/guides/forest-hill/uk-homes-are-getting-smaller/", date: "2019-12-12", accessed: "2026-10-03" },
  S21: { title: "Is there a minimal ceiling height?", publisher: "BuildHub forum", url: "https://forum.buildhub.org.uk/topic/10710-is-there-a-minimal-ceiling-height", date: "2019-07", accessed: "2026-10-03" },
  S22: { title: "Standard ceiling height", publisher: "learnarchitecture.net", url: "https://learnarchitecture.net/interior-design/35630-standard-ceiling-height.html", date: null, accessed: "2026-10-03" },
  S23: { title: "Bathroom Size Guide: Exact Dimensions, Layout Tips & Common Mistakes", publisher: "Bathroom Mountain", url: "https://www.bathroommountain.co.uk/inspiration-and-advice/bathroom-size/", date: null, accessed: "2026-10-03" },
  S24: { title: "Bathroom layouts: getting the most out of your bathroom size", publisher: "Victorian Plumbing", url: "https://victorianplumbing.co.uk/bathroom-ideas-and-inspiration/bathroom-layouts-getting-the-most-out-of-your-bathroom-size", date: "2021-06-15", accessed: "2026-10-03" },
  S25: { title: "Toilet dimensions: do you have space for an extra bathroom?", publisher: "Homebuilding & Renovating", url: "https://www.homebuilding.co.uk/advice/toilet-dimensions", date: "2024-12-23", accessed: "2026-10-03" },
  S26: { title: "Room sizes: how to get them right", publisher: "Homebuilding & Renovating", url: "https://www.homebuilding.co.uk/advice/room-sizes-how-to-get-them-right", date: "2022-11-28", accessed: "2026-10-03" },
  S27: { title: "Staircase design: size, materials, regulations and more", publisher: "Homebuilding & Renovating", url: "https://www.homebuilding.co.uk/ideas/staircase-design-guide", date: "2022-09-08", accessed: "2026-10-03" },
  S28: { title: "How to design a utility room", publisher: "Which?", url: "https://www.which.co.uk/reviews/washing-machines/article/how-to-design-a-utility-room-aW4qJ5G4Upvw", date: "2025-09-19", accessed: "2026-10-03" },
  S29: { title: "Lifetime Homes criterion 6: internal doorways and hallways", publisher: "Centre for Accessible Environments", url: "https://cae.org.uk/our-services/housing-services/lifetime-homes/6-internal-doorways-and-hallways/", date: null, accessed: "2026-10-03" },
  S30: { title: "Can I add a basement to my home?", publisher: "Build It", url: "https://www.self-build.co.uk/can-i-add-basement-my-home/", date: null, accessed: "2026-10-03" },
  S31: { title: "NCC 2022 Housing Provisions, Part 10.3 Room heights", publisher: "Australian Building Codes Board", url: "https://abcb.gov.au/editions/ncc-2022/adopted/housing-provisions/10-health-and-amenity/part-103-room-heights", date: "2022", accessed: "2026-10-03" },
  S32: { title: "Apartment Design Guide, Part 4: Designing the building", publisher: "NSW Department of Planning", url: "https://www.planning.nsw.gov.au/sites/default/files/2023-03/apartment-design-guide-part-4-designing-the-building.pdf", date: "2015", accessed: "2026-10-03" },
  S33: { title: "Guide to standard ceiling heights in Australia", publisher: "Brighton Homes", url: "https://www.brightonhomes.net.au/blogs/guide-standard-ceiling-heights-australia", date: null, accessed: "2026-10-03" },
  S34: { title: "Standard ceiling height Australia", publisher: "G.J. Gardner Homes", url: "https://www.gjgardner.com.au/learn/building-with-gj/standard-ceiling-height-australia/", date: null, accessed: "2026-10-03" },
  S35: { title: "A guide to standard ceiling heights in Australia", publisher: "HouseSpec Builders", url: "https://housespec.com.au/a-guide-to-standard-ceiling-heights-in-australia", date: "2024-04-20", accessed: "2026-10-03" },
  S36: { title: "How to choose the right mattress size for your bedroom", publisher: "X-Press Magazine", url: "https://xpressmag.com.au/how-to-choose-the-right-mattress-size-for-your-bedroom/", date: "2026-03-16", accessed: "2026-10-03" },
  S37: { title: "Standard bathroom dimensions - average bathroom size in Australia", publisher: "Habitus Living", url: "https://www.habitusliving.com/series/standard-bathroom-size-dimensions-australia", date: null, accessed: "2026-10-03" },
  S38: { title: "Standard bathroom sizes & dimensions", publisher: "Blue Leaf Bathware & Tiles", url: "https://blueleafbath.com.au/blogs/blog-posts/standard-bathroom-sizes-dimensions", date: "2026-07-08", accessed: "2026-10-03" },
  S39: { title: "Basements in Australia, what to consider", publisher: "OzBargain forum", url: "https://ozbargain.com.au/node/755439", date: null, accessed: "2026-10-03" },
  S40: { title: "Grundriss planen: Richtwerte für Raumgrößen", publisher: "fertighaus.de", url: "https://www.fertighaus.de/ratgeber/hausbau/grundriss-planen-richtwerte-fuer-raumgroessen/", date: "2026-08-19", accessed: "2026-10-03" },
  S41: { title: "Wie groß sollte ein Einfamilienhaus sein?", publisher: "Bausparkasse Schwäbisch Hall", url: "https://www.schwaebisch-hall.de/ratgeber/immobilie-bauen/das-ideale-familienhaus.html", date: "2026-04-16", accessed: "2026-10-03" },
  S42: { title: "Bauordnung für Berlin, § 47 Aufenthaltsräume", publisher: "gesetze.co", url: "https://gesetze.co/BE/BauO_Bln/47", date: null, accessed: "2026-10-03" },
  S43: { title: "Die Deckenhöhe: gesetzliche Vorgaben und Mindesthöhen bei Alt- und Neubau", publisher: "Mietpreise.info", url: "https://www.mietpreise.info/site/deckenhoehe", date: "2023-12-22", accessed: "2026-10-03" },
  S44: { title: "Treppenplanung im Eigenheim (DIN 18065)", publisher: "Baulinks.de", url: "https://www.baulinks.de/webplugin/2003/1044.php4", date: "2003-09-23", accessed: "2026-10-03" },
  S45: { title: "Décret n° 2002-120 relatif aux caractéristiques du logement décent", publisher: "Légifrance", url: "https://www.legifrance.gouv.fr/loda/id/JORFTEXT000000217471", date: "2002-01-30", accessed: "2026-10-03" },
  S46: { title: "Qualitel passe au crible le logement des Français et son évolution", publisher: "Banque des Territoires (Qualitel survey)", url: "https://www.banquedesterritoires.fr/qualitel-passe-au-crible-le-logement-des-francais-et-son-evolution", date: "2021-09-27", accessed: "2026-10-03" },
  S47: { title: "Logement : quelles sont les grandes évolutions en France", publisher: "MonImmeuble (Qualitel)", url: "https://monimmeuble.com/actualite/logement-quelles-sont-les-grandes-evolutions-en-france", date: "2022-12-25", accessed: "2026-10-03" },
  S48: { title: "Hauteur sous plafond minimum : quelles sont les règles ?", publisher: "SeLoger", url: "https://edito.seloger.com/node/15253", date: "2026-06-08", accessed: "2026-10-03" },
  S49: { title: "Mètre carré et confort : connaissez-vous la moyenne française ?", publisher: "La Maison Saint-Gobain", url: "https://www.lamaisonsaintgobain.fr/blog/insolites/metre-carre-et-confort-connaissez-vous-la-moyenne-francaise", date: "2023-04-18", accessed: "2026-10-03" },
  S50: { title: "La surface moyenne d'une maison en France", publisher: "Crédit Agricole e-immobilier", url: "https://e-immobilier.credit-agricole.fr/conseils/marche/la-surface-moyenne-des-logements-en-france-est-de-90-9-m2", date: "2026-04-07", accessed: "2026-10-03" },
  S51: { title: "Surface habitable : définition et calcul", publisher: "Journal du Net", url: "https://www.journaldunet.com/patrimoine/guide-de-l-immobilier/1209549-surface-habitable/", date: "2021-04-19", accessed: "2026-10-03" },
  S52: { title: "Infraviviendas legales: cuáles son las condiciones mínimas de un piso", publisher: "La Marea", url: "https://www.lamarea.com/2023/05/26/infraviviendas-legales-cuales-son-las-condiciones-minimas-de-un-piso", date: "2023-05-26", accessed: "2026-10-03" },
  S53: { title: "Cédulas de habitabilidad", publisher: "Habitissimo", url: "https://www.habitissimo.es/presupuestos/cedulas-de-habitabilidad", date: "2026-09-16", accessed: "2026-10-03" },
  S54: { title: "Habitabilidad Cataluña (Decreto 141/2012)", publisher: "Normatia", url: "https://normatia.com/es/normativa/habitabilidad-cataluna", date: "2020-12-12", accessed: "2026-10-03" },
  S55: { title: "Lo que nunca te han contado de bajar el techo", publisher: "Campus Training", url: "https://www.campustraining.es/noticias/lo-nunca-contado-bajar-techo/", date: "2025-01-08", accessed: "2026-10-03" },
  S56: { title: "Medidas para un dormitorio estándar", publisher: "Planner 5D (ES)", url: "https://planner5d.com/blog/es/medidas-para-un-dormitorio-estandar/", date: "2025-06-23", accessed: "2026-10-03" },
  S57: { title: "Decreto ministeriale Sanità 5 luglio 1975", publisher: "Bosetti e Gatti (law text)", url: "https://www.bosettiegatti.eu/info/norme/statali/1975_dm_05_07.htm", date: "1975-07-05", accessed: "2026-10-03" },
  S58: { title: "Superfici e altezze minime: bagno, cucina, soggiorno, camera", publisher: "Studio Madera", url: "https://studiomadera.it/news/350-dimensioni-minime", date: "2026-09-11", accessed: "2026-10-03" },
  S59: { title: "Sfruttare l'altezza dei soffitti per recuperare spazio", publisher: "Cose di Casa", url: "https://www.cosedicasa.com/ristrutturare/progetti-ristrutturazione/sfruttare-laltezza-dei-soffitti-per-recuperare-spazio-54922", date: "2025-01-10", accessed: "2026-10-03" },
});

// A room type the region does not paint as a room (a cellar is storage), with
// the reason. The picker does not offer it; a contractor quotes one by hand.
const notOffered = (why, sources) => ({ offered: false, why, sources });

export const ROOM_REGIONS = Object.freeze({
  north_america: {
    unit: "ft",
    // 8 ft, not 9: most repaints are existing homes; 9 ft is the new-build
    // norm (S6, S22). 10 ft as high (S3, S6). Code minimum 7 ft (S7).
    ceiling: { standard: 8, high: 10, sources: ["S3", "S6", "S22", "S7", "S17"] },
    rooms: {
      living: { small: [13, 10], medium: [18, 13], large: [20, 15], kind: "guide / INFERRED / guide", sources: ["S4", "S3"] },
      kitchen: { small: [10, 8], medium: [14, 12], large: [20, 15], kind: "guide / guide / guide", sources: ["S3"] },
      dining: { small: [11, 11], medium: [14, 12], large: [16, 12], kind: "guide / guide / guide", sources: ["S4", "S3"] },
      primary_bedroom: { small: [12, 12], medium: [16, 14], large: [20, 16], kind: "INFERRED / guide / guide", sources: ["S3", "S4"] },
      bedroom: { small: [10, 10], medium: [12, 11], large: [12, 12], kind: "guide / guide / guide", sources: ["S3", "S11"] },
      bathroom: { small: [7, 5], medium: [8, 6], large: [12, 10], kind: "INFERRED / guide / guide", sources: ["S3"] },
      ensuite: { small: [5, 4], medium: [6, 5], large: [8, 5], kind: "guide / guide / INFERRED", sources: ["S3"] },
      hallway: { small: [10, 3], medium: [15, 4], large: [20, 4], kind: "INFERRED / INFERRED / INFERRED (widths sourced)", sources: ["S12", "S7"] },
      stairwell: { small: [11, 3], medium: [14, 3], large: [16, 4], kind: "guide / guide / INFERRED", sources: ["S8", "S16"] },
      office: { small: [10, 8], medium: [12, 10], large: [15, 10], kind: "guide / guide / guide", sources: ["S10", "S11", "S15"] },
      laundry: { small: [6, 6], medium: [9, 6], large: [11, 9], kind: "guide / guide / guide", sources: ["S9"] },
      // Its own ceiling: a basement is lower than the floors above (7–8 ft,
      // S13; the 7.5 ft standard is that range's midpoint, INFERRED).
      basement: { small: [16, 12], medium: [20, 15], large: [30, 20], kind: "INFERRED / INFERRED / INFERRED", sources: ["S14", "S13"], ceiling: { standard: 7.5, high: 8 } },
    },
  },
  uk: {
    unit: "m",
    // Building Regs set no room height (S21); NDSS 2.3 m (S18); 2.4 m typical
    // (S21); Victorian/Edwardian 3.0–3.7 m (S22).
    ceiling: { standard: 2.4, high: 3.0, sources: ["S21", "S18", "S22"] },
    rooms: {
      living: { small: [3.8, 3.2], medium: [4.8, 3.6], large: [6.0, 4.2], kind: "INFERRED / measured / measured", sources: ["S19", "S20"] },
      kitchen: { small: [3.0, 2.4], medium: [4.0, 3.4], large: [4.8, 4.2], kind: "INFERRED / measured / recommended", sources: ["S19", "S26"] },
      dining: { small: [3.0, 3.0], medium: [3.6, 3.2], large: [4.5, 4.0], kind: "recommended / INFERRED / recommended", sources: ["S26"] },
      primary_bedroom: { small: [4.2, 2.8], medium: [4.0, 3.4], large: [4.5, 4.5], kind: "minimum / measured / recommended", sources: ["S18", "S19", "S26"] },
      bedroom: { small: [3.5, 2.2], medium: [3.4, 3.0], large: [4.0, 3.0], kind: "minimum / guide / recommended", sources: ["S18", "S26"] },
      bathroom: { small: [2.1, 1.7], medium: [2.4, 1.8], large: [3.0, 2.5], kind: "guide / guide / guide", sources: ["S23", "S24", "S26"] },
      ensuite: { small: [1.4, 0.8], medium: [2.0, 1.5], large: [2.2, 2.0], kind: "guide / guide / recommended", sources: ["S25", "S23", "S24", "S26"] },
      hallway: { small: [3.0, 0.9], medium: [4.0, 1.0], large: [5.0, 1.8], kind: "INFERRED / INFERRED / INFERRED (width sourced)", sources: ["S29", "S2"] },
      stairwell: { small: [2.7, 0.9], medium: [3.6, 0.9], large: [4.5, 1.0], kind: "guide / INFERRED / INFERRED", sources: ["S27"] },
      office: { small: [3.5, 2.2], medium: [3.6, 2.6], large: [4.0, 3.0], kind: "minimum / recommended / recommended", sources: ["S18", "S26"] },
      laundry: { small: [1.9, 1.5], medium: [2.4, 1.8], large: [3.0, 2.4], kind: "guide / minimum / recommended", sources: ["S28", "S26"] },
      basement: notOffered("Basements are not a normal feature of British homes; a cellar is quoted as a custom room.", ["S30"]),
    },
  },
  australia: {
    unit: "m",
    // NCC 2.4 m habitable (S31); 2.55–2.7 m common upgrades (S34, S35).
    ceiling: { standard: 2.4, high: 2.7, sources: ["S31", "S33", "S34", "S35", "S32"] },
    rooms: {
      living: { small: [4.0, 3.6], medium: [5.5, 4.5], large: [7.0, 5.0], kind: "minimum / INFERRED / guide", sources: ["S32", "S1"] },
      kitchen: { small: [3.0, 2.4], medium: [4.0, 3.0], large: [5.0, 4.0], kind: "INFERRED / guide / INFERRED", sources: ["S1", "S26"] },
      dining: { small: [3.0, 2.8], medium: [4.0, 3.5], large: [5.0, 4.0], kind: "guide / guide / guide", sources: ["S1"] },
      primary_bedroom: { small: [3.4, 3.0], medium: [4.0, 3.5], large: [4.5, 4.0], kind: "minimum / guide / guide", sources: ["S32", "S36"] },
      bedroom: { small: [3.0, 3.0], medium: [3.3, 3.0], large: [4.0, 3.0], kind: "minimum / INFERRED / guide", sources: ["S32", "S1"] },
      bathroom: { small: [2.0, 2.0], medium: [3.0, 2.0], large: [3.5, 2.7], kind: "guide / guide / INFERRED", sources: ["S38", "S37"] },
      ensuite: { small: [1.5, 1.2], medium: [2.0, 1.8], large: [2.7, 2.0], kind: "guide / guide / INFERRED", sources: ["S38", "S37"] },
      hallway: { small: [3.0, 0.9], medium: [5.0, 1.0], large: [7.0, 1.2], kind: "INFERRED / INFERRED / INFERRED", sources: ["S12", "S2"] },
      stairwell: { small: [3.0, 0.9], medium: [3.6, 1.0], large: [4.5, 1.2], kind: "INFERRED / INFERRED / INFERRED", sources: ["S27", "S44", "S31"] },
      office: { small: [3.0, 3.0], medium: [3.6, 3.0], large: [4.5, 4.0], kind: "guide / INFERRED / guide", sources: ["S15", "S32"] },
      laundry: { small: [1.8, 1.2], medium: [2.7, 1.8], large: [3.0, 2.4], kind: "INFERRED / INFERRED / INFERRED", sources: ["S9", "S26"] },
      basement: notOffered("Australian houses are overwhelmingly slab-on-ground without basements; a basement is quoted as a custom room.", ["S39"]),
    },
  },
  germany: {
    unit: "m",
    // Land minimums mostly 2.40 m (S42, S43); new builds 2.30–2.50 m (S40,
    // S43); pre-1918 Altbau 3.30–4.50 m (S43).
    ceiling: { standard: 2.5, high: 3.3, sources: ["S43", "S40", "S42"] },
    rooms: {
      living: { small: [4.5, 3.6], medium: [5.5, 4.5], large: [7.0, 5.0], kind: "INFERRED / guide / guide", sources: ["S41", "S40"] },
      kitchen: { small: [3.4, 3.0], medium: [4.0, 3.5], large: [5.0, 4.0], kind: "recommended / guide / guide", sources: ["S40", "S41"] },
      dining: { small: [3.0, 2.8], medium: [3.6, 3.0], large: [4.5, 3.5], kind: "guide / guide / guide", sources: ["S1", "S40"] },
      primary_bedroom: { small: [4.0, 3.0], medium: [4.5, 3.5], large: [5.0, 4.0], kind: "guide / guide / guide", sources: ["S40", "S41"] },
      bedroom: { small: [3.4, 3.0], medium: [4.0, 3.2], large: [4.5, 3.5], kind: "guide / guide / recommended", sources: ["S40", "S41"] },
      bathroom: { small: [2.5, 2.0], medium: [3.2, 2.5], large: [4.0, 3.0], kind: "INFERRED / guide / guide", sources: ["S40", "S41"] },
      ensuite: { small: [1.5, 1.0], medium: [2.0, 1.5], large: [2.5, 2.0], kind: "INFERRED / guide / INFERRED", sources: ["S40"] },
      hallway: { small: [3.0, 1.2], medium: [4.0, 1.3], large: [4.0, 2.0], kind: "INFERRED / guide / guide", sources: ["S40"] },
      stairwell: { small: [3.2, 0.9], medium: [4.0, 1.0], large: [5.0, 1.2], kind: "INFERRED / guide / INFERRED", sources: ["S44"] },
      office: { small: [3.0, 2.6], medium: [3.4, 3.0], large: [4.0, 3.0], kind: "guide / guide / guide", sources: ["S40", "S41"] },
      laundry: { small: [2.0, 1.5], medium: [2.5, 2.0], large: [4.0, 2.5], kind: "guide / guide / guide", sources: ["S40"] },
      basement: notOffered("A Keller is storage and plant space, not living area; a finished Hobbyraum is quoted as a custom room.", ["S40"]),
    },
  },
  france: {
    unit: "m",
    // New builds ~2.50 m (S48); Qualitel measured 2.67 m pre-1945, 2.40 m
    // post-2009 (S46); Haussmann often above 3 m (S48); minimum 2.20 m (S45).
    ceiling: { standard: 2.5, high: 3.0, sources: ["S48", "S46", "S45"] },
    rooms: {
      living: { small: [4.0, 3.6], medium: [5.0, 4.2], large: [6.5, 5.0], kind: "INFERRED / measured / guide", sources: ["S47", "S49", "S1"] },
      kitchen: { small: [3.0, 2.3], medium: [3.5, 3.0], large: [4.5, 3.5], kind: "recommended / INFERRED / guide", sources: ["S49", "S50", "S1"] },
      dining: { small: [3.0, 2.8], medium: [4.0, 3.5], large: [5.0, 4.0], kind: "guide / guide / guide", sources: ["S1"] },
      primary_bedroom: { small: [4.0, 3.0], medium: [4.2, 3.4], large: [5.0, 4.0], kind: "recommended / measured / guide", sources: ["S49", "S50", "S46", "S1"] },
      bedroom: { small: [3.0, 3.0], medium: [3.5, 3.2], large: [4.0, 3.5], kind: "minimum / measured / measured", sources: ["S45", "S49", "S46", "S47"] },
      bathroom: { small: [2.0, 1.7], medium: [2.2, 1.8], large: [3.0, 2.5], kind: "INFERRED / recommended / INFERRED", sources: ["S49", "S50"] },
      ensuite: { small: [1.6, 1.2], medium: [2.0, 1.5], large: [2.0, 2.0], kind: "guide / guide / guide", sources: ["S1"] },
      hallway: { small: [2.0, 1.2], medium: [3.0, 1.8], large: [4.0, 2.5], kind: "guide / guide / guide", sources: ["S2"] },
      stairwell: { small: [3.2, 0.9], medium: [4.0, 1.0], large: [5.0, 1.2], kind: "INFERRED / INFERRED / INFERRED", sources: ["S44"] },
      office: { small: [3.0, 3.0], medium: [3.4, 3.0], large: [4.0, 3.0], kind: "minimum / INFERRED / INFERRED", sources: ["S45", "S49", "S40"] },
      laundry: { small: [2.0, 1.5], medium: [2.5, 2.0], large: [3.0, 2.5], kind: "INFERRED / INFERRED / INFERRED", sources: ["S40"] },
      basement: notOffered("Caves and sous-sols are storage, excluded from habitable surface; a converted basement is quoted as a custom room.", ["S51"]),
    },
  },
  spain: {
    unit: "m",
    // 2.50 m minimum in rooms (S53, S54), where new builds sit (S55); historic
    // city flats ~3.5 m or more (S55).
    ceiling: { standard: 2.5, high: 3.5, sources: ["S53", "S54", "S55"] },
    rooms: {
      living: { small: [4.0, 3.5], medium: [5.0, 4.0], large: [6.5, 5.0], kind: "INFERRED / INFERRED / guide", sources: ["S52", "S1"] },
      kitchen: { small: [2.5, 2.0], medium: [3.5, 2.8], large: [4.5, 3.5], kind: "minimum / INFERRED / guide", sources: ["S52", "S1"] },
      dining: { small: [3.0, 2.7], medium: [4.0, 3.5], large: [5.0, 4.0], kind: "minimum / minimum / minimum", sources: ["S52"] },
      primary_bedroom: { small: [3.4, 3.0], medium: [4.0, 3.5], large: [5.0, 4.0], kind: "minimum / guide / guide", sources: ["S52", "S56"] },
      bedroom: { small: [3.0, 2.0], medium: [3.5, 3.0], large: [4.0, 3.0], kind: "minimum / guide / guide", sources: ["S52", "S56"] },
      bathroom: { small: [2.0, 1.5], medium: [2.5, 1.8], large: [3.0, 2.5], kind: "minimum / INFERRED / INFERRED", sources: ["S52"] },
      ensuite: { small: [1.5, 1.0], medium: [2.0, 1.5], large: [2.5, 1.8], kind: "minimum / guide / INFERRED", sources: ["S52", "S1"] },
      hallway: { small: [2.0, 1.2], medium: [3.0, 1.8], large: [4.0, 2.5], kind: "guide / guide / guide", sources: ["S2", "S52", "S54"] },
      stairwell: { small: [3.2, 0.9], medium: [4.0, 1.0], large: [5.0, 1.2], kind: "minimum / INFERRED / INFERRED", sources: ["S53", "S44"] },
      office: { small: [3.0, 2.0], medium: [3.5, 3.0], large: [4.0, 3.0], kind: "minimum / guide / guide", sources: ["S52", "S56"] },
      laundry: { small: [1.5, 1.2], medium: [2.0, 1.5], large: [2.5, 2.0], kind: "INFERRED / INFERRED / INFERRED", sources: ["S40"] },
      basement: notOffered("Most homes are flats; a sótano is a garage or storeroom rather than a living room (weakly sourced).", ["S53", "S52"]),
    },
  },
  italy: {
    unit: "m",
    // 2.70 m legal minimum in habitable rooms (S57), the new-build norm
    // (S59). 3.3 m high is INFERRED from DE/FR/ES period stock — S59 says
    // older stock is notably higher and gives no figure.
    ceiling: { standard: 2.7, high: 3.3, sources: ["S57", "S59", "S58"] },
    rooms: {
      living: { small: [4.0, 3.5], medium: [5.0, 4.0], large: [6.5, 5.0], kind: "minimum / INFERRED / guide", sources: ["S57", "S1"] },
      kitchen: { small: [2.5, 2.0], medium: [3.4, 2.7], large: [4.5, 3.5], kind: "minimum / minimum / guide", sources: ["S58", "S1"] },
      dining: { small: [3.0, 2.8], medium: [4.0, 3.5], large: [5.0, 4.0], kind: "guide / guide / guide", sources: ["S1"] },
      primary_bedroom: { small: [4.0, 3.5], medium: [4.5, 3.6], large: [5.0, 4.0], kind: "minimum / INFERRED / guide", sources: ["S57", "S1"] },
      bedroom: { small: [3.0, 3.0], medium: [3.6, 3.0], large: [4.0, 3.5], kind: "minimum / INFERRED / minimum", sources: ["S57"] },
      bathroom: { small: [2.0, 1.5], medium: [2.5, 2.0], large: [3.5, 2.5], kind: "INFERRED / INFERRED / guide", sources: ["S58", "S1"] },
      ensuite: { small: [1.6, 1.2], medium: [2.0, 1.5], large: [2.0, 2.0], kind: "guide / guide / guide", sources: ["S1"] },
      hallway: { small: [2.0, 1.2], medium: [3.0, 1.8], large: [4.0, 2.5], kind: "guide / guide / guide", sources: ["S2"] },
      stairwell: { small: [3.5, 0.9], medium: [4.3, 1.0], large: [5.3, 1.2], kind: "INFERRED / INFERRED / INFERRED", sources: ["S44", "S57"] },
      office: { small: [3.0, 3.0], medium: [3.6, 3.0], large: [4.0, 3.5], kind: "minimum / INFERRED / minimum", sources: ["S57"] },
      laundry: { small: [2.0, 1.5], medium: [2.5, 2.0], large: [3.0, 2.5], kind: "INFERRED / INFERRED / INFERRED", sources: ["S40"] },
      basement: notOffered("Cantine are storage outside the habitable-room rules; a converted taverna is quoted as a custom room (weakly sourced).", ["S57"]),
    },
  },
  eu: {
    unit: "m",
    // INFERRED composite: the median of Germany, France, Spain and Italy.
    ceiling: { standard: 2.5, high: 3.3, sources: ["S43", "S48", "S53", "S57", "S59"] },
    rooms: {
      living: { small: [4.0, 3.5], medium: [5.0, 4.1], large: [6.5, 5.0], kind: "INFERRED (median of DE/FR/ES/IT)", sources: ["S41", "S40", "S47", "S49", "S1", "S52", "S57"] },
      kitchen: { small: [2.8, 2.1], medium: [3.5, 2.9], large: [4.5, 3.5], kind: "INFERRED (median of DE/FR/ES/IT)", sources: ["S40", "S41", "S49", "S50", "S1", "S52", "S58"] },
      dining: { small: [3.0, 2.8], medium: [4.0, 3.5], large: [5.0, 4.0], kind: "INFERRED (median of DE/FR/ES/IT)", sources: ["S1", "S40", "S52"] },
      primary_bedroom: { small: [4.0, 3.0], medium: [4.3, 3.5], large: [5.0, 4.0], kind: "INFERRED (median of DE/FR/ES/IT)", sources: ["S40", "S41", "S49", "S50", "S46", "S1", "S52", "S56", "S57"] },
      bedroom: { small: [3.0, 3.0], medium: [3.5, 3.1], large: [4.0, 3.5], kind: "INFERRED (median of DE/FR/ES/IT)", sources: ["S40", "S41", "S45", "S49", "S46", "S47", "S52", "S56", "S57"] },
      bathroom: { small: [2.0, 1.6], medium: [2.5, 1.9], large: [3.2, 2.5], kind: "INFERRED (median of DE/FR/ES/IT)", sources: ["S40", "S41", "S49", "S50", "S52", "S58", "S1"] },
      ensuite: { small: [1.6, 1.1], medium: [2.0, 1.5], large: [2.2, 2.0], kind: "INFERRED (median of DE/FR/ES/IT)", sources: ["S40", "S1", "S52"] },
      hallway: { small: [2.0, 1.2], medium: [3.0, 1.8], large: [4.0, 2.5], kind: "INFERRED (median of DE/FR/ES/IT)", sources: ["S40", "S2", "S52", "S54"] },
      stairwell: { small: [3.2, 0.9], medium: [4.0, 1.0], large: [5.0, 1.2], kind: "INFERRED (median of DE/FR/ES/IT)", sources: ["S44", "S53", "S57"] },
      office: { small: [3.0, 2.8], medium: [3.5, 3.0], large: [4.0, 3.0], kind: "INFERRED (median of DE/FR/ES/IT)", sources: ["S40", "S41", "S45", "S49", "S52", "S56", "S57"] },
      laundry: { small: [2.0, 1.5], medium: [2.5, 2.0], large: [3.0, 2.5], kind: "INFERRED (median of DE/FR/ES/IT)", sources: ["S40"] },
      basement: notOffered("No continental country in this set treats a basement as a living room; cellars are storage.", ["S40", "S51"]),
    },
  },
});

// The company's stated country → its table. Every country the product sells
// in (COUNTRIES in lib/currency.js) is here, plus Italy, whose table exists.
// Ireland reads the UK table and New Zealand the Australian one: no source
// for either was read, and their housing stock is the nearest comparable —
// said here and in the research file rather than presented as their own.
// The Netherlands and Switzerland read the continental median.
export const REGION_BY_COUNTRY = Object.freeze({
  US: "north_america",
  CA: "north_america",
  GB: "uk",
  IE: "uk",
  AU: "australia",
  NZ: "australia",
  DE: "germany",
  FR: "france",
  ES: "spain",
  IT: "italy",
  NL: "eu",
  CH: "eu",
});

// The product's home market, and the one a company with no stated country is
// assumed to be in — said on the draft ("company country not set") rather
// than passed off as a fact.
export const DEFAULT_ROOM_REGION = "north_america";

// A stairwell's wall runs through both floors it joins.
export const STAIRWELL_STOREYS = 2;
