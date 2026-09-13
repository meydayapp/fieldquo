// content/help/es/getting-started-1.js
//
// Parte 1 de la categoría «getting-started» en español (ver el compositor,
// getting-started.js). Misma estructura que el inglés — mismos slugs, mismas
// secciones, mismos bloques, mismas figuras — escrita para el contratista que
// la lee, en español latinoamericano neutro y de usted. Las palabras en
// pantalla vienen del bloque `es` de app/i18n/appMessages.js; los rótulos que
// la aplicación no traduce (el formulario de registro, la primera tarjeta de
// configuración) se citan tal como aparecen.
export const ARTICLES = {
  "what-fieldquo-is": {
    title: "Qué es FieldQuo, y la cadena que hace funcionar",
    summary:
      "FieldQuo sigue una sola cadena — prospecto, presupuesto, trabajo, factura, pago — y cada documento que ve su cliente lleva su nombre, no el nuestro.",
    updated: "2026-09-12",
    intro: [
      "FieldQuo es la oficina de un contratista de servicios a domicilio: pintor, ebanista, instalador de pisos, plomero, jardinero. Existe para que usted gane el trabajo, lo haga y cobre sin salir de un solo lugar — y para que un propietario que compara tres contratistas no pueda saber cuáles usan el mismo software.",
      "Este artículo es el mapa. Nombra la cadena, las dos caras del producto, la promesa sobre su nombre y por dónde empezar.",
    ],
    sections: [
      {
        id: "overview",
        heading: "Resumen",
        blocks: [
          { p: "Todo en FieldQuo es un paso sobre una misma línea: un **prospecto** se convierte en un **presupuesto**, un presupuesto aprobado se convierte en un **trabajo**, un trabajo terminado se cobra con una **factura**, y la factura se paga en línea a través de su propia cuenta de Stripe. Alrededor de esa línea está lo que un taller necesita para hacerla funcionar: la programación, las horas de la cuadrilla, los materiales, los gastos, el costeo, su sitio web, su página de reservas, sus reseñas." },
          { p: "El menú sigue el mismo orden. Bajo **Trabajo** encontrará **Prospectos**, **Cotizaciones**, **Trabajos** y **Facturas**, en esa secuencia, porque es la secuencia en la que se mueve el dinero." },
        ],
      },
      {
        id: "the-pipeline",
        heading: "La cadena, paso a paso",
        blocks: [
          { bullets: [
            "**Prospecto** — una consulta que llega desde el formulario de su sitio, su enlace de reservas, una cotización instantánea, el recepcionista telefónico o una recomendación. Cae en el tablero de prospectos calificada como Caliente, Tibia o Fría.",
            "**Presupuesto** — armado desde su lista de precios, en el idioma en que se creó, revisado por la IA si usted lo pide, y enviado como página y como PDF con su logotipo. El cliente lo aprueba y lo firma en línea.",
            "**Trabajo** — se crea cuando el presupuesto se aprueba. Las visitas van al calendario, la cuadrilla marca su entrada, las fotos y las listas de verificación vuelven desde la obra.",
            "**Factura** — el espejo del presupuesto: mismas secciones, misma marca. Se puede cobrar primero un anticipo si su calendario de pagos lo indica.",
            "**Pago** — el cliente paga con tarjeta o, en Canadá, con débito bancario, directo a su cuenta. FieldQuo nunca retiene el dinero.",
          ] },
          { p: "Cada paso tiene su propia categoría en este centro de ayuda: [[the-leads-board|Prospectos]], [[build-a-quote|Presupuestos]], [[the-jobs-list|Trabajos]], [[create-an-invoice|Facturas]] y [[how-clients-pay-online|Pagos]]." },
        ],
      },
      {
        id: "two-surfaces",
        heading: "Dos caras: su oficina, y lo que ven sus clientes",
        blocks: [
          { p: "Su equipo trabaja en la **oficina** — las pantallas detrás del menú, donde el personal pasa el día. Sus clientes nunca inician sesión ahí. Ellos ven un segundo conjunto de páginas: la página de aprobación del presupuesto, la factura con su botón de pago, la página de reservas, el portal del cliente, su sitio web, los correos y los mensajes de texto. Esas páginas están hechas para un desconocido con un teléfono, con mala conexión, en la entrada de una casa." },
          { figure: "live:app", caption: "Inicio — el panel, con los cinco grupos del menú a la izquierda." },
          { p: "La categoría [[nothing-says-fieldquo|Lo que ven sus clientes]] recorre cada página del lado del cliente exactamente como el cliente la recibe." },
        ],
      },
      {
        id: "your-name-not-ours",
        heading: "Todo lleva su nombre",
        blocks: [
          { p: "Su logotipo, su color de marca y el nombre de su empresa van en cada presupuesto, factura, PDF, correo, página de reservas y página del sitio web. Con su propio dominio verificado, la línea «De» en la bandeja de su cliente es su dirección, no la nuestra. Se configura una sola vez, en [[set-up-your-branding|Marca]] y [[send-from-your-own-domain|Dominio de correo]]." },
          { note: "Hay una excepción deliberada: una pequeña línea **Site by FieldQuo** al pie de un sitio web cuya empresa no está en un plan de pago. El sitio de una empresa que paga no menciona a FieldQuo en ningún lugar." },
        ],
      },
      {
        id: "what-it-does-not-do",
        heading: "Lo que FieldQuo no hace",
        blocks: [
          { bullets: [
            "No retiene su dinero. Los pagos de los clientes son cargos de Stripe a nombre de su empresa, depositados en su cuenta — vea [[payment-processing-fees-and-payouts|comisiones y depósitos]].",
            "No tiene API pública ni conector con Zapier — vea [[no-public-api-or-zapier|Integraciones]].",
            "FieldQuo IA responde preguntas sobre sus propios presupuestos, facturas, clientes y costos. Rechaza las peticiones generales y nunca ve los datos de otra empresa.",
          ] },
        ],
      },
      {
        id: "where-to-start",
        heading: "Por dónde empezar",
        blocks: [
          { bullets: [
            "[[start-your-free-trial|Empiece su prueba gratis]] — los cuatro pasos del registro y para qué es la tarjeta.",
            "[[your-first-day-setup-checklist|Su primer día]] — la lista que el panel muestra hasta que está completa.",
            "[[the-sidebar-and-where-everything-is|El menú lateral]] — dónde está cada pantalla.",
          ] },
        ],
      },
    ],
    faq: [
      { q: "¿FieldQuo es para una persona sola o para un equipo?", a: "Para ambos. El plan Solo es un asiento con cinco accesos de cuadrilla gratis; Scale son diez asientos y quince accesos de cuadrilla. Los accesos de cuadrilla no cuestan nada." },
      { q: "¿Mis clientes necesitan una cuenta?", a: "No. Un presupuesto, una factura, una reserva y el portal se abren desde un enlace. Nadie del lado del cliente se registra en nada." },
      { q: "¿Mis clientes verán el nombre FieldQuo en algún lugar?", a: "No en un presupuesto, una factura, un correo ni una página de reservas. El único lugar donde aparece es el pie de un sitio web cuya empresa no está en un plan de pago." },
    ],
  },

  "start-your-free-trial": {
    title: "Empiece su prueba gratis",
    summary:
      "Cuatro pasos en el formulario público de registro, una tarjeta al pagar, y nada cobrado durante el primer mes.",
    updated: "2026-09-12",
    intro: [
      "Registrar una empresa es autoservicio: cualquiera puede abrir la página de registro, configurar un negocio, elegir un plan y empezar. El primer mes es gratis, y se toma una tarjeta al pagar para que el segundo mes pueda cobrarse sin una segunda conversación.",
      "Unirse a una empresa que ya existe es distinto: solo por invitación. Si un colega ya usa FieldQuo, pídale que lo invite desde Gestionar equipo; vea [[invite-a-team-member|Invitar a un miembro del equipo]].",
    ],
    sections: [
      {
        id: "overview",
        heading: "Resumen",
        blocks: [
          { p: "El formulario dice **Empieza tu mes gratis** arriba y recorre cuatro pasos: Account, Trades, Services, Plan. Una cuenta de acceso posee un solo negocio; si ya inició sesión con una empresa, la página se lo dice y le ofrece ir a su panel o invitar a alguien en su lugar." },
        ],
      },
      {
        id: "the-four-steps",
        heading: "Los cuatro pasos",
        blocks: [
          { steps: [
            "**Account** — su nombre y apellido, correo y una contraseña de 8 a 128 caracteres, más el nombre de la empresa, el teléfono y la dirección. La dirección importa: decide el país, y el país decide si se le cobra en dólares canadienses o estadounidenses.",
            "**Trades** — «What trades does your company work in?» Marque todos los oficios que apliquen; esto reduce los tipos de presupuesto que verá.",
            "**Services** — «Which services do you offer?» Los tipos de presupuesto habituales de sus oficios vienen preseleccionados. Active los que ofrece; podrá cambiarlo en cualquier momento en Configuración → Servicios y precios.",
            "**Plan** — «Choose your plan»: los cuatro planes en su moneda, y luego cómo quiere que se le cobre. Pulse **Continue to Payment** para ir al pago.",
          ] },
          { note: "El formulario de registro en sí está en inglés. La aplicación, una vez dentro, sigue el idioma que usted elija — vea [[choose-your-language|Elija su idioma]]." },
        ],
      },
      {
        id: "choosing-a-plan",
        heading: "Elegir un plan",
        blocks: [
          { table: {
            head: ["Plan", "Al mes", "Asientos", "Accesos de cuadrilla"],
            rows: [
              ["Solo", "99", "1", "5, gratis"],
              ["Crew", "169", "3", "8, gratis"],
              ["Shop", "269", "6", "11, gratis"],
              ["Scale", "369", "10", "15, gratis"],
            ],
          } },
          { p: "El número es el mismo en las dos monedas: una empresa canadiense paga 99 dólares canadienses, una estadounidense 99 dólares estadounidenses. Un **asiento** es alguien que puede crear o cambiar un presupuesto, un trabajo o una factura; un **acceso de cuadrilla** es alguien que ve su horario, marca su entrada y envía fotos, y no cuesta nada. El detalle completo: [[your-plan-and-seats|Su plan y sus asientos]]." },
          { p: "Bajo las tarjetas de planes, **No commitment** cobra mes a mes y se cancela cuando quiera; **1 year commitment** cobra una vez al año por el precio de diez meses — dos meses gratis. Un equipo más grande que Scale se cotiza a mano: la tarjeta **Need more than Scale?** lleva a la página de contacto." },
        ],
      },
      {
        id: "the-card-and-the-free-month",
        heading: "La tarjeta, y el mes gratis",
        blocks: [
          { p: "**Continue to Payment** crea la empresa y abre Stripe Checkout. Stripe toma la tarjeta; FieldQuo nunca ve el número. La línea sobre el botón lo dice claro: **Free first month**, y luego el precio del plan. Hoy no se cobra nada — el mes gratis dura 30 días desde que se crea la empresa, y el primer cargo cae cuando termina. Vea [[free-first-month|El primer mes gratis]]." },
          { warning: "Si cierra la pestaña del pago, la empresa existe pero no tiene tarjeta, y cada pantalla de la aplicación queda cerrada hasta que la tenga. Al volver a iniciar sesión cae en **Falta un paso** — «{company} está configurada — solo falta una tarjeta para que puedas usarla» — con el paso del plan listo para terminar." },
          { tip: "¿Llegó por el enlace de recomendación de otro contratista? El aviso del formulario lo dice, y se añade un mes gratis extra a su prueba. La persona que lo recomendó gana un mes cuando usted ya es cliente de pago. Vea [[referral-months|Los meses por recomendación]]." },
        ],
      },
      {
        id: "after-checkout",
        heading: "Después del pago",
        blocks: [
          { p: "Stripe lo devuelve al panel. Un recorrido corto señala el menú la primera vez; podrá repetirlo después desde Ayuda — vea [[replay-the-setup-walkthrough|Repetir el recorrido de configuración]]. La tarjeta **Termina de configurar FieldQuo** enumera lo que todavía falta y, para propietarios y administradores, el menú muestra **Trial started · N days left** hasta el primer pago." },
          { bullets: [
            "[[your-first-day-setup-checklist|Su primer día: la lista de configuración]] — qué hacer y en qué orden.",
            "[[company-settings-basics|Lo básico de la configuración de la empresa]] — la dirección, los impuestos y el horario que el formulario de registro no pidió.",
            "[[connect-stripe-and-get-verified|Conectar Stripe]] — para que la primera factura pueda pagarse en línea.",
          ] },
        ],
      },
    ],
    faq: [
      { q: "¿Tengo que dar una tarjeta para probarlo?", a: "Sí — al pagar, a través de Stripe. No se cobra nada durante el mes gratis, y puede cancelar antes de que termine desde Cuenta y facturación." },
      { q: "¿Puedo elegir la moneda?", a: "No. Se lee de la dirección que usted dio. Las dos listas de precios llevan los mismos números, así que no hay nada que elegir." },
      { q: "Ya uso FieldQuo en mi trabajo. ¿Puedo registrar también mi propio negocio?", a: "Una cuenta de acceso posee un solo negocio. Registre su propia empresa con otra dirección de correo." },
      { q: "¿Puedo cambiar de plan después?", a: "Sí, desde Cuenta y facturación — vea [[change-your-plan|Cambiar de plan]]. Subir de plan surte efecto de inmediato." },
    ],
  },

  "your-first-day-setup-checklist": {
    title: "Su primer día: la lista de configuración",
    summary:
      "Las dos tarjetas del panel que enumeran lo que todavía falta, lo que desbloquea cada punto, y un orden sensato para hacerlos.",
    updated: "2026-09-12",
    intro: [
      "Después del registro, el panel lleva dos tarjetas que solo existen hasta que el trabajo está hecho: **Termina de configurar FieldQuo**, la lista corta de lo que una empresa necesita antes de que salga su primer presupuesto, y **Pasos de configuración adicionales**, la lista más larga de lo que vale la pena hacer en la primera semana. Ninguna es decorativa: cada fila se mide contra la base de datos y desaparece en cuanto es verdad.",
    ],
    sections: [
      {
        id: "overview",
        heading: "Resumen",
        blocks: [
          { p: "La primera tarjeta trata de poder enviar un presupuesto y cobrar. La segunda, de que el presupuesto sea bueno — las condiciones correctas, los costos correctos, sus propios correos. Haga la primera tarjeta hoy; reparta la segunda a lo largo de la semana." },
        ],
      },
      {
        id: "finish-setting-up",
        heading: "La tarjeta «Termina de configurar FieldQuo»",
        blocks: [
          { p: "Cada fila es un enlace a la pantalla que la completa, marcada automáticamente cuando está hecha. Sus filas se muestran en inglés, sea cual sea su idioma. La tarjeta dice **Faltan unos pasos para tenerlo todo listo** hasta que todas las filas están marcadas, y entonces desaparece para siempre." },
          { bullets: [
            "**Add your logo and brand color** → Configuración → Marca. Hecha en cuanto se sube un logotipo. Vea [[set-up-your-branding|Configure su marca]].",
            "**Complete your business address and phone** → Configuración de la empresa. Hecha cuando el teléfono, la dirección, la ciudad y la provincia están completos.",
            "**Choose the services you offer** → Servicios y precios. Hecha cuando al menos un tipo de presupuesto está activado.",
            "**Set your pricing for at least one service** → Servicios y precios. Hecha cuando un tipo de presupuesto activado tiene una tarifa.",
            "**Connect Stripe to accept client payments** → Pagos. Hecha cuando Stripe confirma que los cobros están habilitados. Vea [[connect-stripe-and-get-verified|Conectar Stripe y verificarse]].",
            "**Invite your team** → Gestionar equipo. Hecha cuando alguien más que usted ha sido incorporado. Esta fila no aparece si le dijo a Gestionar equipo que trabaja solo.",
            "**Add your tax registration number** → Configuración de la empresa. Hecha cuando el número está ingresado, o cuando indicó que su empresa no está registrada para ello.",
          ] },
          { note: "Las filas solo se retiran, nunca se descartan. Si no puede terminar una — un taller de una sola persona con la fila del equipo — dígalo en la pantalla a la que apunta la fila, y la fila deja de aplicar." },
        ],
      },
      {
        id: "additional-set-up-steps",
        heading: "La tarjeta «Pasos de configuración adicionales»",
        blocks: [
          { p: "Diez filas más, mostradas a propietarios, administradores, despachadores y gerentes, cada una con un botón **Hecho, ocultar**. Una fila también desaparece sola cuando la base de datos dice que está hecha. La tarjeta se abre sola mientras quedan tres filas o más, y se pliega cuando quedan menos." },
          { bullets: [
            "**Ingresa tus gastos generales** — costos fijos, salarios, deudas y activos, para poder calcular el precio de equilibrio de un trabajo. [[overhead-and-your-minimum-price|Gastos generales]].",
            "**Configura tu calendario de pagos** — un anticipo y etapas de pago en la Configuración de la empresa. [[deposits-and-payment-schedules|Calendarios de pago]].",
            "**Revisa el proceso del trabajo en tus cotizaciones** — el texto bajo cada tipo de presupuesto en Servicios y precios.",
            "**Agrega créditos de IA** — para el recepcionista telefónico y las imágenes de IA; FieldQuo IA en sí está incluido. [[ai-credit-and-phone-credit|Crédito de IA]].",
            "**Activa las cotizaciones instantáneas** — los propietarios obtienen una estimación inicial desde su sitio web. [[instant-quotes-on-your-website|Cotizaciones instantáneas]].",
            "**Revisa tu disponibilidad para reservas** — las horas reservables en su página de reservas. [[working-hours-and-bookable-hours|Sus horas]].",
            "**Revisa los costos y las recetas de materiales** — lo que un trabajo le cuesta en materiales. [[cost-and-margin-on-a-quote|Costo y margen]].",
            "**Revisa tus extras** — los adicionales que un cliente puede aceptar en un presupuesto. [[upsell-add-ons|Extras]].",
            "**Revisa tus correos** — su propio dominio, una plantilla editada, o la sección de referencias del correo del presupuesto. [[email-templates|Plantillas de correo]].",
            "**Importa trabajos anteriores** — trabajos hechos y cobrados antes de FieldQuo, para que los números del año estén completos. [[import-past-jobs|Importar trabajos anteriores]].",
          ] },
        ],
      },
      {
        id: "a-sensible-order",
        heading: "Un orden sensato para el primer día",
        blocks: [
          { steps: [
            "Abra **Configuración → Configuración de la empresa** y termine la dirección, el teléfono, el horario de apertura y la configuración de impuestos. [[company-settings-basics|Lo básico de la configuración de la empresa]].",
            "Abra **Marca**, suba el logotipo y elija el color de marca. Cada documento lo llevará desde ahora.",
            "Abra **Servicios y precios**, active lo que vende y ponga una tarifa en al menos un servicio.",
            "Abra **Pagos** y conecte Stripe, y luego complete lo que Stripe le pida.",
            "Importe sus clientes desde un CSV, para que el primer presupuesto vaya a un cliente que ya existe. [[import-clients-from-a-csv|Importar clientes]].",
            "Envíese un presupuesto de prueba. Lo que llega es exactamente lo que recibe un cliente.",
          ] },
        ],
      },
      {
        id: "who-sees-the-cards",
        heading: "Quién ve las tarjetas",
        blocks: [
          { p: "La tarjeta **Termina de configurar FieldQuo** aparece en el panel de todos mientras está incompleta, porque sus filas son hechos sobre la empresa. La tarjeta **Pasos de configuración adicionales** se muestra solo a quienes pueden administrar la empresa — propietarios, administradores, despachadores y gerentes — porque cada una de sus filas abre una pantalla de configuración que un miembro de la cuadrilla o un estimador no puede cambiar." },
        ],
      },
    ],
    faq: [
      { q: "¿Puedo ocultar la primera tarjeta?", a: "No. Sus filas se retiran cuando están hechas, o cuando usted indica en la pantalla a la que apuntan que el punto no aplica — por ejemplo, que trabaja solo." },
      { q: "Oculté un paso por error.", a: "Ocultar vale para toda la empresa y no hay botón para deshacerlo. La pantalla a la que apuntaba el paso sigue en el menú de Configuración; el trabajo es el mismo." },
      { q: "¿Por qué no tengo la fila «invita a tu equipo»?", a: "Porque le dijo a Gestionar equipo que trabaja solo. La fila vuelve, ya marcada, el día en que alguien es invitado." },
    ],
  },

  "the-sidebar-and-where-everything-is": {
    title: "El menú lateral, y dónde está todo",
    summary:
      "Inicio, cinco grupos, FieldQuo IA, Ayuda, Plan y Configuración — cada fila del menú principal y del menú de Configuración, y por qué a algunas personas les faltan filas.",
    updated: "2026-09-12",
    intro: [
      "La oficina cabe en un solo menú lateral. Aprenda su forma una vez y sabrá dónde está todo: Inicio arriba, cinco grupos en el orden en que avanza el trabajo, y las herramientas — FieldQuo IA, Ayuda, Plan, Configuración — bajo una línea al final.",
      "En un teléfono, el mismo menú es un cajón detrás del botón de menú, y las cuatro pantallas de la cadena más el Chat van en una barra al pie de la pantalla.",
    ],
    sections: [
      {
        id: "overview",
        heading: "Resumen",
        blocks: [
          { p: "Sobre el menú hay un botón **Crear** — un atajo para empezar un Cliente, un Prospecto, una Cotización, un Trabajo o una Factura — y una caja **Buscar en el menú** que encuentra cualquier fila escribiendo su nombre, incluidas las del final. Luego **Inicio**, el panel. Cada encabezado de grupo salvo **Trabajo** se pliega y se despliega — Trabajo se queda abierto porque es la cadena; los cinco están abiertos la primera vez que inicia sesión, y FieldQuo recuerda lo que usted pliega." },
        ],
      },
      {
        id: "the-five-groups",
        heading: "Los cinco grupos, de arriba abajo",
        blocks: [
          { table: {
            head: ["Grupo", "Filas"],
            rows: [
              ["**Trabajo**", "Prospectos · Cotizaciones · Revisiones de presupuesto · Trabajos · Facturas · Planes de servicio · Calendario · Tareas"],
              ["**Personas**", "Clientes · Equipos del cliente · Chat · Tu equipo · Subcontratistas · Asignar turnos · Calendario del equipo · Reloj de tiempo · Hojas de tiempo · Ausencias · Seguridad"],
              ["**Finanzas**", "Nómina · Gastos · Compras · Vehículos"],
              ["**Análisis**", "Análisis · KPI"],
              ["**Crecer**", "Marketing · Diseñador · Embudos · Recepcionista · Bandeja del equipo · Mensajes · Recomienda y gana"],
            ],
          } },
          { figure: "live:app", caption: "Inicio — el menú con Crear, Buscar en el menú, Inicio y los cinco grupos, el panel al lado." },
          { p: "Bajo la línea: **FieldQuo IA**, y luego **Ayuda**, **Plan** y **Configuración**, y un selector **Apariencia** para el modo claro, oscuro o del sistema. El pie del menú lleva su nombre — que abre Cuenta y facturación si usted es propietario o administrador —, la insignia **Trial started · N days left** durante el mes gratis, **Cerrar sesión**, y el botón que contrae el menú a sus íconos." },
        ],
      },
      {
        id: "the-settings-menu",
        heading: "El menú de Configuración",
        blocks: [
          { p: "**Configuración** abre un segundo menú y cae en la Configuración de la empresa. Tiene ocho grupos, cerrados por defecto para leerse como un índice, con el grupo en el que usted está abierto, y una caja **Buscar ajustes** arriba." },
          { bullets: [
            "**Cuenta** — Cuenta y facturación · Recomienda y gana · Migración de datos · Novedades del producto",
            "**Negocio** — Configuración de la empresa · Marca · Idioma · Registro de actividad",
            "**Equipo y horarios** — Gestionar equipo · Disponibilidad · Políticas de ausencias · Página de reservas · Zonas de trabajo",
            "**Servicios y precios** — Productos y servicios · Servicios y precios · Costos de materiales · Precios de gabinetes · Gastos generales · Campos personalizados",
            "**Documentos y plantillas** — Correo de presupuesto · Plantillas de correo · Plantillas PDF · Traducciones · Listas de verificación · Etiquetas de fotos de trabajo",
            "**Mensajería y alertas** — Mensajes de clientes · Seguimientos · Notificaciones · Dominio de correo",
            "**Cobros** — Pagos · Meta Ads · Control de gastos · Crédito de IA · Nómina",
            "**De cara al cliente** — Tu sitio web · Cotizaciones instantáneas · Comparte tus enlaces · Enlace para la bio · Recepcionista telefónico · Empleado de IA · Reseñas",
          ] },
          { figure: "live:app-settings", caption: "Configuración — los ocho grupos a la izquierda, la Configuración de la empresa abierta." },
        ],
      },
      {
        id: "on-a-phone",
        heading: "En un teléfono",
        blocks: [
          { p: "Por debajo del ancho de una laptop, el menú se vuelve un cajón: el botón de menú arriba lo abre, y el logotipo arriba lleva a Inicio. Una barra al pie de la pantalla lleva **Prospectos**, **Cotizaciones**, **Trabajos**, **Facturas** y **Chat**, y una pestaña **Más** que abre el mismo cajón — no un segundo menú. Vea [[using-fieldquo-on-your-phone|Usar FieldQuo en su teléfono]]." },
        ],
      },
      {
        id: "rows-you-may-not-see",
        heading: "Filas que quizá no vea",
        blocks: [
          { p: "Una fila que falta no es una falla. El menú oculta lo que el nivel de acceso de la persona conectada no permite, y la página detrás de una fila oculta también la rechaza — ocultar es una cortesía, el rechazo es la seguridad." },
          { bullets: [
            "**Cotizaciones, Trabajos, Facturas, Prospectos** exigen al menos ver esa área. La cuadrilla solo puede ver los trabajos, así que el grupo Trabajo de un miembro de la cuadrilla se reduce a Trabajos, Calendario y Tareas.",
            "**Clientes, Equipos del cliente, Recepcionista** exigen la vista completa de las fichas de clientes. **Análisis** exige el interruptor de precios; **KPI** exige el costeo de trabajos.",
            "**Tu equipo, Calendario del equipo, Revisiones de presupuesto, Subcontratistas, Vehículos, Marketing, Diseñador, Embudos** son para propietarios, administradores, despachadores y gerentes. **Plan** y **Recomienda y gana** son solo para propietarios y administradores.",
            "**Precios de gabinetes** y **Costos de materiales** aparecen solo para los oficios que cotizan así. Todas las reglas están en [[access-levels-overview|Los niveles de acceso]] y [[the-settings-menu|El menú de Configuración]].",
          ] },
        ],
      },
    ],
    faq: [
      { q: "¿Dónde están los mensajes de texto y de Facebook de mis clientes?", a: "En Crecer → Mensajes. Bandeja del equipo, justo al lado, es donde caen las fotos que envía por mensaje su propia cuadrilla." },
      { q: "¿Por qué una fila que busco no está en esta lista?", a: "Escríbala en Buscar en el menú. Si nada coincide, está oculta para su nivel de acceso — pregunte a un propietario o administrador." },
      { q: "¿Dónde cambio de plan?", a: "En Plan, al final del menú — la misma pantalla que Configuración → Cuenta y facturación. Solo propietarios y administradores." },
    ],
  },

  "the-dashboard": {
    title: "El panel: lo que está pendiente de usted",
    summary:
      "Inicio se abre con lo que necesita a una persona hoy, luego los ingresos del mes, cuatro recuadros y el detalle debajo — cada cifra se muestra solo cuando se conoce.",
    updated: "2026-09-12",
    intro: [
      "**Panel — Esto es lo que pasa con tu negocio.** La página responde primero una pregunta — qué está pendiente de usted hoy —, luego muestra la cifra de dinero, cuatro recuadros de apoyo, y todo lo demás bajo una línea llamada **El detalle**.",
      "Una cifra que no se conoce no se muestra. Un miembro sin el interruptor de precios no tiene recuadro de ingresos en lugar de un recuadro en cero, porque «$0 este mes» es una afirmación sobre el negocio, no un espacio vacío.",
    ],
    sections: [
      {
        id: "overview",
        heading: "Resumen",
        blocks: [
          { p: "Cada número de la página viene de las mismas fuentes que las listas de Facturas y Cotizaciones — nada se calcula dos veces. Los tres botones bajo los recuadros son **+ Nuevo presupuesto**, **Ver clientes** y **Programar cita**; el primero aparece solo para alguien que puede crear presupuestos." },
        ],
      },
      {
        id: "waiting-on-you",
        heading: "Pendientes de ti",
        blocks: [
          { p: "El primer bloque, sobre todo lo demás, contiene el único contenido de la página que espera al lector. Desaparece solo cuando no hay nada, para que a una empresa tranquila no se le acuse de un atraso que no tiene." },
          { bullets: [
            "**Las facturas vencidas**, por cliente y monto, hasta cinco, cada una con **N días de retraso** y un botón **Reclamar el pago** que le envía al cliente una solicitud de pago por correo en ese momento. Más de cinco muestra **N más vencidas**, que lleva a Facturas.",
            "**N a la espera de que apruebes el precio** — cotizaciones instantáneas que necesitan a una persona antes de poder enviarse. Abre Revisiones de presupuesto.",
            "**N de tu recepcionista — nada hecho todavía** — llamadas que tomó el recepcionista telefónico y que nadie ha atendido. Abre Recepcionista.",
            "La próxima cita que agendó el recepcionista, si la hay. Abre Calendario.",
          ] },
          { note: "Una factura sin fecha de vencimiento no está vencida y nunca aparece aquí. El bloque dice lo que está atrasado, no lo que se debe." },
        ],
      },
      {
        id: "the-figures",
        heading: "Ingresos este mes, y los cuatro recuadros",
        blocks: [
          { figure: "live:app", caption: "Inicio — Pendientes de ti, luego Ingresos este mes con su línea de tendencia, y luego los cuatro recuadros." },
          { p: "**Ingresos este mes** es **el total de las facturas marcadas como pagadas este mes**; la línea pequeña al lado dibuja el dinero que realmente entró, mes a mes, y el enlace **Tendencia** abre esa gráfica. Una frase debajo compara los dos últimos meses completos — nunca un mes a medias contra uno entero." },
          { table: {
            head: ["Recuadro", "Qué cuenta"],
            rows: [
              ["**Cotizaciones enviadas este mes**", "Presupuestos creados este mes que ya salieron — enviados, y luego aceptados o rechazados —, con cuántos más o menos que el mes pasado."],
              ["**Tasa de conversión**", "El % de presupuestos enviados que los clientes aceptaron, mostrado como «aceptados de enviados»."],
              ["**Dinero que te deben**", "El saldo de cada factura sin pagar, y cuánto de eso está vencido."],
              ["**Próximas visitas**", "Las visitas por venir en el calendario."],
            ],
          } },
          { note: "Una tasa de conversión necesita **10 presupuestos enviados en el mes** antes de imprimirse. Por debajo, el recuadro muestra solo los conteos — un 50 % sobre dos presupuestos es un número con el que usted actuaría y no debería." },
        ],
      },
      {
        id: "the-detail",
        heading: "El detalle",
        blocks: [
          { bullets: [
            "**Dinero recibido** — una gráfica de barras de los pagos por el mes en que se recibieron, con 3, 6 o 12 meses. La leyenda aclara que es una medida distinta del recuadro de ingresos.",
            "**Dinero que te deben** — la escalera de cuentas por cobrar: aún no vence, 1–30, 31–60, 61–90 y 90+ días, y luego cada factura pendiente con su contacto, su último recordatorio y un botón Reclamar el pago. Una línea dice si hay un recordatorio automático de vencimiento configurado, con **Configurar uno** o **Cambiarlo**.",
            "**Revenue goal** — una meta anual y si usted va adelantado o atrasado respecto al ritmo. La fijan propietarios y administradores. [[the-revenue-goal|La meta de ingresos]].",
            "Las reservas retenidas por una tarifa de visita que aún no ha llegado, y un aviso de **Migración de datos** cuando FieldQuo le ha cotizado una migración.",
            "**Cotizaciones recientes** y **Próximas citas**, cada uno con **Ver todo**.",
          ] },
          { p: "Las dos tarjetas de configuración — **Termina de configurar FieldQuo** y **Pasos de configuración adicionales** — se sitúan entre el primer bloque y la cifra de ingresos hasta que están completas. Vea [[your-first-day-setup-checklist|Su primer día]]." },
        ],
      },
      {
        id: "who-sees-what",
        heading: "Quién ve qué",
        blocks: [
          { p: "Los ingresos, las cotizaciones enviadas, la conversión y el dinero adeudado exigen el interruptor **Ver precios**; un miembro de la cuadrilla ve las Próximas visitas y sus propias citas. Reclamar el pago exige permiso para editar facturas. La meta de ingresos la pueden fijar propietarios y administradores; todos los demás que ven precios la consultan. Todo lo demás en la página sigue las mismas reglas que la lista a la que lleva. Vea [[the-dashboard-in-detail|El panel en detalle]]." },
        ],
      },
    ],
    faq: [
      { q: "¿Por qué Ingresos este mes no coincide con Dinero recibido?", a: "Responden preguntas distintas. El recuadro suma las facturas marcadas como pagadas este mes; la gráfica cuenta los pagos por el mes en que llegaron. Una factura de diciembre pagada en enero está en la barra de enero." },
      { q: "¿Por qué no hay porcentaje en mi recuadro de conversión?", a: "Se enviaron menos de 10 presupuestos este mes. En su lugar se muestran los conteos; el porcentaje aparece cuando la muestra es lo bastante grande para significar algo." },
      { q: "¿Por qué falta un recuadro por completo?", a: "La cifra no se conoce — o su nivel de acceso no incluye precios, o la consulta falló y se ofrece un botón Reintentar sobre los recuadros. Nunca se muestra un cero en su lugar." },
    ],
  },

  "company-settings-basics": {
    title: "Lo básico de la configuración de la empresa",
    summary:
      "La primera pantalla después del registro: sus datos, horario de apertura, impuestos, condiciones de pago y preferencias regionales, y lo que cada uno cambia en sus documentos.",
    updated: "2026-09-12",
    intro: [
      "**Configuración de la empresa — Los datos de tu empresa, horarios, impuestos y preferencias regionales.** Es donde cae la fila Configuración, y contiene todo lo que el formulario de registro no pidió: la dirección tal como se imprime en un presupuesto, el número fiscal al pie, el horario que muestra su sitio web, y las condiciones con las que empieza cada presupuesto nuevo.",
    ],
    sections: [
      {
        id: "overview",
        heading: "Resumen",
        blocks: [
          { p: "La página es una columna de tarjetas. La mayoría se guardan juntas con el botón **Actualizar ajustes** al final; tres — el calendario de pagos, el horario de apertura y la disponibilidad para reservas — tienen su propio guardado, porque cada una escribe una cosa distinta." },
        ],
      },
      {
        id: "what-is-on-the-screen",
        heading: "Qué hay en la pantalla",
        blocks: [
          { table: {
            head: ["Tarjeta", "Qué contiene"],
            rows: [
              ["**Alcance del trabajo y condiciones**", "El **Alcance del trabajo por defecto** que se copia en cada presupuesto nuevo, con plantillas de oficio para partir, y la línea **Condiciones de pago**."],
              ["**Calendario de pagos**", "Etapas ligadas al trabajo — un anticipo al enviar la factura, una parte al inicio, a la mitad o al final. Desactivado hasta que agregue una etapa."],
              ["**Sector y tipos de presupuesto**", "Los oficios que declaró y los tipos de presupuesto que eso habilitó, con **Gestionar** para cambiarlos en Servicios y precios."],
              ["**Datos de la empresa**", "Nombre de la empresa, número de teléfono, correo electrónico, URL del sitio web, su subdominio, dirección, código postal y país."],
              ["**Horario de apertura**", "Cuándo está abierto el negocio — se muestra en su sitio web y se usa para el horario en los resultados de búsqueda de Google."],
              ["**Disponibilidad para reservas**", "Qué horarios se pueden reservar en línea, por día. Separado del horario de apertura a propósito."],
              ["**Configuración de impuestos**", "Nombre y número del ID fiscal, las **Tasas de impuestos** con una predeterminada, y si aplicar automáticamente la tasa local del cliente."],
              ["**Comparativa del sector**", "Un interruptor para compartir sus cifras anónimas y desbloquear la comparación en Análisis."],
              ["**Configuración regional**", "Moneda de facturación, zona horaria, formato de fecha y primer día de la semana."],
            ],
          } },
          { figure: "live:app-settings-company", caption: "Configuración de la empresa — las tarjetas de arriba abajo, Actualizar ajustes al final." },
        ],
      },
      {
        id: "how-to-save",
        heading: "Cómo completarla",
        blocks: [
          { steps: [
            "Escriba los datos, las condiciones, los impuestos y las preferencias regionales, y luego pulse **Actualizar ajustes** al final. **Guardado** aparece junto al botón.",
            "En **Horario de apertura**, defina cada día o márquelo **Cerrado**, use **Aplicar el horario del {day} a todos los días abiertos** para copiar un día, y pulse **Guardar el horario de apertura** — esta tarjeta se guarda por su cuenta.",
            "En **Disponibilidad para reservas**, pulse **Editar** para definir las horas reservables; la tarjeta muestra la franja de cada día o **Cerrado**.",
            "En **Calendario de pagos**, pulse **Agregar una etapa**, nómbrela, elija cuándo vence y su porcentaje; las etapas tienen que sumar exactamente 100 % antes de que **Guardar calendario** funcione.",
          ] },
        ],
      },
      {
        id: "what-each-setting-changes",
        heading: "Qué cambia cada ajuste",
        blocks: [
          { bullets: [
            "El **País** se completa automáticamente a partir de la dirección, y fija la **Moneda de facturación** y la jurisdicción fiscal a la que recurre un presupuesto. Marque **Atiendo a clientes fuera de mi país** para facturar en otras monedas.",
            "El **Nombre del ID fiscal** y el **Número de ID fiscal** se imprimen al pie de cada presupuesto y factura. FieldQuo imprime lo que usted escribe; no lo registra ni presenta nada por usted.",
            "**Aplicar automáticamente la tasa de impuesto local del cliente** compara la provincia del cliente con sus tasas; si no hay coincidencia, se usa su tasa predeterminada y el presupuesto lo indica.",
            "El **Formato de fecha** aplica solo a sus propias pantallas — los documentos del cliente siguen el idioma del cliente. El **Primer día de la semana** cambia cómo empiezan los calendarios y las cuadrículas de horas.",
            "Un **Calendario de pagos** guardado genera el texto de las condiciones de pago, para que el documento siempre coincida con lo que de verdad se factura; **Desactivar — volver al texto libre** borra todas las etapas.",
            "El **Horario de apertura** es un hecho a nivel de empresa; la **Disponibilidad** es por persona. La oficina puede estar abierta un día en que nadie esté libre para una visita.",
            "El interruptor de la **Comparativa del sector** agrupa sus cifras con las de otras empresas, nunca mostradas individualmente, y se puede desactivar cuando quiera.",
          ] },
          { warning: "**Todos los días marcados como cerrados** significa que no aparecerá ningún horario en su sitio web ni en los resultados de búsqueda. Una semana parcial se publica como semana parcial — FieldQuo nunca inventa un lunes a viernes por usted." },
        ],
      },
      {
        id: "who-can-edit",
        heading: "Quién puede editarla",
        blocks: [
          { p: "Propietarios, administradores, despachadores y gerentes pueden cambiar cada tarjeta. Los estimadores y la cuadrilla abren la misma página en solo lectura, bajo el título **Estos son los datos de tu empresa tal como los ven los clientes**. Vea [[settings-company|Configuración de la empresa]] para la referencia completa, y [[opening-hours|Horario de apertura]] y [[tax-settings|Configuración de impuestos]] para las dos tarjetas con más consecuencias." },
        ],
      },
    ],
    faq: [
      { q: "Cambié la dirección. ¿Por qué no cambió la moneda?", a: "La moneda sigue al país, y el país se lee de la dirección. Si el país cambió, la moneda cambió con él; si solo cambió la calle, nada del dinero se mueve." },
      { q: "¿Dónde defino mis propias horas de trabajo?", a: "En Configuración → Disponibilidad, por persona. La Configuración de la empresa contiene el horario de apertura que ve el público." },
      { q: "¿Por qué la casilla de condiciones de pago no me deja escribir?", a: "Hay un calendario de pagos activado, y las condiciones se generan a partir de él. Desactive el calendario para volver a escribir texto libre." },
    ],
  },

  "set-up-your-branding": {
    title: "Configure su marca",
    summary:
      "Suba el logotipo, elija un color principal, y cada presupuesto, factura, correo, página de reservas y página del sitio lo lleva — con el contraste medido, nunca dentro de la aplicación.",
    updated: "2026-09-12",
    intro: [
      "**Marca — Tu logotipo y color de marca aparecen en cada presupuesto, factura y correo que ven tus clientes.** Una pantalla, un guardado, y desde entonces un propietario que lee su presupuesto ve a su empresa, no a un software.",
      "El color no se aplica a ciegas. Cada par de texto y fondo en una página del lado del cliente se calcula a partir de su único código de color y se mide su contraste, para que un amarillo, un blanco o un gris medio se impriman igual de legibles.",
    ],
    sections: [
      {
        id: "overview",
        heading: "Resumen",
        blocks: [
          { p: "Tres tarjetas y una vista previa. Solo el color principal es obligatorio; los demás siguen valores predeterminados sensatos derivados de él. Nada aquí cambia las pantallas de su equipo — la oficina se mantiene neutra para que un color intenso nunca dificulte el trabajo." },
        ],
      },
      {
        id: "what-is-on-the-screen",
        heading: "Qué hay en la pantalla",
        blocks: [
          { bullets: [
            "**Logotipo** — el logotipo actual o **Sin logotipo**, y **Subir logotipo** / **Reemplazar logotipo**. PNG, JPG, WebP o SVG, hasta 8 MB.",
            "**Colores de marca** — **Principal** y **Secundario**, cada uno con seis muestras predefinidas, un selector de color personalizado y un enlace **Restablecer** una vez definido.",
            "**Cómo se verán tus documentos** — el encabezado de un presupuesto en vista previa en **Claro** y en **Oscuro**.",
            "**Neutro** — el color de la barra del encabezado del correo, y una **Vista previa** de aproximadamente cómo se verá la parte superior de sus correos con su logotipo y el nombre de su empresa.",
          ] },
          { figure: "live:app-settings-branding", caption: "Marca — la tarjeta Logotipo, los Colores de marca, la vista previa del documento en claro y en oscuro." },
        ],
      },
      {
        id: "how-to",
        heading: "Cómo configurarla",
        blocks: [
          { steps: [
            "Abra **Configuración → Marca**.",
            "Pulse **Subir logotipo** y elija el archivo. Se sube de inmediato y se muestra en la tarjeta; todavía no se guarda nada en sus documentos.",
            "Elija un color **Principal** — una muestra, o el selector para su código exacto.",
            "Si quiere, elija un **Secundario** y un **Neutro**. Déjelos sin definir para heredar del principal y del encabezado oscuro predeterminado.",
            "Pulse **Guardar marca**. **Guardado ✓** lo confirma, y el próximo presupuesto que abra ya la lleva.",
          ] },
          { warning: "Si la página no puede cargar su marca actual, se niega a mostrar el formulario, con un botón **Reintentar** — así una carga fallida nunca puede guardar colores predeterminados encima de los suyos." },
        ],
      },
      {
        id: "what-each-setting-changes",
        heading: "Qué cambia cada ajuste",
        blocks: [
          { table: {
            head: ["Ajuste", "Dónde aparece"],
            rows: [
              ["**Logotipo**", "El encabezado de cada presupuesto, factura y PDF; el encabezado del correo; la página de reservas; su sitio web; el portal del cliente."],
              ["**Principal**", "Botones, barras de progreso y su nombre en el encabezado del correo; el acento de cada página del lado del cliente."],
              ["**Secundario**", "Acentos de apoyo, como los títulos de sección en listas detalladas. Por defecto usa el principal."],
              ["**Neutro**", "La barra del encabezado del correo. Por defecto un tono oscuro, que se ve más premium que un color saturado."],
            ],
          } },
          { note: "Los colores nunca aparecen dentro de la aplicación. Las pantallas de su equipo siguen iguales, elija lo que elija." },
        ],
      },
      {
        id: "contrast",
        heading: "Por qué un logotipo amarillo se imprime igual de legible",
        blocks: [
          { p: "Los contratistas eligen amarillo, blanco, negro y gris medio, y la regla ingenua — «color oscuro, texto blanco» — falla con todos. FieldQuo no adivina: mide cada par de texto y fondo derivado de su código y elige colores de tinta y de fondo que superan un contraste de 4,5:1. Las vistas previas Claro y Oscuro de esta página son el mismo cálculo, así que lo que usted ve es lo que recibe el cliente. El detalle completo: [[settings-branding|Marca]] y [[nothing-says-fieldquo|Nada dice FieldQuo]]." },
        ],
      },
      {
        id: "who-can-edit",
        heading: "Quién puede editarla",
        blocks: [
          { p: "Propietarios, administradores, despachadores y gerentes. El servidor rechaza el guardado a cualquier otra persona, muestre lo que muestre la pantalla." },
        ],
      },
    ],
    faq: [
      { q: "La subida de mi logotipo falla.", a: "Revise el formato — PNG, JPG, WebP o SVG — y el tamaño, 8 MB como máximo. Un archivo más grande se rechaza antes de almacenarse." },
      { q: "¿El color de marca cambia la línea «De» de los correos?", a: "No. La línea «De» es el nombre de su empresa, y su propia dirección una vez verificado un dominio — vea [[send-from-your-own-domain|Enviar desde su propio dominio]]." },
      { q: "¿Puedo ver un presupuesto real con los colores nuevos?", a: "Sí — guarde, y luego abra la página del cliente de cualquier presupuesto. La vista previa de esta pantalla es el mismo cálculo, pero un documento real es la prueba honesta." },
    ],
  },

  "choose-your-language": {
    title: "Elija su idioma, y el de su empresa",
    summary:
      "Su idioma es aquel en el que lee la aplicación; el predeterminado de la empresa es el que heredan sus compañeros y sus clientes. Un documento conserva el idioma en que se creó.",
    updated: "2026-09-12",
    intro: [
      "Hay dos ajustes en la pantalla **Idioma**, y significan cosas distintas. **Tu idioma** es personal — aquel en el que usted lee la oficina. **Predeterminado de la empresa** es el que hereda todo el que no ha elegido, y el idioma en que sale un presupuesto o una factura cuando el cliente no tiene uno propio.",
      "Ninguno de los dos toca un documento que ya existe. Un presupuesto conserva el idioma en que se creó, para siempre — un PDF firmado tiene que seguir diciendo lo que decía.",
    ],
    sections: [
      {
        id: "overview",
        heading: "Resumen",
        blocks: [
          { p: "Se ofrecen ocho idiomas: inglés, francés, español, ucraniano, punyabí, tagalo, alemán e italiano. Cada fila indica cuánto de la interfaz está traducido; el resto aparece en inglés. Un documento, un PDF o un correo para un cliente se traduce por documento, así que cada uno de los ocho está completo ahí." },
        ],
      },
      {
        id: "your-language",
        heading: "Tu idioma",
        blocks: [
          { steps: [
            "Abra **Configuración → Idioma**.",
            "Bajo **Tu idioma**, pulse un idioma — o **Usar el predeterminado de la empresa** para seguir lo que use la empresa.",
            "Se guarda en el momento en que pulsa; la interfaz cambia, y **Mostrando ahora:** nombra el idioma en vigor.",
          ] },
          { figure: "live:app-settings-language", caption: "Idioma — Tu idioma con la cobertura en cada fila, y la tarjeta Predeterminado de la empresa debajo." },
        ],
      },
      {
        id: "company-default",
        heading: "Predeterminado de la empresa",
        blocks: [
          { p: "La segunda tarjeta, **Predeterminado de la empresa**, **se usa para los miembros del equipo que no han elegido idioma, y para presupuestos y facturas de clientes que no tienen uno**. Propietarios, administradores, despachadores y gerentes pueden pulsar un idioma aquí; todos los demás la ven como un hecho, bajo el título **Este es el idioma que reciben los nuevos miembros del equipo y los clientes que no tienen uno propio**." },
          { note: "**Cambiar esto afecta a todos los que no han definido su propio idioma. No cambia los presupuestos ya enviados — conservan el idioma con que se enviaron.**" },
        ],
      },
      {
        id: "what-the-labels-mean",
        heading: "Qué significan las etiquetas de cobertura",
        blocks: [
          { table: {
            head: ["Etiqueta", "Significado"],
            rows: [
              ["**Interfaz 100 %**", "Cada pantalla está traducida y una persona que habla el idioma la ha revisado. Inglés y francés hoy."],
              ["**Interfaz 100 % · por revisar**", "Cada texto está traducido pero ningún hablante nativo lo ha revisado todavía. Español, alemán e italiano hoy."],
              ["**Interfaz N %**", "Parte de la interfaz está traducida; el resto se muestra en inglés. Ucraniano, punyabí y tagalo hoy."],
            ],
          } },
        ],
      },
      {
        id: "your-clients",
        heading: "Qué reciben sus clientes",
        blocks: [
          { p: "El idioma de un cliente vive en su ficha y rige todo lo que recibe: el presupuesto, la factura, el PDF, el correo que lo acompaña, los mensajes de texto. Cuando un cliente no tiene uno, aplica el predeterminado de la empresa. Defínalo una vez en el cliente — vea [[a-clients-language|El idioma de un cliente]] — y lea [[quote-language|Un presupuesto conserva su idioma]] para saber qué pasa con un documento después de enviarse. La redacción de sus propios servicios en otro idioma se borra y se revisa en [[settings-translations|Traducciones]]." },
        ],
      },
    ],
    faq: [
      { q: "Cambié a español y algunas pantallas siguen en inglés.", a: "El español está traducido por completo pero marcado por revisar; un texto que falte se muestra en inglés en lugar de dejar un espacio en blanco. La etiqueta de la fila es la cobertura honesta." },
      { q: "Si cambio el predeterminado de la empresa, ¿cambiarán los presupuestos antiguos?", a: "No. Un documento conserva el idioma en que se creó. Solo los documentos nuevos, y los compañeros que nunca eligieron, siguen el nuevo predeterminado." },
      { q: "¿Un miembro de la cuadrilla puede cambiar su propio idioma?", a: "Sí. Tu idioma es personal y está abierto a cada miembro; solo el predeterminado de la empresa está restringido." },
    ],
  },

  "import-clients-from-a-csv": {
    title: "Importar clientes desde un CSV",
    summary:
      "Cargue la lista de clientes de su sistema anterior de una sola vez — las columnas que FieldQuo lee, lo que omite, y lo que nunca deduplica.",
    updated: "2026-09-12",
    intro: [
      "**Importar clientes — Sube un CSV exportado de otro sistema.** El archivo se lee en su navegador, se le muestran las tres primeras filas, y una sola pulsación las escribe todas. Cada fila se convierte en una ficha de cliente exactamente como si usted la hubiera escrito.",
    ],
    sections: [
      {
        id: "overview",
        heading: "Resumen",
        blocks: [
          { p: "El importador toma solo nombres y datos de contacto — sin trabajos, sin facturas, sin historial. Para trabajos ya hechos y cobrados, use [[import-past-jobs|Importar trabajos anteriores]]; para un archivo completo, [[the-data-migration-service|El servicio de migración de datos]]." },
        ],
      },
      {
        id: "prepare-the-file",
        heading: "Prepare el archivo",
        blocks: [
          { p: "Exporte un CSV desde donde esté la lista hoy. FieldQuo reconoce los nombres de columna sin importar las mayúsculas, y acepta las variantes comunes." },
          { table: {
            head: ["Columna", "Encabezados aceptados", "Obligatoria"],
            rows: [
              ["Nombre", "name, Name, Full Name", "Sí — una fila sin nombre se omite"],
              ["Correo", "email, Email", "No, pero una fila con una dirección no entregable se omite"],
              ["Teléfono", "phone, Phone, Phone Number", "No"],
              ["Dirección", "address, Address", "No"],
              ["Ciudad", "city, City", "No"],
              ["Provincia", "province, Province, State", "No"],
              ["País", "country, Country", "No — se normaliza a un código, o se deja en blanco"],
            ],
          } },
          { tip: "Un cliente empresa con una persona de contacto: ponga la empresa en **name** y añada a la persona en la ficha después — vea [[business-clients-and-contacts|Clientes empresa y contactos]]." },
        ],
      },
      {
        id: "how-to",
        heading: "Cómo importar",
        blocks: [
          { steps: [
            "Abra **Clientes** y pulse **Importar**, junto a **Nuevo cliente**.",
            "Pulse **Haz clic para elegir un archivo CSV** y elija el archivo.",
            "Lea **Se encontraron {count} filas. Vista previa de las 3 primeras:** — cada línea muestra el nombre y el correo o el teléfono, o **sin datos de contacto**.",
            "Pulse **Importar {count} clientes**.",
            "El resultado dice **Se importaron {count} clientes**, con **({count} omitidos — falta un nombre)** y **({count} omitidos — dirección de correo no entregable)** cuando aplican. **Ver clientes** abre la lista.",
          ] },
          { figure: "live:app-clients", caption: "Clientes — cada cliente como una tarjeta, con Importar y Nuevo cliente arriba." },
        ],
      },
      {
        id: "what-happens-to-each-row",
        heading: "Qué pasa con cada fila",
        blocks: [
          { bullets: [
            "Una fila sin nombre no tiene nada que importar y se cuenta como omitida.",
            "Una fila cuya dirección de correo no es entregable se deja fuera y se cuenta aparte, en lugar de importarse con la dirección descartada en silencio — un cliente que parece contactable y no lo es, así es como un presupuesto se envía a ninguna parte. Un correo vacío está bien.",
            "Un país escrito con palabras («Canada», «CAN») se normaliza a su código, o se deja en blanco cuando no se puede leer. Nunca se guarda como texto libre.",
            "**Nada se deduplica.** Importar el mismo archivo dos veces crea cada cliente dos veces. Vea [[duplicate-clients|Clientes duplicados]] para limpiar.",
          ] },
        ],
      },
      {
        id: "who-can-import",
        heading: "Quién puede importar",
        blocks: [
          { p: "Cualquiera cuyo acceso le permita añadir clientes — **View and edit full client and property info** o superior: estimadores, despachadores, gerentes, administradores y el propietario. El botón Importar se ofrece solo a ellos, y la página rechaza a todos los demás antes de que se elija un archivo." },
        ],
      },
    ],
    faq: [
      { q: "¿Puedo importar una hoja de cálculo directamente?", a: "Guárdela primero como CSV. Excel y Google Sheets exportan uno; conserve la fila de encabezados." },
      { q: "¿Importa notas, trabajos o facturas?", a: "No — solo nombre, correo, teléfono y dirección. Los trabajos anteriores tienen su propio importador, y un historial completo es el servicio de migración." },
      { q: "La mitad de mis filas se omitieron por correos incorrectos. ¿Y ahora?", a: "Corrija o vacíe las celdas de correo de esas filas, borre las demás del archivo, e importe de nuevo las filas corregidas. Las filas que ya se importaron no se ven afectadas." },
    ],
  },

  "import-past-jobs": {
    title: "Importar trabajos anteriores desde su sistema anterior",
    summary:
      "Registre los trabajos ganados, hechos y cobrados antes de FieldQuo — uno por uno o un año en un solo CSV — para que los números del año estén completos, sin enviar nada al cliente.",
    updated: "2026-09-12",
    intro: [
      "**Trabajos pasados — Registra los trabajos que hiciste y cobraste antes de usar FieldQuo, para que los números del año estén completos.** La página dice lo importante con sus propias palabras: **Esto es captura de datos: no se envía nada al cliente por correo, mensaje ni llamada, ni ahora ni después.**",
      "Cada trabajo anterior se convierte en un presupuesto, un trabajo terminado y una factura pagada, con las fechas que usted escribe, para que los ingresos, la precisión de las estimaciones y el historial del cliente se lean bien desde el día en que cambió de sistema.",
    ],
    sections: [
      {
        id: "overview",
        heading: "Resumen",
        blocks: [
          { p: "Dos formas de entrar: **Registrar un trabajo pasado**, un formulario, o **O sube un año entero de una vez**, un CSV revisado fila por fila antes de escribir nada. Las dos están en la página que abre **Trabajos anteriores** en la lista de Trabajos, y la fila **Importa trabajos anteriores** de la tarjeta de configuración del panel." },
        ],
      },
      {
        id: "what-is-created",
        heading: "Qué se crea",
        blocks: [
          { p: "Por cada trabajo anterior: el cliente, si es nuevo; un presupuesto marcado como aceptado; un trabajo marcado como terminado; una factura marcada como pagada, con un pago en la fecha que usted dio, en efectivo, cheque, transferencia o tarjeta cobrada en otro sitio; y, si dio costos de mano de obra o materiales, un gasto por cada uno. Cada registro lleva la nota **Entered as a past job**, y cada tarea automática y cada botón de envío los omite." },
        ],
      },
      {
        id: "one-at-a-time",
        heading: "Registrar un trabajo pasado",
        blocks: [
          { steps: [
            "Abra **Trabajos → Trabajos anteriores**.",
            "Bajo **Cliente**, **Elegir un cliente existente** o elija **Cliente nuevo** y escriba el nombre, el correo, el teléfono y la dirección.",
            "Complete el servicio, qué se hizo, las fechas de inicio y fin, el importe antes de impuestos, si **Se cobraron impuestos en este trabajo** (calculados con su tasa en la fecha del trabajo), la fecha de pago y **Pagado con**. El costo de mano de obra, el costo de materiales, la referencia de presupuesto y el número de factura son opcionales.",
            "Pulse **Registrar este trabajo pasado**.",
            "La confirmación dice **Registrado {title} — {total} pagado el {date}**, con **Abrir el trabajo** y, si se creó uno, **Cliente nuevo añadido: {name}**.",
          ] },
          { figure: "live:app-jobs", caption: "Trabajos — la lista con sus chips de estado; Trabajos anteriores está junto a Nuevo trabajo arriba." },
        ],
      },
      {
        id: "a-year-at-once",
        heading: "Subir un año entero de una vez",
        blocks: [
          { p: "**Descargar la plantilla** le da los encabezados exactos. Una fila por trabajo, hasta **500** filas por archivo; la página explica cada columna bajo **Qué significa cada columna**." },
          { table: {
            head: ["Columna obligatoria", "Qué va en ella"],
            rows: [
              ["client_name", "El cliente, emparejado con una ficha existente por sus datos de contacto, o creado."],
              ["description", "En qué consistió el trabajo."],
              ["job_start", "Una fecha escrita AAAA-MM-DD."],
              ["amount_before_tax", "El precio, mayor que cero."],
              ["paid_date", "Cuándo le pagaron — nunca en el futuro, nunca antes de que empezara el trabajo."],
              ["payment_method", "cash, cheque, e_transfer o card_elsewhere."],
            ],
          } },
          { p: "Opcionales: client_email, client_phone, client_address, service, job_end, tax_applied (yes/no), labour_cost, materials_cost, quote_number, invoice_number." },
          { steps: [
            "Pulse **Elegir un archivo CSV**. Cada fila se revisa en el servidor y se muestra con un **Estado**: **Listo**, **Ya registrado**, o los campos por corregir.",
            "Lea el resumen — **listos para registrar**, **ya registrados**, **por corregir**, **clientes nuevos** — y corrija en el archivo lo que se señale.",
            "Pulse **Registrar {n} trabajos pasados**. El resultado dice **{n} trabajos pasados registrados.** y, cuando aplica, **{n} ya estaban registrados y se dejaron como estaban.**",
          ] },
        ],
      },
      {
        id: "duplicates-and-errors",
        heading: "Duplicados y errores",
        blocks: [
          { bullets: [
            "Un trabajo está **Ya registrado** cuando el nombre del cliente, el inicio del trabajo, el importe y la fecha de pago coinciden todos con uno registrado antes. Nunca se registra dos veces — un archivo subido dos veces, o dos pestañas, no pueden duplicar sus ingresos.",
            "**Las filas por corregir se dejan fuera.** Corríjalas en el archivo y súbalo de nuevo; las filas que estaban listas entran sin ellas.",
            "Un archivo de más de 500 filas se corta: **Solo se leyeron las primeras 500 filas. Pon el resto en un segundo archivo.**",
            "Una referencia de presupuesto o un número de factura que usted dé no debe existir ya, y no debe parecerse a un número FieldQuo en uso.",
          ] },
        ],
      },
      {
        id: "who-can-enter",
        heading: "Quién puede registrar trabajos anteriores",
        blocks: [
          { p: "Alguien que pueda crear presupuestos, trabajos y facturas y que vea los precios: despachadores, gerentes, administradores y el propietario. Las filas que crean un cliente nuevo también necesitan el nivel que añade clientes. Un estimador puede escribir presupuestos pero no trabajos ni facturas, así que esta pantalla lo rechaza." },
        ],
      },
    ],
    faq: [
      { q: "¿El cliente recibirá un correo?", a: "No. Ni al registrar, ni por una regla de seguimiento, ni por una solicitud de reseña. La página lo dice y el servidor lo cumple." },
      { q: "¿Los trabajos anteriores cuentan en mi panel y mis informes?", a: "Sí — ese es el punto. Los ingresos, el dinero recibido, la tasa de éxito y el historial del cliente los incluyen todos, con la fecha en que ocurrieron." },
      { q: "Registré uno con el importe equivocado.", a: "Abra el trabajo y su factura desde **Abrir el trabajo** y corríjalos como cualquier otro registro. La clave de duplicado usa el importe, así que volver a registrar la fila corregida crearía un segundo trabajo — edite, no vuelva a importar." },
    ],
  },

  "import-a-quote-from-another-system": {
    title: "Importar un presupuesto de otro sistema",
    summary:
      "FieldQuo no lee un archivo de presupuesto de otro software. Estas son las cuatro formas honestas en que un presupuesto hecho en otro lugar termina en su cuenta, y cuál conviene.",
    updated: "2026-09-12",
    intro: [
      "No hay un botón que tome un presupuesto de Jobber, Housecall Pro o QuickBooks y lo convierta en un presupuesto de FieldQuo. Es deliberado, no un olvido: un presupuesto en FieldQuo se cotiza desde su propia lista de precios en el servidor, y un archivo de otro lugar no trae nada de eso.",
      "Lo que puede hacer depende de qué es el presupuesto: un trabajo ya hecho y cobrado, un presupuesto vigente que todavía debe enviar, un archivo histórico completo, o un presupuesto que otra empresa de FieldQuo le envió.",
    ],
    sections: [
      {
        id: "overview",
        heading: "Resumen",
        blocks: [
          { table: {
            head: ["Lo que usted tiene", "Qué hacer"],
            rows: [
              ["Un presupuesto de un trabajo hecho y cobrado antes de FieldQuo", "Regístrelo como trabajo anterior — un formulario, o un CSV para todo el año. [[import-past-jobs|Importar trabajos anteriores]]."],
              ["Un presupuesto vigente que todavía debe enviar", "Rehágalo en el constructor de presupuestos desde su lista de precios. Diez minutos, y es un presupuesto real de FieldQuo que el cliente puede aprobar en línea."],
              ["Un historial completo — años de presupuestos, facturas y clientes", "El servicio de pago de migración de datos: el personal de FieldQuo lo trae. [[the-data-migration-service|El servicio de migración de datos]]."],
              ["Un presupuesto que otra empresa de FieldQuo le envió, como subcontratista", "Incorpórelo a su propio presupuesto como una línea de costo con margen, desde la página del presupuesto que recibió. [[import-a-subcontractor-quote|Importar el presupuesto de un subcontratista]]."],
            ],
          } },
        ],
      },
      {
        id: "rebuild-a-live-quote",
        heading: "Rehacer un presupuesto vigente",
        blocks: [
          { steps: [
            "Importe primero al cliente si no está registrado — [[import-clients-from-a-csv|Importar clientes desde un CSV]] — para que el presupuesto quede dirigido a una ficha existente.",
            "Abra **Cotizaciones → Nueva cotización**, elija el cliente y el tipo de presupuesto.",
            "Añada las líneas desde su lista de precios, o escríbalas; agrupe por habitación o por alcance si el presupuesto anterior lo hacía.",
            "Revise el idioma antes de guardar — un presupuesto conserva el idioma en que se crea — y luego envíelo. El cliente recibe una página y un PDF con su marca y puede aprobar en línea.",
          ] },
          { figure: "live:app-quotes", caption: "Cotizaciones — la lista con sus chips de estado y Nueva cotización." },
          { tip: "Si el presupuesto anterior ya estaba aprobado y el trabajo está en marcha, cree el presupuesto y márquelo como aprobado, y entonces el trabajo se crea a partir de él — vea [[convert-a-quote-to-a-job|Qué pasa cuando se aprueba un presupuesto]]." },
        ],
      },
      {
        id: "a-quote-from-another-fieldquo-company",
        heading: "Un presupuesto de otra empresa de FieldQuo",
        blocks: [
          { p: "Cuando un subcontratista que usa FieldQuo le envía su presupuesto, la página que usted recibe lleva una tarjeta titulada **Add this to one of your quotes** — mostrada solo a un contratista conectado de otra empresa, nunca a un propietario. Usted elige a cuál de sus presupuestos abiertos añadirlo, un margen de 0, 10, 20 o 30 por ciento o uno personalizado, y si su cliente ve **One line** o **Itemised**. Su cliente nunca ve al subcontratista ni su margen. En su presupuesto aparece bajo **Costos de subcontratistas**, donde puede editar el margen o quitarlo mientras el presupuesto esté abierto." },
        ],
      },
      {
        id: "what-fieldquo-does-not-do",
        heading: "Lo que FieldQuo no hace",
        blocks: [
          { bullets: [
            "No convierte un PDF, un archivo de Word ni la exportación de otro producto en un presupuesto.",
            "No acepta precios que vengan del navegador — cada línea de un presupuesto se cotiza en el servidor a partir de sus propios datos, y por eso un archivo externo no puede convertirse en presupuesto directamente.",
            "No importa un presupuesto por una API pública; no la hay. [[no-public-api-or-zapier|Integraciones]].",
          ] },
        ],
      },
    ],
    faq: [
      { q: "¿El personal de FieldQuo puede ingresar mis presupuestos vigentes por mí?", a: "Sí, como parte del servicio de pago de migración. Los presupuestos que crea son borradores que usted termina y envía; nunca edita un presupuesto que ya existe." },
      { q: "Tengo una hoja de cálculo de presupuestos. ¿Hay una importación CSV?", a: "No para presupuestos. Para clientes sí la hay; para trabajos ya hechos y cobrados también. Un presupuesto vigente se rehace en el constructor." },
      { q: "¿El presupuesto de un trabajo anterior importado aparecerá como enviado al cliente?", a: "Se marca como aceptado con la fecha que usted escribió, y nunca se envía nada al cliente al respecto." },
    ],
  },

  "the-data-migration-service": {
    title: "El servicio de migración de datos",
    summary:
      "Pídale a FieldQuo que traiga sus registros antiguos: una solicitud, una llamada, un precio que usted acepta o rechaza, un pago a través de la facturación de FieldQuo, y un registro de cada dato creado.",
    updated: "2026-09-12",
    intro: [
      "**Migración de datos — Trae tus clientes y presupuestos antiguos a FieldQuo — desde QuickBooks, Jobber, una hoja de cálculo o una caja de zapatos.** Es un servicio de pago hecho por el propio personal de FieldQuo, no un importador de autoservicio, y es el único caso autorizado en que FieldQuo escribe dentro de su cuenta.",
      "Las reglas son estrictas y vale la pena conocerlas antes de pedirlo: el personal solo puede crear registros nuevos, nunca cambiar ni borrar nada que ya exista, solo después de que usted haya aceptado un precio y lo haya pagado, y cada registro que crea queda anotado donde usted puede verlo.",
    ],
    sections: [
      {
        id: "overview",
        heading: "Resumen",
        blocks: [
          { p: "Usted describe lo que va a traer, agenda una llamada, recibe un precio, lo acepta y paga. Luego FieldQuo crea los clientes y los presupuestos en su cuenta y usted los ve aparecer bajo **Lo que ya se trajo**. El pago va por la facturación de FieldQuo — la misma tarjeta que su suscripción —, nunca por su propia cuenta de Stripe, que es para que sus clientes le paguen a usted." },
        ],
      },
      {
        id: "what-is-on-the-screen",
        heading: "Qué hay en la pantalla",
        blocks: [
          { bullets: [
            "**Solicitar una migración** — **¿Dónde están tus datos ahora?** y **Cualquier otra cosa que convenga saber** (cuántos años, más o menos cuántos registros), y luego **Solicitar una migración**.",
            "La tarjeta de la solicitud, con su estado: **Solicitada**, **Llamada agendada**, **Presupuesto listo**, **Aceptado — pago pendiente**, **Pagada**, **En curso**, **Terminada**, **Rechazado** o **Cancelada**.",
            "**Agenda una llamada con FieldQuo** — horarios libres para elegir, o **Ahora mismo no hay horarios libres — te contactaremos para agendar uno.**",
            "**Documentos** — **Subir un archivo**: una exportación de QuickBooks o Jobber, una hoja de cálculo, o un ZIP con sus registros antiguos. Se aceptan CSV, XLS, XLSX, TXT, PDF, ZIP y los formatos de QuickBooks.",
            "**Lo que ya se trajo** — cada registro que FieldQuo creó para usted — y **Solicitudes anteriores**.",
          ] },
          { figure: "live:app-settings-migration", caption: "Migración de datos — la tarjeta de la solicitud con su estado y su precio, Documentos debajo." },
        ],
      },
      {
        id: "how-it-goes",
        heading: "Cómo transcurre, paso a paso",
        blocks: [
          { steps: [
            "Complete **Solicitar una migración**. El estado dice **Solicitada**.",
            "Agende una llamada entre los horarios libres, o espere a que FieldQuo programe una. Puede elegir otro horario mientras no exista un precio.",
            "FieldQuo cotiza el trabajo. El estado pasa a **Presupuesto listo**, el panel dice **FieldQuo presupuestó tu migración de datos en {amount}. Revísala y responde.**, y la tarjeta muestra **Aceptar** y **Rechazar**.",
            "Pulse **Aceptar**. La tarjeta dice **Presupuesto aceptado — paga cuando quieras empezar.**",
            "Pulse **Pagar y empezar la migración**. Se le lleva a Stripe para pagar; el estado pasa a **Pagada** y la tarjeta dice **Pago recibido — gracias. FieldQuo te contactará para empezar la migración.**",
            "Mientras el personal trabaja, el estado es **En curso** y los registros aparecen bajo **Lo que ya se trajo** a medida que se agregan.",
            "**Terminada** — **Migración terminada.**",
          ] },
          { note: "Subir documentos es posible en cada etapa hasta que la solicitud se rechaza o se cancela — una exportación es útil incluso antes de que exista un precio." },
        ],
      },
      {
        id: "what-fieldquo-writes",
        heading: "Qué escribe FieldQuo, y qué nunca toca",
        blocks: [
          { bullets: [
            "**Crea** fichas de clientes y presupuestos dentro de su cuenta. Hoy esos son los dos tipos de registro que el servicio escribe; un presupuesto migrado es un borrador, marcado como histórico, sin impuestos aplicados.",
            "**Nunca** actualiza ni borra un cliente, presupuesto, factura o trabajo que existía antes — el código no tiene ninguna ruta que lo permita.",
            "Escribe **solo** mientras la solicitud está Pagada o En curso, comprobado de nuevo en cada escritura. Cancele la migración y la escritura se detiene en ese instante.",
            "Cada escritura queda anotada con lo que se creó y cuándo, y usted lee ese registro bajo **Lo que ya se trajo**.",
          ] },
          { p: "Es un mecanismo distinto de una sesión de soporte. Cuando el soporte de FieldQuo mira su cuenta para ayudarlo, esa sesión es de solo lectura, sin excepción; la migración es la única puerta para escribir, y solo usted puede abrirla al pagar." },
        ],
      },
      {
        id: "cancelling-and-who-can-see-it",
        heading: "Cancelar, y quién puede verla",
        blocks: [
          { p: "**Cancelar esta solicitud** está disponible hasta que usted haya pagado. Después del pago, cancelar es una conversación con soporte y no un botón. La pantalla está en Configuración → Cuenta, solo para propietarios y administradores — las mismas personas que ven la facturación de la empresa. El precio y el recibo se explican en [[paying-for-the-migration-service|Pagar el servicio de migración]]." },
        ],
      },
    ],
    faq: [
      { q: "¿Cuánto cuesta?", a: "No hay precio de lista. FieldQuo cotiza cada migración después de la llamada, según lo que usted trae, y usted acepta o rechaza la cifra en esta pantalla." },
      { q: "¿FieldQuo puede corregir un presupuesto mío mientras está ahí?", a: "No. El personal solo puede crear registros nuevos. Todo lo que existía antes de la migración queda fuera de su alcance por diseño." },
      { q: "¿Los presupuestos migrados les llegan a mis clientes?", a: "No. Son borradores marcados como históricos. No se envía nada a nadie." },
    ],
  },
};
