// app/i18n/productPages/es.js
//
// Español, tuteo, como el resto del catálogo de marketing.
//
// Vocabulario tomado de lo que ya está en producción: "presupuesto" para el
// documento, "punto de equilibrio", "hojas de horas", "contratista", "oficio",
// "turno" para shift, "reloj de tiempo" / "fichar" para el time clock,
// "nómina" para payroll, "gastos generales" para overhead.
//
// Hereda la mezcla peninsular/latinoamericana que ya arrastra el catálogo
// (véase la cabecera de app/i18n/featurePages/index.js). No se arregla aquí:
// eso es una decisión para todo el catálogo, no para doscientas cadenas.
//
// Para revisar: "cubrir un turno" (cover) frente a "cambiar un turno" (trade);
// "tablero del día" para day board.

const es = {

  // /product/quoting
  "productPage.quoting.headline": "Envía un presupuesto profesional en minutos",
  "productPage.quoting.description":
    "Arma presupuestos con tus propios precios para cada servicio que ofreces, añade fotos y deja que el cliente apruebe en línea — sin imprimir ni ir y venir por teléfono.",
  "productPage.quoting.bullet.1":
    "Tus propios precios por categoría de servicio, no una plantilla genérica",
  "productPage.quoting.bullet.2": "El cliente aprueba y firma electrónicamente en línea",
  "productPage.quoting.bullet.3": "Un clic convierte un presupuesto aceptado en factura",
  "productPage.quoting.bullet.4":
    "Modifica una factura enviada y la anterior se conserva — nunca hay duda sobre lo acordado",
  "productPage.quoting.section.pricebook.heading": "Tus servicios y tus tarifas, configurados una vez",
  "productPage.quoting.section.pricebook.body":
    "Cada servicio que ofreces tiene su propia tarifa — por cuadrado, por pie lineal, por hora, lo que cobre tu oficio. Configúrala una vez y rellena cada presupuesto. Tu lista de productos se importa desde una hoja de cálculo, sin volver a teclear nada.",
  "productPage.quoting.section.pricebook.bullet.1": "Una tarifa por servicio, en las unidades que tu oficio usa de verdad",
  "productPage.quoting.section.pricebook.bullet.2": "Productos y servicios importados desde un CSV, sin volver a teclearlos",
  "productPage.quoting.section.pricebook.bullet.3": "Costos de materiales y recetas detrás del precio, nunca visibles para el cliente",
  "productPage.quoting.section.pricebook.alt":
    "La pantalla de Servicios y precios: techos, revestimiento y canaletas, cada uno con su tarifa y los materiales con los que se cotiza",
  "productPage.quoting.section.builder.heading": "Arma el presupuesto en la casa del cliente",
  "productPage.quoting.section.builder.body":
    "Toca un servicio y tus propios precios se rellenan. Agrupa las líneas por habitación o por alcance, adjunta las fotos que envió el cliente y mantén tu costo y tu margen en un panel que el cliente nunca ve.",
  "productPage.quoting.section.builder.bullet.1": "Agrupa las líneas por habitación o alcance para que el presupuesto se lea como avanza el trabajo",
  "productPage.quoting.section.builder.bullet.2": "Las fotos y videos del cliente se quedan en el presupuesto y pasan a la factura",
  "productPage.quoting.section.builder.bullet.3": "Costo y margen calculados junto al precio — horas del equipo, materiales, gastos generales",
  "productPage.quoting.section.builder.alt":
    "El editor de presupuestos: cliente, persona asignada, los servicios para añadir con un toque y el panel interno de costo y margen",
  "productPage.quoting.section.review.heading": "Una revisión antes de enviar, y extras que el cliente puede marcar",
  "productPage.quoting.section.review.body":
    "Antes de que salga un presupuesto, FieldQuo AI lo lee: lo que olvidaste mencionar, cómo queda el precio frente a los presupuestos que ya ganaste y una redacción más clara. Los extras sugeridos se cotizan a partir de tu propio historial y aparecen como opciones que el cliente marca en la página de aprobación.",
  "productPage.quoting.section.review.bullet.1": "Qué falta, cómo se compara el precio, qué redactar mejor",
  "productPage.quoting.section.review.bullet.2": "Comparado solo con tus propios presupuestos aceptados — nunca con los de otra empresa",
  "productPage.quoting.section.review.bullet.3": "Los extras se cotizan de tu lado; el cliente solo elige cuáles aceptar",
  "productPage.quoting.section.review.alt":
    "El panel de revisión con IA que puntúa un presupuesto 76 sobre 100, con tres cosas que conviene corregir antes de enviarlo",
  "productPage.quoting.section.approval.heading": "El cliente aprueba y firma desde su teléfono",
  "productPage.quoting.section.approval.body":
    "El presupuesto llega en un correo desde tu dirección, con tu logo y tu color, y se abre en una página que lleva tu nombre. El cliente elige los extras, firma y el trabajo arranca. Lo que vio en el momento de firmar se guarda con la firma.",
  "productPage.quoting.section.approval.bullet.1": "Tu logo, tu color, tu nombre — nada dice FieldQuo",
  "productPage.quoting.section.approval.bullet.2": "Firma registrada con el documento exacto que vio el cliente",
  "productPage.quoting.section.approval.bullet.3": "Un presupuesto conserva el idioma en que se escribió; un documento firmado nunca cambia sus palabras",
  "productPage.quoting.section.invoice.heading": "Un clic para facturar, pagado desde el teléfono",
  "productPage.quoting.section.invoice.body":
    "Un presupuesto aprobado se convierte en una factura que se parece al presupuesto, porque se construye a partir de él. Pide un depósito, divide un trabajo grande en etapas y deja que el cliente pague con tarjeta o débito bancario — el dinero se deposita en tu propia cuenta, nunca en la nuestra.",
  "productPage.quoting.section.invoice.bullet.1": "Modifica una factura emitida y la versión anterior se conserva",
  "productPage.quoting.section.invoice.bullet.2": "Depósitos y pagos por etapa, solicitados según el calendario que tú fijas",
  "productPage.quoting.section.invoice.bullet.3": "Tarjeta, o débito bancario en Canadá y Estados Unidos, pagado directo a tu cuenta",
  "productPage.quoting.section.invoice.alt":
    "La pantalla de nueva factura con las líneas y el panel interno de costo y margen",
  "productPage.quoting.section.instant.heading": "Un presupuesto instantáneo en tu sitio web",
  "productPage.quoting.section.instant.body":
    "Un visitante responde unas preguntas — o traza el techo desde la dirección — y recibe un rango de precio calculado con las tarifas que tú fijas. Llega a tu cola de revisión antes de que nada sea vinculante, y tu tarifa en sí nunca se publica.",
  "productPage.quoting.section.instant.bullet.1": "Muestra un rango al instante, después de enviar, o no lo muestres — tú eliges por servicio",
  "productPage.quoting.section.instant.bullet.2": "Cada estimación espera en Revisiones de presupuestos a que la confirmes o la ajustes",
  "productPage.quoting.section.instant.bullet.3": "Un formulario de autopresupuesto donde el propietario describe el trabajo y sube fotos",
  "productPage.quoting.section.instant.alt":
    "Ajustes de presupuestos instantáneos: techo medido desde la dirección, lo que ve el propietario y las bandas de presupuesto",
  "productPage.quoting.faq.white-label.q": "¿Mis clientes ven FieldQuo en algún lado?",
  "productPage.quoting.faq.white-label.a":
    "No. El presupuesto, la factura, la página de aprobación, los correos y el PDF llevan tu logo, tu color y tu nombre como remitente. Nuestro nombre aparece solo en dos sitios pequeños: una línea \"Sitio por FieldQuo\" en el pie de tu sitio web mientras tu empresa no esté en un plan de pago — desaparece en cuanto lo está — y una línea \"Hecho por FieldQuo\" al pie de la página de enlace de biografía.",
  "productPage.quoting.faq.own-prices.q": "¿Puedo usar mis propios precios?",
  "productPage.quoting.faq.own-prices.a":
    "Es la única forma en que funciona. Cada servicio parte de tarifas típicas de tu oficio, marcadas como punto de partida, y tú las ajustas a tu mercado; el editor de presupuestos se rellena con tus números, nunca con los nuestros. Una lista de precios también se importa desde una hoja de cálculo, así que puedes partir de la que ya llevas.",
  "productPage.quoting.faq.after-approval.q": "¿Qué pasa cuando el cliente aprueba?",
  "productPage.quoting.faq.after-approval.a":
    "El presupuesto se convierte en un trabajo con el alcance, la dirección y el papeleo ya puestos, y un clic lo convierte en una factura que refleja el presupuesto. Si pediste un depósito, se solicita en la aprobación.",
  "productPage.quoting.faq.instalments.q": "¿Los clientes pueden pagar en cuotas?",
  "productPage.quoting.faq.instalments.a":
    "Puedes dividir una factura en etapas y cada una se solicita según tu calendario. El pago a plazos al momento de pagar se ofrece a través de Stripe, donde decide el prestamista — FieldQuo no presta ni aprueba a nadie.",

  // /product/scheduling
  "productPage.scheduling.headline": "Cada persona, cada hora, en un solo tablero",
  "productPage.scheduling.description":
    "Prepara el día y la semana del equipo, publica una vez y cada uno ve sus propios turnos en su teléfono. Los clientes reservan visitas según tu disponibilidad real mientras estás en la obra.",
  "productPage.scheduling.bullet.1": "Un tablero del día con una fila por persona y una columna por hora",
  "productPage.scheduling.bullet.2": "Los turnos quedan ocultos para el equipo hasta que publicas",
  "productPage.scheduling.bullet.3": "Página de reservas pública, con tu logo y tus colores",
  "productPage.scheduling.bullet.4":
    "Tiempos de margen y disponibilidad por persona, no un calendario genérico",
  "productPage.scheduling.hero.alt":
    "El tablero del día: cinco personas en filas, las horas en columnas, una de vacaciones, una fichada y la franja de cobertura arriba",
  "productPage.scheduling.section.board.heading": "El tablero del día: quién está dónde, hora por hora",
  "productPage.scheduling.section.board.body":
    "Una fila por persona, una columna por hora. Un turno es un bloque con su almuerzo y sus descansos dibujados; el reloj de tiempo pone los puntos en verde y ámbar a medida que la gente ficha; alguien con vacaciones aprobadas aparece como una fila AUSENTE para que nadie lo programe por error.",
  "productPage.scheduling.section.board.bullet.1": "La franja de cobertura dice cuántas personas quedan en la obra cada hora — en rojo donde faltan dentro del horario de apertura",
  "productPage.scheduling.section.board.bullet.2": "Un borrador fuera de la disponibilidad declarada de alguien aparece punteado y señalado, no se permite en silencio",
  "productPage.scheduling.section.board.bullet.3": "Etiquetas de Tarde y A tiempo, del fichaje frente al turno, en el propio bloque",
  "productPage.scheduling.section.board.alt":
    "El tablero del día como lo ve el dueño: la línea de mano de obra del día y de la semana, las horas extra y las etiquetas Tarde y A tiempo en los turnos",
  "productPage.scheduling.section.week.heading": "Planifica la semana, publica una sola vez",
  "productPage.scheduling.section.week.body":
    "La cuadrícula semanal son los mismos turnos por día. Aplica un turno a varios días a la vez, publica un turno abierto que cualquiera puede reclamar y lee las horas y los salarios en el pie antes de publicar. Hasta que lo hagas, el equipo no ve nada.",
  "productPage.scheduling.section.week.bullet.1": "Interruptores de \"aplicar a\" por día: configura el lunes una vez, marca los otros cuatro",
  "productPage.scheduling.section.week.bullet.2": "Los turnos abiertos tienen su propia fila hasta que alguien los reclama",
  "productPage.scheduling.section.week.bullet.3": "Horas, horas extra y — con acceso a nómina — el costo salarial, por día y por semana",
  "productPage.scheduling.section.week.alt":
    "La cuadrícula semanal: las filas de Eventos y Turnos abiertos, un turno por persona por día, y el pie con salarios y horas",
  "productPage.scheduling.section.phone.heading": "Publicado, y en cada teléfono",
  "productPage.scheduling.section.phone.body":
    "Cuando publicas, cada persona recibe aviso en su teléfono, y otro aviso si su turno se mueve. Su horario es una tarjeta por día: el trabajo, la dirección, quién más está, la nota que dejaste y un botón Fichar entrada en la tarjeta de hoy.",
  "productPage.scheduling.section.phone.bullet.1": "Aviso cuando un turno se publica, se mueve o se quita — un borrador nunca llega a un teléfono",
  "productPage.scheduling.section.phone.bullet.2": "Los compañeros del mismo turno, la nota de la obra y la línea de festivos",
  "productPage.scheduling.section.phone.bullet.3": "Fichar entrada desde la tarjeta del día; añadir el horario al calendario del teléfono",
  "productPage.scheduling.section.phone.alt":
    "Mi horario en un teléfono: una tarjeta por día con el trabajo, la dirección, el equipo asignado y un botón Fichar entrada",
  "productPage.scheduling.section.requests.heading": "Cambios, cubrir turnos y tiempo libre, aprobados por el encargado correcto",
  "productPage.scheduling.section.requests.body":
    "Un miembro del equipo pide que le cubran desde su teléfono; un compañero acepta primero, luego el encargado aprueba, y todos reciben aviso en cada paso. El tiempo libre sigue las políticas que tú fijas, con saldos que se acumulan solos, fechas bloqueadas y los festivos oficiales de tu provincia o estado.",
  "productPage.scheduling.section.requests.bullet.1": "Cambiar un turno, pedir que te cubran, reclamar un turno abierto — todo desde el centro de solicitudes",
  "productPage.scheduling.section.requests.bullet.2": "Políticas de tiempo libre con saldos, un tope de personas ausentes a la vez y fechas bloqueadas",
  "productPage.scheduling.section.requests.bullet.3": "Los cambios de disponibilidad entran en vigor en una fecha, para que el tablero lo sepa con antelación",
  "productPage.scheduling.section.requests.alt":
    "El centro de solicitudes: tiempo libre, cambio, cubrir y disponibilidad, con las solicitudes propias del miembro del equipo listadas debajo",
  "productPage.scheduling.section.booking.heading": "Una página de reservas que llena el calendario mientras trabajas",
  "productPage.scheduling.section.booking.body":
    "Los clientes eligen un hueco según la disponibilidad real de la persona que irá, con el tiempo de viaje entre trabajos y una ventana de llegada que tú prometes, en una página que lleva tu nombre. Un mensaje de texto antes de la visita, y un enlace que les permite moverla ellos mismos.",
  "productPage.scheduling.section.booking.bullet.1": "Margen de viaje entre trabajos y una ventana de llegada — exacta, ±15, ±30 o ±60 minutos",
  "productPage.scheduling.section.booking.bullet.2": "Cobra una tarifa de visita al reservar y acredítala en la factura",
  "productPage.scheduling.section.booking.bullet.3": "Recordatorio por mensaje de texto antes de la visita; el cliente la reprograma desde el enlace, no llamándote",
  "productPage.scheduling.section.booking.alt":
    "Ajustes de la página de reservas: el código para insertar, cuánto dura una visita, el margen de viaje y la ventana de llegada prometida al cliente",
  "productPage.scheduling.section.clock.heading": "Fichar contra el trabajo, con descansos",
  "productPage.scheduling.section.clock.body":
    "El equipo ficha desde cualquier teléfono, contra el trabajo en el que está — o contra ninguno, porque el viaje y el patio son horas reales. El almuerzo y los descansos también se fichan. Al tocar, el teléfono pide una sola vez su posición; la hoja de horas muestra luego a qué distancia de la obra estaba. Nada rastrea a nadie entre toques.",
  "productPage.scheduling.section.clock.bullet.1": "¿Dos visitas hoy? El reloj pregunta cuál; \"sin trabajo\" siempre es una opción honesta",
  "productPage.scheduling.section.clock.bullet.2": "Descansos pagados y no pagados, desde el teléfono",
  "productPage.scheduling.section.clock.bullet.3": "Una posición al fichar, nunca entre medias — negarla no cambia nada en el fichaje",
  "productPage.scheduling.section.clock.alt":
    "El reloj de tiempo: la hora actual, qué trabajo y el botón Fichar entrada",
  "productPage.scheduling.faq.phone.q": "¿Mi equipo necesita instalar algo?",
  "productPage.scheduling.faq.phone.a":
    "No. FieldQuo funciona en el propio navegador del teléfono y se puede fijar en la pantalla de inicio para abrirse como cualquier otro icono. No hay nada que instalar ni que actualizar.",
  "productPage.scheduling.faq.reminders.q": "¿Cómo se recuerda a los clientes?",
  "productPage.scheduling.faq.reminders.a":
    "Por mensaje de texto antes de la visita, con un enlace para moverla o cancelarla. Todavía no hay recordatorio por correo, y el texto del recordatorio es fijo — el mensaje \"en camino\" es el que puedes editar.",
  "productPage.scheduling.faq.crew-sees.q": "¿Qué ve un miembro del equipo?",
  "productPage.scheduling.faq.crew-sees.a":
    "Sus propios turnos, los trabajos que tiene asignados, qué comprar para ellos y sus propias horas. Sin precios, sin presupuestos, sin facturas, sin las solicitudes de otros — a menos que le actives un permiso.",
  "productPage.scheduling.faq.book-account.q": "¿Los clientes necesitan una cuenta para reservar?",
  "productPage.scheduling.faq.book-account.a":
    "No. La página de reservas pide un nombre, un teléfono y una dirección, y la confirmación lleva el enlace con el que gestionan la visita.",

  // /product/team
  "productPage.team.headline": "Dale acceso a tu equipo sin perder el control",
  "productPage.team.description":
    "Niveles de acceso predefinidos para cuadrilla, estimadores, despachadores y encargados, un control por área para quien necesite algo distinto, y un expediente por persona: documentos, incorporación, políticas, horas y pago.",
  "productPage.team.bullet.1": "Perfiles de Cuadrilla, Estimador, Despachador y Encargado, y luego un control por área y por persona",
  "productPage.team.bullet.2": "Hojas de horas ligadas a trabajos reales, no a suposiciones",
  "productPage.team.bullet.3": "Ciclos de nómina y recibos de pago a partir de las horas aprobadas",
  "productPage.team.bullet.4": "Documentos de empleados, incorporación y políticas en un solo expediente",
  "productPage.team.hero.alt":
    "La pantalla de inicio del encargado: horas pagadas y salarios de hoy, dos visitas por despachar, estado del equipo y las solicitudes que necesitan revisión",
  "productPage.team.section.access.heading": "Un cargo son palabras; el acceso es un control",
  "productPage.team.section.access.body":
    "Parte de un perfil — Cuadrilla, Estimador, Despachador, Encargado — y luego cambia cualquier control para esa persona: qué ve del horario, las hojas de horas, la nómina, los clientes, los presupuestos, los trabajos, las facturas. Se aplica en el servidor, no solo en pantalla, así que un botón oculto nunca es lo único que se interpone.",
  "productPage.team.section.access.bullet.1": "Cuatro perfiles y un editor personalizado, un control por área",
  "productPage.team.section.access.bullet.2": "Mostrar precios, Costo de trabajos y Pagos son interruptores separados",
  "productPage.team.section.access.bullet.3": "Los accesos de cuadrilla son gratis; los asientos son para quienes redactan presupuestos y facturas",
  "productPage.team.section.access.alt":
    "El panel de permisos de un nuevo miembro: los perfiles Cuadrilla, Estimador, Despachador y Encargado, y un control por área debajo",
  "productPage.team.section.home.heading": "La pantalla de inicio de cada persona, en su teléfono",
  "productPage.team.section.home.body":
    "Un miembro de la cuadrilla abre FieldQuo y ve su próximo turno, la nota que dejaste, lo que ganó hoy y los botones que usa de verdad: fichar, buscar quien le cubra, cambiar, mensajes. Un encargado lo abre y ve las horas pagadas del día, las visitas por despachar, quién está en la obra y las solicitudes que esperan decisión.",
  "productPage.team.section.home.bullet.1": "El próximo turno con el trabajo, la dirección y quién más está",
  "productPage.team.section.home.bullet.2": "Buscar quien te cubra, cambiar un turno, pedir tiempo libre — desde la misma pantalla",
  "productPage.team.section.home.bullet.3": "La vista del encargado: despacho, estado del equipo y lo que necesita revisión",
  "productPage.team.section.home.alt":
    "El inicio del empleado en un teléfono: buenas tardes, el próximo turno, una nota para él, Buscar cobertura y Cambiar, y Fichar salida",
  "productPage.team.section.hr.heading": "Un expediente de RR. HH. por persona",
  "productPage.team.section.hr.body":
    "Licencias, carnés y certificaciones con recordatorios de vencimiento. Una lista de incorporación con el TD1 o el W-4 respondido desde un teléfono y guardado en el expediente — FieldQuo no presenta nada ante ninguna autoridad fiscal y nunca pide un número de seguro social. Las políticas tienen versiones y se reconocen con el nombre escrito, y una vista de cumplimiento muestra a quién le falta qué.",
  "productPage.team.section.hr.bullet.1": "Documentos con fecha de vencimiento y un recordatorio antes",
  "productPage.team.section.hr.bullet.2": "Lista de incorporación: formularios por rellenar, documentos por subir, políticas por firmar",
  "productPage.team.section.hr.bullet.3": "La bitácora del encargado para notas y amonestaciones, guardada con la persona",
  "productPage.team.section.hr.alt":
    "RR. HH. y cumplimiento: una fila por persona con documentos por verificar, avance de la incorporación, políticas sin firmar y amonestaciones",
  "productPage.team.section.chat.heading": "Una sala de chat por trabajo, y una para la empresa",
  "productPage.team.section.chat.body":
    "Cada trabajo tiene una sala que comparten la cuadrilla asignada y la oficina, para que la foto del frente de cajón rayado esté junto al trabajo y no en los mensajes de alguien. Los grupos y los mensajes directos están al lado, con @menciones, en el teléfono y en el escritorio.",
  "productPage.team.section.chat.bullet.1": "Una sala por trabajo, que se abre desde el trabajo y lleva de vuelta a él",
  "productPage.team.section.chat.bullet.2": "Grupos, mensajes directos y @menciones",
  "productPage.team.section.chat.bullet.3": "Contadores de no leídos por sala, en el teléfono",
  "productPage.team.section.chat.alt":
    "Chat del equipo: una sala de trabajo con los mensajes de la cuadrilla sobre la plantilla de la encimera y la visita previa, con una @mención resaltada",
  "productPage.team.section.timesheets.heading": "Hojas de horas a partir de fichajes reales, con las señales",
  "productPage.team.section.timesheets.body":
    "Las horas llegan ligadas al trabajo y al turno contra los que se ficharon. El tablero muestra quién llegó tarde y por cuánto, quién supera las cuarenta horas esta semana y — para quien tenga acceso a nómina — lo que cuestan el día y la semana en salarios. Tú apruebas las horas antes de que puedan convertirse en pago.",
  "productPage.team.section.timesheets.bullet.1": "Tarde o a tiempo según el fichaje frente al turno, no de memoria",
  "productPage.team.section.timesheets.bullet.2": "Horas extra señaladas por persona a medida que avanza la semana",
  "productPage.team.section.timesheets.bullet.3": "El costo salarial del día y de la semana, oculto para quien no tenga acceso a nómina",
  "productPage.team.section.timesheets.alt":
    "El tablero del día como lo ve un despachador: horas programadas, horas extra por encima de cuarenta, etiquetas Tarde y A tiempo, y una nota de que el costo de mano de obra solo se muestra a quien puede ver las tarifas de pago",
  "productPage.team.section.payroll.heading": "Ciclos de nómina y recibos de pago a partir de las horas aprobadas",
  "productPage.team.section.payroll.body":
    "Las horas aprobadas y la tarifa de cada persona se convierten en un ciclo de nómina para el periodo que elijas, con un recibo en PDF por persona. FieldQuo calcula el salario bruto; no paga a los empleados ni presenta impuestos de nómina. Alguien de tu plantilla marcado como contratista puede cobrar sus horas fichadas mediante una transferencia real a su banco.",
  "productPage.team.section.payroll.bullet.1": "Periodos de pago según tu ciclo, un recibo en PDF por persona",
  "productPage.team.section.payroll.bullet.2": "Contratistas de tu plantilla pagados por sus horas fichadas a la tarifa que fijes",
  "productPage.team.section.payroll.bullet.3": "Empresas subcontratistas en el expediente con su seguro, sus constancias y lo que les has pagado este año",
  "productPage.team.section.payroll.alt":
    "Nómina: las horas aprobadas de este periodo, bruto, deducciones y neto, y un nuevo ciclo de nómina en preparación",
  "productPage.team.faq.taxes.q": "¿FieldQuo presenta los impuestos de nómina?",
  "productPage.team.faq.taxes.a":
    "No. Calcula el salario bruto a partir de las horas aprobadas y genera los recibos. Las deducciones son las que aportas tú o tu contador, y no se presenta nada ante ninguna autoridad fiscal.",
  "productPage.team.faq.crew-free.q": "¿Los accesos de cuadrilla son gratis?",
  "productPage.team.faq.crew-free.a":
    "Sí. Un acceso de Cuadrilla ve su propio horario, ficha entrada y salida y archiva fotos — no cuenta contra tus asientos. Los asientos son para las personas que crean y modifican presupuestos, trabajos y facturas.",
  "productPage.team.faq.see-pay.q": "¿Un despachador puede ver lo que pago a la gente?",
  "productPage.team.faq.see-pay.a":
    "Solo si le das acceso a nómina. Sin él, el tablero muestra horas y horas extra y dice por qué falta el dinero. Cada tarifa y cada cifra salarial se oculta en el servidor, no solo en pantalla.",
  "productPage.team.faq.leaves.q": "¿Qué pasa cuando alguien se va?",
  "productPage.team.faq.leaves.a":
    "Lo desactivas. Sus horas, documentos e historial quedan en el expediente; ya no puede iniciar sesión, y su asiento queda libre para la siguiente persona.",

  // /product/analytics
  "productPage.analytics.headline": "Conoce tus números antes de andar adivinando",
  "productPage.analytics.description":
    "Mira tus gastos generales reales, tu punto de equilibrio por trabajo y cómo se comparan tus precios con otros talleres de tu oficio — más un asistente de IA que responde preguntas sobre tu propio negocio.",
  "productPage.analytics.bullet.1":
    "Ritmo de gasto y precio mínimo, calculados a partir de tus gastos reales",
  "productPage.analytics.bullet.2":
    "Gasto en marketing desglosado por canal — Facebook, Google, TikTok y más",
  "productPage.analytics.bullet.3":
    "Mira cómo se comparan tus precios, de forma anónima, con otros de tu oficio",
  "productPage.analytics.bullet.4":
    "Pregúntale a FieldQuo AI cosas como \"¿mi tasa de conversión es normal?\"",
  "productPage.analytics.section.kpis.heading": "El panel de KPI: ventas, dinero, costos, ganancia, ejecución",
  "productPage.analytics.section.kpis.body":
    "Tasa de cierre, valor promedio del trabajo, conversión de prospecto a presupuesto, ingresos frente a gastos por día, mano de obra como parte de los ingresos, finalización a tiempo. Cada cifra sale de lo que ya está en FieldQuo — sin conexión bancaria, sin hoja de cálculo. Una tarjeta sin datos detrás dice por qué, en vez de mostrar un cero.",
  "productPage.analytics.section.kpis.bullet.1": "Este mes, el mes pasado, este trimestre, lo que va del año o el año pasado",
  "productPage.analytics.section.kpis.bullet.2": "Estados financieros, ganados y perdidos, y precisión de las estimaciones como informes propios",
  "productPage.analytics.section.kpis.bullet.3": "Un resumen semanal, y un informe mensual en frases en vez de gráficos",
  "productPage.analytics.section.kpis.alt":
    "El panel de KPI: tarjetas de ventas, flujo de dinero con ingresos frente a gastos por día, y costos del negocio",
  "productPage.analytics.section.overhead.heading": "Los gastos generales, y el precio mínimo que implican",
  "productPage.analytics.section.overhead.body":
    "Alquiler, seguros, teléfonos, los sueldos de oficina, el préstamo de la camioneta y lo que la camioneta pierde de valor cada mes — introducido una vez. Dile a FieldQuo cuántos trabajos toma la cuadrilla en una semana normal y te dice el precio más bajo que un trabajo puede tener y aun así cubrir el negocio.",
  "productPage.analytics.section.overhead.bullet.1": "Costos fijos, sueldos, deudas, activos y depreciación, facturas por pagar",
  "productPage.analytics.section.overhead.bullet.2": "Las horas pagadas que nunca llegaron a un trabajo contadas como gasto general, no escondidas",
  "productPage.analytics.section.overhead.bullet.3": "El precio mínimo se ve junto al total del presupuesto mientras lo armas",
  "productPage.analytics.section.overhead.alt":
    "La pantalla de gastos generales: trabajos por semana, horas pagadas que nunca llegaron a un trabajo, y las secciones de costos fijos, sueldos y deudas",
  "productPage.analytics.section.expenses.heading": "Gastos, ritmo de gasto y margen de caja",
  "productPage.analytics.section.expenses.body":
    "Registra lo que gastas, o importa un mes entero desde un CSV del extracto bancario, y separa lo que pertenece a un trabajo de lo que pertenece al negocio. El ritmo de gasto mensual y cuánto te dura el efectivo que tienes salen de ahí.",
  "productPage.analytics.section.expenses.bullet.1": "Importa desde un CSV bancario; nunca un inicio de sesión en tu banco",
  "productPage.analytics.section.expenses.bullet.2": "Gasto de trabajos frente a gasto del negocio, por categoría, en seis meses",
  "productPage.analytics.section.expenses.bullet.3": "Gasto en marketing por canal, con importación automática desde Meta Ads",
  "productPage.analytics.section.expenses.alt":
    "Seguimiento de gastos: gastos registrados este mes, ritmo de gasto mensual, margen de caja, el desglose y la tendencia de seis meses",
  "productPage.analytics.section.costing.heading": "Costo de trabajos: lo que presupuestaste frente a lo que costó",
  "productPage.analytics.section.costing.body":
    "El presupuesto lleva un costo estimado — horas de la cuadrilla, materiales según la receta, una parte de gastos generales — que el cliente nunca ve. Cuando el trabajo termina, las horas fichadas, los materiales comprados y los gastos registrados se ponen frente al precio, para que sepas lo que ganaste de verdad y qué estimaciones se pasan.",
  "productPage.analytics.section.costing.bullet.1": "Mano de obra, materiales y gastos frente al precio presupuestado, por trabajo",
  "productPage.analytics.section.costing.bullet.2": "Precisión de las estimaciones: la desviación mediana en tus trabajos terminados",
  "productPage.analytics.section.costing.bullet.3": "Un aviso para revisar tus costos cuando un trabajo supera el umbral que fijes",
  "productPage.analytics.section.costing.alt":
    "El panel de Costo y margen en un presupuesto: horas de la cuadrilla, gastos generales como parte del precio, materiales y mano de obra, y el costo estimado frente al precio del presupuesto",
  "productPage.analytics.section.benchmark.heading": "Cómo se comparan tus precios, sin nombrar a nadie",
  "productPage.analytics.section.benchmark.body":
    "Actívalo y tu presupuesto promedio por categoría de servicio se pone frente al promedio anonimizado de otros talleres de tu oficio en la plataforma. Tus presupuestos individuales nunca se comparten y ninguna empresa se nombra — la tuya incluida.",
  "productPage.analytics.section.benchmark.bullet.1": "Se activa desde Ajustes; nada se compara hasta que tú lo digas",
  "productPage.analytics.section.benchmark.bullet.2": "Precio promedio y tasa de cierre por categoría de servicio",
  "productPage.analytics.section.benchmark.bullet.3": "Solo promedios agregados — una categoría con muy pocos talleres no muestra nada",
  "productPage.analytics.section.benchmark.alt":
    "Cómo te comparas, antes de activarlo: la explicación de que la comparación es opcional y el enlace a Ajustes",
  "productPage.analytics.section.ai.heading": "Pregúntale a FieldQuo AI sobre tu propio negocio",
  "productPage.analytics.section.ai.body":
    "¿Qué clientes aún no han sido facturados? ¿Cuál es mi presupuesto promedio este mes? ¿Qué costos de materiales subieron más? FieldQuo AI busca la respuesta en tus propios presupuestos, facturas, clientes y costos en vez de adivinar. Responde solo sobre tu empresa: rechaza las preguntas generales y nunca ve los datos de otra empresa.",
  "productPage.analytics.section.ai.bullet.1": "Respuestas a partir de tus propios números, con las cifras que usó",
  "productPage.analytics.section.ai.bullet.2": "Rechaza cualquier cosa que no sea sobre tu negocio",
  "productPage.analytics.section.ai.bullet.3": "Medido en crédito de IA, con una asignación en cada plan",
  "productPage.analytics.section.ai.alt":
    "FieldQuo AI: cuatro preguntas para probar, sobre clientes sin facturar, valor promedio de presupuesto, costos de materiales y presupuestos sin respuesta",
  "productPage.analytics.faq.other-data.q": "¿La IA ve los datos de otras empresas?",
  "productPage.analytics.faq.other-data.a":
    "No. FieldQuo AI lee los registros de tu propia empresa y nada más. La comparación de precios usa promedios anonimizados a los que tú te sumas; tus presupuestos nunca se muestran a nadie.",
  "productPage.analytics.faq.general.q": "¿Puedo hacerle preguntas generales?",
  "productPage.analytics.faq.general.a":
    "No. Responde preguntas sobre tu propio negocio — tus presupuestos, trabajos, facturas, clientes, costos y horas — y rechaza todo lo demás. No es un asistente general.",
  "productPage.analytics.faq.bank.q": "¿Necesito conectar mi banco?",
  "productPage.analytics.faq.bank.a":
    "No, y no puedes. Los ingresos vienen de los pagos registrados en FieldQuo; los gastos son los que registras o importas desde un CSV del extracto bancario que descargas tú mismo.",
  "productPage.analytics.faq.benchmark-source.q": "¿De dónde salen los números de comparación?",
  "productPage.analytics.faq.benchmark-source.a":
    "De otras empresas de tu oficio en FieldQuo que también se sumaron, promediadas por categoría de servicio sin nombrar a nadie. Una categoría con muy pocas empresas detrás no muestra nada en vez de un número engañoso.",

  // Page furniture shared by all four
  "productPage.chrome.readHow": "Lee cómo funciona",
  "productPage.chrome.inEnglish": "en inglés",
  "productPage.chrome.everythingTitle": "Todo lo que incluye {label}",
  "productPage.chrome.everythingBody":
    "Cada capacidad listada aquí está hoy en el producto. Donde una se queda corta, lo dice.",
  "productPage.chrome.faqTitle": "Preguntas habituales",
};

export default es;
