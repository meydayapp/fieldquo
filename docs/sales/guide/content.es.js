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
//   lead           not prospecto  — the portal's own tab is "Mis leads", and
//                                   the rule for the guide is the rep's word
//   celular        not móvil       — the phone in a contractor's pocket
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
      "Una regla sobre lo que le entregan: los leads de Quebec solo van a representantes que marcaron francés en «Idiomas en los que puedo vender», en la pestaña Pagos. Si un contratista de Quebec está en su pantalla, es por eso — atienda la llamada en francés.",
      "La primera mitad de este documento es el producto — lo que usted vende. La segunda, «Su consola», es el cuarto desde donde lo vende: el marcador, el lote, los mensajes de texto, el chat del equipo y su pago. Lea esa mitad el primer día; es lo que hace la pantalla que tiene enfrente.",
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
  consoleHeading: "Su consola — el cuarto desde donde vende",
  consoleIntro: [
    "Todo lo de arriba es lo que compra un contratista. Esto es en lo que usted trabaja. Cada sección dice qué muestra la pantalla y qué hace usted en ella, y nada más — cada frase se verificó contra el código en marcha y contra las pantallas renderizadas en docs/screens el día en que se armó este documento. Si la pantalla que tiene enfrente contradice una frase de aquí, la pantalla es más nueva; avísele al equipo en #sales.",
  ],
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
    { term: "Activada · Renovada · Sigue pagando", def: "Las tres etapas de su pago por un cliente — CA$20 cuando su cuenta de Stripe puede cobrar, CA$40 cuando llega a su siguiente ciclo de facturación, CA$65 cuando sigue suscrito sesenta días después de registrarse." },
    { term: "Bandeja de la cuadrilla", def: "Mensajes de texto con los trabajadores que no tienen acceso y no van a instalar una aplicación. Mandan un texto a un número; llega a la oficina, archivado con su nombre.", key: "crew_inbox" },
    { term: "Borrador de seguimiento", def: "Un texto que FieldQuo redacta por usted y deja en la conversación — al día 1 y al día 7 después de que una empresa se registra, y cerca de la marca de 60 días. Usted lo edita y pulsa Enviar. Nada lo manda por usted." },
    { term: "Celular", def: "El teléfono en el bolsillo del contratista. Ahí abre el dueño de casa la cotización, y ahí recibe el contratista su mensaje de texto." },
    { term: "Chips de zona", def: "Todos · ET · CT · MT · PT arriba de su lista. Elija uno y la lista, Siguiente y el marcado automático se quedan en ese huso horario." },
    { term: "Control de costos", def: "Lo cotizado contra lo real, después del trabajo — para que los precios del año que viene se armen sobre lo que de verdad pasó.", key: "job_costing" },
    { term: "Cuantificación", def: "El formulario propio del oficio que convierte medidas en una cotización con precio — cuadros de techo, pies lineales de canaleta, puertas y cajones.", key: "quotes" },
    { term: "Estado", def: "Lo que usted le dijo al portal que está haciendo — Disponible, Descanso, Comida, Reunión, Capacitación o Fuera. Una llamada entrante solo suena en los representantes Disponibles; los dos estados que el sistema pone solo son En llamada y Registrando el resultado." },
    { term: "Estimado instantáneo", def: "Un precio que el dueño de casa se saca solo en el sitio web del contratista, con las tarifas del contratista. Nunca con las nuestras.", key: "instant_quotes" },
    { term: "Extra", def: "Un adicional que el cliente puede aceptar en la cotización misma, con el precio calculado por el servidor y nunca por el navegador. El dueño de casa lo marca; el total se actualiza.", key: "add_on_upsell" },
    { term: "Lead", def: "Un contratista que queremos como cliente. Los que la cola le entrega y los que usted mismo capturó son leads los dos; la palabra «prospecto» no se usa." },
    { term: "Lectura profunda de fotos", def: "La lectura de fotos pagada. Distinta de la revisión gratuita, que también mira las fotos pero no cobra." },
    { term: "Lista de precios", def: "Las tarifas del propio contratista para mano de obra, materiales y servicios. Todo lo que lleva precio en FieldQuo sale de ahí.", key: "price_book" },
    { term: "Lote", def: "Los 25 leads que el servidor le entrega con una pulsación de Reservar los próximos 25 — solo leads cuya ventana de llamada está abierta en ese minuto. Se rellena solo cuando quedan menos de 5 por llamar." },
    { term: "Marca blanca", def: "Cada documento que ve el dueño de casa lleva el nombre y los colores del contratista, no los nuestros. Es lo que pasa por defecto, no una mejora que se paga.", key: "white_label" },
    { term: "Precio de equilibrio", def: "El precio por debajo del cual un trabajo le hace perder dinero al contratista, sacado de sus propios gastos generales y su propia mano de obra, no de una regla de dedo.", key: "break_even" },
    { term: "Puesto", def: "Alguien que crea y modifica cotizaciones, trabajos y facturas. Los puestos son lo único en lo que se diferencian los planes.", key: "team_access" },
    { term: "Resultado", def: "Lo que pasó en la llamada, elegido entre diez desenlaces, con el siguiente paso. Guardarlo termina «Registrando el resultado» y, con el marcado automático encendido, hace sonar el siguiente lead." },
    { term: "Ventana de llamada", def: "Las horas en que un negocio puede llamarse legalmente, en su propio huso horario, según la regla de su estado o provincia. La consola nunca muestra un botón de Llamar fuera de ella." },
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
      "Los embudos de leads son la versión pensada para el teléfono, hecha para los anuncios: unos cuantos toques, un lead calificado que entra al pipeline, ningún formulario que abandonar a medias.",
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


