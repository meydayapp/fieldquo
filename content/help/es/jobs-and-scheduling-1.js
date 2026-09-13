// content/help/es/jobs-and-scheduling-1.js
//
// Parte 1 de la categoría “jobs-and-scheduling” en español (ver el
// compositor, jobs-and-scheduling.js). Slugs de esta parte (lib/help/tree.js):
// the-jobs-list, create-a-job, the-job-page, visits-and-appointments,
// the-appointments-calendar, book-a-visit-for-a-client,
// arrival-windows-and-travel-buffer, appointment-reminders,
// the-on-my-way-text, clients-rescheduling-and-cancelling.
//
// Misma estructura que el módulo inglés (mismas secciones, mismos bloques,
// mismas figuras). Las palabras de la pantalla vienen del bloque `es` de
// app/i18n/appMessages.js; los pocos rótulos que siguen en inglés en el
// código (el formulario de visita, los botones de estado de una visita,
// cuatro títulos de tarjeta, los dos editores de mensajes) se citan tal como
// los muestra la pantalla.
export const ARTICLES = {
  "the-jobs-list": {
    title: "La lista de trabajos",
    summary:
      "Todos los trabajos de su empresa en una sola pantalla — filtrados por estado, buscados por título o por cliente, con el archivo detrás de su propio botón.",
    updated: "2026-09-12",
    intro: [
      "**Trabajos** es la lista del trabajo que su empresa se comprometió a hacer: cada trabajo, del más reciente al más antiguo, con su estado, su cliente y cuántas visitas tiene. La mayoría llegan aquí por sí solos en cuanto un cliente aprueba un presupuesto; el resto los inicia usted a mano con **Nuevo trabajo**.",
      "En esta lista la oficina responde “¿qué sigue sin fecha?” y la cuadrilla encuentra la dirección a la que va. Lo que cada uno ve depende de su nivel de acceso — la misma lista, recortada.",
    ],
    sections: [
      {
        id: "overview",
        heading: "Resumen",
        blocks: [
          { p: "Un trabajo es trabajo programado en la dirección de un cliente. Se sitúa entre el presupuesto (lo acordado) y la factura (lo que se cobra): un presupuesto aprobado hace aparecer un trabajo en **Falta fecha**; usted lo programa, lo hace, lo pasa a **Completado**, y la factura y la solicitud de reseña vienen detrás — vea [[when-a-job-is-completed|Cuando un trabajo se completa]]." },
          { p: "La lista en sí no guarda detalles. Cada fila abre [[the-job-page|la página del trabajo]], donde viven las visitas, los materiales, las fotos, las notas y el costeo." },
        ],
      },
      {
        id: "on-the-screen",
        heading: "Qué hay en la pantalla",
        blocks: [
          { bullets: [
            "**Trabajos — Trabajos programados y en curso.** Arriba a la derecha, **Trabajos anteriores** (el historial de su sistema anterior — vea [[import-past-jobs|Importar trabajos anteriores]]) y **Nuevo trabajo**.",
            "Las etiquetas de estado: **Todos**, **Falta fecha**, **Programado**, **En curso**, **Completado**, **Cancelado**. Solo una está activa a la vez.",
            "Tras un separador, el botón **Archivados**. No es un estado: cambia la lista por los trabajos que usted guardó en el archivo.",
            "**Buscar trabajos...** — filtra por el título del trabajo o el nombre del cliente mientras escribe.",
            "Una fila por trabajo: el título, una etiqueta de estado, una etiqueta **Recurrente** en un trabajo que se repite, el nombre del cliente y “3 visits” cuando ya tiene visitas programadas.",
            "Una lista vacía dice por qué está vacía. Un filtro o una búsqueda sin resultados muestra **No hay trabajos en esta vista.**; una empresa recién creada lee que los trabajos se crean automáticamente cuando se acepta un presupuesto; un miembro de la cuadrilla sin asignaciones lee **Ahora mismo no estás en ningún trabajo.**",
          ] },
          { figure: "live:app-jobs", caption: "Trabajos — las etiquetas de estado, el botón Archivados, la búsqueda, y un trabajo recién salido de un presupuesto aceptado en Falta fecha." },
        ],
      },
      {
        id: "find-a-job",
        heading: "Cómo encontrar un trabajo",
        blocks: [
          { steps: [
            "Abra **Trabajos** en la barra lateral, bajo Trabajo.",
            "Pulse una etiqueta de estado para recortar la lista. **Falta fecha** es la que hay que vaciar cada mañana: un trabajo que está ahí no tiene todavía ni visita ni fechas de trabajo.",
            "Escriba parte del título o del nombre del cliente en **Buscar trabajos...**; la lista se filtra mientras escribe, dentro de la etiqueta elegida.",
            "Pulse la fila. Se abre la página del trabajo; **Volver a los trabajos** lo trae de regreso aquí.",
          ] },
          { tip: "Un trabajo que no aparece bajo ninguna etiqueta probablemente está archivado. Pulse **Archivados**: ese cajón es independiente de las etiquetas de estado, así que un trabajo puede estar Completado y archivado al mismo tiempo." },
        ],
      },
      {
        id: "what-each-control-changes",
        heading: "Qué cambia cada control",
        blocks: [
          { table: {
            head: ["Control", "Qué hace"],
            rows: [
              ["Etiquetas de estado", "Filtran la lista cargada por estado. No cambian nada en el trabajo — el estado se cambia en la página del trabajo."],
              ["Archivados", "Carga los trabajos archivados en lugar de los activos. Nunca se muestran los dos cajones a la vez. Un trabajo se archiva o se restaura desde su propia página."],
              ["Buscar trabajos...", "Recorta por título o nombre de cliente. Borre el texto para ver todo de nuevo."],
              ["Nuevo trabajo", "Abre el formulario de trabajo — vea [[create-a-job|Crear un trabajo]]. Solo lo ven las personas cuyo acceso permite crear trabajos."],
              ["Trabajos anteriores", "Abre la importación de trabajos anteriores. Misma regla de acceso que Nuevo trabajo."],
              ["Una fila", "Abre la página del trabajo. Las filas van del trabajo más reciente al más antiguo, sea cual sea el estado."],
            ],
          } },
        ],
      },
      {
        id: "who-can-see-it",
        heading: "Quién puede verla",
        blocks: [
          { p: "La fila **Trabajos** aparece para cualquiera cuyo acceso a Trabajos sea al menos “View only”; alguien puesto en “No access” no tiene la fila y la página lo rechaza. El perfil Cuadrilla (Crew) está en “View only”, pero acotado: un miembro de la cuadrilla ve solo los trabajos con una visita asignada a él, y un trabajo sin visita todavía no es de nadie y no aparece. Los estimadores ven todos los trabajos pero no pueden crear ni cambiar ninguno. Los despachadores crean y editan; los gerentes, los administradores y el propietario también pueden eliminar. Los perfiles se describen en [[access-levels-overview|Niveles de acceso: quién ve qué]]." },
          { note: "Ocultar el botón no es la regla — el servidor revisa el mismo acceso en cada solicitud. Una persona que llega al formulario Nuevo trabajo por un marcador viejo sin el nivel adecuado lee **Tu nivel de acceso te permite ver trabajos, no crearlos.**" },
        ],
      },
    ],
    faq: [
      { q: "¿Por qué a mi empleado le falta un trabajo?", a: "Un miembro de la cuadrilla solo ve los trabajos con una visita asignada a él. Programe una visita en el trabajo con su nombre y aparece de inmediato en su lista." },
      { q: "¿Archivados significa cancelado?", a: "No. Cancelado es un estado; archivado es si usted todavía quiere ver el trabajo. Un trabajo terminado que guarda en el archivo sigue Completado, y Restaurar en su página lo devuelve a la lista activa." },
      { q: "¿Puedo ordenar o exportar la lista?", a: "No desde esta pantalla. El orden es fijo, del más reciente al más antiguo, y aquí no hay exportación — el historial de trabajos anteriores viaja en sentido contrario, hacia FieldQuo, por Trabajos anteriores." },
    ],
  },

  "create-a-job": {
    title: "Crear un trabajo",
    summary:
      "De dónde salen los trabajos — un presupuesto aprobado, una factura o el formulario Nuevo trabajo — y qué hace cada campo del formulario.",
    updated: "2026-09-12",
    intro: [
      "Rara vez necesita crear un trabajo a mano. En cuanto un cliente aprueba un presupuesto, FieldQuo crea el trabajo por usted en **Falta fecha**, un trabajo por presupuesto, con el cliente y el presupuesto ya vinculados. El formulario **Nuevo trabajo** es para el resto: trabajo acordado por teléfono, una visita de garantía, un cliente que nunca tuvo presupuesto.",
      "Este artículo cubre las tres puertas de entrada y cada campo del formulario.",
    ],
    sections: [
      {
        id: "overview",
        heading: "Resumen",
        blocks: [
          { p: "Un trabajo necesita dos cosas para existir: un cliente y un título. Todo lo demás — la dirección del sitio, si se repite, si es un regreso — es opcional, y la fecha deliberadamente no está en este formulario. Un trabajo nuevo cae en **Falta fecha** y recibe su fecha en la página del trabajo, ya sea programando una visita o fijando el inicio y el fin del trabajo. Vea [[the-job-page|La página del trabajo]]." },
          { p: "Las tres formas de crear un trabajo: automáticamente desde un presupuesto aprobado ([[convert-a-quote-to-a-job|Qué pasa cuando se aprueba un presupuesto]]); desde una factura que todavía no tiene trabajo detrás, con **Crear el trabajo** en el panel **El trabajo** de la factura; y a mano con **Nuevo trabajo**." },
        ],
      },
      {
        id: "by-hand",
        heading: "Cómo crear un trabajo a mano",
        blocks: [
          { steps: [
            "Abra **Trabajos** y pulse **Nuevo trabajo**.",
            "Bajo **Cliente**, busque y elija al cliente. Si todavía no existe, **Agregar uno** abre la ficha de cliente; un trabajo no se puede guardar sin cliente.",
            "Escriba un **Título del trabajo** — el ejemplo sugerido es “p. ej. Restauración de gabinetes de cocina”.",
            "Llene **Dirección del sitio** solo si el trabajo se hace en un lugar distinto de la dirección del cliente. En blanco significa la dirección del cliente, y esa dirección se usa para decir a qué distancia del sitio estaba la cuadrilla al marcar entrada.",
            "Marque **Este es un trabajo recurrente** si el trabajo se repite y elija **Semanal**, **Cada 2 semanas** o **Mensual** bajo **Recurrencia**. La casilla no se guarda sin frecuencia.",
            "Pulse **Crear trabajo**. Se abre la página del trabajo, en **Falta fecha**.",
          ] },
          { figure: "create:app-jobs-create", caption: "Nuevo trabajo — el selector de cliente, el título, la dirección del sitio opcional y la casilla de recurrencia." },
          { note: "Un trabajo iniciado desde la ficha de un cliente llega con el cliente ya elegido. Un trabajo iniciado con **Registrar un trabajo de regreso** desde otro trabajo llega titulado “Regreso: …” y pregunta **¿Por qué vuelves?** antes de guardarse." },
        ],
      },
      {
        id: "the-fields",
        heading: "Qué hace cada campo",
        blocks: [
          { table: {
            head: ["Campo", "Qué cambia"],
            rows: [
              ["Cliente", "Obligatorio. El trabajo lleva el nombre, el teléfono, el correo y la dirección del cliente a su página y a cada visita."],
              ["Título del trabajo", "Obligatorio. Es lo que muestran la lista, el calendario y la sala de chat del trabajo."],
              ["Dirección del sitio", "Opcional. Una vez fijada, FieldQuo la ubica en un mapa para que las marcas de entrada y los botones Voy en camino / Marcar como completada puedan decir a qué distancia del sitio estaba la persona. Si la dirección no se puede ubicar, la página del trabajo lo dice y le pide revisarla."],
              ["Este es un trabajo recurrente + Recurrencia", "Marca el trabajo como **Recurrente** y, en cuanto existe una primera visita, mantiene exactamente una visita próxima en el calendario a ese ritmo — vea [[recurring-jobs|Trabajos recurrentes]]."],
              ["¿Por qué vuelves?", "Solo en un trabajo de regreso. Obligatorio, de una lista fija de motivos; el regreso cuenta en la tasa de retrabajo/regresos del tablero de indicadores y queda enlazado desde el trabajo original."],
            ],
          } },
        ],
      },
      {
        id: "who-can-create",
        heading: "Quién puede crear un trabajo",
        blocks: [
          { p: "Crear un trabajo exige el acceso a Trabajos “View, create, and edit” o superior — los perfiles Despachador y Gerente, los administradores y el propietario. Los estimadores y la cuadrilla ven la lista pero no el botón **Nuevo trabajo**, y el propio formulario los rechaza con **Tu nivel de acceso te permite ver trabajos, no crearlos.** El mismo nivel rige **Crear el trabajo** en una factura." },
        ],
      },
    ],
    faq: [
      { q: "¿Tengo que crear un trabajo cuando se aprueba un presupuesto?", a: "No. FieldQuo lo hace por usted, una vez por presupuesto, y aparece en Falta fecha. Crear otro a mano le daría dos trabajos para un solo presupuesto." },
      { q: "¿Dónde pongo la fecha?", a: "En la página del trabajo. Con Programar una visita (un viaje al sitio con una persona) o con Definir fechas (el inicio y el fin del trabajo). Cualquiera de los dos pasa el trabajo de Falta fecha a Programado." },
      { q: "¿Puedo vincular un presupuesto a un trabajo creado a mano?", a: "No desde el formulario — el vínculo con el presupuesto se crea cuando el trabajo nace del presupuesto. Parta del presupuesto si necesita el vínculo." },
    ],
  },

  "the-job-page": {
    title: "La página del trabajo",
    summary:
      "Todo lo de un trabajo en una sola página: estado, fechas, cliente, costeo, materiales, tareas, documentos, parte diario, visitas y registro fotográfico.",
    updated: "2026-09-12",
    intro: [
      "La página del trabajo está hecha para la persona parada en la entrada de la casa: quién, dónde, cuándo y qué falta. También es donde la oficina cambia el estado del trabajo, programa visitas y lee lo que el trabajo ha costado. El orden de las tarjetas es intencional — lo que necesita antes de salir va primero, el trabajo en sí en medio, la evidencia al final.",
      "No todas las tarjetas se muestran a todos. Varias se ocultan cuando no tienen nada, y la tarjeta de costeo solo la ven las personas con el interruptor Job costing.",
    ],
    sections: [
      {
        id: "overview",
        heading: "Resumen",
        blocks: [
          { p: "Abra cualquier fila de **Trabajos** y llega aquí. El título y una etiqueta de estado van arriba, con “From quote Q-2026-0003” debajo cuando el trabajo salió de un presupuesto, una etiqueta **Archivados** cuando está guardado en el archivo, y **Registrado como trabajo pasado el … — no se envió ningún mensaje.** en un trabajo importado de su sistema anterior." },
        ],
      },
      {
        id: "top-of-the-page",
        heading: "Los controles de arriba",
        blocks: [
          { bullets: [
            "El desplegable **Estado** — **Falta fecha**, **Programado**, **En curso**, **Completado**, **Cancelado**. Pasar a Completado sella la hora de finalización, crea dos tareas (“Ask … for a review” y “Review what … actually cost”) y, si las solicitudes de reseña están activadas, echa a andar el reloj de la solicitud de reseña automática — vea [[when-a-job-is-completed|Cuando un trabajo se completa]]. Salir de Completado borra el sello.",
            "**Editar** — el **Título**, el **Estado**, las **Fechas del trabajo** (**Fecha de inicio** y **Fecha de fin**), la **Dirección del sitio** y **Este trabajo se repite** con **Con qué frecuencia**.",
            "**Archivar** / **Restaurar** — guarda el trabajo en el archivo sin cambiar su estado; el mismo botón lo deshace. Vea [[cancel-or-archive-a-job|Cancelar o archivar un trabajo]].",
            "**Eliminar** — quita el trabajo y sus visitas para siempre; el presupuesto y cualquier factura se quedan. Un trabajo que ya tiene horas registradas o tareas no se puede eliminar: la página dice qué tiene vinculado y sugiere cancelarlo en su lugar.",
            "El aviso morado **Este trabajo necesita una fecha — programa una visita o establece las fechas de inicio y fin del trabajo.**, con **Definir fechas** y **Programar una visita**, hasta que el trabajo tenga lo uno o lo otro.",
          ] },
        ],
      },
      {
        id: "needs-a-date",
        heading: "Darle fecha al trabajo",
        blocks: [
          { p: "Un trabajo recién salido de un presupuesto no tiene fecha. Hay dos formas honestas de dársela, y ambas pasan el estado a **Programado** por sí solas: una visita, que es un viaje a la dirección con una fecha y una persona; o las propias **Fecha de inicio** y **Fecha de fin** del trabajo, para una repintada de dos semanas que no tiene un viaje concreto del cual colgar una fecha." },
          { steps: [
            "Pulse **Programar una visita** para reservar un viaje — vea [[book-a-visit-for-a-client|Reservar una visita para un cliente]].",
            "O pulse **Definir fechas**, llene **Fecha de inicio** y, si la conoce, **Fecha de fin**, y luego **Guardar cambios**. La página muestra entonces **Trabajo programado: Sep 14, 2026 – Sep 25, 2026**, o “aún sin fecha de fin”.",
            "Una visita programada fuera de esas fechas recibe la etiqueta **Fuera de las fechas del trabajo** — un aviso, nunca un bloqueo, porque una visita previa o una visita de garantía suele ir fuera de ellas a propósito.",
          ] },
        ],
      },
      {
        id: "the-cards",
        heading: "Las tarjetas, de arriba abajo",
        blocks: [
          { table: {
            head: ["Tarjeta", "Qué contiene"],
            rows: [
              ["Avisos de regreso", "**Este trabajo es un regreso** con el motivo y un enlace al original; o **Trabajos de regreso por este**, con la lista de regresos programados a partir de él."],
              ["Calendario de pagos", "Las etapas acordadas en el presupuesto y lo que cada una ha cobrado. Solo si su empresa usa un calendario de pagos."],
              ["Cliente", "**Nombre**, **Teléfono** (toque para llamar), **Dirección** (toque para abrir el mapa), **Correo** y **Dirección del sitio** cuando difiere. Un miembro de la cuadrilla limitado a nombre y dirección lee **Oculto según tu nivel de acceso** donde irían el teléfono y el correo."],
              ["Lo que ha costado este trabajo", "Lo presupuestado contra lo real — mano de obra, materiales, gastos, subcontratistas. Solo para personas con el interruptor Job costing. Vea [[job-costing|Costeo de trabajos: presupuestado contra real]]."],
              ["Subcontratistas en este trabajo", "Los subcontratistas contratados a precio fijo en este trabajo, sus montos acordados y sus pagos."],
              ["Órdenes de cambio", "Cambios de alcance acordados después de aceptado el presupuesto, registrados a propósito y no deducidos de una edición."],
              ["Materials to buy", "La lista de compra y lo que ya se compró — vea [[materials-on-a-job|Materiales en un trabajo]]."],
              ["Equipos usados", "Cuáles de sus propios equipos fueron al trabajo."],
              ["Tareas de este trabajo", "Las tareas vinculadas al trabajo — vea [[tasks|Tareas]]."],
              ["Documentos", "Planos, permisos, garantías; una revisión nueva nunca sobrescribe la anterior."],
              ["Parte diario", "Lo que realmente pasó, una fila por día — la visita es lo planeado; esto es lo que salió de ella. Vea [[job-notes|Notas en un trabajo]]."],
              ["Visitas", "Cada visita con su fecha, su etiqueta, la persona asignada, el conteo de la lista de verificación y de fotos, los botones de estado y la lista — vea más abajo."],
              ["Tasks from the notes", "Lee las notas del cliente, del presupuesto y de las visitas y sugiere tareas; nada se agrega sin que usted lo acepte. Vea [[suggested-tasks|Tareas sugeridas]]."],
              ["Photo record y Job photos", "Cada foto archivada y fechada por etapa, y luego el subconjunto elegido para su sitio web. Vea [[job-photos-and-tags|Fotos del trabajo y etiquetas]]."],
            ],
          } },
        ],
      },
      {
        id: "visits-on-the-job",
        heading: "Las visitas del trabajo",
        blocks: [
          { p: "La tarjeta **Visitas** dice “2 of 3 complete” y ofrece **Agregar visita** y **Registrar un trabajo de regreso**. Cada visita muestra su fecha y hora, una etiqueta (**Programado**, **En camino**, **Completado**, **Cancelado**), “Assigned to Dave” o “Unassigned”, el avance de la lista de verificación, el número de fotos y dónde estaba el teléfono al pulsar — **Llegó a 12 m del sitio**." },
          { bullets: [
            "**Voy en camino** — pasa la visita a En camino y le envía un mensaje al cliente; la línea bajo los botones dice a qué número va. Vea [[the-on-my-way-text|El mensaje “En camino”]].",
            "**Marcar como completada** — marca la visita como hecha. En un trabajo recurrente pone la siguiente visita en el calendario de inmediato.",
            "**Cancelar visita** — cancela solo esta visita; el estado del trabajo no cambia.",
            "**Reopen** en una visita completada, y **Put it back on** en una cancelada, la devuelven a Programado — un toque en falso en el teléfono no debe ser permanente.",
            "La lista de verificación bajo cada visita es la copia marcable de la cuadrilla — vea [[checklists-on-site|Listas de verificación en la obra]].",
          ] },
          { note: "Los botones de estado aparecen solo para la persona a la que está asignada la visita, para cualquiera en una visita sin asignar y para las personas cuyo acceso a Horario es “Edit everyone's schedule”. Los demás ven la etiqueta y ningún botón — el servidor rechaza el cambio de todos modos." },
        ],
      },
      {
        id: "who-can-see-it",
        heading: "Quién puede ver qué",
        blocks: [
          { p: "Cualquiera con acceso a Trabajos “View only” o superior abre la página; la cuadrilla abre solo los trabajos en los que tiene una visita. El desplegable **Estado**, **Editar** y **Archivar** aparecen en “View, create, and edit”; **Eliminar** en “View, create, edit, and delete”. La tarjeta de costeo exige el interruptor **Job costing**, que el perfil Gerente tiene y el Despachador no." },
          { p: "Programar una visita es cuestión de horario, no de trabajos: un miembro de la cuadrilla puede agregar una visita a su propio trabajo, pero poner el nombre de otra persona exige un propietario, un administrador o un supervisor." },
        ],
      },
    ],
    faq: [
      { q: "¿Por qué mi cuadrilla no puede cambiar el estado?", a: "El perfil Cuadrilla ve los trabajos; no los edita. El desplegable de estado, Editar y Archivar están ocultos en ese nivel porque el servidor los rechazaría. La cuadrilla mueve sus visitas — Voy en camino, Marcar como completada — que es para lo que sirve la página en la obra." },
      { q: "Falta la tarjeta de costeo.", a: "Solo la ven las personas con el interruptor Job costing activado, y se oculta hasta que se registra algo contra el trabajo. El propietario, los administradores y el perfil Gerente tienen el interruptor." },
      { q: "¿Qué pasa cuando marco el trabajo como Completado?", a: "Se crean dos tareas — pedirle una reseña al cliente y revisar lo que el trabajo costó en realidad — la revisión de costos se abre sola una vez, y la solicitud de reseña automática sale según su horario si usted la activó." },
    ],
  },

  "visits-and-appointments": {
    title: "Visitas y citas",
    summary:
      "Los tres tipos de entrada de su calendario — visitas de obra, citas y reservas del cliente — para qué sirve cada uno y qué puede hacer con cada uno.",
    updated: "2026-09-12",
    intro: [
      "El calendario combina tres cosas distintas y etiqueta cada una: una **Visita de obra** es un viaje a la dirección de un trabajo, una cita es una reserva independiente con un cliente, y una **Reserva del cliente** es un horario que un cliente eligió en su página de reservas pública y que todavía no se convirtió en cita. El día de la visita se parecen; se comportan distinto, y saber cuál es cuál ahorra una llamada.",
      "Este artículo es el mapa. [[the-appointments-calendar|El calendario de citas]] recorre la pantalla en sí, y [[book-a-visit-for-a-client|Reservar una visita para un cliente]] los dos formularios.",
    ],
    sections: [
      {
        id: "overview",
        heading: "Resumen",
        blocks: [
          { p: "FieldQuo guarda una fila por cosa real y lee las tres a la vez, así que una visita programada en un trabajo aparece en el calendario sin una segunda copia que pudiera desviarse. Los controles cambian un poco según el tipo: una cita y una visita de obra se reasignan, se mueven, se cancelan y se completan desde el calendario (una visita también desde la página de su trabajo); una reserva que aún no se convirtió en cita la mueve el cliente con su propio enlace." },
        ],
      },
      {
        id: "three-kinds",
        heading: "Los tres tipos",
        blocks: [
          { table: {
            head: ["Tipo", "De dónde sale", "A qué pertenece"],
            rows: [
              ["Visita de obra", "**Agregar visita** o **Programar una visita** en la página de un trabajo; la siguiente visita de un trabajo recurrente.", "A un trabajo. Lleva la lista de verificación de la cuadrilla, las fotos, las notas y los botones Voy en camino / Marcar como completada."],
              ["Cita", "**Nueva cita** en el calendario; una reserva confirmada desde su página de reservas; una llamada o una visita reservada por el recepcionista IA.", "A un cliente, sin trabajo detrás. Recibe el mensaje de recordatorio, igual que una visita."],
              ["Reserva del cliente", "Una reserva confirmada desde la página de reservas que todavía no se convirtió en cita.", "Al tipo de evento que eligió el cliente. El cliente puede moverla o cancelarla con el enlace de su correo de confirmación."],
            ],
          } },
        ],
      },
      {
        id: "what-the-calendar-shows",
        heading: "Qué muestra el calendario",
        blocks: [
          { p: "Cada tipo cae en su día en la cuadrícula del mes y en la lista de abajo, ordenada por hora, con su propia etiqueta para que nada se haga pasar por otra cosa." },
          { bullets: [
            "Una etiqueta **Visita de obra**, el título del trabajo bajo el nombre del cliente, el nombre de la persona asignada y **Abrir trabajo**.",
            "Una cita: la etiqueta de estado, una etiqueta **Visita reservada** / **Llamada programada** / **Videollamada reservada** cuando llegó por la página de reservas o el recepcionista, **Reservado por el recepcionista IA** cuando nadie de la empresa habló con el cliente, y el desplegable de asignación.",
            "Una etiqueta **Reserva del cliente**, el nombre del tipo de evento y la persona asignada.",
            "En cualquier fila, el número de teléfono marca y la dirección abre el mapa sin abrir nada antes.",
          ] },
          { figure: "live:app-appointments", caption: "Citas — las etiquetas de estado con su conteo, la cuadrícula del mes y la lista de filas del mes o del día elegido." },
        ],
      },
      {
        id: "which-one-to-use",
        heading: "Cuál usar",
        blocks: [
          { bullets: [
            "Trabajo en la dirección de un trabajo — una medición, un día de instalación, una visita de garantía — es una visita en ese trabajo. Mantiene honesto el estado del trabajo y le da a la cuadrilla la lista de verificación y el registro fotográfico.",
            "Un primer vistazo antes de que exista un trabajo — una visita de estimación, una llamada de regreso — es una cita. Puede recibir un mensaje de recordatorio y reasignarse desde el calendario.",
            "Un cliente que reserva desde su sitio web o por el recepcionista no es ni lo uno ni lo otro — hizo una reserva, que se convierte en cita por sí sola (de inmediato si la visita es gratis, al pagarse la tarifa de visita si no).",
          ] },
          { tip: "Si ya existe un trabajo, reserve la visita desde el trabajo, no desde **Nueva cita**. Una cita no se vincula a un trabajo, y es la visita la que hace aparecer el trabajo en la lista del miembro de la cuadrilla." },
        ],
      },
      {
        id: "what-each-can-and-cannot-do",
        heading: "Qué puede y qué no puede hacer cada tipo",
        blocks: [
          { p: "Una cita en el calendario y una visita de obra — en el calendario o en la página de su trabajo — comparten un mismo juego de botones: **Reprogramar**, **Marcar como completada**, **Cancelar visita**, y después **Reabrir** o **Volver a programar**. Reprogramar se rige por la misma aritmética de margen de viaje que el enlace del cliente y explica un hueco demasiado corto antes de ofrecer **Mover de todos modos**; Cancelar visita pide un motivo que se queda en la fila, y es un estado, nunca una eliminación. Ambos diálogos ofrecen avisar al cliente por correo, en el idioma del cliente, de que la oficina la movió o la canceló. Una reserva que llegó por la página de reservas se mueve y se cancela con su cita; la que aún no se convirtió en cita la mueve el cliente con su propio enlace — vea [[clients-rescheduling-and-cancelling|Cuando un cliente reprograma o cancela]]." },
          { note: "Los recordatorios de cita salen para las citas y las visitas de obra por igual, una vez cada una, con la antelación fijada en Configuración → Notificaciones. El botón **Voy en camino** de la cuadrilla es el segundo aviso de la visita, en el momento de salir." },
        ],
      },
    ],
    faq: [
      { q: "¿Una visita de obra recibe mensaje de recordatorio?", a: "Sí — el recordatorio lee las visitas de obra igual que las citas: misma redacción, misma antelación, misma comprobación de STOP, nunca dos veces. Una visita ya completada o cancelada no recibe ninguno. El toque Voy en camino de la cuadrilla es un segundo mensaje, en el momento que importa." },
      { q: "¿Puedo convertir una cita en trabajo?", a: "No con un botón. Cree el trabajo (o deje que el presupuesto aprobado lo cree) y programe una visita en él; la cita se queda en el calendario en su propia fila." },
      { q: "Una fila Reserva del cliente no tiene enlace Abrir trabajo.", a: "Correcto — una reserva pertenece a un tipo de evento y a un cliente, no a un trabajo. Se convierte en cita por sí sola; nunca se convierte en visita de obra." },
    ],
  },

  "the-appointments-calendar": {
    title: "El calendario de citas",
    summary:
      "La pantalla Calendario: etiquetas de estado con conteo, la cuadrícula del mes, cada fila con sus etiquetas, el trayecto entre paradas, quién está asignado y las próximas dos semanas de su equipo.",
    updated: "2026-09-12",
    intro: [
      "**Calendario** en la barra lateral abre **Citas — Visitas presenciales y asignaciones de obra.** Es el lugar para preguntar “¿qué pasa esta semana?”: visitas de obra, citas y reservas del cliente aparecen todas, cada una en su día, cada una etiquetada.",
      "La pantalla tiene tres partes — las etiquetas, la cuadrícula, la lista — y una cuarta, **Tu equipo**, para quienes dirigen una cuadrilla.",
    ],
    sections: [
      {
        id: "overview",
        heading: "Resumen",
        blocks: [
          { p: "Nada se reserva desde la cuadrícula en sí. Usted la lee, elige un día para recortar la lista y luego actúa sobre las filas: llamar, navegar, asignar, mover, cancelar o completar, abrir el trabajo. La reserva se hace con **Nueva cita** o desde la página de un trabajo — vea [[book-a-visit-for-a-client|Reservar una visita para un cliente]]." },
        ],
      },
      {
        id: "on-the-screen",
        heading: "Qué hay en la pantalla",
        blocks: [
          { bullets: [
            "**Nueva cita** arriba a la derecha.",
            "Las etiquetas **Todos**, **Programado**, **Se requiere supervisor**, **Completado**, **Cancelado**, cada una con el conteo de filas que mostraría. El conteo aparece solo cuando la lista ya cargó — una etiqueta nunca dice 0 sobre una solicitud que no ha respondido.",
            "El encabezado del mes con **Anterior**, **Hoy** y **Siguiente**. La semana empieza el día fijado en **Configuración de la empresa → Primer día de la semana** — domingo, salvo que usted lo haya cambiado.",
            "Siete columnas en cualquier ancho. Hoy va rodeado con un círculo. Por encima del ancho de un teléfono, un día muestra hasta dos etiquetas (hora y cliente) y “+1” para el resto; en un teléfono muestra puntos.",
            "Pulse un día para ver solo sus filas; la fecha y **Limpiar** aparecen sobre la lista. Pulse el día otra vez para quitarlo.",
            "La lista: una tarjeta por entrada, desplegable, y luego **Tu equipo** debajo.",
          ] },
          { figure: "live:app-appointments", caption: "Citas — etiquetas con conteo, la cuadrícula del mes con hoy rodeado, y debajo las filas del mes." },
        ],
      },
      {
        id: "reading-a-row",
        heading: "Leer una fila",
        blocks: [
          { p: "Cada tarjeta empieza con el nombre del cliente y una etiqueta de estado — **Programado**, **Se requiere supervisor**, **Completado**, **Cancelado**, y para los otros tipos **Confirmado**, **Pendiente de pago**, **En camino**. Luego la etiqueta de tipo, la hora (y la hora de fin cuando una reserva la tiene), y un número de teléfono y una dirección que funcionan como enlaces. Pulse la tarjeta para abrir los detalles." },
          { bullets: [
            "**Visita de obra** — el título del trabajo, el nombre de la persona asignada y **Abrir trabajo**. Sus notas y su lista de verificación se editan en el trabajo; moverla, cancelarla y completarla también funcionan desde aquí.",
            "**Reserva del cliente** — el tipo de evento y la persona asignada. La mueve el cliente con su propio enlace.",
            "**Se requiere supervisor** — esta cita debe asignarse a un propietario, un administrador o un supervisor.",
            "**Reservado por el recepcionista IA** — nadie de la empresa habló con este cliente; las palabras del que llamó están en las notas.",
            "**Visita reservada** / **Llamada programada** / **Videollamada reservada** — cómo pidió reunirse el cliente. Una llamada no tiene dirección, por diseño.",
            "Los detalles: **Teléfono**, **Correo**, **Ubicación**, **Dirección** (cuando la dirección propia del cliente difiere del sitio), **Notas** y **Abrir ficha del cliente**. Un campo oculto por su nivel de acceso lo dice en lugar de parecer vacío.",
          ] },
        ],
      },
      {
        id: "drives-between-stops",
        heading: "El trayecto entre paradas",
        blocks: [
          { p: "Sobre una fila puede ver “about 25 min drive · 40 min gap”, o en ámbar “about 25 min drive · 20 min gap · 5 min short”. Es la estimación en línea recta entre dos paradas consecutivas de la misma persona en el mismo día, mostrada solo cuando ambas paradas tienen coordenadas. El veredicto — ajustado o no — se da solo cuando la parada anterior tiene hora de fin, que una reserva tiene y una cita creada a mano no." },
          { note: "Es una estimación, y lo dice — un factor de carretera sobre la distancia en línea recta, no una ruta en vivo. La verificación real de trayecto en los horarios que los clientes pueden reservar usa el mismo cálculo con el tiempo de conducción de Google encima; vea [[arrival-windows-and-travel-buffer|Ventanas de llegada y margen de desplazamiento]]." },
        ],
      },
      {
        id: "assign-someone",
        heading: "Cómo asignar una cita",
        blocks: [
          { steps: [
            "Encuentre la fila. En una cita, el desplegable de la derecha dice **Sin asignar** o un nombre.",
            "Elija a la persona. En una cita **Se requiere supervisor**, los nombres que no son supervisores van marcados “(not a supervisor)” y el servidor los rechaza.",
            "La fila se actualiza al instante, y una cita Se requiere supervisor que acaba de recibir un supervisor pasa a **Programado**.",
          ] },
          { warning: "Solo el propietario, los administradores y los supervisores (los perfiles Despachador y Gerente) tienen el desplegable. Los demás ven el nombre, más **Asignármelo** en una cita sin asignar que no exige supervisor — la única asignación que se les permite." },
        ],
      },
      {
        id: "move-cancel-or-complete",
        heading: "Cómo mover, cancelar o completar una entrada",
        blocks: [
          { p: "Bajo una cita o una visita de obra sobre la que usted puede actuar, la fila lleva **Reprogramar**, **Marcar como completada** y **Cancelar visita** — y en una terminada o cancelada, **Reabrir** o **Volver a programar**. Una **Reserva del cliente** que aún no se convirtió en cita no tiene nada de esto; el cliente la mueve con su enlace." },
          { steps: [
            "Pulse **Reprogramar**. Bajo **Nueva fecha y hora**, elija cuándo. La casilla **Avisar del cambio a … por correo** está marcada cuando el cliente tiene correo registrado — el diálogo lo dice claramente cuando no lo hay — y la carta sale en el idioma del cliente, diciendo que la oficina la movió.",
            "Pulse **Mover**. Una hora ya pasada, o una que deja demasiado poco para el trayecto desde la parada anterior o hacia la siguiente — la misma comprobación de margen de viaje que aplica la página de reservas — se rechaza con el motivo, y **Mover de todos modos** la reenvía cuando usted sabe más que la estimación.",
            "Pulse **Cancelar visita** para suspenderla. El **Motivo (se guarda en la visita, no se envía al cliente)** es opcional; si lo escribe, aparece después bajo la fila y se borra si la vuelve a programar. Aplica la misma casilla de correo, y la carta del cliente dice que la oficina canceló.",
            "Pulse **Marcar como completada** cuando esté hecha, **Reabrir** para deshacerlo, o **Volver a programar** para reponer una cancelada. Cancelar es un estado, nunca una eliminación — la fila se queda.",
          ] },
          { note: "Los botones aparecen en los mismos términos que exigen las rutas: una cita a su asignado o a Horario en “Edit everyone's schedule”; una visita a su asignado, a cualquiera cuando está sin asignar, o a ese mismo nivel. Una reserva detrás de una cita se mueve y se cancela con ella, así que el hueco en su página de reservas la sigue." },
        ],
      },
      {
        id: "who-sees-what",
        heading: "Quién ve qué",
        blocks: [
          { table: {
            head: ["Acceso", "Qué muestra el calendario"],
            rows: [
              ["Horario en “Edit everyone's schedule” o superior — Despachador, Gerente, administrador, propietario", "Todas las citas, todas las visitas y todas las reservas de la empresa, más **Tu equipo** debajo."],
              ["Estimador", "Sus propias citas y las citas sin asignar; sus propias visitas y las visitas sin asignar; las reservas de sus propios tipos de evento. Sin sección **Tu equipo**."],
              ["Cuadrilla", "Sus propias citas y las citas sin asignar; sus propias visitas, y las visitas sin asignar de los trabajos en los que está; las reservas de sus propios tipos de evento."],
              ["Todos", "El botón **Nueva cita** — crear una cita para uno mismo o sin asignar se permite en todos los niveles; asignarla a otra persona, no."],
            ],
          } },
        ],
      },
    ],
    faq: [
      { q: "¿Por qué la cuadrícula empieza en domingo?", a: "El primer día de la semana es un ajuste de empresa en Configuración de la empresa. Cámbielo ahí y la cuadrícula lo sigue." },
      { q: "¿Puedo mover una cita arrastrándola?", a: "No arrastrándola. Pulse **Reprogramar** en la fila — una cita o una visita de obra — y elija la nueva hora; la comprobación del trayecto dice si queda demasiado justo. Una reserva del cliente que aún no se convirtió en cita la mueve el cliente con su enlace." },
      { q: "¿Dónde está Tu equipo?", a: "Se muestra bajo la lista para las personas que ven el horario de todo el equipo — Despachador, Gerente, administrador y propietario — y lista lo que cada persona tiene agendado para las próximas dos semanas. Vea [[the-team-schedule|El horario del equipo]]." },
    ],
  },

  "book-a-visit-for-a-client": {
    title: "Reservar una visita para un cliente",
    summary:
      "Los dos formularios — Agregar visita en un trabajo, y Nueva cita en el calendario — paso a paso, con lo que hace cada campo y quién puede llenarlo.",
    updated: "2026-09-12",
    intro: [
      "Hay dos formas de poner usted mismo a un cliente en el calendario, y la diferencia es si existe un trabajo. Si existe, reserve una **visita** en el trabajo: lleva la lista de verificación y las fotos de la cuadrilla, y es lo que hace aparecer el trabajo en la lista del miembro de la cuadrilla. Si todavía no hay trabajo — un primer vistazo, una llamada de regreso — reserve una **cita** desde el calendario.",
      "Una tercera forma no necesita nada de usted: el cliente reserva un horario en su página de reservas, y cae en el calendario por sí sola.",
    ],
    sections: [
      {
        id: "overview",
        heading: "Resumen",
        blocks: [
          { p: "Los dos formularios piden el mismo núcleo — cuándo y quién va — y difieren en lo que lo rodea. El formulario de visita agrega notas para la cuadrilla y una lista de verificación; el de cita agrega la dirección del sitio y la casilla de supervisor. Ninguno pide precio: nada de dinero se decide al reservar una visita." },
        ],
      },
      {
        id: "a-visit-on-a-job",
        heading: "Cómo reservar una visita en un trabajo",
        blocks: [
          { steps: [
            "Abra el trabajo y pulse **Agregar visita** en la tarjeta **Visitas**, o **Programar una visita** en el aviso morado de un trabajo al que todavía le falta fecha.",
            "Bajo “When”, elija la fecha y la hora. Es obligatorio.",
            "Bajo “Who is going”, elija a un miembro del equipo o deje “Not assigned yet”. Una visita sin asignar la puede reclamar y completar cualquiera.",
            "Agregue “Notes for the crew” — código del portón, dónde estacionar, por quién preguntar. Se muestran en la visita, en la página del trabajo.",
            "Marque **This is a return to fix or check something from earlier on this job** si es el caso; entonces pregunta **¿Por qué vuelves?** y cuenta en su tasa de retrabajo/regresos, salvo que el motivo sea “no fue culpa nuestra”.",
            "Bajo “Checklist”, marque una o más de “Your checklists” o de las “Starter lists for your trades” — la cuadrilla recibe su propia copia marcable — y pulse “Schedule visit”.",
          ] },
          { note: "Reservar una visita en un trabajo en **Falta fecha** lo pasa a **Programado** por sí solo, y mete a la persona asignada en la sala de chat del trabajo — vea [[a-chat-room-for-every-job|Una sala de chat para cada trabajo]]." },
        ],
      },
      {
        id: "a-standalone-appointment",
        heading: "Cómo reservar una cita",
        blocks: [
          { steps: [
            "Abra **Calendario** y pulse **Nueva cita**.",
            "Escriba el **Nombre del cliente**. FieldQuo busca un cliente existente con exactamente ese nombre y lo usa; si no, crea un cliente nuevo con ese nombre, lo que exige acceso de edición a clientes.",
            "Elija **Fecha y hora**.",
            "Escriba la **Ubicación** — la dirección de la obra. Una llamada de regreso no tiene.",
            "Marque **Requiere un supervisor sénior en la obra** cuando solo un propietario, un administrador o un supervisor pueda atenderla. Si la deja sin asignar, la cita se muestra **Se requiere supervisor** hasta que se le ponga un supervisor.",
            "Bajo **Asignar a**, elija a una persona o deje **Sin asignar**, y pulse “Create Appointment”.",
          ] },
          { figure: "create:app-appointments-create", caption: "Nueva cita — nombre del cliente, fecha y hora, ubicación, la casilla de supervisor y Asignar a." },
          { note: "Este formulario crea una cita, no un trabajo. No le envía nada al cliente en el momento de reservar; el mensaje de recordatorio de cita, si usted lo activó, sale antes de la hora — vea [[appointment-reminders|Recordatorios de cita]]." },
        ],
      },
      {
        id: "let-the-client-book",
        heading: "O deje que el cliente reserve",
        blocks: [
          { p: "Su página de reservas ofrece los tipos de evento que configuró en **Configuración → Página de reservas**, solo en horarios a los que realmente puede llegar, y cobra una tarifa de visita cuando el tipo de evento la tiene. Una reserva confirmada se convierte en cita en el calendario, asignada a la persona de cuya agenda se trata; el cliente recibe un correo de confirmación con un enlace para moverla o cancelarla por su cuenta." },
          { tip: "Comparta el enlace de reservas o incruste el calendario en su propio sitio — vea [[embed-booking-and-quote-forms|Incrustar formularios de reserva y presupuesto en cualquier sitio]] y [[booking-fees-and-visit-deposits|Tarifas de reserva y depósitos de visita]]." },
        ],
      },
      {
        id: "who-can-book",
        heading: "Quién puede reservar qué",
        blocks: [
          { bullets: [
            "Una visita en un trabajo: cualquiera que pueda abrir el trabajo — incluida la cuadrilla en sus propios trabajos — para sí mismo o sin asignar. Poner el nombre de otra persona exige un propietario, un administrador o un supervisor.",
            "Una cita: todos los niveles pueden crear una para sí mismos o sin asignar; asignarla a otra persona exige un propietario, un administrador o un supervisor.",
            "Un cliente nuevo desde el formulario de cita: Estimador y superiores. La cuadrilla lee “No client named … is on file, and your access level doesn't allow you to add one.”",
            "Una cita que exige supervisor solo se puede asignar a un propietario, un administrador o un supervisor — vea [[supervisor-required-visits|Visitas que necesitan supervisor]].",
          ] },
        ],
      },
    ],
    faq: [
      { q: "¿Puedo reservar dos visitas en un mismo trabajo?", a: "Sí — tantas como el trabajo necesite. La tarjeta Visitas las cuenta (“1 of 3 complete”) y cada una tiene su fecha, su persona y su lista de verificación." },
      { q: "¿Reservar una visita le avisa al cliente?", a: "No. No se envía nada al reservar una visita. El cliente sabe de usted cuando la cuadrilla pulsa Voy en camino, y cualquiera de las dos puede recibir un mensaje de recordatorio si los recordatorios están activados. Moverla o cancelarla después sí ofrece avisar al cliente por correo." },
      { q: "¿Por qué la visita no tiene duración?", a: "Una visita tiene inicio y no tiene fin. Solo una reserva hecha por la página de reservas lleva hora de fin, y por eso el veredicto de trayecto entre paradas, en el calendario, solo se da después de una reserva." },
    ],
  },

  "arrival-windows-and-travel-buffer": {
    title: "Ventanas de llegada y margen de desplazamiento",
    summary:
      "Tres ajustes de la Página de reservas que deciden qué horarios puede reservar un cliente y qué se le dice: la verificación de trayecto, el margen entre trabajos y la ventana de llegada.",
    updated: "2026-09-12",
    intro: [
      "Una página de reservas que vende las 5:00 en una punta de la ciudad y las 5:30 en la otra es el peor fallo que un contratista puede tener, porque el cliente parado en su entrada a las 5:45 ya decidió qué clase de empresa es la suya. Dos de los ajustes de este artículo lo evitan: la verificación de trayecto oculta los horarios a los que no puede llegar, y el margen agrega los minutos que el trayecto no incluye.",
      "El tercero cambia solo lo que se le dice al cliente. Una hora exacta es una promesa que el camino rompe; una ventana — “entre las 1:45 y las 2:15 PM” — es una que puede cumplir.",
    ],
    sections: [
      {
        id: "overview",
        heading: "Resumen",
        blocks: [
          { p: "Los tres viven en **Configuración → Página de reservas**, y los tres aplican solo a visitas en el domicilio del cliente — se ocultan por completo cuando **Ir a su domicilio** no es uno de sus modos de reunión. Actúan sobre la página de reservas pública, la confirmación del cliente y el enlace del cliente para gestionar su visita. Su propio calendario conserva siempre la hora exacta." },
        ],
      },
      {
        id: "on-the-screen",
        heading: "Qué hay en la pantalla",
        blocks: [
          { p: "Bajo **¿Cuánto dura una visita?** están **¿Cómo pueden reunirse contigo los clientes?** (**Ir a su domicilio**, **Llamada telefónica**, **Videollamada**), luego **No ofrezcas horarios a los que no puedas llegar en auto** con su interruptor, **Tiempo extra entre trabajos** (**Ninguno**, **10 min** a **60 min**), **¿Qué le prometes al cliente?** (**Hora exacta**, **± 15 min**, **± 30 min**, **± 60 min**) con una vista previa de una línea, y la duración de visita por defecto." },
          { figure: "live:app-settings-booking-page", caption: "Configuración → Página de reservas — los modos de reunión, el interruptor de trayecto, las etiquetas de margen y las etiquetas de ventana de llegada con su vista previa." },
        ],
      },
      {
        id: "travel-check",
        heading: "La verificación de trayecto",
        blocks: [
          { p: "Con **No ofrezcas horarios a los que no puedas llegar en auto** activado, un cliente que escribe una dirección ve solo los horarios a los que usted podría llegar desde su cita anterior: el fin de la cita anterior, más el trayecto, más el margen, deben caber antes de que empiece el horario. El trayecto es el tiempo de conducción de Google cuando FieldQuo tiene las coordenadas de ambos extremos y una clave, y una estimación en línea recta si no." },
          { steps: [
            "Abra **Configuración → Página de reservas** y asegúrese de que **Ir a su domicilio** esté seleccionado.",
            "Active **No ofrezcas horarios a los que no puedas llegar en auto**. Está activado mientras usted no lo apague.",
            "Elija una etiqueta bajo **Tiempo extra entre trabajos** si el trayecto por sí solo nunca alcanza.",
          ] },
          { note: "La verificación se niega a adivinar. Cuando no conoce el trayecto — sin coordenadas en un extremo, el servicio de mapas caído — no oculta nada en lugar de inventar un tiempo de viaje, porque un horario que desaparece en silencio es peor que uno que exige una llamada. Apagada, se ofrece cada horario libre." },
        ],
      },
      {
        id: "the-buffer",
        heading: "El tiempo extra entre trabajos",
        blocks: [
          { p: "El margen se agrega al trayecto — estacionar, descargar, redactar el último trabajo. Empieza en **Ninguno**, porque un número adivinado por usted quita horarios reservables que nunca aceptó ceder. Solo existe mientras la verificación de trayecto está activada; apáguela y las etiquetas de margen desaparecen con ella." },
        ],
      },
      {
        id: "the-arrival-window",
        heading: "La ventana de llegada",
        blocks: [
          { p: "Bajo **¿Qué le prometes al cliente?**, **Hora exacta** le dice “2:00 PM”; las etiquetas ± la amplían a cada lado. La ventana tiene un tope de dos horas en total, y la vista previa bajo las etiquetas muestra la frase exacta que leería el cliente." },
          { table: {
            head: ["Etiqueta", "Qué se le dice al cliente para un horario de 2:00 PM"],
            rows: [
              ["Hora exacta", "Se les dirá 2:00 PM."],
              ["± 15 min", "entre las 1:45 y las 2:15 PM"],
              ["± 30 min", "entre las 1:30 y las 2:30 PM"],
              ["± 60 min", "entre las 1:00 y las 3:00 PM"],
            ],
          } },
          { warning: "Solo el cliente ve la ventana. El calendario de la cuadrilla, el horario del equipo y la copia de la oficina de cada correo conservan la hora exacta — un estimador al que le dicen “entre las 1:45 y las 2:15” no puede planear su día. La ventana nunca se aplica a una llamada telefónica ni a una videollamada." },
        ],
      },
      {
        id: "where-it-shows",
        heading: "Dónde se ve cada ajuste",
        blocks: [
          { bullets: [
            "La verificación de trayecto y el margen: los horarios ofrecidos en su página de reservas, y los horarios ofrecidos cuando un cliente mueve una visita con su propio enlace.",
            "La ventana de llegada: el correo de confirmación de reserva del cliente, la página del cliente para gestionar su visita, y la copia del cliente del correo “su visita se movió”.",
            "No en el mensaje de recordatorio de cita, que da la hora exacta.",
            "No en el calendario, la página del trabajo ni el horario del equipo.",
          ] },
        ],
      },
      {
        id: "who-can-change-it",
        heading: "Quién puede cambiarlo",
        blocks: [
          { p: "La pantalla Página de reservas se abre para el propietario, los administradores y los supervisores — los perfiles Despachador y Gerente. La cuadrilla y los estimadores no la ven; sus propias horas reservables están en **Disponibilidad**, que sigue visible para todos. Vea [[working-hours-and-bookable-hours|Horas de trabajo y horas reservables]]." },
        ],
      },
    ],
    faq: [
      { q: "¿Por qué no se ofrece un horario que sé que está libre?", a: "Normalmente la verificación de trayecto: desde el fin de la cita anterior, el trayecto más el margen no caben antes de ese horario. O el trabajo anterior termina tarde en el calendario, o el margen es generoso. Apagar la verificación muestra cada horario libre." },
      { q: "¿La ventana cambia mi calendario?", a: "No. Su calendario conserva la hora exacta; solo la confirmación y la página de gestión del cliente muestran la ventana." },
      { q: "¿El tiempo de trayecto es exacto?", a: "Con coordenadas en ambos extremos y Google disponible, es el tiempo de conducción de Google. Si no, es una estimación en línea recta con un factor de carretera, y FieldQuo dice “about” cuando eso es todo lo que tiene." },
    ],
  },

  "appointment-reminders": {
    title: "Recordatorios de cita",
    summary:
      "Un mensaje de texto al cliente 2, 24 o 48 horas antes de una cita o una visita de obra: cómo activarlo, qué dice, qué entradas lo reciben y cuánto cuesta.",
    updated: "2026-09-12",
    intro: [
      "Menos puertas cerradas: con los recordatorios activados, cada cliente con número de celular recibe un mensaje antes de su cita o visita de obra, en su propio idioma, que empieza con el nombre de su empresa. Está desactivado hasta que un propietario o un administrador lo activa; los mensajes en sí están incluidos en su plan, no se cobra nada por mensaje.",
      "Los recordatorios van solo por mensaje de texto. No hay recordatorio por correo.",
    ],
    sections: [
      {
        id: "overview",
        heading: "Resumen",
        blocks: [
          { p: "El ajuste es una sola elección en **Configuración → Notificaciones**: **Desactivado**, **2 horas antes**, **24 horas antes** o **48 horas antes**. FieldQuo revisa cada hora, así que un recordatorio sale dentro de la hora siguiente a que se alcanza su anticipación — un recordatorio de 24 horas para una cita el martes a las 2:00 PM sale el lunes entre las 2:00 y las 3:00 PM." },
          { note: "Los recordatorios de cita están marcados como parciales en la propia lista de funciones de FieldQuo: solo mensaje de texto, sin recordatorio por correo. La redacción se edita en **Configuración → Mensajes de clientes**, junto al mensaje “En camino”." },
        ],
      },
      {
        id: "turn-them-on",
        heading: "Cómo activarlos",
        blocks: [
          { steps: [
            "Abra **Configuración → Notificaciones**.",
            "Busque la tarjeta **Recordatorios de cita** — “Envía al cliente un SMS de recordatorio antes de su cita o visita de trabajo. Se envía con el nombre de tu negocio; el cliente puede responder STOP para darse de baja.”",
            "Pulse **2 horas antes**, **24 horas antes** o **48 horas antes**. Se guarda al pulsarlo.",
            "Para detenerlos, pulse **Desactivado**. Los recordatorios ya enviados no cambian; desde entonces no sale ninguno más.",
          ] },
          { figure: "live:app-settings-notifications", caption: "Configuración → Notificaciones — la tarjeta Recordatorios de cita con Desactivado, 2, 24 y 48 horas antes." },
        ],
      },
      {
        id: "when-it-goes",
        heading: "Cuándo sale un recordatorio y cuándo no",
        blocks: [
          { p: "Cada cita y cada visita de obra se considera una sola vez, y el mensaje sale solo cuando todo lo siguiente es cierto:" },
          { bullets: [
            "Es una **cita** en estado **Programado** — creada con **Nueva cita**, nacida de una reserva en su página de reservas, o reservada por el recepcionista IA — o una **visita de obra** en un trabajo no archivado. Una entrada **Se requiere supervisor**, completada o cancelada no recibe ninguno.",
            "Cae dentro de los próximos siete días y su anticipación ya se alcanzó.",
            "El cliente tiene un número de teléfono al que FieldQuo puede enviar mensajes.",
            "El cliente no se dio de baja de los mensajes ni de las llamadas — vea [[client-consent-and-unsubscribes|Consentimiento de clientes y bajas]].",
            "No se ha enviado antes un recordatorio para esta entrada. Nunca más de uno por cita o visita, aunque usted cambie la anticipación o la entrada se mueva.",
          ] },
        ],
      },
      {
        id: "what-it-says",
        heading: "Qué dice",
        blocks: [
          { p: "La redacción integrada es “Northside Painting: Recordatorio — su cita es mar, 12 ago, 2:00 p.m. en 123 Oak St. Responda STOP para no recibir más.”, con la hora en el idioma del cliente y la zona horaria de su empresa, y el lugar solo cuando la cita tiene ubicación. Existe en ocho idiomas; el cliente lee el que dice su ficha, o el idioma por defecto de su empresa." },
          { tip: "Hágalo sonar como usted en **Configuración → Mensajes de clientes**, con los campos **{company}**, **{when}** y **{location}**. Su redacción va a los clientes que leen el idioma de su empresa; los demás reciben la redacción integrada en el suyo. Vea [[the-on-my-way-text|El mensaje “En camino”]] para saber cómo funciona ese editor." },
        ],
      },
      {
        id: "which-appointments",
        heading: "Qué entradas reciben recordatorio",
        blocks: [
          { p: "Las citas y las visitas de obra. Una **Visita de obra** programada en un trabajo recibe el mismo mensaje con la misma anticipación, con la dirección de la obra (o la del cliente) como lugar; el toque **Voy en camino** de la cuadrilla es un segundo aviso, en el momento de salir. Una **Reserva del cliente** que todavía no se convirtió en cita tampoco — se convierte en una en cuanto se confirma y, si hay tarifa de visita, se paga." },
          { warning: "Los recordatorios son por empresa, no por persona: la anticipación aplica a cada cita y a cada visita programadas de la cuenta, estén asignadas a quien estén." },
        ],
      },
      {
        id: "who-can-change-it",
        heading: "Quién puede cambiarlo",
        blocks: [
          { p: "**Notificaciones** es una pantalla solo para el propietario y los administradores. Un gerente o un despachador no la ve, y el servidor rechaza el cambio con “Only owners and admins can change reminder settings.”" },
        ],
      },
    ],
    faq: [
      { q: "¿Cuánto cuesta un recordatorio?", a: "Nada por mensaje — los recordatorios están incluidos en su plan, y la tarjeta de Notificaciones lo dice. Están desactivados hasta que usted elige una anticipación, así que no se envía nada a una empresa que nunca abrió el ajuste." },
      { q: "¿Puedo recordar por correo en su lugar?", a: "No. Los recordatorios son solo mensajes de texto por ahora." },
      { q: "El cliente no recibió el recordatorio.", a: "Revise que la entrada esté Programado (no Se requiere supervisor, completada ni cancelada), que el cliente tenga número de teléfono, que no se haya dado de baja, y que la cita todavía estuviera en el futuro cuando pasó la corrida de cada hora — una cita ya dentro de su anticipación recibe el mensaje en la siguiente corrida; una que ya pasó, no." },
    ],
  },

  "the-on-my-way-text": {
    title: "El mensaje “En camino”",
    summary:
      "El mensaje que recibe un cliente cuando la cuadrilla pulsa Voy en camino en una visita: cómo se envía, qué dice, cómo cambiar la redacción y quién puede hacerlo.",
    updated: "2026-09-12",
    intro: [
      "En el momento en que un miembro de la cuadrilla sale, el teléfono del cliente vibra: “Northside Painting: Dave va en camino, llega en 20 min. Para cambiar la hora, llame al 555-0100.” Se envía con un solo toque en la visita, lleva el nombre de su empresa y es el único mensaje automático que envía una visita de obra.",
      "Junto con el recordatorio de cita es uno de los dos mensajes que sus clientes reciben de FieldQuo, y ambos se editan en la misma pantalla.",
    ],
    sections: [
      {
        id: "overview",
        heading: "Resumen",
        blocks: [
          { p: "El mensaje es un efecto secundario de un cambio de estado. En la página del trabajo, cada visita tiene un botón **Voy en camino**; al pulsarlo, la visita pasa a **En camino**, se registra dónde estaba el teléfono y se le envía un mensaje al cliente si tiene número de celular y no se ha dado de baja. El estado se guarda aunque el mensaje no se pueda entregar — una caída del servicio de mensajes nunca bloquea a la cuadrilla." },
        ],
      },
      {
        id: "send-it",
        heading: "Cómo enviarlo",
        blocks: [
          { steps: [
            "Abra el trabajo en su teléfono y busque la visita de hoy en la tarjeta **Visitas**.",
            "Lea la línea bajo los botones. Dice “Texts your “on my way” wording to 514-555-0123”, o que el número del cliente está oculto por su nivel de acceso (igual se envía), o “No mobile on file for this client, so nothing will be sent — the visit just moves.”",
            "Pulse **Voy en camino**. Su teléfono puede pedirle la ubicación una vez; negarla no impide el toque.",
            "La etiqueta de la visita dice **En camino** y el mensaje sale en segundo plano. Pulse **Marcar como completada** cuando termine.",
          ] },
          { note: "El botón dice lo que hace porque el teléfono de un desconocido vibra cuando usted lo pulsa. Una visita **En camino** ofrece **Marcar como completada** y **Cancelar visita**, no un segundo **Voy en camino** — un mensaje por salida." },
        ],
      },
      {
        id: "the-wording",
        heading: "La redacción",
        blocks: [
          { p: "**Configuración → Mensajes de clientes** — “Los mensajes de texto que reciben tus clientes. Deja uno sin cambios para usar nuestra redacción, o hazlo sonar como tú.” — tiene un editor por cada mensaje que realmente se envía: “Voy en camino” y “Recordatorio de cita”. No se ofrece nada más, porque no sale ningún otro mensaje automático." },
          { figure: "live:app-settings-messages", caption: "Configuración → Mensajes de clientes — el editor Voy en camino con sus fichas de campos, la vista previa “Tu cliente ve:”, Guardar y Usar el predeterminado." },
          { steps: [
            "Abra **Configuración → Mensajes de clientes** y busque “Voy en camino”.",
            "Escriba su mensaje en el cuadro, o pulse una ficha de campo para agregarla al final. La vista previa **Tu cliente ve:** llena los campos con valores de ejemplo mientras escribe.",
            "Pulse **Guardar**. Un mensaje con un campo que FieldQuo no conoce — “Campo desconocido: {price}. Solo funcionan los campos anteriores.” — no se puede guardar.",
            "Para volver a la redacción integrada, pulse **Usar el predeterminado**.",
          ] },
          { table: {
            head: ["Campo", "En qué se convierte"],
            rows: [
              ["{company}", "El nombre de su empresa."],
              ["{worker}", "El nombre del miembro de la cuadrilla asignado — “Your technician” cuando la visita no está asignada."],
              ["{name}", "El primer nombre del cliente."],
              ["{eta}", "La llegada estimada, calculada desde donde estaba su teléfono al tocar hasta la dirección del trabajo, con la misma estimación de trayecto que usa la página de reservas. Sin ubicación, o en un trabajo que nunca se ubicó en el mapa, el campo sale vacío y los espacios alrededor se limpian."],
              ["{phone}", "El teléfono de su empresa, de Configuración de la empresa — el número al que la redacción integrada le dice al cliente que llame, ya que una respuesta nunca se lee. Vacío, y esa frase desaparece."],
            ],
          } },
        ],
      },
      {
        id: "language",
        heading: "En qué idioma lo recibe el cliente",
        blocks: [
          { p: "El mensaje sigue el idioma del cliente, como su presupuesto: el idioma propio del cliente, o el idioma por defecto de su empresa. Su redacción personalizada va a los clientes que leen el idioma de su empresa; un cliente con otro idioma recibe la redacción integrada de FieldQuo en el suyo — los mismos ocho idiomas que sus documentos. Nada se traduce automáticamente." },
        ],
      },
      {
        id: "who-can",
        heading: "Quién puede enviarlo, quién puede cambiarlo",
        blocks: [
          { bullets: [
            "**Voy en camino** aparece para la persona a la que está asignada la visita, para cualquiera en una visita sin asignar y para las personas cuyo acceso a Horario es “Edit everyone's schedule”. Un miembro de la cuadrilla en la visita de otro ve la etiqueta y ningún botón.",
            "El número del cliente está oculto para la cuadrilla en la página del trabajo, pero el mensaje igual le llega — la línea bajo el botón lo dice.",
            "**Mensajes de clientes** lo editan el propietario, los administradores y los supervisores — los perfiles Despachador y Gerente.",
          ] },
        ],
      },
    ],
    faq: [
      { q: "¿El cliente puede responder?", a: "No de forma útil: FieldQuo no tiene bandeja de entrada para mensajes de clientes, y solo lee STOP. Por eso la redacción integrada dice que llame al teléfono de su empresa en lugar de invitar a responder — conserve **{phone}** también en la suya." },
      { q: "¿Se envía desde mi propio número?", a: "Sale del número desde el que FieldQuo envía mensajes y empieza con el nombre de su empresa, para que el cliente sepa quién viene." },
      { q: "¿Por qué el cliente recibió inglés si trabajamos en español?", a: "La ficha del cliente dice inglés, o no tiene idioma y el idioma por defecto de su empresa es inglés. Fije el idioma en la ficha del cliente; su redacción en español aplica solo a los clientes que leen español." },
    ],
  },

  "clients-rescheduling-and-cancelling": {
    title: "Cuando un cliente reprograma o cancela",
    summary:
      "El enlace del correo de confirmación permite al cliente mover o cancelar su visita por su cuenta — dentro del aviso que usted fija, con la tarifa de visita devuelta solo si su política lo dice — y le avisa a usted por correo.",
    updated: "2026-09-12",
    intro: [
      "Cada reserva hecha por su página de reservas, o por el recepcionista IA, viene con un correo de confirmación que lleva un enlace “Change or cancel this visit”. En esa página el cliente ve cuándo y dónde, qué puede hacer todavía y exactamente qué pasa con la tarifa de visita que pagó — todo calculado a partir de sus ajustes, nunca de lo que envíe el navegador.",
      "Usted fija dos plazos y un interruptor en **Configuración → Página de reservas**, bajo **Cambios y cancelaciones**. Este artículo explica qué hace cada uno y qué recibe usted cuando un cliente usa el enlace.",
    ],
    sections: [
      {
        id: "overview",
        heading: "Resumen",
        blocks: [
          { p: "Dos plazos, porque responden dos preguntas distintas. **Aviso que necesita para cambiar o cancelar** es cuánto aviso necesita la cuadrilla: dentro de él, el día está planificado y la camioneta cargada, así que el enlace deja de ofrecer cambios y le dice al cliente que llame. **Aviso necesario para recuperar la tarifa** es cuánto aviso necesita el dinero, y puede ser mayor — “se puede mover hasta el día antes, pero la tarifa solo vuelve con dos días de aviso”. Los reembolsos están desactivados salvo que usted los active." },
        ],
      },
      {
        id: "the-link",
        heading: "El enlace del cliente",
        blocks: [
          { p: "El enlace se genera cuando se confirma la reserva y vive en el correo de confirmación y en cada correo “su visita se movió” posterior. La página, en el idioma del cliente, muestra **Su visita** — **Cuándo** (con su ventana de llegada, si fijó una), **Dónde**, el depósito pagado — y, bajo **¿Necesita cambiar algo?**, **Cambiar la hora** y **Cancelar esta visita**. Cuando ya no se permite ninguna de las dos, dice por qué: “Northside Painting pide un aviso de al menos 24 horas, así que esta visita ya no se puede cambiar aquí. Llame a Northside Painting al … — todavía pueden moverla por usted.”" },
          { note: "Solo las reservas tienen este enlace. Una cita que usted reservó a mano con **Nueva cita** y una visita programada en un trabajo no le envían nada al cliente al reservar y no tienen enlace de autoservicio; cuando la oficina mueve o cancela una, se le puede avisar al cliente por correo desde ese diálogo. Los correos alrededor de una reserva — confirmada, movida, cancelada — y la página de gestión están todos en el idioma del cliente, y una carta de cambio o de cancelación dice si fue a petición suya o un cambio de la oficina." },
        ],
      },
      {
        id: "the-rules",
        heading: "Los tres ajustes",
        blocks: [
          { table: {
            head: ["Ajuste", "Por defecto", "Qué cambia"],
            rows: [
              ["Aviso que necesita para cambiar o cancelar", "24 horas", "Dentro de estas horas antes de la visita, el enlace del cliente ya no ofrece Cambiar la hora ni Cancelar esta visita. En blanco o ilegible se lee como 24, nunca como 0."],
              ["Devolver la tarifa de visita si cancelan a tiempo", "Desactivado", "Activado, una tarifa de visita pagada a través de FieldQuo se reembolsa automáticamente a la tarjeta del cliente cuando cancela con aviso suficiente. Desactivado, la cancelación se hace igual y el dinero se queda con usted."],
              ["Aviso necesario para recuperar la tarifa", "El mismo aviso de arriba", "Se muestra solo cuando el interruptor de reembolso está activado. Póngalo mayor que el aviso de cambio para conservar un margen en el que el cliente aún puede cancelar pero la tarifa se queda con usted; la página le avisa cuando es menor."],
            ],
          } },
          { p: "Bajo los campos, la página imprime su política tal como la vivirá el cliente — “Los clientes pueden cancelar o mover una visita hasta 24 horas antes de que empiece. Después de eso tienen que llamarle.” y “Una tarifa de visita ya pagada no se devuelve automáticamente: la cancelación se hace igual y el dinero se queda con usted.” — y le recuerda cuando ninguno de sus tipos de evento cobra tarifa todavía." },
        ],
      },
      {
        id: "when-they-cancel",
        heading: "Cuando un cliente cancela",
        blocks: [
          { bullets: [
            "La reserva y la cita en que se convirtió pasan ambas a **Cancelado**, y el horario vuelve a quedar libre en su página de reservas y en su calendario.",
            "Si el interruptor de reembolso está activado y se cumplió el aviso, la tarifa se reembolsa por Stripe a la tarjeta con la que pagó; la página y los correos lo dicen. Si la tarifa no se cobró a través de FieldQuo, nada se puede reembolsar automáticamente y ambos correos dicen que lo resuelvan entre ustedes.",
            "El cliente recibe un correo “Your visit is cancelled”. Usted recibe “A booking was cancelled” en el correo de la empresa, con el nombre y el correo del cliente, la hora, el lugar y si la tarifa se reembolsó.",
            "La página del cliente dice entonces **Visita cancelada** — se le avisó a la empresa. Una visita cancelada no se puede mover después; el cliente reserva de nuevo.",
          ] },
        ],
      },
      {
        id: "when-they-move",
        heading: "Cuando un cliente mueve la visita",
        blocks: [
          { bullets: [
            "**Cambiar la hora** muestra los mismos horarios que ofrecería su página de reservas — su disponibilidad, la duración del tipo de evento y la verificación de trayecto con su margen — para que la nueva hora sea una a la que usted puede llegar. Una hora dentro de su aviso de cambio se rechaza: esa hora no da aviso suficiente, elija una más tarde.",
            "La reserva y su cita pasan a la nueva hora. El horario anterior vuelve a quedar libre.",
            "El correo del cliente dice la nueva hora (con su ventana de llegada) y la anterior; el suyo dice la nueva hora exacta y la anterior, y que no se cobró ni se reembolsó nada.",
            "La tarifa de visita, si la hay, pasa a la nueva hora. Un mensaje de recordatorio ya enviado para la hora anterior no se vuelve a enviar.",
          ] },
        ],
      },
      {
        id: "set-it-up",
        heading: "Cómo fijar su política",
        blocks: [
          { steps: [
            "Abra **Configuración → Página de reservas** y baje hasta **Cambios y cancelaciones**.",
            "Escriba las horas bajo **Aviso que necesita para cambiar o cancelar**. Se guarda al salir del campo.",
            "Active **Devolver la tarifa de visita si cancelan a tiempo** si quiere que los reembolsos ocurran solos; luego llene **Aviso necesario para recuperar la tarifa**, o déjelo en blanco para usar el mismo aviso.",
            "Lea las dos frases bajo la tarjeta — son la política que aplicará la página del cliente.",
          ] },
          { figure: "live:app-settings-booking-page", caption: "Configuración → Página de reservas — la tarjeta Cambios y cancelaciones: el aviso en horas, el interruptor de reembolso y la política impresa tal como la leerá el cliente." },
        ],
      },
      {
        id: "who-can",
        heading: "Quién puede cambiarla",
        blocks: [
          { p: "El propietario, los administradores y los supervisores — los perfiles Despachador y Gerente — abren la pantalla Página de reservas; la cuadrilla y los estimadores, no. La política es de la empresa, no de la persona: esté asignada la visita a quien esté, aplican el mismo aviso y la misma regla de reembolso." },
        ],
      },
    ],
    faq: [
      { q: "El cliente dice que el enlace no lo deja cancelar.", a: "Está dentro de su aviso de cambio. La página nombra el aviso y su número de teléfono. Acuerde el cambio por teléfono y luego pulse **Reprogramar** o **Cancelar visita** en la fila de la cita en el calendario: la reserva detrás se mueve o se cancela con ella, y, con la casilla de correo marcada, el cliente sabe que la oficina hizo el cambio." },
      { q: "¿Por qué no se reembolsó la tarifa?", a: "Los reembolsos están desactivados salvo que usted haya activado Devolver la tarifa de visita si cancelan a tiempo, y aun así solo con el aviso que fijó. La página del cliente y ambos correos dicen cuál aplicó." },
      { q: "¿El cliente recibe el enlace si yo mismo reservo la cita?", a: "No. El enlace existe solo para reservas hechas por la página de reservas o por el recepcionista IA. Una cita que usted crea desde el calendario no le envía nada al cliente." },
    ],
  },
};
