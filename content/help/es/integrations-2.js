// content/help/es/integrations-2.js — parte 2 de «integrations» en español.
// Misma estructura que la versión inglesa; ver content/help/en/integrations-2.js.
export const ARTICLES = {
  "google-calendar": {
    title: "Mi calendario",
    summary:
      "Conecta tu propio Google Calendar: cada visita asignada a ti aparece en él y se mueve cuando la oficina la mueve, y tus eventos personales impiden que te reserven — sin que nadie en la empresa vea de qué se trata.",
    updated: "2026-09-20",
    intro: [
      "**Ajustes → Mi calendario** es una de las filas que ve cada miembro, porque nada aquí pertenece a la empresa: es adonde van **tus** visitas, y lo que **tus** otros compromisos bloquean. La página tiene una sección por ahora, **Conectar Google Calendar**, y funciona en ambos sentidos a la vez.",
      "FieldQuo crea y actualiza solo sus propios eventos; nunca edita los tuyos. Esa frase está impresa en la pantalla y es toda la regla: los eventos que escribe FieldQuo llevan una marca privada, y FieldQuo solo toca un evento que la lleve.",
    ],
    sections: [
      {
        id: "overview",
        heading: "Qué hay en la pantalla",
        blocks: [
          { p: "Antes de conectar: un botón **Conectar Google Calendar**. Después: **Conectado como tu@gmail.com desde el 20 sept 2026**, dos interruptores — **Escribir mis visitas en Google Calendar** y **Usar mis horas ocupadas de Google** — un botón **Desconectar**, y un enlace **Reconectar** para el día en que Google te pida iniciar sesión otra vez. Si la última sincronización falló, el motivo se imprime bajo el correo en una línea." },
          { note: "En un despliegue de FieldQuo que aún no tiene configurado el acceso con Google, la sección lo dice en una frase y no muestra ningún botón. Un botón que no puede funcionar es peor que ninguno." },
        ],
      },
      {
        id: "what-goes-to-google",
        heading: "Qué escribe FieldQuo en tu calendario",
        blocks: [
          { bullets: [
            "Cada **cita, visita de obra y reserva asignada a ti** — creada al asignarla, movida cuando la oficina o el cliente la mueve, retirada cuando se cancela o se entrega a otra persona; una visita completada queda como historial.",
            "El título dice qué es y para quién: **Visita en sitio — Jane Doe**, **Devolución de llamada — Jane Doe**, **Videollamada — Jane Doe**, o el título del trabajo para una visita de cuadrilla. La ubicación es la dirección de la obra, así que la navegación de Google Maps funciona directamente desde el evento. La descripción lleva el enlace de FieldQuo.",
            "Una **videollamada** recibe un enlace de Google Meet creado con el evento, y el mismo enlace se anota en la reserva para que la confirmación del cliente pueda llevarlo.",
            "Nada más. FieldQuo nunca lee los títulos de tus eventos y nunca escribe nada que no sea suyo.",
          ] },
          { warning: "Borra un evento de FieldQuo a mano y vuelve en la siguiente sincronización, porque la visita sigue reservada. Cancélala en FieldQuo en su lugar." },
        ],
      },
      {
        id: "what-google-tells-fieldquo",
        heading: "Qué le dice tu calendario a FieldQuo",
        blocks: [
          { p: "Con **Usar mis horas ocupadas de Google** activado, las horas que tu propio calendario marca como ocupadas cuentan como ocupadas en FieldQuo — en la página pública de reservas, para la recepcionista telefónica, para el empleado IA y para un despachador que mueve una visita hacia ti. Solo las horas, nunca los títulos: FieldQuo le hace a Google una sola pregunta, *¿cuándo está ocupada esta persona?*, y la respuesta de Google no contiene palabras. La página del calendario dibuja esos bloques en gris, etiquetados **ocupado (Google)**, y nada más." },
          { p: "Desactívalo y tu calendario personal no se lee en absoluto. Desactiva **Escribir mis visitas** y cada evento creado por FieldQuo sale de tu calendario de inmediato; vuelve a activarlo y regresan." },
        ],
      },
      {
        id: "disconnect",
        heading: "Desconectar",
        blocks: [
          { steps: [
            "Pulsa **Desconectar** y confirma.",
            "Cada evento creado por FieldQuo se retira de tu calendario — cada uno comprobado primero por la marca de FieldQuo, así que nada tuyo se toca.",
            "El acceso de FieldQuo se revoca en Google y la credencial guardada se elimina. Tus visitas siguen en FieldQuo exactamente como estaban.",
          ] },
        ],
      },
    ],
    faq: [
      { q: "¿Puede mi gerente ver qué hay en mi calendario personal?", a: "No. FieldQuo recibe intervalos ocupados sin títulos, y los muestra como bloques grises que solo dicen ocupado (Google)." },
      { q: "¿En qué calendario escribe?", a: "En tu calendario principal de Google, bajo la cuenta que elegiste en la pantalla de consentimiento de Google." },
      { q: "¿Por qué Google avisa de que la aplicación no está verificada?", a: "Mientras la verificación de Google de FieldQuo esté pendiente, solo las cuentas que FieldQuo haya inscrito como usuarios de prueba pueden conectarse, y Google muestra primero una pantalla de aviso. Pide a soporte que te añada si la pantalla te rechaza." },
      { q: "¿Esto sustituye la suscripción al calendario?", a: "No. Una suscripción es de un solo sentido y de solo lectura; esta conexión escribe en tu calendario y lee tus horas ocupadas. Usa la que te convenga, o ambas." },
    ],
  },
};
