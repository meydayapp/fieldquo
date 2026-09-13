// content/help/es/integrations.js
//
// Articles of the “integrations” category in es. Keyed by slug; the slugs are
// listed in lib/help/tree.js and scripts/check-help-centre.mjs refuses a
// module that is missing one or carries one the tree does not.
//
// Misma estructura que el inglés (mismos slugs, secciones, bloques y
// figuras); las palabras en pantalla vienen del bloque `es` de
// app/i18n/appMessages.js. Español neutro latinoamericano, usted.
export const ARTICLES = {
  "stripe": {
    title: "Stripe",
    summary:
      "Cómo Stripe se usa dos veces — una para que sus clientes le paguen, otra para que FieldQuo le cobre — qué conecta usted, qué ve Stripe, y qué hace realmente Desconectar.",
    updated: "2026-09-12",
    intro: [
      "Stripe hace dos trabajos distintos en FieldQuo, y nunca son la misma cuenta. **Stripe Connect** es suyo: una cuenta Express creada a nombre de su empresa cuando pulsa **Conectar con Stripe**, en la que se deposita cada pago en línea de un cliente. **Stripe Billing** es de FieldQuo: la tarjeta que dio al registrarse, cobrada por su plan, su crédito telefónico y el servicio de migración. Este artículo trata del primero, y dice dónde vive el segundo para que nunca se confundan.",
      "En resumen: conecte una vez en **Configuración → Pagos**, termine lo que Stripe pide en su propia página, y desde entonces cada factura, depósito y cuota lleva un botón Pagar. FieldQuo nunca retiene el dinero y nunca ve sus datos bancarios.",
    ],
    sections: [
      {
        id: "overview",
        heading: "Vista general",
        blocks: [
          { p: "Un cliente que paga en línea es un cargo de Stripe creado a nombre de su empresa — su nombre es el que aparece en el estado de cuenta de la tarjeta — y transferido a su banco por Stripe según su calendario habitual, unos 2 días hábiles para una cuenta canadiense o estadounidense. Una comisión de procesamiento se descuenta de cada pago antes de que le llegue: **3% + $0.30** con tarjeta, **1% + $0.40 con tope de $5.00** en un débito bancario canadiense, **0.8% con tope de $5.00** en uno estadounidense. Nada se factura aparte y no hay cuota mensual por cobrar. Toda la aritmética está en [[payment-processing-fees-and-payouts|Comisiones de procesamiento y transferencias]]." },
          { p: "Su suscripción es el otro Stripe. Se cobra a la tarjeta registrada en **Cuenta y facturación**, y **Gestionar facturación y método de pago** abre allí el portal de facturación de Stripe para esa tarjeta — no su cuenta de cobros. Las dos nunca se tocan: el pago de un cliente nunca puede aplicarse a su factura de FieldQuo, y su factura de FieldQuo nunca se descuenta de sus transferencias." },
          { note: "FieldQuo envía a Stripe el número de la factura y el importe. El cliente escribe su tarjeta o sus datos bancarios en la página de Stripe, nunca en una página de FieldQuo, y la línea al pie de Configuración → Pagos es literalmente cierta: FieldQuo nunca ve ni almacena los datos de su cuenta bancaria." },
        ],
      },
      {
        id: "what-is-on-the-screen",
        heading: "Qué hay en Configuración → Pagos",
        blocks: [
          { p: "La página se lee de arriba abajo: la tarjeta de conexión con Stripe, **Comisiones de procesamiento**, **Transferencia instantánea**, **Formas de pago que aceptas**, **Su cuenta de Stripe** (solo el propietario) y — una vez activa la conexión — **Ofrecer pago a plazos (Affirm)**. La tarjeta de conexión está en uno de cuatro estados, y cada uno dice qué hacer a continuación." },
          { figure: "live:app-settings-payments", caption: "Configuración → Pagos — la tarjeta de conexión con Stripe conectado · Activo, con Gestionar en Stripe y Desconectar, y luego las tarjetas de comisiones y transferencias." },
          { table: {
            head: ["La tarjeta dice", "Qué significa", "Qué pulsar"],
            rows: [
              ["**Aún no conectado**", "Todavía no existe una cuenta de Stripe para esta empresa.", "**Conectar con Stripe** — sale hacia la configuración alojada de Stripe y vuelve aquí."],
              ["**Stripe todavía necesita algunas cosas**", "Stripe no ha habilitado los pagos; los puntos pendientes se listan bajo el título.", "**Finalizar configuración** para volver a Stripe, o **Ya lo hice** para que FieldQuo vuelva a preguntar a Stripe."],
              ["**Stripe está revisando tus datos**", "Todo está enviado; Stripe lo verifica. Minutos por lo general, a veces un día o dos.", "**Comprobar de nuevo**. Enviar dos veces el mismo documento no lo acelera."],
              ["**Stripe conectado · Activo**", "Los cobros están habilitados. Cada factura que reciben sus clientes lleva ahora un botón Pagar.", "**Gestionar en Stripe** abre su panel Express en una pestaña nueva; **Desconectar** desvincula la cuenta."],
            ],
          } },
          { p: "La página pregunta a Stripe directamente cada vez que carga en lugar de fiarse de lo último que oyó, así que la insignia es la respuesta de Stripe, no una columna vieja. Eso importa cuando vuelve de la página de Stripe: la cuenta se actualizó hace segundos y la página comprueba antes de dibujarse." },
        ],
      },
      {
        id: "connect",
        heading: "Cómo conectar",
        blocks: [
          { steps: [
            "Abra **Configuración → Pagos** y pulse **Conectar con Stripe**.",
            "En la página de Stripe, ingrese lo que pide — datos de la empresa, la identidad de un directivo, una cuenta bancaria. [[what-stripe-asks-for-and-why|Qué pide Stripe y por qué]] lo recorre paso a paso.",
            "Vuelve a Configuración → Pagos. Si la tarjeta dice **Stripe conectado · Activo**, terminó; si lista cosas que Stripe todavía necesita, pulse **Finalizar configuración**.",
            "Envíe una factura. Su correo y el portal del cliente llevan ahora **Pagar** con tarjeta y — una vez que Stripe active el débito bancario en su cuenta — **Pagar … desde una cuenta bancaria** al lado.",
          ] },
          { p: "El débito bancario no es un ajuste. FieldQuo solicita la capacidad para su país cuando conecta, Stripe la activa según su propio calendario, y la tarjeta **Comisiones de procesamiento** le dice en qué estado está: **Los clientes pueden pagar las facturas con tarjeta o desde una cuenta bancaria (débito preautorizado, Canadá)** — o ACH para una empresa estadounidense — o que los pagos bancarios se ofrecerán cuando Stripe los active. Nada que hacer de su parte. El débito bancario se ofrece entonces en facturas, depósitos y cuotas de un calendario de pagos desde el portal del cliente, y en planes de servicio con cobro automático; vea [[bank-debit-in-canada|Débito bancario en Canadá]]." },
          { tip: "Bajo Su cuenta de Stripe se muestran dos interruptores por separado: **Cobro con tarjeta** y **Transferencias a su banco**. Las tarjetas pueden seguir funcionando mientras las transferencias están en pausa — el dinero se cobra y Stripe lo retiene, no se pierde. Cuando eso ocurre, la tarjeta de conexión dice **Stripe está reteniendo su dinero** o **Stripe está revisando su cuenta**, y [[payouts-held-or-under-review|Transferencias retenidas o en revisión]] explica qué necesita cada caso." },
        ],
      },
      {
        id: "what-each-control-changes",
        heading: "Qué cambia cada control",
        blocks: [
          { bullets: [
            "**Gestionar en Stripe** — abre un enlace de acceso a su panel de Stripe Express en una pestaña nueva. Las transferencias, los documentos de identidad, su cuenta bancaria y el soporte de Stripe viven todos allí.",
            "**Desconectar** — desvincula la cuenta de FieldQuo. Los clientes no pueden pagar en línea hasta que vuelva a conectar. **No** cierra ni elimina su cuenta de Stripe, y nada cambia en su historial de transferencias — pero pulsar después **Conectar con Stripe** crea una cuenta Express **completamente nueva**, con la configuración de Stripe por hacer otra vez. Desconectar sirve para irse, no para arreglar un problema.",
            "**Formas de pago que aceptas** — marque **Efectivo**, **Transferencia electrónica** y **Cheque**. Lo que marque aparece como una línea **Formas de pago aceptadas:** en el correo de la factura, en el portal del cliente y en el PDF de la factura; desmarque todo y la línea se omite. Estos pagos se registran a mano y no llevan comisión.",
            "**Ofrecer pago a plazos (Affirm)** — deja que un cliente divida una factura de entre $50 y $30,000, en USD o CAD, con Affirm al pagar, además del pago con tarjeta. A usted se le paga completo, por adelantado. Primero debe activar Affirm en su panel de Stripe; la comisión de Affirm en esos pagos se traslada igual que la comisión de tarjeta.",
            "**Transferencia instantánea** — envía su saldo disponible a una tarjeta de débito en unos 30 minutos por el 1% del importe; vea [[instant-payouts|Transferencias instantáneas]].",
            "**Reembolsar** en la línea de un pago de la factura — la única forma de reembolsar a un cliente. Su panel Express no puede reembolsar un cargo que creó FieldQuo; el botón en FieldQuo sí, total o parcial, con un motivo, y la comisión de procesamiento no se devuelve. Vea [[refunds|Reembolsos]].",
          ] },
        ],
      },
      {
        id: "who-can-see-it",
        heading: "Quién puede verlo",
        blocks: [
          { p: "Configuración → Pagos es para el **propietario y los administradores**. Un gerente o un despachador no ve la fila, y las rutas detrás de Conectar, Desconectar y Gestionar en Stripe rechazan a cualquier otra persona en el servidor, así que quien escribe la dirección recibe un rechazo en lugar de la página. La tarjeta **Su cuenta de Stripe** — el identificador acct_, el correo de inicio de sesión, lo que Stripe sigue esperando — se muestra solo al propietario." },
        ],
      },
      {
        id: "not-integrated",
        heading: "Qué no está integrado",
        blocks: [
          { bullets: [
            "No hay lector de tarjetas ni terminal presencial. Un cliente que le paga en la entrada de su casa paga desde el correo de la factura en su teléfono, o en efectivo, por transferencia electrónica o con cheque, registrado a mano.",
            "No hay propinas, ni producto de préstamo o financiamiento para su empresa. Un cliente paga exactamente la factura.",
            "Las disputas se responden en su panel de Stripe con sus pruebas, no en FieldQuo; FieldQuo registra la comisión de $15 y el importe retenido en la factura. Vea [[disputes-and-chargebacks|Disputas y contracargos]].",
            "Las comisiones de cuenta de Stripe — una pequeña cuota mensual en los meses en que cobra, y 0.25% + 25¢ por transferencia a su banco — se trasladan al costo como su propia línea en su siguiente pago, nunca escondidas en la comisión de procesamiento.",
          ] },
        ],
      },
    ],
    faq: [
      { q: "¿La cuenta de Stripe es mía o de FieldQuo?", a: "Suya. Es una cuenta Express a nombre de su empresa, con su propio identificador acct_ mostrado en Configuración → Pagos. FieldQuo solo guarda el identificador que apunta a ella." },
      { q: "Ya tengo una cuenta de Stripe. ¿Puedo usarla?", a: "No. Conectar con Stripe crea una cuenta Express nueva en la que FieldQuo deposita; una cuenta estándar de Stripe existente no se puede vincular. Ambas pueden coexistir." },
      { q: "¿Mi cliente necesita una cuenta de Stripe?", a: "No. Pulsa Pagar, escribe una tarjeta o sus datos bancarios en la página de Stripe, y listo. Nunca ve la palabra Stripe en los correos de FieldQuo." },
      { q: "¿Por qué Cuenta y facturación abre otra página de Stripe?", a: "Porque eso es Stripe Billing — la tarjeta con la que FieldQuo le cobra. Su cuenta de cobros está en Configuración → Pagos → Gestionar en Stripe." },
    ],
  },

  "facebook-and-instagram": {
    title: "Facebook e Instagram (Meta)",
    summary:
      "Un solo inicio de sesión de Meta puede alimentar cuatro cosas — gasto publicitario, formularios de clientes potenciales, mensajes de página e Instagram, y publicación — y solo la primera funciona hoy para todas las empresas; la pantalla dice cuál.",
    updated: "2026-09-12",
    intro: [
      "Todo lo de Meta vive en una sola pantalla, **Configuración → Meta Ads**, porque un contratista piensa «conecté mi Facebook» y no debería tener que aprender cuál de varios lugares guarda cada mitad. La pantalla tiene cuatro paneles, cada uno un permiso independiente de Meta: la cuenta publicitaria (gasto y rendimiento de campañas), **Formularios de clientes potenciales de Facebook**, **Publicación en Facebook e Instagram** y **WhatsApp Business** (con su propio artículo, [[whatsapp|WhatsApp Business]]).",
      "El estado honesto hoy: la conexión de la cuenta publicitaria funciona, y solo lee el gasto. Los otros tres están construidos de punta a punta y están **esperando la aprobación de Meta** del permiso que los sostiene; cada panel lo dice en una frase y no ofrece ningún botón que fallaría. No falta nada de su parte.",
    ],
    sections: [
      {
        id: "overview",
        heading: "Vista general",
        blocks: [
          { p: "El subtítulo de la pantalla es la promesa: **Conecta tu propia cuenta publicitaria de Meta (Facebook/Instagram) para traer el gasto y el rendimiento de las campañas a tus números de marketing.** FieldQuo pide a Meta acceso de lectura a su cuenta publicitaria y nada más — la tarjeta sin conectar lo dice claro: **FieldQuo solo lee el gasto y el rendimiento — nunca crea ni modifica un anuncio.**" },
          { p: "Una vez conectada, **Sincronizar ahora** lee el gasto diario y los resultados de sus campañas en **Marketing → Gasto en marketing**, desde donde entran en el costo por cliente potencial del panel de indicadores. Una fila sincronizada desde Meta queda marcada como tal, nunca sobrescribe una cifra que usted escribió a mano, y se señala como posible duplicado cuando se parece a una que ya había ingresado." },
          { figure: "live:app-settings-meta-ads", caption: "Configuración → Meta Ads — la conexión de la cuenta publicitaria arriba, y luego los paneles de formularios, publicación y WhatsApp, cada uno con su propio estado." },
        ],
      },
      {
        id: "connect-the-ad-account",
        heading: "Cómo conectar la cuenta publicitaria",
        blocks: [
          { steps: [
            "Abra **Configuración → Meta Ads** y pulse **Conectar Meta Ads**. Sale hacia el inicio de sesión y la pantalla de consentimiento de Facebook.",
            "Si su inicio de sesión administra más de una cuenta publicitaria, la página pregunta **¿Qué cuenta publicitaria?** — elija una y pulse **Conectar esta cuenta**.",
            "La tarjeta muestra ahora el nombre, el identificador y la moneda de la cuenta con la insignia **Conectada**. Pulse **Sincronizar ahora**. La primera sincronización lee los últimos 30 días; una sincronización cubre como máximo 90 días a la vez.",
            "Abra **Ver tus campañas →** para encontrar las filas bajo Gasto en marketing.",
          ] },
          { note: "La sincronización es manual. No hay sincronización nocturna con Meta: pulse **Sincronizar ahora** cuando quiera cifras frescas. Si su cuenta publicitaria factura en una moneda distinta a la de su empresa, las filas se importan tal como se reportan y se convierten solo al mostrar los totales, marcadas con ≈ aproximado." },
        ],
      },
      {
        id: "what-each-control-changes",
        heading: "Qué cambia cada control",
        blocks: [
          { table: {
            head: ["Control", "Qué hace"],
            rows: [
              ["**Sincronizar ahora**", "Lee de Meta el gasto y los resultados por campaña y por día, y crea o actualiza las filas que creó antes. Muestra cuántas se crearon, se actualizaron, dieron error o parecen duplicadas."],
              ["**Volver a conectar**", "Aparece cuando la tarjeta dice **Hay que volver a conectarla** — Meta dice que el token guardado ya no sirve. El mismo inicio de sesión que al conectar; nada ya importado se pierde."],
              ["**Desconectar**", "Detiene la sincronización. Las filas ya importadas quedan en su historial de gasto de marketing."],
              ["Formulario **Activado / Desactivado**", "Cuáles de sus formularios de clientes potenciales de Facebook se convierten en clientes potenciales en FieldQuo. Desactivado hoy, con el motivo sobre el interruptor: el permiso todavía no está aprobado."],
              ["**Buscar mis formularios**", "Pide a Meta los formularios de sus páginas. Desactivado por el mismo motivo."],
              ["**Conectar Facebook e Instagram** (publicación)", "No se ofrece hoy; el panel dice **Esperando la aprobación de Meta**. Cuando llegue, la misma conexión de página llevará tanto la publicación como la mensajería de página."],
            ],
          } },
          { p: "Cuando un formulario está activado, un cliente potencial que llega por él aterriza en el tablero de prospectos como cualquier otra solicitud — puntuado igual, avisando a las mismas personas, con sus reglas de seguimiento aplicándose — y lleva la campaña de la que vino, que es el único caso en que un dólar de gasto publicitario se vincula a un cliente potencial concreto. Todos los demás canales siguen mezclados: un propietario que vio el anuncio y llamó por teléfono no se atribuye. Vea [[facebook-lead-forms|Formularios de clientes potenciales de Facebook]] y [[marketing-spend|Gasto en marketing]]." },
        ],
      },
      {
        id: "messages",
        heading: "Mensajes de página e Instagram",
        blocks: [
          { p: "La pantalla **Mensajes** está construida para responder las conversaciones de su página de Facebook y su cuenta comercial de Instagram — agrupadas en **Por responder** y **Esperando su respuesta**, con una nota privada, un estado y un resumen mensual de qué conversaciones se convirtieron en trabajos. Hoy dice **FieldQuo está esperando la aprobación de Meta para la mensajería de páginas. La bandeja ya está lista: no tienes que hacer nada hasta que llegue esa aprobación.** La conexión se activará en Configuración → Meta Ads cuando Meta la apruebe. Vea [[connect-your-facebook-page-and-instagram|Conectar su página de Facebook e Instagram]]." },
          { warning: "No compre FieldQuo por la bandeja de Facebook este mes. La sincronización del gasto publicitario es la parte que funciona hoy para todas las empresas; la bandeja, los formularios y la publicación dependen de una revisión que está en manos de Meta, no de usted ni de FieldQuo." },
        ],
      },
      {
        id: "what-leaves-the-building",
        heading: "Qué ve Meta, y qué guarda FieldQuo",
        blocks: [
          { bullets: [
            "FieldQuo guarda el token de acceso que Meta emite para su cuenta publicitaria, cifrado; ese token es lo que usa Sincronizar ahora. Desconectar elimina la conexión.",
            "La conexión de la cuenta publicitaria no envía ningún dato de clientes a Meta — es una lectura en un solo sentido.",
            "Un embudo es la única página de cara al cliente donde un píxel de Meta puede dispararse. Si pega un identificador de píxel en el panel **Píxeles de seguimiento publicitario** de un embudo, el píxel registra una vista de página y un evento **Lead** cuando un visitante envía el formulario de contacto, sin datos personales. FieldQuo no añade ningún aviso de consentimiento de cookies en ningún lugar; si sus visitantes están donde se exige uno, ponerlo le corresponde a usted. Vea [[funnels|Embudos]].",
          ] },
        ],
      },
      {
        id: "who-can-see-it",
        heading: "Quién puede verlo",
        blocks: [
          { p: "Configuración → Meta Ads es para el **propietario y los administradores**, el mismo estante que Pagos: conectar la cuenta publicitaria de una empresa es un acto a nivel de empresa, y cada ruta debajo rechaza a cualquier otra persona. El gasto importado se ve luego dondequiera que se vea el Gasto en marketing." },
        ],
      },
    ],
    faq: [
      { q: "¿Puede FieldQuo crear o pausar mis anuncios?", a: "No, y no le pide a Meta el permiso para hacerlo. Solo lee gasto y rendimiento." },
      { q: "¿Por qué mis formularios aparecen listados pero en gris?", a: "Recibir un cliente potencial necesita un permiso más que Meta todavía no ha aprobado para FieldQuo. Los interruptores están desactivados con ese motivo encima en lugar de ocultos, para que vea que no llega ningún cliente potencial y que no es culpa suya." },
      { q: "Desconecté — ¿se perdió mi historial de gasto?", a: "No. Las filas ya importadas quedan en Gasto en marketing; solo se detiene la sincronización futura." },
    ],
  },

  "whatsapp": {
    title: "WhatsApp Business",
    summary:
      "Su propio número de WhatsApp Business respondido desde la bandeja de Mensajes, la regla de las 24 horas que WhatsApp impone a las respuestas, y por qué el botón Conectar todavía no se ofrece.",
    updated: "2026-09-12",
    intro: [
      "El panel **WhatsApp Business** de **Configuración → Meta Ads** conecta el número de WhatsApp Business al que escriben sus clientes, para que sus mensajes lleguen a **Mensajes** junto a sus conversaciones de Facebook e Instagram y se respondan desde allí. Es un número de empresa, no el WhatsApp personal de nadie.",
      "Hoy el panel dice **Esperando la aprobación de Meta**: responder mensajes de WhatsApp necesita un permiso que Meta debe conceder a FieldQuo antes de que se pueda conectar ningún número. Esa revisión depende de Meta. No falta nada de su parte, y este artículo cuenta qué hace la función el día que se active — incluida la única regla que sorprende a todo el mundo.",
    ],
    sections: [
      {
        id: "overview",
        heading: "Vista general",
        blocks: [
          { p: "Cuando la conexión se ofrezca, **Conectar WhatsApp** lo lleva por el registro propio de Meta, donde elige o crea una cuenta de WhatsApp Business y un número de teléfono; FieldQuo se suscribe a los mensajes de ese número, y una conversación aparece en Mensajes en cuanto un cliente escribe. Las respuestas salen desde su número. El panel muestra entonces el número con su nombre verificado, las plantillas leídas de Meta y un botón **Desconectar**." },
          { p: "Existe una segunda puerta, plegada, para una empresa que ya usa la API Cloud de Meta: pegue el identificador de la cuenta de WhatsApp Business, el identificador del número y un token permanente, y FieldQuo comprueba el token ante Meta antes de guardar nada. El token se guarda cifrado y nunca se vuelve a mostrar. Para casi todas las empresas, el botón de registro es la puerta correcta." },
          { figure: "live:app-settings-meta-ads", caption: "Configuración → Meta Ads — el panel WhatsApp Business está al final e indica si ya se puede conectar un número." },
        ],
      },
      {
        id: "the-24-hour-rule",
        heading: "La regla de las 24 horas",
        blocks: [
          { p: "El panel la lleva en una tarjeta propia, porque es lo que un pintor que usa WhatsApp personalmente desde hace diez años nunca ha encontrado: **WhatsApp solo entrega un mensaje escrito durante las 24 horas siguientes al último mensaje del cliente. Después puede seguir contactándolo, pero solo con una plantilla aprobada de antemano por Meta.** FieldQuo indica cuál de las dos corresponde en cada conversación, y rechaza por su nombre un mensaje libre fuera de la ventana en lugar de dejar que WhatsApp lo rechace en silencio." },
          { steps: [
            "Cree sus plantillas en el Administrador de WhatsApp de Meta — un «su presupuesto está listo» o un «confirmamos la visita de mañana», por ejemplo — y espere a que Meta las apruebe.",
            "En el panel, pulse **Actualizar plantillas**. Dice **{count} plantillas leídas de Meta**, o **Todavía no hay plantillas. Créelas en el Administrador de WhatsApp de Meta y luego actualice.**",
            "En una conversación de más de 24 horas, el redactor ofrece esas plantillas en lugar de un cuadro de texto.",
          ] },
          { note: "El empleado de IA sigue la misma regla: fuera de la ventana no redacta ninguna respuesta, porque no hay texto libre que pudiera enviar." },
        ],
      },
      {
        id: "what-each-control-changes",
        heading: "Qué cambia cada control",
        blocks: [
          { bullets: [
            "**Conectar WhatsApp** — inicia el registro de Meta. Si cancela a medio camino, no se conecta nada; si la cuenta todavía no tiene número de teléfono, el panel lo dice y le pide añadir uno con Meta.",
            "**Actualizar plantillas** — vuelve a leer de Meta sus plantillas aprobadas. Las plantillas nuevas no aparecen hasta que lo pulsa.",
            "**Desconectar** — quita el número de FieldQuo y elimina el token guardado. Las conversaciones que ya están en Mensajes se quedan.",
            "La insignia del panel — **Conectado mediante el registro de Meta** o **Conectado con credenciales de API** — registra qué puerta se usó.",
          ] },
        ],
      },
      {
        id: "what-leaves-the-building",
        heading: "Qué sale de la empresa",
        blocks: [
          { p: "Los mensajes de su cliente van de Meta a FieldQuo y se guardan como conversaciones; sus respuestas van de FieldQuo a Meta y de ahí al cliente. Meta tiene el número y las plantillas, así que el texto de una plantilla es el que Meta aprobó, no el que a FieldQuo le gustaría enviar. Los archivos que envía un cliente se recuperan de Meta y se guardan con la conversación." },
        ],
      },
      {
        id: "who-can-see-it",
        heading: "Quién puede verlo",
        blocks: [
          { p: "Conectar o desconectar un número es para el **propietario y los administradores** — la misma regla que el resto de Configuración → Meta Ads, aplicada tanto por las rutas como por el menú. Responder conversaciones sigue el acceso propio de la bandeja de Mensajes; vea [[the-messages-inbox|La bandeja de Mensajes]]." },
        ],
      },
    ],
    faq: [
      { q: "¿Puedo usar mi WhatsApp personal?", a: "No. La conexión es a una cuenta de WhatsApp Business y su número, a través de Meta. Un número personal no tiene esa cuenta." },
      { q: "¿Por qué no puedo responder a un mensaje de la semana pasada?", a: "Es la regla de WhatsApp, no de FieldQuo: más de 24 horas después del último mensaje del cliente, solo se puede enviar una plantilla aprobada de antemano por Meta. Cree plantillas en el Administrador de WhatsApp y pulse Actualizar plantillas." },
      { q: "¿Cuándo aparecerá el botón Conectar?", a: "Cuando Meta apruebe el permiso para FieldQuo. El panel cambiará por sí solo; no hay nada que solicitar de su parte." },
    ],
  },

  "phone-and-texts": {
    title: "Números de teléfono y mensajes de texto (Twilio)",
    summary:
      "Las tres cosas telefónicas que hace FieldQuo — los mensajes a clientes, el número de la recepcionista de IA y la línea de mensajes de la cuadrilla — qué número usa cada una, qué cuesta cada una, y qué no es un mensaje de texto a propósito.",
    updated: "2026-09-12",
    intro: [
      "FieldQuo toca la red telefónica en tres lugares distintos, y usa tres números diferentes. Los **mensajes a clientes** — el texto Voy en camino y los recordatorios de cita — salen desde el número compartido de FieldQuo con el nombre de su empresa al inicio. La **recepcionista telefónica** contesta en un número que usted alquila en **Configuración → Recepcionista telefónico**. Los **mensajes de la cuadrilla** usan un tercer número, configurado en la página **Bandeja del equipo**, al que su cuadrilla envía fotos.",
      "Twilio transporta los mensajes y provee los números; Retell pone la voz de la recepcionista. Este artículo dice qué hace cada una de las tres, qué sale de la empresa, qué se descuenta de su crédito telefónico, y qué no envía FieldQuo por texto a propósito.",
    ],
    sections: [
      {
        id: "overview",
        heading: "Vista general",
        blocks: [
          { table: {
            head: ["Qué", "Desde qué número", "Qué le cuesta"],
            rows: [
              ["Texto Voy en camino, recordatorio de cita", "El número compartido de FieldQuo, con el nombre de su empresa al inicio", "Nada — los mensajes a clientes no se cobran"],
              ["Recepcionista telefónica", "Un número local o gratuito que usted alquila, o su propio número desviado a él", "$4/mes local, $9/mes gratuito, más 35¢ por minuto (40¢ en gratuito), del crédito telefónico"],
              ["Línea de mensajes de la cuadrilla", "Un número propio, comprado para la empresa, o la línea de prueba compartida de FieldQuo prestada 7 días", "$4/mes por su propia línea, 2¢ por mensaje y 5¢ por foto, del mismo crédito"],
            ],
          } },
          { p: "El crédito telefónico es un solo saldo prepagado, mostrado en **Configuración → Crédito de IA** como **Crédito telefónico** y en la página de la recepcionista como **Crédito**. Recargue $10, $30, $50 o $100 — o cualquier importe de $5 a $1,000 — con tarjeta, o active la **recarga automática** para cobrar a la tarjeta guardada cuando el saldo baje de $5, $10 o $20. Vea [[ai-credit-and-phone-credit|Crédito de IA y crédito telefónico]]." },
        ],
      },
      {
        id: "texts-to-clients",
        heading: "Mensajes a clientes",
        blocks: [
          { p: "Exactamente dos mensajes van a los clientes, y ambos se redactan a su gusto en **Configuración → Mensajes de clientes**: **Voy en camino**, enviado cuando una visita se marca en camino, y **Recordatorio de cita**, enviado 2, 24 o 48 horas antes de una visita una vez que elige un plazo en Configuración → Notificaciones. Cada uno sale en el idioma del cliente. El recordatorio termina con **Responda STOP para no recibir más**; un cliente que responde STOP no vuelve a recibir mensajes de su empresa, y START lo revierte." },
          { warning: "Estos mensajes salen del número compartido de FieldQuo, no de un número suyo — el número de la recepcionista no puede enviar textos, y hoy no existe un ajuste para dar a los mensajes a clientes un número de empresa. El mensaje empieza con el nombre de su empresa, pero el número que el cliente ve es compartido. Es la única superficie de cara al cliente donde se nota la tubería de FieldQuo; vea [[client-texts-on-my-way-and-reminders|Mensajes a clientes: Voy en camino y recordatorios]]." },
          { p: "No hay bandeja de mensajes de texto de clientes. Un propietario que responde a un recordatorio con una pregunta no es leído — el mensaje lo remite a su número de teléfono. FieldQuo no envía por texto facturas, presupuestos, solicitudes de reseña ni confirmaciones de reserva; esos son correos. Vea [[texting-clients-what-is-and-is-not-automated|Mensajes a clientes: qué está automatizado y qué no]]." },
        ],
      },
      {
        id: "the-receptionists-number",
        heading: "El número de la recepcionista",
        blocks: [
          { figure: "live:app-settings-voice", caption: "Configuración → Recepcionista telefónico — el número con Está contestando — desactivar, la tarjeta Crédito con las recargas, y luego Tu número y las tarjetas de saludo, conocimiento y voz." },
          { steps: [
            "Abra **Configuración → Recepcionista telefónico** y busque **Tu número**. Elija un número local por código de área entre los que Twilio tiene libres, o uno gratuito, o conserve su propio número y desvíelo — la forma recomendada, porque el número de su camioneta sigue siendo el mismo.",
            "El alquiler del primer mes sale de su crédito en cuanto elige uno. Su primer número también añade **$10.50** de crédito — 30 minutos gratis — para empezar.",
            "Pulse **Empezar a contestar llamadas**. Desde entonces la recepcionista contesta en el idioma de quien llama (inglés, francés o español), toma los datos, agenda una visita según su disponibilidad real, y nunca da un precio. Cada llamada aterriza en la pantalla **Recepcionista** con su grabación, transcripción y resumen.",
            "Para detenerla, pulse **Está contestando — desactivar**: el número deja de contestar pero sigue siendo suyo y sigue alquilado. Para renunciar al número, use **Devolver el número** y escriba el número para confirmar — es irreversible y el resto del mes no se reembolsa.",
          ] },
          { note: "El alquiler se descuenta cada 30 días del crédito. Si el crédito se agota, el número sigue funcionando 7 días mientras FieldQuo le escribe por correo, y luego se devuelve y se pierde. La recarga automática es la protección. Portar un número a FieldQuo es una solicitud que se gestiona a mano, no un botón; no se cobra nada hasta que la portabilidad está en servicio." },
        ],
      },
      {
        id: "crew-texting",
        heading: "La línea de mensajes de la cuadrilla",
        blocks: [
          { p: "Su cuadrilla envía fotos a un solo número y se archivan en el trabajo correcto — por el trabajo nombrado en el mensaje, por GPS cuando el teléfono lo envía, o por el único trabajo que esa persona tiene ese día; cuando nada de eso lo decide, la oficina elige el trabajo bajo **Te necesita — elige el trabajo**. La persona se reconoce por el celular registrado en su ficha de trabajador. La configuración está en la página **Bandeja del equipo**, no en la recepcionista: **Comprarle a tu equipo su propio número** por $4 al mes, o **Usar la línea de prueba de FieldQuo** durante 7 días primero." },
          { p: "Cada mensaje que entra o sale cuesta **2¢** por cada 160 caracteres y una foto **5¢**, del mismo crédito telefónico. Una foto entrante siempre se recibe y se cobra; si el crédito queda $2 en negativo, la línea se desconecta y la página dice **Los mensajes del equipo están en pausa porque se acabó tu crédito. Recarga y se reconectará.** Vea [[the-crew-inbox|La bandeja del equipo]]." },
          { note: "La línea de prueba compartida es el mismo número desde el que salen los mensajes a clientes. Mientras está prestada a su cuadrilla, un STOP que un cliente le envíe cae en la bandeja del equipo y no se lee como una baja — una razón más para comprarle a la cuadrilla su propio número." },
        ],
      },
      {
        id: "what-leaves-the-building",
        heading: "Qué sale de la empresa",
        blocks: [
          { bullets: [
            "Twilio recibe el número de teléfono de un cliente y el texto de un recordatorio o de un mensaje Voy en camino, y las fotos que envía la cuadrilla antes de que FieldQuo las vuelva a alojar.",
            "Retell recibe el audio en vivo, la grabación y la transcripción de cada llamada que atiende la recepcionista. La grabación se reproduce desde la pantalla Recepcionista.",
            "Un número que alquila para la recepcionista se compra en la cuenta de Twilio de Retell; una línea de cuadrilla se compra en la de FieldQuo. Ninguno es un número que pueda llevarse al irse, y por eso desviar su propio número es la opción recomendada.",
          ] },
        ],
      },
      {
        id: "who-can-see-it",
        heading: "Quién puede verlo",
        blocks: [
          { p: "**Configuración → Recepcionista telefónico** y sus controles de número, crédito y recarga son para el propietario, los administradores y los niveles Gerente y Despachador. El registro de llamadas **Recepcionista** necesita la vista completa de clientes en la cuadrícula de acceso. La fila **Bandeja del equipo** se muestra a todos, pero un acceso de Cuadrilla o Estimador solo ve las fotos que envió él mismo, y configurar, comprar o desactivar la línea de la cuadrilla es para el propietario, los administradores y un gerente con costeo de trabajos — gasta el crédito de la empresa." },
        ],
      },
    ],
    faq: [
      { q: "¿Mis clientes pueden responderme por texto?", a: "No dentro de FieldQuo. Las respuestas al número compartido solo se leen para STOP y START; todo lo demás se acusa y se descarta, y el mensaje Voy en camino le da al cliente su número de teléfono para llamar." },
      { q: "¿Los recordatorios cuestan crédito?", a: "No. Los mensajes Voy en camino y los recordatorios de cita son gratis; el crédito paga los minutos y el alquiler de la recepcionista y los mensajes de la cuadrilla." },
      { q: "¿Puedo tener un número a mi nombre para enviar textos a clientes?", a: "Hoy no. Los mensajes a clientes salen del número compartido de FieldQuo con el nombre de su empresa al inicio; el número de la recepcionista contesta llamadas pero no puede enviar textos." },
    ],
  },

  "google-maps-and-solar": {
    title: "Google Maps y Google Solar",
    summary:
      "Dónde se autocompleta una dirección, cómo se mide un techo desde el cielo, en qué se basa el tiempo de viaje, y lo único que debe saber — las direcciones de los propietarios se envían a Google para hacerlo.",
    updated: "2026-09-12",
    intro: [
      "Google está detrás de tres cosas corrientes en FieldQuo: la dirección que se completa sola mientras escribe, la superficie y la pendiente del techo que aparecen cuando pulsa **Medir por satélite**, y el tiempo de manejo que da forma a los horarios de reserva. Cada una envía a Google la dirección de un propietario, o las coordenadas detrás de ella. Ese es todo el costo — no se descuenta crédito y no hay complemento que comprar — y vale la pena decirlo claro.",
      "Este artículo dice dónde se usa cada una de las tres, qué devuelve la medición del techo y cuándo no puede, y para qué no usa Google FieldQuo.",
    ],
    sections: [
      {
        id: "overview",
        heading: "Vista general",
        blocks: [
          { bullets: [
            "**Autocompletar direcciones** — en un cliente nuevo o editado, en el selector de cliente del constructor de presupuestos, en Configuración de la empresa, al agregar un empleado, en la página pública de reservas, el formulario de autopresupuesto y la página de estimación instantánea. Una dirección escrita sin elegir una sugerencia se acepta tal cual.",
            "**Geocodificación** — cuando se fija la dirección de un trabajo, FieldQuo pide a Google sus coordenadas una vez y las guarda. Esas coordenadas son lo que el reloj de asistencia compara con una marcación (a menos de 250 m se lee como en sitio) y lo que muestran el pequeño mapa de Configuración de la empresa y el bloque de contacto del sitio web.",
            "**Google Solar** — el modelo de techo detrás de **Medir por satélite** en un presupuesto de techado, y detrás de la estimación instantánea de techado en su sitio web.",
            "**Tiempo de manejo** — la matriz de distancias de Google entre dos direcciones, usada para separar los horarios de reserva y las visitas por el viaje real. Cuando Google no responde, FieldQuo estima a partir de la distancia en línea recta y lo etiqueta como estimación.",
          ] },
        ],
      },
      {
        id: "measure-a-roof",
        heading: "Cómo medir un techo desde una dirección",
        blocks: [
          { steps: [
            "En el constructor de presupuestos, en un tipo de presupuesto de **techado**, abra el levantamiento y pulse **Medir por satélite** — o **Usar la dirección del cliente** para medir la dirección que ya está en el presupuesto.",
            "FieldQuo geocodifica la dirección, pide a Google Solar el modelo de techo del edificio más cercano, y rellena la superficie del techo en pies cuadrados y en cuadros, la pendiente predominante como elevación sobre 12 con su grado de inclinación, el número de aguas, y las longitudes de alero, hastial, cumbrera, limatesa y limahoya. Una imagen satelital muestra lo que se midió.",
            "Compare la imagen con la casa. Cuando el marcador cayó en el vecino, o la imagen es vieja, el panel lo dice; las cifras siguen siendo editables y puede escribir la superficie y la pendiente a mano.",
          ] },
          { note: "Dos rechazos son normales y ambos dicen qué hacer: no se encontró la dirección, o Google no tiene modelo de techo para ese edificio — en ambos casos, ingrese la superficie y la pendiente a mano. La cobertura es de Google, no de FieldQuo — las casas rurales y recién construidas son los huecos habituales. En la estimación instantánea pública, el propietario ve una frase más suave y se le invita a solicitar un presupuesto." },
          { p: "La superficie del techo es la superficie inclinada de Google, así que no se aplica encima ningún multiplicador de pendiente — aplicarlo contaría la pendiente dos veces. Todo el detalle en [[aerial-roof-measurement|Medición aérea del techo]]." },
        ],
      },
      {
        id: "tracing-by-hand",
        heading: "Trazar a mano",
        blocks: [
          { p: "Dos superficies se trazan en lugar de modelarse. En un presupuesto de **adoquinado**, el diseñador muestra una foto satelital de la dirección y usted traza la entrada o el patio y fija la escala con una línea cuya longitud conoce. En la estimación instantánea de **corte de césped**, el propietario dibuja su césped en un mapa de Google y el servidor recalcula la superficie. No hay trazado manual de techo: cuando Solar no tiene modelo, el techo se escribe a mano." },
        ],
      },
      {
        id: "what-leaves-the-building",
        heading: "Qué sale de la empresa",
        blocks: [
          { p: "La dirección tal como se escribe, para autocompletar y geocodificar; las coordenadas de un trabajo, para el modelo de techo, la imagen del mapa y la pregunta del tiempo de manejo. Eso es lo que la propia página de privacidad de FieldQuo lista para Google Maps y Google Solar, y nada más — ningún nombre de cliente, ningún teléfono, ningún presupuesto. El navegador de un visitante también habla directamente con Google en la página de reservas y en la de estimación instantánea, porque el autocompletado corre en el navegador." },
        ],
      },
      {
        id: "not-integrated",
        heading: "Qué no está integrado",
        blocks: [
          { bullets: [
            "No hay indicaciones paso a paso ni optimización de rutas. FieldQuo coloca las visitas y comprueba el viaje entre ellas; no planifica la ruta de un día.",
            "No hay mapa en vivo de la cuadrilla. El reloj de asistencia toma una sola ubicación cuando una persona marca entrada o salida, y nada en medio.",
            "No hay sugerencias de dirección en el formulario de creación de trabajos ni en el formulario de clientes potenciales del sitio web — esos toman una dirección escrita.",
            "Sin costo para usted y sin medición. La medición de techos está incluida en todos los planes.",
          ] },
        ],
      },
      {
        id: "who-can-see-it",
        heading: "Quién puede usarlo",
        blocks: [
          { p: "Cualquiera con sesión iniciada puede medir un techo o una entrada — las rutas solo piden una sesión, y vive en el constructor de presupuestos, así que en la práctica es quien redacta presupuestos: el propietario, los administradores, gerentes, despachadores y estimadores. Los propietarios de viviendas lo usan sin cuenta en las estimaciones instantáneas de techado y césped que usted publica." },
        ],
      },
    ],
    faq: [
      { q: "¿Por qué la medición cayó en la casa equivocada?", a: "El marcador está donde Google geocodificó la dirección, y Solar devuelve el edificio más cercano. El panel dice a qué distancia estaba el marcador del edificio medido; revise la imagen, y escriba la superficie a mano cuando sea el vecino." },
      { q: "¿Medir cuesta crédito?", a: "No. Nada de Google Maps ni de Solar se descuenta de su crédito." },
      { q: "¿La ubicación de la cuadrilla va a Google?", a: "No. Una marcación se compara con las coordenadas guardadas del trabajo del lado de FieldQuo; solo la dirección del trabajo se geocodificó, una vez, al crearlo." },
    ],
  },

  "photos-and-files": {
    title: "Fotos y archivos (Cloudinary)",
    summary:
      "Dónde se guarda cada foto y documento que sube, los límites de tamaño y tipo, qué fotos pueden llegar a su sitio web y sus presupuestos, y la respuesta honesta sobre borrar.",
    updated: "2026-09-12",
    intro: [
      "Cada foto, video y PDF que entra en FieldQuo — una foto de trabajo, su logotipo, las fotos de un propietario en una solicitud de presupuesto, un permiso en un trabajo, un recibo — se guarda en Cloudinary, en una carpeta que pertenece a su empresa. Las subidas las firma el servidor de FieldQuo archivo por archivo, así que no existe ningún token público de subida que alguien pudiera reutilizar, y un cliente que sube a su formulario de autopresupuesto pasa por la misma puerta a una carpeta **leads** suya.",
      "Este artículo son los límites, los lugares donde se muestran las fotos, las etapas fijas que deciden qué puede hacerse público, y lo que FieldQuo no hace con los archivos.",
    ],
    sections: [
      {
        id: "overview",
        heading: "Vista general",
        blocks: [
          { table: {
            head: ["Tipo", "Aceptado", "Límite"],
            rows: [
              ["Foto", "JPEG, PNG, WebP, GIF, HEIC y HEIF — una foto de iPhone sube tal cual", "15 MB"],
              ["Video", "MP4, MOV, WebM, Ogg y 3GP", "100 MB"],
              ["Documento", "Solo PDF", "25 MB"],
              ["Logotipo", "Los tipos de foto más SVG", "15 MB"],
            ],
          } },
          { p: "Un archivo rechazado recibe una frase, no una rueda girando: el mensaje pide subir una foto (JPEG, PNG, HEIC…), un video (MP4, MOV, WebM) o un PDF, o avisa que una foto supera los 15 MB y pide una más pequeña. Un PDF se guarda byte a byte con un nombre aleatorio; el nombre del archivo que subió nunca forma parte de la dirección." },
        ],
      },
      {
        id: "where-photos-live",
        heading: "Dónde viven las fotos y los archivos",
        blocks: [
          { bullets: [
            "**Fotos del trabajo** — en la página del trabajo bajo **Fotos del trabajo**, subidas allí o enviadas por texto por la cuadrilla, archivadas en una de cuatro etapas fijas: **Before / start**, **In progress**, **Finished**, **Issue / snag**. Sus propias etiquetas de **Configuración → Etiquetas de fotos de trabajo** van encima. Vea [[job-photos-and-tags|Fotos y etiquetas de trabajo]].",
            "**Fotos del cliente** — lo que un propietario adjuntó a una solicitud de autopresupuesto o de estimación instantánea, o lo que usted añadió en el constructor de presupuestos con **Agregar fotos o un video**. Se muestran a su personal en el presupuesto, el prospecto y la factura; no se imprimen en el PDF del presupuesto ni se muestran en la página de aprobación del cliente.",
            "**Pares Antes y después** en **Configuración → Correo de presupuesto** — hasta 4 pares que van en cada correo de presupuesto.",
            "**Su sitio web** — las imágenes de encabezado, de nosotros, de llamada a la acción y de servicios, la galería, y las fotos de trabajo que marca con estrella para mostrarlas en el sitio.",
            "**Documentos** — planos, permisos y contratos en un trabajo, seguros y certificados en un subcontratista, matrícula y seguro en un vehículo, y recibos escaneados a un gasto (solo fotos — un recibo en PDF se rechaza).",
          ] },
          { figure: "live:app-settings-job-photo-tags", caption: "Configuración → Etiquetas de fotos de trabajo — sus propias palabras sobre las cuatro etapas fijas, con etiquetas para empezar y un botón Retirar." },
        ],
      },
      {
        id: "what-goes-public",
        heading: "Qué puede hacerse público",
        blocks: [
          { p: "Las etapas son fijas porque son la regla. Solo una foto de trabajo que usted marcó con estrella como destacada llega a su sitio web, y una foto **Issue / snag** nunca puede destacarse — el servidor rechaza diciendo que una foto de problema no puede ir en su sitio y que cambie antes su etapa. La pestaña de fotos de trabajo del Creador de marketing y el flujo de crear una publicación desde un trabajo tampoco ven nunca una foto de problema. Todo lo demás se queda dentro de la oficina." },
          { steps: [
            "Abra el trabajo y sus **Fotos del trabajo**.",
            "Fije la etapa en cada foto — el texto de la cuadrilla se lee buscando palabras como «antes» y «terminado» para adivinarla, y usted puede corregirla.",
            "Marque con estrella las que quiera mostrar en su sitio web. Aparecen en la galería de trabajos del sitio; quite la estrella para retirarlas.",
          ] },
        ],
      },
      {
        id: "deleting",
        heading: "Borrar",
        blocks: [
          { warning: "No hay botón de borrar en una foto de trabajo, un documento de trabajo ni las fotos de un cliente, y FieldQuo no quita archivos del almacenamiento cuando se elimina un trabajo o se saca una foto del sitio de la biblioteca. Reemplazar su logotipo elimina el anterior; esa es la excepción. Si una foto no debe existir — un propietario lo pide, o se tomó por error — cambie su etapa a Issue / snag para que nunca pueda hacerse pública, y luego envíe una solicitud de eliminación; vea [[data-and-privacy|Sus datos, los de sus clientes y la eliminación]]. Los datos de ubicación dentro de una imagen (EXIF) ni se leen ni se quitan." },
        ],
      },
      {
        id: "who-can-see-it",
        heading: "Quién puede verlo",
        blocks: [
          { p: "Cualquiera con sesión iniciada puede subir. Archivar una foto en un trabajo solo necesita acceso de lectura a ese trabajo, así que un acceso de Cuadrilla puede añadir fotos a los trabajos en los que está. Fijar la etapa, destacar para el sitio web, los pies de foto y las etiquetas necesitan acceso de edición a trabajos. Las etiquetas de fotos de trabajo las gestionan el propietario, los administradores y los niveles Gerente y Despachador. Las fotos del sitio web son del propietario y los administradores; el logotipo, de cualquiera que pueda gestionar personas." },
        ],
      },
    ],
    faq: [
      { q: "¿Puedo adjuntar un archivo a un cliente?", a: "No. Los archivos se adjuntan a un trabajo, un presupuesto, un subcontratista, un vehículo o un gasto — no a la ficha del cliente." },
      { q: "¿Funcionan las fotos HEIC de un iPhone?", a: "Sí. HEIC y HEIF se aceptan y se convierten para mostrarse; los videos MOV también." },
      { q: "¿Hay un límite de almacenamiento?", a: "FieldQuo no muestra ninguna cuota ni fija un tope por empresa; los límites son por archivo. Si el almacenamiento alguna vez rechaza un archivo, el mensaje lo dice en lugar de fallar en silencio." },
    ],
  },

  "email-delivery": {
    title: "Entrega de correos (Resend) y su propio dominio",
    summary:
      "De quién parecen venir sus presupuestos y facturas, cómo enviarlos desde su propio dominio en lugar de la dirección compartida de FieldQuo, dónde caen las respuestas, y qué no puede decirle FieldQuo sobre un rebote.",
    updated: "2026-09-12",
    intro: [
      "Cada presupuesto, factura, recibo, recordatorio y solicitud de reseña sale con **el nombre de su empresa** como remitente. Hasta que conecte un dominio, la dirección detrás de ese nombre es la dirección de envío compartida de FieldQuo; después de verificar uno en **Configuración → Dominio de correo**, la dirección es suya — **quotes@send.suempresa.com**, por ejemplo — y ningún «via fieldquo.com» aparece junto a su nombre en la bandeja del cliente.",
      "La entrega en sí la hace Resend, un servicio de correo que el cliente nunca ve. Este artículo es el remitente, el dominio, las respuestas, y los límites honestos: FieldQuo no sabe nada de un mensaje después de que Resend lo acepta.",
    ],
    sections: [
      {
        id: "overview",
        heading: "Vista general",
        blocks: [
          { p: "La línea De se construye igual para cada correo a un cliente: el nombre de su empresa, y luego una dirección. Sin dominio propio, la dirección está en el dominio de envío compartido de FieldQuo y el nombre sigue siendo el suyo. Con un dominio verificado, la dirección es la **Dirección del remitente** que eligió, en su dominio. Las respuestas van siempre al correo de empresa de Configuración de la empresa — o, si está vacío, al correo de inicio de sesión del propietario de la cuenta — nunca a la dirección compartida." },
          { p: "Los correos a clientes salen además en el idioma del cliente, y el correo que acompaña un presupuesto en el idioma del presupuesto; vea [[a-clients-language|El idioma de un cliente]]." },
          { figure: "live:app-settings-email-domain", caption: "Configuración → Dominio de correo — el dominio con su estado, los registros DNS por agregar, el editor de Dirección del remitente y adónde van las respuestas." },
        ],
      },
      {
        id: "connect-a-domain",
        heading: "Cómo enviar desde su propio dominio",
        blocks: [
          { steps: [
            "Abra **Configuración → Dominio de correo**. Bajo **Conectar un dominio**, escriba un subdominio como **send.suempresa.com** — un subdominio en lugar de su dominio raíz, para que no interfiera con su buzón actual — y pulse **Conectar**.",
            "La página muestra **Agrega estos registros DNS**: el tipo, el nombre y el valor de cada uno, con **Copiar valor** al lado. Agréguelos con quien aloje el DNS de su dominio, manteniendo el nombre exactamente como se muestra.",
            "Guarde en su proveedor y déjelo estar. La mayoría aplica los cambios en menos de una hora, algunos tardan hasta 24. La página vuelve a comprobar sola cada 30 segundos mientras el estado diga **Esperando el DNS**; **Comprobar verificación** pregunta de inmediato.",
            "Cuando el estado diga **Verificado**, la tarjeta dice **Los correos se enviarán desde quotes@send.suempresa.com**. Cambie la parte antes de la @ bajo **Dirección del remitente** y pulse **Guardar** — letras, números, puntos, guiones o guiones bajos. No necesita ser un buzón real.",
          ] },
          { note: "Los registros prueban que el dominio es suyo, que es lo que permite a FieldQuo enviar como usted. Nada sale de su dominio hasta que esté verificado; hasta entonces la tarjeta de estado dice **Tus correos se envían actualmente desde la dirección compartida de FieldQuo, usando el nombre de tu empresa.** Un dominio que termine en fieldquo.com se rechaza, y un dominio ya conectado a otra empresa en FieldQuo se rechaza con una frase que lo explica." },
        ],
      },
      {
        id: "what-each-control-changes",
        heading: "Qué cambia cada control",
        blocks: [
          { table: {
            head: ["Control", "Qué cambia"],
            rows: [
              ["**Conectar**", "Registra el dominio para envío y muestra los registros DNS. Reemplaza cualquier dominio conectado antes."],
              ["**Comprobar verificación**", "Pregunta si los registros DNS ya están en su lugar. El estado pasa a Verificado, Esperando el DNS o Verificación fallida."],
              ["**Dirección del remitente → Guardar**", "La parte antes de la @ en cada correo a clientes una vez verificado. Por defecto: quotes."],
              ["**Desconectar**", "Quita el dominio. Los correos vuelven a la dirección compartida de FieldQuo, todavía con el nombre de su empresa. Nada ya enviado cambia."],
              ["**Respuestas**", "No es un control — muestra dónde cae una respuesta: su correo de empresa, o el del propietario cuando no hay ninguno. Cámbielo en Configuración de la empresa."],
            ],
          } },
        ],
      },
      {
        id: "which-emails",
        heading: "Qué correos lo usan",
        blocks: [
          { p: "Todo lo que recibe un **cliente**: presupuestos, facturas y solicitudes de pago, correos de depósito y de cuotas, facturas de planes de servicio, seguimientos y recordatorios, solicitudes de reseña, confirmaciones y cambios de reserva, confirmaciones de autopresupuesto y de estimación instantánea, y campañas de marketing. Las campañas de marketing, las solicitudes de reseña y los seguimientos de trabajo terminado llevan además un enlace de baja en un clic; los correos transaccionales como un presupuesto o una factura no lo llevan a propósito." },
          { p: "Los correos que FieldQuo le envía **a usted** — invitaciones al equipo, restablecimientos de contraseña, avisos de facturación, alertas de crédito telefónico, el resumen mensual — vienen de las direcciones propias de FieldQuo sea cual sea el dominio que conecte, porque vienen de FieldQuo." },
        ],
      },
      {
        id: "limits",
        heading: "Qué no puede decirle FieldQuo",
        blocks: [
          { bullets: [
            "**Rebotes.** Una vez que Resend acepta un mensaje, FieldQuo no oye nada más. No hay informe de rebotes ni marca de «dirección mala» en un cliente. Lo que sí comprueba es la dirección misma antes de enviar, y le avisa de inmediato cuando Resend rechaza un envío.",
            "**Respuestas.** La respuesta de un cliente va a su buzón, por la dirección de respuesta. No aparece dentro de FieldQuo.",
            "**Aperturas y clics.** No se rastrean.",
            "**Límites de envío.** FieldQuo no fija ninguno propio; un mensaje de «limitación» en un envío es de Resend, y pasa en un momento.",
          ] },
        ],
      },
      {
        id: "who-can-see-it",
        heading: "Quién puede verlo",
        blocks: [
          { p: "Configuración → Dominio de correo es para el **propietario, los administradores y los niveles Gerente y Despachador** — cualquiera que pueda gestionar personas. Los accesos de Cuadrilla y Estimador no ven la fila, y la ruta los rechaza. Todos los planes lo incluyen; no hay complemento de pago por su propio dominio." },
        ],
      },
    ],
    faq: [
      { q: "¿Necesito mi propio dominio?", a: "No. Sin uno, los correos salen con el nombre de su empresa desde la dirección compartida de FieldQuo, y las respuestas llegan igual a su propio buzón. Un dominio verificado quita la mención «via» que algunas bandejas muestran y mejora la entregabilidad." },
      { q: "¿Qué registros DNS agrego?", a: "Exactamente los que la página lista para su dominio — copie cada valor con el botón. La página no inventa una lista genérica; los registros se leen del servicio de envío para su dominio." },
      { q: "¿Adónde van las respuestas de mis clientes?", a: "Al correo de empresa de Configuración de la empresa. Si está en blanco, al correo de inicio de sesión del propietario de la cuenta, y la página lo dice en ámbar hasta que fije uno." },
    ],
  },

  "quickbooks-xero-and-your-bookkeeper": {
    title: "QuickBooks, Xero y su contador",
    summary:
      "No hay sincronización en vivo con QuickBooks ni con Xero. Lo que existe es una exportación contable — cuatro archivos CSV para un periodo — y este artículo dice exactamente qué contiene y qué no.",
    updated: "2026-09-12",
    intro: [
      "«¿Funciona con QuickBooks?» La respuesta honesta: sus números pueden salir de FieldQuo como archivos limpios que su contador importa, y nada se sincroniza en vivo. La **Exportación contable** en **Gastos** produce un ZIP con cuatro archivos CSV para cualquier periodo — una hoja resumen, facturas, pagos y gastos — y todos los contadores del mundo importan un CSV.",
      "Este artículo es esa exportación: cómo ejecutarla, qué lleva cada archivo, cómo aparecen las comisiones de procesamiento y los reembolsos, y las siete cosas que no contiene, impresas delante del botón y otra vez dentro del ZIP para que viajen con los números.",
    ],
    sections: [
      {
        id: "overview",
        heading: "Vista general",
        blocks: [
          { p: "Una sincronización bidireccional con QuickBooks Online o Xero no está construida. Las propias páginas comparativas de FieldQuo lo conceden: las palabras quickbooks, zapier y xero no aparecen en ningún código de integración. QuickBooks Desktop se rechaza de plano, porque necesita un conector de Windows. Lo que está construido es la exportación, y es la misma que describen el artículo de comisiones y las páginas de cuentas por cobrar." },
          { p: "La tarjeta está al final de **Gastos** (la misma pantalla que **Configuración → Control de gastos**): **Exportación contable — Un periodo de facturas, pagos y gastos en cuatro archivos CSV dentro de un ZIP — una hoja resumen más un archivo de cada uno — para entregar a un contador o importar en su software.** Los importes están en la moneda de facturación de su empresa, definida en Configuración de la empresa; sin ella la exportación se niega en vez de adivinar." },
          { figure: "live:app-settings-expense-tracking", caption: "Seguimiento de gastos — las tarjetas del mes y la tarjeta Exportación contable al final, con Desde, Hasta y Descargar el periodo." },
        ],
      },
      {
        id: "how-to-run-it",
        heading: "Cómo ejecutarla",
        blocks: [
          { steps: [
            "Abra **Gastos** y baje hasta **Exportación contable**. El periodo por defecto es el mes pasado.",
            "Fije **Desde** y **Hasta**, y luego lea **Lo que este archivo no contiene** debajo — esa es la lista que su contador necesita antes de importar.",
            "Pulse **Descargar el periodo**. El ZIP se llama bookkeeping-… y contiene los CSV summary, invoices, payments y expenses.",
            "Entregue el ZIP a su contador, o importe cada archivo en QuickBooks Online o Xero con su importador de CSV, asignando las columnas una sola vez.",
          ] },
        ],
      },
      {
        id: "what-each-file-carries",
        heading: "Qué lleva cada archivo",
        blocks: [
          { table: {
            head: ["Archivo", "Una línea por", "Columnas de dinero"],
            rows: [
              ["summary", "exportación — empresa, periodo, y luego una fila por moneda", "Facturado, de lo cual impuesto, Pagos recibidos, Reembolsos, Comisiones de procesamiento, Comisiones de cuenta Stripe, Gastos"],
              ["invoices", "factura — la última versión de una factura modificada, fechada con la original", "Subtotal, Descuento, Impuesto, si el impuesto estaba activado, Total, Pagado, Recibido en el periodo, Pendiente"],
              ["payments", "pago — en la fecha propia del pago, no la de la factura", "Importe (bruto), Comisión de procesamiento, Neto depositado, Tasa de comisión, Comisiones de cuenta Stripe"],
              ["expenses", "gasto", "Importe, con Categoría, Gastos generales sí/no, Recurrente, Frecuencia y Trabajo"],
            ],
          } },
          { p: "Asiente el bruto a ingresos y la comisión de procesamiento a un gasto de comisiones bancarias desde la misma línea de pago; el extracto bancario coincide entonces con el **neto depositado**. Un reembolso emitido desde FieldQuo es su propia línea negativa en el archivo de pagos, con el método refund y el motivo en las notas, y se totaliza bajo Reembolsos en el resumen. Un reembolso hecho directamente en Stripe se refleja en el importe reembolsado del pago original, no como una línea." },
          { p: "Cada celda de texto que una persona escribió — un nombre de cliente, una categoría, una nota — está protegida para que no se ejecute como fórmula al abrir el archivo en Excel o Sheets." },
        ],
      },
      {
        id: "what-it-does-not-contain",
        heading: "Qué no contiene",
        blocks: [
          { bullets: [
            "Es una exportación, no una declaración. Nada se ha remitido a ninguna autoridad fiscal.",
            "No puede producir una declaración de impuestos. El impuesto es un importe único por factura, sin códigos ni detalle por línea — una factura de Quebec con GST y QST tiene dos tasas y un solo número.",
            "Los gastos no llevan impuesto ni proveedor, así que los créditos fiscales por compras no están aquí.",
            "Las notas de crédito no existen. Los reembolsos aparecen como sus propias líneas negativas.",
            "No hay plan de cuentas. Nada está asignado a una cuenta contable — su contador lo hace una vez, al importar.",
            "Las columnas de comisiones solo se rellenan para pagos en línea cobrados después de que las comisiones empezaron a registrarse en el pago (septiembre de 2026); los pagos con tarjeta anteriores y todos los pagos manuales las dejan vacías en vez de escribir 0.00.",
            "Los días se agrupan en UTC, y no hay campo de fecha de emisión de factura — cada factura indica de qué columna sale su fecha.",
          ] },
          { warning: "Dígale a su contador que es un conjunto limpio de registros, no un libro mayor ni una sincronización con QuickBooks. Un contador que lo importa esperando un libro mayor y descubre que no lo es culpa al software; la lista de arriba está impresa delante del botón para evitarlo." },
        ],
      },
      {
        id: "who-can-see-it",
        heading: "Quién puede verlo",
        blocks: [
          { p: "La pantalla de Gastos en sí necesita acceso a los gastos de **todos** en la cuadrícula de acceso — el propietario, los administradores y el nivel Gerente; un estimador o un despachador registra sus propios recibos pero no ve el consolidado de la empresa. En esa pantalla la tarjeta aparece solo para una persona cuyo acceso tenga además **Ver precios** activado y facturas en **solo lectura** o mejor. La ruta hace las mismas preguntas a la misma cuadrícula, así que quien no las cumple no recibe tarjeta en lugar de una tarjeta que falla." },
        ],
      },
    ],
    faq: [
      { q: "¿Habrá una sincronización con QuickBooks?", a: "Hoy no, y FieldQuo no la anuncia en sus páginas comparativas. La exportación es la puerta que existe; una sincronización en vivo sería una aplicación aprobada por Intuit con su propia revisión de seguridad, y por eso no es un añadido rápido." },
      { q: "¿Puede mi contador iniciar sesión en su lugar?", a: "Sí — invítelo desde Gestionar equipo. Hágalo administrador si debe ver la facturación; si no, un nivel Gerente ve facturas, pagos y gastos y puede ejecutar la exportación." },
      { q: "¿Por qué las columnas de comisiones están vacías en algunos pagos?", a: "Un pago manual no lleva comisión, y un pago en línea cobrado antes de que las comisiones se registraran en el pago no tiene comisión conocida. Una celda vacía dice «no se conoce la comisión»; un 0.00 diría «sin comisión», que es otra afirmación." },
    ],
  },

  "stock-photos-on-your-website": {
    title: "Fotos de stock en su sitio web (Unsplash)",
    summary:
      "Por qué un sitio web nuevo empieza con fotos de stock en sus espacios decorativos, qué espacios nunca reciben una, cómo reemplazarlas, y qué envía a Unsplash el navegador de un visitante.",
    updated: "2026-09-12",
    intro: [
      "Un sitio web escrito a partir de sus datos el primer día todavía no tiene fotos de su trabajo, así que el constructor rellena los espacios **decorativos** — el fondo del encabezado, la imagen de nosotros, el fondo de la llamada a la acción y hasta cuatro imágenes de servicios — con fotos de stock elegidas para su oficio. Nunca pone una foto de stock en **Nuestro trabajo**, la galería ni un par de antes y después, porque esas secciones dicen que las fotos son trabajos que usted hizo, y una foto de stock allí sería una afirmación falsa a un propietario.",
      "Las fotos se cargan desde los propios servidores de Unsplash, no se copian. Ese es el único dato de privacidad de este artículo, y la razón para reemplazarlas: su propio trabajo siempre vende mejor que un banco de imágenes.",
    ],
    sections: [
      {
        id: "overview",
        heading: "Vista general",
        blocks: [
          { p: "El constructor guarda un pequeño conjunto de fotos por oficio — techado, exteriores, pintura, cocinas, pisos, jardinería, concreto, plomería, electricidad, limpieza y un conjunto general — cada una revisada por una persona antes de fijarse. Un espacio que ya tiene una imagen suya nunca se sobrescribe, y un espacio recibe una foto de stock solo mientras está vacío. Nada del texto de su sitio es de stock: cada frase se escribe a partir de lo que usted le contó a FieldQuo." },
          { figure: "live:app-settings-website", caption: "Configuración → Tu sitio web — el constructor con su instrucción, los selectores de diseño y estilo, y la vista previa donde aparecen las fotos de stock en los espacios decorativos." },
        ],
      },
      {
        id: "replace-them",
        heading: "Cómo reemplazarlas",
        blocks: [
          { steps: [
            "Abra **Configuración → Tu sitio web** y pulse **Agregar mis fotos** para subir las suyas; van a su biblioteca de fotos y a la galería.",
            "En **Ajustar**, abra la sección de encabezado, de nosotros o de llamada a la acción y use **Agregar foto** en su imagen — o **Quitar imagen** para dejar el espacio vacío sin foto de stock.",
            "Marque con estrella fotos de un trabajo terminado para mostrarlas en el sitio; vea [[photos-and-files|Fotos y archivos]].",
            "Pulse **Publicar**. Si todavía queda alguna foto de stock, un diálogo dice **{count} fotos de stock aún en tu sitio** y explica dónde están, con **Agregar mis fotos** allí mismo. Puede publicar de todos modos y cambiarlas después.",
          ] },
          { note: "Regenerar el sitio conserva las imágenes de encabezado y de nosotros, la galería y los pares de antes y después que usted fijó — esa es la corrección de una versión anterior que destruía las fotos subidas al regenerar. No conserva una imagen de llamada a la acción o de servicio fijada a mano; esos dos espacios se reconstruyen, así que fíjelos al final." },
        ],
      },
      {
        id: "what-a-visitor-sends",
        heading: "Qué envía a Unsplash el navegador de un visitante",
        blocks: [
          { p: "FieldQuo no envía nada de nadie a Unsplash. Pero como una foto de stock es un enlace a images.unsplash.com y no una copia, un propietario que abre su sitio descarga esa imagen directamente de Unsplash, y los servidores de Unsplash ven su dirección IP y su navegador — igual que cualquier imagen enlazada en la web. En cuanto reemplaza una foto de stock por una suya, esa petición se detiene; sus fotos se sirven desde su propio almacenamiento. No se imprime ninguna atribución en el sitio; la licencia no la exige." },
        ],
      },
      {
        id: "elsewhere",
        heading: "Dónde más aparecen fotos de stock",
        blocks: [
          { p: "El **Creador de marketing** tiene una pestaña de stock que muestra fotos de Unsplash con el nombre del fotógrafo al pasar el cursor; cuando publica un diseño, todo el lienzo se convierte en una sola imagen y se guarda con sus archivos, así que el anuncio publicado no es un enlace externo. Las fotos de stock no se usan en embudos, en el enlace de bio, en PDF ni en correos de presupuesto." },
        ],
      },
      {
        id: "who-can-see-it",
        heading: "Quién puede cambiarlo",
        blocks: [
          { p: "El constructor del sitio web — incluido subir y quitar fotos — es para el **propietario y los administradores**. Cualquiera con el enlace ve el sitio publicado." },
        ],
      },
    ],
    faq: [
      { q: "¿Puedo desactivar por completo las fotos de stock?", a: "Quite la imagen de una sección y el espacio queda vacío; una foto de stock solo se coloca donde un espacio está vacío al generar. Llene los espacios con sus propias fotos y no queda ninguna foto de stock." },
      { q: "¿Mis clientes sabrán que son de stock?", a: "Aparecen solo en los espacios decorativos, nunca presentadas como su trabajo. El diálogo de publicación cuenta lo que queda para que usted decida a sabiendas." },
    ],
  },

  "data-and-privacy": {
    title: "Sus datos, los de sus clientes y la eliminación",
    summary:
      "Quién controla qué, qué servicios externos ven qué datos, qué recibe y qué no recibe la IA, qué puede exportar, y el hecho simple de que nada se elimina por calendario — su cuenta incluida.",
    updated: "2026-09-12",
    intro: [
      "Dos clases de datos viven en su cuenta de FieldQuo. Los datos de su **empresa** — sus cuentas de personal, su plan, su tarjeta — son de FieldQuo para cuidarlos. Los datos de sus **clientes** — sus nombres, direcciones, presupuestos, fotos, llamadas — son suyos: usted es el responsable del tratamiento y FieldQuo es su encargado, y por eso a un propietario que quiere cambiar o eliminar sus datos se le pide acudir primero a usted.",
      "Este artículo es el estado honesto de todo eso, leído del código y de la propia página de privacidad de FieldQuo: qué servicios externos reciben qué, qué recibe la IA, qué puede sacar, y qué significa hoy eliminar — una solicitud que atiende una persona, no un botón.",
    ],
    sections: [
      {
        id: "overview",
        heading: "Vista general",
        blocks: [
          { bullets: [
            "**Dónde vive.** Una sola base de datos Postgres alojada en Neon, el producto alojado en Vercel, las fotos y los documentos guardados en Cloudinary, en una carpeta por empresa. Cifrado en tránsito en todas partes, y en reposo a través de esos proveedores. FieldQuo no afirma en qué país se guardan los datos, porque nada en el producto fija uno.",
            "**Quién en FieldQuo puede verlos.** El soporte mira la cuenta de un cliente mediante una sesión de solo lectura, registrada, de 30 minutos, que puede verlo todo y no cambiar nada. La única excepción es el servicio de migración de pago, que crea los registros nuevos que usted pidió y nunca modifica los existentes; vea [[the-data-migration-service|El servicio de migración de datos]].",
            "**Nunca se venden, nunca se comparten entre empresas.** La IA de FieldQuo responde solo sobre sus datos, y la comparativa de precios anonimizada es opcional, reunida con las demás empresas que participan, publicada solo cuando hay al menos cinco presupuestos detrás de una cifra, y nunca muestra los precios de una sola.",
          ] },
        ],
      },
      {
        id: "who-else-sees-it",
        heading: "Qué servicios ven qué datos",
        blocks: [
          { p: "La página de privacidad de FieldQuo lista cada servicio externo al que el producto está conectado, y la compilación falla si la lista deja de coincidir con el código. Esta es esa lista, en las palabras que le importan a un contratista." },
          { table: {
            head: ["Servicio", "Qué recibe"],
            rows: [
              ["Stripe", "La tarjeta o los datos bancarios de un cliente cuando le paga — escritos en la página de Stripe, nunca guardados por FieldQuo — y, aparte, su propia tarjeta para su suscripción. Vea [[stripe|Stripe]]."],
              ["Resend", "Cada correo enviado en su nombre: el destinatario y todo su contenido. Vea [[email-delivery|Entrega de correos]]."],
              ["Twilio y Retell", "El teléfono de un cliente y el texto de un recordatorio; para la recepcionista, el audio en vivo, la grabación y la transcripción de cada llamada. Vea [[phone-and-texts|Números de teléfono y mensajes de texto]]."],
              ["Cloudinary", "Cada foto y documento subido, incluidas las fotos de un propietario en una solicitud de presupuesto. Vea [[photos-and-files|Fotos y archivos]]."],
              ["OpenAI", "Fotos de una propiedad para la revisión de un presupuesto, transcripciones de llamadas para un borrador o el resumen mensual, y — para la IA de FieldQuo — solo el nombre de un cliente, nunca sus datos de contacto, su dirección ni su historial financiero."],
              ["Google Maps y Solar", "Una dirección tal como se escribe, y las coordenadas de un trabajo. Vea [[google-maps-and-solar|Google Maps y Google Solar]]."],
              ["Meta", "El token de acceso de su cuenta publicitaria, y a cambio sus propias cifras de gasto y campañas. Ningún dato de clientes va a Meta. Vea [[facebook-and-instagram|Facebook e Instagram]]."],
              ["Unsplash", "Nada de parte de FieldQuo — pero un visitante de un sitio con fotos de stock las descarga directamente de Unsplash. Vea [[stock-photos-on-your-website|Fotos de stock en su sitio web]]."],
            ],
          } },
          { note: "La IA nunca recibe su base de datos. Se le entrega una lista de consultas, elige una, y recibe de vuelta un pequeño conjunto de números ya calculados por FieldQuo; la empresa está fijada en el código, así que ninguna pregunta puede llegar a los datos de otra empresa, y una persona cuyo acceso oculta los precios no recibe ninguna consulta de dinero. Vea [[fieldquo-ai-ask-about-your-business|La IA de FieldQuo]]." },
        ],
      },
      {
        id: "what-your-clients-can-do",
        heading: "Qué pueden hacer sus clientes, y qué no",
        blocks: [
          { p: "El portal de un cliente muestra sus presupuestos y facturas con usted y le permite pagar; no es una herramienta de acceso a datos. Un cliente puede darse de baja del correo de marketing en un clic — el registro se conserva para siempre, a propósito — y responder STOP a un mensaje de texto. Nada permite a un propietario ver, corregir, exportar o eliminar su propia información por sí mismo; se lo pide a usted, y usted actúa en FieldQuo o reenvía la solicitud a FieldQuo. Vea [[client-consent-and-unsubscribes|Consentimiento de clientes y bajas]]." },
        ],
      },
      {
        id: "what-you-can-take-out",
        heading: "Qué puede sacar",
        blocks: [
          { bullets: [
            "**Exportación contable** — un ZIP con cuatro CSV (resumen, facturas, pagos, gastos) para cualquier periodo, desde Gastos. Vea [[the-accounting-export|La exportación contable]].",
            "**Lista de precios** — Exportar CSV en Configuración → Productos y servicios, costos incluidos.",
            "**Lista de fin de año (CSV)** de subcontratistas y el **CSV de cada corrida de nómina**.",
            "**PDF** — cada presupuesto, factura, recibo de nómina e informe fotográfico de trabajo.",
          ] },
          { warning: "No hay exportación de clientes, trabajos, prospectos ni fotos, y no hay «descargar todo». Antes de pedir la eliminación de una cuenta, tome las exportaciones de arriba y guarde los PDF que quiera; la eliminación no es reversible y FieldQuo no conserva ninguna copia para usted después." },
        ],
      },
      {
        id: "deleting",
        heading: "Eliminar, en el producto y por solicitud",
        blocks: [
          { p: "En el producto, un presupuesto, un trabajo, una factura o un gasto puede eliminarse desde su propia pantalla por alguien cuyo acceso lo permita — el nivel Gerente y superiores. Una ficha de cliente no tiene hoy botón de eliminar. Desconectar Meta Ads elimina de inmediato el token guardado; el gasto importado se queda. Las fotos y los documentos nunca se quitan del almacenamiento desde ninguna pantalla; vea [[photos-and-files|Fotos y archivos]]." },
          { p: "Nada caduca por calendario. **Cancelar su plan no elimina nada**: la cuenta queda en solo lectura durante 30 días y luego se bloquea, y reactivar el plan lo devuelve todo, exactamente como dice la pantalla de cancelación — **No se elimina nada. Tus cotizaciones, clientes, trabajos, facturas y fotos quedan tal cual.** Vea [[cancel-your-subscription|Cancelar su suscripción]] y [[closing-your-account|Cerrar su cuenta]]." },
          { steps: [
            "Para que se eliminen datos — los de un cliente, o toda la cuenta — envíe una solicitud desde el correo del propietario de la cuenta a la dirección de soporte de FieldQuo, o use el formulario de eliminación en el propio sitio web de FieldQuo. FieldQuo confirma primero quién es usted.",
            "Recibe un código de referencia y un correo de confirmación. La eliminación la hace a mano el propietario de FieldQuo en un plazo de **30 días hábiles**; la referencia le permite consultar su estado en la misma página.",
            "Un correo de finalización la cierra. Los registros de bajas y de STOP, los registros financieros y fiscales, y el registro de la propia solicitud se conservan, a propósito.",
          ] },
          { p: "Si un propietario quita FieldQuo de su configuración de Facebook, Meta envía a FieldQuo una solicitud de eliminación de la misma manera, con un código de referencia que puede consultar. Vea [[how-to-get-help|Cómo obtener ayuda]] para la dirección de soporte." },
        ],
      },
      {
        id: "who-can-see-it",
        heading: "Quién puede actuar sobre esto",
        blocks: [
          { p: "Cancelar el plan y solicitar una migración son para el **propietario y los administradores**. Una solicitud de eliminación de toda la cuenta debe venir de la dirección del propietario. Las exportaciones siguen el acceso de sus propias pantallas: la exportación contable necesita Ver precios y acceso de lectura a facturas, la exportación de la lista de precios necesita Ver precios, y la lista de subcontratistas necesita costeo de trabajos." },
        ],
      },
    ],
    faq: [
      { q: "¿Los datos de mis clientes se usan para entrenar una IA?", a: "El código de FieldQuo envía a la IA solo lo que lista la tabla de arriba, y el asistente recibe únicamente el nombre de un cliente. Lo que el proveedor hace con una petición después lo rige el acuerdo de FieldQuo con él, que la página de privacidad nombra; el producto en sí no afirma nada en ningún sentido." },
      { q: "¿Otro contratista en FieldQuo puede ver mis precios?", a: "No. La comparativa Cómo te comparas es opcional, reunida con las demás empresas que participan, publicada solo cuando hay al menos cinco presupuestos detrás de una cifra, y nunca muestra los precios de una sola. La IA de FieldQuo está ligada a su empresa en el código." },
      { q: "Si dejo de pagar, ¿mis datos desaparecen?", a: "No. La cuenta pasa a solo lectura y luego se bloquea; nada se borra, y pagar la restaura. Borrar es una solicitud escrita aparte." },
      { q: "¿Dónde se alojan los datos?", a: "Neon (base de datos), Vercel (el producto) y Cloudinary (archivos). FieldQuo no afirma un país concreto, porque no ha fijado uno." },
    ],
  },

  "no-public-api-or-zapier": {
    title: "Sin API pública ni Zapier, por ahora",
    summary:
      "FieldQuo no tiene claves de API, ni aplicación de Zapier, ni webhooks salientes, ni feed de calendario. Este artículo lo dice claro y lista las puertas que sí existen — incrustaciones, enlaces públicos, CSV de entrada y salida, la importación de Meta y el servicio de migración.",
    updated: "2026-09-12",
    intro: [
      "Si busca una clave de API para pegar en algún lado, no hay ninguna. FieldQuo no tiene **API pública**, **ni aplicación de Zapier o Make**, **ni webhooks que apunten a su propio sistema**, **ni feed de calendario** para Google u Outlook. Cada ruta del producto autentica a una persona con sesión iniciada, y los webhooks que existen son proveedores — Stripe, Meta, Twilio, Retell — que llaman a FieldQuo, no FieldQuo llamándolo a usted.",
      "Esa es toda la primera mitad. La segunda mitad es lo que sí existe, porque «cómo meto y saco datos» tiene respuestas reales incluso sin API.",
    ],
    sections: [
      {
        id: "overview",
        heading: "Vista general",
        blocks: [
          { p: "Las propias páginas comparativas de FieldQuo conceden estos puntos a la competencia en vez de insinuarlos: las palabras QuickBooks, Zapier y Xero no aparecen en ningún código de integración, solo en prosa. El plan registrado, en orden, es la exportación contable (construida), luego un webhook saliente firmado por evento (no construido), luego un envío de QuickBooks en un solo sentido (aplazado); una aplicación de Zapier publicada y una sincronización contable bidireccional se rechazan por ahora. Nada de esta página debe leerse como una fecha." },
        ],
      },
      {
        id: "doors-out",
        heading: "Las puertas de salida",
        blocks: [
          { table: {
            head: ["Puerta", "Qué sale", "Dónde"],
            rows: [
              ["**Exportación contable**", "Cuatro CSV — resumen, facturas, pagos, gastos — para un periodo, en un solo ZIP", "Gastos → Descargar el periodo. Vea [[quickbooks-xero-and-your-bookkeeper|QuickBooks, Xero y su contador]]."],
              ["**Exportar CSV**", "Su lista de precios, costos incluidos", "Configuración → Productos y servicios"],
              ["**Lista de fin de año (CSV)**", "Lo que se pagó a cada subcontratista en un año", "Subcontratistas"],
              ["**Exportar CSV** en una corrida de nómina", "Las líneas de una corrida de nómina", "Nómina"],
              ["PDF", "Cada presupuesto, factura, recibo de nómina e informe fotográfico de trabajo", "Sus propias pantallas, y el correo del cliente"],
            ],
          } },
          { p: "No hay exportación de clientes, trabajos, prospectos, citas ni fotos. Si se va, llévese estos archivos y los PDF; vea [[data-and-privacy|Sus datos, los de sus clientes y la eliminación]]." },
        ],
      },
      {
        id: "doors-in",
        heading: "Las puertas de entrada",
        blocks: [
          { bullets: [
            "**Importar** en Clientes — un CSV con nombre, correo, teléfono, dirección, ciudad, provincia. Vea [[import-clients-from-a-csv|Importar clientes desde un CSV]].",
            "**Trabajos pasados** en Trabajos — una fila se convierte en un presupuesto, un trabajo, una factura y su pago, para que su historial tenga números detrás. Vea [[import-past-jobs|Importar trabajos pasados]].",
            "**Importar** en Prospectos, e **Importar CSV** en Configuración → Productos y servicios.",
            "**Importar desde un CSV del banco** en Gastos — asignación de columnas, su formato de fecha, detección de duplicados. Vea [[import-expenses-from-a-bank-csv|Importar gastos desde un CSV del banco]].",
            "**Formularios de clientes potenciales de Facebook** — un cliente potencial enviado en un anuncio de Meta se convierte en un prospecto en FieldQuo, una vez que Meta apruebe el permiso. Vea [[facebook-lead-forms|Formularios de clientes potenciales de Facebook]].",
            "**El servicio de migración de datos** — el personal de FieldQuo trae los clientes y presupuestos de su sistema anterior por un precio cotizado, creando solo registros nuevos. Vea [[the-data-migration-service|El servicio de migración de datos]].",
          ] },
        ],
      },
      {
        id: "doors-on-your-website",
        heading: "Las puertas en su propio sitio web",
        blocks: [
          { p: "Lo que más a menudo se le pediría a una API — «poner FieldQuo en mi sitio» — es una incrustación. **Configuración → Comparte tus enlaces** da a cada página pública un enlace y un fragmento **Copiar código**: el calendario de reservas, el formulario de solicitud de presupuesto, la estimación instantánea, sus reseñas y cada embudo publicado. Pegue el fragmento en cualquier sitio web y el formulario funciona allí, ajustado al tamaño. Los mismos fragmentos están en Configuración → Página de reservas y Configuración → Cotizaciones instantáneas. Vea [[embed-booking-and-quote-forms|Incrustar formularios de reserva y de presupuesto]]." },
          { p: "Cada página pública también existe sola como enlace: la página de reservas, la solicitud de presupuesto, la estimación instantánea, un embudo, su sitio web generado, el portal del cliente, la página de aprobación de un presupuesto y la página de pago de una factura. Un enlace es una puerta que un propietario puede usar sin cuenta; vea [[share-your-links|Comparta sus enlaces]]." },
        ],
      },
      {
        id: "not-integrated",
        heading: "Qué no existe, en una lista",
        blocks: [
          { bullets: [
            "Ninguna clave de API, token ni ajuste de desarrollador en ningún lugar del producto.",
            "Ninguna aplicación de Zapier, Make ni automatización similar.",
            "Ningún webhook saliente — nada llama a su servidor cuando se aprueba un presupuesto o se paga una factura.",
            "Ningún feed de calendario ni sincronización con el calendario de Google / Outlook; el calendario de citas vive en FieldQuo.",
            "Ninguna sincronización contable en vivo con QuickBooks Online, Xero ni QuickBooks Desktop.",
            "Ningún correo entrante en FieldQuo; la respuesta de un cliente cae en su propio buzón.",
          ] },
          { tip: "Si necesita uno de estos para elegir FieldQuo, dígale a soporte cuál. El orden de arriba es el orden en que se están sopesando, y un cliente que lo pide es lo que hace avanzar un punto." },
        ],
      },
    ],
    faq: [
      { q: "¿Puedo conectar FieldQuo a mi CRM o a mi hoja de cálculo?", a: "Solo por archivo: las exportaciones CSV hacia afuera y las importaciones CSV hacia adentro. No hay enlace en vivo." },
      { q: "¿Mi sitio web puede enviar su propio formulario a FieldQuo?", a: "Use el fragmento de incrustación o un enlace a la página pública de solicitud de presupuesto — esa es la forma soportada para que un formulario de su sitio cree un prospecto. No hay un punto de entrada para un formulario que usted construyó por su cuenta." },
      { q: "¿Me avisarán cuando llegue una API?", a: "Configuración → Novedades del producto lleva cada cambio; aquí no se promete nada." },
    ],
  },
};
