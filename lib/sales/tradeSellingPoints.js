// lib/sales/tradeSellingPoints.js
//
// What FieldQuo sells to each trade — the ONE list every pitch surface reads.
//
// ══ The owner's ask, 2026-09-19 ═══════════════════════════════════════════
//
// "Each trade should have the selling points for that, right? Electricians
// should include the self-booking, the paid booking, and scheduling, similar
// to plumbers; while roofers is the selling points for them, and painters
// too." Until this file, the per-trade argument lived in five places that
// could not agree: the intro email's trade phrase, the four playbooks'
// English fit lines, the demo presets, the twelve marketing industry pages
// and whatever the call-script model inferred from "Trade: roofing". A rep
// switching from the queue to the email to the demo read three different
// pitches for one roofer. AGENTS.md failure class 4 — the copy that rots is
// the one nobody re-reads — so this is now one table and five readers.
//
// ══ A selling point is a feature-matrix row, or it does not exist ════════
//
// AGENTS.md's first rule, "never ship a control that appears to work and
// doesn't", has a spoken form: a selling point that names a feature FieldQuo
// does not have. So every entry's `key` is a lib/marketing/featureMatrix.js
// key, and scripts/check-trade-selling-points.mjs refuses one whose row is
// not `readiness: "shipped"`. That is why financing is not on the roofer's
// list although a roofer's ticket is exactly where pay-over-time sells: the
// matrix has it as `partial` (Stripe offers it at checkout, we do not show a
// monthly figure unless the contractor typed a rate), and a rep saying "we
// finance the roof" would be selling the half that is not there. The
// research behind each trade's list, and the pains with no shipped answer,
// are in docs/research/trade-selling-points.md — the "not yet" list lives in
// the DOC, never in a pitch.
//
// ══ Shape ════════════════════════════════════════════════════════════════
//
//   tradeSellingPoints("roofing", "fr") →
//     [{ key, headline, oneLiner, proof }, …]   ordered, best first
//
//   headline  what the rep or the page calls it — four to six words
//   oneLiner  the benefit in one sentence, in the trade's own words
//   proof     a concrete sentence a rep can SAY: "a roof measured from the
//             satellite in under a minute, no ladder". Concrete means a thing
//             the prospect can picture, not an adjective.
//
// The words are held in a POINT library keyed by matrix row, with a
// per-trade proof where the generic one would be a lie of vagueness — the
// roofer's satellite measure and the paver's traced driveway are the same
// matrix row and are not the same sentence. A trade lists keys, in order,
// and overrides what it must. One table of words per feature; thirty-seven
// lists of keys.
//
// ══ Three languages, English the fallback that says so ═══════════════════
//
// The three a rep can sell in (lib/sales/intel/callScript.js SCRIPT_LANGUAGES):
// Quebec French with "vous", "soumission", "cellulaire"; neutral Latin-
// American Spanish with "usted". Any other code returns English with
// `fallback: true`, the shape lib/sales/playbook/turnaround.js uses, so a
// screen can say which it is showing instead of pretending.
//
// ══ No digits ════════════════════════════════════════════════════════════
//
// The talking-point gate (lib/sales/playbook/talkingPoints.js) refuses a
// figure in an AI sentence, and these sentences are fed to the call-script
// model as material. A digit here would be echoed back and refused, or worse,
// read out as a fact. "Under a minute" and "two minutes" are spelled; the
// check asserts no digit anywhere.
//
// Pure. No imports except the two key tables it is checked against.

import { DISCOVERY_TRADES } from "@/lib/sales/discovery/trades";

/** The languages a pitch is written in. */
export const TRADE_PITCH_LANGUAGES = Object.freeze(["en", "fr", "es"]);
export const TRADE_PITCH_DEFAULT_LANGUAGE = "en";

/** How many a surface shows by default — the call, the email, the page. */
export const TRADE_PITCH_TOP = 3;

const L = (en, fr, es) => Object.freeze({ en, fr, es });

/**
 * The words for each matrix row, in the register the rep speaks.
 *
 * Every key here is asserted to be a `shipped` row of the feature matrix by
 * scripts/check-trade-selling-points.mjs. A key added here for a row that is
 * `partial` fails the build — that is the whole point of the file.
 */
