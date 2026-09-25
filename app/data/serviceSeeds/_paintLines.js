// app/data/serviceSeeds/_paintLines.js
//
// The painting template lines interior_painting.js and exterior_painting.js
// share — seven languages written once (see _templateLines.js for why).
//
// Every measured line uses the field lib/pricing/paintTakeoff.js actually
// produces for a room: `wallSqft`, `ceilingSqft`, `floorSqft`, `linearFt`
// (the room perimeter — baseboard and trim run on it; the takeoff has no
// separate trim or baseboard field), `doorCount`, `windowCount`; cabinet
// lines use `doorCount` / `drawerCount` as lib/pricing/cabinetLabour.js
// reads them; deck, fence and siding use the generic `areaSqFt` / `linearFt`.
//
// Prices are 2026 North-American residential repaint figures: $1.50–1.75 a
// sq ft of wall for two coats, $1.25–1.50 a ceiling, $2–2.50 a linear ft of
// trim, $75–100 a door side pair, $90–110 a cabinet door sprayed; paint at
// $0.40–0.50 a sq ft of wall for two coats of a premium acrylic.
import { L, hdMaterial } from "./_templateLines";
import { HD } from "./_materialCosts";

const t = (en, fr, es, it, de, uk, tl) => ({ en, fr, es, it, de, uk, tl });

