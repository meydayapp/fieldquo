// app/data/serviceSeeds/exterior_painting.js
//
// The exterior half of the painting book — read ./interior_painting.js and
// ./index.js. Exterior siding, trim, fascia, decks and fences are priced per
// sq ft by the painting takeoff and the exterior_painting price book; those
// rows are kept as references with `pricedBy: "takeoff"`.
import { L, SHARED, D, T, withTemplates, tagRows, withLanguages } from "./_templateLines";
import { PAINT } from "./_paintLines";
import { I18N } from "./i18n/exterior_painting.js";

const BM = (low, median, high) => ({ low, median, high, currency: "USD", source: "benchmark", asOf: "2026-09-21" });
const S = (seedKey, category, unit, benchmark, [en, fr, es], [den, dfr, des], extra = {}) => ({
  seedKey, category, name: { en, fr, es }, description: { en: den, fr: dfr, es: des },
  unit, benchmark, durationMinutes: null, bookable: false, ...extra,
});

export const SEED = {
  trade: "exterior_painting",
  categories: [
    { key: "exterior", name: { en: "Exterior components", fr: "Éléments extérieurs", es: "Elementos exteriores" } },
  ],
  services: [
    S("fq.exterior_painting.exterior.deck_fence", "exterior", "sqft", null,
      ["Deck and fence painting or staining", "Peinture ou teinture de terrasse et de clôture", "Pintura o tinte de terraza y cerca"],
      ["Decks and fences washed, sanded where needed and stained or painted to protect the wood from weather.",
       "Terrasses et clôtures lavées, sablées au besoin et teintes ou peintes pour protéger le bois des intempéries.",
       "Terrazas y cercas lavadas, lijadas donde haga falta y teñidas o pintadas para proteger la madera del clima."],
      { pricedBy: "takeoff", existing: "exterior_painting deck / fence per sq ft." }),
    S("fq.exterior_painting.exterior.fascia_soffit", "exterior", "linear_ft", null,
      ["Fascia and soffit painting", "Peinture de bordures de toit et soffites", "Pintura de fascia y sofito"],
      ["Fascia boards and soffits scraped, primed and painted to protect the roofline and sharpen the look.",
       "Bordures de toit et soffites grattés, apprêtés et peints pour protéger la ligne de toit et soigner l'apparence.",
       "Fascias y sofitos raspados, imprimados y pintados para proteger la línea del techo y mejorar el aspecto."],
      { pricedBy: "takeoff", existing: "exterior_painting fascia per linear ft." }),
    S("fq.exterior_painting.exterior.garage_door", "exterior", "each", null,
      ["Garage door painting", "Peinture de porte de garage", "Pintura de puerta de garaje"],
      ["The garage door cleaned, scuffed and painted to match or refresh the exterior.",
       "Porte de garage nettoyée, dépolie et peinte pour s'agencer à l'extérieur ou le rafraîchir.",
       "Puerta de garaje limpiada, lijada y pintada para combinar con el exterior o renovarlo."]),
    S("fq.exterior_painting.exterior.paint_stain_residential", "exterior", "flat", BM(950, 1541, 2862),
      ["Exterior painting and staining — decks, fences and masonry", "Peinture et teinture extérieures — terrasses, clôtures et maçonnerie", "Pintura y tinte exterior — terrazas, cercas y mampostería"],
      ["Decks, fences and masonry surfaces painted or stained with the right coating for each material.",
       "Terrasses, clôtures et surfaces de maçonnerie peintes ou teintes avec le bon revêtement pour chaque matériau.",
       "Terrazas, cercas y superficies de mampostería pintadas o teñidas con el recubrimiento adecuado para cada material."],
      { existing: "exterior_painting deck / fence per sq ft; masonry is not in the takeoff." }),
    S("fq.exterior_painting.exterior.surfaces_and_trim", "exterior", "flat", BM(2100, 4500, 6500),
      ["Exterior painting — siding, trim and fences", "Peinture extérieure — revêtement, moulures et clôtures", "Pintura exterior — revestimiento, molduras y cercas"],
      ["Siding, trim and fences washed, prepped and painted as one exterior project.",
       "Revêtement, moulures et clôtures lavés, préparés et peints en un seul projet extérieur.",
       "Revestimiento, molduras y cercas lavados, preparados y pintados como un solo proyecto exterior."],
      { pricedBy: "takeoff", existing: "exterior_painting siding / trim / fence per sq ft." }),
    // ── Added 2026-09-24 with the estimate templates ──────────────────────
    S("fq.exterior_painting.exterior.wood_rot_repair", "exterior", "linear_ft", null,
      ["Exterior wood rot repair", "Réparation de bois pourri extérieur", "Reparación de madera podrida exterior"],
      ["Rotted trim, fascia or sill cut out, replaced with primed stock or consolidated and filled, then primed for paint.", "Moulure, bordure ou allège pourrie découpée, remplacée par du bois apprêté ou consolidée et comblée, puis apprêtée pour la peinture.", "Moldura, fascia o alféizar podridos cortados, reemplazados con madera imprimada o consolidados y rellenados, e imprimados para pintar."]),
    S("fq.exterior_painting.exterior.scrape_prime", "exterior", "sqft", null,
      ["Peeling paint scrape and prime", "Grattage et apprêt de peinture écaillée", "Raspado e imprimación de pintura descascarada"],
      ["Loose and peeling paint scraped and sanded to a sound edge and the bare wood spot-primed before the finish coats.", "Peinture lâche et écaillée grattée et sablée jusqu'à un bord sain, bois nu apprêté avant les couches de finition.", "Pintura suelta y descascarada raspada y lijada hasta un borde firme, madera desnuda imprimada antes de las manos de acabado."]),
    S("fq.exterior_painting.exterior.condition_inspection", "exterior", "flat", null,
      ["Exterior paint condition inspection", "Inspection de l'état de la peinture extérieure", "Inspección del estado de la pintura exterior"],
      ["Siding, trim and wood checked for peeling, chalking, rot and moisture, with photos and a written list of what needs doing.", "Revêtement, moulures et bois vérifiés pour l'écaillage, le farinage, la pourriture et l'humidité, avec photos et liste écrite des travaux.", "Revestimiento, molduras y madera revisados por descascarado, entizado, pudrición y humedad, con fotos y una lista escrita de trabajos."]),
    S("fq.exterior_painting.exterior.estimate_visit", "exterior", "flat", null,
      ["Exterior painting estimate visit", "Visite d'estimation — peinture extérieure", "Visita de presupuesto — pintura exterior"],
      ["The house walked and measured, colours discussed and a written price left for the exterior repaint.", "Maison parcourue et mesurée, couleurs discutées et prix écrit laissé pour la peinture extérieure.", "Casa recorrida y medida, colores conversados y un precio por escrito para la pintura exterior."], { durationMinutes: 60, bookable: true }),
    S("fq.exterior_painting.exterior.pressure_wash", "exterior", "sqft", null,
      ["Exterior pressure wash", "Lavage à pression extérieur", "Lavado a presión exterior"],
      ["Siding, trim and decks washed to lift dirt, mildew and chalk so the surface is clean for paint or simply refreshed.", "Revêtement, moulures et terrasses lavés pour enlever saleté, moisissure et farinage, prêts pour la peinture ou simplement rafraîchis.", "Revestimiento, molduras y terrazas lavados para quitar suciedad, moho y entizado, listos para pintar o simplemente renovados."]),
    S("fq.exterior_painting.exterior.touch_up", "exterior", "flat", null,
      ["Exterior paint touch-up", "Retouches de peinture extérieure", "Retoques de pintura exterior"],
      ["Scrapes, bare spots and trim wear on a recent paint job spot-primed and touched up to match.", "Éraflures, zones nues et usure des moulures d'une peinture récente apprêtées localement et retouchées à l'identique.", "Rayones, zonas desnudas y desgaste de molduras de una pintura reciente imprimados en puntos y retocados a juego."]),
  ],
};

