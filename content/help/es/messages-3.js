// content/help/es/messages-3.js
//
// Parte 3 de la categoría «messages» en español (ver el compositor,
// messages.js). Misma estructura que content/help/en/messages-3.js —
// secciones, bloques y preguntas en el mismo orden, comprobados por
// scripts/check-help-centre.mjs.
export const ARTICLES = {
  // 2026-10-04 — fases 3 y 4 del chat del equipo (vea la versión en inglés).
  "photos-and-files-in-team-chat": {
    title: "Fotos, archivos y trabajos compartidos en el chat del equipo",
    summary: "Envíe fotos de la cámara del teléfono, PDF y documentos en cualquier conversación. Son privados de la conversación, y una foto se puede guardar en las fotos de un trabajo.",
    updated: "2026-10-04",
    intro: [
      "En Chat, los botones bajo el cuadro de mensaje envían más que palabras: la **cámara** toma o elige una foto, el **clip** adjunta fotos o documentos y el **maletín** comparte uno de sus trabajos como tarjeta.",
    ],
    sections: [
      {
        id: "what-you-can-send",
        heading: "Qué puede enviar",
        blocks: [
          {
            bullets: [
              "Fotos (JPEG, PNG, HEIC y los demás formatos habituales de los teléfonos). La foto se reduce en su teléfono antes de enviarse y se le quita la ubicación.",
              "PDF y documentos de Word, Excel, PowerPoint y texto, de hasta 25 MB cada uno.",
              "Hasta 10 archivos por mensaje, con o sin texto.",
              "No se pueden enviar videos en el chat.",
            ],
          },
        ],
      },
      {
        id: "who-can-open-them",
        heading: "Quién puede abrirlos",
        blocks: [
          {
            p: "Solo las personas de la conversación. Los archivos se guardan de forma privada, no en una dirección web pública. Cada foto o archivo en su pantalla se abre con un enlace que solo funciona para usted y deja de funcionar después de una hora; al volver a abrir la conversación recibe enlaces nuevos. Quien sale de la conversación, o es retirado de ella, ya no puede abrir sus archivos. El archivo de un mensaje eliminado no lo puede abrir nadie.",
          },
        ],
      },
      {
        id: "save-to-job-photos",
        heading: "Guardar una foto en un trabajo",
        blocks: [
          {
            p: "Toque una foto para verla en grande y luego **Guardar en las fotos del trabajo**. En la sala de un trabajo se guarda en ese trabajo; en otro lugar elige el trabajo entre los que puede ver. El equipo puede guardar en los trabajos en los que está.",
          },
          {
            p: "La foto se copia en las fotos del trabajo como foto de avance. No se publica en su sitio web: destacarla sigue siendo decisión de quienes gestionan las fotos de los trabajos. La copia del chat sigue siendo privada.",
          },
        ],
      },
      {
        id: "shared-jobs",
        heading: "Trabajos, órdenes de trabajo y presupuestos compartidos",
        blocks: [
          {
            p: "Un trabajo, una orden de trabajo o un presupuesto compartido se muestra como una tarjeta. Cada persona ve lo que su propio acceso permite: quien está en el trabajo puede abrirlo junto con su orden de trabajo, quien puede abrir presupuestos ve el número y el cliente, y los demás ven **Solo para la oficina** o **Para las personas de este trabajo**. Una tarjeta nunca muestra un precio. **Compartir con el personal** en un presupuesto publica una tarjeta de la misma manera.",
          },
        ],
      },
      {
        id: "no-signal",
        heading: "Sin señal",
        blocks: [
          {
            p: "El texto que envía sin señal espera en la conversación como **Enviando…** y se envía solo cuando el teléfono recupera la conexión. Se envía una sola vez, aunque la conexión se corte a mitad. Las fotos y los archivos necesitan conexión; su texto se queda en el cuadro.",
          },
        ],
      },
    ],
    faq: [
      {
        q: "¿El propietario puede abrir las fotos de un canal privado en el que no está?",
        a: "No. Los archivos siguen a la conversación: solo sus miembros pueden abrirlos.",
      },
      {
        q: "¿Por qué una foto se volvió gris?",
        a: "Su enlace caducó después de una hora. La conversación carga enlaces nuevos por sí sola; si no, vuelva a abrir la conversación.",
      },
    ],
  },
  "reply-pin-edit-and-search-in-team-chat": {
    title: "Responder, fijar, editar, eliminar y buscar en el chat del equipo",
    summary: "Responda a un mensaje, fije los que el equipo necesita, corrija un mensaje durante 15 minutos, elimínelo para todos y busque en todas sus conversaciones.",
    updated: "2026-10-04",
    intro: [
      "Señale un mensaje en la computadora, o toque **⋯** debajo en el teléfono, para ver qué puede hacer con él.",
    ],
    sections: [
      {
        id: "reply",
        heading: "Responder",
        blocks: [
          {
            p: "**Responder** pone una pequeña cita del mensaje encima del suyo. Toque la cita para ir al original. Las respuestas son de un solo nivel — no hay hilos aparte que perderse.",
          },
        ],
      },
      {
        id: "pins",
        heading: "Fijar",
        blocks: [
          {
            p: "Un mensaje fijado aparece en la barra bajo el nombre de la conversación, el más reciente primero; toque la barra para ver la lista. La oficina puede fijar en cualquier conversación en la que esté, el responsable de un canal o grupo en el suyo, y cualquiera en un mensaje directo o un grupo. Una línea en la conversación indica quién lo fijó.",
          },
        ],
      },
      {
        id: "edit-and-remove",
        heading: "Editar y eliminar",
        blocks: [
          {
            bullets: [
              "**Edite** su propio mensaje durante 15 minutos después de enviarlo. Luego muestra **(editado)**.",
              "**Elimine** su propio mensaje en cualquier momento. Todos en la conversación ven **Mensaje eliminado** en su lugar — nadie puede leerlo ya, tampoco el propietario.",
              "El propietario y los administradores, y el responsable de un canal, pueden eliminar el mensaje de otra persona en un canal. El registro de actividad anota quién lo eliminó, no lo que decía.",
              "En mensajes directos, grupos, #general y salas de trabajo nadie puede eliminar el mensaje de otra persona.",
            ],
          },
        ],
      },
      {
        id: "search",
        heading: "Buscar",
        blocks: [
          {
            p: "La lupa en la parte superior de la lista busca en todas sus conversaciones; la de una conversación busca en ella, con una opción para buscar en todas. Escriba al menos dos letras. Toque un resultado para abrir la conversación en ese mensaje. Nunca se busca en canales privados en los que no está ni en mensajes eliminados.",
          },
        ],
      },
    ],
    faq: [
      {
        q: "¿Puedo editar un mensaje después de 15 minutos?",
        a: "No. Elimínelo y envíelo de nuevo.",
      },
      {
        q: "¿Eliminar un mensaje lo borra?",
        a: "Se quita de todas las pantallas para todos. FieldQuo conserva su registro, pero nadie puede leer su texto.",
      },
    ],
  },

  "fetch-older-facebook-and-instagram-history": {
    title: "Traer el historial anterior de Facebook e Instagram",
    summary:
      "Traiga las conversaciones y los formularios que llegaron antes de conectar — sin avisos, sin respuestas automáticas y sin duplicados.",
    updated: "2026-10-03",
    intro: [
      "Cuando conecta su Página de Facebook, FieldQuo importa enseguida las conversaciones recientes. **Historial anterior** va más allá: cada conversación de Messenger e Instagram que Facebook todavía devuelve, y los últimos 90 días de formularios que Facebook conserva.",
    ],
    sections: [
      {
        id: "where",
        heading: "Dónde encontrarlo",
        blocks: [
          {
            bullets: [
              "**Conversaciones:** Ajustes › Meta Ads, en la tarjeta de Facebook e Instagram, debajo de la línea de importación — **Historial anterior**.",
              "**Formularios:** Ajustes › Meta Ads, en el panel de formularios, en cuanto haya al menos un formulario activado.",
            ],
          },
          { p: "Cada línea indica cuántas conversaciones, mensajes o clientes potenciales han llegado, hasta qué fecha, cuándo se ejecutó por última vez y si Facebook pidió una pausa." },
        ],
      },
      {
        id: "what-happens",
        heading: "Qué pasa cuando se ejecuta",
        blocks: [
          {
            steps: [
              "Empieza solo al conectar la Página y al activar un formulario. **Traer más antiguo** lo vuelve a empezar desde el principio cuando usted quiera.",
              "Avanza por partes, varias veces por hora, y retoma justo donde se quedó. Si Facebook pide ir más despacio, la línea dice **En pausa** y cuándo se reanuda.",
              "Cada conversación se guarda con todos los mensajes que Facebook devuelve, incluidos los anteriores a los cincuenta más recientes.",
              "Cada formulario se convierte en un cliente potencial, salvo que la persona ya esté en su tablero (vea [[facebook-leads-checked-against-your-records|Clientes potenciales de Facebook comprobados con sus registros]]).",
            ],
          },
        ],
      },
      {
        id: "quiet",
        heading: "El historial no despierta a nadie",
        blocks: [
          {
            bullets: [
              "Las conversaciones anteriores al inicio de su bandeja llegan **marcadas como resueltas**, sin insignia de no leído ni reloj de espera. Un mensaje reciente en la misma conversación la abre como siempre.",
              "No se escribe ninguna respuesta automática ni borrador del empleado de IA para el historial.",
              "Los clientes potenciales de más de un día se añaden sin el aviso de **nuevo cliente potencial**, y el cliente potencial dice **Importado del historial de Facebook**. Un formulario rellenado esta mañana no es historial — se anuncia como cualquier otro.",
            ],
          },
          { note: "Ejecutarlo dos veces nunca duplica nada: cada mensaje y cada cliente potencial se reconoce por el identificador de Facebook." },
        ],
      },
    ],
    faq: [
      {
        q: "¿Por qué solo 90 días de formularios?",
        a: "Facebook conserva los formularios durante 90 días. Lo anterior ya no está disponible para ninguna aplicación.",
      },
      {
        q: "¿Revisar conversaciones antiguas usa mi crédito de IA?",
        a: "Solo en las conversaciones en las que el cliente escribió por última vez en los últimos 90 días, y como máximo 25 por ejecución. Las más antiguas se comprueban con sus registros sin IA, gratis.",
      },
    ],
  },

  "photos-and-videos-from-facebook-and-instagram": {
    title: "Fotos y vídeos de Facebook e Instagram",
    summary:
      "Las fotos, vídeos, notas de voz y archivos que le envían por Messenger e Instagram se copian en FieldQuo para que nunca caduquen — y si algo falla, dice por qué.",
    updated: "2026-10-03",
    intro: [
      "El enlace que Facebook da para un adjunto caduca al cabo de un tiempo. Por eso FieldQuo copia cada foto, vídeo, nota de voz y archivo en su propio almacenamiento en más o menos un minuto, y la conversación muestra la copia, no el enlace de Facebook.",
    ],
    sections: [
      {
        id: "states",
        heading: "Lo que ve en la conversación",
        blocks: [
          {
            bullets: [
              "**Todavía llegando:** la copia aún no ha terminado.",
              "**La foto, el vídeo, el reproductor o el archivo:** la copia está hecha y se queda.",
              "**No se pudo traer, con el motivo y un botón Reintentar:** por ejemplo, un archivo demasiado grande o un enlace que Facebook ya había caducado.",
            ],
          },
        ],
      },
      {
        id: "limits",
        heading: "Límites de tamaño",
        blocks: [
          { p: "Messenger e Instagram admiten adjuntos de hasta 25 MB, y FieldQuo acepta lo mismo. WhatsApp tiene sus propios límites, más pequeños, por tipo." },
          { tip: "Un adjunto cuyo enlace había caducado se vuelve a traer solo la próxima vez que la conversación se actualiza desde Facebook, porque Facebook entrega entonces un enlace nuevo." },
        ],
      },
      {
        id: "history",
        heading: "Conversaciones anteriores",
        blocks: [
          { p: "Los adjuntos del historial traído con **Historial anterior** se copian de la misma forma. Una foto ya copiada nunca se vuelve a descargar cuando la misma conversación se trae por segunda vez." },
        ],
      },
    ],
  },

  "facebook-leads-checked-against-your-records": {
    title: "Clientes potenciales de Facebook comprobados con sus registros",
    summary:
      "Cómo FieldQuo detecta un cliente potencial de Facebook que ya tiene, lo une en vez de crear una copia, y le deja deshacerlo.",
    updated: "2026-10-03",
    intro: [
      "La misma persona a menudo rellena su formulario de Facebook y además escribe a su Página. FieldQuo comprueba cada cliente potencial de Facebook con sus clientes potenciales abiertos, sus conversaciones de Messenger e Instagram y sus clientes antes de añadirlo.",
    ],
    sections: [
      {
        id: "same-person",
        heading: "Cuando es la misma persona",
        blocks: [
          {
            bullets: [
              "**Se une:** el mismo correo, el mismo teléfono (si los nombres no se contradicen), el mismo identificador de Facebook o Instagram, o el mismo nombre completo **y** la misma dirección.",
              "**Solo se muestra, nunca se une:** un nombre solo, un teléfono familiar compartido con nombres distintos, o el mismo nombre en otra dirección.",
            ],
          },
          { p: "Un formulario que coincide con un cliente potencial abierto se une a él en vez de crear un segundo. El cliente potencial solo recibe lo que le faltaba — un teléfono o correo vacío, la campaña — y el panel lo muestra en **La misma persona**, con lo que decía el formulario." },
        ],
      },
      {
        id: "undo",
        heading: "¿No es la misma persona? Deshágalo",
        blocks: [
          {
            steps: [
              "Abra el cliente potencial y busque **La misma persona** en el panel.",
              "Pulse **No es la misma persona** en el enlace equivocado y confirme.",
            ],
          },
          { p: "No se borra nada. Un formulario unido vuelve a ser su propio cliente potencial, lo que el enlace había rellenado se restaura si nadie lo cambió desde entonces, y esos dos no se vuelven a unir nunca." },
        ],
      },
      {
        id: "review",
        heading: "La revisión de mensajes",
        blocks: [
          { p: "En una conversación de Messenger, Instagram o WhatsApp, el panel del cliente potencial y la conversación muestran un veredicto con sus pruebas:" },
          {
            table: {
              head: ["Veredicto", "Qué significa"],
              rows: [
                ["Cliente potencial real", "Quiere un trabajo. Se crea un cliente potencial."],
                ["No es un cliente potencial", "Spam, un número equivocado, alguien que busca trabajo o un proveedor que vende algo. No se crea nada."],
                ["Cliente existente", "Un cliente ya registrado. Solo se crea un cliente potencial si pide un trabajo nuevo, y queda unido a ese cliente."],
                ["Ya convertido", "Ya existe un presupuesto, un trabajo o una factura para esa persona. No se crea ninguno nuevo — se listan los documentos."],
              ],
            },
          },
          { p: "Quién es la persona sale de sus registros, gratis. Si quiere un trabajo lo decide la IA, pagada con su crédito de IA. Sin crédito de IA, la revisión lo dice y solo aparecen los veredictos basados en sus registros." },
          { tip: "Si la revisión unió una conversación al cliente equivocado, pulse **No es este cliente** en la conversación." },
        ],
      },
      {
        id: "scoring",
        heading: "Una puntuación justa para Facebook",
        blocks: [
          { p: "Un presupuesto o un plazo que falta solo cuenta en contra cuando el formulario de verdad lo preguntaba. Los formularios de Facebook, las conversaciones y los clientes potenciales escritos a mano se puntúan por lo que pueden recoger, y los motivos dicen **Presupuesto desconocido** o **Plazo desconocido — no cuenta**." },
        ],
      },
    ],
  },

  "channels-and-group-chats": {
    title: "Canales y chats de grupo",
    summary: "Los canales son lugares que crea la oficina — #presupuestos, #cuadrilla-norte, #anuncios; los chats de grupo son conversaciones que cualquiera empieza. Quién puede crear, cambiar, unirse y salir de cada uno.",
    updated: "2026-10-04",
    intro: [
      "Además de **#general**, las salas de trabajo y los mensajes directos, el Chat tiene dos tipos de sala que crean las personas. Un **canal** es un lugar: tiene un nombre como **#presupuestos**, un tema opcional, y sobrevive a las personas que están en él. Un **chat de grupo** es una conversación entre las personas elegidas — tres personas organizando la camioneta de mañana. #general y las salas de trabajo los sigue manteniendo FieldQuo a partir de su lista de personal y su agenda.",
    ],
    sections: [
      {
        id: "overview",
        heading: "Resumen",
        blocks: [
          {
            p: "Los canales están bajo **Canales** en la lista, después de **#general**; los chats de grupo están con sus mensajes directos. Un canal **público** lo puede encontrar y unirse cualquiera de la empresa desde **Explorar canales**; un canal **privado** está oculto para quien no fue agregado — el propietario incluido — y abrir su enlace responde como si no existiera. Un canal se puede configurar para que **Solo la oficina puede publicar**: los dueños, administradores y supervisores publican, todos leen. Así funciona un canal **#anuncios**.",
          },
        ],
      },
      {
        id: "who-can-do-what",
        heading: "Quién puede hacer qué",
        blocks: [
          {
            table: {
              head: [
                "Acción",
                "Propietario y administrador",
                "Gerente y despachador",
                "Estimador y cuadrilla",
              ],
              rows: [
                [
                  "Crear un canal",
                  "Sí",
                  "Sí",
                  "No",
                ],
                [
                  "Empezar un chat de grupo",
                  "Sí",
                  "Sí",
                  "Sí",
                ],
                [
                  "Unirse a un canal público",
                  "Sí",
                  "Sí",
                  "Sí",
                ],
                [
                  "Cambiar el nombre de un canal, fijar su tema, hacerlo privado, dejar que solo publique la oficina, archivarlo",
                  "Cualquier canal en el que estén",
                  "Los canales que administran (los que crearon)",
                  "No",
                ],
                [
                  "Agregar o quitar personas en un canal",
                  "Cualquier canal en el que estén",
                  "Los canales que administran",
                  "No",
                ],
                [
                  "Cambiar el nombre de un chat de grupo o agregar personas",
                  "Cualquiera del grupo",
                  "Cualquiera del grupo",
                  "Cualquiera del grupo",
                ],
                [
                  "Quitar personas de un chat de grupo",
                  "Sí, cuando están en él",
                  "Si lo empezaron",
                  "Si lo empezaron",
                ],
              ],
            },
          },
          {
            note: "El servidor revisa estas reglas en cada cambio; no solo se ocultan en la pantalla. Una sesión de soporte de solo lectura puede abrir todas las salas y no cambiar ninguna.",
          },
        ],
      },
      {
        id: "make-a-channel",
        heading: "Crear un canal",
        blocks: [
          {
            steps: [
              "En **Chat**, pulse **+** junto a **Canales** (o **Explorar canales** y luego **Nuevo canal**).",
              "Escriba un nombre. Se guarda en minúsculas con guiones — **Será #cuadrilla-norte** muestra lo que obtendrá.",
              "Agregue un **Tema** si ayuda a saber para qué es el canal.",
              "Elija **Público** o **Privado**. Un canal privado necesita a las personas que quiere en él.",
              "Active **Solo la oficina puede publicar** para anuncios, e **Incluir a todos** para agregar a todo el equipo ahora y a cada persona nueva cuando se une.",
              "Pulse **Crear canal**.",
            ],
          },
          {
            note: "Cualquiera en la empresa puede leer un canal público, la cuadrilla incluida. Deje los datos de los clientes en la sala del trabajo.",
          },
        ],
      },
      {
        id: "start-a-group",
        heading: "Empezar un chat de grupo",
        blocks: [
          {
            steps: [
              "Pulse **Nuevo mensaje**.",
              "Elija a dos personas o más. Elegir a una sola persona abre su mensaje directo con ella.",
              "Póngale un nombre al grupo si quiere — si no, se llama por las personas que están en él.",
              "Pulse **Crear grupo**.",
            ],
          },
        ],
      },
      {
        id: "archive-and-leave",
        heading: "Archivar, salir y quitar",
        blocks: [
          {
            bullets: [
              "**Archivar canal** conserva cada mensaje y deja el canal solo para lectura; pasa a **Archivados**. **Desarchivar canal** lo trae de vuelta. No se borra nada.",
              "**Salir del canal** o **Salir del grupo** lo saca a usted; sus mensajes se quedan, y alguien puede volver a agregarlo.",
              "No puede salir de #general, de una sala de trabajo, de un mensaje directo ni de un canal con **Incluir a todos** — siléncielo en su lugar.",
              "**Quitar** saca a alguien de un canal o grupo. Sus mensajes se quedan donde estaban.",
            ],
          },
        ],
      },
    ],
    faq: [
      {
        q: "¿Puede el propietario leer un canal privado?",
        a: "Solo si está en él. Un canal privado está oculto para quien no fue agregado, propietarios y administradores incluidos.",
      },
      {
        q: "¿Qué tan grande puede ser un chat de grupo?",
        a: "No hay límite. La lista de personas se carga de cincuenta en cincuenta, y escribir @ busca entre todo el grupo.",
      },
      {
        q: "¿Puede la cuadrilla crear un canal?",
        a: "No. La cuadrilla y los estimadores empiezan chats de grupo; los canales los crean los propietarios, administradores, gerentes y despachadores.",
      },
    ],
  },

  "chat-notifications-and-mute": {
    title: "Notificaciones del chat y silenciar",
    summary: "Qué le avisa cada tipo de sala de forma predeterminada, cómo cambiarlo o silenciar una sala un rato, y por qué una mención también llega a la campana.",
    updated: "2026-10-04",
    intro: [
      "Cada sala del Chat tiene su propio ajuste de notificaciones. Nadie más lo ve, y el ajuste de otra persona no cambia lo que usted recibe. Abra una sala y pulse el engranaje (o el número de personas) para encontrar **Tus notificaciones**.",
    ],
    sections: [
      {
        id: "defaults",
        heading: "Qué se le avisa de forma predeterminada",
        blocks: [
          {
            table: {
              head: [
                "Sala",
                "Se le avisa de",
              ],
              rows: [
                [
                  "Un mensaje directo",
                  "Cada mensaje",
                ],
                [
                  "Un chat de grupo",
                  "Cada mensaje",
                ],
                [
                  "#general, un canal, una sala de trabajo",
                  "Solo cuando lo mencionan",
                ],
              ],
            },
          },
          {
            p: "Nunca se le avisa de sus propios mensajes, y no recibe notificación de un mensaje mientras tiene esa sala abierta en su pantalla.",
          },
        ],
      },
      {
        id: "change-it",
        heading: "Cambiarlo para una sala",
        blocks: [
          {
            steps: [
              "Abra la sala y pulse el engranaje.",
              "En **Tus notificaciones**, elija **Cada mensaje**, **Solo cuando me mencionan** o **Nada (silenciar hasta que lo vuelva a activar)**. **Predeterminado** vuelve a la tabla de arriba.",
              "Para silenciar un rato, pulse **1 hora** o **Hasta mañana a las 7 a. m.**. **Activar sonido** lo termina antes.",
            ],
          },
        ],
      },
      {
        id: "what-mute-does",
        heading: "Qué hace silenciar",
        blocks: [
          {
            bullets: [
              "Una sala silenciada se ve en gris con una campana tachada, y su conteo es gris. Los mensajes siguen ahí; no se oculta nada.",
              "Mientras una sala está silenciada por un rato, una mención igualmente le llega, y solo las menciones cuentan en la pestaña **Chat**.",
              "**Nada** silencia la sala por completo — menciones incluidas — y la deja fuera del número de la pestaña **Chat**.",
              "**Ocultar de mi lista** (mensajes directos y chats de grupo) quita una conversación de su lista hasta que alguien vuelva a escribir en ella.",
            ],
          },
        ],
      },
      {
        id: "mentions-in-the-bell",
        heading: "Las menciones en la campana",
        blocks: [
          {
            p: "Cuando alguien lo menciona con @ en un chat de grupo, un canal, #general o una sala de trabajo, la mención también llega a la campana de notificaciones — **Ana te mencionó en #presupuestos** — y al tocarla se abre el chat en ese mensaje. La fila de la campana guarda quién y dónde, no el texto del mensaje. Un mensaje directo no agrega fila a la campana (ya le avisa), y una sala con **Nada** no agrega ninguna.",
          },
          {
            note: "Solo el **@everyone** de la oficina avisa a toda la sala. El @everyone de cualquier otra persona se envía como texto normal, y el cuadro de redacción lo dice antes de enviar.",
          },
        ],
      },
    ],
    faq: [
      {
        q: "¿Por qué no recibí una notificación mientras estaba en la sala?",
        a: "Porque la estaba viendo. FieldQuo no avisa de un mensaje que ya está en su pantalla.",
      },
      {
        q: "¿Silenciar le avisa a alguien?",
        a: "No. Sus ajustes de notificaciones son solo suyos.",
      },
    ],
  },

  "seen-by-in-team-chat": {
    title: "Visto por en el chat del equipo",
    summary: "Debajo de su último mensaje, Visto por 3 dice cuántas personas de la conversación lo tuvieron en pantalla — tóquelo para ver los nombres. Solo los miembros de la conversación lo ven.",
    updated: "2026-10-04",
    intro: [
      "En el Chat, la línea debajo de su propio último mensaje dice quién lo vio: **Visto por 3** en un grupo, un canal o una sala de trabajo, y **Visto** en un mensaje directo. Tóquela para ver la lista de nombres. En cualquier mensaje suyo anterior, **Visto por** está en la barra que aparece al señalar el mensaje.",
    ],
    sections: [
      {
        id: "what-it-means",
        heading: "Qué significa",
        blocks: [
          {
            bullets: [
              "**Visto** significa que el mensaje estuvo en la pantalla de esa persona en esta conversación — abrió la sala, o el mensaje llegó mientras la tenía abierta.",
              "No significa que lo haya leído con atención, y no hay indicador de escritura.",
              "Cuenta a las personas que están en la conversación ahora. Alguien agregado después cuenta en cuanto la abre.",
            ],
          },
        ],
      },
      {
        id: "who-sees-it",
        heading: "Quién puede verlo",
        blocks: [
          {
            p: "Solo las personas de la conversación. La pantalla lo ofrece en sus propios mensajes. Alguien fuera de un canal privado no puede verlo, y la sesión de soporte de FieldQuo de solo lectura tampoco lo ve.",
          },
        ],
      },
    ],
    faq: [
      {
        q: "¿Puedo desactivarlo?",
        a: "No. Visto por es parte del chat del equipo para todos en una conversación, como la línea de no leídos.",
      },
      {
        q: "¿Ve el propietario quién leyó qué?",
        a: "Solo en las conversaciones en las que está, como cualquier otra persona.",
      },
    ],
  },
};
