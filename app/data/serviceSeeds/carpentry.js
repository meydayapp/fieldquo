// app/data/serviceSeeds/carpentry.js
//
// The cabinetry book of the benchmark, filed under carpentry: cabinet
// installation, hardware and repair. Refinishing is priced per door by the
// cabinet_refinishing price book and is kept here as a reference only.
import { L, SHARED, D, T, withTemplates } from "./_templateLines";

const BM = (low, median, high) => ({ low, median, high, currency: "USD", source: "benchmark", asOf: "2026-09-21" });
const S = (seedKey, category, unit, benchmark, [en, fr, es], [den, dfr, des], extra = {}) => ({
  seedKey, category, name: { en, fr, es }, description: { en: den, fr: dfr, es: des },
  unit, benchmark, durationMinutes: null, bookable: false, ...extra,
});

export const SEED = {
  trade: "carpentry",
  categories: [
    { key: "cabinet_install", name: { en: "Cabinet installation", fr: "Installation d'armoires", es: "Instalación de gabinetes" } },
    { key: "cabinet_repair", name: { en: "Cabinet repair", fr: "Réparation d'armoires", es: "Reparación de gabinetes" } },
  ],
  services: [
    S("fq.carpentry.cabinet_install.cabinets", "cabinet_install", "each", BM(200, 344, 779),
      ["Cabinet installation", "Installation d'armoires", "Instalación de gabinetes"],
      ["Base and wall cabinets set level and plumb, screwed to the studs and to each other, doors and drawers aligned.",
       "Armoires du bas et du haut posées de niveau et d'aplomb, vissées aux montants et entre elles, portes et tiroirs alignés.",
       "Gabinetes bajos y altos colocados a nivel y a plomo, atornillados a los montantes y entre sí, con puertas y cajones alineados."]),
    S("fq.carpentry.cabinet_install.hardware", "cabinet_install", "each", BM(75, 75, 75),
      ["Cabinet hardware installation", "Installation de quincaillerie d'armoires", "Instalación de herrajes de gabinetes"],
      ["Handles, pulls and knobs drilled and fitted with a jig so every one lines up.",
       "Poignées et boutons percés et posés au gabarit pour que tout soit aligné.",
       "Jaladeras y perillas perforadas e instaladas con plantilla para que todas queden alineadas."],
      { existing: "standardAddOns cabinet_refinishing 'New Handles — supply & install'." }),
    S("fq.carpentry.cabinet_install.other", "cabinet_install", "flat", null,
      ["Other cabinet installation — describe what you need", "Autre installation d'armoires — décrivez le besoin", "Otra instalación de gabinetes — describa lo que necesita"],
      ["Cabinet installation work not listed above, priced after a look at the job.",
       "Travail d'installation d'armoires non listé ci-dessus, chiffré après examen sur place.",
       "Trabajo de instalación de gabinetes no listado arriba, cotizado después de ver el trabajo."]),
    S("fq.carpentry.cabinet_repair.refinishing", "cabinet_repair", "flat", null,
      ["Cabinet refinishing", "Refinition d'armoires", "Refinado de gabinetes"],
      ["Existing cabinets sanded and refinished in paint or stain rather than replaced.",
       "Armoires existantes sablées et refinies en peinture ou en teinture plutôt que remplacées.",
       "Gabinetes existentes lijados y refinados con pintura o tinte en lugar de reemplazarlos."],
      { existing: "cabinet_refinishing price book (per door / per drawer)." }),
    S("fq.carpentry.cabinet_repair.cabinets", "cabinet_repair", "flat", BM(125, 216, 376),
      ["Cabinet repair", "Réparation d'armoires", "Reparación de gabinetes"],
      ["Sagging doors, split panels, loose shelves and broken drawer boxes repaired and re-secured.",
       "Portes affaissées, panneaux fendus, tablettes lâches et caissons de tiroir brisés réparés et refixés.",
       "Puertas caídas, paneles partidos, repisas flojas y cajones rotos reparados y reasegurados."]),
    S("fq.carpentry.cabinet_repair.hardware", "cabinet_repair", "each", BM(85, 189, 304),
      ["Cabinet hardware repair", "Réparation de quincaillerie d'armoires", "Reparación de herrajes de gabinetes"],
      ["Hinges, slides and catches adjusted or replaced so doors close true and drawers glide.",
       "Charnières, coulisses et loquets ajustés ou remplacés pour que les portes ferment droit et que les tiroirs glissent.",
       "Bisagras, correderas y cierres ajustados o reemplazados para que las puertas cierren derecho y los cajones deslicen."],
      { existing: "standardAddOns 'Soft-Close Hinges' / 'Soft-Close Drawer Slides'." }),
    S("fq.carpentry.cabinet_repair.other", "cabinet_repair", "flat", null,
      ["Other cabinet repair — describe what you need", "Autre réparation d'armoires — décrivez le besoin", "Otra reparación de gabinetes — describa lo que necesita"],
      ["Cabinet repair work not listed above, priced after a look at the job.",
       "Travail de réparation d'armoires non listé ci-dessus, chiffré après examen sur place.",
       "Trabajo de reparación de gabinetes no listado arriba, cotizado después de ver el trabajo."]),
    // ── Added 2026-09-24 with the estimate templates ──────────────────────
    S("fq.carpentry.cabinet_install.countertop_install", "cabinet_install", "flat", null,
      ["Cabinetry and countertop installation — builder grade", "Pose d'armoires et de comptoir — gamme constructeur", "Instalación de gabinetes y cubierta — grado constructor"],
      ["Stock cabinets set level and plumb and the laminate or quartz countertop templated and set; materials billed separately.",
       "Armoires de série posées de niveau et d'aplomb, comptoir de stratifié ou de quartz gabarié et posé; matériaux facturés à part.",
       "Gabinetes de línea colocados a nivel y a plomo, cubierta de laminado o cuarzo plantillada y colocada; materiales facturados aparte."]),
    S("fq.carpentry.cabinet_install.measure_design", "cabinet_install", "flat", null,
      ["Cabinet measure and layout visit", "Visite de mesure et de plan d'armoires", "Visita de medición y distribución de gabinetes"],
      ["The room measured wall by wall, the appliances and plumbing located and a cabinet layout drawn up to order from.",
       "Pièce mesurée mur par mur, appareils et plomberie localisés et plan d'armoires dessiné pour passer la commande.",
       "Habitación medida pared por pared, electrodomésticos y plomería ubicados y un plano de gabinetes dibujado para hacer el pedido."],
      { durationMinutes: 90, bookable: true }),
    S("fq.carpentry.cabinet_repair.drawer_slides", "cabinet_repair", "each", null,
      ["Drawer slide and hinge replacement", "Remplacement de coulisses et de charnières", "Reemplazo de correderas y bisagras"],
      ["Worn slides or sagging hinges swapped for soft-close hardware and the doors and drawers realigned.",
       "Coulisses usées ou charnières affaissées remplacées par de la quincaillerie à fermeture douce, portes et tiroirs réalignés.",
       "Correderas gastadas o bisagras vencidas cambiadas por herrajes de cierre suave, con puertas y cajones realineados."]),
    S("fq.carpentry.cabinet_repair.assessment_visit", "cabinet_repair", "flat", null,
      ["Cabinet repair assessment", "Évaluation de réparation d'armoires", "Evaluación de reparación de gabinetes"],
      ["Damaged or failing cabinets looked over, what can be repaired separated from what should be replaced, and a written price given.",
       "Armoires abîmées ou défaillantes examinées, ce qui se répare distingué de ce qui doit être remplacé, et prix écrit remis.",
       "Gabinetes dañados o fallando revisados, lo reparable separado de lo que conviene reemplazar, y un precio por escrito entregado."],
      { durationMinutes: 60, bookable: true }),
    S("fq.carpentry.cabinet_repair.adjustment_tune_up", "cabinet_repair", "flat", null,
      ["Door and drawer adjustment tune-up", "Mise au point des portes et tiroirs", "Ajuste de puertas y cajones"],
      ["Every door and drawer in the kitchen adjusted, hinges tightened and catches reset so the run closes evenly.",
       "Chaque porte et tiroir de la cuisine ajusté, charnières resserrées et loquets réglés pour que tout ferme uniformément.",
       "Cada puerta y cajón de la cocina ajustado, bisagras apretadas y cierres regulados para que todo cierre parejo."]),
    S("fq.carpentry.cabinet_repair.reseal_touch_up", "cabinet_repair", "flat", null,
      ["Cabinet touch-up and reseal", "Retouche et rescellement d'armoires", "Retoque y resellado de gabinetes"],
      ["Chips and scratches filled and colour-matched, then a clear coat applied to the worn areas around handles and the sink.",
       "Éclats et rayures comblés et teintés à la couleur, puis couche de finition claire appliquée aux zones usées près des poignées et de l'évier.",
       "Desconchones y rayones rellenados e igualados en color, y luego una capa transparente aplicada en las zonas gastadas junto a las jaladeras y el fregadero."]),
  ],
};

