// lib/pricing/complexity/stairs.js
//
// What makes a staircase refinish harder than the last one.
//
// ── Provenance ─────────────────────────────────────────────────────────────
//
// The fourteen factors and their three answers each are the product owner's
// own list, from his research into how stair refinishers actually quote. The
// WEIGHTS are not his and are not measured: they are an opening position, set
// so that the answers a refinisher would call routine sum to nothing and the
// ones he would charge for accumulate. Nobody has timed a curved staircase
// against a straight one to produce the 4 below. Tune them here, in one place,
// once real jobs have been closed against them — see
// lib/costing/labourCalibration.js for the pattern this should eventually
// follow.
//
// ── The first answer is always the benign one ──────────────────────────────
//
// Weight 0, no reason line, and it is what `newComplexity` opens on. That is
// what makes the control safe to mount on an existing screen: an estimator who
// never touches it produces score 0, level Standard, multiplier 1, no reasons
// on the client's copy — exactly what a group with no complexity control at
// all produced.
//
// ── Reason lines are for the homeowner, not the office ─────────────────────
//
// "turned wood balusters, refinished in place" — the trade's own words, in the
// document's language, saying what the crew will do. Not "baluster complexity:
// high", which tells a homeowner nothing and reads as a surcharge looking for
// a justification. EN/FR/ES: the three the product sells in, same closed-set
// reasoning as lib/i18n/gutterEstimateCopy.js.

