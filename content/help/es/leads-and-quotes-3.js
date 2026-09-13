// content/help/es/leads-and-quotes-3.js
//
// Parte 3 de la categoría «leads-and-quotes» en español (ver el compositor,
// leads-and-quotes.js). Mismos slugs, mismas secciones, mismos bloques y
// mismas figuras que content/help/en/leads-and-quotes-3.js — el script
// scripts/check-help-centre.mjs compara la estructura. Las palabras en
// pantalla son las cadenas del bloque `es` de app/i18n/appMessages.js.
export const ARTICLES = {
  "edit-a-sent-quote": {
    title: "Editar un presupuesto que ya se envió",
    summary:
      "Un presupuesto enviado todavía se edita en el mismo lugar — el enlace que tiene el cliente muestra la nueva versión, y Enviar de nuevo manda una copia actualizada — hasta que el cliente acepta o rechaza.",
    updated: "2026-09-12",
    intro: [
      "Un presupuesto no queda congelado en el momento en que sale. Mientras el cliente no responda, un presupuesto enviado se edita exactamente como un borrador: el mismo generador, las mismas líneas, el mismo botón Guardar cambios. Lo que cambia es lo que ve el cliente — el enlace en su bandeja abre el presupuesto en vivo, así que una edición le resulta visible en cuanto usted la guarda, vuelva a enviar el correo o no.",
      "Una vez que el cliente aceptó o rechazó, las líneas se bloquean. Este artículo cubre ambos estados, y lo que hace Enviar de nuevo.",
    ],
    sections: [
      {
        id: "overview",
        heading: "Visión general",
        blocks: [
          { p: "Abra el presupuesto y presione **Editar**. Se abre el mismo generador con el que lo redactó, en modo edición, con las líneas guardadas ya en su lugar. Las líneas guardadas se editan como líneas — no se recalculan desde su lista de tarifas, así que un presupuesto enviado el mes pasado conserva los precios del mes pasado aunque usted haya subido una tarifa desde entonces." },
          { p: "El estado del presupuesto sigue siendo **Enviada** después de una edición. FieldQuo no crea una segunda versión de un presupuesto: una edición reemplaza lo que había, y el enlace de aprobación que el cliente ya tiene muestra el reemplazo. (Las facturas son distintas — una factura editada conserva una copia de lo que se envió. Vea [[edit-an-invoice-after-sending|Editar una factura después de enviarla]].)" },
        ],
      },
      {
        id: "how-to",
        heading: "Cómo editar un presupuesto enviado",
        blocks: [
          { steps: [
            "Abra el presupuesto desde **Cotizaciones** y presione **Editar**.",
            "Cambie las líneas, el descuento, el impuesto, la fecha **Válida hasta**, las notas o el texto **Qué sigue**.",
            "Presione **Guardar cambios**. El presupuesto conserva su estado **Enviada** y su enlace del cliente.",
            "Si el cliente debe enterarse, vuelva al presupuesto y presione **Enviar de nuevo** — el correo lleva un PDF recién generado con las líneas actuales.",
          ] },
          { figure: "live:app-quotes-new", caption: "El generador de presupuestos — Editar abre esta misma pantalla con las líneas del presupuesto ya completadas." },
          { note: "**Enviar de nuevo** reinicia el reloj. Registra una nueva fecha de envío, así que la antigüedad que muestra la lista de cotizaciones y la espera antes de cualquier regla de seguimiento **Cotización enviada, sin respuesta** vuelven a contar desde ese momento." },
        ],
      },
      {
        id: "what-locks",
        heading: "Qué se bloquea, y cuándo",
        blocks: [
          { table: {
            head: ["Estado del presupuesto", "Líneas", "Notas, vencimiento, qué sigue"],
            rows: [
              ["Borrador o Enviada", "Editables", "Editables"],
              ["Aprobada", "Bloqueadas — el generador muestra las líneas en solo lectura y una advertencia de que el cliente aceptó cifras distintas", "Editables"],
              ["Rechazada", "Bloqueadas", "Editables"],
            ],
          } },
          { p: "En un presupuesto ya decidido, el generador lo dice con claridad: el cliente ya decidió sobre este presupuesto, así que sus líneas no pueden cambiarse; las notas, el vencimiento y el texto de qué sigue se siguen guardando. El servidor rechaza un cambio de líneas en un presupuesto decidido aunque una pantalla desactualizada intente enviarlo." },
          { warning: "Editar los montos de un presupuesto **Aprobada** no deshace la aprobación. El generador le advierte: cambiar el precio ahora significa que el cliente aceptó cifras distintas a las registradas. Si algo importante cambia después de la aceptación, el camino honesto es un presupuesto nuevo o una factura corregida, no una edición silenciosa." },
        ],
      },
      {
        id: "two-people",
        heading: "Cuando dos personas editan el mismo presupuesto",
        blocks: [
          { p: "El generador recuerda qué versión abrió. Si un colega guardó el presupuesto mientras su pantalla estaba abierta, su guardado queda retenido y un aviso se lo dice — nada de lo que escribió se pierde, y nada se sobrescribe a espaldas de nadie. Puede abrir la versión más reciente, o guardar la suya encima a propósito." },
        ],
      },
      {
        id: "who-can",
        heading: "Quién puede editar",
        blocks: [
          { p: "Cualquiera cuya cuadrícula de acceso tenga Cotizaciones en **View, create, and edit** o superior: los perfiles Estimador, Despachador y Gerente, y todo propietario y administrador. La cuadrilla no tiene ningún acceso a los presupuestos. Reasignar un presupuesto a otra persona es un permiso aparte, que tienen el Despachador, el Gerente, el propietario y el administrador." },
        ],
      },
    ],
    faq: [
      { q: "¿El cliente ve mi edición si no presiono Enviar de nuevo?", a: "Sí, si abre su enlace — muestra el presupuesto en vivo. Enviar de nuevo sirve para ponerle delante un PDF actualizado y un correo nuevo." },
      { q: "¿Puedo recuperar la versión anterior?", a: "No. Un presupuesto se edita en el mismo lugar y FieldQuo no guarda ninguna copia anterior. Si necesita constancia de lo que se envió, descargue el PDF antes de editar." },
      { q: "¿Por qué falta el botón Enviar en este presupuesto?", a: "Solo aparece mientras el presupuesto está en Borrador o Enviada. En un presupuesto Aprobada el siguiente paso es la factura; en uno registrado como trabajo pasado nunca se envía nada." },
    ],
  },

  "convert-a-quote-to-a-job": {
    title: "Qué pasa cuando se aprueba un presupuesto",
    summary:
      "Un presupuesto aprobado se convierte en un trabajo a la espera de fecha, una factura en borrador, una tarea para programarlo y un prospecto Ganado — igual si el cliente hizo clic en el enlace o si usted lo registró a mano.",
    updated: "2026-09-12",
    intro: [
      "No hay un botón «Convertir en trabajo», porque nunca necesita presionar uno. En el momento en que un presupuesto se aprueba — por el cliente en su enlace, o por usted en la pantalla **Consigue la aprobación** — FieldQuo crea todo lo que la siguiente etapa necesita, una vez, y nunca dos.",
      "Este artículo enumera exactamente qué se crea, dónde queda, y el único caso en que no pasa nada a propósito.",
    ],
    sections: [
      {
        id: "overview",
        heading: "Visión general",
        blocks: [
          { p: "Antes, la aprobación significaba cosas distintas según la puerta por la que entraba: un cliente que hacía clic en el enlace creaba un trabajo y una factura, un miembro del equipo que registraba una aprobación por teléfono no creaba nada. Eso era un error, y está corregido de raíz — las dos puertas ejecutan el mismo código, así que un sí por teléfono y un sí en el enlace dejan a la empresa en el mismo estado." },
          { p: "Todo lo que sigue se hace en el mejor esfuerzo y sin duplicados: un doble clic, un webhook reintentado o una segunda aprobación después de que la primera ya corrió no producirán un segundo trabajo ni una segunda factura." },
        ],
      },
      {
        id: "what-is-created",
        heading: "Qué se crea",
        blocks: [
          { table: {
            head: ["Creado", "Dónde queda", "Detalles"],
            rows: [
              ["Un trabajo", "**Trabajos**, estado **Falta fecha**", "Titulado con el tipo de presupuesto, el nombre del cliente y el número del presupuesto, vinculado al presupuesto. Un trabajo por presupuesto."],
              ["Una factura en borrador", "**Facturas**", "Las líneas y las fotos del presupuesto copiadas — una factura refleja el presupuesto del que viene. Una factura principal por presupuesto."],
              ["Una tarea", "**Tareas**, prioridad alta", "Recuerda a alguien programar el trabajo. No se inventa una fecha límite, porque FieldQuo no conoce sus plazos."],
              ["El estado del prospecto", "**Prospectos**, marcado **Ganado**", "Solo si el presupuesto se convirtió desde un prospecto. Un presupuesto escrito desde cero no tiene ningún prospecto que mover."],
              ["Las etapas del calendario de pagos", "La factura", "Solo si su empresa tiene un calendario de pagos en Configuración → Configuración de la empresa. La etapa del depósito se solicita de inmediato; las etapas posteriores esperan las fechas del trabajo."],
              ["La fecha de la decisión", "El presupuesto", "Registrada una sola vez, la primera vez que el presupuesto se aprueba, para que nunca se mueva con una edición posterior."],
            ],
          } },
          { figure: "live:app-jobs", caption: "Trabajos — un presupuesto aprobado llega aquí bajo Falta fecha, listo para programarse." },
        ],
      },
      {
        id: "two-doors",
        heading: "Las dos formas de aprobar un presupuesto",
        blocks: [
          { bullets: [
            "**El cliente, en su enlace.** Aprueba en la página a la que apunta el correo del presupuesto, con una firma si usted la pide. Los propietarios y administradores reciben un correo, el cliente recibe el PDF firmado, y los pasos de arriba se ejecutan. Vea [[online-approval-and-signature|Aprobación en línea y firma]].",
            "**Usted, en Consigue la aprobación.** Abra el presupuesto, presione **Obtener aprobación**, y bajo **Registrar su respuesta** presione **La aprobaron**. No sale ningún correo al cliente — usted ya habló con él — pero el trabajo, la factura y la tarea se crean exactamente igual. **La rechazaron** registra un rechazo y, si quiere, el motivo.",
          ] },
          { tip: "El registro de actividad nombra lo que produjo cada aprobación — el trabajo creado, listo para programar, y el número de la factura puesta en borrador. Esa entrada está redactada en inglés." },
        ],
      },
      {
        id: "convert-to-invoice",
        heading: "El botón Convertir en factura",
        blocks: [
          { p: "En un presupuesto aprobado que todavía no tiene factura, la página del presupuesto muestra **Convertir en factura**. Existe como respaldo para el caso raro en que la factura automática no pudo crearse. Presionarlo cuando la factura ya existe devuelve esa factura en lugar de crear otra." },
        ],
      },
      {
        id: "nothing-happens",
        heading: "Cuando no pasa nada, a propósito",
        blocks: [
          { p: "Un presupuesto registrado como **trabajo pasado** — desde la importación de historial de la pantalla Trabajos — ya lleva su trabajo y su factura pagada con las fechas reales. Cambiar su estado no levanta etapas, no envía ninguna solicitud de depósito y no le pide a nadie programar un trabajo hecho en 2024." },
          { p: "Un presupuesto rechazado no crea nada. Registra cuándo, y por qué si alguien lo dijo — el motivo es la mitad que cambia lo que usted hace después." },
        ],
      },
      {
        id: "who-can",
        heading: "Quién puede registrar una aprobación",
        blocks: [
          { p: "Registrar una decisión en la pantalla Consigue la aprobación es una edición del presupuesto, así que requiere Cotizaciones en **View, create, and edit** o superior — Estimador, Despachador, Gerente, propietario o administrador. El cliente no necesita más que su enlace." },
        ],
      },
    ],
    faq: [
      { q: "El trabajo no tiene fecha. ¿Es un problema?", a: "No — de eso se trata Falta fecha. Ábralo desde Trabajos o desde la tarea y reserve la primera visita. Vea [[the-job-page|La página del trabajo]]." },
      { q: "¿Puedo aprobar un presupuesto sin crear una factura?", a: "No por la vía de la aprobación. La factura en borrador se crea junto con el trabajo; puede dejarla como borrador y editarla antes de enviarla." },
      { q: "El cliente aprobó dos veces por error. ¿Tengo dos trabajos?", a: "No. El trabajo, la factura y la tarea se crean una sola vez por presupuesto, sin importar la puerta por la que entró la aprobación ni cuántas veces." },
    ],
  },

  "quotes-sent-with-no-response": {
    title: "Presupuestos enviados sin respuesta",
    summary:
      "Cómo la lista de cotizaciones hace visibles los presupuestos que nadie ha respondido, qué envía Dar seguimiento, y cómo una regla de seguimiento los persigue por usted.",
    updated: "2026-09-12",
    intro: [
      "Un presupuesto que lleva tiempo en **Enviada** es la cola de seguimiento, y FieldQuo lo pone al principio de la lista en lugar de dejarlo hundirse bajo borradores más nuevos. Este artículo trata de las tres cosas que puede hacer con él: leerlo, darle seguimiento a mano, y dejar que una regla le dé seguimiento por usted.",
    ],
    sections: [
      {
        id: "overview",
        heading: "Visión general",
        blocks: [
          { p: "En **Cotizaciones**, con la ficha **Todos** seleccionada, cada presupuesto cuyo estado es Enviada se agrupa al principio bajo el encabezado **Cotización enviada, sin respuesta**, el enviado hace más tiempo primero — el presupuesto que más ha esperado es el que el cliente más probablemente olvidó. Todo lo demás sigue en el orden en que se creó." },
          { p: "Cada fila muestra hace cuánto se envió y su vencimiento. Un presupuesto cuya fecha **Válida hasta** cae dentro de tres días, o ya pasó, se marca para que resalte; la frase de al lado siempre nombra la fecha real, para que el énfasis nunca sea lo único en lo que pueda apoyarse." },
          { figure: "live:app-quotes", caption: "Cotizaciones — las fichas de estado, y luego el grupo de enviadas sin respuesta por encima del resto." },
          { note: "La antigüedad de un presupuesto se cuenta desde la fecha en que realmente se envió por correo. Un presupuesto cuyo estado se puso en Enviada sin correo — un precio acordado por teléfono, un documento importado — no muestra ninguna antigüedad en lugar de una inventada." },
        ],
      },
      {
        id: "follow-up-by-hand",
        heading: "Dar seguimiento a mano",
        blocks: [
          { steps: [
            "Abra el presupuesto. Mientras esté en Enviada y se haya mandado por correo, la barra de acciones muestra **Dar seguimiento**.",
            "Presiónelo y confirme el destinatario. El correo de seguimiento usa el mismo diseño que el correo del presupuesto con una apertura distinta, y enlaza a la misma página de aprobación.",
            "El presupuesto registra la fecha y el número de seguimientos; el registro de actividad indica que se envió un seguimiento.",
          ] },
          { p: "**Enviar de nuevo** es distinto: reenvía el presupuesto completo con un PDF actualizado y reinicia la fecha de envío, así que la antigüedad del presupuesto — y el temporizador de cualquier regla de seguimiento — vuelve a empezar." },
        ],
      },
      {
        id: "follow-up-rule",
        heading: "Dejar que una regla lo haga",
        blocks: [
          { p: "**Configuración → Seguimientos** envía una plantilla un tiempo determinado después de que un presupuesto, una factura o un trabajo alcanza un estado. El desencadenante para esta cola es **Cotización enviada, sin respuesta**: se dispara cuando el presupuesto lleva en Enviada el tiempo del retraso sin aceptación ni rechazo. El retraso sugerido es de 3 días." },
          { steps: [
            "Abra **Configuración → Seguimientos** y presione **Nueva regla**.",
            "Elija el desencadenante **Cotización enviada, sin respuesta**, un retraso en horas o días, y la plantilla de correo a enviar (desde **Configuración → Plantillas de correo**).",
            "Presione **Crear regla**. **Pausar** la detiene sin eliminarla.",
          ] },
          { figure: "live:app-settings-follow-ups", caption: "Configuración → Seguimientos — el esquema de solo lectura generado a partir de sus reglas, y luego las reglas mismas." },
          { bullets: [
            "Cada presupuesto recibe el correo de una regla dada **una sola vez**.",
            "La regla se detiene en cuanto el cliente acepta o rechaza.",
            "Se omiten los clientes sin dirección de correo registrada.",
            "Los presupuestos registrados como trabajos pasados nunca reciben seguimiento.",
            "La revisión corre a diario; ninguna regla de seguimiento envía mensajes de texto.",
          ] },
        ],
      },
      {
        id: "who-can",
        heading: "Quién ve esto",
        blocks: [
          { p: "La lista de cotizaciones es visible para cualquiera con Cotizaciones en **View only** o superior. Las reglas de seguimiento se crean y pausan en Configuración, por propietarios, administradores, Gerentes y Despachadores." },
        ],
      },
    ],
    faq: [
      { q: "¿Por qué no aparece el grupo?", a: "Solo se muestra en la ficha Todos, y solo cuando hay al menos un presupuesto Enviada y al menos otro presupuesto. En la ficha Enviada ya está viendo la cola." },
      { q: "¿El asistente telefónico puede llamar por un presupuesto sin respuesta?", a: "Sí, si activa las devoluciones de llamada por presupuesto — una función distinta de los correos de seguimiento. Vea [[quote-callbacks|Devoluciones de llamada por presupuesto]]." },
      { q: "¿Un seguimiento cambia el prospecto?", a: "No. Un correo de seguimiento deja el prospecto detrás del presupuesto donde está; solo el primer envío pasa un prospecto nuevo a Contactado." },
    ],
  },

  "estimate-reviews": {
    title: "Revisión de estimaciones: aprobar estimaciones instantáneas",
    summary:
      "Cada precio que FieldQuo calculó para un propietario espera aquí a que una persona lo confirme — usted aprueba a una cifra, la ajusta, o abre el presupuesto — y nada puede enviarse antes de eso.",
    updated: "2026-09-12",
    intro: [
      "Una estimación instantánea es un rango que un propietario vio en su sitio web o que se midió a partir de una llamada telefónica. No es un presupuesto hasta que alguien responsable haya mirado la propiedad, las cifras y el cliente, y presionado **Aprobar**. **Revisión de estimaciones** es donde ocurre eso, y el botón Enviar de un presupuesto se niega a funcionar hasta que se haya hecho.",
    ],
    sections: [
      {
        id: "overview",
        heading: "Visión general",
        blocks: [
          { p: "La pantalla abre con su propia frase: las estimaciones instantáneas de su sitio web llegan primero aquí — confirme el precio, ajustándolo si la propiedad lo requiere, antes de que se pueda enviar el presupuesto. Debajo hay una tarjeta por estimación a la espera de revisión. Cuando no hay nada en espera, lo dice." },
          { p: "Esta es la compuerta de la que depende toda la función de presupuesto instantáneo. El borrador llega con una marca de revisión que solo esta pantalla quita; un presupuesto que todavía la lleva no puede enviarse por correo, y el error dice por qué: confirme el precio en Revisión de estimaciones y luego envíe." },
          { note: "**Solo en FieldQuo.** Un precio instantáneo para el propietario con una revisión humana obligatoria antes de convertirse en presupuesto no aparece en la página de precios de Jobber, Housecall Pro, Projul ni ServiceTitan en ningún nivel." },
        ],
      },
      {
        id: "on-the-screen",
        heading: "Qué hay en cada tarjeta",
        blocks: [
          { bullets: [
            "El nombre del cliente (o **Consulta desde el sitio web** cuando no se dio ninguno), el número del presupuesto y de dónde vino: **Medido por satélite**, **Césped trazado en el mapa**, **Ingresado por el propietario**, o **Tomado de una llamada telefónica** con un botón **Escuchar** para la grabación.",
            "A quién está asignada — **Asignada a ti**, **Asignada a** un colega, o **Sin asignar: asignármela**, que la reclama con un clic.",
            "La propiedad: una imagen satelital cuando se capturó una, la superficie y la pendiente del techo, los cuadros y las capas por retirar, o la superficie y el material ingresados.",
            "**El propietario vio:** el rango que se le mostró, y **Su presupuesto máximo:** si dio uno — marcado **supera el presupuesto** cuando el rango lo excede.",
            "El desglose de líneas con el que se armó la estimación, y cualquier nota de una llamada que diga que el cliente pidió algo que no está en la cifra.",
            "**Aprobar en** con la moneda de la empresa y el total en una casilla, el botón **Aprobar**, y **Abrir cotización**.",
          ] },
          { figure: "live:app-estimate-reviews", caption: "Revisión de estimaciones — una tarjeta por estimación instantánea, con la propiedad, el rango que vio el propietario y la casilla Aprobar en." },
        ],
      },
      {
        id: "how-to",
        heading: "Cómo aprobar una estimación",
        blocks: [
          { steps: [
            "Abra **Revisión de estimaciones** desde la barra lateral (la fila se llama **Revisiones de presupuesto**).",
            "Lea la tarjeta. Si el cliente por teléfono o el formulario pidió algo que el precio no cubre, está escrito en la tarjeta.",
            "Deje el total como está, o escriba la cifra que el trabajo realmente vale en **Aprobar en**.",
            "Presione **Aprobar**. La tarjeta sale de la cola, el total y el subtotal del presupuesto pasan a ser la cifra aprobada, y el presupuesto ya puede enviarse.",
            "Presione **Abrir cotización** en su lugar si quiere retrabajar las líneas en el generador primero — aprobar no edita líneas, solo el total.",
          ] },
          { p: "Aprobar conserva constancia de lo que se le mostró al propietario, separada de lo que usted aprobó, para que «lo que vio» y «lo que cotizamos» nunca se confundan en una sola cifra. El registro de actividad anota quién aprobó y a qué cifra." },
        ],
      },
      {
        id: "who-can",
        heading: "Quién puede aprobar",
        blocks: [
          { p: "La fila de la barra lateral y el botón Aprobar son para propietarios, administradores, Gerentes y Despachadores — la tarjeta se lo dice a los demás: solo un gerente, administrador o propietario puede aprobar. Aprobar también requiere Cotizaciones en **View, create, and edit**, porque puede fijar el total. Un Estimador arma presupuestos pero no aprueba estimaciones." },
          { p: "Alguien sin **See prices** ve la tarjeta sin los montos y no puede aprobar." },
        ],
      },
    ],
    faq: [
      { q: "¿De dónde vienen estas estimaciones?", a: "De la página de estimación instantánea de su sitio web ([[instant-quotes-on-your-website|Cotizaciones instantáneas en su sitio web]]) y de las llamadas que atendió el recepcionista, cuando la llamada traía lo suficiente para calcular ([[call-to-quote|De una llamada telefónica a un borrador de presupuesto]])." },
      { q: "¿Puedo cambiar el precio después de aprobar?", a: "Sí — después de la aprobación el presupuesto es un borrador común. Edítelo en el generador como cualquier otro antes de enviarlo." },
      { q: "¿Se le avisa al propietario cuando apruebo?", a: "No solo por aprobar. Envíe el presupuesto cuando esté listo; si las devoluciones de llamada por presupuesto están activadas, el asistente puede llamar al respecto una vez que el cliente tenga el presupuesto por escrito." },
    ],
  },

  "instant-quotes-on-your-website": {
    title: "Cotizaciones instantáneas en su sitio web",
    summary:
      "Active un oficio, fije sus tarifas y elija si el propietario ve un rango — cada estimación llega a Revisión de estimaciones, y su lista de tarifas nunca sale de la empresa.",
    updated: "2026-09-12",
    intro: [
      "**Configuración → Cotizaciones instantáneas** permite que un propietario obtenga una estimación inicial real desde su sitio web en segundos: un techo medido desde su dirección, un césped que traza en un mapa, o unas cuantas cifras que escribe. El precio se calcula en el servidor a partir de tarifas que usted fija, se muestra como un rango, y llega como borrador a su cola de revisión antes de que nada sea vinculante.",
      "Este artículo es el lado de la configuración. Lo que ve el propietario está en [[the-instant-estimate-page|La página de estimación instantánea]], y la revisión en [[estimate-reviews|Revisión de estimaciones]].",
    ],
    sections: [
      {
        id: "overview",
        heading: "Visión general",
        blocks: [
          { p: "La pantalla abre con un conteo en vivo — **{count} activos en tu enlace de estimación instantánea**, o una nota de que todavía no hay nada activo — y un enlace **Ver lo que ven los propietarios**. Cuando al menos un oficio está activo, aparece un fragmento para insertar bajo **Pon la estimación instantánea en tu sitio web**; es un elemento HTML común que funciona en Wix, Squarespace, WordPress y páginas escritas a mano." },
          { p: "Debajo hay una tarjeta por oficio que FieldQuo puede cotizar al instante, un interruptor **Activado** / **Desactivado** en cada una, y una tarjeta **Financiamiento** al final. Solo se ofrecen los oficios que también están activados en **Configuración → Servicios y precios**; el resto queda bajo **Mostrar otros {count} oficios que FieldQuo puede cotizar**." },
          { note: "**Solo en FieldQuo.** Una estimación instantánea calculada en el servidor a partir de su propia lista de tarifas, con una revisión obligatoria antes de convertirse en presupuesto, no aparece en la página de precios de Jobber, Housecall Pro, Projul ni ServiceTitan en ningún nivel." },
        ],
      },
      {
        id: "trades",
        heading: "Los oficios, y cómo mide cada uno",
        blocks: [
          { table: {
            head: ["Oficio", "Cómo se mide al propietario"],
            rows: [
              ["Techos", "Techo medido automáticamente desde la dirección (satélite de Google): superficie inclinada, pendiente, cuadros."],
              ["Corte de césped", "El propietario traza el césped en un mapa satelital; la superficie sale del contorno."],
              ["Pisos epóxicos, revoque, pisos, pintura, cubiertas", "El propietario ingresa la superficie y elige opciones."],
              ["Reacabado y recubrimiento de gabinetes", "El propietario ingresa cantidades — puertas y frentes de cajón."],
              ["Escaleras", "El propietario ingresa el número de escalones y elige la construcción; se cotiza por huella."],
              ["Retiro de desechos", "El propietario elige los artículos a retirar; se cotiza por volumen con un descuento por carga incorporado."],
            ],
          } },
        ],
      },
      {
        id: "how-to",
        heading: "Cómo poner un oficio en línea",
        blocks: [
          { steps: [
            "Abra **Configuración → Cotizaciones instantáneas** y busque la tarjeta del oficio.",
            "Edite los campos de tarifa según su mercado. Las cifras iniciales son valores típicos, no sus precios, y nada se ofrece a los propietarios hasta que usted guarde.",
            "Elija **Lo que ve el propietario** (abajo).",
            "Fije **Cargo mínimo** y **Amplitud del rango (±)** — el rango es el precio calculado más y menos ese porcentaje.",
            "Presione **Guardar y activar**. El conteo de arriba sube en uno.",
          ] },
          { figure: "live:app-settings-instant-quotes", caption: "Configuración → Cotizaciones instantáneas — el conteo en vivo, el fragmento para insertar, y luego una tarjeta por oficio con su interruptor, su opción de visibilidad y sus tarifas." },
          { tip: "Una tarjeta puede estar Activada y aun así no estar en línea: si falta una tarifa que el cálculo necesita, la tarjeta dice que los propietarios todavía no pueden obtener un precio para esto. Esa frase solo se le muestra a usted — a un propietario nunca se le dice por qué una lista de tarifas está incompleta." },
        ],
      },
      {
        id: "what-each-setting-changes",
        heading: "Qué cambia cada ajuste",
        blocks: [
          { bullets: [
            "**No mostrar un precio** — el propietario envía su solicitud y se le dice que un presupuesto va en camino. No se muestra ninguna cifra en la página ni en su correo de confirmación. Es el ajuste por defecto.",
            "**Mostrar el rango después de enviar** — el rango se desbloquea al llenar el formulario, así que usted obtiene sus datos de todos modos. La opción habitual.",
            "**Mostrar un rango estimado** de inmediato — la cifra aparece antes de que deje ningún dato. Espere que haya gente que lea el número y se vaya.",
            "**Rangos de presupuesto** — las cuatro opciones que se muestran cuando el formulario pregunta su presupuesto; fije los tres cortes en orden creciente, o se usan los rangos estándar.",
            "**Usar mis precios de servicios** — aparece cuando sus tarifas de Servicios y precios cambiaron desde que se guardó la tarjeta; las adopta aquí.",
            "**Financiamiento** — opcional, y FieldQuo no ofrece financiamiento. Sus propias palabras, o un enlace a su proveedor. Si indica tanto una tasa anual como un plazo, la estimación también muestra una cuota mensual estimada con esas condiciones; deje uno de los dos vacío y nunca se muestra ninguna cuota mensual.",
          ] },
          { warning: "Sea cual sea la visibilidad, la página pública nunca muestra la lista de tarifas — solo un rango final, y solo cuando usted eligió mostrarlo. El punto de acceso público devuelve servicios y campos, nunca tarifas. Es una regla del producto, no un ajuste." },
        ],
      },
      {
        id: "who-can",
        heading: "Quién puede verlo y cambiarlo",
        blocks: [
          { p: "La pantalla es una lista de tarifas, así que se muestra a cualquiera con **See prices** en su acceso — un Estimador incluido; la cuadrilla no la ve. Guardar tarifas, visibilidad o financiamiento es solo para propietarios y administradores; los demás ven la página en solo lectura con la nota de que solo un propietario o administrador puede editar los precios." },
        ],
      },
    ],
    faq: [
      { q: "¿Adónde va una estimación?", a: "Se localiza o se crea un registro de cliente, se escribe un presupuesto en borrador con la marca de revisión activada, y aparece en Revisión de estimaciones. El propietario recibe un correo de confirmación a nombre de usted, con el rango solo si eligió mostrarlo." },
      { q: "¿El propietario puede reservar una visita desde la estimación?", a: "Sí, cuando su página de reservas está configurada — la confirmación ofrece una visita según su disponibilidad real." },
      { q: "¿La estimación instantánea comparte enlace con el formulario de autopresupuesto?", a: "No. Son dos tarjetas en Configuración → Comparte tus enlaces: Estimación instantánea da un precio; Solicitar una cotización no. Vea [[the-self-quote-form|El formulario de autopresupuesto]]." },
    ],
  },

  "the-self-quote-form": {
    title: "El formulario de autopresupuesto",
    summary:
      "Un formulario público de tres pasos donde el propietario elige un servicio, da cifras aproximadas, fotos o un plano en PDF, y sus datos de contacto — llega como un prospecto calificado, sin que se le muestre un precio a nadie.",
    updated: "2026-09-12",
    intro: [
      "El formulario de autopresupuesto es el enlace **Solicitar una cotización** en **Configuración → Comparte tus enlaces**. Muestra solo los servicios que usted activó, pide las pocas cifras que le dicen el tamaño del trabajo, y nunca muestra un precio. Lo que sale es un prospecto en su tablero de prospectos con todo lo que escribió el propietario, listo para convertirse en un presupuesto que usted mismo cotiza.",
    ],
    sections: [
      {
        id: "overview",
        heading: "Visión general",
        blocks: [
          { p: "El formulario tiene tres pasos, en el orden que un desconocido en un teléfono tolerará: **¿En qué podemos ayudarle?** (uno de sus servicios activados), un paso de detalles con a lo sumo las tres primeras preguntas numéricas o de opción de ese servicio más **¿Cuándo espera empezar?** y **¿Presupuesto aproximado?**, y **¿Adónde se lo enviamos?** — nombre, correo o teléfono, la dirección del trabajo, y la posibilidad de agregar fotos, un video o un plano en PDF." },
          { p: "Se muestra en el idioma del propietario, lleva su logotipo y su color de marca, y no dice nada de FieldQuo. Una empresa que activó más de un idioma de envío muestra un selector de idioma; el idioma que elija es el idioma en que se crea el prospecto — y el presupuesto en que se convierta." },
          { note: "**Solo en FieldQuo.** Un formulario público que deja al cliente describir y fotografiar su propio trabajo, ofreciendo solo los servicios que usted vende y nunca un precio, no aparece en la página de precios de Jobber, Housecall Pro, Projul, QuoteIQ ni ServiceTitan en ningún nivel." },
        ],
      },
      {
        id: "share",
        heading: "Cómo compartirlo",
        blocks: [
          { steps: [
            "Abra **Configuración → Comparte tus enlaces**.",
            "En la tarjeta **Solicitar una cotización**, presione **Copiar** para el enlace, **Abrir** para probarlo, o **Insértalo en tu sitio web en su lugar** para el código de inserción.",
            "Ponga el enlace donde ya está — su sitio web, su ficha de Google, su página de Facebook, su firma de correo o el costado de la camioneta.",
          ] },
          { figure: "live:app-settings-links", caption: "Configuración → Comparte tus enlaces — la tarjeta Solicitar una cotización con su enlace y su código de inserción." },
          { p: "El formulario solo ofrece los servicios que usted activó en **Configuración → Servicios y precios**. Desactive un servicio allí y desaparece del formulario; no hay nada que configurar en el formulario mismo." },
        ],
      },
      {
        id: "what-arrives",
        heading: "Qué llega de su lado",
        blocks: [
          { bullets: [
            "Un prospecto en **Prospectos** con el origen **self_quote**, calificado Caliente, Templado o Frío según el presupuesto, el plazo y los detalles dados — vea [[lead-scoring-hot-warm-cold|Calificación de prospectos]].",
            "Las respuestas del propietario, conservadas tal como se escribieron, más un resumen legible; las fotos, el video o el plano en PDF adjuntos al prospecto.",
            "Un correo de confirmación al propietario, a nombre de usted y en su idioma, repitiendo lo que pidió y ofreciendo una visita si su página de reservas está configurada. No lleva ninguna cifra.",
            "Su número de teléfono, si lo dio, registrado con consentimiento para que el recepcionista pueda devolverle la llamada.",
          ] },
          { figure: "live:app-leads", caption: "Prospectos — donde llega una solicitud de autopresupuesto, con su calificación y las propias palabras del propietario." },
          { p: "Presione **Convertir en presupuesto** en el prospecto y se abre un borrador con el cliente, el servicio, las fotos y las respuestas ya en su lugar y un total en cero — nadie lo ha cotizado todavía, y una cifra que el propietario pudiera ver sin que usted la haya aceptado es exactamente lo que este formulario existe para evitar. Vea [[convert-a-lead-to-a-quote|Convertir un prospecto en presupuesto]]." },
        ],
      },
      {
        id: "who-can",
        heading: "Quién ve los prospectos",
        blocks: [
          { p: "Cualquiera con Solicitudes en **View only** o superior ve el tablero de prospectos; convertir un prospecto requiere Cotizaciones en **View, create, and edit**. Comparte tus enlaces es una pantalla de configuración para propietarios, administradores, Gerentes y Despachadores." },
        ],
      },
    ],
    faq: [
      { q: "¿El propietario ve alguna vez un precio en este formulario?", a: "No — ni en el formulario, ni en la confirmación. La estimación instantánea es la superficie que muestra un rango; esta, a propósito, no lo hace." },
      { q: "¿Puedo agregar mis propias preguntas?", a: "Las preguntas son los tres primeros campos numéricos o de opción del servicio, tal como se definen en Configuración → Servicios y precios. Los tipos de presupuesto personalizados traen sus propios campos." },
      { q: "¿Qué ve el propietario después de enviar?", a: "Una página de confirmación en su idioma con una referencia, los siguientes pasos, y un botón Reservar una visita cuando la reserva está disponible. Vea [[the-self-quote-form-as-a-client|El formulario de autopresupuesto, como lo ve el cliente]]." },
    ],
  },

  "aerial-roof-measurement": {
    title: "Medición de techos desde el aire",
    summary:
      "Escriba una dirección y FieldQuo mide el techo a partir del modelo del edificio de Google — superficie inclinada, pendiente, cuadros y detalles lineales — y completa el despiece de techo, con un Deshacer y un rechazo cuando el marcador cae en el edificio equivocado.",
    updated: "2026-09-12",
    intro: [
      "Un presupuesto de techo necesita la superficie del techo, su pendiente y las longitudes de alero, cumbrera, limatesa y limahoya. FieldQuo las obtiene del modelo del edificio de Google Solar — la misma geometría con la que la industria solar dimensiona sus paneles — para que un techo pueda cotizarse sin que un camión vaya al sitio. La misma medición alimenta la estimación instantánea de techos en su sitio web.",
    ],
    sections: [
      {
        id: "overview",
        heading: "Visión general",
        blocks: [
          { p: "En el generador de presupuestos, un grupo de alcance de techo muestra un panel titulado **Medir el techo desde una dirección** sobre el despiece. Ofrece **Usar la dirección del cliente** cuando el cliente tiene una, o una casilla para escribir otra — el techo por rehacer muchas veces no es la dirección a la que va la factura. **Medir por satélite** hace el resto." },
          { p: "Lo que vuelve es la superficie inclinada real, no la huella — el modelo de Google ya tiene en cuenta la pendiente, así que no se aplica ningún multiplicador encima. El panel lo dice: **La superficie inclinada, no la huella**. La pendiente alimenta el recargo por pendiente pronunciada y se muestra como elevación por 12." },
          { note: "**Solo en FieldQuo.** La medición de un techo a partir de una dirección, dentro del generador de presupuestos, no aparece en la página de precios de Jobber, Housecall Pro, Projul ni ServiceTitan en ningún nivel. QuoteIQ sí lista un producto de medición en su página de precios." },
        ],
      },
      {
        id: "how-to",
        heading: "Cómo medir un techo",
        blocks: [
          { steps: [
            "Abra un presupuesto y agregue un grupo de alcance de techo.",
            "En **Medir el techo desde una dirección**, conserve la dirección del cliente o escriba la del sitio, y presione **Medir por satélite**.",
            "Lea el resultado junto a la imagen satelital: los cuadros, la pendiente, y lo que valen los detalles lineales a sus tarifas.",
            "El panel dice **{count} campos completados** y enumera cada uno con su valor anterior junto al nuevo. Escriba encima de lo que no le convenza, o presione **Deshacer** para dejar el despiece exactamente como estaba.",
          ] },
          { p: "Seis de los siete detalles lineales se derivan de la geometría de los faldones — membrana de hielo y agua, goterón, hilera de arranque, limahoyas, caballete de cumbrera y limatesa, ventilación de cumbrera. El **tapajuntas escalonado** es el encuentro del techo con una pared, y ningún modelo de techo tiene paredes, así que queda vacío y el panel lo lista bajo **Todavía lo necesita a usted: nada de esto se ve desde arriba:**, con las capas existentes, el entablado y las penetraciones." },
        ],
      },
      {
        id: "refusals",
        heading: "Cuándo se niega, y por qué",
        blocks: [
          { bullets: [
            "**Esto no parece el edificio correcto, así que no se completó nada.** — la medición volvió inverosímil (un cobertizo junto al marcador, imágenes demasiado viejas). Las cifras quedan fuera del formulario; mire la imagen y presione **Usarlo de todos modos** solo si de verdad es el techo.",
            "La dirección no se encontró, o Google no tiene modelo de techo para el edificio — ingrese la superficie y la pendiente a mano. La cobertura es amplia pero no universal.",
            "**La medición del techo no está disponible.** — la clave del servidor no está configurada. El ingreso manual sigue funcionando.",
          ] },
          { p: "Nada se aplica en silencio y nada se aplica dos veces. La medición es un punto de partida que pertenece al estimador; el panel nunca se resiste y nunca se vuelve a aplicar." },
        ],
      },
      {
        id: "elsewhere",
        heading: "Dónde más se usa el cielo",
        blocks: [
          { bullets: [
            "**La estimación instantánea** — la estimación de techo de un propietario se mide desde su dirección de la misma forma, y la tarjeta en Revisión de estimaciones muestra la imagen satelital, la superficie y la pendiente, marcadas **Medido por satélite**.",
            "**Corte de césped** — el propietario traza el césped en un mapa satelital; la superficie se calcula a partir del contorno.",
            "**Adoquinado** — para un grupo de alcance de adoquinado, el generador obtiene una imagen aérea de la dirección del cliente y usted traza sobre ella el patio, el sendero o la entrada después de dibujar una línea de referencia para la escala. Sin escala, no muestra ninguna medida en lugar de un conteo de píxeles que podría confundirse con pies.",
          ] },
          { p: "La clave de Google nunca llega al navegador: las imágenes pasan por FieldQuo y la llamada de medición corre en el servidor. Vea [[google-maps-and-solar|Google Maps y Solar]]." },
        ],
      },
      {
        id: "who-can",
        heading: "Quién puede usarlo",
        blocks: [
          { p: "Cualquiera que pueda armar un presupuesto — Cotizaciones en **View, create, and edit** o superior. La medición es gratuita y no se descuenta de su crédito de IA." },
        ],
      },
    ],
    faq: [
      { q: "¿La superficie es la huella o la superficie del techo?", a: "La superficie del techo, inclinada — aquello para lo que compra material. Un techo 12/12 reporta mucha más superficie que su huella, y es correcto." },
      { q: "¿Puedo medir un techo para un cliente de paso sin dirección registrada?", a: "Sí. Escriba cualquier dirección en la casilla; el registro del cliente no necesita tener una." },
      { q: "¿Funciona fuera de Canadá y Estados Unidos?", a: "Donde Google tenga un modelo del edificio. Donde no lo tiene, el panel lo dice y usted ingresa la superficie a mano." },
    ],
  },

  "the-kitchen-designer": {
    title: "El diseñador de cocina",
    summary:
      "Dibuje la línea de gabinetes, elija el acabado, y la ebanistería se cotiza sola desde Precios de gabinetes dentro del presupuesto; el cliente recibe un enlace para mover gabinetes en su propia versión, y el dibujo se imprime en el presupuesto y en la factura.",
    updated: "2026-09-12",
    intro: [
      "Un presupuesto de gabinetes es una página de líneas que por sí solas dicen poco. El diseñador de cocina es el dibujo que hay detrás: gabinetes en paredes, una isla, acabados, electrodomésticos, cotizados en el servidor a partir de sus tarifas de **Precios de gabinetes**, escritos en el presupuesto como su grupo de alcance de ebanistería e impresos en el PDF que el cliente firma.",
    ],
    sections: [
      {
        id: "overview",
        heading: "Visión general",
        blocks: [
          { p: "El botón **Diseñador de cocina** aparece en un presupuesto cuando su empresa tiene activado **Kitchen Design & New Installs** en **Configuración → Servicios y precios**, o cuando ese presupuesto ya lleva un diseño. Guardar en el diseñador almacena el dibujo y recalcula el presupuesto en un solo paso — a propósito no hay un «guardar diseño» y un «actualizar presupuesto» separados, porque con dos botones es como un presupuesto sale a un precio que no coincide con el dibujo engrapado encima." },
          { note: "**Solo en FieldQuo.** Un diseñador de cocinas y gabinetes cuyos precios y plano de planta van directo al presupuesto no aparece en la página de precios de Jobber, Housecall Pro, Projul, QuoteIQ ni ServiceTitan en ningún nivel." },
        ],
      },
      {
        id: "rates",
        heading: "Precios de gabinetes: de dónde salen las cifras",
        blocks: [
          { p: "**Configuración → Precios de gabinetes** es lo que el diseñador cobra por la ebanistería. Cada presupuesto se calcula a partir de estos valores en el servidor, así que cambiarlos cambia lo que cuestan los diseños nuevos y no toca los presupuestos ya enviados. La pantalla aparece solo para empresas con el diseño de cocinas activado, o que ya guardaron sus propias tarifas." },
          { figure: "live:app-settings-cabinet-rates", caption: "Configuración → Precios de gabinetes — cómo fija el precio de un gabinete, las tarifas por pie lineal, y luego los multiplicadores de material y el acabado." },
          { bullets: [
            "**Cómo fijas el precio de un gabinete** — **Por pie lineal** (ancho × la tarifa del nivel, acabado e instalación incluidos) o **Costo más margen del material** (costo de la caja a partir de una base más un monto por pulgada, con margen, instalación facturada aparte).",
            "**Tarifas por pie lineal** — Base, Pared / superior, Alto / despensa, Isla, un recargo por cajón, y si **La instalación está incluida en la tarifa**; desactivado, agrega una línea de instalación separada al presupuesto. Las tarifas de carpintería de clóset y de mueble de lavabo son opcionales y recaen en sus tarifas de cocina.",
            "**Multiplicadores de material** — aplicados al precio del gabinete; 1.0 es su base, 1.4 significa que ese material cuesta 40% más. Un recargo por esquina está al lado.",
            "**Acabado, entrega y demolición** — por puerta, por frente de cajón, un cargo fijo de entrega y el retiro por caja, cada uno activado o desactivado por diseño.",
          ] },
          { warning: "Las tarifas iniciales son los precios de un taller de gabinetes real, y la pantalla lo dice: estas son tarifas iniciales, no las suyas. Son lo bastante creíbles para salir sin que nadie lo note — fije las suyas antes de enviar un presupuesto de cocina. **Volver a las tarifas iniciales** las restaura." },
        ],
      },
      {
        id: "how-to",
        heading: "Cómo diseñar y cotizar una cocina",
        blocks: [
          { steps: [
            "Abra el presupuesto y presione **Diseñador de cocina**.",
            "Dibuje la habitación y coloque gabinetes, una isla, electrodomésticos; elija el acabado y los accesorios.",
            "Presione **Guardar y recalcular la cotización**. El dibujo se almacena y el grupo de ebanistería del presupuesto se reescribe a partir de él — los otros grupos de alcance del presupuesto (un baño, un piso) se dejan como están.",
            "Envíe el presupuesto. El dibujo se imprime en el PDF del presupuesto y después en la factura, a partir de las mismas formas que dibujó la pantalla.",
          ] },
          { p: "Un presupuesto que ya se envió es un compromiso, así que su diseño se abre en solo lectura y la pantalla lo dice. Para cambiar la distribución después de enviar, pulse **Duplicar** junto a esa nota: un borrador nuevo con el siguiente número, con el mismo cliente, idioma, líneas y dibujo — nada del historial de envío, nada de los cambios del cliente — se abre directo en su diseñador, desbloqueado. El presupuesto enviado queda intacto." },
        ],
      },
      {
        id: "client-link",
        heading: "La versión propia del cliente",
        blocks: [
          { p: "Una vez enviado el presupuesto, el diseñador muestra un **Enlace del cliente**. El propietario abre su cocina con el logotipo y el nombre de usted, mueve gabinetes y cambia el acabado, y guarda. No ve ningún precio y no puede enviar ninguno — el diseño vuelve con la tarificación de usted reincorporada y cualquier cosa con forma de monto descartada." },
          { p: "Quien creó el presupuesto, más los propietarios y administradores, reciben un correo cuando guarda, y el diseñador muestra **Tu cliente guardó su propia versión de este diseño** con la fecha y un botón **Cargar su versión**. Nada se recalcula hasta que usted la carga y guarda. La página del cliente hoy está solo en inglés. Vea [[the-kitchen-design-link|El enlace de diseño de cocina]]." },
        ],
      },
      {
        id: "who-can",
        heading: "Quién puede usarlo",
        blocks: [
          { p: "Diseñar y recalcular un presupuesto requiere Cotizaciones en **View, create, and edit**. Precios de gabinetes es una pantalla de configuración para propietarios, administradores, Gerentes y Despachadores. El cliente no necesita más que su enlace." },
        ],
      },
    ],
    faq: [
      { q: "Vendo reacabado de gabinetes. ¿Necesito Precios de gabinetes?", a: "No. El reacabado y el recubrimiento se cotizan desde sus propias listas de tarifas en Servicios y precios y Cotizaciones instantáneas; Precios de gabinetes alimenta solo al diseñador de cocina, y la pantalla permanece oculta hasta que el diseño de cocinas esté activado." },
      { q: "¿Un propietario puede diseñar una cocina antes de que yo haya cotizado?", a: "Sí. Con **Kitchen Design & New Installs** activado en Servicios, existe una página pública **Diseña tu cocina**: una tarjeta en Configuración → Comparte tus enlaces, una fila en su enlace para la bio y un enlace en el paso Diseño de cocina del formulario de cotización. Lo que dibuja llega como prospecto con el plano adjunto y sin precio — usted lo cotiza. El enlace del cliente de un presupuesto enviado es otra cosa: edita el diseño de ese presupuesto." },
      { q: "¿La edición del cliente cambia mi presupuesto?", a: "Nunca por sí sola. Es una segunda versión que usted puede cargar; el presupuesto solo se mueve cuando presiona Guardar y recalcular la cotización." },
    ],
  },

  "call-to-quote": {
    title: "De una llamada telefónica a un borrador de presupuesto",
    summary:
      "El recepcionista atiende la llamada y nunca cotiza un precio; después, un solo botón lee la grabación en el formulario de presupuesto instantáneo, lo calcula con su propia configuración y deja un borrador en Revisión de estimaciones — o le entrega el generador con lo que se oyó ya completado.",
    updated: "2026-09-12",
    intro: [
      "El recepcionista telefónico no puede decir una cifra — ni precio, ni rango, ni «normalmente alrededor de». Lo que sí puede hacer es tomar los detalles. Después de la llamada, en la pantalla **Recepcionista**, **Redactar un presupuesto a partir de esta llamada** lee la grabación como si el cliente hubiera llenado el formulario de presupuesto instantáneo, y el resto es la maquinaria que usted ya tiene: sus tarifas, su cola de revisión, su generador.",
    ],
    sections: [
      {
        id: "overview",
        heading: "Visión general",
        blocks: [
          { p: "La pantalla **Recepcionista** lista las llamadas que ha atendido por usted, y en qué quedaron, agrupadas en **Te necesita**, pendientes de usted y archivadas. Cada llamada muestra el número, la hora, la duración y el costo, el resumen, un botón **Escuchar**, y lo que produjo — **Guardado como prospecto**, una visita reservada, **Reservar una devolución de llamada**. En una llamada con transcripción, **Redactar un presupuesto a partir de esta llamada** es el botón del que trata este artículo." },
          { figure: "live:app-receptionist", caption: "Recepcionista — el registro de llamadas, con lo que produjo cada llamada y los botones que actúan sobre ella." },
          { note: "**Solo en FieldQuo.** Un presupuesto redactado a partir de lo que describió quien llamó, con cada valor rastreado hasta sus propias palabras, no aparece en la página de precios de Jobber, Housecall Pro, Projul, QuoteIQ ni ServiceTitan en ningún nivel." },
        ],
      },
      {
        id: "how-to",
        heading: "Cómo redactar un presupuesto a partir de una llamada",
        blocks: [
          { steps: [
            "Abra **Recepcionista** y busque la llamada. Presione **Escuchar** si quiere oírla primero.",
            "Presione **Redactar un presupuesto a partir de esta llamada**. Esto gasta crédito de IA, y por eso es un botón y no algo que corre al abrir la pantalla.",
            "Lea **Lo que oímos en esta llamada**: cada servicio y cada medida se muestran junto a las propias palabras de quien llamó, tomadas textualmente de la grabación, indicando si lo dijo o lo confirmó cuando el asistente se lo repitió.",
            "Siga el resultado — uno de los dos de abajo.",
          ] },
          { p: "El modelo solo puede elegir servicios de su lista activada, materiales entre las etiquetas que usted configuró, mejoras de su propia lista de tarifas, y medidas que pueda citar de boca de quien llamó. No puede inventar un servicio, escribir texto para el cliente, ni producir un precio — no hay ningún campo de precio en lo que se le da, y cualquier cosa con forma de monto que invente se elimina." },
        ],
      },
      {
        id: "outcomes",
        heading: "Los dos resultados",
        blocks: [
          { table: {
            head: ["Resultado", "Qué dice el panel", "Qué pasó"],
            rows: [
              ["Calculado", "**Calculado con su configuración de presupuesto instantáneo y a la espera de aprobación: borrador {number}**, con **Abrir la cola de revisión**", "La llamada traía todo lo que el formulario de presupuesto instantáneo de ese oficio necesita. Siguió el mismo camino que el formulario web de un propietario y dejó un borrador en Revisión de estimaciones, marcado **Tomado de una llamada telefónica** con un botón Escuchar. La cifra se muestra allí, junto a Aprobar, no aquí."],
              ["No calculado", "**No hay suficiente para calcularlo automáticamente: nadie preguntó por {fields}**, con **Abrir en el generador de presupuestos**", "Algo con lo que el oficio fija su precio no se mencionó. Nada se calculó y nada se creó; el generador se abre con lo que se oyó ya completado, y usted lo cotiza a mano."],
            ],
          } },
          { p: "Alguien que nunca dijo cuántas puertas tiene produce un formulario sin cantidad de puertas — no cero, no un promedio plausible. Una suposición multiplicada por una tarifa es un precio que alguien envía, así que en su lugar se listan las preguntas que faltan: son por lo que usted devuelve la llamada." },
          { bullets: [
            "**Añadido** — una mejora de su propia lista de tarifas, marcada en el borrador y cotizada por el generador.",
            "**También preguntaron por … Se parece a …: compruebe si corresponde a este presupuesto** — algo que se parece a lo que usted vende pero no pudo ubicarse automáticamente.",
            "**Nada en sus servicios, su lista de tarifas ni sus productos coincidió** — ni siquiera esto se descarta; queda en las notas de revisión del presupuesto, que el cliente nunca ve.",
          ] },
          { p: "Quien llamó se asocia a un cliente existente por teléfono o correo, o se añade a sus clientes, y el panel dice cuál de las dos. Su número de teléfono se registra con consentimiento para que el asistente pueda devolverle la llamada." },
        ],
      },
      {
        id: "after",
        heading: "Después del borrador",
        blocks: [
          { p: "Un borrador calculado se aprueba en [[estimate-reviews|Revisión de estimaciones]] y luego se envía como cualquier presupuesto. Si las devoluciones de llamada por presupuesto están activadas, el asistente puede llamar al cliente para confirmar y programar una vez que tenga el presupuesto por escrito — lee una cifra de un documento que se le envió por correo, y nunca anuncia una. Vea [[quote-callbacks|Devoluciones de llamada por presupuesto]]." },
        ],
      },
      {
        id: "who-can",
        heading: "Quién puede hacerlo",
        blocks: [
          { p: "La pantalla Recepcionista se muestra a cualquiera con Clientes y propiedades en **View full client and property info** o superior. Redactar el alcance es la primera mitad de escribir un presupuesto, así que el botón requiere Cotizaciones en **View, create, and edit**. La instalación debe tener la IA de FieldQuo configurada y la empresa debe tener crédito de IA; el panel lo dice cuando falta cualquiera de los dos." },
        ],
      },
    ],
    faq: [
      { q: "¿El recepcionista puede cotizar por teléfono?", a: "No, y no existe ninguna herramienta que pudiera usar para eso. Toma detalles y reserva visitas; el cálculo ocurre después, detrás de un botón que presionó una persona, y se revisa antes de enviarse." },
      { q: "¿Cuánto cuesta un borrador?", a: "Una lectura de IA de la llamada, cobrada contra su crédito de IA. Abrir la pantalla o releer un borrador existente es gratis; Leer la llamada otra vez gasta crédito de nuevo. Vea [[ai-credit-and-phone-credit|Crédito de IA y crédito telefónico]]." },
      { q: "¿Dónde se guarda la grabación?", a: "Detrás de un enlace de FieldQuo que verifica su sesión y su empresa. Nada de cara al cliente lleva la grabación, y el enlace crudo del proveedor nunca se muestra." },
    ],
  },

  "import-a-subcontractor-quote": {
    title: "Importar el presupuesto de un subcontratista",
    summary:
      "Cuando otra empresa de FieldQuo le envía un presupuesto, incorpórelo a uno de sus propios presupuestos como una línea de costo con margen — su cliente ve un solo precio, el subcontratista nunca ve su margen, y el costo llega al costeo del trabajo cuando el trabajo se gana.",
    updated: "2026-09-12",
    intro: [
      "Un contratista general recoge el presupuesto de un subcontratista y le cotiza al propietario un precio con margen. Cuando el subcontratista también usa FieldQuo, eso es un solo paso: abra el presupuesto que le envió, elija su presupuesto y su margen, y la línea de costo se escribe por usted — del lado del servidor, a partir de las cifras guardadas del subcontratista. El navegador nunca envía un monto de dinero.",
    ],
    sections: [
      {
        id: "overview",
        heading: "Visión general",
        blocks: [
          { p: "El subcontratista le envía su presupuesto como le envía un presupuesto a cualquier cliente. Cuando usted abre el enlace con sesión iniciada en FieldQuo como una empresa distinta, aparece un panel solo para contratistas debajo del documento — el propietario nunca lo ve, y el presupuesto de arriba se mantiene totalmente de marca blanca. El panel está en inglés en la pantalla de todos los idiomas." },
          { p: "Desde ahí, agrega el presupuesto a uno de sus propios presupuestos abiertos como un grupo de alcance **Subcontractors** cotizado a la cifra del subcontratista más su margen. Después, cuando su cliente aprueba y se crea el trabajo, el costo del subcontratista se convierte en un gasto del trabajo para llegar al costeo y al margen del trabajo." },
        ],
      },
      {
        id: "how-to",
        heading: "Cómo importar",
        blocks: [
          { steps: [
            "Abra el enlace del presupuesto que le envió el subcontratista con sesión iniciada en su empresa. Lo que importa es que tenga sesión iniciada en una empresa distinta a la del remitente — el panel nunca aparece en sus propios presupuestos.",
            "En el panel bajo el documento, elija el presupuesto de destino entre sus presupuestos abiertos (borrador o enviada). Si no tiene ninguno, cree un presupuesto primero.",
            "Elija un margen — 0, 10, 20 o 30 por ciento, o una cifra personalizada. El margen aumenta el costo; 0 lo pasa tal cual.",
            "Elija cómo se muestra al cliente: **One line** (el oficio al precio del cliente, nada sobre quién lo hizo) o **Itemised** (las descripciones de líneas del subcontratista, cada una ajustada para que el grupo sume el precio del cliente — los precios crudos del subcontratista nunca se muestran).",
            "Póngale una etiqueta si quiere («Electricidad»), y presione **Add to my quote**.",
          ] },
          { p: "El panel previsualiza su precio al cliente en vivo, para su referencia; lo que se guarda se calcula en el servidor a partir del total aceptado o cotizado del subcontratista. El margen se limita entre 0 y 1000 por ciento." },
        ],
      },
      {
        id: "on-your-quote",
        heading: "En su presupuesto después",
        blocks: [
          { bullets: [
            "La página del presupuesto muestra un panel **Costos de subcontratistas**: las cotizaciones que importó de otras empresas, su costo, su margen y el precio al cliente. **Editar el margen** cambia el precio al cliente; **Quitar este costo** retira el grupo.",
            "En el generador, el grupo importado está en solo lectura — el costo es fijo y el margen se edita en la página del presupuesto — pero cuenta en el total y sobrevive a un guardado.",
            "Las líneas de un presupuesto decidido están bloqueadas, así que una importación ya no puede editarse ni quitarse una vez que su cliente aceptó o rechazó.",
          ] },
        ],
      },
      {
        id: "what-the-sub-sees",
        heading: "Qué ve el subcontratista",
        blocks: [
          { p: "De su lado, el presupuesto muestra **Usado en la cotización de otra empresa** — un contratista añadió esta cotización a su propio proyecto como un costo — con un estado derivado del presupuesto de usted y nunca almacenado: **Pendiente de la aprobación de su cliente** mientras su presupuesto está abierto, **Confirmado** una vez aceptado su presupuesto o existiendo su trabajo o su factura, **No continúa** si su presupuesto se rechaza. Nunca ve su margen ni lo que le cobra al propietario." },
        ],
      },
      {
        id: "who-can",
        heading: "Quién puede importar",
        blocks: [
          { p: "Un miembro con sesión iniciada de una empresa distinta a la del remitente, con Cotizaciones en **View, create, and edit** — escribe una línea de costo en uno de sus presupuestos, lo que es una edición del presupuesto. Una sesión de soporte de solo lectura no puede importar." },
          { p: "Tener subcontratistas registrados, poner a uno en un trabajo a un precio acordado y seguir sus seguros es la pantalla Subcontratistas — vea [[subcontractors-and-insurance|Subcontratistas y seguros]]. Importar un presupuesto de un sistema que no es FieldQuo es [[import-a-quote-from-another-system|Importar un presupuesto de otro sistema]]." },
        ],
      },
    ],
    faq: [
      { q: "¿Qué cifra se importa — lo que cotizó o lo que negocié?", a: "Lo que usted aceptó en su presupuesto, si lo aceptó; de lo contrario el total que cotizó. Un precio renegociado es el que pasa." },
      { q: "¿El propietario puede notar que hay un subcontratista?", a: "No por el documento. Una sola línea muestra el oficio y un precio; el modo detallado muestra descripciones de trabajos con montos ajustados. Ninguno nombra al subcontratista ni muestra sus precios." },
      { q: "¿El subcontratista tiene que estar en FieldQuo?", a: "Para este panel, sí — lee su presupuesto guardado. Un PDF de un subcontratista en papel se cotiza a mano en el generador." },
    ],
  },

  "references-and-photos-in-the-quote-email": {
    title: "Referencias y fotos de antes y después en el correo del presupuesto",
    summary:
      "Dos secciones opcionales del correo que acompaña un presupuesto — clientes anteriores que aceptaron atender una llamada, y pares de fotos de trabajos terminados — configuradas una vez en Configuración → Correo de presupuesto y activadas o desactivadas por presupuesto.",
    updated: "2026-09-12",
    intro: [
      "El correo del presupuesto siempre lleva el alcance, lo que está incluido, cómo se desarrolla el trabajo y qué podría cambiar el precio — eso viene del presupuesto mismo y no tiene interruptor. **Configuración → Correo de presupuesto** agrega dos secciones opcionales que son suyas: **Referencias** y **Antes y después**. Este artículo explica qué hace cada una, cómo se activa, y la única regla que impide que una sección vacía llegue a un propietario.",
    ],
    sections: [
      {
        id: "overview",
        heading: "Visión general",
        blocks: [
          { p: "La pantalla abre con **Lo que el correo lleva siempre** — el alcance servicio por servicio con las líneas cotizadas, lo que incluye cada servicio, cómo se desarrolla el trabajo paso a paso, y qué podría cambiar el precio para los oficios que lo declaran — y lo remite a Servicios y precios para ese texto. Luego las dos secciones de abajo, cada una con un interruptor **Incluir en cada presupuesto nuevo**." },
          { figure: "live:app-settings-quote-email", caption: "Configuración → Correo de presupuesto — lo que el correo lleva siempre, y luego Referencias y los pares de antes y después." },
        ],
      },
      {
        id: "references",
        heading: "Referencias",
        blocks: [
          { p: "Clientes anteriores que aceptaron atender una llamada de un posible cliente: un **Nombre** y un **Teléfono**, impresos exactamente como usted los escribe. Presione **Agregar** por cada uno; **Quitar** retira uno." },
          { warning: "La pantalla lo dice y vale la pena repetirlo: incluya solo a personas que de verdad aceptaron estas llamadas. Su número va a cada propietario al que usted cotiza." },
        ],
      },
      {
        id: "before-and-after",
        heading: "Antes y después",
        blocks: [
          { p: "Pares de fotos de trabajos terminados. **Par nuevo — sube el antes y el después** abre dos casillas de carga, **Antes** y **Después**, con un pie de foto opcional. Las dos mitades son obligatorias — la mitad de un antes y después es la misma foto dos veces." },
        ],
      },
      {
        id: "per-quote",
        heading: "Por presupuesto: el panel Secciones del correo",
        blocks: [
          { p: "En cada presupuesto, un panel **Secciones del correo** muestra las dos partes opcionales con su estado — **Por defecto (activado)** o **Por defecto (desactivado)** según el ajuste de la empresa, o **Activado** / **Desactivado** si lo cambió para este presupuesto — y cuántos elementos irían, de **este presupuesto** o de **la lista de tu empresa**. Un presupuesto puede llevar sus propias referencias y pares además de los de la empresa." },
          { steps: [
            "Abra **Configuración → Correo de presupuesto** y agregue al menos una referencia o un par.",
            "Active **Incluir en cada presupuesto nuevo**. Los presupuestos nuevos a partir de ahora lo incluyen por defecto; los existentes conservan lo que tenían.",
            "En un presupuesto donde no deba ir, abra **Secciones del correo** y póngalo en **Desactivado** para ese presupuesto.",
          ] },
        ],
      },
      {
        id: "empty-rule",
        heading: "La regla de la sección vacía",
        blocks: [
          { p: "Una sección activada sin nada dentro nunca debe llegar a un propietario — y tampoco debe quitarse en silencio, porque usted marcó la casilla y creería que salió. Así que el envío se bloquea. La página del presupuesto dice que la sección está activada sin nada que mostrar, por lo que el presupuesto todavía no puede enviarse, y el envío mismo se detiene con **Una sección que incluiste está vacía** y dos salidas: **Agregar contenido** (que lo lleva a la configuración) o **Dejarlo fuera de este presupuesto**, y luego **Enviar ahora**." },
          { note: "La regla se aplica dos veces — antes de construir el correo y dentro del propio constructor del correo — para que ningún camino de envío futuro pueda poner un título sobre un espacio en blanco. Los correos de seguimiento de **Configuración → Seguimientos** no llevan ninguna de las dos secciones y no se ven afectados." },
        ],
      },
      {
        id: "language",
        heading: "El idioma, y quién puede cambiarlo",
        blocks: [
          { p: "El correo sale en el idioma del presupuesto, a nombre de su propia empresa — las referencias y los pies de foto se imprimen como los escribió, sin traducir. La pantalla de configuración es para propietarios, administradores, Gerentes y Despachadores; el interruptor por presupuesto forma parte de editar el presupuesto (Cotizaciones en **View, create, and edit**)." },
        ],
      },
    ],
    faq: [
      { q: "¿Estas secciones se imprimen en el PDF?", a: "No. Son secciones del correo de acompañamiento. El PDF es el documento mismo — vea [[the-quote-pdf|El PDF del presupuesto]]." },
      { q: "¿Puedo agregar una referencia a un solo presupuesto?", a: "Sí — el panel Secciones del correo en el presupuesto cuenta los elementos de este presupuesto además de los de la lista de su empresa." },
      { q: "Activé el interruptor y ahora nada se envía. ¿Por qué?", a: "La sección está activada sin nada dentro. Agregue una referencia o un par en Configuración → Correo de presupuesto, o déjela fuera de ese presupuesto, y envíe de nuevo." },
    ],
  },

  "scope-of-work-and-terms": {
    title: "Alcance del trabajo y condiciones de pago en cada presupuesto",
    summary:
      "Dos casillas en Configuración → Configuración de la empresa: un alcance del trabajo por defecto copiado en cada presupuesto nuevo y editable allí, y condiciones de pago impresas en cada presupuesto y factura — con plantillas por oficio para empezar y espacios entre corchetes que usted debe completar.",
    updated: "2026-09-12",
    intro: [
      "Un presupuesto que dice qué va a pasar — hasta dónde llega la excavación, quién se lleva la superficie vieja, cuánto cuesta un cambio — se lee como el de alguien que ya hizo el trabajo antes. La tarjeta **Alcance del trabajo y condiciones** en **Configuración → Configuración de la empresa** es donde usted lo escribe una vez. Cada presupuesto nuevo parte de ahí, y las condiciones de pago se adhieren a cada documento que envía.",
    ],
    sections: [
      {
        id: "overview",
        heading: "Visión general",
        blocks: [
          { p: "La tarjeta tiene dos campos. **Alcance del trabajo por defecto** se copia en cada presupuesto nuevo como su texto **Qué sigue** — editable en el presupuesto mismo, impreso en el documento después de los pasos del trabajo. **Condiciones de pago** es texto libre como «50% de depósito, saldo al terminar» o «Neto 30», impreso como sección de pago en presupuestos y facturas; cuando el texto describe un calendario, el documento lo presenta como tarjetas con los porcentajes en grande, y de lo contrario imprime su frase tal como está." },
          { figure: "live:app-settings-company", caption: "Configuración → Configuración de la empresa — la tarjeta Alcance del trabajo y condiciones arriba, y luego el calendario de pagos y los datos de la empresa." },
        ],
      },
      {
        id: "how-to",
        heading: "Cómo configurarlos",
        blocks: [
          { steps: [
            "Abra **Configuración → Configuración de la empresa** y busque **Alcance del trabajo y condiciones**.",
            "Bajo **Empieza desde una plantilla de oficio:**, presione **Añadir las condiciones de …** de su oficio — adoquinado y pavimento, sellado de entradas o retiro de nieve — o escriba el suyo en **Alcance del trabajo por defecto**. La plantilla se inserta como texto que luego edita; presionar el botón otra vez la quita.",
            "Reemplace cada valor entre [corchetes]. La tarjeta cuenta lo que queda por decidir y advierte que se imprimirá en el presupuesto exactamente como aparece.",
            "Escriba sus **Condiciones de pago**, y presione **Actualizar ajustes**.",
          ] },
          { warning: "Una plantilla sin editar se ve visiblemente incompleta a propósito. El plazo de garantía, el reparto del depósito, el tiempo de entrega y el cargo por cambios son suyos; una garantía por defecto es una cláusula contractual, no un detalle amable, así que FieldQuo los deja en blanco en lugar de afirmar uno por usted." },
        ],
      },
      {
        id: "what-each-changes",
        heading: "Qué cambia cada campo",
        blocks: [
          { table: {
            head: ["Campo", "Adónde va", "Si está vacío"],
            rows: [
              ["Alcance del trabajo por defecto", "La casilla Qué sigue de cada presupuesto nuevo, y luego la página del presupuesto y el PDF", "Los presupuestos no llevan ningún alcance por defecto; la casilla de cada presupuesto empieza vacía"],
              ["Condiciones de pago", "La sección de pago de cada presupuesto y factura, como tarjetas cuando se puede leer un calendario", "La sección de pago no aparece en los documentos"],
            ],
          } },
          { p: "Cambiar el valor por defecto no reescribe los presupuestos que ya existen — cada presupuesto conserva su propio texto, que puede editar en el generador bajo **Qué sigue**." },
          { note: "Si su empresa usa el **Calendario de pagos** estructurado de la misma pantalla, el texto de condiciones de pago se genera a partir de ese calendario para que el documento siempre coincida con lo que realmente se factura, y la casilla pasa a solo lectura. Desactive el calendario para volver a escribir las condiciones a mano. Vea [[deposits-and-payment-schedules|Depósitos y calendarios de pago]]." },
        ],
      },
      {
        id: "who-can",
        heading: "Quién puede verlo y cambiarlo",
        blocks: [
          { p: "Configuración → Configuración de la empresa es para propietarios, administradores, Gerentes y Despachadores. La misma tarjeta tiene además una vista de solo lectura para quien puede abrir la página pero no cambiarla — un estimador al que le preguntan por las condiciones en una puerta puede leer lo que dicen sus propios documentos, y se le indica pedirle a un propietario o administrador que complete los corchetes pendientes." },
        ],
      },
    ],
    faq: [
      { q: "¿El alcance del trabajo se traduce?", a: "No. Se imprime en el idioma en que lo escribió, en documentos de cualquier idioma. Una empresa que cotiza en dos idiomas mantiene dos versiones editando la casilla en cada presupuesto." },
      { q: "¿Qué plantillas existen?", a: "Adoquinado y pavimento, sellado de entradas y retiro de nieve. Los demás oficios escriben la suya — el texto de lo incluido por servicio está en Configuración → Servicios y precios." },
      { q: "¿El cliente puede ver los corchetes?", a: "Sí, si los deja — se imprimen exactamente como aparecen. Por eso la tarjeta los cuenta." },
    ],
  },

  "the-large-quote-alert": {
    title: "La alerta de cotización grande",
    summary:
      "Un correo a cada propietario y administrador cuando alguien del equipo crea un presupuesto por encima de un monto que usted fija — revisado una vez al día, desde Configuración → Notificaciones.",
    updated: "2026-09-12",
    intro: [
      "Un propietario que no redacta cada presupuesto quiere saber cuándo sale uno grande. La tarjeta **Cotización grande creada** en **Configuración → Notificaciones** es eso: un umbral, un interruptor, y un correo a los propietarios y administradores por cada presupuesto creado por encima.",
    ],
    sections: [
      {
        id: "overview",
        heading: "Visión general",
        blocks: [
          { p: "**Configuración → Notificaciones** define cuándo FieldQuo debe enviarle un correo sobre algo que ocurre en su cuenta: **Cotización grande creada** con su umbral, **Factura pagada**, los recordatorios de citas y las notificaciones del navegador. Este artículo trata de la primera tarjeta." },
          { figure: "live:app-settings-notifications", caption: "Configuración → Notificaciones — Cotización grande creada con su interruptor y su umbral, y luego Factura pagada y los recordatorios." },
        ],
      },
      {
        id: "how-to",
        heading: "Cómo configurarla",
        blocks: [
          { steps: [
            "Abra **Configuración → Notificaciones**.",
            "En **Cotización grande creada**, marque **Enviar esta alerta** y escriba el monto en **Avisarme por encima de**.",
            "Presione **Guardar**. Mientras no haya un umbral guardado, la tarjeta dice que aún no está configurado — no se envía ninguna alerta.",
          ] },
          { note: "La tarjeta lo dice sin rodeos: esto se ejecuta en un horario diario en lugar del instante en que se guarda un presupuesto, así que espere el correo dentro de un día." },
        ],
      },
      {
        id: "what-it-does",
        heading: "Qué hace",
        blocks: [
          { bullets: [
            "Una vez al día, FieldQuo busca los presupuestos creados en el último día cuyo total es igual o mayor que su umbral.",
            "Por cada uno, cada miembro activo con rol de propietario o administrador recibe un correo a nombre de la empresa, nombrando al cliente, el monto y su umbral. Los Gerentes y Despachadores no reciben correo.",
            "Los presupuestos registrados como trabajos pasados se omiten — un trabajo escrito hoy con un total de 2024 es contabilidad, no un presupuesto grande que acaba de llegar.",
            "Desmarcar **Enviar esta alerta** conserva el umbral y detiene los correos; nada más cambia.",
          ] },
          { p: "No existe un registro por presupuesto de haber alertado: la ventana diaria es lo que evita las repeticiones, y un presupuesto se reporta una vez, en la revisión posterior a su creación." },
        ],
      },
      {
        id: "who-can",
        heading: "Quién puede verla",
        blocks: [
          { p: "Configuración → Notificaciones es solo para propietarios y administradores — también son las únicas personas a las que la alerta envía correo. El correo está redactado en inglés." },
        ],
      },
    ],
    faq: [
      { q: "¿Se dispara con una edición que lleva un presupuesto por encima del umbral?", a: "No. Mira cuándo se creó el presupuesto, no cuándo se cambió por última vez." },
      { q: "¿Puedo enviarla a un estimador o a un gerente?", a: "Hoy no. Los destinatarios están fijados a los roles de propietario y administrador." },
      { q: "¿El monto es antes o después de impuestos?", a: "Compara el total del presupuesto — la cifra al pie del presupuesto, impuestos incluidos cuando aplica el impuesto." },
    ],
  },
};
