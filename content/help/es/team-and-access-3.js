// content/help/es/team-and-access-3.js
//
// Parte 3 de «team-and-access»: el expediente de RR. HH. — documentos de
// empleados, incorporación, políticas, la bitácora del supervisor y la vista
// de cumplimiento. Misma estructura, artículo por artículo, que en/.
export const ARTICLES = {
  "employee-documents": {
    title: "Documentos de empleados y recordatorios de vencimiento",
    summary:
      "Guarde los certificados, licencias, identificaciones, contratos y formularios fiscales de cada persona en su expediente, marque lo que ya revisó y reciba un aviso antes de que venza un certificado.",
    updated: "2026-09-13",
    intro: [
      "Cada persona en **Administrar equipo** tiene un **Expediente de RR. HH.**: los papeles que la empresa guarda sobre ella. Un supervisor archiva ahí un contrato o una licencia escaneada; la persona sube su propia tarjeta WHMIS o su licencia de conducir desde **Mis documentos** en su teléfono. Nada se borra nunca: un certificado viejo se **archiva**, y «con qué licencia contábamos en marzo» sigue teniendo respuesta.",
    ],
    sections: [
      {
        id: "overview",
        heading: "Visión general",
        blocks: [
          { p: "Un documento tiene un **tipo** (certificado, licencia, identificación, contrato, formulario fiscal, acuse de política, otro), un título, el archivo en sí y, opcionalmente, fecha de emisión, fecha de vencimiento y el número impreso. Los supervisores pueden agregar una nota privada —dónde está el original, quién lo revisó— que la persona nunca ve." },
          { p: "Un documento que la persona subió por su cuenta muestra **Sin verificar** hasta que un supervisor pulsa **Marcar verificado**. La diferencia importa en la pantalla de cumplimiento: «dice que tiene certificado de montacargas» y «lo hemos revisado» son dos hechos distintos." },
        ],
      },
      {
        id: "how-to-file",
        heading: "Cómo archivar un documento",
        blocks: [
          { steps: ["Abra **Administrar equipo** y pulse **Expediente de RR. HH.** bajo el nombre de la persona.", "En **Documentos**, pulse **Subir**, elija el archivo y su tipo, y agregue la fecha de vencimiento si el papel la tiene.", "Pulse **Archivar documento**. Para marcar como revisado un archivo que la persona subió, pulse **Marcar verificado** en la fila."] },
          { tip: "La persona puede hacer la primera subida ella misma: **Mis documentos** en su teléfono acepta un certificado, una licencia, una identificación u otro documento propio. Los contratos y formularios fiscales vienen del lado de la empresa." },
        ],
      },
      {
        id: "expiry",
        heading: "Recordatorios de vencimiento",
        blocks: [
          { p: "Un certificado o licencia con fecha de vencimiento se revisa cada mañana. La persona recibe aviso **30 días** y **7 días** antes; sus supervisores, a los 7 días. Cada recordatorio sale una sola vez: un documento que pasa una semana a doce días produce un mensaje, no siete." },
          { bullets: ["Un documento **sin fecha de vencimiento** se muestra como «sin vencimiento registrado», nunca como vencido. Un campo vacío es un hueco en los papeles, no un certificado caducado.", "Cambiar la fecha de vencimiento de una fila reinicia la cuenta regresiva.", "Archivar un documento detiene sus recordatorios."] },
        ],
      },
      {
        id: "who-can-see-it",
        heading: "Quién puede verlo",
        blocks: [
          { p: "Propietarios, administradores y supervisores (quien pueda abrir **Administrar equipo**) ven el expediente de cada persona. Cada persona ve sus propios documentos en **Mis documentos** —incluido lo que la empresa archivó sobre ella— pero no las notas privadas del supervisor, y nunca el expediente de otra persona." },
        ],
      },
    ],
    faq: [
      { q: "¿Puedo borrar un documento archivado por error?", a: "No. Pulse **Archivar**: sale de la lista y se detienen sus recordatorios, y el registro de lo que había en el expediente se conserva." },
      { q: "¿Dónde llegan los recordatorios?", a: "En la campana de notificaciones y como notificación push en cualquier teléfono donde la persona las haya activado." },
    ],
  },

  "new-hire-onboarding": {
    title: "Listas de incorporación de nuevos empleados",
    summary:
      "Una lista que el nuevo empleado completa en su teléfono —tareas, documentos por subir, políticas por firmar, el formulario fiscal— iniciada desde la invitación y seguida en Administrar equipo.",
    updated: "2026-09-13",
    intro: [
      "Marque **Iniciar lista de incorporación** al invitar a alguien y, en cuanto acepte, recibirá en su teléfono la lista de incorporación de la empresa: confirmar sus datos de contacto, subir una identificación, llenar el formulario fiscal, hacer el recorrido de seguridad. El listado muestra **Incorporación 3/7** junto a su nombre hasta que termine.",
    ],
    sections: [
      {
        id: "overview",
        heading: "Visión general",
        blocks: [
          { p: "Una lista es una serie de elementos de cuatro tipos. Una **tarea** se marca a mano, por la persona o por un supervisor en su nombre, con el nombre registrado. Un **documento por subir**, una **política por firmar** y un **formulario por llenar** se marcan solos en cuanto la evidencia existe en el expediente. Nadie puede marcar «suba su identificación» sin una identificación." },
          { p: "La primera vez que abre **Administrar equipo → Incorporación** se crea la lista predeterminada de su empresa. Sus elementos de formulario fiscal siguen su país: el TD1 federal y provincial en Canadá, el W-4 en Estados Unidos." },
        ],
      },
      {
        id: "how-to",
        heading: "Cómo iniciar y seguir una lista",
        blocks: [
          { steps: ["Invite a la persona desde **Administrar equipo → Nuevo usuario** con **Iniciar lista de incorporación** marcado (viene activado).", "O abra su **Expediente de RR. HH.** y pulse **Iniciar lista** para alguien que ya está en el equipo.", "Siga el avance en la etiqueta del listado, en la pantalla de cumplimiento o en su expediente, donde cada elemento dice quién lo hizo y cuándo."] },
          { note: "Quien va a mitad de camino conserva la lista con la que empezó. Editar la lista en **Administrar equipo → Incorporación** describe al siguiente empleado." },
        ],
      },
      {
        id: "tax-forms",
        heading: "El formulario fiscal",
        blocks: [
          { p: "La persona responde las preguntas del TD1 o del W-4 en su teléfono y firma con su nombre. FieldQuo guarda las respuestas en su expediente y las imprime en PDF para el administrador de nómina. **Nada se envía a ningún gobierno y no se calcula ninguna retención**: la pantalla lo dice. El número de seguro social nunca se escribe en FieldQuo; la hoja impresa deja esa casilla para llenarla a mano." },
        ],
      },
      {
        id: "notifications",
        heading: "A quién se avisa",
        blocks: [
          { bullets: ["A la persona, cuando empieza la lista, y una vez por semana mientras haya un elemento atrasado.", "A los supervisores, cuando todos los elementos obligatorios están hechos: la lista se marca completa sola.", "Los elementos opcionales nunca mantienen una lista abierta."] },
        ],
      },
    ],
    faq: [
      { q: "¿Puedo tener más de una lista?", a: "Sí, una por tipo de contratación, en **Administrar equipo → Incorporación**. Una es la predeterminada que usa la invitación." },
      { q: "¿Y si la licencia de una persona se archiva después?", a: "El elemento «suba su licencia» se reabre, porque el expediente ya no contiene lo que la lista decía que contenía." },
    ],
  },

  "company-policies": {
    title: "Políticas de la empresa y acuses de recibo",
    summary:
      "Publique las reglas que su gente lee y firma —seguridad, vehículos, horarios, teléfonos—, vea quién firmó, recuerde al resto y nunca pierda el texto que alguien firmó.",
    updated: "2026-09-13",
    intro: [
      "**Configuración → Políticas** contiene las reglas que su equipo lee y firma en el teléfono. Se ofrecen cuatro plantillas —Seguridad y EPP, Uso de vehículos, Horario y asistencia, Teléfono y redes sociales en la obra— en inglés, francés y español; usted edita el texto antes de publicar.",
    ],
    sections: [
      {
        id: "overview",
        heading: "Visión general",
        blocks: [
          { p: "Una política tiene título, un texto corto, un número de versión y un alcance de publicación: **Todos** o **Solo estos puestos** (los puestos que asignó en Administrar equipo). Una política que debe firmarse muestra **3/8 firmada(s)** en la lista; ábrala para ver quién firmó y quién no." },
          { warning: "Una versión firmada nunca se reescribe. Cuando cambia el texto después de que alguien firmó, FieldQuo publica la versión 2, pide la firma a todos de nuevo y conserva cada firma anterior en la versión para la que se dio. Una errata corregida antes de cualquier firma se corrige en el mismo lugar." },
        ],
      },
      {
        id: "how-to-publish",
        heading: "Cómo publicar una política",
        blocks: [
          { steps: ["Abra **Configuración → Políticas** y pulse **Nueva política** o **Partir de una plantilla**.", "Edite el título y el texto: ## hace un título, - hace una viñeta.", "Elija si las personas deben firmarla y a quién aplica, y pulse **Publicar**."] },
        ],
      },
      {
        id: "signing",
        heading: "Cómo firma una persona",
        blocks: [
          { p: "En **Políticas** de su propia app, la persona lee el texto, escribe su nombre completo y pulsa **Acusar recibo**. FieldQuo registra el nombre, la hora, la dirección y el navegador de origen, y una huella del texto exacto en pantalla: la misma auditoría que lleva la firma de un cliente en una cotización. Una pestaña abierta durante una republicación no puede firmar el texto viejo." },
          { bullets: ["**Recordar** envía una notificación a todas las personas incluidas que no han firmado la versión vigente.", "Una persona sin acceso no puede recibirlo en la app; la lista lo indica junto a su nombre."] },
        ],
      },
      {
        id: "who-can-see-it",
        heading: "Quién puede verlo",
        blocks: [
          { p: "Propietarios, administradores y supervisores publican y ven la lista de firmas. Cada persona ve solo las políticas que le aplican y sus propias firmas." },
        ],
      },
    ],
    faq: [
      { q: "¿Puedo despublicar una política?", a: "Archívela. Sale de la lista de todos; las firmas ya dadas quedan registradas." },
      { q: "¿Un nuevo empleado debe firmar todas las políticas?", a: "Solo si la lista de incorporación lo pide: agregue un elemento **Política por firmar** a la lista." },
    ],
  },

  "the-manager-log-book": {
    title: "La bitácora del supervisor",
    summary:
      "Una página para el día tal como fue —el clima, quién faltó, un cliente que llamó, una máquina que falló— para toda la empresa, por día, con etiquetas para encontrarlo después.",
    updated: "2026-09-13",
    intro: [
      "**Bitácora**, bajo Personas, es el diario del supervisor. No es el diario de un trabajo —ese vive en el trabajo—, es el de la empresa: «la lluvia paró el techo a las 11», «Marc avisó que está enfermo», «el compresor está en el taller». El día más reciente primero, filtrado por día o por etiqueta.",
    ],
    sections: [
      {
        id: "overview",
        heading: "Visión general",
        blocks: [
          { p: "Una entrada es un día, unas líneas y cualquiera de seis etiquetas: **Clima**, **Incidente**, **Personal**, **Cliente**, **Equipo**, **Otro**. El editor de arriba viene con la fecha de hoy. Quien escribió una entrada puede corregirla; nadie puede borrarla." },
        ],
      },
      {
        id: "how-to",
        heading: "Cómo escribir y encontrar entradas",
        blocks: [
          { steps: ["Abra **Bitácora** en la barra lateral (propietarios, administradores y supervisores).", "Escriba lo que pasó, toque las etiquetas que correspondan y pulse **Guardar entrada**.", "Para mirar atrás, elija un día o toque una etiqueta: la lista se reduce a las entradas que coinciden."] },
        ],
      },
      {
        id: "when-to-use-which",
        heading: "¿Bitácora o diario del trabajo?",
        blocks: [
          { table: { head: ["Escríbalo en", "Cuándo"], rows: [["**Bitácora**", "Es sobre la empresa o el día: clima, personal, una llamada, una avería."], ["**El diario del trabajo**", "Es sobre ese único trabajo: qué se hizo, qué falta, qué dijo el cliente en la obra."], ["**Un incidente de seguridad**", "Alguien se lastimó o estuvo a punto: la pantalla de seguridad hace las preguntas que un reporte necesita."]] } },
        ],
      },
    ],
    faq: [
      { q: "¿Un miembro del equipo puede leer la bitácora?", a: "No. Es una pantalla de supervisores, protegida por el mismo acceso que Administrar equipo." },
    ],
  },

  "hr-and-compliance": {
    title: "Vista de RR. HH. y cumplimiento",
    summary:
      "Una tabla, una fila por persona: documentos vencidos o por vencer, incorporación incompleta, políticas sin firmar, amonestaciones sin acusar, con un enlace a cada expediente para resolverlo.",
    updated: "2026-09-13",
    intro: [
      "**Administrar equipo → Cumplimiento** responde «a quién le falta qué» en todo el equipo en una pantalla. Las personas con algo pendiente van arriba; cada cifra enlaza al expediente de la persona, donde se resuelve.",
    ],
    sections: [
      {
        id: "overview",
        heading: "Qué significan las columnas",
        blocks: [
          { table: { head: ["Columna", "Qué cuenta"], rows: [["**Documentos**", "Certificados y licencias vencidos o por vencer en 30 días, y subidas de la persona aún sin verificar."], ["**Incorporación**", "El avance de la lista y cuántos elementos están atrasados."], ["**Políticas**", "Políticas que aplican a la persona y que no ha firmado en la versión vigente."], ["**Amonestaciones**", "Advertencias y amonestaciones a la espera del acuse de recibo de la persona."]] } },
          { p: "En un teléfono, las mismas filas son tarjetas. **Solo personas con algo pendiente** oculta las filas que están en orden." },
        ],
      },
      {
        id: "performance-file",
        heading: "El expediente de desempeño",
        blocks: [
          { p: "El expediente de cada persona lleva una línea de tiempo de **notas**, **reconocimientos**, **advertencias** y **amonestaciones** escritas por supervisores, junto a los retrasos y faltas que el reloj registró contra el horario. Una nota puede ser privada para supervisores o visible para la persona; una advertencia o amonestación puede exigir su acuse de recibo, que da escribiendo su nombre en su propia pantalla. Las notas nunca se editan ni se borran: un error se corrige con una nueva nota que lo diga." },
        ],
      },
      {
        id: "what-it-is-not",
        heading: "Lo que esta pantalla no hace",
        blocks: [
          { warning: "Muestra lo que su empresa registró. No verifica la ley laboral —reglas de descanso, umbrales de horas extra, preavisos— de su provincia o estado, y no dice si una persona puede legalmente estar en la obra." },
        ],
      },
      {
        id: "who-can-see-it",
        heading: "Quién puede verlo",
        blocks: [
          { p: "Propietarios, administradores y supervisores. Una persona ve sus propios pendientes —políticas por firmar, notas por acusar, su lista, sus documentos por vencer— en sus propias pantallas, nunca las de otra persona." },
        ],
      },
    ],
    faq: [
      { q: "¿Por qué una persona muestra «—» bajo Incorporación?", a: "Nunca se le inició una lista. Inicie una desde su expediente si la quiere." },
    ],
  },
  // ── El nivel «agencia» del portal de ventas (lib/sales/agency.js) ─────────

};
