// lib/documents/serviceContent.es.js
//
// What a quote SAYS about each trade — in Spanish.
//
// ── Why a parallel file, and not translation at send time ───────────────────
//
// A document keeps the language it was created in (AGENTS.md non-negotiable
// #6). The prose here is not stored on the quote; resolveServiceContent picks
// it at render time from a STATIC catalogue keyed by the quote's own fixed
// `language`, so a Spanish quote renders the same Spanish sentences on the day
// it is signed and on every day after. Nothing is machine-translated at send
// time, and a viewer's browser language changes nothing.
//
// ── Register ────────────────────────────────────────────────────────────────
//
// Neutral Latin-American Spanish as a contractor in the US or Canada writes it
// to a homeowner: formal "usted" (su cocina, le informamos), "cotización" for
// the quote, and the trade loanwords crews actually use (primer, drywall,
// fascia) where the Spanish word would read as a dictionary rather than a
// quote. Where a term is unfamiliar, the English trade word follows in
// parentheses so the homeowner can match it to what the crew says on site.
//
// Same rules as the English: nothing states a warranty term, a price, a cure
// time, a brand or a number of days that the English does not. Anything
// specific stays a [placeholder] — in Spanish, and still in square brackets,
// because the resolver withholds a line with a bracket left in it whatever
// language the bracket is in.

const PREP_APPLY_FINISH = [
  {
    title: "Recorrido y confirmación",
    body: "Confirmamos el alcance en el sitio, acordamos el acabado y los colores, y resolvemos cualquier duda pendiente antes de empezar.",
  },
  {
    title: "Protección y preparación",
    body: "Muebles movidos o cubiertos, superficies cercanas cubiertas con cinta y papel, y todas las superficies limpiadas y preparadas para un resultado duradero.",
  },
  {
    title: "Reparaciones y primer",
    body: "Imperfecciones rellenadas y lijadas, y primer aplicado donde se necesita para la adherencia y la cobertura.",
  },
  {
    title: "Aplicación",
    body: "El acabado se aplica en capas completas, respetando entre una y otra el tiempo de secado que el producto realmente requiere.",
  },
  {
    title: "Limpieza y recorrido final",
    body: "Se retira el material de protección, el área queda limpia, y hacemos un recorrido con usted antes de dar el trabajo por terminado.",
  },
];

const CABINET_REFINISH_WORKFLOW = [
  {
    title: "Preparación y protección de la cocina",
    body: "Primero se instalan la protección y el aislamiento del área — pisos, encimeras, electrodomésticos y las aberturas hacia el resto de la casa — para que el polvo y la pintura pulverizada se queden en el cuarto donde se trabaja.",
  },
  {
    title: "Desmontaje y etiquetado",
    body: "Se retiran las puertas, los frentes de cajón y los herrajes, y cada pieza se etiqueta para que vuelva a la misma abertura de donde salió.",
  },
  {
    title: "Limpieza y lijado",
    body: "Cada superficie se desengrasa y luego se lija. Un acabado aplicado sobre grasa de cocina o sobre un barniz brillante de fábrica es un acabado que se pela; por eso este es el paso que no conviene acortar.",
  },
  {
    title: "Primer y lijado fino",
    body: "Se aplica primer para bloquear manchas y dar agarre a la capa final, con un lijado fino entre capas para bajar la fibra que levantó la capa anterior.",
  },
  {
    title: "Capa final, inspección y retoques",
    body: "La capa final se aplica con pistola en capas completas, luego se inspecciona con buena luz y se retoca antes de volver a montar cualquier pieza.",
  },
  {
    title: "Reinstalación, limpieza y recorrido",
    body: "Las puertas y los frentes se vuelven a colocar en sus propias aberturas, se reinstalan los herrajes y se realinean las puertas, se limpia el cuarto, y lo recorremos con usted.",
  },
];

const CABINET_REFACE_WORKFLOW = [
  {
    title: "Medición y especificación",
    body: "Cada abertura se mide en el sitio, y el estilo de puerta, el color y el acabado se confirman con usted antes de hacer cualquier pedido. Las puertas se fabrican a esas medidas y no se pueden cambiar de tamaño después.",
  },
  {
    title: "Pedido y fabricación",
    body: "Las puertas, los frentes de cajón y el material a juego para las caras de los gabinetes se fabrican según las medidas y el acabado confirmados.",
  },
  {
    title: "Desmontaje",
    body: "Se retiran y se llevan las puertas, los frentes de cajón y los herrajes existentes.",
  },
  {
    title: "Caras de los gabinetes preparadas y terminadas",
    body: "Las caras exteriores visibles de los gabinetes se limpian, se preparan y se terminan a juego con los frentes nuevos, para que lo que usted conserva y lo que se reemplaza se vea como una sola cocina.",
  },
  {
    title: "Colocación y ajuste",
    body: "Se instalan las bisagras, se perforan las posiciones de las manijas donde usted eligió, y cada puerta y cajón se alinea para que las separaciones queden parejas.",
  },
  {
    title: "Limpieza y recorrido",
    body: "Se limpia el cuarto y lo recorremos con usted antes de su aprobación final.",
  },
];

