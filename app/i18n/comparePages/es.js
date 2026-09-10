// app/i18n/comparePages/es.js
//
// Spanish for /compare — 204 strings, tuteo, same register as the rest of the
// marketing catalogue. Vocabulary is inherited rather than invented:
// "presupuesto" (quote), "cuadrilla" (crew), "puesto" (billable seat),
// "camioneta" (van), "recepcionista con IA", "complemento" (add-on). Quotes are
// « » because featurePages/es.js already settled on them; the em dashes stay.
//
// The availability words changed SHAPE, deliberately. English gets "The feature
// is {availability}" for all five values because "is" swallows a preposition
// and a noun alike; Spanish would have to pick ser or estar and would break on
// one of them. So compare.availability.* are verb phrases here and the three
// carrier sentences — featureOnThisTier, receptionistLowerDown, ourAvailability
// — were rebuilt around them. The five stay five: "included" and
// "includedUsageExtra" are as far apart here as en.js insists they be.
//
// The concessions are what a reviewer should check first, and they are as
// narrow as the English on purpose: unverifiedConcessionNote says we did not
// check, never that they lack it. Nothing was widened to read better.
//
// Known rough edge: thisListFrom and currencyNotTheirs interpolate a provenance
// fragment built in English elsewhere, so they read half-Spanish until that
// module is translated too. Left parallel to en.js rather than papered over.

