// content/help/es/leads-and-quotes-2.js
//
// Part 2 of the “leads-and-quotes” category in es. Slugs assigned to this part
// (lib/help/tree.js): ai-quote-review, the-ai-deep-photo-read, upsell-add-ons, good-better-best-options, cost-and-margin-on-a-quote, the-break-even-price, send-a-quote, the-quote-pdf, quote-statuses-and-what-they-mean, quote-validity-and-expiry, quote-language, online-approval-and-signature, deposits-on-quotes.
//
// Misma estructura que el inglés, artículo por artículo (el script de
// verificación compara ambos). Las palabras en pantalla vienen del bloque `es`
// de app/i18n/appMessages.js; el panel de revisión, la barra de idioma y la
// mayoría de las filas de Costo y margen todavía se muestran en inglés en la
// aplicación, y los artículos lo dicen en lugar de inventar una etiqueta que el
// catálogo no tiene.
export const ARTICLES = {
  "ai-quote-review": {
    title: "Revisión del presupuesto con IA",
    summary:
      "Antes de enviarlo, FieldQuo revisa qué le falta al presupuesto, cómo queda el precio frente a los presupuestos que ya ganó y si alguna línea necesita palabras más claras — sugiere, nunca edita.",
    updated: "2026-09-12",
    intro: [
      "Un presupuesto que queda sin respuesta rara vez es demasiado caro. Más a menudo no tiene fecha de vencimiento, tiene una línea que el cliente no puede juzgar, o no dice nada de lo que pasa después del sí. La revisión con IA lee un presupuesto guardado y se lo dice a usted antes que al cliente.",
      "Son dos mitades. Las comprobaciones, la comparación de precio y las sugerencias de extras se calculan con sus propios datos y no cuestan nada. La redacción — palabras más claras para una línea, un borrador de la sección «qué pasa después», una nota sobre lo que muestra una foto — es la parte que escribe un modelo. Si el modelo no está disponible, usted igual recibe la primera mitad.",
    ],
    sections: [
      {
        id: "overview",
        heading: "Resumen",
        blocks: [
          { p: "La revisión vive en la página de edición del presupuesto, en el panel **Review & optional extras** (este panel se muestra en inglés por ahora). Necesita un presupuesto guardado — lee lo que realmente está almacenado, no lo que está a medio escribir en pantalla —, y por eso el botón **Guardar y revisar** del constructor guarda primero un borrador y luego lo abre con la revisión ya en marcha." },
          { p: "Nada de lo que dice la revisión se escribe en el presupuesto por usted. Una redacción más clara se muestra junto a la original para que usted la copie; un extra sugerido se convierte en una fila editable solo cuando pulsa **Add**; el borrador de «qué pasa después» va a las notas solo cuando pulsa **Use this**. El presupuesto que recibe el cliente es siempre el que usted escribió." },
          { note: "La comparación de precio usa los presupuestos aceptados y rechazados de su propia empresa para el mismo tipo de trabajo, y nada más. Nunca mira los precios de otra empresa, y los suyos nunca salen de su cuenta." },
        ],
      },
      {
        id: "what-is-on-the-screen",
        heading: "Qué muestra la revisión",
        blocks: [
          { bullets: [
            "**Un índice sobre 100**, seguido de cuántas cosas vale la pena corregir. Es un recuento ponderado de lo que falta, no una probabilidad de ganar — un presupuesto sin faltantes dice «Nothing obvious missing — this one's ready to send.»",
            "**Las comprobaciones**, cada una con su gravedad: sin fecha de vencimiento, ya vencido, cliente sin correo, sin líneas, todo el trabajo en una sola línea, líneas que el cliente no entenderá («Labour — $2,400»), líneas sin descripción bajo el nombre, nada sobre qué pasa después, sin fotos, y un descuento mayor al 20 %.",
            "**Price check** — dentro de lo que usted suele ganar, **above your usual** o **below your usual**, frente a la mediana de sus presupuestos aceptados para los mismos servicios. Solo habla a partir de 5 presupuestos aceptados comparables; antes de eso lo dice y espera.",
            "**Clearer wording** — el original tachado y una reescritura en lenguaje llano para cualquier línea que un propietario no entendería. Solo la reciben las líneas cuyo nombre no dice nada; una línea cuyo párrafo de alcance ya explica el trabajo se deja como está.",
            "**What the photos show** — aparece solo cuando el presupuesto lleva fotos. La revisión gratuita lee hasta 4 en baja resolución y lista cosas que comprobar en obra que el presupuesto no menciona. «Nada en las 3 fotos que el presupuesto no cubra ya» es una respuesta real, y se muestra como tal.",
            "**Suggested “what happens next”** — un borrador corto sobre plazos, acceso, calendario de pagos y garantía, ofrecido solo cuando el presupuesto aún no tiene notas de proceso. Todo lo que el modelo tendría que adivinar queda entre [corchetes] para que usted lo complete.",
          ] },
        ],
      },
      {
        id: "how-to",
        heading: "Cómo revisar un presupuesto",
        blocks: [
          { steps: [
            "Arme el presupuesto como siempre. El indicador **No falta nada evidente** / **Vale la pena mirarlo** del constructor ejecuta las mismas comprobaciones de completitud en vivo, gratis, mientras usted escribe.",
            "Pulse **Guardar y revisar**. El presupuesto se guarda como borrador y se reabre con la revisión en marcha.",
            "En un presupuesto existente, ábralo, pulse **Editar** y pulse **Review this quote** en el panel **Review & optional extras**. Una vez que existe una revisión, el botón dice **Review again**.",
            "Recorra la lista. Copie en la línea cualquier reescritura con la que esté de acuerdo, pulse **Add** en los extras que quiera ofrecer, y **Use this** en el borrador de «qué pasa después» si no ha escrito uno.",
          ] },
          { figure: "live:app-quotes-new", caption: "Nueva cotización — el constructor, con Revisar, Guardar como borrador y Guardar y enviar en la barra inferior." },
          { tip: "Reabrir un presupuesto nunca gasta nada: la última revisión queda guardada en el presupuesto y se muestra de nuevo con su hora **Last reviewed**. Solo pulsar el botón ejecuta una nueva." },
        ],
      },
      {
        id: "what-it-does-and-does-not",
        heading: "Qué hace la revisión, y qué no",
        blocks: [
          { bullets: [
            "Compara con **su propio historial únicamente** — el panel lo dice bajo la comprobación de precio — y exige al menos 5 presupuestos aceptados del mismo tipo antes de llamar alto o bajo a un precio.",
            "**Nunca cambia un número**. Sin precio sugerido, sin total reescrito; el modelo ve los precios para escribir sobre claridad, no para hacer aritmética con ellos.",
            "**Nunca afirma una medida, un material ni una marca a partir de una foto**, y el texto dentro de una fotografía se trata como parte de la imagen, nunca como una instrucción.",
            "Cada ejecución cuenta contra la asignación mensual de FieldQuo AI de su empresa. Si la asignación se agota, el botón lo dice y nombra el día en que se renueva, en lugar de devolver media revisión.",
            "Si no se puede llegar al modelo, las comprobaciones, la comparación de precio y los extras basados en el historial igual vuelven; solo falta la redacción.",
          ] },
        ],
      },
      {
        id: "who-can-see-it",
        heading: "Quién puede ejecutarla",
        blocks: [
          { p: "Cualquier persona cuyo acceso le permita crear y editar presupuestos — los niveles **Estimator**, **Dispatcher** y **Manager**, los administradores y el propietario. Alguien con presupuestos de solo lectura puede leer una revisión guardada pero no ejecutar una nueva. La cuadrilla nunca ve presupuestos. La revisión no se ofrece en un presupuesto que el cliente ya aprobó o rechazó." },
        ],
      },
      {
        id: "only-in-fieldquo",
        heading: "Solo en FieldQuo",
        blocks: [
          { p: "Una revisión del presupuesto en sí — qué le falta, cómo queda su precio frente a los que usted ganó, una redacción más clara — no figura en la página de precios de Jobber, Housecall Pro, ServiceTitan, Projul ni QuoteIQ en ningún nivel. FieldQuo la ejecuta en todos los planes, y la mitad de las comprobaciones corre gratis." },
        ],
      },
    ],
    faq: [
      { q: "¿La revisión le envía algo al cliente?", a: "No. Lee el presupuesto y escribe sugerencias para usted. Enviar es un botón aparte, y nada de lo que produjo la revisión llega al cliente a menos que usted lo haya copiado." },
      { q: "¿Por qué la comprobación de precio dice que no tiene con qué comparar?", a: "Necesita al menos 5 presupuestos aceptados para los mismos servicios. Dos presupuestos pasados son una coincidencia, no un patrón, y un veredicto construido sobre ellos sería peor que el silencio. Mejora a medida que usted envía más." },
      { q: "¿De dónde salen los extras sugeridos?", a: "De servicios que aparecieron junto a los de este presupuesto en sus propios presupuestos aceptados y enviados, al precio mediano que usted realmente cobró por ellos. Vea [[upsell-add-ons|Extras opcionales que el cliente puede aceptar]]." },
    ],
  },

  "the-ai-deep-photo-read": {
    title: "La lectura profunda de fotos con IA",
    summary:
      "Un examen de pago y más detallado de las fotos de un presupuesto — hasta 8, a resolución completa — que lista lo que un vistazo rápido pasa por alto, para que usted lo compruebe en obra.",
    updated: "2026-09-12",
    intro: [
      "Cada [[ai-quote-review|revisión del presupuesto con IA]] ya echa un vistazo gratuito a las fotos, a la resolución más baja que ofrece el modelo. Eso alcanza para reconocer una habitación, no una fisura capilar en una puerta de MDF ni un daño por agua en la base de un gabinete. La lectura profunda es el otro extremo de ese compromiso: usted la pide, usted la paga, y el modelo lee las fotos a resolución completa.",
    ],
    sections: [
      {
        id: "overview",
        heading: "Resumen",
        blocks: [
          { p: "La tarjeta **Deep photo read** (se muestra en inglés por ahora) está debajo de la revisión, en la página de edición del presupuesto. Funciona sola — no hace falta ejecutar la revisión gratuita primero — y cada lectura pasada queda en el presupuesto con su fecha, cuántas fotos se leyeron y cuánto costó, porque cada una es dinero ya gastado." },
          { table: {
            head: ["Qué cambia", "Comprobación gratuita (en la revisión)", "Lectura profunda"],
            rows: [
              ["Fotos leídas", "Hasta 4", "Hasta 8"],
              ["Resolución", "Baja — tarifa plana", "Alta — detalle completo"],
              ["Costo", "Incluido en la revisión", "US$0.25 de crédito de IA por ejecución"],
              ["Qué devuelve", "Notas cortas para comprobar en obra", "Notas cortas para comprobar en obra, de un examen más cercano"],
            ],
          } },
        ],
      },
      {
        id: "how-to",
        heading: "Cómo ejecutarla",
        blocks: [
          { steps: [
            "Ponga crédito de IA en la cuenta: **Configuración → Crédito de IA**, la tarjeta **Crédito de imágenes con IA**, **Agregar crédito**. El saldo muestra cuántas lecturas profundas cubre.",
            "Abra el presupuesto, pulse **Editar** y busque la tarjeta **Deep photo read**. La pastilla junto al título dice si el saldo cubre una lectura.",
            "Pulse **Run deep read**. La lectura tarda unos segundos; las notas aparecen en una tarjeta fechada debajo. Pulse **Run again** para otra pasada después de agregar fotos.",
            "Recorra las notas en obra. Cada una es cautelosa a propósito — «looks like», «check» — porque el modelo vio un ángulo de un momento.",
          ] },
          { figure: "live:app-settings-ai-credit", caption: "Configuración → Crédito de IA — la tarjeta Crédito de imágenes con IA indica cuánto cuesta una lectura profunda y cuántas cubre el saldo." },
          { note: "Un presupuesto sin fotos rechaza la lectura — no hay nada que mirar, y no se cobra nada. Si la lectura no puede ejecutarse por cualquier otro motivo, el crédito se reembolsa y la tarjeta dice que no se cobró nada." },
        ],
      },
      {
        id: "what-it-costs",
        heading: "Cuánto cuesta",
        blocks: [
          { p: "Un monto fijo de **US$0.25** por ejecución, del saldo **Crédito de imágenes con IA** — el mismo saldo del que sale la generación de imágenes con IA, y a propósito no el saldo telefónico. Es fijo y no por foto para que nunca le enseñe a subir menos imágenes; todo el valor está en ver más de ellas." },
          { bullets: [
            "Si el saldo no alcanza, el botón abre un diálogo de recarga que nombra el precio, el saldo y el faltante al centavo. No se cobra nada al volver — usted pulsa el botón de nuevo cuando esté listo.",
            "Las recargas únicas son de US$10, US$30, US$50 y US$100. Un plan mensual sobre el mismo saldo cuesta menos por crédito, y el crédito sin usar se acumula.",
            "La comprobación gratuita de la revisión no se cobra y sigue funcionando compre usted crédito o no.",
          ] },
        ],
      },
      {
        id: "what-it-never-does",
        heading: "Qué nunca hace",
        blocks: [
          { bullets: [
            "Nunca escribe en el presupuesto — ni una línea, ni una nota, ni un precio. La tarjeta lo dice bajo cada resultado: «Nothing has been added to the quote.»",
            "Nunca afirma una medida, un material ni una marca a partir de una foto. Una foto no trae cinta métrica.",
            "Nunca llega al cliente. Las notas son para el estimador, y nada en la página o el PDF del cliente proviene de ellas.",
          ] },
        ],
      },
      {
        id: "who-can-see-it",
        heading: "Quién puede ejecutarla",
        blocks: [
          { p: "Cualquiera que pueda crear y editar presupuestos — **Estimator** en adelante. Comprar crédito necesita a alguien que pueda administrar el equipo (Dispatcher, Manager, administrador o propietario), que es a quien se le muestra la oferta de recarga. La tarjeta no se muestra en un presupuesto que el cliente ya decidió, salvo que haya una lectura pasada registrada." },
        ],
      },
      {
        id: "only-in-fieldquo",
        heading: "Solo en FieldQuo",
        blocks: [
          { p: "La lectura profunda se cobra por uso dentro del constructor de presupuestos en lugar de venderse como nivel de plan, y por eso no aparece en absoluto en las tablas comparativas de FieldQuo. Ninguna página de precios de Jobber, Housecall Pro, ServiceTitan, Projul ni QuoteIQ lista una lectura de las fotos de un presupuesto, en ningún nivel." },
        ],
      },
    ],
    faq: [
      { q: "¿Tengo que ejecutar la revisión gratuita antes de la lectura profunda?", a: "No. Son independientes. La lectura profunda lee los servicios del presupuesto para no repetir lo que el documento ya dice, y luego lee las fotos." },
      { q: "¿Por qué el precio es el mismo para dos fotos y para ocho?", a: "Es fijo a propósito. Un contador por foto lo empujaría a adjuntar menos imágenes, que es lo contrario de para lo que sirve la lectura. Ocho es el tope sobre el que se calcula el precio fijo." },
      { q: "¿De dónde sale el dinero?", a: "Del saldo Crédito de imágenes con IA en Configuración → Crédito de IA, en dólares estadounidenses. El saldo de la recepcionista telefónica es aparte y una lectura profunda nunca lo toca." },
    ],
  },

  "upsell-add-ons": {
    title: "Extras opcionales que el cliente puede aceptar",
    summary:
      "Extras opcionales al pie del presupuesto, cada uno con su precio, que el cliente marca en la página de aprobación — el total se actualiza, y el servidor es quien calcula.",
    updated: "2026-09-12",
    intro: [
      "El ingreso más barato del negocio es el extra que el cliente agrega por su cuenta mientras ya está diciendo que sí. Protectores de canaletas en un techo, bisagras de cierre suave en un trabajo de gabinetes, el pasillo cuando se pintan los dormitorios. FieldQuo los pone al pie del presupuesto como casillas con precio, y el total aprobado incluye lo que se haya marcado.",
      "El navegador del cliente solo envía los identificadores de las casillas marcadas. Los montos quedan en el servidor y ahí se suman, así que nadie puede convertir una página web en un trabajo más barato.",
    ],
    sections: [
      {
        id: "overview",
        heading: "Resumen",
        blocks: [
          { p: "Los extras se administran en el panel **Review & optional extras** de la página de edición, bajo **Offered at the bottom of the quote** (este panel se muestra en inglés por ahora). Cada fila tiene una descripción, un precio, una razón de una línea y una casilla **Taxable**. Se guardan con su propio botón **Save extras**, aparte del presupuesto — el panel muestra **Unsaved** hasta que usted lo pulsa." },
          { note: "En la página del cliente aparecen bajo **Extras opcionales** con la indicación «Marque lo que desee añadir. El total se actualiza sobre la marcha — no se cobra nada hasta que usted apruebe.» Una vez que el cliente decidió, la lista pasa a ser el registro de lo elegido." },
        ],
      },
      {
        id: "where-they-come-from",
        heading: "De dónde sale un extra",
        blocks: [
          { bullets: [
            "**Sugerido por su historial.** Después de una [[ai-quote-review|revisión del presupuesto con IA]], el panel lista **You often sell these alongside this work** — servicios que aparecieron junto a los de este presupuesto en sus propios presupuestos pasados, con qué frecuencia y cuánto suele cobrar. Pulse **Add** para convertir uno en fila. Un servicio sin historial de precio llega con el precio vacío en lugar de uno inventado.",
            "**Agregado a mano.** **Add one** abre una fila en blanco. Escriba el extra, el precio y, de preferencia, una frase sobre por qué vale la pena — esa frase es lo que lee el cliente.",
            "**Marcado como opcional en un levantamiento.** En el levantamiento de pintura, un área o un sustrato puede marcarse como opcional; sale del alcance con precio y reaparece aquí como una fila valorada con su propia tarifa. Esas filas se reconstruyen desde el levantamiento cada vez que se guarda el presupuesto, así que se muestran de solo lectura — cambie la habitación, no la fila.",
          ] },
        ],
      },
      {
        id: "how-to",
        heading: "Cómo ofrecer extras en un presupuesto",
        blocks: [
          { steps: [
            "Guarde el presupuesto — los extras necesitan un presupuesto que exista. Ábralo y pulse **Editar**.",
            "En **Review & optional extras**, pulse **Review this quote** si quiere sugerencias basadas en el historial, o **Add one** para escribir los suyos.",
            "Dé a cada fila una descripción y un precio mayor que cero. El guardado rechaza un extra sin precio nombrándolo: «Give every optional extra a price before saving».",
            "Desmarque **Taxable** solo en un extra que de verdad no lleve impuesto; todo lo demás se grava como el resto del trabajo.",
            "Pulse **Save extras** y luego envíe el presupuesto como siempre.",
          ] },
        ],
      },
      {
        id: "what-the-client-sees",
        heading: "Qué ve el cliente, y qué le dicen a usted",
        blocks: [
          { p: "En la página de aprobación cada extra es una casilla con su descripción, su razón y su precio. Marcar una mueve el total en la página; aprobar envía solo los identificadores de las casillas marcadas, y el servidor recalcula subtotal, impuesto y total a partir de los precios que almacenó." },
          { bullets: [
            "El total aprobado, extras incluidos, es por el que se emite la factura y el que reparte el calendario de pagos.",
            "El correo al propietario y a los administradores lo dice en el asunto — «… approved Q-2026-0012 — plus $340.00 in extras» — y lista lo que se agregó.",
            "De vuelta en el presupuesto, cada fila elegida lleva **The client added this**, y el bloque de totales dice **Aprobada con extras**.",
          ] },
        ],
      },
      {
        id: "rules",
        heading: "Las reglas",
        blocks: [
          { bullets: [
            "Como máximo **8** extras por presupuesto. Más que un puñado es un segundo presupuesto, no una venta adicional, y el tope se aplica también a las filas del levantamiento.",
            "Cada extra necesita un precio mayor que cero antes de poder guardarse.",
            "Una vez que el cliente aprobó o rechazó, la lista queda bloqueada: «This quote has already been accepted. Create a new quote to change what's on offer.»",
            "Los extras están en la página de aprobación y en el PDF aprobado. No son líneas del alcance del presupuesto, así que las comprobaciones de líneas de la revisión con IA no se les aplican.",
          ] },
        ],
      },
      {
        id: "who-can-see-it",
        heading: "Quién puede editarlos",
        blocks: [
          { p: "Cualquiera que pueda crear y editar presupuestos — **Estimator**, **Dispatcher**, **Manager**, los administradores y el propietario. El acceso de solo lectura ve la lista y no puede cambiarla." },
        ],
      },
      {
        id: "only-in-fieldquo",
        heading: "Solo en FieldQuo",
        blocks: [
          { p: "Extras que el cliente marca por sí mismo, valorados según su propio historial, no figuran en la página de precios de Housecall Pro, ServiceTitan ni QuoteIQ en ningún nivel. Jobber lista «Upsell services with optional line items» y Projul lista «Selections»; lo que ninguno de los dos lista es la sugerencia — qué extras suele llevar este tipo de trabajo, al precio que usted realmente cobró." },
        ],
      },
    ],
    faq: [
      { q: "¿Puede un cliente cambiar el precio de un extra?", a: "No. La página solo envía qué casillas se marcaron. Cada monto se vuelve a leer de las propias filas del servidor cuando llega la aprobación, así que editar la página cambia lo que él ve y nada más." },
      { q: "¿Por qué una fila está en gris?", a: "Vino de un levantamiento — un área marcada como opcional. Se reconstruye desde el alcance cada vez que se guarda el presupuesto, así que editarla aquí se desharía en el siguiente guardado. Cámbiela en el levantamiento." },
      { q: "¿Los extras estándar de mi lista de precios son lo mismo?", a: "No. Los productos «extra» de la lista de precios (manijas, bisagras de cierre suave, etc.) son líneas ordinarias que usted agrega al alcance del presupuesto. Los extras de este artículo son las filas opcionales, marcables por el cliente, al pie del documento. Vea [[lines-from-your-price-book|Líneas desde su lista de precios]]." },
    ],
  },

  "good-better-best-options": {
    title: "Opciones bueno, mejor, el mejor",
    summary:
      "Tres presupuestos vinculados a tres precios para un mismo trabajo. La valoración y la numeración existen tras bambalinas; la pantalla para armar un trío todavía no — así que hoy usted arma los tres por su cuenta.",
    updated: "2026-09-12",
    intro: [
      "Ofrecer un mismo trabajo a tres precios — una versión básica, una recomendada y una premium — es una forma conocida de llevar la conversación de «sí o no» a «cuál». FieldQuo tiene los cimientos, y esta página dice con honestidad cuánto de eso puede usar hoy.",
    ],
    sections: [
      {
        id: "overview",
        heading: "Resumen",
        blocks: [
          { p: "Tras bambalinas, FieldQuo puede crear tres presupuestos vinculados de una vez — Good, Better y Best — que comparten un grupo y se numeran en serie: **Q-2026-0012-G**, **-B** y **-T**. Cada uno es un presupuesto completo e independiente, con sus propias líneas y su propio total, así que editar Better nunca toca Good ni Best." },
          { warning: "La valoración detrás está construida y los tres presupuestos pueden producirse tras bambalinas, pero todavía no hay pantalla para eso — así que hoy usted armaría los tres por su cuenta. Consúltenos antes de comprar por esta función." },
        ],
      },
      {
        id: "what-exists-today",
        heading: "Qué existe hoy",
        blocks: [
          { bullets: [
            "La numeración de tres (**-G**, **-B**, **-T** después del número de presupuesto) y el vínculo entre los tres, en el servidor.",
            "Ningún botón del constructor ni de la lista de presupuestos crea un trío, y ninguna pantalla muestra los tres lado a lado. La lista muestra cada uno como un presupuesto ordinario.",
            "La página de aprobación del cliente muestra un solo presupuesto. No existe una página donde un cliente elija entre tres.",
          ] },
        ],
      },
      {
        id: "package-tiers",
        heading: "No es lo mismo: paquetes en un solo presupuesto",
        blocks: [
          { p: "Para oficios que venden un menú y no una medida — retiro de escombros por tamaño de carga, detallado automotriz en Bronze, Silver, Gold y Platinum, deshollinado por nivel de inspección — el constructor muestra un selector de nivel dentro del servicio. Elegir uno crea la línea única de ese servicio. Eso es un presupuesto con un paquete elegido por usted, no tres presupuestos entre los que elige el cliente." },
        ],
      },
      {
        id: "what-to-do-instead",
        heading: "Qué hacer mientras tanto",
        blocks: [
          { steps: [
            "Arme la versión recomendada como presupuesto y ponga las mejoras al pie como [[upsell-add-ons|extras opcionales]] que el cliente puede marcar — así tiene «mejor» y «el mejor» en una sola página, con el servidor valorándolos.",
            "Si necesita una alternativa realmente más barata, arme un segundo presupuesto para el mismo cliente y diga en las notas cuál es cuál. Ambos aparecen en la ficha del cliente.",
            "No le prometa a un cliente una página de elección entre tres. Todavía no existe.",
          ] },
        ],
      },
    ],
    faq: [
      { q: "¿Habrá una pantalla para esto?", a: "Está en la lista, y la numeración y el vínculo entre los tres ya están construidos para que la pantalla pueda apoyarse en ellos. No hay fecha. Consulte antes de comprar por esta función." },
      { q: "¿Puedo mostrar tres precios en un presupuesto hoy?", a: "Lo más cercano es un presupuesto con extras opcionales: el precio base es «bueno», y los extras marcados lo llevan a «mejor» o «el mejor». Vea Extras opcionales que el cliente puede aceptar." },
    ],
  },

  "cost-and-margin-on-a-quote": {
    title: "Costo y margen en un presupuesto",
    summary:
      "Lo que el trabajo le cuesta — mano de obra, materiales, gastos generales — y lo que queda, calculado junto al precio mientras usted presupuesta. Interno, y nunca mostrado al cliente.",
    updated: "2026-09-12",
    intro: [
      "Una pantalla de presupuesto muestra un precio. El panel **Costo y margen** muestra lo que ese precio le cuesta entregar y lo que sobra, y su propio encabezado dice lo que es: «interno — nunca se muestra al cliente». Es la diferencia entre presupuestar un trabajo y saber si lo quiere.",
      "Los materiales salen de recetas — lo que le cuesta un litro de imprimación y cuánto consume una cocina de 24 puertas —, la mano de obra de las horas a la tarifa que usted paga, los gastos generales de lo que le dijo a FieldQuo que gasta cada mes. La pastilla de margen es el objetivo: verde, ámbar o roja antes de pulsar Enviar.",
    ],
    sections: [
      {
        id: "overview",
        heading: "Resumen",
        blocks: [
          { p: "El panel está en el constructor bajo los servicios, y de nuevo en la página del presupuesto bajo **Costo y margen** con **Costearlo ahora** y **Cambiar el costeo**. Se mide contra un margen objetivo del **30 %**. Lo que usted ingresa se guarda con el presupuesto, así que al reabrirlo más tarde ve el margen al que realmente presupuestó y no una estimación nueva." },
          { note: "Solo aparece a las personas cuyo nivel de acceso tiene el interruptor **Costeo de trabajos**. Gire una laptop hacia un cliente para mostrarle el precio y este panel no está en la página que él ve; tampoco está en el PDF, el correo ni la página de aprobación." },
        ],
      },
      {
        id: "on-the-quote",
        heading: "Qué hay en el panel",
        blocks: [
          { bullets: [
            "**Crew — hours are shared between them** (las filas del panel se muestran en inglés por ahora). Agregue personas por nombre o desde su equipo; cada una tiene un costo por hora y, si quiere, sus propias horas. En blanco, las horas que predice una receta se reparten por igual. Un trabajador sin tarifa registrada entra a $0 y la pastilla dice «labour not costed».",
            "**Overhead** — ya sea **% of price** (el 10 % inicial, etiquetado «estimated») o **this job's share**, una vez que [[the-break-even-price|Configuración → Gastos generales]] conoce sus costos mensuales y sus trabajos por semana.",
            "**Extra labour hours** — horas más allá de lo que predice la receta, cobradas a la tarifa de la cuadrilla.",
            "**Extra material cost** — lo que usted compra para este trabajo: una cotización de proveedor, una losa, un alquiler.",
            "**Materials**, **Labour**, **Overhead**, **Estimated cost**, **Quote price (pre-tax)** y **Estimated profit** con el porcentaje de margen. Las líneas de materiales de una receta muestran su cantidad y su precio unitario, ambos editables para este trabajo.",
            "Una nota sobre de dónde salió la cifra de gastos generales, y una nota cuando algunos servicios del presupuesto no tienen receta — entonces su costo no está en la cifra y el panel lo dice.",
          ] },
        ],
      },
      {
        id: "margin-badge",
        heading: "Qué significa la pastilla",
        blocks: [
          { table: {
            head: ["Pastilla", "Significado"],
            rows: [
              ["Verde — «32% margin»", "La ganancia está en el objetivo del 30 % o por encima, con cada miembro de la cuadrilla costeado."],
              ["Ámbar — «below 30% target», «labour not costed», «some labour not costed»", "La ganancia es positiva pero está bajo el objetivo, o falta un costo — un miembro sin tarifa, o ninguna cuadrilla — así que el margen real es menor que el número."],
              ["Roja — «losing money»", "El costo estimado supera el precio."],
            ],
          } },
        ],
      },
      {
        id: "material-costs-settings",
        heading: "Sus propios costos de materiales",
        blocks: [
          { p: "Las recetas parten de los números de FieldQuo y están hechas para reemplazarse por los suyos. **Configuración → Costos de materiales** tiene una tarjeta por oficio con receta — **Restauración de gabinetes** y **Pintura exterior** hoy — con manos, rendimiento, precio por galón, endurecedor, horas de preparación y consumibles. Una tarjeta marcada **Personalizado** lleva sus cifras; **Restablecer valores predeterminados** las descarta, y pregunta antes." },
          { steps: [
            "Abra **Configuración → Costos de materiales**. La pantalla solo muestra un oficio que usted activó en **Configuración → Servicios y precios**; si no, lo dice.",
            "Cambie los números que conoce — su precio de imprimación, el rendimiento de su capa final, sus horas de preparación — y deje el resto en el valor predeterminado.",
            "Pulse **Guardar**. Cada presupuesto costeado desde entonces usa sus cifras; los ya costeados conservan las cifras con las que se guardaron.",
            "Ajuste **Cuándo preguntar si revisar tus costos** — el porcentaje por encima de la estimación a partir del cual el cierre de un trabajo terminado pregunta si actualizar estas tarifas según lo que realmente costó. Un trabajo que salió por debajo nunca pregunta.",
          ] },
          { figure: "harness:settings-material-costs", caption: "Configuración → Costos de materiales — el umbral de revisión, y luego la receta de Restauración de gabinetes con manos, rendimiento y precio por galón." },
          { tip: "Una línea de material sin precio subestima el margen, y el panel lo dice. Escriba el precio junto a la línea para este trabajo, o fíjelo en la lista de precios en Configuración → Servicios y precios para conservarlo." },
        ],
      },
      {
        id: "who-can-see-it",
        heading: "Quién puede verlo",
        blocks: [
          { p: "El panel, la sección de costo de la página del presupuesto, **Configuración → Costos de materiales** y **Configuración → Gastos generales** dependen todos del interruptor **Costeo de trabajos**. Entre los preajustes solo **Manager**, los administradores y el propietario lo tienen; un **Estimator** o un **Dispatcher** presupuesta sin ver nunca un costo. El propietario puede otorgar el interruptor a quien quiera en el editor de acceso personalizado." },
        ],
      },
    ],
    faq: [
      { q: "¿Por qué el margen se ve demasiado bueno?", a: "Casi siempre porque falta un costo. Nadie en la cuadrilla significa que la mano de obra no cuesta nada; una línea de material sin precio cuenta como cero; un servicio sin receta queda fuera por completo. El panel nombra cada caso con palabras — lea la pastilla ámbar y las notas bajo la tabla." },
      { q: "¿De dónde sale la cifra de gastos generales?", a: "Hasta que usted complete Configuración → Gastos generales y sus trabajos por semana, es un 10 % fijo del precio y se etiqueta como estimado. Después, son sus costos fijos mensuales reales divididos por su capacidad mensual de trabajos." },
      { q: "¿El cliente ve algo de esto alguna vez?", a: "No. Ni en la página de aprobación, ni en el PDF, ni en el correo. El encabezado lo dice, y la API que construye esos documentos nunca lee el costeo." },
    ],
  },

  "the-break-even-price": {
    title: "El precio de equilibrio",
    summary:
      "El precio más bajo al que puede salir un trabajo y aun así cubrir el negocio — sus gastos generales mensuales reales divididos por cuántos trabajos puede asumir — y dónde aparece esa cifra en un presupuesto.",
    updated: "2026-09-12",
    intro: [
      "Todo contratista tiene un número que nunca ha podido calcular: ¿por debajo de qué precio un trabajo me hace perder dinero antes de trabajar una sola hora? FieldQuo lo calcula a partir de sus propios costos fijos, salarios, deudas y equipos, y lo muestra en **Configuración → Gastos generales** como **Tu precio mínimo**.",
      "No es una regla de dedo ni un promedio de la industria. Es su alquiler, su camioneta y su sueldo de oficina, divididos por los trabajos que usted dijo que puede hacer en una semana.",
    ],
    sections: [
      {
        id: "overview",
        heading: "Resumen",
        blocks: [
          { p: "**Configuración → Gastos generales** son dos cosas: los registros donde viven sus costos mensuales, y la tarjeta de arriba que los convierte en un precio piso. El piso se niega a existir hasta que usted le diga cuántos trabajos por semana puede asumir — «sin eso no hay nada entre lo que dividir sus gastos generales» —, porque un piso construido sobre una capacidad inventada es un número inventado." },
          { p: "El mismo costo por trabajo alimenta el panel [[cost-and-margin-on-a-quote|Costo y margen]] de cada presupuesto, reemplazando el 10 % fijo por su parte real de gastos generales." },
        ],
      },
      {
        id: "what-is-on-the-screen",
        heading: "Qué hay en la pantalla",
        blocks: [
          { bullets: [
            "**Tu precio mínimo** — la casilla **Trabajos por semana**, **Guardar**, y luego cuatro cuadros: **Costos fijos mensuales**, **Trabajos / mes**, **Costo por trabajo** y **Precio mínimo**, con una línea que dice qué incluye el total y el margen objetivo que supone.",
            "**Horas pagadas que nunca llegaron a un trabajo** — la semana que usted garantiza a la gente frente a las horas que realmente registraron en trabajos, últimos 30 días. Se informa, y a propósito **no** se cuenta en el precio de arriba; el recuadro lo dice.",
            "**Costos fijos** — alquiler, seguro, teléfono, suscripciones: todo lo que llega gane usted un trabajo o no, mensual o anual.",
            "**Salarios** — solo gastos generales del negocio: su propio retiro, un sueldo de oficina. No la cuadrilla, cuyas horas ya se cargan a cada trabajo como mano de obra.",
            "**Deuda** — préstamos y contratos de financiamiento con un capital, un pago mensual y una tasa de interés.",
            "**Activos y depreciación** — la camioneta, el remolque, el equipo de pintura: cuánto costó, cuánto vale de reventa, cuántos meses durará y qué préstamo lo pagó.",
            "**Facturas por pagar** — pendientes, vencen este mes y vencidas, con **Marcar pagada**.",
          ] },
        ],
      },
      {
        id: "how-to",
        heading: "Cómo obtener su número",
        blocks: [
          { steps: [
            "Abra **Configuración → Gastos generales** y complete los registros: costos fijos, salarios, cualquier deuda, cualquier activo que valga más de unos cientos de dólares.",
            "Vincule un activo al préstamo que lo pagó. El préstamo entonces cuenta solo por sus intereses y la depreciación del activo carga su costo — de lo contrario la misma camioneta se cobra dos veces, y la pantalla le avisa cuando ve ese patrón.",
            "Escriba **Trabajos por semana** — una semana normal para su cuadrilla — y pulse **Guardar**.",
            "Lea **Precio mínimo**. Todo lo presupuestado por debajo no cubre el taller antes siquiera de contar materiales y mano de obra.",
          ] },
          { figure: "harness:settings-overhead", caption: "Configuración → Gastos generales — Tu precio mínimo con sus cuatro cuadros, y la nota que explica qué incluye el total." },
          { note: "Los cuadros dan **Costo por trabajo** como los gastos generales que un trabajo tiene que cargar, y **Precio mínimo** como ese costo a un margen objetivo del **20 %**. Los materiales y la mano de obra del trabajo concreto van aparte — la nota bajo los cuadros lo dice." },
        ],
      },
      {
        id: "the-arithmetic",
        heading: "La aritmética",
        blocks: [
          { table: {
            head: ["Cifra", "Cómo se calcula"],
            rows: [
              ["Costos fijos mensuales", "Costos fijos + salarios + deuda, más la depreciación de sus activos y el interés de sus préstamos. Un préstamo vinculado a un activo cuenta solo por su interés."],
              ["Trabajos / mes", "Trabajos por semana × 4.33."],
              ["Costo por trabajo", "Costos fijos mensuales ÷ trabajos por mes."],
              ["Precio mínimo", "Costo por trabajo ÷ (1 − 20 %)."],
            ],
          } },
        ],
      },
      {
        id: "where-it-shows-up",
        heading: "Dónde aparece",
        blocks: [
          { bullets: [
            "En el panel **Costo y margen** de cada presupuesto como **Overhead (this job's share)**, con una nota: «Overhead is $15,629.90/month of fixed costs spread across 6.5 jobs a month.»",
            "En **Configuración → Control de gastos**, donde el **Ritmo de gasto mensual** es la versión en efectivo de los mismos registros — el efectivo y el costo difieren cuando un préstamo devuelve capital, y la pantalla de Gastos generales lo dice cuando ocurre.",
          ] },
        ],
      },
      {
        id: "who-can-see-it",
        heading: "Quién puede verlo",
        blocks: [
          { p: "**Configuración → Gastos generales** necesita el interruptor **Costeo de trabajos** y la capacidad de administrar el equipo: **Manager**, los administradores y el propietario de forma predeterminada. Las cifras también se le niegan a cualquiera sin ese interruptor cuando un presupuesto las pide, así que el constructor de un Estimator simplemente conserva la estimación del 10 %." },
        ],
      },
      {
        id: "only-in-fieldquo",
        heading: "Solo en FieldQuo",
        blocks: [
          { p: "Un precio piso calculado a partir de sus propios gastos generales no figura en la página de precios de Jobber, ServiceTitan ni QuoteIQ en ningún nivel. El «Flat-rate pricing» de Housecall Pro y el «Construction Financials, Job Costing & Budgeting» de Projul se cuentan como que lo cubren, con generosidad; ninguno de los dos describe un piso de gastos generales por trabajo." },
        ],
      },
    ],
    faq: [
      { q: "¿Por qué el precio mínimo está vacío?", a: "Los trabajos por semana no están definidos. La pantalla se niega a dividir sus gastos generales por un número que inventó. Escriba la capacidad de una semana normal y pulse Guardar." },
      { q: "¿Los sueldos de mi cuadrilla van en Salarios?", a: "No. Las horas de la cuadrilla se cargan a cada trabajo como mano de obra en el panel Costo y margen; ponerlas aquí además las cuenta dos veces. Salarios es para pagos fijos de gastos generales — su propio retiro, un sueldo de oficina, las horas de un contador." },
      { q: "¿El margen del 20 % es ajustable?", a: "Hoy no, en la pantalla. El precio mínimo se muestra a un margen objetivo del 20 % y lo dice bajo los cuadros. El panel Costo y margen de un presupuesto se mide contra un objetivo aparte del 30 %." },
    ],
  },

  "send-a-quote": {
    title: "Enviar un presupuesto",
    summary:
      "Un botón envía el presupuesto por correo a nombre de su empresa, en el idioma del cliente, con el PDF adjunto y un enlace de aprobación — y registra que salió.",
    updated: "2026-09-12",
    intro: [
      "Enviar es un botón, y hace exactamente una cosa: le manda un correo al cliente. El estado pasa a **Enviada** solo después de que el servicio de correo aceptó el mensaje, así que «Enviada por correo el 3 de julio» en un presupuesto es un hecho, no una intención.",
      "El correo lleva la sustancia del presupuesto — el total, el botón de aprobación, qué incluye, cómo se realiza el trabajo — porque un propietario lee tres presupuestos lado a lado en la misma bandeja, y un enlace pelado pierde contra una carta.",
    ],
    sections: [
      {
        id: "overview",
        heading: "Resumen",
        blocks: [
          { p: "Un presupuesto se envía desde dos lugares: **Guardar y enviar** al pie del constructor, que guarda y envía de una vez, y **Enviar** en la página del presupuesto, que pasa a ser **Enviar de nuevo** una vez que salió. Ambos preguntan primero **¿Enviar esta cotización?** — «La recibirán por correo de inmediato. No se puede deshacer.» Ambos usan la misma ruta, así que no pueden separarse." },
        ],
      },
      {
        id: "how-to",
        heading: "Cómo enviar",
        blocks: [
          { steps: [
            "Asegúrese de que el cliente tenga un correo en su ficha. Sin él, el envío se rechaza y dice a quién le falta la dirección.",
            "Abra el presupuesto y pulse **Enviar** — o, en el constructor, **Guardar y enviar**.",
            "Confirme en el diálogo **¿Enviar esta cotización?**. El destinatario aparece nombrado ahí.",
            "Lea el aviso verde: **Enviada a** y la dirección. La fila **Enviada por correo** debajo conserva la fecha y la dirección desde entonces.",
            "Si el cliente dice que nunca lo recibió, pulse **Enviar de nuevo**. Para recordárselo más tarde, pulse **Dar seguimiento** — un correo más corto con el mismo enlace, contado aparte.",
          ] },
          { figure: "live:app-quotes-new", caption: "Nueva cotización — Guardar y enviar en la barra inferior guarda el borrador y lo envía en un solo paso." },
          { note: "Enviar requiere un plan en la cuenta. Durante la prueba gratuita usted puede armar y valorar presupuestos con libertad; el acto de enviar uno por correo es lo que le pide terminar el registro, y el mensaje lo dice." },
        ],
      },
      {
        id: "what-the-client-receives",
        heading: "Qué recibe el cliente",
        blocks: [
          { bullets: [
            "Un correo a nombre de su empresa — desde su propio dominio una vez verificado en **Configuración → Dominio de correo**, o si no desde el remitente de FieldQuo con su nombre — con las respuestas dirigidas al correo de su empresa.",
            "El asunto **«Su presupuesto de Easy Roofers Inc. — Q-2026-0012»**, el total, un botón de aprobación justo debajo, luego qué incluye, cómo se realiza el trabajo y la fecha de vencimiento. El botón de aprobación se repite al pie. Vea [[the-quote-email|El correo del presupuesto]].",
            "El PDF del presupuesto adjunto, con sus colores — vea [[the-quote-pdf|El PDF del presupuesto]].",
            "Un enlace a la página de aprobación, donde lee, marca los extras, firma y aprueba — vea [[the-quote-approval-page|La página de aprobación del presupuesto]] y [[online-approval-and-signature|Aprobación y firma en línea]].",
          ] },
        ],
      },
      {
        id: "before-it-will-send",
        heading: "Por qué se rechaza un envío",
        blocks: [
          { bullets: [
            "**El cliente no tiene correo.** Agregue uno en su ficha y luego envíe.",
            "**Una estimación instantánea no ha sido aprobada.** Confirme primero el precio en Revisión de estimaciones — nada de lo que valoró un algoritmo llega a un propietario sin que una persona pulse Aprobar.",
            "**El presupuesto se registró como trabajo pasado.** Nunca se envía nada por historial importado, y el botón Enviar no aparece en esos.",
            "**Una sección del correo está activada sin contenido** — referencias o fotos de antes y después en **Configuración → Correo de presupuesto**. Agregue el contenido o quite la sección de este presupuesto.",
            "**La línea de impuesto no está resuelta.** Un presupuesto que cobra impuesto sin poder decir cuál se retiene hasta que usted elija una tasa, defina la provincia del cliente o desactive el impuesto para este presupuesto.",
            "**La cuenta aún no tiene plan.** Termine el registro; el aviso lo lleva ahí.",
          ] },
        ],
      },
      {
        id: "after-sending",
        heading: "Qué cambia después de un envío",
        blocks: [
          { bullets: [
            "Un borrador pasa a **Enviada**. Un presupuesto ya enviado conserva su estado y gana una nueva fecha de **Enviada por correo**.",
            "El lead vinculado, si lo hay, pasa de **Nuevo** a **Contactado** en el tablero de leads.",
            "**Obtener aprobación**, junto a Enviar, muestra ahora un enlace de cliente que funciona — el de un borrador sigue cerrado — con su estado y un lugar para registrar una respuesta dada por teléfono.",
            "El registro de actividad anota quién envió qué a qué dirección, y el presupuesto empieza a contar en el grupo **Cotización enviada, sin respuesta** de la lista hasta que el cliente responda.",
          ] },
        ],
      },
      {
        id: "who-can-see-it",
        heading: "Quién puede enviar",
        blocks: [
          { p: "Cualquier persona cuyo acceso le permita crear y editar presupuestos — **Estimator**, **Dispatcher**, **Manager**, los administradores y el propietario. El acceso de solo lectura no puede enviar." },
        ],
      },
    ],
    faq: [
      { q: "¿Puedo deshacer el envío de un presupuesto?", a: "No — el diálogo lo dice antes de que usted confirme. Puede reemplazar el enlace del cliente desde Obtener aprobación, lo que anula el anterior; cualquier correo ya enviado dejará entonces de abrir el presupuesto." },
      { q: "El estado dice Enviada pero el cliente nunca lo recibió.", a: "Pulse Enviar de nuevo en la página del presupuesto. Si el envío falla, FieldQuo dice por qué — una dirección faltante, un dominio sin verificar — y no marca el presupuesto como enviado." },
      { q: "¿En qué idioma sale el correo?", a: "En el idioma propio del presupuesto, fijado al crearlo; el idioma guardado del cliente se usa para todo lo que no está ligado a un documento. Vea [[quote-language|Un presupuesto conserva su idioma]]." },
    ],
  },

  "the-quote-pdf": {
    title: "El PDF del presupuesto",
    summary:
      "El PDF adjunto a cada correo de presupuesto lleva su logotipo, su color de marca y su nombre — nada en él dice FieldQuo — y sus secciones se pueden reordenar o quitar en Configuración → Plantillas PDF.",
    updated: "2026-09-12",
    intro: [
      "Cada presupuesto sale dos veces: como página web en la que el cliente aprueba, y como PDF que puede guardar, imprimir y pasarle a su pareja. Los dos se construyen con las mismas secciones y los mismos colores medidos, así que el PDF se ve como la página y ambos parecen venir de usted.",
    ],
    sections: [
      {
        id: "overview",
        heading: "Resumen",
        blocks: [
          { p: "El PDF se genera a partir de su color de marca, convertido en una paleta medida para que una marca blanca, amarilla o gris medio igual produzca encabezados legibles y una banda de totales visible. Usa el idioma propio del presupuesto para cada etiqueta y formato de fecha, y el diseño estándar de abajo a menos que usted haya marcado un diseño propio como en uso." },
          { p: "Las facturas reflejan los presupuestos a propósito: el PDF de factura tiene las mismas secciones en el mismo orden, menos el bloque de firma, para que el propietario reconozca el segundo documento como gemelo del primero." },
        ],
      },
      {
        id: "sections",
        heading: "Las secciones, de arriba abajo",
        blocks: [
          { table: {
            head: ["Sección", "Qué imprime"],
            rows: [
              ["Header", "Su logotipo y el nombre de la empresa en la parte superior."],
              ["Client details", "Para quién es el documento, y la dirección del trabajo."],
              ["Line items", "El trabajo en sí, agrupado por servicio, con el párrafo de alcance de cada servicio y qué incluye."],
              ["Totals", "Subtotal, descuento, impuesto y el monto adeudado."],
              ["How the work runs", "Pasos numerados que explican qué pasa después de aprobar, redactados por oficio."],
              ["Payment terms", "Sus condiciones de pago como tarjetas de porcentaje; oculta por completo si no definió ninguna."],
              ["Notes", "Lo que se escribió en las notas del presupuesto."],
              ["Signature block", "Líneas para una firma a mano, para clientes que prefieren firmar a hacer clic. Solo presupuestos."],
              ["Footer", "Datos de contacto y condiciones al pie."],
            ],
          } },
        ],
      },
      {
        id: "how-to-change-the-layout",
        heading: "Cómo cambiar el diseño",
        blocks: [
          { steps: [
            "Abra **Configuración → Plantillas PDF**. Dos tarjetas: **PDF de cotización** y **PDF de factura**. Una tarjeta vacía significa que se usa el diseño estándar — sus PDF ya funcionan.",
            "Pulse **Nuevo** en la tarjeta PDF de cotización, nombre el diseño (solo para su referencia — los clientes nunca ven el nombre) y elija **Empezar desde el diseño estándar** o **Copiar la actual**.",
            "En **Editar diseño**, reordene con **Mover hacia arriba** y **Mover hacia abajo**, **Quitar sección**, o **Agregar una sección**. **Vista previa con datos de ejemplo** lo genera antes de que usted se comprometa.",
            "Guarde, y luego pulse **Use this** en el diseño. La insignia **Activo** marca el que usa cada PDF de ahí en adelante.",
            "Si ninguno de sus diseños está marcado como activo, la pantalla avisa que los PDF siguen saliendo con el diseño estándar.",
          ] },
          { figure: "live:app-settings-templates", caption: "Configuración → Plantillas PDF — las tarjetas PDF de cotización y PDF de factura, cada una con el diseño estándar." },
          { note: "Quitar Header, Line items o Totals está permitido, y el editor le dice que el PDF no se verá como un documento terminado. Un diseño sin ninguna sección produce una página en blanco, y el editor también lo dice." },
        ],
      },
      {
        id: "where-the-pdf-goes",
        heading: "Adónde va el PDF",
        blocks: [
          { bullets: [
            "Adjunto al correo del presupuesto como **Quote-Q-2026-0012.pdf** cada vez que usted pulsa Enviar o Enviar de nuevo. Si el PDF no se genera, el correo sale igual y la falla se registra para soporte — el cliente nunca queda esperando por un error de generación.",
            "Regenerado después de que el cliente aprueba, con su firma, y enviado por correo a él y a los propietarios como la copia firmada.",
            "No se puede descargar desde la oficina hoy — la página del presupuesto no tiene botón de PDF. Su copia es el adjunto del correo de aprobación; antes de la aprobación, la copia del cliente es la del correo del presupuesto.",
            "Nunca se envía por un presupuesto registrado como trabajo pasado.",
          ] },
        ],
      },
      {
        id: "who-can-see-it",
        heading: "Quién puede cambiarlo",
        blocks: [
          { p: "**Configuración → Plantillas PDF** está abierta a cualquiera que pueda administrar el equipo: **Dispatcher**, **Manager**, los administradores y el propietario. Un **Estimator** puede enviar el presupuesto y así poner el PDF en la bandeja de un cliente, pero no puede cambiar su diseño." },
        ],
      },
    ],
    faq: [
      { q: "¿El PDF dice FieldQuo en alguna parte?", a: "No. El encabezado, el pie y cada sección son de su empresa. La única marca FieldQuo en una superficie de cara al cliente es el pequeño pie de página de un sitio web gratuito, y el PDF no lo es." },
      { q: "¿Puedo cambiar el texto de una sección?", a: "No en el editor de PDF — ordena y quita secciones. Los párrafos de alcance vienen de Configuración → Servicios y precios («Qué dice el presupuesto»), los pasos del proceso y las condiciones de Configuración → Configuración de la empresa, y las etiquetas del idioma del presupuesto." },
      { q: "¿Por qué falta la sección de condiciones de pago en mi PDF?", a: "No ha definido condiciones de pago en Configuración → Configuración de la empresa. La sección no aparece en absoluto en lugar de inventar un calendario por usted. Vea [[deposits-on-quotes|Anticipos en los presupuestos]]." },
    ],
  },

  "quote-statuses-and-what-they-mean": {
    title: "Los estados de un presupuesto, y qué significa cada uno",
    summary:
      "Borrador, Enviada, Aprobada y Rechazada — qué pone un presupuesto en cada uno, qué desbloquea cada uno, y las insignias que acompañan al estado en la lista de presupuestos.",
    updated: "2026-09-12",
    intro: [
      "Un presupuesto tiene exactamente cuatro estados, y las pastillas en la parte superior de la lista los cuentan. La insignia junto a un presupuesto es una promesa sobre lo que le pasó — **Enviada** significa que un correo fue aceptado, **Aprobada** que el cliente firmó o que usted registró su sí —, así que nada aquí cambia por sí solo.",
    ],
    sections: [
      {
        id: "overview",
        heading: "Resumen",
        blocks: [
          { p: "La lista de presupuestos abre con **Todos**, **Borrador**, **Enviada**, **Aprobada** y **Rechazada**, cada uno con su recuento, luego un buscador y la lista: número, estado, cliente, monto y antigüedad. Los presupuestos enviados y nunca respondidos se promueven arriba bajo **Cotización enviada, sin respuesta**, el más antiguo primero, para que el que más ha esperado sea el que usted ve primero." },
          { figure: "live:app-quotes", caption: "Cotizaciones — las pastillas de estado con su recuento, y luego cada presupuesto con su insignia, su cliente, su antigüedad y su monto." },
        ],
      },
      {
        id: "the-four-statuses",
        heading: "Los cuatro estados",
        blocks: [
          { table: {
            head: ["Estado", "Qué significa", "Cómo llega ahí un presupuesto"],
            rows: [
              ["Borrador", "En redacción. El enlace del cliente está cerrado — un cliente no puede abrir un presupuesto en el que usted aún trabaja.", "Todo presupuesto nuevo. Una estimación instantánea sigue siendo borrador mientras espera en Revisión de estimaciones y después de aprobarse ahí, hasta que usted la envía."],
              ["Enviada", "Enviada por correo al cliente y a la espera de respuesta. La página de aprobación está abierta.", "Pulsar Enviar, una vez que el servicio de correo acepta el mensaje. También se registra a mano cuando un presupuesto salió por otra vía."],
              ["Aprobada", "El cliente aceptó, al total aprobado con los extras incluidos. Existen un trabajo y una factura en borrador.", "El cliente firma en la página de aprobación, o usted pulsa La aprobaron en Obtener aprobación."],
              ["Rechazada", "El cliente dijo que no, con su motivo si lo dio.", "El cliente pulsa Rechazar en la página de aprobación, o usted pulsa La rechazaron y anota por qué."],
            ],
          } },
        ],
      },
      {
        id: "badges-beside-the-status",
        heading: "Insignias que acompañan al estado",
        blocks: [
          { bullets: [
            "**Requiere revisión** — una estimación instantánea que un propietario valoró en su sitio web, a la espera en Revisión de estimaciones. No puede enviarse hasta que alguien confirme el precio.",
            "**Aprobada — lista para enviar** — esa estimación una vez confirmado el precio. Sigue siendo borrador; la aprobación ahí es su empresa confirmando el precio, no el cliente aceptando.",
            "**Cotización enviada, sin respuesta** — el encabezado de grupo sobre los presupuestos enviados sin respuesta, con la antigüedad de cada uno y su fecha **Válida hasta**.",
            "**Vencida** en rojo, o **Válida hasta** en ámbar dentro de los 3 días previos a la fecha — solo en presupuestos enviados, porque un vencimiento en un presupuesto aprobado es historia.",
          ] },
        ],
      },
      {
        id: "changing-a-status-by-hand",
        heading: "Registrar una respuesta a mano",
        blocks: [
          { p: "La mayoría de los presupuestos del oficio se aprueban por teléfono o en una cocina, no con un clic. Si el único camino a Aprobada pasara por la página del cliente, los números de su embudo estarían mal." },
          { steps: [
            "Abra el presupuesto y pulse **Obtener aprobación**.",
            "En **Registrar su respuesta**, pulse **La aprobaron** o **La rechazaron** — este último pregunta «¿Dijeron por qué? (opcional)» y anota el motivo para sus reportes de ganados y perdidos.",
            "Una aprobación registrada a mano hace todo lo que hace una firmada — trabajo, factura en borrador, calendario de pagos, lead marcado como ganado — salvo guardar una firma.",
          ] },
        ],
      },
      {
        id: "who-can-see-it",
        heading: "Quién puede cambiar un estado",
        blocks: [
          { p: "Enviar y registrar una respuesta requieren acceso de creación y edición a presupuestos: **Estimator** en adelante. Eliminar un presupuesto requiere el nivel de eliminación — **Manager**, los administradores y el propietario —, y un presupuesto que ya se convirtió en factura no puede eliminarse en absoluto; anule la factura o marque el presupuesto como rechazado." },
        ],
      },
    ],
    faq: [
      { q: "¿Por qué no hay un estado Vencida?", a: "El vencimiento es una fecha en el presupuesto, no un estado. Un presupuesto enviado con la fecha pasada muestra Vencida en rojo en la lista y rechaza la aprobación en la página del cliente, pero sigue Enviada para que usted pueda correr la fecha y se abra de nuevo. Vea [[quote-validity-and-expiry|Cuánto tiempo sigue válido un presupuesto]]." },
      { q: "¿Puedo editar un presupuesto Aprobada?", a: "Sus líneas no se pueden cambiar — sería reescribir lo que se firmó. Cree un presupuesto nuevo, o vea [[edit-a-sent-quote|Editar un presupuesto que ya se envió]] para uno que solo está Enviada." },
      { q: "¿Por qué mi presupuesto dice Enviada sin fecha?", a: "Se marcó como enviado a mano, o se importó. La fecha bajo una insignia Enviada solo se escribe cuando un correo realmente se acepta, así que una aceptación por teléfono no lleva fecha de envío en lugar de una inventada." },
    ],
  },

  "quote-validity-and-expiry": {
    title: "Cuánto tiempo sigue válido un presupuesto",
    summary:
      "Cada presupuesto nuevo empieza con una fecha Válida hasta a 30 días; usted puede moverla o borrarla. Pasada la fecha, el cliente ya no puede aprobar en línea, la lista lo marca en rojo, y nada más cambia por sí solo.",
    updated: "2026-09-12",
    intro: [
      "Un presupuesto que nunca vence es un presupuesto sin motivo para responder hoy. También lo deja a usted sosteniendo un precio cuando el costo de los materiales se mueve. Por eso el constructor abre con una fecha de vencimiento ya rellenada — 30 días desde hoy — y la revisión se queja si usted la borra.",
    ],
    sections: [
      {
        id: "overview",
        heading: "Resumen",
        blocks: [
          { p: "**Válida hasta** está en la parte superior de la tarjeta de montos del constructor. La fecha es una sugerencia que usted ve y puede cambiar antes de guardar nada, no un valor escrito en su nombre: la línea debajo dice «Empieza a 30 días desde hoy. Cámbialo, o bórralo si este presupuesto nunca debe vencer.» Borrarla se respeta — el presupuesto se guarda sin vencimiento — y la línea cambia para decir que el cliente no tiene motivo para responder hoy." },
        ],
      },
      {
        id: "setting-the-date",
        heading: "Definir la fecha",
        blocks: [
          { steps: [
            "En el constructor, busque **Válida hasta** arriba de **Descuento** y **Tasa de impuesto (%)**. Cambie la fecha, o vacíe la casilla para que no venza.",
            "En un presupuesto existente, pulse **Editar** — la casilla muestra «La fecha que ya tiene este presupuesto» — y muévala.",
            "Guarde. La fecha se imprime en la página del cliente y en el correo como vencimiento, y en la lista de presupuestos como **Válida hasta** junto a la antigüedad del presupuesto.",
          ] },
          { figure: "live:app-quotes-new", caption: "Nueva cotización — Válida hasta, prellenada a 30 días, arriba de Descuento y Tasa de impuesto." },
          { note: "La fecha se guarda como día de calendario. Un presupuesto escrito a las 8 de la noche en Toronto recibe el día que usted ve en pantalla, no el que ya es en Londres." },
        ],
      },
      {
        id: "what-happens-when-it-passes",
        heading: "Qué pasa cuando la fecha se cumple",
        blocks: [
          { bullets: [
            "La página de aprobación del cliente muestra **Este presupuesto ha vencido** y «Comuníquese con Easy Roofers Inc. para un precio actualizado.» Aprobar y Rechazar desaparecen. Si pulsa Aprobar en el mismo minuto en que pasa la fecha, el servidor también lo rechaza.",
            "En la lista de presupuestos el presupuesto muestra **Vencida** y la fecha en rojo, con una barra roja en la fila. La barra también aparece en los 3 días previos, cuando **Válida hasta** se muestra en ámbar.",
            "La revisión con IA reporta **Already expired** como comprobación de gravedad alta: corra la fecha antes de enviar.",
            "El estado sigue **Enviada**. Adelante la fecha y la página de aprobación se abre de nuevo sin nada más que rehacer.",
            "El correo y el PDF siguen imprimiendo la fecha con la que se enviaron; un nuevo envío imprime la nueva.",
          ] },
        ],
      },
      {
        id: "what-fieldquo-does-not-do",
        heading: "Qué no hace FieldQuo",
        blocks: [
          { bullets: [
            "No cambia el estado a Vencida ni a Rechazada. El vencimiento es una fecha, no una decisión.",
            "No le envía un correo al cliente ni a usted cuando un presupuesto vence. Los seguimientos automáticos corren según el tiempo desde el envío, no según la fecha de vencimiento — vea [[quotes-sent-with-no-response|Presupuestos enviados sin respuesta]].",
            "No vuelve a valorar nada. El precio de un presupuesto vencido es el que usted escribió; mover la fecha es su decisión de sostenerlo.",
          ] },
        ],
      },
    ],
    faq: [
      { q: "¿Puedo cambiar el valor predeterminado de 30 días?", a: "Hoy no como ajuste de empresa. El constructor prellena 30 días en cada presupuesto nuevo; cambie la fecha en el presupuesto mismo." },
      { q: "Un cliente quiere aprobar un presupuesto que venció ayer.", a: "Abra el presupuesto, pulse Editar, adelante Válida hasta y guarde. El mismo enlace se abre de nuevo y puede firmar. Nada más cambia en el presupuesto." },
    ],
  },

  "quote-language": {
    title: "Un presupuesto conserva su idioma",
    summary:
      "Usted elige el idioma en que se escribe un presupuesto al crearlo, y lo conserva de por vida — el PDF, la página de aprobación y el correo que lo acompaña lo siguen, y nada se traduce automáticamente al enviar.",
    updated: "2026-09-12",
    intro: [
      "Hay dos idiomas en juego y son distintos. El primero es en el que usted trabaja — la aplicación misma, definido en **Configuración → Idioma**. El segundo es el que lee el cliente: el presupuesto, la factura, los correos. Un taller de Gatineau puede trabajar en inglés y presupuestar en francés; una cuadrilla hispanohablante puede enviar un presupuesto en inglés a un cliente angloparlante.",
      "Una regla merece decirse con claridad porque suena a limitación y en realidad es la parte tranquilizadora: un presupuesto conserva el idioma en el que se creó. Un documento firmado siempre dirá lo que decía cuando se firmó. Nada se vuelve a traducir a espaldas del cliente.",
    ],
    sections: [
      {
        id: "overview",
        heading: "Resumen",
        blocks: [
          { p: "Hay ocho idiomas disponibles para un cliente: inglés, francés, español, ucraniano, punyabí, tagalo, alemán e italiano. Cada uno tiene un juego de etiquetas de documento escrito a mano, un texto de correo de acompañamiento y una fuente de PDF capaz de componerlo. El idioma se elige una vez por presupuesto, en el constructor, y la página de edición luego dice: «Escrito en Español. Un presupuesto conserva el idioma en el que se creó — la copia firmada tiene que seguir diciendo lo que decía.»" },
          { note: "El texto de sus propios servicios lo traduce usted. **Configuración → Traducciones** muestra el texto de alcance de cada servicio por idioma, un recuento de lo que aún falta, y **Redactar los que faltan**, que escribe borradores con IA para que una persona los revise — nada se traduce automáticamente en el momento en que sale un presupuesto." },
        ],
      },
      {
        id: "choosing-the-language",
        heading: "Elegir el idioma de un presupuesto",
        blocks: [
          { steps: [
            "En el constructor, elija el cliente. La barra **Write this quote in** (se muestra en inglés por ahora) aparece con su idioma guardado preseleccionado — o el predeterminado de la empresa si no tiene ninguno.",
            "Cámbielo si este presupuesto debe ser distinto. La preferencia del cliente es una sugerencia, no un candado — tal vez le está presupuestando al hijo angloparlante de un propietario que habla punyabí —, pero la barra muestra la diferencia y ofrece **Use that instead**.",
            "Lea cualquier advertencia: «3 of your 12 services don't have Español wording yet — those line items will come out in English.» Corríjala en **Configuración → Traducciones** antes de enviar, o acéptela.",
            "Guarde. Desde ahí el idioma queda fijo; la página de edición lo indica y no ofrece forma de cambiarlo.",
          ] },
          { figure: "live:app-settings-translations", caption: "Configuración → Traducciones — el selector de idioma, el recuento de faltantes y las columnas por servicio con Marcar como revisado." },
          { tip: "Defina el idioma de cada cliente una vez en su ficha y cada presupuesto para él empieza en ese idioma. Vea [[a-clients-language|El idioma de un cliente]]." },
        ],
      },
      {
        id: "what-follows-the-language",
        heading: "Qué sigue el idioma del presupuesto",
        blocks: [
          { bullets: [
            "**La página de aprobación** — cada etiqueta, los formatos de fecha y de dinero («9,9 %» en francés), los botones de aprobar y rechazar, la línea de consentimiento de la firma.",
            "**El PDF** — etiquetas, fechas, formato de moneda y el texto de alcance por oficio en ese idioma donde usted lo haya escrito.",
            "**El correo de acompañamiento** y cada seguimiento de ese presupuesto — asunto, saludo y cuerpo. Un presupuesto en francés nunca llega envuelto en una nota en inglés, porque eso implicaría una traducción que no existe.",
            "**La factura que lo refleja** y sus propios correos, que heredan el idioma del presupuesto.",
            "**Las líneas derivadas al guardar** — una mejora de gabinetes agregada por el levantamiento se escribe en el idioma del presupuesto, no en el del estimador.",
          ] },
        ],
      },
      {
        id: "the-order-of-precedence",
        heading: "Qué idioma gana",
        blocks: [
          { table: {
            head: ["Prioridad", "Fuente", "Se usa para"],
            rows: [
              ["1", "El idioma propio del documento, fijado al crearlo", "El presupuesto, su PDF, su página de aprobación, su correo de acompañamiento y sus seguimientos"],
              ["2", "El idioma guardado del cliente", "Todo lo que no está ligado a un documento — una confirmación de cita, un recordatorio de pago"],
              ["3", "El predeterminado de la empresa en Configuración → Idioma", "Un cliente sin idioma guardado"],
              ["4", "Inglés", "Cuando nada de lo anterior está definido"],
            ],
          } },
        ],
      },
      {
        id: "who-can-see-it",
        heading: "Quién puede definirlo",
        blocks: [
          { p: "Cualquiera que pueda crear un presupuesto elige su idioma. **Configuración → Traducciones** y el predeterminado de la empresa en **Configuración → Idioma** necesitan a alguien que pueda administrar el equipo: **Dispatcher**, **Manager**, los administradores y el propietario." },
        ],
      },
    ],
    faq: [
      { q: "El cliente cambió de opinión — ¿puedo pasar un presupuesto a francés?", a: "No el mismo presupuesto: su idioma está fijo para que la copia firmada no se desvíe. Cree un presupuesto nuevo para él en francés. El idioma de su ficha de cliente puede cambiarse en cualquier momento y se aplicará al próximo presupuesto." },
      { q: "¿Y si un servicio no tiene texto en francés?", a: "La barra le avisa antes de guardar. La línea sale en el idioma predeterminado de su empresa hasta que usted agregue el francés en Configuración → Traducciones. Nada se traduce automáticamente al enviar." },
      { q: "¿La aplicación también cambia de idioma?", a: "No. El idioma del presupuesto es para el cliente. Su propia pantalla sigue Configuración → Idioma para usted, y cada miembro del equipo puede tener el suyo." },
    ],
  },

  "online-approval-and-signature": {
    title: "Aprobación y firma en línea",
    summary:
      "El cliente abre el enlace en su teléfono, lee, marca los extras, escribe su nombre, dibuja una firma y aprueba — y FieldQuo guarda la firma con una huella exacta de lo que aceptó.",
    updated: "2026-09-12",
    intro: [
      "Sin imprimir, sin escanear, sin cruzar la ciudad para recoger una firma. El correo del presupuesto lleva un enlace; el cliente lee el presupuesto en su teléfono y dice que sí ahí mismo. La aprobación es una confirmación en dos pasos con firma, no un botón pelado — un toque accidental a pleno sol no debería crear un contrato.",
      "La firma no es decoración. Se guarda con el nombre del cliente, la hora, su dirección en la red, el navegador que usó y una huella del contenido valorado que firmó, así que «firmaron» y «lo editamos después» nunca pueden confundirse.",
    ],
    sections: [
      {
        id: "overview",
        heading: "Resumen",
        blocks: [
          { p: "La página de aprobación es pública — cualquiera con el enlace puede ver el presupuesto y aprobarlo, y por eso la pantalla **Obtener aprobación** dice que se envíe solo al cliente. Se abre solo una vez que el presupuesto está **Enviada**; el enlace de un borrador sigue cerrado. Se muestra en el idioma propio del presupuesto y en los colores medidos de su marca, así que es el mismo documento que el PDF." },
          { p: "El enlace se crea la primera vez que usted envía el presupuesto y se muestra en **Obtener aprobación** como **Enlace del cliente**, con **Copiar**, **Vista previa de lo que ven** y **Reemplazar enlace**. Reemplazar anula el enlace anterior — úselo si la persona equivocada recibió una copia, sabiendo que cualquier correo ya enviado dejará de funcionar." },
        ],
      },
      {
        id: "what-the-client-sees",
        heading: "Qué ve el cliente",
        blocks: [
          { bullets: [
            "Su logotipo y su nombre, el número de presupuesto, la fecha **Válida hasta**, y el nombre del cliente.",
            "Cada servicio con su párrafo de alcance, **Qué incluye**, las líneas y el subtotal, y luego **Qué podría cambiar este precio**.",
            "**Extras opcionales** como casillas, si usted ofreció alguno — el total se actualiza a medida que marca. Vea [[upsell-add-ons|Extras opcionales que el cliente puede aceptar]].",
            "**Cómo se realiza el trabajo**, sus notas, y **Condiciones de pago** como tarjetas de porcentaje cuando usted definió un calendario.",
            "Un panel de financiamiento, si su empresa tiene el financiamiento activado.",
            "**Aprobar este presupuesto** en verde y **Rechazar** — y luego, al aprobar, **Su nombre completo**, una casilla **Firma** donde dibujar, la línea de consentimiento «Acepto que firmar aquí es mi firma electrónica y aprueba este presupuesto por $12,450.00», y **Sí, aprobar**.",
          ] },
        ],
      },
      {
        id: "how-approval-works",
        heading: "Cómo se procesa una aprobación",
        blocks: [
          { steps: [
            "El cliente pulsa **Aprobar este presupuesto**. La página pregunta **¿Aprobar este presupuesto por $12,450.00?** y, si hay extras marcados, dice cuánto de eso son extras.",
            "Escribe su nombre, dibuja en la casilla de firma y marca la línea de consentimiento. **Sí, aprobar** sigue desactivado hasta que estén los tres.",
            "El servidor comprueba que el presupuesto siga Enviada y no vencido, vuelve a valorar los extras marcados con sus propias filas, y rechaza una aprobación sin nombre, sin trazo o sin consentimiento — una firma vacía nunca puede hacer las veces de una.",
            "El registro de firma se guarda en el presupuesto y el estado pasa a **Aprobada**, con el subtotal, el impuesto y el total aprobados congelados en él.",
            "El cliente ve **Aprobado — gracias** y recibe el PDF firmado por correo; usted recibe el correo descrito abajo.",
          ] },
        ],
      },
      {
        id: "what-happens-after",
        heading: "Qué pasa después",
        blocks: [
          { bullets: [
            "Se crea un **trabajo**, listo para programar, y una **factura en borrador** por el total aprobado. Si hay un calendario de pagos activo, el anticipo se solicita de inmediato — vea [[deposits-on-quotes|Anticipos en los presupuestos]] y [[convert-a-quote-to-a-job|Qué pasa cuando se aprueba un presupuesto]].",
            "El propietario y los administradores reciben un correo: «Jane Doe approved Q-2026-0012» — «plus $340.00 in extras» si se marcó alguno — con el PDF firmado adjunto y un enlace al presupuesto.",
            "El cliente recibe el PDF firmado con una nota corta en el idioma del presupuesto: «Gracias por aprobar su presupuesto con Easy Roofers Inc. Se adjunta una copia para sus registros.»",
            "El lead vinculado pasa a **Ganada**, el registro de actividad anota «accepted by the client — job created, ready to schedule», y se dispara una notificación.",
            "Un **Rechazar** registra el momento y el motivo si lo escribió, pasa el lead a **Perdida**, y envía un correo al propietario y a los administradores. La página del cliente dice que se le notificó a usted y que llame si fue un error.",
          ] },
        ],
      },
      {
        id: "the-signature-record",
        heading: "Qué contiene el registro de firma",
        blocks: [
          { p: "La misma evidencia que vende un proveedor de firma electrónica de pago, sin el proveedor: un resumen criptográfico del contenido valorado exacto en el momento de firmar, más quién, cuándo y desde dónde." },
          { bullets: [
            "El nombre escrito, la firma dibujada como imagen, y la marca de consentimiento.",
            "La hora de la firma, la dirección de red y el navegador del cliente — aportados por el servidor, nunca por la página.",
            "Una huella del número de presupuesto, las líneas, los grupos de alcance, los extras elegidos y los totales. Cualquier cambio posterior a esos datos hace que la huella deje de coincidir, y así se detecta una alteración.",
            "El PDF firmado, regenerado con la firma y enviado por correo a ambas partes, es la copia para el archivo.",
          ] },
        ],
      },
      {
        id: "recording-an-answer-by-hand",
        heading: "Cuando aprobaron por teléfono",
        blocks: [
          { p: "Un sí dado en una cocina sigue siendo un sí. **Obtener aprobación** tiene **Registrar su respuesta** — «Si te lo dijeron por teléfono o en persona, regístralo aquí para que el flujo se mantenga preciso.»" },
          { steps: [
            "Abra el presupuesto y pulse **Obtener aprobación**.",
            "Pulse **La aprobaron**, o **La rechazaron** y anote por qué.",
            "Todo lo que pone en marcha una aprobación firmada ocurre — trabajo, factura en borrador, calendario, lead —, pero no se guarda ninguna firma, y el presupuesto no muestra registro de firma.",
          ] },
        ],
      },
    ],
    faq: [
      { q: "¿Una firma en línea es legalmente vinculante?", a: "FieldQuo guarda lo que una firma necesita para sostenerse — el nombre, el trazo, la línea de consentimiento que marcó el cliente, la hora, la dirección de red y una huella de lo que firmó. Si eso satisface un contrato dado en una provincia dada es una pregunta para su abogado, no para una página de ayuda." },
      { q: "¿Puede el cliente aprobar sin firmar?", a: "No. Sí, aprobar sigue desactivado hasta que estén el nombre, el trazo y la marca de consentimiento, y el servidor rechaza una aprobación que llegue sin ellos." },
      { q: "¿Y si el presupuesto cambió después de que firmaron?", a: "No se puede editar — las líneas de un presupuesto aprobado están bloqueadas. Si se alterara en la base de datos, la huella guardada dejaría de coincidir, que es justamente la razón de guardar una." },
    ],
  },

  "deposits-on-quotes": {
    title: "Anticipos en los presupuestos",
    summary:
      "Un anticipo es una línea de sus condiciones de pago que se imprime en cada presupuesto como tarjeta de porcentaje — y, con un calendario de pagos activado, una solicitud de factura que sale sola en el momento en que el cliente aprueba.",
    updated: "2026-09-12",
    intro: [
      "Un propietario que acaba de aprobar un trabajo espera que le pidan un anticipo; un contratista que tiene que acordarse de pedirlo, a menudo no lo hace. FieldQuo imprime su anticipo en el presupuesto para que el cliente lo acepte al firmar, y — si usted activa el calendario de pagos — lo solicita automáticamente al aprobar.",
      "Dos ajustes hacen esto, y están uno encima del otro en **Configuración → Configuración de la empresa**. El primero solo imprime. El segundo imprime y factura.",
    ],
    sections: [
      {
        id: "overview",
        heading: "Resumen",
        blocks: [
          { p: "En **Alcance del trabajo y condiciones**, la casilla **Condiciones de pago** es texto libre que se lee tal cual en el documento: «50 % de anticipo, el resto al terminar — o Neto 30». Un texto que FieldQuo pueda leer como calendario — dos o más porcentajes que sumen alrededor de 100 — se imprime como tarjetas en la página de aprobación y el PDF; cualquier otro texto se imprime como usted lo escribió; en blanco, la sección no aparece en absoluto en lugar de inventar un calendario por usted." },
          { note: "Un anticipo en un presupuesto no es la tarifa de visita que un cliente paga al reservar una cita. Esa tarifa se cobra en la página de reservas y se acredita contra la factura más tarde — vea [[booking-fees-and-visit-deposits|Tarifas de reserva y depósitos de visita]]." },
        ],
      },
      {
        id: "two-ways",
        heading: "Las dos formas de definirlo",
        blocks: [
          { table: {
            head: ["Ajuste", "Qué ve el cliente", "Qué pasa al aprobar"],
            rows: [
              ["Condiciones de pago (texto libre)", "Sus palabras, o tarjetas de porcentaje si el texto se lee como calendario, en la página de aprobación y el PDF.", "Un trabajo y una sola factura en borrador por el total aprobado completo. No se solicita nada hasta que usted envíe la factura."],
              ["Calendario de pagos (etapas)", "Las mismas tarjetas de porcentaje, generadas desde las etapas para que el documento siempre coincida con lo que se factura.", "La etapa Anticipo se envía al cliente de inmediato como solicitud de exactamente su parte, con un enlace de pago limitado a ese monto. Las etapas posteriores se disparan según las fechas del trabajo."],
            ],
          } },
        ],
      },
      {
        id: "how-to-set-up",
        heading: "Cómo configurar un anticipo que se factura solo",
        blocks: [
          { steps: [
            "Abra **Configuración → Configuración de la empresa** y busque **Calendario de pagos** — desactivado de forma predeterminada; se activa agregando una etapa.",
            "Pulse **Agregar una etapa**. Ponga **Cuándo** en **Anticipo — al crear y enviar la factura**, nómbrela y déle su **Porcentaje**.",
            "Agregue el resto — **Inicio del trabajo**, **A la mitad del trabajo**, **Fin del trabajo (terminado)** — hasta que **Total** marque 100 %. El guardado rechaza cualquier otra cosa: «Las etapas tienen que sumar exactamente 100% para poder guardarse.»",
            "Pulse **Guardar calendario**. El texto de **Condiciones de pago** de arriba se reescribe a partir de las etapas y se bloquea, para que el documento y la facturación nunca se contradigan.",
            "Para volver al texto libre, pulse **Desactivar — volver al texto libre**. Los trabajos ya en marcha conservan las etapas que se les dieron.",
          ] },
          { figure: "live:app-settings-company", caption: "Configuración → Configuración de la empresa — Alcance del trabajo y condiciones con la casilla Condiciones de pago, y luego la tarjeta Calendario de pagos con Agregar una etapa." },
          { warning: "La parte de una etapa se calcula sobre el total aprobado, extras incluidos, y el correo del anticipo lleva un enlace de pago solo si Stripe está conectado con los cobros habilitados. Sin Stripe la solicitud sale igual; el cliente paga por el medio que usted registre a mano." },
        ],
      },
      {
        id: "on-approval",
        heading: "Qué pasa al aprobar",
        blocks: [
          { bullets: [
            "Se crea el trabajo y se emite una sola factura en borrador por el total aprobado — una factura por trabajo, solicitada por etapas, nunca una factura por etapa.",
            "Cada etapa pasa a ser una fila en el trabajo con su porcentaje, su monto y su disparador. El anticipo no necesita fecha, así que se dispara de inmediato: un correo al cliente, en el idioma del presupuesto, pidiendo el monto de esa etapa y con enlace a su portal.",
            "La factura queda marcada **Enviada** por esa primera solicitud. Las etapas ligadas al inicio, la mitad y el fin del trabajo esperan las fechas del trabajo y se recalculan cuando esas fechas se mueven.",
            "Una etapa al 0 % se exime en lugar de enviarse por correo — una solicitud de $0 es peor que ninguna.",
          ] },
        ],
      },
      {
        id: "who-can-see-it",
        heading: "Quién puede definirlo",
        blocks: [
          { p: "**Configuración → Configuración de la empresa**, incluidas las condiciones de pago y el calendario, necesita a alguien que pueda administrar el equipo: **Dispatcher**, **Manager**, los administradores y el propietario. Las filas de etapas de un trabajo las ve cualquiera que pueda ver la factura de ese trabajo." },
        ],
      },
    ],
    faq: [
      { q: "¿Puedo pedir un anticipo antes de que el cliente apruebe?", a: "No desde el presupuesto. La solicitud de anticipo se dispara con la aprobación, porque ahí es cuando el cliente aceptó el monto. Para reservar un horario de visita con dinero por adelantado, use la tarifa de visita de la página de reservas." },
      { q: "¿Por qué mi presupuesto no muestra ninguna sección de pago?", a: "Las condiciones de pago están vacías. FieldQuo no imprime nada en lugar de inventar un calendario. Escriba sus condiciones — o agregue una etapa — en Configuración → Configuración de la empresa." },
      { q: "El cliente aprobó y no salió ningún correo de anticipo.", a: "Revise tres cosas: el calendario está activo con una etapa Anticipo; el cliente tiene correo; y la factura se emitió (un presupuesto registrado como trabajo pasado no emite ninguna). La fila de la etapa en el trabajo dice si está pendiente o solicitada, y un anticipo pendiente se reintenta." },
    ],
  },
};
