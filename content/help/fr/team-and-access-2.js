// content/help/fr/team-and-access-2.js
//
// Partie 2 de la catégorie « team-and-access » en français (voir le
// composeur, team-and-access.js) : heures, congés, paie, sous-traitants,
// véhicules, achats et journal d'activité.
//
// Même structure que l'anglais, article par article (mêmes identifiants de
// section, mêmes blocs dans le même ordre, mêmes figures) — le script
// scripts/check-help-centre.mjs compare les deux. Les mots à l'écran sont
// les chaînes du bloc `fr` de app/i18n/appMessages.js.
export const ARTICLES = {
  "working-hours-and-bookable-hours": {
    title: "Heures de travail et heures réservables",
    summary:
      "Deux semaines par personne sur un seul écran : le quart que le bureau planifie, et la plage plus étroite qu'un client peut réserver en ligne — et pourquoi on les garde séparées.",
    updated: "2026-09-12",
    intro: [
      "Chaque membre de votre équipe a deux horaires hebdomadaires, et FieldQuo les garde séparés exprès. Les **Heures de travail**, c'est le quart : quand la personne est au travail, ce que la planification et les congés utilisent. Les **Heures réservables**, c'est la plage qu'un client peut choisir sur votre page de réservation publique et votre site web. Un estimateur peut travailler de 8 h à 16 h et ne prendre des consultations que de 14 h à 16 h parce que ses matins sont sur les chantiers — un seul champ ne peut pas dire ça.",
      "Les deux se trouvent dans **Paramètres → Disponibilités**, et les deux sont par personne. Les heures d'ouverture de votre entreprise sont encore autre chose : elles vivent dans le Profil de l'entreprise et c'est ce que le public lit comme « quand la boutique est ouverte ». Voir [[opening-hours|Heures d'ouverture]].",
    ],
    sections: [
      {
        id: "overview",
        heading: "Vue d'ensemble",
        blocks: [
          { p: "L'écran s'intitule **Vos heures** quand vous modifiez les vôtres et **Heures de {name}** quand un gestionnaire modifie celles de quelqu'un d'autre. Sous le titre, deux éditeurs de semaine : **Heures de travail** (« Votre quart. Utilisé pour la planification et les feuilles de temps. Jamais montré aux clients. ») et **Heures réservables** (« Quand les clients peuvent vous réserver sur votre calendrier public et votre site web. Généralement une plage plus étroite que votre quart. »). Une barre collante **Enregistrer les heures** reste au bas, parce que sur un téléphone le bouton serait autrement sous quatorze rangées de champs." },
          { p: "Une personne devient réservable dès qu'elle enregistre au moins une journée réservable. Sans heures réservables, la page le dit : « Sans heures réservables, vous n'apparaîtrez pas comme option sur la page de réservation de votre entreprise. » C'est l'adhésion concrète — régler ses heures, c'est dire « oui, réservez-moi »." },
        ],
      },
      {
        id: "on-the-screen",
        heading: "Ce qu'il y a à l'écran",
        blocks: [
          { bullets: [
            "**Heures de qui** — un sélecteur qui liste chaque membre actif de l'équipe, avec « (vous) » après votre propre nom. Il n'apparaît que pour une personne autorisée à gérer l'équipe et seulement quand la liste compte plus d'une personne. Choisir un collègue affiche une ligne ambre : « Vous modifiez les heures de quelqu'un d'autre. Cette personne verra le changement sur son propre horaire. »",
            "**Heures de travail** — une rangée par jour de la semaine, dans l'ordre de semaine de votre entreprise. Cochez le jour, puis une heure de début, **à**, une heure de fin. Un jour non coché affiche **Non planifié**; une fin avant le début affiche **La fin doit être après le début**.",
            "**Heures réservables** — les sept mêmes rangées pour la plage publique. En dessous, un avertissement ambre liste chaque jour où la plage réservable sort du quart : « Les clients pourraient vous réserver quand vous ne travaillez pas : … C'est permis — vérifiez simplement que c'est intentionnel. »",
            "**Enregistrer les heures** — enregistre les deux semaines ensemble et affiche **Enregistré**.",
          ] },
        ],
      },
      {
        id: "set-your-hours",
        heading: "Comment régler les heures de quelqu'un",
        blocks: [
          { steps: [
            "Ouvrez **Paramètres → Disponibilités**. Depuis le calendrier de l'équipe, **Modifier les heures** sur la carte d'une personne arrive ici avec cette personne déjà choisie.",
            "Si vous gérez l'équipe, choisissez la personne sous **Heures de qui**; sinon, vous modifiez les vôtres.",
            "Sous **Heures de travail**, cochez chaque jour où la personne travaille et réglez le début et la fin du quart.",
            "Sous **Heures réservables**, cochez les jours et les heures qu'un client peut réserver. Laissez tous les jours décochés si cette personne ne doit pas apparaître du tout sur la page de réservation.",
            "Appuyez sur **Enregistrer les heures**. Lisez d'abord l'avertissement ambre s'il y en a un — c'est permis, mais c'est habituellement une faute de frappe.",
          ] },
          { figure: "harness:settings-availability", caption: "Paramètres → Disponibilités — le sélecteur Heures de qui, puis Heures de travail et Heures réservables, chacun une case par jour avec un début et une fin." },
          { note: "L'enregistrement remplace la semaine entière, pas seulement les rangées touchées. Si la page n'a pas pu charger les heures existantes de quelqu'un, elle refuse d'afficher l'éditeur et propose **Réessayer** — une semaine vide enregistrée par-dessus une vraie ferait disparaître cette personne de la page de réservation sans un mot." },
        ],
      },
      {
        id: "what-each-control-changes",
        heading: "Ce que chaque commande change",
        blocks: [
          { table: {
            head: ["Commande", "Ce qu'elle change"],
            rows: [
              ["Un jour coché sous Heures de travail", "La planification traite un quart hors de ces heures comme un avertissement, jamais un blocage — les heures supplémentaires, c'est normal. Les congés comptent les jours ouvrés à partir de ces jours (lundi à vendredi quand aucun n'est réglé), et un congé payé sur un bulletin est calculé à partir d'eux."],
              ["Un jour coché sous Heures réservables", "La page de réservation et votre site web offrent cette plage pour cette personne. Les créneaux sont calculés à partir d'elle, moins les réservations existantes et les congés approuvés."],
              ["Aucun jour réservable", "La personne n'est pas listée sur la page de réservation. Rien d'autre ne change — elle est toujours planifiée et payée normalement."],
              ["Heures de qui", "Bascule chaque rangée de l'écran vers cette personne. Ça ne change jamais les heures d'ouverture de l'entreprise."],
            ],
          } },
          { warning: "Une plage réservable un jour sans heures de travail, ou hors du quart, est acceptée après l'avertissement. Un client peut alors réserver cette personne quand le bureau n'a personne d'inscrit au travail. Faites-le seulement si c'est voulu." },
        ],
      },
      {
        id: "who-can-see-it",
        heading: "Qui peut le voir",
        blocks: [
          { p: "Tout le monde. Disponibilités est l'une des lignes de paramètres que chaque niveau d'accès conserve, y compris Crew, parce que c'est le seul endroit où une personne règle ses propres heures. N'importe qui peut lire et modifier ses deux semaines." },
          { p: "Modifier les heures de quelqu'un d'autre exige la permission de gestion d'équipe — un propriétaire, un administrateur, un Manager ou un Dispatcher. Les autres ne voient jamais le sélecteur **Heures de qui**, et le serveur refuse un changement à la semaine d'une autre personne, peu importe ce que le navigateur envoie. Voir [[access-levels-overview|Niveaux d'accès : qui voit quoi]]." },
        ],
      },
    ],
    faq: [
      { q: "Les heures de travail changent-elles ce que voit un client?", a: "Non. Le quart est interne et l'indication à l'écran le dit — « Jamais montré aux clients ». Seule la plage réservable atteint la page de réservation et le site web." },
      { q: "Une personne peut-elle avoir deux quarts dans une journée, ou un quart de nuit?", a: "Pas sur cet écran. Chaque jour tient un début et une fin, et la fin doit être plus tard que le début. Une journée coupée s'inscrit par ses bornes extérieures." },
      { q: "Pourquoi un estimateur manque-t-il sur notre page de réservation?", a: "Il n'a aucune heure réservable enregistrée, ou son compte est inactif. Ouvrez ses heures, cochez au moins un jour sous Heures réservables, et enregistrez." },
    ],
  },

  "time-off-policies": {
    title: "Politiques de congés",
    summary:
      "Les types de congés que votre équipe peut prendre et comment chaque solde s'accumule — jours fixes, par période de paie, ou indemnité de vacances en pourcentage — plus le report de fin d'année, fait à la main.",
    updated: "2026-09-12",
    intro: [
      "Une politique, c'est un type de congé — Vacances, Maladie, Personnel, Non payé, Autre — avec une règle sur ce qu'une personne accumule et sur la nécessité qu'un gestionnaire approuve la demande. Les politiques vivent dans **Paramètres → Politiques de congés**; les demandes et les soldes qu'elles produisent vivent sur l'écran **Congés**, où le personnel demande et les gestionnaires approuvent. Voir [[time-off-requests|Demandes de congés]].",
      "FieldQuo suit ce que vous configurez. Il ne décide pas de ce que vous devez : la note au bas de l'écran dit que les minimums légaux varient selon la province, l'État et l'ancienneté, et les ensembles de départ disent clairement de quelle année viennent leurs chiffres.",
    ],
    sections: [
      {
        id: "overview",
        heading: "Vue d'ensemble",
        blocks: [
          { p: "L'écran est coiffé de **Politiques de congés** — « Les congés que votre équipe peut prendre, et comment ils s'accumulent. Les demandes et les soldes se trouvent dans Congés. » Sans politique encore, une carte de départ est offerte d'abord; dès que vous en avez au moins une, la carte disparaît et la section **Fin d'année** apparaît à sa place." },
          { p: "Trois méthodes d'accumulation existent et elles sont vraiment différentes. **Jours fixes par an** rend toute l'allocation disponible tout de suite. **S'accumule à chaque paie** répartit les jours sur les périodes de paie écoulées, selon la fréquence des [[payroll-settings|Paramètres de paie]] — plus bas en janvier, complet en décembre. **Indemnité de vacances (% du brut)** accumule de l'argent, pas des jours, à partir du brut des paies approuvées; un congé sous cette méthode n'est pas limité par un solde de jours." },
        ],
      },
      {
        id: "on-the-screen",
        heading: "Ce qu'il y a à l'écran",
        blocks: [
          { bullets: [
            "**Commencer avec l'ensemble Canada** (ou États-Unis, Royaume-Uni) — une carte par ensemble de départ avec son nombre de politiques et « chiffres en date de 2024 ». L'ensemble qui correspond au pays de votre profil d'entreprise est offert en premier, avec une ligne disant d'où ce pays a été lu; les autres sont sous « Vous embauchez dans un autre pays ? Ils sont ici aussi. » Rien n'est chargé tant que vous n'appuyez pas.",
            "**Politiques** avec **Ajouter une politique** — une carte par politique active : son nom, des badges **non payé** et **approuvé automatiquement**, puis la méthode, le droit (« 15 jours/an » ou « 4% du brut ») et le report (« report 5 jours » ou « illimité »), avec **Modifier** et un bouton de retrait.",
            "**Retirées** — les politiques retirées après avoir servi. Elles gardent leurs demandes passées et sont marquées **non réservable**.",
            "**Fin d'année** — « Reportez les jours inutilisés de 2025 à 2026, plafonnés par la limite de report de chaque politique. » Un bouton, appuyé par vous, jamais automatique.",
          ] },
        ],
      },
      {
        id: "add-a-policy",
        heading: "Comment ajouter une politique",
        blocks: [
          { steps: [
            "Ouvrez **Paramètres → Politiques de congés**.",
            "Soit appuyez sur un ensemble de départ pour charger ses politiques d'un coup, soit appuyez sur **Ajouter une politique** pour un formulaire vide.",
            "Donnez-lui un nom et choisissez le **Type** — Vacances, Maladie, Personnel, Non payé ou Autre.",
            "Choisissez **Comment elle s'accumule**, puis remplissez **Jours par an** (ou **Pourcentage du brut** pour la méthode en argent).",
            "Réglez le **Plafond de report (jours)** — « Vide signifie illimité. 0 signifie « à prendre ou à perdre ». » Cochez ou décochez **Payé** et **Nécessite l'approbation d'un gestionnaire**.",
            "Appuyez sur **Ajouter une politique**. Les soldes de chaque employé actif sont recalculés sur-le-champ.",
          ] },
          { figure: "harness:settings-leave", caption: "Paramètres → Politiques de congés — la liste Politiques avec une politique Vacances et une politique Maladie approuvée automatiquement, et la carte Fin d'année." },
          { tip: "L'ensemble Canada compte quatre politiques : Vacation pay (4%), Vacation days (10 jours, report 5), Paid sick leave (10 jours, approuvé automatiquement, à prendre ou à perdre) et Unpaid leave. Chargez-le, puis modifiez les chiffres selon votre province et votre monde — une politique déjà présente sous le même nom est sautée, jamais écrasée." },
        ],
      },
      {
        id: "what-each-setting-changes",
        heading: "Ce que chaque réglage change",
        blocks: [
          { table: {
            head: ["Réglage", "Ce qu'il change"],
            rows: [
              ["Type", "Une étiquette sur la carte de solde et sur les demandes. Ça ne change pas le calcul."],
              ["Jours fixes par an", "Tout le nombre de **Jours par an** est disponible dès le premier jour. Une personne avec une date d'embauche cette année reçoit une part au prorata; sans date d'embauche au dossier, elle reçoit le montant entier."],
              ["S'accumule à chaque paie", "**Jours par an** divisés sur les périodes de paie de l'année, accordés à mesure que chaque période passe."],
              ["Indemnité de vacances (% du brut)", "Accumule un montant égal au pourcentage du brut des paies approuvées et payées cette année. Les demandes sous cette méthode ne sont pas vérifiées contre un solde de jours."],
              ["Plafond de report (jours)", "Combien de jours inutilisés le bouton **Fin d'année** peut reporter à l'année suivante. Vide, c'est illimité; 0, c'est aucun."],
              ["Payé", "Décoché, la politique affiche un badge **non payé** et les jours approuvés sous elle ne sont pas ajoutés à un bulletin. Coché, un congé approuvé dans une période de paie devient une ligne de gain sur le bulletin."],
              ["Nécessite l'approbation d'un gestionnaire", "Coché, une demande attend en attente jusqu'à ce qu'un gestionnaire l'approuve. Décoché, la demande est approuvée dès qu'elle est faite et le solde est consommé immédiatement — la carte affiche **approuvé automatiquement**."],
              ["Retirer", "Jamais utilisée : supprimée carrément. Utilisée au moins une fois : retirée à la place, pour que les demandes passées gardent leur historique et que personne ne puisse la réserver de nouveau."],
            ],
          } },
        ],
      },
      {
        id: "year-end",
        heading: "Fin d'année",
        blocks: [
          { p: "Les soldes sont par année civile. Les jours inutilisés ne se reportent pas d'eux-mêmes — vous fermez l'année quand vous décidez qu'elle est fermée." },
          { steps: [
            "Ouvrez **Paramètres → Politiques de congés** dans la nouvelle année.",
            "Dans **Fin d'année**, appuyez sur **Reporter les soldes de 2025 à 2026** (les années du bouton suivent le calendrier).",
            "Lisez l'avis : « Jours inutilisés reportés à 2026 pour 12 solde(s). » ou « Rien n'était admissible au report. » Chaque solde est plafonné par la limite de report de sa politique.",
          ] },
          { note: "Le report est inscrit au [[the-activity-log|Journal d'activité]] avec qui l'a fait et combien de soldes ont bougé." },
        ],
      },
      {
        id: "who-can-see-it",
        heading: "Qui peut le voir",
        blocks: [
          { p: "Propriétaires et administrateurs seulement. La ligne est masquée pour tous les autres niveaux et le serveur répond « Only an owner or admin can manage leave policies. » à quiconque d'autre. Un Manager approuve les demandes sur l'écran Congés mais ne règle pas les politiques derrière." },
        ],
      },
    ],
    faq: [
      { q: "Une politique de jours de maladie doit-elle être approuvée?", a: "Seulement si vous cochez **Nécessite l'approbation d'un gestionnaire**. Les ensembles de départ la laissent décochée pour la maladie, donc une demande est approuvée sur-le-champ et le gestionnaire la voit quand même dans la liste." },
      { q: "Où les gens voient-ils leur solde?", a: "Sur l'écran **Congés** — une carte par politique avec l'accumulé et le pris, et un onglet Équipe pour les gestionnaires. Les soldes sont recalculés chaque fois qu'une politique est ajoutée ou modifiée." },
      { q: "Puis-je modifier les chiffres qu'un ensemble de départ m'a donnés?", a: "Oui. Une fois chargées, ce sont vos politiques; appuyez sur **Modifier** sur n'importe quelle carte. FieldQuo ne les change jamais après." },
    ],
  },

  "payroll-runs": {
    title: "Périodes de paie",
    summary:
      "Comment les heures approuvées et les taux enregistrés deviennent une paie avec des bulletins — Calculer, enregistrer comme brouillon, approuver, enregistrer comme payée — et la seule chose que FieldQuo ne fait volontairement pas : déplacer l'argent.",
    updated: "2026-09-12",
    intro: [
      "L'écran **Paie** calcule ce que chaque personne doit recevoir pour une période, à partir des heures qu'un gestionnaire a approuvées dans les Feuilles de temps et des taux enregistrés sur sa fiche, et produit un bulletin par personne. La phrase en haut de l'écran est tout le contrat : « Vous payez par votre propre banque ou votre fournisseur de paie — FieldQuo ne déplace pas l'argent. »",
      "La matrice des fonctionnalités marque la paie comme partielle, et la limite est exactement celle-là : FieldQuo calcule le brut, produit les bulletins et exporte la paie. Il ne paie pas les employés et ne produit pas vos déclarations de retenues — les retenues sont celles que vous ou votre comptable fournissez dans les [[payroll-settings|Paramètres de paie]].",
    ],
    sections: [
      {
        id: "overview",
        heading: "Vue d'ensemble",
        blocks: [
          { p: "Un écran, deux publics. Une personne autorisée à faire la paie voit **Ma rémunération** pour elle-même, puis **Nouvelle période de paie** et la liste **Périodes de paie**. Tous les autres ne voient que **Ma rémunération** et la ligne « Seuls vos propres bulletins de paie sont accessibles depuis votre compte. » — voir [[payslips|Bulletins de paie]]." },
          { p: "Une paie passe par quatre états : **Brouillon** (un document de travail que vous pouvez encore changer ou annuler), **Approuvée** (les bulletins deviennent visibles pour les personnes concernées), **payée (enregistrée)** (un humain a confirmé que l'argent est sorti par la banque ou le fournisseur de paie), et **Annulée**. On dit « enregistrer comme payée », pas « payer », parce qu'un bouton nommé Payer qui ne paierait personne serait la pire commande du produit." },
          { note: "Seulement dans FieldQuo : ni Jobber ni Housecall Pro n'affichent la paie sur leur page de tarifs, à aucun palier. ServiceTitan affiche « payroll management » à partir de son palier Essentials, et Projul ne l'affiche pas. FieldQuo l'inclut dans chaque forfait — comme un calcul et un ensemble de bulletins, jamais comme un virement." },
        ],
      },
      {
        id: "on-the-screen",
        heading: "Ce qu'il y a à l'écran",
        blocks: [
          { bullets: [
            "**Ma rémunération** — **Période en cours** avec ses dates et son jour de paie, vos heures approuvées × votre taux (ou « Aucun taux horaire n'est enregistré sur votre fiche, ce montant ne peut donc pas encore être calculé. »), une barre de progression dans la période, puis **Brut**, **Retenues** et **Net** pour l'année, puis vos bulletins.",
            "**Nouvelle période de paie** — « Seules les heures approuvées sont incluses. Approuvez d'abord les feuilles de temps, sinon ces heures ne seront pas payées. » Quatre champs : **Début de la période**, **Fin de la période**, **Fréquence** (Chaque semaine, Toutes les 2 semaines, Deux fois par mois, Une fois par mois) et **Libellés du bulletin** (Canada, États-Unis, Royaume-Uni), puis **Calculer**.",
            "**Périodes de paie** — une rangée par paie : la période, combien de personnes et la région des libellés (« 5 personnes · CA »), le total net et un badge d'état. Ouvrir une rangée montre chaque ligne et les boutons **Approuver la paie** / **Enregistrer comme payée** / **Exporter CSV**.",
          ] },
        ],
      },
      {
        id: "run-payroll",
        heading: "Comment faire la paie",
        blocks: [
          { steps: [
            "Approuvez d'abord les heures de la période dans **Feuilles de temps** — voir [[timesheets-and-approving-hours|Feuilles de temps et approbation des heures]]. Les heures en attente sont laissées de côté et nommées.",
            "Ouvrez **Paie**. La période est préremplie avec la dernière période close selon votre cycle de paie; la fréquence la suit.",
            "Choisissez la région des **Libellés du bulletin** — elle ne choisit que les noms des retenues sur le bulletin (RPC/AE, Social Security/Medicare, PAYE/NI). Elle ne calcule rien.",
            "Appuyez sur **Calculer**. Un aperçu liste chaque personne avec ses heures, son brut, ses retenues et son net, les totaux, et les remarques — heures non approuvées exclues, heures auto-approuvées incluses, congés payés inclus, ou « Aucune retenue n'est configurée : ces montants sont donc bruts. »",
            "Appuyez sur **Enregistrer comme brouillon**. La paie apparaît sous **Périodes de paie** en Brouillon.",
            "Ouvrez la paie et appuyez sur **Approuver la paie**. Les bulletins deviennent visibles pour les personnes concernées : « Approuvée et visible par votre équipe sous forme de bulletins de paie. Payez-les via votre banque ou votre fournisseur de paie, puis enregistrez-le ici. »",
            "Payez tout le monde hors de FieldQuo, puis appuyez sur **Enregistrer comme payée**. La paie et chaque bulletin sont horodatés.",
          ] },
          { figure: "harness:payroll", caption: "Paie — le formulaire Nouvelle période de paie prérempli avec la dernière période close, et la liste Périodes de paie avec une paie Approuvée et deux enregistrées comme payées." },
          { warning: "L'approbation est le dernier moment sans conséquence. Un brouillon peut chevaucher une période déjà payée — l'aperçu le dit — mais **Approuver la paie** refuse tant qu'une paie approuvée ou payée couvre les mêmes jours. Annulez d'abord la mauvaise." },
        ],
      },
      {
        id: "what-the-run-includes",
        heading: "Ce que la paie inclut",
        blocks: [
          { bullets: [
            "**Les heures approuvées seulement.** Une heure en attente est une réclamation non vérifiée; la payer rendrait l'approbation décorative. L'aperçu nomme les personnes dont les heures ont été exclues.",
            "**Les heures supplémentaires à 1,5×** au-delà de 40 heures dans une semaine, calculées semaine par semaine à l'intérieur de la période. Une période civile (deux fois par mois, une fois par mois) contient des semaines partielles, et la carte du cycle de paie le dit.",
            "**Le taux sur la fiche de la personne** — son taux horaire, ou le coût de main-d'œuvre enregistré sur sa fiche d'équipe quand aucun taux horaire n'est réglé. Sans l'un ni l'autre, la ligne n'affiche aucune paie et un avertissement plutôt que 0,00 $.",
            "**Un salaire** divisé sur la période quand un salaire est enregistré pour la personne au lieu d'un taux horaire.",
            "**Les congés payés approuvés** comme ligne de gain nommée (« Vacances — 5 jours »), calculée à partir de la journée de travail propre à cette personne, pour qu'une semaine de congé ne soit pas une semaine à zéro heure.",
            "**Les retenues et indemnités** des Paramètres de paie, appliquées à tout le monde. Sans aucune, la paie est en brut seulement et le dit.",
          ] },
        ],
      },
      {
        id: "statuses",
        heading: "États",
        blocks: [
          { table: {
            head: ["État", "Ce que ça veut dire"],
            rows: [
              ["Brouillon", "Enregistrée et invisible pour les personnes concernées. Pour la changer, annulez-la et recalculez la période. Peut être annulée."],
              ["Approuvée", "Les chiffres sont finaux. Les bulletins sont visibles et téléchargeables par les personnes concernées. Peut encore être annulée — une paie payée ne le peut pas."],
              ["payée (enregistrée)", "Vous avez confirmé que l'argent est sorti par votre banque ou votre fournisseur de paie. La date est inscrite sur la paie et sur chaque bulletin. Final."],
              ["Annulée", "Conservée dans la liste pour mémoire. Sa période peut être refaite."],
            ],
          } },
        ],
      },
      {
        id: "who-can-see-it",
        heading: "Qui peut le voir",
        blocks: [
          { p: "La ligne **Paie** est dans le menu de tout le monde, parce que tout le monde a des bulletins. Faire la paie — Calculer, Enregistrer comme brouillon, Approuver la paie, Enregistrer comme payée, Exporter CSV — exige le domaine « Payroll & Payslips » réglé à « View everyone's and run payroll », que les propriétaires et administrateurs détiennent d'office. « View everyone's payslips » ouvre chaque paie en lecture seule." },
          { p: "Chaque préréglage — Crew, Estimator, Dispatcher, Manager — commence à « View their own payslips ». La description du Manager dit « pas la paie » et le pense; un propriétaire qui veut qu'un gestionnaire fasse la paie l'accorde délibérément dans l'[[the-custom-access-editor|éditeur d'accès personnalisé]]." },
        ],
      },
    ],
    faq: [
      { q: "FieldQuo vire-t-il les salaires?", a: "Non. Il calcule les chiffres et produit des bulletins et un CSV. Vous payez par votre banque ou votre fournisseur de paie, puis vous appuyez sur Enregistrer comme payée pour que les bulletins puissent dire quand." },
      { q: "Pourquoi quelqu'un apparaît-il à 0 $ ou sans paie?", a: "Aucun taux horaire ni coût de main-d'œuvre n'est enregistré sur sa fiche, ou ses heures de la période sont encore en attente. L'aperçu dit lequel." },
      { q: "Puis-je corriger une paie après son approbation?", a: "Annulez-la et refaites la période, tant qu'elle n'a pas été enregistrée comme payée. Une paie payée est finale; une correction est une seconde paie sur la même période, enregistrée comme brouillon — l'approbation ne refuse que tant qu'une paie approuvée ou payée chevauche." },
      { q: "Que contient Exporter CSV?", a: "Une rangée par personne avec les heures, le brut, une colonne par retenue ou gain nommé dans la paie, et le net — la passation au comptable ou au fournisseur de paie qui paie réellement. Une cellule est laissée vide, pas à 0,00, quand cette personne n'avait pas cette ligne." },
    ],
  },

  "payroll-settings": {
    title: "Paramètres de paie",
    summary:
      "Quand vous payez — fréquence, jour de fin de période, jour de paie — et les composantes de retenue et de gain qu'une paie applique : montants fixes, pourcentages du brut, et tranches d'impôt progressives fournies par vous ou votre comptable.",
    updated: "2026-09-12",
    intro: [
      "**Paramètres → Paie**, c'est ce à partir de quoi les [[payroll-runs|Périodes de paie]] calculent : le cycle de paie, et les composantes qui transforment un brut en net. Tant que rien n'est configuré ici, les paies sont en brut seulement et le disent. Le pied de page énonce le partage des tâches : « FieldQuo effectue les calculs avec les taux que vous enregistrez ici. Il ne produit ni ne remet aucune déclaration, et il ne met pas à jour les taux lorsqu'ils changent — révisez-les chaque année d'imposition avec votre comptable. »",
    ],
    sections: [
      {
        id: "overview",
        heading: "Vue d'ensemble",
        blocks: [
          { p: "La page est coiffée de **Paramètres de paie** — « Les retenues et indemnités appliquées lorsque vous exécutez la paie. Sans elles, les paies n'affichent que le salaire brut. » Une carte **Quand vous payez** vient d'abord, puis **Partir de votre région** (offert tant que vous n'avez aucune composante), puis deux listes : **Retenues** et **Indemnités et gains**, avec **Ajouter une composante** au bas." },
        ],
      },
      {
        id: "on-the-screen",
        heading: "Ce qu'il y a à l'écran",
        blocks: [
          { bullets: [
            "**Quand vous payez** — **À quelle fréquence**, **La période se termine** (un jour de la semaine), **Jour de paie** (un jour de la semaine), le nombre de jours que ça laisse pour approuver les heures, puis **Période en cours** et **Dernière période close** avec leurs dates et jours de paie. Tant que ce n'est pas réglé, on lit « non défini — le réglage par défaut ci-dessous s'applique » avec un bouton **Le configurer**.",
            "**Partir de votre région** — Canada, États-Unis ou Royaume-Uni, chacun avec « 3 composantes · chiffres de 2024 ». En gras : « Ce sont des chiffres publiés pour l'année indiquée — confirmez-les tous avec votre comptable. »",
            "**Retenues** — une rangée par composante avec son nom, un badge **légal** quand elle vient d'un modèle, un badge **désactivé** quand elle est désactivée, et comment elle se calcule : « 5,95% du brut », « 5 tranches progressives », ou un montant fixe, plus **Désactiver** / **Activer** et un bouton de retrait.",
            "**Indemnités et gains** — les mêmes rangées pour l'argent ajouté plutôt que retenu, comme une indemnité d'outils.",
          ] },
        ],
      },
      {
        id: "when-you-pay",
        heading: "Quand vous payez",
        blocks: [
          { p: "La fin de période et le jour de paie sont deux commandes distinctes parce que les heures supplémentaires se calculent contre un seuil hebdomadaire : une période qui contient des semaines entières paie les supplémentaires une fois; une qui coupe une semaine les sous-estime deux fois. La carte dit l'écart entre les deux jours à voix haute — « 4 jours pour approuver les heures » — parce que « du dimanche au jeudi » ne veut rien dire tant que personne ne compte." },
          { table: {
            head: ["Réglage", "Ce qu'il change"],
            rows: [
              ["À quelle fréquence", "Chaque semaine, Toutes les 2 semaines, Deux fois par mois ou Une fois par mois. Détermine la période préremplie dans Nouvelle période de paie, comment un salaire est divisé, et comment les congés par période s'accumulent."],
              ["La période se termine", "Le jour de la semaine où une période finit. Les périodes hebdomadaires et aux 2 semaines contiennent alors des semaines entières; les fréquences civiles affichent une note disant que les supplémentaires hebdomadaires sont calculées sur les semaines partielles de chaque période."],
              ["Jour de paie", "Le jour de la semaine où les gens sont payés. Seuls la date « payé le … » sous Période en cours sur l'écran Paie et l'écart de révision le lisent — FieldQuo ne paie personne ce jour-là."],
            ],
          } },
          { note: "Tout le monde peut lire le cycle de paie — un employé a besoin de savoir quand tombe la paie — mais seul un propriétaire ou un administrateur peut le changer : « Only an owner or admin can change when the company pays. » Un écart d'un jour ou moins entre la fin de période et le jour de paie affiche un avertissement." },
        ],
      },
      {
        id: "add-a-component",
        heading: "Comment ajouter une composante",
        blocks: [
          { steps: [
            "Ouvrez **Paramètres → Paie**. Si vous n'avez encore aucune composante, appuyez sur votre région sous **Partir de votre région** pour charger l'ensemble légal, puis vérifiez chaque chiffre avec votre comptable.",
            "Appuyez sur **Ajouter une composante** et nommez-la — « Cotisations syndicales, Indemnité d'outils ».",
            "Choisissez **Retenue** ou **Indemnité / gain**.",
            "Choisissez comment elle se calcule : **Montant fixe** (même montant à chaque période de paie), **Pourcentage du brut** (« p. ex. RPC à 5,95% ») ou **Tranches progressives** (tranches d'impôt sur le revenu : « Seuils annuels, du plus bas au plus élevé. Laissez le dernier « jusqu'à » vide pour « et plus ». »).",
            "Appuyez sur **Ajouter**. Dès le prochain Calculer, elle est appliquée à tout le monde sur la paie.",
          ] },
          { figure: "harness:settings-payroll", caption: "Paramètres → Paie — la carte Quand vous payez, puis la liste Retenues avec des rangées légales et la liste Indemnités et gains." },
          { tip: "L'ensemble Canada comprend Federal income tax (cinq tranches 2024), CPP à 5,95 % et EI à 1,66 % — la part de l'employé seulement. L'impôt provincial n'est pas inclus : ajoutez les tranches de votre province comme composante Tranches progressives distincte. L'ensemble États-Unis n'a pas d'impôt d'État; l'ensemble Royaume-Uni n'a pas de lettres de catégorie NI." },
        ],
      },
      {
        id: "what-each-control-changes",
        heading: "Ce que chaque commande change",
        blocks: [
          { table: {
            head: ["Commande", "Ce qu'elle change"],
            rows: [
              ["Montant fixe", "Le **Montant par période de paie** est ajouté ou retenu à chaque paie pour chaque personne, peu importe ses heures."],
              ["Pourcentage du brut", "Le pourcentage du brut de cette personne sur la paie."],
              ["Tranches progressives", "Le brut de la période est annualisé, imposé à travers les tranches, et redivisé sur la période — comme toute table d'impôt publiée est écrite. **Ajouter une tranche** et **Retirer la tranche** modifient la liste; le « jusqu'à » de la dernière tranche est laissé vide pour « et plus »."],
              ["Désactiver / Activer", "Une composante désactivée affiche le badge **désactivé** et est sautée au prochain Calculer. Rien n'est supprimé; réactivez-la quand vous voulez."],
              ["Retirer", "« Les bulletins de paie passés conservent ce qui a déjà été retenu. » La composante disparaît des paies futures; chaque paie passée garde sa propre copie des lignes."],
            ],
          } },
        ],
      },
      {
        id: "who-can-see-it",
        heading: "Qui peut le voir",
        blocks: [
          { p: "Propriétaires et administrateurs seulement. La ligne de paramètres **Paie** est masquée pour tous les autres niveaux, et chaque écriture répond « Only an owner or admin can change payroll settings. » Un Manager à qui on a accordé la paie ne peut toujours pas modifier les taux ici — les deux sont des questions différentes, exprès." },
        ],
      },
    ],
    faq: [
      { q: "Une composante peut-elle s'appliquer à une seule personne?", a: "Non. Chaque composante s'applique à tout le monde sur la paie. Une rangée d'une version antérieure marquée « attribué individuellement » n'atteint aucun bulletin et est signalée en ambre; recréez-la comme composante normale ou retirez-la." },
      { q: "Les taux légaux se mettent-ils à jour chaque année?", a: "Non. Ce sont des chiffres publiés pour l'année indiquée, chargés une fois, et ensuite ce sont vos chiffres. Révisez-les chaque année d'imposition avec votre comptable et modifiez les tranches." },
      { q: "Où vit le taux horaire de quelqu'un?", a: "Sur sa fiche d'équipe et sa fiche d'employé, pas ici. Cet écran contient ce qui s'applique à tout le monde; le taux est par personne — voir [[manage-team|Gérer l'équipe]]." },
    ],
  },

  payslips: {
    title: "Bulletins de paie",
    summary:
      "Ce qu'un membre de l'équipe voit sous Ma rémunération — la période en cours, le brut, les retenues et le net de l'année, et un bulletin PDF par paie approuvée — et qui d'autre peut l'ouvrir.",
    updated: "2026-09-12",
    intro: [
      "Un bulletin de paie, c'est la ligne d'une personne sur une paie approuvée, imprimée en PDF à l'image de l'entreprise. La personne voit les siens sous **Ma rémunération** en haut de l'écran **Paie**; quelqu'un qui fait la paie voit ceux de tout le monde à l'intérieur de la paie. Rien n'apparaît pour un brouillon : un brouillon est un document de travail que le bureau peut encore changer, et un bulletin qui change entre mardi et vendredi n'est pas un bulletin.",
    ],
    sections: [
      {
        id: "overview",
        heading: "Vue d'ensemble",
        blocks: [
          { p: "**Ma rémunération** répond à la question pour laquelle un employé ouvre cet écran — qu'est-ce que j'ai gagné cette période, et qu'est-ce que j'ai reçu la dernière — sans attendre que le bureau fasse la paie. **Période en cours** montre les heures approuvées × le taux horaire comme brut, les dates et le jour de paie de la période, et une barre de progression. En dessous, trois tuiles pour l'année : **Brut**, **Retenues**, **Net**." },
          { p: "La liste en dessous compte une rangée par paie approuvée ou payée : la période, les heures (« 80 h normales · 6 h supplémentaires »), « payé le 17 sept. 2026 » ou « en attente de paiement », le net, le brut moins les retenues, et un bouton **PDF**. Tant qu'aucune paie n'est approuvée, la liste dit « Aucun bulletin de paie. Ils apparaissent une fois la période approuvée. »" },
        ],
      },
      {
        id: "on-the-screen",
        heading: "Ce qu'il y a à l'écran",
        blocks: [
          { bullets: [
            "**Période en cours** — « 31 août 2026 → 13 sept. 2026 · payé le 17 sept. 2026 », puis « 80 heures approuvées × 32,00 $/h » ou, sans taux au dossier, « Aucun taux horaire n'est enregistré sur votre fiche, ce montant ne peut donc pas encore être calculé. Vos heures approuvées sont tout de même comptabilisées. » Les heures encore en attente sont comptées à part : « 6 heures supplémentaires inscrites, en attente d'approbation par votre gestionnaire — non comptées ci-dessus. »",
            "**Brut · 2026**, **Retenues · 2026**, **Net · 2026** — le cumul de l'année sur les paies approuvées et payées.",
            "**Les rangées de bulletins** — période, heures, état du paiement et net, les plus récentes d'abord.",
            "**PDF** — télécharge ce bulletin. Le lien est résolu à partir de votre propre fiche d'employé, jamais à partir de ce qu'il y a dans la barre d'adresse.",
          ] },
        ],
      },
      {
        id: "download-a-payslip",
        heading: "Comment télécharger un bulletin",
        blocks: [
          { steps: [
            "Ouvrez **Paie** dans le menu (sous Argent).",
            "Sous **Ma rémunération**, trouvez la période et appuyez sur **PDF**.",
            "Si vous faites la paie et qu'il vous faut celui de quelqu'un d'autre, ouvrez la paie sous **Périodes de paie** et appuyez sur **Bulletin de paie PDF** sur sa ligne.",
          ] },
          { figure: "live:app-payroll", caption: "Paie — Ma rémunération avec Période en cours, les trois tuiles de cumul annuel et la liste des bulletins, avant qu'une paie soit approuvée." },
        ],
      },
      {
        id: "what-a-payslip-says",
        heading: "Ce qu'un bulletin dit",
        blocks: [
          { bullets: [
            "**Le nom, le logo et la couleur de votre entreprise** dans l'en-tête, comme tout autre document que l'entreprise envoie, avec le nom de la personne, son statut d'employé ou de contractuel, et le taux horaire quand il y en a un.",
            "**Les heures** — normales et supplémentaires — quand la ligne en a; une ligne salariée n'en imprime pas.",
            "**Les gains et les retenues** dans l'ordre où ils ont été calculés, puis **Gross pay** et **Net pay**. Les noms des retenues suivent la région choisie pour la paie (CPP/EI, Social Security/Medicare, PAYE/NI).",
            "**La période de paie**, et l'une des mentions « Recorded as paid on … », « Approved, not yet recorded as paid. » ou « Draft — not yet approved. »",
            "**Une déclaration claire** que c'est un relevé de ce qui a été calculé et payé — pas un formulaire gouvernemental, et aucun impôt n'a été remis ni déclaré par ce système.",
          ] },
        ],
      },
      {
        id: "who-can-see-it",
        heading: "Qui peut le voir",
        blocks: [
          { p: "Chaque niveau d'accès dont le domaine « Payroll & Payslips » est au-dessus de « No access » voit les siens — les préréglages commencent tous à « View their own payslips ». « View everyone's payslips » ou « View everyone's and run payroll » ouvre chaque paie et chaque PDF; les propriétaires et administrateurs détiennent ça d'office. Une personne réglée à « No access » ne voit aucune section Ma rémunération." },
          { note: "Le serveur résout « les siens » à partir de la fiche d'employé de la personne connectée. Un lien de bulletin copié du navigateur de quelqu'un d'autre n'ouvre rien." },
        ],
      },
    ],
    faq: [
      { q: "Pourquoi mon bulletin manque-t-il pour les deux dernières semaines?", a: "La paie est encore un brouillon, ou elle n'a pas été créée. Les bulletins apparaissent une fois la paie approuvée; Période en cours montre le brut à date entre-temps." },
      { q: "Est-ce un T4, un W-2 ou un P60?", a: "Non. Le PDF le dit dans son pied de page. C'est un relevé de ce qui a été calculé et payé; les formulaires de fin d'année viennent de votre comptable ou de votre fournisseur de paie." },
      { q: "Pourquoi Période en cours montre-t-elle le brut alors que mon bulletin montre moins?", a: "Période en cours est avant retenues — « c'est donc la valeur du travail, pas ce qui arrivera sur votre compte ». Les retenues s'appliquent quand le bureau fait la période." },
    ],
  },

  "subcontractors-and-insurance": {
    title: "Les sous-traitants et leurs assurances",
    summary:
      "Les entreprises que vous engagez par chantier — leur métier et leur contact, si leur attestation d'assurance et leur attestation CNESST/WSIB/WCB sont en vigueur, ce que vous avez convenu avec eux sur chaque chantier, et ce que vous leur avez payé cette année.",
    updated: "2026-09-12",
    intro: [
      "**Sous-traitants**, c'est la liste des autres entreprises — l'électricien, le fabricant de comptoirs, le couvreur — avec, tout en haut, le seul fait qui a une conséquence le jour même : si leurs papiers sont encore valides. Une attestation d'assurance échue, c'est un sous-traitant qui ne doit pas mettre le pied sur le chantier demain, alors le panneau **Assurance ou attestation qui expire** passe avant tout le reste.",
      "Ce n'est pas la liste des gens que vous employez; ça, c'est [[manage-team|Gérer l'équipe]]. Et ce n'est pas un moyen de payer un sous-traitant : la fonctionnalité que FieldQuo offre bel et bien — payer un contractuel depuis l'application — paie une personne de votre propre équipe, pour des heures pointées, au taux que vous avez fixé. Elle ne peut pas payer un prix forfaitaire à une autre entreprise. Les paiements à une entreprise sous-traitante sont inscrits ici après que l'argent est sorti.",
    ],
    sections: [
      {
        id: "overview",
        heading: "Vue d'ensemble",
        blocks: [
          { p: "L'écran est coiffé de **Sous-traitants** — « Les entreprises que vous engagez par chantier — l'électricien, le couvreur. Leurs dates d'assurance et d'attestation, ce que vous avez convenu avec eux sur chaque chantier, et ce que vous leur avez payé cette année. » Chaque sous-traitant a une fiche avec des documents, les chantiers où il est et les paiements inscrits à son nom; le total de l'année est ce qui devient la [[the-t5018-year-end-list|liste de fin d'année T5018]]." },
          { note: "Ce qu'un sous-traitant est dû et a reçu, c'est du coût de chantier. Les coûts de chantier prennent le **montant convenu** comme coût de ce sous-traitant sur le chantier — un sous-traitant à 5 000 $ qui a reçu 2 000 $ a coûté 5 000 $ au chantier — et les paiements sont la façon de le régler. Voir [[job-costing|Coûts de chantier]]." },
        ],
      },
      {
        id: "on-the-screen",
        heading: "Ce qu'il y a à l'écran",
        blocks: [
          { bullets: [
            "**Assurance ou attestation qui expire** — chaque sous-traitant dont l'assurance ou l'attestation est **Bientôt échue** (d'ici 30 jours) ou **Expirée**, le pire d'abord, chacun nommant laquelle des deux.",
            "**Payé en** avec un sélecteur d'année, et **Liste de fin d'année (CSV)** — affichés seulement à quelqu'un qui peut voir l'argent.",
            "**Une carte par sous-traitant** — le nom de l'entreprise, **Inactif** le cas échéant, puis le métier, la personne-ressource et le téléphone, un badge pour la pire des deux échéances, et, pour qui peut voir l'argent, « 6 840,00 $ payé en 2026 (3 paiements) » avec « Pas de relevé fiscal » quand le sous-traitant est exclu du relevé de fin d'année.",
            "**Ajouter** — ouvre le formulaire de nouveau sous-traitant.",
          ] },
        ],
      },
      {
        id: "add-a-subcontractor",
        heading: "Comment ajouter un sous-traitant",
        blocks: [
          { steps: [
            "Ouvrez **Sous-traitants** (sous Personnes) et appuyez sur **Ajouter**.",
            "Remplissez le **Nom de l'entreprise** et le **Métier** (« électricité, toiture, gypse… »), puis la **Personne-ressource**, le **Courriel** et le **Téléphone**.",
            "Entrez **Assurance (attestation) expire le** et **Attestation CNESST / WSIB / WCB expire le** si vous avez les certificats. « Laissez la date vide si vous n'avez pas le certificat — vide veut dire non consigné, pas expiré. »",
            "Laissez **Figure sur le relevé de fin d'année des sous-traitants (T5018 / 1099-NEC)** coché pour un sous-traitant en construction; décochez-le pour un fournisseur de matériaux incorporé qui, selon votre comptable, n'en reçoit pas.",
            "Appuyez sur **Ajouter le sous-traitant**.",
            "Sur la fiche du sous-traitant, téléversez les certificats sous **Documents** — une **Attestation d'assurance** ou une **Attestation CNESST / WSIB / WCB** avec sa date d'expiration règle la date du sous-traitant du même coup.",
          ] },
          { figure: "create:app-subcontractors-create", caption: "Sous-traitants → Ajouter — le formulaire de nouveau sous-traitant : entreprise, métier, contact, les deux dates d'expiration et la case du relevé de fin d'année." },
          { tip: "Un sous-traitant que vous n'utilisez plus reçoit **Marquer inactif** plutôt qu'une suppression : il sort du sélecteur « ajouter un sous-traitant à un chantier », garde ses chantiers et ses paiements, et figure toujours sur la liste de fin d'année pour les années où vous l'avez payé." },
        ],
      },
      {
        id: "insurance-and-clearance",
        heading: "Assurance et attestation",
        blocks: [
          { p: "Deux échéances datées, dans l'ordre où elles comptent. L'**Assurance** d'abord : une attestation échue vous rend responsable des dommages du sous-traitant dès qu'il est sur le chantier. L'**Attestation** ensuite (CNESST au Québec, WSIB en Ontario, WCB ailleurs) : une attestation échue vous rend responsable de ses primes — une facture plutôt qu'une poursuite. Le badge sur une carte est la pire des deux." },
          { table: {
            head: ["Badge", "Ce que ça veut dire"],
            rows: [
              ["En vigueur", "La date est consignée et à plus de 30 jours."],
              ["Bientôt échue", "La date tombe dans les 30 prochains jours. Le sous-traitant est listé dans le panneau des échéances."],
              ["Expirée", "La date est passée. Le sous-traitant est listé dans le panneau des échéances, en premier."],
              ["Non consignée", "Aucune date n'a été entrée. C'est un trou dans les papiers, pas un sous-traitant non assuré — ça ne compte jamais comme expiré et n'apparaît jamais dans le panneau."],
            ],
          } },
          { warning: "FieldQuo ne vous empêche pas de mettre un sous-traitant aux papiers expirés sur un chantier. La page du chantier affiche « Assurance ou attestation expirée » à côté de lui; décider s'il va sur le chantier vous appartient." },
        ],
      },
      {
        id: "on-a-job",
        heading: "Mettre un sous-traitant sur un chantier et le payer",
        blocks: [
          { p: "Les sous-traitants s'attachent depuis le chantier, pas depuis cet écran. La page du chantier a une section **Sous-traitants sur ce chantier** : « Entreprises engagées à prix fixe. Le montant convenu est ce que ce chantier coûte, peu importe ce que vous avez soumissionné au client; les paiements sont la façon de le régler. » Chaque ligne passe par **Soumissionné**, **Convenu**, **Terminé** et **Payé**." },
          { steps: [
            "Sur le chantier, appuyez sur **Ajouter un sous-traitant**, choisissez le sous-traitant, et au besoin la visite et ce qu'il fait.",
            "Entrez le **Montant convenu**, ou laissez-le vide tant que rien n'est convenu — « Aucun montant pour l'instant », c'est soumissionné, pas un coût.",
            "Quand vous l'avez payé, appuyez sur **Enregistrer un paiement** : montant, **Payé par** (Comptant, Virement Interac, Chèque), **Payé le** et une note. « Ceci inscrit le paiement et une dépense sur le chantier en une seule étape. C'est de l'argent déjà sorti — rien n'est envoyé. »",
            "La ligne affiche « 2 000,00 $ payé, 3 000,00 $ à venir », puis **Payé au complet**; un paiement de plus s'affiche comme trop-payé plutôt que d'être refusé.",
          ] },
        ],
      },
      {
        id: "who-can-see-it",
        heading: "Qui peut le voir",
        blocks: [
          { p: "Ouvrir la liste, ajouter un sous-traitant, en modifier un et déposer des documents exigent la permission de gestion d'équipe — propriétaires, administrateurs, Managers et Dispatchers. Le nom d'un sous-traitant et la validité de son assurance, c'est de l'exploitation : le répartiteur qui met l'électricien sur la visite de jeudi doit savoir que son attestation est échue. Crew et Estimator ne voient pas la ligne." },
          { p: "L'argent sur l'écran — montants convenus, paiements, totaux annuels, **Payé en** et le CSV — exige en plus l'interrupteur « Job costing ». Un Dispatcher ouvre la liste, voit l'assurance échue, et ne voit aucun chiffre; un Manager voit les deux. Voir [[the-custom-access-editor|L'éditeur d'accès personnalisé]]." },
        ],
      },
    ],
    faq: [
      { q: "Puis-je payer un sous-traitant par FieldQuo?", a: "Non. Enregistrer un paiement inscrit le paiement et une dépense sur le chantier; l'argent est passé par votre banque, un chèque ou un virement d'abord. La fonction de paiement dans l'application paie une personne de votre propre équipe pour des heures pointées, pas une entreprise pour une soumission." },
      { q: "Que se passe-t-il si je laisse une date d'expiration vide?", a: "Le sous-traitant affiche **Non consignée** pour cet élément et n'est jamais listé comme expiré. Vide veut dire que vous n'avez pas entré le certificat, pas qu'il n'est pas assuré." },
      { q: "Puis-je importer la soumission du sous-traitant lui-même?", a: "Oui, sur votre soumission — voir [[import-a-subcontractor-quote|Importer la soumission d'un sous-traitant]]. Quand la soumission devient un chantier, ce prix importé peut être adopté comme montant convenu dans la section Sous-traitants du chantier." },
    ],
  },

  "the-t5018-year-end-list": {
    title: "La liste de fin d'année T5018",
    summary:
      "Un CSV par année civile listant chaque sous-traitant, s'il figure sur le relevé des sous-traitants, ce que vous lui avez payé et combien de paiements — le chiffre que le comptable reconstituait à partir des talons de chèques.",
    updated: "2026-09-12",
    intro: [
      "Au Canada, un entrepreneur qui a payé plus de 500 $ dans l'année à un sous-traitant en construction produit un T5018 à son nom; aux États-Unis, c'est un 1099-NEC au-delà de 600 $. Les deux sont une liste d'entreprises et de montants. FieldQuo bâtit cette liste à partir des paiements que vous avez inscrits pour chaque sous-traitant sur chaque chantier, si bien que le chiffre sur la fiche du sous-traitant, le chiffre dans le fichier et le chiffre dans les [[job-costing|Coûts de chantier]] sont les mêmes lignes additionnées une seule fois.",
    ],
    sections: [
      {
        id: "overview",
        heading: "Vue d'ensemble",
        blocks: [
          { p: "La liste, c'est le bouton **Liste de fin d'année (CSV)** sur l'écran **Sous-traitants**, à côté du sélecteur d'année **Payé en**. Le même chiffre s'affiche sur la fiche de chaque sous-traitant comme « Payé en 2026 — le montant du relevé de fin d'année » avec le nombre de paiements, et sur la carte de la liste comme « 6 840,00 $ payé en 2026 (3 paiements) »." },
          { p: "Le seuil n'est volontairement pas appliqué. Chaque sous-traitant est listé, y compris ceux payés 0 $ et ceux marqués **Pas de relevé fiscal**, parce que c'est le comptable qui décide qui produit un relevé et FieldQuo ne sait pas quelle règle s'applique chez vous. Une rangée à zéro dit « on a vérifié, rien »; une rangée absente ne dit rien." },
        ],
      },
      {
        id: "download-the-list",
        heading: "Comment télécharger la liste",
        blocks: [
          { steps: [
            "Ouvrez **Sous-traitants** (sous Personnes).",
            "Choisissez l'année sous **Payé en** — le sélecteur change les totaux sur chaque carte.",
            "Appuyez sur **Liste de fin d'année (CSV)**. Le fichier se nomme subcontractors-2026.csv.",
            "Remettez-le à votre comptable. Le téléchargement est inscrit au [[the-activity-log|Journal d'activité]].",
          ] },
          { figure: "harness:subcontractors", caption: "Sous-traitants — le sélecteur d'année Payé en et le bouton Liste de fin d'année (CSV) au-dessus de la liste, chaque carte avec son total payé dans l'année." },
          { note: "Le fichier indique sa devise d'après le Profil de l'entreprise et se termine par « Recorded in FieldQuo; no form has been filed through this system. » FieldQuo produit la liste; il ne produit aucune déclaration." },
        ],
      },
      {
        id: "what-is-in-the-file",
        heading: "Ce qu'il y a dans le fichier",
        blocks: [
          { table: {
            head: ["Colonne", "Ce qu'elle contient"],
            rows: [
              ["Subcontractor", "Le nom de l'entreprise, en ordre alphabétique."],
              ["Trade", "Le métier sur sa fiche, ou vide."],
              ["Tax form", "yes ou no — la case **Figure sur le relevé de fin d'année des sous-traitants (T5018 / 1099-NEC)** de sa fiche."],
              ["Paid in year", "La somme des paiements datés dans cette année civile, au cent près."],
              ["Payments", "Combien de paiements composent ce total."],
              ["Active", "yes ou no — un sous-traitant inactif que vous avez payé plus tôt dans l'année est quand même listé."],
            ],
          } },
        ],
      },
      {
        id: "what-counts",
        heading: "Ce qui compte comme payé",
        blocks: [
          { bullets: [
            "Un paiement compte dans l'année de sa date **Payé le**, pas dans l'année du chantier ni du montant convenu.",
            "Seuls les paiements inscrits avec **Enregistrer un paiement** sur un chantier comptent. Un montant convenu qui n'a pas été payé n'est pas dans le total.",
            "Une rangée **TOTAL** au bas additionne chaque sous-traitant et chaque paiement de l'année.",
            "**Pas de relevé fiscal** sur un sous-traitant ne le retire pas du fichier — ça met sa colonne Tax form à no, pour que votre comptable voie la décision plutôt qu'une absence.",
          ] },
        ],
      },
      {
        id: "who-can-see-it",
        heading: "Qui peut le voir",
        blocks: [
          { p: "Le bouton, le sélecteur **Payé en** et chaque chiffre d'argent exigent à la fois la permission de gestion d'équipe et l'interrupteur « Job costing » — propriétaires, administrateurs, et un Manager avec les coûts de chantier activés. Un Dispatcher voit la liste et les badges d'assurance, mais ni totaux ni bouton. Une session d'assistance en lecture seule se voit refuser le fichier carrément." },
        ],
      },
    ],
    faq: [
      { q: "FieldQuo produit-il le T5018 ou le 1099-NEC?", a: "Non. Il produit la liste des entreprises et des montants; le formulaire est préparé et transmis par vous ou votre comptable." },
      { q: "Pourquoi un sous-traitant payé en décembre dernier est-il dans le fichier de cette année?", a: "Parce que la date Payé le du paiement tombe cette année. Modifiez la date sur le paiement si elle a été mal inscrite; le total suit la date." },
      { q: "Puis-je obtenir la liste d'une année antérieure?", a: "Oui — choisissez l'année sous Payé en et appuyez sur le bouton. Toute année avec des paiements inscrits fonctionne." },
    ],
  },

  "vehicles-and-fleet": {
    title: "Véhicules et flotte",
    summary:
      "Les camions : ce qui est dû, ce qui expire, qui a chacun — assurance, immatriculation et entretien par date ou par kilométrage, un journal d'entretien, des documents, et le coût d'exploitation pour qui peut le voir.",
    updated: "2026-09-12",
    intro: [
      "**Véhicules** répond aux trois questions qu'une entreprise avec trois camions se pose vraiment : qu'est-ce qui est dû, qu'est-ce qui expire, et qui a le camion. Ce n'est volontairement pas un produit de télématique — pas de GPS en direct, pas d'historique de trajets. Un navigateur ne peut pas suivre un camion en arrière-plan, alors une carte « où est le camion » ne serait juste que tant que quelqu'un a l'onglet ouvert.",
      "Chaque véhicule ici est aussi un actif du registre dans **Paramètres → Frais généraux** — c'est la ligne qui porte ce qu'il a coûté et comment il s'amortit, ce qui fait monter votre prix minimum. Cet écran ajoute les faits de flotte à cette ligne sans toucher à la comptabilité. Voir [[overhead-and-your-minimum-price|Frais généraux et votre prix minimum]].",
    ],
    sections: [
      {
        id: "overview",
        heading: "Vue d'ensemble",
        blocks: [
          { p: "L'écran est coiffé de **Véhicules** — « Ce qui est dû, ce qui expire, et qui a le camion. Ce que chacun a coûté se trouve dans le registre des actifs. » Un panneau **Échu ou à venir** vient d'abord, parce qu'une attestation d'assurance échue, c'est un camion qui ne devrait pas être sur la route, puis une carte par véhicule." },
          { note: "Seulement dans FieldQuo : ni Jobber, ni Housecall Pro, ni ServiceTitan, ni Projul n'affichent d'échéances de véhicules, de journal d'entretien ou de coût au kilomètre sur leur page de tarifs, à aucun palier. La preuve, c'est l'écran lui-même — app/app/fleet — et il est dans chaque forfait." },
        ],
      },
      {
        id: "on-the-screen",
        heading: "Ce qu'il y a à l'écran",
        blocks: [
          { bullets: [
            "**Échu ou à venir** — chaque véhicule avec quelque chose de **Bientôt échue** ou d'échu, en nommant quoi : Assurance, Immatriculation, Entretien (par date), Entretien (par kilométrage).",
            "**Une carte par camion** — « Ford Transit 250 — 2022 », sa plaque, un badge (**Quelque chose est échu**, **Quelque chose s'en vient**, **Rien à venir**, **Rien de consigné**) et « avec Léo Bouchard ».",
            "**La carte dépliée** — les quatre échéances, **Odomètre (km)**, **NIV**, **Coût** et **Valeur comptable actuelle** pour qui peut les voir, **Modifier**, puis **Entretien**, **Documents**, **Dépenses** et **Coûts d'exploitation**.",
            "**Ajouter** — rattache les détails de flotte à un véhicule déjà dans le registre des actifs. Sans rien au registre, l'écran le dit et propose **Ajouter un véhicule au registre**.",
          ] },
        ],
      },
      {
        id: "add-a-vehicle",
        heading: "Comment ajouter un véhicule",
        blocks: [
          { steps: [
            "Mettez d'abord le camion au registre des actifs — **Paramètres → Frais généraux**, sous Actifs et amortissement — avec ce qu'il a coûté. Un propriétaire ou un administrateur s'en charge.",
            "Ouvrez **Véhicules** (sous Argent) et appuyez sur **Ajouter**.",
            "Sous **Quel véhicule**, choisissez l'actif.",
            "Remplissez **Plaque**, **Marque et modèle**, **NIV**, **Année**, et l'**Odomètre (km)** — « Laissez vide si vous ne le savez pas ».",
            "Choisissez **Qui l'a** (ou « Personne en particulier »), puis les dates : **Assurance expire le**, **Immatriculation expire le**, **Prochain entretien (date)** et **Prochain entretien (km)**.",
            "Appuyez sur **Enregistrer**. La carte apparaît avec son badge calculé d'après ce que vous avez entré.",
          ] },
          { figure: "harness:fleet", caption: "Véhicules — le panneau Échu ou à venir nommant l'assurance et l'entretien d'un camion, puis une carte par camion avec son badge et qui l'a." },
          { note: "Un entretien prévu à un kilométrage ne décompte que lorsque l'odomètre est rempli; sans lecture, il affiche **Pas assez d'information consignée** plutôt qu'une supposition. Une date vide, c'est **Aucune date consignée** — jamais traitée comme échue." },
        ],
      },
      {
        id: "what-each-field-changes",
        heading: "Ce que chaque champ change",
        blocks: [
          { table: {
            head: ["Champ", "Ce qu'il change"],
            rows: [
              ["Odomètre (km)", "La lecture à partir de laquelle Entretien (par kilométrage) décompte, et l'une des deux lectures qu'un coût au km exige. Consigner des travaux avec un odomètre le déplace : « L'odomètre du véhicule a été mis à jour selon cette entrée. »"],
              ["Qui l'a", "Le nom sur la carte. Un membre désactivé s'affiche « n'est plus actif » jusqu'à ce que vous le changiez."],
              ["Assurance expire le / Immatriculation expire le", "Des échéances datées. D'ici 30 jours : **Bientôt échue** et listée dans le panneau; passée : échue et listée en premier. Déposer un document Police d'assurance ou Immatriculation avec une date d'expiration déplace la date correspondante ici."],
              ["Prochain entretien (date)", "La même fenêtre de 30 jours, pour le garage."],
              ["Prochain entretien (km)", "**Bientôt échue** à moins de 500 km de la lecture d'odomètre; échu une fois dépassé."],
              ["Coût / Valeur comptable actuelle", "Lus dans le registre des actifs — le prix d'achat et ce que l'amortissement a laissé. Pas modifiables ici."],
              ["Retirer la fiche de véhicule", "Retire la plaque, les dates et le journal. « L'actif lui-même, et son amortissement, restent exactement tels quels. »"],
            ],
          } },
        ],
      },
      {
        id: "maintenance-and-documents",
        heading: "Entretien, documents et coûts d'exploitation",
        blocks: [
          { bullets: [
            "**Entretien** — **Consigner des travaux** : le type (Entretien, Réparation, Pneus, Inspection, Autre), **Ce qui a été fait**, l'odomètre à ce moment, et ce que ça a coûté — « laissez vide si inconnu ». Supprimer une entrée garde la lecture d'odomètre qu'elle a établie : « le véhicule a bel et bien fait ces kilomètres ».",
            "**Documents** — **Ajouter un document** : Immatriculation, Police d'assurance, Contrat de vente, Photo ou Autre, avec une expiration facultative. Un contrat de vente, c'est de l'argent, masqué à quiconque ne peut pas voir le coût : « 2 de plus masqués par votre niveau d'accès ».",
            "**Dépenses** — l'essence, les péages et les réparations inscrits dans **Paramètres → Suivi des dépenses** avec ce véhicule choisi, et le total du mois.",
            "**Coûts d'exploitation** — dépenses et entretien des 12 derniers mois, amortissement, **Coût total de possession, 12 derniers mois** et **Coût par km**, qui exige deux lectures d'odomètre espacées d'au moins 30 jours et le dit quand il ne peut pas être calculé.",
          ] },
        ],
      },
      {
        id: "who-can-see-it",
        heading: "Qui peut le voir",
        blocks: [
          { p: "L'écran exige la permission de gestion d'équipe — propriétaires, administrateurs, Managers et Dispatchers. Une plaque, un odomètre et un renouvellement d'assurance, c'est de l'exploitation : le répartiteur qui décide quel camion va où doit savoir qu'un d'eux est hors route jeudi. Crew et Estimator ne voient pas la ligne." },
          { p: "Ce que le camion a coûté — **Coût**, **Valeur comptable actuelle**, l'amortissement, le coût au km et le contrat de vente — c'est la base de coût de l'entreprise et ça exige en plus l'interrupteur « Job costing », la même barrière que le registre des actifs. Un Dispatcher voit les échéances et pas le prêt du camion." },
        ],
      },
    ],
    faq: [
      { q: "FieldQuo suit-il où est le camion?", a: "Non. Il n'y a ni GPS ni historique de trajets. L'écran consigne qui l'a, quand ses papiers expirent et ce qu'il coûte à faire rouler." },
      { q: "Quelqu'un a supprimé l'actif — le camion est-il perdu?", a: "La fiche de flotte reste, marquée d'un avertissement disant que l'actif derrière elle a été supprimé. Ses dates restent réelles; gardez-les, ou retirez la fiche une fois le camion parti." },
      { q: "Pourquoi Coût par km est-il vide?", a: "Il exige deux lectures d'odomètre espacées d'au moins 30 jours — la lecture actuelle du camion et une consignée avec une entrée d'entretien — et la fiche d'actif. La carte dit ce qui manque." },
    ],
  },

  "purchasing-orders-stock-and-suppliers": {
    title: "Achats : commandes, stock et fournisseurs",
    summary:
      "Chez qui vous achetez, ce qui est commandé et ce qu'il reste sur la tablette — des bons de commande réceptionnés ligne par ligne, un niveau de stock additionné à partir des mouvements, et une alerte de réapprovisionnement pour les matériaux avec un seuil.",
    updated: "2026-09-12",
    intro: [
      "**Achats**, ce sont trois vues d'un même mouvement de marchandises : vous passez une commande à un fournisseur, vous la réceptionnez, et la livraison est ce qui change la tablette. L'écran est coiffé de « Chez qui vous achetez, ce qui est commandé, et ce qu'il reste sur la tablette. » avec trois onglets — **Commandes**, **Stock**, **Fournisseurs**.",
      "Il est fait pour être utilisé debout au hayon. Tout s'empile sur un téléphone, et une livraison s'inscrit comme ce qui est réellement arrivé — « 12 sur 40 » — parce qu'une moitié de commande le mardi et le reste le jeudi, c'est la semaine ordinaire au comptoir.",
    ],
    sections: [
      {
        id: "overview",
        heading: "Vue d'ensemble",
        blocks: [
          { p: "Un bon de commande est numéroté par entreprise — PO-001, PO-002 — avec un fournisseur, des lignes de ce que vous commandez avec une quantité et un prix unitaire, et un total prévu calculé côté serveur. Son état découle de ce qui est arrivé, jamais réglé à la main; les deux choses que vous réglez à la main, c'est qu'elle a été envoyée et qu'elle a été annulée. Le stock est un registre de mouvements, jamais un compte enregistré, alors une correction après un inventaire est un mouvement aussi, et le compte qui était faux reste au dossier." },
          { note: "Seulement dans FieldQuo parmi les outils de services sur le terrain : ni Jobber ni Housecall Pro n'affichent de bons de commande ni de stock sur leur page de tarifs, à aucun palier. Le palier supérieur de ServiceTitan est rapporté comme ajoutant « advanced inventory », et le palier Pro de Projul affiche les bons de commande. FieldQuo inclut les achats dans chaque forfait." },
        ],
      },
      {
        id: "on-the-screen",
        heading: "Ce qu'il y a à l'écran",
        blocks: [
          { bullets: [
            "**Commandes** — **Bons de commande** avec **Nouvelle commande**; une rangée par commande : « PO-014 · Bois Laurentides », « 0 lignes sur 2 complètes », un état (Brouillon, Envoyée, Partiellement livrée, Tout reçu, Annulée) et le total prévu ou **non chiffré**. Une commande ouverte offre **Marquer comme envoyée**, **Enregistrer ce qui est arrivé** et **Annuler la commande**.",
            "**Stock** — **Sur la tablette** : une rangée par matériau avec son niveau et « Réapprovisionner à 10 » ou « Aucun seuil défini »; **Sous le seuil de réapprovisionnement** listant ce qui manque; et **Enregistrer un mouvement**.",
            "**Fournisseurs** — **Ajouter un fournisseur** (nom, votre numéro de compte chez lui, la personne avec qui vous faites affaire, téléphone) et la liste, chacun avec **Retirer** ou **Remettre**.",
          ] },
        ],
      },
      {
        id: "raise-an-order",
        heading: "Comment créer une commande et la réceptionner",
        blocks: [
          { steps: [
            "Ouvrez **Achats** (sous Argent) et, dans **Fournisseurs**, ajoutez le marchand une fois s'il n'y est pas encore.",
            "Dans **Commandes**, appuyez sur **Nouvelle commande**, choisissez le fournisseur, et ajoutez une ligne par article : ce que vous commandez, **Qté**, l'unité, et le prix à l'**Unité**. Laissez un prix vide si vous ne le connaissez pas — la commande s'affiche comme **non chiffré** plutôt que comme gratuite.",
            "Appuyez sur **Créer la commande**. Elle est numérotée et enregistrée en Brouillon.",
            "Quand vous l'avez passée au fournisseur, appuyez sur **Marquer comme envoyée**. Ça inscrit la date; FieldQuo n'envoie pas la commande au fournisseur par courriel.",
            "Quand la marchandise arrive, appuyez sur **Enregistrer ce qui est arrivé** et entrez, par ligne, combien est venu. L'état devient **Partiellement livrée** ou **Tout reçu** d'après les quantités.",
            "S'il arrive plus que commandé, c'est accepté et signalé : « Il est arrivé plus que commandé : … C'est entré en stock — à vous de décider si c'est payé. »",
          ] },
          { figure: "harness:purchasing", caption: "Achats → Commandes — deux bons de commande, un Envoyée dont aucune ligne n'est encore arrivée et un Tout reçu, avec leurs totaux prévus." },
          { warning: "Une ligne de commande tapée sur cet écran est du texte libre. Elle n'est pas liée à un matériau, alors enregistrer sa livraison met à jour la commande — pas la tablette. Pour changer un niveau de stock, enregistrez un mouvement **Reçu** dans l'onglet **Stock** pour le matériau." },
        ],
      },
      {
        id: "order-statuses",
        heading: "États d'une commande",
        blocks: [
          { table: {
            head: ["État", "Ce que ça veut dire"],
            rows: [
              ["Brouillon", "Créée, pas encore passée. Peut être marquée envoyée ou annulée."],
              ["Envoyée", "Vous avez appuyé sur Marquer comme envoyée; la date est inscrite et le Journal d'activité affiche « PO-014: The order has gone to the supplier. » En attente de livraison."],
              ["Partiellement livrée", "Au moins une ligne a quelque chose d'arrivé et au moins une est incomplète. Découle des quantités, jamais réglé à la main."],
              ["Tout reçu", "Chaque ligne a reçu au moins ce qui était commandé."],
              ["Annulée", "Vous avez appuyé sur Annuler la commande; le Journal d'activité affiche « The order will not be filled. » Une commande annulée ne peut être ni envoyée ni réceptionnée."],
            ],
          } },
        ],
      },
      {
        id: "stock",
        heading: "Stock",
        blocks: [
          { p: "L'onglet **Stock** liste les matériaux de l'entreprise avec un niveau additionné à partir de chaque mouvement inscrit à leur nom. Les matériaux naissent quand une ligne d'approvisionnement d'un chantier est achetée — voir [[materials-on-a-job|Matériaux sur un chantier]] — et il n'y a ici aucun écran pour en créer un ou régler son seuil de réapprovisionnement; un matériau sans seuil affiche **Aucun seuil défini**, et la liste des stocks bas dit combien elle ne peut pas juger." },
          { bullets: [
            "**Reçu** — marchandise entrée; le niveau monte.",
            "**Retourné en stock** — rapporté d'un chantier; monte.",
            "**Utilisé sur un chantier** — descend.",
            "**Perte** — descend.",
            "**Correction après comptage** — « Une correction peut être négative — mettez un signe moins si le compte est en dessous. Rien n'est modifié ni supprimé : la correction s'ajoute au registre. »",
          ] },
          { note: "**Sous le seuil de réapprovisionnement** ne liste que les matériaux qui ont un seuil et sont en dessous. Un matériau sans seuil n'est jamais dit bas, parce que l'absence de seuil n'est pas une affirmation sur la tablette." },
        ],
      },
      {
        id: "suppliers",
        heading: "Fournisseurs",
        blocks: [
          { p: "Un fournisseur, c'est un nom, votre numéro de compte chez lui, la personne avec qui vous faites affaire et un téléphone. Il n'y a pas de suppression — **Retirer** sort le marchand du sélecteur de commande et garde chaque commande et paiement à son nom, et **Remettre** le ramène. La liste des fournisseurs est ce qui transforme « chez qui on a acheté ça » en « combien on a dépensé là cette année »." },
        ],
      },
      {
        id: "who-can-see-it",
        heading: "Qui peut le voir",
        blocks: [
          { p: "Les achats font partie du domaine « Expenses » de la grille d'accès : la ligne et chaque onglet exigent « View, record, and edit everyone's », parce qu'un bon de commande ou un niveau de stock n'a pas de « mes propres ». Les propriétaires, les administrateurs et le préréglage Manager le détiennent; Dispatcher, Estimator et Crew commencent à leurs propres dépenses seulement et voient « Les achats font partie de la permission « dépenses ». Demandez à un propriétaire ou un admin l'accès aux dépenses de tout le monde. »" },
        ],
      },
    ],
    faq: [
      { q: "Marquer comme envoyée envoie-t-il la commande au fournisseur?", a: "Non. Ça inscrit que vous l'avez passée et horodate la date. Envoyez la commande comme vous le faites déjà — le comptoir du fournisseur, le téléphone, ou son portail." },
      { q: "Pourquoi ma livraison n'a-t-elle pas changé l'onglet Stock?", a: "Les lignes de commande créées sur cet écran sont du texte libre sans matériau derrière, alors leur livraison ne met à jour que la commande. Enregistrez un mouvement Reçu dans l'onglet Stock pour le matériau." },
      { q: "Puis-je modifier un niveau de stock après un comptage?", a: "Enregistrez une **Correction après comptage** pour la différence, négative si le compte est court. Le registre garde le compte faux et la correction, ce qui est la seule trace que quelque chose a déjà cloché." },
    ],
  },

  "the-activity-log": {
    title: "Le Journal d'activité",
    summary:
      "La piste de vérification de l'entreprise — qui a envoyé, modifié, approuvé, payé ou changé quoi, avec son nom, son niveau d'accès et le moment — en lecture seule, du plus récent au plus ancien, propriétaires et administrateurs seulement.",
    updated: "2026-09-12",
    intro: [
      "Le **Journal d'activité**, c'est la réponse à « qui a changé ça? ». Chaque route qui change quelque chose qu'une entreprise voudrait retracer y écrit une ligne une fois le changement enregistré — une soumission envoyée, un paiement inscrit, des heures approuvées, un membre invité ou désactivé, un taux de paie changé, une année de congés reportée — avec le nom de la personne, son niveau d'accès et l'heure. C'est un registre à consulter quand quelque chose cloche, pas un tableau de bord.",
    ],
    sections: [
      {
        id: "overview",
        heading: "Vue d'ensemble",
        blocks: [
          { p: "L'écran est coiffé de **Journal d'activité** — « Un registre des actions importantes de votre compte — soumissions envoyées, paiements enregistrés, heures ajoutées et approuvées, dépenses, changements de clients et d'équipe, tarifs et réglages. » Une seule liste, du plus récent au plus ancien, montrant les 100 dernières entrées. Il n'y a ni filtre, ni recherche, ni exportation sur cet écran aujourd'hui, et rien ne peut y être modifié ni supprimé." },
          { p: "La phrase d'une ligne a été écrite au moment où l'action s'est produite et est conservée telle quelle. Les lignes plus anciennes restent dans l'anglais où elles ont été inscrites; les lignes écrites depuis que le journal porte une clé de traduction se lisent dans votre langue. Un journal qui changerait rétroactivement ne serait pas un journal." },
        ],
      },
      {
        id: "on-the-screen",
        heading: "Ce qu'il y a à l'écran",
        blocks: [
          { bullets: [
            "**Un point de couleur** par ligne — rouge pour une suppression ou une désactivation, ambre pour un changement de réglage ou quelqu'un qui approuve ses propres heures, vert pour un paiement, bleu pour un envoi, gris pour tout le reste.",
            "**La phrase** — « Sent invoice INV-2071 to sophie.dubois@example.com », « Invited Ana Pereira as Crew », « Updated cabinet pricing », « Recorded the pay run for … as paid outside FieldQuo ».",
            "**Qui, son niveau, et quand** — « Julie Gagnon · supervisor · il y a 4 h », en relatif pendant 30 jours puis une date. Une action faite par l'assistance FieldQuo pendant une session en lecture seule est marquée **session d'assistance** — ce qui ne devrait jamais arriver, et c'est ici que ça se verrait.",
          ] },
        ],
      },
      {
        id: "read-the-log",
        heading: "Comment lire le journal",
        blocks: [
          { steps: [
            "Ouvrez **Paramètres → Journal d'activité** (sous Entreprise).",
            "Balayez les points selon ce que vous cherchez : rouge pour « qui a retiré ça », vert pour « qui a inscrit ce paiement », ambre pour « qui a changé ce réglage ».",
            "Lisez le nom et le niveau de la ligne. Le nom a été conservé au moment même, alors un employé renommé ou parti apparaît toujours tel qu'il était.",
          ] },
          { figure: "harness:settings-activity", caption: "Paramètres → Journal d'activité — une ligne par action avec son point, la phrase, et qui l'a faite, son niveau et il y a combien de temps." },
          { tip: "Pour une seule soumission, un seul chantier ou une seule facture, la page de la fiche elle-même est plus rapide que de balayer tout le journal; le journal sert à la question « qu'est-ce qui s'est passé dans ce compte » et à retracer un changement que personne n'avoue." },
        ],
      },
      {
        id: "what-gets-logged",
        heading: "Ce qui est consigné",
        blocks: [
          { bullets: [
            "**Soumissions, factures et chantiers** — créés, envoyés, relancés, acceptés, marqués payés, planifiés.",
            "**Argent** — paiements inscrits, dépenses, un paiement à un sous-traitant, une paie enregistrée, approuvée, enregistrée comme payée ou annulée, une composante de paie ajoutée ou retirée, la liste de fin d'année téléchargée.",
            "**Heures** — entrées de temps ajoutées, modifiées et approuvées, y compris une personne qui approuve les siennes.",
            "**Équipe** — invitations, un niveau d'accès changé, un membre désactivé, des heures de travail ou des politiques de congés changées, une année de congés reportée.",
            "**Clients** — un client ajouté ou ses coordonnées modifiées.",
            "**Réglages** — tarifs, image de marque, le cycle de paie, des fournisseurs retirés, et le reste des écrans de paramètres.",
          ] },
        ],
      },
      {
        id: "who-can-see-it",
        heading: "Qui peut le voir",
        blocks: [
          { p: "Propriétaires et administrateurs seulement. La ligne est masquée pour tous les autres niveaux et le serveur répond « Only an owner or admin can view the activity log. » à quiconque d'autre — le journal nomme des actions sur chaque utilisateur, y compris les paiements, les changements de taux de paie et qui a désactivé qui, ce qu'un Manager n'a pas à lire." },
          { note: "La consignation ne fait jamais échouer ni annuler l'action qu'elle décrit. Si l'écriture au journal elle-même a échoué, l'action a quand même eu lieu et la ligne manque — un compromis délibéré, pour que la soumission d'un client ne soit jamais perdue parce qu'une ligne de vérification n'a pas pu être écrite." },
        ],
      },
    ],
    faq: [
      { q: "Puis-je exporter le journal ou y chercher?", a: "Pas sur cet écran aujourd'hui. Il montre les 100 dernières entrées, du plus récent au plus ancien. Pour un historique plus long, demandez à l'assistance." },
      { q: "Pourquoi une ligne est-elle en anglais sur mon compte en français?", a: "Elle a été écrite avant que le journal porte des clés de traduction, et les phrases conservées ne sont jamais réécrites. Les lignes écrites depuis se lisent dans votre langue." },
      { q: "Une ligne peut-elle être supprimée?", a: "Non. Rien dans le journal ne peut être modifié ni retiré, ni par vous ni par l'assistance FieldQuo — c'est tout l'intérêt." },
    ],
  },
};
