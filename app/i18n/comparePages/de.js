// German (de) — /compare, plus the add-on stack /pricing shares with it.
//
// Drafted, not natively reviewed. Formal address (Sie) throughout, matching
// messages.js. Vocabulary held to what the rest of the German catalogue
// already uses: Tarif = plan, Stufe = tier, Platz = seat, Teammitglieder =
// crew, KI-Telefonassistent = AI receptionist, Zusatzmodul = add-on.
//
// The sentences that CONCEDE or HEDGE were translated last and kept exactly as
// narrow as the English: unverifiedConcessionNote still says we did not check
// rather than that they lack it, staleClaimNote still blames the age of our own
// reading, and matchUnknownIntro / theirTiersNoMatchNote still refuse the claim
// in both directions. If any of them reads as a promise in German, that is a
// bug and the English is the pin.
//
// Two things a reviewer should look at. compare.thisListFrom takes a colon
// ("Diese Liste: {provenance}") because {provenance} arrives as an English
// fragment from competitors.js and cannot be declined into a German clause —
// the colon makes it read as a quoted note instead of broken grammar.
// compare.availability.absent says "in dieser Stufe nicht enthalten", which is
// slightly redundant inside compare.featureOnThisTier; the renderer only ever
// passes included / addOn / our own value into that frame, so the standalone
// reading was the one worth getting right.

