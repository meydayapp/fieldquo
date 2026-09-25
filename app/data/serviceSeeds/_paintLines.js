// app/data/serviceSeeds/_paintLines.js
//
// The painting template lines interior_painting.js and exterior_painting.js
// share — seven languages written once (see _templateLines.js for why).
//
// Every measured line uses the field lib/pricing/paintTakeoff.js actually
// produces for a room: `wallSqft`, `ceilingSqft`, `floorSqft`, `linearFt`
// (the room perimeter — baseboard and trim run on it; the takeoff has no
// separate trim or baseboard field), `doorCount`; a window is counted with the generic `each`; cabinet
// lines use `doorCount` / `drawerCount` as lib/pricing/cabinetLabour.js
// reads them; exterior siding is the exterior takeoff's `wallSqft`; deck and fence the typed
// `areaSqFt` / `linearFt`.
//
// Prices are 2026 North-American residential repaint figures: $1.50–1.75 a
// sq ft of wall for two coats, $1.25–1.50 a ceiling, $2–2.50 a linear ft of
// trim, $75–100 a door side pair, $90–110 a cabinet door sprayed; paint at
// $0.40–0.50 a sq ft of wall for two coats of a premium acrylic.
import { L, hdMaterial } from "./_templateLines";
import { HD } from "./_materialCosts";

const t = (en, fr, es, it, de, uk, tl, pa) => ({ en, fr, es, it, de, uk, tl, pa });

