// content/help/es/invoices-and-payments-1.js
//
// Parte 1 de la categoría «invoices-and-payments» en español (ver el
// compositor, invoices-and-payments.js): la lista de facturas, crear una
// factura, por qué se parece al presupuesto, enviarla, modificarla,
// registrar un pago a mano, cómo paga un cliente en línea, y la conexión
// con Stripe.
//
// Misma estructura que el módulo en inglés (mismos slugs, mismas secciones,
// mismos bloques, mismas figuras). Las palabras en pantalla vienen del
// bloque `es` de app/i18n/appMessages.js.
export const ARTICLES = {
  "the-invoices-list": {
    title: "La lista de facturas",
    summary:
      "Todas las facturas que emitió su empresa, lo que aún se debe, lo que está vencido, y cómo encontrar una rápido.",
    updated: "2026-09-12",
    intro: [
      "**Facturas** es la pantalla del dinero: tres tarjetas que dicen cómo va, y luego cada factura con su estado, su cliente, su vencimiento y lo que todavía se debe. Es la página que se abre cuando alguien pregunta «¿ya pagaron?».",
    ],
    sections: [
      {
        id: "overview",
        heading: "Resumen",
        blocks: [
          { p: "Abra **Facturas** en la barra lateral, bajo **Trabajo**. El encabezado dice **Facturas — Controla pagos y facturación.** y el botón **Nueva factura** está arriba a la derecha. Las tarjetas suman las mismas cifras por factura que muestran las filas: una factura pagada a medias cuenta su saldo restante en **Pendiente**, no su valor nominal." },
        ],
      },
      {
        id: "what-is-on-the-screen",
        heading: "Qué hay en la pantalla",
        blocks: [
          { bullets: [
            "**Pendiente** — el total que aún se debe en todas las facturas. Cuando parte está vencida, una línea roja agrega **«… de eso está vencido.»**",
            "**Pagada** — todo lo recibido, incluidos los pagos parciales en facturas todavía no saldadas.",
            "**Total facturado** — el valor nominal de todas las facturas, pagadas o no.",
            "**Buscar facturas...** — filtra la lista por número de factura o nombre del cliente a medida que escribe.",
            "Una fila por factura: el número (INV-2026-0008), una etiqueta de estado, el cliente, **Vence el …** con la fecha, y a la derecha el saldo pendiente — o **Pagada por completo** en verde con el total de la factura debajo.",
          ] },
          { figure: "harness:invoices", caption: "Facturas — las tres tarjetas, el cuadro de búsqueda, y filas para una factura enviada, una pagada y una con 12 días de retraso." },
          { p: "El retraso se mide desde el vencimiento cada vez que se carga la lista: una factura que vencía ayer dice **1 días de retraso** en rojo esta mañana sin que nadie la toque. Un borrador nunca está atrasado — nunca se le cobró a nadie — y una factura sin vencimiento tampoco; simplemente no tiene vencimiento." },
        ],
      },
      {
        id: "statuses",
        heading: "Las etiquetas de estado",
        blocks: [
          { table: {
            head: ["Etiqueta", "Qué significa"],
            rows: [
              ["**Borrador**", "Guardada, nunca enviada por correo. El cliente no la vio. Solo los borradores se pueden eliminar."],
              ["**Enviada**", "Enviada al cliente al menos una vez, con un saldo todavía pendiente. Sigue **Enviada** durante los pagos parciales."],
              ["**Pagada**", "Nada pendiente y al menos un pago recibido — en línea o registrado a mano."],
              ["**Atrasada**", "Pasó su vencimiento con un saldo pendiente. La línea roja **días de retraso** bajo el nombre del cliente se mide desde el vencimiento en cada carga, diga lo que diga la etiqueta."],
              ["**Reembolsada** / **Reembolso parcial**", "El dinero volvió al cliente por Stripe. Ámbar, no rojo — lo hizo usted, no hay nada que reclamar."],
              ["**En disputa**", "El banco de un cliente abrió un contracargo. Rojo, porque la ventana para enviar pruebas se está cerrando — ver [[disputes-and-chargebacks|Disputas y contracargos]]."],
            ],
          } },
        ],
      },
      {
        id: "find-an-invoice",
        heading: "Cómo encontrar una factura",
        blocks: [
          { steps: [
            "Escriba parte del número o del nombre del cliente en **Buscar facturas...**. La lista se acorta mientras escribe; **Ninguna factura coincide con tu búsqueda.** significa que nada coincidió.",
            "Toque la fila. La factura se abre con sus avisos (sin enviar, atrasada, pagada en parte), el documento tal como lo ve el cliente, el **Historial de pagos** y el trabajo que hay detrás.",
            "Para ver solo las facturas de un cliente, abra mejor su ficha — lista sus presupuestos, sus trabajos y sus facturas juntos.",
          ] },
          { tip: "La lista muestra la versión actual de una factura modificada, con un saldo recalculado a partir de todos los pagos de todas sus versiones. Nunca tiene que sumar la v1 y la v2 usted mismo." },
        ],
      },
      {
        id: "who-can-see-it",
        heading: "Quién puede verla",
        blocks: [
          { p: "Cualquier persona cuyo nivel de acceso incluya facturas en **View only** o superior: los perfiles **Estimator**, **Dispatcher** y **Manager**, los administradores y el propietario. El perfil **Crew** no tiene acceso a facturas y recibe un panel de «sin acceso» en vez de una lista vacía — una lista vacía diría «no tiene ninguna», que es otra afirmación, y falsa." },
          { p: "Una persona cuyo acceso tiene el interruptor **See prices** (ver precios) apagado sigue viendo las filas, pero cada cifra de dinero en esta pantalla es un guion. FieldQuo no imprime «$0.00 pendiente» sobre un libro que le dijeron que no valorara." },
        ],
      },
    ],
    faq: [
      { q: "¿Por qué una fila muestra menos que el total de la factura?", a: "La cifra de la derecha es lo que aún se debe, con **Pagado …** debajo cuando se recibió una parte. La tarjeta Pendiente suma exactamente esas cifras, así que la columna y la tarjeta siempre coinciden." },
      { q: "¿Por qué no hay línea roja en una factura que sé que está atrasada?", a: "No tiene vencimiento, o sigue siendo un borrador. Fije un vencimiento al crear o editar la factura; un borrador no está atrasado porque nunca se envió." },
      { q: "¿Puedo exportar esta lista?", a: "No desde esta pantalla. La exportación contable bajo **Gastos** produce archivos CSV para un rango de fechas — ver [[the-accounting-export|La exportación contable]]." },
    ],
  },

  "create-an-invoice": {
    title: "Crear una factura",
    summary:
      "Tres formas en que nace una factura — automáticamente cuando se aprueba un presupuesto, a mano desde un presupuesto aprobado, o suelta desde Nueva factura — y qué pide la pantalla Nueva factura.",
    updated: "2026-09-12",
    intro: [
      "La mayoría de las facturas en FieldQuo nunca se escriben. Cuando un cliente aprueba un presupuesto, la factura se construye a partir de ese presupuesto en el mismo momento, con las mismas líneas, la misma decisión de impuesto y el mismo número. **Nueva factura** existe para el resto: el servicio que nadie presupuestó, la visita extra, el caso único.",
    ],
    sections: [
      {
        id: "overview",
        heading: "Resumen",
        blocks: [
          { p: "Hay una factura por trabajo. Un presupuesto aprobado produce exactamente una factura, y una segunda aprobación (o una segunda pulsación del botón) devuelve la que ya existe en lugar de crear un duplicado que el cliente disputaría. Los pagos por etapas — un depósito, un saldo a la instalación — se solicitan en partes contra esa única factura, nunca como varias; ver [[deposits-and-payment-schedules|Depósitos y calendarios de pago]]." },
          { p: "El número sigue al presupuesto: **Q-2026-0008** se factura como **INV-2026-0008**, así que el par se lee de un vistazo. Una factura emitida sola no tiene número que tomar prestado y toma el siguiente de la secuencia." },
        ],
      },
      {
        id: "from-an-approved-quote",
        heading: "Desde un presupuesto aprobado",
        blocks: [
          { steps: [
            "Cuando el cliente aprueba en línea, nada que hacer: el trabajo, la factura en borrador y la tarea de seguimiento se crean por usted. Abra **Cotizaciones**, luego el presupuesto — una línea azul dice **Ya convertida en factura** con el número de factura como enlace.",
            "Si el cliente dijo que sí por teléfono, abra el presupuesto, toque **Obtener aprobación** y luego **La aprobaron**. Se ponen en marcha las mismas cosas, factura incluida, y el registro de actividad anota «invoice INV-… drafted».",
            "Un presupuesto aceptado que por alguna razón no tiene factura — aceptado antes de que esto existiera, o un tropiezo ese día — muestra **Convertir en factura** en la página del presupuesto. Construye la misma factura; tocarlo dos veces devuelve la que existe.",
            "La nueva factura queda como **Borrador**. Ábrala, revísela y envíela — ver [[send-an-invoice|Enviar una factura]].",
          ] },
          { note: "La factura copia las líneas del presupuesto (agrupadas por habitación o alcance, con los extras que el cliente marcó), su subtotal, descuento, impuesto, total, fotos e idioma en el momento de la aprobación. Editar el presupuesto después no cambia la factura — un documento firmado debe seguir diciendo lo que decía." },
        ],
      },
      {
        id: "a-standalone-invoice",
        heading: "Una factura independiente",
        blocks: [
          { steps: [
            "Toque **Nueva factura** en la lista de facturas, o **Crear → Factura** en la barra lateral. El encabezado dice **Nueva factura — Crea una factura independiente.**",
            "Bajo **Cliente**, escriba en **Buscar clientes...** y elija uno.",
            "Bajo **Artículos**, complete **Descripción**, **Cant.** y **Tarifa**; el **Importe** se calcula. **Agregar línea** añade una fila, la × la quita.",
            "Fije una **Fecha de vencimiento**. Sin ella, la factura nunca podrá aparecer atrasada y ninguna regla de recordatorio podrá dispararse.",
            "Agregue **Notas** y, si sirve, **Fotos y videos del cliente** — se traen automáticamente cuando hay un presupuesto.",
            "Revise la casilla **Aplicar impuesto** y la **Tasa de impuesto**, y luego toque **Guardar como borrador** o **Guardar y enviar**.",
          ] },
          { figure: "live:app-invoices-new", caption: "Nueva factura — Cliente, Artículos, el panel interno Costo y margen, Fecha de vencimiento, Notas, fotos y el bloque de impuesto, con Guardar como borrador y Guardar y enviar fijos abajo." },
        ],
      },
      {
        id: "what-each-control-changes",
        heading: "Qué cambia cada control",
        blocks: [
          { bullets: [
            "**Aplicar impuesto** marcado o no se guarda como una decisión. Desmarcado escribe «sin impuesto» en el documento; marcado con una tasa lo cobra. Marcado sin nada calculado imprime **Sin calcular** en ámbar, y el envío se rechaza hasta que corrija la dirección del cliente o diga que de verdad no hay impuesto.",
            "La **Tasa de impuesto** se precarga desde la provincia o el estado del cliente. Cuando la ficha del cliente no puede responder, la página asume su propia provincia y lo dice en ámbar — elija un cliente con dirección registrada y se aplica la tasa real. Escribir en la casilla reemplaza la suposición.",
            "**Costo y margen (interno — nunca se le muestra al cliente)** — horas de la cuadrilla, materiales y gastos generales contra esta factura. Solo aparece para personas con el interruptor **Job costing**, y nada de lo que contiene llega al documento. Ver [[job-costing|Costeo de trabajos]].",
            "**Guardar como borrador** crea la factura y se detiene. **Guardar y enviar** la crea y luego la envía por correo; si el correo falla (sin dirección registrada, sin plan todavía), la factura queda guardada como borrador y la página le dice por qué.",
          ] },
        ],
      },
      {
        id: "who-can-do-it",
        heading: "Quién puede hacerlo",
        blocks: [
          { p: "Crear una factura requiere facturas en **View, create, and edit** y el interruptor **See prices**: los perfiles **Dispatcher** y **Manager**, los administradores y el propietario. **Convertir en factura** requiere además el mismo nivel en presupuestos. Un **Estimator** ve las facturas pero no puede emitir una; **Crew** nunca las ve." },
        ],
      },
    ],
    faq: [
      { q: "El presupuesto está aprobado pero no hay factura. ¿Por qué?", a: "Abra el presupuesto y busque **Convertir en factura** — solo aparece en un presupuesto aceptado sin factura, y la construye en el acto. Un trabajo pasado ingresado por la importación es la única excepción: llega ya facturado y pagado, y no se envía nada al respecto." },
      { q: "¿Puedo facturar un trabajo en dos mitades?", a: "No como dos facturas — FieldQuo emite una por trabajo. Configure un calendario de pagos en **Configuración de la empresa** y el depósito y el saldo se solicitan por etapas contra esa única factura." },
      { q: "¿De dónde sale el número de factura?", a: "Del presupuesto que factura, cuando lo hay: Q-2026-0008 se convierte en INV-2026-0008. Una factura independiente toma el siguiente número libre de la secuencia del año. Una factura revisada conserva su número y gana una versión." },
    ],
  },

  "invoices-mirror-quotes": {
    title: "Las facturas reflejan los presupuestos",
    summary:
      "Por qué la factura que recibe un cliente se parece al presupuesto que aprobó — mismas secciones, misma marca, misma redacción — y qué deja fuera una factura a propósito.",
    updated: "2026-09-12",
    intro: [
      "Un propietario que aprobó un presupuesto debería reconocer la factura como su gemela. En FieldQuo eso no es una decisión de estilo tomada dos veces; el presupuesto y la factura se generan desde las mismas secciones compartidas, con los mismos cálculos de color y la misma redacción del oficio, así que los dos no pueden separarse.",
    ],
    sections: [
      {
        id: "overview",
        heading: "Resumen",
        blocks: [
          { p: "Cada documento que ve el cliente — el PDF del presupuesto, el PDF de la factura, los correos de acompañamiento y las copias del portal — se arma desde una sola biblioteca de secciones: encabezado, datos del cliente, artículos agrupados por alcance, totales, resumen de pagos, condiciones de pago, cómo se realiza el trabajo, notas, bloque de firma y pie de página. Cada sección sabe dibujarse como PDF y como correo, así que el bloque de totales de una factura es el del presupuesto con otra cifra dentro." },
          { p: "Los colores vienen de su único color de marca, medido para el contraste en vez de adivinado — ver [[set-up-your-branding|Configurar su marca]]. El dinero viene de la factura misma; el contenido del oficio — qué incluye, qué podría cambiar el precio, el proceso — viene del presupuesto del que se construyó." },
        ],
      },
      {
        id: "what-carries-over",
        heading: "Qué se trae del presupuesto",
        blocks: [
          { bullets: [
            "**El alcance, por oficio** — una tarjeta por servicio, etiquetada como la agrupó el presupuesto («Cocina: instalación de gabinetes»), con los extras que marcó el cliente como líneas propias.",
            "**Lo que dice esta factura** — las frases de «qué incluye» y «qué podría cambiar el precio» que el cliente ya leyó en el presupuesto, resueltas desde el mismo contenido del oficio.",
            "**Cómo se realiza el trabajo** — los pasos del proceso con sus plazos, y las notas del proceso, marcadas como escritas en el presupuesto o como valor predeterminado de su empresa.",
            "**Condiciones de pago** — las condiciones de su empresa en **Configuración de la empresa**, mostradas como hitos cuando se leen como un calendario y textuales cuando no.",
            "Las **fotos**, el **idioma** del cliente y la decisión de impuesto — una factura de un presupuesto emitido sin impuesto es una factura sin impuesto.",
          ] },
          { note: "El dinero se copia, no se vincula. Editar el presupuesto después de la aprobación no cambia nada en la factura, y editar la factura no cambia nada en el presupuesto. Cada documento sigue diciendo lo que decía cuando el cliente lo leyó." },
        ],
      },
      {
        id: "what-an-invoice-leaves-out",
        heading: "Qué deja fuera una factura a propósito",
        blocks: [
          { p: "El PDF de factura predeterminado es encabezado, datos del cliente, artículos, totales, **Historial de pagos**, notas y pie de página. Tres secciones que lleva un presupuesto se quitan a propósito: sin pasos del proceso (el trabajo está hecho), sin bloque de firma (no queda nada que aceptar) y sin calendario de pagos (el calendario ya ocurrió — lo que se debe ahora es el saldo)." },
          { p: "En su lugar, la factura encabeza con el **saldo**, no con el total. En una factura con el depósito ya pagado, el correo y el portal destacan lo que aún se debe y listan los pagos recibidos debajo, porque un total que el cliente ya saldó en parte se lee como un cobro doble." },
        ],
      },
      {
        id: "on-the-invoice-page",
        heading: "Qué ve usted en la página de la factura",
        blocks: [
          { p: "Abra cualquier factura y el artículo enmarcado en el centro es el documento del cliente, en su color: membrete, **Factura** y su número (con **v2** una vez modificada), **Preparado para**, la fecha, el vencimiento, **Del presupuesto** con un enlace, las tarjetas de alcance, **Lo que dice esta factura**, **Cómo se realiza el trabajo**, **Términos explicados**, notas, fotos, la banda de totales y **Condiciones de pago**. Todo lo que está fuera del marco — los avisos, los botones, el trabajo, el panel de costos — es suyo y nunca llega al cliente." },
          { tip: "**Configuración → Plantillas PDF** tiene dos tarjetas, **PDF de cotización** y **PDF de factura**, cada una con sus diseños y las secciones que llevan. Reordenar o quitar una sección ahí cambia lo que recibe el cliente; el espejo en pantalla sigue los mismos datos. Ver [[the-quote-pdf|El PDF del presupuesto]]." },
        ],
      },
    ],
    faq: [
      { q: "El cliente dice que la factura no coincide con el presupuesto. ¿Dónde miro?", a: "Abra la factura y compare las tarjetas de alcance con las del presupuesto. La factura lleva el total aceptado — la cifra de la página donde el cliente tocó Aprobar, extras incluidos — así que una diferencia casi siempre es un extra que marcó o un cambio hecho en el presupuesto después de la aprobación." },
      { q: "¿Puede la factura mostrar una línea de firma?", a: "No. El **Signature block** es una sección solo para presupuestos — el editor de plantillas no la ofrece en un diseño de PDF de factura, porque la aprobación ya ocurrió y no queda nada que firmar." },
    ],
  },

  "send-an-invoice": {
    title: "Enviar una factura",
    summary:
      "Qué pasa cuando toca Enviar: el correo que recibe el cliente, el enlace que lleva dentro, la tarea de seguimiento, y por qué un envío puede rechazarse.",
    updated: "2026-09-12",
    intro: [
      "**Enviar** manda la factura por correo a la dirección del cliente registrada, a nombre de su empresa, en el idioma del cliente, con un botón que abre la factura en su portal y — una vez conectado Stripe — le permite pagar. El estado solo pasa a **Enviada** después de que el servicio de correo acepta el mensaje, así que **Enviada por correo** en la factura es un hecho, no una intención.",
    ],
    sections: [
      {
        id: "overview",
        heading: "Resumen",
        blocks: [
          { p: "No se adjunta nada. El correo enlaza a la página de la factura en el portal del cliente, que muestra lo que se debe y lo que se pagó, y genera un pago nuevo en el momento en que el cliente toca **Pagar** — un enlace de Stripe en bruto vencería de un día para otro y un PDF adjunto no puede cobrar. El botón **Descargar PDF** en la factura está ahí para cuando un cliente pide un archivo." },
        ],
      },
      {
        id: "how-to-send",
        heading: "Cómo enviarla",
        blocks: [
          { steps: [
            "Abra la factura. En un borrador, el aviso dice **Esta factura todavía no se le ha enviado al cliente.** con **Enviarla** al lado; el botón **Enviar** también está en la barra de comandos.",
            "Tóquelo. Una línea verde confirma **Factura enviada por correo a** la dirección, y la tarjeta de seguimiento debajo muestra **Enviada por correo → dirección** con la fecha.",
            "Se crea para usted una tarea **Follow up payment for INV-…** a una semana, para que una factura enviada no pueda olvidarse. Se cierra sola cuando se salda el saldo.",
            "Más adelante, mientras quede algo pendiente, el mismo botón dice **Enviar de nuevo** — reenviar una copia que un cliente extravió es rutina y no devuelve una factura pagada o atrasada a Enviada.",
          ] },
          { figure: "live:app-invoices-new", caption: "Nueva factura — Guardar y enviar, abajo, crea la factura y la envía de una vez; la ayuda dice «Envía la factura al correo electrónico registrado del cliente.»" },
        ],
      },
      {
        id: "the-email",
        heading: "El correo que recibe el cliente",
        blocks: [
          { bullets: [
            "**Asunto:** «Factura INV-2026-0008 de Su Empresa — $2,260.00 por pagar». La cifra es el saldo, no el total: después de un depósito, la introducción lo dice y le agradece.",
            "**De:** el nombre de su empresa. Desde su propio dominio una vez verificado bajo **Configuración → Dominio de correo**; si no, desde el remitente de FieldQuo con su nombre encima. Las respuestas van al correo de su empresa.",
            "**Monto a pagar** y **Vence el …** — o **Venció el …** en rojo una vez pasada la fecha.",
            "**Pagar en línea** cuando Stripe está conectado y habilitado; si no, **Ver su factura** y la línea «Por favor comuníquese con nosotros para coordinar el pago.» — un botón Pagar que lleva a un callejón sin salida es peor que ninguno.",
            "El idioma es el de la factura, fijado al crearla; un cliente que recibió un presupuesto en español recibe una factura en español.",
          ] },
        ],
      },
      {
        id: "when-a-send-is-refused",
        heading: "Cuándo se rechaza un envío",
        blocks: [
          { bullets: [
            "**Sin correo registrado** — el aviso dice **… no tiene correo electrónico registrado, así que esta factura no se puede enviar ni reclamar.** Agregue uno en la ficha del cliente e intente de nuevo.",
            "**Aquí dice que hay impuesto, pero no cobra ninguno** — la factura declara impuesto y cobra $0. El diálogo ofrece **Definir la ubicación de …** para calcular la tasa, u **O bien: en este caso de verdad no hay impuesto** para enviar sin impuesto.",
            "**Sin plan todavía** — enviar es el acto hacia afuera que requiere una prueba o un plan activo. Redactar nunca lo requiere; ver [[your-plan-and-seats|Su plan y sus asientos]].",
            "**Un trabajo pasado** ingresado por la importación — se pagó antes de escribirlo, y FieldQuo no envía nada al respecto.",
          ] },
          { note: "**Solicitar pago** es el otro correo. Sale desde la misma dirección con el mismo enlace, planteado como recordatorio («Un recordatorio: la factura … tiene un saldo de …»), con espacio para una nota suya. Ver [[invoice-reminders-and-chasing|Recordatorios de factura y reclamos]]." },
        ],
      },
      {
        id: "who-can-send",
        heading: "Quién puede enviar",
        blocks: [
          { p: "Facturas en **View, create, and edit** — los perfiles **Dispatcher** y **Manager**, los administradores y el propietario. Cada envío se escribe en el **Registro de actividad** como «Sent invoice INV-… to …»." },
        ],
      },
    ],
    faq: [
      { q: "El cliente dice que nunca la recibió.", a: "Abra la factura: la tarjeta de seguimiento muestra **Enviada por correo → dirección** y la fecha solo si el servicio de correo la aceptó. Revise la dirección en la ficha del cliente y luego **Enviar de nuevo**. Si su propio dominio está configurado pero sin verificar, los envíos fallan con un mensaje que lo dice." },
      { q: "¿El cliente necesita una cuenta?", a: "No. El enlace del correo es su portal, ligado a un token privado — sin contraseña, sin registro, funciona en un teléfono." },
      { q: "¿Puedo enviarla por mensaje de texto?", a: "Hoy no. FieldQuo envía las facturas por correo; los textos que manda a los clientes son el recordatorio de cita y «En camino»." },
    ],
  },

  "edit-an-invoice-after-sending": {
    title: "Editar una factura después de enviarla",
    summary:
      "Un borrador se edita en el lugar; una factura enviada se convierte en una nueva versión con un motivo, y la anterior se conserva — nadie tiene que adivinar qué se acordó.",
    updated: "2026-09-12",
    intro: [
      "Una vez que una factura salió de la oficina, cambiarla en silencio reescribiría lo que un cliente ya leyó. FieldQuo conserva la enviada y escribe sus cambios como **versión 2**, con el motivo que usted escribió guardado al lado. El cliente ve la versión que usted le envía; usted ve ambas, y el dinero ya pagado sigue a la factura, no a la instantánea.",
    ],
    sections: [
      {
        id: "overview",
        heading: "Resumen",
        blocks: [
          { p: "**Editar** aparece en una factura en **Borrador** o **Enviada**. Un borrador se edita en el lugar — nada se envió, no hay nada que preservar. Una factura enviada abre el mismo editor con una advertencia amarilla: **Esta factura ya se envió, así que guardar crea versión 2 en lugar de sobrescribirla. La versión actual se conserva.**" },
          { p: "Las facturas pagadas, reembolsadas y en disputa no tienen botón Editar. Lo que se pagó se pagó contra un documento; el registro de ese documento queda como estaba." },
        ],
      },
      {
        id: "how-to-amend",
        heading: "Cómo modificar una factura enviada",
        blocks: [
          { steps: [
            "Abra la factura y toque **Editar**. El encabezado dice **Editar INV-2026-0008**, con **· versión 2** si ya fue modificada antes.",
            "Cambie los **Artículos**, el **Descuento**, **Aplicar impuesto** y su **Tasa de impuesto (%)**, la **Fecha de vencimiento**, las notas o las fotos. Los totales se recalculan sobre la marcha.",
            "Complete **Motivo de este cambio** — por ejemplo «El cliente agregó un segundo baño». Es obligatorio en una factura enviada y se guarda con la versión, para que quien lea el historial después sepa qué pasó.",
            "Toque **Guardar como nueva versión**. Cae en la nueva factura, mismo número, **v2** al lado.",
            "Envíe la nueva versión — el cliente tiene la anterior hasta que lo haga.",
          ] },
          { note: "Si ya se recibió dinero, el editor lo dice: **$… ya se ha pagado en esta factura. Reducir el total por debajo de eso deja un crédito que deberás resolver con el cliente.** FieldQuo no reembolsa automáticamente." },
        ],
      },
      {
        id: "what-the-new-version-carries",
        heading: "Qué lleva la nueva versión",
        blocks: [
          { bullets: [
            "El mismo **número de factura**, el mismo cliente, el mismo enlace al presupuesto y el mismo idioma.",
            "Cada **pago** de la familia. El saldo de la v2 se recalcula a partir de todos los pagos contra el total de la v2, así que un depósito de $200 tomado en la v1 sigue siendo $200 pagados en la v2 — y el portal del cliente ofrece solo la versión actual.",
            "Las **fotos** y el panel **Costo y margen**, trasladados en lugar de descartados.",
            "El **registro de cambios**: quién, cuándo y el motivo.",
          ] },
          { p: "La versión anterior recibe un solo aviso y nada más: **Esta es la versión 1. La versión 2 la reemplazó — esa es la que tiene tu cliente.** con **Abrir la versión actual**. Cada acción — enviar, reclamar, registrar un pago — está oculta ahí, porque esas acciones pertenecen a la factura que la reemplazó." },
        ],
      },
      {
        id: "who-can-edit",
        heading: "Quién puede editar",
        blocks: [
          { p: "Editar requiere facturas en **View, create, and edit** y el interruptor **See prices** — **Dispatcher**, **Manager**, los administradores y el propietario. Eliminar es otra cosa: solo un **Borrador** se puede eliminar, y solo por alguien con **View, create, edit, and delete** (el perfil **Manager**, los administradores, el propietario). El ícono de papelera está oculto para todos los demás en lugar de atenuado." },
        ],
      },
    ],
    faq: [
      { q: "¿Puedo corregir una errata sin crear una versión?", a: "En un borrador, sí — Guardar cambios edita en el lugar. En una factura enviada, no: hasta un cambio de una palabra es la versión 2 con un motivo. Esa es la idea; el motivo puede ser «Corregí la ortografía de la calle»." },
      { q: "¿Qué versión muestra la lista?", a: "La actual, con un saldo calculado sobre todos los pagos de la familia. Al abrirla, **v2** aparece en el encabezado del documento." },
      { q: "¿Puedo eliminar una factura enviada por error?", a: "No — solo los borradores se pueden eliminar. Modifíquela a un total de cero con el motivo, o reembolse lo pagado; de cualquier forma, el registro de lo que se envió se queda." },
    ],
  },

  "record-a-manual-payment": {
    title: "Registrar un pago en efectivo, con cheque o por transferencia",
    summary:
      "Cómo anotar un pago que no pasó por Stripe, qué le hace a la factura, y por qué no lleva comisión.",
    updated: "2026-09-12",
    intro: [
      "No todos los clientes pagan con tarjeta. Cuando el dinero llegó por transferencia electrónica, cheque o efectivo, usted lo registra en la factura para que el saldo, las tarjetas, el panel y los recordatorios lo sepan. Un pago registrado es un pago real: la factura pasa a **Pagada** en cuanto el saldo llega a cero y la tarea de seguimiento se cierra sola.",
    ],
    sections: [
      {
        id: "overview",
        heading: "Resumen",
        blocks: [
          { p: "**Registrar pago** es el botón verde en cualquier factura con saldo pendiente. Registra contra la versión actual de la factura, compara el monto con lo que aún se debe, y rechaza un duplicado escrito dos veces seguidas. No envía nada al cliente ni a nadie de su equipo — usted está en la página haciéndolo, así que una notificación sería ruido." },
        ],
      },
      {
        id: "how-to-record",
        heading: "Cómo registrar un pago",
        blocks: [
          { steps: [
            "Abra la factura y toque **Registrar pago**.",
            "Escriba el monto. El texto guía muestra el tope: **Monto (hasta $2,260.00)**. Una cifra por encima del saldo se rechaza, en inglés: «That's more than the … still owing on this invoice.»",
            "Elija el método: **Efectivo**, **Transferencia electrónica** o **Cheque**.",
            "Agregue **Notas (opcional)** — el número del cheque, la referencia de la transferencia.",
            "Toque **Registrar**. Los totales se actualizan, el aviso dice **Pagada por completo — se recibieron $2,260.00.** si eso la saldó, y la fila aparece bajo **Historial de pagos** con la fecha de hoy y el método.",
          ] },
          { note: "Un pago parcial está bien. La factura sigue **Enviada**, el aviso dice **Se recibieron $500.00 de $2,260.00. Siguen debiéndose $1,760.00.** con **Reclamar el pago** al lado, y la lista muestra el saldo con **Pagado $500.00** debajo." },
        ],
      },
      {
        id: "what-it-changes",
        heading: "Qué cambia",
        blocks: [
          { bullets: [
            "**El saldo** — recalculado a partir de cada pago de la familia de facturas, neto de cualquier reembolso o disputa ya registrados.",
            "**El estado** — **Pagada** cuando no se debe nada y se recibió algo; la fecha de pago se estampa entonces.",
            "**La tarea de seguimiento** — «Follow up payment for INV-…» se resuelve una vez saldado el saldo.",
            "**El registro de actividad** — «Recorded a cash payment of 500 on invoice INV-…».",
            "**Sin comisión** — un pago manual no muestra comisión de procesamiento ni neto depositado; la exportación deja esas celdas vacías en lugar de escribir 0.00. Ver [[payment-processing-fees-and-payouts|Comisiones de procesamiento de pagos y transferencias]].",
          ] },
          { warning: "No hay deshacer para un pago registrado desde esta pantalla. Escriba el monto desde el estado de cuenta bancario, no de memoria, y use el campo de notas para la referencia." },
        ],
      },
      {
        id: "who-can-record",
        heading: "Quién puede registrar un pago",
        blocks: [
          { p: "Registrar un pago requiere el interruptor **Collect payments** (cobrar pagos), no solo el nivel en facturas. En los perfiles, eso es el **Manager**, los administradores y el propietario. Un **Dispatcher** puede emitir y enviar facturas, pero el servidor rechaza su pago con un mensaje de «collect payments» — el botón está en la página, la API es el control." },
        ],
      },
    ],
    faq: [
      { q: "El cliente pagó una tarifa de visita al reservar. ¿Puedo acreditarla?", a: "Sí. Cuando se pagó una tarifa de reserva, la factura muestra una tarjeta **Crédito por tarifa de visita** con **Acreditar a la factura**; aparece en el historial de pagos como crédito por tarifa de visita y reduce el saldo. Ver [[booking-fees-and-visit-deposits|Tarifas de reserva y depósitos de visita]]." },
      { q: "¿Puedo registrar un pago con tarjeta que cobré en mi propia terminal?", a: "No desde este diálogo — ofrece efectivo, transferencia electrónica y cheque. Los pagos con tarjeta a través de FieldQuo pasan por Stripe y se registran solos; una tarjeta cobrada en otro lado es un método que usa la importación de trabajos pasados, no esta pantalla." },
      { q: "¿El cliente recibe un recibo?", a: "No por un pago manual. Si quiere uno, **Enviar de nuevo** manda la factura por correo con el pago listado y el saldo en cero." },
    ],
  },

  "how-clients-pay-online": {
    title: "Cómo pagan los clientes en línea",
    summary:
      "El camino desde el botón Pagar en el correo hasta el dinero en su banco: el portal, Stripe Checkout, con qué puede pagar el cliente, y qué registra FieldQuo cuando llega el pago.",
    updated: "2026-09-12",
    intro: [
      "Una vez conectado y habilitado Stripe, cada correo de factura lleva **Pagar en línea**. El cliente llega a su portal, ve el saldo en el color de su marca, toca **Pagar $2,260.00** — **Pagar $2,260.00 con tarjeta** o **Pagar $2,260.00 desde una cuenta bancaria** cuando su cuenta de Stripe puede aceptar pagos bancarios — y paga en la página de pago alojada por Stripe. FieldQuo nunca ve la tarjeta, nunca retiene el dinero, y registra el pago en cuanto Stripe lo confirma.",
    ],
    sections: [
      {
        id: "overview",
        heading: "Resumen",
        blocks: [
          { p: "El cliente no necesita cuenta ni contraseña. El enlace del correo es su portal, ligado a un token privado, y la página de la factura ahí muestra el mismo documento que ve usted — alcance, totales, pagos recibidos, condiciones — con una sola cifra grande: **Saldo pendiente**, o la etiqueta de la etapa cuando un calendario de pagos pide una parte. Una factura saldada dice **Pagada por completo** y no ofrece botón." },
          { p: "El cobro se crea a nombre de su empresa, así que su nombre es el que aparece en el estado de cuenta de la tarjeta del cliente, y el dinero se liquida en su cuenta de Stripe y luego en su banco. Ver [[payment-processing-fees-and-payouts|Comisiones de procesamiento de pagos y transferencias]] para lo que se descuenta de cada pago." },
        ],
      },
      {
        id: "the-clients-steps",
        heading: "Qué hace el cliente",
        blocks: [
          { steps: [
            "Abre el correo de la factura y toca **Pagar en línea** (o, en el portal, abre la factura desde la lista).",
            "Revisa la cifra — el saldo, o la etapa solicitada (un depósito, una cuota) — y toca **Pagar … con tarjeta**, o **Pagar … desde una cuenta bancaria** cuando ese segundo botón está ahí.",
            "Paga en Stripe Checkout: tarjeta, más **Affirm** a plazos cuando usted lo activó y el monto está entre $50 y $30,000 en CAD o USD. Un pago bancario es un débito preautorizado de una sola vez (Canadá) o un débito ACH (EE. UU.) en la página de Stripe, que verifica la cuenta automáticamente cuando el banco lo permite.",
            "Vuelve al portal. Un pago con tarjeta aparece recibido de inmediato, con el nuevo saldo; un pago bancario dice **Pago bancario pendiente** durante 3 a 5 días hábiles y luego pagado — o **El pago bancario falló**, con el motivo que da Stripe, el saldo todavía pendiente y el botón de tarjeta todavía ofrecido.",
          ] },
          { note: "**Pagar desde una cuenta bancaria** aparece solo cuando Stripe ha activado el débito bancario en su cuenta — FieldQuo lo solicita por usted al conectar, y **Configuración → Pagos** dice en qué punto está (**Los clientes pueden pagar las facturas con tarjeta o desde una cuenta bancaria**). Las tarifas de reserva siguen siendo solo con tarjeta. Los planes de servicio conservan su mandato permanente, firmado una vez — ver [[service-plan-bank-debit-mandates|Planes de servicio pagados por débito bancario]]. Las formas fuera de línea impresas en la línea «Formas de pago aceptadas» de la factura — efectivo, transferencia electrónica, cheque — se marcan en **Configuración → Pagos → Formas de pago que aceptas**." },
        ],
      },
      {
        id: "what-fieldquo-records",
        heading: "Qué registra FieldQuo cuando llega el pago",
        blocks: [
          { bullets: [
            "**Una fila de pago** con la fecha, el método (**Card**, o el débito bancario — el historial nombra los métodos en inglés), el monto, y debajo **comisión de tarjeta $68.10 · depositado $2,191.90** — para un pago bancario de $5,000, **comisión de débito bancario $5.00 · depositado $4,995.00**.",
            "**El saldo y el estado** — recalculados sobre cada pago; **Pagada** cuando no queda nada, con una fecha de pago y «via Stripe» en el aviso.",
            "**Una notificación** — **Factura pagada** envía un correo a todos los que tienen rol de propietario o administrador, activada por defecto bajo **Configuración → Notificaciones**.",
            "**La tarea de seguimiento** se cierra, y el dinero adeudado y la escalera de cuentas por cobrar del panel sueltan la factura.",
            "**Idempotencia** — Stripe puede entregar la misma confirmación dos veces; la segunda se ignora, así que un pago nunca se registra dos veces.",
          ] },
        ],
      },
      {
        id: "when-there-is-no-pay-button",
        heading: "Cuando no hay botón Pagar",
        blocks: [
          { p: "Si Stripe no está conectado, o está conectado pero todavía no habilitó los cobros, el correo dice en cambio **Ver su factura**, y el portal muestra «Por favor comuníquese con nosotros para coordinar el pago.» donde estaría el botón. La página de la factura también le avisa: **Stripe aún no está conectado, así que el correo les pide que te contacten en lugar de ofrecer un pago con tarjeta. Termina la configuración en Configuración → Pagos.** Ver [[connect-stripe-and-get-verified|Conectar Stripe y verificarse]]." },
          { p: "El pago se genera por el monto adeudado en el momento en que el cliente toca Pagar, con tope en el saldo real — así que un cliente que abre un correo viejo después de un pago parcial recibe la solicitud por el resto, nunca por la cifra original. Una factura sin nada pendiente se niega a iniciar un pago." },
        ],
      },
    ],
    faq: [
      { q: "¿El cliente puede pagar una parte de la factura?", a: "Solo cuando un calendario de pagos pide una etapa — el botón Pagar solicita entonces esa parte. Si no, el botón pide el saldo completo. Un pago parcial que reciba de otra forma se registra a mano." },
      { q: "¿FieldQuo se queda con una parte?", a: "La comisión de procesamiento es 3% + 30¢ en un pago con tarjeta y 1% + 40¢ con tope de $5 en un débito bancario canadiense, descontada antes de que el dinero llegue a su banco y mostrada en la fila del pago. Nada más, y sin cuota mensual." },
      { q: "El cliente pagó pero la factura sigue diciendo Enviada.", a: "Stripe confirma un cobro con tarjeta a FieldQuo unos segundos después del pago. Un pago bancario es distinto: la factura muestra un pago bancario pendiente durante 3 a 5 días hábiles, y eso es normal. Si un pago con tarjeta sigue sin pagar, revise el panel de Stripe con **Gestionar en Stripe** — un pago que está ahí pero no aquí es algo para contarle a soporte, con el número de factura." },
      { q: "¿Pueden pagar desde el presupuesto en su lugar?", a: "Los depósitos en un presupuesto tienen su propio flujo — ver [[deposits-on-quotes|Depósitos en presupuestos]]. La factura es contra lo que se paga el saldo." },
    ],
  },

  "connect-stripe-and-get-verified": {
    title: "Conectar Stripe y verificarse",
    summary:
      "Configuración → Pagos, paso a paso: Conectar con Stripe, qué muestra la página mientras Stripe revisa sus datos, y qué significan Activo, En pausa y Retenido para su dinero.",
    updated: "2026-09-12",
    intro: [
      "Los pagos en línea pasan por una cuenta de Stripe a nombre de su empresa. **Configuración → Pagos** la crea, lo lleva a las páginas seguras de Stripe para completarla, y después le dice — en palabras claras — si Stripe ya está cobrando tarjetas por usted y si está transfiriendo a su banco. FieldQuo nunca ve ni guarda sus datos bancarios; esa información va directamente a Stripe.",
    ],
    sections: [
      {
        id: "overview",
        heading: "Resumen",
        blocks: [
          { p: "El encabezado de la página dice **Pagos — Conecta Stripe para que tus clientes puedan pagar las facturas en línea, directamente a tu cuenta bancaria.** La primera tarjeta es la conexión misma, en uno de cuatro estados: sin conectar, en curso, en revisión, o **Stripe conectado · Activo**. Debajo están la tarjeta **Comisiones de procesamiento**, la tarjeta **Transferencia instantánea**, **Su cuenta de Stripe** y el interruptor **Ofrecer pago a plazos (Affirm)**." },
        ],
      },
      {
        id: "how-to-connect",
        heading: "Cómo conectar",
        blocks: [
          { steps: [
            "Abra **Configuración → Pagos**. La tarjeta dice **Aún no conectado — Stripe se encarga del procesamiento real de los pagos — ingresarás tus datos bancarios en la propia página segura de Stripe, no aquí.**",
            "Toque **Conectar con Stripe**. FieldQuo crea una cuenta Express para su empresa y lo lleva al registro de Stripe.",
            "Complete lo que Stripe pide — datos del negocio, identidad, una cuenta bancaria para las transferencias — y acepte los términos de Stripe. Ver [[what-stripe-asks-for-and-why|Qué pide Stripe, y por qué]].",
            "Vuelve a **Configuración → Pagos**, que relee la cuenta desde Stripe. Si se fue a medio camino, la tarjeta dice **Stripe todavía necesita algunas cosas** y las lista, con **Finalizar configuración** y **Ya lo hice**.",
            "Una vez que todo está entregado, la tarjeta dice **Stripe está revisando tus datos** con **Comprobar de nuevo**. Cuando Stripe activa los cobros, pasa a **Stripe conectado · Activo** y cada correo de factura gana un botón **Pagar en línea**.",
          ] },
          { figure: "harness:settings-payments", caption: "Configuración → Pagos una vez verificado — Stripe conectado · Activo, Gestionar en Stripe, Desconectar, y Su cuenta de Stripe con ambos interruptores en Activado y nada pendiente." },
        ],
      },
      {
        id: "the-two-switches",
        heading: "Cobrar y recibir el dinero son dos interruptores",
        blocks: [
          { p: "**Su cuenta de Stripe** muestra **Lo que Stripe tiene activado**: **Cobro con tarjeta: Activado/Desactivado** y **Transferencias a su banco: Activado/En pausa**. Son independientes. Stripe puede seguir aceptando las tarjetas de sus clientes mientras las transferencias están en pausa — ese dinero se cobra y lo retiene Stripe, no se pierde." },
          { figure: "live:app-settings-payments", caption: "Configuración → Pagos con las transferencias en pausa — el aviso ámbar «Stripe está revisando su cuenta», transferencias En pausa, y «Lo que Stripe sigue esperando: Nada de su parte.»" },
          { table: {
            head: ["Qué dice la página", "Qué está pasando", "Qué hacer"],
            rows: [
              ["**Stripe está revisando su cuenta**", "Usted envió todo; Stripe lo está revisando. Las transferencias están en pausa, normalmente un día, a veces dos o tres. Los pagos de sus clientes siguen pasando.", "Nada. Volver a enviar los documentos no lo acelera."],
              ["**Stripe está reteniendo su dinero**", "Los cobros están activados pero las transferencias apagadas porque Stripe todavía necesita algo de usted. **Motivo de Stripe:** se imprime debajo, en palabras claras.", "Toque **Gestionar en Stripe** y termine lo que pide. Ver [[payouts-held-or-under-review|Transferencias retenidas o en revisión]]."],
              ["**Stripe todavía necesita algunas cosas**", "El registro está incompleto; los cobros están apagados, así que todavía no hay botón Pagar.", "**Finalizar configuración**, o **Ya lo hice** si lo completó del lado de Stripe y FieldQuo no se ha puesto al día."],
            ],
          } },
        ],
      },
      {
        id: "the-other-controls",
        heading: "Los otros controles de la página",
        blocks: [
          { bullets: [
            "**Gestionar en Stripe** abre su panel Express en una pestaña nueva: transferencias, documentos, datos bancarios, soporte. Stripe envía un código de acceso al **Correo de inicio de sesión** que se muestra en la página.",
            "**Copiar** junto al **ID de cuenta de Stripe** (empieza con acct_) — lo que Stripe usa para encontrar su cuenta cuando los contacta. Visible solo para el propietario.",
            "**Desconectar** desvincula Stripe de FieldQuo: los clientes no pueden pagar en línea hasta que reconecte. No elimina ni cierra su cuenta de Stripe y no cambia nada de su historial de transferencias.",
            "**Ofrecer pago a plazos (Affirm)** deja que los clientes dividan una factura al pagar mientras usted cobra completo, por adelantado. Disponible en facturas entre $50 y $30,000 en USD o CAD, y primero debe activar Affirm en su panel de Stripe — ver [[pay-over-time-financing|Financiamiento a plazos]].",
            "**Comisiones de procesamiento** y **Transferencia instantánea** se explican en [[payment-processing-fees-and-payouts|Comisiones de procesamiento de pagos y transferencias]] e [[instant-payouts|Transferencias instantáneas]].",
          ] },
        ],
      },
      {
        id: "who-can-see-it",
        heading: "Quién puede verla",
        blocks: [
          { p: "**Configuración → Pagos** es solo para el propietario y los administradores — la fila está oculta para todos los demás y las rutas detrás los rechazan. El ID de cuenta y el correo de inicio de sesión son aún más restringidos: solo el propietario, porque son el par de valores que le permiten a alguien decirle a Stripe «esta cuenta es mía»." },
        ],
      },
    ],
    faq: [
      { q: "¿Cuánto tarda la verificación?", a: "Normalmente minutos, a veces un día o dos. La página dice **Stripe está revisando tus datos** mientras ocurre; **Comprobar de nuevo** relee la cuenta." },
      { q: "Ya tengo una cuenta de Stripe. ¿Puedo usarla?", a: "Hoy no. FieldQuo crea una cuenta Express para la empresa y vincula esa; no hay forma de adjuntar una cuenta existente." },
      { q: "Los clientes pagan pero nada llega a mi banco.", a: "Mire **Transferencias a su banco** en esta página. **En pausa** con un aviso de revisión significa esperar; **En pausa** con **Stripe está reteniendo su dinero** significa abrir **Gestionar en Stripe** y terminar lo que lista." },
    ],
  },

  "what-stripe-asks-for-and-why": {
    title: "Qué pide Stripe, y por qué",
    summary:
      "Los documentos y datos que Stripe exige antes de transferir, en las palabras que FieldQuo usa en la página Pagos, y qué significa cada uno de los motivos de restricción de Stripe.",
    updated: "2026-09-12",
    intro: [
      "Antes de que Stripe mueva dinero a una cuenta bancaria tiene que saber de quién es el negocio, quién lo posee y adónde va el dinero — las mismas comprobaciones que hace un banco cuando usted abre una cuenta. Los nombres que Stripe les da son claves de máquina como «company.verification.document»; **Configuración → Pagos** traduce cada una a una frase, para que **Lo que Stripe sigue esperando** sea una lista sobre la que puede actuar.",
    ],
    sections: [
      {
        id: "overview",
        heading: "Resumen",
        blocks: [
          { p: "La lista de la página Pagos combina lo que Stripe dice que **vence ahora** y lo que está **vencido**. Todo lo que Stripe todavía está verificando se deja fuera a propósito — decirle que «proporcione más información» mientras Stripe revisa lo que ya envió es como la gente termina enviando el mismo documento cuatro veces. Cuando hay una fecha límite, la página imprime **Fecha límite de Stripe: fecha**; la mayoría de las cuentas no tiene ninguna, y FieldQuo nunca inventa una." },
          { figure: "live:app-settings-payments", caption: "Su cuenta de Stripe — el ID de cuenta, el correo de inicio de sesión, los dos interruptores, y «Lo que Stripe sigue esperando»." },
        ],
      },
      {
        id: "what-it-asks-for",
        heading: "Qué pide",
        blocks: [
          { table: {
            head: ["Qué dice la página", "Por qué Stripe lo quiere"],
            rows: [
              ["**A bank account for payouts** — una cuenta bancaria para las transferencias", "Adonde va el dinero. Sin ella, Stripe puede cobrar y retener, pero nunca transferir."],
              ["**Accepting Stripe's terms of service** — aceptar los términos de servicio de Stripe", "La cuenta es suya, bajo el acuerdo de Stripe, no el de FieldQuo."],
              ["**A photo of your ID** / **A second piece of ID** — una foto de su identificación, y luego una segunda", "La identidad de la persona que abre la cuenta — la comprobación estándar de conocimiento del cliente."],
              ["**Your business number (BN)** — su número de empresa", "La identidad fiscal del negocio al que se le paga el dinero."],
              ["**A document verifying the business (incorporation papers, CRA notice, or a registry search result)** — un documento que pruebe que la empresa existe", "La prueba de que la empresa existe y coincide con el nombre en la cuenta."],
              ["**Confirmation that you've listed every director** / **everyone owning 25% or more** / **executives** — la confirmación de que todos los directores, los dueños del 25% o más y los ejecutivos están listados", "Los reguladores exigen que las personas detrás de un negocio estén nombradas."],
              ["**Your industry** / **A description of what you sell** / **A business website or product description** — su sector, una descripción de lo que vende, y un sitio web o una descripción del producto", "De qué son los cobros en las tarjetas de sus clientes. Un sitio web es opcional — una descripción basta."],
              ["**A customer support phone number** — un teléfono de atención al cliente", "Lo que aparece junto a su nombre en el estado de cuenta del cliente, para que un titular lo llame en vez de disputar el cobro."],
            ],
          } },
          { note: "Estas etiquetas se muestran en inglés, sea cual sea el idioma de su interfaz. Una línea que empieza con **A director or owner:** es un requisito sobre una persona concreta que Stripe tiene registrada — normalmente su identificación o su dirección — y no sobre la empresa." },
        ],
      },
      {
        id: "stripes-reasons",
        heading: "Los motivos de Stripe, en palabras claras",
        blocks: [
          { p: "Cuando Stripe restringe una cuenta, le adjunta un motivo. La página Pagos lo imprime bajo **Motivo de Stripe:** o bajo el aviso de transferencias retenidas, traducido desde la clave de Stripe a una frase — en inglés, sea cual sea el idioma de su interfaz:" },
          { bullets: [
            "**Stripe is waiting on information that is now overdue.** — un elemento de la lista pasó su fecha límite. Termínelo en **Gestionar en Stripe**.",
            "**Stripe is still checking what you sent. There is nothing to do.** — la verificación de lo que usted envió está en curso; no hay nada que hacer de su parte por el momento.",
            "**Stripe is reviewing the account.** / **Stripe is reviewing a possible sanctions-list match.** — una revisión manual del lado de Stripe, sobre la cuenta o sobre una posible coincidencia con una lista de sanciones. Espere, o pregúntele a Stripe desde su panel.",
            "**Stripe closed the account …** por fraude sospechado («for suspected fraud»), por violación de los términos de servicio («for a terms of service violation») o tras una coincidencia con una lista de sanciones («after a sanctions-list match») — decisiones que solo Stripe puede revisar, desde su panel.",
            "**FieldQuo paused this account.** — raro, y soporte lo habrá contactado.",
            "**Stripe has restricted the account and hasn't said why.** — Stripe restringió la cuenta sin dar un motivo; pregúntele por qué, citando el ID de su cuenta en la consulta.",
          ] },
        ],
      },
      {
        id: "where-to-settle-it",
        heading: "Dónde resolverlo",
        blocks: [
          { steps: [
            "Abra **Configuración → Pagos** y lea **Lo que Stripe sigue esperando**.",
            "Toque **Gestionar en Stripe** (o **Finalizar configuración** mientras el registro esté incompleto). El panel de Stripe reúne los elementos pendientes en un aviso y lo lleva a cada uno.",
            "Vuelva y toque **Comprobar de nuevo** o **Ya lo hice**. FieldQuo relee la cuenta y actualiza los interruptores.",
            "Si el panel de verdad no puede resolverlo, al soporte de Stripe se llega desde ese mismo panel una vez que inició sesión. Deles el **ID de cuenta de Stripe** de la página — es lo que identifica su cuenta para ellos, no el nombre de su empresa ni su correo.",
          ] },
          { tip: "El soporte de FieldQuo puede ver la misma página de estado en modo de solo lectura y también le pedirá el ID de cuenta. No puede subir un documento ni aceptar términos en su nombre — eso le toca a usted, en las páginas de Stripe." },
        ],
      },
    ],
    faq: [
      { q: "¿Por qué Stripe quiere mi identificación si la empresa está constituida?", a: "Porque una persona abre la cuenta. Stripe verifica al representante igual que a la empresa, y puede pedir por separado a los directores y a los dueños del 25% o más." },
      { q: "¿Se detendrán los pagos de mis clientes mientras algo esté pendiente?", a: "No una vez activados los cobros. **Cobro con tarjeta** y **Transferencias a su banco** son interruptores independientes; el efecto habitual de un elemento pendiente son transferencias en pausa, con el dinero guardado a salvo por Stripe hasta que se resuelva." },
      { q: "Envié un documento y la lista todavía lo muestra.", a: "La página solo quita un elemento cuando Stripe lo marca como recibido. Toque **Comprobar de nuevo**; si ahora está en verificación, la etiqueta cambia a **Nada de su parte. Stripe está revisando lo que ya envió; volver a enviarlo no lo acelerará.**" },
    ],
  },
};
