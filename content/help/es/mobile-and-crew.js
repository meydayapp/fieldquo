// content/help/es/mobile-and-crew.js
//
// Artículos de la categoría « mobile-and-crew » en español. Misma estructura
// que el inglés, artículo por artículo: mismos slugs, mismas secciones en el
// mismo orden, mismos bloques, mismas figuras — scripts/check-help-centre.mjs
// compara ambos. Las palabras en pantalla vienen del bloque `es` de
// app/i18n/appMessages.js; las etiquetas que el producto solo muestra en
// inglés (la cuadrícula de acceso, las etapas de las fotos, el botón Withdraw)
// se quedan en inglés, con una glosa. No hay aplicación nativa ni modo sin
// conexión, y los artículos lo dicen en lugar de dejarlo entender.
export const ARTICLES = {
  "using-fieldquo-on-your-phone": {
    title: "Usar FieldQuo en su teléfono",
    summary:
      "FieldQuo corre en el navegador de su teléfono — no hay aplicación que descargar. Cómo se ve el diseño para teléfono, cómo iniciar sesión y qué funciona desde la entrada de una casa.",
    updated: "2026-09-12",
    intro: [
      "No hay una aplicación de FieldQuo en la App Store ni en Google Play. La oficina que usa en un escritorio es la misma que abre en un teléfono: por debajo de unos 1,024 píxeles de ancho las páginas se reorganizan, aparece una barra de pestañas en la parte inferior, y todo lo que un miembro de la cuadrilla hace en el día — registrar la entrada, revisar el horario, archivar una foto, chatear con la oficina — está hecho para funcionar con un solo pulgar.",
      "Este artículo es el recorrido: cómo se ve el diseño para teléfono, cómo iniciar sesión y qué pantallas vale la pena guardar en favoritos. Los artículos que siguen van pantalla por pantalla.",
    ],
    sections: [
      {
        id: "overview",
        heading: "Resumen",
        blocks: [
          { p: "En un teléfono, la barra lateral que conoce de la computadora se pliega. Lo que la reemplaza es una barra fija arriba — el logotipo de FieldQuo, que lo lleva a **Inicio**, un botón de menú y la campana de notificaciones con su contador de no leídas — y una barra de pestañas abajo con las pantallas que más usa. Todo lo demás está a un toque detrás de **Más**." },
          { p: "Cada toque va al servidor. Ese es todo el diseño: nada se guarda en el teléfono, así que un teléfono compartido en la camioneta no le muestra nada a la siguiente persona que lo toma, y la oficina ve su marcación o su foto en el momento en que llega. La otra cara es que un toque sin señal no pasa — vea [[bad-connections-and-offline|Malas conexiones, y por qué no hay modo sin conexión]]." },
          { note: "El diseño para teléfono es el mismo producto con los mismos permisos. Una pantalla que su nivel de acceso oculta en una computadora también está oculta en un teléfono, y una dirección que escriba a mano la rechaza el servidor, no solo el menú." },
        ],
      },
      {
        id: "what-is-on-the-screen",
        heading: "Qué hay en la pantalla",
        blocks: [
          { p: "De arriba abajo, en cualquier página:" },
          { bullets: [
            "**La barra superior** — el botón de menú a la izquierda abre el menú completo como un cajón; el logotipo de FieldQuo en el centro va al panel; la campana a la derecha muestra cuántas notificaciones no ha leído.",
            "**La página misma** — las mismas tarjetas que en una computadora, apiladas en una columna. Los botones tienen tamaño para un pulgar, y el selector de trabajo del reloj de tiempo es el selector propio de su teléfono, no un menú a medida.",
            "**La barra de pestañas** — hasta cinco pestañas más **Más**. Qué pestañas recibe depende de su nivel de acceso; un miembro de la cuadrilla ve **Trabajos**, **Chat** y **Más**. Vea [[the-crew-tab-bar|La barra de pestañas de la cuadrilla]].",
            "**La zona segura** — en un iPhone la barra queda por encima del indicador de inicio y no debajo, así que la pestaña inferior nunca queda medio tapada.",
          ] },
          { figure: "harness:mobile-job", caption: "Un trabajo en un teléfono — la visita con sus botones Voy en camino y Marcar como completada, la lista de verificación debajo, y la barra de pestañas Trabajos · Chat · Más." },
        ],
      },
      {
        id: "sign-in",
        heading: "Cómo iniciar sesión en su teléfono",
        blocks: [
          { steps: [
            "Abra el correo de invitación en su teléfono y acéptelo — así es como se entra a una empresa; no hay manera de agregarse uno mismo. En el nivel Crew, su cuenta no le cuesta nada a la empresa.",
            "Elija su contraseña. A partir de ahí, la página de inicio de sesión pide **Correo electrónico** y **Contraseña**, y el botón es **Iniciar sesión**.",
            "Llega a **Inicio**. Toque el botón de menú, o una pestaña, para ir adonde necesita.",
            "Opcional pero recomendable: agregue FieldQuo a su pantalla de inicio para que se abra como una aplicación — [[install-it-like-an-app|Instalarlo como una aplicación]].",
          ] },
          { tip: "Manténgase con la sesión iniciada. FieldQuo no cierra su sesión entre visitas, así que el ícono de la pantalla de inicio se abre directo en su día; si alguna vez la sesión está cerrada, el ícono abre la página de inicio de sesión." },
        ],
      },
      {
        id: "what-works-on-a-phone",
        heading: "Qué funciona desde un teléfono",
        blocks: [
          { table: {
            head: ["Lo que necesita hacer", "Dónde", "Notas"],
            rows: [
              ["Registrar entrada y salida, cambiar de trabajo", "**Reloj de tiempo**", "A su teléfono se le pregunta dónde está una vez, al tocar — nunca en segundo plano."],
              ["Ver sus turnos y visitas", "**Asignar turnos**, **Calendario**, **Trabajos**", "Solo lo publicado, y solo aquello en lo que usted está."],
              ["Agregar fotos a un trabajo", "La página del trabajo, **Fotos del trabajo**", "Desde la cámara o el carrete; o envíelas por mensaje de texto sin abrir nada."],
              ["Hablar con la oficina", "**Chat**", "Una sala por trabajo, #general para todos, mensajes directos."],
              ["Pedir tiempo libre", "**Ausencias**", "Los saldos y sus solicitudes en una sola pantalla."],
              ["Reportar un incidente o un casi accidente", "**Seguridad**", "Un formulario corto; agregue una foto después."],
              ["Leer sus recibos de nómina", "**Nómina**", "Solo los suyos."],
            ],
          } },
        ],
      },
      {
        id: "who-can-see-it",
        heading: "Quién puede usarlo",
        blocks: [
          { p: "Cualquiera con una cuenta. Lo que muestra el menú lo decide el nivel de acceso que le dio el propietario — Crew, Estimator, Dispatcher, Manager o una cuadrícula personalizada — y el diseño para teléfono no cambia nada de eso. El resto de esta categoría está escrito para el nivel Crew, que es el de la mayoría de la gente en una camioneta; vea [[what-a-crew-member-sees|Qué ve un miembro de la cuadrilla]]." },
        ],
      },
    ],
    faq: [
      { q: "¿Hay una aplicación en la App Store?", a: "No. FieldQuo corre en el navegador del teléfono. Puede agregarlo a su pantalla de inicio para que se abra a pantalla completa con su propio ícono, que hoy es lo más cercano a una aplicación." },
      { q: "¿Funciona en un iPad o una tableta pequeña?", a: "Sí. Por debajo de unos 1,024 píxeles de ancho obtiene el diseño para teléfono con la barra de pestañas; por encima, la barra lateral, exactamente como en una computadora." },
      { q: "¿La oficina ve dónde está mi teléfono?", a: "Solo dónde estaba en el momento en que tocó Registrar entrada, Registrar salida, Voy en camino o Marcar como completada — y solo si lo permitió cuando el teléfono lo preguntó. Nada corre entre un toque y otro." },
    ],
  },

  "install-it-like-an-app": {
    title: "Instalarlo como una aplicación",
    summary:
      "Agregue FieldQuo a la pantalla de inicio de su teléfono para que se abra a pantalla completa con su propio ícono — y, en un iPhone, para que las notificaciones puedan llegarle siquiera.",
    updated: "2026-09-12",
    intro: [
      "FieldQuo es una aplicación web, y tanto el iPhone como Android pueden fijar una aplicación web en la pantalla de inicio. Una vez hecho, se abre sin la barra de direcciones del navegador, en vertical, directo en su panel, con el ícono de FieldQuo junto a sus otras aplicaciones. No se descarga nada de una tienda y no hay nada que actualizar — siempre tiene la versión actual.",
    ],
    sections: [
      {
        id: "overview",
        heading: "Resumen",
        blocks: [
          { p: "El teléfono lee una pequeña descripción que FieldQuo publica sobre sí mismo: el nombre **FieldQuo**, el ícono, el hecho de que debe abrirse en la oficina, y que debe correr a pantalla completa y en vertical. Eso es lo que hace que el navegador ofrezca una opción de instalación." },
          { p: "Instalar cambia cómo se abre FieldQuo, no lo que puede hacer. Son las mismas páginas hablando con el mismo servidor; cada toque sigue necesitando conexión." },
          { warning: "En un iPhone o iPad, agregue FieldQuo a la pantalla de inicio antes de intentar activar las notificaciones. Safari solo entrega notificaciones a las aplicaciones web instaladas — el interruptor de la página de Notificaciones lo dice tal cual." },
        ],
      },
      {
        id: "iphone",
        heading: "En un iPhone o iPad",
        blocks: [
          { steps: [
            "Abra FieldQuo en Safari e inicie sesión.",
            "Toque el botón Compartir (el cuadrado con una flecha).",
            "Elija la opción Agregar a pantalla de inicio de Safari y confirme el nombre.",
            "De ahora en adelante abra FieldQuo desde el nuevo ícono. Se abre a pantalla completa, en su panel.",
          ] },
        ],
      },
      {
        id: "android",
        heading: "En un teléfono Android",
        blocks: [
          { steps: [
            "Abra FieldQuo en Chrome e inicie sesión.",
            "Abra el menú de Chrome y elija su opción de instalar o agregar a la pantalla de inicio; algunos teléfonos también la ofrecen como un aviso.",
            "Confirme. El ícono aparece en la pantalla de inicio y en el cajón de aplicaciones.",
          ] },
        ],
      },
      {
        id: "what-changes",
        heading: "Qué cambia una vez instalado",
        blocks: [
          { bullets: [
            "**Se abre en la oficina.** El ícono va a su panel, no al sitio de marketing. Si la sesión está cerrada, abre la página de inicio de sesión — lo mismo que hace cualquier aplicación.",
            "**Sin barra de direcciones.** La página tiene toda la pantalla. Los enlaces se siguen abriendo dentro.",
            "**Las notificaciones se vuelven posibles en un iPhone.** Con el ícono instalado y el interruptor activado, FieldQuo puede avisarle — vea [[push-notifications|Notificaciones push]].",
            "**Nada más.** Sin modo sin conexión, sin ubicación en segundo plano, sin carga más rápida. Esas no son cosas que instalar le dé a una aplicación web.",
          ] },
          { note: "No se le ofrecerá una opción de instalación en el sitio web de un contratista ni en una página de presupuesto o de reserva. Esas páginas llevan la marca del contratista, y FieldQuo deliberadamente no publica ahí ninguna descripción de instalación — un propietario de vivienda nunca debe terminar con un ícono de FieldQuo después de visitar el sitio de un pintor." },
        ],
      },
    ],
    faq: [
      { q: "¿Tengo que instalarlo?", a: "No. Todo funciona en la pestaña del navegador. Instalarlo es una comodidad — y, en un iPhone, la única manera de recibir notificaciones." },
      { q: "¿Cómo lo actualizo?", a: "No hace falta. Cada vez que lo abre, carga la versión actual desde el servidor." },
      { q: "¿Puedo instalarlo en dos teléfonos?", a: "Sí. Inicie sesión en cada uno; no hay límite, y cada teléfono decide su propio interruptor de notificaciones." },
    ],
  },

  "the-crew-tab-bar": {
    title: "La barra de pestañas de la cuadrilla",
    summary:
      "La barra en la parte inferior del diseño para teléfono: qué pestañas contiene, por qué un miembro de la cuadrilla ve tres, y adónde fue todo lo demás.",
    updated: "2026-09-12",
    intro: [
      "En un teléfono, la barra en la parte inferior de la pantalla es cómo se mueve. Contiene las cuatro pantallas por las que fluye el trabajo — **Prospectos**, **Cotizaciones**, **Trabajos**, **Facturas** — más **Chat**, y un botón **Más** que abre el menú completo. Las pestañas que no puede usar no se dibujan, así que la barra que ve un miembro de la cuadrilla es más corta que la del propietario.",
    ],
    sections: [
      {
        id: "overview",
        heading: "Resumen",
        blocks: [
          { p: "La barra aparece siempre que la pantalla tiene menos de unos 1,024 píxeles de ancho — todos los teléfonos, la mayoría de las tabletas en vertical. La pestaña de la pantalla actual queda resaltada; las otras se muestran en un color apagado. Por encima de ese ancho la barra desaparece y la barra lateral toma su lugar." },
          { figure: "harness:mobile-chat", caption: "La sala de chat de un trabajo en un teléfono, con Chat resaltado en la barra de pestañas y Más a la derecha." },
        ],
      },
      {
        id: "the-tabs",
        heading: "Las pestañas, y cuándo aparece cada una",
        blocks: [
          { table: {
            head: ["Pestaña", "Abre", "Se muestra cuando"],
            rows: [
              ["**Prospectos**", "El tablero de prospectos", "Su acceso a solicitudes (Requests) es al menos View only"],
              ["**Cotizaciones**", "La lista de presupuestos", "Su acceso a presupuestos es al menos View only"],
              ["**Trabajos**", "La lista de trabajos", "Su acceso a trabajos es al menos View only"],
              ["**Facturas**", "La lista de facturas", "Su acceso a facturas es al menos View only"],
              ["**Chat**", "El chat de la empresa", "Siempre — mientras la función de chat de cuadrilla esté activada para su empresa"],
              ["**Más**", "El menú completo, como un cajón", "Siempre"],
            ],
          } },
          { p: "Las mismas reglas ocultan las mismas filas en el menú completo, y las páginas detrás rechazan al mismo nivel, así que la barra es un atajo, no la seguridad." },
        ],
      },
      {
        id: "what-a-crew-member-gets",
        heading: "Qué recibe un miembro de la cuadrilla",
        blocks: [
          { p: "El nivel Crew está en No access para prospectos, presupuestos y facturas, y en View only para trabajos — limitado a los trabajos en los que está reservado. Así que la barra se lee **Trabajos · Chat · Más**, y las tres se reparten el ancho por igual." },
          { bullets: [
            "**Trabajos** — los trabajos en los que tiene una visita, con la dirección, las visitas y la lista de verificación.",
            "**Chat** — #general, la sala de cada trabajo en el que está, y los mensajes directos. Es la única pestaña que todos los niveles conservan, porque el chat es la pantalla propia de la cuadrilla.",
            "**Más** — el reloj de tiempo, sus turnos, las ausencias, la seguridad, sus recibos de nómina, la configuración.",
          ] },
        ],
      },
      {
        id: "the-more-drawer",
        heading: "El cajón Más",
        blocks: [
          { p: "**Más** no abre un segundo menú. Abre el mismo cajón que abre el botón de menú de arriba — el menú completo, agrupado exactamente como en una computadora — para que haya una sola lista de pantallas, no dos que puedan contradecirse. **Inicio** no es una pestaña: el logotipo de FieldQuo en la barra superior ya lo lleva ahí." },
          { tip: "Si la barra no muestra nada más que Más, cada una de sus categorías de documentos está en No access. Es una cuadrícula válida, no una falla — todo lo que puede usar está en el cajón." },
        ],
      },
    ],
    faq: [
      { q: "¿Puedo elegir qué pestañas van en la barra?", a: "No. Las cinco son fijas — las cuatro pantallas de documentos y el chat — y su nivel de acceso decide cuáles se dibujan." },
      { q: "¿Por qué no hay una pestaña de Reloj de tiempo?", a: "La barra está reservada para las pantallas por las que se mueve el trabajo y para el chat. El reloj de tiempo está a un toque bajo Más, y es igual para todos sin importar el nivel." },
    ],
  },

  "what-a-crew-member-sees": {
    title: "Qué ve un miembro de la cuadrilla",
    summary:
      "El nivel de acceso Crew desde adentro: qué filas del menú aparecen, qué muestra y qué oculta la página de un trabajo, y por qué los precios no están en ninguna parte.",
    updated: "2026-09-12",
    intro: [
      "**Crew** es el nivel de acceso de la gente en la camioneta — instaladores, ayudantes, un segundo pintor. No le cuesta nada a la empresa y es deliberadamente estrecho: su propio horario, los trabajos en los que está reservado, el reloj, las ausencias, la seguridad, sus propios recibos de nómina. Ningún precio en ninguna parte, sin presupuestos, sin facturas, sin prospectos y sin lista de clientes.",
      "Este artículo es cómo se ve eso en el teléfono. Está escrito a partir de la propia cuadrícula de permisos del producto, así que dice lo que el menú realmente hace; si su propietario le dio una cuadrícula personalizada, algunas filas pueden diferir.",
    ],
    sections: [
      {
        id: "overview",
        heading: "Resumen",
        blocks: [
          { p: "El preajuste Crew fija un nivel por área: horario **View and complete their own schedule** (ver y completar su propio horario); registro de tiempo **View, record, and edit their own** (ver, registrar y editar el suyo); nómina **View their own payslips** (sus propios recibos); notas **View notes on jobs and visits only** (solo notas de trabajos y visitas); clientes **View client name and address only** (solo nombre y dirección del cliente); trabajos **View only** (limitado a los trabajos en los que está reservado); solicitudes, presupuestos y facturas **No access**; seguridad **Report incidents, and view their own** (reportar incidentes y ver los suyos); y los tres interruptores de dinero apagados." },
          { note: "Crew es fijo. Elíjalo y no hay cuadrícula que mover — subir cualquier control por encima del techo de Crew convierte a la persona en un asiento pagado. El propietario puede en cambio darle una cuadrícula Custom, que es un asiento." },
        ],
      },
      {
        id: "the-menu",
        heading: "Las filas del menú que recibe",
        blocks: [
          { table: {
            head: ["Fila", "Qué le muestra a un miembro de la cuadrilla"],
            rows: [
              ["**Inicio**", "Sus próximas visitas y la lista de citas. La tarjeta de presupuestos y la tarjeta de configuración inicial no se dibujan."],
              ["**Trabajos**", "Solo los trabajos en los que tiene una visita."],
              ["**Calendario**", "Citas asignadas a usted, citas sin asignar, y visitas en sus trabajos."],
              ["**Tareas**", "Tareas asignadas a usted, tareas que creó, y las sin asignar que cualquiera puede tomar."],
              ["**Chat**", "#general, una sala por trabajo en el que está, mensajes directos."],
              ["**Asignar turnos**", "Sus propios turnos publicados — el título es el del gerente; usted ve su semana, solo lectura."],
              ["**Reloj de tiempo**", "Su marcación, su trabajo, sus horas de hoy."],
              ["**Ausencias**", "Sus saldos y solicitudes."],
              ["**Seguridad**", "Reportar un incidente; ver los que usted presentó."],
              ["**Nómina**", "Sus propios recibos de nómina."],
            ],
          } },
          { p: "Debajo de los grupos: **Ayuda** y **Configuración**. La configuración conserva tres filas para usted — **Idioma**, **Disponibilidad** (sus propias horas reservables) y **Novedades del producto**. Si su empresa activó los mensajes de texto de la cuadrilla, también aparece una fila **Bandeja del equipo**, que muestra solo los mensajes que usted envió." },
        ],
      },
      {
        id: "on-a-job",
        heading: "En la página de un trabajo",
        blocks: [
          { bullets: [
            "El **nombre y la dirección** del cliente, y la dirección del sitio. El número de teléfono y el correo los retiene su nivel — la página del trabajo lo dice junto al botón Voy en camino, y el cliente igual recibe el mensaje de texto.",
            "**Visitas**: fecha y hora, quién está asignado, la lista de verificación con sus puntos de control, y — en las visitas asignadas a usted — **Voy en camino**, **Marcar como completada** y **Cancelar visita**.",
            "**Materiales por comprar**, como una lista con cantidades y sin precios.",
            "**Fotos del trabajo** con un botón para subir, y el **Parte diario** que puede escribir y guardar — vea [[photos-from-the-field|Fotos desde el campo]].",
            "Las notas de la visita misma. Las notas privadas sobre el cliente y el registro de llamadas del prospecto no se muestran.",
          ] },
        ],
      },
      {
        id: "what-is-hidden",
        heading: "Qué está oculto, y por qué",
        blocks: [
          { bullets: [
            "**Prospectos, Cotizaciones, Facturas, Planes de servicio, Mensajes** — No access significa que la fila desaparece y la página rechaza. Un miembro de la cuadrilla nunca lee un precio que se le cobró al cliente.",
            "**Clientes y Equipos del cliente** — la lista de clientes es el activo más portátil de la empresa. Usted recibe una dirección en su propio trabajo, no la libreta.",
            "**Equipo, Calendario del equipo, Hojas de tiempo, Gastos, Análisis, KPI, Marketing, Recepcionista, Plan, Recomienda y gana** — pantallas de gestión y de dinero; la ruta del servidor de cada una rechaza por debajo del nivel que muestra la fila.",
            "**Lo que ha costado este trabajo** y cada tarjeta de costeo — el interruptor de costeo de trabajos está apagado.",
            "**Editar sus propias horas** — el permiso existe, pero la única pantalla que edita entradas es Hojas de horas, que el nivel Crew no abre. Una salida olvidada la corrige su gerente.",
          ] },
        ],
      },
      {
        id: "who-decides",
        heading: "Quién decide",
        blocks: [
          { p: "El propietario o un administrador fija su nivel en **Gestionar equipo**; un Manager o un Dispatcher puede invitarlo en el nivel Crew pero no puede cambiar el acceso de una persona existente. Ocultar una fila es cosmético — la ruta del servidor de cada página vuelve a comprobar la misma cuadrícula, y por eso una pantalla que no se le mostró responde con un rechazo en lugar de con la página. El detalle completo: [[role-crew|El nivel Crew]] y [[access-levels-overview|Niveles de acceso: quién ve qué]]." },
          { tip: "Si necesita algo que no puede ver — el número de teléfono de un cliente, un precio para un proveedor — pídalo en lugar de buscarle la vuelta. El propietario puede pasarlo a una cuadrícula Custom con un solo menú desplegable." },
        ],
      },
    ],
    faq: [
      { q: "Veo un trabajo pero no el número de teléfono del cliente. ¿Es un error?", a: "No. El nivel Crew muestra solo el nombre y la dirección de un cliente. Cuando toca Voy en camino, el cliente igual recibe el mensaje de texto; el número está oculto para usted, no falta." },
      { q: "¿Por qué un trabajo en el que trabajé el mes pasado desapareció de mi lista?", a: "La lista muestra los trabajos en los que tiene una visita. Si la visita se movió a otra persona, el trabajo sale de su lista. Su sala de chat se queda bajo Trabajos terminados si el trabajo está terminado." },
      { q: "¿Puedo registrar un gasto desde mi teléfono?", a: "Hoy no. El nivel Crew permite registrar sus propios gastos en la cuadrícula de permisos, pero las pantallas de gastos son pantallas de gestión que el nivel Crew no abre. Entregue los recibos en la oficina." },
    ],
  },

  "clock-in-and-out-on-your-phone": {
    title: "Registrar entrada y salida en su teléfono",
    summary:
      "El reloj de tiempo: un botón grande, el trabajo en el que caen las horas, cambiar de trabajo a mitad del día, y qué se le pregunta a su teléfono cuando toca.",
    updated: "2026-09-12",
    intro: [
      "**Reloj de tiempo** es la pantalla que un trabajador por hora toca en cada turno. Es deliberadamente austera: la hora, un botón, el trabajo en el que está y las horas de hoy. Cada toque escribe una entrada de tiempo simple en el servidor; la oficina la revisa en Hojas de horas, y solo entonces llega a una corrida de nómina.",
      "Lo único que hay que saber antes del primer toque: cuando presiona **Registrar entrada** o **Registrar salida**, a su teléfono se le pregunta dónde está — una sola vez, con la ventana de permiso propia del teléfono — y esa única posición se guarda junto a la marcación para que la hoja de horas pueda mostrar a qué distancia del sitio estaba. Nada corre en segundo plano y nada se rastrea entre un toque y otro.",
    ],
    sections: [
      {
        id: "overview",
        heading: "Resumen",
        blocks: [
          { p: "Solo puede estar en turno una vez: una entrada abierta por trabajador. Registrar la entrada la abre contra el trabajo que eligió (o ningún trabajo), registrar la salida la cierra y se calculan las horas. La entrada se guarda como pendiente y va a su gerente, que es lo que dice la nota al pie de la pantalla: **Tus horas se envían a tu gerente para revisar y aprobar.** Vea [[the-time-clock|El reloj de tiempo]] para el lado de la oficina y [[timesheets-and-approving-hours|Hojas de horas: revisar y aprobar horas]]." },
        ],
      },
      {
        id: "what-is-on-the-screen",
        heading: "Qué hay en la pantalla",
        blocks: [
          { bullets: [
            "**La carátula del reloj** — la fecha de hoy y la hora en vivo. En turno, agrega una etiqueta **En turno**, el tiempo transcurrido, **Desde** su hora de entrada, y **En** el nombre del trabajo (o **No está ligado a un trabajo**). Fuera de turno, se lee **Estás fuera de turno.**",
            "**¿Qué trabajo?** — un selector, mostrado solo mientras está fuera de turno y solo cuando su empresa tiene trabajos abiertos. **Sin trabajo — traslados, taller, presupuestar** va arriba; luego **Programados para ti hoy** y **Tus otros trabajos abiertos**.",
            "**La línea de ubicación** — mostrada solo mientras el teléfono todavía no ha respondido la pregunta de permiso, para que lea el porqué antes de que el teléfono pregunte.",
            "**Registrar entrada** (verde) o **Registrar salida** (rojo) — el único botón.",
            "**Hoy** — el total del día y cada entrada con sus horas y su trabajo, más la nota de que sus horas van a su gerente.",
          ] },
          { figure: "harness:mobile-clock", caption: "El reloj de tiempo en un teléfono — En turno desde las 7:28 en el trabajo de la cocina Dubois, la nota de ubicación, el botón Registrar salida, y ¿Te pasaste a otro trabajo? debajo." },
        ],
      },
      {
        id: "how-to",
        heading: "Cómo registrar entrada y salida",
        blocks: [
          { steps: [
            "Abra **Más → Reloj de tiempo** (o guárdelo en favoritos).",
            "Revise el trabajo bajo **¿Qué trabajo?** Si tiene exactamente una visita hoy, queda rellenado por usted y la pantalla lo dice; con varias, le pide elegir la que empieza; sin ninguna, lo dice y lo deja en blanco.",
            "Toque **Registrar entrada**. Si su teléfono pregunta si FieldQuo puede usar su ubicación, responda una vez; una negativa no cambia nada de la marcación.",
            "Trabaje. El tiempo transcurrido corre en la pantalla; también sigue contando en el servidor si cierra la pestaña o se agota la batería.",
            "Toque **Registrar salida**. La entrada pasa a **Hoy** con sus horas.",
          ] },
          { figure: "live:app-clock", caption: "La misma pantalla en una computadora — la carátula del reloj, la lista Hoy con cada entrada y su trabajo, y la nota de revisión." },
        ],
      },
      {
        id: "switch-job",
        heading: "¿Se pasó a otro trabajo?",
        blocks: [
          { p: "Quedarse en turno todo el día pone el turno completo en el primer trabajo. La tarjeta **¿Te pasaste a otro trabajo?** lo arregla: elija el nuevo trabajo y toque **Cambiar de trabajo**. La entrada actual se cierra en ese instante y se abre una nueva en el nuevo trabajo — las horas ya trabajadas conservan el trabajo en el que se hicieron y, como dice la tarjeta, empieza una entrada nueva desde ahora." },
          { note: "Cambiar de trabajo está desactivado mientras el selector muestra el trabajo en el que ya está. No hay deshacer: si cambió al trabajo equivocado, cambie otra vez — el minuto entre medio cae en el trabajo equivocado y su gerente puede corregirlo en Hojas de horas." },
        ],
      },
      {
        id: "location",
        heading: "Dónde estaba el teléfono, y qué ve la oficina",
        blocks: [
          { p: "La posición se guarda junto a la marcación con la distancia al sitio del trabajo, calculada una sola vez. En Hojas de horas cada marcación lleva una etiqueta: **Entrada · En el sitio** cuando el teléfono estaba a menos de **250 m** del sitio, **Entrada · a 2.1 km** en ámbar cuando estaba más lejos, y **—** cuando no se puede decir nada honesto — sin posición, un trabajo sin dirección de sitio, o una lectura tan imprecisa (un círculo de precisión de más de 250 m) que el teléfono pudo haber estado en cualquier parte." },
          { p: "Una etiqueta de distancia es una pregunta para su gerente, no un veredicto: la aprobación sigue siendo un botón que presiona una persona. Tampoco se confía en el reloj del teléfono — una marca cuya hora difiere más de 15 minutos de la del servidor se rechaza en lugar de guardarse." },
          { note: "FieldQuo no tiene manera de detectar que usted llegó. Un navegador solo puede leer la posición mientras su página está abierta y al frente, así que la pantalla pregunta al tocar en lugar de adivinar, y no guarda nada entre un toque y otro." },
        ],
      },
      {
        id: "who-can-see-it",
        heading: "Quién puede verlo",
        blocks: [
          { p: "Cualquiera cuya cuenta esté vinculada a una ficha de trabajador. Si la pantalla dice **Aún no estás configurado como trabajador. Pide a un administrador que te agregue en Equipo.**, un propietario o administrador necesita agregarlo en la pestaña **Trabajadores** de Gestionar equipo — la pestaña que solo ellos ven. El nivel Crew registra y ve su propio tiempo; revisar, editar y aprobar el de todos es el nivel Dispatcher y superiores." },
        ],
      },
    ],
    faq: [
      { q: "Olvidé registrar la salida ayer.", a: "La entrada sigue abierta en el servidor. Registre la salida ahora y avísele a su gerente — él corrige la hora en Hojas de horas, y la entrada vuelve a pendiente para revisión." },
      { q: "¿Puedo registrar la entrada desde casa y manejar hasta el sitio?", a: "Puede, y la marcación lo dirá: la etiqueta de la hoja de horas muestra a qué distancia del sitio estaba el teléfono cuando tocó. Elija Sin trabajo para el trayecto, o pregúntele a su empresa qué prefiere." },
      { q: "El teléfono nunca me pidió la ubicación.", a: "O ya respondió una vez (permitió o negó) y el teléfono lo recuerda, o el navegador no tiene ubicación en absoluto. En ambos casos la marcación pasa; solo se ve afectada la etiqueta en la hoja de horas." },
      { q: "¿Puedo corregir mis propias horas?", a: "Hoy no desde el teléfono. Su gerente corrige una entrada en Hojas de horas; una corrección devuelve la entrada a pendiente para que alguien la vuelva a revisar." },
    ],
  },

  "your-schedule-on-your-phone": {
    title: "Su horario en su teléfono",
    summary:
      "Dónde vive el día de un miembro de la cuadrilla: los turnos publicados bajo Asignar turnos, las citas en el Calendario, las visitas en el trabajo, y las tareas.",
    updated: "2026-09-12",
    intro: [
      "Su día está en tres lugares a propósito, porque son tres cosas distintas: un **turno** son las horas que su gerente publicó para usted, una **visita** es un bloque de trabajo reservado en un trabajo, y una **tarea** es un pendiente con su nombre. Los tres muestran solo lo suyo, y ninguno muestra un borrador que la oficina no haya publicado.",
    ],
    sections: [
      {
        id: "overview",
        heading: "Resumen",
        blocks: [
          { p: "El ajuste de horario del nivel Crew es **View and complete their own schedule** (ver y completar su propio horario): ve sus propias horas y puede marcar sus propias visitas como hechas, y no puede ver ni mover las de nadie más. El Calendario del equipo — la disponibilidad de todos en una página — es una pantalla de gestión y no está en su menú." },
        ],
      },
      {
        id: "where-to-look",
        heading: "Dónde mirar",
        blocks: [
          { table: {
            head: ["Fila", "Qué muestra", "Qué puede hacer"],
            rows: [
              ["**Asignar turnos**", "Sus turnos publicados, una semana a la vez, de domingo a sábado, con hoy enmarcado", "Leerlos. La línea al pie dice: Estos son los turnos que publicó tu gerente. Vuelve para ver cambios."],
              ["**Calendario**", "Citas asignadas a usted, citas sin asignar, y visitas en sus trabajos", "Abrir el trabajo; en su propia visita, Voy en camino y Marcar como completada."],
              ["**Trabajos**", "Los trabajos en los que tiene una visita, con la fecha y hora de cada visita", "Marcar la lista de verificación, agregar fotos, escribir el parte diario."],
              ["**Tareas**", "Tareas asignadas a usted, las que creó, y las sin asignar", "Tomar una tarea sin asignar; completar las suyas."],
            ],
          } },
        ],
      },
      {
        id: "shifts",
        heading: "Sus turnos",
        blocks: [
          { p: "Un gerente prepara la semana en la pantalla Programación y presiona **Publicar semana**; hasta entonces, un turno es un **Borrador** que la cuadrilla no puede ver. Una vez publicado, su turno muestra su inicio y su fin, el trabajo, y cualquier nota que el gerente haya escrito — dónde estar, qué llevar. Si un turno se colocó fuera de las horas en que dijo estar disponible, el turno mismo dice **Fuera de la disponibilidad declarada**, con quién lo hizo y por qué, para que se entere aquí y no esa mañana." },
          { figure: "harness:scheduler", caption: "La programación como la ve un gerente — la semana como tarjetas por día, Agregar turno y Publicar semana. Un miembro de la cuadrilla ve las mismas tarjetas con solo sus propios turnos publicados, y sin botones." },
          { note: "La fila de la pantalla se titula **Asignar turnos** para todos porque el título es el del gerente. Usted no asigna nada; lee lo que se le asignó." },
        ],
      },
      {
        id: "visits",
        heading: "Una visita, de la llegada al final",
        blocks: [
          { steps: [
            "Abra el trabajo desde **Trabajos** o desde el **Calendario**. Su visita muestra su hora, quién está asignado, y el conteo de la lista de verificación.",
            "Toque **Voy en camino**. Al cliente se le envía por mensaje de texto el aviso de en camino de su empresa; la línea bajo el botón dice adónde va — o que no se enviará nada porque el cliente no tiene celular registrado. A su teléfono se le pregunta dónde está, una vez.",
            "Recorra la lista de verificación. Un punto de control es un paso que alguien debe confirmar antes del siguiente; un paso marcado **Photo expected** (se espera una foto) es un recordatorio, no un candado.",
            "Toque **Marcar como completada**. La visita queda hecha; la oficina lo ve y siguen los próximos pasos del trabajo.",
          ] },
        ],
      },
      {
        id: "who-can-see-it",
        heading: "Quién puede verlo",
        blocks: [
          { p: "Sus propios turnos y visitas: usted. Los de todos: el nivel Dispatcher y superiores, que además los preparan y publican. Sus horas reservables — el patrón fuera del cual se le advierte al gerente que no programe — son suyas para fijar bajo **Configuración → Disponibilidad**; vea [[working-hours-and-bookable-hours|Horario de trabajo y horas reservables]]. El lado del gerente está en [[the-scheduler-and-crew-shifts|La programación: preparar y publicar la semana de la cuadrilla]]." },
        ],
      },
    ],
    faq: [
      { q: "Mi gerente dice que el turno está ahí pero no lo veo.", a: "No se ha publicado. Un turno es un borrador, invisible para la cuadrilla, hasta que el gerente presiona Publicar semana." },
      { q: "¿Puedo cambiar un turno con un compañero?", a: "No en FieldQuo. Pídale a su gerente que lo mueva; el nivel Crew no puede editar turnos, ni siquiera los propios." },
      { q: "¿Por qué veo una cita que no está asignada a nadie?", a: "Las citas sin asignar se muestran a todos a propósito — un trabajo sin reclamar que nadie ve es un trabajo que nadie hace. Las visitas sin asignar, en cambio, solo aparecen en los trabajos en los que ya está." },
    ],
  },

  "photos-from-the-field": {
    title: "Fotos desde el campo",
    summary:
      "Dos maneras de que una foto pase de su teléfono al trabajo: subirla en la página del trabajo, o enviarla por mensaje de texto. Qué puede hacer la cuadrilla con ella, y qué hace la oficina después.",
    updated: "2026-09-12",
    intro: [
      "Una foto archivada en el trabajo es el registro al que el contratista recurre primero — antes, durante, terminado, y aquello que ya estaba roto cuando abrió la pared. FieldQuo guarda cada foto en el trabajo al que pertenece, fechada, en el orden en que ocurrió el trabajo, y la oficina elige después las buenas para el presupuesto, la factura o el sitio web.",
      "Desde el teléfono tiene dos entradas: el botón para subir en la página del trabajo, o un mensaje de texto a la línea de la cuadrilla de la empresa sin ninguna aplicación abierta. Este artículo es la primera; la vía por mensaje de texto es [[text-a-photo-to-the-crew-inbox|Enviar una foto por mensaje de texto sin aplicación]].",
    ],
    sections: [
      {
        id: "overview",
        heading: "Resumen",
        blocks: [
          { p: "Cada foto lleva una **etapa** — Before / start, In progress, Finished o Issue / snag (antes, en curso, terminado, problema) — y puede llevar las **etiquetas** propias de su empresa (lijado, imprimación, capa final). El inicio y el final del mismo trabajo se convierten en el antes y después que muestra su sitio web. Una foto de problema es un registro de oficina: nunca puede ir al sitio web, y la pantalla lo dice en lugar de no hacer nada en silencio." },
        ],
      },
      {
        id: "two-ways",
        heading: "Dos entradas",
        blocks: [
          { bullets: [
            "**Subirla en la página del trabajo.** Abra el trabajo, baje hasta **Fotos del trabajo**, toque el botón para subir y elija la cámara o el carrete. Se archiva de inmediato como In progress.",
            "**Enviarla por mensaje de texto a la línea de la cuadrilla.** Envíe la foto, con o sin unas palabras, al número de su empresa. Se archiva sola en el trabajo en el que está ese día, y las palabras que escribió fijan la etapa.",
          ] },
        ],
      },
      {
        id: "upload",
        heading: "Cómo subir desde la página del trabajo",
        blocks: [
          { steps: [
            "Abra el trabajo desde **Trabajos**.",
            "Baje hasta la tarjeta **Fotos del trabajo**. Muestra cada foto archivada hasta ahora, y cuántas están en su sitio web.",
            "Toque el botón para subir debajo de la cuadrícula y elija la cámara o una foto existente. Hasta 12 a la vez; una foto puede pesar hasta 15 MB, así que una foto de teléfono sin retocar está bien.",
            "Espere a que termine la subida — el botón indica que está subiendo — y las fotos aparecen en la cuadrícula, archivadas como In progress.",
            "Diga algo sobre ellas en la sala de chat del trabajo si la oficina debe mirar ahora; la foto por sí sola no avisa a nadie.",
          ] },
          { figure: "harness:mobile-job", caption: "La página del trabajo en un teléfono — la visita, su lista de verificación con un paso Photo expected, y la tarjeta Fotos del trabajo más abajo." },
        ],
      },
      {
        id: "stages-and-tags",
        heading: "Etapas, etiquetas y el sitio web",
        blocks: [
          { table: {
            head: ["Etapa", "Significado", "Puede ir al sitio web"],
            rows: [
              ["Before / start", "El estado en que lo encontró; el primer día", "Sí — se empareja con una foto Finished"],
              ["In progress", "A mitad del trabajo; la etapa por defecto de una subida", "Sí"],
              ["Finished", "Terminado; el después", "Sí — se empareja con una foto Before"],
              ["Issue / snag", "Un daño, una fuga, algo que está mal", "Nunca"],
            ],
          } },
          { p: "Cambiar una etapa, destacar una foto para el sitio web, dibujar sobre ella y cambiar sus etiquetas son decisiones de curaduría, y necesitan acceso de edición a los trabajos — los niveles Estimator y Crew ven las fotos y la etapa pero no esos controles. Una foto que usted sube cae como In progress; una foto que envía por mensaje de texto recibe su etapa de sus palabras. Las etiquetas se crean en **Configuración → Etiquetas de fotos de trabajo**; vea [[job-photos-and-tags|Fotos del trabajo y etiquetas]]." },
        ],
      },
      {
        id: "what-you-cannot-do",
        heading: "Qué no puede hacer el nivel Crew",
        blocks: [
          { bullets: [
            "Cambiar la etapa de una foto, destacarla para el sitio web, anotarla o etiquetarla — esos controles no se dibujan para usted, porque rechazarían.",
            "Eliminar una foto. Nadie elimina fotos desde la página del trabajo.",
            "Subir a un trabajo en el que no está reservado. El trabajo no está en su lista, y el servidor responde que no se encuentra.",
            "Adjuntar una foto a un paso de la lista de verificación. **Photo expected** en un paso es un recordatorio; marcar el paso no pide una.",
          ] },
        ],
      },
      {
        id: "who-can-see-it",
        heading: "Quién puede verlas",
        blocks: [
          { p: "Cualquiera que pueda abrir el trabajo ve sus fotos y el **Registro fotográfico** con su filtro por etiqueta. Subir solo necesita View only en trabajos — incluidos los niveles Crew y Estimator — en los trabajos en los que está. Curar necesita **View, create, and edit** (ver, crear y editar) en trabajos: el nivel Dispatcher y superiores. Puede comentar una foto en cualquier nivel." },
        ],
      },
    ],
    faq: [
      { q: "¿Subir una foto le avisa a la oficina?", a: "No. Archiva la foto. Si alguien debe mirar ahora, dígalo en la sala de chat del trabajo — una mención avisa a la persona nombrada." },
      { q: "¿Puedo subir un video?", a: "El control de subida acepta un video, pero la tarjeta de fotos del trabajo está construida alrededor de fotos y del emparejamiento antes y después. Use fotos para el registro del trabajo." },
      { q: "Subí una foto con la etapa equivocada.", a: "Pídale a alguien con acceso de edición a los trabajos que la reclasifique — un toque en la etapa de la foto. El nivel Crew no puede." },
    ],
  },

  "text-a-photo-to-the-crew-inbox": {
    title: "Enviar una foto por mensaje de texto sin aplicación",
    summary:
      "Envíe una foto por mensaje de texto a la línea de la cuadrilla de su empresa y se archiva sola en el trabajo en el que está ese día. Qué escribir, qué responde la línea, y qué le cuesta a la empresa.",
    updated: "2026-09-12",
    intro: [
      "La línea de la cuadrilla es un solo número de teléfono para toda la empresa. Un miembro de la cuadrilla le envía una foto — un mensaje con imagen común, sin aplicación, sin iniciar sesión, desde cualquier teléfono — y FieldQuo archiva la foto en el trabajo en el que esa persona está programada ese día. Cuando no puede saber qué trabajo, pregunta por mensaje de texto, y cuando aun así no puede, la foto espera en la **Bandeja del equipo** de la oficina a que una persona elija.",
      "Funciona porque el horario es el propio de FieldQuo: los candidatos son sus visitas del día, las de nadie más. Este artículo está escrito para la persona que envía el mensaje; la pantalla de la oficina es [[the-crew-inbox|La bandeja del equipo: fotos y novedades por mensaje]].",
    ],
    sections: [
      {
        id: "overview",
        heading: "Resumen",
        blocks: [
          { p: "Llega un mensaje, FieldQuo busca quién lo envió por el número de celular de su ficha de trabajador, vuelve a alojar la foto, y determina el trabajo: si sus palabras nombran un cliente, un número de calle o un título de trabajo, ese trabajo; si la foto lleva una ubicación que cae claramente en un solo sitio, ese trabajo; si tiene exactamente una visita ese día, ese trabajo, en silencio; si no, le envía la lista por mensaje y espera un número." },
          { figure: "harness:crew-inbox", caption: "La bandeja del equipo como la ve la oficina — el panel Mensajes del equipo con el número y las tarifas, una foto bajo Te necesita — elige el trabajo, y la lista Archivados." },
        ],
      },
      {
        id: "before-it-works",
        heading: "Antes de que funcione",
        blocks: [
          { steps: [
            "Su empresa activa los mensajes de texto de la cuadrilla y obtiene un número — una línea de prueba compartida de FieldQuo o la suya propia — en la pantalla **Bandeja del equipo**. Es una decisión de propietario, administrador o gerente, porque los mensajes se cobran al crédito de la empresa.",
            "Un propietario o administrador agrega su celular a su ficha de trabajador en la pestaña **Trabajadores** de Gestionar equipo. Hasta que esté ahí, sus mensajes llegan desde un número desconocido y no se archivan en ninguna parte.",
            "Guarde el número de la cuadrilla en los contactos de su teléfono. Es el del panel **Mensajes del equipo**: **Tu equipo escribe a este número**.",
          ] },
          { note: "Los mensajes de un número que no está en la lista no reciben respuesta, salvo durante los primeros mensajes de una empresa, cuando la línea responde una vez para decir que el número todavía no está en el equipo. El silencio después es deliberado — una línea que responde a desconocidos es una línea que los spammers conservan." },
        ],
      },
      {
        id: "how-it-files",
        heading: "Cómo se archiva una foto",
        blocks: [
          { bullets: [
            "**Una sola visita hoy** — se archiva de inmediato, sin respuesta. La foto cae en esa visita, y en las fotos del trabajo.",
            "**Un nombre en su mensaje** — el apellido de un cliente, un número de calle o una palabra del título del trabajo elige ese trabajo. La respuesta confirma adónde fue.",
            "**Varias visitas, nada dicho** — recibe una lista numerada y la pregunta. Responda con el número, o una palabra distintiva, dentro de 12 horas. Una foto nueva antes de responder abandona la pregunta y empieza de nuevo.",
            "**Sin visita hoy** — la línea dice que no ve ningún trabajo en su horario contra el cual archivar esto, y la foto espera en la bandeja de la oficina bajo Te necesita.",
          ] },
          { p: "Sus palabras también fijan la etapa: algo como before o starting la archiva como Before / start, done o finished como Finished, e issue, leak, damage o broken como Issue / snag. Las palabras clave, la pregunta y la confirmación están en inglés sea cual sea su idioma." },
        ],
      },
      {
        id: "what-it-texts-back",
        heading: "Qué responde la línea",
        blocks: [
          { table: {
            head: ["Qué pasó", "Respuesta"],
            rows: [
              ["Archivada en su único trabajo del día", "Nada — solo archiva"],
              ["Archivada después de que eligió, o después de deducir el trabajo", "Una confirmación de una línea que nombra el trabajo"],
              ["Varios trabajos posibles", "Una lista numerada que termina con Reply with the number (responda con el número)"],
            ],
          } },
        ],
      },
      {
        id: "costs",
        heading: "Qué cuesta",
        blocks: [
          { p: "Los mensajes y las fotos se descuentan del crédito de la empresa — el mismo saldo que el agente telefónico — a las tarifas impresas en el panel Mensajes del equipo: unos centavos por mensaje y por foto. Cuando el crédito se agota, los mensajes de la cuadrilla se pausan y el panel lo dice; una recarga los vuelve a conectar. A usted nunca se le cobra nada." },
        ],
      },
      {
        id: "who-can-see-it",
        heading: "Quién puede verla",
        blocks: [
          { p: "La fila **Bandeja del equipo** aparece una vez que los mensajes de la cuadrilla están activados. Los niveles Crew y Estimator ven solo los mensajes que enviaron; el nivel Dispatcher y superiores ven los de todos, y son quienes despejan la cola Te necesita. Configurar la línea o apagarla es cosa del propietario, el administrador o el gerente." },
        ],
      },
    ],
    faq: [
      { q: "¿Necesito tener la aplicación abierta para enviar una foto por mensaje?", a: "No. Esa es la idea — un mensaje con imagen común desde cualquier teléfono, y la foto está en el trabajo antes de que vuelva a la camioneta." },
      { q: "Envié una foto y no recibí respuesta. ¿Funcionó?", a: "Si tenía una sola visita ese día, sí — un archivado silencioso es el caso normal. Si su número no está en la lista, no; pídale a un propietario que agregue su celular en la pestaña Trabajadores." },
      { q: "¿Puedo enviar el mensaje al número del cliente en su lugar?", a: "No. La línea de la cuadrilla es un solo número para la empresa; está en el panel Mensajes del equipo y vale la pena guardarlo en sus contactos." },
    ],
  },

  "chat-on-your-phone": {
    title: "Chat en su teléfono",
    summary:
      "El chat de la empresa desde el teléfono de un miembro de la cuadrilla: #general, una sala por cada trabajo en el que está, mensajes directos, menciones, y qué puede y qué no puede llevar un mensaje.",
    updated: "2026-09-12",
    intro: [
      "**Chat** es su empresa hablando consigo misma. #general es todo el equipo; cada trabajo en el calendario tiene su propia sala para la cuadrilla reservada en él y la oficina; un mensaje directo es entre ustedes dos. Nada sale de la empresa, y es la única pestaña que todos los niveles de acceso conservan en la barra de pestañas del teléfono.",
    ],
    sections: [
      {
        id: "overview",
        heading: "Resumen",
        blocks: [
          { p: "La lista agrupa las salas en **Sin leer**, **Empresa**, **Trabajos**, **Mensajes directos** y **Trabajos terminados**. Abra una y obtiene el hilo con un separador **Mensajes sin leer** donde se quedó, el panel **Miembros**, un enlace **Abrir trabajo** en una sala de trabajo, y el cuadro de redacción abajo. La lista se actualiza sola cada 15 segundos mientras la pantalla está abierta." },
          { figure: "harness:mobile-chat", caption: "Una sala de trabajo en un teléfono — el separador de no leídos, un mensaje resaltado que menciona a dos personas, el cuadro de redacción con su contador de caracteres, y Enviar." },
        ],
      },
      {
        id: "rooms",
        heading: "Las salas",
        blocks: [
          { table: {
            head: ["Sala", "Quién está", "Cómo se entra"],
            rows: [
              ["**#general**", "Todo el equipo", "En el momento en que se acepta su invitación; sale cuando su cuenta se desactiva"],
              ["Una sala de trabajo", "Quien esté reservado en una de las visitas del trabajo, más el propietario, los administradores y los gerentes", "Estar reservado en una visita"],
              ["Un mensaje directo", "Solo ustedes dos — nadie más puede leerlo", "**Nuevo mensaje**, luego un nombre"],
              ["**Trabajos terminados**", "Las mismas personas, en lectura para el registro", "El trabajo está terminado; la sala se conserva"],
            ],
          } },
        ],
      },
      {
        id: "how-to",
        heading: "Cómo enviar un mensaje",
        blocks: [
          { steps: [
            "Toque **Chat** en la barra de pestañas.",
            "Abra la sala — o **Nuevo mensaje** para empezar un mensaje directo con alguien del equipo.",
            "Escriba en el cuadro de redacción. Hasta 4,000 caracteres; el conteo se muestra bajo el cuadro.",
            "Para dirigir un mensaje a alguien, escriba @ y elíjalo de la lista. Solo las personas de la sala pueden ser mencionadas.",
            "Toque **Enviar**. Si falla, el mensaje dice **No se envió.** con **Volver a ponerlo en el cuadro** — sus palabras no se pierden.",
          ] },
        ],
      },
      {
        id: "mentions-and-alerts",
        heading: "Las menciones, y a quién se le avisa",
        blocks: [
          { p: "Un mensaje directo le avisa a la otra persona; una mención les avisa a las personas nombradas. Nunca al autor, nunca a toda la sala. La campana cuenta sus salas sin leer, y si la persona activó las notificaciones del navegador, un mensaje directo o una mención también le llega como notificación — **Nuevo mensaje de …** o **… te mencionó en #general**." },
          { note: "No hay confirmación de lectura ni indicador de escritura. Abrir una sala la marca como leída para usted; nadie más lo ve." },
        ],
      },
      {
        id: "limits",
        heading: "Qué no puede llevar un mensaje",
        blocks: [
          { bullets: [
            "**Fotos o archivos.** El cuadro de redacción es solo texto. Ponga la foto en el trabajo — súbala o envíela por mensaje de texto — y dígalo en la sala.",
            "**Clientes.** Nada de aquí llega a un propietario de vivienda; el chat es interno por construcción.",
            "**Ediciones o eliminaciones.** Un mensaje enviado se queda como se envió.",
          ] },
        ],
      },
      {
        id: "who-can-see-it",
        heading: "Quién puede verlo",
        blocks: [
          { p: "Todos los de la lista, en todos los niveles de acceso, cuando la función de chat de cuadrilla está activada para la empresa. Una sesión de soporte de solo lectura de FieldQuo puede ver el chat y no puede escribir en él, y la pantalla lo dice. El lado de la oficina de una sala de trabajo está en [[a-chat-room-for-every-job|Una sala de chat para cada trabajo]]." },
        ],
      },
    ],
    faq: [
      { q: "¿Por qué no veo una sala para el trabajo en el que estoy?", a: "Está en la sala de un trabajo cuando está reservado en una de sus visitas. Si su nombre no está en una visita, pídale a la oficina que lo reserve en ella — es la única manera de entrar." },
      { q: "¿Puedo enviar una foto en el chat?", a: "No. Súbala en la página del trabajo o envíela por mensaje de texto a la línea de la cuadrilla, y luego mencione a la persona que debe mirar." },
      { q: "¿Recibiré una notificación por cada mensaje?", a: "No. Solo por un mensaje directo para usted, o un mensaje que lo mencione — y solo si las notificaciones están activadas en su navegador." },
    ],
  },

  "time-off-on-your-phone": {
    title: "Pedir tiempo libre desde su teléfono",
    summary:
      "Solicite un día libre, vea cuánto le queda, retire una solicitud, y sepa de quién está esperando.",
    updated: "2026-09-12",
    intro: [
      "**Ausencias** es una sola pantalla con dos funciones: lo que le queda, y sus solicitudes. Una solicitud va a la persona a quien usted reporta; algunos tipos se aprueban automáticamente en el momento en que la envía; y hasta que se toma, puede retirarla usted mismo.",
    ],
    sections: [
      {
        id: "overview",
        heading: "Resumen",
        blocks: [
          { p: "Arriba, una tarjeta por tipo de ausencia que su empresa configuró — vacaciones, días por enfermedad, día personal, como lo haya llamado el propietario — con **Acumulado**, **Tomado**, lo que está pendiente de aprobación, y los días **Restante**. Debajo, **Tus solicitudes** con el botón **Solicitar tiempo libre**, cada solicitud con su etiqueta de estado y, mientras está pendiente, una línea que dice de quién está esperando. Si todavía no existen políticas de ausencias, la pantalla lo dice y nombra la página de configuración que un propietario usa para agregarlas." },
          { figure: "harness:mobile-time-off", caption: "Ausencias en un teléfono — las tarjetas de saldo Vacaciones y Día personal, Solicitar tiempo libre, y una solicitud pendiente con su botón Withdraw." },
        ],
      },
      {
        id: "how-to",
        heading: "Cómo solicitar tiempo libre",
        blocks: [
          { steps: [
            "Abra **Más → Ausencias**.",
            "Toque **Solicitar tiempo libre**.",
            "Elija el **Tipo**. Un tipo sin sueldo no está limitado por un saldo; uno pagado muestra los días que tiene disponibles.",
            "Fije **Primer día** y **Último día**, o marque **Solo medio día** para medio día.",
            "Agregue una **Nota (opcional)** — cualquier cosa que su gerente deba saber.",
            "Toque **Enviar solicitud**. Si el tipo se aprueba automáticamente, la pantalla ya se lo dijo: al enviarlo queda reservado.",
          ] },
        ],
      },
      {
        id: "what-happens-next",
        heading: "Qué pasa después",
        blocks: [
          { bullets: [
            "La solicitud aparece bajo **Tus solicitudes** como **Pendiente**, con la línea que dice de quién está esperando — la persona a quien usted reporta, o un propietario o administrador si no hay nadie definido o si su gerente está ausente hoy. El enrutamiento se recalcula cada vez que carga la pantalla, así que sigue a su gerente cuando vuelve de sus propias vacaciones.",
            "Las personas que pueden actuar reciben una notificación en su campana — y en su teléfono si activaron las notificaciones.",
            "Ellas eligen **Aprobar** o **Rechazar** en su pestaña Equipo. La etiqueta de su solicitud cambia, y la tarjeta de saldo mueve los días de pendiente de aprobación a Tomado.",
            "¿Cambió de opinión? Toque **Withdraw** (retirar) en una solicitud pendiente o aprobada que todavía no haya tomado.",
          ] },
          { note: "La cifra de días restantes es información, no autorización. El servidor comprueba su saldo cuando envía y otra vez cuando el gerente aprueba, porque entre medio se pueden aprobar otras solicitudes." },
        ],
      },
      {
        id: "balances",
        heading: "Cómo funcionan los saldos",
        blocks: [
          { p: "Los saldos se acumulan solos a partir de la política que fijó el propietario — una cantidad de días por año, acumulándose a lo largo del año — y la tarjeta muestra las cifras de este año. Una solicitud pendiente cuenta contra lo que tiene disponible, para que no pueda pedir los mismos días dos veces. El pago de vacaciones, donde su empresa lo acumula, se muestra como un monto en la tarjeta." },
          { tip: "Los días por enfermedad suelen estar en una política de aprobación automática: enviar reserva el día y simplemente le avisa a su gerente. Hágalo desde el teléfono antes de que empiece el turno para que el horario lo sepa." },
        ],
      },
      {
        id: "who-can-see-it",
        heading: "Quién puede verlo",
        blocks: [
          { p: "Todos ven sus propios saldos y solicitudes y pueden retirar las suyas. Aprobar y rechazar, la pestaña **Equipo**, los saldos de todos y quién está de descanso próximamente son para quien puede dirigir una cuadrilla — el nivel Dispatcher y superiores. Las políticas mismas son solo de propietario y administrador, bajo Configuración; vea [[time-off-policies|Políticas de tiempo libre]] y, para el lado del gerente, [[time-off-requests|Solicitudes de tiempo libre]]." },
        ],
      },
    ],
    faq: [
      { q: "¿Quién aprueba mi solicitud?", a: "La persona a quien usted reporta. Si no hay nadie definido, o si su gerente está ausente hoy, va a un propietario o administrador en su lugar, y la línea bajo la solicitud dice cuál." },
      { q: "¿Puedo pedir más días de los que tengo?", a: "No para un tipo pagado — el servidor rechaza al enviar. Una ausencia sin sueldo no tiene saldo y no está limitada." },
      { q: "Mi solicitud fue aprobada pero ya no la necesito.", a: "Toque Withdraw en ella. Funciona en solicitudes pendientes y aprobadas que todavía no haya tomado." },
    ],
  },

  "report-a-safety-incident": {
    title: "Reportar un incidente de seguridad",
    summary:
      "Presente una lesión, un casi accidente o un daño material desde el teléfono en menos de un minuto: qué pide el formulario, qué significa Se detuvo el trabajo, y quién ve el reporte.",
    updated: "2026-09-12",
    intro: [
      "**Seguridad** es donde una lesión, un casi accidente o un daño se escribe mientras está fresco. Todos los niveles de acceso pueden presentar uno — la persona parada en la escalera es la que tiene que poder reportar lo que pasó en ella — y un casi accidente vale la pena reportarlo igual que una lesión, como dice la pantalla misma.",
      "El reporte es un registro, no una alarma. Presentarlo lo escribe en la lista de incidentes y el registro de actividad de la empresa; no envía mensajes ni correos a nadie. Avísele también a su supervisor.",
    ],
    sections: [
      {
        id: "overview",
        heading: "Resumen",
        blocks: [
          { p: "La pantalla lista los incidentes — filtrados **Todos**, **Abierto**, **Revisado** o **Cerrado** — como tarjetas con el tipo, una insignia **Se detuvo el trabajo** cuando el trabajo se interrumpió, dónde, quién lo reportó y su estado, y un botón **Reportar**. Los gerentes tienen un panel **Seguimiento** en cada tarjeta para fijar el estado y anotar lo que se hizo; un miembro de la cuadrilla ve los reportes que presentó." },
          { figure: "harness:mobile-safety-report", caption: "El formulario de reporte en un teléfono — el tipo, cuándo, qué pasó, dónde, el trabajo opcional, la casilla Se detuvo el trabajo y la nota sobre el reporte." },
        ],
      },
      {
        id: "how-to",
        heading: "Cómo presentar un reporte",
        blocks: [
          { steps: [
            "Abra **Más → Seguridad** y toque **Reportar**.",
            "Elija **Qué tipo de incidente**: **Casi accidente**, **Lesión**, **Daño material** u **Otro**.",
            "Fije **Cuándo pasó** — por defecto es ahora.",
            "Describa **Qué pasó** con sus propias palabras. Corto está bien; es el único campo obligatorio.",
            "Diga **Dónde** y, bajo **Trabajo (opcional)**, elija el trabajo o deje **No está ligado a un trabajo**. La lista contiene los trabajos en los que está.",
            "Marque **El trabajo se detuvo por esto** si así fue, y agregue una **Nota sobre el reporte (opcional)** sobre avisar a una autoridad provincial.",
            "Toque **Presentar reporte**. La confirmación lo invita a agregar una foto del lugar — opcional — y luego **Listo**.",
          ] },
        ],
      },
      {
        id: "each-field",
        heading: "Para qué sirve cada campo",
        blocks: [
          { table: {
            head: ["Campo", "Qué hace"],
            rows: [
              ["**Qué tipo de incidente**", "Fija la etiqueta de la tarjeta. Una lesión se registra en el registro de actividad como lesión; un casi accidente como casi accidente."],
              ["**Cuándo pasó**", "La hora del incidente, no la de la presentación."],
              ["**Qué pasó**", "Obligatorio. El único texto libre que la tarjeta muestra completo."],
              ["**Dónde**", "Una habitación, un patio, un piso — texto libre."],
              ["**Trabajo (opcional)**", "Vincula el reporte a un trabajo para que la oficina pueda encontrarlo desde ahí."],
              ["**El trabajo se detuvo por esto**", "Muestra una insignia roja Se detuvo el trabajo en la tarjeta. No cambia nada más — el horario no se toca."],
              ["**Nota sobre el reporte (opcional)**", "Su nota sobre el reporte regulatorio. FieldQuo no conoce las reglas ni los plazos de su provincia y no decide esto por usted."],
            ],
          } },
        ],
      },
      {
        id: "after-filing",
        heading: "Después de presentarlo",
        blocks: [
          { p: "El reporte está **Abierto**. Un gerente lo revisa en el panel **Seguimiento** — el estado pasa a **Revisado** o **Cerrado**, con una nota sobre lo que se hizo — y la tarjeta se actualiza. Las fotos que agregó se quedan en el reporte. Quien reporta es siempre la persona con la sesión iniciada; un reporte no se puede presentar a nombre de otra persona." },
          { warning: "A nadie se le avisa automáticamente. Si alguien está herido, llame primero por ayuda y avísele a su supervisor; el reporte se puede presentar desde el sitio después, o a la mañana siguiente con la hora real fijada bajo Cuándo pasó." },
        ],
      },
      {
        id: "who-can-see-it",
        heading: "Quién puede verlo",
        blocks: [
          { p: "El piso del ajuste de seguridad es **Report incidents, and view their own** (reportar incidentes y ver los suyos) — los niveles Crew y Estimator — así que ve lo que presentó, y solo eso. Ver los incidentes de todos es el siguiente nivel, y dar seguimiento es **View everyone's incidents and follow up on them** (ver los incidentes de todos y darles seguimiento): el nivel Dispatcher y superiores. Un reporte presentado sobre usted por otra persona es de esa persona; a ella le corresponde mostrárselo. El lado de la oficina está en [[safety-incidents|Incidentes de seguridad y casi accidentes]]." },
        ],
      },
    ],
    faq: [
      { q: "¿Debo reportar un casi accidente que no lastimó a nadie?", a: "Sí. La pantalla lo dice con sus propias palabras: un casi accidente es cómo se aprende antes de que alguien salga lastimado." },
      { q: "¿Marcar Se detuvo el trabajo le dice a la oficina que pare el trabajo?", a: "No. Pone una insignia en el reporte. Detener el trabajo es una conversación con su supervisor." },
      { q: "¿Puedo editar un reporte después de presentarlo?", a: "No desde el nivel Crew. Un gerente agrega el seguimiento y cambia el estado; el original se queda como usted lo escribió." },
    ],
  },

  "push-notifications": {
    title: "Notificaciones push",
    summary:
      "Cómo enterarse en su teléfono de una mención, un mensaje directo, un presupuesto aprobado o una factura pagada — y por qué el interruptor puede decir que el push no está configurado.",
    updated: "2026-09-12",
    intro: [
      "Las notificaciones del navegador tienen dos mitades. Mientras haya una pestaña de FieldQuo abierta en algún lugar del teléfono, la página misma puede mostrar una notificación del sistema por algo nuevo. Con la pestaña cerrada, solo el **push** puede llegarle — y el push tiene que estar configurado en la instalación por FieldQuo, así que el interruptor le dice claramente cuál de las dos está recibiendo.",
      "Las dos mitades son un solo interruptor, por persona y por navegador, en **Configuración → Notificaciones**, en la tarjeta **Notificaciones del navegador**.",
    ],
    sections: [
      {
        id: "overview",
        heading: "Resumen",
        blocks: [
          { p: "La tarjeta dice: **Recibe la actividad nueva como notificación del sistema en este ordenador o teléfono: con FieldQuo en otra pestaña y, donde el push esté configurado, con la pestaña cerrada.** Debajo, el interruptor **Avisarme en este navegador**, una línea sobre el permiso del navegador, una línea sobre el push, y **Enviar una notificación de prueba**." },
          { p: "Activar el interruptor pide el permiso del teléfono, recuerda en este teléfono que usted quiere avisos, y — cuando el push está configurado — registra este teléfono en el servidor para que los mismos eventos lleguen con la pestaña cerrada. Desactivarlo olvida la marca y elimina el registro. El permiso en sí pertenece al navegador: si está bloqueado, la tarjeta lo dice y dónde cambiarlo, y el interruptor no se ofrece." },
          { note: "La tarjeta **Recordatorios de cita** en la misma página es otra cosa: mensajes de texto a los clientes antes de una visita, desde el nombre de su empresa. Esos van solo por mensaje de texto — no hay recordatorio por correo, y el texto del recordatorio todavía no es editable, solo el mensaje de en camino lo es. No son notificaciones para usted." },
        ],
      },
      {
        id: "turn-it-on",
        heading: "Cómo activarlo",
        blocks: [
          { steps: [
            "En un iPhone o iPad, agregue primero FieldQuo a la pantalla de inicio y ábralo desde el ícono — la última línea de la tarjeta dice que Safari solo entrega notificaciones a las aplicaciones web instaladas.",
            "Abra **Configuración → Notificaciones** y baje hasta **Notificaciones del navegador**.",
            "Active **Avisarme en este navegador** y permita las notificaciones cuando el teléfono lo pida.",
            "Lea la confirmación: **Activado. Se te avisará aquí y con la pestaña cerrada.** significa que el push funciona; **Activado. Se te avisará mientras haya una pestaña de FieldQuo abierta.** significa que solo está disponible la mitad en pestaña.",
            "Toque **Enviar una notificación de prueba** y búsquela en la esquina de la pantalla.",
          ] },
          { figure: "harness:settings-notifications", caption: "Configuración → Notificaciones — los avisos por correo de la empresa y los recordatorios de cita; la tarjeta Notificaciones del navegador con el interruptor está más abajo en la misma página." },
        ],
      },
      {
        id: "what-you-get",
        heading: "Qué dispara una notificación",
        blocks: [
          { table: {
            head: ["Evento", "A quién se le avisa"],
            rows: [
              ["Un mensaje directo, o un mensaje que lo menciona, en el Chat", "A usted"],
              ["Un mensaje nuevo de un propietario de vivienda en la bandeja de Mensajes", "A todos los que pueden leer la bandeja"],
              ["Un presupuesto aprobado, una factura pagada, un contracargo, un presupuesto que no se entregó, un estimado esperando aprobación, una consulta nueva, una solicitud de tiempo libre", "A las personas cuyo nivel de acceso cubre eso — las mismas a quienes les aparece en la campana"],
              ["Una foto subida, una visita completada, una marcación", "A nadie — son registros, no avisos"],
            ],
          } },
          { p: "Una notificación nunca lleva dinero: una pantalla de bloqueo es un lugar público, así que el push dice menos que la fila del historial, nunca más. Para un miembro de la cuadrilla, cuyo nivel no cubre ninguno de los eventos de dinero, las notificaciones son en la práctica el chat — un mensaje directo o una mención." },
        ],
      },
      {
        id: "the-status-line",
        heading: "Qué significa la línea del push",
        blocks: [
          { table: {
            head: ["La línea dice", "Significado"],
            rows: [
              ["El push con la pestaña cerrada no está configurado en esta instalación", "FieldQuo todavía no ha habilitado el push. El interruptor igual funciona para la mitad en pestaña."],
              ["Este navegador no puede recibir push con la pestaña cerrada", "El navegador del teléfono no tiene push — en un iPhone, normalmente porque FieldQuo no está instalado en la pantalla de inicio."],
              ["Push con la pestaña cerrada: disponible", "Configurado y listo; active el interruptor para usarlo aquí."],
              ["Push con la pestaña cerrada: activo en 2 navegador(es)", "Funciona, y esa es la cantidad de sus dispositivos registrados."],
              ["Permiso del navegador: bloqueado", "El navegador se negó. Permita las notificaciones para el sitio en su configuración y luego vuelva."],
            ],
          } },
        ],
      },
      {
        id: "who-can-see-it",
        heading: "Quién puede verlo",
        blocks: [
          { p: "El interruptor es personal — cada persona, cada teléfono — pero vive en **Configuración → Notificaciones**, y el menú de Configuración muestra esa fila solo a propietarios y administradores. Un miembro de la cuadrilla hoy no tiene ninguna fila que lleve al interruptor, así que las menciones del chat de la cuadrilla le llegan en la campana y en la pantalla, no en la pantalla de bloqueo." },
          { warning: "Una notificación es una cortesía sobre algo ya registrado. Si un servicio de push está lento o caído, el registro sigue estando en la campana y en la pantalla; nada espera a la notificación." },
        ],
      },
    ],
    faq: [
      { q: "La tarjeta dice que el push no está configurado. ¿Algo anda mal con mi teléfono?", a: "No. Esa línea es sobre la instalación de FieldQuo, no sobre su teléfono. El interruptor igual le da notificaciones mientras haya una pestaña de FieldQuo abierta." },
      { q: "Lo activé en mi escritorio. ¿Mi teléfono también las recibirá?", a: "No. El interruptor es por navegador. Actívelo en cada dispositivo en el que quiera recibir avisos." },
      { q: "¿Los clientes recibirán alguna vez un push de FieldQuo?", a: "No. Los clientes reciben correos y mensajes de texto de su empresa; el push es para las personas con sesión iniciada en FieldQuo." },
    ],
  },

  "bad-connections-and-offline": {
    title: "Malas conexiones, y por qué no hay modo sin conexión",
    summary:
      "Qué pasa con una marcación, una foto o un mensaje cuando se cae la señal, qué hacer al respecto, y qué es lo que FieldQuo deliberadamente no hace.",
    updated: "2026-09-12",
    intro: [
      "FieldQuo no guarda nada en el teléfono y no pone nada en cola para después. Cada toque es una solicitud al servidor, y una solicitud sin señal no pasa — la pantalla se lo dice, y usted vuelve a tocar cuando tiene una barra. No hay modo sin conexión, no hay sincronización en segundo plano, y este artículo lo dice en lugar de dejar que lo descubra en un sótano.",
      "La razón es honestidad por encima de comodidad. Una marcación que parece registrada y no lo está, una foto que parece archivada y está esperando en una cola, es exactamente la falla que este producto se niega a entregar. Lo que ve en la pantalla es lo que tiene el servidor.",
    ],
    sections: [
      {
        id: "overview",
        heading: "Resumen",
        blocks: [
          { p: "Lo único que FieldQuo instala en su navegador es un pequeño proceso cuya única tarea es recibir notificaciones push. No guarda páginas en caché, no intercepta solicitudes y no sirve nada mientras está sin conexión — así que un ícono de FieldQuo instalado sin señal se abre en la página de sin conexión propia del navegador, no en una copia vieja de su día." },
          { p: "Lo que está en el servidor está a salvo. Una página que no carga dice **No se pudo cargar** y, debajo, **Es un problema de carga, no faltan datos — no se ha eliminado nada.** con un botón **Reintentar**. Esa frase es cierta en cada pantalla." },
        ],
      },
      {
        id: "what-happens",
        heading: "Qué pasa con cada acción sin señal",
        blocks: [
          { table: {
            head: ["Acción", "Sin conexión", "Cómo lo sabe"],
            rows: [
              ["Abrir una pantalla", "No carga nada", "El panel: No se pudo cargar, con Reintentar"],
              ["Registrar entrada o salida", "No se registra nada", "La pantalla no cambia a En turno (ni a fuera de turno); ante una solicitud rechazada dice No se pudo registrar."],
              ["Voy en camino o Marcar como completada", "La visita no cambia", "Un mensaje: No se pudo actualizar la visita. Revisa tu conexión."],
              ["Enviar un mensaje de chat", "No se guarda", "El mensaje dice No se envió. con Volver a ponerlo en el cuadro"],
              ["Subir una foto, presentar un reporte, enviar una solicitud", "No se archiva nada", "Un mensaje de error; el formulario conserva lo que escribió hasta que salga de la página"],
            ],
          } },
        ],
      },
      {
        id: "what-to-do",
        heading: "Qué hacer",
        blocks: [
          { steps: [
            "Mire la pantalla antes de guardar el teléfono. Una marcación que pasó muestra **En turno**; un mensaje que pasó está en el hilo; una foto que pasó está en la cuadrícula.",
            "Si no pasó, muévase adonde tenga señal y vuelva a tocar. Nada quedó registrado a medias, así que tocar dos veces no puede duplicar nada — el reloj rechaza una segunda entrada mientras hay una abierta.",
            "Para una foto con una conexión de datos débil, envíela por mensaje de texto a la línea de la cuadrilla en su lugar: un mensaje con imagen sale por la red telefónica y se archiva solo cuando llega — [[text-a-photo-to-the-crew-inbox|Enviar una foto por mensaje de texto sin aplicación]].",
            "Si el sitio es una zona muerta, avísele a la oficina con anticipación. Su gerente puede agregar una marcación a mano en Hojas de horas, y el parte diario se puede escribir esa noche.",
          ] },
        ],
      },
      {
        id: "the-clock",
        heading: "El reloj sigue corriendo en el servidor",
        blocks: [
          { p: "Una vez registrada una entrada, la entrada abierta vive en el servidor, no en su teléfono. Perder la señal, cerrar el navegador, una batería agotada — nada de eso detiene el reloj. Inicie sesión en cualquier teléfono o computadora y **Registrar salida** cierra la misma entrada. La ubicación que se le pide al teléfono al tocar tiene un límite de 8 segundos: si no hay lectura a tiempo, la marcación sale sin posición en lugar de esperar." },
          { tip: "Si el día terminó sin señal y sin salida, la entrada se queda abierta toda la noche. Registre la salida a primera hora y dígale a su gerente la hora real; él la corrige en Hojas de horas y la entrada vuelve a pendiente para revisión." },
        ],
      },
      {
        id: "what-fieldquo-does-not-do",
        heading: "Qué no hace FieldQuo",
        blocks: [
          { bullets: [
            "**Poner acciones en cola para después.** Un toque que falla no se reintenta en segundo plano. Usted lo reintenta.",
            "**Rastrear su posición.** Al teléfono se le pregunta una vez, al tocar; nada corre entre un toque y otro y nada funciona mientras la pantalla está bloqueada. Es un límite del navegador, y el producto no finge lo contrario.",
            "**Entregar una aplicación nativa.** No hay ninguna en ninguna tienda; la oficina es una aplicación web que corre en el navegador del teléfono y se puede fijar en la pantalla de inicio — [[install-it-like-an-app|Instalarlo como una aplicación]].",
          ] },
        ],
      },
    ],
    faq: [
      { q: "Toqué Registrar entrada sin señal y guardé el teléfono. ¿Estoy en turno?", a: "No. No se registró nada. Abra la pantalla: si no dice En turno, vuelva a tocar donde tenga señal, y dígale a su gerente la hora real de inicio." },
      { q: "¿Las fotos que tomé sin conexión se subirán solas después?", a: "No. Súbalas desde la página del trabajo cuando tenga conexión, o envíelas por mensaje de texto a la línea de la cuadrilla — un mensaje con imagen a menudo pasa donde una página web no." },
      { q: "¿Viene un modo sin conexión?", a: "Hoy no, y este artículo lo dirá cuando eso cambie. El diseño actual es que lo que muestra la pantalla es lo que tiene el servidor." },
    ],
  },
};
