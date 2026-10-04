// content/help/es/messages-3.js
//
// Parte 3 de la categoría «messages» en español (ver el compositor,
// messages.js). Misma estructura que content/help/en/messages-3.js —
// secciones, bloques y preguntas en el mismo orden, comprobados por
// scripts/check-help-centre.mjs.
export const ARTICLES = {
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
};
