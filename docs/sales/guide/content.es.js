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
    "Las comisiones de tarjeta, cuando pregunten: 3 % + 30 ¢ por un pago con tarjeta en línea — prácticamente el 2,99 % de Housecall Pro, y una décima de punto por encima del 2,9 % + 30 ¢ de Jobber, así que no diga que somos más baratos en tarjetas. Las tarjetas de empresa y Amex van al mismo 3 %, no a una tarifa recargada del 3,49 %. Donde ganamos es en el débito bancario en Canadá: 1 % + 40 ¢ con tope de 5 $ por pago — una factura de 5 000 $ pagada por débito preautorizado le cuesta 5 $ al contratista, mientras que los pagos bancarios de Jobber son un 1 % fijo sin tope. Cada comisión se descuenta del pago antes de llegar a su banco; nada se factura aparte y no hay cuota mensual por cobrar.",
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

// ══ Cada pantalla ═════════════════════════════════════════════════════════
//
// Una entrada por fila de los dos menús laterales, indexada por el slug de
// docs/screens/app-guide/harness/screens.js. El TÍTULO no está aquí: el
// generador imprime la etiqueta del menú tal como app/i18n/appMessages.js la
// da en español, para que el título del guía sea la palabra en pantalla. La
// figura es una captura de la pantalla real. Dos o tres frases cada una: qué
// muestra la pantalla, qué hace el contratista en ella. Nada aquí que la
// figura no muestre.
export const SCREENS_CHAPTER = {
  heading: "Cada pantalla, en el orden del menú",
  intro: [
    "La oficina es un solo menú lateral. Este capítulo lo recorre de arriba abajo — Inicio, FieldQuo IA, luego los cinco grupos Trabajo, Personas, Finanzas, Análisis y Crecer, luego Ayuda, Plan y Configuración — y después recorre el menú de Configuración de la misma manera. Cada entrada es la pantalla real, capturada desde la cuenta de un propietario conectado el día en que se generó esta guía — y, cuando la pantalla tiene un botón Nuevo o Agregar, una segunda figura muestra lo que se abre al pulsarlo (capturada en inglés).",
    "Úsalo de dos formas. En una demo, es la ruta: abre las pantallas en este orden y habrás mostrado todo el producto en veinte minutos. En una llamada, es la respuesta a «¿dónde hago X?» — busca la fila, lee la frase, di las palabras que están en pantalla.",
    "Una pantalla puede faltar en el menú de un cliente. No es un fallo: el menú oculta las filas que el nivel de acceso de la persona conectada no permite (ver «Roles y acceso»), y Precios de gabinetes y Costos de materiales aparecen solo para los oficios que cotizan así.",
  ],
  railHeading: "El menú principal",
  settingsHeading: "El menú de Configuración",
  createCaption: "{title} — lo que se abre al pulsar « {button} »",
  items: {
    // ── Inicio, IA ────────────────────────────────────────────────────────
    home: { body: [
      "« Panel » — lo que está pasando en el negocio. Abre con « Pendientes de ti »: la factura atrasada con un botón « Reclamar el pago », las cotizaciones cuyo precio espera aprobación, y la próxima cita que reservó el recepcionista. Luego « Ingresos este mes » con una curva del dinero recibido, y cuatro tarjetas — « Cotizaciones enviadas este mes », « Tasa de conversión », « Dinero que te deben », « Próximas visitas ».",
      "« El detalle » debajo: el gráfico mensual de barras (3, 6 o 12 meses), la escalera de antigüedad de las cuentas por cobrar con cada factura pendiente y su contacto, la barra de ritmo de la meta de ingresos, « Cotizaciones recientes » y « Próximas citas ». Una nueva cotización, « Ver clientes » y « Programar cita » son los tres botones.",
    ] },
    ai: { body: [
      "« FieldQuo IA » — preguntar sobre las propias cotizaciones, facturas, clientes y costos de materiales; busca los números reales en lugar de adivinar. Una conversación vacía con sugerencias « Prueba a preguntar » (qué clientes aún no se han facturado, el valor medio de las cotizaciones del mes) y un cuadro para escribir la pregunta.",
      "Solo responde sobre los datos de esta empresa y rechaza las peticiones generales — ese es el argumento honesto, y la razón por la que se le pueden confiar los números de un contratista.",
    ] },
    // ── Trabajo ───────────────────────────────────────────────────────────
    requests: { body: [
      "« Prospectos » — las consultas que llegan de la página de reservas y los formularios. Un tablero de cuatro columnas — « Nuevo », « Contactado », « Ganada », « Perdida » — por el que las tarjetas se arrastran. Cada tarjeta lleva una puntuación caliente / tibio / frío, etiquetas de plazo y presupuesto, la categoría, el número de fotos, la cotización vinculada y el responsable.",
      "Filtros por temperatura, un orden « Más calientes », búsqueda y un botón « Importar ». Aquí aterrizan el formulario del sitio, el enlace de reservas, el recepcionista y una recomendación.",
    ] },
    quotes: { body: [
      "« Cotizaciones » — etiquetas de estado con su recuento (todas, « Borrador », « Enviada », « Aprobada », « Rechazada »), un buscador, y la lista: número, estado, cliente, importe, antigüedad. Una cotización enviada sin respuesta sube al principio con su fecha de validez; una estimación instantánea lleva « Requiere revisión ».",
      "« Nueva cotización » abre el editor. La cotización conserva el idioma en que se creó; el cliente la ve como página y como PDF con la marca de la empresa.",
    ] },
    "estimate-reviews": { body: [
      "« Revisión de estimaciones » — las estimaciones instantáneas del sitio web llegan aquí primero; se confirma el precio, ajustándolo si la propiedad lo exige, antes de que la cotización pueda enviarse. Cada tarjeta nombra al cliente y la fuente (« Ingresado por el propietario » o « Tomado de una llamada telefónica », con un botón « Escuchar »), el responsable, el tamaño y el material, el rango que vio el propietario y su presupuesto declarado, y el desglose por líneas.",
      "Un botón « Aprobar » al importe propuesto, y « Abrir el presupuesto ». Nada que haya cotizado un algoritmo llega a un propietario sin que una persona pulse aquí.",
    ] },
    jobs: { body: [
      "« Trabajos » — el trabajo programado y en curso. Etiquetas « Falta fecha / Programado / En curso / Completado », un interruptor « Archivados », búsqueda, y la lista con título, etiqueta de estado, cliente y número de visitas.",
      "« Nuevo trabajo » crea uno a mano; la mayoría nacen de una cotización aprobada. « Trabajos pasados » importa el historial de un sistema anterior.",
    ] },
    invoices: { body: [
      "« Facturas » — tres tarjetas — « Pendiente » (con la parte atrasada), « Pagada », « Total facturado » — y luego la lista: número, estado (« Enviada », « Pagada », « Atrasada »), cliente, vencimiento, los días de retraso en rojo, y el saldo o « Pagada por completo ».",
      "« Nueva factura » emite una; una factura de depósito suele crearse desde el calendario de pagos de la cotización. Las facturas reflejan las cotizaciones — mismas secciones, misma marca — y se pagan en línea por la cuenta de Stripe de la empresa.",
    ] },
    plans: { body: [
      "« Planes de servicio » — trabajo recurrente vendido como paquete, facturado con la cadencia elegida. Cada plan: nombre, « Activo », cliente, cadencia (« Una vez al año », « Trimestral »), precio por visita, cómo se cobra, y o bien el total del plazo con su descuento o « Sigue hasta que se cancele ».",
      "« Nuevo plan » vende uno. Un plan es una instrucción permanente de crear una visita y una factura — por eso la fila va después de Facturas.",
    ] },
    calendar: { body: [
      "« Citas » — las visitas en persona y las asignaciones en obra. Etiquetas « Programado / Se requiere supervisor / Completado » con su recuento, una cuadrícula mensual (semana que empieza en lunes, hoy marcado, las entradas en su día), y debajo las filas: cliente, estado, una etiqueta « Visita de obra », hora, teléfono y dirección, responsable, « Abrir el trabajo ».",
      "« Nueva cita » reserva una. Las visitas creadas desde un trabajo, las reservas de la página pública y las devoluciones de llamada que reservó el recepcionista aparecen todas aquí.",
    ] },
    tasks: { body: [
      "« Tareas » — recordatorios internos para el equipo, distintos de los trabajos, que son trabajo programado en casa de un cliente. El recuento de tareas abiertas; primero las atrasadas, luego por prioridad; cada fila con una casilla, una etiqueta de prioridad, la fecha, el responsable, el cliente y un enlace a su trabajo; una tarea que exige fotos muestra el recuento de fotos.",
      "« Nueva tarea » añade una; « Mostrar completadas » revela las hechas.",
    ] },
    chat: { body: [
      "« Chat » — la empresa hablando consigo misma, sobre el mismo kit de chat que Mensajes. La sala general es todo el equipo; cada trabajo del calendario tiene su propia sala para la cuadrilla reservada en él y la oficina; un mensaje directo es entre dos personas. Las salas se agrupan en « No leídos », « Empresa », trabajos, « Mensajes directos » y « Trabajos terminados ».",
      "En una sala: el hilo con un separador de no leídos, las menciones @ que avisan a la persona nombrada, la lista de miembros y el compositor. « Nuevo mensaje » abre un mensaje directo con cualquiera del equipo.",
    ] },
    // ── Personas ──────────────────────────────────────────────────────────
    clients: { body: [
      "Cada cliente, como tarjeta: nombre, correo, teléfono, ciudad, y un pie que cuenta sus presupuestos y facturas. Una empresa muestra a su persona de contacto bajo el nombre de la compañía.",
      "« Nuevo cliente » añade uno; « Importar » carga un CSV desde lo que el contratista usaba antes. Abrir una tarjeta lleva a los presupuestos, trabajos, facturas y equipos de ese cliente en un solo lugar.",
    ] },
    "client-equipment": { body: [
      "« Garantías que se acaban » — las calderas, paneles y gabinetes que la empresa instaló y cuya cobertura terminó o está por terminar. Es una lista de llamadas, y la página lo dice en esas palabras.",
      "Un selector de ventana (de los próximos 30 días a los próximos 365) y un recuento — fuera de garantía, por terminar, sin fecha registrada — y luego una tarjeta por pieza con un número para llamar de un toque y un botón de correo, para reservar la visita de renovación desde la tarjeta.",
    ] },
    team: { body: [
      "« Gestionar equipo »: primero el panel de licencias — 4 / 6 licencias usadas, 3 / 11 cuadrilla incluidos sin costo, con « Agregar cuadrilla — sin costo » y « Agregar una licencia » — y luego la lista con el nivel de acceso de cada persona como desplegable: Manager, Estimator, Dispatcher, Crew o « Personalizado… ».",
      "Cambiar el desplegable reclasifica el nivel y los permisos de esa persona en un paso; « Agregar usuario » invita a alguien; una invitación pendiente aparece como « Invitado » con « Cancelar invitación ». Esta es la pantalla de la que trata el capítulo de Roles.",
    ] },
    subcontractors: { body: [
      "Las empresas contratadas por trabajo — el electricista, el fabricante de encimeras — con oficio, contacto, y si su seguro o su certificado está al día, por vencer o vencido; los que vencen suben a un panel arriba para que nadie pise la obra sin cobertura.",
      "Un selector de año totaliza lo pagado a cada subcontratista, y « Lista de fin de año (CSV) » exporta la lista T5018.",
    ] },
    scheduler: { body: [
      "« Programación » — la semana de la cuadrilla en siete tarjetas de día. « Agregar turno » pone a una persona en un trabajo con horas y una nota (cargar la furgoneta, entregar los gabinetes); los turnos quedan en borrador, invisibles para la cuadrilla, hasta « Publicar semana ».",
      "La pantalla del despachador: armar la semana, mover cosas, publicar una vez.",
    ] },
    "team-schedule": { body: [
      "« Horario del equipo » — todos en una página: una tarjeta por persona con su nivel, una franja lunes–domingo de disponibilidad (08:00–17:00, « — » los días libres), un botón « Editar horas », y las próximas dos semanas de lo que tiene reservado, por cliente.",
      "El propietario ve de un vistazo quién está disponible cuándo, y corrige las horas de cualquiera desde aquí.",
    ] },
    clock: { body: [
      "« Reloj de tiempo » — el fichaje de la persona conectada: el reloj en vivo, una etiqueta « En turno », el tiempo transcurrido desde que fichó, el trabajo en el que está, y un botón rojo « Registrar salida ». Un selector de trabajo cambia la entrada en curso a otro trabajo.",
      "Debajo, el bloque del día suma las horas y lista cada entrada. Esto es lo que la cuadrilla abre en su teléfono; la oficina revisa el resultado en Hojas de horas.",
    ] },
    timesheets: { body: [
      "« Hojas de horas » — una fila por fichaje: la cuadrilla de hoy en curso con una etiqueta de « en sitio », las filas de la semana pasada con horas y un botón « Aprobar », las más antiguas aprobadas. Un fichaje hecho lejos de la obra se marca en ámbar con la distancia.",
      "Un gerente aprueba las horas aquí antes de que lleguen a una nómina; « Agregar entrada » registra a mano un fichaje olvidado.",
    ] },
    "time-off": { body: [
      "« Tiempo libre » — tarjetas de saldo (vacaciones, días de enfermedad, día personal) con lo acumulado y lo tomado, la lista de tus solicitudes con « Solicitar tiempo libre », y un botón para retirar una solicitud pendiente.",
      "La pestaña de equipo, para un gerente, lista las solicitudes pendientes con « Aprobar » y « Rechazar », quién está libre próximamente, y los saldos de todos.",
    ] },
    safety: { body: [
      "« Seguridad » — lesiones y cuasi accidentes. Un botón « Reportar », filtros abiertos / revisados / cerrados, y una tarjeta por incidente con su tipo (cuasi accidente, daño material), si se detuvo el trabajo, dónde, quién lo reportó y su estado.",
      "Cada tarjeta tiene un desplegable « Seguimiento » donde un gerente fija el estado y anota lo que se hizo. La cuadrilla puede reportar; solo los gerentes dan seguimiento.",
    ] },
    // ── Crecer ────────────────────────────────────────────────────────────
    marketing: { body: [
      "« Marketing » — una tarjeta por campaña con su estado (activa, borrador), su tipo (reparto de folletos, Meta / anuncios pagados, envío de correos), su progreso (una ruta de folletos muestra 26/40 paradas y 9 atendidos; un anuncio muestra su presupuesto) y su responsable.",
      "« Nueva campaña » inicia una; « Suscriptores » y « Gasto en marketing » están al lado. Una campaña de folletos se trabaja parada por parada desde el teléfono.",
    ] },
    "marketing-designer": { body: [
      "« Diseñador de marketing » — diseñar un anuncio una vez y exportarlo en todos los tamaños que piden las redes sociales (Instagram, TikTok, Facebook y YouTube) sin rehacer el diseño a mano.",
      "Los diseños se listan bajo su campaña con aprobado / no aprobado, etiquetas para los cinco formatos (publicación de Instagram, historia de Instagram, TikTok, feed de Facebook, miniatura de YouTube) y el número de formatos listos. « Crear una publicación a partir de un trabajo » convierte las fotos de antes y después de un trabajo en una publicación; « Nuevo diseño » abre un lienzo en blanco.",
    ] },
    funnels: { body: [
      "« Embudos » — embudos de captación pensados para el móvil, en unos toques, para los anuncios y el enlace en la bio; cada uno califica al visitante y deposita un lead puntuado en el pipeline. Cada fila: nombre, publicado o borrador, su canal (Web, Instagram, TikTok, YouTube) y cuántos leads produjo.",
      "« Nuevo embudo » abre el generador con IA (describir el embudo, « Generar ») y las plantillas por canal; una fila abre el editor y su informe de abandono.",
    ] },
    receptionist: { body: [
      "« Recepcionista » — las llamadas que el agente atendió por ti, y lo que salió de ellas. El registro del agente telefónico con IA, agrupado en pendientes, esperando por ti y archivadas, cada llamada con el número, la hora, la duración y el costo, el resumen, y lo que produjo: guardada como lead, visita reservada, un botón para escuchar la grabación, redactar un presupuesto a partir de la llamada, programar una devolución de llamada.",
      "Una línea arriba cuenta las citas que las llamadas reservaron. « Recuperar llamadas perdidas » y « Ajustes del recepcionista » son los dos botones.",
    ] },
    "crew-inbox": { body: [
      "« Bandeja del equipo » — las fotos y novedades que la cuadrilla envió por mensaje; las archivadas están en sus trabajos. El panel verde « Mensajes del equipo » muestra el número al que escribe la cuadrilla, el saldo de crédito y las tarifas (2 ¢ por mensaje, 5 ¢ por foto).",
      "Un bloque pendiente retiene una foto que el sistema no pudo archivar, con la pregunta de para qué trabajo es y una etiqueta por trabajo candidato; el bloque de archivadas lista el resto con el trabajo en el que quedaron.",
    ] },
    messages: { body: [
      "« Mensajes » — los mensajes de la página de Facebook y de la cuenta profesional de Instagram, respondidos aquí. Las conversaciones a la izquierda, agrupadas entre las que esperan respuesta y aquellas en las que se espera al cliente, cada una con el ícono del canal, cuánto lleva esperando y una etiqueta de temperatura; las etiquetas de canal filtran Todos / Facebook / Instagram / WhatsApp.",
      "La conversación abierta está en el centro con « Responder » y una « Nota » privada; el panel derecho tiene los datos de la persona, el estado (abierta, en espera, pospuesta, resuelta), quién se ocupa, y « Abrir el lead ». « Resumen mensual » es el botón de arriba a la derecha.",
    ] },
    refer: { body: [
      "Recomendar otra empresa da otro mes de FieldQuo gratis una vez que es cliente de pago. El enlace de la empresa con « Copiar » — lo bastante corto para decirlo en voz alta, en una tarjeta de visita, un pie de factura o una furgoneta — un botón para compartir por WhatsApp, y « Enviar invitación » por correo o mensaje.",
      "Debajo, los meses ganados, las empresas recomendadas (acreditada o aún sin pagar) y las invitaciones enviadas.",
    ] },
    help: { body: [
      "« Centro de ayuda » — guías paso a paso para todo en FieldQuo: presupuestos, trabajos, facturas, cobros, reservas, sitio web, equipo, y el uso en el teléfono. Un cuadro de búsqueda, un botón para repetir el recorrido de configuración, y artículos agrupados por tema.",
      "Los artículos se abren en el mismo lugar. Manda al contratista aquí antes de que llame a soporte.",
    ] },
    plan: { body: [
      "« Cuenta y facturación » — el plan, las licencias y los datos de pago. La tarjeta del plan muestra el nombre del plan, su estado, el precio mensual, las licencias, la cuadrilla incluida sin costo y la próxima fecha de facturación, con « Gestionar facturación y método de pago », un enlace a lo que pagaron los clientes y « Cancelar plan ».",
      "Bajo los planes, un interruptor « Mensual » / « Compromiso de 1 año » y los cuatro escalones — Solo, Crew, Shop, Scale — cada uno con sus licencias y accesos de cuadrilla y « Elegir plan »; el actual dice « Plan actual ». Solo propietario y administradores.",
    ] },
    // ── Finanzas ──────────────────────────────────────────────────────────
    payroll: { body: [
      "« Nómina » — FieldQuo calcula lo que debe cobrar cada persona a partir de sus horas aprobadas y las tarifas guardadas, y produce los recibos de pago; el contratista paga por su propio banco o proveedor de nómina — FieldQuo no mueve el dinero. Di esa última frase en cada llamada: es la pregunta que hacen.",
      "« Nuevo ciclo de pago » viene prellenado con el último período cerrado del ciclo de pago de la empresa (« Cada 2 semanas »); « Calcular » previsualiza bruto, deducciones y neto por persona, y luego « Guardar como borrador ». « Ciclos de pago » lista cada período con sus fechas, la plantilla, el neto total y su estado.",
    ] },
    expenses: { body: [
      "« Seguimiento de gastos » — a dónde va el dinero, por trabajo, gastos generales y categoría, más la tasa de gasto mensual. Un selector de mes sobre cuatro tarjetas: los gastos registrados del mes, la tasa de gasto mensual (generales + salarios + deudas), el margen de maniobra y el gasto ligado a trabajos.",
      "Debajo: una tarjeta « Resumen de IA », el desglose mensual y el gasto por categoría en barras, la tendencia de 6 meses, y los gastos recientes con cada recibo etiquetado como general o ligado a un trabajo. « Agregar gasto », « Importar desde un CSV del banco », y una tarjeta « Exportación contable » que descarga un rango de fechas en CSV para el contador.",
    ] },
    purchasing: { body: [
      "« Compras » — a quién se le compra, qué hay pedido y qué hay en el estante. Tres pestañas: « Pedidos », « Existencias », « Proveedores ». Pedidos lista cada orden de compra con su proveedor, cuántas líneas se recibieron, su estado y su total; « Nuevo pedido » crea una.",
      "Abrir un pedido permite registrar una entrega línea por línea; el material recibido aterriza en la pestaña Existencias, que muestra lo que hay en el estante y marca lo que cae por debajo de su nivel de reposición.",
    ] },
    fleet: { body: [
      "« Vehículos » — qué vence, qué caduca y quién tiene la furgoneta; lo que costó cada una vive en el registro de activos. Primero un panel « Pendiente o por vencer » — seguro, matrícula, servicio por fecha o por kilometraje — y luego una tarjeta por furgoneta con su placa, modelo, año y quién la tiene.",
      "Una tarjeta se despliega en los cuatro vencimientos, el odómetro, el VIN, el costo y el valor en libros, un botón de edición, el registro de « Mantenimiento » y los « Documentos ».",
    ] },
    // ── Análisis ──────────────────────────────────────────────────────────
    insights: { body: [
      "« Cómo te comparas » — el precio medio de los presupuestos de la empresa frente al promedio anonimizado de la plataforma, por categoría de servicio. Una fila por categoría con el número de presupuestos en la región este trimestre, « Tu promedio », « Promedio de la plataforma » y la diferencia en porcentaje. Voluntario, solo agregados — un competidor nunca ve los precios de una empresa.",
      "Esta página es también el centro del resto del grupo: « Resúmenes semanales », « Estados financieros », « Ganadas y perdidas », « Precisión de las estimaciones » y « Panel de KPI » son los enlaces bajo el título.",
    ] },
    kpis: { body: [
      "« Panel de KPI » — ventas, beneficio, ejecución y caja, en un solo lugar. Botones de período (este mes, el mes pasado, « Este trimestre », el año hasta hoy, el año pasado), y luego las secciones: ventas (tasa de cierre, valor medio del trabajo, conversión de lead a presupuesto, cartera en semanas), flujo de dinero (ingresos, gastos, restante, por día), costos del negocio, beneficio (margen bruto y neto, costo de mano de obra), ejecución (entrega a tiempo, utilización de la mano de obra, precisión de las estimaciones), calidad, caja (cuentas por cobrar por antigüedad, vencidas) y cliente.",
      "Una tarjeta sin datos dice por qué en lugar de mostrar un cero, y una sección final « Sin seguimiento » nombra los dos indicadores que FieldQuo se niega a inventar. Requiere que el costeo de trabajos esté activado para quien mira.",
    ] },
    settings: { body: [
      "« Configuración » abre el menú de configuración y aterriza en la Configuración de la empresa. El menú tiene ocho grupos — Cuenta, Negocio, Equipo y horarios, Servicios y precios, Documentos y plantillas, Mensajería y alertas, Cobros, De cara al cliente — cerrados por defecto para leerse como un índice, con el grupo en el que estás abierto.",
      "Cada fila se recorre abajo. Un cuadro de búsqueda arriba del menú encuentra una fila escribiendo su nombre.",
    ] },
    // ── Configuración: Cuenta ─────────────────────────────────────────────
    "settings-account-billing": { body: [
      "La misma pantalla que « Plan » en el menú principal, alcanzada desde el menú de Configuración: la tarjeta del plan con estado, precio, licencias, accesos de cuadrilla y próxima fecha de facturación; « Gestionar facturación y método de pago », « Cancelar plan »; y los cuatro planes con « Elegir plan ».",
      "Solo propietario y administradores — un Manager no ve esta fila.",
    ] },
    "settings-refer": { body: [
      "La misma página « Recomienda y gana » que en el menú principal: el enlace de recomendación de la empresa, compartir e invitar, los meses ganados y las empresas recomendadas.",
      "Un mes gratis para cada uno, quien recomienda y quien es recomendado, una vez que la empresa recomendada paga.",
    ] },
    "settings-migration": { body: [
      "« Migración de datos » — el servicio de pago en el que FieldQuo importa los datos antiguos de una empresa. La tarjeta de la solicitud muestra lo que dijo que traería (QuickBooks, Jobber…), su estado (« Presupuesto listo »), el precio de FieldQuo con su nota, y « Aceptar » / « Rechazar »; debajo, « Documentos » con « Subir un archivo » para las exportaciones.",
      "El personal de FieldQuo crea clientes y cotizaciones nuevos dentro de la cuenta, nunca toca lo que ya existe, y cada escritura queda registrada. El precio se paga por la facturación de FieldQuo, no por el Stripe del contratista.",
    ] },
    "settings-product-updates": { body: [
      "« Novedades del producto » — un registro fechado de cambios, cada entrada con « Leer la novedad completa ». Nada que configurar; es donde un contratista ve qué cambió desde el mes pasado.",
    ] },
    // ── Configuración: Negocio ────────────────────────────────────────────
    "settings-company": { body: [
      "« Configuración de la empresa » — los datos del negocio, el horario, los impuestos y las preferencias regionales. Las tarjetas de arriba abajo: « Alcance del trabajo y condiciones » (el texto de proceso por defecto con el que empieza cada cotización, y « Condiciones de pago »), « Calendario de pagos » (50 % de depósito al reservar, 50 % en la instalación, « Guardar calendario »), la industria y los tipos de cotización, los datos con la dirección, « Horario de apertura », « Disponibilidad para reservas » y « Configuración de impuestos » (GST, QST, GST + QST, « Crear tasa de impuesto »).",
      "Es la primera pantalla tras el registro, y aquella en la que aterriza la fila de Configuración del menú.",
    ] },
    "settings-branding": { body: [
      "« Marca » — el logotipo y el color de marca aparecen en cada cotización, factura y correo que ven los clientes. Una tarjeta « Logotipo » con « Subir logotipo », « Colores de marca » con « Principal » y « Secundario », y una vista previa de una cotización en modo claro y oscuro.",
      "Un solo color rige todas las superficies de cara al cliente; el contraste se calcula, así que un amarillo o un gris medio siguen imprimiéndose legibles.",
    ] },
    "settings-language": { body: [
      "« Idioma » — « Tu idioma », una fila por idioma con su cobertura de la interfaz, bajo una opción « Usar el predeterminado de la empresa »; y una tarjeta « Predeterminado de la empresa » debajo.",
      "El propietario elige en qué idioma lee la aplicación; el predeterminado de la empresa cubre a los compañeros y clientes que nunca eligieron. Un documento conserva el idioma en que se creó.",
    ] },
    "settings-activity": { body: [
      "« Registro de actividad » — la pista de auditoría de la empresa: cotización creada, enviada, reclamada, aprobada; factura enviada y reclamada; trabajo programado; miembro invitado; precios actualizados; cliente añadido — cada uno con quién lo hizo, su rol y cuándo.",
      "Solo lectura, solo propietario y administradores. Es la respuesta a «¿quién cambió esto?».",
    ] },
    // ── Configuración: Equipo y horarios ──────────────────────────────────
    "settings-team": { body: [
      "La misma pantalla « Gestionar equipo » que « Tu equipo » en el menú principal: el panel de licencias, la lista con el nivel de acceso de cada persona, « Agregar usuario », y las invitaciones pendientes.",
      "Ver « Roles y acceso » para lo que significa cada nivel del desplegable.",
      "« Trabajadores » es una pestaña de esta pantalla, no una fila de Configuración, y solo la ven el propietario y los administradores — « Todos los registrados — su tarifa de pago, fecha de inicio y estado de pago. » Cada fila se abre para editar el nombre, el móvil desde el que la persona envía fotos de obra, la tarifa por hora, la fecha de inicio, a quién reporta, obra u oficina, las horas garantizadas por semana y si está activa, con « Conectar Stripe » para los pagos; la página rechaza a todos los demás, Manager y Dispatcher incluidos, porque una tarifa de pago es nómina se escriba donde se escriba, y empleado o contratista deliberadamente no se puede editar ahí.",
    ] },
    "settings-availability": { body: [
      "« Tu horario » — un selector « Horario de quién », luego « Horario de trabajo » (el turno, para la programación y las hojas de horas) y « Horas reservables » (la ventana que ofrece la página pública de reservas), con un « Guardar horario » fijo abajo.",
      "Las dos están separadas a propósito, y ambas son por persona: el horario de apertura de la empresa vive en la Configuración de la empresa, para que el día libre de un estimador nunca se publique como un cierre del taller.",
    ] },
    "settings-leave": { body: [
      "« Políticas de tiempo libre » — « Políticas » con « Agregar política »: por ejemplo vacaciones con días fijos al año y arrastre, y bajas por enfermedad aprobadas automáticamente, cada una con « Editar »; y una tarjeta « Fin de año » que traslada los saldos del año pasado a este.",
      "Solo propietario y administradores; los saldos se muestran en la pantalla de Tiempo libre de cada persona.",
    ] },
    "settings-booking-page": { body: [
      "« Página de reservas » — el código para incrustar en el sitio (« Copiar código »), « ¿Cuánto dura una visita? » con los modos de encuentro (en casa del cliente, llamada telefónica), el margen de desplazamiento, la ventana de llegada y la duración por defecto, las reglas de cambios y cancelaciones (horas de aviso, reembolso de la tarifa), y luego una tarjeta por tipo de evento — una consulta de diseño de 60 minutos gratuita, una visita de medición de 45 minutos con tarifa y precio promocional.",
      "« Nuevo tipo de evento » añade un tipo de cita que un propietario puede reservar por sí mismo.",
    ] },
    "settings-work-areas": { body: [
      "« Áreas de trabajo » — zonas o proyectos con nombre (Laval, isla de Montreal, Rive-Nord), cada uno con una etiqueta por miembro del equipo; una etiqueta rellena significa que esa persona está asignada. Un campo arriba añade una.",
      "Sirve para agrupar trabajos y tareas por territorio; la asignación es solo para propietario, administradores y supervisores.",
    ] },
    // ── Configuración: Servicios y precios ────────────────────────────────
    "settings-products": { body: [
      "« Productos y servicios » — el catálogo de precios: una tabla con nombre, descripción y tipo (servicio o producto), cada artículo etiquetado con los tipos de cotización en los que puede aparecer, con editar y borrar, búsqueda, « Agregar artículo » y una importación CSV.",
      "Una línea de cotización se elige de aquí, así que el precio que ve el propietario de la casa es el que fijó el dueño del negocio.",
    ] },
    "settings-services": { body: [
      "« Servicios y precios » — una tarjeta por tipo de cotización con una casilla de encendido/apagado: los tipos propios de la empresa (personalizados) con sus campos de admisión y sus tarifas por unidad, y los del oficio incluidos de serie (el reacabado de gabinetes, cotizado por puerta o por frente de cajón, con la opción de un precio instantáneo para los propietarios y una tarjeta de tarifas plegable). « Lo que dice el presupuesto » bajo cada uno es el texto que lee el cliente.",
      "« Agregar tipo de presupuesto personalizado » y mostrar los servicios de otros oficios son los dos botones. Las tarifas nunca salen de esta pantalla — los puntos de acceso públicos devuelven servicios y campos, no precios.",
    ] },
    "settings-material-costs": { body: [
      "« Costos de materiales » — cuándo pedir una revisión del costeo (un umbral, « Guardar »), y luego una receta por servicio (el reacabado de gabinetes, marcado como personalizado con « Restablecer valores predeterminados »): imprimación y capas de acabado, rendimiento, precio por galón, endurecedor, horas de preparación y consumibles.",
      "Estos valores alimentan la estimación interna de costo y margen de una cotización; nunca se muestran al cliente. Solo aparece para los oficios que cotizan así.",
    ] },
    "settings-cabinet-rates": { body: [
      "« Precios de gabinetes » — « Cómo fijas el precio de un gabinete » (« Por pie lineal » o « Costo más margen del material »), « Tarifas por pie lineal » (base, superior, despensa, isla, recargo por cajón, armarios empotrados, tocador, y si la instalación está incluida), y luego « Multiplicadores de material ».",
      "El diseñador de cocinas cotiza a partir de estos valores en el servidor. Solo aparece para los oficios de gabinetes.",
    ] },
    "settings-overhead": { body: [
      "« Gastos generales » — « Tu precio mínimo »: trabajos por semana, y tarjetas para los costos fijos mensuales, los trabajos por mes, el costo por trabajo y el precio mínimo que un trabajo debe dejar para cubrir el taller; las horas pagadas que nunca llegaron a un trabajo (mano de obra no absorbida por trabajador); y luego los registros — « Costos fijos », « Salarios », « Deuda », activos y depreciación, y « Facturas por pagar » con lo pendiente, lo que sale este mes y lo atrasado.",
      "El número que un contratista más quiere y menos veces tiene. Requiere costeo de trabajos.",
    ] },
    "settings-custom-fields": { body: [
      "« Campos personalizados » — campos definidos por tipo de registro (campos de cotización como estilo de puerta, acabado, acabado de la herrajería, con su tipo y si son obligatorios).",
      "La propia página dice « Próximamente » para mostrarlos en los registros: los campos se definen aquí pero aún no aparecen en una cotización. No prometas que sí.",
    ] },
    // ── Configuración: Documentos y plantillas ────────────────────────────
    "settings-quote-email": { body: [
      "« Correo de presupuesto » — lo que contiene el correo que lleva las cotizaciones, más allá de la cotización misma. Una tarjeta lista lo que el correo siempre lleva, luego « Referencias » — clientes anteriores que aceptaron atender una llamada, con la opción de incluirlos en cada nueva cotización — y una sección de fotos de antes y después.",
      "El contratista añade nombres y números, sube pares de fotos y elige qué sale. El correo mismo se envía en el idioma de la cotización, a nombre de la empresa.",
    ] },
    "settings-email-templates": { body: [
      "« Plantillas de correo electrónico » — personalizar los correos que reciben los clientes. Agrupadas en automatizadas, marketing y personalizadas, una fila por plantilla con una etiqueta de activa, un botón para activarla, editar, duplicar y borrar; « Nueva plantilla » y « Agregar plantillas predeterminadas » para partir de un juego inicial.",
    ] },
    "settings-pdf-templates": { body: [
      "« Plantillas PDF » — el diseño de los PDF de cotización y factura que reciben los clientes. Dos tarjetas, PDF de cotización y PDF de factura, cada una con sus diseños, el número de secciones y una etiqueta de activo; un botón crea otro diseño para editar.",
      "Las facturas reflejan las cotizaciones a propósito: las mismas secciones, en el mismo orden, para que el propietario reconozca el segundo documento como gemelo del primero.",
    ] },
    "settings-translations": { body: [
      "« Traducciones » — el texto que ven los clientes en cotizaciones y facturas escritas en otro idioma. Un selector de idioma, un contador de lo que aún falta, y por servicio columnas inglés / francés con « Marcar como revisado »; « Redactar los que faltan » rellena los huecos con borradores de IA que una persona revisa.",
      "Así es como un taller de Quebec cotiza en francés y en inglés desde un solo catálogo de precios. Nada se traduce automáticamente al enviar.",
    ] },
    "settings-checklists": { body: [
      "« Listas de verificación » — los pasos estándar que la cuadrilla sigue en la obra. Las listas propias de la empresa con su etiqueta de fase (en la obra / antes de irse), el número de pasos y el servicio, con edición; listas iniciales por oficio con « Usar esta ».",
    ] },
    "settings-job-photo-tags": { body: [
      "« Etiquetas de fotos de trabajo » — las propias palabras de la empresa para decir qué pasa en una foto. Una lista ordenada de etiquetas con muestras de color, subir / bajar y « Retirar », un formulario « Agregar una etiqueta » con selector de color, y un bloque de etiquetas iniciales.",
      "La cuadrilla elige una etiqueta al enviar una foto por mensaje; por esa etiqueta filtra luego la oficina.",
    ] },
    // ── Configuración: Mensajería y alertas ───────────────────────────────
    "settings-messages": { body: [
      "« Mensajes de clientes » — los mensajes de texto que reciben los clientes. Un editor por tipo — en camino, recordatorio de cita — con fichas de campos, una vista previa de lo que ve el cliente, « Guardar » y « Usar el predeterminado ».",
      "Dos tipos de mensaje y no más; no prometas otros mensajes automáticos desde esta pantalla.",
    ] },
    "settings-follow-ups": { body: [
      "« Seguimientos » — enviar automáticamente una plantilla cierto tiempo después de que una cotización, factura o trabajo llegue a un estado. Un esquema de solo lectura de cómo funcionan (disparador → espera → envío del correo → parada) tomado de las reglas de abajo, donde cada regla tiene « Pausar » y borrar; « Nueva regla » abre el formulario de disparador / retraso / plantilla.",
      "Una cotización sin respuesta a los tres días, una factura con siete días de retraso: las dos reglas que todo taller debería tener activas.",
    ] },
    "settings-notifications": { body: [
      "« Notificaciones » — cuándo FieldQuo debe enviar un correo al dueño sobre lo que pasa en la cuenta. Tarjetas para una cotización grande creada (con el umbral), una factura pagada, los recordatorios de cita (apagados, o 2 / 24 / 48 horas antes) y las notificaciones del navegador.",
      "Solo propietario y administradores.",
    ] },
    "settings-email-domain": { body: [
      "« Dominio de correo » — enviar los correos a los clientes desde el dominio de la empresa en lugar del nuestro. El dominio con su estado « Verificado » y « Desconectar », el editor de « Dirección del remitente » (presupuestos@…), y a dónde van las respuestas.",
      "Es la promesa de marca blanca hecha literal: la bandeja del propietario muestra el dominio del contratista como remitente, no el de FieldQuo.",
    ] },
    // ── Configuración: Cobros ─────────────────────────────────────────────
    "settings-payments": { body: [
      "« Pagos » — conectar Stripe para que los clientes paguen las facturas en línea, directamente a la cuenta bancaria de la empresa. Stripe conectado y activo con « Gestionar en Stripe » y « Desconectar », y luego la cuenta: su identificador con copiar, el correo de acceso, lo que Stripe ha activado (cobros, transferencias) y lo que aún espera.",
      "Stripe Connect, a nombre del contratista: el dinero va a su banco, y FieldQuo nunca lo retiene. Solo propietario y administradores.",
    ] },
    "settings-meta-ads": { body: [
      "« Meta Ads » — la cuenta publicitaria conectada con « Sincronizar ahora », « Desconectar » y un enlace a las campañas; los formularios de leads de Facebook con un interruptor por formulario, recuento de leads y campañas; la publicación en Facebook e Instagram y la tarjeta de WhatsApp Business con su número y plantillas.",
      "Una sola conexión alimenta tres cosas: el gasto publicitario en los KPI, los formularios en Prospectos, y los mensajes de la página, de Instagram y de WhatsApp en Mensajes.",
    ] },
    "settings-expense-tracking": { body: [
      "La misma pantalla « Seguimiento de gastos » que « Gastos » en el menú principal: las tarjetas del mes, el desglose, la tendencia, los recibos recientes y la exportación contable.",
    ] },
    "settings-ai-credit": { body: [
      "« Crédito de IA » — todo lo que gasta crédito de IA, en un solo lugar. El saldo de crédito telefónico con « Agregar crédito telefónico » y a dónde fue el crédito; el saldo de crédito de imágenes de IA con recargas; y la tarjeta del plan mensual de crédito de IA.",
      "Los minutos telefónicos y las imágenes de IA se miden contra crédito que la empresa compra; FieldQuo IA y el copiloto están incluidos en todos los planes.",
    ] },
    "settings-payroll": { body: [
      "« Configuración de nómina » — « Cuándo pagas » (frecuencia, día de cierre del período, día de pago, período actual y anterior), y luego los componentes de deducciones y devengos: tramos fiscales legales, porcentajes y asignaciones fijas, cada uno con apagar y borrar, más plantillas legales regionales para empezar.",
      "Solo propietario y administradores; a partir de esto calcula Nómina.",
    ] },
    // ── Configuración: De cara al cliente ─────────────────────────────────
    "settings-website": { body: [
      "« Tu sitio web » — el editor: la dirección del sitio con una etiqueta « En vivo », « Abrir », « Guardar » y « Actualizar »; un panel de conversación donde el contratista escribe una instrucción (más atrevido, empezar por las reseñas, página más corta), selectores de diseño y estilo, « Ajustar », y un panel de vista previa / secciones con alternancia de escritorio y móvil.",
      "El modelo solo escribe frases; el diseño, los servicios y los testimonios vienen de los datos de la empresa, así que un sitio nunca se inventa. Los sitios gratuitos llevan un pequeño pie « Sitio por FieldQuo ».",
    ] },
    "settings-instant-quotes": { body: [
      "« Cotizaciones instantáneas » — dejar que los propietarios obtengan una estimación inicial real desde el sitio web en segundos. Un recuento de lo que está en vivo con « Ver lo que ven los propietarios », un código para incrustar con « Copiar código », y luego una tarjeta por oficio con un interruptor, la elección de lo que ve el propietario, y los campos de tarifas.",
      "Cada estimación instantánea aterriza en Revisión de estimaciones antes de poder enviarse; la página pública nunca muestra la tarjeta de tarifas.",
    ] },
    "settings-lead-form": { body: [
      "« Comparte tus enlaces » — para poner en todos los sitios donde la empresa ya está. Tarjetas para pedir una cotización, reservar una visita, la estimación instantánea y cada embudo publicado, cada una con el enlace, « Copiar enlace », « Abrir » y un código para incrustar.",
    ] },
    "settings-bio-link": { body: [
      "« Enlace para la bio » — una página para el único enlace que permiten Instagram y TikTok. « Tu enlace » con copiar / abrir y el estado en vivo, un título y una línea debajo, las cuentas a seguir, los interruptores de enlaces ordenados, y una « Vista previa » en un marco de teléfono con alternancia claro / oscuro y « Guardar ».",
    ] },
    "settings-voice": { body: [
      "« Recepcionista telefónica » — atiende las llamadas que no se pueden atender, toma los datos y reserva visitas contra la disponibilidad real. El número con su estado de respuesta; el crédito (saldo, minutos, recargas, recarga automática); « Tu número »; las tarjetas de saludo, conocimiento, voz y ajuste fino; las devoluciones de llamada de cotizaciones; el interruptor de la bandeja del equipo; y « Comprobarlo de principio a fin ».",
      "Un número local en la zona del contratista, que responde en el idioma de quien llama y reserva en el calendario que ve la oficina. El registro de llamadas es la pantalla Recepcionista del menú principal.",
    ] },
    "settings-ai-employee": { body: [
      "« Empleado de IA » — un asistente que responde los mensajes de los clientes por la empresa. « ¿Qué puesto ocupa? » (cerrador de ventas, recepcionista, soporte técnico u otro, con lo que puede y no puede hacer), « Cómo escribe » (nombre, tono, frase de apertura, instrucciones), el material que lee, y los borradores pendientes de revisión.",
      "Él redacta; una persona envía. Los borradores aparecen en Mensajes.",
    ] },
    "settings-reviews": { body: [
      "« Reseñas » — pedir automáticamente una reseña a los clientes una vez terminado el trabajo. « Tu enlace de reseñas » con guardar, un interruptor « Pedir automáticamente », etiquetas « Cuándo preguntar » para el retraso, un resumen de la cola, y « Reseñas en tu sitio web » que lista los testimonios con interruptores de mostrar / ocultar y una importación por pegado.",
    ] },
  },
};

