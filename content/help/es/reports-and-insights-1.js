// content/help/es/reports-and-insights-1.js
//
// Parte 1 de la categoría «reports-and-insights» en español (ver el
// compositor, reports-and-insights.js). Slugs de esta parte
// (lib/help/tree.js): the-dashboard-in-detail, the-revenue-goal,
// how-you-compare, the-kpi-dashboard, kpi-sales, kpi-money-flow,
// kpi-business-costs, kpi-profit, kpi-execution, kpi-quality, kpi-cash.
//
// Misma estructura que el módulo en inglés; las palabras en pantalla vienen
// del bloque `es` de app/i18n/appMessages.js. El editor de accesos
// (lib/permissions.js) no está traducido en la aplicación: sus niveles
// predefinidos (Crew, Estimator, Dispatcher, Manager) y sus escalones (View
// only, See prices…) se citan tal como aparecen en pantalla.
export const ARTICLES = {
  "the-dashboard-in-detail": {
    title: "El panel en detalle",
    summary:
      "Cada tarjeta del Inicio, de arriba abajo: lo que está pendiente de usted, la cifra de ingresos y los cuatro recuadros, el detalle debajo, el botón Reclamar el pago, y quién ve cada panel.",
    updated: "2026-09-12",
    intro: [
      "**Panel — Esto es lo que pasa con tu negocio.** El Inicio es la pantalla que su equipo abre más veces, así que está ordenada por importancia y no en mosaico: lo que necesita a una persona hoy va primero, después la única cifra con la que funciona el negocio, después cuatro cifras de apoyo, y todo lo demás bajo una línea llamada **El detalle**. Este artículo la recorre de arriba abajo y dice de dónde sale cada número.",
      "[[the-dashboard|El panel: lo que está pendiente de usted]] es la versión corta — el orden y su porqué. Este es el detalle: cada tarjeta, cada estado que puede tener una tarjeta, cada botón, y qué nivel de acceso ve qué.",
    ],
    sections: [
      {
        id: "overview",
        heading: "Resumen",
        blocks: [
          { p: "Cada cifra de la página se obtiene de un puñado de puntos de acceso, y cada panel se dibuja solo cuando su punto de acceso respondió. A un miembro al que el servidor le negó un panel simplemente no le aparece ese panel — ni un cero, ni una disculpa — porque «$0 de ingresos este mes» es una afirmación sobre el negocio, no un espacio en blanco. Un panel que falló por cualquier otro motivo lo dice y ofrece reintentar." },
          { p: "Dos medidas del dinero van una junto a la otra y nunca se mezclan. **Ingresos este mes** suma las facturas marcadas como pagadas este mes, por la fecha en que se pagaron. **Dinero recibido** cuenta los pagos por el mes en que llegó el dinero. Una factura marcada como pagada en agosto con un anticipo registrado en julio da dos cifras distintas a propósito, y la leyenda bajo el gráfico dice cuál es cuál." },
        ],
      },
      {
        id: "waiting-on-you",
        heading: "Pendientes de ti",
        blocks: [
          { p: "**Pendientes de ti** abre la página y lista las facturas realmente atrasadas — el cliente, el monto, **12 días de retraso**, el número de factura — con un botón **Reclamar el pago** en cada una. Se nombran hasta cinco filas; pasadas esas, un enlace **{count} más vencidas** abre la lista de Facturas. Una factura sin fecha de vencimiento nunca está aquí: no tiene ningún plazo que incumplir." },
          { bullets: [
            "**2 cotizaciones a la espera de que apruebes el precio.** — estimaciones instantáneas de su sitio web o de una llamada, esperando en [[estimate-reviews|Revisiones de presupuesto]] a que una persona confirme el precio.",
            "**3 llamadas de tu recepcionista — nada hecho todavía.** — llamadas que atendió la recepcionista de IA y que ni se convirtieron en presupuesto ni se archivaron. La línea abre la pantalla Recepcionista.",
            "**Tiene 1 cita en agenda desde sus llamadas: la próxima es …** — las visitas que reservó la recepcionista y que aún están por delante. La línea abre el calendario.",
          ] },
          { figure: "harness:home", caption: "Panel — Pendientes de ti arriba, luego Ingresos este mes junto a la curva de Dinero recibido, luego los cuatro recuadros." },
          { note: "El bloque desaparece solo cuando nada está atrasado y nada espera. Un día tranquilo no tiene aviso, y eso es lo que hace que el aviso signifique algo en un día cargado." },
        ],
      },
      {
        id: "revenue-and-the-four-tiles",
        heading: "Ingresos este mes y los cuatro recuadros",
        blocks: [
          { p: "**Ingresos este mes** es el total de las facturas marcadas como pagadas desde el día 1, en letra grande, con la leyenda «El total de las facturas marcadas como pagadas este mes.» Debajo, un cambio frente al mes pasado — «CA$2,480.50 más que el mes pasado.» — aparece solo cuando la empresa existía durante todo el mes pasado; una empresa en su primer mes recibe la cifra y ninguna tendencia inventada. A la derecha, **Dinero recibido** dibuja los últimos seis meses de pagos como una línea, con una frase que compara los dos últimos meses completos — nunca el mes en curso contra uno terminado." },
          { table: {
            head: ["Recuadro", "Qué cuenta", "La línea de cambio debajo"],
            rows: [
              ["**Cotizaciones enviadas este mes**", "Los presupuestos creados este mes cuyo estado es enviado, aceptado o rechazado.", "«2 más que el mes pasado.» — solo cuando el mes pasado fue un mes completo de actividad."],
              ["**Tasa de conversión**", "Presupuestos aceptados este mes ÷ presupuestos enviados este mes, impreso con sus recuentos al lado: «38%» y luego «6 de 16 · % de presupuestos enviados que los clientes aceptaron».", "«9 puntos más que el mes pasado.» — solo cuando ambos meses tuvieron al menos 10 presupuestos enviados."],
              ["**Dinero que te deben**", "Lo que queda pendiente en todas las facturas impagadas — la última versión de cada una, menos los pagos registrados contra ella — y «{amount} de eso está vencido.»", "Ninguna. Un saldo no tiene una cifra honesta del mes pasado con la que compararse."],
              ["**Próximas visitas**", "Cada cita, visita de trabajo y reserva retenida que todavía está por delante de hoy.", "Ninguna. Lo que está por delante no tiene periodo anterior."],
            ],
          } },
          { p: "Con menos de 10 presupuestos enviados, el recuadro de conversión muestra solo los recuentos — «1 de 1», y luego «Presupuestos aceptados. Un porcentaje necesita 10 enviados en el mes para significar algo.» Un porcentaje sacado de dos presupuestos es un número sobre el que usted actuaría y sobre el que no debería. Dinero que te deben tiene tres estados y ninguno es $0.00: «Aún no hay facturas, así que no te deben nada.», «Nada pendiente — todas las facturas que has enviado están saldadas.», o la cifra." },
        ],
      },
      {
        id: "the-detail",
        heading: "El detalle",
        blocks: [
          { p: "Tres botones están entre los recuadros y la línea: **+ Nuevo presupuesto** (dibujado solo para quien puede crear presupuestos), **Ver clientes** y **Programar cita**. Bajo **El detalle**, la página conserva todo aquello con lo que solía abrirse:" },
          { bullets: [
            "**Dinero recibido** — el gráfico de barras mensual con los botones **3 meses / 6 meses / 12 meses**. El mes en curso se dibuja en gris y con la leyenda de que aún no termina; un mes sin nada no recibe barra alguna.",
            "**Dinero que te deben** — el total «Repartido en {count} facturas impagadas», el monto vencido, la escalera de antigüedad (**Aún no vence**, **1–30 días**, **31–60 días**, **61–90 días**, **90+ días**, más **Sin fecha de vencimiento**) que muestra solo los peldaños con algo encima, luego hasta seis facturas con los datos de contacto del cliente, **modificada, v2** cuando hubo una revisión, un enlace **Trabajo**, las líneas **Último recordatorio el … · 2×** y **Recordatorio automático enviado el …**, y el botón Reclamar el pago. El pie dice si existe un recordatorio automático de vencimiento, con **Configurar uno** o **Cambiarlo**. Todo el detalle: [[money-owed-and-receivables-aging|Dinero adeudado y antigüedad de las cuentas por cobrar]].",
            "**Revenue goal** — la meta anual y su ritmo frente a ella; vea [[the-revenue-goal|La meta de ingresos]].",
            "Las reservas retenidas por una tarifa de visita que aún no se ha pagado — no están en ningún calendario, así que este es el único lugar donde aparecen. Ausentes cuando no hay ninguna.",
            "**Cotizaciones recientes** — las cinco más nuevas, con **Ver todo**. Ausente para un miembro que no puede ver presupuestos.",
            "**Próximas citas** — las cinco siguientes de la agenda, con **Ver todo**. Un miembro que solo ve su propio horario ve aquí las suyas.",
          ] },
          { p: "Encima del dinero, una empresa nueva ve también **Termina de configurar FieldQuo** con su anillo de progreso hasta que cada paso esté hecho, y un propietario o administrador ve **Pasos de configuración adicionales** — diez filas que desaparecen una a una cuando la base de datos dice que el paso está hecho, o cuando usted pulsa **Hecho, ocultar**." },
        ],
      },
      {
        id: "how-to-chase",
        heading: "Cómo reclamar un pago desde el Inicio",
        blocks: [
          { steps: [
            "Encuentre la factura en **Pendientes de ti** (si está atrasada) o en **Dinero que te deben** (atrasada o no) y pulse **Reclamar el pago**.",
            "FieldQuo envía al cliente, por correo y a nombre de su empresa, una solicitud de pago con un enlace a su portal, y deja constancia en la factura. La fila pasa a decir «Solicitud de pago enviada a {address} a las {time}».",
            "Si el cliente no tiene correo registrado, la fila lo dice en lugar de mostrar un botón. **Último recordatorio el … · 2×** cuenta sus reclamos; **Recordatorio automático enviado el …** muestra lo que la regla de vencimiento de [[invoice-reminders-and-chasing|Recordatorios de factura y reclamos de pago]] ya hizo por su cuenta.",
          ] },
        ],
      },
      {
        id: "who-can-see-it",
        heading: "Quién puede verlo",
        blocks: [
          { p: "El Inicio está en la barra lateral de todos, pero cada panel tiene su propia puerta, comprobada por el servidor. El dinero — la cifra de ingresos, tres de los cuatro recuadros, Dinero recibido y Dinero que te deben — necesita el interruptor **See prices**; Dinero que te deben necesita además al menos **View only** en facturas. Cotizaciones recientes necesita View only en presupuestos. El botón Reclamar el pago necesita **View, create, and edit** en facturas. Las tarjetas de configuración son para propietarios y administradores." },
          { p: "Con los cuatro niveles predefinidos: **Crew** ve las Próximas visitas y sus propias Próximas citas, y nada sobre dinero; **Estimator**, **Dispatcher** y **Manager** ven toda la página; y solo un Manager, un propietario o un administrador puede pulsar Reclamar el pago. Los paneles que un miembro no puede ver están ausentes, no en cero. Vea [[access-levels-overview|Niveles de acceso: quién ve qué]]." },
        ],
      },
    ],
    faq: [
      { q: "¿Por qué Ingresos este mes y Dinero recibido no coinciden?", a: "Miden cosas distintas: las facturas marcadas como pagadas este mes, y los pagos por el mes en que llegó el dinero. Un anticipo recibido en julio sobre una factura marcada como pagada en agosto aparece en la barra de julio y en la cifra de agosto." },
      { q: "¿Por qué no hay línea de cambio bajo Ingresos este mes?", a: "La comparación exige que el mes pasado haya sido un mes completo de actividad. Una empresa que se registró el día 15 recibe la cifra y ninguna tendencia hasta que pase su primer mes completo." },
      { q: "Un miembro del equipo no ve nada bajo Dinero que te deben. ¿Está roto?", a: "No — a ese miembro se le negó la cifra, normalmente porque See prices está apagado o las facturas están en No access. Un panel negado se omite en lugar de mostrarse como $0." },
    ],
  },

  "the-revenue-goal": {
    title: "La meta de ingresos",
    summary:
      "Fije una meta anual una sola vez y el Inicio le dice si hoy va por delante o por detrás de ella, en dólares — cómo se calculan el ritmo, la proyección y la cifra mensual, y quién puede cambiar la meta.",
    updated: "2026-09-12",
    intro: [
      "La tarjeta **Revenue goal** del Inicio es una meta anual que usted fija una vez, y una barra de ritmo que dice si hoy va por delante o por detrás de ella. Empieza por el ritmo, en dólares, porque «$180,000 de $500,000» no significa nada sin la fecha — 36% es un triunfo en abril y un desastre en noviembre.",
      "Todo lo que hay en la tarjeta se calcula a partir del único número que usted escribe. No se guarda nada más: las metas mensual y semanal, el ritmo y la proyección se derivan, así que nunca pueden desviarse de la cifra anual.",
    ],
    sections: [
      {
        id: "overview",
        heading: "Resumen",
        blocks: [
          { p: "La meta pertenece a la empresa, no a una persona: una sola meta, fijada por un propietario o administrador, mostrada a todos los que ven el dinero del panel. El progreso se mide con la misma cifra que **Ingresos este mes** — facturas marcadas como pagadas, por la fecha en que se pagaron — ampliada al año, de modo que la tarjeta de la meta y la tarjeta de ingresos nunca puedan contar dos historias distintas sobre el mismo dinero." },
          { p: "Sin meta fijada, un propietario o administrador ve la tarjeta como la invitación a fijar una — «Set a target for the year and the dashboard will track your pace toward it.» con un botón **Set a revenue goal** — y todos los demás no ven tarjeta alguna. No hay una invitación muerta para quien no puede actuar sobre ella." },
        ],
      },
      {
        id: "set-the-goal",
        heading: "Cómo fijar, cambiar o borrar la meta",
        blocks: [
          { steps: [
            "Abra el **Inicio** y baje hasta **El detalle**. Pulse **Set a revenue goal**, o el lápiz de una tarjeta existente (**Change goal**).",
            "Escriba la meta del año en la casilla **$ … / year**. Mientras escribe, la tarjeta dice cuánto es eso por mes y por semana — «That's about $41,667/month, $9,615/week.»",
            "Pulse **Save**. La cifra se redondea a dólares enteros y se limita a $100,000,000, para que un cero de más tecleado por error se detecte en lugar de guardarse y volver imposible cada meta sin que nadie lo note.",
            "Para quitarla, vuelva a abrir el editor y pulse **Clear goal**. Guardar en blanco o con un cero la borra de la misma manera.",
          ] },
          { note: "Fijar o borrar la meta se anota en el Registro de actividad como «Set the revenue goal to …» o «Cleared the revenue goal», a nombre de quien lo hizo." },
        ],
      },
      {
        id: "what-the-card-shows",
        heading: "Qué muestra la tarjeta",
        blocks: [
          { table: {
            head: ["Línea", "Qué significa"],
            rows: [
              ["**Revenue goal · $500,000/yr**", "La meta anual que guardó."],
              ["**$180,000 this year**", "Facturas marcadas como pagadas desde el 1 de enero, por fecha de pago."],
              ["**On pace** / **$22,000 behind pace** / **$9,000 ahead of pace**", "Los ingresos hasta hoy frente a lo que un ritmo constante habría producido a día de hoy. Por detrás es ámbar; en ritmo y por delante son verdes."],
              ["La barra y la marca", "El relleno es el progreso hacia la meta; la marca pequeña es donde un ritmo constante lo tendría hoy. Un relleno que no llega a la marca va por detrás; pasada la marca, por delante."],
              ["**36% of goal**", "Los ingresos hasta hoy como parte de la meta anual."],
              ["**$41,667/mo · projecting $480k**", "La meta anual entre doce, y dónde termina el año si se mantiene el ritmo diario de hoy."],
            ],
          } },
        ],
      },
      {
        id: "how-pace-is-worked-out",
        heading: "Cómo se calcula el ritmo",
        blocks: [
          { bullets: [
            "**Lo esperado a la fecha** es la meta anual multiplicada por la fracción del año transcurrida, contada en días naturales del calendario UTC — 366 en año bisiesto, para que la cuenta nunca se desvíe un día.",
            "**On pace** significa que los ingresos hasta hoy están dentro de un 2% de esa cifra esperada, hacia arriba o hacia abajo — una banda de tolerancia, para que la tarjeta no parpadee entre por delante y por detrás con cada venta.",
            "**Projecting** mantiene el ritmo diario de hoy durante el resto del año. En los primeros días de enero, un trabajo grande proyecta un número disparatado; por eso la proyección va en letra pequeña junto a la meta mensual y no como titular.",
            "La meta mensual es la anual entre 12, sin más; la semanal entre 52; la diaria entre 365. No se inventa ninguna curva estacional — el marzo y el diciembre de un pintor no son iguales, y la tarjeta no pretende saber por cuánto.",
          ] },
        ],
      },
      {
        id: "who-can-see-it",
        heading: "Quién puede verlo",
        blocks: [
          { p: "Cualquiera que vea el dinero del panel — el interruptor **See prices** — ve la tarjeta en cuanto existe una meta. Solo un **propietario** o un **administrador** puede fijarla, cambiarla o borrarla: el servidor rechaza a todos los demás, y el lápiz no se dibuja para ellos. Un Manager ve el ritmo pero no puede mover la meta." },
          { note: "Las palabras de esta tarjeta todavía no están en el catálogo de traducción. Se lee en inglés — «Revenue goal», «On pace», «behind pace» — sea cual sea el idioma del resto de la aplicación." },
        ],
      },
    ],
    faq: [
      { q: "¿Puedo fijar una meta mensual en su lugar?", a: "No directamente. Usted fija el año y la tarjeta deriva el mes (la anual entre 12) y la semana (entre 52). Una cifra mensual guardada se desviaría de la anual en cuanto se editara cualquiera de las dos." },
      { q: "¿La meta cuenta presupuestos aceptados o facturas enviadas?", a: "Ninguno de los dos. Cuenta las facturas marcadas como pagadas este año, por la fecha en que se pagaron — la misma medida que Ingresos este mes." },
      { q: "¿Por qué la proyección parece equivocada en enero?", a: "Mantiene el ritmo diario acumulado hasta ahora durante el resto del año, y unos pocos días de datos dan un mal ritmo. Se estabiliza a medida que el año se va llenando." },
    ],
  },

  "how-you-compare": {
    title: "Cómo te comparas: sus precios frente a la plataforma",
    summary:
      "Análisis se abre con una comparación de precios anonimizada: su promedio por categoría de servicio frente al promedio de todas las empresas que aceptaron participar — cómo participar, qué entra exactamente en el promedio, y qué nunca muestra la página.",
    updated: "2026-09-12",
    intro: [
      "**Cómo te comparas — El precio promedio de tus cotizaciones frente al promedio anonimizado de la plataforma, por categoría de servicio.** Análisis se abre en esta página: para cada categoría de servicio que usted activó, lo que cobra en promedio frente a lo que cobran todas las demás empresas que aceptaron participar, y la diferencia en porcentaje.",
      "Es opcional, son solo agregados, y nunca muestra el presupuesto de otra empresa. Todos los demás informes de FieldQuo responden únicamente sobre sus propios datos; esta es la única pantalla donde aparecen números de otros inquilinos, agrupados y anonimizados. Este artículo dice exactamente qué entra en el promedio y qué no.",
    ],
    sections: [
      {
        id: "overview",
        heading: "Resumen",
        blocks: [
          { p: "La página es una fila por categoría, bajo una fila de enlaces — **Resúmenes semanales**, **Estados financieros**, **Ganadas y perdidas**, **Precisión de las estimaciones**, **Panel de KPI** — porque la barra lateral tiene una sola fila **Análisis** para todo el grupo. Hasta que usted acepte participar, las filas se sustituyen por «La evaluación comparativa es opcional. Actívala en Configuración para ver cómo se comparan tus precios — tus cotizaciones individuales nunca se comparten, solo promedios agregados.» con un botón **Ir a Configuración**." },
          { figure: "live:app-analytics-benchmark", caption: "Análisis → Cómo te comparas antes de participar — la nota, el botón Ir a Configuración y los enlaces al resto del grupo." },
        ],
      },
      {
        id: "turn-it-on",
        heading: "Cómo activarlo",
        blocks: [
          { steps: [
            "Abra **Configuración → Configuración de la empresa** y busque la tarjeta **Comparativa del sector**.",
            "Marque **Compartir mis cifras anónimas para desbloquear las comparativas** y guarde. La pista de debajo es todo el trato: «Tus cifras se agrupan con las de otras empresas y nunca se muestran individualmente. Puedes desactivarlo cuando quieras.»",
            "Vuelva a **Análisis**. Aparece una fila por cada categoría que usted tiene activada donde la muestra de la plataforma es lo bastante grande.",
            "Para salir, desmarque la casilla y guarde. Sus cifras dejan de alimentar el conjunto y la página vuelve a la nota de participación.",
          ] },
          { note: "El intercambio es simétrico: el conjunto se construye solo con las empresas que marcaron la casilla, así que usted lo lee solo mientras contribuye a él." },
        ],
      },
      {
        id: "what-is-on-the-screen",
        heading: "Qué hay en la pantalla",
        blocks: [
          { figure: "harness:insights", caption: "Cómo te comparas — una fila por categoría: su promedio, el promedio de la plataforma y la diferencia." },
          { table: {
            head: ["Columna", "Qué es"],
            rows: [
              ["La categoría, y «61 cotizaciones en tu región este trimestre»", "Una categoría de servicio de Configuración → Servicios, y el tamaño de la muestra de la plataforma de la que sale el promedio."],
              ["**Tu promedio**", "El monto valorado promedio de los grupos de alcance de esa categoría en sus propios presupuestos."],
              ["**Promedio de la plataforma**", "El mismo promedio sobre los presupuestos de todas las empresas participantes en esa categoría."],
              ["La flecha y el porcentaje", "Usted frente a la plataforma: verde con flecha hacia arriba por encima de +3%, ámbar con flecha hacia abajo por debajo de −3%, un guion gris entre medias. Un guion sin porcentaje significa que no había nada con lo que comparar."],
            ],
          } },
        ],
      },
      {
        id: "how-the-average-is-built",
        heading: "Cómo se construye el promedio",
        blocks: [
          { bullets: [
            "Ambos promedios se toman sobre **grupos de alcance** — las secciones en que se agrupa un presupuesto por categoría — no sobre presupuestos enteros. Un presupuesto de cocina con un grupo de gabinetes y un grupo de cubiertas contribuye a dos filas.",
            "Una fila aparece solo cuando usted tiene al menos un grupo valorado en esa categoría y la plataforma tiene al menos **5**. Por debajo de cinco, el precio de un competidor podría deducirse del promedio, así que no se publica nada.",
            "Las empresas de demostración quedan fuera del conjunto digan lo que digan sus propios ajustes — unos precios inventados no tienen por qué decirle a un contratista real lo que cobra el mercado.",
            "Cuando ningún grupo de una muestra tiene monto valorado, el promedio muestra **—** en lugar de $0.00, y no se saca ningún porcentaje de él.",
            "La aritmética hoy no tiene ventana de fechas ni filtro de región: promedia cada grupo de alcance valorado de la categoría, de todos los tiempos, para usted y para el conjunto. La redacción de la línea de muestra sobre región y trimestre va por delante del código.",
          ] },
        ],
      },
      {
        id: "only-in-fieldquo",
        heading: "Lo que las otras herramientas no hacen",
        blocks: [
          { p: "Las páginas de comparación de FieldQuo registran lo que la propia página de precios de cada competidor enumera, con la fecha en que se leyó. Ninguna de las cinco páginas de precios seguidas — Jobber, Housecall Pro, ServiceTitan, Projul y QuoteIQ — enumera una comparación de sus precios con los de otras empresas de la misma plataforma, así que esta página aparece bajo «no figura en su página de precios» en cada comparación." },
          { p: "Esa es toda la afirmación. No dice que los demás no pudieran construir una; dice que no la venden en la página que lee un comprador." },
        ],
      },
      {
        id: "who-can-see-it",
        heading: "Quién puede verlo",
        blocks: [
          { p: "La página y su punto de acceso necesitan el interruptor **See prices** — cada número que hay en ella es dinero, incluida su propia lista de tarifas. Crew queda rechazado; Estimator, Dispatcher, Manager, propietarios y administradores pueden leerla. La casilla de participación vive en Configuración de la empresa, que necesita el permiso de gestión de personas — Dispatcher, Manager, propietario o administrador." },
        ],
      },
    ],
    faq: [
      { q: "¿Otra empresa puede ver mis presupuestos?", a: "No. Solo se muestra un promedio sobre al menos cinco grupos de alcance del conjunto, y una categoría con menos de cinco no se muestra en absoluto." },
      { q: "¿Por qué falta una categoría en la lista?", a: "O usted no tiene ningún presupuesto valorado en ella, o todavía existen menos de cinco presupuestos de la plataforma para ella. La página dice «Aún no hay suficientes datos de la plataforma para tu región/categoría» cuando nada cumple." },
      { q: "¿Participar cambia lo que ven mis clientes?", a: "No. No cambia nada en presupuestos, facturas ni en la página de reservas — solo si sus cifras se unen al conjunto y si esta página muestra filas." },
    ],
  },

  "the-kpi-dashboard": {
    title: "El panel de KPI",
    summary:
      "Una sola pantalla para ventas, flujo de dinero, costos del negocio, ganancia, ejecución, calidad, efectivo y cliente — los botones de periodo, qué contiene cada sección, cómo se lee una tarjeta sin datos, y quién puede abrirla.",
    updated: "2026-09-12",
    intro: [
      "**Panel de KPI — Ventas, ganancia, ejecución y efectivo en un solo lugar — la mayoría de estos números nunca había tenido pantalla. Una tarjeta sin datos dice por qué, en vez de mostrar un cero.** Ese subtítulo es el diseño: un selector de periodo, nueve secciones, y una regla por la que una tarjeta o imprime un número que puede defender o dice con palabras por qué no puede.",
      "Este artículo es el mapa de la pantalla — los botones de periodo, las secciones y lo que contiene cada una, cómo leer una tarjeta, y quién puede abrir la página. Cada sección tiene su propio artículo con la definición exacta de cada tarjeta.",
    ],
    sections: [
      {
        id: "overview",
        heading: "Resumen",
        blocks: [
          { p: "La página vive bajo **Análisis → KPI** en la barra lateral, con un enlace **Cómo te comparas** de vuelta al centro de Análisis. Nada en ella se calcula por segunda vez: la tasa de cierre es la del informe Ganadas y perdidas, las cuentas por cobrar son las del panel, la precisión de la estimación es la del informe Precisión de las estimaciones — así que una cifra de aquí nunca puede contradecir la pantalla de la que salió." },
          { figure: "live:app-analytics-kpis", caption: "Panel de KPI — los botones de periodo, luego Ventas, Flujo de dinero, Costos del negocio, Ganancia y Ejecución, cada tarjeta imprimiendo un número o el motivo por el que no puede." },
        ],
      },
      {
        id: "the-period",
        heading: "El periodo",
        blocks: [
          { p: "Cinco botones eligen el periodo, y una sola elección gobierna todas las secciones. El predeterminado es **Este trimestre**. Los periodos son periodos de calendario en UTC — el mismo calendario que usan todos los informes — así que dos pantallas nunca discrepan sobre a qué mes pertenece un documento." },
          { bullets: [
            "**Este mes** — del día 1 al último día del mes en curso.",
            "**El mes pasado** — todo el mes anterior.",
            "**Este trimestre** — el trimestre natural en curso, hasta su último día.",
            "**Lo que va del año** — del 1 de enero a hoy.",
            "**El año pasado** — del 1 de enero al 31 de diciembre del año pasado.",
          ] },
          { note: "Este mes y Este trimestre llegan hasta el final del periodo, no hasta hoy. Las tarjetas que comparan con un periodo anterior lo tienen en cuenta — vea [[kpi-money-flow|KPI: Flujo de dinero]] — para que un trimestre de tres días no se mida contra uno completo." },
        ],
      },
      {
        id: "the-sections",
        heading: "Las secciones",
        blocks: [
          { table: {
            head: ["Sección", "Tarjetas", "Artículo"],
            rows: [
              ["**Ventas**", "Tasa de cierre · Valor promedio del trabajo · Conversión de prospecto → presupuesto · Trabajo por delante", "[[kpi-sales|KPI: Ventas]]"],
              ["**Flujo de dinero**", "Ingresos · Gastos · Queda · Ingresos frente a gastos, por día · En qué se fue el dinero", "[[kpi-money-flow|KPI: Flujo de dinero]]"],
              ["**Costos del negocio**", "Nómina de este periodo · Costos fijos · Gasto en marketing · Comprometido, todavía sin facturar", "[[kpi-business-costs|KPI: Costos del negocio]]"],
              ["**Ganancia**", "Margen bruto (trabajo típico) · Margen neto (trabajo típico) · Costo de mano de obra, % de los ingresos · Ingresos por empleado", "[[kpi-profit|KPI: Ganancia]]"],
              ["**Ejecución**", "Terminados a tiempo · Aprovechamiento de la mano de obra · Precisión de la estimación (variación mediana) · Trabajos recientes: ventana programada frente a la finalización", "[[kpi-execution|KPI: Ejecución]]"],
              ["**Calidad**", "Tasa de retrabajo y regresos · Tasa de órdenes de cambio", "[[kpi-quality|KPI: Calidad]]"],
              ["**Efectivo**", "Cuentas por cobrar, por antigüedad · Dinero recibido, últimos 6 meses", "[[kpi-cash|KPI: Efectivo]]"],
              ["**Cliente**", "Satisfacción del cliente · Respuestas por puntuación", "[[kpi-customer|KPI: Cliente]]"],
              ["**Sin seguimiento**", "Las métricas que la página nombra y se niega a inventar", "[[the-metrics-fieldquo-refuses-to-invent|Las métricas que FieldQuo se niega a inventar]]"],
            ],
          } },
        ],
      },
      {
        id: "how-a-card-reads",
        heading: "Cómo leer una tarjeta",
        blocks: [
          { bullets: [
            "Un **valor** en letra grande, y debajo la muestra de la que salió — «24 trabajos/presupuestos». Una tasa sin su denominador es un número que hay que creerse en lugar de comprobar, así que el recuento siempre va al lado.",
            "Un **—** y una frase cuando no hay valor: «1 de 10 hasta ahora — con 9 más, este dato será fiable.», «No se terminó ningún trabajo en este periodo.», «Todavía no hay prospectos en este periodo.» La frase es el motivo de la tarjeta, nunca un relleno.",
            "Un **triángulo de advertencia** cuando el número es real pero se sabe que está incompleto — horas sin tarifa de pago, materiales comprados de la lista de compras y nunca registrados como gasto — con «faltan datos, ver abajo». La cifra se muestra; no se promedia por encima del hueco.",
            "Dos umbrales. Un **porcentaje** (tasa de cierre, conversión, terminados a tiempo, retrabajo, órdenes de cambio) necesita **10** resultados decididos; una **cifra central** sobre trabajos (valor promedio del trabajo, los márgenes, el costo de mano de obra, la satisfacción) necesita **5**. Por debajo del umbral, la tarjeta cuenta lo que tiene y dice cuántos más necesita.",
            "Un **≈** delante de una cifra de dinero significa que parte de ella se convirtió desde otra moneda al tipo de cambio fijado; la pista bajo el recuadro nombra el monto original y la antigüedad del tipo.",
          ] },
        ],
      },
      {
        id: "only-in-fieldquo",
        heading: "Lo que las otras herramientas no hacen",
        blocks: [
          { p: "Este panel todavía no está en la tabla comparativa pública de FieldQuo — la matriz de funciones lo deja fuera hasta que exista una página de funciones para él, en lugar de reclamar una fila que nadie puede leer. Lo que hace el código y un panel genérico no: una tarjeta por debajo de su umbral de muestra no imprime porcentaje alguno, una cifra que se sabe incompleta se señala en lugar de suavizarse, y una sección llamada **Sin seguimiento** nombra las métricas que no va a fabricar." },
          { p: "Donde un competidor ofrece una parte de esto, la matriz lo dice: el costeo de trabajos está en el nivel Grow de Jobber y en el nivel Pro de QuoteIQ, y por eso [[job-costing|Costeo del trabajo]] no está marcado como exclusivo de FieldQuo." },
        ],
      },
      {
        id: "who-can-see-it",
        heading: "Quién puede verlo",
        blocks: [
          { p: "La página es todo o nada: el servidor rechaza la petición de KPI a menos que el miembro tenga **View only** o más en presupuestos, trabajos, facturas y solicitudes, vea todos los trabajos y no solo los asignados, y tenga los interruptores **See prices** y **Job costing**. La fila de la barra lateral se oculta solo con el interruptor Job costing; una dirección guardada en favoritos la detiene la misma comprobación." },
          { bullets: [
            "Con los niveles predefinidos: **Crew**, **Estimator** y **Dispatcher** quedan rechazados — ninguno tiene Job costing. **Manager**, propietarios y administradores ven la página.",
            "**Flujo de dinero** tiene su propia puerta dentro de la página — facturas en View only, gastos en **View, record, and edit everyone's**, See prices — y rechaza dentro de la sección, no toda la página. Manager pasa.",
            "**Costos del negocio** es más estrecha todavía: Job costing más **View everyone's payslips** en nómina más gestión de personas. Con los niveles predefinidos, eso son propietarios y administradores; un Manager ve el resto de la página y un rechazo en esa sección.",
          ] },
        ],
      },
    ],
    faq: [
      { q: "¿Por qué una tarjeta dice — cuando yo sé el número?", a: "Porque la página no imprime una cifra por debajo de su umbral ni sin pruebas. La frase bajo el guion dice qué hace falta — normalmente más presupuestos decididos o más trabajos terminados en el periodo." },
      { q: "¿Puedo elegir mis propias fechas?", a: "No. Cinco preajustes, y una sola selección para toda la página. La página de Estados financieros usa los mismos cinco." },
      { q: "¿Dónde está la seguridad?", a: "La página de KPI hoy no tiene tarjeta de seguridad. Los incidentes se registran y listan en la pantalla Seguridad; la tasa por 1,000 horas que calcula la API todavía no tiene tarjeta." },
    ],
  },

  "kpi-sales": {
    title: "KPI: Ventas",
    summary:
      "Las cuatro tarjetas de Ventas del panel de KPI — tasa de cierre, valor promedio del trabajo, conversión de prospecto a presupuesto y trabajo por delante en semanas — con la definición exacta de cada una y la muestra que necesita antes de imprimirse.",
    updated: "2026-09-12",
    intro: [
      "**Ventas — Qué salió, qué volvió y con cuánto trabajo tienes la agenda por delante.** Cuatro tarjetas: **Tasa de cierre**, **Valor promedio del trabajo**, **Conversión de prospecto → presupuesto** y **Trabajo por delante**. Las dos primeras se leen directamente del informe Ganadas y perdidas, así que nunca pueden contradecirlo; las otras dos existen solo aquí.",
      "Cada tarjeta lleva el tamaño de su muestra, y ninguna imprime un porcentaje con menos de 10 resultados decididos ni un promedio con menos de 5 presupuestos ganados. Por debajo del umbral, la tarjeta dice cuántos más necesita.",
    ],
    sections: [
      {
        id: "overview",
        heading: "Resumen",
        blocks: [
          { p: "Un presupuesto pertenece al periodo por la fecha en que se **envió**; un presupuesto nunca marcado como enviado cuenta por la fecha en que se aceptó o rechazó. Un trío Bueno / Mejor / Óptimo es una sola oportunidad, no tres: el grupo se colapsa antes de contar nada, así que un cliente que elige una de tres opciones no puede aparecer como una victoria y dos derrotas." },
          { figure: "harness:kpis", caption: "Panel de KPI → Ventas — Tasa de cierre, Valor promedio del trabajo, Conversión de prospecto → presupuesto y Trabajo por delante, cada una con su muestra." },
        ],
      },
      {
        id: "win-rate",
        heading: "Tasa de cierre",
        blocks: [
          { p: "La **Tasa de cierre** es la parte de los presupuestos decididos que se ganaron: presupuestos aceptados ÷ (aceptados + rechazados). Un presupuesto todavía enviado y sin respuesta no es ni lo uno ni lo otro — no está en el denominador." },
          { bullets: [
            "Se imprime una vez que **10** presupuestos del periodo se han decidido. Por debajo: «1 de 10 hasta ahora — con 9 más, este dato será fiable.»",
            "Nada decidido todavía: «Todavía no se ha decidido nada en este periodo. Cuando 10 presupuestos estén marcados como ganados o perdidos, aquí aparecerá tu tasa de cierre.» Ningún presupuesto en absoluto: «Envía presupuestos y consigue que se decidan 10 de ellos — ganados o perdidos — y aquí aparecerá tu tasa de cierre.»",
            "El mismo 10 es el umbral en [[won-and-lost|Ganadas y perdidas]], donde la tasa se desglosa por estimador, por categoría y por motivo de pérdida.",
          ] },
        ],
      },
      {
        id: "average-job-value",
        heading: "Valor promedio del trabajo",
        blocks: [
          { p: "El **Valor promedio del trabajo** es el valor promedio de una oportunidad **ganada** en el periodo: el total aceptado, o el total presupuestado cuando no se registró un total aceptado, entre el número de presupuestos ganados." },
          { bullets: [
            "Necesita **5** presupuestos ganados. Con menos: «Gana 5 presupuestos y aquí aparecerá el valor promedio de tus trabajos.», o el recuento «{n} de 5 hasta ahora».",
            "Un presupuesto ganado sin total legible se deja fuera y se cuenta — la tarjeta muestra el triángulo de advertencia en lugar de promediar en silencio sobre un conjunto más pequeño de lo que sugiere el recuento de al lado.",
          ] },
        ],
      },
      {
        id: "lead-to-quote-conversion",
        heading: "Conversión de prospecto → presupuesto",
        blocks: [
          { p: "La **Conversión de prospecto → presupuesto** es la parte de los prospectos creados en el periodo que se convirtieron en presupuesto. Un prospecto cuenta como convertido cuando lleva un enlace a un presupuesto — el enlace real — no cuando alguien movió su tarjeta a una columna." },
          { bullets: [
            "Necesita **10** prospectos en el periodo. Por debajo: «{n} de 10 hasta ahora — con {m} más, este dato será fiable.»",
            "Sin prospectos: «Todavía no hay prospectos en este periodo. Cuando hayan entrado 10, aquí verás qué parte se convierte en presupuesto.»",
          ] },
        ],
      },
      {
        id: "backlog",
        heading: "Trabajo por delante",
        blocks: [
          { p: "**Trabajo por delante** es cuántas **semanas** de trabajo aceptado tiene usted todavía por delante, al ritmo de este periodo — semanas a propósito, no meses. La pista de la tarjeta dice por qué: «Semanas de trabajo aceptado que aún tienes por delante, al ritmo de este periodo — no meses. Un taller residencial con 2 a 6 semanas reservadas está bien.»" },
          { bullets: [
            "El numerador es el valor de cada trabajo abierto — todavía no terminado — cuyo presupuesto está **aceptado**, tomado del total aceptado o del total presupuestado. Un trabajo abierto sin presupuesto, o con un presupuesto nunca marcado como aceptado, se cuenta y se deja fuera: su valor inventaría un acuerdo que nadie dio.",
            "El denominador es un ritmo semanal: el valor de los trabajos **terminados en este periodo**, entre las semanas del periodo.",
            "Nada abierto y aceptado es un **0 semanas** real, no una cifra que falta.",
            "Trabajo por delante sin nada terminado en este periodo no tiene ritmo entre el que dividir: «Hay trabajo por delante, pero en este periodo no se terminó ningún trabajo con presupuesto valorado contra el cual medir un ritmo semanal. Termina uno y esto se completa.» La cifra en dólares aparece de todos modos en la sección Costos del negocio como **Comprometido, todavía sin facturar**.",
          ] },
          { tip: "Cambie el periodo y el ritmo cambia con él. Lo que va del año da el ritmo más estable; Este mes da el más reciente." },
        ],
      },
      {
        id: "who-can-see-it",
        heading: "Quién puede verlo",
        blocks: [
          { p: "La sección Ventas es parte de la puerta única de la página — vea [[the-kpi-dashboard|El panel de KPI]]. Con los niveles predefinidos, Manager, propietarios y administradores la ven; a Crew, Estimator y Dispatcher se les rechaza toda la página. Un Estimator que necesite sus propios números tiene la misma tasa de cierre en Ganadas y perdidas, que solo necesita View only en presupuestos y See prices." },
        ],
      },
    ],
    faq: [
      { q: "¿Por qué mi tasa de cierre es distinta del recuento de Aprobados de la lista de presupuestos?", a: "La tasa cuenta los presupuestos decididos del periodo por fecha de envío y colapsa los grupos de niveles en una sola oportunidad. La lista cuenta documentos. Los dos tienen razón sobre lo que cuentan." },
      { q: "¿Un presupuesto pendiente baja mi tasa de cierre?", a: "No. Solo los presupuestos aceptados y rechazados están en el denominador; un presupuesto que todavía espera al cliente no es ni lo uno ni lo otro." },
      { q: "¿Por qué Trabajo por delante dice 0 semanas si tengo trabajos programados?", a: "Esos trabajos no tienen un presupuesto aceptado detrás — un trabajo manual, un regreso por garantía — así que no llevan ningún valor acordado. Solo los trabajos abiertos con presupuesto aceptado están en el trabajo por delante." },
    ],
  },

  "kpi-money-flow": {
    title: "KPI: Flujo de dinero",
    summary:
      "Ingresos, Gastos y Queda para el periodo con un gráfico día por día y un desglose por categoría — qué lee cada cifra, cómo se hace justa la comparación con el periodo anterior, y la advertencia sobre los materiales.",
    updated: "2026-09-12",
    intro: [
      "**Flujo de dinero — Qué entró, qué salió y qué queda en este periodo, día por día. Los ingresos son pagos realmente recibidos; los gastos son los que se registraron o importaron, nunca una suposición de lo que falta.** Tres recuadros, un gráfico y un desglose, y la aritmética más sencilla de la página: dos sumas y una resta.",
      "Es una sección del panel de KPI y no una segunda pantalla, y sigue los mismos botones de periodo. Tiene su propia puerta, así que un miembro que ve el resto de la página puede ver un rechazo solo en esta sección.",
    ],
    sections: [
      {
        id: "overview",
        heading: "Resumen",
        blocks: [
          { p: "**Ingresos** son los pagos registrados en el periodo — cada pago contado una vez, por su propia fecha, sea cual sea la versión de la factura contra la que se tomó. A propósito no son totales de factura, que una modificación contaría dos veces. **Gastos** es cada gasto fechado en el periodo, ya se haya tecleado en Control de gastos o importado de un estado de cuenta. **Queda** es lo uno menos lo otro." },
          { p: "Una empresa que nunca registró un pago, o nunca registró un gasto, ve **—** en ese recuadro y una frase — «Nunca se ha registrado un gasto para esta empresa.» con un enlace **Importar un estado de cuenta bancario →** — nunca un $0.00 seguro de sí mismo. Una empresa con historial y un mes tranquilo recibe un $0 real." },
        ],
      },
      {
        id: "the-three-tiles",
        heading: "Los tres recuadros",
        blocks: [
          { table: {
            head: ["Recuadro", "Qué suma", "Cuándo muestra —"],
            rows: [
              ["**Ingresos**", "Las filas de pago fechadas en el periodo, por la fecha en que se registró el dinero.", "Nunca se ha registrado un pago para la empresa."],
              ["**Gastos**", "Las filas de gasto fechadas en el periodo — registradas a mano o importadas.", "Nunca se ha registrado un gasto para la empresa."],
              ["**Queda**", "Ingresos menos gastos.", "Cualquiera de los dos lados es desconocido — un desconocido menos un número real sigue siendo desconocido."],
            ],
          } },
          { figure: "harness:kpis", caption: "Panel de KPI → Flujo de dinero — Ingresos, Gastos y Queda con sus líneas de tendencia, y el comienzo del gráfico diario." },
        ],
      },
      {
        id: "the-chart-and-categories",
        heading: "El gráfico y el desglose",
        blocks: [
          { bullets: [
            "**Ingresos frente a gastos, por día** dibuja una línea para cada uno, cada día natural del periodo. Los días que todavía no han ocurrido se omiten en lugar de dibujarse como una línea plana de $0 hacia la derecha — el día 3, un trimestre tiene tres días de ancho.",
            "**En qué se fue el dinero** lista las tres categorías de gasto más grandes y pliega el resto en **Otros**; las filas siempre suman el total de gastos del periodo. Un gasto sin categoría pasa a ser **Sin categoría** y compite por un puesto como cualquier otro, así que nada se descarta sin nombrarlo.",
            "Los nombres de categoría son las palabras tecleadas en el gasto, mostradas tal como se registraron — los mismos nombres que usa Control de gastos, para que las dos pantallas nunca discrepen sobre cómo se llama una categoría.",
          ] },
        ],
      },
      {
        id: "the-comparison",
        heading: "La comparación con el periodo anterior",
        blocks: [
          { p: "Cada recuadro lleva «26% más que el periodo anterior», «12% menos que el periodo anterior», «Casi igual que el periodo anterior» o «Sube desde cero respecto al periodo anterior». El periodo anterior es el mismo número de días inmediatamente antes de este — un mes de 30 días contra los 30 días previos." },
          { bullets: [
            "Para un periodo todavía en curso, la comparación se recorta a los días que ya **han pasado** contra el mismo número de días antes de que empezara el periodo. Tres días de septiembre se comparan con tres días, no con todo agosto — si no, cada recuadro diría «91% menos» hasta el día 28 de cada mes.",
            "Los totales del titular siguen cubriendo todo el rango elegido: «cuánto he cobrado este mes» significa todo lo registrado contra él.",
            "«Sube desde cero» se escribe en lugar de un porcentaje cuando el periodo anterior fue de $0 — un 100% más desde nada no es un número que nadie pueda leer.",
          ] },
        ],
      },
      {
        id: "materials-warning",
        heading: "La advertencia sobre los materiales",
        blocks: [
          { p: "El costeo de trabajos solo lee gastos; nunca lee la lista de compras de materiales de un trabajo. Una empresa que marca compras en la lista y nunca las ingresa como gastos tiene un gasto real que esta sección no puede ver." },
          { warning: "Cuando en el periodo se marcaron al menos $200 en la lista de compras y los gastos de esos trabajos son una décima parte de eso o menos, aparece una nota ámbar: «Estos trabajos muestran {amount} comprados de la lista de materiales en este periodo, pero solo {expense} se registró como gasto…» El recuadro Gastos se muestra igualmente, con el triángulo de advertencia y «Se compraron materiales de la lista que nunca se registraron». Regístrelos como gastos, o importe el estado de cuenta, y la nota desaparece." },
        ],
      },
      {
        id: "who-can-see-it",
        heading: "Quién puede verlo",
        blocks: [
          { p: "Esta sección necesita facturas en **View only**, gastos en **View, record, and edit everyone's**, y el interruptor **See prices** — los gastos de toda la empresa, no «los míos». Con los niveles predefinidos, Manager, propietarios y administradores la ven; a un Estimator o Dispatcher, cuyos gastos son solo los suyos, se le rechazaría esta sección — aunque ya se les rechaza la página. Vea [[expense-tracking-and-burn-rate|Control de gastos y su ritmo de gasto]] para la pantalla de gastos en sí." },
        ],
      },
    ],
    faq: [
      { q: "¿Por qué Ingresos es distinto de Ingresos este mes en el Inicio?", a: "La cifra de ingresos del Inicio suma las facturas marcadas como pagadas; Ingresos aquí suma los pagos por su propia fecha. Un anticipo tomado en un mes sobre una factura marcada como pagada al mes siguiente cae en meses distintos en las dos pantallas." },
      { q: "¿Por qué Gastos no incluye los sueldos de mi cuadrilla?", a: "Los sueldos son horas fichadas, no filas de gasto. Aparecen como Nómina de este periodo bajo Costos del negocio, separados para que el mismo dinero no se cuente dos veces." },
      { q: "¿Puedo importar mi estado de cuenta desde aquí?", a: "Sí — el enlace Importar un estado de cuenta bancario → abre la importación de CSV; vea Importar gastos desde un CSV del banco." },
    ],
  },

  "kpi-business-costs": {
    title: "KPI: Costos del negocio",
    summary:
      "Nómina de este periodo, Costos fijos, Gasto en marketing y Comprometido, todavía sin facturar — cuatro cifras construidas con lo que FieldQuo ya sabe, cada una etiquetada con lo que incluye y nunca sumadas a propósito en un solo total.",
    updated: "2026-09-12",
    intro: [
      "**Costos del negocio — Nómina, costos fijos, gasto en marketing y trabajo ya comprometido — armado con lo que FieldQuo ya sabe, sin necesidad de un estado de cuenta.** Cuatro tarjetas, cada una de las cuales tenía una pantalla que la calculaba — Nómina, Configuración → Gastos generales, la página de Gasto en marketing, la tarjeta Trabajo por delante — y ninguna de las cuales tenía una vista de dinero en conjunto hasta esta sección.",
      "Son cuatro formas distintas de «verdad», y la página nunca las suma. Este artículo dice qué lee cada una, qué deja fuera, y por qué no hay total.",
    ],
    sections: [
      {
        id: "overview",
        heading: "Resumen",
        blocks: [
          { p: "Tres de las cuatro siguen los botones de periodo; una no. **Nómina de este periodo** y **Gasto en marketing** son lo que ocurrió entre el primer y el último día del periodo. **Costos fijos** es una cifra mensual sea cual sea el periodo, porque prorratear la renta a «este trimestre» inventaría una regla que nadie pidió. **Comprometido, todavía sin facturar** es una instantánea de hoy." },
          { figure: "live:app-analytics-kpis", caption: "Panel de KPI → Costos del negocio — Nómina de este periodo, Costos fijos, Gasto en marketing y Comprometido, todavía sin facturar, en una empresa sin tiempo ni gastos generales registrados todavía." },
        ],
      },
      {
        id: "the-four-cards",
        heading: "Las cuatro tarjetas",
        blocks: [
          { table: {
            head: ["Tarjeta", "Qué lee", "Cuándo muestra —"],
            rows: [
              ["**Nómina de este periodo**", "Horas fichadas aprobadas en el periodo × la tarifa de pago de cada trabajador, sumadas en toda la empresa.", "Nunca se ha registrado tiempo aprobado para la empresa."],
              ["**Costos fijos**", "El total mensual de Configuración → Gastos generales — renta y costos fijos, sueldos de estructura, préstamos y activos — sin cambios y por mes.", "Todavía no se ha registrado renta, sueldos de estructura, préstamos ni activos."],
              ["**Gasto en marketing**", "Las filas de gasto en marketing fechadas en el periodo, en todos los canales, en la moneda de la empresa.", "Nunca se ha registrado gasto en marketing para la empresa."],
              ["**Comprometido, todavía sin facturar**", "El valor de cada trabajo abierto con presupuesto aceptado — la misma cifra que la tarjeta Trabajo por delante divide en semanas.", "Nunca — nada abierto y aceptado es un $0.00 real con «0 trabajos aceptados y abiertos.»"],
            ],
          } },
        ],
      },
      {
        id: "payroll",
        heading: "Nómina de este periodo",
        blocks: [
          { bullets: [
            "Solo se pagan las horas **aprobadas**, así que solo se cuentan las horas aprobadas. Las horas todavía pendientes se cuentan aparte y se dicen en voz alta: «12 h siguen pendientes de aprobación y aún no se cuentan.» Vea [[timesheets-and-approving-hours|Hojas de horas: revisar y aprobar horas]].",
            "La tarifa es la que usa la nómina — la tarifa por hora del trabajador cuando está definida, si no, el costo de mano de obra en su ficha de miembro. Los sueldos de estructura ingresados en Configuración → Gastos generales son un costo del negocio, no el pago de una persona, y nunca se leen aquí.",
            "Las horas sin tarifa de pago registrada no se absorben como mano de obra gratis. La tarjeta muestra el triángulo de advertencia y «{n} horas registradas por {m} no tienen tarifa de pago en el sistema y no se cuentan aquí.»",
          ] },
        ],
      },
      {
        id: "fixed-costs",
        heading: "Costos fijos",
        blocks: [
          { bullets: [
            "La cifra es el total mensual del ritmo de gasto, reutilizado sin cambios desde [[overhead-and-your-minimum-price|Gastos generales y su precio mínimo]] — la pista dice «Al mes, sin importar el periodo de arriba — renta, sueldos de estructura y deuda.»",
            "**Ver el desglose →** abre Configuración → Gastos generales, donde se ingresa cada línea.",
            "Muestra — hasta que al menos un registro — costos fijos, salarios, deuda, activos — tenga una fila. Cuatro tablas vacías no son una renta de $0.00.",
          ] },
        ],
      },
      {
        id: "marketing-spend",
        heading: "Gasto en marketing",
        blocks: [
          { bullets: [
            "Una fila en otra moneda se convierte al tipo de cambio fijado y la cifra lleva delante **≈**, con una línea debajo que nombra el monto original y la antigüedad del tipo — «Incluye US$840.46 convertidos al tipo de cambio fijado (de hace 15 días).» Una fila cuyo tipo fue rechazado se deja fuera, y la tarjeta lo dice con el monto.",
            "«Puede coincidir con un costo también registrado en Control de gastos — no se suma a los gastos de arriba.» — una factura de Facebook ingresada en las dos pantallas se contaría en ambas, y nada enlaza las dos tablas para detectarlo.",
            "**Ver campañas →** abre la página de Gasto en marketing en su lista de campañas.",
          ] },
        ],
      },
      {
        id: "committed-not-yet-invoiced",
        heading: "Comprometido, todavía sin facturar",
        blocks: [
          { p: "La cifra en dólares detrás de [[kpi-sales|la tarjeta Trabajo por delante]]: cada trabajo todavía no terminado cuyo presupuesto está aceptado, valorado al total aceptado, con «3 trabajos aceptados y abiertos.» debajo. Se obtiene una vez para la sección Ventas y se vuelve a leer aquí, así que las dos tarjetas nunca pueden mostrar dinero distinto." },
        ],
      },
      {
        id: "why-not-one-total",
        heading: "Por qué no hay total",
        blocks: [
          { note: "La nómina y el gasto en marketing son gasto real que también puede haberse tecleado a mano como gasto — una transferencia de nómina ingresada como línea de sueldo aquí y como gasto manual, una factura de anuncios en las dos pantallas. Nada en FieldQuo enlaza esas tablas, así que un «total de dinero que sale» combinado parecería preciso y a veces estaría mal. Cada cifra se muestra por su cuenta, etiquetada con lo que incluye y lo que no." },
        ],
      },
      {
        id: "who-can-see-it",
        heading: "Quién puede verlo",
        blocks: [
          { p: "Esta sección es la unión de las puertas de sus tres fuentes: el interruptor **Job costing** y See prices (costos fijos), Job costing más **View everyone's payslips** en nómina (nómina), y el permiso de gestión de personas (gasto en marketing). Con los niveles predefinidos, eso son solo propietarios y administradores — un Manager tiene solo sus propios recibos de nómina y se le rechaza esta sección mientras ve el resto de la página. Un acceso Personalizado con los tres pasa." },
        ],
      },
    ],
    faq: [
      { q: "¿Por qué Costos fijos no cambia cuando elijo El año pasado?", a: "Es una proyección mensual desde Configuración → Gastos generales, no una suma de lo que pasó en el periodo. La pista de la tarjeta lo dice." },
      { q: "¿Nómina de este periodo es lo que realmente pagué?", a: "Son las horas aprobadas por las tarifas de pago del periodo — lo que ganó la cuadrilla. Lo que se pagó está en Nómina, por ciclo de pago." },
    ],
  },

  "kpi-profit": {
    title: "KPI: Ganancia",
    summary:
      "Margen bruto y neto en un trabajo terminado típico, costo de mano de obra como parte de los ingresos, e ingresos por empleado — cómo se calcula cada uno a partir de horas aprobadas y gastos registrados, y los cuatro motivos por los que un margen se niega a imprimirse.",
    updated: "2026-09-12",
    intro: [
      "**Ganancia — Sumado sobre cada trabajo terminado en el periodo, solo con horas aprobadas y gastos registrados.** Cuatro tarjetas: **Margen bruto (trabajo típico)**, **Margen neto (trabajo típico)**, **Costo de mano de obra, % de los ingresos** e **Ingresos por empleado**.",
      "Los márgenes son los números más frágiles de la página, porque descansan en lo que la cuadrilla registró y en lo que se ingresó como gasto — una cuadrilla que registra mal su tiempo muestra un margen mejor. Por eso la sección señala una cifra que se sabe incompleta y se niega a imprimir una que no pueda defender.",
    ],
    sections: [
      {
        id: "overview",
        heading: "Resumen",
        blocks: [
          { p: "La población es cada trabajo **terminado** en el periodo. Los ingresos de un trabajo son el total de las facturas emitidas para él — la última versión de cada una, borradores excluidos — y su costo directo son los gastos registrados contra él más las horas aprobadas × la tarifa de pago, la misma aritmética que [[job-costing|Costeo del trabajo: presupuestado contra real]] en la página del trabajo." },
          { figure: "live:app-analytics-kpis", caption: "Panel de KPI → Ganancia — Margen bruto, Margen neto, Costo de mano de obra e Ingresos por empleado, con el motivo bajo cada tarjeta que no tiene valor." },
        ],
      },
      {
        id: "the-four-cards",
        heading: "Las cuatro tarjetas",
        blocks: [
          { table: {
            head: ["Tarjeta", "Qué es", "Umbral"],
            rows: [
              ["**Margen bruto (trabajo típico)**", "La **mediana** de (ingresos − costo directo) ÷ ingresos en los trabajos terminados — un trabajo típico, no un promedio ponderado por dinero que un solo trabajo enorme podría dominar.", "5 trabajos terminados y valorados"],
              ["**Margen neto (trabajo típico)**", "La misma mediana con los gastos generales por trabajo de la empresa añadidos al costo de cada trabajo.", "5 trabajos, y una capacidad semanal de trabajos definida"],
              ["**Costo de mano de obra, % de los ingresos**", "Todo el costo de mano de obra ÷ todos los ingresos de esos trabajos — una sola proporción para toda la empresa, porque una masa salarial es una línea que el propietario lee como un solo número.", "5 trabajos"],
              ["**Ingresos por empleado**", "Facturas marcadas como pagadas en el periodo ÷ el número de miembros activos del equipo hoy.", "Al menos un miembro activo del equipo"],
            ],
          } },
        ],
      },
      {
        id: "how-margin-is-worked-out",
        heading: "Cómo se calcula el margen",
        blocks: [
          { bullets: [
            "El **costo directo** son los materiales y otros gastos del trabajo registrados contra él, más la mano de obra: horas aprobadas en el trabajo × la tarifa de pago de cada trabajador. Sin gastos generales — eso es lo que lo hace bruto.",
            "Los **gastos generales por trabajo** vienen de Configuración → Gastos generales: el ritmo de gasto mensual entre los trabajos que usted dijo poder asumir en una semana. Es nulo, no cero, hasta que **Trabajos por semana** esté definido, y el margen neto hereda exactamente ese rechazo en lugar de recaer en silencio sobre la cifra bruta.",
            "Un trabajo terminado sin factura, o con un total de factura de cero, se excluye y se cuenta — nunca se valora en $0.",
            "Ingresos por empleado usa la misma medida de efectivo que **Ingresos este mes** del Inicio, así que los dos nunca pueden discrepar en silencio; la plantilla es la de hoy, porque un recuento de trabajadores no tiene historial que leer.",
            "Un trabajo cuyas horas no tienen tarifa de pago, o cuyas horas todavía esperan aprobación, se marca como incompleto; la tarjeta muestra el triángulo de advertencia y «faltan datos» en lugar de promediar por encima del hueco.",
          ] },
        ],
      },
      {
        id: "when-it-refuses",
        heading: "Cuándo un margen se niega a imprimirse",
        blocks: [
          { bullets: [
            "«No se terminó ningún trabajo en este periodo.» — la población está vacía.",
            "«Ningún trabajo terminado en este periodo tenía a la vez una cifra de ingresos y un costo que comparar.» — se terminaron trabajos, pero ninguno se facturó.",
            "«{n} de 5 hasta ahora — con {m} más, este dato será fiable.» — por debajo del umbral. Con cinco trabajos, que todos caigan del mismo lado de una moneda al aire ya está por debajo de uno entre diez; con menos es ruido.",
            "«Define cuántos trabajos por semana puedes asumir en Configuración → Gastos generales, y el margen neto se podrá calcular.» — solo el margen neto, con un enlace **Define tu capacidad semanal de trabajo →**; el campo es **Trabajos por semana** en Configuración → Gastos generales.",
          ] },
          { warning: "La trampa de los materiales: cuando los trabajos muestran al menos $200 marcados en la lista de compras de materiales pero una décima parte de eso o menos ingresada como gastos, ambos márgenes se ocultan con una nota ámbar — «El costeo de trabajos únicamente lee gastos, así que el margen de abajo sería ficción — queda oculto hasta que las compras de materiales también se registren como gastos.» El % de costo de mano de obra se imprime igualmente, porque no depende de los materiales." },
        ],
      },
      {
        id: "who-can-see-it",
        heading: "Quién puede verlo",
        blocks: [
          { p: "Parte de la puerta única de la página, y el motivo por el que la puerta incluye el interruptor **Job costing** — vea [[the-kpi-dashboard|El panel de KPI]]. Manager, propietarios y administradores la ven; a Crew, Estimator y Dispatcher se les rechaza la página. Los gastos generales por trabajo se leen de Configuración → Gastos generales, que un propietario, administrador o Manager puede editar." },
        ],
      },
    ],
    faq: [
      { q: "¿Por qué el margen neto está en blanco cuando el margen bruto tiene valor?", a: "El neto necesita los gastos generales por trabajo, y eso necesita Trabajos por semana en Configuración → Gastos generales. Hasta que esté definido, la página se niega a adivinarlo." },
      { q: "¿Por qué la mediana y no el promedio?", a: "Un trabajo de $60,000 entre diez de $4,000 marcaría el promedio. La mediana es el trabajo del medio — lo que gana un trabajo típico suyo." },
      { q: "Mi cuadrilla olvida fichar. ¿Eso hace que el margen esté mal?", a: "Lo hace optimista — las horas que faltan son costo que falta. Apruebe las horas desde Hojas de tiempo; la tarjeta señala como incompletos los trabajos con horas sin tarifa o pendientes." },
    ],
  },

  "kpi-execution": {
    title: "KPI: Ejecución",
    summary:
      "Terminados a tiempo, aprovechamiento de la mano de obra y precisión de la estimación — qué mide cada uno, qué no mide a propósito, y la franja de trabajos recientes dibujada desde la ventana programada hasta la finalización.",
    updated: "2026-09-12",
    intro: [
      "**Ejecución — Qué tan cerca quedó la estimación de lo que pasó, y cómo aguantó el calendario.** Tres tarjetas — **Terminados a tiempo**, **Aprovechamiento de la mano de obra**, **Precisión de la estimación (variación mediana)** — y debajo una franja, **Trabajos recientes: ventana programada frente a la finalización**, una fila por trabajo.",
      "Cada tarjeta dice en su cara lo que no mide. Terminados a tiempo no es tiempo de ciclo; el aprovechamiento no es una nota de productividad; la precisión de la estimación es una mediana, no un total.",
    ],
    sections: [
      {
        id: "overview",
        heading: "Resumen",
        blocks: [
          { p: "Las tres leen los trabajos terminados en el periodo, y dos de ellas leen las horas aprobadas de la cuadrilla. La tarjeta de aprovechamiento lee las horas garantizadas en la ficha de cada trabajador; sin eso, no tiene con qué comparar las horas y lo dice." },
          { figure: "live:app-analytics-kpis", caption: "Panel de KPI → Ejecución — Terminados a tiempo, Aprovechamiento de la mano de obra y Precisión de la estimación, cada una explicando qué necesita antes de poder imprimirse." },
        ],
      },
      {
        id: "on-time-completion",
        heading: "Terminados a tiempo",
        blocks: [
          { p: "**Terminados a tiempo** es la parte de los trabajos terminados que acabaron en la fecha de su **última visita programada** o antes. La pista dice el resto: «Terminados en la fecha de la última visita programada o antes. No es tiempo de ciclo: los trabajos no llevan fecha de inicio contra la cual medirlo.»" },
          { bullets: [
            "La fecha programada es la fecha actual de la visita. Una visita reprogramada se sobrescribe en su sitio, así que la fecha comparada es la que realmente se acordó con el cliente — un trabajo no se puntúa como tarde por terminar exactamente cuando se le dijo.",
            "Un trabajo terminado sin visita alguna no tiene calendario contra el que medirse; se cuenta y se excluye: «Ningún trabajo terminado en este periodo tenía una visita programada contra la que medirlo.»",
            "Necesita **10** trabajos medibles antes de imprimir un porcentaje.",
          ] },
        ],
      },
      {
        id: "labour-utilisation",
        heading: "Aprovechamiento de la mano de obra",
        blocks: [
          { p: "**Aprovechamiento de la mano de obra** son las horas que llegaron a un trabajo, sobre las horas que la empresa garantizó: horas de trabajo aprobadas en el periodo ÷ (las horas garantizadas por semana de cada trabajador de campo × las semanas del periodo). La pista: «Horas que llegaron a un trabajo, frente a las horas que prometía una semana garantizada. El personal de oficina no se cuenta: su tiempo es gasto general por diseño.»" },
          { bullets: [
            "Solo los trabajadores con una semana garantizada en su ficha están en el denominador. Sin ninguno: «Ningún trabajador de campo activo tiene una semana garantizada definida, así que no hay nada con lo que comparar las horas.»",
            "El personal de oficina queda excluido de entrada — preguntar qué parte del martes de un contador pertenece a un trabajo es la pregunta equivocada.",
            "Las horas de un trabajador sin tarifa de pago se cuentan como horas pero no como dinero; la tarjeta se marca como incompleta y dice a cuántos trabajadores no pudo costear.",
            "Las horas no absorbidas detrás de esta tasa — pagadas, nunca en un trabajo — se muestran como dinero en [[overhead-and-your-minimum-price|Gastos generales y su precio mínimo]]. Allí se informan y, a propósito, todavía no se suman a su precio mínimo.",
          ] },
        ],
      },
      {
        id: "estimate-accuracy",
        heading: "Precisión de la estimación (variación mediana)",
        blocks: [
          { p: "**Precisión de la estimación (variación mediana)** es un pequeño gráfico de barras: para **Labour hours**, **Labour cost** y **Materials and other job costs**, la mediana de cuánto se alejó lo real de la estimación, en porcentaje — positivo significa por encima. Un enlace **Informe completo →** abre el informe [[estimate-accuracy|Precisión de las estimaciones]] completo." },
          { bullets: [
            "Se toma de los trabajos terminados que tienen a la vez un presupuesto costeado y costos reales. Con menos de **5** trabajos así: «No hay suficientes trabajos terminados y costeados en este periodo para sacar una cifra.»",
            "Una dimensión se dibuja solo cuando es informable con su propia muestra; una dimensión con muy pocos trabajos se omite en lugar de dibujarse con casi nada.",
            "Las barras positivas se colorean como sobrecostos, para que un vistazo diga de qué lado se está equivocando.",
          ] },
        ],
      },
      {
        id: "the-schedule-strip",
        heading: "La franja del calendario",
        blocks: [
          { p: "**Trabajos recientes: ventana programada frente a la finalización** aparece cuando al menos un trabajo terminado tuvo una visita: hasta veinte filas, el más reciente primero, cada una dibujada desde la primera visita programada hasta la última, con la fecha de finalización marcada y la fila coloreada como **Terminado a tiempo** o **Terminado tarde**. Son los mismos datos con los que se calculó la tasa de arriba, mostrados un trabajo a la vez." },
        ],
      },
      {
        id: "who-can-see-it",
        heading: "Quién puede verlo",
        blocks: [
          { p: "Parte de la puerta única de la página — vea [[the-kpi-dashboard|El panel de KPI]]: Manager, propietarios y administradores. Las horas garantizadas y la tarifa de pago que lee el aprovechamiento se definen por persona en las pantallas de equipo; las fechas de visita vienen de las visitas del trabajo." },
        ],
      },
    ],
    faq: [
      { q: "Un trabajo terminó un día después de su visita porque el cliente lo pidió. ¿Está tarde?", a: "Si la visita se reprogramó a la nueva fecha, no — se compara la fecha actual de la visita. Si la fecha de la visita se dejó como estaba, sí." },
      { q: "¿Por qué el aprovechamiento dice que no hay nada que comparar?", a: "Ningún trabajador de campo activo tiene horas garantizadas por semana en su ficha. Defínalas en la persona y la tarjeta se completa para los periodos posteriores." },
      { q: "¿El aprovechamiento cambia mi precio mínimo?", a: "Todavía no. Las horas no absorbidas se informan en la pantalla de gastos generales y, a propósito, no se incorporan al ritmo de gasto hasta que la cifra haya sido confiable durante un tiempo." },
    ],
  },

  "kpi-quality": {
    title: "KPI: Calidad",
    summary:
      "La tasa de retrabajo y regresos y la tasa de órdenes de cambio — qué cuenta, qué no cuenta a propósito, y cómo registrar una visita de regreso o un cambio de alcance para que las tarjetas puedan verlo.",
    updated: "2026-09-12",
    intro: [
      "**Calidad — Trabajo al que hubo que volver, y alcance que cambió después de que el cliente dijo que sí.** Dos tarjetas: **Tasa de retrabajo y regresos** y **Tasa de órdenes de cambio**. Ambas estaban antes bajo Sin seguimiento; ambas salieron de ahí cuando la página del trabajo ganó una forma de registrar el hecho con honestidad en lugar de deducirlo.",
      "Ninguna se deduce. Una visita de regreso cuenta solo cuando alguien dijo por qué volvía; una orden de cambio cuenta solo cuando alguien registró una. Una edición ordinaria de un presupuesto o una factura nunca se lee como ninguna de las dos.",
    ],
    sections: [
      {
        id: "overview",
        heading: "Resumen",
        blocks: [
          { p: "Ambas tasas son partes de los trabajos **terminados** en el periodo, y ambas necesitan **10** trabajos terminados antes de imprimir un porcentaje. Por debajo, la tarjeta cuenta — «4 de 10 hasta ahora — con 6 más, este dato será fiable.» — y sin ninguno: «No se terminó ningún trabajo en este periodo.»" },
          { p: "Un regreso puede tomar dos formas en la página del trabajo: una visita de regreso añadida al mismo trabajo, o un trabajo nuevo creado como regreso del original. Ambas preguntan **¿Por qué vuelves?**, y ambas alimentan la tasa contra el trabajo original." },
        ],
      },
      {
        id: "rework-callback-rate",
        heading: "Tasa de retrabajo y regresos",
        blocks: [
          { p: "La parte de los trabajos terminados a los que la empresa tuvo que volver por un **retrabajo** o un regreso por **garantía**. La pista de la tarjeta: «Trabajos terminados a los que la empresa tuvo que volver para rehacer algo o por garantía. Un cliente que creyó que faltaba algo y no faltaba no cuenta en contra — mira la página del trabajo para registrar cuál es cuál.»" },
          { bullets: [
            "**Retrabajo — se nos pasó algo** y **Garantía — trabajo cubierto** cuentan contra el trabajo.",
            "**No fue culpa nuestra — el cliente creyó que faltaba algo** se registra pero no se cuenta. Si todo se archiva como retrabajo, la tasa está mal y usted deja de confiar en ella — así que la tercera opción existe para mantener honestas a las dos primeras.",
            "Un trabajo que es en sí mismo un regreso no está en el denominador: un regreso por garantía no es trabajo nuevo que se mida para ver si, a su vez, necesitó un regreso.",
            "Un trabajo con varias visitas de regreso es un solo trabajo en el numerador, no varios.",
          ] },
        ],
      },
      {
        id: "how-to-record-a-callback",
        heading: "Cómo registrar un regreso",
        blocks: [
          { steps: [
            "Para un retoque corto, abra el trabajo terminado y añada una visita de regreso; cuando se le pregunte **¿Por qué vuelves?**, elija Retrabajo, Garantía o No fue culpa nuestra. La elección es obligatoria.",
            "Para un regreso mayor, cree un trabajo nuevo como regreso del original. El aviso dice lo que eso hace: «Este trabajo es un regreso de {title} — aparecerá en la página de ese trabajo y contará para la tasa de retrabajo y regresos del panel de KPI.»",
            "Termine el trabajo original como de costumbre. La tasa cuenta el original en el periodo en que se terminó, sea cual sea el periodo en que ocurra el regreso.",
          ] },
        ],
      },
      {
        id: "change-order-rate",
        heading: "Tasa de órdenes de cambio",
        blocks: [
          { p: "La parte de los trabajos terminados con al menos una **orden de cambio** registrada — un cambio de alcance acordado después de que el cliente aceptó el presupuesto. La pista: «Trabajos terminados con al menos un cambio de alcance registrado después de aceptar el presupuesto — nunca deducido de una edición común de presupuesto o factura.»" },
          { bullets: [
            "Cada trabajo terminado está aquí en el denominador, regresos incluidos — que un trabajo sea un regreso no tiene nada que ver con que su propio alcance haya cambiado.",
            "Una orden de cambio registrada después de terminar el trabajo cuenta igualmente; el registro se lee sin fecha límite, porque un cambio acordado en la última semana a menudo se redacta después de cerrar el trabajo.",
            "El dinero detrás — las diferencias de precio de las órdenes de cambio aprobadas — es la misma cifra que usan la página del trabajo y la factura, sumada una vez en un solo lugar. Solo las órdenes de cambio aprobadas son dinero; una rechazada cuenta igualmente el trabajo como que tuvo un cambio de alcance.",
          ] },
        ],
      },
      {
        id: "who-can-see-it",
        heading: "Quién puede verlo",
        blocks: [
          { p: "Parte de la puerta única de la página — vea [[the-kpi-dashboard|El panel de KPI]]: Manager, propietarios y administradores. Registrar el motivo de una visita de regreso o crear un trabajo de regreso necesita **View, create, and edit** en trabajos — Dispatcher o superior." },
        ],
      },
    ],
    faq: [
      { q: "Volvimos porque el cliente cambió de opinión. ¿Retrabajo?", a: "No — eso es un cambio de alcance, no un fallo. Regístrelo como orden de cambio en el trabajo; cuenta para la tasa de órdenes de cambio, no para la de regresos." },
      { q: "¿Por qué la tasa está en blanco si tuvimos dos regresos el mes pasado?", a: "La tarjeta necesita 10 trabajos terminados en el periodo antes de imprimir un porcentaje. Amplíe el periodo a Este trimestre o Lo que va del año." },
    ],
  },

  "kpi-cash": {
    title: "KPI: Efectivo",
    summary:
      "Cuentas por cobrar por antigüedad y dinero recibido en los últimos seis meses — qué cuenta la cifra pendiente, cómo se clasifica una factura por antigüedad, y por qué una factura sin fecha nunca está vencida.",
    updated: "2026-09-12",
    intro: [
      "**Efectivo — Lo que te deben y lo que realmente ha entrado.** Dos tarjetas: **Cuentas por cobrar, por antigüedad**, con la escalera de antigüedad debajo, y **Dinero recibido, últimos 6 meses**, una línea de pagos por mes. Ambas son las cifras del propio panel — el mismo constructor, las mismas filas — así que esta sección y el Inicio nunca pueden discrepar sobre lo que se debe.",
      "Las cuentas por cobrar no tienen periodo: lo que le deben se debe hoy, por vieja que sea la factura, así que esta es la única sección que los botones de periodo no tocan.",
    ],
    sections: [
      {
        id: "overview",
        heading: "Resumen",
        blocks: [
          { p: "La cifra pendiente se construye a partir de cada factura que la empresa emitió alguna vez — cada versión — con los borradores fuera. Cada familia de facturas se valora en su **última** versión, menos cada pago registrado contra cualquiera de sus versiones, de modo que una factura modificada nunca se cuenta por la cifra con la que se emitió al principio y un anticipo tomado en la versión uno sigue contando contra la versión dos." },
          { figure: "harness:kpis-cash", caption: "Panel de KPI → Efectivo — Cuentas por cobrar por antigüedad con la escalera y el enlace Informe completo, y la línea de Dinero recibido de seis meses." },
        ],
      },
      {
        id: "accounts-receivable-by-age",
        heading: "Cuentas por cobrar, por antigüedad",
        blocks: [
          { p: "La cifra grande es el total pendiente, y luego «{overdue} de eso está vencido ({count})» o «Ahora mismo no hay nada pendiente de cobro.» Debajo, la escalera — los mismos cinco peldaños que usa el Inicio — con los peldaños vencidos en rojo, y un enlace **Informe completo →** a [[financial-statements|Estados financieros]]." },
          { table: {
            head: ["Peldaño", "Qué cae en él"],
            rows: [
              ["**Aún no vence**", "Pendiente, y la fecha de vencimiento no ha pasado."],
              ["**1–30 días**", "Entre uno y treinta días naturales después del vencimiento."],
              ["**31–60 días**", "De treinta y uno a sesenta días después del vencimiento."],
              ["**61–90 días**", "De sesenta y uno a noventa días después del vencimiento."],
              ["**90+ días**", "Noventa y un días o más después del vencimiento."],
            ],
          } },
        ],
      },
      {
        id: "what-the-figure-counts",
        heading: "Qué cuenta la cifra, y qué nombra",
        blocks: [
          { bullets: [
            "La antigüedad se cuenta desde la **fecha de vencimiento**, en días naturales enteros. Una factura sin fecha de vencimiento está pendiente pero nunca vencida y nunca en la escalera — es una afirmación distinta, y el Inicio la lista bajo **Sin fecha de vencimiento**.",
            "Una factura sin fecha alguna — nunca enviada, sin fecha de creación — no se puede situar en el tiempo. Se cuenta y se nombra en lugar de descartarse en silencio, y la tarjeta muestra el triángulo de advertencia cuando eso ocurre.",
            "Un pago registrado con una fecha ilegible se cuenta del mismo modo como no situado y señala la cifra.",
            "Una factura pagada de más es un crédito que usted tiene, no dinero que le deben; se mantiene fuera de la cifra. El Inicio lo dice con el monto.",
            "Tres estados, nunca un solo $0.00: un saldo real, «Ahora mismo no hay nada pendiente de cobro.» cuando todo está saldado, y «Nunca se ha emitido una factura.» cuando no hay nada que deber.",
          ] },
        ],
      },
      {
        id: "money-received-last-6-months",
        heading: "Dinero recibido, últimos 6 meses",
        blocks: [
          { p: "Una línea de pagos por el mes en que se registraron, en los últimos seis meses, con el valor del último mes etiquetado. Es la misma serie que el gráfico **Dinero recibido** del Inicio en su ajuste de 6 meses, construida con las mismas filas de pago." },
          { bullets: [
            "El mes en curso se dibuja como parcial — no ha terminado, y compararlo con un mes completo fabricaría un desplome el día 2 de cada mes.",
            "Una empresa que nunca registró un pago ve «Aún no hay pagos registrados.» en lugar de una línea plana pegada al eje.",
          ] },
        ],
      },
      {
        id: "who-can-see-it",
        heading: "Quién puede verlo",
        blocks: [
          { p: "Parte de la puerta única de la página — vea [[the-kpi-dashboard|El panel de KPI]]: Manager, propietarios y administradores. Las mismas cifras, con el nombre del cliente y un botón **Reclamar el pago** en cada factura, están en el Inicio para cualquiera con facturas en View only y See prices — vea [[money-owed-and-receivables-aging|Dinero adeudado y antigüedad de las cuentas por cobrar]]." },
        ],
      },
    ],
    faq: [
      { q: "¿Por qué una factura vieja sin fecha de vencimiento no aparece como vencida?", a: "Lo vencido se mide desde la fecha de vencimiento, y esa factura no tiene ninguna. Añádale una fecha de vencimiento y envejecerá a partir de ahí." },
      { q: "¿Por qué la cifra de cuentas por cobrar es la misma elija el periodo que elija?", a: "Lo que le deben no tiene periodo — una factura de 2019 que nadie pagó se debe hoy. Los botones de periodo gobiernan las demás secciones." },
      { q: "¿Por qué el total no coincide con la suma de la escalera?", a: "La escalera solo contiene facturas con fecha de vencimiento. Las facturas sin fecha están en el total y se nombran aparte; las facturas pagadas de más no están en ninguno de los dos." },
    ],
  },
};
