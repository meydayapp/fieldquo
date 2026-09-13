// content/help/es/messages-1.js
//
// Parte 1 de la categoría «messages» en español (ver el compositor,
// messages.js). Slugs de esta parte (lib/help/tree.js):
// the-messages-inbox, connect-your-facebook-page-and-instagram,
// whatsapp-business, conversation-status-and-who-looks-after-it,
// private-notes-and-temperature, the-ai-employee, the-monthly-review,
// client-texts-on-my-way-and-reminders, email-templates.
//
// Misma estructura que el inglés (mismas secciones, mismos bloques, mismas
// figuras); las palabras en pantalla vienen del bloque `es` de
// app/i18n/appMessages.js.
export const ARTICLES = {
  "the-messages-inbox": {
    title: "La bandeja de Mensajes",
    summary:
      "Dónde llegan sus conversaciones de Facebook, Instagram y WhatsApp Business, cómo se agrupan y qué hace cada botón de la pantalla.",
    updated: "2026-09-12",
    intro: [
      "**Mensajes** es una sola bandeja para los desconocidos que escriben a su empresa por Facebook, Instagram y WhatsApp. Cada conversación se guarda en FieldQuo, se agrupa según si le toca a usted responder, y lleva las dos cosas que le importan al resto del producto: si se convirtió en un trabajo y cuánto esperó la persona. Eso es lo que hace posible el resumen de fin de mes; vea [[the-monthly-review|El resumen mensual de su bandeja]].",
      "La fila del menú lleva una etiqueta **Vista previa**, y la pantalla se abre bajo un aviso de **Vista previa anticipada**. La bandeja en sí está terminada; lo que FieldQuo espera es la aprobación de Meta para la mensajería de páginas. Hasta que llegue para su empresa, la pantalla lo dice en una frase y el cuadro de respuesta queda desactivado con esa misma razón impresa encima. Mientras tanto no se inventa nada: una bandeja vacía dice **Todavía no hay conversaciones**, nunca un ejemplo.",
    ],
    sections: [
      {
        id: "overview",
        heading: "Resumen",
        blocks: [
          { p: "Solo cuentas de empresa. FieldQuo lee las conversaciones de la página de Facebook y de la cuenta profesional de Instagram que usted conecta, y de un número de WhatsApp Business; nunca los mensajes personales de nadie, y no hay ninguna ruta en el código que lleve a ellos. La conexión se hace una vez, en **Configuración → Meta Ads**; vea [[connect-your-facebook-page-and-instagram|Conectar su página de Facebook e Instagram]] y [[whatsapp-business|Mensajes de WhatsApp Business]]." },
          { p: "Una conversación nunca se borra de la bandeja. Se responde, se aparta, se marca terminada y se evalúa — **Ganada**, **Perdida**, **Sin respuesta** o **No es un trabajo** — para que el resumen de fin de mes tenga algo verdadero que contar." },
        ],
      },
      {
        id: "what-is-on-the-screen",
        heading: "Qué hay en la pantalla",
        blocks: [
          { bullets: [
            "**Mensajes — Los mensajes de tu página de Facebook y de tu cuenta profesional de Instagram, atendidos aquí.** El botón **Resumen mensual** está arriba a la derecha.",
            "El panel izquierdo: **Buscar conversaciones**, y luego los chips de canal **Todas**, **Facebook**, **Instagram**, **WhatsApp**. Tanto la búsqueda como los chips consultan al servidor, así que una búsqueda encuentra palabras dentro de mensajes que la lista todavía no ha cargado.",
            "**Actualizar desde Facebook**: trae las conversaciones que su página ya tenía antes de conectarla (los últimos 30 días). Solo aparece cuando Meta concedió el permiso necesario y usted puede escribir en la bandeja.",
            "Cuatro grupos, en este orden: **Por responder**, **Esperando su respuesta**, **Apartadas**, **Terminadas**. El último empieza plegado.",
            "Cada fila: el nombre de la persona, el ícono del canal, el último mensaje (**Tú: …** cuando fue suyo), la hora, un contador de no leídos, una etiqueta **Esperando 3 días** mientras la persona espera por usted, y el chip de temperatura — **Tibia 35**, **Caliente 72**, **Fría 0**. Un triángulo rojo significa que su última respuesta quedó **No entregado**.",
            "La conversación abierta en el centro, con **Conversación 41** (su número), el canal, el chip de resultado y una fila de acciones: **Abrir cliente**, **Abrir el lead**, **Abrir el trabajo**, **Abrir el presupuesto** cuando hay uno vinculado, **Marcar terminada** o **Reabrir**, y **Detalles**.",
            "El panel derecho, **Detalles** · **Resultado** · **Historial**: nombre, canal, primer contacto, número, a qué está vinculada, **¿Cómo va esta conversación?** y **Se encarga**.",
          ] },
        ],
      },
      {
        id: "read-and-reply",
        heading: "Cómo leer y responder una conversación",
        blocks: [
          { steps: [
            "Abra **Mensajes** y elija una fila bajo **Por responder**. En un teléfono, la lista, la conversación y los detalles son tres pantallas con una flecha para volver; en una pantalla ancha son tres paneles.",
            "Lea el hilo. Los separadores de día y una línea roja de no leídos muestran hasta dónde había llegado; las líneas grises registran lo que hizo su equipo (**Marcada como Ganada por Dave**, **Reabierta**).",
            "Escriba en **Escribe una respuesta** y pulse **Enviar**. Las pestañas **Responder** y **Nota** sobre el cuadro deciden adónde van las palabras; una nota se queda dentro de su empresa.",
            "Evalúela cuando lo sepa: el chip de resultado en el encabezado, o la pestaña **Resultado**, registra **Ganada**, **Perdida**, **Sin respuesta** o **No es un trabajo**. En cuanto elige uno, la conversación pasa a **Terminadas**.",
          ] },
          { figure: "live:app-messages", caption: "Mensajes — la lista agrupada en Por responder y Esperando su respuesta, cada fila con su tiempo de espera y su chip de temperatura, y los chips de canal arriba." },
          { note: "La barra de direcciones lleva la conversación abierta (**?conversation=…**), así que un enlace desde el resumen, o una recarga, cae en el hilo y no en la lista." },
        ],
      },
      {
        id: "what-each-control-does",
        heading: "Qué cambia cada control",
        blocks: [
          { table: {
            head: ["Control", "Qué hace"],
            rows: [
              ["Pestaña **Responder**", "Envía a través de Meta al Facebook, Instagram o WhatsApp de la persona. Desactivada, con la razón impresa encima, cuando no hay ninguna página conectada, la conexión hay que rehacerla, o FieldQuo sigue esperando la aprobación de Meta."],
              ["Pestaña **Nota**", "Guarda una nota privada en el hilo. **Solo su equipo ve esto. Nunca se envía.** La conexión nunca la bloquea."],
              ["**Marcar terminada** / **Reabrir**", "Pone el estado en **Resuelta** (la fila pasa a Terminadas) o lo devuelve a **Abierta**."],
              ["Chip de resultado", "**Ganada**, **Perdida**, **Sin respuesta**, **No es un trabajo**, o de vuelta a **Abierta**, que borra la evaluación. El resumen cuenta una evaluación borrada como no hecha."],
              ["**¿Cómo va esta conversación?**", "**Abierta**, **Esperando su respuesta**, **Apartada** (pide una fecha), **Resuelta**; vea [[conversation-status-and-who-looks-after-it|El estado de una conversación y quién se encarga]]."],
              ["**Se encarga**", "Entrega la conversación a una persona de su equipo, o **Nadie todavía**."],
              ["**Abrir cliente** y los otros enlaces", "Van al cliente, lead, trabajo o presupuesto vinculado a la conversación. Una tarjeta de contacto que la persona envíe puede convertirse en cliente con **Añadir como cliente**."],
            ],
          } },
        ],
      },
      {
        id: "staying-on-top",
        heading: "Saber cuándo alguien responde",
        blocks: [
          { p: "Mientras la pestaña está abierta, la lista se vuelve a leer una vez por minuto. Una respuesta que llega aparece como un aviso en la pestaña donde usted está, o como una notificación del sistema cuando la bandeja está en una pestaña en segundo plano — **Nuevo mensaje de Maria Lopez** con la primera línea de lo que escribió. FieldQuo también envía el mismo aviso a los teléfonos de todos los que pueden leer la bandeja, una vez activadas las notificaciones del navegador en **Configuración → Notificaciones**; vea [[notifications-for-you|Notificaciones para usted: correo y navegador]]." },
          { tip: "La etiqueta **Esperando 3 días** se mide desde el último mensaje de la persona y se borra cuando alguien de la empresa responde, sea desde FieldQuo, desde la bandeja de Meta o desde un teléfono. Escribir una nota no la borra: una nota no es una respuesta." },
        ],
      },
      {
        id: "only-in-fieldquo",
        heading: "Lo que las otras herramientas no hacen",
        blocks: [
          { p: "Las páginas de comparación de FieldQuo registran lo que cada competidor imprime en su propia página de precios, en cada nivel. Ninguna de las páginas registradas nombra una bandeja de Facebook, Instagram o WhatsApp; el nivel Core+ de Projul dice «messaging» sin precisar el canal. Lo que FieldQuo añade a una bandeja es el resultado en cada conversación y el resumen mensual construido a partir de él: qué conversaciones se convirtieron en trabajos y con qué rapidez se respondió a las ganadas." },
          { p: "Las propias páginas de comparación de FieldQuo todavía no incluyen esta función, a propósito: hasta que Meta apruebe la mensajería de páginas para la aplicación, una página pública estaría vendiendo algo que una empresa nueva no puede activar. Este artículo dice lo mismo." },
        ],
      },
      {
        id: "who-can-see-it",
        heading: "Quién puede verla",
        blocks: [
          { p: "Leer la bandeja requiere **Requests** (solicitudes) en solo lectura o más en la cuadrícula de accesos: un mensaje entrante es una solicitud de un desconocido. Los perfiles Estimador, Despachador y Gerente, y el dueño y los administradores, lo tienen; el perfil Cuadrilla (**Requests: none**) es rechazado. Responder, escribir una nota, cambiar el estado, el resultado o quién se encarga requiere **Requests** en ver, crear y editar: Estimador y superiores. Alguien en solo lectura ve **Puedes leer esta conversación pero no responder: tu acceso a solicitudes es solo de lectura.** Vea [[access-levels-overview|Los niveles de acceso]]." },
        ],
      },
    ],
    faq: [
      { q: "¿Por qué el cuadro de respuesta está en gris?", a: "Lea la frase que tiene encima. Es una de cuatro: todavía no hay ninguna página conectada, la página hay que reconectarla, FieldQuo está esperando la aprobación de Meta para la mensajería de páginas, o es una conversación de ejemplo. La pestaña Nota funciona en todos los casos." },
      { q: "¿Puedo borrar una conversación?", a: "No. Márquela terminada, o evalúela como No es un trabajo, y sale de la lista de trabajo. Nada de lo que escribió un cliente se elimina." },
      { q: "¿FieldQuo lee mi Messenger o mi Instagram personal?", a: "No. Solo la página y la cuenta profesional que usted conectó, y solo sus conversaciones de negocio." },
      { q: "¿Adónde van estas conversaciones en el resto de FieldQuo?", a: "A ningún sitio por sí solas. Vincule una a un cliente, lead, trabajo o presupuesto desde la pestaña Detalles y el hilo lleva el enlace; el resumen mensual archiva la conversación en el mes en que empezó." },
    ],
  },

  "connect-your-facebook-page-and-instagram": {
    title: "Conectar su página de Facebook e Instagram",
    summary:
      "La única conexión, en Configuración → Meta Ads, que permite a FieldQuo publicar en su página y su Instagram y, en cuanto Meta lo apruebe, responder sus mensajes en su bandeja.",
    updated: "2026-09-12",
    intro: [
      "Su página de Facebook y la cuenta profesional de Instagram vinculada a ella se conectan una sola vez, desde la tarjeta **Publicación en Facebook e Instagram** de **Configuración → Meta Ads**. Una pantalla de consentimiento, una conexión guardada, y alimenta dos cosas: publicar un diseño del Creador de marketing y la [[the-messages-inbox|bandeja de Mensajes]]. Un contratista piensa «conecté mi página», no «la conecté dos veces», así que FieldQuo no pregunta dos veces.",
      "La tarjeta es honesta sobre lo que Meta ha aprobado o no para la aplicación de FieldQuo. Mientras un permiso está pendiente lo dice y no dibuja ningún botón; una conexión guardada pero incapaz de entregar mensajes nombra el permiso que falta en lugar de aparentar que todo está bien.",
    ],
    sections: [
      {
        id: "overview",
        heading: "Resumen",
        blocks: [
          { p: "**Configuración → Meta Ads** reúne todas las conexiones con Meta de una empresa: la cuenta publicitaria (el gasto en sus cifras de marketing), los **Formularios de clientes potenciales de Facebook** (hacia Prospectos), **Publicación en Facebook e Instagram** y **WhatsApp Business**. Son conexiones distintas con permisos distintos: conectar la cuenta publicitaria no conecta la página. Vea [[connect-meta-ads|Conectar su cuenta publicitaria de Meta]] y [[facebook-lead-forms|Formularios de clientes potenciales de Facebook]] para las dos primeras." },
          { p: "La conexión de la página guarda un token de acceso, cifrado, y el identificador y el nombre de la página. El token nunca se muestra en pantalla y nunca sale del servidor." },
        ],
      },
      {
        id: "what-is-on-the-screen",
        heading: "Qué hay en la tarjeta",
        blocks: [
          { bullets: [
            "**Esperando la aprobación de Meta**: publicar o recibir mensajes requiere permisos que Meta debe conceder primero a FieldQuo. Sin botón; **No falta nada de su parte.**",
            "**Ninguna página conectada** con **Conectar Facebook e Instagram**: el flujo está abierto y todavía no hay nada guardado.",
            "**¿Qué página?**: Meta devolvió más de una página para su inicio de sesión; elija una y pulse **Conectar esta página**.",
            "Conectada: el nombre de la página, luego el **@usuario** de la cuenta de Instagram vinculada, o **No hay ninguna cuenta de Instagram vinculada a esta página: solo Facebook.**",
            "Una línea sobre los mensajes: **Meta está enviando los mensajes de esta página a FieldQuo — activado el …**, o **Los mensajes de esta página no llegan a FieldQuo** con **Volver a intentar la suscripción**, o una frase que nombra los permisos que Meta aún no concede.",
            "**Tu bandeja de entrada aún no está activada para esta página** con **Activar la bandeja de entrada**: solo para una página conectada antes de que existiera la bandeja.",
            "**Importar conversaciones anteriores** con **Última importación: …**, luego **Conectado por Jon Smith el …**, **Reconectar o cambiar de página** y **Desconectar**.",
          ] },
        ],
      },
      {
        id: "how-to-connect",
        heading: "Cómo conectar",
        blocks: [
          { steps: [
            "Abra **Configuración → Meta Ads** (bajo **Cobros**) y baje hasta **Publicación en Facebook e Instagram**.",
            "Si la tarjeta dice **Esperando la aprobación de Meta**, deténgase aquí: no hay nada que hacer hasta que cambie. Si no, pulse **Conectar Facebook e Instagram**.",
            "Inicie sesión en Facebook y marque todos los permisos que Meta muestre. Desmarcar uno le deja una conexión que parece correcta y falla en el momento de publicar o recibir un mensaje; la tarjeta nombra después el permiso que falta.",
            "Si administra varias páginas, elija la que usa su empresa para publicar bajo **¿Qué página?** y pulse **Conectar esta página**.",
            "De vuelta en la tarjeta, revise la línea de los mensajes. Cuando diga **Meta está enviando los mensajes de esta página a FieldQuo**, las conversaciones nuevas llegan solas a Mensajes.",
          ] },
          { figure: "live:app-settings-meta-ads", caption: "Configuración → Meta Ads — la tarjeta de la cuenta publicitaria, los formularios de clientes potenciales de Facebook, una página conectada con su cuenta de Instagram y la línea de mensajes, y la tarjeta de WhatsApp Business." },
        ],
      },
      {
        id: "after-connecting",
        heading: "Después de conectar",
        blocks: [
          { bullets: [
            "**Importar conversaciones anteriores** trae lo que la página ya tenía, hasta 30 días atrás, e informa **12 conversaciones importadas · 3 nuevas**. Es la misma importación que el botón **Actualizar desde Facebook** de la bandeja. Puede ejecutarse una vez cada diez minutos; antes de eso se lee **Se actualizó hace un momento; inténtalo de nuevo en unos minutos.**",
            "**Activar la bandeja de entrada** aparece solo cuando Meta concedió la mensajería para esta página pero la bandeja nunca se configuró para recibirla; se arregla con un clic.",
            "**Volver a intentar la suscripción** vuelve a pedir a Meta que envíe los mensajes de esta página, sin tocar el resto de la conexión. Publicar en la página sigue funcionando mientras los mensajes no llegan.",
            "Una conexión cuyo token deja de funcionar muestra **La conexión con tu página dejó de funcionar. Vuelve a conectarla para seguir recibiendo mensajes.** en la parte superior de Mensajes, con un enlace a esta tarjeta.",
          ] },
        ],
      },
      {
        id: "disconnecting",
        heading: "Desconectar",
        blocks: [
          { p: "**Desconectar** pregunta **¿Desconectar Facebook e Instagram?** y después borra de inmediato el token de acceso guardado. FieldQuo ya no puede publicar ni lanzar publicaciones programadas para la página; lo ya publicado sigue en Facebook e Instagram, y las conversaciones que ya están en su bandeja se quedan en FieldQuo." },
          { warning: "Si Meta no confirma que dejó de enviar los mensajes de la página, la tarjeta lo dice: quite FieldQuo de las integraciones comerciales de la página en la configuración de Meta para asegurarse." },
        ],
      },
      {
        id: "who-can-see-it",
        heading: "Quién puede verla",
        blocks: [
          { p: "**Configuración → Meta Ads** está en el mismo estante que Pagos: solo el dueño y los administradores. Un Gerente o un Despachador no ve la fila, y cada ruta detrás de ella los rechaza. Una vez conectada la página, cualquiera con **Requests** en solo lectura lee la bandeja; vea [[the-messages-inbox|La bandeja de Mensajes]]." },
        ],
      },
    ],
    faq: [
      { q: "¿Necesito una cuenta publicitaria de Meta para conectar mi página?", a: "No. La cuenta publicitaria y la página son dos tarjetas distintas con dos pantallas de consentimiento distintas." },
      { q: "Mi cuenta de Instagram no aparece.", a: "La tarjeta dice solo Facebook cuando no hay ninguna cuenta profesional de Instagram vinculada a la página en la configuración de Meta. Vincúlela allí y luego pulse Reconectar o cambiar de página." },
      { q: "¿Puede un Gerente conectar la página?", a: "No. Meta Ads es solo para el dueño y los administradores, igual que Pagos." },
    ],
  },

  "whatsapp-business": {
    title: "Mensajes de WhatsApp Business",
    summary:
      "Su propio número de WhatsApp Business atendido en la misma bandeja que Facebook e Instagram, con la regla de las 24 horas que impone el propio WhatsApp y las plantillas aprobadas que la superan.",
    updated: "2026-09-12",
    intro: [
      "El número de WhatsApp Business de un contratista se conecta desde la tarjeta **WhatsApp Business** de **Configuración → Meta Ads**, a través del registro de Meta, y desde entonces cada mensaje que un cliente envía a ese número llega a [[the-messages-inbox|Mensajes]] bajo el chip **WhatsApp**, junto a Facebook e Instagram. Llegan fotos, videos, mensajes de voz, documentos, stickers, tarjetas de contacto y ubicaciones; se pueden enviar de vuelta fotos, videos, documentos y su propia dirección.",
      "Una regla sorprenderá a quien solo haya usado WhatsApp en un teléfono: en un número de empresa, WhatsApp rechaza un mensaje escrito más de **24 horas** después del último mensaje del cliente. FieldQuo dice en qué caso está usted en cada conversación y ofrece la salida — una plantilla aprobada de antemano por Meta — en lugar de dejar que el envío falle después de pulsar el botón.",
    ],
    sections: [
      {
        id: "overview",
        heading: "Resumen",
        blocks: [
          { p: "La conexión necesita un permiso que Meta aprueba por aplicación. Mientras está pendiente, la tarjeta dice **Esperando la aprobación de Meta** sin botón, y una dirección escrita a mano tampoco puede iniciar el flujo: el servidor la rechaza con la misma frase. Cuando el flujo está abierto, la tarjeta dice **Ningún número de WhatsApp conectado** con **Conectar WhatsApp**." },
          { p: "Debajo del botón hay una sección plegada, **Conectar con credenciales de Cloud API (avanzado)**. Existe para quienes administran la propia aplicación de Meta de FieldQuo y es la puerta equivocada para todos los demás; el botón de registro es el que Meta quiere que use una empresa." },
        ],
      },
      {
        id: "connect-your-number",
        heading: "Cómo conectar su número",
        blocks: [
          { steps: [
            "Abra **Configuración → Meta Ads** y baje hasta **WhatsApp Business**.",
            "Pulse **Conectar WhatsApp**. Meta le guía para iniciar sesión, elegir o crear una cuenta de WhatsApp Business y escoger el número de teléfono al que le escriben sus clientes.",
            "De vuelta en la tarjeta, el número aparece con su nombre verificado, **Conectado mediante el registro de Meta** y el teléfono tal como Meta lo imprime. Los mensajes empiezan a llegar a la bandeja enseguida.",
            "Pulse **Actualizar plantillas** para leer sus plantillas de mensaje desde Meta. La tarjeta lista cada una con su idioma y el estado que le da Meta: **APPROVED**, o lo que Meta indique.",
          ] },
          { figure: "live:app-settings-meta-ads", caption: "Configuración → Meta Ads — la tarjeta de WhatsApp Business al final, con Conectar WhatsApp y la sección avanzada plegada." },
          { note: "Un número que no recibe es peor que ninguno: si FieldQuo no puede suscribirse a los mensajes del número, no se conecta nada y la tarjeta lo dice: **FieldQuo no pudo suscribirse a sus mensajes, así que no se conectó nada: un número que no recibe es peor que ninguno. Inténtelo otra vez.**" },
        ],
      },
      {
        id: "the-24-hour-rule",
        heading: "La regla de las 24 horas",
        blocks: [
          { p: "La tarjeta la enuncia donde usted conecta: **WhatsApp solo entrega un mensaje escrito durante las 24 horas siguientes al último mensaje del cliente. Después puede seguir contactándolo, pero solo con una plantilla aprobada de antemano por Meta.** La ventana se reinicia cada vez que el cliente vuelve a escribir. FieldQuo la calcula antes de que usted escriba, así que el cuadro de redacción cambia de forma en lugar de fallar después de Enviar." },
          { table: {
            head: ["Qué muestra la conversación", "Qué puede enviar"],
            rows: [
              ["Nada: la ventana está abierta", "Cualquier cosa: texto, una foto, un video, un documento, su dirección"],
              ["**Queda menos de una hora para responder.**", "Cualquier cosa, por ahora; responda antes de que se cierre"],
              ["**Han pasado más de 24 horas desde su último mensaje, así que WhatsApp no aceptará un mensaje escrito.**", "Una **Plantilla aprobada** del selector que reemplaza al cuadro de texto, con sus valores para completar"],
              ["**Esta persona nunca le ha escrito por WhatsApp…**", "Solo una plantilla aprobada puede iniciar la conversación"],
            ],
          } },
          { p: "Un envío que de todos modos rompa la regla — un desajuste de reloj, un mensaje que FieldQuo nunca recibió — es rechazado por WhatsApp y aparece en el hilo como una respuesta fallida con la razón, y la fila muestra **No entregado**." },
        ],
      },
      {
        id: "templates",
        heading: "Las plantillas",
        blocks: [
          { p: "Las plantillas se escriben y se envían a revisión en el Administrador de WhatsApp de Meta, no en FieldQuo. FieldQuo las lee con **Actualizar plantillas**, ofrece solo las que Meta marcó **APPROVED** y envía por identificador de plantilla con sus valores para completar; nunca las palabras de la plantilla reescritas, para que una plantilla aprobada no pueda usarse como sobre para otra cosa. Una plantilla rechazada se queda en la lista con su estado, porque «rechazada» es el dato que usted necesita." },
          { tip: "Sin plantilla aprobada, el selector dice **Todavía no tiene plantillas de WhatsApp aprobadas. Cree una en el Administrador de WhatsApp de Meta y luego actualice la lista en Ajustes.** Escriba una antes de necesitarla: un cliente que escribió el viernes y recibe respuesta el lunes está fuera de la ventana." },
        ],
      },
      {
        id: "photos-files-and-your-address",
        heading: "Fotos, archivos y su dirección",
        blocks: [
          { bullets: [
            "**Adjuntar un archivo**: solo en WhatsApp, del lado Responder. Fotos JPEG o PNG de hasta 5 MB (una foto de teléfono más grande, hasta 25 MB, se reduce para que quepa), video MP4 o 3GP de hasta 16 MB, y documentos PDF, Word, Excel, PowerPoint o texto plano de hasta 100 MB. El cuadro de texto pasa a ser **Añade un pie de foto (opcional)**.",
            "**Enviar nuestra dirección**: la ubicación de su propia empresa, dibujada solo cuando la dirección de la empresa se eligió en el mapa y por lo tanto tiene coordenadas. Una ubicación se envía sola; WhatsApp no lleva texto con ella, y el cuadro lo dice.",
            "**Los mensajes de voz, stickers y tarjetas de contacto llegan aquí, pero todavía no se pueden enviar.** Una tarjeta de contacto que comparta un cliente ofrece **Añadir como cliente**; una ubicación ofrece **Guardar como dirección de Sam** en un cliente vinculado.",
            "Las respuestas de Facebook e Instagram llevan solo texto; el clip no se dibuja ahí.",
          ] },
        ],
      },
      {
        id: "only-in-fieldquo",
        heading: "Lo que las otras herramientas no hacen",
        blocks: [
          { p: "Ninguna de las páginas de precios de la competencia que registran las páginas de comparación de FieldQuo incluye WhatsApp en ningún nivel. Las propias páginas de FieldQuo tampoco lo incluyen todavía, a propósito, hasta que Meta apruebe el permiso; y el texto que resulte llevará la frase de las 24 horas de arriba, porque una página que promete «escriba a sus clientes por WhatsApp» sin ella promete algo que WhatsApp no permite." },
        ],
      },
      {
        id: "who-can-see-it",
        heading: "Quién puede verlo",
        blocks: [
          { p: "Conectar y desconectar un número, y actualizar las plantillas, se hace en **Configuración → Meta Ads**: solo el dueño y los administradores. Leer y responder las conversaciones sigue la regla de la bandeja: **Requests** en solo lectura para leer, en ver, crear y editar para responder. Vea [[the-messages-inbox|La bandeja de Mensajes]]." },
        ],
      },
    ],
    faq: [
      { q: "¿Puedo usar mi número personal de WhatsApp?", a: "Solo como número de WhatsApp Business elegido o creado en el registro de Meta. FieldQuo nunca lee una cuenta personal." },
      { q: "¿Por qué solo puedo enviar una plantilla?", a: "Pasaron más de 24 horas desde el último mensaje del cliente, o esa persona nunca le escribió por WhatsApp. WhatsApp rechaza el texto escrito en ambos casos; el selector de plantillas es la salida." },
      { q: "¿Desconectar borra las conversaciones?", a: "No. El número se marca como desconectado y deja de recibir; lo que ya está en la bandeja se queda." },
    ],
  },

  "conversation-status-and-who-looks-after-it": {
    title: "El estado de una conversación y quién se encarga",
    summary:
      "Los cuatro estados por los que pasa una conversación, qué hace apartarla y cuándo vuelve, en qué se diferencia el resultado del estado, y cómo entregar un hilo a una persona.",
    updated: "2026-09-12",
    intro: [
      "Cada conversación de [[the-messages-inbox|Mensajes]] responde dos preguntas en su pestaña **Detalles**: **¿Cómo va esta conversación?** — su estado — y **Se encarga** — la persona de su equipo a quien pertenece. El estado decide en qué grupo está la fila; la persona es a quien la oficina pregunta cuando un cliente llama para dar seguimiento.",
      "Una tercera pregunta, **¿Se convirtió en un trabajo?**, es el resultado, y está separada a propósito: un estado es lo que pasa ahora, un resultado es en qué acabó la conversación. Los dos se escriben en el historial del hilo con un nombre y una hora.",
    ],
    sections: [
      {
        id: "overview",
        heading: "Resumen",
        blocks: [
          { p: "Una conversación nueva está **Abierta** y se queda en **Por responder** mientras la última palabra sea del cliente. En cuanto usted responde, pasa a **Esperando su respuesta**. Desde ahí puede apartarla hasta una fecha (**Apartada**) o cerrarla (**Resuelta**, el grupo **Terminadas**). Un cliente que vuelve a escribir reabre por sí solo una conversación resuelta, en espera o apartada; sin tarea programada, sin botón." },
        ],
      },
      {
        id: "the-four-statuses",
        heading: "Los cuatro estados",
        blocks: [
          { table: {
            head: ["Estado", "Qué grupo", "Qué significa"],
            rows: [
              ["**Abierta**", "Por responder, o Esperando su respuesta una vez que usted respondió", "En curso. La etiqueta de espera cuenta desde el último mensaje del cliente."],
              ["**Esperando su respuesta**", "Esperando su respuesta", "Usted preguntó algo y la pelota está del lado del cliente. Se fija a mano cuando quiere sacarla de Por responder sin haber respondido."],
              ["**Apartada**", "Apartadas", "Estacionada hasta una fecha y hora que usted elige. **Vuelve el 14 sep** aparece en el selector."],
              ["**Resuelta**", "Terminadas (plegado por defecto)", "Terminada. **Marcar terminada** en el encabezado la fija; **Reabrir** la quita."],
            ],
          } },
        ],
      },
      {
        id: "snoozing",
        heading: "Cómo apartar una conversación",
        blocks: [
          { steps: [
            "Abra la conversación y pulse **Detalles**.",
            "Bajo **¿Cómo va esta conversación?** elija **Apartada**. El selector muestra **¿Cuándo la traemos de vuelta?** con una fecha y una hora; el estado no se escribe hasta que haya una, porque «estacionada hasta algún momento» es como desaparece un lead.",
            "Pulse **Apartarla**. El hilo registra **Apartada hasta una fecha por Dave** y la fila pasa a **Apartadas**.",
            "Vuelve por sí sola. Una tarea programada corre cada quince minutos; cuando la hora ya pasó, el estado vuelve a **Abierta**, la fila regresa a la lista de trabajo y el historial dice **Volvió en su fecha**. **Traerla ahora** la despierta antes.",
          ] },
          { note: "Si el cliente escribe mientras la conversación está apartada, se despierta de inmediato y la fecha límite se borra, así que no puede volver una segunda vez." },
        ],
      },
      {
        id: "outcomes",
        heading: "Marcar terminada, y el resultado",
        blocks: [
          { bullets: [
            "**Marcar terminada** pone el estado en **Resuelta**. No dice nada sobre si usted ganó el trabajo.",
            "El chip de resultado en el encabezado — y el selector bajo **¿Se convirtió en un trabajo?** en la pestaña **Resultado** — registra **Ganada** (se convirtió en un trabajo), **Perdida** (se fueron con otro, o dijeron que no), **Sin respuesta** (nadie de la empresa respondió, o dejaron de escribir después de que usted respondió) o **No es un trabajo** (un proveedor, una candidatura, spam; fuera de la tasa de cierre).",
            "Elegir cualquier resultado pasa la fila a **Terminadas**, sea cual sea su estado. Elegir **Abierta** borra el resultado; el resumen mensual cuenta entonces la conversación como sin evaluar, nunca como perdida.",
            "Cada cambio es una línea en el hilo y en la pestaña **Historial**: **Marcada como Ganada por Dave**, **Resultado borrado por Ana**, **Marcada como resuelta**.",
          ] },
        ],
      },
      {
        id: "looking-after-this",
        heading: "Se encarga",
        blocks: [
          { p: "**Se encarga** lista a las personas de su equipo a quienes se puede asignar un lead — la misma lista que usa el tablero de prospectos — con **Nadie todavía** por defecto. Elegir un nombre escribe **Asignada a Marc por Dave** en el historial; elegir a nadie escribe **Sin asignar por Dave**. Es una etiqueta que la oficina lee, no un filtro: la conversación se queda en el mismo grupo, y todos los que pueden leer la bandeja la siguen viendo." },
          { tip: "Asignar es la respuesta a «¿quién habló con ella la última vez?» cuando el cliente llama. Anótelo aquí y no en una nota, para que aparezca en la pestaña Detalles y en el historial." },
        ],
      },
      {
        id: "who-can-change-it",
        heading: "Quién puede cambiarlo",
        blocks: [
          { p: "Cambiar el estado, el resultado o la persona asignada requiere **Requests** en ver, crear y editar: Estimador, Despachador, Gerente, dueño y administradores. Alguien con solo lectura ve el estado y el resultado actuales como palabras, sin selector; el servidor también rechaza el cambio, así que no es el control oculto lo que lo mantiene seguro." },
        ],
      },
    ],
    faq: [
      { q: "¿Cuál es la diferencia entre Resuelta y Ganada?", a: "Resuelta es un estado: la conversación terminó por ahora. Ganada es un resultado: se convirtió en un trabajo. Una conversación resuelta sin resultado aparece como Todavía sin evaluar en el resumen." },
      { q: "¿Puedo apartar sin fecha?", a: "No. Apartarla queda desactivado hasta que elija una fecha y una hora, y el servidor rechaza un apartado sin fecha." },
      { q: "¿Asignar a alguien le avisa?", a: "No. Escribe su nombre en la conversación y en su historial; no se envía nada." },
    ],
  },

  "private-notes-and-temperature": {
    title: "Notas privadas y el chip de temperatura",
    summary:
      "Cómo dejar una nota que solo su equipo puede leer, por qué una nota no es una respuesta, y cómo el chip Tibia 35 de cada conversación se calcula a partir de lo que la persona hizo de verdad.",
    updated: "2026-09-12",
    intro: [
      "Dos cosas acompañan a una conversación sin llegar nunca al cliente. Una **Nota** es lo que usted escribe para la próxima persona que abra el hilo: «exigente con el color de las molduras, presupuesto alto, está comparando». El **chip de temperatura** — **Tibia 35**, **Caliente 72**, **Fría 0** — es lo que FieldQuo lee en la propia conversación, con las razones listadas, para que sepa antes de dedicar una tarde a un presupuesto si esa persona está decidiendo o solo mirando.",
      "El chip anota; nunca filtra. Una conversación fría está en la lista exactamente donde estaría sin puntuación.",
    ],
    sections: [
      {
        id: "overview",
        heading: "Resumen",
        blocks: [
          { p: "Una nota se guarda en el hilo como una fila de un tipo propio, pintada en un tono distinto para que nunca se confunda con un mensaje, y pasa por una ruta distinta de la de una respuesta: una que no importa en absoluto la vía de envío. Es deliberado: la opinión de un compañero sobre un cliente nunca debe estar a un ajuste invertido de la bandeja de ese cliente." },
        ],
      },
      {
        id: "write-a-note",
        heading: "Cómo escribir una nota",
        blocks: [
          { steps: [
            "Abra la conversación y pulse la pestaña **Nota** sobre el cuadro. El cuadro cambia de color y el texto de ejemplo dice **Exigente con el color de las molduras. Presupuesto alto: está comparando.**",
            "Escríbala y pulse **Guardar la nota**. Bajo el cuadro se lee **Solo su equipo ve esto. Nunca se envía.**",
            "La nota aparece en el hilo a la hora en que la guardó, con su nombre, para todos los que pueden leer la bandeja.",
          ] },
          { note: "La pestaña Nota nunca queda bloqueada por la conexión. Incluso mientras FieldQuo espera la aprobación de Meta y la pestaña Responder está desactivada, una nota se puede guardar." },
        ],
      },
      {
        id: "what-a-note-does-not-do",
        heading: "Qué hace y qué no hace una nota",
        blocks: [
          { bullets: [
            "No borra la etiqueta **Esperando** ni saca la fila de **Por responder**. Escribir «es exigente» no es responderle.",
            "No cuenta como respuesta en el tiempo de primera respuesta del resumen mensual.",
            "No lleva adjuntos: una nota nunca sale de la empresa, así que una foto en ella no iría a ninguna parte.",
            "Queda fuera de la puntuación de temperatura, que lee solo lo que usted y el cliente se dijeron de verdad.",
          ] },
        ],
      },
      {
        id: "the-temperature-chip",
        heading: "El chip de temperatura",
        blocks: [
          { p: "Cada conversación empieza en **35**, el piso de tibia: alguien le escribió a un contratista, que es más de lo que hace la mayoría, así que lo frío hay que ganárselo con algo que se dijo. **Caliente** es 60 o más, **Tibia** de 30 a 59, **Fría** por debajo de 30: las mismas franjas que la puntuación de un lead en el tablero de prospectos, para que una misma persona nunca lleve dos palabras distintas para una sola idea. Lo que cambia es el peso. Un formulario mide el esfuerzo: presupuesto, fotos, cuánto escribieron. Una conversación mide lo que la persona **hizo**." },
          { table: {
            head: ["Qué hizo la persona", "Puntos"],
            rows: [
              ["**Preguntaron cómo se hace esto — pagar, empezar o entrar**", "+30, más 6 por cada vez adicional, hasta 12 más"],
              ["**Añadieron trabajo que nadie les había propuesto**", "+20"],
              ["**Movieron sus propias fechas para ajustarse a las suyas**", "+18"],
              ["**Discutieron una partida, no sus precios**", "+12"],
              ["**Dijeron que están pidiendo otros presupuestos**", "−30"],
              ["**Dijeron que no por adelantado, con educación**", "−22"],
              ["**Presupuestado, insistido y sin respuesta**", "−25"],
              ["**Dieron una cifra de presupuesto** · **Preguntaron por materiales y acabados**", "0: visto, deliberadamente sin valor"],
            ],
          } },
          { p: "Cuatro cosas cierran la discusión, se haya dicho lo que se haya dicho — **Dijeron estar en un sitio donde usted no trabaja**, **Su presupuesto está por debajo de lo que cuesta este trabajo**, **Quieren una gama de trabajo más barata de la que usted vende**, **Dijeron que no querían esto** — y bajan la puntuación a fría, con la frase citada debajo: **Conviene aclararlo antes de dedicar una tarde a un presupuesto. Usted conoce el oficio — si esto está mal, ignórelo.**" },
          { p: "Con menos de cinco mensajes, el veredicto se limita a tibia y el chip dice **sin certeza**: **Se ha dicho demasiado poco aquí para estar seguro. Es una primera lectura, no un veredicto.** El panel de la pestaña **Resultado** lista cada razón con el fragmento que la activó, en el idioma del lector." },
        ],
      },
      {
        id: "read-it-with-fieldquo-ai",
        heading: "Leerla con FieldQuo AI",
        blocks: [
          { p: "Las reglas no ven dos cosas que comparten las conversaciones que ganan: si la persona escribió como quien decide («hágalo») o como quien duda («si el precio está bien»), y si le contó algo personal que no tenía nada que ver con el trabajo. **Leer esta conversación**, en la pestaña Resultado, envía el hilo a FieldQuo AI exactamente para esas dos cosas, con sus propias conversaciones recientes ganadas y perdidas como ejemplos. Puede mover la puntuación una franja como máximo, hacia arriba o hacia abajo, y nunca puede anular uno de los cuatro motivos de descarte: ese rechazo está en el código, no en la instrucción." },
          { note: "Se paga con su cuota mensual de IA y lo dice primero: **Usa unos … de su cuota mensual de IA. Le quedan … este mes.** Necesita al menos 4 mensajes, se niega a releer un hilo al que no se añadió nada, y no guarda nada cuando la cuota se agotó: la puntuación de las reglas se mantiene. Vea [[ai-credit-and-phone-credit|Crédito de IA y crédito telefónico]]." },
        ],
      },
      {
        id: "who-can-see-it",
        heading: "Quién puede verlo",
        blocks: [
          { p: "Cualquiera que pueda leer la bandeja (**Requests** en solo lectura) lee las notas y el chip. Escribir una nota, y pedir a FieldQuo AI que lea una conversación, requieren **Requests** en ver, crear y editar: Estimador y superiores." },
        ],
      },
    ],
    faq: [
      { q: "¿Puede un cliente ver una nota?", a: "No. Las notas se guardan por una ruta que no puede enviar, y se dibujan en su propio color para que nadie las confunda con una respuesta." },
      { q: "¿Por qué una conversación está en Tibia 35 sin que se haya dicho nada?", a: "35 es la puntuación de partida. No se ha dicho nada decisivo en ningún sentido; el chip se moverá cuando la persona haga algo que las reglas reconozcan." },
      { q: "¿Por qué la lectura de IA no cambia nada?", a: "Solo puede ajustar una franja y nunca más allá de un motivo de descarte; cuando no encuentra ni compromiso ni una confidencia personal, dice No encontró nada que cambiar." },
    ],
  },

  "the-ai-employee": {
    title: "El empleado de IA: borradores que usted aprueba",
    summary:
      "Contrate un asistente para un puesto — cierre de ventas, recepcionista o soporte técnico — que responde el mensaje de un cliente con su propia lista de precios y su material, escribe un borrador y espera a que usted lo envíe.",
    updated: "2026-09-12",
    intro: [
      "**Configuración → Empleado de IA** es donde usted contrata un asistente que responde los mensajes que llegan a [[the-messages-inbox|Mensajes]]. Elige el puesto que ocupa, cómo escribe, qué puede leer y si redacta o envía. Por defecto redacta: **Escribe la respuesta y espera. Nada llega al cliente hasta que usted pulse enviar.**",
      "La fila del menú lleva una etiqueta **Vista previa**, y la pantalla se abre con lo único que todavía no puede hacer: **Las respuestas todavía no pueden salir. El empleado de IA responde sus mensajes de Facebook e Instagram, y Meta no ha aprobado la mensajería para FieldQuo. Aquí todo funciona: redacta, y los borradores esperan abajo a que usted los envíe.** Configúrelo, aliméntelo, pruébelo con el código real; el envío espera a Meta.",
    ],
    sections: [
      {
        id: "overview",
        heading: "Resumen",
        blocks: [
          { p: "El puesto es un conjunto de capacidades, no una personalidad. Una **Recepcionista** no tiene forma de consultar un precio — no es que «se le dijo que no», es que no se le dio la herramienta — así que un propietario que pregunta tres veces no puede sacarle uno. Todos los puestos comparten las mismas reglas absolutas: nunca puede inventar un precio, una fecha ni una política; si no está en sus propios datos o en su propio material, entrega la conversación a una persona. Nunca dice ser una persona con nombre y, si se lo preguntan directamente, dice que la respuesta es automática y que un miembro del equipo dará seguimiento." },
        ],
      },
      {
        id: "what-is-on-the-screen",
        heading: "Qué hay en la pantalla",
        blocks: [
          { bullets: [
            "**¿Qué puesto ocupa?**: cuatro tarjetas, **Cierre de ventas**, **Recepcionista**, **Soporte técnico**, **Otra cosa**, cada una con **It can:** e **It cannot:** debajo.",
            "**Cómo escribe**: **Cómo lo llama usted** (para usted, nunca se dice a los clientes), **Tono** (professional, warm o brief), **Frase de apertura (opcional)**, **Sus instrucciones**, **Cuándo debe buscar a una persona**.",
            "**¿Borrador o envío?**: **Escríbame un borrador (recomendado)** o **Enviarla automáticamente**.",
            "**Límites**: **Responder solo en horario de atención**, **Máximo de respuestas en una conversación**, **Activar el empleado de IA**, y luego **Guardar**.",
            "**Lo que lee**: **Subir un archivo** o **Pegar texto en su lugar**, y la lista de lo que ha leído.",
            "**Pruébelo**: un cuadro de prueba que ejecuta la vía de respuesta real, luego **Esperándolo a usted** (los borradores) y **Se detuvo en estas**.",
          ] },
        ],
      },
      {
        id: "hire-it",
        heading: "Cómo contratarlo",
        blocks: [
          { steps: [
            "Abra **Configuración → Empleado de IA** y elija un puesto. **Cierre de ventas** es el único puesto autorizado a acercarse a una cifra: lee su lista de precios y puede armar una cotización instantánea con sus propias tarifas. **Recepcionista** toma los datos y agenda una devolución de llamada. **Soporte técnico** responde con el material que usted sube y nombra el documento.",
            "Complete **Sus instrucciones** — zonas que cubre, lo que no hace, cómo le gusta que se digan las cosas — y **Cuándo debe buscar a una persona** («cualquier cosa sobre una fuga, quien pregunte por el dueño»).",
            "Deje seleccionado **Escríbame un borrador (recomendado)**. Fije **Máximo de respuestas en una conversación**: 3 por defecto; después de eso se detiene y le deja el hilo, y cero lo pausa sin perder su configuración.",
            "Bajo **Lo que lee**, suba su política, sus notas de diagnóstico o un manual, o pegue el texto.",
            "Marque **Activar el empleado de IA** y pulse **Guardar**. Luego escriba el mensaje de un cliente bajo **Pruébelo** y pulse **Ver la respuesta**: nombra los documentos y herramientas que usó, y lo que costó la prueba.",
          ] },
          { figure: "live:app-settings-ai-employee", caption: "Configuración → Empleado de IA — los cuatro puestos con lo que cada uno puede y no puede hacer, Cómo escribe, Borrador o envío, y Límites." },
        ],
      },
      {
        id: "what-each-setting-changes",
        heading: "Qué cambia cada ajuste",
        blocks: [
          { table: {
            head: ["Ajuste", "Qué hace"],
            rows: [
              ["El puesto", "Fija las herramientas que puede llamar. Cierre de ventas: consultar los precios de sus servicios, crear una cotización instantánea, agendar una devolución de llamada, entregar a una persona. Recepcionista, Soporte técnico y Otra cosa: solo agendar una devolución de llamada y entregar."],
              ["**Tono**", "Professional (directo, sin signos de exclamación ni emojis), warm (un emoji como máximo, y solo si ellos usaron uno primero) o brief (dos frases)."],
              ["**Escríbame un borrador**", "La respuesta espera bajo **Esperándolo a usted** con **Enviarla** y **Esta no**. Enviar una la envía en la conversación exactamente como si usted la hubiera escrito."],
              ["**Enviarla automáticamente**", "La respuesta va directa al cliente sin que nadie la lea antes. Sigue negándose a dar un precio que no salga de sus tarifas, sigue deteniéndose cuando duda y sigue deteniéndose cuando se agota su crédito de IA. Hoy el canal está bloqueado, así que redacta de todos modos."],
              ["**Responder solo en horario de atención**", "Usa el horario de atención guardado en la Configuración de la empresa; fuera de él, el mensaje lo espera a usted. Sin horario guardado no hace nada: no va a adivinar un lunes a viernes. Vea [[opening-hours|El horario de atención]]."],
              ["**Máximo de respuestas en una conversación**", "El tope por hilo. Cuando se alcanza, el hilo aparece bajo **Se detuvo en estas** con **Dejar que vuelva a responder**."],
            ],
          } },
          { p: "Un borrador escrito antes de que usted cambiara un ajuste lleva la marca **escrita antes de su último cambio**, para que sepa que refleja las instrucciones anteriores." },
        ],
      },
      {
        id: "what-it-reads",
        heading: "Lo que lee",
        blocks: [
          { p: "La pantalla lo dice antes del clic: **Podemos leer texto plano: .txt, .md y .csv, o texto que usted pegue. Todavía no podemos leer un PDF ni un archivo de Word: si sube uno, aparecerá abajo marcado como no leído, y la solución es pegar el texto o exportarlo como .txt.** Un archivo leído muestra **leído, unos 1,400 tokens**. El material se acota como evidencia: una instrucción escondida dentro de un manual es solo texto, nunca una orden." },
          { note: "Cada respuesta y cada prueba consumen crédito de IA, medido como todo lo demás en FieldQuo AI. Cuando la cuota se agota, la pantalla lo dice con un enlace **Recargar crédito de IA**, y el empleado se detiene en lugar de adivinar. Vea [[ai-credit-and-phone-credit|Crédito de IA y crédito telefónico]]." },
        ],
      },
      {
        id: "only-in-fieldquo",
        heading: "Lo que las otras herramientas no hacen",
        blocks: [
          { p: "Las páginas de precios de la competencia que FieldQuo registra ofrecen recepcionistas telefónicas de IA y cuotas de créditos de IA; ninguna incluye un asistente que responda un mensaje de Facebook, Instagram o WhatsApp con la lista de precios de la empresa y el material que subió. Las páginas de comparación de FieldQuo tampoco lo incluyen, a propósito, hasta que Meta apruebe el canal: vender hoy «una IA que responde sus mensajes de Facebook» sería vender la mitad que está bloqueada." },
        ],
      },
      {
        id: "who-can-see-it",
        heading: "Quién puede verlo",
        blocks: [
          { p: "**Configuración → Empleado de IA** es para el dueño, los administradores y los perfiles Gerente y Despachador: el mismo escalón que la recepcionista telefónica, porque decide lo que se dice a los clientes en nombre de la empresa y gasta la cuota de IA de la empresa. Cuadrilla y Estimador no ven la fila. Enviar o descartar un borrador desde esta pantalla requiere el mismo acceso que la pantalla misma." },
        ],
      },
    ],
    faq: [
      { q: "¿Sabrán los clientes que hablan con un programa?", a: "Nunca dice que es un programa ni una persona con nombre, salvo que alguien lo pregunte directamente; entonces dice con claridad que la respuesta es automática y que una persona dará seguimiento. El nombre que usted le pone es para usted." },
      { q: "¿Puede dar un precio?", a: "Solo el Cierre de ventas, y solo una cifra que una herramienta de FieldQuo calculó con sus propias tarifas, que repite indicando de dónde salió. No puede sumar, descontar, redondear ni «partir de» nada." },
      { q: "¿Por qué no hay nada bajo Esperándolo a usted?", a: "No ha llegado ningún mensaje que pudiera responder — casi siempre porque no hay ninguna página conectada o Meta aún no aprobó la mensajería — o está desactivado, fuera del horario de atención o por encima de su tope." },
      { q: "¿Responde por WhatsApp?", a: "Dentro de la ventana de 24 horas de WhatsApp, sí, de la misma forma. Fuera de ella, no envía una plantilla en su nombre." },
    ],
  },

  "the-monthly-review": {
    title: "El resumen mensual de su bandeja",
    summary:
      "Qué conversaciones se convirtieron en trabajos, con qué rapidez se respondió cada una y a quién nunca se le respondió, un mes a la vez, con una lectura opcional de FieldQuo AI sobre qué hicieron las que ganaron.",
    updated: "2026-09-12",
    intro: [
      "El botón **Resumen mensual** en la parte superior de [[the-messages-inbox|Mensajes]] abre la razón por la que las conversaciones se guardan: una vez al mes, ver cuáles cerraron el trabajo y cuáles no, y con qué rapidez se respondió cada una. Una conversación se archiva en el mes en que **empezó** — la pestaña **Historial** de cada hilo dice cuál — así que una consulta de julio evaluada en septiembre sigue contando en julio.",
      "Nunca imprime un cero para lo que no sabe. Un mes sin nada evaluado no tiene tasa de cierre y lo dice; una conversación a la que nadie respondió dice **Sin responder**, no 0 min.",
    ],
    sections: [
      {
        id: "overview",
        heading: "Resumen",
        blocks: [
          { p: "La pantalla pone primero las conversaciones sin respuesta. Ganadas y perdidas son historia; **Alguien escribió y nunca salió una respuesta** es la única línea que todavía se puede arreglar, y está en un recuadro ámbar encima de la tasa. Cada nombre de la página es un enlace al hilo." },
        ],
      },
      {
        id: "open-it",
        heading: "Cómo leer un mes",
        blocks: [
          { steps: [
            "Abra **Mensajes → Resumen mensual**. Se abre en el mes actual; las flechas pasan al **Mes anterior** y al **Mes siguiente**.",
            "Lea las tres tarjetas: **Conversaciones iniciadas**, **Ganadas** (con **3 de 9 evaluadas** debajo), **Primera respuesta habitual**.",
            "Recorra **Nunca respondidas**: cada fila es un nombre, la fecha y **2 suyos**; responda o evalúe cada una.",
            "Revise **En qué acabaron** y **Tiempo de primera respuesta, por resultado**, y luego evalúe lo que siga **Todavía sin evaluar**.",
          ] },
          { figure: "harness:messages-review", caption: "Resumen mensual — las tres tarjetas, el recuadro Nunca respondidas, En qué acabaron y el tiempo de primera respuesta por resultado." },
        ],
      },
      {
        id: "what-the-numbers-mean",
        heading: "Qué significan los números",
        blocks: [
          { table: {
            head: ["Línea", "Cómo se cuenta"],
            rows: [
              ["**Conversaciones iniciadas**", "Hilos cuyo primer mensaje del cliente cae en el mes."],
              ["**Ganadas**", "Ganadas entre evaluadas, donde evaluadas = Ganada + Perdida + Sin respuesta. **No es un trabajo** queda fuera: un proveedor no es una venta perdida. Sin nada evaluado: **Todavía no se ha marcado nada como ganado o perdido, así que no hay ningún porcentaje que mostrar.**"],
              ["**Primera respuesta habitual**", "La mediana del tiempo entre el primer mensaje del cliente y la primera respuesta de alguien de la empresa, sobre los hilos que recibieron una. Las notas no cuentan."],
              ["**Nunca respondidas (2)**", "Hilos con un mensaje entrante y ninguna respuesta, nunca."],
              ["**En qué acabaron**", "Un conteo por resultado, más **Todavía sin evaluar**."],
              ["**Tiempo de primera respuesta, por resultado**", "La mediana por resultado, con **3 respondidas** y **1 sin responder** junto a cada una. **Son cifras pequeñas. Léelas como una comparación, no como una estadística.**"],
              ["**Ordenado por lo que dijeron**", "Todas las conversaciones del mes, las frías incluidas, ordenadas por su puntuación de temperatura con la razón más fuerte citada."],
            ],
          } },
        ],
      },
      {
        id: "what-the-winning-conversations-did",
        heading: "Qué hicieron las conversaciones que ganaron",
        blocks: [
          { p: "Debajo de los números, **Analizar este mes** pide a FieldQuo AI que lea las conversaciones del mes que se convirtieron en trabajo pagado junto a las que no, y nombre la diferencia. El resultado vuelve como **Qué hicieron las conversaciones que ganaron**, **Tres cosas que cambiar**, **Vale la pena retomarlas** (con **Abrir la conversación** en cada una) y **Quién escribió los 6 presupuestos que salieron de estas conversaciones**. Las cifras se eliminan de las transcripciones antes de que el modelo las lea, y el análisis de un mes se guarda para releerlo sin pagar de nuevo; **Analizar de nuevo** lo rehace desde cero." },
          { note: "Necesita suficiente material para encontrar un patrón y no dos anécdotas: al menos **8** conversaciones asociadas a un cliente y al menos **3** de ellas ganadas, o lo dice: **Solo 2 de las conversaciones de este mes se convirtieron en trabajo pagado. Hacen falta 3 para que «qué hicieron las que ganaron» signifique algo.** Usa su asignación mensual de IA e imprime primero la estimación. Cuando la evidencia es escasa, el resultado se presenta como un punto de partida, no como una conclusión." },
        ],
      },
      {
        id: "who-can-see-it",
        heading: "Quién puede verlo",
        blocks: [
          { p: "La misma regla que la bandeja: **Requests** en solo lectura lee el resumen: Estimador, Despachador, Gerente, dueño y administradores. Ejecutar el análisis de IA requiere acceso de ver, crear y editar a las solicitudes, porque gasta la asignación de la empresa." },
        ],
      },
    ],
    faq: [
      { q: "Una conversación del mes pasado se evaluó esta semana. ¿En qué mes cuenta?", a: "En el mes en que empezó. La pestaña Historial del hilo lo nombra: Cuenta en la revisión de agosto, el mes en que empezó." },
      { q: "¿Por qué la tasa de cierre está en blanco?", a: "Nada de ese mes se ha marcado todavía como Ganada, Perdida o Sin respuesta. Evalúe las conversaciones y la tasa aparece." },
      { q: "¿El resumen me envía un correo?", a: "No. Es una pantalla que usted abre; no se envía nada." },
    ],
  },

  "client-texts-on-my-way-and-reminders": {
    title: "Los dos mensajes de texto que reciben sus clientes",
    summary:
      "El mensaje «en camino» y el recordatorio de cita: cuándo se envía cada uno, los campos que puede usar, cómo la redacción sigue el idioma del cliente y qué no envía FieldQuo por texto.",
    updated: "2026-09-12",
    intro: [
      "FieldQuo envía un mensaje de texto a un cliente en exactamente dos ocasiones: cuando un miembro de la cuadrilla pulsa **On my way** en una visita, y, si usted lo activa, un recordatorio **2 horas antes**, **24 horas antes** o **48 horas antes** de una cita. **Configuración → Mensajes de clientes** es donde cambia la redacción de ambos, con una vista previa **Tu cliente ve:** en vivo para que nadie envíe nunca a un cliente un **{price}** sin reemplazar.",
      "No hay un tercer mensaje. La página lo dice — dos tipos de texto y nada más — y no puede hacer aparecer un editor para un mensaje que nunca sale, porque la lista viene de los mensajes que realmente se envían.",
    ],
    sections: [
      {
        id: "overview",
        heading: "Resumen",
        blocks: [
          { p: "Los dos mensajes salen del número de texto compartido de FieldQuo y empiezan con el nombre de su empresa — **Northside Painting: Dave va en camino, llega en 20 min.** — para que el cliente sepa de quién viene. Cada recordatorio termina con **Responda STOP para no recibir más**, y un cliente que responde STOP no vuelve a recibir ninguno de los dos; la misma comprobación de baja se ejecuta antes del mensaje «en camino». Los recordatorios van solo por mensaje de texto: no hay recordatorio por correo." },
        ],
      },
      {
        id: "the-two-texts",
        heading: "Los dos mensajes",
        blocks: [
          { table: {
            head: ["Mensaje", "Cuándo se envía", "Campos"],
            rows: [
              ["**On my way**", "En el momento en que el estado de una visita pasa a **En camino** en la página del trabajo: por el miembro de la cuadrilla asignado, cualquiera en una visita sin asignar, o alguien que puede editar el horario de todos. El botón nombra el número al que va a escribir, o dice claramente que el cliente no tiene teléfono registrado y no se enviará nada.", "**{company}**, **{worker}**, **{name}**, **{eta}**"],
              ["**Appointment reminder**", "Una vez por cita, dentro de la hora del plazo elegido en **Configuración → Notificaciones → Recordatorios de cita** (**Desactivado**, **2 horas antes**, **24 horas antes**, **48 horas antes**). Desactivado por defecto; una empresa que nunca eligió un plazo no envía ninguno.", "**{company}**, **{when}**, **{location}**"],
            ],
          } },
          { p: "La redacción por defecto, tal como la recibe el cliente: **Northside Painting: Dave va en camino, llega en 20 min. Responda si necesita cambiar la hora.** y **Northside Painting: Recordatorio — su cita es mar, 12 ago, 2:00 p. m. en 123 Oak St. Responda STOP para no recibir más.** Un campo sin valor simplemente desaparece: sin hora de llegada, sin «llega en ,»." },
        ],
      },
      {
        id: "edit-the-wording",
        heading: "Cómo cambiar la redacción",
        blocks: [
          { steps: [
            "Abra **Configuración → Mensajes de clientes** (bajo **Mensajería y alertas**).",
            "Escriba en el cuadro **On my way** o **Appointment reminder**. Toque un chip — **{company}**, **{worker}**, **{name}**, **{eta}** — para insertar un campo al final.",
            "Vea cómo **Tu cliente ve:** se completa con valores de ejemplo. Un campo desconocido se señala — **Campo desconocido: {price}. Solo funcionan los campos anteriores.** — y **Guardar** sigue desactivado hasta que desaparezca. El servidor comprueba lo mismo.",
            "Pulse **Guardar**. La tarjeta recibe la etiqueta **Personalizado** y un botón **Usar el predeterminado**, que devuelve la redacción integrada.",
          ] },
          { figure: "live:app-settings-messages", caption: "Configuración → Mensajes de clientes — un editor por mensaje con sus chips de campos, la vista previa Tu cliente ve, y Guardar." },
          { tip: "Pasados 160 caracteres, un mensaje se divide en segmentos y cuesta más; la frase de baja del recordatorio forma parte del conteo. Manténgalo en una pantalla." },
        ],
      },
      {
        id: "languages",
        heading: "En qué idioma lo recibe el cliente",
        blocks: [
          { p: "El mensaje sigue al cliente igual que su presupuesto. **Tu redacción les llega a los clientes que leen el idioma de tu empresa. Un cliente con otro idioma recibe la nuestra en el suyo — los mismos ocho idiomas que su presupuesto.** Así, un taller que personaliza el texto en español lo envía a sus clientes hispanohablantes, y un cliente anglohablante recibe la redacción en inglés de FieldQuo, nunca una traducción automática de la suya. La hora de la cita se escribe en el formato del idioma del cliente y en la zona horaria de su empresa. Vea [[a-clients-language|El idioma de un cliente]]." },
        ],
      },
      {
        id: "what-is-not-automated",
        heading: "Qué no envía FieldQuo por texto",
        blocks: [
          { bullets: [
            "Sin mensaje de confirmación de reserva. Una visita reservada desde su página de reservas se confirma por correo, no por texto.",
            "Sin mensajes de «su presupuesto está listo», «su factura está vencida» ni «trabajo terminado». Esos van por correo.",
            "Sin mensajería bidireccional con clientes desde la bandeja. Un cliente que responde a un recordatorio no le está escribiendo a su equipo; solo se escucha STOP.",
            "La redacción del recordatorio se edita aquí, pero el plazo vive en Notificaciones, y los recordatorios nunca van por correo.",
          ] },
          { p: "La lista completa, con lo que sí lleva cada canal, está en [[texting-clients-what-is-and-is-not-automated|Mensajes de texto a clientes: qué está automatizado y qué no]]." },
        ],
      },
      {
        id: "who-can-see-it",
        heading: "Quién puede verlo",
        blocks: [
          { p: "**Configuración → Mensajes de clientes** es para el dueño, los administradores, los Gerentes y los Despachadores. El plazo del recordatorio en **Configuración → Notificaciones** es solo para el dueño y los administradores. Pulsar **On my way** en una visita sigue la regla del horario: el miembro de la cuadrilla asignado, cualquiera en una visita sin asignar, o alguien que puede editar el horario de todos." },
        ],
      },
    ],
    faq: [
      { q: "¿Por qué el recordatorio salió en inglés a un cliente hispanohablante?", a: "Su redacción personalizada solo va a los clientes que leen el idioma de su empresa. Un cliente con otro idioma recibe la redacción integrada de FieldQuo en el suyo; revise el idioma del cliente en su ficha." },
      { q: "¿Puedo poner un enlace al presupuesto en un mensaje?", a: "No. Solo funcionan los campos de los chips, y el servidor rechaza cualquier otro." },
      { q: "El estado pasó a En camino pero no llegó ningún mensaje.", a: "El cliente no tiene número de teléfono registrado, respondió STOP en algún momento, o el número no pudo leerse como un número norteamericano. El estado se guarda igual; el botón dice de antemano si saldrá un mensaje." },
    ],
  },

  "email-templates": {
    title: "Plantillas de correo",
    summary:
      "El editor por bloques detrás de los correos que envían sus reglas de seguimiento y sus campañas de correo, los campos de combinación que entiende, y qué decide y qué no decide la etiqueta Activo.",
    updated: "2026-09-12",
    intro: [
      "**Configuración → Plantillas de correo** lista cada plantilla de correo de su empresa, agrupadas en **Automatizado**, **Marketing** y **Personalizado**, una fila por plantilla con una etiqueta **Activo**, y los íconos de editar, duplicar y eliminar. **Agregar plantillas predeterminadas** crea un juego inicial — una por tipo automatizado — para que una regla de seguimiento tenga algo que enviar sin construir nada a mano.",
      "Cada plantilla se abre en un editor por bloques pensado para el teléfono: títulos, texto, imágenes, botones, separadores, un resumen de presupuesto o factura, una lista detallada y un seguimiento de etapas, reordenados arrastrando, con tokens **{{mergeField}}** y una vista previa en teléfono o escritorio. Su logotipo y su color de marca vienen de Marca, salvo que los reemplace.",
    ],
    sections: [
      {
        id: "overview",
        heading: "Resumen",
        blocks: [
          { p: "Seis tipos: **Quote email**, **Instructions email**, **Receipt / invoice email** y **Follow-up email** bajo Automatizado; **Marketing email**; y **Custom**. Un tipo sin plantilla propia dice **Aún no hay plantillas: se usa la predeterminada integrada.** Puede crear tantos borradores y variaciones de un tipo como quiera; la marcada **Activo** es la plantilla predeterminada de la empresa para ese tipo." },
          { figure: "live:app-settings-email-templates", caption: "Configuración → Plantillas de correo — los grupos Automatizado, Marketing y Personalizado, una fila por plantilla con su etiqueta Activo, y Agregar plantillas predeterminadas." },
        ],
      },
      {
        id: "where-a-template-is-used",
        heading: "Dónde se usa realmente una plantilla",
        blocks: [
          { p: "Lea esto antes de dedicar una tarde a una plantilla. Una plantilla de esta pantalla se envía cuando una **regla de seguimiento** o una **campaña de correo** la nombra: una regla en **Configuración → Seguimientos** elige una de sus plantillas Follow-up, Marketing o Custom y la envía un tiempo determinado después de que un presupuesto, una factura o un trabajo llega a un estado; una campaña de correo en Marketing elige una plantilla Marketing o Custom y la envía a sus suscriptores. Vea [[follow-up-rules|Reglas de seguimiento]] y [[email-campaigns-and-subscribers|Campañas de correo y suscriptores]]." },
          { warning: "El correo del presupuesto y los correos de factura y recibo que recibe un cliente los construye FieldQuo a partir del propio documento: las mismas secciones que el PDF, su marca, y las referencias y fotos que configura en **Configuración → Correo de presupuesto**. Hoy ningún envío lee las plantillas **Quote email**, **Receipt / invoice email** ni **Instructions email** de esta pantalla, así que editar una de esas no cambia nada de lo que recibe un cliente. Para cambiar lo que lleva el correo del presupuesto, vea [[settings-quote-email|La configuración del correo de presupuesto]]." },
        ],
      },
      {
        id: "the-editor",
        heading: "Cómo construir una plantilla",
        blocks: [
          { steps: [
            "Pulse **Nueva plantilla** en el tipo que quiera, póngale nombre y pulse **Crear y editar**.",
            "Fije el **Asunto**. **Los campos de combinación también funcionan aquí. Si se deja en blanco, se usa el asunto integrado para este tipo de plantilla.**",
            "Pulse **Agregar bloque** y elija **Heading**, **Text**, **Image**, **Button**, **Divider**, **Spacer**, **Quote/Invoice summary**, **Itemized list** o el seguimiento de etapas. Arrastre el asa para reordenar; cada bloque tiene sus propios controles de alineación, tamaño, ancho o color.",
            "Haga clic en un campo de texto y pulse **Insertar un campo de combinación** para soltar un token como **{{clientName}}**; hasta que un campo tenga el foco, el botón dice **Primero haga clic en un campo de texto**.",
            "Revise **Aspecto**: **Usando su marca** toma su logotipo y su color de marca; reemplace los colores de encabezado, fondo, texto, acento y botón y dirá **Personalizado**, con **Restablecer a la marca de mi empresa** para deshacerlo. Sin logotipo subido, el encabezado muestra el nombre de su empresa.",
            "Use **Vista previa móvil** y **Vista previa de escritorio** (**Vista previa (datos de ejemplo)**), escriba su dirección bajo **Enviar una prueba** y pulse **Guardar**. **Marcar como activa** la convierte en la predeterminada del tipo.",
          ] },
        ],
      },
      {
        id: "merge-fields",
        heading: "Campos de combinación",
        blocks: [
          { table: {
            head: ["Campo", "Se completa con"],
            rows: [
              ["**{{clientName}}**, **{{clientAddress}}**, **{{clientPhone}}**", "El nombre del cliente, la dirección del cliente o del trabajo, su teléfono"],
              ["**{{companyName}}**, **{{companyPhone}}**, **{{companyEmail}}**", "Los datos de su empresa, de la Configuración de la empresa"],
              ["**{{quoteNumber}}**, **{{quoteTotal}}**, **{{quoteUrl}}**", "El presupuesto por el que se disparó una regla de seguimiento, y el enlace para aprobarlo"],
              ["**{{invoiceNumber}}**, **{{invoiceTotal}}**, **{{invoiceUrl}}**, **{{dueDate}}**, **{{balanceDue}}**, **{{amountPaid}}**", "La factura, su enlace de pago, cuándo vence y cuánto queda"],
              ["**{{projectStartDate}}**, **{{projectEndDate}}**, **{{jobTitle}}**", "Las fechas y el título del trabajo"],
            ],
          } },
          { p: "Un campo que el registro no tiene se deja en blanco al enviar; el correo de prueba los completa con valores de ejemplo (**Jane Doe**, **Q-1042**, **$4,250.00**) y los datos reales de su empresa." },
        ],
      },
      {
        id: "deleting",
        heading: "Duplicar y eliminar",
        blocks: [
          { p: "El ícono de duplicar copia una plantilla, secciones incluidas, para que pueda probar una variación sin tocar la que usa una regla. El ícono de la papelera pregunta primero: eliminar es permanente, y una regla de seguimiento que apuntaba a la plantilla eliminada se omite al enviar en lugar de enviar otra cosa. Eliminar la marcada **Activo** deja el tipo sin predeterminada hasta que marque otra." },
        ],
      },
      {
        id: "who-can-see-it",
        heading: "Quién puede verlas",
        blocks: [
          { p: "El dueño, los administradores, los Gerentes y los Despachadores ven **Configuración → Plantillas de correo** y pueden crear, editar, activar, duplicar, eliminar y generar plantillas. Cuadrilla y Estimador no ven la fila." },
        ],
      },
    ],
    faq: [
      { q: "Edité la plantilla Quote email y el presupuesto que recibió mi cliente no cambió. ¿Por qué?", a: "El correo del presupuesto se construye a partir del propio presupuesto y de su configuración de Correo de presupuesto, no de esta plantilla. Cambie las referencias y las fotos en Configuración → Correo de presupuesto; la redacción del correo que lo acompaña es la de FieldQuo, en el idioma del presupuesto." },
      { q: "¿Para qué sirve Activo, entonces?", a: "Marca la plantilla predeterminada de la empresa para ese tipo. Una regla de seguimiento o una campaña sigue nombrando la plantilla exacta que envía." },
      { q: "¿Puedo enviar una plantilla a un cliente desde aquí?", a: "Solo una prueba a su propia dirección con Enviar una prueba. Los envíos a clientes pasan por las reglas de seguimiento y las campañas de correo." },
    ],
  },
};
