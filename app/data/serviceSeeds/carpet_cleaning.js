// app/data/serviceSeeds/carpet_cleaning.js
//
// The service list a carpet-cleaning company starts from — the benchmark's
// carpet-cleaning book, then its two-row carpet-repair book and one-row rug
// book, in that order. Read ./index.js for the format and the rules.
import { L, SHARED, D, T, withTemplates, withLanguages } from "./_templateLines";
import { I18N } from "./i18n/carpet_cleaning.js";

const BM = (low, median, high) => ({ low, median, high, currency: "USD", source: "benchmark", asOf: "2026-09-21" });
const S = (seedKey, category, unit, benchmark, [en, fr, es], [den, dfr, des], extra = {}) => ({
  seedKey, category, name: { en, fr, es }, description: { en: den, fr: dfr, es: des },
  unit, benchmark, durationMinutes: null, bookable: false, ...extra,
});

export const SEED = {
  trade: "carpet_cleaning",
  categories: [
    { key: "add_ons", name: { en: "Add-ons and protection", fr: "Compléments et protection", es: "Complementos y protección" } },
    { key: "visits", name: { en: "Booked cleanings", fr: "Nettoyages réservés", es: "Limpiezas agendadas" } },
    { key: "carpet", name: { en: "Carpet cleaning", fr: "Nettoyage de tapis", es: "Limpieza de alfombras" } },
    { key: "specialty", name: { en: "Specialty cleaning and repair", fr: "Nettoyage spécialisé et réparation", es: "Limpieza especializada y reparación" } },
  ],
  services: [
    S("fq.carpet_cleaning.add_ons.pet_treatment", "add_ons", "flat", null,
      ["Pet stain and odour treatment — carpet and upholstery", "Traitement de taches et d'odeurs d'animaux — tapis et tissus", "Tratamiento de manchas y olores de mascotas — alfombra y tapicería"],
      ["An enzyme treatment applied to pet-soiled spots to break down the stain and the smell at the source.",
       "Traitement enzymatique appliqué sur les zones souillées par les animaux pour décomposer la tache et l'odeur à la source.",
       "Tratamiento enzimático aplicado en las zonas manchadas por mascotas para descomponer la mancha y el olor desde la fuente."]),
    S("fq.carpet_cleaning.add_ons.protector", "add_ons", "flat", null,
      ["Carpet and fabric protector", "Protecteur pour tapis et tissus", "Protector para alfombra y telas"],
      ["A protective coating applied after cleaning so spills bead up instead of soaking in.",
       "Revêtement protecteur appliqué après le nettoyage pour que les dégâts perlent au lieu de s'imprégner.",
       "Recubrimiento protector aplicado después de la limpieza para que los derrames no se absorban."]),
    S("fq.carpet_cleaning.add_ons.odor_neutralization", "add_ons", "flat", BM(20, 40, 65),
      ["Odour neutralisation — whole area", "Neutralisation des odeurs — zone complète", "Neutralización de olores — área completa"],
      ["An enhanced odour treatment over the whole area, beyond the standard deodoriser.",
       "Traitement d'odeurs renforcé sur toute la zone, au-delà du désodorisant standard.",
       "Tratamiento de olores reforzado en toda el área, más allá del desodorante estándar."]),
    S("fq.carpet_cleaning.visits.deep_cleaning", "visits", "flat", null,
      ["Professional carpet deep cleaning — booked", "Nettoyage en profondeur de tapis — réservé", "Limpieza profunda de alfombra — agendada"],
      ["Hot-water extraction to lift stains, odours and embedded dirt, booked as a visit.",
       "Extraction à l'eau chaude pour retirer taches, odeurs et saleté incrustée, réservée comme visite.",
       "Extracción con agua caliente para eliminar manchas, olores y suciedad incrustada, agendada como visita."], { durationMinutes: 120, bookable: true }),
    S("fq.carpet_cleaning.visits.pet_treatment", "visits", "flat", null,
      ["Pet stain and odour treatment — booked", "Traitement de taches et d'odeurs d'animaux — réservé", "Tratamiento de manchas y olores de mascotas — agendado"],
      ["A booked visit to treat pet stains and odours in the carpet.",
       "Visite réservée pour traiter les taches et odeurs d'animaux dans le tapis.",
       "Visita agendada para tratar manchas y olores de mascotas en la alfombra."], { durationMinutes: 120, bookable: true }),
    S("fq.carpet_cleaning.visits.high_traffic_refresh", "visits", "flat", null,
      ["High-traffic carpet refresh", "Rafraîchissement des zones de passage", "Renovación de alfombra de alto tránsito"],
      ["Worn walkways and entries cleaned and groomed to extend the carpet's life.",
       "Zones de passage et entrées usées nettoyées et brossées pour prolonger la vie du tapis.",
       "Pasillos y entradas desgastados limpiados y cepillados para alargar la vida de la alfombra."], { durationMinutes: 120, bookable: true }),
    S("fq.carpet_cleaning.visits.one_room", "visits", "flat", null,
      ["Carpet cleaning — 1 room, booked", "Nettoyage de tapis — 1 pièce, réservé", "Limpieza de alfombra — 1 cuarto, agendada"],
      ["One carpeted room pre-treated and deep cleaned.",
       "Une pièce tapissée prétraitée et nettoyée en profondeur.",
       "Un cuarto alfombrado pretratado y limpiado a fondo."], { durationMinutes: 120, bookable: true }),
    S("fq.carpet_cleaning.visits.two_rooms", "visits", "flat", null,
      ["Carpet cleaning — 2 rooms, booked", "Nettoyage de tapis — 2 pièces, réservé", "Limpieza de alfombra — 2 cuartos, agendada"],
      ["Two carpeted rooms pre-treated and deep cleaned.",
       "Deux pièces tapissées prétraitées et nettoyées en profondeur.",
       "Dos cuartos alfombrados pretratados y limpiados a fondo."], { durationMinutes: 120, bookable: true }),
    S("fq.carpet_cleaning.visits.three_rooms", "visits", "flat", null,
      ["Carpet cleaning — 3 rooms, booked", "Nettoyage de tapis — 3 pièces, réservé", "Limpieza de alfombra — 3 cuartos, agendada"],
      ["Three carpeted rooms pre-treated and deep cleaned.",
       "Trois pièces tapissées prétraitées et nettoyées en profondeur.",
       "Tres cuartos alfombrados pretratados y limpiados a fondo."], { durationMinutes: 120, bookable: true }),
    S("fq.carpet_cleaning.visits.whole_home", "visits", "flat", null,
      ["Whole-home carpet cleaning — booked", "Nettoyage de tapis de toute la maison — réservé", "Limpieza de alfombra de toda la casa — agendada"],
      ["Every carpeted room in the home cleaned in one booked visit.",
       "Toutes les pièces tapissées de la maison nettoyées en une visite réservée.",
       "Todos los cuartos alfombrados de la casa limpiados en una visita agendada."], { durationMinutes: 120, bookable: true }),
    S("fq.carpet_cleaning.visits.pet_treatment_enzyme", "visits", "flat", null,
      ["Pet stain and odour treatment — enzyme, booked", "Traitement enzymatique de taches et d'odeurs d'animaux — réservé", "Tratamiento enzimático de manchas y olores de mascotas — agendado"],
      ["An enzyme-based treatment booked as its own visit for pet-soiled carpet.",
       "Traitement enzymatique réservé comme visite distincte pour un tapis souillé par les animaux.",
       "Tratamiento enzimático agendado como visita propia para alfombra manchada por mascotas."], { durationMinutes: 120, bookable: true }),
    S("fq.carpet_cleaning.carpet.up_to_250_sqft", "carpet", "flat", null,
      ["Carpet cleaning — up to 250 sq ft", "Nettoyage de tapis — jusqu'à 250 pi²", "Limpieza de alfombra — hasta 250 pies²"],
      ["Deep cleaning of a carpeted area up to 250 square feet.",
       "Nettoyage en profondeur d'une surface tapissée jusqu'à 250 pieds carrés.",
       "Limpieza profunda de un área alfombrada de hasta 250 pies cuadrados."]),
    S("fq.carpet_cleaning.carpet.per_room_standard", "carpet", "each", null,
      ["Carpet cleaning — per room, standard", "Nettoyage de tapis — par pièce, standard", "Limpieza de alfombra — por cuarto, estándar"],
      ["One standard room cleaned by hot-water extraction.",
       "Une pièce standard nettoyée par extraction à l'eau chaude.",
       "Un cuarto estándar limpiado por extracción con agua caliente."]),
    S("fq.carpet_cleaning.carpet.bundle_2_rooms_hallway", "carpet", "flat", null,
      ["Carpet cleaning bundle — 2 rooms and hallway", "Forfait nettoyage — 2 pièces et couloir", "Paquete de limpieza — 2 cuartos y pasillo"],
      ["Two rooms and one hallway cleaned together at a bundled price.",
       "Deux pièces et un couloir nettoyés ensemble à prix forfaitaire.",
       "Dos cuartos y un pasillo limpiados juntos a precio de paquete."]),
    S("fq.carpet_cleaning.carpet.vacant_unit_2br", "carpet", "flat", null,
      ["Carpet cleaning — vacant unit, 2 bedrooms and common areas", "Nettoyage de tapis — logement vide, 2 chambres et aires communes", "Limpieza de alfombra — unidad vacía, 2 recámaras y áreas comunes"],
      ["A vacant two-bedroom unit's carpets cleaned throughout for turnover.",
       "Tapis d'un logement vide de deux chambres nettoyés partout pour la remise en location.",
       "Alfombras de una unidad vacía de dos recámaras limpiadas por completo para la entrega."]),
    S("fq.carpet_cleaning.carpet.one_room", "carpet", "flat", null,
      ["Carpet cleaning — 1 room", "Nettoyage de tapis — 1 pièce", "Limpieza de alfombra — 1 cuarto"],
      ["One carpeted room pre-treated and extracted.",
       "Une pièce tapissée prétraitée et extraite.",
       "Un cuarto alfombrado pretratado y extraído."]),
    S("fq.carpet_cleaning.carpet.two_rooms", "carpet", "flat", null,
      ["Carpet cleaning — 2 rooms", "Nettoyage de tapis — 2 pièces", "Limpieza de alfombra — 2 cuartos"],
      ["Two carpeted rooms pre-treated and extracted.",
       "Deux pièces tapissées prétraitées et extraites.",
       "Dos cuartos alfombrados pretratados y extraídos."]),
    S("fq.carpet_cleaning.carpet.three_rooms", "carpet", "flat", null,
      ["Carpet cleaning — 3 rooms", "Nettoyage de tapis — 3 pièces", "Limpieza de alfombra — 3 cuartos"],
      ["Three carpeted rooms pre-treated and extracted.",
       "Trois pièces tapissées prétraitées et extraites.",
       "Tres cuartos alfombrados pretratados y extraídos."]),
    S("fq.carpet_cleaning.carpet.four_rooms", "carpet", "flat", null,
      ["Carpet cleaning — 4 rooms", "Nettoyage de tapis — 4 pièces", "Limpieza de alfombra — 4 cuartos"],
      ["Four carpeted rooms pre-treated and extracted.",
       "Quatre pièces tapissées prétraitées et extraites.",
       "Cuatro cuartos alfombrados pretratados y extraídos."]),
    S("fq.carpet_cleaning.carpet.five_plus_rooms", "carpet", "flat", null,
      ["Carpet cleaning — 5+ rooms", "Nettoyage de tapis — 5 pièces et plus", "Limpieza de alfombra — 5 o más cuartos"],
      ["A whole home or large area of carpet cleaned in one visit.",
       "Toute une maison ou une grande surface de tapis nettoyée en une visite.",
       "Toda una casa o un área grande de alfombra limpiada en una visita."]),
    S("fq.carpet_cleaning.carpet.hallway", "carpet", "each", null,
      ["Carpet cleaning — hallway", "Nettoyage de tapis — couloir", "Limpieza de alfombra — pasillo"],
      ["A hallway's carpet cleaned with attention to the traffic lane.",
       "Tapis d'un couloir nettoyé avec attention à la zone de passage.",
       "Alfombra de un pasillo limpiada con atención al carril de tránsito."]),
    S("fq.carpet_cleaning.carpet.up_to_3_areas", "carpet", "flat", null,
      ["Carpet cleaning — up to 3 areas", "Nettoyage de tapis — jusqu'à 3 zones", "Limpieza de alfombra — hasta 3 áreas"],
      ["Up to three designated carpeted areas cleaned.",
       "Jusqu'à trois zones tapissées désignées nettoyées.",
       "Hasta tres áreas alfombradas designadas limpiadas."]),
    S("fq.carpet_cleaning.carpet.whole_home_stain_removal", "carpet", "flat", null,
      ["Whole-home carpet cleaning with stain removal", "Nettoyage de tapis de toute la maison avec détachage", "Limpieza de alfombra de toda la casa con eliminación de manchas"],
      ["All the home's carpet cleaned with spot treatment on every stain.",
       "Tout le tapis de la maison nettoyé avec traitement localisé de chaque tache.",
       "Toda la alfombra de la casa limpiada con tratamiento puntual de cada mancha."]),
    S("fq.carpet_cleaning.carpet.whole_house", "carpet", "flat", null,
      ["Carpet cleaning — whole house", "Nettoyage de tapis — maison complète", "Limpieza de alfombra — casa completa"],
      ["Every carpeted room in the house cleaned.",
       "Toutes les pièces tapissées de la maison nettoyées.",
       "Todos los cuartos alfombrados de la casa limpiados."]),
    S("fq.carpet_cleaning.carpet.recurring", "carpet", "flat", null,
      ["Recurring carpet cleaning", "Nettoyage de tapis récurrent", "Limpieza de alfombra recurrente"],
      ["Scheduled carpet cleaning to keep the carpet in good condition year-round.",
       "Nettoyage de tapis planifié pour garder le tapis en bon état toute l'année.",
       "Limpieza de alfombra programada para mantenerla en buen estado todo el año."]),
    S("fq.carpet_cleaning.carpet.stairs_16_steps", "carpet", "flat", BM(50, 70, 100),
      ["Carpet cleaning — stairs, up to 16 steps", "Nettoyage de tapis — escalier, jusqu'à 16 marches", "Limpieza de alfombra — escaleras, hasta 16 escalones"],
      ["Carpeted stairs up to 16 steps pre-sprayed and cleaned tread by tread.",
       "Escalier tapissé jusqu'à 16 marches prépulvérisé et nettoyé marche par marche.",
       "Escaleras alfombradas de hasta 16 escalones prerociadas y limpiadas escalón por escalón."]),
    S("fq.carpet_cleaning.specialty.stretching", "specialty", "flat", null,
      ["Carpet stretching", "Étirement de tapis", "Estirado de alfombra"],
      ["Wrinkled or rippled carpet re-stretched and re-secured to the tack strip.",
       "Tapis plissé ou ondulé retendu et refixé à la bande à clous.",
       "Alfombra arrugada u ondulada reestirada y reasegurada a la tira de clavos."]),
    S("fq.carpet_cleaning.specialty.tile_grout", "specialty", "flat", null,
      ["Tile and grout cleaning", "Nettoyage de carrelage et de joints", "Limpieza de azulejo y lechada"],
      ["Tile and grout deep cleaned with specialised solution and pressure.",
       "Carrelage et joints nettoyés en profondeur avec une solution spécialisée et de la pression.",
       "Azulejo y lechada limpiados a fondo con solución especializada y presión."]),
    S("fq.carpet_cleaning.specialty.tile_grout_hallway", "specialty", "each", null,
      ["Tile and grout cleaning — hallway", "Nettoyage de carrelage et de joints — couloir", "Limpieza de azulejo y lechada — pasillo"],
      ["Tile and grout in a hallway deep cleaned.",
       "Carrelage et joints d'un couloir nettoyés en profondeur.",
       "Azulejo y lechada de un pasillo limpiados a fondo."]),
    S("fq.carpet_cleaning.specialty.tile_grout_2_rooms", "specialty", "flat", null,
      ["Tile and grout cleaning — 2 rooms", "Nettoyage de carrelage et de joints — 2 pièces", "Limpieza de azulejo y lechada — 2 cuartos"],
      ["Tile and grout across two rooms deep cleaned.",
       "Carrelage et joints de deux pièces nettoyés en profondeur.",
       "Azulejo y lechada de dos cuartos limpiados a fondo."]),
    S("fq.carpet_cleaning.specialty.tile_grout_3_rooms", "specialty", "flat", null,
      ["Tile and grout cleaning — 3 rooms", "Nettoyage de carrelage et de joints — 3 pièces", "Limpieza de azulejo y lechada — 3 cuartos"],
      ["Tile and grout across three rooms deep cleaned.",
       "Carrelage et joints de trois pièces nettoyés en profondeur.",
       "Azulejo y lechada de tres cuartos limpiados a fondo."]),
    S("fq.carpet_cleaning.specialty.tile_grout_4_rooms", "specialty", "flat", null,
      ["Tile and grout cleaning — 4 rooms", "Nettoyage de carrelage et de joints — 4 pièces", "Limpieza de azulejo y lechada — 4 cuartos"],
      ["Tile and grout across four rooms deep cleaned.",
       "Carrelage et joints de quatre pièces nettoyés en profondeur.",
       "Azulejo y lechada de cuatro cuartos limpiados a fondo."]),
    S("fq.carpet_cleaning.specialty.tile_grout_5_rooms", "specialty", "flat", null,
      ["Tile and grout cleaning — 5+ rooms", "Nettoyage de carrelage et de joints — 5 pièces et plus", "Limpieza de azulejo y lechada — 5 o más cuartos"],
      ["Tile and grout across five or more rooms deep cleaned.",
       "Carrelage et joints de cinq pièces ou plus nettoyés en profondeur.",
       "Azulejo y lechada de cinco o más cuartos limpiados a fondo."]),
    S("fq.carpet_cleaning.specialty.tile_grout_stairs", "specialty", "flat", null,
      ["Tile and grout cleaning — stairs", "Nettoyage de carrelage et de joints — escalier", "Limpieza de azulejo y lechada — escaleras"],
      ["Tiled stairs and their grout deep cleaned.",
       "Escalier carrelé et ses joints nettoyés en profondeur.",
       "Escaleras de azulejo y su lechada limpiadas a fondo."]),
    S("fq.carpet_cleaning.specialty.stone_stairs", "specialty", "flat", null,
      ["Natural stone cleaning — stairs", "Nettoyage de pierre naturelle — escalier", "Limpieza de piedra natural — escaleras"],
      ["Natural stone stairs cleaned with products safe for the stone.",
       "Escalier en pierre naturelle nettoyé avec des produits sûrs pour la pierre.",
       "Escaleras de piedra natural limpiadas con productos seguros para la piedra."]),
    S("fq.carpet_cleaning.specialty.stone_backsplash", "specialty", "flat", null,
      ["Natural stone cleaning — backsplash", "Nettoyage de pierre naturelle — dosseret", "Limpieza de piedra natural — salpicadero"],
      ["A natural stone backsplash cleaned and degreased without etching.",
       "Dosseret en pierre naturelle nettoyé et dégraissé sans le marquer.",
       "Salpicadero de piedra natural limpiado y desengrasado sin dañarlo."]),
    S("fq.carpet_cleaning.specialty.sectional", "specialty", "each", null,
      ["Upholstery cleaning — sectional", "Nettoyage de tissus — sectionnel", "Limpieza de tapicería — seccional"],
      ["A sectional sofa's fabric deep cleaned with fabric-safe extraction.",
       "Tissu d'un canapé sectionnel nettoyé en profondeur par extraction douce.",
       "Tela de un sofá seccional limpiada a fondo con extracción segura para telas."]),
    S("fq.carpet_cleaning.specialty.leather_chairs", "specialty", "each", null,
      ["Leather furniture cleaning — chairs", "Nettoyage de cuir — fauteuils", "Limpieza de cuero — sillones"],
      ["Leather chairs cleaned and conditioned.",
       "Fauteuils en cuir nettoyés et nourris.",
       "Sillones de cuero limpiados y acondicionados."]),
    S("fq.carpet_cleaning.specialty.leather_sofa", "specialty", "each", null,
      ["Leather furniture cleaning — sofa", "Nettoyage de cuir — canapé", "Limpieza de cuero — sofá"],
      ["A leather sofa deep cleaned and conditioned.",
       "Canapé en cuir nettoyé en profondeur et nourri.",
       "Sofá de cuero limpiado a fondo y acondicionado."]),
    S("fq.carpet_cleaning.specialty.leather_sectional", "specialty", "each", null,
      ["Leather furniture cleaning — sectional", "Nettoyage de cuir — sectionnel", "Limpieza de cuero — seccional"],
      ["A leather sectional cleaned and conditioned piece by piece.",
       "Sectionnel en cuir nettoyé et nourri pièce par pièce.",
       "Seccional de cuero limpiado y acondicionado pieza por pieza."]),
    S("fq.carpet_cleaning.specialty.mattress_full", "specialty", "each", null,
      ["Mattress cleaning — full", "Nettoyage de matelas — double", "Limpieza de colchón — matrimonial"],
      ["A full-size mattress deep cleaned to remove dust, allergens and stains.",
       "Matelas double nettoyé en profondeur pour retirer poussière, allergènes et taches.",
       "Colchón matrimonial limpiado a fondo para quitar polvo, alérgenos y manchas."]),
    S("fq.carpet_cleaning.specialty.mattress_cal_king", "specialty", "each", null,
      ["Mattress cleaning — California king", "Nettoyage de matelas — California king", "Limpieza de colchón — California king"],
      ["A California king mattress deep cleaned.",
       "Matelas California king nettoyé en profondeur.",
       "Colchón California king limpiado a fondo."]),
    S("fq.carpet_cleaning.specialty.recurring_hard_floor", "specialty", "flat", null,
      ["Recurring hard-surface floor cleaning", "Nettoyage récurrent de planchers durs", "Limpieza recurrente de pisos duros"],
      ["Tile, stone or other hard floors cleaned on a schedule.",
       "Carrelage, pierre ou autres planchers durs nettoyés selon un horaire.",
       "Azulejo, piedra u otros pisos duros limpiados con un horario."]),
    S("fq.carpet_cleaning.specialty.other", "specialty", "flat", null,
      ["Carpet cleaning — other, describe what you need", "Nettoyage de tapis — autre, décrivez le besoin", "Limpieza de alfombra — otro, describa lo que necesita"],
      ["A carpet job not listed above, priced after a look.",
       "Travail de tapis non listé ci-dessus, chiffré après examen.",
       "Trabajo de alfombra no listado arriba, cotizado después de verlo."]),
    S("fq.carpet_cleaning.specialty.move_in_out_1_1", "specialty", "flat", null,
      ["Move-in/out cleaning — 1 bedroom, 1 bathroom", "Ménage d'emménagement/déménagement — 1 chambre, 1 salle de bain", "Limpieza de entrada/salida — 1 recámara, 1 baño"],
      ["A one-bedroom unit cleaned throughout at move-in or move-out.",
       "Logement d'une chambre nettoyé partout à l'emménagement ou au déménagement.",
       "Unidad de una recámara limpiada por completo al entrar o al salir."]),
    S("fq.carpet_cleaning.specialty.one_time_1_1", "specialty", "flat", null,
      ["One-time cleaning — 1 bedroom, 1 bathroom", "Ménage unique — 1 chambre, 1 salle de bain", "Limpieza única — 1 recámara, 1 baño"],
      ["A single cleaning of a one-bedroom, one-bathroom unit.",
       "Un seul ménage d'un logement d'une chambre et d'une salle de bain.",
       "Una sola limpieza de una unidad de una recámara y un baño."]),
    S("fq.carpet_cleaning.specialty.area_rug_8x10", "specialty", "each", BM(75, 140, 240),
      ["Area rug cleaning — on site, 8×10 synthetic", "Nettoyage de carpette — sur place, 8×10 synthétique", "Limpieza de tapete — en sitio, 8×10 sintético"],
      ["One synthetic 8×10 area rug cleaned on site.",
       "Une carpette synthétique 8×10 nettoyée sur place.",
       "Un tapete sintético de 8×10 limpiado en sitio."]),
    S("fq.carpet_cleaning.specialty.area_rug_various", "specialty", "each", BM(60, 115, 200),
      ["Area rug cleaning — various sizes and materials", "Nettoyage de carpette — tailles et matières variées", "Limpieza de tapete — varios tamaños y materiales"],
      ["Area rugs of any size or material cleaned with the method the fibre needs.",
       "Carpettes de toute taille ou matière nettoyées avec la méthode que la fibre exige.",
       "Tapetes de cualquier tamaño o material limpiados con el método que requiera la fibra."]),
    S("fq.carpet_cleaning.specialty.upholstery", "specialty", "each", BM(95, 149, 200),
      ["Upholstery cleaning — sofa, chair or loveseat", "Nettoyage de tissus — canapé, fauteuil ou causeuse", "Limpieza de tapicería — sofá, sillón o loveseat"],
      ["An upholstered sofa, chair or loveseat cleaned by fabric-safe extraction.",
       "Canapé, fauteuil ou causeuse rembourré nettoyé par extraction douce.",
       "Sofá, sillón o loveseat tapizado limpiado por extracción segura para telas."]),
    S("fq.carpet_cleaning.specialty.stairs_glass_detail", "specialty", "flat", BM(52, 81, 180),
      ["Stairs and glass detail cleaning", "Nettoyage détaillé d'escalier et de vitres", "Limpieza detallada de escaleras y vidrio"],
      ["Main-floor stairs cleaned and dusted and the glass detailed.",
       "Escalier principal nettoyé et épousseté, vitres nettoyées en détail.",
       "Escaleras principales limpiadas y desempolvadas y el vidrio detallado."]),
    // ── The carpet-repair book (two rows) ─────────────────────────────────
    S("fq.carpet_cleaning.specialty.custom_job", "specialty", "flat", null,
      ["Custom job — priced on site", "Travail sur mesure — prix établi sur place", "Trabajo a medida — cotizado en el sitio"],
      ["Work that does not fit a standard service, described by the customer and priced after a look.",
       "Travail qui n'entre dans aucun service standard, décrit par le client et chiffré après examen.",
       "Trabajo que no encaja en un servicio estándar, descrito por el cliente y cotizado después de verlo."],
      { bookable: true }),
    S("fq.carpet_cleaning.specialty.stretching_repair", "specialty", "flat", null,
      ["Carpet stretching and repair", "Étirement et réparation de tapis", "Estirado y reparación de alfombra"],
      ["Wrinkles, ripples and lumps removed by power-stretching the carpet and re-securing it.",
       "Plis, ondulations et bosses éliminés en retendant le tapis à la machine et en le refixant.",
       "Arrugas, ondulaciones y bultos eliminados estirando la alfombra con máquina y reasegurándola."],
      { bookable: true }),
    // ── The rug-cleaning book (one row) ──────────────────────────────────
    S("fq.carpet_cleaning.specialty.rug_custom_job", "specialty", "flat", null,
      ["Rug cleaning — custom job, priced on site", "Nettoyage de tapis — sur mesure, prix établi sur place", "Limpieza de tapete — a medida, cotizado en el sitio"],
      ["A rug job that does not fit a standard service, priced after a look at the piece.",
       "Travail sur tapis qui n'entre dans aucun service standard, chiffré après examen de la pièce.",
       "Trabajo de tapete que no encaja en un servicio estándar, cotizado después de ver la pieza."],
      { bookable: true }),
    // ── Added 2026-09-24 with the estimate templates ──────────────────────
    S("fq.carpet_cleaning.visits.assessment_visit", "visits", "flat", null,
      ["Carpet and upholstery assessment", "Évaluation de tapis et de meubles rembourrés", "Evaluación de alfombras y tapicería"],
      ["Fibre, stains and traffic wear looked at, the right cleaning method chosen and a written price left.",
       "Fibre, taches et usure examinées, bonne méthode de nettoyage choisie et prix écrit laissé.",
       "Fibra, manchas y desgaste revisados, el método de limpieza adecuado elegido y un precio por escrito."],
      { durationMinutes: 30, bookable: true }),
  ],
};