export const PAINT = {
  walls: (price = 1.6) => L.labour(1, "sqft", price, t(
    ["Wall painting — per sq ft", "Walls cut in and rolled, two coats."],
    ["Peinture des murs — au pi²", "Murs découpés et roulés, deux couches."],
    ["Pintura de muros — por pie²", "Muros recortados y rodillados, dos manos."],
    ["Pittura pareti — al piede quadro", "Pareti profilate e rullate, due mani."],
    ["Wände streichen — pro sq ft", "Wände beigeschnitten und gerollt, zwei Anstriche."],
    ["Фарбування стін — за кв. фут", "Стіни обведено й прокатано валиком, два шари."],
    ["Pintura ng pader — kada sq ft", "Kinat-in at nirolyo ang pader, dalawang patong."],
  ), { measurementKey: "wallSqft" }),
  // Paint lines are bought by the gallon: cost from the Home Depot table,
  // coverage per gallon for two coats; the price argument is kept for the
  // call sites but the gallon price is the table's cost × the default markup.
  wallPaint: () => hdMaterial(HD.paint_interior_gal_2coats, t(
    ["Wall paint — per gallon", "Premium acrylic eggshell; one gallon covers about 187 sq ft of wall in two coats."],
    ["Peinture murale — au gallon", "Acrylique coquille d'œuf haut de gamme; un gallon couvre environ 187 pi² de mur en deux couches."],
    ["Pintura para muros — por galón", "Acrílica premium cáscara de huevo; un galón cubre unos 187 pies² de muro a dos manos."],
    ["Pittura murale — al gallone", "Acrilica satinata di qualità; un gallone copre circa 187 piedi quadri di parete in due mani."],
    ["Wandfarbe — pro Gallone", "Hochwertige seidenmatte Acrylfarbe; eine Gallone reicht für etwa 187 sq ft Wand in zwei Anstrichen."],
    ["Фарба для стін — за галон", "Преміальна шовковисто-матова акрилова фарба; галон покриває близько 187 кв. футів стіни у два шари."],
    ["Pintura sa pader — kada galon", "Premium acrylic eggshell; ang isang galon ay para sa mga 187 sq ft ng pader sa dalawang patong."],
  ), { measurementKey: "wallSqft" }),
  ceilings: (price = 1.4) => L.labour(1, "sqft", price, t(
    ["Ceiling painting — per sq ft", "Ceiling rolled in flat ceiling paint, edges cut clean."],
    ["Peinture des plafonds — au pi²", "Plafond roulé en peinture mate, bordures découpées net."],
    ["Pintura de techos — por pie²", "Techo rodillado con pintura mate, bordes recortados limpios."],
    ["Pittura soffitti — al piede quadro", "Soffitto rullato con pittura opaca, bordi profilati puliti."],
    ["Decke streichen — pro sq ft", "Decke mit matter Deckenfarbe gerollt, Kanten sauber beigeschnitten."],
    ["Фарбування стелі — за кв. фут", "Стелю прокатано матовою фарбою, краї обведено чисто."],
    ["Pintura ng kisame — kada sq ft", "Nirolyo ang kisame ng flat na pintura, malinis ang gilid."],
  ), { measurementKey: "ceilingSqft" }),
  ceilingPaint: () => hdMaterial(HD.ceiling_paint_gal_2coats, t(
    ["Ceiling paint — per gallon", "Flat ceiling white; one gallon covers about 187 sq ft of ceiling in two coats."],
    ["Peinture à plafond — au gallon", "Blanc plafond mat; un gallon couvre environ 187 pi² de plafond en deux couches."],
    ["Pintura para techo — por galón", "Blanco mate para techo; un galón cubre unos 187 pies² de techo a dos manos."],
    ["Pittura per soffitti — al gallone", "Bianco soffitto opaco; un gallone copre circa 187 piedi quadri di soffitto in due mani."],
    ["Deckenfarbe — pro Gallone", "Mattes Deckenweiß; eine Gallone reicht für etwa 187 sq ft Decke in zwei Anstrichen."],
    ["Фарба для стелі — за галон", "Матова біла фарба для стелі; галон покриває близько 187 кв. футів у два шари."],
    ["Pintura sa kisame — kada galon", "Flat ceiling white; ang isang galon ay para sa mga 187 sq ft ng kisame sa dalawang patong."],
  ), { measurementKey: "ceilingSqft" }),
  trim: (price = 2.25) => L.labour(1, "linear_ft", price, t(
    ["Trim and baseboard painting — per linear ft", "Baseboards, casings and mouldings sanded, caulked and painted in trim enamel."],
    ["Peinture des moulures et plinthes — au pi lin.", "Plinthes, cadrages et moulures sablés, calfeutrés et peints en émail."],
    ["Pintura de molduras y zoclo — por pie lineal", "Zoclos, marcos y molduras lijados, sellados y pintados con esmalte."],
    ["Pittura battiscopa e cornici — al piede lineare", "Battiscopa, mostre e cornici carteggiati, sigillati e smaltati."],
    ["Leisten und Sockel streichen — pro lfd. Fuß", "Sockelleisten, Zargen und Profile geschliffen, versiegelt und lackiert."],
    ["Фарбування плінтусів і лиштв — за пог. фут", "Плінтуси, лиштви й молдинги відшліфовано, загерметизовано й пофарбовано емаллю."],
    ["Pintura ng trim at baseboard — kada linear ft", "Hinasa, kinaulk at pinintahan ng enamel ang baseboard, casing at molding."],
  ), { measurementKey: "linearFt" }),
  trimPaint: (price = 0.3) => L.material(1, "linear_ft", price, t(
    ["Trim enamel — per linear ft", "Semi-gloss waterborne trim enamel and caulk."],
    ["Émail pour moulures — au pi lin.", "Émail semi-lustré à l'eau et calfeutrant."],
    ["Esmalte para molduras — por pie lineal", "Esmalte semibrillante base agua y sellador."],
    ["Smalto per cornici — al piede lineare", "Smalto semilucido all'acqua e sigillante."],
    ["Lack für Leisten — pro lfd. Fuß", "Seidenglänzender Wasserlack und Acryl."],
    ["Емаль для плінтусів — за пог. фут", "Напівглянцева емаль на водній основі та герметик."],
    ["Trim enamel — kada linear ft", "Semi-gloss na waterborne enamel at caulk."],
  ), { measurementKey: "linearFt" }),
  doors: (price = 85) => L.labour(1, "each", price, t(
    ["Door painting — per door", "Door prepped and painted both faces and edges, hardware off and refitted."],
    ["Peinture de porte — la porte", "Porte préparée et peinte des deux côtés et sur les chants, quincaillerie retirée et reposée."],
    ["Pintura de puerta — por puerta", "Puerta preparada y pintada por ambas caras y cantos, herrajes quitados y recolocados."],
    ["Pittura porta — per porta", "Porta preparata e verniciata su entrambe le facce e i bordi, ferramenta smontata e rimontata."],
    ["Tür streichen — pro Tür", "Tür vorbereitet und beidseitig samt Kanten lackiert, Beschläge ab- und wieder angebaut."],
    ["Фарбування дверей — за двері", "Двері підготовлено й пофарбовано з обох боків і по торцях, фурнітуру знято й повернуто."],
    ["Pintura ng pinto — kada pinto", "Inihanda at pinintahan ang dalawang mukha at gilid ng pinto, tinanggal at ibinalik ang hardware."],
  ), { measurementKey: "doorCount" }),
  doorPaint: (price = 12) => L.material(1, "each", price, t(
    ["Door enamel — per door", "Semi-gloss enamel and primer for one door."],
    ["Émail à porte — la porte", "Émail semi-lustré et apprêt pour une porte."],
    ["Esmalte para puerta — por puerta", "Esmalte semibrillante e imprimador para una puerta."],
    ["Smalto per porta — per porta", "Smalto semilucido e primer per una porta."],
    ["Türlack — pro Tür", "Seidenglanzlack und Grundierung für eine Tür."],
    ["Емаль для дверей — за двері", "Напівглянцева емаль і ґрунт на одні двері."],
    ["Enamel sa pinto — kada pinto", "Semi-gloss na enamel at primer para sa isang pinto."],
  ), { measurementKey: "doorCount" }),
  windows: (price = 55) => L.labour(1, "each", price, t(
    ["Window frame painting — per window", "Sash, casing and sill prepped, caulked and painted."],
    ["Peinture de cadre de fenêtre — la fenêtre", "Châssis, cadrage et allège préparés, calfeutrés et peints."],
    ["Pintura de marco de ventana — por ventana", "Hoja, marco y alféizar preparados, sellados y pintados."],
    ["Pittura telaio finestra — per finestra", "Anta, mostra e davanzale preparati, sigillati e verniciati."],
    ["Fensterrahmen streichen — pro Fenster", "Flügel, Zarge und Bank vorbereitet, versiegelt und lackiert."],
    ["Фарбування віконної рами — за вікно", "Стулку, лиштву й підвіконня підготовлено, загерметизовано й пофарбовано."],
    ["Pintura ng frame ng bintana — kada bintana", "Inihanda, kinaulk at pinintahan ang sash, casing at sill."],
  ), { measurementKey: "windowCount" }),
  cabinetDoors: (price = 100) => L.labour(1, "each", price, t(
    ["Cabinet door refinishing — per door", "Door off, degreased, sanded, primed and sprayed two coats, rehung."],
    ["Refinition de porte d'armoire — la porte", "Porte démontée, dégraissée, sablée, apprêtée et deux couches au pistolet, reposée."],
    ["Reacabado de puerta de gabinete — por puerta", "Puerta desmontada, desengrasada, lijada, imprimada y dos manos a pistola, recolgada."],
    ["Rifinitura anta di mobile — per anta", "Anta smontata, sgrassata, carteggiata, primerizzata e due mani a spruzzo, rimontata."],
    ["Schranktür neu lackieren — pro Tür", "Tür ab, entfettet, geschliffen, grundiert und zweimal gespritzt, wieder eingehängt."],
    ["Оновлення дверцят шафи — за дверцята", "Дверцята знято, знежирено, відшліфовано, заґрунтовано й двічі пофарбовано розпиленням."],
    ["Refinish ng pinto ng cabinet — kada pinto", "Tinanggal, nilinis, hinasa, nilagyan ng primer at dalawang spray, ikinabit ulit."],
  ), { measurementKey: "doorCount" }),
  cabinetDrawers: (price = 70) => L.labour(1, "each", price, t(
    ["Drawer front refinishing — per drawer", "Front off, degreased, sanded, primed and sprayed two coats, refitted."],
    ["Refinition de façade de tiroir — le tiroir", "Façade démontée, dégraissée, sablée, apprêtée et deux couches au pistolet, reposée."],
    ["Reacabado de frente de cajón — por cajón", "Frente desmontado, desengrasado, lijado, imprimado y dos manos a pistola, remontado."],
    ["Rifinitura frontale cassetto — per cassetto", "Frontale smontato, sgrassato, carteggiato, primerizzato e due mani a spruzzo, rimontato."],
    ["Schubladenfront neu lackieren — pro Schublade", "Front ab, entfettet, geschliffen, grundiert und zweimal gespritzt, wieder montiert."],
    ["Оновлення фасаду шухляди — за шухляду", "Фасад знято, знежирено, відшліфовано, заґрунтовано й двічі пофарбовано розпиленням."],
    ["Refinish ng harap ng drawer — kada drawer", "Tinanggal, nilinis, hinasa, nilagyan ng primer at dalawang spray, ikinabit ulit."],
  ), { measurementKey: "drawerCount" }),
  cabinetCoating: (price = 14) => L.material(1, "each", price, t(
    ["Cabinet primer and enamel — per door", "Bonding primer and urethane-modified cabinet enamel."],
    ["Apprêt et émail à armoires — la porte", "Apprêt d'adhérence et émail à armoires modifié à l'uréthane."],
    ["Imprimador y esmalte para gabinetes — por puerta", "Imprimador adherente y esmalte para gabinetes modificado con uretano."],
    ["Primer e smalto per mobili — per anta", "Primer ancorante e smalto per mobili modificato uretanico."],
    ["Haftgrund und Möbellack — pro Tür", "Haftgrund und urethanmodifizierter Möbellack."],
    ["Ґрунт і емаль для шаф — за дверцята", "Адгезійний ґрунт і модифікована уретаном емаль для шаф."],
    ["Primer at cabinet enamel — kada pinto", "Bonding primer at urethane-modified na cabinet enamel."],
  ), { measurementKey: "doorCount" }),
  stainWood: (price = 2.4, key = "areaSqFt") => L.labour(1, "sqft", price, t(
    ["Staining — per sq ft", "Wood cleaned, sanded where needed and stained, then sealed."],
    ["Teinture — au pi²", "Bois nettoyé, sablé au besoin, teint puis scellé."],
    ["Tinte — por pie²", "Madera limpiada, lijada donde hace falta, teñida y sellada."],
    ["Impregnazione — al piede quadro", "Legno pulito, carteggiato dove serve, impregnato e sigillato."],
    ["Beizen — pro sq ft", "Holz gereinigt, wo nötig geschliffen, gebeizt und versiegelt."],
    ["Тонування — за кв. фут", "Деревину очищено, де треба відшліфовано, протоновано й покрито захистом."],
    ["Pag-stain — kada sq ft", "Nilinis, hinasa kung kailangan, ini-stain at sinelyuhan ang kahoy."],
  ), { measurementKey: key }),
  deckStain: () => hdMaterial(HD.deck_stain_gal, t(
    ["Deck and fence stain — per gallon", "Semi-transparent penetrating stain; one gallon covers about 200 sq ft in one coat."],
    ["Teinture pour terrasse et clôture — au gallon", "Teinture pénétrante semi-transparente; un gallon couvre environ 200 pi² en une couche."],
    ["Tinte para terraza y cerca — por galón", "Tinte penetrante semitransparente; un galón cubre unos 200 pies² a una mano."],
    ["Impregnante per deck e recinzioni — al gallone", "Impregnante penetrante semitrasparente; un gallone copre circa 200 piedi quadri in una mano."],
    ["Terrassen- und Zaunbeize — pro Gallone", "Halbtransparente, eindringende Beize; eine Gallone reicht für etwa 200 sq ft in einem Anstrich."],
    ["Морилка для тераси й паркану — за галон", "Напівпрозора проникна морилка; галон покриває близько 200 кв. футів в один шар."],
    ["Stain sa deck at bakod — kada galon", "Semi-transparent na penetrating stain; ang isang galon ay para sa mga 200 sq ft sa isang patong."],
  ), { measurementKey: "areaSqFt" }),
  stain: (price = 0.55, key = "areaSqFt") => L.material(1, "sqft", price, t(
    ["Stain and sealer — per sq ft", "Penetrating stain and a clear protective sealer."],
    ["Teinture et scellant — au pi²", "Teinture pénétrante et scellant protecteur clair."],
    ["Tinte y sellador — por pie²", "Tinte penetrante y sellador protector transparente."],
    ["Impregnante e sigillante — al piede quadro", "Impregnante penetrante e sigillante protettivo trasparente."],
    ["Beize und Versiegelung — pro sq ft", "Eindringende Beize und klare Schutzversiegelung."],
    ["Морилка та захисне покриття — за кв. фут", "Проникна морилка та прозоре захисне покриття."],
    ["Stain at sealer — kada sq ft", "Penetrating na stain at malinaw na protective sealer."],
  ), { measurementKey: key }),
  siding: (price = 2.1) => L.labour(1, "sqft", price, t(
    ["Exterior siding painting — per sq ft", "Siding washed, scraped, spot-primed and painted two coats."],
    ["Peinture du revêtement extérieur — au pi²", "Revêtement lavé, gratté, apprêté par endroits et peint en deux couches."],
    ["Pintura de revestimiento exterior — por pie²", "Revestimiento lavado, raspado, imprimado en puntos y pintado a dos manos."],
    ["Pittura rivestimento esterno — al piede quadro", "Rivestimento lavato, raschiato, primerizzato a punti e verniciato in due mani."],
    ["Fassade streichen — pro sq ft", "Verkleidung gewaschen, abgekratzt, punktuell grundiert und zweimal gestrichen."],
    ["Фарбування фасаду — за кв. фут", "Обшивку вимито, зачищено, точково заґрунтовано й пофарбовано у два шари."],
    ["Pintura ng siding — kada sq ft", "Hinugasan, kinayod, nilagyan ng primer sa ilang bahagi at dalawang patong ang siding."],
  ), { measurementKey: "areaSqFt" }),
  exteriorPaint: () => hdMaterial(HD.paint_exterior_gal_2coats, t(
    ["Exterior paint — per gallon", "Exterior satin acrylic; one gallon covers about 160 sq ft of siding in two coats."],
    ["Peinture extérieure — au gallon", "Acrylique extérieur satiné; un gallon couvre environ 160 pi² de revêtement en deux couches."],
    ["Pintura exterior — por galón", "Acrílica exterior satinada; un galón cubre unos 160 pies² de revestimiento a dos manos."],
    ["Pittura per esterni — al gallone", "Acrilica satinata per esterni; un gallone copre circa 160 piedi quadri di rivestimento in due mani."],
    ["Außenfarbe — pro Gallone", "Seidenglänzende Außen-Acrylfarbe; eine Gallone reicht für etwa 160 sq ft Fassade in zwei Anstrichen."],
    ["Фасадна фарба — за галон", "Сатинова фасадна акрилова фарба; галон покриває близько 160 кв. футів обшивки у два шари."],
    ["Pintura sa labas — kada galon", "Exterior satin acrylic; ang isang galon ay para sa mga 160 sq ft ng siding sa dalawang patong."],
  ), { measurementKey: "areaSqFt" }),
};
