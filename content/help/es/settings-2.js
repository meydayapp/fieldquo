// content/help/es/settings-2.js
//
// Parte 2 de la categoría «settings» en español. Slugs de esta parte
// (lib/help/tree.js): settings-work-areas, settings-products, settings-services, settings-material-costs, settings-cabinet-rates, settings-overhead, settings-custom-fields, settings-quote-email, settings-email-templates, settings-pdf-templates, settings-translations, settings-checklists.
//
// Misma estructura que el inglés, artículo por artículo: mismos slugs, mismas
// secciones en el mismo orden, mismos bloques, mismas figuras —
// scripts/check-help-centre.mjs compara ambos. Las palabras en pantalla vienen
// del bloque `es` de app/i18n/appMessages.js. Los nombres de los tipos de
// presupuesto, de las secciones del PDF y de los tipos de plantilla de correo,
// y el botón «Use this» de Plantillas PDF, solo aparecen en inglés en pantalla
// y se citan tal cual.
export const ARTICLES = {
  "settings-work-areas": {
    title: "Zonas de trabajo",
    summary:
      "Nombre las zonas o proyectos en los que trabaja su empresa, diga quién está en cada uno, y sepa dónde reaparecen esos nombres: en su sitio web público y en lo que su recepcionista telefónico les dice a quienes llaman.",
    updated: "2026-09-12",
    intro: [
      "**Configuración → Equipo y horarios → Zonas de trabajo** es una lista corta de zonas con nombre — Laval, la Costa Norte, el proyecto de condominios del centro — con las personas asignadas a cada una. Existe para que «¿de quién es esta zona?» tenga una sola respuesta que todos puedan consultar.",
      "Los nombres llegan más lejos que la lista del equipo. Son lo que imprime el bloque **Dónde trabajamos** de su sitio web, y forman parte de lo que el recepcionista telefónico sabe de su empresa. Así que una zona de trabajo es una declaración pública de dónde acepta trabajos, no solo una etiqueta interna.",
    ],
    sections: [
      {
        id: "overview",
        heading: "Resumen",
        blocks: [
          { p: "La página tiene una sola casilla, **Nombre de la nueva área de trabajo**, con un botón de más al lado, y luego una tarjeta por zona. En cada tarjeta ve el nombre de la zona y una etiqueta por cada miembro de su equipo; una etiqueta rellena significa que esa persona está asignada a la zona, una con solo el contorno significa que no. Tocar una etiqueta la invierte, y el cambio se guarda al instante — no hay un botón de guardar aparte." },
          { figure: "live:app-settings-work-areas", caption: "Configuración → Zonas de trabajo — la casilla del nombre arriba, luego una tarjeta por zona con una etiqueta por miembro del equipo." },
          { p: "Quien no puede cambiar asignaciones ve la misma página como una lista simple: el aviso **Estas son las zonas a las que te pueden asignar.**, y luego cada zona con los nombres de las personas que están en ella, o **Todavía no hay nadie asignado.**" },
        ],
      },
      {
        id: "add-a-work-area",
        heading: "Cómo agregar una zona de trabajo y asignar personas",
        blocks: [
          { steps: [
            "Abra **Configuración → Zonas de trabajo**.",
            "Escriba un nombre en **Nombre de la nueva área de trabajo** y pulse el botón de más. La tarjeta aparece debajo.",
            "Toque el nombre de cada miembro del equipo que trabaja esa zona. Una etiqueta rellena es una asignación; tóquela otra vez para quitar a la persona.",
          ] },
          { note: "No hay renombrar ni eliminar en esta pantalla. Una zona que ya no usa se queda en la lista — y se queda en el bloque **Dónde trabajamos** de su sitio web — así que nómbrelas con cuidado y limite la lista a los lugares que de verdad atiende." },
        ],
      },
      {
        id: "where-the-names-go",
        heading: "Dónde se usan los nombres",
        blocks: [
          { bullets: [
            "**Su sitio web.** Si su sitio tiene el bloque **Dónde trabajamos**, lista sus zonas de trabajo como píldoras, en orden alfabético, hasta 40. No hay una lista aparte de ciudades que escribir — esta es la única fuente, así que nunca queda desactualizada. Ver [[the-website-builder|El constructor de sitios web]].",
            "**El recepcionista telefónico.** Los nombres de las zonas forman parte de lo que se le cuenta al recepcionista sobre su empresa, para que pueda responder a quien llama preguntando si van a su ciudad. Ver [[settings-phone-receptionist|Recepcionista telefónico]].",
            "**Las tareas.** Una tarea puede llevar una zona de trabajo en la base de datos, pero la pantalla de tareas no tiene hoy un selector de zona, así que agrupar tareas por zona todavía no es algo que pueda hacer desde la aplicación.",
          ] },
        ],
      },
      {
        id: "who-can-see-it",
        heading: "Quién puede verlo",
        blocks: [
          { p: "La fila aparece para propietarios, administradores y supervisores — los niveles de acceso Despachador y Gerente — porque crear una zona y cambiar quién está en ella necesita el permiso **workarea:assign** que esos roles tienen. Un empleado que llega a la página la lee como la lista descrita arriba y no puede cambiar nada; el servidor rechaza el cambio se haya dibujado el botón o no." },
        ],
      },
    ],
    faq: [
      { q: "¿Asignar a alguien a una zona de trabajo cambia su agenda?", a: "No. Registra que esa persona trabaja esa zona. La programación sigue ocurriendo en el calendario y en cada trabajo; nada se asigna automáticamente desde aquí." },
      { q: "¿Por qué mi sitio web lista una zona que dejé de atender?", a: "Porque el bloque del sitio web imprime exactamente esta lista y no hay eliminar en esta pantalla. Hasta que exista, la lista de su sitio es la lista de aquí." },
    ],
  },

  "settings-products": {
    title: "Productos y servicios (el catálogo de precios)",
    summary:
      "El catálogo de artículos que suelta en un presupuesto — nombre, precio de venta, costo, unidad y los tipos de presupuesto a los que pertenece — con una importación y una exportación CSV.",
    updated: "2026-09-12",
    intro: [
      "**Configuración → Servicios y precios → Productos y servicios** es su catálogo de precios: los artículos puntuales que agrega a un presupuesto por su nombre en lugar de cotizarlos desde cero — un cargo por urgencia, un juego de manijas, una mano de imprimación en las molduras. El alcance principal de un oficio (por puerta, por pie cuadrado) se cotiza desde el tarifario en [[settings-services|Servicios y precios]]; esta pantalla contiene todo lo demás.",
      "Una línea tomada de aquí aterriza en el presupuesto con el precio que usted fijó, así que la cifra que ve un propietario es la suya. Las páginas públicas nunca leen esta lista — un desconocido en su sitio web ve sus servicios, nunca sus tarifas.",
    ],
    sections: [
      {
        id: "overview",
        heading: "Qué hay en la pantalla",
        blocks: [
          { p: "Arriba: una casilla **Buscar** y el botón **Agregar artículo**. Debajo, la lista, cada fila con el nombre, la descripción, una insignia **Servicio** o **Producto** y los tipos de presupuesto a los que está vinculada, con un icono de editar y otro de eliminar. La lista está paginada — elija 6, 10, 25 o 50 por página al pie — y la búsqueda recorre todo el catálogo, no solo la página en la que está." },
          { figure: "live:app-settings-products", caption: "Configuración → Productos y servicios — la lista con búsqueda y Agregar artículo, luego las tarjetas Costos, Importar y Exportar." },
          { p: "Bajo la lista hay tres tarjetas: **Costos**, **Importar productos y servicios** y **Exportar productos y servicios**." },
        ],
      },
      {
        id: "add-an-item",
        heading: "Cómo agregar o editar un artículo",
        blocks: [
          { steps: [
            "Pulse **Agregar artículo** (o el lápiz de una fila existente).",
            "Complete el nombre, una descripción opcional, el tipo — **Servicio** o **Producto** — y una unidad como pie² o puerta.",
            "Ingrese el **Precio unitario** (lo que paga el cliente) y, si lo conoce, el **Precio de costo** (lo que le cuesta a usted).",
            "En **Disponible en estos tipos de presupuesto**, marque los tipos de presupuesto a los que pertenece este artículo. Deje todas las casillas sin marcar y se ofrece en todos los tipos de presupuesto.",
            "Pulse **Agregar artículo** o **Guardar cambios**.",
          ] },
          { figure: "create:app-settings-products-create", caption: "Agregar artículo — nombre, tipo, unidad, precio unitario, precio de costo y los tipos de presupuesto en los que está disponible el artículo." },
          { warning: "Eliminar es permanente. La confirmación lo dice claramente: el precio y la descripción se quitan para siempre. Los presupuestos ya redactados conservan las cifras con las que se hicieron, así que eliminar un artículo nunca cambia un presupuesto enviado." },
        ],
      },
      {
        id: "what-each-field-changes",
        heading: "Qué cambia cada campo",
        blocks: [
          { table: {
            head: ["Campo", "Qué hace hoy"],
            rows: [
              ["Precio unitario", "La tarifa con la que aterriza la línea cuando agrega el artículo a un presupuesto. Aun así puede cambiarla en ese presupuesto."],
              ["Precio de costo", "Se guarda en el artículo y se incluye en la exportación CSV. Todavía no hay ningún presupuesto, cálculo de costos ni cifra de margen que lo lea — la tarjeta Costos de la pantalla lo dice."],
              ["Unidad", "Se imprime en la línea del presupuesto (pie², puerta, hora). Texto libre."],
              ["Disponible en estos tipos de presupuesto", "Filtra dónde se ofrece el artículo en el generador de presupuestos. Sin marcas significa en todas partes."],
              ["Tipo (Servicio / Producto)", "Una insignia en la lista y una columna en la exportación. No cambia el precio."],
            ],
          } },
          { p: "Los artículos de aquí aparecen en la tabla de partidas del generador de presupuestos para el tipo de presupuesto correspondiente, y el presupuesto toma el nombre y la descripción del artículo en su propio idioma cuando existe una traducción — ver [[lines-from-your-price-book|Líneas de su catálogo de precios]] y [[settings-translations|Traducciones]]." },
        ],
      },
      {
        id: "import-and-export",
        heading: "Importar y exportar",
        blocks: [
          { p: "**Importar CSV** acepta un .csv exportado de Excel, Google Sheets o Numbers con las columnas name, description, type, unitPrice, costPrice y unit; **Descargar archivo de ejemplo** le da un ejemplo de una línea para empezar. Los artículos importados conservan el idioma en que se escribieron — nada se traduce al subir. **Exportar CSV** descarga toda la lista, precios de costo incluidos." },
          { tip: "**Agregar artículos estándar a Productos y servicios**, en la pantalla Servicios y precios, vuelca en esta lista los complementos habituales de un oficio (bisagras, manijas, correderas de cajón para la ebanistería), ya vinculados a ese tipo de presupuesto. Edite sus precios aquí después." },
        ],
      },
      {
        id: "who-can-see-it",
        heading: "Quién puede verlo",
        blocks: [
          { p: "Un catálogo de precios son precios, así que la fila y la lista se muestran solo a los miembros cuya cuadrícula de acceso tiene **showPricing** activado — los niveles Estimador, Despachador y Gerente, más propietarios y administradores. La Cuadrilla no lo ve. Agregar, editar, eliminar e importar se rechazan a cualquiera que no sea propietario o administrador." },
        ],
      },
    ],
    faq: [
      { q: "¿Dónde defino la tarifa por puerta o por pie cuadrado de mi oficio?", a: "En Servicios y precios, en el tarifario del oficio. Esta pantalla es para los extras que agrega encima." },
      { q: "¿El precio de costo alimenta mi margen en un presupuesto?", a: "Todavía no. Se almacena y se exporta, y la pantalla dice que nada lo lee. El margen de un presupuesto sale de Costos de materiales y Gastos generales." },
      { q: "Si elimino un artículo, ¿un presupuesto antiguo pierde la línea?", a: "No. El presupuesto conserva la descripción y el precio con los que se hizo." },
    ],
  },

  "settings-services": {
    title: "Servicios y precios",
    summary:
      "Active los tipos de presupuesto que ofrece, defina por qué cobra cada uno, personalice el tarifario y el texto que lee un cliente para cada oficio, y agregue sus propios tipos de presupuesto.",
    updated: "2026-09-12",
    intro: [
      "**Configuración → Servicios y precios → Servicios y precios** decide qué vende su empresa y a qué tarifa. Cada tipo de presupuesto que activa aquí se convierte en una opción cuando alguien empieza un presupuesto nuevo; su tarifario construye las líneas base del presupuesto; su texto es lo que el cliente lee encima de los precios.",
      "Las tarifas de esta pantalla nunca salen de ella. Los puntos de acceso públicos de autopresupuesto y de reservas devuelven sus servicios y sus preguntas de admisión, nunca un precio — así que la lista que un competidor puede ver es la de lo que usted hace, no la de lo que cobra.",
    ],
    sections: [
      {
        id: "overview",
        heading: "Qué hay en la pantalla",
        blocks: [
          { p: "Arriba a la derecha, **Agregar tipo de presupuesto personalizado**. Luego una casilla **Buscar servicios** y, si su sector acota la lista, **+ Mostrar servicios de otros oficios** para ver todo el catálogo. Debajo, una tarjeta por tipo de presupuesto con una casilla para activarlo. Un tipo que creó usted mismo lleva una insignia **Personalizado** y lista sus campos de admisión (o **Sin campos — solo tarifa fija**)." },
          { figure: "live:app-settings-services", caption: "Configuración → Servicios y precios — una tarjeta por tipo de presupuesto; un oficio activado muestra por qué se cobra, su tarifario y su texto." },
          { p: "Un oficio activado con catálogo de precios integrado muestra etiquetas **Se cobra por** (por puerta, por frente de cajón, por pie²) y, donde aplica, **Las tarifas cambian según la complejidad elegida en el presupuesto** con los niveles de complejidad. Un oficio sin catálogo de precios muestra en su lugar una simple casilla **Tarifa** y una unidad **por**. Algunos oficios muestran además **Hay una cotización instantánea disponible para esto — configúrala** o **Los propietarios pueden obtener un precio instantáneo para esto**, con enlace a [[settings-instant-quotes|Cotizaciones instantáneas]], y un botón **Agregar artículos estándar a Productos y servicios**." },
        ],
      },
      {
        id: "switch-on-and-price",
        heading: "Cómo activar un oficio y definir sus tarifas",
        blocks: [
          { steps: [
            "Marque la casilla en la tarjeta del oficio.",
            "Para un oficio de una sola cifra, escriba la **Tarifa** y la unidad **por**. El número gris que ya está en la casilla es el valor predeterminado de FieldQuo; dejarla en blanco sigue heredando ese valor.",
            "Para un oficio con catálogo de precios, abra **Tarifario** y cambie solo los campos que usted cotiza distinto. Un campo cambiado queda resaltado; **Restablecer al valor predeterminado** lo devuelve a heredar.",
            "Pulse **Guardar configuración** al pie. Todas las tarjetas de la página se guardan juntas.",
          ] },
          { note: "Los campos marcados **interno** en un tarifario nunca se imprimen para el cliente — un mínimo por trabajo, un recargo — solo mueven las cifras. En blanco significa heredar, nunca cero: vaciar un campo lo devuelve al valor integrado, que sigue mejorando con el tiempo; escribir el valor predeterminado lo deja fijado en la cifra de hoy." },
        ],
      },
      {
        id: "what-the-quote-says",
        heading: "Lo que dice el presupuesto",
        blocks: [
          { p: "Bajo cada oficio activado, **Lo que dice la cotización** contiene el texto que llevan sus presupuestos y PDF para él: **En qué consiste este servicio** (un párrafo impreso encima de los precios), **Qué incluye** (una línea por elemento, **Agregar una línea**) y **Cómo se desarrolla el trabajo** (pasos con un plazo opcional, **Agregar un paso**). Si no lo toca, hereda el texto predeterminado de FieldQuo para el oficio; vacíe un campo para volver a heredarlo." },
          { p: "Todo lo que siga entre [corchetes] en el texto predeterminado se retiene fuera de sus presupuestos hasta que lo complete — un cliente nunca ve un corchete — y el panel nombra lo que está retenido. Ese mismo texto es el que imprime el correo del presupuesto; ver [[settings-quote-email|Correo de presupuesto]]." },
        ],
      },
      {
        id: "custom-quote-types",
        heading: "Agregar un tipo de presupuesto personalizado",
        blocks: [
          { steps: [
            "Pulse **Agregar tipo de presupuesto personalizado**.",
            "Póngale nombre (**p. ej. Organización de clósets**) y marque los campos que debe pedir en un presupuesto, elegidos entre los campos que ya usan los demás tipos de presupuesto de FieldQuo — búsquelos con **Buscar campos…**.",
            "Pulse **Crear tipo de presupuesto**. Se crea de inmediato, activado, y se comporta como un artículo de tarifa fija si no eligió ningún campo.",
          ] },
          { figure: "create:app-settings-services-create", caption: "Agregar tipo de presupuesto personalizado — un nombre y los campos de admisión que pedirá el presupuesto." },
        ],
      },
      {
        id: "who-can-see-it",
        heading: "Quién puede verlo",
        blocks: [
          { p: "La fila se muestra a los miembros con **showPricing** en su cuadrícula de acceso — Estimador, Despachador, Gerente, propietario, administrador. Cualquier otra persona que llegue a la página ve la lista con las tarifas retenidas y el aviso **Los precios están ocultos según tu nivel de acceso. Pídeselo a un propietario o administrador si necesitas verlos.** Guardar, crear un tipo personalizado y volcar los artículos estándar se rechazan a todos menos a un propietario o administrador." },
        ],
      },
    ],
    faq: [
      { q: "Cambié una tarifa — ¿cambian mis presupuestos enviados?", a: "No. Un presupuesto se cotiza cuando se arma. Los presupuestos nuevos usan la tarifa nueva; los existentes conservan la suya." },
      { q: "¿Por qué ya no hay opción de fija / por hora / por unidad?", a: "Era un ajuste que nada leía, así que se quitó. Un oficio con catálogo de precios declara su propia base; uno sin él es una tarifa más una unidad, y ambas se usan cuando se genera una línea." },
      { q: "¿Puede un propietario ver estas tarifas?", a: "No. Los puntos de acceso públicos devuelven servicios y campos de admisión, nunca precios." },
    ],
  },

  "settings-material-costs": {
    title: "Costos de materiales",
    summary:
      "Sus precios reales por galón, rendimientos, número de manos y consumibles para los oficios que cotizan por receta, y el umbral a partir del cual un trabajo terminado le pide revisarlos.",
    updated: "2026-09-12",
    intro: [
      "**Configuración → Servicios y precios → Costos de materiales** contiene las cifras detrás de la estimación interna de Costo y margen de un presupuesto: lo que le cuesta un galón de imprimación, cuánto rinde, cuántas manos da de verdad, lo que cuesta un rollo de cinta. Es lo que usted paga, separado de lo que cobra, y un cliente nunca ve nada de esto.",
      "La fila existe solo para los oficios que cotizan así. Hoy son **Restauración de gabinetes** y **Pintura exterior**: active uno de ellos en Servicios y precios y la fila aparece; si no, la página dice **Aquí todavía no hay nada que configurar.**",
    ],
    sections: [
      {
        id: "overview",
        heading: "Qué hay en la pantalla",
        blocks: [
          { p: "Primero una tarjeta, **Cuándo preguntar si revisar tus costos**, con un solo número y un botón **Guardar**. Luego una tarjeta de receta por oficio aplicable, cada una con una insignia **Personalizado** o **Predeterminado**, un enlace **Restablecer valores predeterminados**, sus campos, un bloque **Consumibles** y su propio **Guardar**." },
          { figure: "live:app-settings-material-costs", caption: "Configuración → Costos de materiales — el umbral de revisión de costos, luego una tarjeta de receta por oficio con rendimiento, costo por galón, número de manos y consumibles." },
        ],
      },
      {
        id: "the-recipe",
        heading: "Qué cambian los campos de la receta",
        blocks: [
          { p: "Cada presupuesto cuenta sus propias puertas y cajones, o su propia superficie, y los pasa por estas tasas: galones necesarios = área × manos ÷ rendimiento, así que subir las manos de imprimación de 2 a 3 cuesta un 50 % más de material sin ningún otro cambio. No hay en ninguna parte un ajuste de pequeño / mediano / grande — la cantidad es siempre el número escrito en ese presupuesto." },
          { table: {
            head: ["Oficio", "Campos"],
            rows: [
              ["Restauración de gabinetes", "Manos de imprimación (especies estándar, y roble/fresno/nogal americano/pino/termolaminado), manos de acabado, rendimiento de la imprimación y del acabado (pie²/gal) y costo ($/gal), endurecedor como % del acabado y su costo por cuarto de galón, horas de montaje / desmontaje por trabajo, horas por puerta, horas base de preparación de superficies."],
              ["Pintura exterior", "Tasa de producción de paredes (pie²/h), rendimiento de la pintura de pared, manos por defecto, costo de la pintura de molduras, tasa de producción y rendimiento de molduras (pies lineales), horas de montaje — y **Costo de pintura de pared por nivel ($/gal)** para Económica, Estándar y Premium."],
            ],
          } },
          { p: "Los **Consumibles** — cinta de pintor, film de enmascarar, papel de lija — llevan un costo por rollo (un rollo entero, no por puerta) y cuántas puertas y cajones cubre un rollo. Bajo cada uno, la página resuelve el ejemplo de una cocina de 24 puertas y 8 cajones con sus propias cifras, para que pueda comprobar un número antes de guardarlo." },
          { warning: "**Restablecer valores predeterminados** elimina cada número que ingresó para ese oficio y vuelve a poner las cifras iniciales de FieldQuo. Pregunta antes, porque no hay deshacer y nada más guarda una copia." },
        ],
      },
      {
        id: "revision-threshold",
        heading: "Cuándo un trabajo terminado le pide revisar",
        blocks: [
          { p: "**Preguntar si revisar los costos cuando un trabajo supera su estimación en más de** es un número entero de 0 a 100, **15** por defecto. Cuando el costo real de un trabajo terminado supera al menos en ese porcentaje lo que presupuestó, el cierre muestra la comparación y pregunta si actualizar sus tarifas según el costo real — o dejarlas. Un trabajo que salió por debajo nunca pregunta, y cada trabajo pregunta una sola vez. Póngalo en 0 para que le pregunte ante cualquier exceso." },
          { tip: "Las sugerencias que ofrece el cierre se escriben de vuelta en estas tarjetas de receta y en el tarifario de Servicios y precios — por eso el umbral vive en esta pantalla. Ver [[job-costing|Costeo de trabajos]]." },
        ],
      },
      {
        id: "who-can-see-it",
        heading: "Quién puede verlo",
        blocks: [
          { p: "Esta es la base de costos de la empresa, así que necesita tanto el permiso **user:manage** como el interruptor **jobCosting**: propietarios, administradores y el nivel Gerente. Un Despachador tiene el primero pero no el segundo y no ve la fila. Todo lo de aquí alimenta solo la estimación interna — ver [[cost-and-margin-on-a-quote|Costo y margen en un presupuesto]]." },
        ],
      },
    ],
    faq: [
      { q: "¿Dónde defino cuánto material usa un trabajo pequeño, mediano o grande?", a: "En ninguna parte — ese ajuste no existe. Cada presupuesto usa su propio número de puertas o su propia superficie con estas tasas." },
      { q: "Mi oficio no está en la lista. ¿Dónde están sus costos de materiales?", a: "Hoy solo Restauración de gabinetes y Pintura exterior tienen receta. Los demás oficios cotizan desde su tarifario y el catálogo de precios sin una estimación de materiales." },
      { q: "¿Un cliente ve alguna vez estas cifras?", a: "No. Solo dan forma al panel interno de Costo y margen; el presupuesto muestra sus precios." },
    ],
  },

  "settings-cabinet-rates": {
    title: "Precios de gabinetes",
    summary:
      "Lo que el diseñador de cocinas cobra por la ebanistería — por pie lineal o costo más margen del material, nivel por nivel, con multiplicadores de material, acabado, entrega y demolición.",
    updated: "2026-09-12",
    intro: [
      "**Configuración → Servicios y precios → Precios de gabinetes** es el tarifario desde el que cotiza el diseñador de cocinas. Cada cocina que un cliente diseña se cotiza en el servidor a partir de estas cifras, así que cambiarlas cambia lo que cuestan los diseños nuevos — y nunca toca un presupuesto que ya envió.",
      "La pantalla viene con tarifas iniciales que salieron de un taller de gabinetes real, y lo dice en un aviso ámbar: **Estas son tarifas iniciales, no las tuyas.** Son lo bastante creíbles como para pasar desapercibidas, y justo por eso debería definir las suyas antes de enviar un presupuesto de cocina.",
    ],
    sections: [
      {
        id: "overview",
        heading: "Qué hay en la pantalla",
        blocks: [
          { p: "Cuatro tarjetas. **Cómo fijas el precio de un gabinete** elige entre **Por pie lineal** y **Costo más margen del material**, y la segunda tarjeta cambia con esa elección. Luego **Multiplicadores de material** y **Acabado, entrega y demolición**. Al pie, **Guardar precios**, y — una vez guardadas las suyas — **Volver a las tarifas iniciales**." },
          { figure: "live:app-settings-cabinet-rates", caption: "Configuración → Precios de gabinetes — el modo de cotización, los niveles por pie lineal, los multiplicadores de material y los cargos de acabado." },
        ],
      },
      {
        id: "the-two-modes",
        heading: "Por pie lineal o costo más margen",
        blocks: [
          { table: {
            head: ["Modo", "Cómo se cotiza un gabinete", "Campos"],
            rows: [
              ["Por pie lineal", "Su ancho en pies × la tarifa de su nivel, ajustado según el material de la puerta y de la caja. Así cotizan los talleres a medida.", "**Base**, **Pared / superior**, **Alta / despensa**, **Isla**, un **Recargo por cajón** por cajón, tarifas opcionales de **Carpintería de clóset** y **Mueble de lavabo / fregadero de lavandería** (en blanco se cobran a sus tarifas de cocina), y la casilla **La instalación está incluida en la tarifa**."],
              ["Costo más margen del material", "Un costo base más una cifra por pulgada para la caja, con margen, y la instalación cobrada aparte.", "Un costo base y una cifra por pulgada para cada uno de Base, Pared, Alta e Isla, un **Margen** (0.18 = 18 % sobre el material) e **Instalación por caja**."],
            ],
          } },
          { p: "**La instalación está incluida en la tarifa** importa: desactivada, cada presupuesto de cocina gana una línea de instalación aparte. No hay una tarifa de instalación por pie lineal en la pantalla porque nada en el diseñador cobra la instalación así — una casilla que guardara un número y cotizara por caja de todos modos sería un control muerto." },
        ],
      },
      {
        id: "multipliers-and-extras",
        heading: "Multiplicadores de material y extras",
        blocks: [
          { bullets: [
            "Los **Multiplicadores de material** se aplican al precio del gabinete por material de puerta y por material de caja: 1.0 es su referencia, 1.4 significa que el roble blanco cuesta un 40 % más que ella. El **Recargo por esquina** se suma a las cajas de esquina, que dan más trabajo del que sugiere su ancho.",
            "**Acabado — por puerta** y **por frente de cajón**, **Entrega** (fijo) y **Retirar los gabinetes viejos** (por caja) se cobran por pieza y se activan o desactivan por diseño dentro del diseñador.",
          ] },
          { warning: "**Volver a las tarifas iniciales** elimina sus tarifas guardadas de inmediato, sin confirmación, y el aviso ámbar vuelve. Anote sus cifras antes de pulsarlo." },
        ],
      },
      {
        id: "who-can-see-it",
        heading: "Quién puede verlo",
        blocks: [
          { p: "La fila aparece solo cuando su empresa ha activado **Kitchen Design & New Installs** (diseño de cocinas e instalaciones nuevas) en Servicios y precios, o ya guardó sus propias tarifas. Leerla y cambiarla necesitan **user:manage** — propietarios, administradores y supervisores (los niveles Despachador y Gerente). El diseñador en sí se describe en [[the-kitchen-designer|El diseñador de cocinas]]." },
        ],
      },
    ],
    faq: [
      { q: "Cambié mis tarifas — ¿cambia el presupuesto de cocina que envié ayer?", a: "No. Los diseños se cotizan cuando se hacen; las tarifas nuevas se aplican a los diseños nuevos." },
      { q: "¿Por qué Precios de gabinetes no está en mi menú Configuración?", a: "Solo aparece para las empresas con Kitchen Design & New Installs activado. Active ese tipo de presupuesto en Servicios y precios." },
    ],
  },

  "settings-overhead": {
    title: "Gastos generales",
    summary:
      "Todo lo que cuesta mantener el negocio funcionando en un mes — costos fijos, salarios, deuda, activos — y el precio mínimo que un trabajo tiene que alcanzar para cubrirlo.",
    updated: "2026-09-12",
    intro: [
      "**Configuración → Servicios y precios → Gastos generales** es donde anota lo que cuesta su empresa gane o no un trabajo: el alquiler, el seguro, su propio retiro, el préstamo de la camioneta, el equipo de pintura que algún día reemplazará. Dividido entre cuántos trabajos puede asumir, eso se convierte en el precio más bajo al que puede salir un trabajo y aun así cubrir el negocio.",
      "Esa cifra — **Precio mínimo** — es la que un contratista más quiere y menos veces tiene. También alimenta el panel de Costo y margen de cada presupuesto como gastos generales reales por trabajo, en lugar de un porcentaje adivinado.",
    ],
    sections: [
      {
        id: "overview",
        heading: "Qué hay en la pantalla",
        blocks: [
          { p: "De arriba abajo: **Tu precio mínimo** (dos casillas y cuatro mosaicos), **Horas pagadas que nunca llegaron a un trabajo**, y luego cinco registros — **Costos fijos**, **Salarios**, **Deuda**, **Activos y depreciación** y **Facturas por pagar**." },
          { figure: "live:app-settings-overhead", caption: "Configuración → Gastos generales — Trabajos por semana y Margen objetivo, los cuatro mosaicos, luego los registros que los alimentan." },
        ],
      },
      {
        id: "your-minimum-price",
        heading: "Su precio mínimo",
        blocks: [
          { steps: [
            "Ingrese **Trabajos por semana** — cuántos trabajos puede asumir su cuadrilla en una semana normal — y, si quiere, **Margen objetivo %** (en blanco significa el valor predeterminado de 20).",
            "Pulse **Guardar**. Los cuatro mosaicos se completan: **Costos fijos mensuales**, **Trabajos / mes**, **Costo por trabajo** y **Precio mínimo**.",
            "Lea la nota debajo: dice qué registros incluye el total, y suma la depreciación de sus activos y los intereses de sus préstamos.",
          ] },
          { p: "Trabajos por mes es trabajos por semana × 4.33; el costo por trabajo es el total mensual dividido entre eso; el precio mínimo es el costo por trabajo dividido entre (1 − margen). El mínimo cubre solo los gastos generales — los materiales y la mano de obra del trabajo concreto van encima. Las facturas por pagar no lo cambian: son flujo de caja, no costo." },
        ],
      },
      {
        id: "the-registers",
        heading: "Qué va en cada registro",
        blocks: [
          { table: {
            head: ["Registro", "Qué va ahí", "Qué cambia"],
            rows: [
              ["Costos fijos", "Alquiler, seguro, la factura del teléfono, suscripciones — un importe, semanal, mensual o anual.", "Se cuenta en el total mensual. Un pago único se guarda pero no se cuenta; la fila lo dice."],
              ["Salarios", "Solo gastos generales del negocio: su propio retiro, un sueldo de oficina, un contador por hora. No la tarifa de un miembro de la cuadrilla — sus horas ya se cargan a cada trabajo.", "Se cuenta en el total. Nunca se usan para pagarle a nadie; el pago sale de Gestionar equipo y Nómina."],
              ["Deuda", "Préstamos y financiaciones: capital, pago mensual, tasa de interés.", "Se cuenta en el total. Vinculada a un activo, solo cuentan los intereses, para que la camioneta no se cobre dos veces."],
              ["Activos y depreciación", "Cosas compradas una vez y usadas durante años, con lo que costaron, valor de reventa, vida útil y fecha de puesta en servicio.", "Su depreciación mensual se suma al total. Los vendidos o retirados dejan de cargar; use la acción de dar de baja en lugar de eliminar para conservar el historial."],
              ["Facturas por pagar", "Lo que se debe y aún no se ha pagado, con fecha de vencimiento, y **Marcar pagada**.", "Pendiente, sale este mes y vencida. Nada de aquí toca el precio mínimo."],
            ],
          } },
          { warning: "Eliminar una fila pregunta antes, porque el piso de precio cambia de inmediato y no hay deshacer. Para un activo, la confirmación sugiere marcarlo como dado de baja en su lugar, lo que conserva lo que ya le costó." },
        ],
      },
      {
        id: "unabsorbed-labour",
        heading: "Horas pagadas que nunca llegaron a un trabajo",
        blocks: [
          { p: "Este panel compara la semana que usted les garantiza a las personas con las horas que realmente registraron contra un trabajo, en los últimos 30 días, y valora la diferencia a su tarifa por hora. A propósito **no** se cuenta en el costo por trabajo ni en el precio mínimo — esos moverían cada presupuesto que escribe a partir de entradas de tiempo que nadie ha revisado todavía. Cuando falta una tarifa, dice que el total está incompleto en lugar de contar esas horas como gratis." },
        ],
      },
      {
        id: "who-can-see-it",
        heading: "Quién puede verlo",
        blocks: [
          { p: "Toda la pantalla es la base de costos de la empresa, así que necesita el interruptor **jobCosting** además de **user:manage**: propietarios, administradores y el nivel Gerente la ven; un Despachador no. Salarios necesita además la cuadrícula de nómina que le deja ver el pago de todos, y Facturas por pagar necesita acceso a los gastos de toda la empresa. El piso que produce se explica en [[overhead-and-your-minimum-price|Gastos generales y su precio mínimo]] y [[the-break-even-price|El precio de equilibrio]]." },
        ],
      },
    ],
    faq: [
      { q: "¿Por qué mi precio mínimo está «sin definir»?", a: "Trabajos por semana está vacío. El piso necesita una capacidad entre la que dividir; ingrese una y pulse Guardar." },
      { q: "¿Debo poner los sueldos de mis pintores en Salarios?", a: "No. Sus horas se cargan a cada trabajo como mano de obra. Salarios es solo para el pago de gastos generales — su retiro, la oficina, un contador." },
      { q: "¿Registrar una factura aquí la paga?", a: "No. Páguela como siempre y luego pulse Marcar pagada." },
    ],
  },

  "settings-custom-fields": {
    title: "Campos personalizados",
    summary:
      "Donde se definirán las casillas extra para clientes, propiedades, presupuestos, trabajos, facturas y miembros del equipo — marcado Próximamente, porque ningún registro las muestra todavía.",
    updated: "2026-09-12",
    intro: [
      "Un campo personalizado es una casilla extra para algo que FieldQuo no contempla — un código de puerta en una propiedad, un número de orden de compra en una factura, el vencimiento de una credencial en un miembro del equipo. **Configuración → Servicios y precios → Campos personalizados** es la pantalla donde se definen esas casillas.",
      "Hoy la pantalla lleva un panel **Próximamente**, y la frase bajo el título dice por qué: todavía nada muestra un campo personalizado en un registro de cliente, propiedad, presupuesto, trabajo, factura o equipo, así que las respuestas no se pueden rellenar. FieldQuo no dibuja un botón Agregar muerto sobre ese hueco.",
    ],
    sections: [
      {
        id: "overview",
        heading: "Qué hay en la pantalla",
        blocks: [
          { p: "Seis secciones — **Campos personalizados del cliente**, **Campos personalizados de la propiedad**, **Campos personalizados de la cotización**, **Campos personalizados del trabajo**, **Campos personalizados de la factura** y **Campos personalizados del equipo**. Cada una lista los campos definidos para ese tipo de registro con una insignia de tipo (Text, Number, Date, Checkbox o Dropdown, en inglés en pantalla) y **Obligatorio** donde se marcó. Una sección sin ninguno dice, por ejemplo, «Registra los detalles del cliente agregando un campo personalizado»." },
          { figure: "live:app-settings-custom-fields", caption: "Configuración → Campos personalizados — el panel Próximamente, luego una sección por tipo de registro." },
        ],
      },
      {
        id: "what-works-today",
        heading: "Qué funciona hoy",
        blocks: [
          { bullets: [
            "Las definiciones que una empresa creó antes de que se retirara el control Agregar siguen listadas, y un propietario, administrador o supervisor todavía puede eliminar una con el icono de la papelera.",
            "**Agregar campo** no se muestra. Vuelve el día en que un formulario de registro muestre un campo personalizado, en el mismo cambio que quite el panel Próximamente.",
            "Nada de aquí tiene que ver con el correo. La línea bajo el título lo remite a [[settings-email-templates|Plantillas de correo]] para eso.",
          ] },
        ],
      },
      {
        id: "who-can-see-it",
        heading: "Quién puede verlo",
        blocks: [
          { p: "La fila necesita **user:manage** — propietarios, administradores y supervisores — porque definir un campo cambiaría cada registro de la empresa. Cuando la función se publique, los empleados verán la lista de solo lectura, ya que saber qué es «Código de puerta» y si es obligatorio le sirve a la persona que lo rellena." },
        ],
      },
    ],
  },

  "settings-quote-email": {
    title: "Correo de presupuesto",
    summary:
      "Las dos secciones opcionales del correo que lleva sus presupuestos — referencias de clientes anteriores y pares de fotos de antes y después — y la regla que impide que una vacía salga.",
    updated: "2026-09-12",
    intro: [
      "**Configuración → Documentos y plantillas → Correo de presupuesto** trata de lo que contiene el correo que lleva un presupuesto, más allá del presupuesto mismo. La mayor parte de ese correo no se configura aquí y no tiene interruptor: el alcance, lo que incluye, cómo se desarrolla el trabajo y qué podría cambiar el precio salen todos del presupuesto y del texto que edita por oficio en Servicios y precios. Si el presupuesto lo dice, el correo lo dice.",
      "Lo opcional es su propia prueba — las personas a las que un propietario puede llamar, y las fotos de trabajos que terminó. Esta pantalla contiene ambas, decide si van por defecto en cada presupuesto nuevo, y cada cambio se guarda a medida que lo hace.",
    ],
    sections: [
      {
        id: "overview",
        heading: "Qué hay en la pantalla",
        blocks: [
          { p: "Tres tarjetas. **Lo que el correo lleva siempre** es una lista simple sin controles, con un enlace a Servicios y precios, donde se edita ese texto. **Referencias** y **Antes y después** tienen cada una una casilla **Incluir en cada presupuesto nuevo**, una lista y un formulario para agregar. No hay botón Guardar; cada edición se guarda al instante y la página se vuelve a dibujar a partir de lo que realmente se almacenó." },
          { figure: "live:app-settings-quote-email", caption: "Configuración → Correo de presupuesto — lo que el correo lleva siempre, luego las tarjetas Referencias y Antes y después con sus casillas Incluir en cada presupuesto nuevo." },
        ],
      },
      {
        id: "references",
        heading: "Referencias",
        blocks: [
          { steps: [
            "En **Referencias**, escriba un **Nombre** y un **Teléfono** y pulse **Agregar**. Ambos son obligatorios — un nombre sin número no es una referencia — y se imprimen exactamente como los escriba.",
            "Marque **Incluir en cada presupuesto nuevo** para poner la lista en cada presupuesto nuevo por defecto.",
            "Use **Quitar** en una fila para sacar a alguien.",
          ] },
          { warning: "Ponga en la lista solo a personas que de verdad aceptaron estas llamadas. Su número llega a cada propietario al que le presupuesta. El correo imprime como máximo 6 referencias." },
        ],
      },
      {
        id: "before-and-after",
        heading: "Antes y después",
        blocks: [
          { steps: [
            "En **Antes y después**, pulse **Par nuevo — sube el antes y el después** y agregue una foto en cada uno de los espacios **Antes** y **Después**. Hacen falta las dos mitades.",
            "Agregue un **Pie de foto (opcional)** y marque **Incluir en cada presupuesto nuevo** si los pares deben salir por defecto.",
          ] },
          { p: "El correo imprime como máximo 4 pares — ocho imágenes ya son lentas en un teléfono en una entrada de garaje. Las subidas pasan por la misma subida firmada que su logotipo y sus fotos de trabajo." },
        ],
      },
      {
        id: "the-empty-section-rule",
        heading: "Qué hace una sección activada pero vacía",
        blocks: [
          { p: "Una sección activada sin nada dentro nunca debe llegar a un cliente. Así que FieldQuo bloquea el envío en su lugar: la página dice **Esto está activado y no tiene nada dentro. Hasta que agregues algo o lo desactives, no se pueden enviar presupuestos.**, y cuando alguien pulsa Enviar en un presupuesto recibe un cuadro que nombra la sección con dos botones — **Agregar contenido**, que lo trae aquí, y **Dejarlo fuera de esta cotización**." },
          { p: "Cada presupuesto puede además anular el valor por defecto. El panel **Secciones del correo** de un presupuesto muestra **Por defecto (activado)** o **Por defecto (desactivado)** para cada sección y permite activarla o desactivarla solo para ese presupuesto, o darle su propia lista. Ver [[references-and-photos-in-the-quote-email|Referencias y fotos de antes y después en el correo del presupuesto]]." },
        ],
      },
      {
        id: "who-can-see-it",
        heading: "Quién puede verlo",
        blocks: [
          { p: "La fila necesita **user:manage** — propietarios, administradores y supervisores. Cualquier otra persona que llegue a la página la ve de solo lectura con el aviso **Esto es lo que reciben tus clientes con cada presupuesto.** El correo que lo acompaña sale en el idioma del presupuesto, a nombre de su empresa." },
        ],
      },
    ],
    faq: [
      { q: "¿Puedo editar el resto del correo del presupuesto aquí?", a: "No. El alcance, lo incluido y los pasos salen del presupuesto y del texto por oficio de Servicios y precios; el diseño sale de Plantillas de correo solo para seguimientos y campañas. Esta pantalla es dueña de las dos secciones opcionales." },
      { q: "Marqué Incluir en cada presupuesto nuevo — ¿lo tendrán los presupuestos antiguos?", a: "No. Es el valor por defecto de los presupuestos nuevos. Un presupuesto existente conserva lo que diga su propio panel Secciones del correo." },
    ],
  },

  "settings-email-templates": {
    title: "Plantillas de correo",
    summary:
      "Plantillas de correo construidas por bloques y agrupadas en Automatizado, Marketing y Personalizado — qué ofrece el editor, qué envíos las usan realmente hoy, y qué cambia y qué no cambia la insignia Activo.",
    updated: "2026-09-12",
    intro: [
      "**Configuración → Documentos y plantillas → Plantillas de correo** lista cada plantilla de correo que tiene su empresa, agrupada según para qué sirve, con una por tipo marcada **Activo**. Cada plantilla se abre en un editor de bloques con una línea de asunto, su marca, campos de combinación, una vista previa en vivo y un botón para enviar una prueba.",
      "Lea la siguiente sección antes de construir una. Las plantillas las envían de verdad las **reglas de seguimiento** y las **campañas de correo**. La insignia Activo en los tipos automatizados de presupuesto y recibo no cambia lo que dice hoy un correo de presupuesto o de factura — esos salen del propio documento.",
    ],
    sections: [
      {
        id: "overview",
        heading: "Qué hay en la pantalla",
        blocks: [
          { p: "Arriba, **Agregar plantillas predeterminadas**, que crea una plantilla inicial para cada tipo automatizado que aún no tenga. Luego tres grupos — **Automatizado** (Quote email, Instructions email, Receipt / invoice email, Follow-up email — los tipos llevan su nombre en inglés), **Marketing** (Marketing email) y **Personalizado** — cada tipo con **Nueva plantilla** y su lista de plantillas. Una fila muestra el nombre, una insignia **Activo** en la que está en uso, una estrella para activar otra, e iconos de editar, duplicar y eliminar. Un tipo sin ninguna dice **Aún no hay plantillas: se usa la predeterminada integrada.**" },
          { figure: "live:app-settings-email-templates", caption: "Configuración → Plantillas de correo — Automatizado, Marketing y Personalizado, una plantilla Activo por tipo." },
        ],
      },
      {
        id: "which-sends-use-them",
        heading: "Qué envíos usan una plantilla",
        blocks: [
          { table: {
            head: ["Tipo de plantilla", "Usada por"],
            rows: [
              ["Follow-up email, Marketing email, Custom", "Las **reglas de seguimiento** — una regla elige una de estas al crearse, y el proceso programado de seguimiento renderiza sus bloques. Ver [[follow-up-rules|Reglas de seguimiento]]."],
              ["Marketing email, Custom", "Las **campañas de correo** de la pantalla Marketing — una campaña elige una plantilla y la envía a sus suscriptores. Ver [[email-campaigns-and-subscribers|Campañas de correo y suscriptores]]."],
              ["Quote email, Instructions email, Receipt / invoice email", "Nada todavía. Los correos reales de presupuesto y factura se construyen a partir del documento — su alcance, lo incluido y sus pasos — y del diseño en Plantillas PDF. Marcar una de estas como Activo mueve la insignia y no cambia ningún correo."],
            ],
          } },
          { note: "El texto del correo de presupuesto que SÍ puede cambiar vive en otra parte: por oficio en [[settings-services|Servicios y precios]], y las dos secciones opcionales en [[settings-quote-email|Correo de presupuesto]]." },
        ],
      },
      {
        id: "build-a-template",
        heading: "Cómo construir una",
        blocks: [
          { steps: [
            "Pulse **Nueva plantilla** bajo el tipo que necesite, póngale nombre y pulse **Crear y editar**.",
            "Defina el **Asunto** (los campos de combinación también funcionan ahí; en blanco usa el asunto integrado del tipo).",
            "En **Aspecto**, la plantilla empieza **Usando su marca**; cambie el acento, el encabezado y el fondo solo si quiere.",
            "Pulse **Agregar bloque** para agregar texto, imágenes, botones, separadores o un resumen, y arrastre los bloques para reordenarlos. Los campos de combinación insertan el nombre del cliente, el importe, etcétera.",
            "Revise la **Vista previa del correo** con datos de ejemplo, en móvil y en escritorio, y luego **Enviar una prueba** a su propia dirección.",
            "Pulse **Guardar**. De vuelta en la lista, pulse la estrella para hacerla la plantilla **Activo** de su tipo.",
          ] },
          { figure: "create:app-settings-templates-create", caption: "Nueva plantilla — póngale nombre, luego Crear y editar abre el editor de bloques." },
          { warning: "Eliminar es una eliminación definitiva con confirmación. Eliminar la plantilla Activo de un tipo devuelve ese tipo a la predeterminada integrada." },
        ],
      },
      {
        id: "who-can-see-it",
        heading: "Quién puede verlo",
        blocks: [
          { p: "Todos pueden leer las plantillas, pero cada control — crear, editar, activar, duplicar, eliminar, agregar las predeterminadas — necesita **user:manage**, así que la fila se muestra solo a propietarios, administradores y supervisores en lugar de dibujar botones que serían todos rechazados." },
        ],
      },
    ],
    faq: [
      { q: "Puse una plantilla Quote email como Activo y mi correo de presupuesto se ve igual. ¿Por qué?", a: "Porque el correo de presupuesto hoy no se renderiza desde una plantilla. Su texto sale del presupuesto y de Servicios y precios; las secciones opcionales, de Correo de presupuesto." },
      { q: "¿Las plantillas conservan mi logotipo y mi color?", a: "Sí. Una plantilla nueva empieza Usando su marca, desde Configuración → Marca, hasta que personalice su aspecto." },
      { q: "¿Dónde elijo qué plantilla usa un seguimiento?", a: "En la propia regla de seguimiento, en Configuración → Seguimientos. Solo se ofrecen las plantillas Follow-up, Marketing y Custom." },
    ],
  },

  "settings-pdf-templates": {
    title: "Plantillas PDF",
    summary:
      "El orden de las secciones de los PDF de presupuesto y factura que reciben sus clientes — un diseño en uso por documento, editable sección por sección, con una vista previa de ejemplo.",
    updated: "2026-09-12",
    intro: [
      "**Configuración → Documentos y plantillas → Plantillas PDF** es el diseño de los dos PDF que un cliente realmente recibe: el presupuesto adjunto cuando envía o descarga uno, y la factura adjunta a las facturas y solicitudes de pago. Una empresa que nunca abre esta pantalla igual obtiene un PDF completo con el diseño estándar; esta página existe para cambiar el orden de sus secciones o quitar una.",
      "Es hermana de Plantillas de correo, separada por medio: un PDF es una página con un orden de secciones fijo y sin botones; un correo se desplaza y tiene enlaces. Los dos se editan por separado a propósito.",
    ],
    sections: [
      {
        id: "overview",
        heading: "Qué hay en la pantalla",
        blocks: [
          { p: "Dos tarjetas, **PDF de cotización** y **PDF de factura**, cada una con un botón **Nuevo** y su lista de diseños. Un diseño muestra su nombre, cuántas secciones tiene y una insignia **Activo** en el que está en uso; los demás ofrecen **Use this** (el botón aparece en inglés en pantalla), más iconos de editar y eliminar. Una tarjeta sin diseños dice **Usando el diseño estándar. Sus PDF ya funcionan: cree uno solo si desea cambiar el orden o quitar una sección.** Si tiene diseños pero ninguno en uso, la tarjeta avisa de que los PDF siguen saliendo con el diseño estándar." },
          { figure: "live:app-settings-templates", caption: "Configuración → Plantillas PDF — las tarjetas PDF de cotización y PDF de factura, cada una con sus diseños y el marcado Activo." },
        ],
      },
      {
        id: "the-standard-layout",
        heading: "El diseño estándar",
        blocks: [
          { p: "Un presupuesto se lee, de arriba abajo: **Header** (encabezado), **Client details** (datos del cliente), **Line items** (partidas), **Totals** (totales), **How the work runs** (cómo se desarrolla el trabajo), **Payment terms** (condiciones de pago), **Notes** (notas), **Signature block** (bloque de firma), **Footer** (pie de página) — las secciones llevan su nombre en inglés en el editor. Los pasos van después del total a propósito — la vista del cliente va primero al precio, y la pregunta que sigue es si vale la pena. Una factura es un cobro y no un argumento de venta, así que su diseño estándar es Header, Client details, Line items, Totals, **Payments received** (pagos recibidos), Notes y Footer: sin pasos, sin firma. Las facturas reflejan a los presupuestos para que el cliente reconozca el segundo documento como gemelo del primero." },
        ],
      },
      {
        id: "make-a-layout",
        heading: "Cómo crear y usar un diseño",
        blocks: [
          { steps: [
            "Pulse **Nuevo** en la tarjeta PDF de cotización o PDF de factura, póngale nombre (el nombre es para usted — los clientes nunca lo ven) y elija **Empezar desde el diseño estándar** o **Copiar la actual**.",
            "En **Editar diseño**, la lista **Secciones, de arriba abajo** tiene **Mover hacia arriba**, **Mover hacia abajo** y **Quitar sección** en cada fila, y **Agregar una sección** para las que haya quitado. Si quita una que importa, el editor lo dice: el PDF se generará igual, pero no parecerá un documento terminado.",
            "Pulse **Vista previa con datos de ejemplo** y luego **Guardar**.",
            "De vuelta en la lista, pulse **Use this**. Desde entonces cada nuevo PDF de presupuesto (o factura) se renderiza con él.",
          ] },
          { warning: "Eliminar es permanente y pregunta antes. Eliminar el diseño marcado **actualmente en uso** devuelve cada PDF futuro al diseño estándar — un cambio en lo que reciben los clientes, desde una pantalla que parece simple orden." },
        ],
      },
      {
        id: "who-can-see-it",
        heading: "Quién puede verlo",
        blocks: [
          { p: "Cada control de aquí necesita **user:manage**, así que la fila se muestra a propietarios, administradores y supervisores. Los colores del PDF salen de su color de marca en [[settings-branding|Marca]], nunca de esta pantalla; lo que imprime cada sección se describe en [[the-quote-pdf|El PDF del presupuesto]]." },
        ],
      },
    ],
    faq: [
      { q: "¿Necesito un diseño para que mis PDF funcionen?", a: "No. Sin diseño, o sin ninguno en uso, los PDF usan el diseño estándar, que está completo." },
      { q: "¿Puedo cambiar el texto dentro de una sección?", a: "Aquí no. Esta pantalla ordena y quita secciones. Las palabras salen del presupuesto y del texto por oficio de Servicios y precios." },
    ],
  },

  "settings-translations": {
    title: "Traducciones",
    summary:
      "Revise y corrija los nombres y descripciones traducidos de sus productos y servicios, idioma por idioma, con borradores de IA que usted lee antes de que lleguen a un documento del cliente.",
    updated: "2026-09-12",
    intro: [
      "**Configuración → Documentos y plantillas → Traducciones** es el texto que los clientes ven en presupuestos y facturas escritos en otro idioma — el nombre y la descripción de cada artículo de su catálogo de precios, en inglés, francés o cualquier otro idioma que FieldQuo admita. Está dispuesto con el original junto a la traducción, una fila por artículo, porque el trabajo es comparar: no puede juzgar si «finish» es correcto sin «acabado» al lado.",
      "Nada se traduce automáticamente al momento de enviar. Un presupuesto conserva el idioma en que se creó, y un artículo aterriza en él con el texto revisado para ese idioma cuando existe — si no, el texto original, de modo que una traducción faltante produce una línea con aspecto inacabado, nunca una en blanco.",
    ],
    sections: [
      {
        id: "overview",
        heading: "Qué hay en la pantalla",
        blocks: [
          { p: "Un selector de idioma (cada idioma que FieldQuo admite salvo el de su propia empresa), un contador — **{count} aún faltan** o **Los {count} traducidos**, más **{count} en borrador, sin leer** — y el botón **Redactar los que faltan**. Debajo, una fila por producto o servicio con su texto original a la izquierda, las casillas de traducción a la derecha, un estado (**Sin traducir**, **En borrador — aún no leído**, **Revisado** con la fecha) y **Marcar como revisado**. Las filas que necesitan atención suben al principio." },
          { figure: "live:app-settings-translations", caption: "Configuración → Traducciones — el selector de idioma, el contador de faltantes, y el original junto a la traducción de cada artículo." },
        ],
      },
      {
        id: "how-to-translate",
        heading: "Cómo traducir su catálogo de precios",
        blocks: [
          { steps: [
            "Elija el idioma.",
            "Pulse **Redactar los que faltan**. Los borradores aterrizan en las casillas vacías, marcados **Borrador de IA: léelo antes de guardar**; todavía no se guarda nada. O escriba la traducción usted mismo.",
            "Lea cada fila contra el original. Corrija el vocabulario del oficio — «finish», «trim», «coat» y «run» significan una cosa en la obra y otra en un diccionario.",
            "Pulse **Marcar como revisado** en cada fila. Esa es la única acción que escribe algo, y desde entonces ese texto va a los documentos del cliente.",
          ] },
          { note: "Redactar consume su cuota de IA y se detiene cuando se agota, diciéndole cuántos quedan por hacer. Si la redacción automática no está activada en la instalación, la página lo dice y aun así puede escribir las traducciones." },
        ],
      },
      {
        id: "what-it-changes",
        heading: "Qué cambia una traducción revisada",
        blocks: [
          { bullets: [
            "Cuando un artículo del catálogo de precios se agrega a un presupuesto en ese idioma, la línea del presupuesto toma el nombre y la descripción traducidos. Un nombre traducido sin descripción traducida cae en la descripción original y sigue contando como faltante aquí.",
            "Los documentos enviados no se tocan. Corregir una traducción cambia las líneas nuevas, nunca un presupuesto que un cliente ya recibió — un PDF firmado sigue diciendo lo que decía.",
            "Los productos importados por CSV llegan en el idioma en que se escribieron y aparecen aquí como **Sin traducir** hasta que los redacte o los escriba.",
          ] },
          { p: "Los nombres de los propios oficios (los tipos de presupuesto) no se editan aquí; salen del catálogo de FieldQuo en cada idioma. Los idiomas en que envía documentos y el idioma de cada cliente se definen en [[settings-language|Idioma]] y en el cliente — ver [[choose-your-language|Elija su idioma, y el de su empresa]]." },
        ],
      },
      {
        id: "who-can-see-it",
        heading: "Quién puede verlo",
        blocks: [
          { p: "Guardar una traducción y redactar borradores necesitan **user:manage**, así que la fila se muestra a propietarios, administradores y supervisores. La lista lee el catálogo de precios, y por eso la página dice **Aún no hay servicios. Agrégalos en Configuración → Productos y servicios** cuando no hay nada que traducir." },
        ],
      },
    ],
    faq: [
      { q: "¿Un borrador se usa en los presupuestos antes de que lo revise?", a: "Un borrador hecho con Redactar los que faltan no se guarda hasta que pulsa Marcar como revisado, así que no. Solo el texto guardado llega a un documento." },
      { q: "¿Corregir una traducción cambiará un presupuesto que ya envié?", a: "No. Un documento conserva el texto con el que se creó." },
      { q: "¿Por qué no puedo elegir mi propio idioma en el selector?", a: "El idioma de origen es el predeterminado de su empresa; usted traduce desde él, no hacia él." },
    ],
  },

  "settings-checklists": {
    title: "Listas de verificación",
    summary:
      "Listas reutilizables de los pasos que su cuadrilla sigue en la obra, agrupadas en Antes del trabajo, En la obra y Antes de irte, copiadas en una visita como una lista nueva para marcar.",
    updated: "2026-09-12",
    intro: [
      "**Configuración → Documentos y plantillas → Listas de verificación** es donde anota, una sola vez, los pasos que su cuadrilla repite en cada trabajo — cubrir las encimeras, fotografiar antes, fotografiar después — en lugar de depender de que la gente los recuerde. Adjunte una lista a una visita de trabajo y pasa como una copia nueva para marcar; editar la copia después nunca cambia el original.",
      "Dos listas en la página, separadas a propósito: la de arriba es lo que escribió su empresa; la de abajo es la biblioteca de partida de FieldQuo por oficio. Tomar una de partida la copia en su propia lista en lugar de vincularla, porque lo primero que cualquiera hace con una lista de partida es cambiar una línea.",
    ],
    sections: [
      {
        id: "overview",
        heading: "Qué hay en la pantalla",
        blocks: [
          { p: "**Nueva lista de verificación** arriba a la derecha. Luego sus propias listas, cada una con su nombre, una insignia de fase (**Antes del trabajo**, **En la obra** o **Antes de irte**), su número de pasos y el servicio para el que es, con **Editar** y un icono de eliminar. Debajo, **Listas de partida para tus oficios** — escritas para los servicios que tiene activados — cada una con **Usar esta**. Cuando todavía no tiene ninguna, la página dice **Aún no hay listas de verificación**." },
          { figure: "live:app-settings-checklists", caption: "Configuración → Listas de verificación — sus propias listas con su fase y número de pasos, luego las listas de partida para sus oficios." },
        ],
      },
      {
        id: "write-a-checklist",
        heading: "Cómo escribir una",
        blocks: [
          { steps: [
            "Pulse **Nueva lista de verificación** (o **Usar esta** en una de partida para empezar desde una copia).",
            "Póngale nombre — el ejemplo sugiere **Renovación de cocina — día uno** — y elija **Para qué servicio**, o deje **Cualquier servicio**.",
            "Elija **En qué momento de la visita**: **Antes del trabajo** para la preparación del sitio y los materiales, **En la obra** para el trabajo en sí, **Antes de irte** para la limpieza y el recorrido con el cliente. Una visita agrupa su lista bajo estos encabezados.",
            "Complete los **Pasos**, uno por línea, con **Agregar paso** para más, y pulse **Crear** (o **Guardar cambios** al editar). Hacen falta un nombre y al menos un paso.",
          ] },
          { figure: "create:app-settings-checklists-create", caption: "Nueva lista de verificación — el nombre, el servicio, en qué momento de la visita aplica, y los pasos." },
        ],
      },
      {
        id: "how-it-reaches-a-visit",
        heading: "Cómo llega una lista a una visita",
        blocks: [
          { bullets: [
            "Cuando alguien crea una visita en un trabajo, el campo **Lista de verificación** es opcional: elija una o más y la cuadrilla recibe su propia copia para marcar.",
            "A una visita que ya existe se le puede aplicar una plantilla después desde el panel de lista de verificación de la visita.",
            "Nada se aplica por sí solo. La biblioteca de partida es un conjunto de sugerencias, y una lista que escribió se queda aquí hasta que alguien la adjunta. Marcarla ocurre en la visita, en el teléfono de la cuadrilla — ver [[checklists-on-site|Listas de verificación en la obra]]."
          ] },
          { warning: "Eliminar una lista aquí quita la plantilla. Las copias ya adjuntas a visitas son filas aparte y conservan sus pasos." },
        ],
      },
      {
        id: "who-can-see-it",
        heading: "Quién puede verlo",
        blocks: [
          { p: "Crear, editar y eliminar una lista es para propietarios, administradores y supervisores, así que la fila se les muestra a ellos. Leer las plantillas está abierto a todos a propósito: la pantalla de nueva visita y la lista de la visita leen la misma lista, y esas son exactamente las pantallas desde las que trabaja un miembro de la cuadrilla." },
        ],
      },
    ],
    faq: [
      { q: "Si cambio una lista, ¿cambian las visitas que ya la tienen?", a: "No. Cada visita guarda su propia copia. La edición se aplica a las visitas a las que se adjunte de aquí en adelante." },
      { q: "¿Un paso puede ser una lectura en vez de una marca?", a: "Un paso en esta pantalla es una línea de texto que la cuadrilla marca. Hoy no hay tipo de respuesta numérico ni de aprobado/reprobado en este formulario de configuración." },
      { q: "¿Por qué no veo listas de partida?", a: "Están escritas para los servicios que tiene activados en Servicios y precios. Active un oficio y aparecen sus listas de partida." },
    ],
  },
};
