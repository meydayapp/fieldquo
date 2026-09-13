// content/help/es/messages-2.js
//
// Parte 2 de la categoría «messages» en español (ver el compositor,
// messages.js). Slugs de esta parte (lib/help/tree.js):
// follow-up-rules, notifications-for-you, send-from-your-own-domain,
// the-phone-receptionist, the-receptionist-call-log, quote-callbacks,
// the-crew-inbox, team-chat, texting-clients-what-is-and-is-not-automated.
//
// Misma estructura que el inglés (mismas secciones, mismos bloques, mismas
// figuras); las palabras en pantalla vienen del bloque `es` de
// app/i18n/appMessages.js. Las cifras son las constantes del código (35¢ por
// minuto, $4 y $9 de renta, 2¢ por mensaje, 5¢ por foto, 30 minutos gratis).
export const ARTICLES = {
  "follow-up-rules": {
    title: "Reglas de seguimiento",
    summary:
      "Dar seguimiento por correo a un presupuesto sin respuesta, una factura vencida o un trabajo terminado, automáticamente, con el retraso que usted elija — y qué detiene cada regla.",
    updated: "2026-09-12",
    intro: [
      "Una regla de seguimiento cabe en una frase: cierto tiempo después de que un presupuesto, una factura o un trabajo alcance un estado determinado, enviar esta plantilla de correo. FieldQuo revisa cada regla activa una vez al día y envía la plantilla al cliente de todo lo que haya cruzado la línea — un presupuesto enviado hace tres días, una factura vencida hace cinco, un trabajo completado hace dos — sin que nadie tenga que acordarse.",
      "Este artículo cubre la pantalla **Configuración → Seguimientos**: los tres desencadenantes, el retraso, qué plantillas puede enviar una regla, qué la pausa y qué la detiene, y quién no recibe nada.",
    ],
    sections: [
      {
        id: "overview",
        heading: "Resumen",
        blocks: [
          { p: "Cada regla envía exactamente una cosa por un solo canal: una plantilla de correo. No hay seguimiento por mensaje de texto ni tarea dentro de la aplicación — la pantalla dibuja un único paso **Enviar correo** porque es el único paso que existe. Dos reglas pueden compartir un desencadenante (un recordatorio suave a los 3 días y uno más firme a los 7), cada una apuntando a una plantilla distinta, y cada presupuesto, factura o trabajo recibe el correo de cada regla una sola vez." },
          { p: "El correo sale a nombre de su empresa — desde su propio dominio verificado si tiene uno (ver [[send-from-your-own-domain|Enviar correo desde su propio dominio]]), y si no desde la dirección compartida de FieldQuo — y las respuestas llegan al correo de su empresa, o en su defecto a la dirección del propietario de la cuenta, para que ninguna respuesta se pierda." },
        ],
      },
      {
        id: "on-the-screen",
        heading: "Qué hay en la pantalla",
        blocks: [
          { p: "La página se titula **Seguimientos** — «Envía automáticamente una plantilla un tiempo determinado después de que una cotización, factura o trabajo alcance cierto estado, sin recordatorios manuales.» De arriba abajo:" },
          { bullets: [
            "**Cómo se ejecutan** — un esquema de solo lectura generado a partir de sus reglas: **Desencadenante** → **Esperar …** → **Enviar correo** → **Se detiene**. Se genera desde la lista, no se dibuja a mano, así que no puede contradecir lo que hacen las reglas. Aparece solo cuando tiene al menos una regla.",
            "La lista de reglas — una fila por regla: su nombre, luego «3 días **después de** Cotización enviada, sin respuesta → Follow-up email (default)», y las dos frases de salida («Se detiene en cuanto el cliente acepta o rechaza la cotización.» «Cada cotización recibe este correo una sola vez.»). Una regla pausada lleva la etiqueta **En pausa**.",
            "**Pausar** / **Activar** y el icono de papelera en cada fila. Pausar conserva la regla y la omite; eliminar la quita.",
            "**Nueva regla** arriba a la derecha — atenuado, con una explicación, hasta que tenga al menos una plantilla de correo de seguimiento, marketing o personalizada que enviar.",
          ] },
        ],
      },
      {
        id: "create-a-rule",
        heading: "Cómo crear una regla",
        blocks: [
          { steps: [
            "Abra **Configuración → Seguimientos** y pulse **Nueva regla**. Si el botón está desactivado, la línea amarilla de arriba dice por qué: primero necesita una plantilla de seguimiento, marketing o personalizada en **Plantillas de correo**. Toda empresa nueva ya tiene una plantilla «Follow-up email (default)», así que es raro.",
            "Póngale un **Nombre de la regla (opcional)** — si lo deja vacío, la regla toma el nombre del desencadenante.",
            "Elija el **Desencadenante**: **Cotización enviada, sin respuesta**, **Factura vencida** o **Trabajo completado**. La frase bajo la lista dice exactamente cuándo se dispara cada uno.",
            "Fije el **Retraso** y su **Unidad** (horas o días). Al elegir un desencadenante se rellena su valor por defecto — 3 días para un presupuesto, 5 días para una factura, 2 días para un trabajo completado — y usted puede cambiarlo.",
            "Elija la **Plantilla a enviar** y pulse **Crear regla**. La regla queda activa de inmediato y el esquema sobre la lista se vuelve a dibujar.",
          ] },
          { figure: "live:app-settings-follow-ups", caption: "Configuración → Seguimientos — el esquema Cómo se ejecutan generado desde las reglas, y luego la lista de reglas con Pausar y la papelera en cada fila." },
          { note: "Los nombres de los desencadenantes en la lista desplegable — Quote sent, no response; Invoice overdue; Job completed — se muestran en inglés sea cual sea su idioma de trabajo. El esquema y la lista de reglas sí los traducen." },
        ],
      },
      {
        id: "what-each-setting-changes",
        heading: "Qué cambia cada ajuste",
        blocks: [
          { table: {
            head: ["Ajuste", "Qué cambia"],
            rows: [
              ["**Desencadenante**", "Qué registros vigila la regla y qué cuenta como cruzar la línea: un presupuesto que sigue en estado enviado, una factura impaga pasada su fecha de vencimiento, o un trabajo marcado como completado (desde el momento en que se completó, no desde su última edición)."],
              ["**Retraso** y **Unidad**", "Cuánto tiempo debe llevar el registro en ese estado antes de que salga el correo. Todo lo que no sea horas se trata como días."],
              ["**Plantilla a enviar**", "El correo que recibe el cliente. Solo se ofrecen plantillas de seguimiento, marketing y personalizadas — nunca las de presupuesto, instrucciones o recibo, que son envíos puntuales. Si la plantilla se elimina después, la fila muestra **(plantilla eliminada)** y la regla no envía nada."],
              ["**Pausar**", "La regla se conserva y se omite. El esquema marca el paso «En pausa: este paso se omite.» **Activar** la vuelve a encender; lo que haya cruzado la línea mientras tanto se atiende en la siguiente ejecución."],
              ["Eliminar (papelera)", "Quita la regla. Los correos ya enviados siguen enviados, pero una regla creada de nuevo es una regla nueva y no recuerda a quién escribió la eliminada — un presupuesto que siga en estado enviado recibiría otro seguimiento. Mejor pausar si puede querer recuperarla."],
            ],
          } },
        ],
      },
      {
        id: "how-they-run",
        heading: "Cuándo se ejecutan y qué las detiene",
        blocks: [
          { p: "La revisión se hace una vez al día, así que una regla fijada en 3 días envía en la primera ejecución después del tercer día, no a la hora exacta. En cada ejecución, para cada regla activa, FieldQuo busca todos los registros que coinciden y aún no han recibido el correo de esa regla, lo envía y lo anota — por eso una regla nunca puede enviar dos veces para el mismo presupuesto, factura o trabajo, aunque dos ejecuciones se solapen." },
          { bullets: [
            "**Cotización enviada, sin respuesta** se detiene en cuanto el cliente acepta o rechaza el presupuesto. Cada presupuesto recibe el correo una sola vez.",
            "**Factura vencida** se detiene en cuanto se paga la factura. Cada factura recibe el correo una sola vez.",
            "**Trabajo completado** se detiene si el trabajo se reabre. Cada trabajo recibe el correo una sola vez.",
          ] },
          { note: "Se omiten los clientes sin dirección de correo registrada. Los trabajos, presupuestos y facturas importados como historial nunca reciben seguimiento — una regla creada hoy sí alcanza los presupuestos reales del mes pasado, pero no un trabajo de 2024 que usted registró para la contabilidad." },
          { tip: "Un seguimiento de **Trabajo completado** es marketing en el sentido legal (un agradecimiento, una solicitud de reseña), así que lleva un enlace para darse de baja y no se envía a quien se haya dado de baja de sus correos de marketing. Los seguimientos de presupuesto y de factura tratan de una transacción ya en curso con el cliente y no llevan enlace de baja." },
        ],
      },
      {
        id: "who-can-see-it",
        heading: "Quién puede verlo",
        blocks: [
          { p: "El propietario, los administradores y cualquier persona con nivel Despachador o Gerente pueden abrir **Configuración → Seguimientos** y crear, pausar o eliminar reglas. Los accesos de Cuadrilla y Estimador no ven la fila. Vea [[team-and-access|Equipo y acceso]] para saber cómo se definen los niveles." },
        ],
      },
    ],
    faq: [
      { q: "Creé una regla hace una hora y no se envió nada. ¿Está rota?", a: "Probablemente no — la revisión se hace una vez al día. Un presupuesto que cruzó el retraso esta tarde recibe su correo en la ejecución del día siguiente." },
      { q: "¿Puede una regla enviar un mensaje de texto en lugar de un correo?", a: "No. Cada regla envía una plantilla de correo y nada más. Los dos mensajes de texto que sus clientes pueden recibir son el de «en camino» y el recordatorio de cita — vea [[texting-clients-what-is-and-is-not-automated|Mensajes de texto a clientes: qué es automático y qué no]]." },
      { q: "¿Recibirá un cliente el mismo seguimiento dos veces si pauso la regla y la reactivo?", a: "No. FieldQuo anota cada par (regla, registro) al que ya escribió, y un registro en esa lista nunca vuelve a recibir correo de esa regla, sin importar cuántas veces la pause y la reactive. Eliminar y volver a crear la regla es distinto: la regla nueva empieza con la lista vacía." },
    ],
  },

  "notifications-for-you": {
    title: "Notificaciones para usted: correo y navegador",
    summary:
      "Las tres alertas que FieldQuo puede enviar por correo al propietario, el ajuste del mensaje de recordatorio de cita que vive en la misma pantalla, y las notificaciones del navegador, por persona y por navegador.",
    updated: "2026-09-12",
    intro: [
      "**Configuración → Notificaciones** trata de lo que FieldQuo le dice a *usted* — a diferencia de los correos de presupuesto, recibo y seguimiento que reciben sus clientes, que se configuran en Plantillas de correo y Seguimientos. Contiene dos alertas por correo para el propietario y los administradores, la antelación del mensaje de recordatorio que sus clientes reciben antes de una cita, y un interruptor para las notificaciones del sistema en su propio navegador.",
      "Cada tarjeta de la página es honesta sobre su estado: una alerta nunca configurada lo dice, y la tarjeta del navegador dice si las notificaciones pueden llegarle con la pestaña cerrada o solo mientras haya una pestaña de FieldQuo abierta.",
    ],
    sections: [
      {
        id: "overview",
        heading: "Resumen",
        blocks: [
          { p: "Aquí viven dos tipos de cosas. Las tres primeras tarjetas son reglas de toda la empresa — un ajuste para todos, que cambia un propietario o un administrador. La tarjeta **Notificaciones del navegador** es personal: decide si *este* navegador, en *este* ordenador o teléfono, suena para usted, y cada miembro la configura por su cuenta." },
        ],
      },
      {
        id: "on-the-screen",
        heading: "Qué hay en la pantalla",
        blocks: [
          { bullets: [
            "**Cotización grande creada** — «Envía un correo a todos con rol de propietario o administrador cuando alguien de tu equipo redacta una cotización superior a este monto.» Una casilla **Enviar esta alerta**, un monto en **Avisarme por encima de**, y **Guardar**. Hasta que se guarde una vez muestra «Aún no configurado: no se envía ninguna alerta.»",
            "**Factura pagada** — «Envía un correo a todos con rol de propietario o administrador cuando un cliente paga una factura en línea. Activado de forma predeterminada.» Una sola casilla, guardada en cuanto la marca.",
            "**Recordatorios de cita** — «Envía al cliente un recordatorio por mensaje antes de su cita.» Cuatro botones: **Desactivado**, **2 horas antes**, **24 horas antes**, **48 horas antes**. Este es un mensaje de texto a su *cliente*, no un correo para usted; está aquí porque es el único ajuste de recordatorio de la empresa.",
            "**Notificaciones del navegador** — «Avisarme en este navegador», el estado del permiso del navegador, si el push con la pestaña cerrada está disponible, y **Enviar una notificación de prueba**.",
            "**Correos para clientes** — una referencia: lo que dicen esos correos está en **Plantillas de correo**, y cuándo se envían está en **Seguimientos**.",
          ] },
        ],
      },
      {
        id: "email-alerts",
        heading: "Cómo configurar las alertas por correo",
        blocks: [
          { steps: [
            "Abra **Configuración → Notificaciones**.",
            "En **Cotización grande creada**, marque **Enviar esta alerta**, escriba el monto en **Avisarme por encima de** (la casilla sugiere 10000) y pulse **Guardar**. El monto debe ser mayor que cero.",
            "En **Factura pagada**, deje la casilla marcada para conservar la alerta, o desmárquela para detener los correos. Se guarda sola.",
            "En **Recordatorios de cita**, pulse la antelación que quiera. Se guarda en cuanto la pulsa, y el botón queda relleno.",
          ] },
          { figure: "live:app-settings-notifications", caption: "Configuración → Notificaciones — Cotización grande creada con su umbral, Factura pagada, los cuatro botones de Recordatorios de cita y la tarjeta del navegador." },
          { table: {
            head: ["Alerta", "Quién la recibe", "Cuándo"],
            rows: [
              ["Cotización grande creada", "Todos con rol de propietario o administrador, por correo", "Se revisa en un horario diario, no en el instante en que se guarda el presupuesto — espere el correo dentro de un día. Un presupuesto por debajo del monto no envía nada."],
              ["Factura pagada", "Todos con rol de propietario o administrador, por correo", "Cuando un cliente paga una factura en línea con el botón Pagar o desde el portal. Un pago que usted registra a mano (efectivo, cheque, transferencia) no la dispara."],
              ["Recordatorios de cita", "Su cliente, por mensaje de texto, con el nombre de su empresa", "Se revisa cada hora; el mensaje sale en cuanto la cita entra en la antelación elegida — una vez por cita, nunca a un cliente que se dio de baja, y solo a un cliente con número de teléfono."],
            ],
          } },
          { note: "El mensaje de recordatorio va a las citas de su Calendario — una reserva desde su página de reservas, una que tomó el recepcionista, o una que usted añadió con **Nueva cita**. Una visita programada en un trabajo es un registro distinto y no recibe recordatorio por mensaje. La redacción del mensaje se edita en **Configuración → Mensajes de clientes**." },
        ],
      },
      {
        id: "browser-notifications",
        heading: "Notificaciones del navegador",
        blocks: [
          { p: "Active **Avisarme en este navegador** y el navegador pide permiso una sola vez. Desde entonces, mientras haya una pestaña de FieldQuo abierta en segundo plano, la actividad nueva llega como notificación del sistema en la esquina de su pantalla; con la pestaña al frente es un aviso pequeño. Donde el push esté configurado en la instalación, la tarjeta dice «Activado. Se te avisará aquí y con la pestaña cerrada.» — si no, «Activado. Se te avisará mientras haya una pestaña de FieldQuo abierta.» La tarjeta le dice cuál, y nunca promete más de lo que puede." },
          { bullets: [
            "El historial de actividad tras el icono de campana — un presupuesto aceptado, una factura pagada, un prospecto nuevo, un pago disputado, un presupuesto que no pudo entregarse, una solicitud de permiso.",
            "Un mensaje nuevo de un cliente en la bandeja **Mensajes** (Facebook, Instagram, WhatsApp), para quien tenga permiso de leer esa bandeja.",
            "En **Chat**: un mensaje directo para usted, y cualquier mensaje que lo @mencione.",
          ] },
          { note: "En iPhone y iPad, añada primero FieldQuo a la pantalla de inicio — Safari solo entrega notificaciones a las apps web instaladas. Si el navegador bloqueó las notificaciones del sitio, la tarjeta lo dice y nada queda activado hasta que las permita en la configuración del propio navegador." },
          { tip: "Pulse **Enviar una notificación de prueba** tras activarlo. Muestra una notificación «Prueba de FieldQuo» en este navegador y, donde el push esté activo, envía una a cada navegador en el que lo haya activado — la prueba más rápida de que su teléfono vibrará." },
        ],
      },
      {
        id: "who-can-see-it",
        heading: "Quién puede verlo",
        blocks: [
          { p: "Solo el propietario y los administradores — las tres reglas de la empresa son suyas, y la fila está oculta para los demás. El interruptor del navegador es por persona, así que un propietario que lo active no hace nada por el teléfono de un compañero; cada miembro lo activa en su propio navegador." },
        ],
      },
    ],
    faq: [
      { q: "¿Por qué nadie recibió el correo de cotización grande cuando redacté un presupuesto de $40,000 esta mañana?", a: "La revisión sigue un horario diario, así que el correo llega dentro de un día, no al instante. Compruebe también que la alerta muestre un monto guardado y no «Aún no configurado»." },
      { q: "¿Puedo recibir un correo cuando entra un prospecto nuevo, o cuando se acepta un presupuesto?", a: "No por correo desde esta pantalla. Eso llega al historial de actividad tras la campana, y como notificación del navegador si la activa." },
      { q: "¿El mensaje de recordatorio cuesta algo?", a: "La tarjeta dice que cada recordatorio es un mensaje de texto que se cobra a su cuenta, enviado con el nombre de su empresa, nunca más de una vez por cita y nunca a un cliente que se dio de baja." },
    ],
  },

  "send-from-your-own-domain": {
    title: "Enviar correo desde su propio dominio",
    summary:
      "Verifique un subdominio una vez y cada presupuesto, factura, recibo y seguimiento saldrá desde quotes@su-dominio en lugar de la dirección compartida de FieldQuo — y a dónde llegan las respuestas.",
    updated: "2026-09-12",
    intro: [
      "Hasta que conecte un dominio, los correos que reciben sus clientes salen desde la dirección compartida de FieldQuo con el nombre de su empresa. Funciona, pero la aplicación de correo del cliente puede mostrar «via fieldquo.com» junto a su nombre. **Configuración → Dominio de correo** le permite demostrar que es dueño de un dominio añadiendo unos registros DNS; desde entonces cada correo a clientes sale desde una dirección de ese dominio, y nada en el sobre dice FieldQuo.",
      "Nada aquí crea un buzón. La dirección del remitente no necesita existir como bandeja de entrada — la verificación del dominio es lo que concede el permiso de enviar en su nombre. Las respuestas se manejan aparte, con el correo de su empresa.",
    ],
    sections: [
      {
        id: "overview",
        heading: "Resumen",
        blocks: [
          { p: "La pantalla se titula **Dominio de correo** — «Envía los correos a los clientes desde tu propio dominio en lugar del nuestro. Mejor entregabilidad y sin “via fieldquo.com” junto a tu nombre.» Registra el dominio con el proveedor de correo de FieldQuo, le muestra los registros DNS que debe añadir en su registrador, y vuelve a comprobar la verificación sola cada 30 segundos. Cuando el estado dice **Verificado**, cada envío del producto — presupuestos, facturas, recibos, reglas de seguimiento, solicitudes de reseña, campañas de marketing — usa la nueva dirección sin ningún ajuste adicional." },
          { note: "Use un subdominio como **send.suempresa.com** en lugar de su dominio raíz. Así se mantiene separado de su correo habitual y no puede interferir con la bandeja que ya tiene." },
        ],
      },
      {
        id: "on-the-screen",
        heading: "Qué hay en la pantalla",
        blocks: [
          { bullets: [
            "El estado actual: **Ningún dominio conectado** con «Tus correos se envían actualmente desde la dirección compartida de FieldQuo, usando el nombre de tu empresa.» — o el dominio con su etiqueta de estado (**Verificado**, **Esperando el DNS**, **Verificación fallida**, **Sin configurar**), **Comprobar verificación** y **Desconectar**.",
            "**Conectar un dominio** — una casilla para el subdominio y un botón **Conectar**.",
            "**Agrega estos registros DNS** — una tabla de Tipo, Nombre, Valor (y Prioridad y TTL cuando aplican), cada uno con **Copiar valor**, más cinco instrucciones numeradas sobre dónde ponerlos.",
            "**Dirección del remitente** — la parte antes de la @ de la dirección que ven los clientes (quotes por defecto), con «Los correos se enviarán desde quotes@send.suempresa.com» debajo y **Guardar**.",
            "**Respuestas** — una frase que dice a dónde va la respuesta de un cliente a un presupuesto o una factura.",
          ] },
        ],
      },
      {
        id: "connect-a-domain",
        heading: "Cómo conectar un dominio",
        blocks: [
          { steps: [
            "Abra **Configuración → Dominio de correo**, escriba un subdominio como send.suempresa.com en **Conectar un dominio** y pulse **Conectar**.",
            "Inicie sesión donde compró el dominio — GoDaddy, Namecheap, Cloudflare, Google Domains. Ese es su proveedor de DNS; si no está seguro, suele ser quien le cobra cada año por el nombre de dominio.",
            "Busque **DNS**, **Registros DNS** o **Administrar DNS**, y añada un registro nuevo por cada bloque de la pantalla, respetando exactamente Tipo, Nombre y Valor. Use **Copiar valor** — los valores TXT son largos.",
            "Guarde en el proveedor y déjelo. La mayoría aplica los cambios en una hora; algunos tardan hasta 24. La página vuelve a comprobar sola cada 30 segundos, y **Comprobar verificación** pregunta ahora mismo.",
            "Cuando la etiqueta diga **Verificado**, fije la **Dirección del remitente** si quiere algo distinto de quotes (facturas, hola, oficina) y pulse **Guardar**.",
            "Envíese un presupuesto y mire la línea De: el nombre de su empresa, su dirección, ningún «via».",
          ] },
          { figure: "live:app-settings-email-domain", caption: "Configuración → Dominio de correo — el dominio conectado con su estado Verificado y Desconectar, la dirección del remitente, y a dónde van las respuestas." },
          { warning: "Preste atención al campo **Nombre**. La mayoría de los proveedores agregan su dominio automáticamente: si el Nombre mostrado es send._domainkey.example.com, normalmente solo ingresa send._domainkey. Terminar con send._domainkey.example.com.example.com es el error más común, y se queda en **Esperando el DNS** para siempre." },
        ],
      },
      {
        id: "what-each-control-changes",
        heading: "Qué significa cada estado y cada control",
        blocks: [
          { table: {
            head: ["En la pantalla", "Qué significa"],
            rows: [
              ["**Verificado**", "Sus correos a clientes salen desde la dirección del remitente en su dominio, a nombre de su empresa. No hay nada más que activar."],
              ["**Esperando el DNS** / **Verificación fallida**", "Todavía no sale nada desde su dominio; los correos siguen saliendo desde la dirección compartida de FieldQuo con su nombre. Revise los registros — casi siempre el campo Nombre — y espere a que el proveedor los aplique."],
              ["**Dirección del remitente**", "Solo la parte antes de la @. Cambia lo que los clientes ven en la línea De y nada más; no tiene que ser un buzón real."],
              ["**Desconectar**", "Sus correos vuelven a salir desde la dirección compartida de FieldQuo con el nombre de su empresa. La pantalla pide confirmación primero."],
            ],
          } },
        ],
      },
      {
        id: "replies",
        heading: "A dónde van las respuestas",
        blocks: [
          { p: "Cuando un cliente responde a un presupuesto o una factura, la respuesta va al **correo de la empresa** definido en **Configuración de la empresa**. Si no hay correo de empresa configurado, va al correo de inicio de sesión del propietario de la cuenta — para que la respuesta de un cliente nunca se pierda en un buzón que nadie lee. La línea **Respuestas** de esta pantalla le dice cuál de los dos está en vigor." },
          { tip: "Ponga como correo de la empresa la bandeja que su oficina realmente revisa. La dirección del remitente en su dominio nunca es la dirección de respuesta — no necesita existir — así que una respuesta que llegara allí se evaporaría." },
        ],
      },
      {
        id: "who-can-see-it",
        heading: "Quién puede verlo",
        blocks: [
          { p: "El propietario, los administradores y cualquier persona con nivel Despachador o Gerente pueden abrir **Configuración → Dominio de correo** y conectar, verificar o desconectar un dominio. Los accesos de Cuadrilla y Estimador no ven la fila." },
        ],
      },
    ],
    faq: [
      { q: "¿Necesito crear quotes@send.miempresa.com como buzón?", a: "No. La verificación del dominio es lo que permite a FieldQuo enviar desde esa dirección. Las respuestas van al correo de su empresa, no a la dirección del remitente." },
      { q: "Lleva un día diciendo Esperando el DNS. ¿Y ahora?", a: "Abra los registros en su proveedor de DNS y compare Tipo, Nombre y Valor con la pantalla, carácter por carácter. Nueve de cada diez veces el proveedor duplicó su dominio en el campo Nombre. Corríjalo, guarde, y la página detecta el cambio en su siguiente comprobación de 30 segundos." },
      { q: "¿Cambia algo más una vez verificado el dominio?", a: "Solo la línea De. El contenido, la marca, el idioma y el momento de envío de cada correo siguen exactamente igual." },
    ],
  },

  "the-phone-receptionist": {
    title: "El recepcionista telefónico",
    summary:
      "Un recepcionista con IA en un número local: qué hace durante una llamada, cómo configurarlo en siete tarjetas, qué cambia cada control, cuánto cuesta un minuto, y qué no aparece en ninguna otra página de precios.",
    updated: "2026-09-12",
    intro: [
      "El recepcionista telefónico contesta las llamadas que usted no puede, toma los datos de quien llama, agenda una visita según su disponibilidad real y le deja la grabación, la transcripción y — cuando quien llamó dijo lo suficiente — un borrador de presupuesto. Habla el idioma de su empresa (inglés, francés o español) y cambia al de quien llama si habla otro. Nunca da un precio, nunca promete una hora que no ha verificado y nunca afirma ser una persona.",
      "Este artículo es la pantalla **Configuración → Recepcionista telefónico**: el número, el crédito, las palabras, el interruptor y la comprobación de principio a fin. Lo que hizo con cada llamada está en la pantalla Recepcionista de la barra lateral principal — vea [[the-receptionist-call-log|El registro de llamadas del recepcionista]].",
    ],
    sections: [
      {
        id: "overview",
        heading: "Resumen",
        blocks: [
          { p: "La pantalla se titula **Recepcionista telefónica** — «Contesta las llamadas que no puedes, toma los datos y agenda visitas según tu disponibilidad real. Nunca da un precio.» Sigue el orden de las decisiones: crédito, luego un número, luego lo que dice, luego el interruptor. Una empresa nueva ve las tarjetas numeradas del 1 al 7; terminada la configuración, los números desaparecen y quedan las mismas tarjetas." },
          { p: "Durante una llamada, el recepcionista lee sus horas de apertura, sus servicios activados y sus zonas de servicio desde su configuración, más la nota que usted escribe para él. Para agendar, ofrece huecos libres reales de su disponibilidad de reservas; si sus visitas tienen tarifa, o su línea está configurada para devoluciones de llamada, lo dice y toma horas preferidas o lee en voz alta el enlace de reservas — no puede enviarlo por mensaje." },
          { note: "Todo lo que el recepcionista puede gastar lo calcula el servidor y se imprime en esta pantalla antes de que usted se comprometa. El navegador nunca envía un monto." },
        ],
      },
      {
        id: "on-the-screen",
        heading: "Qué hay en la pantalla",
        blocks: [
          { bullets: [
            "**Crédito** — el saldo, «35¢ por minuto, redondeado hacia arriba, mínimo un minuto», **Añadir crédito**, el extracto de a dónde fue el crédito, y la tarjeta **Recargar automáticamente** con una tarjeta guardada y un umbral.",
            "**Tu número** — tres formas de tener uno: **Conservar mi número y desviar las llamadas perdidas** (recomendada, dos minutos), **Conseguir un número nuevo**, o **Trasladar mi número** (de dos a cuatro semanas, al ritmo de su antiguo operador). Un número comprado muestra **Se desvía a** y un enlace **Devolver el …**.",
            "**Lo que dice** — el **Saludo**, la nota de conocimiento con **Responde esto con tus propias palabras** y **Redactar esto desde el perfil de mi empresa**, la **Voz** con las vistas previas **Escuchar a …**, y los ajustes de **Cómo suena**.",
            "**Contestar mis llamadas** — el único interruptor: **Empezar a contestar llamadas** / **Está contestando — desactivar**. Se niega a encenderse sin un número y sin crédito para al menos un minuto.",
            "**Devolver llamadas a los clientes automáticamente** — la mitad saliente: **Activar las devoluciones de llamada de presupuestos**, y luego **Qué presupuestos reciben una llamada**. Se explica en [[quote-callbacks|Devoluciones de llamada por presupuestos]].",
            "**Permite que el equipo envíe fotos y novedades por mensaje** — un enlace a la bandeja del equipo, que usa una línea de mensajes aparte. Se explica en [[the-crew-inbox|La bandeja del equipo]].",
            "**Comprobarlo de principio a fin** — le pregunta al propio servicio telefónico por cada eslabón entre que alguien marca y que un prospecto llega a FieldQuo.",
          ] },
        ],
      },
      {
        id: "set-it-up",
        heading: "Cómo configurarlo",
        blocks: [
          { steps: [
            "Abra **Configuración → Recepcionista telefónico**. En **Crédito**, pulse **Añadir crédito** si el saldo está vacío — su primer número viene con 30 minutos de crédito gratis, y de ahí sale el primer mes de renta del número.",
            "En **Tu número**, elija **Conservar mi número y desviar las llamadas perdidas** salvo que tenga una razón para no hacerlo. FieldQuo renta una línea en la que contesta el recepcionista y le muestra el código de desvío para marcar desde su propio teléfono; sus clientes siguen marcando el número de la camioneta, y las llamadas que usted no atiende suenan en el recepcionista en lugar del buzón de voz.",
            "En **Lo que dice**, escriba el **Saludo** (el ejemplo es «Thanks for calling, how can I help?») y pulse **Redactar esto desde el perfil de mi empresa** — lee su perfil y lista las preguntas que no puede responder solo (qué trabajos rechaza, qué cuenta como urgente, qué decir cuando está cerrado). Escriba sobre cada corchete; una línea que quede entre corchetes se omite.",
            "Elija una **Voz** y escúchela con **Escuchar a …**. Deje **Cómo suena** en sus valores por defecto salvo que a quienes llaman los corte a media frase.",
            "Pulse **Empezar a contestar llamadas**. La barra de estado de arriba muestra su número con un punto verde, y el interruptor ahora dice **Está contestando — desactivar**.",
            "Pulse **Comprobarlo de principio a fin** y luego llame a su propio número. Cada eslabón debe aparecer como superado; una llamada puede contestarse perfectamente y aun así nunca llegar a FieldQuo, y esta es la tarjeta que lo dice.",
          ] },
          { figure: "live:app-settings-voice", caption: "Configuración → Recepcionista telefónico — el número con su interruptor de contestar, la tarjeta de crédito con las recargas, y las tarjetas de saludo, conocimiento, voz y ajustes." },
        ],
      },
      {
        id: "what-each-control-changes",
        heading: "Qué cambia cada control",
        blocks: [
          { table: {
            head: ["Control", "Qué cambia"],
            rows: [
              ["**Conservar mi número y desviar las llamadas perdidas**", "Renta una segunda línea en la que contesta el recepcionista. Su propio número no se toca; usted configura el desvío condicional en su teléfono con el código mostrado, y puede quitarlo del mismo modo — marcando ##002# — en menos de un minuto."],
              ["**Conseguir un número nuevo** / **Elegir el número tú mismo**", "Compra una línea aparte en el código de área que elija. Útil para anuncios o un segundo oficio; no atrapará las llamadas al número que ya anuncia. Elegir uno lo compra al instante y el primer mes sale de su crédito."],
              ["**Trasladar mi número**", "Inicia una portabilidad. No se cobra nada al empezar y su número sigue funcionando con su antiguo operador hasta que se complete el traslado; el recepcionista no puede contestar en él hasta entonces."],
              ["**Saludo** y la nota de conocimiento", "Lo primero que oye cada persona que llama, y los datos que el recepcionista puede usar más allá de su configuración. Las horas de apertura, los servicios y las zonas se leen de su configuración en cada llamada y ahí es donde van, no en la nota."],
              ["**Voz** y **Cómo suena**", "Qué voz habla, y cuatro ajustes: qué hace si quien llama le habla encima, desde dónde suelen llamar sus clientes, con qué rapidez responde, cómo se presenta."],
              ["**Contestar mis llamadas**", "Si el número se contesta o no. Desactivarlo detiene la respuesta al instante — si el número está en su camioneta, desvíelo antes, porque quien llame podría oír un tono de ocupado en vez de un tono de llamada."],
              ["**Recargar automáticamente**", "Desactivado hasta que usted lo active. Guarda una tarjeta y, cuando el saldo baja del umbral, cobra el monto mostrado y añade el crédito — como máximo un número fijado de veces al día. Se apaga solo y se lo dice si la tarjeta es rechazada."],
              ["**Devolver el …**", "Devuelve un número comprado para siempre. Se elimina en la compañía telefónica y no puede recuperarse; la renta mensual se detiene y el resto del mes ya pagado no se reembolsa."],
            ],
          } },
        ],
      },
      {
        id: "what-it-costs",
        heading: "Cuánto cuesta",
        blocks: [
          { p: "El recepcionista funciona con crédito prepagado, en dólares estadounidenses, y cada cargo está en el extracto bajo **Crédito**. Las llamadas se miden por minuto; los números se rentan por mes; ambos salen del mismo saldo, igual que la línea de mensajes del equipo." },
          { bullets: [
            "**35¢ por minuto**, redondeado hacia arriba, mínimo un minuto — entrantes y salientes por igual. Un número gratuito añade 5¢ por minuto.",
            "**$4 al mes** por un número local, **$9 al mes** por uno gratuito (800/833/844). El primer mes se cobra al comprar el número.",
            "**30 minutos de crédito gratis** con su primer número, para que el recepcionista pueda empezar a contestar antes de su primera recarga.",
          ] },
          { note: "Cuando el crédito baja, la pantalla lo dice, y cuando se acaba el recepcionista deja de contestar — que es exactamente lo que **Recargar automáticamente** existe para evitar." },
        ],
      },
      {
        id: "only-in-fieldquo",
        heading: "Qué es distinto aquí",
        blocks: [
          { p: "Otras herramientas para contratistas también venden un recepcionista con IA, así que contestar no es la diferencia. En las páginas de precios con las que FieldQuo se compara — Jobber, Housecall Pro, QuoteIQ, ServiceTitan y Projul — dos cosas que hace el recepcionista aquí no aparecen en ningún nivel:" },
          { bullets: [
            "**Una llamada que vuelve como borrador de presupuesto.** Lo que describió quien llamó se lee de la transcripción y, cuando alcanza para su formulario de presupuesto instantáneo, se calcula con su propia configuración y se deja en su cola de revisión — nunca una cifra inventada durante la llamada.",
            "**El asistente que devuelve la llamada a sus clientes** — después de enviar un presupuesto, el día antes de una visita y ante una consulta nueva — dentro del horario de llamadas y solo donde el cliente pidió que lo contacten.",
          ] },
          { p: "Y se cobra por minuto contra un crédito que usted ve, con el costo de cada llamada impreso junto a la llamada, en lugar de como un complemento mensual fijo." },
        ],
      },
      {
        id: "who-can-see-it",
        heading: "Quién puede verlo",
        blocks: [
          { p: "El propietario, los administradores y cualquier persona con nivel Despachador o Gerente pueden abrir **Configuración → Recepcionista telefónico** y cambiarlo — comprar un número y recargar gastan el dinero de la empresa. Los accesos de Cuadrilla y Estimador no ven la fila. El registro de llamadas tiene su propia regla: vea [[the-receptionist-call-log|El registro de llamadas del recepcionista]]." },
        ],
      },
    ],
    faq: [
      { q: "¿Contesta en francés o en español?", a: "Lleva toda la llamada en el idioma de su empresa — inglés, francés o español — y cambia al idioma de quien llama si habla otro. Las empresas configuradas en cualquier otro idioma tienen por ahora un recepcionista que habla inglés." },
      { q: "¿Dará un precio por teléfono?", a: "Nunca. Puede leer la tarifa de reserva que usted publicó en su página de reservas, porque es su propia cifra, pero nunca pone precio al trabajo. Un borrador de presupuesto llega a su cola de revisión para que una persona lo apruebe." },
      { q: "Llamé a mi propio número y no apareció nada en FieldQuo.", a: "Ejecute **Comprobarlo de principio a fin** en la pantalla de configuración — le pregunta al servicio telefónico por cada eslabón y nombra el que está roto. En la pantalla Recepcionista, **Recuperar llamadas perdidas** trae de vuelta cualquier llamada de la última semana que nunca nos llegó." },
    ],
  },

  "the-receptionist-call-log": {
    title: "El registro de llamadas del recepcionista",
    summary:
      "Cada llamada que el recepcionista atendió o hizo: qué se dijo, en qué quedó, cuánto costó — agrupadas en Te necesita, Pendientes de ti y Archivadas, con la grabación, un borrador de presupuesto y una devolución de llamada a un clic.",
    updated: "2026-09-12",
    intro: [
      "La pantalla **Recepcionista** de la barra lateral principal es el registro — «Las llamadas que ha atendido por ti y en qué quedaron.» Cada llamada muestra el número, cuándo sonó, cuánto duró, cuánto costó, un resumen y qué produjo: un prospecto guardado, una visita reservada, una llamada programada. La grabación está a un clic, igual que un borrador de presupuesto construido con lo que dijo quien llamó.",
      "Las llamadas no se despejan solas. Una llamada que el recepcionista marcó como urgente se queda arriba hasta que una persona dice que ya se ocupó, y una llamada que no se ha convertido en presupuesto sigue en la lista de trabajo hasta que alguien la archiva.",
    ],
    sections: [
      {
        id: "overview",
        heading: "Resumen",
        blocks: [
          { p: "Sobre la lista, cuando hay algo que decir, una línea cuenta lo que sus llamadas han reservado: «Tiene 3 en agenda desde sus llamadas: la próxima es el martes a las 2:00 PM.» Arriba hay dos botones: **Recuperar llamadas perdidas** y **Ajustes del recepcionista**. Si el recepcionista está configurado pero apagado, la pantalla lo dice y ofrece **Activar el recepcionista**; si está activo y nadie ha llamado aún, lo remite a **Comprobarlo de principio a fin**." },
        ],
      },
      {
        id: "on-the-screen",
        heading: "Qué hay en la pantalla",
        blocks: [
          { bullets: [
            "**Te necesita** — llamadas que el recepcionista marcó: alguien habló de inundación, gas, un techo que se viene abajo. En ámbar, arriba, hasta que pulse **Ya me ocupé**.",
            "**Pendientes de ti** — «Estas llamadas todavía no son una cotización. Archiva una cuando ya te hayas ocupado de ella.» La lista de trabajo.",
            "**Archivadas** — el registro debajo, con **Recuperar** en cada llamada.",
          ] },
          { p: "En cada llamada: una etiqueta **Llamamos** cuando el asistente hizo la llamada en vez de contestarla, una etiqueta **Recuperada** cuando la llamada se trajo del proveedor telefónico después, el número de quien llamó o **Número desconocido**, la hora, la duración y el costo en dólares estadounidenses, el resumen, y en qué quedó — **Guardado como prospecto**, **Visita reservada — martes …**, **Llamada programada — …**, **Videollamada reservada — …**, o **Cotización 1042** en cuanto existe un presupuesto. Luego **Escuchar**, **Leer toda la llamada**, **Redactar un presupuesto a partir de esta llamada** y **Reservar una devolución de llamada**." },
        ],
      },
      {
        id: "working-a-call",
        heading: "Cómo trabajar una llamada",
        blocks: [
          { steps: [
            "Abra **Recepcionista**. Empiece por **Te necesita**; pulse **Escuchar** para oír la grabación, o **Leer toda la llamada** para la transcripción, con cada línea marcada como de quien llamó o del recepcionista.",
            "Pulse **Redactar un presupuesto a partir de esta llamada**. El panel **Lo que oímos en esta llamada** lista cada servicio y cada medida junto a las palabras textuales de quien llamó — no se afirma nada que no pueda rastrearse a algo dicho. Si quien llamó dio lo suficiente para su formulario de presupuesto instantáneo, el borrador ya está calculado con su configuración y espera en la cola de revisión (**Abrir la cola de revisión**); si no, **Abrir en el generador de presupuestos** inicia un presupuesto con lo escuchado ya rellenado y sin precios.",
            "Si quien llamó quiere que le devuelvan la llamada, pulse **Reservar una devolución de llamada**: FieldQuo reserva el siguiente hueco libre de 15 minutos de su disponibilidad, dentro de sus horas de apertura, y lo pone en su calendario — «Devolución de llamada reservada — martes a las 10:15. Está en su calendario.»",
            "Cuando haya actuado sobre una llamada urgente, pulse **Ya me ocupé**. Cuando una llamada ordinaria esté resuelta, pulse **Archivar**; **Recuperar** lo deshace.",
            "Si falta una llamada que usted sabe que ocurrió, pulse **Recuperar llamadas perdidas**. FieldQuo le pide al proveedor telefónico la última semana, trae de vuelta lo que nunca le llegó y reconstruye el prospecto desde la grabación — marcada **Recuperada**, con «revisa los datos antes de devolver la llamada».",
          ] },
          { figure: "live:app-receptionist", caption: "Recepcionista — el conteo de reservas próximas, y luego las llamadas agrupadas en Te necesita, Pendientes de ti y Archivadas, cada una con su costo, resumen y resultado." },
        ],
      },
      {
        id: "what-each-control-does",
        heading: "Qué hace cada control",
        blocks: [
          { table: {
            head: ["Control", "Qué hace"],
            rows: [
              ["**Escuchar**", "Reproduce la grabación de la llamada en la página."],
              ["**Redactar un presupuesto a partir de esta llamada**", "Lee la transcripción con FieldQuo AI. Se calcula solo cuando su formulario de presupuesto instantáneo tiene todo lo que necesita — entonces es un borrador en la cola de revisión, nunca una cifra en esta pantalla. Usa su cupo de IA; si está agotado, o la IA está apagada, el panel lo dice y la grabación y la transcripción se conservan."],
              ["**Reservar una devolución de llamada**", "Reserva una devolución de llamada de 15 minutos en su calendario según su disponibilidad real. Se rechaza con un motivo cuando no hay número al que llamar, cuando su línea está configurada solo para visitas presenciales, cuando nunca se han fijado sus horas de apertura, o cuando el tipo de reserva cobra por adelantado (eso tiene que pasar por su página de reservas)."],
              ["**Ya me ocupé**", "Saca una llamada urgente de Te necesita. No cambia nada más."],
              ["**Archivar** / **Recuperar**", "Saca una llamada de la lista de trabajo, o la devuelve a ella. La llamada, su grabación y su costo siguen en el registro."],
              ["**Recuperar llamadas perdidas**", "Le pide al proveedor telefónico cada llamada de la última semana, añade las que FieldQuo nunca recibió y reconstruye sus prospectos desde las grabaciones. Informa cuántas se revisaron, recuperaron y reconstruyeron, o que no faltaba nada."],
            ],
          } },
        ],
      },
      {
        id: "who-can-see-it",
        heading: "Quién puede verlo",
        blocks: [
          { p: "El registro son datos de contacto de clientes — números y grabaciones — así que sigue el nivel de **Clientes y propiedades**: quien puede ver la información completa de los clientes ve la fila, es decir, los perfiles Estimador, Despachador y Gerente más el propietario y los administradores. El perfil Cuadrilla, que solo ve el nombre y la dirección de un cliente, no la ve. **Reservar una devolución de llamada** exige además poder crear solicitudes, cosa que todos esos perfiles tienen." },
        ],
      },
    ],
    faq: [
      { q: "¿Por qué una llamada del martes aparece recién hoy, con una etiqueta Recuperada?", a: "Nunca llegó a FieldQuo mientras ocurría y se trajo del proveedor telefónico después. La fila no va tarde — se había perdido, y la etiqueta dice cuándo se recuperó." },
      { q: "¿Redactar un presupuesto desde una llamada pone un precio delante del cliente?", a: "No. Un borrador calculado se queda en su cola de revisión hasta que una persona lo apruebe; uno sin calcular se abre en el generador de presupuestos sin precios. El cliente no ve nada hasta que usted envía." },
      { q: "¿Dónde cambio lo que dice el recepcionista?", a: "**Ajustes del recepcionista**, arriba en esta pantalla, abre Configuración → Recepcionista telefónico — vea [[the-phone-receptionist|El recepcionista telefónico]]." },
    ],
  },

  "quote-callbacks": {
    title: "Devoluciones de llamada por presupuestos",
    summary:
      "El asistente llama a un cliente después de enviarle el presupuesto, el día antes de una visita y ante una consulta nueva — qué presupuestos, las ocho comprobaciones antes de marcar, el consentimiento que necesita, y la tarjeta que dice por qué no se llamó por un presupuesto.",
    updated: "2026-09-12",
    intro: [
      "Active **Devolver llamadas a los clientes automáticamente** y el recepcionista telefónico empieza a hacer llamadas además de atenderlas: después de enviar un presupuesto, para responder dudas y preguntar si el cliente quiere seguir adelante; el día antes de una visita agendada, para confirmarla; y para dar seguimiento a una consulta nueva. Siempre dentro del horario de llamadas, solo a personas que pidieron ser contactadas, y quien diga basta se elimina para siempre.",
      "Este artículo es la mitad saliente de **Configuración → Recepcionista telefónico**: el interruptor, la elección **Qué presupuestos reciben una llamada**, las reglas que el asistente comprueba antes de marcar, el botón manual **Llamar sobre este presupuesto** en un presupuesto, y el informe de la tarjeta que nombra los presupuestos que se pasaron por alto y por qué.",
    ],
    sections: [
      {
        id: "overview",
        heading: "Resumen",
        blocks: [
          { p: "Una llamada se pone en cola en el momento en que se dispara un desencadenante y se hace después, con una comprobación que corre cada 15 minutos — así que un presupuesto aprobado a las nueve de la noche se llama a la mañana siguiente, no a las nueve. Cada regla se vuelve a comprobar al marcar, no al encolar: un cliente que retira su consentimiento, un número que cambia o un crédito que se agota en el intermedio surten efecto sobre una llamada que ya espera." },
          { note: "El asistente puede decir el total del presupuesto en una llamada de presupuesto, porque una persona aprobó esa cifra y el cliente ya la tiene por escrito. Nunca la cambia, y si el total del presupuesto ya no coincide con lo que se encoló, la cifra se quita de la llamada en lugar de decirse." },
        ],
      },
      {
        id: "which-quotes",
        heading: "Qué presupuestos reciben una llamada",
        blocks: [
          { table: {
            head: ["Opción en la tarjeta", "Qué hace"],
            rows: [
              ["**Solo presupuestos instantáneos**", "Solo presupuestos que calculó el software y alguien aprobó — un presupuesto instantáneo desde su sitio web o el recepcionista, tras revisión. Es el valor por defecto y lo que la función siempre ha hecho."],
              ["**Todos los presupuestos que envío**", "Incluidos los presupuestos que usted mismo escribe: el asistente llama una vez después de enviarlo, para responder dudas y preguntar si quieren seguir adelante."],
              ["**Sin devoluciones de llamada de presupuestos**", "Ninguna llamada sobre presupuestos. Los recordatorios de citas y los seguimientos de consultas nuevas continúan, porque el interruptor de arriba gobierna los tres."],
            ],
          } },
        ],
      },
      {
        id: "before-it-dials",
        heading: "Qué se comprueba antes de marcar",
        blocks: [
          { p: "Una llamada de presupuesto solo se hace cuando se cumple cada una de estas condiciones. La tarjeta de la pantalla de configuración nombra las que fallan, con las mismas palabras:" },
          { bullets: [
            "**Las llamadas automáticas están activadas** — el interruptor principal de la tarjeta.",
            "**El presupuesto está en el alcance** — un presupuesto instantáneo, o cualquier presupuesto si eligió «todos los presupuestos que envío».",
            "**El cliente no lo rechazó** — un «no» ya dado no recibe llamada de cierre.",
            "**El presupuesto está aprobado** — un borrador que aún espera que alguien lo apruebe nunca se llama.",
            "**El presupuesto se envió por correo** — la llamada trata de un documento que el cliente puede leer, así que viene después del correo, nunca antes. Un trabajo pasado importado para la contabilidad nunca se llama.",
            "**El cliente tiene número de teléfono.**",
            "**Alguien en ese número pidió ser contactado** — el consentimiento se registra cuando un cliente envía su formulario web, su presupuesto instantáneo, su formulario de autopresupuesto o una solicitud desde el portal que dice que usted puede llamar, o reserva una visita; dura un año (tres meses tras un trabajo completado), y «no me llamen» le gana a todo y nunca se borra.",
            "**Es entre las 9 a.m. y las 8 p.m. donde está el cliente.** Fuera de esa ventana la llamada simplemente espera.",
          ] },
          { p: "Una sola llamada por presupuesto, para siempre. Reenviar un presupuesto una semana después no encola una segunda llamada. Una visita reprogramada sí recibe una segunda llamada de recordatorio, porque la primera era sobre otro día." },
        ],
      },
      {
        id: "turn-it-on",
        heading: "Cómo activarlo",
        blocks: [
          { steps: [
            "Abra **Configuración → Recepcionista telefónico** y baje hasta **Devolver llamadas a los clientes automáticamente**. El botón está desactivado hasta que tenga un número activo y crédito para al menos un minuto; la línea debajo dice qué falta.",
            "Pulse **Activar las devoluciones de llamada de presupuestos**. El botón se pone verde y dice **Está llamando a los clientes — desactivar**.",
            "En **Qué presupuestos reciben una llamada**, deje **Solo presupuestos instantáneos** o elija **Todos los presupuestos que envío**.",
            "Lea el informe bajo la opción. Lista los presupuestos enviados en los últimos 30 días que no se llamaron y el motivo más común — «No es un presupuesto instantáneo — alguien lo escribió», «El cliente no tiene número de teléfono», «Nadie en este número ha pedido que lo contacten» — para que una función armada que nunca se disparará sea visible aquí en vez de un silencio.",
          ] },
          { figure: "live:app-settings-voice", caption: "Configuración → Recepcionista telefónico — la tarjeta Devolver llamadas a los clientes automáticamente contiene el interruptor, la opción Qué presupuestos reciben una llamada y el informe." },
        ],
      },
      {
        id: "call-about-this-quote",
        heading: "Llamar a un cliente a mano",
        blocks: [
          { p: "En cualquier presupuesto, **Llamar sobre este presupuesto** encola la misma llamada para ese único cliente — «En cola — llamaremos a Maria en unos 15 minutos.» Una persona que lo pulsa ya tomó la decisión de alcance por sí misma, así que la opción de alcance no lo detiene; lo que sí lo detiene es el interruptor principal apagado, un borrador que nadie aprobó, un presupuesto que el cliente no ha recibido por correo, y un cliente sin número de teléfono. El consentimiento y el horario de llamadas se comprueban al marcar, exactamente igual que en una llamada automática." },
          { tip: "Cada llamada que hace el asistente aparece en la pantalla Recepcionista con una etiqueta **Llamamos**, su grabación, su resumen y su costo — los mismos 35¢ por minuto que una llamada atendida." },
        ],
      },
      {
        id: "only-in-fieldquo",
        heading: "Qué es distinto aquí",
        blocks: [
          { p: "En las páginas de precios con las que FieldQuo se compara — Jobber, Housecall Pro, QuoteIQ, ServiceTitan y Projul — un asistente que llama a sus clientes para confirmar la visita de mañana o cerrar un presupuesto que usted envió no aparece en ningún nivel. Lo que lo hace utilizable en vez de peligroso es la parte que no se ve: ninguna llamada sale jamás a un número sin una solicitud de contacto registrada, y el informe de la tarjeta le dice qué presupuestos se pasaron por alto y por qué." },
        ],
      },
      {
        id: "who-can-see-it",
        heading: "Quién puede verlo",
        blocks: [
          { p: "El interruptor y el alcance viven en Configuración → Recepcionista telefónico, que pueden abrir el propietario, los administradores y los niveles Despachador y Gerente. **Llamar sobre este presupuesto** está en el propio presupuesto, para quien pueda abrirlo — si las llamadas salientes están desactivadas para la empresa, el botón lo dice y nombra quién puede volver a activarlas." },
        ],
      },
    ],
    faq: [
      { q: "Lo activé y escribí tres presupuestos. ¿Por qué no se llamó a nadie?", a: "Lea el informe de la tarjeta. Lo más habitual es que los presupuestos se escribieron a mano y el alcance es Solo presupuestos instantáneos, o que los clientes se registraron a partir de una llamada y nadie en su número ha pedido ser contactado." },
      { q: "¿Puede llamar a alguien que está en mi lista de clientes pero nunca pidió nada?", a: "No. Estar en su base de datos no es consentimiento. El asistente solo llama a un número con una solicitud registrada — un formulario, una reserva, un presupuesto que pidieron — y a un cliente que dice basta no se le vuelve a llamar." },
      { q: "¿Cuándo exactamente sale la llamada de recordatorio?", a: "Unas 24 horas antes de la visita, dentro del horario de llamadas, y solo cuando la visita está a más de tres horas en el momento de reservarla — un recordatorio minutos después de reservar sería una molestia." },
    ],
  },

  "the-crew-inbox": {
    title: "La bandeja del equipo: fotos y novedades por mensaje",
    summary:
      "Su cuadrilla envía fotos y notas por mensaje a un solo número y se archivan solas en el trabajo correcto — sin app, sin cuenta. El panel de configuración, la cola de fotos que necesitan a una persona, cuánto cuesta cada mensaje, y quién ve qué.",
    updated: "2026-09-12",
    intro: [
      "Un miembro de la cuadrilla subido a una escalera no va a instalar una app. Con la bandeja del equipo envía una foto, o una novedad de una línea, por mensaje a un número, y FieldQuo la archiva en el trabajo en el que está ese día. Cuando el día tiene más de un trabajo pregunta cuál — por mensaje, como lista numerada — en lugar de adivinar. Una foto archivada en el cliente equivocado es el único error que esta función está construida para no cometer nunca.",
      "La pantalla **Bandeja del equipo** de la barra lateral principal es donde usted configura el número y donde caen las excepciones: una foto cuya pregunta nadie respondió, y mensajes de números que no están en su equipo.",
    ],
    sections: [
      {
        id: "overview",
        heading: "Resumen",
        blocks: [
          { p: "La línea de mensajes del equipo es un número propio — una línea de mensajes, separada de aquella en la que el recepcionista contesta llamadas, porque el número del recepcionista no puede recibir mensajes de texto. Se renta por mes y sus mensajes se miden contra el mismo crédito que el recepcionista. La cuadrilla se identifica por el número de teléfono de su perfil en **Equipo → Personal**; un mensaje de un número desconocido se registra pero no se archiva, y — durante sus primeros mensajes — recibe una respuesta que dice qué número añadir." },
        ],
      },
      {
        id: "on-the-screen",
        heading: "Qué hay en la pantalla",
        blocks: [
          { bullets: [
            "**Mensajes del equipo** — el panel verde de configuración: **Tu equipo escribe a este número**, el número, si está realmente conectado (preguntado al proveedor telefónico, no supuesto), **Crédito: $12.40**, la línea de tarifas «2¢ por mensaje (cada 160 caracteres), 5¢ por foto — del mismo crédito que tu agente telefónico», y **Enviarme un mensaje de prueba**, **Agregar crédito**, **Ver cada cargo**, **Desactivar los mensajes del equipo**.",
            "**Te necesita — elige el trabajo (2)** — una foto que el sistema no pudo archivar: la imagen, quién la envió, cuándo, **Dónde se tomó** cuando el teléfono envió coordenadas, y luego **¿Para qué trabajo es esto?** con un botón por trabajo candidato y **Archivar aquí**.",
            "**De números que no están en tu equipo (1)** — mensajes de desconocidos, con «Agrega este número a un miembro del equipo en **Equipo** y sus mensajes se archivarán automáticamente.»",
            "**Archivados** — todo lo que llegó a su sitio, cada uno con **Archivado en Cocina Nguyen**. La foto en sí vive en el trabajo.",
          ] },
        ],
      },
      {
        id: "set-it-up",
        heading: "Cómo configurarla",
        blocks: [
          { steps: [
            "Abra **Bandeja del equipo**. Si el panel dice «Tu equipo aún no tiene un número al que enviar mensajes», pulse **Comprarle a tu equipo su propio número**, elija un **Código de área** (por defecto el de su perfil de empresa), pulse **Muéstrame números** y elija uno. Cuesta $4 al mes de su crédito, el primer mes por adelantado, y el panel confirma «Listo — el número de tu equipo es …».",
            "O, para probar primero, pulse **Usar la línea de prueba de FieldQuo** — una línea compartida prestada a su empresa hasta la fecha mostrada.",
            "Añada su propio móvil a su perfil de personal en **Equipo → Personal**, para que la bandeja reconozca sus mensajes, y haga lo mismo con cada miembro de la cuadrilla.",
            "Pulse **Enviarme un mensaje de prueba** y respóndalo desde su teléfono con una foto. Debería caer en **Archivados** contra un trabajo de su agenda de hoy — o en **Te necesita** si no tiene ninguno, lo cual también es un éxito.",
            "Dele el número a la cuadrilla. Ese es todo el despliegue: nada que instalar y nadie a quien invitar.",
          ] },
          { figure: "live:app-crew-inbox", caption: "Bandeja del equipo — el panel Mensajes del equipo con el número, el crédito y las tarifas, luego Te necesita — elige el trabajo con los botones candidatos, y Archivados." },
          { note: "El panel nunca informa un éxito que no haya verificado: le pregunta al proveedor telefónico si el número está activado y puede recibir fotos. Si dice «Este número recibe mensajes pero no fotos», avísele a FieldQuo y se cambia el número." },
        ],
      },
      {
        id: "how-a-photo-is-filed",
        heading: "Cómo una foto encuentra su trabajo",
        blocks: [
          { p: "Los candidatos son las visitas programadas del remitente para ese día. Entre ellas, FieldQuo archiva sin preguntar solo cuando está seguro, de una de tres maneras; todo lo demás se convierte en una pregunta." },
          { bullets: [
            "**Nombrado** — el mensaje menciona el cliente, el título o el número de calle de un trabajo («123 Oak listo»).",
            "**En el sitio** — las coordenadas de la foto están a menos de 250 m de un trabajo y claramente más cerca de él que de cualquier otro.",
            "**Solo uno** — la persona tiene exactamente un trabajo ese día. Se archiva en silencio.",
            "**Preguntar** — todo lo demás. El miembro de la cuadrilla recibe «Which job is this for? 1. Nguyen 2. Patel — Reply with the number.» y la foto espera en Te necesita hasta que él, o usted, responda.",
          ] },
          { p: "Una foto archivada cae en la visita del trabajo con el mensaje como leyenda y una etapa (antes, durante, después) deducida de las palabras; el miembro de la cuadrilla recibe un breve «Filed to Nguyen. 👍» cuando hubo que elegir, y nada cuando no — una línea que pía con cada foto acaba silenciada. Si nada llegó a su sitio, dice que la foto espera en la bandeja de la oficina en lugar de fingir." },
          { tip: "Enséñele a la cuadrilla un solo hábito: poner el nombre del cliente o el número de calle en el mensaje. Una foto nombrada se archiva sola cada vez." },
        ],
      },
      {
        id: "what-it-costs",
        heading: "Cuánto cuesta",
        blocks: [
          { table: {
            head: ["Concepto", "Costo"],
            rows: [
              ["Un mensaje de la cuadrilla", "2¢ por cada 160 caracteres — un mensaje largo son dos cargos."],
              ["Una foto de la cuadrilla", "5¢, sea cual sea la cantidad de texto que la acompañe."],
              ["Una respuesta de FieldQuo (la pregunta, la confirmación, un aviso de @mención)", "Las mismas tarifas, y solo se envía cuando el saldo la cubre."],
              ["El número", "$4 al mes de su crédito, el primer mes por adelantado. La línea sigue conectada hasta $2 en negativo para que una cuadrilla a mitad de un trabajo no quede cortada; pasado eso, se pausa en el proveedor hasta que usted recargue."],
            ],
          } },
          { p: "El saldo es el del recepcionista, en dólares estadounidenses; **Ver cada cargo** abre el extracto, y el panel avisa cuando queda el equivalente a unas veinte fotos." },
        ],
      },
      {
        id: "who-can-see-it",
        heading: "Quién puede verlo",
        blocks: [
          { p: "Todo el equipo ve la fila **Bandeja del equipo**, pero dos reglas la acotan. Configurar la línea — comprar, probar, desactivar — corresponde al propietario, los administradores y el nivel Gerente, porque gasta el crédito de la empresa; a un Despachador se le rechaza con ese motivo. La lectura sigue el nivel de **Agenda**: los accesos de Cuadrilla y Estimador ven solo sus propios mensajes; Despachador, Gerente, propietario y administradores ven los de todos, incluida la cola de números desconocidos." },
        ],
      },
      {
        id: "only-in-fieldquo",
        heading: "Qué es distinto aquí",
        blocks: [
          { p: "En las páginas de precios con las que FieldQuo se compara, los puntos más cercanos son los SMS bidireccionales con clientes y las llamadas y mensajes dentro de la app entre personas que tienen la app. Ninguna nombra un número al que su cuadrilla envía una foto que se archiva en el trabajo sin app ni cuenta, que pregunta por mensaje cuando no puede decidir, y que guarda la foto para una persona en vez de adivinar." },
        ],
      },
    ],
    faq: [
      { q: "¿Puedo usar simplemente el número del recepcionista?", a: "No — contesta llamadas y no puede recibir mensajes de texto, y un número desviado desvía llamadas, nunca mensajes. La línea del equipo es un número de mensajes aparte, y por eso la configuración vive en esta página y no en la pantalla del teléfono." },
      { q: "Un subcontratista trabaja para dos empresas. ¿A dónde van sus fotos?", a: "A la empresa cuyo número escribió. El número al que se envió decide la empresa; el número del remitente decide solo quién, dentro de ella. Su teléfono puede estar en ambas listas." },
      { q: "¿Las fotos reciben etiquetas?", a: "Una foto enviada por mensaje cae con una etapa deducida de las palabras (antes, durante, después) y sin etiquetas de la empresa; añada las etiquetas en el trabajo después. Una etiqueta equivocada es un error que corresponde a una persona, no al sistema." },
    ],
  },

  "team-chat": {
    title: "Chat del equipo",
    summary:
      "La empresa hablando entre sí: #general para todos, una sala por trabajo activo para la cuadrilla asignada y la oficina, mensajes directos, @menciones que llegan a un teléfono — y nada que salga de la empresa.",
    updated: "2026-09-12",
    intro: [
      "**Chat** es la conversación propia de la empresa, dentro de FieldQuo. Todos los de la lista están en **#general**; cada trabajo del calendario tiene una sala para la cuadrilla asignada y la oficina; y dos personas cualesquiera pueden escribirse directamente. Las menciones avisan a la persona nombrada, y en un teléfono Chat es la pestaña propia de la cuadrilla al pie de la pantalla.",
      "Nada de esto llega a un cliente, y nada llega a FieldQuo — la sesión de solo lectura del equipo de soporte puede ver las salas y no puede publicar en ellas.",
    ],
    sections: [
      {
        id: "overview",
        heading: "Resumen",
        blocks: [
          { p: "La pantalla es el mismo kit de chat que **Mensajes**: la lista de conversaciones a la izquierda, el hilo en el centro con separadores de día y una línea de no leídos, los **Miembros** de la sala a la derecha, y el cuadro de redacción abajo. Las salas sin leer suben al principio de la lista, porque la lista existe para responder «quién me está esperando». Las salas las crea y mantiene FieldQuo a partir de su lista de personal y su agenda — nadie añade ni quita a nadie a mano, y por eso la lista nunca puede desviarse de quién está realmente en un trabajo." },
        ],
      },
      {
        id: "on-the-screen",
        heading: "Qué hay en la pantalla",
        blocks: [
          { bullets: [
            "**Sin leer** — cualquier sala con algo que usted no ha visto, con las menciones contadas aparte.",
            "**Empresa** — **#general**, «Todo el equipo».",
            "**Trabajos** — una sala por trabajo programado o en curso, con su nombre, «La cuadrilla asignada a este trabajo, y la oficina», con **Abrir trabajo** en su cabecera.",
            "**Mensajes directos** — «Solo ustedes dos. Nadie más puede leer esto.»",
            "**Trabajos terminados** — las salas de trabajos completados o cancelados, conservadas con su historial: «Este trabajo está terminado. La sala se conserva como registro.»",
          ] },
          { p: "**Nuevo mensaje**, arriba, abre un mensaje directo: busque en el equipo por nombre o correo y elija a una persona. El cuadro de redacción dice **Mensaje a #general** o **Mensaje a Ana**; escribir **@** abre **Mencionar a alguien** con las personas de esa sala — ↑↓ para elegir, Tab para insertar." },
        ],
      },
      {
        id: "rooms",
        heading: "Los tres tipos de sala",
        blocks: [
          { table: {
            head: ["Sala", "Quién está en ella", "Cómo se mantiene"],
            rows: [
              ["**#general**", "Todos los que pueden iniciar sesión en la empresa.", "Cada persona entra en cuanto acepta su invitación y sale cuando se desactiva su cuenta. Nadie puede abandonarla."],
              ["Una sala de trabajo", "Quien esté asignado a una de las visitas del trabajo, más el propietario, los administradores y los gerentes, que dirigen todos los trabajos.", "Se crea para un trabajo en cuanto se programa; la membresía sigue a las visitas — asigne a alguien a una visita y está dentro, quítelo y está fuera. Se conserva, en Trabajos terminados, cuando el trabajo acaba."],
              ["Un mensaje directo", "Dos personas.", "Lo abre cualquiera de las dos desde Nuevo mensaje; solo existe una sala por cada par."],
            ],
          } },
          { note: "Nunca se crea una sala para un trabajo sin programar — contendría a la oficina hablando consigo misma de un trabajo que nadie ha recibido. Programe una visita y la sala aparece." },
        ],
      },
      {
        id: "mentions-and-notifications",
        heading: "Menciones y notificaciones",
        blocks: [
          { p: "Un mensaje solo puede mencionar a alguien que esté en la sala. La persona nombrada ve el mensaje resaltado en el hilo, un conteo de menciones en la sala dentro de la lista y — si activó las notificaciones del navegador — «Ana te mencionó en #Cocina Nguyen» en su teléfono o su ordenador, que abre directamente la sala. Un mensaje directo avisa a la otra persona del mismo modo. Ni el autor ni nadie más recibe aviso." },
          { bullets: [
            "Active las notificaciones por navegador en **Configuración → Notificaciones** — vea [[notifications-for-you|Notificaciones para usted: correo y navegador]].",
            "Un mensaje que no pudo enviarse como push igualmente se guarda y se cuenta; el push es una cortesía sobre un mensaje que ya existe.",
          ] },
          { note: "Una sesión de soporte de solo lectura ve «Estás viendo esta cuenta en modo de solo lectura. El acceso de soporte puede ver el chat y no puede publicar en él.» No puede enviar, mencionar ni abrir un mensaje directo." },
        ],
      },
      {
        id: "how-to",
        heading: "Cómo usarlo en la obra",
        blocks: [
          { steps: [
            "En un teléfono, toque **Chat** en la barra de pestañas al pie de la pantalla; en un ordenador, abra **Chat** en la barra lateral.",
            "Abra la sala del trabajo en **Trabajos** y escriba. Ponga **@** antes de un nombre para asegurarse de que la oficina vea una pregunta.",
            "Para hablar con una persona en privado, pulse **Nuevo mensaje**, busque su nombre y envíe.",
            "Cuando el trabajo termina, su sala pasa a **Trabajos terminados** — «qué acordamos sobre la cocina Nguyen» sigue teniendo respuesta en marzo.",
          ] },
          { figure: "harness:chat", caption: "Chat — las salas agrupadas en Sin leer, Empresa, Trabajos, Mensajes directos y Trabajos terminados, el hilo de una sala de trabajo, y sus Miembros." },
        ],
      },
      {
        id: "who-can-see-it",
        heading: "Quién puede verlo",
        blocks: [
          { p: "Todos los de la lista, incluidos los accesos de Cuadrilla — el chat es la pantalla propia de la cuadrilla y no tiene un nivel de acceso propio. Lo que cada persona ve son las salas en las que está: #general, los trabajos a los que está asignada y sus mensajes directos. El propietario, los administradores y los gerentes están en todas las salas de trabajo." },
        ],
      },
      {
        id: "only-in-fieldquo",
        heading: "Qué es distinto aquí",
        blocks: [
          { p: "Ninguna de las páginas de precios con las que FieldQuo se compara — Jobber, Housecall Pro, QuoteIQ, ServiceTitan, Projul — lista un chat de equipo en ningún nivel. Aquí está en todos los planes, para todos los accesos, incluidos los de cuadrilla gratuitos, con las salas de trabajo tomadas de la agenda en vez de mantenidas a mano." },
        ],
      },
    ],
    faq: [
      { q: "¿Puede un cliente ver algo de esto?", a: "No. El chat es solo entre miembros de su empresa. Las conversaciones con clientes viven en Mensajes, y los mensajes de texto a clientes son los dos descritos en [[texting-clients-what-is-and-is-not-automated|Mensajes de texto a clientes: qué es automático y qué no]]." },
      { q: "¿Cómo añado a alguien a la sala de un trabajo?", a: "Asígnelo a una de las visitas del trabajo. La membresía se deriva de la agenda, así que no hay botón de añadir — y quitarlo de las visitas lo saca de la sala." },
      { q: "¿Puedo borrar un mensaje o una sala?", a: "No. La sala de un trabajo terminado se conserva como registro, y los mensajes de un miembro que se fue siguen atribuidos a «Alguien que se fue»." },
    ],
  },

  "texting-clients-what-is-and-is-not-automated": {
    title: "Mensajes de texto a clientes: qué es automático y qué no",
    summary:
      "Exactamente dos mensajes de texto llegan a sus clientes — «en camino» y el recordatorio de cita — en el idioma del cliente, con su redacción si la configuró. Qué dispara cada uno, qué no se envía por mensaje, y qué pasa cuando un cliente responde.",
    updated: "2026-09-12",
    intro: [
      "FieldQuo envía mensajes de texto a sus clientes en dos situaciones y ninguna más: cuando un miembro de la cuadrilla marca una visita como **En camino**, y antes de una cita, con la antelación que usted eligió. Ambos salen con el nombre de su empresa, en el idioma del cliente, con la redacción que usted fijó en **Configuración → Mensajes de clientes** o la redacción integrada si la dejó como estaba.",
      "Todo lo demás — un presupuesto, una factura, una confirmación de reserva, un seguimiento — va por correo, y no hay mensajería bidireccional con clientes. Este artículo traza esa línea con precisión para que nadie prometa un mensaje que el producto no envía.",
    ],
    sections: [
      {
        id: "overview",
        heading: "Resumen",
        blocks: [
          { p: "Los mensajes de texto son lo último que lee un cliente antes de que llegue la camioneta, así que FieldQuo los mantiene cortos, en el idioma del cliente y pocos. Los dos que existen están conectados de principio a fin — un desencadenante real, un envío real, una comprobación de baja antes de cada uno. Varios otros existen solo como redacción y deliberadamente no se ofrecen para editar hasta que se envíen, porque un editor para un mensaje que nunca sale sería un control muerto." },
        ],
      },
      {
        id: "what-is-automated",
        heading: "Los dos mensajes que salen",
        blocks: [
          { table: {
            head: ["Mensaje", "Cuándo sale", "Redacción integrada (en español)"],
            rows: [
              ["**En camino**", "En el momento en que el estado de una visita pasa a **En camino** — normalmente el miembro de la cuadrilla tocándolo en su teléfono. Solo si el cliente del trabajo tiene número de teléfono.", "«Northside Painting: Dave va en camino, llega en 20 min. Responda si necesita cambiar la hora.»"],
              ["**Recordatorio de cita**", "En cuanto una cita de su Calendario entra en la antelación elegida en **Configuración → Notificaciones** — 2, 24 o 48 horas antes. Se revisa cada hora; se envía una vez por cita.", "«Northside Painting: Recordatorio — su cita es mar., 15 sept, 2:00 p.m. en 123 Oak St. Responda STOP para no recibir más.»"],
            ],
          } },
          { p: "Los recordatorios de cita están en **Desactivado** hasta que un propietario o administrador elige una antelación — cada recordatorio es un mensaje que la empresa paga, así que no se envía nada que nadie haya activado. Aplican a las citas del Calendario (reservas desde su página de reservas, llamadas que agendó el recepcionista, citas que usted añade); una visita en un trabajo es un registro distinto y no recibe recordatorio por mensaje." },
          { figure: "live:app-settings-messages", caption: "Configuración → Mensajes de clientes — un editor por mensaje, En camino y Recordatorio de cita, con los tokens, la vista previa «Tu cliente ve:», Guardar y Usar el predeterminado." },
        ],
      },
      {
        id: "what-is-not",
        heading: "Qué no se envía por mensaje",
        blocks: [
          { bullets: [
            "**No hay mensajería bidireccional.** La respuesta de un cliente a un mensaje no se entrega en ninguna pantalla de FieldQuo. La bandeja Mensajes es Facebook, Instagram y WhatsApp; no es SMS.",
            "**No hay mensaje de confirmación de reserva.** Una reserva desde su página de reservas se confirma por correo. La redacción de un mensaje de confirmación existe pero no está conectada para enviarse, así que no se ofrece para editar.",
            "**No hay mensajes de presupuesto, factura o trabajo terminado.** «Su presupuesto está listo», «Factura vencida» y «Su trabajo está terminado» van solo por correo — las reglas de seguimiento envían plantillas de correo y nada más.",
            "**El recepcionista no puede enviar mensajes.** Cuando tiene que remitir a alguien a su página de reservas, lee el enlace en voz alta y dice claramente que no puede enviarlo por mensaje.",
            "**No hay mensajes de marketing.** Las campañas son por correo; no existe una función de envío masivo de mensajes.",
          ] },
          { warning: "La redacción integrada de «en camino» termina con «Responda si necesita cambiar la hora», pero FieldQuo no lee la respuesta. Si quiere que los clientes puedan contestar ese mensaje, ponga el número de su oficina en su redacción personalizada — o quite la invitación." },
        ],
      },
      {
        id: "language-and-wording",
        heading: "Idioma y redacción",
        blocks: [
          { p: "La redacción integrada existe en inglés, francés, español, ucraniano, panyabí, tagalo, alemán e italiano, y cada cliente recibe la suya — la misma regla que su presupuesto y su correo de acompañamiento. La fecha y la hora de un recordatorio se escriben en el formato del cliente y en la zona horaria de su empresa, así que una visita a las 2 p.m. en Toronto nunca se envía como 6 p.m. Su redacción personalizada se escribe una vez, en el idioma en que usted trabaja, y se usa solo con los clientes que leen ese idioma; los demás reciben la traducción integrada. Nada se traduce automáticamente al momento de enviar." },
          { note: "El detalle del editor, los tokens y **Usar el predeterminado** está en [[client-texts-on-my-way-and-reminders|Los dos mensajes que reciben sus clientes]]. Pasados 160 caracteres, un mensaje se divide en dos." },
        ],
      },
      {
        id: "opting-out",
        heading: "Darse de baja",
        blocks: [
          { p: "Antes de cada mensaje, FieldQuo comprueba el número del cliente contra la lista de bajas de su empresa: un número que pidió dejar de recibir mensajes, o que pidió que no lo llamen, se omite — tanto el mensaje de «en camino» como el recordatorio. El recordatorio termina con «Responda STOP para no recibir más» en todos los idiomas, y STOP se mantiene en inglés a propósito porque los operadores lo tratan como universal." },
          { p: "No interviene ningún consentimiento de marketing: ambos mensajes tratan de una visita que el cliente reservó. Ninguno lleva enlace de baja, y ninguno se envía a un cliente sin número de teléfono registrado." },
        ],
      },
    ],
    faq: [
      { q: "¿Puedo enviar un mensaje de texto a un cliente desde FieldQuo?", a: "No. No hay cuadro de redacción para mensajes a clientes ni bandeja de SMS de clientes. Las conversaciones con clientes viven en Mensajes (Facebook, Instagram, WhatsApp); todo lo demás es correo." },
      { q: "¿Una reserva desde mi página de reservas dispara un mensaje?", a: "No — la confirmación va por correo. El mensaje de recordatorio sale después, con la antelación que usted fijó, si los recordatorios están activados." },
      { q: "¿Por qué un cliente recibió el recordatorio en inglés si su presupuesto estaba en francés?", a: "El mensaje sigue el idioma de la ficha del cliente, igual que el presupuesto. Revise el idioma del cliente; un cliente sin idioma definido recibe el predeterminado de su empresa." },
    ],
  },
};