export const POINTS = Object.freeze({
  booking_page: Object.freeze({
    headline: L("Clients book you online", "Vos clients réservent en ligne", "Sus clientes reservan en línea"),
    oneLiner: L(
      "A homeowner picks a slot from your real availability, with travel time built in, without ringing you.",
      "Le client choisit une plage dans vos vraies disponibilités, temps de route compris, sans vous appeler.",
      "El cliente elige un horario dentro de su disponibilidad real, con el tiempo de traslado incluido, sin llamarlo.",
    ),
    proof: L(
      "They book the visit from your website at nine at night; you see it on your calendar in the morning.",
      "Ils réservent la visite depuis votre site à neuf heures le soir; vous la voyez au calendrier le matin.",
      "Reservan la visita desde su sitio a las nueve de la noche; usted la ve en su calendario por la mañana.",
    ),
  }),
  booking_deposit: Object.freeze({
    headline: L("A paid visit at booking", "Une visite payée à la réservation", "Una visita pagada al reservar"),
    oneLiner: L(
      "Charge the call-out fee when they book, and it comes off the invoice when the work goes ahead.",
      "Le frais de déplacement est facturé à la réservation et déduit de la facture si les travaux se font.",
      "Cobre la visita al reservar y se descuenta de la factura si el trabajo sigue adelante.",
    ),
    proof: L(
      "No more driving across town to a door that does not open — the visit is paid before you leave.",
      "Fini les déplacements vers une porte qui ne s'ouvre pas : la visite est payée avant votre départ.",
      "Se acabó cruzar la ciudad hacia una puerta que no se abre: la visita está pagada antes de salir.",
    ),
  }),
  scheduling: Object.freeze({
    headline: L("Dispatch from one calendar", "La répartition sur un seul calendrier", "Despacho desde un solo calendario"),
    oneLiner: L(
      "Visits on the calendar, the person going assigned, and the whole crew's week on one screen.",
      "Les visites au calendrier, la personne assignée, et la semaine de toute l'équipe sur un écran.",
      "Las visitas en el calendario, la persona asignada y la semana de toda la cuadrilla en una pantalla.",
    ),
    proof: L(
      "Drag the job onto tomorrow, pick who goes, and the client and the tech both have it on their phone.",
      "Glissez le travail à demain, choisissez qui y va, et le client comme le technicien l'ont sur leur cellulaire.",
      "Arrastre el trabajo a mañana, elija quién va, y el cliente y el técnico lo tienen en el celular.",
    ),
  }),
  voice_receptionist: Object.freeze({
    headline: L("Your phone answered on a ladder", "Votre téléphone répond quand vous êtes sur l'échelle", "Su teléfono contesta mientras está en la escalera"),
    oneLiner: L(
      "An assistant answers when you cannot, takes the details, books the visit and leaves you the recording.",
      "Un assistant répond quand vous ne pouvez pas, prend les détails, réserve la visite et vous laisse l'enregistrement.",
      "Un asistente contesta cuando usted no puede, toma los datos, reserva la visita y le deja la grabación.",
    ),
    proof: L(
      "The call you missed at two in the afternoon is a booked visit and a recording by the time you are in the van.",
      "L'appel manqué à deux heures est une visite réservée et un enregistrement avant que vous soyez dans le camion.",
      "La llamada que perdió a las dos de la tarde ya es una visita reservada y una grabación cuando sube a la camioneta.",
    ),
  }),
  call_to_quote: Object.freeze({
    headline: L("The call becomes a draft quote", "L'appel devient un brouillon de soumission", "La llamada se vuelve un borrador de cotización"),
    oneLiner: L(
      "What the caller described comes back as a draft quote you open, correct and send.",
      "Ce que l'appelant a décrit revient en brouillon de soumission que vous ouvrez, corrigez et envoyez.",
      "Lo que describió quien llamó vuelve como borrador de cotización que usted abre, corrige y envía.",
    ),
    proof: L(
      "They describe the panel over the phone; you open a quote with the lines already on it.",
      "Ils décrivent le panneau au téléphone; vous ouvrez une soumission avec les lignes déjà dessus.",
      "Describen el tablero por teléfono; usted abre una cotización con las líneas ya puestas.",
    ),
  }),
  card_payments: Object.freeze({
    headline: L("Paid by card on the spot", "Payé par carte sur place", "Cobro con tarjeta en el momento"),
    oneLiner: L(
      "A pay-now button on the invoice; the client pays from their phone and the money lands in your account.",
      "Un bouton payer sur la facture; le client paie de son cellulaire et l'argent arrive dans votre compte.",
      "Un botón de pago en la factura; el cliente paga desde el celular y el dinero llega a su cuenta.",
    ),
    proof: L(
      "You finish the job, send the invoice from the driveway, and they have paid before you pull away.",
      "Vous finissez le travail, envoyez la facture de l'entrée, et c'est payé avant que vous repartiez.",
      "Termina el trabajo, envía la factura desde la entrada y ya pagaron antes de que arranque.",
    ),
  }),
  invoice_send: Object.freeze({
    headline: L("The invoice, sent from the van", "La facture, envoyée du camion", "La factura, enviada desde la camioneta"),
    oneLiner: L(
      "Emailed from your address with a link to the invoice and a pay-now button inside.",
      "Envoyée de votre adresse avec un lien vers la facture et un bouton payer dedans.",
      "Enviada desde su dirección con un enlace a la factura y un botón de pago adentro.",
    ),
    proof: L(
      "The invoice goes out the moment the job is marked done — nothing typed up that evening.",
      "La facture part au moment où le travail est marqué terminé — rien à taper ce soir-là.",
      "La factura sale en cuanto el trabajo se marca terminado; nada que escribir esa noche.",
    ),
  }),
  price_book: Object.freeze({
    headline: L("Your rates, priced once", "Vos tarifs, saisis une fois", "Sus tarifas, cargadas una vez"),
    oneLiner: L(
      "Your services and rates in one place, so every quote is assembled from them and never typed from memory.",
      "Vos services et vos tarifs à un seul endroit; chaque soumission s'assemble à partir d'eux, jamais de mémoire.",
      "Sus servicios y tarifas en un solo lugar; cada cotización se arma desde ahí, nunca de memoria.",
    ),
    proof: L(
      "The service call, the hourly rate and the panel upgrade are lines you tap, at the price you set.",
      "L'appel de service, le taux horaire et le panneau sont des lignes que vous touchez, au prix que vous avez fixé.",
      "La visita, la tarifa por hora y el cambio de tablero son líneas que usted toca, al precio que fijó.",
    ),
  }),
  self_quote: Object.freeze({
    headline: L("They price it from photos", "Ils décrivent le travail avec des photos", "Describen el trabajo con fotos"),
    oneLiner: L(
      "A public form where the homeowner describes the job and uploads photos; it arrives as a started quote.",
      "Un formulaire public où le client décrit le travail et joint des photos; ça arrive en soumission déjà commencée.",
      "Un formulario público donde el cliente describe el trabajo y sube fotos; llega como cotización ya empezada.",
    ),
    proof: L(
      "The photos of the tree and the fence are on the quote before you have driven out to look.",
      "Les photos de l'arbre et de la clôture sont sur la soumission avant même que vous alliez voir.",
      "Las fotos del árbol y la cerca están en la cotización antes de que vaya a mirar.",
    ),
  }),
  instant_quotes: Object.freeze({
    headline: L("An instant price on your site", "Un prix instantané sur votre site", "Un precio al instante en su sitio"),
    oneLiner: L(
      "A visitor answers a few questions and gets a price range on the spot, from rates you set.",
      "Un visiteur répond à quelques questions et obtient une fourchette de prix sur-le-champ, selon vos tarifs.",
      "Un visitante responde unas preguntas y recibe un rango de precio al instante, con las tarifas que usted fijó.",
    ),
    proof: L(
      "The homeowner has a range from you the same evening, while the other quotes are still a week out.",
      "Le client a votre fourchette le soir même, pendant que les autres soumissions sont encore à une semaine.",
      "El cliente tiene su rango esa misma noche, mientras las otras cotizaciones aún tardan una semana.",
    ),
  }),
  quotes: Object.freeze({
    headline: L("A quote built in the driveway", "Une soumission montée dans l'entrée", "Una cotización armada en la entrada"),
    oneLiner: L(
      "Build the quote from your own rates, grouped by room or scope, with the photos on it, before you leave.",
      "Montez la soumission à partir de vos tarifs, par pièce ou par étape, avec les photos, avant de partir.",
      "Arme la cotización con sus tarifas, por habitación o por etapa, con las fotos, antes de irse.",
    ),
    proof: L(
      "Measured, priced and on their phone while you are still parked outside.",
      "Mesurée, tarifée et sur leur cellulaire pendant que vous êtes encore stationné devant.",
      "Medida, con precio y en su celular mientras usted sigue estacionado afuera.",
    ),
  }),
  online_approval: Object.freeze({
    headline: L("Approved and signed from their phone", "Approuvée et signée de leur cellulaire", "Aprobada y firmada desde su celular"),
    oneLiner: L(
      "The client opens a link, ticks any extras, signs, and the job is on — no printing, no phone tag.",
      "Le client ouvre un lien, coche les extras, signe, et le travail est lancé — rien à imprimer, pas de chassé-croisé.",
      "El cliente abre un enlace, marca los extras, firma y el trabajo arranca; nada que imprimir, sin llamadas cruzadas.",
    ),
    proof: L(
      "The signed approval is in your inbox while you are still on the next roof.",
      "L'approbation signée est dans votre boîte pendant que vous êtes déjà sur le toit suivant.",
      "La aprobación firmada está en su bandeja mientras usted ya está en el siguiente techo.",
    ),
  }),
  add_on_upsell: Object.freeze({
    headline: L("Extras the client ticks", "Des extras que le client coche", "Extras que el cliente marca"),
    oneLiner: L(
      "Optional extras at the bottom of the quote, priced from your own history, that the client ticks themselves.",
      "Des options au bas de la soumission, tarifées selon votre historique, que le client coche lui-même.",
      "Extras opcionales al pie de la cotización, con precios de su propio historial, que el cliente marca solo.",
    ),
    proof: L(
      "They tick the ceilings and the trim on their own phone and the total moves before your eyes.",
      "Ils cochent les plafonds et les boiseries sur leur cellulaire et le total bouge sous vos yeux.",
      "Marcan los techos y las molduras en su celular y el total cambia a la vista.",
    ),
  }),
  job_photos: Object.freeze({
    headline: L("Before and after, on the job", "Avant et après, sur le dossier", "Antes y después, en el trabajo"),
    oneLiner: L(
      "Photos filed against the job, ready to go on the quote, the invoice or your website.",
      "Les photos classées au dossier, prêtes pour la soumission, la facture ou votre site.",
      "Fotos archivadas en el trabajo, listas para la cotización, la factura o su sitio.",
    ),
    proof: L(
      "The before photo and the after photo sit on the same invoice the homeowner pays from.",
      "La photo d'avant et celle d'après sont sur la même facture que le client paie.",
      "La foto de antes y la de después están en la misma factura que paga el cliente.",
    ),
  }),
  material_costs: Object.freeze({
    headline: L("Materials counted from the measure", "Les matériaux calculés à partir de la mesure", "Materiales calculados desde la medida"),
    oneLiner: L(
      "What a litre of paint or a bundle of shingle costs you, and how much of it a job this size eats.",
      "Ce qu'un litre de peinture ou un paquet de bardeaux vous coûte, et combien un travail de cette taille en mange.",
      "Lo que le cuesta un litro de pintura o un paquete de tejas, y cuánto consume un trabajo de este tamaño.",
    ),
    proof: L(
      "The squares come off the roof measure and the bundles come off the squares — nothing counted twice.",
      "Les carrés viennent de la mesure du toit et les paquets viennent des carrés — rien compté deux fois.",
      "Los cuadrados salen de la medida del techo y los paquetes salen de los cuadrados; nada se cuenta dos veces.",
    ),
  }),
  aerial_measure: Object.freeze({
    headline: L("Measured from the sky", "Mesuré du ciel", "Medido desde el cielo"),
    oneLiner: L(
      "Type the address and get the roof area and pitch, or trace a driveway or patio, without going out there.",
      "Tapez l'adresse et obtenez la surface et la pente du toit, ou tracez une entrée ou un patio, sans vous déplacer.",
      "Escriba la dirección y obtenga el área y la pendiente del techo, o trace una entrada o un patio, sin ir al lugar.",
    ),
    proof: L(
      "A roof measured from the satellite in under a minute, no ladder.",
      "Un toit mesuré par satellite en moins d'une minute, sans échelle.",
      "Un techo medido desde el satélite en menos de un minuto, sin escalera.",
    ),
  }),
  kitchen_designer: Object.freeze({
    headline: L("The kitchen drawn and priced", "La cuisine dessinée et tarifée", "La cocina dibujada y cotizada"),
    oneLiner: L(
      "Draw the run, pick the finishes, and the cabinet prices and the floor plan go straight into the quote.",
      "Dessinez le tracé, choisissez les finis, et les prix des armoires et le plan vont droit dans la soumission.",
      "Dibuje la línea, elija los acabados, y los precios de los gabinetes y el plano entran directo en la cotización.",
    ),
    proof: L(
      "The homeowner watches the plan appear at the table and leaves with the price on their phone.",
      "Le client regarde le plan apparaître à la table et repart avec le prix sur son cellulaire.",
      "El cliente ve aparecer el plano en la mesa y se va con el precio en el celular.",
    ),
  }),
  recurring_jobs: Object.freeze({
    headline: L("Repeat work books itself", "Le travail récurrent se replanifie seul", "El trabajo recurrente se agenda solo"),
    oneLiner: L(
      "Weekly, monthly or seasonal work that puts itself back on the calendar, with the same crew.",
      "Le travail hebdomadaire, mensuel ou saisonnier se remet au calendrier tout seul, avec la même équipe.",
      "El trabajo semanal, mensual o de temporada vuelve solo al calendario, con la misma cuadrilla.",
    ),
    proof: L(
      "Every lawn on this week's run is already on next week's — nobody rebooks them by hand.",
      "Chaque pelouse de la tournée de cette semaine est déjà à la semaine prochaine — personne ne les replanifie à la main.",
      "Cada jardín de la ruta de esta semana ya está en la próxima; nadie los vuelve a agendar a mano.",
    ),
  }),
  service_plans: Object.freeze({
    headline: L("Plans charged on schedule", "Des forfaits facturés automatiquement", "Planes cobrados en fecha"),
    oneLiner: L(
      "Sign a client up to a recurring plan and the card is charged on schedule without you asking.",
      "Inscrivez un client à un forfait récurrent et la carte est débitée à la date prévue, sans que vous demandiez.",
      "Inscriba al cliente en un plan recurrente y la tarjeta se cobra en fecha sin que usted lo pida.",
    ),
    proof: L(
      "The annual tune-up is a plan, the card is on file, and the money arrives without a single invoice chased.",
      "L'entretien annuel est un forfait, la carte est au dossier, et l'argent arrive sans une seule facture à courir.",
      "El mantenimiento anual es un plan, la tarjeta está guardada y el dinero llega sin perseguir una sola factura.",
    ),
  }),
  checklists: Object.freeze({
    headline: L("The same standard, whoever goes", "Le même standard, peu importe qui y va", "El mismo estándar, vaya quien vaya"),
    oneLiner: L(
      "A list of what has to be done on site, ticked off by the person doing it, on their phone.",
      "La liste de ce qui doit être fait sur place, cochée par la personne qui le fait, sur son cellulaire.",
      "La lista de lo que hay que hacer en el sitio, marcada por quien lo hace, desde su celular.",
    ),
    proof: L(
      "The new hire ticks the same list the owner would, and you see what was skipped before the client does.",
      "La recrue coche la même liste que le patron, et vous voyez ce qui a été sauté avant le client.",
      "El nuevo marca la misma lista que el dueño, y usted ve lo que se saltó antes que el cliente.",
    ),
  }),
  crew_shifts: Object.freeze({
    headline: L("Next week's rota, published", "L'horaire de la semaine prochaine, publié", "El turno de la próxima semana, publicado"),
    oneLiner: L(
      "Build next week's shifts, publish them, and everyone sees their own on their phone.",
      "Montez les quarts de la semaine prochaine, publiez-les, et chacun voit les siens sur son cellulaire.",
      "Arme los turnos de la próxima semana, publíquelos y cada quien ve los suyos en el celular.",
    ),
    proof: L(
      "Nobody texts you the night before asking where they are in the morning.",
      "Personne ne vous texte la veille pour savoir où il est le lendemain matin.",
      "Nadie le escribe la noche anterior preguntando dónde está por la mañana.",
    ),
  }),
  job_costing: Object.freeze({
    headline: L("What the job actually made", "Ce que le travail a vraiment rapporté", "Lo que el trabajo realmente dejó"),
    oneLiner: L(
      "Labour, materials and expenses against the price you quoted, so you know what you made on it.",
      "La main-d'œuvre, les matériaux et les dépenses contre le prix soumis, pour savoir ce que ça vous a laissé.",
      "Mano de obra, materiales y gastos contra el precio cotizado, para saber cuánto le dejó.",
    ),
    proof: L(
      "The basement that felt profitable and the one that was — side by side, before you price the next one.",
      "Le sous-sol qui semblait rentable et celui qui l'était — côte à côte, avant de soumettre le prochain.",
      "El sótano que parecía rentable y el que sí lo fue, lado a lado, antes de cotizar el siguiente.",
    ),
  }),
  work_areas: Object.freeze({
    headline: L("A big job, split by room", "Un gros chantier, découpé par pièce", "Un trabajo grande, dividido por zona"),
    oneLiner: L(
      "Break a job into rooms or zones and hand each one to a different person, with its own progress.",
      "Découpez le chantier en pièces ou en zones et confiez chacune à quelqu'un, avec son propre avancement.",
      "Divida el trabajo en zonas y asigne cada una a una persona distinta, con su propio avance.",
    ),
    proof: L(
      "The kitchen is done, the bathroom is half done, and you can see it without driving over.",
      "La cuisine est finie, la salle de bain à moitié, et vous le voyez sans vous déplacer.",
      "La cocina está lista, el baño a la mitad, y usted lo ve sin ir hasta allá.",
    ),
  }),
  invoice_changes: Object.freeze({
    headline: L("Changes tracked, never disputed", "Les changements suivis, jamais contestés", "Cambios registrados, nunca en disputa"),
    oneLiner: L(
      "Amend an issued invoice and the old one is kept, so there is never a question about what was agreed.",
      "Modifiez une facture émise et l'ancienne est conservée; plus jamais de doute sur ce qui a été convenu.",
      "Modifique una factura emitida y la anterior se conserva; nunca hay duda de lo que se acordó.",
    ),
    proof: L(
      "The extra outlet they asked for mid-job is a new line on a new version, and the first version is still there.",
      "La prise ajoutée en cours de chantier est une ligne sur une nouvelle version, et la première est toujours là.",
      "El enchufe extra que pidieron a mitad de obra es una línea en una versión nueva, y la primera sigue ahí.",
    ),
  }),
  subcontractor_bids: Object.freeze({
    headline: L("Your subs on the job", "Vos sous-traitants au dossier", "Sus subcontratistas en el trabajo"),
    oneLiner: L(
      "Keep the companies you hire on file, put one on a job at an agreed price, and track what you pay them.",
      "Gardez les entreprises que vous engagez au dossier, mettez-en une sur un chantier au prix convenu, et suivez ce que vous leur payez.",
      "Tenga a las empresas que contrata en archivo, ponga una en un trabajo al precio acordado y registre lo que les paga.",
    ),
    proof: L(
      "The plumber's price is on the job before the client's price is, so the margin is known on day one.",
      "Le prix du plombier est au dossier avant celui du client, alors la marge est connue dès le premier jour.",
      "El precio del plomero está en el trabajo antes que el del cliente, así que el margen se conoce desde el día uno.",
    ),
  }),
  contract_terms: Object.freeze({
    headline: L("Your terms on every document", "Vos conditions sur chaque document", "Sus condiciones en cada documento"),
    oneLiner: L(
      "Payment terms and contract wording that attach themselves to what you send.",
      "Les conditions de paiement et le texte du contrat s'attachent d'eux-mêmes à ce que vous envoyez.",
      "Las condiciones de pago y el texto del contrato se adjuntan solos a lo que envía.",
    ),
    proof: L(
      "The deposit clause is on the quote they sign, and you never pasted it in.",
      "La clause d'acompte est sur la soumission qu'ils signent, et vous ne l'avez jamais collée.",
      "La cláusula del anticipo está en la cotización que firman, y usted nunca la pegó.",
    ),
  }),
  review_requests: Object.freeze({
    headline: L("One polite ask for a review", "Une demande d'avis, polie et automatique", "Una petición de reseña, cortés y automática"),
    oneLiner: L(
      "After the job is marked done, the client gets one polite ask for a review.",
      "Une fois le travail marqué terminé, le client reçoit une seule demande d'avis, polie.",
      "Cuando el trabajo se marca terminado, el cliente recibe una sola petición cortés de reseña.",
    ),
    proof: L(
      "The review comes in the evening the driveway was washed, while they are still pleased with it.",
      "L'avis arrive le soir même où l'entrée a été lavée, pendant qu'ils en sont encore contents.",
      "La reseña llega la misma noche en que se lavó la entrada, mientras todavía están contentos.",
    ),
  }),
  materials: Object.freeze({
    headline: L("Materials on the job", "Les matériaux au dossier", "Los materiales en el trabajo"),
    oneLiner: L(
      "What went on site, what it cost, and what is still to buy — on the job, not on a receipt in the van.",
      "Ce qui est allé sur le chantier, ce que ça a coûté, et ce qui reste à acheter — au dossier, pas sur un reçu dans le camion.",
      "Lo que llegó a la obra, lo que costó y lo que falta comprar; en el trabajo, no en un recibo en la camioneta.",
    ),
    proof: L(
      "The posts and the panels are counted against the fence before the invoice, not after.",
      "Les poteaux et les panneaux sont comptés contre la clôture avant la facture, pas après.",
      "Los postes y los paneles se cuentan contra la cerca antes de la factura, no después.",
    ),
  }),
  clients: Object.freeze({
    headline: L("Every client and every property", "Chaque client et chaque propriété", "Cada cliente y cada propiedad"),
    oneLiner: L(
      "Every client, their properties and their history, imported from wherever it lives now.",
      "Chaque client, ses propriétés et son historique, importés d'où qu'ils soient aujourd'hui.",
      "Cada cliente, sus propiedades y su historial, importados desde donde estén hoy.",
    ),
    proof: L(
      "Open the address and see the last three visits before you knock.",
      "Ouvrez l'adresse et voyez les trois dernières visites avant de cogner.",
      "Abra la dirección y vea las últimas tres visitas antes de tocar la puerta.",
    ),
  }),
});

