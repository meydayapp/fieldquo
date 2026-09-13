// content/help/es/settings-1.js
//
// Parte 1 de la categoría «settings» en español (ver el compositor,
// settings.js): el propio menú Configuración, luego los grupos Negocio y
// Equipo y horarios — Configuración de la empresa y sus tres subartículos
// (horario de apertura, impuestos, sector y tipos de presupuesto), Marca,
// Idioma, el Registro de actividad, Gestionar equipo, Tu horario, las
// Políticas de ausencias y la Página de reservas.
//
// Misma estructura que el inglés, artículo por artículo: mismos slugs, mismas
// secciones en el mismo orden, mismos bloques, mismas figuras —
// scripts/check-help-centre.mjs compara ambos. Las palabras en pantalla vienen
// del bloque `es` de app/i18n/appMessages.js; los pocos rótulos que la
// pantalla solo muestra en inglés (los interruptores de la cuadrícula de
// acceso, las negativas del servidor) se citan tal cual.
export const ARTICLES = {
  "the-settings-menu": {
    title: "El menú Configuración",
    summary:
      "Dónde vive cada ajuste de la empresa: los ocho grupos del menú Configuración, la casilla de búsqueda y las razones por las que una fila puede faltar en el suyo.",
    updated: "2026-09-12",
    intro: [
      "**Configuración** es la última fila de la barra lateral principal. Abre un segundo menú, más estrecho, a la izquierda — ocho grupos, cada uno plegado para que la lista se lea como un índice — y aterriza en **Configuración de la empresa**. Todo lo que configura su empresa, y no un presupuesto o un trabajo en particular, vive aquí.",
      "Este artículo es el mapa: qué contiene cada grupo, cómo encontrar una fila escribiendo, y las razones por las que una fila sobre la que leyó puede no estar en su propio menú.",
    ],
    sections: [
      {
        id: "overview",
        heading: "Resumen",
        blocks: [
          { p: "Los grupos están ordenados según la frecuencia con que una empresa los abre: primero la identidad (**Cuenta**, **Negocio**), luego el día a día (**Equipo y horarios**, **Servicios y precios**), luego lo que sale hacia afuera (**Documentos y plantillas**, **Mensajería y alertas**), luego el dinero (**Cobros**), y por último las superficies con las que se encuentra un cliente (**De cara al cliente**). Solo está abierto el grupo en el que usted se encuentra; pulse el título de un grupo para abrirlo o cerrarlo, y FieldQuo recuerda cuál dejó abierto." },
          { p: "En un teléfono, el menú se convierte en una barra en la parte superior que nombra la pantalla en la que está. Tóquela y la lista completa sube como una hoja; toque una fila y la hoja se cierra en la página que pidió." },
        ],
      },
      {
        id: "what-is-on-the-screen",
        heading: "Qué hay en la pantalla",
        blocks: [
          { p: "De arriba abajo: el título **Configuración**, la casilla **Buscar ajustes** y luego los ocho grupos. Cada fila tiene su propio artículo en esta categoría." },
          { table: {
            head: ["Grupo", "Filas"],
            rows: [
              ["Cuenta", "Cuenta y facturación · Recomienda y gana · Migración de datos · Novedades del producto"],
              ["Negocio", "Configuración de la empresa · Marca · Idioma · Registro de actividad"],
              ["Equipo y horarios", "Gestionar equipo · Disponibilidad · Políticas de ausencias · Página de reservas · Zonas de trabajo"],
              ["Servicios y precios", "Productos y servicios · Servicios y precios · Costos de materiales · Precios de gabinetes · Gastos generales · Campos personalizados"],
              ["Documentos y plantillas", "Correo de presupuesto · Plantillas de correo · Plantillas PDF · Traducciones · Listas de verificación · Etiquetas de fotos de trabajo"],
              ["Mensajería y alertas", "Mensajes de clientes · Seguimientos · Notificaciones · Dominio de correo"],
              ["Cobros", "Pagos · Meta Ads · Control de gastos · Crédito de IA · Nómina"],
              ["De cara al cliente", "Tu sitio web · Cotizaciones instantáneas · Comparte tus enlaces · Enlace para la bio · Recepcionista telefónico · Empleado de IA · Reseñas"],
            ],
          } },
          { figure: "live:app-settings", caption: "Configuración — los ocho grupos a la izquierda con Negocio abierto, aterrizando en Configuración de la empresa." },
        ],
      },
      {
        id: "find-a-row",
        heading: "Cómo encontrar una fila",
        blocks: [
          { steps: [
            "Pulse **Configuración** al pie de la barra lateral principal.",
            "Escriba parte del nombre de una fila en **Buscar ajustes** — «impuesto», «logotipo», «horario». Todos los grupos se abren mientras escribe, así que una fila nunca está a más de una búsqueda, sin importar qué estuviera plegado.",
            "Pulse la fila. Si nada coincide, el menú dice **No hay coincidencias con «…»** con un enlace **Limpiar** que vacía la casilla.",
          ] },
          { tip: "Cuatro filas son la misma página que una fila de la barra lateral principal, con otro nombre: **Gestionar equipo** es **Tu equipo**, **Cuenta y facturación** es **Plan**, **Control de gastos** es **Gastos**, y **Recomienda y gana** está allí con su propio nombre. Las dos puertas abren la misma pantalla." },
        ],
      },
      {
        id: "rows-that-may-be-missing",
        heading: "Filas que pueden faltar en su menú",
        blocks: [
          { p: "Su menú puede ser más corto que la tabla anterior. No es una falla: una fila se retira por una de las razones de abajo, y la página que hay detrás lo rechazaría de todos modos. Ocultar la fila es orden; la negativa en el servidor es la regla." },
          { bullets: [
            "**Su nivel de acceso.** Las filas que solo un propietario o un administrador pueden abrir — Cuenta y facturación, Recomienda y gana, Migración de datos, Pagos, Meta Ads, Nómina, Registro de actividad, Políticas de ausencias, Notificaciones, Tu sitio web — no se dibujan para un Gerente, un Despachador, un Estimador ni la Cuadrilla.",
            "**Un interruptor de permiso.** **Costos de materiales** y **Gastos generales** necesitan el interruptor **Job Costing** (costeo de trabajos); **Productos y servicios**, **Servicios y precios** y **Cotizaciones instantáneas** necesitan **Show Pricing** (ver precios); **Control de gastos** necesita el nivel de gastos más alto de la cuadrícula de acceso.",
            "**Su oficio.** **Costos de materiales** y **Precios de gabinetes** aparecen solo para las empresas cuyos tipos de presupuesto activados se cotizan así — un pintor nunca ve un tarifario de gabinetes.",
            "**Una función en vista previa o fuera de su plan.** La fila se queda y lleva una insignia **Vista previa** o **Bloqueado** en vez de desaparecer, para que sepa que existe.",
          ] },
        ],
      },
      {
        id: "who-can-see-it",
        heading: "Quién puede verlo",
        blocks: [
          { p: "Todo el que tiene un inicio de sesión ve la fila Configuración y el menú. Tres filas se dibujan para cada miembro, Cuadrilla incluida, porque son de la propia persona: **Novedades del producto**, **Idioma** y **Disponibilidad**. La mayoría de las demás necesitan la capacidad de gestión de usuarios — el propietario, los administradores, y los niveles Gerente y Despachador. Cada artículo de esta categoría enuncia su propia regla." },
          { note: "Una sesión de soporte de FieldQuo, de solo lectura, ve cada fila y no puede cambiar nada en ninguna." },
        ],
      },
    ],
    faq: [
      { q: "¿Por qué Configuración se abre en Configuración de la empresa?", a: "El índice no tiene página propia; aterrizar en la primera fila del grupo Negocio equivale a pulsarla. Configuración de la empresa es además la pantalla que una empresa nueva debería completar primero." },
      { q: "¿Puedo reordenar u ocultar filas yo mismo?", a: "No. Los grupos y su orden son fijos. Lo que varía de una persona a otra lo deciden el nivel de acceso, los interruptores de permiso y el oficio, nunca una preferencia." },
      { q: "¿Dónde está Costos de materiales? No lo encuentro.", a: "Se dibuja solo cuando sus tipos de presupuesto activados incluyen un oficio que cotiza por material, y solo para las personas cuyo interruptor Job Costing está activado. Revise primero Servicios y precios, y luego el acceso de la persona." },
    ],
  },

  "settings-company": {
    title: "Configuración de la empresa",
    summary:
      "La primera pantalla después del registro: su alcance del trabajo y sus condiciones de pago, el calendario de pagos, el sector y los tipos de presupuesto, los datos de la empresa, el horario de apertura, la disponibilidad para reservas, la configuración de impuestos, la comparativa del sector y sus preferencias regionales.",
    updated: "2026-09-12",
    intro: [
      "**Configuración de la empresa** es la fila en la que aterriza el menú **Configuración** y la pantalla que toda empresa nueva debería completar primero. Contiene los datos que se imprimen en cada documento — su nombre, dirección, teléfono, número fiscal — y las preferencias que dan forma a cada pantalla que usa su equipo: zona horaria, formato de fecha, primer día de la semana, moneda.",
      "Este artículo recorre la página tarjeta por tarjeta. Tres tarjetas son lo bastante grandes para tener su propio artículo: [[opening-hours|Horario de apertura]], [[tax-settings|Configuración de impuestos]] y [[industry-and-quote-types|Sector y tipos de presupuesto]]. Las tarjetas de alcance del trabajo y de calendario de pagos se tratan del lado de presupuestos y facturas.",
    ],
    sections: [
      {
        id: "overview",
        heading: "Resumen",
        blocks: [
          { p: "La página es un formulario largo con un solo botón **Actualizar ajustes** al pie, más tres tarjetas que se guardan por su cuenta: **Calendario de pagos** (**Guardar calendario**), **Horario de apertura** (**Guardar el horario de apertura**) y la lista de tasas de impuesto (**Agregar**). Un cambio en cualquier otra tarjeta espera a **Actualizar ajustes**; un guardado fallido lo dice en rojo en vez de fingir." },
        ],
      },
      {
        id: "what-is-on-the-screen",
        heading: "Qué hay en la pantalla",
        blocks: [
          { p: "Bajo el título **Configuración de la empresa — Los datos de tu empresa, horarios, impuestos y preferencias regionales.**, las tarjetas van de arriba abajo:" },
          { table: {
            head: ["Tarjeta", "Qué contiene"],
            rows: [
              ["Alcance del trabajo y condiciones", "El texto del proceso que se copia en cada presupuesto nuevo, tres plantillas de oficio para empezar, y la línea de texto libre Condiciones de pago — ver [[scope-of-work-and-terms|Alcance del trabajo y condiciones de pago]]."],
              ["Calendario de pagos", "Etapas de anticipo y saldo ligadas a las fechas del propio trabajo. Desactivado hasta que agregue una etapa; una vez activo, escribe la línea Condiciones de pago por usted — ver [[deposits-and-payment-schedules|Anticipos y calendarios de pago]]."],
              ["Sector y tipos de presupuesto", "Los sectores que indicó al registrarse y los tipos de presupuesto activados en este momento, con un enlace Gestionar hacia Servicios y precios."],
              ["Datos de la empresa", "Nombre de la empresa, Número de teléfono, Correo electrónico, URL del sitio web, su subdominio fieldquo.com, Dirección con una vista previa del mapa, Ciudad, Provincia, Código postal, País."],
              ["Horario de apertura", "Cuándo está abierto el negocio — el horario público, una fila por día."],
              ["Disponibilidad para reservas", "Una tabla de solo lectura con sus propias horas reservables y un botón Editar; el editor completo es Disponibilidad."],
              ["Configuración de impuestos", "Nombre y número del ID fiscal, la casilla No tengo uno, sus tasas de impuesto, la pregunta sobre el IVA para los países con IVA, y el interruptor de impuesto local automático."],
              ["Comparativa del sector", "Una sola casilla: compartir sus cifras anónimas para desbloquear la página de comparativa."],
              ["Configuración regional", "País, Moneda de facturación, la casilla para atender clientes en el extranjero, Zona horaria, Formato de fecha, Primer día de la semana."],
            ],
          } },
          { figure: "live:app-settings-company", caption: "Configuración de la empresa — Alcance del trabajo y condiciones, Calendario de pagos, Sector y tipos de presupuesto y Datos de la empresa, con el Horario de apertura más abajo." },
        ],
      },
      {
        id: "how-to-update",
        heading: "Cómo actualizar los datos de su empresa",
        blocks: [
          { steps: [
            "Abra **Configuración → Configuración de la empresa**.",
            "En **Datos de la empresa**, empiece a escribir en **Dirección** y elija la sugerencia — Ciudad, Provincia, Código postal, País y el mapa se completan solos. Aun así puede editar cada casilla a mano.",
            "Revise **Configuración regional**. El país se completa a partir de la dirección; la Moneda de facturación sigue al país salvo que marque **Atiendo a clientes fuera de mi país (facturar en otras monedas)**, lo que la convierte en una lista para elegir.",
            "Pulse **Actualizar ajustes** al pie. El botón muestra **Guardando…** y luego aparece un **Guardado** en verde a su lado.",
          ] },
          { note: "El nombre, el teléfono, el correo y la dirección se imprimen en cada presupuesto, factura y correo que reciben sus clientes, y la dirección es el punto de partida de la comprobación de tiempo de viaje de la página de reservas. El subdominio que se muestra bajo la casilla del sitio web es de solo lectura aquí; el sitio de una página que vive en él se construye en **Configuración → Tu sitio web**." },
        ],
      },
      {
        id: "what-each-setting-changes",
        heading: "Qué cambia cada ajuste regional",
        blocks: [
          { bullets: [
            "**País** — decide la moneda, qué rótulo de número fiscal ve (**Número de GST/HST** en Canadá, **Número de IVA** en el Reino Unido y la UE, **EIN** en Estados Unidos) y qué conjunto inicial de ausencias se ofrece primero.",
            "**Moneda de facturación** — la moneda en la que se muestran y cobran sus presupuestos, facturas y pagos de clientes. Se deriva del país salvo que facture en el extranjero; el servidor aplica la misma regla al guardar, así que a un taller canadiense nunca se le pide elegir entre CAD, USD y EUR.",
            "**Zona horaria** — el reloj con el que se leen cada cita, recordatorio y llamada del recepcionista. Un error aquí es un SMS de recordatorio a la hora equivocada.",
            "**Formato de fecha** — MM/DD/AAAA, DD/MM/AAAA o AAAA-MM-DD, aplicado a sus propias pantallas: la agenda, la lista del equipo, las páginas de presupuesto, las importaciones de gastos. Los documentos del cliente lo ignoran y siguen el idioma del cliente.",
            "**Primer día de la semana** — Domingo o Lunes. Gira el calendario, la cuadrícula de la agenda y cada editor semanal de esta página y de Disponibilidad.",
            "**Compartir mis cifras anónimas para desbloquear las comparativas** — activa la página **Comparativa del sector**. Sus cifras se agrupan con las de otras empresas y nunca se muestran individualmente; desmárquela cuando quiera y la página vuelve a bloquearse.",
          ] },
        ],
      },
      {
        id: "who-can-see-it",
        heading: "Quién puede verlo",
        blocks: [
          { p: "La fila necesita la capacidad de gestión de usuarios: el propietario, los administradores, y los niveles Gerente y Despachador abren el formulario completo. Un Estimador o un miembro de la Cuadrilla que llega a la página por su dirección obtiene una versión de solo lectura — nombre, teléfono, correo, dirección, horario de apertura, horas reservables, tasas de impuesto, configuración regional, sectores, tipos de presupuesto y el texto del alcance — con un aviso que nombra quién puede cambiarla. El número fiscal, el interruptor de impuesto automático y la casilla de la comparativa no se les muestran en absoluto." },
          { note: "Cada escritura pasa por una sola ruta que vuelve a comprobar la misma capacidad, así que ocultar el formulario es una cortesía y la negativa es la regla." },
        ],
      },
    ],
    faq: [
      { q: "Escribí USA como país y la moneda siguió en CAD. ¿Por qué?", a: "El país ahora es una lista de códigos, no una casilla de texto, precisamente porque un valor escrito que la lista no reconocía caía en Canadá. Elija el país de la lista y la moneda lo sigue." },
      { q: "¿Cambiar el formato de fecha cambia mis presupuestos?", a: "No. El formato se aplica a las pantallas que lee su equipo. Un presupuesto, una factura o un correo para un cliente formatea sus fechas en el idioma del cliente." },
      { q: "¿Puedo ocultar mi subdominio?", a: "No desde esta pantalla — se muestra para que conozca la dirección. Nada se sirve allí hasta que construya y publique un sitio en Tu sitio web." },
    ],
  },

  "opening-hours": {
    title: "Horario de apertura",
    summary:
      "Las horas en que su negocio está abierto — mostradas en su sitio web, enviadas a Google como datos estructurados, y respetadas por el recepcionista telefónico y el empleado de IA. No es lo mismo que las horas reservables de nadie.",
    updated: "2026-09-12",
    intro: [
      "**Horario de apertura** es una tarjeta de **Configuración de la empresa**: siete filas, una por día, cada una **Cerrado** o un rango horario. Responden a una sola pregunta — cuándo está abierta la empresa — y son de la empresa, no de una persona.",
      "Importan más de lo que parece. Las mismas siete filas se convierten en el bloque de horario de su sitio web y en los datos estructurados que ponen «Abierto · Cierra a las 17:00» en un resultado de Google, un recuadro que lee gente que nunca carga el sitio.",
    ],
    sections: [
      {
        id: "overview",
        heading: "Resumen",
        blocks: [
          { p: "FieldQuo guarda dos semanas distintas y las mantiene separadas a propósito. El horario de apertura dice cuándo está abierta la *empresa*. Las **Horas reservables** — la tarjeta justo debajo, y la pantalla más completa **Disponibilidad** — dicen cuándo se puede reservar a una *persona*. Un estimador que se toma el viernes libre no debe publicar el taller como cerrado los viernes, así que a las dos se les permite discrepar." },
          { warning: "Una empresa que nunca definió un horario de apertura no tiene ninguno — la vista de solo lectura dice **No se han definido horarios de apertura.** y nada va al sitio web ni a Google. FieldQuo nunca inventa una semana de lunes a viernes en su nombre; la ausencia de una declaración no es una declaración." },
        ],
      },
      {
        id: "what-is-on-the-screen",
        heading: "Qué hay en la pantalla",
        blocks: [
          { p: "Bajo **Horario de apertura — Cuándo está abierto tu negocio. Se muestra en tu sitio web y se usa para el horario que aparece en los resultados de búsqueda de Google.**, el editor muestra la semana empezando por su **Primer día de la semana**." },
          { bullets: [
            "**Una casilla por día** — marcada significa abierto; sin marcar muestra **Cerrado** y oculta las horas.",
            "**Dos casillas de hora**, apertura **a** cierre. Un cierre anterior a su apertura muestra **La hora de cierre debe ser posterior a la de apertura.** y, si se guarda de todos modos, el servidor almacena ese día como cerrado.",
            "**Aplicar el horario del lunes a todos los días abiertos** (el día nombrado es el primero que se muestra) — copia las horas de un día a todos los demás días *abiertos*. Nunca reabre un día cerrado.",
            "**Restablecer el horario habitual del oficio** — de lunes a jueves de 8:00 a 17:00, viernes de 8:00 a 16:00, fin de semana cerrado. Un punto de partida, guardado solo cuando pulsa guardar.",
          ] },
          { figure: "live:app-settings-company", caption: "Configuración de la empresa — la tarjeta Horario de apertura al pie, una fila por día con una casilla y dos horas." },
        ],
      },
      {
        id: "how-to-set",
        heading: "Cómo definir su horario de apertura",
        blocks: [
          { steps: [
            "Abra **Configuración → Configuración de la empresa** y baje hasta **Horario de apertura**.",
            "Marque los días en que está abierto y desmarque los que no.",
            "Defina las horas del primer día abierto y luego pulse **Aplicar el horario del … a todos los días abiertos** para copiarlas.",
            "Ajuste cualquier día que difiera — un viernes más corto, un sábado por la mañana.",
            "Pulse **Guardar el horario de apertura**. Esta tarjeta se guarda por su cuenta; un **Guardado** en verde lo confirma, y no necesita **Actualizar ajustes** para ella.",
          ] },
          { tip: "Si todos los días están marcados como cerrados, una línea bajo la tarjeta lo dice: no aparecerá ningún horario en su sitio web ni en los resultados de búsqueda. No desmarque nada por accidente." },
        ],
      },
      {
        id: "where-they-are-used",
        heading: "Dónde se usa el horario",
        blocks: [
          { table: {
            head: ["Dónde", "Qué hace el horario"],
            rows: [
              ["Su sitio web", "Se imprime como el bloque de horario de apertura y se emite como datos estructurados para que los buscadores puedan mostrarlo junto a su nombre — ver [[the-website-builder|El constructor de sitios web]]."],
              ["Recepcionista telefónico", "Las devoluciones de llamada y los turnos reservados se ofrecen solo dentro del horario de apertura; a quien llama nunca se le promete una llamada a las siete de la mañana — ver [[the-phone-receptionist|El recepcionista telefónico]]."],
              ["Empleado de IA", "Su opción de «responder solo en horario comercial» lee este horario; sin ninguno definido, la opción no puede detener nada — ver [[the-ai-employee|El empleado de IA]]."],
              ["Configuración de la empresa, vista de solo lectura", "Un miembro del equipo sin acceso a la configuración lee el horario como texto, así que un pintor no tiene que llamar a la oficina para saber cuándo cierra."],
            ],
          } },
          { p: "El horario *no* se usa para armar la agenda de nadie, para decidir qué turnos puede reservar un cliente, ni para contar días de ausencia. Eso sale de las horas de trabajo y reservables de cada persona." },
        ],
      },
      {
        id: "who-can-see-it",
        heading: "Quién puede verlo",
        blocks: [
          { p: "Editar necesita la capacidad de gestión de usuarios — el propietario, los administradores, los Gerentes y los Despachadores. Cualquier otra persona que abra Configuración de la empresa ve el horario como una lista de solo lectura." },
        ],
      },
    ],
    faq: [
      { q: "Definí mi horario pero la página de reservas sigue ofreciendo el sábado. ¿Por qué?", a: "La página de reservas lee las horas reservables, por persona, no el horario de apertura de la empresa. Abra Disponibilidad y desmarque el sábado en Horas reservables para las personas en cuestión." },
      { q: "¿Por qué el formulario muestra de lunes a viernes si nunca definí nada?", a: "El editor ofrece el horario habitual del oficio como punto de partida para que el formulario se termine rápido. No se almacena nada hasta que pulsa Guardar el horario de apertura; hasta entonces la empresa no tiene horario." },
      { q: "¿El horario cambia con el horario de verano?", a: "No. Son horas de reloj de pared en la zona horaria de su empresa — las 8:00 siguen siendo las 8:00 todo el año." },
    ],
  },

  "tax-settings": {
    title: "Configuración de impuestos",
    summary:
      "Su número de registro fiscal tal como se imprime en los documentos, las tasas de impuesto que crea, la pregunta sobre el IVA para las empresas europeas, y el interruptor que elige por usted la tasa local del cliente.",
    updated: "2026-09-12",
    intro: [
      "**Configuración de impuestos** es una tarjeta de **Configuración de la empresa** con dos mitades. La mitad superior trata de *usted*: el número de registro que se imprime al pie de cada presupuesto y factura. La mitad inferior trata del *cliente*: las tasas que crea, cuál es la predeterminada, y si FieldQuo debe elegir la tasa que coincide con la provincia del cliente en lugar de usar siempre la predeterminada.",
      "La regla detrás de toda la tarjeta es conservadora a propósito: cada tasa que un documento puede llevar es una que usted escribió y nombró. FieldQuo no calcula lo que debe, no lo registra en ningún sitio y no presenta nada por usted — imprime lo que usted ingresa.",
    ],
    sections: [
      {
        id: "overview",
        heading: "Resumen",
        blocks: [
          { p: "Un presupuesto o una factura almacena su impuesto como un importe en el momento en que se crea. Nada de esta tarjeta llega a un documento que ya existe — eliminar una tasa o cambiar el interruptor automático cambia el próximo documento, nunca uno enviado. Eso es lo que hace que la tarjeta sea segura de editar a mitad de mes." },
        ],
      },
      {
        id: "what-is-on-the-screen",
        heading: "Qué hay en la pantalla",
        blocks: [
          { p: "Los controles, de arriba abajo:" },
          { table: {
            head: ["Control", "Qué hace"],
            rows: [
              ["Nombre del ID fiscal y la casilla del número", "El rótulo que lleva el número en los documentos (**p. ej. IVA**) y el número mismo. La casilla del número se llama como la llama su país — **Número de GST/HST**, **Número de IVA**, **EIN** — según el país de la Configuración regional. Sin comprobación de formato, a propósito: un número válido nunca se rechaza."],
              ["No tengo uno — mi empresa no está registrada.", "Se muestra solo mientras la casilla del número está vacía. Marcarla registra el hecho y quita el paso de registro fiscal de su panel; desmárquela el día que se registre y el paso vuelve."],
              ["Tasas de impuestos", "La lista de tasas que creó, cada una con nombre y porcentaje, una con la insignia **Predeterminado**, cada una con un icono de eliminar."],
              ["Crear tasa de impuesto", "Abre un formulario de una línea: **Nombre (p. ej. IVA)**, **Tasa %**, una casilla **Predeterminado** y **Agregar**. Se guarda de inmediato."],
              ["¿Estás registrado a efectos de IVA?", "Tres opciones, mostradas solo cuando el país es una jurisdicción con IVA: **Sí — estoy registrado a efectos de IVA**, **No — estoy por debajo del umbral de registro**, **Prefiero no decirlo todavía — usa mi tasa por defecto**."],
              ["Aplicar automáticamente la tasa de impuesto local del cliente…", "El interruptor que deja que FieldQuo elija entre sus tasas según la provincia del cliente en lugar de que usted elija en cada documento."],
            ],
          } },
          { figure: "live:app-settings-company", caption: "Configuración de la empresa — la tarjeta Configuración de impuestos está bajo Disponibilidad para reservas, con la lista de tasas y Crear tasa de impuesto." },
        ],
      },
      {
        id: "create-a-tax-rate",
        heading: "Cómo crear una tasa de impuesto",
        blocks: [
          { steps: [
            "Abra **Configuración → Configuración de la empresa** y baje hasta **Configuración de impuestos**.",
            "Pulse **Crear tasa de impuesto**.",
            "Escriba un **Nombre** que diga dónde se aplica — «GST + QST (QC)», «HST Ontario» — y la **Tasa %**. Póngale el nombre de la provincia si quiere que el interruptor automático la encuentre: la coincidencia se hace por las palabras del nombre.",
            "Marque **Predeterminado** si es la tasa que un documento debe llevar cuando nada mejor aplica. Solo una tasa es predeterminada a la vez; marcarla aquí desmarca la anterior.",
            "Pulse **Agregar**. La tasa aparece en la lista al instante; no hay nada más que guardar.",
          ] },
          { note: "No hay edición en el lugar. Para cambiar el porcentaje de una tasa, elimínela con el icono de la papelera y créela de nuevo. Los documentos ya enviados conservan sus importes." },
        ],
      },
      {
        id: "how-a-rate-is-chosen",
        heading: "Cómo se elige la tasa de un presupuesto nuevo",
        blocks: [
          { p: "Cuando se crea un presupuesto, FieldQuo elige su tasa en este orden y se detiene en la primera respuesta. El presupuesto dice qué paso la eligió, así que una cifra de impuesto nunca cambia sin explicación." },
          { bullets: [
            "**El interruptor automático está desactivado** — su tasa **Predeterminado**, sin más. La función es opcional y esta es su puerta.",
            "**Una de sus tasas nombra la provincia del cliente** — esa tasa gana. A un contratista que escribió «HST Ontario 13» nunca lo contradice una tabla.",
            "**Ninguna tasa coincide y la jurisdicción es conocible** — se aplica la tasa publicada de una provincia canadiense. Nunca para un estado de EE. UU., donde la cifra estatal es un piso, no una tasa; para un país de la UE, solo si respondió **Sí** a la pregunta sobre el IVA.",
            "**Todo lo demás** — su tasa predeterminada, y el presupuesto lo dice.",
          ] },
          { tip: "Nombre sus tasas según las provincias antes de activar el interruptor. Una tasa llamada «Impuesto» nunca puede coincidir con nada y el interruptor caerá en la predeterminada cada vez." },
        ],
      },
      {
        id: "who-can-see-it",
        heading: "Quién puede verlo",
        blocks: [
          { p: "Crear, eliminar y marcar como predeterminadas las tasas, y cambiar el número y los interruptores, necesitan la capacidad de gestión de usuarios — el propietario, los administradores, los Gerentes y los Despachadores. Un miembro del equipo que no la tiene ve solo la lista de tasas, de solo lectura, porque esos porcentajes aterrizan en los presupuestos que arma; el número de registro y los interruptores no se le muestran." },
        ],
      },
    ],
    faq: [
      { q: "¿Tengo que ingresar un número fiscal?", a: "Solo si está registrado. Un trabajador autónomo canadiense por debajo del umbral de registro no tiene número de GST que dar — marque No tengo uno y el panel deja de pedirlo." },
      { q: "¿Dónde aparece el número?", a: "Al pie de cada presupuesto y factura, junto a sus datos de contacto, nombre y número juntos. Si cualquiera de las dos mitades está vacía, no se imprime ninguna línea — nunca un rótulo vacío." },
      { q: "¿Activar el interruptor automático cambiará mis presupuestos enviados?", a: "No. Un presupuesto almacena su impuesto como un importe al crearse. El interruptor afecta al próximo presupuesto que cree." },
      { q: "¿Por qué mi presupuesto dice que se usó la tasa predeterminada?", a: "Porque ninguna de sus tasas nombraba la provincia del cliente y la jurisdicción no era una de las que FieldQuo completa — una dirección de EE. UU., o una de la UE sin respuesta sobre el IVA. Agregue una tasa con el nombre de esa provincia, o defina la provincia del cliente en su ficha." },
    ],
  },

  "industry-and-quote-types": {
    title: "Sector y tipos de presupuesto",
    summary:
      "Los oficios que indicó al registrarse y los tipos de presupuesto que habilitaron — qué muestra la tarjeta, dónde se cambian realmente los tipos de presupuesto, y qué deciden en otras partes de FieldQuo.",
    updated: "2026-09-12",
    intro: [
      "**Sector y tipos de presupuesto** es una tarjeta pequeña de **Configuración de la empresa** que refleja dos listas: los **Sectores** que eligió cuando la empresa se registró, y los **Tipos de presupuesto activados** en este momento en **Servicios y precios**. Nada de la tarjeta se edita en el lugar — es un espejo, con un enlace **Gestionar** hacia la pantalla que sí edita.",
      "Se gana su lugar porque esas dos listas deciden qué puede ser un presupuesto nuevo, qué artículos del catálogo de precios pueden adjuntársele, y qué filas de configuración ve siquiera su empresa.",
    ],
    sections: [
      {
        id: "overview",
        heading: "Resumen",
        blocks: [
          { p: "La tarjeta dice **Lo que nos dijiste que hace tu empresa y los tipos de presupuesto que eso habilitó.** Los sectores son uno de doce oficios — limpieza, construcción y contratistas, electricidad, climatización, mantenimiento general, paisajismo, cuidado de céspedes, pintura, plomería, lavado a presión, techos, cuidado de árboles — mostrados en la etiqueta con su nombre en inglés. Los tipos de presupuesto son las categorías del catálogo de oficios que ha activado, más las personalizadas que creó." },
        ],
      },
      {
        id: "what-is-on-the-screen",
        heading: "Qué hay en la pantalla",
        blocks: [
          { p: "Dos filas de etiquetas:" },
          { bullets: [
            "**Sectores** — una etiqueta por oficio indicado al registrarse, o **Ninguno seleccionado.** No hay ningún control aquí ni en otra parte de la aplicación para cambiarlos después del registro.",
            "**Tipos de presupuesto activados** — una etiqueta por categoría activada, con un sufijo **· personalizado** en las que creó usted mismo, y un enlace **Gestionar** a la derecha. Sin ninguna activada, la tarjeta dice **Ninguno activado todavía — ve a Ajustes → Servicios.**",
          ] },
          { figure: "live:app-settings-company", caption: "Configuración de la empresa — la tarjeta Sector y tipos de presupuesto: el sector Techos y tres tipos de presupuesto activados." },
        ],
      },
      {
        id: "change-quote-types",
        heading: "Cómo cambiar sus tipos de presupuesto",
        blocks: [
          { steps: [
            "Abra **Configuración → Configuración de la empresa** y busque **Sector y tipos de presupuesto**.",
            "Pulse **Gestionar** junto a **Tipos de presupuesto activados**. Aterriza en **Servicios y precios** con una barra en la parte superior que lo devuelve a Configuración de la empresa.",
            "Active o desactive categorías allí, o agregue una personalizada — ver [[quote-types-and-takeoffs|Tipos de presupuesto y mediciones]] y [[settings-services|Servicios y precios]].",
            "Vuelva a Configuración de la empresa; las etiquetas reflejan el cambio de inmediato.",
          ] },
          { note: "Servicios y precios muestra por defecto las categorías del catálogo que encajan con sus sectores, con una forma de mostrar todos los oficios. Un plomero aterriza en los tipos de presupuesto de plomería en vez de en todo el catálogo, pero nada queda fuera de alcance." },
        ],
      },
      {
        id: "what-they-change",
        heading: "Qué cambian las dos listas",
        blocks: [
          { bullets: [
            "**El generador de presupuestos** ofrece exactamente los tipos de presupuesto activados cuando alguien empieza un presupuesto nuevo, y cada tipo lleva sus propios campos de medición y su propio texto.",
            "**El catálogo de precios** — un artículo en **Productos y servicios** puede vincularse a un tipo de presupuesto, así que una línea de pintura nunca aparece en un presupuesto de techos.",
            "**El propio menú Configuración** — **Costos de materiales** y **Precios de gabinetes** se dibujan solo cuando un tipo de presupuesto activado cotiza así. Active la ebanistería y aparece el tarifario; desactívela y la fila se va.",
          ] },
        ],
      },
      {
        id: "who-can-see-it",
        heading: "Quién puede verlo",
        blocks: [
          { p: "La tarjeta está en Configuración de la empresa, así que el propietario, los administradores, los Gerentes y los Despachadores la ven con el enlace **Gestionar**; un miembro del equipo con acceso de solo lectura ve las mismas etiquetas sin él. Servicios y precios en sí se dibuja para quien tenga activado el interruptor **Show Pricing** (ver precios)." },
        ],
      },
    ],
    faq: [
      { q: "¿Puedo cambiar mis sectores?", a: "Hoy no, en la aplicación. Se registraron al darse de alta y ninguna pantalla los edita. La lista que importa en el día a día — los tipos de presupuesto activados — es totalmente suya para cambiarla en Servicios y precios." },
      { q: "¿Qué significa el sufijo · personalizado?", a: "Que ese tipo de presupuesto lo creó su empresa en lugar de venir del catálogo de oficios de FieldQuo." },
      { q: "Desactivé un tipo de presupuesto. ¿Qué pasa con los presupuestos que lo usaban?", a: "Nada — un presupuesto conserva su tipo. Simplemente deja de ofrecerse para presupuestos nuevos." },
    ],
  },

  "settings-branding": {
    title: "Marca",
    summary:
      "Su logotipo y los tres colores de marca — principal, secundario y neutro — que aparecen en cada presupuesto, factura, PDF, correo, página de reservas y sitio web que ve un cliente, con el contraste calculado por usted.",
    updated: "2026-09-12",
    intro: [
      "**Marca** es donde se cumple la promesa de marca blanca. Suba un logotipo, elija un color principal, y cada documento y página con los que se encuentra un propietario lleva su nombre y su color — nunca los de FieldQuo. Un cliente que compara tres contratistas no debería poder notar que dos usan el mismo software.",
      "La página son tres tarjetas y un botón. A propósito no es una herramienta de diseño: un solo color lo dirige todo, el contraste se mide en lugar de suponerse, y la oficina interna en la que trabaja su equipo se mantiene neutra elija lo que elija.",
    ],
    sections: [
      {
        id: "overview",
        heading: "Resumen",
        blocks: [
          { p: "El título dice **Marca — Tu logotipo y color de marca aparecen en cada presupuesto, factura y correo que ven tus clientes.** Solo el color principal es obligatorio; el secundario y el neutro siguen valores predeterminados sensatos hasta que los defina, y cada uno tiene un enlace **Restablecer** para volver a seguir al principal." },
          { note: "El color de marca es para lo que ve el *cliente*. Las pantallas de su equipo se mantienen neutras a propósito — un contratista que elige verde lima no debería terminar con una oficina interna verde lima. El color se aplica superficie por superficie: presupuesto, factura, correo, PDF, página de reservas, portal, sitio web." },
        ],
      },
      {
        id: "what-is-on-the-screen",
        heading: "Qué hay en la pantalla",
        blocks: [
          { p: "De arriba abajo:" },
          { table: {
            head: ["Tarjeta", "Qué contiene"],
            rows: [
              ["Logotipo", "Un cuadro de vista previa y **Subir logotipo** (o **Reemplazar logotipo** una vez que existe uno). **PNG, JPG, WebP o SVG, hasta 8 MB.**"],
              ["Colores de marca", "**Principal** — seis muestras predefinidas más un selector personalizado. **Secundario** — los mismos controles, **Restablecer** para seguir al principal. **Cómo se verán tus documentos** — una vista previa **Claro** y una **Oscuro** que se actualizan mientras elige. **Neutro** — la barra del encabezado del correo, casi negra por defecto."],
              ["Vista previa", "**Aproximadamente cómo se verá la parte superior de tus correos.**: el encabezado neutro con su logotipo, un título de sección en el secundario, y un botón **Ver y aprobar** en el principal."],
              ["Guardar marca", "Un solo botón para toda la página; muestra **Guardando…** y luego **Guardado ✓**."],
            ],
          } },
          { figure: "live:app-settings-branding", caption: "Configuración → Marca — la tarjeta Logotipo, la tarjeta Colores de marca con sus muestras y vistas previas." },
        ],
      },
      {
        id: "how-to",
        heading: "Cómo definir su marca",
        blocks: [
          { steps: [
            "Abra **Configuración → Marca**.",
            "Pulse **Subir logotipo** y elija el archivo. Un PNG transparente o un SVG se ve mejor tanto en el encabezado claro como en el oscuro. El logotipo anterior se quita cuando lo reemplaza.",
            "Elija un color **Principal** — una muestra, o el selector para su código hexadecimal exacto.",
            "Deje **Secundario** y **Neutro** en sus valores predeterminados salvo que su marca los tenga; revise las vistas previas **Claro** y **Oscuro**.",
            "Pulse **Guardar marca**.",
          ] },
          { tip: "Tome el color de su camioneta, su tarjeta de presentación o su sitio web actual para que todas las superficies coincidan. Un color que cambia de un documento a otro se lee como dos empresas." },
        ],
      },
      {
        id: "what-each-colour-changes",
        heading: "Qué cambia cada color",
        blocks: [
          { bullets: [
            "**Principal** — botones, barras de progreso, enlaces y su nombre en el encabezado del correo; el acento en la página de aprobación del presupuesto, la página de pago de la factura, la página de reservas y el portal del cliente.",
            "**Secundario** — acentos de apoyo, como los títulos de sección en las listas detalladas. Por defecto usa el principal, así que una empresa que nunca lo define sigue viéndose coherente.",
            "**Neutro** — la barra del encabezado de cada correo y la franja oscura en la parte superior de los documentos. Los tonos oscuros se ven más premium que un color de marca saturado, y por eso el valor predeterminado es casi negro.",
          ] },
          { warning: "Los contratistas eligen amarillo, blanco y gris medio, y una regla ingenua de «color oscuro lleva texto blanco» falla en los tres. FieldQuo mide el contraste de cada par texto-fondo que deriva de su color y sustituye un par legible cuando el suyo no lo es — así que una marca amarilla sigue imprimiendo botones legibles. No puede hacer visible un logotipo blanco sobre una página blanca; revise las vistas previas." },
        ],
      },
      {
        id: "who-can-see-it",
        heading: "Quién puede verlo",
        blocks: [
          { p: "La fila necesita la capacidad de gestión de usuarios: el propietario, los administradores, los Gerentes y los Despachadores. El guardado va a la misma ruta que Configuración de la empresa y se rechaza a cualquier otra persona, así que un miembro de la cuadrilla que llega a la dirección no puede cambiar su marca." },
        ],
      },
    ],
    faq: [
      { q: "¿El logotipo aparece en el PDF?", a: "Sí — en el PDF del presupuesto, el PDF de la factura y el correo que los lleva, en el encabezado donde está el nombre de su empresa." },
      { q: "¿Por qué mi oficina interna no usa mi color?", a: "Por diseño. La promesa de marca blanca trata de lo que ve el propietario. Las pantallas que su personal usa todo el día se mantienen neutras para que un color de marca intenso nunca las haga incómodas de trabajar." },
      { q: "¿Qué pasa si nunca defino un secundario ni un neutro?", a: "El secundario sigue a su principal y el neutro se queda casi negro. Ambos se derivan al renderizar, así que cambiar el principal más tarde mueve el secundario con él." },
    ],
  },

  "settings-language": {
    title: "Idioma",
    summary:
      "Dos ajustes que se parecen y significan cosas distintas: el idioma en que usted lee FieldQuo, y el predeterminado de la empresa que heredan los compañeros y los clientes que no eligieron ninguno.",
    updated: "2026-09-12",
    intro: [
      "**Idioma** es una de las tres filas de Configuración que ve cada miembro, Cuadrilla incluida, porque la mitad es personal: **Tu idioma** es aquel en el que *usted* lee la aplicación, y cambiarlo no toca a nadie más. La otra mitad, **Predeterminado de la empresa**, es lo que hereda todo el que no ha elegido — y lo que usan los documentos de un cliente cuando el cliente no tiene idioma propio.",
      "FieldQuo viene en ocho idiomas: English, Français, Español, Українська, ਪੰਜਾਬੀ, Tagalog, Deutsch e Italiano. Los documentos y correos para clientes existen en los ocho; la interfaz de la oficina interna está completa en algunos y parcialmente en inglés en otros, y la página dice cuál es cuál.",
    ],
    sections: [
      {
        id: "overview",
        heading: "Resumen",
        blocks: [
          { p: "El subtítulo dice **El idioma en que se envían los presupuestos, facturas y correos de tus clientes.** — un recordatorio de que el predeterminado de la empresa es el que llega a los clientes. Un documento conserva el idioma en que se creó: cambiar cualquiera de los dos ajustes nunca reescribe un presupuesto que ya salió." },
        ],
      },
      {
        id: "what-is-on-the-screen",
        heading: "Qué hay en la pantalla",
        blocks: [
          { p: "Dos tarjetas y una línea de estado:" },
          { bullets: [
            "**Tu idioma** — una fila **Usar el predeterminado de la empresa — …** que nombra el predeterminado actual, y luego una fila por idioma con su nombre nativo y una insignia de cobertura: **Interfaz 100 %**, **Interfaz 100 % · por revisar** (completa pero aún no revisada por alguien que domina el idioma), **Interfaz 84 %** (el resto cae en inglés) o **Interfaz en inglés**. Una marca señala su elección.",
            "**Predeterminado de la empresa** — una píldora por idioma para quienes pueden cambiarlo; para los demás, el predeterminado actual como texto con un aviso que nombra quién puede cambiarlo.",
            "**Mostrando ahora:** — el idioma que la aplicación usa en este momento: su elección, o el predeterminado de la empresa cuando lo sigue.",
          ] },
          { figure: "live:app-settings-language", caption: "Configuración → Idioma — Tu idioma con la insignia de cobertura en cada fila, y las píldoras de Predeterminado de la empresa debajo." },
        ],
      },
      {
        id: "change-your-language",
        heading: "Cómo cambiar su idioma",
        blocks: [
          { steps: [
            "Abra **Configuración → Idioma**.",
            "Pulse el idioma que quiera en **Tu idioma**, o **Usar el predeterminado de la empresa** para heredarlo.",
            "La aplicación cambia de inmediato — sin recargar, sin un guardado aparte. Un **Guardado** en verde lo confirma.",
          ] },
          { note: "Cada botón de esta tarjeta escribe solo su propia preferencia. La pantalla de nadie más cambia." },
        ],
      },
      {
        id: "what-the-company-default-changes",
        heading: "Qué cambia el predeterminado de la empresa",
        blocks: [
          { p: "Pulsar una píldora en **Predeterminado de la empresa** mueve a cada compañero que no definió su propio idioma, y se convierte en el respaldo para los clientes. Para todo lo que FieldQuo envía a un cliente, el idioma se elige en este orden, deteniéndose en la primera respuesta:" },
          { bullets: [
            "**El idioma del propio documento** — un presupuesto o una factura queda fijado al crearse y el correo que lo acompaña lo sigue.",
            "**El idioma guardado del cliente** — para todo lo que no está ligado a un documento: una confirmación de reserva, un recordatorio de pago.",
            "**El predeterminado de la empresa** — este ajuste.",
            "**Inglés** — cuando no hay nada de lo anterior definido.",
          ] },
          { warning: "**Cambiar esto afecta a todos los que no han definido su propio idioma. No cambia los presupuestos ya enviados — conservan el idioma con que se enviaron.** Un PDF firmado tiene que seguir diciendo lo que decía." },
        ],
      },
      {
        id: "who-can-see-it",
        heading: "Quién puede verlo",
        blocks: [
          { p: "Todos ven la fila y pueden cambiar **Tu idioma**. **Predeterminado de la empresa** necesita la capacidad de gestión de usuarios — el propietario, los administradores, los Gerentes y los Despachadores; cualquier otra persona ve el valor como texto. La misma regla se comprueba en el servidor, así que una píldora que no se dibuja no puede pulsarse por otros medios." },
        ],
      },
    ],
    faq: [
      { q: "Mi idioma muestra Interfaz 84 %. ¿Cómo se ve el otro 16 %?", a: "Esos rótulos aparecen en inglés. Todo lo que recibe un cliente sigue estando completamente en ese idioma — el porcentaje se refiere solo a sus propias pantallas." },
      { q: "¿Puede un cliente elegir su idioma?", a: "Usted lo define en la ficha del cliente. FieldQuo no se lo pregunta al cliente; usa el idioma guardado del cliente, luego el predeterminado de la empresa, luego el inglés." },
      { q: "¿Cambiar el predeterminado de la empresa traducirá un presupuesto antiguo?", a: "No. Un documento conserva el idioma en que se creó, y nada se traduce automáticamente al momento de enviar." },
    ],
  },

  "settings-activity-log": {
    title: "Registro de actividad",
    summary:
      "El rastro de auditoría de la empresa: quién hizo qué y cuándo — presupuestos enviados, pagos registrados, horas aprobadas, accesos cambiados — de solo lectura, del más reciente al más antiguo, para el propietario y los administradores.",
    updated: "2026-09-12",
    intro: [
      "El **Registro de actividad** está en el grupo **Negocio** y responde a la pregunta «¿quién cambió esto?». Cada entrada es una frase escrita en el momento en que ocurrió la acción, con el nombre de la persona, su rol y hace cuánto. Es un registro para consultar cuando algo parece raro, no un panel.",
      "Es de solo lectura por diseño y solo para el propietario y los administradores, porque muestra las acciones de todos los usuarios — pagos, cambios de tarifas de pago, quién desactivó a quién.",
    ],
    sections: [
      {
        id: "overview",
        heading: "Resumen",
        blocks: [
          { p: "El título dice **Registro de actividad — Un registro de las acciones importantes de tu cuenta — presupuestos enviados, pagos registrados, horas añadidas y aprobadas, gastos, cambios de clientes y de equipo, tarifas y ajustes.** Esa lista es una promesa que la página puede cumplir: cada una de esas familias escribe una entrada. Lo que *no* está en la página importa igual — sin filtro, sin búsqueda, sin exportación, y sin forma de editar o eliminar una entrada, porque un registro que se puede retocar no es un registro." },
        ],
      },
      {
        id: "what-is-on-the-screen",
        heading: "Qué hay en la pantalla",
        blocks: [
          { p: "Una sola lista, del más reciente al más antiguo, con las últimas 100 entradas. Cada fila muestra:" },
          { bullets: [
            "**Un punto de color** — rojo para una eliminación o un miembro desactivado, verde para un pago, azul para un envío, ámbar para un cambio de ajustes o una entrada de tiempo autoaprobada, gris para todo lo demás.",
            "**La frase** — «Cliente Jane Smith añadido», «Cotización Q-1041 duplicada como Q-1058».",
            "**Quién, rol y cuándo** — el nombre de quien actuó (o **Alguien** para una acción del sistema), su rol, y un tiempo relativo como «hace 4 min», que pasa a ser una fecha después de 30 días.",
            "**sesión de soporte** — un marcador ámbar en cualquier acción hecha durante una sesión de soporte de FieldQuo, para que nada hecho en su nombre se confunda con una acción suya.",
          ] },
          { figure: "harness:settings-activity", caption: "Configuración → Registro de actividad — la lista de entradas con un punto, la frase, y quién la hizo, su rol y cuándo." },
        ],
      },
      {
        id: "what-is-recorded",
        heading: "Qué se registra",
        blocks: [
          { table: {
            head: ["Familia", "Ejemplos"],
            rows: [
              ["Presupuestos y prospectos", "Presupuesto creado, enviado, duplicado, aprobado por un revisor; prospecto convertido"],
              ["Facturas y dinero", "Factura enviada, reclamada, pagada; tarifa de visita acreditada; exportación contable ejecutada"],
              ["Trabajos y tiempo", "Trabajo completado o eliminado; una entrada de tiempo aprobada — marcada cuando alguien aprobó la suya"],
              ["Personas", "Miembro invitado, acceso cambiado, desactivado; una política de ausencias retirada"],
              ["Clientes", "Cliente añadido, actualizado, eliminado"],
              ["Ajustes y conexiones", "Tarifas actualizadas; WhatsApp o una línea de SMS de la cuadrilla conectada; suscripción cancelada"],
            ],
          } },
        ],
      },
      {
        id: "reading-it",
        heading: "Leerlo en su idioma",
        blocks: [
          { p: "La frase se almacena en inglés en el momento de la acción. Las entradas más nuevas llevan además una clave de catálogo, y esas se muestran en el idioma de su interfaz; las más antiguas muestran exactamente lo que se escribió en su momento. Una lista mixta es el retrato honesto de la historia de la empresa, no uno retocado." },
          { note: "El registro traduce hacia adelante, nunca hacia atrás. Una entrada de marzo dice lo que decía en marzo." },
          { tip: "¿Busca un cambio concreto? La lista son las últimas 100 entradas sin casilla de búsqueda, así que use la búsqueda de su navegador (Ctrl+F o ⌘F) en la página." },
        ],
      },
      {
        id: "who-can-see-it",
        heading: "Quién puede verlo",
        blocks: [
          { p: "Solo el propietario y los administradores. La fila no se dibuja para un Gerente, un Despachador, un Estimador ni un miembro de la Cuadrilla, y la página responde **Only an owner or admin can view the activity log.** (una negativa del servidor, en inglés) a cualquier otra persona que llegue a su dirección. Una sesión de soporte de FieldQuo puede leerlo, y sus propias acciones quedan marcadas como tales." },
        ],
      },
    ],
    faq: [
      { q: "¿Puedo eliminar una entrada?", a: "No. Nada en la página edita ni quita una entrada, y no hay ruta que lo haga. Eso es lo que lo convierte en un rastro de auditoría." },
      { q: "¿Por qué una entrada antigua está en inglés y las nuevas en español?", a: "Las entradas más antiguas se almacenaron como una frase plana y se muestran tal cual. Las escritas desde que el registro aprendió a llevar una clave de traducción se muestran en su idioma." },
      { q: "¿Hasta dónde llega hacia atrás?", a: "La página muestra las 100 entradas más recientes. Nada se poda detrás, pero las entradas más antiguas hoy no se paginan en pantalla." },
    ],
  },

  "settings-team": {
    title: "Equipo",
    summary:
      "La fila Gestionar equipo en Configuración es la misma pantalla que Tu equipo en la barra lateral principal — el panel de licencias, la lista con el nivel de acceso de cada persona, Agregar usuario y las invitaciones pendientes.",
    updated: "2026-09-12",
    intro: [
      "**Gestionar equipo**, en **Equipo y horarios**, abre la misma página que **Tu equipo** en la barra lateral principal. Esta entrada breve dice qué hay en ella y dónde vive la guía completa: [[manage-team|Gestionar equipo]].",
    ],
    sections: [
      {
        id: "overview",
        heading: "Resumen",
        blocks: [
          { p: "El título dice **Gestionar equipo — Agrega o gestiona los miembros del equipo que necesitan iniciar sesión en FieldQuo en la oficina o en el campo.** Todo lo relativo a personas y accesos empieza aquí: invitar, elegir un nivel de acceso, reenviar o cancelar una invitación, y desactivar a alguien. Los niveles de acceso en sí se explican en [[access-levels-overview|Niveles de acceso: quién ve qué]]." },
        ],
      },
      {
        id: "what-is-on-the-screen",
        heading: "Qué hay en la pantalla",
        blocks: [
          { bullets: [
            "**Agregar usuario** arriba a la derecha, y bajo el panel de licencias **Agregar cuadrilla — sin costo** y **Agregar una licencia** — el acceso gratuito de cuadrilla y la licencia de pago, cada uno atenuado con una razón cuando se alcanza el tope del plan.",
            "**El panel de licencias** — cuántas **licencias usadas** frente al plan, y un conteo por nivel: Administradores, Encargados, Despachadores, Trabajadores, Cuadrilla, Acceso personalizado.",
            "**Pestañas** — **Trabajadores** y **Nómina** para el propietario y los administradores, **Hojas de tiempo** para cualquiera que pueda abrir la página.",
            "**La lista** — **Nombre / Correo**, **Rol** como un desplegable que puede cambiar para las personas por debajo de usted, **Último acceso**, y un interruptor de activo.",
            "**Las invitaciones pendientes** — cada una con **Invitado**, cuánto le queda al enlace, **Reenviar invitación** y **Cancelar invitación**.",
          ] },
          { figure: "live:app-settings-team", caption: "Configuración → Gestionar equipo — el panel de licencias, la lista con el rol de cada persona, y Agregar usuario." },
        ],
      },
      {
        id: "who-can-see-it",
        heading: "Quién puede verlo",
        blocks: [
          { p: "La fila necesita la capacidad de gestión de usuarios: el propietario, los administradores, los Gerentes y los Despachadores. Un Gerente o un Despachador puede invitar en el nivel Trabajador — Cuadrilla o Estimador — sin ningún dial por encima del suyo; cambiar el acceso de una persona existente, nombrar a un administrador y revocar accesos es solo para el propietario y los administradores. Todo el detalle: [[invite-a-team-member|Invitar a un miembro del equipo]] y [[deactivate-a-team-member|Desactivar a un miembro del equipo]]." },
        ],
      },
    ],
    faq: [
      { q: "¿Es una página distinta de Tu equipo?", a: "No — la misma página, dos puertas. El menú Configuración la lista junto a las demás filas de equipo; la barra lateral principal la lista bajo Personas." },
      { q: "¿Por qué falta Trabajadores en mis pestañas?", a: "Contiene las tarifas de pago, así que se dibuja solo para el propietario y los administradores; un Gerente no la ve. Ver [[payroll-settings|Configuración de nómina]]." },
    ],
  },

  "settings-your-hours": {
    title: "Tu horario",
    summary:
      "Dos semanas por persona en una sola pantalla: el Horario de trabajo, el turno que usan la agenda y las hojas de horas, y las Horas reservables, la franja que los clientes pueden reservar en la página pública — con un selector para definir el de otra persona.",
    updated: "2026-09-12",
    intro: [
      "La fila **Disponibilidad** abre una página titulada **Tu horario**, y es una de las tres filas de Configuración que ve cada miembro, porque estas horas son de la propia persona. Contiene dos semanas distintas a propósito: **Horario de trabajo**, el turno, y **Horas reservables**, la franja que un cliente puede reservar. Un estimador trabaja de 8 a 16 pero solo toma consultas de 14 a 16 porque las mañanas está en obra; una sola semana no puede decir eso.",
      "Alguien con acceso al equipo obtiene además un selector **Horario de quién** en la parte superior y puede definir las semanas de un compañero — así es como un miembro de la cuadrilla que nunca inicia sesión pasa a ser reservable.",
    ],
    sections: [
      {
        id: "overview",
        heading: "Resumen",
        blocks: [
          { p: "El subtítulo dice **Tu turno y tu ventana reservable son diferentes. Podría trabajar de 8 a 16 pero solo aceptar reservas de clientes de 14 a 16; configura ambas aquí.** La página avisa cuando la franja reservable cae fuera del turno, porque suele ser un error, pero lo permite, porque a veces no lo es." },
          { note: "Ninguna de las dos semanas es el horario de apertura de la empresa. Ese vive en **Configuración de la empresa** para que el día libre de una persona nunca se publique como que el taller está cerrado — ver [[opening-hours|Horario de apertura]]." },
        ],
      },
      {
        id: "what-is-on-the-screen",
        heading: "Qué hay en la pantalla",
        blocks: [
          { p: "De arriba abajo:" },
          { bullets: [
            "**Horario de quién** — un desplegable de miembros activos del equipo con **(tú)** junto a su propio nombre; se muestra solo a quienes pueden editar a otros. Elegir a otra persona retitula la página **Horario de …** y muestra la línea ámbar **Estás editando el horario de otra persona. Verá el cambio en su propio calendario.**",
            "**Horario de trabajo — Tu turno. Se usa para la programación y las hojas de horas. Nunca se muestra a los clientes.** Siete filas, cada una con una casilla y dos horas; un día sin marcar dice **No programado**.",
            "**Horas reservables — Cuándo los clientes pueden reservarte en tu calendario público y sitio web. Suele ser una franja más estrecha que tu turno.** Las mismas siete filas. Debajo, cuando no hay nada marcado: **Sin horas reservables, no aparecerás como opción en la página de reservas de tu empresa.**",
            "**Guardar horario** — fijado al pie de la pantalla para que quede al alcance en un teléfono bajo dos semanas completas; las dos semanas se guardan juntas.",
          ] },
          { figure: "live:app-settings-availability", caption: "Configuración → Disponibilidad — Horario de trabajo y Horas reservables, cada uno una semana de casillas y horas, con Guardar horario fijado debajo." },
        ],
      },
      {
        id: "how-to",
        heading: "Cómo definir su horario",
        blocks: [
          { steps: [
            "Abra **Configuración → Disponibilidad**. Si está definiendo el de un compañero, elíjalo en **Horario de quién**.",
            "En **Horario de trabajo**, marque los días del turno y defina inicio y fin de cada uno.",
            "En **Horas reservables**, marque los días en que un cliente puede reservar y defina una franja — normalmente más estrecha que el turno.",
            "Lea la línea ámbar si aparece: **Los clientes podrían reservarte cuando no estás trabajando:** seguida de los días y el motivo. Está permitido; solo verifique que sea intencional.",
            "Pulse **Guardar horario**. Un día cuyo fin no es posterior a su inicio se rechaza con **Corrige las horas resaltadas** hasta que se corrija.",
          ] },
          { tip: "¿Un nuevo empleado empieza el lunes? Defina su horario el día en que lo invite. Una persona sin horas reservables no se ofrece en la página de reservas, y una persona sin horario de trabajo no le da a la agenda ningún turno con el que comparar." },
        ],
      },
      {
        id: "what-each-week-changes",
        heading: "Qué cambia cada semana",
        blocks: [
          { table: {
            head: ["Semana", "Leída por"],
            rows: [
              ["Horario de trabajo", "La agenda, que avisa — nunca bloquea — cuando un turno cae fuera del patrón habitual; el período de nómina; y las ausencias, que descuentan solo los días de trabajo de la persona, así que una cuadrilla de martes a sábado no pierde saldo por un lunes."],
              ["Horas reservables", "La página de reservas pública y el calendario de reservas de su sitio web, que ofrecen a esta persona solo dentro de la franja; y la agenda, que rechaza un turno fuera de ella salvo que un gerente lo anule y registre por qué."],
            ],
          } },
          { warning: "Sin horas reservables definidas para nadie, la página de reservas no tiene a quién ofrecer y no muestra ningún turno. Por eso los pasos de configuración del panel apuntan aquí." },
        ],
      },
      {
        id: "who-can-see-it",
        heading: "Quién puede verlo",
        blocks: [
          { p: "Todos ven la fila y pueden definir sus propias dos semanas. El selector **Horario de quién**, y guardar para otra persona, necesitan la capacidad de gestión de usuarios — el propietario, los administradores, los Gerentes y los Despachadores. El servidor resuelve el destinatario de la misma manera, así que un selector que no se dibuja no puede alcanzarse por otra vía." },
        ],
      },
    ],
    faq: [
      { q: "¿Por qué yo tengo un selector Horario de quién y mi cuadrilla no?", a: "El selector se dibuja solo para quienes pueden editar a otros. Un miembro de la cuadrilla ve y edita solo su propia semana." },
      { q: "¿Estas horas cambian lo que mi sitio web dice sobre el horario de apertura?", a: "No. El horario de apertura es de la empresa, en Configuración de la empresa. Estas son suyas, y solo el calendario de reservas lee la semana reservable." },
      { q: "¿El horario de trabajo puede impedir que un gerente me programe un sábado?", a: "No — trabajar fuera del patrón habitual no es un error, es un martes. La agenda avisa y deja decidir al gerente. Lo que bloquea es la ausencia aprobada." },
    ],
  },

  "settings-time-off-policies": {
    title: "Políticas de ausencias",
    summary:
      "Qué tipos de ausencia existen en su empresa y cómo se acumula cada una — días fijos, acumulados por período de pago, o pago de vacaciones como porcentaje — con conjuntos iniciales por país y un traslado de fin de año que ejecuta usted mismo.",
    updated: "2026-09-12",
    intro: [
      "**Políticas de ausencias** define los *tipos* de ausencia que su equipo puede solicitar — vacaciones, enfermedad, personal, sin goce — y cómo se acumula el derecho. Las solicitudes, aprobaciones y saldos viven en otra parte, en la pantalla **Tiempo libre** de cada persona; esta página es el reglamento que hay detrás.",
      "Es la página del propietario y los administradores, porque una política es una condición laboral: cargar un conjunto inicial escribe saldos para cada trabajador de inmediato, y por eso nada aquí ocurre sin que usted pulse.",
    ],
    sections: [
      {
        id: "overview",
        heading: "Resumen",
        blocks: [
          { p: "El título dice **Políticas de tiempo libre — Qué tiempo libre puede tomar tu equipo y cómo se acumula. Las solicitudes y los saldos están en Tiempo libre.** Una nota al pie dice lo que FieldQuo es y no es: **Los mínimos legales varían según la provincia, el estado y la antigüedad … FieldQuo registra lo que configuras: no decide lo que debes.**" },
        ],
      },
      {
        id: "what-is-on-the-screen",
        heading: "Qué hay en la pantalla",
        blocks: [
          { p: "De arriba abajo:" },
          { bullets: [
            "**Empezar con el conjunto de Canadá** (o el de su propio país) — se muestra solo mientras no tenga ninguna política activa. La tarjeta encabeza con el conjunto del país de su perfil de empresa, con la insignia **Tu país**, y lista los demás bajo **¿Contratas en otro país? También están aquí.** Hay conjuntos iniciales para Canadá, Estados Unidos y el Reino Unido, cada uno diciendo qué asume y de qué año son sus cifras.",
            "**Políticas** con **Agregar política** — cada política activa como una tarjeta: nombre, **Días fijos por año** / **Se acumula en cada período de pago** / **Pago de vacaciones (% del bruto)**, el derecho, **traslado** y su tope, una insignia **sin goce** o **aprobado automáticamente**, **Editar** y un icono de quitar.",
            "**Retiradas** — políticas quitadas después de usarse, listadas como **no reservable** con su número de solicitudes anteriores.",
            "**Fin de año** — se muestra en cuanto existe una política: **Trasladar los saldos de … a …** del año pasado a este.",
          ] },
          { figure: "live:app-settings-leave", caption: "Configuración → Políticas de ausencias — el conjunto inicial de Canadá primero, los otros dos debajo, luego Políticas con Agregar política." },
        ],
      },
      {
        id: "add-a-policy",
        heading: "Cómo agregar una política",
        blocks: [
          { steps: [
            "Abra **Configuración → Políticas de ausencias**.",
            "Para partir de un conjunto, pulse la tarjeta de su país. FieldQuo agrega sus políticas y le dice cuántas, saltando las que ya existen con el mismo nombre.",
            "Para escribir la suya, pulse **Agregar política**. Póngale un **Nombre** y un **Tipo** — Vacaciones, Enfermedad, Personal, Sin goce, Otro.",
            "Elija **Cómo se acumula**: **Días fijos por año** (todo el derecho disponible ahora), **Se acumula en cada período de pago** (se gana poco a poco, así que es menor en enero) o **Pago de vacaciones (% del bruto)** (dinero, no días — el modelo canadiense del 4 %). Ingrese **Días por año** o **Porcentaje del bruto**.",
            "Defina el **Tope de traslado (días)** — **En blanco significa ilimitado. 0 significa úsalo o piérdelo.** — y marque **Con goce** y **Requiere la aprobación de un gerente** según corresponda.",
            "Pulse **Agregar política** (o **Guardar cambios** en una existente). Los saldos se acumulan para cada trabajador de inmediato.",
          ] },
          { note: "Quitar una política que alguna vez se usó no la elimina: se retira, conserva su historial y ya no puede reservarse. Una política nunca usada se elimina por completo. El diálogo de confirmación dice cuál de las dos cosas ocurrirá." },
        ],
      },
      {
        id: "what-each-field-changes",
        heading: "Qué cambia cada campo",
        blocks: [
          { table: {
            head: ["Campo", "Qué hace"],
            rows: [
              ["Tipo", "Cómo se etiqueta y agrupa la solicitud en Tiempo libre. No cambia el cálculo."],
              ["Días fijos por año", "La totalidad de los **Días por año** está disponible desde el inicio del año."],
              ["Se acumula en cada período de pago", "Los mismos **Días por año**, ganados por tramos al ritmo de la nómina — una solicitud en enero puede rechazarse por saldo insuficiente."],
              ["Pago de vacaciones (% del bruto)", "Acumula dinero en cada corrida de nómina en lugar de días; las ausencias bajo ella no están limitadas por un saldo de días."],
              ["Tope de traslado (días)", "Cuántos días sin usar sobreviven al traslado de fin de año. En blanco es ilimitado; 0 los borra."],
              ["Con goce", "Sin marcar, la política no lleva saldo de días — una ausencia sin goce siempre se permite y simplemente se registra — y los días no se pagan por nómina."],
              ["Requiere la aprobación de un gerente", "Marcada, una solicitud espera como pendiente a un gerente. Sin marcar, se aprueba en el momento en que se hace y el registro dice **aprobado automáticamente**."],
            ],
          } },
        ],
      },
      {
        id: "year-end",
        heading: "Fin de año",
        blocks: [
          { p: "Los saldos no se trasladan solos. Cuando considere cerrado el año pasado, pulse **Trasladar los saldos de … a …**: los días sin usar pasan al año nuevo, limitados por el tope de traslado de cada política, y la página informa cuántos saldos tocó — o **Nada era elegible para trasladar.**" },
          { tip: "Ejecútelo una vez, después de aprobar la última solicitud del año viejo. Ejecutarlo otra vez no encuentra nada elegible y no cambia nada." },
        ],
      },
      {
        id: "who-can-see-it",
        heading: "Quién puede verlo",
        blocks: [
          { p: "Solo el propietario y los administradores. La fila no se dibuja para nadie más, y la ruta responde **Only an owner or admin can manage leave policies.** (una negativa del servidor, en inglés) a cualquier otro miembro. Las solicitudes y saldos de una persona están en su pantalla **Tiempo libre**, que esta regla no toca — ver [[time-off-policies|Políticas de ausencias]] en Equipo y acceso para el lado de las solicitudes." },
        ],
      },
    ],
    faq: [
      { q: "¿Cargar el conjunto de Canadá me deja en regla?", a: "No. Los conjuntos son puntos de partida comunes con el año de sus cifras, no asesoría de cumplimiento. Los mínimos suben con los años de servicio en varias provincias; ajuste por persona." },
      { q: "¿Cuál es la diferencia entre Días fijos y Se acumula en cada período de pago?", a: "La misma cifra anual, disponible toda de una vez o ganada poco a poco. Con acumulación, alguien que pide dos semanas en enero puede no haberlas ganado todavía." },
      { q: "Una política que quité sigue apareciendo en Retiradas. ¿Por qué?", a: "Tenía solicitudes. FieldQuo conserva el historial y detiene las nuevas reservas en lugar de eliminar un registro al que apuntan solicitudes anteriores." },
    ],
  },

  "settings-booking-page": {
    title: "Página de reservas",
    summary:
      "Todo lo que hay detrás del calendario de reservas público: el código para insertar, cómo pueden reunirse los clientes con usted, la comprobación de tiempo de viaje y el margen, la ventana de llegada, la duración predeterminada de la visita, la política de cambios y cancelaciones, y los tipos de evento con sus tarifas.",
    updated: "2026-09-12",
    intro: [
      "**Página de reservas** configura lo que ve un propietario cuando reserva una visita desde su sitio web, su enlace para la bio o la propia dirección de reservas. El subtítulo dice **Tipos de eventos que los clientes pueden reservar directamente desde tu página pública.**, y la página va desde el código que pone el calendario en su sitio hasta una tarjeta por tipo de evento.",
      "Dos reglas le dan forma. Los horarios ofrecidos salen de las horas reservables de cada persona, no de aquí; esta página decide cómo se filtran, describen y cobran esos horarios. Y cada control se guarda en el momento en que lo cambia — no hay un botón de guardar para toda la página.",
    ],
    sections: [
      {
        id: "overview",
        heading: "Resumen",
        blocks: [
          { p: "La página se carga solo cuando el registro de la empresa responde; si no puede, se niega en lugar de mostrar valores predeterminados inventados, porque la última tarjeta imprime sus condiciones de cancelación como una frase y una frase equivocada sobre su propia política es peor que ninguna. Lo que ven los clientes del otro lado se describe en [[the-booking-page|La página de reservas]]." },
        ],
      },
      {
        id: "what-is-on-the-screen",
        heading: "Qué hay en la pantalla",
        blocks: [
          { p: "De arriba abajo, con **Nuevo tipo de evento** arriba a la derecha:" },
          { table: {
            head: ["Tarjeta", "Qué contiene"],
            rows: [
              ["Pon tu calendario de reservas en tu sitio web", "El fragmento de código para insertar y **Copiar código**. Un elemento HTML corriente que funciona en Wix, Squarespace, WordPress y páginas escritas a mano — ver [[embed-booking-and-quote-forms|Insertar formularios de reserva y de presupuesto]]."],
              ["¿Cuánto dura una visita?", "**¿Cómo pueden reunirse contigo los clientes?** (Ir a su domicilio · Llamada telefónica · Videollamada), **No ofrezcas horarios a los que no puedas llegar en auto** con **Tiempo extra entre trabajos** (Ninguno a 60 min), **¿Qué le prometes al cliente?** (Hora exacta, ± 15, ± 30, ± 60 min) con una línea de vista previa, y la duración predeterminada de 15 a 180 min."],
              ["Cambios y cancelaciones", "**Aviso que necesita para cambiar o cancelar** en horas, **Devolver la tarifa de visita si cancelan a tiempo** (desactivado por defecto), **Aviso necesario para recuperar la tarifa**, y dos frases que enuncian la política tal como la leerá un cliente."],
              ["Una tarjeta por tipo de evento", "Nombre y ubicación, **Duración**, una casilla **Activo**, **Tarifa de visita** (en blanco es **Gratis**), y para una tarifa, **Precio promo** con **Promo activada**. Una tarifa sin Stripe conectado muestra **Conecta Stripe para cobrar esta tarifa — configúralo en Pagos**."],
              ["Formulario Nuevo tipo de evento", "**Nombre (p. ej. consulta a domicilio)**, **Minutos**, **Margen antes**, **Margen después**, **Ubicación (opcional)**, **Crear**."],
            ],
          } },
          { figure: "live:app-settings-booking-page", caption: "Configuración → Página de reservas — el código para insertar, la tarjeta ¿Cuánto dura una visita? con los modos de reunión, la comprobación de viaje y la ventana de llegada, luego Cambios y cancelaciones." },
        ],
      },
      {
        id: "add-an-event-type",
        heading: "Cómo agregar un tipo de evento",
        blocks: [
          { steps: [
            "Abra **Configuración → Página de reservas** y pulse **Nuevo tipo de evento**.",
            "Escriba un **Nombre** que el cliente entienda — «Consulta a domicilio», «Visita de medición» — la duración en **Minutos**, cualquier **Margen antes** y **Margen después** en minutos, y una **Ubicación** opcional. Pulse **Crear**.",
            "En la tarjeta nueva, defina una **Tarifa de visita** si reservar el turno debe costar algo; déjela en blanco para **Gratis**. El importe va en su moneda de facturación y se guarda al salir de la casilla.",
            "Para una tarifa, ingrese opcionalmente un **Precio promo** y marque **Promo activada** para ofrecerla al precio más bajo por ahora.",
            "Deje **Activo** marcado. Desmárquelo para quitar el tipo de la página pública sin eliminarlo.",
          ] },
          { note: "Sin tipos de evento, la página dice **Aún no hay tipos de evento — los clientes no pueden reservar nada hasta que agregues uno.** — y el calendario público no tiene nada que ofrecer. Las tarifas de visita se cobran a través de su propia cuenta de Stripe; ver [[booking-fees-and-visit-deposits|Tarifas de reserva y anticipos de visita]]." },
        ],
      },
      {
        id: "what-each-control-changes",
        heading: "Qué cambia cada control",
        blocks: [
          { bullets: [
            "**¿Cómo pueden reunirse contigo los clientes?** — elija todo lo que ofrece. Con un solo modo no se le pregunta al cliente; con dos o más, elige al reservar. Solo una visita pide una dirección y recibe una ventana de llegada.",
            "**No ofrezcas horarios a los que no puedas llegar en auto** — activado, la dirección del cliente se geocodifica y se ocultan los turnos a los que no podría llegar a tiempo desde el trabajo anterior. Desactivado, se ofrece cada turno reservable sin importar la distancia.",
            "**Tiempo extra entre trabajos** — minutos que se suman al viaje para estacionar, descargar y redactar. Empieza en **Ninguno** porque adivinar en su nombre quita turnos que usted nunca aceptó ceder.",
            "**¿Qué le prometes al cliente?** — **Hora exacta**, o una ventana de ± 15, 30 o 60 minutos. Su propia agenda conserva la hora exacta de todos modos; solo cambia lo que se le dice al cliente, y la línea de vista previa lo muestra («entre 1:30 y 2:30 PM»). Ver [[arrival-windows-and-travel-buffer|Ventanas de llegada y margen de viaje]].",
            "**¿Cuánto dura una visita?** — la duración de cualquier consulta que FieldQuo crea automáticamente cuando alguien agrega su disponibilidad, y el valor predeterminado del formulario de tipo nuevo. Las reservas existentes conservan la duración con la que se hicieron.",
            "**Aviso que necesita para cambiar o cancelar** — dentro de ese número de horas el cliente ya no puede mover ni cancelar la visita por su cuenta y tiene que llamarle. En blanco se lee como 24, nunca 0.",
            "**Devolver la tarifa de visita si cancelan a tiempo** — desactivado, una tarifa pagada se queda con usted pase lo que pase; activado, se devuelve por una cancelación hecha con aviso suficiente. **Aviso necesario para recuperar la tarifa** puede ser mayor que el aviso de cambio, y en blanco significa el mismo aviso.",
            "**Duración**, **Activo**, **Tarifa de visita**, **Precio promo**, **Promo activada** en cada tipo de evento — cambian el tipo de aquí en adelante; las reservas ya hechas conservan su duración y el precio al que se hicieron.",
          ] },
          { warning: "Un aviso de devolución más corto que el aviso de cambio significa que toda cancelación que el cliente aún pueda hacer por su cuenta devuelve también la tarifa; la página lo dice en ámbar. Ponga el aviso de devolución igual o mayor si quiere un margen en el que puedan cancelar pero la tarifa se quede con usted." },
        ],
      },
      {
        id: "who-can-see-it",
        heading: "Quién puede verlo",
        blocks: [
          { p: "La fila necesita la capacidad de gestión de usuarios: el propietario, los administradores, los Gerentes y los Despachadores. Todos los demás reciben un panel de sin acceso en lugar de un formulario, porque nada de aquí es información que necesite un miembro de la cuadrilla — sus propias horas reservables están en **Disponibilidad**, que sigue siendo visible para ellos. Cada escritura se rechaza en el servidor para las mismas personas." },
        ],
      },
    ],
    faq: [
      { q: "¿De dónde salen los horarios que puede elegir un cliente?", a: "De las Horas reservables de cada miembro del equipo en Disponibilidad, filtradas por la comprobación de tiempo de viaje, el margen y la duración del tipo de evento de esta página. Sin horas reservables, no hay turnos." },
      { q: "¿Puedo cobrar una tarifa de visita sin Stripe?", a: "No. La tarifa se cobra a través de su cuenta de Stripe conectada; hasta que los cobros estén habilitados, la tarjeta muestra Conecta Stripe para cobrar esta tarifa y la tarifa no se cobra." },
      { q: "¿La ventana de llegada mueve mi cita?", a: "No. Su agenda conserva la hora exacta. La ventana solo cambia lo que se le dice al cliente — «entre 1:30 y 2:30 PM» en lugar de 2:00 PM." },
      { q: "¿Qué pasa con una tarifa de visita cuando un cliente cancela?", a: "Nada, salvo que haya activado Devolver la tarifa de visita si cancelan a tiempo — entonces se devuelve cuando la cancelación cumple el aviso de devolución. La cancelación en sí se procesa de todos modos." },
    ],
  },
};
