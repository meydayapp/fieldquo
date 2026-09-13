// content/help/es/what-your-clients-see-1.js
//
// Parte 1 de la categoría «what-your-clients-see» en español (ver el
// compositor, what-your-clients-see.js). Slugs de esta parte
// (lib/help/tree.js): nothing-says-fieldquo, the-quote-email,
// the-quote-approval-page, the-invoice-email-and-pay-page,
// the-client-portal-as-a-client, the-booking-page, managing-a-booked-visit,
// the-instant-estimate-page.
//
// Misma estructura que el inglés, artículo por artículo, bloque por bloque.
// Las palabras que lee el cliente vienen de los bloques `es` de
// lib/i18n/clientDocCopy.js, lib/i18n/emailCopy.js y lib/i18n/documentLabels.js;
// las palabras de las pantallas de configuración, del bloque `es` de
// app/i18n/appMessages.js.
export const ARTICLES = {
  "nothing-says-fieldquo": {
    title: "Nada dice FieldQuo",
    summary:
      "Cada presupuesto, factura, página y correo que ve un cliente lleva su logotipo, su color y su nombre — de dónde sale, cómo un solo color se convierte en un documento legible, y la corta lista de lugares donde puede aparecer el nombre FieldQuo.",
    updated: "2026-09-12",
    intro: [
      "Un cliente que compara tres contratistas no debería poder notar que dos de ellos usan el mismo software. Esa es la regla con la que está construida cada superficie de cliente en FieldQuo: el correo del presupuesto llega de su empresa, la página de aprobación va con su membrete, la página de la factura y el portal llevan su color, la página de reservas lleva su logotipo, y los mensajes de texto empiezan con su nombre. No hay logotipo de FieldQuo, ni línea de «con tecnología de», ni cuenta que el cliente deba crear.",
      "Este artículo reúne la regla de marca blanca en un solo lugar: qué lleva su nombre, cómo un color de marca se convierte en una paleta completa que sigue siendo legible en un teléfono en la entrada de una casa, y las excepciones, para que sepa exactamente dónde puede asomar el nombre FieldQuo.",
    ],
    sections: [
      {
        id: "overview",
        heading: "Resumen",
        blocks: [
          { p: "Todo parte de dos cosas que usted configura una vez en **Configuración → Marca**: un logotipo y un color **Principal**. Los documentos y las páginas que abre el cliente leen esos dos campos y nada más — no hay un tema por documento que mantener sincronizado, así que un presupuesto no puede parecer de FieldQuo mientras una factura parece suya. El nombre en la banda de marca, en la línea «De» del correo, en el pie de página y en la línea «¿Preguntas?» es el nombre de su empresa, tomado de **Configuración → Configuración de la empresa**." },
          { p: "Las páginas que abre el cliente están completamente fuera de la aplicación: sin navegación, sin inicio de sesión, nada que sugiera que tiene una cuenta en alguna parte. Un enlace de presupuesto abre un documento; un enlace de portal abre un estado de cuenta; un enlace de reserva abre un calendario. Cada una está escrita en el idioma del cliente, y cada una termina con su número de teléfono, no el nuestro." },
        ],
      },
      {
        id: "what-carries-your-name",
        heading: "Qué lleva su nombre",
        blocks: [
          { table: {
            head: ["Superficie", "Qué es suyo en ella"],
            rows: [
              ["El correo del presupuesto y el correo de la factura", "La línea «De» con el nombre de su empresa, su logotipo sobre una banda de marca en su color, su color en el botón, su teléfono, correo, sitio web y número fiscal en el pie de página."],
              ["La página de aprobación del presupuesto y el PDF", "La línea de marca en la parte superior, su logotipo y su nombre, su color en cada título, cada sección y la banda del total."],
              ["La página de la factura y el portal del cliente", "Su logotipo, «Cuenta de [cliente]», sus facturas y presupuestos, los botones Pagar en su color, y una línea «¿Preguntas?» con su teléfono y su correo."],
              ["La página de reservas y la página de la visita", "Su logotipo y su nombre arriba, su color en el día elegido y en los botones; su nombre en el asunto y el cuerpo del correo de confirmación."],
              ["La estimación instantánea, el formulario de solicitud de presupuesto y los embudos", "Su logotipo, su color, solo sus servicios — y nunca su lista de tarifas."],
              ["Su sitio web y su página de biografía", "Su subdominio, sus páginas, sus fotos, sus horarios; la única línea del pie de página se describe más abajo."],
              ["Los mensajes de texto (recordatorios, En camino)", "El nombre de su empresa al inicio del mensaje, y su número de teléfono para devolver la llamada en el texto de En camino. Las respuestas a estos textos no las lee nadie — solo STOP se procesa."],
            ],
          } },
          { note: "La redacción de las partes fijas — «Ver y aprobar su presupuesto», «Aprobar este presupuesto», «Saldo pendiente», «Cambiar la hora» — es de FieldQuo, traducida a cada idioma en que puede escribirse un documento. Usted no puede editar esas frases, y ninguna nombra al software." },
        ],
      },
      {
        id: "the-from-line",
        heading: "La línea «De», y adónde van las respuestas",
        blocks: [
          { p: "Cada correo que recibe un cliente sale a nombre de **Su empresa** en la línea «De». La dirección detrás del nombre depende de una sola cosa: si usted verificó su propio dominio en **Configuración → Dominio de correo**. Con un dominio verificado la dirección es suya — **quotes@sudominio.com**, salvo que haya elegido otra palabra antes de la @. Sin dominio, la dirección es la dirección de envío compartida de FieldQuo, siempre bajo el nombre de su empresa." },
          { p: "Las respuestas siempre le llegan a usted. La dirección de respuesta es el correo de su empresa en **Configuración → Configuración de la empresa**; si ese campo está vacío, se usa el correo de inicio de sesión del propietario de la cuenta, para que la respuesta de un cliente nunca desaparezca en un buzón que nadie lee." },
          { tip: "Verifique su dominio si puede. Es la única diferencia visible entre «su nombre en la dirección de FieldQuo» y «su nombre en su dirección», y ayuda a que el correo llegue a la bandeja de entrada y no a promociones. Vea [[send-from-your-own-domain|Enviar desde su propio dominio]]." },
        ],
      },
      {
        id: "how-the-colour-works",
        heading: "Cómo un color se convierte en un documento",
        blocks: [
          { p: "Usted elige un código de color. A partir de él FieldQuo deriva cada color de la página — la línea superior, los títulos de sección, el fondo detrás de una tarjeta de resumen, la banda del total y el botón — y mide el contraste de cada par texto-fondo antes de usarlo. Importa porque los contratistas eligen amarillo, blanco, negro y gris medio, y la regla ingenua «color oscuro, texto blanco» falla justo en esos. Una marca blanca igual obtiene una banda de total visible; un amarillo pálido, títulos legibles; un logotipo siempre descansa sobre una placa blanca dentro de la banda de marca, para que un logotipo azul marino nunca desaparezca en una barra azul marino." },
          { steps: [
            "Abra **Configuración → Marca**.",
            "En **Logotipo**, pulse **Subir logotipo** (PNG, JPG, WebP o SVG, hasta 8 MB).",
            "En **Colores de marca**, defina **Principal** — los botones, las barras de progreso y su nombre en el encabezado de los correos. **Secundario** y **Neutro** son opcionales y siguen valores predeterminados razonables.",
            "Revise **Cómo se verán tus documentos**, en **Claro** y en **Oscuro**. Esa vista previa usa el mismo cálculo que el presupuesto, la factura y los correos.",
          ] },
          { figure: "live:app-settings-branding", caption: "Configuración → Marca — la tarjeta Logotipo, la tarjeta Colores de marca con Principal, Secundario y Neutro, y la vista previa del documento." },
          { note: "El color de marca se usa en todo lo que ven sus clientes y **no dentro de la aplicación**: las pantallas de su equipo se mantienen neutras para que una marca llamativa nunca haga incómoda la oficina. Una empresa que no configuró ningún color recibe el azul marino predeterminado de FieldQuo en sus documentos — el único caso en que el color es nuestro. El correo de confirmación de reserva es la única carta con un encabezado oscuro fijo en lugar de su color; su nombre sigue estando en su asunto y en su primera línea." },
        ],
      },
      {
        id: "where-fieldquo-does-appear",
        heading: "Dónde sí aparece el nombre FieldQuo",
        blocks: [
          { p: "Las excepciones son pocas y cada una tiene su razón:" },
          { bullets: [
            "**El pie de página de un sitio web gratuito.** El sitio de una empresa que no está en un plan de pago lleva una pequeña línea **Sitio por FieldQuo** bajo el aviso de derechos. Los planes de pago no la llevan. Vea [[the-site-by-fieldquo-footer|El pie de página Sitio por FieldQuo]].",
            "**La página de referidos.** Su enlace de Referir abre una página dirigida a otro dueño de negocio que dice que usted usa FieldQuo — todo su propósito es recomendar el software. Vea [[the-referral-page|La página de referidos]].",
            "**Las direcciones web.** Los enlaces de presupuesto, portal, reserva y visita se abren en el dominio de FieldQuo, y su sitio web vive en suempresa.fieldquo.com. La página es suya; la barra de direcciones no.",
            "**La dirección de envío** cuando no ha verificado su propio dominio, como se explicó arriba. El nombre es suyo; lo que sigue a la @ no.",
            "**La página de pago de Stripe.** Un cliente que paga con tarjeta o desde una cuenta bancaria es llevado a la página alojada de Stripe para su cuenta conectada, a nombre de su empresa — esa página es de Stripe, y lo dice.",
          ] },
        ],
      },
      {
        id: "only-in-fieldquo",
        heading: "Por qué este artículo está bajo Solo en FieldQuo",
        blocks: [
          { p: "De las cinco páginas de precios con las que FieldQuo se compara — Jobber, Housecall Pro, ServiceTitan, Projul y QuoteIQ — ninguna indica, en ningún nivel, que los documentos y páginas que recibe el cliente lleven la marca del contratista en lugar de la del software. La página de Jobber menciona «Customize quotes with rich visuals and reviews», que FieldQuo interpreta como diseños de documentos, no como marca blanca. Esa es toda la afirmación: no figura en su página de precios, nunca «ellos no pueden hacerlo»." },
        ],
      },
    ],
    faq: [
      { q: "¿El cliente tiene que crear una cuenta en algún momento?", a: "No. Cada enlace es un token en la dirección — el presupuesto, el portal, la página de la visita. No hay contraseña, ni registro, ni cuenta de FieldQuo para un cliente." },
      { q: "¿Puedo quitar la línea Sitio por FieldQuo?", a: "Solo se muestra en una empresa que no está en un plan de pago. En un plan de pago no se muestra; no hay un interruptor aparte." },
      { q: "Mi color de marca es blanco. ¿Qué pasa?", a: "Cada color de texto se mide contra él, y donde el par falla la página sustituye una ficha neutra u oscurece el acento para el texto. El documento sigue siendo legible; simplemente lleva menos color. Revise la vista previa en Marca." },
      { q: "¿El idioma de la página depende del cliente o de mí?", a: "Del cliente. Un presupuesto conserva el idioma en que fue creado, y todo lo demás que recibe el cliente sigue su propio idioma en su ficha, y luego el idioma predeterminado de su empresa. Vea [[a-clients-language|El idioma de un cliente]]." },
    ],
  },

  "the-quote-email": {
    title: "El correo del presupuesto",
    summary:
      "Lo que llega a la bandeja del cliente cuando usted pulsa Enviar en un presupuesto: la línea «De», el asunto, el total y el botón de aprobación, el alcance y los pasos, las referencias y las fotos de antes y después opcionales, y el PDF adjunto.",
    updated: "2026-09-12",
    intro: [
      "Pulsar **Enviar** en un presupuesto envía un solo mensaje a la dirección del cliente, de parte de su empresa, en el idioma del presupuesto, con el PDF adjunto. No es un simple enlace. El correo lleva la sustancia del presupuesto — cuánto cuesta, qué incluye, cómo se realiza el trabajo — porque un cliente lee tres presupuestos uno junto a otro, y el que es solo un enlace se lee como la empresa que no se molestó.",
      "El botón de aprobación está justo debajo del total, antes de cualquier detalle, y otra vez al final. Hay exactamente una llamada a la acción y aparece dos veces.",
    ],
    sections: [
      {
        id: "overview",
        heading: "Resumen",
        blocks: [
          { p: "El correo se construye cuando usted pulsa **Enviar** (o **Enviar de nuevo**, o **Dar seguimiento**) en la página del presupuesto, y solo cuando el mensaje ha sido realmente aceptado para su entrega el presupuesto pasa a **Enviado**. Un envío que falla deja el presupuesto en borrador, conserva el botón Enviar y agrega una línea a sus notificaciones — el presupuesto nunca afirma en silencio haber salido." },
          { p: "El enlace del correo abre la página de aprobación. Si el presupuesto aún no tenía enlace de cliente, se crea al momento de enviar, así que un correo nunca puede llevar un enlace muerto. Vea [[the-quote-approval-page|La página de aprobación del presupuesto]] para lo que hace el cliente allí." },
          { figure: "live:app-settings-quote-email", caption: "Configuración → Correo de presupuesto — lo que el correo lleva siempre, la lista de Referencias con su interruptor Incluir en cada presupuesto nuevo, y los pares de antes y después." },
        ],
      },
      {
        id: "what-the-client-receives",
        heading: "Lo que recibe el cliente, de arriba abajo",
        blocks: [
          { bullets: [
            "**De:** el nombre de su empresa. **Asunto:** «Su presupuesto de [Su empresa] — Q-1042». Un seguimiento se titula «Seguimiento: presupuesto Q-1042 de [Su empresa]».",
            "**La banda de marca** en su color: su logotipo sobre una placa blanca a la izquierda, la palabra **PRESUPUESTO** y el número a la derecha.",
            "«Hola [nombre]:» y luego una línea de apertura: «Gracias por darnos la oportunidad de cotizar su proyecto. Todo lo que conversamos está en el enlace de abajo.»",
            "**TOTAL** con el monto, y «Válido hasta el [fecha]» cuando el presupuesto tiene vencimiento.",
            "El botón **Ver y aprobar su presupuesto**, con «O copie este enlace en su navegador:» y el enlace debajo, para un programa de correo que se come los botones.",
            "El alcance, servicio por servicio, con las líneas con precio; **Qué incluye** cada servicio; **Qué podría cambiar este precio** para los oficios que lo declaran; y **Cómo se realiza el trabajo**, paso a paso, con los plazos publicados.",
            "**Hable con clientes anteriores** — las referencias que usted anotó, nombre y teléfono tal como los escribió — cuando esa sección está activada para este presupuesto.",
            "**Antes y después** — hasta cuatro pares de fotos con sus pies de foto — cuando esa sección está activada.",
            "El botón otra vez, y luego el pie de página: «¿Preguntas? Responda a este correo o llame al [teléfono].», el nombre de su empresa, y su correo, teléfono, sitio web y número fiscal, según lo que haya completado.",
          ] },
          { p: "El PDF del presupuesto va adjunto como **Quote-Q-1042.pdf**, generado por el mismo motor que Descargar PDF y en el mismo idioma, para que el adjunto y la página digan lo mismo. Si el PDF no se puede generar, el correo sale igual — un presupuesto sin adjunto vale más que uno que nunca llega — y se avisa a soporte." },
          { note: "No hay bloque de financiamiento en el correo. Las condiciones de pago a plazos, cuando usted las ha ingresado, aparecen en la página de aprobación debajo del total, no en el mensaje." },
        ],
      },
      {
        id: "the-language",
        heading: "En qué idioma se escribe",
        blocks: [
          { p: "El correo va en el idioma del **presupuesto** — aquel en que fue creado — para que la nota de acompañamiento coincida con el documento que lleva. Un presupuesto en francés produce un correo en francés y un PDF en francés, sin importar en qué idioma trabaje usted. Cuando un presupuesto no tiene idioma propio, se usa el idioma del cliente en su ficha, y luego el predeterminado de su empresa. La moneda es siempre la suya: el idioma cambia el formato, nunca el dinero. Vea [[quote-language|Un presupuesto conserva su idioma]]." },
        ],
      },
      {
        id: "what-you-control",
        heading: "Lo que usted controla",
        blocks: [
          { p: "**Configuración → Correo de presupuesto** muestra lo que el correo lleva siempre — esas secciones vienen del propio presupuesto, así que no tienen interruptor: si el presupuesto lo dice, el correo lo dice. El alcance, qué incluye, los pasos y qué podría cambiar el precio se editan por oficio en **Configuración → Servicios y precios**. Las dos secciones opcionales son suyas para llenar y activar:" },
          { table: {
            head: ["Sección", "Qué es", "El interruptor"],
            rows: [
              ["**Referencias**", "Clientes anteriores que aceptaron recibir una llamada, con **Nombre** y **Teléfono**, impresos exactamente como usted los escribe. Se envían como máximo seis.", "**Incluir en cada presupuesto nuevo** define el valor predeterminado; el panel **Secciones del correo** de cada presupuesto puede ponerlo en **Activado** o **Desactivado** solo para ese presupuesto."],
              ["**Antes y después**", "Pares de fotos de trabajos terminados, ambas mitades obligatorias, con un **Pie de foto (opcional)**. Se envían como máximo cuatro pares.", "Igual: un valor predeterminado de la empresa, y una excepción por presupuesto en la página del presupuesto."],
            ],
          } },
          { warning: "Una sección **Activada** pero vacía bloquea el envío. La página del presupuesto dice que está activada sin nada que mostrar, así que el presupuesto aún no puede enviarse, y ofrece **Agregar contenido** o **Dejarlo fuera de esta cotización**, y luego **Enviar ahora**. Una sección vacía nunca se quita en silencio ni se envía como un título sobre un espacio en blanco." },
          { p: "La línea de consentimiento en la pantalla de configuración es una regla, no un adorno: «Pon en la lista solo a personas que de verdad aceptaron estas llamadas. Su número llega a cada propietario al que le presupuestas.»" },
        ],
      },
      {
        id: "when-it-cannot-be-sent",
        heading: "Cuándo un presupuesto no puede enviarse",
        blocks: [
          { bullets: [
            "El cliente no tiene correo electrónico en su ficha — agregue uno y luego envíe.",
            "El presupuesto es una estimación instantánea aún marcada **Requiere revisión** — confirme primero el precio en **Revisión de estimaciones**.",
            "El presupuesto dice que aplica impuesto pero no se pudo determinar una tasa para la dirección del cliente — el envío se detiene en lugar de prometer un total al que le falta el impuesto. Corrija la dirección en el cuadro y vuelva a intentar.",
            "Una sección opcional del correo está activada y vacía, como se explicó arriba.",
            "La empresa no completó el pago de su suscripción — una prueba sin tarjeta puede armar presupuestos, pero no enviarlos.",
          ] },
        ],
      },
      {
        id: "who-can-send-it",
        heading: "Quién puede enviarlo",
        blocks: [
          { p: "Enviar requiere el mismo acceso que editar un presupuesto: **Cotizaciones** en el nivel **ver, crear y editar** o superior — un propietario, un administrador, un Gerente, un Estimador, o un acceso personalizado con ese nivel. **Configuración → Correo de presupuesto** requiere, por su parte, el nivel Gerente o superior (un propietario, un administrador, un Gerente o un Despachador)." },
        ],
      },
    ],
    faq: [
      { q: "¿Puedo cambiar el texto del correo?", a: "Las frases fijas — el saludo, la línea de apertura, el botón — son de FieldQuo y no se editan. Lo que usted controla es el contenido: el texto del alcance por oficio, las referencias y las fotos. Los seguimientos automáticos usan en cambio sus propias plantillas de correo." },
      { q: "¿El cliente recibe una copia del PDF?", a: "Sí, adjunta al correo como Quote-[número].pdf, en el mismo idioma que el correo y la página." },
      { q: "El cliente dice que nunca lo recibió.", a: "Abra el presupuesto: si sigue en Borrador y el botón Enviar está ahí, el envío falló y sus notificaciones dicen por qué. Si dice Enviado, pídale revisar promociones y correo no deseado, o abra Obtener aprobación y cópiele directamente el enlace del cliente." },
      { q: "¿Por qué el correo está en francés si yo trabajo en inglés?", a: "Porque el presupuesto se creó en francés. El correo sigue al documento, no a su pantalla. Vea [[quote-language|Un presupuesto conserva su idioma]]." },
    ],
  },

  "the-quote-approval-page": {
    title: "La página de aprobación del presupuesto",
    summary:
      "La página que el cliente abre desde el correo del presupuesto: el documento con su membrete, los extras opcionales que puede marcar, la firma que da para aprobar, qué hace Rechazar, y qué pasa de su lado en el momento en que responde.",
    updated: "2026-09-12",
    intro: [
      "El enlace del correo del presupuesto abre una sola página: el presupuesto, presentado como un documento con su membrete, con dos botones al final — **Aprobar este presupuesto** y **Rechazar**. Está fuera de la aplicación a propósito. Sin navegación, sin inicio de sesión, sin marca FieldQuo compitiendo con la suya; debe leerse como un documento de la empresa que contrataron.",
      "La aprobación es una firma real. El cliente escribe su nombre, firma en un recuadro, marca un acuerdo que nombra el total, y confirma. Un toque en un teléfono a pleno sol no puede crear un contrato por accidente.",
    ],
    sections: [
      {
        id: "overview",
        heading: "Resumen",
        blocks: [
          { p: "La página es pública para quien tenga el enlace — un token largo y aleatorio, y la página se mantiene fuera de los buscadores. Muestra el presupuesto solo una vez enviado; el enlace de un borrador responde que el presupuesto aún no está listo. El idioma es el del presupuesto, para que la página, el PDF recibido y el correo de acompañamiento digan lo mismo con las mismas palabras." },
          { figure: "harness:client-quote-approval", caption: "La página de aprobación tal como la ve el cliente — la línea de marca, el logotipo y el teléfono de la empresa, PRESUPUESTO Q-1042, Preparado para, los grupos de trabajo con qué incluye, los términos explicados, Extras opcionales, Cómo se realiza el trabajo, Condiciones de pago, la banda TOTAL, y luego Aprobar este presupuesto y Rechazar." },
        ],
      },
      {
        id: "what-is-on-the-page",
        heading: "Qué hay en la página, de arriba abajo",
        blocks: [
          { bullets: [
            "La línea de marca, su logotipo (o su inicial sobre su color), su nombre y su teléfono; **PRESUPUESTO** y el número a la derecha.",
            "**Preparado para** el nombre del cliente, y **Válido hasta** la fecha cuando el presupuesto la tiene.",
            "Una tarjeta numerada por grupo de trabajo — el nombre del grupo y su subtotal, una descripción, las líneas con precio y cantidades, **Qué incluye**, y **Qué podría cambiar este precio** donde el oficio lo declara.",
            "**Los términos de este presupuesto, explicados** — un breve glosario de las palabras del oficio usadas arriba («Shaker», «Rift sawn»).",
            "**Extras opcionales** — «Marque lo que desee añadir. El total se actualiza sobre la marcha — no se cobra nada hasta que usted apruebe.» Cada extra tiene una descripción y un precio; uno gravable suma su impuesto al marcarse.",
            "**Cómo se realiza el trabajo** — los pasos numerados con su semana o su día, y sus notas de proceso.",
            "**Condiciones de pago** — su calendario de pagos en fichas («50 % Depósito para reservar», «50 % Saldo en la instalación») o su texto de condiciones; luego **Notas**.",
            "**Subtotal**, **Descuento**, **Impuestos** (o la razón de que no haya), «Incluye extras opcionales» cuando hay alguno marcado, y la banda **TOTAL**.",
            "**Pagar a plazos** — «Alrededor de $410 al mes», el plazo y la TAE, y «Solo es una estimación, según las condiciones indicadas por [Su empresa]…» — solo cuando usted ha ingresado una tasa y un plazo en financiamiento; si no, un panel simple de **Financiación** con su nota y un enlace **Ver opciones de financiación**, o nada.",
            "**Aprobar este presupuesto** y **Rechazar**; debajo, «¿Preguntas? Responda al correo o llame a [Su empresa] al [teléfono].»",
          ] },
        ],
      },
      {
        id: "approving",
        heading: "Cómo aprueba el cliente",
        blocks: [
          { steps: [
            "Marca los **Extras opcionales** que quiera. El total de la página se mueve al marcar; el navegador solo envía los identificadores de los extras — el servidor vuelve a calcular el precio con sus propias filas, así que nada en la página puede cambiar lo que se cobra.",
            "Pulsa **Aprobar este presupuesto**. La página pregunta «¿Aprobar este presupuesto por $21,212.89?» — «Incluye $640.00 en extras opcionales. Esto les indica que sigan adelante.» cuando hay extras marcados.",
            "Escribe **Su nombre completo**, firma en el recuadro **Firma**, y marca «Acepto que firmar aquí es mi firma electrónica y aprueba este presupuesto por $21,212.89.» El botón **Sí, aprobar** sigue inactivo hasta que las tres cosas estén hechas.",
            "La página pasa a **Aprobado — gracias**: «Se ha notificado a [Su empresa] y se pondrán en contacto sobre los próximos pasos.»",
          ] },
          { p: "La firma se guarda con el presupuesto como registro — el nombre, la firma trazada, la hora, la dirección IP y el navegador del cliente, y una huella de exactamente lo que aprobó (líneas, extras, totales). El PDF del presupuesto lleva entonces un bloque de **Aprobación** con la firma, el nombre, la fecha y «Firmado electrónicamente»." },
          { note: "Un presupuesto cuya fecha **Válido hasta** ya pasó no puede aprobarse: la página dice **Este presupuesto ha vencido** — «Comuníquese con [Su empresa] para un precio actualizado.» Lo mismo ocurre si vence entre que el cliente abre la página y pulsa el botón." },
        ],
      },
      {
        id: "declining",
        heading: "Rechazar",
        blocks: [
          { p: "**Rechazar** pregunta «¿Rechazar este presupuesto?» — «Siempre puede pedir un presupuesto revisado.» — y luego **Sí, rechazar**. La página pasa a **Presupuesto rechazado**: «Se ha notificado a [Su empresa]. Si fue un error, llámelos.» No hace falta firma para rechazar, y un presupuesto rechazado puede editarse y enviarse de nuevo." },
        ],
      },
      {
        id: "what-happens-on-your-side",
        heading: "Qué pasa de su lado",
        blocks: [
          { bullets: [
            "El presupuesto pasa a **Aprobado** (o **Rechazado**) con el total aceptado, extras incluidos. Los propietarios y administradores reciben un correo — «Sophie Dubois approved Q-1042 — plus $640.00 in extras» — con el PDF firmado adjunto y un enlace al presupuesto; aparece una notificación en la aplicación.",
            "El cliente recibe por correo una copia firmada: asunto «Aprobado — gracias — Q-1042», «Gracias por aprobar su presupuesto con [Su empresa]. Se adjunta una copia para sus registros.», de parte de su empresa.",
            "Se crea un **trabajo** a partir del presupuesto, listo para programar, y se genera una **factura** en borrador que refleja el presupuesto.",
            "Si su empresa tiene un calendario de pagos con una etapa de **Depósito para reservar**, esa etapa se dispara de inmediato: el cliente recibe por correo una solicitud por exactamente el depósito, con un enlace para pagarlo desde su portal. Vea [[deposits-and-payment-schedules|Depósitos y calendarios de pago]].",
            "El prospecto del que salió el presupuesto se marca **Ganado** o **Perdido**, y se crea una tarea de seguimiento para un presupuesto aprobado.",
          ] },
          { tip: "Si el cliente respondió por teléfono, abra **Obtener aprobación** en el presupuesto y use **Registrar su respuesta** — **La aprobaron** o **La rechazaron** — para que el flujo se mantenga correcto. La misma pantalla tiene **Enlace del cliente** con **Copiar**, **Vista previa de lo que ven**, y **Reemplazar enlace**, que anula el enlace anterior si lo recibió la persona equivocada (cualquier correo ya enviado deja de funcionar)." },
        ],
      },
      {
        id: "who-can-see-it",
        heading: "Quién puede verla",
        blocks: [
          { p: "La página en sí está abierta a quien tenga el enlace, y por eso el enlace solo se envía al cliente. De su lado, el presupuesto, su registro de firma y la pantalla Obtener aprobación siguen su acceso a **Cotizaciones**; registrar una respuesta telefónica requiere el mismo nivel que editar el presupuesto." },
        ],
      },
    ],
    faq: [
      { q: "¿El cliente puede cambiar el precio o las líneas?", a: "No. Puede marcar o desmarcar los extras opcionales que usted ofreció y nada más. El total se recalcula en el servidor a partir de sus precios guardados, diga lo que diga la página." },
      { q: "¿La firma es legalmente una firma?", a: "Es una firma electrónica con un registro de auditoría: nombre, firma trazada, hora, dirección IP, navegador y huella del documento aprobado, impresos en el bloque de Aprobación del PDF. Si eso satisface un contrato dado es una pregunta para su abogado, no para el software." },
      { q: "El cliente aprobó y luego cambió de opinión.", a: "Un presupuesto solo puede responderse una vez desde la página. Edite el presupuesto y envíelo de nuevo, o registre el cambio desde la página del presupuesto." },
      { q: "¿El cliente paga en esta página?", a: "No. La aprobación y el pago van por separado. Si tiene una etapa de depósito, la solicitud de depósito se envía por correo justo después de la aprobación con su propio enlace de pago; si no, la factura llega cuando usted la envía. Vea [[the-invoice-email-and-pay-page|El correo de la factura y la página de pago]]." },
    ],
  },

  "the-invoice-email-and-pay-page": {
    title: "El correo de la factura y la página de pago",
    summary:
      "Lo que recibe el cliente cuando usted envía una factura — un correo breve con el monto, la fecha de vencimiento y un botón Pagar en línea — y la página que abre, donde paga con tarjeta o desde una cuenta bancaria y ve la factura marcada como pagada.",
    updated: "2026-09-12",
    intro: [
      "Pulsar **Enviar** en una factura envía al cliente un mensaje breve de parte de su empresa, en el idioma de la factura: el monto a pagar, la fecha de vencimiento, y un solo botón. El botón abre la factura en el portal del cliente, donde toda la factura se presenta en sus colores y el dinero se cobra en la página de Stripe — a nombre de su empresa, en su propia cuenta bancaria.",
      "El correo es breve a propósito. A diferencia del correo del presupuesto, no lleva líneas ni adjunto: la página de la factura es el documento, y el único trabajo del correo es llevar al cliente hasta ella.",
    ],
    sections: [
      {
        id: "overview",
        heading: "Resumen",
        blocks: [
          { p: "Enviar requiere un cliente con correo electrónico, y rechaza dos cosas en lugar de adivinar: una factura ingresada como trabajo pasado (para esas no se envía nada), y una factura que dice que aplica impuesto pero no tiene tasa para la dirección del cliente. La factura pasa a **Enviada** solo cuando el mensaje se acepta para su entrega, y se le crea una tarea de cobro una semana después." },
          { p: "El enlace abre **la página de la factura** en el portal del cliente — una página sin inicio de sesión, vinculada al cliente por un token largo y aleatorio, fuera de los buscadores. Vea [[the-client-portal-as-a-client|El portal del cliente]] para la página de cuenta que está detrás." },
          { figure: "harness:client-portal", caption: "El portal del cliente — la fila de la factura con su botón Pagar, tal como la ve el cliente después de abrir el enlace del correo y volver a su cuenta." },
        ],
      },
      {
        id: "what-the-email-says",
        heading: "Qué dice el correo",
        blocks: [
          { bullets: [
            "**De:** el nombre de su empresa. **Asunto:** «Factura INV-2071 de [Su empresa] — $10,606.44 por pagar».",
            "La banda de marca en su color con su logotipo, la palabra **FACTURA** y el número.",
            "«Hola [nombre]:» y luego «Aquí está la factura INV-2071 por el trabajo realizado.» — o, cuando ya se pagó una parte, «Aquí está el saldo de la factura INV-2071, después del pago de $5,000.00 ya recibido. Muchas gracias.»",
            "Una nota cuando la hay: el mensaje que usted escribió en una solicitud de pago, o el nombre de la etapa («Depósito») en una solicitud del calendario de pagos.",
            "**MONTO A PAGAR** (o **SALDO PENDIENTE**) con la cifra, y luego «Vence el [fecha]» — o «Venció el [fecha]» en rojo una vez atrasada.",
            "El botón **Pagar en línea** cuando su cuenta de Stripe puede cobrar; si no, **Ver su factura**, seguido de «Por favor comuníquese con nosotros para coordinar el pago.»",
            "«Formas de pago aceptadas: Cash, E Transfer, Cheque.» — solo las formas que usted marcó en **Configuración → Pagos**, y solo si marcó alguna.",
            "«O copie este enlace en su navegador:» con el enlace, y luego el pie de página: «¿Preguntas? Responda a este correo o llame al [teléfono].», el nombre de su empresa, y su correo, teléfono, sitio web y número fiscal.",
          ] },
          { note: "No se adjunta ningún PDF, y el cliente no puede descargar uno desde el portal. El PDF de la factura es suyo para descargarlo desde la página de la factura y enviarlo a mano si un cliente pide un archivo." },
        ],
      },
      {
        id: "the-invoice-page",
        heading: "La página de la factura",
        blocks: [
          { bullets: [
            "**Volver a su cuenta**, y luego una tarjeta blanca con la línea de marca, su logotipo, nombre, teléfono y número fiscal; **FACTURA**, el número, **Fecha** y **Vence** (o **Venció** en rojo).",
            "Las líneas: descripción, cantidad y monto, una por fila — o «Sin desglose en esta factura.» Luego **Notas** cuando la factura las tiene.",
            "**Subtotal**, **Descuento**, **Impuestos** (una cifra, o **Por confirmar**, o **Ninguno**), **Total**, y **Pagado** como fila negativa cuando se registró un pago.",
            "Una banda en su color con la única cifra que importa: **SALDO PENDIENTE** y el monto — o el nombre de la etapa y su parte cuando el enlace vino de una solicitud del calendario de pagos — o **Pagada por completo** con el total.",
            "La franja de acción: los botones de pago descritos abajo, o «Por favor comuníquese con nosotros para coordinar el pago.» y las formas aceptadas cuando usted no puede cobrar con tarjeta, o un **Pagada por completo — gracias** en verde.",
          ] },
          { note: "La página del portal lista las líneas de la factura de forma plana. Los grupos de trabajo, qué incluye y los pasos que hacen de la factura la gemela del presupuesto están en el PDF y en su propia pantalla de factura — vea [[invoices-mirror-quotes|Las facturas reflejan los presupuestos]]." },
        ],
      },
      {
        id: "paying",
        heading: "Cómo paga el cliente",
        blocks: [
          { steps: [
            "Pulsa **Pagar $10,606.44** — o, una vez que Stripe activó los pagos bancarios en su cuenta, **Pagar $10,606.44 con tarjeta** o **Pagar $10,606.44 desde una cuenta bancaria**, con la nota «Un pago bancario tarda de 3 a 5 días hábiles en compensarse. Hasta entonces la factura aparece como pendiente.»",
            "Se abre la página alojada de Stripe a nombre de su empresa. El monto se calcula en el servidor a partir del saldo real de la factura (o de la parte de la etapa solicitada) — el navegador nunca envía un monto.",
            "Con tarjeta, vuelve a su cuenta con un «Pago recibido — gracias. Puede tardar un minuto en aparecer abajo.» en verde, la fila dice **Pagado**, y la página de la factura dice **Pagada por completo — gracias**.",
            "Desde una cuenta bancaria, vuelve a un «Pago bancario recibido: tarda de 3 a 5 días hábiles en compensarse. La factura aparecerá como pagada cuando se complete.» en ámbar. La fila dice **Pago bancario pendiente** hasta que llega el dinero; si el banco lo devuelve, la página dice «El pago bancario falló: [razón]. Puede intentarlo de nuevo o pagar con tarjeta.» y los botones vuelven.",
          ] },
          { table: {
            head: ["Método", "Cuándo se ofrece"],
            rows: [
              ["Tarjeta", "Siempre que su cuenta de Stripe pueda cobrar (Configuración → Pagos dice Stripe conectado · Activo)."],
              ["Cuenta bancaria — débito preautorizado en Canadá, ACH en Estados Unidos", "Una vez que Stripe activó la capacidad en su cuenta y su moneda de facturación coincide (CAD para Canadá, USD para Estados Unidos). Configuración → Pagos dice cuál es."],
              ["Pago a plazos (Affirm)", "Solo en la página de Stripe, junto a la tarjeta, cuando usted activó Ofrecer pago a plazos (Affirm), la factura está entre $50 y $30,000, y la moneda es USD o CAD."],
            ],
          } },
          { p: "El cliente nunca ve una comisión de procesamiento. La comisión se descuenta de su lado del pago; el total de la factura es lo que él paga. Vea [[payment-processing-fees-and-payouts|Comisiones de procesamiento y transferencias]]." },
          { warning: "FieldQuo no envía al cliente un recibo por correo tras un pago de factura ordinario — la confirmación es la propia página. A usted se le notifica, el pago queda registrado en la factura, y Stripe puede enviar su propio recibo según la configuración de su panel de Stripe." },
        ],
      },
      {
        id: "reminders-and-requests",
        heading: "Recordatorios y solicitudes de pago",
        blocks: [
          { bullets: [
            "**Solicitar pago** en la factura envía el mismo correo como recordatorio: asunto «$10,606.44 por pagar — factura INV-2071», «Un recordatorio: la factura INV-2071 tiene un saldo de $10,606.44.», con su nota opcional y el mismo botón.",
            "Una **etapa del calendario de pagos** (un depósito, un pago a mitad de obra) envía el mismo correo con el nombre de la etapa como nota y la parte de la etapa como monto; la página destaca entonces esa parte en lugar del saldo completo. Vea [[progress-payments-by-stage|Pagos progresivos por etapa]].",
            "Un **recordatorio automático de atraso** se envía solo si usted creó una regla de seguimiento para facturas vencidas, con una de sus propias plantillas de correo — de lo contrario no se envía nada. Vea [[invoice-reminders-and-chasing|Recordatorios y cobro de facturas]].",
          ] },
        ],
      },
      {
        id: "what-you-control",
        heading: "Lo que usted controla",
        blocks: [
          { table: {
            head: ["Dónde", "Qué cambia para el cliente"],
            rows: [
              ["Configuración → Pagos — Stripe", "Si el botón dice Pagar en línea o Ver su factura, y si la página ofrece tarjeta, cuenta bancaria y Affirm."],
              ["Configuración → Pagos — Formas de pago que aceptas", "La línea «Formas de pago aceptadas:» — Efectivo, Transferencia electrónica, Cheque — en el correo, la página y el PDF."],
              ["Configuración → Marca", "El logotipo, la banda de marca, el color del botón y la banda del saldo."],
              ["Configuración → Configuración de la empresa — Calendario de pagos", "Los nombres de etapa que el cliente ve destacados en una solicitud de depósito o de cuota."],
              ["El idioma del cliente", "El correo sigue el idioma de la factura; la página sigue el idioma del cliente en su ficha, y luego el predeterminado de su empresa."],
            ],
          } },
          { figure: "live:app-settings-payments", caption: "Configuración → Pagos — la cuenta de Stripe conectada, si los pagos bancarios están activos, y las formas de pago que acepta." },
        ],
      },
      {
        id: "who-can-send-it",
        heading: "Quién puede enviarla",
        blocks: [
          { p: "Enviar una factura o una solicitud de pago requiere **Facturas** en el nivel **ver, crear y editar** o superior. **Configuración → Pagos** es solo para propietarios y administradores." },
        ],
      },
    ],
    faq: [
      { q: "¿Por qué el correo dice Ver su factura en lugar de Pagar en línea?", a: "Stripe aún no habilitó los cobros en su cuenta. La página muestra entonces «Por favor comuníquese con nosotros para coordinar el pago.» y sus formas aceptadas. Configuración → Pagos dice qué está esperando Stripe." },
      { q: "¿Por qué la factura sigue sin pagar días después de que el cliente pagó?", a: "Pagó desde una cuenta bancaria. Un débito bancario tarda de 3 a 5 días hábiles en compensarse; la factura dice Pago bancario pendiente hasta que llega el dinero y solo entonces se marca como pagada." },
      { q: "¿El cliente puede pagar una parte del saldo?", a: "Solo lo que usted pida. Una solicitud del calendario de pagos pide exactamente la parte de esa etapa; de lo contrario el botón pide el saldo completo." },
      { q: "¿El cliente recibe un recibo?", a: "No de FieldQuo. Ve la página marcada Pagada por completo — gracias, y la fila de su cuenta dice Pagado. Un archivo de recibo es suyo para enviarlo a mano." },
    ],
  },

  "the-client-portal-as-a-client": {
    title: "El portal del cliente",
    summary:
      "La única página donde un cliente ve sus facturas, lo que aún debe y sus presupuestos — cómo llega, qué contiene, qué puede hacer y qué no, y el hecho de que no hay nada que configurar.",
    updated: "2026-09-12",
    intro: [
      "El portal del cliente es una sola página, con su membrete, titulada **Cuenta de [cliente]**: un saldo, las facturas que lo componen con sus botones Pagar, y los presupuestos con el estado de cada uno. Sin inicio de sesión, sin contraseña, sin aplicación — el enlace es la llave, y nunca vence.",
      "No hay nada que activar. Cada correo de factura ya lleva un enlace al portal, así que un cliente al que alguna vez se le envió una factura tiene un portal.",
    ],
    sections: [
      {
        id: "overview",
        heading: "Resumen",
        blocks: [
          { p: "La página está escrita en el idioma del cliente (su ficha, y luego el predeterminado de su empresa), formatea el dinero en su moneda, y deriva cada color de su color de marca, con el contraste medido. Se mantiene fuera de los buscadores y muestra solo lo que se le debe al cliente y lo que él debe — sin trabajos, sin visitas, sin fotos." },
          { figure: "harness:client-portal", caption: "El portal tal como lo ve el cliente — el logotipo de la empresa, Cuenta de Sophie Dubois, Saldo pendiente en 1 factura, la tarjeta Facturas con Pagar $10,606.44, y la tarjeta Presupuestos con las etiquetas Aprobado y Rechazado." },
        ],
      },
      {
        id: "how-the-client-gets-there",
        heading: "Cómo llega el cliente",
        blocks: [
          { bullets: [
            "El botón **Pagar en línea** / **Ver su factura** de cada correo de factura, solicitud de pago, solicitud de depósito o de cuota y factura de plan de servicio abre la página de la factura; **Volver a su cuenta** en la parte superior abre el portal.",
            "Después de pagar en la página de Stripe, el cliente vuelve al portal con un aviso de «Pago recibido».",
            "Un recordatorio automático de atraso construido con su propia plantilla puede llevar el mismo enlace de la factura.",
          ] },
          { note: "No hay ningún botón en la aplicación para copiar o enviar un enlace del portal, y los correos de presupuesto no lo llevan — al portal se llega por las facturas. El enlace se crea una vez por cliente y se reutiliza; FieldQuo no ofrece una forma de vencerlo o reemplazarlo desde la aplicación." },
        ],
      },
      {
        id: "what-is-on-the-page",
        heading: "Qué hay en la página",
        blocks: [
          { bullets: [
            "Su logotipo (o su inicial sobre su color), el nombre de su empresa, y **Cuenta de [cliente]**.",
            "**Saldo pendiente** — la suma de todas las facturas emitidas — y luego «En 2 facturas.» o «Nada pendiente. Gracias.»",
            "**Facturas** — una fila por factura: el número, el total, «$5,000.00 pagado» cuando se pagó una parte, «vence [fecha]», y a la derecha la misma acción que en la página de la factura: **Pagar $10,606.44** (o **Pagar … con tarjeta** y **Pagar … desde una cuenta bancaria**), **Pago bancario pendiente**, una marca **Pagado**, o la línea para coordinar el pago. Solo se lista la última versión de una factura modificada.",
            "**Presupuestos** — una fila por presupuesto enviado: el número, el total, la fecha, y una etiqueta — **Pendiente de su respuesta**, **Aprobado** o **Rechazado** — con un enlace **Revisar** que abre la página de aprobación mientras el presupuesto sigue esperando.",
            "El pie de página: «¿Preguntas sobre esto? Comuníquese con [Su empresa] al [teléfono] · [correo].»",
          ] },
        ],
      },
      {
        id: "what-the-client-can-do",
        heading: "Qué puede hacer el cliente, y qué no",
        blocks: [
          { p: "Desde el portal un cliente puede abrir una factura, pagarla (con tarjeta, desde una cuenta bancaria, o con Affirm en la página de Stripe), y abrir un presupuesto pendiente para aprobarlo o rechazarlo. Esa es toda la lista." },
          { bullets: [
            "No puede cambiar su nombre, dirección o correo — eso vive en su ficha de cliente, que usted edita.",
            "No puede descargar un PDF de una factura o un presupuesto desde el portal.",
            "No puede ver trabajos, visitas, citas, fotos ni un historial de pagos — el portal muestra solo facturas y presupuestos.",
            "No puede escribirle desde la página; el pie de página le da su teléfono y su correo.",
          ] },
        ],
      },
      {
        id: "what-you-control",
        heading: "Lo que usted controla",
        blocks: [
          { table: {
            head: ["Dónde", "Qué cambia en el portal"],
            rows: [
              ["Configuración → Marca y Configuración → Configuración de la empresa", "El logotipo, el color, el nombre, el teléfono y el correo del pie de página, el número fiscal en la página de la factura."],
              ["Configuración → Pagos", "Si aparecen los botones Pagar, si se ofrece un botón de cuenta bancaria, y las formas de pago sin tarjeta aceptadas."],
              ["El idioma del cliente y el predeterminado de su empresa", "El idioma de cada etiqueta de la página."],
              ["El envío", "Lo que se lista: una factura o un presupuesto en borrador nunca se muestra; solo los enviados."],
            ],
          } },
          { p: "No hay una pantalla de configuración del portal. FieldQuo no permite ocultar la tarjeta de presupuestos, agregar un mensaje ni desactivar el portal." },
        ],
      },
      {
        id: "who-can-see-it",
        heading: "Quién puede verlo",
        blocks: [
          { p: "Quien tenga el enlace — y por eso solo se envía a la dirección de correo del propio cliente. De su lado no hay nada que abrir: lo que el portal lista es exactamente las facturas y presupuestos que usted ya ve en **Facturas** y **Cotizaciones**." },
        ],
      },
    ],
    faq: [
      { q: "¿Cómo le envío a un cliente su enlace del portal?", a: "Envíele una factura, o pulse Solicitar pago en una que ya tenga. Ambos correos llevan el enlace. No hay un botón aparte para enviar el portal." },
      { q: "¿El enlace vence?", a: "No. Se crea una vez por cliente y se reutiliza en cada correo, y FieldQuo no ofrece una forma de reemplazarlo desde la aplicación." },
      { q: "¿El cliente puede ver su próxima visita en el portal?", a: "No. Las visitas se gestionan desde el enlace del correo de confirmación de la reserva — vea [[managing-a-booked-visit|Gestionar una visita reservada]]. El portal muestra solo facturas y presupuestos." },
    ],
  },

  "the-booking-page": {
    title: "La página de reservas",
    summary:
      "Lo que ve un cliente cuando abre su enlace de reservas: a quién o qué reservar, cómo reunirse, un calendario de disponibilidad real, sus datos, una tarifa de visita si usted la cobra, y la confirmación que sigue.",
    updated: "2026-09-12",
    intro: [
      "Su enlace de reservas abre una página con su logotipo, su nombre y la línea «Book an appointment». El cliente elige lo que quiere, elige una hora en un calendario que solo ofrece los espacios que su equipo realmente puede cumplir, deja sus datos, paga una tarifa de visita si usted la cobra, y lee «You're booked». El espacio aterriza en su calendario de citas con una insignia de «Client booking».",
      "El calendario no es una lista de deseos. Cada espacio se calcula a partir de las horas reservables que la persona definió en Configuración → Disponibilidad, menos sus reservas, sus citas y sus permisos aprobados, y — si usted lo activa — menos las horas a las que no podría llegar en auto desde el trabajo anterior.",
    ],
    sections: [
      {
        id: "overview",
        heading: "Resumen",
        blocks: [
          { p: "La misma página sirve tres puertas: el enlace en sí, el botón Reservar de su sitio web, y el fragmento para insertar de **Configuración → Página de reservas** para un sitio que ya tenga (dentro de su propia página, omite la franja del logotipo). El paso de Stripe para una tarifa siempre se abre en la ventana completa, nunca dentro de un marco." },
          { figure: "harness:client-booking-page", caption: "La página de reservas tal como la ve un cliente — el logotipo de la empresa y Book an appointment, Change service, Kitchen design consultation · 60 min, How would you like to meet?, Where should we come?, y el calendario con las horas de la mañana y la tarde de un día." },
          { note: "La página de reservas está escrita en inglés, sea cual sea el idioma de su empresa: solo las fichas de «¿Qué tipo de trabajo es?» y el campo de notas se traducen, según el idioma del navegador del visitante. El correo de confirmación y la página de la visita que siguen van en el idioma del cliente." },
        ],
      },
      {
        id: "the-steps",
        heading: "Qué hace el cliente",
        blocks: [
          { steps: [
            "**Elegir.** Si miembros de su equipo definieron horas reservables, la página pregunta con quién quiere reunirse y los lista con su próxima hora libre; si no, pregunta en qué puede ayudar y lista sus tipos de evento con su duración y su tarifa si la hay. Una empresa con un solo tipo de evento se salta este paso.",
            "**Elegir una hora.** La pregunta del modo — «Visit my place», «Phone call» o «Video call» — aparece solo cuando usted ofrece más de uno. Para una visita, un campo de dirección opcional permite ocultar las horas a las que no podría llegar a tiempo. Luego la cuadrícula del mes y las horas de un día bajo Mañana, Tarde y Noche.",
            "**Sus datos.** Su nombre, su correo (adonde se envía la confirmación), su teléfono (opcional), «¿Qué tipo de trabajo es?» cuando tiene servicios activados, y «¿Algo más que debamos saber?».",
            "**Confirmar.** El botón dice «Confirm booking» — o «Pay $49.00 & book» cuando el tipo de evento tiene una tarifa, tras una tarjeta de tarifa de visita: se paga ahora para reservar el lugar, y su empresa puede acreditarla en la factura si el trabajo sigue adelante.",
            "**You're booked.** Una confirmación va en camino a su correo, y su empresa se comunicará si algo cambia. Una reserva con pago muestra primero «One more step» y «Continue to secure payment» — el pago lo gestiona Stripe y el espacio se mantiene 30 minutos.",
          ] },
          { p: "Si dos personas van por el mismo espacio, la segunda lee que ese espacio acaba de ser reservado por otra persona y ve un calendario actualizado. Una empresa sin tipo de evento activo muestra que aún no configuró las reservas en línea, con su número de teléfono." },
        ],
      },
      {
        id: "what-decides-the-times",
        heading: "Qué decide las horas del calendario",
        blocks: [
          { bullets: [
            "**Las horas reservables** de la persona a la que pertenece el tipo de evento, definidas en **Configuración → Disponibilidad**. Una persona sin horas reservables no ofrece ningún espacio.",
            "**Lo que ya está en su calendario** — reservas confirmadas, citas programadas, y permisos aprobados, que bloquean el día completo.",
            "**El traslado**, cuando **No ofrezcas horarios a los que no puedas llegar en auto** está activado y el cliente dio una dirección: un espacio se oculta si no podría llegar desde el trabajo anterior (más su **Tiempo extra entre trabajos**), o desde allí al siguiente. Una dirección que no se puede ubicar muestra todas las horas y lo dice.",
            "Los espacios empiezan cada 15 minutos y deben terminar dentro de la ventana reservable; una reserva nueva puede hacerse para cualquier hora futura, sin aviso mínimo y sin límite de anticipación.",
            "Las horas se muestran en la zona horaria del visitante. La ventana de llegada que usted promete aparece en el correo de confirmación y en la página de la visita, no en el calendario.",
          ] },
        ],
      },
      {
        id: "the-visit-fee",
        heading: "La tarifa de visita",
        blocks: [
          { p: "Un tipo de evento puede llevar una **Tarifa de visita** y, opcionalmente, un **Precio promo** mostrado con el precio normal tachado mientras **Promo activada** esté marcado. La tarifa se cobra solo con tarjeta, en la página de Stripe, en su cuenta conectada; mientras el cliente paga, el espacio se mantiene 30 minutos y la cita se crea solo cuando el pago se completa. Una reserva que no se paga a tiempo se libera, y hasta entonces aparece en su panel como pendiente de pago." },
          { p: "La tarifa se cobra solo cuando Stripe puede cobrar en su cuenta; sin Stripe, el mismo tipo de evento es simplemente gratuito. Lo que pasa con la tarifa si el cliente cancela lo decide su política de **Cambios y cancelaciones** — vea [[managing-a-booked-visit|Gestionar una visita reservada]] y [[booking-fees-and-visit-deposits|Tarifas de reserva y depósitos de visita]]." },
        ],
      },
      {
        id: "after-they-book",
        heading: "Después de reservar",
        blocks: [
          { bullets: [
            "El cliente recibe un correo de su empresa, en su idioma: asunto «Confirmado: Kitchen design consultation con [Su empresa]», **Su cita está confirmada**, **Cuándo** (con su ventana de llegada, si promete una) y **Dónde**, y el botón para cambiar o cancelar la visita. FieldQuo no envía un mensaje de texto de confirmación; un texto de recordatorio sale solo si usted configuró uno.",
            "De su lado, el cliente se encuentra por su correo o se crea, y la visita aparece en **Citas** con una insignia de «Client booking», asignada a la persona dueña de ese calendario, con la dirección y las notas que escribió el cliente.",
            "FieldQuo no le envía correo ni notificación por una reserva nueva — el calendario es el registro. Sí recibe un correo cuando un cliente la mueve o la cancela más tarde.",
          ] },
        ],
      },
      {
        id: "what-you-control",
        heading: "Lo que usted controla",
        blocks: [
          { table: {
            head: ["Ajuste en Configuración → Página de reservas", "Qué cambia en la página"],
            rows: [
              ["**¿Cuánto dura una visita?**", "La duración de la consulta que FieldQuo crea para cada miembro del equipo que define horas reservables."],
              ["**¿Cómo pueden reunirse contigo los clientes?** — Ir a su domicilio · Llamada telefónica · Videollamada", "Qué modos de reunión ofrece la página; con más de uno, el cliente elige."],
              ["**No ofrezcas horarios a los que no puedas llegar en auto** y **Tiempo extra entre trabajos**", "Si una dirección oculta los espacios inalcanzables, y cuánto margen se suma al trayecto."],
              ["**¿Qué le prometes al cliente?** — Hora exacta o ± 15 / 30 / 60 min", "Lo que dicen el correo de confirmación y la página de la visita bajo Cuándo."],
              ["Cada tipo de evento — **Duración**, **Activo**, **Tarifa de visita**, **Precio promo**, **Promo activada**", "Qué se lista, por cuánto tiempo, y a qué precio; un tipo inactivo desaparece de la página."],
              ["**Nuevo tipo de evento**", "Agrega una clase de cita que un cliente puede reservar por su cuenta."],
            ],
          } },
          { figure: "live:app-settings-booking-page", caption: "Configuración → Página de reservas — el fragmento para insertar, ¿Cuánto dura una visita?, los modos de reunión, el traslado y la ventana de llegada, Cambios y cancelaciones, y una tarjeta por tipo de evento." },
        ],
      },
      {
        id: "who-can-see-it",
        heading: "Quién puede verla",
        blocks: [
          { p: "La página es pública. **Configuración → Página de reservas** requiere el nivel Gerente o superior — un propietario, un administrador, un Gerente o un Despachador. Cada miembro del equipo define sus propias horas reservables en **Configuración → Disponibilidad**, y eso es lo que lo pone en la página." },
        ],
      },
    ],
    faq: [
      { q: "¿Por qué la página muestra un selector de personas en lugar de mis tipos de evento?", a: "Porque al menos un miembro del equipo definió horas reservables; la página lista entonces a las personas, cada una con su propia consulta. Los tipos de evento se listan cuando nadie lo ha hecho." },
      { q: "¿Un cliente puede reservar para mañana por la mañana a medianoche de hoy?", a: "Sí, si el espacio está libre — la página no aplica aviso mínimo a una reserva nueva. El aviso que usted define en Cambios y cancelaciones aplica a mover o cancelar una, no a hacerla." },
      { q: "¿Adónde va la tarifa de visita?", a: "A su cuenta de Stripe conectada, como el pago de una factura. El correo de confirmación no la menciona; la página de la visita la muestra como un depósito pagado." },
      { q: "¿Puedo poner el calendario en mi propio sitio web?", a: "Sí — Configuración → Página de reservas tiene el fragmento para insertar. Vea [[embed-booking-and-quote-forms|Insertar los formularios de reserva y presupuesto en cualquier sitio]]." },
    ],
  },

  "managing-a-booked-visit": {
    title: "Gestionar una visita reservada",
    summary:
      "La página detrás del botón de cambiar o cancelar del correo de confirmación: qué ve el cliente, cómo mueve o cancela una visita dentro de su aviso, qué pasa con la tarifa de visita, y qué se le informa a usted.",
    updated: "2026-09-12",
    intro: [
      "Cada correo de confirmación de reserva lleva un solo botón para cambiar o cancelar la visita. Abre una página con su membrete con los detalles de la visita y dos opciones — **Cambiar la hora** y **Cancelar esta visita** — mientras su plazo de aviso lo permita. Dentro de ese plazo la página lo dice, con palabras que nombran su política, y le da en cambio su número de teléfono.",
      "El dinero sigue sus reglas, no las del cliente. Una tarifa pagada se traslada cuando mueve la visita, y en una cancelación se devuelve solo si usted lo activó y canceló a tiempo.",
    ],
    sections: [
      {
        id: "overview",
        heading: "Resumen",
        blocks: [
          { p: "El enlace es un token largo y aleatorio creado al confirmar la reserva; está en el correo de confirmación y en el correo enviado tras un cambio de hora, y en ningún mensaje de texto. La página está escrita en el idioma del presupuesto al que se refiere la visita, o si no en el idioma predeterminado de su empresa." },
          { figure: "harness:client-visit-manage", caption: "La página de la visita tal como la ve el cliente — Su visita, Kitchen design consultation, Sobre su presupuesto Q-1042, Cuándo con la ventana de llegada, Dónde con Vamos a su domicilio, Depósito de $49.00 pagado, y luego Cambiar la hora y Cancelar esta visita." },
        ],
      },
      {
        id: "what-is-on-the-page",
        heading: "Qué hay en la página",
        blocks: [
          { bullets: [
            "Su logotipo y su nombre, **Su visita**, el tipo de evento, y **Sobre su presupuesto Q-1042** cuando la visita está ligada a un presupuesto.",
            "**Cuándo** — la ventana de llegada que usted promete («entre 8:30 AM y 10:30 AM») o la hora exacta, en la zona horaria de su empresa.",
            "**Dónde** — la dirección con «Vamos a su domicilio», o «Llamada telefónica — le llamaremos», o «Videollamada — le enviaremos un enlace por correo».",
            "**Depósito de $49.00 pagado** cuando se cobró una tarifa de visita.",
            "**¿Necesita cambiar algo?** con **Cambiar la hora** y **Cancelar esta visita** — o, cuando la visita ya no puede cambiarse aquí, la razón y «Llame a [Su empresa] al [teléfono] — todavía pueden moverla por usted.»",
            "«¿Preguntas? Llame a [Su empresa] al [teléfono].»",
          ] },
        ],
      },
      {
        id: "changing-the-time",
        heading: "Cambiar la hora",
        blocks: [
          { steps: [
            "Pulsa **Cambiar la hora**. **Elija una nueva hora** muestra el mismo calendario que la página de reservas, ofreciendo solo espacios libres y al menos a su plazo de aviso de distancia.",
            "Elige un día y una hora y pulsa **Mover mi visita aquí** (o **Mantener mi hora actual** para retroceder).",
            "La página dice **Su visita se ha movido** — «Se ha avisado a [Su empresa], y le llegará una nueva confirmación.» Una tarifa ya pagada se traslada; no se cobra ni se devuelve nada.",
          ] },
          { p: "Si el espacio se lo llevó otra persona mientras tanto: «Esa hora acaba de ocuparse. Elija otra.» Si está demasiado cerca: «Esa hora no les da aviso suficiente. Elija una más tarde.»" },
        ],
      },
      {
        id: "cancelling",
        heading: "Cancelar, y qué pasa con la tarifa",
        blocks: [
          { p: "**Cancelar esta visita** pregunta «¿Cancelar esta visita?» — «Se avisará a [Su empresa] de inmediato y su hora volverá a quedar libre.» — con **Mantener mi visita** y **Sí, cancelar**. Bajo la pregunta, cuando se pagó una tarifa, una de tres frases dice qué hará su política con ella:" },
          { table: {
            head: ["Qué dice la página", "Cuándo"],
            rows: [
              ["«Su depósito de $49.00 se devolverá a la tarjeta con la que pagó.»", "**Devolver la tarifa de visita si cancelan a tiempo** está activado, y cancela con al menos el aviso de devolución."],
              ["«Su depósito de $49.00 no se devuelve automáticamente — póngase en contacto con ellos al respecto.»", "El interruptor de devolución está desactivado (el valor predeterminado), o está dentro del aviso de devolución."],
              ["«Su depósito de $49.00 ya fue devuelto.»", "Usted lo devolvió a mano antes de que cancelara."],
            ],
          } },
          { p: "Tras **Sí, cancelar**, la página dice **Visita cancelada** — «Se ha avisado a [Su empresa]. Si fue un error, póngase en contacto y le buscarán otra hora.» — y, cuando aplica una devolución, «Su depósito de $49.00 está en camino de vuelta. Puede tardar unos días en aparecer en su extracto.» La devolución es el monto realmente pagado, devuelto a la misma tarjeta; la comisión de procesamiento de la tarjeta no se le devuelve a usted. Si Stripe no puede hacer la devolución, no se cancela nada y la página lo dice." },
        ],
      },
      {
        id: "when-it-cannot-be-changed",
        heading: "Cuándo la página se niega",
        blocks: [
          { bullets: [
            "«[Su empresa] pide un aviso de al menos 24 horas, así que esta visita ya no se puede cambiar aquí.» — dentro de su plazo de aviso. El número es el suyo.",
            "«Esta visita ya tuvo lugar.» / «Esta visita ya fue cancelada.»",
            "«Esta visita aún no está confirmada — el pago no se ha completado.» — una tarifa todavía en proceso de pago.",
            "Un enlace desconocido o reemplazado da una página simple que indica que el enlace no es válido.",
          ] },
        ],
      },
      {
        id: "what-you-see",
        heading: "Qué ve usted de su lado",
        blocks: [
          { bullets: [
            "La cita se mueve o se marca como cancelada en **Citas**; el espacio anterior vuelve a estar disponible de inmediato.",
            "La dirección de correo de su empresa recibe una carta: una reserva se movió — «[Cliente] movió su Kitchen design consultation con el enlace de su correo de confirmación.» — o una reserva fue cancelada, con la mención de que la tarifa de visita de $49.00 se devolvió automáticamente según su política, o de que NO se devolvió.",
            "El cliente recibe el espejo: **Su visita se ha movido** con la nueva hora, o el aviso de cancelación con la frase sobre la tarifa.",
          ] },
          { note: "La carta de oficina va a la dirección de correo de la empresa en Configuración → Configuración de la empresa. No hay notificación en la aplicación por un cambio o una cancelación del cliente." },
        ],
      },
      {
        id: "what-you-control",
        heading: "Lo que usted controla",
        blocks: [
          { table: {
            head: ["Ajuste en Configuración → Página de reservas → Cambios y cancelaciones", "Qué hace"],
            rows: [
              ["**Aviso que necesita para cambiar o cancelar** (horas)", "Hasta qué cercanía de la visita la página sigue ofreciendo Cambiar la hora y Cancelar esta visita; 24 horas si nunca lo definió. Una hora nueva también debe estar al menos a esa distancia."],
              ["**Devolver la tarifa de visita si cancelan a tiempo**", "Desactivado hasta que usted lo active. Desactivado, una cancelación se hace igual y la tarifa se queda con usted."],
              ["**Aviso necesario para recuperar la tarifa** (horas)", "Solo con el interruptor activado. En blanco significa el mismo aviso de arriba; más largo crea un margen en el que aún puede cancelar pero la tarifa se queda con usted."],
              ["**¿Qué le prometes al cliente?**", "Si Cuándo muestra una hora exacta o una ventana de llegada."],
            ],
          } },
          { p: "Las líneas de vista previa bajo los campos le repiten la política con las palabras del cliente — «Los clientes pueden cancelar o mover una visita hasta 24 horas antes de que empiece. Después de eso tienen que llamarle.» — para que la frase en la página del cliente y su ajuste no puedan contradecirse." },
        ],
      },
      {
        id: "who-can-change-it",
        heading: "Quién puede cambiarla",
        blocks: [
          { p: "La página del cliente está abierta a quien tenga el enlace. La política en **Configuración → Página de reservas** requiere el nivel Gerente o superior — un propietario, un administrador, un Gerente o un Despachador." },
        ],
      },
    ],
    faq: [
      { q: "¿El cliente puede mover una visita a mañana a las 8 de esta noche?", a: "Solo si su aviso lo permite. Con 24 horas de aviso, tanto la visita que mueve como la hora nueva deben estar al menos a un día; si no, la página le dice que le llame." },
      { q: "El cliente canceló y la tarifa no se devolvió. ¿Por qué?", a: "El interruptor de devolución está desactivado por defecto — una tarifa de visita es su dinero desde el momento en que se cobra. Active Devolver la tarifa de visita si cancelan a tiempo, o devuélvala a mano desde el pago." },
      { q: "¿Mover una visita cobra algo?", a: "No. Una tarifa ya pagada se traslada a la hora nueva; la página del cliente y ambos correos lo dicen." },
    ],
  },

  "the-instant-estimate-page": {
    title: "La página de estimación instantánea",
    summary:
      "Lo que ve un cliente en su enlace de estimación instantánea: las preguntas por oficio, las fotos que exige, el rango que muestra — o que a propósito no muestra — el correo que recibe, y la revisión que hace su equipo antes de que algo se convierta en presupuesto.",
    updated: "2026-09-12",
    intro: [
      "Su enlace de estimación instantánea abre una página titulada «Get an instant estimate»: un formulario a la izquierda, un panel de estimación a la derecha. El cliente elige un oficio, describe el trabajo, agrega fotos y sus datos, y — según lo que usted eligió para ese oficio — ve un rango estimado mientras escribe, después de enviar, o nunca. Cada envío aterriza en su pantalla de **Revisión de estimaciones** y no puede enviarse como presupuesto hasta que una persona confirme el precio.",
      "Dos cosas nunca están en esta página: una lista de tarifas, y una cifra única. El punto de acceso público devuelve sus servicios y sus preguntas, nunca sus tarifas; lo que ve el cliente es un rango calculado en el servidor a partir de sus propios números.",
    ],
    sections: [
      {
        id: "overview",
        heading: "Resumen",
        blocks: [
          { p: "La página lleva su logotipo, su nombre y su color, y — a diferencia de un enlace de presupuesto o de portal — no está oculta de los buscadores. Mediante el fragmento para insertar de **Configuración → Cotizaciones instantáneas** también se coloca dentro de cualquier sitio web que ya tenga. Un oficio aparece en ella solo cuando su tarjeta está **Activado** y FieldQuo puede producir realmente un número a partir de las tarifas que usted guardó." },
          { figure: "harness:client-instant-estimate", caption: "La estimación instantánea tal como la ve un cliente — el logotipo de la empresa, el título «Get an instant estimate», la elección del oficio, las preguntas sobre la propiedad, los rangos de presupuesto, la dirección del trabajo, los datos de contacto, y el panel de estimación que espera a la derecha." },
          { note: "La página y su correo existen solo en inglés y en francés, según el idioma predeterminado de su empresa — y en francés, las preguntas del formulario se quedan en inglés mientras el panel de estimación, los mensajes y el correo se traducen. Una empresa cuyo idioma predeterminado es el español recibe la página en inglés." },
        ],
      },
      {
        id: "what-the-homeowner-fills-in",
        heading: "Qué completa el cliente",
        blocks: [
          { bullets: [
            "**What do you need?** — sus oficios activos como fichas (techos, renovación de gabinetes, pintura, retiro de escombros, y así sucesivamente).",
            "**Tell us about the property** — las preguntas de ese oficio: una dirección para techos (el techo se mide con imágenes satelitales), un césped trazado en un mapa para el corte, un área en pies cuadrados con una opción de estado o de acceso, cantidades de puertas y cajones para gabinetes, un número de escalones, o los artículos a retirar.",
            "**Which option?** — los materiales que usted tarifó, solo por nombre, cuando hay más de uno.",
            "**Your budget** — cuatro rangos en su moneda («Under $1,000», «$1,000 – $5,000» …). El navegador envía qué rango, nunca un monto.",
            "**Where's the job?** — una dirección con autocompletado (techos ya tiene una).",
            "**Your details** — un nombre y un correo o un número de teléfono.",
            "**Photos** — se exige al menos una foto, un video o un plano.",
            "El botón: «Get my estimate», o «Reveal my estimate» cuando el rango se muestra después de enviar. Mientras falte algo, lo enumera, hasta la foto que falta.",
          ] },
          { p: "El formulario no pregunta cuándo quieren que se haga el trabajo — esa es una conversación para el presupuesto." },
        ],
      },
      {
        id: "what-they-see",
        heading: "Qué ven, según su elección por oficio",
        blocks: [
          { table: {
            head: ["Lo que ve el propietario (Configuración → Cotizaciones instantáneas)", "En la página", "Después de enviar, y en el correo"],
            rows: [
              ["**No mostrar un precio**", "Un mensaje de que no se publican precios en línea para ese servicio: que deje sus datos y se le confirmará el precio en breve.", "Un mensaje de que no se muestra precio porque cada trabajo se revisa y el presupuesto lo envía la propia empresa. El correo dice que el presupuesto se está preparando, sin cifra."],
              ["**Mostrar el rango después de enviar**", "Un «$X,XXX – $X,XXX» difuminado con un candado y la invitación a enviar para ver la estimación. La cifra nunca se envía a la página antes del envío.", "El rango aparece en el panel, y el correo lo lleva."],
              ["**Mostrar un rango estimado**", "El rango se actualiza mientras describen el trabajo, antes de cualquier dato de contacto.", "El mismo rango, en la página y en el correo."],
            ],
          } },
          { p: "Un rango se lee como rango estimado, «$4,200 – $5,500» en su moneda, y luego de qué se midió y una frase que dice que es una estimación, no un presupuesto final, y que su empresa lo confirmará antes de cualquier compromiso. Si el trabajo cae bajo su cargo mínimo, el panel lo dice. Después de enviar, una tarjeta de confirmación dice que su empresa tiene sus datos y confirmará su presupuesto en breve — con una referencia Q-2026-0042, y un panel para reservar una visita cuando su página de reservas está configurada." },
          { p: "El financiamiento, cuando usted lo activó, es una frase en sus propias palabras y un botón opcional para ver las opciones de financiación. En esta página no se muestra ninguna cuota mensual; esa aparece solo en la página de aprobación del presupuesto, cuando usted ingresó una tasa y un plazo." },
        ],
      },
      {
        id: "after-they-submit",
        heading: "Después de enviar",
        blocks: [
          { bullets: [
            "Si dio un correo, recibe «Your estimate from [Su empresa]» de parte de su empresa — el rango en un recuadro marcado como antes de impuestos cuando se mostró en la página, la misma advertencia, un botón para reservar una visita cuando usted toma reservas, y la referencia.",
            "De su lado, se crea un presupuesto en borrador marcado **Requiere revisión**, con el rango que vio el cliente, su presupuesto declarado, la medición, sus fotos y un prospecto puntuado según el rango de presupuesto. Se avisa a todos los que pueden aprobar estimaciones: la estimación Q-2026-0042 para [cliente] está esperando aprobación.",
            "El presupuesto espera en **Revisión de estimaciones** con el rango que vio el cliente y su presupuesto, y una cifra **Aprobar en** que usted puede cambiar antes de pulsar **Aprobar**. Hasta entonces, **Enviar** en el presupuesto se niega: esta estimación instantánea aún no está aprobada — confirme el precio en Revisión de estimaciones y luego envíe. El enlace para compartir se niega de la misma forma.",
            "Una vez aprobado, el presupuesto dice **Aprobada — lista para enviar** y sale como cualquier otro. Vea [[estimate-reviews|Revisión de estimaciones]].",
          ] },
        ],
      },
      {
        id: "what-is-never-shown",
        heading: "Qué nunca se muestra",
        blocks: [
          { p: "La página pública recibe sus oficios, sus preguntas, los nombres de sus materiales y sus rangos de presupuesto — nunca una tarifa, un recargo o un mínimo. Cada cifra se calcula en el servidor a partir de las filas que usted guardó, y el navegador solo envía cantidades, una dirección o un contorno, y un rango de presupuesto. Publicar una lista de tarifas abiertamente se la entregaría a cada competidor de la ciudad; la página está construida para que eso sea imposible." },
        ],
      },
      {
        id: "what-you-control",
        heading: "Lo que usted controla",
        blocks: [
          { table: {
            head: ["En Configuración → Cotizaciones instantáneas", "Qué cambia"],
            rows: [
              ["**Activado** / **Desactivado** en cada tarjeta de oficio, y **Guardar y activar**", "Si el oficio se ofrece. Una tarjeta cuyas tarifas no pueden producir un número dice «Los propietarios todavía no pueden obtener un precio para esto.» y no puede activarse."],
              ["**Lo que ve el propietario**", "Los tres modos de la tabla anterior, por oficio. El valor predeterminado es No mostrar un precio."],
              ["**Rangos de presupuesto**", "Los tres cortes detrás de las cuatro fichas entre las que elige el cliente."],
              ["**Materiales y precios de venta**, los recargos, **Amplitud del rango (±)** y **Cargo mínimo**", "Los números a partir de los cuales se calcula el rango, y su amplitud."],
              ["**Financiamiento**", "La frase, el enlace del proveedor, y — para la página de aprobación — su tasa y su plazo declarados."],
              ["**Ver lo que ven los propietarios** y el fragmento para insertar", "Abre la página pública; el fragmento la coloca en su propio sitio."],
            ],
          } },
          { figure: "live:app-settings-instant-quotes", caption: "Configuración → Cotizaciones instantáneas — el conteo de servicios activos, Ver lo que ven los propietarios, el fragmento para insertar, y una tarjeta por oficio con su interruptor, Lo que ve el propietario, y las tarifas." },
        ],
      },
      {
        id: "who-can-see-it",
        heading: "Quién puede verla",
        blocks: [
          { p: "La página es pública. Abrir **Configuración → Cotizaciones instantáneas** requiere la opción de precios en su acceso — un Estimador puede leerla, la Cuadrilla no — y editar las tarifas o activar un oficio es solo para propietarios y administradores. Aprobar una estimación en Revisión de estimaciones requiere el nivel Gerente o superior." },
        ],
      },
    ],
    faq: [
      { q: "¿Un cliente puede ver mis tarifas?", a: "No. La página recibe servicios, preguntas, nombres de materiales y rangos de presupuesto; cada cifra se calcula en el servidor a partir de tarifas que nunca salen de él." },
      { q: "¿Por qué un oficio no aparece en la página?", a: "Su tarjeta está Desactivado, o sus tarifas aún no pueden producir un número — la tarjeta dice qué falta — o, para pintura, ni Pintura interior ni Pintura exterior está activada en Servicios y precios." },
      { q: "¿El rango es un presupuesto?", a: "No. Es un borrador marcado Requiere revisión; una persona confirma el precio en Revisión de estimaciones antes de que pueda enviarse, y tanto la página como el correo se lo dicen al cliente." },
      { q: "¿Por qué la página está en inglés para mi empresa hispanohablante?", a: "Sigue el idioma predeterminado de su empresa, y existe solo en inglés y en francés. Con el predeterminado en español, la página y su correo se muestran en inglés; hoy FieldQuo no tiene una versión en español de esta página." },
    ],
  },
};