/** A proof sentence that is only true, or only vivid, for one trade. */
const P = (key, proof) => Object.freeze({ key, proof });

/**
 * The lists. Keys in order, best first; the first three are what the call,
 * the email and the page say. A `P(key, proof)` entry keeps the library's
 * headline and one-liner and swaps the proof for the trade's own.
 *
 * Every DISCOVERY_TRADES key has a list, asserted by the check — a trade with
 * no list would fall to the intro email's generic eight, which is the
 * failure this file replaces.
 */
export const TRADE_SELLING_POINTS = Object.freeze({
  // ── The service trades: the call, the visit, the money ──────────────────
  electrical: Object.freeze([
    "booking_page",
    "booking_deposit",
    "scheduling",
    "voice_receptionist",
    "call_to_quote",
    P("card_payments", L(
      "The panel is in, the invoice is sent from the basement, and it is paid before you are up the stairs.",
      "Le panneau est posé, la facture part du sous-sol, et c'est payé avant que vous remontiez l'escalier.",
      "El tablero está instalado, la factura sale desde el sótano y ya está pagada antes de subir la escalera.",
    )),
    "price_book",
  ]),
  plumbing: Object.freeze([
    "booking_page",
    P("booking_deposit", L(
      "The diagnostic fee is paid when they book the leak, so the wasted trip is the one thing you never do.",
      "Le frais de diagnostic est payé quand ils réservent pour la fuite; le déplacement pour rien n'arrive plus.",
      "La visita de diagnóstico se paga al reservar por la fuga, así que el viaje en vano es lo único que ya no hace.",
    )),
    "scheduling",
    "voice_receptionist",
    "card_payments",
    P("self_quote", L(
      "The photo of the water heater and its label is on the quote before you have been to the house.",
      "La photo du chauffe-eau et de son étiquette est sur la soumission avant même votre visite.",
      "La foto del calentador y su etiqueta está en la cotización antes de que vaya a la casa.",
    )),
  ]),
  hvac: Object.freeze([
    P("service_plans", L(
      "The furnace tune-up is a yearly plan on a card on file — the visit books itself and the money arrives on its own.",
      "L'entretien de la fournaise est un forfait annuel sur une carte au dossier — la visite se réserve seule et l'argent arrive tout seul.",
      "El mantenimiento de la caldera es un plan anual con tarjeta guardada; la visita se agenda sola y el dinero llega solo.",
    )),
    "booking_page",
    "scheduling",
    "voice_receptionist",
    "card_payments",
    P("clients", L(
      "Open the address and see the furnace you put in and every visit since, before the tech rings the bell.",
      "Ouvrez l'adresse et voyez la fournaise que vous avez posée et chaque visite depuis, avant que le technicien sonne.",
      "Abra la dirección y vea la caldera que instaló y cada visita desde entonces, antes de que el técnico toque el timbre.",
    )),
  ]),
  appliance_repair: Object.freeze([
    "booking_page",
    "booking_deposit",
    "scheduling",
    "voice_receptionist",
    "card_payments",
  ]),
  locksmith: Object.freeze([
    P("voice_receptionist", L(
      "The lockout call at eleven at night is answered, the address taken, and the job on your phone — you decide whether to go.",
      "L'appel pour la porte barrée à onze heures du soir est répondu, l'adresse prise, le travail sur votre cellulaire — vous décidez d'y aller ou non.",
      "La llamada por la puerta cerrada a las once de la noche se contesta, se toma la dirección y el trabajo llega a su celular; usted decide si va.",
    )),
    "booking_page",
    "scheduling",
    "card_payments",
    "invoice_send",
  ]),
  garage_door: Object.freeze([
    "booking_page",
    "booking_deposit",
    P("quotes", L(
      "The door is measured on its own card in the builder, and the price is on their phone before you leave the driveway.",
      "La porte est mesurée sur sa propre fiche dans l'outil, et le prix est sur leur cellulaire avant que vous quittiez l'entrée.",
      "La puerta se mide en su propia tarjeta del armador, y el precio está en su celular antes de salir de la entrada.",
    )),
    "scheduling",
    "card_payments",
  ]),
  handyman: Object.freeze([
    "booking_page",
    "self_quote",
    "scheduling",
    "card_payments",
    P("price_book", L(
      "The hourly rate and the half-day rate are two lines you tap, so the quote for a punch list takes a minute.",
      "Le taux horaire et le tarif demi-journée sont deux lignes que vous touchez; la soumission pour une liste de petits travaux prend une minute.",
      "La tarifa por hora y la de medio día son dos líneas que toca; la cotización de una lista de arreglos toma un minuto.",
    )),
  ]),
  home_inspection: Object.freeze([
    "booking_page",
    P("booking_deposit", L(
      "The inspection fee is paid when the buyer books, so the slot is held and the no-show costs them, not you.",
      "Les frais d'inspection sont payés quand l'acheteur réserve; la plage est tenue et l'absence lui coûte à lui, pas à vous.",
      "La inspección se paga cuando el comprador reserva, así que el turno queda apartado y la ausencia le cuesta a él, no a usted.",
    )),
    "scheduling",
    "job_photos",
    "card_payments",
  ]),
  chimney: Object.freeze([
    "booking_page",
    "booking_deposit",
    P("recurring_jobs", L(
      "The annual sweep puts itself back on the calendar next autumn, for every chimney you did this one.",
      "Le ramonage annuel se remet au calendrier l'automne prochain, pour chaque cheminée faite cette année.",
      "La limpieza anual vuelve sola al calendario el próximo otoño, para cada chimenea que hizo este año.",
    )),
    "service_plans",
    "card_payments",
  ]),
  pest_control: Object.freeze([
    P("service_plans", L(
      "The quarterly treatment is a plan on a card on file; the visit books itself and nobody chases the payment.",
      "Le traitement trimestriel est un forfait sur une carte au dossier; la visite se réserve seule et personne ne court après le paiement.",
      "El tratamiento trimestral es un plan con tarjeta guardada; la visita se agenda sola y nadie persigue el pago.",
    )),
    "recurring_jobs",
    "booking_page",
    "scheduling",
    "card_payments",
    P("clients", L(
      "Open the address and see every treatment done there, and what was found, before you knock.",
      "Ouvrez l'adresse et voyez chaque traitement fait là, et ce qui a été trouvé, avant de cogner.",
      "Abra la dirección y vea cada tratamiento hecho ahí, y lo que se encontró, antes de tocar.",
    )),
  ]),
  pool_spa: Object.freeze([
    P("service_plans", L(
      "The weekly pool service is a plan charged on schedule — the opening and the closing are jobs on the calendar already.",
      "L'entretien hebdomadaire de la piscine est un forfait facturé à date fixe — l'ouverture et la fermeture sont déjà au calendrier.",
      "El servicio semanal de la piscina es un plan cobrado en fecha; la apertura y el cierre ya son trabajos en el calendario.",
    )),
    "recurring_jobs",
    "booking_page",
    "scheduling",
    "card_payments",
  ]),
  irrigation: Object.freeze([
    P("recurring_jobs", L(
      "Spring start-up and autumn blow-out for every system you installed are on next year's calendar the day you finish this one.",
      "La mise en marche du printemps et la purge d'automne de chaque système installé sont au calendrier de l'an prochain le jour où vous finissez celui-ci.",
      "El arranque de primavera y el soplado de otoño de cada sistema instalado están en el calendario del próximo año el día que termina este.",
    )),
    "service_plans",
    "booking_page",
    "scheduling",
    "card_payments",
  ]),

  // ── The measured trades: the estimate is the sale ──────────────────────
  roofing: Object.freeze([
    P("aerial_measure", L(
      "A roof measured from the satellite in under a minute, no ladder — area, pitch and the facets on the still.",
      "Un toit mesuré par satellite en moins d'une minute, sans échelle — la surface, la pente et les pans sur l'image.",
      "Un techo medido desde el satélite en menos de un minuto, sin escalera: área, pendiente y aguas sobre la imagen.",
    )),
    P("instant_quotes", L(
      "The homeowner types their address on your site and has a price range from you before the storm chasers have knocked.",
      "Le client tape son adresse sur votre site et a votre fourchette avant que les colporteurs aient cogné.",
      "El cliente escribe su dirección en su sitio y tiene su rango de precio antes de que toquen los cazatormentas.",
    )),
    "online_approval",
    P("material_costs", L(
      "The squares come off the satellite measure and the bundles, the underlayment and the drip edge come off the squares.",
      "Les carrés viennent de la mesure satellite, et les paquets, la membrane et le larmier viennent des carrés.",
      "Los cuadrados salen de la medida satelital y los paquetes, la membrana y el goterón salen de los cuadrados.",
    )),
    "job_photos",
    "card_payments",
  ]),
  painting: Object.freeze([
    P("quotes", L(
      "Room by room, walls and ceilings measured on the card, priced from your own rate — on their phone before you leave.",
      "Pièce par pièce, murs et plafonds mesurés sur la fiche, tarifés à votre taux — sur leur cellulaire avant votre départ.",
      "Habitación por habitación, paredes y techos medidos en la tarjeta, con su tarifa; en su celular antes de irse.",
    )),
    P("add_on_upsell", L(
      "Ceilings, trim and the second coat are ticks at the bottom of the quote; they tick them, and the total moves.",
      "Les plafonds, les boiseries et la deuxième couche sont des cases au bas de la soumission; ils cochent, et le total bouge.",
      "Los techos, las molduras y la segunda mano son casillas al pie de la cotización; las marcan y el total cambia.",
    )),
    "job_photos",
    "instant_quotes",
    "online_approval",
    P("material_costs", L(
      "The litres come off the square footage you measured, at the price you pay for the can.",
      "Les litres viennent de la surface que vous avez mesurée, au prix que vous payez le gallon.",
      "Los litros salen de los metros que midió, al precio que usted paga la lata.",
    )),
  ]),
  cabinets: Object.freeze([
    "kitchen_designer",
    P("price_book", L(
      "A price per door and per drawer front, so twenty-four doors is one line and the quote is done at the table.",
      "Un prix par porte et par façade de tiroir; vingt-quatre portes font une ligne et la soumission est finie à la table.",
      "Un precio por puerta y por frente de cajón; veinticuatro puertas son una línea y la cotización se termina en la mesa.",
    )),
    P("add_on_upsell", L(
      "The glaze, the soft-close hinges and the new hardware are ticks the client makes on their own phone.",
      "Le glacis, les charnières à fermeture douce et la nouvelle quincaillerie sont des cases que le client coche sur son cellulaire.",
      "El glaseado, las bisagras de cierre suave y los herrajes nuevos son casillas que el cliente marca en su celular.",
    )),
    "instant_quotes",
    "job_photos",
    "online_approval",
  ]),
  countertops: Object.freeze([
    "instant_quotes",
    P("quotes", L(
      "The run is measured on the countertop card, the sink cut-out and the edge are lines, and the price is on their phone at the table.",
      "Le comptoir est mesuré sur sa fiche, la découpe d'évier et le fini de bord sont des lignes, et le prix est sur leur cellulaire à la table.",
      "La encimera se mide en su tarjeta, el corte del fregadero y el borde son líneas, y el precio está en su celular en la mesa.",
    )),
    "online_approval",
    "job_photos",
    "card_payments",
  ]),
  flooring: Object.freeze([
    "instant_quotes",
    P("quotes", L(
      "Each room is measured on the flooring card, the stairs by the step, and the quote is on their phone before you leave.",
      "Chaque pièce est mesurée sur la fiche plancher, l'escalier à la marche, et la soumission est sur leur cellulaire avant votre départ.",
      "Cada habitación se mide en la tarjeta de pisos, la escalera por escalón, y la cotización está en su celular antes de irse.",
    )),
    "add_on_upsell",
    "online_approval",
    "materials",
  ]),
  tiling: Object.freeze([
    "quotes",
    P("add_on_upsell", L(
      "The niche, the heated floor and the schluter edge are ticks on the quote the client makes themselves.",
      "La niche, le plancher chauffant et le profilé de finition sont des cases que le client coche lui-même.",
      "El nicho, el piso radiante y el perfil de borde son casillas que el cliente marca solo.",
    )),
    "job_photos",
    "online_approval",
    "materials",
  ]),
  gutters: Object.freeze([
    P("aerial_measure", L(
      "The eaves are measured off the satellite still — the linear feet and the downspouts — without a ladder against the house.",
      "Les gouttières sont mesurées sur l'image satellite — les pieds linéaires et les descentes — sans échelle contre la maison.",
      "Los aleros se miden sobre la imagen satelital, los pies lineales y las bajadas, sin escalera contra la casa.",
    )),
    "instant_quotes",
    "booking_page",
    P("recurring_jobs", L(
      "The autumn clean-out goes back on the calendar for every house you did this year.",
      "Le nettoyage d'automne se remet au calendrier pour chaque maison faite cette année.",
      "La limpieza de otoño vuelve al calendario para cada casa que hizo este año.",
    )),
    "card_payments",
  ]),
  siding: Object.freeze([
    P("quotes", L(
      "Each elevation is measured on the siding card, the windows taken out, and the price is on their phone from the driveway.",
      "Chaque façade est mesurée sur la fiche revêtement, les fenêtres déduites, et le prix est sur leur cellulaire depuis l'entrée.",
      "Cada fachada se mide en la tarjeta de revestimiento, se descuentan las ventanas, y el precio está en su celular desde la entrada.",
    )),
    "job_photos",
    "online_approval",
    "material_costs",
    "card_payments",
  ]),
  insulation: Object.freeze([
    P("quotes", L(
      "The attic is measured on its own card, the depth and the type are lines, and the quote leaves with you.",
      "Le grenier est mesuré sur sa propre fiche, l'épaisseur et le type sont des lignes, et la soumission part avec vous.",
      "El ático se mide en su propia tarjeta, el espesor y el tipo son líneas, y la cotización sale con usted.",
    )),
    "self_quote",
    "online_approval",
    "card_payments",
    "job_photos",
  ]),
  paving: Object.freeze([
    P("aerial_measure", L(
      "Trace the driveway on the satellite still and the square footage is on the quote — no wheel, no visit.",
      "Tracez l'entrée sur l'image satellite et la superficie est sur la soumission — pas de roulette, pas de visite.",
      "Trace la entrada sobre la imagen satelital y los metros están en la cotización; sin rueda, sin visita.",
    )),
    "instant_quotes",
    "online_approval",
    "card_payments",
    "job_photos",
  ]),
  masonry_concrete: Object.freeze([
    P("self_quote", L(
      "They send a photo of the crumbling parging or the cracked step; the quote starts with the photos on it, before the visit.",
      "Ils envoient une photo du crépi qui s'effrite ou de la marche fendue; la soumission commence avec les photos dessus, avant la visite.",
      "Mandan una foto del revoque desprendido o del escalón partido; la cotización empieza con las fotos, antes de la visita.",
    )),
    "instant_quotes",
    "quotes",
    "job_photos",
    "online_approval",
  ]),
  excavation: Object.freeze([
    P("quotes", L(
      "The dig is a volume, the haul is a count of loads, the machine is a day rate — three lines, priced on the lot.",
      "Le creusage est un volume, le transport un nombre de voyages, la machine un tarif à la journée — trois lignes, tarifées sur le terrain.",
      "La excavación es un volumen, el acarreo un conteo de viajes, la máquina una tarifa por día; tres líneas, cotizadas en el lote.",
    )),
    "self_quote",
    "job_costing",
    "materials",
    "invoice_send",
  ]),
  snow_removal: Object.freeze([
    P("recurring_jobs", L(
      "Every driveway on the contract is a job that comes back with every storm, for the crew that has that run.",
      "Chaque entrée sous contrat est un travail qui revient à chaque tempête, pour l'équipe qui a cette tournée.",
      "Cada entrada bajo contrato es un trabajo que vuelve con cada tormenta, para la cuadrilla que tiene esa ruta.",
    )),
    P("service_plans", L(
      "The season contract is a plan charged on schedule; the card is on file in November and you never chase it in January.",
      "Le contrat de saison est un forfait facturé à date fixe; la carte est au dossier en novembre et vous ne courez après rien en janvier.",
      "El contrato de temporada es un plan cobrado en fecha; la tarjeta queda guardada en noviembre y no persigue nada en enero.",
    )),
    "scheduling",
    P("quotes", L(
      "The driveway size, the plan and the salting are picks on the snow card, and the season price is on their phone before the first flake.",
      "La taille de l'entrée, le forfait et le salage sont des choix sur la fiche déneigement, et le prix de la saison est sur leur cellulaire avant le premier flocon.",
      "El tamaño de la entrada, el plan y la sal son opciones en la tarjeta de nieve, y el precio de la temporada está en su celular antes del primer copo.",
    )),
    "card_payments",
  ]),
  landscaping: Object.freeze([
    "recurring_jobs",
    "service_plans",
    P("aerial_measure", L(
      "The lot is outlined on the satellite still and the lawn area is on the quote before anyone walks it.",
      "Le terrain est tracé sur l'image satellite et la surface de pelouse est sur la soumission avant que quelqu'un le marche.",
      "El lote se delinea sobre la imagen satelital y el área de césped está en la cotización antes de que alguien lo recorra.",
    )),
    "instant_quotes",
    "scheduling",
    "crew_shifts",
  ]),
  tree_care: Object.freeze([
    P("self_quote", L(
      "The homeowner sends photos of the tree and the access; the quote starts with them on it, before the site visit.",
      "Le client envoie des photos de l'arbre et de l'accès; la soumission commence avec elles dessus, avant la visite.",
      "El cliente manda fotos del árbol y del acceso; la cotización empieza con ellas, antes de la visita.",
    )),
    "quotes",
    "job_photos",
    "online_approval",
    "review_requests",
  ]),
  fencing: Object.freeze([
    P("quotes", L(
      "The run is a length, the gates are a count, the posts and the panels come off both — priced in the yard.",
      "La longueur, le nombre de barrières, et les poteaux et les panneaux qui en découlent — tarifés dans la cour.",
      "El tramo es una longitud, los portones un conteo, y los postes y paneles salen de ambos; cotizado en el patio.",
    )),
    "self_quote",
    "online_approval",
    "materials",
    "job_photos",
  ]),
  carpentry: Object.freeze([
    "quotes",
    "self_quote",
    "online_approval",
    "job_photos",
    "card_payments",
  ]),
  drywall: Object.freeze([
    "quotes",
    "self_quote",
    "scheduling",
    "job_photos",
    "card_payments",
  ]),
  demolition: Object.freeze([
    "quotes",
    "self_quote",
    "job_photos",
    "job_costing",
    "card_payments",
  ]),

  // ── The recurring trades: the schedule is the business ─────────────────
  house_cleaning: Object.freeze([
    P("recurring_jobs", L(
      "Every bi-weekly client is already on the calendar next time, with the same cleaner — nobody rebooks them by hand.",
      "Chaque client aux deux semaines est déjà au calendrier la prochaine fois, avec la même personne — personne ne replanifie à la main.",
      "Cada cliente quincenal ya está en el calendario la próxima vez, con la misma persona; nadie lo vuelve a agendar a mano.",
    )),
    "checklists",
    "booking_page",
    "card_payments",
    "crew_shifts",
  ]),
  carpet_cleaning: Object.freeze([
    "booking_page",
    "booking_deposit",
    "recurring_jobs",
    "card_payments",
    "review_requests",
  ]),
  window_cleaning: Object.freeze([
    "booking_page",
    "recurring_jobs",
    "checklists",
    "card_payments",
    "review_requests",
  ]),
  pressure_washing: Object.freeze([
    P("self_quote", L(
      "They send a photo of the driveway and the siding; the quote starts with the photos on it, priced before you drive over.",
      "Ils envoient une photo de l'entrée et du revêtement; la soumission commence avec les photos dessus, tarifée avant le déplacement.",
      "Mandan una foto de la entrada y del revestimiento; la cotización empieza con las fotos, con precio antes de ir.",
    )),
    "booking_page",
    P("recurring_jobs", L(
      "The spring wash goes back on the calendar for every house you did this year.",
      "Le lavage du printemps se remet au calendrier pour chaque maison faite cette année.",
      "El lavado de primavera vuelve al calendario para cada casa que hizo este año.",
    )),
    "job_photos",
    "card_payments",
    "review_requests",
  ]),
  junk_removal: Object.freeze([
    P("instant_quotes", L(
      "The homeowner picks the load size on your site and has a price range on the spot, before they call anyone else.",
      "Le client choisit la taille du chargement sur votre site et a une fourchette sur-le-champ, avant d'appeler qui que ce soit d'autre.",
      "El cliente elige el tamaño de la carga en su sitio y tiene un rango de precio al instante, antes de llamar a nadie más.",
    )),
    "self_quote",
    "booking_page",
    "card_payments",
    "job_photos",
  ]),

  // ── Restoration: the record is the invoice ─────────────────────────────
  restoration: Object.freeze([
    P("job_photos", L(
      "The photos of the flooded basement are filed against the job the day you arrive, and they sit on the invoice the adjuster reads.",
      "Les photos du sous-sol inondé sont classées au dossier le jour de votre arrivée, et elles sont sur la facture que l'expert lit.",
      "Las fotos del sótano inundado quedan archivadas en el trabajo el día que llega, y están en la factura que lee el ajustador.",
    )),
    P("voice_receptionist", L(
      "The burst-pipe call at midnight is answered, the address and the damage taken down, and the job is on your phone.",
      "L'appel pour le tuyau éclaté à minuit est répondu, l'adresse et les dégâts notés, et le travail est sur votre cellulaire.",
      "La llamada por la tubería rota a medianoche se contesta, se anota la dirección y el daño, y el trabajo llega a su celular.",
    )),
    "scheduling",
    "invoice_changes",
    "checklists",
  ]),

  // ── The builders: the margin is the business ───────────────────────────
  remodeling: Object.freeze([
    "job_costing",
    "work_areas",
    P("invoice_changes", L(
      "The extra they asked for in week three is a new line on a new version of the invoice, and the first version is still there to point at.",
      "L'ajout demandé à la troisième semaine est une ligne sur une nouvelle version de la facture, et la première est toujours là pour la montrer.",
      "El extra que pidieron en la tercera semana es una línea en una versión nueva de la factura, y la primera sigue ahí para mostrarla.",
    )),
    "subcontractor_bids",
    "quotes",
    "contract_terms",
  ]),
  general_contracting: Object.freeze([
    "job_costing",
    "subcontractor_bids",
    "work_areas",
    "invoice_changes",
    "contract_terms",
    "crew_shifts",
  ]),
});

