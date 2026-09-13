// content/help/es/settings-4.js
//
// Parte 4 de la categoría « settings » en español (ver el compositor,
// settings.js): las filas De cara al cliente que miran a un desconocido —
// Comparte tus enlaces, Enlace para la bio, Recepcionista telefónico, Empleado
// de IA, Reseñas — y las cuatro filas de Cuenta — Migración de datos, Novedades
// del producto, Cuenta y facturación, Recomienda y gana.
//
// Misma estructura que el inglés, artículo por artículo: mismos slugs, mismas
// secciones en el mismo orden, mismos bloques, mismas figuras —
// scripts/check-help-centre.mjs compara los dos. Las palabras en pantalla
// vienen del bloque `es` de app/i18n/appMessages.js (y, para los botones por
// defecto de la página de enlace, de lib/links/labels.js y lib/site/siteCopy.js).
export const ARTICLES = {
  "settings-share-your-links": {
    title: "Comparte tus enlaces",
    summary:
      "La fila de Configuración que lista cada enlace público que un desconocido puede usar para convertirse en cliente potencial — Solicitar una cotización, Reservar una visita, Estimación instantánea, cada embudo publicado — con Copiar enlace, Abrir y un fragmento para insertar en cada tarjeta.",
    updated: "2026-09-12",
    intro: [
      "**Configuración → De cara al cliente → Comparte tus enlaces** es la única pantalla que responde a «¿qué puedo poner en mi página de Facebook, mi ficha de Google, mi firma de correo o el costado de la camioneta?». Su subtítulo lo dice tal cual: «Ponlos donde ya estás — tu sitio web, tu ficha de Google, tu página de Facebook, tu firma de correo o el costado de la camioneta.»",
      "Cada enlace que contiene es público — sin inicio de sesión, sin app, funciona en un teléfono en una entrada de garaje — y cada visitante que usa uno aterriza en su tablero de Prospectos o en su calendario, en una página que lleva su logo y su color. Nada en esta pantalla es un ajuste; es una lista de direcciones que usted copia.",
    ],
    sections: [
      {
        id: "overview",
        heading: "Resumen",
        blocks: [
          { p: "El enlace simple va primero en cada tarjeta y el código para insertar segundo, porque la mayoría de los contratistas tienen una página de Facebook y un teléfono, no un sitio web donde pegar código. Cada tarjeta tiene la misma forma: un título, una frase que dice para quién es el enlace, la dirección en sí, **Copiar enlace**, **Abrir**, y debajo **Insértalo en tu sitio web en su lugar** con un botón **Copiar** para el fragmento." },
          { p: "El fragmento apunta a un marco de la misma página sin la interfaz de FieldQuo; informa su propia altura para encajar limpiamente en el sitio donde lo pegue. Vea [[embed-booking-and-quote-forms|Insertar formularios de reserva y cotización en cualquier sitio]]." },
        ],
      },
      {
        id: "on-the-screen",
        heading: "Qué hay en la pantalla",
        blocks: [
          { bullets: [
            "**Solicitar una cotización** — «Describen el trabajo y dejan sus datos. Llega a tu lista de prospectos. Ideal para quienes todavía comparan precios.»",
            "**Reservar una visita** — «Eligen una hora según tu disponibilidad real. Ideal para quienes ya decidieron y solo quieren que vayas.»",
            "**Estimación instantánea** — «Ingresan su dirección y obtienen un precio inicial real en segundos — techo medido por satélite o un área que trazan en un mapa. Cada estimación llega a tu cola de revisión antes de ser vinculante.» Los oficios y las tarifas viven en **Configuración → Cotizaciones instantáneas**.",
            "**Diseña tu cocina** — se muestra solo cuando el servicio **Diseño de cocinas e instalaciones nuevas** está activado en Servicios. Un propietario diseña su propia cocina y se la envía como consulta con el plano adjunto. Esta tarjeta tiene un enlace y no un fragmento, porque no existe un módulo de cocina insertable.",
            "**Una tarjeta por embudo publicado**, con el nombre que usted le puso — «Un embudo de clientes potenciales paso a paso — comparte el enlace en un anuncio o ponlo en tu web.» Un embudo en borrador no se lista, porque su enlace todavía no funcionaría.",
            "La línea final: el formulario de cotización solo ofrece los servicios que activó en **Configuración → Servicios**, y nunca muestra sus precios.",
          ] },
        ],
      },
      {
        id: "copy-a-link",
        heading: "Cómo copiar un enlace",
        blocks: [
          { steps: [
            "Abra **Configuración → Comparte tus enlaces**.",
            "En la tarjeta que quiera, pulse **Copiar enlace**. El botón dice **Copiado** durante dos segundos.",
            "Pulse **Abrir** primero si quiere ver la página exactamente como la verá un desconocido.",
            "Pegue el enlace donde la gente ya lo encuentra. Para un sitio web que usted administra, pulse en cambio **Copiar** bajo **Insértalo en tu sitio web en su lugar** y entréguele el código a quien edita el sitio.",
          ] },
          { figure: "live:app-settings-lead-form", caption: "Configuración → Comparte tus enlaces — las tarjetas Solicitar una cotización, Reservar una visita y Estimación instantánea, cada una con su enlace, Copiar enlace, Abrir y el fragmento para insertar." },
          { note: "No hay código QR en esta pantalla. El enlace no cambia, así que cualquier generador de QR lo convertirá en un cuadrado para la camioneta, y el cuadrado seguirá funcionando." },
        ],
      },
      {
        id: "where-each-link-goes",
        heading: "Adónde lleva cada enlace",
        blocks: [
          { table: {
            head: ["Enlace", "Qué hace el visitante", "Qué obtiene usted"],
            rows: [
              ["Solicitar una cotización", "Elige un servicio, describe el trabajo, agrega fotos, deja sus datos", "Un cliente potencial puntuado en el tablero de Prospectos — vea [[the-lead-form-on-your-website|El formulario de contacto en su sitio web]]"],
              ["Reservar una visita", "Elige un tipo de visita y un horario según su disponibilidad real, paga una tarifa de visita si usted la cobra", "Una cita en su calendario y un cliente potencial — vea [[settings-booking-page|Página de reservas]]"],
              ["Estimación instantánea", "Ingresa una dirección o traza un área y ve un precio inicial", "Una estimación en su cola de revisión, confirmada por usted antes de enviar nada — vea [[settings-instant-quotes|Cotizaciones instantáneas]]"],
              ["Un embudo", "Avanza por un cuestionario corto y deja sus datos", "Un cliente potencial puntuado, etiquetado con el canal del embudo — vea [[funnels|Embudos de clientes potenciales]]"],
            ],
          } },
          { p: "Ninguno de los cuatro muestra una tarifa. La estimación instantánea muestra un precio inicial solo para los oficios que activó, y solo lo que eligió bajo **Lo que ve el propietario** en la pantalla de Cotizaciones instantáneas." },
        ],
      },
      {
        id: "who-can-see-it",
        heading: "Quién puede verlo",
        blocks: [
          { p: "El propietario, los administradores y cualquiera en el nivel Despachador o Encargado ven la fila y cada tarjeta. Los accesos de Cuadrilla y Estimador no la ven. Las tarjetas de embudo leen la lista de embudos, que es solo para propietarios y administradores en el servidor; un Despachador o Encargado ve la línea **Los embudos de clientes potenciales los gestiona un propietario o un administrador — pídeles el enlace** en lugar de las tarjetas de embudo, y las tres tarjetas fijas como siempre." },
        ],
      },
    ],
    faq: [
      { q: "¿Por qué mi embudo no aparece?", a: "Solo aparecen los embudos publicados con una dirección. Abra Embudos, abra el embudo y publíquelo; un embudo necesita un paso de contacto antes de poder publicarse." },
      { q: "¿Estos enlaces muestran mis precios?", a: "No. El formulario de cotización reúne suficiente detalle para cotizar con precisión sin publicar una tarifa, y la estimación instantánea muestra solo lo que usted eligió mostrar para los oficios que activó." },
      { q: "¿Puedo cambiar la dirección de un enlace?", a: "Los enlaces se construyen con el identificador de reservas de su empresa, que se define en Configuración → Página de reservas. Cambiarlo allí cambia cada enlace de esta pantalla, y todo lo ya impreso deja de funcionar." },
    ],
  },

  "settings-bio-link": {
    title: "Enlace para la bio",
    summary:
      "La fila de Configuración que construye la única página a la que Instagram y TikTok le permiten enlazar — su encabezado, una línea debajo, sus usuarios de redes y los botones que importan — con una vista previa de teléfono en vivo y un botón Guardar.",
    updated: "2026-09-12",
    intro: [
      "**Configuración → De cara al cliente → Enlace para la bio** convierte en página el único enlace que permite un perfil social: «Una sola página para el único enlace que Instagram y TikTok permiten en tu perfil. Lleva tu logo y tu color, con una pequeña línea «Made by FieldQuo» al final.» La dirección está arriba de la pantalla, en grande, con **Copiar enlace**, porque meter esa cadena en el portapapeles de un teléfono es la razón por la que alguien abre esta fila.",
      "Nada en la página se inventa. Un botón aparece porque lo que hay detrás existe — un estimador instantáneo, un tipo de visita reservable, un embudo publicado, su sitio web, su enlace de reseñas, su teléfono — y un botón que usted apaga se queda apagado.",
    ],
    sections: [
      {
        id: "overview",
        heading: "Resumen",
        blocks: [
          { p: "La página se deriva del registro de su empresa. El formulario de cotización siempre está, porque toda empresa tiene uno; **Reservar una visita** aparece cuando tiene un tipo de visita activo; un precio instantáneo cuando un estimador instantáneo está activado; cada embudo publicado como su propio botón; su sitio web cuando está publicado o cuando hay un dominio ingresado en Configuración de la empresa; **Deja una reseña** cuando hay un enlace guardado en Reseñas; **Llamar** y **Envíanos un correo** a partir del teléfono y el correo de Configuración de la empresa. Cada fila que tiene está activada por defecto, salvo **Escríbenos por WhatsApp**, que se queda apagada hasta que usted diga que el número está en WhatsApp." },
          { p: "La página pública sigue por sí sola el teléfono del visitante entre claro y oscuro. El selector claro / oscuro de esta pantalla solo cambia el marco de la vista previa. El texto de los botones viene del idioma de su empresa, no del idioma en que está leyendo la configuración." },
        ],
      },
      {
        id: "on-the-screen",
        heading: "Qué hay en la pantalla",
        blocks: [
          { bullets: [
            "**Tu enlace** — la dirección, **Copiar enlace**, **Abrir**, y la casilla **La página está activa**. Debajo: «Pega esto en tu bio de Instagram o TikTok.»",
            "**Encabezado** — «Déjalo vacío para usar el nombre de tu empresa.» — y **Una línea debajo** — «Opcional. Vacío significa que no se muestra nada — no la escribimos por ti.»",
            "**Síguenos** — Instagram, Facebook, TikTok, YouTube, LinkedIn y X. «Escribe un usuario o pega el enlace del perfil; deja uno vacío para ocultarlo.»",
            "**Qué hay en la página** — cada fila con una casilla **Mostrar en la página**, su **Texto del botón**, un asa para arrastrar, **Subir** / **Bajar**, y su grupo: **Obtener un precio**, **Reservar**, **Contacto** o **Más**. «El primero es el botón grande.»",
            "**Agregar tu propio enlace** — hasta diez filas que escribe usted mismo, cada una con texto, una URL y un **Icono**.",
            "**Todavía no disponible** — las filas que aún no puede tener, cada una con la pantalla que la crearía.",
            "**Vista previa** — un marco de teléfono que se actualiza mientras escribe, con un selector **Claro** / **Oscuro**, y **Guardar** al final.",
          ] },
        ],
      },
      {
        id: "set-it-up",
        heading: "Cómo configurarlo",
        blocks: [
          { steps: [
            "Abra **Configuración → Enlace para la bio**.",
            "Escriba el **Encabezado**, o déjelo vacío para usar el nombre de su empresa, y **Una línea debajo** si quiere una.",
            "Bajo **Síguenos**, escriba sus usuarios. Un campo que no parece un usuario ni un enlace de perfil no se guarda, y la pantalla lo dice antes de que guarde.",
            "Bajo **Qué hay en la página**, marque las filas que quiera, renombre un botón cuyo texto por defecto no sea el suyo, y arrastre o use las flechas para poner el más importante primero — se convierte en el botón grande.",
            "Pulse **Agregar tu propio enlace** para cualquier otra cosa, como una ficha de Google o una galería en otro sitio. Sus propios enlaces necesitan texto y una URL.",
            "Pulse **Guardar**, luego **Copiar enlace**, y péguelo en su perfil de Instagram o TikTok.",
          ] },
          { figure: "live:app-settings-links", caption: "Configuración → Enlace para la bio — Tu enlace con Copiar enlace y Abrir, las tarjetas Encabezado y Síguenos, las filas ordenadas bajo Qué hay en la página, y la vista previa de teléfono." },
          { note: "No se guarda nada hasta que pulse **Guardar**. Reordenar, renombrar y apagar es una edición en varios pasos de una sola página pública, y guardar cada pulsación pondría estados a medio terminar delante de quien toque el enlace mientras tanto." },
        ],
      },
      {
        id: "what-each-control-changes",
        heading: "Qué cambia cada control",
        blocks: [
          { bullets: [
            "**La página está activa** — desmárquela y guarde, y la dirección muestra una página de no encontrado hasta que la vuelva a marcar. La pantalla entonces dice «La página está desactivada — este enlace muestra una página de no encontrado.» La página está activa desde el principio.",
            "**Mostrar en la página** — oculta o muestra una fila. Una fila oculta conserva su lugar y su texto para cuando la recupere.",
            "**Texto del botón** — reemplaza el texto por defecto solo de esa fila. Vacío significa el texto por defecto, nunca un botón en blanco.",
            "**El orden** — la primera fila es el botón grande. La página agrupa las filas bajo títulos, y los títulos se ordenan según dónde cae la primera fila de cada grupo, así que poner su sitio web primero pone **Más** primero.",
            "**Claro** / **Oscuro** — solo el marco de la vista previa. Los visitantes reciben lo que pida su teléfono.",
          ] },
        ],
      },
      {
        id: "who-can-see-it",
        heading: "Quién puede verlo",
        blocks: [
          { p: "El propietario, los administradores y cualquiera en el nivel Despachador o Encargado pueden abrir y guardar esta pantalla; los accesos de Cuadrilla y Estimador no ven la fila. La página pública no necesita nada — ni cuenta, ni app. Para la página en sí y lo que abre cada botón, vea [[the-bio-link|El enlace para la bio]]." },
        ],
      },
    ],
    faq: [
      { q: "¿Por qué Reservar una visita está en gris?", a: "No tiene ningún tipo de visita activo. La lista Todavía no disponible dice qué pantalla crea uno — Configuración → Página de reservas." },
      { q: "¿Por qué WhatsApp está apagado si tengo un número de teléfono?", a: "Tener un número no dice que WhatsApp esté en él, y un enlace de WhatsApp a un número que no lo tiene abre un chat con nadie. Marque Mostrar en la página cuando lo esté." },
      { q: "¿Hay un código QR?", a: "No en esta pantalla. La dirección es lo bastante corta para decirla en voz alta, y cualquier generador de QR la convertirá en un cuadrado para la camioneta." },
    ],
  },

  "settings-phone-receptionist": {
    title: "Recepcionista telefónico",
    summary:
      "La fila de Configuración que prepara la recepcionista de IA: crédito, un número, lo que dice, el interruptor de contestar, las devoluciones de llamada, los mensajes de la cuadrilla y la comprobación de principio a fin — qué cambia cada tarjeta y quién puede abrirla.",
    updated: "2026-09-12",
    intro: [
      "**Configuración → De cara al cliente → Recepcionista telefónico** se titula «Contesta las llamadas que no puedes, toma los datos y agenda visitas según tu disponibilidad real. Nunca da un precio.» La pantalla sigue el orden de las decisiones — crédito, luego un número, luego las palabras, luego el interruptor — y una empresa nueva ve las tarjetas numeradas del 1 al 7. Una vez hecha la configuración, los números desaparecen y quedan las mismas tarjetas.",
      "Este artículo recorre la pantalla tarjeta por tarjeta. Lo que hace la recepcionista en una llamada, lo que cuesta un minuto y lo que ninguna otra página de precios lista está en [[the-phone-receptionist|La recepcionista telefónica]]; lo que hizo con cada llamada es la pantalla Recepcionista de la barra lateral principal, vea [[the-receptionist-call-log|El registro de llamadas de la recepcionista]].",
    ],
    sections: [
      {
        id: "overview",
        heading: "Resumen",
        blocks: [
          { p: "Una barra de estado arriba muestra su número y si está contestando. Todo lo que la recepcionista puede gastar lo cobra el servidor y se imprime en la pantalla antes de que usted se comprometa: la tarifa por minuto en la tarjeta **Crédito**, el alquiler mensual junto a cada tipo de número, los montos de recarga. El navegador nunca envía un monto." },
          { note: "La recepcionista funciona con crédito prepagado en dólares estadounidenses. Las llamadas se miden por minuto, los números se alquilan por mes, y ambos salen del mismo saldo." },
        ],
      },
      {
        id: "on-the-screen",
        heading: "Las siete tarjetas",
        blocks: [
          { bullets: [
            "**Crédito** — el **Saldo:**, la tarifa («35¢ por minuto, redondeado hacia arriba, mínimo un minuto. El alquiler mensual de tu número sale de este mismo crédito.»), **Añadir crédito**, **A dónde fue el crédito**, y la tarjeta **Recargar automáticamente**.",
            "**Tu número** — «El número en el que responde la recepcionista.» Tres formas de conseguir uno: **Conservar mi número y desviar las llamadas perdidas** (marcada **Recomendado**), **Conseguir un número nuevo** con **Elegir el número tú mismo**, o **Trasladar mi número**. Un número activo muestra sus códigos de desvío, su próxima fecha de alquiler y un enlace **Devolver**.",
            "**Lo que dice** — «Nunca dará un precio, prometerá una hora que no ha verificado ni afirmará ser una persona.» El **Saludo**, **Algo que deba saber** con **Redactar esto desde el perfil de mi empresa**, **Qué les pide a quienes llaman**, la **Voz** con las muestras **Escuchar a …**, y **Cómo suena**.",
            "**Contestar mis llamadas** — el único interruptor: **Empezar a contestar llamadas** / **Está contestando — desactivar**.",
            "**Devolver llamadas a los clientes automáticamente** — **Activar las devoluciones de llamada de presupuestos** y **Qué presupuestos reciben una llamada**. Se trata en [[quote-callbacks|Devoluciones de llamada de presupuestos]].",
            "**Permite que el equipo envíe fotos y novedades por mensaje** — un enlace **Configurar los mensajes del equipo**. Los mensajes de la cuadrilla usan su propio número, distinto del que contesta sus llamadas, y se configuran en la página de la bandeja de la cuadrilla: [[the-crew-inbox|La bandeja de la cuadrilla: fotos y novedades por mensaje]].",
            "**Comprobarlo de principio a fin** — **Ejecutar la comprobación** le pregunta al propio servicio telefónico por cada eslabón entre alguien que marca y un cliente potencial que aterriza en FieldQuo. Se muestra cuando tiene un número.",
          ] },
          { figure: "live:app-settings-voice", caption: "Configuración → Recepcionista telefónico — la barra de estado, la tarjeta Crédito con su saldo y recargas, Tu número, y las tarjetas de saludo, voz y ajuste debajo." },
        ],
      },
      {
        id: "set-it-up",
        heading: "Cómo configurarla",
        blocks: [
          { steps: [
            "Bajo **Crédito**, pulse **Añadir crédito** si el saldo está vacío — $10, $30, $50, $100, o cualquier monto entre $5 y $1,000. Su primer número viene con 30 minutos de crédito gratis, y el primer mes de alquiler del número se descuenta de ahí.",
            "Bajo **Tu número**, elija **Conservar mi número y desviar las llamadas perdidas** a menos que tenga una razón para no hacerlo. FieldQuo alquila una línea para la recepcionista y muestra el código que debe marcar desde su propio teléfono; sus clientes siguen marcando el número de la camioneta, y solo las llamadas que usted pierde llegan a la recepcionista.",
            "Bajo **Lo que dice**, escriba el **Saludo** y pulse **Redactar esto desde el perfil de mi empresa**. Lista las preguntas que no puede responder con su configuración — lo que rechaza, qué cuenta como urgente, qué decir cuando está cerrado — bajo **Responde esto con tus propias palabras**. Escriba encima de cada corchete; una línea que quede entre corchetes se omite.",
            "Elija una **Voz** y escúchela con **Escuchar a …**. Deje **Cómo suena** en sus valores predeterminados a menos que las llamadas se sigan cortando.",
            "Pulse **Empezar a contestar llamadas**, luego **Ejecutar la comprobación** bajo **Comprobarlo de principio a fin** y llame a su propio número.",
          ] },
        ],
      },
      {
        id: "what-each-control-changes",
        heading: "Qué cambia cada control",
        blocks: [
          { table: {
            head: ["Control", "Qué cambia"],
            rows: [
              ["**Conservar mi número y desviar las llamadas perdidas**", "Alquila una línea local de $4 al mes en la que contesta la recepcionista. Su propio número no se toca; usted configura el desvío condicional en su teléfono con el código mostrado, y lo deshace marcando ##002#."],
              ["**Conseguir un número nuevo** / **Elegir el número tú mismo**", "Compra una línea aparte — local a $4 al mes, gratuita para quien llama a $9 al mes más 5¢ por minuto — en el código de área que elija. Elegir uno lo compra de inmediato y el primer mes sale de su crédito."],
              ["**Trasladar mi número**", "Inicia una portabilidad. No se cobra nada por empezar; su número sigue funcionando con su antiguo operador durante las dos a cuatro semanas que tarda el traslado, y la recepcionista no puede contestar en él hasta que llegue."],
              ["**Saludo**, **Algo que deba saber**", "Lo primero que oye cada persona que llama, y los datos que puede usar más allá de su configuración. El horario, los servicios y las zonas se leen de su configuración en cada llamada y van ahí, no en la nota."],
              ["**Voz**, **Cómo suena**", "Qué voz habla, y cuatro opciones de ajuste — qué hace cuando alguien le habla encima, desde dónde suelen llamar, con qué rapidez contesta, cómo se percibe. Ninguna cambia lo que tiene permitido decir."],
              ["**Contestar mis llamadas**", "Si el número se contesta o no. Se niega a activarse sin un número y sin crédito para al menos un minuto. Apagarlo deja de contestar de inmediato — «Si este número está en tu camioneta, desvíalo a algún sitio antes de desactivarlo.»"],
              ["**Recargar automáticamente**", "Apagado a menos que lo active. Guarda una tarjeta y, cuando el saldo baja de $5, $10 o $20, cobra el monto que eligió — como máximo 3 veces al día. Se apaga solo y le avisa si la tarjeta es rechazada."],
              ["**Devolver …**", "Devuelve un número comprado para siempre. Se elimina en la compañía telefónica, no se puede recuperar, y el resto del mes pagado no se reembolsa."],
            ],
          } },
        ],
      },
      {
        id: "who-can-see-it",
        heading: "Quién puede verlo",
        blocks: [
          { p: "El propietario, los administradores y cualquiera en el nivel Despachador o Encargado ven la fila y pueden cambiar todo en ella — comprar un número y recargar gastan el dinero de la empresa. Los accesos de Cuadrilla y Estimador no la ven. El registro de llamadas de la barra lateral principal tiene su propia regla." },
        ],
      },
    ],
    faq: [
      { q: "El interruptor no se activa.", a: "Necesita un número activo y crédito suficiente para un minuto. La línea bajo Contestar mis llamadas dice cuál falta — «Primero configura un número arriba» o «Primero agrega saldo»." },
      { q: "¿Puede dar un precio por teléfono?", a: "Nunca. Puede leer una tarifa de visita que usted publicó en su página de reservas, porque es su propia cifra, pero nunca cotiza el trabajo." },
      { q: "Llamé y no apareció nada en FieldQuo.", a: "Pulse Ejecutar la comprobación bajo Comprobarlo de principio a fin. Le pregunta al servicio telefónico por cada eslabón y nombra el que está roto, y puede volver a enviar su configuración al proveedor con un solo botón." },
    ],
  },

  "settings-ai-employee": {
    title: "Empleado de IA",
    summary:
      "La fila de Configuración donde contrata un asistente que responde el mensaje de un cliente — su puesto, cómo escribe, qué lee, borrador o envío — y por qué, hoy, cada respuesta es un borrador que lo espera a usted.",
    updated: "2026-09-12",
    intro: [
      "**Configuración → De cara al cliente → Empleado de IA** — «Un asistente que responde el mensaje de un cliente por usted, usando su lista de precios y el material que le entregue.» Usted elige el puesto que ocupa, cómo escribe, qué puede leer, hasta dónde puede llegar, y si redacta un borrador o envía. La fila lleva una insignia **Vista previa**.",
      "La pantalla abre con lo único que todavía no puede hacer: «Las respuestas todavía no pueden salir. El empleado de IA responde sus mensajes de Facebook e Instagram, y Meta no ha aprobado la mensajería para FieldQuo. Aquí todo funciona: redacta, y los borradores esperan abajo a que usted los envíe.» Todo lo demás es real y ejecuta el código real; el envío espera a Meta.",
    ],
    sections: [
      {
        id: "overview",
        heading: "Resumen",
        blocks: [
          { p: "El puesto es un conjunto de capacidades, no una personalidad: «El puesto decide lo que tiene permitido hacer, no solo cómo suena. Una recepcionista no tiene forma de consultar un precio: ese es el sentido de elegir uno.» Todos los puestos comparten la misma regla, impresa en la pantalla: nunca puede inventar un precio, una fecha ni una política, y si la respuesta no está en sus propios datos o su propio material, entrega la conversación a una persona." },
          { p: "Cada respuesta y cada prueba gastan crédito de IA, medido como el resto de FieldQuo AI. Cuando la asignación se agota, la pantalla lo dice con un enlace **Recargar crédito de IA** y el empleado se detiene en lugar de adivinar. Vea [[settings-ai-credit|Crédito de IA]]." },
        ],
      },
      {
        id: "on-the-screen",
        heading: "Qué hay en la pantalla",
        blocks: [
          { bullets: [
            "**¿Qué puesto ocupa?** — cuatro tarjetas: **Cierre de ventas**, **Recepcionista**, **Soporte técnico**, **Otra cosa**, cada una con **Puede:** y **No puede:** debajo.",
            "**Cómo escribe** — **Cómo lo llama usted** (para usted, nunca se le dice a los clientes), **Tono**, **Frase de apertura (opcional)**, **Sus instrucciones**, **Cuándo debe buscar a una persona**.",
            "**¿Borrador o envío?** — **Escríbame un borrador (recomendado)** o **Enviarla automáticamente**.",
            "**Límites** — **Responder solo en horario de atención**, **Máximo de respuestas en una conversación**, **Activar el empleado de IA**, luego **Guardar**.",
            "**Lo que lee** — **Subir un archivo** o **Pegar texto en su lugar**, y la lista de lo que ha leído, con un motivo en todo lo que no pudo.",
            "**Pruébelo** — una casilla de prueba y **Ver la respuesta**; luego **Esperándolo a usted**, los borradores con **Enviarla** / **Esta no**, y **Se detuvo en estas** con **Dejar que vuelva a responder**.",
          ] },
        ],
      },
      {
        id: "hire-it",
        heading: "Cómo contratarlo",
        blocks: [
          { steps: [
            "Abra **Configuración → Empleado de IA** y elija un puesto. **Cierre de ventas** es el único autorizado a acercarse a una cifra: lee su lista de precios y puede armar una estimación instantánea con sus propias tarifas. **Recepcionista** toma los datos y agenda una devolución de llamada. **Soporte técnico** responde con el material que sube y nombra el documento de donde salió.",
            "Complete **Sus instrucciones** — zonas que cubre, lo que no hace, cómo le gusta que se digan las cosas — y **Cuándo debe buscar a una persona**.",
            "Deje seleccionado **Escríbame un borrador (recomendado)**. Defina **Máximo de respuestas en una conversación**; cero lo pausa sin perder su configuración.",
            "Bajo **Lo que lee**, suba su política, sus notas de diagnóstico o un manual, o pegue el texto.",
            "Marque **Activar el empleado de IA** y pulse **Guardar**. Luego escriba el mensaje de un cliente bajo **Pruébelo** y pulse **Ver la respuesta** — muestra lo que usó y lo que costó la prueba.",
          ] },
          { figure: "live:app-settings-ai-employee", caption: "Configuración → Empleado de IA — el aviso de que las respuestas todavía no pueden salir, las cuatro tarjetas de puesto, y Cómo escribe debajo." },
        ],
      },
      {
        id: "what-each-setting-changes",
        heading: "Qué cambia cada ajuste",
        blocks: [
          { table: {
            head: ["Ajuste", "Qué hace"],
            rows: [
              ["El puesto", "Fija las herramientas que puede llamar. Cierre de ventas: consultar precios de servicios, armar una estimación instantánea, agendar una devolución de llamada, pasar a una persona. Los otros tres: agendar una devolución de llamada y pasar a una persona, nada más."],
              ["**Tono**", "Profesional, cálido o breve — cómo se redactan los mismos hechos."],
              ["**Escríbame un borrador**", "La respuesta espera bajo **Esperándolo a usted** con **Enviarla** y **Esta no**. «Enviar una la envía en la conversación, igual que si la hubiera escrito usted.»"],
              ["**Enviarla automáticamente**", "«La respuesta va directa al cliente sin que nadie la lea antes.» Sigue negándose a dar un precio que no salga de sus tarifas y sigue deteniéndose cuando duda. Hoy el canal está bloqueado, así que redacta un borrador de todos modos."],
              ["**Responder solo en horario de atención**", "Usa el horario guardado en Configuración de la empresa; fuera de él, el mensaje lo espera a usted. Sin horario guardado no hace nada — «no va a adivinar un lunes a viernes por usted.»"],
              ["**Máximo de respuestas en una conversación**", "El tope por hilo. Cuando se alcanza, el hilo aparece bajo **Se detuvo en estas** con **Dejar que vuelva a responder**."],
            ],
          } },
          { warning: "«Podemos leer texto plano: .txt, .md y .csv, o texto que usted pegue. Todavía no podemos leer un PDF ni un archivo de Word: si sube uno, aparecerá abajo marcado como no leído, y la solución es pegar el texto o exportarlo como .txt.» El material subido se trata como evidencia, nunca como órdenes — una instrucción escondida dentro de un manual es solo texto." },
        ],
      },
      {
        id: "who-can-see-it",
        heading: "Quién puede verlo",
        blocks: [
          { p: "El propietario, los administradores y cualquiera en el nivel Despachador o Encargado — el mismo escalón que la recepcionista telefónica, porque decide lo que se les dice a los clientes en nombre de la empresa y gasta la asignación de IA de la empresa. Los accesos de Cuadrilla y Estimador no ven la fila. Enviar o descartar un borrador necesita el mismo acceso que la pantalla. La historia completa, incluido cómo se ven los borradores en Mensajes, es [[the-ai-employee|El empleado de IA: borradores que usted aprueba]]." },
        ],
      },
    ],
    faq: [
      { q: "¿Los clientes sabrán que hablan con un programa?", a: "Nunca afirma ser una persona con nombre. Si se le pregunta directamente, dice que la respuesta es automática y que un miembro del equipo dará seguimiento. El nombre que usted le pone es para usted." },
      { q: "¿Puede dar un precio?", a: "Solo el Cierre de ventas, y solo una cifra que una herramienta de FieldQuo calculó con sus propias tarifas, que repite y atribuye. No puede sumar, descontar ni redondear." },
      { q: "¿Por qué no hay nada bajo Esperándolo a usted?", a: "No ha llegado ningún mensaje que pudiera responder — normalmente porque no hay ninguna Página conectada o Meta aún no ha aprobado la mensajería — o está apagado, fuera del horario de atención o por encima de su tope." },
    ],
  },

  "settings-reviews": {
    title: "Reseñas",
    summary:
      "La fila de Configuración que le pide una reseña a cada cliente cuando su trabajo se marca como completado — su enlace de reseñas, el interruptor Pedir automáticamente, el retraso, un conteo de la cola en vivo — y los testimonios que se muestran en su sitio web.",
    updated: "2026-09-12",
    intro: [
      "**Configuración → De cara al cliente → Reseñas** — «Pide una reseña a los clientes automáticamente cuando termine su trabajo.» Cuando un trabajo se marca como completado, el cliente recibe un solo correo con su enlace de reseñas, tras un retraso que usted elige. La pantalla no dice solo Activado: le dice cuántos clientes están en la cola ahora mismo y a cuántos se les pidió en los últimos 30 días.",
      "La mitad inferior de la misma pantalla, **Reseñas en tu sitio web**, es adonde van las reseñas una vez que las tiene: los testimonios que muestra su sitio web, y un fragmento para mostrarlos en un sitio que ya administra.",
    ],
    sections: [
      {
        id: "overview",
        heading: "Resumen",
        blocks: [
          { p: "La solicitud es un correo, de su empresa, con su logo y su color y su nombre en la línea De — nunca un mensaje de texto. Se envía una vez por trabajo, y punto: el trabajo se marca antes de que salga el correo, así que dos ejecuciones superpuestas nunca pueden pedir dos veces. El cliente necesita una dirección de correo y no debe haberse dado de baja. FieldQuo revisa cada hora, así que un retraso de 4 horas significa unas 4 horas, no la mañana siguiente." },
          { p: "La nota al pie de la pantalla dice el resto: «Se omite a los clientes que se han dado de baja, y cualquiera que responda diciendo que algo salió mal te contacta directamente en lugar de la página de reseñas.»" },
        ],
      },
      {
        id: "on-the-screen",
        heading: "Qué hay en la pantalla",
        blocks: [
          { bullets: [
            "**Tu enlace de reseñas** con **Guardar** — «Normalmente tu enlace de reseñas de Google. En tu Perfil de Empresa de Google, elige “Solicitar reseñas” y copia el enlace corto.» Una vez guardado: **Ábrelo y comprueba que lleva a donde esperas**.",
            "**Pedir automáticamente** — el interruptor. Sin enlace está desactivado y dice «Primero agrega tu enlace de reseñas arriba.»; con uno dice «Cada cliente con una dirección de correo recibe un mensaje después de que su trabajo se marca como completado. Nunca más de uno.»",
            "**Cuándo preguntar** — **2 horas después**, **4 horas después**, **Al día siguiente**, **Dos días después**, **Tres días después**, **Una semana después**. Se muestra cuando el interruptor está activado.",
            "La frase de la cola — por ejemplo «3 clientes están en la cola, y 12 han sido contactados en los últimos 30 días.»",
            "**Reseñas en tu sitio web** — «Las que actives aparecen en tu sitio web: las seis primeras, en el orden de abajo.» Cada reseña con **Mostrar en el sitio web**, **Editar**, **Eliminar**, **Subir** / **Bajar**; luego **Añadir una reseña**, **Pegar una lista** con **Elegir un archivo CSV** e **Importar**, y **Tus reseñas en tu propio sitio web** con el fragmento.",
          ] },
        ],
      },
      {
        id: "switch-it-on",
        heading: "Cómo activarlo",
        blocks: [
          { steps: [
            "Pegue su enlace bajo **Tu enlace de reseñas** y pulse **Guardar**. Cualquier página http o https funciona — Google, Facebook, HomeStars, su propio formulario. Pulse **Ábrelo y comprueba que lleva a donde esperas**.",
            "Active **Pedir automáticamente**. El servidor lo rechaza sin enlace, igual que la pantalla.",
            "Elija un retraso bajo **Cuándo preguntar**. La frase de la cola debajo se actualiza con las mismas columnas que lee la tarea horaria.",
          ] },
          { figure: "live:app-settings-reviews", caption: "Configuración → Reseñas — Tu enlace de reseñas con Guardar, el interruptor Pedir automáticamente, las fichas de Cuándo preguntar, y Reseñas en tu sitio web debajo." },
        ],
      },
      {
        id: "what-each-control-changes",
        heading: "Qué cambia cada control",
        blocks: [
          { bullets: [
            "**Tu enlace de reseñas** — adónde envía al cliente el botón del correo, y el botón **Deja una reseña** de su página de enlace para la bio. Guarde un campo vacío y el interruptor se apaga solo, porque no habría adónde enviar a nadie.",
            "**Pedir automáticamente** — si a los trabajos completados se les pide o no. Apagado, no se envía nada y la cola no se muestra.",
            "**Cuándo preguntar** — el retraso después de la hora de finalización. A un trabajo terminado hace más de 30 días nunca se le pide, y los trabajos importados de su antiguo sistema se omiten, así que activar esto hoy no le envía un correo a cada cliente que haya tenido.",
            "**Mostrar en el sitio web** — pone esa reseña en su sitio web de FieldQuo y en el fragmento; las seis primeras reseñas activadas, en el orden que usted fije. Las reseñas importadas empiezan apagadas.",
            "El fragmento para insertar — «Muestra las reseñas que has aprobado, con tus propios colores y sin ninguna marca de FieldQuo. Mientras no tengas ninguna, no muestra nada y se reduce a cero de alto.»",
          ] },
        ],
      },
      {
        id: "who-can-see-it",
        heading: "Quién puede verlo",
        blocks: [
          { p: "El propietario, los administradores y cualquiera en el nivel Despachador o Encargado pueden abrir y cambiar esta pantalla; los accesos de Cuadrilla y Estimador no ven la fila. El correo en sí y las reglas detrás están en [[ask-for-reviews-automatically|Pedir reseñas automáticamente]]; la mitad de los testimonios está en [[testimonials-on-your-website|Testimonios en su sitio web]]." },
        ],
      },
    ],
    faq: [
      { q: "¿También le envía un mensaje de texto al cliente?", a: "No. La solicitud de reseña es solo un correo." },
      { q: "¿Puedo pedírsela a un cliente a mano?", a: "No desde esta pantalla — es automático y una vez por trabajo. Envíele usted mismo su enlace de reseñas." },
      { q: "¿Necesito un sitio web de FieldQuo para los testimonios?", a: "No. Actívelos aquí y pegue el fragmento de Tus reseñas en tu propio sitio web en cualquier sitio que administre; no lleva ninguna marca de FieldQuo." },
    ],
  },

  "settings-data-migration": {
    title: "Migración de datos",
    summary:
      "La fila de Configuración para el servicio de migración de pago de FieldQuo — solicítelo, agende una llamada, acepte o rechace el precio, pague a través de la facturación de FieldQuo, suba sus exportaciones y vea aparecer los clientes y presupuestos que el personal crea.",
    updated: "2026-09-12",
    intro: [
      "**Configuración → Cuenta → Migración de datos** — «Trae tus clientes y presupuestos antiguos a FieldQuo — desde QuickBooks, Jobber, una hoja de cálculo o una caja de zapatos.» Es un servicio hecho por el propio personal de FieldQuo, no un importador de autoservicio, y es el único caso en que FieldQuo escribe dentro de su cuenta.",
      "Las reglas son estrictas: el personal solo puede crear registros nuevos, nunca cambiar ni eliminar nada que ya exista; solo después de que usted haya aceptado un precio y lo haya pagado; y cada registro que crea queda registrado donde usted puede verlo. Para la historia completa vea [[the-data-migration-service|El servicio de migración de datos]].",
    ],
    sections: [
      {
        id: "overview",
        heading: "Resumen",
        blocks: [
          { p: "Hay una sola solicitud activa a la vez. Hasta que tenga una, la pantalla es el formulario **Solicitar una migración**; una vez que la tiene, es la tarjeta de esa solicitud con su insignia de estado y las acciones que el estado permite. El pago va por la facturación de FieldQuo — la misma tarjeta que su suscripción — nunca por su propia cuenta de Stripe, que es para que sus clientes le paguen a usted." },
        ],
      },
      {
        id: "on-the-screen",
        heading: "Qué hay en la pantalla",
        blocks: [
          { bullets: [
            "**Solicitar una migración** — «Cuéntanos qué vas a traer y agendamos una llamada para definir el alcance y el precio.» **¿Dónde están tus datos ahora?**, **Cualquier otra cosa que convenga saber**, y el botón **Solicitar una migración**.",
            "La tarjeta de la solicitud, con uno de nueve estados: **Solicitada**, **Llamada agendada**, **Presupuesto listo**, **Aceptado — pago pendiente**, **Pagada**, **En curso**, **Terminada**, **Rechazado**, **Cancelada**.",
            "**Agenda una llamada con FieldQuo** — horarios libres para elegir, o «Ahora mismo no hay horarios libres — te contactaremos para agendar uno.»",
            "**Aceptar** / **Rechazar** sobre el precio, luego **Pagar y empezar la migración** — «Te llevaremos a Stripe para completar el pago de forma segura.»",
            "**Lo que ya se trajo** — cada registro que FieldQuo creó, con su fecha.",
            "**Documentos** — «Sube una exportación de QuickBooks o Jobber, una hoja de cálculo, o un ZIP con tus registros antiguos.» **Subir un archivo** acepta CSV, XLS, XLSX, TXT, TSV, PDF, ZIP y los formatos de QuickBooks, hasta 25 MB cada uno.",
            "**Solicitudes anteriores** — migraciones anteriores, con su estado.",
          ] },
        ],
      },
      {
        id: "how-it-goes",
        heading: "Cómo transcurre una migración",
        blocks: [
          { steps: [
            "Complete **Solicitar una migración**. El estado dice **Solicitada**.",
            "Agende una llamada entre los horarios libres, o espere a que FieldQuo agende una. La tarjeta entonces dice **Llamada agendada** con la hora.",
            "FieldQuo cotiza el trabajo. El estado pasa a **Presupuesto listo** y la tarjeta muestra el precio con **Aceptar** y **Rechazar**.",
            "Pulse **Aceptar** — «Presupuesto aceptado — paga cuando quieras empezar.» — y luego **Pagar y empezar la migración**. Después de Stripe, el estado es **Pagada**.",
            "El personal crea los registros; el estado es **En curso** y cada uno aparece bajo **Lo que ya se trajo** a medida que se agrega. **Terminada** lo cierra: «Migración terminada.»",
          ] },
          { figure: "live:app-settings-migration", caption: "Configuración → Migración de datos — la tarjeta de la solicitud con su insignia de estado, el precio con Aceptar y Rechazar, y Documentos con Subir un archivo debajo." },
          { note: "**Cancelar esta solicitud** se muestra mientras el estado es Solicitada, Llamada agendada, Presupuesto listo o Aceptado. Después del pago, cancelar es una conversación con soporte y no un botón. Los documentos se pueden subir en cada etapa salvo Rechazado y Cancelada." },
        ],
      },
      {
        id: "what-fieldquo-writes",
        heading: "Qué escribe FieldQuo, y qué nunca toca",
        blocks: [
          { bullets: [
            "**Crea** registros de clientes y registros de presupuestos. Esos son los dos tipos de registro que el servicio escribe hoy; un presupuesto migrado es un borrador, marcado como histórico, y no se envía nada a nadie.",
            "**Nunca** actualiza ni elimina un cliente, presupuesto, factura o trabajo que existiera antes. El código no tiene ninguna ruta que pueda hacerlo.",
            "Escribe **solo** mientras la solicitud está Pagada o En curso, comprobado de nuevo en cada escritura. Cancele la migración y la escritura se detiene en ese instante.",
            "Cada escritura se registra con quién, cuándo y qué se creó, y ese registro es **Lo que ya se trajo**.",
          ] },
        ],
      },
      {
        id: "who-can-see-it",
        heading: "Quién puede verlo",
        blocks: [
          { p: "Solo propietarios y administradores — las mismas personas que ven la facturación de la empresa, porque el precio y el botón de pago son asunto del propietario. A todos los demás se les rechaza en el servidor, se haya dibujado la fila o no. El precio y el recibo se explican en [[paying-for-the-migration-service|Pagar el servicio de migración]]." },
        ],
      },
    ],
    faq: [
      { q: "¿Cuánto cuesta?", a: "No hay precio de lista. FieldQuo cotiza cada migración después de la llamada, y usted acepta o rechaza la cifra en esta pantalla." },
      { q: "¿Puede FieldQuo arreglar uno de mis presupuestos existentes ya que está ahí?", a: "No. El personal solo puede crear registros nuevos. Todo lo que existía antes de la migración queda fuera de su alcance por diseño." },
      { q: "¿Es lo mismo que una sesión de soporte mirando mi cuenta?", a: "No. Una sesión de soporte es de solo lectura, sin excepción. La migración es la única puerta para escrituras, y solo usted puede abrirla pagando." },
    ],
  },

  "settings-product-updates": {
    title: "Novedades del producto",
    summary:
      "La fila de Configuración que lista lo que cambió en FieldQuo — un registro de cambios con fecha, un resumen por entrada y, cuando existe, un artículo completo — sin nada que configurar y visible para todos los miembros.",
    updated: "2026-09-12",
    intro: [
      "**Configuración → Cuenta → Novedades del producto** — «Novedades en FieldQuo.» Es un registro de cambios con fecha, de más reciente a más antiguo, escrito por FieldQuo e idéntico para todas las empresas. Nada en él es un ajuste; es donde ve lo que cambió desde la última vez que miró.",
    ],
    sections: [
      {
        id: "overview",
        heading: "Resumen",
        blocks: [
          { p: "Cada entrada es una tarjeta con la fecha, un título y un resumen corto que se sostiene solo. Cuando existe un artículo más largo, la tarjeta lleva **Leer la novedad completa**; la página completa se abre en su lugar con **Volver a Novedades del producto** arriba. Una entrada sin artículo no muestra ningún enlace, en lugar de uno que no lleva a ninguna parte." },
          { p: "Las entradas están escritas en inglés sea cual sea el idioma en que lea la aplicación. Las palabras propias de la página — el título, **Leer la novedad completa**, **Volver a Novedades del producto** — siguen su idioma; el registro de cambios en sí no, porque un registro a medio traducir es peor que uno honesto en inglés." },
        ],
      },
      {
        id: "on-the-screen",
        heading: "Qué hay en la pantalla",
        blocks: [
          { bullets: [
            "El título **Novedades del producto** y la línea «Novedades en FieldQuo.»",
            "Una tarjeta por novedad: la fecha, formateada para su idioma; el título; el resumen; y **Leer la novedad completa** cuando existe un artículo completo.",
            "El artículo completo: la misma fecha y título, los párrafos, y **Volver a Novedades del producto**.",
          ] },
          { figure: "live:app-settings-product-updates", caption: "Configuración → Novedades del producto — las tarjetas con fecha, cada una con su resumen y Leer la novedad completa cuando existe un artículo." },
        ],
      },
      {
        id: "who-can-see-it",
        heading: "Quién puede verlo",
        blocks: [
          { p: "Todos en la empresa, incluida la cuadrilla. Es una de las tres filas de Configuración que un acceso de Cuadrilla conserva — junto con **Idioma** y **Tu horario** — porque nada en ella es propio de la empresa y no hay nada que rechazar. No hay ninguna API detrás y nada que guardar." },
          { tip: "FieldQuo no le envía correo ni notificación cuando se agrega una entrada. Si quiere saber qué cambió, esta fila es el lugar donde mirar." },
        ],
      },
    ],
    faq: [
      { q: "¿Puedo desactivar las novedades, o suscribirme a ellas?", a: "Ninguna de las dos. No hay notificación ni ajuste — la página simplemente lista lo que se lanzó." },
      { q: "¿Por qué una entrada no está en mi idioma?", a: "El registro de cambios es solo en inglés a propósito. La interfaz de la página sigue su idioma; las entradas no." },
    ],
  },

  "settings-account-and-billing": {
    title: "Cuenta y facturación",
    summary:
      "La fila de Configuración que es la misma página que Plan en la barra lateral principal: su plan, su precio y la próxima fecha de facturación, el portal de facturación, un atajo a sus cobros de Stripe, Cancelar plan, y los cuatro planes para elegir.",
    updated: "2026-09-12",
    intro: [
      "**Configuración → Cuenta → Cuenta y facturación** — «Tu plan, asientos y datos de pago.» Es la misma pantalla que abre la fila **Plan** de la barra lateral principal, a la que se llega desde el menú de Configuración. Este artículo es un mapa breve de ella; la historia completa de planes, asientos, cambios y cancelación está en [[your-plan-and-seats|Su plan y sus asientos]].",
    ],
    sections: [
      {
        id: "on-the-screen",
        heading: "Qué hay en la pantalla",
        blocks: [
          { bullets: [
            "La tarjeta del plan: el nombre y el estado del plan, el precio con **/mes** o **/año** y **Compromiso de 1 año** cuando corresponde, la línea de asientos (por ejemplo «6 puestos · 11 miembros de cuadrilla incluidos gratis»), **Días restantes de prueba** durante una prueba, y **Próxima fecha de facturación**.",
            "Un cambio programado, si reservó uno — «Cambio a … el …» — con **Mantener mi plan actual** para deshacerlo antes de que ocurra.",
            "**Verificar con Stripe** — vuelve a leer su suscripción desde Stripe cuando la página todavía no muestra un pago que hizo.",
            "**Gestionar facturación y método de pago** — abre el portal de facturación de Stripe para su tarjeta, sus facturas y recibos.",
            "**Ver lo que me pagaron mis clientes** — un atajo a **Configuración → Pagos**, la cuenta conectada en la que le pagan sus clientes. Una cuenta de Stripe distinta de la suscripción de arriba.",
            "**Cancelar plan** — el flujo de cancelación.",
            "**Planes** — un selector **Mensual** / **Compromiso de 1 año** y una tarjeta por plan con sus asientos y accesos de cuadrilla, **FieldQuo AI incluido**, y **Elegir plan**, **Cambiar a anual** o **Plan actual**.",
          ] },
          { figure: "live:app-settings-account-billing", caption: "Configuración → Cuenta y facturación — la tarjeta del plan con estado, precio, asientos y próxima fecha de facturación, los botones de facturación, y los planes debajo." },
        ],
      },
      {
        id: "what-each-button-does",
        heading: "Qué hace cada botón",
        blocks: [
          { p: "**Elegir plan** en un plan más barato o con otra cadencia programa el cambio para el final de su periodo de facturación actual y no cobra nada hasta entonces — «Listo — tu plan cambia el {date}. No se cobra nada hasta entonces.» En un plan más caro surte efecto de inmediato, y se cobra la diferencia por el resto del periodo. En cualquier caso, una confirmación nombra el plan, la cadencia y la fecha antes de que ocurra nada. Vea [[change-your-plan|Cambiar de plan]], [[update-your-payment-method|Actualizar su método de pago]] y [[cancel-your-subscription|Cancelar su suscripción]]." },
        ],
      },
      {
        id: "who-can-see-it",
        heading: "Quién puede verlo",
        blocks: [
          { p: "Solo propietarios y administradores. Lo que la empresa le paga a FieldQuo es asunto del propietario, así que la fila se oculta — no se muestra de solo lectura — a todos los demás, y cada control que contiene se rechaza en el servidor para cualquier otro de todos modos." },
        ],
      },
    ],
    faq: [
      { q: "Pagué pero la página todavía dice prueba.", a: "Pulse Verificar con Stripe. La página vuelve a leer la suscripción y dice si Stripe todavía no tiene nada nuevo." },
      { q: "¿Dónde están mis recibos?", a: "Gestionar facturación y método de pago abre el portal de Stripe, que lista cada factura y recibo de su suscripción. Vea [[invoices-and-receipts-from-fieldquo|Facturas y recibos de FieldQuo]]." },
    ],
  },

  "settings-refer-and-earn": {
    title: "Recomienda y gana",
    summary:
      "La fila de Configuración que es la misma página que Recomienda y gana en la barra lateral principal: su enlace de referido, compartir por WhatsApp y por SMS, una invitación por correo o por SMS, los meses que ganó y los negocios que refirió.",
    updated: "2026-09-12",
    intro: [
      "**Configuración → Cuenta → Recomienda y gana** es la misma página que la fila **Recomienda y gana** de la barra lateral principal — «Recomienda a otro negocio y consigue otro mes de FieldQuo gratis, en cuanto sea cliente de pago.» Un mes gratis para el negocio que usted refiere, al registrarse; un mes gratis para usted, cuando hace su primer pago real. Esta es la versión corta; el artículo completo es [[refer-another-business|Recomendar otro negocio, ganar un mes gratis]].",
    ],
    sections: [
      {
        id: "on-the-screen",
        heading: "Qué hay en la pantalla",
        blocks: [
          { bullets: [
            "**Tu enlace** con **Copiar** — «Lo bastante corto para decirlo en voz alta. Ponlo en una tarjeta de presentación, al pie de una factura o en una camioneta.»",
            "**Compartir la invitación** — un botón de WhatsApp, y **Enviar por SMS** en un teléfono, cada uno abre su propia app con el mensaje listo.",
            "**Enviar una invitación** — **Correo** o **SMS**, luego **Su correo** o **Su número de móvil**, **Su nombre**, y **Enviar invitación**. «Enviamos un solo mensaje y no hacemos seguimiento. Hasta 20 invitaciones al día.»",
            "Los meses ganados — «1 mes gratis ganado» — y «Se añade automáticamente a tu cuenta cuando un negocio que referiste realiza su primer pago.»",
            "**Negocios que has referido**, cada uno marcado **Acreditado** o **Registrado: aún no paga**, e **Invitaciones enviadas** con **Registrado** o **Fallido** en cada una.",
          ] },
          { figure: "live:app-settings-refer", caption: "Configuración → Recomienda y gana — Tu enlace con Copiar, los botones de compartir, Enviar una invitación, y los negocios referidos debajo." },
        ],
      },
      {
        id: "how-the-month-works",
        heading: "Cómo funciona el mes",
        blocks: [
          { table: {
            head: ["Quién", "Qué recibe", "Cuándo"],
            rows: [
              ["El negocio que usted refirió", "Un mes extra de prueba gratis", "Al registrarse a través de su enlace o invitación"],
              ["Usted", "Un mes gratis", "Cuando ese negocio hace su primer pago real"],
            ],
          } },
          { p: "Su mes es un mes del producto: en una prueba, extiende el final de la prueba; en un plan de pago, mueve el próximo cobro un mes más adelante. Un segundo referido agrega un segundo mes. Cómo aterriza en su suscripción está en [[referral-months|Meses por referidos]]." },
        ],
      },
      {
        id: "who-can-see-it",
        heading: "Quién puede verlo",
        blocks: [
          { p: "Solo propietarios y administradores. La página lista qué empresas fueron referidas y qué se ganó, y enviar una invitación es solo para propietarios y administradores en el servidor, así que la fila se oculta a todos los demás en vez de mostrarse de solo lectura." },
        ],
      },
    ],
    faq: [
      { q: "Se registraron pero todavía no tengo mi mes.", a: "Su insignia dice Registrado: aún no paga. Su mes llega con su primer pago real; una factura de prueba de $0 no gana nada." },
      { q: "¿Hay un tope?", a: "20 invitaciones al día desde esta pantalla." },
    ],
  },
};