const de = {
  "compare.eyebrow": "Vergleich",
  "compare.indexTitle": "FieldQuo im Vergleich",
  "compare.indexLede": "Fünf Vergleiche, jeder aus dem gebaut, was das andere Unternehmen auf seiner eigenen Website veröffentlicht. Hier wird nichts zwischen Währungen umgerechnet, nichts ist ein Aktionspreis, und was wir nicht klären konnten, wird benannt statt geraten. Einer der fünf startet günstiger als wir, und diese Seite sagt das, bevor sie irgendetwas anderes sagt.",
  "compare.rulesTitle": "Wie diese Seiten gebaut sind",
  "compare.entryGapTitle": "Sie starten günstiger als wir",
  "compare.entryGapIntro": "Nicht jeder Vergleich auf dieser Website geht für uns aus, und dieser tut es nicht. Die beiden Preise unten sind ihre veröffentlichte Zahl und unsere eigene günstigste Stufe — beide aus denselben Aufzeichnungen gelesen, mit denen auch der Rest dieser Seite arbeitet.",
  "compare.entryGapTheirListIntro": "Was ihre eigene Seite bei diesem Tarif aufführt, in ihren Worten:",
  "compare.entryGapAdvice": "Wenn das die Arbeit ist, die Sie erledigt brauchen, kaufen Sie ihres. Das schreiben wir lieber hier hin, als jemandem mehr Software zu verkaufen, als er nutzt, und ihm bei der Rückerstattung wieder zu begegnen. Was die Antwort ändert, ist ein Team: Bei ihren Tarifen zählt jeder Zugang als bezahlter Nutzer, bei unseren nicht.",
  "compare.theirTiersTitle": "Was jeder ihrer Tarife dazulegt, in ihren Worten",
  "compare.theirTiersIntro": "Ihre eigenen Beschreibungen ihrer eigenen Stufen, zitiert, wie ihre Seite sie zeigt, und daneben der Preis, bei dem jede landet. Nichts davon haben wir in unser Vokabular übersetzt: Die Funktion eines Wettbewerbers umzubenennen, damit sie zu einer von uns passt, ist genau der Weg, auf dem ein Vergleich stillschweigend zum Strohmann wird. Die Worte unten sind also ihre, und unsere Liste steht weiter unten auf dieser Seite, getrennt davon.",
  "compare.theirTiersNoMatchNote": "Niemand hat Funktion für Funktion geklärt, welche ihrer Stufen welche der Fähigkeiten enthält, die wir verkaufen. Ihre Seite beschreibt ihre Tarife in Fließtext, und unsere Recherche hält keine Antwort Stufe für Stufe fest. Diese Seite erhebt deshalb in keine der beiden Richtungen eine zugeordnete Behauptung — lesen Sie ihre Liste, lesen Sie unsere, und entscheiden Sie.",
  "compare.matchUnknownIntro": "Niemand hat geklärt, welche ihrer Stufen das enthält, deshalb nennt diese Seite keine. Das ist keine Behauptung, dass es ihnen fehlt — wir haben es nicht geprüft, und eine Seite, die Ungeprüftes als Fehlen behandelt, ist eine Seite, die sich etwas ausdenkt.",
  "compare.aiMeteringTitle": "Wie jede Seite ihre KI abrechnet",
  "compare.aiMeteringIntro": "Ihre wird als monatliches Kontingent verkauft, das sich mit der Stufe ändert und auf ihrer eigenen Seite steht. Unsere wird nicht so verkauft, und die ehrliche Fassung dieses Satzes hat zwei Hälften.",
  "compare.aiMeteringOurs": "FieldQuo verkauft KI nicht nach Credits: Auf unserer Preisseite gibt es kein Kontingent je Tarif, das aufgebraucht werden kann, und kein größeres Paket, für das man aufsteigt. Der Telefonassistent ist in jedem Tarif enthalten, die Gesprächszeit kaufen Sie separat als Guthaben im Voraus, ohne monatliche Mindestabnahme — ein Monat ohne Anrufe kostet dafür also nichts. Die andere Hälfte, die ebenfalls hierher gehört: Die Modellnutzung wird je Betrieb gegen eine Obergrenze gezählt, die wir intern setzen. Nichts auf dieser Seite behauptet also, sie sei unbegrenzt.",
  "compare.concessionTitle": "Was FieldQuo nicht macht",
  "compare.concessionIntro": "Dieser Abschnitt steht auf jeder dieser Seiten, an derselben Stelle, über dem Teil, in dem wir gut aussehen. Eine Vergleichstabelle, die nur aus unseren Siegen besteht, verkauft jemandem ein Abo, für das er sein Geld zurückverlangt.",
  "compare.unverifiedConcessionNote": "Wir haben nicht geprüft, ob dieses Unternehmen das anbietet, deshalb sagen wir nicht, dass es das tut.",
  "compare.staleClaimNote": "Dieser Stand ist älter als drei Monate, deshalb wird jeder Betrag darin zurückgehalten, bis jemand ihre Seite erneut prüft. Folgen Sie dem Link und sehen Sie, was dort heute steht.",
  "compare.advantageTitle": "Wo FieldQuo vorn liegt",
  "compare.advantageIntro": "Jeder dieser Punkte wurde am angegebenen Datum von ihrer eigenen Seite abgelesen. Folgen Sie dem Link und prüfen Sie es — dafür ist der Link da.",
  "compare.priceTitle": "Der Preis, so wie ihn jedes Unternehmen veröffentlicht",
  "compare.featuresTitle": "Was Sie mit FieldQuo bekommen",
  "compare.featuresIntro": "Jede Zeile unten ist eine Funktion, hinter der eine Umsetzung steht. Die Liste wird aus derselben Aufstellung erzeugt, gegen die auch die technischen Prüfungen laufen — eine Funktion, die aufhört zu funktionieren, hört auf, beworben zu werden.",
  "compare.ctaTitle": "Erster Monat gratis mit hinterlegter Karte — und den Preis können Sie lesen, bevor Sie anfangen",
  "compare.ctaBody": "Kein Termin, den Sie erst buchen müssen, und der Preis steht auf der Preisseite statt hinter einem Formular. Ihre Karte wird bei der Anmeldung hinterlegt und erst belastet, wenn der Gratismonat endet.",
  "compare.ctaButton": "Ihren Gratismonat starten",
  "compare.ctaSecondary": "Preise ansehen",
  "compare.otherPagesTitle": "Die anderen Vergleiche",
  "compare.rule.1": "Jeder Preis ist der reguläre Preis, den das Unternehmen auf seiner eigenen Preisseite abdruckt. Aktionspreise bleiben draußen: Eine Seite wie diese wird einmal gebaut und monatelang ausgeliefert — sie kann nicht merken, dass ein Angebot ausgelaufen ist.",
  "compare.rule.2": "Beträge bleiben in der Währung, in der sie veröffentlicht wurden. Wir rechnen nie um. Ein Wechselkurs stimmt an dem Tag, an dem man ihn nachschlägt, und am nächsten nicht mehr — und eine umgerechnete Zahl auf einer statischen Seite ist eine Rechnung, die niemand nachprüft.",
  "compare.rule.3": "Wo wir nicht klären konnten, was eine Zahl bedeutet, sagt die Zeile das und zeigt keine Zahl. Das kommt häufiger vor, als Sie vermuten würden, und es ist der Teil der Seite, dem wir am meisten trauen.",
  "compare.rule.4": "Jede Zahl trägt das Datum, an dem sie abgelesen wurde, und das Land, aus dem sie abgelesen wurde — denn ein Preis kann sich nach beidem unterscheiden.",

  "compare.lede.jobber": "Jobber verkauft seine Marketing Suite, seinen KI-Telefonassistenten und seine Vertriebspipeline als separate monatliche Zusatzmodule — {addOnTotal} im Monat obendrauf, auf einen Tarif, dessen Preis sich ohnehin schon mit Ihrer Teamgröße bewegt. FieldQuo hat alle drei in jedem Tarif, bei jedem Preis, und jeder, der im Transporter sitzt, ist gratis.",
  "compare.concession.jobber": "Fangen wir mit dem an, was wir nicht haben. FieldQuo ist eine Webanwendung: Es gibt nichts, was man aus einem App-Store installiert, nichts funktioniert ohne Empfang, und es gibt keinen Vertriebsmitarbeiter, der Sie hindurchführt.",
  "compare.lede.housecall_pro": "Housecall Pro berechnet jeden zusätzlichen Nutzer, der Tarifpreis ist also nur der Anfang Ihrer Rechnung. FieldQuo berechnet die Leute, die tatsächlich Arbeit kalkulieren — Angebote, Aufträge, Rechnungen — und jeder, der im Transporter sitzt, zählt als Team, kostenlos. Jede Funktion steckt in jedem Tarif, ab {ourEntry}.",
  "compare.concession.housecall_pro": "Zuerst der ehrliche Teil. Die Seite von Housecall Pro führt eine Handy-App, Offline-Zugriff und eine geführte Demo als Standard auf. FieldQuo hat keines der drei — und wenn eines davon für Sie den Ausschlag gibt, sind sie der bessere Kauf.",
  "compare.lede.servicetitan": "Auf der Preisseite von ServiceTitan steht nirgends ein Dollarbetrag — Sie buchen eine Demo, und die Zahl wird an Ihrem Umsatz und Ihrer Mitarbeiterzahl ausgehandelt. Betriebe berichten von monatlichen Gebühren je Techniker, dazu eine fünfstellige Gebühr für die Einführung und ein mehrjähriger Vertrag. Jeder FieldQuo-Preis steht auf dieser Seite, es gibt keine Einrichtungsgebühr, und Sie können heute Abend anfangen, ohne mit jemandem zu sprechen.",
  "compare.concession.servicetitan": "Was wir nicht bieten können, zuerst gesagt: keine Handy-App, nichts, was ohne Netz funktioniert, und niemanden, der Sie herumführt, bevor Sie sich entscheiden.",
  "compare.lede.projul": "Projul verlangt eine pauschale Jahresbindung im Voraus. FieldQuo kostet {ourEntry} im Monat für einen Platz und fünf Teammitglieder, alle Funktionen inklusive, und Sie können zum Ende jedes Monats gehen — Sie müssen kein Jahr kaufen, um herauszufinden, ob es zu Ihnen passt.",
  "compare.concession.projul": "Vor allem anderen: FieldQuo hat keine Handy-App, funktioniert nicht ohne Empfang und hat niemanden, der es Ihnen vorführt. Projul bucht Ihnen eine Demo.",
  "compare.lede.quoteiq": "QuoteIQ startet bei {theirEntry}, und dieser Tarif kann Ihnen keine Website bauen, keine Buchung annehmen und keinen Hausbesitzer seinen eigenen Auftrag kalkulieren lassen. Der QuoteIQ-Tarif, der das enthält, was FieldQuo in jeden Tarif legt, ist ihre Stufe Max, für {theirParity} im Monat. Unserer kostet {ourEntry} — und einundvierzig Punkte auf unserer Liste gibt es bei ihnen zu keinem Preis.",
  "compare.concession.quoteiq": "Zuerst der Preis, denn deswegen sind Sie hier. QuoteIQ startet unter unserem günstigsten Tarif, liefert Handy-Apps, die wir nicht haben, und bucht Ihnen eine Führung durch das Produkt. FieldQuo ist eine Webanwendung, ohne Vertriebsmitarbeiter dazu.",

  "compare.counterpoint.projul.monthly_billing": "Ihre Seite begründet den Jahrestarif, und die Begründung ist fair: Projul sagt, sein Preis enthalte keine Gebühr je Nutzer und keine Obergrenze für die Zahl der Projekte. Ein Betrieb, der oft Leute dazunimmt, fährt dort womöglich besser.",

  "compare.capability.mobile_app": "Native Handy-App (iOS / Android)",
  "compare.capability.offline_use": "Funktioniert offline",
  "compare.capability.self_serve_demo": "Geführte Demo mit einem Vertriebsmitarbeiter buchen",
  "compare.capability.accounting_sync": "Abgleich in beide Richtungen mit QuickBooks oder Xero",
  "compare.capability.gantt_charts": "Gantt-Diagramme und verknüpfte Projektzeitpläne",
  "compare.capability.purchase_orders": "Bestellungen an Lieferanten",
  "compare.capability.daily_logs": "Tägliche Bautagebücher",
  "compare.capability.geofencing": "Standortdaten und Stempeln im Geofence",
  "compare.capability.field_worker_quotes": "Das Team vor Ort kann ein Angebot aus dem Transporter kalkulieren und senden",
  "compare.capability.entry_price_below_our_floor": "Ein bezahlter Tarif unterhalb der günstigsten Stufe von FieldQuo",
  "compare.capability.ai_receptionist_no_monthly_floor": "KI-Telefonassistent in jedem Tarif, ohne monatliche Mindestabnahme",
  "compare.capability.self_serve_signup": "Anmelden und loslegen, ohne mit jemandem zu sprechen",
  "compare.capability.published_price": "Preis offen veröffentlicht, kein Verkaufsgespräch",
  "compare.capability.monthly_billing": "Monatlich zahlen, keine Jahresbindung nötig",
  "compare.capability.free_crew_seats": "Team vor Ort gratis enthalten — berechnet werden nur die Leute, bei denen das Geld entsteht",

  "compare.teamSize.solo": "Nur ich",
  "compare.teamSize.2-5": "2-5 Personen",
  "compare.teamSize.6-10": "6-10 Personen",
  "compare.teamSize.11-15": "11-15 Personen",
  "compare.teamSize.16-plus": "16 oder mehr",
  "compare.billing.annual_prepaid": "Jährlich, im Voraus bezahlt",
  "compare.billing.monthly_1yr": "Monatlich, 1 Jahr Bindung",
  "compare.billing.monthly_none": "Monatlich, ohne Bindung",

  "compare.comparableFeature.ai_receptionist": "KI-Telefonassistent",

  // ── The index page ──────────────────────────────────────────────────────
  "compare.vs": "FieldQuo gegen {competitor}",
  "compare.preparedAsOf": "Stand: {date}.",
  "compare.preparedAsOfLong": "Stand: {date}. Jede Zahl unten trägt zusätzlich den Tag, an dem sie abgelesen wurde, und das Land, aus dem sie abgelesen wurde.",
  "compare.readComparison": "Den Vergleich lesen",

  // What one card may claim, assembled in ../../(marketing)/compare/summary.js.
  "compare.summary.amountsSourced": "{count} ihrer veröffentlichten Preise lassen sich neben unsere stellen, in der Währung, in der sie sie abdrucken.",
  "compare.summary.amounts": "{count} ihrer veröffentlichten Preise lassen sich neben unsere stellen.",
  "compare.summary.asserted": "Bei {count} davon steht auf ihrer eigenen Seite keine Währung, deshalb sagt der Vergleich, wessen Einschätzung die Währung ist, statt sie als ihre auszugeben.",
  "compare.summary.onRequest": "{count} ihrer Stufen veröffentlichen überhaupt keinen Betrag und bitten Sie, einen anzufragen.",
  "compare.summary.none": "Nichts von dem, was sie veröffentlichen, lässt sich mit einem FieldQuo-Preis vergleichen.",
  "compare.summary.withheldOne": "{count} weitere Zahl wird zurückgehalten, gezeigt mit dem Grund.",
  "compare.summary.withheld": "{count} weitere Zahlen werden zurückgehalten, jede gezeigt mit dem Grund.",

  // ── How a price reads ───────────────────────────────────────────────────
  //
  // {currency} is a code and {ask} is their button's own words: both arrive
  // already decided and neither is translated. {per} is resolved through
  // compare.per.* below.
  "compare.price.amount": "${amount} {currency} pro {per}",
  "compare.price.free": "Gratis ({currency})",
  "compare.price.onRequest": "Kein Preis veröffentlicht — ihre Seite sagt „{ask}“",
  "compare.price.notOffered": "In dieser Größe nicht im Angebot",
  "compare.per.month": "Monat",
  "compare.per.year": "Jahr",
  "compare.pricePerMonth": "${amount} pro Monat",
  "compare.and": " und ",

  // ── How a feature's availability reads ──────────────────────────────────
  //
  // included and includedUsageExtra must NEVER collapse into one sentence.
  // Ours is the second: the receptionist is on every plan and the talk time is
  // prepaid credit, so "enthalten" beside our price would be a false claim
  // about our own price to somebody who then meets a top-up on their first
  // call.
  "compare.availability.included": "im Tarifpreis enthalten",
  "compare.availability.includedUsageExtra": "in jedem Tarif enthalten, die Gesprächszeit kaufen Sie separat als Guthaben im Voraus",
  "compare.availability.addOn": "ein kostenpflichtiges Zusatzmodul zum Tarif",
  "compare.availability.absent": "in dieser Stufe nicht enthalten",
  "compare.availability.unknown": "nicht geklärt",

  // ── The price section ───────────────────────────────────────────────────
  "compare.tierSeatsOne": "{seats} Platz, dazu {crew} Teammitglieder kostenlos",
  "compare.tierSeats": "{seats} Plätze, dazu {crew} Teammitglieder kostenlos",
  "compare.sameNumberBothCurrencies": "Dieselbe Zahl in jeder Währung, in der wir verkaufen ({currencies}) — ${price} ist in jeder davon ein echter FieldQuo-Preis, deshalb muss auf dieser Seite nichts umgerechnet werden, damit es zusammenpasst. In welcher Währung Ihnen berechnet wird, ergibt sich aus der Geschäftsadresse, die Sie bei der Anmeldung angeben.",
  "compare.soldIn": "Verkauft in {currencies}.",
  "compare.nothingPublishable": "Auf der Preisseite von {competitor} steht nichts, was wir als Preis veröffentlichen können. Jede Zahl, die wir haben, ist unten aufgeführt, mit dem Grund, warum sie zurückgehalten wird.",
  "compare.usersIncludedOne": "{count} Nutzer enthalten",
  "compare.usersIncluded": "{count} Nutzer enthalten",
  "compare.unlimitedUsers": "Unbegrenzt viele Nutzer, es gibt also keine Platzzahl zum Vergleichen",
  "compare.currencyNotTheirs": "Der Betrag ist ihrer, von ihrer eigenen Seite. Die Währung nicht: {provenance}",
  "compare.withheldCountOne": "{count} weiterer Preis von {competitor} wird hier nicht gezeigt — entweder ist der Stand zu alt geworden, oder wir konnten nicht klären, was die veröffentlichte Zahl bedeutet. Uns ist lieber, eine Zeile fehlt, als eine Zahl zu drucken, für die wir nicht geradestehen können.",
  "compare.withheldCount": "{count} weitere Preise von {competitor} werden hier nicht gezeigt — entweder ist der Stand zu alt geworden, oder wir konnten nicht klären, was die veröffentlichte Zahl bedeutet. Uns ist lieber, eine Zeile fehlt, als eine Zahl zu drucken, für die wir nicht geradestehen können.",

  // ── Their ladder, in their own words ────────────────────────────────────
  "compare.addsOverTier": "Kommt gegenüber der Stufe darunter dazu:",
  "compare.onThisTier": "In dieser Stufe:",
  "compare.aiCreditsTier": "Ihre Seite nennt für diese Stufe {count} KI-Credits im Monat.",
  "compare.thisListFrom": "Diese Liste: {provenance}",
  "compare.creditsAMonth": "{count} Credits im Monat",

  // ── The receptionist panel ──────────────────────────────────────────────
  "compare.receptionistTitle": "{feature}: was das auf jeder Seite kostet",
  "compare.receptionistIntro": "Stufen werden danach zugeordnet, was sie enthalten, nicht danach, wo sie in einer Tabelle stehen. Das ist die günstigste Stufe von {competitor}, bei der wir geprüft haben, dass sie das tatsächlich enthält.",
  "compare.receptionistUnknownIntro": "Für {competitor} können wir diese Frage nicht beantworten.",
  "compare.featureOnThisTier": "Die Funktion ist auf dieser Stufe {availability}.",
  "compare.receptionistLowerDown": "Weiter unten in ihrer Reihe ist es {availability}: {price}{at}. Das ist ein Sockelbetrag, den Sie auch in einem Monat zahlen, in dem das Telefon nie klingelt.",
  "compare.atCoordinates": " bei {coordinates}",
  "compare.ourAvailability": "Es ist {availability}. Ein Monat ohne Anrufe kostet dafür nichts.",
  "compare.theirWordsNotOurs": "Ihre Tarife werden auf ihrer Seite in ihren eigenen Worten beschrieben, und dieser Vergleich liest diese Worte nicht als unsere. Ihre Liste steht oben, unbearbeitet, und sie ist das, was auf ihrer eigenen Website zu prüfen ist.",

  // ── Where we are ahead, and where we are not ────────────────────────────
  "compare.readOnTheirSite": "Auf ihrer Website gelesen am {checked}",
  "compare.theySay": "{competitor} sagt: „{claim}“.",
  "compare.entryOursNothingBelowOne": "{seats} Platz, dazu {crew} Teammitglieder kostenlos. Darunter gibt es nichts.",
  "compare.entryOursNothingBelow": "{seats} Plätze, dazu {crew} Teammitglieder kostenlos. Darunter gibt es nichts.",

  // ── The head-to-head ────────────────────────────────────────────────────
  "compare.case.eyebrow": "Nebeneinander",
  "compare.case.headlineOurs": "Alles, was FieldQuo kann, kostet {price}.",
  "compare.case.headlineTheirs": "Bei {competitor} kostet dieselbe Liste {price}.",
  "compare.case.headlineTheirsAnnual": "Bei {competitor} kostet dieselbe Liste {price} im Jahr.",
  "compare.case.headlineNoPricesOurs": "FieldQuo veröffentlicht jeden Preis.",
  "compare.case.headlineNoPricesTheirs": "{competitor} veröffentlicht keinen.",
  "compare.case.sub": "Wir verkaufen Funktionen nicht nach Stufen. Jeder Tarif hat jede Funktion — die Tarife unterscheiden sich nur darin, wie viele Leute darin arbeiten.",
  "compare.case.missingOne": "{count} weitere Sache, die {competitor} zu keinem Preis anbietet.",
  "compare.case.missing": "{count} weitere Dinge, die {competitor} zu keinem Preis anbietet.",
  "compare.case.missingBody": "Alle davon stecken im Tarif {plan} für {price}.",
  "compare.case.shopTitle": "Was das für einen Betrieb wie Ihren kostet",
  "compare.case.shopIntro": "{competitor} berechnet jeden Zugang. Wir berechnen die Leute, die Arbeit kalkulieren; wer im Transporter sitzt, zählt als Team, kostenlos. Dieser Abstand wächst mit jeder Person, die Sie einstellen.",
  "compare.case.shop1": "Sie und zwei im Transporter",
  "compare.case.shop2": "Zwei kalkulieren, vier im Einsatz",
  "compare.case.shop3": "Ein Betrieb mit elf Leuten",
  "compare.case.shopSplit": "{estimators} kalkulieren · {crew} im Einsatz",
  "compare.case.youKeep": "Sie behalten",
  "compare.case.cheaperThere": "Bei einer Person dort günstiger.",
  "compare.case.calcBefore": "Setzen Sie Ihre eigenen Zahlen in den",
  "compare.case.calcLink": "Kostenrechner",
  "compare.case.calcAfter": "ein und sehen Sie alle fünf nebeneinander.",
  "compare.case.wholeTitle": "Alles, was Sie bekommen, in jedem Tarif",
  "compare.case.wholeIntro": "Keine Auswahl der Höhepunkte — das ganze Produkt, und ob es in den Tarifen von {competitor} überhaupt irgendwo vorkommt.",
  "compare.case.both": "Beide",
  "compare.case.only": "Nur FieldQuo",

  // ── The head-to-head rows ───────────────────────────────────────────────
  "compare.rows.perMo": "{amount}/Mon.",
  "compare.rows.perYr": "{amount}/Jahr",
  "compare.rows.usersOne": "{count} Nutzer",
  "compare.rows.users": "{count} Nutzer",
  "compare.rows.unlimitedUsers": "unbegrenzt viele Nutzer",
  "compare.rows.cheapestPlan": "Günstigster Tarif",
  "compare.rows.soloSub": "{plan} — 1 Platz, {crew} Teammitglieder gratis",
  "compare.rows.annualEquivalent": "{plan} — umgerechnet {amount} im Monat, jährlich abgerechnet",
  "compare.rows.annualOnlyPlain": "{plan} — jährlich abgerechnet",
  "compare.rows.tierUsers": "{plan} — {users}",
  "compare.rows.parityLabel": "Günstigster Tarif mit dem, was FieldQuo in jeden Tarif legt",
  "compare.rows.paritySub": "Derselbe Tarif. Wir sperren Funktionen nicht hinter Stufen.",
  "compare.rows.parityAnnual": "{plan} — umgerechnet {amount} im Monat",
  "compare.rows.parityTheirs": "{plan} — ihre günstigeren Tarife enthalten es nicht",
  "compare.rows.publishedPrice": "Veröffentlichter Preis",
  "compare.rows.everyPlanOnThisPage": "Jeder Tarif, auf dieser Seite",
  "compare.rows.nonePublished": "Keiner veröffentlicht",
  "compare.rows.bookDemo": "Demo buchen; die Zahl wird im Gespräch ausgehandelt",
  "compare.rows.whatItCosts": "Was es kostet",
  "compare.rows.oneToTwentyFive": "1 bis 25 Personen",
  "compare.rows.reportedNotPublished": "von Betrieben berichtet, nicht veröffentlicht",
  "compare.rows.setupFee": "Einrichtungsgebühr",
  "compare.rows.none": "Keine",
  "compare.rows.reported": "berichtet",
  "compare.rows.howYouPay": "Wie Sie zahlen",
  "compare.rows.monthly": "Monatlich",
  "compare.rows.leaveAnyMonth": "Zum Ende jedes Monats kündbar",
  "compare.rows.aYearUpFront": "{amount} im Jahr, im Voraus",
  "compare.rows.noMonthlyOption": "Eine monatliche Zahlweise wird nicht angeboten — ihre FAQ sagt das",
  "compare.rows.paidAddOns": "Wird als kostenpflichtige Zusatzmodule verkauft",
  "compare.rows.everyFeature": "Jede Funktion steckt in jedem Tarif, zum Tarifpreis",
  "compare.rows.plusPerMo": "+{amount}/Mon.",
  "compare.rows.peopleInField": "Leute im Einsatz",
  "compare.rows.free": "Gratis",
  "compare.rows.crewFreeSub": "Das Team sieht Plan und Auftrag kostenlos",
  "compare.rows.billed": "Wird berechnet",
  "compare.rows.everyLoginPaid": "Bei {competitor} ist jeder Zugang ein bezahlter Nutzer",
  "compare.rows.biggestPlan": "Größter Tarif",
  "compare.rows.biggestSub": "{seats} Plätze plus {crew} Teammitglieder — 25 Personen",
  "compare.rows.onRequest": "Auf Anfrage",
  "compare.rows.everyPlan": "Jeder Tarif",
  "compare.rows.tierAtPrice": "{plan} — {amount}/Mon.",
  "compare.rows.tierAtAnnualPrice": "{plan} — {amount}/Jahr",
  "compare.rows.theirCheapestWithIt": "ihr günstigster Tarif, der es enthält",
  "compare.rows.notInTheirPlans": "In ihren Tarifen nicht enthalten",
  "compare.rows.freeTrial": "Kostenlose Testphase",
  "compare.rows.firstMonthFree": "Erster Monat gratis",
  "compare.rows.noCardCharged": "Bis zum Ende wird keine Karte belastet",
  "compare.rows.trialOffered": "Testphase wird angeboten",
  "compare.rows.seeTheirSite": "aktuelle Bedingungen auf ihrer Website",

  // ── The add-on stack ────────────────────────────────────────────────────
  //
  // Rendered on /compare/fieldquo-vs-jobber AND on /pricing.
  "addOns.title": "{count} Dinge, die {competitor} extra berechnet",
  "addOns.intro": "Die stehen auf ihrer eigenen Preisseite obendrauf auf dem Tarif, jedes mit eigenem Monatspreis. Jedes davon ist Arbeit, die FieldQuo innerhalb des Tarifs erledigt, den Sie ohnehin schon zahlen.",
  "addOns.scope": "Wir haben den Namen und den Preis von ihrer Preisseite abgelesen, sonst nichts. Was in ihrem Zusatzmodul steckt, haben wir nicht geprüft, deshalb beschreibt nichts hier unten es.",
  "addOns.money": "${amount} {currency} pro {per}",
  "addOns.provenance": "Abgelesen über eine Verbindung aus {country} am {checked}",
  "addOns.sourceLink": "ihre Preisseite",
  "addOns.oursTitle": "In FieldQuo, in jedem Tarif:",
  "addOns.limits": "Wo das aufhört:",
  "addOns.total": "{total} {currency} im Monat, zusätzlich zum Tarifpreis.",
  "addOns.totalBody": "So viel kosten die drei zusammen an der Stelle ihrer eigenen Auswahlfelder, an der wir sie abgelesen haben. In FieldQuo stecken dieselben drei Aufgaben in jedem Tarif, in jeder Größe, ab dem günstigsten auf dieser Seite.",
  "addOns.receptionist": "Ihr Zusatzmodul für den Telefonassistenten ist ein monatlicher Sockelbetrag: Es wird auch in einem Monat berechnet, in dem das Telefon nie klingelt. Unseres hat keine monatliche Mindestabnahme. Die Funktion ist in jedem Tarif enthalten, und die Gesprächszeit ist Guthaben, das Sie im Voraus kaufen, wenn Sie es brauchen — ein ruhiger Februar kostet dafür also nichts.",

  // ── /pricing's own line under the add-on stack ──────────────────────────
  "pricing.addOnsCompare": "Jede Zahl oben wurde am angegebenen Datum von ihrer eigenen Preisseite abgelesen. Der vollständige Vergleich nebeneinander — samt dem, was FieldQuo nicht macht — steht hier →",
};

export default de;