// ── Estimate templates ───────────────────────────────────────────────────────
//
// Evidence: the carpet-cleaning capture under docs/research/ — five templates
// priced per room with a pre-treatment material line and real costs: living
// areas (living room $120/60, bedroom $80/40, pre-treatment $20/10, $15 off),
// whole home (adds hallway and stairs $75/35, pre-treatment $25/12, $20 off),
// deep clean with stain treatment (per room $150/75, spot treatment $75/35,
// stain remover $35/18, $26 off), quarterly area-rug cleaning ($300/200, 4%
// off) and one-time area-rug deep clean ($600/400, $50 off). Carried at the
// captured prices and costs. Its booking form counts carpeted areas and
// stair steps, so per-room lines are keyed `each` (the registry has no room count yet — a `roomCount` key is the follow-up) and stairs `treads`
// (the stairs module's field), each at qty 1 until the form fills it.
const PER_ROOM = (price, cost, deep) => L.labour(1, "each", price, deep ? {
  en: ["Deep extraction — per room", "Pre-sprayed, agitated and hot-water extracted with extra passes on traffic lanes."],
  fr: ["Extraction en profondeur — la pièce", "Prévaporisé, brossé et extrait à l'eau chaude avec passes supplémentaires dans les zones passantes."],
  es: ["Extracción profunda — por habitación", "Prerociado, agitado y extraído con agua caliente, con pasadas extra en zonas de tránsito."],
  it: ["Estrazione profonda — per stanza", "Pretrattato, spazzolato ed estratto ad acqua calda con passate in più sulle zone di passaggio."],
  de: ["Tiefenextraktion — pro Raum", "Vorgesprüht, gebürstet und heiß extrahiert, mit zusätzlichen Durchgängen auf Laufstraßen."],
  uk: ["Глибока екстракція — за кімнату", "Попередньо оброблено, збито щіткою та екстраговано гарячою водою з додатковими проходами на доріжках."],
  tl: ["Deep extraction — kada kuwarto", "Pre-spray, kinuskos at hot-water extraction, may dagdag na pasada sa daanan."],
} : {
  en: ["Carpet cleaning — per room", "Hot-water extraction of one carpeted room, furniture edges worked around."],
  fr: ["Nettoyage de tapis — la pièce", "Extraction à l'eau chaude d'une pièce tapissée, autour des meubles."],
  es: ["Limpieza de alfombra — por habitación", "Extracción con agua caliente de una habitación alfombrada, alrededor de los muebles."],
  it: ["Pulizia moquette — per stanza", "Estrazione ad acqua calda di una stanza con moquette, attorno ai mobili."],
  de: ["Teppichreinigung — pro Raum", "Heißwasserextraktion eines Teppichraums, um die Möbel herum."],
  uk: ["Чищення килимового покриття — за кімнату", "Екстракція гарячою водою однієї кімнати з покриттям, навколо меблів."],
  tl: ["Paglilinis ng carpet — kada kuwarto", "Hot-water extraction ng isang kuwartong may carpet, iniikutan ang muwebles."],
}, { cost, measurementKey: "each" });
const LIVING_ROOM = () => L.labour(1, "flat", 120, {
  en: ["Living room carpet", "The main living area extracted, heavy traffic lanes pre-treated."],
  fr: ["Tapis du salon", "Aire de séjour principale extraite, zones passantes prétraitées."],
  es: ["Alfombra de la sala", "Área principal extraída, zonas de mucho tránsito pretratadas."],
  it: ["Moquette del soggiorno", "Zona giorno principale estratta, zone di passaggio pretrattate."],
  de: ["Wohnzimmerteppich", "Hauptwohnbereich extrahiert, stark begangene Bereiche vorbehandelt."],
  uk: ["Покриття у вітальні", "Основну житлову зону екстраговано, доріжки попередньо оброблено."],
  tl: ["Carpet sa sala", "Na-extract ang pangunahing sala, pre-treated ang daanan."],
}, { cost: 60 });
const PRETREAT = (price, cost) => L.material(1, "flat", price, {
  en: ["Pre-treatment solution", "Traffic-lane pre-spray matched to the fibre."],
  fr: ["Solution de prétraitement", "Prévaporisateur pour zones passantes adapté à la fibre."],
  es: ["Solución de pretratamiento", "Prerrociador para zonas de tránsito adecuado a la fibra."],
  it: ["Soluzione di pretrattamento", "Prespray per zone di passaggio adatto alla fibra."],
  de: ["Vorbehandlungsmittel", "Laufstraßen-Vorsprühmittel passend zur Faser."],
  uk: ["Засіб попередньої обробки", "Спрей для доріжок, підібраний до волокна."],
  tl: ["Pre-treatment solution", "Pre-spray para sa daanan na angkop sa fiber."],
}, { cost });
const STAIRS = (price = 5, cost = 2.5) => L.labour(1, "each", price, {
  en: ["Stairs — per step", "Each carpeted tread and riser cleaned by hand tool."],
  fr: ["Escalier — la marche", "Chaque marche et contremarche tapissée nettoyée à l'outil manuel."],
  es: ["Escalera — por escalón", "Cada huella y contrahuella alfombrada limpiada con herramienta manual."],
  it: ["Scale — per gradino", "Ogni pedata e alzata in moquette pulita con attrezzo manuale."],
  de: ["Treppe — pro Stufe", "Jede Teppichstufe mit Handgerät gereinigt."],
  uk: ["Сходи — за сходинку", "Кожну сходинку з покриттям очищено ручною насадкою."],
  tl: ["Hagdan — kada baitang", "Nilinis gamit ang hand tool ang bawat baitang na may carpet."],
}, { cost, measurementKey: "treads" });
const RUG = (price, cost, deep) => L.labour(1, "each", price, deep ? {
  en: ["Area rug deep cleaning", "Rug dusted, washed front and back, rinsed and dried flat."],
  fr: ["Nettoyage en profondeur de carpette", "Carpette dépoussiérée, lavée des deux côtés, rincée et séchée à plat."],
  es: ["Limpieza profunda de tapete", "Tapete desempolvado, lavado por ambos lados, enjuagado y secado plano."],
  it: ["Pulizia profonda del tappeto", "Tappeto spolverato, lavato su entrambi i lati, risciacquato e asciugato in piano."],
  de: ["Tiefenreinigung Teppich", "Teppich entstaubt, beidseitig gewaschen, gespült und flach getrocknet."],
  uk: ["Глибоке чищення килима", "Килим вибито, вимито з обох боків, прополоскано й висушено рівно."],
  tl: ["Deep cleaning ng area rug", "Pinagpag, hinugasan harap at likod, binanlawan at pinatuyo nang nakalatag."],
} : {
  en: ["Area rug cleaning", "Rug cleaned by the method its fibre allows and groomed."],
  fr: ["Nettoyage de carpette", "Carpette nettoyée selon la méthode que permet sa fibre, puis peignée."],
  es: ["Limpieza de tapete", "Tapete limpiado con el método que permite su fibra y peinado."],
  it: ["Pulizia del tappeto", "Tappeto pulito con il metodo adatto alla fibra e pettinato."],
  de: ["Teppichreinigung", "Teppich mit der für die Faser geeigneten Methode gereinigt und gebürstet."],
  uk: ["Чищення килима", "Килим очищено методом, придатним для його волокна, і розчесано."],
  tl: ["Paglilinis ng area rug", "Nilinis sa paraang angkop sa fiber at sinuklay."],
}, { cost, measurementKey: "each" });
const n = (it, de, uk, tl) => ({ it, de, uk, tl });

