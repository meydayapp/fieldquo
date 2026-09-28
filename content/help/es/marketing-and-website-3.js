// content/help/es/marketing-and-website-3.js
//
// Parte 3 de la categoría «marketing-and-website» en español (ver el
// compositor, marketing-and-website.js). Slugs asignados a esta parte
// (lib/help/tree.js): get-facebook-and-instagram-lead-ads-into-fieldquo,
// answer-facebook-and-instagram-messages-from-fieldquo, whatsapp-coming-soon.
//
// Misma estructura que el inglés (mismas secciones, mismos bloques, mismas
// figuras); las palabras en pantalla vienen del bloque `es` de
// app/i18n/appMessages.js. Las pantallas de Meta conservan las etiquetas en
// inglés de Meta, entre comillas, porque es lo que el lector verá allí. Los
// niveles de acceso (**Requests**, **View only**…) se citan como los muestra
// el editor de accesos.
export const ARTICLES = {
  "get-facebook-and-instagram-lead-ads-into-fieldquo": {
    title: "Cómo traer sus anuncios de clientes potenciales de Facebook e Instagram a FieldQuo",
    summary:
      "Conecte su Página de Facebook, busque sus formularios, active los que importan y envíe un cliente potencial de prueba: la lista de verificación de Configuración → Meta Ads se marca sola a medida que avanza.",
    updated: "2026-09-28",
    intro: [
      "Un anuncio de clientes potenciales en Facebook o Instagram lleva un formulario que Meta muestra dentro de su propia aplicación. Cuando un propietario lo llena, FieldQuo puede convertir su respuesta en una tarjeta de su tablero **Prospectos**, con puntuación, aviso y seguimiento como cualquier otra solicitud. Todo se configura en una sola pantalla: **Configuración → Meta Ads**, en la tarjeta **Formularios de clientes potenciales de Facebook**.",
      "Los formularios y los clientes potenciales se leen con su conexión a la **Página de Facebook** (la tarjeta **Publicación en Facebook e Instagram**, más abajo en la misma pantalla) y no con la cuenta publicitaria de Meta de arriba. La cuenta publicitaria trae lo que usted gasta; la Página trae los clientes potenciales.",
    ],
    sections: [
      {
        id: "before-you-start",
        heading: "Antes de empezar",
        blocks: [
          {
            bullets: [
              "Un inicio de sesión de Facebook que administre la Página desde la que salen sus anuncios.",
              "Al menos un formulario en un anuncio de esa Página. FieldQuo encuentra y lee sus formularios; no los crea: usted crea el formulario en Meta al crear el anuncio.",
              "Una cuenta de propietario o administrador en FieldQuo. **Meta Ads** está bajo **Cobros** en la configuración, como **Pagos**, y los demás roles no la ven ni pueden usarla.",
            ],
          },
          {
            note: "Si la tarjeta muestra **Los formularios de clientes potenciales de Facebook necesitan que Meta apruebe un permiso más; todavía no se está recibiendo nada.**, cada interruptor y **Buscar mis formularios** están desactivados y la lista de verificación de abajo no aparece. Es la revisión de FieldQuo por parte de Meta, no su configuración: no hay nada que hacer mientras la frase siga ahí.",
          },
        ],
      },
      {
        id: "the-checklist",
        heading: "La lista de verificación arriba de la tarjeta",
        blocks: [
          {
            p: "La tarjeta empieza con **Cómo traer tus anuncios de clientes potenciales a FieldQuo**, una lista corta que se marca sola a partir de lo que FieldQuo ya ve: no hay nada que marcar a mano. Cada línea sin marcar dice qué hacer y nombra el botón de esta pantalla que lo hace. **Guía paso a paso** abre este artículo.",
          },
          {
            bullets: [
              "**Página de Facebook conectada, con los permisos de clientes potenciales**: hay una Página conectada y Meta le concedió todos los permisos que necesitan los formularios.",
              "**Formularios encontrados**: **Buscar mis formularios** listó al menos un formulario.",
              "**Al menos un formulario activado**: el interruptor de un formulario dice **Activado**.",
              "**Primer cliente potencial recibido**: llegó a FieldQuo un cliente potencial desde Meta.",
            ],
          },
          {
            figure: "live:app-settings-meta-ads",
            caption: "Configuración → Meta Ads: la tarjeta de formularios de clientes potenciales de Facebook con su botón de búsqueda, y una Página conectada en Publicación en Facebook e Instagram, más abajo.",
          },
        ],
      },
      {
        id: "connect-your-page",
        heading: "Paso 1: conectar su Página de Facebook",
        blocks: [
          {
            steps: [
              "Abra **Configuración → Meta Ads** y baje hasta **Publicación en Facebook e Instagram**.",
              "Pulse **Conectar Facebook e Instagram** e inicie sesión en Facebook.",
              "Acepte todos los permisos que muestra Meta. Si desmarca uno, la conexión parece correcta pero no puede leer sus clientes potenciales.",
              "Si su inicio de sesión administra varias Páginas, elija la de sus anuncios en **¿Qué página?** y pulse **Conectar esta página**.",
              "De vuelta en la tarjeta de formularios, revise la línea **Los formularios y los clientes potenciales se leen con tu conexión a la Página de Facebook: …**, que nombra la Página que FieldQuo leerá.",
            ],
          },
          {
            tip: "FieldQuo lee los formularios y los clientes potenciales de una sola Página: la que está conectada. Si sus anuncios salen de otra Página, pulse **Reconectar o cambiar de página** y elíjala. Si Meta retuvo un permiso, una línea ámbar lo nombra y le indica pulsar el mismo botón para aceptarlo.",
          },
        ],
      },
      {
        id: "find-and-switch-on",
        heading: "Pasos 2 y 3: buscar sus formularios y activarlos",
        blocks: [
          {
            steps: [
              "Pulse **Buscar mis formularios**. FieldQuo le pide a Meta los formularios de la Página conectada y muestra cada uno con su Página, **Clientes potenciales: 0** y un interruptor.",
              "Ponga el interruptor en **Activado** en cada formulario cuyas respuestas deban convertirse en clientes potenciales.",
              "Deje los demás en **Desactivado**, por ejemplo una suscripción a un boletín. No se importa nada de un formulario desactivado.",
            ],
          },
          {
            p: "Un formulario recién encontrado siempre empieza en **Desactivado**: encontrar un formulario no es aceptar importarlo, y volver a pulsar **Buscar mis formularios** nunca reactiva un formulario que usted desactivó. Un formulario que borre en Meta se queda en la lista, porque los clientes potenciales que ya produjo todavía apuntan a él.",
          },
        ],
      },
      {
        id: "what-the-messages-mean",
        heading: "Qué significan los mensajes de la tarjeta",
        blocks: [
          {
            table: {
              head: ["La tarjeta dice", "Qué significa y qué hacer"],
              rows: [
                ["**Página … revisada: 3 formularios encontrados.**", "Funcionó. El número es cuántos formularios devolvió Meta para esa Página."],
                ["**Página … revisada: Meta no devolvió ningún formulario para ella.**", "La Página se leyó y no tiene formularios. Cree el formulario en su anuncio en Meta, o conecte la Página desde la que sale realmente el anuncio, y vuelva a pulsar **Buscar mis formularios**."],
                ["**Conecta primero tu Página de Facebook en Publicación en Facebook e Instagram más abajo …**", "Todavía no hay ninguna Página conectada. Haga el paso 1."],
                ["**Meta no concedió a la conexión de la Página … estos permisos: …**", "Pulse **Reconectar o cambiar de página** y acepte todos los permisos que pida Meta."],
                ["**Meta ya no acepta el acceso de FieldQuo a …**", "El acceso guardado venció o se retiró en Meta. Pulse **Reconectar o cambiar de página**."],
                ["**Meta se negó a dar a FieldQuo los clientes potenciales de …: esta empresa usa el Leads Access Manager.**", "Su empresa limita quién puede leer sus clientes potenciales. Vea la sección siguiente."],
                ["**Todavía no se ha recibido ninguno desde Meta.** o **Último recibido el …**", "Si llegó o no algún cliente potencial. La segunda frase es la prueba de que toda la cadena funciona."],
              ],
            },
          },
        ],
      },
      {
        id: "leads-access",
        heading: "El acceso a clientes potenciales, solo si Meta lo pide",
        blocks: [
          {
            p: "La mayoría de las empresas nunca tocan el Leads Access Manager de Meta, y para ellas basta con la conexión a la Página. Si la suya lo restringió, Meta le niega los clientes potenciales a FieldQuo, **Buscar mis formularios** responde con el mensaje del Leads Access Manager de arriba y la lista de verificación suma un paso: **FieldQuo asignado en «Leads access» de Meta**, con el enlace **Abrir Leads access en Meta**. Solo en ese caso:",
          },
          {
            steps: [
              "Abra la configuración del negocio en Meta y luego «Integrations» → «Leads access». La dirección **business.facebook.com/settings/leads-accesses** lleva directo ahí.",
              "Elija su Página.",
              "Abra la pestaña «CRMs» y pulse «Assign CRMs».",
              "Elija FieldQuo y confirme.",
              "De vuelta en FieldQuo, pulse otra vez **Buscar mis formularios**. Cuando Meta ya no se niega, el paso sale de la lista de verificación.",
            ],
          },
          {
            note: "Son las pantallas y las etiquetas de Meta, y FieldQuo no puede asignarse a sí mismo: debe hacerlo alguien que administre su negocio en Meta.",
          },
        ],
      },
      {
        id: "test-it",
        heading: "Paso 4: enviar un cliente potencial de prueba",
        blocks: [
          {
            steps: [
              "Abra la Lead Ads Testing Tool de Meta en **developers.facebook.com/tools/lead-ads-testing** (el enlace **Abrir la Lead Ads Testing Tool de Meta** de la lista de verificación la abre) con un inicio de sesión de Facebook que administre la Página.",
              "Elija su Página y un formulario que puso en **Activado**, y envíe un cliente potencial de prueba.",
              "Vuelva a cargar **Configuración → Meta Ads**: aparece **Último recibido el …**, sube el conteo de **Clientes potenciales** del formulario y se marca **Primer cliente potencial recibido**.",
              "Abra **Prospectos**. La respuesta de prueba es una tarjeta como cualquier otra: recuerde que es una prueba cuando la vea.",
            ],
          },
          {
            p: "FieldQuo se entera de una respuesta de dos maneras: el aviso instantáneo de Meta y su propia relectura de cada formulario activado una vez por hora. Si el aviso instantáneo se pierde, el cliente potencial llega igual en la siguiente pasada horaria, y nunca llega dos veces, porque cada uno se registra con el identificador de Meta.",
          },
        ],
      },
    ],
    faq: [
      { q: "¿También tengo que conectar la cuenta publicitaria de Meta?", a: "No para los clientes potenciales: se leen con la conexión a la Página. Conectar la cuenta publicitaria agrega lo que gasta en anuncios a sus cifras de marketing." },
      { q: "¿Por qué mi lista de verificación no muestra el paso del acceso a clientes potenciales?", a: "Porque Meta no se ha negado a FieldQuo. El paso solo aparece después de que Buscar mis formularios responde con el rechazo del Leads Access Manager de Meta, ya que la mayoría de las empresas nunca restringen ese acceso." },
      { q: "¿Me avisarán de un cliente potencial que llega por un formulario?", a: "Sí. Se crea como cualquier otra solicitud: con puntuación caliente, tibio o frío, y se anuncia a las mismas personas que un cliente potencial de su sitio web." },
    ],
  },

  "answer-facebook-and-instagram-messages-from-fieldquo": {
    title: "Responder mensajes de Facebook e Instagram desde FieldQuo",
    summary:
      "Conecte su Página de Facebook una vez y sus mensajes, y los de la cuenta de Instagram vinculada, llegan a Mensajes, donde usted los responde dentro de la ventana de 24 horas de Meta.",
    updated: "2026-09-28",
    intro: [
      "Cuando un propietario escribe a su Página de Facebook, o a la cuenta profesional de Instagram vinculada a ella, la conversación llega a **Mensajes** en FieldQuo y usted responde desde ahí. La respuesta sale de su Página o de su cuenta de Instagram: el cliente nunca ve FieldQuo.",
      "Dos reglas vienen de Meta, no de FieldQuo, y este artículo trata sobre todo de ellas: una empresa solo puede responder dentro de las 24 horas posteriores al último mensaje del cliente, y solo una aplicación a la vez puede responder una conversación. Mientras **Mensajes** muestre **Vista previa anticipada.** arriba, funciona y algunas partes todavía pueden cambiar.",
    ],
    sections: [
      {
        id: "connect",
        heading: "Conectar su Página",
        blocks: [
          {
            steps: [
              "Abra **Configuración → Meta Ads** (solo propietario y administradores) y baje hasta **Publicación en Facebook e Instagram**.",
              "Pulse **Conectar Facebook e Instagram**, inicie sesión en Facebook y acepte todos los permisos que muestra Meta.",
              "Si su inicio de sesión administra varias Páginas, elija una en **¿Qué página?** y pulse **Conectar esta página**.",
              "Revise la línea bajo el nombre de la Página. **Meta está enviando los mensajes de esta página a FieldQuo — activado el …** significa que los mensajes nuevos llegarán solos.",
            ],
          },
          {
            figure: "live:app-settings-meta-ads",
            caption: "Configuración → Meta Ads: una Página conectada con su cuenta de Instagram, la línea que indica que Meta envía los mensajes de la Página a FieldQuo, y la importación de conversaciones anteriores.",
          },
          {
            note: "Otras líneas indican qué falla: **Los mensajes de esta página no llegan a FieldQuo** viene con **Volver a intentar la suscripción**; **Tu bandeja de entrada aún no está activada para esta página** viene con **Activar la bandeja de entrada**; una línea que nombra permisos no concedidos significa que Meta todavía no los aprobó para FieldQuo. Instagram necesita una cuenta profesional de Instagram vinculada a la Página; si no, la tarjeta dice **No hay ninguna cuenta de Instagram vinculada a esta página: solo Facebook.**",
          },
        ],
      },
      {
        id: "what-arrives",
        heading: "Qué llega y quién lo ve",
        blocks: [
          {
            bullets: [
              "Cada conversación nueva aparece en **Mensajes**, marcada como Facebook o Instagram. Los filtros **Facebook** e **Instagram** acotan la lista, y las conversaciones se agrupan en **Por responder**, **Esperando su respuesta**, **Apartadas** y **Terminadas**.",
              "Lo que la persona envía llega con ella: el texto, las fotos y otros adjuntos, y un pin en el mapa cuando comparte una ubicación por Messenger.",
              "Meta no entrega por sí solo las conversaciones de antes de conectar. **Importar conversaciones anteriores** en la tarjeta de configuración, o **Actualizar desde Facebook** en Mensajes, trae hasta los últimos 30 días; se puede usar una vez cada diez minutos.",
              "Sus respuestas desde FieldQuo son solo texto en Facebook e Instagram: el clip para fotos y archivos solo aparece en las conversaciones de WhatsApp.",
              "Cualquier persona cuyo acceso incluya **Requests** en **View only** o más puede leer la bandeja y recibe una notificación por cada mensaje nuevo si activó las notificaciones; para responder hace falta **View, create, and edit**.",
            ],
          },
          {
            figure: "live:app-messages",
            caption: "Mensajes: los filtros Facebook e Instagram, Actualizar desde Facebook y las conversaciones agrupadas en Por responder y Esperando su respuesta.",
          },
        ],
      },
      {
        id: "the-24-hour-window",
        heading: "La ventana de respuesta de 24 horas",
        blocks: [
          {
            p: "Facebook e Instagram solo permiten a una empresa responder dentro de las 24 horas posteriores al último mensaje del cliente. La ventana vuelve a empezar cada vez que la persona escribe de nuevo. FieldQuo la calcula antes de que usted escriba, así la conversación le dice en qué punto está en lugar de dejar que Meta rechace una respuesta ya escrita.",
          },
          {
            table: {
              head: ["La conversación muestra", "Qué puede hacer"],
              rows: [
                ["Nada: la ventana está abierta", "Responder con normalidad."],
                ["**Queda menos de una hora para responder.**", "Responder ya; después no podrá responder desde FieldQuo hasta que la persona vuelva a escribir."],
                ["**Ventana de respuesta cerrada.** (pasaron más de 24 horas)", "No se puede enviar nada desde FieldQuo. La conversación se reabre en cuanto la persona vuelva a escribir; mientras tanto, llámela o envíele un correo. **Abrir la ficha de … para llamar o enviar un correo** lo lleva ahí cuando la conversación está vinculada a un cliente."],
                ["**Ventana de respuesta cerrada.** (esta persona nunca escribió a su Página o cuenta)", "Aquí solo se puede responder a alguien que le escribió. Comuníquese con ella por otro medio."],
              ],
            },
          },
          {
            note: "Meta tiene una excepción para respuestas de un agente humano hasta siete días después, pero es un permiso que FieldQuo no tiene, así que no hay forma de saltarse las 24 horas desde FieldQuo en Facebook o Instagram.",
          },
        ],
      },
      {
        id: "another-app",
        heading: "«Otra aplicación controla esta conversación»",
        blocks: [
          {
            p: "Meta deja que solo una aplicación a la vez responda una conversación. Si las respuestas automáticas de Meta o Business AI ya la tomaron, su respuesta falla con **No enviado: otra aplicación controla esta conversación en Meta. Tu mensaje sigue en el cuadro.** y la conversación indica qué cambiar:",
          },
          {
            bullets: [
              "En Meta Business Suite, abra «Inbox» → «Automations» y desactive las respuestas automáticas y Business AI para la Página o la cuenta de Instagram.",
              "Facebook: en la configuración de su Página, abra la pestaña «Conversation Routing» y establezca FieldQuo como la aplicación predeterminada. Instagram: en la configuración de enrutamiento de conversaciones de Meta para esa cuenta, establezca FieldQuo como la aplicación que responde los mensajes.",
              "Después pulse **Enviar** otra vez: su mensaje sigue en el cuadro. Una conversación que la automatización de Meta ya tiene puede quedarse con ella hasta que la devuelva; las conversaciones nuevas llegan a FieldQuo.",
              "Solo en Facebook, **Pedir el control de esta conversación** le pide a Meta que le ceda esa conversación. Decide la aplicación que la tiene y a FieldQuo no se le informa su respuesta, así que pulse **Enviar** para saberlo.",
            ],
          },
        ],
      },
      {
        id: "instagram-allow-access",
        heading: "Instagram: «Allow Access to Messages»",
        blocks: [
          {
            p: "Si una respuesta de Instagram falla con **No enviado: Meta rechazó esta respuesta de Instagram porque la mensajería de Instagram no está activada para esta conexión.**, la conversación explica por qué y qué cambiar. De su lado hay dos cosas:",
          },
          {
            steps: [
              "En la aplicación de Instagram, active el ajuste que exige Meta: Instagram Settings > Messages and story replies > Message controls > Connected Tools > Allow Access to Messages.",
              "Si el aviso nombra un permiso que le falta a su conexión, pulse **Volver a conectar en ajustes** y acepte todo lo que pida Meta. Quien vuelva a conectar necesita al menos el acceso «Moderate» en la Página de Facebook.",
              "Pulse **Enviar** otra vez. Si sigue fallando, comuníquese con el soporte de FieldQuo.",
            ],
          },
        ],
      },
    ],
    faq: [
      { q: "¿Puedo escribir a alguien que nunca le escribió a mi Página?", a: "No. Facebook e Instagram solo permiten a una empresa responder a una persona que le escribió en las últimas 24 horas. Llámela o envíele un correo." },
      { q: "¿Desconectar la Página borra las conversaciones?", a: "No. Se elimina el acceso y dejan de llegar mensajes nuevos, pero las conversaciones que ya están en Mensajes se quedan, y al volver a conectar se retoman." },
      { q: "¿Por qué falló una respuesta si contesté dentro de la hora?", a: "Lo más común es que otra aplicación tenga la conversación: vea «Otra aplicación controla esta conversación» más arriba. La respuesta fallida dice de qué caso se trata." },
    ],
  },

  "whatsapp-coming-soon": {
    title: "WhatsApp (próximamente)",
    summary:
      "Los mensajes de WhatsApp Business en FieldQuo están listos y esperan la aprobación de Meta; esto es lo que dice la tarjeta hoy y lo que hará cuando Meta diga que sí.",
    updated: "2026-09-28",
    intro: [
      "Todavía no puede conectar un número de WhatsApp a FieldQuo. La parte de la bandeja de entrada está lista, pero Meta tiene que aprobar a FieldQuo antes de que cualquier empresa pueda conectar su número de WhatsApp, y esa aprobación no ha llegado. FieldQuo no sabe cuándo llegará.",
      "En lugar de un botón para conectar que lo llevaría a una página de Meta que lo rechaza, la tarjeta **WhatsApp Business** de **Configuración → Meta Ads** lo dice en una frase.",
    ],
    sections: [
      {
        id: "what-the-card-says",
        heading: "Qué dice la tarjeta hoy",
        blocks: [
          {
            p: "La tarjeta dice **WhatsApp llegará pronto. Estamos esperando que Meta apruebe a FieldQuo para WhatsApp y le avisaremos el día que esté listo.** Si su Página de Facebook o su cuenta de Instagram ya están conectadas, agrega por ejemplo **Sus mensajes de Facebook e Instagram ya llegan aquí.**",
          },
          {
            p: "No hay botón ni nada que llenar. Como el resto de **Configuración → Meta Ads**, la tarjeta es solo para el propietario y los administradores.",
          },
        ],
      },
      {
        id: "what-is-missing",
        heading: "Qué está esperando FieldQuo",
        blocks: [
          {
            p: "Para que una empresa pueda conectar su propio número de WhatsApp, Meta tiene que aprobar a FieldQuo para WhatsApp: el permiso para responder mensajes de WhatsApp y el derecho a llevar a las empresas por el registro de WhatsApp de Meta. Mientras tanto, ese registro rechaza a toda empresa que no sea la de FieldQuo, así que un botón para conectar siempre terminaría en el rechazo de Meta. Por eso no se muestra ninguno.",
          },
        ],
      },
      {
        id: "what-it-will-do",
        heading: "Qué hará cuando Meta lo apruebe",
        blocks: [
          {
            bullets: [
              "**Conectar WhatsApp** lo llevará por el registro de Meta, donde elegirá o creará una cuenta de WhatsApp Business y el número al que le escriben sus clientes.",
              "Los mensajes a ese número llegarán a **Mensajes** con un filtro **WhatsApp**, junto a sus conversaciones de Facebook e Instagram.",
              "Se aplicará la regla de 24 horas de WhatsApp: respuestas escritas dentro de las 24 horas posteriores al último mensaje del cliente y, después, solo una plantilla que Meta aprobó de antemano. FieldQuo leerá sus plantillas desde Meta con **Actualizar plantillas**.",
              "Desde una conversación de WhatsApp podrá enviar fotos, videos y documentos, y la dirección de su empresa como pin en el mapa cuando esa dirección se eligió de las sugerencias del mapa.",
            ],
          },
        ],
      },
      {
        id: "until-then",
        heading: "Mientras tanto",
        blocks: [
          {
            bullets: [
              "Responda sus mensajes de Facebook e Instagram en FieldQuo: vea [[answer-facebook-and-instagram-messages-from-fieldquo|Responder mensajes de Facebook e Instagram desde FieldQuo]].",
              "Siga respondiendo WhatsApp desde su teléfono como hoy. No tiene que pedirle nada a FieldQuo; la tarjeta cambia cuando Meta lo apruebe.",
              "Si ya tiene una cuenta de WhatsApp Business en Meta, puede escribir sus plantillas de mensajes con anticipación en el WhatsApp Manager de Meta; FieldQuo leerá las aprobadas una vez que conecte su número.",
            ],
          },
        ],
      },
    ],
    faq: [
      { q: "¿Puedo tener acceso anticipado?", a: "No. Mientras Meta no apruebe a FieldQuo, su registro rechaza a toda empresa que no sea la de FieldQuo, así que no hay una puerta que abrir antes." },
      { q: "¿Cuándo estará listo?", a: "Cuando Meta lo apruebe: Meta fija los tiempos, no FieldQuo. La tarjeta cambia sola ese día." },
    ],
  },
};
