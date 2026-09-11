// docs/sales/guide/content.es.js
//
// The words of the FieldQuo sales reference guide, in Latin American Spanish.
//
// ══ Which Spanish, and why it matters more than usual ═════════════════════
//
// The reader is a rep selling to a contractor in Houston, Toronto or Monterrey,
// and the fastest way to lose that call in the first minute is a word from the
// wrong continent. So this is Latin American / US job-site Spanish, not
// Peninsular, and it is in the trade register:
//
//   cotización     not presupuesto — what a US Latino contractor says out loud
//   estimado       the visit and the free number, kept distinct from cotización
//   cuadrilla      not equipo      — the crew, in one word every trade knows
//   dueño de casa  not propietario — the homeowner, as a contractor names them
//   costos         not costes      — "costes" is the giveaway of Spain Spanish
//   cuantificación the takeoff
//   prospecto      the lead
//   canaletas      not canalones   — gutters
//   alero / borde de faldón / cumbrera / limatesa / limahoya — the five linear
//                  details on a roof, which a techador will check you on
//
// ── One divergence, flagged rather than hidden ────────────────────────────
//
// app/i18n/featurePages/es.js, the shipped marketing Spanish, uses
// "presupuesto" for a quote and "control de costes" for job costing. This file
// deliberately does not follow it: that catalogue is a draft still waiting on a
// native speaker (see app/i18n/featurePages/index.js), "costes" is Peninsular,
// and the brief for this guide is North American Spanish. Someone has to
// arbitrate which wins; until then the two differ and this comment is the
// record of why.
//
// ══ Not translated, deliberately ══════════════════════════════════════════
//
// FieldQuo, Stripe, Jobber, Housecall Pro, Marketing Designer (a screen that
// ships in English), and e-transfer — a proper noun in Canada, said in English
// inside a Spanish sentence.
//
// ══ What this file cannot reach ═══════════════════════════════════════════
//
// The builder takes feature names, summaries, group headings and every PARTIAL
// feature's "what it does not do" sentence from lib/marketing/featureMatrix.js,
// which is English-only. Those render in English in this edition. That is not
// an oversight to fix here: the limits sentences are legally load-bearing, and
// a mistranslated limit is worse than an English one. Spanish versions of all
// ten already exist in app/i18n/featurePages/es.js if the builder is ever
// taught to read them.
//
// ══ The one rule for whoever edits this ═══════════════════════════════════
//
// The `key` fields in `glossary` and the `keys` arrays in DEEP_DIVES are
// featureMatrix keys, not words. Translating one does not break the build — it
// silently drops a chip or a cross-reference. Leave them exactly as they are.
export const GUIDE = {
  lang: "es",
  dir: "ltr",
  title: "FieldQuo — la referencia de ventas",
  subtitle: "Qué vendemos, qué hace, y dónde están los límites.",
  generated: "Generado",
  // Plantilla en vez de concatenar en el generador: el conteo no cae en el
  // mismo lugar de la frase en cada idioma.
  coverMeta: "Generado el {date} · {features} funciones",
  intro: {
    heading: "Cómo usar esto",
    body: [
      "Esta es la referencia que está detrás del guion. El playbook le dice qué decir; esto le dice qué es cierto, para que cuando un contratista haga la pregunta que usted no esperaba, la pueda contestar sin adivinar.",
      "Cada función de esta lista sale de la matriz de funciones del propio producto, que nombra los archivos que tienen que existir para cada una. Si una función está en este documento, está en el producto. Si algo no está aquí, no lo prometa.",
      "Cada función está descrita tal como funciona hoy. Cuando algo es más nuevo que el resto, la sección detallada lo dice. Si un contratista pide algo que usted no encuentra en este documento, diga que lo va a verificar en vez de adivinar — el contratista que compra por una promesa que usted no pudo cumplir cancela al segundo mes y le cuenta a todo el mundo por qué.",
      "Una regla sobre lo que le entregan: los prospectos de Quebec solo van a representantes que marcaron francés en «Idiomas en los que puedo vender», en la pestaña Pago. Si un contratista de Quebec está en su pantalla, es por eso — atienda la llamada en francés.",
    ],
  },
  pitchHeading: "Lo único con lo que hay que abrir",
  pitch: [
    "Todas las funciones de este documento están en todos los planes. Todas. Los planes se diferencian por cuánta gente puede usarlas, y en nada más.",
    "Ese es el argumento de venta. El contratista que nos compara con Jobber o Housecall Pro está acostumbrado a una tabla donde lo que de verdad necesita queda dos niveles más arriba. Aquí no hay ningún nivel al que subir: el plan más barato es el producto completo para una persona, y pagar más solo agrega puestos.",
  ],
  plansHeading: "Los planes, y lo que de verdad cambia",
  plansIntro: "Cuatro planes. Las únicas diferencias son los puestos, los accesos de cuadrilla y el precio.",
  planCols: { plan: "Plan", price: "Al mes", seats: "Puestos completos", crew: "Accesos de cuadrilla" },
  planNote:
    "Un puesto completo es alguien que crea y modifica cotizaciones, trabajos y facturas. Un acceso de cuadrilla es alguien que marca entrada, ve su agenda y sube fotos — no cuesta nada y no ocupa un puesto.",
  deepHeading: "Las partes sobre las que le van a preguntar",
  deepIntro:
    "En el orden en que corre el día de un contratista, no en el orden en que está construido el software. Cada una nombra las funciones que tiene detrás, para que las pueda buscar en la tabla de referencia.",
  referenceHeading: "Todas las funciones, por parte del negocio",
  referenceIntro:
    "Todo, agrupado por la parte del negocio a la que sirve. Cada fila lleva el nombre de la función y su descripción en una línea — las mismas palabras que usa el sitio público.",
  partialHeading: "Dónde están los límites — lea esto antes de su primera llamada",
  partialIntro:
    "Diez funciones hacen menos de lo que su nombre sugiere. La redacción de abajo es la del propio producto, no una versión suavizada. Dígala tal cual en la llamada y nunca lo van a agarrar en falta; mencione solo el nombre de la función y sí lo van a agarrar.",
  gapsHeading: "Dos cosas que entregamos y no anunciamos",
  gapsIntro:
    "Encontradas mientras se escribía esta guía: las dos están en el producto y ninguna está en la matriz de funciones, así que ninguna aparece en las páginas públicas de comparación. Menciónelas, pero diga claramente que son más nuevas que el resto de este documento.",
  glossaryHeading: "Glosario",
  glossaryIntro: "Las palabras que un contratista tal vez no conozca, y las que nosotros usamos distinto de nuestros competidores.",
  contentsHeading: "Contenido",
  backToContents: "Volver al contenido",
  limitLabel: "Lo que no hace",
  limitInEnglish: "original en inglés",
  seeAlso: "Ver",
  partialBadge: "PARCIAL",
  shippedBadge: "ACTIVO",
  gaps: [
    {
      title: "La lectura de fotos con IA",
      body:
        "Una lectura a fondo de las fotos adjuntas a una cotización, cobrada por uso contra el crédito de IA de la empresa. Es la razón por la que un contratista puede mandar cinco fotos de un techo y recibir algo útil sobre el techo, y no la descripción de una imagen. No está en la matriz de funciones, así que no aparece en las páginas públicas de comparación.",
    },
    {
      title: "El Marketing Designer",
      body:
        "Arte para anuncios y redes sociales hecho dentro de FieldQuo, organizado por campaña, con los colores de la empresa y sus propias fotos de trabajos. Al contratista que lleva tiempo pagándole a alguien para que le haga las publicaciones de Facebook le va a importar esta. También falta en la matriz.",
    },
  ],
  glossary: [
    { term: "Acceso de cuadrilla", def: "Alguien que marca entrada, ve su agenda y sube fotos. Gratis, y no ocupa un puesto.", key: "crew_shifts" },
    { term: "Bandeja de la cuadrilla", def: "Mensajes de texto con los trabajadores que no tienen acceso y no van a instalar una aplicación. Mandan un texto a un número; llega a la oficina, archivado con su nombre.", key: "crew_inbox" },
    { term: "Control de costos", def: "Lo cotizado contra lo real, después del trabajo — para que los precios del año que viene se armen sobre lo que de verdad pasó.", key: "job_costing" },
    { term: "Cuantificación", def: "El formulario propio del oficio que convierte medidas en una cotización con precio — cuadros de techo, pies lineales de canaleta, puertas y cajones.", key: "quotes" },
    { term: "Estimado instantáneo", def: "Un precio que el dueño de casa se saca solo en el sitio web del contratista, con las tarifas del contratista. Nunca con las nuestras.", key: "instant_quotes" },
    { term: "Extra", def: "Un adicional que el cliente puede aceptar en la cotización misma, con el precio calculado por el servidor y nunca por el navegador. El dueño de casa lo marca; el total se actualiza.", key: "add_on_upsell" },
    { term: "Lectura profunda de fotos", def: "La lectura de fotos pagada. Distinta de la revisión gratuita, que también mira las fotos pero no cobra." },
    { term: "Lista de precios", def: "Las tarifas del propio contratista para mano de obra, materiales y servicios. Todo lo que lleva precio en FieldQuo sale de ahí.", key: "price_book" },
    { term: "Marca blanca", def: "Cada documento que ve el dueño de casa lleva el nombre y los colores del contratista, no los nuestros. Es lo que pasa por defecto, no una mejora que se paga.", key: "white_label" },
    { term: "Precio de equilibrio", def: "El precio por debajo del cual un trabajo le hace perder dinero al contratista, sacado de sus propios gastos generales y su propia mano de obra, no de una regla de dedo.", key: "break_even" },
    { term: "Puesto", def: "Alguien que crea y modifica cotizaciones, trabajos y facturas. Los puestos son lo único en lo que se diferencian los planes.", key: "team_access" },
  ],
};