/** A language a pitch exists in, or null. */
export function normalizeTradePitchLanguage(code) {
  const short = String(code || "").toLowerCase().split("-")[0];
  return TRADE_PITCH_LANGUAGES.includes(short) ? short : null;
}

/**
 * The points for a trade, in a language, ordered.
 *
 * @param tradeKey  a DISCOVERY_TRADES key. Anything else, including null and
 *                  prototype names, returns an empty list — never a guess at
 *                  the nearest trade.
 * @param language  "en" | "fr" | "es"; anything else renders English.
 * @param limit     how many; default all. TRADE_PITCH_TOP for a surface.
 * @returns { language, fallback, points: [{ key, headline, oneLiner, proof }] }
 */
export function tradeSellingPoints(tradeKey, language = TRADE_PITCH_DEFAULT_LANGUAGE, { limit = Infinity } = {}) {
  const lang = normalizeTradePitchLanguage(language) || TRADE_PITCH_DEFAULT_LANGUAGE;
  const fallback = lang !== normalizeTradePitchLanguage(language);
  const list =
    typeof tradeKey === "string" && Object.hasOwn(TRADE_SELLING_POINTS, tradeKey)
      ? TRADE_SELLING_POINTS[tradeKey]
      : [];
  const points = [];
  for (const entry of list) {
    if (points.length >= limit) break;
    const key = typeof entry === "string" ? entry : entry.key;
    const base = POINTS[key];
    if (!base) continue; // The check refuses this at build time; at run time, skip rather than throw on a rep's screen.
    const proof = typeof entry === "string" ? base.proof : entry.proof;
    points.push({
      key,
      headline: base.headline[lang],
      oneLiner: base.oneLiner[lang],
      proof: proof[lang],
    });
  }
  return { language: lang, fallback, points };
}

