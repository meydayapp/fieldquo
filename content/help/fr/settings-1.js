// content/help/fr/settings-1.js
//
// Partie 1 de la catégorie « settings » en français (voir le composeur,
// settings.js) : le menu Paramètres lui-même, puis les groupes Entreprise et
// Équipe et horaires — le Profil de l'entreprise et ses trois sous-articles
// (heures d'ouverture, taxes, secteur et types de soumission), l'Image de
// marque, la Langue, le Journal d'activité, Gérer l'équipe, Vos heures, les
// Politiques de congés et la Page de rendez-vous.
//
// Même structure que l'anglais, article par article : mêmes slugs, mêmes
// sections dans le même ordre, mêmes blocs, mêmes figures —
// scripts/check-help-centre.mjs compare les deux. Les mots à l'écran viennent
// du bloc `fr` de app/i18n/appMessages.js; les quelques libellés que l'écran
// n'affiche qu'en anglais (les interrupteurs de la grille d'accès, les refus
// du serveur) sont cités tels quels.
export const ARTICLES = {
  "the-settings-menu": {
    title: "Le menu Paramètres",
    summary:
      "Où vit chaque réglage de l'entreprise : les huit groupes du menu Paramètres, la case de recherche et les raisons pour lesquelles une ligne peut manquer dans le vôtre.",
    updated: "2026-09-12",
    intro: [
      "**Paramètres** est la dernière ligne de la barre latérale principale. Elle ouvre un second menu, plus étroit, à gauche — huit groupes, chacun replié pour que la liste se lise comme un index — et atterrit sur **Profil de l'entreprise**. Tout ce qui configure votre entreprise plutôt qu'une seule soumission ou un seul chantier se trouve ici.",
      "Cet article est la carte : ce que chaque groupe contient, comment trouver une ligne en tapant, et les raisons pour lesquelles une ligne dont vous avez lu la description peut ne pas figurer dans votre propre menu.",
    ],
    sections: [
      {
        id: "overview",
        heading: "Vue d'ensemble",
        blocks: [
          { p: "Les groupes sont ordonnés selon la fréquence à laquelle une entreprise les ouvre : l'identité d'abord (**Compte**, **Entreprise**), puis le quotidien (**Équipe et horaires**, **Services et tarifs**), puis ce qui part vers l'extérieur (**Documents et modèles**, **Messagerie et alertes**), puis l'argent (**Encaissement**), puis les surfaces qu'un client rencontre (**Côté client**). Seul le groupe où vous vous trouvez est ouvert; appuyez sur le titre d'un groupe pour l'ouvrir ou le fermer, et FieldQuo se souvient de celui que vous avez laissé ouvert." },
          { p: "Sur un téléphone, le menu devient une barre en haut de l'écran qui nomme la page où vous êtes. Touchez-la et la liste complète glisse vers le haut sous forme de feuille; touchez une ligne et la feuille se referme sur la page demandée." },
        ],
      },
      {
        id: "what-is-on-the-screen",
        heading: "Ce qu'il y a à l'écran",
        blocks: [
          { p: "De haut en bas : le titre **Paramètres**, la case **Rechercher un réglage**, puis les huit groupes. Chaque ligne a son propre article dans cette catégorie." },
          { table: {
            head: ["Groupe", "Lignes"],
            rows: [
              ["Compte", "Compte et facturation · Parrainage · Migration de données · Nouveautés"],
              ["Entreprise", "Profil de l'entreprise · Image de marque · Langue · Journal d'activité"],
              ["Équipe et horaires", "Gérer l'équipe · Disponibilités · Politiques de congés · Page de rendez-vous · Zones desservies"],
              ["Services et tarifs", "Produits et services · Services et tarifs · Coût des matériaux · Tarifs des armoires · Frais généraux · Champs personnalisés"],
              ["Documents et modèles", "Courriel de soumission · Modèles de courriel · Modèles PDF · Traductions · Listes de vérification · Étiquettes des photos de chantier"],
              ["Messagerie et alertes", "Messages aux clients · Relances · Notifications · Domaine d'envoi"],
              ["Encaissement", "Paiements · Publicités Meta · Suivi des dépenses · Crédit IA · Paie"],
              ["Côté client", "Votre site web · Soumissions instantanées · Partager vos liens · Lien de profil · Réceptionniste téléphonique · Employé IA · Avis"],
            ],
          } },
          { figure: "live:app-settings", caption: "Paramètres — les huit groupes à gauche, Entreprise ouvert, la page d'arrivée étant le Profil de l'entreprise." },
        ],
      },
      {
        id: "find-a-row",
        heading: "Comment trouver une ligne",
        blocks: [
          { steps: [
            "Appuyez sur **Paramètres** au bas de la barre latérale principale.",
            "Tapez une partie du nom d'une ligne dans **Rechercher un réglage** — « taxe », « logo », « heures ». Tous les groupes s'ouvrent pendant que vous tapez, si bien qu'une ligne n'est jamais à plus d'une recherche, quoi qu'il y ait de replié.",
            "Appuyez sur la ligne. Si rien ne correspond, le menu affiche **Aucun résultat pour « … »** avec un lien **Effacer** qui vide la case.",
          ] },
          { tip: "Quatre lignes sont la même page qu'une ligne de la barre latérale principale, sous un autre nom : **Gérer l'équipe** est **Votre équipe**, **Compte et facturation** est **Forfait**, **Suivi des dépenses** est **Dépenses**, et **Parrainage** y figure sous son propre nom. Les deux portes ouvrent le même écran." },
        ],
      },
      {
        id: "rows-that-may-be-missing",
        heading: "Lignes qui peuvent manquer dans votre menu",
        blocks: [
          { p: "Votre menu peut être plus court que le tableau ci-dessus. Ce n'est pas une panne : une ligne est retirée pour l'une des raisons ci-dessous, et la page derrière elle vous refuserait de toute façon. Cacher la ligne est une question de propreté; le refus sur le serveur est la règle." },
          { bullets: [
            "**Votre niveau d'accès.** Les lignes que seuls un propriétaire ou un administrateur peuvent ouvrir — Compte et facturation, Parrainage, Migration de données, Paiements, Publicités Meta, Paie, Journal d'activité, Politiques de congés, Notifications, Votre site web — ne sont pas dessinées pour un Gestionnaire, un Répartiteur, un Estimateur ou un Équipier.",
            "**Un interrupteur de permission.** **Coût des matériaux** et **Frais généraux** exigent l'interrupteur **Job Costing** (calcul du coût de revient); **Produits et services**, **Services et tarifs** et **Soumissions instantanées** exigent **Show Pricing** (voir les prix); **Suivi des dépenses** exige le niveau de dépenses le plus élevé de la grille d'accès.",
            "**Votre métier.** **Coût des matériaux** et **Tarifs des armoires** n'apparaissent que pour les entreprises dont les types de soumission activés se tarifent ainsi — un peintre ne voit jamais une grille de tarifs d'armoires.",
            "**Une fonction en aperçu ou absente de votre forfait.** La ligne reste et porte une pastille **Aperçu** ou **Verrouillé** au lieu de disparaître, pour que vous sachiez qu'elle existe.",
          ] },
        ],
      },
      {
        id: "who-can-see-it",
        heading: "Qui peut le voir",
        blocks: [
          { p: "Toute personne qui a un identifiant voit la ligne Paramètres et le menu. Trois lignes sont dessinées pour chaque membre, Équipiers compris, parce qu'elles appartiennent à la personne elle-même : **Nouveautés**, **Langue** et **Disponibilités**. La plupart des autres exigent la capacité de gestion des utilisateurs — le propriétaire, les administrateurs, et les niveaux Gestionnaire et Répartiteur. Chaque article de cette catégorie énonce sa propre règle." },
          { note: "Une session d'assistance FieldQuo en lecture seule voit chaque ligne et ne peut rien y changer." },
        ],
      },
    ],
    faq: [
      { q: "Pourquoi Paramètres s'ouvre-t-il sur le Profil de l'entreprise?", a: "L'index n'a pas de page à lui; atterrir sur la première ligne du groupe Entreprise revient à appuyer dessus. Le Profil de l'entreprise est aussi l'écran qu'une nouvelle entreprise devrait remplir en premier." },
      { q: "Puis-je réordonner ou cacher des lignes moi-même?", a: "Non. Les groupes et leur ordre sont fixes. Ce qui varie d'une personne à l'autre est décidé par le niveau d'accès, les interrupteurs de permission et le métier, jamais par une préférence." },
      { q: "Où est Coût des matériaux? Je ne le trouve pas.", a: "La ligne n'est dessinée que lorsque vos types de soumission activés incluent un métier qui se tarife au matériau, et seulement pour les personnes dont l'interrupteur Job Costing est activé. Vérifiez d'abord Services et tarifs, puis l'accès de la personne." },
    ],
  },

  "settings-company": {
    title: "Profil de l'entreprise",
    summary:
      "Le premier écran après l'inscription : votre description des travaux et vos conditions de paiement, l'échéancier de paiement, le secteur et les types de soumission, les coordonnées de l'entreprise, les heures d'ouverture, les disponibilités de rendez-vous, les paramètres de taxes, le comparatif sectoriel et vos préférences régionales.",
    updated: "2026-09-12",
    intro: [
      "**Profil de l'entreprise** est la ligne sur laquelle le menu **Paramètres** atterrit et l'écran que toute nouvelle entreprise devrait remplir en premier. Il contient les faits qui s'impriment sur chaque document — votre nom, votre adresse, votre téléphone, votre numéro de taxe — et les préférences qui façonnent chaque écran de votre équipe : fuseau horaire, format de date, premier jour de la semaine, devise.",
      "Cet article parcourt la page carte par carte. Trois cartes sont assez grandes pour avoir leur propre article : [[opening-hours|Heures d'ouverture]], [[tax-settings|Paramètres de taxes]] et [[industry-and-quote-types|Secteur et types de soumission]]. Les cartes de description des travaux et d'échéancier de paiement sont traitées du côté des soumissions et des factures.",
    ],
    sections: [
      {
        id: "overview",
        heading: "Vue d'ensemble",
        blocks: [
          { p: "La page est un long formulaire avec un seul bouton **Mettre à jour les réglages** au bas, plus trois cartes qui s'enregistrent seules : **Échéancier de paiement** (**Enregistrer l'échéancier**), **Heures d'ouverture** (**Enregistrer les heures d'ouverture**) et la liste des taux de taxe (**Ajouter**). Un changement dans toute autre carte attend **Mettre à jour les réglages**; un enregistrement raté le dit en rouge plutôt que de faire semblant." },
        ],
      },
      {
        id: "what-is-on-the-screen",
        heading: "Ce qu'il y a à l'écran",
        blocks: [
          { p: "Sous le titre **Profil de l'entreprise — Les coordonnées de votre entreprise, vos heures, vos taxes et vos préférences régionales.**, les cartes se suivent de haut en bas :" },
          { table: {
            head: ["Carte", "Ce qu'elle contient"],
            rows: [
              ["Description des travaux et conditions", "Le texte de déroulement copié sur chaque nouvelle soumission, trois modèles de métier pour partir, et la ligne libre Conditions de paiement — voir [[scope-of-work-and-terms|Description des travaux et conditions de paiement]]."],
              ["Échéancier de paiement", "Des étapes de dépôt et de solde liées aux dates du chantier lui-même. Désactivé tant que vous n'ajoutez pas d'étape; une fois actif, il rédige la ligne Conditions de paiement pour vous — voir [[deposits-and-payment-schedules|Dépôts et échéanciers de paiement]]."],
              ["Secteur et types de soumission", "Les secteurs nommés à l'inscription et les types de soumission actuellement activés, avec un lien Gérer vers Services et tarifs."],
              ["Coordonnées de l'entreprise", "Nom de l'entreprise, Numéro de téléphone, Adresse courriel, Adresse du site Web, votre sous-domaine fieldquo.com, Adresse municipale avec un aperçu de carte, Ville, Province, Code postal, Pays."],
              ["Heures d'ouverture", "Quand l'entreprise est ouverte — les heures publiques, une ligne par jour."],
              ["Disponibilités pour la prise de rendez-vous", "Un tableau en lecture seule de vos propres heures réservables avec un bouton Modifier; l'éditeur complet est Disponibilités."],
              ["Paramètres de taxes", "Nom et numéro de taxe, la case Je n'en ai pas, vos taux de taxe, la question sur la TVA pour les pays à TVA, et l'interrupteur de taxe locale automatique."],
              ["Comparatif sectoriel", "Une seule case à cocher : partager vos chiffres anonymisés pour débloquer la page de comparatif."],
              ["Paramètres régionaux", "Pays, Devise de facturation, la case pour servir des clients à l'étranger, Fuseau horaire, Format de date, Premier jour de la semaine."],
            ],
          } },
          { figure: "live:app-settings-company", caption: "Profil de l'entreprise — Description des travaux et conditions, Échéancier de paiement, Secteur et types de soumission et Coordonnées de l'entreprise, avec les Heures d'ouverture plus bas." },
        ],
      },
      {
        id: "how-to-update",
        heading: "Comment mettre à jour les coordonnées de votre entreprise",
        blocks: [
          { steps: [
            "Ouvrez **Paramètres → Profil de l'entreprise**.",
            "Dans **Coordonnées de l'entreprise**, commencez à taper dans **Adresse municipale** et choisissez la suggestion — Ville, Province, Code postal, Pays et la carte se remplissent d'eux-mêmes. Vous pouvez encore modifier chaque case à la main.",
            "Vérifiez **Paramètres régionaux**. Le pays est rempli d'après l'adresse; la Devise de facturation suit le pays sauf si vous cochez **Je sers des clients à l'extérieur de mon pays (facturer dans d'autres devises)**, ce qui la transforme en liste où choisir.",
            "Appuyez sur **Mettre à jour les réglages** au bas. Le bouton affiche **Enregistrement…**, puis un **Enregistré** vert apparaît à côté.",
          ] },
          { note: "Le nom, le téléphone, le courriel et l'adresse s'impriment sur chaque soumission, facture et courriel que vos clients reçoivent, et l'adresse est le point de départ de la vérification du temps de route de la page de rendez-vous. Le sous-domaine affiché sous la case du site web est en lecture seule ici; le site d'une page qui y vit se construit sous **Paramètres → Votre site web**." },
        ],
      },
      {
        id: "what-each-setting-changes",
        heading: "Ce que change chaque paramètre régional",
        blocks: [
          { bullets: [
            "**Pays** — décide de la devise, du libellé du numéro de taxe que vous voyez (**Numéro de TPS/TVH** au Canada, **Numéro de TVA** au Royaume-Uni et dans l'UE, **EIN** aux États-Unis) et de l'ensemble de congés de départ proposé en premier.",
            "**Devise de facturation** — la devise dans laquelle vos soumissions, factures et paiements des clients sont affichés et facturés. Dérivée du pays sauf si vous facturez à l'étranger; le serveur applique la même règle à l'enregistrement, si bien qu'un atelier canadien n'a jamais à choisir entre CAD, USD et EUR.",
            "**Fuseau horaire** — l'horloge à laquelle chaque rendez-vous, rappel et appel de la réceptionniste est lu. Une erreur ici, c'est un texto de rappel à la mauvaise heure.",
            "**Format de date** — MM/JJ/AAAA, JJ/MM/AAAA ou AAAA-MM-JJ, appliqué à vos propres écrans : l'horaire, la liste de l'équipe, les pages de soumission, les imports de dépenses. Les documents des clients l'ignorent et suivent la langue du client.",
            "**Premier jour de la semaine** — Dimanche ou Lundi. Fait pivoter le calendrier, la grille d'horaire et chaque éditeur hebdomadaire de cette page et de Disponibilités.",
            "**Partager mes chiffres anonymisés pour débloquer les comparatifs** — active la page **Comparatif sectoriel**. Vos chiffres sont regroupés avec ceux d'autres entreprises et jamais affichés individuellement; décochez la case quand vous voulez et la page se verrouille de nouveau.",
          ] },
        ],
      },
      {
        id: "who-can-see-it",
        heading: "Qui peut le voir",
        blocks: [
          { p: "La ligne exige la capacité de gestion des utilisateurs : le propriétaire, les administrateurs, et les niveaux Gestionnaire et Répartiteur ouvrent le formulaire complet. Un Estimateur ou un Équipier qui atteint la page par son adresse obtient une version en lecture seule — nom, téléphone, courriel, adresse, heures d'ouverture, heures réservables, taux de taxe, paramètres régionaux, secteurs, types de soumission et texte de description — avec un avis nommant qui peut la modifier. Le numéro de taxe, l'interrupteur de taxe automatique et la case du comparatif ne leur sont pas montrés du tout." },
          { note: "Chaque écriture passe par une seule route qui vérifie de nouveau la même capacité; cacher le formulaire est une courtoisie, le refus est la règle." },
        ],
      },
    ],
    faq: [
      { q: "J'ai tapé USA comme pays et la devise est restée en CAD. Pourquoi?", a: "Le pays est désormais une liste de codes, pas une case de texte, précisément parce qu'une valeur tapée que la liste ne reconnaissait pas retombait sur le Canada. Choisissez le pays dans la liste et la devise suit." },
      { q: "Changer le format de date change-t-il mes soumissions?", a: "Non. Le format s'applique aux écrans que votre équipe lit. Une soumission, une facture ou un courriel destiné à un client formate ses dates dans la langue du client." },
      { q: "Puis-je cacher mon sous-domaine?", a: "Pas depuis cet écran — il est affiché pour que vous connaissiez l'adresse. Rien n'y est servi tant que vous ne construisez et ne publiez pas un site sous Votre site web." },
    ],
  },

  "opening-hours": {
    title: "Heures d'ouverture",
    summary:
      "Les heures pendant lesquelles votre entreprise est ouverte — affichées sur votre site web, envoyées à Google comme données structurées, et respectées par la réceptionniste téléphonique et l'employé IA. Pas la même chose que les heures réservables de qui que ce soit.",
    updated: "2026-09-12",
    intro: [
      "**Heures d'ouverture** est une carte du **Profil de l'entreprise** : sept lignes, une par jour, chacune soit **Fermé**, soit une plage horaire. Elles répondent à une seule question — quand l'entreprise est-elle ouverte — et elles appartiennent à l'entreprise, pas à une personne.",
      "Elles comptent plus qu'elles n'en ont l'air. Les mêmes sept lignes deviennent le bloc des heures d'ouverture de votre site web et les données structurées qui placent « Ouvert · Ferme à 17 h » dans un résultat Google, un encadré lu par des gens qui ne chargent jamais le site.",
    ],
    sections: [
      {
        id: "overview",
        heading: "Vue d'ensemble",
        blocks: [
          { p: "FieldQuo conserve deux semaines différentes et les garde séparées à dessein. Les heures d'ouverture disent quand l'*entreprise* est ouverte. Les **Heures réservables** — la carte juste en dessous, et l'écran plus complet **Disponibilités** — disent quand une *personne* peut être réservée. Un estimateur qui prend son vendredi ne doit pas publier l'atelier comme fermé le vendredi; les deux ont donc le droit de ne pas concorder." },
          { warning: "Une entreprise qui n'a jamais défini d'heures d'ouverture n'en a aucune — la vue en lecture seule dit **Aucune heure d'ouverture n'a été définie.** et rien ne part vers le site web ni vers Google. FieldQuo n'invente jamais une semaine du lundi au vendredi à votre place; l'absence d'une déclaration n'est pas une déclaration." },
        ],
      },
      {
        id: "what-is-on-the-screen",
        heading: "Ce qu'il y a à l'écran",
        blocks: [
          { p: "Sous **Heures d'ouverture — Quand votre entreprise est ouverte. Affiché sur votre site Web et utilisé pour les heures d'ouverture qui apparaissent dans les résultats de recherche Google.**, l'éditeur montre la semaine à partir de votre **Premier jour de la semaine**." },
          { bullets: [
            "**Une case à cocher par jour** — cochée signifie ouvert; décochée affiche **Fermé** et cache les heures.",
            "**Deux cases d'heure**, ouverture **à** fermeture. Une fermeture antérieure à son ouverture affiche **L'heure de fermeture doit suivre celle d'ouverture.** et, si vous enregistrez quand même, le serveur stocke ce jour comme fermé.",
            "**Appliquer les heures du lundi à tous les jours ouverts** (le jour nommé est le premier jour affiché) — copie les heures d'un jour sur tous les autres jours *ouverts*. Cela ne rouvre jamais un jour fermé.",
            "**Rétablir les heures habituelles du métier** — du lundi au jeudi de 8 h à 17 h, le vendredi de 8 h à 16 h, fermé la fin de semaine. Un point de départ, enregistré seulement quand vous appuyez sur enregistrer.",
          ] },
          { figure: "live:app-settings-company", caption: "Profil de l'entreprise — la carte Heures d'ouverture au bas, une ligne par jour avec une case à cocher et deux heures." },
        ],
      },
      {
        id: "how-to-set",
        heading: "Comment définir vos heures d'ouverture",
        blocks: [
          { steps: [
            "Ouvrez **Paramètres → Profil de l'entreprise** et descendez jusqu'à **Heures d'ouverture**.",
            "Cochez les jours où vous êtes ouvert et décochez ceux où vous ne l'êtes pas.",
            "Réglez les heures du premier jour ouvert, puis appuyez sur **Appliquer les heures du … à tous les jours ouverts** pour les copier.",
            "Ajustez tout jour qui diffère — un vendredi plus court, un samedi matin.",
            "Appuyez sur **Enregistrer les heures d'ouverture**. Cette carte s'enregistre seule; un **Enregistré** vert le confirme, et vous n'avez pas besoin de **Mettre à jour les réglages** pour elle.",
          ] },
          { tip: "Si tous les jours sont cochés fermés, une ligne sous la carte le dit : aucune heure n'apparaîtra sur votre site web ni dans les résultats de recherche. Ne décochez rien par accident." },
        ],
      },
      {
        id: "where-they-are-used",
        heading: "Où les heures sont utilisées",
        blocks: [
          { table: {
            head: ["Où", "Ce que font les heures"],
            rows: [
              ["Votre site web", "Imprimées comme bloc des heures d'ouverture, et émises comme données structurées pour que les moteurs de recherche puissent les afficher à côté de votre nom — voir [[the-website-builder|Le constructeur de site web]]."],
              ["Réceptionniste téléphonique", "Les rappels et les plages réservées ne sont offerts qu'à l'intérieur des heures d'ouverture; on ne promet jamais à un appelant un appel à sept heures du matin — voir [[the-phone-receptionist|La réceptionniste téléphonique]]."],
              ["Employé IA", "Son option « répondre seulement pendant les heures d'affaires » lit ces heures; sans aucune heure définie, l'option ne peut rien arrêter — voir [[the-ai-employee|L'employé IA]]."],
              ["Profil de l'entreprise, vue en lecture seule", "Un membre de l'équipe sans accès aux paramètres lit les heures en texte, si bien qu'un peintre n'a pas à téléphoner au bureau pour savoir quand il ferme."],
            ],
          } },
          { p: "Les heures ne servent *pas* à construire l'horaire de qui que ce soit, à décider quelles plages un client peut réserver, ni à compter les jours de congé. Tout cela vient des heures de travail et des heures réservables de chaque personne." },
        ],
      },
      {
        id: "who-can-see-it",
        heading: "Qui peut le voir",
        blocks: [
          { p: "Modifier exige la capacité de gestion des utilisateurs — le propriétaire, les administrateurs, les Gestionnaires et les Répartiteurs. Toute autre personne qui ouvre le Profil de l'entreprise voit les heures sous forme de liste en lecture seule." },
        ],
      },
    ],
    faq: [
      { q: "J'ai défini mes heures mais la page de rendez-vous offre encore le samedi. Pourquoi?", a: "La page de rendez-vous lit les heures réservables, par personne, pas les heures d'ouverture de l'entreprise. Ouvrez Disponibilités et décochez le samedi sous Heures réservables pour les personnes concernées." },
      { q: "Pourquoi le formulaire affiche-t-il du lundi au vendredi alors que je n'ai rien défini?", a: "L'éditeur propose les heures habituelles du métier comme point de départ pour que le formulaire soit rapide à terminer. Rien n'est stocké tant que vous n'appuyez pas sur Enregistrer les heures d'ouverture; jusque-là, l'entreprise n'a pas d'heures." },
      { q: "Les heures changent-elles avec l'heure avancée?", a: "Non. Ce sont des heures d'horloge murale dans le fuseau horaire de votre entreprise — 8 h reste 8 h toute l'année." },
    ],
  },

  "tax-settings": {
    title: "Paramètres de taxes",
    summary:
      "Votre numéro d'inscription fiscale tel qu'il s'imprime sur les documents, les taux de taxe que vous créez, la question sur la TVA pour les entreprises européennes, et l'interrupteur qui choisit pour vous le taux local du client.",
    updated: "2026-09-12",
    intro: [
      "**Paramètres de taxes** est une carte du **Profil de l'entreprise** en deux moitiés. La moitié du haut parle de *vous* : le numéro d'inscription qui s'imprime au bas de chaque soumission et facture. La moitié du bas parle du *client* : les taux que vous créez, celui qui est par défaut, et si FieldQuo doit choisir le taux qui correspond à la province du client au lieu de toujours prendre le taux par défaut.",
      "La règle derrière toute la carte est prudente à dessein : chaque taux qu'un document peut porter est un taux que vous avez tapé et nommé. FieldQuo ne calcule pas ce que vous devez, ne vous inscrit nulle part et ne produit aucune déclaration pour vous — il imprime ce que vous saisissez.",
    ],
    sections: [
      {
        id: "overview",
        heading: "Vue d'ensemble",
        blocks: [
          { p: "Une soumission ou une facture stocke sa taxe comme un montant d'argent au moment où elle est créée. Rien sur cette carte n'atteint un document qui existe déjà — supprimer un taux ou changer l'interrupteur automatique change le prochain document, jamais un document envoyé. C'est ce qui rend la carte sûre à modifier en plein mois." },
        ],
      },
      {
        id: "what-is-on-the-screen",
        heading: "Ce qu'il y a à l'écran",
        blocks: [
          { p: "Les contrôles, de haut en bas :" },
          { table: {
            head: ["Contrôle", "Ce qu'il fait"],
            rows: [
              ["Nom du numéro de taxe et la case du numéro", "Le libellé que le numéro porte sur les documents (**p. ex. TPS**) et le numéro lui-même. La case du numéro est nommée comme votre pays la nomme — **Numéro de TPS/TVH**, **Numéro de TVA**, **EIN** — d'après le pays des Paramètres régionaux. Aucune vérification de format, délibérément : un numéro valide n'est jamais refusé."],
              ["Je n'en ai pas — mon entreprise n'est pas inscrite.", "Affichée seulement tant que la case du numéro est vide. La cocher enregistre le fait et retire l'étape d'inscription fiscale de votre tableau de bord; décochez-la le jour où vous vous inscrivez et l'étape revient."],
              ["Taux de taxe", "La liste des taux que vous avez créés, chacun avec un nom et un pourcentage, l'un portant la pastille **Par défaut**, chacun avec une icône de suppression."],
              ["Créer un taux de taxe", "Ouvre un formulaire d'une ligne : **Nom (p. ex. TPS)**, **Taux %**, une case **Par défaut**, et **Ajouter**. S'enregistre immédiatement."],
              ["Êtes-vous inscrit à la TVA ?", "Trois choix, affichés seulement quand le pays est un territoire à TVA : **Oui — je suis inscrit à la TVA**, **Non — je suis sous le seuil d'inscription**, **Je préfère ne pas répondre pour l'instant — utilisez mon taux par défaut**."],
              ["Appliquer automatiquement le taux de taxe local du client…", "L'interrupteur qui laisse FieldQuo choisir parmi vos taux d'après la province du client au lieu que vous choisissiez sur chaque document."],
            ],
          } },
          { figure: "live:app-settings-company", caption: "Profil de l'entreprise — la carte Paramètres de taxes se trouve sous Disponibilités pour la prise de rendez-vous, avec la liste des taux et Créer un taux de taxe." },
        ],
      },
      {
        id: "create-a-tax-rate",
        heading: "Comment créer un taux de taxe",
        blocks: [
          { steps: [
            "Ouvrez **Paramètres → Profil de l'entreprise** et descendez jusqu'à **Paramètres de taxes**.",
            "Appuyez sur **Créer un taux de taxe**.",
            "Tapez un **Nom** qui dit où il s'applique — « TPS + TVQ (QC) », « TVH Ontario » — et le **Taux %**. Nommez-le d'après la province si vous voulez que l'interrupteur automatique le trouve : la correspondance se fait sur les mots du nom.",
            "Cochez **Par défaut** s'il s'agit du taux qu'un document doit porter quand rien de mieux ne s'applique. Un seul taux est par défaut à la fois; le cocher ici décoche le précédent.",
            "Appuyez sur **Ajouter**. Le taux apparaît aussitôt dans la liste; il n'y a rien d'autre à enregistrer.",
          ] },
          { note: "Il n'y a pas de modification sur place. Pour changer le pourcentage d'un taux, supprimez-le avec l'icône de corbeille et créez-le de nouveau. Les documents déjà envoyés conservent leurs montants." },
        ],
      },
      {
        id: "how-a-rate-is-chosen",
        heading: "Comment le taux d'une nouvelle soumission est choisi",
        blocks: [
          { p: "Quand une soumission est créée, FieldQuo choisit son taux dans cet ordre et s'arrête à la première réponse. La soumission indique quelle étape l'a choisi, si bien qu'un montant de taxe ne change jamais sans explication." },
          { bullets: [
            "**L'interrupteur automatique est désactivé** — votre taux **Par défaut**, tel quel. La fonction est facultative et voici sa porte.",
            "**L'un de vos taux nomme la province du client** — ce taux l'emporte. Un entrepreneur qui a tapé « TVH Ontario 13 » n'est jamais contredit par une table.",
            "**Aucun taux ne correspond et le territoire est connaissable** — le taux publié pour une province canadienne est appliqué. Jamais pour un État américain, où un chiffre d'État est un plancher, pas un taux; pour un pays de l'UE, seulement si vous avez répondu **Oui** à la question sur la TVA.",
            "**Tout le reste** — votre taux par défaut, et la soumission le dit.",
          ] },
          { tip: "Nommez vos taux d'après les provinces avant d'activer l'interrupteur. Un taux appelé « Taxe » ne peut jamais correspondre à rien et l'interrupteur retombera sur le taux par défaut à chaque fois." },
        ],
      },
      {
        id: "who-can-see-it",
        heading: "Qui peut le voir",
        blocks: [
          { p: "Créer, supprimer et définir par défaut des taux, et changer le numéro et les interrupteurs, exigent la capacité de gestion des utilisateurs — le propriétaire, les administrateurs, les Gestionnaires et les Répartiteurs. Un membre de l'équipe qui ne l'a pas voit seulement la liste des taux, en lecture seule, parce que ces pourcentages atterrissent sur les soumissions qu'il construit; le numéro d'inscription et les interrupteurs ne lui sont pas montrés." },
        ],
      },
    ],
    faq: [
      { q: "Dois-je saisir un numéro de taxe?", a: "Seulement si vous êtes inscrit. Un travailleur autonome canadien sous le seuil d'inscription n'a pas de numéro de TPS à donner — cochez Je n'en ai pas et le tableau de bord cesse de le demander." },
      { q: "Où le numéro apparaît-il?", a: "Au bas de chaque soumission et facture, à côté de vos coordonnées, nom et numéro ensemble. Si l'une des deux moitiés est vide, aucune ligne ne s'imprime — jamais un libellé vide." },
      { q: "Activer l'interrupteur automatique changera-t-il mes soumissions envoyées?", a: "Non. Une soumission stocke sa taxe comme un montant à sa création. L'interrupteur agit sur la prochaine soumission que vous créez." },
      { q: "Pourquoi ma soumission dit-elle que le taux par défaut a été utilisé?", a: "Parce qu'aucun de vos taux ne nommait la province du client et que le territoire n'était pas de ceux que FieldQuo remplit lui-même — une adresse américaine, ou une adresse de l'UE sans réponse à la question sur la TVA. Ajoutez un taux nommé d'après cette province, ou indiquez la province du client dans sa fiche." },
    ],
  },

  "industry-and-quote-types": {
    title: "Secteur et types de soumission",
    summary:
      "Les métiers nommés à l'inscription et les types de soumission qu'ils ont débloqués — ce que la carte affiche, où les types de soumission se changent vraiment, et ce qu'ils décident ailleurs dans FieldQuo.",
    updated: "2026-09-12",
    intro: [
      "**Secteur et types de soumission** est une petite carte du **Profil de l'entreprise** qui reflète deux listes : les **Secteurs** choisis à l'inscription de l'entreprise, et les **Types de soumission activés** actuellement sous **Services et tarifs**. Rien sur la carte ne se modifie sur place — c'est un miroir, avec un lien **Gérer** vers l'écran qui fait la modification.",
      "Elle mérite sa place parce que ces deux listes décident de ce qu'une nouvelle soumission peut être, des articles de la liste de prix qui peuvent s'y rattacher, et des lignes de paramètres que votre entreprise voit seulement.",
    ],
    sections: [
      {
        id: "overview",
        heading: "Vue d'ensemble",
        blocks: [
          { p: "La carte se lit **Ce que vous nous avez dit sur vos activités, et les types de soumission que cela a débloqués.** Les secteurs sont l'un de douze métiers — nettoyage, construction et entreprise générale, électricité, CVC, homme à tout faire, aménagement paysager, entretien de pelouse, peinture, plomberie, nettoyage à pression, toiture, arboriculture — affichés sur la puce sous leur nom anglais. Les types de soumission sont les catégories du catalogue des métiers que vous avez activées, plus les catégories personnalisées que vous avez créées." },
        ],
      },
      {
        id: "what-is-on-the-screen",
        heading: "Ce qu'il y a à l'écran",
        blocks: [
          { p: "Deux rangées de puces :" },
          { bullets: [
            "**Secteurs** — une puce par métier nommé à l'inscription, ou **Aucun sélectionné.** Il n'y a aucun contrôle ici ni ailleurs dans l'application pour les changer après l'inscription.",
            "**Types de soumission activés** — une puce par catégorie activée, avec un suffixe **· personnalisé** sur celles que vous avez créées vous-même, et un lien **Gérer** à droite. Sans aucune catégorie activée, la carte dit **Aucun activé pour l'instant — allez dans Réglages → Services.**",
          ] },
          { figure: "live:app-settings-company", caption: "Profil de l'entreprise — la carte Secteur et types de soumission : le secteur Toiture et trois types de soumission activés." },
        ],
      },
      {
        id: "change-quote-types",
        heading: "Comment changer vos types de soumission",
        blocks: [
          { steps: [
            "Ouvrez **Paramètres → Profil de l'entreprise** et trouvez **Secteur et types de soumission**.",
            "Appuyez sur **Gérer** à côté de **Types de soumission activés**. Vous arrivez sur **Services et tarifs** avec une barre en haut qui vous ramène au Profil de l'entreprise.",
            "Activez ou désactivez des catégories là, ou ajoutez-en une personnalisée — voir [[quote-types-and-takeoffs|Types de soumission et relevés]] et [[settings-services|Services et tarifs]].",
            "Revenez au Profil de l'entreprise; les puces reflètent le changement aussitôt.",
          ] },
          { note: "Services et tarifs affiche par défaut les catégories du catalogue qui correspondent à vos secteurs, avec un moyen d'afficher tous les métiers. Un plombier arrive sur les types de soumission de plomberie plutôt que sur tout le catalogue, mais rien n'est hors de portée." },
        ],
      },
      {
        id: "what-they-change",
        heading: "Ce que changent les deux listes",
        blocks: [
          { bullets: [
            "**Le générateur de soumissions** offre exactement les types de soumission activés quand quelqu'un commence une nouvelle soumission, et chaque type porte ses propres champs de relevé et son propre texte.",
            "**La liste de prix** — un article sous **Produits et services** peut être lié à un type de soumission, si bien qu'une ligne de peinture n'apparaît jamais sur une soumission de toiture.",
            "**Le menu Paramètres lui-même** — **Coût des matériaux** et **Tarifs des armoires** ne sont dessinés que lorsqu'un type de soumission activé se tarife ainsi. Activez l'ébénisterie et la grille de tarifs apparaît; désactivez-la et la ligne disparaît.",
          ] },
        ],
      },
      {
        id: "who-can-see-it",
        heading: "Qui peut le voir",
        blocks: [
          { p: "La carte est sur le Profil de l'entreprise; le propriétaire, les administrateurs, les Gestionnaires et les Répartiteurs la voient donc avec le lien **Gérer**; un membre de l'équipe en lecture seule voit les mêmes puces sans le lien. Services et tarifs lui-même est dessiné pour quiconque a l'interrupteur **Show Pricing** (voir les prix) activé." },
        ],
      },
    ],
    faq: [
      { q: "Puis-je changer mes secteurs?", a: "Pas dans l'application aujourd'hui. Ils ont été enregistrés à l'inscription et aucun écran ne les modifie. La liste qui compte au quotidien — les types de soumission activés — est entièrement à vous sous Services et tarifs." },
      { q: "Que signifie le suffixe · personnalisé?", a: "Que ce type de soumission a été créé par votre entreprise plutôt que tiré du catalogue des métiers de FieldQuo." },
      { q: "J'ai désactivé un type de soumission. Qu'arrive-t-il aux soumissions qui l'utilisaient?", a: "Rien — une soumission conserve son type. Il cesse simplement d'être offert pour les nouvelles soumissions." },
    ],
  },

  "settings-branding": {
    title: "Image de marque",
    summary:
      "Votre logo et les trois couleurs de marque — principale, secondaire et neutre — qui apparaissent sur chaque soumission, facture, PDF, courriel, page de rendez-vous et site web qu'un client voit, avec le contraste calculé pour vous.",
    updated: "2026-09-12",
    intro: [
      "**Image de marque** est l'endroit où la promesse de marque blanche est tenue. Téléversez un logo, choisissez une couleur principale, et chaque document et chaque page qu'un propriétaire rencontre porte votre nom et votre couleur — jamais ceux de FieldQuo. Un client qui compare trois entrepreneurs ne devrait pas pouvoir deviner que deux d'entre eux utilisent le même logiciel.",
      "La page tient en trois cartes et un bouton. Ce n'est délibérément pas un outil de design : une seule couleur pilote tout, le contraste est mesuré plutôt que présumé, et le back-office où travaille votre équipe reste neutre quoi que vous choisissiez.",
    ],
    sections: [
      {
        id: "overview",
        heading: "Vue d'ensemble",
        blocks: [
          { p: "Le titre se lit **Image de marque — Votre logo et votre couleur de marque apparaissent sur chaque soumission, facture et courriel que vos clients voient.** Seule la couleur principale est requise; la secondaire et la neutre suivent des valeurs par défaut raisonnables tant que vous ne les réglez pas, et chacune a un lien **Réinitialiser** pour revenir à suivre la principale." },
          { note: "La couleur de marque est pour ce que le *client* voit. Les écrans de votre équipe restent neutres à dessein — un entrepreneur qui choisit le vert lime ne doit pas se retrouver avec un back-office vert lime. La couleur s'applique surface par surface : soumission, facture, courriel, PDF, page de rendez-vous, portail, site web." },
        ],
      },
      {
        id: "what-is-on-the-screen",
        heading: "Ce qu'il y a à l'écran",
        blocks: [
          { p: "De haut en bas :" },
          { table: {
            head: ["Carte", "Ce qu'elle contient"],
            rows: [
              ["Logo", "Un carré d'aperçu et **Téléverser un logo** (ou **Remplacer le logo** une fois qu'il y en a un). **PNG, JPG, WebP ou SVG, jusqu'à 8 Mo.**"],
              ["Couleurs de marque", "**Principale** — six pastilles prédéfinies plus un sélecteur personnalisé. **Secondaire** — les mêmes contrôles, **Réinitialiser** pour suivre la principale. **L'apparence de vos documents** — un aperçu **Clair** et un aperçu **Sombre** qui se mettent à jour pendant que vous choisissez. **Neutre** — la barre d'en-tête du courriel, presque noire par défaut."],
              ["Aperçu", "**À peu près à quoi ressemblera le haut de vos courriels.** : l'en-tête neutre avec votre logo, un titre de section dans la couleur secondaire, et un bouton **Voir et approuver** dans la couleur principale."],
              ["Enregistrer la marque", "Un seul bouton pour toute la page; il affiche **Enregistrement…** puis **Enregistré ✓**."],
            ],
          } },
          { figure: "live:app-settings-branding", caption: "Paramètres → Image de marque — la carte Logo, la carte Couleurs de marque avec ses pastilles et ses aperçus." },
        ],
      },
      {
        id: "how-to",
        heading: "Comment définir votre image de marque",
        blocks: [
          { steps: [
            "Ouvrez **Paramètres → Image de marque**.",
            "Appuyez sur **Téléverser un logo** et choisissez le fichier. Un PNG transparent ou un SVG rend mieux sur l'en-tête clair comme sur le sombre. L'ancien logo est retiré quand vous le remplacez.",
            "Choisissez une couleur **Principale** — une pastille, ou le sélecteur pour votre code hex exact.",
            "Laissez **Secondaire** et **Neutre** à leurs valeurs par défaut sauf si votre marque en a; vérifiez les aperçus **Clair** et **Sombre**.",
            "Appuyez sur **Enregistrer la marque**.",
          ] },
          { tip: "Prenez la couleur de votre camion, de votre carte d'affaires ou de votre site web actuel pour que toutes les surfaces concordent. Une couleur qui change d'un document à l'autre se lit comme deux entreprises." },
        ],
      },
      {
        id: "what-each-colour-changes",
        heading: "Ce que change chaque couleur",
        blocks: [
          { bullets: [
            "**Principale** — les boutons, les barres de progression, les liens et votre nom dans l'en-tête du courriel; l'accent sur la page d'approbation de la soumission, la page de paiement de la facture, la page de rendez-vous et le portail client.",
            "**Secondaire** — les accents d'appoint, comme les titres de section des listes détaillées. Reprend la principale par défaut, si bien qu'une entreprise qui ne la règle jamais reste cohérente.",
            "**Neutre** — la barre d'en-tête de chaque courriel et la bande sombre en haut des documents. Les tons foncés paraissent plus haut de gamme qu'une couleur de marque saturée; c'est pourquoi la valeur par défaut est presque noire.",
          ] },
          { warning: "Les entrepreneurs choisissent le jaune, le blanc et le gris moyen, et une règle naïve du genre « couleur foncée, texte blanc » échoue sur les trois. FieldQuo mesure le contraste de chaque paire texte-fond qu'il tire de votre couleur et substitue une paire lisible quand la vôtre ne l'est pas — une marque jaune imprime donc quand même des boutons lisibles. Il ne peut pas rendre un logo blanc visible sur une page blanche; vérifiez les aperçus." },
        ],
      },
      {
        id: "who-can-see-it",
        heading: "Qui peut le voir",
        blocks: [
          { p: "La ligne exige la capacité de gestion des utilisateurs : le propriétaire, les administrateurs, les Gestionnaires et les Répartiteurs. L'enregistrement passe par la même route que le Profil de l'entreprise et est refusé à toute autre personne; un équipier qui atteint l'adresse ne peut donc pas changer votre marque." },
        ],
      },
    ],
    faq: [
      { q: "Le logo apparaît-il sur le PDF?", a: "Oui — sur le PDF de soumission, le PDF de facture et le courriel qui les transporte, dans l'en-tête où se trouve le nom de votre entreprise." },
      { q: "Pourquoi mon back-office n'utilise-t-il pas ma couleur?", a: "C'est voulu. La promesse de marque blanche concerne ce que le propriétaire voit. Les écrans que votre personnel utilise toute la journée restent neutres pour qu'une couleur de marque vive ne les rende jamais pénibles à utiliser." },
      { q: "Que se passe-t-il si je ne règle jamais de secondaire ni de neutre?", a: "La secondaire suit votre principale et la neutre reste presque noire. Les deux sont dérivées au rendu; changer la principale plus tard déplace donc la secondaire avec elle." },
    ],
  },

  "settings-language": {
    title: "Langue",
    summary:
      "Deux réglages qui se ressemblent et veulent dire des choses différentes : la langue dans laquelle vous lisez FieldQuo, et la valeur par défaut de l'entreprise dont héritent les collègues et les clients qui n'en ont choisi aucune.",
    updated: "2026-09-12",
    intro: [
      "**Langue** est l'une des trois lignes de Paramètres que chaque membre voit, Équipiers compris, parce que la moitié en est personnelle : **Votre langue** est celle dans laquelle *vous* lisez l'application, et la changer ne touche personne d'autre. L'autre moitié, **Valeur par défaut de l'entreprise**, est ce dont hérite quiconque n'a pas choisi — et ce que les documents d'un client utilisent quand le client n'a pas de langue à lui.",
      "FieldQuo est livré en huit langues : English, Français, Español, Українська, ਪੰਜਾਬੀ, Tagalog, Deutsch et Italiano. Les documents et courriels des clients existent dans les huit; l'interface du back-office est complète dans certaines et partiellement en anglais dans d'autres, et la page dit laquelle est laquelle.",
    ],
    sections: [
      {
        id: "overview",
        heading: "Vue d'ensemble",
        blocks: [
          { p: "Le sous-titre se lit **La langue dans laquelle partent les soumissions, factures et courriels de vos clients.** — un rappel que la valeur par défaut de l'entreprise est celle qui atteint les clients. Un document garde la langue dans laquelle il a été créé : changer l'un ou l'autre réglage ne réécrit jamais une soumission déjà partie." },
        ],
      },
      {
        id: "what-is-on-the-screen",
        heading: "Ce qu'il y a à l'écran",
        blocks: [
          { p: "Deux cartes et une ligne d'état :" },
          { bullets: [
            "**Votre langue** — une ligne **Suivre la valeur par défaut de l'entreprise — …** nommant la valeur par défaut actuelle, puis une ligne par langue avec son nom natif et une pastille de couverture : **Interface 100 %**, **Interface 100 % · à vérifier** (complète mais pas encore relue par un réviseur qui parle couramment la langue), **Interface 84 %** (le reste retombe en anglais) ou **Interface en anglais**. Un crochet marque votre choix.",
            "**Valeur par défaut de l'entreprise** — une pastille par langue pour les personnes qui peuvent la changer; pour tous les autres, la valeur par défaut actuelle en texte avec un avis nommant qui peut la changer.",
            "**Affichage actuel :** — la langue que l'application utilise en ce moment : votre choix, ou la valeur par défaut de l'entreprise quand vous la suivez.",
          ] },
          { figure: "live:app-settings-language", caption: "Paramètres → Langue — Votre langue avec la pastille de couverture sur chaque ligne, et les pastilles de Valeur par défaut de l'entreprise plus bas." },
        ],
      },
      {
        id: "change-your-language",
        heading: "Comment changer votre langue",
        blocks: [
          { steps: [
            "Ouvrez **Paramètres → Langue**.",
            "Appuyez sur la langue voulue sous **Votre langue**, ou sur **Suivre la valeur par défaut de l'entreprise** pour hériter.",
            "L'application bascule immédiatement — sans rechargement, sans enregistrement à part. Un **Enregistré** vert le confirme.",
          ] },
          { note: "Chaque bouton de cette carte n'écrit que votre propre préférence. L'écran de personne d'autre ne change." },
        ],
      },
      {
        id: "what-the-company-default-changes",
        heading: "Ce que change la valeur par défaut de l'entreprise",
        blocks: [
          { p: "Appuyer sur une pastille sous **Valeur par défaut de l'entreprise** déplace chaque collègue qui n'a pas défini sa propre langue, et devient le repli pour les clients. Pour tout ce que FieldQuo envoie à un client, la langue est choisie dans cet ordre, en s'arrêtant à la première réponse :" },
          { bullets: [
            "**La langue du document lui-même** — une soumission ou une facture est fixée à sa création et le courriel qui l'accompagne la suit.",
            "**La langue enregistrée du client** — pour tout ce qui n'est pas lié à un document : une confirmation de rendez-vous, un rappel de paiement.",
            "**La valeur par défaut de l'entreprise** — ce réglage.",
            "**L'anglais** — quand rien de ce qui précède n'est défini.",
          ] },
          { warning: "**Ce changement s'applique à tous ceux qui n'ont pas défini leur propre langue. Il ne modifie pas les soumissions déjà envoyées — ils conservent la langue d'envoi.** Un PDF signé doit continuer à dire ce qu'il disait." },
        ],
      },
      {
        id: "who-can-see-it",
        heading: "Qui peut le voir",
        blocks: [
          { p: "Tout le monde voit la ligne et peut changer **Votre langue**. **Valeur par défaut de l'entreprise** exige la capacité de gestion des utilisateurs — le propriétaire, les administrateurs, les Gestionnaires et les Répartiteurs; toute autre personne voit la valeur en texte. La même règle est vérifiée sur le serveur; une pastille qui n'est pas dessinée ne peut donc pas être pressée par un autre moyen." },
        ],
      },
    ],
    faq: [
      { q: "Ma langue affiche Interface 84 %. À quoi ressemblent les 16 % restants?", a: "Ces libellés apparaissent en anglais. Tout ce qu'un client reçoit reste entièrement dans cette langue — le pourcentage ne concerne que vos propres écrans." },
      { q: "Un client peut-il choisir sa langue?", a: "Vous la définissez dans la fiche du client. FieldQuo ne la demande pas au client; il utilise la langue enregistrée du client, puis la valeur par défaut de l'entreprise, puis l'anglais." },
      { q: "Changer la valeur par défaut de l'entreprise traduira-t-il une ancienne soumission?", a: "Non. Un document garde la langue dans laquelle il a été créé, et rien n'est traduit automatiquement au moment de l'envoi." },
    ],
  },

  "settings-activity-log": {
    title: "Journal d'activité",
    summary:
      "La piste d'audit de l'entreprise : qui a fait quoi et quand — soumissions envoyées, paiements enregistrés, heures approuvées, accès modifiés — en lecture seule, du plus récent au plus ancien, pour le propriétaire et les administrateurs.",
    updated: "2026-09-12",
    intro: [
      "Le **Journal d'activité** se trouve dans le groupe **Entreprise** et répond à la question « qui a changé ça? ». Chaque entrée est une phrase écrite au moment où l'action a eu lieu, avec le nom de la personne, son rôle et depuis combien de temps. C'est un registre à consulter quand quelque chose semble anormal, pas un tableau de bord.",
      "Il est en lecture seule à dessein et réservé au propriétaire et aux administrateurs, parce qu'il montre les actions de tous les utilisateurs — paiements, changements de taux de paie, qui a désactivé qui.",
    ],
    sections: [
      {
        id: "overview",
        heading: "Vue d'ensemble",
        blocks: [
          { p: "Le titre se lit **Journal d'activité — Un registre des actions importantes de votre compte — soumissions envoyées, paiements enregistrés, heures ajoutées et approuvées, dépenses, changements de clients et d'équipe, tarifs et réglages.** Cette liste est une promesse que la page peut tenir : chacune de ces familles écrit une entrée. Ce qui n'est *pas* sur la page compte tout autant — aucun filtre, aucune recherche, aucun export, et aucun moyen de modifier ou de supprimer une entrée, parce qu'un journal qu'on peut retoucher n'est pas un journal." },
        ],
      },
      {
        id: "what-is-on-the-screen",
        heading: "Ce qu'il y a à l'écran",
        blocks: [
          { p: "Une seule liste, du plus récent au plus ancien, des 100 dernières entrées. Chaque ligne affiche :" },
          { bullets: [
            "**Un point de couleur** — rouge pour une suppression ou un membre désactivé, vert pour un paiement, bleu pour un envoi, ambre pour un changement de réglage ou une entrée de temps auto-approuvée, gris pour tout le reste.",
            "**La phrase** — « Client Jane Smith ajouté », « Soumission Q-1041 dupliquée en Q-1058 ».",
            "**Qui, rôle et quand** — le nom de l'acteur (ou **Quelqu'un** pour une action du système), son rôle, et un temps relatif comme « il y a 4 min », qui devient une date après 30 jours.",
            "**session d'assistance** — un marqueur ambre sur toute action faite pendant une session d'assistance FieldQuo, pour que rien de fait en votre nom ne soit pris pour l'une de vos actions.",
          ] },
          { figure: "harness:settings-activity", caption: "Paramètres → Journal d'activité — la liste des entrées avec un point, la phrase, et qui l'a faite, son rôle et quand." },
        ],
      },
      {
        id: "what-is-recorded",
        heading: "Ce qui est enregistré",
        blocks: [
          { table: {
            head: ["Famille", "Exemples"],
            rows: [
              ["Soumissions et prospects", "Soumission créée, envoyée, dupliquée, approuvée par un réviseur; prospect converti"],
              ["Factures et argent", "Facture envoyée, relancée, payée; frais de visite crédités; export comptable lancé"],
              ["Chantiers et temps", "Chantier terminé ou supprimé; entrée de temps approuvée — signalée quand quelqu'un a approuvé la sienne"],
              ["Personnes", "Membre invité, accès modifié, désactivé; politique de congés retirée"],
              ["Clients", "Client ajouté, modifié, supprimé"],
              ["Réglages et connexions", "Tarifs mis à jour; WhatsApp ou une ligne de textos d'équipe connectée; abonnement annulé"],
            ],
          } },
        ],
      },
      {
        id: "reading-it",
        heading: "Le lire dans votre langue",
        blocks: [
          { p: "La phrase est stockée en anglais au moment de l'action. Les entrées plus récentes portent aussi une clé de catalogue, et celles-là s'affichent dans la langue de votre interface; les plus anciennes affichent exactement ce qui a été écrit à l'époque. Une liste mixte est le portrait honnête de l'histoire de l'entreprise plutôt qu'un portrait retouché." },
          { note: "Le journal traduit vers l'avant, jamais vers l'arrière. Une entrée de mars dit ce qu'elle disait en mars." },
          { tip: "Vous cherchez un changement précis? La liste, ce sont les 100 dernières entrées sans case de recherche; utilisez la recherche de votre navigateur (Ctrl+F ou ⌘F) sur la page." },
        ],
      },
      {
        id: "who-can-see-it",
        heading: "Qui peut le voir",
        blocks: [
          { p: "Le propriétaire et les administrateurs seulement. La ligne n'est pas dessinée pour un Gestionnaire, un Répartiteur, un Estimateur ou un Équipier, et la page répond **Only an owner or admin can view the activity log.** (un refus du serveur, en anglais) à quiconque d'autre atteint son adresse. Une session d'assistance FieldQuo peut le lire, et ses propres actions y sont marquées comme telles." },
        ],
      },
    ],
    faq: [
      { q: "Puis-je supprimer une entrée?", a: "Non. Rien sur la page ne modifie ni ne retire une entrée, et aucune route ne le ferait. C'est ce qui en fait une piste d'audit." },
      { q: "Pourquoi une vieille entrée est-elle en anglais alors que les nouvelles sont en français?", a: "Les entrées plus anciennes ont été stockées comme une phrase brute et s'affichent telles quelles. Les entrées écrites depuis que le journal sait porter une clé de traduction s'affichent dans votre langue." },
      { q: "Jusqu'où remonte-t-il?", a: "La page affiche les 100 entrées les plus récentes. Rien n'est élagué derrière, mais les entrées plus anciennes ne sont pas paginées à l'écran aujourd'hui." },
    ],
  },

  "settings-team": {
    title: "Équipe",
    summary:
      "La ligne Gérer l'équipe dans Paramètres est le même écran que Votre équipe dans la barre latérale principale — le panneau des sièges, la liste avec le niveau d'accès de chaque personne, Ajouter un utilisateur et les invitations en attente.",
    updated: "2026-09-12",
    intro: [
      "**Gérer l'équipe** sous **Équipe et horaires** ouvre la même page que **Votre équipe** dans la barre latérale principale. Cette courte entrée dit ce qu'on y trouve et où vit le guide complet : [[manage-team|Gérer l'équipe]].",
    ],
    sections: [
      {
        id: "overview",
        heading: "Vue d'ensemble",
        blocks: [
          { p: "Le titre se lit **Gérer l'équipe — Ajoutez ou gérez les membres de l'équipe qui doivent se connecter à FieldQuo au bureau ou sur le terrain.** Tout ce qui touche aux personnes et à l'accès commence ici : inviter, choisir un niveau d'accès, renvoyer ou annuler une invitation, et désactiver quelqu'un. Les niveaux d'accès eux-mêmes sont expliqués dans [[access-levels-overview|Niveaux d'accès : qui voit quoi]]." },
        ],
      },
      {
        id: "what-is-on-the-screen",
        heading: "Ce qu'il y a à l'écran",
        blocks: [
          { bullets: [
            "**Ajouter un utilisateur** en haut à droite, et sous le panneau des sièges **Ajouter un équipier — gratuit** et **Ajouter un siège** — l'identifiant d'équipier gratuit et le siège payant, chacun grisé avec une raison quand le plafond du forfait est atteint.",
            "**Le panneau des sièges** — combien de **sièges utilisés** par rapport au forfait, et un compte par niveau : Administrateurs, Gestionnaires, Répartiteurs, Employés, Équipiers, Accès personnalisé.",
            "**Les onglets** — **Travailleurs** et **Paie** pour le propriétaire et les administrateurs, **Feuilles de temps** pour quiconque peut ouvrir la page.",
            "**La liste** — **Nom / Courriel**, **Rôle** sous forme de menu déroulant que vous pouvez changer pour les personnes en dessous de vous, **Dernière connexion**, et un interrupteur actif.",
            "**Les invitations en attente** — chacune avec **Invité**, le temps qu'il reste au lien, **Renvoyer l’invitation** et **Annuler l’invitation**.",
          ] },
          { figure: "live:app-settings-team", caption: "Paramètres → Gérer l'équipe — le panneau des sièges, la liste avec le rôle de chaque personne, et Ajouter un utilisateur." },
        ],
      },
      {
        id: "who-can-see-it",
        heading: "Qui peut le voir",
        blocks: [
          { p: "La ligne exige la capacité de gestion des utilisateurs : le propriétaire, les administrateurs, les Gestionnaires et les Répartiteurs. Un Gestionnaire ou un Répartiteur peut inviter au palier Employé — Équipier ou Estimateur — sans aucun cadran au-dessus du sien; changer l'accès d'une personne existante, nommer un administrateur et révoquer un accès sont réservés au propriétaire et aux administrateurs. Tous les détails : [[invite-a-team-member|Inviter un membre de l'équipe]] et [[deactivate-a-team-member|Désactiver un membre de l'équipe]]." },
        ],
      },
    ],
    faq: [
      { q: "Est-ce une page différente de Votre équipe?", a: "Non — même page, deux portes. Le menu Paramètres la liste à côté des autres lignes d'équipe; la barre latérale principale la liste sous Personnes." },
      { q: "Pourquoi Travailleurs manque-t-il dans mes onglets?", a: "Il contient les taux de paie; il n'est donc dessiné que pour le propriétaire et les administrateurs; un Gestionnaire ne le voit pas. Voir [[payroll-settings|Paramètres de paie]]." },
    ],
  },

  "settings-your-hours": {
    title: "Vos heures",
    summary:
      "Deux semaines par personne sur un seul écran : les Heures de travail, le quart que l'horaire et les feuilles de temps utilisent, et les Heures réservables, la plage que les clients peuvent réserver sur la page publique — avec un sélecteur pour régler celles de quelqu'un d'autre.",
    updated: "2026-09-12",
    intro: [
      "La ligne **Disponibilités** ouvre une page intitulée **Vos heures**, et c'est l'une des trois lignes de Paramètres que chaque membre voit, parce que ces heures appartiennent à la personne. Elle contient deux semaines différentes à dessein : les **Heures de travail**, le quart, et les **Heures réservables**, la plage qu'un client peut réserver. Un estimateur travaille de 8 h à 16 h mais ne prend des consultations que de 14 h à 16 h parce que les matinées sont sur le chantier; une seule semaine ne peut pas dire cela.",
      "Une personne qui a l'accès à l'équipe obtient aussi un sélecteur **Heures de qui** en haut et peut régler les semaines d'un collègue — c'est ainsi qu'un équipier qui ne se connecte jamais devient réservable.",
    ],
    sections: [
      {
        id: "overview",
        heading: "Vue d'ensemble",
        blocks: [
          { p: "Le sous-titre se lit **Votre quart et votre fenêtre réservable sont distincts. La personne pourrait travailler de 8 h à 16 h mais ne prendre des réservations clients que de 14 h à 16 h — définissez les deux ici.** La page avertit quand la plage réservable tombe hors du quart, parce que c'est généralement une erreur, mais elle le permet, parce que parfois ce n'en est pas une." },
          { note: "Aucune des deux semaines n'est les heures d'ouverture de l'entreprise. Celles-ci vivent sur le **Profil de l'entreprise** pour que le jour de congé d'une personne ne soit jamais publié comme une fermeture de l'atelier — voir [[opening-hours|Heures d'ouverture]]." },
        ],
      },
      {
        id: "what-is-on-the-screen",
        heading: "Ce qu'il y a à l'écran",
        blocks: [
          { p: "De haut en bas :" },
          { bullets: [
            "**Heures de qui** — un menu déroulant des membres actifs de l'équipe avec **(vous)** sur votre propre nom; affiché seulement aux personnes qui peuvent modifier les autres. Choisir quelqu'un d'autre renomme la page **Heures de …** et affiche la ligne ambre **Vous modifiez les heures de quelqu'un d'autre. Cette personne verra le changement sur son propre horaire.**",
            "**Heures de travail — Votre quart. Utilisé pour la planification et les feuilles de temps. Jamais montré aux clients.** Sept lignes, chacune avec une case à cocher et deux heures; un jour décoché se lit **Non planifié**.",
            "**Heures réservables — Quand les clients peuvent vous réserver sur votre calendrier public et votre site web. Généralement une plage plus étroite que votre quart.** Les mêmes sept lignes. En dessous, quand rien n'est coché : **Sans heures réservables, vous n'apparaîtrez pas comme option sur la page de réservation de votre entreprise.**",
            "**Enregistrer les heures** — épinglé au bas de l'écran pour rester à portée sur un téléphone sous deux semaines complètes; les deux semaines s'enregistrent ensemble.",
          ] },
          { figure: "live:app-settings-availability", caption: "Paramètres → Disponibilités — Heures de travail et Heures réservables, chacune une semaine de cases à cocher et d'heures, avec Enregistrer les heures épinglé en dessous." },
        ],
      },
      {
        id: "how-to",
        heading: "Comment définir vos heures",
        blocks: [
          { steps: [
            "Ouvrez **Paramètres → Disponibilités**. Si vous réglez celles d'un collègue, choisissez-le sous **Heures de qui**.",
            "Sous **Heures de travail**, cochez les jours du quart et réglez le début et la fin de chacun.",
            "Sous **Heures réservables**, cochez les jours où un client peut réserver et réglez une plage — généralement plus étroite que le quart.",
            "Lisez la ligne ambre si elle apparaît : **Les clients pourraient vous réserver quand vous ne travaillez pas :** suivie des jours et de la raison. C'est permis; vérifiez simplement que c'est intentionnel.",
            "Appuyez sur **Enregistrer les heures**. Un jour dont la fin ne suit pas le début est refusé avec **Corrigez les heures surlignées** jusqu'à correction.",
          ] },
          { tip: "Une nouvelle recrue commence lundi? Réglez ses heures le jour où vous l'invitez. Une personne sans heures réservables n'est pas offerte sur la page de rendez-vous, et une personne sans heures de travail ne donne à l'horaire aucun quart auquel comparer." },
        ],
      },
      {
        id: "what-each-week-changes",
        heading: "Ce que change chaque semaine",
        blocks: [
          { table: {
            head: ["Semaine", "Lue par"],
            rows: [
              ["Heures de travail", "L'horaire, qui avertit — sans jamais bloquer — quand un quart tombe hors du schéma habituel; la période de paie; et les congés, qui ne déduisent que les jours de travail de la personne, si bien qu'un équipier du mardi au samedi ne perd aucun solde pour un lundi."],
              ["Heures réservables", "La page de rendez-vous publique et le calendrier de réservation de votre site web, qui n'offrent cette personne qu'à l'intérieur de la plage; et l'horaire, qui refuse un quart hors de celle-ci sauf si un gestionnaire passe outre et note pourquoi."],
            ],
          } },
          { warning: "Sans heures réservables définies pour qui que ce soit, la page de rendez-vous n'a personne à offrir et n'affiche aucune plage. C'est pour cette raison que les étapes de configuration du tableau de bord pointent ici." },
        ],
      },
      {
        id: "who-can-see-it",
        heading: "Qui peut le voir",
        blocks: [
          { p: "Tout le monde voit la ligne et peut régler ses deux semaines. Le sélecteur **Heures de qui**, et l'enregistrement pour une autre personne, exigent la capacité de gestion des utilisateurs — le propriétaire, les administrateurs, les Gestionnaires et les Répartiteurs. Le serveur résout la cible de la même façon; un sélecteur qui n'est pas dessiné ne peut donc pas être atteint autrement." },
        ],
      },
    ],
    faq: [
      { q: "Pourquoi ai-je un sélecteur Heures de qui alors que mon équipier n'en a pas?", a: "Le sélecteur n'est dessiné que pour les personnes qui peuvent modifier les autres. Un équipier voit et modifie seulement sa propre semaine." },
      { q: "Ces heures changent-elles ce que mon site web dit des heures d'ouverture?", a: "Non. Les heures d'ouverture sont celles de l'entreprise, sur le Profil de l'entreprise. Celles-ci sont les vôtres, et seul le calendrier de réservation lit la semaine réservable." },
      { q: "Les heures de travail peuvent-elles empêcher un gestionnaire de me planifier un samedi?", a: "Non — travailler hors du schéma habituel n'est pas une erreur, c'est un mardi. L'horaire avertit et laisse le gestionnaire décider. Ce sont les congés approuvés qui bloquent." },
    ],
  },

  "settings-time-off-policies": {
    title: "Politiques de congés",
    summary:
      "Quels types de congés existent dans votre entreprise et comment chacun s'accumule — jours fixes, accumulés à chaque paie, ou indemnité de vacances en pourcentage — avec des ensembles de départ par pays et un report de fin d'année que vous lancez vous-même.",
    updated: "2026-09-12",
    intro: [
      "**Politiques de congés** définit les *types* de congés que votre équipe peut demander — vacances, maladie, personnel, non payé — et la façon dont le droit s'accumule. Les demandes, les approbations et les soldes vivent ailleurs, sur l'écran **Congés** de chaque personne; cette page est le livre des règles derrière eux.",
      "C'est la page du propriétaire et des administrateurs, parce qu'une politique est une condition d'emploi : charger un ensemble de départ écrit immédiatement des soldes pour chaque travailleur, et c'est pourquoi rien ici ne se fait sans que vous appuyiez.",
    ],
    sections: [
      {
        id: "overview",
        heading: "Vue d'ensemble",
        blocks: [
          { p: "Le titre se lit **Politiques de congés — Les congés que votre équipe peut prendre, et comment ils s'accumulent. Les demandes et les soldes se trouvent dans Congés.** Une note au bas dit ce que FieldQuo est et n'est pas : **Les minimums légaux varient selon la province, l'État et l'ancienneté … FieldQuo suit ce que vous configurez — il ne décide pas de ce que vous devez.**" },
        ],
      },
      {
        id: "what-is-on-the-screen",
        heading: "Ce qu'il y a à l'écran",
        blocks: [
          { p: "De haut en bas :" },
          { bullets: [
            "**Commencer avec l'ensemble Canada** (ou celui de votre propre pays) — affiché seulement tant que vous n'avez aucune politique active. La carte présente d'abord l'ensemble du pays de votre profil d'entreprise, marqué **Votre pays**, et liste les autres sous **Vous embauchez dans un autre pays ? Ils sont ici aussi.** Des ensembles de départ existent pour le Canada, les États-Unis et le Royaume-Uni, chacun disant ce qu'il présume et l'année de ses chiffres.",
            "**Politiques** avec **Ajouter une politique** — chaque politique active sous forme de carte : nom, **Jours fixes par an** / **S'accumule à chaque paie** / **Indemnité de vacances (% du brut)**, le droit, **report** et son plafond, une pastille **non payé** ou **approuvé automatiquement**, **Modifier** et une icône de retrait.",
            "**Retirées** — les politiques retirées après avoir servi, listées comme **non réservable** avec leur nombre de demandes passées.",
            "**Fin d'année** — affiché dès qu'une politique existe : **Reporter les soldes de … à …** pour l'an dernier vers celui-ci.",
          ] },
          { figure: "live:app-settings-leave", caption: "Paramètres → Politiques de congés — l'ensemble de départ Canada d'abord, les deux autres en dessous, puis Politiques avec Ajouter une politique." },
        ],
      },
      {
        id: "add-a-policy",
        heading: "Comment ajouter une politique",
        blocks: [
          { steps: [
            "Ouvrez **Paramètres → Politiques de congés**.",
            "Pour partir d'un ensemble, appuyez sur la carte de votre pays. FieldQuo ajoute ses politiques et vous dit combien, en sautant celles qui existent déjà sous le même nom.",
            "Pour écrire la vôtre, appuyez sur **Ajouter une politique**. Donnez-lui un **Nom** et un **Type** — Vacances, Maladie, Personnel, Non payé, Autre.",
            "Choisissez **Comment elle s'accumule** : **Jours fixes par an** (tout le droit disponible dès maintenant), **S'accumule à chaque paie** (gagné graduellement, donc plus bas en janvier) ou **Indemnité de vacances (% du brut)** (de l'argent, pas des jours — le modèle canadien de 4 %). Saisissez **Jours par an** ou **Pourcentage du brut**.",
            "Réglez le **Plafond de report (jours)** — **Vide signifie illimité. 0 signifie « à prendre ou à perdre ».** — et cochez **Payé** et **Nécessite l'approbation d'un gestionnaire** selon le cas.",
            "Appuyez sur **Ajouter une politique** (ou **Enregistrer les modifications** sur une politique existante). Les soldes sont accumulés pour chaque travailleur sur-le-champ.",
          ] },
          { note: "Retirer une politique qui a déjà servi ne la supprime pas : elle est retirée, garde son historique, et ne peut plus être réservée. Une politique jamais utilisée est supprimée entièrement. La boîte de confirmation dit lequel des deux se produira." },
        ],
      },
      {
        id: "what-each-field-changes",
        heading: "Ce que change chaque champ",
        blocks: [
          { table: {
            head: ["Champ", "Ce qu'il fait"],
            rows: [
              ["Type", "La façon dont la demande est étiquetée et regroupée dans Congés. Il ne change pas le calcul."],
              ["Jours fixes par an", "La totalité des **Jours par an** est disponible dès le début de l'année."],
              ["S'accumule à chaque paie", "Les mêmes **Jours par an**, gagnés une tranche à la fois au rythme de la paie — une demande en janvier peut être refusée pour solde insuffisant."],
              ["Indemnité de vacances (% du brut)", "Accumule de l'argent à chaque exécution de la paie au lieu de jours; les congés sous cette politique ne sont pas limités par un solde de jours."],
              ["Plafond de report (jours)", "Combien de jours inutilisés survivent au report de fin d'année. Vide, c'est illimité; 0 les efface."],
              ["Payé", "Décochée, la politique ne tient aucun solde de jours — un congé non payé est toujours permis et simplement enregistré — et les jours ne sont pas payés par la paie."],
              ["Nécessite l'approbation d'un gestionnaire", "Cochée, une demande attend en suspens l'approbation d'un gestionnaire. Décochée, elle est approuvée dès qu'elle est faite et le journal dit **approuvé automatiquement**."],
            ],
          } },
        ],
      },
      {
        id: "year-end",
        heading: "Fin d'année",
        blocks: [
          { p: "Les soldes ne se reportent pas d'eux-mêmes. Quand vous considérez l'an dernier comme clos, appuyez sur **Reporter les soldes de … à …** : les jours inutilisés passent dans la nouvelle année, plafonnés par la limite de report de chaque politique, et la page indique combien de soldes elle a touchés — ou **Rien n'était admissible au report.**" },
          { tip: "Lancez-le une fois, après l'approbation de la dernière demande de l'ancienne année. Le relancer ne trouve rien d'admissible et ne change rien." },
        ],
      },
      {
        id: "who-can-see-it",
        heading: "Qui peut le voir",
        blocks: [
          { p: "Le propriétaire et les administrateurs seulement. La ligne n'est dessinée pour personne d'autre, et la route répond **Only an owner or admin can manage leave policies.** (un refus du serveur, en anglais) à tout autre membre. Les demandes et les soldes d'une personne sont sur son écran **Congés**, que cette règle ne touche pas — voir [[time-off-policies|Politiques de congés]] sous Équipe et accès pour le côté des demandes." },
        ],
      },
    ],
    faq: [
      { q: "Charger l'ensemble Canada me rend-il conforme?", a: "Non. Les ensembles sont des points de départ courants avec l'année de leurs chiffres, pas des conseils de conformité. Les minimums augmentent avec les années de service dans plusieurs provinces; ajustez par personne." },
      { q: "Quelle est la différence entre Jours fixes et S'accumule à chaque paie?", a: "Le même nombre annuel, disponible d'un coup ou gagné graduellement. Avec l'accumulation, quelqu'un qui demande deux semaines en janvier ne les a peut-être pas encore gagnées." },
      { q: "Une politique que j'ai retirée apparaît encore sous Retirées. Pourquoi?", a: "Elle avait des demandes. FieldQuo garde l'historique et arrête les nouvelles réservations plutôt que de supprimer une fiche vers laquelle pointent des demandes passées." },
    ],
  },

  "settings-booking-page": {
    title: "Page de rendez-vous",
    summary:
      "Tout ce qu'il y a derrière le calendrier de réservation public : le code d'intégration, comment les clients peuvent vous rencontrer, la vérification du temps de route et la marge, la plage d'arrivée, la durée par défaut d'une visite, la politique de modification et d'annulation, et les types de rendez-vous avec leurs frais.",
    updated: "2026-09-12",
    intro: [
      "**Page de rendez-vous** configure ce qu'un propriétaire voit quand il réserve une visite depuis votre site web, votre lien de profil ou l'adresse de réservation elle-même. Le sous-titre se lit **Types de rendez-vous que les clients peuvent réserver directement depuis votre page publique.**, et la page va du code qui place le calendrier sur votre site jusqu'à une carte par type de rendez-vous.",
      "Deux règles la façonnent. Les heures offertes viennent des heures réservables de chaque personne, pas d'ici; cette page décide comment ces heures sont filtrées, décrites et facturées. Et chaque contrôle s'enregistre dès que vous le changez — il n'y a pas de bouton d'enregistrement pour toute la page.",
    ],
    sections: [
      {
        id: "overview",
        heading: "Vue d'ensemble",
        blocks: [
          { p: "La page ne se charge que si la fiche de l'entreprise répond; sinon, elle refuse plutôt que d'afficher des valeurs par défaut inventées, parce que la dernière carte imprime vos conditions d'annulation sous forme de phrase et qu'une phrase fausse sur votre propre politique est pire qu'aucune. Ce que les clients voient de l'autre côté est décrit dans [[the-booking-page|La page de rendez-vous]]." },
        ],
      },
      {
        id: "what-is-on-the-screen",
        heading: "Ce qu'il y a à l'écran",
        blocks: [
          { p: "De haut en bas, avec **Nouveau type de rendez-vous** en haut à droite :" },
          { table: {
            head: ["Carte", "Ce qu'elle contient"],
            rows: [
              ["Ajoutez votre calendrier de réservation à votre site web", "L'extrait de code d'intégration et **Copier le code**. Un élément HTML ordinaire qui fonctionne sur Wix, Squarespace, WordPress et les pages écrites à la main — voir [[embed-booking-and-quote-forms|Intégrer les formulaires de rendez-vous et de soumission]]."],
              ["Combien de temps dure une visite?", "**Comment les clients peuvent-ils vous rencontrer?** (Se rendre chez eux · Appel téléphonique · Appel vidéo), **N'offrez pas d'heures où vous ne pouvez pas vous rendre** avec **Temps supplémentaire entre les chantiers** (Aucun à 60 min), **Que promettez-vous au client?** (Heure exacte, ± 15, ± 30, ± 60 min) avec une ligne d'aperçu, et la durée par défaut de 15 à 180 min."],
              ["Modifications et annulations", "**Préavis nécessaire pour modifier ou annuler** en heures, **Rembourser les frais de visite en cas d’annulation à temps** (désactivé par défaut), **Préavis nécessaire pour être remboursé**, et deux phrases énonçant la politique telle qu'un client la lira."],
              ["Une carte par type de rendez-vous", "Nom et lieu, **Durée**, une case **Actif**, **Frais de visite** (vide signifie **Gratuit**), et pour des frais, **Prix promo** avec **Promo activée**. Des frais sans Stripe connecté affichent **Connectez Stripe pour percevoir ces frais — configurez-le dans Paiements**."],
              ["Formulaire Nouveau type de rendez-vous", "**Nom (p. ex. consultation à domicile)**, **Minutes**, **Marge avant**, **Marge après**, **Lieu (facultatif)**, **Créer**."],
            ],
          } },
          { figure: "live:app-settings-booking-page", caption: "Paramètres → Page de rendez-vous — le code d'intégration, la carte Combien de temps dure une visite? avec les modes de rencontre, la vérification du déplacement et la plage d'arrivée, puis Modifications et annulations." },
        ],
      },
      {
        id: "add-an-event-type",
        heading: "Comment ajouter un type de rendez-vous",
        blocks: [
          { steps: [
            "Ouvrez **Paramètres → Page de rendez-vous** et appuyez sur **Nouveau type de rendez-vous**.",
            "Tapez un **Nom** que le client comprendra — « Consultation à domicile », « Visite de mesure » — la durée en **Minutes**, une **Marge avant** et une **Marge après** en minutes s'il y a lieu, et un **Lieu** facultatif. Appuyez sur **Créer**.",
            "Sur la nouvelle carte, réglez des **Frais de visite** si réserver la plage doit coûter quelque chose; laissez vide pour **Gratuit**. Le montant est dans votre devise de facturation et s'enregistre quand vous quittez la case.",
            "Pour des frais, saisissez au besoin un **Prix promo** et cochez **Promo activée** pour l'offrir au prix réduit pour l'instant.",
            "Laissez **Actif** coché. Décochez-le pour retirer le type de la page publique sans le supprimer.",
          ] },
          { note: "Sans type de rendez-vous, la page dit **Aucun type de rendez-vous pour l'instant — les clients ne peuvent rien réserver tant que vous n'en ajoutez pas un.** — et le calendrier public n'a rien à offrir. Les frais de visite sont perçus par votre propre compte Stripe; voir [[booking-fees-and-visit-deposits|Frais de réservation et dépôts de visite]]." },
        ],
      },
      {
        id: "what-each-control-changes",
        heading: "Ce que change chaque contrôle",
        blocks: [
          { bullets: [
            "**Comment les clients peuvent-ils vous rencontrer?** — choisissez tout ce que vous offrez. Avec un seul mode, on ne pose pas la question au client; avec deux ou plus, il choisit au moment de réserver. Seule une visite demande une adresse et reçoit une plage d'arrivée.",
            "**N'offrez pas d'heures où vous ne pouvez pas vous rendre** — activé, l'adresse du client est géocodée et les plages que vous ne pourriez pas atteindre à temps depuis le chantier précédent sont masquées. Désactivé, chaque plage réservable est offerte quelle que soit la distance.",
            "**Temps supplémentaire entre les chantiers** — des minutes ajoutées au temps de route pour le stationnement, le déchargement et la rédaction. Commence à **Aucun** parce que deviner à votre place retire des plages que vous n'avez jamais accepté d'abandonner.",
            "**Que promettez-vous au client?** — **Heure exacte**, ou une plage de ± 15, 30 ou 60 minutes. Votre propre horaire garde l'heure exacte dans tous les cas; seul ce qu'on dit au client change, et la ligne d'aperçu le montre (« entre 1:30 et 2:30 PM »). Voir [[arrival-windows-and-travel-buffer|Plages d'arrivée et marge de déplacement]].",
            "**Combien de temps dure une visite?** — la durée de toute consultation que FieldQuo crée automatiquement quand quelqu'un ajoute ses disponibilités, et la valeur par défaut du formulaire de nouveau type. Les réservations existantes gardent la durée avec laquelle elles ont été faites.",
            "**Préavis nécessaire pour modifier ou annuler** — à l'intérieur de ce nombre d'heures, le client ne peut plus déplacer ni annuler la visite lui-même et doit vous téléphoner. Vide se lit comme 24, jamais 0.",
            "**Rembourser les frais de visite en cas d’annulation à temps** — désactivé, des frais payés vous restent quoi qu'il arrive; activé, ils sont remboursés pour une annulation faite avec assez de préavis. **Préavis nécessaire pour être remboursé** peut être plus long que le préavis de modification, et vide signifie le même préavis.",
            "**Durée**, **Actif**, **Frais de visite**, **Prix promo**, **Promo activée** sur chaque type de rendez-vous — changent le type à partir de maintenant; les réservations déjà faites gardent leur durée et le prix auquel elles ont été faites.",
          ] },
          { warning: "Un préavis de remboursement plus court que le préavis de modification signifie que chaque annulation qu'un client peut encore faire lui-même rembourse aussi les frais; la page le dit en ambre. Réglez le préavis de remboursement égal ou plus long si vous voulez une fenêtre où il peut annuler mais où les frais vous restent." },
        ],
      },
      {
        id: "who-can-see-it",
        heading: "Qui peut le voir",
        blocks: [
          { p: "La ligne exige la capacité de gestion des utilisateurs : le propriétaire, les administrateurs, les Gestionnaires et les Répartiteurs. Toute autre personne reçoit un panneau de refus d'accès plutôt qu'un formulaire, parce que rien ici n'est une information dont un équipier a besoin — ses propres heures réservables sont sur **Disponibilités**, qui lui reste visible. Chaque écriture est refusée sur le serveur aux mêmes personnes." },
        ],
      },
    ],
    faq: [
      { q: "D'où viennent les heures qu'un client peut choisir?", a: "Des Heures réservables de chaque membre de l'équipe sur Disponibilités, filtrées par la vérification du temps de route, la marge et la durée du type de rendez-vous de cette page. Pas d'heures réservables, pas de plages." },
      { q: "Puis-je facturer des frais de visite sans Stripe?", a: "Non. Les frais sont perçus par votre compte Stripe connecté; tant que les paiements ne sont pas activés, la carte affiche Connectez Stripe pour percevoir ces frais et les frais ne sont pas prélevés." },
      { q: "La plage d'arrivée déplace-t-elle mon rendez-vous?", a: "Non. Votre horaire garde l'heure exacte. La plage ne change que ce qu'on dit au client — « entre 1:30 et 2:30 PM » au lieu de 2:00 PM." },
      { q: "Qu'arrive-t-il aux frais de visite quand un client annule?", a: "Rien, sauf si vous avez activé Rembourser les frais de visite en cas d’annulation à temps — ils sont alors remboursés quand l'annulation respecte le préavis de remboursement. L'annulation elle-même passe dans tous les cas." },
    ],
  },
};