const SHELL_SEQUENCE = [
  {
    title: "Revisión de planos",
    body: "Usted nos proporciona los planos arquitectónicos y estructurales. Revisamos los requisitos de la estructura, identificamos cualquier necesidad de vigas o columnas de acero, y señalamos los problemas de acceso al sitio antes de que se conviertan en retrasos en la obra.",
    timeline: "1–2 días",
  },
  {
    title: "Visita al sitio",
    body: "Recorremos la propiedad para evaluar las rutas de acceso, las áreas de acopio y cualquier particularidad del sitio — incluso cómo se entrega el material en un terreno estrecho.",
    timeline: "1–2 horas",
  },
  {
    title: "Cotización detallada",
    body: "Precios desglosados, con el alcance y el cronograma por escrito. Nada llega después como sorpresa.",
    timeline: "3–5 días hábiles",
  },
  {
    title: "Estructura (framing)",
    body: "Una vez que la cimentación está lista y aprobada por la inspección, se arman los pisos, las paredes y el techo, y se colocan los refuerzos (blocking) para electricidad, plomería y accesorios. La estructura queda lista para las instalaciones mecánicas preliminares (rough-in).",
    timeline: "2–4 semanas",
  },
  {
    title: "Aislamiento",
    body: "Después de que se inspeccionan las instalaciones mecánicas y eléctricas preliminares, se coloca el aislamiento especificado — espuma en aerosol, colchonetas (batt) o una combinación, según los planos y los requisitos energéticos.",
    timeline: "3–7 días",
  },
  {
    title: "Paneles de yeso (drywall)",
    body: "Paneles colocados, encintados y terminados a Level 4, o a Level 5 donde se especifique. Paredes listas para primer y pintura, y nuestras áreas de trabajo limpias.",
    timeline: "1–2 semanas",
  },
];

const MEASURE_SUPPLY_INSTALL = [
  {
    title: "Consulta y selección",
    body: "Confirmamos con usted el alcance, los materiales y los acabados, y resolvemos cualquier duda pendiente antes de hacer el pedido.",
  },
  {
    title: "Medición",
    body: "Medidas exactas tomadas en el sitio para que el material se corte a su espacio y no a un cálculo aproximado.",
  },
  {
    title: "Pedido y fabricación",
    body: "Materiales pedidos y preparados según las medidas confirmadas.",
  },
  {
    title: "Retiro y preparación",
    body: "Se retira y se desecha el material existente cuando eso forma parte del alcance, y se prepara el área para la instalación.",
  },
  {
    title: "Instalación y recorrido",
    body: "Instalado, nivelado, sellado y limpio, seguido de un recorrido con usted.",
  },
];

const ASSESS_REPAIR_TEST = [
  {
    title: "Evaluación",
    body: "Diagnosticamos el problema en el sitio y confirmamos lo que se necesita antes de comprometer cualquier trabajo o pieza.",
  },
  {
    title: "Confirmación",
    body: "Si el trabajo resulta distinto de lo cotizado, se lo informamos antes de continuar — no después, en la factura.",
  },
  {
    title: "El trabajo",
    body: "Realizado conforme al código, con las piezas y los métodos indicados en esta cotización.",
  },
  {
    title: "Pruebas",
    body: "Todo se prueba en condiciones normales de funcionamiento antes de recoger.",
  },
  {
    title: "Limpieza y entrega",
    body: "El área queda como la encontramos, y le explicamos lo que se hizo y cualquier cosa a la que deba estar atento.",
  },
];

const VISIT_SERVICE_VERIFY = [
  {
    title: "Confirmación",
    body: "Confirmamos el acceso, el horario y cualquier punto específico al que usted quiera que prestemos atención.",
  },
  {
    title: "Preparación",
    body: "Se prepara el área y se cubre todo lo que necesita protección antes de empezar.",
  },
  {
    title: "El trabajo",
    body: "Realizado según el alcance indicado en esta cotización, con nuestro propio equipo y materiales salvo que se indique lo contrario.",
  },
  {
    title: "Inspección",
    body: "Revisamos el trabajo antes de irnos y corregimos cualquier cosa que no cumpla con el estándar.",
  },
];

const INSPECT_REPORT_REVIEW = [
  {
    title: "Cita y acceso",
    body: "Confirmamos la propiedad, la hora y cómo se organiza el acceso. Usted puede estar presente — la mayoría de los clientes aprovechan más la inspección cuando lo están.",
  },
  {
    title: "Inspección en el sitio",
    body: "Una inspección visual de las áreas y los sistemas de fácil acceso indicados arriba. No es invasiva: no se desarma nada, no se abre ninguna superficie terminada y no se mueven las pertenencias guardadas.",
  },
  {
    title: "Hallazgos en el sitio",
    body: "Revisamos con usted lo que encontramos antes de irnos, para que conozca en persona los puntos importantes y pueda preguntar sobre ellos en el momento.",
  },
  {
    title: "Informe escrito",
    body: "Un informe escrito con fotografías de cada hallazgo importante, lo que significa y lo que le recomendaríamos hacer al respecto.",
  },
  {
    title: "Preguntas posteriores",
    body: "El informe genera preguntas una vez que usted lo lee con calma. Seguimos disponibles para comentarlo con usted.",
  },
];

const PLAN_BUILD_HANDOVER = [
  {
    title: "Alcance y cronograma",
    body: "Confirmamos el alcance completo, organizamos la secuencia de los oficios, y acordamos con usted una fecha de inicio y una duración prevista.",
  },
  {
    title: "Permisos y preparación",
    body: "Se tramitan los permisos y las inspecciones que se requieran, y el sitio se prepara y se protege.",
  },
  {
    title: "Demolición e instalaciones preliminares",
    body: "Se retira el material existente y los trabajos estructurales, eléctricos y de plomería quedan listos para la inspección.",
  },
  {
    title: "Acabados",
    body: "Superficies, accesorios y acabados instalados según la especificación acordada arriba.",
  },
  {
    title: "Inspección y entrega",
    body: "Inspección final, lista de pendientes resuelta, sitio limpio, y un recorrido con usted.",
  },
];

const REFACE_TAIL =
  " Las caras exteriores visibles de los gabinetes se terminan a juego, las bisagras se suministran, se instalan y se ajustan, las posiciones de las manijas se perforan donde usted elija, y las puertas y frentes viejos se retiran y se llevan.";

