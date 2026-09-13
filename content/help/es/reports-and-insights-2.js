// content/help/es/reports-and-insights-2.js
//
// Parte 2 de la categoría «reports-and-insights» en español (ver el
// compositor, reports-and-insights.js). Slugs de esta parte
// (lib/help/tree.js): kpi-customer, the-metrics-fieldquo-refuses-to-invent,
// weekly-digests, the-monthly-digest-email, financial-statements,
// won-and-lost, estimate-accuracy, expense-tracking-and-burn-rate,
// import-expenses-from-a-bank-csv, overhead-and-your-minimum-price.
//
// Misma estructura que el módulo en inglés; las palabras en pantalla vienen
// del bloque `es` de app/i18n/appMessages.js. Las etiquetas de línea de los
// estados financieros y las frases de hallazgos del informe de precisión
// están hoy en inglés en la aplicación, y se citan tal cual.
export const ARTICLES = {
  "kpi-customer": {
    title: "KPI: Cliente",
    summary:
      "La sección Cliente del panel de KPI: una puntuación de satisfacción sobre 5, de dónde salen las respuestas, el umbral antes de mostrar un número, y quién puede verla.",
    updated: "2026-09-12",
    intro: [
      "La sección **Cliente** está cerca del final de **KPI**, justo encima de **Sin seguimiento**. Lleva una sola cifra — **Satisfacción del cliente**, un promedio sobre 5 — y un pequeño gráfico de barras de cómo se reparten las respuestas por puntuación. Cada respuesta que hay detrás vino de un cliente que tocó un número en el correo de solicitud de reseña después de terminar un trabajo.",
      "Este artículo dice exactamente qué promedia la tarjeta, por qué puede mostrar un guion en lugar de un número, y cómo llega ahí la respuesta de un cliente en primer lugar.",
    ],
    sections: [
      {
        id: "overview",
        heading: "Resumen",
        blocks: [
          { p: "FieldQuo le hace al cliente una pregunta después de un trabajo terminado — **How did we do?**, en una escala de 1 a 5 — y esta tarjeta es el promedio de las respuestas para los trabajos terminados en el periodo que usted eligió arriba de la página. No es una puntuación de reseñas, no es una calificación de Google, y no es una suposición: un cliente al que se le envió la encuesta y nunca respondió no se cuenta en absoluto." },
          { p: "El propio subtítulo de la sección dice de dónde salen las respuestas: «Lo que dicen los clientes cuando el trabajo termina — una sola pregunta, enviada junto con el correo que pide reseña.» La encuesta viaja en el mismo correo que la solicitud de reseña, así que una empresa que no ha configurado las solicitudes de reseña tampoco recoge datos de satisfacción." },
        ],
      },
      {
        id: "what-is-on-the-screen",
        heading: "Qué hay en la pantalla",
        blocks: [
          { bullets: [
            "**Satisfacción del cliente** — el promedio, impreso como **4.6 / 5**, con el número de respuestas debajo («9 trabajos/presupuestos»). La pista dice: «Promedio de la encuesta de una pregunta que se envía después de un trabajo. Solo la recogen las empresas que hoy tienen configurado un enlace de reseñas — va en el mismo correo.»",
            "**Respuestas por puntuación** — cinco barras, una por puntuación de 1 a 5, con el recuento de respuestas junto a cada una. Aparece solo cuando el propio promedio se muestra.",
            "**«{count} de estas puntuaron 1 o 2 — vale la pena una llamada de seguimiento.»** — una línea ámbar bajo las barras siempre que al menos una respuesta fue un 1 o un 2. Esa frase es todo lo que FieldQuo hace con una puntuación baja: ni tarea, ni mensaje de texto, ni alerta.",
          ] },
          { figure: "harness:kpis-cash", caption: "KPI — las secciones Efectivo, Cliente y Sin seguimiento al pie del panel; Satisfacción del cliente en 4.6 / 5 con 9 respuestas, repartidas por puntuación." },
        ],
      },
      {
        id: "how-an-answer-gets-here",
        heading: "Cómo llega aquí la respuesta de un cliente",
        blocks: [
          { steps: [
            "Abra **Configuración → Reseñas**. Pegue **Tu enlace de reseñas**, active **Pedir automáticamente**, y elija un retraso bajo **Cuándo preguntar** — de **2 horas después** a **Una semana después**. Sin enlace de reseñas no se envía nada, y por tanto no se recoge nada.",
            "Marque el trabajo como **terminado**. Pasado el retraso, el cliente con dirección de correo registrada recibe un solo correo de solicitud de reseña de su empresa — nunca más de uno por trabajo, y nunca por un trabajo que terminó hace más de 30 días.",
            "El correo lleva una fila de cinco botones numerados. Tocar uno abre una página corta con los colores de su empresa: **How did we do?**, las cinco puntuaciones, un comentario opcional, y **Send**. La página está en el idioma en que se envió el correo.",
            "Pulsar **Send** registra la puntuación una vez. El enlace no sirve para responder dos veces, y un escáner de correo que lo abra no registra nada — solo cuenta la pulsación de **Send**.",
          ] },
          { note: "El correo y la página de la encuesta llevan su logotipo y su color de marca, no los de FieldQuo. Un cliente que se dio de baja de sus solicitudes de reseña se omite, y por tanto nunca recibe la pregunta. Todo el detalle sobre el correo en sí: [[review-requests|Solicitudes de reseña después de un trabajo]]." },
        ],
      },
      {
        id: "what-the-number-means",
        heading: "Qué significa el número, exactamente",
        blocks: [
          { table: {
            head: ["Pregunta", "Respuesta"],
            rows: [
              ["Qué se promedia", "Cada puntuación de 1 a 5 registrada para un trabajo terminado dentro del periodo elegido. Redondeada a un decimal."],
              ["Qué cuenta como muestra", "Solo las respuestas. Una encuesta enviada y nunca respondida no está en el recuento y no arrastra el promedio hacia abajo."],
              ["El umbral", "5 respuestas. Por debajo, la tarjeta muestra un guion y «{n} de 5 hasta ahora — con {remaining} más, este dato será fiable.»"],
              ["Sin respuestas en absoluto", "«Ningún cliente ha respondido todavía la encuesta de satisfacción. Cuando lo hayan hecho 5, aparecerá aquí.»"],
              ["Puntuaciones bajas", "Un 1 o un 2. Se cuentan y se nombran bajo el gráfico de barras; no se dispara nada más."],
            ],
          } },
          { p: "El umbral de cinco respuestas es el mismo que el panel usa para el valor promedio del trabajo y las cifras de margen: el promedio es la afirmación, y un promedio de tres toques es una anécdota. Las tarjetas de tasa de cierre usan un umbral de diez porque un porcentaje se mueve más con un solo cambio; vea [[the-kpi-dashboard|El panel de KPI]] para los dos umbrales." },
        ],
      },
      {
        id: "who-can-see-it",
        heading: "Quién puede verlo",
        blocks: [
          { p: "Toda la página de KPI es todo o nada: necesita el interruptor **Job costing**, **See prices**, y acceso de lectura a presupuestos, trabajos (de toda la empresa), facturas y solicitudes. De los niveles de acceso incluidos, eso significa **Manager**, administradores y el propietario. Crew, Estimator y Dispatcher no ven la fila **KPI**, y escribir la dirección da un rechazo, no una página con una tarjeta menos. La tarjeta de satisfacción no añade ninguna puerta propia." },
        ],
      },
    ],
    faq: [
      { q: "Tenemos decenas de reseñas de Google. ¿Por qué la tarjeta está vacía?", a: "Las reseñas pegadas en Configuración → Reseñas son testimonios para su sitio web, no respuestas de encuesta. Esta tarjeta solo cuenta los toques de 1 a 5 del correo que FieldQuo envía después de un trabajo, y necesita cinco antes de imprimir un número." },
      { q: "¿Un cliente puede cambiar su respuesta?", a: "Antes de pulsar Send, sí — la página tiene un enlace Change your answer. Después de Send, la puntuación se registra una vez y el enlace queda gastado; abrirlo de nuevo dice que la respuesta ya se recibió." },
      { q: "¿Una mala puntuación avisa a alguien?", a: "No. La tarjeta imprime cuántas respuestas fueron un 1 o un 2 y sugiere una llamada. No hay notificación, tarea ni mensaje automático detrás." },
      { q: "¿A qué periodo pertenece una puntuación?", a: "Al periodo en que se terminó el trabajo, no al día en que el cliente respondió. Cambiar de Este trimestre a El mes pasado cambia qué trabajos entran en el recuento." },
    ],
  },

  "the-metrics-fieldquo-refuses-to-invent": {
    title: "Las métricas que FieldQuo se niega a inventar",
    summary:
      "La sección Sin seguimiento al pie del panel de KPI: las dos cifras que FieldQuo no calcula a propósito, por qué, dónde vive la versión honesta de cada una, y la regla detrás de cada guion de la página.",
    updated: "2026-09-12",
    intro: [
      "La última sección de **KPI** se llama **Sin seguimiento**, y su subtítulo es toda la idea: «Métricas que un panel como este suele llevar, y para las que FieldQuo no inventa números.» En lugar de una tarjeta con un porcentaje de aspecto plausible, usted recibe el nombre de la métrica y un párrafo sobre por qué no hay número debajo.",
      "Hoy hay dos entradas. Este artículo explica ambas, dice dónde vive realmente la versión honesta de cada cifra, y cubre la regla más amplia que sigue el resto de la página: una tarjeta sin datos muestra un guion y un motivo, nunca un cero.",
    ],
    sections: [
      {
        id: "overview",
        heading: "Resumen",
        blocks: [
          { p: "Cada cifra de la página de KPI es aritmética sobre filas que existen — presupuestos, trabajos, facturas, horas aprobadas, gastos registrados. Cuando las filas que una métrica necesita se teclean a mano, no llevan enlace con aquello entre lo que se dividirían, o simplemente no se registran, la página lo dice en lugar de imprimir un número que parece preciso y no significa nada. La lista se ha ido acortando a medida que llegan los datos, y ese es su sentido." },
          { p: "Las dos entradas están escritas con las palabras del propio producto y, hoy, en inglés en la pantalla de todos los idiomas — no se traducen como sí se traducen las etiquetas de las tarjetas de arriba." },
        ],
      },
      {
        id: "cost-per-lead",
        heading: "Costo por prospecto",
        blocks: [
          { p: "Lo que dice la página: la cifra de prospectos en una fila de gasto en marketing se teclea a mano, y fuera de los formularios de prospectos de Meta ningún prospecto en FieldQuo lleva un id de campaña ni un valor UTM. Un costo por prospecto por canal construido sobre un denominador tecleado a mano, sin forma de atribuir un prospecto a un canal, parecería preciso y no significaría nada — así que se rechaza." },
          { bullets: [
            "**Por campaña, solo para prospectos de formularios de Meta** — el único camino con un id a ambos lados, una fila de gasto sincronizada y un prospecto que llegó por un formulario de Meta. Esa cifra es real y se muestra en [[marketing-spend|Gasto en marketing]].",
            "**Combinado, sobre todo** — el gasto total en marketing del mes entre cada prospecto real de cada canal de entrada activo, dejando fuera del denominador los prospectos ingresados a mano o importados de un archivo. Esa cifra está en [[the-monthly-digest-email|El correo de resumen mensual]], y nunca afirma qué canal produjo qué prospecto.",
          ] },
        ],
      },
      {
        id: "equipment-utilisation",
        heading: "Aprovechamiento del equipo",
        blocks: [
          { p: "Lo que dice la página: FieldQuo ahora registra qué activo estuvo en qué trabajo, así que los datos existen — pero el aprovechamiento de un parque de equipos no es de forma natural una tasa para un periodo como lo son las demás tarjetas, y forzarlo a serlo («en uso el 62% de los días de este mes») inventaría una afirmación sobre cuántos días debería haber estado en uso el compresor, algo que nada en el producto declara." },
          { note: "La entrada dice que la cifra vive como pantalla propia en Configuración → Activos. Hoy ninguna pantalla de FieldQuo lee ese informe. El registro **Activos y depreciación** en **Configuración → Gastos generales** muestra lo que costó cada artículo y lo que vale en los libros, no con qué frecuencia se usó — vea [[overhead-and-your-minimum-price|Gastos generales y su precio mínimo]]." },
        ],
      },
      {
        id: "what-used-to-be-here",
        heading: "Lo que antes estaba en esta lista",
        blocks: [
          { p: "Tres métricas salieron de la lista en cuanto el producto tuvo algo honesto con lo que calcularlas, y cada una es ahora una tarjeta real en la página:" },
          { bullets: [
            "**Tasa de retrabajo y regresos** y **tasa de órdenes de cambio** — bajo **Calidad**, en cuanto una visita pudo marcarse como regreso y un cambio de alcance pasó a ser su propio registro. Vea [[kpi-quality|KPI: Calidad]].",
            "**Satisfacción del cliente** — bajo **Cliente**, en cuanto existió la encuesta de una pregunta para preguntar y algo que promediar. Vea [[kpi-customer|KPI: Cliente]].",
            "**Tasa de incidentes de seguridad** — en cuanto los incidentes se registraron contra horas aprobadas. Solo se imprime pasadas 1,000 horas aprobadas en el periodo.",
          ] },
        ],
      },
      {
        id: "the-rule-behind-every-dash",
        heading: "La regla detrás de cada guion",
        blocks: [
          { table: {
            head: ["Lo que usted ve", "Qué significa"],
            rows: [
              ["—, con «{n} de 10 hasta ahora — con {remaining} más, este dato será fiable.»", "Una tasa — tasa de cierre, conversión de prospecto a presupuesto, terminados a tiempo — con menos de 10 casos decididos. Un solo cambio la movería más de diez puntos."],
              ["—, con «{n} de 5 hasta ahora…»", "Una cifra central — valor promedio del trabajo, margen, satisfacción — sacada de menos de 5 trabajos o respuestas."],
              ["—, con una frase sencilla", "Las filas que la cifra necesita todavía no existen, y la frase dice cuáles: ningún presupuesto decidido, ningún trabajo terminado, ninguna capacidad definida en Configuración → Gastos generales, ninguna factura emitida jamás."],
              ["Un número con un triángulo ámbar", "Real, pero se sabe incompleto — horas sin tarifa, hojas de tiempo pendientes de aprobación, materiales marcados en la lista de compras pero nunca registrados como gasto. La nota bajo la tarjeta dice qué falta."],
              ["Un 0 real", "Un cero real: nada vencido, nada de trabajo por delante. Cero y desconocido son frases distintas y la página las mantiene separadas."],
            ],
          } },
          { p: "La misma disciplina recorre los demás informes de este grupo: **Ganadas y perdidas** imprime «Muy pocas para leerlo» con menos de diez decisiones, **Precisión de las estimaciones** imprime recuentos pero ningún porcentaje con menos de cinco trabajos comparables, y **Estados financieros** imprime «Nada registrado» o «No disponible» en lugar de $0.00." },
        ],
      },
      {
        id: "who-can-see-it",
        heading: "Quién puede verlo",
        blocks: [
          { p: "Las mismas personas que el resto de la página — **Manager**, administradores y el propietario, porque el panel de KPI necesita el interruptor **Job costing** y sin él rechaza en bloque. Vea [[the-kpi-dashboard|El panel de KPI]]." },
        ],
      },
    ],
    faq: [
      { q: "¿Puedo desactivar la sección Sin seguimiento?", a: "No. Es parte de la página, y es la respuesta honesta a las dos preguntas que un contratista le hace más a menudo a un panel. No hay nada que configurar." },
      { q: "¿Se hará seguimiento algún día del costo por prospecto por canal?", a: "Solo si los prospectos empiezan a llevar una fuente que pueda ligarse a un gasto. Hoy eso existe solo para los formularios de prospectos de Meta, y esa cifra por campaña ya está en la página de Gasto en marketing." },
      { q: "¿Por qué una tarjeta a veces muestra un número con un triángulo de advertencia?", a: "Porque el número es real pero incompleto — algunas horas no tienen tarifa, o algunas hojas de tiempo siguen pendientes de aprobación. El triángulo es FieldQuo negándose a esconder el hueco en un promedio." },
    ],
  },

  "weekly-digests": {
    title: "Resúmenes semanales",
    summary:
      "Qué abre el enlace Resúmenes semanales de la página de Análisis — la página Resumen mensual — qué contiene cada entrada, y el hecho llano de que FieldQuo hoy no produce ningún resumen semanal.",
    updated: "2026-09-12",
    intro: [
      "Bajo el título de **Análisis** (la página **Cómo te comparas**) hay una fila de enlaces al resto del grupo de informes. El primero dice **Resúmenes semanales**. Abre una página titulada **Resumen mensual** — «Resúmenes automáticos del desempeño de tu negocio cada mes.» El nombre del enlace es más viejo que la página que abre.",
      "Así que, para ser claros: FieldQuo no escribe un resumen semanal. Nada se ejecuta cada semana, nada se envía por correo cada semana, y no hay ningún ajuste que lo cambie. Lo que el enlace le da es la lista de resúmenes mensuales, y este artículo trata de esa lista. El correo que envía cada uno se cubre en [[the-monthly-digest-email|El correo de resumen mensual]].",
    ],
    sections: [
      {
        id: "overview",
        heading: "Resumen",
        blocks: [
          { p: "Una vez al mes, el día primero, FieldQuo escribe un resumen corto para cada empresa activa — tres o cuatro frases de FieldQuo AI en torno a un conjunto fijo de números, más las alertas que el propio código levantó — lo archiva bajo el mes que cubre, y lo envía por correo al propietario y a los administradores. La página **Resumen mensual** es el archivo: cada resumen que la empresa ha recibido, el más reciente primero, hasta dos años." },
          { p: "La página muestra más que el correo. El correo lleva el párrafo y las alertas; la página añade la cuadrícula de números a partir de la cual se escribió el párrafo y, para los meses generados después de que llegara la función, la sección **Llamadas detrás de las decisiones de este mes**." },
        ],
      },
      {
        id: "what-is-on-the-screen",
        heading: "Qué hay en la pantalla",
        blocks: [
          { bullets: [
            "Una fila por mes, encabezada por el mes y el año en su propio idioma («agosto de 2026»), con «{n} alertas este mes» en ámbar cuando el mes levantó alguna. La más reciente está abierta; las demás se despliegan con un toque.",
            "El **resumen** — el párrafo escrito por la IA. Si la empresa había superado su cupo de FieldQuo AI ese mes, el párrafo se sustituye por el mensaje de cupo y una línea en cursiva: «El resumen con IA de este mes se omitió — tu cupo de FieldQuo AI está agotado. Los números de arriba no se ven afectados.»",
            "Las **alertas** — recuadros ámbar. Hoy hay una regla: una tasa de aceptación de presupuestos por debajo del 30% en el mes, con el cambio respecto al mes anterior cuando hubo un mes completo antes.",
            "Los **números** — una pequeña cuadrícula con las cifras entregadas al modelo: ingresos, gastos, margen, presupuestos creados, presupuestos aceptados, tasa de conversión, gasto en marketing, el recuento real de prospectos y, cuando hay algo entre lo que dividir, el costo por prospecto combinado.",
            "**Llamadas detrás de las decisiones de este mes** — cuando la empresa usa la recepcionista de IA o las llamadas salientes, lo que se dijo en las llamadas ligadas a los presupuestos ganados y perdidos del mes, o una frase que dice por qué no se leyó nada (sin llamadas ligadas, cupo agotado, IA no disponible en esta instalación).",
          ] },
          { p: "Antes del primer mes completo no hay nada que mostrar, y la página lo dice: «Aún no hay resúmenes — tu primer resumen mensual aparecerá aquí tras tu primer mes completo de actividad.»" },
        ],
      },
      {
        id: "how-to-open-it",
        heading: "Cómo abrirlo",
        blocks: [
          { steps: [
            "En la barra lateral, bajo **Análisis**, abra **Análisis**. La página se titula **Cómo te comparas**.",
            "Bajo el subtítulo, pulse **Resúmenes semanales**. Se abre la página **Resumen mensual** con el mes más reciente desplegado.",
            "Toque cualquier mes anterior para desplegarlo. No hay nada que generar a mano; las entradas se escriben el día primero de cada mes.",
          ] },
          { figure: "live:app-analytics-benchmark", caption: "Análisis — Cómo te comparas, con la fila de enlaces bajo el título: Resúmenes semanales, Estados financieros, Ganadas y perdidas, Precisión de las estimaciones, Panel de KPI." },
          { note: "El resumen en sí está hoy en inglés, sea cual sea el idioma de su empresa: el encabezado del mes y las palabras propias de la página se traducen, el párrafo de la IA y las frases de alerta no." },
        ],
      },
      {
        id: "what-weekly-means-today",
        heading: "Qué significa «semanal» hoy",
        blocks: [
          { p: "Nada. La etiqueta de la página de Análisis dice **Resúmenes semanales**; la página que abre, su encabezado, su estado vacío y la programación que hay detrás dicen todos mensual. No hay correo semanal, ni cadencia semanal que activar, ni resumen para un mes parcial. Si quiere un número más a menudo que cada mes, la página **KPI** y el panel están en vivo para cualquier periodo que elija — vea [[the-kpi-dashboard|El panel de KPI]] y [[the-dashboard-in-detail|El panel en detalle]]." },
        ],
      },
      {
        id: "who-can-see-it",
        heading: "Quién puede verlo",
        blocks: [
          { p: "La fila **Análisis** de la barra lateral se muestra a cualquiera cuyo acceso incluya precios (**See prices** activado) — Estimator o superior. La página Resumen mensual no pide nada más que un miembro de la empresa con sesión iniciada. El correo va solo al propietario y a los administradores, sea quien sea quien pueda leer la página." },
        ],
      },
    ],
    faq: [
      { q: "¿Puedo cambiar el resumen a semanal?", a: "No. No hay resumen semanal ni ajuste para tenerlo. La etiqueta del enlace es lo único semanal que tiene." },
      { q: "¿Puedo generar el resumen de este mes por adelantado?", a: "No. Los resúmenes se escriben el día primero del mes para el mes que acaba de terminar. Para una vista en vivo del mes en curso, use el panel de KPI." },
      { q: "¿Por qué a un resumen le falta el párrafo?", a: "La empresa había superado su cupo de FieldQuo AI cuando se generó. Los números y las alertas siguen ahí; solo se omitieron las frases escritas por la IA, y la página lo dice bajo la entrada." },
    ],
  },

  "the-monthly-digest-email": {
    title: "El correo de resumen mensual",
    summary:
      "El correo que FieldQuo envía a propietarios y administradores el día primero de cada mes: cuándo sale, quién lo recibe, qué contiene, a partir de qué números se escribe, y qué pasa cuando el cupo de IA está agotado.",
    updated: "2026-09-12",
    intro: [
      "El día primero de cada mes, a las 8:00 UTC, FieldQuo escribe un resumen corto para cada empresa activa y lo envía por correo al propietario y a cada administrador con dirección de correo. El asunto es **Your August summary** — el mes que acaba de terminar. El mismo resumen se archiva en la página **Resumen mensual**, a la que se llega por el enlace **Resúmenes semanales** de **Análisis**.",
      "Es una lectura corta a propósito: tres o cuatro frases escritas por FieldQuo AI a partir de un conjunto fijo de números, y luego las alertas que levantó el código. El modelo nunca calcula nada — cada cifra se calcula primero y se le entrega con la instrucción de usar solo esos números.",
    ],
    sections: [
      {
        id: "overview",
        heading: "Resumen",
        blocks: [
          { p: "El resumen es el único informe de FieldQuo que llega a usted en lugar de esperar a que lo abran. Es interno — se envía a su equipo, nunca a un cliente — así que llega de **FieldQuo** desde digest@fieldquo.com y no desde el remitente de su empresa, y es la única superficie de este grupo firmada por FieldQuo. El párrafo y las alertas están hoy en inglés, sea cual sea el idioma de su empresa." },
          { p: "Se genera tanto si alguien lo mira como si no, para cada empresa cuya incorporación está completa. No hay interruptor para apagarlo ni ajuste para cambiar quién lo recibe." },
        ],
      },
      {
        id: "what-is-in-it",
        heading: "Qué hay en el correo",
        blocks: [
          { bullets: [
            "**El párrafo** — «Write a 3–4 sentence monthly business summary… like a knowledgeable colleague giving a quick update, not a formal report.» Esa es la instrucción que recibe el modelo, junto con los números de abajo y las alertas.",
            "**Las alertas**, como lista con viñetas, cuando las hay. Hoy existe una regla: la tasa de aceptación de presupuestos del mes está por debajo del 30%. Cuando la empresa tuvo un mes completo antes, la frase dice también si eso subió o bajó respecto a él.",
            "Nada más. La cuadrícula de números y la sección **Llamadas detrás de las decisiones de este mes** están solo en la página Resumen mensual — vea [[weekly-digests|Resúmenes semanales]].",
          ] },
        ],
      },
      {
        id: "the-numbers-it-is-written-from",
        heading: "Los números a partir de los que se escribe",
        blocks: [
          { table: {
            head: ["Cifra", "De dónde sale"],
            rows: [
              ["Ingresos, gastos, margen", "El resumen del panel: facturas pagadas, gastos registrados, y la diferencia."],
              ["Presupuestos creados, presupuestos aceptados, tasa de conversión", "El resumen del panel. La tasa de conversión del mes anterior se incluye solo cuando la empresa existía durante todo ese mes — medio mes nunca se compara con uno completo."],
              ["Gasto en marketing", "Cada fila de gasto fechada en el mes que acaba de terminar, en todos los canales. Cuando una fila en otra moneda se convirtió a un tipo fijado, al modelo se le avisa de que la cifra es aproximada."],
              ["Recuento real de prospectos y costo por prospecto combinado", "Los prospectos que llegaron en el mes que acaba de terminar desde canales de entrada activos — los prospectos tecleados a mano e importados quedan fuera — y el gasto en marketing entre ellos. El costo por prospecto se omite por completo cuando no hay prospectos entre los que dividir, nunca se escribe como $0."],
            ],
          } },
          { warning: "Las cuatro primeras filas se leen como las lee el panel — para el mes natural en curso en el momento en que se genera el resumen — y el resumen se genera unas horas después de empezar el mes nuevo. Trate las cifras de ingresos, gastos, margen y presupuestos del correo como una instantánea de ese momento, no como los totales del mes anterior. El gasto en marketing, los prospectos y las llamadas sí son del mes anterior. Para las cifras reales del mes pasado, use **Estados financieros** o **KPI** con **El mes pasado** seleccionado." },
        ],
      },
      {
        id: "when-the-ai-allowance-is-used-up",
        heading: "Cuando el cupo de IA está agotado",
        blocks: [
          { p: "Cada función de IA de FieldQuo comprueba el cupo mensual de la empresa antes de gastar. Si el resumen encuentra el cupo ya agotado, se envía de todos modos: los números no cuestan nada y siempre son reales, así que el correo sale con el mensaje de cupo en lugar del párrafo, y la entrada de la página Resumen mensual lleva una nota en cursiva que dice que el resumen se omitió. Nada se descarta en silencio, y soporte puede ver qué empresas llegaron al tope. Vea [[ai-credit-and-allowance|Crédito y cupo de IA]] para el cupo en sí." },
        ],
      },
      {
        id: "who-receives-it",
        heading: "Quién lo recibe",
        blocks: [
          { p: "El propietario y cada administrador activo que tenga dirección de correo. Los Managers, Dispatchers, Estimators y la cuadrilla no lo reciben, aunque un Manager puede leer el mismo resumen en la página Resumen mensual. No hay baja individual ni forma de añadir un destinatario salvo hacerlo administrador." },
        ],
      },
    ],
    faq: [
      { q: "¿Puedo cambiar el día en que se envía?", a: "No. Se ejecuta el día primero del mes a las 8:00 UTC para todas las empresas, y no hay ajuste para ello." },
      { q: "¿Puedo enviárselo a mi contador?", a: "No desde FieldQuo. Reenvíe el correo, o dele un acceso de Manager o administrador; solo los administradores y el propietario están en la lista." },
      { q: "¿Por qué los ingresos del correo son tan bajos?", a: "Porque se leen para el mes en curso en el momento del envío, unas horas después de cambiar el mes. La página de Estados financieros con El mes pasado seleccionado tiene el total real." },
      { q: "¿El correo llega a los clientes?", a: "Nunca. Es un resumen interno para su equipo, y lo único de este grupo que no es marca blanca — viene de FieldQuo, para usted." },
    ],
  },

  "financial-statements": {
    title: "Estados financieros",
    summary:
      "El estado de pérdidas y ganancias, el flujo de caja, el resumen de impuesto sobre ventas y el balance parcial que FieldQuo construye con lo que ya registra: los controles de periodo y base, qué contiene cada línea, por qué algunas líneas dicen No disponible, y quién puede abrir la página.",
    updated: "2026-09-12",
    intro: [
      "**Estados financieros** ordena las filas que FieldQuo ya guarda — facturas, pagos, gastos, horas aprobadas, ciclos de nómina, préstamos — en los cuatro documentos que pide un contador, un prestamista o un corredor. Su subtítulo es la promesa: «a partir de lo que FieldQuo ya registra. Cada cifra dice qué contiene.» Nada en la página es un tipo nuevo de número; cada línea se puede abrir para mostrar de qué está compuesta, qué incluye y qué deja fuera.",
      "Se llega desde el enlace **Estados financieros** bajo el título de **Análisis**, y desde **Ver el desglose →** en la sección Efectivo de la página de KPI.",
    ],
    sections: [
      {
        id: "overview",
        heading: "Resumen",
        blocks: [
          { p: "La página mantiene dos reglas. Primera, la base contable nunca es implícita: usted elige **Caja** o **Devengo** arriba, la elección se repite como frase completa encima de las cifras, y el estado de pérdidas y ganancias la nombra otra vez. Segunda, nada se muestra como $0.00 a menos que cero sea un hecho — una línea sin nada detrás dice **Nada registrado**, y una línea que FieldQuo no puede responder dice **No disponible** con el motivo, y no aporta nada a ningún total, que entonces se declara **incompleto**." },
          { p: "Las facturas modificadas se cuentan una vez, por el monto de la última versión, fechadas desde la original. Un pago de préstamo se reparte como lo reparte un contable: solo el interés es un costo en pérdidas y ganancias; el capital es dinero que sale y un pasivo más pequeño, nunca un gasto." },
        ],
      },
      {
        id: "what-is-on-the-screen",
        heading: "Qué hay en la pantalla",
        blocks: [
          { bullets: [
            "Cinco botones de periodo — **Este mes**, **El mes pasado**, **Este trimestre**, **Lo que va del año**, **El año pasado** — y un par **Desde** / **Hasta** para cualquier otro rango. Los días se cuentan en UTC.",
            "**Base contable** — **Caja** (la predeterminada) o **Devengo**. Debajo, la frase de base y «Del {from} al {to}, en {currency}.»",
            "Con la base de devengo, un aviso ámbar: los costos de este estado siguen registrados en caja, porque FieldQuo no tiene un libro de facturas de proveedores, así que los ingresos van por devengo y los costos por caja — lea las dos mitades en consecuencia.",
            "Los cuatro estados — **Pérdidas y ganancias**, **Flujo de caja**, **Impuesto sobre ventas cobrado**, **Balance (parcial)** — cada línea con un chevrón que abre **Compuesto por**, **Sumado a partir de**, **Incluye**, **No incluye** y **No se pudo incluir**.",
            "**Cosas que afectan estas cifras** al final: horas todavía pendientes de aprobación, horas aprobadas trabajadas por alguien sin tarifa, un gasto general recurrente que está guardado como una sola fila y por eso aparece en un solo periodo, y hojas de tiempo que cuestan más que los ciclos de nómina aprobados.",
          ] },
          { p: "Un periodo sin nada en absoluto — sin pagos, sin facturas emitidas, sin gastos, sin horas aprobadas, sin ciclos de nómina — muestra una sola frase en lugar de cuatro estados en cero: eso es una ausencia de registros, no un periodo de actividad cero." },
        ],
      },
      {
        id: "the-four-statements",
        heading: "Los cuatro estados",
        blocks: [
          { table: {
            head: ["Estado", "Qué contiene", "Qué no contiene"],
            rows: [
              ["Pérdidas y ganancias", "Ingresos sin impuestos; Materiales, subcontratistas y otros costos de trabajo; Mano de obra directa en trabajos (horas aprobadas a la tarifa de cada persona); Costo del trabajo realizado; Ganancia bruta; Gastos generales (renta, seguro, vehículos, administración); Otros costos operativos; Sueldos no cargados a un trabajo (ciclos de nómina menos la mano de obra ya en trabajos); Intereses de préstamos; Ganancia neta.", "Impuesto sobre la renta, depreciación de vehículos y herramientas, retiros del propietario, capital de préstamos."],
              ["Flujo de caja", "Dinero recibido (por método); Gastos pagados; Sueldos pagados (neto de los ciclos de nómina); Movimiento neto de la actividad registrada; y luego, aparte, los pagos de préstamo que los términos registrados dicen que vencen, repartidos en capital e interés.", "Efectivo en banco, inicial y final — FieldQuo no guarda saldo bancario ni conexión bancaria."],
              ["Impuesto sobre ventas cobrado", "Impuesto cobrado en las facturas emitidas, impuesto dentro del dinero realmente recibido, y cuántas facturas cobraron impuesto, lo tenían desactivado, no debían ninguno, o dicen que aplica impuesto sin cobrarlo.", "Nada presentado ni remitido, impuesto pagado en compras, un desglose GST/QST, impuesto sobre reembolsos. La página lo dice con todas las letras: esto no es una declaración de impuestos."],
              ["Balance (parcial)", "Dinero que le deben (facturas impagadas, por factura) y préstamos pendientes según los términos registrados.", "Efectivo, activos fijos, inventario, facturas de proveedores, impuestos adeudados, patrimonio y todos los totales — mostrados como No disponible, para que el balance declare por sí mismo que no cuadra."],
            ],
          } },
          { note: "Las etiquetas de línea y los motivos bajo una línea No disponible — «FieldQuo doesn't record this», «Your access doesn't include everyone's pay» — están hoy en inglés en la pantalla de todos los idiomas. Los encabezados, botones y nombres de periodo sí están traducidos." },
        ],
      },
      {
        id: "cash-or-accrual",
        heading: "Caja o devengo",
        blocks: [
          { p: "**Caja** cuenta como ingresos el dinero recibido en el periodo y como costo el dinero gastado en él; una factura emitida y todavía sin pagar no es ingreso. Es la base con la que declaran la mayoría de los propietarios que operan su propio negocio, y cada cifra está respaldada por un pago o un gasto que realmente ocurrió. **Devengo** cuenta una factura en el periodo en que se emitió, pagada o no — pero solo para los ingresos. FieldQuo no tiene registro de facturas de proveedores, así que el lado de los costos sigue registrado en caja, y la página lo dice encima de los totales en lugar de llamar devengo a un estado mixto." },
          { tip: "Elija la base con la que declara su contador y quédese en ella. Un estado de caja y uno de devengo para el mismo mes muestran legítimamente ingresos distintos, y la primera pregunta de cualquiera que lea un estado es cuál de los dos tiene en la mano." },
        ],
      },
      {
        id: "who-can-see-it",
        heading: "Quién puede verlo",
        blocks: [
          { p: "Un estado de pérdidas y ganancias es toda la base de costos de la empresa con los ingresos al lado, así que la puerta es la más amplia de este grupo: el interruptor **Job costing**, **See prices**, acceso a **gastos** de toda la empresa y la capacidad de gestionar usuarios. De los niveles incluidos, eso es **Manager**, administradores y el propietario. Crew, Estimator y Dispatcher quedan rechazados." },
          { p: "Un Manager ve la página sin nómina: **Wages not charged to a job** y **Wages paid** dicen No disponible — «Your access doesn't include everyone's pay» — y cada total que los contiene se declara incompleto, en lugar de mostrar en silencio un mes rentable al que le falta la masa salarial." },
        ],
      },
    ],
    faq: [
      { q: "¿Puedo descargar o imprimir los estados?", a: "No desde esta página — no hay PDF ni botón de exportación. Para archivos que entregar a un contador, use la Exportación contable de Control de gastos, que produce CSV de facturas, pagos y gastos para un rango de fechas. Vea [[the-accounting-export|La exportación contable]]." },
      { q: "¿Por qué mi estado de marzo no muestra renta?", a: "Un gasto general recurrente se guarda como una sola fila, fechada una vez, y aparece solo en el periodo en que está fechada esa fila. FieldQuo no fabrica doce filas de renta que nadie ingresó. El aviso al pie de la página dice cuántos compromisos recurrentes hay registrados y cuántos caen en el periodo." },
      { q: "¿Por qué el balance no cuadra?", a: "Porque es parcial y lo dice. FieldQuo no conoce su saldo bancario, sus activos fijos ni sus facturas de proveedores, así que el total de activos, el total de pasivos y el patrimonio se muestran como No disponible en lugar de como cero." },
      { q: "¿Por qué el interés de un préstamo está No disponible?", a: "El préstamo no tiene tasa de interés registrada en Configuración → Gastos generales. Una tasa de cero no se distingue de una tasa que nadie tecleó, así que la línea dice a qué préstamo le falta una en lugar de contabilizar $0 de interés." },
    ],
  },

  "won-and-lost": {
    title: "Ganadas y perdidas",
    summary:
      "El informe de ventas: qué envió, qué ganó y perdió y por cuánto, cuánto tardan los clientes en responder, los motivos que dieron con sus propias palabras, y las reglas que deciden cuándo se imprime un porcentaje.",
    updated: "2026-09-12",
    intro: [
      "**Ganadas y perdidas** responde a la pregunta que la tasa de cierre sola no puede: no solo con qué frecuencia pierde, sino por qué. Su subtítulo lo dice — «Lo que enviaste, lo que volvió y — cuando alguien lo dijo — por qué no salió. Una tasa de éxito te dice que estás perdiendo; los motivos te dicen qué cambiar.» FieldQuo ha registrado un motivo de rechazo en cada presupuesto rechazado desde que existe el campo; esta página es donde por fin los lee.",
      "Se llega desde el enlace **Ganadas y perdidas** bajo el título de **Análisis**. La tasa de cierre de la página de KPI es el mismo cálculo, así que las dos nunca discrepan.",
    ],
    sections: [
      {
        id: "overview",
        heading: "Resumen",
        blocks: [
          { p: "Un presupuesto pertenece al periodo en que se **envió**, no al periodo en que se respondió — así «enviadas en junio» siempre cuadra, por mucho que tarde un cliente en decir que sí. Los presupuestos pendientes no están ni ganados ni perdidos: la tasa de cierre divide solo entre los presupuestos decididos, porque contar como pérdida cada presupuesto todavía en consideración subestimaría un mes cargado justo cuando intenta leerlo." },
          { p: "Los motivos se muestran tal cual, el más reciente primero, y nunca se clasifican en categorías. Un presupuesto perdido sin motivo se cuenta como su propio número — «nadie dijo por qué» — nunca se pliega en «otros» ni se descarta para que los motivos restantes pasen por el cuadro completo. A los volúmenes que envía un taller pequeño, las frases en bruto son el informe." },
        ],
      },
      {
        id: "what-is-on-the-screen",
        heading: "Qué hay en la pantalla",
        blocks: [
          { bullets: [
            "Los cinco botones de periodo, **Desde** / **Hasta**, y la nota de cohorte sobre las fechas de envío.",
            "Cuatro recuentos — **Enviadas** («oportunidades que salieron por la puerta»), **Ganadas**, **Perdidas**, **Aún fuera** — los tres últimos con el dinero debajo: el total aceptado para una ganada, el precio más bajo sobre la mesa para una perdida o un presupuesto todavía fuera.",
            "La **tasa de éxito**, «de {decided} cotizaciones decididas ({won} ganadas, {lost} perdidas)», o **Nada decidido todavía**, o **Muy pocas para leerlo** con la frase que dice por qué.",
            "**Cuánto tardan en responder** — días desde el envío hasta la decisión, lo típico (mediana) junto al promedio, y cuántas decisiones se descartaron por no tener marca de tiempo.",
            "**Por qué las perdiste** — cuántos presupuestos perdidos tienen un motivo registrado, cuántos están mudos, y luego cada motivo con el número de presupuesto, el cliente, la fecha y el valor.",
            "**Según quién escribió la cotización** — una tabla con **Quién**, **Decididas**, **Ganadas**, **Tasa de éxito**, mostrada solo cuando al menos dos personas tienen diez decisiones cada una.",
            "Tres notas al pie cuando aplican: presupuestos sin autor, presupuestos situados por su fecha de decisión porque nunca se marcaron como enviados, y presupuestos sin fecha alguna que no pertenecen a ningún periodo.",
          ] },
        ],
      },
      {
        id: "how-a-quote-is-counted",
        heading: "Cómo se cuenta un presupuesto",
        blocks: [
          { table: {
            head: ["Situación", "Cómo lo trata el informe"],
            rows: [
              ["Un trío Bueno / Mejor / Óptimo", "Una oportunidad, no tres. Ganada si se aceptó alguna opción; perdida si se rechazó una y no se aceptó ninguna; si no, aún fuera. Su valor es el total de la opción aceptada, o la opción más baja cuando no se aceptó nada."],
              ["Aceptado a mano tras una llamada, nunca marcado como enviado", "Se cuenta, en el periodo de la decisión, y se nombra en una nota al pie. Queda fuera del tiempo hasta la decisión, que necesita una fecha de envío real."],
              ["Sin fecha de envío ni fecha de decisión", "En ningún periodo y en ninguna cifra — se cuenta en una nota al pie. La mayoría son anteriores a que FieldQuo registrara esas fechas."],
              ["Decidido antes de que FieldQuo registrara fechas de decisión", "En los recuentos; fuera del promedio de tiempo hasta la decisión en lugar de contarse como decidido el mismo día."],
              ["Reenviado después de que el cliente ya había respondido", "Su decisión cae antes de su fecha de envío, así que no se puede medir y se descarta del promedio."],
            ],
          } },
        ],
      },
      {
        id: "recording-a-reason",
        heading: "Registrar un motivo",
        blocks: [
          { p: "Dos puertas escriben el motivo. En la página pública de aprobación, un cliente que rechaza puede escribir por qué, y sus palabras llegan aquí sin editar. En la oficina:" },
          { steps: [
            "Abra el presupuesto y su página **Consigue la aprobación**.",
            "Pulse **La rechazaron**. Se abre una casilla: **¿Dijeron por qué? (opcional)**.",
            "Escriba lo que dijo el cliente, con sus palabras, y pulse **Registrar como perdida**. El presupuesto muestra **Motivo registrado**.",
          ] },
          { tip: "Cuando la mayoría de sus pérdidas están mudas, la página lo dice: «{n} de {lost} pérdidas son mudas. Nada de aquí puede decirte por qué se fueron esas — la próxima que pierdas, pregunta y escribe en la cotización lo que te digan.» Esa frase es el hallazgo más útil que el informe puede hacer hasta que existan los motivos." },
        ],
      },
      {
        id: "the-floors",
        heading: "Cuándo se imprime un porcentaje",
        blocks: [
          { bullets: [
            "**Diez presupuestos decididos** antes de que aparezca una tasa de cierre. Con diez, un presupuesto que cambie mueve la tasa diez puntos; por debajo, la página muestra los recuentos y «Muy pocas para leerlo» — «3 de 4» es honesto a cualquier tamaño, «75%» no lo es.",
            "**Dos personas con diez decisiones cada una** antes de que aparezca la tabla por estimador. Un solo grupo es el total de la empresa con un nombre encima, no una comparación.",
            "**Ningún porcentaje en absoluto** en un periodo vacío: «No salió ninguna cotización entre {from} y {to}. Eso no es una tasa de éxito del 0 % — es un periodo sin nada dentro.»",
          ] },
        ],
      },
      {
        id: "who-can-see-it",
        heading: "Quién puede verlo",
        blocks: [
          { p: "Más ligero que los demás informes a propósito: no muestra costo, ni margen, ni sueldo, así que solo necesita acceso de lectura a presupuestos y **See prices**. Eso es **Estimator**, **Dispatcher**, **Manager**, administradores y el propietario — el estimador de cuyos presupuestos se trata no queda fuera. Crew queda rechazado." },
        ],
      },
    ],
    faq: [
      { q: "¿Por qué mi tasa de cierre es distinta del número de presupuestos aceptados sobre el número enviado?", a: "Porque los presupuestos que siguen fuera no son pérdidas. La tasa es ganadas sobre decididas (ganadas más perdidas); la página imprime la fracción exacta debajo." },
      { q: "¿FieldQuo puede agrupar los motivos en precio, plazos y demás?", a: "No, a propósito. Tres frases clasificadas en categorías son un patrón que el informe inventó, no uno que encontró. Lea los motivos; son cortos." },
      { q: "Un cliente aceptó la opción del medio de tres. ¿Las otras dos cuentan como perdidas?", a: "No. Las tres opciones son una sola oportunidad, y está ganada." },
    ],
  },

  "estimate-accuracy": {
    title: "Precisión de las estimaciones",
    summary:
      "Cómo se comparan las estimaciones de costo de sus trabajos terminados con lo que realmente costaron — horas de mano de obra, costo de mano de obra y materiales por separado — con los umbrales, la banda de tolerancia, los segmentos, y los problemas de datos que la página nombra antes de nombrar un porcentaje.",
    updated: "2026-09-12",
    intro: [
      "El costeo de trabajos le dice que una cocina se alargó. **Precisión de las estimaciones** le dice que todas las cocinas se alargan. Toma la misma comparación de estimación contra real y la ejecuta sobre cada trabajo terminado en un periodo, dividida por dirección y por dimensión, porque la mano de obra y los materiales se tuercen por razones distintas: la mano de obra se pasa cuando el trabajo llevó más tiempo del que pensó el estimador, los materiales cuando la lista de precios está desactualizada o alguien compró el imprimador caro.",
      "Se llega desde el enlace **Precisión de las estimaciones** bajo el título de **Análisis**, y desde **Informe completo →** en la tarjeta de Ejecución de la página de KPI. Ninguna IA escribe nada de esto: cada frase bajo **Lo que dicen los números** se genera a partir de la aritmética que la produjo.",
    ],
    sections: [
      {
        id: "overview",
        heading: "Resumen",
        blocks: [
          { p: "Un trabajo cuenta cuando está **terminado**, con fecha de finalización dentro del rango — un trabajo todavía en marcha tiene costos que siguen llegando y parecería por debajo del presupuesto siempre. Los trabajos archivados se incluyen (archivar es guardar, no cancelar); los trabajos cancelados no. No hace falta factura: esto mide la estimación de costos, no el margen." },
          { p: "El titular de cada tarjeta es la **mediana** de los porcentajes por trabajo, no la media, para que un trabajo catastrófico no pueda convertirse en el titular. La media se imprime al lado, y cuando las dos se separan más de 25 puntos la página nombra el trabajo que lo causa. Un trabajo dentro de **±5%** de su estimación cuenta como en el blanco." },
        ],
      },
      {
        id: "what-is-on-the-screen",
        heading: "Qué hay en la pantalla",
        blocks: [
          { bullets: [
            "Botones de periodo — **Este trimestre**, **Últimos 6 meses**, **Lo que va del año**, **Últimos 12 meses**, **El año pasado** — y **Desde** / **Hasta**. Preajustes más largos que los de los demás informes, porque cinco trabajos comparables tardan en acumularse.",
            "La línea de alcance: «Trabajos marcados como terminados entre {from} y {to}: {jobs}. De esos, {comparable} tenían a la vez una estimación de costos guardada y suficiente registrado como para comparar.» — y el umbral: «Solo se muestra un porcentaje donde al menos 5 trabajos lo sostienen.»",
            "**Lo que dicen los números** — los hallazgos, los más graves primero: problemas de datos, luego el sesgo en cada dimensión, luego cualquier oficio que se comporte distinto del resto.",
            "Tres tarjetas — **Labour hours**, **Labour cost**, **Materials and other job costs** — cada una con «{n} de {total} trabajos comparables», la mediana «en el trabajo típico», «{over} por encima, {under} por debajo, {onTarget} en el blanco», **Promedio entre los trabajos**, **Total, estimado frente a real**, y los segmentos **Por oficio**, **Por tamaño de trabajo**, **Por cliente** y **Por miembro del equipo, en los trabajos que hizo solo**.",
            "**Lo que está frenando este informe** — recuentos de trabajos terminados sin estimación de costos guardada, sin gastos registrados, con hojas de tiempo todavía pendientes de aprobación, horas trabajadas por alguien sin tarifa, y trabajos que cubren más de un oficio.",
          ] },
        ],
      },
      {
        id: "the-three-comparisons",
        heading: "Las tres comparaciones",
        blocks: [
          { table: {
            head: ["Tarjeta", "Estimado", "Real", "Por qué va aparte"],
            rows: [
              ["Labour hours", "Las horas en la estimación de costos guardada del presupuesto", "Horas aprobadas registradas contra el trabajo", "La habilidad de estimar con la masa salarial quitada. Un trabajador sin tarifa o un aumento no pueden distorsionarla."],
              ["Labour cost", "El costo de mano de obra de la estimación", "Horas aprobadas a la tarifa de cada persona", "Los errores de tarifa y los errores de horas caen aquí los dos, así que no es la que hay que usar para poner precios."],
              ["Materials and other job costs", "Los materiales de la estimación", "Cada gasto etiquetado al trabajo — materiales, subcontratistas, viajes al vertedero, alquiler", "Las categorías de gasto son texto libre, así que el lado real no se puede dividir más fino que el trabajo."],
            ],
          } },
          { p: "Un trabajo queda excluido de una comparación — y el motivo listado bajo la tarjeta — cuando cualquiera de los dos lados es desconocido: sin estimación guardada, sin horas registradas, hojas de tiempo pendientes de aprobación, un trabajador sin tarifa (fuera del costo de mano de obra, dentro de las horas de mano de obra), o sin gastos registrados en absoluto. Un trabajo terminado sin filas de gasto no es un trabajo que no gastó nada; puntuarlo como un ahorro del 100% sería la mentira más halagadora que la página podría contar." },
        ],
      },
      {
        id: "what-the-findings-say",
        heading: "Qué dicen los hallazgos",
        blocks: [
          { bullets: [
            "**Crítico** — horas aprobadas trabajadas por alguien sin tarifa por hora registrada, con nombre. Esas horas no cuestan nada en FieldQuo y arrastrarían todo el periodo hacia por debajo del presupuesto; defina la tarifa bajo **Tu equipo** y los trabajos vuelven al informe.",
            "**Advertencia** — horas pendientes de aprobación, trabajos sin estimación guardada («Rellene Costo y margen en un presupuesto antes de enviarlo»), trabajos sin gastos.",
            "**Hallazgo** — un sesgo lo bastante constante como para ser un hábito de precios (siete de cada diez trabajos cayendo del mismo lado), o un oficio que se aleja más de diez puntos de otro: «una sola corrección para toda la empresa sobrevaloraría uno y dejaría corto al otro.»",
            "**Info** — una muestra delgada («5 es el mínimo del que este informe saca un porcentaje. Con 2 más, lo hará.»), una dimensión en el blanco, o una media separada de la mediana por un trabajo con nombre.",
          ] },
          { note: "Las frases de hallazgo se generan hoy en inglés en la pantalla de todos los idiomas; los encabezados, etiquetas y nombres de periodo que las rodean sí están traducidos." },
        ],
      },
      {
        id: "who-can-see-it",
        heading: "Quién puede verlo",
        blocks: [
          { p: "El interruptor **Job costing** y acceso a los trabajos de toda la empresa — la propia base de costos. **Manager**, administradores y el propietario lo ven; Crew, Estimator y Dispatcher quedan rechazados, y a un miembro limitado a sus propios trabajos se le rechaza en lugar de mostrarle un consolidado de la empresa construido con un tercio de las pruebas." },
          { p: "Dos segmentos tienen puerta propia y están ausentes, no vacíos, para quien no la tiene: **Por cliente** necesita la libreta de clientes, y **Por miembro del equipo** necesita las horas de todos — la página imprime «tu nivel de acceso no incluye…» en su lugar." },
        ],
      },
    ],
    faq: [
      { q: "¿Por qué la página de KPI muestra un solo número de precisión de la estimación y esta página tres?", a: "La tarjeta de KPI es la variación mediana de la comparación de costo de mano de obra para el mismo periodo. Esta página mantiene aparte horas, costo y materiales porque se corrigen de formas distintas." },
      { q: "Todos mis trabajos se pasaron pero la página no muestra porcentaje.", a: "Menos de cinco eran comparables. Los recuentos se imprimen igualmente — «3 por encima, 0 por debajo, 0 en el blanco» — porque tres trabajos que coinciden son una observación sobre tres trabajos, no una tasa." },
      { q: "¿Un trabajo necesita factura para contarse?", a: "No. Los costos están cerrados haya salido o no el papeleo. Necesita una estimación de costos guardada en el presupuesto y horas aprobadas o gastos en el trabajo." },
    ],
  },

  "expense-tracking-and-burn-rate": {
    title: "Control de gastos y su ritmo de gasto",
    summary:
      "La pantalla Control de gastos: las cuatro tarjetas del mes, de qué se construye el ritmo de gasto mensual, por qué Autonomía muestra un guion, el Resumen de IA, los desgloses y la tendencia, cómo agregar un gasto y qué cambia cada campo, y quién puede ver el consolidado de la empresa.",
    updated: "2026-09-12",
    intro: [
      "**Control de gastos** es «A dónde va tu dinero — por trabajo, gastos generales y categoría — más tu ritmo de gasto mensual.» Es la misma pantalla tanto si abre **Gastos** bajo Finanzas en la barra lateral como **Control de gastos** bajo Cobros en Configuración: un mes a la vez, cuatro tarjetas arriba, luego los desgloses, la tendencia de seis meses, los recibos recientes y la exportación contable.",
      "Este artículo es esa pantalla y el formulario **Agregar gasto**. El importador de estados de cuenta tiene su propio artículo, [[import-expenses-from-a-bank-csv|Importar gastos desde un CSV del banco]], y la exportación el suyo, [[the-accounting-export|La exportación contable]].",
    ],
    sections: [
      {
        id: "overview",
        heading: "Resumen",
        blocks: [
          { p: "Un gasto en FieldQuo es un monto con fecha y una categoría, opcionalmente ligado a un trabajo, marcado como gasto general, marcado como recurrente, o asociado a un vehículo. Esas cuatro decisiones deciden dónde aparece: en el costeo del trabajo y en la precisión de las estimaciones, en el ritmo de gasto, en el costo de operación del vehículo, o simplemente en el total del mes. La pantalla es un mes de esas filas, sumadas de las formas en que un contratista pregunta por ellas." },
          { figure: "live:app-settings-expense-tracking", caption: "Configuración → Control de gastos — el selector de mes, las cuatro tarjetas, Resumen de IA, los dos desgloses, la Tendencia de 6 meses, Gastos recientes y la Exportación contable." },
        ],
      },
      {
        id: "what-is-on-the-screen",
        heading: "Qué hay en la pantalla",
        blocks: [
          { bullets: [
            "**Importar desde un CSV del banco** y **Agregar gasto** arriba a la derecha, y un selector de mes (**Mes anterior** / **Mes siguiente**).",
            "**Gastos registrados este mes** — cada gasto fechado en el mes, sea cual sea su categoría o asociación.",
            "**Ritmo de gasto mensual** — «Gastos generales + salarios + deuda»: lo que cuesta mantener el negocio funcionando un mes, a partir de los registros de **Configuración → Gastos generales**. No cambia con el mes que esté viendo.",
            "**Autonomía** — meses de efectivo a ese ritmo. Dice **—** con **Agrega el efectivo disponible para estimar**: hoy no hay ningún lugar en FieldQuo donde ingresar el efectivo disponible, así que la tarjeta se queda en un guion. FieldQuo no guarda saldo bancario ni conexión bancaria.",
            "**Gasto relacionado con trabajos** — gastos ligados a un trabajo este mes, con **Gastos generales {amount} · General {amount}** debajo para los otros dos tipos.",
            "**Resumen de IA** — un botón, **Generar resumen**, que escribe un párrafo en lenguaje llano sobre el gasto del mes en su idioma. Ver más abajo.",
            "**Desglose del gasto mensual** — **Gastos generales**, **Salarios**, **Pagos de deuda** como barras, y **Gestionar salarios y deuda** hacia la página de Gastos generales.",
            "**Gasto por categoría** — las categorías de este mes, la mayor primero, con la parte de cada una.",
            "**Tendencia de 6 meses** — una barra por mes, este mes el último.",
            "**Gastos recientes** — las veinte filas más nuevas de todos los meses, cada una etiquetada **Gastos generales** o **Vinculado a trabajo**, con un icono de eliminar.",
            "**Exportación contable** — un rango de fechas como CSV para su contador.",
          ] },
        ],
      },
      {
        id: "how-to-add-an-expense",
        heading: "Cómo agregar un gasto",
        blocks: [
          { steps: [
            "Pulse **Agregar gasto**.",
            "Elija una **Categoría** — Materials, Fuel & Vehicle, Tools & Equipment, Insurance, Rent & Utilities, Software & Subscriptions, Marketing, Permits & Licensing, Office Supplies, Meals & Travel, u **Other** con un **Nombre de categoría personalizada**. Por debajo, las categorías son texto libre; todo lo que ya exista en sus datos aparece en el desglose aunque no esté en la lista.",
            "Ingrese el **Monto** y la **Fecha**.",
            "Elija **Asociar con**: **General**, **Un trabajo** (y luego **Selecciona un trabajo...**), o **Gastos generales**.",
            "Marque **Recurrente (alimenta el ritmo de gasto de abajo)** si es un costo fijo, y elija **Semanal**, **Mensual** o **Anual**.",
            "Opcionalmente elija un **Vehículo (opcional)** y añada **Notas**, y luego pulse **Agregar gasto**.",
          ] },
        ],
      },
      {
        id: "what-each-control-changes",
        heading: "Qué cambia cada control",
        blocks: [
          { table: {
            head: ["Control", "Qué cambia"],
            rows: [
              ["Asociar con → Un trabajo", "El monto cae en el costeo de ese trabajo y en la comparación de materiales de Precisión de las estimaciones, y se cuenta en Gasto relacionado con trabajos. El costeo de trabajos solo lee filas de gasto — una compra marcada en la lista de compras del trabajo y nunca ingresada aquí le resulta invisible."],
              ["Asociar con → Gastos generales", "La fila se etiqueta como Gastos generales, se cuenta en la cifra Gastos generales bajo Gasto relacionado con trabajos y, cuando además es recurrente, alimenta el ritmo de gasto."],
              ["Recurrente + frecuencia", "La fila se trata como un costo mensual fijo: semanal × 4.33, anual ÷ 12. Aparece en el ritmo de gasto, en el costo por trabajo de Configuración → Gastos generales, y en el registro de Costos fijos de allí — son las mismas filas. Sigue fechada una sola vez, así que los estados y el total del mes la cuentan en un solo mes."],
              ["Vehículo", "El monto se carga al costo de operación de ese vehículo en Vehículos."],
              ["Eliminar (el icono de papelera)", "Quita la fila al instante, sin confirmación, y cada cifra construida a partir de ella cambia de inmediato."],
            ],
          } },
        ],
      },
      {
        id: "the-burn-rate-and-the-ai-summary",
        heading: "El ritmo de gasto y el Resumen de IA",
        blocks: [
          { p: "El ritmo de gasto es efectivo: los gastos generales recurrentes a su equivalente mensual, más las filas de **Salarios** de Configuración → Gastos generales (un sueldo de estructura por hora necesita horas por semana o no aporta nada), más el **Pago mensual** completo de cada préstamo activo. La depreciación no está, porque no mueve dinero. La cifra de costo que usa el precio mínimo es distinta — vea [[overhead-and-your-minimum-price|Gastos generales y su precio mínimo]]." },
          { p: "**Generar resumen** envía las cifras del mes — el total, los desgloses por categoría y por asociación, el ritmo de gasto y sus partes, la autonomía, la tendencia de seis meses — a FieldQuo AI con la instrucción de usar solo esos números, e imprime tres o cuatro frases en su idioma. Debajo, alertas que el código levantó por su cuenta: autonomía de menos de tres meses (nunca, mientras no se pueda ingresar el efectivo disponible), una categoría con el 40% o más del mes, o un mes un 15% o más por encima o por debajo del anterior. Se escribe bajo demanda, no se guarda, y se borra cuando cambia de mes." },
          { note: "El botón cuenta contra el cupo mensual de FieldQuo AI de la empresa y se rechaza, con el mensaje de cupo, cuando este se agota. Solo los propietarios, administradores y Managers pueden pulsarlo." },
        ],
      },
      {
        id: "who-can-see-it",
        heading: "Quién puede verlo",
        blocks: [
          { p: "El consolidado — las tarjetas, los desgloses, la tendencia — necesita acceso a **gastos** de toda la empresa («everyone's»): **Manager**, administradores y el propietario. La fila **Gastos** y la fila de Configuración se ocultan a cualquiera por debajo de eso. Crew, Estimator y Dispatcher pueden seguir registrando sus propios gastos en sus propias pantallas y ven solo sus propias filas; esta página no se les muestra." },
        ],
      },
    ],
    faq: [
      { q: "¿Cómo relleno Autonomía?", a: "Hoy no puede. La tarjeta pide el efectivo disponible y ninguna pantalla de FieldQuo lo acepta, así que Autonomía se queda en un guion. El ritmo de gasto mensual es el número que sí es real." },
      { q: "Agregué la renta como gasto normal. ¿Por qué el ritmo de gasto sigue en $0?", a: "Solo las filas marcadas como Recurrente con una frecuencia, y etiquetadas como Gastos generales, alimentan el ritmo de gasto. Agregue la renta una vez como Recurrente / Mensual / Gastos generales — o bajo Costos fijos en Configuración → Gastos generales, que escribe la misma fila." },
      { q: "¿Por qué el ritmo de gasto no cambia cuando paso a otro mes?", a: "Se construye a partir de los registros fijos, no de los recibos de ese mes. Gastos registrados este mes y los desgloses siguen al mes; el ritmo de gasto es lo que el negocio cuesta cada mes." },
      { q: "¿El resumen de IA se guarda en algún sitio?", a: "No. Se genera cuando pulsa el botón y se muestra en la página; el resumen mensual es el escrito que sí se guarda y se envía por correo." },
    ],
  },

  "import-expenses-from-a-bank-csv": {
    title: "Importar gastos desde un CSV del banco",
    summary:
      "Cómo traer la exportación de un estado de cuenta a Control de gastos: el archivo que FieldQuo acepta, la asignación de columnas, las preguntas de signo y fecha que hace, el paso de revisión donde todavía no se guarda nada, en qué se convierten las filas importadas, y qué detiene un duplicado.",
    updated: "2026-09-12",
    intro: [
      "En lugar de teclear un mes de recibos, exporte un estado de cuenta de su banco como CSV y pulse **Importar desde un CSV del banco** en **Control de gastos**. FieldQuo lee el archivo, le pregunta qué columna es cuál, muestra cada fila que pretende crear, y no escribe nada hasta que usted pulsa **Importar {n} gastos**. No hay conexión bancaria: FieldQuo no guarda credenciales bancarias ni conexión con el banco, así que el CSV es todo el camino.",
      "El importador está hecho para rechazar en lugar de adivinar. Una columna de fechas que podría leerse con el día primero o el mes primero se detiene y pregunta; un depósito se omite como «no es un gasto» en lugar de contabilizarse como un costo negativo; una fila que coincide con algo ya registrado se excluye como duplicada.",
    ],
    sections: [
      {
        id: "overview",
        heading: "Resumen",
        blocks: [
          { p: "La página se titula **Importar gastos desde un CSV** — «Sube la exportación de un estado de cuenta, asigna sus columnas y revisa cada fila antes de que se guarde nada.» Tres pasos: subir, asignar, revisar. El navegador lee el archivo solo para mostrarle los encabezados y unas pocas filas de muestra; el servidor lo vuelve a leer para construir la lista de revisión, así que lo que muestra el navegador nunca se toma como el registro de lo que se creará." },
          { p: "Un archivo es un .csv plano de hasta **5,000** filas — unos años de estados de cuenta de un contratista pequeño. Por encima de eso se leen las primeras filas y la página dice que pase el resto a un segundo archivo. Una hoja de cálculo renombrada a .csv, un archivo vacío, o un archivo con encabezados y sin filas reciben cada uno su propio mensaje." },
        ],
      },
      {
        id: "the-three-steps",
        heading: "Los tres pasos",
        blocks: [
          { steps: [
            "**Elige un archivo CSV** o arrastre uno.",
            "**Asigna las columnas.** Cada columna del archivo recibe un desplegable: **Fecha**, **Descripción**, **Importe**, **Cargo (dinero que sale)**, **Abono (dinero que entra)**, **Categoría** u **Omitir**. FieldQuo rellena de antemano los encabezados obvios, pero **Continuar (n/3)** se activa solo cuando Fecha, Descripción y un importe — una sola columna Importe o una columna Cargo — están asignados.",
            "Responda la pregunta del signo: «En este archivo, el dinero que sale (un gasto) aparece como:» **Números negativos, como -45,00** o **Números positivos, como 45,00**. La respuesta preseleccionada sale de contar los valores de muestra; es un valor por defecto, no una decisión.",
            "Compruebe el **Formato de fecha detectado**. Si las fechas se pueden leer de las dos formas, elija **Primero el día — 13/01/2024 es el 13 de enero** o **Primero el mes — 01/13/2024 es el 13 de enero**. Si las fechas no se reconocen en absoluto, la página lo dice y se detiene.",
            "Defina una **Categoría por defecto** — se usa en las filas sin columna de categoría o con la celda de categoría vacía — y continúe.",
            "**Revisa antes de importar.** «Todavía no se guarda nada — desmarca las filas que no quieras y asigna un trabajo donde corresponda.» Cada fila tiene una casilla y un desplegable **Trabajo**; los recuentos dicen «listas para importar», «excluidas por duplicadas», «no se pudieron leer», «depósitos, no gastos».",
            "Pulse **Importar {n} gastos**. La página confirma «Se importaron {n} gastos.» con **Volver a Control de gastos** e **Importar otro archivo**.",
          ] },
          { figure: "live:app-settings-expense-tracking", caption: "Control de gastos — Importar desde un CSV del banco está junto a Agregar gasto arriba; las filas importadas caen en Gastos recientes y en las cifras del mes." },
        ],
      },
      {
        id: "what-the-review-decides",
        heading: "Qué decide la revisión sobre cada fila",
        blocks: [
          { table: {
            head: ["Estado de la fila", "Qué significa", "Qué pasa"],
            rows: [
              ["Lista para importar", "Una fecha, una descripción y una salida de dinero según la convención de signo que usted confirmó.", "Se crea cuando pulsa Importar, a menos que la desmarque."],
              ["Posible duplicado", "Misma fecha, mismo importe y misma descripción (ignorando mayúsculas, acentos y espacios) que un gasto ya registrado para la empresa desde cualquier fuente — o que una fila anterior del mismo archivo.", "Excluida. La etiqueta la nombra; no se escribe."],
              ["Depósitos, no gastos", "Un abono según la convención de signo — una entrada de dinero. La forma normal de un estado de cuenta, no un error.", "Omitida. **Mostrar las {n} filas omitidas** las lista."],
              ["No se pudieron leer", "Una fecha o un importe en blanco o ilegible en esa fila concreta.", "Omitida. **Mostrar las {n} filas que no se pudieron leer** las lista con el motivo."],
            ],
          } },
          { p: "Los importes se leen en las formas en que los bancos exportan: «$1,234.56», «(125.50)», «125.50-», «1.234,56». Los símbolos y códigos de moneda se quitan; el último separador de un valor se toma como separador decimal." },
        ],
      },
      {
        id: "what-the-rows-become",
        heading: "En qué se convierten las filas importadas",
        blocks: [
          { bullets: [
            "Un gasto por fila, fechado según el estado de cuenta, con la descripción como notas, la categoría del archivo o su categoría por defecto, y el trabajo que eligió en la revisión (o ninguno).",
            "**De una sola vez, nunca recurrente**, y sin etiqueta de Gastos generales. Un estado de cuenta son doce pagos de renta separados, no una declaración sobre todos los meses futuros; importarlos como recurrentes contaría una renta doce veces en el ritmo de gasto. La página lo dice: «Para que un gasto recurrente como la renta alimente el KPI de consumo mensual, agrégalo aparte en Configuración → Gastos generales.»",
            "Se escribe una vez. Una respuesta lenta y un segundo clic no pueden duplicar el lote — la sesión de revisión lleva una sola clave, y una repetición dice «Este archivo ya se había importado — no se escribió nada nuevo.»",
            "Se vuelve a comprobar en el momento de escribir: «Otras {n} coincidían con transacciones registradas desde que abriste esta revisión y se omitieron.»",
            "Una sola entrada en el Registro de actividad para todo el lote, no una por fila.",
          ] },
          { warning: "Las filas se emparejan por fecha, importe y descripción. Dos cargas de combustible de $45.00 realmente distintas en la misma estación el mismo día le parecerán una sola al importador; no desmarque nada, y agregue la segunda a mano si la etiqueta se equivoca." },
        ],
      },
      {
        id: "who-can-do-it",
        heading: "Quién puede hacerlo",
        blocks: [
          { p: "Importar necesita el mismo acceso que registrar un gasto — el nivel que deja a una persona agregar los suyos — así que cualquiera con un escalón de **Expenses** por encima de **none** puede ejecutar el importador. El botón vive en **Control de gastos**, que se muestra solo a **Manager**, administradores y el propietario (acceso a gastos de toda la empresa); la página que abre no pide más." },
        ],
      },
    ],
    faq: [
      { q: "¿FieldQuo puede conectarse directamente a mi banco?", a: "No. No hay conexión bancaria y FieldQuo nunca guarda credenciales bancarias. Exporte un CSV de su banco e impórtelo; la detección de duplicados ignora de dónde vino una fila, así que reimportar más adelante un estado de cuenta que se solape no crea nada dos veces." },
      { q: "El archivo usa una columna de Cargo y una de Abono. ¿Cuál asigno?", a: "Las dos. Las filas de cargo se convierten en gastos; las filas de abono se omiten como depósitos. Si el archivo tiene en cambio una sola columna Importe con signo, asígnela y responda la pregunta del signo." },
      { q: "¿Puedo importar materiales contra un trabajo?", a: "Sí — elija el trabajo en el desplegable Trabajo en el paso de revisión. La fila entonces cuenta en el costeo de ese trabajo y en Precisión de las estimaciones." },
      { q: "¿Por qué mis fechas quedaron un mes desplazadas?", a: "No pueden, por diseño: cuando el día y el mes no se distinguen a partir de los valores, el importador se detiene y pregunta. Si el archivo mezcla formas, rechaza la columna y lo dice." },
    ],
  },

  "overhead-and-your-minimum-price": {
    title: "Gastos generales y su precio mínimo",
    summary:
      "Configuración → Gastos generales: la capacidad de trabajos por semana y el margen objetivo que convierten sus costos fijos en un costo por trabajo y un precio mínimo, los cinco registros que lo alimentan, el panel de mano de obra no absorbida, dónde se usa el número, y quién puede verlo.",
    updated: "2026-09-12",
    intro: [
      "**Gastos generales** es «Costos fijos mensuales. Divididos entre cuántos trabajos puedes asumir, son el precio más bajo al que puede salir un trabajo y aun así cubrir el negocio.» Es el número que un contratista más quiere y menos veces tiene, y a propósito no se adivina: hasta que usted diga cuántos trabajos por semana puede asumir, la página muestra los registros y ningún precio.",
      "La página está bajo **Servicios y precios** en el menú de Configuración. Este artículo es la página de arriba abajo; la regla de precios en sí, y por qué usa costo y no efectivo, también está en [[the-break-even-price|El precio de equilibrio]].",
    ],
    sections: [
      {
        id: "overview",
        heading: "Resumen",
        blocks: [
          { p: "Todo en esta página es una sola suma: lo que cuesta un mes de actividad, entre los trabajos que hace en un mes, con el recargo de su margen objetivo. El lado del costo se lee de cinco registros de la misma página — costos fijos, salarios, deuda, activos, facturas — y de nada más; no hay ningún promedio del sector ni regla general en ninguna parte. Cambie un registro y el precio cambia al instante." },
          { figure: "live:app-settings-overhead", caption: "Configuración → Gastos generales — Tu precio mínimo con Trabajos por semana y los cuatro recuadros, luego Horas pagadas que nunca llegaron a un trabajo, y los registros debajo." },
        ],
      },
      {
        id: "what-is-on-the-screen",
        heading: "Qué hay en la pantalla",
        blocks: [
          { bullets: [
            "**Tu precio mínimo** — «¿Cuántos trabajos puede asumir tu equipo en una semana normal?» con **Trabajos por semana**, **Margen objetivo %** (valor indicativo **20 (predeterminado)**) y **Guardar**. Hasta que se defina la capacidad: «Dinos cuántos trabajos por semana puedes asumir y calcularemos tu precio mínimo. Sin eso no hay nada entre lo que dividir tus gastos generales.»",
            "Cuatro recuadros — **Costos fijos mensuales**, **Trabajos / mes**, **Costo por trabajo**, **Precio mínimo** — y debajo las frases que explican el total: «Incluye {fixed} de costos fijos + {salaries} de salarios + {debt} de pagos de deuda», la depreciación y los intereses de préstamo que también incluye, el efectivo que realmente sale del banco y por qué difiere, y «Con un margen objetivo del {pct}%. Esto cubre solo los gastos generales; los materiales y la mano de obra del trabajo van aparte.»",
            "**Horas pagadas que nunca llegaron a un trabajo** — los últimos 30 días de semanas garantizadas frente a las horas registradas en trabajos: **Mano de obra no absorbida**, **Horas no absorbidas**, y una fila por trabajador (**Trabajador**, **Previsto**, **En trabajos**, **No absorbido**, **Coste**).",
            "**Costos fijos** — «Alquiler, seguro, teléfono, suscripciones: todo lo que llega cada mes, ganes un trabajo o no.» Nombre, **Monto**, semanal / mensual / anual, **Agregar costo fijo**.",
            "**Salarios** — solo gastos generales del negocio: su propio retiro, un sueldo de oficina. **Monto** con semanal / mensual / anual / por hora (**Horas / semana**, **Tarifa / h**). No se usan para pagarle a nadie — el pago de un empleado viene de Gestionar equipo y aparece en Nómina.",
            "**Deuda** — préstamos y financiaciones: **Capital**, **Pago mensual**, **Tipo de interés (% anual)**, **Agregar deuda**.",
            "**Activos y depreciación** — la camioneta, el remolque, el equipo de pintura: **Lo que costó**, **Valor de reventa (opcional)**, **¿Cuántos meses durará?**, **En servicio desde**, **¿Con qué préstamo se compró?**, **Vendido o dado de baja hoy**, **Añadir activo**.",
            "**Facturas por pagar** — **Pendiente**, **Sale este mes**, **Vencida**, cada factura con **Vence el {date}** y **Marcar pagada**, **Añadir factura**.",
          ] },
        ],
      },
      {
        id: "how-the-price-is-worked-out",
        heading: "Cómo se calcula el precio",
        blocks: [
          { steps: [
            "**Trabajos / mes** = **Trabajos por semana** × 4.33.",
            "**Costos fijos mensuales** = costos fijos recurrentes a su equivalente mensual + salarios + depreciación de los activos en servicio + intereses de los préstamos vinculados a un activo + el pago completo de los préstamos no vinculados a nada.",
            "**Costo por trabajo** = Costos fijos mensuales ÷ Trabajos / mes.",
            "**Precio mínimo** = Costo por trabajo ÷ (1 − margen objetivo). El margen predeterminado es 20%; el campo acepta de 0 a 95.",
          ] },
          { p: "La cifra de costo no es la cifra de efectivo, y la página imprime las dos. El efectivo cuenta todo el pago del préstamo y nada por el desgaste; el costo cuenta el desgaste (la depreciación) y solo el interés de un préstamo que compró un activo, porque devolver capital no es un gasto. Un piso construido sobre el efectivo cobra la camioneta dos veces mientras dura el préstamo y la pierde el mes en que el préstamo termina — así es como un contratista cae en silencio por debajo del punto de equilibrio. El **Ritmo de gasto mensual** de Control de gastos es la cifra de efectivo; los **Costos fijos mensuales** de aquí son la cifra de costo." },
          { warning: "Un activo sin préstamo vinculado junto a un préstamo sin activo vinculado dispara la propia advertencia de la página: si son la misma camioneta, la está cobrando dos veces. Vincúlelos con **¿Con qué préstamo se compró?** y el préstamo pasa a contar solo como intereses." },
        ],
      },
      {
        id: "what-each-register-feeds",
        heading: "Qué alimenta cada registro",
        blocks: [
          { table: {
            head: ["Registro", "En el precio mínimo", "En el ritmo de gasto", "En otros sitios"],
            rows: [
              ["Costos fijos", "Sí, al equivalente mensual", "Sí", "Las mismas filas que un gasto Recurrente + Gastos generales en Control de gastos; los estados cuentan cada una en el mes en que está fechada."],
              ["Salarios", "Sí", "Sí", "En ningún otro sitio — nunca le pagan a nadie."],
              ["Deuda", "Solo el interés cuando está vinculada a un activo; el pago completo si no", "El pago mensual completo", "Intereses y capital de préstamos en Estados financieros; préstamos pendientes en el balance."],
              ["Activos y depreciación", "Sí — depreciación lineal mientras está en servicio, y se detiene cuando está totalmente amortizado o dado de baja", "No — la depreciación no mueve dinero", "Valor contable por activo; el costo de un vehículo en Vehículos."],
              ["Facturas por pagar", "No — «Las facturas no cambian tu precio mínimo — el coste recurrente de arriba ya lo cubre. Esto es flujo de caja, no coste.»", "No", "Solo esta página. Marcar una factura como pagada no registra nada más; páguela como de costumbre."],
            ],
          } },
        ],
      },
      {
        id: "unabsorbed-labour",
        heading: "Horas pagadas que nunca llegaron a un trabajo",
        blocks: [
          { p: "Para cada persona con una semana garantizada definida bajo **Tu equipo**, el panel compara los últimos 30 días de esa garantía con las horas que registró contra un trabajo, y valora la diferencia a su tarifa por hora. Alguien pagado por hora sin semana garantizada no tiene diferencia que informar; alguien sin tarifa registrada muestra horas y ningún costo, y el total dice que se queda corto en lugar de contar esas horas como gratis. El personal de oficina queda fuera — todo su costo ya es gasto general." },
          { note: "El recuadro ámbar lo dice sin rodeos: esto **no** se cuenta en el costo por trabajo ni en el precio mínimo. Movería cada presupuesto que usted escriba a partir de registros de tiempo que nadie ha comprobado todavía, así que se muestra primero y se deja fuera del precio. Si lo añade usted mismo a su precio, lo está contando dos veces." },
        ],
      },
      {
        id: "where-the-number-goes",
        heading: "A dónde va el número",
        blocks: [
          { p: "**Costo por trabajo** es el gasto general que el panel Costo y margen del constructor de presupuestos carga contra cada estimación, así que el margen de un presupuesto en pantalla es neto del negocio, no solo del trabajo. El **Margen neto** del panel de KPI también lo necesita — sin capacidad dice «Define cuántos trabajos por semana puedes asumir en Configuración → Gastos generales, y el margen neto se podrá calcular.» La tarjeta **Costos fijos** de la página de KPI y el ritmo de gasto de Control de gastos leen los mismos registros." },
        ],
      },
      {
        id: "who-can-see-it",
        heading: "Quién puede verlo",
        blocks: [
          { p: "La fila **Gastos generales** necesita la capacidad de gestionar usuarios **y** el interruptor **Job costing**: cada sueldo de la empresa y el margen de la empresa están en esta página. **Manager**, administradores y el propietario la ven. Un Dispatcher puede gestionar usuarios pero tiene Job costing apagado, así que la fila se oculta y cada punto de acceso detrás de ella rechaza. Eliminar una fila de registro pregunta primero — «tu precio mínimo cambia de inmediato» — y eliminar un activo advierte de que su historial de depreciación se va con él; márquelo como vendido en su lugar para conservar lo que ya le costó." },
        ],
      },
    ],
    faq: [
      { q: "¿Por qué no hay precio mínimo en mi página?", a: "Trabajos por semana no está definido. FieldQuo antes suponía tres trabajos por semana para todos y ponía precio a cada presupuesto contra un número inventado; ahora se niega a responder hasta que usted escriba el suyo." },
      { q: "Los sueldos de mi cuadrilla no están en Salarios. ¿El precio es demasiado bajo?", a: "No. Las horas de la cuadrilla se cargan a cada trabajo como mano de obra, así que el costo propio de un trabajo ya las lleva. Salarios aquí es solo para pago de estructura — su retiro, un sueldo de oficina. Poner aquí una tarifa de cuadrilla la contaría dos veces." },
      { q: "El préstamo está pagado. ¿La camioneta desaparece de mis costos?", a: "No si está en Activos y depreciación. El pago del préstamo se detiene, el desgaste se sigue cargando hasta que el activo esté totalmente amortizado, y usted sigue ahorrando para reemplazarlo." },
      { q: "¿El precio mínimo incluye materiales y mano de obra?", a: "No. Cubre solo los gastos generales; los materiales y la mano de obra del trabajo concreto van aparte. El constructor de presupuestos los añade desde la estimación." },
    ],
  },
};
