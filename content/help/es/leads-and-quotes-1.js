// content/help/es/leads-and-quotes-1.js
//
// Parte 1 de la categoría «leads-and-quotes» en español (ver el compositor,
// leads-and-quotes.js). Slugs de esta parte (lib/help/tree.js):
// the-leads-board, lead-scoring-hot-warm-cold, where-leads-come-from,
// the-lead-form-on-your-website, facebook-lead-forms, import-leads,
// convert-a-lead-to-a-quote, the-quotes-list, build-a-quote,
// quote-types-and-takeoffs, lines-from-your-price-book,
// group-a-quote-by-room-or-scope, photos-on-a-quote.
//
// Misma estructura que el inglés (secciones, bloques, figuras, listas, FAQ):
// scripts/check-help-centre.mjs compara ambas. Las palabras en pantalla son
// las cadenas del bloque `es` de app/i18n/appMessages.js.
export const ARTICLES = {
  "the-leads-board": {
    title: "El tablero de prospectos",
    summary:
      "Cada consulta que llega a su empresa, en un tablero de cuatro columnas, calificada Caliente, Templado o Frío, con el panel donde la asigna, la anota y la convierte en presupuesto.",
    updated: "2026-09-12",
    intro: [
      "**Prospectos** es la primera pantalla del flujo: el lugar donde una consulta aterriza antes de ser cliente de nadie. Un desconocido llena su formulario de presupuesto, reserva una visita, responde a un anuncio, llama a la recepcionista, o usted importa una lista, y aparece una tarjeta aquí. Nada en esta pantalla es todavía un presupuesto; es la fila de personas a las que devolver la llamada, ordenada para que la mejor quede arriba.",
      "El tablero es un flujo. Una tarjeta se mueve de izquierda a derecha — **Nuevo**, **Contactado**, **Ganado**, **Perdida** — y cada tarjeta abre un panel donde ocurre el trabajo real: leer por qué obtuvo esa puntuación, asignarla a alguien, registrar una nota y convertirla en un borrador de presupuesto que lleva todo lo que la persona le dijo.",
    ],
    sections: [
      {
        id: "overview",
        heading: "Resumen",
        blocks: [
          { p: "Cada prospecto llega ya calificado a partir de lo que la persona dijo — presupuesto disponible, plazo, urgencia, cuánto esfuerzo puso — de modo que la pregunta «¿a quién llamo primero?» tiene respuesta en la tarjeta y no en la cabeza de alguien. La puntuación es una lista transparente de motivos, no una caja negra, y usted puede contradecirla editando el prospecto. Vea [[lead-scoring-hot-warm-cold|Calificación de prospectos: Caliente, Templado, Frío]]." },
          { p: "Un prospecto es el registro de una consulta, no un cliente. La ficha de cliente se crea — o se asocia a una existente por el correo, y luego por el teléfono — en el momento en que usted pulsa **Convertir en presupuesto**. Hasta entonces la persona solo existe en este tablero." },
        ],
      },
      {
        id: "on-the-screen",
        heading: "Qué hay en la pantalla",
        blocks: [
          { p: "El encabezado dice **Prospectos — Consultas desde tu página de reservas y formularios de contacto.** De arriba abajo:" },
          { bullets: [
            "**Importar**, arriba a la derecha, abre el importador de CSV; vea [[import-leads|Importar prospectos]].",
            "Un cuadro de búsqueda, **Buscar nombre, correo, teléfono…**, que también busca en el mensaje que escribió la persona.",
            "Cuatro filtros — **Todos**, **Caliente**, **Templado**, **Frío** — cada uno con la cantidad de prospectos de esa banda.",
            "Un botón de orden que dice **Más calientes** (mayor puntuación primero, luego los más nuevos) o **Más recientes**. El tablero abre en Más calientes.",
            "Las cuatro columnas — **Nuevo**, **Contactado**, **Ganado**, **Perdida** — cada una con su conteo. Una columna vacía dice **No hay nada aquí**.",
            "En cada tarjeta: el nombre de la persona, la etiqueta de temperatura con la puntuación (por ejemplo **Caliente · 86**), las etiquetas de plazo y de presupuesto tal como las respondió, la categoría de servicio, un conteo de fotos y otro de planos PDF, el número del presupuesto vinculado en cuanto existe, las iniciales del responsable y la fecha de llegada. Una marca **No llamar** aparece en quien haya rechazado las llamadas.",
          ] },
          { figure: "harness:requests", caption: "Prospectos — las cuatro columnas, los filtros Caliente / Templado / Frío con sus conteos, el orden Más calientes y el botón Importar." },
        ],
      },
      {
        id: "move-a-lead",
        heading: "Cómo hacer avanzar un prospecto",
        blocks: [
          { steps: [
            "Abra el prospecto tocando su tarjeta, o arrástrela por el asa de su esquina superior derecha a otra columna. En un teléfono las columnas se apilan, así que use los botones de **Estado** dentro del panel en lugar de arrastrar.",
            "Pulse **Contactado** una vez que haya hablado con la persona. Enviar un presupuesto lo hace por usted.",
            "Pulse **Perdida** y elija un motivo — **Se fue con otro**, **El precio era demasiado alto**, **No era el momento**, **No era una consulta real**, **Nunca respondió** u **Otro** — y luego **Marcar como perdido**. El tablero rechaza el paso a Perdida sin un motivo.",
            "**Ganado** no puede elegirse hasta que exista un presupuesto para el prospecto. Conviértalo primero; en cuanto el cliente acepta el presupuesto, el prospecto pasa a Ganado por sí solo.",
          ] },
          { note: "El motivo que elige para un prospecto perdido es lo que después separa una consulta real de un número equivocado en sus cifras. Un prospecto marcado **No era una consulta real** se reabre con un clic si cambia de opinión." },
          { warning: "Una tarjeta vuelve a su lugar en cuanto el servidor rechaza el movimiento: un prospecto nunca queda en una columna en la que no está de verdad. Si ve una franja roja del tipo «This lead has no quote yet», nada cambió." },
        ],
      },
      {
        id: "the-lead-panel",
        heading: "El panel del prospecto",
        blocks: [
          { p: "Tocar una tarjeta abre un panel titulado **Prospecto**. Todo lo que puede cambiar está en él:" },
          { table: {
            head: ["Control", "Qué hace"],
            rows: [
              ["Las líneas de correo y teléfono", "Toque para escribir o llamar. Una marca **No llamar** junto al número significa que la persona rechazó las llamadas."],
              ["**Por qué esta puntuación**", "Los motivos y los puntos detrás de cada uno, por ejemplo «Ready to start ASAP +35». Solo lectura."],
              ["**Plazo** y **Presupuesto**", "Editables. Cambiar cualquiera recalifica el prospecto de inmediato. Un valor vacío se lee **Sin especificar** cuando el formulario preguntó y la persona lo omitió, o **No se preguntó** cuando ese canal nunca plantea la pregunta: la cotización instantánea, el diseñador de cocinas, el portal y el teléfono."],
              ["**Su mensaje** y **Lo que nos dijeron**", "El texto libre y las respuestas estructuradas del formulario, más las fotos adjuntas o un plano de cocina dibujado."],
              ["**Responsable**", "Quién atiende este prospecto. **Sin asignar** por defecto; la lista es su equipo."],
              ["**Estado**", "Los mismos cuatro botones que las columnas. Perdida pide un motivo; Ganado queda gris hasta que exista un presupuesto."],
              ["**Convertir en presupuesto** / **Ver presupuesto Q-…**", "Crea un borrador de presupuesto a partir del prospecto y lo abre en el generador, o abre el presupuesto que ya existe. Vea [[convert-a-lead-to-a-quote|Convertir un prospecto en presupuesto]]."],
              ["**Notas**", "Notas internas con autor y fecha. **Añadir** guarda una; nunca llegan al cliente."],
            ],
          } },
        ],
      },
      {
        id: "who-can-see-it",
        heading: "Quién puede verlo",
        blocks: [
          { p: "Los prospectos son el área **Requests** de la cuadrícula de acceso. La pantalla exige al menos **View only** en Requests; mover una tarjeta, editar los calificadores, asignar un responsable o importar exige **View, create, and edit**. Convertir en presupuesto exige además **View, create, and edit** en Quotes." },
          { bullets: [
            "**Crew** — sin acceso. La fila no está en su barra lateral y la API los rechaza.",
            "**Estimator** y **Dispatcher** — ver, crear y editar, así que pueden trabajar el tablero y convertir prospectos.",
            "**Manager**, **Administrator** y el propietario — todo, incluido eliminar.",
            "Un miembro cuyo acceso a clientes es «solo nombre y dirección» ve el tablero con el correo, el teléfono y el presupuesto ocultos, y el panel dice **Oculto según tu nivel de acceso**.",
          ] },
        ],
      },
    ],
    faq: [
      { q: "¿Por qué no puedo arrastrar un prospecto directamente a Ganado?", a: "Ganado significa que un cliente dijo que sí a un presupuesto con precio, y un prospecto sin presupuesto no tiene nada detrás. Conviértalo primero; una vez que existe un presupuesto puede mover la tarjeta a mano, y cuando el cliente acepta en línea se mueve sola." },
      { q: "¿Dónde quedó el correo del prospecto?", a: "Su nivel de acceso a clientes es «solo nombre y dirección», así que el servidor quita el correo, el teléfono y el presupuesto declarado antes de enviarle el tablero. Pida a un propietario o administrador si los necesita." },
      { q: "¿Marcar un prospecto como Contactado envía algo?", a: "No. Registra que usted habló con la persona. Ningún botón de estado de este tablero envía correos ni mensajes de texto — aunque marcar un prospecto como Contactado sí detiene una regla de seguimiento **Consulta nueva, nadie respondió**, si tiene una. Vea [[follow-up-rules|Reglas de seguimiento]]." },
      { q: "¿Las llamadas que atiende la recepcionista aparecen aquí?", a: "Sí. Una llamada que toma la recepcionista telefónica crea un prospecto con los datos de quien llamó, calificado sin presupuesto, porque la recepcionista nunca puede hablar de dinero. Vea [[the-phone-receptionist|La recepcionista telefónica]]." },
    ],
  },

  "lead-scoring-hot-warm-cold": {
    title: "Calificación de prospectos: Caliente, Templado, Frío",
    summary:
      "Cómo FieldQuo califica cada prospecto sobre 100 a partir de lo que la persona le dijo, por qué los motivos se imprimen en el prospecto y qué cambia la puntuación.",
    updated: "2026-09-12",
    intro: [
      "Cada prospecto del tablero lleva una puntuación sobre 100 y una banda — **Caliente**, **Templado** o **Frío** — calculadas en el momento en que llega. La calificación es un conjunto de reglas transparentes, no un modelo: cada punto sumado tiene un motivo en palabras claras, y los motivos se imprimen en el prospecto bajo **Por qué esta puntuación**, para que vea por qué una consulta supera a otra y pueda contradecirla si no está de acuerdo.",
      "Los pesos reflejan lo que predice un trabajo ganado, en orden: cuándo quiere la persona que se haga, cuánto espera gastar, si es una emergencia, si usted puede contactarla, y cuánto esfuerzo puso en la consulta.",
    ],
    sections: [
      {
        id: "overview",
        heading: "Resumen",
        blocks: [
          { p: "La puntuación se calcula a partir de los campos del propio prospecto: plazo, banda de presupuesto, indicadores de emergencia en las respuestas estructuradas, teléfono, correo, fotos o planos adjuntos, un plano de cocina dibujado, y la longitud del mensaje. Corre igual para todas las fuentes, así que un prospecto de su sitio web, de un anuncio de Facebook, de la recepcionista o de una importación CSV se mide con la misma regla." },
          { p: "Se recalcula cada vez que usted edita **Plazo** o **Presupuesto** en el panel del prospecto, de modo que una llamada que establece un presupuesto mueve el prospecto de inmediato." },
        ],
      },
      {
        id: "how-points-are-earned",
        heading: "Cómo se ganan los puntos",
        blocks: [
          { table: {
            head: ["Señal", "Puntos", "El motivo impreso en el prospecto"],
            rows: [
              ["Plazo: **Cuanto antes** / **En 2 semanas** / **1–3 meses** / **Explorando**", "35 / 25 / 12 / 2", "«Ready to start ASAP», «Wants to start within 2 weeks», «Planning within 1–3 months», «Just exploring for now»"],
              ["Presupuesto: **$15k+** / **$5k–$15k** / **$1k–$5k** / **Menos de $1k** / **No seguro**", "30 / 22 / 14 / 6 / 0", "«Budget $15k+» … «Budget not stated» (mostrado en 0 para que la ausencia sea visible)"],
              ["Un indicador de emergencia en las respuestas (plomería, climatización, daños por tormenta)", "20", "«Flagged as an emergency»"],
              ["Un número de teléfono", "8", "«Phone number provided»"],
              ["Una dirección de correo", "4", "«Email provided»"],
              ["Fotos o un video adjuntos", "4 cada uno, hasta 10", "«2 photos attached»"],
              ["Un plano PDF adjunto, o una cocina dibujada en el diseñador", "12 por un plano, 8 por un diseño dibujado", "«Sent a plan (1 PDF)», «Designed a kitchen layout»"],
              ["Un mensaje de 120 caracteres o más", "5", "«Wrote a detailed description»"],
            ],
          } },
          { p: "Los puntos se suman y se limitan a 100. Una foto vale algo porque alguien apuntó el teléfono a una pared; un plano PDF vale más porque alguien ya pasó por un planificador de cocinas y produjo un documento: eso es un proyecto decidido, no curiosidad." },
        ],
      },
      {
        id: "the-three-bands",
        heading: "Las tres bandas",
        blocks: [
          { bullets: [
            "**Caliente** — 60 o más. Un trabajo «cuanto antes» con un presupuesto real, o una emergencia, cae aquí.",
            "**Templado** — de 30 a 59. Una consulta con presupuesto pero sin prisa, o una urgente sin nada más detrás.",
            "**Frío** — menos de 30. Poco dicho, poco adjunto. Sigue siendo un prospecto; solo no es la primera llamada.",
          ] },
          { note: "Las bandas son umbrales sobre la puntuación y nada más. Nada se envía, se oculta ni se elimina porque un prospecto sea Frío: el orden **Más calientes** del tablero simplemente lo pone más abajo." },
        ],
      },
      {
        id: "when-a-question-was-never-asked",
        heading: "Cuando una pregunta nunca se hizo",
        blocks: [
          { p: "La ausencia de respuesta no es una respuesta. La recepcionista telefónica tiene prohibido hablar de dinero, así que un prospecto telefónico nunca puede tener presupuesto. En lugar de perder 30 puntos que nunca pudo ganar, el presupuesto sale del denominador: un prospecto telefónico se califica sobre 70 y se escala a 100, y el prospecto lo dice con la línea **Scored without budget — the phone can't ask**." },
          { p: "El panel del prospecto hace la misma distinción en pantalla. Un Plazo o un Presupuesto vacío se lee **Sin especificar** cuando el formulario planteó la pregunta y la persona la omitió — un visitante del formulario de presupuesto que omitió el presupuesto de verdad declinó — y **No se preguntó** cuando ese canal no tiene esa pregunta: la cotización instantánea nunca pregunta un plazo, y el diseñador de cocinas, el portal del cliente y el empleado de IA no preguntan ninguno de los dos." },
          { tip: "Un prospecto **No se preguntó** suele ser al que hay que llamar con la pregunta. Elija la respuesta en el panel y la puntuación se actualiza al instante." },
        ],
      },
      {
        id: "rescoring",
        heading: "Cómo recalificar un prospecto",
        blocks: [
          { steps: [
            "Abra el prospecto desde el tablero.",
            "Cambie **Plazo** o **Presupuesto** a lo que la persona le dijo.",
            "La puntuación, la banda y la lista **Por qué esta puntuación** se actualizan en cuanto el cambio se guarda; la tarjeta del tablero se mueve con ellas.",
          ] },
          { p: "Nada más recalifica un prospecto. Añadir una nota, asignar un responsable o cambiar el estado deja la puntuación como está." },
        ],
      },
    ],
    faq: [
      { q: "¿Puedo cambiar los pesos?", a: "No. Los puntos y los umbrales son los mismos para todas las empresas y no son una configuración. Lo que puede cambiar son las respuestas del propio prospecto, lo que lo recalifica." },
      { q: "¿Por qué un prospecto importado es Frío?", a: "Un CSV rara vez trae un presupuesto o un plazo en una forma que el importador reconozca, así que el prospecto se califica por lo fácil que es contactarlo: un teléfono y un correo valen 12 puntos juntos. Ábralo y elija el plazo y el presupuesto en cuanto los conozca." },
      { q: "¿La puntuación decide algo por sí sola?", a: "No. Ordena el tablero cuando el orden está en Más calientes y se pasa a su notificación para que un prospecto caliente pueda ponderarse. Nunca envía, pone precio ni descarta nada." },
    ],
  },

  "where-leads-come-from": {
    title: "De dónde vienen los prospectos",
    summary:
      "Las diez maneras en que una consulta llega a su tablero de prospectos — sus formularios, sus enlaces, sus anuncios, la recepcionista y las importaciones — y lo que todas tienen en común.",
    updated: "2026-09-12",
    intro: [
      "Todas las maneras en que un desconocido puede llegar a su empresa terminan en el mismo tablero. Sea cual sea el canal — un formulario en su sitio web, un anuncio de Facebook, una llamada que tomó la recepcionista, una lista comprada — la consulta la crea la misma función, la califican las mismas reglas y se anuncia a las mismas personas. Este artículo enumera los canales y lo que cada uno trae consigo.",
    ],
    sections: [
      {
        id: "overview",
        heading: "Resumen",
        blocks: [
          { p: "El panel del prospecto muestra la fuente bajo el nombre de la persona, junto a la fecha. Conocer la fuente le dice qué esperar en la tarjeta: un prospecto del formulario de presupuesto tiene un servicio, respuestas y a menudo fotos; un prospecto telefónico tiene dirección y descripción, pero no presupuesto; un prospecto de Facebook tiene las preguntas que usted puso en ese formulario." },
        ],
      },
      {
        id: "the-sources",
        heading: "Las fuentes",
        blocks: [
          { table: {
            head: ["Canal", "Cómo le llega", "Qué trae el prospecto"],
            rows: [
              ["Formulario **Solicitar una cotización**", "El enlace y la inserción de **Configuración → Comparte tus enlaces**. Vea [[the-lead-form-on-your-website|El formulario de prospectos en su sitio web]].", "Servicio, las respuestas de admisión para ese servicio, presupuesto, plazo, descripción, fotos o un plano PDF, dirección, datos de contacto, el idioma elegido."],
              ["Diseñador de cocinas", "El propietario dibuja una cocina en su diseñador público.", "El diseño dibujado, una dirección y notas. Sin pregunta de presupuesto ni de plazo: el panel dice **No se preguntó**."],
              ["Estimación instantánea", "Su enlace de estimación instantánea; la estimación también llega a **Revisiones de presupuesto** como borrador por aprobar.", "Tamaño, material, el rango que vio, su presupuesto declarado. Sin pregunta de plazo."],
              ["Embudo de prospectos", "Un embudo publicado desde **Embudos**, compartido en un anuncio o insertado.", "Las preguntas propias del embudo, lo que se le mostró, y los archivos adjuntos."],
              ["Portal del cliente", "Un cliente existente pide más trabajo desde su portal.", "Una categoría y un mensaje, vinculados al cliente."],
              ["Recepcionista telefónica", "La recepcionista de IA atiende una llamada que usted no pudo tomar.", "Nombre, dirección, el trabajo descrito, la urgencia traducida a plazo. Calificado sin presupuesto."],
              ["Empleado de IA", "Una conversación de Facebook, Instagram o WhatsApp que el empleado de IA atendió y para la que reservó una devolución de llamada.", "Los detalles de la conversación, vinculados al hilo en **Mensajes**."],
              ["Formulario de clientes potenciales de Facebook", "Un formulario adjunto a uno de sus anuncios de Meta. Vea [[facebook-lead-forms|Formularios de clientes potenciales de Facebook]].", "Los campos estándar de Meta más cada pregunta personalizada, palabra por palabra."],
              ["Formulario de prospectos simple", "El formulario ligero pensado para insertar: nombre, correo o teléfono, una categoría y un mensaje.", "Datos de contacto, categoría y mensaje."],
              ["Importación CSV", "**Importar** en el tablero de prospectos. Vea [[import-leads|Importar prospectos]].", "Lo que traía el archivo: nombre, correo, teléfono, dirección, notas, presupuesto y plazo cuando son reconocibles."],
            ],
          } },
        ],
      },
      {
        id: "what-happens-next",
        heading: "Lo que todas las fuentes comparten",
        blocks: [
          { bullets: [
            "El prospecto se califica al llegar con las mismas reglas; vea [[lead-scoring-hot-warm-cold|Calificación de prospectos: Caliente, Templado, Frío]].",
            "Una notificación **lead.created** va a quienes nombren sus reglas de notificación, con el nombre de la persona y la temperatura. Vea [[notifications-for-you|Notificaciones para usted]].",
            "Cuando la persona dejó un teléfono en uno de sus propios formularios, se registra su consentimiento para recibir llamadas, que es lo que permite a la recepcionista devolverle la llamada si usted activó esa opción. Un formulario de clientes potenciales de Facebook no registra consentimiento, porque la persona nunca vio el texto de FieldQuo.",
            "La dirección de correo se comprueba antes de guardarse: una dirección a la que no se puede entregar se rechaza en el formulario en lugar de guardarse, para que un presupuesto no rebote después.",
            "El idioma que la persona eligió en su formulario se conserva en el prospecto y se convierte en el idioma del presupuesto en que usted lo convierte.",
          ] },
          { note: "El prospecto se crea aunque la notificación falle. Capturar la consulta siempre va primero." },
        ],
      },
      {
        id: "your-links",
        heading: "Dónde están los enlaces",
        blocks: [
          { p: "**Configuración → Comparte tus enlaces** reúne los tres enlaces públicos — **Solicitar una cotización**, **Reservar una visita**, **Estimación instantánea** — y una tarjeta por cada embudo publicado, cada una con **Copiar enlace**, **Abrir** y un fragmento para insertar." },
          { figure: "live:app-settings-lead-form", caption: "Configuración → Comparte tus enlaces — las tarjetas Solicitar una cotización, Reservar una visita y Estimación instantánea, cada una con su enlace y su fragmento para insertar." },
          { tip: "Una reserva no es un prospecto. Quien reserva una visita desde **Reservar una visita** obtiene una cita en su calendario, no una tarjeta en este tablero, porque ya decidió." },
        ],
      },
    ],
    faq: [
      { q: "¿Los mensajes de una Página de Facebook o de Instagram se convierten en prospectos?", a: "No por sí solos. Una conversación vive en Mensajes; se convierte en prospecto cuando el empleado de IA reserva una devolución de llamada desde ella, o cuando usted abre el prospecto al que está vinculado el hilo." },
      { q: "¿Puedo añadir un prospecto a mano?", a: "No hay botón de Nuevo prospecto. Importe un CSV de una fila, o cree el cliente y empiece el presupuesto directamente desde Cotizaciones." },
      { q: "¿Todos los canales hacen las mismas preguntas?", a: "No, y el panel del prospecto es honesto al respecto: un Presupuesto o un Plazo vacío se lee Sin especificar cuando el formulario preguntó y No se preguntó cuando ese canal no tiene esa pregunta." },
    ],
  },

  "the-lead-form-on-your-website": {
    title: "El formulario de prospectos en su sitio web",
    summary:
      "El formulario Solicitar una cotización: qué le pregunta a un propietario, dónde obtener el enlace y el código para insertar, y qué aterriza en su tablero de prospectos cuando pulsa Enviar.",
    updated: "2026-09-12",
    intro: [
      "**Solicitar una cotización** es el formulario público para alguien que todavía compara precios. Elige un servicio, responde unas preguntas sobre el trabajo, dice cuánto espera gastar y cuándo, adjunta fotos y deja sus datos. Lo que vuelve es un prospecto calificado en su tablero: no un correo en una bandeja, y nunca un precio.",
      "Usted lo comparte como un enlace simple o lo pega en su propio sitio web. Ambos salen de **Configuración → Comparte tus enlaces**.",
    ],
    sections: [
      {
        id: "overview",
        heading: "Resumen",
        blocks: [
          { p: "El formulario produce un prospecto, no un presupuesto. No muestra tarifas y el punto de acceso detrás de él no devuelve ninguna: una cifra de autoservicio que usted nunca vio es una que quizá tenga que honrar, y una lista de tarifas publicada es un regalo para cada competidor de la ciudad. Lo que el formulario hace en cambio es llegar a la devolución de llamada con el tamaño del trabajo ya conocido." },
          { p: "Es una página suya: su logotipo y su nombre arriba, su color de marca en la línea, la confirmación diseñada como su presupuesto. En la versión insertada desaparece la franja del logotipo, porque el formulario ya está bajo el encabezado de su propio sitio." },
        ],
      },
      {
        id: "on-the-screen",
        heading: "Qué hay en la pantalla de configuración",
        blocks: [
          { p: "**Configuración → Comparte tus enlaces** dice **Ponlos donde ya estás — tu sitio web, tu ficha de Google, tu página de Facebook, tu firma de correo o el costado de la camioneta.** La tarjeta **Solicitar una cotización** es la primera:" },
          { bullets: [
            "**Describen el trabajo y dejan sus datos. Llega a tu lista de prospectos. Ideal para quienes todavía comparan precios.**",
            "El enlace en sí, con **Copiar enlace** y **Abrir**.",
            "**Insértalo en tu sitio web en su lugar** — el fragmento para insertar, con **Copiar**.",
            "El pie de la pantalla lo dice claramente: **El formulario de cotización solo ofrece los servicios que activaste en Configuración → Servicios, y nunca muestra tus precios.**",
          ] },
          { figure: "live:app-settings-lead-form", caption: "Configuración → Comparte tus enlaces — la tarjeta Solicitar una cotización con su enlace, Copiar enlace, Abrir y el fragmento para insertar." },
        ],
      },
      {
        id: "put-it-on-your-site",
        heading: "Cómo ponerlo en su sitio",
        blocks: [
          { steps: [
            "Abra **Configuración → Comparte tus enlaces**.",
            "En la tarjeta **Solicitar una cotización**, pulse **Copiar enlace** para compartir la página sola: en un anuncio, en Google, en un mensaje de texto.",
            "Para insertarlo, pulse **Copiar** bajo **Insértalo en tu sitio web en su lugar** y pegue el fragmento donde deba aparecer el formulario.",
            "El fragmento incluye un pequeño script que permite al formulario informar su altura, para que crezca con la página en vez de desplazarse dentro de un recuadro. Si su herramienta de sitio web elimina los scripts, el formulario igual se muestra a 640 píxeles fijos.",
            "Pulse **Abrir** para probarlo como lo haría un propietario.",
          ] },
          { note: "La misma pantalla lleva **Reservar una visita**, **Estimación instantánea** y cada embudo publicado. La inserción se trata en detalle en [[embed-booking-and-quote-forms|Insertar los formularios de reserva y de presupuesto en cualquier sitio]]." },
        ],
      },
      {
        id: "what-the-form-asks",
        heading: "Qué pregunta el formulario",
        blocks: [
          { p: "Tres pasos, en el orden que un desconocido tolera: el servicio primero, los datos de contacto al final:" },
          { bullets: [
            "Un selector de idioma, que ofrece los idiomas en que envía su empresa. El prospecto, y luego el presupuesto, se crean en el idioma que la persona elige.",
            "**Paso 1** — el servicio, entre los tipos de presupuesto que usted activó en **Configuración → Servicios y precios**.",
            "**Paso 2** — las preguntas de admisión de ese servicio (puertas, pies cuadrados, pisos: lo que el tipo pida), luego las dos preguntas universales: la banda de presupuesto (**No seguro**, **Menos de $1k**, **$1k–$5k**, **$5k–$15k**, **$15k+**) y el plazo (**Cuanto antes**, **En 2 semanas**, **1–3 meses**, **Explorando**), una descripción, y fotos, un video corto o un plano PDF.",
            "**Paso 3** — nombre, correo, teléfono y la dirección del trabajo, con autocompletado que también guarda la ciudad, la provincia y el país para que el impuesto sea correcto cuando usted cotice.",
            "Se exige un correo o un teléfono, no ambos. Una dirección de correo que no puede recibir mensajes se rechaza mientras la persona sigue en el formulario.",
            "La página de confirmación y, si dio un correo, un correo de confirmación con su marca. Dice lo que pidió, nunca un precio.",
          ] },
          { warning: "Desactivar un tipo de presupuesto en **Configuración → Servicios y precios** lo quita de este formulario de inmediato. Si el formulario muestra un servicio que ya no ofrece, ahí es donde se corrige." },
        ],
      },
      {
        id: "what-arrives",
        heading: "Qué llega de su lado",
        blocks: [
          { p: "El envío se convierte en un prospecto con la fuente **self_quote**:" },
          { bullets: [
            "Calificado al llegar — una banda Caliente / Templado / Frío y los motivos — y notificado a quienes nombren sus reglas de notificación.",
            "Cada respuesta guardada dos veces: como texto legible bajo **Su mensaje**, y como respuestas estructuradas bajo **Lo que nos dijeron**, que es lo que lee el generador de presupuestos cuando usted convierte.",
            "Si dejó un teléfono, se registra su consentimiento para recibir llamadas, y la recepcionista le devuelve la llamada si usted activó las devoluciones de llamada de presupuesto. Vea [[quote-callbacks|Devoluciones de llamada de presupuesto]].",
            "**Convertir en presupuesto** crea el cliente (o lo asocia a uno existente por el correo, y luego por el teléfono) y un borrador de presupuesto con el servicio, las respuestas, las fotos y su idioma ya puestos.",
          ] },
        ],
      },
      {
        id: "who-can-see-it",
        heading: "Quién puede verlo",
        blocks: [
          { p: "La fila de configuración **Comparte tus enlaces** se muestra a los miembros que pueden gestionar usuarios: **Dispatcher**, **Manager**, **Administrator** y el propietario. Un miembro **Estimator** o **Crew** no la ve en Configuración. El formulario público en sí no exige ningún inicio de sesión." },
        ],
      },
    ],
    faq: [
      { q: "¿Puedo cambiar las preguntas?", a: "Por servicio, sí: un tipo de presupuesto personalizado lleva los campos que usted elige al crearlo en Configuración → Servicios y precios, y un tipo integrado hace su propio conjunto de preguntas. Las preguntas de presupuesto y plazo van en cada envío y no pueden quitarse." },
      { q: "¿Por qué el formulario no muestra un precio?", a: "Por diseño. Los puntos de acceso públicos nunca devuelven sus tarifas. Si quiere que un propietario vea una cifra inicial, eso es la Estimación instantánea, que llega a Revisiones de presupuesto para que usted la confirme antes de que nadie pueda enviarla." },
      { q: "¿Qué recibe el propietario?", a: "Una página de confirmación y, con una dirección de correo, un correo de confirmación, ambos con su marca y en el idioma que eligió. En ninguno hay un monto." },
      { q: "¿El formulario de prospectos simple es lo mismo?", a: "No. También existe un formulario ligero — nombre, correo o teléfono, categoría, mensaje — pensado para insertarse en su propio código. Crea un prospecto de la misma manera, pero no hace preguntas de admisión." },
    ],
  },

  "facebook-lead-forms": {
    title: "Formularios de clientes potenciales de Facebook",
    summary:
      "Convierta los formularios adjuntos a sus anuncios de Facebook e Instagram en prospectos en su tablero, con la campaña de la que vino cada uno, y lo que la conexión hace y no hace.",
    updated: "2026-09-12",
    intro: [
      "Usted publica un anuncio — «Obtenga una estimación de pintura gratis» — y un propietario lo toca. Meta muestra su propio formulario, rellenado con el nombre y el correo de su cuenta de Facebook, y la persona pulsa Enviar. Esa persona es un prospecto, y **Configuración → Meta Ads** es donde usted le dice a FieldQuo cuáles de esos formularios convertir en uno.",
      "Un prospecto de un formulario que usted activa aparece en **Prospectos** como cualquier otra consulta — calificado igual, notificado a las mismas personas — y lleva el nombre de la campaña de la que vino.",
    ],
    sections: [
      {
        id: "overview",
        heading: "Resumen",
        blocks: [
          { p: "Una sola conexión alimenta tres cosas: el gasto publicitario en sus cifras de marketing, los formularios de clientes potenciales en Prospectos, y los mensajes de Página, Instagram y WhatsApp en Mensajes. Los formularios exigen primero la conexión de la cuenta publicitaria de Meta, porque es el mismo acceso el que lee sus Páginas." },
          { p: "Meta entrega un envío de dos maneras y FieldQuo escucha ambas: un webhook en el momento en que se envía el formulario, y una consulta de cada formulario activado a los veinte minutos de cada hora. Las dos se superponen a propósito — un webhook puede perderse — y no pueden contar doble, porque un prospecto se indexa por el identificador propio de Meta." },
        ],
      },
      {
        id: "on-the-screen",
        heading: "Qué hay en la pantalla",
        blocks: [
          { p: "La tarjeta **Formularios de clientes potenciales de Facebook** está bajo la conexión de la cuenta publicitaria en **Configuración → Meta Ads**:" },
          { bullets: [
            "**Cuando alguien rellena el formulario adjunto a uno de tus anuncios de Facebook o Instagram, FieldQuo puede añadirlo como cliente potencial.**",
            "**Último recibido el …** o **Todavía no se ha recibido ninguno desde Meta.** — la única línea que le dice que la conexión funciona.",
            "Una fila por formulario encontrado en sus Páginas, con **Clientes potenciales: …**, la fecha del último, y un interruptor **Activado** / **Desactivado**.",
            "**De qué campañas vienen estos clientes potenciales** — las campañas y cuántos prospectos produjo cada una.",
            "**Buscar mis formularios** — vuelve a leer sus Páginas y lista los formularios nuevos.",
          ] },
          { figure: "live:app-settings-meta-ads", caption: "Configuración → Meta Ads — la tarjeta Formularios de clientes potenciales de Facebook bajo la conexión de la cuenta publicitaria, antes de que se haya encontrado un formulario." },
        ],
      },
      {
        id: "switch-a-form-on",
        heading: "Cómo activar un formulario",
        blocks: [
          { steps: [
            "Abra **Configuración → Meta Ads** y pulse **Conectar Meta Ads** si la tarjeta de arriba dice que no hay conexión. Vea [[connect-meta-ads|Conectar su cuenta publicitaria de Meta]].",
            "Pulse **Buscar mis formularios**. Se lista cada formulario de clientes potenciales de las Páginas que ese acceso puede leer.",
            "Active el interruptor de cada formulario cuyos envíos deban convertirse en prospectos. Deje un formulario desactivado y sus envíos se quedan en Meta.",
            "Observe **Último recibido el** después de su próximo envío.",
            "Abra **Prospectos**: la nueva tarjeta lleva la fuente y la campaña.",
          ] },
          { note: "Si la tarjeta muestra un aviso ámbar — **Los formularios de clientes potenciales de Facebook necesitan que Meta apruebe un permiso más; todavía no se está recibiendo nada.** — todos los interruptores están desactivados y no llega nada. Eso es la revisión del permiso por parte de Meta, no su configuración; el resto de la conexión sigue funcionando." },
        ],
      },
      {
        id: "how-a-lead-arrives",
        heading: "Cómo llega un prospecto",
        blocks: [
          { p: "No se inventa nada. Los campos estándar de Meta van a las columnas del prospecto; cada pregunta personalizada que usted escribió en el formulario se conserva palabra por palabra bajo **Lo que nos dijeron**." },
          { bullets: [
            "El nombre, el correo y el teléfono vienen de los campos estándar de Meta. Dirección, ciudad, provincia, país y código postal los acompañan cuando el formulario los pidió.",
            "No se fija banda de presupuesto, ni plazo, ni idioma, porque el formulario de Meta no los pregunta salvo que usted haya escrito esas preguntas; en ese caso las respuestas están en el prospecto con sus palabras, no forzadas en las bandas de FieldQuo. El panel dice **Sin especificar**.",
            "El prospecto se califica con lo que tiene — un teléfono y un correo valen 12 puntos — y se notifica a quienes nombren sus reglas de notificación.",
            "Un envío sin nombre, correo ni teléfono se omite en vez de ponerse en su tablero como una tarjeta sin nombre.",
          ] },
          { warning: "Un formulario de clientes potenciales de Facebook no registra consentimiento para recibir llamadas, porque la persona vio el texto de Meta y su política de privacidad, nunca el de FieldQuo. La recepcionista no le marcará automáticamente; una persona sí puede." },
        ],
      },
      {
        id: "what-it-changes",
        heading: "Qué cambia cada control",
        blocks: [
          { table: {
            head: ["Control", "Qué hace"],
            rows: [
              ["**Activado** / **Desactivado** por formulario", "Activado: el webhook y la consulta horaria importan los envíos de ese formulario. Desactivado: no se importa nada de él; los prospectos que ya están en su tablero se quedan."],
              ["**Buscar mis formularios**", "Lee sus Páginas y añade a la lista los formularios recién creados. No importa nada por sí solo."],
              ["**Desconectar** en la cuenta publicitaria", "Termina la conexión de la que dependen los formularios. Los formularios activados dejan de recibir hasta que usted vuelva a conectar."],
            ],
          } },
        ],
      },
      {
        id: "cost-per-lead",
        heading: "Costo por prospecto",
        blocks: [
          { p: "Como un prospecto de Meta lleva el identificador de su campaña y el gasto publicitario sincronizado lleva el mismo identificador, FieldQuo puede mostrar el costo por prospecto por campaña para esta única vía. El costo por prospecto por campaña cubre los prospectos que llegaron por un formulario de clientes potenciales de Meta. Todos los demás canales — y el propietario que vio el anuncio y llamó por teléfono — siguen mezclados en el conjunto, porque nada vincula ese gasto con ese prospecto. Vea [[marketing-spend|Gasto en marketing]]." },
          { tip: "Dé a cada anuncio su propio formulario. Un formulario compartido por cinco campañas igual atribuye cada prospecto a la campaña que lo produjo, pero un formulario por anuncio hace que la lista de esta tarjeta se lea de un vistazo." },
        ],
      },
      {
        id: "who-can-see-it",
        heading: "Quién puede verlo",
        blocks: [
          { p: "**Meta Ads** es una pantalla del propietario y los administradores: guarda una conexión a una cuenta que gasta su dinero. Un miembro Manager, Dispatcher, Estimator o Crew no ve la fila, y la API lo rechaza." },
        ],
      },
    ],
    faq: [
      { q: "¿Por qué todos los interruptores están en gris?", a: "La tarjeta se lo dice: los formularios de clientes potenciales de Facebook necesitan que Meta apruebe un permiso más, y hasta entonces no se recibe nada. Su conexión está bien; no hay nada que arreglar de su lado." },
      { q: "Un envío llegó dos veces en Facebook. ¿Tendré dos prospectos?", a: "No. Un prospecto se indexa por el identificador propio de Meta, y ambas vías de entrega lo comprueban. La segunda entrega se registra como duplicado y no crea nada." },
      { q: "¿El prospecto me notifica como uno del sitio web?", a: "Sí: la misma notificación lead.created, a las mismas personas, con la misma ponderación Caliente / Templado / Frío." },
      { q: "¿FieldQuo puede cambiar mis anuncios?", a: "No. La conexión solo lee gasto, rendimiento y formularios de clientes potenciales. Nunca crea ni edita un anuncio." },
    ],
  },

  "import-leads": {
    title: "Importar prospectos",
    summary:
      "Traiga a su tablero de prospectos una lista que compró o exportó de otra herramienta a partir de un CSV, calificada igual que una consulta entrante.",
    updated: "2026-09-12",
    intro: [
      "**Importar**, arriba a la derecha del tablero de prospectos, toma un CSV de prospectos que usted compró o exportó de otro sitio y pone cada fila en el tablero como un prospecto. Las columnas habituales se reconocen por nombre, el presupuesto y el plazo se asignan cuando se pueden reconocer, y cada fila pasa por el mismo calificador que una consulta de su sitio web.",
    ],
    sections: [
      {
        id: "overview",
        heading: "Resumen",
        blocks: [
          { p: "La pantalla dice **Importar prospectos — Sube un CSV de prospectos que compraste o exportaste de otra herramienta. Reconoceremos las columnas habituales (nombre, correo, teléfono, dirección, notas, presupuesto, plazo), calificaremos cada uno como caliente/tibio/frío y los dejaremos en tu embudo.** No se crea nada hasta que pulsa el botón de importar, y antes ve una vista previa." },
          { figure: "harness:requests", caption: "Prospectos — el botón Importar, arriba a la derecha, abre el importador de CSV." },
        ],
      },
      {
        id: "the-file",
        heading: "El archivo",
        blocks: [
          { p: "Un CSV con una fila de encabezado. Los nombres de columna se reconocen con flexibilidad, en mayúsculas o minúsculas:" },
          { table: {
            head: ["Qué", "Nombres de columna reconocidos"],
            rows: [
              ["Nombre", "name, Full Name, full_name, contact"],
              ["Correo", "email, e-mail"],
              ["Teléfono", "phone, Phone Number, phone_number, mobile, tel"],
              ["Mensaje", "message, notes, details, description, comments"],
              ["Dirección", "address, street, street_address, job address, site address, location — solo la línea de calle"],
              ["Presupuesto", "budget, budget_band, price — una cifra, un rango o palabras como «under 5k», «$15,000+», «not sure»"],
              ["Plazo", "timeline, urgency, when, timeframe — palabras como «asap», «next week», «this spring», «just looking»"],
            ],
          } },
          { note: "La ciudad y la provincia no se leen a propósito desde una hoja de cálculo, porque una jurisdicción adivinada a partir de una columna determina una tasa de impuesto en un documento. La dirección pasa como línea de calle; la ciudad y la provincia del cliente se fijan cuando usted convierte." },
        ],
      },
      {
        id: "import-the-file",
        heading: "Cómo importar",
        blocks: [
          { steps: [
            "Abra **Prospectos** y pulse **Importar**.",
            "Pulse **Elegir un archivo CSV** y seleccione el archivo. La página lo lee en su navegador y muestra **… encontradas. Vista previa:** con los tres primeros nombres y contactos.",
            "Pulse **Importar … prospectos**.",
            "El resultado dice **… importados**, y **, … omitidos sin nombre ni contacto** cuando se descartaron filas.",
            "Pulse **Ver prospectos** para volver al tablero. Las tarjetas nuevas quedan ordenadas con el resto.",
          ] },
          { warning: "Un archivo de más de 2,000 filas se rechaza: divídalo. Una fila sin nombre y sin correo o teléfono utilizable se omite, porque un prospecto al que nadie puede contactar ni nombrar es ruido, no un prospecto." },
        ],
      },
      {
        id: "what-happens-to-each-row",
        heading: "Qué pasa con cada fila",
        blocks: [
          { bullets: [
            "Se convierte en un prospecto con la fuente **imported** y un nombre, o **Imported lead** cuando la fila no tenía ninguno.",
            "El presupuesto y el plazo se asignan a las mismas bandas que usa el formulario del sitio web cuando el texto es reconocible: «$3,000–$5,000» se convierte en **$1k–$5k**, «$15,000+» en **$15k+**, «no rush» en **Explorando**. Cuando nada es reconocible, el prospecto simplemente no tiene banda; no se le acredita un presupuesto que nunca declaró.",
            "Se califica con lo que tiene. Una fila con teléfono y correo pero sin presupuesto ni plazo obtiene 12 y cae en **Frío** hasta que usted la abra y elija las respuestas.",
            "Se dispara la misma notificación **lead.created** que para cualquier consulta, una por fila.",
            "Una fila que falla se omite; el resto del archivo se importa igual.",
          ] },
        ],
      },
      {
        id: "who-can-do-it",
        heading: "Quién puede hacerlo",
        blocks: [
          { p: "Importar es crear solicitudes, así que exige **View, create, and edit** en Requests: **Estimator**, **Dispatcher**, **Manager**, **Administrator** y el propietario. Un miembro por debajo ve el panel de acceso denegado, y el servidor rechaza la carga." },
        ],
      },
    ],
    faq: [
      { q: "¿Creará duplicados?", a: "El importador no comprueba prospectos existentes, así que importar dos veces el mismo archivo produce dos tarjetas por persona. Los clientes duplicados solo se evitan después, cuando un prospecto se convierte y se asocia por correo o teléfono." },
      { q: "¿Puedo importar clientes de esta manera?", a: "No: esto crea prospectos. Los clientes tienen su propio importador en Clientes; vea [[import-clients-from-a-csv|Importar clientes desde un CSV]]." },
      { q: "¿Por qué mi columna de presupuesto no se asignó?", a: "El importador lee una cifra, un rango o un puñado de palabras. Un presupuesto escrito como «mid-range» o «TBC» no corresponde a nada y el prospecto no muestra banda. Abra el prospecto y elíjala." },
    ],
  },

  "convert-a-lead-to-a-quote": {
    title: "Convertir un prospecto en presupuesto",
    summary:
      "Qué hace el botón Convertir en presupuesto: el cliente que crea o asocia, el borrador que abre, qué se traslada, y por qué el prospecto todavía no está Ganado.",
    updated: "2026-09-12",
    intro: [
      "**Convertir en presupuesto**, en el panel del prospecto, convierte una consulta en un borrador de presupuesto con los datos de la persona, el servicio que pidió, sus respuestas y sus fotos ya puestos, y lo deja a usted en el generador listo para poner precio. Crea la ficha de cliente al mismo tiempo, o la asocia a una que usted ya tiene.",
      "No pone el prospecto en Ganado. Redactar un presupuesto no es ganar el trabajo; a partir de aquí el prospecto sigue el destino real del presupuesto.",
    ],
    sections: [
      {
        id: "overview",
        heading: "Resumen",
        blocks: [
          { p: "Convertir es una sola pulsación y es seguro pulsar dos veces: un prospecto ya vinculado a un presupuesto muestra **Ver presupuesto Q-…** en su lugar, y pulsarlo abre ese presupuesto en vez de crear un segundo." },
          { p: "El presupuesto se crea en **borrador** con un total de cero. Nadie le ha puesto precio todavía, y un número que el propietario pudiera ver sin que usted lo aprobara es exactamente lo que la distinción entre prospecto y presupuesto existe para evitar. Su trabajo en el generador es el precio; el resto ya está lleno." },
        ],
      },
      {
        id: "how-to",
        heading: "Cómo convertir",
        blocks: [
          { steps: [
            "Abra el prospecto en el tablero **Prospectos**.",
            "Lea **Por qué esta puntuación**, **Su mensaje** y **Lo que nos dijeron**: las respuestas irán en las notas del presupuesto, pero aquí es donde decide si conviene llamar primero.",
            "Pulse **Convertir en presupuesto**. El botón dice **Convirtiendo…** y el generador se abre en el nuevo borrador.",
            "Añada las líneas y el precio, y luego **Guardar como borrador** o **Guardar y enviar**; vea [[build-a-quote|Armar un presupuesto]] y [[send-a-quote|Enviar un presupuesto]].",
          ] },
          { tip: "Convierta antes de llamar si quiere tener el número de presupuesto delante durante la llamada. La tarjeta del prospecto muestra el número en cuanto existe." },
        ],
      },
      {
        id: "what-carries-over",
        heading: "Qué se traslada",
        blocks: [
          { table: {
            head: ["En el prospecto", "En el presupuesto"],
            rows: [
              ["Nombre, correo, teléfono", "El cliente. Asociado a un cliente existente por el correo primero y luego por el teléfono, para que quien consulta de nuevo no se convierta en una segunda ficha de cliente."],
              ["Dirección, ciudad, provincia, país del formulario", "La dirección del cliente y su jurisdicción fiscal, que es la diferencia entre un presupuesto que cobra el impuesto correcto y uno que en silencio no cobra ninguno."],
              ["El servicio que eligió", "El primer grupo de alcance del presupuesto, de ese tipo, todavía sin líneas."],
              ["Presupuesto y plazo", "Dos líneas al inicio de las **Notas** del presupuesto: «Budget: 5,000 – 15,000», «Timeline: Within 2 weeks», seguidas de su mensaje."],
              ["Fotos, videos, planos PDF", "Las **Fotos y videos del cliente** del presupuesto. Vea [[photos-on-a-quote|Fotos en un presupuesto]]."],
              ["El idioma que eligió", "El idioma del presupuesto, fijado al crearlo. Un prospecto al que nunca se le preguntó toma el idioma de su empresa. Vea [[quote-language|Un presupuesto conserva su idioma]]."],
              ["El prospecto en sí", "Vinculado al presupuesto: la tarjeta muestra el número de presupuesto y el panel ofrece **Ver presupuesto**."],
            ],
          } },
          { note: "Las dos líneas sobre presupuesto y plazo van en las notas del presupuesto, que el cliente puede leer. Edite las notas en el generador si prefiere que no vea lo que le dijo." },
        ],
      },
      {
        id: "the-lead-follows-the-quote",
        heading: "El prospecto sigue al presupuesto",
        blocks: [
          { p: "Convertir deja la columna del prospecto donde estaba. Desde entonces el prospecto se mueve con el presupuesto:" },
          { bullets: [
            "Presupuesto **enviado** → el prospecto pasa a **Contactado**, si todavía estaba en **Nuevo**. Un reenvío nunca devuelve hacia atrás un prospecto ganado o perdido.",
            "Presupuesto **aceptado** → el prospecto pasa a **Ganado**. Es también el momento en que se crea un trabajo; vea [[convert-a-quote-to-a-job|Qué pasa cuando se aprueba un presupuesto]].",
            "Presupuesto **rechazado** → el prospecto pasa a **Perdida**.",
          ] },
          { warning: "Hasta que exista un presupuesto, **Ganado** se rechaza en el tablero y en el panel, con la frase **Ganado sigue el resultado del presupuesto — primero convierte este prospecto.** Una victoria falsa quedaría en su tasa de éxito para siempre." },
        ],
      },
      {
        id: "who-can-do-it",
        heading: "Quién puede hacerlo",
        blocks: [
          { p: "Convertir crea un presupuesto, así que exige **View, create, and edit** en Quotes: **Estimator**, **Dispatcher**, **Manager**, **Administrator** y el propietario. Un miembro que puede ver prospectos pero no crear presupuestos recibe un rechazo del servidor, mostrado en el panel." },
        ],
      },
    ],
    faq: [
      { q: "Convertí el prospecto equivocado. ¿Puedo deshacerlo?", a: "Elimine el borrador de presupuesto desde su página si su nivel de acceso permite eliminar presupuestos. El prospecto se desvincula cuando el presupuesto desaparece y puede convertirse de nuevo. No hay botón de deshacer en el prospecto." },
      { q: "¿Por qué convertir no creó un cliente nuevo?", a: "Porque usted ya tenía uno con ese correo o ese teléfono. El presupuesto queda unido al cliente existente, que es lo que quiere para un cliente que vuelve." },
      { q: "El presupuesto se abrió en inglés y mi empresa trabaja en español.", a: "La persona eligió inglés en su formulario, y todo lo que ha recibido desde entonces fue en inglés. Cambiar el documento a español en el momento exacto en que empieza a importar es justo lo que la regla impide. Vea [[quote-language|Un presupuesto conserva su idioma]]." },
    ],
  },

  "the-quotes-list": {
    title: "La lista de cotizaciones",
    summary:
      "Cada presupuesto que ha escrito su empresa, con etiquetas de estado que filtran, un cuadro de búsqueda, y los presupuestos que esperan respuesta de un cliente subidos al inicio.",
    updated: "2026-09-12",
    intro: [
      "**Cotizaciones** es la lista de todos los presupuestos — borrador, enviado, aprobado o rechazado — con una etiqueta por estado que filtra la lista, un cuadro de búsqueda, y algo que ninguna lista plana hace: los presupuestos enviados que nunca tuvieron respuesta suben al inicio bajo el encabezado **Cotización enviada, sin respuesta**, los más antiguos primero, con su fecha de vencimiento al lado.",
    ],
    sections: [
      {
        id: "overview",
        heading: "Resumen",
        blocks: [
          { p: "La pantalla dice **Cotizaciones — Gestiona las cotizaciones de clientes.** El botón **Nueva cotización** abre el generador; vea [[build-a-quote|Armar un presupuesto]]. Cada fila abre la página del presupuesto, donde viven el envío, la edición, la revisión de IA y la decisión del cliente — y **Duplicar**, que parte de un presupuesto ya escrito para hacer un borrador nuevo." },
        ],
      },
      {
        id: "on-the-screen",
        heading: "Qué hay en la pantalla",
        blocks: [
          { p: "De arriba abajo:" },
          { bullets: [
            "**Nueva cotización**, arriba a la derecha, que solo ven los miembros que pueden crear presupuestos.",
            "Cinco etiquetas con conteos — **Todos**, **Borrador**, **Enviada**, **Aprobada**, **Rechazada**. Pulsar una muestra las filas detrás del número. Los conteos son de presupuestos cuyo estado es ese ahora mismo, así que **Enviada** baja en uno en el momento en que un cliente acepta.",
            "**Buscar cotizaciones...** — coincide con el número de presupuesto y el nombre del cliente.",
            "El grupo **Cotización enviada, sin respuesta**, cuando el filtro está en **Todos** y al menos un presupuesto espera: esas filas primero, el envío más antiguo al inicio.",
            "Todo lo demás en el orden en que se creó, lo más nuevo primero: lo que acaba de escribir es lo que está buscando.",
            "Un panel de primer uso, **Aún no hay cotizaciones.** con **Crea tu primera cotización**, cuando la empresa nunca ha escrito uno; **Ninguna cotización coincide con tu búsqueda.** cuando un filtro o una búsqueda reduce la lista a nada.",
          ] },
          { figure: "harness:quotes", caption: "Cotizaciones — las cinco etiquetas de estado con sus conteos, el cuadro de búsqueda, y un presupuesto enviado subido al inicio bajo «Cotización enviada, sin respuesta»." },
        ],
      },
      {
        id: "the-order-of-the-rows",
        heading: "Por qué las filas van en ese orden",
        blocks: [
          { p: "Un presupuesto enviado hace doce días y otro enviado hace treinta y uno se veían idénticos, y el segundo vence mañana. La lista ahora separa las filas que alguien tiene que perseguir de todo lo demás:" },
          { bullets: [
            "**Por perseguir** — estado **Enviada**. Ordenadas por fecha de envío, la más antigua primero, porque el cliente que lleva más tiempo esperando es el que más probablemente lo olvidó. Un presupuesto enviado cuyo vencimiento cae en **3 días**, o ya pasó, lleva una barra de acento en su borde izquierdo.",
            "**El resto** — todo lo que no está enviado, lo más nuevo primero.",
            "Un presupuesto marcado como enviado a mano — un precio acordado por teléfono, un documento importado — no tiene fecha de envío, así que la fila no muestra antigüedad en vez de inventar una a partir del día en que se creó.",
          ] },
          { note: "El énfasis de 3 días es solo visual. Nada se envía ni se decide a partir de él; el correo de seguimiento automático tiene su propio retraso en **Configuración → Seguimientos**; vea [[quotes-sent-with-no-response|Presupuestos enviados sin respuesta]]." },
        ],
      },
      {
        id: "what-each-row-says",
        heading: "Qué dice cada fila",
        blocks: [
          { table: {
            head: ["En la fila", "Significado"],
            rows: [
              ["**Q-1044** y una etiqueta de estado", "El número y el estado actual: **Borrador**, **Enviada**, **Aprobada**, **Rechazada**, o **Vencida** en un presupuesto enviado cuya fecha pasó."],
              ["**Requiere revisión**", "Una estimación instantánea que el propietario tasó por su cuenta, todavía por confirmar por una persona en **Revisiones de presupuesto** antes de poder enviarse. Vea [[estimate-reviews|Revisiones de estimaciones]]."],
              ["**Aprobada — lista para enviar**", "Una estimación instantánea que una persona confirmó; ahora es un borrador normal."],
              ["El nombre del cliente", "Para quién es."],
              ["**hoy**, **ayer**, **hace 4 días**", "La antigüedad: desde la fecha de envío en un presupuesto enviado, desde la creación en los demás."],
              ["**Válida hasta 2026-10-10** o **Vencida 2026-09-01**", "El vencimiento propio del presupuesto, en los enviados. Un presupuesto sin vencimiento no muestra ninguno. Vea [[quote-validity-and-expiry|Cuánto tiempo sigue válido un presupuesto]]."],
            ],
          } },
        ],
      },
      {
        id: "who-can-see-it",
        heading: "Quién puede verlo",
        blocks: [
          { p: "La lista exige al menos **View only** en Quotes; **Nueva cotización** exige **View, create, and edit**. **Crew** no tiene acceso a presupuestos y no ve la fila. **Estimator** y **Dispatcher** pueden ver, crear y editar; **Manager**, **Administrator** y el propietario también pueden eliminar. Un miembro sin el interruptor **See prices** ve las filas con los montos ocultos." },
        ],
      },
    ],
    faq: [
      { q: "¿Por qué el conteo de Enviada difiere de «Cotizaciones enviadas este mes» en el panel principal?", a: "Esta etiqueta cuenta los presupuestos cuyo estado es Enviada ahora mismo. El panel principal cuenta cada presupuesto enviado en el mes, incluidos los que desde entonces se aceptaron o rechazaron." },
      { q: "¿Dónde está el seguimiento?", a: "El grupo Cotización enviada, sin respuesta es la fila. El correo de recordatorio en sí es una automatización en Configuración → Seguimientos, y la página de cada presupuesto muestra lo que se envió." },
      { q: "¿Puedo ordenar por monto o por cliente?", a: "No en esta pantalla. Use el cuadro de búsqueda para un cliente; el orden está fijo en lo que hay que perseguir primero y luego lo más nuevo." },
    ],
  },

  "build-a-quote": {
    title: "Armar un presupuesto",
    summary:
      "El generador de presupuestos de arriba abajo — cliente, responsable, idioma, servicios, líneas, costo y margen, notas, fotos, totales — y las tres formas de salir de él.",
    updated: "2026-09-12",
    intro: [
      "**Nueva cotización** abre una sola pantalla — el generador — que es también el editor de cada presupuesto que usted reabre. Elige el cliente, toca los servicios, llena lo que cada uno pide, ajusta las líneas, y el total se calcula solo a partir de sus propias tarifas. Nada de lo que escribe aquí llega al cliente hasta que lo envía.",
      "El subtítulo lo dice: **Crea una cotización a partir de tus servicios habilitados.** Las tarjetas que ve son los tipos de presupuesto que activó en **Configuración → Servicios y precios**, y los precios que rellenan son los suyos.",
    ],
    sections: [
      {
        id: "overview",
        heading: "Resumen",
        blocks: [
          { p: "Un presupuesto es un cliente, un idioma, uno o más **grupos de alcance** (uno por servicio, cada uno con sus líneas y su propio subtotal), un descuento, impuesto, una fecha de vencimiento, notas, fotos y un estado. El generador mantiene un subtotal en cada grupo para que vea qué mitad de un presupuesto de dos servicios es la cara." },
          { p: "Crear y editar solo difieren en dos cosas: en un presupuesto nuevo usted elige el cliente y el idioma; en uno guardado ambos están fijos, el idioma porque un documento conserva el idioma en que se creó, y el cliente porque el presupuesto es suyo." },
        ],
      },
      {
        id: "before-you-start",
        heading: "Antes de empezar",
        blocks: [
          { bullets: [
            "Active los tipos de presupuesto que vende y fije sus tarifas: [[quote-types-and-takeoffs|Tipos de presupuesto y mediciones]]. Un tipo desactivado no tiene tarjeta.",
            "Ponga sus extras puntuales en la lista de precios — [[lines-from-your-price-book|Líneas desde su lista de precios]] — para tenerlos a un toque.",
            "Tenga la dirección del cliente: determina la tasa de impuesto, y un presupuesto sin jurisdicción muestra una tasa supuesta con una advertencia debajo.",
            "¿Ya cotizó algo parecido? **Duplicar** en la página de ese presupuesto abre un borrador nuevo con el siguiente número, con el mismo cliente, idioma, servicios y líneas, los extras ofrecidos, el costeo, las notas y las secciones del correo — y nada de su historial: sin fecha de envío, firma, aprobación, cambios del cliente ni revisión de IA.",
          ] },
          { tip: "¿Viene de un prospecto? **Convertir en presupuesto** en el panel del prospecto abre esta pantalla con el cliente, el servicio, las respuestas y las fotos ya llenos. Vea [[convert-a-lead-to-a-quote|Convertir un prospecto en presupuesto]]." },
        ],
      },
      {
        id: "the-builder-top-to-bottom",
        heading: "El generador, de arriba abajo",
        blocks: [
          { p: "Las tarjetas, en el orden en que aparecen:" },
          { bullets: [
            "**Cliente** — «Search clients…» o «Add new client» (una persona o una empresa, con su persona de contacto, idioma y dirección). Elegir un cliente con idioma guardado fija el idioma del presupuesto.",
            "**Asignado a** — «Me (default)», u otro miembro. Reasignar a otra persona exige el permiso de asignación; si no, el servidor lo rechaza.",
            "La barra de idioma: el idioma en que se escribirá este documento, entre los idiomas en que envía su empresa. Se elige una vez; queda fijo tras el primer guardado. Vea [[quote-language|Un presupuesto conserva su idioma]].",
            "**Agregar un servicio — Toque uno para agregarlo a esta cotización. Sus propios precios se completan automáticamente.** Una tarjeta por tipo de presupuesto activado. Algunos oficios abren una lista de secciones para elegir; vea [[group-a-quote-by-room-or-scope|Agrupar un presupuesto por habitación o por alcance]].",
            "Una tarjeta por cada servicio añadido, numerada **01**, **02** cuando hay más de una, con el color del oficio, un subtotal en curso y un botón para quitarla. Dentro: el formulario del oficio — una medición, una cuadrícula de unidades, un menú de paquetes o un conjunto de preguntas — y luego las líneas: «Description», «Qty», «Rate», «Amount», «Add line item», «Common for this trade» y «+ Add from Products & Services…».",
            "**Cost & margin (internal — never shown to the client)** — cuadrilla, horas, materiales, gastos generales y el margen frente al precio. Solo lo ven los miembros con costeo de trabajos. Vea [[cost-and-margin-on-a-quote|Costo y margen en un presupuesto]].",
            "**Notas** (**Todo lo que el cliente deba saber...**) y **Fotos y videos del cliente**; vea [[photos-on-a-quote|Fotos en un presupuesto]].",
            "La barra de totales — **Válida hasta** (30 días desde hoy, modificable o borrable), **Descuento** como monto o porcentaje, **Tasa de impuesto (%)** con **Cobrar impuesto en esta cotización**, luego **Subtotal**, **Impuesto**, **Total** — y los botones **Revisión**, **Guardar como borrador**, **Guardar y enviar**. Debajo, **Qué sigue**: los pasos del proceso que el cliente lee al pie del presupuesto.",
          ] },
          { figure: "live:app-quotes-new", caption: "Nueva cotización — Cliente, Asignado a, Agregar un servicio, Costo y margen, Notas, Fotos y videos, y luego la barra de totales con Revisión, Guardar como borrador y Guardar y enviar." },
        ],
      },
      {
        id: "how-to",
        heading: "Cómo armar uno",
        blocks: [
          { steps: [
            "Pulse **Nueva cotización** en la lista de cotizaciones.",
            "Elija el cliente, o «Add new client» y complete nombre, correo, teléfono, idioma y dirección.",
            "Revise la barra de idioma. El idioma guardado del cliente ya está seleccionado; cámbielo solo si este documento debe ir en otro.",
            "Toque una tarjeta de servicio. Su tarjeta aparece con el formulario propio del oficio.",
            "Llene el formulario: puertas y frentes de cajón, áreas y superficies, un tamaño de carga, o las preguntas del oficio. Las líneas y el subtotal aparecen a medida que escribe.",
            "Ajuste las líneas: edite una tarifa, añada una línea a mano, toque una de «Common for this trade» (una descripción con el precio en blanco para usted), o elija un artículo de «+ Add from Products & Services…» con su precio ya puesto.",
            "Fije **Válida hasta**, un **Descuento** si lo hay, y revise la línea de impuesto. Una nota amarilla **Supuesto** significa que la tasa vino de su propia provincia porque el cliente no tiene dirección registrada: elija un cliente con dirección, escriba la tasa o desactive el impuesto.",
            "Pulse **Guardar como borrador**, **Guardar y enviar** o **Revisión**.",
          ] },
          { note: "El generador se niega a guardar hasta que haya un cliente elegido y al menos un servicio en el presupuesto: los botones siguen desactivados y la franja dice **Primero selecciona o crea un cliente** o **Agrega al menos un servicio a la cotización**." },
        ],
      },
      {
        id: "three-ways-out",
        heading: "Las tres formas de salir",
        blocks: [
          { table: {
            head: ["Botón", "Qué pasa"],
            rows: [
              ["**Guardar como borrador**", "El presupuesto se guarda con estado **Borrador** y se abre su página. Nadie recibe correo."],
              ["**Guardar y enviar**", "Una confirmación pregunta **¿Enviar esta cotización? La recibirán por correo de inmediato. No se puede deshacer.** y nombra al destinatario. **Guardar y enviar** guarda y envía el presupuesto por correo, con su PDF, en el idioma del presupuesto. El estado pasa a **Enviada** solo cuando el correo es aceptado. Vea [[send-a-quote|Enviar un presupuesto]]."],
              ["**Revisión**", "Guarda primero un borrador — la revisión lee el presupuesto guardado — y luego lo abre con las comprobaciones ya hechas: completitud, una comparación de precio contra su propio historial, extras sugeridos y las notas de la IA. Vea [[ai-quote-review|La revisión de presupuestos por IA]]."],
            ],
          } },
          { warning: "Guardar un presupuesto congela sus precios. Las líneas de un grupo guardado se editan como números; su medición se conserva pero no se reabre, para que un presupuesto que ya está en la bandeja de un cliente nunca cambie de precio en silencio porque una lista de tarifas se movió." },
        ],
      },
      {
        id: "who-can-do-it",
        heading: "Quién puede hacerlo",
        blocks: [
          { p: "Armar un presupuesto exige **View, create, and edit** en Quotes y el interruptor **See prices**: **Estimator**, **Dispatcher**, **Manager**, **Administrator** y el propietario. A un miembro con acceso a presupuestos pero sin See prices se le niega el generador en lugar de mostrarle uno con precios que no son los de la empresa. **Crew** no tiene acceso a presupuestos." },
        ],
      },
    ],
    faq: [
      { q: "¿De dónde salen los precios?", a: "De la lista de tarifas del oficio en Configuración → Servicios y precios para el alcance principal, y de Productos y servicios para los extras. Ambas son suyas; los valores predeterminados de FieldQuo solo aplican hasta que usted fija los propios." },
      { q: "¿Puedo escribir un presupuesto sin una tarjeta de servicio?", a: "No: cada presupuesto tiene al menos un grupo de alcance. Si ningún tipo integrado encaja, cree un tipo de presupuesto personalizado con los campos que quiera en Configuración → Servicios y precios." },
      { q: "¿Por qué desaparece la barra de idioma en un presupuesto guardado?", a: "Un presupuesto conserva el idioma en que se creó, para que la copia enviada por correo y el PDF digan lo mismo que lo aprobado. Cree un presupuesto nuevo para otro idioma." },
      { q: "¿Para qué sirven las Notas para revisar?", a: "Un cuadro interno que solo aparece cuando un borrador de llamada telefónica o la revisión pusieron algo en él. Nunca aparece en la copia del cliente; bórrelas cuando haya resuelto lo que dicen." },
    ],
  },

  "quote-types-and-takeoffs": {
    title: "Tipos de presupuesto y mediciones",
    summary:
      "Configuración → Servicios y precios: los tipos de presupuesto que activa, las cuatro formas en que un tipo pone precio — medición, cuadrícula de unidades, paquetes o preguntas — la lista de tarifas detrás de cada uno, y los tipos personalizados.",
    updated: "2026-09-12",
    intro: [
      "Un **tipo de presupuesto** es lo que representa una tarjeta de servicio en el generador: una clase de trabajo, las preguntas que hace y la lista de tarifas de la que toma precios. **Configuración → Servicios y precios** es donde usted activa y desactiva tipos, fija las tarifas y escribe lo que el presupuesto dice de cada uno. Las tarjetas de **Nueva cotización** son exactamente los tipos que están activos aquí.",
      "Algunos tipos ponen precio desde una **medición**: un formulario estructurado que mide el trabajo y escribe las líneas por usted. Otros ponen precio por unidad, desde un menú de paquetes, o desde un breve conjunto de preguntas y una tarifa fija.",
    ],
    sections: [
      {
        id: "overview",
        heading: "Resumen",
        blocks: [
          { p: "La pantalla dice **Servicios y precios — Activa los tipos de presupuesto que ofreces y define tu tarifa predeterminada para cada uno. Son los que aparecen cuando creas un nuevo presupuesto. Aún puedes ajustar los precios en cada presupuesto.** Lista los tipos de los sectores que eligió al registrarse; **+ Mostrar servicios de otros oficios** abre todo el catálogo, unos setenta." },
          { p: "Las tarifas nunca salen de esta pantalla. El formulario público de presupuesto ofrece sus servicios activados y sus preguntas, nunca un precio; esa regla es fija." },
        ],
      },
      {
        id: "on-the-screen",
        heading: "Qué hay en la pantalla",
        blocks: [
          { p: "Una tarjeta por tipo de presupuesto:" },
          { bullets: [
            "Una casilla: marcada, el tipo tiene una tarjeta en el generador y aparece en su formulario público de presupuesto.",
            "**Se cobra por** — etiquetas que nombran por qué cobra el tipo («3-tab asphalt shingles (square)», «Per door», «Vinyl siding (sqft of wall)»). Un tipo cotizado a partir de la factura de un proveedor no tiene base por unidad y no muestra ninguna.",
            "«Rate card» — una cuadrícula plegable con sus tarifas para el alcance principal, con «Reset to defaults». Una etiqueta «customised» aparece cuando alguna tarifa es suya y no la predeterminada.",
            "**Lo que dice el presupuesto** — el texto que el cliente lee para ese oficio: **En qué consiste este servicio**, **Qué incluye**, **Cómo se desarrolla el trabajo**. Deje un campo vacío para seguir heredando el texto predeterminado de FieldQuo.",
            "**Los propietarios pueden obtener un precio instantáneo para esto** o **Hay una cotización instantánea disponible para esto — configúrala** — la estimación instantánea del oficio, con enlace a **Configuración → Cotizaciones instantáneas**.",
            "Para un tipo sin lista de tarifas: un cuadro **Tarifa** y una unidad, más **Agregar artículos estándar a Productos y servicios** cuando el oficio trae un conjunto estándar de extras.",
          ] },
          { figure: "live:app-settings-services", caption: "Configuración → Servicios y precios — una tarjeta por tipo de presupuesto con su casilla, las etiquetas Se cobra por, la lista de tarifas y Lo que dice el presupuesto." },
        ],
      },
      {
        id: "the-four-ways-a-type-prices",
        heading: "Las cuatro formas en que un tipo pone precio",
        blocks: [
          { table: {
            head: ["Cómo pone precio", "Qué tipos", "Qué llena usted en el presupuesto"],
            rows: [
              ["**Medición** — un formulario medido que escribe las líneas", "Pintura interior y exterior, pisos, escaleras, cubiertas de cocina, techos, revestimiento, canaletas, aislamiento, pavimento, sellado de entradas, puertas de garaje, retiro de nieve, inspección de vivienda", "Áreas, superficies, cuadros, pies lineales, los elementos del trabajo. Cada uno se convierte en una línea con su medida en la descripción, con precio de la lista de tarifas."],
              ["**Cuadrícula de unidades** — por puerta, por frente de cajón, con complejidad", "Repintado de gabinetes, recubrimiento de gabinetes", "Cantidades y el material de las puertas; la complejidad elegida en el presupuesto mueve la tarifa."],
              ["**Paquetes** — un menú de opciones", "Retiro de desechos (**Load Size**), detallado de autos, limpieza de chimeneas", "Un paquete; su precio es la línea."],
              ["**Preguntas y una tarifa** — los campos de admisión y una tarifa fija o por unidad", "Todos los demás tipos, y cada tipo personalizado", "Las preguntas del tipo, luego líneas que añade a mano o desde la lista de precios."],
            ],
          } },
          { p: "Dieciséis oficios traen una lista de tarifas completa; el resto tiene una sola **Tarifa** por unidad. Sea cual sea el método, el resultado es el mismo tipo de línea — una descripción y un monto — y la página, el correo y el PDF del cliente solo leen eso. Las tasas de producción, las fórmulas y las tarifas de venta se quedan de su lado." },
        ],
      },
      {
        id: "turn-a-type-on",
        heading: "Cómo activar un tipo y fijar sus tarifas",
        blocks: [
          { steps: [
            "Abra **Configuración → Servicios y precios**. Use **Buscar servicios** o **+ Mostrar servicios de otros oficios** para encontrar el tipo.",
            "Marque su casilla.",
            "Abra «Rate card» y escriba sus tarifas sobre las predeterminadas. Cada oficio viene con los valores predeterminados de FieldQuo para que una empresa nueva pueda cotizar el primer día; una tarifa que usted escribe gana sobre la predeterminada desde entonces.",
            "Abra **Lo que dice el presupuesto** si quiere su propio texto para qué es el servicio, qué incluye y cómo se desarrolla el trabajo.",
            "Pulse **Guardar configuración**. La tarjeta aparece en **Nueva cotización** y el servicio en su formulario público de presupuesto.",
          ] },
          { note: "Cambiar una tarifa cambia solo los presupuestos futuros. Un presupuesto guardado conserva los precios con los que se escribió: sus líneas se congelaron al guardar para que la copia de un cliente nunca cambie de precio bajo sus pies." },
        ],
      },
      {
        id: "custom-quote-types",
        heading: "Tipos de presupuesto personalizados",
        blocks: [
          { p: "Para un trabajo que ningún tipo integrado describe, **Agregar tipo de presupuesto personalizado** crea el suyo. Dice: **Ponle un nombre y luego elige qué campos debe pedir en un presupuesto — elegidos entre los campos que ya se usan en los demás tipos de presupuesto de FieldQuo, para que funcione igual en el generador de presupuestos de inmediato.**" },
          { steps: [
            "Pulse **Agregar tipo de presupuesto personalizado** y escriba un nombre, por ejemplo **Organización de clósets**.",
            "Marque los campos que debe pedir — busque en la biblioteca con **Buscar campos…** — o no marque ninguno: **No seleccionar ningún campo también está bien — se comportará como un artículo de tarifa fija, sin formulario adicional.**",
            "Pulse **Crear tipo de presupuesto**. Aparece en la lista con una insignia **Personalizado**, un cuadro **Tarifa** y una unidad.",
            "Márquelo y pulse **Guardar configuración**.",
          ] },
          { tip: "Un tipo personalizado puede llevar su propio texto en **Lo que dice el presupuesto** y sus propios artículos de la lista de precios, exactamente como uno integrado." },
        ],
      },
      {
        id: "what-the-quote-says",
        heading: "Lo que dice el presupuesto",
        blocks: [
          { p: "Bajo cada tipo activado, **Lo que dice el presupuesto** guarda los tres párrafos que el cliente lee sobre ese oficio, en el idioma en que está escrito el presupuesto:" },
          { bullets: [
            "**En qué consiste este servicio** — un párrafo que describe el alcance.",
            "**Qué incluye** — una lista de líneas, con un botón para añadir y otro para quitar una línea.",
            "**Cómo se desarrolla el trabajo** — pasos con nombre, un cronograma y una frase cada uno, con un botón para añadir y otro para quitar un paso.",
          ] },
        ],
      },
      {
        id: "who-can-see-it",
        heading: "Quién puede verlo",
        blocks: [
          { p: "La fila se muestra a los miembros con el interruptor **See prices**: **Estimator** y superiores. Guardar la configuración y crear un tipo personalizado son acciones del propietario y los administradores; cualquier otro recibe «Only owners/admins can change settings» del servidor." },
          { warning: "Desactivar un tipo lo quita del generador y de su formulario público de presupuesto de una vez. Los presupuestos ya escritos con él no se tocan." },
        ],
      },
    ],
    faq: [
      { q: "¿Tengo que llenar toda la lista de tarifas?", a: "No. Cada campo tiene un valor predeterminado, y solo cambian los que usted sobrescribe. La etiqueta customised le dice qué listas llevan sus propios números." },
      { q: "¿Un cliente puede ver mis tarifas?", a: "Nunca. El formulario público devuelve solo servicios y preguntas; la medición, la fórmula y la lista de tarifas no se envían a ninguna página del cliente." },
      { q: "¿Cuál es la diferencia entre la lista de tarifas y Productos y servicios?", a: "La lista de tarifas pone precio al alcance principal de un oficio — por puerta, por cuadro, por pie — y escribe las líneas base. Productos y servicios guarda los extras puntuales que usted suelta en cualquier presupuesto. Vea [[lines-from-your-price-book|Líneas desde su lista de precios]]." },
      { q: "¿Por qué mi oficio no tiene lista de tarifas?", a: "Solo dieciséis oficios traen una lista completa. Los demás toman aquí una sola Tarifa por unidad y ponen precio a sus líneas a mano o desde la lista de precios." },
    ],
  },

  "lines-from-your-price-book": {
    title: "Líneas desde su lista de precios",
    summary:
      "Configuración → Productos y servicios: los artículos que puede soltar en cualquier presupuesto con su precio ya puesto, cómo añadirlos e importarlos, y cómo aparecen en el generador.",
    updated: "2026-09-12",
    intro: [
      "**Productos y servicios** es su lista de precios: los extras y artículos puntuales — manijas, bisagras, un cargo por urgencia, un cargo por disposición — que usted suelta en un presupuesto con un toque, con el precio que fijó. Una línea tomada de aquí tiene el precio que usted puso, así que el número que ve el propietario es el que usted decidió.",
      "Es distinta de la lista de tarifas en **Configuración → Servicios y precios**, que pone precio al alcance principal de un oficio. Las dos responden preguntas distintas: una tarifa dice cuánto cuesta una unidad de trabajo; un producto dice qué más se agregó al trabajo.",
    ],
    sections: [
      {
        id: "overview",
        heading: "Resumen",
        blocks: [
          { p: "La pantalla dice **Productos y servicios — Agrega y actualiza tus productos y servicios para mantenerte organizado al crear presupuestos, plantillas de presupuesto, trabajos y facturas.** Una tabla con **Name**, **Description** y **Type**, búsqueda, **Agregar artículo**, editar y eliminar en cada fila, y dos tarjetas para importar y exportar CSV." },
          { p: "Un artículo puede limitarse a ciertos tipos de presupuesto. En el generador, el menú «+ Add from Products & Services…» de una tarjeta de servicio lista solo los artículos vinculados a ese tipo — un grupo de pisos no ofrece herrajes de gabinetes — o todos los artículos, si el artículo quedó sin vincular." },
        ],
      },
      {
        id: "rate-card-vs-price-book",
        heading: "¿Lista de tarifas o lista de precios?",
        blocks: [
          { table: {
            head: ["Pregunta", "Lista de tarifas (Servicios y precios)", "Lista de precios (Productos y servicios)"],
            rows: [
              ["A qué pone precio", "El alcance principal: por puerta, por cuadro, por pie lineal. Construye las líneas base del presupuesto a partir de la medición.", "Extras y artículos puntuales, con precio individual. Se añaden a un presupuesto a mano."],
              ["Dónde aparece", "Dentro del formulario del oficio, en el presupuesto.", "En el menú «+ Add from Products & Services…» bajo las líneas de un servicio."],
            ],
          } },
          { p: "Varios oficios traen un conjunto estándar de extras. **Agregar artículos estándar a Productos y servicios**, en la tarjeta del tipo en Servicios y precios, los crea aquí con una pulsación, ya vinculados a ese tipo; la misma mejora puede vincularse a más de un oficio." },
        ],
      },
      {
        id: "on-the-screen",
        heading: "Qué hay en la pantalla",
        blocks: [
          { p: "De arriba abajo:" },
          { bullets: [
            "La búsqueda y **Agregar artículo**.",
            "La tabla — **Name**, **Description**, **Type** (**Servicio** o **Producto**) — con **Editar artículo** y eliminar en cada fila, paginada cuando la lista es larga.",
            "**Costos** — **Registra lo que te cuestan tus productos y servicios: define un precio de costo junto al precio de venta cuando agregues o edites un artículo arriba. Se guarda en el artículo y se incluye en la exportación CSV; todavía no hay ningún presupuesto, cálculo de costos ni margen que lo lea.**",
            "**Importar productos y servicios** — **Importar CSV** y **Descargar archivo de ejemplo**. Columnas: **name, description, type, unitPrice, costPrice, unit**.",
            "**Exportar productos y servicios** — **Exportar CSV** descarga toda la lista.",
          ] },
          { figure: "live:app-settings-products", caption: "Configuración → Productos y servicios — la tabla, la tarjeta Costos, y las tarjetas de importación y exportación." },
        ],
      },
      {
        id: "add-an-item",
        heading: "Cómo añadir un artículo",
        blocks: [
          { steps: [
            "Abra **Configuración → Productos y servicios** y pulse **Agregar artículo**.",
            "Escriba el nombre y, si el cliente debe leer más, una **Descripción**.",
            "Elija **Servicio** o **Producto**, y la unidad: **Unidad (p. ej. pie²)**.",
            "Escriba el **Precio unitario**. El **Precio de costo** es opcional y, por ahora, solo informativo.",
            "Bajo **Disponible en estos tipos de presupuesto**, marque los tipos a los que pertenece este artículo, o no marque ninguno: **Deja todo sin marcar para que esté disponible en todos los tipos de presupuesto.**",
            "Pulse **Agregar artículo**. Queda listo en el generador de inmediato.",
          ] },
          { figure: "create:app-settings-products-create", caption: "Productos y servicios — lo que se abre al pulsar Agregar artículo: nombre, descripción, tipo y unidad, precio unitario y precio de costo, y los tipos de presupuesto en que está disponible." },
          { note: "Eliminar un artículo pregunta primero: **¿Eliminar …? Su precio y su descripción se quitan de forma definitiva — los presupuestos ya redactados conservan las cifras con las que se hicieron.**" },
        ],
      },
      {
        id: "use-it-on-a-quote",
        heading: "Cómo usarlo en un presupuesto",
        blocks: [
          { steps: [
            "En el generador, añada el servicio y abra sus líneas.",
            "Bajo las líneas, abra «+ Add from Products & Services…». Cada artículo muestra su nombre y su precio.",
            "Elija uno. Aparece una línea con el nombre del artículo, su descripción como detalle, cantidad 1 y su precio unitario.",
            "Cambie la cantidad o la tarifa en ese presupuesto si el trabajo lo requiere. El artículo de la lista de precios no cambia.",
          ] },
          { p: "Una línea de la lista de precios es una línea común una vez en el presupuesto: el cliente ve una descripción y un monto, igual que en una línea que usted escribió." },
        ],
      },
      {
        id: "import-and-export",
        heading: "Importar y exportar",
        blocks: [
          { p: "**Importar CSV** toma un archivo exportado de Excel, Google Sheets o Numbers con las columnas **name, description, type, unitPrice, costPrice, unit**; **Descargar archivo de ejemplo** le da el formato. **Exportar CSV** vuelve a escribir toda la lista con el mismo formato, para que pueda editar en una hoja de cálculo y reimportar." },
          { bullets: [
            "El resultado dice **Se importaron … artículos.** Los artículos importados quedan sin vincular a ningún tipo de presupuesto — disponibles en todos — hasta que usted los edite.",
            "Una fila sin nombre se omite; un tipo distinto de **product** se guarda como **Servicio**. A un artículo añadido a mano con **Agregar artículo** también se le redacta la descripción en los demás idiomas en que envía su empresa; a uno importado, no.",
            "El importador es simple: un nombre con una coma debe ir entre comillas, como lo escribe la exportación.",
          ] },
          { warning: "Importar no reemplaza ni elimina duplicados. Importar dos veces el mismo archivo le da cada artículo dos veces." },
        ],
      },
      {
        id: "who-can-see-it",
        heading: "Quién puede verlo",
        blocks: [
          { p: "La fila y la lista se muestran a los miembros con el interruptor **See prices**: **Estimator** y superiores; una lista de precios son precios, así que a **Crew** se le rechaza en lugar de mostrarle una versión censurada. Añadir, editar, eliminar e importar artículos son acciones del propietario y los administradores: cualquier otro recibe «Only an owner or admin can change the price book.»" },
        ],
      },
    ],
    faq: [
      { q: "¿El Precio de costo alimenta el margen de un presupuesto?", a: "Todavía no. La pantalla lo dice: se guarda en el artículo y se exporta, y ningún presupuesto, cálculo de costos ni margen lo lee. El costo y el margen de un presupuesto se calculan con las recetas de materiales y la mano de obra en Configuración → Costos de materiales." },
      { q: "¿Por qué mi artículo no aparece en el menú de un presupuesto?", a: "Está vinculado a otros tipos de presupuesto. Edite el artículo y marque el tipo que está cotizando, o desmarque todo para que esté disponible en todos los tipos." },
      { q: "¿El cliente puede ver la lista de precios?", a: "No. Solo la línea que usted añade — su descripción y su monto — llega a la página, el correo y el PDF del cliente." },
      { q: "¿Cuál es la diferencia entre un Servicio y un Producto?", a: "Una etiqueta en el artículo, mostrada en la columna Type y conservada en la exportación. Ambos tienen precio de la misma manera en un presupuesto." },
    ],
  },

  "group-a-quote-by-room-or-scope": {
    title: "Agrupar un presupuesto por habitación o por alcance",
    summary:
      "Cómo se organiza un presupuesto en grupos de alcance — uno por servicio o sección — y cómo la medición de pintura desglosa un trabajo por área, para que el cliente lo lea como lo piensa.",
    updated: "2026-09-12",
    intro: [
      "Un propietario no piensa en líneas; piensa en habitaciones y en trabajos. Un presupuesto en FieldQuo se arma igual: un **grupo de alcance** por servicio o sección — **Pintura interior**, **Pisos**, **Drenaje** — cada uno con sus líneas, su propio subtotal y el color del oficio, y, dentro de un grupo de pintura, un área por habitación con las superficies debajo.",
      "La copia del cliente — la página de aprobación, el correo y el PDF — dibuja los mismos grupos en el mismo orden, de modo que lo que usted cotizó es lo que él lee.",
    ],
    sections: [
      {
        id: "overview",
        heading: "Resumen",
        blocks: [
          { p: "Cada tarjeta de servicio que toca en **Nueva cotización** añade un grupo de alcance. Un presupuesto para la cocina y el pasillo son dos grupos si son dos oficios, y un solo grupo de pintura con dos áreas si ambos son pintura. La elección es suya; el generador mantiene un subtotal en cada tarjeta de cualquier modo." },
          { p: "No hay un campo de «habitación» de texto libre en un grupo: un grupo se llama como su servicio o como la sección que eligió. El detalle habitación por habitación vive dentro de la medición de pintura, donde cada área la nombra usted." },
        ],
      },
      {
        id: "scope-groups",
        heading: "Grupos de alcance",
        blocks: [
          { p: "Cada grupo es una tarjeta:" },
          { bullets: [
            "Un número — **01**, **02** — que se muestra cuando el presupuesto tiene más de un grupo, y el color de acento del oficio en el borde izquierdo. El mismo color llega a la copia del cliente, para que el generador y el documento se vean como parte de lo mismo.",
            "El nombre del grupo y un subtotal en curso, mostrado en cuanto supera cero.",
            "El formulario propio del oficio — una medición, una cuadrícula de unidades, un menú de paquetes o un conjunto de preguntas — y luego las líneas.",
            "Un botón para quitarlo. Un grupo importado del presupuesto de un subcontratista, y cada grupo de un presupuesto que el cliente ya decidió, no pueden quitarse.",
          ] },
          { tip: "Dos veces el mismo oficio en un presupuesto está bien: toque la tarjeta dos veces. Un grupo **Techos** para la casa y otro para el garaje se leen **01 Techos** y **02 Techos**, cada uno con su subtotal." },
        ],
      },
      {
        id: "sections-inside-a-trade",
        heading: "Secciones dentro de un oficio",
        blocks: [
          { p: "Algunos oficios tienen subsecciones conocidas, y su tarjeta abre una lista en vez de añadir un grupo de inmediato — «Plumbing — pick a section»:" },
          { bullets: [
            "**Plumbing** ofrece **Groundworks**, **Drainage**, **Garage Drain**, **Waterlines**, **Tubs/Showers**, **Steamer**, **Recirc Lines**, **Gas**, **Finishing**, **Insulating**; **HVAC Installation** ofrece **Inslab**, **Boiler Systems**, **Quick Track**, **Supply/Return Mains**, **Main Slab Heat**, **Upper Floor Slab Heat**, **Wiring**, **Venting**. Cada una se convierte en un grupo con el nombre de la sección.",
            "«Something else» añade un grupo simple con el nombre del oficio, para el caso que la lista no cubre.",
          ] },
        ],
      },
      {
        id: "rooms-and-areas-in-painting",
        heading: "Habitaciones y áreas en pintura",
        blocks: [
          { p: "Las mediciones de pintura interior y exterior se organizan por **área**. Cada área es una habitación o una cara de la casa, con las superficies que va a pintar listadas debajo, y cada superficie se convierte en una línea que el cliente lee como «Living room — Walls (414 sqft)»." },
          { steps: [
            "Añada el servicio de pintura y pulse **Agregar un área**. Póngale nombre (el cuadro sugiere **Área 1**), elija el **Tipo de área** y si es **Interior** o **Exterior**, y escriba las medidas de la habitación — largo, ancho y altura del techo — o escriba una superficie medida.",
            "Pulse **Agregar una superficie…** y elija qué va a pintar en esa habitación: paredes, techo, molduras, puertas. La cantidad de cada superficie se toma de la geometría de la habitación, con **Escribir una cantidad en su lugar** si la midió usted mismo, más **Manos**, **Producto** y las **Horas de preparación** que hagan falta.",
            "Repita por habitación. **Total del área**, **Horas-hombre**, **Mano de obra**, **Materiales** y **Pintura por comprar** se actualizan a medida que avanza.",
            "Marque **Opcional — el cliente puede agregarla o quitarla** en un área o una superficie para sacarla del total y ofrecerla al pie del presupuesto para que el cliente la acepte; vea [[upsell-add-ons|Extras que el cliente puede aceptar]].",
          ] },
          { note: "Una **Nota para el cliente (en la cotización)** en un área se imprime para el cliente; una **Nota para el equipo (solo en la orden de trabajo)** nunca. La fórmula de tarifa detrás de cada línea es interna y nunca sale del generador." },
        ],
      },
      {
        id: "what-the-client-sees",
        heading: "Qué ve el cliente",
        blocks: [
          { p: "Cada superficie de cara al cliente dibuja los grupos de la misma manera:" },
          { bullets: [
            "Un encabezado por grupo con su nombre y subtotal, luego sus líneas con una descripción y un monto: sin tarifas, sin fórmulas, sin medición.",
            "Un grupo con una sola línea que solo repite el nombre y el total del grupo — un costo de subcontratación agrupado, por ejemplo — muestra solo el encabezado en vez de decir lo mismo dos veces.",
            "El texto del oficio de **Lo que dice el presupuesto** — en qué consiste el servicio, qué incluye, cómo se desarrolla el trabajo — bajo el grupo, en el idioma del presupuesto.",
          ] },
        ],
      },
    ],
    faq: [
      { q: "¿Puedo renombrar un grupo?", a: "No escribiendo. Un grupo se llama como su servicio o como la sección que eligió en la tarjeta. Use las áreas dentro de la medición de pintura para los nombres de habitaciones, o la descripción de una línea para una etiqueta que el cliente deba leer." },
      { q: "¿Puedo reordenar los grupos?", a: "No. Los grupos aparecen en el orden en que los añadió, en su pantalla y en la copia del cliente." },
      { q: "¿Por qué la copia del cliente muestra menos líneas que el generador?", a: "Solo se dibujan las líneas con precio e incluidas. Las áreas y superficies opcionales se ofrecen aparte al pie del presupuesto, y una línea única que solo repite el encabezado de su grupo se funde con el encabezado." },
    ],
  },

  "photos-on-a-quote": {
    title: "Fotos en un presupuesto",
    summary:
      "De dónde vienen las fotos, videos y planos PDF de un presupuesto, cómo añadir los suyos desde la visita al sitio, los límites, y dónde aparecen y dónde no.",
    updated: "2026-09-12",
    intro: [
      "Un presupuesto lleva un conjunto de archivos — **Fotos y videos del cliente** — que viene de dos direcciones: lo que el propietario adjuntó a su consulta y lo que usted añade desde la visita al sitio. Se quedan en el presupuesto, pasan a la factura y los lee la revisión de IA. Son para su lado del trabajo: la copia del presupuesto que ve el cliente no los imprime.",
    ],
    sections: [
      {
        id: "overview",
        heading: "Resumen",
        blocks: [
          { p: "La tarjeta del generador se titula **Fotos y videos del cliente**, con **Agregar fotos o un video** y la indicación **Imágenes de la visita al sitio. Se quedan en el presupuesto y pasan a la factura.** El mismo conjunto se muestra en la página del presupuesto en la oficina, y en la factura creada a partir del presupuesto." },
        ],
      },
      {
        id: "where-photos-come-from",
        heading: "De dónde vienen las fotos",
        blocks: [
          { bullets: [
            "**La consulta.** Las fotos, el video corto o el plano PDF que el propietario adjuntó en su formulario de presupuesto, el diseñador de cocinas, un embudo o una estimación instantánea están en el prospecto, y **Convertir en presupuesto** los traslada al presupuesto.",
            "**Un borrador de llamada.** Un presupuesto redactado a partir de una llamada a la recepcionista no tiene archivos hasta que usted añade alguno.",
            "**La visita al sitio.** Usted los añade en el generador, en un presupuesto nuevo o en uno guardado.",
            "**La factura.** Una factura creada a partir del presupuesto hereda el conjunto; una factura escrita desde cero tiene su propio cargador.",
          ] },
        ],
      },
      {
        id: "add-photos-yourself",
        heading: "Cómo añadir fotos",
        blocks: [
          { steps: [
            "Abra el presupuesto en el generador: **Nueva cotización**, o **Editar** en un presupuesto guardado.",
            "Baje hasta **Fotos y videos del cliente** y pulse **Agregar fotos o un video**.",
            "Elija fotos, un video o un PDF desde su teléfono o computadora. Cada archivo se carga de inmediato y aparece como miniatura; la cruz de una miniatura la quita.",
            "Guarde el presupuesto. Los archivos se almacenan con él.",
          ] },
          { figure: "live:app-quotes-new", caption: "Nueva cotización — la tarjeta Fotos y videos del cliente, con Agregar fotos o un video, está entre Notas y la barra de totales." },
          { note: "Las cargas van directo de su navegador al almacenamiento seguro; el presupuesto guarda un enlace a cada archivo, no el archivo en sí. Una foto tomada con un iPhone en su formato nativo se acepta tal cual." },
        ],
      },
      {
        id: "limits",
        heading: "Límites",
        blocks: [
          { table: {
            head: ["Tipo", "Archivo más grande", "Cuántos"],
            rows: [
              ["Foto (cualquier formato de imagen salvo SVG)", "15 MB", "Hasta 12 elementos en el cargador del generador; el presupuesto guarda hasta 20"],
              ["Video", "100 MB", "Contado en los mismos 12"],
              ["Plano PDF", "25 MB", "Contado en los mismos 12"],
            ],
          } },
        ],
      },
      {
        id: "where-they-show-up",
        heading: "Dónde aparecen",
        blocks: [
          { p: "Los archivos de un presupuesto se leen de su lado, no del cliente:" },
          { bullets: [
            "La página del presupuesto en la oficina y el generador, como miniaturas que se abren a tamaño completo.",
            "La factura creada a partir del presupuesto, bajo el mismo título.",
            "La revisión de IA lee las fotos junto con el presupuesto y puede decirle qué muestran que las líneas pasaron por alto; la **lectura profunda de fotos**, de pago, va más lejos. Vea [[ai-quote-review|La revisión de presupuestos por IA]] y [[the-ai-deep-photo-read|La lectura profunda de fotos por IA]].",
            "Las comprobaciones de completitud de la revisión señalan «No photos» en un presupuesto sin imagen del trabajo: opcional, pero lo distingue de quien cotizó por teléfono.",
          ] },
          { warning: "La página de aprobación del cliente, el correo del presupuesto y el PDF no imprimen estas fotos. Las fotos de antes y después que un cliente debe ver son otra función; vea [[references-and-photos-in-the-quote-email|Referencias y fotos de antes y después en el correo del presupuesto]]." },
        ],
      },
    ],
    faq: [
      { q: "¿El cliente ve las fotos que añado?", a: "No. Se quedan en el presupuesto para su equipo, la factura y la revisión de IA. La página, el correo y el PDF del cliente no las incluyen." },
      { q: "¿Puedo añadir fotos a un presupuesto enviado?", a: "Sí: ábralo con Editar, añádalas bajo Fotos y videos del cliente y guarde. Añadir archivos no cambia el precio ni reenvía el presupuesto." },
      { q: "¿Adónde van las fotos de obra que toma la cuadrilla?", a: "Al trabajo, no al presupuesto; vea [[job-photos-and-tags|Fotos de trabajo y etiquetas]]. El conjunto del presupuesto trata de la estimación; el del trabajo, de la obra." },
    ],
  },
};