const REFACE_DESCRIPTION =
  "Reemplazamos las puertas y los frentes de cajón, y terminamos a juego las caras exteriores visibles de los gabinetes, para que su cocina conserve su distribución y sus cajas de gabinete actuales. El estilo de puerta cotizado arriba es el que se fabrica; las bisagras se suministran, se instalan y se ajustan, las posiciones de las manijas se perforan donde usted elija, y las puertas y frentes viejos se retiran y se llevan. Al interior de los gabinetes no se le renueva el acabado salvo que una línea de arriba lo indique.";

const REFACE_DOOR_VARIANTS = {
  thermofoil:
    "Las puertas y los frentes de cajón de esta cotización son de termofoil: un núcleo de MDF recubierto con una lámina de vinilo termoformada y terminada en fábrica en el color que usted eligió. Llegan terminados — no se lija, no se aplica primer ni se pinta nada en el sitio, y el color no se puede cambiar más adelante sin reemplazar la puerta." +
    REFACE_TAIL,
  painted_mdf:
    "Las puertas y los frentes de cajón de esta cotización son de MDF pintado: una puerta de MDF maquinada y pintada con pistola en el color que usted eligió. El MDF no tiene veta que se marque a través de la pintura, que es lo que permite un acabado pintado uniforme y sin juntas visibles, y se puede volver a pintar más adelante." +
    REFACE_TAIL,
  red_oak:
    "Las puertas y los frentes de cajón de esta cotización son de roble rojo macizo: una puerta de madera natural con una veta abierta y marcada que se ve a través del acabado, por lo que no hay dos puertas idénticas. La madera se mueve con las estaciones, y las líneas finas que se abren y se cierran en las uniones entre travesaños y largueros son normales, no un defecto." +
    REFACE_TAIL,
  white_oak:
    "Las puertas y los frentes de cajón de esta cotización son de roble blanco macizo: una puerta de madera natural con una veta más cerrada y más recta que la del roble rojo, que se ve a través del acabado, por lo que no hay dos puertas idénticas. La madera se mueve con las estaciones, y las líneas finas que se abren y se cierran en las uniones entre travesaños y largueros son normales, no un defecto." +
    REFACE_TAIL,
};

const GUTTER_WORK_VARIANTS = {
  cleaning:
    "Limpiamos las canaletas y bajantes que usted tiene, las enjuagamos con agua para comprobar que drenan, e inspeccionamos los tramos mientras están vacíos — soportes, uniones, juntas y la fascia detrás de ellos — sellando sobre la marcha las fallas menores que encontremos. Lo que se cotiza aquí es el trabajo indicado arriba: reemplazar un tramo, corregir su pendiente o reparar fascia podrida es un trabajo aparte y aparece solo donde usted lo ve cotizado.",
  install:
    "Suministramos e instalamos canaletas nuevas en los tramos cotizados arriba, formadas en el sitio al largo de su fascia y colgadas con una pendiente que lleva el agua hacia las salidas, con las bajantes indicadas arriba llevadas hasta donde usted quiere que vaya el agua. Solo se instalan los tramos y bajantes cotizados arriba — protectores, cable calefactor, sofito, fascia y cualquier trabajo en el techo son líneas aparte y se incluyen solo donde usted los ve cotizados.",
  replacement:
    "Desmontamos las canaletas que usted tiene, nos las llevamos, y colgamos canaleta nueva en su lugar a lo largo de los tramos cotizados arriba, formada en el sitio y colocada con una pendiente que lleva el agua hacia las salidas, con las bajantes indicadas arriba. El retiro y desecho de las canaletas viejas es parte de lo que usted paga aquí — lo verá incluido en la tarifa por pie o en una línea propia. Si al quitar el tramo viejo aparece fascia podrida, se le informa con fotografías y se cotiza antes de reparar cualquier parte. Solo se reemplazan los tramos y bajantes cotizados arriba.",
  repair:
    "Reparamos las fallas indicadas arriba — volvemos a sellar uniones y juntas, refijamos soportes, y corregimos la pendiente de secciones cortas para que el tramo drene en lugar de acumular agua — y hacemos correr agua por las secciones reparadas antes de irnos, para que usted vea que fluyen. Las reparaciones se cotizan por sección en esta cotización. Reemplazar un tramo completo, corregir la pendiente de todo el sistema o reparar fascia podrida es un trabajo aparte y aparece solo donde usted lo ve cotizado.",
  guard_only:
    "Instalamos el protector de canaletas cotizado arriba sobre los tramos indicados arriba. Un protector tiene que ir sobre una canaleta limpia, o simplemente atrapa la basura debajo, así que cualquier tramo que no esté limpio se limpia primero — esa limpieza es un trabajo aparte y se incluye solo donde usted la ve cotizada. Solo se protegen los tramos cotizados arriba, y las bajantes, el techo y todo lo que está por encima de la línea de canaletas son líneas aparte en las mismas condiciones.",
};

export const GENERIC_ES = {
  included: [
    "Toda la mano de obra y el equipo necesarios para completar el trabajo descrito arriba",
    "Protección de las superficies y los acabados cercanos mientras estamos en el sitio",
    "Limpieza y retiro de nuestros propios escombros al terminar",
    "Un recorrido con usted antes de la aprobación final del trabajo",
  ],
  steps: VISIT_SERVICE_VERIFY,
};