/**
 * Las herramientas del representante, en el orden de un turno: la consola
 * donde entra, el lote que le entrega, la llamada que regresa, el hilo de
 * textos, el equipo detrás, la regla de idioma, el buzón de voz y el pago.
 *
 * Sin `keys` — nada de esto está en la matriz de funciones, porque nada de
 * esto se vende. La prueba es la pantalla renderizada: `shot` nombra una
 * imagen bajo docs/screens, el componente real dibujado contra datos de
 * prueba, y el generador la inserta bajo la sección. Las capturas están en
 * inglés — es el portal tal como se renderizó — y las palabras de la
 * pantalla se citan aquí en el idioma del catálogo que se entrega
 * (app/i18n), para que un representante hispanohablante lea «Reservar los
 * próximos 25» aquí y en su pantalla.
 */
export const CONSOLE_SECTIONS = [
  {
    id: "queue-screen",
    title: "La consola: la lista a la izquierda, el lead en el centro, el teléfono bajo la mano",
    shot: "docs/screens/sales-console/desktop-idle.png",
    shotCaption: "La pantalla Cola: la barra lateral, el menú de estado, el Marcador a la izquierda, la tarjeta con pestañas y Guion abierto.",
    body: [
      "Cada pantalla de /sales tiene la misma barra lateral vertical a la izquierda: Hoy · Cola · Guion · Mis leads · Conversaciones · SMS · Equipo · Notas · Calendario · Mis empresas · Demo · Soporte · Buzón de voz · Pagos. SMS, Equipo y Buzón de voz llevan una insignia cuando algo espera. Al pie: «Llamadas hoy N / 250» — las llamadas que ha marcado desde que empezó su día, contra el tope del día. Se pliega a iconos si quiere el ancho.",
      "La barra de arriba tiene el cuadro de búsqueda y su estado. La píldora de estado dice qué está haciendo y desde cuándo — Disponible, En llamada, Registrando el resultado, Descanso… — y abre un menú de seis: Disponible · Descanso · Comida · Reunión · Capacitación · Fuera. En llamada y Registrando el resultado no están en el menú: pulsar Llamar pone el primero, y colgar pone el segundo, hasta que usted guarda el resultado. Póngase en Fuera cuando se vaya, porque una llamada de vuelta solo suena en los representantes Disponibles, y una laptop dejada en Disponible suena veinte segundos antes de que quien llama pase al siguiente.",
      "El Marcador está a la izquierda de la pantalla Cola y está armado como un teléfono: el número en letra grande, un teclado de 3 × 4, y Llamar debajo. La línea pequeña sobre la pantalla del número es la ventana de llamada del lead y de quién es la regla — «La franja cierra a las 9:00 PM · Regla de Oklahoma», o «Regla de FieldQuo» cuando el estado no impone ninguna. Bajo el botón de Llamar, cuando un estado limita cuántas veces puede llamarse al mismo negocio por el mismo asunto, una segunda línea lleva la cuenta: «1 de 3 llamadas en 24 h · Oklahoma». Fuera de la ventana no hay botón de Llamar, solo la razón y la hora en que abre; un botón gris que no hace nada es lo único que esta pantalla se niega a dibujar.",
      "Si el dueño le da otro número — su celular, casi siempre — escríbalo en el teclado. Llamar lo guarda primero en este lead y luego lo marca con las mismas comprobaciones que un número guardado — nunca es un número suelto, y un número en la lista de no-contactar se rechaza con la frase bajo la pantalla. Durante la llamada las mismas teclas mandan tonos, para un menú telefónico. El marcado automático es el interruptor bajo el botón: encendido, el siguiente lead suena cinco segundos después de que usted guarda el resultado, y la tarjeta se abre en Resultado en lugar de Guion.",
      "A la derecha hay una sola tarjeta alta con ocho pestañas: Empresa · Contacto · Guion · Investigación · Notas · Resultado · Tareas · Leads. Cada número en Empresa y Contacto tiene Marcar al lado. Guion es la llamada en pasos numerados, luego los Puntos clave y el Objetivo — la petición por la que existe esta llamada. Investigación son tres capas siempre en el mismo orden: los hechos, luego lo que creemos (siempre con un nivel de confianza), luego qué recomendar. Resultado son los diez desenlaces y el siguiente paso. Tareas guarda las llamadas de vuelta y los borradores de seguimiento. Leads es su lote, agrupado por ventana de llamada. Anterior · Siguiente recorren el lote; Siguiente en la cola salta al primer lead que puede llamar ahora.",
    ],
  },
  {
    id: "batch",
    title: "Su lote: 25 a la vez, solo leads que puede llamar en este minuto",
    shot: "docs/screens/sales-console/desktop-top-up.png",
    shotCaption: "El lote rellenándose solo: menos de 5 abiertos, tres leads del Pacífico añadidos, dos leads del Este cerrados liberados.",
    body: [
      "Elija un oficio y pulse Reservar los próximos 25. El servidor elige — usted no puede hojear la bolsa, a propósito — y le entrega solo leads cuya ventana de llamada está abierta en este minuto, primero el que cierra antes, los investigados delante de los que no. A las ocho de la mañana hora del Este son leads del Este y del Atlántico; a las nueve de la noche, del Pacífico. Un lote corto dice por qué: «12 abiertos ahora — más abren a las 11:00 AM PT».",
      "No lo vuelve a pulsar. Cuando quedan menos de 5 de sus leads por llamar, la consola añade el siguiente lote sola, como mucho una vez por minuto, y lo dice sin ruido: «Se añadieron 25 leads abiertos ahora (PT). 3 leads cerrados liberados.» En ese mismo momento, los leads que nunca tocó y cuya ventana cerró por el resto de su turno vuelven a la bolsa. Un lead que ya llamó, o al que le programó una llamada de vuelta, nunca se le quita. El tope del día son 250 reservas, y la barra lateral las cuenta.",
      "Los chips de zona sobre la lista — Todos · ET · CT · MT · PT, y AT · NT cuando tiene alguno — la filtran, y el chip elegido dice el siguiente hecho de la zona: «abierto hasta las 9:00 PM PT», o «cerrado — abre a las 8:00 AM». Siguiente y el marcado automático siguen el filtro, así que elija PT al final de su día y el recorrido se queda en la costa oeste.",
      "Si llegan menos leads de los que pidió y la nota dice «N leads de Quebec no ofrecidos — añade francés a tus idiomas en la pestaña Pago», es la regla de idioma dos secciones más abajo, no una falla.",
    ],
  },
  {
    id: "incoming",
    title: "Cuando un contratista le devuelve la llamada",
    shot: "docs/screens/sales-console/desktop-ring.png",
    shotCaption: "El cajón de llamada entrante, bajado desde la barra de arriba: el negocio, el número, de quién es el lead, Descolgar, Rechazar.",
    body: [
      "Una llamada a su número suena dentro del portal, en cualquier pantalla de /sales donde esté. Un cajón baja desde debajo de la barra de arriba con el nombre del negocio, el número y de quién es el lead, y dos botones: Descolgar y Rechazar. Descolgar pone la llamada en vivo en el espacio del Marcador, exactamente donde va una llamada saliente, con Silenciar, Colgar y Transferir. Rechazar devuelve la llamada para que la reciba el siguiente representante del plan de timbrado — no manda a quien llama al buzón de voz. Solo cuando nadie descuelga, quien llama espera mientras el sistema busca otra vez, y llega al buzón de voz después.",
      "Quién suena: primero el representante dueño del número marcado; luego quien llamó a ese contratista por última vez; luego los representantes Disponibles de los que se ha sabido hace poco — como mucho tres, veinte segundos cada uno. Los que están en pausa, Fuera y las laptops dormidas se saltan, y por eso su estado importa. Quien llama desde un código de área de Quebec, o un lead que el emparejador ubica en Quebec, solo suena en representantes con francés.",
    ],
  },
  {
    id: "texts",
    title: "SMS: un cliente de chat, y nada se manda solo",
    shot: "docs/screens/sales-messages/desktop-thread-bottom.png",
    shotCaption: "SMS: los cuatro grupos, un hilo con un borrador de seguimiento dentro, el compositor con la línea de la ventana, la barra de contacto.",
    body: [
      "SMS es un cliente de chat, no una lista con un cuadro para redactar. Las conversaciones a la izquierda van en cuatro grupos — Por responder · Esperando su respuesta · Borradores pendientes · Terminadas —, la conversación va en el centro con separadores por día y la línea roja de no leídos, y el contacto va en una barra a la derecha (Detalles · Canales · Historial). Cada texto sale del número de ventas de FieldQuo, y la respuesta cae en el mismo hilo.",
      "La línea sobre el compositor es la ventana de texto del lead en SU huso horario — «Abierto hasta las 9:00 PM CDT», o «Cerrado — abre a las 8:00 AM». El huso sale de su provincia, o del que usted indicó después de hablar con él; un estado que abarca dos husos (Florida, Texas, BC) se pregunta en lugar de adivinarse, y nunca se saca del código de área. El servidor vuelve a juzgar la ventana en el instante en que usted pulsa Enviar.",
      "STOP quiere decir STOP. Una conversación donde respondieron STOP muestra una etiqueta STOP roja y ningún compositor — no se puede enviar nada a ese número por ningún canal, y solo la petición por escrito de un superadministrador la reabre. No le dé la vuelta desde su propio celular.",
      "Los seguimientos son borradores. Al día 1 después de que una empresa se registra (¿pasó la configuración?) y al día 7 (¿está funcionando en un trabajo real?), y uno más cerca de la marca de 60 días cuando toca, el borrador aparece en el hilo y bajo Borradores pendientes con la pista «Tab para cargarlo». Usted lo lee, lo cambia y pulsa Enviar. Nada sale solo, nunca. Escriba ! en el compositor para las redacciones preparadas — los grupos Seguimiento y Ventas, y el enlace de registro.",
      "Nuevo mensaje abre un hilo con uno de sus propios leads. Nuevo mensaje a un número toma un número que usted escribe — solo de Canadá y Estados Unidos; un +1 del Caribe o cualquier cosa de ultramar se rechaza con la razón, y también un número que otro representante tiene. Un número que nadie tiene se vuelve un lead con solo el número, y el primer mensaje es la presentación con el enlace de registro, enviada por usted.",
    ],
  },
  {
    id: "team",
    title: "Equipo: todos en FieldQuo, desde una sola pantalla",
    body: [
      "Equipo es el chat propio de FieldQuo — los representantes y la gente que los respalda, en las mismas salas, en la misma pantalla que ve un administrador de la plataforma. Tres canales en los que está todo el mundo: #fieldquo, todo FieldQuo y el único que nadie puede dejar; #sales, los representantes al teléfono y la gente detrás de ellos; y #support, donde usted le pasa el problema de un cliente a alguien que puede arreglarlo. Nuevo grupo crea una sala privada con los representantes y el personal de FieldQuo que usted elija; Nuevo mensaje abre un mensaje directo con una persona; @ en el compositor lista a los miembros de la sala, y una mención solo puede nombrar a alguien que esté en ella. Una pregunta hecha aquí la lee alguien que puede actuar.",
    ],
  },
  {
    id: "sells-in",
    title: "Idiomas en los que puedo vender — y por qué Quebec puede no llegarle",
    body: [
      "En Pagos, bajo el idioma del portal, está Idiomas en los que puedo vender. Marque cada idioma en el que puede atender una llamada de ventas. Sin contestar, cuenta como solo inglés. Los leads de Quebec van solo a representantes con francés — en la reserva de uno en uno, en el lote, cuando le mueven un lead, y cuando llama un número de Quebec — y la cola le dice cuántos se retuvieron: «N leads de Quebec no ofrecidos — añade francés a tus idiomas en la pestaña Pago para recibirlos.» Nuevo Brunswick no tiene esa regla. Si habla francés, márquelo antes de su primer turno; un superadministrador también puede ponerlo en su ficha de representante.",
    ],
  },
  {
    id: "voicemail",
    title: "Buzón de voz",
    body: [
      "Un contratista que llama a su número cuando nadie puede descolgar espera un momento mientras el sistema busca a alguien libre, y deja un mensaje después. Buzón de voz es donde lo escucha: cada mensaje con el número, cuándo se dejó, cuántos segundos se hablaron, un reproductor, y el lead para abrir. Un mensaje de cero segundos se muestra a propósito — es alguien que devolvió la llamada, oyó el tono y colgó, y vale una llamada de vuelta. La insignia en la pestaña cuenta los mensajes dejados desde que empezó su día.",
    ],
  },
  {
    id: "pay",
    title: "Su pago: un cliente, tres etapas, CA$125",
    body: [
      "Todo lo que FieldQuo le paga a un representante es en dólares canadienses. Un cliente paga CA$125, en tres etapas que siguen al cliente mientras se consolida: CA$20 cuando la empresa queda Activada — Stripe la verificó y encendió los cobros, así que puede recibir dinero; CA$40 cuando queda Renovada — llega a su siguiente ciclo de facturación después del mes gratis, ya sea que Stripe cobró o que un crédito de referido lo cubrió; CA$65 cuando Sigue pagando — sigue suscrita sesenta días después del día en que se registró, prueba incluida. El plan es una fila en su ficha de representante, así que un representante contratado con otras condiciones conserva las suyas; y si usted se va, lo que sus empresas sigan generando sigue siendo suyo.",
      "Pagos lo muestra: Ganado en total, Pagado a ti, Cerrado aún sin pagar, Esta semana hasta ahora; cada empresa que usted trajo con la etapa a la que llegó; y las semanas, cada una con su fecha de pago una vez que corrió la tanda. Las semanas cierran de lunes a lunes y la tanda paga la semana anterior. Nada en la pantalla se puede editar — es el registro desde el que se paga. Debajo, adónde manda FieldQuo el dinero (Interac e-Transfer para una cuenta canadiense, Wise para un representante fuera de Canadá, PayPal, o una transferencia bancaria), luego el idioma del portal, luego Idiomas en los que puedo vender.",
    ],
  },
];
