// content/help/es/settings-3.js
//
// Parte 3 de la categoría « settings » en español (ver el compositor,
// settings.js). Slugs de esta parte (lib/help/tree.js):
// settings-job-photo-tags, settings-client-messages, settings-follow-ups,
// settings-notifications, settings-email-domain, settings-payments,
// settings-meta-ads, settings-expense-tracking, settings-ai-credit,
// settings-payroll, settings-website, settings-instant-quotes.
//
// Misma estructura que el inglés, artículo por artículo: mismos slugs, mismas
// secciones en el mismo orden, mismos bloques, mismas figuras —
// scripts/check-help-centre.mjs compara los dos. Las palabras en pantalla
// vienen del bloque `es` de app/i18n/appMessages.js; los niveles de acceso, de
// lib/permissions/settingsAccess.js.
export const ARTICLES = {
  "settings-job-photo-tags": {
    title: "Etiquetas de fotos de trabajo",
    summary:
      "Sus propias palabras para lo que pasa en una foto de trabajo — lijado, imprimación, capa final — y cómo se suman a las cuatro etapas fijas.",
    updated: "2026-09-12",
    intro: [
      "**Configuración → Etiquetas de fotos de trabajo** es donde escribe el vocabulario que su oficina usa para describir una foto que llega del campo. Una etiqueta es un rótulo de color — «Lijado», «Demolición», «Lista de pendientes» — que cualquiera que ordene las fotos de un trabajo puede poner sobre una toma, y por el que la cronología de fotos del trabajo puede filtrar. Las etiquetas se suman a las cuatro etapas integradas (antes, en curso, terminado, problema), que quedan fijas porque gobiernan la galería de antes y después de su sitio web y mantienen una foto de problema fuera de ella.",
    ],
    sections: [
      {
        id: "overview",
        heading: "Resumen",
        blocks: [
          { p: "La pantalla es una sola tarjeta: la lista ordenada de sus etiquetas con una muestra de color cada una, un formulario pequeño para agregar una, y un bloque de etiquetas para empezar que puede adoptar con una sola pulsación. Una etiqueta tiene un nombre (hasta 60 caracteres), un color entre ocho muestras o ninguno, y una posición en la lista — el orden de la lista es el orden en que el selector las ofrece sobre una foto." },
          { p: "Una etiqueta nunca se elimina. Se **retira**: las fotos que ya la llevan la conservan, y simplemente deja de ofrecerse en las nuevas. Es la misma regla que FieldQuo aplica a una persona que deja la empresa, y por la misma razón — doscientas fotos etiquetadas «Imprimación» no deben perder su etiqueta porque usted dejó de usar la palabra." },
        ],
      },
      {
        id: "on-the-screen",
        heading: "Qué hay en la pantalla",
        blocks: [
          { bullets: [
            "**Etiquetas de fotos de trabajo** — el título, con la frase que explica que las etiquetas se suman a antes / en curso / terminado / problema.",
            "La lista de etiquetas — cada etiqueta activa con su muestra de color, **Subir**, **Bajar** y **Retirar**. Las etiquetas retiradas siguen al final, en gris, con la palabra **retirada** y un botón **Recuperar**.",
            "**Agregar una etiqueta** — una casilla **Nombre de la etiqueta**, la fila **Color** de muestras, y **Agregar etiqueta**.",
            "**Etiquetas para empezar** — un juego genérico mostrado como fichas (Demolición, Preparación, Lijado, Imprimación, Instalación, Capa final, Lista de pendientes, Retoque) y un solo botón, **Agregar etiquetas para empezar**. No se agrega nada hasta que lo pulse.",
            "**Aún no hay etiquetas.** cuando la empresa no tiene ninguna, y **Ya tienes todas las etiquetas para empezar.** una vez adoptado todo el juego inicial.",
          ] },
        ],
      },
      {
        id: "add-and-arrange",
        heading: "Cómo agregar y ordenar etiquetas",
        blocks: [
          { steps: [
            "Abra **Configuración → Etiquetas de fotos de trabajo**.",
            "Escriba un nombre bajo **Agregar una etiqueta**, elija un color (o déjelo en blanco) y pulse **Agregar etiqueta**. Un nombre que ya usa se rechaza — una etiqueta por palabra.",
            "Pulse el nombre de una etiqueta para renombrarla o cambiar su color, y luego **Guardar**. Use **Subir** y **Bajar** para fijar el orden que ve la cuadrilla.",
            "Para dejar de ofrecer una etiqueta, pulse **Retirar** y confirme. Para ofrecerla otra vez más adelante, pulse **Recuperar**.",
          ] },
          { figure: "live:app-settings-job-photo-tags", caption: "Configuración → Etiquetas de fotos de trabajo — la lista ordenada con sus muestras de color, el formulario Agregar una etiqueta y el juego para empezar." },
          { note: "**Agregar etiquetas para empezar** solo crea los nombres iniciales que todavía no tiene — por nombre, sin distinguir mayúsculas — para que una etiqueta que renombró o retiró no se vuelva a crear a sus espaldas." },
        ],
      },
      {
        id: "what-each-control-changes",
        heading: "Qué cambia cada control",
        blocks: [
          { table: {
            head: ["Control", "Qué hace"],
            rows: [
              ["**Agregar etiqueta**", "Crea la etiqueta al final de la lista. Se ofrece en las fotos nuevas de inmediato."],
              ["**Subir** / **Bajar**", "Cambia el orden de toda la lista; el selector sobre una foto lo sigue."],
              ["**Retirar**", "Oculta la etiqueta del selector en las fotos nuevas. Cada foto ya etiquetada la conserva, y el filtro del trabajo la sigue listando mientras una foto la lleve."],
              ["**Recuperar**", "Devuelve una etiqueta retirada al selector, en su posición anterior."],
              ["**Agregar etiquetas para empezar**", "Agrega los nombres iniciales que le falten de los ocho, después de sus propias etiquetas."],
            ],
          } },
        ],
      },
      {
        id: "where-tags-are-used",
        heading: "Dónde se usan las etiquetas",
        blocks: [
          { p: "Las etiquetas se aplican en la página del trabajo, en el panel de organización de fotos, por cualquiera cuyo acceso le permita editar trabajos. La cronología de fotos del trabajo, arriba, tiene un desplegable **Filtrar por etiqueta** construido con las etiquetas que realmente llevan las fotos de ese trabajo, y un enlace **Gestionar etiquetas** que vuelve a esta pantalla. Etiquetar una foto nunca cambia su etapa, nunca la destaca en el sitio web y no puede hacer pública una foto de problema — vea [[job-photos-and-tags|Fotos de trabajo y etiquetas]]." },
          { tip: "Elija etiquetas que nombren un paso, no un juicio. «Capa final» le dice a la oficina en qué punto está un trabajo; «Bonito» no le dice nada a nadie." },
        ],
      },
      {
        id: "who-can-see-it",
        heading: "Quién puede verlo",
        blocks: [
          { p: "La fila aparece para propietarios, administradores y los niveles Despachador y Encargado — cualquiera que pueda gestionar el equipo. Todos los demás pueden igualmente leer la lista de etiquetas donde importa, en las fotos del trabajo, porque el selector la necesita; simplemente no pueden crear, renombrar ni retirar una." },
        ],
      },
    ],
    faq: [
      { q: "¿Puedo eliminar una etiqueta por completo?", a: "No. Retírela. Las fotos que la llevan la conservan, y desaparece del selector en las fotos nuevas. No hay botón de eliminar, a propósito." },
      { q: "¿Puede una etiqueta reemplazar la etapa «problema»?", a: "No. Las etapas y las etiquetas viven en lugares distintos. Una etiqueta que literalmente se llame «Problema» es decorativa; solo la etapa mantiene una foto fuera de su galería pública." },
      { q: "¿La cuadrilla elige una etiqueta cuando envía una foto por mensaje?", a: "No. Las fotos llegan con una etapa deducida del texto; las etiquetas se agregan después en la página del trabajo, por alguien que puede editar trabajos." },
    ],
  },

  "settings-client-messages": {
    title: "Mensajes de clientes",
    summary:
      "Los dos mensajes de texto que reciben sus clientes — Voy en camino y el recordatorio de cita — con los campos que puede usar, la vista previa en vivo y cómo se decide el idioma.",
    updated: "2026-09-12",
    intro: [
      "**Configuración → Mensajes de clientes** guarda la redacción de los mensajes de texto que FieldQuo envía a sus clientes en nombre de su empresa. Solo se listan los mensajes que realmente se envían, así que hoy la pantalla tiene exactamente dos editores: **Voy en camino** y **Recordatorio de cita**. Deje uno sin cambios y el cliente recibe la redacción integrada de FieldQuo; edítelo y recibe la suya, con una vista previa bajo la casilla que muestra exactamente lo que le llegará.",
    ],
    sections: [
      {
        id: "overview",
        heading: "Resumen",
        blocks: [
          { p: "Cada editor es una tarjeta: el nombre del mensaje, una casilla de tres líneas, las fichas de los campos que puede usar, una vista previa **Tu cliente ve:** rellenada con valores de ejemplo (el nombre y el teléfono de su empresa reemplazan a los ejemplos), **Guardar**, y **Usar el predeterminado** una vez que lo haya personalizado. Un mensaje con un campo que no existe no se puede guardar — la pantalla lo rechaza, y el servidor lo vuelve a rechazar — para que nadie le envíe jamás a un cliente un «{price}» en crudo." },
          { note: "Los recordatorios de cita van solo por mensaje de texto; no hay recordatorio por correo. Si los recordatorios se envían o no, y con cuánta antelación, se define en [[settings-notifications|Configuración → Notificaciones]] — esta pantalla solo decide las palabras." },
        ],
      },
      {
        id: "on-the-screen",
        heading: "Qué hay en la pantalla",
        blocks: [
          { bullets: [
            "**Mensajes de clientes — Los mensajes de texto que reciben tus clientes.** El subtítulo también enuncia la regla de idioma descrita más abajo.",
            "**Voy en camino** — el texto que se envía cuando un miembro de la cuadrilla pulsa Voy en camino en una visita. Campos: {company}, {worker}, {name}, {eta}, {phone}. Una marca **Personalizado** aparece una vez que guarda su propia redacción.",
            "**Recordatorio de cita** — el texto que el calendario de recordatorios envía antes de una cita o visita de trabajo. Campos: {company}, {when}, {location}.",
            "Bajo cada casilla: **Tu cliente ve:** con la vista previa, luego **Guardar** y, en un mensaje personalizado, **Usar el predeterminado**.",
          ] },
        ],
      },
      {
        id: "edit-a-text",
        heading: "Cómo cambiar un mensaje",
        blocks: [
          { steps: [
            "Abra **Configuración → Mensajes de clientes**.",
            "Escriba el mensaje en la casilla del texto que quiere cambiar. Toque una ficha de campo para insertarla donde está el cursor.",
            "Lea **Tu cliente ve:** — es el mensaje con valores de ejemplo en lugar de los campos.",
            "Pulse **Guardar**. El botón sigue desactivado mientras la casilla contenga un campo desconocido o coincida con lo que ya está guardado.",
            "Para volver a la redacción de FieldQuo, pulse **Usar el predeterminado**. La redacción guardada se quita, no se deja en blanco.",
          ] },
          { figure: "live:app-settings-messages", caption: "Configuración → Mensajes de clientes — el editor Voy en camino con sus fichas de campo y la vista previa Tu cliente ve." },
          { tip: "Un campo sin valor desaparece limpiamente. Escriba «Llegada {eta}» y una visita sin hora de llegada conocida envía «Llegada» sin un espacio suelto — no necesita dos versiones." },
        ],
      },
      {
        id: "fields-you-can-use",
        heading: "Los campos que puede usar",
        blocks: [
          { table: {
            head: ["Campo", "En qué se convierte", "Mensaje"],
            rows: [
              ["{company}", "el nombre de su negocio", "ambos"],
              ["{worker}", "el miembro de la cuadrilla asignado", "Voy en camino"],
              ["{name}", "el nombre de pila del cliente", "Voy en camino"],
              ["{eta}", "la llegada estimada, si se conoce — calculada desde la posición del miembro de la cuadrilla cuando pulsa el botón", "Voy en camino"],
              ["{phone}", "el teléfono de su negocio", "Voy en camino"],
              ["{when}", "la hora de la cita, en el idioma del cliente y la zona horaria de su empresa", "Recordatorio de cita"],
              ["{location}", "dónde es la visita", "Recordatorio de cita"],
            ],
          } },
        ],
      },
      {
        id: "languages",
        heading: "Qué idioma recibe el cliente",
        blocks: [
          { p: "Su redacción les llega a los clientes que leen el idioma predeterminado de su empresa. Un cliente con otro idioma recibe la redacción integrada de FieldQuo en el suyo — los mismos ocho idiomas que su presupuesto. Nada de lo que usted escribe se traduce automáticamente al enviar." },
          { warning: "Las respuestas al texto Voy en camino no las lee nadie. Por eso la redacción integrada remite al cliente al teléfono de su negocio; si escribe la suya, mantenga {phone} en ella." },
        ],
      },
      {
        id: "who-can-see-it",
        heading: "Quién puede verlo",
        blocks: [
          { p: "Propietarios, administradores y los niveles Despachador y Encargado. Guardar un mensaje exige el mismo acceso; la fila se oculta a todos los demás en vez de mostrarse con botones que serían rechazados." },
        ],
      },
    ],
    faq: [
      { q: "¿Puedo editar el texto de confirmación de reserva?", a: "No desde aquí. Existe y se envía, pero todavía no es editable, así que la pantalla no muestra un editor para él." },
      { q: "¿Cambiar la redacción cambia quién recibe el recordatorio?", a: "No. Esta pantalla es solo palabras. Active o desactive los recordatorios, y elija 2, 24 o 48 horas, en Configuración → Notificaciones." },
      { q: "¿Por qué mi cliente recibió el texto predeterminado aunque lo personalicé?", a: "Su idioma no es el idioma predeterminado de su empresa. La redacción personalizada se envía solo a los clientes que leen el idioma en que fue escrita; todos los demás reciben el texto integrado en su propio idioma." },
    ],
  },

  "settings-follow-ups": {
    title: "Seguimientos",
    summary:
      "Reglas que envían una plantilla por correo un tiempo determinado después de que una consulta, presupuesto, factura o trabajo alcanza un estado — los cuatro desencadenantes, el retraso y cuándo se detiene una regla.",
    updated: "2026-09-12",
    intro: [
      "**Configuración → Seguimientos** es donde configura el seguimiento automático: «tres días después de enviar un presupuesto sin respuesta, enviar este correo»; «cinco días después de que una factura venza, enviar aquel». Cada regla es un desencadenante, un retraso y una plantilla de correo. FieldQuo revisa las reglas una vez al día, envía a quien cumpla las condiciones y se detiene en el momento en que el cliente actúa.",
    ],
    sections: [
      {
        id: "overview",
        heading: "Resumen",
        blocks: [
          { p: "La pantalla es una lista de reglas bajo un esquema de solo lectura llamado **Cómo se ejecutan**, dibujado a partir de las propias reglas: Desencadenante → Esperar → Enviar correo → Se detiene. Varias reglas pueden compartir un desencadenante — un recordatorio suave a los tres días y uno más firme a los siete — y el esquema las apila en el orden en que se disparan." },
          { p: "Una regla necesita una plantilla de correo del tipo correcto. Solo se ofrecen plantillas de tipo **Seguimiento**, **Marketing** o **Personalizado**, nunca una plantilla de presupuesto, de instrucciones o de recibo. Sin ninguna de esas, la pantalla lo dice y lo remite a [[settings-email-templates|Plantillas de correo]]; el botón **Nueva regla** sigue desactivado hasta que exista una." },
        ],
      },
      {
        id: "on-the-screen",
        heading: "Qué hay en la pantalla",
        blocks: [
          { bullets: [
            "**Seguimientos — Envía automáticamente una plantilla un tiempo determinado después de que una cotización, factura o trabajo alcance cierto estado, sin recordatorios manuales.** y el botón **Nueva regla**.",
            "**Cómo se ejecutan** — el esquema, una columna por desencadenante, que muestra la espera de cada regla, su plantilla y las condiciones de parada. Una regla en pausa se dibuja como omitida.",
            "La lista de reglas — el nombre de cada regla, **En pausa** cuando está apagada, una línea como «3 días después de Cotización enviada, sin respuesta → Seguimiento de cotización», las dos frases de parada, y luego **Pausar** o **Activar** y un botón de eliminar.",
            "**Aún no hay reglas de seguimiento.** para una empresa nueva.",
          ] },
        ],
      },
      {
        id: "create-a-rule",
        heading: "Cómo crear una regla",
        blocks: [
          { steps: [
            "Abra **Configuración → Seguimientos** y pulse **Nueva regla**.",
            "Póngale un **Nombre de la regla (opcional)** — en blanco, toma el nombre del desencadenante.",
            "Elija el **Desencadenante**. La frase bajo el desplegable dice exactamente cuándo se dispara.",
            "Defina el **Retraso** y su **Unidad** (horas o días). Cada desencadenante propone un valor predeterminado razonable.",
            "Elija la **Plantilla a enviar** entre sus plantillas admisibles.",
            "Pulse **Crear regla**. Queda activa de inmediato y se considerará en la próxima ejecución diaria.",
          ] },
          { figure: "live:app-settings-follow-ups", caption: "Configuración → Seguimientos — el esquema Cómo se ejecutan sobre la lista de reglas, cada regla con Pausar y eliminar." },
          { note: "Elegir **Consulta nueva, nadie respondió** muestra una línea adicional: una consulta aún no tiene presupuesto, así que los campos de presupuesto de una plantilla ({{quoteUrl}}, {{quoteTotal}}, {{quoteNumber}}) salen vacíos. Igual puede completar el nombre, el teléfono y la dirección del cliente, los datos de su empresa y el servicio por el que preguntó." },
        ],
      },
      {
        id: "triggers",
        heading: "Los cuatro desencadenantes",
        blocks: [
          { table: {
            head: ["Desencadenante", "Se dispara cuando", "Retraso predeterminado", "Se detiene"],
            rows: [
              ["**Consulta nueva, nadie respondió**", "una consulta lleva en «nueva» el tiempo del retraso sin presupuesto y sin que nadie la marque contactada", "2 días", "cuando la consulta se marca contactada, cotizada, ganada o perdida"],
              ["**Cotización enviada, sin respuesta**", "el presupuesto lleva en «enviado» el tiempo del retraso sin aceptar ni rechazar", "3 días", "en cuanto el cliente acepta o rechaza el presupuesto"],
              ["**Factura vencida**", "una factura impaga supera su vencimiento por el tiempo del retraso", "5 días", "en cuanto se paga la factura"],
              ["**Trabajo completado**", "un trabajo lleva marcado como completado el tiempo del retraso — un agradecimiento o una solicitud de reseña", "2 días", "si el trabajo se reabre"],
            ],
          } },
        ],
      },
      {
        id: "how-rules-run",
        heading: "Cómo se ejecutan las reglas",
        blocks: [
          { bullets: [
            "Las reglas se revisan **una vez al día**, no en el instante en que se cumple el retraso. Un correo llega en la primera ejecución después de cumplido el retraso.",
            "Cada presupuesto, factura, trabajo o consulta recibe el correo de una regla dada **una sola vez**. Dos reglas sobre un mismo desencadenante son dos correos; una regla nunca se repite.",
            "Se omiten los clientes sin dirección de correo registrada.",
            "El correo sale desde su propio dominio cuando ha verificado uno, y si no, desde la dirección compartida de FieldQuo con el nombre de su empresa — vea [[settings-email-domain|Dominio de correo]]. Las respuestas van al correo de su empresa.",
            "**Trabajo completado** es un envío de marketing: un cliente que se dio de baja de su correo de marketing se omite, y el correo lleva un enlace para darse de baja. Los otros tres son transaccionales y siempre salen.",
          ] },
        ],
      },
      {
        id: "who-can-see-it",
        heading: "Quién puede verlo",
        blocks: [
          { p: "Propietarios, administradores y los niveles Despachador y Encargado. Crear, pausar y eliminar una regla necesitan ese acceso, así que la fila se oculta a todos los demás. Las reglas son de toda la empresa: no hay seguimiento por persona." },
        ],
      },
    ],
    faq: [
      { q: "¿Pausar una regla cancela los correos ya enviados?", a: "No. Detiene los envíos futuros. Lo ya entregado sigue entregado, y la regla recuerda a quién escribió, así que activarla otra vez no reenvía." },
      { q: "¿Qué pasa si elimino la plantilla que usa una regla?", a: "La regla muestra (plantilla eliminada) y no envía nada. Elimine la regla o cree una nueva con otra plantilla." },
      { q: "¿Puede una regla enviar un mensaje de texto en vez de un correo?", a: "No. Las reglas de seguimiento son solo por correo. Los mensajes de texto que envía FieldQuo son los dos de Mensajes de clientes." },
      { q: "¿Por qué el correo llegó un día después de mi retraso?", a: "Las reglas se ejecutan en un horario diario. Un retraso de 3 días significa que el correo sale en la primera ejecución diaria después del tercer día, no a la hora exacta." },
    ],
  },

  "settings-notifications": {
    title: "Notificaciones",
    summary:
      "Cuándo FieldQuo envía un correo a los propietarios por un presupuesto grande o una factura pagada, con cuánta antelación se envía un recordatorio por texto a los clientes, y las notificaciones del navegador para usted.",
    updated: "2026-09-12",
    intro: [
      "**Configuración → Notificaciones** son cuatro tarjetas. Dos deciden cuándo FieldQuo envía un correo a todos con rol de propietario o administrador — un presupuesto grande creado, una factura pagada en línea. Una decide si a los clientes se les envía un recordatorio por texto antes de una visita y con cuánta antelación. La última es personal: si este navegador, en este dispositivo, le muestra una notificación del sistema cuando ocurre algo en su cuenta.",
    ],
    sections: [
      {
        id: "overview",
        heading: "Resumen",
        blocks: [
          { p: "Solo se listan las alertas que realmente se disparan. Hay un umbral que escribir (el monto del presupuesto grande), un interruptor activado de forma predeterminada (factura pagada), una elección de antelación (recordatorios) y un interruptor por navegador. Una tarjeta al pie, **Correos para clientes**, le recuerda que los correos de presupuesto, recibo y seguimiento se configuran en otra parte: lo que dicen está en [[settings-email-templates|Plantillas de correo]], cuándo se envían en [[settings-follow-ups|Seguimientos]]." },
        ],
      },
      {
        id: "large-quote",
        heading: "Cotización grande creada",
        blocks: [
          { p: "**Envía un correo a todos con rol de propietario o administrador cuando alguien de tu equipo redacta una cotización superior a este monto.** Hasta que fije un monto, la tarjeta dice **Aún no configurado: no se envía ninguna alerta.**" },
          { steps: [
            "Marque **Enviar esta alerta**.",
            "Escriba el umbral bajo **Avisarme por encima de** — en su moneda; los presupuestos completos por encima de ese monto califican.",
            "Pulse **Guardar**. Desmarque la casilla y guarde para apagarla; el monto se conserva.",
            "Espere el correo dentro de un día: la revisión se ejecuta en un horario diario, no en el instante en que se guarda un presupuesto.",
          ] },
          { figure: "live:app-settings-notifications", caption: "Configuración → Notificaciones — el umbral del presupuesto grande, el interruptor de factura pagada, las antelaciones del recordatorio y la tarjeta del navegador." },
        ],
      },
      {
        id: "invoice-paid",
        heading: "Factura pagada",
        blocks: [
          { p: "**Envía un correo a todos con rol de propietario o administrador cuando un cliente paga una factura en línea. Activado de forma predeterminada.** La única casilla **Enviar esta alerta** se guarda en cuanto la marca o la desmarca. Una empresa que nunca la ha tocado la tiene activada; solo desmarcarla explícitamente la apaga. Los pagos manuales que usted mismo registra no la disparan." },
        ],
      },
      {
        id: "appointment-reminders",
        heading: "Recordatorios de cita",
        blocks: [
          { p: "**Envía al cliente un SMS de recordatorio antes de su cita o visita de trabajo. Se envía con el nombre de tu negocio; el cliente puede responder STOP para darse de baja.** Cuatro píldoras, una de ellas seleccionada: **Desactivado**, **2 horas antes**, **24 horas antes**, **48 horas antes**. Pulsar una la guarda." },
          { bullets: [
            "Los recordatorios llegan tanto a citas como a visitas de trabajo, una vez cada una — nunca dos veces para la misma visita.",
            "A un cliente que se dio de baja nunca se le envía un texto, y una visita sin número de teléfono del cliente simplemente no envía nada.",
            "La revisión se ejecuta cada hora, así que un recordatorio de 24 horas llega dentro de la hora previa a la marca de 24 horas.",
            "Los recordatorios están incluidos en su plan; no se cobra nada por mensaje. La redacción es suya para cambiarla en [[settings-client-messages|Mensajes de clientes]].",
          ] },
          { note: "Los recordatorios van solo por mensaje de texto. No hay recordatorio por correo. Todo el detalle: [[appointment-reminders|Recordatorios de cita]]." },
        ],
      },
      {
        id: "browser-notifications",
        heading: "Notificaciones del navegador",
        blocks: [
          { p: "**Avisarme en este navegador** es un interruptor por persona y por dispositivo. Activarlo le pide permiso al navegador; desde entonces la actividad nueva — los mismos eventos que la campana de la barra superior, y los mensajes nuevos de su bandeja — se muestra como notificación del sistema mientras FieldQuo está en otra pestaña. Donde el push está configurado en la instalación, los mismos eventos llegan con la pestaña cerrada." },
          { bullets: [
            "La tarjeta enuncia el permiso del navegador con claridad: **concedido**, **bloqueado** (con dónde cambiarlo) o **aún no solicitado**.",
            "**Enviar una notificación de prueba** muestra una ahora mismo, para que vea la cosa en sí en lugar de fiarse de un aviso emergente.",
            "En iPhone y iPad, añada primero FieldQuo a la pantalla de inicio: Safari solo entrega notificaciones a las apps web instaladas.",
          ] },
          { tip: "Un permiso bloqueado no se deshace desde una página. Permita las notificaciones del sitio en la propia configuración del navegador y luego vuelva a activar el interruptor." },
        ],
      },
      {
        id: "who-can-see-it",
        heading: "Quién puede verlo",
        blocks: [
          { p: "Solo propietarios y administradores. Las tarjetas de toda la empresa escriben reglas que las rutas rechazan a cualquier otro, y la tarjeta del navegador se muestra en esta pantalla a las mismas personas; la fila se oculta a todos los demás niveles." },
        ],
      },
    ],
    faq: [
      { q: "¿Quién recibe los correos de presupuesto grande y factura pagada?", a: "Cada miembro con rol de propietario o administrador que tenga una dirección de correo. No hay baja por persona en esta pantalla." },
      { q: "Redacté un presupuesto de $15,000 y no llegó nada. ¿Por qué?", a: "La revisión del presupuesto grande se ejecuta una vez al día. Si el umbral está fijado y la casilla marcada, el correo llega en la próxima ejecución." },
      { q: "¿Puedo recibir un mensaje de texto en vez de un correo para estas alertas?", a: "No. Las alertas para usted son correo y, si lo activa, una notificación del navegador. Los mensajes de texto son para los clientes." },
    ],
  },

  "settings-email-domain": {
    title: "Dominio de correo",
    summary:
      "Envíe presupuestos, facturas y cualquier otro correo a clientes desde su propio dominio en lugar de la dirección compartida de FieldQuo — los registros DNS, los estados, la dirección del remitente y adónde van las respuestas.",
    updated: "2026-09-12",
    intro: [
      "**Configuración → Dominio de correo** es la promesa de marca blanca hecha literal para el correo. Hasta que lo configure, los correos a clientes salen desde la dirección compartida de FieldQuo con el nombre de su empresa. Una vez verificado su dominio, la línea De dice quotes@send.suempresa.com — su nombre, su dominio, sin «via fieldquo.com» al lado — y la entregabilidad mejora porque el correo va firmado como suyo.",
      "Nada de esto crea un buzón. Verificar el dominio es lo que concede el permiso para enviar como él; la dirección nunca necesita existir como bandeja de entrada. Las respuestas se manejan aparte, con el correo de empresa definido en Configuración de la empresa.",
    ],
    sections: [
      {
        id: "overview",
        heading: "Resumen",
        blocks: [
          { p: "Usted conecta un **subdominio** — send.suempresa.com en lugar de suempresa.com — para que este envío se mantenga separado de su correo cotidiano y no pueda interferir con su bandeja de entrada existente. FieldQuo lo registra con su proveedor de correo, le muestra los registros DNS que debe agregar y vuelve a comprobar por sí solo cada 30 segundos mientras el estado esté pendiente." },
          { p: "Cada correo que FieldQuo envía en su nombre usa el dominio verificado: presupuestos, facturas y recibos, reglas de seguimiento, solicitudes de reseña, facturas de planes de servicio, campañas de marketing. Desconectar devuelve todo a la dirección compartida; nada de lo ya enviado cambia." },
        ],
      },
      {
        id: "on-the-screen",
        heading: "Qué hay en la pantalla",
        blocks: [
          { bullets: [
            "La tarjeta de estado — su dominio (o **Ningún dominio conectado**), la frase **Los correos se enviarán desde …** o **Tus correos se envían actualmente desde la dirección compartida de FieldQuo, usando el nombre de tu empresa.**, y una insignia de estado. Una vez conectado: **Comprobar verificación** (hasta que se verifique) y **Desconectar**.",
            "**Conectar un dominio** — se muestra solo antes de conectar: una casilla y el botón **Conectar**.",
            "**Agrega estos registros DNS** — se muestra mientras la verificación está pendiente o falló: la guía de cinco pasos y cada registro con su Tipo, Nombre, Valor, Prioridad y TTL, cada valor con un botón de copiar.",
            "**Dirección del remitente** — se muestra una vez conectado: la parte antes de la @ (por defecto **quotes**) y **Guardar**.",
            "**Respuestas** — adónde va la respuesta de un cliente a un presupuesto o factura: el correo de su empresa, o **el correo del propietario de tu cuenta, porque no hay un correo de empresa configurado**.",
          ] },
        ],
      },
      {
        id: "connect-your-domain",
        heading: "Cómo conectar su dominio",
        blocks: [
          { steps: [
            "Abra **Configuración → Dominio de correo**.",
            "Bajo **Conectar un dominio**, escriba un subdominio como **send.suempresa.com** y pulse **Conectar**. El estado pasa a **Esperando el DNS** y aparecen los registros.",
            "Inicie sesión donde compró el dominio — GoDaddy, Namecheap, Cloudflare, Google Domains. Ese es su proveedor de DNS. Busque **DNS**, **Registros DNS** o **Administrar DNS**.",
            "Agregue un registro nuevo por cada bloque de la pantalla, respetando exactamente el Tipo, el Nombre y el Valor. Preste atención al campo Nombre: la mayoría de los proveedores agregan su dominio automáticamente, así que para send._domainkey.ejemplo.com normalmente solo ingresa send._domainkey. Pegue los valores sin comillas y sin saltos de línea.",
            "Guarde en su proveedor y déjelo. La mayoría de los proveedores aplican los cambios en una hora; algunos tardan hasta 24. Esta página vuelve a comprobar cada 30 segundos por sí sola; **Comprobar verificación** pregunta ahora mismo.",
            "Cuando la insignia diga **Verificado**, defina la **Dirección del remitente** si quiere algo distinto de quotes@, y pulse **Guardar**.",
          ] },
          { figure: "live:app-settings-email-domain", caption: "Configuración → Dominio de correo — el dominio con su insignia de estado, la tarjeta Dirección del remitente y adónde van las respuestas." },
          { warning: "Terminar con send._domainkey.ejemplo.com.ejemplo.com en el campo Nombre es el error más común. Si su proveedor muestra el nombre completo después de guardar, lo hizo bien." },
        ],
      },
      {
        id: "statuses",
        heading: "Los cuatro estados",
        blocks: [
          { table: {
            head: ["Insignia", "Significado", "Qué se envía desde su dominio"],
            rows: [
              ["**Sin configurar**", "Ningún dominio conectado.", "Nada — se usa la dirección compartida."],
              ["**Esperando el DNS**", "El dominio está registrado; los registros aún no se han visto.", "Nada todavía. La página sigue comprobando."],
              ["**Verificación fallida**", "El proveedor miró y los registros estaban mal o faltaban.", "Nada. Corrija los registros y pulse Comprobar verificación."],
              ["**Verificado**", "Los registros están en su lugar.", "Cada correo a clientes, de ahora en adelante."],
            ],
          } },
        ],
      },
      {
        id: "sender-and-replies",
        heading: "Dirección del remitente y respuestas",
        blocks: [
          { p: "La **Dirección del remitente** es la dirección que ven los clientes. No necesita ser un buzón real — quotes@, hola@, oficina@ funcionan todas — porque verificar el dominio es lo que permite a FieldQuo enviar como ella. Cámbiela y cada correo desde entonces lleva la nueva." },
          { p: "Las **Respuestas** son otra cosa. Cuando un cliente responde a un presupuesto o factura, la respuesta va al correo de su empresa; si no hay ninguno, recae en el correo del propietario de la cuenta para que una respuesta nunca se pierda en silencio. Cámbielo en [[settings-company|Configuración de la empresa]] — esta pantalla solo lo muestra, y le pide uno al llegar si falta." },
          { note: "El propio dominio de FieldQuo y sus subdominios se rechazan aquí. Un inquilino no puede verificar send.fieldquo.com y enviar como FieldQuo; use el dominio de su empresa." },
        ],
      },
      {
        id: "who-can-see-it",
        heading: "Quién puede verlo",
        blocks: [
          { p: "Propietarios, administradores y los niveles Despachador y Encargado — las mismas personas que pueden gestionar el equipo. Conectar, cambiar el remitente y desconectar necesitan ese acceso; la lectura también se permite a una sesión de soporte de solo lectura, porque «nuestros presupuestos no llegan» suele terminar aquí." },
        ],
      },
    ],
    faq: [
      { q: "¿Necesito crear quotes@send.miempresa.com como buzón?", a: "No. La dirección solo tiene que existir como remitente, y verificar el dominio es lo que lo permite. Las respuestas van al correo de su empresa de todos modos." },
      { q: "¿Puedo usar mi dominio raíz en vez de un subdominio?", a: "La pantalla pide un subdominio, y con razón: mantiene los registros de envío de FieldQuo separados de los que necesita su correo habitual." },
      { q: "¿Qué pasa con mis correos si desconecto?", a: "Vuelven de inmediato a la dirección compartida de FieldQuo con el nombre de su empresa. Nada de lo ya enviado se ve afectado, y puede volver a conectar más adelante." },
    ],
  },

  "settings-payments": {
    title: "Pagos",
    summary:
      "Conecte Stripe para que los clientes paguen en línea a su propia cuenta bancaria — los estados de la conexión, la tarjeta de comisiones, las transferencias instantáneas, el débito bancario, la financiación, las formas de pago fuera de línea impresas en las facturas y los datos de su cuenta de Stripe.",
    updated: "2026-09-12",
    intro: [
      "**Configuración → Pagos** es donde una empresa conecta Stripe. La cuenta de Stripe se abre a nombre de su empresa; el pago con tarjeta o desde el banco de un cliente es un cobro en esa cuenta, y Stripe le paga directamente a su banco. FieldQuo nunca ve ni almacena sus datos bancarios y nunca retiene el dinero.",
      "La pantalla muestra lo que Stripe mismo dice de su cuenta, no lo último que FieldQuo oyó, así que una insignia nunca está desactualizada. Alrededor de la conexión están las tarjetas que importan una vez que el dinero se mueve: las comisiones de procesamiento, las transferencias instantáneas, las formas de pago que acepta, la financiación y los identificadores que Stripe usa para su cuenta.",
    ],
    sections: [
      {
        id: "overview",
        heading: "Resumen",
        blocks: [
          { p: "Conectar lo lleva a la propia página alojada de Stripe para ingresar sus datos bancarios y su identidad; vuelve aquí cuando termina. Desde entonces cada factura que reciben sus clientes lleva un botón Pagar, y el pago se registra contra la factura en el momento en que Stripe lo confirma. Las comisiones, las transferencias, los reembolsos y las disputas son iguales para todas las empresas y se explican en [[payment-processing-fees-and-payouts|Comisiones de procesamiento de pagos y transferencias]]." },
        ],
      },
      {
        id: "on-the-screen",
        heading: "Qué hay en la pantalla",
        blocks: [
          { bullets: [
            "La tarjeta de conexión — uno de cuatro estados (abajo), con **Conectar con Stripe**, **Finalizar configuración**, **Ya lo hice**, **Comprobar de nuevo**, **Gestionar en Stripe** o **Desconectar** según el estado.",
            "**Comisiones de procesamiento** — las tarifas publicadas para cada método que Stripe cobra en su moneda, los dos recargos que solo aplican a algunas tarjetas, y un ejemplo calculado sobre un pago con tarjeta de $2,260.",
            "**Transferencia instantánea** — lo que está disponible ahora, la comisión, lo que recibirá, y **Transferir … ahora**; o la única razón por la que aún no puede ejecutarse.",
            "**Formas de pago que aceptas** — **Efectivo**, **Transferencia electrónica**, **Cheque**, y **Guardar**.",
            "**Su cuenta de Stripe** — solo propietario: el ID de la cuenta con **Copiar**, el correo de inicio de sesión, lo que Stripe tiene activado y lo que sigue esperando.",
            "**Ofrecer pago a plazos (Affirm)** — un interruptor, mostrado una vez que la conexión está activa — y la línea final que dice que FieldQuo nunca ve los datos de su cuenta bancaria.",
          ] },
        ],
      },
      {
        id: "connect-stripe",
        heading: "Cómo conectar Stripe",
        blocks: [
          { steps: [
            "Abra **Configuración → Pagos** y pulse **Conectar con Stripe**. La página de Stripe pide los datos de su negocio, su identidad y la cuenta bancaria donde pagarle.",
            "Vuelva a FieldQuo. Si Stripe todavía necesita algo, la tarjeta lista exactamente qué bajo **Stripe todavía necesita algunas cosas**; pulse **Finalizar configuración** para volver a la página de Stripe.",
            "Si completó todo del lado de Stripe y la página no se ha puesto al día, pulse **Ya lo hice** — le pregunta a Stripe directamente.",
            "Cuando la tarjeta diga **Stripe conectado · Activo**, los clientes pueden pagar. No hace falta activar nada más.",
          ] },
          { figure: "live:app-settings-payments", caption: "Configuración → Pagos — la cuenta conectada, la tarjeta Comisiones de procesamiento y las formas de pago que acepta." },
          { note: "**Desconectar** solo desvincula Stripe de FieldQuo. No elimina ni cierra su cuenta de Stripe, y nada de sus transferencias pasadas cambia — pero los clientes no pueden pagar en línea hasta que vuelva a conectar. Guía completa: [[connect-stripe-and-get-verified|Conectar Stripe y verificar su cuenta]]." },
        ],
      },
      {
        id: "connection-states",
        heading: "Los cuatro estados de la conexión",
        blocks: [
          { table: {
            head: ["La tarjeta dice", "Qué significa", "Qué hacer"],
            rows: [
              ["**Aún no conectado**", "No existe ninguna cuenta de Stripe para su empresa.", "Pulse Conectar con Stripe."],
              ["**Stripe todavía necesita algunas cosas**", "La cuenta existe pero los cobros están desactivados; los puntos pendientes se listan, con el propio motivo de Stripe cuando lo da.", "Finalizar configuración, o Ya lo hice si ya lo hizo."],
              ["**Stripe está revisando tus datos**", "Todo se envió y Stripe lo está verificando — minutos, a veces uno o dos días.", "Nada. Compruebe de nuevo más tarde."],
              ["**Stripe conectado · Activo**", "Los cobros están activados. Si las transferencias están en pausa, la tarjeta lo dice — Stripe está reteniendo su dinero, o revisando su cuenta — con el motivo.", "Gestionar en Stripe si Stripe está esperando algo."],
            ],
          } },
        ],
      },
      {
        id: "how-clients-pay",
        heading: "Cómo pueden pagar los clientes, y qué acepta usted",
        blocks: [
          { p: "Las tarjetas funcionan en todas partes, al **3% + $0.30**. El débito bancario aparece como segundo botón en el portal del cliente — en una factura, en una solicitud de anticipo y en cada cuota de un calendario de pagos — una vez que Stripe ha activado esa capacidad en su cuenta: débito preautorizado para una empresa que factura en dólares canadienses (**1% + $0.40, con tope de $5.00**), ACH para una que factura en dólares estadounidenses. La tarjeta **Comisiones de procesamiento** dice cuál aplica ahora mismo: **Los clientes pueden pagar las facturas con tarjeta o desde una cuenta bancaria (…)**, o que el pago bancario se ofrecerá cuando Stripe active la capacidad — no tiene que hacer nada." },
          { bullets: [
            "Un débito bancario tarda **de 3 a 5 días hábiles** en compensarse. La factura muestra **Pago bancario pendiente** con la fecha en que se envió y se marca pagada solo cuando llega el dinero; si el banco lo devuelve, el saldo sigue adeudado y el cliente puede volver a pagar con tarjeta.",
            "**Formas de pago que aceptas** es para dinero que nunca pasa por Stripe: marque **Efectivo**, **Transferencia electrónica** y **Cheque** según los reciba, pulse **Guardar**, y se imprimen en una línea «Formas de pago aceptadas» en el correo de la factura, en el portal del cliente y en el PDF de la factura. Si no marca ninguna, la línea se omite.",
            "**Ofrecer pago a plazos (Affirm)** permite que un cliente divida una factura de entre $50 y $30,000, en USD o CAD, al pagar; usted cobra igualmente el total por adelantado. Active Affirm primero en su panel de Stripe — el interruptor se guarda de inmediato, y se revierte si no puede.",
          ] },
          { note: "Las comisiones de tarjeta y de débito bancario no son ajustes — nadie puede cambiarlas, y no se pueden trasladar al cliente como una línea de recargo. El débito bancario en Canadá, en detalle: [[bank-debit-in-canada|Débito bancario en Canadá]]." },
        ],
      },
      {
        id: "your-stripe-account",
        heading: "Transferencias instantáneas y su cuenta de Stripe",
        blocks: [
          { p: "La **Transferencia instantánea** pasa su saldo disponible a una tarjeta de débito en unos 30 minutos por el **1%** del importe — lo que cobra Stripe, trasladado al costo. Necesita una cuenta activa con al menos **30 días** de antigüedad, con transferencias habilitadas y una tarjeta de débito registrada; la tarjeta explica cuál de esas condiciones falta y ofrece **Añadir una tarjeta de débito en Stripe**. Las transferencias estándar siguen siendo gratuitas y llegan en unos 2 días hábiles. Vea [[instant-payouts|Transferencias instantáneas]]." },
          { p: "**Su cuenta de Stripe** muestra al propietario las cuatro cosas que Stripe usa para identificar la cuenta: el **ID de cuenta de Stripe** (empieza por acct_ — no es el nombre de su negocio ni su correo), el **Correo de inicio de sesión** al que Stripe envía su código de acceso, los dos interruptores **Cobro con tarjeta** y **Transferencias a su banco** (las tarjetas pueden seguir funcionando mientras las transferencias están en pausa — ese dinero lo retiene Stripe, no se pierde), y **Lo que Stripe sigue esperando**, con la fecha límite de Stripe cuando la dio. Casi todo se resuelve en su propio panel de Stripe mediante **Gestionar en Stripe**; si de verdad no se puede, al soporte de Stripe se llega desde ese panel, y el ID de cuenta es lo que lo identifica ante ellos." },
        ],
      },
      {
        id: "who-can-see-it",
        heading: "Quién puede verlo",
        blocks: [
          { p: "Solo propietarios y administradores — es el procesamiento de pagos de la empresa, con botones Gestionar en Stripe y Desconectar reales, así que se oculta a todos los demás niveles en vez de mostrarse de solo lectura. La tarjeta **Su cuenta de Stripe** va un paso más allá y se muestra únicamente al propietario." },
        ],
      },
    ],
    faq: [
      { q: "¿FieldQuo retiene mi dinero?", a: "Nunca. El cobro se crea en su propia cuenta de Stripe y Stripe le paga directamente a su banco. FieldQuo nunca ve ni almacena sus datos bancarios." },
      { q: "Los clientes pueden pagar con tarjeta — ¿por qué no desde una cuenta bancaria?", a: "Stripe activa el débito bancario según su propio calendario y puede pedir más información. La tarjeta Comisiones de procesamiento lo dice en cuanto está activo; hasta entonces solo se muestra el botón de tarjeta, y no hay nada que configurar de su parte." },
      { q: "Los pagos dicen Pagada pero nada ha llegado a mi banco.", a: "La tarjeta de conexión, y la tarjeta Su cuenta de Stripe, dicen si las transferencias están en pausa y por qué. Normalmente Stripe todavía necesita un documento o está revisando uno — vea Transferencias retenidas o en revisión." },
      { q: "¿Dónde activo los cheques para que la factura diga que los aceptamos?", a: "Bajo Formas de pago que aceptas, en esta pantalla. Marque Cheque y pulse Guardar; el correo de la factura, el portal y el PDF lo imprimen en la línea de formas aceptadas." },
    ],
  },

  "settings-meta-ads": {
    title: "Meta Ads",
    summary:
      "Conecte su propia cuenta publicitaria de Meta para que el gasto en anuncios fluya a sus números de marketing, más los formularios de clientes potenciales de Facebook, la publicación en Facebook e Instagram y las conexiones de WhatsApp Business que viven en la misma pantalla.",
    updated: "2026-09-12",
    intro: [
      "**Configuración → Meta Ads** es donde una empresa conecta su propia cuenta publicitaria de Meta (Facebook/Instagram). FieldQuo solo lee el gasto y el rendimiento de las campañas — nunca crea ni modifica un anuncio — y las filas que importa se convierten en gasto de marketing, para que su costo por cliente potencial incluya lo que le pagó a Meta. Otras tres conexiones de Meta están en la misma pantalla porque todas son «una cuenta de Meta que esta empresa conecta»: los formularios de clientes potenciales de Facebook, la publicación en Facebook e Instagram, y WhatsApp Business.",
    ],
    sections: [
      {
        id: "overview",
        heading: "Resumen",
        blocks: [
          { p: "La tarjeta de conexión tiene cuatro estados honestos. Si la instalación no tiene credenciales de la app de Meta, o no puede guardar un token de forma segura, la tarjeta lo dice con palabras y no ofrece ningún botón — es un ajuste del servidor, no algo de su cuenta. De lo contrario ve **Conectar Meta Ads**, y una vez conectada: cuándo se sincronizó por última vez, **Sincronizar ahora**, **Ver tus campañas →**, **Volver a conectar** si Meta dice que el token venció, y **Desconectar**." },
          { note: "El costo por cliente potencial por campaña cubre los que llegaron a través de un formulario de Meta. Todos los demás canales — y un propietario que vio el anuncio y llamó — siguen mezclados en el total, porque nada vincula ese gasto con ese cliente potencial. Vea [[marketing-spend|Gasto en marketing]]." },
        ],
      },
      {
        id: "on-the-screen",
        heading: "Qué hay en la pantalla",
        blocks: [
          { bullets: [
            "**Meta Ads — Conecta tu propia cuenta publicitaria de Meta (Facebook/Instagram) para traer el gasto y el rendimiento de las campañas a tus números de marketing.**",
            "La tarjeta de conexión — **Sin conectar** con **Conectar Meta Ads**, o la cuenta conectada con **Última sincronización el …**, **Sincronizar ahora**, **Ver tus campañas →** y **Desconectar**. Tras una sincronización: **… filas nuevas, … actualizadas**, más cualquier error, posibles duplicados o una discrepancia de moneda.",
            "**Formularios de clientes potenciales de Facebook** — los formularios encontrados en sus Páginas, cada uno con un interruptor **Activado** / **Desactivado**, su cuenta de clientes potenciales y el último recibido, **Buscar mis formularios**, y **De qué campañas vienen estos clientes potenciales**.",
            "**Publicación en Facebook e Instagram** y **WhatsApp Business** — sus propias tarjetas de conexión, cada una de las cuales dice con claridad cuándo su permiso aún no está aprobado y no ofrece ningún botón en ese caso.",
          ] },
        ],
      },
      {
        id: "connect",
        heading: "Cómo conectar su cuenta publicitaria",
        blocks: [
          { steps: [
            "Abra **Configuración → Meta Ads** y pulse **Conectar Meta Ads**. Se le envía a Meta para iniciar sesión y aprobar el acceso de lectura.",
            "Si su inicio de sesión tiene más de una cuenta publicitaria, la tarjeta pregunta **¿Qué cuenta publicitaria?** — elija una y pulse **Conectar esta cuenta**.",
            "De vuelta en la pantalla, pulse **Sincronizar ahora**. La primera sincronización importa los últimos 30 días de gasto diario por campaña.",
            "Pulse **Ver tus campañas →** para leer las filas en Marketing → Gasto, donde se marcan como importadas desde Meta.",
            "Si la tarjeta alguna vez dice que el token ya no es válido, pulse **Volver a conectar** — nada más cambia.",
          ] },
          { figure: "live:app-settings-meta-ads", caption: "Configuración → Meta Ads — la cuenta publicitaria conectada con Sincronizar ahora, el panel Formularios de clientes potenciales de Facebook, y las tarjetas de publicación y WhatsApp." },
          { note: "**Desconectar** detiene las sincronizaciones futuras. Las filas ya importadas se quedan en su historial de gasto en marketing; no se elimina nada." },
        ],
      },
      {
        id: "sync",
        heading: "Qué hace una sincronización",
        blocks: [
          { p: "Una sincronización le pide a Meta el gasto de cada campaña por día dentro de la ventana (30 días por defecto, como máximo 90 a la vez) y escribe una fila de gasto de marketing por campaña y por día, actualizando las filas que ya escribió en lugar de duplicarlas. El resumen tras una sincronización le dice cuántas filas fueron nuevas y cuántas se actualizaron. Las sincronizaciones son manuales — no hay importación nocturna — así que pulse **Sincronizar ahora** cuando quiera números al día." },
          { bullets: [
            "Las filas en una moneda distinta a la de su empresa se convierten a un tipo de cambio fijado y se marcan como ≈ aproximadas.",
            "Un posible duplicado — una fila de gasto ingresada a mano el mismo día y en el mismo canal — se cuenta y se muestra, nunca se fusiona en silencio.",
            "Los errores de Meta se muestran en la tarjeta con el propio mensaje de Meta.",
          ] },
        ],
      },
      {
        id: "the-other-three",
        heading: "Formularios, publicación y WhatsApp",
        blocks: [
          { p: "**Formularios de clientes potenciales de Facebook** convierte un formulario adjunto a uno de sus anuncios en un cliente potencial en Prospectos — puntuado como cualquier otra consulta, avisando a las mismas personas, con sus reglas de seguimiento aplicadas. Usa el mismo inicio de sesión de Meta que la cuenta publicitaria. Hasta que Meta apruebe un permiso más para FieldQuo, el panel dice **Los formularios de clientes potenciales de Facebook necesitan que Meta apruebe un permiso más; todavía no se está recibiendo nada.** y cada interruptor está desactivado con ese motivo — mostrado, no oculto, para que sepa que los clientes potenciales no están llegando y que no es su culpa. Vea [[facebook-lead-forms|Formularios de clientes potenciales de Facebook]]." },
          { p: "**Publicación en Facebook e Instagram** publica un diseño del Diseñador de marketing directamente en su propia Página y cuenta de Instagram. **WhatsApp Business** atiende su propio número de WhatsApp en Mensajes junto a las conversaciones de Facebook e Instagram, con la regla de las 24 horas explicada en la tarjeta. Ambas muestran un botón Conectar solo cuando su permiso está aprobado. Vea [[connect-your-facebook-page-and-instagram|Conectar su Página de Facebook e Instagram]] y [[whatsapp-business|WhatsApp Business]]." },
        ],
      },
      {
        id: "who-can-see-it",
        heading: "Quién puede verlo",
        blocks: [
          { p: "Solo propietarios y administradores. Está en el mismo estante que Pagos — la cuenta externa propia de una empresa con controles Desconectar reales — y cada ruta detrás de ella rechaza a cualquier otro, así que la fila se oculta a los demás niveles." },
        ],
      },
    ],
    faq: [
      { q: "¿Puede FieldQuo crear o editar mis anuncios?", a: "No. La conexión es de solo lectura: el gasto y el rendimiento entran, nada sale." },
      { q: "¿El gasto se importa solo?", a: "No. Pulse Sincronizar ahora. Cada sincronización cubre los últimos 30 días por defecto y actualiza las filas que ya escribió." },
      { q: "Ya conecté, ¿por qué los formularios siguen desactivados?", a: "El permiso de formularios aún no está aprobado para la app de Meta de FieldQuo. El panel lo dice y mantiene los interruptores desactivados hasta que lo esté." },
    ],
  },

  "settings-expense-tracking": {
    title: "Control de gastos",
    summary:
      "La misma pantalla de Seguimiento de gastos que Gastos en la barra lateral principal — las tarjetas del mes, el desglose del gasto, la tendencia, los recibos recientes y la exportación contable — a la que se llega desde Configuración.",
    updated: "2026-09-12",
    intro: [
      "**Configuración → Control de gastos** abre exactamente la misma página que **Gastos** en la barra lateral principal. Está listada en Configuración porque los números de ritmo de gasto que contiene — salarios, gastos generales, deuda — son tanto ajustes de la empresa como un informe. Todo lo relativo a la página en sí está en [[expense-tracking-and-burn-rate|Seguimiento de gastos y su ritmo de gasto]]; este artículo solo dice qué hay en ella y quién la ve.",
    ],
    sections: [
      {
        id: "overview",
        heading: "Resumen",
        blocks: [
          { p: "**Seguimiento de gastos — A dónde va tu dinero — por trabajo, gastos generales y categoría — más tu ritmo de gasto mensual.** La página va un mes a la vez, con **Agregar gasto** e **Importar desde un CSV del banco** arriba, cuatro tarjetas, un resumen de IA del mes, el desglose y la tendencia, los recibos recientes, y la **Exportación contable** al final." },
          { figure: "live:app-settings-expense-tracking", caption: "Seguimiento de gastos — las cuatro tarjetas del mes, el Desglose del gasto mensual y, al final, la Exportación contable." },
        ],
      },
      {
        id: "on-the-screen",
        heading: "Qué hay en la pantalla",
        blocks: [
          { bullets: [
            "Cuatro tarjetas: **Gastos registrados este mes**, **Ritmo de gasto mensual** (gastos generales + salarios + deuda), **Autonomía**, y **Gasto relacionado con trabajos**, dividido en gastos generales y general.",
            "**Resumen de IA** — una lectura escrita del mes que usted genera bajo demanda.",
            "**Desglose del gasto mensual** con **Gestionar salarios y deuda**, **Gasto por categoría**, y la **Tendencia de 6 meses**.",
            "**Gastos recientes** — cada recibo con su fecha, categoría, monto, el trabajo al que está vinculado, y eliminar.",
            "**Exportación contable** — un rango de fechas y una descarga de archivos CSV para su contador. Vea [[the-accounting-export|La exportación contable]] e [[import-expenses-from-a-bank-csv|Importar gastos desde un CSV del banco]].",
          ] },
        ],
      },
      {
        id: "who-can-see-it",
        heading: "Quién puede verlo",
        blocks: [
          { p: "La fila aparece para cualquiera cuya cuadrícula de acceso le dé a **gastos** el nivel que cubre los gastos de todos — el nivel Encargado y superiores, y cualquier Acceso personalizado configurado así. Una persona que solo puede registrar sus propios recibos no ve esta fila; registrar su propio gasto sigue funcionando desde las pantallas de gastos que le muestra la barra lateral principal." },
          { tip: "Los salarios y la deuda alimentan el ritmo de gasto pero se editan en sus propias pantallas — pulse **Gestionar salarios y deuda** en lugar de buscarlos aquí." },
        ],
      },
    ],
    faq: [
      { q: "¿Es distinto de Gastos en la barra lateral principal?", a: "No. Misma página, dos puertas. Ambos menús aplican la misma regla de acceso, así que si ve uno, ve el otro." },
      { q: "¿Por qué veo un formulario de gasto pero no esta fila?", a: "Registrar su propio recibo solo exige sus propios gastos. Esta fila consolida el gasto de toda la empresa, lo que exige el nivel de gastos superior." },
    ],
  },

  "settings-ai-credit": {
    title: "Crédito de IA",
    summary:
      "Los dos saldos prepagados que miden el recepcionista telefónico, los mensajes a la cuadrilla, la generación de imágenes con IA y la lectura profunda de fotos — lo que cuesta cada cosa, cómo recargar y el plan mensual de crédito de IA.",
    updated: "2026-09-12",
    intro: [
      "**Configuración → Crédito de IA** muestra todo lo que gasta crédito, en un solo lugar. Dos saldos, separados a propósito: el **Crédito telefónico**, que consumen el recepcionista telefónico y los mensajes a la cuadrilla, y el **Crédito de imágenes con IA**, que consumen la generación de imágenes y la lectura profunda de fotos de pago en un presupuesto. Preguntarle a FieldQuo AI sobre su propio negocio está incluido en todos los planes y no gasta ninguno de los dos.",
    ],
    sections: [
      {
        id: "overview",
        heading: "Resumen",
        blocks: [
          { p: "Cada saldo es una tarjeta con el monto, un estado de cuenta **En qué se fue el crédito** que puede desplegar, y cómo añadir más. La tarjeta telefónica enlaza a la página de configuración del teléfono, donde ya viven la compra, la recarga automática y el estado de cuenta completo; la tarjeta de IA vende recargas directamente y, debajo, un **Plan de crédito de IA** mensual a un precio por crédito más bajo." },
          { p: "El crédito se compra en dólares estadounidenses sea cual sea la moneda de su plan, porque es la moneda en que se compra la IA. Una recarga única funciona para todas las empresas; el plan mensual solo se ofrece a una empresa cuya suscripción a FieldQuo se factura en USD, y la pantalla dice por qué cuando no es así." },
        ],
      },
      {
        id: "on-the-screen",
        heading: "Qué hay en la pantalla",
        blocks: [
          { bullets: [
            "**Crédito telefónico** — **Saldo:** con **quedando poco** cuando corresponde, la tarifa por minuto del recepcionista en la nota de la tarjeta, el aviso de que los mensajes a la cuadrilla usan este mismo saldo, **Agregar crédito telefónico**, y **En qué se fue el crédito**.",
            "**Crédito de imágenes con IA** — **Saldo:** con **(unas … imágenes, o … lecturas profundas)**, la fila **Agregar crédito** de montos de recarga, cada uno con el número de imágenes que compra, y **En qué se fue el crédito**.",
            "**Plan de crédito de IA — paga al mes y ahorra por crédito** — tres planes con **… créditos — unas … imágenes** y **Suscribirse**; o, una vez en uno, **Estás en el plan … — … créditos por …/mes**, **Se renueva el …** y **Cancelar plan**.",
          ] },
        ],
      },
      {
        id: "add-credit",
        heading: "Cómo añadir crédito",
        blocks: [
          { steps: [
            "Abra **Configuración → Crédito de IA**.",
            "Para imágenes y lecturas profundas, pulse uno de los montos bajo **Agregar crédito** — $10, $30, $50 o $100. Paga en la página de pago de Stripe y vuelve; la tarjeta dice **Pago recibido — se agregaron … de crédito de IA.**",
            "Para minutos de teléfono y mensajes a la cuadrilla, pulse **Agregar crédito telefónico**; abre la página de configuración del teléfono, donde viven las recargas y la recarga automática. Vea [[settings-phone-receptionist|Recepcionista telefónico]].",
            "Para pagar al mes en su lugar, elija un plan y pulse **Suscribirse**. El crédito del primer mes cae en el saldo de inmediato.",
          ] },
          { figure: "live:app-settings-ai-credit", caption: "Configuración → Crédito de IA — los saldos Crédito telefónico y Crédito de imágenes con IA con sus recargas, y la tarjeta del plan mensual." },
          { note: "Si la tarjeta dice **Todavía no pudimos confirmar ese pago**, el dinero pasó y el crédito llega por su cuenta en un minuto o dos. No se cobra nada dos veces — actualice para comprobarlo." },
        ],
      },
      {
        id: "what-things-cost",
        heading: "Qué cuesta cada cosa",
        blocks: [
          { table: {
            head: ["Acción", "Saldo", "Costo"],
            rows: [
              ["Una imagen de marketing generada", "Crédito de imágenes con IA", "12¢ cada una"],
              ["Una lectura profunda de fotos en un presupuesto", "Crédito de imágenes con IA", "25¢ por lectura, hasta 8 fotos"],
              ["Un minuto del recepcionista telefónico", "Crédito telefónico", "la tarifa por minuto impresa en la tarjeta"],
              ["Mensajes a la cuadrilla", "Crédito telefónico", "el mismo saldo que las llamadas"],
            ],
          } },
        ],
      },
      {
        id: "the-monthly-plan",
        heading: "El plan mensual",
        blocks: [
          { p: "El plan es una asignación recurrente sobre el mismo saldo de imágenes con IA, a un precio por crédito más bajo que comprando sobre la marcha. Un crédito es un centavo de valor a precio por uso: una imagen son 12 créditos, una lectura profunda 25. Se ofrecen tres tamaños: **starter** ($30 por 4,000 créditos), **busy** ($50 por 7,000) y **agency** ($80 por 11,500)." },
          { bullets: [
            "El crédito se acumula. Lo que no use este mes sigue ahí el mes que viene — nada vence.",
            "**Cancelar plan** detiene el cobro del mes siguiente y el crédito del mes siguiente. El crédito que ya está en su saldo se queda; nunca se retira.",
            "El plan se renueva en la fecha mostrada bajo **Se renueva el**, y el crédito se agrega cuando el pago se procesa con éxito.",
          ] },
          { warning: "Los planes se facturan en dólares estadounidenses. Una empresa cuya suscripción a FieldQuo se factura en otra moneda no puede añadir uno — Stripe no puede llevar ambos en una misma cuenta — y el botón Suscribirse está desactivado con ese motivo. Las recargas únicas siguen funcionando." },
        ],
      },
      {
        id: "who-can-see-it",
        heading: "Quién puede verlo",
        blocks: [
          { p: "Propietarios, administradores y los niveles Despachador y Encargado — la misma barrera que la fila del crédito telefónico, porque es el dinero de la empresa. Las recargas y los planes también necesitan ese acceso. Vea también [[ai-credit-and-phone-credit|Crédito de IA y crédito telefónico]] en Facturación." },
        ],
      },
    ],
    faq: [
      { q: "¿Preguntarle algo a FieldQuo AI cuesta crédito?", a: "No. FieldQuo AI y el copiloto de presupuestos están incluidos en todos los planes. El crédito mide solo los minutos de teléfono, los mensajes a la cuadrilla, la generación de imágenes y la lectura profunda de fotos." },
      { q: "¿Por qué hay dos saldos?", a: "El proveedor telefónico cobra un mínimo mensual y el proveedor de IA cobra solo por uso, así que los dos se miden por separado y nunca se fusionan. Comprar uno no financia el otro." },
      { q: "¿El crédito vence?", a: "No. Tanto las recargas como el crédito del plan se quedan en el saldo hasta que se gastan, y cancelar un plan nunca retira crédito ya otorgado." },
    ],
  },

  "settings-payroll": {
    title: "Configuración de nómina",
    summary:
      "Cuándo paga — frecuencia, día de cierre, día de pago — y las deducciones y asignaciones que convierten el salario bruto en neto: puntos de partida regionales, sus propios componentes, tramos fiscales.",
    updated: "2026-09-12",
    intro: [
      "**Configuración → Nómina** es aquello a partir de lo cual calcula un proceso de pago. La tarjeta superior, **Cuándo pagas**, fija la cadencia: con qué frecuencia, el día en que cierra el periodo, el día de pago. Debajo están los componentes — deducciones como el impuesto sobre la renta, el CPP o el EI, y asignaciones o ingresos como una asignación de herramientas — cada uno un monto fijo, un porcentaje del bruto o tramos progresivos. Hasta que se configure algo aquí, los procesos de pago muestran solo el salario bruto, y lo dicen.",
    ],
    sections: [
      {
        id: "overview",
        heading: "Resumen",
        blocks: [
          { p: "FieldQuo hace la aritmética con las tasas que guarda aquí. No presenta ni remite nada, y no actualiza las tasas cuando cambian — las plantillas regionales son cifras publicadas para el año indicado, ofrecidas como punto de partida, y se convierten en sus cifras en el momento en que las carga. Revíselas cada año fiscal con su contador." },
          { note: "FieldQuo calcula el salario bruto, produce los recibos de pago y exporta el proceso. No paga a los empleados ni presenta sus impuestos de nómina — las deducciones son las que usted o su contador proporcionan. Procesar la nómina en sí está en [[payroll-runs|Procesos de nómina]]." },
        ],
      },
      {
        id: "on-the-screen",
        heading: "Qué hay en la pantalla",
        blocks: [
          { bullets: [
            "**Cuándo pagas** — **Con qué frecuencia** (Cada semana, Cada 2 semanas, Dos veces al mes, Una vez al mes), **El periodo cierra**, **Día de pago**, los días para aprobar horas, luego **Periodo actual** y **Último periodo cerrado** con sus fechas. **Lo define un propietario o administrador.**",
            "**Empezar desde tu región** — Canadá, Estados Unidos o Reino Unido, cada uno con **… componentes · cifras de …** para el año, y la frase de que son cifras publicadas que debe confirmar con su contador.",
            "**Deducciones** y **Asignaciones e ingresos** — cada componente con **legal** donde corresponde, su regla (**… % del bruto**, **… tramos progresivos**, o un monto), **todos** o **asignado individualmente**, y **Desactivar** / **Activar** y quitar.",
            "**Agregar un componente** — el formulario para uno nuevo: nombre, Deducción o Asignación / ingreso, Monto fijo / Porcentaje del bruto / Tramos progresivos, y **Aplicar a todos automáticamente**.",
          ] },
        ],
      },
      {
        id: "set-up",
        heading: "Cómo configurarlo",
        blocks: [
          { steps: [
            "Abra **Configuración → Nómina** y complete **Cuándo pagas**. Cada semana o cada 2 semanas se alinea con semanas enteras; dos veces al mes y mensual son periodos de calendario, y la tarjeta advierte que las horas extra semanales se calculan entonces sobre las semanas parciales dentro de cada periodo.",
            "Pulse su región bajo **Empezar desde tu región** para cargar las deducciones legales habituales — tramos federales, CPP/EI o sus equivalentes. Los componentes que ya tiene se dejan como están.",
            "Abra cada componente cargado, compare las cifras con las de su contador y corríjalas. Ahora son suyas; FieldQuo no las cambiará después.",
            "Pulse **Agregar un componente** para cualquier otra cosa — cuotas sindicales, una asignación de herramientas — eligiendo cómo se calcula y si se aplica a todos automáticamente.",
            "**Desactivar** un componente para conservarlo sin aplicarlo; quítelo solo si no lo quiere nunca más. Los recibos de pago anteriores conservan lo ya deducido en ambos casos.",
          ] },
          { figure: "live:app-settings-payroll", caption: "Configuración → Nómina — Cuándo pagas, los puntos de partida regionales, y los componentes de deducciones e ingresos." },
          { warning: "El impuesto sobre la renta provincial y estatal, las contribuciones del empleador y las reglas finas (CPP2, exenciones, reducción gradual de asignaciones) quedan deliberadamente fuera de las plantillas. Un conjunto a medio llenar parece completo y retiene de menos. Pida a su contador que agregue lo que su región necesita." },
        ],
      },
      {
        id: "component-types",
        heading: "Las tres formas de calcular un componente",
        blocks: [
          { table: {
            head: ["Cálculo", "Qué ingresa", "Uso típico"],
            rows: [
              ["**Monto fijo**", "un monto por periodo de pago", "cuotas sindicales, una asignación de herramientas"],
              ["**Porcentaje del bruto**", "un porcentaje", "CPP al 5.95%, EI"],
              ["**Tramos progresivos**", "umbrales anuales, del más bajo al más alto — deje en blanco el último «hasta» para «y más» — y un porcentaje para cada uno", "tramos del impuesto sobre la renta"],
            ],
          } },
        ],
      },
      {
        id: "what-each-control-changes",
        heading: "Qué cambia cada control",
        blocks: [
          { bullets: [
            "**Cuándo pagas** decide qué horas caen en qué proceso y el día de pago impreso en cada recibo. Cambiarlo cambia el próximo periodo, nunca uno ya cerrado.",
            "**Aplicar a todos automáticamente** pone el componente en el recibo de cada persona; desactivado, se asigna por persona desde su configuración de pago.",
            "**Desactivar** conserva el componente y sus cifras pero lo omite en el próximo proceso; **Activar** lo devuelve.",
            "Quitar elimina el componente solo de los procesos futuros — los recibos anteriores conservan lo ya deducido.",
          ] },
        ],
      },
      {
        id: "who-can-see-it",
        heading: "Quién puede verlo",
        blocks: [
          { p: "Solo propietarios y administradores. La ruta responde con un rechazo a todos los demás — un Encargado lleva el día a día pero nunca ve tasas de deducción ni tramos fiscales — así que la fila se oculta a todos los demás niveles." },
        ],
      },
    ],
    faq: [
      { q: "¿FieldQuo actualizará las tasas de impuestos el año que viene?", a: "No. Las cifras cargadas se convierten en suyas en el momento en que las carga y nunca se cambian después. Revíselas cada año fiscal con su contador." },
      { q: "¿Puedo pagarle a una persona de forma distinta?", a: "Sí. Desmarque Aplicar a todos automáticamente en el componente y asígnelo por persona desde su configuración de pago." },
      { q: "¿Qué pasa con los recibos antiguos si quito una deducción?", a: "Nada. Los recibos anteriores conservan lo ya deducido; solo los procesos futuros dejan de aplicarla." },
    ],
  },

  "settings-website": {
    title: "Tu sitio web",
    summary:
      "El creador de sitios web — un brief con sus palabras, una conversación para afinarlo, cinco diseños y un conjunto de estilos, Ajustar para la dirección, los idiomas y las fotos, y Publicar.",
    updated: "2026-09-12",
    intro: [
      "**Configuración → Tu sitio web** crea y edita el sitio web público que FieldQuo aloja para su empresa en sunombre.fieldquo.com. Usted describe cómo debería verse y sentirse; FieldQuo escribe las frases. El diseño, los servicios, los testimonios, su logo, colores, horarios y datos de contacto vienen todos de lo que el registro de la empresa ya guarda, así que el sitio nunca se inventa y nunca le pide que los escriba de nuevo.",
    ],
    sections: [
      {
        id: "overview",
        heading: "Resumen",
        blocks: [
          { p: "La primera vez es una casilla grande — **¿Qué debería decir tu sitio web?** — con fichas de ejemplo y **Crear mi sitio**. Después de eso la pantalla es una conversación a la izquierda y el sitio en vivo a la derecha: escriba «Hazlo más atrevido», «empieza con reseñas», «página más corta» y la página se reconstruye. Nada es público hasta que lo publique." },
          { p: "El modelo escribe solo palabras. Nunca elige un diseño libremente, inventa un servicio ni emite una regla de estilo; las listas de bloques, los nombres de servicios y los testimonios vienen de la base de datos y se vuelven a integrar después de la generación. Si no se puede alcanzar al asistente de redacción, el sitio se construye solo a partir de sus datos guardados y el hilo dice que el texto es más sencillo de lo habitual — nunca una página rota." },
        ],
      },
      {
        id: "on-the-screen",
        heading: "Qué hay en la pantalla",
        blocks: [
          { bullets: [
            "La cabecera — la dirección de su sitio con una insignia **En vivo** una vez publicado, **Abrir**, **Guardar**, y **Publicar** o **Actualizar**; **Despublicar** una vez en vivo.",
            "El panel de conversación — lo que pidió, lo que se construyó (**Sitio reconstruido: …**), y lo que todavía falta, como mensajes con acciones de un toque como **Agregar mis fotos** y **Emparejarlas**.",
            "**Diseño** y **Estilo** — dos filas de fichas bajo la conversación. Aplicar una es instantáneo, conserva sus fotos y textos, y no gasta IA.",
            "La casilla de instrucciones — **Hazlo más atrevido · empieza con reseñas · página más corta…** — y **Ajustar**, que abre **Dirección web**, **Idiomas**, **Pares de antes y después** y la inserción de reseñas.",
            "El panel derecho — **Vista previa** (escritorio o móvil, la página real en un marco) o **Secciones**, donde reescribe a mano cualquier título o párrafo.",
          ] },
        ],
      },
      {
        id: "build",
        heading: "Cómo crear y editar su sitio",
        blocks: [
          { steps: [
            "Abra **Configuración → Tu sitio web**, describa el aspecto que quiere en la casilla — o toque una ficha de ejemplo — y pulse **Crear mi sitio**.",
            "Lea el hilo. Cuando pida lo que falta — fotos, un par de antes y después, una reseña, horarios — use la acción que ofrece o responda en la casilla.",
            "Escriba un cambio y pulse enviar. Cada mensaje reconstruye la página; la vista previa se actualiza sola.",
            "Pruebe una ficha de **Diseño** o de **Estilo**. Sus fotos y textos se conservan; edite lo que quiera y luego **Guardar**.",
            "Pulse **Publicar**. El sitio queda en vivo en su dirección; desde entonces el botón dice **Actualizar**.",
          ] },
          { figure: "live:app-settings-website", caption: "Configuración → Tu sitio web — la conversación y las fichas de Diseño / Estilo a la izquierda, la vista previa en vivo a la derecha." },
          { note: "Reconstruir después de haber editado texto a mano pregunta primero: **Esto reescribirá las palabras que editaste**. Las fotos, los pares de antes y después, el logo y los colores se conservan; los títulos y párrafos que usted escribió se reemplazan. Elija **Conservar lo que escribí** o **Reconstruir de todos modos**." },
        ],
      },
      {
        id: "layouts-and-styles",
        heading: "Diseños y estilos",
        blocks: [
          { p: "Un diseño es el orden y la elección de las secciones; un estilo es la tipografía, el tratamiento del color y el espaciado. Cinco diseños por los estilos ofrecidos (Moderno, Contundente, Minimalista, Clásico, Cálido, Editorial y más) son las verdaderas «plantillas» — un menú, no una sola página generada. Su color de marca y su logo se aplican a cada uno de ellos." },
          { table: {
            head: ["Diseño", "Qué va primero"],
            rows: [
              ["**Mostrar el trabajo primero**", "sus fotos de trabajos y pares de antes y después"],
              ["**Empezar por los servicios**", "la lista de lo que vende"],
              ["**Empezar por la reputación**", "reseñas y testimonios"],
              ["**Empezar por la reserva**", "el formulario de reserva"],
              ["**Una sola página, breve**", "una página, lo básico y una forma de contactarlo"],
            ],
          } },
        ],
      },
      {
        id: "fine-tune",
        heading: "Ajustar",
        blocks: [
          { bullets: [
            "**Dirección web** — la parte antes de .fieldquo.com. Los nombres reservados como app o www se rechazan porque son una frontera de seguridad, no una preferencia de nombres. Vea [[your-website-address|La dirección de su sitio web]].",
            "**Idiomas** — su idioma principal está marcado. Agregar uno escribe todo el sitio en ese idioma y da a los visitantes un selector en la cabecera; no traduce la página automáticamente. Quitar uno lo saca del sitio.",
            "**Pares de antes y después** — empareje una foto de antes con su después; los pares alimentan el deslizador del sitio. Solo se ofrecen fotos en las etapas antes y terminado, nunca una foto de problema.",
            "**Secciones** — reescriba lo que quiera a mano, oculte una sección, agregue o quite una foto. Su logo, colores, servicios, horarios y datos de contacto no se editan aquí; cámbielos en Configuración de la empresa y el sitio se actualiza.",
          ] },
        ],
      },
      {
        id: "publish-and-unpublish",
        heading: "Publicar y despublicar",
        blocks: [
          { p: "**Publicar** hace público el sitio; **Actualizar** pone en vivo los guardados posteriores. Publicar con fotos de stock todavía en la página está permitido — una empresa sin fotos aún no queda bloqueada para lanzar — pero nunca es silencioso: la pantalla las cuenta y ofrece **Agregar mis fotos** o **Publicar de todos modos**. La fotografía de stock solo está en el fondo de la cabecera y lugares similares, nunca en «Nuestro trabajo». En una cuenta gratuita el pie lleva una pequeña línea «Site by FieldQuo»; un plan de pago la quita. Vea [[the-site-by-fieldquo-footer|El pie de página Site by FieldQuo]]." },
          { warning: "**Despublicar** pone el sitio fuera de línea de inmediato — los visitantes ven una página de «no publicado», y Google lo quita en los días siguientes. Se conservan todas las secciones, fotos e idiomas, y **Publicar** vuelve a poner el mismo sitio cuando quiera." },
        ],
      },
      {
        id: "who-can-see-it",
        heading: "Quién puede verlo",
        blocks: [
          { p: "Solo propietarios y administradores. Guardar, publicar, agregar un idioma y subir fotos rechazan a cualquier otro, así que la fila se oculta a todos los demás niveles. La guía completa es [[the-website-builder|El creador de sitios web]]." },
        ],
      },
    ],
    faq: [
      { q: "¿La IA inventará servicios que no ofrezco?", a: "No. Los servicios, testimonios y fotos vienen de sus propios datos y se vuelven a integrar después de escribir las palabras. El modelo elige frases, no hechos." },
      { q: "¿Puedo usar mi propio dominio?", a: "El sitio vive en sunombre.fieldquo.com; el campo Dirección web define la primera parte. FieldQuo no conecta un dominio personalizado al sitio hoy." },
      { q: "¿Agregar un idioma traduce mi sitio?", a: "No. Escribe todo el sitio de nuevo en ese idioma a partir de sus datos y da a los visitantes un selector. Nada se traduce automáticamente." },
    ],
  },

  "settings-instant-quotes": {
    title: "Cotizaciones instantáneas",
    summary:
      "La lista de tarifas detrás de su enlace de estimación instantánea — active un oficio, defina las tarifas y los recargos, elija lo que ve el propietario y ponga el estimador en su propio sitio web.",
    updated: "2026-09-12",
    intro: [
      "**Configuración → Cotizaciones instantáneas** es la lista de tarifas con la que se le cotiza a un desconocido. Un propietario abre su enlace de estimación instantánea, ingresa una dirección o traza un área en un mapa, responde unas preguntas y obtiene un rango inicial real en segundos — calculado a partir de los números que guarda aquí y de nada más. Cada estimación cae en [[estimate-reviews|Revisión de estimaciones]] antes de que pueda enviarse, y la página pública nunca muestra la lista de tarifas en sí.",
    ],
    sections: [
      {
        id: "overview",
        heading: "Resumen",
        blocks: [
          { p: "La pantalla es una ficha por cada oficio que FieldQuo puede cotizar — techos, pisos de epoxi, revoque, corte de césped, restauración y renovación de gabinetes, pisos, pintura, escaleras, encimeras, retiro de escombros — con un interruptor **Activado** / **Desactivado**, la forma en que ese oficio mide, precios de venta de materiales editables, los recargos que aplica la estimación, un cargo mínimo y una amplitud de rango. Guardar un oficio es lo que lo pone en vivo; hasta entonces está desactivado, para que nunca haya un botón en vivo cotizando con números que nadie eligió." },
          { p: "Las fichas parten de sus tarifas de **Servicios y precios** donde las tiene (**Partimos de sus tarifas de Servicios y precios**), o de cifras iniciales típicas donde no las tiene (**Estas son cifras iniciales típicas, no sus precios**). En cualquier caso, no se ofrece nada a los propietarios hasta que edite y guarde. Si sus tarifas de servicios cambian después, la ficha lo dice — **Sus tarifas de Servicios y precios cambiaron desde que se guardó esto** — y ofrece **Usar mis precios de servicios**; nunca cambia sus tarifas en vivo por su cuenta." },
        ],
      },
      {
        id: "on-the-screen",
        heading: "Qué hay en la pantalla",
        blocks: [
          { bullets: [
            "La línea de estado — **… activos en tu enlace de estimación instantánea.** con **Ver lo que ven los propietarios**, o **Todavía no hay nada activo en tu enlace de estimación instantánea — activa un servicio abajo.**",
            "**Pon la estimación instantánea en tu sitio web** — un fragmento para insertar con **Copiar código**, mostrado solo cuando hay algo en vivo.",
            "**Estos están listos para publicarse en cuanto les pongas precio** — los servicios que vende que aún no tienen una tarifa suya, cada uno con **Poner precio a …**; y un aviso si una cotización instantánea en vivo no es uno de sus servicios.",
            "Una ficha por cada oficio que vende: el interruptor, **Lo que ve el propietario**, **Materiales y precios de venta**, los recargos, **Cargo mínimo**, **Amplitud del rango (±)**, **Rangos de presupuesto**, y **Guardar y activar**. **+ Mostrar otros … oficios que FieldQuo puede cotizar** lista el resto.",
            "**Financiamiento** — opcional, para toda la empresa: sus propias palabras y, si los indica, una tasa anual y un plazo.",
          ] },
        ],
      },
      {
        id: "switch-a-trade-on",
        heading: "Cómo activar un oficio",
        blocks: [
          { steps: [
            "Abra **Configuración → Cotizaciones instantáneas**. Si el oficio no es uno de sus servicios, agréguelo primero en [[settings-services|Servicios y precios]] — esa es la lista que leen sus presupuestos, su sitio web y su recepcionista.",
            "En la ficha del oficio, lea cómo mide — por ejemplo **Techo medido automáticamente desde la dirección (satélite de Google).** o **El propietario ingresa el área y elige opciones.**",
            "Defina el precio de venta de cada material bajo **Materiales y precios de venta** (por cuadrado, por pie², por puerta, por peldaño… según cómo cobre el oficio), y agregue o quite materiales.",
            "Defina los recargos que aplica ese oficio, el **Cargo mínimo** y la **Amplitud del rango (±)**.",
            "Elija **Lo que ve el propietario** (abajo) y pulse **Guardar y activar**. La línea de estado de arriba lo cuenta.",
            "Pulse **Ver lo que ven los propietarios** para abrir su enlace público, o **Copiar código** para insertarlo en su propio sitio.",
          ] },
          { figure: "live:app-settings-instant-quotes", caption: "Configuración → Cotizaciones instantáneas — el conteo en vivo y el fragmento para insertar, luego una ficha de oficio con su interruptor, materiales, recargos y Guardar y activar." },
          { note: "Para pintura, a los propietarios solo se les pregunta interior o exterior cuando Pintura interior y Pintura exterior están ambas activadas en Servicios; con una activada, cada estimación se calcula con ese alcance, y con ninguna, la pintura no se ofrece en absoluto, sin importar lo que se guarde aquí." },
        ],
      },
      {
        id: "what-the-homeowner-sees",
        heading: "Lo que ve el propietario",
        blocks: [
          { table: {
            head: ["Opción", "Qué pasa", "Contrapartida"],
            rows: [
              ["**No mostrar un precio**", "Envían y la página dice que la cotización está en camino.", "Usted obtiene los datos; ellos no ven ninguna cifra hasta que usted revise."],
              ["**Mostrar un rango estimado**", "El rango aparece antes de que dejen ningún dato.", "Espere que algunos lo lean y se vayan."],
              ["**Mostrar el rango después de enviar**", "Llenan el formulario para desbloquear su rango.", "Obtiene sus datos de todos modos — la opción habitual."],
            ],
          } },
        ],
      },
      {
        id: "rates-and-controls",
        heading: "Qué cambia cada control",
        blocks: [
          { bullets: [
            "**Activado** / **Desactivado** — si el oficio se ofrece en su enlace o no. Desactivado conserva cada tarifa guardada.",
            "**Materiales y precios de venta** — el precio base por unidad de cada material que el propietario puede elegir. La unidad sigue al oficio: por cuadrado para techos, por pie² para pisos y epoxi, por puerta y cajón para gabinetes, por peldaño para escaleras, por visita según el tamaño del terreno para el corte de césped.",
            "Los recargos — se suman a la base solo cuando las respuestas del propietario lo exigen: pendiente pronunciada y remoción por capa para techos, preparación de superficie, acceso y estado en los demás, el recargo por alcance para pintura.",
            "**Cargo mínimo** — el piso de cualquier estimación de ese oficio.",
            "**Amplitud del rango (±)** — qué tan ancho es el rango mostrado alrededor de la cifra calculada.",
            "**Rangos de presupuesto** — los tres cortes detrás de las cuatro opciones de presupuesto que se le preguntan al propietario; tienen que ir de menor a mayor, o se muestran los rangos estándar en su lugar.",
          ] },
        ],
      },
      {
        id: "financing",
        heading: "Financiamiento",
        blocks: [
          { p: "FieldQuo no ofrece financiación. La tarjeta **Financiamiento** le permite decirles a los propietarios que está disponible, con sus propias palabras, o remitirlos a su proveedor. Si además completa **Tipo anual (TAE %)** y **Plazo (meses)** bajo **Sus condiciones indicadas (opcional)**, la estimación muestra una cuota mensual señalada como estimación según sus condiciones. Deje cualquiera de los dos en blanco y nunca se muestra una cifra mensual — FieldQuo no tiene tasa ni plazo por defecto." },
          { warning: "No prometa una tasa ni un monto mensual que no pueda cumplir. Las palabras y las cifras son suyas, y son lo que lee el propietario." },
        ],
      },
      {
        id: "who-can-see-it",
        heading: "Quién puede verlo",
        blocks: [
          { p: "La fila aparece para cualquiera cuyo acceso incluya **Ver precios** — los niveles Estimador, Despachador y Encargado, propietarios y administradores — porque la lista de tarifas son precios. Editar y guardar un oficio es solo para propietarios y administradores; todos los demás ven las fichas en solo lectura. El estimador público, en cambio, nunca le muestra una tarifa a nadie. Vea [[instant-quotes-on-your-website|Cotizaciones instantáneas en su sitio web]]." },
        ],
      },
    ],
    faq: [
      { q: "¿Un propietario puede ver mis tarifas?", a: "No. La página pública muestra un rango, nunca la lista de tarifas. Publicar una lista de tarifas abiertamente se la entregaría a cada competidor de la ciudad." },
      { q: "¿Una estimación instantánea es vinculante?", a: "No. Es un rango que el propietario puede solicitar. Cae en Revisión de estimaciones, y no se le envía nada como presupuesto hasta que alguien lo aprueba." },
      { q: "Activé un oficio pero el enlace dice que no hay nada disponible.", a: "Un oficio está en vivo solo cuando está activado y se puede cotizar — guardado con tarifas. La línea de arriba cuenta exactamente esos; la ficha de un oficio que necesita precio lo dice." },
    ],
  },
};
