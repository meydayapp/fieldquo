// content/help/es/settings-5.js
//
// settings-business-number — Ajustes → Número de la empresa. Same
// structure as content/help/en/settings-5.js.
export const ARTICLES = {
  "settings-business-number": {
    title: "El número de su empresa",
    summary:
      "Conserve el número que sus clientes ya conocen y tenga cada llamada y mensaje guardado en el prospecto o el trabajo dentro de FieldQuo.",
    updated: "2026-10-03",
    intro: [
      "**Ajustes → Número de la empresa** trae a FieldQuo el número que aparece en su camioneta y en sus facturas. Los mensajes que recibe llegan a su bandeja de FieldQuo, vinculados al cliente, prospecto o trabajo correcto, y las respuestas salen desde ese número. Solo los propietarios y administradores ven esta pantalla.",
    ],
    sections: [
      {
        id: "which-path",
        heading: "Por dónde entra su número",
        blocks: [
          { p: "Escriba el número y pulse **Comprobar**. FieldQuo averigua qué tipo de línea es y lo muestra como una etiqueta — por ejemplo **Celular · Bell Mobility** — y luego ofrece el único camino posible para ese tipo de línea." },
          { bullets: [
            "**Un celular o una línea por Internet (VoIP)** — el número se traspasa a FieldQuo. Las llamadas hacen sonar los teléfonos que usted elija y los mensajes llegan a la bandeja.",
            "**Una línea fija o un número gratuito** — las llamadas se quedan con su proveedor tal como están y solo los mensajes pasan a FieldQuo.",
            "**Cualquier número fuera de EE. UU. y Canadá** — todavía no disponible. La pantalla lo indica.",
          ] },
          { note: "Una línea VoIP tiene que traspasarse en lugar de conservar sus llamadas, porque Twilio — el operador que usa FieldQuo — no aloja mensajes en líneas VoIP." },
        ],
      },
      {
        id: "move",
        heading: "Traspasar un número de celular",
        blocks: [
          { steps: [
            "Escriba el titular de la cuenta y la dirección de servicio tal como aparecen en la factura de su operador, su número de cuenta y su PIN de portabilidad.",
            "Suba una factura reciente (PDF o foto, menos de 4 MB).",
            "Marque las tres advertencias y firme la autorización escribiendo su nombre.",
            "Pulse **Traspasar mi número**. La pantalla sigue la solicitud: autorización firmada, factura subida, número de cuenta y PIN, y los días de espera con su operador.",
          ] },
          { warning: "Su operador enviará un mensaje al teléfono para aprobar el traspaso. Responda en 90 minutos o se cancela. Tarda de 5 a 7 días hábiles, hasta 4 semanas, y después el número deja de funcionar en su SIM — pida a su operador un número nuevo para el teléfono o cancele esa línea, y revise antes las penalizaciones de su contrato." },
          { tip: "Su PIN y su número de cuenta se guardan cifrados solo mientras el traspaso los necesita y se borran al terminar. Para un número de EE. UU. van directamente a Twilio y nunca se guardan." },
        ],
      },
      {
        id: "texts-only",
        heading: "Pasar los mensajes de una línea fija o gratuita",
        blocks: [
          { steps: [
            "Escriba el nombre del propietario, un correo para la autorización, un teléfono donde localizarle y la dirección del propietario, y pulse **Empezar a pasar los mensajes**.",
            "Cuando la pantalla lo indique, pulse **Llamar al número ahora** y quédese junto a ese teléfono. Twilio llama y pide el código que aparece en pantalla.",
            "Firme la autorización que Twilio le envía por correo.",
            "El operador cambia los mensajes, normalmente en 1 a 3 días hábiles. Sus llamadas nunca se ven afectadas.",
          ] },
          { note: "Si el número ya puede enviar mensajes a través de otra empresa — una app de mensajes o un servicio de mensajes para empresas de su proveedor — Twilio lo rechaza. La pantalla le indica que pida a esa empresa que quite los mensajes del número y que vuelva a empezar." },
        ],
      },
      {
        id: "once-moved",
        heading: "Una vez traspasado",
        blocks: [
          { bullets: [
            "**Las llamadas suenan** — hasta tres teléfonos que usted elija suenan a la vez. Sin respuesta, la llamada va a su recepcionista IA si está activada, o a un buzón de voz guardado en la conversación. Se configura en **Dónde suenan las llamadas**.",
            "**Los mensajes** — llegan a la bandeja con un aviso en el teléfono, archivados en el cliente, prospecto o trabajo; el primer mensaje de un desconocido se convierte en prospecto igual que un mensaje de Facebook.",
            "**Las llamadas salientes** — pulse **Llamar** en un prospecto, cliente o trabajo. FieldQuo hace sonar su propio teléfono; pulse 1 y llama al cliente, que ve el número de su empresa. Se permiten de 9:00 a 20:00 en la hora del cliente, nunca a alguien que pidió que no le llamen, y no se graban.",
          ] },
        ],
      },
      {
        id: "cost",
        heading: "Lo que cuesta",
        blocks: [
          { p: "Todo se descuenta de su saldo telefónico (el que usa la recepcionista): 4,00 $ al mes por el número, cobrados desde el día que se activa, 2 ¢ por mensaje, 5 ¢ por foto y, en un número traspasado, 5 ¢ por minuto de las llamadas que se le desvían o que hace con el botón Llamar. Antes de empezar, la pantalla muestra una estimación mensual con sus mensajes de los últimos 30 días. FieldQuo no cobra nada por traspasar el número." },
        ],
      },
    ],
    faq: [
      { q: "¿Puedo cancelar?", a: "Sí, con Cancelar esta solicitud, mientras el número no esté activo. Una vez activo, contáctenos para llevarlo a otro sitio, para que sus clientes no se queden cortados a mitad de una conversación." },
      { q: "¿Funciona en una cuenta de demostración?", a: "Las pantallas funcionan, pero no se envía nada a ningún operador y nunca se traspasa ningún número." },
    ],
  },
};
