// app/i18n/industries/es.js — see en.js for structure and rationale.

const es = {
  chrome: {
    // The hero link to the trade's showcase, drawn only when it has one.
    seeItInAction: "Verlo en acción",
    startTrial: "Prueba gratis",
    talkToUs: "Hablemos",
    noCard: "Tu primer mes es gratis: no se cobra tu tarjeta hasta que termine.",
    videoSoon: "Demostración del producto próximamente",
    videoDemoPrefix: "¿Prefieres una en vivo?",
    videoDemoLink: "Agenda una demo",
    soundFamiliar: "¿Te suena familiar?",
    painIntro:
      "Esto es lo que le cuesta dinero, sin que se note, a los negocios de {trade}. Y esto es lo que FieldQuo hace con cada punto.",
    ctaTitle: "Pruébalo en tu próximo trabajo de {trade}",
    ctaBody:
      "Configura tus precios, envía un presupuesto, y fíjate si te ahorra la noche. Esa es toda la prueba.",
    nearby: "También para oficios cercanos",
    // The "built for" section — the three selling points from lib/sales/tradeSellingPoints.js.
    builtFor: "Hecho para negocios de {trade}",
    builtForNote: "Las tres cosas que un negocio de {trade} más usa, en el orden en que rinden.",
    builtForFallback: "Se muestra en inglés: esta parte de la página aún no está en su idioma.",
  },

  // The roofing walk-through (app/(marketing)/industries/[slug]/showcase/).
  // Every key exists in every language; check:roofing-example holds that.
  showcase: {
    eyebrow: "Ejemplo",
    title: "Así se ve una cotización de techo instantánea",
    lede: "Recórrala como lo haría un propietario y luego siga la solicitud hasta la cuenta de FieldQuo del techador.",
    noticeTitle: "Esta página es un ejemplo",
    notice: "Summit Ridge Roofing, el propietario, la casa y todos los precios de abajo son inventados para esta demostración. Cada empresa de techos fija sus propios productos y precios en FieldQuo. Nada de lo que escriba aquí se envía ni se guarda.",
    howTitle: "Cómo funciona",
    how: [
      { title: "El propietario abre su enlace", body: "Desde su sitio web, un anuncio o un mensaje de texto. Revisa la dirección y elige el techo que quiere." },
      { title: "Deja sus datos", body: "Nombre, teléfono o correo, cuándo necesita el trabajo y su presupuesto. Usted decide si el precio se muestra antes de este paso, después o nunca." },
      { title: "Ve un rango de precios", body: "Calculado a partir del techo medido y de sus propios precios, con el nombre de su empresa." },
      { title: "Usted lo revisa y lo envía", body: "La solicitud llega a sus prospectos con una puntuación, y una cotización en borrador espera su aprobación." },
    ],
    homeownerSees: "Lo que ve el propietario",
    contractorSees: "Lo que usted ve en FieldQuo",
    sampleTag: "Ejemplo",
    step1Title: "La página del propietario",
    step1Body: "La página de cotización instantánea que usan sus clientes, con una casa de ejemplo. Elija un techo, responda las preguntas y pulse el botón de abajo.",
    roofIllustration: "La imagen del techo es un dibujo hecho para este ejemplo. En una solicitud real es la foto satelital de la casa del propietario.",
    formLanguageNote: "Las páginas para propietarios existen en inglés, francés y español, así que esta se muestra en inglés.",
    showingDefault: "Se muestra una solicitud de ejemplo. Envíe el formulario de arriba para ver la suya en los pasos siguientes.",
    showingYours: "Se muestra la solicitud que acaba de enviar.",
    startOver: "Empezar de nuevo",
    step2Title: "El prospecto en su aplicación",
    step2Body: "La solicitud llega a sus prospectos con su puntuación y sus razones, las respuestas del propietario y cómo contactarlo. Abra la tarjeta.",
    step3Title: "Su revisión antes de enviarla",
    step3Body: "Las estimaciones instantáneas le esperan antes de que se pueda enviar una cotización. Compare lo que vio el propietario con el techo medido y luego apruébela.",
    step4Title: "La cotización, lista para enviar",
    step4Body: "La cotización en borrador creada a partir de la solicitud, con el cálculo detrás de su precio. No se puede abrir ni editar en esta página.",
    statusApproved: "Aprobada — lista para enviar",
    waitingApproval: "Esperando su aprobación en el paso 3.",
    editNote: "En su cuenta aún puede cambiar cualquier línea antes de enviarla.",
    workingsTitle: "Cómo se calculó este precio",
    workMeasured: "Techo medido: {area} pies², es decir, {squares} cuadrados (1 cuadrado = 100 pies²).",
    workMaterial: "{material}: {squares} cuadrados × {rate}",
    workTearOff: "Retiro de capas viejas: {layers} × {squares} cuadrados × {rate}",
    workPitch: "Techo empinado ({rise}/12): +{pct}",
    workRounding: "Redondeado a una cifra limpia",
    workSubtotal: "Subtotal",
    workTotal: "Total",
    workRange: "El propietario vio un rango de {range} (±{pct} alrededor del subtotal).",
    tiersTitle: "Cada opción de techo, cotizada para esta casa",
    tierRate: "{rate} por cuadrado",
    examplePrices: "Precios de ejemplo — usted fija los suyos.",
    ctaTitle: "Ofrezca esta página a sus clientes",
    ctaBody: "Empiece con sus propios precios y el nombre de su empresa, o reserve una demostración y se la mostramos.",
    exampleCompany: "Empresa de ejemplo · ficticia",
    reportTitle: "Adónde llega el propietario después de enviar",
    reportBody: "Su informe de estimación: el rango, el techo medido y la presentación, las fotos, los documentos y el proceso de la empresa.",
    reportLabel: "Informe de estimación",
    quotePageTitle: "Cuando usted la envía",
    quotePageBody: "La cotización que abre su cliente, con las declaraciones que marca antes de aprobar.",
    quotePageLabel: "Página de cotización",
    insuranceLink: "Abrir el certificado de seguro de ejemplo (PDF)",
    materials: {
      asphalt_3tab: "Tejas asfálticas de 3 lengüetas",
      asphalt_arch: "Tejas arquitectónicas",
      asphalt_premium: "Tejas premium / de diseño",
      metal_standing_seam: "Metal de junta alzada",
      metal_corrugated: "Metal corrugado / acanalado",
    },
  },

  trades: {
    cleaning: {
      label: "Limpieza",
      headline:
        "Software de limpieza que mantiene el trabajo recurrente en orden",
      description:
        "La limpieza residencial y comercial vive de visitas repetidas, cuadrillas que rotan y márgenes ajustados por trabajo. FieldQuo reúne la agenda, la lista de tareas y la factura en un solo lugar.",
      pains: [
        {
          pain: "Los clientes recurrentes se reagendan a mano cada semana",
          fix: "Define la frecuencia una vez y la agenda se repite sola, con la cuadrilla correcta asignada cada visita.",
        },
        {
          pain: "Se saltan pasos y el cliente lo nota antes que tú",
          fix: "Listas de tareas por trabajo que tu equipo marca desde el teléfono, para que el estándar sea el mismo venga quien venga.",
        },
        {
          pain: "Las facturas chicas se acumulan sin cobrar porque perseguirlas no vale el tiempo",
          fix: "Recordatorios automáticos de facturas vencidas, y el cliente paga en línea desde el correo.",
        },
        {
          pain: "No sabes qué contratos son realmente rentables",
          fix: "Tiempo registrado por trabajo y comparado con lo que facturaste, para detectar temprano los contratos que pierden.",
        },
      ],
    },

    "construction-contracting": {
      label: "Construcción y contratación",
      headline:
        "Software de construcción que protege tu margen en cada presupuesto",
      description:
        "Cambios de alcance, subcontratistas y precios de materiales que se mueven entre cotizar y arrancar. FieldQuo conecta presupuestos, agenda y costos reales para que sepas cómo va cada proyecto.",
      pains: [
        {
          pain: "Un presupuesto toma toda la noche y aun así se te escapan cosas",
          fix: "Arma desde tu propio catálogo con precios y grupos de alcance reutilizables: presupuestar pasa a ser ensamblar.",
        },
        {
          pain: "El costo de materiales cambia entre cotizar y empezar la obra",
          fix: "Seguimiento de costos de materiales con historial, para cotizar con precios de hoy y no de la temporada pasada.",
        },
        {
          pain: "Los cambios se acuerdan de palabra y se olvidan al facturar",
          fix: "Revisa el presupuesto, que lo aprueben otra vez en línea, y la factura refleja el cambio automáticamente.",
        },
        {
          pain: "Te enteras de que un proyecto perdió dinero cuando ya terminó",
          fix: "Mano de obra, materiales y gastos registrados mientras la obra avanza, no reconstruidos después.",
        },
      ],
    },

    electrical: {
      label: "Electricidad",
      headline:
        "Software para electricistas pensado alrededor de las llamadas de servicio",
      description:
        "Entre llamadas de servicio, cambios de tablero y coordinación de inspecciones, el papeleo se acumula rápido. FieldQuo se encarga de eso para que tus horas certificadas sean facturables.",
      pains: [
        {
          pain: "Una urgencia arruina un día ya programado",
          fix: "Arrastra el trabajo a otro horario y los clientes y la cuadrilla afectados reciben aviso automático.",
        },
        {
          pain: "Cotizar un cambio de tablero significa rehacer las mismas líneas otra vez",
          fix: "Catálogo de servicios guardado con tus propias tarifas: elige el trabajo, ajusta, envía.",
        },
        {
          pain: "Las fotos y notas de inspección quedan en el teléfono de alguien",
          fix: "Fotos y notas quedan adjuntas al trabajo, así se encuentran cuando un cliente o un inspector pregunta meses después.",
        },
        {
          pain: "Las horas del aprendiz se calculan a ojo el día de la nómina",
          fix: "Registros de tiempo sobre trabajos reales, aprobados por un supervisor, que pasan directo a los pagos.",
        },
      ],
    },

    hvac: {
      label: "HVAC",
      headline:
        "Software HVAC para los picos de temporada y los contratos de mantenimiento",
      description:
        "Tu año son dos avalanchas y dos temporadas tranquilas. FieldQuo te ayuda a absorber el pico sin dejar a nadie fuera, y a mantener el ingreso de mantenimiento en los meses lentos.",
      pains: [
        {
          pain: "La primera ola de calor genera más llamadas de las que puedes agendar",
          fix: "Una página de reservas con tu disponibilidad real, para que los clientes elijan solos en lugar de esperar al teléfono.",
        },
        {
          pain: "Los contratos de mantenimiento se olvidan hasta que llama el cliente",
          fix: "Visitas recurrentes agendadas por adelantado con recordatorios automáticos: el trabajo bajo contrato se agenda solo.",
        },
        {
          pain: "Los técnicos llegan sin saber qué equipo hay en el sitio",
          fix: "Historial completo del cliente y del trabajo en su teléfono, incluyendo qué se hizo la última visita.",
        },
        {
          pain: "Los presupuestos de instalación los gana quien responde primero",
          fix: "Arma y envía el presupuesto desde la entrada de la casa; el cliente aprueba en línea sin esperar a que vuelvas a la oficina.",
        },
      ],
    },

    handyman: {
      label: "Servicios generales",
      headline:
        "Software para trabajos que nunca son iguales dos veces",
      description:
        "Muchos trabajos chicos, mucha variedad, y precios que deben salir rápido sin salir mal. FieldQuo mantiene el papeleo proporcional al tamaño del trabajo.",
      pains: [
        {
          pain: "Cada trabajo es distinto, así que nada se reutiliza",
          fix: "Un catálogo de tus tareas y tarifas habituales que combinas como haga falta, por rara que sea la mezcla.",
        },
        {
          pain: "Los trabajos chicos no parecen merecer presupuesto formal, y luego se discuten",
          fix: "Envía un presupuesto desde el teléfono en menos de un minuto: el cliente aprueba por escrito y queda registrado.",
        },
        {
          pain: "Media jornada se va en llamadas para agendar",
          fix: "Los clientes se agendan solos en los horarios que realmente tienes libres.",
        },
        {
          pain: "Los pagos en efectivo y transferencia nunca quedan bien registrados",
          fix: "Registra cualquier método de pago contra la factura, para que los libros coincidan con la realidad.",
        },
      ],
    },

    landscaping: {
      label: "Paisajismo",
      headline:
        "Software de paisajismo para proyectos de diseño y cuadrillas de temporada",
      description:
        "Proyectos de diseño y construcción, personal de temporada, y clima que te reescribe la semana. FieldQuo mantiene presupuestos, cuadrillas y costos juntos cuando el plan no para de moverse.",
      pains: [
        {
          pain: "La lluvia reescribe la semana y hay que avisarle a todos",
          fix: "Mueve los trabajos en el calendario y los clientes y cuadrillas afectados reciben aviso automático.",
        },
        {
          pain: "Los presupuestos de diseño son largos y toman días",
          fix: "Agrupa el alcance en secciones con fotos: un presupuesto grande se lee claro y se arma rápido.",
        },
        {
          pain: "El personal de temporada hace difícil fijar el costo de mano de obra",
          fix: "Tiempo registrado por trabajo y por persona, para conocer el costo real de mano de obra de un proyecto.",
        },
        {
          pain: "Las plantas y los materiales se comen el margen sin avisar",
          fix: "Registra costos de materiales con historial y compáralos con lo que presupuestaste.",
        },
      ],
    },

    "lawn-care": {
      label: "Cuidado de césped",
      headline: "Software de cuidado de césped pensado para la densidad de ruta",
      description:
        "Mucho volumen, tickets bajos, y una rentabilidad que depende por completo de lo compacta que sea tu ruta. FieldQuo mantiene las visitas recurrentes y el cobro con el mínimo papeleo por parada.",
      pains: [
        {
          pain: "Reagendar a los mismos clientes semanales es un trabajo en sí mismo",
          fix: "Define la frecuencia una vez: las visitas se generan solas con la cuadrilla correcta.",
        },
        {
          pain: "Facturar decenas de cuentas chicas se lleva una noche entera",
          fix: "Genera facturas de las visitas completadas en lote, con enlaces de pago en línea.",
        },
        {
          pain: "Una visita saltada o cancelada por lluvia se factura igual",
          fix: "Marca visitas completadas o saltadas en campo, y el cobro sigue lo que de verdad pasó.",
        },
        {
          pain: "No puedes saber qué rutas vale la pena conservar",
          fix: "Ingresos y tiempo por trabajo, para ver qué cuentas justifican el viaje.",
        },
      ],
    },

    painting: {
      label: "Pintura",
      headline:
        "Software de pintura para presupuestos que el cliente sí aprueba",
      description:
        "La pintura se gana en el presupuesto: claridad, fotos, y llegar antes que los otros dos. FieldQuo te ayuda a enviar un presupuesto profesional el mismo día.",
      pains: [
        {
          pain: "Eres el tercer presupuesto y el más lento en llegar",
          fix: "Arma el presupuesto en el sitio con tus propias tarifas y envíalo antes de salir de la entrada.",
        },
        {
          pain: "El cliente no entiende qué está incluido y regatea",
          fix: "Alcance detallado con fotos e inclusiones claras: la conversación es sobre el trabajo, no sobre el número.",
        },
        {
          pain: "El color y la preparación se acuerdan de palabra y luego se discuten",
          fix: "Queda en el presupuesto aprobado, con fecha y con la aprobación en línea del cliente adjunta.",
        },
        {
          pain: "La pintura y los materiales cuestan más de lo que calculaste",
          fix: "Seguimiento de costos de materiales con historial, para que tus supuestos al cotizar sigan vigentes.",
        },
      ],
    },

    plumbing: {
      label: "Plomería",
      headline:
        "Software de plomería para urgencias y trabajo planificado",
      description:
        "Las urgencias no respetan la agenda, y el papeleo hay que hacerlo igual. FieldQuo mantiene el despacho, el historial y la facturación andando sin oficina administrativa.",
      pains: [
        {
          pain: "Una urgencia hace estallar un día ya lleno",
          fix: "Reagenda los trabajos afectados en unos toques; clientes y cuadrilla reciben aviso sin que tengas que llamar.",
        },
        {
          pain: "Estás facturando a las diez de la noche porque el día fue a tope",
          fix: "Convierte el trabajo terminado en factura ahí mismo, con un enlace de pago que el cliente puede usar de inmediato.",
        },
        {
          pain: "Nadie recuerda qué se hizo en esta casa la última vez",
          fix: "Historial completo por cliente, con fotos y notas, en el teléfono del técnico.",
        },
        {
          pain: "El trabajo de garantía se hace gratis porque nadie registró el original",
          fix: "Cada visita es un registro: qué se cambió, cuándo y bajo qué condiciones.",
        },
      ],
    },

    "pressure-washing": {
      label: "Lavado a presión",
      headline:
        "Software de lavado a presión para cotizar y entregar rápido",
      description:
        "Trabajos cortos, mucho volumen, y presupuestos que muchas veces salen de una foto. FieldQuo mantiene el papeleo lo bastante ligero como para que valga la pena en un trabajo de dos horas.",
      pains: [
        {
          pain: "Cotizar desde fotos es adivinar y cruzar los dedos",
          fix: "Precio por superficie desde tu propio catálogo, para estimaciones consistentes de un trabajo a otro.",
        },
        {
          pain: "En trabajos cortos el papeleo se siente desproporcionado",
          fix: "Presupuesta, agenda y factura desde el teléfono, en un par de minutos cada cosa.",
        },
        {
          pain: "Cruzar la ciudad por trabajos dispersos te mata el día",
          fix: "Mira los trabajos del día juntos para agruparlos con criterio.",
        },
        {
          pain: "Las fotos de antes y después quedan en la galería del teléfono",
          fix: "Las fotos se adjuntan al trabajo: sirven ante un reclamo y para marketing después.",
        },
      ],
    },

    roofing: {
      label: "Techado",
      headline:
        "Software de techado para presupuestos grandes y coordinación de cuadrillas",
      description:
        "Trabajos de alto valor, dependencia del clima, y clientes que necesitan convencerse antes de firmar. FieldQuo te ayuda a presupuestar con claridad y a coordinar cuadrillas una vez que ganas.",
      pains: [
        {
          pain: "Un presupuesto de cinco cifras recibe un correo de una línea y ninguna respuesta",
          fix: "Presupuestos detallados con alcance, fotos y opciones que el cliente aprueba en línea, con seguimiento automático si se queda callado.",
        },
        {
          pain: "El clima mueve la agenda y la cuadrilla se entera tarde",
          fix: "Reagenda una vez; los avisos a la cuadrilla y al cliente salen automáticamente.",
        },
        {
          pain: "Los anticipos y pagos parciales los llevas en la cabeza",
          fix: "Registra anticipos y pagos parciales contra la factura, con el saldo siempre visible para ambas partes.",
        },
        {
          pain: "El desperdicio de material se come el margen en silencio",
          fix: "Registra costos de materiales por trabajo y compáralos con lo que calculaste al presupuestar.",
        },
      ],
    },

    "tree-care": {
      label: "Cuidado de árboles",
      headline:
        "Software de arboricultura para trabajo de alto riesgo y alto valor",
      description:
        "Equipo, seguridad de la cuadrilla, y trabajos que se cotizan por criterio y no por tarifario. FieldQuo mantiene el registro claro desde la evaluación hasta la factura.",
      pains: [
        {
          pain: "Cada trabajo se cotiza por criterio y nada es comparable",
          fix: "Los trabajos pasados, con su alcance, fotos y precio final, quedan buscables: tu criterio tiene referencia.",
        },
        {
          pain: "Los riesgos del sitio se hablan ahí mismo y nunca se escriben",
          fix: "Notas, fotos y listas de verificación adjuntas al trabajo antes de que llegue la cuadrilla.",
        },
        {
          pain: "El trabajo de emergencia tras una tormenta llega todo junto",
          fix: "Recibe solicitudes por formulario y priorízalas sin que el teléfono suene sin parar.",
        },
        {
          pain: "El tiempo de equipo y cuadrilla no se refleja en el precio",
          fix: "Tiempo por trabajo comparado con lo que facturaste, para que tus precios mejoren con evidencia.",
        },
      ],
    },
  },
};

export default es;