const TEMPLATES = {
  // ── Installation (first full cleans) ──
  "fq.carpet_cleaning.visits.two_rooms": T("installation", n(
    ["Pulizia moquette — 2 stanze, prenotata", "Due stanze con moquette pulite ad acqua calda in una visita prenotata."],
    ["Teppichreinigung — 2 Räume, gebucht", "Zwei Teppichräume in einem gebuchten Termin heiß extrahiert."],
    ["Чищення покриття — 2 кімнати, запис", "Дві кімнати з покриттям очищено гарячою водою за один запланований візит."],
    ["Paglilinis ng carpet — 2 kuwarto, naka-book", "Dalawang kuwartong may carpet na nilinis sa isang naka-book na visit."],
  ), [LIVING_ROOM(), PER_ROOM(80, 40), PRETREAT(20, 10)], D.newCustomer("fixed", 15)),

  "fq.carpet_cleaning.visits.whole_home": T("installation", n(
    ["Pulizia moquette di tutta la casa — prenotata", "Tutte le moquette della casa, corridoi e scale compresi, in una visita prenotata."],
    ["Teppichreinigung ganzes Haus — gebucht", "Alle Teppiche im Haus samt Fluren und Treppen in einem gebuchten Termin."],
    ["Чищення покриття в усьому будинку — запис", "Усі покриття в будинку, включно з коридорами й сходами, за один візит."],
    ["Paglilinis ng carpet sa buong bahay — naka-book", "Lahat ng carpet sa bahay, kasama pasilyo at hagdan, sa isang naka-book na visit."],
  ), [
    LIVING_ROOM(), PER_ROOM(80, 40),
    L.labour(1, "flat", 75, {
      en: ["Hallway and stairs", "Hallway runs and the staircase cleaned."],
      fr: ["Corridor et escalier", "Corridors et escalier nettoyés."],
      es: ["Pasillo y escaleras", "Pasillos y escalera limpiados."],
      it: ["Corridoio e scale", "Corridoi e scala puliti."],
      de: ["Flur und Treppe", "Flure und Treppe gereinigt."],
      uk: ["Коридор і сходи", "Коридори та сходи очищено."],
      tl: ["Pasilyo at hagdan", "Nilinis ang pasilyo at hagdan."],
    }, { cost: 35 }),
    PRETREAT(25, 12),
  ], D.newCustomer("fixed", 20)),

  "fq.carpet_cleaning.carpet.vacant_unit_2br": T("installation", n(
    ["Pulizia moquette — unità vuota, 2 camere e zone comuni", "Moquette di un'unità vuota con due camere e zone comuni pulite tra un inquilino e l'altro."],
    ["Teppichreinigung — leere Wohnung, 2 Schlafzimmer und Gemeinschaftsflächen", "Teppiche einer leeren Wohnung mit zwei Schlafzimmern und Gemeinschaftsflächen zwischen zwei Mietern gereinigt."],
    ["Чищення покриття — порожня квартира, 2 спальні та спільні зони", "Покриття порожньої квартири з двома спальнями та спільними зонами очищено між орендарями."],
    ["Paglilinis ng carpet — bakanteng unit, 2 kuwarto at common area", "Nilinis ang carpet ng bakanteng unit na may dalawang kuwarto at common area sa pagitan ng umuupa."],
  ), [PER_ROOM(70, 35), PRETREAT(20, 10)], null),

  // ── Repair (restorative) ──
  "fq.carpet_cleaning.visits.deep_cleaning": T("repair", n(
    ["Pulizia profonda della moquette — prenotata", "Pulizia profonda con trattamento delle macchie per moquette molto sporche."],
    ["Teppich-Tiefenreinigung — gebucht", "Tiefenreinigung mit Fleckbehandlung für stark verschmutzte Teppiche."],
    ["Глибоке чищення покриття — запис", "Глибоке чищення з виведенням плям для дуже забруднених покриттів."],
    ["Deep cleaning ng carpet — naka-book", "Deep clean na may pagtanggal ng mantsa para sa maruming carpet."],
  ), [
    PER_ROOM(150, 75, true),
    L.labour(1, "flat", 75, {
      en: ["Spot stain treatment", "Individual stains identified and treated with the right chemistry."],
      fr: ["Traitement des taches", "Taches repérées une à une et traitées avec le bon produit."],
      es: ["Tratamiento de manchas", "Manchas identificadas una por una y tratadas con el producto adecuado."],
      it: ["Trattamento macchie", "Macchie individuate una per una e trattate con il prodotto giusto."],
      de: ["Fleckbehandlung", "Einzelne Flecken erkannt und mit der passenden Chemie behandelt."],
      uk: ["Виведення плям", "Кожну пляму визначено й оброблено відповідним засобом."],
      tl: ["Spot stain treatment", "Tinukoy at tinrato ang bawat mantsa gamit ang tamang kemikal."],
    }, { cost: 35 }),
    L.material(1, "flat", 35, {
      en: ["Heavy-duty stain remover", "Solvent and oxidiser spotters for set-in stains."],
      fr: ["Détachant puissant", "Détachants solvant et oxydant pour les taches incrustées."],
      es: ["Quitamanchas industrial", "Desmanchadores de solvente y oxidante para manchas incrustadas."],
      it: ["Smacchiatore professionale", "Smacchiatori a solvente e ossidanti per macchie radicate."],
      de: ["Starker Fleckentferner", "Lösungsmittel- und Oxidations-Detachur für eingezogene Flecken."],
      uk: ["Потужний плямовивідник", "Сольвентні та окисні засоби для застарілих плям."],
      tl: ["Heavy-duty stain remover", "Solvent at oxidizer spotter para sa matagal nang mantsa."],
    }, { cost: 18 }),
  ], D.newCustomer("fixed", 26)),

  "fq.carpet_cleaning.add_ons.pet_treatment": T("repair", n(
    ["Trattamento macchie e odori di animali — moquette e imbottiti", "Trattamento enzimatico sulle zone sporcate dagli animali per scomporre macchia e odore alla fonte."],
    ["Tierflecken- und Geruchsbehandlung — Teppich und Polster", "Enzymbehandlung auf verschmutzten Stellen, die Fleck und Geruch an der Quelle abbaut."],
    ["Обробка плям і запахів від тварин — покриття та меблі", "Ензимна обробка забруднених тваринами місць, що розщеплює пляму й запах у джерелі."],
    ["Treatment ng mantsa at amoy ng alaga — carpet at upholstery", "Enzyme treatment sa maruming bahagi para sirain ang mantsa at amoy mula sa ugat."],
  ), [
    L.labour(1, "each", 45, {
      en: ["Enzyme pet treatment — per room", "Affected areas located with UV, saturated with enzyme and extracted."],
      fr: ["Traitement enzymatique — la pièce", "Zones touchées repérées aux UV, saturées d'enzyme et extraites."],
      es: ["Tratamiento enzimático — por habitación", "Zonas afectadas localizadas con UV, saturadas de enzima y extraídas."],
      it: ["Trattamento enzimatico — per stanza", "Zone colpite individuate con UV, saturate di enzimi ed estratte."],
      de: ["Enzymbehandlung — pro Raum", "Betroffene Stellen mit UV gefunden, mit Enzym getränkt und extrahiert."],
      uk: ["Ензимна обробка — за кімнату", "Уражені місця знайдено УФ-лампою, насичено ензимом та екстраговано."],
      tl: ["Enzyme treatment — kada kuwarto", "Hinanap sa UV ang apektadong bahagi, binabad sa enzyme at in-extract."],
    }, { measurementKey: "each" }),
    L.material(1, "each", 15, {
      en: ["Enzyme treatment — per room", "Bio-enzymatic urine and odour digester."],
      fr: ["Enzyme — la pièce", "Digesteur bio-enzymatique d'urine et d'odeurs."],
      es: ["Enzima — por habitación", "Digestor bioenzimático de orina y olores."],
      it: ["Enzima — per stanza", "Digestore bioenzimatico di urina e odori."],
      de: ["Enzym — pro Raum", "Bioenzymatischer Urin- und Geruchszersetzer."],
      uk: ["Ензим — за кімнату", "Біоензимний засіб, що розщеплює сечу й запахи."],
      tl: ["Enzyme — kada kuwarto", "Bio-enzymatic na pantunaw ng ihi at amoy."],
    }, { measurementKey: "each" }),
  ], null),

  "fq.carpet_cleaning.specialty.stretching_repair": T("repair", n(
    ["Ritensionamento e riparazione moquette", "Pieghe, onde e rigonfiamenti eliminati ritendendo la moquette e rifissandola."],
    ["Teppich nachspannen und reparieren", "Falten, Wellen und Beulen durch Nachspannen und Neubefestigen beseitigt."],
    ["Натягування та ремонт покриття", "Складки, хвилі й горби прибрано натягуванням і повторним закріпленням покриття."],
    ["Pag-stretch at pag-ayos ng carpet", "Tinanggal ang kulubot, alon at umbok sa pag-stretch at pagkabit ulit ng carpet."],
  ), [
    L.labour(1, "each", 95, {
      en: ["Power stretching — per room", "Carpet released, power-stretched wall to wall and re-hooked, seams checked."],
      fr: ["Étirement à la machine — la pièce", "Tapis détaché, retendu d'un mur à l'autre et raccroché, joints vérifiés."],
      es: ["Estirado con máquina — por habitación", "Alfombra soltada, estirada de pared a pared y reenganchada, uniones revisadas."],
      it: ["Ritensionamento — per stanza", "Moquette liberata, ritesa da parete a parete e riagganciata, giunzioni controllate."],
      de: ["Nachspannen — pro Raum", "Teppich gelöst, von Wand zu Wand nachgespannt und eingehängt, Nähte geprüft."],
      uk: ["Натягування — за кімнату", "Покриття звільнено, натягнуто від стіни до стіни й зачеплено, шви перевірено."],
      tl: ["Power stretching — kada kuwarto", "Tinanggal, ini-stretch mula pader hanggang pader at ikinabit ulit, chineck ang dugtungan."],
    }, { measurementKey: "each" }),
  ], null),

  // ── Inspection ──
  "fq.carpet_cleaning.visits.assessment_visit": T("inspection", n(
    ["Valutazione moquette e imbottiti", "Fibra, macchie e usura esaminate, metodo di pulizia scelto e prezzo scritto lasciato."],
    ["Begutachtung Teppich und Polster", "Faser, Flecken und Abnutzung begutachtet, die richtige Methode gewählt und ein schriftlicher Preis hinterlassen."],
    ["Оцінка покриття та м'яких меблів", "Волокно, плями й знос оглянуто, обрано метод чищення, залишено письмову ціну."],
    ["Assessment ng carpet at upholstery", "Tiningnan ang fiber, mantsa at pagkaluma, pinili ang tamang paraan at iniwan ang nakasulat na presyo."],
  ), [
    L.labour(1, "flat", 0, {
      en: ["Assessment", "Fibre tested and stains assessed; free with a booked clean."],
      fr: ["Évaluation", "Fibre testée et taches évaluées; gratuit avec un nettoyage réservé."],
      es: ["Evaluación", "Fibra probada y manchas evaluadas; gratis al agendar la limpieza."],
      it: ["Valutazione", "Fibra testata e macchie valutate; gratuita con una pulizia prenotata."],
      de: ["Begutachtung", "Faser getestet und Flecken bewertet; kostenlos bei gebuchter Reinigung."],
      uk: ["Оцінка", "Волокно перевірено, плями оцінено; безкоштовно за замовленого чищення."],
      tl: ["Assessment", "Tinest ang fiber at tiningnan ang mantsa; libre kapag nag-book."],
    }, { cost: 0 }),
  ], null),

  "fq.carpet_cleaning.specialty.custom_job": T("inspection", n(
    ["Lavoro su misura — prezzo sul posto", "Lavoro che non rientra in un servizio standard, descritto dal cliente e quotato dopo averlo visto."],
    ["Sonderauftrag — Preis vor Ort", "Arbeit außerhalb der Standardleistungen, vom Kunden beschrieben und nach Besichtigung angeboten."],
    ["Нестандартна робота — ціна на місці", "Робота поза стандартними послугами, описана клієнтом і оцінена після огляду."],
    ["Custom job — presyo sa lugar", "Trabahong hindi pasok sa standard na serbisyo, inilarawan ng kliyente at pinresyuhan pagkakita."],
  ), [SHARED.serviceCall(49)], null),

  "fq.carpet_cleaning.specialty.rug_custom_job": T("inspection", n(
    ["Pulizia tappeti — lavoro su misura, prezzo sul posto", "Un tappeto che non rientra in un servizio standard, quotato dopo aver visto il pezzo."],
    ["Teppichreinigung — Sonderauftrag, Preis vor Ort", "Ein Teppich außerhalb der Standardleistungen, nach Ansicht des Stücks angeboten."],
    ["Чищення килимів — нестандартна робота, ціна на місці", "Килим поза стандартними послугами, оцінений після огляду виробу."],
    ["Paglilinis ng rug — custom, presyo sa lugar", "Rug na hindi pasok sa standard, pinresyuhan pagkakita sa piraso."],
  ), [
    L.labour(1, "flat", 45, {
      en: ["Rug inspection and fibre test", "Dye stability and fibre tested, size measured and a cleaning method priced."],
      fr: ["Inspection et test de fibre", "Stabilité des teintures et fibre testées, dimensions mesurées et méthode chiffrée."],
      es: ["Inspección y prueba de fibra", "Estabilidad del tinte y fibra probadas, tamaño medido y método cotizado."],
      it: ["Ispezione e test della fibra", "Stabilità dei colori e fibra testate, misure prese e metodo quotato."],
      de: ["Prüfung und Fasertest", "Farbechtheit und Faser getestet, Größe gemessen und Methode angeboten."],
      uk: ["Огляд і тест волокна", "Стійкість барвника й волокно перевірено, розмір виміряно, метод оцінено."],
      tl: ["Inspeksyon at fiber test", "Tinest ang kulay at fiber, sinukat ang laki at pinresyuhan ang paraan."],
    }),
  ], null),

  // ── Maintenance ──
  "fq.carpet_cleaning.carpet.recurring": T("maintenance", n(
    ["Pulizia moquette ricorrente", "Pulizia programmata della moquette per mantenerla in buono stato tutto l'anno."],
    ["Regelmäßige Teppichreinigung", "Geplante Teppichreinigung, damit der Teppich das ganze Jahr in gutem Zustand bleibt."],
    ["Регулярне чищення покриття", "Планове чищення, щоб покриття було в доброму стані цілий рік."],
    ["Regular na paglilinis ng carpet", "Naka-schedule na paglilinis para manatiling maayos ang carpet buong taon."],
  ), [RUG(300, 200)], D.regular("percent", 4)),

  "fq.carpet_cleaning.specialty.area_rug_various": T("maintenance", n(
    ["Pulizia tappeti — varie misure e materiali", "Tappeti di varie misure e fibre puliti con il metodo che il materiale consente."],
    ["Teppichreinigung — verschiedene Größen und Materialien", "Teppiche verschiedener Größen und Fasern mit der passenden Methode gereinigt."],
    ["Чищення килимів — різні розміри й матеріали", "Килими різних розмірів і волокон очищено методом, придатним для матеріалу."],
    ["Paglilinis ng area rug — iba't ibang laki at materyal", "Rug na iba-iba ang laki at fiber, nilinis sa paraang angkop sa materyal."],
  ), [RUG(600, 400, true)], D.newCustomer("fixed", 50)),

  "fq.carpet_cleaning.carpet.stairs_16_steps": T("maintenance", n(
    ["Pulizia moquette — scale, fino a 16 gradini", "Scale con moquette fino a 16 gradini pretrattate e pulite gradino per gradino."],
    ["Teppichreinigung — Treppe, bis 16 Stufen", "Teppichtreppe bis 16 Stufen vorbehandelt und Stufe für Stufe gereinigt."],
    ["Чищення покриття — сходи, до 16 сходинок", "Сходи з покриттям до 16 сходинок попередньо оброблено й очищено по одній."],
    ["Paglilinis ng carpet — hagdan, hanggang 16 baitang", "Pre-treated at nilinis isa-isa ang carpeted na hagdan hanggang 16 baitang."],
  ), [STAIRS()], null),

  "fq.carpet_cleaning.specialty.upholstery": T("maintenance", n(
    ["Pulizia imbottiti — divano, poltrona o divanetto", "Divano, poltrona o divanetto imbottito pulito con estrazione adatta al tessuto."],
    ["Polsterreinigung — Sofa, Sessel oder Zweisitzer", "Gepolstertes Sofa, Sessel oder Zweisitzer mit stoffschonender Extraktion gereinigt."],
    ["Чищення м'яких меблів — диван, крісло чи канапа", "Диван, крісло чи канапу очищено екстракцією, безпечною для тканини."],
    ["Paglilinis ng upholstery — sofa, silya o loveseat", "Nilinis ang upholstered na sofa, silya o loveseat gamit ang fabric-safe na extraction."],
  ), [
    L.labour(1, "each", 149, {
      en: ["Upholstery cleaning — per piece", "Fabric tested, pre-sprayed and extracted with an upholstery tool."],
      fr: ["Nettoyage de meuble rembourré — la pièce", "Tissu testé, prévaporisé et extrait à l'outil à rembourrage."],
      es: ["Limpieza de tapicería — por pieza", "Tela probada, prerrociada y extraída con herramienta de tapicería."],
      it: ["Pulizia imbottito — per pezzo", "Tessuto testato, pretrattato ed estratto con attrezzo per imbottiti."],
      de: ["Polsterreinigung — pro Stück", "Stoff getestet, vorgesprüht und mit Polsterdüse extrahiert."],
      uk: ["Чищення м'яких меблів — за предмет", "Тканину перевірено, попередньо оброблено й екстраговано насадкою для меблів."],
      tl: ["Paglilinis ng upholstery — kada piraso", "Tinest ang tela, pre-spray at in-extract gamit ang upholstery tool."],
    }, { measurementKey: "each" }),
  ], null),

  "fq.carpet_cleaning.add_ons.protector": T("maintenance", n(
    ["Protettivo per moquette e tessuti", "Rivestimento protettivo applicato dopo la pulizia così che i liquidi restino in superficie."],
    ["Teppich- und Stoffschutz", "Schutzbeschichtung nach der Reinigung, damit Verschüttetes abperlt statt einzuziehen."],
    ["Захист для покриттів і тканин", "Захисне покриття після чищення, щоб рідина збиралася краплями, а не вбиралася."],
    ["Protector para carpet at tela", "Protective coating pagkatapos maglinis para hindi sumipsip ang natapon."],
  ), [
    L.labour(1, "each", 25, {
      en: ["Protector application — per room", "Fluorochemical-free protector sprayed and groomed in."],
      fr: ["Application de protecteur — la pièce", "Protecteur sans fluorochimique pulvérisé et brossé."],
      es: ["Aplicación de protector — por habitación", "Protector sin fluoroquímicos rociado y cepillado."],
      it: ["Applicazione protettivo — per stanza", "Protettivo senza fluorochimici spruzzato e spazzolato."],
      de: ["Schutzmittel auftragen — pro Raum", "Fluorfreies Schutzmittel gesprüht und eingebürstet."],
      uk: ["Нанесення захисту — за кімнату", "Захист без фторхімії розпилено й втерто щіткою."],
      tl: ["Paglagay ng protector — kada kuwarto", "Ini-spray at sinuklay ang protector na walang fluorochemical."],
    }, { measurementKey: "each" }),
    L.material(1, "each", 12, {
      en: ["Carpet protector — per room", "Water-based carpet and fabric protector."],
      fr: ["Protecteur à tapis — la pièce", "Protecteur à base d'eau pour tapis et tissus."],
      es: ["Protector de alfombra — por habitación", "Protector base agua para alfombra y tela."],
      it: ["Protettivo per moquette — per stanza", "Protettivo all'acqua per moquette e tessuti."],
      de: ["Teppichschutz — pro Raum", "Wasserbasierter Teppich- und Stoffschutz."],
      uk: ["Захист покриття — за кімнату", "Захист на водній основі для покриттів і тканин."],
      tl: ["Carpet protector — kada kuwarto", "Water-based na protector para sa carpet at tela."],
    }, { measurementKey: "each" }),
  ], null),
};

