// content/help/es/billing-and-subscription-1.js
//
// Parte 1 de la categoría «billing-and-subscription» en español (ver el
// compositor, billing-and-subscription.js). Misma estructura que el inglés,
// artículo por artículo: mismos slugs, mismas secciones en el mismo orden,
// mismos bloques, mismas figuras — scripts/check-help-centre.mjs compara los
// dos. Las palabras en pantalla vienen del bloque `es` de
// app/i18n/appMessages.js; las cifras, de lib/pricing/ladder.js,
// lib/pricing.js, lib/billing/access.js, lib/billing/renewalReminder.js y
// lib/referrals.
export const ARTICLES = {
  "your-plan-and-seats": {
    title: "Su plan y sus licencias",
    summary:
      "La pantalla Cuenta y facturación: en qué plan está, cuánto cuesta, cuántas licencias y accesos de cuadrilla incluye, cuándo cae el próximo cobro, y los cuatro botones debajo.",
    updated: "2026-09-12",
    intro: [
      "**Cuenta y facturación** es la única pantalla que trata de la relación entre su empresa y FieldQuo: el plan, el precio, la tarjeta, el próximo cobro. Todo lo demás en FieldQuo trata del dinero de sus clientes; esta página trata del suyo. Se llega desde **Plan**, al pie de la barra lateral, o desde **Configuración → Cuenta y facturación**.",
      "Este artículo recorre la pantalla de arriba abajo: la tarjeta del plan y qué significa cada línea, los cuatro botones, y la cuadrícula **Planes** debajo. Cambiar de plan, agregar personas y actualizar la tarjeta tienen cada uno su propio artículo, enlazado sobre la marcha.",
    ],
    sections: [
      {
        id: "overview",
        heading: "Resumen",
        blocks: [
          { p: "Su empresa está en uno de cuatro planes — Solo, Crew, Shop o Scale — y el plan decide dos números: cuántas **licencias** tiene (personas que crean o modifican presupuestos, trabajos y facturas) y cuántos accesos de **cuadrilla** vienen gratis con ellas. Nada más cambia entre planes: cada función está en cada plan. Vea [[the-four-plans|Los cuatro planes]]." },
          { p: "La suscripción la cobra Stripe en nombre de FieldQuo, en su propia moneda, cada mes o con un compromiso de un año. Es una relación con Stripe distinta de aquella por la que sus clientes le pagan a usted: esa vive en **Configuración → Pagos**, y la página le da un atajo hacia allí para que las dos nunca se confundan." },
        ],
      },
      {
        id: "what-is-on-the-screen",
        heading: "Qué hay en la pantalla",
        blocks: [
          { figure: "live:app-settings-account-billing", caption: "Cuenta y facturación — la tarjeta del plan con su etiqueta de estado y los cuatro botones, y luego la cuadrícula Planes con el selector Mensual / Compromiso de 1 año." },
          { p: "Bajo el título **Cuenta y facturación — Tu plan, asientos y datos de pago.**, la tarjeta del plan dice, por ejemplo, **Crew · Activo · $169.00/mes · 3 puestos · 8 miembros de cuadrilla incluidos gratis · Próxima fecha de facturación 2026-09-30**. Cada pieza de esa línea es un dato de su suscripción, y la tabla siguiente dice de dónde sale." },
          { table: {
            head: ["En la tarjeta", "Qué significa"],
            rows: [
              ["El nombre del plan (Solo, Crew, Shop, Scale)", "El nivel en el que está hoy. Si hay un cambio programado para más adelante, aquí sigue apareciendo el plan que tiene ahora."],
              ["La etiqueta de estado", "**Trial** durante su mes gratis (la etiqueta sigue en inglés por ahora), **Activo** cuando ya paga, **Atrasada** tras un pago fallido (corre un reloj de gracia — vea [[failed-payments-and-the-grace-period|Pagos fallidos y el período de gracia]]), **Cancelado** cuando se va."],
              ["El precio", "Mostrado en la frecuencia con la que realmente se le cobra: **$169.00/mes** en mensual, o la cifra anual con **/año** y **Compromiso de 1 año** si tomó el año."],
              ["Licencias y cuadrilla", "**3 puestos · 8 miembros de cuadrilla incluidos gratis**: lo que el plan permite, no cuántas personas tiene. Gestionar equipo muestra el conteo que está usando."],
              ["Días restantes de prueba", "Solo durante el mes gratis: **Días restantes de prueba: 12**, en cuenta regresiva hasta el primer cobro."],
              ["Próxima fecha de facturación", "El día en que Stripe cobra la tarjeta registrada por el siguiente período. No se muestra durante la prueba, que muestra la cuenta regresiva en su lugar."],
            ],
          } },
        ],
      },
      {
        id: "the-four-buttons",
        heading: "Los cuatro botones",
        blocks: [
          { bullets: [
            "**Verificar con Stripe** — le pide a Stripe la verdad actual sobre su suscripción y la anota. Púlselo si la página dice **Sin plan activo** justo después de pagar: el regreso desde la página de pago a veces llega antes que la confirmación de Stripe, y este botón cierra esa brecha. Pulsarlo no cobra nada.",
            "**Gestionar facturación y método de pago** — abre el portal de facturación de Stripe en la misma pestaña: cambie la tarjeta, y lea o descargue cada factura que FieldQuo le ha emitido. Vuelve a esta página cuando lo cierra. Vea [[update-your-payment-method|Actualizar su método de pago]].",
            "**Ver lo que me pagaron mis clientes** — un atajo a **Configuración → Pagos**, el otro Stripe: su propia cuenta conectada, donde vive el dinero que sus clientes le pagaron. Está en esta página porque aquí es donde la gente busca «mi dinero», pero nada de su suscripción está allí.",
            "**Cancelar plan** — abre el flujo de cancelación. Pregunta por qué antes de hacer nada; vea [[cancel-your-subscription|Cancelar su suscripción]] para saber qué pasa con su acceso y sus registros.",
          ] },
          { note: "Si hay un cambio de plan programado para el final de su período, aparece una tarjeta ámbar entre la línea del plan y los botones: **Cambio a Solo (facturado mensualmente) el 2026-10-01 — Hasta entonces conservas Crew (facturado mensualmente). No se cobra nada antes de esa fecha.** Su botón **Mantener mi plan actual** deshace la programación. Detalles en [[change-your-plan|Cambiar de plan]]." },
        ],
      },
      {
        id: "the-plans-grid",
        heading: "La cuadrícula Planes",
        blocks: [
          { p: "Bajo **Planes**, un selector **Mensual** / **Compromiso de 1 año** y una tarjeta por nivel, cada una con su precio, su línea de licencias y cuadrilla, **FieldQuo AI incluido**, y un botón. La tarjeta en la que está dice **Plan actual** y aparece atenuada; las demás dicen **Elegir plan**. Con el selector en el año, el botón de su propio nivel dice **Cambiar a anual** en su lugar, porque tomar el compromiso es un cambio real aunque el nivel sea el mismo." },
          { p: "El selector arranca en la frecuencia con la que ya se le cobra, y cambiarlo solo vuelve a poner precio a las tarjetas: la línea del plan de arriba no se mueve hasta que confirma realmente un cambio. La cuadrícula muestra la escalera solo en su moneda: dólares canadienses para una dirección en Canadá, dólares estadounidenses para una en Estados Unidos. Una empresa cuya dirección no tiene país ve una invitación a agregarlo en lugar de una lista de precios." },
          { tip: "Cada tarjeta lleva las palabras **1 puesto · 5 miembros de cuadrilla incluidos gratis**, **3 puestos · 8 miembros de cuadrilla incluidos gratis**, y así sucesivamente. Compárelas con la línea **licencias usadas** de **Gestionar equipo** antes de subir de plan: la cuadrilla que ya tiene quizá cabe en el plan en el que está." },
        ],
      },
      {
        id: "who-can-see-it",
        heading: "Quién puede verlo",
        blocks: [
          { p: "Solo un **propietario** o un **administrador**: la persona que registró la empresa, o cualquiera nombrado administrador con la casilla **Hacer administrador** de su acceso. Todos los demás no tienen fila **Plan** en la barra lateral ni fila **Cuenta y facturación** en Configuración, y escribir la dirección muestra un rechazo, no la página. El preajuste Manager no incluye la facturación, a propósito: llevar el día a día no es autoridad sobre la tarjeta de la empresa." },
          { p: "El rechazo lo aplica el servidor en cada acción, no solo ocultando los botones: un supervisor que llame directamente a las rutas de facturación recibe **Only an owner or admin can change the plan or billing details.**" },
        ],
      },
    ],
    faq: [
      { q: "La página dice Sin plan activo, pero pagué hace un minuto.", a: "Pulse **Verificar con Stripe**. La página también lo hace sola cuando vuelve de la página de pago, pero una confirmación lenta puede ganarle. No se cobra nada dos veces." },
      { q: "¿Por qué no hay Próxima fecha de facturación en mi tarjeta?", a: "Todavía está en su mes gratis, y la tarjeta muestra **Días restantes de prueba** en su lugar. El primer cobro cae el día en que ese conteo llega a cero." },
      { q: "¿Dónde está el dinero que me pagaron mis clientes?", a: "Aquí no. Pulse **Ver lo que me pagaron mis clientes**, que abre **Configuración → Pagos**: su propia cuenta de Stripe conectada, sus transferencias y sus comisiones. Vea [[payment-processing-fees-and-payouts|Comisiones de procesamiento de pagos y transferencias]]." },
      { q: "¿Mi encargada de oficina puede abrir esta página?", a: "Solo si es administradora. Marque **Hacer administrador** en su acceso en **Gestionar equipo**; eso también le permite cambiar el plan y la tarjeta, así que déselo a la persona que realmente paga la cuenta." },
    ],
  },

  "the-four-plans": {
    title: "Los cuatro planes: Solo, Crew, Shop, Scale",
    summary:
      "Cuánto cuesta cada plan, cuántas licencias y accesos de cuadrilla gratis incluye, qué es realmente una licencia, y por qué nada más difiere entre los cuatro.",
    updated: "2026-09-12",
    intro: [
      "FieldQuo vende cuatro planes, y difieren en exactamente tres cosas: el precio mensual, el número de licencias y el número de accesos de cuadrilla incluidos gratis. Cada función — presupuestos, programación, facturación, pago en línea, el constructor de sitios web, FieldQuo AI, nómina — está en los cuatro. No hay un nivel donde lo que necesita esté dos peldaños más arriba.",
      "Este artículo es la lista de precios y las definiciones que hay detrás: qué cuenta como licencia, qué cuenta como cuadrilla, y cómo saber qué plan encaja con las personas que realmente tiene.",
    ],
    sections: [
      {
        id: "overview",
        heading: "Resumen",
        blocks: [
          { table: {
            head: ["Plan", "Por mes", "Por año (compromiso de 1 año)", "Licencias", "Accesos de cuadrilla, gratis"],
            rows: [
              ["Solo", "$99", "$990", "1", "5"],
              ["Crew", "$169", "$1,690", "3", "8"],
              ["Shop", "$269", "$2,690", "6", "11"],
              ["Scale", "$369", "$3,690", "10", "15"],
            ],
          } },
          { p: "El mismo número en cualquiera de las dos monedas: una empresa canadiense paga estas cifras en dólares canadienses, una estadounidense las paga en dólares estadounidenses. La moneda en la que se le cobra la decide la dirección de su negocio, nunca un selector — vea [[taxes-and-currency-on-your-subscription|Impuestos y moneda de su suscripción]]. El precio anual son diez meses por doce; vea [[monthly-or-a-year-commitment|Mensual, o un compromiso de un año]]." },
          { figure: "harness:plan", caption: "Cuenta y facturación — las cuatro tarjetas de plan, cada una con su línea de licencias y cuadrilla, FieldQuo AI incluido, y Elegir plan o Plan actual." },
        ],
      },
      {
        id: "what-a-seat-is",
        heading: "Qué es una licencia",
        blocks: [
          { p: "Una **licencia** es una persona cuyo acceso le permite crear o modificar dinero: presupuestos, trabajos, facturas, o las solicitudes que se convierten en presupuestos. El propietario siempre es una licencia. También los administradores, y cualquiera en los preajustes **Estimator**, **Dispatcher** o **Manager**, porque cada uno de ellos puede escribir un presupuesto." },
          { p: "Una licencia se cuenta por lo que la persona puede hacer realmente, no por el nombre de su nivel de acceso. Si empieza a alguien en Crew y luego sube un solo control por encima de lo que Crew permite — digamos, dejarle crear presupuestos — se convierte en licencia, y **Gestionar equipo** lo muestra. Eso es lo que mantiene el conteo honesto en ambos sentidos: un jefe de cuadrilla al que asciende es una licencia, y un pintor al que nunca ascendió no lo es." },
        ],
      },
      {
        id: "what-crew-is",
        heading: "Qué es un acceso de cuadrilla",
        blocks: [
          { p: "Un acceso de **cuadrilla** es todos los demás: la gente en la camioneta que ve su propio horario, marca entrada y salida, marca el trabajo como completado, agrega fotos y usa el chat de la cuadrilla. No ven precios y no pueden crear presupuestos, trabajos ni facturas. Los accesos de cuadrilla no cuestan nada y nunca usan una licencia: un plan Solo es un estimador y hasta cinco personas en campo por $99." },
          { p: "Gratis no significa ilimitado. Cada plan incluye un número fijo de plazas de cuadrilla, y un miembro de la cuadrilla también puede ocupar una licencia que usted no esté usando: Scale son 10 licencias más 15 de cuadrilla, así que un taller con dos personas de oficina y veinte técnicos cabe: dos de oficina y ocho de campo en licencias, los doce restantes en plazas de cuadrilla. Solo funciona en ese sentido: quien ocupa una licencia no puede apretarse en una plaza de cuadrilla." },
          { note: "El preajuste Crew es fijo a propósito: elíjalo y no hay cuadrícula que mover. Cualquier cosa por encima es una licencia, por el camino que sea, para que nadie pueda armar un estimador gratis a mano." },
        ],
      },
      {
        id: "which-plan-fits",
        heading: "Qué plan encaja",
        blocks: [
          { steps: [
            "Cuente a las personas que ponen precio al trabajo o escriben facturas, usted incluido. Ese es su número de licencias.",
            "Cuente a todos los demás que necesitan un acceso: la cuadrilla de campo. Esos son los accesos de cuadrilla.",
            "Elija el plan más pequeño cuyas licencias cubran el primer número y cuyas licencias más cuadrilla cubran el total. Un estimador y cuatro pintores es Solo; tres estimadores y ocho de cuadrilla es Crew; un taller con seis en la oficina y once en campo es Shop.",
            "Más de diez licencias, o más de veinticinco personas en total, queda fuera de los planes que se venden en línea: la página de registro dice **¿Necesitas más que Scale?** y le pide que se ponga en contacto.",
          ] },
          { tip: "FieldQuo AI — el copiloto que responde preguntas sobre su propio negocio — está incluido en cada plan; las tarjetas dicen **FieldQuo AI incluido**. Los minutos de teléfono de la recepcionista y las imágenes con IA se miden aparte, contra crédito que usted compra; vea [[ai-credit-and-phone-credit|Crédito de IA y crédito telefónico]]." },
        ],
      },
      {
        id: "what-does-not-change",
        heading: "Qué no cambia entre planes",
        blocks: [
          { bullets: [
            "**Las funciones.** Las 76 funciones de la propia lista de FieldQuo están marcadas como disponibles en cada plan. No hay ninguna función que desbloquear subiendo de plan.",
            "**Las comisiones de tarjeta y débito bancario.** La comisión de procesamiento en un pago en línea de un cliente es la misma en cada plan — vea [[payment-processing-fees-and-payouts|Comisiones de procesamiento de pagos y transferencias]].",
            "**La marca blanca.** Sus presupuestos, facturas, página de reservas y correos llevan su nombre y sus colores en cada plan, no como una mejora.",
            "**El soporte y el centro de ayuda.** Los mismos para una empresa Solo que para una Scale.",
          ] },
        ],
      },
    ],
    faq: [
      { q: "¿Puedo comprar una licencia extra en lugar de subir de plan?", a: "No. Los cuatro planes son toda la lista de precios; cuando ha usado cada licencia, el siguiente plan es la forma de agregar una. **Gestionar equipo** le dice cuál es." },
      { q: "¿Una persona desactivada sigue usando una licencia?", a: "No. Solo cuentan los miembros activos: una cuenta desactivada no puede escribir un presupuesto, así que no se cobra como licencia." },
      { q: "Tengo más licencias en uso de las que incluye mi plan. ¿Estoy bloqueado?", a: "No. El límite le impide agregar otra licencia; nunca le quita una que ya tiene. Todos siguen trabajando, y Gestionar equipo dice **En el límite de tu plan** hasta que suba de plan o pase a alguien a Crew." },
      { q: "¿Es algo más barato en dólares estadounidenses?", a: "No. Los números son idénticos en ambas monedas, y su dirección decide en cuál paga." },
    ],
  },

  "free-first-month": {
    title: "Su primer mes es gratis",
    summary:
      "Cómo funciona el mes gratis al registrarse, por qué se pide una tarjeta de todos modos, qué muestra la pantalla mientras corre la prueba, y exactamente qué pasa el día en que termina.",
    updated: "2026-09-12",
    intro: [
      "Cada empresa nueva recibe su primer mes de FieldQuo gratis: todo el producto, en el plan que eligió, sin ningún cobro durante 30 días. Su tarjeta se toma en la página de pago para que el plan simplemente continúe cuando termine el mes; no se cobra nada hasta entonces, y la página lo dice con todas las letras.",
      "Este artículo dice qué es la prueba, qué ve mientras corre, cuándo se le recuerda, y qué pasa el día 30, incluso si la tarjeta no pasa.",
    ],
    sections: [
      {
        id: "overview",
        heading: "Resumen",
        blocks: [
          { p: "El mes gratis es una prueba de Stripe sobre una suscripción real. Elige un plan y una frecuencia en el último paso del registro, ingresa una tarjeta en la página de pago de Stripe, y la suscripción arranca en estado **Trial** con una prueba de 30 días. El día en que termina la prueba, Stripe cobra la tarjeta por el primer período — el precio mensual, o el precio anual completo si tomó el compromiso — y el estado pasa a **Activo**." },
          { p: "Es gratis, no un dólar simbólico: la oferta en cada pantalla dice **Primer mes gratis**, y no aparece ninguna línea de cobro único en la página de pago. Una referencia de otra empresa de FieldQuo agrega un mes más a la prueba antes del primer cobro — vea [[referral-months|Meses por referidos]]." },
        ],
      },
      {
        id: "how-it-works-at-signup",
        heading: "Cómo funciona al registrarse",
        blocks: [
          { figure: "harness:signup", caption: "Comience su prueba gratis — los cuatro pasos, y la tarjeta a la derecha que dice que la tarjeta se toma en la página de pago y que el primer cobro cae cuando termina el mes gratis." },
          { steps: [
            "Complete **Tu cuenta y tu empresa**: nombre, correo, empresa, dirección. El país de su dirección fija su moneda de facturación.",
            "Elija sus oficios y sus servicios en los pasos 2 y 3.",
            "En **Elige tu plan**, elija un nivel y responda **¿Cómo prefieres que te cobremos?** — **Sin compromiso** o **Compromiso de 1 año**. La línea debajo dice, por ejemplo, **Primer mes gratis, luego $99.00/mes.**",
            "Pulse **Continuar al pago**. La página de Stripe toma su tarjeta y su dirección de facturación y muestra la prueba; no se le cobra. Aterriza en FieldQuo con el plan ya activo.",
          ] },
          { note: "Se requiere una tarjeta para iniciar la prueba. Es una decisión deliberada: significa que el producto sigue funcionando el día 31 sin una segunda página de pago, y es la razón por la que la prueba puede ser un mes completo del producto real en lugar de una demo." },
        ],
      },
      {
        id: "what-you-see-during-the-trial",
        heading: "Qué ve durante la prueba",
        blocks: [
          { p: "En **Cuenta y facturación**, la tarjeta del plan lleva una etiqueta **Trial** (en inglés, por ahora) y, bajo el precio, **Días restantes de prueba: 23** en cuenta regresiva. Todavía no hay **Próxima fecha de facturación**: la cuenta regresiva es esa fecha. Todo lo demás en la pantalla funciona como funcionará después de la prueba, incluido **Elegir plan**: subir de plan durante el mes gratis surte efecto de inmediato y sigue siendo gratis hasta que termina el mes, porque la prueba se mantiene donde estaba. Vea [[change-your-plan|Cambiar de plan]]." },
          { p: "También recibe un correo de confirmación cuando la suscripción se activa, con el plan, **Status: Free trial** y **Trial ends** con la fecha." },
        ],
      },
      {
        id: "when-the-month-ends",
        heading: "Cuando termina el mes",
        blocks: [
          { bullets: [
            "**Siete días antes** del primer cobro, FieldQuo envía al propietario un recordatorio por correo con el plan, el monto, la fecha y los últimos cuatro dígitos de la tarjeta si se conocen. Vea [[renewal-reminders|Recordatorios de renovación]].",
            "**El mismo día**, Stripe cobra la tarjeta. La etiqueta de estado pasa a **Activo** y la tarjeta muestra **Próxima fecha de facturación** un mes (o un año) después.",
            "**Si el cobro falla**, el estado pasa a **Atrasada** y empieza un período de gracia de 7 días: todavía puede leer todo, pero no agregar nada, hasta que arregle la tarjeta con **Gestionar facturación y método de pago**. Pasados los siete días, la cuenta queda bloqueada en la pantalla de facturación hasta que se pague. Nada se borra en ningún momento. Vea [[failed-payments-and-the-grace-period|Pagos fallidos y el período de gracia]].",
          ] },
          { warning: "Cancelar durante el mes gratis detiene el primer cobro, pero termina su acceso en los mismos términos que cualquier cancelación: lea [[cancel-your-subscription|Cancelar su suscripción]] antes de pulsar **Cancelar plan** el día 29 esperando un día extra gratis." },
        ],
      },
    ],
    faq: [
      { q: "¿El primer mes es realmente gratis, o cuesta $1?", a: "Gratis. El precio del primer mes es cero, la página de pago no muestra ningún cobro por él, y la pantalla de registro dice **Primer mes gratis**." },
      { q: "¿El mes gratis también aplica al plan anual?", a: "Sí. Primero viene el mes, luego el año: ningún cobro durante 30 días, luego el monto anual completo, y el año empieza con ese cobro." },
      { q: "Me refirió otro contratista. ¿Cuánto dura mi prueba?", a: "30 días más un mes por referido, y el recordatorio y el primer cobro se corren con él. La confirmación tras el registro nombra a la empresa que lo refirió." },
      { q: "¿Puedo probarlo sin tarjeta?", a: "No. El registro toma una tarjeta en la página de pago antes de que empiece la prueba. No se cobra hasta que termina el mes gratis, y puede cancelar antes." },
    ],
  },

  "monthly-or-a-year-commitment": {
    title: "Mensual, o un compromiso de un año",
    summary:
      "Las dos formas de pagar: mes a mes sin compromiso, o un año pagado por adelantado al precio de diez meses, y qué significa cambiar entre ellas.",
    updated: "2026-09-12",
    intro: [
      "Cada plan puede pagarse de dos formas. **Mensual** es sin compromiso: el plan se renueva cada mes y puede irse cuando quiera. **Compromiso de 1 año** es un solo cobro por doce meses al precio de diez — dos meses gratis — a cambio de comprometerse por el año.",
      "Elige al registrarse, y puede cambiar de opinión después desde **Cuenta y facturación**. Este artículo pone los dos precios lado a lado, explica el selector en la pantalla, y dice claramente qué significa la palabra compromiso una vez que el año se ha cobrado.",
    ],
    sections: [
      {
        id: "overview",
        heading: "Resumen",
        blocks: [
          { table: {
            head: ["Plan", "Mensual", "Compromiso de 1 año", "Equivale a", "Usted ahorra"],
            rows: [
              ["Solo", "$99 al mes", "$990 al año", "$82.50 al mes", "$198 al año"],
              ["Crew", "$169 al mes", "$1,690 al año", "$140.83 al mes", "$338 al año"],
              ["Shop", "$269 al mes", "$2,690 al año", "$224.17 al mes", "$538 al año"],
              ["Scale", "$369 al mes", "$3,690 al año", "$307.50 al mes", "$738 al año"],
            ],
          } },
          { p: "El ahorro se expresa en meses y no en porcentaje porque eso es lo que puede comprobar de cabeza: pague diez, reciba doce. Las tarjetas de plan lo dicen en dinero — **Ahorra $198 al año** bajo la tarjeta Solo, con **$82.50 al mes** bajo el precio anual — y las mismas cifras aparecen en el paso de registro como **Ahorra $198 al año — dos meses gratis.**" },
        ],
      },
      {
        id: "the-switch-on-the-screen",
        heading: "El selector en la pantalla",
        blocks: [
          { figure: "live:app-settings-account-billing", caption: "Cuenta y facturación — el selector Mensual / Compromiso de 1 año sobre la cuadrícula Planes vuelve a poner precio a cada tarjeta; la línea del plan de arriba no se mueve hasta que confirma." },
          { p: "Sobre la cuadrícula **Planes** hay un selector de dos posiciones, **Mensual** / **Compromiso de 1 año**. Arranca en la frecuencia con la que ya se le cobra, así que una empresa anual ve primero los precios anuales y nunca es devuelta en silencio a mensual por una subida de plan. Cámbielo y las cuatro tarjetas cambian de precio: la vista anual muestra **$990/año**, **$82.50 al mes** y **Ahorra $198 al año**." },
          { p: "Con el selector en el año, la tarjeta de su propio nivel ya no dice **Plan actual**: dice **Cambiar a anual**, porque una empresa mensual que toma el compromiso hace un cambio real. Un nivel sin precio anual diría **No se vende por año**; los cuatro planes que se venden en línea lo tienen." },
        ],
      },
      {
        id: "how-to-take-the-commitment",
        heading: "Cómo pasar de mensual al año",
        blocks: [
          { steps: [
            "Abra **Cuenta y facturación** y cambie el selector a **Compromiso de 1 año**.",
            "Pulse **Cambiar a anual** en su propio nivel (o **Elegir plan** en otro).",
            "Lea el cuadro de diálogo. Un cambio de frecuencia en el mismo nivel o en uno inferior se programa para el final de su mes actual: **Tu plan cambia a Crew (facturado anualmente) el 2026-10-01. Hasta entonces conservas Crew (facturado mensualmente). Hoy no se cobra nada.** Pulse **Programar el cambio**.",
            "La tarjeta del plan ahora muestra el panel ámbar **Cambio a …** con **Mantener mi plan actual** debajo. En la fecha, Stripe cobra el monto anual y empieza el año.",
          ] },
          { note: "Subir de nivel y pasar al año al mismo tiempo es una subida de plan, así que aplica hoy y la diferencia se prorratea: el cuadro de diálogo dice **Cambiar de plan ahora** en su lugar. Vea [[change-your-plan|Cambiar de plan]] para la regla completa." },
        ],
      },
      {
        id: "what-commitment-means",
        heading: "Qué significa el compromiso",
        blocks: [
          { bullets: [
            "**El año se paga una vez, por adelantado**, en la fecha de renovación, en su moneda, con el impuesto que Stripe agrega donde corresponde.",
            "**Volver a mensual, o bajar de nivel, espera a que termine el año.** El cambio se programa para el final del período y nada se reembolsa, acredita ni cobra antes: la misma regla que una bajada de plan mensual, en un período más largo.",
            "**Subir de plan a mitad de año no espera.** Un nivel superior aplica hoy y el resto del año se prorratea.",
            "**El primer mes gratis viene antes del año**, no dentro de él: ningún cobro durante 30 días, luego el monto anual completo.",
            "**Los recordatorios llegan 30 días antes** de una renovación anual, por correo, con el monto y la tarjeta. Las renovaciones mensuales no reciben recordatorio, porque un cobro que se repite cada mes no es noticia — vea [[renewal-reminders|Recordatorios de renovación]].",
          ] },
        ],
      },
    ],
    faq: [
      { q: "¿El precio anual es un descuento o solo cobrar una vez?", a: "Un descuento: dos meses gratis. $990 por Solo frente a $1,188 por doce pagos mensuales." },
      { q: "Tomé el año y quiero irme a los seis meses.", a: "El año ya se cobró y el compromiso corre hasta su fecha de fin; el cambio de vuelta a mensual se programa para esa fecha, y nada se reembolsa antes. Vea [[cancel-your-subscription|Cancelar su suscripción]] para saber qué hace cancelar." },
      { q: "¿Subir de plan me devolverá a mensual?", a: "No. El selector arranca en su frecuencia actual y una subida de plan se compra con lo que muestre el selector. Compruebe que diga **Compromiso de 1 año** antes de pulsar **Elegir plan** si eso es lo que quiere." },
    ],
  },

  "change-your-plan": {
    title: "Cambiar de plan",
    summary:
      "Las subidas de plan aplican hoy y se prorratean; las bajadas y los cambios entre mensual y anual se programan para el final del período sin cobrar nada hasta entonces, y puede deshacer una programación.",
    updated: "2026-09-12",
    intro: [
      "Cambia de plan desde la cuadrícula **Planes** en **Cuenta y facturación**. La tarjeta que pulsa y hacia dónde apunta el selector de frecuencia deciden una sola cosa: si el cambio ocurre ahora o al final de lo que ya pagó. El cuadro de diálogo le dice cuál antes de confirmar, en una frase que sale de la misma regla que aplica el servidor.",
      "La regla en una línea: **hacia arriba es ahora; hacia abajo o de lado es después.** Un taller que acaba de contratar dos estimadores necesita las licencias hoy; una empresa que baja conserva las licencias que pagó hasta que termina el período, y nunca se le reembolsa ni se le vuelve a cobrar en el medio.",
    ],
    sections: [
      {
        id: "overview",
        heading: "Resumen",
        blocks: [
          { table: {
            head: ["El cambio", "Cuándo aplica", "Qué se cobra"],
            rows: [
              ["Un nivel hacia arriba (Solo → Crew, Crew → Shop …), en cualquier frecuencia", "De inmediato", "La diferencia por el resto de este período de facturación, prorrateada hoy"],
              ["Un nivel hacia abajo", "Al final del período actual: después del año, en un plan anual", "Nada hoy; el nuevo precio en la fecha de renovación"],
              ["Mismo nivel, mensual → anual o anual → mensual", "Al final del período actual", "Nada hoy; el nuevo monto en la fecha de renovación"],
              ["Mismo nivel, misma frecuencia", "No pasa nada: el botón dice **Plan actual**", "—"],
            ],
          } },
          { p: "«Arriba» y «abajo» los decide el orden de la escalera — Solo, Crew, Shop, Scale —, no los nombres, y un cambio de nivel y frecuencia a la vez se juzga por el nivel: de Solo mensual a Crew anual es una subida de plan y aplica ahora." },
        ],
      },
      {
        id: "how-to-upgrade",
        heading: "Cómo subir de plan",
        blocks: [
          { figure: "harness:plan", caption: "Cuenta y facturación — la empresa está en Shop; Crew y Solo debajo son bajadas, Scale es la única subida que queda." },
          { steps: [
            "Abra **Cuenta y facturación**. Compruebe que el selector **Mensual** / **Compromiso de 1 año** muestre la frecuencia que quiere; arranca en la que tiene.",
            "Pulse **Elegir plan** en el nivel superior.",
            "El cuadro de diálogo **Cambiar de plan** dice: **Tu plan cambia a Shop (facturado mensualmente) de inmediato. La diferencia por el resto de este período de facturación se prorratea hoy.** Pulse **Cambiar de plan ahora**.",
            "La página se recarga y lee el nuevo plan desde Stripe. Las licencias y plazas de cuadrilla adicionales se pueden usar de inmediato en **Gestionar equipo**.",
          ] },
          { note: "Durante su mes gratis, una subida de plan también aplica de inmediato, y sigue siendo gratis: la prueba se mantiene exactamente donde estaba y el nuevo precio empieza cuando termina." },
        ],
      },
      {
        id: "how-to-downgrade-or-switch-cadence",
        heading: "Cómo bajar de plan, o cambiar entre mensual y anual",
        blocks: [
          { steps: [
            "Pulse **Elegir plan** en el nivel inferior, o cambie el selector y pulse **Cambiar a anual** en su propio nivel.",
            "El cuadro de diálogo dice: **Tu plan cambia a Solo (facturado mensualmente) el 2026-10-01. Hasta entonces conservas Crew (facturado mensualmente). Hoy no se cobra nada.** Pulse **Programar el cambio**.",
            "La página confirma **Listo — tu plan cambia el 2026-10-01. No se cobra nada hasta entonces.** y aparece un panel ámbar en la tarjeta del plan: **Cambio a Solo (facturado mensualmente) el 2026-10-01** con **Mantener mi plan actual** debajo.",
            "En esa fecha, Stripe hace el cambio con su propio reloj y factura el nuevo monto. El nombre de su plan en la tarjeta cambia entonces, no antes, y recibe el correo de cambio de plan en ese momento.",
          ] },
          { bullets: [
            "**Mantener mi plan actual** libera la programación. El panel desaparece y nada de su suscripción se ha movido.",
            "**Programar un segundo cambio** antes de que caiga el primero lo reemplaza: la solicitud más reciente es la que vale.",
            "**Subir de plan mientras hay una bajada programada** cancela la programación: la subida que elige hoy sustituye la bajada que había planeado.",
          ] },
        ],
      },
      {
        id: "what-happens-to-your-people",
        heading: "Qué pasa con su gente en una bajada",
        blocks: [
          { p: "Nadie queda bloqueado. Si el plan al que baja incluye menos licencias de las que está usando, todos conservan su acceso y siguen trabajando; **Gestionar equipo** muestra **En el límite de tu plan** y el botón **Agregar una licencia** queda desactivado hasta que vuelva a subir de plan o pase a alguien a Crew. El límite le impide agregar una licencia; nunca le quita una." },
          { tip: "Antes de bajar, compare los conteos de licencias y cuadrilla de **Gestionar equipo** con la línea **puestos · miembros de cuadrilla incluidos gratis** del plan de destino. Vea [[add-a-seat-or-a-crew-login|Agregar una licencia, o un acceso de cuadrilla gratis]]." },
        ],
      },
      {
        id: "who-can-change-it",
        heading: "Quién puede cambiarlo",
        blocks: [
          { p: "Solo propietarios y administradores. Las rutas detrás de **Elegir plan**, **Programar el cambio** y **Mantener mi plan actual** vuelven a comprobarlo, así que un Manager o un Dispatcher que llegue a la página por la URL recibe **Only an owner or admin can change the plan or billing details.** Cada cambio se escribe en el Registro de actividad con quién lo hizo y cuándo." },
        ],
      },
    ],
    faq: [
      { q: "Subí de plan por error. ¿Puedo volver enseguida?", a: "Puede programar la bajada, y cae al final del período; la diferencia prorrateada que ya se cobró por la subida no se reembolsa. Lea el cuadro de diálogo antes de pulsar **Cambiar de plan ahora**." },
      { q: "¿Por qué mi plan sigue diciendo Crew después de elegir Solo?", a: "Porque todavía tiene Crew hasta la fecha del panel ámbar. La tarjeta nombra el plan que tiene hoy; el panel nombra el que viene." },
      { q: "¿Cambiar de plan crea una segunda suscripción?", a: "No. Una empresa con una suscripción activa se mueve en su lugar. La página de pago solo se abre para una empresa sin plan activo: una nueva, o una que canceló y vuelve." },
    ],
  },

  "add-a-seat-or-a-crew-login": {
    title: "Agregar una licencia, o un acceso de cuadrilla gratis",
    summary:
      "Los dos botones Agregar de Gestionar equipo, cuánto cuesta cada uno, cómo funcionan las invitaciones, qué pasa cuando el plan está lleno, y qué plan necesita a continuación.",
    updated: "2026-09-12",
    intro: [
      "**Gestionar equipo** tiene dos puertas para agregar a una persona, porque cuestan dinero distinto: **Agregar cuadrilla — sin costo** para alguien que trabaja en campo, y **Agregar una licencia** para alguien que pone precio al trabajo o escribe facturas. Ambas llevan al mismo formulario **Nuevo usuario** con un punto de partida distinto seleccionado, y ambas terminan en una invitación por correo que la persona acepta para crear su propio acceso.",
      "Unirse a una empresa es solo por invitación. No hay forma de que alguien se agregue por sí mismo a su empresa; cada miembro empezó como una invitación enviada desde esta pantalla.",
    ],
    sections: [
      {
        id: "overview",
        heading: "Resumen",
        blocks: [
          { figure: "live:app-settings-team", caption: "Gestionar equipo — el panel de licencias (1 / 3 licencias usadas, 0 / 8 de cuadrilla — incluidos sin costo), los dos botones Agregar, y la lista debajo." },
          { p: "El panel de arriba dice, por ejemplo, **1 / 3 licencias usadas** y **0 / 8 de cuadrilla — incluidos sin costo**, con un desglose debajo (**1 Administradores**, **2 Cuadrilla** …). El primer número de cada par es lo que está usando, contando las invitaciones pendientes; el segundo es lo que incluye su plan. Bajo los conteos están los dos botones, y bajo ellos la lista con el nivel de acceso de cada persona." },
          { p: "Una licencia es cualquiera cuyo acceso le permite crear o modificar presupuestos, trabajos, facturas o solicitudes: el propietario, cada administrador, y los preajustes **Estimator**, **Dispatcher** y **Manager**. Cuadrilla es todo el que esté en el preajuste **Crew** o por debajo. Definiciones completas en [[the-four-plans|Los cuatro planes]] y [[seats-and-crew-logins|Licencias y accesos de cuadrilla]]." },
        ],
      },
      {
        id: "add-a-crew-login",
        heading: "Agregar un acceso de cuadrilla (gratis)",
        blocks: [
          { steps: [
            "Abra **Tu equipo** en la barra lateral (o **Configuración → Gestionar equipo**) y pulse **Agregar cuadrilla — sin costo**.",
            "El formulario **Nuevo usuario** se abre con el preajuste **Crew** ya seleccionado. Complete su nombre, correo y número de móvil; la dirección y el costo de mano de obra son opcionales.",
            "Deje el preajuste en **Crew**: no tiene controles que mover. Subir cualquier permiso por encima convierte a la persona en licencia, y el conteo de licencias lo dirá.",
            "Pulse **Enviar invitación**. Recibe un correo con un enlace para crear su propio acceso; hasta que acepte, la lista la muestra como **Invitado** con **Cancelar invitación** al lado.",
          ] },
          { note: "Alguien en la nómina que nunca va a iniciar sesión — un ayudante pagado por hora que no necesita la aplicación — no necesita invitación en absoluto. Agréguelo bajo **Trabajadores** en su lugar; vea [[payroll-settings|Configuración de nómina]]." },
        ],
      },
      {
        id: "add-a-seat",
        heading: "Agregar una licencia",
        blocks: [
          { figure: "create:app-settings-team-create", caption: "Nuevo usuario — datos personales, luego Permisos: Hacer administrador, los cuatro preajustes (Crew, Estimator, Dispatcher, Manager) y Personalizado, y la cuadrícula debajo." },
          { steps: [
            "Pulse **Agregar una licencia**. El formulario se abre en el preajuste **Dispatcher**: lo más barato que realmente es una licencia. Elija **Estimator** o **Manager** si encaja mejor, o mueva controles individuales; cualquier cambio convierte el preajuste en **Personalizado**.",
            "Marque **Hacer administrador** solo para alguien que también deba ver la facturación y todo lo demás de la cuenta. Los administradores también son licencias.",
            "Pulse **Enviar invitación**. La licencia se cuenta desde el momento en que existe la invitación, así que una invitación pendiente retiene una licencia hasta que se acepta o se cancela.",
          ] },
          { p: "Agregar una licencia no cuesta nada extra mientras su plan tenga una libre: el precio del plan es fijo, y **3 puestos** significa tres personas por $169. Cuesta dinero solo cuando el plan está lleno y el siguiente nivel es la forma de conseguir otra — vea abajo." },
        ],
      },
      {
        id: "when-the-plan-is-full",
        heading: "Cuando el plan está lleno",
        blocks: [
          { p: "Las dos puertas se cierran por separado. Cuando cada licencia está usada, **Agregar una licencia** queda desactivado y dice **Ya usaste todas las licencias de tu plan.** al pasar el cursor, mientras **Agregar cuadrilla — sin costo** sigue activo; cuando cada plaza de cuadrilla está usada, es al revés. Un miembro de la cuadrilla también puede ocupar una licencia que no esté usando, así que una empresa Solo con una licencia y seis de cuadrilla sigue dentro de lo permitido si la licencia está libre." },
          { p: "Junto a un botón desactivado, la página nombra la salida: **Ya usaste todas tus licencias. Crew cubre 3 licencias y 8 de cuadrilla.** con un enlace **Mejorar el plan** a **Cuenta y facturación** para propietarios y administradores. Más allá de Scale dice **Te quedaste grande para los planes que vendemos en línea — habla con nosotros.**" },
          { warning: "El servidor rechaza una invitación que excedería el plan aunque un botón parezca activo: una segunda pestaña, un conteo desactualizado. El rechazo dice qué límite se alcanzó y qué plan encaja. Nunca quita a una persona que ya tiene: el límite controla el agregar, no el tener." },
        ],
      },
      {
        id: "who-can-add-people",
        heading: "Quién puede agregar personas",
        blocks: [
          { bullets: [
            "**Propietarios y administradores** pueden invitar a cualquiera en cualquier nivel, cambiar el acceso de una persona existente, y ver el enlace **Mejorar el plan**.",
            "**Managers y Dispatchers** también pueden invitar, pero solo en el nivel de Trabajador — Crew o Estimator — y nunca con un control más alto que el suyo. Ven **En el límite de tu plan** pero ningún enlace de mejora, porque el plan no es suyo para cambiarlo.",
            "**Estimators y Crew** no pueden abrir el formulario.",
          ] },
        ],
      },
    ],
    faq: [
      { q: "¿Invitar a alguien cobra mi tarjeta?", a: "No. El precio del plan es fijo. Agregar personas dentro de las licencias y plazas de cuadrilla del plan no cambia nada en su cuenta; pasarse significa elegir el siguiente plan en **Cuenta y facturación**, y ese es el único cobro." },
      { q: "Moví los controles de un miembro de la cuadrilla y el conteo de licencias subió.", a: "Esa es la regla funcionando: una licencia se cuenta por lo que la persona puede hacer. Devuélvala al preajuste **Crew** y la licencia se libera." },
      { q: "¿Puedo cancelar una invitación para liberar la licencia?", a: "Sí: **Cancelar invitación** en su fila. El enlace deja de funcionar y la licencia se libera de inmediato. Cualquier registro de trabajador que ya esté en sus libros se conserva." },
      { q: "¿Alguien puede registrarse y pedir unirse a mi empresa?", a: "No. Unirse es solo por invitación; la única puerta de entrada es una invitación desde esta pantalla." },
    ],
  },

  "update-your-payment-method": {
    title: "Actualizar su método de pago",
    summary:
      "Cambiar la tarjeta que FieldQuo cobra a través del portal de facturación de Stripe, y qué pasa en cuanto vuelve, sobre todo si un pago fallido había puesto la cuenta en espera.",
    updated: "2026-09-12",
    intro: [
      "La tarjeta registrada la guarda Stripe, nunca FieldQuo, así que se cambia en el propio portal de facturación de Stripe. Un botón en **Cuenta y facturación** lo lleva allí y lo trae de vuelta: **Gestionar facturación y método de pago**.",
      "Este artículo es la versión de dos minutos de ese viaje, más el único caso en que más importa: una tarjeta vencida, un pago fallido, y una cuenta cuyo período de gracia va corriendo.",
    ],
    sections: [
      {
        id: "overview",
        heading: "Resumen",
        blocks: [
          { p: "Su suscripción es una suscripción de Stripe sobre un cliente de Stripe creado para su empresa en su primera página de pago. La tarjeta, la dirección de facturación y las facturas viven todas en ese cliente. FieldQuo no guarda ningún dato de la tarjeta — ni siquiera los últimos cuatro dígitos, que le pide a Stripe cuando redacta un recordatorio de renovación." },
          { p: "El portal es la página alojada por Stripe, abierta en la misma pestaña con un enlace de regreso a **Cuenta y facturación**. Cuando vuelve, la página le pide a Stripe el estado actual de la suscripción de inmediato en lugar de esperar un webhook, así que una tarjeta arreglada aparece arreglada al instante." },
        ],
      },
      {
        id: "how-to-change-the-card",
        heading: "Cómo cambiar la tarjeta",
        blocks: [
          { figure: "live:app-settings-account-billing", caption: "Cuenta y facturación — Gestionar facturación y método de pago, el segundo botón de la tarjeta del plan, abre el portal de facturación de Stripe." },
          { steps: [
            "Abra **Cuenta y facturación**: **Plan** al pie de la barra lateral, o **Configuración → Cuenta y facturación**.",
            "Pulse **Gestionar facturación y método de pago**. El botón dice **Abriendo...** y la pestaña pasa al portal de Stripe, que muestra el nombre de su empresa.",
            "En el portal, agregue la nueva tarjeta en su sección de métodos de pago y hágala la predeterminada; quite la antigua si quiere. Actualice también la dirección de facturación allí si cambió: Stripe la usa para calcular el impuesto de cada cobro.",
            "Use el enlace de regreso del portal. Aterriza de nuevo en **Cuenta y facturación**, que dice **Verificando con Stripe…** por un segundo y luego muestra el estado actual.",
          ] },
          { note: "El botón necesita un historial de facturación para abrirse: una empresa que nunca ha pasado por la página de pago ve **No billing history yet — start a plan first**. Elija un plan en la misma página y el portal funciona desde entonces." },
        ],
      },
      {
        id: "after-a-failed-payment",
        heading: "Después de un pago fallido",
        blocks: [
          { p: "Si un cobro de renovación falla, la tarjeta del plan dice **Atrasada** y la cuenta pasa a solo lectura durante 7 días: todos pueden ver su trabajo, nadie puede agregar nada. Pasados los siete días, queda bloqueada en la pantalla de facturación. Nunca se borra nada — vea [[failed-payments-and-the-grace-period|Pagos fallidos y el período de gracia]]." },
          { p: "Arreglar la tarjeta es el mismo viaje de arriba. La diferencia es lo que pasa cuando vuelve: como el bloqueo se aplica al cargar la aplicación, la página recarga toda la aplicación después de verificar con Stripe, así que la barra lateral vuelve en cuanto el pago pasa y no cuando a un webhook se le ocurra llegar. Si arregla la tarjeta y la aplicación sigue pareciendo bloqueada, pulse **Verificar con Stripe** en la página de facturación." },
          { tip: "El cobro fallido es una factura abierta en el portal. Páguela allí a mano con la nueva tarjeta si no quiere esperar al siguiente intento de Stripe; en cualquier caso, la etiqueta **Atrasada** vuelve a **Activo** en cuanto Stripe la reporta pagada." },
        ],
      },
      {
        id: "what-else-the-portal-does",
        heading: "Qué más hace el portal",
        blocks: [
          { bullets: [
            "**Facturas y recibos**: cada cobro que FieldQuo ha hecho, descargable en PDF. Vea [[invoices-and-receipts-from-fieldquo|Facturas y recibos de FieldQuo]].",
            "**Dirección de facturación y número fiscal**: la dirección decide el impuesto que Stripe agrega; un número de empresa ingresado aquí aparece en las facturas.",
            "**No el plan.** Cambiar de nivel o de frecuencia se hace en **Cuenta y facturación**, donde viven la regla de fechas y el cuadro de diálogo de confirmación — vea [[change-your-plan|Cambiar de plan]]. Cancelar es **Cancelar plan** en la misma página, que pregunta por qué y le dice qué pasa con sus registros.",
          ] },
        ],
      },
      {
        id: "who-can-do-it",
        heading: "Quién puede hacerlo",
        blocks: [
          { p: "Propietarios y administradores. La ruta del portal rechaza a todos los demás con **Only an owner or admin can change the plan or billing details.**: un supervisor que puede invitar personas sigue sin tener por qué leer el historial de pagos de la empresa." },
        ],
      },
    ],
    faq: [
      { q: "El botón dice No se pudo abrir el portal de facturación.", a: "Nada de su plan ha cambiado. Inténtelo de nuevo en un momento; si sigue fallando, el aviso de error dice por qué, y soporte ve el mismo mensaje de su lado." },
      { q: "¿Puedo pagar por transferencia bancaria o cheque en lugar de tarjeta?", a: "No. La suscripción se cobra a una tarjeta registrada a través de Stripe." },
      { q: "¿La nueva tarjeta aplica al cobro que ya falló?", a: "El cobro fallido sigue como factura abierta en el portal hasta que se pague: páguela allí con la nueva tarjeta. Pulse **Verificar con Stripe** si la página no se ha puesto al día después." },
    ],
  },

  "invoices-and-receipts-from-fieldquo": {
    title: "Facturas y recibos de FieldQuo",
    summary:
      "Dónde vive la factura de cada cobro de suscripción, qué muestra, qué correos envía FieldQuo mismo sobre su facturación, y cómo no confundirlos con las facturas que usted envía a sus clientes.",
    updated: "2026-09-12",
    intro: [
      "Cada cobro que FieldQuo hace a su tarjeta — el plan mensual o anual, y cualquier recarga o pago de migración — es una factura de Stripe en el cliente de Stripe de su empresa. Se leen y descargan desde el portal de facturación de Stripe, al que se llega desde **Cuenta y facturación**; FieldQuo no guarda una segunda copia en la aplicación.",
      "Este artículo dice dónde encontrarlas, qué se imprime en una, y qué correos recibe de FieldQuo sobre su suscripción, para que sepa cuál es cuál cuando el contador pregunte.",
    ],
    sections: [
      {
        id: "overview",
        heading: "Resumen",
        blocks: [
          { p: "FieldQuo le cobra a través de Stripe Billing, en su propia moneda: dólares canadienses para una dirección en Canadá, dólares estadounidenses para una en Estados Unidos. Cada período, Stripe emite una factura, cobra la tarjeta registrada y marca la factura como pagada; la factura pagada es el recibo. No hay un correo de recibo separado con la marca de FieldQuo por cada cobro." },
          { p: "Estas van en la dirección opuesta a las facturas de su pantalla **Facturas**, que son las suyas para sus clientes y pasan por su propia cuenta de Stripe conectada. Las dos nunca se mezclan: su factura de suscripción no está en su exportación contable, y el pago de un cliente nunca está en su cliente de Stripe." },
        ],
      },
      {
        id: "where-to-find-them",
        heading: "Dónde encontrarlas",
        blocks: [
          { figure: "live:app-settings-account-billing", caption: "Cuenta y facturación — Gestionar facturación y método de pago abre el portal de Stripe donde se lista cada factura de suscripción." },
          { steps: [
            "Abra **Cuenta y facturación** y pulse **Gestionar facturación y método de pago**.",
            "En el portal de Stripe, abra el historial de facturas. Cada cobro aparece con su fecha, monto y estado.",
            "Abra una factura para verla o descargarla en PDF. Envíesela a su contador; es el documento con el que cuadra la línea del banco.",
            "Use el enlace de regreso del portal para volver a FieldQuo.",
          ] },
          { note: "Solo un propietario o administrador puede abrir el portal. Si su contador no es ninguno de los dos, descargue los PDF y envíeselos, o hágalo administrador, lo que también le permite cambiar el plan y la tarjeta." },
        ],
      },
      {
        id: "what-an-invoice-shows",
        heading: "Qué muestra una factura",
        blocks: [
          { table: {
            head: ["Línea", "De dónde sale"],
            rows: [
              ["**FieldQuo — Crew** (o Solo, Shop, Scale)", "El plan en el que estaba en ese período. Cuando cae un cambio programado, la línea nombra el nuevo plan desde esa renovación."],
              ["El monto y la moneda", "El precio mensual o anual del plan en su moneda de facturación: el mismo número que ve en la tarjeta del plan."],
              ["Una línea prorrateada", "Aparece solo en la factura posterior a una subida de plan a mitad de período: la diferencia por el resto de ese período."],
              ["Impuesto sobre las ventas", "Agregado automáticamente por Stripe a partir de la dirección de facturación registrada; la tasa es la de la jurisdicción, no algo que FieldQuo fije. Vea [[taxes-and-currency-on-your-subscription|Impuestos y moneda de su suscripción]]."],
              ["Su número fiscal de empresa", "Impreso si lo ingresó en la página de pago o en el portal; en blanco si no."],
              ["Dirección de facturación", "La dirección ingresada en la página de pago o actualizada en el portal."],
            ],
          } },
          { p: "Una recarga de crédito telefónico o de IA, o un pago del servicio de migración, aparece en el mismo portal como su propia factura única, con su propia línea — vea [[ai-credit-and-phone-credit|Crédito de IA y crédito telefónico]] y [[paying-for-the-migration-service|Pagar el servicio de migración]]." },
        ],
      },
      {
        id: "emails-fieldquo-sends",
        heading: "Correos que FieldQuo envía sobre su facturación",
        blocks: [
          { bullets: [
            "**Cuando empieza un plan**: una confirmación con el plan, **Status: Free trial** durante el mes gratis, y **Trial ends** o **Next billing date**. Enviada una vez, sin importar cuántas veces la página verifique con Stripe.",
            "**Cuando cae un cambio de plan**: el mismo correo, con el plan anterior y el nuevo, el día en que el cambio surte efecto.",
            "**Antes del primer cobro**: siete días antes de que una prueba se convierta en pago, con el monto y los últimos cuatro dígitos de la tarjeta si se conocen. Las renovaciones anuales reciben el mismo correo 30 días antes; las mensuales no reciben ninguno. Vea [[renewal-reminders|Recordatorios de renovación]].",
            "**Cuando falla un pago**: los avisos del período de gracia, vea [[failed-payments-and-the-grace-period|Pagos fallidos y el período de gracia]].",
            "**Cuando cancela**: una confirmación con la fecha en que termina su acceso.",
          ] },
          { p: "Ninguno de estos es una factura. La factura en sí está en el portal, y cualquier correo de recibo que llegue desde la propia dirección de Stripe es de Stripe, no de FieldQuo." },
        ],
      },
    ],
    faq: [
      { q: "¿FieldQuo puede enviarme la factura por correo cada mes?", a: "No desde la aplicación. La factura está en el portal de Stripe desde **Gestionar facturación y método de pago**, descargable en PDF." },
      { q: "¿Por qué la factura muestra impuesto cuando mis propias facturas a clientes no?", a: "Son dos ventas distintas. Stripe agrega el impuesto que aplica a FieldQuo vendiéndole a usted, según su dirección de facturación. El impuesto de sus facturas a clientes sale de su propia configuración de impuestos." },
      { q: "¿Mi suscripción está en la exportación contable?", a: "No. La exportación cubre los pagos de sus clientes y sus gastos. Registre la factura de FieldQuo como gasto de software a partir del PDF." },
    ],
  },
};
