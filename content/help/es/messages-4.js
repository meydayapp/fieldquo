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
            "Anota lo que sugirió, y la respuesta termina con: **Si el problema continúa, escríbanos de nuevo y programaremos una llamada con uno de nuestros técnicos.** —lo agrega FieldQuo, en el idioma del cliente, para que esté siempre.",
            "Si el cliente vuelve a escribir que sigue pasando, agenda la devolución de llamada de inmediato: la nota dice qué equipo es, el código y lo que ya se intentó. Si ahora suena urgente, eso va primero.",
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
          { p: "**Máximo de respuestas en una conversación** sigue aplicándose. La única excepción: cuando el asistente le dijo al cliente que volviera a escribir si el problema continuaba, su siguiente mensaje recibe una respuesta aunque se haya llegado al límite —una sola vez— y esa respuesta solo puede agendar la devolución de llamada o entregar la conversación a una persona. Un límite de 0 (en pausa) nunca se supera." },
        ],
      },
    ],
  },
};
