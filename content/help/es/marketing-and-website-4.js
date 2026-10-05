// content/help/es/marketing-and-website-4.js
//
// Parte 4 de la categoría «marketing-and-website» (es): Resultados de
// marketing — app/app/marketing/results, calculados por lib/agency/metrics.js
// (el mismo código que la API de la agencia de marketing). Leído el 2026-10-05.
export const ARTICLES = {
  "marketing-results": {
    title: "Resultados de marketing",
    summary:
      "Lo que produjeron tus anuncios, presentado como el tablero de una agencia de marketing — gasto, solicitudes, citas, cierres, ingresos y retorno del gasto en anuncios, cada uno frente al periodo anterior.",
    updated: "2026-10-05",
    intro: [
      "**Marketing → Resultados de marketing** responde una pregunta: ¿qué trajo el dinero gastado en anuncios? Sigue cada solicitud que llegó en un periodo hasta la cita, la cotización, el cierre y el pago, y pone el gasto en anuncios enfrente.",
      "Muestra exactamente las cifras que tu agencia de marketing ve con [[settings-agency-access|el acceso de la agencia de marketing]], calculadas con el mismo código — así, cuando la agencia reporte un costo por cierre, puedes abrir esta página y comprobarlo.",
    ],
    sections: [
      {
        id: "how-it-counts",
        heading: "Cómo cuenta",
        blocks: [
          { p: "El periodo elige **solicitudes** — las que llegaron por primera vez en él — y cada cifra posterior es en lo que se convirtieron esas solicitudes, cuando sea que pasó. Una solicitud de marzo que cierra en mayo cuenta como cierre de marzo. Eso mantiene las cifras coherentes: una etapa nunca puede ser mayor que la anterior, y una cita se cuenta una vez por solicitud." },
          { p: "Cada cifra se compara con el **periodo anterior de la misma duración**: este mes hasta hoy (digamos 5 días) contra los 5 días anteriores; el mes pasado contra los 30 o 31 días anteriores." },
          { p: "Cada cifra tiene un botón **i** con su definición exacta. Una cifra sin datos para calcularla muestra **—** y dice por qué, nunca un 0 que no lo es." },
        ],
      },
      {
        id: "the-figures",
        heading: "Las cifras",
        blocks: [
          { table: {
            head: ["Cifra", "Qué es"],
            rows: [
              ["Gasto en anuncios", "Lo que gastaron en el periodo tus cuentas de anuncios de Meta y Google conectadas. Muestra **—** cuando ninguna está conectada."],
              ["Solicitudes · Costo por solicitud", "Cada solicitud que llegó, las frías incluidas · gasto ÷ solicitudes."],
              ["Citas · Tasa de citas · Costo por cita", "Solicitudes que reservaron una visita en persona, una vez cada una · ÷ solicitudes · gasto ÷ citas."],
              ["Cierres · Tasa de cierre · Costo por cierre", "Solicitudes cuya cotización fue aceptada · cierres después de una visita ÷ citas · gasto ÷ cierres."],
              ["Ingresos · Cobrado", "El valor aceptado de los cierres · lo que se ha pagado de verdad hasta ahora."],
              ["Retorno del gasto en anuncios · Valor promedio del trabajo", "Ingresos ÷ gasto · ingresos ÷ cierres."],
              ["Citas próximas · Tasa de cierre ajustada", "Visitas cuya fecha no llega · cierres después de una visita ÷ visitas que ya ocurrieron (sin las próximas ni las canceladas)."],
              ["Tiempos de conversión", "Mediana de días de la solicitud a la cita, de la cita a la cotización, de la cotización al cierre y de la solicitud al cierre."],
            ],
          } },
          { note: "Un trabajo ganado sin visita en persona igual cuenta como cierre, y se muestra aparte como **Cerrados sin visita**." },
        ],
      },
      {
        id: "the-funnel",
        heading: "Del primer mensaje al trabajo cerrado",
        blocks: [
          { p: "El embudo empieza con los **mensajes de anuncios** — cada conversación de Facebook, Instagram y WhatsApp que empezó en un anuncio, incluidos los simples toques — luego las **conversaciones reales** entre ellas, luego las solicitudes, las calificadas (tibias o calientes, o probadas por una visita reservada), las citas, las cotizaciones enviadas después de la visita y los cierres. La **velocidad de respuesta** es la mediana del tiempo entre el primer mensaje de una persona y tu primera respuesta." },
          { p: "Debajo, **Por origen** reparte las solicitudes según de dónde vinieron, y **Por campaña** pone el gasto de cada campaña frente a las solicitudes y cierres que la nombran." },
          { p: "Usa **Origen** y **Campaña** arriba para ver un solo canal o una sola campaña. Un origen sin gasto en anuncios detrás (tu sitio web, una recomendación) no muestra costos en vez de tomar prestado el dinero de los anuncios." },
        ],
      },
    ],
    faq: [
      { q: "¿Por qué difiere de las cifras de Meta?", a: "Meta cuenta sus propios eventos — tocar un botón de chat es una «conversación» para Meta. Esta página cuenta personas: cuántas escribieron palabras reales, se volvieron solicitudes, reservaron y pagaron. Ve [[marketing-spend|Gasto en marketing]] para ver las cifras de Meta lado a lado." },
      { q: "¿Quién puede abrirla?", a: "Propietarios, administradores y gerentes — las mismas personas que ven el Gasto en marketing." },
    ],
  },
};