/**
 * Las secciones a fondo, en el orden en que corre el día de un contratista.
 *
 * `keys` son claves de featureMatrix, no palabras. El builder resuelve cada una
 * a su nombre real, su resumen y sus límites, así que un párrafo de aquí nunca
 * puede afirmar algo que la matriz no sostiene. Traducir una clave no rompe la
 * compilación: hace desaparecer una etiqueta en silencio. No se tocan.
 */
export const DEEP_DIVES = [
  {
    id: "quoting",
    title: "Cotizar, y la versión de sesenta segundos",
    keys: ["quotes", "quote_pdf", "quote_send", "instant_quotes", "self_quote", "call_to_quote", "aerial_measure"],
    body: [
      "La cotización es el producto. Todo lo demás existe porque el contratista que cotiza más rápido gana más trabajo, y la mayoría está cotizando a las nueve de la noche en una laptop, después de un día completo en la obra.",
      "Hay tres maneras de que salga un precio. El estimador arma una desde la lista de precios, en la tableta, parado en la entrada de la casa. El dueño de casa se arma una solo, con el estimado instantáneo en el sitio web del contratista. O la recepcionista con IA contesta la llamada y redacta una con lo que se habló.",
      "La promesa de los sesenta segundos es la segunda, y vale la pena ser preciso sobre qué es lo que hace el trabajo: el formulario de cuantificación del oficio hace las cuentas, la lista de precios pone las tarifas, y en techado el techo se mide desde el cielo en lugar de escribirse a mano. El contratista escoge opciones; no calcula.",
      "Techado es la que hay que demostrar. Escriba la dirección y regresan la superficie, la pendiente y los detalles lineales — aleros, bordes de faldón, cumbrera, limatesas y limahoyas — medidos por satélite. Nadie se sube a una escalera para producir el primer número.",
    ],
  },
  {
    id: "getting-paid-to-quote",
    title: "Cobrar por ir a ver el trabajo",
    keys: ["booking_page", "booking_deposit"],
    body: [
      "Los contratistas que cobran el estimado casi siempre lo hacen porque los quemaron los curiosos que piden precios y nunca contratan. Le van a preguntar si el software puede cobrar ese dinero antes de la visita. Sí puede.",
      "La página de reservas toma la cita y el depósito en el mismo paso, así que el horario queda apartado solo cuando la tarjeta ya pasó. Para una empresa que cobra la visita o la evaluación, esa tarifa es el depósito.",
      "Vale decirlo en la llamada: es la misma página de reservas que usa el dueño de casa para agendar cualquier visita, así que el contratista que no cobra simplemente deja el depósito apagado. Es una sola pantalla con el dinero prendido o apagado, no un producto aparte.",
    ],
  },
  {
    id: "cost-and-margin",
    title: "El costo, la mano de obra y el margen que al contratista de verdad le queda",
    keys: ["job_costing", "break_even", "price_book", "material_costs", "benchmark", "expenses"],
    body: [
      "Esta es la parte que nos separa de una app de cotizar, y es la parte que la mayoría de los contratistas nunca ha tenido. Una pantalla de cotización muestra el precio. Esta muestra lo que cuesta hacer el trabajo y lo que queda.",
      "Los materiales salen de las recetas, la mano de obra de las horas a la tarifa que de verdad pagan, y los gastos generales de lo que ellos mismos nos dijeron que gastan. El margen en pantalla es el de ellos, no un porcentaje que alguien adivinó.",
      "El punto de equilibrio es el que pega. Contesta la pregunta que un contratista nunca ha podido contestar: por debajo de qué precio este trabajo me hace perder dinero. El vendedor que puede mostrar ese número ya no está vendiendo software.",
      "El control de costos cierra después el círculo, cuando la obra terminó — lo cotizado contra lo real — para que la lista de precios del año que viene se arme con lo que pasó y no con lo que se esperaba.",
    ],
  },
  {
    id: "ai-review",
    title: "La revisión con IA, y la lectura de las fotos",
    keys: ["ai_quote_review", "add_on_upsell", "ai_copilot"],
    body: [
      "Antes de que salga una cotización, la IA la lee y dice qué falta, qué quedó con un precio raro comparado con el historial del propio contratista, y qué extras suele necesitar este tipo de trabajo.",
      "Dos cosas hay que cuidar aquí, porque es donde va a apretar un contratista desconfiado. Compara contra SU historial, nunca contra el de otra empresa — sus números nunca salen de su cuenta. Y sugiere: nunca edita la cotización ni manda nada.",
      "También hay una lectura de fotos pagada, más a fondo, sobre las fotos adjuntas a una cotización. Consume crédito de IA cada vez que se corre, y por eso es un botón y no algo que se dispara solo con cada foto.",
    ],
  },
  {
    id: "approval-to-invoice",
    title: "La aprobación, la firma, y la factura que se hace sola",
    keys: ["online_approval", "invoices", "invoice_send", "invoice_changes", "client_portal"],
    body: [
      "El dueño de casa abre la cotización en su teléfono, la aprueba y la firma ahí mismo. Sin imprimir, sin escanear, sin una cita para ir a recoger una firma.",
      "La factura después es el espejo de la cotización en lugar de rehacerse: las mismas líneas, el mismo formato, la misma marca. Ese espejo es a propósito y vale la pena nombrarlo, porque la falla común en esta categoría es una factura que en silencio no coincide con la cotización que el cliente firmó.",
      "Una factura modificada conserva su historial, así que el contratista puede mostrar qué cambió y cuándo. En un trabajo en disputa, ese historial es todo el argumento.",
    ],
  },
  {
    id: "payments",
    title: "Cobrar el dinero",
    keys: ["card_payments", "stripe_connect", "financing", "sales_tax", "service_plans"],
    body: [
      "El pago con tarjeta pasa por Stripe y cae en la cuenta de depósito del PROPIO contratista. FieldQuo nunca retiene su dinero — conviene decirlo temprano, porque a los contratistas ya los quemaron plataformas que se paran en medio.",
      "El efectivo, el cheque y el e-transfer se registran a mano contra la factura, para que la cifra pagada coincida con la realidad, haya hecho lo que haya hecho el dueño de casa.",
      "El impuesto de ventas se calcula desde la dirección del trabajo y no la de la empresa, lo cual importa a cualquiera que trabaje cruzando un límite.",
      "El financiamiento es el que hay que decir con cuidado — lea sus límites en la última sección antes de ofrecerlo en una llamada.",
    ],
  },
  {
    id: "doing-the-work",
    title: "De la factura a la cuadrilla: agenda, despacho y el día en sí",
    keys: ["jobs", "scheduling", "crew_shifts", "time_clock", "timesheets", "job_photos", "crew_inbox", "recurring_jobs"],
    body: [
      "Una cotización aprobada se vuelve trabajo, el trabajo se agenda y se despacha, y la cuadrilla ve dónde estar y qué hacer.",
      "La cuadrilla marca entrada y salida, y esas horas son con las que se arman las hojas de horas, el costo del trabajo y la paga — un solo registro de horas, no tres.",
      "La bandeja de la cuadrilla son mensajes de texto para la gente que no tiene acceso y no va a instalar una aplicación. Un trabajador manda un texto a un número y llega a la oficina, archivado con su nombre. Los contratistas que trabajan con subcontratistas o con cuadrillas de temporada lo entienden de inmediato.",
      "Las fotos de antes y después quedan pegadas al trabajo, y ahí es donde normalmente termina un pleito con el dueño de casa.",
    ],
  },
  {
    id: "the-phone",
    title: "El teléfono: la recepcionista con IA",
    keys: ["voice_receptionist", "voice_callbacks", "call_to_quote"],
    body: [
      "Un contratista arriba de un techo no contesta el teléfono, y una llamada perdida es un trabajo que se lo lleva el que sí contestó.",
      "La recepcionista contesta, toma los datos y agenda la visita. También puede llamar de vuelta para confirmar una cita.",
      "La demostración más fuerte es la llamada convertida en una cotización ya redactada — la solicitud llega con precio suficiente para que el contratista la mire, en lugar de llegar como un buzón de voz que hay que devolver.",
      "Dos datos que salen siempre: el contratista puede quedarse con el número que trae pintado en la camioneta y desviarle las llamadas perdidas, o tomar un número nuevo. Y se cobra por minuto de un saldo de créditos, así que un mes flojo casi no cuesta nada.",
    ],
  },
  {
    id: "marketing",
    title: "Que lo encuentren: el sitio web, los embudos y las campañas",
    keys: ["website_builder", "lead_form", "funnels", "email_campaigns", "review_requests", "testimonials", "bio_link", "embeds", "referrals"],
    body: [
      "La mayoría de los contratistas no tiene sitio web, o tiene uno que no puede editar. FieldQuo arma uno con lo que ya nos dijeron — sus oficios, sus servicios, sus fotos — y lleva el nombre de ellos, no el nuestro.",
      "Los embudos de prospectos son la versión pensada para el teléfono, hecha para los anuncios: unos cuantos toques, un prospecto calificado que entra al pipeline, ningún formulario que abandonar a medias.",
      "Las solicitudes de reseñas salen después del trabajo, que es cuando un cliente contento de verdad va a escribir una.",
      "También hay un Marketing Designer para el arte de anuncios y redes sociales: piezas hechas dentro de FieldQuo, organizadas por campaña, con los colores de la empresa y sus propias fotos de obra. El contratista que le paga a alguien para hacer sus publicaciones de Facebook se va a interesar. Es más nuevo que la mayor parte de este documento.",
    ],
  },
  {
    id: "languages",
    title: "Trabajar en más de un idioma",
    keys: ["languages", "white_label", "quote_email_wording", "contract_terms"],
    body: [
      "Son dos cosas distintas, y los vendedores las confunden. La primera es el idioma en el que trabaja el CONTRATISTA — la aplicación misma. La segunda es el idioma que lee el DUEÑO DE CASA — la cotización, la factura, los correos.",
      "La que vende es la segunda. Un contratista cuyos clientes hablan español puede mandar una cotización en español mientras él mismo trabaja en inglés.",
      "Una regla que hay que decir clarito, porque suena a limitación y en realidad es la parte que tranquiliza: un documento conserva el idioma en el que fue creado. Una cotización firmada siempre va a decir lo que decía cuando se firmó. Nada se vuelve a traducir a espaldas del cliente.",
      "Ocho idiomas para el cliente: inglés, francés, español, ucraniano, punyabí, tagalo, alemán e italiano. La cotización en PDF, la factura, el correo de envío y el portal del cliente siguen todos el idioma del cliente. El contratista lo elige una vez en la ficha del cliente y cada documento que sigue lo respeta.",
    ],
  },
];