// ══ Roles y acceso ════════════════════════════════════════════════════════
//
// Las cinco personas que un contratista puede crear, y lo que ve cada una.
// Las dos tablas de este capítulo NO están escritas aquí — el generador
// ejecuta lib/permissions/nav.js y lib/permissions/settingsAccess.js contra
// la cuadrícula real de cada preajuste, el mismo código que oculta una fila
// del menú a esa persona.
export const ROLES_CHAPTER = {
  heading: "Roles y acceso — quién ve qué",
  intro: [
    "El contratista añade a una persona desde Gestionar equipo y elige uno de cinco niveles de acceso: Crew, Estimator, Dispatcher, Manager, o su propio nivel de propietario. Los cuatro primeros son preajustes — una cuadrícula rellena de once áreas de permiso y tres interruptores. Crew es fijo: se elige y no hay ningún ajuste que mover, porque el nivel gratuito no se puede remodelar — una cuadrícula elevada por encima del techo de Crew es un asiento de pago, se llegue como se llegue. Los tres preajustes de pago — Estimator, Dispatcher, Manager — sí se pueden remodelar después, y mover cualquier ajuste convierte el preajuste en «Personalizado». Las tablas de abajo se calculan a partir del propio código de permisos del producto el día en que se generó esta guía, así que dicen lo que el menú hace de verdad.",
    "Dos cosas que decir bien en una llamada. Primero, un acceso Crew no es un asiento: una persona cuyo acceso está en el nivel Crew o por debajo no cuesta nada y no cuenta contra los asientos completos del plan — eso significa la columna «accesos de cuadrilla» de la tabla de planes. Estimator, Dispatcher, Manager y el propietario son asientos completos. Segundo, ocultar una fila no es la seguridad: cada API del producto vuelve a comprobar la misma cuadrícula en el servidor, y quien escribe una dirección que no se le mostró recibe un rechazo, no la página.",
    "Hay una sexta opción en la lista, «Hacer administrador», que otorga todo lo que tiene el propietario salvo la propiedad misma. Existe para un socio o un contador que debe ver la facturación. No la sugieras para el personal.",
  ],
  tierNote: "nivel {tier}",
  productSays: "La descripción del propio producto:",
  roles: [
    {
      key: "worker",
      body: [
        "La persona en la furgoneta. Ve su propio horario y lo marca como completado, ficha entrada y salida, registra sus propios gastos y su tiempo, reporta un incidente de seguridad y lee las notas de los trabajos que tiene asignados — nombre y dirección del cliente, nada más. Sin precios en ningún sitio, sin presupuestos, sin facturas, sin solicitudes. Los trabajos son de solo lectura, y solo los suyos.",
        "Este es el nivel para instaladores y ayudantes. Es gratuito, y es la razón por la que la cuadrilla puede usar el mismo producto que la oficina sin que la oficina se preocupe por lo que la cuadrilla puede ver.",
      ],
    },
    {
      key: "estimator",
      body: [
        "Escribe presupuestos y gestiona clientes, con precios. Puede crear y editar solicitudes y presupuestos, ver y editar las fichas completas de clientes, leer todas las notas, y ver (no editar) trabajos y facturas. Solo su propio horario, tiempo y gastos. Sin gestión de personas, sin nómina más allá de sus propios recibos, sin costeo de trabajos.",
        "Para un vendedor o un segundo estimador que debe poder cotizar y enviar, pero no dirigir el taller.",
      ],
    },
    {
      key: "dispatcher",
      body: [
        "Lleva el horario. El horario de todos es editable, el tiempo de todos es editable, y los trabajos, presupuestos, facturas y solicitudes se pueden crear y editar — pero no borrar. Fichas completas de clientes, todas las notas, los incidentes de seguridad de todos. Todavía solo sus propios gastos, todavía sin costeo de trabajos ni cobro de pagos.",
        "El jefe de equipo que reserva a la cuadrilla, mueve visitas y mantiene la semana en orden, sin el poder de eliminar nada.",
      ],
    },
    {
      key: "manager",
      body: [
        "Lleva el día a día, borrado incluido: presupuestos, trabajos, facturas, solicitudes y clientes se pueden crear, editar y borrar; el horario, el tiempo y los gastos de todos; costeo de trabajos activado; cobro de pagos activado. Lo que un Manager no tiene es la nómina (solo sus propios recibos) y la facturación de la empresa — el plan, la tarjeta, la suscripción — que se quedan con el propietario.",
        "Es el gerente de oficina o el socio que dirige las operaciones. Si un contratista pregunta «¿puedo darle a alguien todo menos el dinero?», esta es la respuesta.",
      ],
    },
    {
      key: "owner",
      body: [
        "Todo, sin cuadrícula que consultar: la persona que dio de alta la empresa. Solo un propietario o un administrador puede abrir Cuenta y facturación, Migración de datos, Recomienda y gana, Registro de actividad, Notificaciones, Políticas de ausencias, Pagos y Meta Ads, ejecutar la nómina, cambiar el acceso de una persona existente o desactivarla. (Un Manager o un Dispatcher puede invitar a gente, pero solo en el nivel Worker — Crew o Estimator — y solo con ajustes que no superen los suyos.) El propietario siempre es un asiento completo.",
      ],
    },
  ],
  seesHeading: "Lo que cada nivel ve en el menú",
  seesIntro: [
    "Un Sí en verde significa que la fila está en el menú de esa persona; un No en rojo significa que está oculta y que la página detrás la rechaza. Calculado pasando cada preajuste por el propio filtro del menú. Las filas de Configuración se filtran dos veces — por la regla del menú principal cuando la fila también está ahí, y por la del menú de Configuración — y ambas deben pasar.",
  ],
  screenCol: "Pantalla",
  gridHeading: "La cuadrícula de permisos detrás de cada preajuste",
  gridIntro: [
    "Las once áreas y los tres interruptores que un propietario ve en el editor de acceso personalizado, con el nivel que escribe cada preajuste. Las palabras son las del producto, en inglés en pantalla sea cual sea el idioma.",
  ],
  areaCol: "Área",
  toggleNames: {
    showPricing: "Ver precios (showPricing)",
    jobCosting: "Costeo de trabajos",
    payments: "Cobrar pagos",
  },
  yes: "Sí",
  no: "No",
  editorHeading: "El editor de acceso personalizado",
  editorBody: [
    "En Gestionar equipo, cada persona tiene un desplegable con las mismas cinco opciones que la pantalla de invitación — Crew, Estimator, Dispatcher, Manager, Administrador — más «Personalizado», que abre la cuadrícula. Elegir un preajuste aplica su nivel y sus permisos de una vez; elegir Crew no muestra ninguna cuadrícula, solo una línea que dice lo que Crew recibe, mientras que los preajustes de pago muestran su cuadrícula debajo. Personalizado muestra las once áreas como desplegables y los tres interruptores como casillas, partiendo de lo que la persona tiene ahora, y una etiqueta «Nivel Worker» / «Nivel Manager» en cada preajuste dice qué nivel produce (Dispatcher y Manager comparten el nivel Manager; Crew y Estimator comparten el nivel Worker).",
    "Solo se puede dar lo que se tiene: cuando un Manager invita a alguien, el servidor limita cada ajuste al nivel del Manager y quita cualquier interruptor que el Manager no tenga. Cambiar el acceso de una persona existente, nombrar un administrador y revocar un acceso son solo para el propietario y los administradores.",
  ],
  editorCaption: "Gestionar equipo — el editor de acceso personalizado abierto sobre un Estimator.",
};
