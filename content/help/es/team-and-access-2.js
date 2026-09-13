// content/help/es/team-and-access-2.js
//
// Parte 2 de la categoría «team-and-access» en español (ver el compositor,
// team-and-access.js): horarios, ausencias, nómina, subcontratistas,
// vehículos, compras y el registro de actividad.
//
// Misma estructura que el inglés, artículo por artículo (mismos ids de
// sección, mismos bloques en el mismo orden, mismas figuras) — el script
// scripts/check-help-centre.mjs compara ambos. Las palabras en pantalla son
// las cadenas del bloque `es` de app/i18n/appMessages.js.
export const ARTICLES = {
  "working-hours-and-bookable-hours": {
    title: "Horario de trabajo y horas reservables",
    summary:
      "Dos semanas por persona en una sola pantalla: el turno que la oficina programa y la franja más estrecha que un cliente puede reservar en línea — y por qué se mantienen separadas.",
    updated: "2026-09-12",
    intro: [
      "Cada persona de su equipo tiene dos patrones semanales, y FieldQuo los mantiene separados a propósito. El **Horario de trabajo** es el turno: cuándo alguien está trabajando, lo que usan la programación y las ausencias. Las **Horas reservables** son la franja que un cliente puede elegir en su página de reservas pública y en su sitio web. Un estimador puede trabajar de 8 a 16 y aceptar consultas solo de 14 a 16 porque las mañanas está en obra — un solo campo no puede decir eso.",
      "Ambos viven en **Configuración → Disponibilidad**, y ambos son por persona. El horario de atención de su empresa es otra cosa distinta: vive en la Configuración de la empresa y es lo que el público lee como «cuándo está abierto el negocio». Vea [[opening-hours|Horario de atención]].",
    ],
    sections: [
      {
        id: "overview",
        heading: "Visión general",
        blocks: [
          { p: "La pantalla se titula **Tu horario** cuando edita el suyo y **Horario de {name}** cuando un encargado edita el de otra persona. Bajo el título, dos editores de semana: **Horario de trabajo** («Tu turno. Se usa para la programación y las hojas de horas. Nunca se muestra a los clientes.») y **Horas reservables** («Cuándo los clientes pueden reservarte en tu calendario público y sitio web. Suele ser una franja más estrecha que tu turno.»). Una barra fija con **Guardar horario** queda abajo, porque en un teléfono el botón quedaría de otro modo bajo catorce filas de campos." },
          { p: "Una persona pasa a ser reservable en cuanto guarda al menos un día reservable. Sin horas reservables, la página lo dice: «Sin horas reservables, no aparecerás como opción en la página de reservas de tu empresa.» Ese es el consentimiento práctico — configurar su horario es la forma de decir «sí, resérvenme»." },
        ],
      },
      {
        id: "on-the-screen",
        heading: "Qué hay en la pantalla",
        blocks: [
          { bullets: [
            "**Horario de quién** — un selector que lista a cada miembro activo del equipo, con «(tú)» después de su propio nombre. Solo aparece para alguien autorizado a gestionar el equipo y solo cuando la lista tiene más de una persona. Elegir a un colega muestra una línea ámbar: «Estás editando el horario de otra persona. Verá el cambio en su propio calendario.»",
            "**Horario de trabajo** — una fila por día de la semana, en el orden de semana de su empresa. Marque el día, luego una hora de inicio, **a**, una hora de fin. Un día sin marcar dice **No programado**; un fin antes del inicio dice **El fin debe ser después del inicio**.",
            "**Horas reservables** — las mismas siete filas para la franja pública. Debajo, una advertencia ámbar lista cualquier día en que la franja reservable queda fuera del turno: «Los clientes podrían reservarte cuando no estás trabajando: … Está permitido: solo verifica que sea intencional.»",
            "**Guardar horario** — guarda las dos semanas juntas y muestra **Guardado**.",
          ] },
        ],
      },
      {
        id: "set-your-hours",
        heading: "Cómo configurar el horario de alguien",
        blocks: [
          { steps: [
            "Abra **Configuración → Disponibilidad**. Desde el calendario del equipo, **Editar horas** en la tarjeta de una persona llega aquí con esa persona ya elegida.",
            "Si gestiona el equipo, elija a la persona bajo **Horario de quién**; si no, está editando el suyo.",
            "Bajo **Horario de trabajo**, marque cada día que la persona trabaja y fije el inicio y el fin del turno.",
            "Bajo **Horas reservables**, marque los días y horas en que un cliente puede reservar. Deje todos los días sin marcar si esta persona no debe aparecer en la página de reservas.",
            "Pulse **Guardar horario**. Lea primero la advertencia ámbar si apareció una — está permitido, pero suele ser un error de tecleo.",
          ] },
          { figure: "harness:settings-availability", caption: "Configuración → Disponibilidad — el selector Horario de quién, luego Horario de trabajo y Horas reservables, cada uno una casilla por día con un inicio y un fin." },
          { note: "Guardar reemplaza la semana completa, no solo las filas que tocó. Si la página no pudo cargar el horario existente de alguien, se niega a mostrar el editor y ofrece **Reintentar** — una semana vacía guardada sobre una real sacaría a esa persona de la página de reservas sin avisar." },
        ],
      },
      {
        id: "what-each-control-changes",
        heading: "Qué cambia cada control",
        blocks: [
          { table: {
            head: ["Control", "Qué cambia"],
            rows: [
              ["Un día marcado bajo Horario de trabajo", "La programación trata un turno fuera de estas horas como una advertencia, nunca un bloqueo — las horas extra son normales. Las ausencias cuentan días laborables a partir de estos días (lunes a viernes cuando no hay ninguno configurado), y una ausencia con goce en un recibo de pago se calcula a partir de ellos."],
              ["Un día marcado bajo Horas reservables", "La página de reservas y su sitio web ofrecen esa franja para esta persona. Los espacios se calculan a partir de ella, menos las reservas existentes y las ausencias aprobadas."],
              ["Ningún día reservable", "La persona no aparece en la página de reservas. Nada más cambia — se sigue programando y pagando con normalidad."],
              ["Horario de quién", "Cambia cada fila de la pantalla a esa persona. Nunca cambia el horario de atención de la empresa."],
            ],
          } },
          { warning: "Una franja reservable en un día sin horario de trabajo, o fuera del turno, se acepta después de la advertencia. Un cliente puede entonces reservar a esa persona cuando la oficina no tiene a nadie anotado como trabajando. Hágalo solo si es lo que quiere." },
        ],
      },
      {
        id: "who-can-see-it",
        heading: "Quién puede verlo",
        blocks: [
          { p: "Todos. Disponibilidad es una de las filas de configuración que cada nivel de acceso conserva, incluida Crew, porque es el único lugar donde una persona configura su propio horario. Cualquiera puede leer y cambiar sus dos semanas." },
          { p: "Editar el horario de otra persona requiere el permiso de gestión de equipo — un propietario, un administrador, un Manager o un Dispatcher. Los demás nunca ven el selector **Horario de quién**, y el servidor rechaza un cambio a la semana de otra persona sin importar lo que envíe el navegador. Vea [[access-levels-overview|Niveles de acceso: quién ve qué]]." },
        ],
      },
    ],
    faq: [
      { q: "¿El horario de trabajo cambia lo que ve un cliente?", a: "No. El turno es interno y la pista en pantalla lo dice — «Nunca se muestra a los clientes». Solo la franja reservable llega a la página de reservas y al sitio web." },
      { q: "¿Alguien puede tener dos turnos en un día, o un turno nocturno?", a: "No en esta pantalla. Cada día tiene un inicio y un fin, y el fin debe ser posterior al inicio. Un día partido se anota por sus límites exteriores." },
      { q: "¿Por qué falta un estimador en nuestra página de reservas?", a: "No tiene horas reservables guardadas, o su cuenta está inactiva. Abra su horario, marque al menos un día bajo Horas reservables y guarde." },
    ],
  },

  "time-off-policies": {
    title: "Políticas de tiempo libre",
    summary:
      "Los tipos de tiempo libre que su equipo puede tomar y cómo se acumula cada saldo — días fijos, por período de pago, o pago de vacaciones como porcentaje — más el traslado de fin de año, hecho a mano.",
    updated: "2026-09-12",
    intro: [
      "Una política es un tipo de tiempo libre — Vacaciones, Enfermedad, Personal, Sin goce, Otro — con una regla sobre cuánto acumula una persona y si un encargado tiene que aprobar la solicitud. Las políticas viven en **Configuración → Políticas de ausencias**; las solicitudes y los saldos que producen viven en la pantalla **Ausencias**, donde el personal pide y los encargados aprueban. Vea [[time-off-requests|Solicitudes de tiempo libre]].",
      "FieldQuo registra lo que usted configura. No decide lo que debe: la nota al pie de la pantalla dice que los mínimos legales varían según la provincia, el estado y la antigüedad, y los conjuntos iniciales dicen claramente de qué año vienen sus cifras.",
    ],
    sections: [
      {
        id: "overview",
        heading: "Visión general",
        blocks: [
          { p: "La pantalla lleva el título **Políticas de tiempo libre** — «Qué tiempo libre puede tomar tu equipo y cómo se acumula. Las solicitudes y los saldos están en Tiempo libre.» Sin políticas todavía, se ofrece primero una tarjeta inicial; en cuanto tiene al menos una, la tarjeta desaparece y aparece en su lugar la sección **Fin de año**." },
          { p: "Existen tres métodos de acumulación y son de verdad distintos. **Días fijos por año** deja toda la asignación disponible de inmediato. **Se acumula en cada período de pago** reparte los días entre los períodos de pago transcurridos, según la frecuencia de la [[payroll-settings|Configuración de nómina]] — menos en enero, completo en diciembre. **Pago de vacaciones (% del bruto)** acumula dinero, no días, a partir del bruto de las nóminas aprobadas; el tiempo libre con este método no está limitado por un saldo de días." },
        ],
      },
      {
        id: "on-the-screen",
        heading: "Qué hay en la pantalla",
        blocks: [
          { bullets: [
            "**Empezar con el conjunto de Canadá** (o Estados Unidos, Reino Unido) — una tarjeta por conjunto inicial con su número de políticas y «cifras a fecha de 2024». El conjunto que coincide con el país de su perfil de empresa se ofrece primero, con una línea que dice de dónde se leyó ese país; los otros están bajo «¿Contratas en otro país? También están aquí.» No se carga nada hasta que usted pulsa.",
            "**Políticas** con **Agregar política** — una tarjeta por política activa: su nombre, insignias de **sin goce** y **aprobado automáticamente**, luego el método, el derecho («15 días/año» o «4% del bruto») y el traslado («traslado 5 días» o «ilimitado»), con **Editar** y un botón para quitar.",
            "**Retiradas** — políticas quitadas después de haberse usado. Conservan sus solicitudes anteriores y se marcan **no reservable**.",
            "**Fin de año** — «Traslada los días no usados de 2025 a 2026, limitados por el tope de traslado de cada política.» Un botón, pulsado por usted, nunca automático.",
          ] },
        ],
      },
      {
        id: "add-a-policy",
        heading: "Cómo agregar una política",
        blocks: [
          { steps: [
            "Abra **Configuración → Políticas de ausencias**.",
            "O pulse un conjunto inicial para cargar sus políticas de una vez, o pulse **Agregar política** para un formulario en blanco.",
            "Póngale un nombre y elija el **Tipo** — Vacaciones, Enfermedad, Personal, Sin goce u Otro.",
            "Elija **Cómo se acumula**, luego complete **Días por año** (o **Porcentaje del bruto** para el método en dinero).",
            "Fije el **Tope de traslado (días)** — «En blanco significa ilimitado. 0 significa úsalo o piérdelo.» Marque o desmarque **Con goce** y **Requiere la aprobación de un gerente**.",
            "Pulse **Agregar política**. Los saldos de cada trabajador activo se recalculan de inmediato.",
          ] },
          { figure: "harness:settings-leave", caption: "Configuración → Políticas de ausencias — la lista Políticas con una política de Vacaciones y una de Enfermedad aprobada automáticamente, y la tarjeta Fin de año." },
          { tip: "El conjunto de Canadá son cuatro políticas: Vacation pay (4%), Vacation days (10 días, traslado 5), Paid sick leave (10 días, aprobado automáticamente, úsalo o piérdelo) y Unpaid leave. Cárguelo y luego edite los números según su provincia y su gente — una política ya presente con el mismo nombre se omite, nunca se sobrescribe." },
        ],
      },
      {
        id: "what-each-setting-changes",
        heading: "Qué cambia cada ajuste",
        blocks: [
          { table: {
            head: ["Ajuste", "Qué cambia"],
            rows: [
              ["Tipo", "Una etiqueta en la tarjeta de saldo y en las solicitudes. No cambia la aritmética."],
              ["Días fijos por año", "Todos los **Días por año** están disponibles desde el primer día. Alguien con fecha de contratación este año recibe una parte proporcional; sin fecha de contratación registrada recibe el monto completo."],
              ["Se acumula en cada período de pago", "**Días por año** divididos entre los períodos de pago del año, otorgados a medida que pasa cada período."],
              ["Pago de vacaciones (% del bruto)", "Acumula un monto igual al porcentaje del bruto de las nóminas aprobadas y pagadas este año. Las solicitudes bajo este método no se comprueban contra un saldo de días."],
              ["Tope de traslado (días)", "Cuántos días no usados puede trasladar el botón **Fin de año** al año siguiente. En blanco es ilimitado; 0 es ninguno."],
              ["Con goce", "Desmarcado, la política muestra una insignia **sin goce** y los días aprobados bajo ella no se agregan a un recibo de pago. Marcado, una ausencia aprobada dentro de un período de pago se convierte en una línea de ingreso en el recibo."],
              ["Requiere la aprobación de un gerente", "Marcado, una solicitud espera como pendiente hasta que un encargado la aprueba. Desmarcado, la solicitud se aprueba en el momento en que se hace y el saldo se consume de inmediato — la tarjeta muestra **aprobado automáticamente**."],
              ["Quitar", "Nunca usada: se elimina por completo. Usada al menos una vez: se retira en su lugar, para que las solicitudes anteriores conserven su historial y nadie pueda volver a reservarla."],
            ],
          } },
        ],
      },
      {
        id: "year-end",
        heading: "Fin de año",
        blocks: [
          { p: "Los saldos son por año calendario. Los días no usados no se trasladan solos — usted cierra el año cuando decide que está cerrado." },
          { steps: [
            "Abra **Configuración → Políticas de ausencias** en el año nuevo.",
            "En **Fin de año**, pulse **Trasladar los saldos de 2025 a 2026** (los años del botón siguen el calendario).",
            "Lea el aviso: «Se trasladaron los días no usados a 2026 para 12 saldo(s).» o «Nada era elegible para trasladar.» Cada saldo está limitado por el tope de traslado de su política.",
          ] },
          { note: "El traslado queda anotado en el [[the-activity-log|Registro de actividad]] con quién lo pulsó y cuántos saldos se movieron." },
        ],
      },
      {
        id: "who-can-see-it",
        heading: "Quién puede verlo",
        blocks: [
          { p: "Solo propietarios y administradores. La fila está oculta para todos los demás niveles y el servidor responde «Only an owner or admin can manage leave policies.» a cualquier otra persona. Un Manager aprueba solicitudes en la pantalla Ausencias pero no configura las políticas detrás de ellas." },
        ],
      },
    ],
    faq: [
      { q: "¿Una política de días por enfermedad tiene que aprobarse?", a: "Solo si marca **Requiere la aprobación de un gerente**. Los conjuntos iniciales lo dejan desmarcado para enfermedad, así que una solicitud se aprueba al instante y el encargado igual la ve en la lista." },
      { q: "¿Dónde ve la gente su saldo?", a: "En la pantalla **Ausencias** — una tarjeta por política con lo acumulado y lo tomado, y una pestaña de Equipo para los encargados. Los saldos se recalculan cada vez que se agrega o edita una política." },
      { q: "¿Puedo editar los números que me dio un conjunto inicial?", a: "Sí. Una vez cargadas son sus políticas; pulse **Editar** en cualquier tarjeta. FieldQuo nunca las cambia después." },
    ],
  },

  "payroll-runs": {
    title: "Ciclos de pago",
    summary:
      "Cómo las horas aprobadas y las tarifas guardadas se convierten en una nómina con recibos de pago — Calcular, guardar como borrador, aprobar, registrar como pagada — y lo único que FieldQuo no hace a propósito: mover el dinero.",
    updated: "2026-09-12",
    intro: [
      "La pantalla **Nómina** calcula lo que debe cobrar cada persona en un periodo, a partir de las horas que un encargado aprobó en Hojas de tiempo y de las tarifas guardadas en su ficha, y genera un recibo de pago por persona. La frase al inicio de la pantalla es todo el contrato: «Pagas a través de tu propio banco o proveedor de nómina: FieldQuo no mueve el dinero.»",
      "La matriz de funciones marca la nómina como parcial, y el límite es exactamente ese: FieldQuo calcula el bruto, genera los recibos y exporta la nómina. No paga a los empleados ni presenta sus impuestos de nómina — las deducciones son las que usted o su contador cargan en la [[payroll-settings|Configuración de nómina]].",
    ],
    sections: [
      {
        id: "overview",
        heading: "Visión general",
        blocks: [
          { p: "Una pantalla, dos públicos. Alguien autorizado a procesar la nómina ve **Mis ingresos** para sí mismo, luego **Nuevo ciclo de pago** y la lista **Ciclos de pago**. Los demás ven solo **Mis ingresos** y la línea «Solo tus propios recibos de pago se comparten con tu cuenta.» — vea [[payslips|Recibos de pago]]." },
          { p: "Una nómina pasa por cuatro estados: **Borrador** (un documento de trabajo que todavía puede cambiar o cancelar), **Aprobada** (los recibos pasan a ser visibles para las personas incluidas), **pagada (registrada)** (una persona confirmó que el dinero salió por el banco o el proveedor de nómina) y **Cancelada**. Se dice «registrar como pagada», no «pagar», porque un botón llamado Pagar que no pagara a nadie sería el peor control del producto." },
          { note: "Solo en FieldQuo: ni Jobber ni Housecall Pro muestran nómina en su página de precios en ningún nivel. ServiceTitan muestra «payroll management» a partir de su nivel Essentials, y Projul no la muestra. FieldQuo la incluye en todos los planes — como un cálculo y un conjunto de recibos, nunca como una transferencia." },
        ],
      },
      {
        id: "on-the-screen",
        heading: "Qué hay en la pantalla",
        blocks: [
          { bullets: [
            "**Mis ingresos** — **Periodo actual** con sus fechas y día de pago, sus horas aprobadas × su tarifa (o «No hay una tarifa por hora en tu ficha, así que todavía no se puede calcular.»), una barra de avance del periodo, luego **Bruto**, **Deducciones** y **Neto** del año, y después sus recibos.",
            "**Nuevo ciclo de pago** — «Solo se incluyen las horas aprobadas. Aprueba primero los partes de horas o esas horas no se pagarán.» Cuatro campos: **Inicio del periodo**, **Fin del periodo**, **Frecuencia** (Cada semana, Cada 2 semanas, Dos veces al mes, Una vez al mes) y **Etiquetas del recibo de pago** (Canadá, Estados Unidos, Reino Unido), luego **Calcular**.",
            "**Ciclos de pago** — una fila por nómina: el periodo, cuántas personas y la región de las etiquetas («5 personas · CA»), el total neto y una insignia de estado. Abrir una fila muestra cada línea y los botones **Aprobar nómina** / **Registrar como pagada** / **Exportar CSV**.",
          ] },
        ],
      },
      {
        id: "run-payroll",
        heading: "Cómo procesar la nómina",
        blocks: [
          { steps: [
            "Apruebe primero las horas del periodo en **Hojas de tiempo** — vea [[timesheets-and-approving-hours|Hojas de tiempo y aprobación de horas]]. Las horas pendientes quedan fuera y se nombran.",
            "Abra **Nómina**. El periodo viene prellenado con el último periodo cerrado según su ciclo de pago; la frecuencia lo sigue.",
            "Elija la región de **Etiquetas del recibo de pago** — solo elige los nombres de las deducciones en el recibo (CPP/EI, Social Security/Medicare, PAYE/NI). No calcula nada.",
            "Pulse **Calcular**. Una vista previa lista a cada persona con horas, bruto, deducciones y neto, los totales y las notas — horas sin aprobar excluidas, horas autoaprobadas incluidas, ausencias con goce incluidas, o «No hay deducciones configuradas, así que estas cifras son brutas.»",
            "Pulse **Guardar como borrador**. La nómina aparece bajo **Ciclos de pago** como Borrador.",
            "Abra la nómina y pulse **Aprobar nómina**. Los recibos pasan a ser visibles para las personas incluidas: «Aprobada y visible para tu equipo como recibos de pago. Págales a través de tu banco o proveedor de nómina y luego regístralo aquí.»",
            "Pague a todos fuera de FieldQuo y luego pulse **Registrar como pagada**. La nómina y cada recibo quedan con la fecha.",
          ] },
          { figure: "harness:payroll", caption: "Nómina — el formulario Nuevo ciclo de pago prellenado con el último periodo cerrado, y la lista Ciclos de pago con una nómina Aprobada y dos registradas como pagadas." },
          { warning: "La aprobación es el último momento sin consecuencias. Un borrador puede solaparse con un periodo que ya pagó — la vista previa lo dice — pero **Aprobar nómina** se niega mientras una nómina aprobada o pagada cubra los mismos días. Cancele primero la equivocada." },
        ],
      },
      {
        id: "what-the-run-includes",
        heading: "Qué incluye la nómina",
        blocks: [
          { bullets: [
            "**Solo horas aprobadas.** Una hora pendiente es una afirmación sin verificar; pagarla haría decorativa la aprobación. La vista previa nombra a quiénes se les dejaron horas fuera.",
            "**Horas extra a 1.5×** por encima de 40 horas en una semana, calculadas semana por semana dentro del periodo. Un periodo calendario (dos veces al mes, una vez al mes) contiene semanas parciales, y la tarjeta del ciclo de pago lo dice.",
            "**La tarifa en la ficha de la persona** — su tarifa por hora, o el costo de mano de obra guardado en su ficha de equipo cuando no hay tarifa por hora. Sin ninguna de las dos, la línea no muestra pago y sí una advertencia, en vez de $0.00.",
            "**Un salario** dividido entre el periodo cuando hay uno guardado para la persona en lugar de una tarifa por hora.",
            "**Ausencias con goce aprobadas** como línea de ingreso con nombre («Vacaciones — 5 días»), calculada a partir de la jornada propia de esa persona, para que una semana libre no sea una semana de cero horas.",
            "**Deducciones y asignaciones** de la Configuración de nómina, aplicadas a todos. Sin ninguna, la nómina es solo bruta y lo dice.",
          ] },
        ],
      },
      {
        id: "statuses",
        heading: "Estados",
        blocks: [
          { table: {
            head: ["Estado", "Qué significa"],
            rows: [
              ["Borrador", "Guardada e invisible para las personas incluidas. Para cambiarla, cancélela y vuelva a calcular el periodo. Se puede cancelar."],
              ["Aprobada", "Las cifras son finales. Los recibos son visibles y descargables por las personas incluidas. Todavía se puede cancelar — una pagada no."],
              ["pagada (registrada)", "Usted confirmó que el dinero salió por su banco o proveedor de nómina. La fecha queda en la nómina y en cada recibo. Final."],
              ["Cancelada", "Se conserva en la lista como constancia. Su periodo se puede volver a procesar."],
            ],
          } },
        ],
      },
      {
        id: "who-can-see-it",
        heading: "Quién puede verlo",
        blocks: [
          { p: "La fila **Nómina** está en el menú de todos, porque todos tienen recibos de pago. Procesar la nómina — Calcular, Guardar como borrador, Aprobar nómina, Registrar como pagada, Exportar CSV — requiere el área «Payroll & Payslips» en «View everyone's and run payroll», que los propietarios y administradores tienen de forma automática. «View everyone's payslips» abre cada nómina en solo lectura." },
          { p: "Cada preajuste — Crew, Estimator, Dispatcher, Manager — empieza en «View their own payslips». La descripción del Manager dice «no la nómina» y lo dice en serio; un propietario que quiera que un encargado procese la nómina se lo concede a propósito en el [[the-custom-access-editor|editor de acceso personalizado]]." },
        ],
      },
    ],
    faq: [
      { q: "¿FieldQuo transfiere los sueldos?", a: "No. Calcula las cifras y genera recibos y un CSV. Usted paga por su banco o proveedor de nómina y luego pulsa Registrar como pagada para que los recibos puedan decir cuándo." },
      { q: "¿Por qué alguien aparece en $0 o sin pago?", a: "No hay tarifa por hora ni costo de mano de obra guardado en su ficha, o sus horas del periodo siguen pendientes. La vista previa dice cuál de las dos." },
      { q: "¿Puedo corregir una nómina después de aprobarla?", a: "Cancélela y vuelva a procesar el periodo, siempre que no se haya registrado como pagada. Una nómina pagada es final; una corrección es una segunda nómina sobre el mismo periodo, guardada como borrador — la aprobación solo se niega mientras una nómina aprobada o pagada se solape." },
      { q: "¿Qué contiene Exportar CSV?", a: "Una fila por persona con horas, bruto, una columna por cada deducción o ingreso nombrado en la nómina, y neto — la entrega para el contador o el proveedor de nómina que realmente paga. Una celda se deja vacía, no en 0.00, cuando esa persona no tenía esa línea." },
    ],
  },

  "payroll-settings": {
    title: "Configuración de nómina",
    summary:
      "Cuándo paga — frecuencia, el día en que cierra el periodo, día de pago — y los componentes de deducción e ingreso que aplica una nómina: montos fijos, porcentajes del bruto y tramos progresivos de impuesto que usted o su contador cargan.",
    updated: "2026-09-12",
    intro: [
      "**Configuración → Nómina** es aquello a partir de lo cual calculan los [[payroll-runs|Ciclos de pago]]: el ciclo de pago y los componentes que convierten un bruto en neto. Hasta que algo esté configurado aquí, las nóminas son solo brutas y lo dicen. El pie de página establece el reparto de tareas: «FieldQuo hace la aritmética con las tasas que guardas aquí. No presenta ni remite nada, y no actualiza las tasas cuando cambian: revísalas cada año fiscal con tu contador.»",
    ],
    sections: [
      {
        id: "overview",
        heading: "Visión general",
        blocks: [
          { p: "La página lleva el título **Configuración de nómina** — «Las deducciones y asignaciones que se aplican al procesar la nómina. Sin ellas, los procesos de pago muestran solo el salario bruto.» Una tarjeta **Cuándo pagas** viene primero, luego **Empezar desde tu región** (se ofrece mientras no tenga componentes), luego dos listas: **Deducciones** y **Asignaciones e ingresos**, con **Agregar un componente** al final." },
        ],
      },
      {
        id: "on-the-screen",
        heading: "Qué hay en la pantalla",
        blocks: [
          { bullets: [
            "**Cuándo pagas** — **Con qué frecuencia**, **El periodo cierra** (un día de la semana), **Día de pago** (un día de la semana), el número de días que eso deja para aprobar horas, luego **Periodo actual** y **Último periodo cerrado** con sus fechas y días de pago. Hasta que se configure, dice «sin definir: se usa el valor predeterminado de abajo» con un botón **Configurarlo**.",
            "**Empezar desde tu región** — Canadá, Estados Unidos o Reino Unido, cada uno con «3 componentes · cifras de 2024». En negrita: «Estas son cifras publicadas para el año indicado; confirma cada una con tu contador.»",
            "**Deducciones** — una fila por componente con su nombre, una insignia **legal** cuando vino de una plantilla, una insignia **desactivado** cuando está desactivado, y cómo se calcula: «5.95% del bruto», «5 tramos progresivos» o un monto fijo, más **Desactivar** / **Activar** y un botón para quitar.",
            "**Asignaciones e ingresos** — las mismas filas para dinero que se suma en lugar de restarse, como una asignación de herramientas.",
          ] },
        ],
      },
      {
        id: "when-you-pay",
        heading: "Cuándo paga",
        blocks: [
          { p: "El cierre del periodo y el día de pago son dos controles separados porque las horas extra se calculan contra un umbral semanal: un periodo que contiene semanas completas paga las extras una vez; uno que parte una semana las subestima dos veces. La tarjeta dice en voz alta la brecha entre los dos días — «4 días para aprobar horas» — porque «de domingo a jueves» no significa nada hasta que alguien cuenta." },
          { table: {
            head: ["Ajuste", "Qué cambia"],
            rows: [
              ["Con qué frecuencia", "Cada semana, Cada 2 semanas, Dos veces al mes o Una vez al mes. Determina con qué periodo se prellena Nuevo ciclo de pago, cómo se divide un salario y cómo se acumula el tiempo libre por período."],
              ["El periodo cierra", "El día de la semana en que termina un periodo. Los periodos semanales y de cada 2 semanas contienen entonces semanas completas; las frecuencias de calendario muestran una nota de que las horas extra semanales se calculan sobre las semanas parciales dentro de cada periodo."],
              ["Día de pago", "El día de la semana en que se paga a la gente. Solo la fecha «pagado el …» bajo Periodo actual en la pantalla Nómina y la brecha de revisión lo leen — FieldQuo no paga a nadie ese día."],
            ],
          } },
          { note: "Todos pueden leer el ciclo de pago — un trabajador necesita saber cuándo es el día de pago — pero solo un propietario o administrador puede cambiarlo: «Only an owner or admin can change when the company pays.» Una brecha de un día o menos entre el cierre del periodo y el día de pago muestra una advertencia." },
        ],
      },
      {
        id: "add-a-component",
        heading: "Cómo agregar un componente",
        blocks: [
          { steps: [
            "Abra **Configuración → Nómina**. Si todavía no tiene componentes, pulse su región bajo **Empezar desde tu región** para cargar el conjunto legal y luego revise cada cifra con su contador.",
            "Pulse **Agregar un componente** y póngale nombre — «Cuotas sindicales, Asignación de herramientas».",
            "Elija **Deducción** o **Asignación / ingreso**.",
            "Elija cómo se calcula: **Monto fijo** (el mismo monto en cada período de pago), **Porcentaje del bruto** («p. ej. CPP al 5.95%») o **Tramos progresivos** (tramos del impuesto sobre la renta: «Umbrales anuales, del más bajo al más alto. Deja en blanco el último «hasta» para «y más».»).",
            "Pulse **Agregar**. Desde el siguiente Calcular, se aplica a todos en la nómina.",
          ] },
          { figure: "harness:settings-payroll", caption: "Configuración → Nómina — la tarjeta Cuándo pagas, luego la lista Deducciones con filas legales y la lista Asignaciones e ingresos." },
          { tip: "El conjunto de Canadá es Federal income tax (cinco tramos de 2024), CPP al 5.95% y EI al 1.66% — solo la parte del empleado. El impuesto provincial no está incluido: agregue los tramos de su provincia como un componente aparte de Tramos progresivos. El conjunto de Estados Unidos no tiene impuesto estatal; el de Reino Unido no tiene letras de categoría NI." },
        ],
      },
      {
        id: "what-each-control-changes",
        heading: "Qué cambia cada control",
        blocks: [
          { table: {
            head: ["Control", "Qué cambia"],
            rows: [
              ["Monto fijo", "El **Monto por período de pago** se suma o se deduce en cada nómina para cada persona, sean cuales sean sus horas."],
              ["Porcentaje del bruto", "El porcentaje del bruto de esa persona en la nómina."],
              ["Tramos progresivos", "El bruto del periodo se anualiza, se grava a través de los tramos y se vuelve a dividir al periodo — como está escrita toda tabla de impuestos publicada. **Agregar tramo** y **Quitar tramo** editan la lista; el «hasta» del último tramo se deja en blanco para «y más»."],
              ["Desactivar / Activar", "Un componente desactivado muestra la insignia **desactivado** y se omite en el siguiente Calcular. No se elimina nada; vuelva a activarlo cuando quiera."],
              ["Quitar", "«Los recibos de pago anteriores conservan lo que ya se dedujo.» El componente desaparece de las nóminas futuras; cada nómina anterior conserva su propia copia de las líneas."],
            ],
          } },
        ],
      },
      {
        id: "who-can-see-it",
        heading: "Quién puede verlo",
        blocks: [
          { p: "Solo propietarios y administradores. La fila de configuración **Nómina** está oculta para todos los demás niveles, y cada escritura responde «Only an owner or admin can change payroll settings.» Un Manager al que se le concedió procesar la nómina sigue sin poder editar las tasas aquí — son dos preguntas distintas, a propósito." },
        ],
      },
    ],
    faq: [
      { q: "¿Un componente puede aplicarse a una sola persona?", a: "No. Cada componente se aplica a todos en la nómina. Una fila de una versión anterior marcada «asignado individualmente» no llega a ningún recibo y se señala en ámbar; vuelva a crearla como componente normal o quítela." },
      { q: "¿Las tasas legales se actualizan solas cada año?", a: "No. Son cifras publicadas para el año indicado, cargadas una vez, y después son sus números. Revíselas cada año fiscal con su contador y edite los tramos." },
      { q: "¿Dónde vive la tarifa por hora de alguien?", a: "En su ficha de equipo y su ficha de trabajador, no aquí. Esta pantalla contiene lo que se aplica a todos; la tarifa es por persona — vea [[manage-team|Gestionar equipo]]." },
    ],
  },

  payslips: {
    title: "Recibos de pago",
    summary:
      "Lo que un miembro del equipo ve bajo Mis ingresos — el periodo actual, el bruto, las deducciones y el neto del año, y un recibo de pago en PDF por cada nómina aprobada — y quién más puede abrirlo.",
    updated: "2026-09-12",
    intro: [
      "Un recibo de pago es la línea de una persona en una nómina aprobada, impresa como un PDF con la marca de la empresa. La persona ve los suyos bajo **Mis ingresos** al inicio de la pantalla **Nómina**; alguien que procesa la nómina ve los de todos dentro de la nómina. No aparece nada para un borrador: un borrador es un documento de trabajo que la oficina todavía puede cambiar, y un recibo que cambia entre el martes y el viernes no es un recibo.",
    ],
    sections: [
      {
        id: "overview",
        heading: "Visión general",
        blocks: [
          { p: "**Mis ingresos** responde la pregunta por la que un trabajador abre esta pantalla — cuánto he ganado este periodo, y cuánto recibí el anterior — sin esperar a que la oficina procese la nómina. **Periodo actual** muestra horas aprobadas × la tarifa por hora como cifra bruta, las fechas y el día de pago del periodo, y una barra de avance. Debajo, tres cuadros del año: **Bruto**, **Deducciones**, **Neto**." },
          { p: "La lista de abajo es una fila por nómina aprobada o pagada: el periodo, las horas («80 h normales · 6 h extra»), «pagado el 17 sept 2026» o «pendiente de pago», el neto, el bruto menos las deducciones, y un botón **PDF**. Hasta que se apruebe una nómina, la lista dice «Aún no hay recibos de pago. Aparecen una vez que se aprueba un ciclo de pago.»" },
        ],
      },
      {
        id: "on-the-screen",
        heading: "Qué hay en la pantalla",
        blocks: [
          { bullets: [
            "**Periodo actual** — «31 ago 2026 → 13 sept 2026 · pagado el 17 sept 2026», luego «80 horas aprobadas × $32.00/h» o, sin tarifa registrada, «No hay una tarifa por hora en tu ficha, así que todavía no se puede calcular. Tus horas aprobadas se siguen contando.» Las horas todavía pendientes se cuentan aparte: «6 horas más registradas y pendientes de que las apruebe tu responsable: no se cuentan arriba.»",
            "**Bruto · 2026**, **Deducciones · 2026**, **Neto · 2026** — el acumulado del año en nóminas aprobadas y pagadas.",
            "**Las filas de recibos** — periodo, horas, estado del pago y neto, las más recientes primero.",
            "**PDF** — descarga ese recibo. El enlace se resuelve a partir de su propia ficha de trabajador, nunca a partir de lo que haya en la barra de direcciones.",
          ] },
        ],
      },
      {
        id: "download-a-payslip",
        heading: "Cómo descargar un recibo de pago",
        blocks: [
          { steps: [
            "Abra **Nómina** desde el menú (bajo Dinero).",
            "Bajo **Mis ingresos**, ubique el periodo y pulse **PDF**.",
            "Si procesa la nómina y necesita el de otra persona, abra la nómina bajo **Ciclos de pago** y pulse **Recibo de pago PDF** en su línea.",
          ] },
          { figure: "live:app-payroll", caption: "Nómina — Mis ingresos con Periodo actual, los tres cuadros del acumulado anual y la lista de recibos, antes de que se apruebe una nómina." },
        ],
      },
      {
        id: "what-a-payslip-says",
        heading: "Qué dice un recibo de pago",
        blocks: [
          { bullets: [
            "**El nombre, el logotipo y el color de su empresa** en el encabezado, como cualquier otro documento que envía la empresa, con el nombre de la persona, si es empleado o contratista, y la tarifa por hora cuando la hay.",
            "**Horas** — normales y extra — cuando la línea las tiene; una línea asalariada no imprime ninguna.",
            "**Ingresos y deducciones** en el orden en que se calcularon, luego **Gross pay** y **Net pay**. Los nombres de las deducciones siguen la región elegida para la nómina (CPP/EI, Social Security/Medicare, PAYE/NI).",
            "**El periodo de pago**, y una de las frases «Recorded as paid on …», «Approved, not yet recorded as paid.» o «Draft — not yet approved.»",
            "**Una declaración clara** de que es un registro de lo que se calculó y se pagó — no un formulario del gobierno, y ningún impuesto ha sido remitido ni presentado a través de este sistema.",
          ] },
        ],
      },
      {
        id: "who-can-see-it",
        heading: "Quién puede verlo",
        blocks: [
          { p: "Cada nivel de acceso cuya área «Payroll & Payslips» esté por encima de «No access» ve los suyos — todos los preajustes empiezan en «View their own payslips». «View everyone's payslips» o «View everyone's and run payroll» abre cada nómina y cada PDF; los propietarios y administradores lo tienen de forma automática. Alguien configurado en «No access» no ve ninguna sección Mis ingresos." },
          { note: "El servidor resuelve «los suyos» a partir de la ficha de trabajador de la persona conectada. Un enlace de recibo copiado del navegador de otra persona no abre nada." },
        ],
      },
    ],
    faq: [
      { q: "¿Por qué falta mi recibo de las últimas dos semanas?", a: "La nómina sigue en borrador, o no se ha creado. Los recibos aparecen una vez que se aprueba la nómina; Periodo actual muestra el bruto acumulado mientras tanto." },
      { q: "¿Esto es un T4, un W-2 o un P60?", a: "No. El PDF lo dice en su pie de página. Es un registro de lo que se calculó y se pagó; los formularios de fin de año vienen de su contador o de su proveedor de nómina." },
      { q: "¿Por qué Periodo actual muestra el bruto y mi recibo muestra menos?", a: "Periodo actual es antes de deducciones — «esto es lo que vale el trabajo, no lo que llegará a tu cuenta». Las deducciones se aplican cuando la oficina procesa el periodo." },
    ],
  },

  "subcontractors-and-insurance": {
    title: "Los subcontratistas y su seguro",
    summary:
      "Las empresas que contrata por trabajo — su oficio y contacto, si su certificado de seguro y su constancia WSIB/WCB están vigentes, lo que acordó con ellas en cada trabajo y lo que les pagó este año.",
    updated: "2026-09-12",
    intro: [
      "**Subcontratistas** es la lista de otras empresas — el electricista, el fabricante de cubiertas, el techador — con el único dato que tiene consecuencia el mismo día en la parte superior: si su papeleo sigue vigente. Un certificado de seguro vencido es un subcontratista que no debe pisar la obra mañana, así que el panel **Seguro o constancia por vencer** va antes que todo lo demás.",
      "No es la lista de las personas que emplea; eso es [[manage-team|Gestionar equipo]]. Y no es una forma de pagarle a un subcontratista: la función que FieldQuo sí ofrece — pagar a un contratista desde la aplicación — paga a una persona de su propia lista, por horas que fichó, a la tarifa que usted fijó. No puede pagar un precio cerrado a otra empresa. Los pagos a una empresa subcontratista se registran aquí después de que el dinero salió.",
    ],
    sections: [
      {
        id: "overview",
        heading: "Visión general",
        blocks: [
          { p: "La pantalla lleva el título **Subcontratistas** — «Las empresas que contratas por trabajo — el electricista, el techador. Sus fechas de seguro y constancia, lo que acordaste con ellos en cada trabajo y lo que les has pagado este año.» Cada subcontratista tiene una ficha con documentos, los trabajos en los que está y los pagos registrados a su nombre; el total del año es lo que se convierte en la [[the-t5018-year-end-list|lista de fin de año T5018]]." },
          { note: "Lo que se le debe y se le pagó a un subcontratista es costo del trabajo. El costeo de trabajos toma el **monto acordado** como el costo de ese subcontratista en el trabajo — un subcontratista de $5,000 al que se le pagaron $2,000 le ha costado $5,000 al trabajo — y los pagos son cómo se va liquidando. Vea [[job-costing|Costeo de trabajos]]." },
        ],
      },
      {
        id: "on-the-screen",
        heading: "Qué hay en la pantalla",
        blocks: [
          { bullets: [
            "**Seguro o constancia por vencer** — cada subcontratista cuyo seguro o constancia está **Por vencer** (dentro de 30 días) o **Vencido**, el peor primero, cada uno indicando cuál de los dos.",
            "**Pagado en** con un selector de año, y **Lista de fin de año (CSV)** — solo se muestran a quien puede ver dinero.",
            "**Una tarjeta por subcontratista** — el nombre de la empresa, **Inactivo** cuando corresponde, luego oficio, contacto y teléfono, una insignia por la peor de las dos fechas, y, para quien puede ver dinero, «$6,840.00 pagados en 2026 (3 pagos)» con «Sin formulario fiscal» cuando el subcontratista está excluido del formulario anual.",
            "**Agregar** — abre el formulario de nuevo subcontratista.",
          ] },
        ],
      },
      {
        id: "add-a-subcontractor",
        heading: "Cómo agregar un subcontratista",
        blocks: [
          { steps: [
            "Abra **Subcontratistas** (bajo Personas) y pulse **Agregar**.",
            "Complete el **Nombre de la empresa** y el **Oficio** («electricidad, techos, drywall…»), luego la **Persona de contacto**, el **Correo** y el **Teléfono**.",
            "Ingrese **Seguro (certificado) vence el** y **Constancia WSIB / WCB vence el** si tiene los certificados. «Deja la fecha vacía si no tienes el certificado — vacío significa no registrado, no vencido.»",
            "Deje **Va en el formulario anual de contratistas (T5018 / 1099-NEC)** marcado para un subcontratista de construcción; desmárquelo para un proveedor de materiales incorporado que, según su contador, no lo recibe.",
            "Pulse **Agregar subcontratista**.",
            "En la ficha del subcontratista, suba los certificados bajo **Documentos** — un **Certificado de seguro** o una **Constancia WSIB / WCB** con su fecha de vencimiento fija la fecha del subcontratista al mismo tiempo.",
          ] },
          { figure: "create:app-subcontractors-create", caption: "Subcontratistas → Agregar — el formulario de nuevo subcontratista: empresa, oficio, contacto, las dos fechas de vencimiento y la casilla del formulario anual." },
          { tip: "Un subcontratista que ya no usa recibe **Marcar inactivo** en lugar de un borrado: sale del selector «agregar un subcontratista a un trabajo», conserva sus trabajos y pagos, y sigue apareciendo en la lista de fin de año de los años en que le pagó." },
        ],
      },
      {
        id: "insurance-and-clearance",
        heading: "Seguro y constancia",
        blocks: [
          { p: "Dos vencimientos con fecha, en el orden en que importan. Primero el **Seguro**: un certificado vencido lo hace responsable de los daños del subcontratista en cuanto está en la obra. Luego la **Constancia** (WSIB en Ontario, CNESST en Quebec, WCB en otras provincias): una constancia vencida lo hace responsable de sus primas — una factura más que una demanda. La insignia en una tarjeta es la peor de las dos." },
          { table: {
            head: ["Insignia", "Qué significa"],
            rows: [
              ["Vigente", "La fecha está registrada y a más de 30 días."],
              ["Por vencer", "La fecha cae dentro de los próximos 30 días. El subcontratista aparece en el panel de vencimientos."],
              ["Vencido", "La fecha ya pasó. El subcontratista aparece en el panel de vencimientos, primero."],
              ["Sin registrar", "No se ingresó ninguna fecha. Es un hueco en el papeleo, no un subcontratista sin seguro — nunca cuenta como vencido y nunca aparece en el panel."],
            ],
          } },
          { warning: "FieldQuo no le impide poner en un trabajo a un subcontratista con el papeleo vencido. La página del trabajo muestra «Seguro o constancia vencidos» junto a él; decidir si va a la obra es cosa suya." },
        ],
      },
      {
        id: "on-a-job",
        heading: "Poner un subcontratista en un trabajo y pagarle",
        blocks: [
          { p: "Los subcontratistas se vinculan desde el trabajo, no desde esta pantalla. La página del trabajo tiene una sección **Subcontratistas en este trabajo**: «Empresas contratadas a precio fijo. El monto acordado es lo que cuesta este trabajo, sea lo que sea que le cotizaste al cliente; los pagos son cómo se va liquidando.» Cada línea pasa por **Cotizado**, **Acordado**, **Terminado** y **Pagado**." },
          { steps: [
            "En el trabajo, pulse **Agregar un subcontratista**, elija el subcontratista y, si quiere, la visita y qué va a hacer.",
            "Ingrese el **Monto acordado**, o déjelo vacío hasta que esté acordado — «Sin monto todavía» es cotizado, no costo.",
            "Cuando le haya pagado, pulse **Registrar un pago**: monto, **Pagado por** (Efectivo, Transferencia, Cheque), **Pagado el** y una nota. «Esto registra el pago y un gasto contra el trabajo en un solo paso. Es dinero que ya salió — no envía nada.»",
            "La línea dice «$2,000.00 pagados, faltan $3,000.00», luego **Pagado por completo**; un pago adicional se muestra como pagado de más en lugar de rechazarse.",
          ] },
        ],
      },
      {
        id: "who-can-see-it",
        heading: "Quién puede verlo",
        blocks: [
          { p: "Abrir la lista, agregar un subcontratista, editarlo y subir documentos requieren el permiso de gestión de equipo — propietarios, administradores, Managers y Dispatchers. El nombre de un subcontratista y si su seguro está vigente son operaciones: el despachador que pone al electricista en la visita del jueves necesita saber que su constancia venció. Crew y Estimator no ven la fila." },
          { p: "El dinero en la pantalla — montos acordados, pagos, totales del año, **Pagado en** y el CSV — requiere además el interruptor «Job costing». Un Dispatcher abre la lista, ve el seguro vencido y no ve cifras; un Manager ve ambas cosas. Vea [[the-custom-access-editor|El editor de acceso personalizado]]." },
        ],
      },
    ],
    faq: [
      { q: "¿Puedo pagarle a un subcontratista a través de FieldQuo?", a: "No. Registrar un pago anota el pago y un gasto contra el trabajo; el dinero pasó antes por su banco, un cheque o una transferencia. La función de pago dentro de la aplicación paga a una persona de su propia lista por horas fichadas, no a una empresa por una cotización." },
      { q: "¿Qué pasa si dejo una fecha de vencimiento vacía?", a: "El subcontratista muestra **Sin registrar** para ese dato y nunca aparece como vencido. Vacío significa que no ingresó el certificado, no que no tenga seguro." },
      { q: "¿Puedo importar la cotización del propio subcontratista?", a: "Sí, a su presupuesto — vea [[import-a-subcontractor-quote|Importar la cotización de un subcontratista]]. Cuando el presupuesto se convierte en trabajo, ese precio importado puede adoptarse como monto acordado en la sección de Subcontratistas del trabajo." },
    ],
  },

  "the-t5018-year-end-list": {
    title: "La lista de fin de año T5018",
    summary:
      "Un CSV por año calendario que lista a cada subcontratista, si va en el formulario de contratistas, lo que le pagó y cuántos pagos — la cifra que el contador venía reconstruyendo a partir de talones de cheques.",
    updated: "2026-09-12",
    intro: [
      "En Canadá, un contratista que le pagó más de $500 en el año a un subcontratista de construcción presenta un T5018 por él; en Estados Unidos es un 1099-NEC por encima de $600. Ambos son una lista de empresa y monto. FieldQuo construye esa lista a partir de los pagos que registró para cada subcontratista en cada trabajo, de modo que el número en la ficha del subcontratista, el número en el archivo y el número en el [[job-costing|Costeo de trabajos]] son las mismas filas sumadas una sola vez.",
    ],
    sections: [
      {
        id: "overview",
        heading: "Visión general",
        blocks: [
          { p: "La lista es el botón **Lista de fin de año (CSV)** en la pantalla **Subcontratistas**, junto al selector de año **Pagado en**. La misma cifra se muestra en la ficha de cada subcontratista como «Pagado en 2026 — la cifra del formulario anual de contratistas» con el número de pagos, y en la tarjeta de la lista como «$6,840.00 pagados en 2026 (3 pagos)»." },
          { p: "El umbral no se aplica a propósito. Se lista a cada subcontratista, incluidos los que recibieron $0 y los marcados **Sin formulario fiscal**, porque el contador decide quién presenta y FieldQuo no sabe qué regla de qué jurisdicción aplica. Una fila en cero dice «revisamos, nada»; una fila ausente no dice nada." },
        ],
      },
      {
        id: "download-the-list",
        heading: "Cómo descargar la lista",
        blocks: [
          { steps: [
            "Abra **Subcontratistas** (bajo Personas).",
            "Elija el año bajo **Pagado en** — el selector cambia los totales en cada tarjeta.",
            "Pulse **Lista de fin de año (CSV)**. El archivo se llama subcontractors-2026.csv.",
            "Entrégueselo a su contador. La descarga queda anotada en el [[the-activity-log|Registro de actividad]].",
          ] },
          { figure: "harness:subcontractors", caption: "Subcontratistas — el selector de año Pagado en y el botón Lista de fin de año (CSV) sobre la lista, cada tarjeta con su total pagado en el año." },
          { note: "El archivo indica su moneda según la Configuración de la empresa y termina con «Recorded in FieldQuo; no form has been filed through this system.» FieldQuo genera la lista; no presenta nada." },
        ],
      },
      {
        id: "what-is-in-the-file",
        heading: "Qué hay en el archivo",
        blocks: [
          { table: {
            head: ["Columna", "Qué contiene"],
            rows: [
              ["Subcontractor", "El nombre de la empresa, en orden alfabético."],
              ["Trade", "El oficio de su ficha, o vacío."],
              ["Tax form", "yes o no — la casilla **Va en el formulario anual de contratistas (T5018 / 1099-NEC)** de su ficha."],
              ["Paid in year", "La suma de los pagos con fecha dentro de ese año calendario, al centavo."],
              ["Payments", "Cuántos pagos componen ese total."],
              ["Active", "yes o no — un subcontratista inactivo al que le pagó antes en el año igual aparece."],
            ],
          } },
        ],
      },
      {
        id: "what-counts",
        heading: "Qué cuenta como pagado",
        blocks: [
          { bullets: [
            "Un pago cuenta en el año de su fecha **Pagado el**, no en el año del trabajo ni del monto acordado.",
            "Solo cuentan los pagos registrados con **Registrar un pago** en un trabajo. Un monto acordado que no se ha pagado no está en el total.",
            "Una fila **TOTAL** al final suma a cada subcontratista y cada pago del año.",
            "**Sin formulario fiscal** en un subcontratista no lo quita del archivo — pone su columna Tax form en no, para que su contador vea la decisión y no una ausencia.",
          ] },
        ],
      },
      {
        id: "who-can-see-it",
        heading: "Quién puede verlo",
        blocks: [
          { p: "El botón, el selector **Pagado en** y cada cifra de dinero requieren tanto el permiso de gestión de equipo como el interruptor «Job costing» — propietarios, administradores y un Manager con el costeo de trabajos activado. Un Dispatcher ve la lista y las insignias de seguro, pero ni totales ni botón. A una sesión de soporte en solo lectura se le niega el archivo por completo." },
        ],
      },
    ],
    faq: [
      { q: "¿FieldQuo presenta el T5018 o el 1099-NEC?", a: "No. Genera la lista de empresas y montos; el formulario lo prepara y presenta usted o su contador." },
      { q: "¿Por qué un subcontratista al que le pagué en diciembre pasado está en el archivo de este año?", a: "Porque la fecha Pagado el del pago cae en este año. Edite la fecha en el pago si se registró mal; el total sigue la fecha." },
      { q: "¿Puedo obtener la lista de un año anterior?", a: "Sí — elija el año bajo Pagado en y pulse el botón. Cualquier año con pagos registrados funciona." },
    ],
  },

  "vehicles-and-fleet": {
    title: "Vehículos y flota",
    summary:
      "Las camionetas: qué toca, qué está por vencer, quién tiene cada una — seguro, matrícula y servicio por fecha o por kilometraje, un registro de mantenimiento, documentos y el costo de operación para quien puede verlo.",
    updated: "2026-09-12",
    intro: [
      "**Vehículos** responde las tres preguntas que una empresa con tres camionetas realmente se hace: qué toca, qué está por vencer y quién tiene la camioneta. A propósito no es un producto de telemática — sin GPS en vivo, sin historial de rutas. Un navegador no puede rastrear una camioneta en segundo plano, así que un mapa de «dónde está la camioneta» solo sería correcto mientras alguien tuviera la pestaña abierta.",
      "Cada vehículo aquí es también un activo en el registro de **Configuración → Gastos generales** — esa es la fila que lleva lo que costó y cómo se deprecia, que es lo que sube su precio mínimo. Esta pantalla agrega los datos de flota a esa fila sin tocar la contabilidad. Vea [[overhead-and-your-minimum-price|Gastos generales y su precio mínimo]].",
    ],
    sections: [
      {
        id: "overview",
        heading: "Visión general",
        blocks: [
          { p: "La pantalla lleva el título **Vehículos** — «Qué toca, qué está por vencer y quién tiene la camioneta. Lo que costó cada uno está en el registro de activos.» Un panel **Pendiente o por vencer** va primero, porque un certificado de seguro vencido es una camioneta que no debería estar en la calle, y luego una tarjeta por vehículo." },
          { note: "Solo en FieldQuo: ni Jobber, ni Housecall Pro, ni ServiceTitan, ni Projul muestran vencimientos de vehículos, un registro de mantenimiento o un costo por kilómetro en su página de precios en ningún nivel. La prueba es la pantalla misma — app/app/fleet — y está en todos los planes." },
        ],
      },
      {
        id: "on-the-screen",
        heading: "Qué hay en la pantalla",
        blocks: [
          { bullets: [
            "**Pendiente o por vencer** — cada vehículo con algo **Por vencer** o vencido, indicando qué: Seguro, Matrícula, Servicio (por fecha), Servicio (por kilometraje).",
            "**Una tarjeta por camioneta** — «Ford Transit 250 — 2022», su placa, una insignia (**Algo se venció**, **Algo toca pronto**, **Nada pendiente**, **Nada registrado**) y «con Léo Bouchard».",
            "**La tarjeta desplegada** — los cuatro vencimientos, **Odómetro (km)**, **VIN**, **Costo** y **Valor en libros hoy** para quien puede verlos, **Editar**, luego **Mantenimiento**, **Documentos**, **Gastos** y **Costos de operación**.",
            "**Agregar** — vincula los datos de flota a un vehículo que ya está en el registro de activos. Sin nada en el registro, la pantalla lo dice y enlaza **Agregar un vehículo al registro**.",
          ] },
        ],
      },
      {
        id: "add-a-vehicle",
        heading: "Cómo agregar un vehículo",
        blocks: [
          { steps: [
            "Ponga primero la camioneta en el registro de activos — **Configuración → Gastos generales**, bajo Activos y depreciación — con lo que costó. Lo hace un propietario o administrador.",
            "Abra **Vehículos** (bajo Dinero) y pulse **Agregar**.",
            "Bajo **Qué vehículo**, elija el activo.",
            "Complete **Placa**, **Marca y modelo**, **VIN**, **Año** y el **Odómetro (km)** — «Déjalo en blanco si no lo sabes».",
            "Elija **Quién la tiene** (o «Nadie en particular»), luego las fechas: **El seguro vence**, **La matrícula vence**, **Próximo servicio (fecha)** y **Próximo servicio (km)**.",
            "Pulse **Guardar**. La tarjeta aparece con su insignia calculada a partir de lo que ingresó.",
          ] },
          { figure: "harness:fleet", caption: "Vehículos — el panel Pendiente o por vencer indicando el seguro y el servicio de una camioneta, luego una tarjeta por camioneta con su insignia y quién la tiene." },
          { note: "Un servicio que toca por kilometraje solo empieza a contar cuando se llena el odómetro; sin lectura muestra **No hay suficiente registrado** en vez de una suposición. Una fecha en blanco es **Sin fecha registrada** — nunca se trata como vencida." },
        ],
      },
      {
        id: "what-each-field-changes",
        heading: "Qué cambia cada campo",
        blocks: [
          { table: {
            head: ["Campo", "Qué cambia"],
            rows: [
              ["Odómetro (km)", "La lectura desde la que Servicio (por kilometraje) cuenta hacia atrás, y una de las dos lecturas que necesita un costo por km. Registrar mantenimiento con un odómetro lo mueve: «El odómetro de la camioneta se actualizó según esta entrada.»"],
              ["Quién la tiene", "El nombre en la tarjeta. Un miembro del equipo desactivado aparece como «ya no está activo» hasta que lo cambie."],
              ["El seguro vence / La matrícula vence", "Vencimientos con fecha. Dentro de 30 días: **Por vencer** y aparece en el panel; pasada: vencida y aparece primero. Subir un documento Póliza de seguro o Registro vehicular con fecha de vencimiento mueve la fecha correspondiente aquí."],
              ["Próximo servicio (fecha)", "La misma ventana de 30 días, para el taller."],
              ["Próximo servicio (km)", "**Por vencer** a menos de 500 km de la lectura del odómetro; vencido una vez pasado."],
              ["Costo / Valor en libros hoy", "Leídos del registro de activos — el precio de compra y lo que dejó la depreciación. No se editan aquí."],
              ["Quitar la ficha de flota", "Quita la placa, las fechas y el registro. «El activo en sí, y su depreciación, quedan tal cual están.»"],
            ],
          } },
        ],
      },
      {
        id: "maintenance-and-documents",
        heading: "Mantenimiento, documentos y costos de operación",
        blocks: [
          { bullets: [
            "**Mantenimiento** — **Registrar trabajo**: el tipo (Servicio, Reparación, Llantas, Inspección, Otro), **Qué se hizo**, el odómetro en ese momento y cuánto costó — «déjalo en blanco si no lo sabes». Eliminar una entrada conserva la lectura de odómetro que fijó: «la camioneta sí recorrió esos kilómetros».",
            "**Documentos** — **Agregar un documento**: Registro vehicular, Póliza de seguro, Factura de compra, Foto u Otro, con un vencimiento opcional. Una factura de compra es dinero y se oculta a quien no puede ver el costo: «2 más ocultos por tu nivel de acceso».",
            "**Gastos** — combustible, peajes y reparaciones registrados en **Configuración → Control de gastos** con este vehículo elegido, y el total del mes.",
            "**Costos de operación** — gastos y mantenimiento de los últimos 12 meses, depreciación, **Costo total de propiedad, últimos 12 meses** y **Costo por km**, que necesita dos lecturas de odómetro con al menos 30 días de diferencia y lo dice cuando no se puede calcular.",
          ] },
        ],
      },
      {
        id: "who-can-see-it",
        heading: "Quién puede verlo",
        blocks: [
          { p: "La pantalla requiere el permiso de gestión de equipo — propietarios, administradores, Managers y Dispatchers. Una placa, un odómetro y una renovación de seguro son operaciones: el despachador que decide qué camioneta va a dónde necesita saber que una está fuera de servicio el jueves. Crew y Estimator no ven la fila." },
          { p: "Lo que costó la camioneta — **Costo**, **Valor en libros hoy**, la depreciación, el costo por km y la factura de compra — es la base de costos de la empresa y requiere además el interruptor «Job costing», la misma puerta que el registro de activos. Un Dispatcher ve los vencimientos y no el préstamo del camión." },
        ],
      },
    ],
    faq: [
      { q: "¿FieldQuo rastrea dónde está la camioneta?", a: "No. No hay GPS ni historial de rutas. La pantalla registra quién la tiene, cuándo vence su papeleo y cuánto cuesta operarla." },
      { q: "Alguien eliminó el activo — ¿se perdió la camioneta?", a: "La ficha de flota se queda, marcada con una advertencia de que el activo detrás de ella se eliminó. Sus fechas siguen siendo reales; consérvelas, o quite la ficha de flota cuando la camioneta ya no esté." },
      { q: "¿Por qué Costo por km está vacío?", a: "Necesita dos lecturas de odómetro con al menos 30 días de diferencia — la lectura actual de la camioneta y una registrada con una entrada de mantenimiento — y la ficha de activo. La tarjeta dice cuál falta." },
    ],
  },

  "purchasing-orders-stock-and-suppliers": {
    title: "Compras: pedidos, existencias y proveedores",
    summary:
      "A quién le compra, qué tiene pedido y qué hay en la bodega — órdenes de compra recibidas línea por línea, un nivel de existencias sumado a partir de movimientos, y una alerta de reposición para los materiales con umbral.",
    updated: "2026-09-12",
    intro: [
      "**Compras** son tres vistas de un mismo movimiento de mercancía: usted emite un pedido a un proveedor, lo recibe, y la entrega es lo que cambia la bodega. La pantalla lleva el título «A quién le compras, qué tienes pedido y qué hay en la bodega.» con tres pestañas — **Pedidos**, **Existencias**, **Proveedores**.",
      "Está hecha para usarse de pie junto a la camioneta. Todo se apila en un teléfono, y una entrega se registra como lo que de verdad llegó — «12 de 40» — porque la mitad de un pedido el martes y el resto el jueves es la semana normal en un mostrador de materiales.",
    ],
    sections: [
      {
        id: "overview",
        heading: "Visión general",
        blocks: [
          { p: "Una orden de compra se numera por empresa — PO-001, PO-002 — con un proveedor, líneas de lo que pide con una cantidad y un precio unitario, y un total previsto calculado en el servidor. Su estado se deriva de lo que ha llegado, nunca se fija a mano; las dos cosas que fija a mano son que se envió y que se canceló. Las existencias son un libro de movimientos, nunca un conteo almacenado, así que una corrección tras un inventario también es un movimiento, y el conteo que estaba mal queda en el registro." },
          { note: "Solo en FieldQuo entre las herramientas de servicios en campo: ni Jobber ni Housecall Pro muestran órdenes de compra ni existencias en su página de precios en ningún nivel. Del nivel superior de ServiceTitan se reporta que agrega «advanced inventory», y el nivel Pro de Projul muestra órdenes de compra. FieldQuo incluye Compras en todos los planes." },
        ],
      },
      {
        id: "on-the-screen",
        heading: "Qué hay en la pantalla",
        blocks: [
          { bullets: [
            "**Pedidos** — **Órdenes de compra** con **Nuevo pedido**; una fila por pedido: «PO-014 · Bois Laurentides», «0 de 2 líneas completas», un estado (Borrador, Enviado, Entregado en parte, Todo recibido, Cancelado) y el total previsto o **sin precio**. Un pedido abierto ofrece **Marcar como enviado**, **Registrar lo que llegó** y **Cancelar el pedido**.",
            "**Existencias** — **En la bodega**: una fila por material con su nivel y «Reponer en 10» o «Sin nivel de reposición definido»; **Por debajo del nivel de reposición** listando lo que anda bajo; y **Registrar un movimiento**.",
            "**Proveedores** — **Agregar un proveedor** (nombre, su número de cuenta allí, con quién trata, teléfono) y la lista, cada uno con **Retirar** o **Recuperar**.",
          ] },
        ],
      },
      {
        id: "raise-an-order",
        heading: "Cómo emitir un pedido y recibirlo",
        blocks: [
          { steps: [
            "Abra **Compras** (bajo Dinero) y, en **Proveedores**, agregue al comerciante una vez si todavía no está.",
            "En **Pedidos**, pulse **Nuevo pedido**, elija el proveedor y agregue una línea por artículo: qué está pidiendo, **Cant.**, la unidad y el precio **C/u**. Deje un precio en blanco si no lo sabe — el pedido se muestra como **sin precio** en vez de como si no costara nada.",
            "Pulse **Emitir el pedido**. Se numera y se guarda como Borrador.",
            "Cuando lo haya colocado con el proveedor, pulse **Marcar como enviado**. Esto registra la fecha; FieldQuo no le envía el pedido al proveedor por correo.",
            "Cuando llega la mercancía, pulse **Registrar lo que llegó** e ingrese, por línea, cuántos vinieron. El estado pasa a **Entregado en parte** o **Todo recibido** según las cantidades.",
            "Si llega más de lo pedido, se acepta y se señala: «Llegó más de lo pedido: … Ya entró a existencias — decide si se paga.»",
          ] },
          { figure: "harness:purchasing", caption: "Compras → Pedidos — dos órdenes de compra, una Enviado sin ninguna línea recibida todavía y una Todo recibido, con sus totales previstos." },
          { warning: "Una línea de pedido escrita en esta pantalla es texto libre. No está ligada a un material, así que registrar su entrega actualiza el pedido — no la bodega. Para cambiar un nivel de existencias, registre un movimiento **Recibido** en la pestaña **Existencias** para el material." },
        ],
      },
      {
        id: "order-statuses",
        heading: "Estados de un pedido",
        blocks: [
          { table: {
            head: ["Estado", "Qué significa"],
            rows: [
              ["Borrador", "Emitido, todavía no colocado. Se puede marcar como enviado o cancelar."],
              ["Enviado", "Usted pulsó Marcar como enviado; la fecha queda registrada y el Registro de actividad dice «PO-014: The order has gone to the supplier.» A la espera de la entrega."],
              ["Entregado en parte", "Al menos una línea tiene algo recibido y al menos una está incompleta. Se deriva de las cantidades, nunca se fija a mano."],
              ["Todo recibido", "Cada línea recibió al menos lo que se pidió."],
              ["Cancelado", "Usted pulsó Cancelar el pedido; el Registro de actividad dice «The order will not be filled.» Un pedido cancelado no se puede enviar ni recibir."],
            ],
          } },
        ],
      },
      {
        id: "stock",
        heading: "Existencias",
        blocks: [
          { p: "La pestaña **Existencias** lista los materiales de la empresa con un nivel sumado a partir de cada movimiento registrado a su nombre. Los materiales nacen cuando se compra una línea de la lista de abastecimiento de un trabajo — vea [[materials-on-a-job|Materiales en un trabajo]] — y aquí no hay ninguna pantalla para crear uno ni para fijar su nivel de reposición; un material sin nivel dice **Sin nivel de reposición definido**, y la lista de existencias bajas dice de cuántos no puede opinar." },
          { bullets: [
            "**Recibido** — mercancía que entra; el nivel sube.",
            "**Devuelto a existencias** — traído de vuelta de un trabajo; sube.",
            "**Usado en un trabajo** — baja.",
            "**Desperdicio** — baja.",
            "**Corrección tras un conteo** — «Una corrección puede ser negativa — escribe un signo menos si el conteo salió corto. No se edita ni se elimina nada; la corrección se suma al libro.»",
          ] },
          { note: "**Por debajo del nivel de reposición** lista solo los materiales que tienen un umbral y están por debajo. Un material sin umbral nunca se declara bajo, porque la ausencia de umbral no es una afirmación sobre la bodega." },
        ],
      },
      {
        id: "suppliers",
        heading: "Proveedores",
        blocks: [
          { p: "Un proveedor es un nombre, su número de cuenta allí, con quién trata y un teléfono. No hay borrado — **Retirar** saca al comerciante del selector de pedidos y conserva cada pedido y pago a su nombre, y **Recuperar** lo restituye. La lista de proveedores es lo que convierte «¿a quién le compramos esto?» en «¿cuánto gastamos ahí este año?»." },
        ],
      },
      {
        id: "who-can-see-it",
        heading: "Quién puede verlo",
        blocks: [
          { p: "Compras forma parte del área «Expenses» de la cuadrícula de acceso: la fila y cada pestaña requieren «View, record, and edit everyone's», porque una orden de compra o un nivel de existencias no tienen «los míos». Los propietarios, los administradores y el preajuste Manager lo tienen; Dispatcher, Estimator y Crew empiezan solo con sus propios gastos y ven «Compras forma parte del permiso de gastos. Pídele a un propietario o administrador que te dé acceso a los gastos de todos.»" },
        ],
      },
    ],
    faq: [
      { q: "¿Marcar como enviado le envía el pedido al proveedor?", a: "No. Registra que usted lo colocó y deja la fecha. Envíe el pedido como ya lo hace — el mostrador del proveedor, el teléfono o su portal." },
      { q: "¿Por qué mi entrega no cambió la pestaña Existencias?", a: "Las líneas de pedido emitidas en esta pantalla son texto libre sin un material detrás, así que su entrega solo actualiza el pedido. Registre un movimiento Recibido en la pestaña Existencias para el material." },
      { q: "¿Puedo editar un nivel de existencias después de un conteo?", a: "Registre una **Corrección tras un conteo** por la diferencia, negativa si salió corto. El libro conserva el conteo equivocado y la corrección, que es el único registro de que algo alguna vez estuvo mal." },
    ],
  },

  "the-activity-log": {
    title: "El Registro de actividad",
    summary:
      "La pista de auditoría de la empresa — quién envió, editó, aprobó, pagó o cambió qué, con su nombre, su nivel de acceso y cuándo — de solo lectura, lo más reciente primero, solo propietarios y administradores.",
    updated: "2026-09-12",
    intro: [
      "El **Registro de actividad** es la respuesta a «¿quién cambió esto?». Cada ruta que cambia algo que una empresa querría rastrear escribe aquí una línea después de que el cambio se confirmó — un presupuesto enviado, un pago registrado, horas aprobadas, un miembro invitado o desactivado, una tarifa de pago cambiada, un año de ausencias trasladado — con el nombre de la persona que lo hizo, su nivel de acceso y la hora. Es un registro para consultar cuando algo se ve mal, no un tablero.",
    ],
    sections: [
      {
        id: "overview",
        heading: "Visión general",
        blocks: [
          { p: "La pantalla lleva el título **Registro de actividad** — «Un registro de las acciones importantes de tu cuenta — presupuestos enviados, pagos registrados, horas añadidas y aprobadas, gastos, cambios de clientes y de equipo, tarifas y ajustes.» Una sola lista, lo más reciente primero, que muestra las últimas 100 entradas. Hoy no hay filtro, búsqueda ni exportación en esta pantalla, y nada en ella se puede editar ni eliminar." },
          { p: "La frase de una línea se escribió en el momento en que ocurrió la acción y se guarda tal como se escribió. Las líneas más antiguas se quedan en el inglés en que se registraron; las líneas escritas desde que el registro aprendió a llevar una clave de traducción se leen en su idioma. Un registro que cambiara retroactivamente no sería un registro." },
        ],
      },
      {
        id: "on-the-screen",
        heading: "Qué hay en la pantalla",
        blocks: [
          { bullets: [
            "**Un punto de color** por línea — rojo para una eliminación o una desactivación, ámbar para un cambio de ajustes o alguien que aprueba sus propias horas, verde para un pago, azul para algo enviado, gris para todo lo demás.",
            "**La frase** — «Sent invoice INV-2071 to sophie.dubois@example.com», «Invited Ana Pereira as Crew», «Updated cabinet pricing», «Recorded the pay run for … as paid outside FieldQuo».",
            "**Quién, su nivel y cuándo** — «Julie Gagnon · supervisor · hace 4 h», relativo durante 30 días y luego una fecha. Una acción realizada por el soporte de FieldQuo durante una sesión de solo lectura se marca como **sesión de soporte** — lo que nunca debería ocurrir, y aquí es donde se vería.",
          ] },
        ],
      },
      {
        id: "read-the-log",
        heading: "Cómo leer el registro",
        blocks: [
          { steps: [
            "Abra **Configuración → Registro de actividad** (bajo Negocio).",
            "Recorra los puntos según lo que busca: rojo para «quién quitó esto», verde para «quién registró ese pago», ámbar para «quién cambió ese ajuste».",
            "Lea el nombre y el nivel de la línea. El nombre se guardó en el momento, así que un empleado renombrado o que ya se fue sigue apareciendo como quien era.",
          ] },
          { figure: "harness:settings-activity", caption: "Configuración → Registro de actividad — una línea por acción con su punto, la frase, y quién la hizo, su nivel y hace cuánto." },
          { tip: "Para un solo presupuesto, trabajo o factura, la página del propio registro es más rápida que recorrer todo el historial; el registro es para la pregunta «qué ha estado pasando en esta cuenta» y para rastrear un cambio que nadie reconoce." },
        ],
      },
      {
        id: "what-gets-logged",
        heading: "Qué se registra",
        blocks: [
          { bullets: [
            "**Presupuestos, facturas y trabajos** — creados, enviados, con seguimiento, aceptados, marcados como pagados, programados.",
            "**Dinero** — pagos registrados, gastos, un pago a un subcontratista, una nómina guardada, aprobada, registrada como pagada o cancelada, un componente de nómina agregado o quitado, la lista de fin de año descargada.",
            "**Horas** — entradas de tiempo agregadas, editadas y aprobadas, incluida una persona que aprueba las suyas.",
            "**Equipo** — invitaciones, un nivel de acceso cambiado, un miembro desactivado, horarios de trabajo o políticas de ausencias cambiados, un año de ausencias trasladado.",
            "**Clientes** — un cliente agregado o sus datos de contacto editados.",
            "**Ajustes** — tarifas, marca, el ciclo de pago, proveedores retirados y el resto de las pantallas de configuración.",
          ] },
        ],
      },
      {
        id: "who-can-see-it",
        heading: "Quién puede verlo",
        blocks: [
          { p: "Solo propietarios y administradores. La fila está oculta para todos los demás niveles y el servidor responde «Only an owner or admin can view the activity log.» a cualquier otra persona — el registro nombra acciones de todos los usuarios, incluidos pagos, cambios de tarifas de pago y quién desactivó a quién, que no son cosa que un Manager deba leer." },
          { note: "El registro nunca hace fallar ni revierte la acción que describe. Si la escritura en el propio registro falló, la acción igual ocurrió y la línea falta — un intercambio deliberado, para que el presupuesto de un cliente nunca se pierda porque no se pudo escribir una fila de auditoría." },
        ],
      },
    ],
    faq: [
      { q: "¿Puedo exportar el registro o buscar en él?", a: "No en esta pantalla hoy. Muestra las últimas 100 entradas, lo más reciente primero. Para un historial más largo, pida a soporte." },
      { q: "¿Por qué una línea está en inglés en mi cuenta en español?", a: "Se escribió antes de que el registro llevara claves de traducción, y las frases guardadas nunca se reescriben. Las líneas escritas desde entonces se leen en su idioma." },
      { q: "¿Se puede eliminar una línea?", a: "No. Nada en el registro se puede editar ni quitar, ni usted ni el soporte de FieldQuo — de eso se trata." },
    ],
  },
};
