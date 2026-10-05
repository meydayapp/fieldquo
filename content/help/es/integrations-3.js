// content/help/es/integrations-3.js
//
// Parte 3 de la categoría «integrations» (es): el acceso de la agencia de
// marketing (lib/agency/). Leído de la pantalla de configuración, la API que
// abre y la frontera de privacidad (lib/agency/leadRow.js), el 2026-10-05.
export const ARTICLES = {
  "settings-agency-access": {
    title: "Darle acceso a tu agencia de marketing",
    summary:
      "Crea una clave para la agencia que maneja tus anuncios, para que vea qué solicitudes se convirtieron en citas, cierres e ingresos — con los datos de contacto de los clientes privados salvo que decidas compartirlos.",
    updated: "2026-10-05",
    intro: [
      "Una agencia que maneja tus anuncios de Facebook, Instagram o Google solo puede optimizar lo que ve. Sin ti, ve clics y formularios llenados; nunca sabe cuáles de esas personas reservaron una visita, firmaron una cotización y pagaron. **Configuración → Acceso de la agencia de marketing** le da esa mitad: cada solicitud que trajo, hasta dónde llegó y cuánto valía el trabajo.",
      "La agencia se conecta con una **clave** que creas ahí. Lee tus resultados con la API de FieldQuo — directamente o por Zapier — y la clave es lo único que dice qué empresa está leyendo. Puedes crear una clave por agencia, ver cada llamada de cada clave y revocar una en cualquier momento.",
    ],
    sections: [
      {
        id: "create-a-key",
        heading: "Crear una clave",
        blocks: [
          { steps: [
            "Abre **Configuración → Acceso de la agencia de marketing** (propietarios y administradores).",
            "En **Crear una clave**, escribe el nombre de la agencia — así reconocerás la clave después.",
            "Deja **Permitir también que esta agencia agregue y actualice solicitudes** sin marcar, salvo que la agencia tenga sus propias páginas o formularios y deba enviarte esas solicitudes (ver abajo).",
            "Pulsa **Crear clave**. La clave aparece una sola vez: cópiala y envíala a la agencia. FieldQuo solo guarda una huella; no se puede volver a mostrar — si se pierde, revócala y crea otra.",
          ] },
          { p: "La agencia pone la clave en sus propias herramientas. La referencia de la API que necesita está enlazada desde la pantalla: **Lo que la agencia puede ver (referencia de la API)**, en fieldquo.com/developers/marketing-api." },
        ],
      },
      {
        id: "what-the-agency-sees",
        heading: "Lo que ve la agencia",
        blocks: [
          { p: "Cada solicitud le llega a la agencia como una fila. Por defecto, la fila está hecha para no identificar a nadie:" },
          { bullets: [
            "una **referencia privada** como **L-7F3A** — aleatoria, la misma durante toda la vida de la solicitud, y nunca sacada de un teléfono o un correo;",
            "solo el **nombre de pila**;",
            "cuándo se puso en contacto por primera vez y el **canal**: anuncio de Facebook, anuncio de Instagram, Google Ads, el embudo de la agencia, tu sitio web, una recomendación u orgánico;",
            "el **anuncio** que la trajo cuando se conoce — campaña, conjunto de anuncios y anuncio, el identificador de clic (fbclid o gclid) y las etiquetas UTM;",
            "qué tan calificada está (el nivel de la conversación y la temperatura caliente / tibia / fría), y la hora de cada etapa: calificada, primera respuesta, cita reservada, fecha y resultado de la cita, cotización enviada, vista, aceptada o rechazada, facturada, pagada, trabajo terminado;",
            "el servicio pedido y el servicio vendido;",
            "**parte del código postal** — el ZIP de 5 dígitos en EE. UU., los tres primeros caracteres en Canadá. Nunca la dirección;",
            "el **motivo de pérdida**, si tu equipo registró uno.",
          ] },
          { p: "Dos opciones en la misma pantalla cambian eso:" },
          { table: {
            head: ["Opción", "Por defecto", "Lo que agrega"],
            rows: [
              ["**Compartir los datos de contacto con mi agencia de marketing**", "Desactivada", "Nombre completo, teléfono, correo y el código postal completo. La dirección nunca se comparte."],
              ["**Compartir el valor de los trabajos**", "Activada", "Montos de las cotizaciones, montos ganados y lo pagado — lo que la agencia necesita para los ingresos y el retorno del gasto en anuncios. Desactivada, solo ve cantidades."],
            ],
          } },
          { note: "Cada cambio de estas opciones queda en tu registro de actividad con quién lo hizo. Desactivar los datos de contacto se aplica a lo próximo que la agencia lea — incluidos los eventos que esperaban ser enviados." },
        ],
      },
      {
        id: "zapier-and-events",
        heading: "Zapier y eventos en vivo",
        blocks: [
          { p: "Además de leer, una agencia puede suscribirse a **eventos**, para que su tablero se actualice en cuanto algo pasa: llega una solicitud, se califica o cambia de etapa; se reserva una visita (una estimación en sitio) o se marca como realizada, no se presentó, reprogramada o cancelada; se envía, ve, acepta o rechaza una cotización; se termina un trabajo; se paga una factura; se recibe un pago. Cada evento lleva la misma fila privada." },
          { p: "Tu agencia puede usar la app de Zapier de FieldQuo, o llamar a la API desde cualquier herramienta que haga solicitudes web. Los eventos salen cuando ya terminó la acción que los causó, así que nada de lo que hace tu equipo espera a la agencia." },
          { note: "Cuando pasa la hora de una visita, el calendario pregunta qué ocurrió — **Realizada**, **No se presentó**, **Reprogramada** o **Cancelada** — y la persona asignada recibe en el plazo de un día un recordatorio «¿Se realizó esta visita?». Una visita pasada que nadie marcó se reporta como **sin marcar**, nunca como realizada ni como ausencia." },
        ],
      },
      {
        id: "adding-leads",
        heading: "Permitir que la agencia agregue y actualice solicitudes",
        blocks: [
          { p: "Marcar **Permitir también que esta agencia agregue y actualice solicitudes** al crear una clave le permite cuatro cosas más, y ninguna otra:" },
          { bullets: [
            "**Agregar una solicitud** desde el embudo de la agencia. Llega a tu tablero de solicitudes como cualquier otra, marcada como del embudo de tu agencia de marketing, calificada igual. Si el mismo correo o teléfono ya te escribió en los últimos seis meses, no se crea una segunda solicitud.",
            "**Avanzar una solicitud en tu embudo de ventas** — con las mismas reglas que tu tablero: Ganada solo con una cotización aceptada o trabajo detrás, Perdida solo con un motivo.",
            "**Fijar el horario solicitado para una visita**, mostrado en la solicitud. Nunca cambia una visita ya reservada, su hora ni quién va.",
            "**Buscar una solicitud por correo o teléfono**, con la misma fila privada como respuesta.",
          ] },
          { warning: "Ninguna clave puede enviar textos, correos ni mensajes a tus clientes. Es a propósito: un tercero no debe poder hablar con tus clientes en tu nombre." },
          { p: "Todo lo que una clave agrega o cambia aparece en tu registro de actividad con el nombre de la agencia." },
        ],
      },
      {
        id: "revoke",
        heading: "Ver lo que hace una clave, y revocarla",
        blocks: [
          { p: "Cada clave muestra quién la creó y cuándo, cuándo se usó por última vez, cuántas llamadas hizo en los últimos 7 días y a qué eventos está suscrita. **Llamadas recientes** lista cada solicitud con su hora y resultado." },
          { p: "**Revocar** detiene la clave de inmediato: cada solicitud se rechaza y sus Zaps dejan de recibir eventos. Una clave revocada queda en **Claves revocadas** como registro de quién tuvo acceso y cuándo." },
        ],
      },
    ],
    faq: [
      { q: "¿La agencia puede ver los datos de otra empresa?", a: "No. La clave pertenece a tu empresa y es lo único que decide qué datos lee una solicitud." },
      { q: "¿El soporte de FieldQuo puede crearme una clave?", a: "No. Una sesión de soporte puede ver esta pantalla pero no puede crear ni revocar claves, ni cambiar lo que se comparte." },
      { q: "¿Puedo comprobar las cifras de la agencia?", a: "Sí — Marketing → Resultados de marketing muestra las mismas cifras, calculadas con el mismo código. Ve [[marketing-results|Resultados de marketing]]." },
    ],
  },
};
