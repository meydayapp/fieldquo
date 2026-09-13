// content/help/es/team-and-access-1.js
//
// Parte 1 de la categoría «team-and-access» en español (ver el compositor,
// team-and-access.js): Gestionar equipo, las invitaciones, los cinco niveles
// de acceso, el editor personalizado, las licencias y la desactivación.
//
// Misma estructura que el inglés (mismos slugs, mismas secciones, mismos
// bloques); las palabras en pantalla vienen del bloque `es` de
// app/i18n/appMessages.js. Los nombres de los niveles (Crew, Estimator,
// Dispatcher, Manager, Administrator), de las áreas y de los peldaños son las
// cadenas inglesas del producto, mostradas tal cual en todos los idiomas.
export const ARTICLES = {
  "manage-team": {
    title: "Gestionar equipo",
    summary:
      "La pantalla del equipo: quién forma parte de él, qué puede ver y hacer cada persona, el panel de licencias, las invitaciones pendientes y los botones Agregar usuario, Agregar cuadrilla y Agregar una licencia.",
    updated: "2026-09-12",
    intro: [
      "**Gestionar equipo** es donde viven las personas de su empresa en FieldQuo. Es una sola pantalla a la que se llega de dos maneras — **Tu equipo** en la barra lateral principal, bajo Personas, y **Configuración → Gestionar equipo** bajo Equipo y horarios — y muestra a cada persona con inicio de sesión, el nivel de acceso que tiene, y cuántas licencias y plazas de cuadrilla de su plan están en uso.",
      "Todo lo relativo al acceso de una persona se cambia aquí. Sus horas, su tarifa y sus ausencias viven en otras pantallas — Hojas de tiempo, Trabajadores, Ausencias — a las que esta página enlaza.",
    ],
    sections: [
      {
        id: "overview",
        heading: "Resumen",
        blocks: [
          { p: "La página tiene tres partes, de arriba abajo: el panel de licencias, una fila de pestañas y la lista del equipo. El panel de licencias compara su plan con las personas que lo ocupan. La lista muestra a cada miembro con su nivel en la columna **Rol**, su **Último acceso** y una casilla **Activo**. Una invitación que nadie ha aceptado todavía se coloca al final de la lista con una insignia **Invitado** y un botón **Cancelar invitación**." },
          { figure: "live:app-settings-team", caption: "Gestionar equipo en una empresa de una sola persona — el panel de licencias (1 / 3 licencias usadas, 0 / 8 de cuadrilla — incluidos sin costo), las pestañas Trabajadores, Hojas de tiempo y Nómina, y la lista con la fila del propietario." },
        ],
      },
      {
        id: "what-is-on-the-screen",
        heading: "Qué hay en la pantalla",
        blocks: [
          { bullets: [
            "**Agregar usuario**, arriba a la derecha, abre el formulario Nuevo usuario — vea [[invite-a-team-member|Invitar a un miembro del equipo]].",
            "El panel de licencias: las **licencias usadas** de las que incluye su plan, los **de cuadrilla — incluidos sin costo** de sus plazas de cuadrilla, y un desglose por tipo — **Administradores**, **Encargados**, **Despachadores**, **Trabajadores**, **Cuadrilla**, **Acceso personalizado** — que solo enumera los tipos que usted realmente tiene.",
            "**Agregar cuadrilla — sin costo** y **Agregar una licencia**. Ambos abren el mismo formulario Nuevo usuario; el primero con el nivel Crew ya elegido, el segundo con Dispatcher. Cuando se alcanza un tope, el botón se atenúa con el motivo, y la frase de al lado nombra el siguiente plan que cabría.",
            "**Solo soy yo — ahora mismo no tengo cuadrilla.** — se muestra solo mientras usted es la única persona de la lista. Marcarla quita «Invita a tu equipo» de su lista de configuración, y la casilla se oculta en cuanto se agrega a alguien más.",
            "Las pestañas **Trabajadores**, **Hojas de tiempo** y **Nómina**. Trabajadores y Nómina aparecen solo para un propietario o un administrador; Hojas de tiempo para todos los que pueden abrir esta página.",
            "Las columnas de la lista: **Nombre / Correo**, **Rol**, **Último acceso** (se quita en pantallas estrechas para que la casilla Activo siga al alcance) y **Activo**.",
            "**En la nómina, sin acceso** — una sección que aparece cuando existe una ficha de trabajador sin inicio de sesión vinculado: a esa persona se la puede programar y pagar, pero no puede iniciar sesión. Gestiónela en Trabajadores.",
          ] },
        ],
      },
      {
        id: "change-someones-access",
        heading: "Cómo cambiar el acceso de alguien",
        blocks: [
          { steps: [
            "Busque a la persona en la lista. Su nivel aparece en la columna **Rol** — como lista desplegable si usted puede cambiarlo, como insignia gris si no puede.",
            "Elija **Crew**, **Estimator**, **Dispatcher**, **Manager** o **Administrator** en la lista. El cambio se aplica de inmediato: el nivel de permisos de la persona y toda su cuadrícula se reemplazan por los del nivel elegido, y conserva el mismo inicio de sesión.",
            "Elija en cambio **Personalizado…** para abrir el editor y mover los ajustes uno por uno — vea [[the-custom-access-editor|El editor de acceso personalizado]].",
          ] },
          { figure: "harness:team", caption: "Gestionar equipo en un taller de seis personas — 4 / 6 licencias usadas, 3 / 11 de cuadrilla, una lista de niveles en cada fila que el propietario puede cambiar, y una invitación pendiente con Cancelar invitación." },
          { note: "Pasar a alguien de Crew a cualquier otro nivel ocupa una licencia. Si su plan no tiene ninguna libre, el cambio se rechaza con los números de su plan y el plan que cabría; primero mejore el plan desde **Cuenta y facturación**." },
        ],
      },
      {
        id: "what-each-control-changes",
        heading: "Qué cambia cada control",
        blocks: [
          { table: {
            head: ["Control", "Qué hace"],
            rows: [
              ["Lista Rol", "Reemplaza el acceso de la persona por el nivel elegido, de inmediato. Una insignia en lugar de una lista significa que usted no puede cambiar esa fila: es la suya, es la de un propietario, o la persona está en su rango o por encima."],
              ["Casilla Activo", "Desmarcada, la persona ya no puede iniciar sesión en su empresa y deja de contar en su plan; sus registros se conservan. Solo propietario y administrador — vea [[deactivate-a-team-member|Desactivar a un miembro del equipo]]."],
              ["Cancelar invitación", "Le pide confirmar y luego deja sin efecto el enlace de invitación y libera la plaza que retenía. Una ficha de trabajador que ya esté en sus registros se conserva."],
              ["Agregar cuadrilla — sin costo / Agregar una licencia", "Abren Nuevo usuario con un nivel preseleccionado. El nivel sigue siendo editable en el formulario."],
              ["Solo soy yo — ahora mismo no tengo cuadrilla.", "Registra que usted trabaja solo y quita el paso de invitación de la lista de configuración. Desmárquela el día que contrate a alguien."],
            ],
          } },
        ],
      },
      {
        id: "who-can-see-it",
        heading: "Quién puede verla",
        blocks: [
          { p: "Los propietarios, los administradores, los Dispatchers y los Managers ven la fila **Tu equipo** y la lista. Los Estimators y la cuadrilla no — la fila está oculta y la página los rechaza. De quienes pueden abrirla, solo un propietario o un administrador puede cambiar el nivel de una persona existente o desmarcar **Activo**. Un Dispatcher o un Manager puede agregar personas (solo Crew o Estimator) y cancelar invitaciones, y ve el nivel de cada uno como una insignia de solo lectura." },
          { note: "La cuenta que registró la empresa es la del propietario. FieldQuo no tiene ningún control para transferir la propiedad ni para cambiar el nivel de un propietario, así que la fila del propietario siempre es una insignia — para todos, otros propietarios incluidos — y la pantalla lo dice al pie: al menos una cuenta siempre debe tener un rol de nivel superior (propietario o administrador)." },
        ],
      },
    ],
    faq: [
      { q: "¿Por qué el nivel de alguien es una insignia gris en lugar de una lista?", a: "O usted no es propietario ni administrador, o la persona está en su rango o por encima. Su propia fila siempre es una insignia: nadie cambia su propio acceso, ni siquiera un propietario." },
      { q: "¿Por qué la columna Rol dice Personalizado?", a: "La cuadrícula de la persona no coincide exactamente con ningún preajuste — alguien movió un ajuste después de elegir un nivel. Abra Personalizado… para ver cuáles, o elija un preajuste para reemplazar toda la cuadrícula." },
      { q: "¿Puede un Manager agregar a un Administrator?", a: "No. Un Manager o un Dispatcher solo puede agregar Crew o Estimator, con cada ajuste como máximo igual al suyo. Solo el propietario puede hacer a alguien administrador." },
    ],
  },

  "invite-a-team-member": {
    title: "Invitar a un miembro del equipo",
    summary:
      "Cómo agregar a alguien a su empresa desde el formulario Nuevo usuario, qué recibe la persona, cuánto dura la invitación y qué cuenta una invitación pendiente.",
    updated: "2026-09-12",
    intro: [
      "Nadie puede agregarse por su cuenta a su empresa. La única puerta de entrada es una invitación enviada desde **Gestionar equipo** por alguien que ya está en el equipo y tiene permiso para invitar. Es a propósito — su lista de clientes y sus precios están detrás de esa puerta.",
      "La invitación lleva todo lo que usted configure en el formulario — nivel, permisos, teléfono, dirección, costo de mano de obra — de modo que la cuenta de la persona está lista en el momento en que acepta. Como dice el formulario: todo lo siguiente se guarda ahora y se aplica automáticamente cuando acepta.",
    ],
    sections: [
      {
        id: "overview",
        heading: "Resumen",
        blocks: [
          { p: "**Agregar usuario** abre **Nuevo usuario**, un formulario en tres tarjetas: **Información personal**, **Permisos** y **Comunicaciones**. Solo **Nombre completo** y **Correo electrónico** son obligatorios. Al pulsar **Enviar invitación** se crea la invitación, se envía por correo y la persona queda en la lista como **Invitado** hasta que acepta." },
          { bullets: [
            "Mire primero el panel de licencias. Un acceso Crew nunca ocupa una licencia; todos los demás niveles sí, y una invitación cuenta desde el momento en que se envía — vea [[seats-and-crew-logins|Licencias y accesos de cuadrilla]].",
            "Un correo que ya está en su equipo, o que ya tiene una invitación, se rechaza: «Someone with that email is already on your team.» / «That email already has an invitation waiting.»",
          ] },
        ],
      },
      {
        id: "send-the-invite",
        heading: "Cómo enviar una invitación",
        blocks: [
          { steps: [
            "Abra **Gestionar equipo** y pulse **Agregar usuario** — o **Agregar cuadrilla — sin costo** / **Agregar una licencia**, que abren el mismo formulario con un nivel ya elegido.",
            "Complete **Información personal**: **Nombre completo** y **Correo electrónico** son obligatorios; **Número de teléfono móvil**, **Dirección**, **Ciudad**, **Provincia**, **Código postal**, **País** y **Subir imagen** son opcionales.",
            "**Costo de mano de obra** — el costo real por hora de la persona para la empresa (salario + cargas), usado para el costeo de trabajos y nunca mostrado a los clientes. Solo un propietario o un administrador ve este campo.",
            "Bajo **Permisos**, elija un nivel: **Crew**, **Estimator**, **Dispatcher**, **Manager**, o **Personalizado** para configurar cada ajuste usted mismo. Un propietario también puede marcar **Hacer administrador** — vea [[administrators|Administradores]].",
            "Bajo **Comunicaciones**, elija el **Idioma de la invitación** — inglés, francés, español, ucraniano, panyabí, tagalo, alemán o italiano. Se aplica solo al correo de invitación y no se puede cambiar una vez enviada.",
            "Pulse **Enviar invitación**. Vuelve a Gestionar equipo, donde la persona aparece como **Invitado** con su nivel junto a la insignia.",
          ] },
          { figure: "create:app-settings-team-create", caption: "Nuevo usuario — Información personal con el campo Costo de mano de obra, luego Permisos: Hacer administrador, las cuatro tarjetas de nivel, Personalizado y la cuadrícula de permisos." },
          { warning: "Si la invitación se creó pero el correo no pudo salir, el formulario se queda abierto y lo dice, en lugar de volver a la lista. Nada llegó a la persona. Cancele la invitación pendiente en Gestionar equipo y vuelva a enviarla cuando el correo funcione." },
        ],
      },
      {
        id: "what-they-receive",
        heading: "Qué recibe la persona",
        blocks: [
          { p: "Un correo de FieldQuo con el asunto «You're invited to join su empresa on FieldQuo», en el idioma que usted eligió, con un enlace. El enlace abre **Unirte a su empresa**, que indica con qué nivel fue invitada. Una persona nueva escribe su nombre y crea una contraseña; alguien que ya tiene una cuenta de FieldQuo en otra empresa inicia sesión con su contraseña existente y se agrega a la suya." },
          { p: "El enlace es válido **7 días** — la fila pendiente en Gestionar equipo dice «Vence en N días», luego «Vencida» — y un control **Reenviar** junto a **Cancelar** renueva el enlace y vuelve a enviar el correo. Después abre en «Esta invitación ha caducado» con una nota para pedirle una nueva — cancele la invitación anterior y envíe otra. Un enlace que usted canceló abre en «Esta invitación no se puede usar». No hay botón de reenviar; una invitación nueva es el reenvío." },
        ],
      },
      {
        id: "pending-invitations",
        heading: "Invitaciones pendientes",
        blocks: [
          { bullets: [
            "Una invitación pendiente muestra el nivel que usted eligió junto a la insignia **Invitado**, para que una invitación Administrator nunca se confunda con una Crew antes de aceptarse.",
            "Cuenta en su plan desde el momento en que se envía — una licencia para cualquier nivel por encima de Crew, una plaza de cuadrilla para Crew.",
            "**Cancelar invitación** pregunta «¿Cancelar esta invitación?» y luego deja sin efecto el enlace y libera la plaza. Como dice el diálogo, conserva la ficha de trabajador que ya tenga en sus registros; quítela desde Trabajadores si hace falta.",
            "El nivel de una invitación pendiente no se puede editar. Para cambiarlo, cancele e invite de nuevo.",
          ] },
        ],
      },
      {
        id: "who-can-invite",
        heading: "Quién puede invitar, y qué puede otorgar",
        blocks: [
          { p: "Los propietarios, los administradores, los Dispatchers y los Managers pueden invitar. Cada uno solo puede otorgar un acceso inferior al suyo: el propietario puede dar cualquier nivel, Administrator incluido; un administrador cualquier nivel salvo Administrator; un Dispatcher o un Manager solo **Crew** o **Estimator**, con cada ajuste limitado al suyo y sin ningún interruptor que no tenga él mismo. El formulario ofrece solo lo que será aceptado, y el servidor vuelve a comprobar la misma regla al crear la invitación." },
        ],
      },
    ],
    faq: [
      { q: "¿Puedo reenviar una invitación?", a: "Sí. Pulse **Reenviar** junto a la invitación pendiente en Gestionar equipo: un enlace vigente se renueva por otros 7 días y el correo vuelve a salir; uno vencido se reemplaza por un enlace nuevo. Una invitación aceptada o cancelada no se puede reenviar." },
      { q: "La persona ya usa FieldQuo en otra empresa. ¿Puede aceptar?", a: "Sí. La página de unión reconoce el correo, la persona inicia sesión con su contraseña existente y se agrega a su empresa con el nivel que usted eligió." },
      { q: "¿Por qué falta el campo Costo de mano de obra en mi formulario?", a: "Solo se muestra a un propietario o a un administrador. Un Manager o un Dispatcher que invita a alguien no puede fijar una tarifa; el campo se oculta en lugar de ignorarse en silencio." },
    ],
  },

  "access-levels-overview": {
    title: "Niveles de acceso: quién ve qué",
    summary:
      "Los cinco niveles de acceso — Crew, Estimator, Dispatcher, Manager, Administrator — de qué está hecho cada uno, qué ve cada uno en el menú y quién tiene permiso para cambiarlos.",
    updated: "2026-09-12",
    intro: [
      "Cada persona de su equipo tiene un nivel de acceso, elegido al invitarla y modificable después desde **Gestionar equipo**. Cuatro de los niveles son preajustes — una cuadrícula rellena de once áreas y tres interruptores — **Administrator** es todo, y **Personalizado** es cualquier cuadrícula que usted configure.",
      "La regla que hace esto seguro: ocultar una fila del menú no es la seguridad. Cada solicitud que hace la aplicación se vuelve a comprobar en el servidor contra la misma cuadrícula, así que una persona que escribe la dirección de una página que no se le mostró recibe un rechazo, no la página.",
    ],
    sections: [
      {
        id: "overview",
        heading: "Los cinco niveles",
        blocks: [
          { table: {
            head: ["Nivel", "Para quién es", "Ocupa una licencia"],
            rows: [
              ["[[role-crew|Crew]]", "Instaladores y ayudantes: su propio horario, los trabajos en los que están, sus horas. Sin dinero, sin documentos.", "No — sin costo"],
              ["[[role-estimator|Estimator]]", "Escribe presupuestos y gestiona clientes, con precios. No dirige personas.", "Sí"],
              ["[[role-dispatcher|Dispatcher]]", "El jefe de equipo: el horario y las horas de todos, crea y edita documentos, no borra nada.", "Sí"],
              ["[[role-manager|Manager]]", "Lleva el día a día, borrado incluido, costeo de trabajos y pagos activados. Ni la nómina ni la facturación de la empresa.", "Sí"],
              ["[[administrators|Administrator]]", "Todo lo que tiene el propietario salvo la propiedad misma. Solo el propietario puede otorgarlo.", "Sí"],
            ],
          } },
        ],
      },
      {
        id: "levels-and-tiers",
        heading: "Niveles de acceso y niveles de permisos",
        blocks: [
          { p: "Cada tarjeta de nivel lleva una pequeña etiqueta — **Nivel Worker** en Crew y Estimator, **Nivel Manager** en Dispatcher y Manager. Ese nivel de permisos es la agrupación más gruesa que usan algunas reglas (quién puede invitar, quién puede ver la facturación); el nivel de acceso es lo que la persona obtiene de verdad. Como dice la pantalla, dos niveles de acceso pueden compartir un nivel de permisos, así que este por sí solo no dice qué acceso tiene alguien. La insignia en Gestionar equipo nombra el nivel de acceso; al pasar el cursor se nombra el de permisos." },
        ],
      },
      {
        id: "what-a-level-is-made-of",
        heading: "De qué está hecho un nivel",
        blocks: [
          { p: "Once áreas, cada una una escalera de menos a más acceso — **Schedule**, **Time Tracking & Timesheets**, **Payroll & Payslips**, **Notes**, **Expenses**, **Clients and Properties**, **Requests**, **Quotes**, **Jobs**, **Invoices**, **Safety Incidents** — y tres interruptores de encendido/apagado: **Show Pricing**, **Job Costing**, **Payments**. Un preajuste es un ajuste en cada escalera. Toque un solo ajuste y la persona pasa a **Personalizado**; vea [[the-custom-access-editor|El editor de acceso personalizado]] para cada peldaño." },
        ],
      },
      {
        id: "what-each-level-sees",
        heading: "Qué ve cada nivel en el menú",
        blocks: [
          { table: {
            head: ["Pantalla", "Crew", "Estimator", "Dispatcher", "Manager"],
            rows: [
              ["Prospectos, Cotizaciones, Facturas, Planes de servicio", "No", "Sí", "Sí", "Sí"],
              ["Trabajos", "Solo los suyos", "Sí", "Sí", "Sí"],
              ["Clientes, Equipos del cliente, Recepcionista, Análisis", "No", "Sí", "Sí", "Sí"],
              ["Revisiones de presupuesto, Tu equipo, Calendario del equipo, Hojas de tiempo, Subcontratistas, Vehículos, Marketing, Diseñador, Embudos", "No", "No", "Sí", "Sí"],
              ["KPI, Gastos, Compras", "No", "No", "No", "Sí"],
              ["Plan, Recomienda y gana, Cuenta y facturación, Pagos, Nómina (configuración), Registro de actividad, Políticas de ausencias, Notificaciones", "No", "No", "No", "No"],
              ["Calendario, Tareas, Chat, Reloj de tiempo, Ausencias, Seguridad, Nómina (sus propios recibos de pago), Ayuda", "Sí", "Sí", "Sí", "Sí"],
            ],
          } },
          { p: "La última fila de «No» es solo para el propietario y los administradores. Los administradores y el propietario ven todas las filas. Las filas de Configuración siguen el mismo patrón: **Idioma**, **Disponibilidad** y **Novedades del producto** para todos; la lista de precios solo con Show Pricing; **Gastos generales** y **Costos de materiales** solo con Job Costing; **Control de gastos** solo para quien puede ver los gastos de todos." },
        ],
      },
      {
        id: "who-can-change-access",
        heading: "Quién puede cambiar el acceso",
        blocks: [
          { bullets: [
            "Solo un propietario o un administrador cambia el nivel de una persona existente, hace a alguien administrador o desactiva a alguien. Un Dispatcher o un Manager puede invitar y programar personas, pero no tocar el acceso establecido de un colega.",
            "Cada uno otorga solo lo que está por debajo de él: el propietario cualquier nivel; un administrador Manager y por debajo; un Dispatcher o un Manager Crew o Estimator al invitar, con cada ajuste limitado al suyo.",
            "Nadie cambia su propio acceso, y nadie cambia el nivel de un propietario — no existe control para ninguna de las dos cosas.",
            "El último propietario no se puede degradar ni desactivar, y el último propietario o administrador activo no se puede desactivar. Alguien siempre tiene que poder gestionar la cuenta.",
          ] },
        ],
      },
    ],
    faq: [
      { q: "¿Qué es Personalizado?", a: "Cualquier cuadrícula que no coincida exactamente con un preajuste. Elegir un preajuste reemplaza toda la cuadrícula; mover un ajuste después convierte a la persona en Personalizado. Crew es la excepción — sus ajustes son fijos y no se mueven." },
      { q: "Si una fila está oculta, ¿la persona puede llegar a los datos de otra forma?", a: "No. La fila está oculta porque la página detrás la rechazaría; la misma cuadrícula se comprueba en el servidor en cada solicitud." },
      { q: "¿Puedo darle a alguien todo salvo el dinero?", a: "Manager es ese nivel: presupuestos, trabajos, clientes, horarios y gastos, borrado incluido, pero no la nómina ni el plan, la tarjeta o la suscripción de la empresa." },
    ],
  },

  "role-crew": {
    title: "El nivel Crew",
    summary:
      "Qué puede ver y hacer un acceso Crew — su propio horario, los trabajos que se le asignan, sus horas — qué no ve nunca, y por qué es gratuito.",
    updated: "2026-09-12",
    intro: [
      "**Crew** es el nivel de la gente de la camioneta: instaladores, pintores, ayudantes. Es el único nivel gratuito — un acceso Crew nunca ocupa una licencia — y el único cuyos ajustes son fijos, de modo que nada se le puede agregar por accidente.",
      "La descripción del propio producto en la tarjeta del nivel, mostrada en inglés: ver su horario, los trabajos que se le asignan y qué comprar para ellos; marcar el trabajo como completado y registrar su tiempo; sin precios, presupuestos, facturas ni solicitudes.",
    ],
    sections: [
      {
        id: "overview",
        heading: "Resumen",
        blocks: [
          { p: "Crew pertenece al **nivel Worker**. Cuando lo elige, el editor no muestra ningún ajuste y dice en su lugar: «El acceso de la cuadrilla es fijo: su propio horario, los trabajos que se le asignan, qué comprar para esos trabajos y sus propias horas. Sin precios, presupuestos, facturas ni solicitudes. La cuadrilla no ocupa un puesto: para dar más que esto, elige otro nivel.» Esa frase es todo el contrato." },
        ],
      },
      {
        id: "what-they-can-do",
        heading: "Qué puede hacer un miembro de la cuadrilla",
        blocks: [
          { bullets: [
            "Ver su propio horario y marcarlo como completado (**Schedule**: View and complete their own schedule).",
            "Fichar entrada y salida y corregir sus propias horas (**Time Tracking & Timesheets**: View, record, and edit their own). Una entrada que edita él mismo vuelve a pendiente, para que un supervisor la revise antes de que llegue a una nómina.",
            "Abrir los trabajos que se le asignan — y solo esos — en solo lectura: la dirección, la visita, la lista de verificación y qué comprar (**Jobs**: View only, limitado a los suyos).",
            "Registrar sus propios gastos (**Expenses**: View, record, and edit their own).",
            "Ver sus propios recibos de pago (**Payroll & Payslips**: View their own payslips).",
            "Reportar un incidente de seguridad y ver los que él presentó (**Safety Incidents**: Report incidents, and view their own).",
            "Leer el nombre y la dirección del cliente en sus trabajos, nada más (**Clients and Properties**: View client name and address only), y solo las notas de trabajos y visitas.",
          ] },
        ],
      },
      {
        id: "what-they-never-see",
        heading: "Qué no ve nunca",
        blocks: [
          { bullets: [
            "Ningún precio en ninguna parte — **Show Pricing** está apagado, así que el dinero se quita de todo lo que puede leer.",
            "Sin **Prospectos**, **Cotizaciones**, **Facturas** ni **Planes de servicio**: las cuatro áreas están en No access, y las filas desaparecen de su menú.",
            "Sin lista de clientes: la fila **Clientes** está oculta. La dirección en su trabajo no es una licencia para hojear su cartera de clientes.",
            "Sin **Job Costing**, sin **Payments**, sin las horas, el horario o los gastos de nadie más, sin **Tu equipo**.",
          ] },
        ],
      },
      {
        id: "their-menu",
        heading: "Qué muestra su menú",
        blocks: [
          { p: "**Inicio**, **Trabajos** (los suyos), **Calendario**, **Tareas**, **Chat**, **Reloj de tiempo**, **Ausencias**, **Seguridad**, **Nómina** (sus propios recibos de pago) y **Ayuda**. Bajo Configuración: **Idioma**, **Disponibilidad** y **Novedades del producto**. En un teléfono, las mismas pantallas están en la barra de pestañas de la cuadrilla — vea [[what-a-crew-member-sees|Qué ve un miembro de la cuadrilla]] y [[how-fieldquo-works-for-crew|Cómo funciona FieldQuo para la cuadrilla]]." },
        ],
      },
      {
        id: "free",
        heading: "Por qué es gratuito",
        blocks: [
          { p: "Una licencia se lee en la cuadrícula: quien puede generar dinero — crear o cambiar presupuestos, trabajos, facturas o prospectos — es una licencia. Un Crew no puede, así que un acceso Crew es una plaza de cuadrilla, incluida con cada plan, y también puede ocupar una licencia sin usar. El panel de licencias en Gestionar equipo muestra ambos contadores. El detalle: [[seats-and-crew-logins|Licencias y accesos de cuadrilla]]." },
        ],
      },
    ],
    faq: [
      { q: "¿Puedo darle una cosa más a un miembro de la cuadrilla?", a: "No en Crew — sus ajustes son fijos. Use Personalizado y mueva el ajuste que necesite, o elija Estimator. En ambos casos el acceso pasa a ser una licencia: cualquier ajuste por encima del de Crew, o cualquier interruptor encendido, es una licencia." },
      { q: "¿Puede un miembro de la cuadrilla ver el teléfono del cliente?", a: "No. Solo el nombre y la dirección, y solo en los trabajos que se le asignan." },
      { q: "Un miembro de la cuadrilla dice que su lista de Trabajos está vacía.", a: "Solo ve los trabajos con una visita en la que está asignado. Asígnelo a la visita del trabajo y aparecerá." },
    ],
  },

  "role-estimator": {
    title: "El nivel Estimator",
    summary:
      "El nivel para alguien que cotiza y envía presupuestos y gestiona clientes, con los precios visibles — pero que no dirige personas, nómina ni costeo de trabajos.",
    updated: "2026-09-12",
    intro: [
      "**Estimator** es el vendedor o el segundo estimador: alguien que debe poder escribir un presupuesto, agregar al cliente, ver a qué precio se cotizó y enviarlo — sin dirigir el taller.",
      "La descripción del propio producto en la tarjeta del nivel, mostrada en inglés: escribe presupuestos y gestiona clientes, con precios; no gestiona personas, nómina ni costeo de trabajos.",
    ],
    sections: [
      {
        id: "overview",
        heading: "Resumen",
        blocks: [
          { p: "Estimator pertenece al **nivel Worker**, el mismo que Crew, y ocupa una licencia. Los dos ajustes que lo convierten en licencia son **Requests** y **Quotes** en View, create, and edit — un prospecto que se convierte en presupuesto es el mismo acto una pantalla antes. **Show Pricing** está encendido, porque no se puede escribir un presupuesto sin precios." },
        ],
      },
      {
        id: "what-they-can-do",
        heading: "Qué puede hacer un Estimator",
        blocks: [
          { bullets: [
            "Crear y editar prospectos y presupuestos, con precios (**Requests** y **Quotes**: View, create, and edit).",
            "Agregar y editar clientes y sus propiedades (**Clients and Properties**: View and edit full client and property info) — no se puede cotizar a alguien que no se puede agregar.",
            "Leer todos los trabajos y todas las facturas, sin editarlos (**Jobs** e **Invoices**: View only).",
            "Leer todas las notas (**Notes**: View all notes).",
            "Solo su propio horario, sus horas, sus gastos y sus recibos de pago; reportar un incidente de seguridad y ver los suyos.",
          ] },
        ],
      },
      {
        id: "what-they-cannot-do",
        heading: "Qué no puede hacer",
        blocks: [
          { bullets: [
            "Convertir un presupuesto en trabajo, aprobar una estimación instantánea en **Revisiones de presupuesto**, o asignar un presupuesto, un trabajo o una cita a otra persona — eso empieza en Dispatcher.",
            "Borrar nada, ni editar un trabajo o una factura una vez que existen — un estimador que pudiera editar la factura podría mover en silencio un precio ya acordado.",
            "Ver costos o margen: **Job Costing** está apagado, así que sin KPI, sin Gastos generales, sin Costos de materiales.",
            "Cobrar pagos (**Payments** está apagado), ejecutar la nómina o ver la de otros, invitar personas, o abrir **Tu equipo**.",
          ] },
        ],
      },
      {
        id: "their-menu",
        heading: "Qué muestra su menú",
        blocks: [
          { p: "**Prospectos**, **Cotizaciones**, **Trabajos**, **Facturas**, **Planes de servicio**, **Calendario**, **Tareas**, **Clientes**, **Equipos del cliente**, **Chat**, **Reloj de tiempo**, **Ausencias**, **Seguridad**, **Nómina** (sus propios recibos de pago), **Análisis**, **Recepcionista** y **Ayuda**. Bajo Configuración, además de Idioma, Disponibilidad y Novedades del producto: **Productos y servicios**, **Servicios y precios** y **Cotizaciones instantáneas**, porque Show Pricing está encendido. Ocultos: Revisiones de presupuesto, Tu equipo, Calendario del equipo, Hojas de tiempo, Gastos, Compras, Vehículos, Subcontratistas, KPI, Marketing, Plan." },
        ],
      },
    ],
    faq: [
      { q: "¿Puede un Estimator ver la lista de tarifas?", a: "Sí — Show Pricing está encendido, y Servicios y precios y Productos y servicios están en su Configuración. Por eso este nivel es una licencia y no un acceso gratuito." },
      { q: "¿Por qué mi estimador no puede aprobar una estimación instantánea?", a: "Aprobar un precio que un cliente ya vio es una firma de supervisor en FieldQuo: Dispatcher, Manager, un administrador o el propietario. Páselo a Dispatcher si ese es su trabajo." },
    ],
  },

  "role-dispatcher": {
    title: "El nivel Dispatcher",
    summary:
      "El nivel del jefe de equipo: el horario y las horas de todos, documentos que se crean y editan pero nunca se borran, invitaciones para la cuadrilla — sin costos, margen ni cobro de pagos.",
    updated: "2026-09-12",
    intro: [
      "**Dispatcher** lleva la semana. El horario de todos y el tiempo de todos son editables; presupuestos, trabajos, facturas y prospectos se pueden crear y editar — pero no borrar. Es el nivel del jefe de equipo que reserva a la cuadrilla, mueve visitas y mantiene la semana en orden, sin el poder de eliminar nada.",
      "La descripción del propio producto en la tarjeta del nivel, mostrada en inglés: edita los datos de trabajos, equipo y clientes; recomendado para jefes de equipo.",
    ],
    sections: [
      {
        id: "overview",
        heading: "Resumen",
        blocks: [
          { p: "Dispatcher pertenece al **nivel Manager**, compartido con Manager — por eso los dos se parecen en algunos sitios, y por eso la insignia en Gestionar equipo nombra el nivel de acceso y no el de permisos. Ese nivel de permisos es lo que permite a un Dispatcher invitar personas, aprobar horas y ausencias, publicar turnos y editar la página de reservas. Ocupa una licencia." },
        ],
      },
      {
        id: "what-they-can-do",
        heading: "Qué puede hacer un Dispatcher",
        blocks: [
          { bullets: [
            "Editar el horario de todos (**Schedule**: Edit everyone's schedule) y preparar y publicar la semana de la cuadrilla en **Asignar turnos**.",
            "Ver, registrar, editar y borrar las horas de todos (**Time Tracking & Timesheets**) y aprobarlas en **Hojas de tiempo** antes de que lleguen a una nómina.",
            "Crear y editar prospectos, presupuestos, trabajos y facturas (los cuatro en View, create, and edit), convertir un presupuesto en trabajo, aprobar estimaciones instantáneas en **Revisiones de presupuesto** y asignar trabajo a las personas.",
            "Fichas completas de clientes (**Clients and Properties**: View and edit full client and property info); ver y editar todas las notas; ver los incidentes de seguridad de todos y darles seguimiento.",
            "Invitar personas — solo **Crew** o **Estimator** — aprobar ausencias, y abrir **Tu equipo**, **Calendario del equipo**, **Subcontratistas**, **Vehículos**, **Marketing**, **Diseñador** y **Embudos**.",
          ] },
        ],
      },
      {
        id: "what-they-cannot-do",
        heading: "Qué no puede hacer",
        blocks: [
          { bullets: [
            "Borrar un presupuesto, un trabajo, una factura, un prospecto o un cliente — cada ajuste de documento se detiene un peldaño antes del borrado.",
            "Ver costos o margen: **Job Costing** está apagado, así que sin KPI, Gastos generales ni Costos de materiales, y la pantalla Vehículos muestra la camioneta sin lo que costó.",
            "Ver los gastos de nadie más (**Expenses**: los suyos), así que sin el resumen de Gastos y sin Compras.",
            "Cobrar pagos (**Payments** está apagado), ver los recibos de pago de otros o ejecutar la nómina, o abrir la facturación de la empresa.",
            "Cambiar el nivel de una persona existente, hacer a alguien administrador o desactivar a nadie — en Gestionar equipo, las listas son insignias para un Dispatcher.",
          ] },
        ],
      },
      {
        id: "settings-they-see",
        heading: "Las filas de Configuración que ve",
        blocks: [
          { p: "Todo lo que corresponde a dirigir una cuadrilla: **Configuración de la empresa**, **Marca**, **Gestionar equipo**, **Página de reservas**, **Zonas de trabajo**, **Campos personalizados**, **Plantillas de correo**, **Plantillas PDF**, **Correo de presupuesto**, **Seguimientos**, **Traducciones**, **Mensajes de clientes**, **Listas de verificación**, **Etiquetas de fotos de trabajo**, **Dominio de correo**, **Tu sitio web**, **Recepcionista telefónico**, **Crédito de IA**, **Empleado de IA**, **Comparte tus enlaces**, **Enlace para la bio**, **Reseñas**, más la lista de precios. Ocultos: **Cuenta y facturación**, **Pagos**, **Nómina**, **Registro de actividad**, **Políticas de ausencias**, **Notificaciones**, **Meta Ads**, **Recomienda y gana**, **Migración de datos**, **Gastos generales**, **Costos de materiales**, **Control de gastos**." },
        ],
      },
    ],
    faq: [
      { q: "Mi despachador necesita borrar un trabajo cancelado. ¿Qué hago?", a: "El borrado es lo que separa a Manager de Dispatcher. Páselo a Manager, o abra Personalizado… y suba solo el ajuste Jobs a View, create, edit, and delete." },
      { q: "¿Puede un Dispatcher hacer a alguien Manager?", a: "No. Un Dispatcher solo puede invitar Crew o Estimator, y no puede cambiar a nadie que ya esté en la lista. Solo un propietario o un administrador cambia el nivel de las personas." },
    ],
  },

  "role-manager": {
    title: "El nivel Manager",
    summary:
      "El nivel que lleva el día a día — presupuestos, trabajos, clientes, horarios y gastos, borrado incluido, con el costeo de trabajos y los pagos activados — pero ni la nómina ni la facturación de la empresa.",
    updated: "2026-09-12",
    intro: [
      "**Manager** es el encargado de oficina o el socio que dirige las operaciones. Si la pregunta es «¿puedo darle a alguien todo salvo el dinero?», esta es la respuesta: todo lo que tiene Dispatcher, más el borrado, más los gastos de todos, más el costeo de trabajos y el cobro de pagos.",
      "La descripción del propio producto en la tarjeta del nivel, mostrada en inglés: lleva el día a día — presupuestos, trabajos, clientes, horarios y gastos; ni la nómina ni la facturación de la empresa; recomendado para la dirección.",
    ],
    sections: [
      {
        id: "overview",
        heading: "Resumen",
        blocks: [
          { p: "Manager pertenece al **nivel Manager** junto con Dispatcher, así que los dos comparten los mismos límites sobre el personal: invitar solo Crew o Estimator, nunca cambiar el nivel de nadie ni desactivarlo. Lo que Manager agrega está en la cuadrícula — cada ajuste de documento en su peldaño más alto, y los tres interruptores encendidos. Ocupa una licencia." },
        ],
      },
      {
        id: "what-they-can-do",
        heading: "Qué puede hacer un Manager",
        blocks: [
          { bullets: [
            "Crear, editar y borrar prospectos, presupuestos, trabajos y facturas, y clientes (**Clients and Properties**: View, edit, and delete full client and property info).",
            "Editar y borrar el horario de todos; ver, registrar, editar y borrar las horas de todos y aprobarlas; ver, editar y borrar todas las notas.",
            "Ver, registrar y editar los gastos de todos (**Expenses**: View, record, and edit everyone's) — lo que abre **Gastos**, **Compras** y **Control de gastos**.",
            "**Job Costing** encendido: el costo por trabajo, los márgenes, los **KPI**, y la base de costos en **Gastos generales** y **Costos de materiales**.",
            "**Payments** encendido: cobrar pagos en presupuestos y facturas.",
            "Todo lo que puede un Dispatcher: invitar Crew o Estimator, publicar turnos, aprobar ausencias y horas, aprobar estimaciones instantáneas, y cada fila de Configuración que corresponde a dirigir una cuadrilla.",
          ] },
        ],
      },
      {
        id: "what-they-cannot-do",
        heading: "Qué no puede hacer",
        blocks: [
          { bullets: [
            "La nómina: el preajuste dice **View their own payslips**, así que un Manager ve sus propios recibos de pago y nada de la paga de los demás, y no puede ejecutar una nómina. Un propietario que quiera que un encargado ejecute la nómina lo otorga a propósito, en Personalizado, con **View everyone's and run payroll**.",
            "La facturación de la empresa: **Plan**, **Cuenta y facturación**, **Pagos** (la conexión con Stripe), **Meta Ads**, **Recomienda y gana** y **Migración de datos** quedan con el propietario y los administradores.",
            "**Registro de actividad**, **Políticas de ausencias** y **Notificaciones** — solo propietario y administrador.",
            "Cambiar el nivel de una persona existente, hacer a alguien administrador o desactivar a nadie.",
          ] },
        ],
      },
      {
        id: "manager-or-administrator",
        heading: "¿Manager o Administrator?",
        blocks: [
          { p: "Manager es el nivel para el personal. **Administrator** es otra cosa: todo lo que tiene el propietario, facturación y paga de todos incluidas, sin cuadrícula que consultar — pensado para un socio o un contador. Si alguien necesita ver el plan y la tarjeta, es un administrador; si necesita llevar el taller, es un Manager. Vea [[administrators|Administradores]]." },
        ],
      },
    ],
    faq: [
      { q: "¿Puede mi Manager ejecutar la nómina?", a: "No con el preajuste. Abra Personalizado… para esa persona y ponga Payroll & Payslips en View everyone's and run payroll. Sigue siendo Manager en todo lo demás." },
      { q: "¿Por qué mi Manager no ve la cuenta regresiva de la prueba ni el plan?", a: "La facturación es solo para el propietario y los administradores. Las filas Plan y Cuenta y facturación están ocultas para un Manager, y la cuenta regresiva de la prueba en la barra lateral se muestra solo al propietario." },
    ],
  },

  "administrators": {
    title: "Administradores",
    summary:
      "Qué otorga Hacer administrador — todo lo que tiene el propietario salvo la propiedad — quién puede otorgarlo, qué sigue sin poder hacer un administrador, y las reglas del último propietario que protegen la cuenta.",
    updated: "2026-09-12",
    intro: [
      "Un **administrador** tiene todo lo que tiene el propietario, sin cuadrícula de permisos que consultar: la facturación, la nómina, el registro de actividad, cada ajuste, cada documento, y el poder de cambiar el acceso de cualquier otra persona. Existe para un socio o un contador que debe ver el plan y la tarjeta. No es un nivel para el personal — eso es Manager.",
      "La casilla del formulario lo dice claro: «Esto le da acceso a todo dentro de la cuenta — incluyendo facturación, informes, edición de la lista de clientes y todos los permisos de usuario.»",
    ],
    sections: [
      {
        id: "overview",
        heading: "Resumen",
        blocks: [
          { p: "En **Nuevo usuario** y en el editor de acceso, **Hacer administrador** es una casilla encima de las tarjetas de nivel. Márquela y las tarjetas y la cuadrícula desaparecen — el nivel de permisos es toda la respuesta, no hay nada que ajustar. En Gestionar equipo un administrador aparece como **Administrator** en la columna Rol, y el panel de licencias lo cuenta bajo **Administradores**. Un administrador siempre ocupa una licencia." },
        ],
      },
      {
        id: "make-an-administrator",
        heading: "Cómo hacer a alguien administrador",
        blocks: [
          { steps: [
            "Abra **Gestionar equipo**. Debe ser el propietario: **Hacer administrador** se ofrece solo a quien puede otorgar el nivel Administrator, y ese es únicamente el propietario.",
            "En la lista **Rol** de la persona elija **Administrator** — o elija **Personalizado…**, marque **Hacer administrador** y pulse **Guardar**.",
            "Para quitarlo, elija cualquier otro nivel en la misma lista. Su cuadrícula se reemplaza por la de ese nivel; conserva su inicio de sesión.",
          ] },
          { note: "Al invitar, la misma casilla está bajo **Permisos** en Nuevo usuario. Una invitación Administrator pendiente muestra su nivel junto a la insignia **Invitado**, para poder cancelarla antes de que se acepte." },
        ],
      },
      {
        id: "what-they-get",
        heading: "Qué obtiene un administrador",
        blocks: [
          { bullets: [
            "Todas las filas del menú y todas las filas de Configuración, incluidas **Cuenta y facturación**, **Pagos**, **Meta Ads**, **Recomienda y gana**, **Migración de datos**, **Registro de actividad**, **Políticas de ausencias** y **Notificaciones**.",
            "Facturación: cambiar el plan, la tarjeta y la suscripción. Nómina: ejecutar nóminas y editar deducciones y componentes del recibo de pago.",
            "Equipo: invitar a cualquiera por debajo de él (Crew, Estimator, Dispatcher, Manager), cambiar el nivel de esas personas, y activarlas o desactivarlas.",
            "La cuadrícula de permisos no se le aplica — cada ajuste se lee en su peldaño más alto y cada interruptor como encendido.",
          ] },
        ],
      },
      {
        id: "what-stays-with-the-owner",
        heading: "Qué queda con el propietario",
        blocks: [
          { bullets: [
            "La propiedad misma. El propietario es la cuenta que registró la empresa; FieldQuo no tiene ningún control para transferirla, y nadie — administradores incluidos — puede cambiar el nivel de un propietario ni desactivarlo desde la lista.",
            "Hacer a otro administrador. Cada uno solo puede otorgar un acceso estrictamente inferior al suyo, así que un administrador puede otorgar Manager y por debajo, nunca Administrator.",
            "Editar a otro administrador: mismo rango, sin lista.",
            "La cuenta regresiva de la prueba en la barra lateral se muestra solo al propietario, aunque un administrador puede abrir Cuenta y facturación y actuar.",
          ] },
          { warning: "El último propietario o administrador activo no se puede desactivar, y el último propietario no se puede degradar. La pantalla rechaza con «That's the last active owner or admin. Someone has to be able to manage the account — promote or reactivate somebody first.»" },
        ],
      },
    ],
    faq: [
      { q: "¿Mi encargado de oficina debería ser administrador?", a: "Normalmente no. Manager le da todo el día a día sin su facturación ni la paga de todos. Reserve Administrator para un socio o un contador." },
      { q: "Soy administrador y no puedo hacer administrador a mi colega. ¿Por qué?", a: "Solo el propietario puede. Un administrador otorga Manager y por debajo." },
      { q: "¿Puede un administrador dejar fuera al propietario?", a: "No. La fila del propietario es de solo lectura para todos, y el último propietario nunca se puede desactivar." },
    ],
  },

  "the-custom-access-editor": {
    title: "El editor de acceso personalizado",
    summary:
      "La cuadrícula detrás de cada nivel — once áreas, tres interruptores — cómo abrirla para una persona nueva o existente, qué hace cada ajuste, y qué tiene usted permiso para otorgar.",
    updated: "2026-09-12",
    intro: [
      "Todos los niveles salvo Administrator son una cuadrícula: once áreas, cada una una escalera de menos a más acceso, y tres interruptores de encendido/apagado. Los cuatro preajustes son cuadrículas rellenas. **Personalizado** es la misma cuadrícula con sus propios ajustes.",
      "El mismo editor se usa en **Nuevo usuario** y, para alguien que ya está en el equipo, desde la entrada **Personalizado…** de su lista Rol en **Gestionar equipo** — así que lo que puede configurar al invitar también lo puede cambiar después.",
    ],
    sections: [
      {
        id: "overview",
        heading: "Resumen",
        blocks: [
          { p: "El editor se abre como **Acceso de …** con una línea de instrucción: «Elija un punto de partida y luego cambie lo que quiera. Conservan el mismo inicio de sesión.» De arriba abajo: **Hacer administrador** (solo propietario), las cuatro tarjetas de nivel con su etiqueta de nivel de permisos, la tarjeta **Personalizado**, las once listas desplegables y las tres casillas. **Cancelar** cierra sin guardar; **Guardar** aplica la cuadrícula de inmediato." },
          { figure: "harness:access-editor", caption: "Gestionar equipo — el editor de acceso personalizado abierto sobre un Estimator: Hacer administrador, las cuatro tarjetas de nivel con su etiqueta, Personalizado, y los primeros ajustes." },
        ],
      },
      {
        id: "open-the-editor",
        heading: "Cómo abrirlo",
        blocks: [
          { steps: [
            "Para alguien del equipo: **Gestionar equipo** → su lista **Rol** → **Personalizado…**. El panel se abre mostrando el nivel que tiene ahora, o Personalizado si su cuadrícula no coincide con ninguno.",
            "Para alguien nuevo: **Agregar usuario** → bajo **Permisos**, pulse la tarjeta **Personalizado** («Configura cada permiso a continuación individualmente.»).",
            "Pulse una tarjeta de nivel para cargar su cuadrícula y luego mueva cualquier ajuste. En cuanto toca un ajuste, la tarjeta deja de estar resaltada: la persona ahora es Personalizado.",
            "Pulse **Guardar**. Una cuadrícula personalizada por encima de Crew en cualquier ajuste ocupa una licencia, y el guardado se rechaza si su plan no tiene ninguna libre.",
          ] },
        ],
      },
      {
        id: "the-eleven-areas",
        heading: "Las once áreas",
        blocks: [
          { table: {
            head: ["Área","Peldaño 1 (el más bajo)","Peldaño 2","Peldaño 3","Peldaño 4","Peldaño 5"],
            rows: [
              ["Schedule","View their own schedule","View and complete their own schedule","Edit their own schedule","Edit everyone's schedule","Edit and delete everyone's schedule"],
              ["Time Tracking & Timesheets","View and record their own","View, record, and edit their own","View, record, edit, and delete everyone's","—","—"],
              ["Payroll & Payslips","No access","View their own payslips","View everyone's payslips","View everyone's and run payroll","—"],
              ["Notes","View notes on jobs and visits only","View all notes","View and edit all","View, edit, and delete all","—"],
              ["Expenses","View, record, and edit their own","View, record, and edit everyone's","—","—","—"],
              ["Clients and Properties","View client name and address only","View full client and property info","View and edit full client and property info","View, edit, and delete full client and property info","—"],
              ["Requests","No access","View only","View, create, and edit","View, create, edit, and delete","—"],
              ["Quotes","No access","View only","View, create, and edit","View, create, edit, and delete","—"],
              ["Jobs","No access","View only","View, create, and edit","View, create, edit, and delete","—"],
              ["Invoices","No access","View only","View, create, and edit","View, create, edit, and delete","—"],
              ["Safety Incidents","No access","Report incidents, and view their own","View everyone's incidents","View everyone's incidents and follow up on them","—"],
            ],
          } },
          { p: "Un guion significa que la escalera termina ahí; la última celda llena es el peldaño más alto. **Requests** es la pantalla Prospectos. **Jobs** en No access retiene la ficha del trabajo, no el trabajo en sí: el horario, la lista de verificación de la visita y el reloj son áreas propias, así que un miembro de la cuadrilla sigue viendo su día. El peldaño más alto de Time Tracking es el que borra una entrada, y la escalera de la nómina empieza a propósito en «los suyos»: un empleado que ve la paga de otro es un incidente, no un ajuste." },
          { note: "El ajuste **Notes** controla las notas internas sobre personas — el registro de llamadas de un cliente potencial y las notas privadas de un cliente: leerlas en **View all notes**, escribirlas en **View and edit all notes**, borrar una nota de cliente potencial en **View, edit and delete all notes**. Por debajo, la persona ve «oculto por su nivel de acceso» en lugar de las notas. Las notas de una visita siguen siendo legibles en todos los niveles, y las notas de un presupuesto o de un gasto pertenecen a ese documento, no a este ajuste." },
        ],
      },
      {
        id: "the-three-switches",
        heading: "Los tres interruptores",
        blocks: [
          { bullets: [
            "**Show Pricing** — ver los precios en presupuestos, facturas y trabajos, y editarlos; sin él, el dinero se quita tanto de lo que la persona puede leer como de lo que puede escribir (la descripción está en inglés en la pantalla). Apagado, también oculta la lista de precios, Análisis y cada PDF con precios.",
            "**Job Costing** — mostrar la ganancia del trabajo siguiendo ingresos y costos a partir de las líneas, la mano de obra y los gastos. Requiere Show Pricing, control de tiempo, gastos y acceso a trabajos. También controla la base de costos: Gastos generales, Costos de materiales, KPI.",
            "**Payments** — permitir el cobro de pagos en presupuestos y facturas. Requiere Show Pricing, acceso de edición a Clients and Properties, y acceso de edición a Quotes y/o Invoices.",
          ] },
          { p: "Dos líneas informativas están bajo la cuadrícula en Nuevo usuario y no son ajustes: las comunicaciones con clientes y los informes se derivan de los demás permisos que tiene la persona." },
        ],
      },
      {
        id: "what-you-can-hand-out",
        heading: "Qué puede otorgar",
        blocks: [
          { p: "Un propietario o un administrador ve todos los peldaños y todos los interruptores. Un Dispatcher o un Manager ve cada escalera solo hasta su propio peldaño, y solo los interruptores que él mismo tiene — un nivel que usted no tiene no es suyo para delegarlo. El servidor aplica el mismo límite al guardar, así que una cuadrícula que llegó por otro camino se recorta a la misma línea. Cambiar la cuadrícula de una persona existente es solo para el propietario y los administradores; un Dispatcher o un Manager se encuentra con este editor únicamente en Nuevo usuario." },
          { note: "**Crew** no muestra ningún ajuste. Elegirlo bloquea la cuadrícula en el nivel gratuito; para darle a alguien más que Crew, parta de otra tarjeta o de Personalizado — y eso lo convierte en una licencia." },
        ],
      },
    ],
    faq: [
      { q: "¿Una cuadrícula personalizada ocupa una licencia?", a: "Sí, salvo que cada ajuste esté en el nivel de Crew o por debajo y ningún interruptor esté encendido. Un solo ajuste por encima del de Crew convierte el acceso en una licencia, diga lo que diga el resto." },
      { q: "Elegí un preajuste y la insignia dice Personalizado.", a: "Se movió un ajuste después de cargar el preajuste — usted, o alguien antes. Vuelva a elegir el preajuste en la lista Rol para reemplazar toda la cuadrícula." },
      { q: "El ajuste que elegí volvió más bajo.", a: "No puede otorgar más de lo que tiene. El servidor recortó la cuadrícula a su propio peldaño en esa área; pida a un propietario o a un administrador que lo configure." },
    ],
  },

  "seats-and-crew-logins": {
    title: "Licencias y accesos de cuadrilla",
    summary:
      "Qué cuenta como una licencia, por qué un acceso Crew es gratuito, cómo el panel de licencias en Gestionar equipo cuenta a las personas contra su plan, y qué pasa cuando está lleno.",
    updated: "2026-09-12",
    intro: [
      "FieldQuo cobra por **licencias**, y una licencia se lee en el acceso de una persona — no en su cargo. Quien puede generar dinero es una licencia; quien no puede es un acceso de cuadrilla, y los accesos de cuadrilla se incluyen sin costo con cada plan.",
      "Por eso una empresa de pintura de doce personas con dos personas en la oficina es una empresa de dos licencias. El panel en la parte superior de **Gestionar equipo** muestra ambos números uno junto al otro.",
    ],
    sections: [
      {
        id: "overview",
        heading: "Resumen",
        blocks: [
          { p: "El panel de licencias dice, por ejemplo, **4 / 6 licencias usadas** y **3 / 11 de cuadrilla — incluidos sin costo**, con un desglose debajo (**1 Administradores · 1 Encargados · 1 Despachadores · 1 Trabajadores · 3 Cuadrilla**). Las licencias y la cuadrilla tienen topes separados y botones separados — **Agregar una licencia** y **Agregar cuadrilla — sin costo** — y cada uno se cierra por su cuenta: un tope de licencias lleno no le impide agregar cuadrilla, y viceversa." },
        ],
      },
      {
        id: "what-counts-as-a-seat",
        heading: "Qué cuenta como una licencia",
        blocks: [
          { bullets: [
            "El propietario y cada administrador, siempre.",
            "Cada Estimator, Dispatcher y Manager — cada uno tiene al menos un ajuste de documento en View, create, and edit.",
            "Cualquier cuadrícula personalizada que supere el nivel Crew en cualquier ajuste, o que tenga algún interruptor encendido. Lo gratuito se define por un techo — el preajuste Crew, ajuste por ajuste — y no por una lista corta de áreas, así que un solo ajuste subido es una licencia, llegue como llegue.",
            "Una invitación pendiente, desde el momento en que se envía, con el nivel que lleva.",
          ] },
          { p: "Una persona desactivada no cuenta en ninguna columna. Un acceso de cuadrilla es cualquiera que esté en ese techo o por debajo; el contador **Cuadrilla** del panel es exactamente esas personas." },
        ],
      },
      {
        id: "the-plans",
        heading: "Licencias y plazas de cuadrilla en cada plan",
        blocks: [
          { table: {
            head: ["Plan", "Licencias", "Accesos de cuadrilla incluidos sin costo", "Personas en total"],
            rows: [
              ["Solo", "1", "5", "6"],
              ["Crew", "3", "8", "11"],
              ["Shop", "6", "11", "17"],
              ["Scale", "10", "15", "25"],
            ],
          } },
          { p: "Un miembro de la cuadrilla puede ocupar una licencia sin usar, porque una licencia contiene estrictamente más acceso que una plaza de cuadrilla: la regla es licencias dentro del tope de licencias, y todos dentro de licencias más cuadrilla. Veinte técnicos y dos personas en la oficina caben en Scale. Los precios y la elección entre mensual y compromiso de un año están en [[the-four-plans|Los cuatro planes]]." },
        ],
      },
      {
        id: "when-you-are-full",
        heading: "Cuando está lleno",
        blocks: [
          { bullets: [
            "El botón del tipo lleno se atenúa — «Ya usaste todas las licencias de tu plan.» o «Ya usaste todas las plazas de cuadrilla de tu plan.» — y la frase de al lado nombra el siguiente plan que cabría: «Ya usaste todas tus licencias. Shop cubre 6 licencias y 11 de cuadrilla.» Un propietario o un administrador también recibe un enlace **Mejorar el plan** a Cuenta y facturación.",
            "Enviar una invitación o subir a alguien de nivel se rechaza en el servidor con los mismos números, aunque una segunda pestaña todavía mostrara espacio.",
            "Para liberar una licencia: desactive a alguien que se fue, cancele una invitación pendiente, o baje a una persona a **Crew**. El panel se actualiza en la siguiente carga.",
            "Más allá de Scale, la frase cambia a «Te quedaste grande para los planes que vendemos en línea — habla con nosotros.»",
          ] },
          { tip: "El formulario de invitación es la guía honesta: **Agregar cuadrilla — sin costo** lo abre en Crew, **Agregar una licencia** en Dispatcher, y la tarjeta de nivel en la que aterriza le dice qué tipo de plaza está a punto de usar. El detalle sobre la compra: [[add-a-seat-or-a-crew-login|Agregar una licencia, o un acceso de cuadrilla gratuito]] y [[your-plan-and-seats|Su plan y sus licencias]]." },
        ],
      },
    ],
    faq: [
      { q: "¿Un acceso de cuadrilla es gratuito de verdad?", a: "Sí. Cada plan incluye un número de plazas de cuadrilla sin cargo, y un acceso Crew también puede ocupar una licencia sin usar. El panel de licencias dice cuántas tiene de cada tipo." },
      { q: "¿Por qué agregar un ajuste a un miembro de la cuadrilla usó una licencia?", a: "Lo gratuito es un techo, no una categoría. Cualquier ajuste por encima del preajuste Crew — o cualquier interruptor encendido — es una licencia, porque eso es lo que permite a una persona crear o cambiar presupuestos, trabajos, facturas o prospectos." },
      { q: "¿Una invitación pendiente ocupa una licencia?", a: "Sí, con el nivel que lleva, desde el momento en que se envía. Cancélela para recuperar la plaza." },
    ],
  },

  "deactivate-a-team-member": {
    title: "Desactivar a un miembro del equipo",
    summary:
      "Cómo apagar el acceso de alguien con la casilla Activo, qué cambia y qué se conserva, quién puede hacerlo, y las reglas que impiden que una cuenta se bloquee a sí misma.",
    updated: "2026-09-12",
    intro: [
      "Cuando alguien se va, usted lo desactiva: desmarque **Activo** en su fila de **Gestionar equipo**. Su inicio de sesión deja de funcionar para su empresa, su licencia o plaza de cuadrilla se libera, y todo lo que hizo se conserva en los registros.",
      "Desactivar no es borrar. FieldQuo no tiene en esta pantalla ningún control que elimine a una persona, porque sus presupuestos, sus horas y su historial de pagos son registros de usted, no de ella.",
    ],
    sections: [
      {
        id: "overview",
        heading: "Resumen",
        blocks: [
          { p: "Cada fila de la lista termina en una casilla **Activo**. Marcada, la persona puede iniciar sesión; desmarcada, no puede. La casilla está activa solo para un propietario o un administrador y solo en las filas de rango inferior al suyo; de lo contrario está atenuada y su descripción dice por qué — «Solo un propietario o administrador puede activar o desactivar a un miembro del equipo» o «Solo puedes desactivar a miembros con un rol inferior al tuyo»." },
          { figure: "harness:team", caption: "Gestionar equipo — la columna Activo a la derecha; la propia fila del propietario está atenuada, todas las filas por debajo están activas." },
        ],
      },
      {
        id: "how-to",
        heading: "Cómo desactivar a alguien",
        blocks: [
          { steps: [
            "Abra **Gestionar equipo** — **Tu equipo** en la barra lateral, o **Configuración → Gestionar equipo**.",
            "Busque a la persona y desmarque **Activo**. El cambio se guarda de inmediato; no hay paso de confirmación.",
            "Revise el panel de licencias: su licencia o plaza de cuadrilla vuelve a estar libre en la siguiente carga.",
          ] },
          { note: "Para traer a alguien de vuelta, marque **Activo** otra vez. Conserva su inicio de sesión, su nivel y su cuadrícula, y vuelve a contar en su plan." },
        ],
      },
      {
        id: "what-changes",
        heading: "Qué cambia, y qué se conserva",
        blocks: [
          { bullets: [
            "La persona ya no puede iniciar sesión en su empresa: cada pantalla y cada solicitud rechazan a un miembro desactivado. Si también pertenece a otra empresa en FieldQuo, esa empresa no se ve afectada.",
            "Deja de contar en su plan — licencia o plaza de cuadrilla — de inmediato.",
            "Todo se conserva: presupuestos, trabajos, facturas, entradas de tiempo, nóminas, reportes de seguridad, y su ficha de trabajador en **Trabajadores**, a la que todavía se le puede pagar lo que se le debe.",
            "El cambio queda escrito en el **Registro de actividad** como «Deactivated …», con quién lo hizo y cuándo; la reactivación se registra de la misma forma.",
          ] },
        ],
      },
      {
        id: "the-rules",
        heading: "Las reglas",
        blocks: [
          { bullets: [
            "Solo propietario y administrador. Un Dispatcher o un Manager puede invitar personas y programarlas, pero no puede apagar el acceso de nadie — esa es una decisión del propietario, no de quien edita la lista.",
            "Solo a alguien de rango inferior al suyo: un administrador no puede desactivar a otro administrador ni al propietario.",
            "Nunca a usted mismo — «You can't deactivate your own account — you'd lock yourself out.»",
            "Nunca al último propietario, y nunca al último propietario o administrador activo: alguien siempre tiene que poder gestionar la cuenta.",
          ] },
        ],
      },
      {
        id: "invitations",
        heading: "Alguien que nunca aceptó",
        blocks: [
          { p: "Una persona que fue invitada y nunca se unió no tiene inicio de sesión que desactivar. Su fila muestra **Invitado**; pulse **Cancelar invitación** y confirme. El enlace deja de funcionar y la plaza se libera. Cualquier Dispatcher, Manager, administrador o propietario puede cancelar una invitación." },
        ],
      },
    ],
    faq: [
      { q: "¿Desactivar borra sus horas o sus recibos de pago?", a: "No. No se borra nada. Sus entradas de tiempo, sus nóminas y sus documentos quedan exactamente como estaban." },
      { q: "¿Puede un Manager desactivar a un miembro de la cuadrilla que se fue?", a: "No. Solo un propietario o un administrador puede desmarcar Activo. El Manager ve la casilla atenuada con el motivo." },
      { q: "Desactivé a alguien por error.", a: "Marque Activo de nuevo. No se perdió nada; la persona inicia sesión como antes con el mismo nivel." },
    ],
  },
};