export const PAINT = {
  walls: (price = 1.6) => L.labour(1, "sqft", price, t(
    ["Wall painting — per sq ft", "Walls cut in and rolled, two coats."],
    ["Peinture des murs — au pi²", "Murs découpés et roulés, deux couches."],
    ["Pintura de muros — por pie²", "Muros recortados y rodillados, dos manos."],
    ["Pittura pareti — al piede quadro", "Pareti profilate e rullate, due mani."],
    ["Wände streichen — pro sq ft", "Wände beigeschnitten und gerollt, zwei Anstriche."],
    ["Фарбування стін — за кв. фут", "Стіни обведено й прокатано валиком, два шари."],
    ["Pintura ng pader — kada sq ft", "Kinat-in at nirolyo ang pader, dalawang patong."],
    ["ਕੰਧਾਂ ਦੀ ਪੇਂਟਿੰਗ — ਪ੍ਰਤੀ ਵਰਗ ਫੁੱਟ", "ਕੰਧਾਂ ਦੇ ਕਿਨਾਰੇ ਕੱਟ ਕੇ ਰੋਲਰ ਨਾਲ ਦੋ ਕੋਟ।"],
  ), { measurementKey: "wallSqft" }),
  // Paint lines are bought by the gallon: cost from the Home Depot table,
  // coverage per gallon for two coats; the price argument is kept for the
  // call sites but the gallon price is the table's cost × the default markup.
  wallPaint: () => hdMaterial(HD.paint_interior_gal_2coats, t(
    ["Wall paint", "Premium acrylic eggshell; a 1 gal (3.79 L) can covers about 187 sq ft of wall in two coats."],
    ["Peinture murale", "Acrylique coquille d'œuf haut de gamme; un contenant de 3,79 L couvre environ 187 pi² de mur en deux couches."],
    ["Pintura para muros", "Acrílica premium cáscara de huevo; un bote de 1 galón (3.79 L) cubre unos 187 pies² de muro a dos manos."],
    ["Pittura murale", "Acrilica satinata di qualità; una latta da 1 gallone (3,79 L) copre circa 187 piedi quadri di parete in due mani."],
    ["Wandfarbe", "Hochwertige seidenmatte Acrylfarbe; ein 1-Gallonen-Gebinde (3,79 L) reicht für etwa 187 sq ft Wand in zwei Anstrichen."],
    ["Фарба для стін", "Преміальна шовковисто-матова акрилова фарба; банка 3,79 л покриває близько 187 кв. футів стіни у два шари."],
    ["Pintura sa pader", "Premium acrylic eggshell; ang isang 1 gal (3.79 L) na lata ay para sa mga 187 sq ft ng pader sa dalawang patong."],
    ["ਕੰਧਾਂ ਦਾ ਪੇਂਟ", "ਪ੍ਰੀਮੀਅਮ ਐਕ੍ਰਿਲਿਕ ਐੱਗਸ਼ੈੱਲ; 1 ਗੈਲਨ (3.79 L) ਦਾ ਡੱਬਾ ਦੋ ਕੋਟਾਂ ਵਿੱਚ ਲਗਭਗ 187 ਵਰਗ ਫੁੱਟ ਕੰਧ ਢੱਕਦਾ ਹੈ।"],
  ), { measurementKey: "wallSqft" }),
  ceilings: (price = 1.4) => L.labour(1, "sqft", price, t(
    ["Ceiling painting — per sq ft", "Ceiling rolled in flat ceiling paint, edges cut clean."],
    ["Peinture des plafonds — au pi²", "Plafond roulé en peinture mate, bordures découpées net."],
    ["Pintura de techos — por pie²", "Techo rodillado con pintura mate, bordes recortados limpios."],
    ["Pittura soffitti — al piede quadro", "Soffitto rullato con pittura opaca, bordi profilati puliti."],
    ["Decke streichen — pro sq ft", "Decke mit matter Deckenfarbe gerollt, Kanten sauber beigeschnitten."],
    ["Фарбування стелі — за кв. фут", "Стелю прокатано матовою фарбою, краї обведено чисто."],
    ["Pintura ng kisame — kada sq ft", "Nirolyo ang kisame ng flat na pintura, malinis ang gilid."],
    ["ਛੱਤ ਦੀ ਪੇਂਟਿੰਗ — ਪ੍ਰਤੀ ਵਰਗ ਫੁੱਟ", "ਛੱਤ ਉੱਤੇ ਫ਼ਲੈਟ ਪੇਂਟ ਰੋਲਰ ਨਾਲ, ਕਿਨਾਰੇ ਸਾਫ਼ ਕੱਟੇ।"],
  ), { measurementKey: "ceilingSqft" }),
  ceilingPaint: () => hdMaterial(HD.ceiling_paint_gal_2coats, t(
    ["Ceiling paint", "Flat ceiling white in two coats; the quantity follows the coverage of the can or pail the store sells."],
    ["Peinture à plafond", "Blanc plafond mat en deux couches; la quantité suit le rendement du contenant vendu en magasin."],
    ["Pintura para techo", "Blanco mate para techo a dos manos; la cantidad sigue el rendimiento del bote o cubeta de la tienda."],
    ["Pittura per soffitti", "Bianco soffitto opaco in due mani; la quantità segue la resa della latta o del secchio in vendita."],
    ["Deckenfarbe", "Mattes Deckenweiß in zwei Anstrichen; die Menge folgt der Ergiebigkeit des Gebindes im Handel."],
    ["Фарба для стелі", "Матова біла фарба для стелі у два шари; кількість залежить від витрати тари, яку продає магазин."],
    ["Pintura sa kisame", "Flat ceiling white sa dalawang patong; ang dami ay batay sa coverage ng lata o timba sa tindahan."],
    ["ਛੱਤ ਦਾ ਪੇਂਟ", "ਫ਼ਲੈਟ ਸੀਲਿੰਗ ਵ੍ਹਾਈਟ, ਦੋ ਕੋਟ; ਮਾਤਰਾ ਸਟੋਰ ਵਿੱਚ ਮਿਲਦੇ ਡੱਬੇ ਜਾਂ ਬਾਲਟੀ ਦੀ ਕਵਰੇਜ ਮੁਤਾਬਕ।"],
  ), { measurementKey: "ceilingSqft" }),
  trim: (price = 2.25) => L.labour(1, "linear_ft", price, t(
    ["Trim and baseboard painting — per linear ft", "Baseboards, casings and mouldings sanded, caulked and painted in trim enamel."],
    ["Peinture des moulures et plinthes — au pi lin.", "Plinthes, cadrages et moulures sablés, calfeutrés et peints en émail."],
    ["Pintura de molduras y zoclo — por pie lineal", "Zoclos, marcos y molduras lijados, sellados y pintados con esmalte."],
    ["Pittura battiscopa e cornici — al piede lineare", "Battiscopa, mostre e cornici carteggiati, sigillati e smaltati."],
    ["Leisten und Sockel streichen — pro lfd. Fuß", "Sockelleisten, Zargen und Profile geschliffen, versiegelt und lackiert."],
    ["Фарбування плінтусів і лиштв — за пог. фут", "Плінтуси, лиштви й молдинги відшліфовано, загерметизовано й пофарбовано емаллю."],
    ["Pintura ng trim at baseboard — kada linear ft", "Hinasa, kinaulk at pinintahan ng enamel ang baseboard, casing at molding."],
    ["ਟ੍ਰਿਮ ਅਤੇ ਬੇਸਬੋਰਡ ਪੇਂਟਿੰਗ — ਪ੍ਰਤੀ ਲੀਨੀਅਰ ਫੁੱਟ", "ਬੇਸਬੋਰਡ, ਕੇਸਿੰਗ ਅਤੇ ਮੋਲਡਿੰਗ ਰਗੜ ਕੇ, ਕੌਕ ਕਰਕੇ ਇਨੈਮਲ ਨਾਲ ਪੇਂਟ।"],
  ), { measurementKey: "linearFt" }),
  trimPaint: () => hdMaterial(HD.paint_trim_enamel_gal, t(
    ["Trim enamel", "Semi-gloss trim enamel; a 1 gal (3.79 L) can covers about 500 linear ft of trim in two coats."],
    ["Émail pour moulures", "Émail semi-lustré; un contenant de 3,79 L couvre environ 500 pi lin. de moulures en deux couches."],
    ["Esmalte para molduras", "Esmalte semibrillante; un bote de 1 galón (3.79 L) cubre unos 500 pies lineales de moldura a dos manos."],
    ["Smalto per cornici", "Smalto semilucido; una latta da 1 gallone (3,79 L) copre circa 500 piedi lineari di cornici in due mani."],
    ["Lack für Leisten", "Seidenglanzlack; ein 1-Gallonen-Gebinde (3,79 L) reicht für etwa 500 lfd. Fuß Leisten in zwei Anstrichen."],
    ["Емаль для плінтусів", "Напівглянцева емаль; банка 3,79 л на близько 500 пог. футів у два шари."],
    ["Trim enamel", "Semi-gloss na enamel; ang isang 1 gal (3.79 L) na lata ay para sa mga 500 linear ft sa dalawang patong."],
    ["ਟ੍ਰਿਮ ਇਨੈਮਲ", "ਸੈਮੀ-ਗਲੌਸ ਇਨੈਮਲ; 1 ਗੈਲਨ (3.79 L) ਦੋ ਕੋਟਾਂ ਵਿੱਚ ਲਗਭਗ 500 ਲੀਨੀਅਰ ਫੁੱਟ ਟ੍ਰਿਮ ਢੱਕਦਾ ਹੈ।"],
  ), { measurementKey: "linearFt" }),
  doors: (price = 85) => L.labour(1, "each", price, t(
    ["Door painting — per door", "Door prepped and painted both faces and edges, hardware off and refitted."],
    ["Peinture de porte — la porte", "Porte préparée et peinte des deux côtés et sur les chants, quincaillerie retirée et reposée."],
    ["Pintura de puerta — por puerta", "Puerta preparada y pintada por ambas caras y cantos, herrajes quitados y recolocados."],
    ["Pittura porta — per porta", "Porta preparata e verniciata su entrambe le facce e i bordi, ferramenta smontata e rimontata."],
    ["Tür streichen — pro Tür", "Tür vorbereitet und beidseitig samt Kanten lackiert, Beschläge ab- und wieder angebaut."],
    ["Фарбування дверей — за двері", "Двері підготовлено й пофарбовано з обох боків і по торцях, фурнітуру знято й повернуто."],
    ["Pintura ng pinto — kada pinto", "Inihanda at pinintahan ang dalawang mukha at gilid ng pinto, tinanggal at ibinalik ang hardware."],
    ["ਦਰਵਾਜ਼ੇ ਦੀ ਪੇਂਟਿੰਗ — ਪ੍ਰਤੀ ਦਰਵਾਜ਼ਾ", "ਦਰਵਾਜ਼ਾ ਤਿਆਰ ਕਰਕੇ ਦੋਵੇਂ ਪਾਸੇ ਅਤੇ ਕਿਨਾਰੇ ਪੇਂਟ, ਹਾਰਡਵੇਅਰ ਉਤਾਰ ਕੇ ਮੁੜ ਲਗਾਇਆ।"],
  ), { measurementKey: "doorCount" }),
  doorPaint: () => hdMaterial(HD.paint_trim_enamel_doors, t(
    ["Door enamel", "Semi-gloss enamel; a 1 gal (3.79 L) can does about four and a half doors, both sides, two coats."],
    ["Émail pour portes", "Émail semi-lustré; un contenant de 3,79 L fait environ quatre portes et demie, deux côtés, deux couches."],
    ["Esmalte para puertas", "Esmalte semibrillante; un bote de 1 galón (3.79 L) rinde unas cuatro puertas y media, ambos lados, dos manos."],
    ["Smalto per porte", "Smalto semilucido; una latta da 1 gallone (3,79 L) basta per circa quattro porte e mezzo, due lati, due mani."],
    ["Türlack", "Seidenglanzlack; ein 1-Gallonen-Gebinde (3,79 L) reicht für etwa viereinhalb Türen beidseitig in zwei Anstrichen."],
    ["Емаль для дверей", "Напівглянцева емаль; банки 3,79 л вистачає приблизно на чотири з половиною двері з обох боків у два шари."],
    ["Enamel sa pinto", "Semi-gloss na enamel; ang isang 1 gal (3.79 L) na lata ay para sa mga apat at kalahating pinto, dalawang side, dalawang patong."],
    ["ਦਰਵਾਜ਼ੇ ਲਈ ਇਨੈਮਲ", "ਸੈਮੀ-ਗਲੌਸ ਇਨੈਮਲ; 1 ਗੈਲਨ (3.79 L) ਲਗਭਗ ਸਾਢੇ ਚਾਰ ਦਰਵਾਜ਼ੇ, ਦੋਵੇਂ ਪਾਸੇ, ਦੋ ਕੋਟ।"],
  ), { measurementKey: "doorCount" }),
  windows: (price = 55) => L.labour(1, "each", price, t(
    ["Window frame painting — per window", "Sash, casing and sill prepped, caulked and painted."],
    ["Peinture de cadre de fenêtre — la fenêtre", "Châssis, cadrage et allège préparés, calfeutrés et peints."],
    ["Pintura de marco de ventana — por ventana", "Hoja, marco y alféizar preparados, sellados y pintados."],
    ["Pittura telaio finestra — per finestra", "Anta, mostra e davanzale preparati, sigillati e verniciati."],
    ["Fensterrahmen streichen — pro Fenster", "Flügel, Zarge und Bank vorbereitet, versiegelt und lackiert."],
    ["Фарбування віконної рами — за вікно", "Стулку, лиштву й підвіконня підготовлено, загерметизовано й пофарбовано."],
    ["Pintura ng frame ng bintana — kada bintana", "Inihanda, kinaulk at pinintahan ang sash, casing at sill."],
    ["ਖਿੜਕੀ ਦੇ ਫ਼ਰੇਮ ਦੀ ਪੇਂਟਿੰਗ — ਪ੍ਰਤੀ ਖਿੜਕੀ", "ਸੈਸ਼, ਕੇਸਿੰਗ ਅਤੇ ਸਿੱਲ ਤਿਆਰ ਕਰਕੇ, ਕੌਕ ਕਰਕੇ ਪੇਂਟ।"],
  ), { measurementKey: "each" }),
  cabinetDoors: (price = 100) => L.labour(1, "each", price, t(
    ["Cabinet door refinishing — per door", "Door off, degreased, sanded, primed and sprayed two coats, rehung."],
    ["Refinition de porte d'armoire — la porte", "Porte démontée, dégraissée, sablée, apprêtée et deux couches au pistolet, reposée."],
    ["Reacabado de puerta de gabinete — por puerta", "Puerta desmontada, desengrasada, lijada, imprimada y dos manos a pistola, recolgada."],
    ["Rifinitura anta di mobile — per anta", "Anta smontata, sgrassata, carteggiata, primerizzata e due mani a spruzzo, rimontata."],
    ["Schranktür neu lackieren — pro Tür", "Tür ab, entfettet, geschliffen, grundiert und zweimal gespritzt, wieder eingehängt."],
    ["Оновлення дверцят шафи — за дверцята", "Дверцята знято, знежирено, відшліфовано, заґрунтовано й двічі пофарбовано розпиленням."],
    ["Refinish ng pinto ng cabinet — kada pinto", "Tinanggal, nilinis, hinasa, nilagyan ng primer at dalawang spray, ikinabit ulit."],
    ["ਕੈਬਿਨੇਟ ਦਰਵਾਜ਼ੇ ਦੀ ਰੀਫ਼ਿਨਿਸ਼ਿੰਗ — ਪ੍ਰਤੀ ਦਰਵਾਜ਼ਾ", "ਦਰਵਾਜ਼ਾ ਉਤਾਰ ਕੇ ਚਿਕਨਾਈ ਸਾਫ਼, ਰਗੜਾਈ, ਪ੍ਰਾਈਮਰ ਅਤੇ ਦੋ ਕੋਟ ਸਪਰੇਅ, ਮੁੜ ਲਗਾਇਆ।"],
  ), { measurementKey: "doorCount" }),
  cabinetDrawers: (price = 70) => L.labour(1, "each", price, t(
    ["Drawer front refinishing — per drawer", "Front off, degreased, sanded, primed and sprayed two coats, refitted."],
    ["Refinition de façade de tiroir — le tiroir", "Façade démontée, dégraissée, sablée, apprêtée et deux couches au pistolet, reposée."],
    ["Reacabado de frente de cajón — por cajón", "Frente desmontado, desengrasado, lijado, imprimado y dos manos a pistola, remontado."],
    ["Rifinitura frontale cassetto — per cassetto", "Frontale smontato, sgrassato, carteggiato, primerizzato e due mani a spruzzo, rimontato."],
    ["Schubladenfront neu lackieren — pro Schublade", "Front ab, entfettet, geschliffen, grundiert und zweimal gespritzt, wieder montiert."],
    ["Оновлення фасаду шухляди — за шухляду", "Фасад знято, знежирено, відшліфовано, заґрунтовано й двічі пофарбовано розпиленням."],
    ["Refinish ng harap ng drawer — kada drawer", "Tinanggal, nilinis, hinasa, nilagyan ng primer at dalawang spray, ikinabit ulit."],
    ["ਦਰਾਜ਼ ਦੇ ਮੂਹਰੇ ਦੀ ਰੀਫ਼ਿਨਿਸ਼ਿੰਗ — ਪ੍ਰਤੀ ਦਰਾਜ਼", "ਮੂਹਰਾ ਉਤਾਰ ਕੇ ਚਿਕਨਾਈ ਸਾਫ਼, ਰਗੜਾਈ, ਪ੍ਰਾਈਮਰ ਅਤੇ ਦੋ ਕੋਟ ਸਪਰੇਅ, ਮੁੜ ਲਗਾਇਆ।"],
  ), { measurementKey: "drawerCount" }),
  cabinetCoating: () => hdMaterial(HD.paint_trim_enamel_cabinet, t(
    ["Cabinet enamel", "Urethane-modified cabinet enamel; a 1 gal (3.79 L) can does about fifteen cabinet doors, both faces."],
    ["Émail à armoires", "Émail à armoires modifié à l'uréthane; un contenant de 3,79 L fait environ quinze portes, deux faces."],
    ["Esmalte para gabinetes", "Esmalte para gabinetes modificado con uretano; un bote de 1 galón (3.79 L) rinde unas quince puertas, ambas caras."],
    ["Smalto per mobili", "Smalto per mobili modificato uretanico; una latta da 1 gallone (3,79 L) basta per circa quindici ante, due facce."],
    ["Möbellack", "Urethanmodifizierter Möbellack; ein 1-Gallonen-Gebinde (3,79 L) reicht für etwa fünfzehn Schranktüren beidseitig."],
    ["Емаль для шаф", "Модифікована уретаном емаль; банки 3,79 л вистачає приблизно на п'ятнадцять дверцят з обох боків."],
    ["Cabinet enamel", "Urethane-modified na cabinet enamel; ang isang 1 gal (3.79 L) na lata ay para sa mga labinlimang pinto, dalawang mukha."],
    ["ਕੈਬਿਨੇਟ ਇਨੈਮਲ", "ਯੂਰੇਥੇਨ-ਮਿਲਿਆ ਕੈਬਿਨੇਟ ਇਨੈਮਲ; 1 ਗੈਲਨ (3.79 L) ਲਗਭਗ ਪੰਦਰਾਂ ਦਰਵਾਜ਼ੇ, ਦੋਵੇਂ ਪਾਸੇ।"],
  ), { measurementKey: "doorCount" }),
  stainWood: (price = 2.4, key = "areaSqFt") => L.labour(1, "sqft", price, t(
    ["Staining — per sq ft", "Wood cleaned, sanded where needed and stained, then sealed."],
    ["Teinture — au pi²", "Bois nettoyé, sablé au besoin, teint puis scellé."],
    ["Tinte — por pie²", "Madera limpiada, lijada donde hace falta, teñida y sellada."],
    ["Impregnazione — al piede quadro", "Legno pulito, carteggiato dove serve, impregnato e sigillato."],
    ["Beizen — pro sq ft", "Holz gereinigt, wo nötig geschliffen, gebeizt und versiegelt."],
    ["Тонування — за кв. фут", "Деревину очищено, де треба відшліфовано, протоновано й покрито захистом."],
    ["Pag-stain — kada sq ft", "Nilinis, hinasa kung kailangan, ini-stain at sinelyuhan ang kahoy."],
    ["ਸਟੇਨਿੰਗ — ਪ੍ਰਤੀ ਵਰਗ ਫੁੱਟ", "ਲੱਕੜ ਸਾਫ਼ ਕਰਕੇ, ਲੋੜ ਹੋਵੇ ਤਾਂ ਰਗੜ ਕੇ ਸਟੇਨ ਅਤੇ ਫਿਰ ਸੀਲ।"],
  ), { measurementKey: key }),
  deckStain: () => hdMaterial(HD.deck_stain_gal, t(
    ["Deck and fence stain — per gallon", "Semi-transparent penetrating stain; one gallon covers about 200 sq ft in one coat."],
    ["Teinture pour terrasse et clôture — au gallon", "Teinture pénétrante semi-transparente; un gallon couvre environ 200 pi² en une couche."],
    ["Tinte para terraza y cerca — por galón", "Tinte penetrante semitransparente; un galón cubre unos 200 pies² a una mano."],
    ["Impregnante per deck e recinzioni — al gallone", "Impregnante penetrante semitrasparente; un gallone copre circa 200 piedi quadri in una mano."],
    ["Terrassen- und Zaunbeize — pro Gallone", "Halbtransparente, eindringende Beize; eine Gallone reicht für etwa 200 sq ft in einem Anstrich."],
    ["Морилка для тераси й паркану — за галон", "Напівпрозора проникна морилка; галон покриває близько 200 кв. футів в один шар."],
    ["Stain sa deck at bakod — kada galon", "Semi-transparent na penetrating stain; ang isang galon ay para sa mga 200 sq ft sa isang patong."],
    ["ਡੈੱਕ ਅਤੇ ਵਾੜ ਦਾ ਸਟੇਨ — ਪ੍ਰਤੀ ਗੈਲਨ", "ਅੱਧਾ-ਪਾਰਦਰਸ਼ੀ ਅੰਦਰ ਰਚਣ ਵਾਲਾ ਸਟੇਨ; ਇੱਕ ਗੈਲਨ ਇੱਕ ਕੋਟ ਵਿੱਚ ਲਗਭਗ 200 ਵਰਗ ਫੁੱਟ।"],
  ), { measurementKey: "areaSqFt" }),
  stain: (price = 0.55, key = "areaSqFt") => L.material(1, "sqft", price, t(
    ["Stain and sealer — per sq ft", "Penetrating stain and a clear protective sealer."],
    ["Teinture et scellant — au pi²", "Teinture pénétrante et scellant protecteur clair."],
    ["Tinte y sellador — por pie²", "Tinte penetrante y sellador protector transparente."],
    ["Impregnante e sigillante — al piede quadro", "Impregnante penetrante e sigillante protettivo trasparente."],
    ["Beize und Versiegelung — pro sq ft", "Eindringende Beize und klare Schutzversiegelung."],
    ["Морилка та захисне покриття — за кв. фут", "Проникна морилка та прозоре захисне покриття."],
    ["Stain at sealer — kada sq ft", "Penetrating na stain at malinaw na protective sealer."],
    ["ਸਟੇਨ ਅਤੇ ਸੀਲਰ — ਪ੍ਰਤੀ ਵਰਗ ਫੁੱਟ", "ਅੰਦਰ ਰਚਣ ਵਾਲਾ ਸਟੇਨ ਅਤੇ ਸਾਫ਼ ਸੁਰੱਖਿਆ ਸੀਲਰ।"],
  ), { measurementKey: key }),
  siding: (price = 2.1) => L.labour(1, "sqft", price, t(
    ["Exterior siding painting — per sq ft", "Siding washed, scraped, spot-primed and painted two coats."],
    ["Peinture du revêtement extérieur — au pi²", "Revêtement lavé, gratté, apprêté par endroits et peint en deux couches."],
    ["Pintura de revestimiento exterior — por pie²", "Revestimiento lavado, raspado, imprimado en puntos y pintado a dos manos."],
    ["Pittura rivestimento esterno — al piede quadro", "Rivestimento lavato, raschiato, primerizzato a punti e verniciato in due mani."],
    ["Fassade streichen — pro sq ft", "Verkleidung gewaschen, abgekratzt, punktuell grundiert und zweimal gestrichen."],
    ["Фарбування фасаду — за кв. фут", "Обшивку вимито, зачищено, точково заґрунтовано й пофарбовано у два шари."],
    ["Pintura ng siding — kada sq ft", "Hinugasan, kinayod, nilagyan ng primer sa ilang bahagi at dalawang patong ang siding."],
    ["ਬਾਹਰੀ ਸਾਈਡਿੰਗ ਪੇਂਟਿੰਗ — ਪ੍ਰਤੀ ਵਰਗ ਫੁੱਟ", "ਸਾਈਡਿੰਗ ਧੋ ਕੇ, ਖੁਰਚ ਕੇ, ਥਾਂ-ਥਾਂ ਪ੍ਰਾਈਮਰ ਅਤੇ ਦੋ ਕੋਟ ਪੇਂਟ।"],
  ), { measurementKey: "wallSqft" }),
  exteriorPaint: () => hdMaterial(HD.paint_exterior_gal_2coats, t(
    ["Exterior paint", "Exterior acrylic; a 1 gal (3.79 L) can covers about 160 sq ft of siding in two coats."],
    ["Peinture extérieure", "Acrylique extérieur; un contenant de 3,79 L couvre environ 160 pi² de revêtement en deux couches."],
    ["Pintura exterior", "Acrílica exterior; un bote de 1 galón (3.79 L) cubre unos 160 pies² de revestimiento a dos manos."],
    ["Pittura per esterni", "Acrilica per esterni; una latta da 1 gallone (3,79 L) copre circa 160 piedi quadri di rivestimento in due mani."],
    ["Außenfarbe", "Außen-Acrylfarbe; ein 1-Gallonen-Gebinde (3,79 L) reicht für etwa 160 sq ft Fassade in zwei Anstrichen."],
    ["Фасадна фарба", "Фасадна акрилова фарба; банка 3,79 л покриває близько 160 кв. футів обшивки у два шари."],
    ["Pintura sa labas", "Exterior acrylic; ang isang 1 gal (3.79 L) na lata ay para sa mga 160 sq ft ng siding sa dalawang patong."],
    ["ਬਾਹਰੀ ਪੇਂਟ", "ਬਾਹਰੀ ਐਕ੍ਰਿਲਿਕ; 1 ਗੈਲਨ (3.79 L) ਦੋ ਕੋਟਾਂ ਵਿੱਚ ਲਗਭਗ 160 ਵਰਗ ਫੁੱਟ ਸਾਈਡਿੰਗ।"],
  ), { measurementKey: "wallSqft" }),
};
