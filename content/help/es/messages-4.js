// content/help/es/messages-4.js
//
// Parte 4 de la categoría «messages» en español (vea messages.js). Mismos
// slugs y misma estructura que content/help/en/messages-4.js; las etiquetas
// vienen del bloque `es` de app/i18n/appMessages.js.
export const ARTICLES = {
  "ai-employee-reference-library": {
    title: "La biblioteca de referencia del empleado de IA: los manuales que lee",
    summary:
      "Suba los manuales del equipo que instala —PDF leídos página por página y guardados en privado— y su empleado de IA responde con ellos y cita la página.",
    updated: "2026-10-04",
    intro: [
      "**Configuración → Empleado de IA → Biblioteca de referencia** es todo lo que sus empleados de IA pueden usar para responder: su política, sus notas de solución de problemas y los manuales de los fabricantes de lo que usted instala. Cada empleado lee la misma biblioteca, y una respuesta nombra el documento —y, en un PDF, la página— de donde sale.",
    ],
    sections: [
      {
        id: "what-it-reads",
        heading: "Qué puede subir",
        blocks: [
          { bullets: [
            "**Un manual en PDF**: se guarda en privado y se lee página por página. Nunca se muestra a sus clientes; el asistente lo parafrasea y cita la página.",
            "**Una lista de códigos .xlsx o .csv**: se lee como texto.",
            "**Texto plano** (.txt, .md), o texto pegado con **Pegar texto en su lugar**.",
            "Los archivos de Word aún no se pueden leer: pegue el texto o expórtelo como .txt. Un PDF protegido con contraseña se rechaza indicando el motivo: guarde una copia sin contraseña y suba esa.",
          ] },
          { p: "Se leen hasta 400 páginas de un mismo PDF. Pasado ese límite, la fila dice **Las páginas después de la 400 no se leyeron: divida el PDF para agregar el resto.**" },
        ],
      },
      {
        id: "pages",
        heading: "Páginas leídas, páginas escaneadas",
        blocks: [
          { p: "Cada fila de PDF dice cuánto se leyó de verdad: **41 de 42 páginas leídas**. Una página que solo es una imagen escaneada no tiene texto que leer, y la fila la nombra: **No se pudieron leer las páginas 12–14 (escaneadas)**. Un PDF escaneado por completo se marca como no leído, nunca como listo." },
          { p: "**Leer páginas escaneadas con IA — unos 28 créditos** lee esas páginas a partir de sus imágenes, con el modelo de IA estándar de FieldQuo, pagado con su crédito de IA. El precio está en el botón antes de pulsarlo (unos 2 créditos por una página, 28 por sesenta). Las páginas se generan en su navegador a partir de su propia copia: si recarga la pantalla, le pide **Elegir de nuevo el mismo PDF** y comprueba que sea el mismo archivo antes de enviar nada." },
          { note: "Leer PDF con texto es gratis: se hace en el código, sin IA. Solo la lectura de páginas escaneadas y la extracción de códigos de error de abajo usan crédito de IA, y solo cuando usted pulsa su botón." },
        ],
      },
      {
        id: "tags",
        heading: "Las etiquetas: primero el manual correcto",
        blocks: [
          { p: "Las **Etiquetas** de una fila llevan una **Marca**, un **Modelo (o cómo empieza)**, el **Equipo, p. ej. calefactor** y un **Oficio**. Cuando llega la conversación de un cliente con equipo registrado, se lee primero el manual etiquetado para esa marca y ese modelo; luego sus demás documentos, primero los que nombra el mensaje. La cantidad de material que se envía con una respuesta no crece: las etiquetas deciden el orden, no el volumen." },
        ],
      },
      {
        id: "codes",
        heading: "Códigos de error de sus manuales",
        blocks: [
          { p: "**Extraer códigos de error — unos 3 créditos** lee las páginas de un manual que parecen una tabla de códigos de error y lista cada código con su página, bajo la etiqueta **Marca** del manual (agréguela primero). Los códigos llegan **sin revisar**: hasta que pulse **Está bien**, el asistente solo usa uno nombrando el manual y la página. **Editar** corrige un significado, **No usar** deja de usarlo (se conserva, marcado **no se usa**) y **Usar de nuevo** lo recupera. Vea [[ai-employee-error-codes|Los códigos de error]]." },
        ],
      },
    ],
  },

  "ai-employee-error-codes": {
    title: "Códigos de error: lo que dice el empleado de IA cuando una pantalla muestra uno",
    summary:
      "Cuando un cliente dice que su lavadora muestra UE o que su calefactor parpadea 13, el asistente busca el código —primero en sus manuales, luego en las referencias de FieldQuo— y nunca adivina.",
    updated: "2026-10-04",
    intro: [
      "Los clientes suelen escribir con un código: «mi lavadora Samsung marca UE». Sus empleados de **Soporte técnico** y **Recepcionista** pueden **buscar un código de error**: qué significa, algunas cosas seguras que puede probar el propietario, cuándo parar, qué tan urgente es y de dónde sale.",
    ],
    sections: [
      {
        id: "where-from",
        heading: "De dónde sale una respuesta",
        blocks: [
          { steps: [
            "Los códigos extraídos de **sus propios manuales** en la [[ai-employee-reference-library|biblioteca de referencia]]: primero los que marcó con **Está bien**, luego los que están **sin revisar** (citados con el manual y la página).",
            "**Las referencias de FieldQuo**: una tabla de códigos comunes de lavadoras Samsung, LG y Whirlpool, lavavajillas Bosch, termostatos Google Nest, calefactores Carrier y Goodman/Amana/Daikin, calentadores Rheem y Bradford White y calentadores instantáneos Rinnai, cada uno con su fuente. Está redactada con las palabras de FieldQuo a partir de los manuales y las páginas de soporte de los fabricantes.",
          ] },
          { p: "Vuelven tres respuestas como máximo. Si ninguna fuente tiene el código, el asistente dice que no está en sus referencias y agenda una devolución de llamada: nunca dice lo que cree que significa un código." },
        ],
      },
      {
        id: "brand",
        heading: "Conoce la marca cuando usted la conoce",
        blocks: [
          { p: "Las mismas letras significan cosas distintas según la marca: OE es un desbordamiento en una lavadora Samsung y un problema de desagüe en una LG. Cuando la conversación pertenece a un cliente con equipo registrado (vea [[client-equipment-and-warranties|Equipo de clientes y garantías]]), el asistente usa esa marca y ese modelo sin volver a preguntar; si no, pregunta la marca, y el número de modelo de la etiqueta si el cliente lo ve. Si dos equipos registrados podrían ser, pregunta cuál, por su nombre." },
        ],
      },
      {
        id: "urgent",
        heading: "Códigos urgentes",
        blocks: [
          { p: "Un código marcado como urgente —un sensor de fugas, un desbordamiento, un bloqueo por sobretemperatura de un calentador— no se resuelve paso a paso: el asistente agenda una devolución de llamada urgente y entrega la conversación a una persona. Todo lo que suene a emergencia recibe primero el aviso de emergencia, exactamente como antes." },
          { warning: "Los pasos de la tabla de FieldQuo nunca pasan detrás de un panel, nunca usan un medidor y nunca tocan el gas ni el cableado. Eso le toca a un técnico, y el asistente se lo entrega." },
        ],
      },
    ],
  },

  "how-ai-employee-troubleshooting-works": {
    title: "Cómo funciona la solución de problemas con IA: de un código a una devolución de llamada",
    summary:
      "El asistente ayuda con algo menor, ofrece una llamada con un técnico si sigue pasando y, cuando el cliente vuelve a escribir, agenda la devolución de llamada sin volver a preguntarle nada.",
    updated: "2026-10-04",
    intro: [
      "Esto es lo que hace su empleado de **Soporte técnico** con «mi lavadora se paró a mitad del ciclo», paso a paso, y lo que le llega a su equipo al final.",
    ],
    sections: [
      {
        id: "steps",
        heading: "La conversación",
        blocks: [
          { steps: [
            "Lee el equipo registrado del cliente, si la conversación pertenece a un cliente conocido: marca, modelo, fecha de instalación y la fecha de garantía del registro. Nunca ve precios, facturas ni saldos, y nunca dice en voz alta un número de serie.",
            "Solo pregunta lo que falta; luego busca el código y da como mucho dos o tres pasos seguros de su manual o de las referencias de FieldQuo, diciendo de dónde salen.",
            "Anota lo que sugirió, y la respuesta termina con: **Si el problema continúa, escríbanos de nuevo y le buscaremos un horario con uno de nuestros técnicos.** —lo agrega FieldQuo, en el idioma del cliente, para que esté siempre. (Con **Ofrecer horarios reales con un técnico** desactivado, dice en cambio **…programaremos una llamada con uno de nuestros técnicos.**)",
            "Si el cliente vuelve a escribir que sigue pasando, le ofrece de inmediato horarios libres reales de su calendario de reservas —los mismos que muestra su página de reservas— y reserva el que elija, como llamada con un técnico o como visita. Solo si no hay nada libre (o los horarios reales están desactivados) agenda una devolución de llamada; la nota dice qué equipo es, el código y lo que ya se intentó. Si ahora suena urgente, eso va primero: vea [[ai-employee-urgent-problems-and-safety|Problemas urgentes y seguridad]].",
          ] },
        ],
      },
      {
        id: "what-the-team-sees",
        heading: "Lo que ve su equipo",
        blocks: [
          { bullets: [
            "**Un cliente conocido** recibe un ticket en su registro —de tipo **Garantía** cuando la fecha de garantía registrada no ha pasado, si no **Reparación**— vinculado al trabajo que instaló el equipo, con prioridad **Urgente** cuando el asistente lo marcó así. Vea [[client-tickets|Tickets de clientes]].",
            "**Cualquier otra persona** se convierte en un prospecto con la insignia **Llamada solicitada a través de su asistente de IA** en el [[the-leads-board|tablero de prospectos]], con **Urgente** delante cuando lo es.",
          ] },
          { p: "El asistente nunca promete una hora ni dice qué está cubierto y qué no: una fecha de garantía en el registro es algo que menciona y anota para el equipo; el equipo decide." },
        ],
      },
      {
        id: "reply-limit",
        heading: "El límite de respuestas",
        blocks: [
          { p: "**Máximo de respuestas en una conversación** sigue aplicándose. La única excepción: cuando el asistente le dijo al cliente que volviera a escribir si el problema continuaba, su siguiente mensaje recibe una respuesta aunque se haya llegado al límite —una sola vez— y esa respuesta solo puede reservar un horario con un técnico, agendar la devolución de llamada o entregar la conversación a una persona. Un límite de 0 (en pausa) nunca se supera." },
        ],
      },
    ],
  },
  "ai-employee-urgent-problems-and-safety": {
    title: "Problemas urgentes y seguridad: qué hace el empleado de IA y a quién se le envía un mensaje",
    summary:
      "El gas significa salir primero, una tubería rota avisa por mensaje a su persona de guardia, un goteo es solo un goteo, y cada parte es una opción que usted controla.",
    updated: "2026-10-04",
    intro: [
      "**Configuración → Empleado de IA → Problemas urgentes y seguridad** reúne un solo conjunto de opciones para todo su equipo de IA: qué es urgente para su empresa, a quién se le envía un mensaje cuando lo es, si el asistente puede dar un primer paso seguro, y tres más. Cada opción se muestra con su valor actual, y los valores predeterminados se describen abajo.",
    ],
    sections: [
      {
        id: "three-kinds",
        heading: "Emergencia, urgente y todo lo demás",
        blocks: [
          { bullets: [
            "**Emergencia**: olor a gas o una alarma de monóxido de carbono, fuego o humo, una persona herida, agua sobre la electricidad. Con gas o CO, lo primero que dice el asistente es que saquen a todos de la casa, que no toquen interruptores ni el teléfono adentro y que llamen a la línea de emergencias de la compañía de gas o al 911 una vez afuera; y no pregunta nada más hasta que digan que salieron. En los demás casos, les dice que llamen al 911. Esto no se puede desactivar.",
            "**Urgente**: agua saliendo activamente o una tubería rota, sin calefacción con temperaturas bajo cero, un techo con goteras durante una tormenta, aguas negras que se regresan, un enchufe caliente, que zumba o echa chispas. Urgente para su empresa, no para el 911: se avisa por mensaje a su persona de guardia (abajo) y al cliente se le da el número de su empresa para llamar de inmediato.",
            "**Todo lo demás**: un grifo que gotea, un desagüe lento, un ruido sin olor. Se trata con calma, como una pregunta o una devolución de llamada normal.",
          ] },
          { p: "**Hacer una pregunta rápida antes de decidir que es urgente** (activado por defecto) hace que el asistente compruebe primero —«¿Está entrando agua ahora mismo o es un goteo?», «¿Ve la llave de paso?», «¿Hay olor a gas o es solo un ruido?»— para que un grifo que gotea no se trate como una emergencia. Un olor a gas nunca se cuestiona: salir es lo primero." },
          { p: "En **Qué cuenta como urgente** puede desactivar cualquiera de las cinco situaciones urgentes; a un pintor quizá no le interese un mensaje a las 2 a. m. por un techo. Una que desactive se trata como una devolución de llamada normal, nunca como una llamada al 911." },
        ],
      },
      {
        id: "on-call",
        heading: "A quién se le envía un mensaje",
        blocks: [
          { steps: [
            "Agregue personas a la lista de guardia y póngalas en orden. Cada una necesita un número de móvil en su perfil del equipo; la lista muestra **sin número de móvil en su perfil** junto a quien no lo tenga.",
            "Cuando una conversación es urgente, la primera persona de la lista recibe un mensaje con lo que dijo el cliente y un enlace, además de la campana y una notificación push.",
            "Si nadie pulsa **Yo me encargo** dentro de la espera que usted fije (10 minutos por defecto), se avisa a la siguiente persona, y así sucesivamente. Después de la última, usted recibe la campana.",
          ] },
          { p: "**Cuándo están de guardia** puede ser a todas horas, fuera de su horario de atención o en los días y horas que elija; una hora de fin anterior al inicio pasa de la medianoche, así que de 18:00 a 08:00 es el turno de noche." },
          { p: "Cada mensaje se paga con su crédito de teléfono y mensajes, con la misma tarifa que los mensajes del equipo: nunca menos de 2 ¢ por mensaje. La tarjeta muestra el precio y su saldo." },
          { note: "Cuando no puede salir ningún mensaje (nadie en la lista, sin crédito, fuera del horario de guardia), la tarjeta dice exactamente por qué en **Ahora mismo no se están enviando los mensajes urgentes**. Aun así, el cliente recibe su número, se registra una devolución de llamada urgente y usted recibe la campana." },
        ],
      },
      {
        id: "safe-steps",
        heading: "Primeros pasos seguros",
        blocks: [
          { p: "Con **Dar primeros pasos seguros** activado (por defecto), el asistente puede decir que hagan una o dos cosas seguras para un propietario —cerrar la llave principal de agua, bajar un interruptor una vez (nunca una y otra vez), apagar el termostato— o un paso de sus propios manuales. **Ver los pasos que puede dar** los muestra con su fuente. Nunca dice que abran un panel o una tapa, toquen una válvula de gas o el piloto, usen una escalera o suban al techo, ni manipulen cables con corriente; una respuesta que lo haga se retiene para una persona en lugar de enviarse." },
          { p: "Si lo desactiva, el asistente no da ningún paso: llama a su equipo. Las indicaciones de salir de la casa y de llamar al 911 siguen aplicándose." },
        ],
      },
      {
        id: "more",
        heading: "Chat del sitio, manuales de FieldQuo, horarios reales",
        blocks: [
          { bullets: [
            "**Reconocer a los clientes en el chat de su sitio web**: cuando un visitante escribe un correo o un teléfono que usted tiene registrado, el chat se vincula a ese cliente para usar su equipo e historial. La conversación muestra **Vinculado a … por su asistente de IA** con **No es este cliente** para deshacerlo; un par deshecho nunca se vuelve a vincular. Un número familiar compartido con otro nombre nunca se vincula.",
            "**Usar la biblioteca de manuales de FieldQuo**: manuales de fabricantes que FieldQuo guarda para todas las empresas, leídos después de sus propios archivos. Puede compartir con ella uno de sus manuales de fabricante desde la [[ai-employee-reference-library|biblioteca de referencia]]; FieldQuo lo revisa primero, y nada más de lo que suba se comparte nunca.",
            "**Ofrecer horarios reales con un técnico**: el técnico de diagnóstico ofrece horarios libres de su calendario de reservas cuando un problema no se resuelve, y reserva el que elija el cliente. Desactivado: registra una devolución de llamada.",
          ] },
        ],
      },
    ],
  },
};
