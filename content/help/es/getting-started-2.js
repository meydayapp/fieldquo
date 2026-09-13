// content/help/es/getting-started-2.js
//
// Parte 2 de la categoría «getting-started» en español (ver el compositor,
// getting-started.js). Mismos slugs, mismas secciones y mismos bloques que
// la versión en inglés, en el mismo orden: el script de verificación compara
// la estructura. Las palabras de la pantalla vienen del bloque `es` de
// app/i18n/appMessages.js; lo que el producto muestra en inglés (las
// etiquetas de la cuadrícula de acceso, el botón para repetir el recorrido)
// se cita en inglés y se señala como tal.
export const ARTICLES = {
  "how-fieldquo-works-for-owners-and-admins": {
    title: "Cómo funciona FieldQuo para propietarios y administradores",
    summary:
      "Lo que la cuenta del propietario puede hacer y ninguna otra, cómo agregar personas y decidir qué ven, y qué entrega «Hacer administrador».",
    updated: "2026-09-12",
    intro: [
      "El propietario es la persona que dio de alta la empresa. Su cuenta no tiene cuadrícula de acceso que consultar: cada pantalla, cada ajuste, cada botón. Este artículo trata de las pocas cosas que son solo suyas, y de la pantalla — **Gestionar equipo** — donde usted decide qué recibe todo el resto.",
      "Si usted es un socio o un contador al que hicieron administrador, todo lo que sigue también le aplica, con una excepción: la propiedad en sí no se transfiere desde la aplicación.",
    ],
    sections: [
      {
        id: "overview",
        heading: "Resumen",
        blocks: [
          { p: "Todos los demás en su equipo están en uno de cuatro niveles de acceso — Crew, Estimator, Dispatcher o Manager — y su barra lateral muestra solo las filas que ese nivel permite. La suya las muestra todas. La lista de abajo es lo que queda oculto para todos los niveles por debajo del suyo, Manager incluido; si una pantalla no está en ella, un Manager también la ve." },
          { p: "Ocultar una fila no es la seguridad. Cada pantalla y cada guardado se vuelven a comprobar en el servidor con las mismas reglas, así que una persona que escribe una dirección que nunca le mostraron recibe un rechazo, no la página." },
        ],
      },
      {
        id: "only-you",
        heading: "Lo que solo un propietario o un administrador puede abrir",
        blocks: [
          { table: {
            head: ["Pantalla", "Qué contiene"],
            rows: [
              ["**Plan** (también **Configuración → Cuenta y facturación**)", "Su plan, su precio, las licencias y los accesos de cuadrilla usados, la próxima fecha de facturación, **Gestionar facturación y método de pago** y **Cancelar plan**."],
              ["**Configuración → Pagos**", "La conexión con Stripe por la que pagan sus clientes, con **Gestionar en Stripe** y **Desconectar**."],
              ["**Configuración → Meta Ads**", "Su cuenta publicitaria de Facebook e Instagram, los formularios de prospectos y la conexión con WhatsApp."],
              ["**Configuración → Registro de actividad**", "Quién hizo qué y cuándo — presupuestos enviados, facturas reclamadas, miembros invitados, tarifas de pago cambiadas. Solo lectura."],
              ["**Configuración → Nómina**", "La frecuencia de pago, las deducciones y los componentes legales. Ejecutar una corrida de nómina también es solo suyo."],
              ["**Configuración → Políticas de ausencias**", "Las políticas de vacaciones y días de enfermedad, y el traspaso de fin de año."],
              ["**Configuración → Notificaciones**", "Cuándo FieldQuo le envía un correo — un presupuesto grande, una factura pagada, los recordatorios de citas."],
              ["**Configuración → Migración de datos**", "El servicio de pago con el que FieldQuo trae sus datos antiguos — vea [[the-data-migration-service|El servicio de migración de datos]]."],
              ["**Recomienda y gana**", "Su enlace de recomendación, las empresas que recomendó y los meses gratis ganados."],
            ],
          } },
          { p: "Tres acciones son solo de propietario y administradores, sea cual sea la pantalla: cambiar el nivel de acceso de una persona que ya está, hacer administrador a alguien, y desactivar a alguien. Un Dispatcher o un Manager puede invitar gente, pero solo como Crew o Estimator, y solo con ajustes que no superen los suyos." },
        ],
      },
      {
        id: "manage-team",
        heading: "Cómo agregar a alguien y elegir qué ve",
        blocks: [
          { steps: [
            "Abra **Tu equipo** en la barra lateral (la misma pantalla que **Configuración → Gestionar equipo**). El panel de arriba muestra las **licencias usadas** frente a su plan y la cuadrilla **incluidos sin costo**.",
            "Presione **Agregar usuario** e ingrese el nombre y el correo. Elija un nivel de acceso: Crew, Estimator, Dispatcher, Manager, o **Hacer administrador**. Presione **Personalizado…** para abrir la cuadrícula y cambiar un solo ajuste.",
            "La invitación sale por correo. Hasta que se acepte, la fila dice **Invitado**, con **Cancelar invitación** al lado. Nadie puede unirse a su empresa sin una de estas invitaciones.",
            "Para cambiar a alguien después, cambie el desplegable de su fila. Elegir un preajuste fija su nivel y todos sus permisos de una vez; la cuadrícula se abre si quiere ajustar una sola cosa, y la fila pasa a decir **Personalizado**.",
          ] },
          { figure: "live:app-settings-team", caption: "Tu equipo — el panel de licencias y luego una fila por persona con su nivel de acceso como desplegable." },
          { note: "Una persona en el nivel Crew no cuesta nada y no usa una licencia. Estimator, Dispatcher, Manager y los administradores son licencias completas. **Agregar una licencia** y **Agregar cuadrilla — sin costo** están en el mismo panel." },
          { figure: "harness:access-editor", caption: "El editor de acceso personalizado — las once áreas como desplegables y los tres interruptores como casillas." },
        ],
      },
      {
        id: "make-administrator",
        heading: "Qué hace «Hacer administrador»",
        blocks: [
          { p: "Un administrador recibe todo lo que usted tiene, salvo la propiedad: el plan y la tarjeta, Stripe, la nómina, el registro de actividad, y el poder de cambiar el acceso de cualquier otra persona. Existe para un socio o un contador que de verdad necesita las pantallas de dinero." },
          { warning: "No lo use para personal que solo necesita llevar el día a día. El nivel Manager ya crea, edita y borra presupuestos, trabajos, facturas y clientes, publica el horario, aprueba horas y cobra pagos — todo salvo la nómina y la facturación de la empresa." },
        ],
      },
      {
        id: "your-week",
        heading: "Las pantallas en las que un propietario vive de verdad",
        blocks: [
          { bullets: [
            "**Inicio** — la lista **Pendientes de ti**: la factura vencida con **Reclamar el pago**, las estimaciones instantáneas que esperan que se apruebe un precio, la próxima cita. Vea [[the-dashboard|El panel de control]].",
            "**Revisiones de presupuesto** — nada que un algoritmo haya cotizado llega a un cliente hasta que usted o un gerente presiona **Aprobar**.",
            "**Hojas de tiempo**, **Ausencias** y **Asignar turnos** — aprobar horas, aprobar permisos, publicar la semana. Un Dispatcher o un Manager puede hacer las tres cosas por usted.",
            "**Configuración → Registro de actividad** — la respuesta a «¿quién cambió esto?».",
            "**Plan** — una vez al mes, para revisar las licencias antes de invitar a alguien.",
          ] },
        ],
      },
    ],
    faq: [
      { q: "¿Puedo darle a mi gerente de oficina todo menos el dinero?", a: "Sí — ese es el nivel Manager. Lleva presupuestos, trabajos, facturas, clientes, horarios y gastos, y le deja a usted la nómina y la facturación de la empresa." },
      { q: "¿Alguien puede unirse a mi empresa por su cuenta?", a: "No. Una persona nueva solo entra con una invitación desde Tu equipo. Registrarse en el sitio público crea una empresa aparte, nunca una licencia en la suya." },
      { q: "¿Puedo pasarle la propiedad a otra persona?", a: "No desde la aplicación. Hágala administrador, lo que le da todo salvo la propiedad, y escríbanos si la propiedad en sí debe cambiar de manos." },
      { q: "¿Un acceso Crew cuesta algo?", a: "No. Los accesos de cuadrilla vienen incluidos sin costo en cada plan — cinco en Solo, ocho en Crew, once en Shop, quince en Scale — y nunca usan una licencia." },
    ],
  },

  "how-fieldquo-works-for-dispatchers": {
    title: "Cómo funciona FieldQuo para despachadores y gerentes",
    summary:
      "Los dos niveles que llevan la semana de la cuadrilla — qué puede y qué no puede hacer un Dispatcher, qué añade un Manager, y las pantallas donde la semana ocurre de verdad.",
    updated: "2026-09-12",
    intro: [
      "Dispatcher y Manager son los dos niveles de acceso para quienes dirigen a otras personas. Ambos ven el horario y las horas de todos, ambos pueden invitar cuadrilla, y ambos tienen todos los ajustes que un taller necesita en el día a día. La diferencia es el borrado y el dinero: un Manager puede borrar registros, ver costos de trabajo y cobrar pagos; un Dispatcher no puede hacer ninguna de las tres cosas.",
      "Si su fila en **Tu equipo** dice Dispatcher o Manager, este artículo explica lo que su barra lateral le muestra, y por qué.",
    ],
    sections: [
      {
        id: "overview",
        heading: "Resumen",
        blocks: [
          { p: "El nivel Dispatcher está hecho para el jefe de equipo que reserva a la cuadrilla, mueve visitas y mantiene la semana en orden, sin el poder de eliminar nada. El nivel Manager es el gerente de oficina o el socio que dirige las operaciones — todo salvo la nómina y la facturación de la empresa, que se quedan con el propietario." },
          { p: "Los dos niveles comparten el mismo escalón, así que las mismas pantallas aparecen en la barra lateral para ambos. La diferencia está dentro de esas pantallas: qué hace un botón al presionarlo, y si un control de borrado está ahí o no." },
        ],
      },
      {
        id: "dispatcher-vs-manager",
        heading: "Dispatcher frente a Manager, área por área",
        blocks: [
          { table: {
            head: ["Área", "Dispatcher", "Manager"],
            rows: [
              ["Horario", "Editar el horario de todos", "Editar y borrar el horario de todos"],
              ["Tiempo y hojas de tiempo", "Ver, registrar, editar y borrar las de todos", "Ver, registrar, editar y borrar las de todos"],
              ["Presupuestos, trabajos, facturas, prospectos", "Ver, crear y editar", "Ver, crear, editar y borrar"],
              ["Clientes", "Ver y editar la ficha completa", "Ver, editar y borrar la ficha completa"],
              ["Notas", "Ver y editar todas", "Ver, editar y borrar todas"],
              ["Gastos", "Solo los propios", "Los de todos — y las pantallas **Gastos** y **Compras**"],
              ["Incidentes de seguridad", "Ver los de todos y dar seguimiento", "Ver los de todos y dar seguimiento"],
              ["Ver precios", "Sí", "Sí"],
              ["Costeo de trabajos", "No", "Sí — lo cotizado contra lo real, **KPI**, **Gastos generales**, **Costos de materiales**"],
              ["Cobrar pagos", "No", "Sí"],
              ["Nómina", "Sus propios recibos de pago", "Sus propios recibos de pago"],
            ],
          } },
          { p: "Cada fila es un ajuste que el propietario puede cambiar después. Si su fila dice **Personalizado**, alguno se ajustó, y la tabla es un punto de partida más que su cuadrícula exacta." },
        ],
      },
      {
        id: "the-week",
        heading: "Cómo transcurre la semana desde estos dos niveles",
        blocks: [
          { steps: [
            "**Asignar turnos** — la semana de la cuadrilla en siete tarjetas de día. **Agregar turno** pone a una persona en un trabajo con horas y una nota. Los turnos quedan como borradores, invisibles para la cuadrilla, hasta que usted presiona **Publicar semana**.",
            "**Hojas de tiempo** — una fila por fichaje. Un fichaje hecho lejos del trabajo se marca en ámbar. Presione **Aprobar** sobre las horas antes de que lleguen a una corrida de nómina; **Agregar entrada** registra un fichaje olvidado.",
            "**Ausencias** — la pestaña **Equipo** lista las solicitudes pendientes de aprobación con **Aprobar** y **Rechazar**, quién se ausenta próximamente, y los saldos de todos.",
            "**Revisiones de presupuesto** — las estimaciones instantáneas de su sitio web llegan aquí; un Dispatcher o un Manager es el nivel más bajo autorizado a presionar **Aprobar** y dejar salir el precio.",
            "**Tu equipo** — presione **Agregar usuario** para invitar a alguien. Solo se puede dar lo que se tiene: Crew o Estimator, con ajustes que no superen los suyos.",
          ] },
          { figure: "live:app-scheduler", caption: "Asignar turnos — la semana en tarjetas de día, Agregar turno y Publicar semana." },
          { figure: "live:app-settings-team-timesheets", caption: "Hojas de tiempo — cada fichaje con sus horas y un botón Aprobar." },
        ],
      },
      {
        id: "what-you-cannot-do",
        heading: "Lo que ninguno de los dos niveles puede hacer",
        blocks: [
          { bullets: [
            "Abrir **Plan** o **Configuración → Cuenta y facturación**, **Recomienda y gana**, **Migración de datos**, **Registro de actividad**, **Políticas de ausencias**, **Notificaciones**, **Pagos**, **Meta Ads** o **Configuración → Nómina**. Esas filas no están en su barra lateral, y las páginas lo rechazan si escribe la dirección.",
            "Ejecutar una corrida de nómina o ver el recibo de pago de otra persona. **Nómina** en la barra lateral muestra solo sus propios recibos.",
            "Cambiar el acceso de una persona que ya está, hacer administrador a alguien, o desactivar a alguien.",
            "Invitar a un Dispatcher o a un Manager. **Agregar usuario** ofrece solo Crew y Estimator.",
          ] },
          { tip: "Si usted es Dispatcher y se topa una y otra vez con un botón de borrar ausente o con un bloque **Costo y margen** oculto, el arreglo es un solo desplegable: pídale al propietario que pase su fila a Manager." },
        ],
      },
      {
        id: "settings-you-can-reach",
        heading: "Los ajustes que usted puede cambiar",
        blocks: [
          { p: "Ambos niveles pueden abrir y cambiar **Configuración de la empresa**, **Marca**, **Página de reservas**, **Zonas de trabajo**, **Campos personalizados**, **Precios de gabinetes**, las plantillas (**Correo de presupuesto**, **Plantillas de correo**, **Plantillas PDF**, **Traducciones**, **Listas de verificación**, **Etiquetas de fotos de trabajo**), **Mensajes de clientes**, **Seguimientos**, **Dominio de correo**, **Crédito de IA**, y cada fila de cara al cliente — **Tu sitio web**, **Cotizaciones instantáneas**, **Comparte tus enlaces**, **Enlace para la bio**, **Recepcionista telefónico**, **Empleado de IA**, **Reseñas**. Un Manager ve además **Costos de materiales** y **Gastos generales**, porque ambos requieren el costeo de trabajos. Ambos niveles pueden leer **Productos y servicios**, **Servicios y precios** y **Cotizaciones instantáneas**, pero cambiar una tarifa ahí es solo del propietario o de un administrador." },
        ],
      },
    ],
    faq: [
      { q: "¿Por qué puedo editar una factura pero no borrarla?", a: "Usted es Dispatcher. Borrar presupuestos, trabajos, facturas, prospectos y clientes es el nivel Manager. Cancelar o archivar un trabajo es un cambio de estado, no un borrado, y sí lo puede hacer." },
      { q: "¿Por qué la cuadrilla no ve los turnos que agregué?", a: "Los turnos son borradores hasta que presiona Publicar semana. La cuadrilla solo ve turnos publicados." },
      { q: "¿Puedo ver cuánto dejó un trabajo?", a: "Solo en el nivel Manager, donde el costeo de trabajos está activado. Un Dispatcher ve el presupuesto y las horas, nunca el costo de mano de obra ni el margen." },
      { q: "¿Puedo agregar un segundo despachador?", a: "Usted no — Agregar usuario le ofrece Crew y Estimator. Pídaselo al propietario o a un administrador." },
    ],
  },

  "how-fieldquo-works-for-estimators": {
    title: "Cómo funciona FieldQuo para estimadores y vendedores",
    summary:
      "El nivel Estimator: escribir y enviar presupuestos con precios, gestionar clientes, consultar trabajos y facturas — y lo que se queda en la oficina.",
    updated: "2026-09-12",
    intro: [
      "El nivel Estimator es para la persona que cotiza y envía el trabajo pero no dirige el taller: un vendedor, un segundo estimador, el socio del propietario que hace las visitas de obra. Es el nivel que convierte un prospecto en presupuesto y lo hace firmar.",
      "Es una licencia de pago, porque puede crear presupuestos y ver todos los precios. A propósito no es un nivel de gestión: sin personal, sin nómina más allá de sus propios recibos, sin costos de trabajo.",
    ],
    sections: [
      {
        id: "overview",
        heading: "Resumen",
        blocks: [
          { p: "Un Estimator puede crear y editar prospectos y presupuestos, agregar y editar clientes, leer todas las notas, y ver — sin cambiar — trabajos y facturas. Los precios están visibles. El costo y el margen no, a propósito: un estimador que ve el piso puede descontar hasta el piso." },
          { p: "Su propio horario, su propio tiempo, sus propios gastos. Puede reportar un incidente de seguridad y ver los que usted reportó." },
        ],
      },
      {
        id: "what-you-can-do",
        heading: "Lo que puede hacer",
        blocks: [
          { bullets: [
            "**Prospectos** — el tablero de consultas llegadas de su sitio web, su enlace de reservas, el recepcionista y las recomendaciones. Mueva una tarjeta, califíquela y conviértala en presupuesto.",
            "**Cotizaciones** — **Nueva cotización** abre el constructor. Las líneas salen del catálogo de precios, las fotos se adjuntan, el presupuesto conserva el idioma en que se creó, y **Enviar** lo manda por correo a nombre de su empresa.",
            "**Clientes** y **Equipos del cliente** — las fichas completas, y la lista de llamadas por garantías.",
            "**Recepcionista** — las llamadas que atendió el agente telefónico, con **Redactar un presupuesto a partir de esta llamada**.",
            "**Análisis** y **Configuración → Productos y servicios**, **Servicios y precios**, **Cotizaciones instantáneas** — el catálogo de precios, los tipos de presupuesto y sus tarifas. Puede leerlos; cambiar una tarifa es del propietario o de un administrador.",
            "**Calendario**, **Tareas**, **Chat**, **Reloj de tiempo**, **Ausencias**, **Seguridad**, y sus propios recibos de pago bajo **Nómina**.",
          ] },
        ],
      },
      {
        id: "your-day",
        heading: "De un prospecto a un presupuesto firmado",
        blocks: [
          { steps: [
            "Abra **Prospectos**. Una consulta nueva está en la columna de nuevos con una calificación Caliente, Tibio o Frío. Abra la tarjeta.",
            "Conviértala — el cliente y la dirección pasan a un presupuesto nuevo.",
            "Arme el presupuesto desde el catálogo de precios, agrúpelo por habitación o por alcance si el trabajo es grande, adjunte fotos y agregue los extras opcionales que el cliente podrá marcar.",
            "Presione **Enviar**. El cliente recibe un correo en su idioma, abre la página de aprobación, marca los extras que quiere, firma y paga el anticipo si usted pidió uno.",
            "El presupuesto pasa a **Aprobada**. Convertirlo en un trabajo programado es el siguiente paso del despachador o del gerente — vea [[convert-a-quote-to-a-job|Qué pasa cuando se aprueba un presupuesto]].",
          ] },
          { figure: "live:app-quotes", caption: "Cotizaciones — los chips de estado, la búsqueda y la lista con número, estado, cliente, monto y antigüedad." },
        ],
      },
      {
        id: "what-is-hidden",
        heading: "Lo que se queda en la oficina",
        blocks: [
          { bullets: [
            "**Trabajos** y **Facturas** son de solo lectura. La pantalla lo dice cuando lo intenta: «Tu nivel de acceso te permite ver trabajos, no crearlos. Pídeselo a un propietario o administrador si necesitas iniciar uno.»",
            "No puede convertir un presupuesto en trabajo, asignar un presupuesto a otra persona ni aprobar una estimación instantánea — **Revisiones de presupuesto** no está en su barra lateral.",
            "Sin bloque **Costo y margen** en un presupuesto, sin **Gastos**, **Compras**, **KPI**, **Gastos generales** ni **Costos de materiales**.",
            "Sin **Tu equipo**, **Calendario del equipo**, **Hojas de tiempo**, **Subcontratistas**, **Vehículos**, **Marketing**, **Diseñador** ni **Embudos** — eso es el escalón Dispatcher y superiores.",
            "Sin cobro de pagos: registrar un pago en una factura es para un Manager, un administrador o el propietario.",
          ] },
          { note: "Todo lo anterior es un ajuste que el propietario puede cambiar. Si su fila en Tu equipo dice Personalizado, su cuadrícula difiere de este artículo en algún punto." },
        ],
      },
      {
        id: "who-sets-it",
        heading: "Quién decide esto",
        blocks: [
          { p: "El propietario o un administrador elige el nivel en **Tu equipo** — Estimator es una de las cinco opciones del desplegable — y puede abrir **Personalizado…** para darle una cosa más sin ascenderlo a Dispatcher. Un Dispatcher o un Manager también puede invitar a un Estimator, pero no puede cambiar a uno después." },
        ],
      },
    ],
    faq: [
      { q: "¿Puedo ver qué cobró la empresa el año pasado por el mismo trabajo?", a: "Sí — cada presupuesto pasado está en Cotizaciones con sus precios, y FieldQuo IA responde preguntas como «¿cuál es el valor promedio de mis cotizaciones este mes?» a partir de esos mismos registros." },
      { q: "¿Por qué no hay margen en mi presupuesto?", a: "El costeo de trabajos está apagado en el nivel Estimator por diseño. El propietario puede activarlo para usted en el editor de acceso personalizado." },
      { q: "¿Puedo reservar la visita de obra yo mismo?", a: "Sí. Calendario y Nueva cita están abiertos para usted, igual que su propio horario. Asignar una visita a otra persona es una acción de despachador." },
    ],
  },

  "how-fieldquo-works-for-crew": {
    title: "Cómo funciona FieldQuo para la cuadrilla",
    summary:
      "Un acceso Crew es gratuito y le muestra a la persona en la camioneta su día — trabajos, turnos, el reloj, el chat, las ausencias — y ningún precio, presupuesto ni factura.",
    updated: "2026-09-12",
    intro: [
      "Crew es el nivel de acceso para instaladores y ayudantes: la gente que maneja hasta la dirección, hace el trabajo y registra su salida. No cuesta nada, no usa una licencia y muestra solo lo que ese día necesita. Nada en él lleva un precio.",
      "Este artículo describe lo que ve un acceso Crew, en el teléfono y en una laptop, y lo que nunca verá por mucho que busque.",
    ],
    sections: [
      {
        id: "overview",
        heading: "Resumen",
        blocks: [
          { p: "La descripción del nivel según el propio producto: ver su horario, los trabajos que tiene asignados y qué comprar para ellos; marcar el trabajo completado y registrar su tiempo; sin precios, presupuestos, facturas ni solicitudes. Cada parte de esa frase se aplica en el servidor, no solo en el menú." },
          { p: "Los trabajos son de solo lectura y se limitan a aquellos en los que usted tiene una visita. El nombre y la dirección del cliente están ahí porque tiene que llegar; el resto de la ficha del cliente no." },
        ],
      },
      {
        id: "what-you-see",
        heading: "Qué hay en su barra lateral, y qué puede hacer ahí",
        blocks: [
          { table: {
            head: ["Pantalla", "Qué puede hacer"],
            rows: [
              ["**Trabajos**", "Abrir los trabajos en los que está asignado: dirección, visitas, notas, la lista de verificación, la lista de qué comprar. Marcar el trabajo completado."],
              ["**Calendario** y **Tareas**", "Sus visitas y las tareas que le asignaron, incluidas las que exigen fotos."],
              ["**Asignar turnos**", "Sus propios turnos publicados — nada aparece hasta que la oficina presiona Publicar semana."],
              ["**Reloj de tiempo**", "**Registrar entrada** en un trabajo, **Registrar salida**, cambiar de trabajo a media jornada. El total de sus horas del día debajo."],
              ["**Ausencias**", "Sus saldos, **Solicitar tiempo libre**, y retirar una solicitud pendiente."],
              ["**Seguridad**", "**Reportar** una lesión o un cuasi accidente, y ver los que usted reportó."],
              ["**Chat**", "#general con todo el equipo, una sala por cada trabajo en el que está, mensajes directos."],
              ["**Nómina**", "Sus propios recibos de pago. Los de nadie más."],
              ["**FieldQuo IA**", "Preguntas sobre su horario — «¿qué trabajos hay esta semana?» — y nada que tenga dinero."],
              ["**Configuración**", "Tres filas: **Idioma**, **Disponibilidad** (sus propias horas) y **Novedades del producto**."],
            ],
          } },
        ],
      },
      {
        id: "a-day",
        heading: "Un día con un acceso Crew",
        blocks: [
          { steps: [
            "Abra FieldQuo en su teléfono. La barra de pestañas muestra **Trabajos**, **Chat** y **Más**; las pestañas del proceso que usa la oficina no están ahí para usted.",
            "Abra **Trabajos**, toque el trabajo de hoy y lea las notas de la visita y la lista de verificación.",
            "Abra **Reloj de tiempo** y presione **Registrar entrada**. La etiqueta dice **En turno** y el cronómetro corre contra ese trabajo.",
            "Fotos: tómelas desde la página del trabajo, o envíelas por mensaje de texto al número de la cuadrilla y se archivan solas — vea [[text-a-photo-to-the-crew-inbox|Enviar una foto por texto sin aplicación]].",
            "Presione **Registrar salida**. Si se le olvidó, puede corregir sus propias horas en la entrada; una entrada que usted mismo edita vuelve a pendiente para que la oficina la revise de nuevo.",
          ] },
          { figure: "live:app-clock", caption: "Reloj de tiempo — el reloj en vivo, En turno, el tiempo transcurrido, el trabajo y Registrar salida." },
        ],
      },
      {
        id: "what-you-never-see",
        heading: "Lo que un acceso Crew nunca muestra",
        blocks: [
          { bullets: [
            "Sin **Prospectos**, **Cotizaciones** ni **Facturas** — las filas no están y las páginas rechazan.",
            "Sin lista de **Clientes**. Un nombre y una dirección en su propio trabajo no es la cartera de clientes de la empresa.",
            "Sin precios en ningún lado: ni en un trabajo, ni en el chat, ni de parte de FieldQuo IA.",
            "Sin **Tu equipo**, **Hojas de tiempo** (la oficina revisa ahí sus horas), **Gastos** más allá de los suyos, **Análisis**, **Marketing**.",
            "Sin ajustes salvo su idioma, sus horas y las novedades.",
          ] },
          { note: "El propietario puede subir cualquier ajuste individual para una persona en el editor de acceso personalizado sin sacarla del nivel gratuito — hasta que la cuadrícula conceda algo que la convierta en licencia, como crear presupuestos." },
        ],
      },
    ],
    faq: [
      { q: "¿Necesito instalar una aplicación?", a: "No. FieldQuo corre en el navegador del teléfono; agréguelo a la pantalla de inicio y se abre como una aplicación. Vea [[install-it-like-an-app|Instalarlo como una aplicación]]." },
      { q: "¿Por qué no veo el turno de mañana?", a: "La oficina todavía no ha publicado la semana. Los turnos son borradores hasta que se presiona Publicar semana." },
      { q: "¿Puedo ver por cuánto se cotizó el trabajo?", a: "No. Un acceso Crew no lleva precios, y un registro de trabajo no tiene dinero en este nivel." },
    ],
  },

  "fieldquo-ai-ask-about-your-business": {
    title: "FieldQuo IA: pregunte sobre su propio negocio",
    summary:
      "Un asistente que responde a partir de los presupuestos, facturas, clientes y horarios de su propia empresa, rechaza todo lo demás y funciona dentro de una cuota mensual.",
    updated: "2026-09-12",
    intro: [
      "**FieldQuo IA** es la segunda fila de la barra lateral. Usted escribe una pregunta — «¿qué clientes aún no han sido facturados?» — y busca la respuesta en los registros de su empresa en lugar de adivinar. También puede redactar un mensaje para un cliente con las cifras reales dentro.",
      "Solo responde sobre su negocio. Si le piden una receta o un ensayo, se niega en una frase y dice en qué sí puede ayudar. Nunca ve los datos de otra empresa, y nunca ve más de los suyos de lo que su nivel de acceso permite.",
    ],
    sections: [
      {
        id: "overview",
        heading: "Resumen",
        blocks: [
          { p: "Debajo del título, la pantalla dice: «Pregunta sobre tus propias cotizaciones, facturas, clientes y costos de materiales. Consulta números reales en lugar de adivinar.» Una conversación nueva muestra **Prueba a preguntar** con cuatro preguntas para tocar, y un cuadro que dice **Pregunta sobre tu negocio…** con un botón **Enviar**." },
          { figure: "live:app-copilot", caption: "FieldQuo IA — una conversación vacía con las sugerencias de Prueba a preguntar y el cuadro de pregunta." },
          { p: "Cada respuesta sale de una consulta a su propia base de datos — nunca de lo que el modelo recuerda sobre contratistas en general. Si una consulta no devuelve nada, dice que todavía no hay datos suficientes en lugar de rellenar el hueco." },
        ],
      },
      {
        id: "what-it-can-look-up",
        heading: "Qué puede consultar",
        blocks: [
          { table: {
            head: ["Pregunte sobre", "Qué lee"],
            rows: [
              ["La conversión", "La tasa de presupuesto a aceptación en un periodo reciente."],
              ["Los mejores clientes", "Quién pagó más, según las facturas pagadas."],
              ["El flujo de caja", "El dinero que entró frente a los gastos en los últimos meses."],
              ["Los ingresos por categoría", "Los ingresos de presupuestos aceptados por categoría de servicio."],
              ["Los clientes que repiten", "Cuántos clientes volvieron."],
              ["El trabajo que viene", "Los trabajos programados en los próximos N días, con las notas de la visita y las notas del presupuesto vinculado."],
              ["Un presupuesto o una factura", "Encontrados por número o por nombre de cliente: notas, líneas y si hay fotos adjuntas."],
              ["Un trabajo", "Las notas y el número de fotos de cada visita, las horas registradas, el presupuesto y las facturas — y, con costeo de trabajos, la mano de obra hasta la fecha frente al total cotizado."],
              ["Un borrador de mensaje", "Un seguimiento de presupuesto, un recordatorio de pago, una actualización de trabajo, escritos listos para enviar, con el número de factura y el monto reales."],
            ],
          } },
          { note: "Hoy no existe una consulta de costos de materiales, aunque el subtítulo de la pantalla los nombra. Una pregunta sobre costos de materiales recibe un simple «eso no lo puedo consultar aquí»." },
        ],
      },
      {
        id: "what-it-declines",
        heading: "Qué rechaza",
        blocks: [
          { bullets: [
            "Las peticiones generales — programación, recetas, tareas escolares, cultura general. Una frase, sin sermón.",
            "Todo aquello para lo que no tiene consulta. Lo dice y nombra a quién puede ayudar; no estima la respuesta a partir de otra cosa.",
            "Cualquier cifra que su nivel de acceso oculte. Las consultas se filtran según su cuadrícula antes de que empiece la conversación, así que a una persona sin **See prices** nunca se le dice el total de una factura — ni que existe.",
          ] },
        ],
      },
      {
        id: "the-monthly-allowance",
        heading: "La cuota mensual",
        blocks: [
          { p: "FieldQuo IA viene incluido en cada plan; no hay nada que comprar. Cada empresa tiene una cuota mensual compartida por todo lo que la IA hace por usted — este asistente, la revisión de presupuestos, los textos del constructor de sitios, los borradores del empleado de IA. Al 80 %, la pantalla muestra una advertencia: «Has usado el {pct} % de la cuota de FieldQuo AI de este mes.»" },
          { p: "Cuando se agota, el cuadro de pregunta se desactiva y la pantalla dice **La cuota de FieldQuo AI de este mes se ha agotado.** Se reinicia a principios del mes que viene, y todo lo demás en FieldQuo sigue funcionando con normalidad. Comprar crédito de IA en **Configuración → Crédito de IA** no la aumenta — ese crédito es para minutos de teléfono e imágenes de IA; escríbanos si necesita una cuota mayor." },
        ],
      },
      {
        id: "who-can-use-it",
        heading: "Quién puede usarlo",
        blocks: [
          { p: "Todos en el equipo tienen la fila. Lo que cada persona puede preguntar sigue su nivel de acceso: un acceso Crew solo tiene las consultas de horario, así que sus sugerencias de **Prueba a preguntar** son «¿Qué trabajos hay esta semana?» y «¿A qué trabajos estoy asignado?». El flujo de caja exige el nivel «gastos de todos»; la mano de obra de un trabajo exige el costeo de trabajos. Responde en el idioma en que usted usa la aplicación." },
        ],
      },
      {
        id: "only-in-fieldquo",
        heading: "Por qué este artículo está en «Solo en FieldQuo»",
        blocks: [
          { p: "De las cinco páginas de precios contra las que FieldQuo se compara — Jobber, Housecall Pro, ServiceTitan, Projul y QuoteIQ — cuatro no listan, en ningún nivel, un asistente que responda a partir de sus propios números. Housecall Pro lista «AI team members» en todos sus planes, una frase que también cubre su IA de atención de llamadas. Esa es toda la afirmación: no aparece en su página de precios, nunca «ellos no pueden hacerlo»." },
        ],
      },
    ],
    faq: [
      { q: "¿Ve los datos de otras empresas?", a: "Nunca. La empresa queda fijada en el servidor antes de que se ejecute cualquier consulta, y el modelo no puede cambiarla, se formule como se formule la pregunta." },
      { q: "¿Puede cambiar un presupuesto o enviar un correo?", a: "No. Cada consulta es de solo lectura. Escribe un borrador de mensaje para usted; enviarlo es su clic." },
      { q: "¿Es lo mismo que el empleado de IA o el recepcionista telefónico?", a: "No. Esos hablan con sus clientes y se configuran en Configuración. FieldQuo IA habla con usted sobre sus propios registros. Comparten la misma cuota mensual." },
      { q: "¿Se inventará una cifra?", a: "Tiene la instrucción de no hacerlo, y no tiene cómo: no dispone de ninguna cifra salvo las que devuelven las consultas. Si un número no está, lo dice." },
    ],
  },

  "replay-the-setup-walkthrough": {
    title: "Repetir el recorrido de configuración",
    summary:
      "El recorrido guiado de cinco pasos que recibe a una cuenta nueva, qué señala, y cómo volver a reproducirlo desde la pantalla Ayuda.",
    updated: "2026-09-12",
    intro: [
      "La primera vez que usted llega a **Inicio**, FieldQuo lanza un recorrido corto: cinco tarjetas, cada una señalando una fila de la barra lateral. Se muestra una vez por persona y nunca vuelve a insistir. Si lo omitió, o quiere mostrárselo a alguien que mira por encima de su hombro, puede repetirlo desde **Ayuda**.",
    ],
    sections: [
      {
        id: "overview",
        heading: "Resumen",
        blocks: [
          { p: "El recorrido está en el idioma en que usted usa la aplicación, y cada tarjeta lleva **Omitir**, un contador de pasos («2 de 5») y **Siguiente** — **Listo** en la última. En un teléfono, abre por sí mismo el cajón de la barra lateral para señalar la fila." },
        ],
      },
      {
        id: "the-five-steps",
        heading: "Los cinco pasos",
        blocks: [
          { table: {
            head: ["Paso", "Señala", "Qué dice"],
            rows: [
              ["1", "**Prospectos**", "Los prospectos llegan aquí — cada consulta de su sitio web, su página de reservas o una estimación instantánea. El inicio del proceso."],
              ["2", "**Cotizaciones**", "Conviértalos en cotizaciones — prepare una cotización con su marca, envíela y logre que la aprueben y le paguen."],
              ["3", "**Revisiones de presupuesto**", "Estimaciones instantáneas por aprobar — el precio instantáneo que un cliente recibe de su sitio llega aquí primero para que lo confirme antes de que sea definitivo."],
              ["4", "**FieldQuo IA**", "Pregúntele a FieldQuo IA — preguntas sobre sus propios números, respondidas con sus datos."],
              ["5", "**Configuración**", "Configure su negocio — la marca, los servicios, los precios, los pagos y sus tarifas de cotización instantánea. Vale la pena dedicarle diez minutos al inicio."],
            ],
          } },
        ],
      },
      {
        id: "how-to-replay",
        heading: "Cómo repetirlo",
        blocks: [
          { steps: [
            "Abra **Ayuda** al pie de la barra lateral.",
            "Presione **Replay the setup walkthrough** — la tarjeta bajo el cuadro de búsqueda, mostrada en inglés; su segunda línea anuncia el recorrido guiado rápido de la aplicación, desde el principio.",
            "FieldQuo olvida que usted vio el recorrido de bienvenida y lo lleva a **Inicio**, donde vuelve a empezar desde el paso 1.",
          ] },
          { figure: "live:app-help", caption: "Ayuda — el cuadro de búsqueda, la tarjeta para repetir el recorrido y los artículos por tema." },
        ],
      },
      {
        id: "what-it-changes",
        heading: "Qué cambia al repetirlo",
        blocks: [
          { bullets: [
            "Reinicia el recorrido de bienvenida **solo para usted**. El de un compañero no se toca.",
            "Solo se reinicia el recorrido de bienvenida. Los recorridos cortos de las otras pantallas — Prospectos, Cotizaciones, Trabajos, Facturas, Programación y el resto — se reproducen cada uno una vez, por su cuenta, la primera vez que abre esa página, y quedan como vistos.",
            "Nada cambia en su empresa. Es una nota por persona que dice «todavía no visto».",
          ] },
        ],
      },
    ],
    faq: [
      { q: "¿Por qué el recorrido no apareció para un miembro nuevo del equipo?", a: "Se ejecuta la primera vez que cada persona llega a Inicio. Si fue directo a otra página desde la invitación, espera a su primera visita a Inicio." },
      { q: "¿Puedo desactivar los recorridos para todos?", a: "No. Cada recorrido se muestra una vez por persona y se registra como visto; no hay un interruptor para toda la empresa." },
    ],
  },

  "how-to-get-help": {
    title: "Cómo obtener ayuda",
    summary:
      "Dónde están las respuestas — la pantalla Ayuda en la aplicación, el centro de ayuda público en tres idiomas, y cómo llegar a una persona en FieldQuo.",
    updated: "2026-09-12",
    intro: [
      "La mayoría de las preguntas las responde la pantalla en la que usted está: cada fila de la barra lateral y cada fila de Configuración tiene un artículo, en su idioma, con la pantalla real dentro. Cuando eso no basta, hay una dirección que llega a una persona, y una forma de solo lectura para que esa persona mire su cuenta con usted.",
    ],
    sections: [
      {
        id: "overview",
        heading: "Resumen",
        blocks: [
          { p: "Tres capas. **Ayuda** en la barra lateral es el centro de ayuda dentro de la aplicación. El centro de ayuda público son los mismos artículos, en inglés, francés y español, accesibles sin iniciar sesión — por eso puede mandarle un enlace a un compañero en su primer día. Y el soporte de FieldQuo es por correo; no hay línea telefónica, ni chat en vivo, ni formulario de tickets dentro de la aplicación." },
        ],
      },
      {
        id: "help-in-the-app",
        heading: "La pantalla Ayuda en la aplicación",
        blocks: [
          { steps: [
            "Abra **Ayuda** al pie de la barra lateral. El título dice **Centro de ayuda**, con un cuadro de búsqueda debajo.",
            "**La guía de cada pantalla** — el panel de arriba — lista cada fila de la barra lateral y de Configuración que usted puede ver. Cada nombre abre el artículo de esa pantalla en el centro de ayuda público, en su idioma, en una pestaña nueva. **Abrir el centro de ayuda** lo lleva a su página de inicio.",
            "Debajo, la tarjeta para repetir el recorrido reinicia el recorrido de bienvenida — vea [[replay-the-setup-walkthrough|Repetir el recorrido de configuración]].",
            "Más abajo, los artículos internos por tema — primeros pasos, presupuestos y facturación, trabajos y clientes, solución de problemas, y así. Se abren en el mismo lugar.",
          ] },
          { figure: "live:app-help", caption: "Ayuda — La guía de cada pantalla, luego la tarjeta del recorrido y los artículos internos." },
          { note: "Los artículos internos hoy están solo en inglés. Los artículos detrás de La guía de cada pantalla — este centro de ayuda — son los que están escritos en francés y español." },
        ],
      },
      {
        id: "the-public-help-centre",
        heading: "El centro de ayuda público",
        blocks: [
          { p: "Este sitio. Artículos en inglés, francés y español, agrupados por categoría, con un cuadro de búsqueda y una imagen de la pantalla real donde exista una. Si usa la aplicación en otro idioma, recibe el artículo en inglés con un aviso arriba que lo dice." },
          { p: "Al pie de cada artículo hay un voto «¿Le resultó útil?». Registra el artículo y la respuesta, y nada más — sin nombre, sin correo, sin texto libre — así que úselo con confianza." },
        ],
      },
      {
        id: "reach-a-person",
        heading: "Cómo llegar a una persona en FieldQuo",
        blocks: [
          { bullets: [
            "Escriba a **hello@fieldquo.com**. Ponga el nombre de su empresa en el asunto y, si se trata de un número o un dominio, el número o el dominio — un mensaje que se puede ubicar a la primera lectura se responde a la primera lectura.",
            "La página **Contact Us** del sitio público — nombre, correo, mensaje — llega a las mismas personas. Está en inglés y confirma con «Thanks for reaching out — we'll get back to you shortly.»",
            "La pantalla de ajustes **Recepcionista telefónico** enlaza directo a esa dirección, con el asunto ya escrito, cuando un número se atasca; las otras pantallas que dicen «escríbanos» se refieren a la misma dirección.",
          ] },
          { p: "Incluya qué estaba haciendo, qué decía la pantalla (la frase exacta) y el número de presupuesto o de factura si lo hay. Una captura de un mensaje rojo ahorra un ida y vuelta." },
        ],
      },
      {
        id: "what-support-can-see",
        heading: "Qué puede ver el soporte cuando mira su cuenta",
        blocks: [
          { p: "Una persona de soporte de FieldQuo puede abrir una vista de solo lectura de su cuenta para examinar un problema con usted. La solo lectura se aplica dos veces en el servidor: nada se puede crear, editar, enviar ni borrar desde esa sesión, y no puede publicar en su chat. Cada sesión de ese tipo queda registrada, y todo lo que toca aparece en **Configuración → Registro de actividad** marcado como **sesión de soporte**." },
          { p: "El soporte lo guía en un cambio o le pide que lo haga usted; nunca lo hará por usted. La única excepción autorizada es el servicio de migración de pago, donde FieldQuo crea los registros nuevos que usted pidió — vea [[the-data-migration-service|El servicio de migración de datos]]." },
        ],
      },
    ],
    faq: [
      { q: "¿Hay un número de teléfono de soporte?", a: "No. El soporte es por correo a hello@fieldquo.com, o a través de la página Contact Us." },
      { q: "¿El soporte puede cambiar algo en mi cuenta por mí?", a: "No. El acceso de soporte es de solo lectura y así se queda. Lo guiarán paso a paso." },
      { q: "¿Dónde veo qué hay de nuevo en FieldQuo?", a: "Configuración → Novedades del producto es un registro de cambios con fechas. Todos los niveles de acceso pueden abrirlo." },
    ],
  },

  "troubleshooting": {
    title: "Solución de problemas: las cinco cosas que fallan primero",
    summary:
      "Correos que nunca llegan, una factura sin botón Pagar, una pantalla que no encuentra, un logotipo que no sube y una dirección de sitio web que no carga — qué significa cada uno y dónde mirar.",
    updated: "2026-09-12",
    intro: [
      "Cinco problemas explican la mayoría de las preguntas de la primera semana, y cuatro de ellos son ajustes y no fallas. Cada sección de abajo dice qué verá, qué suele significar y la pantalla que lo arregla. Si llega al final de una sección y sigue roto, ese es el momento de escribir al soporte con la frase exacta de la pantalla — vea [[how-to-get-help|Cómo obtener ayuda]].",
    ],
    sections: [
      {
        id: "emails",
        heading: "Un cliente dice que el correo nunca llegó",
        blocks: [
          { p: "Un correo de presupuesto o de factura sale a nombre de su empresa. Desde qué dirección sale depende de **Configuración → Dominio de correo**: su propio dominio una vez verificado, el dominio de envío de FieldQuo hasta entonces. Un dominio sin verificar es la razón habitual de que el correo caiga en spam o muestre «via fieldquo.com»." },
          { steps: [
            "Abra **Configuración → Dominio de correo**. El estado dice **Verificado**, **Esperando el DNS**, **Verificación fallida** o **Sin configurar**.",
            "**Esperando el DNS** o **Verificación fallida** — los registros que lista la página todavía no están en su registrador de dominio, o no exactamente como se muestran. Agréguelos y vuelva a comprobar; el DNS puede tardar una hora.",
            "**Sin configurar** — está enviando desde el dominio de FieldQuo, que funciona, pero la entregabilidad ya no depende de usted. Vea [[send-from-your-own-domain|Enviar correo desde su propio dominio]].",
            "**Verificado** y aun así nada — pídale al cliente que revise el spam, y compruebe que la dirección de correo en su ficha no tenga un error de tecleo. La propia página del presupuesto muestra cuándo se envió.",
          ] },
          { figure: "live:app-settings-email-domain", caption: "Configuración → Dominio de correo — el dominio con su estado, la dirección de envío y adónde van las respuestas." },
        ],
      },
      {
        id: "pay-button",
        heading: "No hay botón Pagar en la factura",
        blocks: [
          { p: "El botón Pagar aparece en una factura solo cuando Stripe ha activado los cobros para su cuenta. Hasta entonces, la página de factura del cliente muestra cómo pagarle de otra forma en lugar del botón, y nunca un botón muerto." },
          { steps: [
            "Abra **Configuración → Pagos**. Si Stripe no está conectado, presione **Conectar con Stripe** — vea [[connect-stripe-and-get-verified|Conectar Stripe y obtener la verificación]].",
            "Si está conectado, la tarjeta nombra lo que Stripe ha activado y lo que todavía espera — normalmente un documento, una cuenta bancaria o el nombre de un directivo. Presione **Gestionar en Stripe** y termínelo.",
            "Si la página dice que Stripe retiene su dinero o está revisando su cuenta, los pagos siguen pasando; solo espera el depósito. Vea [[payouts-held-or-under-review|Depósitos retenidos o en revisión]].",
          ] },
          { figure: "live:app-settings-payments", caption: "Configuración → Pagos — el estado de Stripe, lo que está activado y lo que Stripe todavía espera." },
        ],
      },
      {
        id: "missing-screen",
        heading: "Una pantalla o un botón que esperaba no está",
        blocks: [
          { p: "La barra lateral oculta las filas que su nivel de acceso no permite, y algunos controles se ocultan de la misma forma. Una fila ausente es el producto funcionando, no el producto roto." },
          { steps: [
            "Revise su nivel: el propietario o un administrador puede leerlo en **Tu equipo**. Crew no ve Prospectos, Cotizaciones, Facturas ni Clientes; Estimator no ve Tu equipo, Hojas de tiempo ni Revisiones de presupuesto; Dispatcher no ve Gastos, KPI ni botones de borrar. Vea [[access-levels-overview|Niveles de acceso: quién ve qué]].",
            "Un bloque que dice **Oculto según tu nivel de acceso** o «Los precios están ocultos según tu nivel de acceso.» es la misma regla dentro de una pantalla — pídale al propietario que suba ese ajuste en el editor de acceso personalizado.",
            "**Precios de gabinetes** y **Costos de materiales** aparecen solo para los oficios que cotizan de esa forma; el sector se fija en **Configuración → Configuración de la empresa**.",
            "En un teléfono, **Más** abre todo lo que la barra de pestañas no muestra.",
          ] },
        ],
      },
      {
        id: "logo-upload",
        heading: "El logotipo no sube",
        blocks: [
          { p: "**Configuración → Marca** acepta **PNG, JPG, WebP o SVG, hasta 8 MB**. Un archivo fuera de eso se rechaza; un archivo dentro que falla muestra **Error al subir** o **No se pudo subir el logotipo**." },
          { steps: [
            "Revise el formato y el tamaño. Una foto sacada directo del teléfono puede superar los 8 MB — expórtela más pequeña.",
            "Intente una vez más. Una falla aislada con mala conexión es común; la subida la firma el servidor y termina o falla, nunca se guarda a medias.",
            "Si cada subida falla con el mismo mensaje, la falla está del lado de FieldQuo (el servicio de imágenes rechaza la subida), no en su archivo. Escriba al soporte con el mensaje.",
          ] },
        ],
      },
      {
        id: "website-address",
        heading: "La dirección de su sitio web no carga",
        blocks: [
          { p: "Su sitio vive en su subdominio de fieldquo.com, elegido en **Configuración → Tu sitio web**. «Safari no puede encontrar el servidor» o «no se puede acceder a este sitio» significa que el nombre no se resuelve — un problema del servicio de nombres del lado de FieldQuo, no algo en el contenido de su sitio." },
          { steps: [
            "Abra **Configuración → Tu sitio web** y compruebe que la insignia junto a la dirección diga **En vivo**. Un sitio que nunca se publicó no responde en absoluto — el botón junto a la dirección dice **Publicar** hasta que lo esté, y **Actualizar** después.",
            "Presione **Abrir** en esa página en lugar de escribir la dirección; un error de tecleo en el subdominio es la causa más común.",
            "Si está En vivo y aun así no carga desde un segundo dispositivo, escriba al soporte con la dirección. Es una falla del servicio de nombres comodín que FieldQuo tiene que corregir.",
          ] },
          { note: "Hoy no hay opción de dominio propio: la dirección es siempre susubdominio.fieldquo.com. Vea [[your-website-address|La dirección de su sitio web]]." },
        ],
      },
    ],
    faq: [
      { q: "FieldQuo IA dejó de responder.", a: "La cuota del mes se agotó; la pantalla lo dice encima del cuadro de pregunta. Se reinicia a principios del mes que viene. Todo lo demás sigue funcionando." },
      { q: "La primera página tras un rato sin uso fue lenta o falló.", a: "Recargue una vez. La base de datos se duerme cuando nadie la ha usado en un rato y la primera conexión la despierta." },
      { q: "El texto de recordatorio de un cliente no salió.", a: "Los recordatorios salen solo por mensaje de texto, y solo a un cliente con un número de celular en su ficha que no se haya dado de baja. Vea [[appointment-reminders|Recordatorios de citas]]." },
    ],
  },

  "faq": {
    title: "Preguntas frecuentes",
    summary:
      "Respuestas cortas a las preguntas que hace toda empresa nueva — planes y licencias, el equipo, sus clientes, sus datos, teléfonos y otras herramientas.",
    updated: "2026-09-12",
    intro: [
      "Las preguntas que surgen en el primer mes, respondidas en una o dos frases con un enlace al artículo completo. Cada respuesta aquí es cierta del producto hoy; donde FieldQuo no hace algo, se dice.",
    ],
    sections: [
      {
        id: "plans-and-billing",
        heading: "Planes y el pago de FieldQuo",
        blocks: [
          { bullets: [
            "**¿Hay una prueba gratuita?** El primer mes es gratis. Se toma una tarjeta al registrarse y no se cobra nada hasta el segundo mes. Vea [[free-first-month|Su primer mes es gratis]].",
            "**¿En qué se diferencian los planes?** En licencias y accesos de cuadrilla, nada más — cada función está en cada plan. Solo cuesta $99 al mes por 1 licencia y 5 accesos de cuadrilla; Crew $169 por 3 y 8; Shop $269 por 6 y 11; Scale $369 por 10 y 15. Vea [[the-four-plans|Los cuatro planes]].",
            "**¿Qué es una licencia, y qué es un acceso de cuadrilla?** Una licencia es alguien que crea y cambia presupuestos, trabajos y facturas. Un acceso de cuadrilla registra entrada, lee su horario y agrega fotos, y es gratuito. Vea [[seats-and-crew-logins|Licencias y accesos de cuadrilla]].",
            "**¿Un año sale más barato?** Sí — un compromiso de un año son dos meses gratis, facturado una vez al año. Vea [[monthly-or-a-year-commitment|Mensual, o un compromiso de un año]].",
            "**¿Cómo cancelo?** **Plan → Cancelar plan**. La cuenta pasa a solo lectura de inmediato; sus clientes todavía pueden pagar sus facturas. Vea [[cancel-your-subscription|Cancelar su suscripción]].",
            "**¿Recomendaciones?** Recomiende otra empresa y cada uno recibe un mes gratis cuando ella empiece a pagar. Vea [[refer-another-business|Recomendar otra empresa]].",
          ] },
        ],
      },
      {
        id: "your-team",
        heading: "Su equipo",
        blocks: [
          { bullets: [
            "**¿Alguien puede unirse sin invitación?** No. Registrarse en el sitio público crea una empresa nueva. Unirse a la suya es solo por invitación desde **Tu equipo**.",
            "**¿Qué puede ver cada persona?** Cinco niveles: Crew, Estimator, Dispatcher, Manager, administrador. El propietario puede cambiar cualquier ajuste individual. Vea [[access-levels-overview|Niveles de acceso: quién ve qué]].",
            "**¿FieldQuo le paga a mi cuadrilla?** No. La nómina calcula el pago a partir de las horas aprobadas y sus tarifas y produce los recibos; usted paga por su propio banco o su proveedor de nómina. Vea [[payroll-runs|Corridas de nómina]].",
            "**¿La cuadrilla que rechaza una aplicación puede mandar fotos igual?** Sí — envían una foto por texto al número de la cuadrilla y se archiva sola en el trabajo. Vea [[the-crew-inbox|La bandeja del equipo]].",
          ] },
        ],
      },
      {
        id: "your-clients",
        heading: "Sus clientes y su marca",
        blocks: [
          { bullets: [
            "**¿Mis clientes verán el nombre de FieldQuo?** No en un presupuesto, una factura, un correo, la página de reservas ni el portal del cliente — llevan su logotipo, su color y su nombre. La única excepción es un pequeño pie de página «Site by FieldQuo» en un sitio web gratuito. Vea [[nothing-says-fieldquo|Nada dice FieldQuo]].",
            "**¿Puedo cotizar en español y en inglés?** Sí. Un presupuesto conserva el idioma en que se creó, y el correo que lo acompaña va en el mismo. Vea [[quote-language|Un presupuesto conserva su idioma]].",
            "**¿Cuánto cuesta cobrar con tarjeta?** 3 % + 30 ¢ por pago con tarjeta; el débito bancario en Canadá es 1 % + 40 ¢ con tope de $5. Sin cuota mensual. Vea [[payment-processing-fees-and-payouts|Comisiones de procesamiento de pagos y depósitos]].",
            "**¿FieldQuo retiene mi dinero?** Nunca. Los pagos pasan por su propia cuenta de Stripe hasta su banco.",
            "**¿Cómo ve un cliente lo que debe?** Desde el enlace del correo de factura — el portal del cliente muestra su saldo, facturas y presupuestos sin iniciar sesión. Vea [[what-your-clients-get|Lo que sus clientes obtienen]].",
          ] },
        ],
      },
      {
        id: "your-data",
        heading: "Sus datos",
        blocks: [
          { bullets: [
            "**¿Puedo traer mis clientes y trabajos antiguos?** Sí — importaciones CSV de clientes, trabajos pasados y presupuestos, o el servicio de migración de pago donde FieldQuo lo hace. Vea [[import-clients-from-a-csv|Importar clientes desde un CSV]] y [[the-data-migration-service|El servicio de migración de datos]].",
            "**¿Se sincroniza con QuickBooks o Xero?** No. Hay una exportación contable en CSV hecha para importarse en ambos. Vea [[quickbooks-xero-and-your-bookkeeper|QuickBooks, Xero y su contador]].",
            "**¿Hay una API, o Zapier?** Todavía no. Vea [[no-public-api-or-zapier|Sin API pública ni Zapier, por ahora]].",
            "**¿Puedo sacar mis datos, o borrarlos?** Sí. Vea [[data-and-privacy|Sus datos, los de sus clientes y el borrado]].",
          ] },
        ],
      },
      {
        id: "phones-and-other-tools",
        heading: "Teléfonos y otras herramientas",
        blocks: [
          { bullets: [
            "**¿Hay una aplicación en las tiendas de aplicaciones?** No. FieldQuo corre en el navegador y se instala en la pantalla de inicio como una aplicación. Vea [[install-it-like-an-app|Instalarlo como una aplicación]].",
            "**¿Funciona sin conexión?** No, a propósito. Vea [[bad-connections-and-offline|Malas conexiones, y por qué no hay modo sin conexión]].",
            "**¿Qué idiomas?** La aplicación corre en ocho — inglés, francés, español, ucraniano, panyabí, tagalo, alemán e italiano; **Configuración → Idioma** muestra qué tan completo está cada uno. Este centro de ayuda está en inglés, francés y español.",
            "**¿Puede contestar mi teléfono?** Sí, el recepcionista telefónico, en un número local, pagado con crédito telefónico. Vea [[the-phone-receptionist|El recepcionista telefónico]].",
          ] },
        ],
      },
    ],
    faq: [
      { q: "¿Dónde pregunto algo que no está aquí?", a: "Escriba a hello@fieldquo.com, o use la página Contact Us del sitio público. Vea [[how-to-get-help|Cómo obtener ayuda]]." },
      { q: "¿Hay aquí alguna promesa sobre una función futura?", a: "No. Cada respuesta describe el producto tal como es hoy. Donde la respuesta honesta es «todavía no», el artículo enlazado lo dice." },
    ],
  },

  "glossary": {
    title: "Glosario",
    summary:
      "Las palabras propias de FieldQuo — licencia, acceso de cuadrilla, estimación instantánea, extra, cubicación, catálogo de precios, marca blanca, plan de servicio, zona de trabajo, débito bancario y las demás — en el sentido en que las usan las pantallas.",
    updated: "2026-09-12",
    intro: [
      "Un diccionario corto de las palabras que FieldQuo usa y que otra herramienta usa de otra forma, o no usa. Cada definición es el sentido que le da la pantalla; donde una palabra tiene su fila en Configuración, se nombra la fila.",
    ],
    sections: [
      {
        id: "selling-the-work",
        heading: "Vender el trabajo",
        blocks: [
          { table: {
            head: ["Término", "Qué significa en FieldQuo"],
            rows: [
              ["Prospecto", "Una consulta — de su formulario web, su enlace de reservas, una estimación instantánea, el recepcionista o una recomendación — en el tablero **Prospectos**, calificada Caliente, Tibio o Frío."],
              ["Presupuesto", "La oferta con precio que usted envía. Conserva el idioma en que se creó y lleva su marca, como página y como PDF."],
              ["Tipo de presupuesto", "Una clase de trabajo que usted vende, con sus preguntas de entrada y sus tarifas, en **Configuración → Servicios y precios**. Los tipos integrados de su oficio más los suyos propios."],
              ["Cubicación (takeoff)", "El formulario propio de cada oficio que convierte medidas en líneas con precio — cuadros de techo, puertas y frentes de cajón, pies lineales."],
              ["Catálogo de precios", "**Configuración → Productos y servicios**: sus propios servicios y productos con sus tarifas. Una línea de presupuesto se elige de aquí."],
              ["Estimación instantánea", "Un rango de precio que un cliente produce por su cuenta en su sitio web, a partir de sus tarifas, nunca de las nuestras. Llega a **Revisiones de presupuesto** antes de poder salir."],
              ["Revisión de presupuesto", "El paso en que una persona confirma el precio de una estimación instantánea y presiona **Aprobar**. Nada que un algoritmo haya cotizado llega a un cliente sin él."],
              ["Extra (add-on)", "Un adicional opcional al pie de un presupuesto que el cliente puede marcar en la página de aprobación. El servidor le pone precio; el navegador nunca envía un monto."],
              ["Bueno, mejor, óptimo", "Tres opciones con precio en un solo presupuesto. El cálculo existe detrás de escena, pero todavía no hay pantalla para ello."],
              ["Precio de equilibrio", "Lo mínimo que un trabajo debe dejar para cubrir sus gastos generales, calculado en **Configuración → Gastos generales** a partir de sus costos fijos reales."],
            ],
          } },
        ],
      },
      {
        id: "doing-the-work",
        heading: "Hacer el trabajo",
        blocks: [
          { table: {
            head: ["Término", "Qué significa en FieldQuo"],
            rows: [
              ["Trabajo", "La obra una vez aprobado el presupuesto: visitas, cuadrilla, materiales, fotos, listas de verificación. La mayoría de los trabajos nacen de un presupuesto aceptado."],
              ["Visita", "Un desplazamiento programado a la dirección, en el **Calendario**. Un trabajo puede tener varias."],
              ["Ventana de llegada", "El rango que usted le promete al cliente («entre 8 y 10») en lugar de un minuto exacto, fijado en **Configuración → Página de reservas** con el margen de traslado."],
              ["Turno", "Una persona en un trabajo durante un rango de horas en **Asignar turnos**. Un borrador hasta que se publica la semana; la cuadrilla solo ve turnos publicados."],
              ["Zona de trabajo", "Un territorio o proyecto con nombre en **Configuración → Zonas de trabajo**, con los miembros del equipo asignados a él, para agrupar trabajos y tareas."],
              ["Lista de verificación", "Los pasos estándar que la cuadrilla sigue en obra, por fase, desde **Configuración → Listas de verificación**."],
              ["Reloj de tiempo", "El fichaje del propio trabajador — **Registrar entrada**, **Registrar salida** — revisado por la oficina en **Hojas de tiempo** antes de una corrida de nómina."],
              ["Bandeja del equipo", "El número al que su cuadrilla envía fotos y novedades por texto; se archivan solas en el trabajo correcto, y las que no pueden esperan bajo «Te necesita»."],
              ["Costeo de trabajos", "Lo cotizado contra lo real — mano de obra según las horas registradas, materiales y gastos — para saber cuánto dejó un trabajo. Un interruptor en la cuadrícula de acceso de una persona."],
              ["Plan de servicio", "Trabajo recurrente vendido como paquete en **Planes de servicio**: una instrucción permanente de generar una visita y una factura con una cadencia."],
            ],
          } },
        ],
      },
      {
        id: "getting-paid",
        heading: "Cobrar",
        blocks: [
          { table: {
            head: ["Término", "Qué significa en FieldQuo"],
            rows: [
              ["Factura", "La cuenta a pagar, que replica las secciones y la marca del presupuesto, enviada por correo con un enlace de pago."],
              ["Anticipo", "La parte del presupuesto que se paga para reservar el trabajo, fijada por la tarjeta **Calendario de pagos** en **Configuración → Configuración de la empresa** — por ejemplo 50 % para reservar y 50 % en la instalación."],
              ["Cargo por reserva", "Un cobro que se toma cuando se reserva una visita en línea, acreditado contra la factura cuando el trabajo sigue adelante."],
              ["Comisión de procesamiento", "Lo que le cuesta un pago con tarjeta o débito bancario, descontado del pago antes de llegar a su banco: 3 % + 30 ¢ con tarjeta."],
              ["Débito bancario (Canadá)", "El débito preautorizado para clientes canadienses facturados en dólares canadienses: 1 % + 40 ¢, con tope de $5 por pago."],
              ["Portal del cliente", "La página a la que el cliente llega desde el correo de factura: su saldo, sus facturas con un botón Pagar y sus presupuestos. Sin iniciar sesión."],
              ["Depósito", "Stripe moviendo su saldo a su banco, según su calendario. Un depósito instantáneo a una tarjeta de débito cuesta 1 %."],
              ["Regla de seguimiento", "Un correo automático un tiempo después de que un presupuesto, una factura o un trabajo llega a un estado — en **Configuración → Seguimientos**."],
            ],
          } },
        ],
      },
      {
        id: "your-team-and-your-plan",
        heading: "Su equipo y su plan",
        blocks: [
          { table: {
            head: ["Término", "Qué significa en FieldQuo"],
            rows: [
              ["Licencia", "Alguien que crea y cambia presupuestos, trabajos y facturas. Las licencias son lo único en que se diferencian los cuatro planes."],
              ["Acceso de cuadrilla", "Alguien que registra entrada, lee su horario y agrega fotos. Gratuito, y nunca contado como licencia."],
              ["Nivel de acceso", "Uno de los cinco preajustes en **Tu equipo** — Crew, Estimator, Dispatcher, Manager, administrador — cada uno una cuadrícula rellena de once áreas y tres interruptores."],
              ["Personalizado", "Lo que dice una fila una vez que el propietario cambió un solo ajuste respecto a su preajuste."],
              ["Administrador", "Todo lo que tiene el propietario, salvo la propiedad en sí. Para un socio o un contador."],
              ["Corrida de nómina", "El pago de un periodo calculado a partir de las horas aprobadas y sus tarifas, con recibos de pago. FieldQuo no mueve el dinero."],
              ["Cuota de IA", "La cantidad mensual de trabajo de IA incluida en su plan, compartida por todo lo que la IA hace por usted."],
              ["Crédito de IA y crédito telefónico", "Crédito que usted compra en **Configuración → Crédito de IA** para minutos de teléfono e imágenes de IA. Aparte de la cuota."],
              ["Mes por recomendación", "Un mes gratis para usted y para la empresa que recomendó, cuando ella empieza a pagar."],
              ["Sesión de soporte", "Un miembro del personal de FieldQuo mirando su cuenta en solo lectura. Registrada, y marcada en el Registro de actividad."],
            ],
          } },
        ],
      },
      {
        id: "your-brand-and-your-clients",
        heading: "Su marca y sus clientes",
        blocks: [
          { table: {
            head: ["Término", "Qué significa en FieldQuo"],
            rows: [
              ["Marca blanca", "Cada documento que ve un cliente lleva su nombre, su logotipo y su color, no los de FieldQuo. Es lo predeterminado, no una mejora de pago."],
              ["Color de marca", "El único color de **Configuración → Marca** del que deriva cada superficie de cara al cliente; el contraste se calcula para que siga siendo legible."],
              ["Dominio de correo", "Su propio dominio en **Configuración → Dominio de correo**, para que la línea De sea suya y nada diga «via fieldquo.com»."],
              ["Página de reservas", "La página pública donde un cliente elige un horario dentro de su disponibilidad real."],
              ["Embudo", "Una página para recorrer a toques desde un anuncio o un volante, que califica a un visitante y deja un prospecto puntuado en **Prospectos**."],
              ["Enlace para la bio", "Una sola página con su marca para el único enlace que permiten Instagram y TikTok."],
              ["Texto «En camino»", "El único texto que recibe su cliente cuando la cuadrilla sale hacia su dirección; las palabras son suyas en **Configuración → Mensajes de clientes**."],
              ["Solicitud de reseña", "La única petición cortés de reseña que recibe un cliente cuando el trabajo está terminado y pagado, desde **Configuración → Reseñas**."],
            ],
          } },
        ],
      },
    ],
  },

  "what-your-clients-get": {
    title: "Lo que sus clientes obtienen",
    summary:
      "El lado del cliente en FieldQuo — el presupuesto que firma, la factura que paga, el portal que muestra lo que debe, los textos antes de una visita — todo con su nombre.",
    updated: "2026-09-12",
    intro: [
      "Sus clientes no se registran en nada. Reciben un correo, un texto o un enlace, lo abren en su teléfono y ven una página con su logotipo. Este artículo describe ese lado del producto: qué les muestra cada superficie y dónde la controla usted. El recorrido completo de cada página es la categoría [[nothing-says-fieldquo|Lo que ven sus clientes]].",
    ],
    sections: [
      {
        id: "overview",
        heading: "Resumen",
        blocks: [
          { p: "Cada superficie que toca un cliente se construye con la misma marca: su logotipo y su color de **Configuración → Marca**, su nombre en la línea De, sus reglas de idioma. Un cliente que compara tres contratistas no puede saber que dos de ellos usan FieldQuo. La única excepción es el pequeño pie de página «Site by FieldQuo» en un sitio web gratuito." },
          { p: "Nada de esto requiere iniciar sesión. Un enlace de presupuesto, un enlace de factura y el enlace del portal son cada uno imposibles de adivinar, y eso es lo que separa a un desconocido del historial de facturación de un cliente." },
        ],
      },
      {
        id: "the-documents",
        heading: "Los documentos",
        blocks: [
          { table: {
            head: ["Qué reciben", "Qué muestra", "Dónde lo controla usted"],
            rows: [
              ["El correo del presupuesto", "Su nombre y su logotipo, el PDF adjunto, en el idioma del presupuesto, con las referencias y las fotos de antes y después que usted eligió incluir.", "**Configuración → Correo de presupuesto**, **Configuración → Dominio de correo**"],
              ["La página de aprobación", "El presupuesto como página: las líneas, el alcance del trabajo y las condiciones, extras opcionales para marcar, un cuadro de firma y el anticipo a pagar si usted pidió uno.", "El constructor de presupuestos; **Configuración → Configuración de la empresa** para el calendario de pagos"],
              ["El correo de la factura", "Las mismas secciones y la misma marca que el presupuesto, con un enlace de pago.", "**Configuración → Plantillas PDF**, **Configuración → Pagos**"],
              ["La página de pago", "La factura con un botón **Pagar** con tarjeta — y débito bancario para clientes canadienses — una vez que Stripe está activo. Sin Stripe, cómo pagarle de otra forma en su lugar.", "**Configuración → Pagos**"],
              ["Pagar a plazos", "Una opción mensual al pagar, decidida por el prestamista, si usted la activó. FieldQuo no presta ni aprueba a nadie.", "**Configuración → Pagos**"],
            ],
          } },
        ],
      },
      {
        id: "the-portal",
        heading: "El portal del cliente",
        blocks: [
          { p: "El enlace de un correo de factura abre la cuenta del cliente con usted: su logotipo, **Cuenta de** seguido de su nombre, luego **Saldo pendiente** en un número grande — o **Nada pendiente. Gracias.** Debajo, **Facturas**, cada una con su total, lo pagado, la fecha de vencimiento y un botón **Pagar** o la marca **Pagado**; luego **Presupuestos**, cada uno marcado **Pendiente de su respuesta**, **Aprobado** o **Rechazado**, con **Revisar** en el que todavía espera. El pie nombra su empresa, su teléfono y su correo para preguntas." },
          { p: "Está en el idioma del cliente, y el botón de pago es el mismo cobro de Stripe que el del correo de factura — vea [[the-client-portal|El portal del cliente]]." },
        ],
      },
      {
        id: "before-and-after-a-visit",
        heading: "Antes y después de una visita",
        blocks: [
          { bullets: [
            "**La página de reservas** — un cliente elige un horario dentro de su disponibilidad real, con tiempo de traslado y ventanas de llegada incluidos, y paga un cargo por reserva si usted fijó uno.",
            "**El recordatorio de cita** — un texto antes de que usted llegue. Solo texto, sin correo, y el mensaje todavía no es editable.",
            "**El texto «En camino»** — enviado cuando la cuadrilla sale, con sus propias palabras desde **Configuración → Mensajes de clientes**.",
            "**La solicitud de reseña** — cuando el trabajo está terminado y pagado, una sola petición cortés de reseña, con su enlace de reseñas.",
          ] },
          { note: "Esos son los únicos textos automáticos que recibe un cliente. FieldQuo no les manda textos a los clientes sobre ninguna otra cosa por su cuenta — vea [[texting-clients-what-is-and-is-not-automated|Textos a clientes: qué es automático y qué no]]." },
        ],
      },
      {
        id: "before-they-are-a-client",
        heading: "Antes de que sean clientes",
        blocks: [
          { p: "Un desconocido lo conoce por su sitio web, la estimación instantánea, el formulario de autocotización, un embudo o el enlace para la bio — cada uno con su marca y cada uno aterrizando en **Prospectos**. La estimación instantánea muestra un rango sacado de sus tarifas y nunca muestra la tabla de tarifas; llega a **Revisiones de presupuesto** para que una persona la confirme antes de que sea definitiva. Vea [[instant-quotes-on-your-website|Cotizaciones instantáneas en su sitio web]]." },
        ],
      },
    ],
    faq: [
      { q: "¿Mis clientes necesitan una cuenta o una contraseña?", a: "No. Cada página que abren llega desde un enlace en un correo o un texto." },
      { q: "¿Un cliente puede ver el presupuesto de otro cliente?", a: "No. Cada enlace abre los documentos de un solo cliente, y los enlaces son imposibles de adivinar." },
      { q: "¿Y si el idioma de un cliente no es el mío?", a: "Fíjelo en su ficha de cliente. Los correos y el portal siguen el idioma del cliente; un presupuesto conserva el idioma en que se creó." },
      { q: "¿Un cliente ve alguna vez la palabra FieldQuo?", a: "Solo el pie de página «Site by FieldQuo» en un sitio web gratuito. No en un presupuesto, factura, correo, texto, página de reservas ni en el portal." },
    ],
  },
};