// ── Templates added 2026-09-25 ───────────────────────────────────────────────
//
// The owner (2026-09-25): a service added to a quote opens WITH its lines, so
// every commonly quoted row gets two to five. Same evidence as above — per
// room $80 (cost $40), living room $120, deep extraction $150, pre-treatment
// $15–25, hallway and stairs $75 — with the per-room rate tapering $80 → $60
// across the 1-to-5-room rows, the way room bundles are sold; and 2026 rates
// for the rest: tile and grout $0.85 a sq ft or $80–95 a room, leather $65 a
// chair to $250 a sectional, mattresses $90–120, the on-site 8×10 rug at the
// benchmark's $140.
//
// A row that NAMES its size ("3 rooms", "2 rooms and hallway") carries that
// size as a plain quantity, not a measurement: a measured line opens at 0 on
// the quote until something fills it (lib/quotes/serviceTemplateLines.js),
// and "3 rooms" is already the answer. A row that does not name its size (a
// tiled floor, a flight of stone stairs, a sectional) is measured —
// `floorSqft` for a floor, `treads` for steps, `each` for pieces and rooms.
//
// Punjabi is written inline beside the other seven (the line builder reads
// `text.pa` before the language file), so each new line's eight languages sit
// together. Lines the templates above already sell are reused by their text,
// not retyped, so a French estimator sees one wording for one job.
//
// Not templated: specialty.other — "describe what you need" has no typical
// lines; custom_job above already carries the priced-on-site visit.
//
// The sectional and leather rows are also the furniture_upholstery quote
// type's work (it has no seed file; lib/services/confirmServices.js borrows
// this one first), so their templates name it.
const t8 = (en, fr, es, it, de, uk, tl, pa) => ({ en, fr, es, it, de, uk, tl, pa });
const namesOf = (key) => {
  const s = I18N.services?.[key];
  if (!s?.it || !s?.de || !s?.uk || !s?.tl) throw new Error(`carpet_cleaning: ${key} has no it/de/uk/tl name in i18n/carpet_cleaning.js`);
  return { it: s.it, de: s.de, uk: s.uk, tl: s.tl, pa: s.pa };
};
const sameText = (key, en) => {
  const l = TEMPLATES[key]?.lines.find((x) => x.text.en[0] === en);
  if (!l) throw new Error(`carpet_cleaning: no line "${en}" on ${key}`);
  return l.text;
};
const ROOM_TXT = PER_ROOM(1, 0).text;
const ROOMS = (qty, price, cost) => L.labour(qty, "each", price, ROOM_TXT, { cost });
const HALL_STAIRS = () => L.labour(1, "flat", 75, sameText("fq.carpet_cleaning.visits.whole_home", "Hallway and stairs"), { cost: 35 });
const SPOT = () => L.labour(1, "flat", 75, sameText("fq.carpet_cleaning.visits.deep_cleaning", "Spot stain treatment"), { cost: 35 });
const STAIN_REMOVER = () => L.material(1, "flat", 35, sameText("fq.carpet_cleaning.visits.deep_cleaning", "Heavy-duty stain remover"), { cost: 18 });
const ENZYME = () => [
  L.labour(1, "each", 45, sameText("fq.carpet_cleaning.add_ons.pet_treatment", "Enzyme pet treatment — per room"), { measurementKey: "each" }),
  L.material(1, "each", 15, sameText("fq.carpet_cleaning.add_ons.pet_treatment", "Enzyme treatment — per room"), { measurementKey: "each" }),
];
const SETUP = (price = 49) => L.labour(1, "flat", price, t8(
  ["Truck-mount setup and travel", "The truck-mounted unit brought to the door, hoses run and the entry protected; covers the trip."],
  ["Installation de l'unité et déplacement", "Unité montée sur camion amenée à la porte, boyaux déroulés et entrée protégée; couvre le déplacement."],
  ["Instalación del equipo y traslado", "Equipo montado en camioneta llevado a la puerta, mangueras tendidas y entrada protegida; cubre el traslado."],
  ["Allestimento impianto e trasferta", "Impianto su furgone portato alla porta, tubi stesi e ingresso protetto; copre il viaggio."],
  ["Anfahrt und Aufbau der Reinigungsanlage", "Fahrzeuganlage vor die Tür gebracht, Schläuche verlegt und Eingang geschützt; deckt die Anfahrt ab."],
  ["Виїзд і розгортання обладнання", "Установку на авто підігнано до дверей, шланги прокладено, вхід захищено; включає дорогу."],
  ["Setup ng truck-mount at biyahe", "Dinala ang truck-mounted unit sa pinto, inilatag ang hose at pinrotektahan ang entrance; kasama ang biyahe."],
  ["ਟਰੱਕ-ਮਾਊਂਟ ਸੈੱਟਅੱਪ ਅਤੇ ਆਉਣ-ਜਾਣ", "ਟਰੱਕ ਵਾਲੀ ਮਸ਼ੀਨ ਦਰਵਾਜ਼ੇ ਤੱਕ, ਪਾਈਪਾਂ ਵਿਛਾਈਆਂ ਅਤੇ ਦਾਖ਼ਲਾ ਢੱਕਿਆ; ਆਉਣ-ਜਾਣ ਸ਼ਾਮਲ।"],
));
const PRESPRAY_AREA = () => L.material(1, "each", 8, t8(
  ["Pre-spray — per room or area", "Traffic-lane pre-spray matched to the fibre, for one room or area."],
  ["Prévaporisateur — la pièce ou zone", "Prévaporisateur pour zones passantes adapté à la fibre, pour une pièce ou une zone."],
  ["Prerrociador — por cuarto o área", "Prerrociador para zonas de tránsito adecuado a la fibra, para un cuarto o área."],
  ["Prespray — per stanza o zona", "Prespray per zone di passaggio adatto alla fibra, per una stanza o zona."],
  ["Vorsprühmittel — pro Raum oder Fläche", "Laufstraßen-Vorsprühmittel passend zur Faser, für einen Raum oder eine Fläche."],
  ["Попередня обробка — за кімнату чи зону", "Спрей для доріжок, підібраний до волокна, на одну кімнату чи зону."],
  ["Pre-spray — kada kuwarto o area", "Pre-spray para sa daanan na angkop sa fiber, para sa isang kuwarto o area."],
  ["ਪ੍ਰੀ-ਸਪਰੇਅ — ਪ੍ਰਤੀ ਕਮਰਾ ਜਾਂ ਹਿੱਸਾ", "ਫ਼ਾਈਬਰ ਮੁਤਾਬਕ ਆਵਾਜਾਈ ਵਾਲੇ ਰਾਹ ਲਈ ਪ੍ਰੀ-ਸਪਰੇਅ, ਇੱਕ ਕਮਰੇ ਜਾਂ ਹਿੱਸੇ ਲਈ।"],
), { measurementKey: "each" });
const HALLWAY = (measured) => L.labour(1, "each", 40, t8(
  ["Hallway — per hallway", "A carpeted hallway extracted wall to wall, with extra passes on the traffic lane."],
  ["Corridor — le corridor", "Corridor tapissé extrait d'un mur à l'autre, passes supplémentaires dans la zone passante."],
  ["Pasillo — por pasillo", "Pasillo alfombrado extraído de pared a pared, con pasadas extra en el carril de tránsito."],
  ["Corridoio — per corridoio", "Corridoio con moquette estratto da parete a parete, con passate in più sulla zona di passaggio."],
  ["Flur — pro Flur", "Teppichflur von Wand zu Wand extrahiert, mit zusätzlichen Durchgängen auf der Laufstraße."],
  ["Коридор — за коридор", "Коридор із покриттям екстраговано від стіни до стіни з додатковими проходами на доріжці."],
  ["Pasilyo — kada pasilyo", "In-extract ang carpeted na pasilyo mula pader hanggang pader, may dagdag na pasada sa daanan."],
  ["ਹਾਲਵੇਅ — ਪ੍ਰਤੀ ਹਾਲਵੇਅ", "ਕਾਰਪੈੱਟ ਵਾਲਾ ਹਾਲਵੇਅ ਕੰਧ ਤੋਂ ਕੰਧ ਤੱਕ ਐਕਸਟ੍ਰੈਕਟ, ਆਵਾਜਾਈ ਵਾਲੇ ਰਾਹ 'ਤੇ ਵਾਧੂ ਗੇੜੇ।"],
), { cost: 20, ...(measured ? { measurementKey: "each" } : {}) });
const TG_SOLUTION = (price) => L.material(1, "flat", price, t8(
  ["Grout cleaning solution", "Alkaline tile and grout cleaner, diluted for the floor's condition."],
  ["Solution de nettoyage des joints", "Nettoyant alcalin pour carrelage et joints, dilué selon l'état du plancher."],
  ["Solución limpiadora de lechada", "Limpiador alcalino de azulejo y lechada, diluido según el estado del piso."],
  ["Soluzione detergente per fughe", "Detergente alcalino per piastrelle e fughe, diluito secondo lo stato del pavimento."],
  ["Fugenreiniger", "Alkalischer Fliesen- und Fugenreiniger, je nach Bodenzustand verdünnt."],
  ["Засіб для чищення швів", "Лужний засіб для плитки й швів, розведений відповідно до стану підлоги."],
  ["Grout cleaning solution", "Alkaline na panlinis ng tile at grout, tinimpla ayon sa kondisyon ng sahig."],
  ["ਗ੍ਰਾਊਟ ਸਫ਼ਾਈ ਘੋਲ", "ਟਾਈਲ ਅਤੇ ਗ੍ਰਾਊਟ ਲਈ ਖਾਰਾ ਕਲੀਨਰ, ਫ਼ਰਸ਼ ਦੀ ਹਾਲਤ ਮੁਤਾਬਕ ਪਤਲਾ।"],
));
const TG_AREA = (qty, price, measured) => L.labour(qty, "each", price, t8(
  ["Tile and grout cleaning — per room or area", "One room or hallway of tile: grout pre-treated and brushed, rinsed and extracted under pressure."],
  ["Nettoyage de carrelage et joints — la pièce ou zone", "Une pièce ou un corridor carrelé : joints prétraités et brossés, rincés et extraits sous pression."],
  ["Limpieza de azulejo y lechada — por cuarto o área", "Un cuarto o pasillo de azulejo: lechada pretratada y cepillada, enjuagada y extraída a presión."],
  ["Pulizia piastrelle e fughe — per stanza o zona", "Una stanza o un corridoio piastrellato: fughe pretrattate e spazzolate, risciacquate ed estratte a pressione."],
  ["Fliesen- und Fugenreinigung — pro Raum oder Fläche", "Ein gefliester Raum oder Flur: Fugen vorbehandelt und gebürstet, unter Druck gespült und abgesaugt."],
  ["Чищення плитки та швів — за кімнату чи зону", "Одна кімната чи коридор із плиткою: шви оброблено й почищено щіткою, промито й екстраговано під тиском."],
  ["Paglilinis ng tile at grout — kada kuwarto o area", "Isang kuwarto o pasilyong may tile: pre-treated at binrush ang grout, binanlawan at in-extract nang may pressure."],
  ["ਟਾਈਲ ਅਤੇ ਗ੍ਰਾਊਟ ਸਫ਼ਾਈ — ਪ੍ਰਤੀ ਕਮਰਾ ਜਾਂ ਹਿੱਸਾ", "ਟਾਈਲ ਵਾਲਾ ਇੱਕ ਕਮਰਾ ਜਾਂ ਹਾਲਵੇਅ: ਗ੍ਰਾਊਟ ਪ੍ਰੀ-ਟ੍ਰੀਟ ਅਤੇ ਬੁਰਸ਼, ਦਬਾਅ ਨਾਲ ਧੋ ਕੇ ਐਕਸਟ੍ਰੈਕਟ।"],
), measured ? { measurementKey: "each" } : {});
const TG_SEAL = (qty) => L.labour(qty, "each", 45, t8(
  ["Add-on: grout sealing — per room or area", "Clear penetrating sealer applied to clean, dry grout lines so they resist stains."],
  ["Option : scellant à joints — la pièce ou zone", "Scellant pénétrant transparent appliqué sur les joints propres et secs pour résister aux taches."],
  ["Extra: sellado de lechada — por cuarto o área", "Sellador penetrante transparente aplicado a la lechada limpia y seca para que resista manchas."],
  ["Extra: sigillatura fughe — per stanza o zona", "Sigillante penetrante trasparente applicato sulle fughe pulite e asciutte contro le macchie."],
  ["Zusatz: Fugenimprägnierung — pro Raum oder Fläche", "Farblose Tiefenimprägnierung auf saubere, trockene Fugen gegen Flecken aufgetragen."],
  ["Додатково: герметизація швів — за кімнату чи зону", "Прозорий проникний герметик на чисті сухі шви, щоб не вбирали плям."],
  ["Add-on: grout sealing — kada kuwarto o area", "Clear na penetrating sealer sa malinis at tuyong grout para hindi mamantsahan."],
  ["ਵਾਧੂ: ਗ੍ਰਾਊਟ ਸੀਲਿੰਗ — ਪ੍ਰਤੀ ਕਮਰਾ ਜਾਂ ਹਿੱਸਾ", "ਸਾਫ਼ ਅਤੇ ਸੁੱਕੇ ਗ੍ਰਾਊਟ 'ਤੇ ਪਾਰਦਰਸ਼ੀ ਸੀਲਰ ਤਾਂ ਜੋ ਦਾਗ਼ ਨਾ ਲੱਗਣ।"],
), { optional: true });
const STONE_CLEANER = (price) => L.material(1, "flat", price, t8(
  ["Stone-safe neutral cleaner", "pH-neutral cleaner that will not etch marble, limestone or travertine."],
  ["Nettoyant neutre pour pierre", "Nettoyant au pH neutre qui ne marque pas le marbre, le calcaire ni le travertin."],
  ["Limpiador neutro para piedra", "Limpiador de pH neutro que no daña mármol, caliza ni travertino."],
  ["Detergente neutro per pietra", "Detergente a pH neutro che non intacca marmo, calcare o travertino."],
  ["Steinschonender Neutralreiniger", "pH-neutraler Reiniger, der Marmor, Kalkstein und Travertin nicht angreift."],
  ["Нейтральний засіб для каменю", "pH-нейтральний засіб, що не роз'їдає мармур, вапняк чи травертин."],
  ["Neutral cleaner para sa bato", "pH-neutral na cleaner na hindi sisira sa marble, limestone o travertine."],
  ["ਪੱਥਰ ਲਈ ਸੁਰੱਖਿਅਤ ਨਿਊਟ੍ਰਲ ਕਲੀਨਰ", "pH-ਨਿਊਟ੍ਰਲ ਕਲੀਨਰ ਜੋ ਮਾਰਬਲ, ਚੂਨਾ-ਪੱਥਰ ਜਾਂ ਟ੍ਰੈਵਰਟਾਈਨ ਨੂੰ ਖ਼ਰਾਬ ਨਹੀਂ ਕਰਦਾ।"],
));
const LEATHER = (price) => L.labour(1, "each", price, t8(
  ["Leather cleaning and conditioning — per piece", "Leather tested, cleaned with a pH-balanced cleaner and soft brush, then conditioned."],
  ["Nettoyage et nourrissage du cuir — la pièce", "Cuir testé, nettoyé au nettoyant équilibré et à la brosse douce, puis nourri."],
  ["Limpieza y acondicionado de cuero — por pieza", "Cuero probado, limpiado con limpiador de pH balanceado y cepillo suave, luego acondicionado."],
  ["Pulizia e nutrimento della pelle — per pezzo", "Pelle testata, pulita con detergente a pH bilanciato e spazzola morbida, poi nutrita."],
  ["Lederreinigung und -pflege — pro Stück", "Leder getestet, mit pH-ausgeglichenem Reiniger und weicher Bürste gereinigt, dann gepflegt."],
  ["Чищення й догляд за шкірою — за предмет", "Шкіру перевірено, очищено pH-збалансованим засобом і м'якою щіткою, потім оброблено кондиціонером."],
  ["Paglilinis at conditioning ng leather — kada piraso", "Tinest ang leather, nilinis gamit ang pH-balanced na cleaner at malambot na brush, saka kinondisyon."],
  ["ਚਮੜੇ ਦੀ ਸਫ਼ਾਈ ਅਤੇ ਕੰਡੀਸ਼ਨਿੰਗ — ਪ੍ਰਤੀ ਪੀਸ", "ਚਮੜਾ ਟੈਸਟ ਕਰਕੇ pH-ਸੰਤੁਲਿਤ ਕਲੀਨਰ ਅਤੇ ਨਰਮ ਬੁਰਸ਼ ਨਾਲ ਸਾਫ਼, ਫਿਰ ਕੰਡੀਸ਼ਨ ਕੀਤਾ।"],
), { measurementKey: "each" });
const LEATHER_KIT = (price) => L.material(1, "flat", price, t8(
  ["Leather cleaner and conditioner", "Professional leather cleaner and a conditioner that keeps the hide supple."],
  ["Nettoyant et revitalisant à cuir", "Nettoyant professionnel pour cuir et revitalisant qui garde la peau souple."],
  ["Limpiador y acondicionador de cuero", "Limpiador profesional de cuero y acondicionador que mantiene la piel flexible."],
  ["Detergente e nutriente per pelle", "Detergente professionale per pelle e nutriente che la mantiene morbida."],
  ["Lederreiniger und Lederpflege", "Profi-Lederreiniger und eine Pflege, die das Leder geschmeidig hält."],
  ["Засіб і кондиціонер для шкіри", "Професійний засіб для шкіри та кондиціонер, що зберігає її м'якою."],
  ["Leather cleaner at conditioner", "Pang-propesyonal na leather cleaner at conditioner na nagpapanatiling malambot ang balat."],
  ["ਚਮੜਾ ਕਲੀਨਰ ਅਤੇ ਕੰਡੀਸ਼ਨਰ", "ਪੇਸ਼ੇਵਰ ਚਮੜਾ ਕਲੀਨਰ ਅਤੇ ਕੰਡੀਸ਼ਨਰ ਜੋ ਚਮੜੇ ਨੂੰ ਨਰਮ ਰੱਖਦਾ ਹੈ।"],
));
const MATTRESS = (price) => [
  L.labour(1, "each", price, t8(
    ["Mattress cleaning — per mattress", "Both sides vacuumed with a HEPA tool, stains treated and the top low-moisture extracted."],
    ["Nettoyage de matelas — le matelas", "Deux faces aspirées à l'outil HEPA, taches traitées et dessus extrait à faible humidité."],
    ["Limpieza de colchón — por colchón", "Ambos lados aspirados con herramienta HEPA, manchas tratadas y la cara superior extraída con poca humedad."],
    ["Pulizia materasso — per materasso", "Entrambi i lati aspirati con filtro HEPA, macchie trattate e lato superiore estratto a bassa umidità."],
    ["Matratzenreinigung — pro Matratze", "Beide Seiten mit HEPA-Düse gesaugt, Flecken behandelt und die Oberseite feuchtigkeitsarm extrahiert."],
    ["Чищення матраца — за матрац", "Обидва боки пропилососено HEPA-насадкою, плями оброблено, верх екстраговано з мінімумом вологи."],
    ["Paglilinis ng kutson — kada kutson", "Binakyum ang dalawang side gamit ang HEPA tool, tinrato ang mantsa at in-extract ang ibabaw nang kaunting tubig."],
    ["ਗੱਦੇ ਦੀ ਸਫ਼ਾਈ — ਪ੍ਰਤੀ ਗੱਦਾ", "ਦੋਵੇਂ ਪਾਸੇ HEPA ਟੂਲ ਨਾਲ ਵੈਕਿਊਮ, ਦਾਗ਼ ਸਾਫ਼ ਅਤੇ ਉੱਪਰਲਾ ਪਾਸਾ ਘੱਟ ਨਮੀ ਨਾਲ ਐਕਸਟ੍ਰੈਕਟ।"],
  ), { measurementKey: "each" }),
  L.material(1, "flat", 10, t8(
    ["Mattress sanitiser and deodoriser", "Allergen and odour treatment safe for bedding."],
    ["Désinfectant et désodorisant à matelas", "Traitement des allergènes et des odeurs sans danger pour la literie."],
    ["Sanitizante y desodorante para colchón", "Tratamiento de alérgenos y olores seguro para la ropa de cama."],
    ["Igienizzante e deodorante per materassi", "Trattamento contro allergeni e odori sicuro per la biancheria da letto."],
    ["Matratzen-Hygiene- und Geruchsmittel", "Allergen- und Geruchsbehandlung, unbedenklich für Bettwaren."],
    ["Санітайзер і дезодорант для матраца", "Обробка від алергенів і запахів, безпечна для постелі."],
    ["Sanitiser at deodoriser ng kutson", "Treatment sa allergen at amoy na ligtas sa higaan."],
    ["ਗੱਦੇ ਲਈ ਸੈਨੀਟਾਈਜ਼ਰ ਅਤੇ ਡੀਓਡੋਰਾਈਜ਼ਰ", "ਬਿਸਤਰੇ ਲਈ ਸੁਰੱਖਿਅਤ ਐਲਰਜਨ ਅਤੇ ਬਦਬੂ ਇਲਾਜ।"],
  )),
];
const KB_CLEAN = (price, cost) => L.labour(1, "flat", price, t8(
  ["Kitchen and bathroom clean", "Counters, sink, stovetop and appliance fronts, tub or shower, toilet and mirror cleaned and sanitised."],
  ["Ménage de la cuisine et de la salle de bain", "Comptoirs, évier, cuisinière et façades d'appareils, bain ou douche, toilette et miroir nettoyés et désinfectés."],
  ["Limpieza de cocina y baño", "Cubiertas, fregadero, estufa y frentes de electrodomésticos, tina o regadera, inodoro y espejo limpios y desinfectados."],
  ["Pulizia cucina e bagno", "Piani, lavello, piano cottura e frontali, vasca o doccia, WC e specchio puliti e igienizzati."],
  ["Küchen- und Badreinigung", "Arbeitsflächen, Spüle, Kochfeld und Gerätefronten, Wanne oder Dusche, WC und Spiegel gereinigt und desinfiziert."],
  ["Прибирання кухні та ванної", "Стільниці, мийку, плиту й фасади техніки, ванну чи душ, унітаз і дзеркало очищено й продезінфіковано."],
  ["Paglilinis ng kusina at banyo", "Nilinis at dinisinfect ang counter, lababo, kalan, harap ng appliance, tub o shower, inodoro at salamin."],
  ["ਰਸੋਈ ਅਤੇ ਬਾਥਰੂਮ ਦੀ ਸਫ਼ਾਈ", "ਕਾਊਂਟਰ, ਸਿੰਕ, ਚੁੱਲ੍ਹਾ, ਉਪਕਰਣਾਂ ਦੇ ਮੂਹਰੇ, ਟੱਬ ਜਾਂ ਸ਼ਾਵਰ, ਟਾਇਲਟ ਅਤੇ ਸ਼ੀਸ਼ਾ ਸਾਫ਼ ਅਤੇ ਕੀਟਾਣੂ-ਰਹਿਤ।"],
), { cost });
const BL_CLEAN = (price, cost) => L.labour(1, "flat", price, t8(
  ["Bedroom and living area clean", "Surfaces dusted and wiped, floors vacuumed and mopped."],
  ["Ménage de la chambre et du séjour", "Surfaces époussetées et essuyées, planchers aspirés et lavés."],
  ["Limpieza de recámara y sala", "Superficies sacudidas y limpias, pisos aspirados y trapeados."],
  ["Pulizia camera e soggiorno", "Superfici spolverate e pulite, pavimenti aspirati e lavati."],
  ["Schlaf- und Wohnbereichsreinigung", "Flächen abgestaubt und gewischt, Böden gesaugt und gewischt."],
  ["Прибирання спальні й вітальні", "Пил витерто, поверхні протерто, підлогу пропилососено й вимито."],
  ["Paglilinis ng kuwarto at sala", "Pinunasan ang alikabok at ibabaw, binakyum at minap ang sahig."],
  ["ਬੈੱਡਰੂਮ ਅਤੇ ਬੈਠਕ ਦੀ ਸਫ਼ਾਈ", "ਸਤਹਾਂ ਦੀ ਧੂੜ ਝਾੜੀ ਅਤੇ ਪੂੰਝੀਆਂ, ਫ਼ਰਸ਼ ਵੈਕਿਊਮ ਅਤੇ ਪੋਚਾ।"],
), { cost });

