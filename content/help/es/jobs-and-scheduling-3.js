// content/help/es/jobs-and-scheduling-3.js
//
// Parte 3 de la categoría «jobs-and-scheduling» en español (ver el compositor,
// jobs-and-scheduling.js). Slugs de esta parte (lib/help/tree.js):
// timesheets-and-approving-hours, time-off-requests, safety-incidents,
// job-costing, materials-on-a-job, cancel-or-archive-a-job,
// when-a-job-is-completed, a-chat-room-for-every-job,
// supervisor-required-visits.
//
// Misma estructura que el inglés, sección por sección, bloque por bloque. Las
// palabras en pantalla son las cadenas del bloque `es` de
// app/i18n/appMessages.js; donde una pantalla todavía imprime una etiqueta en
// inglés fija en el código, se cita tal cual. Los nombres de los niveles de
// acceso (Crew, Estimator, Dispatcher, Manager) y las etiquetas de la
// cuadrícula de permisos están en inglés en todas las pantallas, y por eso
// también aquí.
export const ARTICLES = {
  "timesheets-and-approving-hours": {
    title: "Hojas de horas: revisar y aprobar horas",
    summary:
      "La pantalla donde la oficina revisa cada fichaje, ve dónde estaba el teléfono en ese momento, aprueba las horas que una nómina puede usar y registra un fichaje que alguien olvidó.",
    updated: "2026-09-12",
    intro: [
      "La cuadrilla marca entrada y salida en el **Reloj de tiempo**; la oficina revisa el resultado en **Hojas de horas**. Nada llega a una nómina hasta que alguien presiona **Aprobar**, y nada en esta pantalla se le oculta a la persona que trabajó las horas: el registro que ve en su teléfono es la fila que usted ve aquí.",
      "Este artículo explica qué muestra cada fila, qué significan y qué no significan las etiquetas de posición, cómo agregar un fichaje olvidado y quién puede aprobar, editar o eliminar un registro.",
    ],
    sections: [
      {
        id: "overview",
        heading: "Resumen",
        blocks: [
          { p: "Hojas de horas está en la barra lateral bajo **Personas**, junto a **Reloj de tiempo** y **Ausencias**. El encabezado dice **Hojas de horas — Revisa y aprueba las horas registradas.** Debajo hay una fila por fichaje, del más reciente al más antiguo, de toda la empresa: no es una vista semanal y no se filtra por persona." },
          { p: "Un registro queda pendiente («pending» en pantalla) desde que se marca la salida hasta que alguien lo aprueba; una fila todavía en turno muestra **En curso** en lugar de un número de horas. Solo las horas aprobadas las cuentan [[payroll-runs|una nómina]] y [[job-costing|el costeo del trabajo]]; las horas pendientes se indican al lado como no contadas, nunca se suman en silencio." },
        ],
      },
      {
        id: "on-the-screen",
        heading: "Qué hay en la pantalla",
        blocks: [
          { bullets: [
            "**Agregar entrada**, arriba a la derecha: abre el formulario **Nueva entrada de tiempo**. Solo aparece cuando existe al menos un trabajador; si no, la página dice **Agrega primero un trabajador en Trabajadores, luego registra sus horas aquí.**",
            "Cada fila: el nombre del trabajador, la fecha, y las horas (**7.5h**) o **En curso**.",
            "Dos etiquetas bajo el nombre: **Entrada · En el sitio**, **Entrada · a 2,1 km** o **Entrada · —**, y lo mismo para **Salida** una vez marcada la salida.",
            "A la derecha: **Registrar salida** en una fila todavía abierta, **Aprobar** en una fila pendiente con horas, la palabra de estado en todo lo demás, y una ✕ para eliminar una fila aún no aprobada.",
            "Una fila aprobada por la misma persona que trabajó las horas lleva **· autoaprobado** en ámbar.",
            "La leyenda al pie: **La posición se captura solo en el momento en que tocan Marcar entrada o Marcar salida, con su permiso. Nada se rastrea entre medio. Una bandera es una pregunta para ti, no un veredicto.**",
          ] },
          { figure: "harness:timesheets", caption: "Hojas de horas — una fila por fichaje, las etiquetas de Entrada y Salida, un botón Aprobar en las filas pendientes y la leyenda de posición debajo." },
        ],
      },
      {
        id: "approve-hours",
        heading: "Cómo aprobar horas",
        blocks: [
          { steps: [
            "Abra **Hojas de horas** desde la barra lateral.",
            "Lea la fila: la fecha, las horas y las dos etiquetas. Una etiqueta ámbar significa que el fichaje ocurrió a más de 250 m de la dirección del trabajo: mire, y luego decida.",
            "Presione **Aprobar**. La fila pasa a «approved» y las horas quedan disponibles para la próxima nómina y para el costo del trabajo.",
            "Una fila todavía **En curso** no se puede aprobar. Presione primero **Registrar salida** (la hora de fin es ahora) o espere a que la persona marque su salida.",
          ] },
          { note: "Aprobar sus propias horas está permitido — quien trabaja solo no tiene a nadie más a quien pedírselo —, pero queda señalado: la fila dice **· autoaprobado**, la nómina lo dice, y el [[the-activity-log|registro de actividad]] lo guarda como una acción aparte." },
          { warning: "Un registro aprobado queda cerrado. Solo un propietario, un administrador, un Dispatcher o un Manager pueden cambiarlo o reabrirlo, porque esas horas pueden estar ya en un recibo de pago. Un miembro de la cuadrilla que corrige sus propias horas — la salida olvidada es el caso típico — devuelve el registro a «pending» para que se revise de nuevo." },
        ],
      },
      {
        id: "add-an-entry",
        heading: "Cómo registrar a mano un fichaje olvidado",
        blocks: [
          { steps: [
            "Presione **Agregar entrada**. Se abre el formulario **Nueva entrada de tiempo**.",
            "Elija el **Trabajador**, la **Fecha** (hoy viene prellenada), la hora de **Inicio** y, si el turno ya terminó, la hora de **Fin (opcional)**.",
            "Presione **Guardar**. Las horas se calculan en el servidor en la zona horaria de su empresa, así que un registro de 9:00 a 17:00 son 8 horas esté donde esté la persona que lo guarda.",
          ] },
          { p: "Deje **Fin (opcional)** vacío y el registro se queda **En curso** hasta que alguien presione **Registrar salida**. Un registro manual no tiene etiquetas de posición que mostrar — nadie tocó un teléfono —, así que ambas etiquetas dicen **—**." },
        ],
      },
      {
        id: "the-position-chips",
        heading: "Qué significan las etiquetas de posición",
        blocks: [
          { table: {
            head: ["Etiqueta", "Qué significa"],
            rows: [
              ["**Entrada · En el sitio**", "El teléfono respondió en el momento del fichaje y estaba a menos de 250 m de la dirección geolocalizada del trabajo."],
              ["**Entrada · a 2,1 km**", "El teléfono respondió y estaba a más de 250 m de la dirección. En ámbar, porque es una pregunta: la persona pudo estacionarse calle arriba, o pudo no estar ahí."],
              ["**Entrada · —**", "No se puede afirmar nada: el teléfono no respondió, el trabajo no tiene una dirección ubicable en el mapa, el registro se escribió a mano, o la lectura era demasiado imprecisa para confiar en ella (un círculo de precisión más ancho que el radio)."],
            ],
          } },
          { p: "El radio de 250 m es fijo; no es un ajuste. La posición se pide una vez por fichaje y solo con el permiso de la persona; FieldQuo nunca guarda una ruta, un recorrido ni una ubicación entre fichajes, y nunca dibuja a nadie en un mapa: la hoja de horas muestra la distancia al sitio y nada más. La etiqueta nunca desactiva **Aprobar**; la decisión sigue siendo suya." },
        ],
      },
      {
        id: "who-can-see-it",
        heading: "Quién puede verlo",
        blocks: [
          { p: "La página se abre para quien puede gestionar personas: el propietario, los administradores y los niveles **Dispatcher** y **Manager**. La fila de la barra lateral aparece en el nivel **Time Tracking & Timesheets** «View, record, edit, and delete everyone's», que esos mismos preajustes tienen. **Crew** y **Estimator** están en «View, record, and edit their own»: no ven esta fila, y sus propios registros viven en el [[the-time-clock|Reloj de tiempo]]." },
          { bullets: [
            "**Aprobar**: propietario, administrador, Dispatcher, Manager.",
            "**Registrar salida** de otra persona, o editar sus horas: el mismo nivel «everyone's».",
            "**✕ Eliminar**: el nivel «everyone's», y nunca en una fila aprobada — el servidor lo rechaza, así que el botón no se muestra. Eliminar pregunta primero: **¿Eliminar este registro de tiempo?**",
          ] },
        ],
      },
    ],
    faq: [
      { q: "¿Por qué una fila no tiene botón Aprobar?", a: "O sigue En curso (marque primero la salida) o ya está aprobada. Una fila aprobada no tiene botón ni ✕." },
      { q: "¿Una fila marcada impide que la persona cobre?", a: "No. La etiqueta no cambia nada por sí sola; las horas llegan a la nómina solo cuando usted las aprueba, marcadas o no." },
      { q: "¿Puedo ver en qué trabajo se hicieron las horas?", a: "En esta lista no: muestra el trabajador, la fecha y las horas. El trabajo aparece en el registro del Reloj de tiempo de la persona y en el panel de costos del trabajo una vez aprobadas las horas." },
      { q: "¿De dónde sale la tarifa por hora?", a: "De la ficha del trabajador en Configuración → Trabajadores. Un trabajador sin tarifa sigue con sus horas aprobadas contadas, pero no suma costo de mano de obra al trabajo, y el panel de costos lo dice en lugar de mostrar un trabajo más barato." },
    ],
  },

  "time-off-requests": {
    title: "Solicitudes de tiempo libre",
    summary:
      "Cómo cualquier persona del equipo pide tiempo libre, cómo la solicitud encuentra al gerente correcto, qué cambia aprobarla en el calendario y en el saldo, y quién puede hacer qué.",
    updated: "2026-09-12",
    intro: [
      "**Tiempo libre** es una sola pantalla con dos públicos. Todos ven sus propios saldos y solicitudes y pueden pedir días libres; un gerente tiene además una pestaña **Equipo** con las solicitudes que lo esperan, quién se ausenta próximamente y los saldos de todos.",
      "Los saldos vienen de las políticas que un propietario configura en **Configuración → Políticas de ausencias**; vea [[time-off-policies|Políticas de tiempo libre]]. Sin una política no hay contra qué solicitar, y la pantalla lo dice.",
    ],
    sections: [
      {
        id: "overview",
        heading: "Resumen",
        blocks: [
          { p: "El encabezado dice **Tiempo libre — Solicita tiempo libre y consulta lo que te queda.** Para un gerente, dos botones a la derecha alternan entre **Míos** y **Equipo**; el botón **Equipo** lleva el número de solicitudes todavía pendientes." },
          { p: "Una solicitud tiene cuatro estados, mostrados como etiqueta en su fila: **Pendiente**, **Aprobada**, **Rechazada** y **Cancelado**. El tiempo libre aprobado es lo que lee el resto del producto: el [[the-scheduler-and-crew-shifts|planificador]] se niega a poner un turno sobre un día libre aprobado, y la página pública de reservas deja de ofrecer los horarios de esa persona esos días. Una solicitud pendiente no cambia ninguna de las dos cosas." },
        ],
      },
      {
        id: "on-the-screen",
        heading: "Qué hay en la pantalla",
        blocks: [
          { bullets: [
            "**Míos**: una tarjeta de saldo por política (por ejemplo **Vacaciones**, **Enfermedad**, **Personal**) con los días que quedan, luego **Acumulado**, **Tomado** y, cuando hay algo pendiente, **Pendiente de aprobación**. Una política de pago de vacaciones muestra dinero acumulado en lugar de días.",
            "**Tus solicitudes** con el botón **Solicitar tiempo libre**, y luego cada solicitud: la política, la etiqueta, las fechas, el número de días, su nota y **Withdraw** en una solicitud que todavía puede retirar.",
            "**Equipo**: **Pendiente de aprobación** con **Aprobar** y **Rechazar** en cada solicitud, **Quién se ausenta próximamente**, **Saldos de este año** como tabla (**Persona**, **Política**, **Acumulado**, **Tomado**, **Restante**) y **Anteriores**.",
          ] },
          { figure: "harness:time-off", caption: "Tiempo libre — las tarjetas de saldo, Tus solicitudes y una solicitud pendiente con su botón Withdraw." },
        ],
      },
      {
        id: "request-time-off",
        heading: "Cómo solicitar tiempo libre",
        blocks: [
          { steps: [
            "Abra **Tiempo libre** y presione **Solicitar tiempo libre**.",
            "Elija el **Tipo**: la política. Al lado, el formulario dice cuántos días tiene disponibles, o que las ausencias sin sueldo no están limitadas por un saldo.",
            "Fije **Primer día** y **Último día**. Para un solo día, marque **Solo medio día** para pedir 0,5.",
            "Agregue una **Nota (opcional)** — *Algo que tu gerente deba saber* — y presione **Enviar solicitud**.",
          ] },
          { p: "Los días se cuentan sobre sus propios días laborables (según [[working-hours-and-bookable-hours|sus horas de trabajo]]; de lunes a viernes si no hay nada configurado), así que una solicitud de viernes a lunes son dos días, no cuatro. La solicitud se rechaza si se superpone con una que ya tiene pendiente o aprobada, o si necesita más días de los que le quedan después de descontar lo ya pendiente." },
          { note: "Una política que no requiere aprobación se reserva sola: el formulario dice **Este tipo se aprueba automáticamente: al enviarlo queda reservado.** De lo contrario, la fila dice a quién espera: «Waiting on Marie.»" },
        ],
      },
      {
        id: "where-a-request-goes",
        heading: "Adónde va una solicitud",
        blocks: [
          { p: "Cada trabajador tiene un campo «Reports to» en **Configuración → Trabajadores**. Una solicitud va primero a ese gerente. Si el gerente está él mismo con ausencia aprobada ese día, escala al gerente de su gerente, y la fila lo dice: «escalated because Marie is away». Sin nadie configurado, o con todos los de arriba ausentes, espera a un propietario o administrador." },
          { p: "Todos los que pueden gestionar personas reciben una notificación «Tiempo libre solicitado» en su bandeja. Nadie puede aprobar su propia solicitud; el servidor responde que su tiempo libre va a su gerente. Una persona puede aprobar las solicitudes de cualquiera que esté por debajo de ella en la línea de reporte; un propietario, un administrador, un Dispatcher o un Manager pueden aprobar las de todos." },
        ],
      },
      {
        id: "what-each-action-changes",
        heading: "Qué cambia cada acción",
        blocks: [
          { table: {
            head: ["Acción", "Qué pasa"],
            rows: [
              ["**Aprobar**", "El saldo se vuelve a comprobar en ese momento — otras solicitudes pueden haberse aprobado entre tanto —, luego los días se descuentan del saldo, la etiqueta pasa a **Aprobada** y los días entran al calendario para la planificación y las reservas."],
              ["**Rechazar**", "La etiqueta pasa a **Rechazada**. No se descuenta nada del saldo."],
              ["**Withdraw**", "Disponible para quien solicitó, en una solicitud pendiente o aprobada que aún no ha empezado. Una solicitud aprobada devuelve sus días al saldo. Pasado el primer día, solo un gerente puede cancelarla."],
            ],
          } },
          { p: "Cada aprobación, rechazo y cancelación se escribe en el [[the-activity-log|registro de actividad]] con la política y el número de días." },
        ],
      },
      {
        id: "who-can-see-it",
        heading: "Quién puede verlo",
        blocks: [
          { p: "Todos los niveles de acceso ven **Tiempo libre** y la pestaña **Míos**. La pestaña **Equipo** aparece solo cuando el servidor lo permite: el propietario, los administradores, **Dispatcher** y **Manager**. Una persona que puede ver las solicitudes del equipo pero no está en la línea de reporte de nadie ni puede gestionar personas las ve en modo de solo lectura: **Puedes ver las solicitudes, pero no aprobarlas.**" },
        ],
      },
    ],
    faq: [
      { q: "¿Por qué mi solicitud dice que espera a un propietario?", a: "No hay gerente configurado en su ficha de trabajador, o todos los que están por encima de usted se ausentan hoy. Un propietario o administrador fija «Reports to» en Configuración → Trabajadores." },
      { q: "¿Un gerente puede reservar tiempo libre para otra persona?", a: "No. La solicitud siempre la hace quien toma el tiempo; un gerente la aprueba, la rechaza o la cancela." },
      { q: "¿Una solicitud pendiente bloquea el horario?", a: "No. Solo el tiempo libre aprobado lo leen el planificador y la página de reservas. Una solicitud que nadie ha respondido no cambia nada." },
    ],
  },

  "safety-incidents": {
    title: "Incidentes de seguridad y casi accidentes",
    summary:
      "Un miembro de la cuadrilla reporta una lesión, un casi accidente o un daño material desde la obra en menos de un minuto; un gerente da seguimiento, fija el estado y anota lo que se hizo.",
    updated: "2026-09-12",
    intro: [
      "**Seguridad** es el lugar donde un incidente queda escrito mientras está fresco: por la persona que estaba ahí, desde su teléfono, sin pedirle permiso a nadie. El encabezado dice por qué: **Lesiones y casi accidentes. Un casi accidente vale la pena reportarlo igual que una lesión: así se aprende antes de que alguien salga lastimado.**",
      "Reportar está abierto a todos los niveles de acceso. Leer los reportes de todos y darles seguimiento es un permiso aparte, más alto, porque un reporte que nombra a un empleado lesionado es delicado.",
    ],
    sections: [
      {
        id: "overview",
        heading: "Resumen",
        blocks: [
          { p: "La pantalla es un botón **Reportar**, los filtros **Todos / Abierto / Revisado / Cerrado** y una tarjeta por incidente. Cada tarjeta muestra el tipo — **Casi accidente**, **Lesión**, **Daño material** u **Otro** —, una insignia roja **Se detuvo el trabajo** cuando el trabajo se detuvo, cuándo pasó, la descripción, dónde, en qué trabajo, **Reportado por** quién, la nota sobre el reporte si la hay, hasta seis fotos y el estado a la derecha. Cuando no se ha presentado nada, la lista dice **No hay nada reportado — Eso es bueno.**" },
          { figure: "harness:safety", caption: "Seguridad — el botón Reportar, los filtros de estado y dos tarjetas de incidente con su desplegable Seguimiento." },
        ],
      },
      {
        id: "report-an-incident",
        heading: "Cómo reportar un incidente",
        blocks: [
          { steps: [
            "Abra **Seguridad** y presione **Reportar**.",
            "Elija **Qué tipo de incidente** y **Cuándo pasó** (ahora viene prellenado).",
            "Escriba **Qué pasó** — *Con tus propias palabras — corto está bien.* Es el único texto obligatorio.",
            "Agregue **Dónde** y elija el **Trabajo (opcional)** al que pertenece, o déjelo en **No está ligado a un trabajo**.",
            "Marque **El trabajo se detuvo por esto** si así fue, y agregue una **Nota sobre el reporte (opcional)** para cualquier cosa sobre reportarlo a una autoridad provincial.",
            "Presione **Presentar reporte**. La pantalla ofrece entonces **Agrega una foto del lugar si tienes una — es opcional**; agregue hasta seis y presione **Listo**.",
          ] },
          { warning: "Si su lista de trabajos no se pudo cargar, el formulario lo dice en ámbar y el reporte quedaría registrado sin ningún trabajo. Recargue antes de presentarlo si pertenece a uno: nadie vuelve después a corregir eso." },
        ],
      },
      {
        id: "follow-up",
        heading: "Cómo da seguimiento un gerente",
        blocks: [
          { p: "Cada tarjeta tiene un desplegable **Seguimiento** para quien tenga el nivel de seguimiento. Ábralo, fije el estado — **Abierto**, **Revisado** o **Cerrado** —, escriba **Qué se hizo al respecto** y presione **Guardar**. FieldQuo deja constancia de quién lo revisó y cuándo. Los filtros de estado de arriba leen ese mismo estado." },
          { p: "La nota sobre el reporte es deliberadamente una nota, no un flujo. FieldQuo no conoce las reglas ni los plazos de reporte de su provincia y no presenta nada ante una autoridad por usted; el campo es donde anota lo que decidió." },
        ],
      },
      {
        id: "what-fieldquo-does-not-do",
        heading: "Qué no hace FieldQuo",
        blocks: [
          { bullets: [
            "No le manda un mensaje a nadie cuando se presenta un reporte. El reporte aparece en esta pantalla y en el [[the-activity-log|registro de actividad]]; si quiere que un gerente se entere de inmediato, dígaselo.",
            "No detiene el reloj, no cancela la visita ni cambia el estado del trabajo cuando se marca **Se detuvo el trabajo**. La insignia registra el hecho; el horario lo cambia usted.",
            "No nombra a la persona lesionada por separado de quien reporta. El reporte dice quién lo presentó; quién se lastimó va en la descripción.",
          ] },
        ],
      },
      {
        id: "only-in-fieldquo",
        heading: "Solo en FieldQuo",
        blocks: [
          { p: "Un registro de seguridad que un miembro de la cuadrilla puede llenar desde un teléfono, con el seguimiento del gerente en la misma tarjeta, no aparece en la página de precios de Jobber, Housecall Pro, ServiceTitan, QuoteIQ ni Projul en ningún nivel, que es la prueba que usan las páginas de comparación de FieldQuo. Otras herramientas ponen esto en una aplicación de seguridad aparte; aquí está junto al trabajo y al reloj que la misma cuadrilla ya usa." },
        ],
      },
      {
        id: "who-can-see-it",
        heading: "Quién puede verlo",
        blocks: [
          { table: {
            head: ["Nivel Safety Incidents", "Qué permite", "Quién lo tiene por defecto"],
            rows: [
              ["«Report incidents, and view their own»", "Presentar un reporte; ver los reportes que usted presentó.", "Crew, Estimator"],
              ["«View everyone's incidents»", "Ver todos los reportes de la empresa y usar los filtros de estado.", "Nadie por defecto: se concede en el editor de acceso personalizado"],
              ["«View everyone's incidents and follow up on them»", "Todo lo anterior, más **Seguimiento**.", "Dispatcher, Manager, los administradores, el propietario"],
            ],
          } },
          { p: "La fila de la barra lateral desaparece solo para alguien puesto explícitamente en «No access». El servidor comprueba el mismo nivel en cada petición, así que ocultar la fila no es lo que protege un reporte." },
        ],
      },
    ],
    faq: [
      { q: "¿Un miembro de la cuadrilla puede ver el reporte de un compañero?", a: "No en el nivel por defecto. «Report incidents, and view their own» significa los reportes que él presentó, y nada más, incluso uno sobre un incidente en el que estuvo involucrado pero que no presentó." },
      { q: "¿Un reporte se puede editar o eliminar después de presentarlo?", a: "Eliminar no, y la descripción nunca se reescribe. Un gerente puede cambiar el estado, las notas de seguimiento, la nota sobre el reporte y la marca Se detuvo el trabajo; lo que pasó queda como lo escribió quien reportó." },
      { q: "¿Un incidente aparece en el trabajo?", a: "La tarjeta nombra el trabajo, y se puede elegir un trabajo al presentarlo. La página del trabajo en sí no lista incidentes." },
    ],
  },

  "job-costing": {
    title: "Costeo del trabajo: presupuestado contra real",
    summary:
      "Lo que un trabajo costó de verdad — horas aprobadas, recibos, subcontratistas, gastos generales — junto a lo que usted presupuestó, y el cierre que pregunta si sus tarifas deben cambiar.",
    updated: "2026-09-12",
    intro: [
      "Un presupuesto lleva un costo estimado: materiales, horas de mano de obra, una parte de gastos generales, un margen objetivo (vea [[cost-and-margin-on-a-quote|Costo y margen en un presupuesto]]). Luego el trabajo ocurre. El costeo del trabajo es la otra mitad — lo que costó de verdad —, mostrada en la página del trabajo como **Lo que ha costado este trabajo** y comparada línea por línea con la estimación cuando el trabajo termina.",
      "Nada de esto se adivina. Es la suma de cosas que se registraron: horas que alguien aprobó, gastos que alguien asignó, el precio acordado con un subcontratista, los gastos generales que usted le indicó a FieldQuo. Donde falta un número, el panel lo dice en lugar de mostrar un trabajo más barato.",
    ],
    sections: [
      {
        id: "overview",
        heading: "Resumen",
        blocks: [
          { p: "El panel aparece en la página del trabajo solo cuando algo se ha registrado contra el trabajo, y solo para quien tenga activado el interruptor **Job costing**. Muestra **Gastos**, **Mano de obra** (con **{hours} h aprobadas**), **Subcontratistas**, **Gastos generales** y **Costo total**; luego **Presupuestado**, **Cambios aprobados** y **Valor contratado actual** cuando hay órdenes de cambio; luego **Queda después de costos** y **Margen**; y **Gasto por categoría** debajo." },
          { p: "Las mismas cifras alimentan los indicadores de ganancia y de precisión de estimaciones del tablero de KPI, y por eso esa pantalla también exige el interruptor." },
        ],
      },
      {
        id: "what-counts-as-cost",
        heading: "Qué cuenta como costo",
        blocks: [
          { table: {
            head: ["Línea", "De dónde sale", "Regla"],
            rows: [
              ["**Mano de obra**", "Los registros de tiempo aprobados en este trabajo × la tarifa por hora del trabajador (Configuración → Trabajadores).", "Las horas pendientes se muestran pero no se costean. Un trabajador sin tarifa suma horas y nada de dinero, y el panel dice cuántas horas están sin tarifa."],
              ["**Gastos**", "Los gastos asignados a este trabajo en el [[expense-tracking-and-burn-rate|seguimiento de gastos]], por categoría.", "Los pagos a subcontratistas se omiten aquí para no contarlos dos veces."],
              ["**Subcontratistas**", "El monto acordado con cada subcontratista del trabajo (acordado, terminado o pagado).", "Una oferta cotizada pero no acordada se muestra como **+{amount} cotizados, no acordados** y queda fuera del total."],
              ["**Gastos generales**", "Su costo por trabajo desde [[overhead-and-your-minimum-price|Configuración → Gastos generales]].", "Ausente, no cero, hasta que llene esa pantalla: un trabajo no se puede costear contra unos gastos generales que nadie ha indicado."],
              ["**Equipo**", "Sus propios activos registrados en el trabajo.", "Informativo, y sumado al total solo cuando no hay gastos generales configurados; de lo contrario, la parte de gastos generales ya lleva la depreciación."],
            ],
          } },
        ],
      },
      {
        id: "the-comparison",
        heading: "Presupuestado contra real",
        blocks: [
          { p: "**Presupuestado** es el total del presupuesto. **Valor contratado actual** le suma las órdenes de cambio aprobadas. **Queda después de costos** es ese valor contratado menos el **Costo total**, y **Margen** es lo mismo en porcentaje. La desviación respecto al costo *estimado* se calcula aparte: si falta cualquiera de los dos lados — no hay presupuesto costeado, o no se ha registrado nada todavía —, no hay porcentaje, porque un trabajo sin nada registrado no «está dentro del presupuesto»." },
          { p: "Los registros de tiempo fichados durante las fechas del trabajo pero nunca asignados a un trabajo se listan como no asignados, con la nota **Asigna esas entradas a un trabajo en la hoja de horas y llegarán aquí.**" },
          { note: "Los precios marcados en la lista **Materials to buy** del trabajo no están en el **Costo total**. Van a su historial de precios; un recibo que deba contar contra este trabajo se registra como gasto, y el cierre ofrece **Añadir un material o recibo a este trabajo** exactamente para eso." },
        ],
      },
      {
        id: "the-close-out",
        heading: "El cierre cuando un trabajo se completa",
        blocks: [
          { p: "Marcar un trabajo como **Completado** abre la revisión una vez: **Este trabajo terminó — ¿y su costo?** con un botón **Revisar costos reales**, y una tarea «Review what \"…\" actually cost» con vencimiento en tres días. La revisión se lee de arriba abajo:" },
          { steps: [
            "**Mano de obra: horas estimadas vs aprobadas**: las horas del presupuesto contra las aprobadas, con las horas pendientes y sin tarifa señaladas y un enlace **Aprobar horas** a las hojas de horas.",
            "**Materiales: lo que decía la estimación vs lo que usaste**: cada línea del trabajo con una casilla para lo que realmente usó; **Añadir un material o recibo a este trabajo** registra como gasto un recibo que nunca se cargó.",
            "El veredicto: estimado, real, la diferencia, el margen. Si el trabajo superó su umbral, una sola pregunta: **Este trabajo costó {pct}% más de lo presupuestado. ¿Actualizar tus costos según lo que realmente costó?** con **Actualizar** y **Dejar como está**.",
            "**El costo está completo** firma el cierre y resuelve la tarea. **Todavía no** deja todo abierto.",
          ] },
          { figure: "live:app-settings-material-costs", caption: "Configuración → Costos de materiales — el umbral de arriba decide cuándo el cierre pregunta si conviene revisar sus costos." },
          { p: "**Actualizar** abre sugerencias línea por línea, cada una con un botón solo donde existe una tarifa guardada que mover. Nada se aplica sin presionar, y la respuesta se registra una sola vez: a un trabajo nunca se le pregunta dos veces. El umbral está en **Configuración → Costos de materiales**, por defecto **15%**; un trabajo que costó menos de lo estimado nunca pregunta." },
        ],
      },
      {
        id: "who-can-see-it",
        heading: "Quién puede verlo",
        blocks: [
          { p: "El interruptor **Job costing** está activado para el propietario, los administradores y el preajuste **Manager**, y desactivado para **Dispatcher**, **Estimator** y **Crew**. Sin él, el panel no se muestra, la ruta de costeo rechaza la petición y las columnas de costo de la lista de materiales quedan en blanco. El interruptor requiere «See prices», seguimiento de tiempo, gastos y acceso a trabajos, y un propietario puede concedérselo a cualquier persona en el [[the-custom-access-editor|editor de acceso personalizado]]." },
        ],
      },
    ],
    faq: [
      { q: "¿Por qué falta el panel en un trabajo nuevo?", a: "Todavía no se ha registrado nada. Aparece en cuanto existe una hora aprobada, un gasto, un subcontratista o un registro de equipo en el trabajo." },
      { q: "¿Por qué mi margen es más alto de lo que esperaba?", a: "Busque horas pendientes, trabajadores sin tarifa y una pantalla de Gastos generales vacía. Cada uno se nombra en el panel; cada uno hace que el real sea menor que la realidad hasta que se llena." },
      { q: "¿El cliente ve algo de esto?", a: "No. El costo, el margen y la comparación son internos. El presupuesto y la factura que recibe el cliente llevan solo precios." },
    ],
  },

  "materials-on-a-job": {
    title: "Materiales en un trabajo",
    summary:
      "La lista de compras del trabajo: qué comprar, derivado del presupuesto, marcado en el almacén, con el recibo y la cantidad realmente usada registrados en cada línea.",
    updated: "2026-09-12",
    intro: [
      "Cada página de trabajo tiene un panel **Materials to buy**. Para los oficios que FieldQuo mide — techos, pintura por área, revestimiento, aislamiento, pavimentación y los oficios con receta como el reacabado de gabinetes —, las líneas se derivan del presupuesto: cuadros en paquetes, área y profundidad de base en yardas cúbicas. Para todo lo demás, usted agrega líneas a mano.",
      "La lista es interna. Nada de ella llega al cliente; es la lista del almacén, no el presupuesto.",
    ],
    sections: [
      {
        id: "overview",
        heading: "Resumen",
        blocks: [
          { p: "El encabezado del panel dice **Materials to buy**, seguido de «3 of 10 bought» cuando hay líneas. Cada línea muestra una casilla, el nombre, la cantidad y la unidad, y a la derecha el costo estimado, lo que costó realmente una vez comprada, «no price set», o **—** para alguien que no puede ver costos. Una línea comprada aparece tachada, con su proveedor debajo y, cuando se registró, cuántos se usaron realmente." },
          { p: "Mientras quede algo por comprar, la lista de Tareas lleva una sola tarea — «Buy materials — 204 Avro Cir · 3 of 10 bought» — que se actualiza con cada marca y se cierra sola cuando todo está comprado." },
        ],
      },
      {
        id: "rebuild-from-the-quote",
        heading: "Cómo construir la lista desde el presupuesto",
        blocks: [
          { steps: [
            "Abra el trabajo y busque **Materials to buy**.",
            "Presione **Rebuild from the quote**. FieldQuo lee el levantamiento o las respuestas de admisión del presupuesto con sus tarifas tal como están hoy y escribe una línea por material.",
            "Presiónelo otra vez después de revisar el presupuesto. Las líneas ya marcadas como compradas y las líneas agregadas a mano se conservan; solo se reemplazan las líneas derivadas no compradas.",
          ] },
          { note: "Un trabajo sin presupuesto detrás responde que no hay presupuesto del cual derivar materiales. Agregue líneas a mano." },
        ],
      },
      {
        id: "tick-a-line",
        heading: "Cómo marcar una línea",
        blocks: [
          { steps: [
            "Toque la casilla junto a la línea. Se abren «What it cost» (*total on the receipt*), **¿Cuánto usó realmente?** (prellenado con la estimación) y «Supplier».",
            "Llene lo que tenga — nada es obligatorio — o presione «Scan the receipt» para fotografiar el recibo de caja y que el total se lea por usted, para confirmarlo.",
            "Presione «Bought». La línea queda tachada y el conteo sube.",
          ] },
          { p: "Un precio ingresado al marcar no es adorno: se escribe en el historial de precios de materiales de su empresa, y así es como los costos unitarios que los libros de precios traen vacíos se llenan con lo que usted pagó de verdad. Desmarcar una línea borra su recibo y su proveedor de la línea, pero esa entrada del historial de precios se queda: la compra sí ocurrió." },
        ],
      },
      {
        id: "what-each-control-changes",
        heading: "Qué cambia cada control",
        blocks: [
          { table: {
            head: ["Control", "Qué hace"],
            rows: [
              ["«Add a line»", "Agrega una línea escrita a mano (*What else does this job need?*) con cantidad y unidad. Las líneas agregadas a mano sobreviven a una reconstrucción y su cantidad sigue editable."],
              ["«Rebuild from the quote»", "Reemplaza las líneas derivadas no compradas con una derivación nueva. Nunca quita una línea comprada o agregada a mano."],
              ["«Bought»", "Registra quién compró y cuándo; guarda el costo, el proveedor y la cantidad usada; escribe el precio en su historial."],
              ["«Remove»", "Elimina la línea de este trabajo. Su entrada en el historial de precios, si la hay, se queda."],
            ],
          } },
        ],
      },
      {
        id: "who-can-see-it",
        heading: "Quién puede verlo",
        blocks: [
          { p: "Cualquiera que pueda abrir el trabajo puede leer la lista — un miembro de la cuadrilla en el mostrador del proveedor la necesita, y un acceso **Crew** ve los trabajos en los que está asignado. Marcar, agregar, reconstruir y quitar requieren «Jobs: View, create, and edit» (**Dispatcher**, **Manager**, los administradores, el propietario); sin ese nivel, las casillas se muestran pero no se pueden presionar. Las casillas de costo y «Scan the receipt» aparecen solo con el interruptor **Job costing**; la cantidad y el proveedor se ofrecen a todos los que pueden marcar." },
        ],
      },
    ],
    faq: [
      { q: "¿Por qué una línea dice «no price set»?", a: "El libro de precios todavía no tiene un costo unitario para ella. Ingrese lo que pagó al marcarla y ese pasa a ser el precio que FieldQuo conoce." },
      { q: "¿Por qué no puedo cambiar la cantidad de una línea derivada?", a: "Esa cantidad es la estimación, y el cierre compara lo que usó contra ella. Registre el número real en «¿Cuánto usó realmente?»." },
      { q: "¿Marcar una línea crea un gasto?", a: "No. Registra el costo en la línea y en su historial de precios, y nada más. El panel de costos del trabajo suma gastos, horas aprobadas, subcontratistas y gastos generales — no los precios de esta lista —, así que un recibo que deba contar contra el trabajo se agrega como gasto, cosa que el cierre le ofrece hacer." },
    ],
  },

  "cancel-or-archive-a-job": {
    title: "Cancelar o archivar un trabajo",
    summary:
      "Cancelado dice que el trabajo no ocurrió; Archivado dice que usted terminó de mirarlo. Son hechos distintos, viven en controles distintos y uno de ellos es reversible.",
    updated: "2026-09-12",
    intro: [
      "Un trabajo tiene un estado — **Falta fecha**, **Programado**, **En curso**, **Completado**, **Cancelado** — y, por separado, puede estar **Archivado**. Un trabajo puede estar Completado *y* archivado; puede estar Cancelado y seguir en la lista. Este artículo dice qué cambia cada uno y cuál usar.",
    ],
    sections: [
      {
        id: "overview",
        heading: "Resumen",
        blocks: [
          { table: {
            head: ["Qué cambia", "Cancelar", "Archivar"],
            rows: [
              ["Qué dice", "El trabajo no ocurrió, o no va a ocurrir.", "Guardado. No dice nada sobre el trabajo."],
              ["Dónde", "El desplegable de estado en la página del trabajo.", "El botón **Archivar** en la página del trabajo."],
              ["La lista de Trabajos", "Se muestra bajo la etiqueta **Cancelado**.", "Oculto hasta que presione el interruptor **Archivados**."],
              ["El calendario", "Sus visitas se quedan hasta que usted cancele cada una.", "Sus visitas salen del calendario y de los conteos del panel junto con él."],
              ["Reversible", "Sí: vuelva a cambiar el estado.", "Sí: **Restaurar**."],
            ],
          } },
        ],
      },
      {
        id: "cancel-a-job",
        heading: "Cómo cancelar un trabajo",
        blocks: [
          { steps: [
            "Abra el trabajo y elija **Cancelado** en el desplegable de estado junto al título.",
            "Si el trabajo vino de un presupuesto, la tarea *programar este trabajo* de su lista de tareas se cierra sola.",
            "Abra cada una de sus visitas y presione «Cancel visit». Cancelar el trabajo no cancela sus visitas; se quedan en el calendario y seguirían enviando recordatorios.",
          ] },
          { p: "Un trabajo cancelado conserva todo lo que tiene: horas, gastos, fotos, notas. Nunca recibe una solicitud de reseña, su recurrencia deja de avanzar y su sala de chat pasa a **Trabajos terminados**." },
        ],
      },
      {
        id: "archive-a-job",
        heading: "Cómo archivar un trabajo",
        blocks: [
          { steps: [
            "Abra el trabajo y presione **Archivar**. La insignia **Archivados** aparece junto al estado; el botón pasa a ser **Restaurar**.",
            "En la lista de Trabajos, presione el interruptor **Archivados** al final de la fila de etiquetas para ver el cajón. Muestra solo los trabajos archivados, nunca ambos a la vez.",
            "Presione **Restaurar** en el trabajo para traerlo de vuelta.",
          ] },
          { figure: "live:app-jobs", caption: "Trabajos — las etiquetas de estado y el interruptor Archivados después del separador, que abre el cajón." },
          { p: "Archivar un trabajo también cierra la tarea *programar este trabajo* y anota «Archived job …» en el [[the-activity-log|registro de actividad]]. Su sala de chat pasa a **Trabajos terminados**." },
        ],
      },
      {
        id: "delete",
        heading: "Cuándo eliminar en su lugar",
        blocks: [
          { p: "**Eliminar** existe para un trabajo creado por error y que no tiene nada encima. Pregunta primero: **¿Eliminar este trabajo?** *El trabajo y sus visitas se eliminan definitivamente. La cotización y cualquier factura permanecen. Si ya se registraron horas, cancélelo en su lugar.* Un trabajo con registros de tiempo o tareas se rechaza: son constancias de trabajo, y la historia se cancela, no se borra." },
        ],
      },
      {
        id: "who-can-do-it",
        heading: "Quién puede hacerlo",
        blocks: [
          { bullets: [
            "**Cancelar** y **Archivar / Restaurar**: «Jobs: View, create, and edit» — Dispatcher, Manager, los administradores, el propietario.",
            "**Eliminar**: «Jobs: View, create, edit, and delete» — Manager, los administradores, el propietario.",
            "**Crew** y **Estimator** ven la insignia de estado y la insignia Archivados, y ninguno de los tres controles.",
          ] },
        ],
      },
    ],
    faq: [
      { q: "¿Cancelo o archivo un trabajo que se cayó?", a: "Cancélelo. Cancelado es el estado honesto, y el trabajo sigue visible bajo su propia etiqueta. Archívelo además si no quiere volver a verlo." },
      { q: "Archivé un trabajo y sus visitas desaparecieron del calendario. ¿Es un error?", a: "No: eso es lo que hace archivar. Restaure el trabajo y las visitas vuelven." },
      { q: "¿Puedo archivar un trabajo que sigue en curso?", a: "Sí; archivado no es un estado. No aparecerá en la lista ni en el calendario hasta que lo restaure, así que hágalo solo cuando haya terminado con él." },
    ],
  },

  "when-a-job-is-completed": {
    title: "Cuando un trabajo se completa",
    summary:
      "Marcar un trabajo como Completado fija la hora de fin, crea dos tareas, arranca el reloj de la solicitud de reseña y de cualquier regla de seguimiento, y abre la revisión de costos, sin crear una factura.",
    updated: "2026-09-12",
    intro: [
      "**Completado** es una opción más del desplegable de estado en la página del trabajo, pero el momento en que se elige es del que depende buena parte del producto. Este artículo enumera exactamente qué se dispara, qué no, y qué pasa si reabre el trabajo después.",
    ],
    sections: [
      {
        id: "mark-it-completed",
        heading: "Cómo marcar un trabajo como completado",
        blocks: [
          { steps: [
            "Abra el trabajo y elija **Completado** en el desplegable de estado.",
            "FieldQuo fija la hora de finalización: una vez, en el primer cambio, y nunca la mueve después.",
            "Si el costeo de trabajos está activado para usted, se abre la revisión de costos: **Este trabajo terminó — ¿y su costo?**; vea [[job-costing|Costeo del trabajo]].",
          ] },
          { p: "Marcar cada visita como completada no completa el trabajo, y completar el trabajo no completa sus visitas. Son hechos distintos en registros distintos." },
        ],
      },
      {
        id: "what-happens-next",
        heading: "Qué pasa después",
        blocks: [
          { bullets: [
            "Una tarea «Ask {client} for a review» aparece en su lista de tareas, con vencimiento en dos días.",
            "Una tarea «Review what \"{job}\" actually cost» aparece, con vencimiento en tres días.",
            "Si el trabajo vino de un presupuesto, la tarea *programar este trabajo* se cierra.",
            "La sala de chat del trabajo se conserva con su historial y pasa a **Trabajos terminados**.",
            "Un trabajo recurrente deja de generar la siguiente ocurrencia.",
            "Arranca el reloj de la solicitud de reseña, y también el de cualquier regla de seguimiento «Job completed» que haya configurado en [[follow-up-rules|Reglas de seguimiento]].",
          ] },
          { figure: "live:app-tasks", caption: "Tareas — las tareas que el producto crea por usted, cada una enlazada a su trabajo y a su cliente." },
        ],
      },
      {
        id: "the-review-request",
        heading: "La solicitud de reseña",
        blocks: [
          { p: "Con **Pedir automáticamente** activado en **Configuración → Reseñas** y un enlace de reseñas guardado, cada cliente con dirección de correo recibe un solo mensaje después de que su trabajo se marca como completado, nunca más de uno. **Cuándo preguntar** fija la espera, desde **2 horas después** hasta **Una semana después**; por defecto, al día siguiente. Vea [[review-requests|Solicitudes de reseña después de un trabajo]]." },
          { figure: "live:app-settings-reviews", caption: "Configuración → Reseñas — el enlace de reseñas, Pedir automáticamente y Cuándo preguntar." },
          { bullets: [
            "El correo lleva el nombre y la marca de su empresa y enlaza a su página de reseñas.",
            "Un cliente que se dio de baja se omite. Un trabajo completado hace más de 30 días nunca se pregunta.",
            "Un trabajo pasado cargado en **Trabajos anteriores** nunca se pregunta: al cliente se le atendió hace años, y la página del trabajo dice **no se envió ningún mensaje**.",
          ] },
        ],
      },
      {
        id: "what-does-not-happen",
        heading: "Qué no pasa",
        blocks: [
          { bullets: [
            "**No se crea ninguna factura.** Usted la crea desde el trabajo o desde el presupuesto; vea [[create-an-invoice|Crear una factura]]. Una etapa del calendario de pagos que vence «On completion» se basa en la *fecha de fin* del trabajo, no en el momento en que presiona Completado.",
            "**Al cliente no se le avisa** que el trabajo está completo. El único mensaje hacia el cliente es la solicitud de reseña, con su propia espera.",
            "**Las horas no se aprueban** y **los materiales no se costean** solos. La revisión de costos le pide hacer ambas cosas.",
          ] },
        ],
      },
      {
        id: "reopening",
        heading: "Reabrir un trabajo completado",
        blocks: [
          { p: "Vuelva a poner el estado en **En curso** o **Programado** y la hora de finalización se borra: un trabajo que no está terminado no tiene hora de fin. Una solicitud de reseña que todavía no se envió no se envía; una ya enviada no se repite. Las dos tareas no se crean por segunda vez cuando lo completa de nuevo." },
        ],
      },
    ],
    faq: [
      { q: "¿Dónde fijo la espera de la solicitud de reseña?", a: "En Configuración → Reseñas, bajo Cuándo preguntar. Se aplica a todos los trabajos de la empresa." },
      { q: "El cliente nunca recibió la solicitud de reseña. ¿Por qué?", a: "Una de estas: Pedir automáticamente está desactivado, no hay enlace de reseñas guardado, el cliente no tiene correo o se dio de baja, la espera no ha pasado, o el trabajo se completó hace más de 30 días." },
      { q: "¿Puedo enviar yo la solicitud de reseña, antes?", a: "Desde la página del trabajo no. La solicitud sale con la espera de la empresa; la tarea «Ask … for a review» está ahí para que haga la petición en persona si lo prefiere." },
    ],
  },

  "a-chat-room-for-every-job": {
    title: "Una sala de chat para cada trabajo",
    summary:
      "Cada trabajo programado tiene su propia sala en Chat, con la cuadrilla asignada a sus visitas y la oficina ya dentro: nadie agrega a nadie a mano.",
    updated: "2026-09-12",
    intro: [
      "**Chat** es su empresa hablando consigo misma. **#general** es todo el equipo; un **mensaje directo** es entre dos personas; y cada trabajo en el calendario tiene su propia sala. Este artículo trata de las salas de trabajo: quién está en una, por qué, y qué pasa con ella cuando el trabajo termina. El resto de la pantalla está en [[team-chat|Chat del equipo]].",
    ],
    sections: [
      {
        id: "overview",
        heading: "Resumen",
        blocks: [
          { p: "Una sala de trabajo lleva el nombre del trabajo y existe para cada trabajo **Programado** o **En curso** que no esté archivado. Sus miembros se calculan, nunca se eligen: quien esté asignado a una de las visitas del trabajo, más la oficina — el propietario, los administradores y los gerentes, que están en todas las salas de trabajo. Quite a alguien de las visitas y sale de la sala; vuelva a ponerlo y vuelve a estar, con sus mensajes anteriores todavía a su nombre." },
          { p: "La lista de salas las agrupa en **Sin leer**, **Empresa**, **Trabajos**, **Mensajes directos** y **Trabajos terminados**. Las salas sin leer van primero, porque la lista existe para responder quién lo está esperando." },
          { figure: "harness:chat", caption: "Chat — la lista de salas agrupada por tipo a la izquierda, una sala de trabajo abierta a la derecha con su separador de no leídos, una mención y Abrir trabajo." },
        ],
      },
      {
        id: "on-the-screen",
        heading: "Qué hay en una sala de trabajo",
        blocks: [
          { bullets: [
            "El encabezado: el nombre del trabajo, **La cuadrilla asignada a este trabajo, y la oficina**, un botón **Abrir trabajo** y **{count} personas**, que abre la barra **Miembros**.",
            "La barra de miembros se explica sola: **Quien esté asignado a una visita de este trabajo, más el propietario, los admins y los gerentes. Para agregar a alguien, asígnalo a una visita.** No hay control para agregar ni quitar, porque la barra no podría cumplirlo.",
            "El hilo, con separadores «Today» y «Yesterday» y una línea roja «Unread messages» donde se quedó.",
            "El compositor — **Mensaje a {name}** — con *Enter to send · Shift+Enter for a new line*. Los mensajes son texto, hasta 4.000 caracteres; las fotos van en el trabajo, no en el chat.",
          ] },
        ],
      },
      {
        id: "how-to",
        heading: "Cómo meter a alguien en la sala de un trabajo",
        blocks: [
          { steps: [
            "Abra el trabajo y asígnelo a una visita; vea [[book-a-visit-for-a-client|Reservar una visita para un cliente]].",
            "Abra **Chat**. La sala está bajo **Trabajos**, y la persona está dentro; la próxima vez que alguien abra el chat, la lista de miembros se pone al día.",
            "Escriba **@** en el compositor para mencionar a alguien de la sala: *↑↓ para elegir · Tab para insertar · Esc para cerrar*.",
          ] },
          { note: "Un trabajo sin visitas no tiene cuadrilla y no tiene sala. Dele una visita y la sala aparece." },
        ],
      },
      {
        id: "mentions-and-notifications",
        heading: "Menciones y notificaciones",
        blocks: [
          { p: "Un mensaje en una sala de trabajo no avisa a nadie por sí solo: sube el contador de no leídos de la sala, y eso es todo. Una **mención @** envía una [[push-notifications|notificación push]] a la persona nombrada, en cada dispositivo donde la permitió, y al tocarla cae directo en la sala. Un mensaje directo avisa a la otra persona de la misma manera. El mensaje se guarda en cualquier caso; una notificación que no se pudo entregar no es un mensaje perdido." },
        ],
      },
      {
        id: "when-the-job-ends",
        heading: "Cuando el trabajo termina",
        blocks: [
          { p: "Un trabajo completado, cancelado o archivado conserva su sala, con cada mensaje, bajo **Trabajos terminados**, y el encabezado dice **Este trabajo está terminado. La sala se conserva como registro.** No se crea ninguna sala nueva para un trabajo terminado. Es a propósito: «qué acordamos sobre la cocina de los Nguyen» sigue teniendo respuesta en marzo." },
        ],
      },
      {
        id: "only-in-fieldquo",
        heading: "Solo en FieldQuo",
        blocks: [
          { p: "Un chat de cuadrilla cuyas salas de trabajo siguen el horario no aparece en la página de precios de Jobber, Housecall Pro, ServiceTitan, QuoteIQ ni Projul en ningún nivel, la prueba que aplican las páginas de comparación de FieldQuo. Nada sale de la empresa: el personal de FieldQuo nunca ve el chat de un cliente, y una sesión de soporte que mira su cuenta en modo de solo lectura puede leerlo y no puede publicar." },
        ],
      },
      {
        id: "who-can-see-it",
        heading: "Quién puede verlo",
        blocks: [
          { p: "Todos los niveles de acceso tienen la fila **Chat** y **#general**. Una sala de trabajo es visible solo para sus miembros: la cuadrilla asignada a las visitas del trabajo, y el propietario, los administradores, los Dispatchers y los Managers. Un miembro **Crew** ve las salas de los trabajos en los que está, que es la misma regla que decide qué trabajos ve." },
        ],
      },
    ],
    faq: [
      { q: "¿Puedo agregar al electricista a una sala de trabajo?", a: "Solo si es de su equipo y está asignado a una visita. No hay acceso de invitados, y los subcontratistas no son miembros de su empresa." },
      { q: "¿Por qué no hay sala para este trabajo?", a: "Está en Falta fecha, o no tiene visitas, o está archivado. Las salas existen para los trabajos programados y en curso con al menos una visita." },
      { q: "¿Puedo eliminar una sala o un mensaje?", a: "No. Las salas siguen al trabajo, y los mensajes se quedan como registro." },
    ],
  },

  "supervisor-required-visits": {
    title: "Visitas que necesitan un supervisor",
    summary:
      "Una casilla en una cita que dice que una persona con experiencia debe estar en la obra, y que se niega a asignarla a cualquier otra hasta que la haya.",
    updated: "2026-09-12",
    intro: [
      "Algunas visitas no deberían hacerlas un ayudante solo: la primera evaluación de un trabajo grande, el recorrido final, un cliente que pidió al jefe. Cuando reserva una cita en el **Calendario**, una sola casilla — **Requiere un supervisor sénior en la obra** — convierte eso en una regla que el producto aplica, en lugar de una nota que alguien quizá lea.",
      "Es un ajuste de una cita reservada desde el Calendario. Una visita reservada desde la página de un trabajo no lleva esta marca.",
    ],
    sections: [
      {
        id: "overview",
        heading: "Resumen",
        blocks: [
          { p: "Una cita con la marca muestra una insignia ámbar **Se requiere supervisor** en su fila, esté asignada a quien esté. Mientras nadie esté asignado, su estado es **Se requiere supervisor** en lugar de **Programado**, y la etiqueta **Se requiere supervisor** en la parte superior del Calendario la cuenta. Asigne un supervisor y el estado pasa a **Programado** solo." },
        ],
      },
      {
        id: "how-to",
        heading: "Cómo reservar una",
        blocks: [
          { steps: [
            "Abra **Calendario** y presione **Nueva cita**.",
            "Llene el cliente, la hora y la **Ubicación**.",
            "Marque **Requiere un supervisor sénior en la obra**.",
            "En **Asignar a**, elija una persona. Quien no sea supervisor aparece con «(not a supervisor)» después de su nombre, y el servidor lo rechaza: esta cita requiere que se asigne un supervisor o un administrador. O déjela **Sin asignar** y asigne después.",
          ] },
          { figure: "live:app-appointments", caption: "Calendario — las etiquetas de estado con sus conteos, la cuadrícula del mes y las filas de citas con la persona asignada." },
        ],
      },
      {
        id: "what-the-flag-changes",
        heading: "Qué cambia la marca",
        blocks: [
          { table: {
            head: ["Qué cambia", "Cita ordinaria", "Se requiere supervisor"],
            rows: [
              ["Quién puede ser asignado", "Cualquiera del equipo.", "Solo el propietario, un administrador, o alguien en el nivel Dispatcher o Manager."],
              ["Estado mientras no hay asignado", "**Programado**", "**Se requiere supervisor**, en ámbar, hasta que se asigne un supervisor."],
              ["**Asignármelo**", "Se muestra a un miembro de la cuadrilla en una fila sin asignar.", "No se muestra: el servidor rechazaría la reclamación, así que el botón no se ofrece."],
              ["Recordatorios de cita", "Se envían con la anticipación de la empresa.", "No se envían mientras el estado siga siendo **Se requiere supervisor**; vea [[appointment-reminders|Recordatorios de cita]]."],
              ["Disponibilidad en la página de reservas", "Cuenta como tiempo reservado.", "Cuenta como tiempo reservado también."],
            ],
          } },
        ],
      },
      {
        id: "who-can-do-it",
        heading: "Quién puede hacerlo",
        blocks: [
          { p: "Cualquiera que pueda crear una cita puede marcar la casilla. Asignar una cita a otra persona — con marca o sin ella — requiere al propietario, a un administrador, o el nivel **Dispatcher** o **Manager**; un miembro de la cuadrilla puede crear una cita sin asignar o reclamar para sí una cita ordinaria. La regla de reasignación y la regla del supervisor se vuelven a comprobar en el servidor, así que la pista «(not a supervisor)» del desplegable es una cortesía, no el límite." },
        ],
      },
    ],
    faq: [
      { q: "¿Puedo poner esto en una visita de trabajo?", a: "No. La casilla está en las citas reservadas desde el Calendario. Una visita reservada desde la página del trabajo no tiene marca de supervisor; asigne la visita a la persona que quiere ahí." },
      { q: "¿Por qué el cliente no recibió un recordatorio?", a: "Los recordatorios salen solo para citas en estado Programado. Una que todavía espera un supervisor sigue en Se requiere supervisor hasta que alguien sea asignado." },
      { q: "¿Puedo quitar la marca después?", a: "La casilla está en el formulario de reserva; la fila en sí no ofrece un interruptor. Asignar un supervisor es lo que borra el estado ámbar." },
    ],
  },
};
