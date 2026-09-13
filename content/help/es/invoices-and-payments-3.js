// content/help/es/invoices-and-payments-3.js
//
// Parte 3 de la categoría «invoices-and-payments» en español (ver el
// compositor, invoices-and-payments.js): condiciones de pago, impuestos en
// las facturas, pago a plazos, planes de servicio y su mandato de débito
// bancario, el portal del cliente, la exportación contable, las tarifas de
// visita y el panel «Dinero que te deben».
//
// Misma estructura que la versión en inglés, sección por sección; las
// palabras en pantalla vienen del bloque `es` de app/i18n/appMessages.js.
export const ARTICLES = {
  "payment-terms": {
    title: "Condiciones de pago",
    summary:
      "La línea que dice cuándo paga el cliente: dónde la define, dónde se imprime y cómo el calendario de pagos toma el control.",
    updated: "2026-09-12",
    intro: [
      "Las condiciones de pago son una línea de texto en la Configuración de la empresa: «50 % de anticipo, el resto al terminar», «Neto 30», «Pago contra entrega». FieldQuo imprime esa línea en cada presupuesto que usted envía y la muestra en las páginas de presupuesto y de factura que lee su equipo. Nada la inventa por usted: deje el campo en blanco y la sección simplemente no aparece.",
    ],
    sections: [
      {
        id: "overview",
        heading: "Resumen",
        blocks: [
          { p: "Las condiciones se imprimen en el PDF del presupuesto, en el correo del presupuesto y en la página de aprobación que abre el cliente, después del total y de los pasos del proceso, de modo que se leen justo cuando el cliente está decidiendo. Por defecto no se imprimen en el PDF ni en el correo de la factura: una factura es un cobro del importe adeudado en la fecha de vencimiento, y el calendario ya quedó atrás. Si también las quiere en las facturas, agregue la sección **Payment terms** a su diseño de factura en **Configuración → Plantillas PDF**; vea [[settings-pdf-templates|Plantillas PDF]]. Su equipo siempre las ve en la página de la factura, bajo **Condiciones de pago**, para que quien reciba la pregunta en la puerta de una casa pueda responder." },
          { p: "Debajo de las condiciones, el documento enumera las formas de pago que acepta su empresa (efectivo, transferencia electrónica y cheque por defecto). Hoy no hay ninguna pantalla para cambiar esa lista." },
        ],
      },
      {
        id: "on-the-screen",
        heading: "Qué hay en la pantalla",
        blocks: [
          { p: "Abra **Configuración → Configuración de la empresa**. La primera tarjeta es **Alcance del trabajo y condiciones**: un cuadro **Alcance del trabajo por defecto** con plantillas de oficio para empezar, y debajo el campo **Condiciones de pago** con el ejemplo «p. ej. 50 % de anticipo, el resto al terminar — o Neto 30». La línea de ayuda bajo el campo dice qué pasa con lo que escribe: un calendario legible se imprime como tarjetas, cualquier otra cosa se imprime tal como la escribió, y en blanco significa que no hay sección." },
          { figure: "live:app-settings-company", caption: "Configuración de la empresa: la tarjeta Alcance del trabajo y condiciones, con el campo Condiciones de pago, y debajo la tarjeta Calendario de pagos." },
        ],
      },
      {
        id: "set-them",
        heading: "Cómo definir sus condiciones de pago",
        blocks: [
          { steps: [
            "Abra **Configuración → Configuración de la empresa**.",
            "En **Alcance del trabajo y condiciones**, escriba sus condiciones en **Condiciones de pago**: una frase, o una serie de porcentajes.",
            "Pulse **Actualizar ajustes**. El próximo presupuesto que cree lleva las condiciones nuevas; los presupuestos ya enviados conservan las que llevaban al salir.",
          ] },
          { tip: "Escriba porcentajes si quiere tarjetas. «50 % anticipo, 50 % al terminar» se imprime como dos bloques grandes que el cliente lee en un segundo; «Pago por transferencia dentro de los 14 días de la factura» se imprime como esa frase, palabra por palabra." },
        ],
      },
      {
        id: "cards-or-sentence",
        heading: "Tarjetas o una frase: cómo se lee el texto",
        blocks: [
          { p: "FieldQuo intenta leer un calendario por hitos en sus condiciones y muestra tarjetas solo cuando está seguro. La regla es deliberadamente prudente: unas tarjetas mal cortadas serían peores que la frase clara a la que reemplazan." },
          { table: {
            head: ["Lo que escribió", "Lo que ve el cliente"],
            rows: [
              ["50 % anticipo, 50 % al terminar", "Dos tarjetas: 50 % Anticipo · 50 % Al terminar — la palabra que sigue al porcentaje se vuelve la etiqueta, así que no escriba «de anticipo»"],
              ["30 % anticipo, 40 % inicio del trabajo, 30 % al terminar", "Tres tarjetas: Anticipo · Inicio del trabajo · Al terminar"],
              ["50 %, 40 %, 10 %", "Tarjetas con etiquetas sustitutas — Deposit · Progress payment · On completion — siempre en inglés, sea cual sea el idioma del documento"],
              ["Neto 30", "La frase, impresa tal cual"],
              ["10 % de descuento por pago en efectivo", "La frase: un solo porcentaje no es un calendario, y las partes deben sumar cerca del 100 %"],
            ],
          } },
        ],
      },
      {
        id: "payment-schedule",
        heading: "Cuando hay un calendario de pagos activado",
        blocks: [
          { p: "La tarjeta **Calendario de pagos** bajo las condiciones es la versión con reglas: facturas reales generadas a partir de las fechas del propio trabajo, un anticipo al crear la factura y el resto al inicio del trabajo, a la mitad o al terminar. En cuanto tiene etapas, el campo **Condiciones de pago** se bloquea y se reescribe desde el calendario («30% Deposit, 40% Job start, 30% On completion»: los nombres de etapa por defecto están en inglés, salvo que usted nombre los suyos), para que el documento que lee el cliente diga siempre lo que de verdad se facturará. Pulse **Desactivar — volver al texto libre** para volver a escribir la frase a mano. Vea [[deposits-and-payment-schedules|Anticipos y calendarios de pago]]." },
        ],
      },
      {
        id: "who-can-change",
        heading: "Quién puede cambiarlo",
        blocks: [
          { p: "La Configuración de la empresa es para quienes pueden dirigir la empresa: el propietario, los administradores y cualquier persona con nivel Gerente o Despachador. Los estimadores y la cuadrilla no ven la fila Configuración de la empresa en el menú; las condiciones se imprimen igualmente en los presupuestos que redactan. Una sesión de soporte de solo lectura ve la tarjeta pero no puede guardarla." },
        ],
      },
    ],
    faq: [
      { q: "¿Cambian las condiciones en los presupuestos que ya envié?", a: "No. Un presupuesto se lee con las condiciones vigentes cuando se creó, y un PDF firmado sigue diciendo lo que decía. Cambie las condiciones y el próximo presupuesto nuevo las toma." },
      { q: "¿Puedo definir condiciones distintas por presupuesto?", a: "Hoy no: las condiciones son una sola línea para toda la empresa. Lo que sí puede variar por presupuesto es el alcance del trabajo, que se copia en cada presupuesto y se edita ahí." },
      { q: "¿Por qué el campo Condiciones de pago está en gris?", a: "Hay un calendario de pagos activo. El texto se genera a partir de las etapas del calendario para que los dos no puedan contradecirse. Desactive el calendario para volver a escribir libremente." },
    ],
  },

  "sales-tax-on-invoices": {
    title: "Impuestos en las facturas",
    summary:
      "Cómo se decide la línea de impuesto de una factura, qué hace Aplicar impuesto, por qué un envío puede rechazarse y dónde se imprime su número de registro.",
    updated: "2026-09-12",
    intro: [
      "Una factura lleva un solo importe de impuesto, calculado a partir de las tasas que usted configuró una vez en la Configuración de la empresa. Una factura generada desde un presupuesto copia exactamente el impuesto del presupuesto; una factura nueva resuelve una tasa para el cliente en cuanto usted lo elige, y le dice de dónde salió esa tasa. FieldQuo nunca inventa una tasa, y se niega a enviar una factura que dice que aplica impuesto pero no cobra ninguno sin nada que lo explique.",
    ],
    sections: [
      {
        id: "overview",
        heading: "Resumen",
        blocks: [
          { p: "Tres cosas deciden la línea de impuesto: las tasas de la tarjeta **Configuración de impuestos**, el ajuste **Aplicar automáticamente la tasa de impuesto local del cliente**, y la casilla **Aplicar impuesto** en el propio documento. Su número de registro, si lo introduce, se imprime al pie de cada presupuesto y factura para que un cliente empresarial pueda deducir el impuesto." },
          { note: "El impuesto es un solo importe por factura. Una empresa de Quebec que cobra GST y QST introduce una tasa combinada (14,975 %) y la factura muestra una sola línea de impuesto. No hay códigos de impuesto ni impuesto por línea, así que la exportación contable no puede producir una declaración de impuestos sobre las ventas; vea [[the-accounting-export|La exportación contable]]." },
        ],
      },
      {
        id: "tax-settings-card",
        heading: "La tarjeta Configuración de impuestos",
        blocks: [
          { p: "En **Configuración → Configuración de la empresa**, la tarjeta **Configuración de impuestos** contiene: **Nombre del ID fiscal** (p. ej. IVA) y el campo del número, etiquetado como lo llama su país; una casilla **No tengo uno — mi empresa no está registrada.**; la lista **Tasas de impuestos**, cada tasa con su porcentaje y una etiqueta **Predeterminado** en una de ellas; **Crear tasa de impuesto** (un nombre, una **Tasa %** y una marca **Predeterminado**); y la casilla **Aplicar automáticamente la tasa de impuesto local del cliente**. Una empresa en un país con IVA responde además a **¿Estás registrado a efectos de IVA?**." },
          { figure: "live:app-settings-company", caption: "Configuración de la empresa: la tarjeta Configuración de impuestos, con el número de registro, las tasas con su etiqueta Predeterminado y la casilla de la tasa automática." },
          { p: "La tarjeta completa se describe en [[tax-settings|Configuración de impuestos]]. Este artículo trata de lo que esos ajustes le hacen a una factura." },
        ],
      },
      {
        id: "on-a-new-invoice",
        heading: "En una factura nueva",
        blocks: [
          { p: "En **Facturas → Nueva factura**, la casilla **Aplicar impuesto** muestra la tasa en su etiqueta — **Aplicar impuesto (13%)** — y, cuando está marcada, un campo **Tasa de impuesto** que usted puede sobrescribir. La tasa se resuelve para el cliente elegido, en este orden: si el ajuste automático está apagado, su tasa predeterminada; si no, una tasa suya cuyo nombre coincida con la provincia del cliente («HST Ontario», «GST + QST (QC)»); si no, la tasa publicada para esa provincia canadiense; si no, su tasa predeterminada. Fuera de Canadá nunca se adivina nada: una cifra estatal de EE. UU. es un piso, no una tasa, y el IVA europeo solo aplica cuando usted ha declarado estar registrado." },
          { figure: "live:app-invoices-new", caption: "Nueva factura: las líneas, luego Aplicar impuesto con la tasa resuelta y la nota que dice de dónde salió." },
          { warning: "Si el cliente no tiene dirección registrada, la tasa se marca como **Supuesto** a partir de su propia provincia y la pantalla lo dice. Un cliente al otro lado de una frontera provincial debe una tasa distinta — Ottawa y Gatineau son 13 % y 14,975 % —, así que revísela antes de enviar, o agregue la dirección del cliente y se aplica la tasa real." },
        ],
      },
      {
        id: "what-each-control-changes",
        heading: "Qué cambia cada control",
        blocks: [
          { table: {
            head: ["Control", "Qué hace"],
            rows: [
              ["Aplicar impuesto, marcada", "El impuesto se calcula a la tasa mostrada y se suma al total. El documento indica la tasa."],
              ["Aplicar impuesto, sin marcar", "El documento dice que no aplica impuesto: una posición declarada, no un vacío."],
              ["Tasa de impuesto, escrita a mano", "Su cifra manda en este documento y no se vuelve a resolver si cambia de cliente."],
              ["Etiqueta Predeterminado", "La tasa que se usa siempre que nada más específico coincide."],
              ["Aplicar automáticamente la tasa de impuesto local", "Compara la provincia del cliente con los nombres de sus tasas, y luego con la tabla canadiense publicada; apagado, cada documento parte de su tasa predeterminada."],
              ["Nombre y número de ID fiscal", "Se imprimen al pie de cada presupuesto y factura. En blanco significa ninguna línea, nunca una etiqueta vacía."],
            ],
          } },
        ],
      },
      {
        id: "a-refused-send",
        heading: "Cuando un envío se rechaza",
        blocks: [
          { p: "El envío se detiene cuando una factura dice que aplica impuesto, cobra $0.00, y nada puede explicarlo: ni país ni provincia del cliente, y ninguna tasa de respaldo. El mensaje dice: «Este documento dice que aplica impuesto pero no cobra ninguno, y no hay con qué calcular la tasa.» Agregue el país y la provincia del cliente, o desmarque Aplicar impuesto si no se debe ninguno, y vuelva a enviar. Los presupuestos tienen la misma parada." },
        ],
      },
      {
        id: "invoices-from-quotes-and-plans",
        heading: "Facturas desde presupuestos, y desde planes de servicio",
        blocks: [
          { bullets: [
            "Una factura generada desde un presupuesto aceptado copia el importe de impuesto del presupuesto y su estado activado/desactivado. No se recalcula: el cliente ya leyó esa cifra.",
            "Eliminar o cambiar una tasa nunca toca un documento ya enviado; el impuesto se guarda como importe, no como tasa.",
            "Un plan de servicio declara su propio **% de impuesto** al venderse. En blanco significa sin impuesto en ese plan, no «ya lo veremos después».",
          ] },
        ],
      },
      {
        id: "who-can-change",
        heading: "Quién puede cambiarlo",
        blocks: [
          { p: "La Configuración de impuestos pertenece al propietario, los administradores, los gerentes y los despachadores. Generar una factura y elegir su impuesto requiere el nivel de Facturas **View, create, and edit** y el interruptor **Show Pricing** (la cuadrícula de acceso está en inglés en todas las pantallas): un despachador o un gerente por defecto; un estimador puede leer facturas pero no generarlas." },
        ],
      },
    ],
    faq: [
      { q: "¿Puedo cobrar dos impuestos en dos líneas?", a: "No. Introduzca la tasa combinada (Quebec: 14,975 %) como una sola tasa; la factura muestra una sola línea de impuesto." },
      { q: "¿Por qué la factura dice «Supuesto Ontario»?", a: "El cliente no tiene dirección registrada, así que FieldQuo recurrió a su propia provincia y lo marcó como suposición. Agregue la dirección del cliente, o sobrescriba la tasa." },
      { q: "¿FieldQuo remite o declara algo?", a: "No. Imprime lo que usted introduce y suma el impuesto que eligió. Las declaraciones y las remesas son suyas." },
    ],
  },

  "pay-over-time-financing": {
    title: "Pago a plazos",
    summary:
      "Dos cosas separadas: Affirm al momento de pagar, donde el prestamista decide y usted cobra el total, y una cuota mensual opcional en los presupuestos, según condiciones que usted mismo indica.",
    updated: "2026-09-12",
    intro: [
      "FieldQuo no presta dinero ni aprueba a nadie. Lo que ofrece son dos cosas que usted activa por separado: **Affirm** como segunda opción junto a la tarjeta al momento de pagar, para que un cliente pueda dividir una factura en pagos mientras usted cobra el total por adelantado; y una cuota mensual en la página de aprobación del presupuesto, mostrada solo cuando usted ha introducido su propio tipo y plazo. Ninguna de las dos viene activada por defecto.",
    ],
    sections: [
      {
        id: "overview",
        heading: "Resumen",
        blocks: [
          { p: "El pago a plazos se ofrece al momento de pagar a través de Stripe, donde decide el prestamista. FieldQuo no presta ni aprueba a nadie. La cuota mensual mostrada en un presupuesto aparece solo si usted introduce su propio tipo y plazo: FieldQuo nunca inventa uno." },
          { p: "Los dos controles viven en dos pantallas: el interruptor **Ofrecer pago a plazos (Affirm)** en **Configuración → Pagos**, y la tarjeta **Financiamiento** en **Configuración → Cotizaciones instantáneas**." },
        ],
      },
      {
        id: "affirm-at-checkout",
        heading: "Affirm al momento de pagar",
        blocks: [
          { steps: [
            "Active primero Affirm en su propio panel de Stripe: FieldQuo no puede hacerlo por usted ni comprobarlo.",
            "Abra **Configuración → Pagos**. Cuando Stripe está activo, aparece la tarjeta **Ofrecer pago a plazos (Affirm)** con un interruptor.",
            "Enciéndalo. Las facturas de entre **$50 y $30,000** en USD o CAD muestran entonces Affirm junto a la tarjeta en la página de pago; lo que quede fuera de ese rango, o una empresa sin Affirm activado, recibe una página solo con tarjeta en lugar de una página rota.",
          ] },
          { figure: "live:app-settings-payments", caption: "Configuración → Pagos: la tarjeta de comisiones de procesamiento, la cuenta de Stripe conectada y, debajo, el interruptor del pago a plazos." },
          { p: "Usted sigue cobrando el total, por adelantado; Affirm cobra las cuotas al cliente. La comisión de un pago con Affirm es la tarifa de Affirm, más alta que la de tarjeta, y se traslada a ese pago del mismo modo que una comisión de tarjeta; vea [[payment-processing-fees-and-payouts|Comisiones de procesamiento de pagos y transferencias]]. Un cliente que paga con tarjeta en la misma página paga la comisión de tarjeta, nada más." },
        ],
      },
      {
        id: "a-monthly-figure-on-quotes",
        heading: "Una cuota mensual en los presupuestos",
        blocks: [
          { steps: [
            "Abra **Configuración → Cotizaciones instantáneas** y busque la tarjeta **Financiamiento**.",
            "Enciéndala y escriba **Qué decir al propietario** con sus propias palabras: «Ofrecemos financiamiento con crédito aprobado: pídanos los detalles.» Agregue un **Enlace del proveedor (opcional)** si trabaja con un prestamista; el cliente recibe un botón hacia él.",
            "Bajo **Sus condiciones indicadas (opcional)**, rellene tanto **Tipo anual (TAE %)** como **Plazo (meses)**, o ninguno de los dos. Pulse **Guardar**.",
          ] },
          { figure: "live:app-settings-instant-quotes", caption: "Configuración → Cotizaciones instantáneas: la tarjeta Financiamiento al final, con la nota, el enlace del proveedor y el tipo y plazo indicados." },
          { p: "Con las dos condiciones indicadas, la página de aprobación del presupuesto muestra una cuota mensual estimada bajo el total, señalada como estimación según sus condiciones. La página de la cotización instantánea muestra su nota y el botón del proveedor, nunca una cuota. Deje cualquiera de los dos campos en blanco y no se muestra ninguna cuota en ningún sitio: no hay tipo ni plazo por defecto." },
        ],
      },
      {
        id: "what-each-control-changes",
        heading: "Qué cambia cada control",
        blocks: [
          { table: {
            head: ["Control", "Qué hace"],
            rows: [
              ["Ofrecer pago a plazos (Affirm) — encendido", "Las facturas elegibles ofrecen Affirm junto a la tarjeta al pagar. La comisión de Affirm se traslada solo a esos pagos."],
              ["Ofrecer pago a plazos (Affirm) — apagado", "Toda página de pago es solo con tarjeta, aunque Affirm esté activo en su panel de Stripe."],
              ["Tarjeta Financiamiento — encendida, sin condiciones", "El presupuesto dice que hay financiamiento disponible, con sus palabras, y un botón hacia su proveedor si lo indicó. Ninguna cifra."],
              ["Tarjeta Financiamiento — tipo y plazo indicados", "El presupuesto añade una cuota mensual estimada, calculada con su TAE y su plazo y señalada como estimación suya."],
              ["Tarjeta Financiamiento — apagada", "Nada sobre financiamiento aparece en presupuestos ni cotizaciones."],
            ],
          } },
        ],
      },
      {
        id: "the-limits",
        heading: "Los límites",
        blocks: [
          { warning: "No prometa un tipo ni una cuota mensual que no pueda cumplir. La cifra del presupuesto se calcula con las condiciones que usted escribió y se muestra al propietario como suya. Al pagar, Affirm indica sus propias condiciones y la decisión es del prestamista, no de FieldQuo ni suya." },
          { bullets: [
            "Affirm: facturas de $50 a $30,000, solo en USD o CAD, y solo una vez que Affirm esté activado en su cuenta de Stripe.",
            "La cuota mensual: meses enteros, una TAE entre 0 % y 100 %, los dos campos o ninguno.",
            "El débito bancario y los planes de servicio no son financiamiento: un plan son sus propias cuotas, en sus propias facturas. Vea [[service-plans|Planes de servicio]].",
          ] },
        ],
      },
      {
        id: "who-can-change",
        heading: "Quién puede cambiarlo",
        blocks: [
          { p: "Los dos interruptores son para el propietario y los administradores: Configuración → Pagos es una pantalla de administración de facturación, y la tabla de tarifas de Cotizaciones instantáneas, financiamiento incluido, rechaza a cualquier otro al guardar." },
        ],
      },
    ],
    faq: [
      { q: "¿FieldQuo revisa el crédito del cliente?", a: "No. Lo hace Affirm, al momento de pagar, y decide solo. FieldQuo nunca ve la solicitud." },
      { q: "¿Puedo mostrar una cuota mensual sin indicar un tipo?", a: "No. Sin condiciones no hay cifra: un número inventado por FieldQuo sería una condición que podrían exigirle." },
      { q: "¿Affirm está disponible en Canadá?", a: "Sí, para facturas en CAD igual que en USD, dentro del rango de $50 a $30,000, una vez activado en su panel de Stripe." },
    ],
  },

  "service-plans": {
    title: "Planes de servicio (facturación recurrente)",
    summary:
      "Venda un trabajo repetido — primavera y otoño, mensual, trimestral — y deje que cada visita genere su propia factura, o cobre automáticamente la tarjeta o la cuenta bancaria guardada del cliente.",
    updated: "2026-09-12",
    intro: [
      "Un plan de servicio es una instrucción permanente para facturarle a un cliente el mismo importe con la periodicidad que usted elija: limpieza de canaletas dos veces al año, una visita mensual al césped, un mantenimiento trimestral. Cada ocurrencia genera una factura real a su nombre. El cobro es o bien una factura con enlace de pago, que funciona con cualquier cliente, o bien un cargo automático a una tarjeta o cuenta bancaria canadiense que el cliente autorizó por escrito.",
      "Las condiciones económicas — importe, descuento, periodicidad, duración — quedan congeladas al guardar el plan, porque el cliente autoriza esas cifras exactas. Para cambiar el trato, cancele el plan y venda uno nuevo.",
    ],
    sections: [
      {
        id: "overview",
        heading: "Resumen",
        blocks: [
          { p: "**Planes de servicio** está en el grupo Dinero de la barra lateral, después de Facturas, porque un plan es una regla que genera facturas. La pantalla dice «Trabajo recurrente vendido como paquete, facturado con la periodicidad que elijas.» Cada fila muestra el nombre del plan, **Activo**, el cliente, la periodicidad (**Dos veces al año**, **Trimestral**), el precio por visita, cómo se cobra (**Se envía una factura en cada visita** o **Se cobra automáticamente — Visa ···· 4242**), y o bien el total del plan con su descuento por paquete o bien **Sigue hasta que se cancele**." },
          { figure: "live:app-plans", caption: "Planes de servicio: una fila por plan con su periodicidad, precio por visita, forma de cobro y total." },
        ],
      },
      {
        id: "sell-a-plan",
        heading: "Cómo vender un plan",
        blocks: [
          { steps: [
            "Abra **Planes de servicio** y pulse **Nuevo plan**.",
            "Elija el **Cliente** y el **Servicio**, y dele al plan un **Nombre del plan**: es lo que el cliente ve en cada factura.",
            "Bajo **Calendario**, elija **Cada cuánto** (Semanal, Mensual, Trimestral, Dos veces al año, Una vez al año), la fecha de la **Primera visita** y **Por cuánto tiempo**: **Un número de visitas**, **Hasta una fecha** o **Hasta que se cancele**.",
            "Bajo **Precio**, introduzca el importe **Por visita, antes del descuento**, un **% de descuento por paquete** opcional y el **% de impuesto**: en blanco significa sin impuesto en este plan.",
            "Bajo **Cómo se cobra**, elija **Factura en cada visita** o **Cobrar automáticamente**, y pulse **Crear plan**.",
          ] },
          { figure: "create:app-plans-create", caption: "Nuevo plan de servicio: cliente, servicio, calendario, precio y cómo se cobra." },
          { note: "La vista previa bajo Precio dice lo que de verdad se facturará — para $200 por visita con 10 % de descuento: «Cada visita factura $180.00.» y, para una duración fija, «6 visitas, $1,080.00 en total — $120.00 de ahorro.» El descuento se aplica a cada visita a la misma tasa, así que cada factura cuadra por sí sola y el total del plan es la suma de las facturas." },
        ],
      },
      {
        id: "what-each-field-changes",
        heading: "Qué cambia cada campo",
        blocks: [
          { table: {
            head: ["Campo", "Qué hace"],
            rows: [
              ["Cada cuánto", "Semanal avanza 7 días; los demás avanzan por meses desde la fecha de la primera visita, así que un plan anclado el 31 factura el 31 (o el último día de un mes más corto) y nunca se adelanta."],
              ["Por cuánto tiempo — Un número de visitas", "De 1 a 520 visitas, y luego el plan termina solo."],
              ["Por cuánto tiempo — Hasta una fecha", "Nada se factura después del Último día. Una fecha de fin anterior a la primera visita se rechaza."],
              ["Por cuánto tiempo — Hasta que se cancele", "Sin fecha de fin. Al cliente se le dice exactamente eso antes de que autorice nada."],
              ["% de descuento por paquete", "Se descuenta de cada visita, de 0 a 99 %. Se muestra en la factura."],
              ["% de impuesto", "Se aplica a cada visita. En blanco es una decisión — sin impuesto —, no un olvido."],
              ["Factura en cada visita", "Cada ocurrencia genera una factura y envía el enlace de pago por correo. No se guarda nada ni se cobra nada a menos que el cliente pague."],
              ["Cobrar automáticamente", "La misma factura, más un cargo fuera de sesión a la forma de pago que el cliente autorizó. Hasta que autorice, el plan factura como arriba."],
            ],
          } },
        ],
      },
      {
        id: "what-happens-each-visit",
        heading: "Qué pasa en cada fecha de visita",
        blocks: [
          { p: "Una vez al día, FieldQuo revisa cada plan activo. Una ocurrencia cuya fecha llegó genera una factura — una sola línea, «Nombre del plan — Servicio», con el descuento y el impuesto que el plan declara, con vencimiento en la fecha de la visita, en el idioma en que se vendió el plan — y envía al cliente el enlace de pago por correo. Se genera como máximo **una ocurrencia por plan por día**: una fecha de inicio mal escrita cuesta una factura, no cien, y una semana perdida se recupera en una semana." },
          { p: "En la página del plan, **Facturado hasta ahora** lista cada ocurrencia como **Preparando**, **Facturada**, **Pago en curso**, **Pagada** o **El pago falló**, con **Ver factura**. Un plan vendido por seis visitas pasa a **Terminado** después de la sexta; un plan abierto sigue hasta que usted pulse **Cancelar plan**." },
          { warning: "**Cancelar plan** detiene el dinero. No se factura ninguna visita más, se retira la autorización del cliente y su forma de pago guardada se desvincula en Stripe. Las facturas ya generadas quedan exactamente como están: cancele el plan y luego gestione una factura impagada en su propia página." },
        ],
      },
      {
        id: "automatic-collection",
        heading: "El cobro automático, en pocas palabras",
        blocks: [
          { p: "Elegir **Cobrar automáticamente** todavía no cobra nada. Tras guardar, pulse **Pedirle al cliente que autorice los pagos**: el cliente recibe un enlace, lee el importe exacto, la periodicidad y las condiciones de cancelación, marca una casilla y guarda una tarjeta o cuenta bancaria en una página de Stripe. Desde entonces la página del plan dice **Cobrando Visa ···· 4242 automáticamente. El cliente lo autorizó el 12 sep 2026.** Una tarjeta rechazada o una forma de pago retirada vuelve a la factura con enlace de pago, y la página dice cuál de las dos. El recorrido completo, el texto y el mandato de débito bancario canadiense: [[service-plan-bank-debit-mandates|Planes pagados por débito bancario]]." },
        ],
      },
      {
        id: "who-can-see-it",
        heading: "Quién puede ver y vender planes",
        blocks: [
          { p: "Ver la pantalla Planes de servicio requiere el nivel de Facturas **View only**: del estimador hacia arriba. Crear un plan y pedirle al cliente que autorice los pagos requieren **View, create, and edit** en Facturas más el interruptor **Payments** («Allow payment collection on quotes and invoices»: la cuadrícula de acceso está en inglés en todas las pantallas): un gerente, un administrador o el propietario. Cancelar un plan solo requiere **View, create, and edit**, así que un despachador puede cancelar uno pero no venderlo." },
        ],
      },
      {
        id: "only-in-fieldquo",
        heading: "Por qué figura en Solo en FieldQuo",
        blocks: [
          { p: "Las páginas de comparación de FieldQuo deciden «solo en FieldQuo» de una sola manera: la capacidad no aparece en la página de precios del otro producto en ningún nivel; nunca por simple afirmación. De los cinco productos con los que FieldQuo se compara, los planes de servicio recurrentes los lista uno (Housecall Pro, en su nivel más alto) y faltan en las otras cuatro páginas de precios. El débito bancario preautorizado canadiense al 1 % con tope de $5, como forma de cobro de un plan, no lo lista ninguno." },
        ],
      },
    ],
    faq: [
      { q: "¿Puedo cambiar el precio de un plan en marcha?", a: "No. El importe, el descuento, la periodicidad y la duración quedan congelados al crearlo porque el cliente autorizó esas cifras. Cancélelo y venda un plan nuevo." },
      { q: "¿El plan crea una visita en el calendario?", a: "No. Un plan genera facturas en sus fechas; la programación de la cuadrilla se hace en el trabajo y sus visitas, como siempre." },
      { q: "¿Y si la tarjeta del cliente es rechazada?", a: "La ocurrencia se marca como El pago falló, el cliente recibe la factura con un enlace de pago y la página del plan se lo dice. Nada se cobra en silencio." },
      { q: "¿Un cliente con plan puede pagar por débito bancario?", a: "Sí, si su empresa factura en CAD: el cliente guarda una cuenta bancaria canadiense al autorizar, y cada débito cuesta 1 % + $0.40, con tope de $5." },
    ],
  },

  "service-plan-bank-debit-mandates": {
    title: "Planes pagados por débito bancario: el mandato",
    summary:
      "Qué acepta el cliente antes de que un plan pueda cobrarle, cómo se configura y se liquida un débito preautorizado canadiense, y qué lo detiene.",
    updated: "2026-09-12",
    intro: [
      "Un plan configurado en **Cobrar automáticamente** solo puede tomar dinero contra un mandato: el acuerdo escrito del cliente para una serie de pagos de un importe determinado con una periodicidad determinada, más una tarjeta o cuenta bancaria guardada en Stripe. FieldQuo muestra las condiciones en su propia página, registra el texto exacto que el cliente aceptó, y solo entonces lo envía a Stripe para guardar el instrumento. Para una empresa canadiense que factura en CAD, ese instrumento puede ser una cuenta bancaria — débito preautorizado —, más barato que una tarjeta y sin fecha de caducidad.",
    ],
    sections: [
      {
        id: "overview",
        heading: "Resumen",
        blocks: [
          { p: "Pedir el cobro automático es una solicitud; tener un mandato vigente es una capacidad. La página del plan las distingue: **Se pidió el cobro automático, pero el cliente todavía no lo ha autorizado**, **El cliente aceptó, pero aún no ha guardado una forma de pago**, **Se quitó la forma de pago guardada — en su lugar se están enviando facturas**, o **Cobrando … automáticamente. El cliente lo autorizó el …**. Hasta que la última sea cierta, cada visita se factura con un enlace de pago." },
          { note: "El débito bancario se ofrece solo cuando la moneda de su empresa es CAD, porque Stripe exige que la moneda del débito coincida con la cuenta bancaria canadiense del cliente. En USD el cliente solo puede guardar una tarjeta. Vea [[bank-debit-in-canada|Débito bancario en Canadá]]." },
        ],
      },
      {
        id: "how-the-client-authorises",
        heading: "Cómo autoriza el cliente",
        blocks: [
          { steps: [
            "En la página del plan, pulse **Pedirle al cliente que autorice los pagos**. La pantalla confirma: «Enviado a jane@ejemplo.com. Verá el importe y el calendario antes de autorizar nada.»",
            "El cliente abre el enlace — una página en el idioma del plan, en inglés o en francés, titulada «Autorizar pagos automáticos — …» —, lee las condiciones, marca la casilla de aceptación y pulsa el botón para aceptar y continuar. Ese día no se cobra nada.",
            "La página segura de Stripe recoge la tarjeta o la cuenta bancaria. Para un débito preautorizado, Stripe muestra su propio acuerdo de PAD y envía una copia al cliente por correo.",
            "Una cuenta bancaria puede necesitar verificación: el cliente ve que sus datos bancarios se recibieron pero aún deben verificarse, en uno o dos días. Cuando el banco confirma, la página del plan cambia a **Cobrando … automáticamente**.",
          ] },
          { p: "Si el cliente marcó la casilla y luego abandonó el formulario de tarjeta, el plan dice **El cliente aceptó, pero aún no ha guardado una forma de pago** y sigue facturando. **Enviar el enlace de autorización otra vez** reenvía la misma solicitud." },
        ],
      },
      {
        id: "what-the-terms-say",
        heading: "Qué dicen las condiciones",
        blocks: [
          { p: "Stripe exige que un comerciante que cobra fuera de sesión declare, y conserve, cuatro cosas: que se iniciará una serie de pagos, su momento y frecuencia, cómo se determina el importe y la política de cancelación. La página de FieldQuo las enuncia en frases sencillas, construidas a partir del propio plan, y el texto exacto se congela junto con la aceptación del cliente: mejorar el texto más adelante no puede reescribir lo que un cliente existente aceptó." },
          { bullets: [
            "Usted autoriza a la empresa a tomar una serie de pagos de la forma de pago que guarda en la pantalla siguiente, sin que se le vuelva a pedir cada vez.",
            "El primer pago se toma en la fecha de la primera visita, y después cada tres meses (o con la periodicidad del plan).",
            "Cada pago es por el importe del plan, impuesto incluido cuando hay una tasa declarada. Ese importe queda fijado y no puede cambiarse mientras el acuerdo esté en marcha.",
            "Cómo termina: un número de pagos en total, ningún pago después de una fecha, o sin fecha de fin: los pagos continúan hasta que cualquiera de las partes lo termine.",
            "El cliente puede terminarlo en cualquier momento comunicándose con la empresa, al teléfono y correo registrados. No se toma ningún pago después de la cancelación.",
            "Cada pago genera una factura que el cliente puede ver en su cuenta de cliente.",
          ] },
          { warning: "El cobro automático solo puede venderse en **inglés o francés**, los dos idiomas para los que FieldQuo tiene un texto de autorización revisado. A un cliente con cualquier otro idioma no se le pide autorización en absoluto; su plan factura cada visita, lo que funciona en todos los idiomas." },
        ],
      },
      {
        id: "the-debit-itself",
        heading: "El débito en sí",
        blocks: [
          { p: "En cada fecha de visita el plan genera la factura y cobra a la forma de pago guardada bajo el mandato, sin que el cliente esté presente. Una tarjeta se liquida al instante: la ocurrencia queda como **Pagada** y el cliente recibe la factura presentada como recibo, de su empresa, no un recibo de Stripe de un nombre que no conoce. Un débito bancario tarda unos **cinco días hábiles** en compensarse, así que la ocurrencia queda en **Pago en curso** — la factura no se marca como pagada sobre dinero que no se ha movido — y Stripe envía al cliente el aviso de débito que el mandato exige. Cuando se compensa, Pagada y el recibo; si vuelve rechazado, **El pago falló** y la factura con un enlace de pago." },
          { table: {
            head: ["Forma de pago", "Comisión en cada ocurrencia", "Se compensa"],
            rows: [
              ["Tarjeta", "3 % + $0.30", "De inmediato"],
              ["Débito preautorizado (Canadá, CAD)", "1 % + $0.40, con tope de $5.00", "Unos 5 días hábiles"],
            ],
          } },
          { tip: "En un plan trimestral de $500, la tarjeta cuesta $15.30 por visita y el débito bancario $5.00, el tope. En un año son $41.20 ahorrados con un solo cliente." },
        ],
      },
      {
        id: "what-stops-it",
        heading: "Qué lo detiene",
        blocks: [
          { bullets: [
            "**Quitar la forma de pago guardada** en la página del plan: la autorización se retira primero en FieldQuo y luego la forma de pago se desvincula en Stripe. El plan sigue en marcha y factura cada visita en su lugar.",
            "**Cancelar plan**: no se factura nada más, y la forma de pago se desvincula del mismo modo. Si Stripe no confirma la desvinculación, la pantalla lo dice y le pide revisar la ficha del cliente en Stripe.",
            "El cliente le pide parar: las condiciones le indican que se comunique con usted, y usted cancela. Nada en Stripe puede facturar por su cuenta — allí no se crea ninguna suscripción —, así que un plan cancelado no puede dejar un cobrador activo atrás.",
            "Un cargo rechazado, o un banco que exige una autenticación que el cliente ausente no puede dar: esa ocurrencia se factura con un enlace de pago y el mandato se mantiene para la siguiente.",
          ] },
        ],
      },
      {
        id: "who-can-do-this",
        heading: "Quién puede hacerlo",
        blocks: [
          { p: "Enviar la solicitud de autorización y quitar una forma de pago guardada requieren ambos **View, create, and edit** en Facturas más el interruptor **Payments**: un gerente, un administrador o el propietario. Quien no puede configurar un mandato tampoco puede deshacerlo." },
        ],
      },
      {
        id: "only-in-fieldquo",
        heading: "Por qué figura en Solo en FieldQuo",
        blocks: [
          { p: "En las páginas de comparación de FieldQuo, una capacidad cuenta como «solo en FieldQuo» cuando no aparece en la página de precios del otro producto en ningún nivel. Cobrar un plan recurrente por débito preautorizado canadiense, con el texto del mandato registrado junto a la aceptación del cliente, no lo lista ninguno de los cinco productos con los que FieldQuo se compara; los planes recurrentes en sí aparecen en una sola de esas páginas de precios (el nivel más alto de Housecall Pro)." },
        ],
      },
    ],
    faq: [
      { q: "¿El cliente necesita una cuenta de FieldQuo?", a: "No. La página de autorización se abre desde el enlace del correo, y la página de Stripe guarda el instrumento. Las facturas del cliente están en su portal del cliente, también por enlace." },
      { q: "¿Puedo escribir yo la tarjeta del cliente?", a: "No. El cliente la guarda por sí mismo en la página de Stripe, después de aceptar las condiciones. FieldQuo nunca ve números de tarjeta ni de cuenta." },
      { q: "El débito volvió rechazado: ¿pierdo la visita?", a: "No. La factura es real y está impagada; el cliente la recibe con un enlace de pago, y la ocurrencia muestra El pago falló en la página del plan." },
    ],
  },

  "the-client-portal": {
    title: "El portal del cliente",
    summary:
      "Un enlace, sin inicio de sesión: donde un cliente ve sus facturas, lo que aún debe, sus presupuestos y el botón Pagar, a nombre de usted, no del nuestro.",
    updated: "2026-09-12",
    intro: [
      "Cada cliente tiene un enlace de portal, creado la primera vez que usted le envía una factura por correo. Se abre sin contraseña y muestra su saldo pendiente, cada factura emitida con un botón **Pagar**, y cada presupuesto que usted ha enviado. La página lleva su logotipo y su color de marca y nunca menciona a FieldQuo: el cliente lo contrató a usted, no a nosotros.",
    ],
    sections: [
      {
        id: "overview",
        heading: "Resumen",
        blocks: [
          { p: "El enlace es lo único que separa a un desconocido del historial de facturación de un cliente, así que son 32 bytes aleatorios, no un número que alguien pueda adivinar contando. Se mantiene igual en todos los correos, así que un correo antiguo sigue abriéndose. El botón Pagar del correo de la factura lleva directamente a la página de esa factura dentro del portal, que es donde realmente empieza el pago: la sesión de pago de Stripe se crea solo cuando el cliente pulsa Pagar, así que un enlace en una bandeja de entrada nunca caduca." },
        ],
      },
      {
        id: "what-the-client-sees",
        heading: "Qué ve el cliente",
        blocks: [
          { bullets: [
            "Su logotipo y el nombre de su empresa, y luego **Cuenta de Juana Pérez**.",
            "**Saldo pendiente**, lo primero de la página, con **En 2 facturas.** — o **Nada pendiente. Gracias.**",
            "**Facturas**: número, total, **$1,200 pagado**, **vence 30 sep 2026**, y un botón **Pagar $2,260** junto a lo que se debe — o **Pagado**.",
            "**Presupuestos**: cada uno con una etiqueta en palabras del cliente — **Pendiente de su respuesta**, **Aprobado**, **Rechazado** — y un enlace **Revisar** a la página de aprobación.",
            "**¿Preguntas sobre esto? Comuníquese con Pinturas Acme al 613-555-0100 · hola@acme.ca** al pie.",
          ] },
          { p: "La página de una factura muestra las líneas, **Vence** o **Venció**, los importes de etapa solicitados si los hay, y el mismo botón Pagar; una vez saldada dice **Pagada por completo**. Cuando usted no está conectado a Stripe, el botón Pagar se sustituye por sus instrucciones de pago fuera de línea." },
        ],
      },
      {
        id: "how-the-link-reaches-them",
        heading: "Cómo le llega el enlace al cliente",
        blocks: [
          { steps: [
            "Envíe una factura, o pulse **Reclamar el pago** en una: el botón Pagar del correo abre la factura en el portal. Vea [[send-an-invoice|Enviar una factura]].",
            "Los recordatorios automáticos de vencimiento de sus reglas de seguimiento llevan el mismo enlace.",
            "Las facturas y recibos de un plan de servicio también enlazan al portal, y las condiciones de autorización del plan le dicen al cliente que cada pago genera una factura visible en su cuenta de cliente.",
          ] },
          { note: "Hoy no existe un botón «copiar enlace del portal» en la aplicación. El enlace viaja en los correos que FieldQuo envía; si un cliente lo perdió, reclame o reenvíe una factura." },
        ],
      },
      {
        id: "what-is-not-there",
        heading: "Qué no está, a propósito",
        blocks: [
          { bullets: [
            "Las facturas en borrador. Solo se listan las facturas emitidas — enviadas, o marcadas como pagadas en persona —, para que un cliente nunca vea dinero adeudado en una factura que nadie envió.",
            "Los presupuestos en borrador y las cotizaciones instantáneas sin revisar. Una cifra que nadie de su empresa fijó no aparece como suya.",
            "Trabajos, visitas, técnicos, notas. El portal muestra presupuestos y facturas, nada más: las notas de revisión de la IA de un presupuesto nunca llegan a una superficie que ve el cliente.",
            "Sus datos de Stripe. Si Pagar funciona se decide en el servidor; el cliente ve un botón o sus instrucciones fuera de línea, nunca la cuenta.",
          ] },
        ],
      },
      {
        id: "language-and-branding",
        heading: "Idioma y marca",
        blocks: [
          { p: "El portal está escrito en el idioma del cliente, con el idioma por defecto de su empresa como respaldo: la misma regla que cada correo. Cada documento conserva el idioma en que se creó, así que un presupuesto en francés listado en un portal en inglés sigue abriéndose en francés. Los colores salen de su único color de marca, y el contraste del texto en el botón Pagar se mide en lugar de suponerse." },
        ],
      },
      {
        id: "who-can-see-it",
        heading: "Quién puede verlo",
        blocks: [
          { p: "Cualquiera que tenga el enlace. Nadie de su equipo abre el portal desde la aplicación; el personal lee la misma factura en **Facturas**. Si un enlace llegó a la persona equivocada, comuníquese con soporte: renovar el enlace de un cliente no es un botón de la aplicación hoy." },
        ],
      },
    ],
    faq: [
      { q: "¿El cliente necesita crear una cuenta?", a: "No. El enlace es la cuenta. No hay contraseña, ni registro, ni aplicación que instalar." },
      { q: "¿El cliente puede pagar una parte de una factura?", a: "Solo lo que un calendario de pagos haya solicitado como etapa. Si no, el botón Pagar toma todo el saldo pendiente." },
      { q: "¿El cliente verá a FieldQuo en algún sitio?", a: "No. La página lleva su nombre, su logotipo y su color; el estado de cuenta de la tarjeta muestra el nombre de su empresa." },
    ],
  },

  "the-accounting-export": {
    title: "La exportación contable (CSV para QuickBooks, Xero o su contador)",
    summary:
      "Un ZIP, cuatro archivos CSV, un periodo: qué contiene cada archivo, las reglas detrás de las cifras y lo que la exportación se niega a contener.",
    updated: "2026-09-12",
    intro: [
      "FieldQuo no se sincroniza con QuickBooks ni con Xero. Lo que hace en su lugar es dejar que los números salgan limpiamente: elija un periodo en **Gastos**, pulse **Descargar el periodo**, y recibe un ZIP con una hoja resumen y tres archivos de datos — facturas, pagos, gastos — que cualquier contador puede abrir y cualquier programa contable puede importar.",
    ],
    sections: [
      {
        id: "overview",
        heading: "Resumen",
        blocks: [
          { p: "La tarjeta **Exportación contable** está al final de **Gastos** (la misma pantalla que Configuración → Control de gastos). Tiene fechas **Desde** y **Hasta** y un solo botón. Los importes están en la moneda de facturación de su empresa, definida en la Configuración de la empresa; sin ella, la exportación se niega en lugar de adivinar." },
          { figure: "live:app-settings-expense-tracking", caption: "Control de gastos: la tarjeta Exportación contable al final, con un periodo, Descargar el periodo y la lista de lo que el archivo no contiene." },
        ],
      },
      {
        id: "download-a-range",
        heading: "Cómo descargar un periodo",
        blocks: [
          { steps: [
            "Abra **Gastos** y baje hasta **Exportación contable**.",
            "Ajuste **Desde** y **Hasta**: un mes, un trimestre, el año.",
            "Pulse **Descargar el periodo**. El ZIP se llama bookkeeping-2026-01-01-to-2026-03-31.zip y contiene el resumen, las facturas, los pagos y los gastos en CSV.",
          ] },
          { tip: "Envíe el ZIP completo, no un solo archivo sacado de él. La hoja resumen repite la lista de lo que los datos no pueden decir — una declaración de impuestos, por ejemplo — para que la advertencia viaje con las cifras." },
        ],
      },
      {
        id: "the-four-files",
        heading: "Los cuatro archivos",
        blocks: [
          { table: {
            head: ["Archivo", "Una fila por", "Columnas"],
            rows: [
              ["summary", "periodo", "Empresa, periodo, fecha de generación, moneda de facturación; luego por moneda: Facturado, del cual impuesto, Pagos recibidos, Reembolsos, Comisiones de procesamiento, Comisiones de cuenta de Stripe, Gastos; luego las limitaciones y las notas sobre el periodo."],
              ["invoices", "factura", "Número de factura, Emitida, Fecha tomada de, Vencimiento, Cliente, Estado, Versión, Moneda, Subtotal, Descuento, Impuesto, Impuesto aplicado, Total, Pagado hasta la fecha, Recibido en el periodo, Saldo."],
              ["payments", "pago o reembolso", "Fecha, Número de factura, Cliente, Forma de pago, Moneda, Importe, Comisión de procesamiento, Neto depositado, Tarifa de comisión, Comisiones de cuenta de Stripe, Referencia, Notas. Un reembolso emitido desde FieldQuo es su propia línea: forma de pago **refund**, un Importe negativo, el identificador de reembolso de Stripe como Referencia y el motivo como Notas."],
              ["expenses", "gasto", "Fecha, Categoría, Moneda, Importe, Gastos generales, Recurrente, Frecuencia, Trabajo, Notas."],
            ],
          } },
        ],
      },
      {
        id: "the-rules-behind-the-numbers",
        heading: "Las reglas detrás de las cifras",
        blocks: [
          { bullets: [
            "Una factura editada después de enviarse es una versión nueva con el mismo número. La exportación emite **una fila por factura**, con el dinero de la última versión, fechada desde la original: una modificación en marzo nunca duplica una factura de enero.",
            "No hay un campo de fecha de emisión, así que cada fila dice de qué columna salió su fecha: **sentAt (emailed)**, **createdAt (raised)**, o las fechas propias de un trabajo pasado.",
            "Los pagos se filtran por la **fecha del propio pago**, no la de la factura: una factura de diciembre pagada en enero es efectivo de enero. **Importe** es el bruto; **Comisión de procesamiento** y **Neto depositado** son lo que Stripe tomó y lo que llegó al banco, en blanco — no 0.00 — para pagos manuales y pagos en línea antiguos.",
            "Los días se agrupan por día natural UTC. Un periodo con dos monedas se reporta por moneda y nunca se suma en un solo total.",
            "Los nombres de clientes, categorías y notas están protegidos contra fórmulas de hoja de cálculo: un cliente llamado =cmd… se abre como texto.",
          ] },
        ],
      },
      {
        id: "what-it-does-not-contain",
        heading: "Qué no contiene",
        blocks: [
          { bullets: [
            "Una declaración. Nada de esto se ha remitido a ninguna autoridad fiscal.",
            "Una declaración de impuestos sobre las ventas. El impuesto de una factura es un solo importe, sin códigos de impuesto ni impuesto por línea.",
            "Créditos fiscales por compras. Los gastos no llevan impuesto ni proveedor, así que el impuesto recuperable de lo que compró no se registra.",
            "Notas de crédito. Un reembolso emitido desde la factura en FieldQuo es una línea negativa del archivo de pagos y se totaliza bajo Reembolsos; un reembolso hecho directamente en su panel de Stripe no es una línea — solo se ve en el importe reembolsado del pago original.",
            "Un plan de cuentas. Nada está asignado a una cuenta contable: su contador lo hace una vez, al importar.",
          ] },
        ],
      },
      {
        id: "importing-it",
        heading: "Importar en QuickBooks o Xero",
        blocks: [
          { p: "Asigne el **Importe** del archivo de pagos a ingresos, la **Comisión de procesamiento** a un gasto de comisiones bancarias y el **Neto depositado** al depósito bancario; el extracto bancario cuadra entonces línea por línea. Una línea **refund** es un Importe negativo contra la misma cuenta de ingresos, sin comisión propia. Las facturas entran por el **Total** con **Impuesto** como importe del impuesto. La guía por programa está en [[quickbooks-xero-and-your-bookkeeper|QuickBooks, Xero y su contador]]; las columnas de comisiones se explican en [[payment-processing-fees-and-payouts|Comisiones de procesamiento de pagos y transferencias]]." },
        ],
      },
      {
        id: "who-can-download-it",
        heading: "Quién puede descargarla",
        blocks: [
          { p: "La exportación nombra a cada cliente y lo que pagó, así que está protegida como la lista de precios: **Show Pricing** más el nivel de Facturas **View only** o superior. Un estimador puede descargarla; un miembro de la cuadrilla no. Una sesión de soporte de solo lectura es rechazada: la consola de FieldQuo puede ver sus datos, pero nunca genera su cierre de año como archivo." },
        ],
      },
    ],
    faq: [
      { q: "¿Es una integración con QuickBooks?", a: "No. Es una exportación CSV que cualquier programa importa. Una sincronización en vivo necesitaría el proceso de aprobación de Intuit y una correspondencia de modelos de impuestos que todavía no existe, y el producto lo dice en lugar de fingir." },
      { q: "¿Por qué la celda de comisión está vacía en algunos pagos?", a: "Ese pago se registró a mano, o en línea antes de que las comisiones se guardaran en el pago. Una celda vacía significa «no se conoce comisión»; un cero afirmaría «sin comisión»." },
      { q: "¿Por qué falta un pago de enero en mi exportación de diciembre?", a: "Los pagos se fechan por cuándo se recibieron. Exporte enero para el efectivo de enero; la factura en sí está en el archivo de diciembre con su saldo." },
    ],
  },

  "booking-fees-and-visit-deposits": {
    title: "Tarifas de reserva y depósitos de visita",
    summary:
      "Cobre una tarifa de visita cuando un cliente reserva en línea, retenga el horario 30 minutos, decida si la tarifa se devuelve al cancelar, y acredítela a la factura cuando el trabajo sigue adelante.",
    updated: "2026-09-12",
    intro: [
      "Una tarifa de visita es un precio en un tipo de evento reservable: una visita de medición de $79, una consulta de diseño de pago. El cliente la paga con tarjeta en su página de reservas antes de que el horario sea suyo; si el trabajo sigue adelante, usted acredita la tarifa a la factura con un solo botón. No es un anticipo de presupuesto: esos se solicitan desde el calendario de pagos del presupuesto y se tratan en [[deposits-and-payment-schedules|Anticipos y calendarios de pago]].",
    ],
    sections: [
      {
        id: "overview",
        heading: "Resumen",
        blocks: [
          { p: "La tarifa se cobra solo cuando su empresa realmente puede cobrarla: Stripe conectado y cobros habilitados. Sin eso, un tipo de evento de pago se reserva discretamente como gratis en lugar de mostrar un precio que nadie puede cobrar. La página de reservas muestra el precio, el servidor lo decide, y el navegador nunca calcula una tarifa." },
        ],
      },
      {
        id: "on-the-screen",
        heading: "Qué hay en la pantalla",
        blocks: [
          { p: "En **Configuración → Página de reservas**, cada tarjeta de tipo de evento lleva una **Tarifa de visita** (o **Gratis**), un **Precio promo** y un interruptor **Promo activada**. Encima de las tarjetas, **Cambios y cancelaciones** contiene **Aviso que necesita para cambiar o cancelar**, el interruptor **Devolver la tarifa de visita si cancelan a tiempo** y **Aviso necesario para recuperar la tarifa**, con una frase de vista previa que enuncia la política exactamente como la leerá el cliente. Una tarjeta cuya tarifa no puede cobrarse dice **Conecta Stripe para cobrar esta tarifa — configúralo en Pagos**." },
          { figure: "live:app-settings-booking-page", caption: "Configuración → Página de reservas: los ajustes de la visita, Cambios y cancelaciones, y luego una tarjeta por tipo de evento con su tarifa y su precio promo." },
        ],
      },
      {
        id: "set-a-fee",
        heading: "Cómo cobrar por una visita",
        blocks: [
          { steps: [
            "Conecte Stripe en **Configuración → Pagos** y espere a que se habiliten los cobros; vea [[connect-stripe-and-get-verified|Conectar Stripe y verificar su cuenta]].",
            "Abra **Configuración → Página de reservas** y, en el tipo de evento, introduzca una **Tarifa de visita**. Déjela en blanco para una visita gratis.",
            "Para lanzar una oferta, introduzca un **Precio promo** y active **Promo activada**. La página de reservas muestra el precio habitual tachado — $79 → $20 — y cobra el precio promo.",
            "Bajo **Cambios y cancelaciones**, fije el aviso y decida si la tarifa se devuelve cuando un cliente cancela a tiempo. Se guarda a medida que lo cambia.",
          ] },
        ],
      },
      {
        id: "what-happens-when-a-client-books",
        heading: "Qué pasa cuando un cliente reserva",
        blocks: [
          { bullets: [
            "El cliente elige un horario y se le envía a una página de tarjeta de Stripe para la tarifa. El horario queda **retenido 30 minutos**; una retención que nadie paga caduca y el horario vuelve a quedar libre.",
            "Al pagar, la reserva se confirma, aparece una cita en su calendario y se envía la confirmación. Una comprobación cada hora vuelve a leer Stripe para cualquier reserva aún retenida, así que una visita pagada que el webhook no entregó se convierte igualmente en cita.",
            "El panel muestra una reserva que aún espera su tarifa como **Esperando $79**, con un botón para verificar el pago.",
            "La tarifa es un pago de Stripe a su nombre: la comisión de tarjeta (3 % + $0.30) se descuenta y el neto se transfiere con todo lo demás.",
          ] },
        ],
      },
      {
        id: "credit-against-the-invoice",
        heading: "Acreditar la tarifa a la factura",
        blocks: [
          { p: "Cuando el trabajo sigue adelante, abra la factura. Una tarjeta **Crédito por tarifa de visita** dice «Este cliente ya pagó una tarifa de visita. Acréditela a esta factura.» Pulse **Acreditar a la factura** y la tarifa se registra como una línea de pago, **Crédito por tarifa de visita**, que reduce el saldo como cualquier otro pago; **Quitar crédito** lo revierte. La tarifa se empareja por el correo electrónico del cliente dentro de su empresa, y una tarifa solo puede acreditarse una vez, a una sola factura." },
          { note: "Acreditar es decisión suya, no automática: a veces la consulta vale por sí sola. Requiere el interruptor **Payments**." },
        ],
      },
      {
        id: "cancellations-and-refunds",
        heading: "Cancelaciones y reembolsos",
        blocks: [
          { table: {
            head: ["Ajuste", "Qué hace"],
            rows: [
              ["Aviso que necesita para cambiar o cancelar", "Dentro de ese margen el cliente ya no puede mover ni cancelar la visita por su cuenta; la página le dice que le llame. Sin fijar, son 24 horas."],
              ["Devolver la tarifa de visita si cancelan a tiempo — apagado", "La cancelación se realiza igual y la tarifa se queda con usted. Es el valor por defecto."],
              ["Devolver la tarifa de visita si cancelan a tiempo — encendido", "Una cancelación con aviso suficiente reembolsa la tarifa a través de Stripe, y el cliente lo sabe antes de confirmar."],
              ["Aviso necesario para recuperar la tarifa", "Puede ser mayor que el aviso de cambio: «se puede mover hasta el día antes, pero la tarifa solo vuelve con dos días de aviso». En blanco usa el aviso de cambio."],
            ],
          } },
          { warning: "Un reembolso devuelve el dinero del cliente; Stripe se queda con su comisión de procesamiento sobre el cargo original. Vea [[refunds|Reembolsos]]." },
        ],
      },
      {
        id: "who-can-change",
        heading: "Quién puede cambiarlo",
        blocks: [
          { p: "Los ajustes de la Página de reservas son para el propietario, los administradores, los gerentes y los despachadores. Acreditar una tarifa a una factura requiere **Payments**: por defecto un gerente, un administrador o el propietario." },
        ],
      },
    ],
    faq: [
      { q: "¿Por qué mi visita de pago aparece como gratis en la página de reservas?", a: "Stripe no está conectado, o los cobros aún no están habilitados. La tarifa vuelve en cuanto Stripe informa que los cobros están habilitados." },
      { q: "¿La tarifa puede pagarse por débito bancario?", a: "No. Las tarifas de reserva son solo con tarjeta. El débito bancario está disponible para los planes de servicio en CAD." },
      { q: "El cliente pagó pero no veo ninguna cita.", a: "Espere la comprobación de cada hora, o pulse el botón de verificar pago en la tarjeta de espera del panel. Un pago que Stripe confirma siempre se convierte en cita." },
    ],
  },

  "money-owed-and-receivables-aging": {
    title: "Dinero adeudado y antigüedad de las cuentas por cobrar",
    summary:
      "Quién le debe, desde cuándo, y el botón Reclamar el pago: cómo lo cuenta el panel y por qué coincide con la página de la factura y con el balance.",
    updated: "2026-09-12",
    intro: [
      "El panel responde dos preguntas que la lista de facturas no responde: quién le debe, y desde cuándo. Las facturas vencidas se nombran en lo alto de la página con un botón **Reclamar el pago**; la ficha **Dinero que te deben** suma lo pendiente; y la tarjeta **Dinero que te deben** despliega la misma cifra por antigüedad — aún no vence, 1–30, 31–60, 61–90, 90+ días — con cada factura y su contacto.",
    ],
    sections: [
      {
        id: "overview",
        heading: "Resumen",
        blocks: [
          { p: "El dinero adeudado se cuenta de una sola manera en todas partes: la última versión de cada factura, excluidos borradores y documentos cancelados, menos cada pago registrado contra ella. Es también la regla del balance y la de la página de la factura: cambie el estado de una factura a Pagada sin registrar el pago y las tres seguirán diciendo que se debe. La ausencia nunca es un cero: una empresa sin facturas lee **Aún no hay facturas, así que no te deben nada.**, y una totalmente cobrada lee **Nada pendiente — todas las facturas que has enviado están saldadas.**" },
          { figure: "live:app", caption: "Inicio: Pendientes de ti arriba con la factura vencida y Reclamar el pago, las cuatro fichas, y luego El detalle con la tarjeta Dinero que te deben." },
        ],
      },
      {
        id: "on-the-screen",
        heading: "Qué hay en la pantalla",
        blocks: [
          { bullets: [
            "**Pendientes de ti**: la factura más vencida con su cliente, **12 días de retraso**, y **Reclamar el pago**; **3 más vencidas** cuando hay más.",
            "La ficha **Dinero que te deben**, con **$4,120 de eso está vencido.** bajo el total.",
            "En **El detalle**, la tarjeta **Dinero que te deben**: la leyenda **Repartido en 5 facturas impagadas. Cuenta la última versión de cada factura, menos los pagos registrados contra ella.**, y luego la escalera de antigüedad — **Aún no vence**, **1–30 días**, **31–60 días**, **61–90 días**, **90+ días**, y **Sin fecha de vencimiento** aparte.",
            "Hasta seis facturas, la más antigua primero: número, cliente, **Vence el 30 ago 2026** o **27 días de retraso**, **modificada, v2** si se editó después de enviarla, un enlace **Trabajo**, **Último recordatorio el 5 sep 2026 · 2×** o **Recordatorio automático enviado el 3 sep 2026**, y **Reclamar el pago**. Luego **4 más que no se muestran aquí**.",
            "Una línea sobre los recordatorios: **Un recordatorio automático se envía 3 días después de la fecha de vencimiento de una factura.** con **Cambiarlo**, o **No hay ningún recordatorio automático de vencimiento configurado…** con **Configurar uno**.",
          ] },
        ],
      },
      {
        id: "how-it-is-counted",
        heading: "Cómo se cuenta",
        blocks: [
          { table: {
            head: ["Caso", "Cómo se trata"],
            rows: [
              ["Factura editada después de enviarse", "Una sola entrada, con el total de la última versión, fechada desde la original. Marcada modificada, v2."],
              ["Sin fecha de vencimiento", "Listada bajo Sin fecha de vencimiento. Se debe, pero no está vencida y nunca cae en un tramo de días."],
              ["Días de retraso", "Días naturales enteros después de la fecha de vencimiento, el mismo conteo que muestra el aviso de la página de la factura."],
              ["Factura pagada de más", "No está en el total. Se nombra aparte: «1 factura se ha pagado de más por $180 en total. Ese es dinero que tienes tú, no dinero que te deben.»"],
              ["Factura sin fecha alguna", "Se cuenta y se nombra — «1 factura no lleva fecha alguna y no está contada arriba.» —, nunca se descarta en silencio."],
              ["Borrador o cancelada", "No es una cuenta por cobrar. No se muestra."],
            ],
          } },
        ],
      },
      {
        id: "chase-payment",
        heading: "Reclamar el pago",
        blocks: [
          { steps: [
            "Pulse **Reclamar el pago** en la factura, en lo alto del panel o en la tarjeta Dinero que te deben.",
            "El cliente recibe por correo un recordatorio presentado como recordatorio, no como factura nueva, con un botón Pagar que abre la factura en su portal. La tarjeta confirma: **Solicitud de pago enviada a jane@ejemplo.com a las 9:42**.",
            "La factura lo registra: **Último recordatorio el 12 sep 2026 · 1×**, y el conteo sube con cada reclamo. La fecha de envío original de la factura nunca se sobrescribe.",
          ] },
          { note: "Reclamar requiere un correo del cliente registrado; el botón lo dice cuando no lo hay. Una factura introducida como trabajo pasado nunca se reclama: no se envía nada a un cliente por trabajos pasados." },
        ],
      },
      {
        id: "automatic-reminders",
        heading: "Recordatorios automáticos",
        blocks: [
          { p: "Una regla de seguimiento con el disparador **Factura vencida** reclama por su cuenta, un plazo fijado después de la fecha de vencimiento, y el panel lo dice en una frase, o dice claramente que nada reclama esas facturas por sí solo. Cada envío automático se muestra en la fila de la factura como **Recordatorio automático enviado el** con la fecha. Configure la regla en **Configuración → Seguimientos**: [[invoice-reminders-and-chasing|Recordatorios de factura y reclamos]]." },
        ],
      },
      {
        id: "who-can-see-it",
        heading: "Quién puede verlo",
        blocks: [
          { p: "La ficha y la tarjeta Dinero que te deben requieren **Show Pricing** y el nivel de Facturas **View only**; sin ellos el panel está ausente: ni tarjeta ni cero. Pulsar **Reclamar el pago** requiere **View, create, and edit** en Facturas: un despachador, un gerente, un administrador o el propietario. Un estimador ve las cifras y no puede reclamar." },
        ],
      },
    ],
    faq: [
      { q: "¿Por qué la ficha no coincide con Pendiente en la lista de facturas?", a: "La ficha es el dinero adeudado a esta mañana, última versión por factura menos pagos; la ficha de la lista suma saldos por estado. Un pago registrado sin cambiar el estado aparece aquí primero." },
      { q: "Una factura está marcada como Pagada pero sigue apareciendo como adeudada.", a: "No se ha registrado ningún pago contra ella. Registre el pago en la factura — vea [[record-a-manual-payment|Registrar un pago en efectivo, cheque o transferencia]] — y desaparece de las tres superficies a la vez." },
      { q: "¿Cuántas facturas muestra la tarjeta?", a: "Seis, la más antigua primero, y luego el conteo del resto. La lista de facturas las tiene todas." },
    ],
  },
};