/**
 * The top three headlines as one spoken clause, for a playbook line.
 *
 * "clients book you online, a paid visit booked, and dispatch from one
 * calendar" — lower-cased because it lands mid-sentence after "For an
 * electrician that's". Null when the trade has no list, so `renderLine`
 * refuses the line instead of reading out an empty clause.
 */
export function tradePitchClause(tradeKey, language = TRADE_PITCH_DEFAULT_LANGUAGE) {
  const { points } = tradeSellingPoints(tradeKey, language, { limit: TRADE_PITCH_TOP });
  if (points.length === 0) return null;
  const heads = points.map((p) => p.headline.charAt(0).toLowerCase() + p.headline.slice(1));
  const and = { en: "and", fr: "et", es: "y" }[normalizeTradePitchLanguage(language) || "en"];
  if (heads.length === 1) return heads[0];
  return `${heads.slice(0, -1).join(", ")} ${and} ${heads[heads.length - 1]}`;
}

/** Every trade that has a list — for the check and for surfaces that iterate. */
export const TRADE_PITCH_KEYS = Object.freeze(Object.keys(TRADE_SELLING_POINTS));

/**
 * The list for somebody whose trade is NOT known — the pipeline every trade
 * shares: a quote out fast, approved from the phone, paid by card. Read off
 * the same POINTS table as the per-trade lists so a headline is never typed
 * twice, and so a feature that leaves the shipped matrix leaves this list
 * with it. The five-minute signup follow-up (lib/signup/earlyNudge.js)
 * prints this when the person stopped before choosing a trade.
 */
export const NEUTRAL_PITCH_KEYS = Object.freeze(["quotes", "online_approval", "card_payments"]);

export function neutralSellingPoints(language = TRADE_PITCH_DEFAULT_LANGUAGE, { limit = TRADE_PITCH_TOP } = {}) {
  const lang = normalizeTradePitchLanguage(language) || TRADE_PITCH_DEFAULT_LANGUAGE;
  const points = [];
  for (const key of NEUTRAL_PITCH_KEYS) {
    if (points.length >= limit) break;
    const base = POINTS[key];
    if (!base) continue;
    points.push({ key, headline: base.headline[lang], oneLiner: base.oneLiner[lang], proof: base.proof[lang] });
  }
  return { language: lang, fallback: lang !== normalizeTradePitchLanguage(language), points };
}

/** The label a surface prints for the trade, from the discovery table. */
export function tradePitchLabel(tradeKey) {
  return DISCOVERY_TRADES[tradeKey]?.label || null;
}
