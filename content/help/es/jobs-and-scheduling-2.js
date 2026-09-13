// content/help/es/jobs-and-scheduling-2.js
//
// Parte 2 de la categoría “jobs-and-scheduling” en español (ver el
// compositor, jobs-and-scheduling.js). Slugs de esta parte
// (lib/help/tree.js): recurring-jobs, tasks, suggested-tasks,
// checklists-on-site, job-photos-and-tags, job-notes, work-areas,
// the-scheduler-and-crew-shifts, the-team-schedule, the-time-clock.
//
// Misma estructura que el módulo en inglés (secciones, bloques, figuras,
// cantidad de pasos, viñetas, filas y preguntas): el check la compara. Las
// palabras en pantalla vienen del bloque `es` de app/i18n/appMessages.js; los
// rótulos que el producto muestra en inglés en todas las pantallas (los
// preajustes Crew / Estimator / Dispatcher / Manager, la cuadrícula de
// acceso, los botones de una visita, el panel de tareas sugeridas) se citan
// tal cual y se señalan como tales.
export const ARTICLES = {
  "recurring-jobs": {
    title: "Trabajos recurrentes",
    summary:
      "Marque un trabajo como recurrente, elija semanal, cada 2 semanas o mensual, y FieldQuo pone la siguiente visita en el calendario por sí solo — una sola visita próxima a la vez, hasta que el trabajo se complete o se cancele.",
    updated: "2026-09-12",
    intro: [
      "Una limpieza cada dos semanas, un corte de césped mensual, un cambio de filtro por temporada: el mismo trabajo en la misma dirección, una y otra vez. Un trabajo recurrente es un trabajo normal con una casilla marcada y una frecuencia. En cuanto su primera visita está en el calendario, FieldQuo programa todas las siguientes por usted, llevando adelante a la misma persona y la misma lista de verificación.",
      "La regla es pequeña a propósito: tres frecuencias, una sola visita próxima a la vez, y nada inventado. La primera visita siempre la reserva usted — FieldQuo continúa una serie, nunca adivina cuándo debería empezar.",
    ],
    sections: [
      {
        id: "overview",
        heading: "Resumen",
        blocks: [
          { p: "Un trabajo lleva dos cosas para la recurrencia: la casilla **Este es un trabajo recurrente** y una **Recurrencia** entre **Semanal**, **Cada 2 semanas** o **Mensual**. Ambas están en el formulario Nuevo trabajo y en la pantalla Editar del trabajo. La lista de trabajos muestra una etiqueta **Recurrente** en cada trabajo con la casilla marcada." },
          { p: "La recurrencia crea visitas, nada más. No emite facturas, no envía nada al cliente y no cambia el precio del trabajo. Si quiere facturar a un cliente según un calendario, eso es un plan de servicio — vea [[service-plans|Planes de servicio (facturación recurrente)]]." },
        ],
      },
      {
        id: "set-up-a-recurring-job",
        heading: "Cómo crear un trabajo recurrente",
        blocks: [
          { steps: [
            "Abra **Trabajos → Nuevo trabajo** (o **Editar** en un trabajo existente).",
            "Marque **Este es un trabajo recurrente**. Aparece un selector de **Recurrencia** — elija **Semanal**, **Cada 2 semanas** o **Mensual**. El formulario se niega a guardar la casilla sin una frecuencia, para que un trabajo nunca se lea como repetitivo mientras no hay nada programado.",
            "Pulse **Crear trabajo** y luego reserve la primera visita con **Agregar visita** en la página del trabajo. Esa primera fecha es el ancla desde la que se cuentan todas las visitas siguientes.",
          ] },
          { figure: "create:app-jobs-create", caption: "Trabajos → Nuevo trabajo — el cliente, el título, la dirección del sitio y la casilla “Este es un trabajo recurrente”." },
          { note: "Mientras no exista la primera visita, no hay nada programado. FieldQuo continúa una serie desde su última visita; no elige una fecha de inicio por usted." },
        ],
      },
      {
        id: "when-the-next-visit-appears",
        heading: "Cuándo aparece la siguiente visita",
        blocks: [
          { p: "Un trabajo recurrente siempre tiene exactamente una visita próxima. La siguiente se crea en dos momentos:" },
          { bullets: [
            "**En el momento en que una visita se marca como completada.** La cuadrilla que cierra la visita de hoy ya ve la de la semana próxima en el calendario.",
            "**Una vez cada noche**, como respaldo, para cualquier trabajo recurrente cuya última visita pasó sin marcarse como completada.",
          ] },
          { p: "La siguiente fecha se cuenta desde la visita más reciente y siempre cae en el futuro. Un trabajo que quedó inactivo durante meses recibe su siguiente fecha futura, no una pila de visitas atrasadas a las que nadie irá. Lo mensual conserva el mismo día del mes; una visita el día 31 cae en el último día de un mes más corto en lugar de saltarse." },
          { p: "La visita nueva copia a la persona asignada a la anterior y su lista de verificación, para que la limpieza de la semana próxima sea la misma limpieza, por la misma persona, con la misma lista — hasta que alguien cambie algo." },
        ],
      },
      {
        id: "stopping-a-series",
        heading: "Detener una serie",
        blocks: [
          { bullets: [
            "Cambie el estado del trabajo a **Completado** o **Cancelado** — un trabajo terminado o cancelado nunca se renueva.",
            "O abra **Editar** y desmarque **Este es un trabajo recurrente**. Las visitas que ya están en el calendario se quedan; no se crean nuevas.",
          ] },
          { tip: "Para saltarse una sola visita, pulse **Cancel visit** en ella y deje el trabajo activo. Una visita cancelada conserva su lugar — no se crea nada nuevo hasta que pase su fecha — y la revisión nocturna cuenta después la siguiente fecha a partir de ella, así que la serie sigue sin la visita saltada." },
        ],
      },
      {
        id: "who-can-see-it",
        heading: "Quién puede configurarlo",
        blocks: [
          { p: "Crear un trabajo y editar su recurrencia requiere el área Jobs de la cuadrícula de acceso en el nivel **View, create, and edit** — los preajustes Dispatcher y Manager, el propietario y los administradores. Los Estimator y los Crew ven el trabajo y su etiqueta **Recurrente**, pero no pueden cambiarla. Las visitas creadas por la serie obedecen las mismas reglas que cualquier otra visita." },
        ],
      },
    ],
    faq: [
      { q: "¿Puedo configurar un trabajo recurrente cada tres semanas, o dos veces por semana?", a: "No. Las tres frecuencias son Semanal, Cada 2 semanas y Mensual. Para cualquier otra cosa, reserve las visitas a mano." },
      { q: "¿El cliente recibe algo cuando se crea una visita nueva?", a: "No por la recurrencia en sí. Cada visita nueva es una visita normal — el mensaje de texto « En camino », la lista de verificación y las posiciones de marcación funcionan en ella exactamente igual que en una reservada a mano." },
      { q: "¿Por qué mi trabajo recurrente no tiene siguiente visita?", a: "O todavía no tiene ninguna visita (reserve la primera), o ya existe una visita futura (solo hay una a la vez), o el trabajo está Completado o Cancelado." },
    ],
  },

  tasks: {
    title: "Tareas",
    summary:
      "La lista interna de pendientes — cobrar un depósito, pedir material, devolver la llamada a un cliente — ordenada según lo que más dolerá si lo deja pasar, con las tareas que FieldQuo crea por usted en el momento en que algo queda pendiente.",
    updated: "2026-09-12",
    intro: [
      "Las tareas son recordatorios internos para usted y su equipo. Un trabajo es trabajo programado en la dirección de un cliente; una tarea es la administración alrededor — la llamada de seguimiento, el pedido por hacer, la reseña por pedir. La fila **Tareas** de la barra lateral abre la lista.",
      "La lista se ordena por urgencia en lugar de agruparse por estado, porque la pregunta con la que uno la abre es « qué se me ha pasado ». Las tareas atrasadas están arriba sea cual sea su prioridad; una tarea de prioridad baja con dos semanas de retraso sigue necesitando una decisión.",
    ],
    sections: [
      {
        id: "overview",
        heading: "Qué hay en la pantalla",
        blocks: [
          { p: "El título **Tareas**, una línea en inglés que dice qué es una tarea, y la cantidad de tareas abiertas. Luego una fila por tarea: una casilla, el título, un chip de prioridad (**Alta**, **Urgente** o **Baja** — **Normal** no muestra chip), una insignia roja **atrasada** cuando ya pasó la fecha, la descripción, la fecha en **Vence**, la persona asignada, el cliente y un enlace al trabajo. Una tarea que exige fotos muestra **0/3 fotos**; una que exige un comentario muestra **Falta un comentario**." },
          { figure: "live:app-tasks", caption: "Tareas — la cantidad de abiertas, una tarea creada por FieldQuo al aprobarse un presupuesto, y “Mostrar completadas” debajo." },
          { p: "**Mostrar completadas**, abajo, revela las tareas terminadas y canceladas; **Ocultar completadas** las vuelve a guardar. Marcar una tarea terminada la reabre." },
        ],
      },
      {
        id: "add-a-task",
        heading: "Cómo agregar una tarea",
        blocks: [
          { steps: [
            "Pulse **Nueva tarea**.",
            "Responda a **¿Qué hay que hacer?** y, si ayuda, agregue **Algún detalle que conste (opcional)**.",
            "Fije **Vence**, la **Prioridad** (**Baja**, **Normal**, **Alta**, **Urgente**) y **Asignar a** — **Nadie** la deja para quien quiera tomarla.",
            "**Vincular a un trabajo (opcional)**. Una vez elegido un trabajo aparecen dos controles más: **Requiere fotos** (una cantidad, hasta 20) y **Requiere un comentario**.",
            "Pulse **Agregar tarea**.",
          ] },
          { figure: "create:app-tasks-create", caption: "Tareas → Nueva tarea — el título, el detalle, Vence, Prioridad, Asignar a y el enlace opcional a un trabajo." },
          { note: "El requisito de fotos solo se ofrece una vez vinculado un trabajo, porque las fotos se archivan en ese trabajo. La casilla de una tarea así se niega hasta que existan las fotos y el comentario; usted los agrega desde el panel **Tareas de este trabajo** en la página del trabajo (**Añadir una foto**, **Comentario**, **Marcar como hecha**), no desde esta lista." },
        ],
      },
      {
        id: "tasks-fieldquo-creates",
        heading: "Las tareas que FieldQuo crea por usted",
        blocks: [
          { p: "Cuatro momentos del recorrido dejan a alguien debiendo una acción, y FieldQuo escribe la tarea por sí mismo — una vez por evento, nunca dos. Los títulos están en inglés en todas las pantallas:" },
          { table: {
            head: ["Cuándo", "La tarea", "Prioridad y vencimiento"],
            rows: [
              ["Un cliente aprueba un presupuesto", "Schedule the job for {cliente}", "Alta, sin fecha de vencimiento"],
              ["Se envía una factura", "Follow up payment for {número de factura}", "Vence en 7 días; se resuelve sola cuando la factura se paga"],
              ["Un trabajo tiene materiales por comprar", "Buy materials — {trabajo} · 3 of 10 bought", "Alta; el conteo se actualiza a medida que marca artículos, y se cierra cuando todo está comprado"],
              ["Un trabajo se marca como Completado", "« Ask {cliente} for a review » y « Review what “{trabajo}” actually cost », los dos en inglés en la pantalla", "Vence en 2 días y en 3 días"],
            ],
          } },
          { p: "Cada una enlaza a su trabajo y a su cliente. Un trabajo ingresado como trabajo pasado no crea ninguna de las dos tareas de cierre." },
        ],
      },
      {
        id: "who-can-see-it",
        heading: "Quién ve qué",
        blocks: [
          { bullets: [
            "**Nueva tarea** aparece para el propietario, los administradores y los preajustes Dispatcher y Manager. Asignar una tarea a otra persona requiere el mismo nivel.",
            "Los Crew y los Estimator ven las tareas asignadas a ellos, las que crearon y las que no tienen a nadie — y pueden marcar esas. No pueden crear una tarea desde esta pantalla.",
            "No hay control de eliminación en esta pantalla. Una tarea se marca como hecha o se deja abierta.",
          ] },
        ],
      },
    ],
    faq: [
      { q: "¿Dónde aparecen las tareas en el trabajo?", a: "Bajo **Tareas de este trabajo** en la página del trabajo, con el botón Marcar como hecha, la carga de fotos y el cuadro de comentario cuando la tarea los exige." },
      { q: "¿Las notas del trabajo pueden sugerir tareas?", a: "Sí — el panel « Tasks from the notes » de la página del trabajo lee las notas del cliente, del presupuesto y de las visitas y propone tareas entre las que usted elige. Vea [[suggested-tasks|Tareas sugeridas]]." },
      { q: "¿Por qué una tarea que marqué sigue abierta?", a: "Exige fotos o un comentario que todavía no están. La insignia en la fila dice cuál; agréguelos en la página del trabajo." },
    ],
  },

  "suggested-tasks": {
    title: "Tareas sugeridas",
    summary:
      "La página del trabajo lee las notas del cliente, del presupuesto y de las visitas y propone los pendientes de oficina que implican — cada uno citando la frase de la que salió, y nada se agrega hasta que usted lo elige.",
    updated: "2026-09-12",
    intro: [
      "« El portón trasero está con llave, llamar a la Sra. Alvarez el día anterior. » Alguien lo escribió en las notas, y alguien lo va a olvidar. El panel **Tasks from the notes** de la página del trabajo convierte frases como esa en tareas — y le muestra la frase, para que vea por qué se propuso cada una sin rebuscar en la ficha del cliente y en el presupuesto.",
      "Es un botón, no una automatización. No gasta nada hasta que usted lo pulsa y no escribe nada hasta que marca una sugerencia, porque una lista de pendientes que gana cinco filas escritas por una máquina en cada trabajo es una lista que se deja de leer.",
    ],
    sections: [
      {
        id: "overview",
        heading: "Qué lee, y qué no va a inventar",
        blocks: [
          { p: "El panel lee tres cosas que escribió una persona: las notas del cliente, las notas del presupuesto y las **Notes for the crew** de las visitas del trabajo. Las líneas del presupuesto solo sirven de contexto — un nombre de servicio en el presupuesto nunca se convierte en tarea." },
          { p: "Cada sugerencia debe citar una frase que realmente esté en esas notas. Una sugerencia cuya cita no está se descarta antes de que usted la vea. La IA tiene la instrucción de no agregar conocimiento del oficio — los pasos del oficio viven en las [[checklists-on-site|listas de verificación]] — y de no proponer « programar el trabajo » ni « pedir materiales » a menos que las notas lo planteen. Un resultado vacío es un resultado normal." },
        ],
      },
      {
        id: "use-it",
        heading: "Cómo usarlo",
        blocks: [
          { steps: [
            "Abra el trabajo. El panel **Tasks from the notes** está debajo de las visitas.",
            "Pulse **Read the notes**. Aparecen hasta cinco sugerencias, cada una con un título, la frase citada, un chip de prioridad y, cuando las notas implican un plazo, **due in N days**.",
            "Marque las que quiera. Ninguna viene marcada de antemano.",
            "Pulse **Add … to tasks**. Cada una se convierte en una tarea normal vinculada a este trabajo y a este cliente, con la frase de origen guardada en su descripción. **Dismiss** borra el resto; **Read again** vuelve a leer.",
          ] },
          { note: "Las palabras del panel están en inglés en la pantalla de todos los idiomas hoy." },
        ],
      },
      {
        id: "what-the-messages-mean",
        heading: "Qué significan los mensajes",
        blocks: [
          { table: {
            head: ["Mensaje", "Qué significa"],
            rows: [
              ["Nothing to read yet — this job has no client notes, quote notes or visit notes.", "Escriba primero una nota en el cliente, en el presupuesto o en una visita."],
              ["Read the notes on this job. Nothing in them needs a task.", "Las notas se leyeron; no implican ninguna acción. Un hallazgo, no una falla."],
              ["Nothing reliable to suggest from these notes. Nothing was added.", "Todas las sugerencias fallaron la verificación de la cita y se descartaron."],
              ["FieldQuo AI isn't switched on for this deployment.", "La IA no está configurada; el resto de la página del trabajo funciona con normalidad."],
            ],
          } },
          { p: "Cada pulsación consume la asignación de IA de la empresa. Cuando se agota, el botón lo dice y no se lee nada — vea [[ai-credit-and-phone-credit|Crédito de IA y crédito telefónico]]." },
        ],
      },
      {
        id: "who-can-see-it",
        heading: "Quién puede usarlo",
        blocks: [
          { p: "Sugerir tareas requiere el mismo nivel que crear una: el propietario, los administradores, los Dispatcher y los Manager. También requiere que el trabajo mismo sea visible para usted. Un miembro Crew en el trabajo ve el panel, pero el botón se niega." },
        ],
      },
    ],
    faq: [
      { q: "¿Lee todo el expediente del cliente?", a: "No. Solo el campo de notas del cliente, las notas del presupuesto y las notas para la cuadrilla de las visitas de este único trabajo — nunca las de otro trabajo, nunca las de otra empresa." },
      { q: "¿Puedo editar una sugerencia antes de agregarla?", a: "No en el panel. Agréguela y luego cambie el título, el vencimiento o la persona asignada en la pantalla de tareas como con cualquier otra tarea." },
    ],
  },

  "checklists-on-site": {
    title: "Listas de verificación en la obra",
    summary:
      "Escriba una sola vez los pasos que su cuadrilla repite en Configuración → Listas de verificación, ponga una copia en una visita, y la cuadrilla la marca en la página del trabajo — agrupada en Antes del trabajo, En la obra y Antes de irte.",
    updated: "2026-09-12",
    intro: [
      "Cubrir las encimeras, fotografiar antes, fotografiar después, recorrer la obra con el cliente. Una lista de verificación es esa lista escrita una vez y estampada en una visita como una copia nueva para marcar, para que nadie dependa de la memoria. La cuadrilla marca en su teléfono; la oficina ve **3/8 checklist items** en la visita.",
      "Nada se aplica a un trabajo por sí solo. Usted elige una lista al programar la visita o agrega una después, y las listas de partida de FieldQuo para sus oficios se ofrecen como sugerencias, nunca se estampan en una orden de trabajo con su nombre.",
    ],
    sections: [
      {
        id: "overview",
        heading: "Qué hay en la pantalla",
        blocks: [
          { p: "**Configuración → Listas de verificación** abre con la línea « Los pasos estándar que tu equipo sigue en el sitio. Adjunta uno a una visita y aparece como una copia nueva para marcar. » y un botón **Nueva lista de verificación**. Siguen sus propias listas, cada una con su insignia de momento (**Antes del trabajo**, **En la obra** o **Antes de irte**), su cantidad de pasos y su servicio, con **Editar** y **Eliminar la lista**." },
          { figure: "live:app-settings-checklists", caption: "Configuración → Listas de verificación — « Aún no hay listas de verificación » sobre las listas de partida escritas para los oficios que tiene activados." },
          { p: "Bajo **Listas de partida para tus oficios**, FieldQuo presenta listas ya hechas para los servicios que tiene activados. **Usar esta** copia una a sus propias listas — una copia, de modo que la primera línea que cambie es suya y nada compartido se reescribe." },
        ],
      },
      {
        id: "write-a-checklist",
        heading: "Cómo escribir una lista",
        blocks: [
          { steps: [
            "Pulse **Nueva lista de verificación**.",
            "Póngale un **Nombre** (el ejemplo propuesto es « Renovación de cocina — día uno ») y elija **Para qué servicio**, o deje **Cualquier servicio**.",
            "Elija **En qué momento de la visita**: **Antes del trabajo** (preparación del sitio y materiales), **En la obra** (el trabajo en sí) o **Antes de irte** (limpieza y recorrido con el cliente). Una visita agrupa su lista bajo estos tres encabezados.",
            "Escriba los **Pasos**, uno por línea, con **Agregar paso** para más. Pulse **Crear**.",
          ] },
          { figure: "create:app-settings-checklists-create", caption: "Configuración → Listas de verificación → Nueva lista de verificación — el nombre, el servicio, el momento de la visita y los pasos." },
        ],
      },
      {
        id: "put-it-on-a-visit",
        heading: "Cómo llega a una visita",
        blocks: [
          { bullets: [
            "**Al programar.** El formulario **Agregar visita** tiene una sección **Checklist**: elija una o varias de sus listas o listas de partida, y la visita recibe su propia copia para marcar.",
            "**Después.** En la página del trabajo, bajo la visita, **Add a checklist** abre el mismo selector — **Your checklists**, luego **Starter lists for your trades**, con una búsqueda en toda la biblioteca. Una lista agregada así se suma a lo que ya hay, y un paso con la misma redacción no se agrega dos veces.",
            "**En un trabajo recurrente**, la siguiente visita lleva adelante la lista de la visita anterior.",
          ] },
          { p: "La cuadrilla marca los elementos en la página del trabajo, agrupados por momento; cada marca se guarda sola y el conteo **3/8 checklist items** de la visita se mueve con ella." },
          { note: "El selector de listas en la página del trabajo y en el formulario Agregar visita está en inglés en la pantalla de todos los idiomas hoy." },
        ],
      },
      {
        id: "what-each-control-changes",
        heading: "Qué cambian editar y eliminar",
        blocks: [
          { bullets: [
            "**Editar** cambia solo la plantilla. Las visitas que ya llevan una copia conservan la copia que tienen.",
            "**Eliminar la lista** quita la plantilla y nunca quita trabajo de una visita ya programada.",
            "**Usar esta** en una lista de partida la agrega a sus propias listas; la lista de partida sigue disponible.",
          ] },
        ],
      },
      {
        id: "who-can-see-it",
        heading: "Quién puede verlo",
        blocks: [
          { p: "Escribir, editar y eliminar plantillas es para el propietario, los administradores y los preajustes Dispatcher y Manager; la fila **Listas de verificación** está oculta para todos los demás. Marcar en una visita le toca a la persona asignada a ella — o a cualquiera con el área Schedule en el nivel **Edit everyone's schedule** — y una visita sin nadie asignado puede marcarla cualquiera que vea el trabajo." },
        ],
      },
    ],
    faq: [
      { q: "¿Por qué una visita nueva no tiene lista?", a: "Porque no se eligió ninguna. Aplicar una lista es una elección, no un valor por defecto — agregue una desde el formulario Agregar visita o con Add a checklist en la página del trabajo." },
      { q: "¿De dónde salen las listas de partida?", a: "FieldQuo las escribe por oficio y muestra solo las de los servicios que tiene activados. Haga una copia y quite lo que no le encaje." },
      { q: "¿Un elemento puede exigir una foto o una medición?", a: "Un paso es una marca. Las listas tipo inspección de la biblioteca muestran el criterio de aceptación, la norma citada y « Photo expected » junto a un paso, pero hoy no hay casilla para una lectura — la foto va en la visita." },
    ],
  },

  "job-photos-and-tags": {
    title: "Fotos del trabajo y etiquetas",
    summary:
      "Cada foto de un trabajo se archiva por etapa — antes, en curso, terminado, problema — con sus propias etiquetas encima; una estrella la pone en su sitio web, y las fotos de problema nunca se hacen públicas.",
    updated: "2026-09-12",
    intro: [
      "Una pared de fotos sin fecha es una caja de zapatos. Agrupadas por etapa, las mismas fotos se convierten en el registro de un trabajo — cómo se veía cuando llegó la cuadrilla, el trabajo en marcha, el resultado terminado — y el antes y después de un trabajo es lo que le gana el siguiente a un pintor.",
      "Dos cosas describen una foto. Su **etapa** es lógica fija del producto: **Before / start**, **In progress**, **Finished** e **Issue / snag** (antes, en curso, terminado, problema) gobiernan el par de antes y después de su sitio web y mantienen una foto de problema fuera de él. Las **etiquetas** son sus propias palabras — lijado, imprimación, capa final, demolición — puestas encima, sin tocar nada de eso.",
    ],
    sections: [
      {
        id: "overview",
        heading: "De dónde vienen las fotos",
        blocks: [
          { bullets: [
            "**Subidas en la página del trabajo.** El panel **Job photos** admite hasta 12 a la vez. Se archivan como **In progress** — cambie la etapa de cualquier foto después de que llegue.",
            "**Enviadas por texto a su línea de cuadrilla.** Una foto enviada por mensaje de texto llega al trabajo con la etapa adivinada por las palabras del mensaje: « all done » la archiva como terminada, « before we start » como antes, « leak » o « damage » como problema, y cualquier cosa poco clara como en curso. Es una pista que usted puede cambiar, y una foto enviada por texto llega sin etiquetas. Vea [[the-crew-inbox|La bandeja de la cuadrilla]].",
          ] },
          { p: "Cualquiera que vea el trabajo puede agregar fotos, los Crew incluidos." },
        ],
      },
      {
        id: "on-the-job-page",
        heading: "Qué puede hacer en la página del trabajo",
        blocks: [
          { bullets: [
            "**Marcar con estrella** una foto para mostrarla en su sitio web; el panel cuenta cuántas están **on your website**. Una foto **Before / start** y una **Finished** del mismo trabajo se convierten en un antes y después. Una foto **Issue / snag** no se puede marcar con estrella — el botón lo dice en lugar de no hacer nada en silencio.",
            "**Cambiar la etapa** con el desplegable bajo la foto.",
            "**Marcar etiquetas** bajo la foto. Una etiqueta retirada sigue apareciendo, ya marcada, en una foto que la tenía — simplemente ya no se ofrece en las nuevas.",
            "**Comments** y **Add markup** (dibujar sobre la foto) también están en cada foto.",
            "**Photo record** lista cada foto con fecha y agrupada por etapa, fotos de problema incluidas, con **Filtrar por etiqueta** y **Download photo report** — un PDF para un cliente, una aseguradora o una disputa.",
          ] },
          { note: "Marcar con estrella, cambiar la etapa, etiquetar y anotar requieren el área Jobs en el nivel **View, create, and edit**. Subir y comentar funcionan en el nivel **View only**, así que un miembro Crew archiva fotos y deja comentarios, pero no cura." },
        ],
      },
      {
        id: "manage-tags",
        heading: "Cómo configurar las etiquetas",
        blocks: [
          { steps: [
            "Abra **Configuración → Etiquetas de fotos de trabajo** (o **Gestionar etiquetas** desde la página del trabajo).",
            "Bajo **Agregar una etiqueta**, escriba un **Nombre de la etiqueta**, elija un **Color** y pulse **Agregar etiqueta**.",
            "O pulse **Agregar etiquetas para empezar** para tomar el juego genérico — Demo, Prep, Sanding, Priming, Installing, Top coat, Punch list, Touch-up, en inglés. No se agrega nada hasta que lo pulse.",
            "Ordene la lista con **Subir** y **Bajar**; ese es el orden en que la página del trabajo las ofrece.",
          ] },
          { figure: "live:app-settings-job-photo-tags", caption: "Configuración → Etiquetas de fotos de trabajo — el formulario Agregar una etiqueta con sus muestras de color, y las etiquetas para empezar debajo." },
        ],
      },
      {
        id: "what-each-control-changes",
        heading: "Retirar una etiqueta",
        blocks: [
          { p: "No hay eliminación en esta pantalla, a propósito. **Retirar** oculta una etiqueta del selector en las fotos nuevas; cada foto que ya la lleva la conserva, sin cambios. **Recuperar** la vuelve a poner en el selector. Una etiqueta llamada « Issue » se comporta exactamente igual que una llamada « Sanding » — la regla de privacidad pertenece a la etapa, y una etiqueta no tiene forma de alcanzarla." },
        ],
      },
      {
        id: "who-can-see-it",
        heading: "Quién puede verlo",
        blocks: [
          { p: "La fila de configuración **Etiquetas de fotos de trabajo** es para el propietario, los administradores y los preajustes Dispatcher y Manager. Las fotos de un trabajo siguen al trabajo: un miembro Crew ve las fotos de los trabajos que tiene asignados." },
        ],
      },
    ],
    faq: [
      { q: "¿Una foto puede filtrarse a mi sitio web por accidente?", a: "Solo una foto con estrella aparece allí, y una foto Issue / snag no se puede marcar con estrella. El sitio web vuelve a comprobar la etapa cuando construye la galería." },
      { q: "¿Una etiqueta cambia lo que muestra el sitio web?", a: "No. Las etiquetas son para filtrar, y para usted; el sitio web solo lee la etapa y la estrella." },
      { q: "¿Puedo eliminar una foto?", a: "Hoy no hay control de eliminación para una foto de trabajo. Reclasifíquela como Issue / snag para mantenerla fuera del sitio web." },
    ],
  },

  "job-notes": {
    title: "Notas en un trabajo",
    summary:
      "Tres lugares donde viven palabras en un trabajo — las notas para la cuadrilla en cada visita, el parte diario de cada día en obra, y las notas del cliente y del presupuesto que el trabajo lee — y quién puede escribir cada una.",
    updated: "2026-09-12",
    intro: [
      "La ficha del trabajo en sí no tiene un cuadro de notas libres. Lo que un trabajo lleva se escribe donde corresponde: un aviso en la visita para quien va, un parte por cada día que la cuadrilla estuvo en obra, y las notas que ya están en el cliente y en el presupuesto, que el trabajo lee cuando sugiere tareas.",
      "Este artículo dice dónde está cada una, quién puede escribirla y qué la lee después.",
    ],
    sections: [
      {
        id: "overview",
        heading: "Las tres clases",
        blocks: [
          { table: {
            head: ["Dónde", "Para qué sirve", "Qué la lee"],
            rows: [
              ["Notas para la cuadrilla, en una visita", "El aviso antes del viaje: código del portón, dónde estacionar, por quién preguntar", "Se muestra bajo la visita en la página del trabajo; la lee Tasks from the notes"],
              ["Parte diario, uno por día en el trabajo", "Qué pasó, quién estuvo, cuánto tiempo, el clima, los retrasos", "Los Días recientes de la página del trabajo; consultable por la oficina"],
              ["Las notas del cliente y las notas del presupuesto", "Lo que la oficina sabe del cliente y de la venta", "Las lee Tasks from the notes"],
            ],
          } },
        ],
      },
      {
        id: "notes-for-the-crew",
        heading: "Las notas para la cuadrilla en una visita",
        blocks: [
          { p: "El formulario **Agregar visita** tiene un cuadro **Notes for the crew** (en inglés en todas las pantallas hoy) — el ejemplo propuesto es « Gate code, where to park, who to ask for ». La nota aparece bajo la fecha y el estado de la visita en la página del trabajo, donde la persona que va la lee antes de salir." },
          { p: "Una vez creada la visita, la nota puede cambiarla la persona a la que está asignada la visita, o cualquiera con el área Schedule en el nivel **Edit everyone's schedule**. Una visita sin nadie asignado puede editarla cualquiera que vea el trabajo." },
        ],
      },
      {
        id: "the-daily-log",
        heading: "El parte diario",
        blocks: [
          { p: "El panel **Parte diario** de la página del trabajo guarda una entrada por día: **Qué pasó hoy** y luego, opcionales, **Cuadrilla en obra**, **Horas en obra**, **Clima** y **Retrasos o trabas**. Se guarda solo mientras escribe, y **Días recientes** lista las entradas anteriores." },
          { steps: [
            "En la página del trabajo, abra **Parte diario**. **Hoy** está seleccionado; elija **Ayer** o **Elige un día** para redactar un día después de ocurrido — llenar el parte de ayer a las seis de la mañana es normal y no crea un segundo martes.",
            "El cuadro empieza con lo que FieldQuo ya sabe del día — las fotos archivadas y los pendientes terminados — para que usted complete en lugar de volver a escribir.",
            "Escriba. **Guardado** aparece cuando ya se guardó; **Todavía sin guardar** mientras no.",
          ] },
          { warning: "Si dos personas tienen el mismo día abierto, el segundo guardado se rechaza en lugar de sobrescribir el primero. Las palabras se quedan en pantalla, sin guardar, y la persona decide. Nada se fusiona ni se pierde en silencio." },
          { p: "Cualquiera que vea el trabajo puede escribir su parte diario, los Crew incluidos — ellos son los que están en obra." },
        ],
      },
      {
        id: "who-can-see-it",
        heading: "Quién puede leerlas",
        blocks: [
          { p: "La lectura sigue al área Jobs: un miembro Crew lee las notas de visita y los partes diarios de los trabajos que tiene asignados y nada más. Las notas del cliente están en la ficha del cliente, que un miembro Crew no abre. El ajuste **Notes** de la cuadrícula de acceso no restringe ninguna de estas notas hoy — quién lee las notas de un trabajo lo decide el nivel de Jobs." },
        ],
      },
    ],
    faq: [
      { q: "¿Dónde escribo una nota sobre el trabajo en su conjunto?", a: "En la visita si es para la cuadrilla, en el parte diario si es sobre un día, en la ficha del cliente si es sobre el cliente. La ficha del trabajo no tiene campo de notas propio." },
      { q: "¿El cliente puede ver algo de esto?", a: "No. Las notas de visita, los partes diarios y las notas del cliente son internos; nada de esta página llega a un presupuesto, una factura o el portal." },
    ],
  },

  "work-areas": {
    title: "Zonas de trabajo",
    summary:
      "Zonas con nombre — Laval, la isla de Montreal, la Ribera Norte — con un chip por miembro del equipo; los nombres también le dicen a su sitio web y a su recepcionista de IA dónde trabaja.",
    updated: "2026-09-12",
    intro: [
      "Una zona de trabajo es un territorio o proyecto con nombre y las personas asignadas a él. Responde a « de quién es este sector », y su nombre se reutiliza donde el mundo exterior pregunta dónde trabaja: el bloque **Areas we serve** de su sitio web y lo que el recepcionista telefónico dice a quienes llaman.",
      "Este artículo dice qué hace hoy una zona de trabajo y, con la misma claridad, qué no hace.",
    ],
    sections: [
      {
        id: "overview",
        heading: "Qué hay en la pantalla",
        blocks: [
          { p: "**Configuración → Zonas de trabajo** abre con el título **Áreas de trabajo**, la línea « Agrupa las tareas por proyecto o zona. Los nombres que pongas aquí también indican dónde trabajas en tu sitio web público y en lo que tu recepcionista de IA les dice a quienes llaman. », un cuadro **Nombre de la nueva área de trabajo** con un botón más, y luego una tarjeta por zona con un chip por cada miembro del equipo. Un chip relleno significa que esa persona está asignada." },
          { figure: "live:app-settings-work-areas", caption: "Configuración → Áreas de trabajo — el cuadro Nombre de la nueva área de trabajo, antes de que exista ninguna zona." },
        ],
      },
      {
        id: "add-a-work-area",
        heading: "Cómo agregar una y asignar personas",
        blocks: [
          { steps: [
            "Escriba un nombre en **Nombre de la nueva área de trabajo** y pulse el más.",
            "En la tarjeta de la zona, toque el chip de una persona para asignarla; tóquelo de nuevo para quitarla. Cada toque se guarda.",
          ] },
        ],
      },
      {
        id: "what-it-changes",
        heading: "Qué cambia una zona de trabajo",
        blocks: [
          { bullets: [
            "**Su sitio web.** El bloque **Areas we serve** lista los nombres de sus zonas, en orden alfabético, nunca una lista de ciudades escrita a mano que se queda vieja. Vea [[website-pages-and-blocks|Páginas y bloques del sitio web]].",
            "**El recepcionista telefónico.** Los nombres forman parte de lo que sabe, para poder decirle a quien llama si usted cubre su ciudad. Vea [[the-phone-receptionist|El recepcionista telefónico]].",
            "**Los chips de asignación** son un registro de quién está en qué zona. Hoy ninguna otra pantalla los lee — nada filtra trabajos, tareas ni el calendario por zona de trabajo, y un trabajo no lleva una.",
          ] },
          { note: "Una zona no se puede renombrar ni quitar desde esta pantalla hoy. Elija el nombre tal como quiera publicarlo." },
        ],
      },
      {
        id: "who-can-see-it",
        heading: "Quién puede verlo",
        blocks: [
          { p: "Crear una zona y cambiar quién está asignado es para el propietario, los administradores y los preajustes Dispatcher y Manager, y la fila de configuración solo aparece para ellos. Cualquier otra persona que abra la página ve una lista de solo lectura — « Estas son las zonas a las que te pueden asignar. » — con nombres en lugar de botones." },
        ],
      },
    ],
    faq: [
      { q: "¿Una zona de trabajo cambia a quién se reserva?", a: "No. La reserva sigue las horas reservables de cada persona y la página de reservas, no sus zonas de trabajo." },
      { q: "¿Tengo que agregar zonas para que el sitio web muestre dónde trabajo?", a: "Sí — el bloque Areas we serve se construye solo con estos nombres. Sin ninguna, el bloque no tiene nada que mostrar." },
    ],
  },

  "the-scheduler-and-crew-shifts": {
    title: "La programación: preparar y publicar la semana de la cuadrilla",
    summary:
      "Asignar turnos pone a una persona en un día con un inicio, un fin y una nota; los turnos quedan en borrador, invisibles para la cuadrilla, hasta que pulsa Publicar semana, y FieldQuo avisa cuando un turno cae fuera de las horas de alguien o sobre tiempo libre aprobado.",
    updated: "2026-09-12",
    intro: [
      "**Asignar turnos** en la barra lateral abre **Programación**: la semana de la cuadrilla en siete tarjetas, de domingo a sábado. Usted prepara los turnos, pasa de una semana a otra y publica una vez. Hasta que publica, la cuadrilla no ve nada — una semana a medio hacer nunca aterriza en el teléfono de nadie.",
      "Un turno son las horas de una persona, no un viaje a una dirección. Las visitas viven en el trabajo y en el calendario; los turnos dicen quién trabaja cuándo.",
    ],
    sections: [
      {
        id: "overview",
        heading: "Qué hay en la pantalla",
        blocks: [
          { p: "El título **Programación** y la línea « Añade los turnos de la semana y luego pulsa Publicar para que tu equipo los vea: los turnos permanecen ocultos hasta que publicas. » Luego **Semana anterior**, **Esta semana**, **Semana siguiente** y el rango de fechas; **Agregar turno**; **Publicar semana** en cuanto existe un borrador; y siete tarjetas de día, cada una con un más, **Hoy** en el día actual y **No hay turnos programados.** cuando está vacía. Una fila de turno muestra la persona, las horas, la nota, una insignia **Borrador** hasta que se publica, y una ✕ para quienes pueden eliminar." },
          { figure: "live:app-scheduler", caption: "Programación — las siete tarjetas de la semana, Agregar turno, y el aviso ámbar de que un miembro del equipo no tiene horas de trabajo definidas." },
          { p: "Un cartel ámbar nombra a quien no tiene horas de trabajo: « No hay horas de trabajo definidas para … Hasta que las tengan, nada avisa de un turno a una hora extraña para esas personas y la nómina no tiene con qué contrastar las horas que registran. » **Definir sus horas** lleva directo a su Disponibilidad." },
        ],
      },
      {
        id: "add-and-publish",
        heading: "Cómo preparar y publicar una semana",
        blocks: [
          { steps: [
            "Pulse **Agregar turno** (o el más de una tarjeta de día).",
            "En **Nuevo turno**, elija el **Trabajador**, la **Fecha**, el **Inicio** y el **Fin**, y una **Nota (opcional)** — el ejemplo propuesto es « ej. dirección del sitio, qué llevar ». No hay selector de trabajo en un turno; ponga el sitio en la nota.",
            "Pulse **Agregar al borrador**. El turno aparece en su día con una insignia **Borrador**.",
            "Repita para la semana y luego pulse **Publicar semana**. Cada turno en borrador de la semana se vuelve visible para las personas que están en él.",
          ] },
          { note: "Publicar muestra los turnos en la pantalla Asignar turnos de cada persona — « Estos son los turnos que publicó tu gerente. Vuelve para ver cambios. » No se envía ningún correo ni mensaje de texto." },
        ],
      },
      {
        id: "what-fieldquo-checks",
        heading: "Qué comprueba FieldQuo cuando agrega un turno",
        blocks: [
          { table: {
            head: ["El turno cae…", "Qué pasa"],
            rows: [
              ["Fuera de las horas en que la persona dijo estar disponible", "El formulario se detiene: « Confírmalo con esa persona antes de continuar: todavía no lo ha aceptado. » Puede dar un motivo bajo **¿Por qué?** y pulsar **Programar de todos modos**; el turno queda entonces marcado **Fuera de la disponibilidad declarada**, y la persona lo ve cuando se publica."],
              ["Sobre tiempo libre aprobado", "Bloqueado. « Cambia la fecha o modifica antes su tiempo libre. » El tiempo libre aprobado es una decisión ya tomada, y no hay forma de saltársela."],
              ["Fuera de su horario de trabajo habitual", "Se guarda, con una advertencia después de **Turno añadido.** Las horas extra no son un error."],
              ["Sobre alguien sin ninguna hora definida", "Se guarda. El silencio no es un rechazo — el cartel le invita a definir sus horas."],
            ],
          } },
          { p: "Disponibilidad, horario de trabajo y tiempo libre son tres cosas distintas — vea [[working-hours-and-bookable-hours|Horario de trabajo y horas reservables]] y [[time-off-requests|Solicitudes de tiempo libre]]." },
        ],
      },
      {
        id: "who-can-see-it",
        heading: "Quién puede hacer qué",
        blocks: [
          { bullets: [
            "**Agregar turno** y **Publicar semana** requieren el área Schedule en el nivel **Edit everyone's schedule** — los Dispatcher, los Manager, el propietario y los administradores.",
            "**Eliminar un turno** (la ✕) requiere **Edit and delete everyone's schedule** — los Manager, el propietario y los administradores. Un Dispatcher prepara y publica, pero no elimina.",
            "**Los Crew y los Estimator** abren la misma fila y ven solo sus propios turnos publicados, con la nota de que su gerente los publica.",
          ] },
        ],
      },
    ],
    faq: [
      { q: "¿Puedo despublicar una semana?", a: "No desde la pantalla. Elimine el turno equivocado y agregue el correcto; el nuevo queda en borrador hasta que vuelva a publicar." },
      { q: "¿Un turno pone algo en el calendario del cliente?", a: "No. Los turnos son internos. Al cliente se le informa de las visitas, nunca de los turnos." },
      { q: "¿Por qué puedo agregar un turno un domingo?", a: "El horario de trabajo solo advierte; no bloquea. Solo el tiempo libre aprobado bloquea." },
    ],
  },

  "the-team-schedule": {
    title: "El horario del equipo",
    summary:
      "Una página para todo el equipo: una tarjeta por persona con sus horas reservables de lunes a domingo y lo que tiene reservado en las próximas dos semanas, con un botón Editar horas para los responsables.",
    updated: "2026-09-12",
    intro: [
      "**Calendario del equipo** en la barra lateral abre **Horario del equipo** — la respuesta del propietario a « quién se puede reservar y cuándo ». Todos están en una sola página, así que un responsable corrige las horas de cualquiera desde aquí en lugar de pedírselo a cada uno.",
      "Es una vista general de solo lectura. Las horas se editan en la Disponibilidad de cada persona; las visitas, las citas y los turnos se crean en otro lado.",
    ],
    sections: [
      {
        id: "overview",
        heading: "Qué hay en la pantalla",
        blocks: [
          { p: "El título **Horario del equipo** y la línea « La disponibilidad semanal de cada persona y lo que hay reservado en las próximas dos semanas. Cada uno puede fijar sus propias horas en Ajustes → Disponibilidad, y tú puedes fijar las de cualquiera desde aquí. » Luego una tarjeta por persona: sus iniciales, su nombre y su nivel (Owner, Administrator, Manager o Worker — en inglés en todas las pantallas), una franja de siete días con horas como **08:00–17:00** y **—** en los días libres, **Sin disponibilidad definida** cuando no se ingresó nada, y **Editar horas** o **Definir horas**. Bajo la franja, **Próximas 2 semanas** lista en qué está reservada esa persona, por fecha, hora y cliente." },
          { figure: "harness:team-schedule", caption: "Horario del equipo — una tarjeta por persona, la franja de lunes a domingo de horas reservables, Editar horas, y las próximas dos semanas de reservas." },
          { p: "Las personas con horas definidas van primero, y luego el resto por nombre. La semana empieza el día fijado en las preferencias de su empresa." },
        ],
      },
      {
        id: "what-the-strip-shows",
        heading: "Qué muestran realmente la franja y la lista",
        blocks: [
          { bullets: [
            "**La franja son las horas reservables** — la ventana en la que los clientes pueden reservar a esa persona, desde **Configuración → Disponibilidad → Horas reservables**. No son su horario de trabajo ni sus turnos.",
            "**Próximas 2 semanas** lista las citas asignadas a esa persona y las reservas hechas por la página de reservas, para los próximos 14 días. Las visitas de trabajo y los turnos publicados no están en esta lista.",
          ] },
          { note: "Un estimador que trabaja de 8 a 4 pero solo toma consultas de 2 a 4 muestra **14:00–16:00** aquí. Es correcto: la página responde a cuándo pueden reservarlo los clientes. Vea [[working-hours-and-bookable-hours|Horario de trabajo y horas reservables]]." },
        ],
      },
      {
        id: "edit-someones-hours",
        heading: "Cómo fijar las horas de alguien desde aquí",
        blocks: [
          { steps: [
            "Pulse **Editar horas** (o **Definir horas**) en su tarjeta.",
            "Se abre su página de Disponibilidad con esa persona seleccionada. Cambie el **Horario de trabajo** y las **Horas reservables** y guarde.",
            "Vuelva: la franja refleja las nuevas horas reservables.",
          ] },
        ],
      },
      {
        id: "who-can-see-it",
        heading: "Quién puede verlo",
        blocks: [
          { p: "La fila **Calendario del equipo** aparece para el propietario, los administradores y los preajustes Dispatcher y Manager — las personas que pueden ver toda la plantilla. **Editar horas** aparece para las mismas personas. Los Crew y los Estimator no tienen la fila; fijan sus propias horas en **Configuración → Disponibilidad**." },
        ],
      },
    ],
    faq: [
      { q: "¿Por qué una visita que programé no está bajo Próximas 2 semanas?", a: "La lista muestra citas y reservas de la página de reservas. Las visitas de trabajo están en el trabajo y en el Calendario." },
      { q: "Alguien muestra Sin disponibilidad definida — ¿los clientes pueden reservarlo?", a: "No. Las horas reservables son lo que la página de reservas ofrece; sin ellas, esa persona no se ofrece. Pulse Definir horas." },
    ],
  },

  "the-time-clock": {
    title: "El reloj de tiempo",
    summary:
      "La marcación propia de la cuadrilla: registrar la entrada en el trabajo en el que están, cambiar de trabajo a mitad del día, registrar la salida y ver las horas de hoy — con una posición capturada al tocar para que la hoja de tiempo muestre a qué distancia del sitio se hizo.",
    updated: "2026-09-12",
    intro: [
      "**Reloj de tiempo** es la única pantalla que un trabajador por hora toca en cada turno, así que se mantiene sencilla: la fecha, un reloj en vivo, un botón grande, el total de hoy. Cada toque escribe una entrada de tiempo simple que va al gerente para revisarla en las hojas de tiempo — aquí no se hace ningún cálculo de nómina.",
      "Cada entrada puede nombrar el trabajo en el que se trabajó, que es lo que permite al costeo saber cuánto costó de verdad la mano de obra de un trabajo. Una hora sin trabajo — traslados, el taller, una mañana presupuestando — es una hora real y se registra exactamente como tal.",
    ],
    sections: [
      {
        id: "overview",
        heading: "Qué hay en la pantalla",
        blocks: [
          { p: "El día y el reloj en vivo. Debajo, o bien **Estás fuera de turno.** con un selector **¿Qué trabajo?** y un botón verde **Registrar entrada**, o bien una píldora **En turno** con **Desde {hora}**, el tiempo transcurrido, **En {trabajo}** y un botón rojo **Registrar salida**. Mientras está en turno, **¿Te pasaste a otro trabajo?** ofrece un segundo selector y **Cambiar de trabajo**. Debajo, **Hoy** suma las horas del día y lista cada entrada, la que está en curso marcada **Abierto**, con la línea « Tus horas se envían a tu gerente para revisar y aprobar. »" },
          { figure: "live:app-clock", caption: "Reloj de tiempo — fuera de turno, el selector ¿Qué trabajo? en « Sin trabajo — traslados, taller, presupuestar », y el botón Registrar entrada." },
        ],
      },
      {
        id: "clock-in-and-out",
        heading: "Cómo registrar la entrada, cambiar de trabajo y registrar la salida",
        blocks: [
          { steps: [
            "Elija el trabajo bajo **¿Qué trabajo?**. Si tiene una visita programada hoy, ya está seleccionada (« Hoy estás programado aquí — cámbialo si estás en otro lado. »); con varias, elija con la que empieza; sin ninguna, elija un trabajo bajo **Tus otros trabajos abiertos** o deje **Sin trabajo — traslados, taller, presupuestar**.",
            "Pulse **Registrar entrada**. Si el navegador pregunta dónde está su teléfono, esa es la posición única que se guarda junto a esta marcación — diga sí o no; la marcación se registra de cualquier modo.",
            "¿Cambió de sitio? Bajo **¿Te pasaste a otro trabajo?**, elija el trabajo nuevo y pulse **Cambiar de trabajo**. Las horas hechas hasta ahora se quedan en el primer trabajo y una entrada nueva empieza desde ese momento.",
            "Pulse **Registrar salida** al final. La entrada se cierra y aparece bajo **Hoy**.",
          ] },
          { note: "Una sola entrada abierta a la vez. Registrar la entrada cuando ya está en turno se rechaza con « You're already clocked in — clock out first. » Una salida olvidada se corrige en las hojas de tiempo — vea [[timesheets-and-approving-hours|Hojas de tiempo: revisar y aprobar horas]]." },
        ],
      },
      {
        id: "location",
        heading: "Qué es la posición de marcación, y qué no es",
        blocks: [
          { p: "Cuando toca **Registrar entrada** o **Registrar salida**, se le pregunta al teléfono dónde está — una sola vez, con su permiso a través del aviso del propio teléfono — y esa posición se guarda junto a la marcación. Nada corre en segundo plano y nada se rastrea entre toques; un navegador no puede hacerlo, y FieldQuo no finge hacerlo." },
          { bullets: [
            "En las hojas de tiempo la marcación muestra **En el sitio** cuando se hizo a menos de unos 250 m de la dirección del trabajo, o **a 2,1 km** cuando no — una pregunta para el gerente, no un veredicto.",
            "No se muestra ninguna posición cuando el teléfono no respondió, el trabajo no tiene dirección del sitio o la lectura fue demasiado imprecisa para confiar en ella.",
            "Rechazar el permiso no cambia nada de la marcación. La respuesta se recuerda durante la sesión; no se le vuelve a preguntar en el siguiente toque.",
          ] },
        ],
      },
      {
        id: "what-happens-to-the-hours",
        heading: "Adónde van las horas",
        blocks: [
          { bullets: [
            "Cada entrada queda **pendiente** hasta que un gerente la aprueba en las **Hojas de tiempo**; las horas aprobadas alimentan la nómina.",
            "Las horas en un trabajo alimentan el costeo de ese trabajo como mano de obra. Las horas sin trabajo se cuentan y se nombran como no atribuidas en el panel de costeo en lugar de perderse. Vea [[job-costing|Costeo del trabajo: presupuestado contra real]].",
            "Corregir su propia entrada la devuelve a pendiente para que se revise de nuevo.",
          ] },
        ],
      },
      {
        id: "who-can-see-it",
        heading: "Quién puede usarlo",
        blocks: [
          { p: "Cualquiera con una ficha de trabajador, en todos los niveles de acceso — el reloj se limita a la persona conectada y nadie puede marcar por otra. Sin ficha de trabajador la pantalla dice « Aún no estás configurado como trabajador. Pide a un administrador que te agregue en Equipo. »" },
        ],
      },
    ],
    faq: [
      { q: "¿Necesito la aplicación?", a: "No. El reloj de tiempo es una página web que funciona en cualquier teléfono. Vea [[clock-in-and-out-on-your-phone|Registrar entrada y salida desde su teléfono]]." },
      { q: "¿FieldQuo rastrea dónde estoy durante el día?", a: "No. Pide una posición en el momento en que toca, si usted lo permite, y nada entre medio." },
      { q: "Ayer olvidé registrar la salida.", a: "La entrada sigue abierta. Registre la salida ahora y avise a su gerente — las horas se corrigen en las hojas de tiempo antes de aprobarse." },
    ],
  },
};
