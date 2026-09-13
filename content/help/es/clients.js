// content/help/es/clients.js
//
// Artículos de la categoría “clients” en español. Indexados por slug; los
// slugs son los de lib/help/tree.js y scripts/check-help-centre.mjs rechaza un
// módulo al que le falte uno o que lleve uno que el árbol no tiene.
//
// Misma estructura que content/help/en/clients.js (mismas secciones, mismos
// bloques, mismas figuras); las palabras en pantalla vienen del bloque `es`
// de app/i18n/appMessages.js.
export const ARTICLES = {
  "the-clients-list": {
    title: "La lista de clientes",
    summary:
      "Cada cliente de su empresa, como tarjeta con sus datos de contacto y el conteo de sus presupuestos y facturas — y los dos botones que agregan más.",
    updated: "2026-09-12",
    intro: [
      "**Clientes** es la cartera de clientes de la empresa. Cada propietario al que le ha hecho un presupuesto y cada empresa que lo contrata es una tarjeta aquí, y abrir una tarjeta lleva a los presupuestos, trabajos, facturas y equipos de ese cliente en un solo lugar. Está en el grupo **Personas** de la barra lateral, justo encima de **Equipos del cliente**.",
      "La lista es deliberadamente simple: un cuadro de búsqueda, las tarjetas y dos botones. No hay filtros, ni etiquetas, ni acciones en lote — el trabajo se hace en la ficha del cliente, no en la lista.",
    ],
    sections: [
      {
        id: "overview",
        heading: "Descripción general",
        blocks: [
          { p: "La página abre con el título **Clientes** y un conteo — “3 clientes en total.” — y luego el cuadro de búsqueda y las tarjetas, del cliente más reciente al más antiguo. El conteo solo se imprime cuando el servidor ha respondido; mientras la lista carga, o si no se pudo cargar, no se muestra ningún número en lugar de un “0” engañoso." },
          { p: "Dos botones están arriba a la derecha para quien puede agregar clientes: **Importar** carga un CSV desde lo que usaba antes (vea [[import-clients-from-a-csv|Importar clientes desde un CSV]]) y **Nuevo cliente** abre el formulario descrito en [[add-a-client|Agregar un cliente]]. Si no los ve, su nivel de acceso no incluye agregar clientes — vea más abajo." },
        ],
      },
      {
        id: "on-the-screen",
        heading: "Qué hay en la pantalla",
        blocks: [
          { bullets: [
            "**Buscar clientes...** — filtra las tarjetas mientras escribe, por nombre, correo o número de teléfono. Busca en lo que ya está cargado, así que es instantáneo.",
            "Una **tarjeta por cliente**: el nombre, una insignia **Empresa** cuando el cliente es una empresa, y luego la persona de contacto (para una empresa) o el correo (para un propietario).",
            "El **número de teléfono** y la **ciudad y provincia** — o la dirección de la calle cuando no hay ciudad registrada — cada uno con un ícono pequeño.",
            "Un pie que cuenta los **presupuestos** y las **facturas** de ese cliente, por ejemplo “3 cotizaciones · 1 factura”. Los trabajos no se cuentan en la tarjeta; se listan en la ficha.",
            "Una **flecha** en cada tarjeta: toda la tarjeta es un enlace a la ficha del cliente.",
            "Cuando nada coincide con su búsqueda, la página dice **Ningún cliente coincide con tu búsqueda.**; sin ningún cliente dice **Aún no hay clientes.** y ofrece **Agrega tu primer cliente**.",
          ] },
        ],
      },
      {
        id: "find-a-client",
        heading: "Cómo encontrar un cliente",
        blocks: [
          { steps: [
            "Abra **Clientes** en el grupo **Personas** de la barra lateral.",
            "Escriba parte del nombre, del correo o del número de teléfono en **Buscar clientes...**. Las tarjetas se reducen mientras escribe.",
            "Toque la tarjeta. La ficha del cliente se abre con sus datos, presupuestos, trabajos, facturas y equipos.",
          ] },
          { figure: "live:app-clients", caption: "Clientes — el conteo, el cuadro de búsqueda y una tarjeta con su correo, teléfono, ciudad y el conteo de presupuestos y facturas." },
          { tip: "Buscar por número de teléfono es la forma más rápida de encontrar a alguien que le devuelve la llamada. La búsqueda compara el número tal como está escrito en la ficha, así que escríbalo con los mismos guiones — “238-7263” encuentra “819-238-7263”." },
        ],
      },
      {
        id: "what-each-card-shows",
        heading: "Qué significa cada parte de una tarjeta",
        blocks: [
          { table: {
            head: ["En la tarjeta", "De dónde viene"],
            rows: [
              ["El nombre", "El nombre del cliente, o el nombre de la empresa para una empresa."],
              ["Insignia **Empresa**", "El cliente se creó como **Empresa / Contratista** en lugar de **Propietario**. Vea [[business-clients-and-contacts|Clientes empresa y su persona de contacto]]."],
              ["Segunda línea", "La persona de contacto para una empresa; el correo para un propietario. Vacía cuando no hay ninguno de los dos registrado."],
              ["Ciudad, Provincia", "La ciudad y la provincia de la ficha, unidas con una coma. Si la ficha tiene dirección pero no ciudad, se muestra la dirección de la calle."],
              ["“N cotizaciones · N facturas”", "Contado en vivo a partir de los presupuestos y facturas vinculados a este cliente. Cero se muestra como “0 cotizaciones”."],
            ],
          } },
        ],
      },
      {
        id: "who-can-see-it",
        heading: "Quién puede verla",
        blocks: [
          { p: "La fila **Clientes** aparece en la barra lateral para quien tenga el permiso **Clients and Properties** al menos en **View full client and property info**. Los perfiles Estimador, Despachador y Gerente lo tienen; el perfil Cuadrilla (**View client name and address only**) no, así que un miembro de la cuadrilla no recibe la lista de clientes, solo el nombre y la dirección de los trabajos a los que está asignado." },
          { bullets: [
            "**View full client and property info** — ve la lista y cada tarjeta, no puede agregar ni editar.",
            "**View and edit full client and property info** — ve también **Importar** y **Nuevo cliente**. Es el nivel del Estimador y del Despachador.",
            "**View, edit, and delete full client and property info** — el nivel del Gerente. Eliminar no se ofrece ni en esta lista ni en la ficha; vea las preguntas frecuentes.",
            "El servidor verifica el mismo permiso en cada solicitud, así que un marcador al formulario de nuevo cliente no salta un botón ausente.",
          ] },
        ],
      },
    ],
    faq: [
      { q: "¿Puedo ordenar o filtrar la lista?", a: "No. Las tarjetas van siempre del más reciente al más antiguo, y la única forma de acotar es el cuadro de búsqueda. Busque por nombre, correo o teléfono." },
      { q: "¿Por qué una tarjeta muestra 0 cotizaciones si ya le hice un presupuesto a esa persona?", a: "El presupuesto está vinculado a otra ficha de cliente — normalmente un duplicado creado desde un prospecto o una importación. Abra ambas fichas y vea [[duplicate-clients|Clientes duplicados]]." },
      { q: "¿Cómo elimino un cliente?", a: "Hoy no hay botón de eliminar ni en la lista ni en la ficha. Un cliente con algún presupuesto o factura nunca puede eliminarse, porque esos documentos quedarían huérfanos. Si tiene un cliente sin nada vinculado que necesita quitar, pídaselo a soporte." },
    ],
  },

  "add-a-client": {
    title: "Agregar un cliente",
    summary:
      "El formulario Nuevo cliente campo por campo — tipo de cliente, datos de contacto, dirección, país, idioma y notas — y los otros lugares donde se crea un cliente.",
    updated: "2026-09-12",
    intro: [
      "Una ficha de cliente es de lo que cuelgan un presupuesto, un trabajo y una factura. Puede crear una por sí sola desde la lista de clientes, o en el momento mientras escribe un presupuesto. De cualquier forma se guardan los mismos campos y se verifica el mismo permiso.",
    ],
    sections: [
      {
        id: "overview",
        heading: "Descripción general",
        blocks: [
          { p: "**Nuevo cliente** es un solo formulario. Solo el nombre es obligatorio; todo lo demás puede completarse después desde la ficha del cliente. Dos elecciones del formulario vale la pena hacerlas bien a la primera: el **Tipo de cliente**, que decide si la dirección es donde se hace el trabajo, y el **Language for their documents**, que decide el idioma de cada presupuesto, factura y correo que ese cliente reciba." },
        ],
      },
      {
        id: "how-to",
        heading: "Cómo agregar un cliente",
        blocks: [
          { steps: [
            "Abra **Clientes** y toque **Nuevo cliente** (o toque **Crear** arriba en la barra lateral y elija **Cliente**).",
            "Elija el **Tipo de cliente**: **Propietario** para un particular cuyos trabajos se hacen en su dirección, o **Empresa / Contratista** para una empresa cuyos sitios de trabajo varían. Una empresa recibe un campo adicional de **Persona de contacto**.",
            "Escriba el **Nombre** (o el **Nombre de la empresa**). Es el único campo obligatorio — el formulario se niega a guardar sin él.",
            "Agregue el **Teléfono** y el **Correo**. El correo se verifica al guardar: una dirección a la que no se puede entregar se rechaza nombrando el problema, porque cada presupuesto y cada factura irán a ella.",
            "Empiece a escribir en **Dirección** y elija la sugerencia. Elegir una completa la **Ciudad**, la **Provincia** y el **País** por usted; escrita a mano, complételos usted mismo.",
            "Configure el **Language for their documents** y las **Notas** si hace falta, y toque **Crear cliente**. La nueva ficha se abre de inmediato.",
          ] },
          { figure: "create:app-clients-create", caption: "Nuevo cliente — la elección del tipo de cliente, los campos de contacto, la dirección con su ciudad, provincia y país, el selector de idioma y el cuadro de notas." },
          { note: "El campo **País** empieza en **Sin definir**, y FieldQuo no lo adivina a partir del país de su propia empresa. Es la clave de la búsqueda del impuesto sobre las ventas — “ON” puede ser Ontario o un error de tipeo — así que un cliente sin país cae en la tasa de impuesto predeterminada de su empresa hasta que alguien lo defina. Elegir la dirección entre las sugerencias lo define automáticamente." },
        ],
      },
      {
        id: "fields",
        heading: "Qué hace cada campo",
        blocks: [
          { table: {
            head: ["Campo", "Qué cambia"],
            rows: [
              ["**Tipo de cliente**", "**Propietario**: la dirección es el sitio del trabajo. **Empresa / Contratista**: la dirección es su oficina y cada trabajo lleva su propia **Dirección del sitio**. También agrega la insignia **Empresa** en la lista."],
              ["**Nombre** / **Nombre de la empresa**", "Obligatorio. Impreso en cada presupuesto, factura y correo."],
              ["**Persona de contacto**", "Solo clientes empresa — la persona con la que trata allí. Se muestra bajo el nombre de la empresa en la lista y en la ficha."],
              ["**Teléfono**", "Se formatea mientras escribe. Se usa para los mensajes de texto de recordatorio de cita y “en camino”, y para llamar con un toque en la lista de llamadas de equipos."],
              ["**Correo**", "Adonde se envían presupuestos, facturas, el enlace del portal y las solicitudes de reseña. Se valida al guardar; déjelo vacío para un cliente que es solo un número de teléfono."],
              ["**Dirección**, **Ciudad**, **Provincia**", "Se muestran en la tarjeta y en la ficha. Para un propietario, es adonde va la cuadrilla."],
              ["**País**", "Alimenta la búsqueda del impuesto sobre las ventas junto con la provincia. Vea [[sales-tax-on-invoices|Impuesto sobre las ventas en las facturas]]."],
              ["**Language for their documents**", "El idioma de cada documento y correo para este cliente. **Company default** sigue la configuración de su empresa. Vea [[a-clients-language|El idioma de un cliente]]."],
              ["**Notas**", "Texto libre solo para su equipo — nunca se imprime en un documento. Vea [[client-notes|Notas del cliente]]."],
            ],
          } },
        ],
      },
      {
        id: "other-ways",
        heading: "Los otros lugares donde se crea un cliente",
        blocks: [
          { bullets: [
            "**Mientras escribe un presupuesto.** El selector de cliente del constructor de presupuestos tiene un formulario de nuevo cliente con los mismos campos, idioma incluido, para que nunca tenga que abandonar un presupuesto a medio escribir. Vea [[build-a-quote|Armar un presupuesto]].",
            "**Cuando un prospecto se convierte en presupuesto.** Convertir un prospecto crea el cliente a partir del nombre, correo, teléfono y dirección del prospecto — después de verificar primero si ya existe un cliente con ese correo o ese teléfono. Vea [[convert-a-lead-to-a-quote|Convertir un prospecto en presupuesto]].",
            "**Desde un CSV.** **Importar** en la lista de clientes crea un cliente por cada fila con nombre. Las filas con un correo no entregable se omiten y se cuentan. Vea [[import-clients-from-a-csv|Importar clientes desde un CSV]].",
          ] },
        ],
      },
      {
        id: "who-can-add",
        heading: "Quién puede agregar un cliente",
        blocks: [
          { p: "Crear un cliente requiere **Clients and Properties** en **View and edit full client and property info** o superior — los perfiles Estimador, Despachador y Gerente. Por debajo de eso, el botón **Nuevo cliente** no aparece, y el formulario mismo rechaza con un panel de sin acceso a quien llegue por un marcador. Cada cliente nuevo se anota en el [[the-activity-log|Registro de actividad]] con quién lo agregó." },
        ],
      },
    ],
    faq: [
      { q: "¿El cliente recibe un correo cuando lo agrego?", a: "No. Crear una ficha no envía nada. Lo primero que un cliente recibe de usted es el primer presupuesto, factura o reserva que le envíe." },
      { q: "Elegí el tipo de cliente equivocado. ¿Puedo cambiarlo?", a: "Sí — toque **Editar** en la ficha y elija el otro tipo. Pasar una empresa de vuelta a Propietario borra la persona de contacto." },
      { q: "¿Por qué se rechazó el correo?", a: "No se puede entregar a esa dirección — falta el dominio, hay un error como una doble @, o un espacio adentro. Corríjala o déjela vacía; un correo vacío está permitido." },
    ],
  },

  "the-client-record": {
    title: "La ficha del cliente",
    summary:
      "Una página por cliente: sus datos de contacto y su idioma, botones rápidos para un nuevo presupuesto o trabajo, sus equipos instalados, y cada presupuesto, trabajo y factura que tiene.",
    updated: "2026-09-12",
    intro: [
      "Toque cualquier tarjeta de la lista de clientes y llega a la ficha del cliente. Es la página que hay que abrir cuando un cliente llama: quién es, cómo contactarlo, qué hay instalado en su propiedad, y qué le ha presupuestado, programado y facturado, cada elemento un enlace al documento mismo.",
    ],
    sections: [
      {
        id: "overview",
        heading: "Descripción general",
        blocks: [
          { p: "La ficha es de solo lectura hasta que toca **Editar**, que abre la hoja **Editar cliente** con los mismos campos que el formulario de nuevo cliente. Todo lo demás en la página es un enlace hacia afuera: los presupuestos se abren en el constructor de presupuestos, los trabajos en la página del trabajo, las facturas en la factura. Nada se envía desde esta página y nada en ella cambia un documento." },
        ],
      },
      {
        id: "on-the-screen",
        heading: "Qué hay en la pantalla",
        blocks: [
          { bullets: [
            "**Volver a clientes**, luego el nombre del cliente con una insignia **Propietario** o **Empresa / Contratista**, y el botón **Editar** a la derecha.",
            "La **tarjeta de contacto**: la persona de contacto (clientes empresa, marcada “persona de contacto”), el teléfono, el correo, la dirección (marcada “oficina” para una empresa), el idioma del cliente — “Predeterminado de la empresa (Español) · documentos y correos” cuando sigue el predeterminado — y las notas, separadas por una línea.",
            "Para una empresa, la línea **Los sitios de trabajo varían para los contratistas — cada cotización o trabajo lleva su propia ubicación.**",
            "**Nueva cotización** y **Nuevo trabajo** — acciones rápidas que abren el constructor con este cliente ya elegido.",
            "**Equipos y garantías** — lo que está instalado en esta propiedad y si todavía tiene cobertura. Vea [[client-equipment-and-warranties|Equipos del cliente y garantías]].",
            "**Cotizaciones (n)**, **Trabajos (n)** y **Facturas (n)** — una fila por documento, del más reciente al más antiguo: el número y total del presupuesto, el título del trabajo y su chip de estado, el número y total de la factura. Cada fila es un enlace. Una lista vacía dice **Aún no hay cotizaciones.**, **Aún no hay trabajos.** o **Aún no hay facturas.**",
            "Si una línea dice **Oculto según tu nivel de acceso**, el servidor quitó el teléfono, el correo, la persona de contacto y las notas antes de que la página cargara — eso es una restricción, no un dato faltante.",
          ] },
        ],
      },
      {
        id: "edit",
        heading: "Cómo editar un cliente",
        blocks: [
          { steps: [
            "Toque **Editar** arriba a la derecha de la ficha.",
            "Cambie el tipo, nombre, persona de contacto, correo, teléfono, dirección, país, notas o idioma en la hoja **Editar cliente**. El campo de dirección ofrece sugerencias, y elegir una vuelve a completar la ciudad, la provincia y el país.",
            "Toque **Guardar cambios**. La hoja se cierra y la ficha se recarga con los valores nuevos.",
            "Si el correo se cambió a uno no entregable, el guardado se rechaza nombrando el problema; dejarlo vacío está permitido.",
          ] },
          { note: "Cambiar el correo o la dirección cambia adónde se entrega cada presupuesto y factura futuros de este cliente. Cada edición de ese tipo se anota en el [[the-activity-log|Registro de actividad]] con los nombres de los campos cambiados, pero no los valores anteriores." },
        ],
      },
      {
        id: "quick-actions",
        heading: "Nueva cotización y Nuevo trabajo",
        blocks: [
          { p: "Los dos botones bajo la tarjeta de contacto son el camino más corto de una llamada telefónica a un documento. Cada uno abre el constructor correspondiente con este cliente seleccionado, de modo que el nombre, la dirección y el idioma ya están en su lugar." },
          { bullets: [
            "**Nueva cotización** aparece solo si su permiso **Quotes** permite crear una. El presupuesto adopta el idioma guardado del cliente. Vea [[build-a-quote|Armar un presupuesto]].",
            "**Nuevo trabajo** aparece solo si su permiso **Jobs** permite crear uno. Un trabajo para un cliente empresa tiene su propio campo **Dirección del sitio**. Vea [[create-a-job|Crear un trabajo]].",
          ] },
        ],
      },
      {
        id: "who-can-see-it",
        heading: "Quién ve qué",
        blocks: [
          { p: "La ficha se ajusta a su nivel de **Clients and Properties** antes de salir del servidor, y los presupuestos y facturas que contiene se despojan de sus precios para quien no tenga **See prices**." },
          { table: {
            head: ["Su nivel", "Qué recibe"],
            rows: [
              ["**View client name and address only** (Cuadrilla)", "Nombre, tipo y dirección. Teléfono, correo, persona de contacto, notas e idioma se quitan, y la página lo dice. Sin panel de equipos, sin Editar."],
              ["**View full client and property info**", "Toda la ficha y el panel de equipos. Sin botón Editar; Nueva cotización y Nuevo trabajo dependen de sus permisos Quotes y Jobs, no de este."],
              ["**View and edit full client and property info** (Estimador, Despachador)", "Editar, más agregar y editar equipos y registrar visitas de servicio."],
              ["**View, edit, and delete full client and property info** (Gerente)", "Lo mismo, más eliminar un registro de equipo. Eliminar el cliente mismo no se ofrece en la pantalla."],
            ],
          } },
        ],
      },
    ],
    faq: [
      { q: "¿Dónde está el enlace del portal del cliente?", a: "No en esta página. El enlace del portal se envía al cliente con sus correos de factura y de presupuesto; vea [[the-client-portal|El portal del cliente]]." },
      { q: "¿Por qué la línea del idioma dice “Predeterminado de la empresa”?", a: "Porque no se eligió idioma para este cliente, así que sigue el predeterminado de su empresa — y lo seguirá si usted lo cambia. Toque **Editar** para fijarle un idioma a este cliente." },
      { q: "¿Puedo agregar una nota desde aquí?", a: "Sí — **Editar**, luego el cuadro **Notas**, luego **Guardar cambios**. Las notas son internas y nunca se imprimen. Vea [[client-notes|Notas del cliente]]." },
    ],
  },

  "business-clients-and-contacts": {
    title: "Clientes empresa y su persona de contacto",
    summary:
      "Qué cambia el tipo de cliente Empresa / Contratista: una dirección de oficina en lugar de un sitio de trabajo, una persona de contacto con nombre, y una dirección del sitio en cada trabajo.",
    updated: "2026-09-12",
    intro: [
      "Un propietario es la persona y la propiedad en uno. Un contratista general, un administrador de propiedades o un constructor no es ninguna de las dos: lo contrata en muchas direcciones y usted trata con una persona allí. FieldQuo separa las dos cosas con una sola elección en el formulario del cliente, **Tipo de cliente**, y todo lo que sigue se desprende de ella.",
      "El tipo no es decorativo. Decide si la dirección de la ficha es adonde va su cuadrilla, si la ficha lleva una persona de contacto, y qué imprimen la lista y la ficha.",
    ],
    sections: [
      {
        id: "overview",
        heading: "Descripción general",
        blocks: [
          { p: "Cada cliente es **Propietario** — “Un particular — los trabajos se hacen en su dirección” — o **Empresa / Contratista** — “Una empresa — los sitios de trabajo varían según el trabajo”. Las palabras son las de la pantalla. La dirección de un cliente empresa se llama **Dirección comercial (opcional)** y el formulario dice por qué: “Esta es su oficina. La dirección real de cada trabajo se define en la cotización o el trabajo.”" },
          { p: "La persona con la que trata en esa empresa va en **Persona de contacto** — “Con quién tratas allí”. Se muestra bajo el nombre de la empresa en la lista de clientes y, en la ficha, junto a la etiqueta “persona de contacto”. Un propietario no tiene ese campo, porque el cliente es la persona." },
        ],
      },
      {
        id: "how-to",
        heading: "Cómo configurar un cliente como empresa",
        blocks: [
          { steps: [
            "En **Nuevo cliente** — o en **Editar** para un cliente existente — elija **Empresa / Contratista** bajo **Tipo de cliente**.",
            "Escriba el **Nombre de la empresa** y, en el campo que aparece al lado, la **Persona de contacto**.",
            "Opcionalmente agregue la **Dirección comercial (opcional)** — su oficina, no un sitio de trabajo — con el teléfono y el correo que usa para contactarlos.",
            "Toque **Crear cliente** (o **Guardar cambios**). La lista ahora muestra una insignia **Empresa** en la tarjeta y la persona de contacto bajo el nombre.",
          ] },
          { figure: "create:app-clients-create", caption: "Nuevo cliente — la elección del tipo de cliente arriba; elegir Empresa / Contratista agrega el campo Persona de contacto junto al nombre." },
          { note: "La dirección de un cliente empresa nunca se usa como sitio de trabajo. Cuando cree un trabajo para ellos, complete la **Dirección del sitio** del propio trabajo — “Calle, ciudad, código postal” — para que la cuadrilla, la detección de llegada y el historial de equipos apunten todos a la propiedad correcta. Un trabajo sin dirección del sitio no tiene ubicación, en lugar de una adivinada." },
        ],
      },
      {
        id: "what-changes",
        heading: "Qué cambia el tipo",
        blocks: [
          { table: {
            head: ["Dónde", "Propietario", "Empresa / Contratista"],
            rows: [
              ["Tarjeta en la lista de clientes", "El correo bajo el nombre", "La insignia **Empresa** y la persona de contacto bajo el nombre"],
              ["Ficha del cliente", "La dirección se muestra como la propiedad", "La dirección marcada “oficina”, la persona de contacto marcada “persona de contacto”, y la línea “Los sitios de trabajo varían para los contratistas — cada cotización o trabajo lleva su propia ubicación.”"],
              ["Nuevo trabajo", "La dirección del cliente es donde está el trabajo", "Cada trabajo lleva su propia **Dirección del sitio**"],
              ["Volver atrás", "—", "Cambiar una empresa a **Propietario** borra la persona de contacto"],
            ],
          } },
        ],
      },
      {
        id: "contact-person",
        heading: "La persona de contacto",
        blocks: [
          { p: "Una persona de contacto por empresa — un solo nombre, no una lista de contactos con sus propios teléfonos y correos. El teléfono y el correo de la ficha son con los que contacta a la empresa, conteste quien conteste. Si su contacto en una constructora cambia, edite la ficha y reemplace el nombre; los presupuestos y las facturas se quedan con la empresa." },
          { tip: "Ponga la línea directa del contacto en **Notas** si difiere del número de la ficha. Las notas son internas y se muestran en la ficha para quien pueda ver la información completa del cliente." },
        ],
      },
    ],
    faq: [
      { q: "¿Puede una empresa tener varios contactos o varios sitios en la ficha?", a: "No. Una persona de contacto y una dirección de oficina por cliente. Los sitios viven en los trabajos — cada trabajo tiene su propia **Dirección del sitio** — así que un solo cliente empresa puede tener trabajos en tantas propiedades como quiera." },
      { q: "¿El nombre de la persona de contacto aparece en presupuestos y facturas?", a: "El nombre de la empresa es el nombre del cliente en cada documento. La persona de contacto se muestra en la lista de clientes y en la ficha; no es una línea aparte en el PDF." },
      { q: "Creé una constructora como Propietario por error.", a: "Toque **Editar** en la ficha, elija **Empresa / Contratista**, escriba la persona de contacto y guarde. Los presupuestos y trabajos existentes siguen vinculados." },
    ],
  },

  "client-notes": {
    title: "Notas del cliente",
    summary:
      "Las notas de texto libre en la ficha del cliente: dónde escribirlas, dónde aparecen y quién puede leerlas.",
    updated: "2026-09-12",
    intro: [
      "Cada ficha de cliente tiene un cuadro de **Notas**. Es para lo que un documento no puede llevar — el código del portón, el perro, “siempre llamar antes de las 9”, el hecho de que la última factura necesitó tres recordatorios. Las notas son internas: nunca se imprimen en un presupuesto, una factura o un correo, y un cliente nunca las ve.",
    ],
    sections: [
      {
        id: "overview",
        heading: "Descripción general",
        blocks: [
          { p: "Las notas del cliente son un solo campo de texto en la ficha, no un registro corrido. Lo que está en el cuadro es lo que se muestra; no hay historial de notas anteriores, ni marcas de tiempo, ni autor. Si necesita un registro fechado de lo que pasó, las notas propias del trabajo y las notas de las visitas llevan fecha — vea [[job-notes|Notas del trabajo]]." },
        ],
      },
      {
        id: "how-to",
        heading: "Cómo agregar o cambiar una nota",
        blocks: [
          { steps: [
            "Abra la ficha del cliente y toque **Editar**.",
            "Escriba en el cuadro **Notas** — en el formulario de nuevo cliente es el último campo antes de **Crear cliente**.",
            "Toque **Guardar cambios**. La nota aparece al pie de la tarjeta de contacto, bajo una línea fina.",
          ] },
        ],
      },
      {
        id: "where-they-appear",
        heading: "Dónde aparece la nota",
        blocks: [
          { bullets: [
            "**En la ficha del cliente**, al pie de la tarjeta de contacto, para quien pueda ver la información completa del cliente.",
            "**En las tareas sugeridas** — cuando FieldQuo lee un trabajo para proponer una lista de verificación, las notas del cliente son una de sus fuentes, junto con las notas del presupuesto, el alcance y las notas de las visitas. Vea [[suggested-tasks|Tareas sugeridas]].",
            "**En ningún lugar que un cliente pueda ver.** Ni en el presupuesto, ni en la factura, ni en el PDF, ni en el portal, ni en ningún correo.",
            "**No en la página del trabajo.** Una nota que la cuadrilla necesita en el sitio va en el trabajo o en la visita, no en el cliente.",
          ] },
        ],
      },
      {
        id: "who-can-see-them",
        heading: "Quién puede leerlas",
        blocks: [
          { p: "Las notas viajan con el resto de la información completa del cliente. Un miembro cuyo nivel de **Clients and Properties** es **View client name and address only** — el perfil Cuadrilla — nunca las recibe: el servidor quita las notas, el teléfono, el correo y la persona de contacto de la ficha antes de enviarla, y la página muestra **Oculto según tu nivel de acceso** en su lugar. Todos desde **View full client and property info** hacia arriba pueden leerlas; editarlas requiere **View and edit full client and property info**." },
          { warning: "Escriba las notas como si el cliente pudiera pedir verlas. FieldQuo las mantiene privadas, pero la ley de privacidad en Canadá le da a una persona el derecho a preguntar qué guarda una empresa sobre ella — vea [[data-and-privacy|Sus datos, los datos de sus clientes y la eliminación]]." },
        ],
      },
    ],
    faq: [
      { q: "¿Puedo ver quién escribió una nota, o cuándo?", a: "No. El registro de actividad anota que un cliente fue editado y qué campos cambiaron, pero un cambio solo en las notas no aparece ahí, y la nota misma no lleva autor ni fecha." },
      { q: "¿También hay una nota en el trabajo?", a: "Sí — los trabajos y las visitas tienen sus propias notas, que la cuadrilla puede leer en su teléfono. Las notas del cliente son la vista de la oficina sobre la persona; las notas del trabajo son sobre el trabajo. Vea [[job-notes|Notas del trabajo]]." },
    ],
  },

  "a-clients-language": {
    title: "El idioma de un cliente",
    summary:
      "El idioma en la ficha del cliente gobierna cada presupuesto, factura, correo, página del portal, solicitud de reseña y mensaje de texto de recordatorio que recibe — con una regla sobre los documentos ya escritos.",
    updated: "2026-09-12",
    intro: [
      "Dos idiomas importan en FieldQuo y son distintos: el que usa su equipo para trabajar, elegido en [[choose-your-language|Elegir su idioma]], y el que lee cada cliente. Este artículo trata del segundo. Lo elige una vez en la ficha del cliente, y todo lo que le envía a ese cliente lo sigue.",
      "Hay ocho idiomas disponibles para un cliente: inglés, francés, español, ucraniano, punyabí, tagalo, alemán e italiano. El PDF, el correo de presentación, el portal y los mensajes de texto tienen todos un texto escrito a mano en cada uno — nada se traduce a máquina al momento del envío.",
    ],
    sections: [
      {
        id: "overview",
        heading: "Descripción general",
        blocks: [
          { p: "El campo es **Language for their documents** en el formulario de nuevo cliente y en la hoja de edición, con la pista “Las cotizaciones, facturas y correos se envían en este idioma.” La lista está en el nombre propio de cada idioma — a un propietario que lee punyabí se le ofrece “ਪੰਜਾਬੀ — Punjabi”. La primera opción, **Company default (…)**, significa que el cliente sigue la configuración de su empresa, y la sigue si usted cambia esa configuración más adelante." },
        ],
      },
      {
        id: "how-to",
        heading: "Cómo configurar el idioma de un cliente",
        blocks: [
          { steps: [
            "Abra la ficha del cliente y toque **Editar** (o configúrelo en **Nuevo cliente** cuando lo agregue).",
            "Elija un idioma bajo **Language for their documents**, o deje **Company default** para seguir a su empresa.",
            "Toque **Guardar cambios**. La tarjeta de contacto muestra ahora el idioma con la etiqueta “documentos y correos”, o “Predeterminado de la empresa (Español)” cuando no está definido.",
            "Empiece el próximo presupuesto. El constructor de presupuestos adopta el idioma del cliente en cuanto lo selecciona, y su barra de idioma le avisa si alguno de sus servicios todavía no tiene traducción en ese idioma.",
          ] },
          { figure: "create:app-clients-create", caption: "Nuevo cliente — Language for their documents, que abre en Company default (English), con los ocho idiomas debajo." },
          { note: "La etiqueta **Language for their documents** y la opción **Company default** se muestran en inglés en cada pantalla, sea cual sea el idioma de su aplicación. El resto del formulario está traducido." },
        ],
      },
      {
        id: "what-follows-it",
        heading: "Qué sigue el idioma del cliente",
        blocks: [
          { bullets: [
            "**Los presupuestos y facturas nuevos** — el documento se escribe en el idioma del cliente al crearse. Las etiquetas, el texto de cada servicio y las condiciones vienen todos de las tablas de traducción, nunca de una máquina al momento del envío.",
            "**El correo de presentación** de un presupuesto o una factura — emparejado con el documento que lleva (vea la regla más abajo).",
            "**El portal del cliente** y las páginas públicas de presupuesto y factura.",
            "**Las solicitudes de reseña** después de un trabajo, y la encuesta de satisfacción de una pregunta que llevan adentro.",
            "**Los mensajes de texto de recordatorio de cita** y **en camino**, y los correos alrededor de una visita reservada.",
            "**Los recordatorios de pago** y las facturas de planes de servicio enviadas según un calendario.",
          ] },
        ],
      },
      {
        id: "precedence",
        heading: "Qué idioma gana",
        blocks: [
          { p: "Cada envío responde la misma pregunta en el mismo orden, de modo que un cliente nunca recibe un presupuesto en francés con un recordatorio en inglés y un seguimiento en español:" },
          { table: {
            head: ["Orden", "Fuente", "Cuándo aplica"],
            rows: [
              ["1", "El idioma propio del documento", "Un presupuesto o una factura conserva el idioma en que se creó, toda su vida, aunque el idioma del cliente se cambie después. Su correo de presentación va a juego."],
              ["2", "El idioma guardado del cliente", "Todo lo que no está ligado a un documento específico: recordatorios, correos de reserva, solicitudes de reseña, el portal."],
              ["3", "El predeterminado de la empresa", "Los clientes configurados en **Company default**. Vea [[settings-language|Configuración → Idioma]]."],
              ["4", "Inglés", "Cuando nada de lo anterior está definido."],
            ],
          } },
          { warning: "Cambiar el idioma de un cliente no traduce los presupuestos que ya tiene. Un documento firmado debe seguir diciendo lo que decía cuando se firmó. Para enviar el mismo presupuesto en otro idioma, cree un presupuesto nuevo — vea [[quote-language|El idioma del presupuesto]]." },
        ],
      },
    ],
    faq: [
      { q: "Mi cuadrilla trabaja en inglés. ¿Un cliente puede recibir igual un presupuesto en español?", a: "Sí. El idioma de la aplicación y el idioma del cliente son independientes — configure al cliente en Español y escriba el presupuesto como siempre; el documento y su correo salen en español." },
      { q: "¿Por qué el constructor de presupuestos me avisó de traducciones faltantes?", a: "Sus servicios tienen un texto que el cliente lee, y ese texto se traduce idioma por idioma en **Configuración → Traducciones**. La barra nombra lo que todavía falta para que lo corrija antes de enviar, no después." },
      { q: "¿El idioma cambia cómo se ve la aplicación para mí?", a: "No. Su propio idioma de interfaz es suyo, en **Configuración → Idioma**. El idioma del cliente solo afecta lo que el cliente recibe." },
    ],
  },

  "client-equipment-and-warranties": {
    title: "Equipos del cliente y garantías",
    summary:
      "Registre la caldera, el tablero o los gabinetes que instaló en la propiedad de un cliente con su fecha de garantía y su historial de servicio — y obtenga una lista de llamadas de las garantías por terminar.",
    updated: "2026-09-12",
    intro: [
      "Un número de serie en una base de datos no gana nada. Doce hogares cuyas garantías terminan en abril, con un número de teléfono junto a cada uno, son una mañana de llamadas y un mes de trabajo. Para eso existe esta función: un panel **Equipos y garantías** en cada ficha de cliente, y una pantalla **Equipos del cliente** en la barra lateral que lista a quiénes se les terminó la cobertura o está por terminarse.",
      "Una regla atraviesa todo. Una fecha de garantía en blanco significa que **nadie la registró** — se muestra como “Garantía sin registrar” y nunca como fuera de garantía. Una llamada de renovación a un cliente cuya cobertura en realidad está vigente es un insulto, así que FieldQuo se niega a adivinar.",
    ],
    sections: [
      {
        id: "overview",
        heading: "Descripción general",
        blocks: [
          { p: "Cada pieza de equipo pertenece a un cliente y, opcionalmente, al trabajo que la instaló. Lleva un nombre, marca y modelo, número de serie, dónde está si no es la dirección principal, la fecha de instalación, la fecha hasta la que cubre la garantía, quién la cubre, notas, y un **historial de servicio** — cada visita con qué se hizo, la fecha, un enlace opcional a un trabajo, y si la visita la cubrió la garantía." },
          { p: "Es el equipo del cliente, no el suyo. Sus propias camionetas y herramientas viven en **Vehículos** y en el costeo de trabajos; la caldera de un propietario nunca se trata como un activo de su empresa." },
        ],
      },
      {
        id: "on-the-record",
        heading: "Qué hay en la ficha del cliente",
        blocks: [
          { bullets: [
            "El panel **Equipos y garantías**, ubicado encima de los presupuestos, trabajos y facturas — en una llamada de servicio la primera pregunta es “qué hay en esta casa y está cubierto”.",
            "Un conteo de elementos, un botón **Agregar**, y una fila por elemento: su nombre, luego marca, modelo y número de serie, luego una insignia — **En garantía**, **Garantía por terminar**, **Fuera de garantía** o **Garantía desconocida** — con “Cubierto hasta el …”, “La cobertura terminó el …” o “Garantía sin registrar”.",
            "Toque una fila para abrirla: la ubicación, las notas, el **Historial de servicio** (“3 visitas · 2 en garantía”, cada visita con fecha y una etiqueta **cubierta** donde aplicó), **Registrar una visita de servicio**, **Editar** y **Eliminar**.",
            "Un panel vacío dice “Aquí todavía no hay nada registrado. Agrega la caldera, el tablero, la unidad — lo que quieras saber en la próxima visita.”",
            "**Garantía por terminar** significa que la fecha cae dentro de los próximos 60 días — el tiempo que toman un presupuesto de renovación, una conversación y una reserva.",
            "El panel solo se dibuja para miembros que pueden ver la información completa del cliente; un miembro de la cuadrilla limitado a nombre y dirección no recibe ningún panel, en lugar de uno vacío.",
          ] },
        ],
      },
      {
        id: "add-equipment",
        heading: "Cómo registrar una pieza de equipo",
        blocks: [
          { steps: [
            "Abra la ficha del cliente y toque **Agregar** en el panel **Equipos y garantías**.",
            "Póngale nombre — “Caldera, tablero, calentador de agua…” — y agregue el **Fabricante**, el **Número de modelo** y el **Número de serie**. Use **Dónde está (si no es la dirección principal)** para el sitio de un cliente empresa o una segunda propiedad.",
            "Defina **Instalado** y **La garantía cubre hasta**. Deje la fecha de garantía en blanco si no la sabe: el formulario mismo lo dice — se mostrará como “sin registrar”, nunca como fuera de garantía.",
            "Agregue **Quién la cubre** y, si este cliente tiene trabajos, elija **Instalado en qué trabajo** para que el equipo se rastree hasta el trabajo.",
            "Toque **Guardar**. La fila aparece con su insignia calculada a partir de la fecha.",
          ] },
          { note: "Las ediciones se envían completas, espacios en blanco incluidos, de modo que borrar una fecha de garantía mal escrita realmente la borra. **Eliminar** pide confirmación y quita el elemento y su historial de servicio para siempre." },
        ],
      },
      {
        id: "log-a-visit",
        heading: "Cómo registrar una visita de servicio",
        blocks: [
          { steps: [
            "Abra el elemento y toque **Registrar una visita de servicio**.",
            "Escriba **Qué se hizo** y revise la fecha (la de hoy viene precargada). Vincúlela a un trabajo con el selector si hay uno.",
            "Marque **Esta visita la cubrió la garantía** cuando así fue. Esto se pregunta, no se deduce de si facturó o no — una visita sin facturar y una cubierta son cosas distintas.",
            "Toque **Registrarlo**. El historial de servicio y su conteo de “en garantía” se actualizan.",
          ] },
        ],
      },
      {
        id: "the-call-list",
        heading: "La lista de llamadas: Garantías que se acaban",
        blocks: [
          { p: "**Equipos del cliente**, en el grupo **Personas** de la barra lateral, abre **Garantías que se acaban** — “Equipos que instalaste cuya cobertura terminó o está por terminar. Esto es una lista de llamadas.” Lee todos los clientes a la vez, para que nunca tenga que abrir fichas una por una para encontrar las renovaciones." },
          { figure: "harness:client-equipment", caption: "Equipos del cliente — los chips de ventana, el conteo, y una tarjeta por elemento con su insignia, su fecha de fin, y los botones de llamar con un toque y Correo electrónico." },
          { bullets: [
            "**Los chips de ventana** — de **Próximos 30 días** a **Próximos 365 días**; 60 días queda seleccionado al llegar. Cada ventana incluye también la cobertura que ya terminó, las vencidas primero, luego las más próximas.",
            "**El conteo** — “1 fuera de garantía · 2 por terminar · 1 sin fecha de garantía registrada”. El tercer número es el honesto: esos elementos no están en la lista, y el conteo le dice que hay datos por cargar.",
            "**Una tarjeta por elemento** — el nombre del cliente (un enlace a su ficha), el equipo, su dirección, “La cobertura terminó el …” o “Cubierto hasta el …”, y un **botón de teléfono** que marca y un botón **Correo electrónico** que abre un mensaje. Los botones solo aparecen cuando el dato está registrado.",
          ] },
          { warning: "Un equipo sin fecha de garantía nunca está en esta lista, en ninguna ventana. Si la lista parece corta, revise el tercer número del conteo antes de concluir que no hay nada por vencer." },
        ],
      },
      {
        id: "only-in-fieldquo",
        heading: "Por qué está listado en “Solo en FieldQuo”",
        blocks: [
          { p: "De los cinco productos con los que FieldQuo se compara en sus páginas de precios — Housecall Pro, ServiceTitan, Projul, Jobber y QuoteIQ — solo ServiceTitan menciona el seguimiento de equipos en su página de precios, en su nivel Essentials, y ninguno menciona una lista de llamadas de garantías. En FieldQuo el panel, el historial de servicio y la lista de llamadas están en todos los planes, y la regla de que una fecha en blanco es desconocida y no vencida está escrita en el código que calcula cada insignia." },
        ],
      },
      {
        id: "who-can-see-it",
        heading: "Quién puede verlo",
        blocks: [
          { table: {
            head: ["Nivel de Clients and Properties", "Equipos"],
            rows: [
              ["**View client name and address only** (Cuadrilla)", "Nada — sin panel en la ficha, sin fila **Equipos del cliente** en la barra lateral."],
              ["**View full client and property info**", "Ve el panel, los historiales y la lista de llamadas. No puede agregar, editar ni registrar una visita."],
              ["**View and edit full client and property info** (Estimador, Despachador)", "Agrega y edita equipos y registra visitas. Solo un Gerente (**View, edit, and delete …**) puede eliminar un elemento."],
            ],
          } },
        ],
      },
    ],
    faq: [
      { q: "¿Puedo poner un equipo en un trabajo en lugar de en un cliente?", a: "El equipo pertenece al cliente. Desde la ficha del cliente puede vincularlo al trabajo que lo instaló, y cada visita registrada también puede vincularse a un trabajo." },
      { q: "¿FieldQuo le envía un correo al cliente cuando la garantía está por terminar?", a: "No. La lista de llamadas es para que usted actúe — los botones de teléfono y Correo electrónico abren una llamada o un mensaje que usted escribe. Nada se envía automáticamente." },
      { q: "¿Y si no sé la fecha de garantía?", a: "Déjela en blanco. El elemento muestra **Garantía desconocida** y se queda fuera de la lista de llamadas, y el conteo lo suma en “sin fecha de garantía registrada” para que sepa que hay que preguntar." },
    ],
  },

  "client-consent-and-unsubscribes": {
    title: "Consentimiento del cliente y bajas",
    summary:
      "Qué correos llevan un enlace para darse de baja, cuáles no y por qué, qué pasa cuando un cliente responde STOP por mensaje de texto, y dónde se registra y se respeta una baja.",
    updated: "2026-09-12",
    intro: [
      "La ley canadiense contra el correo no deseado (CASL) y su equivalente en Estados Unidos trazan una línea: un mensaje que promociona su negocio necesita una salida que funcione, con un clic; un mensaje que lleva algo que el cliente pidió no la necesita. FieldQuo traza la misma línea en el código. Este artículo dice de qué lado cae cada correo y cada mensaje de texto, y qué cambia una baja.",
      "Nada aquí es una configuración que se activa. Es cómo se comporta ya cada envío, sea cual sea su plan.",
    ],
    sections: [
      {
        id: "overview",
        heading: "Descripción general",
        blocks: [
          { p: "Un correo es **comercial** — y lleva un enlace **Unsubscribe** en su pie más el encabezado de un clic que usan las aplicaciones de correo — o **transaccional**, y no lleva ningún enlace, porque invitar a alguien a apagar la factura que debe sería un defecto en sí mismo. Los mensajes de texto funcionan en cambio con la palabra clave STOP. Una baja en cualquiera de los dos canales se guarda como un registro con el texto que la persona vio, nunca se borra, y se verifica antes de cada envío posterior." },
        ],
      },
      {
        id: "emails",
        heading: "Qué correos llevan un enlace para darse de baja",
        blocks: [
          { p: "El pie dice “You're receiving this because you're a customer of …” con un enlace **Unsubscribe**, y la página que abre dice claramente que los presupuestos, facturas y recibos sobre trabajos solicitados seguirán llegando — solo se detiene el correo promocional." },
          { bullets: [
            "**Comerciales, con el enlace:** las campañas de correo de marketing; la solicitud automática de reseña después de un trabajo (vea [[review-requests|Solicitudes de reseña después de un trabajo]]); y una regla de seguimiento de “trabajo completado”, ya que el trabajo terminó y es un contacto discrecional.",
            "**Transaccionales, sin enlace:** un presupuesto o una factura enviados; los seguimientos de “presupuesto enviado, sin respuesta” y de factura vencida, que son sobre un documento con el que el cliente ya está en una transacción; las confirmaciones de reserva y de presupuesto instantáneo; y el correo de cuenta como el restablecimiento de contraseña.",
            "**Registrado al salir:** una solicitud de reseña se envía a alguien que nunca estuvo en una lista de correo, así que el envío primero crea su fila de suscriptor con un token — eso es lo que hace que el enlace de ese correo funcione.",
          ] },
        ],
      },
      {
        id: "the-unsubscribe-page",
        heading: "Qué ve el cliente cuando se da de baja",
        blocks: [
          { steps: [
            "El enlace abre una página sin inicio de sesión. Abrirla no cambia nada — una aplicación de correo que precarga enlaces no puede dar de baja a alguien por accidente.",
            "Un solo botón confirma: “Unsubscribe from marketing emails from …”. Tocarlo registra la baja con ese texto exacto y la hora.",
            "Si la solicitud no llega — una sola barra de señal, un servidor lento — el botón se queda en pantalla y la página dice que todavía nada ha cambiado, para que pueda tocar otra vez.",
          ] },
          { note: "La baja nunca se borra. El registro de la solicitud es la prueba de que usted la respetó, y FieldQuo lo conserva aunque el cliente se quite más tarde de una lista." },
        ],
      },
      {
        id: "texts",
        heading: "Mensajes de texto: STOP y START",
        blocks: [
          { p: "El mensaje de texto de recordatorio de cita predeterminado termina con “Responda STOP para no recibir más”, en el idioma del cliente — si reescribe el texto en **Configuración → Mensajes de clientes**, conserve esa línea, porque nada la vuelve a agregar. La palabra clave en sí es siempre STOP — las operadoras la tratan como universal. Una respuesta es una baja solo cuando todo el mensaje es la palabra clave: **STOP**, **STOPALL**, **UNSUBSCRIBE**, **CANCEL**, **END** o **QUIT** (un punto final está bien). “Please stop by at 3” no es una baja." },
          { bullets: [
            "**STOP** registra una baja de SMS para ese número y su empresa en cuanto llega. Desde entonces, el recordatorio automático y el texto de “en camino” saltan ambos ese número.",
            "**START** o **UNSTOP** la revierte, por el mismo canal. Que el cliente reciba o no un texto de confirmación depende de cómo esté configurado el número en la operadora, no de un ajuste en FieldQuo. **YES** deliberadamente no es un alta — normalmente significa “sí a la cita”.",
            "Un número que se dio de baja de las **llamadas** también recibe rechazo para mensajes de texto, pero un START no restaura el consentimiento de llamadas — esa baja es de una sola vía.",
          ] },
        ],
      },
      {
        id: "where-you-see-it",
        heading: "Dónde ve usted una baja",
        blocks: [
          { p: "Las bajas de correo se muestran en **Marketing → Suscriptores** como **Dado de baja** junto a la dirección, y el conteo de arriba — “12 suscritos de 15 en total: es a quienes envía una campaña de envío masivo de correo” — los excluye. Una solicitud de reseña revisa la misma lista antes de enviar, y la página de configuración de reseñas lo dice: “Se omite a los clientes que se han dado de baja”. Vea [[email-campaigns-and-subscribers|Campañas de correo y suscriptores]]." },
          { note: "No hay un indicador de consentimiento en la ficha del cliente misma, y ninguna pantalla lista las bajas de SMS. Un STOP por texto se respeta en silencio en cada mensaje automatizado; si un cliente le dice en persona que no quiere mensajes de texto, la única forma de estar seguro es quitar el número de teléfono de su ficha." },
        ],
      },
    ],
    faq: [
      { q: "Un cliente se dio de baja. ¿Igual recibirá su factura?", a: "Sí. Los presupuestos, facturas, recibos, recordatorios sobre un documento específico y confirmaciones de reserva son transaccionales y siempre se envían. Solo se detienen las campañas, las solicitudes de reseña y los seguimientos de trabajo completado." },
      { q: "¿Puedo volver a suscribir a alguien desde la página de suscriptores?", a: "La página tiene un botón **Volver a suscribir**, pero úselo solo con el consentimiento expreso del cliente por escrito. El registro de la baja original se queda en el archivo de todas formas." },
      { q: "¿El texto de “en camino” y el de recordatorio necesitan consentimiento?", a: "Son sobre una visita que el cliente reservó, así que salen sin un alta separada — pero una respuesta STOP detiene ambos, de inmediato, y FieldQuo no volverá a enviar texto a ese número hasta recibir START." },
    ],
  },

  "review-requests": {
    title: "Solicitudes de reseña después de un trabajo",
    summary:
      "Configuración → Reseñas: su enlace de reseñas, el interruptor Pedir automáticamente, el retraso Cuándo preguntar, el conteo de la cola en vivo — y las reglas exactas que deciden a quién se le pide, una vez, y a quién no.",
    updated: "2026-09-12",
    intro: [
      "Las reseñas son la mayor fuente de trabajo entrante para un contratista pequeño, y pedir una es el paso que se salta mientras se carga la camioneta. **Configuración → Reseñas** se encarga de pedirla: una vez que un trabajo se marca como completado, el cliente recibe un correo corto de su empresa — su logo, sus colores, su nombre — con un botón hacia su página de reseñas. Nunca más de uno por trabajo, nunca a alguien que se dio de baja, nunca por trabajos de más de un mes.",
    ],
    sections: [
      {
        id: "overview",
        heading: "Descripción general",
        blocks: [
          { p: "La pantalla está en el grupo **De cara al cliente** de Configuración. Su subtítulo lo dice todo: “Pide una reseña a los clientes automáticamente cuando termine su trabajo.” Dos tarjetas hacen el trabajo — **Tu enlace de reseñas** y **Pedir automáticamente** con **Cuándo preguntar** — y un panel gris debajo demuestra que funciona contando la cola. La mitad inferior de la misma pantalla, **Reseñas en tu sitio web**, es una función aparte: vea [[testimonials-on-your-website|Testimonios en su sitio web]]." },
        ],
      },
      {
        id: "on-the-screen",
        heading: "Qué hay en la pantalla",
        blocks: [
          { bullets: [
            "**Tu enlace de reseñas** — “Normalmente tu enlace de reseñas de Google. En tu Perfil de Empresa de Google, elige “Solicitar reseñas” y copia el enlace corto.” Un cuadro, **Guardar**, y una vez guardado un enlace **Ábrelo y comprueba que lleva a donde esperas**.",
            "**Pedir automáticamente** — el interruptor. Debajo: “Cada cliente con una dirección de correo recibe un mensaje después de que su trabajo se marca como completado. Nunca más de uno.” El interruptor está deshabilitado hasta que se guarda un enlace, y el texto entonces dice “Primero agrega tu enlace de reseñas arriba.”",
            "**Cuándo preguntar** — aparece una vez que el interruptor está encendido: **2 horas después**, **4 horas después**, **Al día siguiente**, **Dos días después**, **Tres días después**, **Una semana después**. Al día siguiente es el predeterminado.",
            "El panel de la cola — “**1** cliente está en la cola, y **3** han sido contactados en los últimos 30 días.” — leído de las mismas columnas que lee el remitente, de modo que un interruptor que dice Encendido mientras nada se envía no puede pasar en silencio.",
            "Su nota al pie: “Se omite a los clientes que se han dado de baja, y cualquiera que responda diciendo que algo salió mal te contacta directamente en lugar de la página de reseñas.”",
          ] },
        ],
      },
      {
        id: "set-up",
        heading: "Cómo activarlo",
        blocks: [
          { steps: [
            "En su Perfil de Empresa de Google elija **Solicitar reseñas** y copie el enlace corto. Cualquier página donde se pueda dejar una reseña funciona — Google, Facebook, HomeStars — siempre que empiece con https://.",
            "Abra **Configuración → Reseñas**, pegue el enlace en **Tu enlace de reseñas** y toque **Guardar**. Un enlace que no es una dirección web se rechaza con la razón.",
            "Toque **Ábrelo y comprueba que lleva a donde esperas**. Esta es la página a la que llegará cada cliente.",
            "Encienda **Pedir automáticamente**. No se puede encender sin un enlace válido — el servidor lo rechaza, no solo el botón.",
            "Elija un retraso en **Cuándo preguntar**. Cada chip se guarda al tocarlo; **Guardado** lo confirma.",
          ] },
          { figure: "live:app-settings-reviews", caption: "Configuración → Reseñas — la tarjeta del enlace de reseñas, el interruptor Pedir automáticamente con los chips de Cuándo preguntar, y el conteo de la cola debajo." },
        ],
      },
      {
        id: "when-it-sends",
        heading: "A quién se le pide, y a quién no",
        blocks: [
          { p: "Un remitente corre cada hora en punto y aplica estas reglas a cada trabajo, en este orden. Cada rechazo tiene una razón, para que un trabajo por el que no se pidió sea explicable:" },
          { table: {
            head: ["Regla", "Qué significa"],
            rows: [
              ["Una vez, y nunca más", "Por un trabajo se pide exactamente una vez. El trabajo se marca antes de que salga el correo, así que dos corridas superpuestas no pueden pedir dos veces."],
              ["Encendido, con un enlace", "Ambos se vuelven a verificar al momento del envío. Apague el interruptor y no sale nada más."],
              ["Trabajo marcado **Completado**", "Con una hora de finalización. Por un trabajo completado mediante una importación de trabajos pasados nunca se pide."],
              ["El cliente tiene correo", "Sin dirección de correo, no se pide. Los mensajes de texto no se usan para solicitudes de reseña."],
              ["No dado de baja", "Un cliente que se dio de baja de su correo de marketing se omite."],
              ["El retraso ya pasó", "La hora de finalización más su retraso de **Cuándo preguntar** — de 2 horas a una semana."],
              ["Completado en los últimos 30 días", "Todo lo más antiguo se deja en paz, de forma permanente. Activar esto no envía correos a todos los clientes que ha tenido."],
              ["El correo está configurado", "Si no hay proveedor de correo configurado, el trabajo se libera para reintentar la hora siguiente en lugar de marcarse como pedido."],
            ],
          } },
        ],
      },
      {
        id: "what-the-client-gets",
        heading: "Qué recibe el cliente",
        blocks: [
          { p: "Un correo corto en el idioma del cliente: el asunto “How did we do? — Su empresa” en su idioma, una frase de agradecimiento, un botón hacia su enlace, cinco pequeños enlaces de calificación del 1 al 5, y la línea de que si algo no estuvo bien, responda a este correo. Se envía desde su propio dominio si ha verificado uno, y las respuestas van a la dirección de correo de su empresa. Vea [[the-review-request|La solicitud de reseña]] para ver cómo le llega al cliente." },
          { note: "Los enlaces del 1 al 5 preseleccionan una calificación en una página de una sola pregunta; el cliente todavía tiene que tocar Enviar allí, para que un escáner de correo no pueda votar por él. Las calificaciones respondidas alimentan la cifra de satisfacción del cliente en el tablero de KPI — vea [[kpi-customer|KPI de clientes]]. No se convierten en testimonios." },
        ],
      },
      {
        id: "who-can-change-it",
        heading: "Quién puede cambiarlo",
        blocks: [
          { p: "La fila **Reseñas** en Configuración, y cada cambio en ella — el enlace, el interruptor, el retraso — requieren el permiso **user:manage**: el propietario, un administrador, o un Gerente o Despachador. Un Estimador o un miembro de la cuadrilla no ve la fila en absoluto. Cada cambio se anota en el registro de actividad como “Updated review request settings” o “Turned off automatic review requests”." },
        ],
      },
    ],
    faq: [
      { q: "¿Puedo pedirle una reseña a un cliente específico a mano?", a: "No. No hay botón de “pedir ahora” en un trabajo ni en un cliente; el remitente trabaja a partir de los trabajos completados y su retraso. Para pedírsela usted mismo a alguien, envíele su enlace de reseñas desde su propio correo." },
      { q: "Lo activé y no se envió nada.", a: "Lea el panel de la cola. Un conteo de 0 en la cola significa que ningún trabajo completado con correo del cliente en los últimos 30 días está esperando; un trabajo también tiene que haber pasado su retraso. Por los trabajos importados de su sistema anterior nunca se pide." },
      { q: "¿Envía mensajes de texto a los clientes?", a: "No — solo correo. Un cliente con número de teléfono y sin correo se omite." },
      { q: "¿La reseña puede ir a una página de mi propio sitio?", a: "Sí. Cualquier dirección https:// funciona, incluido su propio formulario de testimonios. Las reseñas recogidas van luego a **Reseñas en tu sitio web** a mano." },
    ],
  },

  "testimonials-on-your-website": {
    title: "Testimonios en su sitio web",
    summary:
      "Reseñas en tu sitio web, en la pantalla Configuración → Reseñas: agregue reseñas de a una o pegue una lista, active las que quiere mostrar, ordénelas e insértelas en un sitio que FieldQuo no construyó.",
    updated: "2026-09-12",
    intro: [
      "Las reseñas que ya tiene — en Google, en Facebook, en una carpeta de correos de agradecimiento — valen más en su propio sitio web que en cualquier otro lado. La mitad inferior de **Configuración → Reseñas** es adonde van. Cada reseña empieza apagada; las que enciende aparecen en su sitio web de FieldQuo, las seis primeras en el orden que usted fija, y en un código de inserción que puede pegar en cualquier otro sitio.",
    ],
    sections: [
      {
        id: "overview",
        heading: "Descripción general",
        blocks: [
          { p: "La tarjeta se titula **Reseñas en tu sitio web** — “Las que actives aparecen en tu sitio web: las seis primeras, en el orden de abajo.” — y, debajo, “Cópialas desde tu perfil de Google, o de donde las hayas recogido. Pegarlas aquí es la forma más rápida de tenerlas hoy mismo en tu sitio.” FieldQuo no lee las reseñas de Google por usted; usted las copia, y usted decide qué se muestra." },
        ],
      },
      {
        id: "on-the-screen",
        heading: "Qué hay en la pantalla",
        blocks: [
          { bullets: [
            "Una línea que dice cuántas están publicadas: “**2 se muestran en tu sitio web.**” o “Ninguna se muestra todavía en tu sitio web: activa las que quieras.” Cuenta lo que el sitio público mostrará de verdad, con tope de seis, no cuántas filas tiene.",
            "**Una fila por reseña** — el nombre del cliente y lo que dijo, un interruptor **Mostrar en el sitio web** que dice “en tu sitio web” o “no se muestra”, **Subir** y **Bajar**, **Editar** y **Eliminar**.",
            "**Añadir una reseña** — **Nombre del cliente** y **Lo que dijo**, luego **Añadir reseña**.",
            "**Pegar una lista** — un cuadro para “Una reseña por bloque: el nombre en su propia línea, lo que dijo debajo y una línea en blanco entre cada una. También funciona el CSV de una hoja de cálculo: pégalo o elige un archivo.”, con **Elegir un archivo CSV** e **Importar**.",
            "**Tus reseñas en tu propio sitio web** — el código de inserción, para un sitio que ya tiene.",
          ] },
        ],
      },
      {
        id: "add-or-paste",
        heading: "Cómo agregar reseñas",
        blocks: [
          { steps: [
            "Abra **Configuración → Reseñas** y baje hasta **Reseñas en tu sitio web**.",
            "Para una sola reseña: escriba el **Nombre del cliente** y **Lo que dijo** y toque **Añadir reseña**. Para muchas: pegue bloques en **Pegar una lista** — el nombre, luego el texto, luego una línea en blanco — o toque **Elegir un archivo CSV** con columnas de nombre y reseña, y luego **Importar**. El resultado dice “5 añadidas, 0 actualizadas, 1 omitidas.”",
            "Las reseñas importadas empiezan apagadas. Toque **Mostrar en el sitio web** en cada una que quiera publicada.",
            "Use **Subir** y **Bajar** para fijar el orden. Las seis primeras reseñas encendidas son las que el sitio muestra.",
          ] },
          { figure: "harness:settings-reviews", caption: "Configuración → Reseñas — la tarjeta Reseñas en tu sitio web con su conteo de publicadas, bajo la configuración de solicitudes de reseña." },
        ],
      },
      {
        id: "what-each-control-changes",
        heading: "Qué cambia cada control",
        blocks: [
          { table: {
            head: ["Control", "Qué hace"],
            rows: [
              ["**Mostrar en el sitio web**", "Publica la reseña en su sitio web y en la inserción. Apagado, la reseña se queda en el archivo e invisible para el público. El conteo de publicadas se actualiza de inmediato."],
              ["**Subir** / **Bajar**", "Cambia el orden en el sitio. Solo se muestran las seis primeras reseñas encendidas, así que el orden decide cuáles entran."],
              ["**Editar**", "Cambia el nombre o el texto. Las comillas finales y los guiones sueltos se limpian al guardar."],
              ["**Eliminar**", "Borra la reseña tras una confirmación. No se puede deshacer; péguela de nuevo si hace falta."],
              ["**Importar**", "Lee bloques pegados o un CSV. Una reseña idéntica en nombre y texto a una ya archivada se actualiza en lugar de duplicarse; las líneas vacías o demasiado cortas se omiten y se cuentan."],
            ],
          } },
        ],
      },
      {
        id: "embed",
        heading: "En un sitio web que FieldQuo no construyó",
        blocks: [
          { p: "El bloque **Tus reseñas en tu propio sitio web** es un iframe más un pequeño script. Su nota dice lo que hace: muestra las reseñas que ha aprobado, con sus propios colores y sin ninguna marca de FieldQuo — y mientras no tenga ninguna, no muestra nada y se reduce a cero de alto, así que es seguro pegarlo antes de tener alguna. Mantenga el script junto al iframe; es lo que ajusta la altura. El mismo bloque se ofrece para el calendario de reservas y el presupuesto instantáneo — vea [[embed-booking-and-quote-forms|Insertar formularios de reserva y presupuesto]]." },
          { tip: "En un sitio construido por FieldQuo, las reseñas encendidas alimentan también la sección “Lo que dicen los clientes” y una página de Reseñas propia; regenerar el sitio las reconstruye a partir de esta lista. Vea [[website-pages-and-blocks|Páginas y bloques del sitio web]]." },
        ],
      },
      {
        id: "who-can-change-it",
        heading: "Quién puede cambiarlo",
        blocks: [
          { p: "Agregar, editar, encender, ordenar, eliminar e importar reseñas requieren todos el permiso **user:manage** — el propietario, un administrador, o un Gerente o Despachador — y la fila **Reseñas** de Configuración se muestra solo a ellos. Las reseñas se muestran tal como se escribieron; FieldQuo nunca reescribe las palabras de un cliente." },
        ],
      },
    ],
    faq: [
      { q: "¿FieldQuo trae mis reseñas de Google automáticamente?", a: "No. Cópielas desde su perfil de Google y péguelas — el cuadro de pegado acepta una lista simple o un CSV. No hay conexión con Google para las reseñas." },
      { q: "¿Por qué el conteo dice 2 si tengo 12 reseñas?", a: "Solo se cuentan las reseñas encendidas, y solo las seis primeras de esas. Diez de las suyas están apagadas o más allá de la sexta posición." },
      { q: "¿Las calificaciones del correo de solicitud de reseña se convierten en testimonios?", a: "No. Las respuestas del 1 al 5 alimentan el KPI de satisfacción y nunca se publican. Un testimonio es solo lo que usted agrega aquí." },
    ],
  },

  "referrals-from-clients": {
    title: "Recomendaciones de clientes",
    summary:
      "FieldQuo no tiene un programa de recomendación para propietarios — no hay enlace de recomendación para clientes ni recompensa para un cliente que le manda a un vecino. Lo que existe es Recomienda y gana, entre contratistas, y este artículo dice qué hacer con la recomendación de un cliente mientras tanto.",
    updated: "2026-09-12",
    intro: [
      "El boca a boca es como la mayoría de los contratistas consiguen su próximo trabajo, así que es justo preguntar si FieldQuo le da a un cliente un enlace para compartir o un crédito cuando su vecino reserva. No lo hace. La función de recomendación del producto — **Recomienda y gana** en la barra lateral y la página pública a la que enlaza — es el programa propio de FieldQuo, un contratista recomendando el software a otro. Nada en ella involucra a un propietario.",
      "Esta página lo dice claramente para que no busque un control que no existe, y luego cubre lo que el producto sí ofrece y cómo llevar registro de la recomendación de un cliente con lo que existe hoy.",
    ],
    sections: [
      {
        id: "overview",
        heading: "Qué no hace FieldQuo",
        blocks: [
          { bullets: [
            "**No hay enlace de recomendación para un cliente.** Una ficha de cliente no tiene código para compartir ni página de “recomienda a un amigo”. La página pública en /refer/… está dirigida a otro contratista, no a un propietario.",
            "**No hay recompensa para un cliente.** No se emite descuento, crédito ni visita gratis a un cliente por una recomendación, y no se rastrea ninguna recompensa así.",
            "**No hay campo de “recomendado por”.** Una ficha de cliente no registra quién lo recomendó, y un prospecto no lleva un cliente que lo refiera. La fuente del tablero de prospectos nombra el canal — el formulario del sitio web, el enlace de reservas, la recepcionista, una importación — no a una persona.",
            "**No hay correo ni mensaje de texto de recomendación a los clientes.** Nada le pide a un cliente que lo recomiende. La única petición automatizada después de un trabajo es la solicitud de reseña — vea [[review-requests|Solicitudes de reseña después de un trabajo]].",
          ] },
        ],
      },
      {
        id: "refer-and-earn",
        heading: "Qué es realmente Recomienda y gana",
        blocks: [
          { p: "**Recomienda y gana** — en el grupo **Crecer** de la barra lateral y de nuevo en **Configuración → Cuenta** — sirve para hablarle de FieldQuo a otro negocio. Su empresa tiene un enlace de recomendación; cuando otro contratista se registra con él, obtiene su primer mes gratis, y usted obtiene un mes agregado a su propia suscripción una vez que ese contratista realmente paga. Es un programa de contratista a contratista, administrado por FieldQuo, y quienes ven la página son el propietario y los administradores." },
          { figure: "live:app-settings-refer", caption: "Recomienda y gana — su enlace de recomendación, compartir por correo o mensaje de texto, y los negocios que ha recomendado con si cada uno ya fue acreditado." },
          { bullets: [
            "La recompensa es **un mes para cada lado**, y el suyo llega solo cuando la empresa recomendada hace su primer pago — nunca al registrarse.",
            "No puede recomendarse a sí mismo, y una empresa que ya existe no puede canjear un enlace.",
            "Todos los detalles: [[refer-another-business|Recomendar otro negocio]] y [[referral-months|Meses por recomendación]]. Lo que ve el otro contratista: [[the-referral-page|La página de recomendación]].",
          ] },
        ],
      },
      {
        id: "tracking-a-client-referral",
        heading: "Llevar registro de la recomendación de un cliente usted mismo",
        blocks: [
          { bullets: [
            "**Escríbalo en Notas.** En la ficha del cliente nuevo, ponga “Recomendado por Marie Tremblay” en **Notas**. Las notas son internas y se muestran en la ficha — vea [[client-notes|Notas del cliente]].",
            "**Registre lo que pagó por ella.** Si agradece a un cliente con una tarjeta de regalo o un descuento, anótelo en **Marketing → Gasto** con la plataforma **referral**, el monto, y los prospectos y conversiones que trajo. Aparece entonces en su costo por prospecto junto a Facebook y Google. Vea [[marketing-spend|Gasto en marketing]].",
            "**Pida reseñas en su lugar.** Una reseña en Google es la recomendación que escala, y esa sí la automatiza FieldQuo — vea [[ask-for-reviews-automatically|Pedir reseñas automáticamente]].",
          ] },
        ],
      },
    ],
    faq: [
      { q: "¿Habrá un programa de recomendación para clientes?", a: "Hoy no, y esta página lo dirá hasta que el producto lo haga. Cualquier cosa que lea en otro lado prometiendo una recompensa de recomendación para un propietario no describe a FieldQuo." },
      { q: "¿Un cliente puede usar mi enlace de Recomienda y gana?", a: "Solo si tiene un negocio de servicios en campo y se registra él mismo en FieldQuo. Eso le da un mes gratis del software, no nada en su trabajo con usted." },
      { q: "¿Puedo ver qué clientes llegaron por recomendación?", a: "Solo lo que usted escribió en Notas. No hay un informe de fuentes de recomendación por cliente." },
    ],
  },

  "duplicate-clients": {
    title: "Clientes duplicados",
    summary:
      "FieldQuo no tiene herramienta de fusión. Aquí está de dónde salen los duplicados, qué hace ya el producto para evitarlos al convertir prospectos e importar trabajos pasados, y cómo detectar y ordenar los que tiene.",
    updated: "2026-09-12",
    intro: [
      "Dos fichas para la misma persona es el estado normal de una lista de clientes que pasó por una importación de CSV y un año de prospectos. FieldQuo no le impide crear un segundo “J. Smith”, y no puede fusionar dos fichas en una después. Lo que hace es emparejar con cuidado en los dos lugares donde se crean fichas sin que una persona las escriba — la conversión de prospectos y la importación de trabajos pasados — y darle una búsqueda que encuentra los duplicados para que deje de usar uno de ellos.",
    ],
    sections: [
      {
        id: "overview",
        heading: "Descripción general",
        blocks: [
          { p: "Un cliente solo lo crean cinco cosas: el formulario **Nuevo cliente**, el formulario de nuevo cliente del constructor de presupuestos, el importador de CSV, convertir un prospecto, e importar trabajos pasados. Las tres primeras crean lo que usted les da. Las dos últimas buscan primero un cliente existente, con reglas distintas, porque un emparejamiento equivocado es peor que un duplicado — un presupuesto pegado al propietario equivocado es algo que nadie nota hasta que sale la factura." },
        ],
      },
      {
        id: "no-merge",
        heading: "No hay fusión",
        blocks: [
          { p: "No hay botón para combinar dos fichas de cliente, ni botón de eliminar en una ficha. Un cliente con algún presupuesto o factura nunca puede eliminarse, así que un duplicado con historial se queda. La respuesta práctica es elegir una ficha, seguir usándola, y dejar que la otra caiga en desuso — sus documentos siguen accesibles desde la lista de clientes." },
          { warning: "No “arregle” un duplicado recreando documentos en la otra ficha. Cada presupuesto, trabajo y factura conserva el cliente para el que se escribió, y moverlos no es posible desde la pantalla." },
        ],
      },
      {
        id: "where-they-come-from",
        heading: "De dónde salen los duplicados",
        blocks: [
          { bullets: [
            "**La importación de CSV** crea un cliente por cada fila que tiene nombre. No verifica si el nombre, el correo o el teléfono ya existen, así que importar dos veces el mismo archivo duplica la lista. Las filas sin nombre, o con un correo no entregable, se omiten y se cuentan.",
            "**Escribir un cliente en el constructor de presupuestos** cuando la misma persona ya existe con una ortografía ligeramente distinta. La búsqueda del selector es su defensa — busque antes de agregar.",
            "**Una consulta repetida con un correo o teléfono nuevos.** La conversión de prospectos empareja primero por correo, luego por teléfono; un cliente que consulta desde una dirección nueva y un número nuevo, sin coincidencia, se convierte en una segunda ficha.",
            "**Empresa versus persona.** “Renovaciones Beaulieu” creada como empresa y “Marc Beaulieu” creado como propietario son dos fichas a propósito — una es el negocio, la otra es la persona.",
          ] },
        ],
      },
      {
        id: "how-fieldquo-avoids-them",
        heading: "Qué hace FieldQuo para evitarlos",
        blocks: [
          { table: {
            head: ["Dónde", "Cómo empareja"],
            rows: [
              ["Convertir un prospecto en presupuesto", "El correo del prospecto se normaliza y se busca primero; luego el teléfono. Una coincidencia reutiliza ese cliente. Solo sin ninguno de los dos se crea una ficha nueva. Vea [[convert-a-lead-to-a-quote|Convertir un prospecto en presupuesto]]."],
              ["Importar trabajos pasados", "Cada fila se empareja solo por el nombre del cliente, exacto pero sin distinguir mayúsculas, y la vista previa dice “cliente existente” antes de escribir nada. Un correo distinto en la fila no impide una coincidencia por nombre. Dos nombres idénticos en el archivo se resuelven hacia la ficha más antigua. Vea [[import-past-jobs|Importar trabajos pasados]]."],
              ["La revisión mensual en Mensajes", "Una conversación de Facebook o Instagram se vincula a un cliente solo por un correo o teléfono exactos, o un nombre que también coincide en la dirección. Un nombre solo nunca se vincula, y un empate se informa en lugar de decidirse. Vea [[the-monthly-review|La revisión mensual]]."],
              ["Importar clientes desde un CSV", "Sin emparejamiento. Cada fila con nombre se convierte en un cliente — vea arriba."],
            ],
          } },
        ],
      },
      {
        id: "spot-and-tidy",
        heading: "Cómo detectar y ordenar los duplicados",
        blocks: [
          { steps: [
            "En **Clientes**, busque primero por **número de teléfono**, luego por **correo**: son los dos datos que una persona tuvo que darle, y dos tarjetas para un mismo número es un duplicado seguro. Busque por apellido al final — dos tarjetas “Tremblay” en una misma ciudad suelen ser dos hogares.",
            "Abra ambas fichas. Los pies de las tarjetas le dicen cuál tiene el historial — “3 cotizaciones · 1 factura” contra “0 cotizaciones · 0 facturas”.",
            "Quédese con la ficha que tiene el historial. Copie lo que sea útil de la otra — una nota, el país, el idioma — en ella con **Editar**.",
            "En la ficha que retira, ponga “DUPLICADO — usar la otra ficha” al principio de **Notas**, y deje de seleccionarla en el constructor de presupuestos. Si no tiene ningún documento, pídale a soporte que la quite.",
          ] },
          { tip: "Antes de una importación de CSV, busque algunos nombres del archivo. Si ya están, recorte el archivo a las filas nuevas nada más — el importador no lo hará por usted." },
        ],
      },
    ],
    faq: [
      { q: "¿FieldQuo me avisará cuando agregue un cliente que ya existe?", a: "No. Ni el formulario Nuevo cliente ni el constructor de presupuestos verifican un nombre, correo o teléfono existente. Busque primero." },
      { q: "¿Soporte puede fusionar dos fichas por mí?", a: "No hay fusión en el producto, tampoco para soporte. Soporte puede quitar una ficha que no tiene presupuestos ni facturas; una ficha con documentos se queda." },
      { q: "¿Importar dos veces un CSV crea duplicados?", a: "Sí, un juego completo. El importador crea cada fila con nombre y no empareja con los clientes existentes." },
    ],
  },
};
