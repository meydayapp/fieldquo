// app/i18n/industries/fr.js — see en.js for structure and rationale.

const fr = {
  chrome: {
    startTrial: "Essai gratuit",
    talkToUs: "Parlez-nous",
    noCard: "Votre premier mois est gratuit — votre carte n'est débitée qu'à la fin.",
    videoSoon: "Démonstration du produit à venir",
    videoDemoPrefix: "Vous préférez une démo en direct?",
    videoDemoLink: "Réserver une démo",
    soundFamiliar: "Ça vous dit quelque chose?",
    painIntro:
      "Voici ce qui coûte discrètement de l'argent aux entreprises de {trade}. Et ce que FieldQuo fait pour chacun de ces problèmes.",
    ctaTitle: "Essayez-le sur votre prochain chantier de {trade}",
    ctaBody:
      "Configurez vos prix, envoyez une soumission, et voyez si ça vous sauve la soirée. C'est tout le test.",
    nearby: "Aussi offert pour les métiers connexes",
  },

  trades: {
    cleaning: {
      label: "Entretien ménager",
      headline:
        "Un logiciel d'entretien ménager qui garde le travail récurrent sur les rails",
      description:
        "L'entretien résidentiel et commercial repose sur des visites répétées, des équipes qui tournent et des marges serrées. FieldQuo réunit l'horaire, la liste de vérification et la facture au même endroit.",
      pains: [
        {
          pain: "Les clients récurrents sont replanifiés à la main chaque semaine",
          fix: "Définissez la fréquence une fois et l'horaire se répète, avec la bonne équipe assignée à chaque visite.",
        },
        {
          pain: "Des étapes sont sautées et le client s'en aperçoit avant vous",
          fix: "Des listes de vérification par chantier que l'équipe coche sur son téléphone, pour un standard identique peu importe qui se présente.",
        },
        {
          pain: "Les petites factures restent impayées parce que les relancer ne vaut pas le temps",
          fix: "Relances automatiques sur les factures en retard, et le client paie en ligne depuis le courriel.",
        },
        {
          pain: "Vous ne savez pas quels contrats sont réellement rentables",
          fix: "Le temps est suivi par chantier et comparé à ce que vous avez facturé, pour repérer tôt les contrats déficitaires.",
        },
      ],
    },

    "construction-contracting": {
      label: "Construction et entrepreneuriat",
      headline:
        "Un logiciel de construction qui protège votre marge sur chaque soumission",
      description:
        "Dérive des travaux, sous-traitants et prix des matériaux qui bougent entre la soumission et le début du chantier. FieldQuo relie soumissions, horaires et coûts réels pour que vous sachiez où en est un projet.",
      pains: [
        {
          pain: "Une soumission prend toute une soirée et il manque encore des choses",
          fix: "Bâtissez à partir de votre propre catalogue tarifé avec des groupes de travaux réutilisables : une soumission devient un assemblage.",
        },
        {
          pain: "Le prix des matériaux change entre la soumission et le début des travaux",
          fix: "Suivi des coûts de matériaux avec historique, pour soumissionner selon les prix actuels et non ceux de la saison passée.",
        },
        {
          pain: "Les avenants sont convenus verbalement puis oubliés à la facturation",
          fix: "Révisez la soumission, faites-la réapprouver en ligne, et la facture reflète le changement automatiquement.",
        },
        {
          pain: "Vous découvrez qu'un projet a perdu de l'argent une fois terminé",
          fix: "Main-d'œuvre, matériaux et dépenses suivis pendant le chantier, pas reconstitués après coup.",
        },
      ],
    },

    electrical: {
      label: "Électricité",
      headline:
        "Un logiciel d'électricien conçu autour des appels de service",
      description:
        "Entre les appels de service, les mises à niveau de panneaux et les inspections, l'administratif s'accumule vite. FieldQuo s'occupe de la paperasse pour que vos heures qualifiées soient facturables.",
      pains: [
        {
          pain: "Les urgences font dérailler une journée planifiée",
          fix: "Déplacez le travail vers une autre plage : les clients et l'équipe concernés sont avisés automatiquement.",
        },
        {
          pain: "Soumissionner une mise à niveau de panneau veut dire refaire les mêmes lignes",
          fix: "Catalogue de services enregistré avec vos propres taux — choisissez, ajustez, envoyez.",
        },
        {
          pain: "Les photos et notes d'inspection restent sur le téléphone de quelqu'un",
          fix: "Photos et notes rattachées au dossier du chantier, donc retrouvables quand un client ou un inspecteur les demande des mois plus tard.",
        },
        {
          pain: "Les heures d'apprenti sont estimées au moment de la paie",
          fix: "Feuilles de temps rattachées à de vrais chantiers, approuvées par un superviseur, versées directement à la paie.",
        },
      ],
    },

    hvac: {
      label: "CVAC",
      headline:
        "Un logiciel CVAC pour les pointes saisonnières et les contrats d'entretien",
      description:
        "Votre année, c'est deux ruées et deux périodes creuses. FieldQuo vous aide à absorber la pointe sans échapper personne, et à garder les revenus d'entretien pendant les mois tranquilles.",
      pains: [
        {
          pain: "La première canicule génère plus d'appels que vous ne pouvez planifier",
          fix: "Une page de réservation affichant vos vraies disponibilités : les clients choisissent eux-mêmes au lieu d'attendre au téléphone.",
        },
        {
          pain: "Les ententes d'entretien sont oubliées jusqu'à ce que le client appelle",
          fix: "Visites récurrentes planifiées à l'avance avec rappels automatiques : le travail sous contrat se réserve tout seul.",
        },
        {
          pain: "Les techniciens arrivent sans savoir quel équipement est sur place",
          fix: "Historique complet du client et du chantier sur leur téléphone, incluant ce qui a été fait la dernière fois.",
        },
        {
          pain: "Les soumissions d'installation sont perdues au profit du plus rapide",
          fix: "Préparez et envoyez la soumission depuis l'entrée de cour; le client approuve en ligne sans attendre votre retour au bureau.",
        },
      ],
    },

    handyman: {
      label: "Homme à tout faire",
      headline:
        "Un logiciel pour des travaux qui ne se ressemblent jamais",
      description:
        "Beaucoup de petits chantiers, une grande variété, et une tarification qui doit être rapide sans être négligée. FieldQuo garde l'administratif proportionnel à la taille du travail.",
      pains: [
        {
          pain: "Chaque travail est différent, donc rien n'est réutilisable",
          fix: "Un catalogue de vos tâches courantes et de vos taux, à assembler peu importe la combinaison.",
        },
        {
          pain: "Les petits travaux ne semblent pas mériter une soumission formelle, puis sont contestés",
          fix: "Envoyez une soumission depuis votre téléphone en moins d'une minute — le client approuve par écrit, et c'est consigné.",
        },
        {
          pain: "Une demi-journée disparaît en appels de planification",
          fix: "Les clients réservent eux-mêmes dans les plages que vous avez réellement libres.",
        },
        {
          pain: "Les paiements comptant et par virement ne sont jamais bien consignés",
          fix: "Enregistrez n'importe quel mode de paiement sur la facture, pour que les livres reflètent la réalité.",
        },
      ],
    },

    landscaping: {
      label: "Aménagement paysager",
      headline:
        "Un logiciel d'aménagement paysager pour les projets conception-construction et les équipes saisonnières",
      description:
        "Projets conception-construction, personnel saisonnier et météo qui réécrit la semaine. FieldQuo garde soumissions, équipes et coûts ensemble quand le plan bouge sans arrêt.",
      pains: [
        {
          pain: "La pluie réécrit la semaine et il faut prévenir tout le monde",
          fix: "Déplacez les chantiers au calendrier : clients et équipes concernés sont avisés automatiquement.",
        },
        {
          pain: "Les soumissions conception-construction sont longues et prennent des jours",
          fix: "Regroupez les travaux en sections avec photos : une grosse soumission se lit clairement et se bâtit vite.",
        },
        {
          pain: "Les embauches saisonnières rendent le coût de main-d'œuvre difficile à cerner",
          fix: "Temps suivi par chantier et par employé, pour connaître le vrai coût de main-d'œuvre d'un projet.",
        },
        {
          pain: "Les végétaux et matériaux grugent la marge sans qu'on le voie",
          fix: "Suivez les coûts de matériaux avec historique et comparez-les à ce que vous aviez soumissionné.",
        },
      ],
    },

    "lawn-care": {
      label: "Entretien de pelouse",
      headline:
        "Un logiciel d'entretien de pelouse pensé pour la densité de tournée",
      description:
        "Gros volume, petits montants, et une rentabilité qui dépend entièrement de la compacité de votre tournée. FieldQuo fait rouler les visites récurrentes et la facturation avec un minimum d'administratif par arrêt.",
      pains: [
        {
          pain: "Replanifier les mêmes clients hebdomadaires est un travail en soi",
          fix: "Définissez la fréquence une fois — les visites se génèrent seules avec la bonne équipe.",
        },
        {
          pain: "Facturer des dizaines de petits comptes gruge une soirée",
          fix: "Générez les factures des visites complétées en lot, avec liens de paiement en ligne.",
        },
        {
          pain: "Une visite annulée ou reportée par la pluie est facturée quand même",
          fix: "Marquez les visites complétées ou sautées sur le terrain, et la facturation suit ce qui s'est réellement passé.",
        },
        {
          pain: "Impossible de savoir quelles tournées valent la peine",
          fix: "Revenus et temps par chantier, pour voir quels comptes justifient le déplacement.",
        },
      ],
    },

    painting: {
      label: "Peinture",
      headline:
        "Un logiciel de peinture pour des soumissions que les clients approuvent",
      description:
        "La peinture se gagne sur la soumission — clarté, photos, et arriver avant les deux autres soumissionnaires. FieldQuo vous aide à envoyer une soumission professionnelle le jour même.",
      pains: [
        {
          pain: "Vous êtes la troisième soumission et la plus lente à arriver",
          fix: "Bâtissez la soumission sur place à partir de vos propres taux et envoyez-la avant de quitter l'entrée.",
        },
        {
          pain: "Les clients ne comprennent pas ce qui est inclus et négocient",
          fix: "Travaux détaillés avec photos et inclusions claires : la discussion porte sur le travail plutôt que sur le chiffre.",
        },
        {
          pain: "Les choix de couleur et de préparation sont convenus verbalement puis contestés",
          fix: "C'est dans la soumission approuvée, horodatée, avec l'approbation en ligne du client.",
        },
        {
          pain: "La peinture et les matériaux coûtent plus cher que prévu",
          fix: "Suivi des coûts de matériaux avec historique, pour garder vos hypothèses de soumission à jour.",
        },
      ],
    },

    plumbing: {
      label: "Plomberie",
      headline:
        "Un logiciel de plomberie pour les urgences et le travail planifié",
      description:
        "Les urgences ne respectent pas l'horaire, et l'administratif doit quand même se faire. FieldQuo fait avancer la répartition, l'historique et la facturation sans bureau administratif.",
      pains: [
        {
          pain: "Une urgence fait exploser une journée déjà remplie",
          fix: "Replanifiez les chantiers touchés en quelques touches; clients et équipes sont avisés sans que vous appeliez.",
        },
        {
          pain: "Vous facturez à 22 h parce que la journée était pleine",
          fix: "Transformez le chantier terminé en facture sur place, avec un lien de paiement utilisable immédiatement.",
        },
        {
          pain: "Personne ne se souvient de ce qui a été fait ici la dernière fois",
          fix: "Historique complet par client, photos et notes incluses, sur le téléphone du technicien.",
        },
        {
          pain: "Les retours de garantie sont faits gratuitement parce que rien n'a été consigné",
          fix: "Chaque visite est un enregistrement — ce qui a été remplacé, quand, et à quelles conditions.",
        },
      ],
    },

    "pressure-washing": {
      label: "Lavage à pression",
      headline:
        "Un logiciel de lavage à pression pour soumissionner et livrer vite",
      description:
        "Chantiers courts, gros volume, et des soumissions souvent faites à partir d'une photo. FieldQuo garde l'administratif assez léger pour valoir la peine sur un travail de deux heures.",
      pains: [
        {
          pain: "Soumissionner à partir de photos, c'est deviner et espérer",
          fix: "Tarification à la superficie depuis votre propre catalogue, pour des estimations constantes d'un chantier à l'autre.",
        },
        {
          pain: "Les petits chantiers rendent la paperasse disproportionnée",
          fix: "Soumission, planification et facturation depuis votre téléphone, en quelques minutes chacune.",
        },
        {
          pain: "Traverser la ville pour des chantiers éparpillés ruine la journée",
          fix: "Voyez les chantiers de la journée ensemble pour les regrouper intelligemment.",
        },
        {
          pain: "Les photos avant-après restent dans la pellicule du téléphone",
          fix: "Les photos sont rattachées au chantier — utiles en cas de litige et pour le marketing plus tard.",
        },
      ],
    },

    roofing: {
      label: "Toiture",
      headline:
        "Un logiciel de toiture pour les grosses soumissions et la coordination des équipes",
      description:
        "Chantiers de forte valeur, dépendance à la météo, et des clients à convaincre avant de signer. FieldQuo vous aide à soumissionner clairement et à coordonner les équipes une fois le contrat obtenu.",
      pains: [
        {
          pain: "Une soumission à cinq chiffres reçoit un courriel d'une ligne et aucune réponse",
          fix: "Soumissions détaillées avec travaux, photos et options que le client approuve en ligne — et relance automatique s'il devient silencieux.",
        },
        {
          pain: "La météo déplace l'horaire et l'équipe l'apprend tard",
          fix: "Replanifiez une fois; les avis à l'équipe et au client partent automatiquement.",
        },
        {
          pain: "Les acomptes et paiements progressifs sont suivis de tête",
          fix: "Enregistrez acomptes et paiements partiels sur la facture, avec le solde toujours visible des deux côtés.",
        },
        {
          pain: "Les pertes de matériaux grugent la marge en silence",
          fix: "Suivez les coûts de matériaux par chantier et comparez à ce que vous aviez prévu à la soumission.",
        },
      ],
    },

    "tree-care": {
      label: "Soins des arbres",
      headline:
        "Un logiciel d'élagage pour un travail à haut risque et à forte valeur",
      description:
        "Équipement, sécurité des équipes, et des chantiers tarifés au jugement plutôt qu'à la grille. FieldQuo garde le dossier clair, de l'évaluation jusqu'à la facture.",
      pains: [
        {
          pain: "Chaque chantier est tarifé au jugement et rien n'est comparable",
          fix: "Les chantiers passés, avec travaux, photos et prix final, restent consultables : votre jugement a une référence.",
        },
        {
          pain: "Les risques du site sont discutés sur place et jamais écrits",
          fix: "Notes, photos et listes de vérification rattachées au chantier avant l'arrivée de l'équipe.",
        },
        {
          pain: "Le travail d'urgence après une tempête arrive d'un coup",
          fix: "Recevez les demandes par formulaire et triez-les sans que le téléphone sonne sans arrêt.",
        },
        {
          pain: "Le temps d'équipement et d'équipe ne se reflète pas dans le prix",
          fix: "Suivi du temps par chantier comparé à ce que vous avez facturé : votre tarification s'améliore avec des preuves.",
        },
      ],
    },
  },
};

export default fr;