// ── Estimate templates ───────────────────────────────────────────────────────
//
// Evidence: as interior_painting.js — the painting capture names the five
// exterior components, the benchmark sets the two totals it has ($1,541 deck
// and masonry staining, $4,500 full exterior), and the lines are the shared
// 2026 rates in _paintLines.js with paint and stain by the gallon at Home
// Depot cost. Siding is the exterior takeoff's `wallSqft`, deck and fence areas `areaSqFt`, fascia and soffit
// the eave run (`linearFt`), garage doors a count. Quote type: exterior
// painting, sub-type exterior; the staining rows also carry staining.
const EXT = { categories: ["exterior_painting"], estimateTypes: ["exterior"] };
const STAIN = { categories: ["exterior_painting"], estimateTypes: ["exterior", "staining"] };
const n = (it, de, uk, tl) => ({ it, de, uk, tl });

const TEMPLATES = {
  "fq.exterior_painting.exterior.surfaces_and_trim": T("installation", n(
    ["Pittura esterni — rivestimento, cornici e recinzioni", "Rivestimento, cornici e recinzioni lavati, preparati e verniciati come unico progetto esterno."],
    ["Außenanstrich — Fassade, Leisten und Zäune", "Fassade, Leisten und Zäune gewaschen, vorbereitet und als ein Außenprojekt gestrichen."],
    ["Фарбування фасаду — обшивка, лиштви та паркани", "Обшивку, лиштви й паркани вимито, підготовлено й пофарбовано як один зовнішній проєкт."],
    ["Pintura sa labas — siding, trim at bakod", "Hinugasan, inihanda at pininturahan ang siding, trim at bakod bilang isang proyekto."],
  ), [PAINT.siding(), PAINT.trim(2.5), PAINT.exteriorPaint()], D.newCustomer("fixed", 150), EXT),

  "fq.exterior_painting.exterior.fascia_soffit": T("installation", n(
    ["Pittura sporti e sottogronda", "Frontalini e sottogronda raschiati, primerizzati e verniciati per proteggere la linea del tetto."],
    ["Traufbretter und Untersichten streichen", "Traufbretter und Untersichten abgekratzt, grundiert und gestrichen, um die Dachkante zu schützen."],
    ["Фарбування лобових дощок і софітів", "Лобові дошки й софіти зачищено, заґрунтовано й пофарбовано для захисту карниза."],
    ["Pintura ng fascia at soffit", "Kinayod, nilagyan ng primer at pininturahan ang fascia at soffit para protektahan ang gilid ng bubong."],
  ), [
    L.labour(1, "linear_ft", 4.5, {
      en: ["Fascia and soffit painting — per linear ft", "Fascia board and soffit scraped, spot-primed and painted two coats along the eave."],
      fr: ["Peinture de bordure et soffite — au pi lin.", "Bordure et soffite grattés, apprêtés par endroits et peints en deux couches le long de l'avant-toit."],
      es: ["Pintura de fascia y sofito — por pie lineal", "Fascia y sofito raspados, imprimados en puntos y pintados a dos manos a lo largo del alero."],
      it: ["Pittura frontalino e sottogronda — al piede lineare", "Frontalino e sottogronda raschiati, primerizzati a punti e verniciati in due mani lungo la gronda."],
      de: ["Traufe und Untersicht — pro lfd. Fuß", "Traufbrett und Untersicht abgekratzt, punktuell grundiert und zweimal entlang der Traufe gestrichen."],
      uk: ["Лобова дошка та софіт — за пог. фут", "Лобову дошку й софіт зачищено, точково заґрунтовано й пофарбовано у два шари вздовж карниза."],
      tl: ["Pintura ng fascia at soffit — kada linear ft", "Kinayod, nilagyan ng primer at dalawang patong ang fascia at soffit sa kahabaan ng eave."],
    }, { measurementKey: "linearFt" }),
    L.material(1, "linear_ft", 0.6, {
      en: ["Exterior trim paint — per linear ft", "Exterior satin and primer for fascia and soffit."],
      fr: ["Peinture extérieure pour moulures — au pi lin.", "Satiné extérieur et apprêt pour bordure et soffite."],
      es: ["Pintura exterior para molduras — por pie lineal", "Satinada exterior e imprimador para fascia y sofito."],
      it: ["Pittura per cornici esterne — al piede lineare", "Satinato per esterni e primer per frontalino e sottogronda."],
      de: ["Außenlack für Traufe — pro lfd. Fuß", "Seidenglänzende Außenfarbe und Grundierung für Traufe und Untersicht."],
      uk: ["Фарба для зовнішніх лиштв — за пог. фут", "Сатинова фасадна фарба та ґрунт для лобових дощок і софітів."],
      tl: ["Pintura sa trim sa labas — kada linear ft", "Exterior satin at primer para sa fascia at soffit."],
    }, { measurementKey: "linearFt" }),
  ], null, EXT),

  "fq.exterior_painting.exterior.garage_door": T("installation", n(
    ["Pittura porta del garage", "Porta del garage pulita, carteggiata e verniciata per abbinarsi o rinfrescare l'esterno."],
    ["Garagentor streichen", "Garagentor gereinigt, angeschliffen und passend oder auffrischend gestrichen."],
    ["Фарбування гаражних воріт", "Гаражні ворота вимито, зашліфовано й пофарбовано в тон фасаду або для оновлення."],
    ["Pintura ng pinto ng garahe", "Nilinis, hinasa at pininturahan ang pinto ng garahe para tumugma o mag-refresh."],
  ), [
    L.labour(1, "each", 260, {
      en: ["Garage door painting — per door", "Door washed, scuffed, panel edges cut in and rolled two coats."],
      fr: ["Peinture de porte de garage — la porte", "Porte lavée, égrenée, contours des panneaux découpés et deux couches au rouleau."],
      es: ["Pintura de puerta de garaje — por puerta", "Puerta lavada, lijada, bordes de paneles recortados y dos manos con rodillo."],
      it: ["Pittura porta garage — per porta", "Porta lavata, carteggiata, bordi dei pannelli profilati e due mani a rullo."],
      de: ["Garagentor streichen — pro Tor", "Tor gewaschen, angeschliffen, Paneelkanten beigeschnitten und zweimal gerollt."],
      uk: ["Фарбування гаражних воріт — за ворота", "Ворота вимито, зашліфовано, краї панелей обведено й прокатано у два шари."],
      tl: ["Pintura ng garage door — kada pinto", "Hinugasan, hinasa, kinat-in ang gilid ng panel at nirolyo ng dalawang patong."],
    }, { measurementKey: "each" }),
    L.material(1, "each", 45, {
      en: ["Exterior paint — per door", "About a gallon of exterior satin and bonding primer for one door."],
      fr: ["Peinture extérieure — la porte", "Environ un gallon de satiné extérieur et apprêt d'adhérence pour une porte."],
      es: ["Pintura exterior — por puerta", "Cerca de un galón de satinada exterior e imprimador adherente para una puerta."],
      it: ["Pittura per esterni — per porta", "Circa un gallone di satinato per esterni e primer ancorante per una porta."],
      de: ["Außenfarbe — pro Tor", "Etwa eine Gallone seidenglänzende Außenfarbe und Haftgrund für ein Tor."],
      uk: ["Фасадна фарба — за ворота", "Близько галона сатинової фасадної фарби та адгезійного ґрунту на одні ворота."],
      tl: ["Pintura sa labas — kada pinto", "Mga isang galon ng exterior satin at bonding primer para sa isang pinto."],
    }, { measurementKey: "each" }),
  ], null, EXT),

  "fq.exterior_painting.exterior.paint_stain_residential": T("installation", n(
    ["Pittura e impregnazione esterni — deck, recinzioni e muratura", "Deck, recinzioni e superfici in muratura verniciati o impregnati con il prodotto giusto per ogni materiale."],
    ["Außenanstrich und Beize — Terrassen, Zäune und Mauerwerk", "Terrassen, Zäune und Mauerwerk mit der passenden Beschichtung für jedes Material gestrichen oder gebeizt."],
    ["Фарбування й тонування зовні — тераси, паркани, кладка", "Тераси, паркани й кам'яні поверхні пофарбовано або протоновано засобом, що підходить кожному матеріалу."],
    ["Pintura at stain sa labas — deck, bakod at masonry", "Pininturahan o ini-stain ang deck, bakod at masonry gamit ang tamang coating sa bawat materyal."],
  ), [PAINT.stainWood(), PAINT.deckStain()], null, STAIN),

  // ── Repair ──
  "fq.exterior_painting.exterior.wood_rot_repair": T("repair", n(
    ["Riparazione legno marcio esterno", "Cornici, frontalini o davanzali marci tagliati e sostituiti o consolidati e stuccati, poi primerizzati."],
    ["Reparatur morscher Außenhölzer", "Morsche Leisten, Traufbretter oder Bänke herausgeschnitten und ersetzt oder gefestigt und gespachtelt, dann grundiert."],
    ["Ремонт гнилої деревини зовні", "Гнилі лиштви, лобові дошки чи підвіконня вирізано й замінено або зміцнено й зашпакльовано, потім заґрунтовано."],
    ["Pag-ayos ng bulok na kahoy sa labas", "Pinutol at pinalitan o pinatibay at tinapalan ang bulok na trim, fascia o sill, tapos nilagyan ng primer."],
  ), [
    L.labour(1, "linear_ft", 14, {
      en: ["Rot repair — per linear ft", "Soft wood cut back to sound, new primed stock scarfed in or epoxy filler shaped."],
      fr: ["Réparation de pourriture — au pi lin.", "Bois mou coupé jusqu'au sain, nouvelle pièce apprêtée greffée ou mastic époxy façonné."],
      es: ["Reparación de pudrición — por pie lineal", "Madera blanda cortada hasta lo sano, pieza nueva imprimada empalmada o relleno epóxico moldeado."],
      it: ["Riparazione marcescenza — al piede lineare", "Legno molle tagliato fino al sano, nuovo pezzo primerizzato innestato o stucco epossidico modellato."],
      de: ["Fäulnisreparatur — pro lfd. Fuß", "Weiches Holz bis ins Gesunde zurückgeschnitten, neues grundiertes Stück eingesetzt oder Epoxidspachtel modelliert."],
      uk: ["Ремонт гнилі — за пог. фут", "М'яку деревину вирізано до здорової, вставлено нову заґрунтовану або сформовано епоксидну шпаклівку."],
      tl: ["Pag-ayos ng bulok — kada linear ft", "Pinutol ang malambot hanggang matibay na kahoy, isiningit ang bagong primed stock o hinubog ang epoxy filler."],
    }, { measurementKey: "linearFt" }),
    L.material(1, "linear_ft", 4.5, {
      en: ["Primed trim stock and epoxy — per linear ft", "Primed PVC or wood trim, epoxy consolidant and filler, fasteners."],
      fr: ["Moulure apprêtée et époxy — au pi lin.", "Moulure apprêtée en PVC ou en bois, consolidant et mastic époxy, fixations."],
      es: ["Moldura imprimada y epóxico — por pie lineal", "Moldura imprimada de PVC o madera, consolidante y relleno epóxico, fijaciones."],
      it: ["Cornice primerizzata ed epossidico — al piede lineare", "Cornice primerizzata in PVC o legno, consolidante e stucco epossidico, fissaggi."],
      de: ["Grundierte Leiste und Epoxid — pro lfd. Fuß", "Grundierte PVC- oder Holzleiste, Epoxid-Festiger und -Spachtel, Befestiger."],
      uk: ["Ґрунтована лиштва та епоксид — за пог. фут", "Ґрунтована лиштва з ПВХ або дерева, епоксидний зміцнювач і шпаклівка, кріплення."],
      tl: ["Primed trim at epoxy — kada linear ft", "Primed na PVC o kahoy na trim, epoxy consolidant at filler, fastener."],
    }, { measurementKey: "linearFt" }),
  ], null, EXT),

  "fq.exterior_painting.exterior.scrape_prime": T("repair", n(
    ["Raschiatura e primer della pittura che si sfoglia", "Pittura sollevata raschiata e carteggiata fino a un bordo sano e legno nudo primerizzato prima delle mani di finitura."],
    ["Abblätternde Farbe abkratzen und grundieren", "Lose Farbe bis zu einer festen Kante abgekratzt und geschliffen, blankes Holz vor dem Deckanstrich grundiert."],
    ["Зачистка й ґрунтування облущеної фарби", "Облущену фарбу зішкрябано й зашліфовано до міцного краю, оголене дерево заґрунтовано перед фінішними шарами."],
    ["Pagkayod at primer ng natutuklap na pintura", "Kinayod at hinasa ang natutuklap na pintura hanggang matibay na gilid at nilagyan ng primer ang hubad na kahoy."],
  ), [
    L.labour(1, "sqft", 1.1, {
      en: ["Scraping and sanding — per sq ft", "Loose paint scraped, edges feathered with a sander."],
      fr: ["Grattage et sablage — au pi²", "Peinture lâche grattée, bords adoucis à la sableuse."],
      es: ["Raspado y lijado — por pie²", "Pintura suelta raspada, bordes difuminados con lijadora."],
      it: ["Raschiatura e carteggiatura — al piede quadro", "Pittura sollevata raschiata, bordi sfumati con levigatrice."],
      de: ["Abkratzen und Schleifen — pro sq ft", "Lose Farbe abgekratzt, Kanten mit dem Schleifer beigeschliffen."],
      uk: ["Зачистка та шліфування — за кв. фут", "Облущену фарбу зішкрябано, краї розтушовано шліфмашиною."],
      tl: ["Pagkayod at paghasa — kada sq ft", "Kinayod ang natutuklap na pintura at pinakinis ang gilid gamit ang sander."],
    }, { measurementKey: "wallSqft" }),
    L.labour(1, "sqft", 0.45, {
      en: ["Spot priming — per sq ft", "Bare wood primed with an exterior bonding primer."],
      fr: ["Apprêt localisé — au pi²", "Bois nu apprêté avec un apprêt d'adhérence extérieur."],
      es: ["Imprimación en puntos — por pie²", "Madera desnuda imprimada con imprimador adherente exterior."],
      it: ["Primer a punti — al piede quadro", "Legno nudo primerizzato con primer ancorante per esterni."],
      de: ["Punktuelles Grundieren — pro sq ft", "Blankes Holz mit Außen-Haftgrund grundiert."],
      uk: ["Точкове ґрунтування — за кв. фут", "Оголене дерево заґрунтовано зовнішнім адгезійним ґрунтом."],
      tl: ["Spot priming — kada sq ft", "Nilagyan ng exterior bonding primer ang hubad na kahoy."],
    }, { measurementKey: "wallSqft" }),
  ], null, EXT),

  // ── Inspection ──
  "fq.exterior_painting.exterior.condition_inspection": T("inspection", n(
    ["Ispezione dello stato della pittura esterna", "Rivestimento, cornici e legno controllati per sfogliature, sfarinamento, marcescenza e umidità, con foto e lista scritta."],
    ["Zustandsprüfung des Außenanstrichs", "Fassade, Leisten und Holz auf Abblättern, Kreiden, Fäulnis und Feuchte geprüft, mit Fotos und schriftlicher Liste."],
    ["Огляд стану зовнішнього фарбування", "Обшивку, лиштви й деревину перевірено на лущення, крейдування, гниль і вологу, з фото та письмовим переліком."],
    ["Inspeksyon ng kondisyon ng pintura sa labas", "Chineck ang siding, trim at kahoy sa pagtuklap, chalking, bulok at halumigmig, may litrato at nakasulat na listahan."],
  ), [
    L.labour(1, "flat", 125, {
      en: ["Condition inspection", "Every elevation checked, moisture read on suspect wood."],
      fr: ["Inspection de l'état", "Chaque façade vérifiée, humidité mesurée sur le bois suspect."],
      es: ["Inspección de estado", "Cada fachada revisada, humedad medida en la madera sospechosa."],
      it: ["Ispezione dello stato", "Ogni prospetto controllato, umidità misurata sul legno sospetto."],
      de: ["Zustandsprüfung", "Jede Ansicht geprüft, Feuchte an verdächtigem Holz gemessen."],
      uk: ["Огляд стану", "Кожен фасад перевірено, вологість підозрілої деревини виміряно."],
      tl: ["Inspeksyon ng kondisyon", "Chineck ang bawat gilid ng bahay at sinukat ang halumigmig ng kahinahinalang kahoy."],
    }),
    SHARED.report(40),
  ], null, EXT),

  "fq.exterior_painting.exterior.estimate_visit": T("inspection", n(
    ["Sopralluogo per preventivo di pittura esterna", "Casa percorsa e misurata, colori discussi e prezzo scritto lasciato per la ripittura esterna."],
    ["Angebotsbesichtigung Außenanstrich", "Haus abgegangen und aufgemessen, Farben besprochen und ein schriftlicher Preis für den Außenanstrich hinterlassen."],
    ["Візит для оцінки фарбування фасаду", "Будинок обійдено й виміряно, кольори обговорено, залишено письмову ціну на перефарбування."],
    ["Estimate visit para sa pintura sa labas", "Nilibot at sinukat ang bahay, pinag-usapan ang kulay at iniwan ang nakasulat na presyo."],
  ), [
    L.labour(1, "flat", 0, {
      en: ["Exterior estimate", "House measured and a written price left; free with a signed quote."],
      fr: ["Estimation extérieure", "Maison mesurée et prix écrit laissé; gratuit avec une soumission signée."],
      es: ["Presupuesto exterior", "Casa medida y precio por escrito entregado; gratis con presupuesto firmado."],
      it: ["Preventivo esterno", "Casa misurata e prezzo scritto lasciato; gratuito con preventivo firmato."],
      de: ["Außenangebot", "Haus aufgemessen und schriftlicher Preis hinterlassen; kostenlos bei unterschriebenem Angebot."],
      uk: ["Оцінка фасаду", "Будинок виміряно, залишено письмову ціну; безкоштовно за підписаного кошторису."],
      tl: ["Estimate sa labas", "Sinukat ang bahay at iniwan ang presyo; libre kapag pumirma sa quote."],
    }, { cost: 0 }),
  ], null, EXT),

  // ── Maintenance ──
  "fq.exterior_painting.exterior.deck_fence": T("maintenance", n(
    ["Pittura o impregnazione di deck e recinzioni", "Deck e recinzioni lavati, carteggiati dove serve e impregnati o verniciati per proteggere il legno."],
    ["Terrassen und Zäune streichen oder beizen", "Terrassen und Zäune gewaschen, wo nötig geschliffen und gebeizt oder gestrichen, um das Holz zu schützen."],
    ["Фарбування або тонування терас і парканів", "Тераси й паркани вимито, де треба зашліфовано, протоновано або пофарбовано для захисту деревини."],
    ["Pintura o stain ng deck at bakod", "Hinugasan, hinasa kung kailangan at ini-stain o pininturahan ang deck at bakod para protektahan ang kahoy."],
  ), [PAINT.stainWood(2.25), PAINT.deckStain()], D.seasonal("percent", 10), STAIN),

  "fq.exterior_painting.exterior.pressure_wash": T("maintenance", n(
    ["Idropulizia esterna", "Rivestimento, cornici e deck lavati per togliere sporco, muffa e sfarinamento, pronti per la pittura o semplicemente rinfrescati."],
    ["Außen-Hochdruckreinigung", "Fassade, Leisten und Terrassen gewaschen, um Schmutz, Schimmel und Kreidung zu lösen — streichfertig oder einfach aufgefrischt."],
    ["Миття зовнішніх поверхонь під тиском", "Обшивку, лиштви й тераси вимито від бруду, цвілі та крейдування — під фарбування або просто для оновлення."],
    ["Pressure wash sa labas", "Hinugasan ang siding, trim at deck para matanggal ang dumi, amag at chalk, handa sa pintura o pang-refresh."],
  ), [
    L.labour(1, "sqft", 0.3, {
      en: ["Soft wash — per sq ft", "Mildewcide applied and rinsed at low pressure so the siding is not forced."],
      fr: ["Lavage doux — au pi²", "Antimoisissure appliqué et rincé à basse pression pour ne pas forcer le revêtement."],
      es: ["Lavado suave — por pie²", "Antimoho aplicado y enjuagado a baja presión para no forzar el revestimiento."],
      it: ["Lavaggio delicato — al piede quadro", "Antimuffa applicato e risciacquato a bassa pressione per non forzare il rivestimento."],
      de: ["Sanfte Wäsche — pro sq ft", "Schimmelmittel aufgetragen und mit Niederdruck gespült, ohne die Fassade zu belasten."],
      uk: ["М'яке миття — за кв. фут", "Засіб від цвілі нанесено й змито низьким тиском, щоб не пошкодити обшивку."],
      tl: ["Soft wash — kada sq ft", "Nilagyan ng mildewcide at hinugasan sa mababang pressure para hindi masira ang siding."],
    }, { measurementKey: "wallSqft" }),
  ], D.seasonal("fixed", 25), EXT),

  "fq.exterior_painting.exterior.touch_up": T("maintenance", n(
    ["Ritocchi di pittura esterna", "Graffi, zone nude e usura delle cornici di una pittura recente primerizzati a punti e ritoccati in tinta."],
    ["Außenanstrich ausbessern", "Kratzer, blanke Stellen und Leistenverschleiß an einem neueren Anstrich punktuell grundiert und farbgleich ausgebessert."],
    ["Підфарбовування фасаду", "Подряпини, оголені місця й знос лиштв на недавньому фарбуванні точково заґрунтовано й підфарбовано в тон."],
    ["Touch-up ng pintura sa labas", "Nilagyan ng primer at tinakpan ng katugmang kulay ang gasgas, hubad na bahagi at gasgas na trim."],
  ), [
    L.labour(2, "hour", 75, {
      en: ["Touch-up labour", "Spots primed and colour-matched paint applied, by the hour."],
      fr: ["Main-d'œuvre — retouches", "Zones apprêtées et peinture assortie appliquée, à l'heure."],
      es: ["Mano de obra — retoques", "Puntos imprimados y pintura igualada aplicada, por hora."],
      it: ["Manodopera — ritocchi", "Punti primerizzati e pittura in tinta applicata, a ore."],
      de: ["Arbeit — Ausbessern", "Stellen grundiert und farbgleich gestrichen, nach Stunden."],
      uk: ["Робота — підфарбовування", "Місця заґрунтовано й нанесено фарбу в тон, погодинно."],
      tl: ["Labor — touch-up", "Nilagyan ng primer at katugmang pintura, kada oras."],
    }),
    SHARED.consumables(30),
  ], null, EXT),
};

withLanguages(SEED, I18N);
withTemplates(SEED, TEMPLATES);

// Shared services: one canonical row here, installed for these quote types too.
tagRows(SEED, {
  "fq.exterior_painting.exterior.pressure_wash": ["pressure_washing_house", "deck_patio", "window_cleaning"],
  "fq.exterior_painting.exterior.deck_fence": ["deck_patio", "handyman", "fence_services"],
});
