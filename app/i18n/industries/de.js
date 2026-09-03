// app/i18n/industries/de.js — see en.js for structure and rationale.
//
// Drafted, not reviewed by a native speaker. Formal address (Sie) throughout.
//
// One German-specific defect the reviewer has to decide about:
// IndustryPageContent.js lowercases the trade label before substituting
// {trade} (`content.label.toLowerCase()`). German capitalises nouns, so every
// {trade} substitution renders "maler & lackierer" rather than "Maler &
// Lackierer". The catalogue cannot fix that from here — the fix is to stop
// lowercasing for de. Both strings are phrased so the damage is one word.

const de = {
  chrome: {
    startTrial: "Kostenlos testen",
    talkToUs: "Sprechen Sie mit uns",
    noCard: "Ihr erster Monat ist gratis — Ihre Karte wird erst danach belastet.",
    videoSoon: "Produktrundgang folgt in Kürze",
    videoDemoPrefix: "Lieber eine Live-Demo?",
    videoDemoLink: "Demo buchen",
    soundFamiliar: "Kommt Ihnen das bekannt vor?",
    // {trade} wird kleingeschrieben eingesetzt — siehe Kopfkommentar.
    painIntro:
      "Das sind die Dinge, die Betriebe im Bereich {trade} still und leise Geld kosten. Und das tut FieldQuo gegen jedes einzelne davon.",
    ctaTitle: "Testen Sie es bei Ihrem nächsten Auftrag im Bereich {trade}",
    ctaBody:
      "Hinterlegen Sie Ihre Preise, schicken Sie ein Angebot raus und sehen Sie, ob Ihnen das den Abend spart. Mehr ist der Test nicht.",
    nearby: "Auch für benachbarte Gewerke",
  },

  trades: {
    cleaning: {
      label: "Gebäudereinigung",
      headline:
        "Software für die Gebäudereinigung, die wiederkehrende Aufträge im Griff behält",
      description:
        "Unterhalts- und Gebäudereinigung lebt von wiederkehrenden Einsätzen, wechselnden Teams und knappen Margen je Auftrag. FieldQuo bringt Einsatzplan, Checkliste und Rechnung an einem Ort zusammen.",
      pains: [
        {
          pain: "Stammkunden werden jede Woche von Hand neu eingeplant",
          fix: "Legen Sie den Turnus einmal fest, dann wiederholt sich der Einsatzplan von selbst — jedes Mal mit dem richtigen Team.",
        },
        {
          pain: "Das Team überspringt Schritte, und der Kunde merkt es vor Ihnen",
          fix: "Checklisten je Auftrag, die Ihr Team am Handy abhakt — der Standard ist derselbe, wer auch kommt.",
        },
        {
          pain: "Kleine Rechnungen bleiben offen, weil sich das Nachfassen nicht lohnt",
          fix: "Automatisches Nachfassen bei überfälligen Rechnungen, und der Kunde zahlt direkt aus der E-Mail heraus online.",
        },
        {
          pain: "Sie wissen nicht, welche Verträge sich wirklich rechnen",
          fix: "Zeiten je Auftrag erfasst und dem gegenübergestellt, was Sie berechnet haben — unrentable Verträge fallen früh auf.",
        },
      ],
    },

    "construction-contracting": {
      label: "Bau & Ausbau",
      headline: "Bausoftware, die Ihre Marge bei jedem Angebot schützt",
      description:
        "Ausufernder Leistungsumfang, Nachunternehmer und Materialpreise, die sich zwischen Angebot und Baubeginn bewegen. FieldQuo hält Angebote, Termine und echte Kosten zusammen, damit Sie wissen, wo ein Projekt steht.",
      pains: [
        {
          pain: "Ein Angebot kostet einen ganzen Abend und übersieht trotzdem etwas",
          fix: "Bauen Sie aus Ihrer eigenen bepreisten Leistungsliste mit wiederverwendbaren Leistungsgruppen — ein Angebot wird zusammengesetzt statt geschrieben.",
        },
        {
          pain: "Materialkosten bewegen sich zwischen Angebot und erstem Spatenstich",
          fix: "Materialkosten mit Preisverlauf, damit Sie mit den heutigen Preisen kalkulieren und nicht mit denen der letzten Saison.",
        },
        {
          pain: "Nachträge werden mündlich vereinbart und bei der Rechnung vergessen",
          fix: "Angebot überarbeiten, online erneut freigeben lassen — die Rechnung übernimmt die Änderung automatisch.",
        },
        {
          pain: "Dass ein Projekt Geld verloren hat, merken Sie erst danach",
          fix: "Lohn, Material und Ausgaben laufen mit dem Auftrag mit, statt hinterher rekonstruiert zu werden.",
        },
      ],
    },

    electrical: {
      label: "Elektro",
      headline: "Software für Elektrobetriebe, gebaut rund um Serviceeinsätze",
      description:
        "Zwischen Serviceeinsätzen, Zählerschrank-Erneuerungen und Prüfterminen summiert sich die Büroarbeit schnell. FieldQuo übernimmt den Papierkram, damit Ihre Fachstunden in abrechenbare Arbeit fließen.",
      pains: [
        {
          pain: "Ein Notdiensteinsatz zerlegt den geplanten Tag",
          fix: "Ziehen Sie die Arbeit auf einen anderen Slot — betroffene Kunden und das Team werden automatisch benachrichtigt.",
        },
        {
          pain: "Für ein Angebot zum Zählerschrank tippen Sie immer wieder dieselben Positionen",
          fix: "Hinterlegte Leistungsliste mit Ihren eigenen Sätzen — Arbeit auswählen, anpassen, senden.",
        },
        {
          pain: "Auftragsfotos und Prüfnotizen liegen auf irgendeinem Handy",
          fix: "Fotos und Notizen hängen am Auftrag und sind auffindbar, wenn Kunde oder Prüfer Monate später fragt.",
        },
        {
          pain: "Azubi-Stunden werden zur Lohnabrechnung geschätzt",
          fix: "Zeiten auf echte Aufträge gebucht, vom Vorgesetzten freigegeben und direkt in die Auszahlung übernommen.",
        },
      ],
    },

    hvac: {
      label: "Heizung & Klima",
      headline: "HLK-Software für Saisonspitzen und Wartungsverträge",
      description:
        "Ihr Jahr besteht aus zwei Ansturmphasen und zwei ruhigen Strecken. FieldQuo hilft Ihnen, die Spitze zu verplanen, ohne jemanden fallen zu lassen, und in den ruhigen Monaten Wartungsumsatz zu halten.",
      pains: [
        {
          pain: "Die erste Hitzewelle bringt mehr Anrufe, als Sie einplanen können",
          fix: "Eine Buchungsseite mit echter Verfügbarkeit — Kunden buchen sich selbst in freie Slots, statt in der Leitung zu warten.",
        },
        {
          pain: "Wartungsverträge geraten in Vergessenheit, bis der Kunde anruft",
          fix: "Wiederkehrende Einsätze im Voraus geplant, mit automatischen Erinnerungen — Vertragsarbeit bucht sich selbst.",
        },
        {
          pain: "Techniker kommen an, ohne zu wissen, welche Anlage vor Ort steht",
          fix: "Die komplette Auftrags- und Kundenhistorie am Handy, samt dem, was beim letzten Einsatz gemacht wurde.",
        },
        {
          pain: "Angebote für Einbauten verlieren gegen den, der zuerst geantwortet hat",
          fix: "Angebot vor Ort erstellen und senden; der Kunde nimmt es online an, ohne zu warten, bis Sie im Büro sind.",
        },
      ],
    },

    handyman: {
      label: "Hausmeisterservice",
      headline: "Software für Aufträge, die sich nie wiederholen",
      description:
        "Viele kleine Aufträge, große Bandbreite und Preise, die schnell gehen müssen, ohne schludrig zu werden. FieldQuo hält den Aufwand im Verhältnis zur Auftragsgröße.",
      pains: [
        {
          pain: "Jeder Auftrag ist anders, also lässt sich nichts wiederverwenden",
          fix: "Eine Liste Ihrer häufigen Tätigkeiten und Sätze, aus der Sie zusammenstellen — egal wie ungewöhnlich die Kombination ist.",
        },
        {
          pain: "Für kleine Aufträge lohnt sich kein förmliches Angebot — bis gestritten wird",
          fix: "Angebot in unter einer Minute vom Handy senden — der Kunde nimmt es schriftlich an, und es ist dokumentiert.",
        },
        {
          pain: "Ein halber Tag geht für Terminanrufe drauf",
          fix: "Kunden buchen sich selbst in Slots, die Sie tatsächlich frei haben.",
        },
        {
          pain: "Bar- und Überweisungszahlungen werden nie sauber erfasst",
          fix: "Jede Zahlungsart lässt sich auf die Rechnung buchen, damit die Bücher der Wirklichkeit entsprechen.",
        },
      ],
    },

    landscaping: {
      label: "Garten- & Landschaftsbau",
      headline: "GaLaBau-Software für Planung, Ausführung und Saisonteams",
      description:
        "Projekte von der Planung bis zur Ausführung, saisonale Aushilfen und Wetter, das Ihre Woche umschreibt. FieldQuo hält Angebote, Teams und Kosten zusammen, wenn der Plan ständig in Bewegung ist.",
      pains: [
        {
          pain: "Regen schreibt die Woche um, und alle müssen Bescheid wissen",
          fix: "Aufträge im Kalender verschieben — betroffene Kunden und Teams werden automatisch benachrichtigt.",
        },
        {
          pain: "Angebote für Planung und Ausführung sind lang und brauchen Tage",
          fix: "Leistungen mit Fotos in Abschnitte gruppieren, damit ein großes Angebot klar liest und schnell entsteht.",
        },
        {
          pain: "Saisonkräfte machen die Lohnkosten schwer greifbar",
          fix: "Zeiten je Auftrag und je Mitarbeiter erfasst — so kennen Sie die echten Lohnkosten einer Ausführung.",
        },
        {
          pain: "Pflanzen- und Materialkosten fressen die Marge unbemerkt",
          fix: "Materialkosten mit Preisverlauf erfassen und dem gegenüberstellen, was Sie angeboten haben.",
        },
      ],
    },

    "lawn-care": {
      label: "Rasenpflege",
      headline: "Software für Rasenpflege, gebaut für dichte Touren",
      description:
        "Viele Aufträge, kleine Beträge, und der Gewinn hängt daran, wie eng Ihre Tour liegt. FieldQuo hält wiederkehrende Einsätze und die Abrechnung mit minimalem Aufwand je Stopp am Laufen.",
      pains: [
        {
          pain: "Dieselben Wochenkunden neu einzuplanen ist selbst schon ein Job",
          fix: "Turnus einmal festlegen — die Einsätze entstehen von selbst, mit dem richtigen Team daran.",
        },
        {
          pain: "Dutzende kleine Konten abzurechnen frisst einen Abend",
          fix: "Rechnungen aus erledigten Einsätzen im Stapel erzeugen, mit Links zur Onlinezahlung.",
        },
        {
          pain: "Ein ausgefallener oder verregneter Einsatz wird trotzdem berechnet",
          fix: "Einsätze vor Ort als erledigt oder ausgefallen markieren — die Abrechnung folgt dem, was wirklich passiert ist.",
        },
        {
          pain: "Sie können nicht sagen, welche Touren sich noch lohnen",
          fix: "Umsatz und Zeit je Auftrag, damit Sie sehen, welche Kunden die Anfahrt rechtfertigen.",
        },
      ],
    },

    painting: {
      label: "Maler & Lackierer",
      headline: "Malersoftware für Angebote, die Kunden auch annehmen",
      description:
        "Malerarbeiten werden über das Angebot gewonnen — Klarheit, Fotos und schneller sein als die anderen beiden Bieter. FieldQuo hilft Ihnen, noch am selben Tag ein professionelles Angebot zu senden.",
      pains: [
        {
          pain: "Sie sind das dritte Angebot und das langsamste",
          fix: "Bauen Sie das Angebot vor Ort aus Ihren eigenen Sätzen und senden Sie es, bevor Sie die Einfahrt verlassen.",
        },
        {
          pain: "Kunden verstehen nicht, was enthalten ist, und handeln",
          fix: "Aufgegliederter Leistungsumfang mit Fotos und klaren Einschlüssen — das Gespräch dreht sich um die Arbeit statt um die Zahl.",
        },
        {
          pain: "Farbton und Untergrundvorbereitung werden mündlich vereinbart und später bestritten",
          fix: "Es steht im angenommenen Angebot, mit Zeitstempel und der Online-Annahme des Kunden daran.",
        },
        {
          pain: "Farbe und Material kosten mehr, als Sie einkalkuliert hatten",
          fix: "Materialkosten mit Verlauf erfassen, damit Ihre Kalkulationsannahmen aktuell bleiben.",
        },
      ],
    },

    plumbing: {
      label: "Sanitär",
      headline: "Sanitärsoftware für Notdienst und geplante Arbeiten",
      description:
        "Notfälle halten sich nicht an den Einsatzplan, und die Büroarbeit bleibt trotzdem liegen. FieldQuo hält Disposition, Auftragshistorie und Rechnungsstellung in Bewegung — ganz ohne Backoffice.",
      pains: [
        {
          pain: "Ein Notdiensteinsatz sprengt einen verplanten Tag",
          fix: "Betroffene Aufträge mit ein paar Tipps umplanen; Kunden und Team werden benachrichtigt, ohne dass Sie telefonieren.",
        },
        {
          pain: "Sie schreiben um 22 Uhr Rechnungen, weil der Tag randvoll war",
          fix: "Den erledigten Auftrag direkt vor Ort in eine Rechnung verwandeln, mit Zahlungslink, den der Kunde sofort nutzen kann.",
        },
        {
          pain: "Niemand weiß mehr, was beim letzten Mal an diesem Objekt gemacht wurde",
          fix: "Komplette Auftragshistorie je Kunde, samt Fotos und Notizen, auf dem Handy des Technikers.",
        },
        {
          pain: "Nacharbeiten werden gratis erledigt, weil den ersten Einsatz niemand dokumentiert hat",
          fix: "Jeder Einsatz ist ein Nachweis — was getauscht wurde, wann und zu welchen Bedingungen.",
        },
      ],
    },

    "pressure-washing": {
      label: "Hochdruckreinigung",
      headline: "Software für Hochdruckreinigung: schnelle Angebote, schnelle Abwicklung",
      description:
        "Kurze Aufträge, viele davon, und kalkuliert wird oft nach einem Foto. FieldQuo hält den Aufwand so klein, dass er sich auch bei zwei Stunden Arbeit lohnt.",
      pains: [
        {
          pain: "Nach Fotos zu kalkulieren heißt raten und hoffen",
          fix: "Flächenpreise aus Ihrer eigenen Liste, damit Kalkulationen von Auftrag zu Auftrag gleich bleiben.",
        },
        {
          pain: "Bei kurzen Aufträgen wirkt der Papierkram unverhältnismäßig",
          fix: "Angebot, Einsatzplanung und Rechnung vom Handy aus, je ein paar Minuten.",
        },
        {
          pain: "Quer durch die Stadt zu verstreuten Aufträgen zu fahren killt den Tag",
          fix: "Sehen Sie die Aufträge des Tages im Zusammenhang und legen Sie die Arbeit sinnvoll zusammen.",
        },
        {
          pain: "Vorher-Nachher-Fotos versauern in der Kamerarolle",
          fix: "Fotos hängen am Auftrag — nützlich bei Streit und später fürs Marketing.",
        },
      ],
    },

    roofing: {
      label: "Dachdecker",
      headline: "Dachdeckersoftware für große Angebote und koordinierte Teams",
      description:
        "Hochpreisige Aufträge, Wetterabhängigkeit und Kunden, die vor der Unterschrift überzeugt werden wollen. FieldQuo hilft Ihnen, klar zu kalkulieren und die Teams zu koordinieren, sobald Sie den Auftrag haben.",
      pains: [
        {
          pain: "Ein fünfstelliges Angebot bekommt eine Zeile E-Mail und dann keine Antwort",
          fix: "Ausführliche Angebote mit Leistungsumfang, Fotos und Varianten, die der Kunde online annimmt — und automatisches Nachfassen, wenn er still bleibt.",
        },
        {
          pain: "Das Wetter verschiebt den Plan, und das Team erfährt es spät",
          fix: "Einmal umplanen; Benachrichtigungen an Team und Kunde gehen automatisch raus.",
        },
        {
          pain: "Anzahlungen und Abschlagszahlungen führen Sie im Kopf",
          fix: "Anzahlungen und Teilzahlungen auf die Rechnung buchen, mit einem Saldo, den beide Seiten jederzeit sehen.",
        },
        {
          pain: "Materialverschnitt frisst still und leise die Marge",
          fix: "Materialkosten je Auftrag erfassen und mit dem vergleichen, was Sie im Angebot angesetzt hatten.",
        },
      ],
    },

    "tree-care": {
      label: "Baumpflege",
      headline: "Baumpflege-Software für risikoreiche, hochwertige Arbeit",
      description:
        "Technik, Arbeitssicherheit und Aufträge, die nach Erfahrung statt nach Preisliste kalkuliert werden. FieldQuo hält den Nachweis lückenlos — von der Begutachtung bis zur Rechnung.",
      pains: [
        {
          pain: "Jeder Auftrag wird nach Erfahrung bepreist, und nichts ist vergleichbar",
          fix: "Vergangene Aufträge mit Leistungsumfang, Fotos und Endpreis bleiben durchsuchbar — Ihre Erfahrung bekommt eine Referenz.",
        },
        {
          pain: "Gefahren vor Ort werden besprochen und nie festgehalten",
          fix: "Notizen, Fotos und Checklisten hängen am Auftrag, bevor das Team anrückt.",
        },
        {
          pain: "Sturmschäden kommen alle auf einmal herein",
          fix: "Anfragen über ein Buchungsformular annehmen und sortieren, ohne dass das Telefon durchklingelt.",
        },
        {
          pain: "Technik- und Teamzeiten schlagen sich nicht im Preis nieder",
          fix: "Zeiterfassung je Auftrag gegen das, was Sie berechnet haben — die Preisbildung verbessert sich mit Belegen.",
        },
      ],
    },
  },
};

export default de;
