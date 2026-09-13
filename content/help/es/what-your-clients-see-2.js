// content/help/es/what-your-clients-see-2.js
//
// Parte 2 de la categoría «what-your-clients-see» en español (ver el
// compositor, what-your-clients-see.js). Misma estructura que el inglés,
// artículo por artículo: mismos slugs, mismas secciones en el mismo orden,
// mismos bloques, mismas figuras — scripts/check-help-centre.mjs compara los
// dos. Las palabras en pantalla vienen del bloque `es` de
// app/i18n/appMessages.js; lo que el cliente ve, de lib/i18n/clientDocCopy.js,
// lib/links/labels.js, lib/site/siteCopy.js, lib/reviews/reviewEmail.js y
// lib/sms/templates.js.
export const ARTICLES = {
  "the-self-quote-form-as-a-client": {
    title: "El formulario de solicitud de presupuesto",
    summary:
      "Qué ve un propietario de vivienda cuando abre su enlace Solicitar una cotización: tres pasos cortos, ningún precio, una confirmación con su papelería, y un prospecto en su pipeline.",
    updated: "2026-09-12",
    intro: [
      "Su enlace **Solicitar una cotización** es un formulario público que un desconocido puede llenar desde su sitio web, una publicación de Facebook o la parte trasera de la camioneta. Lleva su logotipo, su nombre y su color de marca; nada en él dice FieldQuo. Pide el servicio, el tamaño aproximado del trabajo, y una forma de responder, en ese orden, porque alguien que compara tres contratistas elegirá un servicio antes de entregar una dirección de correo.",
      "Nunca muestra un precio. El formulario produce un **prospecto**, no un presupuesto: al propietario se le dice que una persona pondrá precio al trabajo, y lo que escribió aterriza en su tablero de Prospectos con el tamaño del trabajo ya conocido.",
    ],
    sections: [
      {
        id: "overview",
        heading: "Resumen",
        blocks: [
          { p: "El formulario vive en el enlace propio de su empresa (la tarjeta **Solicitar una cotización** en **Configuración → Comparte tus enlaces** se lo da, con un fragmento de código para insertarlo en un sitio web que ya tenga). Está escrito en el idioma de su empresa y ordenado igual que su presupuesto: franja de identidad arriba, una línea de progreso de tres puntos, y luego un paso a la vez." },
          { figure: "harness:client-self-quote-form", caption: "El formulario de solicitud de presupuesto como lo ve un propietario — el logotipo y el nombre de la empresa, y luego el paso 1, «¿En qué podemos ayudarle?», que lista solo los servicios que la empresa ha activado." },
          { note: "La lista de servicios es la que activó en **Configuración → Servicios y precios**. Un visitante no puede solicitar un trabajo que usted no hace, y la tarifa detrás de cada servicio nunca sale de esa pantalla de configuración: el punto de acceso público devuelve servicios y campos de captura, no precios." },
        ],
      },
      {
        id: "the-three-steps",
        heading: "Qué llena el propietario",
        blocks: [
          { steps: [
            "**¿En qué podemos ayudarle?**: un toque en un servicio. Una empresa de gabinetes que ha activado Diseño de cocinas muestra aquí también una línea: «¿Prefiere dibujarla? Diseñe su cocina usted mismo y envíenos el plano →».",
            "**¿Qué tan grande es?**: como máximo tres campos numéricos o de opción para ese servicio (puertas, pies cuadrados, habitaciones), luego dos filas de chips que siempre se preguntan: **¿Cuándo espera empezar?** (Lo antes posible · En 2 semanas · En los próximos 1 a 3 meses · Solo estoy consultando) y **¿Presupuesto aproximado?** (cuatro rangos en su moneda, más Todavía no lo sé — opcional), y un texto libre **¿Algo más que debamos saber?**.",
            "**¿Adónde se lo enviamos?**: un nombre, y un correo o un número de teléfono («Con un correo o un teléfono es suficiente.»), una dirección opcional con autocompletado de Google, y **Añadir fotos, un video o un plano PDF**. El botón dice **Enviar mi solicitud**, y debajo: «Sin compromiso. [Su empresa] le responderá con un precio.»",
          ] },
          { p: "Una dirección elegida del autocompletado lleva su ciudad, provincia y país al prospecto, así que el cliente que cree a partir de él ya tiene una jurisdicción fiscal. Una dirección escrita a mano se envía igual: el formulario nunca depende de que Google esté disponible." },
        ],
      },
      {
        id: "after-they-press-send",
        heading: "Qué pasa después de Enviar",
        blocks: [
          { bullets: [
            "La pantalla se convierte en un documento **Solicitud recibida** con sus colores: su logotipo y su teléfono, la palabra **Solicitud**, una referencia, un panel «preparado para» con lo que escribió, **Lo que solicitó**, y **Qué pasa ahora** en tres pasos numerados: usted lo lee, usted le pone precio, él recibe un presupuesto. Una línea dice «Todavía no se muestra ningún precio — esta solicitud no se ha presupuestado.»",
            "Si dio un correo, le llega una copia **de su empresa**, en el idioma en que se creó el prospecto, con el mismo contenido y sin precio. La pantalla dice «Una copia va en camino a …» solo cuando realmente se envió una copia.",
            "Si su empresa puede recibir reservas (al menos un tipo de evento activo y el modo de visita activado), aparece un panel **¿Quiere que vayamos a verlo?** bajo la confirmación con un botón **Reservar una visita**, prellenado con los datos que acaba de escribir. Vea [[the-booking-page|La página de reservas]].",
            "De su lado, aparece un prospecto en **Prospectos** con la fuente, las respuestas como campos estructurados, las fotos y el plano, calificado como **Caliente**, **Tibio** o **Frío**, y se avisa a las personas que reciben notificaciones de prospectos. Un número de teléfono dado aquí se registra como consentimiento para devolver la llamada.",
          ] },
          { tip: "El prospecto conserva el idioma en que fue escrito, y el presupuesto en que lo convierte se crea en ese idioma — vea [[quote-language|Un presupuesto conserva su idioma]]." },
        ],
      },
      {
        id: "what-you-control",
        heading: "Qué controla usted",
        blocks: [
          { table: {
            head: ["Dónde", "Qué cambia en el formulario"],
            rows: [
              ["Configuración → Marca", "El logotipo, el color de marca y cada color derivado de él: el contraste se mide, así que una marca amarilla o blanca sigue leyéndose."],
              ["Configuración → Servicios y precios", "Qué servicios aparecen en el paso 1, y qué campos de captura pregunta el paso 2 (los tres primeros campos numéricos o de opción de cada servicio)."],
              ["Configuración → Idioma", "El idioma en que se escriben el formulario y la confirmación: el predeterminado de su empresa. Hoy no hay selector de idioma para el visitante: FieldQuo todavía no permite que una empresa liste varios idiomas de envío."],
              ["Configuración → Página de reservas", "Si el panel Reservar una visita aparece después de la confirmación (necesita al menos un tipo de evento activo)."],
              ["Configuración → Comparte tus enlaces", "El enlace en sí, un botón Abrir, y el fragmento de código para insertarlo en su propio sitio web."],
            ],
          } },
          { p: "La redacción de los pasos es de FieldQuo, en ocho idiomas; no se puede editar. Lo que no puede hacer, a propósito: mostrar un precio, pedir una tarjeta, o agregar campos propios." },
        ],
      },
      {
        id: "who-can-see-it",
        heading: "Quién puede verlo",
        blocks: [
          { p: "El formulario en sí es público: cualquiera con el enlace. La pantalla **Comparte tus enlaces** que reparte el enlace necesita el nivel Manager o superior (un propietario, un administrador, un Manager o un Dispatcher). Los prospectos que crea son visibles para cualquiera cuyo acceso incluya las solicitudes." },
        ],
      },
    ],
    faq: [
      { q: "¿El propietario puede ver un precio en el formulario?", a: "No, y es deliberado. El formulario crea un prospecto; una persona le pone precio. Si quiere que un visitante vea una cifra inicial, eso es la cotización instantánea — vea [[the-instant-estimate-page|La página de cotización instantánea]]." },
      { q: "¿Por qué el formulario muestra solo algunos de mis servicios?", a: "Lista los servicios activados en Configuración → Servicios y precios. Active uno y aparece en el formulario de inmediato." },
      { q: "¿El visitante tiene que dar un correo?", a: "Un correo o un número de teléfono: con uno basta. Un correo mal escrito se rechaza mientras todavía está mirando el formulario, en lugar de rebotar después." },
      { q: "¿Puedo poner el formulario en mi sitio web existente?", a: "Sí. Configuración → Comparte tus enlaces tiene un fragmento de código para insertar; dentro de su propia página el formulario omite su franja de logotipo porque su sitio ya lleva su nombre." },
    ],
  },

  "the-review-request": {
    title: "La solicitud de reseña",
    summary:
      "El único correo que un cliente recibe después de completar un trabajo: su logotipo, una frase de agradecimiento, una calificación de 1 a 5, un botón Deja una reseña hacia su enlace de Google, y las reglas que garantizan que se envía una vez, y nunca a la persona equivocada.",
    updated: "2026-09-12",
    intro: [
      "Cuando un trabajo se marca como **Completado**, FieldQuo puede pedirle una reseña al cliente en su nombre. El correo viene de su empresa, lleva su logotipo y el color de su botón, y no dice nada de FieldQuo. Es corto a propósito: una línea de agradecimiento, un botón, una forma de quejarse con usted en lugar de en público.",
      "Se envía **una vez, para siempre, por trabajo**: nunca dos veces, nunca a alguien que se dio de baja, nunca por un trabajo terminado hace más de 30 días.",
    ],
    sections: [
      {
        id: "overview",
        heading: "Resumen",
        blocks: [
          { p: "La solicitud está desactivada hasta que pegue un enlace de reseñas y active **Pedir automáticamente** en **Configuración → Reseñas**. Desde entonces, cada trabajo que llega a **Completado** se comprueba una vez por hora: cuando ha pasado la demora que eligió y el cliente tiene una dirección de correo, el mensaje sale." },
          { figure: "live:app-settings-reviews", caption: "Configuración → Reseñas — Tu enlace de reseñas, el interruptor Pedir automáticamente, y la tarjeta Reseñas en tu sitio web debajo." },
        ],
      },
      {
        id: "what-the-client-receives",
        heading: "Qué recibe el cliente",
        blocks: [
          { bullets: [
            "Asunto: **How did we do? — [Su empresa]** (o su equivalente en francés), enviado desde el remitente de su empresa.",
            "Su logotipo (o el nombre de su empresa), luego «Hi [nombre],» y una frase: gracias por contar con ustedes, una reseña rápida significaría mucho.",
            "Una fila **How did we do?** de cinco chips numerados, del 1 al 5. Tocar uno abre una pequeña página con su papelería donde la puntuación queda preseleccionada y el cliente puede agregar un comentario opcional y pulsar Enviar. Nada se registra hasta que lo pulsa.",
            "Un botón **Leave a review** en su color de marca que abre su enlace de reseñas (normalmente Google), y «Takes about a minute.»",
            "Una línea de pie: si algo no estuvo bien, responda a este correo en su lugar y la empresa lo resolverá; las respuestas llegan a la dirección de correo de su empresa.",
            "Un enlace para darse de baja, porque pedir una reseña pública es un mensaje comercial según la ley canadiense antispam.",
          ] },
          { note: "El correo existe en inglés y en francés. Un cliente cuyo idioma sea cualquier otro recibe la versión en inglés. La página de calificación bajo los chips está escrita en los ocho idiomas de los clientes." },
        ],
      },
      {
        id: "the-rules",
        heading: "Cuándo se envía, y cuándo no",
        blocks: [
          { table: {
            head: ["Condición", "Qué pasa"],
            rows: [
              ["Ya se pidió reseña por el trabajo", "Nunca se vuelve a pedir: esto se comprueba antes que nada, incluso si dos personas pulsan cosas a la vez."],
              ["Sin enlace de reseñas, o Pedir automáticamente desactivado", "No se envía nada."],
              ["El trabajo no está Completado, o FieldQuo no sabe cuándo terminó", "No se envía nada. Un trabajo completado antes de que se registraran fechas de finalización se deja en paz en lugar de adivinarse."],
              ["El cliente no tiene dirección de correo", "No se envía nada: no hay solicitud de reseña por mensaje de texto."],
              ["El cliente se dio de baja", "Se omite."],
              ["La demora todavía no ha pasado", "Espera. La demora es el chip que eligió: 2 horas después, 4 horas después, Al día siguiente, Dos días después, Tres días después, Una semana después."],
              ["El trabajo terminó hace más de 30 días", "Nunca se pide. Activar la función hoy no escribe a cada cliente que tuvo el año pasado."],
            ],
          } },
          { warning: "La reserva se escribe antes de que se envíe el correo. Si el envío luego falla, a ese cliente nunca se le vuelve a pedir: ese es el fallo más seguro. No pedir cuesta una reseña; pedir dos veces cuesta la relación." },
        ],
      },
      {
        id: "what-you-control",
        heading: "Qué controla usted",
        blocks: [
          { steps: [
            "Abra **Configuración → Reseñas** y pegue su enlace en **Tu enlace de reseñas**: normalmente el enlace corto «Pedir reseñas» de su Perfil de Negocio de Google, pero cualquier página http o https funciona. Pulse **Guardar**, y luego use **Ábrelo y comprueba que lleva a donde esperas**.",
            "Active **Pedir automáticamente**. Hasta que se guarde un enlace válido el interruptor está desactivado y dice que agregue primero su enlace de reseñas arriba.",
            "Elija un chip bajo **Cuándo preguntar**. El predeterminado es al día siguiente.",
            "Lea la línea de cola debajo — cuántos clientes están en cola y a cuántos se les ha pedido en los últimos 30 días — para verlo funcionar.",
          ] },
          { p: "Las puntuaciones de la fila 1–5 alimentan el mosaico **Satisfacción del cliente** en **KPI**. Las reseñas que los clientes dejan en Google se quedan en Google; para mostrarlas en su sitio web, péguelas en **Reseñas en tu sitio web** en la misma pantalla — vea [[testimonials-on-your-website|Testimonios en su sitio web]]." },
        ],
      },
      {
        id: "who-can-see-it",
        heading: "Quién puede cambiarlo",
        blocks: [
          { p: "**Configuración → Reseñas** necesita el nivel Manager o superior: un propietario, un administrador, un Manager o un Dispatcher. La solicitud en sí la envía FieldQuo según un calendario; no hay un botón Pedir ahora en un trabajo, y nadie puede enviarla dos veces." },
        ],
      },
    ],
    faq: [
      { q: "¿Puedo enviar una solicitud de reseña por mensaje de texto?", a: "No. La solicitud va solo por correo, y solo a un cliente con una dirección de correo registrada." },
      { q: "¿Puedo editar la redacción?", a: "Hoy no. El correo es una frase y un botón con sus colores; lo único que usted configura es el enlace y la demora." },
      { q: "Un cliente respondió al correo. ¿Adónde fue?", a: "A la dirección de correo de su empresa, la misma dirección de respuesta que sus presupuestos. Las respuestas nunca llegan a FieldQuo." },
      { q: "Lo activamos y no se envió nada por los trabajos del mes pasado.", a: "Por diseño. Por un trabajo terminado hace más de 30 días nunca se pide reseña, y solo se consideran los trabajos que lleguen a Completado a partir de ahora." },
    ],
  },

  "the-referral-page": {
    title: "La página de referidos",
    summary:
      "La página en la que aterriza otro dueño de negocio cuando comparte su enlace de Recomienda y gana: para quién es, qué promete, qué dice de usted, y el único lugar donde el nombre de FieldQuo está pensado para aparecer.",
    updated: "2026-09-12",
    intro: [
      "Su enlace de referidos no es para propietarios de vivienda. Es para **otro negocio**: el electricista con el que comparte trabajos, el pintor que preguntó qué software usa. La página que abre dice que usted usa FieldQuo, le ofrece un mes gratis además de la prueba, y lo manda al formulario de registro con su nombre adjunto.",
      "Eso la hace la excepción a la regla de la marca blanca, a propósito: una página cuyo único fin es decir «este contratista usa FieldQuo; usted también podría» no puede esconder el nombre. Su logotipo y su color están en ella como quien refiere, y los de FieldQuo como el producto.",
    ],
    sections: [
      {
        id: "overview",
        heading: "Resumen",
        blocks: [
          { p: "El enlace es corto — el nombre de su empresa sin espacios ni puntuación —, para que se pueda leer en voz alta, imprimir en una tarjeta de presentación o pintar en una camioneta. No distingue mayúsculas de minúsculas. Su pantalla **Recomienda y gana** lo muestra bajo **Tu enlace** con un botón **Copiar**." },
          { figure: "live:app-settings-refer", caption: "Recomienda y gana — el enlace de la empresa con Copiar, Enviar una invitación por correo o SMS, y luego los meses ganados, los negocios referidos y las invitaciones enviadas." },
        ],
      },
      {
        id: "what-the-visitor-sees",
        heading: "Qué ve el visitante",
        blocks: [
          { bullets: [
            "Su logotipo — o, sin uno, su inicial sobre su color de marca — sobre la línea «[Su empresa] uses FieldQuo».",
            "El titular **Get your first month free**, un párrafo de descripción de FieldQuo, y un botón **Claim your first month free** que abre el formulario de registro con su código de referido adjunto.",
            "Bajo el botón: «No card charged during your trial. Cancel any time.» Luego tres viñetas sobre lo que hace el producto.",
            "Un pie que dice la parte discreta: «For businesses new to FieldQuo. Already have an account? Sign in.»: una empresa existente no puede canjear una oferta.",
          ] },
          { p: "La página se renderiza en el servidor para que se lea en el primer medio segundo con una sola barra de señal, y lleva una vista previa de enlace (título y descripción) porque se pega en grupos de WhatsApp y Facebook donde la tarjeta de vista previa es el argumento de venta." },
        ],
      },
      {
        id: "what-it-promises",
        heading: "Qué promete, exactamente",
        blocks: [
          { table: {
            head: ["Quién", "Qué recibe", "Cuándo"],
            rows: [
              ["El negocio que usted refirió", "**1 mes gratis extra** agregado a su prueba", "Al registrarse, en el momento en que usa su enlace"],
              ["Usted", "**1 mes gratis** agregado a su propio acceso", "Cuando la empresa referida hace su primer pago, no al registrarse"],
            ],
          } },
          { p: "Ambos lados reciben lo mismo — un mes de FieldQuo — sea cual sea el tamaño del negocio que refiera. Su mes cae con su primer pago y no con su registro para que veinte registros desechables no puedan ganar un año gratis; el tope es de 50 referidos acreditados por mes calendario." },
          { note: "El enlace no hace nada por una empresa que ya tiene cuenta, y usted no puede referirse a sí mismo. La página se lo dice antes de que llenen nada." },
        ],
      },
      {
        id: "sending-it",
        heading: "Cómo enviarlo",
        blocks: [
          { steps: [
            "Abra **Recomienda y gana** (en la barra lateral, o **Configuración → Recomienda y gana**: la misma pantalla).",
            "Pulse **Copiar** junto a **Tu enlace** y péguelo donde quiera, o **Enviar por SMS** en un teléfono para abrir su propia aplicación de mensajes con la invitación ya escrita.",
            "O use **Enviar una invitación** con **Su correo** o **Su número de móvil** y un nombre opcional, y luego **Enviar invitación**. FieldQuo envía un mensaje y nunca insiste; hasta 20 invitaciones al día.",
            "Observe **Negocios que has referido**: cada uno dice **Registrado: aún no paga** hasta su primer pago, luego **Acreditado**, y su mes aparece bajo el conteo de arriba.",
          ] },
          { warning: "Una invitación enviada desde esta pantalla es un correo o SMS de **FieldQuo** — encabezado de FieldQuo, remitente de FieldQuo — que dice que su empresa usa el producto. Es el único mensaje del producto que no lleva su papelería, porque trata de FieldQuo, no de su trabajo." },
        ],
      },
      {
        id: "who-can-see-it",
        heading: "Quién puede verlo",
        blocks: [
          { p: "La página de aterrizaje es pública. **Recomienda y gana** es solo para propietario y administradores: lista qué negocios fueron referidos y qué se acreditó, que es información de facturación. Un Manager no ve la fila." },
        ],
      },
    ],
    faq: [
      { q: "¿Esto es para mis clientes propietarios de vivienda?", a: "No. Es una referencia de negocio a negocio hacia FieldQuo. Para lo que FieldQuo hace y no hace sobre clientes que refieren clientes, vea [[referrals-from-clients|Referidos de clientes]]." },
      { q: "¿Por qué la página dice FieldQuo cuando nada más lo dice?", a: "Porque su propósito es recomendar FieldQuo. Cada presupuesto, factura, página y correo que ven sus clientes lleva su nombre; esta página se dirige a otro contratista y trata del software." },
      { q: "¿Cuándo recibo mi mes gratis?", a: "Cuando el negocio que refirió hace su primer pago. Hasta entonces la fila dice Registrado: aún no paga. Detalles: [[referral-months|Meses por referidos]]." },
    ],
  },

  "your-website-as-a-visitor": {
    title: "Su sitio web",
    summary:
      "Qué ve un visitante en su sitio alojado por FieldQuo: sus páginas, sus horarios, sus servicios leídos en vivo desde Configuración, botones de Pedir presupuesto y Reservar que se quedan en su dirección, y la única línea de pie que solo lleva un sitio gratuito.",
    updated: "2026-09-12",
    intro: [
      "Su sitio web vive en su propio subdominio — **suempresa.fieldquo.com** — y es la única página de cara al cliente en FieldQuo que está pensada para que Google la encuentre. Todo en ella es suyo: el logotipo, el color, la redacción, las fotos que tomaron sus cuadrillas. La única mención de FieldQuo en cualquier parte es una pequeña línea **Site by FieldQuo** en el pie, y esa línea está solo en los sitios **gratuitos**.",
      "Se renderiza en el servidor en una sola petición y funciona con JavaScript desactivado, porque un desconocido con mala conexión en una entrada de garaje es exactamente para quien es.",
    ],
    sections: [
      {
        id: "overview",
        heading: "Resumen",
        blocks: [
          { p: "Nada es público hasta que pulsa **Publicar** en **Configuración → Tu sitio web**. Un sitio sin publicar es una página no encontrada para un visitante y una vista previa de borrador para un miembro de su empresa con sesión iniciada: la barra ámbar de arriba lo dice, y a los motores de búsqueda se les indica que no lo indexen." },
          { figure: "harness:client-website", caption: "Un sitio publicado como lo ve un visitante — el nombre de la empresa, una píldora Abierto · cierra a las tomada de sus horarios, el menú de páginas, un selector de idioma, el número de teléfono, y el botón Pedir presupuesto." },
        ],
      },
      {
        id: "what-is-on-the-page",
        heading: "Qué hay en la página",
        blocks: [
          { bullets: [
            "**El encabezado**: su logotipo o nombre, una píldora **Abierto · cierra a las …** / **Cerrado · abre …** calculada a partir de los horarios de **Configuración de la empresa** (ausente si no configuró ninguno), el menú de páginas, un selector de idioma cuando el sitio tiene más de un idioma, su número de teléfono, y un botón **Pedir presupuesto**.",
            "**Las páginas**: Inicio, Servicios, Trabajos, Nosotros, Reservar, Presupuesto y Contacto, cada una construida con secciones: encabezado, servicios, antes y después, galería, testimonios, preguntas frecuentes, proceso, credenciales, zonas de servicio, horarios, contacto, una llamada a la acción.",
            "**Los servicios** se leen desde **Configuración → Servicios y precios** en cada petición: active un oficio y aparece; desactive uno y desaparece. Los textos se conservan, la lista está en vivo.",
            "Las secciones de **galería** y **antes y después** que dejó vacías se llenan solas con fotos recientes de trabajos y visitas de dos fotos de sus trabajos; lo que usted eligió a mano siempre gana.",
            "**Los testimonios** son los que activó en **Configuración → Reseñas**: los seis primeros.",
            "**Pedir presupuesto** es su formulario de solicitud de presupuesto renderizado dentro de la página, y **Reservar** es su calendario de reservas. Ambos mantienen al visitante en su dirección; nada lo manda a fieldquo.com.",
            "**El pie**: su logotipo, © y su nombre, y, solo en un sitio gratuito, «Site by FieldQuo».",
          ] },
          { note: "Los motores de búsqueda también reciben un registro estructurado «LocalBusiness» — nombre, teléfono, correo, dirección y horarios —, que es lo que pone «Abierto ⋅ Cierra a las 5 PM» en un resultado de Google. Los horarios se incluyen solo cuando usted los configura; una semana vacía nunca se inventa." },
        ],
      },
      {
        id: "languages",
        heading: "Idiomas",
        blocks: [
          { p: "El primer idioma es el principal y vive en la dirección raíz; cada otro idioma vive en **/fr**, **/es** y así sucesivamente, con un selector en el encabezado. Agregar un idioma en **Idiomas** escribe todo el sitio en él — no es una traducción automática de la página —, y cada idioma lleva su propio título y descripción para los motores de búsqueda. Un idioma que no ha activado es una página no encontrada, no un retroceso silencioso al inglés." },
        ],
      },
      {
        id: "what-you-control",
        heading: "Qué controla usted, y desde dónde",
        blocks: [
          { table: {
            head: ["Control", "Qué ve cambiar el visitante"],
            rows: [
              ["Publicar / Despublicar (Configuración → Tu sitio web)", "El sitio aparece o, al Despublicar, muestra una página de no publicado de inmediato; nada se borra y Publicar devuelve el mismo sitio."],
              ["Dirección web", "El subdominio. Los nombres reservados (app, www, api y similares) no se pueden tomar: son una frontera de seguridad, no una preferencia de nombres."],
              ["Las secciones y el panel de conversación", "La redacción de cada sección. Reconstruir reescribe las palabras que editó; las fotos, los pares, el logotipo y los colores se conservan."],
              ["Configuración → Marca", "Logotipo y colores en todo el sitio, con el contraste medido."],
              ["Configuración de la empresa", "Teléfono, correo, dirección, horarios y zonas de trabajo: leídos en vivo, nunca reescritos en el sitio."],
              ["Configuración → Servicios y precios", "La lista de servicios, en vivo."],
              ["Configuración → Reseñas", "Qué testimonios se muestran."],
              ["Su plan", "Una empresa en un plan gratuito, o cuya suscripción ha vencido, muestra la línea de pie Site by FieldQuo; una empresa que paga — prueba incluida — no."],
            ],
          } },
          { p: "FieldQuo no ofrece un dominio personalizado hoy: el sitio se sirve en su subdominio de fieldquo.com. Si posee un dominio, el enlace para la bio y Comparte tus enlaces pueden apuntar a él, y la inserción de reseñas puede colocarse en un sitio que ya tenga." },
        ],
      },
      {
        id: "who-can-see-it",
        heading: "Quién puede cambiarlo",
        blocks: [
          { p: "El sitio publicado es público e indexado. El constructor en **Configuración → Tu sitio web** — publicar, despublicar, la dirección, los idiomas — es solo para propietario y administradores." },
        ],
      },
    ],
    faq: [
      { q: "¿El sitio dice FieldQuo en alguna parte?", a: "Solo la línea de pie «Site by FieldQuo», y solo en un sitio gratuito o uno cuya suscripción ha vencido. El sitio de una empresa que paga no lleva ninguna mención de FieldQuo." },
      { q: "¿Puedo usar mi propio dominio?", a: "Hoy no. El sitio vive en suempresa.fieldquo.com. Vea [[your-website-address|La dirección de su sitio web]]." },
      { q: "Agregué un servicio en Configuración. ¿Necesito reconstruir el sitio?", a: "No. La sección de servicios lee sus servicios activados en cada visita. Lo mismo vale para los horarios, el teléfono, la dirección y las zonas de trabajo." },
      { q: "¿De dónde salen las fotos?", a: "Primero las fotos que subió en el constructor; si no, fotos recientes de trabajos de sus cuadrillas llenan una galería vacía automáticamente. Las fotos de stock son imágenes de Unsplash enlazadas directamente, no copiadas — vea [[stock-photos-on-your-website|Fotos de stock en su sitio web]]." },
    ],
  },

  "the-kitchen-design-link": {
    title: "El enlace de diseño de cocina",
    summary:
      "La página que un cliente abre para mover gabinetes y probar acabados en la cocina que usted presupuestó: sin precios, su versión guardada junto a la suya, y un correo para usted cuando guarda.",
    updated: "2026-09-12",
    intro: [
      "Para un trabajo de gabinetes que dibujó en el diseñador de cocina, al cliente se le puede dar un enlace a su propia copia del dibujo. Ve su nombre y su logotipo, el número del presupuesto y su nombre, un plano en el que puede arrastrar piezas, y un panel **Colours & finishes**. No puede ver una tarifa, y nada de lo que hace cambia un número por sí solo.",
      "Cuando pulsa **Save my version**, su distribución se guarda junto a la suya — nunca encima — y el creador del presupuesto más sus propietarios y administradores reciben un correo diciéndolo. Usted abre el diseñador, compara, y decide.",
    ],
    sections: [
      {
        id: "overview",
        heading: "Resumen",
        blocks: [
          { p: "El enlace es el token de compartir del presupuesto — la misma credencial que la página de aprobación —, así que existe una vez que el presupuesto se ha enviado. En la pantalla **Diseñador de cocina** del presupuesto, el botón **Enlace del cliente** lo copia; antes de enviar, la pantalla dice que envíe el presupuesto para obtener un enlace de diseño para el cliente." },
          { figure: "harness:client-kitchen-design", caption: "La vista del cliente — el nombre de la empresa, el número del presupuesto y el nombre del cliente, «Your kitchen», las pestañas de habitaciones y las dimensiones de las paredes, la paleta de piezas, el plano, y Save my version." },
        ],
      },
      {
        id: "what-the-client-sees",
        heading: "Qué ve el cliente",
        blocks: [
          { bullets: [
            "Un encabezado con su logotipo (o nombre) a la izquierda y **Quote [número]** con el nombre del cliente a la derecha. El pie es el nombre de su empresa. Nada en la página dice FieldQuo.",
            "**Your kitchen**: una invitación, en inglés, a mover las cosas y probar distintos acabados; cuando guarda, [Su empresa] recibe su versión y confirmará el precio.",
            "Las pestañas de habitaciones (Kitchen, Laundry, Closet), el largo y alto de cada pared, las vistas (Plan, Back, Right, Front, Left, Island Layout) y **Colours & finishes**.",
            "La paleta de piezas — módulos bajos, altos, columnas, esquineros, electrodomésticos y aberturas — y el plano en sí, con su instrucción en inglés: toque una pieza para seleccionarla y luego arrástrela; los módulos se ajustan a ras de las paredes, las esquinas y entre sí.",
            "Un botón **Save my version** en su color. Tras guardar, una línea en inglés confirma que se guardó, que a [Su empresa] se le ha avisado y que responderá con un precio actualizado si algo cambió.",
          ] },
          { note: "La página siempre es clara, como el presupuesto mismo, y hoy está solo en inglés: un cliente con un presupuesto en francés recibe un diseñador en inglés. No la indexan los motores de búsqueda." },
        ],
      },
      {
        id: "what-they-cannot-do",
        heading: "Qué no puede hacer",
        blocks: [
          { bullets: [
            "**Ver un precio.** El panel de precios que usted usa está oculto, y los datos que carga la página tienen cada tarifa y cada precio de electrodoméstico eliminados: reconstruidos campo por campo, no filtrados.",
            "**Cambiar un precio.** Lo que vuelve se fusiona sobre su dibujo: la habitación, los precios de electrodomésticos y su tarifa se vuelven a adjuntar desde su copia, y cualquier número que envíe el navegador se descarta.",
            "**Sobrescribir su dibujo.** Su versión se guarda en su propio campo, con la fecha. Su distribución queda intacta hasta que elija **Cargar su versión**.",
            "**Editar un presupuesto cerrado.** Una vez que el presupuesto se acepta o se rechaza, la página dice que esa es la distribución de su presupuesto y el botón desaparece.",
          ] },
        ],
      },
      {
        id: "on-your-side",
        heading: "De su lado",
        blocks: [
          { steps: [
            "Abra el presupuesto y pulse **Diseñador de cocina**. Dibuje la habitación, y luego envíe el presupuesto: el botón **Enlace del cliente** se activa.",
            "Pulse **Enlace del cliente** para copiarlo y péguelo en un mensaje al cliente.",
            "Cuando guarda, el correo **Client design saved — [número de presupuesto]** llega al creador del presupuesto y a cada propietario y administrador, con un enlace al diseñador.",
            "En el diseñador, el aviso **Tu cliente guardó su propia versión de este diseño el [fecha]** ofrece **Cargar su versión**. Cárguela, y luego **Guardar y recalcular la cotización**: el servidor recalcula a partir de sus tarifas.",
          ] },
          { warning: "El diseño de un presupuesto enviado es de solo lectura de su lado; la pantalla lo dice. Duplique el presupuesto para cambiarlo; un presupuesto enviado es un compromiso, y recalcular uno por debajo del cliente los deja a ambos mirando números distintos." },
        ],
      },
      {
        id: "who-can-see-it",
        heading: "Quién puede verlo",
        blocks: [
          { p: "La página del cliente es pública para cualquiera que tenga el enlace. El botón **Diseñador de cocina** aparece en un presupuesto cuando su empresa tiene **Diseño de cocinas e instalaciones nuevas** activado en Servicios, o cuando el presupuesto ya lleva un diseño; abrirlo requiere acceso de edición a los presupuestos. Un diseñador público aparte — **Diseña tu cocina** en Comparte tus enlaces — deja que un desconocido dibuje una cocina y la envíe como prospecto; vea [[the-kitchen-designer|El diseñador de cocina]]." },
        ],
      },
    ],
    faq: [
      { q: "¿El guardado del cliente cambia el total de mi presupuesto?", a: "No. Su distribución se guarda aparte. El total cambia solo cuando usted carga su versión y pulsa Guardar y recalcular la cotización." },
      { q: "¿El cliente puede ver cuánto cuesta cada gabinete?", a: "No. La página nunca recibe una tarifa; él ya tiene su total en el propio presupuesto." },
      { q: "El cliente dice que el enlace no funciona.", a: "El enlace está ligado al presupuesto enviado. Si el presupuesto se aceptó o se rechazó, es de solo lectura; si se borró, la página lo dice y le pide responder al correo en el que llegó su presupuesto." },
    ],
  },

  "the-bio-link-page": {
    title: "La página del enlace para la bio",
    summary:
      "La única página detrás del único enlace que Instagram y TikTok permiten: su logotipo, un encabezado, sus cuentas, y un botón para todo lo que ofrece, con una pequeña línea Made by FieldQuo en el pie.",
    updated: "2026-09-12",
    intro: [
      "Su enlace para la bio es una dirección corta — **fieldquo.com/l/suempresa** — que abre una página con todos los lugares a los que puede mandar a un visitante: obtener un precio, reservar una visita, su sitio web, llamar, escribir, dejar una reseña. Está hecha para una pantalla de teléfono y sigue el ajuste claro u oscuro del teléfono.",
      "Todo lo que está sobre el pie es suyo: logotipo, color, redacción, orden. El pie lleva un enlace discreto **Made by FieldQuo** junto a la línea de derechos de autor: decisión del propietario, porque un menú de enlaces no es un documento que el cliente lea como venido de usted, y cada menú de este tipo lleva el nombre de quien lo hizo.",
    ],
    sections: [
      {
        id: "overview",
        heading: "Resumen",
        blocks: [
          { p: "La página está desactivada hasta que active **La página está activa** en **Configuración → Enlace para la bio**; hasta entonces, la dirección muestra una página no encontrada. Deliberadamente no la indexan los motores de búsqueda: un resultado de búsqueda mostrando fieldquo.com bajo su nombre le diría a un propietario de vivienda qué software usa usted, y el tráfico de la página viene de una bio, no de una búsqueda." },
          { figure: "harness:client-bio-link", caption: "La página del enlace para la bio — la inicial de la empresa sobre su color de marca, el encabezado, la línea del sitio web, la bio, dos iconos sociales, y luego los botones agrupados bajo Reservar, Más y Contacto." },
        ],
      },
      {
        id: "what-is-on-the-page",
        heading: "Qué hay en la página",
        blocks: [
          { bullets: [
            "Su logotipo, o su inicial sobre su color de marca.",
            "El **Encabezado** — el nombre de su empresa a menos que haya escrito uno — y, debajo, el dominio de su propio sitio web como leyenda cuando ingresó uno en Configuración de la empresa. (Su sitio alojado en fieldquo.com nunca se imprime ahí: esa sería la fuga que la regla de la marca blanca existe para evitar.)",
            "**Una línea debajo**: la bio, solo si escribió una. FieldQuo no inventa una.",
            "**Síguenos**: una fila de iconos redondos para las cuentas que ingresó: Instagram, Facebook, TikTok, YouTube, LinkedIn, X.",
            "Los botones, en su orden, agrupados bajo **Obtener un precio**, **Reservar**, **Más** y **Contacto**, cada uno abriéndose en una pestaña nueva.",
          ] },
        ],
      },
      {
        id: "the-buttons",
        heading: "Qué botones existen, y por qué faltan algunos",
        blocks: [
          { table: {
            head: ["Botón", "Aparece cuando"],
            rows: [
              ["Obtener un precio al instante", "Al menos un oficio está activado en Configuración → Cotizaciones instantáneas."],
              ["Presupuesto gratis", "Siempre: su formulario de solicitud de presupuesto."],
              ["Diseña tu cocina", "Diseño de cocinas e instalaciones nuevas está activado en Servicios."],
              ["Reservar una visita", "Tiene al menos un tipo de evento activo en la Página de reservas."],
              ["Un botón por embudo publicado", "El estado del embudo es Publicado; la etiqueta es el nombre del embudo."],
              ["Visita nuestro sitio web", "Ingresó un sitio web en Configuración de la empresa, o su sitio de FieldQuo está publicado: su propio dominio gana."],
              ["Llamar · Envíanos un correo", "Hay un número de teléfono o un correo en el registro de su empresa."],
              ["Escríbenos por WhatsApp", "Hay un número de teléfono registrado; desactivado por defecto, actívelo."],
              ["Deja una reseña", "Hay un enlace de reseñas guardado en Configuración → Reseñas."],
              ["Sus propios enlaces", "Hasta 10 filas que agrega con Agregar tu propio enlace: texto, URL y un icono."],
            ],
          } },
          { note: "La pantalla de configuración muestra también las filas que no están disponibles, atenuadas, con la pantalla que las crearía, para que un Reservar una visita ausente se lea como un siguiente paso, no como un error. Cada botón interno usa el mismo slug que su página de reservas, así que una empresa con una dirección de reservas personalizada tiene una sola dirección para todo." },
        ],
      },
      {
        id: "what-you-control",
        heading: "Qué controla usted",
        blocks: [
          { steps: [
            "Abra **Configuración → Enlace para la bio**. **Tu enlace** está arriba con Copiar y Abrir: para pegarlo en su bio de Instagram o TikTok.",
            "Escriba un **Encabezado** y **Una línea debajo**, y complete las cuentas de **Síguenos** que tenga.",
            "Bajo **Qué hay en la página**, active o desactive filas con **Mostrar en la página**, cambie el texto de su botón, y reordénelas arrastrando o con Subir / Bajar. Agregue las suyas con **Agregar tu propio enlace**.",
            "Revise la **Vista previa** en el marco de teléfono en claro y en oscuro, active **La página está activa**, y pulse **Guardar**: nada se publica hasta que lo haga.",
          ] },
          { p: "La página está escrita en el idioma de su empresa. No tiene selector de idioma." },
        ],
      },
      {
        id: "who-can-see-it",
        heading: "Quién puede cambiarlo",
        blocks: [
          { p: "La página es pública una vez activa. **Configuración → Enlace para la bio** necesita el nivel Manager o superior: un propietario, un administrador, un Manager o un Dispatcher." },
        ],
      },
    ],
    faq: [
      { q: "¿Puedo quitar Made by FieldQuo del pie?", a: "No. Es la única línea de la página que no es suya, mantenida en el mismo contraste discreto que la línea de derechos de autor. Todo lo que está encima sí lo es." },
      { q: "¿Por qué no hay un botón Reservar una visita?", a: "No tiene ningún tipo de evento activo. Cree uno en Configuración → Página de reservas y la fila aparece, activada." },
      { q: "¿La página muestra la dirección fieldquo.com de mi sitio web?", a: "Solo como botón Visita nuestro sitio web, y solo cuando no ha ingresado su propio dominio. La leyenda bajo el encabezado nunca imprime una dirección de fieldquo.com." },
    ],
  },

  "a-funnel-as-a-visitor": {
    title: "Un embudo",
    summary:
      "Qué ve alguien que toca su anuncio o su enlace para la bio: una página a pantalla completa, una pregunta a la vez, en su color, un rango instantáneo opcional, un formulario de contacto corto, y, de su lado, un prospecto calificado.",
    updated: "2026-09-12",
    intro: [
      "Un embudo es una página de aterrizaje que se recorre con toques, para un anuncio, un código QR en un volante o su enlace para la bio. El visitante ve su color de marca de borde a borde, su logotipo y su nombre, una línea de progreso, y un paso a la vez: la forma de historias de Instagram que espera el tráfico de anuncios en móvil. No hay menú, ni pie, ni nada que diga FieldQuo; la pestaña del navegador lleva el nombre de su empresa.",
      "Al final deja un nombre y un correo o teléfono, y un prospecto **Caliente**, **Tibio** o **Frío** aterriza en su tablero de Prospectos con cada respuesta adjunta.",
    ],
    sections: [
      {
        id: "overview",
        heading: "Resumen",
        blocks: [
          { p: "Los embudos se construyen en la pantalla **Embudos** — desde una plantilla de canal (Web, Instagram, TikTok, YouTube) o desde una frase que escribe en el generador — y cada uno tiene un estado, **Borrador** o **Publicado**. Solo un embudo publicado responde en su dirección; un borrador, o una dirección equivocada, muestra que el embudo no está disponible. El enlace y un fragmento de código para insertar de cada embudo publicado están en **Configuración → Comparte tus enlaces**." },
          { figure: "harness:client-funnel", caption: "Un embudo a mitad de camino — el color de marca a pantalla completa, la línea de progreso, el monograma y el nombre de la empresa, Back, y una tarjeta de pregunta de opción única." },
        ],
      },
      {
        id: "the-steps",
        heading: "Los pasos que un visitante puede encontrar",
        blocks: [
          { table: {
            head: ["Paso", "Qué ve el visitante"],
            rows: [
              ["Intro", "Un titular, una línea de texto y un botón: Get started a menos que usted lo haya nombrado."],
              ["Opción única", "Una pregunta y una lista de respuestas; un toque avanza. Una respuesta puede ramificar a un paso posterior."],
              ["Opción múltiple", "Marque varias, y luego Continue."],
              ["Carga de fotos", "Agregue fotos o un video corto del trabajo, y luego Continue."],
              ["Cotización instantánea", "Rangos de tamaño; tocar uno muestra un rango de precio que el servidor calculó a partir de sus tarifas, o, si el paso está configurado como detalles primero, el rango se revela después del formulario. Si su oficio está configurado para mostrar el rango solo después de enviar, se retiene hasta entonces."],
              ["Formulario", "«Where should we send it?»: nombre, correo, teléfono. Se requieren un nombre y uno de correo o teléfono."],
              ["Gracias", "Su titular y texto de cierre, o un simple «Thanks!»."],
            ],
          } },
          { note: "Las palabras de cada paso son suyas — escritas en el constructor o redactadas por el generador —, así que el embudo está en el idioma en que usted lo escribió. Las partes integradas (el enlace Back y los marcadores Your name / Email / Phone del formulario) están en inglés." },
        ],
      },
      {
        id: "what-happens-on-submit",
        heading: "Qué pasa cuando envían",
        blocks: [
          { bullets: [
            "Se crea un prospecto en el pipeline normal — no un tipo especial — con la fuente **funnel**, cada respuesta como campo estructurado, las fotos, y una línea de mensaje por pregunta.",
            "Una pregunta que etiquetó como **budget** o **timeline** en el constructor alimenta directamente al calificador; el prospecto se lee Caliente, Tibio o Frío en **Prospectos** como cualquier otro. Vea [[lead-scoring-hot-warm-cold|Calificación de prospectos]].",
            "Se avisa a las personas que reciben notificaciones de prospectos. Un número de teléfono se registra como consentimiento para devolver la llamada.",
            "Si ingresó un píxel de Meta, un píxel de TikTok o un id de GA4 en el constructor, la página dispara una vista de página al cargar y un evento de prospecto solo **después** de que el servidor aceptó el envío, nunca por uno rechazado.",
            "Se registra una señal de vista de paso a medida que se alcanza cada paso, que es lo que cuenta el informe de abandono del constructor. Es anónima: un id por visita, no una persona.",
          ] },
          { p: "FieldQuo no envía al visitante una copia de lo que mandó, y el embudo no muestra ningún precio a menos que tenga un paso de cotización instantánea. Nada aquí recalcula nada: un rango instantáneo sale de sus tarifas en el servidor y se marca como pendiente de revisión antes de que salga un presupuesto." },
        ],
      },
      {
        id: "what-you-control",
        heading: "Qué controla usted",
        blocks: [
          { steps: [
            "En **Embudos**, pulse **Nuevo embudo** y elija una plantilla de canal, o describa el embudo y pulse **Generar**.",
            "En el constructor, edite las palabras y respuestas de cada paso, etiquete las preguntas de presupuesto y plazo, configure un paso de cotización instantánea como precio primero o detalles primero, y agregue sus ids de píxel.",
            "Publíquelo. Copie su enlace desde el constructor o desde **Configuración → Comparte tus enlaces**; la página del enlace para la bio recibe un botón para él automáticamente.",
            "Vuelva al constructor para el informe de abandono: cuántos llegaron a cada paso y dónde se fueron.",
          ] },
        ],
      },
      {
        id: "who-can-see-it",
        heading: "Quién puede verlo",
        blocks: [
          { p: "Un embudo publicado es público para cualquiera con el enlace, y deliberadamente no indexado. La pantalla **Embudos** es para propietarios, administradores, Managers y Dispatchers; en **Comparte tus enlaces**, los demás ven «Los embudos de clientes potenciales los gestiona un propietario o un administrador — pídeles el enlace.» Los prospectos son visibles para cualquiera cuyo acceso incluya las solicitudes." },
        ],
      },
    ],
    faq: [
      { q: "¿El embudo muestra mis precios?", a: "Solo si agregó un paso de cotización instantánea, y entonces solo un rango calculado en el servidor a partir de sus tarifas, nunca la lista de tarifas. Cada estimación de ese tipo se marca para su revisión antes de que se envíe un presupuesto." },
      { q: "¿Puedo poner un embudo en mi sitio web existente?", a: "Sí: Comparte tus enlaces tiene un fragmento de código para insertar por cada embudo publicado. Dentro de su propia página se omite la franja de logotipo, ya que su sitio ya lleva su nombre." },
      { q: "¿Adónde van las respuestas?", a: "Al prospecto en Prospectos, como campos que puede leer y como una nota por pregunta, con las fotos adjuntas. Conviértalo en presupuesto desde ahí." },
    ],
  },

  "the-texts-clients-receive": {
    title: "Los mensajes de texto que reciben los clientes",
    summary:
      "Los dos mensajes de texto automáticos que un cliente puede recibir — Voy en camino y un recordatorio de cita —, qué dicen, en qué idioma, desde qué número, cómo funciona STOP, y todo lo que FieldQuo no envía por texto.",
    updated: "2026-09-12",
    intro: [
      "FieldQuo envía a un cliente exactamente dos tipos de mensaje de texto: **Voy en camino**, cuando un miembro de la cuadrilla toca ese estado en una visita de trabajo, y un **recordatorio de cita** antes de una cita reservada o una visita de trabajo programada. Ambos empiezan con el nombre de su empresa, ambos salen en el idioma del cliente, y ambos respetan una respuesta STOP. Esa es toda la lista: presupuestos, facturas, confirmaciones de reserva y solicitudes de reseña van por correo.",
      "Los recordatorios están desactivados hasta que elija una anticipación en **Configuración → Notificaciones**. No se cobra nada por mensaje.",
    ],
    sections: [
      {
        id: "overview",
        heading: "Resumen",
        blocks: [
          { p: "Cada mensaje sale desde el número de mensajes propio de su empresa si tiene uno, y si no desde un número compartido de FieldQuo, y por eso cada mensaje empieza con el nombre de su empresa: en una línea compartida, el nombre en el cuerpo es lo que le dice al cliente quién le escribe. Nada en el mensaje dice FieldQuo." },
          { figure: "live:app-settings-messages", caption: "Configuración → Mensajes de clientes — un editor por tipo de mensaje, los campos que acepta, una vista previa «Tu cliente ve:», y Guardar." },
          { note: "**Recordatorios de cita** está marcado como parcial en la propia lista de funciones de FieldQuo: los recordatorios van solo por mensaje de texto; no hay recordatorio por correo. La redacción de ambos mensajes se edita en Configuración → Mensajes de clientes." },
        ],
      },
      {
        id: "the-two-texts",
        heading: "Los dos mensajes",
        blocks: [
          { table: {
            head: ["Mensaje", "Redacción integrada (español)", "Cuándo se envía"],
            rows: [
              ["Voy en camino", "«[Empresa]: [Trabajador] va en camino, llega en 20 min. Para cambiar la hora, llame al [teléfono].»", "En el momento en que un miembro de la cuadrilla pone una visita de trabajo en Voy en camino. La hora de llegada se calcula desde donde estaba su teléfono cuando tocó hasta la dirección del trabajo, redondeada a cinco minutos, y se omite cuando cualquiera de los dos extremos es desconocido. La línea del teléfono se quita si su empresa no tiene teléfono registrado."],
              ["Recordatorio de cita", "«[Empresa]: Recordatorio — su cita es mar., 15 sept., 2:00 p. m. en 123 Oak St. Responda STOP para no recibir más.»", "Una vez, dentro de la anticipación que eligió (2, 24 o 48 horas antes), para una cita reservada o una visita de trabajo programada que no esté cancelada ni completada. Se comprueba cada hora."],
            ],
          } },
          { p: "La hora en un recordatorio se escribe en la zona horaria de su empresa y en el formato de fecha propio del cliente. La palabra STOP se queda en inglés en todos los idiomas, porque STOP es la palabra clave que las operadoras y el manejador de respuestas reconocen." },
          { warning: "Las respuestas a estos mensajes no las lee nadie. El mensaje de Voy en camino apunta a su número de teléfono por una razón: un cliente que responde «¿podemos a las 3 mejor?» le está hablando a nadie. Solo se actúa sobre STOP y START." },
        ],
      },
      {
        id: "language",
        heading: "En qué idioma lo recibe un cliente",
        blocks: [
          { p: "El mensaje sigue el idioma del cliente igual que lo hizo su presupuesto: los ocho idiomas de cliente en los que FieldQuo escribe documentos (inglés, francés, español, ucraniano, punyabí, tagalo, alemán, italiano); cualquier otro lee inglés. Si reescribió un mensaje en **Configuración → Mensajes de clientes**, su redacción va a los clientes que leen el idioma de su empresa; un cliente cuyo idioma es distinto recibe la redacción integrada de FieldQuo en el suyo. FieldQuo no traduce automáticamente su frase." },
        ],
      },
      {
        id: "stop-and-start",
        heading: "STOP, y volver a empezar",
        blocks: [
          { bullets: [
            "Una respuesta de **STOP** (o STOPALL, UNSUBSCRIBE, CANCEL, END, QUIT; un punto o signo de exclamación al final se ignora) excluye ese número de teléfono. Ninguno de los dos mensajes se le vuelve a enviar, y a un número que se excluyó de las llamadas también se le rechazan los mensajes.",
            "**START** o **UNSTOP** revierte la exclusión de mensajes. Nunca restaura el consentimiento de llamadas, que es deliberadamente de un solo sentido.",
            "En el número compartido de FieldQuo, un STOP excluye el número de cada empresa que lo tenga en un registro de cliente: la única lectura honesta de un «dejen de escribirme» enviado a una línea que escribe para muchas.",
            "La barrera se comprueba en el momento de cada envío, para ambos mensajes, desde un solo lugar.",
          ] },
        ],
      },
      {
        id: "what-you-control",
        heading: "Qué controla usted",
        blocks: [
          { steps: [
            "Abra **Configuración → Notificaciones → Recordatorios de cita** y elija **Desactivado**, **2 horas antes**, **24 horas antes** o **48 horas antes**. Desactivado es el valor predeterminado; una empresa que nunca eligió una anticipación no envía recordatorios.",
            "Abra **Configuración → Mensajes de clientes** para reescribir cualquiera de los dos mensajes. Solo funcionan los campos que se muestran: {company}, {worker}, {name}, {eta}, {phone} para Voy en camino; {company}, {when}, {location} para el recordatorio. Un campo desconocido se rechaza al Guardar, y un mensaje de más de 320 caracteres se marca porque cuesta tres segmentos.",
            "Lea **Tu cliente ve:** bajo el editor — es la cadena exacta que saldrá — y luego **Guardar**, o **Usar el predeterminado** para volver a la redacción de FieldQuo.",
          ] },
          { p: "Un miembro de la cuadrilla envía Voy en camino desde la visita de trabajo en su teléfono; nadie tiene que acordarse de escribir. No hay botón para enviar un recordatorio a mano, y una visita se recuerda como máximo una vez." },
        ],
      },
      {
        id: "what-is-not-texted",
        heading: "Qué no envía FieldQuo por texto",
        blocks: [
          { bullets: [
            "Una confirmación de reserva: va por correo, desde su empresa, cuando se reserva una visita en su página de reservas.",
            "Un presupuesto, una factura, un reclamo de factura vencida o un mensaje de «su trabajo está completo»: solo por correo.",
            "Una solicitud de reseña: solo por correo, y solo a un cliente con dirección de correo.",
            "Un mensaje de la recepcionista telefónica: lee un enlace de reserva en voz alta; hoy no puede enviarlo por texto.",
          ] },
          { p: "Todo el detalle sobre qué está automatizado y qué no: [[texting-clients-what-is-and-is-not-automated|Mensajes de texto a clientes: qué está automatizado y qué no]]." },
        ],
      },
      {
        id: "who-can-see-it",
        heading: "Quién puede cambiarlo",
        blocks: [
          { p: "**Configuración → Notificaciones** es solo para propietario y administradores. **Configuración → Mensajes de clientes** necesita el nivel Manager o superior: un propietario, un administrador, un Manager o un Dispatcher. Cualquier miembro de la cuadrilla asignado a una visita puede disparar Voy en camino desde su teléfono." },
        ],
      },
    ],
    faq: [
      { q: "¿Un mensaje de texto me cuesta algo?", a: "No. Los mensajes a clientes están incluidos en su plan y no se cobra nada por mensaje. (La línea de mensajes de la cuadrilla y la recepcionista telefónica son aparte y se miden.)" },
      { q: "¿Por qué un cliente no recibió un recordatorio?", a: "Una de estas razones: los recordatorios están Desactivado en Configuración → Notificaciones; el cliente no tiene número de teléfono; la cita está cancelada o completada; ya se le recordó una vez; o el número respondió STOP." },
      { q: "¿El cliente puede responder para cambiar la hora?", a: "No por texto: las respuestas no se leen. El mensaje de Voy en camino da su número de teléfono para eso; una visita reservada en su página de reservas también tiene su propio enlace de gestión por correo." },
      { q: "¿El mensaje sale desde mi número?", a: "Desde su propio número de mensajes si su empresa tiene uno; si no, desde un número compartido de FieldQuo, con el nombre de su empresa al principio del mensaje." },
    ],
  },
};