export const CONTENT_ES = {
  // ── Recubrimientos y acabados ────────────────────────────────────────────
  interior_painting: {
    description:
      "Pintamos las habitaciones y superficies cotizadas arriba. Los muebles se mueven o se cubren y los pisos se protegen, los agujeros de clavos y las grietas se rellenan, las rendijas se sellan con masilla (caulk), y las superficies se lijan y reciben primer donde lo necesitan antes de las capas de acabado. Solo se pintan las superficies indicadas arriba — techos, molduras, puertas e interiores de clósets son líneas aparte y se incluyen solo donde usted las ve cotizadas.",
    included: [
      "Muebles movidos o cubiertos y pisos protegidos en todo momento",
      "Agujeros de clavos y grietas rellenados, áreas ásperas lijadas, rendijas selladas con masilla",
      "Primer aplicado donde se necesita por cambio de color, reparaciones o superficies sin pintar",
      "Capas completas de pintura de primera calidad en cada superficie indicada arriba",
      "Recorte a pincel en molduras, bordes y detalles, en lugar de líneas con cinta",
      "Tapas de tomacorrientes y herrajes retirados y vueltos a colocar",
    ],
    steps: PREP_APPLY_FINISH,
  },
  exterior_painting: {
    description:
      "Lavamos las superficies exteriores cotizadas arriba y dejamos que se sequen, raspamos el material suelto y descascarado, lijamos las áreas ásperas, sellamos con masilla las juntas y uniones abiertas, aplicamos primer en los puntos sin pintura y reparados, y luego aplicamos las capas de acabado. Solo se recubren las superficies indicadas arriba — molduras, sofito, fascia, puertas y contraventanas son líneas aparte y se incluyen solo donde usted las ve cotizadas.",
    included: [
      "Superficies lavadas y bien secas antes de aplicar cualquier recubrimiento",
      "Material suelto y descascarado raspado, áreas ásperas lijadas",
      "Juntas, uniones y rendijas selladas con masilla; reparaciones menores de superficie bien hechas",
      "Primer para exteriores en las áreas sin pintura y reparadas",
      "Capas completas de pintura para exteriores en cada superficie indicada arriba",
      "Sitio libre de cinta, lonas de protección y escombros al terminar",
    ],
    steps: PREP_APPLY_FINISH,
  },
  cabinet_refinishing: {
    description:
      "Renovamos el acabado de los gabinetes que usted ya tiene. Las puertas, los frentes de cajón y las caras exteriores visibles de los gabinetes se desengrasan, se lijan, reciben primer y se pintan con pistola con un acabado nuevo en el color y el brillo que usted elija. No se reemplaza nada: las cajas, la distribución y el estilo de puerta se quedan exactamente como están, y al interior de los gabinetes no se le renueva el acabado salvo que una línea de arriba lo indique.",
    included: [
      "Color y brillo acordados con usted antes de hacer cualquier pedido",
      "Cocina protegida y aislada para que el polvo y la pintura pulverizada se queden en el cuarto",
      "Puertas, frentes de cajón y herrajes retirados, etiquetados y vueltos a colocar",
      "Todas las superficies desengrasadas, lijadas y preparadas para la adherencia",
      "Primer aplicado para bloquear manchas y dar agarre a la capa final",
      "Capa final aplicada con pistola en ambas caras de cada puerta y frente de cajón",
      "Exteriores de los gabinetes terminados a juego",
      "Herrajes reinstalados, puertas realineadas, y un recorrido con usted",
      // Brackets are capped at 80 characters by unfilledPlaceholders(); a
      // longer one would print WITH its brackets on a client's quote.
      "Primer: [cuántas capas y qué primer usa]",
      "Capa final: [cuántas capas, qué producto y la proporción de catalizador si usa uno]",
      "Garantía contra desprendimiento: [su plazo y lo que cubre]",
      "Tiempo habitual en el sitio: [cuántos días, del inicio al recorrido final]",
    ],
    steps: CABINET_REFINISH_WORKFLOW,
  },
  cabinet_refacing: {
    description: REFACE_DESCRIPTION,
    variantLabel: "el material de las puertas",
    variants: REFACE_DOOR_VARIANTS,
    included: [
      "Estilo de puerta, color y acabado confirmados con usted antes del pedido",
      "Cada abertura medida en el sitio, para que las puertas se hagan a la medida de su cocina",
      "Puertas y frentes de cajón nuevos fabricados a esas medidas",
      "Exteriores de los gabinetes terminados a juego con los frentes nuevos",
      "Bisagras suministradas, instaladas y ajustadas para que las puertas queden niveladas",
      "Posiciones de las manijas perforadas donde usted eligió",
      "Puertas, frentes y herrajes existentes retirados y llevados",
      "Puertas y cajones ajustados en la entrega, con un recorrido",
      "Fabricación y acabado de las puertas: [su proveedor y el acabado que especifica]",
      "Garantía de las puertas y el acabado: [su plazo y lo que cubre]",
      "Tiempo habitual desde el pedido hasta la instalación: [su plazo de entrega]",
    ],
    steps: CABINET_REFACE_WORKFLOW,
  },
  stairs: {
    description:
      "Renovamos el acabado de la escalera tal como está. Las paredes, los barrotes y el piso cercano se cubren con cinta y papel, los componentes cotizados arriba se lijan hasta la madera desnuda, los golpes y las rendijas se rellenan, se aplica tinte donde se eligió un color, y siguen las capas protectoras con un lijado ligero entre cada una. Solo se trabajan los componentes indicados arriba — huellas, contrahuellas, balaústres, postes de arranque, pasamanos y descanso son líneas aparte. Reemplazar un componente, en lugar de renovar su acabado, es un trabajo aparte.",
    included: [
      "Paredes, barrotes y pisos cercanos cubiertos y protegidos",
      "Huellas y componentes lijados, listos para el acabado",
      "Rendijas, golpes e imperfecciones rellenados",
      "Tinte aplicado de manera uniforme en todas las superficies preparadas",
      "Capas protectoras de acabado con lijado ligero entre cada una",
      "Indicaciones de cuidado y secado en la entrega",
    ],
    steps: PREP_APPLY_FINISH,
  },
  flooring: {
    description:
      "Renovamos el acabado de los pisos de madera que usted ya tiene en las áreas cotizadas arriba. Se fijan las tablas sueltas, luego el piso se lija con granos cada vez más finos para quitar el acabado viejo y nivelar la superficie, se rellenan los agujeros y las rendijas, se aplica tinte donde se eligió un color, y siguen las capas protectoras con un pulido (screening) entre cada una. Las tablas dañadas más allá de lo que el lijado puede corregir son trabajo de reemplazo y se cotizan aparte.",
    included: [
      "Muebles movidos según se necesite y áreas cercanas protegidas",
      "Tablas sueltas fijadas y el piso revisado antes de lijar",
      "Lijado progresivo para quitar el acabado viejo y nivelar la superficie",
      "Agujeros de clavos y rendijas rellenados antes de la pasada final",
      "Tinte aplicado de manera uniforme donde se eligió un color",
      "Capas protectoras de acabado con pulido entre cada una",
    ],
    steps: PREP_APPLY_FINISH,
  },
  flooring_install: { steps: MEASURE_SUPPLY_INSTALL },
  countertop: {
    description:
      "Tomamos la plantilla de sus gabinetes en el sitio, fabricamos la encimera en el material cotizado arriba según esas medidas, retiramos y desechamos la encimera existente, e instalamos, nivelamos y unimos la nueva. Los cortes y el perfil de canto indicados arriba son lo que se fabrica — lo que no está indicado no se corta. Desconectar y volver a conectar la plomería, la electricidad y el gas es un trabajo aparte y aparece arriba solo si usted lo pidió.",
    included: [
      "Material suministrado según la especificación indicada arriba",
      "Plantilla tomada en el sitio para que el ajuste sea a sus gabinetes reales",
      "Encimera existente retirada y desechada",
      "Fabricación con el perfil de canto y los cortes indicados",
      "Instalación, nivelación y unión de juntas",
      "Juntas, uniones y perímetro sellados",
    ],
    steps: MEASURE_SUPPLY_INSTALL,
  },
  tiling: { steps: MEASURE_SUPPLY_INSTALL },
  drywall: { steps: SHELL_SEQUENCE },
  drywall_install: { steps: SHELL_SEQUENCE },

  // ── Mecánica y electricidad ──────────────────────────────────────────────
  plumbing: { steps: ASSESS_REPAIR_TEST },
  electrical: { steps: ASSESS_REPAIR_TEST },
  hvac_install: { steps: MEASURE_SUPPLY_INSTALL },
  hvac_repair: { steps: ASSESS_REPAIR_TEST },
  appliance_repair: { steps: ASSESS_REPAIR_TEST },
  garage_door: {
    description:
      "Suministramos e instalamos la puerta o puertas cotizadas arriba, con los rieles, resortes, cables y herrajes sobre los que funcionan, y la puerta se balancea y se prueba abriéndola y cerrándola con el motor antes de irnos. El revestimiento del marco (capping) y las molduras son líneas aparte y se incluyen solo donde usted los ve cotizados. El trabajo eléctrico, un abridor nuevo, y cualquier cambio al tamaño o a la estructura de la abertura son trabajos aparte y no se incluyen salvo que una línea de arriba lo indique.",
    steps: ASSESS_REPAIR_TEST,
  },
  locksmith: { steps: ASSESS_REPAIR_TEST },
  well_water: { steps: ASSESS_REPAIR_TEST },
  elevator_services: { steps: ASSESS_REPAIR_TEST },
  mechanical_contracting: { steps: ASSESS_REPAIR_TEST },
  installation_services: { steps: MEASURE_SUPPLY_INSTALL },

  // ── Estructura y envolvente ──────────────────────────────────────────────
  roofing_service: {
    description:
      "Retiramos la cubierta existente del techo hasta el entablado, inspeccionamos las tablas de abajo, y construimos un techo nuevo sobre ellas: membrana base (underlayment), tapajuntas (flashing) en cada pared, chimenea, limahoya y ventila, la cubierta cotizada arriba, y la ventilación de cumbrera y de entrada que el techo necesita para secarse. El material retirado se saca del sitio y se barre el terreno en busca de clavos antes de irnos. Lo que se cotiza aquí es la superficie del techo indicada arriba — sofito, fascia, canaletas, aislamiento y reparaciones estructurales son trabajos aparte y aparecen solo donde usted los ve cotizados.",
    included: [
      "Material existente retirado y sacado del sitio",
      "Entablado inspeccionado y cualquier sección dañada reportada antes de reemplazarla",
      "Membrana base, tapajuntas y ventilación según se requiera",
      "Techo nuevo instalado según las especificaciones del fabricante",
      "Terreno limpio y barrido de clavos y escombros",
    ],
    steps: MEASURE_SUPPLY_INSTALL,
    mayChange: [
      {
        title: "Más capas de las esperadas",
        body: "Esta cotización se basa en las capas que pudimos ver o sondear. Una segunda o tercera capa debajo significa más tiempo de retiro y más desecho, y se lo diremos antes de continuar.",
      },
      {
        title: "El estado del entablado",
        body: "Las tablas debajo del techo viejo no se pueden inspeccionar hasta retirarlo. El entablado en buen estado se cubre como se cotizó; las secciones podridas se reemplazan a la tarifa por hoja de esta cotización, contadas y mostradas a usted.",
      },
      {
        title: "El clima",
        body: "Un techo abierto no se deja abierto durante la noche. Una semana de lluvia mueve la fecha de terminación y nada más — el precio no cambia porque llovió.",
      },
    ],
    glossary: [
      {
        term: "Cuadro (square)",
        body: "100 pies cuadrados de superficie de techo. La unidad en la que todo el oficio pide material y cotiza — un techo de 2,400 sq ft son 24 cuadros.",
      },
      {
        term: "Pendiente (pitch)",
        body: "La inclinación, expresada como la elevación sobre un avance de 12 pulgadas. Un techo que sube 6 pulgadas por cada 12 de avance es «6/12». Un techo inclinado tiene más superficie que el terreno que cubre, y uno más empinado es más lento de trabajar.",
      },
      {
        term: "Entablado (sheathing)",
        body: "Los paneles estructurales sobre las vigas a los que se fija todo lo demás. Su estado no se puede conocer hasta que se retira la cubierta vieja.",
      },
      {
        term: "Retiro de la cubierta (tear-off)",
        body: "Quitar la cubierta existente. Las capas cotizadas aquí se indican en la cotización; cualquier capa adicional es mano de obra y desecho adicionales.",
      },
      {
        term: "Membrana base (underlayment)",
        body: "La membrana que se coloca sobre el entablado antes de la cubierta. Es la capa que impide que entre el agua cuando el viento la empuja por debajo de una teja.",
      },
    ],
  },
  gutter_services: {
    description: GUTTER_WORK_VARIANTS.cleaning,
    variantLabel: "el tipo de trabajo en canaletas",
    variants: GUTTER_WORK_VARIANTS,
    included: [
      "Canaletas limpiadas a mano y la basura retirada, no soplada hacia el terreno",
      "Cada bajante enjuagada con agua y su drenaje comprobado",
      "Tramos, soportes y uniones inspeccionados mientras están vacíos",
      "Sellado menor donde una unión o junta lo necesite",
      "Todo lo que requiera más que un sellado se le informa con fotografías antes de hacerlo",
    ],
    steps: [
      {
        title: "Limpiar las canaletas",
        body: "Cada tramo limpiado a mano de hojas, arenilla y basura acumulada, y la basura retirada en lugar de empujarla hacia las bajantes o dejarla en el terreno.",
      },
      {
        title: "Enjuagar las bajantes",
        body: "Cada bajante se enjuaga con agua y se observa, para confirmar que lo que sale de la canaleta llega al suelo. Una canaleta limpia sobre una bajante tapada se sigue desbordando.",
      },
      {
        title: "Inspeccionar y sellar",
        body: "Con los tramos vacíos revisamos los soportes, las uniones, las juntas y la fascia detrás de ellos en busca de piezas flojas, daños y fugas, y sellamos las fallas menores que encontremos. Todo lo que sea mayor se le informa antes de hacerlo, no se agrega a la factura.",
      },
      {
        title: "Protector de canaletas — opcional",
        body: "Cuando figura en esta cotización, se instala protector de canaletas de aluminio Smart Screen sobre los tramos limpios. Solo aparece arriba cuando realmente se vendió; un protector instalado sobre una canaleta sucia atrapa la basura debajo.",
      },
      {
        title: "Entrega",
        body: "La instalación del protector tiene una garantía de [período de garantía] que cubre [lo que cubre]. Las canaletas quedan drenando y el área de trabajo despejada.",
      },
    ],
    mayChange: [
      {
        title: "Cómo se ven los tramos una vez vacíos",
        body: "Un soporte flojo, una unión rajada o fascia podrida detrás de la canaleta no se ven a través de una canaleta llena. El sellado menor está incluido en el precio de arriba; cualquier problema estructural se le informa con fotografías y se cotiza aparte antes de hacer cualquier parte.",
      },
      {
        title: "Cómo se llega al techo",
        body: "Un tramo que requiere andamio, un separador de escalera sobre un solárium, o una segunda persona por seguridad toma más tiempo que uno al que se llega con una escalera sobre terreno plano.",
      },
      {
        title: "Cuántas bajantes necesita realmente el tramo",
        body: "Las bajantes de esta cotización son las que la casa tiene ahora. Un tramo que antes drenaba poco seguirá drenando poco con metal nuevo, así que donde creemos que hace falta otra salida se lo decimos y la cotizamos aparte en lugar de suponer que usted la quiere.",
      },
    ],
    glossary: [
      {
        term: "Bajante",
        body: "El tubo vertical que lleva el agua de la canaleta al suelo. Limpiar la canaleta sin comprobar que la bajante drena resuelve solo la mitad del problema.",
      },
      {
        term: "Soporte (gancho)",
        body: "La pieza que sujeta la canaleta a la fascia. Uno flojo deja que el tramo se hunda, y un tramo hundido acumula agua en lugar de desalojarla.",
      },
      {
        term: "Fascia (tabla frontal)",
        body: "La tabla detrás de la canaleta donde se atornillan los soportes. El trabajo en canaletas se detiene donde empieza la fascia podrida, porque nada se sostiene en madera blanda — por eso una cotización de reemplazo solo puede estar segura del estado de la fascia una vez que se retira el tramo viejo.",
      },
      {
        term: "Canaleta sin uniones (seamless)",
        body: "Canaleta formada en el sitio a partir de una sola bobina continua al largo exacto de su tramo, de modo que las únicas juntas están en las esquinas y las salidas. La canaleta por secciones se une cada pocos pies, y cada unión es un lugar que con el tiempo puede gotear.",
      },
      {
        term: "Cinco y seis pulgadas",
        body: "El ancho de la canaleta. Una canaleta de seis pulgadas con una salida más grande lleva bastante más agua que una de cinco, que es lo que necesita un techo grande, un techo empinado, o una limahoya que descarga en una sola esquina.",
      },
      {
        term: "Protector de micromalla",
        body: "Una malla fina que detiene la arenilla de las tejas, las semillas y las agujas de pino además de las hojas. Una malla básica detiene las hojas y deja pasar la basura pequeña, que es la diferencia que describen los dos precios.",
      },
      {
        term: "Protector de canaletas",
        body: "Una malla sobre la canaleta que impide la entrada de hojas y deja pasar el agua. Reduce la limpieza; no la elimina, y tiene que instalarse sobre una canaleta limpia.",
      },
      {
        term: "Cargo mínimo de servicio",
        body: "Llegar a un tramo corto cuesta casi lo mismo que a uno largo — el mismo camión, las mismas escaleras, el mismo viaje. Por eso las visitas pequeñas se cobran con un mínimo en lugar de por pie, y cuando eso aplica la cotización muestra el complemento en una línea propia en lugar de inflar la tarifa sin decirlo.",
      },
    ],
  },

  siding: {
    description:
      "Retiramos el revestimiento existente de las paredes cotizadas arriba, revisamos el entablado detrás y reparamos las secciones que esta cotización contempla, luego instalamos una barrera contra la intemperie y el revestimiento nuevo indicado arriba, con molduras en las esquinas, las ventanas y las puertas. Solo se revisten de nuevo las paredes cotizadas arriba. Sofito, fascia, canaletas, ventanas y aislamiento son líneas aparte y se incluyen solo donde usted los ve cotizados.",
    steps: MEASURE_SUPPLY_INSTALL,
  },

  insulation: {
    description:
      "Aislamos las áreas cotizadas arriba al valor R que indica esta cotización. Primero se sellan las fugas de aire — soleras superiores, penetraciones y la escotilla — porque el aislamiento frena el calor pero no detiene una corriente de aire; luego el material se instala al espesor que requiere ese valor R, manteniendo abierta la vía de ventilación donde el sistema la tiene. El material existente se queda en su lugar salvo que una línea de arriba diga que se retira, y el espesor realmente instalado se registra y se marca para que pueda verificarse después.",
    included: [
      "Condiciones existentes y espesor registrados antes de cubrir cualquier cosa",
      "Fugas de aire selladas en soleras superiores, penetraciones y la escotilla",
      "Vía de ventilación mantenida abierta donde el sistema la necesita",
      "Material instalado al espesor que requiere el valor R indicado",
      "Marcadores de espesor dejados en su lugar y el área de trabajo despejada",
    ],
    steps: [
      {
        title: "Revisión del proyecto",
        body: "Revisamos los planos o recorremos el espacio y acordamos exactamente qué áreas se aíslan — sótano, vigas perimetrales, techo del garaje, ático.",
        timeline: "1–2 días",
      },
      {
        title: "Cotización",
        body: "Precio calculado según las áreas a cubrir, el material, y el espesor que cada sistema necesita para alcanzar su valor R.",
        timeline: "2–4 días",
      },
      {
        title: "Programación",
        body: "Se programa para empezar después de que la estructura y las instalaciones mecánicas y eléctricas preliminares estén terminadas e inspeccionadas. Aislar antes de esa inspección significa tener que volver a abrir.",
        timeline: "Según se necesite",
      },
      {
        title: "Preparación del sitio",
        body: "Áreas despejadas, y ventanas, accesorios y superficies terminadas cubiertos y protegidos.",
        timeline: "1–2 horas",
      },
      {
        title: "Aplicación",
        body: "Material instalado al espesor especificado, en varias pasadas donde el grosor lo requiere.",
        timeline: "1–3 días",
      },
      {
        title: "Recorte y limpieza",
        body: "Excedente recortado al ras de la estructura, material rociado de más limpiado, espesor registrado, y el área entregada lista para el siguiente oficio.",
        timeline: "El mismo día",
      },
    ],
    mayChange: [
      {
        title: "Lo que se encuentra al abrir el espacio",
        body: "El material mojado, compactado o contaminado tiene que retirarse antes de instalar algo, y el cableado antiguo de perilla y tubo o un extractor de baño que ventila hacia el ático tienen que resolverse primero. Nada de eso se ve desde la escotilla.",
      },
      {
        title: "El espesor que la cavidad realmente admite",
        body: "Una cavidad cerrada admite lo que admite. Donde el espacio no puede alcanzar el valor R objetivo con el material cotizado, se lo diremos y le daremos las opciones en lugar de instalar menos sin decirlo.",
      },
    ],
    glossary: [
      {
        term: "Valor R",
        body: "Qué tan bien resiste el sistema el paso del calor — más alto es mejor. Es lo que piden tanto un programa de reembolsos como un inspector de construcción, y es la razón del espesor que figura en esta cotización.",
      },
      {
        term: "R por pulgada",
        body: "Cuánto R aporta cada pulgada de un material. Por eso dos materiales que alcanzan el mismo valor R tienen espesores distintos, y por eso uno de ellos puede no caber.",
      },
      {
        term: "Sellado de aire",
        body: "Cerrar las rendijas por donde realmente se mueve el aire antes de cubrirlas. El aislamiento frena el calor; no detiene una corriente de aire, y soplar aislamiento sobre un ático sin sellar es la razón más común por la que un trabajo rinde menos de lo esperado.",
      },
      {
        term: "Deflector (baffle)",
        body: "Un canal que mantiene abierta la vía desde la ventila del sofito hasta el ático una vez instalado el aislamiento. Sin ellos las ventilas se tapan y el entablado del techo deja de secarse.",
      },
    ],
  },
  masonry: { steps: MEASURE_SUPPLY_INSTALL },
  concrete: { steps: MEASURE_SUPPLY_INSTALL },
  paving: {
    description:
      "Excavamos el área cotizada arriba, colocamos tela de separación (geotextil), y construimos una base granular compactada por capas; luego colocamos las piezas indicadas arriba en el patrón acordado, a escuadra con la casa y rematadas con una hilera de borde. Los bordes se confinan, las juntas se rellenan y se compactan, y la superficie queda con pendiente hacia afuera del edificio. El terreno alterado alrededor del trabajo se nivela y se deja en buen estado. La reubicación de servicios públicos, el drenaje fuera del área de trabajo y los permisos son aparte.",
    steps: MEASURE_SUPPLY_INSTALL,
  },
  driveway_sealing: {
    description:
      "Barremos y soplamos la superficie hasta dejarla limpia, tratamos las manchas de aceite y grasa para que el sellador se adhiera, protegemos los bordes, y aplicamos sellador en el área de la entrada de autos cotizada arriba con el número de capas que indica esta cotización. El sellado es mantenimiento sobre una superficie en buen estado: frena el daño del agua y del sol. No repara asfalto que ya se ha desmoronado, y no oculta grietas ni parches existentes — el relleno de grietas es una línea aparte y se incluye solo donde usted lo ve cotizado.",
    steps: PREP_APPLY_FINISH,
  },
  fence_services: { steps: MEASURE_SUPPLY_INSTALL },
  chimney_sweep: { steps: VISIT_SERVICE_VERIFY },
  restoration: { steps: ASSESS_REPAIR_TEST },
  excavation: { steps: PLAN_BUILD_HANDOVER },
  demolition: { steps: PLAN_BUILD_HANDOVER },
  demolition_contractor: { steps: PLAN_BUILD_HANDOVER },

  home_inspection: {
    description:
      "Inspeccionamos las áreas y los sistemas de fácil acceso de la propiedad y le entregamos un informe escrito, con fotografías, de lo que encontramos y lo que significa. La inspección es visual y no invasiva: no se desarma nada, no se abre ninguna superficie terminada y no se mueven las pertenencias guardadas — así que un defecto oculto detrás de ellas es un defecto que no podemos reportar. Las pruebas de radón, calidad del aire, aparatos de combustión de leña, pozo y sistema séptico son servicios aparte y se realizan solo donde usted los ve cotizados arriba.",
    included: [
      "Una inspección visual de las áreas de fácil acceso de la propiedad",
      "Techo, revestimiento exterior, nivelación del terreno y drenaje hasta donde se puedan alcanzar con seguridad",
      "Estructura, cimentación, y el sótano o el espacio bajo el piso donde se pueda entrar",
      "Sistemas de calefacción, aire acondicionado, plomería y electricidad operados con sus controles normales",
      "Acabados interiores, ventanas, puertas, aislamiento y ventilación del ático",
      "Un informe escrito con fotografías de los hallazgos importantes",
      "Tiempo en el sitio al final para explicarle lo que se encontró",
    ],
    steps: INSPECT_REPORT_REVIEW,
  },

  // ── Proyectos completos ──────────────────────────────────────────────────
  general_contracting: { steps: SHELL_SEQUENCE },
  general_contracting_reno: { steps: PLAN_BUILD_HANDOVER },
  construction: { steps: SHELL_SEQUENCE },
  remodeling: { steps: PLAN_BUILD_HANDOVER },
  carpentry: { steps: MEASURE_SUPPLY_INSTALL },
  handyman: { steps: VISIT_SERVICE_VERIFY },
  property_maintenance: { steps: VISIT_SERVICE_VERIFY },

  // ── Limpieza ─────────────────────────────────────────────────────────────
  residential_cleaning: {
    included: [
      "Todos los productos y el equipo de limpieza los ponemos nosotros",
      "Cada habitación y superficie indicada arriba",
      "Accesorios, grifería y puntos de contacto frecuente limpiados",
      "Basura retirada y bolsas de los botes repuestas",
    ],
    steps: VISIT_SERVICE_VERIFY,
  },
  deep_cleaning: { steps: VISIT_SERVICE_VERIFY },
  commercial_cleaning: { steps: VISIT_SERVICE_VERIFY },
  janitorial: { steps: VISIT_SERVICE_VERIFY },
  carpet_cleaning: { steps: VISIT_SERVICE_VERIFY },
  window_cleaning: { steps: VISIT_SERVICE_VERIFY },
  pressure_washing_house: { steps: VISIT_SERVICE_VERIFY },
  pressure_washing_driveway: { steps: VISIT_SERVICE_VERIFY },
  auto_detailing: { steps: VISIT_SERVICE_VERIFY },
  junk_removal: { steps: VISIT_SERVICE_VERIFY },

  // ── Exteriores y jardín ──────────────────────────────────────────────────
  landscaping_design: { steps: PLAN_BUILD_HANDOVER },
  lawn_care: { steps: VISIT_SERVICE_VERIFY },
  lawn_mowing: { steps: VISIT_SERVICE_VERIFY },
  irrigation: { steps: MEASURE_SUPPLY_INSTALL },
  tree_care_service: { steps: VISIT_SERVICE_VERIFY },
  snow_removal: {
    description:
      "Despejamos las áreas cotizadas arriba según el plan que indica esta cotización, durante la temporada que cubre. Antes de la nieve se colocan marcadores para que los bordes del césped y los jardines se vean y se eviten. Los pasillos peatonales, los escalones y la aplicación de sal son líneas aparte y se despejan o se tratan solo donde usted los ve cotizados. No se incluyen techos, balcones ni cualquier cosa que se deje en el área a despejar y quede enterrada sin verse.",
    steps: VISIT_SERVICE_VERIFY,
  },
  pest_control: { steps: VISIT_SERVICE_VERIFY },
  pool_spa: { steps: VISIT_SERVICE_VERIFY },
  dog_walking: { steps: VISIT_SERVICE_VERIFY },
  pooper_scooper: { steps: VISIT_SERVICE_VERIFY },
};
