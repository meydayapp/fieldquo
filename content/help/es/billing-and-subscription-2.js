// content/help/es/billing-and-subscription-2.js
//
// Parte 2 de la categoría «billing-and-subscription» en español (ver el
// compositor, billing-and-subscription.js). Misma estructura que el inglés,
// artículo por artículo: mismos slugs, mismas secciones en el mismo orden,
// mismos bloques, mismas figuras — scripts/check-help-centre.mjs compara los
// dos. Las palabras en pantalla vienen del bloque `es` de
// app/i18n/appMessages.js; las cifras, del código que las aplica
// (lib/billing/access.js, lib/billing/renewalReminder.js,
// lib/billing/retention.js, lib/referrals/index.js, lib/voice/credits.js,
// lib/ai/imageEconomics.js, lib/dataDeletion/constants.js).
export const ARTICLES = {
  "failed-payments-and-the-grace-period": {
    title: "Pagos fallidos y el período de gracia",
    summary:
      "Qué pasa cuando FieldQuo no puede cobrar su tarjeta: siete días de acceso de solo lectura, dos correos, un aviso, y cómo recuperarlo todo en más o menos un minuto.",
    updated: "2026-09-12",
    intro: [
      "Una tarjeta falla por razones aburridas: venció, el banco la retuvo por fraude, se alcanzó el límite. Cuando eso pasa con su suscripción de FieldQuo, nada se borra y nadie sale expulsado. La cuenta pasa a **solo lectura** durante **7 días**: todos pueden seguir abriendo cada presupuesto, factura, cliente y foto, pero nadie puede crear ni enviar nada nuevo. Actualice la tarjeta y todo vuelve en cuanto el pago pasa.",
      "Este artículo es toda esa ventana de siete días: qué ve en la pantalla, qué correos envía FieldQuo y cuándo, cómo arreglar la tarjeta, y qué pasa si los siete días se agotan.",
    ],
    sections: [
      {
        id: "overview",
        heading: "Resumen",
        blocks: [
          { p: "Su suscripción la cobra Stripe con la frecuencia de su plan. Cuando un cobro falla, Stripe se lo dice a FieldQuo, el estado del plan pasa a **Atrasada**, y ese día arranca un reloj. Durante 7 días la cuenta es de solo lectura. El octavo día se bloquea: la única pantalla que cualquiera puede abrir es Cuenta y facturación, más Ayuda. Pagar restaura el acceso completo de inmediato, sea el día que sea." },
          { p: "El reloj arranca con el primer cobro fallido y no se reinicia si un intento posterior también falla. Si Stripe finalmente se rinde y termina la suscripción, la cuenta se trata como **cancelada**, que tiene su propia ventana, más larga — vea [[cancel-your-subscription|Cancelar su suscripción]]." },
          { note: "La solo lectura la aplica el servidor, no el ocultar botones. Cualquier intento de guardar, enviar o crear durante la ventana se rechaza con un mensaje que dice cuántos días quedan y que nada se ha borrado." },
        ],
      },
      {
        id: "what-you-see",
        heading: "Qué ve durante la ventana",
        blocks: [
          { bullets: [
            "**En Cuenta y facturación**: la etiqueta de estado de la tarjeta del plan dice **Atrasada** en rojo, junto al nombre del plan.",
            "**Un aviso en la parte superior de cada pantalla**: ámbar mientras quedan más de dos días, rojo cuando quedan dos o menos, que dice que el pago no pasó y cuántos días quedan, con un enlace **Update card**. Lo ve todo el equipo, no solo el propietario.",
            "**Dos correos de FieldQuo**: uno el día en que se abre la ventana, que dice que la tarjeta no se pudo cobrar, que la cuenta es de solo lectura y que nada se ha borrado; y un recordatorio cuando quedan dos días o menos, con la fecha exacta en que la cuenta se bloquea. No hay insistencia diaria en el medio, y ambos se envían en inglés.",
            "**Después del séptimo día**: un aviso a página completa de que la cuenta está bloqueada, con un botón **Update my card**. Dice, con sus propias palabras, que nada se ha borrado.",
          ] },
        ],
      },
      {
        id: "fix-the-card",
        heading: "Cómo actualizar la tarjeta",
        blocks: [
          { steps: [
            "Abra **Configuración → Cuenta y facturación** (la misma pantalla que **Plan** en la barra lateral principal). Solo un propietario o administrador puede abrirla.",
            "Pulse **Gestionar facturación y método de pago**. El portal de facturación de Stripe se abre en nombre de FieldQuo; agregue la nueva tarjeta o arregle la antigua allí.",
            "Vuelva. FieldQuo le pregunta a Stripe qué cambió en cuanto regresa y actualiza la tarjeta del plan. Si la etiqueta sigue diciendo **Atrasada**, pulse **Verificar con Stripe** un poco más tarde: Stripe cobra el pago pendiente con su propio calendario una vez que hay una tarjeta válida registrada.",
            "Cuando el pago pasa, el estado vuelve a **Activo**, el aviso desaparece, y el reloj de siete días se reinicia: un problema posterior recibe siete días nuevos, no lo que sobró de estos.",
          ] },
          { figure: "live:app-settings-account-billing", caption: "Cuenta y facturación — la tarjeta del plan con su etiqueta de estado, el botón Gestionar facturación y método de pago, y la cuadrícula Planes debajo." },
          { tip: "Arreglar la tarjeta toma más o menos un minuto y se puede hacer desde un teléfono. Si no puede pagar ahora mismo, el enlace **Ayuda** sigue funcionando en el estado bloqueado: escríbanos en lugar de esperar a que el reloj se agote." },
        ],
      },
      {
        id: "the-timeline",
        heading: "La línea de tiempo",
        blocks: [
          { table: {
            head: ["Cuándo", "Qué pasa"],
            rows: [
              ["El cobro falla", "El estado pasa a Atrasada. La cuenta es de solo lectura desde ese momento. El reloj arranca."],
              ["El mismo día, o a la mañana siguiente", "Sale el primer correo: la comprobación diaria corre una vez al día, así que puede llegar hasta un día después del fallo."],
              ["Quedan dos días o menos", "El aviso se pone rojo y se envía el único correo de recordatorio, con la fecha del bloqueo."],
              ["Día 8", "La cuenta se bloquea. La lectura también se detiene; Cuenta y facturación y Ayuda siguen abiertas."],
              ["Cualquier día en que el pago pase", "El acceso completo vuelve de inmediato. Nada se borró en ningún momento."],
            ],
          } },
        ],
      },
      {
        id: "who-can-see-it",
        heading: "Quién lo ve, y quién puede arreglarlo",
        blocks: [
          { p: "El aviso y el estado de solo lectura aplican a todos en la empresa: un estimador no puede enviar un presupuesto durante la ventana, igual que el propietario. Arreglarlo es solo para propietarios y administradores, porque el método de pago pertenece a la empresa: el botón **Gestionar facturación y método de pago** y la fila Cuenta y facturación están ocultos para todos los demás niveles, y el servidor los rechaza igual. Los correos van a la dirección de correo de la empresa, o a la del propietario cuando no hay ninguna." },
        ],
      },
    ],
    faq: [
      { q: "¿Se borran mis datos si se agotan los siete días?", a: "No. Una cuenta bloqueada es inaccesible, no borrada. Presupuestos, facturas, clientes, trabajos y fotos se quedan exactamente donde están, y pagar los restaura al instante." },
      { q: "¿Mis clientes pueden seguir pagándome durante la ventana?", a: "Sí. Sus enlaces de presupuesto, el portal y las páginas de pago de factura son páginas públicas sin barrera de facturación, y sus pagos siguen llegando a su propia cuenta de Stripe. Lo que usted no puede hacer es enviar, editar ni reclamar nada hasta arreglar la tarjeta." },
      { q: "¿Por qué el primer correo llegó al día siguiente de que fallara la tarjeta?", a: "La comprobación que lo envía corre una vez al día. La cuenta pasó a solo lectura en el momento en que falló el cobro; el correo se puso al día en la siguiente corrida." },
    ],
  },

  "renewal-reminders": {
    title: "Recordatorios de renovación",
    summary:
      "Qué suscripciones reciben un correo antes del próximo cobro, con cuánta anticipación llega, qué dice, y por qué un plan mensual no recibe ninguno.",
    updated: "2026-09-12",
    intro: [
      "Antes de que FieldQuo cobre su tarjeta por otro período, puede avisarle. Lo hace donde un aviso es útil: **30 días** antes de que se renueve un plan anual, y **7 días** antes de que un primer mes gratis se convierta en el primer cobro real. Un plan mensual no recibe recordatorio: el mismo monto el mismo día cada mes no es algo sobre lo que nadie necesite una carta.",
      "Este artículo dice exactamente quién recibe el correo, cuándo, qué contiene, y qué hacer si quiere cambiar o cancelar antes de la fecha que nombra.",
    ],
    sections: [
      {
        id: "overview",
        heading: "Resumen",
        blocks: [
          { p: "El recordatorio se decide una vez al día a partir de la próxima fecha de facturación de su suscripción, la que aparece como **Próxima fecha de facturación** en Cuenta y facturación. Se envía una vez por período: un plan anual recibe un correo al año, y el mismo período nunca se recuerda dos veces. Si el envío falla, la corrida del día siguiente vuelve a intentarlo, hasta la renovación." },
          { p: "El recordatorio en sí no cobra nada. El cobro es de Stripe, en la fecha del correo, a la tarjeta registrada, y el correo dice qué tarjeta, por sus últimos cuatro dígitos, cuando Stripe reporta una." },
        ],
      },
      {
        id: "when-it-goes-out",
        heading: "Cuándo sale",
        blocks: [
          { table: {
            head: ["Su suscripción", "Recordatorio"],
            rows: [
              ["Plan anual (compromiso de 1 año)", "30 días antes de la fecha de renovación"],
              ["Primer mes gratis, a punto de pasar a pago", "7 días antes del primer cobro (30 días si el plan es anual)"],
              ["Plan mensual", "Ninguno: el monto y el día son los mismos cada mes"],
            ],
          } },
          { note: "Una suscripción atrasada o cancelada no recibe recordatorio. Una cuenta atrasada ya está dentro de la ventana de siete días descrita en [[failed-payments-and-the-grace-period|Pagos fallidos y el período de gracia]], y anunciar un cobro a una tarjeta que acaba de rebotar sería el mensaje equivocado." },
        ],
      },
      {
        id: "what-the-email-says",
        heading: "Qué dice el correo",
        blocks: [
          { bullets: [
            "El nombre del plan y la fecha de renovación, en una frase.",
            "El monto que se cobrará, en su moneda de facturación, y los últimos cuatro dígitos de la tarjeta cuando Stripe los tiene.",
            "Que puede cambiar de plan o cancelar en cualquier momento antes de esa fecha desde Cuenta y facturación, y que no se cobra nada hasta la fecha de renovación.",
            "Un botón **Manage billing** que abre Cuenta y facturación.",
          ] },
          { p: "El correo viene de FieldQuo, no de su empresa, y está escrito en inglés. Es el único correo automático sobre un cobro próximo que FieldQuo envía; Stripe también puede enviar su propio aviso genérico, y si recibe ambos el mismo día, ese es de Stripe, no un segundo nuestro." },
        ],
      },
      {
        id: "change-before-renewal",
        heading: "Cambiar o cancelar antes de la fecha",
        blocks: [
          { steps: [
            "Abra **Configuración → Cuenta y facturación**.",
            "Para pasar a otro plan, elíjalo en la cuadrícula **Planes**. Una bajada de plan o un cambio entre **Mensual** y **Compromiso de 1 año** cae en la fecha de renovación, sin cobrar nada antes; una subida de plan aplica ahora. Vea [[change-your-plan|Cambiar de plan]].",
            "Para detener la renovación por completo, pulse **Cancelar plan**: lea primero [[cancel-your-subscription|Cancelar su suscripción]], porque el plan termina en el momento en que confirma, no en la fecha de renovación.",
          ] },
          { figure: "live:app-settings-account-billing", caption: "Cuenta y facturación — la próxima fecha de facturación bajo la tarjeta del plan, y el selector Mensual / Compromiso de 1 año sobre la cuadrícula Planes." },
        ],
      },
      {
        id: "who-receives-it",
        heading: "Quién lo recibe",
        blocks: [
          { p: "La dirección de correo de la empresa, o la del propietario cuando la empresa no tiene ninguna. No se envía a cada miembro: cuánto le paga la empresa a FieldQuo, y cuándo, es información comercial que se queda con el propietario y los administradores, las mismas personas que pueden abrir Cuenta y facturación." },
        ],
      },
    ],
    faq: [
      { q: "Estoy en un plan mensual y nunca recibo un recordatorio. ¿Algo está roto?", a: "No. Los planes mensuales no reciben ninguno, por diseño. La próxima fecha de facturación siempre está en Cuenta y facturación." },
      { q: "¿El recordatorio significa que ya se me cobró?", a: "No. Dice que viene un cobro, en la fecha que nombra. El recibo de Stripe después del cobro es un correo aparte." },
      { q: "¿Puedo recibir el recordatorio en francés o en español?", a: "Hoy no. Los correos de facturación de FieldQuo mismo — renovación, pago fallido, cancelación — se envían en inglés." },
    ],
  },

  "cancel-your-subscription": {
    title: "Cancelar su suscripción",
    summary:
      "Cómo funciona el botón Cancelar plan: el paso del motivo, el paso de la oferta, los avisos que aplican a su empresa, y los treinta días de solo lectura que siguen.",
    updated: "2026-09-12",
    intro: [
      "Cancelar es un botón en Cuenta y facturación, no un correo a soporte. Antes de que el plan termine, FieldQuo pregunta por qué se va, puede hacer una oferta que encaje con el motivo, y luego le dice — con las palabras claras de abajo — exactamente qué se detiene, qué sigue funcionando, y qué no pasa. El plan termina en el momento en que confirma; la cuenta queda abierta en **solo lectura durante 30 días**, y nada se borra.",
      "Lea esto antes de pulsar el botón, porque dos de las cosas que siguen funcionando después de una cancelación cuestan dinero: un número de teléfono alquilado, y las recargas automáticas de crédito telefónico.",
    ],
    sections: [
      {
        id: "overview",
        heading: "Resumen",
        blocks: [
          { p: "Pulsar **Cancelar plan** abre un flujo corto: **Antes de irte** (por qué se va), a veces **Una cosa primero** (una oferta), luego **Cancelar tu plan** (las consecuencias y la confirmación). Confirmar cancela la suscripción en Stripe de inmediato. Stripe se lo dice a FieldQuo, el estado del plan pasa a **Cancelado**, y arranca una ventana de solo lectura de 30 días. Después, la cuenta se bloquea hasta que alguien vuelva a iniciar un plan." },
          { warning: "El plan termina en el momento en que confirma, no al final del mes ni del año. Lo que ya pagó por el resto del período no se reembolsa. Si quiere las semanas que quedan, conserve el plan hasta la próxima fecha de facturación y cancele entonces." },
        ],
      },
      {
        id: "how-to-cancel",
        heading: "Cómo cancelar",
        blocks: [
          { steps: [
            "Abra **Configuración → Cuenta y facturación** y pulse **Cancelar plan**, bajo la tarjeta del plan.",
            "**Antes de irte**: la pantalla muestra lo que ha acumulado (presupuestos, clientes, facturas) y pregunta qué lo lleva a cancelar: demasiado caro, paga por gente que no lo usa, trabajo de temporada, no lo usa lo suficiente, le falta una función, se cambia a otra cosa, cierra el negocio, u otra cosa. Elija una, o pulse **Omitir esto y cancelar**.",
            "**Una cosa primero**: si una oferta encaja, se muestra aquí (la tabla de abajo). Tómela y el plan se queda; o pulse **No, gracias — cancelar mi cuenta**.",
            "**Cancelar tu plan**: lea las consecuencias, agregue una nota si quiere (es la única forma en que nos enteramos de qué arreglar), y pulse **Cancelar mi plan**. **Mantener mi plan** cierra el flujo sin cambiar nada.",
            "Un correo confirma la cancelación. La tarjeta del plan ahora dice **Cancelado** y el botón **Cancelar plan** ya no está.",
          ] },
          { figure: "live:app-settings-account-billing", caption: "Cuenta y facturación — Cancelar plan está bajo la tarjeta del plan, junto a Gestionar facturación y método de pago." },
          { note: "Todo en el flujo se decide en el servidor. La oferta que ve es la que corresponde a su cuenta, y una cancelación solo se registra una vez que Stripe ha terminado realmente la suscripción." },
        ],
      },
      {
        id: "the-offers",
        heading: "Las ofertas",
        blocks: [
          { table: {
            head: ["Oferta", "Cuándo aparece", "Qué hace"],
            rows: [
              ["Bajar a menos licencias", "Solo en un plan antiguo por licencia con más licencias pagadas que personas usándolas", "Reduce el número de licencias de su suscripción de Stripe desde la siguiente factura, con la parte no usada acreditada"],
              ["Pausar hasta que vuelva a estar ocupado", "Cualquier plan, una vez cada 12 meses", "Stripe deja de emitir facturas mientras la cuenta está en pausa: no se acumula ninguna cuenta que saldar al volver"],
              ["25% de descuento durante 2 meses", "Cualquier plan, una vez cada 12 meses", "Sus siguientes 2 facturas bajan un 25%, y luego vuelve el precio normal"],
            ],
          } },
          { p: "La pausa y el descuento comparten un solo período de espera de 12 meses: tome cualquiera de los dos y ninguno se ofrece de nuevo durante un año, y la pantalla dice desde qué fecha está disponible el siguiente. Reducir licencias no es una concesión — corrige un cobro de más —, así que nunca inicia la espera. En la escalera de cuatro peldaños (Solo, Crew, Shop, Scale) la oferta de licencias nunca aparece, porque esos planes no se cobran por licencia." },
        ],
      },
      {
        id: "what-happens-after",
        heading: "Qué pasa después de confirmar",
        blocks: [
          { bullets: [
            "**Solo lectura durante 30 días.** Todos pueden seguir abriendo FieldQuo y leer todo — descargue lo que necesite para su contador — pero nadie puede cambiar nada. Un aviso en la parte superior cuenta los días.",
            "**Luego bloqueada.** Pasados los 30 días la cuenta queda cerrada hasta que se vuelva a iniciar el plan. Nada se borra en ningún momento; volver a empezar lo devuelve todo.",
            "**Sus clientes conservan cada enlace.** Los presupuestos, el portal del cliente y las páginas de pago de factura siguen abriéndose, y cualquier cosa que paguen sigue llegando a su propia cuenta de Stripe.",
            "**Sin reembolso del período restante.** La pantalla indica la fecha hasta la que ha pagado antes de que confirme.",
            "**Volver a empezar** es **Elegir plan** en la misma pantalla, que abre una nueva página de pago de Stripe. El primer mes gratis no se ofrece una segunda vez.",
          ] },
        ],
      },
      {
        id: "before-you-cancel",
        heading: "Resuelva esto primero",
        blocks: [
          { p: "El paso de confirmación lista solo los avisos que son ciertos para su empresa: a un pintor sin número de teléfono no se le avisa sobre uno. Cada uno es algo que solo puede hacer mientras la cuenta todavía se puede modificar, así que hágalo antes de confirmar." },
          { bullets: [
            "**Un número de teléfono alquilado no se devuelve.** Su alquiler mensual sigue saliendo de su crédito telefónico; cuando el crédito no puede cubrirlo recibe un aviso de 7 días y el número se libera para siempre. Libérelo usted mismo primero si prefiere elegir el momento.",
            "**El crédito telefónico no se reembolsa.** El saldo que compró sigue siendo un saldo.",
            "**Las recargas automáticas de crédito telefónico siguen activas.** Si hay una tarjeta guardada para ellas, se sigue cobrando cada vez que el saldo baja. Desactívelas primero en la página de configuración del teléfono.",
            "**Los planes de servicio con un método de pago guardado siguen corriendo.** Las facturas siguen saliendo y las tarjetas de sus clientes siguen cobrándose según el calendario. Cancele esos planes primero si no es lo que quiere.",
            "**Las facturas impagas siguen siendo pagables** por el cliente, pero una vez en solo lectura no puede editarlas, reenviarlas ni reclamarlas.",
            "**Su sitio web y su página de reservas siguen en línea.** Las nuevas solicitudes de reserva siguen llegando, y pasados los 30 días no podrá abrir la cuenta para verlas. Una pequeña línea «Site by FieldQuo» vuelve entonces al pie de página. Despublique el sitio primero si prefiere que quede en silencio.",
          ] },
        ],
      },
      {
        id: "who-can-do-it",
        heading: "Quién puede cancelar",
        blocks: [
          { p: "El propietario y los administradores. Un Manager, Dispatcher o Estimator no ve Cuenta y facturación en absoluto, y la solicitud de cancelación se rechaza en el servidor para cualquiera por debajo de propietario o administrador: la suscripción es la relación comercial de la empresa con FieldQuo, no un permiso de programación." },
        ],
      },
    ],
    faq: [
      { q: "¿Puedo cancelar al final de mi período de facturación en lugar de hoy?", a: "No desde el botón: termina el plan de inmediato. Espere hasta el día anterior a su próxima fecha de facturación y cancele entonces; el recordatorio de renovación en un plan anual le da 30 días de aviso de esa fecha." },
      { q: "Pagué un año. ¿Me devuelven el resto?", a: "No. La pantalla dice la fecha hasta la que ha pagado y que el resto no se reembolsa, antes de que confirme." },
      { q: "¿Se borrarán mis datos después de los 30 días?", a: "No. Bloqueado no es borrado. Para que los datos se borren de verdad, vea [[closing-your-account|Cerrar su cuenta y sus datos]]." },
    ],
  },

  "referral-months": {
    title: "Meses por referidos",
    summary:
      "Cómo un negocio referido y el negocio que lo refirió ganan cada uno un mes gratis, cuándo cae cada mes, y las reglas que impiden abusar del programa.",
    updated: "2026-09-12",
    intro: [
      "Refiera a otro contratista y ambos reciben lo mismo: **un mes más de FieldQuo gratis**. El mes del recién llegado se agrega a su prueba gratis en el momento en que se registra con su enlace. El suyo se agrega a su cuenta cuando ese negocio hace su **primer pago real** — no cuando se registra, porque un mes por un registro es un mes por una dirección desechable.",
      "Este artículo es la mecánica: cómo se gana el mes, adónde va en una cuenta mensual, anual o en prueba, y los límites. La página en sí — el enlace, el formulario de invitación, la lista de negocios — se cubre en [[refer-another-business|Referir a otro negocio y ganar un mes gratis]].",
    ],
    sections: [
      {
        id: "overview",
        heading: "Resumen",
        blocks: [
          { p: "Cada empresa tiene un código de referido y un enlace en **Recomienda y gana**. Un negocio que se registra con él empieza con su primer mes gratis normal más un mes por referido. Luego aparece bajo **Negocios que has referido** como **Registrado: aún no paga** hasta que su primera factura pagada se procesa, momento en que la etiqueta pasa a **Acreditado** y se agrega un mes a su propio acceso, automáticamente." },
          { p: "El mes es del mismo tamaño sin importar a quién refiera. Una empresa Solo que refiere a una empresa Scale gana un mes de Solo; el tamaño del negocio que trae no cambia lo que recibe: la pantalla lo dice con sus propias palabras." },
        ],
      },
      {
        id: "how-a-month-is-earned",
        heading: "Cómo se gana un mes",
        blocks: [
          { steps: [
            "Abra **Recomienda y gana** (en la barra lateral principal, o bajo Configuración) y comparta **Tu enlace**: cópielo con **Copiar**, o use **Enviar una invitación** por correo o por SMS. FieldQuo envía un mensaje y no insiste, y el formulario de invitación permite 20 al día.",
            "El otro negocio se registra con el enlace. Su prueba gratis se extiende un mes en el acto, y aparece en su lista como **Registrado: aún no paga**.",
            "Paga su primera factura real — el mes gratis es $0, así que el primer cobro después — habiendo terminado su incorporación y conectado una cuenta de Stripe verificada para recibir pagos.",
            "Su mes se agrega en el momento en que cae ese pago, y la fila dice **Acreditado**.",
          ] },
          { figure: "live:app-settings-refer", caption: "Recomienda y gana — su enlace, el formulario de invitación, y los negocios que ha referido con su estado." },
          { note: "Dos condiciones sobre la empresa referida tienen que cumplirse antes de que se le otorgue su mes: su incorporación está completa, y su propia cuenta de Stripe para pagos de clientes está verificada. Una empresa referida que paga antes de conectar Stripe le gana el mes con su siguiente factura pagada después de verificarse: más tarde, no nunca." },
        ],
      },
      {
        id: "when-it-lands",
        heading: "Adónde va el mes",
        blocks: [
          { table: {
            head: ["Su cuenta", "Qué hace el mes"],
            rows: [
              ["Todavía en el primer mes gratis", "La fecha de fin de su prueba se corre un mes. No se cobra nada hasta entonces."],
              ["Pagando mensual", "Su próximo cobro se aplaza un mes calendario. El plan sigue; simplemente no se le cobra ese mes."],
              ["Pagando anual", "Su fecha de renovación se corre un mes: un año que termina el 27 de agosto se renueva el 27 de septiembre. No se le cobra otro año para recibirlo."],
            ],
          } },
          { p: "Los meses se apilan a partir de la más tardía de las dos fechas. Refiera a un segundo negocio antes de que el primer mes se haya agotado y la fecha de fin se corre otro mes, no vuelve a donde estaba. Un 31 que caería en un mes más corto pasa a ser el último día de ese mes." },
        ],
      },
      {
        id: "the-rules",
        heading: "Las reglas",
        blocks: [
          { bullets: [
            "**Un mes cada uno**, para quien refiere y para el referido, sin importar el tamaño de ninguno de los dos negocios.",
            "**Una empresa que ya existe puede referir pero nunca canjear.** El enlace es para negocios nuevos en FieldQuo; un cliente existente que vuelve a registrarse con un enlace no recibe nada.",
            "**No puede referirse a sí mismo.** Se comprueba por el código, no por la dirección de correo.",
            "**Como máximo 50 referidos acreditados por empresa por mes calendario.** Un tope contra el abuso, no un límite a lo que gana un referido real.",
            "**Cada empresa referida le gana el mes una sola vez.** Un pago reintentado o una renovación nunca pagan el mismo referido dos veces.",
          ] },
        ],
      },
      {
        id: "who-can-see-it",
        heading: "Quién puede verlo",
        blocks: [
          { p: "El propietario y los administradores. Recomienda y gana es una pantalla de facturación — cambia cuándo se le cobra a la empresa la próxima vez —, así que está detrás de la misma regla que Cuenta y facturación y oculta para todos los demás niveles." },
        ],
      },
    ],
    faq: [
      { q: "El negocio que referí se registró hace semanas. ¿Por qué todavía no me acreditan?", a: "Su fila todavía dice Registrado: aún no paga. El mes se otorga con su primer pago real, después de su mes gratis, y solo una vez que su incorporación está completa y su cuenta de Stripe para pagos de clientes está verificada." },
      { q: "¿Es un descuento o un mes gratis?", a: "Un mes gratis: su próximo cobro se corre un mes. No es un crédito en dólares contra una factura más grande." },
      { q: "¿El negocio referido recibe algo?", a: "Sí: un mes extra agregado a su prueba gratis al registrarse, antes de haber pagado nada." },
    ],
  },

  "ai-credit-and-phone-credit": {
    title: "Crédito de IA y crédito telefónico",
    summary:
      "Los dos saldos prepagados que FieldQuo mide — minutos de teléfono y alquiler de número en uno, imágenes con IA y la lectura profunda de fotos en el otro —, cuánto cuesta cada cosa, cómo comprar más, y cómo funciona la recarga automática.",
    updated: "2026-09-12",
    intro: [
      "Su plan incluye FieldQuo AI y el copiloto. Dos cosas se miden aparte, contra crédito que compra por adelantado: la **recepcionista telefónica** (y los mensajes de texto de la cuadrilla), y las **imágenes con IA** (la generación, y la lectura profunda de pago de las fotos de un presupuesto). Consumen dos saldos distintos, separados a propósito, y ambos se muestran en **Configuración → Crédito de IA**.",
      "El crédito se compra a FieldQuo a través de Stripe en **dólares estadounidenses**, sea cual sea la moneda en que se cobra su plan. Nunca vence, y nunca se reembolsa, incluso cuando cancela el plan.",
    ],
    sections: [
      {
        id: "overview",
        heading: "Resumen",
        blocks: [
          { p: "**Crédito de IA** es una pantalla con tres tarjetas: **Crédito telefónico** (saldo, un enlace para comprar más, y **En qué se fue el crédito**), **Crédito de imágenes con IA** (saldo, una fila **Añadir crédito** de montos únicos, y su propio estado de cuenta), y **Plan de crédito de IA — paga al mes y ahorra por crédito** (una asignación recurrente sobre el saldo de IA). Comprar crédito telefónico y configurar la recarga automática se hacen en la página de configuración **Recepcionista telefónico**, a la que enlaza la primera tarjeta." },
          { note: "Los dos saldos no se mezclan. El crédito telefónico no se puede gastar en imágenes y el crédito de imágenes no se puede gastar en llamadas. La pantalla lo dice bajo su título, para que nadie compre el equivocado." },
        ],
      },
      {
        id: "what-is-on-the-screen",
        heading: "Qué hay en la pantalla",
        blocks: [
          { figure: "live:app-settings-ai-credit", caption: "Crédito de IA — la tarjeta Crédito telefónico, la tarjeta Crédito de imágenes con IA con sus montos de Añadir crédito, y la tarjeta Plan de crédito de IA." },
          { bullets: [
            "**Crédito telefónico**: el saldo, un aviso **quedando poco** cuando quedan menos de diez minutos, la nota de que los mensajes de texto de la cuadrilla consumen este mismo saldo, **Agregar crédito telefónico** (que abre la página de configuración del teléfono), y el estado de cuenta.",
            "**Crédito de imágenes con IA**: el saldo con lo que compra entre paréntesis (unas N imágenes, o N lecturas profundas), las dos cosas que lo gastan, **Añadir crédito** con cuatro montos, y el estado de cuenta.",
            "**Plan de crédito de IA**: la promesa de acumulación en palabras claras, y luego o los tres planes con **Suscribirse**, o el plan en el que está, su fecha de renovación, y **Cancelar plan**.",
          ] },
        ],
      },
      {
        id: "prices",
        heading: "Cuánto cuesta cada cosa",
        blocks: [
          { table: {
            head: ["Concepto", "Costo", "Saldo que consume"],
            rows: [
              ["Llamada de la recepcionista", "35¢ por minuto, redondeado hacia arriba, un minuto mínimo", "Crédito telefónico"],
              ["Alquiler de número local", "$4 al mes", "Crédito telefónico"],
              ["Alquiler de número gratuito (toll-free)", "$9 al mes, más 5¢ por minuto en llamadas", "Crédito telefónico"],
              ["Línea de mensajes de texto de la cuadrilla", "$4 al mes", "Crédito telefónico"],
              ["Generación de imagen con IA", "12¢ por imagen", "Crédito de imágenes con IA"],
              ["Lectura profunda de fotos en un presupuesto", "25¢ por lectura, hasta 8 fotos", "Crédito de imágenes con IA"],
            ],
          } },
          { p: "El primer número de teléfono viene con **30 minutos gratis**, una vez por empresa. Un número cuyo alquiler el crédito no puede cubrir recibe un aviso de 7 días y luego se libera para siempre — vea [[settings-phone-receptionist|Recepcionista telefónico]]." },
        ],
      },
      {
        id: "buying-credit",
        heading: "Comprar crédito",
        blocks: [
          { steps: [
            "Para el **crédito telefónico**, abra **Configuración → Recepcionista telefónico** y pulse **Añadir crédito** en la tarjeta **Crédito**. Elija **$10**, **$30**, **$50** o **$100** — cada uno muestra los minutos que compra — o ingrese cualquier monto de $5 a $1,000. Se abre la página de pago de Stripe; el crédito llega a su saldo cuando vuelve, o en uno o dos minutos por la propia confirmación de Stripe si cerró la pestaña.",
            "Para el **crédito de imágenes con IA**, pulse uno de los cuatro montos de **Añadir crédito** en **Configuración → Crédito de IA** — los mismos $10 / $30 / $50 / $100, cada uno etiquetado con las imágenes que compra — y pague en la página de Stripe de la misma forma.",
            "Para una **asignación mensual**, pulse **Suscribirse** en uno de los tres planes de crédito de IA. El crédito del primer mes está en su saldo cuando vuelve; el de cada mes siguiente se agrega cuando se paga la factura de ese mes.",
          ] },
          { bullets: [
            "**starter**: $30 al mes por 4,000 créditos (unas 333 imágenes).",
            "**busy**: $50 al mes por 7,000 créditos (unas 583 imágenes).",
            "**agency**: $80 al mes por 11,500 créditos (unas 958 imágenes).",
          ] },
          { p: "Un crédito es un centavo de valor a demanda, así que una generación son 12 créditos y una lectura profunda 25. El crédito del plan no usado se acumula: nada vence, y cancelar el plan detiene el cobro y el crédito del mes siguiente pero nunca retira el crédito ya otorgado. Los planes se cobran en dólares estadounidenses en el mismo cliente de Stripe que su suscripción, así que una empresa cuyo plan se cobra en **CAD** no puede iniciar uno: el botón **Suscribirse** está desactivado y dice por qué. Las recargas únicas sí funcionan en una cuenta en CAD." },
        ],
      },
      {
        id: "automatic-top-up",
        heading: "Recarga automática del crédito telefónico",
        blocks: [
          { p: "Desactivada a menos que la active. Cuando está activada, FieldQuo compra más crédito telefónico por su cuenta cuando el saldo baja de un umbral que usted elige, para que la recepcionista nunca deje de contestar a mitad de semana. Se comprueba cada 15 minutos, compra como máximo **3 veces al día**, y espera al menos 15 minutos entre compras." },
          { steps: [
            "En **Configuración → Recepcionista telefónico**, busque **Recargar automáticamente** y pulse **Configurar la recarga automática**.",
            "Elija **Recargar cuando el saldo baje de** ($5, $10 o $20) **y comprar esto cada vez** ($10, $30, $50 o $100), lea y marque los términos, y pulse **Continuar**. Stripe guarda la tarjeta con un mandato en regla; los términos que aceptó se registran con la fecha.",
            "La tarjeta dice **La recarga automática está activada**, con el umbral, los últimos cuatro dígitos de la tarjeta, el monto y el máximo diario. **Desactivar la recarga automática** la detiene conservando la tarjeta; **Quitar la tarjeta guardada** la elimina. Cambiar el umbral o el monto le pide aceptar los términos de nuevo.",
          ] },
          { warning: "Si la tarjeta guardada es rechazada, FieldQuo desactiva la recarga automática y no reintenta: reintentar una tarjeta rechazada es como se consigue que la bloqueen. La tarjeta en la página de configuración lo dice; resuelva la tarjeta con su banco y luego pulse **Volver a activarlo**. Cancelar su plan de FieldQuo no desactiva la recarga automática." },
        ],
      },
      {
        id: "who-can-see-it",
        heading: "Quién puede verlo",
        blocks: [
          { p: "El propietario, los administradores, y cualquiera en el preajuste Dispatcher o Manager: las mismas personas que pueden gestionar el equipo. Comprar crédito, suscribirse a un plan y activar la recarga automática se rechazan en el servidor para cualquier otro. Un estimador o un acceso de cuadrilla nunca ve las filas Crédito de IA ni Recepcionista telefónico." },
        ],
      },
    ],
    faq: [
      { q: "¿Por qué el crédito está en dólares estadounidenses cuando mi plan está en CAD?", a: "Los minutos de teléfono y la IA se compran en dólares estadounidenses y los tipos de cambio se mueven, así que los saldos se mantienen en la moneda en que cuestan. Solo el plan mensual de crédito de IA no está disponible en una cuenta en CAD; las recargas únicas de cualquiera de los dos saldos funcionan." },
      { q: "¿El crédito no usado vence?", a: "No. Ninguno de los dos saldos vence, y el crédito del plan se acumula mes a mes. Tampoco se reembolsa nunca, incluso cuando cancela su plan de FieldQuo." },
      { q: "¿FieldQuo AI — hacer preguntas sobre mis propios presupuestos y facturas — se mide?", a: "No. FieldQuo AI y el copiloto están incluidos en cada plan. Solo los minutos de teléfono, el alquiler de número, la generación de imágenes y la lectura profunda de fotos consumen crédito." },
      { q: "¿Dónde veo en qué se gastó el crédito?", a: "Bajo En qué se fue el crédito en cada tarjeta de la página Crédito de IA: cada débito y cada recarga, con fecha. La página del teléfono lleva el mismo estado de cuenta." },
    ],
  },

  "paying-for-the-migration-service": {
    title: "Pagar el servicio de migración",
    summary:
      "Cómo se cotiza, acepta y paga el servicio de migración de datos de pago — a través de la facturación de FieldQuo, nunca de su cuenta de Stripe — y qué compra y qué no compra el precio.",
    updated: "2026-09-12",
    intro: [
      "El servicio de migración de datos es personal de FieldQuo trayendo a mano sus antiguos clientes y presupuestos a su cuenta, por un precio que FieldQuo fija después de ver lo que tiene. Usted lo solicita, FieldQuo lo cotiza, usted acepta el precio, lo paga, y solo entonces alguien escribe algo en su cuenta. Este artículo es la mitad del dinero; el servicio en sí se describe en [[the-data-migration-service|El servicio de migración de datos]].",
      "El pago es FieldQuo cobrándole a su empresa: un pago, a través de Stripe, en el mismo registro de cliente que su suscripción. Nunca toca la cuenta de Stripe por la que sus clientes le pagan.",
    ],
    sections: [
      {
        id: "overview",
        heading: "Resumen",
        blocks: [
          { p: "Todo ocurre en **Configuración → Migración de datos**. La tarjeta de solicitud muestra de dónde vienen sus datos, su estado, y — una vez que FieldQuo la ha cotizado — el precio con una nota, y **Aceptar** / **Rechazar**. Aceptar convierte la tarjeta en un paso de pago con **Pagar y empezar la migración**; pagar la convierte en una tarjeta de progreso, y **Lo que ya se trajo** se va llenando debajo a medida que se agregan registros." },
          { note: "El precio y su moneda los fija FieldQuo en la solicitud. El navegador nunca envía un monto a Stripe: la página de pago se construye a partir del precio de la propia solicitud en el servidor, la misma regla que sigue cualquier otro pago en FieldQuo." },
        ],
      },
      {
        id: "the-steps",
        heading: "De la solicitud al pago",
        blocks: [
          { steps: [
            "Pulse **Solicitar una migración** y diga dónde están sus datos ahora (QuickBooks, Jobber, una hoja de cálculo…) y cualquier otra cosa que valga la pena saber. La tarjeta dice **Solicitada**.",
            "Si quiere, agende una llamada bajo **Agenda una llamada con FieldQuo** para definir el alcance; la tarjeta dice **Llamada agendada**. Puede subir las exportaciones bajo **Documentos** en cualquier momento hasta aquí o después.",
            "FieldQuo la cotiza. La tarjeta dice **Presupuesto listo**, con el precio y una nota que lo explica.",
            "Pulse **Aceptar**. La tarjeta dice **Aceptado — pago pendiente**, con la línea «paga cuando quieras empezar». O pulse **Rechazar**, lo que termina la solicitud.",
            "Pulse **Pagar y empezar la migración**. Se abre la página de pago de Stripe; pague allí. Cuando vuelve, la tarjeta dice **Pagada** y dice que FieldQuo se pondrá en contacto. Si cerró la pestaña después de pagar, la propia confirmación de Stripe la marca como pagada de todos modos.",
            "Cuando el personal empieza, la tarjeta dice **En curso**; cuando termina, **Terminada**. Cada cliente y presupuesto que crearon aparece bajo **Lo que ya se trajo**.",
          ] },
          { figure: "live:app-settings-migration", caption: "Migración de datos — la tarjeta de solicitud con su estado y precio, y la tarjeta Documentos para sus exportaciones." },
        ],
      },
      {
        id: "the-statuses",
        heading: "Los estados",
        blocks: [
          { table: {
            head: ["Estado", "Significado", "¿Puede cancelar?"],
            rows: [
              ["Solicitada", "Recibida; aún sin cotizar", "Sí — Cancelar esta solicitud"],
              ["Llamada agendada", "Hay una llamada de alcance programada", "Sí"],
              ["Presupuesto listo", "FieldQuo ha fijado un precio", "Sí, o Rechazar"],
              ["Aceptado — pago pendiente", "Usted aceptó; nada se escribe hasta que pague", "Sí"],
              ["Pagada", "Pago recibido; el personal no ha empezado", "No: es una conversación con soporte"],
              ["En curso", "El personal está creando registros", "No"],
              ["Terminada", "Hecho", "—"],
              ["Rechazado", "Usted rechazó el precio", "—"],
              ["Cancelada", "Cancelada por usted o por FieldQuo", "—"],
            ],
          } },
        ],
      },
      {
        id: "what-you-are-paying-for",
        heading: "Qué compra el precio, exactamente",
        blocks: [
          { bullets: [
            "**Clientes nuevos y presupuestos nuevos, creados por un superadministrador de FieldQuo dentro de su cuenta.** Nada que ya existiera se actualiza ni se borra jamás.",
            "**Cada escritura queda registrada** — quién, cuándo, qué migración, qué se creó — en la misma transacción que el registro en sí.",
            "**Las escrituras solo son posibles mientras la solicitud está Pagada o En curso**, y eso se vuelve a comprobar en cada escritura, nunca se da por sentado de un momento anterior.",
            "**Ni facturas, ni trabajos, ni una importación automática.** No hay un botón «Importar desde QuickBooks»; una persona lee su exportación y teclea los registros. Las facturas y los trabajos no forman parte del servicio hoy.",
          ] },
        ],
      },
      {
        id: "refunds-and-cancelling",
        heading: "Reembolsos y cancelación",
        blocks: [
          { p: "Antes de pagar, **Cancelar esta solicitud** la termina y no se debe nada. Después de pagar, el botón desaparece: echarse atrás en una migración pagada es una conversación con soporte, y FieldQuo puede cancelarla de su lado; en el momento en que lo hace, la vía de escritura se cierra." },
          { warning: "FieldQuo no emite un reembolso automático cuando se cancela una migración pagada. Si corresponde uno, se hace a mano desde el panel de Stripe. Pídalo en la misma conversación." },
        ],
      },
      {
        id: "who-can-see-it",
        heading: "Quién puede verlo",
        blocks: [
          { p: "El propietario y los administradores: la fila Migración de datos es una pantalla de facturación, protegida igual que Cuenta y facturación, y las acciones de solicitar, aceptar y pagar se rechazan en el servidor para cualquier otro. Lo que se trajo son después datos ordinarios de clientes y presupuestos, visibles para quien pueda ver clientes y presupuestos." },
        ],
      },
    ],
    faq: [
      { q: "¿La migración se cobra a través de mi cuenta de Stripe?", a: "No. Es FieldQuo cobrándole a su empresa, a través de la propia facturación de FieldQuo, como su suscripción. Los pagos de sus clientes y sus transferencias no se tocan." },
      { q: "¿Se escribe algo en mi cuenta antes de que pague?", a: "No. Las escrituras se rechazan hasta que la solicitud está Pagada, y se rechazan de nuevo en el momento en que se cancela o se completa." },
      { q: "¿FieldQuo puede cambiar un presupuesto que ya tenía?", a: "No. El servicio solo crea registros nuevos. Los presupuestos, clientes y facturas existentes nunca son actualizados ni borrados por el personal de FieldQuo." },
    ],
  },

  "taxes-and-currency-on-your-subscription": {
    title: "Impuestos y moneda de su suscripción",
    summary:
      "Por qué una empresa canadiense paga en CAD y una estadounidense en USD, cómo se agrega el impuesto sobre las ventas al cobro de FieldQuo en la página de pago, y por qué nada de eso toca el impuesto de sus propias facturas.",
    updated: "2026-09-12",
    intro: [
      "FieldQuo cobra en **su propia moneda**: dólares canadienses para una empresa en Canadá, dólares estadounidenses para una en Estados Unidos. Los precios de los planes son el mismo número en cada una — Solo es 99 en CAD para un canadiense y 99 en USD para un estadounidense —, así que nadie paga un precio de lista más un tipo de cambio más una comisión de tarjeta. El impuesto sobre las ventas de ese cobro lo calcula Stripe a partir de su dirección de facturación y se agrega en la página de pago.",
      "Este es el cobro de FieldQuo a usted. No tiene nada que ver con el impuesto que usted cobra a sus clientes: ese se configura en **Configuración → Configuración de la empresa** y se aplica a sus presupuestos y facturas, y los dos nunca se cruzan.",
    ],
    sections: [
      {
        id: "overview",
        heading: "Resumen",
        blocks: [
          { p: "Su moneda de facturación se decide una vez, a partir del país de la dirección de su negocio, y cada cobro de FieldQuo en su suscripción va en ella: el plan mensual o anual, la diferencia prorrateada de una subida de plan, una bajada programada. Stripe mantiene una sola moneda por cliente, así que no puede cambiar después sin un nuevo registro de cliente, y por eso la cuadrícula de planes solo le muestra la única fila que corresponde a su dirección." },
        ],
      },
      {
        id: "currency",
        heading: "En qué moneda se le cobra",
        blocks: [
          { table: {
            head: ["Dirección del negocio", "Moneda de facturación", "Se muestra como"],
            rows: [
              ["Canadá", "CAD", "CA$"],
              ["Estados Unidos", "USD", "US$"],
              ["Cualquier otro lugar, o sin dirección todavía", "Sin decidir: la cuadrícula Planes le pide primero agregar la dirección de su negocio", "—"],
            ],
          } },
          { p: "Los cuatro peldaños son 99, 169, 269 y 369 al mes, las mismas cifras en cualquiera de las dos monedas, y un **Compromiso de 1 año** son diez meses por doce — vea [[the-four-plans|Los cuatro planes]] y [[monthly-or-a-year-commitment|Mensual, o un compromiso de un año]]. Si Cuenta y facturación dice que necesita saber dónde está su negocio, pulse **Agregar la dirección de tu negocio**, guarde el país, y vuelva." },
        ],
      },
      {
        id: "sales-tax",
        heading: "Impuesto sobre las ventas en el cobro",
        blocks: [
          { bullets: [
            "**Stripe Tax calcula la tasa** a partir de la dirección de facturación que ingresa en la página de pago, y la agrega como su propia línea: GST/HST/QST para una dirección canadiense, impuesto estatal sobre las ventas donde un estado de EE. UU. lo cobra.",
            "**Se requiere una dirección de facturación** en la página de pago por esa razón, y Stripe la escribe en su registro de cliente para que las renovaciones, que no pasan por la página de pago, se graven de la misma forma.",
            "**Puede ingresar su número fiscal** en la página de pago — un número de empresa de Quebec o de EE. UU. — y aparece en la factura que Stripe emite.",
            "**Un cambio de plan programado conserva la configuración de impuestos** con la que empezó, así que una bajada programada para la fecha de renovación se grava exactamente como el plan que reemplaza.",
          ] },
          { note: "Nada de esto cambia lo que pagan sus clientes. El impuesto de sus presupuestos y facturas sale de su propia configuración de impuestos — vea [[tax-settings|Configuración de impuestos]] y [[sales-tax-on-invoices|Impuesto sobre las ventas en las facturas]] — y se cobra en la moneda de su empresa a través de su propia cuenta de Stripe. El impuesto automático de Stripe deliberadamente no se aplica allí, porque gravaría por segunda vez un total ya gravado." },
        ],
      },
      {
        id: "what-is-not-taxed-here",
        heading: "Otros cobros de FieldQuo",
        blocks: [
          { p: "El crédito telefónico, el crédito de imágenes con IA y el plan mensual de crédito de IA se cobran en **dólares estadounidenses** sea cual sea la moneda de su plan, porque los minutos y la IA se compran en dólares estadounidenses — vea [[ai-credit-and-phone-credit|Crédito de IA y crédito telefónico]]. El plan mensual de crédito de IA no se puede iniciar en una cuenta en CAD por esa razón; las recargas únicas sí. El servicio de migración lo cotiza FieldQuo en la propia solicitud. El impuesto automático de Stripe se aplica a la página de pago de la suscripción y a sus renovaciones; esos otros cobros únicos no pasan por él hoy." },
        ],
      },
      {
        id: "where-to-see-it",
        heading: "Dónde ver la moneda y el impuesto",
        blocks: [
          { steps: [
            "Abra **Configuración → Cuenta y facturación**. La tarjeta del plan muestra su precio en su moneda de facturación, por mes o por año.",
            "Pulse **Gestionar facturación y método de pago**. El portal de Stripe lista cada factura que FieldQuo le ha emitido, cada una con la línea de impuesto y su número fiscal si lo dio — vea [[invoices-and-receipts-from-fieldquo|Facturas y recibos de FieldQuo]].",
          ] },
          { figure: "live:app-settings-account-billing", caption: "Cuenta y facturación — el precio del plan en la moneda de facturación de la empresa, y el botón que abre el portal de Stripe." },
        ],
      },
    ],
    faq: [
      { q: "Mudé mi negocio de Canadá a EE. UU. ¿Mi facturación puede pasar a USD?", a: "No por su cuenta. Stripe mantiene una sola moneda por cliente, así que el cambio necesita un nuevo registro de cliente del lado de FieldQuo: escríbanos." },
      { q: "¿El precio de la página de precios es antes o después de impuestos?", a: "Antes. El impuesto se agrega en la página de pago a partir de su dirección de facturación, en su propia línea, y se muestra en cada factura que Stripe emite." },
      { q: "¿La configuración de impuestos de FieldQuo afecta mis facturas a clientes?", a: "No. Sus facturas usan su propia configuración de impuestos. El cobro de FieldQuo a usted y su cobro a sus clientes son dos ventas separadas en dos integraciones de Stripe separadas." },
    ],
  },

  "closing-your-account": {
    title: "Cerrar su cuenta y sus datos",
    summary:
      "Cancelar detiene el cobro pero conserva cada registro; borrar es una solicitud por escrito que ejecuta una persona en un plazo de 30 días hábiles. Qué hace cada una, cómo pedirla, y qué se conserva de todos modos.",
    updated: "2026-09-12",
    intro: [
      "Dos cosas distintas se confunden fácilmente. **Cancelar** la suscripción termina el cobro y, tras 30 días de solo lectura, bloquea la cuenta, pero eso nunca borra nada. **Borrar** los datos es una solicitud por escrito aparte: no hay un botón en FieldQuo que borre una cuenta, y el borrado no es automático. Una persona en FieldQuo lo ejecuta a mano en un plazo de **30 días hábiles** desde que recibe su solicitud, y usted recibe un correo cuando está hecho.",
      "Este artículo dice cómo pedirlo, qué pasa después de pedirlo, qué puede borrar usted mismo desde el producto hoy, y qué conserva FieldQuo aunque se lo pidan, porque preferimos que lo lea aquí a que lo descubra después.",
    ],
    sections: [
      {
        id: "overview",
        heading: "Resumen",
        blocks: [
          { p: "FieldQuo no tiene una tarea de retención: los registros no se eliminan al cabo de un año, ni nunca, a menos que alguien los borre. Una suscripción vencida o cancelada hace la cuenta inaccesible — nadie puede iniciar sesión una vez que termina la ventana de solo lectura —, pero los presupuestos, facturas, clientes y fotos de fondo quedan intactos, y volver a iniciar un plan lo devuelve todo. Esa es la dirección segura para los registros de un negocio, y por eso borrar es un acto deliberado y aparte." },
          { warning: "El borrado es irreversible. FieldQuo le pedirá confirmar quién es antes de borrar nada — una solicitud desde una dirección que no podemos ubicar es exactamente cómo una persona borra los registros de otra —, y un borrado no se puede deshacer volviendo a iniciar un plan." },
        ],
      },
      {
        id: "cancel-vs-delete",
        heading: "Cancelar frente a borrar",
        blocks: [
          { table: {
            head: ["Qué", "Cancelar la suscripción", "Borrar los datos"],
            rows: [
              ["Cómo", "Cancelar plan en Cuenta y facturación: autoservicio", "Una solicitud por escrito, por correo o por el formulario público Data Deletion del sitio web de FieldQuo"],
              ["Cuándo", "El plan termina de inmediato; solo lectura durante 30 días, luego bloqueada", "Ejecutado a mano en un plazo de 30 días hábiles desde la solicitud"],
              ["Sus registros", "Conservados por completo; vuelve iniciando un plan", "Borrados, salvo lo que lista la sección «Qué se conserva»"],
            ],
          } },
          { p: "Si está cerrando el negocio, haga las dos cosas, en ese orden: cancele primero (vea [[cancel-your-subscription|Cancelar su suscripción]]) para que no se cobre nada más, y luego envíe la solicitud de borrado una vez que haya descargado lo que su contador necesita." },
        ],
      },
      {
        id: "how-to-request-deletion",
        heading: "Cómo solicitar el borrado",
        blocks: [
          { steps: [
            "Descargue primero lo que necesite — la exportación contable y cualquier factura — mientras la cuenta sigue abierta. Una vez borrado, nada se puede recuperar.",
            "Escriba a **hello@fieldquo.com** con el asunto **Data deletion request**, desde la dirección de correo con la que se registró, o use el formulario de la página **Data Deletion** del sitio web de FieldQuo, que registra la misma solicitud y le envía una referencia por correo de inmediato.",
            "Diga a qué empresa de FieldQuo se refiere la solicitud (su negocio de contratista), que usted es el titular de la cuenta, el correo bajo el que está la cuenta, y si quiere borrar todo o algo en concreto.",
            "Guarde la referencia que recibe; se parece a **FQ-DEL-7K3M9Q**. Escribirla en la página Data Deletion muestra si la solicitud está recibida o completada, con las fechas, y nada más.",
          ] },
          { note: "Un cliente suyo — un propietario de vivienda — también puede pedirlo, pero para sus registros la empresa es el responsable y FieldQuo es su encargado del tratamiento. Su vía más rápida es pedírselo a usted, y usted puede borrar su registro desde el producto si no tiene presupuestos ni facturas. Una solicitud que él envíe a FieldQuo sobre sus registros se le remite a usted." },
        ],
      },
      {
        id: "what-happens-next",
        heading: "Qué pasa después",
        blocks: [
          { bullets: [
            "**Recibe una confirmación** en el momento en que se envía el formulario, con la fecha de recepción y su referencia. Si escribió por correo en su lugar, una persona responde con la misma confirmación en un plazo de 30 días.",
            "**Una persona borra los datos a mano**, directamente en la base de datos, en un plazo de 30 días hábiles desde que se recibe la solicitud. Si primero hay que confirmar su identidad, escribimos a la dirección desde la que llegó la solicitud.",
            "**Recibe un segundo correo cuando está hecho**, con la fecha y la referencia. Donde algo tuvo que conservarse, el correo lo dice en lugar de saltárselo en silencio.",
            "**Puede consultarlo en cualquier momento** con la referencia en la página Data Deletion. La línea de estado muestra solo fechas y un estado, nunca quién lo pidió.",
          ] },
        ],
      },
      {
        id: "what-is-kept",
        heading: "Qué se conserva, y por qué",
        blocks: [
          { bullets: [
            "**Los registros de baja y de STOP**, permanentemente. Una exclusión es una instrucción permanente; borrarla devolvería a la persona a una lista.",
            "**Los registros financieros y fiscales** que un negocio suele estar obligado a conservar: facturas, pagos y el rastro contable detrás de ellos. Donde una solicitud eliminaría uno, la respuesta lo dice.",
            "**Los registros que pertenecen al negocio de un contratista y no a la persona que pide.** Donde FieldQuo es solo el encargado, remite la solicitud en lugar de borrar los datos de una empresa por instrucción de un tercero.",
            "**El registro de la propia solicitud de borrado**: la referencia, la dirección a la que fue la confirmación, y las fechas. Es la prueba de que usted lo pidió y de que se hizo.",
          ] },
        ],
      },
      {
        id: "what-you-can-delete-yourself",
        heading: "Qué puede borrar usted mismo, hoy",
        blocks: [
          { bullets: [
            "**Un registro de cliente**, solo si ese cliente no tiene presupuestos ni facturas. Uno con historial de facturación se rechaza, porque borrarlo dejaría huérfanos registros financieros que quizá deba conservar.",
            "**Presupuestos, facturas, trabajos, tareas, citas, gastos, fotos, campañas de marketing y registros de suscriptores individuales**, cada uno desde su propia pantalla, según su nivel de acceso.",
            "**Una cuenta publicitaria de Meta conectada**: **Configuración → Meta Ads → Desconectar** borra la conexión guardada por completo, token cifrado incluido. Los totales de gasto importados se quedan, porque son su historial de marketing; dígalo en una solicitud por escrito si quiere que también desaparezcan.",
          ] },
          { p: "Cualquier cosa más allá de eso — una cuenta entera incluida — es la solicitud por escrito de arriba, gestionada por una persona." },
        ],
      },
    ],
    faq: [
      { q: "¿Hay un botón para borrar mi cuenta?", a: "No. El borrado es una solicitud por escrito, ejecutada a mano en un plazo de 30 días hábiles, y confirmada por correo. Cancelar el plan es autoservicio; borrar los datos no." },
      { q: "Si cancelo y nunca vuelvo, ¿mis datos se borran en algún momento?", a: "No. Nada vence según un calendario. La cuenta se vuelve inaccesible tras la ventana de solo lectura de 30 días, pero los registros se quedan hasta que alguien pide que se borren." },
      { q: "¿Puedo obtener una copia de todo antes de que se borre?", a: "Descargue la exportación contable y sus facturas mientras la cuenta está abierta; tras la ventana de solo lectura la cuenta queda bloqueada y tras el borrado nada se puede recuperar. Volver a iniciar el plan durante la ventana la reabre." },
    ],
  },
};
