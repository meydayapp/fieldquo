// content/help/es/marketing-and-website-1.js
//
// Parte 1 de la categoría «marketing-and-website» en español (ver el
// compositor, marketing-and-website.js). Slugs de esta parte
// (lib/help/tree.js): the-website-builder, website-pages-and-blocks,
// your-website-address, the-site-by-fieldquo-footer, share-your-links,
// embed-booking-and-quote-forms, the-bio-link, funnels, build-a-funnel,
// marketing-campaigns.
//
// Misma estructura que el inglés (secciones, bloques, figuras, listas, FAQ);
// los hechos salen del mismo código y las palabras en pantalla del bloque
// `es` de app/i18n/appMessages.js. Las fichas de diseño y estilo, las
// preguntas del asistente del sitio y la barra del editor de embudos se
// muestran en inglés en todas las pantallas: el artículo las cita tal cual.
export const ARTICLES = {
  "the-website-builder": {
    title: "El creador de sitios web",
    summary:
      "Describa cómo quiere que se sienta su sitio y FieldQuo lo redacta a partir de los datos que ya ingresó — luego Guardar, Publicar, y cambiarlo escribiendo de nuevo.",
    updated: "2026-09-12",
    intro: [
      "**Configuración → Tu sitio web** construye un sitio web real para su empresa, en su propia dirección. No llena un formulario: escribe una frase sobre cómo debería verse y sentirse el sitio, y el creador redacta las páginas con lo que FieldQuo ya sabe — su nombre, logo, color de marca, servicios, horario, datos de contacto, fotos de trabajos y reseñas aprobadas. Nada es público hasta que presiona **Publicar**.",
      "Este artículo cubre toda la pantalla: la instrucción del primer uso, la conversación, las fichas Diseño y Estilo, Ajustar, los paneles Vista previa y Secciones, y qué hacen Guardar, Publicar y Actualizar.",
    ],
    sections: [
      {
        id: "overview",
        heading: "Resumen",
        blocks: [
          { p: "El creador es una conversación. A la izquierda usted dice qué cambiar («hazlo más atrevido», «empieza con reseñas», «página más corta»); a la derecha ve el sitio exactamente como lo verá un visitante, porque la vista previa es la página real, no una imagen de ella. El asistente de redacción escribe solo frases. La lista de secciones, los nombres de los servicios y los testimonios salen de sus propios datos y se vuelven a insertar después de cada reconstrucción, así que el sitio nunca puede describir un oficio que usted no ofrece ni citar una reseña que nadie dejó." },
          { p: "Si el asistente de redacción no está disponible, el creador produce igual una página — redactada de forma sencilla con sus datos guardados — y lo dice en el hilo. Obtiene palabras más planas, nunca un sitio roto." },
        ],
      },
      {
        id: "on-the-screen",
        heading: "Qué hay en la pantalla",
        blocks: [
          { bullets: [
            "**Primer uso** — una sola caja bajo **¿Qué debería decir tu sitio web?**, cuatro fichas de ejemplo que puede tocar para llenarla, una flecha **Crear mi sitio**, y la línea **Nada es público hasta que lo publiques.**",
            "**La barra** — su dirección (**sunombre.fieldquo.com**), una etiqueta **En vivo** una vez publicado, **Abrir**, **Guardar**, y **Publicar** (que pasa a ser **Actualizar** cuando el sitio está en vivo).",
            "**El hilo** — lo que pidió y lo que se construyó. Cuando falta algo, el asistente lo dice con una acción de un toque, mostrada en inglés: **Add photos**, **Pair them up**, **Add a logo**, **Add a review**, **Set hours**, **Choose services**.",
            "Las fichas **Diseño** y **Estilo**, la caja de instrucción (**Hazlo más atrevido · empieza con reseñas · página más corta…**), y el panel **Ajustar** con **Dirección web**, **Idiomas**, **Pares de antes y después** y el código para incrustar las reseñas.",
            "**Vista previa | Secciones** — el sitio en vivo con un selector escritorio / móvil y un botón de actualizar, o las secciones de la página de inicio como campos de texto que puede reescribir a mano.",
          ] },
        ],
      },
      {
        id: "build-your-first-site",
        heading: "Cómo crear su primer sitio",
        blocks: [
          { steps: [
            "Abra **Configuración → Tu sitio web**, en el grupo De cara al cliente del menú de configuración.",
            "Describa la sensación en una o dos frases — el tono, con qué empezar, si la gente debería poder reservar en línea — o toque una ficha de ejemplo. No necesita escribir su nombre, su teléfono ni sus servicios.",
            "Presione la flecha (**Crear mi sitio**). El hilo informa qué se construyó («Sitio reconstruido: … secciones») y la vista previa carga el borrador guardado.",
            "Responda a lo que el asistente pide: agregue fotos de trabajos, empareje fotos de antes y después, agregue un logo en Marca, apruebe una reseña en Reseñas. Cada cosa hace posible una sección que antes se había omitido.",
            "Presione **Publicar**. El sitio queda en vivo en su dirección; la barra muestra **En vivo**.",
          ] },
          { figure: "live:app-settings-website", caption: "Configuración → Tu sitio web en el primer uso — una instrucción, cuatro fichas de ejemplo y «Nada es público hasta que lo publiques.»" },
          { note: "Una construcción lanzada con una instrucción consume la asignación mensual de IA de su plan; si se agotó, el botón lo dice en lugar de construir. Elegir una ficha **Diseño** o **Estilo** no llama a ningún modelo y nunca se bloquea." },
        ],
      },
      {
        id: "what-each-control-changes",
        heading: "Qué cambia cada control",
        blocks: [
          { table: {
            head: ["Control", "Qué ocurre"],
            rows: [
              ["Escribir en la caja de instrucción y enviar", "Reescribe cada encabezado y cada párrafo de cada página según lo que pidió. Las fotos, los pares de antes y después, el logo y los colores se conservan. El resultado se guarda de inmediato, así que la vista previa siempre lo muestra."],
              ["Una ficha **Diseño** — una de las cinco formas de la página, con las palabras de la pantalla (Show the work first, Lead with services, Lead with reputation, Lead with booking, Short one-pager)", "Reorganiza el mismo sitio en esa forma. Sus textos y fotos se conservan; no se usa IA."],
              ["Una ficha **Estilo** (Modern, Bold, Minimal, Classic, Warm, Editorial y más)", "Cambia la tipografía, los espacios y la forma de aplicar su color de marca. Textos y fotos se conservan."],
              ["El panel **Secciones**", "Reescriba a mano cualquier encabezado o párrafo de la página de inicio, elija la variante de diseño de una sección, agregue o quite una foto, **Ocultar** o **Mostrar** una sección. Su logo, colores, servicios, horario y datos de contacto no se editan aquí — cámbielos en la configuración de la empresa y el sitio se actualiza."],
              ["**Guardar**", "Guarda el borrador. Una vez que el sitio está en vivo no hay un borrador aparte: un cambio guardado es lo que ven los visitantes."],
              ["**Publicar** / **Actualizar**", "Hace público el sitio en su dirección, o lo reconfirma. Requiere una empresa que haya terminado de contratar un plan."],
              ["**Idiomas** (bajo Ajustar)", "Agregar un idioma escribe todo el sitio en ese idioma — no es una traducción automática — y da a los visitantes un selector en el encabezado. Su idioma principal está marcado y no se puede quitar."],
            ],
          } },
          { figure: "harness:settings-website", caption: "El creador con un sitio en vivo — la barra de dirección con En vivo, Abrir, Guardar y Actualizar; el hilo; las fichas Diseño y Estilo; la instrucción; Vista previa y Secciones a la derecha." },
          { warning: "Si reescribió secciones a mano y luego escribe una nueva instrucción, el creador se detiene y pregunta: **Esto reescribirá las palabras que editaste**. Elija **Conservar lo que escribí** o **Reconstruir de todos modos**. Las fotos y los pares sobreviven en ambos casos; los encabezados y párrafos escritos a mano, no." },
        ],
      },
      {
        id: "publishing",
        heading: "Publicar, las fotos de stock y retirar el sitio",
        blocks: [
          { p: "Mientras no tenga fotos, el creador usa fotografía de stock para que la página no quede vacía — solo como fondo del encabezado y en lugares parecidos, nunca en **Our work**, porque esa sección afirma que las fotos son trabajos que usted hizo. Publicar con fotos de stock todavía en la página está permitido, pero nunca en silencio: un cuadro las cuenta y ofrece **Agregar mis fotos** o **Publicar de todos modos**." },
          { p: "Hoy no hay un botón para despublicar en esta pantalla. Una vez que el sitio está en vivo, sigue en vivo; puede ocultar secciones o reescribirlas, y la dirección sigue respondiendo. FieldQuo no retira un sitio publicado desde el creador." },
        ],
      },
      {
        id: "what-is-different",
        heading: "Qué hace este creador que una plantilla de sitio no hace",
        blocks: [
          { bullets: [
            "Se redacta a partir de lo que usted ya le dijo a FieldQuo — servicios, horario, reseñas, fotos de trabajos — y se mantiene al día con ellos: cambie su número de teléfono en **Configuración de la empresa** y el sitio cambia.",
            "El calendario de reservas, el formulario de solicitud de presupuesto y la estimación instantánea son secciones del sitio, no enlaces a otro producto. Un visitante reserva un horario real según su disponibilidad y la solicitud llega a su tablero de **Prospectos**.",
            "Los diseños son un conjunto cerrado, diseñado y verificado en un teléfono. El asistente elige entre ellos; nunca emite una regla de estilo, así que una reconstrucción no puede producir una página rota en móvil o ilegible sobre su color de marca.",
            "Está incluido en todos los planes, y el sitio de una empresa que paga no lleva el nombre de FieldQuo en ninguna parte — vea [[the-site-by-fieldquo-footer|El pie de página «Sitio por FieldQuo»]].",
          ] },
        ],
      },
      {
        id: "who-can-see-it",
        heading: "Quién puede verlo",
        blocks: [
          { p: "La pantalla y sus guardados están abiertos a propietarios, administradores, despachadores y gerentes. Los estimadores y la cuadrilla no ven la fila, y la página los rechaza. Agregar o quitar un idioma del sitio es solo para el propietario y los administradores. Publicar también requiere una empresa que haya terminado el pago — una prueba que nunca agregó una tarjeta puede construir el sitio, pero no ponerlo frente al público." },
        ],
      },
    ],
    faq: [
      { q: "¿Una reconstrucción borrará mis fotos?", a: "No. Una reconstrucción reescribe solo palabras; las fotos de trabajos, los pares de antes y después, su logo y sus colores se conservan cada vez. Solo el texto que escribió a mano en el panel Secciones se reemplaza, y el creador pregunta primero." },
      { q: "¿Puedo editar el sitio sin la IA?", a: "Sí. Las fichas Diseño y Estilo y el panel Secciones no usan ningún modelo, y funcionan incluso cuando el asistente de redacción no está disponible o su asignación mensual se agotó." },
      { q: "¿La vista previa muestra lo que ven los visitantes?", a: "Exactamente eso — la vista previa es la página real, mostrada con un indicador de vista previa que solo un miembro conectado de su empresa puede usar. Un desconocido que adivine la dirección de un sitio no publicado obtiene una página de no encontrado." },
      { q: "¿El sitio se traduce automáticamente?", a: "No. Agregar un idioma bajo Ajustar escribe una versión completa del sitio en ese idioma y añade un selector; nada se traduce por máquina al mostrarlo. Hay ocho idiomas disponibles: inglés, francés, español, ucraniano, panyabí, tagalo, alemán e italiano." },
    ],
  },

  "website-pages-and-blocks": {
    title: "Páginas y secciones del sitio web",
    summary:
      "Las páginas que puede tener un sitio FieldQuo, los quince tipos de sección que las componen, cuáles puede reescribir a mano y cuáles salen del registro de su empresa.",
    updated: "2026-09-12",
    intro: [
      "Un sitio FieldQuo es una lista de páginas, y cada página es una lista de secciones (bloques). El creador decide, según sus datos, qué páginas y qué secciones recibe su sitio; usted puede reescribir a mano las secciones de la página de inicio, ocultar las que no quiera y elegir otro diseño para cualquiera de ellas. Este artículo nombra cada página y cada bloque para que sepa qué es posible antes de pedirlo.",
    ],
    sections: [
      {
        id: "overview",
        heading: "Resumen",
        blocks: [
          { p: "Todo sitio construido por el creador actual tiene varias páginas: una página **Home** más las páginas que el catálogo permite, cada una con sus propias secciones y su lugar en el menú del encabezado. Una sección es **redactada** (un encabezado y un párrafo que el asistente escribió y usted puede editar) o **derivada** (se muestra a partir del registro de su empresa — el calendario de reservas, el formulario de presupuesto, el horario, las zonas atendidas — y no se edita como texto). Una sección para la que el sitio no tiene datos se omite en lugar de rellenarse: un encabezado de galería sin fotos, o una franja de testimonios sin una reseña aprobada, nunca se publica." },
        ],
      },
      {
        id: "the-pages",
        heading: "Las páginas",
        blocks: [
          { table: {
            head: ["Página", "En el menú", "Secciones predeterminadas"],
            rows: [
              ["Home", "Home", "Header, What we do, Before & after, Call to action band, Get in touch — el encabezado, lo que hacemos, el antes y después, la franja de llamada a la acción y el contacto"],
              ["Services", "Services", "Header, What we do, How it works, FAQ, Call to action band — el encabezado, lo que hacemos, cómo trabajamos, la FAQ y la franja de llamada a la acción"],
              ["Work", "Our Work", "Header, Our work, Before & after, What clients say, Call to action band — el encabezado, nuestros trabajos, el antes y después, los testimonios y la franja de llamada a la acción"],
              ["About", "About", "Header, About us, Credentials & numbers, Areas we serve, Call to action band — el encabezado, sobre nosotros, las credenciales y cifras, las zonas atendidas y la franja de llamada a la acción"],
              ["Book", "Book", "Header, Book a visit (calendar), Opening hours — el encabezado, el calendario de reservas y el horario"],
              ["Quote", "Get a quote", "Header, Request a quote (form) — el encabezado y el formulario de solicitud de presupuesto"],
              ["Contact", "Contact", "Header, Get in touch, Opening hours, Areas we serve — el encabezado, el contacto, el horario y las zonas atendidas"],
            ],
          } },
          { p: "Home siempre va primero y siempre está en el menú. Una página cuyas secciones no tienen nada que mostrar — una FAQ sin preguntas, una galería sin fotos — sale del menú por sí sola. El panel de vista previa muestra una pestaña por página para revisar cada una antes de publicar. Los nombres de páginas y secciones del catálogo aparecen en inglés en el editor; el sitio publicado, en cambio, está en el idioma de su empresa." },
        ],
      },
      {
        id: "the-sections",
        heading: "Los quince tipos de sección",
        blocks: [
          { table: {
            head: ["Sección", "Qué puede editar", "De dónde sale el resto"],
            rows: [
              ["Header", "Titular, subtítulo, texto del botón; siete variantes de diseño", "Siempre primero; no se puede ocultar"],
              ["What we do", "Encabezado, introducción", "Sus servicios activados"],
              ["About us", "Encabezado, texto", "—"],
              ["Our work", "Encabezado, introducción; agregar o quitar fotos", "Las fotos recientes de trabajos"],
              ["What clients say", "Encabezado", "Los testimonios aprobados en Configuración → Reseñas"],
              ["FAQ", "Encabezado; las preguntas y respuestas", "—"],
              ["Request a quote (form)", "Encabezado, introducción", "El formulario de autopresupuesto para sus servicios activados"],
              ["Book a visit (calendar)", "Encabezado, introducción", "Su página de reservas y su disponibilidad real"],
              ["Opening hours", "Encabezado, nota", "El horario de la empresa"],
              ["Get in touch", "Encabezado, introducción", "Teléfono, correo y dirección de Configuración de la empresa"],
              ["Before & after", "Encabezado, introducción; los pares", "Los pares confirmados bajo Ajustar"],
              ["How it works", "Encabezado, introducción; los pasos", "—"],
              ["Areas we serve", "Encabezado, introducción", "Sus zonas de trabajo"],
              ["Credentials & numbers", "Encabezado, introducción; los elementos", "—"],
              ["Call to action band", "Encabezado, subtítulo, texto del botón", "—"],
            ],
          } },
        ],
      },
      {
        id: "edit-a-section",
        heading: "Cómo reescribir u ocultar una sección",
        blocks: [
          { steps: [
            "Abra **Configuración → Tu sitio web** y cambie el panel derecho de **Vista previa** a **Secciones**.",
            "Ubique la sección por su nombre (los de la tabla de arriba) y escriba en sus campos. Encabezados, párrafos y elementos de lista son texto plano; las fichas bajo el nombre cambian la variante.",
            "Presione **Ocultar** en una sección que no quiera; **Mostrar** la devuelve. El encabezado no se puede ocultar.",
            "Presione **Guardar**. La vista previa se recarga con sus palabras.",
          ] },
          { figure: "harness:settings-website", caption: "El creador — el selector Vista previa | Secciones en la parte superior del panel derecho abre el editor de secciones." },
          { note: "El panel Secciones edita la página **Home**. Las demás páginas las reescribe el asistente cuando usted escribe una instrucción, y se reorganizan cuando elige una ficha Diseño." },
        ],
      },
      {
        id: "layouts-and-styles",
        heading: "Diseños, estilos y variantes",
        blocks: [
          { p: "Tres cosas deciden cómo se ve una página, y las tres son conjuntos cerrados diseñados y verificados en un teléfono — el asistente elige entre ellos y nunca escribe una regla de estilo propia." },
          { bullets: [
            "**Diseño** — el orden y la elección de las secciones: Show the work first, Lead with services, Lead with reputation, Lead with booking, Short one-pager. Un diseño que necesita un dato que usted no tiene (una reseña, una foto) se ofrece cuando lo tenga.",
            "**Estilo** — tipografía, espacios y tratamiento del color: Modern, Bold, Minimal, Classic, Warm, Editorial, Technical, Couture, Gallery, Playful, Noir, Future, Monument. Cada par texto-fondo se mide contra su color de marca, nunca se supone.",
            "**Variante** — la disposición de una sola sección. Solo el encabezado tiene siete (centered, split, banner, overlay, side by side, minimal, editorial); una variante que necesita una foto solo se usa cuando la hay.",
          ] },
          { p: "Las etiquetas de las fichas y de las variantes se muestran en inglés en la pantalla de todos los idiomas." },
        ],
      },
      {
        id: "photos",
        heading: "Las fotos",
        blocks: [
          { p: "Las fotos de trabajos llegan al sitio por dos caminos: las que su cuadrilla adjunta a los trabajos, y las que usted sube desde la acción **Add photos** del creador. Bajo **Ajustar → Pares de antes y después** empareja una foto de antes con su foto de después; solo los pares confirmados aparecen en la sección Before & after. La fotografía de stock se usa solo como fondo del encabezado y en lugares parecidos mientras no tenga fotos, nunca en Our work." },
          { tip: "Un solo par de antes y después contundente en la página de inicio rinde más que una galería de doce fotos. Pídale al asistente que «empiece con nuestras fotos de antes y después» una vez confirmado el par." },
        ],
      },
    ],
    faq: [
      { q: "¿Puedo agregar una página que el catálogo no tiene?", a: "Hoy no. Las siete páginas de arriba son todo el catálogo; una página que un contratista no puede llenar es peor que ninguna página. Dentro de ellas puede ocultar secciones y renombrar encabezados libremente." },
      { q: "¿Por qué falta una sección después de una reconstrucción?", a: "Porque no había nada que poner en ella. El hilo lo dice («Se omitió …: motivo»). Agregue el dato — una reseña, una foto, un horario — y reconstruya, o elija un diseño que no lo necesite." },
      { q: "¿Puedo cambiar los servicios o el horario que muestra el sitio?", a: "No en el creador — se leen en vivo desde Configuración → Servicios y precios y Configuración de la empresa. Cámbielos ahí y el sitio los sigue." },
    ],
  },

  "your-website-address": {
    title: "La dirección de su sitio web: subdominio y dominio propio",
    summary:
      "Cómo se elige la dirección de su sitio FieldQuo, las reglas que debe cumplir un nombre, qué nombres están reservados y por qué un dominio propio todavía no es compatible.",
    updated: "2026-09-12",
    intro: [
      "Su sitio vive en un subdominio de fieldquo.com — **sunombre.fieldquo.com** — que se muestra en la barra superior del creador y se edita bajo **Ajustar → Dirección web**. FieldQuo sugiere uno a partir del nombre de su empresa en el primer guardado; puede cambiarlo cuando quiera. Los dominios propios (su .com apuntando al sitio) no son compatibles hoy; este artículo lo dice claramente para que no busque el ajuste.",
    ],
    sections: [
      {
        id: "overview",
        heading: "Resumen",
        blocks: [
          { p: "La dirección es una sola palabra: letras minúsculas, dígitos y guiones. Es lo que un visitante escribe, y adonde apunta el enlace para la bio una vez publicado el sitio. Cambiarla es inmediato: la nueva dirección responde en cuanto guarda, y la antigua deja de hacerlo — nada redirige una dirección antigua a una nueva." },
        ],
      },
      {
        id: "choose-or-change",
        heading: "Cómo elegirla o cambiarla",
        blocks: [
          { steps: [
            "Abra **Configuración → Tu sitio web** y presione **Ajustar** bajo la caja de instrucción.",
            "Escriba la palabra que quiera bajo **Dirección web**. El sufijo siempre es fieldquo.com.",
            "Presione **Guardar**. Si el nombre está tomado, reservado o mal formado, el guardado se rechaza con una frase que nombra el problema — corrija la palabra y guarde de nuevo.",
          ] },
          { figure: "harness:settings-website", caption: "La dirección en la barra superior del creador; el campo que la cambia está bajo Ajustar, debajo de la caja de instrucción." },
        ],
      },
      {
        id: "the-rules",
        heading: "Las reglas que debe cumplir un nombre",
        blocks: [
          { bullets: [
            "Al menos **3** caracteres y como máximo **63** — el límite absoluto de una etiqueta de dirección web, no una decisión del producto.",
            "Solo letras minúsculas, números y guiones simples. Sin espacios, sin acentos, sin puntos.",
            "No puede empezar ni terminar con guion, ni contener dos guiones seguidos.",
            "No debe pertenecer ya a otra empresa — el guardado dice que la dirección ya está tomada y que pruebe otra.",
            "No debe estar en la lista de nombres reservados de abajo.",
          ] },
        ],
      },
      {
        id: "reserved-names",
        heading: "Nombres reservados",
        blocks: [
          { p: "Algunos nombres se rechazan aunque parezcan libres: **www**, **app**, **api**, **admin**, **platform**, **sales**, **help**, **book**, **quote**, **portal**, **refer**, **site**, **mail**, **support**, **docs**, **status**, **blog**, **shop**, **pay**, **billing**, **login**, **signup**, **account**, **dashboard**, **demo**, **fieldquo**, **official**, **security** y unas cuantas decenas más del mismo tipo." },
          { note: "Es un límite de seguridad, no una preferencia de nombres. Las cookies de inicio de sesión se comparten entre todos los subdominios de fieldquo.com, así que una empresa dueña de **app.fieldquo.com** podría leer las sesiones de las demás. La lista prefiere rechazar; un rechazo le cuesta diez segundos y otra palabra." },
        ],
      },
      {
        id: "custom-domains",
        heading: "Dominios propios",
        blocks: [
          { p: "FieldQuo no permite apuntar su propio dominio a su sitio FieldQuo, y no hay ningún campo para eso. «Solo subdominios» es una decisión de alcance deliberada, no un olvido. Si ya tiene un dominio con un sitio web, conserve ese sitio y ponga en él los widgets de reservas, presupuesto y reseñas de FieldQuo — vea [[embed-booking-and-quote-forms|Incrustar los formularios de reservas y de presupuesto en cualquier sitio]] — o ponga su dirección FieldQuo en el enlace para la bio y en su ficha de Google." },
        ],
      },
    ],
    faq: [
      { q: "¿Puedo tener dos direcciones para un mismo sitio?", a: "No. Una empresa tiene un solo subdominio; cambiarlo reemplaza el anterior." },
      { q: "¿Google encontrará mi sitio?", a: "Un sitio publicado es indexable y lleva el título y la descripción que redactó el asistente. Un sitio no publicado, las páginas incrustadas y los embudos están marcados para no indexarse, a propósito." },
      { q: "El nombre de mi empresa da una palabra reservada o inválida, ¿y ahora?", a: "FieldQuo ya recurrió a una sugerencia utilizable (a menudo su nombre con un sufijo como -site). Escriba cualquier palabra que cumpla las reglas; no tiene que coincidir con su razón social." },
    ],
  },

  "the-site-by-fieldquo-footer": {
    title: "El pie de página «Sitio por FieldQuo»",
    summary:
      "El único lugar donde se permite el nombre de FieldQuo en una página de cara al cliente: una pequeña línea en el pie de página del sitio web mientras una empresa no paga, y cómo desaparece.",
    updated: "2026-09-12",
    intro: [
      "FieldQuo es marca blanca por defecto. Presupuestos, facturas, correos, la página de reservas, los embudos y el portal del cliente llevan su nombre, su logo y su color, nunca los nuestros. El sitio web tiene una única excepción autorizada: mientras su empresa no esté en un plan de pago, el pie de página de su sitio lleva una pequeña línea — **Sitio por FieldQuo** — bajo su aviso de derechos de autor. Este artículo dice exactamente cuándo se muestra y cuándo no.",
    ],
    sections: [
      {
        id: "overview",
        heading: "Resumen",
        blocks: [
          { p: "La línea es el precio de un sitio web gratuito. Es una línea discreta en el pie de página, junto a **© año Su empresa**, que enlaza a fieldquo.com. Nada más en la página menciona a FieldQuo — ni el título, ni los formularios, ni el calendario de reservas. Un contratista que paga recibe un pie de página con su propio nombre y sus derechos de autor sin rastro de los nuestros, para que un propietario que compara tres presupuestos no pueda saber qué contratistas comparten el software." },
        ],
      },
      {
        id: "when-it-shows",
        heading: "Cuándo se muestra",
        blocks: [
          { table: {
            head: ["Su situación", "Línea en el pie de página"],
            rows: [
              ["Plan de pago, al día", "Sin línea"],
              ["Primer mes gratis en un plan de pago, con tarjeta registrada", "Sin línea — el mes que dijimos que era gratis es gratis"],
              ["Un pago falló, dentro del período de gracia", "Sin línea — esos días son para arreglar la tarjeta, no para cambiarle la marca a su sitio"],
              ["Período de gracia vencido, o suscripción cancelada y terminada", "La línea se muestra"],
              ["Sin suscripción, o un plan con precio cero", "La línea se muestra"],
            ],
          } },
          { p: "La decisión se toma en cada visita a la página a partir de su suscripción, así que cambia en el momento en que cambia su situación: pague, y la línea desaparece en la siguiente carga; deje de pagar, y vuelve." },
        ],
      },
      {
        id: "where-else",
        heading: "Dónde más aparece el nombre de FieldQuo",
        blocks: [
          { p: "La página del enlace para la bio lleva una pequeña línea **Made by FieldQuo** junto a sus derechos de autor en todos los planes — decisión del propietario, porque una página de enlace en la bio es un menú y no un documento, y todo menú de ese tipo lleva el nombre de quien lo hizo. Todo lo que está por encima de ese pie de página es solo suyo. Ningún presupuesto, factura, correo, página de reservas, estimación instantánea, embudo o portal del cliente lleva el nombre de FieldQuo; el título de pestaña de un widget incrustado muestra el nombre de su empresa." },
        ],
      },
      {
        id: "how-to-remove-it",
        heading: "Cómo quitarla",
        blocks: [
          { steps: [
            "Abra **Cuenta y facturación** (propietarios y administradores) y elija un plan — vea [[your-plan-and-seats|Su plan y sus puestos]].",
            "Termine el pago con una tarjeta. Desde ese momento el sitio se muestra sin la línea, incluso durante el primer mes gratis.",
            "Mantenga la tarjeta vigente. Si un pago falla, tiene el período de gracia antes de que la línea vuelva — vea [[failed-payments-and-the-grace-period|Pagos fallidos y el período de gracia]].",
          ] },
          { note: "Cancelar muestra la misma regla al revés: el proceso de cancelación le avisa que el sitio y la página de reservas siguen en vivo, y que la pequeña línea vuelve al pie de página cuando la cuenta se cierra." },
        ],
      },
    ],
    faq: [
      { q: "¿Puedo pagar para quitar la línea y mantener todo lo demás gratis?", a: "No hay un cobro aparte por eso. Cualquier plan de pago quita la línea; no existe un plan gratuito con un complemento de pago «sin pie de página»." },
      { q: "¿La línea aparece en mis presupuestos o facturas?", a: "Nunca. Existe solo en el pie de página del sitio web, y solo mientras la empresa no paga." },
    ],
  },

  "share-your-links": {
    title: "Comparte tus enlaces",
    summary:
      "Una sola pantalla con todos los enlaces públicos de su empresa — Solicitar una cotización, Reservar una visita, Estimación instantánea y cada embudo publicado — cada uno con Copiar enlace, Abrir y un código para incrustar.",
    updated: "2026-09-12",
    intro: [
      "**Configuración → Comparte tus enlaces** responde una sola pregunta: ¿qué puedo poner en mi página de Facebook, mi ficha de Google, mi firma de correo o el costado de la camioneta? Lista los enlaces que un desconocido puede usar para convertirse en prospecto, cada uno con un botón **Copiar enlace**, un botón **Abrir** para probarlo usted mismo, y el código para pegar en un sitio web que ya tenga.",
    ],
    sections: [
      {
        id: "overview",
        heading: "Resumen",
        blocks: [
          { p: "La mayoría de los contratistas no tienen un sitio web donde pegar código — tienen una página de Facebook, una ficha de Google y un teléfono. Por eso el enlace simple va primero en cada tarjeta y el código para incrustar, segundo. Todos los enlaces son públicos: sin inicio de sesión, sin aplicación, funcionan en un teléfono en la entrada de una casa. Todo lo que llega por ellos aterriza en su tablero de **Prospectos** o en su calendario, con su marca en la página que vio el cliente." },
        ],
      },
      {
        id: "on-the-screen",
        heading: "Qué hay en la pantalla",
        blocks: [
          { bullets: [
            "**Solicitar una cotización** — «Describen el trabajo y dejan sus datos. Llega a tu lista de prospectos. Ideal para quienes todavía comparan precios.»",
            "**Reservar una visita** — «Eligen una hora según tu disponibilidad real. Ideal para quienes ya decidieron y solo quieren que vayas.»",
            "**Estimación instantánea** — la página de dirección de entrada y precio de salida; cada estimación llega a su cola de revisión antes de ser vinculante. Los oficios y las tarifas se configuran en **Configuración → Cotizaciones instantáneas**.",
            "**Una tarjeta por embudo publicado**, con el nombre que usted le dio — «Un embudo de clientes potenciales paso a paso — comparte el enlace en un anuncio o ponlo en tu web.» Los embudos en borrador no se listan, porque su enlace todavía no funcionaría.",
            "Una línea de cierre: el formulario de cotización solo ofrece los servicios activados en Configuración → Servicios, y nunca muestra sus precios.",
          ] },
        ],
      },
      {
        id: "copy-a-link",
        heading: "Cómo copiar un enlace",
        blocks: [
          { steps: [
            "Abra **Configuración → Comparte tus enlaces**.",
            "En la tarjeta que quiera, presione **Copiar enlace**. El botón muestra **Copiado** durante dos segundos.",
            "Péguelo donde la gente ya lo encuentra. Presione **Abrir** primero si quiere ver lo que ellos verán.",
            "Para un sitio web que ya administra, presione en cambio **Copiar** bajo **Insértalo en tu sitio web en su lugar**, y entregue el código a quien edita el sitio — vea [[embed-booking-and-quote-forms|Incrustar los formularios de reservas y de presupuesto en cualquier sitio]].",
          ] },
          { figure: "live:app-settings-lead-form", caption: "Configuración → Comparte tus enlaces — las tarjetas Solicitar una cotización, Reservar una visita y Estimación instantánea, cada una con el enlace, Copiar enlace, Abrir y su código para incrustar." },
        ],
      },
      {
        id: "where-each-link-goes",
        heading: "Adónde lleva cada enlace",
        blocks: [
          { table: {
            head: ["Enlace", "Qué hace el cliente", "Dónde aterriza"],
            rows: [
              ["Solicitar una cotización", "Elige un servicio, describe el trabajo, agrega fotos, deja sus datos", "Un prospecto puntuado en el tablero de Prospectos — vea [[the-self-quote-form|El formulario de autopresupuesto]]"],
              ["Reservar una visita", "Elige un tipo de cita y un horario según su disponibilidad real, y paga una tarifa de visita si usted la cobra", "Una cita en su calendario y un prospecto — vea [[the-booking-page|La página de reservas]]"],
              ["Estimación instantánea", "Ingresa una dirección o traza un área, ve un precio inicial", "Revisiones de presupuesto, donde usted confirma el precio antes de enviar nada — vea [[estimate-reviews|Revisiones de estimaciones]]"],
              ["Un embudo", "Recorre un cuestionario corto y deja sus datos", "Un prospecto puntuado, marcado con el canal del embudo — vea [[funnels|Embudos de captación]]"],
            ],
          } },
        ],
      },
      {
        id: "who-can-see-it",
        heading: "Quién puede verlo",
        blocks: [
          { p: "Propietarios, administradores, despachadores y gerentes ven la fila y todas las tarjetas. Las tarjetas de embudo leen la lista de embudos, que los mismos niveles pueden abrir; alguien por debajo vería la frase **Los embudos de clientes potenciales los gestiona un propietario o un administrador — pídeles el enlace** en lugar de las tarjetas de embudo, pero esa fila de configuración no se le muestra en absoluto." },
        ],
      },
    ],
    faq: [
      { q: "¿Por qué no aparece mi embudo?", a: "Solo aparecen los embudos publicados con dirección. Abra Embudos, abra el embudo y presione Publish; primero necesita un paso de contacto." },
      { q: "¿Estos enlaces muestran mis precios?", a: "No. El formulario de cotización recopila suficientes detalles para cotizar con precisión sin publicar una tarifa. La estimación instantánea muestra un precio inicial solo para los oficios que usted activó, y solo lo que eligió bajo «Lo que ve el propietario»." },
      { q: "¿Hay un código QR?", a: "Hoy no en esta pantalla. Copie el enlace y use cualquier generador de códigos QR; el enlace no cambia." },
    ],
  },

  "embed-booking-and-quote-forms": {
    title: "Incrustar los formularios de reservas y de presupuesto en cualquier sitio",
    summary:
      "Pegue un solo fragmento en el sitio web que ya tiene para mostrar su calendario de reservas, su formulario de presupuesto, su estimación instantánea, sus reseñas o un embudo — sin marca FieldQuo, y la caja ajusta su altura sola.",
    updated: "2026-09-12",
    intro: [
      "Un contratista establecido no va a tirar un sitio web que posiciona bien. Lo que sí hará es pegarle una caja para que «reservar una visita» y «solicitar un presupuesto» dejen de ser un número de teléfono y pasen a ser una fila en el proceso. FieldQuo entrega esa caja como un fragmento que usted copia desde **Configuración → Comparte tus enlaces** (y, para las reseñas, desde **Configuración → Reseñas** y el panel Ajustar del creador de sitios).",
    ],
    sections: [
      {
        id: "overview",
        heading: "Resumen",
        blocks: [
          { p: "Cada fragmento es un iframe que apunta a una página incrustable más unas líneas de script. La página incrustable ejecuta el mismo flujo que la página pública — el mismo calendario de reservas, el mismo formulario de presupuesto — sin adornos de FieldQuo y con el nombre de su empresa en la pestaña. El script es la mitad que lo hace utilizable: la caja informa su propia altura, así que un visitante que completa una reserva ve la confirmación en lugar de un marco recortado. Mantenga el script junto al iframe; sin él la caja sigue funcionando, pero se desplaza dentro de una altura fija." },
        ],
      },
      {
        id: "the-widgets",
        heading: "Los cinco widgets",
        blocks: [
          { table: {
            head: ["Widget", "Dónde está el fragmento", "Altura inicial"],
            rows: [
              ["Reservar una visita", "Configuración → Comparte tus enlaces", "640 px"],
              ["Solicitar una cotización", "Configuración → Comparte tus enlaces", "640 px"],
              ["Estimación instantánea", "Configuración → Comparte tus enlaces", "560 px"],
              ["Reseñas de clientes", "Configuración → Reseñas, y Configuración → Tu sitio web → Ajustar", "220 px — y no muestra nada en absoluto hasta que tenga una reseña aprobada"],
              ["Un embudo", "Configuración → Comparte tus enlaces (uno por embudo publicado), y la propia página del embudo", "520 px"],
            ],
          } },
          { p: "La altura inicial es lo que mide la caja antes de que el script la redimensione, y lo que le queda a un sitio cuyo editor elimina los scripts — por eso ninguna es cero." },
        ],
      },
      {
        id: "paste-the-snippet",
        heading: "Cómo pegar un fragmento",
        blocks: [
          { steps: [
            "Abra **Configuración → Comparte tus enlaces** y ubique la tarjeta que quiera.",
            "Bajo **Insértalo en tu sitio web en su lugar**, presione **Copiar**.",
            "En el editor de su sitio, agregue un bloque HTML o de «código personalizado» donde deba aparecer el formulario, y pegue. Tanto el iframe como el script deben quedar en la página.",
            "Publique su sitio y abra la página en un teléfono. Complete una reserva o solicitud de prueba; aparece en su tablero de Prospectos o en su calendario como cualquier otra.",
          ] },
          { figure: "harness:settings-lead-form", caption: "Configuración → Comparte tus enlaces — el código para incrustar de cada tarjeta está bajo «Insértalo en tu sitio web en su lugar», con su propio botón Copiar." },
        ],
      },
      {
        id: "how-it-behaves",
        heading: "Cómo se comporta la caja incrustada",
        blocks: [
          { bullets: [
            "**Su marca, no la nuestra.** La página dentro de la caja lleva su logo y su color; el título de su pestaña es el nombre de su empresa; nada dice FieldQuo.",
            "**No se indexa.** Las páginas incrustables están marcadas para no indexarse, así que su propia página conserva el tráfico de búsqueda en lugar de competir con una copia sin adornos de sí misma.",
            "**Pagar dentro de un marco.** Una reserva que cobra una tarifa de visita envía al visitante a Stripe Checkout, que se niega a cargarse dentro del marco de otro sitio. FieldQuo mueve la pestaña entera al pago y además muestra un enlace que el visitante puede tocar si el navegador bloqueó el movimiento automático.",
            "**Dos cajas en una misma página** está bien — dos embudos, o las reseñas junto a un formulario de presupuesto. Cada fragmento redimensiona solo su propia caja.",
            "**Las reseñas se reducen a nada** cuando no hay ninguna aprobada, así que el fragmento de reseñas se puede colocar antes de que llegue su primera reseña.",
          ] },
          { note: "El fragmento lleva la dirección de FieldQuo desde la que se copió y el nombre corto de su empresa. Cópielo fresco desde la pantalla en lugar de reescribirlo; un fragmento con un error en la dirección muestra una caja vacía sin ningún aviso." },
        ],
      },
    ],
    faq: [
      { q: "¿Funciona en Wix, Squarespace, WordPress y los demás?", a: "En cualquier lugar donde pueda pegar un bloque HTML. Algunos creadores alojados eliminan el script; la caja entonces conserva su altura inicial y se desplaza por dentro, lo que igual funciona." },
      { q: "¿Puedo incrustar todo el sitio FieldQuo?", a: "No, y no lo necesita — el sitio es una página propia en su dirección. Las incrustaciones son para las partes que hacen un trabajo: reservar, cotizar, estimar, reseñas, embudos." },
      { q: "¿Una reserva incrustada respeta mi disponibilidad y mis tarifas?", a: "Sí. Es el mismo flujo de reservas que su página de reservas, y lee los mismos tipos de cita, el mismo margen de traslado, las mismas ventanas de llegada y las mismas tarifas de visita." },
    ],
  },

  "the-bio-link": {
    title: "El enlace para la bio",
    summary:
      "Una sola página con su marca para el único enlace que permiten Instagram y TikTok — construida con lo que su empresa ya tiene, ordenada y activada o desactivada por usted, con una vista previa de teléfono en vivo.",
    updated: "2026-09-12",
    intro: [
      "Instagram y TikTok le dan un solo enlace en el perfil. **Configuración → Enlace para la bio** convierte ese enlace en una página con su logo, su color, un encabezado, una línea debajo, una fila de iconos de redes sociales y los botones que importan: obtener un precio, reservar una visita, llamar, escribir, visitar el sitio web, dejar una reseña. Solo aparecen las cosas que usted realmente tiene, y nada es un enlace muerto.",
    ],
    sections: [
      {
        id: "overview",
        heading: "Resumen",
        blocks: [
          { p: "La página se deriva del registro de su empresa, no se escribe desde cero. Una fila aparece porque lo que hay detrás existe: el formulario de presupuesto siempre está; **Reservar una visita** aparece en cuanto tiene un tipo de cita activo; **Obtener un precio al instante** en cuanto hay un estimador instantáneo activado; cada embudo publicado como botón propio; su sitio web en cuanto está publicado o en cuanto ingresó un dominio en Configuración de la empresa; el enlace de reseñas en cuanto está configurado en Reseñas; su teléfono y su correo desde Configuración de la empresa. Una fila que usted apaga se queda apagada; una fila que nadie tocó está encendida la primera vez que se carga la página — incluido un embudo que publique el mes que viene." },
          { p: "La página sigue por sí sola el teléfono del visitante entre claro y oscuro; el selector claro / oscuro de esta pantalla solo cambia el marco de la vista previa. Lleva una pequeña línea **Made by FieldQuo** al final, en todos los planes — vea [[the-site-by-fieldquo-footer|El pie de página «Sitio por FieldQuo»]]." },
        ],
      },
      {
        id: "on-the-screen",
        heading: "Qué hay en la pantalla",
        blocks: [
          { bullets: [
            "**Tu enlace** — la dirección, **Copiar enlace**, **Abrir**, y la casilla **La página está activa**. «Pega esto en tu bio de Instagram o TikTok.»",
            "**Encabezado** («Déjalo vacío para usar el nombre de tu empresa.») y **Una línea debajo** («Opcional. Vacío significa que no se muestra nada — no la escribimos por ti.»).",
            "**Síguenos** — Instagram, Facebook, TikTok, YouTube, LinkedIn y X; escriba un usuario o pegue el enlace del perfil, deje uno vacío para ocultarlo.",
            "**Qué hay en la página** — cada fila con una casilla **Mostrar en la página**, su **Texto del botón**, un asa para arrastrar, **Subir** / **Bajar**, y su grupo (Obtener un precio, Reservar, Contacto, Más). «El primero es el botón grande.»",
            "**Agregar tu propio enlace** — hasta diez filas que escribe usted mismo, cada una con texto, una URL y un icono.",
            "**Todavía no disponible** — las filas que todavía no puede tener, y la pantalla que crearía cada una.",
            "**Vista previa** en un marco de teléfono, actualizada mientras escribe, con un selector claro / oscuro, y **Guardar** abajo.",
          ] },
        ],
      },
      {
        id: "set-it-up",
        heading: "Cómo configurarlo",
        blocks: [
          { steps: [
            "Abra **Configuración → Enlace para la bio**.",
            "Escriba el **Encabezado** o déjelo como el nombre de su empresa, y **Una línea debajo** si quiere una — nada se inventa por usted.",
            "Bajo **Síguenos**, escriba sus usuarios. Un campo que no parezca un usuario ni un enlace de perfil no se guarda, y la pantalla lo dice.",
            "Bajo **Qué hay en la página**, marque las filas que quiera, renombre un botón si el texto predeterminado no es el suyo, y arrastre o use las flechas para poner la más importante primero — se convierte en el botón grande.",
            "Presione **Agregar tu propio enlace** para cualquier otra cosa (una ficha de Google, una galería en otro sitio). Sus propios enlaces necesitan texto y una URL.",
            "Presione **Guardar**, luego **Copiar enlace**, y péguelo en su perfil de Instagram o TikTok.",
          ] },
          { figure: "live:app-settings-links", caption: "Configuración → Enlace para la bio — Tu enlace, el encabezado y la línea, Síguenos, Qué hay en la página con sus casillas y flechas, y la vista previa de teléfono a la derecha." },
          { note: "Nada de esto se guarda hasta que presiona **Guardar**. Reordenar, renombrar y apagar es una edición de varios pasos de una sola página pública, y guardar cada tecla pondría estados a medio terminar frente a quien toque el enlace mientras tanto." },
        ],
      },
      {
        id: "what-goes-on-the-page",
        heading: "Qué puede ir en la página",
        blocks: [
          { table: {
            head: ["Fila", "Aparece cuando", "Activada por defecto"],
            rows: [
              ["Obtener un precio al instante", "Un estimador instantáneo está activado en Configuración → Cotizaciones instantáneas", "Sí"],
              ["Presupuesto gratis (el formulario de presupuesto)", "Siempre — toda empresa lo tiene", "Sí"],
              ["Reservar una visita", "Al menos un tipo de cita activo en Configuración → Página de reservas", "Sí"],
              ["Cada embudo publicado, por su nombre", "El embudo está publicado", "Sí"],
              ["Visita nuestro sitio web", "Un dominio en Configuración de la empresa, o un sitio FieldQuo publicado", "Sí"],
              ["Llamar", "Un número de teléfono en Configuración de la empresa", "Sí"],
              ["Escríbenos por WhatsApp", "Un número de teléfono en Configuración de la empresa", "No — tener un número no significa que WhatsApp esté en él"],
              ["Envíanos un correo", "Un correo en Configuración de la empresa", "Sí"],
              ["Deja una reseña", "Un enlace de reseñas en Configuración → Reseñas", "Sí"],
              ["Sus propios enlaces", "Usted los agregó", "Sí"],
            ],
          } },
          { p: "El texto de los botones sale del idioma de su empresa, no del idioma en que usted lee la configuración — la página de una empresa en inglés dice **Get a free quote** y **Call**." },
        ],
      },
      {
        id: "what-each-control-changes",
        heading: "Qué cambia cada control",
        blocks: [
          { bullets: [
            "**La página está activa** — desmárquela y guarde, y la dirección muestra una página de no encontrado hasta que la vuelva a marcar. La página está activa desde el principio.",
            "**Mostrar en la página** — oculta o muestra una fila. Una fila oculta conserva su lugar y su texto para cuando la devuelva.",
            "**Texto del botón** — reemplaza el texto predeterminado solo en esa fila. Vacío significa el predeterminado, nunca un botón sin texto.",
            "**El orden** — la primera fila es el botón grande; las secciones se ordenan según dónde cae la primera fila de cada grupo, así que poner su sitio web primero pone **Más** primero.",
            "**Claro / Oscuro** — solo el marco de la vista previa. Los visitantes reciben lo que pida su teléfono.",
          ] },
        ],
      },
      {
        id: "who-can-see-it",
        heading: "Quién puede verlo",
        blocks: [
          { p: "Propietarios, administradores, despachadores y gerentes pueden abrir y guardar esta pantalla. La página pública en sí no necesita nada — ni cuenta, ni aplicación." },
        ],
      },
    ],
    faq: [
      { q: "¿Por qué «Reservar una visita» aparece en gris?", a: "No tiene ningún tipo de cita activo. La lista Todavía no disponible dice qué pantalla lo crea — Configuración → Página de reservas." },
      { q: "¿Un enlace puede apuntar a un número de teléfono o a WhatsApp?", a: "Llamar y Escríbenos por WhatsApp vienen incorporados y leen el número de teléfono de su empresa. WhatsApp está apagado hasta que usted lo encienda, porque un enlace wa.me a un número que no está en WhatsApp abre un chat con nadie." },
      { q: "¿Hay un código QR para el enlace?", a: "Hoy no en esta pantalla. La dirección es lo bastante corta para decirla en voz alta; cualquier generador de códigos QR la convertirá en un cuadrado para la camioneta." },
    ],
  },

  funnels: {
    title: "Embudos de captación",
    summary:
      "Cuestionarios pensados para el móvil, que se recorren a toques, para sus anuncios y su enlace en la bio: califican al visitante y dejan un prospecto puntuado en su tablero de Prospectos — con un informe de abandono por paso.",
    updated: "2026-09-12",
    intro: [
      "Un embudo es una página de aterrizaje corta para un anuncio o un folleto: una pregunta por pantalla, un toque por respuesta, y al final un formulario de contacto — o un precio antes del formulario. **Embudos** lista los suyos con su estado, su canal y su número de prospectos; **Nuevo embudo** inicia uno desde una plantilla por canal o desde una frase que usted le escribe a la IA. Cada recorrido completado se convierte en un prospecto en su tablero de **Prospectos**, puntuado como caliente, tibio o frío según las respuestas, para que la persona que tocó «este mes» y «más de 15 000 $» esté al principio de la lista cuando abra la aplicación.",
    ],
    sections: [
      {
        id: "overview",
        heading: "Resumen",
        blocks: [
          { p: "Un formulario estático hace ocho preguntas de golpe y pierde al visitante en la segunda. Un embudo hace una a la vez, con el pulgar del visitante haciendo el trabajo, y registra hasta dónde llegó cada uno — así que «el 60 % abandona en la pregunta del presupuesto» es un número que usted lee en lugar de una suposición. La página pública lleva su logo y su color de marca y nada de FieldQuo, y está marcada para no indexarse, porque es una página de aterrizaje publicitaria y no su sitio web." },
        ],
      },
      {
        id: "on-the-screen",
        heading: "Qué hay en la pantalla",
        blocks: [
          { bullets: [
            "El título **Embudos** — «Embudos de captación pensados para el móvil, que se recorren a toques, para tus anuncios y tu enlace en la bio. Cada uno califica a los visitantes y deja un contacto puntuado directamente en tu pipeline.» — y **Nuevo embudo**.",
            "Una fila por embudo: su nombre, **Publicado** o **Borrador**, su canal (Web, Instagram, TikTok, YouTube), cuántos contactos produjo, cuándo se actualizó por última vez, y una papelera.",
            "Sin embudos todavía: **Aún no hay embudos — Crea uno desde una plantilla o descríbeselo a la IA — y luego comparte el enlace en tus anuncios.**",
          ] },
          { figure: "harness:funnels", caption: "Embudos — un embudo Web publicado con 14 contactos y un borrador de Instagram, cada uno con su canal y su última actualización." },
        ],
      },
      {
        id: "create-a-funnel",
        heading: "Cómo crear un embudo",
        blocks: [
          { steps: [
            "Abra **Embudos** bajo Crecer en la barra lateral y presione **Nuevo embudo**.",
            "Escriba una frase bajo **Descríbelo y deja que la IA lo construya** («Un embudo de TikTok para pintura exterior que califique el presupuesto y agende una estimación») y presione **Generar**, o elija una plantilla: **Sitio web — pedir presupuesto**, **TikTok — cuestionario de 60 segundos**, **Instagram — estimación gratuita**, **YouTube — reserva tu visita**, cada una «cuestionario → calificar → captar». **o empieza desde un embudo en blanco** es la tercera puerta.",
            "El editor se abre con los pasos a la izquierda, el paso seleccionado en el centro y una vista previa de teléfono con sus colores a la derecha — vea [[build-a-funnel|Construir un embudo y leer su informe de abandono]].",
            "Presione **Publish**. El enlace público y el código para incrustar aparecen en la página del embudo, y el embudo se lista en **Configuración → Comparte tus enlaces** y, una vez activado, en su enlace para la bio.",
          ] },
          { figure: "create:app-funnels-create", caption: "Nuevo embudo — la caja de IA («Descríbelo y deja que la IA lo construya»), las cuatro plantillas por canal, y «o empieza desde un embudo en blanco»." },
          { note: "La IA escribe solo las frases del embudo — el gancho, las preguntas, el texto de los botones — a partir de sus servicios reales y del canal que nombró. Nunca inventa un servicio ni un precio, y las preguntas de puntuación conservan sus valores de respuesta fijos, así que un embudo generado puntúa los contactos exactamente igual que uno construido a mano. Si la IA no está disponible, recibe la plantilla del canal con textos más planos, nunca un embudo roto. Generar consume la asignación mensual de IA de su plan." },
        ],
      },
      {
        id: "the-lead-it-produces",
        heading: "El prospecto que produce",
        blocks: [
          { p: "Cuando un visitante termina, FieldQuo crea un prospecto con el nombre del paso de contacto, su correo o su teléfono (uno de los dos es obligatorio), el rango de presupuesto y el plazo tomados de las preguntas que usted marcó para alimentarlos, cada otra respuesta como una línea del mensaje del prospecto («¿Qué habitaciones?: Cocina, Dos baños»), las fotos que subió, y un origen **funnel** más el canal. Se puntúa igual que cualquier otro prospecto — vea [[lead-scoring-hot-warm-cold|Puntuación de prospectos: caliente, tibio, frío]] — y queda en [[the-leads-board|el tablero de Prospectos]] con los demás." },
        ],
      },
      {
        id: "what-is-different",
        heading: "Lo que otras herramientas no listan",
        blocks: [
          { bullets: [
            "Ninguno de los cinco competidores cuyas páginas de precios sigue FieldQuo — Jobber, Housecall Pro, QuoteIQ, ServiceTitan y Projul — lista embudos de captación en ningún nivel. Listan un formulario de contacto de sitio web; un embudo es otra cosa, con un informe de abandono paso a paso.",
            "Un embudo puede ponerle precio al trabajo antes del paso de contacto, a partir de sus tarifas de estimación instantánea, para que el visitante deje sus datos ya conociendo el rango — vea el paso de estimación instantánea en [[build-a-funnel|Construir un embudo y leer su informe de abandono]].",
            "Está incluido en todos los planes.",
          ] },
        ],
      },
      {
        id: "who-can-see-it",
        heading: "Quién puede verlo",
        blocks: [
          { p: "Propietarios, administradores, despachadores y gerentes ven **Embudos** y pueden crear, editar, publicar y eliminar. Los estimadores y la cuadrilla no ven la fila, y la lista los rechaza. La página pública del embudo no exige nada al visitante más que un pulgar." },
        ],
      },
    ],
    faq: [
      { q: "¿Qué pasa con los prospectos si elimino un embudo?", a: "Los prospectos que ya están en su tablero se quedan donde están. Lo que se va con el embudo es cada recorrido registrado y todo el informe de abandono que hay detrás — el cuadro de eliminación dice cuántos recorridos." },
      { q: "¿Puedo usar el mismo embudo en TikTok y en mi sitio web?", a: "Sí — el canal es una etiqueta que viaja en el origen del prospecto; el enlace funciona en cualquier parte. Haga dos si quiere comparar por separado el abandono de los dos públicos." },
      { q: "¿Un embudo necesita mi sitio web FieldQuo?", a: "No. Es una página propia con su propia dirección, y se puede incrustar en cualquier sitio que usted ya administre." },
    ],
  },

  "build-a-funnel": {
    title: "Construir un embudo y leer su informe de abandono",
    summary:
      "El editor de embudos paso a paso: los siete tipos de paso, las etiquetas de puntuación, el paso de estimación instantánea, los píxeles publicitarios, qué exige Publish, y cómo leer Starts, Leads, Conversion y el abandono por paso.",
    updated: "2026-09-12",
    intro: [
      "Abra un embudo desde **Embudos** y está en el editor: la lista de pasos a la izquierda, el editor del paso seleccionado en el centro, y una vista previa en vivo de ese paso con sus colores a la derecha. Este artículo explica qué hace cada tipo de paso, qué preguntas alimentan la puntuación del prospecto, cómo llega un precio a la mitad de un embudo, y cómo leer el informe una vez que la gente lo ha recorrido.",
    ],
    sections: [
      {
        id: "overview",
        heading: "Resumen",
        blocks: [
          { p: "La barra superior tiene el nombre del embudo (escriba para renombrarlo), su etiqueta **Borrador** o **Publicado**, **Save**, y **Publish** / **Unpublish**. Cuando el embudo está publicado, su enlace público aparece con **Copy link** y **Open**, y su código para incrustar con **Copy code**; mientras es borrador no se ofrece ninguno, porque el enlace todavía no funcionaría. Debajo, en cuanto alguien lo ha empezado, está **Performance**. Las palabras de la barra están en inglés en la pantalla de todos los idiomas; las etiquetas del editor siguen su idioma." },
        ],
      },
      {
        id: "the-steps",
        heading: "Los siete tipos de paso",
        blocks: [
          { table: {
            head: ["Paso", "Qué ve el visitante", "Qué configura usted"],
            rows: [
              ["Introducción", "El gancho y un botón", "El titular, una línea de apoyo, el texto del botón"],
              ["Opción única", "Una pregunta, un toque en una respuesta", "La pregunta, el texto de ayuda, las respuestas (etiqueta y valor guardado), y la etiqueta de puntuación"],
              ["Opción múltiple", "Una pregunta, toques en varias", "La pregunta, el texto de ayuda, las respuestas"],
              ["Estimación instantánea", "Una pregunta sobre el tamaño y, según sus tarifas, un rango de precio", "El servicio a presupuestar, las opciones de tamaño, un supuesto para todos los visitantes, y si el precio va antes o después del paso de contacto"],
              ["Subida de fotos", "«Toca para añadir fotos»", "La pregunta y el texto de ayuda; las fotos aterrizan en el prospecto"],
              ["Formulario de contacto", "Nombre, correo, teléfono", "Qué campos recoger — el nombre siempre se pide, y al menos el correo o el teléfono"],
              ["Agradecimiento", "La pantalla de cierre", "Su encabezado y su texto"],
            ],
          } },
          { p: "Agregue pasos con **Añadir paso**, reordénelos con las flechas y quite uno con la papelera. El visitante los ve en el orden de la lista. El texto que usted escribe está en el idioma del visitante, sea cual sea el idioma de su aplicación — es su texto en una página pública, y FieldQuo no lo traduce." },
        ],
      },
      {
        id: "scoring",
        heading: "Qué respuestas puntúan el prospecto",
        blocks: [
          { p: "Una pregunta de opción única lleva una etiqueta de **Puntuación de contactos**: **Sin puntuación**, **Alimenta el plazo** o **Alimenta el presupuesto**. Las respuestas de una pregunta etiquetada deben usar los valores guardados fijos que el puntuador entiende — el editor los imprime bajo la etiqueta («Los valores de las respuestas deben ser: …») — y las etiquetas que el visitante toca pueden decir lo que usted quiera. El plazo y el presupuesto del prospecto determinan entonces su puntuación caliente / tibio / frío exactamente igual que para un prospecto del formulario de cotización." },
          { note: "Las plantillas por canal vienen con una pregunta de plazo y una de presupuesto ya etiquetadas y con valores. Renombre las etiquetas libremente; deje los valores guardados como están, o la respuesta deja de alimentar la puntuación." },
        ],
      },
      {
        id: "the-instant-estimate-step",
        heading: "El paso de estimación instantánea",
        blocks: [
          { p: "Este paso pone un precio inicial real a la mitad del embudo, calculado del lado de FieldQuo con las tarifas que usted configuró en **Configuración → Cotizaciones instantáneas**. El visitante toca una opción de tamaño («Una habitación, unos 20 m²»); su teléfono envía solo qué opción tocó, nunca una medida, y el rango vuelve desde sus tarifas guardadas." },
          { bullets: [
            "**Servicio a presupuestar** — solo un oficio activado en Cotizaciones instantáneas y que se pueda presupuestar a partir de una opción tocada. Los tejados, el corte de césped y la retirada de escombros se calculan a partir de una medición por satélite, un trazado en el mapa o una lista de artículos, así que se quedan en su página de presupuesto instantáneo y no en un embudo; el editor lo dice.",
            "**Orden** — **Primero el precio, luego sus datos** (menos contactos, pero mucho más interesados — para eso existe el paso) o **Primero sus datos, luego el precio** (más contactos, más fríos). Un servicio configurado para revelar su rango solo después del envío muestra el precio después del paso de contacto, elija lo que elija.",
            "**Dar por supuesto para todos los visitantes** — lo que un embudo no puede preguntar, dicho una vez: un trabajo exterior sin especificar se presupuesta como interior.",
            "Un servicio configurado como «no mostrar precio» muestra su mensaje de devolución de llamada en lugar de una cifra.",
          ] },
        ],
      },
      {
        id: "publish-and-share",
        heading: "Cómo publicarlo y compartirlo",
        blocks: [
          { steps: [
            "Presione **Save** cada vez que el botón esté oscuro; muestra **Saved** cuando no hay nada pendiente.",
            "Bajo **Píxeles de seguimiento publicitario** (opcional) puede anotar un **ID del píxel de Meta**, un **ID del píxel de TikTok** o un **ID de medición de GA4**. FieldQuo los guarda, pero la página pública del embudo hoy no carga los scripts de los píxeles, así que la plataforma publicitaria todavía no se entera de las visitas al embudo — trate los tres campos como un registro hasta que eso cambie.",
            "Presione **Publish**. La etiqueta pasa a **Publicado** y aparecen el enlace público y el código para incrustar.",
            "Presione **Copy link** para un anuncio o una publicación, o **Copy code** para poner el embudo en un sitio que ya tenga; también se lista en **Configuración → Comparte tus enlaces** y en su enlace para la bio.",
          ] },
          { warning: "**Publish** se rechaza sin un paso de contacto — un embudo sin formulario no captura nada, y el mensaje lo dice. Un paso de estimación instantánea sin un servicio presupuestable también lo bloquea; los motivos se listan bajo un aviso de «este embudo todavía no puede publicarse» en lugar de esconderse tras un botón en gris." },
        ],
      },
      {
        id: "read-the-drop-off",
        heading: "Cómo leer el informe de abandono",
        blocks: [
          { p: "**Performance** aparece en cuanto al menos un visitante ha empezado el embudo. Muestra **Starts** (visitantes distintos que vieron el primer paso), **Leads** (recorridos completados) y **Conversion** (contactos como proporción de los inicios), y luego una barra por paso en su orden, con el número de visitantes distintos que lo alcanzaron y ese número como porcentaje de los inicios." },
          { bullets: [
            "Un paso donde el porcentaje cae de golpe es el paso a cambiar: menos respuestas, una pregunta más amable, o el precio movido después del paso de contacto.",
            "El informe se construye con los recorridos de este embudo; eliminar el embudo elimina el informe, y despublicarlo lo conserva.",
            "Nada de esto es la identidad de un prospecto — las identidades están en el tablero de Prospectos.",
          ] },
          { tip: "Compare con honestidad **Primero el precio** y **Primero sus datos**: deje correr un orden una semana, anote Starts y Conversion, cambie el orden, deje correr otra semana. El informe es por embudo, así que una copia del embudo con el otro orden es la prueba más limpia." },
        ],
      },
    ],
    faq: [
      { q: "¿Por qué la pregunta de tamaño presupuesta todo como interior?", a: "Porque nada le dijo lo contrario. Configure «Dar por supuesto para todos los visitantes» en exterior en el paso de estimación, o agregue una pregunta de opción única — el supuesto es el único dato que el paso no puede preguntar." },
      { q: "¿Un visitante puede volver al paso anterior?", a: "Sí — cada paso después del primero muestra un enlace para volver hasta que se envía el formulario. El informe cuenta a un visitante una sola vez por paso, sin importar cuántas veces vuelva a él." },
      { q: "¿El embudo funciona dentro del navegador integrado de Instagram o TikTok?", a: "Sí — es una página normal sin aplicación que instalar, y su altura es de una pregunta por pantalla, así que cabe en el marco integrado." },
    ],
  },

  "marketing-campaigns": {
    title: "Campañas de marketing",
    summary:
      "La pantalla Marketing: una tarjeta por campaña — distribución de folletos, Meta / anuncios pagados, envío masivo de correo u otro — con su tipo, su estado, su progreso y su responsable, más Suscriptores y Gasto en marketing al lado.",
    updated: "2026-09-12",
    intro: [
      "**Marketing** es el estante donde están sus campañas. Un reparto de folletos se trabaja parada por parada desde un teléfono y muestra **26/40 paradas · 9 contactados**; un envío masivo de correo muestra su plantilla y **Enviado a …** con el número; un registro de anuncios pagados muestra su presupuesto y un enlace al administrador de anuncios. Este artículo cubre la pantalla, el formulario **Nueva campaña** y los cuatro tipos; la ruta de folletos, el envío de correo y el informe de gasto tienen cada uno su propio artículo.",
    ],
    sections: [
      {
        id: "overview",
        heading: "Resumen",
        blocks: [
          { p: "Bajo el título — «Gestiona y haz seguimiento de tus campañas: anuncios pagados, envíos masivos de correo y distribución de folletos puerta a puerta, con rutas, asignaciones y seguimientos en la puerta en un solo lugar.» — están **Suscriptores**, **Gasto en marketing** y **Nueva campaña**. Cada campaña es una tarjeta. Una tarjeta de folletos o de correo abre su propia página; una tarjeta de anuncios pagados u otro es un registro y no abre nada, porque el trabajo ocurre en la plataforma publicitaria." },
        ],
      },
      {
        id: "on-the-screen",
        heading: "Qué hay en la pantalla",
        blocks: [
          { bullets: [
            "El nombre de la tarjeta y una etiqueta de estado, en inglés: **Draft**, **Active**, **Completed** o **Partial**.",
            "Su tipo: **Distribución de folletos**, **Meta / anuncios pagados**, **Envío masivo de correo** u **Otro**.",
            "Su progreso — una ruta de folletos muestra **visitadas/total paradas** con una barra y **… contactados**; un correo muestra el nombre de la plantilla y **Enviado a …** o **Aún no enviado**; un anuncio muestra **Presupuesto …** y **vinculado** cuando se ingresó un enlace.",
            "A quién está asignada.",
            "Sin nada todavía: **Aún no hay campañas. Crea una para empezar a hacer seguimiento de tu marketing.**",
          ] },
          { figure: "live:app-marketing", caption: "Marketing — el título, Suscriptores, Gasto en marketing y Nueva campaña, y una tarjeta por campaña con su tipo y su estado." },
        ],
      },
      {
        id: "create-a-campaign",
        heading: "Cómo crear una campaña",
        blocks: [
          { steps: [
            "Abra **Marketing** bajo Crecer y presione **Nueva campaña**.",
            "Escriba el **Nombre de la campaña** y elija el tipo.",
            "**Asignar a** una persona, o deje **Sin asignar**. Para un reparto de folletos, es quien recorre la ruta.",
            "Para **Envío masivo de correo**, elija la **Plantilla a enviar** — solo se ofrecen plantillas de marketing y personalizadas; si no tiene ninguna, cree una primero en **Plantillas de correo**, el formulario lo dice. Para **Meta / anuncios pagados** y **Otro**, ingrese un **Presupuesto (opcional)** y un **Enlace (Meta Ads Manager, etc.)**.",
            "Presione **Crear campaña**. La tarjeta aparece; una tarjeta de folletos o de correo se abre al tocarla.",
          ] },
          { figure: "create:app-marketing-create", caption: "Nueva campaña — el nombre, el tipo, Asignar a y Crear campaña; los campos adicionales aparecen cuando el tipo es Envío masivo de correo, Meta / anuncios pagados u Otro." },
        ],
      },
      {
        id: "the-four-kinds",
        heading: "Los cuatro tipos",
        blocks: [
          { table: {
            head: ["Tipo", "Qué contiene la campaña", "Siga leyendo"],
            rows: [
              ["Distribución de folletos", "Una ruta de direcciones, ordenada en un recorrido eficiente, cada parada marcada como Entregado, Habló con el propietario, No estaba u Omitido desde el teléfono, y un propietario atendido convertido en cliente en el acto", "[[pamphlet-routes|Rutas de folletos y colgadores de puerta]]"],
              ["Envío masivo de correo", "Una plantilla enviada una vez a todos los suscritos en ese momento, desde su propio remitente, con el conteo de a quiénes llegó", "[[email-campaigns-and-subscribers|Campañas de correo y suscriptores]]"],
              ["Meta / anuncios pagados", "Un presupuesto y un enlace al administrador de anuncios, como registro", "[[marketing-spend|Gasto en marketing]] y [[connect-meta-ads|Conectar su cuenta publicitaria de Meta]]"],
              ["Otro", "Un presupuesto y un enlace, para cualquier otra cosa — una cuña de radio, un patrocinio", "[[marketing-spend|Gasto en marketing]]"],
            ],
          } },
          { note: "El **Presupuesto** de una tarjeta de anuncios pagados u otro es una nota en la tarjeta. Lo que realmente gastó se registra en **Gasto en marketing**, que es lo que leen las cifras de costo por prospecto; un presupuesto escrito aquí no las alimenta." },
        ],
      },
      {
        id: "statuses",
        heading: "Estados",
        blocks: [
          { bullets: [
            "**Draft** — toda campaña nueva. Una campaña de folletos o de anuncios pagados conserva esta etiqueta; FieldQuo no la cambia por sí solo y no hay ningún control en la pantalla para ajustarla, así que lea el progreso de una campaña de folletos en sus paradas, no en su etiqueta.",
            "**Completed** — una campaña de correo una vez que se envió a todos los suscriptores.",
            "**Partial** — un envío de correo que se detuvo a medias; la página de la campaña ofrece reanudar el envío, que escribe solo a las personas que aún no recibieron el correo.",
            "**Active** existe como valor y se muestra en una tarjeta que lo lleva, pero hoy nada en la pantalla lo establece.",
          ] },
        ],
      },
      {
        id: "who-can-see-it",
        heading: "Quién puede verlo",
        blocks: [
          { p: "La fila **Marketing**, la lista, los suscriptores y el informe de gasto son para propietarios, administradores, despachadores y gerentes. Marcar una parada en una ruta de folletos es trabajo de campo y está abierto a cualquier miembro activo, y la página de una campaña oculta su presupuesto y sus notas a quien esté por debajo de ese nivel — pero la cuadrilla y los estimadores no tienen ninguna fila desde donde llegar a la lista, así que entrégueles directamente el enlace de la campaña." },
        ],
      },
    ],
    faq: [
      { q: "¿Puedo eliminar una campaña?", a: "Hoy no desde la pantalla — ni la lista ni la página de una campaña tienen un control de eliminación, así que una campaña terminada se queda en el estante con su etiqueta. Las paradas de una ruta de folletos se pueden quitar una por una." },
      { q: "¿Una campaña de Meta aquí se conecta con mi cuenta publicitaria de Meta?", a: "No desde esta tarjeta — contiene un presupuesto y un enlace. La sincronización de la cuenta publicitaria, los formularios de prospectos y la importación del gasto están en Configuración → Meta Ads." },
      { q: "¿De dónde salen las direcciones de correo de un envío?", a: "De Suscriptores — las personas suscritas en ese momento. Quien se dio de baja queda excluido automáticamente." },
    ],
  },
};