const STAIRS_COMPLEXITY = {
  trade: "stairs",
  label: { en: "Staircase complexity", fr: "Complexité de l'escalier", es: "Complejidad de la escalera" },

  // Inclusive lower bounds against a maximum of 44. Specialty is deliberately
  // far up: it means "we will not price this from a form", and a threshold a
  // busy staircase reaches by accident would turn every quote into a site
  // visit and the control into something estimators route around.
  thresholds: { moderate: 3, complex: 10, specialty: 24 },

  factors: [
    {
      key: "shape",
      label: { en: "Shape", fr: "Forme", es: "Forma" },
      options: [
        {
          value: "straight",
          weight: 0,
          label: { en: "Straight run", fr: "Volée droite", es: "Tramo recto" },
        },
        {
          value: "l_or_u",
          weight: 2,
          label: { en: "L or U with a landing", fr: "En L ou en U avec palier", es: "En L o en U con descanso" },
          reason: {
            en: "L- or U-shaped flight with a landing — the landing is sanded and finished as its own surface",
            fr: "Escalier en L ou en U avec palier — le palier est sablé et fini comme une surface à part",
            es: "Escalera en L o en U con descanso — el descanso se lija y se termina como una superficie aparte",
          },
        },
        {
          value: "curved",
          weight: 4,
          label: { en: "Curved or winder treads", fr: "Courbé ou marches dansantes", es: "Curva o peldaños compensados" },
          reason: {
            en: "Curved flight with winder treads — every tread is a different shape and is sanded by hand",
            fr: "Escalier courbé avec marches dansantes — chaque marche a une forme différente et se sable à la main",
            es: "Escalera curva con peldaños compensados — cada peldaño tiene una forma distinta y se lija a mano",
          },
        },
      ],
    },
    {
      key: "sides",
      label: { en: "Open sides", fr: "Côtés ouverts", es: "Lados abiertos" },
      options: [
        {
          value: "enclosed",
          weight: 0,
          label: { en: "Enclosed both sides", fr: "Fermé des deux côtés", es: "Cerrada por ambos lados" },
        },
        {
          value: "one_open",
          weight: 1,
          label: { en: "One side open", fr: "Un côté ouvert", es: "Un lado abierto" },
          reason: {
            en: "One open side — the tread ends and returns are finished as visible edges",
            fr: "Un côté ouvert — les bouts et retours de marche sont finis comme des arêtes visibles",
            es: "Un lado abierto — los extremos y retornos del peldaño se terminan como bordes visibles",
          },
        },
        {
          value: "both_open",
          weight: 2,
          label: { en: "Both sides open", fr: "Les deux côtés ouverts", es: "Ambos lados abiertos" },
          reason: {
            en: "Open on both sides — twice the visible tread ends and returns to finish",
            fr: "Ouvert des deux côtés — deux fois plus de bouts et de retours de marche visibles à finir",
            es: "Abierta por ambos lados — el doble de extremos y retornos visibles que terminar",
          },
        },
      ],
    },
    {
      key: "treads",
      label: { en: "Tread condition", fr: "État des marches", es: "Estado de los peldaños" },
      options: [
        {
          value: "sound",
          weight: 0,
          label: { en: "Sound hardwood", fr: "Bois franc sain", es: "Madera dura en buen estado" },
        },
        {
          value: "worn",
          weight: 2,
          label: { en: "Worn or dented", fr: "Usées ou bosselées", es: "Desgastados o abollados" },
          reason: {
            en: "Worn and dented treads — extra sanding passes to bring the walked-on centres back level",
            fr: "Marches usées et bosselées — passes de sablage supplémentaires pour remettre le centre à niveau",
            es: "Peldaños desgastados y abollados — lijado adicional para nivelar el centro pisado",
          },
        },
        {
          value: "damaged",
          weight: 4,
          label: {
            en: "Damaged, thin or previously over-sanded",
            fr: "Abîmées, amincies ou déjà trop sablées",
            es: "Dañados, delgados o ya sobrelijados",
          },
          reason: {
            en: "Treads already sanded thin — hand work and a light touch so nothing is cut through to the substrate",
            fr: "Marches déjà amincies par le sablage — travail à la main et touche légère pour ne pas percer jusqu'au support",
            es: "Peldaños ya adelgazados por el lijado — trabajo a mano y toque ligero para no llegar al soporte",
          },
        },
      ],
    },
    {
      key: "existingFinish",
      label: { en: "Existing finish", fr: "Fini existant", es: "Acabado existente" },
      options: [
        {
          value: "paint_or_light",
          weight: 0,
          label: { en: "Paint or a light clear coat", fr: "Peinture ou vernis clair léger", es: "Pintura o capa transparente ligera" },
        },
        {
          value: "stain_poly",
          weight: 1,
          label: { en: "Standard stain and poly", fr: "Teinture et polyuréthane standards", es: "Tinte y poliuretano estándar" },
          reason: {
            en: "Existing stain and polyurethane sanded back before the new finish goes on",
            fr: "Teinture et polyuréthane existants sablés avant l'application du nouveau fini",
            es: "Tinte y poliuretano existentes lijados antes de aplicar el nuevo acabado",
          },
        },
        {
          value: "heavy_varnish",
          weight: 3,
          label: { en: "Heavy varnish or very dark", fr: "Vernis épais ou très foncé", es: "Barniz grueso o muy oscuro" },
          reason: {
            en: "Heavy old varnish stripped and sanded off before anything new is applied",
            fr: "Vieux vernis épais décapé et sablé avant toute nouvelle application",
            es: "Barniz viejo y grueso decapado y lijado antes de aplicar nada nuevo",
          },
        },
      ],
    },
    {
      key: "colourDirection",
      label: { en: "Colour direction", fr: "Changement de couleur", es: "Cambio de color" },
      options: [
        {
          value: "similar",
          weight: 0,
          label: { en: "Similar to what is there", fr: "Semblable à l'existant", es: "Similar a lo existente" },
        },
        {
          value: "light_to_dark",
          weight: 2,
          label: { en: "Light to dark", fr: "Du pâle au foncé", es: "De claro a oscuro" },
          reason: {
            en: "Going darker — the new colour has to land evenly across every tread, so the sanding has to be even first",
            fr: "Vers un ton plus foncé — la nouvelle couleur doit être uniforme sur chaque marche, donc le sablage doit l'être d'abord",
            es: "Hacia un tono más oscuro — el color nuevo debe quedar parejo en cada peldaño, así que el lijado debe serlo primero",
          },
        },
        {
          value: "dark_to_light",
          weight: 4,
          // The owner's switch. OFF by default: some refinishers will quote a
          // dark-to-light stair from a form and some will not, and that is his
          // call per company, not ours.
          forcesWhen: "darkToLight",
          label: { en: "Dark to light", fr: "Du foncé au pâle", es: "De oscuro a claro" },
          reason: {
            en: "Dark to light — extra sanding and sealing to lift the old colour out of the grain before the new one goes on",
            fr: "Du foncé au pâle — sablage et scellage supplémentaires pour sortir l'ancienne couleur du grain avant la nouvelle",
            es: "De oscuro a claro — lijado y sellado adicionales para sacar el color viejo de la veta antes de aplicar el nuevo",
          },
        },
      ],
    },
    {
      key: "risers",
      label: { en: "Risers", fr: "Contremarches", es: "Contrahuellas" },
      options: [
        {
          value: "painted_staying",
          weight: 0,
          label: { en: "Painted, staying painted", fr: "Peintes, restent peintes", es: "Pintadas, siguen pintadas" },
        },
        {
          value: "repaint",
          weight: 1,
          label: { en: "Painted to a new colour", fr: "Repeintes d'une nouvelle couleur", es: "Pintadas de un color nuevo" },
          reason: {
            en: "Risers repainted in a new colour — masked off the treads and cut in by hand",
            fr: "Contremarches repeintes d'une nouvelle couleur — masquées des marches et coupées à la main",
            es: "Contrahuellas repintadas en un color nuevo — enmascaradas de los peldaños y cortadas a mano",
          },
        },
        {
          value: "stained_wood",
          weight: 2,
          label: { en: "Stained wood, staying stained", fr: "Bois teint, reste teint", es: "Madera teñida, sigue teñida" },
          reason: {
            en: "Stained wood risers refinished to match the treads rather than painted over",
            fr: "Contremarches en bois teint refinies pour s'agencer aux marches plutôt que peintes",
            es: "Contrahuellas de madera teñida rematadas a juego con los peldaños en vez de pintadas",
          },
        },
      ],
    },
    {
      key: "stringers",
      label: { en: "Stringers", fr: "Limons", es: "Zancas" },
      options: [
        {
          value: "painted",
          weight: 0,
          label: { en: "Painted", fr: "Peints", es: "Pintadas" },
        },
        {
          value: "solid_wood",
          weight: 1,
          label: { en: "Exposed solid wood", fr: "Bois massif apparent", es: "Madera maciza a la vista" },
          reason: {
            en: "Exposed solid wood stringers sanded and finished alongside the treads",
            fr: "Limons en bois massif apparents sablés et finis en même temps que les marches",
            es: "Zancas de madera maciza a la vista lijadas y terminadas junto con los peldaños",
          },
        },
        {
          value: "veneer",
          weight: 3,
          // The owner's second switch. A veneer stringer can be perfectly
          // routine or it can be a stringer you cannot sand at all, and he
          // wanted to decide per company whether that is a site visit.
          forcesWhen: "veneer",
          label: { en: "Veneer", fr: "Placage", es: "Chapa" },
          reason: {
            en: "Veneered stringers — sanded by hand and lightly, because there is very little material to work with",
            fr: "Limons plaqués — sablés à la main et légèrement, car il y a très peu de matière",
            es: "Zancas chapadas — lijadas a mano y con suavidad, porque hay muy poco material",
          },
        },
      ],
    },
    {
      key: "balusters",
      label: { en: "Balusters", fr: "Barreaux", es: "Balaustres" },
      options: [
        {
          value: "metal_or_none",
          weight: 0,
          label: { en: "Metal, or none", fr: "Métal, ou aucun", es: "Metálicos, o ninguno" },
        },
        {
          value: "simple_wood",
          weight: 1,
          label: { en: "Simple wood", fr: "Bois simple", es: "Madera sencilla" },
          reason: {
            en: "Plain wood balusters, refinished in place",
            fr: "Barreaux en bois simples, refinis en place",
            es: "Balaustres de madera lisos, rematados en el sitio",
          },
        },
        {
          value: "turned",
          weight: 3,
          label: { en: "Turned, detailed or numerous", fr: "Tournés, détaillés ou nombreux", es: "Torneados, detallados o numerosos" },
          reason: {
            en: "Turned wood balusters, refinished in place — each one is sanded and coated by hand",
            fr: "Barreaux en bois tournés, refinis en place — chacun est sablé et enduit à la main",
            es: "Balaustres de madera torneados, rematados en el sitio — cada uno se lija y se aplica a mano",
          },
        },
      ],
    },
    {
      key: "handrail",
      label: { en: "Handrail", fr: "Main courante", es: "Pasamanos" },
      options: [
        {
          value: "painted",
          weight: 0,
          label: { en: "Painted", fr: "Peinte", es: "Pintado" },
        },
        {
          value: "sand_stain",
          weight: 1,
          label: { en: "Sand and stain", fr: "Sabler et teindre", es: "Lijar y teñir" },
          reason: {
            en: "Handrail sanded back and re-stained to match",
            fr: "Main courante sablée et reteinte pour s'agencer",
            es: "Pasamanos lijado y reteñido a juego",
          },
        },
        {
          value: "intricate",
          weight: 3,
          label: { en: "Intricate profile or hard to reach", fr: "Profil complexe ou d'accès difficile", es: "Perfil intrincado o de difícil acceso" },
          reason: {
            en: "Moulded handrail profile worked by hand, including the sections that cannot be reached with a machine",
            fr: "Profil mouluré de main courante travaillé à la main, y compris les sections inaccessibles à la machine",
            es: "Perfil moldurado del pasamanos trabajado a mano, incluidos los tramos inaccesibles a máquina",
          },
        },
      ],
    },
    {
      key: "newelPosts",
      label: { en: "Newel posts", fr: "Poteaux de départ", es: "Postes de arranque" },
      options: [
        {
          value: "simple",
          weight: 0,
          label: { en: "Simple", fr: "Simples", es: "Sencillos" },
        },
        {
          value: "wood_refinish",
          weight: 1,
          label: { en: "Wood, refinished", fr: "En bois, refinis", es: "De madera, rematados" },
          reason: {
            en: "Newel posts sanded and refinished on all four faces",
            fr: "Poteaux de départ sablés et refinis sur leurs quatre faces",
            es: "Postes de arranque lijados y rematados en sus cuatro caras",
          },
        },
        {
          value: "carved",
          weight: 3,
          label: { en: "Carved", fr: "Sculptés", es: "Tallados" },
          reason: {
            en: "Carved newel posts — the detail is worked by hand so the profile is not lost",
            fr: "Poteaux de départ sculptés — le détail est travaillé à la main pour ne pas perdre le profil",
            es: "Postes de arranque tallados — el detalle se trabaja a mano para no perder el perfil",
          },
        },
      ],
    },
    {
      key: "repairs",
      label: { en: "Repairs", fr: "Réparations", es: "Reparaciones" },
      options: [
        {
          value: "minor_filling",
          weight: 0,
          label: { en: "Minor filling", fr: "Remplissage mineur", es: "Relleno menor" },
        },
        {
          value: "dents_gaps_squeaks",
          weight: 2,
          label: { en: "Dents, gaps, squeaks", fr: "Bosses, jeux, craquements", es: "Golpes, holguras, crujidos" },
          reason: {
            en: "Dents filled, gaps closed and squeaks fixed before any finish is applied",
            fr: "Bosses remplies, jeux comblés et craquements corrigés avant toute application de fini",
            es: "Golpes rellenados, holguras cerradas y crujidos corregidos antes de aplicar el acabado",
          },
        },
        {
          value: "cracks_loose_nosings",
          weight: 4,
          label: {
            en: "Cracks, loose treads, damaged nosings",
            fr: "Fissures, marches décollées, nez abîmés",
            es: "Grietas, peldaños sueltos, narices dañadas",
          },
          reason: {
            en: "Loose treads re-secured, cracks repaired and damaged nosings rebuilt before refinishing",
            fr: "Marches décollées refixées, fissures réparées et nez abîmés reconstruits avant la finition",
            es: "Peldaños sueltos refijados, grietas reparadas y narices dañadas reconstruidas antes del acabado",
          },
        },
      ],
    },
    {
      key: "stainMatch",
      label: { en: "Stain match", fr: "Agencement de teinte", es: "Igualación del tinte" },
      options: [
        {
          value: "none",
          weight: 0,
          label: { en: "Nothing to match", fr: "Rien à agencer", es: "Nada que igualar" },
        },
        {
          value: "similar_floor",
          weight: 1,
          label: { en: "Similar to the floor", fr: "Semblable au plancher", es: "Similar al piso" },
          reason: {
            en: "Stain chosen to sit close to the existing floor",
            fr: "Teinte choisie pour se rapprocher du plancher existant",
            es: "Tinte elegido para acercarse al piso existente",
          },
        },
        {
          value: "exact_floor",
          weight: 3,
          label: { en: "Exact match to an existing floor", fr: "Agencement exact à un plancher existant", es: "Igualación exacta a un piso existente" },
          reason: {
            en: "Stain matched exactly to your existing floor — mixed and sampled on your own wood until it reads the same",
            fr: "Teinte agencée exactement à votre plancher existant — mélangée et testée sur votre propre bois jusqu'à ce qu'elle soit identique",
            es: "Tinte igualado exactamente a su piso existente — mezclado y probado en su propia madera hasta que coincida",
          },
        },
      ],
    },
    {
      key: "access",
      label: { en: "Access", fr: "Accès", es: "Acceso" },
      options: [
        {
          value: "easy",
          weight: 0,
          label: { en: "Easy", fr: "Facile", es: "Fácil" },
        },
        {
          value: "tight",
          weight: 1,
          label: { en: "Tight", fr: "Restreint", es: "Estrecho" },
          reason: {
            en: "Tight access — equipment is carried in and set up by hand",
            fr: "Accès restreint — l'équipement est transporté et monté à la main",
            es: "Acceso estrecho — el equipo se entra y se monta a mano",
          },
        },
        {
          value: "multi_storey",
          weight: 2,
          label: { en: "Multiple storeys", fr: "Plusieurs étages", es: "Varias plantas" },
          reason: {
            en: "Flights on more than one storey — containment and dust control set up on each level",
            fr: "Volées sur plus d'un étage — confinement et contrôle de la poussière installés à chaque niveau",
            es: "Tramos en más de una planta — confinamiento y control de polvo montados en cada nivel",
          },
        },
      ],
    },
    {
      key: "finishDesign",
      label: { en: "Finish design", fr: "Conception du fini", es: "Diseño del acabado" },
      options: [
        {
          value: "one_colour",
          weight: 0,
          label: { en: "One colour", fr: "Une couleur", es: "Un color" },
        },
        {
          value: "two_tone",
          weight: 2,
          label: { en: "Two-tone", fr: "Deux tons", es: "Dos tonos" },
          reason: {
            en: "Two-tone finish — the treads and the risers are masked and coated separately",
            fr: "Fini deux tons — les marches et les contremarches sont masquées et enduites séparément",
            es: "Acabado de dos tonos — los peldaños y las contrahuellas se enmascaran y se aplican por separado",
          },
        },
        {
          value: "multiple",
          weight: 4,
          label: { en: "Multiple combinations", fr: "Plusieurs combinaisons", es: "Varias combinaciones" },
          reason: {
            en: "Several colours and finishes across the one staircase — each combination is masked, coated and cured on its own",
            fr: "Plusieurs couleurs et finis sur le même escalier — chaque combinaison est masquée, enduite et séchée séparément",
            es: "Varios colores y acabados en la misma escalera — cada combinación se enmascara, se aplica y se cura por separado",
          },
        },
      ],
    },
  ],
};

export default STAIRS_COMPLEXITY;