// ── Estimate templates ───────────────────────────────────────────────────────
//
// Evidence: the captured construction template set's "Cabinetry & Countertop
// Install — Builder Grade" line ($3,500 labour, zero cost in the source; our
// cost is 50%) lands on the new countertop row; the cabinet install and
// repair rows carry benchmark medians ($344 a cabinet, $216 a repair, $189 a
// hardware repair) that set their totals. Per-door and per-drawer lines carry
// `doorCount` / `drawerCount` — the fields lib/pricing/cabinetLabour.js reads
// — and keep qty 1; the kitchen's counts fill them.
const TEMPLATES = {
  // ── Installation ──
  "fq.carpentry.cabinet_install.cabinets": T("installation", {
    it: ["Installazione mobili", "Basi e pensili posati in bolla e a piombo, avvitati ai montanti e tra loro, ante e cassetti allineati."],
    de: ["Schrankmontage", "Unter- und Oberschränke waagrecht und lotrecht gesetzt, an den Ständern und untereinander verschraubt, Türen und Schubladen ausgerichtet."],
    uk: ["Встановлення шаф", "Нижні та верхні шафи виставлено по рівню й вертикалі, прикручено до стійок і між собою, дверцята та шухляди вирівняно."],
    tl: ["Pagkabit ng cabinet", "Base at wall cabinet na nilevel at ni-plumb, tinurnilyo sa stud at sa isa't isa, at inayos ang pinto at drawer."],
  }, [
    L.labour(1, "each", 260, {
      en: ["Cabinet installation labour — per cabinet", "The box set level and plumb, fastened to the studs and the neighbour, doors and drawers aligned."],
      fr: ["Main-d'œuvre — installation d'armoire, l'unité", "Caisson posé de niveau et d'aplomb, fixé aux montants et à l'armoire voisine, portes et tiroirs alignés."],
      es: ["Mano de obra — instalación de gabinete, por unidad", "Caja colocada a nivel y a plomo, fijada a los montantes y al gabinete vecino, puertas y cajones alineados."],
      it: ["Manodopera — installazione mobile, cadauno", "Corpo posato in bolla e a piombo, fissato ai montanti e al mobile accanto, ante e cassetti allineati."],
      de: ["Arbeit — Schrankmontage, pro Schrank", "Korpus waagrecht und lotrecht gesetzt, an Ständern und Nachbarschrank befestigt, Türen und Schubladen ausgerichtet."],
      uk: ["Робота — встановлення шафи, за штуку", "Корпус виставлено по рівню й вертикалі, прикріплено до стійок і сусідньої шафи, дверцята та шухляди вирівняно."],
      tl: ["Labor — pagkabit ng cabinet, kada isa", "Nilevel at ni-plumb ang box, ikinabit sa stud at katabing cabinet, at inayos ang pinto at drawer."],
    }),
    L.material(1, "each", 45, {
      en: ["Fasteners, shims and fillers — per cabinet", "Cabinet screws, shims, toe kick and filler strips."],
      fr: ["Fixations, cales et panneaux de remplissage — l'unité", "Vis à armoire, cales, plinthe de retrait et bandes de remplissage."],
      es: ["Tornillería, cuñas y rellenos — por unidad", "Tornillos para gabinete, cuñas, zoclo y tiras de relleno."],
      it: ["Viti, spessori e riempitivi — cadauno", "Viti per mobili, spessori, zoccolo e listelli di riempimento."],
      de: ["Schrauben, Keile und Passleisten — pro Schrank", "Schrankschrauben, Keile, Sockelblende und Passleisten."],
      uk: ["Кріплення, клини та заповнювачі — за штуку", "Шурупи для шаф, клини, цоколь і заповнювальні планки."],
      tl: ["Turnilyo, shim at filler — kada isa", "Cabinet screw, shim, toe kick at filler strip."],
    }),
  ], null),

  "fq.carpentry.cabinet_install.hardware": T("installation", {
    it: ["Installazione maniglie e pomelli", "Maniglie e pomelli forati e montati con la dima così che siano tutti allineati."],
    de: ["Montage von Griffen und Knöpfen", "Griffe und Knöpfe mit Schablone gebohrt und montiert, damit alle in einer Linie sitzen."],
    uk: ["Встановлення фурнітури шаф", "Ручки та кнопки просвердлено й встановлено за шаблоном, щоб усі були на одній лінії."],
    tl: ["Pagkabit ng hardware ng cabinet", "Hawakan at knob na binutasan at ikinabit gamit ang jig para pantay lahat."],
  }, [
    L.labour(1, "each", 9, {
      en: ["Handle installation — per door", "One handle or knob jig-drilled and fitted on a door."],
      fr: ["Pose de poignée — la porte", "Une poignée ou un bouton percé au gabarit et posé sur une porte."],
      es: ["Instalación de jaladera — por puerta", "Una jaladera o perilla perforada con plantilla y colocada en una puerta."],
      it: ["Montaggio maniglia — per anta", "Una maniglia o un pomello forato con dima e montato su un'anta."],
      de: ["Griffmontage — pro Tür", "Ein Griff oder Knopf mit Schablone gebohrt und an einer Tür montiert."],
      uk: ["Встановлення ручки — за дверцята", "Одну ручку або кнопку просвердлено за шаблоном і встановлено на дверцята."],
      tl: ["Pagkabit ng hawakan — kada pinto", "Isang hawakan o knob na binutasan gamit ang jig at ikinabit sa pinto."],
    }, { measurementKey: "doorCount" }),
    L.labour(1, "each", 9, {
      en: ["Handle installation — per drawer", "One pull jig-drilled and fitted on a drawer front."],
      fr: ["Pose de poignée — le tiroir", "Une poignée percée au gabarit et posée sur une façade de tiroir."],
      es: ["Instalación de jaladera — por cajón", "Una jaladera perforada con plantilla y colocada en el frente de un cajón."],
      it: ["Montaggio maniglia — per cassetto", "Una maniglia forata con dima e montata sul frontale di un cassetto."],
      de: ["Griffmontage — pro Schublade", "Ein Griff mit Schablone gebohrt und an einer Schubladenfront montiert."],
      uk: ["Встановлення ручки — за шухляду", "Одну ручку просвердлено за шаблоном і встановлено на фасад шухляди."],
      tl: ["Pagkabit ng hawakan — kada drawer", "Isang pull na binutasan gamit ang jig at ikinabit sa harap ng drawer."],
    }, { measurementKey: "drawerCount" }),
    L.material(1, "each", 6, {
      en: ["Handle or knob — per door", "Brushed-nickel bar pull or knob with screws, supplied."],
      fr: ["Poignée ou bouton — la porte", "Poignée barre ou bouton en nickel brossé avec vis, fourni."],
      es: ["Jaladera o perilla — por puerta", "Jaladera de barra o perilla de níquel cepillado con tornillos, suministrada."],
      it: ["Maniglia o pomello — per anta", "Maniglia a barra o pomello in nichel spazzolato con viti, fornito."],
      de: ["Griff oder Knopf — pro Tür", "Bügelgriff oder Knopf in Nickel gebürstet mit Schrauben, geliefert."],
      uk: ["Ручка або кнопка — за дверцята", "Ручка-скоба або кнопка з матового нікелю зі шурупами, в комплекті."],
      tl: ["Hawakan o knob — kada pinto", "Brushed-nickel bar pull o knob na may turnilyo, kasama."],
    }, { measurementKey: "doorCount" }),
  ], null),

  "fq.carpentry.cabinet_install.countertop_install": T("installation", {
    it: ["Installazione mobili e piano di lavoro — grado base", "Mobili di serie posati in bolla e a piombo, piano in laminato o quarzo rilevato e posato; materiali fatturati a parte."],
    de: ["Schrank- und Arbeitsplattenmontage — Standard", "Serienschränke waagrecht und lotrecht gesetzt, Laminat- oder Quarzarbeitsplatte aufgemessen und gesetzt; Material separat."],
    uk: ["Монтаж шаф і стільниці — базовий рівень", "Серійні шафи виставлено по рівню й вертикалі, стільницю з ламінату або кварцу зашаблоновано та змонтовано; матеріали окремо."],
    tl: ["Pagkabit ng cabinet at countertop — builder grade", "Stock cabinet na nilevel at ni-plumb, laminate o quartz countertop na tinemplate at inilagay; hiwalay ang materyales."],
  }, [
    L.labour(1, "flat", 3500, {
      en: ["Cabinetry and countertop installation labour", "Cabinets installed and levelled, the countertop templated and set."],
      fr: ["Main-d'œuvre — pose d'armoires et de comptoir", "Armoires posées et mises de niveau, comptoir gabarié et posé."],
      es: ["Mano de obra — instalación de gabinetes y cubierta", "Gabinetes instalados y nivelados, cubierta plantillada y colocada."],
      it: ["Manodopera — posa mobili e piano", "Mobili installati e livellati, piano rilevato e posato."],
      de: ["Arbeit — Schrank- und Arbeitsplattenmontage", "Schränke montiert und ausgerichtet, Arbeitsplatte aufgemessen und gesetzt."],
      uk: ["Робота — монтаж шаф і стільниці", "Шафи встановлено й вирівняно, стільницю зашаблоновано та змонтовано."],
      tl: ["Labor — pagkabit ng cabinet at countertop", "Ikinabit at nilevel ang cabinet, tinemplate at inilagay ang countertop."],
    }),
  ], null),

  // ── Repair ──
  "fq.carpentry.cabinet_repair.cabinets": T("repair", {
    it: ["Riparazione mobili", "Ante cadenti, pannelli spaccati, ripiani lenti e cassetti rotti riparati e rifissati."],
    de: ["Schrankreparatur", "Hängende Türen, gerissene Paneele, lockere Böden und kaputte Schubkästen repariert und neu befestigt."],
    uk: ["Ремонт шаф", "Провислі дверцята, тріснуті панелі, хиткі полиці та зламані шухляди відремонтовано й закріплено."],
    tl: ["Pag-ayos ng cabinet", "Lumalaylay na pinto, biyak na panel, maluwag na shelf at sirang drawer box na inayos at ikinabit ulit."],
  }, [
    SHARED.serviceCall(65),
    L.labour(1.5, "hour", 95, {
      en: ["Cabinet repair labour", "Doors rehung, panels glued and clamped, shelves re-pinned and drawer boxes rebuilt, by the hour."],
      fr: ["Main-d'œuvre — réparation d'armoires", "Portes reposées, panneaux collés et serrés, tablettes refixées et caissons de tiroir refaits, à l'heure."],
      es: ["Mano de obra — reparación de gabinetes", "Puertas recolgadas, paneles pegados y prensados, repisas refijadas y cajas de cajón reconstruidas, por hora."],
      it: ["Manodopera — riparazione mobili", "Ante rimontate, pannelli incollati e serrati, ripiani rifissati e cassetti ricostruiti, a ore."],
      de: ["Arbeit — Schrankreparatur", "Türen neu eingehängt, Paneele verleimt und gezwungen, Böden neu gesteckt und Schubkästen instand gesetzt, nach Stunden."],
      uk: ["Робота — ремонт шаф", "Дверцята перевішано, панелі склеєно й затиснуто, полиці закріплено, шухляди відновлено, погодинно."],
      tl: ["Labor — pag-ayos ng cabinet", "Ikinabit ulit ang pinto, dinikit at ini-clamp ang panel, ikinabit ang shelf at inayos ang drawer box, kada oras."],
    }),
    SHARED.consumables(25),
  ], null),

  "fq.carpentry.cabinet_repair.hardware": T("repair", {
    it: ["Riparazione ferramenta mobili", "Cerniere, guide e chiusure regolate o sostituite così che le ante chiudano bene e i cassetti scorrano."],
    de: ["Beschlagreparatur", "Scharniere, Auszüge und Schnäpper eingestellt oder ersetzt, damit Türen sauber schließen und Schubladen gleiten."],
    uk: ["Ремонт фурнітури шаф", "Завіси, напрямні та защіпки відрегульовано або замінено, щоб дверцята закривалися рівно, а шухляди ковзали."],
    tl: ["Pag-ayos ng hardware ng cabinet", "Bisagra, slide at catch na inayos o pinalitan para tama ang sara ng pinto at dumudulas ang drawer."],
  }, [
    L.labour(1, "each", 35, {
      en: ["Hinge or slide replacement labour — per door or drawer", "The old hardware out, the new fitted on the same holes where possible and the front realigned."],
      fr: ["Main-d'œuvre — remplacement de charnière ou de coulisse, la porte ou le tiroir", "Ancienne quincaillerie retirée, nouvelle posée sur les mêmes trous si possible et façade réalignée."],
      es: ["Mano de obra — reemplazo de bisagra o corredera, por puerta o cajón", "Herraje viejo retirado, el nuevo montado en los mismos agujeros cuando se puede y el frente realineado."],
      it: ["Manodopera — sostituzione cerniera o guida, per anta o cassetto", "Vecchia ferramenta rimossa, la nuova montata sugli stessi fori quando possibile e il frontale riallineato."],
      de: ["Arbeit — Scharnier oder Auszug ersetzen, pro Tür oder Schublade", "Alter Beschlag raus, neuer möglichst in die alten Löcher gesetzt und die Front neu ausgerichtet."],
      uk: ["Робота — заміна завіси або напрямної, за дверцята чи шухляду", "Стару фурнітуру знято, нову встановлено в ті самі отвори, де можливо, фасад вирівняно."],
      tl: ["Labor — palit ng bisagra o slide, kada pinto o drawer", "Tinanggal ang lumang hardware, ikinabit ang bago sa parehong butas kung kaya at inayos ang harap."],
    }, { measurementKey: "doorCount" }),
    L.material(1, "each", 14, {
      en: ["Soft-close hinge pair or slide set — per door or drawer", "Concealed soft-close hinges or full-extension slides."],
      fr: ["Paire de charnières ou jeu de coulisses à fermeture douce — la porte ou le tiroir", "Charnières invisibles à fermeture douce ou coulisses à extension complète."],
      es: ["Par de bisagras o juego de correderas de cierre suave — por puerta o cajón", "Bisagras ocultas de cierre suave o correderas de extensión total."],
      it: ["Coppia di cerniere o kit guide soft-close — per anta o cassetto", "Cerniere a scomparsa soft-close o guide a estrazione totale."],
      de: ["Softclose-Scharnierpaar oder Auszugsset — pro Tür oder Schublade", "Verdeckte Softclose-Scharniere oder Vollauszüge."],
      uk: ["Пара завіс або комплект напрямних з доводчиком — за дверцята чи шухляду", "Приховані завіси з доводчиком або напрямні повного висування."],
      tl: ["Soft-close hinge pair o slide set — kada pinto o drawer", "Concealed soft-close hinge o full-extension slide."],
    }, { measurementKey: "doorCount" }),
  ], null),

  "fq.carpentry.cabinet_repair.drawer_slides": T("repair", {
    it: ["Sostituzione guide cassetti e cerniere", "Guide consumate o cerniere cedevoli sostituite con ferramenta soft-close e ante e cassetti riallineati."],
    de: ["Austausch von Schubladenauszügen und Scharnieren", "Verschlissene Auszüge oder hängende Scharniere gegen Softclose-Beschläge getauscht, Türen und Schubladen neu ausgerichtet."],
    uk: ["Заміна напрямних шухляд і завіс", "Зношені напрямні або провислі завіси замінено на фурнітуру з доводчиком, дверцята та шухляди вирівняно."],
    tl: ["Palit ng drawer slide at bisagra", "Sirang slide o lumalaylay na bisagra na pinalitan ng soft-close at inayos ulit ang pinto at drawer."],
  }, [
    L.labour(1, "each", 40, {
      en: ["Drawer slide replacement labour — per drawer", "The drawer out, the old slides off the box and the cabinet, the new pair fitted and the front aligned."],
      fr: ["Main-d'œuvre — remplacement de coulisses, le tiroir", "Tiroir retiré, anciennes coulisses enlevées du caisson et de l'armoire, nouvelle paire posée et façade alignée."],
      es: ["Mano de obra — reemplazo de correderas, por cajón", "Cajón fuera, correderas viejas quitadas de la caja y del gabinete, el par nuevo montado y el frente alineado."],
      it: ["Manodopera — sostituzione guide, per cassetto", "Cassetto estratto, vecchie guide tolte dal cassetto e dal mobile, nuova coppia montata e frontale allineato."],
      de: ["Arbeit — Auszüge ersetzen, pro Schublade", "Schublade raus, alte Auszüge von Kasten und Korpus ab, neues Paar montiert und die Front ausgerichtet."],
      uk: ["Робота — заміна напрямних, за шухляду", "Шухляду знято, старі напрямні зняті з коробу та шафи, нову пару встановлено, фасад вирівняно."],
      tl: ["Labor — palit ng drawer slide, kada drawer", "Tinanggal ang drawer, inalis ang lumang slide sa box at cabinet, ikinabit ang bagong pares at inayos ang harap."],
    }, { measurementKey: "drawerCount" }),
    L.material(1, "each", 28, {
      en: ["Soft-close drawer slide pair — per drawer", "Full-extension undermount or side-mount soft-close slides, 18 or 21 in."],
      fr: ["Paire de coulisses à fermeture douce — le tiroir", "Coulisses à extension complète, sous le tiroir ou latérales, à fermeture douce, 18 ou 21 po."],
      es: ["Par de correderas de cierre suave — por cajón", "Correderas de extensión total, ocultas o laterales, de cierre suave, 18 o 21 pulg."],
      it: ["Coppia di guide soft-close — per cassetto", "Guide a estrazione totale, sottocassetto o laterali, soft-close, 18 o 21 pollici."],
      de: ["Softclose-Auszugspaar — pro Schublade", "Vollauszüge, Unterflur oder Seitenmontage, Softclose, 18 oder 21 Zoll."],
      uk: ["Пара напрямних з доводчиком — за шухляду", "Напрямні повного висування, приховані або бокові, з доводчиком, 18 або 21 дюйм."],
      tl: ["Soft-close drawer slide pair — kada drawer", "Full-extension undermount o side-mount soft-close slide, 18 o 21 in."],
    }, { measurementKey: "drawerCount" }),
  ], null),

  // ── Inspection ──
  "fq.carpentry.cabinet_install.measure_design": T("inspection", {
    it: ["Sopralluogo di misura e layout mobili", "Stanza misurata parete per parete, elettrodomestici e impianti localizzati e layout dei mobili disegnato per l'ordine."],
    de: ["Aufmaß- und Planungstermin für Schränke", "Raum Wand für Wand aufgemessen, Geräte und Anschlüsse erfasst und ein Schrankplan für die Bestellung gezeichnet."],
    uk: ["Візит для заміру та планування шаф", "Кімнату виміряно стіна за стіною, розташування техніки й сантехніки визначено, план шаф накреслено для замовлення."],
    tl: ["Visit para sukatin at i-layout ang cabinet", "Sinukat ang kuwarto pader-pader, tinukoy ang appliance at tubo, at ginuhit ang cabinet layout para sa order."],
  }, [
    L.labour(1, "flat", 150, {
      en: ["Measure and layout visit", "Walls, windows, appliances and rough-ins measured and a layout drawn to order from."],
      fr: ["Visite de mesure et de plan", "Murs, fenêtres, appareils et arrivées mesurés et plan dessiné pour la commande."],
      es: ["Visita de medición y distribución", "Paredes, ventanas, electrodomésticos y tomas medidos y un plano dibujado para el pedido."],
      it: ["Sopralluogo di misura e layout", "Pareti, finestre, elettrodomestici e attacchi misurati e layout disegnato per l'ordine."],
      de: ["Aufmaß- und Planungstermin", "Wände, Fenster, Geräte und Anschlüsse aufgemessen und ein Plan für die Bestellung gezeichnet."],
      uk: ["Візит для заміру та планування", "Стіни, вікна, техніку та виводи виміряно, план накреслено для замовлення."],
      tl: ["Visit para sa sukat at layout", "Sinukat ang pader, bintana, appliance at rough-in at ginuhit ang layout para sa order."],
    }),
  ], D.newCustomer("fixed", 150)),

  "fq.carpentry.cabinet_repair.assessment_visit": T("inspection", {
    it: ["Valutazione riparazione mobili", "Mobili danneggiati o difettosi esaminati, ciò che si ripara distinto da ciò che va sostituito, e prezzo scritto consegnato."],
    de: ["Begutachtung für Schrankreparatur", "Beschädigte oder defekte Schränke begutachtet, Reparierbares von Ersatzbedürftigem getrennt und ein schriftlicher Preis genannt."],
    uk: ["Оцінка ремонту шаф", "Пошкоджені або несправні шафи оглянуто, відокремлено те, що ремонтується, від того, що треба замінити, і надано письмову ціну."],
    tl: ["Pagtatasa ng pag-ayos ng cabinet", "Tiningnan ang sirang cabinet, pinaghiwalay ang maaayos sa dapat palitan, at ibinigay ang nakasulat na presyo."],
  }, [
    SHARED.diagnostic(75, { cost: 40 }),
  ], null),

  // ── Maintenance ──
  "fq.carpentry.cabinet_repair.adjustment_tune_up": T("maintenance", {
    it: ["Regolazione ante e cassetti", "Ogni anta e cassetto della cucina regolato, cerniere serrate e chiusure risistemate così che tutto chiuda in modo uniforme."],
    de: ["Einstellung von Türen und Schubladen", "Jede Tür und Schublade der Küche eingestellt, Scharniere nachgezogen und Schnäpper justiert, damit alles gleichmäßig schließt."],
    uk: ["Регулювання дверцят і шухляд", "Кожні дверцята й шухляду на кухні відрегульовано, завіси підтягнуто, защіпки налаштовано, щоб усе закривалося рівно."],
    tl: ["Tune-up ng pinto at drawer", "Inayos ang bawat pinto at drawer sa kusina, hinigpitan ang bisagra at inayos ang catch para pantay ang sara."],
  }, [
    L.labour(1, "each", 6, {
      en: ["Door adjustment — per door", "Hinges adjusted in three axes and tightened so the door hangs square and closes softly."],
      fr: ["Ajustement de porte — la porte", "Charnières ajustées sur trois axes et resserrées pour que la porte soit d'équerre et ferme en douceur."],
      es: ["Ajuste de puerta — por puerta", "Bisagras ajustadas en tres ejes y apretadas para que la puerta cuelgue a escuadra y cierre suave."],
      it: ["Regolazione anta — per anta", "Cerniere regolate sui tre assi e serrate perché l'anta sia in squadra e chiuda dolcemente."],
      de: ["Türeinstellung — pro Tür", "Scharniere in drei Achsen eingestellt und nachgezogen, damit die Tür gerade hängt und sanft schließt."],
      uk: ["Регулювання дверцят — за дверцята", "Завіси відрегульовано по трьох осях і підтягнуто, щоб дверцята висіли рівно й закривалися м'яко."],
      tl: ["Pag-ayos ng pinto — kada pinto", "Inayos ang bisagra sa tatlong direksyon at hinigpitan para tuwid ang pinto at mahinang sumara."],
    }, { measurementKey: "doorCount" }),
    L.labour(1, "each", 6, {
      en: ["Drawer adjustment — per drawer", "Slides cleaned and adjusted and the front realigned to its neighbours."],
      fr: ["Ajustement de tiroir — le tiroir", "Coulisses nettoyées et ajustées, façade réalignée avec ses voisines."],
      es: ["Ajuste de cajón — por cajón", "Correderas limpiadas y ajustadas y el frente realineado con los vecinos."],
      it: ["Regolazione cassetto — per cassetto", "Guide pulite e regolate e frontale riallineato ai vicini."],
      de: ["Schubladeneinstellung — pro Schublade", "Auszüge gereinigt und eingestellt, die Front an die Nachbarn angeglichen."],
      uk: ["Регулювання шухляди — за шухляду", "Напрямні очищено й відрегульовано, фасад вирівняно із сусідніми."],
      tl: ["Pag-ayos ng drawer — kada drawer", "Nilinis at inayos ang slide at inayos ang harap sa katabi."],
    }, { measurementKey: "drawerCount" }),
  ], D.regular("fixed", 10)),

  "fq.carpentry.cabinet_repair.refinishing": T("maintenance", {
    it: ["Rifinitura mobili", "Mobili esistenti carteggiati e rifiniti a smalto o a mordente invece di essere sostituiti."],
    de: ["Schränke neu beschichten", "Vorhandene Schränke geschliffen und mit Lack oder Beize neu beschichtet, statt sie zu ersetzen."],
    uk: ["Оновлення покриття шаф", "Наявні шафи відшліфовано й перекрито фарбою або морилкою замість заміни."],
    tl: ["Refinishing ng cabinet", "Hinasa at ni-refinish ng pintura o stain ang lumang cabinet sa halip na palitan."],
  }, [
    L.labour(1, "each", 85, {
      en: ["Door refinishing labour — per door", "Door off, hardware out, sanded, primed and sprayed two coats, rehung."],
      fr: ["Main-d'œuvre — refinition de porte, la porte", "Porte démontée, quincaillerie retirée, sablée, apprêtée et deux couches au pistolet, reposée."],
      es: ["Mano de obra — reacabado de puerta, por puerta", "Puerta desmontada, herraje fuera, lijada, imprimada y dos manos a pistola, recolgada."],
      it: ["Manodopera — rifinitura anta, per anta", "Anta smontata, ferramenta tolta, carteggiata, primerizzata e due mani a spruzzo, rimontata."],
      de: ["Arbeit — Tür neu beschichten, pro Tür", "Tür ab, Beschläge raus, geschliffen, grundiert und zwei Schichten gespritzt, wieder eingehängt."],
      uk: ["Робота — оновлення дверцят, за дверцята", "Дверцята знято, фурнітуру вийнято, відшліфовано, заґрунтовано й нанесено два шари розпиленням, повішено назад."],
      tl: ["Labor — refinish ng pinto, kada pinto", "Tinanggal ang pinto at hardware, hinasa, nilagyan ng primer at dalawang patong ng spray, ikinabit ulit."],
    }, { measurementKey: "doorCount" }),
    L.labour(1, "each", 55, {
      en: ["Drawer front refinishing labour — per drawer", "Front off, sanded, primed and sprayed two coats, refitted."],
      fr: ["Main-d'œuvre — refinition de façade de tiroir, le tiroir", "Façade démontée, sablée, apprêtée et deux couches au pistolet, reposée."],
      es: ["Mano de obra — reacabado de frente de cajón, por cajón", "Frente desmontado, lijado, imprimado y dos manos a pistola, remontado."],
      it: ["Manodopera — rifinitura frontale cassetto, per cassetto", "Frontale smontato, carteggiato, primerizzato e due mani a spruzzo, rimontato."],
      de: ["Arbeit — Schubladenfront neu beschichten, pro Schublade", "Front ab, geschliffen, grundiert und zwei Schichten gespritzt, wieder montiert."],
      uk: ["Робота — оновлення фасаду шухляди, за шухляду", "Фасад знято, відшліфовано, заґрунтовано й нанесено два шари розпиленням, встановлено назад."],
      tl: ["Labor — refinish ng harap ng drawer, kada drawer", "Tinanggal ang harap, hinasa, nilagyan ng primer at dalawang patong ng spray, ikinabit ulit."],
    }, { measurementKey: "drawerCount" }),
    L.material(1, "each", 12, {
      en: ["Primer and cabinet enamel — per door", "Bonding primer and waterborne alkyd enamel, two coats."],
      fr: ["Apprêt et émail à armoires — la porte", "Apprêt d'adhérence et émail alkyde à l'eau, deux couches."],
      es: ["Imprimador y esmalte para gabinetes — por puerta", "Imprimador adherente y esmalte alquídico base agua, dos manos."],
      it: ["Primer e smalto per mobili — per anta", "Primer ancorante e smalto alchidico all'acqua, due mani."],
      de: ["Haftgrund und Möbellack — pro Tür", "Haftgrund und wasserbasierter Alkydlack, zwei Schichten."],
      uk: ["Ґрунт і емаль для шаф — за дверцята", "Адгезійний ґрунт і водорозчинна алкідна емаль, два шари."],
      tl: ["Primer at cabinet enamel — kada pinto", "Bonding primer at waterborne alkyd enamel, dalawang patong."],
    }, { measurementKey: "doorCount" }),
  ], null),

  "fq.carpentry.cabinet_repair.reseal_touch_up": T("maintenance", {
    it: ["Ritocco e nuova sigillatura mobili", "Scheggiature e graffi stuccati e ritoccati a colore, poi una mano trasparente applicata sulle zone usurate vicino a maniglie e lavello."],
    de: ["Ausbesserung und Neuversiegelung von Schränken", "Abplatzer und Kratzer gefüllt und farblich angeglichen, dann Klarlack auf die abgenutzten Stellen um Griffe und Spüle aufgetragen."],
    uk: ["Підфарбовування та повторне покриття шаф", "Сколи й подряпини заповнено та підібрано за кольором, потім прозорий шар нанесено на зношені ділянки біля ручок і мийки."],
    tl: ["Touch-up at reseal ng cabinet", "Tinapalan at tinugma ang kulay ng chip at gasgas, tapos nilagyan ng clear coat ang gasgas na parte malapit sa hawakan at lababo."],
  }, [
    L.labour(1, "flat", 220, {
      en: ["Touch-up and clear coat labour", "Chips filled, colour-matched by hand and the worn fronts wiped with a clear coat."],
      fr: ["Main-d'œuvre — retouche et couche de finition", "Éclats comblés, couleur assortie à la main et façades usées essuyées d'une couche de finition claire."],
      es: ["Mano de obra — retoque y capa transparente", "Desconchones rellenados, color igualado a mano y los frentes gastados repasados con capa transparente."],
      it: ["Manodopera — ritocco e mano trasparente", "Scheggiature stuccate, colore abbinato a mano e frontali usurati ripassati con una mano trasparente."],
      de: ["Arbeit — Ausbesserung und Klarlack", "Abplatzer gefüllt, Farbe von Hand angeglichen und die abgenutzten Fronten mit Klarlack überzogen."],
      uk: ["Робота — підфарбовування та прозорий шар", "Сколи заповнено, колір підібрано вручну, зношені фасади протерто прозорим шаром."],
      tl: ["Labor — touch-up at clear coat", "Tinapalan ang chip, tinugma ang kulay sa kamay at pinahiran ng clear coat ang gasgas na harap."],
    }),
    L.material(1, "flat", 35, {
      en: ["Touch-up kit and wipe-on clear", "Fill sticks, touch-up markers and wipe-on polyurethane."],
      fr: ["Trousse de retouche et fini clair à essuyer", "Bâtons de remplissage, crayons de retouche et polyuréthane à essuyer."],
      es: ["Kit de retoque y transparente para frotar", "Barras de relleno, marcadores de retoque y poliuretano para frotar."],
      it: ["Kit ritocco e trasparente a straccio", "Stick riempitivi, pennarelli per ritocco e poliuretano a straccio."],
      de: ["Ausbesserungsset und Wischklarlack", "Füllstifte, Retuschierstifte und Wisch-Polyurethan."],
      uk: ["Набір для підфарбовування та прозорий лак", "Заповнювальні олівці, маркери для ретуші та поліуретан для нанесення ганчіркою."],
      tl: ["Touch-up kit at wipe-on clear", "Fill stick, touch-up marker at wipe-on polyurethane."],
    }),
  ], null),
};

withTemplates(SEED, TEMPLATES);