const es = {
  "compare.eyebrow": "Comparativa",
  "compare.indexTitle": "Compara FieldQuo",
  "compare.indexLede": "Cinco comparativas, cada una armada con lo que la otra empresa publica en su propio sitio. Aquí nada se convierte de una moneda a otra, nada es un precio promocional, y todo lo que no pudimos resolver se dice en vez de adivinarse. Una de las cinco empieza más barata que nosotros, y esa página lo dice antes que cualquier otra cosa.",
  "compare.rulesTitle": "Cómo están armadas estas páginas",
  "compare.entryGapTitle": "Ellos empiezan más baratos que nosotros",
  "compare.entryGapIntro": "No todas las comparativas de este sitio nos favorecen, y esta no. Los dos precios de abajo son la cifra que ellos publican y nuestro peldaño más barato, ambos sacados de los mismos registros que usa el resto de la página.",
  "compare.entryGapTheirListIntro": "Lo que su propia página incluye en ese plan, con sus palabras:",
  "compare.entryGapAdvice": "Si ese es el trabajo que necesitas hacer, compra el de ellos. Preferimos escribirlo aquí a venderle a alguien más software del que usa y volver a verlo en el reembolso. Lo que cambia la respuesta es tener cuadrilla: sus planes cuentan cada acceso como un usuario de pago, y los nuestros no.",
  "compare.theirTiersTitle": "Lo que suma cada uno de sus planes, con sus palabras",
  "compare.theirTiersIntro": "Sus propias descripciones de sus propios niveles, citadas tal como las presenta su página y puestas junto al precio al que llega cada una. No hemos traducido nada de eso a nuestro vocabulario: rebautizar la función de un competidor para que coincida con una nuestra es la manera de que una comparativa se convierta, sin ruido, en un hombre de paja. Así que las palabras de abajo son suyas, y la lista de las nuestras va más abajo en esta página, aparte.",
  "compare.theirTiersNoMatchNote": "Nadie ha establecido, función por función, cuál de sus niveles lleva cuál de las capacidades que nosotros vendemos. Su página describe sus planes en prosa y nuestra investigación no registra ninguna respuesta nivel por nivel, así que esta página no hace ninguna afirmación de equivalencia en ninguna de las dos direcciones — lee su lista, lee la nuestra, y decide.",
  "compare.matchUnknownIntro": "Nadie ha establecido cuál de sus niveles lleva esto, así que esta página no nombra ninguno. Eso no es una afirmación de que no lo tengan — no lo comprobamos, y una página que trata lo que no comprobó como una ausencia es una página inventando cosas.",
  "compare.aiMeteringTitle": "Cómo mide su IA cada lado",
  "compare.aiMeteringIntro": "La suya se vende como una cuota mensual que cambia según el nivel, impresa en su propia página. La nuestra no se vende así, y la versión honesta de esa frase tiene dos mitades.",
  "compare.aiMeteringOurs": "FieldQuo no vende IA por crédito: no hay una cuota por plan en nuestra página de precios que se pueda agotar, ni un paquete más grande al que subirse. La recepcionista va en todos los planes, con el tiempo de conversación comprado aparte como crédito prepagado y sin mínimo mensual, así que un mes sin llamadas no cuesta nada por ella. La otra mitad, que también va aquí: el uso del modelo se mide por empresa contra un tope que fijamos internamente, así que nada en esta página está afirmando que sea ilimitado.",
  "compare.concessionTitle": "Lo que FieldQuo no hace",
  "compare.concessionIntro": "Esta sección está en todas estas páginas, en el mismo lugar, encima de la parte donde quedamos bien. Una tabla comparativa hecha solo con nuestras victorias le vende a alguien una suscripción por la que va a pedir su dinero de vuelta.",
  "compare.unverifiedConcessionNote": "No hemos comprobado si esta empresa lo ofrece, así que no estamos diciendo que lo haga.",
  "compare.staleClaimNote": "Esa lectura tiene más de tres meses, así que cualquier cifra que haya dentro queda retenida hasta que alguien vuelva a revisar su página. Sigue el enlace y mira qué dice hoy.",
  "compare.advantageTitle": "Dónde FieldQuo va por delante",
  "compare.advantageIntro": "Cada uno de estos se leyó en su propia página en la fecha indicada. Sigue el enlace y compruébalo — para eso está el enlace.",
  "compare.priceTitle": "El precio, tal como lo publica cada empresa",
  "compare.featuresTitle": "Lo que obtienes con FieldQuo",
  "compare.featuresIntro": "Cada línea de abajo es una función con una implementación detrás. La lista se genera del mismo registro contra el que corren las comprobaciones de ingeniería, así que una función que deja de funcionar deja de anunciarse.",
  "compare.ctaTitle": "Primer mes gratis con una tarjeta registrada, y puedes leer el precio antes de empezar",
  "compare.ctaBody": "No hay que agendar ninguna llamada, y el precio está en la página de precios y no detrás de un formulario. La tarjeta se pide al registrarte y no se cobra hasta que termina el mes gratis.",
  "compare.ctaButton": "Empieza tu mes gratis",
  "compare.ctaSecondary": "Ver los precios",
  "compare.otherPagesTitle": "Las otras comparativas",
  "compare.rule.1": "Cada precio es el precio normal que la empresa imprime en su propia página de precios. Los precios de oferta se quedan fuera: una página como esta se arma una vez y se sirve durante meses, y no tiene manera de enterarse de que una promoción terminó.",
  "compare.rule.2": "El dinero se queda en la moneda en la que se publicó. Nunca convertimos. Un tipo de cambio es correcto el día que lo consultas y equivocado al siguiente, y una cifra convertida sentada en una página estática es una cuenta que nadie está revisando.",
  "compare.rule.3": "Donde no pudimos resolver qué significaba una cifra, la fila lo dice y no muestra ningún número. Eso pasa más de lo que esperarías, y es la parte de la página en la que más confianza tenemos.",
  "compare.rule.4": "Cada cifra lleva la fecha en que se leyó y el país desde el que se leyó, porque un precio puede cambiar por las dos cosas.",

  "compare.lede.jobber": "Jobber vende su paquete de marketing, su recepcionista con IA y su embudo de ventas como complementos mensuales aparte — $177 al mes encima de un plan cuyo precio ya se mueve con el tamaño de tu equipo. FieldQuo pone los tres en todos los planes, a cualquier precio, y todo el que anda en la camioneta es gratis.",
  "compare.concession.jobber": "Empecemos por lo que no tenemos. FieldQuo es una aplicación web: no hay nada que instalar desde una tienda de apps, nada funciona sin señal, y no hay un vendedor que te lo enseñe paso a paso.",
  "compare.lede.housecall_pro": "Housecall Pro cobra por cada usuario extra, así que el precio del plan es solo donde empieza tu factura. FieldQuo cobra por la gente que de verdad le pone precio al trabajo — presupuestos, trabajos, facturas — y todo el que anda en la camioneta es cuadrilla, sin costo. Todas las funciones están en todos los planes, desde $99.",
  "compare.concession.housecall_pro": "Primero la parte honesta. La página de Housecall Pro incluye como estándar una app de teléfono, acceso sin conexión y una demo guiada. FieldQuo no tiene ninguna de las tres, y si alguna de ellas te decide, ellos son la mejor compra.",
  "compare.lede.servicetitan": "La página de precios de ServiceTitan no lleva una cifra en dólares por ningún lado — agendas una demo y el número se negocia contra tus ingresos y tu plantilla. Los contratistas reportan cuotas mensuales por técnico encima de un cargo de implementación de cinco cifras y un contrato de varios años. Todos los precios de FieldQuo están en esta página, no hay cuota de puesta en marcha, y puedes empezar esta noche sin hablar con nadie.",
  "compare.concession.servicetitan": "Lo que no podemos ofrecer, dicho primero: sin app de teléfono, sin nada que funcione fuera de la red, y sin nadie que te dé un recorrido guiado antes de que decidas.",
  "compare.lede.projul": "Projul pide un compromiso anual fijo por adelantado. FieldQuo cuesta $99 al mes por un puesto y cinco de cuadrilla, con todas las funciones incluidas, y te puedes ir al final de cualquier mes — no tienes que comprar un año para averiguar si te sirve.",
  "compare.concession.projul": "Antes de todo lo demás: FieldQuo no tiene app de teléfono, no funciona sin señal, y no tiene a nadie que te lo vaya a demostrar. Projul sí te agenda una demo.",
  "compare.lede.quoteiq": "QuoteIQ empieza en $29.99, y ese plan no te puede armar un sitio web, ni tomar una reserva, ni dejar que un dueño de casa le ponga precio a su propio trabajo. El plan de QuoteIQ que lleva lo que FieldQuo pone en todos los planes es su nivel Max, a $699 al mes. El nuestro cuesta $99 — y cuarenta y una cosas de nuestra lista no están en su catálogo a ningún precio.",
  "compare.concession.quoteiq": "El precio primero, porque es lo que viniste a comprobar. QuoteIQ empieza por debajo de nuestro plan más barato, trae apps de teléfono que nosotros no tenemos, y te agenda un recorrido. FieldQuo es una aplicación web y no trae vendedor.",

  "compare.counterpoint.projul.monthly_billing": "Su página defiende el plan anual, y el argumento es justo: Projul dice que su precio no lleva cuota por usuario ni tope en el número de proyectos. A un taller que suma gente seguido puede convenirle más quedarse ahí.",

  "compare.capability.mobile_app": "App móvil nativa (iOS / Android)",
  "compare.capability.offline_use": "Funciona sin conexión",
  "compare.capability.self_serve_demo": "Agendar una demo guiada con un vendedor",
  "compare.capability.accounting_sync": "Sincronización en los dos sentidos con QuickBooks o Xero",
  "compare.capability.gantt_charts": "Diagramas de Gantt y cronogramas de proyecto enlazados",
  "compare.capability.purchase_orders": "Órdenes de compra a proveedores",
  "compare.capability.daily_logs": "Bitácoras diarias de obra",
  "compare.capability.geofencing": "Geolocalización y registro de entrada con geocerca",
  "compare.capability.field_worker_quotes": "La cuadrilla puede poner precio y enviar un presupuesto desde la camioneta",
  "compare.capability.entry_price_below_our_floor": "Un plan de pago por debajo del peldaño más barato de FieldQuo",
  "compare.capability.ai_receptionist_no_monthly_floor": "Recepcionista telefónica con IA en todos los planes, sin mínimo mensual",
  "compare.capability.self_serve_signup": "Registrarte y empezar sin hablar con nadie",
  "compare.capability.published_price": "Precio publicado abiertamente, sin llamada de ventas",
  "compare.capability.monthly_billing": "Pago mensual, sin compromiso anual obligatorio",
  "compare.capability.free_crew_seats": "Cuadrilla incluida gratis — solo se cobra a quien origina dinero",

  "compare.teamSize.solo": "Solo yo",
  "compare.teamSize.2-5": "2-5 personas",
  "compare.teamSize.6-10": "6-10 personas",
  "compare.teamSize.11-15": "11-15 personas",
  "compare.teamSize.16-plus": "16 o más",
  "compare.billing.annual_prepaid": "Anual, prepagado",
  "compare.billing.monthly_1yr": "Mensual, compromiso de 1 año",
  "compare.billing.monthly_none": "Mensual, sin compromiso",

  "compare.comparableFeature.ai_receptionist": "Recepcionista telefónica con IA",

  // ── The index page ──────────────────────────────────────────────────────
  "compare.vs": "FieldQuo frente a {competitor}",
  "compare.preparedAsOf": "Preparado con datos al {date}.",
  "compare.preparedAsOfLong": "Preparado con datos al {date}. Cada cifra de abajo lleva además el día en que se leyó y el país desde el que se leyó.",
  "compare.readComparison": "Leer la comparativa",

  // What one card may claim, assembled in ../../(marketing)/compare/summary.js.
  "compare.summary.amountsSourced": "{count} de los precios que publican se pueden poner junto a los nuestros, en la moneda en la que ellos los imprimen.",
  "compare.summary.amounts": "{count} de los precios que publican se pueden poner junto a los nuestros.",
  "compare.summary.asserted": "{count} de esos no nombran ninguna moneda en su propia página, así que la comparativa dice de quién es el criterio sobre la moneda en vez de imprimirla como si fuera suya.",
  "compare.summary.onRequest": "{count} de sus niveles no publican ninguna cifra y te piden que la solicites.",
  "compare.summary.none": "Nada de lo que publican se puede comparar con un precio de FieldQuo.",
  "compare.summary.withheldOne": "{count} cifra más queda retenida, mostrada con su motivo.",
  "compare.summary.withheld": "{count} cifras más quedan retenidas, cada una mostrada con su motivo.",

  // ── How a price reads ───────────────────────────────────────────────────
  //
  // {currency} is a code and {ask} is their button's own words: both arrive
  // already decided and neither is translated. {per} is resolved through
  // compare.per.* below, because "per month" with an English preposition inside
  // a Spanish sentence is what this whole change is fixing.
  "compare.price.amount": "${amount} {currency} por {per}",
  "compare.price.free": "Gratis ({currency})",
  "compare.price.onRequest": "Sin precio publicado — su página dice «{ask}»",
  "compare.price.notOffered": "No se vende a este tamaño",
  "compare.per.month": "mes",
  "compare.per.year": "año",
  "compare.pricePerMonth": "${amount} al mes",
  "compare.and": " y ",

  // ── How a feature's availability reads ──────────────────────────────────
  //
  // included and includedUsageExtra must NEVER collapse into one sentence.
  // Ours is the second: the receptionist is on every plan and the talk time is
  // prepaid credit, so "incluida" beside our price would be a false claim about
  // our own price to somebody who then meets a top-up on their first call.
  // All five are verb phrases in Spanish — see the file header.
  "compare.availability.included": "entra en el precio del plan",
  "compare.availability.includedUsageExtra": "entra en todos los planes, con el tiempo de conversación comprado aparte como crédito prepagado",
  "compare.availability.addOn": "es un complemento de pago encima del plan",
  "compare.availability.absent": "no está en ese nivel",
  "compare.availability.unknown": "está sin establecer",

  // ── The price section ───────────────────────────────────────────────────
  "compare.tierSeatsOne": "{seats} puesto, más {crew} de cuadrilla sin costo",
  "compare.tierSeats": "{seats} puestos, más {crew} de cuadrilla sin costo",
  "compare.sameNumberBothCurrencies": "La misma cifra en cada moneda en la que vendemos ({currencies}) — ${price} en cada una es un precio real de FieldQuo, así que aquí nada tiene que convertirse para que cuadren. En qué moneda se te cobra sale de la dirección comercial que das al registrarte.",
  "compare.soldIn": "Se vende en {currencies}.",
  "compare.nothingPublishable": "No hay nada en la página de precios de {competitor} que podamos publicar como precio. Cada cifra que tenemos aparece abajo con el motivo por el que se retiene.",
  "compare.usersIncludedOne": "{count} usuario incluido",
  "compare.usersIncluded": "{count} usuarios incluidos",
  "compare.unlimitedUsers": "Usuarios ilimitados, así que no hay número de puestos que comparar",
  "compare.currencyNotTheirs": "La cifra es suya, sacada de su propia página. La moneda no: {provenance}",
  "compare.withheldCountOne": "{count} precio más de {competitor} no se muestra aquí — o la lectura ya caducó, o no pudimos resolver qué significaba la cifra publicada. Preferimos dejar una fila fuera a imprimir un número que no podemos sostener.",
  "compare.withheldCount": "{count} precios más de {competitor} no se muestran aquí — o la lectura ya caducó, o no pudimos resolver qué significaba la cifra publicada. Preferimos dejar una fila fuera a imprimir un número que no podemos sostener.",

  // ── Their ladder, in their own words ────────────────────────────────────
  "compare.addsOverTier": "Suma sobre el nivel de abajo:",
  "compare.onThisTier": "En este nivel:",
  "compare.aiCreditsTier": "Su página indica {count} créditos de IA al mes en este nivel.",
  "compare.thisListFrom": "Esta lista {provenance}",
  "compare.creditsAMonth": "{count} créditos al mes",

  // ── The receptionist panel ──────────────────────────────────────────────
  "compare.receptionistTitle": "{feature}: lo que cuesta de cada lado",
  "compare.receptionistIntro": "Los niveles se emparejan por lo que contienen, no por dónde quedan en una tabla. Este es el nivel más barato de {competitor} que verificamos que de verdad lo lleva.",
  "compare.receptionistUnknownIntro": "Esta no la podemos responder para {competitor}.",
  "compare.featureOnThisTier": "En este nivel, la función {availability}.",
  "compare.receptionistLowerDown": "Más abajo en su gama, la función {availability}: {price}{at}. Ese es un piso que pagas en un mes en el que el teléfono nunca suena.",
  "compare.atCoordinates": " en {coordinates}",
  "compare.ourAvailability": "La función {availability}. Un mes sin llamadas no cuesta nada por ella.",
  "compare.theirWordsNotOurs": "Sus planes están descritos en su página con sus propias palabras, y esta comparativa no va a leer esas palabras como si fueran las nuestras. Su lista está arriba, sin editar, y es lo que hay que ir a comprobar en su propio sitio.",

  // ── Where we are ahead, and where we are not ────────────────────────────
  "compare.readOnTheirSite": "Leído en su sitio el {checked}",
  "compare.theySay": "{competitor} dice: «{claim}».",
  "compare.entryOursNothingBelowOne": "{seats} puesto, más {crew} de cuadrilla sin costo. No hay nada por debajo.",
  "compare.entryOursNothingBelow": "{seats} puestos, más {crew} de cuadrilla sin costo. No hay nada por debajo.",

  // ── The head-to-head ────────────────────────────────────────────────────
  "compare.case.eyebrow": "Lado a lado",
  "compare.case.headlineOurs": "Todo lo que hace FieldQuo cuesta {price}.",
  "compare.case.headlineTheirs": "En {competitor} la misma lista cuesta {price}.",
  "compare.case.headlineNoPricesOurs": "FieldQuo publica todos sus precios.",
  "compare.case.headlineNoPricesTheirs": "{competitor} no publica ninguno.",
  "compare.case.sub": "No vendemos funciones por nivel. Todos los planes tienen todas las funciones — los planes solo se diferencian por cuánta gente hay en ellos.",
  "compare.case.missingOne": "{count} cosa más que {competitor} no ofrece a ningún precio.",
  "compare.case.missing": "{count} cosas más que {competitor} no ofrece a ningún precio.",
  "compare.case.missingBody": "Todas están en el plan {plan}, a {price}.",
  "compare.case.shopTitle": "Lo que cuesta para un taller como el tuyo",
  "compare.case.shopIntro": "{competitor} cobra por cada acceso. Nosotros cobramos por la gente que le pone precio al trabajo; todo el que anda en la camioneta es cuadrilla, sin costo. Esa diferencia crece con cada persona que contratas.",
  "compare.case.shop1": "Tú y dos en la camioneta",
  "compare.case.shop2": "Dos presupuestando, cuatro en la calle",
  "compare.case.shop3": "Un taller de once",
  "compare.case.shopSplit": "{estimators} poniendo precios · {crew} en la calle",
  "compare.case.youKeep": "te ahorras",
  "compare.case.cheaperThere": "Con una sola persona, allá sale más barato.",
  "compare.case.calcBefore": "Pon tus propios números en la",
  "compare.case.calcLink": "calculadora de costos",
  "compare.case.calcAfter": "y mira las cinco lado a lado.",
  "compare.case.wholeTitle": "Todo lo que obtienes, en todos los planes",
  "compare.case.wholeIntro": "No es un resumen de lo mejor — es el producto entero, y si aparece o no en algún lugar de los planes de {competitor}.",
  "compare.case.both": "Los dos",
  "compare.case.only": "Solo FieldQuo",

  // ── The head-to-head rows ───────────────────────────────────────────────
  "compare.rows.perMo": "{amount}/mes",
  "compare.rows.perYr": "{amount}/año",
  "compare.rows.usersOne": "{count} usuario",
  "compare.rows.users": "{count} usuarios",
  "compare.rows.unlimitedUsers": "usuarios ilimitados",
  "compare.rows.cheapestPlan": "Plan más barato",
  "compare.rows.soloSub": "{plan} — 1 puesto, {crew} de cuadrilla gratis",
  "compare.rows.annualEquivalent": "{plan} — equivalente a {amount} al mes, facturado por año",
  "compare.rows.tierUsers": "{plan} — {users}",
  "compare.rows.parityLabel": "Plan más barato con lo que FieldQuo pone en todos los planes",
  "compare.rows.paritySub": "El mismo plan. No reservamos funciones por nivel.",
  "compare.rows.parityAnnual": "{plan} — equivalente a {amount} al mes",
  "compare.rows.parityTheirs": "{plan} — sus planes más baratos no lo llevan",
  "compare.rows.publishedPrice": "Precio publicado",
  "compare.rows.everyPlanOnThisPage": "Todos los planes, en esta página",
  "compare.rows.nonePublished": "Ninguno publicado",
  "compare.rows.bookDemo": "Agenda una demo; el número se negocia en la llamada",
  "compare.rows.whatItCosts": "Lo que cuesta",
  "compare.rows.oneToTwentyFive": "De 1 a 25 personas",
  "compare.rows.reportedNotPublished": "reportado por contratistas, no publicado",
  "compare.rows.setupFee": "Cuota de puesta en marcha",
  // Gender-neutral on purpose: caseRows.js prints this cell against both
  // "Cuota de puesta en marcha" (fem.) and "complementos de pago" (masc.).
  "compare.rows.none": "No hay",
  "compare.rows.reported": "reportado",
  "compare.rows.howYouPay": "Cómo pagas",
  "compare.rows.monthly": "Mensual",
  "compare.rows.leaveAnyMonth": "Te vas al final de cualquier mes",
  "compare.rows.aYearUpFront": "{amount} al año, por adelantado",
  "compare.rows.noMonthlyOption": "No ofrecen opción mensual — así lo dice su FAQ",
  "compare.rows.paidAddOns": "Se venden como complementos de pago",
  "compare.rows.everyFeature": "Todas las funciones están en todos los planes, al precio del plan",
  "compare.rows.plusPerMo": "+{amount}/mes",
  "compare.rows.peopleInField": "Gente en la calle",
  "compare.rows.free": "Gratis",
  "compare.rows.crewFreeSub": "La cuadrilla ve la agenda y el trabajo sin costo",
  "compare.rows.billed": "Se cobra",
  "compare.rows.everyLoginPaid": "En {competitor} cada acceso es un usuario de pago",
  "compare.rows.biggestPlan": "Plan más grande",
  "compare.rows.biggestSub": "{seats} puestos más {crew} de cuadrilla — 25 personas",
  "compare.rows.onRequest": "A solicitud",
  "compare.rows.everyPlan": "Todos los planes",
  "compare.rows.tierAtPrice": "{plan} — {amount}/mes",
  "compare.rows.theirCheapestWithIt": "su plan más barato que lo incluye",
  "compare.rows.notInTheirPlans": "No está en sus planes",
  "compare.rows.freeTrial": "Prueba gratis",
  "compare.rows.firstMonthFree": "Primer mes gratis",
  "compare.rows.noCardCharged": "No se cobra la tarjeta hasta que termina",
  "compare.rows.trialOffered": "Ofrecen prueba",
  "compare.rows.seeTheirSite": "consulta su sitio para ver las condiciones de hoy",

  // ── The add-on stack ────────────────────────────────────────────────────
  //
  // Rendered on /compare/fieldquo-vs-jobber AND on /pricing. These were the
  // keys the owner's report was actually about: the block had t() calls with
  // English fallbacks and no catalogue entries behind them, so every language
  // fell through to English and "the 3 things jobber charges extra for and
  // below" stayed in English on an otherwise translated page.
  "addOns.title": "{count} cosas por las que {competitor} cobra aparte",
  "addOns.intro": "Estas van encima del plan en su propia página de precios, cada una con su precio mensual. Cada una de ellas es trabajo que FieldQuo hace dentro del plan que ya estás pagando.",
  "addOns.scope": "Leímos el nombre y el precio en su página de precios, y nada más. Lo que hay dentro de su complemento no es algo que hayamos comprobado, así que nada de lo de abajo lo describe.",
  "addOns.money": "${amount} {currency} por {per}",
  "addOns.provenance": "Leído desde una conexión de {country} el {checked}",
  "addOns.sourceLink": "su página de precios",
  "addOns.oursTitle": "En FieldQuo, en todos los planes:",
  "addOns.limits": "Dónde termina:",
  "addOns.total": "{total} {currency} al mes, encima del precio del plan.",
  "addOns.totalBody": "Eso es lo que cuestan esas tres juntas en el punto de sus propios selectores donde las leímos. En FieldQuo esos mismos tres trabajos van en todos los planes, a cualquier tamaño, desde el más barato de esta página.",
  "addOns.receptionist": "Su complemento de recepcionista es un piso mensual: se cobra en un mes en el que el teléfono nunca suena. El nuestro no tiene mínimo mensual. La función va en todos los planes y el tiempo de conversación es crédito prepagado que compras cuando lo necesitas, así que un febrero tranquilo no cuesta nada por ella.",

  // ── /pricing's own line under the add-on stack ──────────────────────────
  //
  // Referenced by PricingPlans.js since the block was written and never
  // defined, which is the second half of the same reported bug.
  "pricing.addOnsCompare": "Cada cifra de arriba se leyó en su propia página de precios, en la fecha indicada. La comparativa completa lado a lado, incluido lo que FieldQuo no hace, está aquí →",
};

export default es;
