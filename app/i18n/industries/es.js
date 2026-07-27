// app/i18n/industries/es.js — see en.js for structure and rationale.

const es = {
  chrome: {
    startTrial: "Prueba gratis",
    talkToUs: "Hablemos",
    noCard: "No se requiere tarjeta de crédito.",
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
