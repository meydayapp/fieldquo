// content/help/es/marketing-and-website-2.js
//
// Parte 2 de la categoría "marketing-and-website" en español (ver el
// compositor, marketing-and-website.js). Slugs asignados a esta parte
// (lib/help/tree.js): pamphlet-routes, email-campaigns-and-subscribers,
// marketing-spend, the-marketing-designer, make-a-post-from-a-job,
// social-posting-and-scheduling, connect-meta-ads,
// ask-for-reviews-automatically, refer-another-business,
// instant-estimates-as-marketing.
//
// Misma estructura que el inglés (mismas secciones, mismos bloques, mismas
// figuras); las palabras en pantalla vienen del bloque `es` de
// app/i18n/appMessages.js.
export const ARTICLES = {
  "pamphlet-routes": {
    title: "Rutas de folletos y colgadores de puerta",
    summary:
      "Planifique una distribución puerta a puerta como una lista de direcciones, deje que FieldQuo las ordene en una ruta y marque cada parada desde el teléfono; una conversación en la puerta se convierte directamente en un cliente y una visita.",
    updated: "2026-09-12",
    intro: [
      "Una campaña de folletos es una campaña de marketing del tipo **Distribución de folletos**. Usted agrega las direcciones que piensa cubrir, FieldQuo las ordena en una ruta eficiente, a pie o en camioneta, partiendo de la dirección de su empresa, y quien reparte marca cada parada sobre la marcha: **Entregado**, **No estaba** o **Habló con el propietario**. Esta última es el objetivo: una conversación en la puerta se convierte en una ficha de cliente, en una visita agendada si lo desea, y en un presupuesto que puede empezar ahí mismo.",
      "FieldQuo planifica y da seguimiento a la ruta. No imprime los colgadores de puerta ni organiza el reparto: el material impreso y las personas los pone usted. Nada en los datos de comparación que FieldQuo mantiene sobre Jobber, Housecall Pro y Projul menciona una ruta de colgadores de puerta en ningún plan, y por eso este artículo está bajo Solo en FieldQuo.",
    ],
    sections: [
      {
        id: "overview",
        heading: "Resumen",
        blocks: [
          { p: "Las campañas viven bajo **Marketing** en la barra lateral. En palabras de la pantalla: «Gestiona y haz seguimiento de tus campañas: anuncios pagados, envíos masivos de correo y distribución de folletos puerta a puerta, con rutas, asignaciones y seguimientos en la puerta en un solo lugar.» Cada campaña es una tarjeta con su chip de estado, su tipo (**Distribución de folletos**, **Meta / anuncios pagados**, **Envío masivo de correo**, **Otro**) y, en una campaña de folletos, su avance —**26/40 paradas** y **9 contactados**— además de la persona asignada." },
          { figure: "live:app-marketing", caption: "Marketing: una tarjeta por campaña, con Suscriptores, Gasto en marketing y Nueva campaña en la parte superior." },
          { p: "Abra una campaña de folletos y verá la ruta: un mapa con marcadores numerados en el orden de la ruta, un cuadro para agregar direcciones y la lista ordenada de paradas con un chip de estado en cada una. Esa página es la que la persona que recorre la ruta mantiene abierta en su teléfono." },
        ],
      },
      {
        id: "create-a-route",
        heading: "Cómo crear una ruta",
        blocks: [
          { steps: [
            "Abra **Marketing** y pulse **Nueva campaña**.",
            "Póngale un nombre, deje el tipo en **Distribución de folletos** y elija a quién se asigna bajo **Asignar a** (o déjela **Sin asignar**). Pulse **Crear campaña**.",
            "Abra la campaña. Bajo **Agregar una dirección a la ruta**, empiece a escribir una dirección, elíjala entre las sugerencias y pulse **Agregar**. Repita con cada calle que planea cubrir.",
            "Cada dirección que agrega se coloca automáticamente en la ruta: el mapa y la lista numerada se reordenan tras cada adición.",
          ] },
          { figure: "create:app-marketing-create", caption: "Nueva campaña: el nombre, el tipo, la persona asignada, y el presupuesto y el enlace opcionales." },
          { note: "El orden es una ruta del vecino más cercano: parte de la dirección de su empresa (en Configuración de la empresa) y va siempre a la parada más cercana que todavía no se ha colocado. Una dirección que no se pudo ubicar en el mapa queda al final, en el orden en que la agregó, para que nunca distorsione las que sí se ubicaron." },
        ],
      },
      {
        id: "working-the-route",
        heading: "Trabajar la ruta desde la puerta",
        blocks: [
          { p: "Cada parada empieza como **Pendiente** y tiene tres botones. Lo que hace cada uno:" },
          { table: {
            head: ["Botón", "Qué cambia"],
            rows: [
              ["**Entregado**", "La parada se marca Entregado y cuenta como visitada. No pasa nada más."],
              ["**No estaba**", "La parada se marca No estaba (en ámbar). Cuenta como visitada; es la que vale la pena volver a visitar."],
              ["**Habló con el propietario**", "Abre un formulario breve: **Nombre del propietario**, **Teléfono (opcional)** y **Agendar una visita (opcional)**. Al guardar, FieldQuo crea un cliente con ese nombre y la dirección de la parada (o reutiliza el que ya estaba vinculado a la parada), marca la parada Habló con el propietario y, si puso fecha y hora, agenda una cita en esa dirección."],
              ["El ícono de papelera (**Quitar parada**)", "Elimina la parada de la ruta. No se puede deshacer."],
            ],
          } },
          { p: "En cuanto una parada tiene un cliente, aparece debajo un enlace **Crear presupuesto**. Abre el constructor de presupuestos ya centrado en ese cliente, para que la estimación empiece antes de salir de la calle. El encabezado de la campaña cuenta como **visitados** todas las paradas que ya no están Pendientes." },
          { warning: "Agendar la visita desde la puerta requiere permisos de citas. Si la persona que recorre la ruta no los tiene, el formulario lo dice: deje la fecha en blanco y solo guarde el cliente; alguien de la oficina puede agendarla desde la ficha del cliente." },
        ],
      },
      {
        id: "who-can-see-it",
        heading: "Quién puede verlo",
        blocks: [
          { p: "La fila **Marketing**, la lista de campañas y **Nueva campaña** son para propietarios, administradores, gerentes y despachadores, la misma regla que el resto de pantallas de marketing. Crear una campaña y agregar direcciones también requieren ese nivel." },
          { p: "Marcar una parada está abierto a propósito a cualquier miembro activo de la empresa: repartir es trabajo de campo, y la persona en la calle suele ser de la cuadrilla. No verá la fila Marketing, pero la página de la campaña se le abre desde un enlace: envíe el enlace de la campaña a la persona asignada y los botones Entregado / No estaba / Habló con el propietario funcionan en su teléfono. El presupuesto de la campaña se le oculta." },
        ],
      },
    ],
    faq: [
      { q: "¿FieldQuo imprime los folletos o los colgadores de puerta?", a: "No. Solo planifica y da seguimiento a la ruta; el material lo imprime y lo reparte usted. Registre lo que costó la impresión en Gasto en marketing, canal Volantes, para que entre en su costo por prospecto." },
      { q: "¿Por qué la tarjeta sigue diciendo Draft?", a: "El chip de estado de una campaña de folletos no lo cambia nada en la pantalla; fíjese en el conteo de paradas y de contactados, que es lo que la ruta actualiza." },
      { q: "¿Puedo pegar una lista completa de direcciones de una vez?", a: "La pantalla agrega una dirección a la vez, desde las sugerencias del mapa. Cada una se coloca en la ruta en cuanto se agrega." },
    ],
  },

  "email-campaigns-and-subscribers": {
    title: "Campañas de correo y suscriptores",
    summary:
      "Envíe un correo a todos los clientes suscritos desde su propia dirección de envío, con una plantilla escrita por usted, un enlace de baja que funciona en cada copia y una lista que usted controla.",
    updated: "2026-09-12",
    intro: [
      "Una campaña de **Envío masivo de correo** manda una de sus plantillas de correo a todos los de su lista de **Suscriptores** que no se hayan dado de baja. Sale a nombre de su empresa y de su remitente, con su logotipo y su color de marca en el encabezado, y cada copia lleva un enlace de baja de un clic, el mismo que llevan sus solicitudes de reseña, porque ambas son marketing según las leyes de Canadá y Estados Unidos.",
      "La lista es suya: impórtela desde sus clientes con un clic, agregue personas que todavía no son clientes, y dé de baja o vuelva a suscribir a quien quiera a mano.",
    ],
    sections: [
      {
        id: "overview",
        heading: "Resumen",
        blocks: [
          { p: "Intervienen tres pantallas. **Configuración → Plantillas de correo** es donde viven las palabras: una campaña solo puede enviar una plantilla del tipo Marketing o Personalizada, nunca las automáticas de presupuesto o factura. **Marketing → Suscriptores** es a quién va. **Marketing → Nueva campaña** con el tipo **Envío masivo de correo** une las dos, y la página de la campaña tiene el botón **Send Campaign**." },
          { figure: "live:app-marketing", caption: "Marketing: Suscriptores está junto a Nueva campaña; la tarjeta de una campaña de correo muestra su plantilla y Enviado a N o Aún no enviado." },
        ],
      },
      {
        id: "subscribers",
        heading: "La lista de Suscriptores",
        blocks: [
          { p: "La pantalla Suscriptores dice arriba exactamente para qué sirve: «{subscribed} suscritos de {total} en total: es a quienes envía una campaña de envío masivo de correo.» Dos formas de llenarla:" },
          { bullets: [
            "**Importar desde Clientes** trae a cada cliente con correo registrado. Es seguro volver a pulsarlo después: un cliente que ya está en la lista conserva su estado —a quien se dio de baja nunca se le vuelve a suscribir en silencio— y solo las filas nuevas entran suscritas. El resultado dice «Se importaron 34 de 41 clientes con un correo registrado.» Las filas importadas llevan la etiqueta **De clientes**.",
            "**Agregar suscriptor** pide un **Correo**, un **Nombre (opcional)** y un **Teléfono (opcional)**, para un prospecto que no es cliente.",
          ] },
          { p: "Cada fila tiene **Dar de baja** o **Volver a suscribir**, y un botón para quitarla. Dar de baja conserva la fila y su historial —solo cambia la marca de suscrito—, así que una reimportación no puede deshacerlo." },
        ],
      },
      {
        id: "send-a-campaign",
        heading: "Cómo enviar una campaña",
        blocks: [
          { steps: [
            "En **Configuración → Plantillas de correo**, escriba el correo como plantilla de Marketing. Su asunto es lo que ven los destinatarios; el nombre de la campaña es solo su etiqueta interna.",
            "Abra **Marketing → Suscriptores** y pulse **Importar desde Clientes**; luego agregue a los demás a mano.",
            "De vuelta en **Marketing**, pulse **Nueva campaña**, ponga el tipo en **Envío masivo de correo**, elija la plantilla bajo **Plantilla a enviar** y pulse **Crear campaña**.",
            "Abra la campaña. Muestra la plantilla, el número de destinatarios suscritos y un botón **Send Campaign** (los botones de esta página están en inglés). Púlselo, lea la confirmación —recuerda que el envío sale a todos los suscritos de inmediato y no se puede deshacer— y pulse **Yes, send now**.",
          ] },
          { p: "El envío rellena los campos de la plantilla con cada suscriptor —nombre, dirección y teléfono del cliente; nombre, teléfono y correo de su empresa— y los manda uno por uno. Cada destinatario se reserva antes de que salga su copia, de modo que pulsar Send dos veces, o un envío interrumpido a medias, nunca escribe dos veces a la misma persona. Un envío terminado marca la campaña **completed** y la tarjeta dice **Enviado a N**; uno interrumpido dice «Partially sent» con un botón **Resume send** que escribe solo a quienes faltan." },
          { note: "Una campaña terminada no se puede reenviar desde la misma página. Para volver a escribir a la lista, cree una campaña nueva. Enviar también exige una empresa que haya completado el pago de alta: una empresa todavía en la puerta de configuración recibe la invitación a completarla en lugar de enviar." },
        ],
      },
      {
        id: "unsubscribes",
        heading: "Qué hace el enlace de baja",
        blocks: [
          { p: "Cada correo de campaña lleva un enlace de baja y los encabezados que permiten a Gmail y Apple Mail mostrar su propio botón de cancelar suscripción. El enlace abre una página que nombra a su empresa y dice, con las palabras guardadas en la fila, que solo detiene el correo promocional: los presupuestos, las facturas y los recibos siguen llegando. Un clic pone a la persona como dada de baja; no se borra nada, y se conservan el momento y el texto que vio." },
          { p: "La misma lista se revisa antes de que salga una solicitud de reseña, así que una baja detiene ambas. Todo el detalle: [[client-consent-and-unsubscribes|Consentimiento de clientes y bajas]]." },
        ],
      },
      {
        id: "who-can-see-it",
        heading: "Quién puede verlo",
        blocks: [
          { p: "Propietarios, administradores, gerentes y despachadores ven Marketing, la lista de suscriptores y el botón de envío. Los estimadores y la cuadrilla, no. La dirección de envío es la que FieldQuo ha verificado para su empresa; vea [[send-from-your-own-domain|Enviar correo desde su propio dominio]]." },
        ],
      },
    ],
    faq: [
      { q: "¿Puedo ver quién abrió o hizo clic?", a: "No. FieldQuo registra a quién se envió la campaña y cuándo; no rastrea aperturas ni clics." },
      { q: "¿Puedo enviar a un segmento, por ejemplo solo a clientes de techos?", a: "No desde esta pantalla. Una campaña va a todas las filas suscritas. Dé de baja primero las filas que quiera excluir, o mantenga una lista aparte agregando suscriptores a mano." },
      { q: "¿De dónde salen los colores y el logotipo del correo?", a: "De Configuración → Marca, igual que sus presupuestos y facturas. Nada en el correo menciona a FieldQuo." },
    ],
  },

  "marketing-spend": {
    title: "Gasto en marketing",
    summary:
      "Registre lo que gasta para conseguir trabajo —por canal, a mano o sincronizado desde Meta— y lea un costo combinado por prospecto calculado a partir de su número real de prospectos.",
    updated: "2026-09-12",
    intro: [
      "**Marketing → Gasto en marketing** es el registro de lo que paga por conseguir prospectos: Facebook e Instagram, Google, TikTok, volantes, incentivos por recomendación y lo demás. Usted teclea los importes, o conecta su cuenta publicitaria de Meta y deja que **Sincronizar ahora** los importe. Sobre el registro, FieldQuo divide el total entre el número de prospectos reales que llegaron y muestra un **Costo combinado por prospecto**.",
      "Combinado es la palabra honesta. El costo por prospecto por campaña solo se calcula para los prospectos que llegaron por un formulario de Meta; todos los demás canales —y el propietario que vio el anuncio y llamó— siguen combinados en el total, porque nada vincula ese gasto con ese prospecto.",
    ],
    sections: [
      {
        id: "overview",
        heading: "Resumen",
        blocks: [
          { p: "El subtítulo de la pantalla marca su alcance: lo que gasta para conseguir trabajo, por canal, y lo que le cuesta por prospecto, combinado en todo. De arriba abajo: la tarjeta **Costo combinado por prospecto**, una tabla **Gasto por canal**, una tabla **Campañas** para lo sincronizado desde Meta, y la lista de entradas con **Editar** y **Eliminar** en cada una." },
          { figure: "live:app-marketing", caption: "Marketing: el botón Gasto en marketing, arriba a la derecha, abre el registro." },
        ],
      },
      {
        id: "log-spend",
        heading: "Cómo registrar un gasto",
        blocks: [
          { steps: [
            "Abra **Marketing**, luego **Gasto en marketing**, y pulse **Registrar gasto**.",
            "Elija el **Canal** —Facebook / Instagram, Google, TikTok, Volantes, Incentivo por recomendación u Otro—, la **Fecha** y el **Importe**.",
            "Si quiere, nombre la **Campaña** e ingrese **Prospectos que trajo** y **Conversiones** si los conoce. Son su propia estimación; la pantalla los muestra «según lo ingresado» y nunca los mezcla con su número real de prospectos.",
            "Pulse **Guardar**. La entrada aparece en la lista con origen **Manual**; las filas que vinieron de Meta dicen **Desde Meta**.",
          ] },
          { tip: "¿Hace anuncios en Meta? La propia pantalla lo dice: conecte su cuenta publicitaria y el gasto se importa sin teclear nada; vea [[connect-meta-ads|Conectar su cuenta publicitaria de Meta]]." },
        ],
      },
      {
        id: "the-numbers",
        heading: "Qué significa cada cifra",
        blocks: [
          { table: {
            head: ["Cifra", "Cómo se calcula"],
            rows: [
              ["**Costo combinado por prospecto**", "Todo lo registrado, dividido entre los prospectos de su tablero de Prospectos en el mismo periodo. Los prospectos ingresados a mano o importados de un archivo se dejan fuera y se cuentan aparte —«+ 4 prospectos ingresados manualmente o importados, no contados»— porque el gasto de este periodo no los provocó."],
              ["**Gasto por canal**", "Los importes registrados por canal bajo **Gastado**, con los prospectos y el costo por prospecto que usted tecleó, marcados «(según lo ingresado)», y una columna **Presupuestado (campañas)**: los presupuestos de sus campañas no archivadas en Marketing, sumados por canal — las campañas de folletos a Volantes, Meta / anuncios pagados a Facebook / Instagram, correo y otras a Otro. Un canal con presupuesto y nada registrado muestra «nada registrado todavía», y una lista bajo la tabla nombra la campaña de la que sale la cifra. Un presupuesto nunca entra en un total ni en un costo por prospecto."],
              ["**Campañas**", "Una fila por campaña de Meta que FieldQuo ha sincronizado: lo que costó, lo que Meta reportó (impresiones, alcance, clics, CTR, CPC, conversaciones, reproducciones de video, interacciones) y qué fue de sus prospectos por formulario: prospectos, presupuestos, trabajos, facturado."],
              ["**≈ aproximado**", "Una cuenta de Meta que reporta en una moneda distinta a la de su empresa se convierte a un tipo de cambio fijado y se marca ≈. Si ese tipo tiene más de 45 días, o FieldQuo no tiene tipo de cambio para ese par, las filas quedan fuera y la pantalla nombra el importe y el motivo."],
            ],
          } },
          { p: "La columna de prospectos de la tabla de campañas solo cuenta los formularios de Meta recibidos para esa campaña. Su propia nota lo dice: un propietario que vio el anuncio y llamó no se cuenta, así que el costo por prospecto ahí es lo máximo que le costó un prospecto por formulario; la cifra combinada de arriba es el cuadro completo." },
          { warning: "Eliminar una entrada cambia las cifras de costo por prospecto; la confirmación lo dice. Las mismas filas alimentan la tarjeta de costos del negocio del panel de KPI y el correo de resumen mensual." },
        ],
      },
      {
        id: "who-can-see-it",
        heading: "Quién puede verlo",
        blocks: [
          { p: "Propietarios, administradores, gerentes y despachadores, la regla de la fila Marketing. Conectar la cuenta de Meta que lo alimenta es solo para propietarios y administradores." },
        ],
      },
    ],
    faq: [
      { q: "¿FieldQuo puede decirme qué canal está funcionando?", a: "Solo para los prospectos por formulario de Meta, por campaña. Todo lo demás está combinado, y la pantalla lo dice bajo la cifra en lugar de adivinar." },
      { q: "¿La sincronización de Meta corre sola?", a: "No. Pulse Sincronizar ahora en Configuración → Meta Ads; cada pulsación importa los últimos 30 días." },
      { q: "¿Por qué mi cifra dice «Aún no hay datos suficientes»?", a: "No se ha registrado gasto, o no llegó ningún prospecto en el periodo. Ambos casos se muestran en lugar de un cero." },
      { q: "¿Por qué un canal muestra una cifra Presupuestada si no registré nada?", a: "Porque una campaña de ese canal en Marketing lleva un presupuesto. Presupuestado es lo que reservó para toda la vida de la campaña, no para un periodo; Gastado es lo que se registró aquí o se sincronizó desde Meta. Archive la campaña y su presupuesto sale de la columna." },
    ],
  },

  "the-marketing-designer": {
    title: "El Diseñador de marketing",
    summary:
      "Diseñe un anuncio en un lienzo y obténgalo en todos los tamaños que piden Instagram, TikTok, Facebook y YouTube: plantillas, sus propias fotos, fotos de banco, texto y formas gratis; imágenes con IA con crédito; aprobación antes de que salga nada.",
    updated: "2026-09-12",
    intro: [
      "La fila **Diseñador** de la barra lateral abre el Diseñador de marketing. Su propia descripción: diseñe un anuncio y expórtelo en todos los tamaños que pide una red social —Instagram, TikTok, Facebook y YouTube— sin rehacer la composición a mano. Un diseño lleva cinco formatos a la vez, cada uno con sus propios ajustes guardados, y **Descargar todos los formatos** le entrega un PNG de cada uno.",
      "Ningún dato de comparación que FieldQuo mantiene sobre Jobber, Housecall Pro o Projul menciona un lienzo de diseño de anuncios en ningún plan, y por eso este artículo está bajo Solo en FieldQuo. Lo que no es: una herramienta que publique por usted hoy; vea [[social-posting-and-scheduling|Publicar en Facebook e Instagram, ahora o más tarde]] para saber cómo está eso.",
    ],
    sections: [
      {
        id: "overview",
        heading: "Resumen",
        blocks: [
          { p: "Cada diseño pertenece a una campaña publicitaria, y las campañas son las mismas filas que en la pantalla Marketing: una creada aquí aparece allá y viceversa. El índice del Diseñador lista cada campaña con sus diseños: una insignia **Aprobado**, **Sin aprobar** o **Volver a aprobar**, chips para los cinco formatos, y **2/5 formatos listos**. Bajo cada campaña: **Crear una publicación a partir de un trabajo** y un cuadro de nombre con **Nuevo diseño**." },
          { figure: "live:app-marketing-designer", caption: "Diseñador de marketing: Nueva campaña publicitaria arriba, y luego los diseños de cada campaña con su insignia de aprobación y los formatos listos." },
        ],
      },
      {
        id: "the-editor",
        heading: "Qué hay en el editor",
        blocks: [
          { p: "Abra un diseño y el lienzo tiene una pestaña por formato en la parte superior: **Instagram post** (1080 × 1080), **Instagram story** (1080 × 1920), **TikTok** (1080 × 1920), **Facebook feed** (1200 × 630) y **YouTube thumbnail** (1280 × 720). Componga el anuncio una vez; al cambiar de pestaña se reacomoda en el otro marco, y lo que mueva en una pestaña se guarda solo para ese formato. Aparece un aviso cuando algún elemento sobresale del borde de un formato." },
          { bullets: [
            "**Design**: plantillas para empezar.",
            "**Image**: **Upload image**, fotos de banco y una pestaña **Fotos del trabajo** que lista las fotos de un trabajo para que un antes y después real caiga en el lienzo. Las fotos etiquetadas Issue / snag nunca se ofrecen.",
            "**Text**, **Shapes**, **Draw**: las herramientas normales, todas gratis.",
            "**AI**: generación de **Imagen con IA** a partir de una indicación, si quiere partiendo de una de sus fotos, y eliminación de fondo. Es la única parte de pago: consume crédito de imágenes de IA de **Configuración → Crédito de IA**, el panel muestra el precio antes de pulsar y ofrece **Agregar crédito de IA** si el saldo no alcanza. El panel también dice lo que no sabe: sus precios ni su zona de servicio.",
            "**Settings**: el tamaño del lienzo y el fondo.",
          ] },
          { p: "Los cambios se guardan sobre la marcha: el encabezado dice «All changes saved», «Saving…» o «Couldn't save — check your connection». **Descargar todos los formatos** exporta cada pestaña a un PNG con el nombre de la campaña y del formato." },
        ],
      },
      {
        id: "approve",
        heading: "Revisar y aprobar",
        blocks: [
          { steps: [
            "Pulse **Revisar y aprobar** en el encabezado del editor.",
            "Escriba o pegue el texto y los hashtags. Si no están guardados, aprobar los guarda primero.",
            "Pulse **Aprobar esta publicación**. La insignia pasa a **Aprobado**, con quién aprobó y cuándo.",
          ] },
          { p: "La aprobación es una huella del arte y de las palabras. Cambie cualquiera de los dos después y la insignia dirá **Volver a aprobar**: «Esto cambió después de aprobarse. Míralo otra vez y vuelve a aprobarlo.» Cambiar el nombre del diseño no la retira; **Retirar la aprobación** sí, a propósito. Nada se puede programar ni publicar hasta que un diseño esté aprobado." },
          { p: "Bajo «What next», la pantalla de aprobación ofrece **Descargar todos los tamaños** y **Copiar el texto**. Para un anuncio de pago lo dice claro: suba el archivo descargado en Meta Ads Manager; FieldQuo no puede crear el anuncio por usted, porque eso requiere un permiso de Meta que no le han concedido." },
        ],
      },
      {
        id: "who-can-see-it",
        heading: "Quién puede verlo",
        blocks: [
          { p: "Propietarios, administradores, gerentes y despachadores ven la fila Diseñador y pueden crear, editar, aprobar y eliminar diseños. Eliminar un diseño pide confirmación y no se puede deshacer." },
        ],
      },
    ],
    faq: [
      { q: "¿El Diseñador cuesta aparte?", a: "No. Las plantillas, las subidas, las fotos de banco, las fotos de trabajos, el texto, las formas y todas las exportaciones están incluidas. Solo la generación de imágenes con IA y la eliminación de fondo consumen crédito de IA." },
      { q: "¿De dónde salen las fotos de trabajos?", a: "De las fotos que su cuadrilla registró en los trabajos, con sus etiquetas de etapa; vea [[job-photos-and-tags|Fotos del trabajo y etiquetas]]. Una foto Issue / snag nunca llega a un diseño." },
      { q: "¿Puedo publicar directamente desde aquí?", a: "El botón Publicar y el Calendario social están construidos, pero publicar espera la aprobación de la aplicación por parte de Meta. Hasta entonces, descargue todos los tamaños y publique desde su propia cuenta; la pantalla de aprobación lo dice tal cual." },
    ],
  },

  "make-a-post-from-a-job": {
    title: "Crear una publicación a partir de un trabajo",
    summary:
      "Convierta las fotos de antes y después de un trabajo terminado en una publicación lista para aprobar: las fotos reales de la cuadrilla una junto a otra, un titular escrito a partir del alcance de obra de ese trabajo, y su oficio y su ciudad en la parte de abajo.",
    updated: "2026-09-12",
    intro: [
      "El mejor anuncio que tiene un contratista es la cocina que acaba de terminar. **Crear una publicación a partir de un trabajo**, en el Diseñador de marketing, arma esa publicación con lo que ya existe: la foto **Before / start** más antigua y la foto **Finished** más reciente de un trabajo, etiquetadas BEFORE y AFTER, un titular tomado del alcance de obra del trabajo, y un pie que nombra su oficio y su ciudad. No se inventa nada —la propia pista de la pantalla lo dice— y una foto etiquetada **Issue / snag** nunca se usa.",
    ],
    sections: [
      {
        id: "overview",
        heading: "Resumen",
        blocks: [
          { p: "Es una composición, no una imagen generada. Los píxeles son sus fotografías; lo que FieldQuo decide es dónde van, qué tan grandes son las palabras y qué colores son seguros sobre su color de marca. Al modelo solo se le piden oraciones —un titular y, después, un texto— y si no está disponible la publicación recibe un titular más sobrio y factual armado desde el alcance de obra, en lugar de una publicación rota." },
          { figure: "live:app-marketing-designer", caption: "Diseñador de marketing: Crear una publicación a partir de un trabajo está bajo cada campaña, junto a Nuevo diseño." },
        ],
      },
      {
        id: "steps",
        heading: "Cómo crear una",
        blocks: [
          { steps: [
            "Abra **Diseñador** y busque la campaña a la que pertenece la publicación. Pulse **Crear una publicación a partir de un trabajo**.",
            "FieldQuo repasa sus trabajos y lista los que tienen una foto publicable. Cada uno dice **Antes y después** cuando tiene una foto de inicio y una de final, o **Una sola foto — sin antes/después en este trabajo** cuando solo tiene una.",
            "Pulse **Crearlo** en el trabajo. El diseño se abre en el editor con las fotos colocadas, las etiquetas puestas, el titular escrito y el pie rellenado.",
            "Ajuste lo que quiera en cada pestaña de formato y luego **Revisar y aprobar**. Bajo el texto, **Generar con IA** escribe un texto a partir del alcance de obra real de ese trabajo y lo dice, o le avisa cuando no encontró detalles del trabajo y el texto es genérico.",
          ] },
          { note: "Si ningún trabajo tiene una foto que FieldQuo pueda publicar, la lista dice: «Ningún trabajo tiene aún una foto que podamos publicar. Etiqueta una foto de inicio y otra de final en un trabajo y aparecerá aquí.» El etiquetado se hace en el trabajo; vea [[job-photos-and-tags|Fotos del trabajo y etiquetas]]." },
        ],
      },
      {
        id: "what-goes-in",
        heading: "Qué entra, y qué nunca entra",
        blocks: [
          { table: {
            head: ["Elemento", "De dónde sale"],
            rows: [
              ["La foto BEFORE", "La foto más antigua del trabajo etiquetada **Before / start**."],
              ["La foto AFTER", "La foto más reciente etiquetada **Finished**. Sin pareja, la foto de final más reciente sola, sin etiqueta AFTER."],
              ["El titular", "Escrito a partir del alcance de obra; el titular factual de respaldo nombra el trabajo si el modelo no está disponible."],
              ["El pie", "Su oficio activado, y su ciudad y provincia de Configuración de la empresa."],
              ["Los colores", "Su color de marca, medido para el contraste; nunca elegido por el modelo."],
            ],
          } },
          { p: "Una foto etiquetada **Issue / snag** —un daño por agua detrás de un gabinete, un problema que la cuadrilla señaló— se filtra dos veces: antes de que nada llegue al modelo, y antes de que nada llegue al lienzo. Las fotos de dos trabajos distintos nunca se mezclan en un mismo texto." },
          { p: "El titular y el texto son llamadas a la IA y consumen crédito de IA como el resto de FieldQuo IA; las fotos en sí no se generan y no cuestan nada." },
        ],
      },
      {
        id: "who-can-see-it",
        heading: "Quién puede verlo",
        blocks: [
          { p: "Las mismas personas que el Diseñador: propietarios, administradores, gerentes y despachadores." },
        ],
      },
    ],
    faq: [
      { q: "¿Puedo elegir qué fotos usa?", a: "No en el selector: toma la foto de inicio más antigua y la de final más reciente. Con el diseño abierto, cambie cualquiera desde la pestaña Fotos del trabajo del panel Image." },
      { q: "¿Pondrá el nombre o la dirección del cliente en la publicación?", a: "No. El pie lleva su oficio y su ciudad, y el titular se escribe a partir del alcance de obra, no de la ficha del cliente." },
    ],
  },

  "social-posting-and-scheduling": {
    title: "Publicar en Facebook e Instagram, ahora o más tarde",
    summary:
      "Qué hacen el cuadro Publicar y el Calendario social —publicar ahora o programar un diseño aprobado en su página de Facebook e Instagram— y el estado honesto de hoy: la conexión espera la aprobación de Meta.",
    updated: "2026-09-12",
    intro: [
      "Un diseño aprobado en el Diseñador de marketing tiene un botón **Publicar**. Abre **Publicar en Instagram y Facebook**: elija las plataformas, la forma, revise el texto, y **Publicar ahora** o **Programar para más tarde**. Las publicaciones programadas aparecen en el **Calendario social**, donde una publicación se puede cancelar antes de salir.",
      "Lea esto primero: publicar necesita permisos que Meta debe conceder a la aplicación de FieldQuo, y esa revisión todavía no ha vuelto. **Configuración → Meta Ads → Publicación en Facebook e Instagram** dice **Esperando la aprobación de Meta**, y el cuadro Publicar dice **Todavía sin conectar**. La alternativa es un solo paso —descargue la publicación y súbala desde su propia cuenta— y la pantalla de aprobación se lo dice.",
    ],
    sections: [
      {
        id: "overview",
        heading: "Resumen",
        blocks: [
          { p: "Todo el recorrido está construido de punta a punta: la conexión de la página, el cuadro, el programador, el calendario y las reglas de reintento. Lo que falta es la aprobación de Meta de dos permisos —publicar en una página y publicar en Instagram—, así que ninguna empresa real puede conectar una página todavía. No falta nada de su parte, y no hay nada que preparar por adelantado." },
          { figure: "live:app-settings-meta-ads", caption: "Configuración → Meta Ads: la tarjeta Publicación en Facebook e Instagram está bajo la conexión de la cuenta publicitaria y dice qué está esperando." },
        ],
      },
      {
        id: "the-publish-dialog",
        heading: "Qué hace el cuadro Publicar",
        blocks: [
          { bullets: [
            "**Publicar en**: **Página de Facebook** e **Instagram**. Instagram solo se ofrece cuando hay una cuenta profesional de Instagram vinculada a la página conectada.",
            "**Forma**: **Cuadrada (1:1)** u **Horizontal (1.91:1)**, los dos recortes que Instagram acepta. Si un recorte no cumple las reglas de Instagram, el cuadro lo dice y pide el otro.",
            "**Texto**: las palabras aprobadas, de solo lectura aquí. Los límites de Instagram se aplican a ambas plataformas: 2.200 caracteres, 30 hashtags, 20 menciones.",
            "**Publicar ahora** publica de inmediato. **Programar para más tarde** muestra las ventanas: Facebook, de 10 minutos a 75 días de anticipación; Instagram, al menos 5 minutos de anticipación, y FieldQuo la retiene y la publica por usted en el momento justo. FieldQuo retiene una publicación hasta 180 días.",
          ] },
          { p: "Una publicación de Facebook programada dentro de la ventana de Facebook se entrega de inmediato al programador de Facebook. Cada publicación de Instagram —Instagram no tiene programador— la retiene FieldQuo y la envía una tarea que corre cada cinco minutos. Solo se pueden programar publicaciones de imagen; los Reels y el video no están soportados, y el calendario lo dice." },
        ],
      },
      {
        id: "the-calendar",
        heading: "El Calendario social",
        blocks: [
          { p: "**Calendario**, en el encabezado del editor, abre una cuadrícula mensual de cada publicación **Programada**, en publicación, **Publicada**, **Falló**, **Límite alcanzado** o **Cancelada**, archivada en la hora a la que debía salir. Elija un día para ver sus publicaciones, y **Cancelar** una programada que todavía no ha salido. Una publicación que Meta rechazó muestra el motivo; **Límite alcanzado** significa que la plataforma llegó al límite de publicación de Meta durante las próximas 24 horas." },
        ],
      },
      {
        id: "rules",
        heading: "Qué tiene que cumplirse antes de que salga una publicación",
        blocks: [
          { table: {
            head: ["Regla", "Por qué"],
            rows: [
              ["El diseño está **Aprobado**, y sin cambios desde entonces", "Una publicación lleva su nombre; el servidor recalcula la aprobación en cada publicación y rechaza una que quedó obsoleta."],
              ["El texto es el del diseño", "Un texto cambiado en el cuadro se rechaza en lugar de publicarse en silencio: guárdelo en el diseño y apruebe de nuevo."],
              ["Su empresa completó el pago de alta", "Publicar a nombre de la empresa es un acto hacia afuera, controlado igual que enviar un presupuesto."],
              ["Hay una página conectada", "Hoy, esperando a Meta; vea arriba."],
            ],
          } },
          { tip: "Mientras llega la aprobación: **Revisar y aprobar**, luego **Descargar todos los tamaños** y **Copiar el texto**, y publique usted mismo desde Facebook o Instagram. Lleva un minuto y no se pierde nada." },
        ],
      },
      {
        id: "who-can-see-it",
        heading: "Quién puede verlo",
        blocks: [
          { p: "Propietarios, administradores, gerentes y despachadores pueden aprobar, publicar, programar y cancelar. Conectar la página, cuando sea posible, se hace en Configuración → Meta Ads por un propietario o administrador, y esa única conexión alimenta también la bandeja de Mensajes; vea [[connect-your-facebook-page-and-instagram|Conectar su página de Facebook e Instagram]]." },
        ],
      },
    ],
    faq: [
      { q: "¿Puedo hacer algo para acelerar la aprobación de Meta?", a: "No. La revisión es de la aplicación de FieldQuo, no de su cuenta. La tarjeta de configuración dice «No falta nada de su parte.»" },
      { q: "¿FieldQuo puede crear el anuncio de pago por mí?", a: "No. Publicar un anuncio requiere otro permiso de Meta que FieldQuo no tiene. Descargue todos los tamaños y súbalos en Meta Ads Manager; el gasto del anuncio se sincroniza luego en Gasto en marketing." },
      { q: "¿Puedo programar un Reel o un video?", a: "Todavía no: solo publicaciones de imagen." },
    ],
  },

  "connect-meta-ads": {
    title: "Conectar su cuenta publicitaria de Meta",
    summary:
      "Vincule su propia cuenta publicitaria de Facebook e Instagram para que su gasto y los resultados de sus campañas entren en Gasto en marketing —de solo lectura, sincronizados cuando pulsa Sincronizar ahora— y vea qué más espera de Meta esa misma pantalla.",
    updated: "2026-09-12",
    intro: [
      "**Configuración → Cobros → Meta Ads** conecta la cuenta publicitaria de Meta de su propia empresa. En palabras de la pantalla: conecte su propia cuenta publicitaria de Meta (Facebook/Instagram) para traer el gasto y el rendimiento de las campañas a sus cifras de marketing. FieldQuo solo lee gasto y rendimiento; nunca crea ni cambia un anuncio.",
      "La misma pantalla tiene otras tres tarjetas de Meta: **Formularios de clientes potenciales de Facebook**, **Publicación en Facebook e Instagram** y **WhatsApp Business**. Cada una enuncia sus propias condiciones, y hoy cada una espera un permiso que Meta todavía no ha concedido a la aplicación de FieldQuo.",
    ],
    sections: [
      {
        id: "overview",
        heading: "Resumen",
        blocks: [
          { p: "La pantalla tiene cuatro estados honestos y nunca muestra un botón que no pueda funcionar. **Todavía sin configurar**: la instalación no tiene credenciales de la app de Meta. **Todavía no se puede guardar un token de forma segura**: falta un ajuste del servidor. **Sin conectar**: un botón real **Conectar Meta Ads**. **Conectada**: la tarjeta de la cuenta con **Sincronizar ahora**, **Desconectar** y, en cuanto algo se ha sincronizado, **Ver tus campañas →**." },
          { figure: "live:app-settings-meta-ads", caption: "Configuración → Meta Ads: la conexión de la cuenta publicitaria, y luego las tarjetas de formularios, publicación y WhatsApp." },
        ],
      },
      {
        id: "connect",
        heading: "Cómo conectar",
        blocks: [
          { steps: [
            "Abra **Configuración → Meta Ads** y pulse **Conectar Meta Ads**. Se le envía a Meta para iniciar sesión y dar su consentimiento.",
            "Si Meta devuelve más de una cuenta publicitaria para su acceso, la pantalla pregunta **¿Qué cuenta publicitaria?**: elija una y pulse **Conectar esta cuenta**.",
            "De vuelta en la pantalla, la tarjeta muestra el nombre, el identificador y la moneda de la cuenta con el chip **Conectada**, y «Todavía no se ha sincronizado nunca.» Pulse **Sincronizar ahora**.",
            "El resultado dice «12 filas nuevas, 3 actualizadas.» Abra **Marketing → Gasto en marketing** para verlas, origen **Desde Meta**.",
          ] },
          { note: "Cada **Sincronizar ahora** importa los últimos 30 días de resultados de campaña: el gasto por campaña y por día, y lo que Meta reportó junto a él. No hay sincronización automática: púlselo cuando quiera refrescar las cifras. La sincronización también avisa cuando hay filas que parecen gasto que ya registró a mano, para que no cuente ambas." },
        ],
      },
      {
        id: "what-each-control-does",
        heading: "Qué hace cada control",
        blocks: [
          { table: {
            head: ["Control", "Qué cambia"],
            rows: [
              ["**Sincronizar ahora**", "Importa los últimos 30 días en Gasto en marketing y actualiza la tabla de campañas. Las filas en otra moneda se convierten a un tipo fijado y se marcan ≈."],
              ["**Volver a conectar**", "Aparece cuando el chip dice **Hay que volver a conectarla**: Meta indica que el token guardado ya no es válido. La sincronización queda en pausa hasta que lo haga."],
              ["**Desconectar**", "Detiene la sincronización. Las filas ya importadas se quedan en su historial de gasto en marketing."],
              ["Los interruptores de **Formularios de clientes potenciales de Facebook**", "Se muestran por formulario con su número de clientes potenciales, pero desactivados: «Los formularios de clientes potenciales de Facebook necesitan que Meta apruebe un permiso más; todavía no se está recibiendo nada.» Vea [[facebook-lead-forms|Formularios de clientes potenciales de Facebook]]."],
              ["**Publicación en Facebook e Instagram**", "Dice **Esperando la aprobación de Meta**. Publicar desde el Diseñador depende de ello; vea [[social-posting-and-scheduling|Publicar en Facebook e Instagram, ahora o más tarde]]."],
              ["**WhatsApp Business**", "Dice **Esperando la aprobación de Meta**. Vea [[whatsapp-business|Mensajes de WhatsApp Business]]."],
            ],
          } },
        ],
      },
      {
        id: "who-can-see-it",
        heading: "Quién puede verlo",
        blocks: [
          { p: "Solo propietarios y administradores, el mismo estante que Pagos. Un gerente ve aquí un panel de acceso denegado, y cada ruta detrás de la pantalla también lo rechaza. Las cifras que produce la sincronización las ve cualquiera que pueda abrir Gasto en marketing." },
        ],
      },
    ],
    faq: [
      { q: "¿FieldQuo cambiará mis anuncios o mi presupuesto publicitario?", a: "No. El permiso que le pide a Meta es de solo lectura; la pantalla dice que nunca crea ni cambia un anuncio." },
      { q: "Mi cuenta publicitaria factura en USD y mi empresa está en CAD, ¿qué pasa?", a: "Las filas se convierten a un tipo de cambio fijado y cada cifra que tocan se marca ≈ aproximada, con la antigüedad del tipo al lado. Un tipo de más de 45 días se rechaza y el importe se nombra como excluido." },
      { q: "¿A dónde van los clientes potenciales de mis anuncios?", a: "En cuanto Meta apruebe el permiso de formularios, un cliente potencial de un formulario que active llega a Prospectos como cualquier otra solicitud. Hasta entonces los interruptores están desactivados y la tarjeta dice que no se recibe nada." },
    ],
  },

  "ask-for-reviews-automatically": {
    title: "Pedir reseñas automáticamente",
    summary:
      "Un correo breve, de su parte, a cada cliente cuando su trabajo se marca como completado —nunca dos veces, nunca a alguien que se dio de baja— con la demora que usted elige y un conteo en vivo de quién está en la cola.",
    updated: "2026-09-12",
    intro: [
      "Las reseñas son la mayor fuente de trabajo entrante de un contratista pequeño, y pedirlas es el paso que se salta. **Configuración → De cara al cliente → Reseñas** las pide por usted: cuando un trabajo se marca como completado, el cliente recibe un solo mensaje con su enlace de reseñas, tras una demora que usted fija. La pantalla no solo dice Activado: le dice cuántos clientes están en la cola ahora mismo y cuántos han sido contactados en los últimos 30 días.",
    ],
    sections: [
      {
        id: "overview",
        heading: "Resumen",
        blocks: [
          { p: "De arriba abajo: **Tu enlace de reseñas** con **Guardar**; el interruptor **Pedir automáticamente**; los chips de demora **Cuándo preguntar**; una frase como «3 clientes están en la cola, y 12 han sido contactados en los últimos 30 días.»; y una nota: «Se omite a los clientes que se han dado de baja, y cualquiera que responda diciendo que algo salió mal te contacta directamente en lugar de la página de reseñas.» Debajo, las reseñas que se muestran en su sitio web, la otra mitad de la pantalla, cubierta en [[testimonials-on-your-website|Testimonios en su sitio web]]." },
          { figure: "live:app-settings-reviews", caption: "Configuración → Reseñas: el enlace de reseñas, el interruptor Pedir automáticamente y las reseñas que se muestran en su sitio web." },
        ],
      },
      {
        id: "switch-it-on",
        heading: "Cómo activarlo",
        blocks: [
          { steps: [
            "Pegue su enlace de reseñas bajo **Tu enlace de reseñas** y pulse **Guardar**. La ayuda de abajo dice dónde conseguirlo: en su Perfil de Empresa de Google, elija «Solicitar reseñas» y copie el enlace corto. Sirve cualquier página http o https: Google, Facebook, HomeStars, su propio formulario. Use **Ábrelo y comprueba que lleva a donde esperas**.",
            "Active **Pedir automáticamente**. No se puede activar sin enlace —el interruptor dice «Primero agrega tu enlace de reseñas arriba.»— y el servidor también lo rechaza.",
            "Elija **Cuándo preguntar**: **2 horas después**, **4 horas después**, **Al día siguiente**, **Dos días después**, **Tres días después** o **Una semana después**. La frase de abajo se actualiza para mostrar la cola.",
          ] },
        ],
      },
      {
        id: "rules",
        heading: "Las reglas que sigue la solicitud",
        blocks: [
          { bullets: [
            "**Una vez, y nunca más.** Sobre un trabajo se pregunta como máximo una vez. El trabajo se marca antes de que salga el correo, así que una ejecución que se solapa o un doble clic nunca pueden preguntar dos veces.",
            "**Completado significa completado.** Solo un trabajo con estado completado y una hora de finalización. Los trabajos cancelados o reabiertos no se contactan.",
            "**El cliente necesita un correo**, y no haberse dado de baja: la misma lista que usan sus campañas de correo.",
            "**A tiempo.** FieldQuo revisa cada hora, así que una demora de 4 horas significa unas 4 horas, no la mañana siguiente.",
            "**Nada del pasado lejano.** Un trabajo terminado hace más de 30 días nunca se contacta, y los trabajos importados de su sistema anterior se omiten: activar esto hoy no escribe a todos los clientes que ha tenido.",
          ] },
          { p: "El correo en sí es corto a propósito: una frase de agradecimiento, un botón, su logotipo y su color, su nombre como remitente, las respuestas en su bandeja. Bajo el botón hay cinco enlaces pequeños de calificación, del 1 al 5: la puntuación del cliente llega a FieldQuo, y una respuesta de queja le llega a usted, no a la página de reseñas. Cada copia lleva un enlace de baja." },
        ],
      },
      {
        id: "who-can-see-it",
        heading: "Quién puede verlo",
        blocks: [
          { p: "Propietarios, administradores, gerentes y despachadores pueden abrir y cambiar esta pantalla. Lo que ocurre cuando un trabajo se marca como completado, incluida esta solicitud, está en [[when-a-job-is-completed|Cuando un trabajo se completa]]." },
        ],
      },
    ],
    faq: [
      { q: "¿También le manda un SMS al cliente?", a: "No. La solicitud de reseña es solo por correo." },
      { q: "¿Puedo pedirle una reseña a un cliente concreto a mano?", a: "No desde esta pantalla: es automática, y una vez por trabajo. Envíele usted mismo su enlace de reseñas desde la ficha del cliente." },
      { q: "¿Qué cuenta como «en la cola»?", a: "Los trabajos completados cuya demora todavía no se ha cumplido y que no han sido contactados, leídos de las mismas columnas que lee la tarea horaria." },
    ],
  },

  "refer-another-business": {
    title: "Recomendar otro negocio y ganar un mes gratis",
    summary:
      "Envíe a otro contratista su enlace o una invitación; él recibe un mes gratis al registrarse, y usted recibe uno añadido a su cuenta cuando se convierte en cliente de pago.",
    updated: "2026-09-12",
    intro: [
      "**Recomienda y gana** —una fila en la barra lateral y de nuevo bajo **Configuración → Cuenta**— es el programa de referidos de FieldQuo, un contratista que se lo cuenta a otro. Ambas partes reciben lo mismo: un mes de FieldQuo. El mes del recién llegado cae el día en que se registra; el suyo cae el día de su primer pago real. La pantalla separa las dos cosas a propósito, para que «recomendé a tres personas, ¿dónde están mis meses?» tenga una respuesta visible: **Registrado: aún no paga**.",
    ],
    sections: [
      {
        id: "overview",
        heading: "Resumen",
        blocks: [
          { p: "La página abre con «Recomienda a otro negocio y consigue otro mes de FieldQuo gratis, en cuanto sea cliente de pago.» Luego **Tu enlace** con **Copiar** —«Lo bastante corto para decirlo en voz alta. Ponlo en una tarjeta de presentación, al pie de una factura o en una camioneta.»—, un botón **WhatsApp**, **Enviar por SMS** en un teléfono, y **Enviar una invitación** por **Correo** o **SMS**. Debajo: cuántos meses gratis ha ganado, **Negocios que has referido** con una insignia **Acreditado** o **Registrado: aún no paga** en cada uno, e **Invitaciones enviadas**." },
          { figure: "live:app-settings-refer", caption: "Recomienda y gana: su enlace, los botones para compartir, el formulario de invitación y los negocios referidos hasta ahora." },
        ],
      },
      {
        id: "send-an-invite",
        heading: "Cómo enviar una invitación",
        blocks: [
          { steps: [
            "Abra **Recomienda y gana**.",
            "Para compartirlo usted mismo, pulse **Copiar** y pegue el enlace donde quiera, o **WhatsApp** / **Enviar por SMS** para abrir su propia app de mensajes con el mensaje listo y usted eligiendo a quién va.",
            "Para que lo envíe FieldQuo, elija **Correo** o **SMS** bajo **Enviar una invitación**, ingrese **Su correo** o **Su número de móvil**, si quiere **Su nombre**, y pulse **Enviar invitación**.",
            "La invitación aparece bajo **Invitaciones enviadas** con su canal y su fecha; cambia a **Registrado** cuando la persona se registra, o a **Fallido** si no se pudo entregar.",
          ] },
          { note: "FieldQuo envía un solo mensaje y no hace seguimiento. Hasta 20 invitaciones al día. A una persona que pidió a FieldQuo que no la contacte no se le envía ninguna, y la pantalla se lo dice." },
        ],
      },
      {
        id: "how-the-months-work",
        heading: "Cómo funcionan los meses gratis",
        blocks: [
          { table: {
            head: ["Quién", "Qué recibe", "Cuándo"],
            rows: [
              ["El negocio que usted recomendó", "Un mes extra de prueba gratis", "Al registrarse con su enlace o su invitación"],
              ["Usted", "Un mes gratis", "Cuando ese negocio hace su primer pago real, ha completado la configuración y tiene los pagos verificados: «Se añade automáticamente a tu cuenta cuando un negocio que referiste realiza su primer pago.»"],
            ],
          } },
          { p: "Su mes es un mes del producto, no una cifra en dólares: si todavía está en prueba, extiende el final de su prueba; si ya paga, mueve su próximo cobro un mes más tarde, tanto en planes mensuales como anuales. Nunca se acorta nada, y una segunda recomendación añade un segundo mes. La recompensa es la misma sin importar el tamaño del negocio que recomiende." },
          { p: "Los límites, todos contra el abuso: no puede recomendarse a sí mismo, una empresa que ya existe no puede canjear un enlace, y a un recomendante se le acreditan como máximo 50 referidos válidos por mes calendario." },
        ],
      },
      {
        id: "who-can-see-it",
        heading: "Quién puede verlo",
        blocks: [
          { p: "Solo propietarios y administradores. La página lista qué empresas fueron referidas y qué se ganó, y enviar una invitación es solo de propietarios y administradores en el servidor, así que la fila se oculta a los demás en lugar de mostrarse de solo lectura. Las recomendaciones de clientes —un propietario que le manda a un vecino— son otra cosa: [[referrals-from-clients|Recomendaciones de clientes]]." },
        ],
      },
    ],
    faq: [
      { q: "Se registraron pero todavía no tengo mi mes, ¿por qué?", a: "Su insignia dice Registrado: aún no paga. Su mes llega con su primer pago real, una vez completada su configuración y verificados sus pagos; una factura de prueba de $0 no genera nada." },
      { q: "¿De dónde sale la invitación?", a: "De FieldQuo: es FieldQuo invitando a un negocio en su nombre, no un mensaje a uno de sus clientes. Su nombre va en ella." },
      { q: "¿Hay un tope?", a: "20 invitaciones al día, y crédito por hasta 50 referidos válidos al mes." },
    ],
  },

  "instant-estimates-as-marketing": {
    title: "La estimación instantánea como imán de prospectos",
    summary:
      "Ponga un rango de precio real en su sitio web, su enlace de biografía y sus enlaces para compartir, y cada propietario que lo use se convierte en un cliente, un presupuesto borrador en su cola de revisión y un prospecto puntuado, sin que su tarifario se haga público nunca.",
    updated: "2026-09-12",
    intro: [
      "Un propietario que compara tres contratistas responde al que le da una cifra. **Configuración → De cara al cliente → Cotizaciones instantáneas** le permite conseguir una de usted en segundos —techo medido desde su dirección, o un área que traza en un mapa—, y cada estimación es un rango que puede solicitar y que llega a sus **Revisiones de presupuesto** antes de que nada sea vinculante. Este artículo trata de usarla como marketing: dónde ponerla, qué le da cada solicitud y qué controla usted.",
      "El tarifario que hay detrás nunca se publica. Un visitante ve un rango, o nada hasta que envía —usted elige—, y las tarifas por unidad se quedan en esta pantalla. Cómo se configura el precio en sí está en [[instant-quotes-on-your-website|Cotizaciones instantáneas en su sitio web]].",
    ],
    sections: [
      {
        id: "overview",
        heading: "Resumen",
        blocks: [
          { p: "La pantalla le dice qué está activo: «2 activos en tu enlace de estimación instantánea.» con **Ver lo que ven los propietarios**, o «Todavía no hay nada activo en tu enlace de estimación instantánea — activa un servicio abajo.» En cuanto algo está activo, una tarjeta **Pon la estimación instantánea en tu sitio web** ofrece el código para insertar con **Copiar código**. Luego una tarjeta por oficio: un interruptor **Activado** / **Desactivado**, **Lo que ve el propietario**, las tarifas, **Cargo mínimo**, **Amplitud del rango (±)**, **Rangos de presupuesto** y una nota opcional de **Financiamiento**." },
          { figure: "live:app-settings-instant-quotes", caption: "Configuración → Cotizaciones instantáneas: el conteo de activos, el código para insertar, y luego una tarjeta por oficio con su interruptor y sus tarifas." },
        ],
      },
      {
        id: "where-to-put-it",
        heading: "Dónde ponerla",
        blocks: [
          { bullets: [
            "**Su propia página**: cada empresa tiene su propio enlace de estimación instantánea, el que abre **Ver lo que ven los propietarios**. La página de cotización de su sitio web de FieldQuo lleva el formulario de autocotización, que es otra cosa; la estimación instantánea se comparte por su enlace o se inserta.",
            "**Cualquier otro sitio web**: pegue el código de **Copiar código** donde quiera. La nota de abajo dice por qué es seguro: un elemento HTML común que funciona en Wix, Squarespace, WordPress y HTML escrito a mano; el pequeño script solo ajusta el alto del recuadro, y sin él el recuadro funciona con un alto fijo.",
            "**Su enlace de biografía**: cuando un oficio está activado, la estimación instantánea es el primer enlace que se ofrece, antes de reservar una visita y de pedir un presupuesto.",
            "**Comparte tus enlaces**: la tarjeta **Estimación instantánea** tiene ahí el enlace, **Copiar enlace** y **Abrir**, para un SMS, una firma de correo o un volante. Vea [[share-your-links|Comparte tus enlaces]].",
          ] },
        ],
      },
      {
        id: "what-a-request-gives-you",
        heading: "Qué le da cada solicitud",
        blocks: [
          { steps: [
            "Una ficha de **cliente** con el nombre, los datos de contacto y la dirección que ingresó el propietario.",
            "Un **presupuesto borrador**, calculado con sus tarifas, marcado **Requiere revisión** en la lista de Cotizaciones y en espera en **Revisiones de presupuesto**: nada se puede enviar hasta que alguien confirme el precio. Vea [[estimate-reviews|Revisiones de presupuesto: aprobar estimaciones instantáneas]].",
            "Un **prospecto** en el tablero de Prospectos, con origen estimación instantánea, puntuado como cualquier otro, con el rango de presupuesto que eligió el propietario y las fotos que adjuntó. Vea [[lead-scoring-hot-warm-cold|Puntuación de prospectos: caliente, tibio, frío]].",
            "Un correo al propietario confirmando su estimación, con su marca.",
          ] },
        ],
      },
      {
        id: "what-you-control",
        heading: "Qué controla usted",
        blocks: [
          { table: {
            head: ["Ajuste", "Qué cambia"],
            rows: [
              ["**Activado** / **Desactivado**", "Si el oficio se ofrece o no. Guardar con **Guardar y activar** es lo que lo pone en línea; nada queda activo con cifras que nadie eligió."],
              ["**Lo que ve el propietario**", "**No mostrar un precio**: envía y se le dice que la cotización está en camino. **Mostrar un rango estimado**: la cifra aparece antes de que deje sus datos; espere que algunos la lean y se vayan. **Mostrar el rango después de enviar**: rellena el formulario para desbloquear su rango; usted obtiene sus datos de todos modos, la opción habitual."],
              ["**Amplitud del rango (±)** y **Cargo mínimo**", "Qué tan ancho es el rango alrededor de la cifra calculada, y el piso por debajo del cual nunca baja."],
              ["**Rangos de presupuesto**", "Las cuatro opciones que se muestran cuando se le pregunta al propietario su presupuesto; el rango que elige puntúa el prospecto."],
              ["**Financiamiento**", "Opcional, con sus palabras. FieldQuo no ofrece financiamiento; si indica su propia tasa y plazo, la estimación también muestra una cuota mensual con esas condiciones."],
            ],
          } },
          { warning: "La pantalla también señala una discrepancia —un oficio que cotiza al instante y no está en su pantalla de Servicios, o un servicio sin precio instantáneo— y no cambia nada por su cuenta. Léala antes de compartir el enlace." },
        ],
      },
      {
        id: "who-can-see-it",
        heading: "Quién puede verlo",
        blocks: [
          { p: "Cualquiera cuyo acceso incluya ver precios: propietarios, administradores, gerentes, despachadores y estimadores. La cuadrilla no ve esta pantalla, porque es un tarifario." },
        ],
      },
    ],
    faq: [
      { q: "¿Un competidor verá mis tarifas?", a: "No. La página pública nunca devuelve una tarifa; devuelve un rango para un trabajo concreto, o nada hasta que el propietario envía, según Lo que ve el propietario." },
      { q: "¿El propietario puede aceptar la estimación de inmediato?", a: "No. Es un borrador que espera en Revisiones de presupuesto; usted confirma el precio, ajustándolo si la propiedad lo requiere, y luego envía el presupuesto." },
      { q: "¿La estimación instantánea cuenta como prospecto en mis cifras de marketing?", a: "Sí: crea un prospecto en el tablero, y ese prospecto cuenta en el costo combinado por prospecto de Gasto en marketing." },
    ],
  },
};