const ROOM_BAND = (qty, perRoom, pretreatPrice, pretreatCost) => [ROOMS(qty, perRoom, perRoom / 2), PRETREAT(pretreatPrice, pretreatCost)];
const UPHOLSTERY = { categories: ["carpet_cleaning", "furniture_upholstery"] };

const ADDED = {
  // ── Installation (first full cleans, by size) ──
  "fq.carpet_cleaning.visits.one_room": T("installation", namesOf("fq.carpet_cleaning.visits.one_room"),
    [SETUP(), ROOMS(1, 80, 40), PRETREAT(15, 8)], null),
  "fq.carpet_cleaning.carpet.one_room": T("installation", namesOf("fq.carpet_cleaning.carpet.one_room"),
    [SETUP(), ROOMS(1, 80, 40), PRETREAT(15, 8)], null),
  // The captured "living areas" template, line for line.
  "fq.carpet_cleaning.visits.three_rooms": T("installation", namesOf("fq.carpet_cleaning.visits.three_rooms"),
    [LIVING_ROOM(), ROOMS(2, 80, 40), PRETREAT(20, 10)], D.newCustomer("fixed", 15)),
  "fq.carpet_cleaning.carpet.two_rooms": T("installation", namesOf("fq.carpet_cleaning.carpet.two_rooms"), ROOM_BAND(2, 75, 20, 10), null),
  "fq.carpet_cleaning.carpet.three_rooms": T("installation", namesOf("fq.carpet_cleaning.carpet.three_rooms"), ROOM_BAND(3, 70, 20, 10), null),
  "fq.carpet_cleaning.carpet.up_to_3_areas": T("installation", namesOf("fq.carpet_cleaning.carpet.up_to_3_areas"), ROOM_BAND(3, 70, 20, 10), null),
  "fq.carpet_cleaning.carpet.four_rooms": T("installation", namesOf("fq.carpet_cleaning.carpet.four_rooms"), ROOM_BAND(4, 65, 25, 12), null),
  "fq.carpet_cleaning.carpet.five_plus_rooms": T("installation", namesOf("fq.carpet_cleaning.carpet.five_plus_rooms"), ROOM_BAND(5, 60, 25, 12), null),
  "fq.carpet_cleaning.carpet.bundle_2_rooms_hallway": T("installation", namesOf("fq.carpet_cleaning.carpet.bundle_2_rooms_hallway"),
    [ROOMS(2, 80, 40), HALLWAY(false), PRETREAT(20, 10)], D.bundle("fixed", 20)),
  // The captured "whole home" template, with its three bedrooms as a count.
  "fq.carpet_cleaning.carpet.whole_house": T("installation", namesOf("fq.carpet_cleaning.carpet.whole_house"),
    [LIVING_ROOM(), ROOMS(3, 80, 40), HALL_STAIRS(), PRETREAT(25, 12)], D.newCustomer("fixed", 20)),
  "fq.carpet_cleaning.carpet.up_to_250_sqft": T("installation", namesOf("fq.carpet_cleaning.carpet.up_to_250_sqft"), [
    SETUP(),
    L.labour(1, "flat", 70, t8(
      ["Hot-water extraction — up to 250 sq ft", "Pre-sprayed, agitated and extracted across a carpeted area up to 250 sq ft."],
      ["Extraction à l'eau chaude — jusqu'à 250 pi²", "Prévaporisé, brossé et extrait sur une surface tapissée jusqu'à 250 pi²."],
      ["Extracción con agua caliente — hasta 250 pies²", "Prerrociado, agitado y extraído en un área alfombrada de hasta 250 pies²."],
      ["Estrazione ad acqua calda — fino a 250 piedi quadri", "Pretrattato, spazzolato ed estratto su una superficie in moquette fino a 250 piedi quadri."],
      ["Heißwasserextraktion — bis 250 sq ft", "Vorgesprüht, gebürstet und extrahiert auf einer Teppichfläche bis 250 sq ft."],
      ["Екстракція гарячою водою — до 250 кв. футів", "Попередньо оброблено, збито щіткою та екстраговано на площі з покриттям до 250 кв. футів."],
      ["Hot-water extraction — hanggang 250 sq ft", "Pre-spray, kinuskos at in-extract ang carpeted na area hanggang 250 sq ft."],
      ["ਗਰਮ ਪਾਣੀ ਐਕਸਟ੍ਰੈਕਸ਼ਨ — 250 ਵਰਗ ਫੁੱਟ ਤੱਕ", "250 ਵਰਗ ਫੁੱਟ ਤੱਕ ਕਾਰਪੈੱਟ ਵਾਲੇ ਹਿੱਸੇ 'ਤੇ ਪ੍ਰੀ-ਸਪਰੇਅ, ਰਗੜ ਅਤੇ ਐਕਸਟ੍ਰੈਕਸ਼ਨ।"],
    )),
    PRETREAT(15, 8),
  ], null),
  "fq.carpet_cleaning.carpet.per_room_standard": T("installation", namesOf("fq.carpet_cleaning.carpet.per_room_standard"),
    [PER_ROOM(80, 40), PRESPRAY_AREA()], null),
  "fq.carpet_cleaning.carpet.hallway": T("installation", namesOf("fq.carpet_cleaning.carpet.hallway"),
    [HALLWAY(true), PRESPRAY_AREA()], null),
  // The carpet book's two home-cleaning rows (a carpet company that also
  // cleans the unit at turnover), in this file's own wording.
  "fq.carpet_cleaning.specialty.one_time_1_1": T("installation", namesOf("fq.carpet_cleaning.specialty.one_time_1_1"), [
    KB_CLEAN(95, 60), BL_CLEAN(60, 38),
    L.labour(1, "flat", 20, t8(
      ["Carpet vacuum and spot treatment", "Carpeted floors vacuumed edge to edge and visible spots treated."],
      ["Aspiration et détachage du tapis", "Tapis aspirés d'un bord à l'autre et taches visibles traitées."],
      ["Aspirado y desmanchado de alfombra", "Alfombras aspiradas de orilla a orilla y manchas visibles tratadas."],
      ["Aspirazione e smacchiatura moquette", "Moquette aspirata da bordo a bordo e macchie visibili trattate."],
      ["Teppich saugen und Fleckbehandlung", "Teppichböden von Kante zu Kante gesaugt und sichtbare Flecken behandelt."],
      ["Пилососіння покриття й виведення плям", "Покриття пропилососено від краю до краю, видимі плями оброблено."],
      ["Pag-vacuum ng carpet at spot treatment", "Binakyum ang carpet mula gilid hanggang gilid at tinrato ang kitang mantsa."],
      ["ਕਾਰਪੈੱਟ ਵੈਕਿਊਮ ਅਤੇ ਦਾਗ਼ ਇਲਾਜ", "ਕਾਰਪੈੱਟ ਕਿਨਾਰੇ ਤੋਂ ਕਿਨਾਰੇ ਵੈਕਿਊਮ ਅਤੇ ਦਿਸਦੇ ਦਾਗ਼ ਸਾਫ਼।"],
    )),
  ], null),
  "fq.carpet_cleaning.specialty.move_in_out_1_1": T("installation", namesOf("fq.carpet_cleaning.specialty.move_in_out_1_1"), [
    KB_CLEAN(110, 70), BL_CLEAN(70, 45),
    L.labour(1, "flat", 80, t8(
      ["Inside cabinets, drawers and appliances", "Cabinets and drawers wiped out; fridge, oven and microwave cleaned inside."],
      ["Intérieur des armoires, tiroirs et appareils", "Armoires et tiroirs essuyés; réfrigérateur, four et micro-ondes nettoyés à l'intérieur."],
      ["Interior de gabinetes, cajones y electrodomésticos", "Gabinetes y cajones limpios por dentro; refrigerador, horno y microondas limpiados por dentro."],
      ["Interno di pensili, cassetti ed elettrodomestici", "Pensili e cassetti puliti dentro; frigo, forno e microonde puliti all'interno."],
      ["Schränke, Schubladen und Geräte innen", "Schränke und Schubladen ausgewischt; Kühlschrank, Backofen und Mikrowelle innen gereinigt."],
      ["Шафи, шухляди й техніка всередині", "Шафи й шухляди протерто; холодильник, духовку й мікрохвильовку вимито всередині."],
      ["Loob ng cabinet, drawer at appliance", "Pinunasan ang loob ng cabinet at drawer; nilinis ang loob ng ref, oven at microwave."],
      ["ਅਲਮਾਰੀਆਂ, ਦਰਾਜ਼ਾਂ ਅਤੇ ਉਪਕਰਣਾਂ ਦੇ ਅੰਦਰ", "ਅਲਮਾਰੀਆਂ ਅਤੇ ਦਰਾਜ਼ਾਂ ਅੰਦਰੋਂ ਪੂੰਝੀਆਂ; ਫ਼ਰਿੱਜ, ਓਵਨ ਅਤੇ ਮਾਈਕ੍ਰੋਵੇਵ ਅੰਦਰੋਂ ਸਾਫ਼।"],
    ), { cost: 48 }),
    L.labour(1, "flat", 40, t8(
      ["Baseboards, doors and switch plates", "Baseboards, door faces, frames and switch plates hand-wiped."],
      ["Plinthes, portes et plaques d'interrupteurs", "Plinthes, faces de portes, cadres et plaques d'interrupteurs essuyés à la main."],
      ["Zoclos, puertas y tapas de apagadores", "Zoclos, caras de puertas, marcos y tapas de apagadores limpiados a mano."],
      ["Battiscopa, porte e placche", "Battiscopa, ante delle porte, telai e placche degli interruttori puliti a mano."],
      ["Sockelleisten, Türen und Schalterabdeckungen", "Sockelleisten, Türblätter, Zargen und Schalterabdeckungen von Hand gewischt."],
      ["Плінтуси, двері й накладки вимикачів", "Плінтуси, полотна й коробки дверей, накладки вимикачів протерто вручну."],
      ["Baseboard, pinto at switch plate", "Pinunasan sa kamay ang baseboard, mukha at frame ng pinto at switch plate."],
      ["ਬੇਸਬੋਰਡ, ਦਰਵਾਜ਼ੇ ਅਤੇ ਸਵਿੱਚ ਪਲੇਟਾਂ", "ਬੇਸਬੋਰਡ, ਦਰਵਾਜ਼ਿਆਂ ਦੇ ਮੂੰਹ, ਚੁਗਾਠਾਂ ਅਤੇ ਸਵਿੱਚ ਪਲੇਟਾਂ ਹੱਥ ਨਾਲ ਪੂੰਝੀਆਂ।"],
    ), { cost: 25 }),
  ], null),

  // ── Repair (restorative) ──
  "fq.carpet_cleaning.carpet.whole_home_stain_removal": T("repair", namesOf("fq.carpet_cleaning.carpet.whole_home_stain_removal"),
    [LIVING_ROOM(), ROOMS(3, 80, 40), HALL_STAIRS(), SPOT(), STAIN_REMOVER()], null),
  "fq.carpet_cleaning.visits.pet_treatment": T("repair", namesOf("fq.carpet_cleaning.visits.pet_treatment"), [SETUP(), ...ENZYME()], null),
  "fq.carpet_cleaning.visits.pet_treatment_enzyme": T("repair", namesOf("fq.carpet_cleaning.visits.pet_treatment_enzyme"), [SETUP(), ...ENZYME()], null),
  "fq.carpet_cleaning.add_ons.odor_neutralization": T("repair", namesOf("fq.carpet_cleaning.add_ons.odor_neutralization"), [
    L.labour(1, "flat", 25, t8(
      ["Odour neutraliser application", "Neutraliser sprayed over the whole area and worked into the pile so it reaches the backing."],
      ["Application de neutralisant d'odeurs", "Neutralisant pulvérisé sur toute la zone et brossé dans le velours jusqu'à l'endos."],
      ["Aplicación de neutralizador de olores", "Neutralizador rociado en toda el área y trabajado en el pelo hasta llegar al respaldo."],
      ["Applicazione di neutralizzatore di odori", "Neutralizzatore spruzzato su tutta la zona e lavorato nel vello fino al supporto."],
      ["Geruchsneutralisierer auftragen", "Neutralisierer auf die ganze Fläche gesprüht und bis zum Rücken in den Flor eingearbeitet."],
      ["Нанесення нейтралізатора запахів", "Нейтралізатор розпилено на всю зону й втерто у ворс до основи."],
      ["Paglagay ng odour neutraliser", "Ini-spray sa buong area at ipinasok sa pile hanggang umabot sa backing."],
      ["ਬਦਬੂ ਨਿਊਟ੍ਰਲਾਈਜ਼ਰ ਲਗਾਉਣਾ", "ਪੂਰੇ ਹਿੱਸੇ 'ਤੇ ਨਿਊਟ੍ਰਲਾਈਜ਼ਰ ਛਿੜਕ ਕੇ ਰੇਸ਼ਿਆਂ ਵਿੱਚ ਹੇਠਾਂ ਤੱਕ ਰਚਾਇਆ।"],
    )),
    L.material(1, "flat", 15, t8(
      ["Odour neutraliser", "Professional odour counteractant for smoke, pets and mustiness."],
      ["Neutralisant d'odeurs", "Neutralisant professionnel pour fumée, animaux et odeur de renfermé."],
      ["Neutralizador de olores", "Contrarrestante profesional para humo, mascotas y humedad."],
      ["Neutralizzatore di odori", "Neutralizzante professionale per fumo, animali e odore di chiuso."],
      ["Geruchsneutralisierer", "Profi-Geruchsneutralisierer gegen Rauch, Tier- und Muffgeruch."],
      ["Нейтралізатор запахів", "Професійний засіб проти запаху диму, тварин і затхлості."],
      ["Odour neutraliser", "Pang-propesyonal na pantanggal ng amoy ng usok, alaga at kulob."],
      ["ਬਦਬੂ ਨਿਊਟ੍ਰਲਾਈਜ਼ਰ", "ਧੂੰਏਂ, ਪਾਲਤੂ ਜਾਨਵਰਾਂ ਅਤੇ ਸਿੱਲ੍ਹ ਦੀ ਬਦਬੂ ਲਈ ਪੇਸ਼ੇਵਰ ਘੋਲ।"],
    )),
  ], null),
  "fq.carpet_cleaning.specialty.stretching": T("repair", namesOf("fq.carpet_cleaning.specialty.stretching"), [
    L.labour(1, "each", 95, sameText("fq.carpet_cleaning.specialty.stretching_repair", "Power stretching — per room"), { measurementKey: "each" }),
    L.material(1, "flat", 20, t8(
      ["Tack strip and seam tape", "Replacement tack strip, nails and hot-melt seam tape where the old ones have failed."],
      ["Bande à clous et ruban de joint", "Bande à clous, clous et ruban thermocollant de remplacement là où les anciens ont lâché."],
      ["Tira de clavos y cinta de unión", "Tira de clavos, clavos y cinta termoadhesiva de reemplazo donde las viejas fallaron."],
      ["Listello chiodato e nastro per giunzioni", "Listello chiodato, chiodi e nastro termoadesivo sostitutivi dove i vecchi hanno ceduto."],
      ["Nagelleiste und Nahtband", "Ersatz-Nagelleiste, Nägel und Heißklebe-Nahtband, wo die alten nachgegeben haben."],
      ["Рейка з гвіздками та стрічка для швів", "Нова рейка, цвяхи й термострічка для швів там, де старі не тримають."],
      ["Tack strip at seam tape", "Pamalit na tack strip, pako at hot-melt seam tape kung saan bumigay ang luma."],
      ["ਟੈਕ ਸਟ੍ਰਿਪ ਅਤੇ ਸੀਮ ਟੇਪ", "ਜਿੱਥੇ ਪੁਰਾਣੇ ਢਿੱਲੇ ਹੋਏ ਉੱਥੇ ਨਵੀਂ ਟੈਕ ਸਟ੍ਰਿਪ, ਕਿੱਲ ਅਤੇ ਗਰਮ-ਚਿਪਕਣ ਵਾਲੀ ਸੀਮ ਟੇਪ।"],
    ), { cost: 12 }),
  ], null),
  "fq.carpet_cleaning.specialty.tile_grout": T("repair", namesOf("fq.carpet_cleaning.specialty.tile_grout"), [
    L.labour(1, "sqft", 0.85, t8(
      ["Tile and grout cleaning — per sq ft", "Grout lines pre-treated and brushed, then the floor rinsed and extracted under pressure."],
      ["Nettoyage de carrelage et joints — au pi²", "Joints prétraités et brossés, puis plancher rincé et extrait sous pression."],
      ["Limpieza de azulejo y lechada — por pie²", "Lechada pretratada y cepillada, luego el piso enjuagado y extraído a presión."],
      ["Pulizia piastrelle e fughe — al piede quadro", "Fughe pretrattate e spazzolate, poi pavimento risciacquato ed estratto a pressione."],
      ["Fliesen- und Fugenreinigung — pro sq ft", "Fugen vorbehandelt und gebürstet, dann der Boden unter Druck gespült und abgesaugt."],
      ["Чищення плитки та швів — за кв. фут", "Шви попередньо оброблено й почищено щіткою, підлогу промито й екстраговано під тиском."],
      ["Paglilinis ng tile at grout — kada sq ft", "Pre-treated at binrush ang grout, saka binanlawan at in-extract ang sahig nang may pressure."],
      ["ਟਾਈਲ ਅਤੇ ਗ੍ਰਾਊਟ ਸਫ਼ਾਈ — ਪ੍ਰਤੀ ਵਰਗ ਫੁੱਟ", "ਗ੍ਰਾਊਟ ਦੀਆਂ ਲਾਈਨਾਂ ਪ੍ਰੀ-ਟ੍ਰੀਟ ਕਰਕੇ ਬੁਰਸ਼, ਫਿਰ ਫ਼ਰਸ਼ ਦਬਾਅ ਨਾਲ ਧੋ ਕੇ ਐਕਸਟ੍ਰੈਕਟ।"],
    ), { measurementKey: "floorSqft" }),
    TG_SOLUTION(20),
  ], null),
  "fq.carpet_cleaning.specialty.tile_grout_hallway": T("repair", namesOf("fq.carpet_cleaning.specialty.tile_grout_hallway"),
    [TG_AREA(1, 65, true), TG_SOLUTION(10)], null),
  "fq.carpet_cleaning.specialty.tile_grout_2_rooms": T("repair", namesOf("fq.carpet_cleaning.specialty.tile_grout_2_rooms"),
    [TG_AREA(2, 95), TG_SOLUTION(15), TG_SEAL(2)], null),
  "fq.carpet_cleaning.specialty.tile_grout_3_rooms": T("repair", namesOf("fq.carpet_cleaning.specialty.tile_grout_3_rooms"),
    [TG_AREA(3, 90), TG_SOLUTION(20), TG_SEAL(3)], null),
  "fq.carpet_cleaning.specialty.tile_grout_4_rooms": T("repair", namesOf("fq.carpet_cleaning.specialty.tile_grout_4_rooms"),
    [TG_AREA(4, 85), TG_SOLUTION(25), TG_SEAL(4)], null),
  "fq.carpet_cleaning.specialty.tile_grout_5_rooms": T("repair", namesOf("fq.carpet_cleaning.specialty.tile_grout_5_rooms"),
    [TG_AREA(5, 80), TG_SOLUTION(30), TG_SEAL(5)], null),
  "fq.carpet_cleaning.specialty.tile_grout_stairs": T("repair", namesOf("fq.carpet_cleaning.specialty.tile_grout_stairs"), [
    L.labour(1, "each", 8, t8(
      ["Tiled stairs — per step", "Each tiled tread and riser scrubbed by hand, grout brushed and the step rinsed."],
      ["Escalier carrelé — la marche", "Chaque marche et contremarche carrelée frottée à la main, joints brossés et marche rincée."],
      ["Escalera de azulejo — por escalón", "Cada huella y contrahuella de azulejo tallada a mano, lechada cepillada y escalón enjuagado."],
      ["Scale piastrellate — per gradino", "Ogni pedata e alzata piastrellata strofinata a mano, fughe spazzolate e gradino risciacquato."],
      ["Geflieste Treppe — pro Stufe", "Jede geflieste Tritt- und Setzstufe von Hand geschrubbt, Fugen gebürstet und gespült."],
      ["Сходи з плиткою — за сходинку", "Кожну сходинку й підступень із плиткою відтерто вручну, шви почищено, сходинку промито."],
      ["Hagdang may tile — kada baitang", "Kinuskos sa kamay ang bawat baitang na may tile, binrush ang grout at binanlawan."],
      ["ਟਾਈਲ ਵਾਲੀਆਂ ਪੌੜੀਆਂ — ਪ੍ਰਤੀ ਪੌਡਾ", "ਹਰ ਟਾਈਲ ਵਾਲਾ ਪੌਡਾ ਹੱਥ ਨਾਲ ਰਗੜਿਆ, ਗ੍ਰਾਊਟ ਬੁਰਸ਼ ਕੀਤਾ ਅਤੇ ਧੋਤਾ।"],
    ), { measurementKey: "treads" }),
    TG_SOLUTION(10),
  ], null),

  // ── Maintenance ──
  "fq.carpet_cleaning.visits.high_traffic_refresh": T("maintenance", namesOf("fq.carpet_cleaning.visits.high_traffic_refresh"), [
    L.labour(1, "flat", 99, t8(
      ["Traffic-lane cleaning", "Walkways, entries and the lanes in front of seating pre-sprayed, agitated and extracted."],
      ["Nettoyage des zones passantes", "Allées, entrées et passages devant les sièges prévaporisés, brossés et extraits."],
      ["Limpieza de zonas de tránsito", "Pasillos, entradas y el paso frente a los asientos prerrociados, agitados y extraídos."],
      ["Pulizia delle zone di passaggio", "Passaggi, ingressi e corsie davanti alle sedute pretrattati, spazzolati ed estratti."],
      ["Laufstraßenreinigung", "Gehwege, Eingänge und die Bahnen vor den Sitzplätzen vorgesprüht, gebürstet und extrahiert."],
      ["Чищення прохідних доріжок", "Проходи, входи й доріжки перед місцями для сидіння попередньо оброблено, збито щіткою та екстраговано."],
      ["Paglilinis ng daanan", "Pre-spray, kinuskos at in-extract ang daanan, entrance at harap ng upuan."],
      ["ਆਵਾਜਾਈ ਵਾਲੇ ਰਾਹਾਂ ਦੀ ਸਫ਼ਾਈ", "ਰਾਹ, ਦਾਖ਼ਲੇ ਅਤੇ ਬੈਠਣ ਵਾਲੀ ਥਾਂ ਦੇ ਮੂਹਰੇ ਪ੍ਰੀ-ਸਪਰੇਅ, ਰਗੜ ਕੇ ਐਕਸਟ੍ਰੈਕਟ।"],
    )),
    PRETREAT(20, 10),
    L.labour(1, "flat", 20, t8(
      ["Carpet grooming", "Pile raked upright after extraction so it dries evenly and the lanes stop matting."],
      ["Peignage du tapis", "Velours redressé au râteau après l'extraction pour un séchage égal et moins d'écrasement."],
      ["Peinado de alfombra", "Pelo levantado con rastrillo después de la extracción para que seque parejo y no se aplaste."],
      ["Pettinatura della moquette", "Vello rialzato col rastrello dopo l'estrazione per un'asciugatura uniforme e meno schiacciamento."],
      ["Florpflege", "Flor nach der Extraktion aufgerichtet, damit er gleichmäßig trocknet und nicht verfilzt."],
      ["Розчісування ворсу", "Ворс піднято граблями після екстракції, щоб рівно висох і не зминався."],
      ["Pag-groom ng carpet", "Sinuklay pataas ang pile pagkatapos ng extraction para pantay matuyo at hindi madapa."],
      ["ਕਾਰਪੈੱਟ ਗਰੂਮਿੰਗ", "ਐਕਸਟ੍ਰੈਕਸ਼ਨ ਤੋਂ ਬਾਅਦ ਰੇਸ਼ੇ ਸਿੱਧੇ ਕੀਤੇ ਤਾਂ ਜੋ ਬਰਾਬਰ ਸੁੱਕਣ ਅਤੇ ਦੱਬਣ ਨਾ।"],
    )),
  ], null),
  "fq.carpet_cleaning.specialty.recurring_hard_floor": T("maintenance", namesOf("fq.carpet_cleaning.specialty.recurring_hard_floor"), [
    L.labour(1, "sqft", 0.3, t8(
      ["Hard-floor cleaning — per sq ft", "Tile, stone or sealed floors machine-scrubbed with a neutral cleaner and rinsed."],
      ["Nettoyage de planchers durs — au pi²", "Carrelage, pierre ou planchers scellés récurés à la machine au nettoyant neutre et rincés."],
      ["Limpieza de pisos duros — por pie²", "Azulejo, piedra o pisos sellados tallados a máquina con limpiador neutro y enjuagados."],
      ["Pulizia pavimenti duri — al piede quadro", "Piastrelle, pietra o pavimenti sigillati lavati a macchina con detergente neutro e risciacquati."],
      ["Hartbodenreinigung — pro sq ft", "Fliesen, Stein oder versiegelte Böden maschinell mit Neutralreiniger geschrubbt und gespült."],
      ["Чищення твердої підлоги — за кв. фут", "Плитку, камінь чи покриту підлогу вимито машиною нейтральним засобом і прополоскано."],
      ["Paglilinis ng matigas na sahig — kada sq ft", "Kinuskos ng makina gamit ang neutral cleaner at binanlawan ang tile, bato o sealed na sahig."],
      ["ਸਖ਼ਤ ਫ਼ਰਸ਼ ਦੀ ਸਫ਼ਾਈ — ਪ੍ਰਤੀ ਵਰਗ ਫੁੱਟ", "ਟਾਈਲ, ਪੱਥਰ ਜਾਂ ਸੀਲ ਕੀਤੇ ਫ਼ਰਸ਼ ਮਸ਼ੀਨ ਨਾਲ ਨਿਊਟ੍ਰਲ ਕਲੀਨਰ ਨਾਲ ਰਗੜ ਕੇ ਧੋਤੇ।"],
    ), { measurementKey: "floorSqft" }),
    STONE_CLEANER(10),
  ], D.regular("percent", 5)),
  "fq.carpet_cleaning.specialty.stone_stairs": T("maintenance", namesOf("fq.carpet_cleaning.specialty.stone_stairs"), [
    L.labour(1, "each", 10, t8(
      ["Stone stairs — per step", "Each stone tread and riser cleaned with a pH-neutral cleaner and soft pads, never acid."],
      ["Escalier en pierre — la marche", "Chaque marche et contremarche en pierre nettoyée au nettoyant neutre et aux tampons doux, jamais à l'acide."],
      ["Escalera de piedra — por escalón", "Cada huella y contrahuella de piedra limpiada con limpiador neutro y fibras suaves, nunca ácido."],
      ["Scale in pietra — per gradino", "Ogni pedata e alzata in pietra pulita con detergente neutro e dischi morbidi, mai acidi."],
      ["Steintreppe — pro Stufe", "Jede Steinstufe mit pH-neutralem Reiniger und weichen Pads gereinigt, niemals mit Säure."],
      ["Кам'яні сходи — за сходинку", "Кожну кам'яну сходинку очищено pH-нейтральним засобом і м'якими падами, без кислоти."],
      ["Hagdang bato — kada baitang", "Nilinis ang bawat baitang na bato gamit ang pH-neutral na cleaner at malambot na pad, walang acid."],
      ["ਪੱਥਰ ਦੀਆਂ ਪੌੜੀਆਂ — ਪ੍ਰਤੀ ਪੌਡਾ", "ਹਰ ਪੱਥਰ ਵਾਲਾ ਪੌਡਾ pH-ਨਿਊਟ੍ਰਲ ਕਲੀਨਰ ਅਤੇ ਨਰਮ ਪੈਡਾਂ ਨਾਲ ਸਾਫ਼, ਤੇਜ਼ਾਬ ਕਦੇ ਨਹੀਂ।"],
    ), { measurementKey: "treads" }),
    STONE_CLEANER(15),
  ], null),
  "fq.carpet_cleaning.specialty.stone_backsplash": T("maintenance", namesOf("fq.carpet_cleaning.specialty.stone_backsplash"), [
    L.labour(1, "flat", 95, t8(
      ["Stone backsplash cleaning", "Grease and splatter lifted from the stone and grout by hand, then rinsed and buffed dry."],
      ["Nettoyage du dosseret en pierre", "Graisse et éclaboussures retirées à la main de la pierre et des joints, puis rincé et essuyé."],
      ["Limpieza de salpicadero de piedra", "Grasa y salpicaduras retiradas a mano de la piedra y la lechada, luego enjuagado y secado."],
      ["Pulizia alzatina in pietra", "Grasso e schizzi tolti a mano da pietra e fughe, poi risciacquata e asciugata."],
      ["Reinigung Steinrückwand", "Fett und Spritzer von Stein und Fugen von Hand gelöst, dann gespült und trocken poliert."],
      ["Чищення кам'яного фартуха", "Жир і бризки вручну знято з каменю й швів, потім промито й витерто досуха."],
      ["Paglilinis ng stone backsplash", "Tinanggal sa kamay ang mantika at talsik sa bato at grout, saka binanlawan at pinunasang tuyo."],
      ["ਪੱਥਰ ਦੇ ਬੈਕਸਪਲੈਸ਼ ਦੀ ਸਫ਼ਾਈ", "ਪੱਥਰ ਅਤੇ ਗ੍ਰਾਊਟ ਤੋਂ ਚਿਕਨਾਈ ਅਤੇ ਛਿੱਟੇ ਹੱਥ ਨਾਲ ਹਟਾਏ, ਫਿਰ ਧੋ ਕੇ ਸੁਕਾਇਆ।"],
    )),
    STONE_CLEANER(15),
    L.labour(1, "flat", 60, t8(
      ["Add-on: stone sealer application", "Penetrating sealer applied so oil and sauce wipe off instead of staining."],
      ["Option : application de scellant à pierre", "Scellant pénétrant appliqué pour que l'huile et les sauces s'essuient au lieu de tacher."],
      ["Extra: aplicación de sellador para piedra", "Sellador penetrante aplicado para que el aceite y las salsas se limpien sin manchar."],
      ["Extra: applicazione di sigillante per pietra", "Sigillante penetrante applicato perché olio e sughi si puliscano senza macchiare."],
      ["Zusatz: Steinimprägnierung", "Tiefenimprägnierung aufgetragen, damit Öl und Soßen abwischbar bleiben statt Flecken zu hinterlassen."],
      ["Додатково: просочення каменю", "Проникне просочення, щоб олія й соуси витиралися, а не лишали плям."],
      ["Add-on: paglagay ng stone sealer", "Penetrating sealer para mapunasan ang mantika at sarsa sa halip na mamantsa."],
      ["ਵਾਧੂ: ਪੱਥਰ ਸੀਲਰ ਲਗਾਉਣਾ", "ਅੰਦਰ ਰਚਣ ਵਾਲਾ ਸੀਲਰ ਤਾਂ ਜੋ ਤੇਲ ਅਤੇ ਸਾਸ ਦਾਗ਼ ਦੀ ਥਾਂ ਪੂੰਝੇ ਜਾਣ।"],
    ), { optional: true }),
  ], null),
  "fq.carpet_cleaning.specialty.sectional": T("maintenance", namesOf("fq.carpet_cleaning.specialty.sectional"), [
    L.labour(1, "each", 225, t8(
      ["Sectional cleaning — per sectional", "Every seat, back and arm tested, pre-sprayed and extracted with an upholstery tool."],
      ["Nettoyage de sectionnel — le sectionnel", "Chaque siège, dossier et accoudoir testé, prévaporisé et extrait à l'outil à rembourrage."],
      ["Limpieza de seccional — por seccional", "Cada asiento, respaldo y brazo probado, prerrociado y extraído con herramienta de tapicería."],
      ["Pulizia divano angolare — per divano", "Ogni seduta, schienale e bracciolo testato, pretrattato ed estratto con attrezzo per imbottiti."],
      ["Ecksofareinigung — pro Ecksofa", "Jeder Sitz, jede Lehne und Armlehne getestet, vorgesprüht und mit Polsterdüse extrahiert."],
      ["Чищення кутового дивана — за диван", "Кожне сидіння, спинку й підлокітник перевірено, оброблено й екстраговано насадкою для меблів."],
      ["Paglilinis ng sectional — kada sectional", "Tinest, pre-spray at in-extract gamit ang upholstery tool ang bawat upuan, sandalan at armrest."],
      ["ਸੈਕਸ਼ਨਲ ਸੋਫ਼ੇ ਦੀ ਸਫ਼ਾਈ — ਪ੍ਰਤੀ ਸੈਕਸ਼ਨਲ", "ਹਰ ਸੀਟ, ਢੋਅ ਅਤੇ ਬਾਂਹ ਟੈਸਟ ਕਰਕੇ ਪ੍ਰੀ-ਸਪਰੇਅ ਅਤੇ ਅਪਹੋਲਸਟਰੀ ਟੂਲ ਨਾਲ ਐਕਸਟ੍ਰੈਕਟ।"],
    ), { measurementKey: "each" }),
    L.material(1, "flat", 12, t8(
      ["Fabric pre-spray and rinse agent", "Fibre-safe pre-spray and acidic rinse that leaves the fabric soft and residue-free."],
      ["Prévaporisateur et rinçage pour tissus", "Prévaporisateur doux pour les fibres et rinçage acide qui laisse le tissu souple et sans résidu."],
      ["Prerrociador y enjuague para telas", "Prerrociador seguro para fibras y enjuague ácido que deja la tela suave y sin residuos."],
      ["Prespray e risciacquo per tessuti", "Prespray delicato sulle fibre e risciacquo acido che lascia il tessuto morbido e senza residui."],
      ["Stoff-Vorsprühmittel und Spülmittel", "Faserschonendes Vorsprühmittel und saure Spülung, die den Stoff weich und rückstandsfrei lässt."],
      ["Засіб для тканин і ополіскувач", "Безпечний для волокон спрей і кислотний ополіскувач, після яких тканина м'яка й без залишків."],
      ["Fabric pre-spray at rinse agent", "Fiber-safe na pre-spray at acidic rinse na nag-iiwan ng malambot na tela at walang residue."],
      ["ਕੱਪੜੇ ਲਈ ਪ੍ਰੀ-ਸਪਰੇਅ ਅਤੇ ਰਿੰਸ", "ਰੇਸ਼ਿਆਂ ਲਈ ਸੁਰੱਖਿਅਤ ਪ੍ਰੀ-ਸਪਰੇਅ ਅਤੇ ਤੇਜ਼ਾਬੀ ਰਿੰਸ, ਕੱਪੜਾ ਨਰਮ ਅਤੇ ਬਿਨਾਂ ਰਹਿੰਦ-ਖੂੰਹਦ।"],
    )),
    L.labour(1, "each", 45, t8(
      ["Add-on: fabric protector — per piece", "Water-based protector sprayed on after cleaning so spills bead up."],
      ["Option : protecteur à tissu — la pièce", "Protecteur à base d'eau pulvérisé après le nettoyage pour que les dégâts perlent."],
      ["Extra: protector de tela — por pieza", "Protector base agua rociado después de limpiar para que los derrames no se absorban."],
      ["Extra: protettivo per tessuti — per pezzo", "Protettivo all'acqua spruzzato dopo la pulizia perché i liquidi restino in superficie."],
      ["Zusatz: Stoffschutz — pro Stück", "Wasserbasierter Schutz nach der Reinigung aufgesprüht, damit Verschüttetes abperlt."],
      ["Додатково: захист тканини — за предмет", "Захист на водній основі після чищення, щоб рідина збиралася краплями."],
      ["Add-on: fabric protector — kada piraso", "Water-based na protector na ini-spray pagkatapos maglinis para hindi sumipsip ang natapon."],
      ["ਵਾਧੂ: ਫ਼ੈਬਰਿਕ ਪ੍ਰੋਟੈਕਟਰ — ਪ੍ਰਤੀ ਪੀਸ", "ਸਫ਼ਾਈ ਤੋਂ ਬਾਅਦ ਪਾਣੀ-ਅਧਾਰਿਤ ਪ੍ਰੋਟੈਕਟਰ ਤਾਂ ਜੋ ਡੁੱਲ੍ਹਿਆ ਤਰਲ ਨਾ ਰਚੇ।"],
    ), { measurementKey: "each", optional: true }),
  ], null, UPHOLSTERY),
  "fq.carpet_cleaning.specialty.leather_chairs": T("maintenance", namesOf("fq.carpet_cleaning.specialty.leather_chairs"), [LEATHER(65), LEATHER_KIT(12)], null, UPHOLSTERY),
  "fq.carpet_cleaning.specialty.leather_sofa": T("maintenance", namesOf("fq.carpet_cleaning.specialty.leather_sofa"), [LEATHER(150), LEATHER_KIT(18)], null, UPHOLSTERY),
  "fq.carpet_cleaning.specialty.leather_sectional": T("maintenance", namesOf("fq.carpet_cleaning.specialty.leather_sectional"), [LEATHER(250), LEATHER_KIT(25)], null, UPHOLSTERY),
  "fq.carpet_cleaning.specialty.mattress_full": T("maintenance", namesOf("fq.carpet_cleaning.specialty.mattress_full"), MATTRESS(90), null),
  "fq.carpet_cleaning.specialty.mattress_cal_king": T("maintenance", namesOf("fq.carpet_cleaning.specialty.mattress_cal_king"), MATTRESS(120), null),
  // The benchmark's median ($140) split into the visit and its shampoo.
  "fq.carpet_cleaning.specialty.area_rug_8x10": T("maintenance", namesOf("fq.carpet_cleaning.specialty.area_rug_8x10"), [
    L.labour(1, "each", 125, t8(
      ["Area rug cleaning — on site", "Rug dusted, shampooed in place with a low-moisture method, rinsed and groomed."],
      ["Nettoyage de carpette — sur place", "Carpette dépoussiérée, shampouinée sur place à faible humidité, rincée et peignée."],
      ["Limpieza de tapete — en sitio", "Tapete desempolvado, lavado en sitio con poca humedad, enjuagado y peinado."],
      ["Pulizia tappeto — sul posto", "Tappeto spolverato, lavato sul posto a bassa umidità, risciacquato e pettinato."],
      ["Teppichreinigung — vor Ort", "Teppich entstaubt, vor Ort feuchtigkeitsarm shampooniert, gespült und gebürstet."],
      ["Чищення килима — на місці", "Килим вибито, вимито на місці з мінімумом вологи, прополоскано й розчесано."],
      ["Paglilinis ng area rug — on site", "Pinagpag, shinampoo sa lugar nang kaunting tubig, binanlawan at sinuklay."],
      ["ਏਰੀਆ ਰੱਗ ਸਫ਼ਾਈ — ਮੌਕੇ 'ਤੇ", "ਰੱਗ ਝਾੜਿਆ, ਉੱਥੇ ਹੀ ਘੱਟ ਨਮੀ ਨਾਲ ਸ਼ੈਂਪੂ, ਧੋਤਾ ਅਤੇ ਸੰਵਾਰਿਆ।"],
    ), { measurementKey: "each" }),
    L.material(1, "flat", 15, t8(
      ["Rug shampoo and rinse", "Wool-safe rug shampoo and a neutralising rinse."],
      ["Shampooing et rinçage à carpette", "Shampooing sans danger pour la laine et rinçage neutralisant."],
      ["Champú y enjuague para tapete", "Champú seguro para lana y un enjuague neutralizante."],
      ["Shampoo e risciacquo per tappeti", "Shampoo sicuro per la lana e risciacquo neutralizzante."],
      ["Teppichshampoo und Spülung", "Wollschonendes Teppichshampoo und eine neutralisierende Spülung."],
      ["Шампунь і ополіскувач для килимів", "Безпечний для вовни шампунь і нейтралізуючий ополіскувач."],
      ["Rug shampoo at rinse", "Wool-safe na shampoo at neutralising rinse."],
      ["ਰੱਗ ਸ਼ੈਂਪੂ ਅਤੇ ਰਿੰਸ", "ਉੱਨ ਲਈ ਸੁਰੱਖਿਅਤ ਰੱਗ ਸ਼ੈਂਪੂ ਅਤੇ ਨਿਊਟ੍ਰਲ ਕਰਨ ਵਾਲਾ ਰਿੰਸ।"],
    )),
  ], null),
  // The benchmark's median ($81) split into its two halves.
  "fq.carpet_cleaning.specialty.stairs_glass_detail": T("maintenance", namesOf("fq.carpet_cleaning.specialty.stairs_glass_detail"), [
    L.labour(1, "flat", 55, t8(
      ["Stair cleaning and dusting", "Main-floor stairs vacuumed or wiped; spindles, rails and skirting dusted."],
      ["Nettoyage et époussetage de l'escalier", "Escalier principal aspiré ou essuyé; barreaux, main courante et plinthes époussetés."],
      ["Limpieza y sacudido de escaleras", "Escalera principal aspirada o limpiada; balaustres, pasamanos y zoclos sacudidos."],
      ["Pulizia e spolveratura delle scale", "Scala principale aspirata o pulita; colonnine, corrimano e zoccolini spolverati."],
      ["Treppenreinigung und Abstauben", "Haupttreppe gesaugt oder gewischt; Stäbe, Handlauf und Sockelleisten abgestaubt."],
      ["Прибирання сходів і витирання пилу", "Основні сходи пропилососено чи протерто; балясини, поручні й плінтуси очищено від пилу."],
      ["Paglilinis at pagpupunas ng hagdan", "Binakyum o pinunasan ang pangunahing hagdan; pinunasan ang baluster, hawakan at skirting."],
      ["ਪੌੜੀਆਂ ਦੀ ਸਫ਼ਾਈ ਅਤੇ ਧੂੜ", "ਮੁੱਖ ਪੌੜੀਆਂ ਵੈਕਿਊਮ ਜਾਂ ਪੂੰਝੀਆਂ; ਜੰਗਲੇ, ਹੱਥ-ਫੜ ਅਤੇ ਸਕਰਟਿੰਗ ਦੀ ਧੂੜ ਸਾਫ਼।"],
    )),
    L.labour(1, "flat", 26, t8(
      ["Glass and railing detail", "Glass panels, doors and railings cleaned streak-free, fingerprints and smudges removed."],
      ["Détail des vitres et rampes", "Panneaux vitrés, portes et rampes nettoyés sans traces, empreintes et marques enlevées."],
      ["Detallado de vidrio y barandales", "Paneles de vidrio, puertas y barandales limpios sin marcas, huellas y manchas retiradas."],
      ["Dettaglio vetri e ringhiere", "Pannelli in vetro, porte e ringhiere puliti senza aloni, impronte e segni rimossi."],
      ["Glas- und Geländerdetail", "Glasflächen, Türen und Geländer streifenfrei gereinigt, Fingerabdrücke und Schlieren entfernt."],
      ["Детальне чищення скла й поручнів", "Скляні панелі, двері й поручні вимито без розводів, відбитки й плями прибрано."],
      ["Detalye ng salamin at railing", "Nilinis nang walang guhit ang salamin, pinto at railing, tinanggal ang fingerprint at mantsa."],
      ["ਸ਼ੀਸ਼ੇ ਅਤੇ ਜੰਗਲੇ ਦੀ ਬਾਰੀਕ ਸਫ਼ਾਈ", "ਸ਼ੀਸ਼ੇ ਦੇ ਪੈਨਲ, ਦਰਵਾਜ਼ੇ ਅਤੇ ਜੰਗਲੇ ਬਿਨਾਂ ਧਾਰੀਆਂ ਸਾਫ਼, ਉਂਗਲਾਂ ਦੇ ਨਿਸ਼ਾਨ ਹਟਾਏ।"],
    )),
  ], null),
};
// This pass only adds: a row that already has a template keeps it untouched.
for (const key of Object.keys(ADDED)) if (TEMPLATES[key]) throw new Error(`carpet_cleaning: ${key} is already templated above`);

withLanguages(SEED, I18N);
withTemplates(SEED, TEMPLATES);
withTemplates(SEED, ADDED);
