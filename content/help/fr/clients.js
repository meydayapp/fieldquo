// content/help/fr/clients.js
//
// Articles de la catégorie « clients » en français. Indexés par slug ; les
// slugs sont ceux de lib/help/tree.js et scripts/check-help-centre.mjs refuse
// un module auquel il en manque un ou qui en porte un que l'arbre n'a pas.
//
// Même structure que content/help/en/clients.js (mêmes sections, mêmes blocs,
// mêmes figures) ; les mots à l'écran viennent du bloc `fr` de
// app/i18n/appMessages.js.
export const ARTICLES = {
  "the-clients-list": {
    title: "La liste des clients",
    summary:
      "Chaque client de votre entreprise, en fiche avec ses coordonnées et le compte de ses soumissions et factures — et les deux boutons qui en ajoutent.",
    updated: "2026-09-12",
    intro: [
      "**Clients** est le carnet de clientèle de l'entreprise. Chaque particulier que vous avez soumissionné et chaque entreprise qui vous engage y est une fiche, et ouvrir une fiche mène aux soumissions, chantiers, factures et équipements de ce client au même endroit. La page se trouve dans le groupe **Personnel** de la barre latérale, juste au-dessus de **Équipement client**.",
      "La liste est volontairement simple : une boîte de recherche, les fiches et deux boutons. Pas de filtres, pas d'étiquettes, pas d'actions groupées — le travail se fait sur la fiche du client, pas dans la liste.",
    ],
    sections: [
      {
        id: "overview",
        heading: "Vue d'ensemble",
        blocks: [
          { p: "La page s'ouvre sur le titre **Clients** et un compte — « 3 clients au total. » — puis la boîte de recherche et les fiches, du client le plus récent au plus ancien. Le compte n'est imprimé qu'une fois la réponse du serveur reçue ; pendant le chargement, ou si la liste n'a pas pu être chargée, aucun nombre n'est affiché plutôt qu'un « 0 » trompeur." },
          { p: "Deux boutons se trouvent en haut à droite pour quiconque peut ajouter des clients : **Importer** charge un CSV depuis l'outil que vous utilisiez avant (voir [[import-clients-from-a-csv|Importer des clients depuis un CSV]]) et **Nouveau client** ouvre le formulaire décrit dans [[add-a-client|Ajouter un client]]. Si vous ne les voyez pas, votre niveau d'accès ne permet pas d'ajouter des clients — voir plus bas." },
        ],
      },
      {
        id: "on-the-screen",
        heading: "Ce qu'il y a à l'écran",
        blocks: [
          { bullets: [
            "**Rechercher un client...** — filtre les fiches au fur et à mesure que vous tapez, sur le nom, le courriel ou le numéro de téléphone. La recherche porte sur ce qui est déjà chargé, donc elle est instantanée.",
            "Une **fiche par client** : le nom, une étiquette **Entreprise** quand le client est une entreprise, puis soit la personne-ressource (pour une entreprise), soit le courriel (pour un particulier).",
            "Le **numéro de téléphone** et la **ville et la province** — ou l'adresse civique quand aucune ville n'est consignée — chacun avec une petite icône.",
            "Un pied de fiche qui compte les **soumissions** et les **factures** de ce client, par exemple « 3 soumissions · 1 facture ». Les chantiers ne sont pas comptés sur la fiche ; ils sont listés dans le dossier.",
            "Une **flèche** sur chaque fiche : toute la fiche est un lien vers le dossier du client.",
            "Quand rien ne correspond à votre recherche, la page dit **Aucun client ne correspond à votre recherche.** ; sans aucun client, elle dit **Aucun client pour l'instant.** et propose **Ajoutez votre premier client**.",
          ] },
        ],
      },
      {
        id: "find-a-client",
        heading: "Comment trouver un client",
        blocks: [
          { steps: [
            "Ouvrez **Clients** dans le groupe **Personnel** de la barre latérale.",
            "Tapez une partie du nom, du courriel ou du numéro de téléphone dans **Rechercher un client...**. Les fiches se restreignent au fur et à mesure.",
            "Appuyez sur la fiche. Le dossier du client s'ouvre avec ses coordonnées, ses soumissions, ses chantiers, ses factures et ses équipements.",
          ] },
          { figure: "live:app-clients", caption: "Clients — le compte, la boîte de recherche et une fiche avec son courriel, son téléphone, sa ville et le compte de ses soumissions et factures." },
          { tip: "Chercher par numéro de téléphone est le moyen le plus rapide de retrouver quelqu'un qui vous rappelle. La recherche compare le numéro tel qu'il est écrit dans le dossier, alors tapez-le avec les mêmes tirets — « 238-7263 » trouve « 819-238-7263 »." },
        ],
      },
      {
        id: "what-each-card-shows",
        heading: "Ce que veut dire chaque partie d'une fiche",
        blocks: [
          { table: {
            head: ["Sur la fiche", "D'où ça vient"],
            rows: [
              ["Le nom", "Le nom du client, ou le nom de l'entreprise pour une entreprise."],
              ["Étiquette **Entreprise**", "Le client a été créé comme **Entreprise / Entrepreneur** plutôt que **Particulier**. Voir [[business-clients-and-contacts|Les clients entreprises et leur personne-ressource]]."],
              ["Deuxième ligne", "La personne-ressource pour une entreprise ; le courriel pour un particulier. Vide quand ni l'un ni l'autre n'est au dossier."],
              ["Ville, Province", "La ville et la province du dossier, séparées par une virgule. Si le dossier a une adresse mais pas de ville, l'adresse civique est affichée à la place."],
              ["« N soumissions · N factures »", "Compté en direct à partir des soumissions et factures liées à ce client. Zéro s'affiche « 0 soumission »."],
            ],
          } },
        ],
      },
      {
        id: "who-can-see-it",
        heading: "Qui peut la voir",
        blocks: [
          { p: "La ligne **Clients** apparaît dans la barre latérale pour quiconque a la permission **Clients and Properties** au moins au niveau **View full client and property info**. Les profils Estimateur, Répartiteur et Gestionnaire l'ont tous ; le profil Équipe (**View client name and address only**) ne l'a pas, de sorte qu'un membre de l'équipe n'obtient pas la liste de clientèle, seulement le nom et l'adresse des chantiers où il est affecté." },
          { bullets: [
            "**View full client and property info** — voit la liste et chaque fiche, ne peut ni ajouter ni modifier.",
            "**View and edit full client and property info** — voit aussi **Importer** et **Nouveau client**. C'est le niveau de l'Estimateur et du Répartiteur.",
            "**View, edit, and delete full client and property info** — le niveau du Gestionnaire. La suppression n'est offerte ni dans cette liste ni dans le dossier ; voir la FAQ.",
            "Le serveur vérifie la même permission à chaque requête, donc un signet vers le formulaire de nouveau client ne contourne pas un bouton absent.",
          ] },
        ],
      },
    ],
    faq: [
      { q: "Puis-je trier ou filtrer la liste?", a: "Non. Les fiches sont toujours du plus récent au plus ancien, et le seul moyen de restreindre est la boîte de recherche. Cherchez par nom, courriel ou téléphone." },
      { q: "Pourquoi une fiche affiche-t-elle 0 soumission alors que j'ai soumissionné cette personne?", a: "La soumission est liée à un autre dossier client — habituellement un doublon créé à partir d'un prospect ou d'une importation. Ouvrez les deux dossiers et voyez [[duplicate-clients|Les clients en double]]." },
      { q: "Comment supprimer un client?", a: "Il n'y a pas de bouton de suppression dans la liste ni dans le dossier aujourd'hui. Un client qui a une soumission ou une facture ne peut jamais être supprimé, parce que ces documents seraient orphelins. Si vous avez un client sans rien d'attaché dont vous devez vous débarrasser, demandez au soutien." },
    ],
  },

  "add-a-client": {
    title: "Ajouter un client",
    summary:
      "Le formulaire Nouveau client champ par champ — type de client, coordonnées, adresse, pays, langue et notes — et les autres endroits où un client est créé.",
    updated: "2026-09-12",
    intro: [
      "Un dossier client, c'est ce à quoi une soumission, un chantier et une facture sont rattachés. Vous pouvez en créer un seul depuis la liste des clients, ou sur-le-champ pendant que vous rédigez une soumission. Dans les deux cas, les mêmes champs sont enregistrés et la même permission est vérifiée.",
    ],
    sections: [
      {
        id: "overview",
        heading: "Vue d'ensemble",
        blocks: [
          { p: "**Nouveau client** est un seul formulaire. Seul le nom est obligatoire ; tout le reste peut être rempli plus tard depuis le dossier du client. Deux choix du formulaire valent la peine d'être bien faits du premier coup : le **Type de client**, qui décide si l'adresse est l'endroit où se font les travaux, et la **Language for their documents**, qui décide la langue de chaque soumission, facture et courriel que ce client recevra." },
        ],
      },
      {
        id: "how-to",
        heading: "Comment ajouter un client",
        blocks: [
          { steps: [
            "Ouvrez **Clients** et appuyez sur **Nouveau client** (ou appuyez sur **Créer** en haut de la barre latérale et choisissez **Client**).",
            "Choisissez le **Type de client** : **Particulier** pour une personne dont les travaux ont lieu à son adresse, ou **Entreprise / Entrepreneur** pour une entreprise dont les chantiers varient. Une entreprise a un champ **Personne-ressource** en plus.",
            "Tapez le **Nom** (ou le **Nom de l'entreprise**). C'est le seul champ obligatoire — le formulaire refuse d'enregistrer sans lui.",
            "Ajoutez le **Téléphone** et le **Courriel**. Le courriel est vérifié à l'enregistrement : une adresse qui ne peut pas recevoir de courrier est refusée en nommant le problème, parce que chaque soumission et chaque facture y seront envoyées.",
            "Commencez à taper dans **Adresse** et choisissez la suggestion. En choisir une remplit la **Ville**, la **Province** et le **Pays** pour vous ; tapée à la main, remplissez-les vous-même.",
            "Réglez la **Language for their documents** et les **Notes** s'il y a lieu, puis appuyez sur **Créer le client**. Le nouveau dossier s'ouvre aussitôt.",
          ] },
          { figure: "create:app-clients-create", caption: "Nouveau client — le choix du type de client, les champs de coordonnées, l'adresse avec sa ville, sa province et son pays, le sélecteur de langue et la boîte de notes." },
          { note: "Le champ **Pays** commence à **Non défini**, et FieldQuo ne le devine pas à partir du pays de votre propre entreprise. C'est sur lui que repose la recherche de taxe de vente — « ON » peut être l'Ontario ou une faute de frappe — donc un client sans pays retombe sur le taux de taxe par défaut de votre entreprise tant que personne ne l'a réglé. Choisir l'adresse dans les suggestions le règle automatiquement." },
        ],
      },
      {
        id: "fields",
        heading: "Ce que fait chaque champ",
        blocks: [
          { table: {
            head: ["Champ", "Ce qu'il change"],
            rows: [
              ["**Type de client**", "**Particulier** : l'adresse est le chantier. **Entreprise / Entrepreneur** : l'adresse est leur bureau et chaque chantier porte sa propre **Adresse du chantier**. Ajoute aussi l'étiquette **Entreprise** dans la liste."],
              ["**Nom** / **Nom de l'entreprise**", "Obligatoire. Imprimé sur chaque soumission, facture et courriel."],
              ["**Personne-ressource**", "Clients entreprises seulement — la personne avec qui vous traitez là-bas. Affichée sous le nom de l'entreprise dans la liste et dans le dossier."],
              ["**Téléphone**", "Mis en forme pendant la saisie. Utilisé pour les textos de rappel de rendez-vous et « en route », et pour composer d'un tap dans la liste d'appels des équipements."],
              ["**Courriel**", "Là où sont envoyés les soumissions, les factures, le lien du portail et les demandes d'avis. Validé à l'enregistrement ; laissez-le vide pour un client qui n'est qu'un numéro de téléphone."],
              ["**Adresse**, **Ville**, **Province**", "Affichées sur la fiche et dans le dossier. Pour un particulier, c'est là que va l'équipe."],
              ["**Pays**", "Alimente la recherche de taxe de vente avec la province. Voir [[sales-tax-on-invoices|La taxe de vente sur les factures]]."],
              ["**Language for their documents**", "La langue de chaque document et courriel destiné à ce client. **Company default** suit le réglage de votre entreprise. Voir [[a-clients-language|La langue d'un client]]."],
              ["**Notes**", "Texte libre pour votre équipe seulement — jamais imprimé sur un document. Voir [[client-notes|Les notes sur un client]]."],
            ],
          } },
        ],
      },
      {
        id: "other-ways",
        heading: "Les autres endroits où un client est créé",
        blocks: [
          { bullets: [
            "**Pendant la rédaction d'une soumission.** Le sélecteur de client du créateur de soumissions a un formulaire de nouveau client avec les mêmes champs, langue comprise, pour ne jamais quitter une soumission à moitié écrite. Voir [[build-a-quote|Bâtir une soumission]].",
            "**Quand un prospect devient une soumission.** Convertir un prospect crée le client à partir du nom, du courriel, du téléphone et de l'adresse du prospect — après avoir d'abord vérifié si un client avec ce courriel ou ce téléphone existe déjà. Voir [[convert-a-lead-to-a-quote|Convertir un prospect en soumission]].",
            "**Depuis un CSV.** **Importer** dans la liste des clients crée un client par ligne qui a un nom. Les lignes dont le courriel ne peut pas recevoir de courrier sont ignorées et comptées. Voir [[import-clients-from-a-csv|Importer des clients depuis un CSV]].",
          ] },
        ],
      },
      {
        id: "who-can-add",
        heading: "Qui peut ajouter un client",
        blocks: [
          { p: "Créer un client demande **Clients and Properties** au niveau **View and edit full client and property info** ou plus — les profils Estimateur, Répartiteur et Gestionnaire. En dessous, le bouton **Nouveau client** n'apparaît pas, et le formulaire lui-même refuse avec un panneau d'accès refusé si on y arrive par un signet. Chaque nouveau client est inscrit dans le [[the-activity-log|Journal d'activité]] avec le nom de la personne qui l'a ajouté." },
        ],
      },
    ],
    faq: [
      { q: "Le client reçoit-il un courriel quand je l'ajoute?", a: "Non. Créer un dossier n'envoie rien. La première chose qu'un client reçoit de vous est la première soumission, facture ou réservation que vous lui envoyez." },
      { q: "J'ai choisi le mauvais type de client. Puis-je le changer?", a: "Oui — appuyez sur **Modifier** dans le dossier et choisissez l'autre type. Repasser une entreprise en particulier efface la personne-ressource." },
      { q: "Pourquoi le courriel a-t-il été refusé?", a: "L'adresse ne peut pas recevoir de courrier — un domaine manquant, une faute comme un double @, ou une espace à l'intérieur. Corrigez-la ou laissez-la vide ; un courriel vide est permis." },
    ],
  },

  "the-client-record": {
    title: "Le dossier du client",
    summary:
      "Une page par client : ses coordonnées et sa langue, des boutons rapides pour une nouvelle soumission ou un nouveau chantier, ses équipements installés, et chaque soumission, chantier et facture qu'il a.",
    updated: "2026-09-12",
    intro: [
      "Appuyez sur une fiche de la liste des clients et vous arrivez dans le dossier du client. C'est la page à ouvrir quand un client appelle : qui il est, comment le joindre, ce qui est installé chez lui, et ce que vous lui avez soumissionné, planifié et facturé, chaque élément étant un lien vers le document lui-même.",
    ],
    sections: [
      {
        id: "overview",
        heading: "Vue d'ensemble",
        blocks: [
          { p: "Le dossier est en lecture seule tant que vous n'appuyez pas sur **Modifier**, qui ouvre la feuille **Modifier le client** avec les mêmes champs que le formulaire de nouveau client. Tout le reste de la page est un lien vers l'extérieur : les soumissions s'ouvrent dans le créateur de soumissions, les chantiers dans la page du chantier, les factures dans la facture. Rien n'est envoyé depuis cette page et rien ici ne modifie un document." },
        ],
      },
      {
        id: "on-the-screen",
        heading: "Ce qu'il y a à l'écran",
        blocks: [
          { bullets: [
            "**Retour aux clients**, puis le nom du client avec une étiquette **Particulier** ou **Entreprise / Entrepreneur**, et le bouton **Modifier** à droite.",
            "La **carte de coordonnées** : la personne-ressource (clients entreprises, marquée « personne-ressource »), le téléphone, le courriel, l'adresse (marquée « bureau » pour une entreprise), la langue du client — « Défaut de l'entreprise (Français) · documents et courriels » quand il suit votre défaut — et les notes, séparées par un trait.",
            "Pour une entreprise, la ligne **Les chantiers varient pour les entrepreneurs — chaque soumission ou chantier porte sa propre adresse.**",
            "**Nouvelle soumission** et **Nouveau chantier** — des actions rapides qui ouvrent le créateur avec ce client déjà choisi.",
            "**Équipement et garanties** — ce qui est installé chez ce client et si c'est encore couvert. Voir [[client-equipment-and-warranties|Les équipements du client et leurs garanties]].",
            "**Soumissions (n)**, **Chantiers (n)** et **Factures (n)** — une ligne par document, du plus récent au plus ancien : le numéro et le total de la soumission, le titre du chantier et sa pastille de statut, le numéro et le total de la facture. Chaque ligne est un lien. Une liste vide dit **Aucune soumission pour l'instant.**, **Aucun chantier pour l'instant.** ou **Aucune facture pour l'instant.**",
            "Si une ligne dit **Masqué par votre niveau d'accès**, le serveur a retiré le téléphone, le courriel, la personne-ressource et les notes avant que la page se charge — c'est une restriction, pas une donnée manquante.",
          ] },
        ],
      },
      {
        id: "edit",
        heading: "Comment modifier un client",
        blocks: [
          { steps: [
            "Appuyez sur **Modifier** en haut à droite du dossier.",
            "Changez le type, le nom, la personne-ressource, le courriel, le téléphone, l'adresse, le pays, les notes ou la langue dans la feuille **Modifier le client**. Le champ d'adresse propose des suggestions, et en choisir une remplit à nouveau la ville, la province et le pays.",
            "Appuyez sur **Enregistrer**. La feuille se ferme et le dossier se recharge avec les nouvelles valeurs.",
            "Si le courriel a été changé pour une adresse qui ne peut pas recevoir de courrier, l'enregistrement est refusé en nommant le problème ; le vider est permis.",
          ] },
          { note: "Changer le courriel ou l'adresse change l'endroit où chaque future soumission et facture de ce client est livrée. Chaque modification de ce genre est inscrite dans le [[the-activity-log|Journal d'activité]] avec le nom des champs changés, mais pas les anciennes valeurs." },
        ],
      },
      {
        id: "quick-actions",
        heading: "Nouvelle soumission et Nouveau chantier",
        blocks: [
          { p: "Les deux boutons sous la carte de coordonnées sont le chemin le plus court d'un appel téléphonique à un document. Chacun ouvre le créateur correspondant avec ce client sélectionné, de sorte que le nom, l'adresse et la langue sont déjà en place." },
          { bullets: [
            "**Nouvelle soumission** n'apparaît que si votre permission **Quotes** permet d'en créer une. La soumission adopte la langue enregistrée du client. Voir [[build-a-quote|Bâtir une soumission]].",
            "**Nouveau chantier** n'apparaît que si votre permission **Jobs** permet d'en créer un. Un chantier pour un client entreprise a son propre champ **Adresse du chantier**. Voir [[create-a-job|Créer un chantier]].",
          ] },
        ],
      },
      {
        id: "who-can-see-it",
        heading: "Qui voit quoi",
        blocks: [
          { p: "Le dossier est ajusté à votre niveau **Clients and Properties** avant de quitter le serveur, et les soumissions et factures qui s'y trouvent sont dépouillées de leurs prix pour quiconque n'a pas **See prices**." },
          { table: {
            head: ["Votre niveau", "Ce que vous obtenez"],
            rows: [
              ["**View client name and address only** (Équipe)", "Le nom, le type et l'adresse. Le téléphone, le courriel, la personne-ressource, les notes et la langue sont retirés, et la page le dit. Pas de panneau d'équipements, pas de bouton Modifier."],
              ["**View full client and property info**", "Tout le dossier et le panneau d'équipements. Pas de bouton Modifier ; Nouvelle soumission et Nouveau chantier dépendent de vos permissions Quotes et Jobs, pas de celle-ci."],
              ["**View and edit full client and property info** (Estimateur, Répartiteur)", "Modifier, plus ajouter et modifier des équipements et consigner des visites d'entretien."],
              ["**View, edit, and delete full client and property info** (Gestionnaire)", "La même chose, plus supprimer une fiche d'équipement. Supprimer le client lui-même n'est pas offert à l'écran."],
            ],
          } },
        ],
      },
    ],
    faq: [
      { q: "Où est le lien du portail client?", a: "Pas sur cette page. Le lien du portail est envoyé au client avec ses courriels de facture et de soumission ; voir [[the-client-portal|Le portail client]]." },
      { q: "Pourquoi la ligne de langue dit-elle « Défaut de l'entreprise »?", a: "Parce qu'aucune langue n'a été choisie pour ce client, donc il suit la langue par défaut de votre entreprise — et la suivra si vous la changez. Appuyez sur **Modifier** pour fixer une langue à ce client." },
      { q: "Puis-je ajouter une note d'ici?", a: "Oui — **Modifier**, puis la boîte **Notes**, puis **Enregistrer**. Les notes sont internes et jamais imprimées. Voir [[client-notes|Les notes sur un client]]." },
    ],
  },

  "business-clients-and-contacts": {
    title: "Les clients entreprises et leur personne-ressource",
    summary:
      "Ce que change le type de client Entreprise / Entrepreneur : une adresse de bureau au lieu d'un chantier, une personne-ressource nommée, et une adresse de chantier sur chaque chantier.",
    updated: "2026-09-12",
    intro: [
      "Un particulier, c'est la personne et la propriété en une seule. Un entrepreneur général, un gestionnaire immobilier ou un constructeur n'est ni l'un ni l'autre : il vous engage à bien des adresses et vous traitez avec une personne là-bas. FieldQuo sépare les deux par un seul choix sur le formulaire client, le **Type de client**, et tout ce qui suit en découle.",
      "Le type n'est pas décoratif. Il décide si l'adresse du dossier est celle où votre équipe se rend, si le dossier porte une personne-ressource, et ce que la liste et le dossier affichent.",
    ],
    sections: [
      {
        id: "overview",
        heading: "Vue d'ensemble",
        blocks: [
          { p: "Chaque client est soit **Particulier** — « Un particulier — les travaux ont lieu à son adresse » — soit **Entreprise / Entrepreneur** — « Une entreprise — les chantiers varient d'un contrat à l'autre ». Les mots sont ceux de l'écran. L'adresse d'un client entreprise s'appelle **Adresse d'affaires (facultatif)** et le formulaire dit pourquoi : « Il s'agit de leur bureau. L'adresse réelle de chaque chantier est définie sur la soumission ou le chantier. »" },
          { p: "La personne avec qui vous traitez dans cette entreprise va dans **Personne-ressource** — « Votre interlocuteur sur place ». Elle est affichée sous le nom de l'entreprise dans la liste des clients et, dans le dossier, à côté de la mention « personne-ressource ». Un particulier n'a pas ce champ, parce que le client est la personne." },
        ],
      },
      {
        id: "how-to",
        heading: "Comment créer un client comme entreprise",
        blocks: [
          { steps: [
            "Dans **Nouveau client** — ou dans **Modifier** pour un client existant — choisissez **Entreprise / Entrepreneur** sous **Type de client**.",
            "Tapez le **Nom de l'entreprise** et, dans le champ qui apparaît à côté, la **Personne-ressource**.",
            "Ajoutez au besoin l'**Adresse d'affaires (facultatif)** — leur bureau, pas un chantier — avec le téléphone et le courriel que vous utilisez pour les joindre.",
            "Appuyez sur **Créer le client** (ou **Enregistrer**). La liste affiche maintenant une étiquette **Entreprise** sur la fiche et la personne-ressource sous le nom.",
          ] },
          { figure: "create:app-clients-create", caption: "Nouveau client — le choix du type de client en haut ; choisir Entreprise / Entrepreneur ajoute le champ Personne-ressource à côté du nom." },
          { note: "L'adresse d'un client entreprise n'est jamais utilisée comme chantier. Quand vous créez un chantier pour lui, remplissez l'**Adresse du chantier** du chantier lui-même — « Rue, ville, code postal » — pour que l'équipe, la détection d'arrivée et l'historique des équipements pointent tous vers la bonne propriété. Un chantier sans adresse n'a pas d'emplacement, plutôt qu'un emplacement deviné." },
        ],
      },
      {
        id: "what-changes",
        heading: "Ce que le type change",
        blocks: [
          { table: {
            head: ["Où", "Particulier", "Entreprise / Entrepreneur"],
            rows: [
              ["Fiche dans la liste des clients", "Le courriel sous le nom", "L'étiquette **Entreprise** et la personne-ressource sous le nom"],
              ["Dossier du client", "L'adresse affichée comme la propriété", "L'adresse marquée « bureau », la personne-ressource marquée « personne-ressource », et la ligne « Les chantiers varient pour les entrepreneurs — chaque soumission ou chantier porte sa propre adresse. »"],
              ["Nouveau chantier", "L'adresse du client est l'endroit des travaux", "Chaque chantier porte sa propre **Adresse du chantier**"],
              ["Retour en arrière", "—", "Passer une entreprise à **Particulier** efface la personne-ressource"],
            ],
          } },
        ],
      },
      {
        id: "contact-person",
        heading: "La personne-ressource",
        blocks: [
          { p: "Une personne-ressource par entreprise — un seul nom, pas une liste de contacts avec leurs propres téléphones et courriels. Le téléphone et le courriel du dossier sont ceux auxquels vous joignez l'entreprise, peu importe qui répond. Si votre contact chez un constructeur change, modifiez le dossier et remplacez le nom ; les soumissions et les factures restent avec l'entreprise." },
          { tip: "Mettez la ligne directe du contact dans les **Notes** si elle diffère du numéro du dossier. Les notes sont internes et s'affichent dans le dossier pour quiconque peut voir les informations complètes du client." },
        ],
      },
    ],
    faq: [
      { q: "Une entreprise peut-elle avoir plusieurs contacts ou plusieurs sites dans son dossier?", a: "Non. Une personne-ressource et une adresse de bureau par client. Les sites vivent sur les chantiers — chaque chantier a sa propre **Adresse du chantier** — donc un seul client entreprise peut avoir des chantiers à autant de propriétés que vous voulez." },
      { q: "Le nom de la personne-ressource apparaît-il sur les soumissions et les factures?", a: "Le nom de l'entreprise est le nom du client sur chaque document. La personne-ressource s'affiche dans la liste des clients et dans le dossier ; ce n'est pas une ligne à part sur le PDF." },
      { q: "J'ai créé un constructeur comme particulier par erreur.", a: "Appuyez sur **Modifier** dans le dossier, choisissez **Entreprise / Entrepreneur**, tapez la personne-ressource et enregistrez. Les soumissions et chantiers existants restent liés." },
    ],
  },

  "client-notes": {
    title: "Les notes sur un client",
    summary:
      "Les notes en texte libre du dossier client : où les écrire, où elles apparaissent, et qui peut les lire.",
    updated: "2026-09-12",
    intro: [
      "Chaque dossier client a une boîte **Notes**. Elle sert à ce qu'un document ne peut pas porter — le code de la barrière, le chien, « toujours appeler avant 9 h », le fait que la dernière facture a demandé trois rappels. Les notes sont internes : elles ne sont jamais imprimées sur une soumission, une facture ou un courriel, et un client ne les voit jamais.",
    ],
    sections: [
      {
        id: "overview",
        heading: "Vue d'ensemble",
        blocks: [
          { p: "Les notes sur un client sont un seul champ de texte dans le dossier, pas un journal. Ce qui est dans la boîte est ce qui s'affiche ; il n'y a pas d'historique des notes précédentes, pas d'horodatage et pas d'auteur. S'il vous faut une trace datée de ce qui s'est passé, les notes du chantier et celles des visites portent une date — voir [[job-notes|Les notes sur un chantier]]." },
        ],
      },
      {
        id: "how-to",
        heading: "Comment ajouter ou changer une note",
        blocks: [
          { steps: [
            "Ouvrez le dossier du client et appuyez sur **Modifier**.",
            "Tapez dans la boîte **Notes** — sur le formulaire de nouveau client, c'est le dernier champ avant **Créer le client**.",
            "Appuyez sur **Enregistrer**. La note apparaît au bas de la carte de coordonnées, sous un trait fin.",
          ] },
        ],
      },
      {
        id: "where-they-appear",
        heading: "Où la note apparaît",
        blocks: [
          { bullets: [
            "**Dans le dossier du client**, au bas de la carte de coordonnées, pour quiconque peut voir les informations complètes du client.",
            "**Dans les tâches suggérées** — quand FieldQuo lit un chantier pour proposer une liste de vérification, les notes du client sont l'une de ses sources, avec les notes de la soumission, la portée des travaux et les notes des visites. Voir [[suggested-tasks|Les tâches suggérées]].",
            "**Nulle part où un client peut la voir.** Ni sur la soumission, ni sur la facture, ni sur le PDF, ni sur le portail, ni dans un courriel.",
            "**Pas sur la page du chantier.** Une note dont l'équipe a besoin sur place va sur le chantier ou sur la visite, pas sur le client.",
          ] },
        ],
      },
      {
        id: "who-can-see-them",
        heading: "Qui peut les lire",
        blocks: [
          { p: "Les notes voyagent avec le reste des informations complètes du client. Un membre dont le niveau **Clients and Properties** est **View client name and address only** — le profil Équipe — ne les reçoit jamais : le serveur retire les notes, le téléphone, le courriel et la personne-ressource du dossier avant de l'envoyer, et la page affiche **Masqué par votre niveau d'accès** à leur place. Tout le monde à partir de **View full client and property info** peut les lire ; les modifier demande **View and edit full client and property info**." },
          { warning: "Écrivez les notes comme si le client pouvait demander à les voir. FieldQuo les garde privées, mais la loi sur la protection des renseignements personnels au Canada donne à une personne le droit de demander ce qu'une entreprise détient à son sujet — voir [[data-and-privacy|Vos données, celles de vos clients, et la suppression]]." },
        ],
      },
    ],
    faq: [
      { q: "Puis-je voir qui a écrit une note, ou quand?", a: "Non. Le journal d'activité note qu'un client a été modifié et quels champs ont changé, mais un changement des notes seules n'y figure pas, et la note elle-même ne porte ni auteur ni date." },
      { q: "Y a-t-il aussi une note sur le chantier?", a: "Oui — les chantiers et les visites ont leurs propres notes, que l'équipe peut lire sur son téléphone. Les notes sur le client sont la vue du bureau sur la personne ; les notes du chantier portent sur les travaux. Voir [[job-notes|Les notes sur un chantier]]." },
    ],
  },

  "a-clients-language": {
    title: "La langue d'un client",
    summary:
      "La langue du dossier client commande chaque soumission, facture, courriel, page du portail, demande d'avis et texto de rappel qu'il reçoit — avec une règle pour les documents déjà écrits.",
    updated: "2026-09-12",
    intro: [
      "Deux langues comptent dans FieldQuo et elles sont distinctes : celle dans laquelle votre équipe travaille, choisie dans [[choose-your-language|Choisir votre langue]], et celle que chaque client lit. Cet article porte sur la seconde. Vous la choisissez une fois dans le dossier du client, et tout ce que vous envoyez à ce client la suit.",
      "Huit langues sont offertes pour un client : anglais, français, espagnol, ukrainien, pendjabi, tagalog, allemand et italien. Le PDF, le courriel d'accompagnement, le portail et les textos ont tous un libellé rédigé à la main dans chacune — rien n'est traduit par une machine au moment de l'envoi.",
    ],
    sections: [
      {
        id: "overview",
        heading: "Vue d'ensemble",
        blocks: [
          { p: "Le champ est **Language for their documents** sur le formulaire de nouveau client et sur la feuille de modification, avec l'indication « Les soumissions, factures et courriels sont envoyés dans cette langue. » La liste est dans le nom propre de chaque langue — un propriétaire qui lit le pendjabi se voit offrir « ਪੰਜਾਬੀ — Punjabi ». La première option, **Company default (…)**, veut dire que le client suit le réglage de votre entreprise, et continue de le suivre si vous changez ce réglage plus tard." },
        ],
      },
      {
        id: "how-to",
        heading: "Comment régler la langue d'un client",
        blocks: [
          { steps: [
            "Ouvrez le dossier du client et appuyez sur **Modifier** (ou réglez-la dans **Nouveau client** quand vous l'ajoutez).",
            "Choisissez une langue sous **Language for their documents**, ou laissez **Company default** pour suivre votre entreprise.",
            "Appuyez sur **Enregistrer**. La carte de coordonnées affiche maintenant la langue avec la mention « documents et courriels », ou « Défaut de l'entreprise (Français) » quand rien n'est réglé.",
            "Commencez la prochaine soumission. Le créateur de soumissions adopte la langue du client dès que vous le sélectionnez, et sa barre de langue vous avertit si l'un de vos services n'a pas encore de traduction dans cette langue.",
          ] },
          { figure: "create:app-clients-create", caption: "Nouveau client — Language for their documents, qui s'ouvre sur Company default (English), avec les huit langues en dessous." },
          { note: "L'étiquette **Language for their documents** et l'option **Company default** s'affichent en anglais sur chaque écran, peu importe la langue de votre application. Le reste du formulaire est traduit." },
        ],
      },
      {
        id: "what-follows-it",
        heading: "Ce qui suit la langue du client",
        blocks: [
          { bullets: [
            "**Les nouvelles soumissions et factures** — le document est rédigé dans la langue du client à sa création. Les libellés, le texte de chaque service et les conditions viennent tous des tables de traduction, jamais d'une machine au moment de l'envoi.",
            "**Le courriel d'accompagnement** d'une soumission ou d'une facture — apparié au document qu'il transporte (voir la règle plus bas).",
            "**Le portail client** et les pages publiques de soumission et de facture.",
            "**Les demandes d'avis** après un chantier, et le sondage de satisfaction à une question qu'elles contiennent.",
            "**Les textos de rappel de rendez-vous** et **en route**, et les courriels entourant une visite réservée.",
            "**Les rappels de paiement** et les factures de plans de service envoyées selon un calendrier.",
          ] },
        ],
      },
      {
        id: "precedence",
        heading: "Quelle langue l'emporte",
        blocks: [
          { p: "Chaque envoi répond à la même question dans le même ordre, de sorte qu'un client ne reçoit jamais une soumission en français avec un rappel en anglais et un suivi en espagnol :" },
          { table: {
            head: ["Ordre", "Source", "Quand ça s'applique"],
            rows: [
              ["1", "La langue propre du document", "Une soumission ou une facture garde la langue dans laquelle elle a été créée, toute sa vie, même si la langue du client est changée ensuite. Son courriel d'accompagnement s'y accorde."],
              ["2", "La langue enregistrée du client", "Tout ce qui n'est pas lié à un document précis : rappels, courriels de réservation, demandes d'avis, portail."],
              ["3", "Le défaut de l'entreprise", "Les clients réglés à **Company default**. Voir [[settings-language|Paramètres → Langue]]."],
              ["4", "L'anglais", "Quand rien de ce qui précède n'est réglé."],
            ],
          } },
          { warning: "Changer la langue d'un client ne traduit pas les soumissions qu'il a déjà. Un document signé doit continuer de dire ce qu'il disait à la signature. Pour envoyer la même soumission dans une autre langue, créez une nouvelle soumission — voir [[quote-language|La langue d'une soumission]]." },
        ],
      },
    ],
    faq: [
      { q: "Mon équipe travaille en anglais. Un client peut-il quand même recevoir une soumission en espagnol?", a: "Oui. La langue de l'application et la langue du client sont indépendantes — réglez le client à Español et rédigez la soumission comme d'habitude ; le document et son courriel partent en espagnol." },
      { q: "Pourquoi le créateur de soumissions m'a-t-il averti de traductions manquantes?", a: "Vos services ont un libellé que le client lit, et ce libellé est traduit langue par langue sous **Paramètres → Traductions**. La barre nomme ce qui manque encore pour que vous le corrigiez avant l'envoi, pas après." },
      { q: "La langue change-t-elle l'apparence de l'application pour moi?", a: "Non. Votre propre langue d'interface est la vôtre, sous **Paramètres → Langue**. La langue du client ne touche que ce que le client reçoit." },
    ],
  },

  "client-equipment-and-warranties": {
    title: "Les équipements du client et leurs garanties",
    summary:
      "Consignez la fournaise, le panneau ou les armoires que vous avez installés chez un client avec la date de garantie et l'historique d'entretien — et obtenez une liste d'appels des garanties sur le point de se terminer.",
    updated: "2026-09-12",
    intro: [
      "Un numéro de série dans une base de données ne rapporte rien. Douze ménages dont la garantie se termine en avril, avec un numéro de téléphone à côté de chacun, c'est une matinée d'appels et un mois de travail. C'est à ça que sert cette fonction : un panneau **Équipement et garanties** dans chaque dossier client, et un écran **Équipement client** dans la barre latérale qui liste ceux dont la couverture est terminée ou sur le point de l'être.",
      "Une règle traverse tout ça. Une date de garantie vide veut dire que **personne ne l'a consignée** — elle s'affiche « Garantie non consignée » et jamais comme hors garantie. Un appel de renouvellement à un client dont la couverture est en fait valide est une insulte, alors FieldQuo refuse de deviner.",
    ],
    sections: [
      {
        id: "overview",
        heading: "Vue d'ensemble",
        blocks: [
          { p: "Chaque pièce d'équipement appartient à un client et, si vous le voulez, au chantier qui l'a installée. Elle porte un nom, une marque et un modèle, un numéro de série, l'endroit où elle se trouve si ce n'est pas l'adresse principale, la date d'installation, la date jusqu'à laquelle la garantie couvre, qui couvre la garantie, des notes, et un **historique d'entretien** — chaque visite avec ce qui a été fait, la date, un lien facultatif vers un chantier, et si la visite était couverte par la garantie." },
          { p: "C'est le matériel du client, pas le vôtre. Vos propres camions et outils vivent sous **Véhicules** et dans le calcul des coûts de chantier ; la chaudière d'un propriétaire n'est jamais traitée comme un actif de votre entreprise." },
        ],
      },
      {
        id: "on-the-record",
        heading: "Ce qu'il y a dans le dossier du client",
        blocks: [
          { bullets: [
            "Le panneau **Équipement et garanties**, placé au-dessus des soumissions, chantiers et factures — lors d'un appel de service, la première question est « qu'est-ce qu'il y a dans cette maison et est-ce couvert ».",
            "Un compte des éléments, un bouton **Ajouter**, et une ligne par élément : son nom, puis la marque, le modèle et le numéro de série, puis une pastille — **Sous garantie**, **Garantie qui se termine**, **Hors garantie** ou **Garantie inconnue** — avec « Couvert jusqu'au … », « Couverture terminée le … » ou « Garantie non consignée ».",
            "Appuyez sur une ligne pour l'ouvrir : l'emplacement, les notes, l'**Historique d'entretien** (« 3 visites · 2 sous garantie », chaque visite datée avec une mention **couverte** quand ça s'appliquait), **Consigner une visite d'entretien**, **Modifier** et **Supprimer**.",
            "Un panneau vide dit « Rien de consigné ici pour l'instant. Ajoutez la fournaise, le panneau, l'appareil — tout ce que vous voudriez savoir au prochain appel. »",
            "**Garantie qui se termine** veut dire que la date tombe dans les 60 prochains jours — le temps que prennent une soumission de renouvellement, une conversation et une réservation.",
            "Le panneau n'est dessiné que pour les membres qui peuvent voir les informations complètes du client ; un membre de l'équipe limité au nom et à l'adresse n'a pas de panneau du tout, plutôt qu'un panneau vide.",
          ] },
        ],
      },
      {
        id: "add-equipment",
        heading: "Comment consigner une pièce d'équipement",
        blocks: [
          { steps: [
            "Ouvrez le dossier du client et appuyez sur **Ajouter** dans le panneau **Équipement et garanties**.",
            "Nommez-la — « Fournaise, panneau, chauffe-eau… » — et ajoutez le **Fabricant**, le **Numéro de modèle** et le **Numéro de série**. Utilisez **Où il se trouve (si ce n'est pas l'adresse principale)** pour le site d'un client entreprise ou une seconde propriété.",
            "Réglez **Installé le** et **Garantie valide jusqu'au**. Laissez la date de garantie vide si vous ne la connaissez pas : le formulaire le dit lui-même — elle s'affichera comme « non consignée », jamais comme hors garantie.",
            "Ajoutez **Qui couvre la garantie** et, si ce client a des chantiers, choisissez **Installé lors de quel travail** pour que l'équipement remonte aux travaux.",
            "Appuyez sur **Enregistrer**. La ligne apparaît avec sa pastille calculée à partir de la date.",
          ] },
          { note: "Les modifications sont envoyées en entier, champs vides compris, de sorte qu'effacer une date de garantie mal tapée l'efface vraiment. **Supprimer** demande une confirmation et retire l'élément et son historique d'entretien pour de bon." },
        ],
      },
      {
        id: "log-a-visit",
        heading: "Comment consigner une visite d'entretien",
        blocks: [
          { steps: [
            "Ouvrez l'élément et appuyez sur **Consigner une visite d'entretien**.",
            "Tapez **Ce qui a été fait** et vérifiez la date (celle du jour est préremplie). Liez-la à un chantier avec le sélecteur s'il y en a un.",
            "Cochez **Cette visite était couverte par la garantie** quand c'était le cas. C'est demandé, pas déduit du fait que vous ayez facturé ou non — une visite non facturée et une visite couverte sont deux choses différentes.",
            "Appuyez sur **Consigner**. L'historique d'entretien et son décompte « sous garantie » se mettent à jour.",
          ] },
        ],
      },
      {
        id: "the-call-list",
        heading: "La liste d'appels : Garanties qui se terminent",
        blocks: [
          { p: "**Équipement client**, dans le groupe **Personnel** de la barre latérale, ouvre **Garanties qui se terminent** — « L'équipement que vous avez installé dont la couverture est terminée ou sur le point de l'être. C'est une liste d'appels. » Elle lit tous les clients à la fois, pour que vous n'ayez jamais à ouvrir les dossiers un par un pour trouver les renouvellements." },
          { figure: "harness:client-equipment", caption: "Équipement client — les puces de période, le décompte, et une fiche par élément avec sa pastille, sa date de fin, et les boutons pour appeler d'un tap et Courriel." },
          { bullets: [
            "**Les puces de période** — de **Prochains 30 jours** à **Prochains 365 jours** ; 60 jours est sélectionné à l'arrivée. Chaque période inclut aussi les couvertures déjà terminées, les expirées d'abord, puis les plus proches.",
            "**Le décompte** — « 1 hors garantie · 2 qui se terminent bientôt · 1 sans date de garantie consignée ». Le troisième nombre est l'honnête : ces éléments ne sont pas dans la liste, et le compte vous dit qu'il y a de la saisie à faire.",
            "**Une fiche par élément** — le nom du client (un lien vers son dossier), l'équipement, son adresse, « Couverture terminée le … » ou « Couvert jusqu'au … », et un **bouton téléphone** qui compose et un bouton **Courriel** qui ouvre un message. Les boutons n'apparaissent que si la coordonnée est au dossier.",
          ] },
          { warning: "Un équipement sans date de garantie n'est jamais dans cette liste, quelle que soit la période. Si la liste paraît courte, vérifiez le troisième nombre du décompte avant de conclure que rien n'arrive à échéance." },
        ],
      },
      {
        id: "only-in-fieldquo",
        heading: "Pourquoi c'est classé « Seulement dans FieldQuo »",
        blocks: [
          { p: "Des cinq produits auxquels FieldQuo se compare sur ses pages de tarifs — Housecall Pro, ServiceTitan, Projul, Jobber et QuoteIQ — seul ServiceTitan mentionne le suivi des équipements sur sa page de tarifs, dans son palier Essentials, et aucun ne mentionne une liste d'appels de garanties. Dans FieldQuo, le panneau, l'historique d'entretien et la liste d'appels sont dans chaque forfait, et la règle voulant qu'une date vide soit inconnue plutôt qu'expirée est écrite dans le code qui calcule chaque pastille." },
        ],
      },
      {
        id: "who-can-see-it",
        heading: "Qui peut le voir",
        blocks: [
          { table: {
            head: ["Niveau Clients and Properties", "Équipements"],
            rows: [
              ["**View client name and address only** (Équipe)", "Rien — pas de panneau dans le dossier, pas de ligne **Équipement client** dans la barre latérale."],
              ["**View full client and property info**", "Voit le panneau, les historiques et la liste d'appels. Ne peut ni ajouter, ni modifier, ni consigner une visite."],
              ["**View and edit full client and property info** (Estimateur, Répartiteur)", "Ajoute et modifie des équipements et consigne des visites. Seul un Gestionnaire (**View, edit, and delete …**) peut supprimer un élément."],
            ],
          } },
        ],
      },
    ],
    faq: [
      { q: "Puis-je mettre un équipement sur un chantier plutôt que sur un client?", a: "L'équipement appartient au client. Depuis le dossier du client, vous pouvez le lier au chantier qui l'a installé, et chaque visite consignée peut aussi être liée à un chantier." },
      { q: "FieldQuo envoie-t-il un courriel au client quand la garantie se termine?", a: "Non. La liste d'appels est là pour que vous agissiez — les boutons téléphone et Courriel ouvrent un appel ou un message que vous écrivez. Rien n'est envoyé automatiquement." },
      { q: "Et si je ne connais pas la date de garantie?", a: "Laissez-la vide. L'élément affiche **Garantie inconnue** et reste hors de la liste d'appels, et le décompte le compte sous « sans date de garantie consignée » pour que vous sachiez qu'il faut demander." },
    ],
  },

  "client-consent-and-unsubscribes": {
    title: "Le consentement des clients et les désabonnements",
    summary:
      "Quels courriels portent un lien de désabonnement, lesquels n'en portent pas et pourquoi, ce qui arrive quand un client texte STOP, et où un retrait est consigné et respecté.",
    updated: "2026-09-12",
    intro: [
      "La Loi canadienne anti-pourriel (LCAP) et son équivalent américain tracent une ligne : un message qui fait la promotion de votre entreprise a besoin d'une porte de sortie fonctionnelle, en un clic ; un message qui transporte quelque chose que le client a demandé n'en a pas besoin. FieldQuo trace la même ligne dans le code. Cet article dit de quel côté tombe chaque courriel et chaque texto, et ce qu'un retrait change.",
      "Rien ici n'est un réglage à activer. C'est la façon dont chaque envoi se comporte déjà, peu importe votre forfait.",
    ],
    sections: [
      {
        id: "overview",
        heading: "Vue d'ensemble",
        blocks: [
          { p: "Un courriel est soit **commercial** — et porte un lien **Unsubscribe** dans son pied de page plus l'en-tête en un clic que les applications de courriel utilisent — soit **transactionnel**, et ne porte aucun lien, parce qu'inviter quelqu'un à couper la facture qu'il doit serait un défaut en soi. Les textos fonctionnent plutôt avec le mot-clé STOP. Un retrait sur l'un ou l'autre canal est conservé comme un enregistrement avec le libellé que la personne a vu, jamais supprimé, et vérifié avant chaque envoi ultérieur." },
        ],
      },
      {
        id: "emails",
        heading: "Quels courriels portent un lien de désabonnement",
        blocks: [
          { p: "Le pied de page dit « You're receiving this because you're a customer of … » avec un lien **Unsubscribe**, et la page qu'il ouvre dit clairement que les soumissions, factures et reçus concernant des travaux demandés continueront d'arriver — seul le courriel promotionnel s'arrête." },
          { bullets: [
            "**Commerciaux, avec le lien :** les campagnes de courriel marketing ; la demande d'avis automatique après un chantier (voir [[review-requests|Les demandes d'avis après un chantier]]) ; et une règle de suivi « chantier terminé », puisque les travaux sont finis et que c'est une relance discrétionnaire.",
            "**Transactionnels, sans lien :** une soumission ou une facture envoyée ; les suivis « nouvelle demande, personne n'a répondu », « soumission envoyée, sans réponse » et de facture en retard, qui répondent à une demande du client ou portent sur un document avec lequel il est déjà en transaction ; les confirmations de réservation et de soumission instantanée ; et le courrier de compte comme la réinitialisation de mot de passe.",
            "**Consigné au passage :** une demande d'avis est envoyée à quelqu'un qui n'a jamais été sur une liste d'envoi, alors l'envoi crée d'abord sa ligne d'abonné avec un jeton — c'est ce qui fait fonctionner le lien dans ce courriel.",
          ] },
        ],
      },
      {
        id: "the-unsubscribe-page",
        heading: "Ce que le client voit quand il se désabonne",
        blocks: [
          { steps: [
            "Le lien ouvre une page sans connexion. L'ouvrir ne change rien — une application de courriel qui précharge les liens ne peut pas désabonner quelqu'un par accident.",
            "Un seul bouton confirme : « Unsubscribe from marketing emails from … ». L'appuyer consigne le retrait avec ce libellé exact et l'heure.",
            "Si la demande n'aboutit pas — une seule barre de signal, un serveur lent — le bouton reste à l'écran et la page dit que rien n'a encore changé, pour qu'il puisse réessayer.",
          ] },
          { note: "Le retrait n'est jamais supprimé. L'enregistrement de la demande est la preuve que vous l'avez respectée, et FieldQuo le garde même si le client est retiré d'une liste plus tard." },
        ],
      },
      {
        id: "texts",
        heading: "Textos : STOP et START",
        blocks: [
          { p: "Le texto de rappel de rendez-vous par défaut se termine par « Répondez STOP pour ne plus recevoir », dans la langue du client — si vous réécrivez le libellé sous **Paramètres → Messages aux clients**, gardez cette ligne, parce que rien ne la rajoute. Le mot-clé lui-même est toujours STOP — les opérateurs le traitent comme universel. Une réponse n'est un retrait que si tout le message est le mot-clé : **STOP**, **STOPALL**, **UNSUBSCRIBE**, **CANCEL**, **END** ou **QUIT** (un point final est accepté). « Please stop by at 3 » n'est pas un retrait." },
          { bullets: [
            "**STOP** consigne un retrait SMS dès qu'il arrive. Les textos aux clients partent de la ligne partagée de FieldQuo, donc la réponse ne peut pas nommer une entreprise : elle retire le numéro de toutes les entreprises qui l'ont sur une fiche client. À partir de là, le rappel automatique et le texto « en route » sautent tous deux ce numéro.",
            "**START** ou **UNSTOP** l'annule, sur le même canal. Que le client reçoive ou non un texto de confirmation dépend de la configuration du numéro chez l'opérateur, pas d'un réglage dans FieldQuo. **YES** n'est volontairement pas une réinscription — ça veut habituellement dire « oui au rendez-vous ».",
            "Un numéro qui a refusé les **appels** se voit aussi refuser les textos, mais un START ne rétablit pas le consentement aux appels — ce retrait-là est à sens unique.",
          ] },
        ],
      },
      {
        id: "where-you-see-it",
        heading: "Où vous voyez un retrait",
        blocks: [
          { p: "Les retraits par courriel s'affichent dans **Marketing → Abonnés** comme **Désabonné** à côté de l'adresse, et le compte en haut — « 12 abonnés sur 15 au total — c'est à eux qu'une campagne d'envoi courriel s'adresse » — les exclut. Une demande d'avis vérifie la même liste avant l'envoi, et la page des paramètres d'avis le dit : « Les clients qui se sont désabonnés sont ignorés ». Voir [[email-campaigns-and-subscribers|Les campagnes courriel et les abonnés]]." },
          { note: "Il n'y a pas d'indicateur de consentement dans le dossier du client lui-même, et aucun écran ne liste les retraits SMS. Un STOP texté est respecté silencieusement par chaque texto automatisé ; si un client vous dit en personne qu'il ne veut pas de textos, la seule façon d'en être sûr est de retirer le numéro de téléphone de son dossier." },
        ],
      },
    ],
    faq: [
      { q: "Un client s'est désabonné. Recevra-t-il quand même sa facture?", a: "Oui. Les soumissions, factures, reçus, rappels concernant un document précis et confirmations de réservation sont transactionnels et toujours envoyés. Seuls les campagnes, les demandes d'avis et les suivis de chantier terminé s'arrêtent." },
      { q: "Puis-je réabonner quelqu'un depuis la page des abonnés?", a: "La page a un bouton **Se réabonner**, mais utilisez-le seulement avec le consentement exprès du client par écrit. L'enregistrement du retrait original reste au dossier de toute façon." },
      { q: "Le texto « en route » et le texto de rappel ont-ils besoin d'un consentement?", a: "Ils concernent une visite que le client a réservée, donc ils partent sans inscription distincte — mais une réponse STOP arrête les deux, immédiatement, et FieldQuo ne textera plus ce numéro avant de recevoir START." },
    ],
  },

  "review-requests": {
    title: "Les demandes d'avis après un chantier",
    summary:
      "Paramètres → Avis : votre lien d'avis, l'interrupteur Demander automatiquement, le délai Quand demander, le compte de la file en direct — et les règles exactes qui décident qui est sollicité, une fois, et qui ne l'est pas.",
    updated: "2026-09-12",
    intro: [
      "Les avis sont la plus grande source de travail entrant pour un petit entrepreneur, et en demander un est l'étape qu'on saute pendant qu'on charge le camion. **Paramètres → Avis** s'en charge : une fois un chantier marqué comme terminé, le client reçoit un court courriel de votre entreprise — votre logo, vos couleurs, votre nom — avec un bouton vers votre page d'avis. Jamais plus d'un par chantier, jamais à quelqu'un qui s'est désabonné, jamais pour des travaux vieux de plus d'un mois.",
    ],
    sections: [
      {
        id: "overview",
        heading: "Vue d'ensemble",
        blocks: [
          { p: "L'écran se trouve dans le groupe **Côté client** des paramètres. Son sous-titre dit tout : « Demandez automatiquement un avis aux clients une fois leur chantier terminé. » Deux cartes font le travail — **Votre lien d'avis** et **Demander automatiquement** avec **Quand demander** — et un panneau gris en dessous prouve que ça fonctionne en comptant la file. La moitié inférieure du même écran, **Avis sur votre site web**, est une fonction distincte : voir [[testimonials-on-your-website|Les témoignages sur votre site web]]." },
        ],
      },
      {
        id: "on-the-screen",
        heading: "Ce qu'il y a à l'écran",
        blocks: [
          { bullets: [
            "**Votre lien d'avis** — « Habituellement votre lien d'avis Google. Dans votre profil d'entreprise Google, choisissez « Demander des avis » et copiez le lien court. » Une boîte, **Enregistrer**, et une fois enregistré un lien **Ouvrez-le et vérifiez qu'il mène là où vous l'attendez**.",
            "**Demander automatiquement** — l'interrupteur. En dessous : « Chaque client ayant une adresse courriel reçoit un seul message après que son chantier est marqué comme terminé. Jamais plus d'un. » L'interrupteur est désactivé tant qu'un lien n'est pas enregistré, et le texte dit alors « Ajoutez d'abord votre lien d'avis ci-dessus. »",
            "**Quand demander** — apparaît une fois l'interrupteur allumé : **2 heures plus tard**, **4 heures plus tard**, **Le lendemain**, **Deux jours plus tard**, **Trois jours plus tard**, **Une semaine plus tard**. Le lendemain est le défaut.",
            "Le panneau de la file — « **1** client est dans la file, et **3** ont été sollicité(s) au cours des 30 derniers jours. » — lu dans les mêmes colonnes que l'expéditeur, de sorte qu'un interrupteur qui dit Activé pendant que rien ne part ne peut pas arriver en silence.",
            "Sa note de bas : « Les clients qui se sont désabonnés sont ignorés, et toute personne qui répond en signalant un problème vous joint directement plutôt que la page d'avis. »",
          ] },
        ],
      },
      {
        id: "set-up",
        heading: "Comment l'activer",
        blocks: [
          { steps: [
            "Dans votre profil d'entreprise Google, choisissez **Demander des avis** et copiez le lien court. N'importe quelle page où un avis peut être laissé fonctionne — Google, Facebook, HomeStars — pourvu qu'elle commence par https://.",
            "Ouvrez **Paramètres → Avis**, collez le lien dans **Votre lien d'avis** et appuyez sur **Enregistrer**. Un lien qui n'est pas une adresse web est refusé avec la raison.",
            "Appuyez sur **Ouvrez-le et vérifiez qu'il mène là où vous l'attendez**. C'est la page sur laquelle chaque client atterrira.",
            "Allumez **Demander automatiquement**. Il ne peut pas être allumé sans un lien valide — le serveur refuse, pas seulement le bouton.",
            "Choisissez un délai sous **Quand demander**. Chaque puce s'enregistre dès que vous l'appuyez ; **Enregistré** le confirme.",
          ] },
          { figure: "live:app-settings-reviews", caption: "Paramètres → Avis — la carte du lien d'avis, l'interrupteur Demander automatiquement avec les puces Quand demander, et le compte de la file en dessous." },
        ],
      },
      {
        id: "when-it-sends",
        heading: "Qui est sollicité, et qui ne l'est pas",
        blocks: [
          { p: "Un expéditeur tourne chaque heure, à l'heure pile, et applique ces règles à chaque chantier, dans cet ordre. Chaque refus a une raison, pour qu'un chantier non sollicité soit explicable :" },
          { table: {
            head: ["Règle", "Ce que ça veut dire"],
            rows: [
              ["Une fois, point", "Un chantier est sollicité exactement une fois. Le chantier est marqué avant que le courriel parte, donc deux exécutions qui se chevauchent ne peuvent pas demander deux fois."],
              ["Activé, avec un lien", "Les deux sont revérifiés au moment de l'envoi. Éteignez l'interrupteur et plus rien ne part."],
              ["Chantier marqué **Terminé**", "Avec une heure de fin. Un chantier terminé par une importation de travaux passés n'est jamais sollicité."],
              ["Le client a un courriel", "Pas de courriel, pas de demande. Les textos ne servent pas aux demandes d'avis."],
              ["Pas désabonné", "Un client qui s'est désabonné de vos courriels marketing est ignoré."],
              ["Le délai est écoulé", "L'heure de fin plus votre délai **Quand demander** — de 2 heures à une semaine."],
              ["Terminé dans les 30 derniers jours", "Tout ce qui est plus vieux est laissé tranquille, définitivement. Activer la fonction n'envoie pas un courriel à tous les clients que vous avez eus."],
              ["Le courriel est configuré", "Si aucun fournisseur de courriel n'est configuré, le chantier est relâché pour réessayer l'heure suivante plutôt que marqué comme sollicité."],
            ],
          } },
        ],
      },
      {
        id: "what-the-client-gets",
        heading: "Ce que le client reçoit",
        blocks: [
          { p: "Un court courriel dans la langue du client : l'objet « Comment avons-nous fait? — Votre entreprise », une phrase de remerciement, un bouton vers votre lien, cinq petits liens de notation de 1 à 5, et la phrase disant que si quelque chose n'allait pas, il vaut mieux répondre à ce courriel. Il est envoyé depuis votre propre domaine si vous en avez vérifié un, et les réponses vont à l'adresse courriel de votre entreprise. Voir [[the-review-request|La demande d'avis]] pour son apparence du côté du client." },
          { note: "Les liens de 1 à 5 présélectionnent une note sur une page à une question ; le client doit encore appuyer sur Envoyer là-bas, pour qu'un analyseur de courriel ne puisse pas voter à sa place. Les notes répondues alimentent l'indicateur de satisfaction client du tableau de bord des KPI — voir [[kpi-customer|Les KPI clients]]. Elles ne deviennent pas des témoignages." },
        ],
      },
      {
        id: "who-can-change-it",
        heading: "Qui peut le changer",
        blocks: [
          { p: "La ligne **Avis** dans les paramètres, et chaque changement qui s'y fait — le lien, l'interrupteur, le délai — demandent la permission **user:manage** : le propriétaire, un administrateur, ou un Gestionnaire ou Répartiteur. Un Estimateur ou un membre de l'équipe ne voit pas la ligne du tout. Chaque changement est inscrit dans le journal d'activité comme « Updated review request settings » ou « Turned off automatic review requests »." },
        ],
      },
    ],
    faq: [
      { q: "Puis-je solliciter un client précis à la main?", a: "Non. Il n'y a pas de bouton « demander maintenant » sur un chantier ou un client ; l'expéditeur travaille à partir des chantiers terminés et de votre délai. Pour solliciter quelqu'un vous-même, envoyez-lui votre lien d'avis depuis votre propre courriel." },
      { q: "J'ai activé la fonction et rien n'a été envoyé.", a: "Lisez le panneau de la file. Un compte de 0 dans la file veut dire qu'aucun chantier terminé avec un courriel de client dans les 30 derniers jours n'attend ; un chantier doit aussi avoir dépassé votre délai. Les chantiers importés de votre ancien système ne sont jamais sollicités." },
      { q: "Est-ce que ça texte les clients?", a: "Non — courriel seulement. Un client avec un numéro de téléphone et sans courriel est ignoré." },
      { q: "L'avis peut-il aller sur une page de mon propre site?", a: "Oui. N'importe quelle adresse https:// fonctionne, y compris votre propre formulaire de témoignages. Les avis recueillis vont ensuite dans **Avis sur votre site web** à la main." },
    ],
  },

  "testimonials-on-your-website": {
    title: "Les témoignages sur votre site web",
    summary:
      "Avis sur votre site web, sur l'écran Paramètres → Avis : ajoutez des avis un à un ou collez une liste, activez ceux à afficher, ordonnez-les, et intégrez-les sur un site que FieldQuo n'a pas bâti.",
    updated: "2026-09-12",
    intro: [
      "Les avis que vous avez déjà — sur Google, sur Facebook, dans un dossier de courriels de remerciement — valent plus sur votre propre site web que n'importe où ailleurs. La moitié inférieure de **Paramètres → Avis** est là où ils vont. Chaque avis commence désactivé ; ceux que vous activez apparaissent sur votre site web FieldQuo, les six premiers dans l'ordre que vous fixez, et dans un code d'intégration que vous pouvez coller dans n'importe quel autre site.",
    ],
    sections: [
      {
        id: "overview",
        heading: "Vue d'ensemble",
        blocks: [
          { p: "La carte s'intitule **Avis sur votre site web** — « Ceux que vous activez apparaissent sur votre site — les six premiers, dans l'ordre ci-dessous. » — et, en dessous, « Recopiez-les depuis votre fiche Google, ou d'où que vous les ayez recueillis. Les coller ici est le moyen le plus rapide de les afficher sur votre site dès aujourd'hui. » FieldQuo ne lit pas les avis Google pour vous ; vous les recopiez, et vous décidez de ce qui est affiché." },
        ],
      },
      {
        id: "on-the-screen",
        heading: "Ce qu'il y a à l'écran",
        blocks: [
          { bullets: [
            "Une ligne qui dit combien sont en ligne : « **2 affichés sur votre site.** » ou « Aucun n'est encore affiché sur votre site — activez ceux que vous voulez. » Elle compte ce que le site public affichera vraiment, plafonné à six, pas le nombre de lignes que vous avez.",
            "**Une ligne par avis** — le nom du client et son commentaire, un interrupteur **Afficher sur le site** qui dit « sur votre site » ou « non affiché », **Monter** et **Descendre**, **Modifier** et **Supprimer**.",
            "**Ajouter un avis** — **Nom du client** et **Son commentaire**, puis **Ajouter l'avis**.",
            "**Coller une liste** — une boîte pour « Un avis par bloc : le nom sur sa propre ligne, le commentaire en dessous, et une ligne vide entre chaque. Un CSV de tableur fonctionne aussi — collez-le ou choisissez un fichier. », avec **Choisir un fichier CSV** et **Importer**.",
            "**Vos avis sur votre propre site web** — le code d'intégration, pour un site que vous avez déjà.",
          ] },
        ],
      },
      {
        id: "add-or-paste",
        heading: "Comment ajouter des avis",
        blocks: [
          { steps: [
            "Ouvrez **Paramètres → Avis** et descendez jusqu'à **Avis sur votre site web**.",
            "Pour un seul avis : tapez le **Nom du client** et **Son commentaire** et appuyez sur **Ajouter l'avis**. Pour plusieurs : collez des blocs dans **Coller une liste** — le nom, puis le texte, puis une ligne vide — ou appuyez sur **Choisir un fichier CSV** avec des colonnes de nom et d'avis, puis **Importer**. Le résultat dit « 5 ajoutés, 0 mis à jour, 1 ignorés. »",
            "Les avis importés commencent désactivés. Appuyez sur **Afficher sur le site** sur chacun de ceux que vous voulez en ligne.",
            "Utilisez **Monter** et **Descendre** pour fixer l'ordre. Les six premiers avis activés sont ceux que le site affiche.",
          ] },
          { figure: "harness:settings-reviews", caption: "Paramètres → Avis — la carte Avis sur votre site web avec son compte d'avis publiés, sous les paramètres de demande d'avis." },
        ],
      },
      {
        id: "what-each-control-changes",
        heading: "Ce que change chaque commande",
        blocks: [
          { table: {
            head: ["Commande", "Ce qu'elle fait"],
            rows: [
              ["**Afficher sur le site**", "Publie l'avis sur votre site web et dans le code d'intégration. Désactivé, l'avis reste au dossier et est invisible pour le public. Le compte d'avis publiés se met à jour immédiatement."],
              ["**Monter** / **Descendre**", "Change l'ordre sur le site. Seuls les six premiers avis activés sont affichés, donc l'ordre décide lesquels passent."],
              ["**Modifier**", "Change le nom ou le texte. Les guillemets de fin et les tirets égarés sont nettoyés à l'enregistrement."],
              ["**Supprimer**", "Supprime l'avis après une confirmation. C'est irréversible ; recollez-le au besoin."],
              ["**Importer**", "Lit les blocs collés ou un CSV. Un avis identique en nom et en texte à un autre déjà au dossier est mis à jour plutôt que dupliqué ; les lignes vides ou trop courtes sont ignorées et comptées."],
            ],
          } },
        ],
      },
      {
        id: "embed",
        heading: "Sur un site web que FieldQuo n'a pas bâti",
        blocks: [
          { p: "Le bloc **Vos avis sur votre propre site web** est un iframe plus un petit script. Sa note dit ce qu'il fait : il affiche les avis que vous avez approuvés, dans vos propres couleurs, sans aucune marque FieldQuo — et tant que vous n'en avez aucun, il n'affiche rien et se réduit à une hauteur nulle, donc vous pouvez le coller avant d'en avoir. Gardez le script avec l'iframe ; c'est lui qui ajuste la hauteur. Le même bloc est offert pour le calendrier de réservation et l'estimation instantanée — voir [[embed-booking-and-quote-forms|Intégrer les formulaires de réservation et de soumission]]." },
          { tip: "Sur un site bâti par FieldQuo, les avis activés alimentent aussi la section « Ce que disent les clients » et une page Avis à part ; régénérer le site les reconstruit à partir de cette liste. Voir [[website-pages-and-blocks|Les pages et les blocs du site web]]." },
        ],
      },
      {
        id: "who-can-change-it",
        heading: "Qui peut le changer",
        blocks: [
          { p: "Ajouter, modifier, activer, ordonner, supprimer et importer des avis demandent tous la permission **user:manage** — le propriétaire, un administrateur, ou un Gestionnaire ou Répartiteur — et la ligne **Avis** des paramètres n'est affichée qu'à eux. Les avis sont affichés tels qu'ils ont été tapés ; FieldQuo ne réécrit jamais les mots d'un client." },
        ],
      },
    ],
    faq: [
      { q: "FieldQuo récupère-t-il mes avis Google automatiquement?", a: "Non. Recopiez-les depuis votre fiche Google et collez-les — la boîte de collage accepte une liste simple ou un CSV. Il n'y a pas de connexion Google pour les avis." },
      { q: "Pourquoi le compte dit-il 2 alors que j'ai 12 avis?", a: "Seuls les avis activés sont comptés, et seulement les six premiers de ceux-là. Dix des vôtres sont soit désactivés, soit au-delà de la sixième position." },
      { q: "Les notes du courriel de demande d'avis deviennent-elles des témoignages?", a: "Non. Les réponses de 1 à 5 alimentent le KPI de satisfaction et ne sont jamais publiées. Un témoignage n'est que ce que vous ajoutez ici vous-même." },
    ],
  },

  "referrals-from-clients": {
    title: "Les recommandations venant des clients",
    summary:
      "FieldQuo n'a pas de programme de recommandation pour les particuliers — pas de lien de recommandation client et pas de récompense pour un client qui vous envoie un voisin. Ce qui existe, c'est Parrainage, entre entrepreneurs, et cet article dit quoi faire d'une recommandation client en attendant.",
    updated: "2026-09-12",
    intro: [
      "Le bouche-à-oreille est la façon dont la plupart des entrepreneurs décrochent leur prochain contrat, alors il est normal de se demander si FieldQuo donne à un client un lien à partager ou un crédit quand son voisin réserve. Ce n'est pas le cas. La fonction de recommandation du produit — **Parrainage** dans la barre latérale et la page publique vers laquelle elle mène — est le programme de FieldQuo lui-même, un entrepreneur qui recommande le logiciel à un autre. Rien là-dedans n'implique un particulier.",
      "Cette page le dit clairement pour que vous n'alliez pas chercher une commande qui n'existe pas, puis couvre ce que le produit offre vraiment et comment garder la trace d'une recommandation client avec ce qui existe aujourd'hui.",
    ],
    sections: [
      {
        id: "overview",
        heading: "Ce que FieldQuo ne fait pas",
        blocks: [
          { bullets: [
            "**Pas de lien de recommandation pour un client.** Un dossier client n'a pas de code à partager ni de page « recommandez un ami ». La page publique à /refer/… s'adresse à un autre entrepreneur, pas à un particulier.",
            "**Pas de récompense pour un client.** Aucun rabais, aucun crédit, aucune visite gratuite n'est accordé à un client pour une recommandation, et aucune récompense de ce genre n'est suivie.",
            "**Pas de champ « recommandé par ».** Un dossier client ne porte pas qui l'a recommandé, et un prospect ne porte pas de client référent. La source du tableau des prospects nomme le canal — le formulaire du site, le lien de réservation, la réceptionniste, une importation — pas une personne.",
            "**Pas de courriel ni de texto de recommandation aux clients.** Rien ne demande à un client de vous recommander. La seule demande automatisée après un chantier est la demande d'avis — voir [[review-requests|Les demandes d'avis après un chantier]].",
          ] },
        ],
      },
      {
        id: "refer-and-earn",
        heading: "Ce qu'est vraiment Parrainage",
        blocks: [
          { p: "**Parrainage** — dans le groupe **Croissance** de la barre latérale et de nouveau sous **Paramètres → Compte** — sert à parler de FieldQuo à une autre entreprise. Votre entreprise a un lien de parrainage ; quand un autre entrepreneur s'inscrit par ce lien, il obtient son premier mois gratuit, et vous obtenez un mois ajouté à votre propre abonnement une fois qu'il paie vraiment. C'est un programme d'entrepreneur à entrepreneur, géré par FieldQuo, et les personnes qui voient la page sont le propriétaire et les administrateurs." },
          { figure: "live:app-settings-refer", caption: "Parrainage — votre lien de parrainage, le partage par courriel ou par texto, et les entreprises que vous avez parrainées avec l'indication de crédit pour chacune." },
          { bullets: [
            "La récompense est **un mois de chaque côté**, et le vôtre n'arrive que lorsque l'entreprise parrainée fait son premier paiement — jamais à l'inscription.",
            "Vous ne pouvez pas vous parrainer vous-même, et une entreprise qui existe déjà ne peut pas utiliser un lien.",
            "Tous les détails : [[refer-another-business|Parrainer une autre entreprise]] et [[referral-months|Les mois de parrainage]]. Ce que l'autre entrepreneur voit : [[the-referral-page|La page de parrainage]].",
          ] },
        ],
      },
      {
        id: "tracking-a-client-referral",
        heading: "Garder la trace d'une recommandation client vous-même",
        blocks: [
          { bullets: [
            "**Écrivez-le dans les notes.** Dans le dossier du nouveau client, mettez « Recommandé par Marie Tremblay » dans les **Notes**. Les notes sont internes et s'affichent dans le dossier — voir [[client-notes|Les notes sur un client]].",
            "**Consignez ce que ça vous a coûté.** Si vous remerciez un client par une carte-cadeau ou un rabais, inscrivez-le sous **Marketing → Dépenses** avec la plateforme **referral**, le montant, et les prospects et conversions que ça a rapportés. Il apparaît alors dans votre coût par prospect à côté de Facebook et de Google. Voir [[marketing-spend|Les dépenses marketing]].",
            "**Demandez plutôt des avis.** Un avis sur Google est la recommandation qui se multiplie, et celle-là, FieldQuo l'automatise — voir [[ask-for-reviews-automatically|Demander des avis automatiquement]].",
          ] },
        ],
      },
    ],
    faq: [
      { q: "Y aura-t-il un programme de recommandation pour les clients?", a: "Pas aujourd'hui, et cette page le dira tant que le produit ne le fera pas. Tout ce que vous lisez ailleurs qui promet une récompense de recommandation pour un particulier ne décrit pas FieldQuo." },
      { q: "Un client peut-il utiliser mon lien de Parrainage?", a: "Seulement s'il exploite une entreprise de services sur le terrain et s'inscrit lui-même à FieldQuo. Ça lui donne un mois gratuit du logiciel, pas quoi que ce soit sur ses travaux avec vous." },
      { q: "Puis-je voir quels clients sont venus par recommandation?", a: "Seulement ce que vous avez écrit dans les notes. Il n'y a pas de rapport des sources de recommandation par client." },
    ],
  },

  "duplicate-clients": {
    title: "Les clients en double",
    summary:
      "FieldQuo n'a pas d'outil de fusion. Voici d'où viennent les doublons, ce que le produit fait déjà pour les éviter en convertissant des prospects et en important des travaux passés, et comment repérer et nettoyer ceux que vous avez.",
    updated: "2026-09-12",
    intro: [
      "Deux dossiers pour la même personne, c'est l'état ordinaire d'une liste de clientèle passée par une importation CSV et une année de prospects. FieldQuo ne vous empêche pas de créer un second « J. Smith », et il ne peut pas fusionner deux dossiers en un ensuite. Ce qu'il fait, c'est apparier avec soin aux deux endroits où des dossiers sont créés sans qu'une personne les tape — la conversion de prospects et l'importation de travaux passés — et vous donner une recherche qui trouve les doublons pour que vous cessiez d'utiliser l'un des deux.",
    ],
    sections: [
      {
        id: "overview",
        heading: "Vue d'ensemble",
        blocks: [
          { p: "Un client n'est jamais créé que par cinq choses : le formulaire **Nouveau client**, le formulaire de nouveau client du créateur de soumissions, l'importateur CSV, la conversion d'un prospect, et l'importation de travaux passés. Les trois premiers créent ce que vous leur donnez. Les deux derniers cherchent d'abord un client existant, selon des règles différentes, parce qu'un mauvais appariement est pire qu'un doublon — une soumission rattachée au mauvais propriétaire, personne ne le remarque avant que la facture parte." },
        ],
      },
      {
        id: "no-merge",
        heading: "Il n'y a pas de fusion",
        blocks: [
          { p: "Il n'y a pas de bouton pour combiner deux dossiers clients, et pas de bouton de suppression dans un dossier. Un client qui a une soumission ou une facture ne peut jamais être supprimé, donc un doublon avec un historique reste. La réponse pratique est d'en choisir un, de continuer à l'utiliser, et de laisser l'autre tomber en désuétude — ses documents restent accessibles depuis la liste des clients." },
          { warning: "Ne « corrigez » pas un doublon en recréant des documents sur l'autre dossier. Chaque soumission, chantier et facture garde le client pour lequel il a été rédigé, et les déplacer n'est pas possible à l'écran." },
        ],
      },
      {
        id: "where-they-come-from",
        heading: "D'où viennent les doublons",
        blocks: [
          { bullets: [
            "**L'importation CSV** crée un client pour chaque ligne qui a un nom. Elle ne vérifie pas si le nom, le courriel ou le téléphone existe déjà, donc importer deux fois le même fichier double la liste. Les lignes sans nom, ou dont le courriel ne peut pas recevoir de courrier, sont ignorées et comptées.",
            "**Taper un client dans le créateur de soumissions** alors que la même personne existe déjà sous une orthographe légèrement différente. La recherche du sélecteur est votre défense — cherchez avant d'ajouter.",
            "**Une nouvelle demande avec un nouveau courriel ou un nouveau téléphone.** La conversion d'un prospect apparie d'abord sur le courriel, puis sur le téléphone ; un client qui écrit d'une nouvelle adresse et d'un nouveau numéro, sans correspondance, devient un second dossier.",
            "**Entreprise contre personne.** « Rénovations Beaulieu » créée comme entreprise et « Marc Beaulieu » créé comme particulier sont deux dossiers, à dessein — l'un est l'entreprise, l'autre est la personne.",
          ] },
        ],
      },
      {
        id: "how-fieldquo-avoids-them",
        heading: "Ce que FieldQuo fait pour les éviter",
        blocks: [
          { table: {
            head: ["Où", "Comment il apparie"],
            rows: [
              ["Convertir un prospect en soumission", "Le courriel du prospect est normalisé et cherché d'abord ; puis le téléphone. Une correspondance réutilise ce client. Ce n'est qu'en l'absence des deux qu'un nouveau dossier est créé. Voir [[convert-a-lead-to-a-quote|Convertir un prospect en soumission]]."],
              ["Importer des travaux passés", "Chaque ligne est appariée sur le nom du client seul, exactement mais sans tenir compte de la casse, et l'aperçu dit « client existant » avant que rien ne soit écrit. Un courriel différent sur la ligne n'empêche pas un appariement par le nom. Deux noms identiques au dossier se résolvent vers le dossier le plus ancien. Voir [[import-past-jobs|Importer des travaux passés]]."],
              ["La revue mensuelle dans Messages", "Une conversation Facebook ou Instagram n'est liée à un client que sur un courriel ou un téléphone exact, ou un nom qui concorde aussi sur l'adresse. Un nom seul n'est jamais lié, et une égalité est signalée plutôt que tranchée. Voir [[the-monthly-review|La revue mensuelle]]."],
              ["Importer des clients depuis un CSV", "Aucun appariement. Chaque ligne avec un nom devient un client — voir plus haut."],
            ],
          } },
        ],
      },
      {
        id: "spot-and-tidy",
        heading: "Comment repérer et nettoyer les doublons",
        blocks: [
          { steps: [
            "Dans **Clients**, cherchez par **numéro de téléphone** d'abord, puis par **courriel** : ce sont les deux coordonnées qu'une personne a dû vous donner, et deux fiches pour un même numéro, c'est un doublon à coup sûr. Cherchez par nom de famille en dernier — deux fiches « Tremblay » dans une même ville sont souvent deux ménages.",
            "Ouvrez les deux dossiers. Les pieds de fiche vous disent lequel a l'historique — « 3 soumissions · 1 facture » contre « 0 soumission · 0 facture ».",
            "Gardez le dossier qui a l'historique. Recopiez ce qui est utile dans l'autre — une note, le pays, la langue — avec **Modifier**.",
            "Dans le dossier que vous retirez, mettez « DOUBLON — utiliser l'autre dossier » au début des **Notes**, et cessez de le sélectionner dans le créateur de soumissions. S'il n'a aucun document, demandez au soutien de le retirer.",
          ] },
          { tip: "Avant une importation CSV, cherchez quelques noms du fichier. S'ils sont déjà là, réduisez le fichier aux nouvelles lignes seulement — l'importateur ne le fera pas pour vous." },
        ],
      },
    ],
    faq: [
      { q: "FieldQuo m'avertira-t-il quand j'ajoute un client qui existe déjà?", a: "Non. Ni le formulaire Nouveau client ni le créateur de soumissions ne vérifient un nom, un courriel ou un téléphone existant. Cherchez d'abord." },
      { q: "Le soutien peut-il fusionner deux dossiers pour moi?", a: "Il n'y a pas de fusion dans le produit, pour le soutien non plus. Le soutien peut retirer un dossier qui n'a ni soumission ni facture ; un dossier avec des documents reste." },
      { q: "Importer deux fois un CSV crée-t-il des doublons?", a: "Oui, un jeu complet. L'importateur crée chaque ligne qui a un nom et n'apparie pas avec les clients existants." },
    ],
  },
};
