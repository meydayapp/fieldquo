// content/help/es/invoices-and-payments-2.js
//
// Parte 2 de la categoría « invoices-and-payments » en español (ver el
// compositor, invoices-and-payments.js). Misma estructura que el inglés,
// artículo por artículo: mismos slugs, mismas secciones en el mismo orden,
// mismos bloques, mismas figuras — scripts/check-help-centre.mjs compara los
// dos. Las palabras en pantalla vienen del bloque `es` de
// app/i18n/appMessages.js.
export const ARTICLES = {
  "payment-processing-fees-and-payouts": {
    title: "Comisiones de procesamiento de pagos y transferencias",
    summary:
      "Lo que le cuesta un pago con tarjeta o por débito bancario, cómo aparece la comisión en cada pago, cuándo llega el dinero a su banco y cómo figura todo en su exportación contable.",
    updated: "2026-09-12",
    intro: [
      "Cuando un cliente paga una factura en línea, el pago pasa por la cuenta de Stripe de su empresa y llega a su cuenta bancaria. Antes de llegar, se descuenta una comisión de procesamiento de cada pago; nunca se factura aparte y no hay cuota mensual por cobrar. Este artículo cuenta toda la historia de esa comisión: las tarifas, dónde las ve, qué pasa con un reembolso o una disputa, y cómo la concilia su contador.",
      "En resumen: **3% + $0.30** con tarjeta, **1% + $0.40 con tope de $5** en un débito bancario canadiense, un **1%** opcional por recibir el dinero al instante, y **$15** si un cliente disputa un cobro. Todo lo demás en esta página explica esas cuatro cifras.",
    ],
    sections: [
      {
        id: "overview",
        heading: "Resumen",
        blocks: [
          { p: "Cada pago en línea de un cliente es un cobro de Stripe creado a nombre de su empresa y transferido a su cuenta bancaria. FieldQuo nunca retiene el dinero. La comisión de procesamiento se descuenta del propio pago: el cliente paga el total de la factura, la comisión se resta, y el **neto** es lo que Stripe deposita." },
          { p: "Verá tres cifras en cada pago en línea: el **importe** (lo que el cliente pagó y lo que se restó de la factura), la **comisión de procesamiento** y el **neto depositado**. Aparecen en la factura, en el registro del pago y en tres columnas de la exportación contable." },
          { note: "En FieldQuo no hay propinas ni ningún producto de capital o préstamo. Si conoce las páginas de ayuda de Jobber, esas dos secciones no tienen equivalente aquí: un cliente paga exactamente la factura, y el único dinero que se mueve es el de la factura." },
        ],
      },
      {
        id: "settings",
        heading: "Configuración",
        blocks: [
          { p: "Las tarifas están impresas en **Configuración → Pagos** antes de que conecte Stripe, para que nada de la comisión sea una sorpresa después de la primera transferencia. La tarjeta muestra cada método que Stripe cobra en su moneda, un ejemplo calculado sobre un pago con tarjeta de $2,260 ($68.10 de comisión, $2,191.90 depositados) y los dos recargos que solo aplican a algunas tarjetas." },
          { figure: "live:app-settings-payments", caption: "Configuración → Pagos — la tarjeta de comisiones de procesamiento, la cuenta de Stripe conectada y su estado." },
          { steps: [
            "Abra **Configuración → Pagos**.",
            "Lea la tarjeta **Comisiones de procesamiento**. Los pagos con tarjeta muestran 3% + $0.30; las empresas canadienses también ven Débito bancario (Canadá) a 1% + $0.40, máximo $5.00.",
            "Conecte Stripe (vea [[connect-stripe-and-get-verified|Conectar Stripe y verificar la cuenta]]). En cuanto Stripe informa que los cobros están habilitados, aparece un botón Pagar en cada factura que reciben sus clientes.",
          ] },
          { p: "No hay nada que configurar sobre la comisión en sí. Es la misma para todas las empresas, no se puede desactivar y no se puede trasladar al cliente como una línea de recargo aparte: el total de la factura es lo que el cliente paga." },
        ],
      },
      {
        id: "payouts",
        heading: "Cómo saber que un pago llegó a su banco",
        blocks: [
          { p: "Stripe transfiere su saldo a su banco según su calendario estándar: gratis, en unos **2 días hábiles** para una cuenta canadiense o estadounidense. FieldQuo muestra el pago como **Pagada** en cuanto Stripe confirma el cobro; la transferencia a su banco sigue al ritmo de Stripe." },
          { steps: [
            "En la factura, la línea del pago muestra la fecha, el método, el importe y, debajo, la comisión y el neto depositado.",
            "Para ver la transferencia en sí — el envío a su banco — abra **Configuración → Pagos → Gestionar en Stripe**. El panel Express de Stripe lista cada transferencia con su fecha de llegada y los pagos que contiene.",
            "La línea de su estado de cuenta coincidirá con el **neto depositado**, nunca con el importe bruto.",
          ] },
          { tip: "Si un pago figura como Pagada en FieldQuo pero no ha llegado nada tras unos días hábiles, normalmente Stripe está reteniendo o revisando la cuenta — vea [[payouts-held-or-under-review|Transferencias retenidas o en revisión]]. La página Pagos lo dice con todas las letras cuando es el caso." },
        ],
      },
      {
        id: "payments",
        heading: "Pagos",
        blocks: [
          { p: "Un cliente paga desde el botón Pagar del correo de la factura o desde el portal de cliente. Los métodos ofrecidos dependen de su moneda: tarjeta en todas partes, y débito bancario preautorizado para las empresas canadienses que facturan en dólares canadienses." },
          { p: "En cada pago, FieldQuo registra la comisión a la tarifa publicada, y la línea del pago en la factura dice, por ejemplo, **“comisión de tarjeta $68.10 · depositado $2,191.90”**. Un pago que registra a mano — efectivo, cheque, transferencia — no lleva comisión y no muestra ninguna." },
          { figure: "live:app-invoices", caption: "Facturas — Pendiente, Pagada y Total facturado, y luego cada factura con su estado y su saldo." },
          { p: "La financiación a plazos (Affirm), si la activa, la cobra Affirm en lugar de la tarifa de tarjeta; esa comisión se traslada en esos pagos de la misma manera." },
        ],
      },
      {
        id: "instant-payouts",
        heading: "Transferencias instantáneas",
        blocks: [
          { p: "En lugar de esperar al calendario estándar, puede pasar su saldo disponible de Stripe a una **tarjeta de débito** en unos 30 minutos, cualquier día y a cualquier hora. Cuesta el **1%** del importe (mínimo $0.50): la comisión de Stripe, trasladada al costo. FieldQuo no se queda con nada." },
          { steps: [
            "Abra **Configuración → Pagos** y busque la tarjeta **Transferencia instantánea**.",
            "Muestra lo disponible ahora, la comisión y lo que recibirá. Pulse **Transferir … ahora** y confirme.",
            "El dinero llega a la tarjeta de débito registrada en Stripe, normalmente en 30 minutos; su banco puede retrasarlo.",
          ] },
          { note: "Las transferencias instantáneas requieren una cuenta de Stripe de al menos **30 días**, las transferencias habilitadas y una tarjeta de débito registrada. Una cuenta bancaria solo recibe transferencias estándar: añada una tarjeta de débito en su panel de Stripe para usar las instantáneas. Todo el detalle: [[instant-payouts|Transferencias instantáneas]]." },
        ],
      },
      {
        id: "fees",
        heading: "Comisiones",
        blocks: [
          { table: {
            head: ["Método de pago", "Comisión", "Moneda"],
            rows: [
              ["Tarjeta (Visa, Mastercard, Amex y tarjetas de empresa por igual)", "3% + $0.30", "CAD y USD"],
              ["Débito bancario — débito preautorizado (Canadá)", "1% + $0.40, con tope de $5.00 por pago", "CAD"],
              ["Transferencia instantánea (opcional)", "1% de la transferencia, mínimo $0.50", "CAD y USD"],
              ["Disputa (contracargo)", "$15 por disputa, no se devuelve si usted gana", "CAD y USD"],
            ],
          } },
          { p: "La tarifa de tarjeta es una sola cifra sea cual sea la tarjeta: una tarjeta de empresa o una Amex cuesta el mismo 3% + $0.30 que una Visa de particular. Son 2.9% + $0.30 para Stripe más un margen de FieldQuo del 0.1%, y en todas partes ve una única tarifa combinada: en la página de configuración, en el registro del pago y en la exportación." },
          { p: "Dos recargos aplican solo cuando aplican, porque la tarjeta no se conoce hasta que se cobra: **+0.8%** en una tarjeta emitida fuera de Canadá, y **+2%** cuando el pago necesita una conversión de moneda. Se trasladan al costo de Stripe solo en ese pago. El débito bancario no tiene recargo." },
          { p: "Una **factura de $5,000 pagada por débito bancario cuesta $5** — el tope — mientras que la misma factura con tarjeta cuesta $150.30. Para facturas grandes de clientes canadienses, ofrecer el débito bancario es el mayor ahorro de esta página." },
          { p: "Stripe también cobra unas pequeñas comisiones de cuenta: una **cuota mensual de cuenta activa** en los meses en que cobra, y **0.25% + $0.25 por transferencia** a su banco. Se trasladan al costo y aparecen como su propia línea en su siguiente pago — “Comisiones de cuenta de Stripe $2.25 (2026-09)” — nunca mezcladas con la comisión de procesamiento." },
        ],
      },
      {
        id: "refunds",
        heading: "Reembolsos",
        blocks: [
          { p: "Un reembolso devuelve el dinero al cliente a través de Stripe. La comisión de procesamiento **no se devuelve**: Stripe conserva su comisión en un cobro reembolsado, así que la comisión ya descontada sigue descontada. El registro del pago sigue mostrando la comisión original, y el reembolso aparece en su panel de Stripe sobre el mismo cobro." },
          { warning: "Reembolse el importe de la factura, no el neto. Un cliente que pagó $2,260 espera recibir $2,260; los $68.10 de comisión son su costo por haber cobrado el pago." },
        ],
      },
      {
        id: "disputes",
        heading: "Disputas",
        blocks: [
          { p: "Cuando el titular de una tarjeta disputa un cobro, Stripe retira el importe disputado y una **comisión por disputa de $15** mientras la disputa está abierta. FieldQuo saca ambos de su saldo — el importe como retención, la comisión como comisión — y la factura muestra una línea como **“Disputa: $2,260.00 retenidos, $15.00 de comisión”**. Usted responde a la disputa en su panel de Stripe con sus pruebas: el presupuesto firmado, las fotos, la lista de verificación de fin de trabajo." },
          { bullets: [
            "**Si gana**, el importe retenido vuelve a usted. Stripe no devuelve los $15 de comisión por disputa, y la factura lo dice: “Disputa ganada: $2,260.00 devueltos. Stripe no reembolsa la comisión por disputa de $15.00.”",
            "**Si pierde**, el importe retenido se va y la comisión se queda: “Disputa perdida: $2,260.00 retirados, $15.00 de comisión”.",
          ] },
          { note: "Una disputa solo puede retirar lo que el pago le transfirió. Si el importe disputado más la comisión superan el neto que recibió, la diferencia se registra en lugar de absorberse en silencio: usted la verá, y el soporte también." },
        ],
      },
      {
        id: "negative-balances",
        heading: "Saldos negativos",
        blocks: [
          { p: "Su saldo de Stripe puede quedar en negativo tras una disputa o un reembolso mayor que lo disponible. Stripe recupera un saldo negativo de sus **siguientes pagos** antes de transferir nada y, para las comisiones de cuenta de Connect de arriba, FieldQuo añade lo pendiente a su siguiente cobro como su propia línea, con tope para que la comisión nunca supere el pago, y el resto se arrastra al pago siguiente." },
          { p: "Una empresa que deja de cobrar mantiene su saldo pendiente en los libros; nada se da por perdido en silencio." },
        ],
      },
      {
        id: "errors",
        heading: "Errores",
        blocks: [
          { bullets: [
            "**“Stripe está reteniendo su dinero”** en Configuración → Pagos — Stripe todavía necesita algo de usted (un documento, una cuenta bancaria, el nombre de un director). Abra **Gestionar en Stripe** y complete lo que pide; mientras tanto, los pagos de sus clientes siguen procesándose.",
            "**“Stripe está revisando su cuenta”** — ya envió todo y Stripe lo está comprobando, normalmente un día, a veces dos o tres. No hay nada que hacer.",
            "**Un pago sin comisión** — es un pago manual, o un pago en línea registrado antes de que las comisiones empezaran a anotarse en el pago. La exportación deja esas celdas vacías en lugar de escribir 0.00, porque “no se conoce la comisión” y “sin comisión” son afirmaciones distintas.",
            "**Falta el botón Pagar en una factura** — Stripe todavía no ha habilitado los cobros. Configuración → Pagos muestra qué está esperando.",
          ] },
        ],
      },
      {
        id: "accounting-export",
        heading: "Cómo figura en su exportación contable",
        blocks: [
          { p: "La exportación contable (**Gastos → Exportación contable**) genera archivos CSV para un rango de fechas, y el archivo de pagos lleva una línea por pago con tres columnas de dinero: **Amount** (el bruto: lo que el cliente pagó y lo que se restó de la factura), **Processing fee** y **Net deposited**, más una columna **Fee rate** que nombra el método con el que se cobró la comisión (“card”, “acss_debit”)." },
          { figure: "live:app-settings-expense-tracking", caption: "Control de gastos — la tarjeta Exportación contable, al final de la página, descarga el rango de fechas en archivos CSV." },
          { p: "Contabilice el bruto como ingreso y la comisión como gasto de comisiones bancarias a partir de la misma línea; el extracto bancario coincide entonces con **Net deposited**. El archivo de totales suma las comisiones de procesamiento por código de impuesto aparte del ingreso, de modo que la comisión es un gasto en sus libros, no una venta más pequeña." },
          { p: "Los pagos se filtran por la **fecha del propio pago**, no la de la factura: una factura de diciembre pagada en enero es dinero de enero. Las columnas de comisión quedan vacías para los pagos manuales y para los pagos en línea cobrados antes de que las comisiones se anotaran en el pago." },
          { tip: "Para importar en QuickBooks Online o Xero: asigne Amount → ingreso, Processing fee → comisiones bancarias, Net deposited → el depósito bancario. Vea [[the-accounting-export|La exportación contable]] y [[quickbooks-xero-and-your-bookkeeper|QuickBooks, Xero y su contador]]." },
        ],
      },
    ],
    faq: [
      { q: "¿Puedo trasladar la comisión al cliente?", a: "No como un recargo aparte: el total de la factura es lo que el cliente paga y la comisión se descuenta de su lado. Ponga precio al trabajo teniendo en cuenta la comisión, u ofrezca el débito bancario a los clientes canadienses, que tiene tope de $5." },
      { q: "¿Hay una cuota mensual por cobrar pagos?", a: "No. Stripe cobra una pequeña cuota de cuenta activa solo en los meses en que usted cobra, y se muestra como su propia línea en su siguiente pago." },
      { q: "¿Por qué mi estado de cuenta no coincide con el importe de la factura?", a: "El banco recibe el neto depositado: el importe menos la comisión de procesamiento. La factura y la exportación muestran ambas cifras." },
      { q: "¿FieldQuo retiene mi dinero?", a: "Nunca. El cobro se crea a nombre de su empresa y Stripe transfiere directamente a su banco." },
    ],
  },

  "bank-debit-in-canada": {
    title: "Débito bancario en Canadá: 1% con tope de $5",
    summary:
      "Dónde se ofrece el débito bancario preautorizado, cuánto cuesta, cuánto tarda un débito en liquidarse y por qué el tope de $5 es la forma más barata de cobrar una factura recurrente grande.",
    updated: "2026-09-12",
    intro: [
      "Un cliente canadiense con un plan de servicio puede pagar por débito preautorizado directamente desde su cuenta bancaria en lugar de con tarjeta. La comisión es de **1% + $0.40, con tope de $5.00** por pago, así que un débito de $5,000 le cuesta $5, mientras que el mismo importe con tarjeta cuesta $150.30. El débito bancario se traslada al costo de Stripe; FieldQuo no le añade nada.",
      "Este artículo dice exactamente dónde se ofrece el débito bancario (los planes de servicio facturados en dólares canadienses, no el botón Pagar de una factura puntual), qué acepta el cliente, cuánto tarda un débito en liquidarse y cómo figura la comisión en la factura y en su exportación contable.",
    ],
    sections: [
      {
        id: "overview",
        heading: "Resumen",
        blocks: [
          { p: "El débito bancario en FieldQuo es el débito preautorizado canadiense (PAD) a través de Stripe. El cliente guarda su cuenta bancaria una sola vez, en una página alojada por Stripe, y acepta por escrito una serie de pagos de un importe fijo con una periodicidad fija. A partir de ahí, cada ocurrencia del plan se debita sin que el cliente haga nada, y cada débito genera una factura que puede ver en su portal." },
          { p: "Se ofrece solo cuando la empresa factura en **CAD**. Stripe exige que la moneda del débito coincida con la cuenta bancaria canadiense del cliente, así que una empresa que factura en dólares estadounidenses ve la tarjeta como único método automático." },
          { note: "El débito bancario no se ofrece en el botón Pagar de una factura normal. Ese pago acepta tarjetas (y Affirm, si activó el pago a plazos). El débito bancario vive en los planes de servicio con cobro automático — vea [[service-plans|Planes de servicio]]." },
        ],
      },
      {
        id: "where-it-is-offered",
        heading: "Dónde se ofrece el débito bancario",
        blocks: [
          { p: "La elección la hace el cliente, no usted: cuando le pide a un cliente que autorice un plan, la página de Stripe ofrece una tarjeta o, para una empresa en CAD, una cuenta bancaria, y el cliente elige. Este es el camino desde su lado." },
          { steps: [
            "Abra **Planes de servicio** y cree el plan eligiendo **Cobrar automáticamente** en **Cómo se cobra**.",
            "Guárdelo. El plan dice **Se pidió el cobro automático, pero el cliente todavía no lo ha autorizado** hasta que el cliente actúe. Pulse **Pedirle al cliente que autorice los pagos** para enviarle el enlace por correo.",
            "El cliente lee las condiciones de autorización en su propia página, marca la casilla y llega a la página de Stripe, que ofrece **tarjeta** o **cuenta bancaria**. Para una cuenta bancaria, Stripe muestra su propio acuerdo de débito preautorizado y le envía una copia al cliente por correo.",
            "Una vez guardada la cuenta, el plan dice **Se cobra automáticamente — débito bancario**, con la fecha en que el cliente lo autorizó. Hasta entonces, factura cada visita, exactamente como un plan sin mandato.",
          ] },
          { figure: "live:app-plans", caption: "Planes de servicio — cada plan con su periodicidad, cómo se cobra y qué viene después." },
          { note: "El texto de autorización existe solo en inglés y en francés. A un cliente cuyo idioma no es ninguno de los dos no se le ofrece el cobro automático en absoluto: su plan envía una factura con enlace de pago en cada visita. Todo el detalle: [[service-plan-bank-debit-mandates|Planes de servicio pagados por débito bancario: el mandato]]." },
        ],
      },
      {
        id: "what-it-costs",
        heading: "Cuánto cuesta",
        blocks: [
          { table: {
            head: ["Importe debitado", "Comisión por débito bancario", "El mismo importe con tarjeta"],
            rows: [
              ["$200", "$2.40", "$6.30"],
              ["$460", "$5.00 (el tope)", "$14.10"],
              ["$5,000", "$5.00 (el tope)", "$150.30"],
            ],
          } },
          { p: "La comisión se descuenta del débito antes de que el dinero llegue a su banco, igual que la de tarjeta. La línea del pago en la factura dice, por ejemplo, **“comisión de débito bancario $5.00 · depositado $4,995.00”**, y la exportación contable escribe el método como “acss_debit” en su columna **Fee rate**. No hay recargo internacional ni de conversión de moneda en el débito bancario." },
          { tip: "El tope se alcanza en $460. Por encima, cada dólar adicional que un cliente paga por débito bancario está libre de comisión, y por eso un plan de mantenimiento trimestral o anual es el lugar para ofrecerlo." },
        ],
      },
      {
        id: "how-a-debit-settles",
        heading: "Cómo se liquida un débito",
        blocks: [
          { p: "Un cobro con tarjeta se responde en segundos. Un débito bancario se acepta de inmediato, pero el dinero se mueve después por el sistema bancario y tarda unos **5 días hábiles** en liquidarse." },
          { bullets: [
            "Mientras está en tránsito, la ocurrencia del plan aparece como en cobro y la factura **no** se marca como pagada: FieldQuo no muestra una cuenta saldada contra dinero que no ha llegado. Stripe le envía al cliente el aviso de débito que el mandato exige.",
            "Cuando se liquida, la factura pasa a **Pagada** y el cliente recibe por correo un recibo de su empresa.",
            "Si el banco lo devuelve (fondos insuficientes, una cuenta cerrada), la ocurrencia se marca como fallida y el cliente recibe por correo la factura con un enlace de pago, así que la visita sigue facturada y todavía puede pagarse con tarjeta.",
          ] },
          { warning: "Una cuenta bancaria que aún necesita la verificación por microdepósitos todavía no es un mandato. FieldQuo no registra la autorización hasta que Stripe informa que la configuración está completa, así que un plan puede decir “El cliente aceptó, pero aún no ha guardado una forma de pago” durante uno o dos días mientras el cliente confirma los depósitos." },
        ],
      },
      {
        id: "only-in-fieldquo",
        heading: "Lo que los otros programas no hacen",
        blocks: [
          { p: "Las páginas de comparación de FieldQuo registran lo que la página de precios de cada competidor publica, con la fecha en que se leyó. La página de Jobber, leída el 2026-09-12, cobra los pagos bancarios al 1% del importe sin tope, y las tarjetas a 2.9% + $0.30. La tarifa de tarjeta de FieldQuo es una décima de punto más alta — 3% + $0.30 — y su débito bancario se detiene en $5.00 por pago." },
          { p: "Así que la ventaja es el tope, no la tarifa de tarjeta. En una factura de $5,000 pagada desde una cuenta bancaria la diferencia es de $45; en una de $200 no hay ninguna. Dígalo así, porque eso es lo que dicen ambas páginas de precios." },
        ],
      },
      {
        id: "who-can-see-it",
        heading: "Quién puede configurarlo",
        blocks: [
          { p: "Los planes de servicio están bajo Facturas en la cuadrícula de acceso: quien puede ver facturas puede ver planes. Crear un plan y enviar el enlace de autorización requiere acceso de edición a facturas **y** la opción **pagos**: el nivel Gerente y superiores, y cualquier acceso personalizado con ambos. La comisión en sí no es un ajuste; nadie puede cambiarla." },
        ],
      },
    ],
    faq: [
      { q: "¿Puede un cliente pagar una factura puntual por débito bancario?", a: "No. El botón Pagar de una factura acepta tarjetas, más Affirm si ofrece financiación. El débito bancario está disponible a través de un plan de servicio que el cliente ha autorizado." },
      { q: "¿El tope de $5 es por pago o por mes?", a: "Por pago. Dos débitos de $5,000 en un mismo mes cuestan $5 cada uno." },
      { q: "¿Por qué la factura sigue sin pagar dos días después del débito?", a: "Un débito bancario tarda unos cinco días hábiles en liquidarse. La factura se marca como pagada cuando el dinero llega de verdad, no cuando se solicita el débito." },
    ],
  },

  "instant-payouts": {
    title: "Transferencias instantáneas",
    summary:
      "Pase su saldo disponible de Stripe a una tarjeta de débito en unos 30 minutos por una comisión del 1%, en lugar de esperar dos días hábiles a la transferencia estándar.",
    updated: "2026-09-12",
    intro: [
      "Stripe transfiere su saldo a su banco según su calendario estándar: gratis, en unos 2 días hábiles. Cuando necesita el dinero hoy, la tarjeta **Transferencia instantánea** de **Configuración → Pagos** envía lo disponible a una tarjeta de débito en unos 30 minutos, cualquier día y a cualquier hora, por el **1%** del importe (mínimo $0.50). Es la comisión de Stripe, trasladada al costo; FieldQuo no se queda con nada.",
      "Este artículo es la tarjeta en sí: qué muestra, qué hace el botón, las condiciones que Stripe le pone y cada razón por la que puede decir que no.",
    ],
    sections: [
      {
        id: "overview",
        heading: "Resumen",
        blocks: [
          { p: "Una transferencia instantánea es una transferencia de Stripe con el método fijado en instantáneo, enviada a la tarjeta de débito de su cuenta de Stripe. No es un préstamo ni un adelanto: mueve dinero que ya es suyo — pagos liquidados en su saldo de Stripe — antes de lo que lo haría el calendario estándar." },
          { p: "El importe es siempre el neto completo que Stripe informa como disponible en ese momento. No hay campo de importe, a propósito: FieldQuo nunca deja que un navegador envíe una cantidad de dinero, y una transferencia instantánea parcial sería un segundo producto. Una pulsación transfiere todo lo que puede salir." },
        ],
      },
      {
        id: "what-is-on-the-card",
        heading: "Qué hay en la tarjeta",
        blocks: [
          { p: "La tarjeta está en **Configuración → Pagos** una vez conectado Stripe. De arriba abajo muestra:" },
          { bullets: [
            "**Transferencia instantánea** y una frase que indica la comisión antes de cualquier botón: las reglas de Stripe exigen que la comisión sea bien visible, así que es una frase, no un globo de ayuda.",
            "**Disponible ahora** — el saldo bruto que Stripe puede transferir al instante, en su moneda.",
            "**Comisión** — lo que Stripe cobrará, con el porcentaje que representa (por ejemplo “$12.40 (1 %)”).",
            "**Recibirá** — el neto que llegará a la tarjeta, y **A su tarjeta de débito que termina en ····**.",
            "**Transferir … ahora** — el botón, con el importe neto en su etiqueta.",
            "**Transferencias instantáneas recientes** — las últimas transferencias enviadas desde aquí, con sus fechas e importes.",
          ] },
        ],
      },
      {
        id: "how-to",
        heading: "Cómo enviar una",
        blocks: [
          { steps: [
            "Abra **Configuración → Pagos** y busque la tarjeta **Transferencia instantánea**.",
            "Revise **Disponible ahora**, **Comisión** y **Recibirá**. Cada cifra viene de Stripe en ese momento.",
            "Pulse **Transferir … ahora**. Una línea de confirmación repite las tres cifras — “Transferir $1,240.00 ahora · comisión $12.40 · recibe $1,227.60”.",
            "Pulse **Confirmar transferencia**. La tarjeta dice **Enviado. Stripe prevé que llegue a su tarjeta en unos 30 minutos.**",
          ] },
          { figure: "live:app-settings-payments", caption: "Configuración → Pagos — la cuenta de Stripe conectada; la tarjeta Transferencia instantánea aparece debajo en cuanto la cuenta califica." },
          { note: "El dinero llega a la tarjeta de débito registrada en Stripe, normalmente en 30 minutos; su banco puede retrasarlo. Una segunda pulsación mientras la primera todavía se está enviando se rechaza con “Ya se está enviando una transferencia.”" },
        ],
      },
      {
        id: "what-it-costs",
        heading: "Cuánto cuesta",
        blocks: [
          { table: {
            head: ["Transferencia", "Comisión", "Llega"],
            rows: [
              ["Transferencia estándar a su banco", "Gratis", "Unos 2 días hábiles"],
              ["Transferencia instantánea a una tarjeta de débito", "1% del importe, mínimo $0.50", "Unos 30 minutos"],
            ],
          } },
          { p: "La tarjeta imprime la comisión que Stripe informó realmente para esta transferencia junto al 1% publicado; si la cifra de Stripe alguna vez difiere de la tarifa que le dijeron que esperara, usted ve la cifra de Stripe, y eso es lo que recibe." },
        ],
      },
      {
        id: "when-it-is-refused",
        heading: "Cuando la tarjeta dice que no",
        blocks: [
          { p: "La elegibilidad se decide a partir de las respuestas de Stripe, no de nada que FieldQuo guarde. Cada rechazo se imprime en la tarjeta con palabras claras:" },
          { bullets: [
            "**Conecte Stripe primero.** — todavía no hay cuenta de Stripe.",
            "**Disponible cuando su cuenta de Stripe pueda aceptar pagos.** — Stripe no ha habilitado los cobros.",
            "**Stripe aún no ha habilitado las transferencias en esta cuenta.** — las transferencias están en pausa; vea [[payouts-held-or-under-review|Transferencias retenidas o en revisión]].",
            "**Disponible cuando su cuenta de Stripe tenga 30 días. La suya tiene 12 días.** — una cuenta nueva no puede transferir al instante. Treinta días es la ventana de “cuenta nueva” de Stripe para el riesgo de transferencias, y FieldQuo, como plataforma, responde por un saldo negativo en una cuenta joven.",
            "**Las transferencias instantáneas van a una tarjeta de débito. Una cuenta bancaria solo recibe transferencias habituales: añada una tarjeta de débito en su panel de Stripe.** — en Canadá en particular, una cuenta bancaria solo recibe transferencias estándar. La tarjeta ofrece **Añadir una tarjeta de débito en Stripe**.",
            "**Ahora mismo no hay nada disponible para transferir al instante.** — el saldo está en cero, o todavía pendiente.",
          ] },
        ],
      },
      {
        id: "who-can-use-it",
        heading: "Quién puede usarla",
        blocks: [
          { p: "Propietarios y administradores: las mismas personas que pueden abrir **Configuración → Pagos**. Una sesión de soporte de solo lectura ve la tarjeta pero no puede pulsar el botón. Cada transferencia queda registrada con quién la envió." },
        ],
      },
    ],
    faq: [
      { q: "¿Puedo transferir una parte del saldo?", a: "No. El botón transfiere el neto completo que Stripe informa como disponible. Si quiere dejar algo en el saldo, espere a la transferencia estándar." },
      { q: "¿Una transferencia instantánea le cuesta algo a FieldQuo, o le gana algo?", a: "Ninguna de las dos cosas. Stripe cobra el 1% y FieldQuo lo traslada al costo." },
      { q: "Mi cuenta bancaria está registrada. ¿Por qué no puedo transferir al instante?", a: "Las transferencias instantáneas van a una tarjeta de débito, no a una cuenta bancaria. Añada una tarjeta de débito en su panel de Stripe; la tarjeta de la página de configuración lleva directamente allí." },
    ],
  },

  "payouts-held-or-under-review": {
    title: "Transferencias retenidas o en revisión",
    summary:
      "Por qué los pagos de los clientes pueden seguir procesándose mientras nada llega a su banco, cómo Configuración → Pagos le dice cuál de los dos casos es, y qué hacer en cada uno.",
    updated: "2026-09-12",
    intro: [
      "Cobrar pagos y recibir transferencias son dos interruptores distintos en una cuenta de Stripe. Stripe puede seguir aceptando las tarjetas de sus clientes mientras retiene el dinero, y desde dentro de la aplicación todo parece funcionar: las facturas pasan a **Pagada**, el saldo crece y no llega nada. **Configuración → Pagos** ahora lo dice en un aviso ámbar en cuanto Stripe informa que las transferencias están desactivadas, y le dice si la espera depende de usted o de Stripe.",
      "Este artículo es ese aviso, la tarjeta de la cuenta debajo, y las razones que da Stripe.",
    ],
    sections: [
      {
        id: "overview",
        heading: "Resumen",
        blocks: [
          { p: "Cada vez que abre **Configuración → Pagos**, FieldQuo le pide a Stripe el estado real de su cuenta: si los cobros están habilitados, si las transferencias están habilitadas, qué falta todavía, qué está en verificación y la razón que da Stripe si la cuenta está restringida. Nada de esto viene de una caché de otro día." },
          { p: "Las transferencias se detienen por dos razones que piden acciones opuestas: Stripe **está esperando algo de usted** (un documento, una cuenta bancaria, el nombre de un director), o Stripe **está comprobando lo que ya envió**. Distinguirlas es toda la razón de ser del aviso: pedirle a alguien que “aporte más información” mientras Stripe la revisa es como el mismo documento acaba subido cuatro veces." },
        ],
      },
      {
        id: "the-two-banners",
        heading: "Los dos avisos",
        blocks: [
          { bullets: [
            "**Stripe está reteniendo su dinero** — “Los pagos de sus clientes se procesan, pero Stripe no transferirá nada a su banco hasta tener lo que aún le falta de usted. Abra Gestionar en Stripe abajo y complete lo que pide.” Debajo, la razón de Stripe cuando dio una.",
            "**Stripe está revisando su cuenta** — “Ya les envió todo lo que pidieron. Las transferencias a su banco están en pausa hasta que terminen — normalmente un día, a veces dos o tres. Mientras tanto los pagos de sus clientes siguen procesándose y no tiene que hacer nada.”",
          ] },
          { p: "El aviso aparece solo en una cuenta activa, con los cobros habilitados. Mientras los cobros siguen desactivados no hay dinero que retener, y el bloque de configuración de arriba ya dice qué está sin terminar." },
        ],
      },
      {
        id: "your-stripe-account",
        heading: "La tarjeta “Su cuenta de Stripe”",
        blocks: [
          { p: "Debajo de la conexión, los propietarios ven una tarjeta titulada **Su cuenta de Stripe**. Existe porque alguien con las transferencias retenidas antes no podía identificar su propia cuenta ante la empresa que retenía su dinero. Muestra:" },
          { bullets: [
            "**ID de cuenta de Stripe** con un botón de copiar, y el **Correo de inicio de sesión** al que Stripe envía el código de acceso Express.",
            "**Lo que Stripe tiene activado** — **Cobro con tarjeta: Activado / Desactivado** y **Transferencias a su banco: Activado / En pausa**.",
            "**Lo que Stripe sigue esperando** — cada elemento pendiente en palabras claras, en inglés (una foto de su identificación, una cuenta bancaria para las transferencias, su número de empresa), con la **Fecha límite de Stripe** cuando la hay; o “Nada de su parte. Stripe está revisando lo que ya envió; volver a enviarlo no lo acelerará.”",
          ] },
          { note: "Esta tarjeta es solo para el propietario: el ID de cuenta y el correo de inicio de sesión son la mitad de credenciales de la relación bancaria de la empresa. Los administradores ven el aviso y la conexión, pero no esta tarjeta. La lista completa de lo que Stripe pide, y por qué, está en [[what-stripe-asks-for-and-why|Lo que Stripe pide, y por qué]]." },
        ],
      },
      {
        id: "how-to-clear-a-hold",
        heading: "Cómo levantar una retención",
        blocks: [
          { steps: [
            "Abra **Configuración → Pagos** y lea el aviso. Si dice **revisando**, deténgase aquí: no hay nada que enviar.",
            "Si dice **reteniendo**, lea **Lo que Stripe sigue esperando** en la tarjeta de la cuenta, para saber qué tener listo.",
            "Pulse **Gestionar en Stripe**. El panel Express de Stripe se abre con un aviso que reúne exactamente esos elementos y los ajustes que los resuelven.",
            "Aporte lo que se pide. Vuelva a **Configuración → Pagos**; la página vuelve a leer Stripe en cada carga, así que el aviso cambia a **revisando** en cuanto Stripe tiene su envío, y desaparece cuando las transferencias vuelven a estar activas.",
          ] },
          { figure: "live:app-settings-payments", caption: "Configuración → Pagos — la cuenta conectada, sus interruptores y lo que Stripe sigue esperando." },
          { tip: "Si el panel de Stripe realmente no puede resolverlo, al soporte de Stripe se llega desde ese panel una vez que ha iniciado sesión. Deles el ID de cuenta de la tarjeta: es lo que identifica su cuenta ante ellos. FieldQuo no puede levantar una retención; la cuenta es suya, a su nombre." },
        ],
      },
      {
        id: "stripes-reasons",
        heading: "Las razones que da Stripe",
        blocks: [
          { p: "Cuando Stripe restringe una cuenta, envía un código de máquina. FieldQuo imprime la frase que le corresponde en lugar del código; esas frases, igual que la lista de elementos pendientes, aparecen en inglés en pantalla, y esto es lo que significan:" },
          { table: {
            head: ["Lo que dice la página", "Lo que significa"],
            rows: [
              ["Stripe está esperando información que ya está atrasada.", "Algo de la lista pasó su fecha límite. Apórtelo y las transferencias se reanudan tras la revisión."],
              ["Stripe sigue comprobando lo que envió. No hay nada que hacer.", "Verificación en curso: el caso “revisando”."],
              ["Stripe está revisando la cuenta.", "Una revisión manual, sin elementos pendientes. Normalmente uno o tres días."],
              ["Stripe está revisando una posible coincidencia con una lista de sanciones.", "Un nombre coincidió con una lista de vigilancia. Stripe lo resuelve; puede pedir una identificación."],
              ["Stripe cerró la cuenta por sospecha de fraude / por incumplir las condiciones del servicio / tras una coincidencia con una lista de sanciones.", "La cuenta está cerrada. Solo Stripe puede reabrirla: contáctelos desde el panel."],
              ["FieldQuo pausó esta cuenta.", "Una pausa de la plataforma. Contacte al soporte de FieldQuo."],
            ],
          } },
        ],
      },
      {
        id: "what-keeps-working",
        heading: "Qué sigue funcionando mientras las transferencias están en pausa",
        blocks: [
          { p: "Todo, del lado del cliente. Los botones Pagar siguen funcionando, los cobros siguen aprobándose, las facturas siguen pasando a **Pagada** y la comisión de procesamiento se sigue cobrando a la tarifa publicada. El dinero queda en su saldo de Stripe y se transfiere, según el calendario estándar, en cuanto las transferencias vuelven a habilitarse: nada se pierde y nada hay que reenviar. Las transferencias instantáneas se rechazan mientras las transferencias están desactivadas." },
        ],
      },
      {
        id: "who-can-see-it",
        heading: "Quién puede verlo",
        blocks: [
          { p: "**Configuración → Pagos** es para propietarios y administradores. La tarjeta **Su cuenta de Stripe**, con el ID y el correo de inicio de sesión, es solo para el propietario. Una sesión de soporte de solo lectura ve todo lo que hay en la página, incluida esa tarjeta, porque “por qué está retenido el dinero de esta empresa” es la razón más común para abrir una sesión de soporte, y no puede cambiar nada." },
        ],
      },
    ],
    faq: [
      { q: "Mis clientes pagaron hace una semana y mi banco no muestra nada. ¿Se perdió el dinero?", a: "No. Abra Configuración → Pagos: si el aviso ámbar está ahí, Stripe retiene el saldo hasta tener lo que necesita, o mientras revisa. Transfiere en cuanto las transferencias vuelven a habilitarse." },
      { q: "¿Puede FieldQuo liberar el dinero?", a: "No. La cuenta de Stripe es suya, a su nombre; FieldQuo nunca retiene el dinero y no puede levantar una retención. El panel de Stripe, y el soporte de Stripe desde dentro de ese panel, son las únicas palancas." },
      { q: "¿Debería subir el documento otra vez para acelerar las cosas?", a: "No si la página dice que Stripe está revisando. Volver a enviarlo no lo acelerará y a menudo reinicia la cola." },
    ],
  },

  "refunds": {
    title: "Reembolsos",
    summary:
      "Cómo devolverle un pago en línea a un cliente a través de Stripe, qué registra FieldQuo cuando lo hace, y por qué la comisión de procesamiento sigue descontada.",
    updated: "2026-09-12",
    intro: [
      "Un reembolso devuelve una parte o la totalidad de un pago en línea a la tarjeta o la cuenta bancaria del cliente. Usted lo emite en su panel de Stripe — no hay botón de reembolso en FieldQuo — y FieldQuo lo registra en cuanto Stripe lo informa: la línea del pago, el saldo y el estado de la factura, y una notificación a las personas que se ocupan de los pagos.",
      "La comisión de procesamiento no se devuelve. Stripe conserva su comisión en un cobro reembolsado, así que la comisión ya descontada sigue descontada. Reembolse el importe que el cliente pagó, no el neto que usted recibió.",
    ],
    sections: [
      {
        id: "overview",
        heading: "Resumen",
        blocks: [
          { p: "Cada pago en línea es un cobro de Stripe a nombre de su empresa. Reembolsarlo es una acción de Stripe, hecha desde el panel Express detrás de **Gestionar en Stripe**, por el importe completo o una parte, una vez o varias. FieldQuo escucha la confirmación de Stripe y actualiza la factura: nunca emite un reembolso de factura por su cuenta, y nunca saca dinero de su saldo sin que Stripe le diga que el reembolso ocurrió." },
          { note: "Hay un reembolso que FieldQuo sí emite por sí mismo: la tarifa de visita de una reserva, devuelta cuando un cliente cancela una visita dentro del plazo de aviso que usted fijó. Es una regla aparte — vea [[booking-fees-and-visit-deposits|Tarifas de reserva y depósitos de visita]]." },
        ],
      },
      {
        id: "how-to-refund",
        heading: "Cómo reembolsar un pago en línea",
        blocks: [
          { steps: [
            "Abra la factura y anote la fecha y el importe del pago en su línea.",
            "Abra **Configuración → Pagos** y pulse **Gestionar en Stripe**.",
            "En el panel de Stripe, abra el pago y reembólselo: el importe completo o una parte.",
            "De vuelta en FieldQuo, la factura se actualiza sola en cuanto Stripe confirma el reembolso. No hay nada que pulsar.",
          ] },
          { figure: "live:app-settings-payments", caption: "Configuración → Pagos — Gestionar en Stripe abre el panel donde se emiten los reembolsos." },
          { warning: "Reembolse el importe de la factura, no el neto. Un cliente que pagó $2,260 espera recibir $2,260; los $68.10 de comisión son su costo por haber cobrado el pago, y Stripe no los devuelve." },
        ],
      },
      {
        id: "what-fieldquo-records",
        heading: "Qué registra FieldQuo",
        blocks: [
          { bullets: [
            "La línea del pago conserva su importe y su comisión originales, y suma el importe reembolsado y la fecha. Un segundo reembolso parcial sobre el mismo cobro actualiza la misma línea con el nuevo total reembolsado; nunca una segunda línea.",
            "La cifra pagada de la factura baja en el reembolso y su saldo sube en la misma cantidad. Una factura reembolsada por completo dice **Reembolsada**; una reembolsada en parte dice **Reembolso parcial**, con un aviso como “Reembolsada en parte — se le devolvieron $500.00 al cliente.”",
            "Propietarios y administradores reciben una notificación: “Se retiró dinero de la factura INV-1042 — Jane Tremblay”, marcada **Reembolsado**. El nivel Gerente no la recibe — vea [[disputes-and-chargebacks|Disputas y contracargos]] para saber a quién se avisa.",
            "En la exportación contable, el pago conserva su bruto, su comisión y su neto; el reembolso aparece en su panel de Stripe sobre el mismo cobro.",
          ] },
          { p: "Un reembolso sobre una versión anterior de una factura modificada se aplica a la versión más reciente, porque la familia de versiones comparte un único saldo acumulado." },
        ],
      },
      {
        id: "the-fee",
        heading: "La comisión en un pago reembolsado",
        blocks: [
          { p: "Stripe conserva su comisión de procesamiento en un cobro reembolsado. Un reembolso emitido desde su panel deja la comisión donde está, y el único reembolso que FieldQuo emite por sí mismo — la tarifa de visita — se crea con la comisión deliberadamente **no** devuelta: devolverla dejaría a FieldQuo pagándole a Stripe por un pago que nadie conservó. Así que la comisión que vio en la línea del pago es la comisión que pagó, con reembolso o sin él." },
          { p: "Si su saldo no puede cubrir un reembolso, Stripe recupera la diferencia de sus siguientes pagos antes de transferir nada — vea la sección de saldos negativos de [[payment-processing-fees-and-payouts|Comisiones de procesamiento de pagos y transferencias]]." },
        ],
      },
      {
        id: "manual-payments",
        heading: "Reembolsar un pago en efectivo, con cheque o por transferencia",
        blocks: [
          { p: "FieldQuo no registra reembolsos de pagos manuales. El formulario **Registrar pago** rechaza un importe negativo, así que un reembolso en efectivo que usted entrega no puede anotarse como pago. Devuelva el dinero fuera de la aplicación y, si la factura debe mostrar un total menor, modifique la factura — vea [[edit-an-invoice-after-sending|Editar una factura después de enviarla]]." },
        ],
      },
      {
        id: "who-can",
        heading: "Quién puede reembolsar",
        blocks: [
          { p: "Quien pueda abrir **Gestionar en Stripe**: propietarios y administradores. Ver el reembolso en la factura requiere la opción **pagos**, que el nivel Gerente tiene y los niveles Cuadrilla, Estimador y Despachador no." },
        ],
      },
    ],
    faq: [
      { q: "¿Hay un botón de reembolso en la factura?", a: "No. Los reembolsos se emiten en su panel de Stripe mediante Gestionar en Stripe; FieldQuo registra el resultado automáticamente." },
      { q: "¿El cliente recupera su comisión de procesamiento?", a: "El cliente nunca pagó una comisión: pagó el total de la factura. Reembolse ese total. La comisión se descontó de su lado y sigue descontada." },
      { q: "¿El recordatorio de vencimiento reclamará una factura reembolsada?", a: "No. El recordatorio automático de vencimiento solo reclama facturas que siguen en estado Enviada o Atrasada; una factura reembolsada o con reembolso parcial no es ninguna de las dos." },
    ],
  },

  "disputes-and-chargebacks": {
    title: "Disputas y contracargos",
    summary:
      "Qué pasa cuando el banco de un cliente disputa un pago con tarjeta: a quién se avisa, qué muestra la factura, adónde va el dinero mientras está abierta, y cuánto cuesta ganar o perder.",
    updated: "2026-09-12",
    intro: [
      "Una disputa — un contracargo — es un titular de tarjeta que le pide a su banco que retire un pago. Stripe saca del saldo el importe disputado y una comisión por disputa de **$15** mientras está abierta, inicia un plazo para presentar pruebas y espera su respuesta. FieldQuo le avisa en el momento en que ocurre, marca la factura como **En disputa** y mueve los importes para que sea su saldo, no el de FieldQuo, el que los soporte.",
      "Antes de que existiera el canal de notificaciones de FieldQuo, un contracargo no avisaba a nadie: el contratista se enteraba la siguiente vez que abría el panel de Stripe, a menudo después del plazo. Esa es la razón por la que se construyó el canal.",
    ],
    sections: [
      {
        id: "overview",
        heading: "Resumen",
        blocks: [
          { p: "Cada pago de un cliente es un cobro de Stripe creado en la plataforma de FieldQuo y transferido a su cuenta. Cuando el titular de la tarjeta lo disputa, Stripe le carga a la plataforma el importe disputado y los $15 de comisión. FieldQuo revierte ambos de la transferencia que le hizo a usted — en dos movimientos separados, para que sigan siendo legibles por separado en la línea del pago — y la factura muestra **“Disputa: $2,260.00 retenidos, $15.00 de comisión”**." },
          { p: "Usted responde en su panel de Stripe con pruebas. El presupuesto firmado, las fotos del trabajo terminado, la lista de verificación de fin de trabajo y el hilo de correos son lo que gana las disputas; FieldQuo lo tiene todo en el trabajo y en el presupuesto." },
        ],
      },
      {
        id: "what-you-see",
        heading: "Qué ve en FieldQuo",
        blocks: [
          { bullets: [
            "Una notificación, marcada como crítica, a propietarios y administradores (vea a quién se avisa, más abajo): “Se retiró dinero de la factura INV-1042 — Jane Tremblay”, etiquetada **Contracargo — Stripe tiene un plazo**.",
            "El estado de la factura pasa a **En disputa**: prevalece sobre Pagada, porque un banco a mitad de decisión es un hecho distinto de cualquiera de los dos.",
            "Un aviso en la factura: “El banco de un cliente impugnó un pago de esta factura — el dinero queda retenido hasta que se resuelva.”",
            "La línea del pago: **Disputa: $2,260.00 retenidos, $15.00 de comisión** mientras está abierta; después, o bien **Disputa ganada: $2,260.00 devueltos. Stripe no reembolsa la comisión por disputa de $15.00.** o bien **Disputa perdida: $2,260.00 retirados, $15.00 de comisión**.",
          ] },
          { figure: "live:app-invoices", caption: "Facturas — una factura en disputa muestra su estado en la lista como cualquier otra." },
        ],
      },
      {
        id: "what-happens-to-the-money",
        heading: "Qué pasa con el dinero",
        blocks: [
          { table: {
            head: ["Etapa", "El importe disputado", "La comisión de $15"],
            rows: [
              ["Abierta", "Revertido de su transferencia y retenido", "Revertida de su transferencia"],
              ["Ganada", "Transferido de vuelta a usted", "No se devuelve: Stripe se la queda"],
              ["Perdida", "Se pierde; se suma al total reembolsado de la factura", "No se devuelve"],
            ],
          } },
          { p: "Una reversión solo puede retirar lo que la transferencia le dio. La transferencia de un pago con tarjeta de $2,260 fue de $2,191.90 — el neto tras la comisión de procesamiento — así que una disputa por el importe completo más la comisión la supera en $83.10. La retención se toma primero, la comisión de lo que queda, y cualquier faltante se registra como tal en lugar de absorberse en silencio. En la práctica, una disputa suele ser menor que la transferencia y el faltante es como máximo la comisión." },
          { note: "Stripe no emite un reembolso cuando se pierde una disputa: el cobro simplemente queda revertido. FieldQuo suma una disputa perdida al total reembolsado de la factura, una sola vez, para que la factura diga después Reembolsada o Reembolso parcial en lugar de En disputa para siempre." },
        ],
      },
      {
        id: "how-to-respond",
        heading: "Cómo responder",
        blocks: [
          { steps: [
            "Abra la notificación, o la factura: la línea del pago muestra el importe retenido y la comisión.",
            "Reúna las pruebas en FieldQuo: el presupuesto aceptado con la aprobación del cliente, las fotos y la lista de verificación del trabajo, el hilo de correos de la factura.",
            "Abra **Configuración → Pagos → Gestionar en Stripe**, busque la disputa y presente las pruebas antes del plazo de Stripe.",
            "Espere la decisión de la red de tarjetas. La factura se actualiza sola cuando Stripe informa que la disputa se cerró.",
          ] },
          { warning: "El plazo es de Stripe, no de FieldQuo, y es corto: días, no semanas. Una disputa sin respuesta se pierde por defecto. Trate la notificación como urgente." },
        ],
      },
      {
        id: "the-fee",
        heading: "La comisión por disputa",
        blocks: [
          { p: "Stripe cobra **$15** por disputa, en CAD o en USD, y no los devuelve cuando usted gana. FieldQuo los traslada al costo, y la factura lo dice con todas las letras cuando se gana una disputa. No hay ninguna comisión de FieldQuo encima." },
        ],
      },
      {
        id: "who-is-told",
        heading: "A quién se avisa",
        blocks: [
          { p: "La notificación llega a propietarios y administradores, y a cualquier miembro con acceso personalizado cuya cuadrícula incluya la opción **pagos**: alguien a quien un propietario le confió deliberadamente el cobro. El nivel Gerente tiene la opción pero queda fuera a propósito, igual que Despachador, para que los ingresos de la empresa no se le empujen a gente que el propietario ve como jefes de cuadrilla; los niveles Cuadrilla y Estimador tienen la opción desactivada y nunca la ven. No se envía ningún correo: la fila del canal es el registro, más una notificación push en cualquier teléfono o navegador donde la persona las haya activado." },
        ],
      },
    ],
    faq: [
      { q: "¿Puedo reembolsarle al cliente en lugar de pelear la disputa?", a: "No una vez abierta: Stripe ya retiró el importe. Acepte la disputa en su panel de Stripe si no quiere impugnarla; el resultado es el mismo que perder, incluida la comisión de $15." },
      { q: "¿Una disputa bloquea las otras facturas del cliente?", a: "No. Solo la factura en disputa cambia de estado. Las otras facturas del cliente y su portal no se ven afectados." },
      { q: "¿De dónde salen los $15 si mi saldo está vacío?", a: "Stripe recupera un saldo negativo de sus siguientes pagos antes de transferir nada. Nada se da por perdido en silencio." },
    ],
  },

  "deposits-and-payment-schedules": {
    title: "Anticipos y calendarios de pago",
    summary:
      "Reparta lo que se debe por un trabajo en un anticipo y etapas posteriores ligadas a las fechas del propio trabajo, desde la tarjeta Calendario de pagos de Configuración → Configuración de la empresa.",
    updated: "2026-09-12",
    intro: [
      "La mayoría de los oficios cobran un anticipo y el saldo después. La tarjeta **Calendario de pagos** de **Configuración → Configuración de la empresa** convierte eso en reglas: un porcentaje al crear la factura, un porcentaje al inicio del trabajo, a la mitad o al terminarlo. Cada presupuesto aceptado a partir de entonces genera una sola factura, solicitada en esas etapas, cada una con su propio enlace de pago por su propia parte.",
      "Está desactivado por defecto: sin etapas, cada presupuesto genera una sola factura completa al aceptarse, exactamente como siempre. Este artículo es la tarjeta; cómo se solicita realmente cada etapa está en [[progress-payments-by-stage|Pagos por avance: cómo se solicita cada etapa]].",
    ],
    sections: [
      {
        id: "overview",
        heading: "Resumen",
        blocks: [
          { p: "Un calendario es una lista de etapas. Cada una tiene un nombre, un desencadenante y un porcentaje, y los porcentajes deben sumar exactamente 100. Los importes se calculan a partir del total del presupuesto aceptado en el momento en que el cliente lo aprueba, y se congelan en el trabajo: una etapa ya solicitada nunca cambia porque una fecha se movió después." },
          { p: "La tarjeta también redacta sus **Condiciones de pago** por usted: con un calendario guardado, las condiciones en cada presupuesto, factura y PDF dicen “30% Anticipo, 40% Inicio del trabajo, 15% A la mitad, 15% Al terminar”, generadas a partir de las etapas, para que el documento que ve el cliente siempre coincida con lo que de verdad se factura. El campo de texto libre de las condiciones queda bloqueado mientras hay un calendario activo." },
        ],
      },
      {
        id: "what-is-on-the-card",
        heading: "Qué hay en la tarjeta",
        blocks: [
          { p: "“Reparte lo que se debe en etapas ligadas al trabajo mismo — un anticipo al enviar la factura, y el resto al empezar el trabajo, a la mitad o al terminarlo. Está desactivado por defecto; actívalo agregando una etapa abajo.” Cada fila de etapa tiene **Nombre de la etapa**, **Cuándo** y **Porcentaje**; la lista **Cuándo** ofrece cuatro desencadenantes:" },
          { bullets: [
            "**Anticipo — al crear y enviar la factura** — se dispara en el momento en que se acepta el presupuesto, antes de que se conozca ninguna fecha.",
            "**Inicio del trabajo** — la fecha de inicio del trabajo.",
            "**A la mitad del trabajo** — el día central del trabajo, contado a partir de sus fechas de inicio y fin.",
            "**Fin del trabajo (terminado)** — la fecha de fin programada del trabajo, no el día en que la cuadrilla terminó de verdad.",
          ] },
          { p: "Debajo de las filas: **Total** con la suma acumulada, **Agregar una etapa**, **Quitar esta etapa** en cada fila, **Guardar calendario** y **Desactivar — volver al texto libre**." },
        ],
      },
      {
        id: "how-to-set-up",
        heading: "Cómo configurar uno",
        blocks: [
          { steps: [
            "Abra **Configuración → Configuración de la empresa** y busque la tarjeta **Calendario de pagos**.",
            "Pulse **Agregar una etapa**. La primera fila viene por defecto como **Anticipo**; escriba el porcentaje.",
            "Agregue el resto — por ejemplo **Inicio del trabajo** 40, **A la mitad** 15, **Al terminar** 15 — renombrando cualquier etapa con sus propias palabras.",
            "Vigile **Total**: “Las etapas tienen que sumar exactamente 100% para poder guardarse.” Pulse **Guardar calendario** cuando marque 100.",
          ] },
          { figure: "live:app-settings-company", caption: "Configuración → Configuración de la empresa — la tarjeta Calendario de pagos, con Alcance del trabajo y condiciones encima." },
          { note: "Hasta 12 etapas, cada nombre de hasta 80 caracteres. Una etapa al 0% está permitida y simplemente se deja sin cobrar cuando llega su turno: no se envía ningún correo de $0 al cliente." },
        ],
      },
      {
        id: "what-each-control-changes",
        heading: "Qué cambia cada control",
        blocks: [
          { table: {
            head: ["Control", "Qué cambia"],
            rows: [
              ["Nombre de la etapa", "La etiqueta en el correo del cliente y en el calendario del trabajo. Editable; nunca se vuelve a derivar una vez guardada."],
              ["Cuándo", "Qué fecha del trabajo libera la solicitud. Una etapa sin fecha utilizable espera, de forma visible, y nunca se salta."],
              ["Porcentaje", "La parte de la etapa sobre el total aceptado. La última etapa absorbe el redondeo para que las etapas sumen al centavo."],
              ["Guardar calendario", "Escribe las etapas y regenera la frase de las Condiciones de pago. Aplica a los presupuestos aceptados de ahora en adelante; los trabajos ya en curso conservan sus etapas congeladas."],
              ["Desactivar — volver al texto libre", "Borra todas las etapas. Los presupuestos nuevos vuelven a generar una sola factura completa y el campo de Condiciones de pago vuelve a ser editable."],
            ],
          } },
        ],
      },
      {
        id: "the-halfway-math",
        heading: "Cómo se cuenta la mitad",
        blocks: [
          { p: "Los días se cuentan de forma inclusiva: un trabajo del 1 al 6 de septiembre es un trabajo de 6 días. La mitad es el día 3, así que la solicitud sale el 3 de septiembre. Una duración impar redondea **hacia arriba**: un trabajo de 5 días pide el día 3, una vez que más de la mitad del trabajo está realmente hecha, nunca el día 2. Las fechas son el inicio y el fin programados del trabajo; un trabajo con solo una de las dos muestra “Todavía no se puede programar” en las etapas que necesitan la otra." },
        ],
      },
      {
        id: "turning-it-off",
        heading: "Desactivarlo",
        blocks: [
          { warning: "“Esto borra todas las etapas. Los trabajos que ya usan este calendario conservan lo que ya se facturó; los presupuestos nuevos usarán las condiciones de texto libre de abajo.” Desactivarlo no anula ninguna solicitud ya enviada y no reembolsa nada." },
        ],
      },
      {
        id: "who-can-change-it",
        heading: "Quién puede cambiarlo",
        blocks: [
          { p: "Guardar o borrar el calendario requiere la capacidad **user:manage**: propietarios, administradores y los niveles Despachador y Gerente. **Configuración → Configuración de la empresa** está oculta para los niveles Cuadrilla y Estimador. El depósito de visita de la página de reservas es otra cosa, y se fija en **Configuración → Página de reservas** — vea [[booking-fees-and-visit-deposits|Tarifas de reserva y depósitos de visita]]." },
        ],
      },
    ],
    faq: [
      { q: "¿Un calendario crea varias facturas?", a: "No. Una factura por trabajo, solicitada en etapas. Cada etapa envía por correo un enlace de pago con tope en su propia parte de esa única factura; el saldo de la factura es el total acumulado de todas las etapas pagadas." },
      { q: "¿Puedo fijar un calendario distinto por presupuesto?", a: "Hoy no. El calendario es de toda la empresa y aplica a cada presupuesto aceptado mientras está activo. Desactívelo para un trabajo puntual que deba facturarse completo." },
      { q: "¿Y el trabajo añadido después de la aceptación?", a: "Las etapas son porcentajes del presupuesto aceptado. Los cambios aceptados se cobran en el saldo de la factura, no con una etapa, y la página del trabajo dice de cuánto se trata." },
    ],
  },

  "progress-payments-by-stage": {
    title: "Pagos por avance: cómo se solicita cada etapa",
    summary:
      "Qué dispara cada etapa de un calendario de pagos, qué recibe el cliente, cómo la página del trabajo muestra En espera, Solicitado y Sin cobrar, y qué pasa cuando las fechas del trabajo se mueven.",
    updated: "2026-09-12",
    intro: [
      "Con un calendario de pagos activo, aceptar un presupuesto crea el trabajo, la única factura que le corresponde y una copia congelada del calendario en ese trabajo: cada etapa con su parte en dólares y, cuando se conoce una fecha, su fecha de vencimiento. El anticipo sale de inmediato. Las demás salen en una pasada diaria a medida que llegan las fechas del trabajo.",
      "Este artículo sigue una etapa desde “En espera” hasta la bandeja de entrada del cliente. La configuración del calendario está en [[deposits-and-payment-schedules|Anticipos y calendarios de pago]].",
    ],
    sections: [
      {
        id: "overview",
        heading: "Resumen",
        blocks: [
          { p: "Una etapa se solicita exactamente una vez. Solicitarla le envía al cliente un correo de factura que encabeza con el importe propio de la etapa — “Factura INV-1042 — $1,200.00” — con el nombre de la etapa como nota y un botón **Pagar** que cobra ese importe, no el saldo completo. La primera etapa solicitada es lo que envía la factura: la marca como enviada, a esa dirección, y la pasa de borrador a **Enviada**." },
          { p: "Si una etapa se ha pagado no se registra en la etapa. El saldo de la factura ya lo responde, sin importar cuántos pagos de etapa hayan llegado, y una segunda marca de “pagada” serían dos lugares que pueden contradecirse." },
        ],
      },
      {
        id: "when-each-stage-fires",
        heading: "Cuándo sale cada etapa",
        blocks: [
          { table: {
            head: ["Desencadenante", "Sale cuando", "Necesita"],
            rows: [
              ["Anticipo — al crear y enviar la factura", "En el momento en que se acepta el presupuesto, antes de que exista ninguna fecha", "Un correo electrónico del cliente"],
              ["Inicio del trabajo", "El día de la fecha de inicio del trabajo, en la pasada diaria", "Una fecha de inicio en el trabajo"],
              ["A la mitad del trabajo", "El día central entre el inicio y el fin, contado de forma inclusiva y redondeado hacia arriba", "Ambas fechas, y el fin no antes del inicio"],
              ["Fin del trabajo (terminado)", "El día de la fecha de fin programada del trabajo", "Una fecha de fin en el trabajo"],
            ],
          } },
          { p: "La pasada diaria se ejecuta una vez al día, temprano por la mañana, sobre cada trabajo que todavía tiene una etapa en espera. Una etapa cuya fecha ha llegado se solicita; una etapa cuyo cliente no puede recibir correo (sin dirección en su ficha) sigue en espera y se vuelve a intentar al día siguiente." },
        ],
      },
      {
        id: "what-the-client-receives",
        heading: "Qué recibe el cliente",
        blocks: [
          { p: "Cada solicitud es el mismo correo de factura que usa el botón Enviar, en el idioma del cliente, desde el remitente de su empresa, con tres diferencias:" },
          { bullets: [
            "El asunto y el encabezado llevan el importe de la etapa — su parte — en lugar del saldo completo de la factura.",
            "El nombre de la etapa (“Anticipo”, “Inicio del trabajo”) aparece como una línea en el correo.",
            "El enlace **Pagar** abre la factura en el portal de cliente apuntando a esta etapa, para que el botón de pago pida exactamente esta parte. El importe se vuelve a derivar de la etapa en el servidor; nada en el enlace puede cambiarlo.",
          ] },
          { note: "Si Stripe no está conectado, el correo sale igual, con **Ver factura** en lugar de **Pagar**, y el cliente paga por los métodos que indique su factura. Una solicitud de etapa nunca pide más que el saldo real pendiente de la factura, aunque las etapas se hayan calculado antes de un cambio." },
        ],
      },
      {
        id: "on-the-job-page",
        heading: "En la página del trabajo",
        blocks: [
          { p: "La tarjeta **Calendario de pagos** del propio trabajo lista cada etapa con su parte y uno de tres estados:" },
          { bullets: [
            "**En espera** — todavía no solicitada. Muestra **Vence el {date}** en cuanto se conoce la fecha, o por qué no se puede programar todavía.",
            "**Solicitado** — al cliente ya se le envió el correo por esta etapa. Su fecha queda congelada.",
            "**Sin cobrar (0%)** — una etapa al 0%, registrada como disparada sin correo.",
          ] },
          { p: "Los tres mensajes de bloqueo son: “Todavía no se puede programar — define una fecha de inicio para este trabajo”, “Todavía no se puede programar — define una fecha de fin para este trabajo” y “La fecha de fin es anterior a la de inicio — corrige las fechas del trabajo”. Una etapa bloqueada es un estado visible, nunca una etapa saltada en silencio." },
        ],
      },
      {
        id: "when-dates-move",
        heading: "Cuando las fechas del trabajo se mueven",
        blocks: [
          { p: "La fecha de vencimiento de cada etapa en espera se recalcula a partir de las fechas actuales del trabajo en cada pasada diaria: no se da por buena desde el día en que se creó el calendario. Un trabajo que se retrasa una semana arrastra consigo sus etapas en espera. Una etapa ya solicitada conserva la fecha con la que se solicitó: a un cliente al que se le pidió dinero para una fecha no se le debe mostrar otra porque el trabajo se reprogramó después." },
          { note: "Un trabajo cargado después de hecho como trabajo pasado nunca recibe etapas, y nunca envía una solicitud de anticipo por un trabajo ya pagado." },
        ],
      },
      {
        id: "change-orders",
        heading: "Cambios acordados después de la aceptación",
        blocks: [
          { p: "Los importes de las etapas son porcentajes del presupuesto aceptado y se congelan por tres razones: el cliente aprobó esas cifras, una etapa solicitada ya se pidió, y recalcular movería dinero real. La página del trabajo lo dice cuando aplica: “Estas etapas son porcentajes del presupuesto aceptado y no incluyen $640.00 de cambios aceptados. Eso se cobra en el saldo de la factura, no con una etapa.”" },
        ],
      },
    ],
    faq: [
      { q: "¿Puedo solicitar una etapa antes de tiempo a mano?", a: "No desde el calendario. Puede reclamar la factura en sí en cualquier momento — vea [[invoice-reminders-and-chasing|Recordatorios de factura y reclamos de pago]] — lo que pide el saldo pendiente completo." },
      { q: "El cliente pagó el anticipo por transferencia. ¿La etapa lo sabe?", a: "Regístrelo en la factura como pago manual. El saldo de la factura baja, y el enlace de pago de la siguiente etapa queda con tope en lo que todavía se debe." },
      { q: "¿Por qué la solicitud de la mitad salió el día 3 de un trabajo de 5 días?", a: "Las duraciones impares redondean hacia arriba para que la solicitud llegue una vez que más de la mitad del trabajo está hecha, nunca antes del punto medio." },
    ],
  },

  "invoice-reminders-and-chasing": {
    title: "Recordatorios de factura y reclamos de pago",
    summary:
      "El recordatorio automático de vencimiento en Configuración → Seguimientos, el botón Reclamar el pago en el panel y en la factura, y el rastro que deja cada uno.",
    updated: "2026-09-12",
    intro: [
      "Dos cosas reclaman una factura sin pagar. Un **recordatorio automático**, configurado una vez en **Configuración → Seguimientos**, envía por correo una plantilla un tiempo determinado después de la fecha de vencimiento, una vez por factura, y se detiene en cuanto la factura se paga. Y **Reclamar el pago**, en “Pendientes de ti” del panel y en la propia factura, envía una solicitud de pago a mano, con una nota con sus palabras, tantas veces como quiera.",
      "Ambos son correos desde el remitente de su empresa, en el idioma del cliente, con enlace al portal de cliente. Ambos dejan un rastro en la factura.",
    ],
    sections: [
      {
        id: "overview",
        heading: "Resumen",
        blocks: [
          { p: "Una factura está vencida cuando su fecha de vencimiento ha pasado y sigue **Enviada** o **Atrasada**. El panel **Dinero que te deben** y la escalera de antigüedad de cobros muestran qué está vencido y por cuántos días, y dicen en una línea si existe un recordatorio automático: “Un recordatorio automático se envía 5 días después de la fecha de vencimiento de una factura.” o “No hay ningún recordatorio automático de vencimiento configurado, así que nada persigue estas facturas por su cuenta.”, con **Configurar uno** o **Cambiarlo** al lado." },
          { p: "Los recordatorios por mensaje de texto no existen. Cada regla de seguimiento envía exactamente un correo; un esquema que dibujara una rama de SMS estaría describiendo una función que no está." },
        ],
      },
      {
        id: "the-automatic-reminder",
        heading: "El recordatorio automático de vencimiento",
        blocks: [
          { p: "Una regla de seguimiento es un desencadenante, un retraso y una plantilla de correo. Para las facturas el desencadenante es **Invoice overdue** (los nombres de los desencadenantes en ese formulario están en inglés): se dispara una vez que una factura sin pagar ha superado su fecha de vencimiento por el retraso fijado, y el retraso por defecto es de 5 días." },
          { steps: [
            "Abra **Configuración → Plantillas de correo** y asegúrese de tener una plantilla de seguimiento, marketing o personalizada para enviar. Sin una, la página lo dice y el botón **Nueva regla** está desactivado.",
            "Abra **Configuración → Seguimientos** y pulse **Nueva regla**.",
            "Fije **Desencadenante** en **Invoice overdue**, el **Retraso** y la **Unidad** (horas o días), y elija la **Plantilla a enviar**. Póngale un nombre a la regla si quiere.",
            "Pulse **Crear regla**. El esquema **Cómo se ejecutan** se redibuja: desencadenante → espera → envío del correo → “Se detiene en cuanto se paga la factura.” y “Cada factura recibe este correo una sola vez.”",
          ] },
          { figure: "live:app-settings-follow-ups", caption: "Configuración → Seguimientos — el esquema Cómo se ejecutan, tomado de las reglas de abajo." },
          { note: "Las reglas se revisan una vez al día. Una regla puede pausarse con **Pausar** y reanudarse con **Activar**; una regla en pausa no envía nada. Dos reglas sobre el mismo desencadenante con retrasos distintos se disparan ambas, en orden de retraso: un empujón a los 3 días y uno más firme a los 14 es una configuración normal. La plantilla puede usar el número de factura, el total, el importe pagado, el saldo pendiente, la fecha de vencimiento y un enlace directo a la factura en el portal." },
        ],
      },
      {
        id: "chase-by-hand",
        heading: "Reclamar a mano",
        blocks: [
          { steps: [
            "En el panel, bajo **Pendientes de ti** o **Dinero que te deben**, pulse **Reclamar el pago** en la factura; o abra la factura y pulse **Reclamar el pago** en su aviso.",
            "En **Reclamar este pago** — “Le envía a Jane por correo un enlace para pagar los $1,240.00 que sigue debiendo, en su idioma y desde tu dirección.” — añada una nota si quiere: “quedamos en que pagarías después de la última visita”.",
            "Pulse **Enviar el recordatorio**. La fila confirma: “Solicitud de pago enviada a jane@… a las 2:41 PM”.",
          ] },
          { p: "El correo pide el saldo pendiente completo de la factura, con un botón **Pagar** cuando Stripe está conectado. El botón falta cuando el cliente no tiene correo electrónico: la factura dice “Jane no tiene correo electrónico registrado, así que esta factura no se puede enviar ni reclamar.”" },
        ],
      },
      {
        id: "what-the-invoice-records",
        heading: "El rastro en la factura",
        blocks: [
          { bullets: [
            "**Enviada por correo → jane@…** con la fecha del primer envío.",
            "**Último recordatorio · 3×** con la fecha del último reclamo manual: cada envío aceptado cuenta.",
            "**Recordatorio automático enviado** con una fecha por cada recordatorio que la regla entregó.",
          ] },
          { p: "Las filas del panel llevan los mismos datos — “Último recordatorio el 4 sep · 2×”, “Recordatorio automático enviado el 9 sep” — para que vea de un vistazo qué facturas vencidas ya recibieron un empujón. El registro de actividad también anota cada envío." },
        ],
      },
      {
        id: "the-chase-task",
        heading: "La tarea de seguimiento",
        blocks: [
          { p: "Enviar una factura también crea una tarea, con vencimiento en una semana: “Follow up payment for INV-1042 — Sent to Jane Tremblay. Check it's been paid before chasing — the client portal shows the current balance.” Una tarea por factura, sin importar cuántas copias envíe; se cierra cuando se salda el saldo. Siete días es un recordatorio para mirar, no su condición de pago: esa está en la factura." },
        ],
      },
      {
        id: "who-can",
        heading: "Quién puede hacer qué",
        blocks: [
          { p: "Crear, pausar o borrar una regla de seguimiento requiere **user:manage**: propietarios, administradores, Despachador y Gerente; la fila **Configuración → Seguimientos** está oculta para todos los demás. Pulsar **Reclamar el pago** requiere acceso de edición a facturas (Gerente y superiores por defecto). El recordatorio automático no necesita a nadie: se ejecuta solo." },
        ],
      },
    ],
    faq: [
      { q: "¿El recordatorio seguirá enviando correos todos los días?", a: "No. Cada regla le envía a cada factura un correo una sola vez. Para un segundo empujón, añada una segunda regla con un retraso más largo." },
      { q: "¿Puede el cliente darse de baja de los recordatorios de vencimiento?", a: "No. Un recordatorio sobre una cuenta que debe es transaccional, así que no lleva enlace de baja. Solo el seguimiento de trabajo terminado, que es marketing, lo lleva." },
      { q: "La factura no tiene fecha de vencimiento. ¿Se reclamará?", a: "No automáticamente: la regla se basa en la fecha de vencimiento, y el panel dice “Esta factura no tiene fecha de vencimiento — no está vencida”. Aun así puede reclamarla a mano." },
    ],
  },
};
