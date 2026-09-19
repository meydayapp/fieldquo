// lib/prepGuide/content.es.js
//
// Lo que el cliente tiene que HACER antes de que llegue el equipo, por oficio
// — en español. Misma forma y mismas reglas que content.en.js: nada afirma un
// número de días, un tiempo de curado, una marca ni un precio. Las claves son
// las de GUIDES_EN; scripts/check-prep-guide.mjs exige que coincidan una a una
// y que cada lista tenga al menos cuatro puntos.

export const GUIDES_ES = {
  cabinet_refinishing: {
    checklist: [
      "Despeje por completo las encimeras — retire todo, incluidos los electrodomésticos pequeños, el escurridor, la decoración y el microondas. Guárdelo en otro lugar seguro.",
      "Mueva la mesa del comedor — sáquela de la cocina o llévela a una zona protegida, lejos del área de trabajo.",
      "Retire cuadros y decoración cerca de los gabinetes — pinturas, espejos, repisas o cualquier objeto en las paredes adyacentes.",
      "Estufa y refrigerador — si trabajamos alrededor o detrás de estos aparatos, sepárelos de la pared para tener acceso completo. Moverlos da el resultado más limpio.",
      "Interior de los gabinetes — no necesita vaciarlos. Los interiores no se refinan salvo que su cotización los incluya como extra.",
      "Preparación general de la cocina — asegúrese de que el piso esté despejado y aspirado. Nosotros protegemos pisos, encimeras y electrodomésticos con barreras profesionales y lonas.",
      "Mascotas — manténgalas fuera de la cocina y de las habitaciones contiguas mientras estamos; las puertas se sellan y el equipo de pulverizado es ruidoso.",
    ],
    warning:
      "Si pidió o espera que se pinte el interior de los gabinetes, debe vaciarlos por completo antes de que empecemos. Un gabinete sin vaciar no se puede pintar por dentro, y eso puede retrasar el proyecto.",
    dayOf: [
      "Protegemos pisos, encimeras y electrodomésticos con barreras y plástico antes que nada, y montamos una estación de pulverizado contenida y ventilada en la cocina.",
      "La cocina queda fuera de uso mientras trabajamos: sin fregadero, sin estufa y con las puertas selladas. Recomendamos planear comidas fuera o usar otra habitación durante el proyecto.",
      "Reducimos las molestias al mínimo y limpiamos a fondo al final de cada día.",
    ],
    afterCare:
      "Sus gabinetes están listos para un uso ligero en cuanto se los entregamos. Cierre las puertas con suavidad y evite colgar algo pesado de ellas o limpiarlas con productos hasta que el acabado haya endurecido por completo — le diremos cuánto tarda con el producto usado.",
  },

  cabinet_refacing: {
    checklist: [
      "Despeje por completo las encimeras — las puertas y frentes de cajón nuevos se instalan desde el frente, y necesitamos toda la encimera para trabajar.",
      "Vacíe los cajones y los gabinetes cuyos frentes se reemplazan — los cajones salen, las puertas se quitan, y lo que hay dentro estorba.",
      "Retire cuadros y decoración cerca de los gabinetes — todo lo que hay en las paredes adyacentes baja mientras se terminan los cuerpos.",
      "Estufa y refrigerador — si se terminan los paneles laterales, separe los aparatos para que lleguemos a los costados.",
      "Confirme la posición de los tiradores — perforamos los frentes nuevos en la posición elegida en la cotización; si quiere cambiarla, dígalo antes de que lleguemos.",
      "Mantenga el piso de la cocina despejado y a las mascotas fuera mientras estamos.",
    ],
    warning:
      "Las puertas nuevas se fabricaron con las medidas tomadas en sitio. Si algún gabinete se movió, se reemplazó o se modificó desde entonces, avísenos antes de que lleguemos — una puerta hecha para un hueco que cambió no va a encajar.",
    dayOf: [
      "Las puertas y frentes viejos salen primero y se van con nosotros. Luego los cuerpos se terminan a juego con los frentes nuevos, lo que deja la cocina fuera de uso ese día.",
      "Se instalan las puertas nuevas, se ajustan para que queden a nivel y se colocan los tiradores. Recorremos la cocina con usted antes de irnos.",
    ],
    afterCare:
      "Las bisagras nuevas se asientan en las primeras semanas. Si una puerta se desalinea, avísenos — es un ajuste pequeño y forma parte del trabajo.",
  },

  kitchen_design: {
    checklist: [
      "Vacíe la cocina por completo — cada gabinete, cada cajón, la despensa y las encimeras. Todo lo que se queda en la casa necesita un lugar en otra habitación.",
      "Organice los electrodomésticos — díganos cuáles se reutilizan y dónde guardarlos mientras la cocina vieja está fuera; un refrigerador que conserva necesita un enchufe en otro sitio.",
      "Despeje un paso de la puerta a la cocina — los gabinetes y las encimeras son largos y pesados, y entran por su puerta principal.",
      "Prepare una cocina provisional — un hervidor, un microondas y un refrigerador en otra habitación hacen las próximas semanas mucho más llevaderas.",
      "Descuelgue lo que haya en las paredes contiguas a la cocina — la estructura, la plomería y la instalación de gabinetes hacen vibrar la pared.",
      "Mascotas y niños — la cocina es una obra mientras estamos en ella; manténgala cerrada fuera del horario de trabajo.",
    ],
    warning:
      "La plomería y la electricidad de la cocina nueva las hacen oficios con licencia en los días que programamos. El fregadero, el lavavajillas y la estufa no se pueden usar hasta que esos días terminen — cuente con la cocina fuera de servicio durante todo el proyecto, no solo el primer día.",
    dayOf: [
      "La cocina vieja sale primero. Es el día más ruidoso y el que más polvo hace; sellamos las puertas antes de empezar.",
      "Los gabinetes entran por etapas: bajos, luego altos, luego se toma la plantilla de la encimera. La encimera se fabrica sobre los gabinetes instalados, así que hay unos días entre lo uno y lo otro.",
      "Recorremos la cocina con usted al final de cada etapa y de nuevo en la entrega.",
    ],
    afterCare:
      "Puertas y cajones se ajustan en la entrega y pueden moverse cuando la casa asienta; avísenos y los realineamos. Evite agua estancada en las juntas de la encimera hasta que el sellador cure — le diremos cuánto tiempo.",
  },

  countertop: {
    checklist: [
      "Despeje por completo las encimeras — todo lo que hay encima, en el fregadero y en la repisa de la ventana sobre el fregadero.",
      "Vacíe el gabinete bajo el fregadero y los cajones contiguos — la plomería se desconecta desde abajo y necesitamos el espacio.",
      "Organice la plomería y el gas — desconectar el fregadero, el lavavajillas y la parrilla es trabajo aparte salvo que su cotización lo incluya. Confirme quién lo hace y qué día.",
      "Asegúrese de que los gabinetes estén firmes y a nivel — una encimera solo queda tan nivelada como lo que la sostiene. Avísenos de cualquier gabinete que se mueva.",
      "Despeje un paso de la puerta a la cocina — una losa es larga, pesada, la cargan dos personas y gira mal en las esquinas.",
      "Mantenga a las mascotas fuera de la cocina los días de retiro e instalación.",
    ],
    warning:
      "El fregadero y el lavavajillas quedan fuera de uso desde que sale la encimera vieja hasta que se reconecta la plomería después de sellar la nueva. No es el mismo día salvo que su cotización lo diga — planéelo.",
    dayOf: [
      "El día de la plantilla medimos sus gabinetes con exactitud; no se retira nada. El día de la instalación, la encimera vieja sale, se va con nosotros, y la nueva se coloca, nivela, une y sella.",
      "Los cortes se hacen afuera cuando es posible. Cuando hay que hacerlos en sitio, contenemos el polvo y limpiamos antes de irnos.",
    ],
    afterCare:
      "Mantenga las juntas y el borde del fregadero secos hasta que el sellador cure — le diremos cuánto tiempo para el producto usado. Limpie la superficie con un paño suave y jabón neutro; evite las esponjas abrasivas.",
  },

  interior_painting: {
    checklist: [
      "Saque los muebles pequeños y todo lo que hay sobre ellos de las habitaciones a pintar — lámparas, plantas, libros, electrónicos. Los muebles grandes pueden quedarse si se pueden juntar en el centro y cubrir.",
      "Descuelgue cuadros, espejos, relojes y cortinas — y sus ganchos, salvo que quiera que pintemos alrededor. Guarde la ferretería en una bolsa por habitación.",
      "Despeje la parte alta de los clósets, las repisas y los alféizares de cada habitación de la lista.",
      "Decida colores y acabados antes de que lleguemos — un cambio ese día significa un viaje a la tienda y un día perdido.",
      "Mascotas — manténgalas en una habitación que no pintemos. Paredes húmedas y un gato curioso es mala combinación para ambos.",
      "Díganos qué es frágil o valioso y prefiere mover usted mismo.",
    ],
    warning:
      "Las habitaciones que pintamos quedan fuera de uso mientras la pintura está húmeda, incluida la noche entre manos. Los dormitorios suelen hacerse primero para liberarlos primero — díganos si necesita otro orden.",
    dayOf: [
      "Cubrimos los pisos y los muebles que se quedan, enmascaramos molduras y enchufes, y resanamos y lijamos antes de aplicar pintura. La primera hora es preparación, no pintura.",
      "Espere algo de olor a pintura durante uno o dos días; ventilamos sobre la marcha. Puertas y ventanas de las habitaciones pintadas se quedan abiertas cuando el clima lo permite.",
      "Limpiamos al final de cada día y dejamos un paso despejado por la casa.",
    ],
    afterCare:
      "La pintura fresca está seca al tacto mucho antes de estar dura. Evite fregar, colgar cuadros o arrimar muebles a las paredes hasta que cure — le diremos cuánto tiempo para el producto usado.",
  },

  exterior_painting: {
    checklist: [
      "Aleje los autos de la casa — el rocío de pintura y las escaleras necesitan la entrada. Estacione en la calle o en el garaje.",
      "Despeje el perímetro — muebles de patio, asador, macetas, mangueras, adornos y todo lo que esté a menos de un metro de las paredes.",
      "Cierre todas las ventanas y apague los aspersores los días que estemos — una pared mojada no se puede pintar.",
      "Pode arbustos y ramas que toquen la casa, o díganos si quiere que lo hagamos; necesitamos llegar a la pared detrás.",
      "Abra los portones laterales y avísenos de cualquier sensor de alarma en las puertas y ventanas donde trabajaremos.",
      "Mascotas — manténgalas adentro mientras haya escaleras puestas y pintura húmeda.",
    ],
    warning:
      "La pintura exterior necesita una superficie seca y un pronóstico seco. Si llueve, paramos y la fecha de término se mueve — el trabajo no. Mantenga los aspersores apagados durante todo el proyecto, incluidos los días en que no estamos.",
    dayOf: [
      "Lavamos primero las superficies y las dejamos secar, luego raspamos, lijamos, sellamos juntas e imprimamos antes de las manos de acabado. En una casa grande, los primeros días son solo preparación.",
      "Las ventanas alrededor de las que pintamos se enmascaran y no se abren mientras trabajamos en esa pared.",
      "Quitamos el enmascarado y recogemos el material al final de cada día.",
    ],
    afterCare:
      "Deje los aspersores apagados y los arbustos lejos de las paredes hasta que la pintura cure — le diremos cuánto tiempo. Riegue las paredes con manguera y suavidad, nunca con hidrolavadora.",
  },

  flooring: {
    checklist: [
      "Vacíe las habitaciones por completo — muebles, alfombras, lámparas, todo lo que esté en el piso. Podemos mover piezas grandes si su cotización lo dice; si no, deben estar fuera antes de que lleguemos.",
      "Descuelgue o asegure lo que haya en las paredes — el lijado hace vibrar la casa, y un cuadro en un clavo puede caerse.",
      "Vacíe las repisas bajas de los clósets de las habitaciones a trabajar, y despeje su piso.",
      "Apague el ventilador de la calefacción o del aire acondicionado los días de lijado, para que el polvo no viaje por los ductos.",
      "Cuente con no usar esas habitaciones — y, mientras el acabado seca, con salir de la casa — durante los tiempos que le daremos ese día.",
      "Mascotas y plantas fuera de las habitaciones, e idealmente fuera de la casa, mientras se aplica el acabado.",
    ],
    warning:
      "Nadie puede pisar el piso mientras el acabado está húmedo, ni siquiera para llegar a otra habitación. Si las habitaciones a trabajar son el único paso a un baño o un dormitorio, díganoslo antes de empezar para ordenar el trabajo en consecuencia.",
    dayOf: [
      "Sellamos puertas y rejillas, y lijamos el piso con granos cada vez más finos. Las lijadoras son ruidosas y queda algo de polvo fino a pesar de las aspiradoras.",
      "El tinte, si eligió uno, va después, y luego las manos protectoras con tiempo de secado entre ellas. La casa puede oler al acabado uno o dos días.",
    ],
    afterCare:
      "Espere el tiempo que le indiquemos antes de pisar con calcetines, más antes de devolver los muebles y más aún antes de poner alfombras — el acabado sigue endureciendo durante semanas. Ponga fieltros bajo cada pata.",
  },

  flooring_install: {
    checklist: [
      "Vacíe las habitaciones por completo — muebles, alfombras, lámparas y todo lo que haya en el piso de los clósets.",
      "Deje que el piso nuevo se aclimate — si ya se entregó, mantenga las cajas planas, adentro, en las habitaciones donde se instalará, el tiempo que exija el fabricante.",
      "Despeje un paso de la puerta a las habitaciones — el piso llega en cajas largas y pesadas.",
      "Díganos qué hay bajo el piso viejo si lo sabe — un piso anterior, piso radiante, un contrapiso con historia.",
      "Puertas — algunas quizá necesiten recortarse para librar el piso nuevo. Avísenos de cualquier puerta que prefiera que no cortemos.",
      "Mascotas fuera de las habitaciones mientras sale el piso viejo y entra el nuevo.",
    ],
    warning:
      "El contrapiso no se puede inspeccionar hasta retirar el piso viejo. Si está dañado, desnivelado o húmedo, es trabajo adicional que le mostraremos y cotizaremos antes de continuar.",
    dayOf: [
      "El piso viejo sale primero, y el contrapiso se revisa y prepara. Luego se instala el piso nuevo y se recolocan las molduras.",
      "Los cortes se hacen afuera o en una zona contenida; espere algo de ruido y un poco de polvo.",
    ],
    afterCare:
      "Fieltros bajo cada mueble antes de devolverlo. Use el método de limpieza que recomienda el fabricante para este piso — el equivocado puede anular la garantía.",
  },

  tiling: {
    checklist: [
      "Despeje la zona por completo — en un piso, cada mueble; en un salpicadero de cocina, todo lo que hay en las encimeras; en un baño, todo lo que hay en el tocador y en la ducha.",
      "Confirme el azulejo, el patrón y el color de la lechada antes de que lleguemos — un cambio ese día es un cambio en un trabajo ya empezado.",
      "El baño o la cocina que se enlosa queda fuera de uso mientras el azulejo y la lechada curan. Asegúrese de tener otro disponible.",
      "Díganos lo que sepa de detrás de la pared o bajo el piso — cables de piso radiante, plomería reubicada.",
      "Mantenga a las mascotas fuera de la habitación desde el primer día hasta que se selle la lechada.",
    ],
    warning:
      "El azulejo y la lechada no se pueden pisar ni mojar hasta que hayan curado. Una ducha enlosada hoy no se usa esta noche. Le diremos exactamente cuándo — organícese en consecuencia.",
    dayOf: [
      "Preparamos primero la superficie: el azulejo viejo sale si lo hay, el sustrato se nivela e impermeabiliza donde la habitación lo necesita.",
      "Se coloca el azulejo, un día o más después la lechada, y luego el sellador. Los cortes se hacen con sierra de agua, afuera cuando es posible.",
    ],
    afterCare:
      "Mantenga la zona seca el tiempo que le indiquemos y luego límpiela con un producto neutro — nada ácido sobre la lechada. Vuelva a sellar la lechada según el calendario que le demos.",
  },

  stairs: {
    checklist: [
      "Despeje la escalera, el descanso y el pasillo de arriba y de abajo — nada en los escalones, nada apoyado en las paredes contiguas.",
      "Descuelgue los cuadros de las paredes de la escalera y todo lo que cuelgue sobre ella.",
      "Cuente con quedarse en un solo piso durante los tiempos que le daremos — una escalera con acabado húmedo no se cruza, ni con cuidado.",
      "Suba (o baje) lo que vaya a necesitar antes de cada mano: medicamentos, cargadores, la comida del perro.",
      "Mascotas — manténgalas en el piso donde están su comida y su cama, tras una puerta cerrada, mientras seca el acabado.",
    ],
    warning:
      "Una vez aplicado el acabado, la escalera queda fuera de uso el tiempo que le indiquemos ese día, sin excepciones. Si solo hay un baño y está en el otro piso, díganoslo antes de empezar y ordenaremos el trabajo — escalón por medio, o un lado a la vez — para que pueda pasar.",
    dayOf: [
      "Enmascaramos paredes, balaustres y el piso de abajo, lijamos los elementos de su cotización hasta la madera desnuda, resanamos los golpes, y luego teñimos y damos acabado con tiempo de secado entre manos.",
      "El lijado es ruidoso y hace polvo; contenemos lo que podemos y limpiamos cada día.",
    ],
    afterCare:
      "Solo calcetines los primeros días después de irnos, sin alfombra de escalera hasta que el acabado endurezca, y nada arrastrado escalera arriba o abajo — le diremos cuánto tiempo para el producto usado.",
  },

  drywall: {
    checklist: [
      "Vacíe la habitación, o junte todo en el centro y cúbralo — el polvo de yeso llega a todas partes.",
      "Descuelgue todo lo que haya en las paredes a trabajar, y en el otro lado de esas paredes; los tornillos y el lijado atraviesan.",
      "Apague el ventilador de la calefacción o del aire acondicionado mientras lijamos, para que el polvo se quede en la habitación.",
      "Díganos qué hay dentro de la pared — cableado que haya añadido, plomería, un cable de bocina.",
      "Mantenga a mascotas y niños fuera de la habitación hasta el lijado final y la limpieza.",
    ],
    warning:
      "La pasta para juntas necesita secar entre manos, y seca a la velocidad que permite la habitación. Una habitación fría o húmeda añade días. Mantenga la calefacción encendida y las ventanas cerradas salvo que le pidamos lo contrario.",
    dayOf: [
      "Las reparaciones se recortan, parchan y encintan primero; luego dos o tres manos de pasta con secado entre cada una, luego lijado, luego imprimación si su cotización la incluye.",
      "Los días entre manos son visitas cortas. El día de lijado es el del polvo.",
    ],
    afterCare:
      "Un panel imprimado se puede pintar en cuanto seca la imprimación. No cuelgue nada pesado sobre un parche reciente hasta que esté pintado.",
  },

  plumbing: {
    checklist: [
      "Despeje bajo el fregadero, alrededor del inodoro, o donde sea el trabajo — todo fuera del gabinete y un metro libre alrededor del aparato.",
      "Sepa dónde está la llave general de agua y asegúrese de que podamos llegar — suele estar detrás de cajas en el sótano.",
      "Avísenos de cualquier otro aparato que esté fallando; con el agua cortada es el momento más barato para revisarlo.",
      "Tenga el aparato nuevo en sitio si lo suministra usted, todavía en su caja y con todas sus piezas.",
      "Mantenga a las mascotas lejos de la zona de trabajo y de cualquier piso o techo abierto.",
    ],
    warning:
      "El agua estará cortada parte de la visita, a veces en toda la casa. Llene una jarra y organícese. Un aparato que suministra usted debe estar completo y en sitio antes de que lleguemos, o la visita se pierde.",
    dayOf: [
      "Evaluamos primero, confirmamos la reparación con usted, luego cerramos el agua y hacemos el trabajo. Todo se prueba a presión antes de devolver el agua a la casa.",
      "Algunos trabajos requieren abrir una pared o un techo. Le avisamos antes de abrir cualquier cosa y dejamos la abertura limpia y lista para cerrarse.",
    ],
    afterCare:
      "Abra los grifos un minuto cuando nos hayamos ido para sacar el aire de las líneas. Si algo gotea, suda o suena distinto, llámenos — una junta nueva debe ser silenciosa.",
  },

  electrical: {
    checklist: [
      "Despeje el acceso al panel eléctrico — un metro libre delante, nada apilado contra él.",
      "Despeje la zona de trabajo — alrededor de enchufes, interruptores, luminarias o del aparato a conectar.",
      "Guarde su trabajo y apague computadoras y otros electrónicos antes de que lleguemos; la corriente estará cortada parte de la visita.",
      "Avísenos de cualquier otra cosa que se dispare, parpadee, zumbe o se sienta caliente — con el panel abierto es el momento de revisarlo.",
      "Mantenga a mascotas y niños lejos de la zona de trabajo y de cualquier caja o pared abierta.",
    ],
    warning:
      "La corriente se cortará — en el circuito, y a veces en toda la casa — durante parte de la visita. Equipo médico, acuarios, congeladores y cualquier otra cosa que no pueda quedarse sin corriente: díganoslo antes de empezar para planearlo.",
    dayOf: [
      "Confirmamos el alcance con usted, cortamos la corriente, hacemos el trabajo y probamos cada circuito que tocamos antes de irnos.",
      "Cuando el trabajo requiere inspección o permiso, le decimos qué sigue y cuándo.",
    ],
    afterCare:
      "Ponga en hora los relojes y temporizadores que perdieron corriente. Si un interruptor vuelve a dispararse después de irnos, no lo reponga una y otra vez — llámenos.",
  },

  hvac: {
    checklist: [
      "Despeje alrededor de la caldera, la unidad interior o la unidad exterior — un metro libre por cada lado, y el paso desde la puerta.",
      "Asegúrese de que la trampilla del ático, el espacio bajo el piso o el clóset técnico sean accesibles si los ductos pasan por ahí.",
      "Anote los ajustes del termostato que le gustan — un termostato de reemplazo arranca de cero.",
      "Díganos qué habitaciones están demasiado calientes o frías; es la mejor información que podemos tener con el sistema abierto.",
      "Mantenga a las mascotas lejos de la zona de trabajo — líneas de refrigerante, ductos abiertos y un ventilador en marcha son peligros.",
    ],
    warning:
      "La calefacción o el aire acondicionado estará apagado durante toda la visita, y el día de una instalación a veces toda la noche. En pleno invierno o en una ola de calor, planéelo — un calefactor o un ventilador extra en la habitación que más usa.",
    dayOf: [
      "En una reparación, diagnosticamos primero, confirmamos la reparación y el costo con usted, hacemos el trabajo y corremos el sistema un ciclo completo antes de irnos.",
      "En una instalación, el equipo viejo sale primero y se va con nosotros; el nuevo se instala, conecta, pone en marcha y prueba, y le mostramos cómo funcionan los controles.",
    ],
    afterCare:
      "Cambie o limpie el filtro según el calendario que le demos — es lo que más influye en cuánto dura el equipo. Si el sistema hace ciclos cortos, hace un ruido nuevo o el termostato y la habitación no coinciden, llámenos.",
  },

  appliance_repair: {
    checklist: [
      "Vacíe el aparato — un refrigerador en reparación necesita su contenido en una hielera; un lavavajillas o una lavadora deben estar vacíos; un horno debe estar frío y lo bastante limpio para trabajar.",
      "Despeje el espacio alrededor y delante — normalmente hay que sacarlo.",
      "Localice el número de modelo y de serie y téngalo a mano; está en una etiqueta dentro de la puerta o en la parte trasera. Nos dice qué piezas traer.",
      "Describa la falla con la mayor precisión posible — el ruido, el olor, cuándo empezó, qué hace y qué no hace.",
      "Mantenga a las mascotas fuera de la cocina o del cuarto de lavado mientras el aparato está abierto.",
    ],
    warning:
      "Algunas reparaciones necesitan una pieza por pedido. En ese caso, la primera visita es un diagnóstico y la reparación una segunda visita; se lo diremos antes de irnos, con el costo.",
    dayOf: [
      "Diagnosticamos primero, le decimos qué encontramos y cuánto cuesta repararlo, y procedemos solo con su aprobación. El aparato se prueba en un ciclo completo antes de irnos.",
    ],
    afterCare:
      "Espere el tiempo que le indiquemos antes de volver a llenar un refrigerador o congelador. Si la falla vuelve, avísenos — una reparación tiene garantía, y la segunda revisión corre por nuestra cuenta cuando la causa es nuestro trabajo.",
  },

  locksmith: {
    checklist: [
      "Tenga a mano una prueba de que tiene derecho a la propiedad — identificación con la dirección, un contrato de arrendamiento o una escritura. La pediremos; es lo que nos impide abrir la puerta de otra persona.",
      "Despeje el vano y la zona alrededor de cada cerradura a trabajar, por dentro y por fuera.",
      "Reúna todas las llaves existentes de las cerraduras a cambiar, para saber cuántas se reemplazan.",
      "Decida cuántas llaves nuevas necesita y quién recibe una.",
      "Avísenos de cualquier cableado de alarma o cerradura inteligente en las puertas.",
    ],
    warning:
      "No abrimos, recodificamos ni reemplazamos una cerradura sin prueba de que tiene derecho a la propiedad. Sin ella, la visita termina en la puerta y se cobra igual.",
    dayOf: [
      "Confirmamos con usted las puertas y cerraduras de la cotización, hacemos el trabajo y probamos cada llave en cada cerradura antes de irnos. Las llaves viejas dejarán de funcionar — ese es el punto.",
    ],
    afterCare:
      "Pruebe cada llave usted mismo antes de salir de casa. Una cerradura debe girar con suavidad; si se traba, avísenos el mismo día.",
  },

  garage_door: {
    checklist: [
      "Vacíe el espacio del garaje bajo y junto a la puerta — el auto afuera, y un área libre de todo el ancho de la puerta y un par de metros de fondo.",
      "Despeje la zona del techo por donde corren los rieles y el motor — bicicletas colgadas, repisas, todo lo que esté al alcance del riel.",
      "Asegúrese de que haya un enchufe que funcione cerca del techo para el motor, y avísenos si no lo hay.",
      "Saque los autos de la entrada frente a la puerta — los paneles y los resortes entran por ahí.",
      "Mantenga a mascotas y niños fuera del garaje mientras se trabaja en los resortes.",
    ],
    warning:
      "Un resorte de puerta de garaje está bajo una tensión enorme. No intente aflojar, ajustar ni «ayudar» con nada de la puerta antes de que lleguemos, y mantenga a todos fuera del garaje mientras se trabaja.",
    dayOf: [
      "La puerta vieja sale primero y se va con nosotros. Se instalan la puerta nueva, los rieles, los resortes y el motor, y la puerta se equilibra y se hace funcionar con corriente antes de irnos.",
      "Le mostramos el desbloqueo manual y cómo programar los controles y el teclado.",
    ],
    afterCare:
      "No ajuste usted mismo los resortes ni la fuerza del motor — llámenos. Una vez al año, haga equilibrar la puerta y lubricar los rodillos; es lo que la mantiene silenciosa.",
  },

  elevator_services: {
    checklist: [
      "Avise al edificio — inquilinos y personal deben saber qué cabina queda fuera de servicio, y desde cuándo hasta cuándo.",
      "Dénos acceso al cuarto de máquinas, al foso y a cada rellano, con llaves o un contacto que pueda abrir.",
      "Coloque los avisos de fuera de servicio en cada rellano, o díganos que los llevemos.",
      "Avísenos de cualquier cosa programada en el edificio ese día — una mudanza, una entrega — que dependa de la cabina.",
      "Tenga disponibles la bitácora de mantenimiento y el último certificado de inspección.",
    ],
    warning:
      "La cabina queda fuera de servicio durante toda la visita. Si el edificio tiene un solo elevador y residentes que no pueden usar las escaleras, planéelo antes de que lleguemos — el trabajo no se puede dejar a medias.",
    dayOf: [
      "Bloqueamos la cabina, hacemos el trabajo de la cotización y la probamos en todo su recorrido con carga antes de devolverla al servicio. La bitácora se firma antes de irnos.",
    ],
    afterCare:
      "Si la cabina se comporta distinto — un ruido nuevo, una parada brusca, una puerta que duda — sáquela de servicio y llámenos; no espere a la próxima visita programada.",
  },

  well_water: {
    checklist: [
      "Despeje el acceso a la boca del pozo — corte lo que crezca encima y mueva lo que esté guardado alrededor.",
      "Despeje alrededor del tanque de presión, los controles de la bomba y cualquier filtro o suavizador dentro de la casa.",
      "Llene algunos recipientes con agua antes de que lleguemos — el suministro estará cortado parte de la visita.",
      "Díganos qué ha notado: cambios de presión, aire en las líneas, sabor, color, o una bomba que corre sin nada abierto.",
      "Mantenga a las mascotas lejos de un ademe de pozo abierto.",
    ],
    warning:
      "El agua estará cortada durante la visita y, en algunos trabajos, hasta que llegue el resultado de un análisis. No beba del grifo hasta que le digamos que es seguro.",
    dayOf: [
      "Inspeccionamos y probamos primero, confirmamos el trabajo con usted y luego lo hacemos. El sistema se presuriza y se pone en marcha antes de irnos, y purgamos las líneas con usted presente.",
    ],
    afterCare:
      "Abra el grifo exterior el tiempo que le indiquemos para sacar el sedimento removido antes de usar los grifos interiores. Mantenga la boca del pozo despejada y por encima del nivel del suelo — es lo más importante para la calidad de su agua.",
  },

  mechanical_contracting: {
    checklist: [
      "Confirme la ventana de paro con todos los que dependen del sistema — inquilinos, producción, el administrador del edificio — y publíquela.",
      "Dénos acceso al cuarto de máquinas, la azotea, los plafones y el cuarto eléctrico, con llaves o un contacto.",
      "Despeje las zonas de trabajo y un paso lo bastante ancho para el equipo.",
      "Avísenos de cualquier otra cosa en el sistema — una fuga, un ruido, una zona que nunca llega a temperatura.",
      "Tenga disponibles los planos del edificio y los manuales del equipo si los tiene.",
    ],
    warning:
      "El sistema queda parado durante la ventana acordada. Un paro que no se puede extender hay que decírnoslo antes de empezar, no cuando la ventana se cierra — el trabajo no se puede dejar medio conectado.",
    dayOf: [
      "Aislamos el sistema, hacemos el trabajo de la cotización y lo ponemos en marcha antes de devolverlo al servicio. Cuando un arranque requiere el edificio ocupado, lo programamos con usted.",
    ],
    afterCare:
      "Reporte cualquier diferencia en la primera semana — una zona lenta en responder, un ruido nuevo, una presión que deriva. El informe de puesta en marcha que dejamos es la referencia para comparar.",
  },

  installation_services: {
    checklist: [
      "Tenga el producto en sitio, sin abrir, con todas sus piezas y las instrucciones del fabricante — revise la caja por daños antes de que lleguemos.",
      "Despeje el lugar donde va y un paso desde la puerta.",
      "Si necesita corriente, agua o un anclaje a la pared, díganos qué hay ahora — un enchufe, una llave de paso, lo que sepa de la pared.",
      "Retire el artículo viejo, o díganos que forma parte del trabajo.",
      "Mantenga a mascotas y niños fuera de la zona durante la instalación.",
    ],
    warning:
      "Si al producto le falta una pieza o llega dañado, la instalación no se puede terminar y la visita se cobra igual. Abra la caja y revísela contra la lista de piezas el día anterior.",
    dayOf: [
      "Desempacamos, revisamos, instalamos según las instrucciones del fabricante, probamos y nos llevamos el embalaje. Le mostramos cómo funciona antes de irnos.",
    ],
    afterCare:
      "Guarde el manual y el recibo juntos — la garantía del fabricante necesita ambos. Avísenos en los primeros días si algo está flojo, desnivelado o no funciona como se mostró.",
  },

  roofing_service: {
    checklist: [
      "Saque los autos de la entrada y aléjelos de la casa la noche anterior — en la entrada van el contenedor y la entrega de material, y caen tejas.",
      "Despeje el perímetro de la casa — muebles de patio, asador, macetas, mangueras, juguetes y todo lo que esté a pocos metros de las paredes. Cubra lo que no se pueda mover.",
      "Descuelgue o asegure lo que esté colgado en paredes y repisas adentro — el martilleo hace vibrar toda la casa. Los cuadros se caen; también lo que está en repisas altas.",
      "Retire del ático lo que no quiera con polvo y cubra el resto — durante el desmontaje cae escombro entre las tablas del entablado.",
      "Mascotas — un desmontaje de techo es ruidoso todo el día. Manténgalas en la habitación más tranquila o busque dónde dejarlas.",
      "Abra los portones laterales y apague los aspersores. Avísenos de una antena parabólica, panel solar o antena que quiera conservar.",
    ],
    warning:
      "Nadie bajo los aleros mientras desmontamos — eso incluye la entrada, el patio y el camino a la puerta. Use la puerta que acordemos y mantenga a los niños lejos del perímetro todo el día.",
    dayOf: [
      "Instalamos protección en el suelo y un contenedor, desmontamos el techo viejo hasta el entablado, revisamos las tablas y le mostramos lo que hay que reemplazar antes de cubrirlo.",
      "Membrana, tapajuntas, la cubierta nueva y la ventilación van el mismo día cuando el tamaño del techo lo permite. El techo nunca se deja abierto de noche.",
      "Barremos el terreno con un imán para clavos antes de irnos, y de nuevo a la mañana siguiente si volvemos.",
    ],
    afterCare:
      "Recorra usted mismo el terreno los primeros días y avísenos de cualquier clavo que encuentre — volvemos con el imán. Algo de pérdida de gránulos en las primeras lluvias es normal en un techo de asfalto nuevo.",
  },

  gutter_services: {
    checklist: [
      "Saque los autos de la entrada y aléjelos de las paredes — las escaleras se colocan alrededor de toda la casa.",
      "Despeje el perímetro — muebles de patio, macetas y mangueras lejos de las paredes donde se apoyarán las escaleras.",
      "Abra los portones laterales y avísenos de cualquier jardinera que debamos proteger bajo los aleros.",
      "Díganos adónde debe ir el agua — una bajante que cae en la entrada del vecino es la razón más común por la que volvemos.",
      "Mascotas adentro mientras las escaleras estén puestas.",
    ],
    warning:
      "Trabajamos desde escaleras alrededor de cada pared de la casa. Todo lo que esté bajo los aleros — un auto, la cubierta de un jacuzzi, una mesa de vidrio — está en el camino de una palada de hojas mojadas o de una herramienta que se cae. Muévalo o cúbralo.",
    dayOf: [
      "En una limpieza, vaciamos a mano, enjuagamos cada bajante e inspeccionamos las canaletas vacías. En una instalación, la canaleta vieja baja y la nueva se forma en sitio y se cuelga con caída hacia las salidas.",
      "Hacemos correr agua por todo antes de irnos, para que vea cómo drena.",
    ],
    afterCare:
      "Después de la primera lluvia fuerte, fíjese si el agua rebasa la canaleta o se acumula junto a los cimientos y avísenos — es una pendiente o una salida, y se arregla rápido.",
  },

  siding: {
    checklist: [
      "Aleje los autos de la casa y despeje el perímetro — muebles, macetas, mangueras, todo lo que esté a pocos metros de las paredes a revestir.",
      "Descuelgue cuadros y objetos de repisas en el lado interior de las paredes a trabajar — el clavado los hace vibrar.",
      "Apague los aspersores y abra los portones laterales.",
      "Díganos qué hay montado en las paredes que quiera conservar — luces, un carrete de manguera, una antena parabólica, los números de la casa — y si vuelve al mismo lugar.",
      "Pode los arbustos que toquen las paredes, o pídanos que lo hagamos.",
      "Mascotas adentro en horario de trabajo.",
    ],
    warning:
      "El entablado detrás del revestimiento viejo no se puede inspeccionar hasta retirarlo. Si está podrido o húmedo, es trabajo aparte, y se lo mostraremos con fotos y lo cotizaremos antes de cubrirlo.",
    dayOf: [
      "El revestimiento viejo sale pared por pared y se va con nosotros. Se revisa el entablado, se coloca la barrera contra la intemperie, y luego el revestimiento nuevo y las molduras.",
      "Espere ruido de cortes y clavado durante todo el día, y un sitio más limpio de lo que espera al final.",
    ],
    afterCare:
      "Lave el revestimiento nuevo con manguera y cepillo suave, nunca con hidrolavadora de cerca. Avísenos si un panel traquetea con el viento — es un sujetador, y se arregla rápido.",
  },

  insulation: {
    checklist: [
      "Despeje la trampilla del ático y un metro alrededor — la manguera de la máquina sube por ahí y se queda todo el día.",
      "Retire del ático lo que quiera mantener limpio, y díganos qué tiene que quedarse arriba.",
      "Despeje el pasillo o clóset bajo la trampilla, y un paso desde la puerta.",
      "Avísenos de luces empotradas, extractores de baño, una chimenea o un ventilador de ático — cada uno necesita un espacio libre alrededor.",
      "Mascotas — la sopladora es ruidosa. Manténgalas tras una puerta cerrada, bien lejos de la trampilla.",
    ],
    warning:
      "Todo lo que quede en el ático quedará enterrado. Si quiere recuperarlo, tiene que bajar antes de que lleguemos. No excavaremos después para buscar una caja de fotos — el aislamiento es el producto, y removerlo deshace el trabajo.",
    dayOf: [
      "Sellamos primero las fugas de aire — soleras, penetraciones y la trampilla — y luego soplamos el aislamiento al espesor que exige el valor R de su cotización, manteniendo abierto el paso de ventilación.",
      "Medimos el espesor antes y después, y dejamos marcadores para que se pueda verificar.",
    ],
    afterCare:
      "Deje el ático como está. Si más adelante otro contratista tiene que subir — un electricista, un techador — pídale que camine sobre las vigas y que vuelva a extender el aislamiento donde se arrodilló.",
  },

  masonry: {
    checklist: [
      "Saque los autos y despeje la zona alrededor del muro, los escalones o la chimenea a trabajar — un espacio libre de un par de metros, y un paso para carretillas.",
      "Apague los aspersores y déjelos apagados hasta que le digamos — el mortero nuevo no se puede mojar el tiempo que necesita para curar.",
      "Avísenos de cualquier jardinera, losa de patio o bajante en la zona de trabajo que quiera proteger.",
      "Abra los portones y díganos dónde podemos montar la mezcladora y dónde descargar el material.",
      "Mascotas lejos de la zona de trabajo y del mortero fresco hasta que fragüe.",
    ],
    warning:
      "El mortero y el repello frescos no deben congelarse ni recibir lluvia durante el tiempo que le indiquemos. Si el pronóstico cambia, quizá tengamos que mover la fecha — el trabajo no cambia, el día puede.",
    dayOf: [
      "Protegemos lo que rodea el trabajo, retiramos lo que falló, preparamos el sustrato y colocamos o aplicamos el material nuevo. El curado empieza en cuanto terminamos, así que mantenga el agua y el paso lejos.",
    ],
    afterCare:
      "Mantenga agua, aspersores y paso lejos del trabajo nuevo el tiempo que le indiquemos. Una ligera diferencia de color entre el mortero nuevo y el viejo se atenúa en el primer año.",
  },

  paving: {
    checklist: [
      "Saque todos los autos de la entrada la noche anterior y consiga otro lugar para estacionar durante todo el proyecto — la entrada queda fuera de uso desde la primera mañana.",
      "Despeje los bordes — macetas, aro de básquet, mangueras, piedras decorativas y todo lo que haya a lo largo de la entrada o el sendero.",
      "Apague los aspersores y déjelos apagados hasta que le digamos. Díganos por dónde pasan las líneas de riego cerca del trabajo.",
      "Díganos por dónde entran los servicios a la casa — gas, agua, cable — para que la excavación los evite. Nosotros gestionamos la localización; usted nos dice lo que sabe.",
      "Mascotas y niños fuera de la zona de trabajo desde la primera excavación hasta que le digamos que la superficie se puede pisar.",
    ],
    warning:
      "Nada circula sobre la superficie nueva hasta que le digamos — ni un auto, ni un contenedor con ruedas — y nada afilado se apoya en ella. Circular antes de tiempo deja marcas que no salen.",
    dayOf: [
      "Excavamos, colocamos una base compactada por capas, colocamos los adoquines en el patrón acordado, contenemos los bordes, rellenamos las juntas y compactamos toda la superficie. El terreno alrededor se nivela y se deja en orden.",
      "Hay ruido de la compactadora y la sierra, y algo de polvo; mantenemos la calle libre de material.",
    ],
    afterCare:
      "Mantenga los vehículos fuera el tiempo que le indiquemos. Algo de arena de juntas se asienta en las primeras semanas y se puede reponer. Barra; no use hidrolavadora en la primera temporada.",
  },

  driveway_sealing: {
    checklist: [
      "Saque todos los autos de la entrada la noche anterior y estacione en otro lugar hasta que el sellador cure — le diremos cuánto tiempo ese día.",
      "Despeje la superficie — contenedores, macetas, mangueras, aro de básquet, todo lo que esté encima.",
      "Apague los aspersores el día anterior y déjelos apagados hasta que le digamos; una entrada mojada no se puede sellar y un sellador mojado se lava.",
      "Avísenos de manchas de aceite, grietas y zonas hundidas que haya notado — tratarlas es trabajo aparte, y solo podemos cotizar lo que conocemos.",
      "Mascotas y niños fuera de la entrada desde que empecemos hasta que cure.",
    ],
    warning:
      "Nadie ni nada sobre la entrada hasta que el sellador cure. Huellas de pies, de neumáticos y de patas se fijan en un sellador fresco y se quedan. Si tiene que cruzar, use el césped.",
    dayOf: [
      "Barremos y soplamos la superficie, tratamos las manchas de aceite, enmascaramos los bordes y aplicamos el sellador con el número de manos de su cotización. Bloqueamos la entrada al irnos.",
    ],
    afterCare:
      "Deje la barrera puesta el tiempo que le indiquemos. Evite girar el volante con el auto detenido sobre la entrada las primeras semanas — marca un sellador fresco.",
  },

  epoxy: {
    checklist: [
      "Vacíe el garaje por completo — autos, estanterías, bicicletas, todo lo que esté en el piso. El piso tiene que quedar desnudo de pared a pared.",
      "Avísenos de manchas de aceite, grietas, recubrimientos anteriores y cualquier punto por donde entre agua; la preparación depende de eso.",
      "Revise el clima y la temperatura — el piso debe estar seco y por encima de la temperatura que le indiquemos durante todo el curado. Mantenga el garaje cerrado y con calefacción si hace frío.",
      "Consiga dónde estacionar durante todo el proyecto, incluido el tiempo de curado que le demos.",
      "Mantenga a mascotas y niños fuera del garaje desde el primer pulido hasta que el piso cure.",
    ],
    warning:
      "Nada vuelve al piso hasta que cure — ni un pie, ni una bicicleta, y el auto al final. Pisarlo antes deja huellas; estacionar antes levanta el recubrimiento bajo los neumáticos. Le damos los tiempos ese día; respételos.",
    dayOf: [
      "Pulimos el concreto, reparamos las grietas y rellenamos los desconchados, y luego aplicamos las manos de su cotización con el tiempo de curado que cada una necesita. El garaje olerá al recubrimiento; mantenga cerrada la puerta a la casa.",
    ],
    afterCare:
      "Primero el paso a pie, luego objetos ligeros, luego el auto, cada uno después del tiempo que le demos. Los neumáticos calientes pueden marcar un piso que no ha curado del todo — espere el tiempo completo antes de estacionar.",
  },

  fence: {
    checklist: [
      "Confirme la línea de la cerca — recórrala con nosotros o márquela antes de que lleguemos. Una cerca del lado equivocado del lindero es un error muy caro, y solo un levantamiento topográfico lo resuelve.",
      "Avise a sus vecinos — el equipo, el ruido y los postes están a ambos lados del lindero durante un día.",
      "Gestione la localización de servicios, o confirme que lo hacemos nosotros — no se excava ningún hoyo hasta que las líneas estén marcadas.",
      "Despeje la línea de la cerca — plantas, cosas guardadas, composta, el techo del cobertizo que sobresale.",
      "Apague los aspersores y díganos por dónde pasan las líneas de riego cerca de la cerca.",
      "Mascotas — no hay cerca mientras trabajamos. Mantenga a los perros adentro o con correa hasta que los portones estén colgados y cerrados.",
    ],
    warning:
      "La localización de servicios debe estar hecha antes de excavar. Si no está marcada cuando lleguemos, no podemos empezar y la visita se reprograma. Nadie excava un hoyo de poste a través de una línea de gas para ganar un día.",
    dayOf: [
      "La cerca vieja baja primero, si la hay. Se excavan los hoyos, se fijan los postes y se montan los paneles o tablas. Los portones se cuelgan y ajustan al final.",
      "El concreto de los postes necesita tiempo antes de que la cerca soporte peso — le diremos cuánto antes de apoyar una escalera.",
    ],
    afterCare:
      "Mantenga a perros y niños lejos de portones y paneles hasta que los postes fragüen. La madera nueva se agrisa con la intemperie; tíñala o séllela según el calendario que recomendemos, no antes de que se haya secado.",
  },

  chimney_sweep: {
    checklist: [
      "Sin fuego durante las 24 horas previas a nuestra llegada — el conducto y el hogar deben estar fríos para deshollinarse, y una chimenea tibia es una visita reprogramada.",
      "Despeje el hogar y la zona delante — muebles, alfombras y adornos a un par de metros.",
      "Retire la ceniza y la leña sobrante del hogar.",
      "Díganos qué ha notado — humo en la habitación, olor, pájaros, un regulador que se traba.",
      "Mantenga a las mascotas fuera de la habitación; la aspiradora y los cepillos son ruidosos.",
    ],
    warning:
      "Una chimenea usada en las últimas 24 horas no se puede deshollinar con seguridad. Si anoche hubo fuego, díganoslo antes de salir y moveremos la visita.",
    dayOf: [
      "Sellamos la abertura del hogar, deshollinamos el conducto desde arriba o desde abajo, aspiramos el hogar e inspeccionamos el revestimiento, la tapa y el regulador. Recibe una nota escrita de lo que encontramos.",
    ],
    afterCare:
      "Si encontramos algo que requiere atención antes del próximo fuego, no encienda ninguno hasta que esté hecho. Si no, queme leña seca y curada — es lo que mantiene la chimenea limpia entre visitas.",
  },

  restoration: {
    checklist: [
      "Díganos qué pasó y cuándo — la cronología decide qué se puede salvar. Un daño por agua, en particular, empeora cada hora.",
      "Saque usted mismo de la zona afectada lo que pueda salvar — documentos, fotografías, electrónicos — y díganos qué quiere que intentemos recuperar.",
      "Despeje un paso de la puerta a las habitaciones afectadas para el equipo: deshumidificadores, ventiladores y el material que sale.",
      "Avísenos de cualquier cosa sensible en la casa — una persona con dificultades respiratorias, una mascota, un sistema de alarma.",
      "Sepa dónde están su panel eléctrico y su llave de agua; podemos necesitar ambos.",
    ],
    warning:
      "El equipo de secado tiene que funcionar sin parar, día y noche, mientras lo dejemos. Apagarlo de noche para ahorrar corriente o por el ruido deshace el secado del día y añade días al trabajo.",
    dayOf: [
      "Evaluamos y documentamos primero el daño, contenemos la zona afectada, retiramos lo que no se puede salvar e instalamos el equipo de secado o limpieza. Tomamos lecturas en cada visita.",
      "La reconstrucción — paneles, piso, pintura — empieza solo cuando las lecturas dicen que la estructura está seca.",
    ],
    afterCare:
      "Mantenga el equipo funcionando hasta que lo retiremos. Avísenos de inmediato de cualquier olor, mancha o humedad nueva — es mucho más barato detectarlo temprano.",
  },

  earthworks: {
    checklist: [
      "Gestione la localización de servicios, o confirme que lo hacemos nosotros — no se excava nada hasta que cada línea esté marcada.",
      "Avise a sus vecinos — maquinaria pesada, ruido y camiones los días que estemos.",
      "Saque los autos de la entrada y de la calle frente a la casa — la maquinaria y los camiones necesitan el espacio.",
      "Descuelgue o asegure los objetos frágiles adentro — una demolición o una excavadora junto a la casa la hace temblar.",
      "Avísenos del tanque séptico, el pozo, las líneas de riego, los cables enterrados y todo lo que sepa que hay bajo tierra.",
      "Mascotas y niños bien lejos de la zona de trabajo en todo momento, incluso fuera de horario.",
    ],
    warning:
      "La localización de servicios debe estar completa y visible cuando lleguemos, y todo lo enterrado que las empresas de servicios no marcan — una línea de gas privada a un calentador de piscina, un campo séptico — es usted quien debe decírnoslo. No vemos a través del suelo.",
    dayOf: [
      "Protegemos lo que se queda, cercamos la zona de trabajo y trabajamos el sitio en el orden de su cotización. El escombro sale en contenedores o camiones conforme se produce, no al final.",
      "El sitio se deja seguro cada tarde: hoyos cercados, maquinaria cerrada, nada suelto.",
    ],
    afterCare:
      "Manténgase fuera del terreno removido hasta que se nivele y asiente. Avísenos de cualquier hundimiento, agua estancada o grieta que aparezca en las primeras semanas.",
  },

  home_inspection: {
    checklist: [
      "Asegúrese de que todos los servicios estén encendidos — electricidad, agua, gas — y de que los pilotos estén prendidos. Un sistema apagado no se puede inspeccionar y se reportará como no inspeccionado.",
      "Despeje el acceso al panel eléctrico, la caldera, el calentador de agua, la trampilla del ático y la entrada al espacio bajo el piso — un metro libre delante de cada uno.",
      "Aleje lo guardado de los muros de cimentación en el sótano y el garaje, para que los muros se puedan ver.",
      "Abra cada habitación, clóset, construcción exterior y portón, y apague la alarma.",
      "Mascotas — en jaula o fuera de la casa. Abrimos cada puerta y ventana y subimos al ático; un perro suelto en la casa es un retraso y un riesgo.",
      "Cuente con estar presente para el recorrido final; es la parte más útil.",
    ],
    warning:
      "La inspección es visual y no invasiva. Todo lo que no podamos alcanzar o ver — una pared tras cajas guardadas, una trampilla de ático pintada, una habitación cerrada — se reporta como no inspeccionado, no como bien. Haga que todo sea accesible.",
    dayOf: [
      "Recorremos la propiedad del techo hacia abajo — exterior, techo, ático, cada habitación, el sótano y los sistemas — operando todo con sus controles normales y fotografiando lo que encontramos.",
      "Al final le explicamos los hallazgos importantes, y el informe escrito sigue después.",
    ],
    afterCare:
      "Lea el informe completo, no solo el resumen — y pregúntenos lo que no entienda. Los puntos marcados para evaluación adicional no son un veredicto; son lo que hay que preguntar a un especialista antes de decidir.",
  },

  renovation: {
    checklist: [
      "Vacíe por completo las habitaciones del proyecto, clósets incluidos. Todo lo que deba quedarse en la casa necesita un lugar lejos de la zona de trabajo durante todo el proyecto.",
      "Prepare la habitación donde vivirá — una cocina provisional si la cocina está en el proyecto, un baño que siga usable, un lugar tranquilo para trabajar.",
      "Despeje un paso de la puerta a la zona de trabajo y decida qué puerta usa el equipo. Cubra el piso del recorrido o pídanos que lo hagamos.",
      "Descuelgue lo que haya en las paredes del otro lado de las habitaciones a trabajar; la estructura y la demolición vibran a través.",
      "Díganos lo de la alarma, el estacionamiento, los vecinos a los que hay que avisar, y lo que sepa que hay dentro de las paredes.",
      "Mascotas y niños — la zona de trabajo es una obra también fuera de horario. Manténgala cerrada.",
    ],
    warning:
      "Una vez que empieza la demolición, lo que hay detrás de las paredes y bajo los pisos se ve por primera vez. Todo lo que encontremos que cambie el trabajo — pudrición, cableado viejo, un desagüe movido — se le muestra y se cotiza antes de continuar. El calendario puede moverse; el precio no, sin su aprobación.",
    dayOf: [
      "Primero la demolición — los días más ruidosos y con más polvo. Sellamos puertas y ductos antes de empezar. Luego la obra gruesa — estructura, plomería, electricidad — luego inspecciones, luego los acabados.",
      "El equipo está en sitio la mayoría de los días, pero no todos los oficios todos los días; algunos días serán tranquilos mientras algo cura o se espera a un inspector.",
      "Recorremos el trabajo con usted al final de cada etapa.",
    ],
    afterCare:
      "Los paneles, la pintura y el sellado nuevos siguen curando después de irnos; grietas pequeñas en las juntas en la primera temporada son la casa asentándose, y volvemos a retocarlas. Guarde juntos la garantía y los manuales que dejamos.",
  },

  carpentry: {
    checklist: [
      "Despeje la zona donde va el trabajo — muebles fuera o juntos en el centro y cubiertos, la pared desnuda.",
      "Tenga en sitio cualquier material que suministre usted y, si es madera, dentro de la casa el tiempo que necesite para aclimatarse.",
      "Díganos qué hay detrás de la pared si lo sabe — cableado, plomería, un montante cortado.",
      "Decida el acabado — teñido, pintado, al natural — antes de que lleguemos.",
      "Mantenga a las mascotas fuera de la habitación mientras cortamos.",
    ],
    warning:
      "Los cortes se hacen en sitio y el aserrín viaja. Si hay una habitación que debe quedar limpia — un cuarto de bebé, una oficina con equipo — díganoslo y la sellaremos antes de empezar.",
    dayOf: [
      "Volvemos a medir, cortamos y ajustamos, fijamos y damos acabado. Los cortes se hacen afuera o en una zona contenida cuando el clima lo permite.",
      "Lo que deba fabricarse fuera del sitio se instala en una segunda visita.",
    ],
    afterCare:
      "La madera se mueve con las estaciones. Una línea fina que se abre en una junta en el primer año es normal; una pieza que se despega de la pared no lo es — avísenos.",
  },

  residential_cleaning: {
    checklist: [
      "Recoja — ropa, juguetes, papeles y platos en su lugar, para que el tiempo se dedique a limpiar superficies y no a mover lo que hay encima.",
      "Guarde objetos de valor, dinero y cualquier cosa frágil que prefiera que no toquemos.",
      "Díganos qué requiere un cuidado especial — una encimera de mármol, una antigüedad, un producto al que sea alérgico — y traeremos el adecuado o usaremos el suyo.",
      "Mascotas — díganos quién está en casa, dónde se queda y si es amigable. Un gato que se escapa por una puerta abierta es nuestro peor día.",
      "Organice el acceso: una llave, un código o alguien en casa. Cuéntenos de la alarma.",
    ],
    warning:
      "Una habitación desordenada se ordena alrededor, no se limpia. Si quiere las superficies hechas, deben estar despejadas cuando lleguemos — no podemos decidir qué es basura y qué no.",
    dayOf: [
      "Trabajamos de arriba abajo, habitación por habitación, con los productos de su cotización. Los pisos se hacen al final, y dejamos una nota de lo que notamos — una fuga bajo un fregadero, una ventana que no cierra.",
    ],
    afterCare:
      "Los pisos pueden quedar húmedos un rato después de irnos. Si algo se pasó por alto, díganoslo el mismo día y volvemos — esa es la norma.",
  },

  commercial_cleaning: {
    checklist: [
      "Organice el acceso fuera de horario — una llave, una tarjeta o un código — y díganos cómo se arma y desarma la alarma.",
      "Pida al personal que despeje sus escritorios de papeles y objetos personales los días de limpieza; no movemos documentos.",
      "Díganos qué zonas están vedadas y cuáles necesitan más atención — la cocina, los baños, la recepción.",
      "Muéstrenos dónde se guardan los insumos, dónde se toma el agua y por dónde sale la basura.",
      "Avísenos de cualquier restricción de productos en el edificio — sin fragancia, una superficie que no tolera desinfectante.",
    ],
    warning:
      "Seguimos las instrucciones de acceso y alarma exactamente como se dieron. Si un código cambia o se añade una puerta a la ronda, díganoslo antes de la visita — una falsa alarma a las dos de la mañana se la cobra la central de monitoreo, no nosotros.",
    dayOf: [
      "Limpiamos según el horario y la lista acordados, firmamos la bitácora y cerramos. Todo lo que encontremos — una fuga, un accesorio roto, una puerta que no cierra con llave — se le anota esa misma noche.",
    ],
    afterCare:
      "Revise la bitácora y díganos en un día qué se pasó por alto. La lista se ajusta, no se discute.",
  },

  carpet_cleaning: {
    checklist: [
      "Aspire las alfombras antes de que lleguemos — así la limpieza va a la suciedad adherida, no a la suelta.",
      "Saque de las habitaciones los muebles pequeños, lámparas, plantas y todo lo que esté en el piso. Las piezas grandes pueden quedarse si su cotización lo dice; trabajaremos alrededor.",
      "Señálenos las manchas y díganos qué son si lo sabe — mascota, vino, tinta — porque cada una necesita un tratamiento distinto.",
      "Mascotas — manténgalas fuera de la alfombra hasta que esté completamente seca, y fuera de las habitaciones mientras trabajamos.",
      "Cuente con no usar las habitaciones hasta que la alfombra seque. Le diremos cuánto tiempo ese día; la ventilación y la calefacción lo acortan.",
    ],
    warning:
      "Algunas manchas son permanentes. Tratamos todas, pero una mancha fijada en la fibra, o tratada antes con el producto equivocado, puede aclararse en vez de salir. Le diremos con honestidad cuáles son cuáles antes de empezar.",
    dayOf: [
      "Pretratamos, limpiamos, enjuagamos y extraemos, habitación por habitación, y ponemos protectores bajo cualquier pata de mueble que quede sobre alfombra húmeda.",
    ],
    afterCare:
      "Manténgase fuera de la alfombra, o use calcetines limpios, hasta que seque. Deje los protectores bajo los muebles hasta entonces. Abra las ventanas o encienda el ventilador para acelerar.",
  },

  window_cleaning: {
    checklist: [
      "Suba las persianas, abra las cortinas y despeje los alféizares interiores — plantas, adornos y todo lo que se mojaría.",
      "Retire los muebles un paso de las ventanas que se hacen por dentro.",
      "Afuera, saque los autos de la entrada y todo lo que esté bajo las ventanas donde se apoyarán las escaleras.",
      "Avísenos de cualquier ventana que no abra, un sello roto o un mosquitero frágil.",
      "Abra los portones laterales y mantenga a las mascotas adentro mientras las escaleras estén puestas.",
    ],
    warning:
      "Una ventana con el sello roto — empañada entre los vidrios — no se puede dejar limpia; la humedad está dentro de la unidad. Le diremos cuáles son en vez de cobrarle por limpiar lo que no se puede limpiar.",
    dayOf: [
      "Limpiamos primero por fuera, luego por dentro, sacando los mosquiteros para lavarlos. Alféizares y marcos se limpian. Dejamos las ventanas como las encontramos — abiertas o cerradas.",
    ],
    afterCare:
      "Nada que hacer. Si mañana con el sol aparece una veta, avísenos y volvemos por esa ventana.",
  },

  pressure_washing: {
    checklist: [
      "Cierre todas las ventanas y puertas, y avísenos de las que no sellen — el agua a presión encuentra la rendija.",
      "Saque los autos de la entrada y aléjelos de las paredes, y despeje muebles de exterior, macetas, tapetes y juguetes de la zona a lavar.",
      "Cubra o mueva las plantas cercanas a las paredes y avísenos de una jardinera que quiera proteger — el escurrimiento arrastra lo que sale de la pared.",
      "Apague los enchufes exteriores y avísenos de cualquier luz, cámara o bocina montada en la pared.",
      "Mascotas adentro durante la visita.",
    ],
    warning:
      "El lavado a presión quita lo que está suelto. Pintura que ya falla, una tabla floja, una junta de mortero que se desmorona o un sellador viejo se irán con la suciedad. Miramos primero y le decimos lo que vemos, pero no podemos lavar una pared que no está sana sin revelarlo.",
    dayOf: [
      "Pretratamos, lavamos a la presión que la superficie tolera, enjuagamos y evacuamos el escurrimiento. La superficie queda mojada al irnos y muestra su color real una vez seca.",
    ],
    afterCare:
      "Deje que la superficie seque por completo antes de sellar, teñir o devolver los muebles. Si una mancha reaparece en días, probablemente es moho o alga, y podemos tratarla.",
  },

  auto_detailing: {
    checklist: [
      "Saque sus pertenencias del auto — guantera, consola, bolsillos de las puertas, cajuela y bajo los asientos. Limpiamos lo que hay; no podemos decidir qué es basura.",
      "Saque las sillas infantiles, o díganos que lo hagamos; una silla que lleva un año puesta tiene un auto entero de migas debajo.",
      "Avísenos de manchas, olores y cualquier zona en la que quiera que nos concentremos.",
      "Deje la llave y díganos qué no funciona — una ventanilla, un seguro, un testigo encendido.",
      "No lave el auto el día anterior — queremos ver lo que hay de verdad.",
    ],
    warning:
      "Algunas marcas son permanentes: una quemadura en la tapicería, un rayón que atraviesa el barniz, tinte transferido a piel clara. Le decimos cuáles antes de empezar, no después.",
    dayOf: [
      "Primero el interior — aspirado, champú o vapor, piel y molduras — y luego el exterior: lavado, descontaminación, pulido si se cotizó, y protección. El auto queda seco y listo cuando lo recoge.",
    ],
    afterCare:
      "Evite el lavado automático los primeros días después de un pulido y protección; lave a mano con dos cubetas. Lleve una microfibra en el auto para las marcas que aparecen el primer día.",
  },

  junk_removal: {
    checklist: [
      "Marque lo que se va — un trozo de cinta, una nota adhesiva, o todo junto en un lugar. Nos llevamos lo que señale y nada más.",
      "Separe lo que quiere conservar y póngalo donde no vayamos a entrar.",
      "Avísenos de artículos peligrosos — pintura, químicos, baterías, propano, un refrigerador con refrigerante — algunos requieren otra disposición y algunos no podemos llevarlos.",
      "Despeje un paso de los artículos a la puerta, y de la puerta a donde pueda estacionar el camión.",
      "Mascotas encerradas en una habitación mientras las puertas están abiertas y se mueven cosas pesadas.",
    ],
    warning:
      "Hay cosas que no podemos llevarnos — químicos, asbesto, ciertos aparatos sin certificado — y le diremos cuáles al verlas. No las esconda en una caja; convierte toda la carga en un problema en el sitio de disposición.",
    dayOf: [
      "Confirmamos la carga con usted, la sacamos, barremos el espacio y la llevamos a clasificar entre donación, reciclaje y disposición. Recibe un recibo de lo que salió.",
    ],
    afterCare:
      "Nada que hacer. Si algo que nos llevamos resulta ser un error, llame el mismo día — una carga se clasifica a la mañana siguiente.",
  },

  landscaping_design: {
    checklist: [
      "Recorra el plan con nosotros antes de empezar — confirme qué se queda, qué se va y dónde están las líneas. Es mucho más fácil mover un cantero en papel que en el suelo.",
      "Gestione la localización de servicios, o confirme que lo hacemos nosotros; no se excava nada hasta que las líneas estén marcadas.",
      "Díganos dónde están las líneas y las boquillas de riego, y apague el sistema durante el proyecto.",
      "Saque los autos de la entrada los días de entrega — tierra, piedra y plantas llegan en camión.",
      "Avise a sus vecinos del ruido y los camiones, y de cualquier planta cerca del lindero que sea de ellos.",
      "Mascotas — el jardín es una obra mientras estamos, y un cantero recién plantado es irresistible para un perro. Manténgalas adentro o con correa.",
    ],
    warning:
      "Las plantas nuevas necesitan riego según el calendario que le demos, desde el día en que se plantan — incluidos los fines de semana en que no estamos. Una planta que se seca en sus primeras dos semanas no vuelve, y es lo único que no podemos garantizar.",
    dayOf: [
      "Primero retiro y nivelación, luego la obra dura, luego el riego, luego canteros y plantación, luego el césped. El sitio está desordenado a la mitad y no al final.",
    ],
    afterCare:
      "Riegue según el calendario que le dejamos. Manténgase fuera del césped nuevo y los canteros nuevos el tiempo que le indiquemos. El mantillo se asienta; repóngalo en la segunda temporada.",
  },

  lawn_care: {
    checklist: [
      "Recoja el césped — juguetes, mangueras, platos del perro, muebles y todo lo que haya sobre el pasto. Lo que estorba se rodea, y lo que está oculto en el pasto alto se pasa por encima.",
      "Recoja lo del perro. Cortamos a través de lo que encontramos, y termina en la cortadora, en nosotros y en sus paredes.",
      "Abra el portón lateral, o dénos el código, y díganos si algún portón debe quedar cerrado por una mascota.",
      "Marque lo que esté bajo y sea difícil de ver — una boquilla de riego, una planta nueva, una piedra de paso en el pasto.",
      "Avísenos de cualquier zona a dejar — un parche de flores silvestres, un cantero que está sembrando.",
    ],
    warning:
      "Todo lo que quede en el pasto será golpeado. Una manguera, un juguete o una boquilla de riego bajo una cuchilla es una pieza rota y una visita interrumpida. Recorra el césped antes de que lleguemos.",
    dayOf: [
      "Cortamos, perfilamos los bordes y soplamos las superficies duras. Un tratamiento, si su cotización lo incluye, se aplica después del corte; dejamos una banderita y una nota para mantenerse fuera.",
    ],
    afterCare:
      "Mantenga a mascotas y niños fuera de un césped tratado hasta que seque, o el tiempo que indique la banderita. Riegue según el calendario que le demos, no todos los días.",
  },

  irrigation: {
    checklist: [
      "Abra el agua de los grifos exteriores y del suministro de riego, y díganos dónde están el preventor de reflujo y el controlador.",
      "Gestione la localización de servicios para una instalación nueva, o confirme que lo hacemos nosotros.",
      "Marque los canteros y plantas que quiera proteger, y avísenos de todo lo que sepa que hay enterrado.",
      "Díganos qué zonas no funcionan, y cómo — un parche seco, inundación, una boquilla que no sube.",
      "Mascotas adentro mientras las zanjas estén abiertas.",
    ],
    warning:
      "En una instalación nueva, el césped se zanjea y el pasto se levanta a lo largo de cada línea. Se repone y se recupera en semanas con riego, pero parecerá excavado un tiempo. Manténgase fuera de las líneas de zanja hasta que se asienten.",
    dayOf: [
      "En una reparación, probamos cada zona, encontramos la falla, la arreglamos y corremos el sistema. En una instalación, zanjeamos, tendemos la tubería, colocamos las boquillas, cableamos el controlador y corremos cada zona con usted presente.",
    ],
    afterCare:
      "Deje correr el horario programado una semana antes de cambiarlo, y avísenos si una zona está seca o inundada. Haga purgar el sistema antes de la primera helada — es lo único que evita que una tubería reviente.",
  },

  tree_care_service: {
    checklist: [
      "Saque los autos de la entrada y aléjelos de debajo del árbol — las ramas caen donde deben, no donde conviene.",
      "Despeje el suelo bajo el árbol — muebles, macetas, juguetes, el trampolín — y cubra lo que no se pueda mover.",
      "Avise a sus vecinos si el árbol está cerca del lindero, y díganos de cualquier rama sobre su propiedad.",
      "Abra portones lo bastante anchos para la chipeadora, y díganos dónde soplar las astillas o si se van con nosotros.",
      "Mascotas y niños adentro durante toda la visita. Cortar en altura es el único trabajo en que nadie cruza la zona.",
    ],
    warning:
      "Nadie bajo el árbol mientras estemos en él — ni para ir al auto. Acordonamos la zona de caída y le pedimos quedarse fuera de ella, del primer corte al último.",
    dayOf: [
      "Acordonamos la zona de caída, subimos o usamos la plataforma, y bajamos el árbol por secciones o podamos según el plan de su cotización. Las ramas se chipean sobre la marcha y la leña se corta a las medidas que pidió o se retira.",
      "La chipeadora es ruidosa. Un derribo completo es un día entero de ruido.",
    ],
    afterCare:
      "Manténgase fuera de un tocón recién triturado hasta que se rellene. Vigile un árbol podado durante la siguiente temporada; algo de secado en una rama cortada es normal, una rama entera que muere no lo es — avísenos.",
  },

  snow_removal: {
    checklist: [
      "Coloque estacas a lo largo de los bordes de la entrada, el césped y los canteros antes de la primera nevada, o pídanoslo — una vez cubiertos, nadie los ve.",
      "Meta los autos al garaje o a la calle antes de una tormenta. Un auto en la entrada es una entrada que no podemos despejar.",
      "Díganos dónde se puede apilar la nieve y dónde no — ni sobre el séptico, ni contra el hidrante, ni del lado del vecino.",
      "Mantenga mangueras, contenedores y juguetes fuera de la entrada durante la temporada; un contenedor bajo la nieve es un contenedor doblado.",
      "Avísenos de cualquier superficie de la entrada que no tolere una pala mecánica — adoquines, una sección calefactada, un sellador nuevo.",
    ],
    warning:
      "Venimos cuando la nieve alcanza el espesor de su plan, en el orden de la ruta. Un auto en la entrada cuando llegamos significa que despejamos alrededor, no debajo, y no volvemos por ese espacio hasta la próxima tormenta.",
    dayOf: [
      "Despejamos las zonas de su plan, apilamos la nieve donde acordamos, y salamos o echamos arena en los senderos si su plan lo incluye. Escalones y senderos se despejan a mano cuando su plan los incluye.",
    ],
    afterCare:
      "Avísenos al deshielo de cualquier marca en el césped o un adoquín movido; lo reparamos en primavera.",
  },

  pest_control: {
    checklist: [
      "Guarde comida, platos, platos de mascotas y todo lo que haya en las encimeras; cubra o retire lo que haya en una despensa abierta.",
      "Despeje bajo los fregaderos y a lo largo de las paredes donde los zócalos tocan el piso — ahí es donde tratamos.",
      "Cuéntenos de las mascotas y dónde estarán — las peceras en particular deben cubrirse y la bomba apagarse durante una aplicación.",
      "Avísenos de cualquier persona en la casa embarazada, asmática o sensible a los químicos, para elegir el producto y el momento.",
      "Cuente con salir de las habitaciones tratadas, o de la casa, el tiempo que le indiquemos ese día.",
    ],
    warning:
      "Las habitaciones tratadas quedan fuera de uso el tiempo que le demos, y las mascotas y los niños se quedan fuera hasta que el tratamiento seque. Un tratamiento pisado es un tratamiento que no funciona y hay que repetir.",
    dayOf: [
      "Inspeccionamos primero, le decimos qué encontramos y dónde, y luego tratamos según el plan de su cotización. Las estaciones de cebo y los monitores se etiquetan y se dejan en su lugar; no los mueva.",
    ],
    afterCare:
      "No lave las zonas tratadas el tiempo que le indiquemos. Espere ver más actividad uno o dos días — es el tratamiento actuando. Avísenos si sigue viéndolos después del plazo que le dimos; el seguimiento es parte del trabajo.",
  },

  pool_spa: {
    checklist: [
      "Despeje la terraza de la piscina de muebles y juguetes donde tengamos que trabajar, y abra el portón del área.",
      "Asegúrese de que la plataforma de equipo — bomba, filtro, calentador — sea accesible, y díganos dónde está el corte de corriente.",
      "Díganos qué ha notado — una fuga, agua turbia, un error en el calentador, una bomba ruidosa.",
      "Mantenga el nivel del agua donde debe estar, salvo que le hayamos pedido bajarlo para el trabajo.",
      "Mascotas y niños fuera del área de la piscina durante la visita.",
    ],
    warning:
      "Después de un tratamiento químico nadie se baña hasta que se alcancen los niveles que le indiquemos. Medimos antes de irnos y le decimos cuándo es seguro — espérelo.",
    dayOf: [
      "Analizamos el agua, inspeccionamos el equipo, hacemos el trabajo de su cotización y corremos el sistema un ciclo antes de irnos. Todo lo que encontremos fuera de la cotización se le muestra y se cotiza antes de hacerse.",
    ],
    afterCare:
      "Mantenga la bomba funcionando el tiempo que le indiquemos después de un tratamiento. Vigile los niveles los primeros días y avísenos si derivan.",
  },

  dog_walking: {
    checklist: [
      "Deje la correa, el arnés, una toalla y los premios donde acordamos, y díganos si el perro lleva algo más — un bozal, un abrigo, una luz.",
      "Dénos acceso — una llave, un código, una caja de seguridad — y díganos cómo funciona la alarma y dónde espera el perro cuando usted no está.",
      "Cuéntenos del perro: cómo es con otros perros, con niños, con extraños en la puerta, y qué lo asusta.",
      "Díganos de la comida y los medicamentos si alguno cae durante la visita, y dónde se guardan.",
      "Deje el número de su veterinario y un contacto de emergencia.",
    ],
    warning:
      "Un perro enfermo, lesionado o en celo se queda en casa — avísenos antes de la visita. Si al llegar el perro no puede pasear con seguridad, la visita se convierte en una revisión y se cobra igual.",
    dayOf: [
      "Llegamos a la hora acordada, hacemos la ruta acordada el tiempo acordado, limpiamos las patas, renovamos el agua y dejamos una nota o un mensaje de cómo fue.",
    ],
    afterCare:
      "Avísenos de cualquier cambio — un medicamento nuevo, un miedo nuevo, un perro nuevo al lado — antes del próximo paseo, no después.",
  },

  pooper_scooper: {
    checklist: [
      "Abra el portón o dénos el código, y mantenga a los perros adentro mientras estamos en el jardín.",
      "Recoja juguetes y mangueras de las zonas que atendemos; es mucho más rápido en un césped despejado.",
      "Díganos qué zonas cubrir y cuáles saltar — el huerto, el lado del vecino.",
      "Díganos dónde dejar la bolsa, o si se va con nosotros.",
    ],
    warning:
      "Un perro suelto en el jardín cuando llegamos significa que no podemos entrar, y la visita se cobra. Manténgalos adentro hasta que nos hayamos ido.",
    dayOf: [
      "Recorremos todo el jardín en cuadrícula, embolsamos lo que encontramos, tratamos la zona si su plan lo incluye, y cerramos el portón al salir.",
    ],
    afterCare:
      "Nada que hacer. Avísenos si la salud de los perros cambia — lo que encontramos suele ser la primera señal.",
  },
};
