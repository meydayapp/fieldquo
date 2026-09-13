// app/i18n/productPages/de.js
//
// Deutsch, Siezen, wie im übrigen Katalog.
//
// Wortwahl aus dem, was bereits ausgeliefert wird: "Angebot" für das Dokument,
// "Gemeinkosten", "Stundenzettel", "Nachunternehmer", "Gewerk", "Schicht",
// "Stempeluhr" für die time clock, "Lohnabrechnung" für payroll, "Disponent"
// für dispatcher, "Einsatzplan" für die Tagesansicht der Planung.
//
// Von einer Muttersprachlerin zu prüfen: "Abschlussquote" für conversion rate.
// Der Katalog benutzt dasselbe Wort bereits für die win rate in
// feature.benchmark.summary — im Handwerk ist das dasselbe Verhältnis, aber
// falls die beiden je auseinanderfallen, fällt es hier zuerst auf. Ebenso
// "Vertretung" für cover und "Tausch" für trade.

const de = {

  // /product/quoting
  "productPage.quoting.headline": "Verschicken Sie ein professionelles Angebot in Minuten",
  "productPage.quoting.description":
    "Erstellen Sie Angebote mit Ihren eigenen Preisen für jede Leistung, fügen Sie Fotos hinzu und lassen Sie Kunden online annehmen — ohne Drucken, ohne Telefon-Pingpong.",
  "productPage.quoting.bullet.1":
    "Ihre eigenen Preise je Leistungskategorie, keine Standardvorlage",
  "productPage.quoting.bullet.2": "Der Kunde nimmt online an und unterschreibt digital",
  "productPage.quoting.bullet.3": "Ein Klick macht aus einem angenommenen Angebot eine Rechnung",
  "productPage.quoting.bullet.4":
    "Ändern Sie eine verschickte Rechnung — die frühere bleibt erhalten, und es gibt nie Streit darüber, was vereinbart war",
  "productPage.quoting.section.pricebook.heading": "Ihre Leistungen und Ihre Preise, einmal eingerichtet",
  "productPage.quoting.section.pricebook.body":
    "Jede Leistung, die Sie anbieten, hat ihre eigene Preisliste — pro Quadrat, pro laufenden Fuß, pro Stunde, wie das Gewerk eben abrechnet. Einmal einrichten, und sie füllt jedes Angebot. Ihre Produktliste lässt sich aus einer Tabelle importieren und wieder exportieren.",
  "productPage.quoting.section.pricebook.bullet.1": "Eine Preisliste je Leistung, in den Einheiten, die Ihr Gewerk wirklich benutzt",
  "productPage.quoting.section.pricebook.bullet.2": "Produkte und Leistungen aus einer CSV importiert, genauso exportiert",
  "productPage.quoting.section.pricebook.bullet.3": "Materialkosten und Rezepturen hinter dem Preis, dem Kunden nie gezeigt",
  "productPage.quoting.section.pricebook.alt":
    "Der Bildschirm Leistungen und Preise: Dach, Fassade und Dachrinnen, jeweils mit eigener Preisliste und den Materialien, nach denen kalkuliert wird",
  "productPage.quoting.section.builder.heading": "Das Angebot vor Ort erstellen",
  "productPage.quoting.section.builder.body":
    "Tippen Sie eine Leistung an, und Ihre eigenen Preise werden eingesetzt. Gruppieren Sie die Positionen nach Raum oder Leistungsumfang, hängen Sie die Fotos des Kunden an und behalten Sie Kosten und Marge in einem Bereich, den der Kunde nie sieht.",
  "productPage.quoting.section.builder.bullet.1": "Positionen nach Raum oder Umfang gruppieren, damit das Angebot so liest, wie die Arbeit läuft",
  "productPage.quoting.section.builder.bullet.2": "Fotos und Videos des Kunden bleiben am Angebot und wandern in die Rechnung",
  "productPage.quoting.section.builder.bullet.3": "Kosten und Marge neben dem Preis berechnet — Teamstunden, Material, Gemeinkosten",
  "productPage.quoting.section.builder.alt":
    "Der Angebotseditor: Kunde, zuständige Person, die antippbaren Leistungen und der interne Bereich für Kosten und Marge",
  "productPage.quoting.section.review.heading": "Eine Prüfung vor dem Versand, und Extras, die der Kunde ankreuzen kann",
  "productPage.quoting.section.review.body":
    "Bevor ein Angebot rausgeht, liest FieldQuo AI es: was Sie vergessen haben zu erwähnen, wie der Preis gegenüber den Angeboten steht, die Sie schon gewonnen haben, und klarere Formulierungen. Vorgeschlagene Extras werden aus Ihrer eigenen Historie bepreist und erscheinen als optionale Zusatzleistungen, die der Kunde auf der Annahmeseite ankreuzt.",
  "productPage.quoting.section.review.bullet.1": "Was fehlt, wie der Preis dasteht, was umformuliert gehört",
  "productPage.quoting.section.review.bullet.2": "Nur mit Ihren eigenen angenommenen Angeboten verglichen — nie mit denen eines anderen Betriebs",
  "productPage.quoting.section.review.bullet.3": "Extras werden auf Ihrer Seite bepreist; der Kunde wählt nur, welche er annimmt",
  "productPage.quoting.section.review.alt":
    "Der KI-Prüfbereich bewertet ein Angebot mit 76 von 100 und nennt drei Punkte, die vor dem Versand behoben werden sollten",
  "productPage.quoting.section.approval.heading": "Der Kunde nimmt an und unterschreibt vom Handy aus",
  "productPage.quoting.section.approval.body":
    "Das Angebot kommt in einer E-Mail von Ihrer Adresse, mit Ihrem Logo und Ihrer Farbe, und öffnet sich auf einer Seite, die Ihren Namen trägt. Der Kunde wählt Extras, unterschreibt, und der Auftrag läuft. Was er im Moment der Unterschrift gesehen hat, wird mit der Unterschrift festgehalten.",
  "productPage.quoting.section.approval.bullet.1": "Ihr Logo, Ihre Farbe, Ihr Name — nirgends steht FieldQuo",
  "productPage.quoting.section.approval.bullet.2": "Unterschrift zusammen mit genau dem Dokument gespeichert, das der Kunde gesehen hat",
  "productPage.quoting.section.approval.bullet.3": "Ein Angebot behält die Sprache, in der es geschrieben wurde; ein unterschriebenes Dokument ändert seine Worte nie",
  "productPage.quoting.section.invoice.heading": "Ein Klick zur Rechnung, bezahlt vom Handy",
  "productPage.quoting.section.invoice.body":
    "Ein angenommenes Angebot wird zu einer Rechnung, die aussieht wie das Angebot, weil sie daraus gebaut ist. Verlangen Sie eine Anzahlung, teilen Sie einen großen Auftrag in Etappen, und lassen Sie den Kunden per Karte oder Bankeinzug zahlen — das Geld landet auf Ihrem eigenen Konto, nie auf unserem.",
  "productPage.quoting.section.invoice.bullet.1": "Eine gestellte Rechnung ändern — die frühere Fassung bleibt erhalten",
  "productPage.quoting.section.invoice.bullet.2": "Anzahlungen und Etappenzahlungen, angefordert nach dem Plan, den Sie festlegen",
  "productPage.quoting.section.invoice.bullet.3": "Karte, oder Bankeinzug in Kanada und den USA, direkt auf Ihr Konto",
  "productPage.quoting.section.invoice.alt":
    "Der Bildschirm für eine neue Rechnung mit den Positionen und dem internen Bereich für Kosten und Marge",
  "productPage.quoting.section.instant.heading": "Eine Sofortschätzung auf Ihrer Website",
  "productPage.quoting.section.instant.body":
    "Ein Besucher beantwortet ein paar Fragen — oder zeichnet das Dach ab der Adresse nach — und bekommt eine Preisspanne aus den Sätzen, die Sie festlegen. Sie landet in Ihrer Prüfliste, bevor irgendetwas verbindlich ist, und Ihre Preisliste selbst wird nie veröffentlicht.",
  "productPage.quoting.section.instant.bullet.1": "Spanne sofort zeigen, erst nach dem Absenden, oder gar nicht — Ihre Wahl je Leistung",
  "productPage.quoting.section.instant.bullet.2": "Jede Schätzung wartet unter Schätzungsprüfung darauf, dass Sie sie bestätigen oder anpassen",
  "productPage.quoting.section.instant.bullet.3": "Ein Selbstangebots-Formular, in dem der Eigentümer die Arbeit beschreibt und Fotos hochlädt",
  "productPage.quoting.section.instant.alt":
    "Einstellungen für Sofortangebote: das Dach ab der Adresse vermessen, was der Eigentümer sieht, und die Budgetstufen",
  "productPage.quoting.faq.white-label.q": "Sehen meine Kunden irgendwo FieldQuo?",
  "productPage.quoting.faq.white-label.a":
    "Nein. Angebot, Rechnung, Annahmeseite, E-Mails und PDF tragen Ihr Logo, Ihre Farbe und Ihren Namen als Absender. Unser Name erscheint nur an zwei kleinen Stellen: als Zeile „Site by FieldQuo“ in der Fußzeile Ihrer Website, solange Ihr Betrieb keinen bezahlten Tarif hat — weg, sobald er einen hat — und als Zeile „Made by FieldQuo“ am Fuß der Bio-Link-Seite.",
  "productPage.quoting.faq.own-prices.q": "Kann ich meine eigenen Preise benutzen?",
  "productPage.quoting.faq.own-prices.a":
    "Nur so funktioniert es. Jede Leistung startet mit typischen Sätzen Ihres Gewerks, als Ausgangspunkt gekennzeichnet, und Sie passen sie an Ihren Markt an; der Angebotseditor füllt sich aus Ihren Zahlen, nie aus unseren. Eine Preisliste lässt sich außerdem aus einer Tabelle importieren und wieder exportieren.",
  "productPage.quoting.faq.after-approval.q": "Was passiert, wenn der Kunde annimmt?",
  "productPage.quoting.faq.after-approval.a":
    "Das Angebot wird zu einem Auftrag mit Umfang, Adresse und Unterlagen schon dran, und ein Klick macht daraus eine Rechnung, die das Angebot spiegelt. Wenn Sie eine Anzahlung verlangt haben, wird sie bei der Annahme angefordert.",
  "productPage.quoting.faq.instalments.q": "Können Kunden in Raten zahlen?",
  "productPage.quoting.faq.instalments.a":
    "Sie können eine Rechnung in Etappen teilen, und jede wird nach Ihrem Plan angefordert. Ratenzahlung an der Kasse wird über Stripe angeboten, wo der Kreditgeber entscheidet — FieldQuo verleiht nichts und genehmigt niemanden.",

  // /product/scheduling
  "productPage.scheduling.headline": "Jede Person, jede Stunde, auf einem Plan",
  "productPage.scheduling.description":
    "Entwerfen Sie Tag und Woche des Teams, veröffentlichen Sie einmal, und jeder sieht seine eigenen Schichten auf dem Handy. Kunden buchen Termine aus Ihrer echten Verfügbarkeit, während Sie auf der Baustelle sind.",
  "productPage.scheduling.bullet.1": "Ein Tagesplan mit einer Zeile je Person und einer Spalte je Stunde",
  "productPage.scheduling.bullet.2": "Schichten bleiben für das Team unsichtbar, bis Sie veröffentlichen",
  "productPage.scheduling.bullet.3": "Öffentliche Buchungsseite mit Ihrem Logo und Ihren Farben",
  "productPage.scheduling.bullet.4":
    "Pufferzeiten und Verfügbarkeit je Person, kein Standardkalender",
  "productPage.scheduling.hero.alt":
    "Der Tagesplan: fünf Personen in Zeilen, die Stunden in Spalten, eine im Urlaub, eine eingestempelt, und oben der Abdeckungsstreifen",
  "productPage.scheduling.section.board.heading": "Der Tagesplan: wer wo ist, Stunde für Stunde",
  "productPage.scheduling.section.board.body":
    "Eine Zeile je Person, eine Spalte je Stunde. Eine Schicht ist ein Block mit eingezeichneter Mittags- und Pausenzeit; die Stempeluhr färbt die Punkte grün und gelb, sobald die Leute einstempeln; wer genehmigten Urlaub hat, erscheint als ABWESEND-Zeile, damit ihn niemand versehentlich einplant.",
  "productPage.scheduling.section.board.bullet.1": "Der Abdeckungsstreifen sagt, wie viele Leute in jeder Stunde auf der Baustelle sind — rot, wo innerhalb der Öffnungszeiten jemand fehlt",
  "productPage.scheduling.section.board.bullet.2": "Ein Entwurf außerhalb der angegebenen Verfügbarkeit ist gestrichelt und markiert, nicht stillschweigend erlaubt",
  "productPage.scheduling.section.board.bullet.3": "Marken für Verspätet und Pünktlich, aus dem Stempeln gegenüber der Schicht, direkt am Block",
  "productPage.scheduling.section.board.alt":
    "Der Tagesplan aus Sicht des Inhabers: die Lohnkostenzeile für Tag und Woche, Überstunden und die Marken Verspätet und Pünktlich an den Schichten",
  "productPage.scheduling.section.week.heading": "Die Woche planen, einmal veröffentlichen",
  "productPage.scheduling.section.week.body":
    "Das Wochenraster sind dieselben Schichten nach Wochentag. Übernehmen Sie eine Schicht auf mehrere Tage auf einmal, schreiben Sie eine offene Schicht aus, die jeder übernehmen kann, und lesen Sie Stunden und Löhne in der Fußzeile, bevor Sie veröffentlichen. Bis dahin sieht das Team nichts.",
  "productPage.scheduling.section.week.bullet.1": "Schalter „Übernehmen auf“ je Wochentag: Montag einmal einstellen, die anderen vier anhaken",
  "productPage.scheduling.section.week.bullet.2": "Offene Schichten stehen in ihrer eigenen Zeile, bis jemand sie übernimmt",
  "productPage.scheduling.section.week.bullet.3": "Stunden, Überstunden und — mit Lohnzugriff — die Lohnsumme, je Tag und je Woche",
  "productPage.scheduling.section.week.alt":
    "Das Wochenraster: Zeilen für Termine und offene Schichten, eine Schicht je Person und Tag, und die Fußzeile mit Löhnen und Stunden",
  "productPage.scheduling.section.phone.heading": "Veröffentlicht, und auf jedem Handy",
  "productPage.scheduling.section.phone.body":
    "Wenn Sie veröffentlichen, wird jede Person auf dem Handy benachrichtigt, und noch einmal, wenn ihre Schicht sich verschiebt. Ihr Plan ist eine Karte je Tag: der Auftrag, die Adresse, wer noch dabei ist, Ihre Notiz und ein Einstempeln-Knopf auf der Karte von heute.",
  "productPage.scheduling.section.phone.bullet.1": "Benachrichtigt, wenn eine Schicht veröffentlicht, verschoben oder entfernt wird — ein Entwurf erreicht nie ein Handy",
  "productPage.scheduling.section.phone.bullet.2": "Kollegen in derselben Schicht, die Baustellennotiz und die Feiertagszeile",
  "productPage.scheduling.section.phone.bullet.3": "Von der Tageskarte aus einstempeln; den Plan in den Handykalender übernehmen",
  "productPage.scheduling.section.phone.alt":
    "Mein Plan auf dem Handy: eine Karte je Tag mit Auftrag, Adresse, dem Team dazu und einem Einstempeln-Knopf",
  "productPage.scheduling.section.requests.heading": "Tausch, Vertretung und Urlaub, genehmigt von der richtigen Führungskraft",
  "productPage.scheduling.section.requests.body":
    "Ein Teammitglied bittet vom Handy aus um Vertretung; ein Kollege sagt zuerst zu, dann genehmigt die Führungskraft, und alle werden bei jedem Schritt benachrichtigt. Urlaub folgt den Regeln, die Sie festlegen, mit Guthaben, die sich von selbst aufbauen, Sperrzeiten und den gesetzlichen Feiertagen Ihrer Provinz oder Ihres Bundesstaats.",
  "productPage.scheduling.section.requests.bullet.1": "Schicht tauschen, Vertretung anfragen, offene Schicht übernehmen — alles aus der Anfragenübersicht",
  "productPage.scheduling.section.requests.bullet.2": "Urlaubsregeln mit Guthaben, einer Obergrenze gleichzeitig Abwesender und Sperrzeiten",
  "productPage.scheduling.section.requests.bullet.3": "Verfügbarkeitsänderungen gelten ab einem Datum, damit der Plan es im Voraus weiß",
  "productPage.scheduling.section.requests.alt":
    "Die Anfragenübersicht: Urlaub, Tausch, Vertretung und Verfügbarkeit, darunter die eigenen Anfragen des Teammitglieds",
  "productPage.scheduling.section.booking.heading": "Eine Buchungsseite, die den Kalender füllt, während Sie arbeiten",
  "productPage.scheduling.section.booking.body":
    "Kunden wählen einen Termin aus der echten Verfügbarkeit der Person, die kommt, mit Fahrzeit zwischen den Aufträgen und einem Ankunftsfenster, das Sie zusagen, auf einer Seite mit Ihrem Namen. Eine SMS vor dem Termin, und ein Link, mit dem sie ihn selbst verschieben.",
  "productPage.scheduling.section.booking.bullet.1": "Fahrzeitpuffer zwischen Aufträgen und ein Ankunftsfenster — genau, ±15, ±30 oder ±60 Minuten",
  "productPage.scheduling.section.booking.bullet.2": "Bei der Buchung eine Besuchsgebühr nehmen und auf die Rechnung anrechnen",
  "productPage.scheduling.section.booking.bullet.3": "Erinnerung per SMS vor dem Termin; der Kunde verschiebt über den Link, statt Sie anzurufen",
  "productPage.scheduling.section.booking.alt":
    "Einstellungen der Buchungsseite: der Einbettungscode, wie lange ein Termin dauert, der Fahrzeitpuffer und das dem Kunden zugesagte Ankunftsfenster",
  "productPage.scheduling.section.clock.heading": "Auf den Auftrag stempeln, mit Pausen",
  "productPage.scheduling.section.clock.body":
    "Das Team stempelt von jedem beliebigen Handy ein, auf den Auftrag, an dem es gerade ist — oder auf keinen, denn Fahrt und Hof sind echte Stunden. Mittag und Pausen werden ebenfalls gestempelt. Beim Antippen fragt das Handy einmal nach seiner Position; der Stundenzettel zeigt dann, wie weit von der Baustelle das war. Zwischen zwei Stempelungen wird niemand verfolgt.",
  "productPage.scheduling.section.clock.bullet.1": "Zwei Termine heute? Die Uhr fragt, welcher; „kein Auftrag“ ist immer eine ehrliche Option",
  "productPage.scheduling.section.clock.bullet.2": "Bezahlte und unbezahlte Pausen, vom Handy aus",
  "productPage.scheduling.section.clock.bullet.3": "Eine Position beim Stempeln, nie dazwischen — sie zu verweigern ändert nichts an der Stempelung",
  "productPage.scheduling.section.clock.alt":
    "Die Stempeluhr: die aktuelle Uhrzeit, welcher Auftrag, und der Einstempeln-Knopf",
  "productPage.scheduling.faq.phone.q": "Muss mein Team etwas installieren?",
  "productPage.scheduling.faq.phone.a":
    "Nein. FieldQuo läuft im Browser des Handys und lässt sich auf den Startbildschirm legen, sodass es sich wie jedes andere Symbol öffnet. Nichts zu installieren, nichts zu aktualisieren.",
  "productPage.scheduling.faq.reminders.q": "Wie werden Kunden erinnert?",
  "productPage.scheduling.faq.reminders.a":
    "Per SMS vor dem Termin, mit einem Link zum Verschieben oder Absagen. Eine Erinnerung per E-Mail gibt es noch nicht, und der Erinnerungstext ist fest — die SMS „bin unterwegs“ ist die, die Sie bearbeiten können.",
  "productPage.scheduling.faq.crew-sees.q": "Was sieht ein Teammitglied?",
  "productPage.scheduling.faq.crew-sees.a":
    "Seine eigenen Schichten, die ihm zugewiesenen Aufträge, was dafür zu besorgen ist, und seine eigenen Stunden. Keine Preise, keine Angebote, keine Rechnungen, keine Anfragen anderer — es sei denn, Sie drehen einen Regler für die Person auf.",
  "productPage.scheduling.faq.book-account.q": "Brauchen Kunden ein Konto, um zu buchen?",
  "productPage.scheduling.faq.book-account.a":
    "Nein. Die Buchungsseite fragt nach Name, Telefonnummer und Adresse, und die Bestätigung enthält den Link, über den der Termin verwaltet wird.",

  // /product/team
  "productPage.team.headline": "Geben Sie Ihrem Team Zugang, ohne die Kontrolle abzugeben",
  "productPage.team.description":
    "Voreingestellte Zugriffsstufen für Monteure, Kalkulatoren, Disponenten und Führungskräfte, ein Regler je Bereich für jeden, der etwas anderes braucht, und eine Akte je Person: Dokumente, Einarbeitung, Richtlinien, Stunden und Lohn.",
  "productPage.team.bullet.1": "Voreinstellungen für Monteur, Kalkulator, Disponent und Führungskraft, dann ein Regler je Bereich und Person",
  "productPage.team.bullet.2": "Stundenzettel an echte Aufträge gebunden, nicht geraten",
  "productPage.team.bullet.3": "Lohnläufe und Lohnabrechnungen aus genehmigten Stunden",
  "productPage.team.bullet.4": "Mitarbeiterdokumente, Einarbeitung und Richtlinien in einer Akte",
  "productPage.team.hero.alt":
    "Der Startbildschirm der Führungskraft: bezahlte Stunden und Löhne von heute, zwei zu disponierende Termine, Teamstatus und die Anfragen, die geprüft werden müssen",
  "productPage.team.section.access.heading": "Jobtitel sind Worte; Zugriff ist ein Regler",
  "productPage.team.section.access.body":
    "Beginnen Sie mit einer Voreinstellung — Monteur, Kalkulator, Disponent, Führungskraft — und ändern Sie dann jeden Regler für diese eine Person: was sie vom Plan, von Stundenzetteln, Lohn, Kunden, Angeboten, Aufträgen, Rechnungen sieht. Es gilt auf dem Server, nicht nur auf dem Bildschirm, sodass ein versteckter Knopf nie das Einzige ist, was im Weg steht.",
  "productPage.team.section.access.bullet.1": "Vier Voreinstellungen und ein eigener Editor, ein Regler je Bereich",
  "productPage.team.section.access.bullet.2": "Preise anzeigen, Auftragskalkulation und Zahlungen sind getrennte Schalter",
  "productPage.team.section.access.bullet.3": "Monteur-Zugänge sind kostenlos; Plätze sind für die, die Angebote und Rechnungen schreiben",
  "productPage.team.section.access.alt":
    "Der Berechtigungsbereich eines neuen Teammitglieds: die Voreinstellungen Monteur, Kalkulator, Disponent und Führungskraft, darunter ein Regler je Bereich",
  "productPage.team.section.home.heading": "Der eigene Startbildschirm jeder Person, auf dem Handy",
  "productPage.team.section.home.body":
    "Ein Monteur öffnet FieldQuo und sieht seine nächste Schicht, Ihre Notiz, was er heute verdient hat, und die Knöpfe, die er wirklich benutzt: einstempeln, Vertretung suchen, tauschen, Nachricht. Eine Führungskraft öffnet es und sieht die bezahlten Stunden des Tages, die noch zu disponierenden Termine, wer auf der Baustelle ist, und die Anfragen, die auf eine Entscheidung warten.",
  "productPage.team.section.home.bullet.1": "Nächste Schicht mit Auftrag, Adresse und wer noch dabei ist",
  "productPage.team.section.home.bullet.2": "Vertretung suchen, Schicht tauschen, Urlaub beantragen — vom selben Bildschirm",
  "productPage.team.section.home.bullet.3": "Die Sicht der Führungskraft: Disposition, Teamstatus und was zu prüfen ist",
  "productPage.team.section.home.alt":
    "Der Mitarbeiter-Startbildschirm auf dem Handy: guten Tag, die nächste Schicht, eine Notiz dazu, Vertretung suchen und Tauschen, und Ausstempeln",
  "productPage.team.section.hr.heading": "Eine Personalakte je Person",
  "productPage.team.section.hr.body":
    "Führerscheine, Nachweise und Zertifikate mit Ablauf-Erinnerungen. Eine Einarbeitungsliste, bei der das TD1 oder W-4 am Handy beantwortet und in der Akte abgelegt wird — FieldQuo reicht nichts bei einer Steuerbehörde ein und fragt nie nach einer Sozialversicherungsnummer. Richtlinien sind versioniert und werden mit getipptem Namen bestätigt, und eine Compliance-Ansicht zeigt, wem was fehlt.",
  "productPage.team.section.hr.bullet.1": "Dokumente mit Ablaufdatum und einer Erinnerung davor",
  "productPage.team.section.hr.bullet.2": "Einarbeitungsliste: Formulare auszufüllen, Dokumente hochzuladen, Richtlinien zu unterschreiben",
  "productPage.team.section.hr.bullet.3": "Das Logbuch der Führungskraft für Notizen und Abmahnungen, bei der Person abgelegt",
  "productPage.team.section.hr.alt":
    "Personal und Compliance: eine Zeile je Person mit zu prüfenden Dokumenten, Einarbeitungsstand, nicht unterschriebenen Richtlinien und Abmahnungen",
  "productPage.team.section.chat.heading": "Ein Chatraum für jeden Auftrag, und einer für den Betrieb",
  "productPage.team.section.chat.body":
    "Jeder Auftrag hat einen Raum, den das zuständige Team und das Büro teilen, damit das Foto der zerkratzten Schubladenfront beim Auftrag liegt und nicht in irgendjemandes SMS. Gruppen und Direktnachrichten stehen daneben, mit @Erwähnungen, am Handy und am Schreibtisch.",
  "productPage.team.section.chat.bullet.1": "Ein Raum je Auftrag, vom Auftrag aus geöffnet und zurück zu ihm verlinkt",
  "productPage.team.section.chat.bullet.2": "Gruppen, Direktnachrichten und @Erwähnungen",
  "productPage.team.section.chat.bullet.3": "Ungelesen-Zähler je Raum, am Handy",
  "productPage.team.section.chat.alt":
    "Team-Chat: ein Auftragsraum mit den Nachrichten des Teams zur Arbeitsplattenschablone und zur Begehung, eine @Erwähnung hervorgehoben",
  "productPage.team.section.timesheets.heading": "Stundenzettel aus echten Stempelungen, mit den Hinweisen",
  "productPage.team.section.timesheets.body":
    "Stunden kommen an den Auftrag und die Schicht gebunden an, auf die sie gestempelt wurden. Der Plan zeigt, wer zu spät war und um wie viel, wer diese Woche über vierzig Stunden liegt, und — für alle mit Lohnzugriff — was Tag und Woche an Löhnen kosten. Sie genehmigen Stunden, bevor daraus Lohn werden kann.",
  "productPage.team.section.timesheets.bullet.1": "Verspätet oder pünktlich aus dem Stempeln gegenüber der Schicht, nicht aus dem Gedächtnis",
  "productPage.team.section.timesheets.bullet.2": "Überstunden je Person ausgewiesen, während die Woche wächst",
  "productPage.team.section.timesheets.bullet.3": "Die Lohnsumme für Tag und Woche, verborgen vor allen ohne Lohnzugriff",
  "productPage.team.section.timesheets.alt":
    "Der Tagesplan aus Sicht eines Disponenten: geplante Stunden, Überstunden über vierzig, Marken Verspätet und Pünktlich, und ein Hinweis, dass Lohnkosten nur sehen, wer Lohnsätze sehen darf",
  "productPage.team.section.payroll.heading": "Lohnläufe und Lohnabrechnungen aus genehmigten Stunden",
  "productPage.team.section.payroll.body":
    "Genehmigte Stunden und der Satz jeder Person werden zu einem Lohnlauf für den gewählten Zeitraum, mit einer Abrechnung je Person und einem Export für Ihren Steuerberater. FieldQuo berechnet den Bruttolohn; es zahlt keine Mitarbeiter aus und reicht keine Lohnsteuer ein. Wer auf Ihrer Liste als Auftragnehmer geführt ist, kann für gestempelte Stunden per echter Überweisung auf sein Konto bezahlt werden.",
  "productPage.team.section.payroll.bullet.1": "Lohnperioden in Ihrem Rhythmus, Abrechnungen als PDF, der Lauf exportiert",
  "productPage.team.section.payroll.bullet.2": "Auftragnehmer auf Ihrer Liste, bezahlt für gestempelte Stunden zum Satz, den Sie festlegen",
  "productPage.team.section.payroll.bullet.3": "Nachunternehmer-Firmen in der Akte mit ihrer Versicherung und der T5018-Jahresliste",
  "productPage.team.section.payroll.alt":
    "Lohnabrechnung: die genehmigten Stunden dieser Periode, Brutto, Abzüge und Netto, und ein neuer Lohnlauf in Vorbereitung",
  "productPage.team.faq.taxes.q": "Reicht FieldQuo Lohnsteuer ein?",
  "productPage.team.faq.taxes.a":
    "Nein. Es berechnet den Bruttolohn aus genehmigten Stunden, erstellt die Abrechnungen und exportiert den Lauf. Die Abzüge liefern Sie oder Ihr Steuerberater, und nichts wird bei einer Steuerbehörde eingereicht.",
  "productPage.team.faq.crew-free.q": "Sind Monteur-Zugänge kostenlos?",
  "productPage.team.faq.crew-free.a":
    "Ja. Ein Monteur-Zugang sieht den eigenen Plan, stempelt ein und aus und legt Fotos ab — er zählt nicht gegen Ihre Plätze. Plätze sind für die Personen, die Angebote, Aufträge und Rechnungen anlegen und ändern.",
  "productPage.team.faq.see-pay.q": "Kann ein Disponent sehen, was ich den Leuten zahle?",
  "productPage.team.faq.see-pay.a":
    "Nur, wenn Sie ihm Lohnzugriff geben. Ohne ihn zeigt der Plan Stunden und Überstunden und sagt, warum das Geld fehlt. Jeder Satz und jede Lohnzahl wird auf dem Server verborgen, nicht nur auf dem Bildschirm.",
  "productPage.team.faq.leaves.q": "Was passiert, wenn jemand geht?",
  "productPage.team.faq.leaves.a":
    "Sie deaktivieren die Person. Ihre Stunden, Dokumente und Historie bleiben in der Akte; sie kann sich nicht mehr anmelden, und ihr Platz ist frei für die nächste.",

  // /product/analytics
  "productPage.analytics.headline": "Kennen Sie Ihre Zahlen, bevor Sie raten",
  "productPage.analytics.description":
    "Sehen Sie Ihre echten Gemeinkosten, Ihren Break-even-Preis je Auftrag und wie Ihre Preise im Vergleich zu anderen Betrieben Ihres Gewerks liegen — plus einen KI-Assistenten, der Fragen zu Ihrem eigenen Betrieb beantwortet.",
  "productPage.analytics.bullet.1":
    "Kostenrate und Mindestpreis, berechnet aus Ihren echten Ausgaben",
  "productPage.analytics.bullet.2":
    "Marketingausgaben nach Kanal aufgeschlüsselt — Facebook, Google, TikTok und mehr",
  "productPage.analytics.bullet.3":
    "Sehen Sie, wie Ihre Preise anonym im Vergleich zu anderen in Ihrem Gewerk stehen",
  "productPage.analytics.bullet.4":
    "Fragen Sie FieldQuo AI Dinge wie „Ist meine Abschlussquote normal?“",
  "productPage.analytics.section.kpis.heading": "Das Kennzahlen-Dashboard: Verkauf, Geld, Kosten, Gewinn, Ausführung",
  "productPage.analytics.section.kpis.body":
    "Abschlussquote, durchschnittlicher Auftragswert, Umwandlung von Anfrage zu Angebot, Einnahmen gegen Ausgaben je Tag, Lohnanteil am Umsatz, pünktliche Fertigstellung. Jede Zahl kommt aus dem, was schon in FieldQuo ist — keine Bankverbindung, keine Tabelle. Eine Karte ohne Daten dahinter sagt warum, statt eine Null zu zeigen.",
  "productPage.analytics.section.kpis.bullet.1": "Dieser Monat, letzter Monat, dieses Quartal, seit Jahresbeginn oder letztes Jahr",
  "productPage.analytics.section.kpis.bullet.2": "Finanzberichte, gewonnen und verloren, und Schätzgenauigkeit als eigene Auswertungen",
  "productPage.analytics.section.kpis.bullet.3": "Eine Wochenübersicht, und ein Monatsbericht in Sätzen statt Diagrammen",
  "productPage.analytics.section.kpis.alt":
    "Das Kennzahlen-Dashboard: Verkaufskarten, Geldfluss mit Einnahmen gegen Ausgaben je Tag, und Betriebskosten",
  "productPage.analytics.section.overhead.heading": "Gemeinkosten, und der Mindestpreis, der daraus folgt",
  "productPage.analytics.section.overhead.body":
    "Miete, Versicherung, Telefone, die Bürogehälter, der Kredit fürs Fahrzeug und was das Fahrzeug jeden Monat an Wert verliert — einmal eingetragen. Sagen Sie FieldQuo, wie viele Aufträge das Team in einer normalen Woche übernimmt, und es sagt Ihnen den niedrigsten Preis, den ein Auftrag tragen kann und trotzdem den Betrieb deckt.",
  "productPage.analytics.section.overhead.bullet.1": "Fixkosten, Gehälter, Schulden, Anlagen und Abschreibung, fällige Rechnungen",
  "productPage.analytics.section.overhead.bullet.2": "Bezahlte Stunden, die nie einen Auftrag erreicht haben, als Gemeinkosten gezählt, nicht versteckt",
  "productPage.analytics.section.overhead.bullet.3": "Der Mindestpreis steht neben der Angebotssumme, während Sie sie erstellen",
  "productPage.analytics.section.overhead.alt":
    "Der Gemeinkosten-Bildschirm: Aufträge je Woche, bezahlte Stunden ohne Auftrag, und die Abschnitte Fixkosten, Gehälter und Schulden",
  "productPage.analytics.section.expenses.heading": "Ausgaben, Kostenrate und Reichweite",
  "productPage.analytics.section.expenses.body":
    "Erfassen Sie, was Sie ausgeben, oder importieren Sie einen ganzen Monat aus einer Kontoauszug-CSV, und trennen Sie, was zu einem Auftrag gehört, von dem, was zum Betrieb gehört. Die monatliche Kostenrate und die Reichweite des vorhandenen Geldes folgen daraus.",
  "productPage.analytics.section.expenses.bullet.1": "Import aus einer Bank-CSV; nie ein Bank-Login",
  "productPage.analytics.section.expenses.bullet.2": "Auftragsausgaben gegen Betriebsausgaben, nach Kategorie, über sechs Monate",
  "productPage.analytics.section.expenses.bullet.3": "Marketingausgaben nach Kanal, mit automatischem Import aus Meta Ads",
  "productPage.analytics.section.expenses.alt":
    "Ausgabenverfolgung: erfasste Ausgaben diesen Monat, monatliche Kostenrate, Reichweite, die Aufschlüsselung und der Sechs-Monats-Trend",
  "productPage.analytics.section.costing.heading": "Auftragskalkulation: was Sie angeboten haben gegen das, was es gekostet hat",
  "productPage.analytics.section.costing.body":
    "Das Angebot trägt geschätzte Kosten — Teamstunden, Material laut Rezeptur, ein Gemeinkostenanteil —, die der Kunde nie sieht. Ist der Auftrag fertig, stehen gestempelte Stunden, gekauftes Material und erfasste Ausgaben dem Preis gegenüber, sodass Sie wissen, was Sie wirklich verdient haben und welche Schätzungen aus dem Ruder laufen.",
  "productPage.analytics.section.costing.bullet.1": "Lohn, Material und Ausgaben gegen den angebotenen Preis, je Auftrag",
  "productPage.analytics.section.costing.bullet.2": "Schätzgenauigkeit: die mittlere Abweichung über Ihre abgeschlossenen Aufträge",
  "productPage.analytics.section.costing.bullet.3": "Ein Anstoß, Ihre Kalkulation zu überarbeiten, wenn ein Auftrag die von Ihnen gesetzte Schwelle überschreitet",
  "productPage.analytics.section.costing.alt":
    "Der Bereich Kosten und Marge an einem Angebot: Teamstunden, Gemeinkosten als Preisanteil, Material und Lohn, und die geschätzten Kosten gegen den Angebotspreis",
  "productPage.analytics.section.benchmark.heading": "Wie Ihre Preise dastehen, ohne dass jemand genannt wird",
  "productPage.analytics.section.benchmark.body":
    "Schalten Sie es ein, und Ihr durchschnittliches Angebot je Leistungskategorie wird dem anonymisierten Durchschnitt anderer Betriebe Ihres Gewerks auf der Plattform gegenübergestellt. Ihre einzelnen Angebote werden nie geteilt, und kein Betrieb wird genannt — Ihrer eingeschlossen.",
  "productPage.analytics.section.benchmark.bullet.1": "Einschalten in den Einstellungen; nichts wird verglichen, bis Sie es sagen",
  "productPage.analytics.section.benchmark.bullet.2": "Durchschnittspreis und Abschlussquote je Leistungskategorie",
  "productPage.analytics.section.benchmark.bullet.3": "Nur zusammengefasste Durchschnitte — eine Kategorie mit zu wenigen Betrieben zeigt nichts",
  "productPage.analytics.section.benchmark.alt":
    "Ihr Vergleich, vor dem Einschalten: die Erklärung, dass der Vergleich freiwillig ist, und der Link zu den Einstellungen",
  "productPage.analytics.section.ai.heading": "Fragen Sie FieldQuo AI zu Ihrem eigenen Betrieb",
  "productPage.analytics.section.ai.body":
    "Welche Kunden wurden noch nicht in Rechnung gestellt? Wie hoch ist mein durchschnittliches Angebot diesen Monat? Welche Materialkosten sind am stärksten gestiegen? FieldQuo AI schlägt die Antwort in Ihren eigenen Angeboten, Rechnungen, Kunden und Kosten nach, statt zu raten. Es antwortet nur zu Ihrem Betrieb: allgemeine Fragen lehnt es ab, und die Daten eines anderen Betriebs sieht es nie.",
  "productPage.analytics.section.ai.bullet.1": "Antworten aus Ihren eigenen Zahlen, mit den verwendeten Werten",
  "productPage.analytics.section.ai.bullet.2": "Lehnt alles ab, was nicht Ihren Betrieb betrifft",
  "productPage.analytics.section.ai.bullet.3": "In KI-Guthaben abgerechnet, mit einem Kontingent in jedem Tarif",
  "productPage.analytics.section.ai.alt":
    "FieldQuo AI: vier Fragen zum Ausprobieren, zu nicht abgerechneten Kunden, durchschnittlichem Angebotswert, Materialkosten und unbeantworteten Angeboten",
  "productPage.analytics.faq.other-data.q": "Sieht die KI die Daten anderer Betriebe?",
  "productPage.analytics.faq.other-data.a":
    "Nein. FieldQuo AI liest die Datensätze Ihres eigenen Betriebs und sonst nichts. Der Preisvergleich nutzt anonymisierte Durchschnitte, denen Sie zustimmen; Ihre Angebote werden nie jemandem gezeigt.",
  "productPage.analytics.faq.general.q": "Kann ich ihr allgemeine Fragen stellen?",
  "productPage.analytics.faq.general.a":
    "Nein. Sie beantwortet Fragen zu Ihrem eigenen Betrieb — Ihren Angeboten, Aufträgen, Rechnungen, Kunden, Kosten und Stunden — und lehnt alles andere ab. Sie ist kein allgemeiner Assistent.",
  "productPage.analytics.faq.bank.q": "Muss ich meine Bank verbinden?",
  "productPage.analytics.faq.bank.a":
    "Nein, und Sie können es auch nicht. Einnahmen kommen aus den in FieldQuo erfassten Zahlungen; Ausgaben sind, was Sie erfassen oder aus einer selbst heruntergeladenen Kontoauszug-CSV importieren.",
  "productPage.analytics.faq.benchmark-source.q": "Woher kommen die Vergleichszahlen?",
  "productPage.analytics.faq.benchmark-source.a":
    "Von anderen Betrieben Ihres Gewerks auf FieldQuo, die ebenfalls zugestimmt haben, gemittelt je Leistungskategorie, ohne dass jemand genannt wird. Eine Kategorie mit zu wenigen Betrieben dahinter zeigt lieber nichts als eine irreführende Zahl.",

  // Page furniture shared by all four
  "productPage.chrome.readHow": "Lesen Sie, wie es funktioniert",
  "productPage.chrome.inEnglish": "auf Englisch",
  "productPage.chrome.everythingTitle": "Alles unter {label}",
  "productPage.chrome.everythingBody":
    "Jede hier aufgeführte Funktion ist heute im Produkt. Wo eine an ihre Grenze stößt, steht es dabei.",
  "productPage.chrome.faqTitle": "Häufige Fragen",
};

export default de;
