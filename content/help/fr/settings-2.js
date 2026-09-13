// content/help/fr/settings-2.js
//
// Partie 2 de la catégorie « settings » en français. Slugs de cette partie
// (lib/help/tree.js) : settings-work-areas, settings-products, settings-services, settings-material-costs, settings-cabinet-rates, settings-overhead, settings-custom-fields, settings-quote-email, settings-email-templates, settings-pdf-templates, settings-translations, settings-checklists.
//
// Même structure que l'anglais, article par article : mêmes slugs, mêmes
// sections dans le même ordre, mêmes blocs, mêmes figures —
// scripts/check-help-centre.mjs compare les deux. Les mots à l'écran viennent
// du bloc `fr` de app/i18n/appMessages.js. Les noms des types de soumission,
// des sections PDF et des types de modèle de courriel, ainsi que le bouton
// « Use this » des Modèles PDF, ne s'affichent qu'en anglais à l'écran et sont
// cités tels quels.
export const ARTICLES = {
  "settings-work-areas": {
    title: "Zones desservies",
    summary:
      "Nommez les zones ou les projets où votre entreprise travaille, dites qui est sur chacun, et sachez où ces noms réapparaissent : sur votre site web public et dans ce que votre réceptionniste téléphonique dit aux appelants.",
    updated: "2026-09-12",
    intro: [
      "**Paramètres → Équipe et horaires → Zones desservies** est une courte liste de zones nommées — Laval, la Rive-Nord, le projet de condos du centre-ville — avec les personnes assignées à chacune. Elle existe pour que « c'est le secteur de qui? » ait une seule réponse que tout le monde peut consulter.",
      "Les noms portent plus loin que la liste de l'équipe. Ce sont eux que le bloc **Zones desservies** de votre site web imprime, et ils font partie de ce que la réceptionniste téléphonique sait de votre entreprise. Une zone desservie est donc une déclaration publique des endroits où vous prenez des chantiers, pas seulement une étiquette interne.",
    ],
    sections: [
      {
        id: "overview",
        heading: "Vue d'ensemble",
        blocks: [
          { p: "La page a une seule case, **Nom de la nouvelle zone de travail**, avec un bouton plus à côté, puis une carte par zone. Sur chaque carte, vous voyez le nom de la zone et une puce pour chaque membre de votre équipe; une puce pleine signifie que la personne est assignée à la zone, une puce vide signifie qu'elle ne l'est pas. Toucher une puce l'inverse, et le changement est enregistré aussitôt — il n'y a pas de bouton d'enregistrement à part." },
          { figure: "live:app-settings-work-areas", caption: "Paramètres → Zones desservies — la case du nom en haut, puis une carte par zone avec une puce par membre de l'équipe." },
          { p: "Quiconque ne peut pas changer les assignations voit la même page sous forme de liste simple : l'avis **Voici les zones auxquelles vous pouvez être assigné.**, puis chaque zone avec les noms des personnes qui y sont, ou **Personne n'est encore assigné.**" },
        ],
      },
      {
        id: "add-a-work-area",
        heading: "Comment ajouter une zone et y assigner des gens",
        blocks: [
          { steps: [
            "Ouvrez **Paramètres → Zones desservies**.",
            "Tapez un nom dans **Nom de la nouvelle zone de travail** et appuyez sur le bouton plus. La carte apparaît en dessous.",
            "Touchez le nom de chaque membre de l'équipe qui travaille cette zone. Une puce pleine est une assignation; touchez-la de nouveau pour retirer la personne.",
          ] },
          { note: "Il n'y a ni renommage ni suppression sur cet écran. Une zone que vous n'utilisez plus reste dans la liste — et reste sur le bloc **Zones desservies** de votre site web — alors nommez-les avec soin et limitez la liste aux endroits que vous servez vraiment." },
        ],
      },
      {
        id: "where-the-names-go",
        heading: "Où les noms sont utilisés",
        blocks: [
          { bullets: [
            "**Votre site web.** Si votre site a le bloc **Zones desservies**, il liste vos zones sous forme de pastilles, par ordre alphabétique, jusqu'à 40. Il n'y a pas de liste de villes à taper à part — c'est la seule source, donc elle ne se périme jamais. Voir [[the-website-builder|Le constructeur de site web]].",
            "**La réceptionniste téléphonique.** Les noms des zones font partie de ce qu'on dit à la réceptionniste sur votre entreprise, pour qu'elle puisse répondre à un appelant qui demande si vous venez dans sa ville. Voir [[settings-phone-receptionist|Réceptionniste téléphonique]].",
            "**Les tâches.** Une tâche peut porter une zone dans la base de données, mais l'écran des tâches n'a pas de sélecteur de zone aujourd'hui; regrouper les tâches par zone n'est donc pas encore quelque chose que vous pouvez faire depuis l'application.",
          ] },
        ],
      },
      {
        id: "who-can-see-it",
        heading: "Qui peut le voir",
        blocks: [
          { p: "La ligne apparaît pour les propriétaires, les administrateurs et les superviseurs — les niveaux Répartiteur et Gestionnaire — parce que créer une zone et changer qui y est exige la permission **workarea:assign** que ces rôles détiennent. Un employé qui atteint la page la lit comme la liste décrite plus haut et ne peut rien changer; le serveur refuse le changement, que le bouton ait été dessiné ou non." },
        ],
      },
    ],
    faq: [
      { q: "Assigner quelqu'un à une zone change-t-il son horaire?", a: "Non. Cela note que la personne travaille cette zone. La planification se fait toujours sur le calendrier et sur chaque chantier; rien n'est assigné automatiquement à partir d'ici." },
      { q: "Pourquoi mon site web liste-t-il une zone que je ne sers plus?", a: "Parce que le bloc du site web imprime exactement cette liste et qu'il n'y a pas de suppression sur cet écran. Tant qu'il n'y en a pas, la liste de votre site est la liste d'ici." },
    ],
  },

  "settings-products": {
    title: "Produits et services (la liste de prix)",
    summary:
      "Le catalogue des articles que vous déposez sur une soumission — nom, prix de vente, coût, unité et les types de soumission auxquels il appartient — avec un import et un export CSV.",
    updated: "2026-09-12",
    intro: [
      "**Paramètres → Services et tarifs → Produits et services** est votre liste de prix : les articles ponctuels que vous ajoutez à une soumission par leur nom plutôt qu'en les tarifant à partir de zéro — des frais d'urgence, un jeu de poignées, une couche d'apprêt sur les moulures. La portée principale d'un métier (par porte, par pied carré) se tarife à partir de la grille tarifaire sous [[settings-services|Services et tarifs]]; cet écran contient tout le reste.",
      "Une ligne prise ici atterrit sur la soumission avec le prix que vous avez fixé; le chiffre que voit un propriétaire est donc le vôtre. Les pages publiques ne lisent jamais cette liste — un inconnu sur votre site web voit vos services, jamais vos tarifs.",
    ],
    sections: [
      {
        id: "overview",
        heading: "Ce qu'il y a à l'écran",
        blocks: [
          { p: "En haut : une case **Rechercher** et le bouton **Ajouter un article**. En dessous, la liste, chaque ligne montrant le nom, la description, une pastille **Service** ou **Produit** et les types de soumission auxquels elle est liée, avec une icône de modification et une de suppression. La liste est paginée — choisissez 6, 10, 25 ou 50 par page au bas — et la recherche parcourt tout le catalogue, pas seulement la page où vous êtes." },
          { figure: "live:app-settings-products", caption: "Paramètres → Produits et services — la liste avec recherche et Ajouter un article, puis les cartes Coûts, Importer et Exporter." },
          { p: "Sous la liste se trouvent trois cartes : **Coûts**, **Importer des produits et services** et **Exporter des produits et services**." },
        ],
      },
      {
        id: "add-an-item",
        heading: "Comment ajouter ou modifier un article",
        blocks: [
          { steps: [
            "Appuyez sur **Ajouter un article** (ou sur le crayon d'une ligne existante).",
            "Remplissez le nom, une description facultative, le type — **Service** ou **Produit** — et une unité comme pi² ou porte.",
            "Saisissez le **Prix unitaire** (ce que le client paie) et, si vous le connaissez, le **Prix de revient** (ce que ça vous coûte).",
            "Sous **Disponible sur ces types de soumission**, cochez les types de soumission auxquels cet article appartient. Ne cochez rien et il est offert sur tous les types de soumission.",
            "Appuyez sur **Ajouter un article** ou **Enregistrer les modifications**.",
          ] },
          { figure: "create:app-settings-products-create", caption: "Ajouter un article — nom, type, unité, prix unitaire, prix de revient et les types de soumission sur lesquels l'article est disponible." },
          { warning: "La suppression est définitive. La confirmation le dit clairement : le prix et la description sont retirés pour de bon. Les soumissions déjà rédigées conservent les montants avec lesquels elles ont été établies; supprimer un article ne change donc jamais une soumission envoyée." },
        ],
      },
      {
        id: "what-each-field-changes",
        heading: "Ce que change chaque champ",
        blocks: [
          { table: {
            head: ["Champ", "Ce qu'il fait aujourd'hui"],
            rows: [
              ["Prix unitaire", "Le tarif avec lequel la ligne atterrit quand vous ajoutez l'article à une soumission. Vous pouvez encore le changer sur cette soumission."],
              ["Prix de revient", "Conservé sur l'article et inclus dans l'export CSV. Aucune soumission, aucun calcul de coûts de chantier ni aucune marge ne le lit encore — la carte Coûts de l'écran le dit."],
              ["Unité", "Imprimée sur la ligne de la soumission (pi², porte, heure). Texte libre."],
              ["Disponible sur ces types de soumission", "Filtre où l'article est offert dans le générateur de soumissions. Aucune coche signifie partout."],
              ["Type (Service / Produit)", "Une pastille dans la liste et une colonne dans l'export. Il ne change pas la tarification."],
            ],
          } },
          { p: "Les articles d'ici apparaissent dans le tableau des lignes du générateur de soumissions pour le type de soumission correspondant, et la soumission prend le nom et la description de l'article dans sa propre langue quand une traduction existe — voir [[lines-from-your-price-book|Lignes tirées de votre liste de prix]] et [[settings-translations|Traductions]]." },
        ],
      },
      {
        id: "import-and-export",
        heading: "Import et export",
        blocks: [
          { p: "**Importer un CSV** accepte un fichier .csv exporté d'Excel, de Google Sheets ou de Numbers avec les colonnes name, description, type, unitPrice, costPrice et unit; **Télécharger un fichier exemple** vous donne un exemple d'une ligne pour partir. Les articles importés gardent la langue dans laquelle ils ont été écrits — rien n'est traduit au téléversement. **Exporter un CSV** télécharge toute la liste, prix de revient compris." },
          { tip: "**Ajouter des articles standards aux Produits et services**, sur l'écran Services et tarifs, verse dans cette liste les options habituelles d'un métier (charnières, poignées, coulisses de tiroir pour l'ébénisterie), déjà liées à ce type de soumission. Modifiez leurs prix ici ensuite." },
        ],
      },
      {
        id: "who-can-see-it",
        heading: "Qui peut le voir",
        blocks: [
          { p: "Une liste de prix, ce sont des prix; la ligne et la liste ne sont donc montrées qu'aux membres dont la grille d'accès a **showPricing** activé — les niveaux Estimateur, Répartiteur et Gestionnaire, plus les propriétaires et les administrateurs. Les Équipiers ne la voient pas. Ajouter, modifier, supprimer et importer sont refusés à quiconque n'est pas propriétaire ou administrateur." },
        ],
      },
    ],
    faq: [
      { q: "Où est-ce que je règle le tarif par porte ou par pied carré de mon métier?", a: "Sur Services et tarifs, dans la grille tarifaire du métier. Cet écran sert aux extras que vous ajoutez par-dessus." },
      { q: "Le prix de revient alimente-t-il ma marge sur une soumission?", a: "Pas encore. Il est stocké et exporté, et l'écran dit que rien ne le lit. La marge d'une soumission vient de Coût des matériaux et de Frais généraux." },
      { q: "Si je supprime un article, une vieille soumission perd-elle la ligne?", a: "Non. La soumission garde la description et le prix avec lesquels elle a été établie." },
    ],
  },

  "settings-services": {
    title: "Services et tarifs",
    summary:
      "Activez les types de soumission que vous offrez, définissez à quoi chacun se facture, personnalisez la grille tarifaire et le texte qu'un client lit pour chaque métier, et ajoutez vos propres types de soumission.",
    updated: "2026-09-12",
    intro: [
      "**Paramètres → Services et tarifs → Services et tarifs** décide de ce que votre entreprise vend et à quel tarif. Chaque type de soumission que vous activez ici devient un choix quand quelqu'un commence une nouvelle soumission; sa grille tarifaire construit les lignes de base de la soumission; son texte est ce que le client lit au-dessus des prix.",
      "Les tarifs de cet écran n'en sortent jamais. Les points d'accès publics de soumission libre et de rendez-vous renvoient vos services et leurs questions d'admission, jamais un prix — la liste qu'un concurrent peut voir est donc celle de ce que vous faites, pas de ce que vous facturez.",
    ],
    sections: [
      {
        id: "overview",
        heading: "Ce qu'il y a à l'écran",
        blocks: [
          { p: "En haut à droite, **Ajouter un type de soumission personnalisé**. Puis une case **Rechercher des services** et, si votre secteur restreint la liste, **+ Afficher les services d’autres métiers** pour voir tout le catalogue. En dessous, une carte par type de soumission avec une case à cocher pour l'activer. Un type que vous avez créé vous-même porte une pastille **Personnalisé** et liste ses champs d'admission (ou **Aucun champ — tarif forfaitaire seulement**)." },
          { figure: "live:app-settings-services", caption: "Paramètres → Services et tarifs — une carte par type de soumission; un métier activé montre à quoi il est facturé, sa grille tarifaire et son texte." },
          { p: "Un métier activé qui a une liste de prix intégrée affiche des puces **Facturé à** (par porte, par façade de tiroir, par pi²), et, là où cela s'applique, **Les tarifs varient selon la complexité choisie sur la soumission** avec les niveaux de complexité. Un métier sans liste de prix affiche plutôt une simple case **Tarif** et une unité **par**. Certains métiers affichent aussi **Une soumission instantanée est disponible pour ce service — configurez-le** ou **Les propriétaires peuvent obtenir un prix instantané pour ce service**, avec un lien vers [[settings-instant-quotes|Soumissions instantanées]], et un bouton **Ajouter des articles standards aux Produits et services**." },
        ],
      },
      {
        id: "switch-on-and-price",
        heading: "Comment activer un métier et régler ses tarifs",
        blocks: [
          { steps: [
            "Cochez la case sur la carte du métier.",
            "Pour un métier à un seul chiffre, tapez le **Tarif** et l'unité **par**. Le chiffre gris déjà dans la case est la valeur par défaut de FieldQuo; la laisser vide continue d'hériter de cette valeur.",
            "Pour un métier avec une liste de prix, ouvrez **Grille tarifaire** et ne changez que les champs que vous tarifez autrement. Un champ modifié est surligné; **Revenir à la valeur par défaut** le remet en héritage.",
            "Appuyez sur **Enregistrer les paramètres** au bas. Toutes les cartes de la page s'enregistrent ensemble.",
          ] },
          { note: "Les champs marqués **interne** dans une grille tarifaire ne s'impriment jamais pour le client — un minimum par chantier, une majoration — ils ne font que déplacer les chiffres. Vide signifie hériter, jamais zéro : vider un champ le ramène à la valeur par défaut intégrée, qui continue de s'améliorer avec le temps; taper la valeur par défaut vous fige au chiffre d'aujourd'hui." },
        ],
      },
      {
        id: "what-the-quote-says",
        heading: "Ce que dit la soumission",
        blocks: [
          { p: "Sous chaque métier activé, **Ce que dit la soumission** contient le texte que vos soumissions et vos PDF portent pour lui : **Ce qu’est ce service** (un paragraphe imprimé au-dessus des prix), **Ce qui est inclus** (une ligne par élément, **Ajouter une ligne**) et **Comment le chantier se déroule** (des étapes avec un délai facultatif, **Ajouter une étape**). N'y touchez pas et vous héritez du texte par défaut de FieldQuo pour le métier; videz un champ pour revenir à l'héritage." },
          { p: "Tout ce qui reste entre [crochets] dans le texte par défaut est retenu hors de vos soumissions tant que vous ne l'avez pas rempli — un client ne voit jamais de crochet — et le panneau nomme ce qui est retenu. Le même texte est ce que le courriel de soumission imprime; voir [[settings-quote-email|Courriel de soumission]]." },
        ],
      },
      {
        id: "custom-quote-types",
        heading: "Ajouter un type de soumission personnalisé",
        blocks: [
          { steps: [
            "Appuyez sur **Ajouter un type de soumission personnalisé**.",
            "Nommez-le (**p. ex. Organisation de garde-robe**) et cochez les champs qu'il doit demander sur une soumission, choisis parmi les champs que les autres types de soumission de FieldQuo utilisent déjà — cherchez-les avec **Rechercher des champs…**.",
            "Appuyez sur **Créer le type de soumission**. Il est créé sur-le-champ, activé, et se comporte comme un article à tarif forfaitaire si vous n'avez choisi aucun champ.",
          ] },
          { figure: "create:app-settings-services-create", caption: "Ajouter un type de soumission personnalisé — un nom et les champs d'admission que la soumission demandera." },
        ],
      },
      {
        id: "who-can-see-it",
        heading: "Qui peut le voir",
        blocks: [
          { p: "La ligne est montrée aux membres qui ont **showPricing** dans leur grille d'accès — Estimateur, Répartiteur, Gestionnaire, propriétaire, administrateur. Toute autre personne qui atteint la page voit la liste avec les tarifs retenus et l'avis **Les prix sont masqués par votre niveau d'accès. Demandez à un propriétaire ou à un administrateur si vous devez les voir.** Enregistrer, créer un type personnalisé et verser les articles standards sont refusés à quiconque n'est pas propriétaire ou administrateur." },
        ],
      },
    ],
    faq: [
      { q: "J'ai changé un tarif — mes soumissions envoyées changent-elles?", a: "Non. Une soumission est tarifée au moment où elle est construite. Les nouvelles soumissions utilisent le nouveau tarif; les existantes gardent le leur." },
      { q: "Pourquoi n'y a-t-il plus de choix forfaitaire / horaire / à l'unité?", a: "C'était un réglage que rien ne lisait, alors il a été retiré. Un métier avec une liste de prix énonce sa propre base; un métier sans liste, c'est un tarif plus une unité, tous deux utilisés quand une ligne est générée." },
      { q: "Un propriétaire peut-il voir ces tarifs?", a: "Non. Les points d'accès publics renvoient les services et les champs d'admission, jamais les prix." },
    ],
  },

  "settings-material-costs": {
    title: "Coût des matériaux",
    summary:
      "Vos vrais prix au gallon, rendements, nombres de couches et consommables pour les métiers qui se tarifent par recette, et le seuil à partir duquel un chantier terminé vous demande de les réviser.",
    updated: "2026-09-12",
    intro: [
      "**Paramètres → Services et tarifs → Coût des matériaux** contient les chiffres derrière l'estimation interne Coût et marge d'une soumission : ce qu'un gallon d'apprêt vous coûte, jusqu'où il va, combien de couches vous faites vraiment, ce que coûte un rouleau de ruban. C'est ce que vous payez, gardé à part de ce que vous facturez, et un client n'en voit jamais rien.",
      "La ligne n'existe que pour les métiers qui se tarifent ainsi. Aujourd'hui, ce sont **Refinition d'armoires** et **Peinture extérieure** : activez l'un des deux sous Services et tarifs et la ligne apparaît; sinon, la page dit **Rien à configurer ici pour l'instant.**",
    ],
    sections: [
      {
        id: "overview",
        heading: "Ce qu'il y a à l'écran",
        blocks: [
          { p: "D'abord une carte, **Quand demander la révision de vos coûts**, avec un seul chiffre et un bouton **Enregistrer**. Puis une carte de recette par métier applicable, chacune avec une pastille **Personnalisé** ou **Par défaut**, un lien **Rétablir les valeurs par défaut**, ses champs, un bloc **Consommables** et son propre **Enregistrer**." },
          { figure: "live:app-settings-material-costs", caption: "Paramètres → Coût des matériaux — le seuil de révision des coûts, puis une carte de recette par métier avec rendement, coût au gallon, nombres de couches et consommables." },
        ],
      },
      {
        id: "the-recipe",
        heading: "Ce que changent les champs de la recette",
        blocks: [
          { p: "Chaque soumission compte ses propres portes et tiroirs, ou sa propre superficie, et les passe dans ces taux : gallons requis = superficie × couches ÷ rendement; passer de 2 à 3 couches d'apprêt coûte donc 50 % de matériau de plus sans autre changement. Il n'y a nulle part de réglage petit / moyen / grand — la quantité est toujours le nombre tapé sur cette soumission." },
          { table: {
            head: ["Métier", "Champs"],
            rows: [
              ["Refinition d'armoires", "Couches d'apprêt (essences standards, et chêne/frêne/caryer/pin/thermofoil), couches de finition, rendement de l'apprêt et de la finition (pi²/gal) et coût ($/gal), durcisseur en % de la finition et son coût par pinte, heures d'installation / de démontage par chantier, heures par porte, heures de base de préparation des surfaces."],
              ["Peinture extérieure", "Cadence de production des murs (pi²/h), rendement de la peinture murale, couches par défaut, coût de la peinture de moulures, cadence de production et rendement des moulures (pi linéaires), heures d'installation — et **Coût de la peinture murale par gamme ($/gal)** pour Économique, Standard et Premium."],
            ],
          } },
          { p: "Les **Consommables** — ruban à peinture, film de masquage, papier sablé — prennent un coût par rouleau (un rouleau entier, pas par porte) et le nombre de portes et de tiroirs qu'un rouleau couvre. Sous chacun, la page calcule l'exemple d'une cuisine de 24 portes et 8 tiroirs à partir de vos propres chiffres, pour que vous puissiez vérifier un chiffre avant de l'enregistrer." },
          { warning: "**Rétablir les valeurs par défaut** supprime chaque chiffre que vous avez saisi pour ce métier et remet les chiffres de départ de FieldQuo. Il demande d'abord, parce qu'il n'y a pas d'annulation et que rien d'autre n'en garde une copie." },
        ],
      },
      {
        id: "revision-threshold",
        heading: "Quand un chantier terminé vous demande de réviser",
        blocks: [
          { p: "**Demander une révision des coûts quand un travail dépasse son estimation de plus de** est un nombre entier de 0 à 100, **15** par défaut. Quand le coût réel d'un chantier terminé dépasse d'au moins ce pourcentage ce que vous aviez soumis, la clôture affiche la comparaison et demande s'il faut mettre à jour vos taux d'après le coût réel — ou les laisser. Un chantier revenu en dessous ne demande jamais, et chaque chantier demande une seule fois. Mettez 0 pour être sollicité à tout dépassement." },
          { tip: "Les suggestions offertes par la clôture s'écrivent dans ces cartes de recette et dans la grille tarifaire de Services et tarifs — c'est pourquoi le seuil vit sur cet écran. Voir [[job-costing|Coût de revient des chantiers]]." },
        ],
      },
      {
        id: "who-can-see-it",
        heading: "Qui peut le voir",
        blocks: [
          { p: "C'est la base de coûts de l'entreprise; il faut donc à la fois la permission **user:manage** et l'interrupteur **jobCosting** : les propriétaires, les administrateurs et le niveau Gestionnaire. Un Répartiteur a le premier mais pas le second et ne voit pas la ligne. Tout ici n'alimente que l'estimation interne — voir [[cost-and-margin-on-a-quote|Coût et marge sur une soumission]]." },
        ],
      },
    ],
    faq: [
      { q: "Où est-ce que je règle la quantité de matériau d'un petit, moyen ou grand chantier?", a: "Nulle part — ce réglage n'existe pas. Chaque soumission utilise son propre nombre de portes ou sa propre superficie avec ces taux." },
      { q: "Mon métier n'est pas listé. Où sont ses coûts de matériaux?", a: "Seuls Refinition d'armoires et Peinture extérieure ont une recette aujourd'hui. Les autres métiers se tarifent à partir de leur grille tarifaire et de la liste de prix, sans estimation de matériaux." },
      { q: "Un client voit-il un jour ces chiffres?", a: "Non. Ils ne façonnent que le panneau interne Coût et marge; la soumission affiche vos prix." },
    ],
  },

  "settings-cabinet-rates": {
    title: "Tarifs des armoires",
    summary:
      "Ce que le concepteur de cuisine facture pour les armoires — au pied linéaire ou en coût majoré du matériau, niveau par niveau, avec des multiplicateurs de matériau, la finition, la livraison et la démolition.",
    updated: "2026-09-12",
    intro: [
      "**Paramètres → Services et tarifs → Tarifs des armoires** est la grille à partir de laquelle le concepteur de cuisine tarife. Chaque cuisine qu'un client dessine est tarifée sur le serveur à partir de ces chiffres; les modifier change donc ce que coûtent les nouveaux designs — et ne touche jamais une soumission déjà envoyée.",
      "L'écran est livré avec des tarifs de départ venus d'un atelier d'armoires en activité, et il le dit dans un avis ambre : **Ce sont des tarifs de départ, pas les vôtres.** Ils sont assez crédibles pour passer inaperçus, et c'est précisément pourquoi vous devriez définir les vôtres avant d'envoyer une soumission de cuisine.",
    ],
    sections: [
      {
        id: "overview",
        heading: "Ce qu'il y a à l'écran",
        blocks: [
          { p: "Quatre cartes. **Comment vous tarifez une armoire** choisit entre **Par pied linéaire** et **Coût majoré du matériau**, et la deuxième carte change avec ce choix. Puis **Multiplicateurs de matériau** et **Finition, livraison et démolition**. Au bas, **Enregistrer la tarification**, et — une fois vos propres tarifs enregistrés — **Revenir aux tarifs de départ**." },
          { figure: "live:app-settings-cabinet-rates", caption: "Paramètres → Tarifs des armoires — le mode de tarification, les niveaux au pied linéaire, les multiplicateurs de matériau et les frais de finition." },
        ],
      },
      {
        id: "the-two-modes",
        heading: "Au pied linéaire ou en coût majoré",
        blocks: [
          { table: {
            head: ["Mode", "Comment une armoire est tarifée", "Champs"],
            rows: [
              ["Par pied linéaire", "Sa largeur en pieds × le tarif de son niveau, ajusté selon le matériau de la porte et du caisson. La façon dont les ateliers sur mesure soumissionnent.", "**Base**, **Mural / haut**, **Haute / garde-manger**, **Îlot**, un **Supplément tiroir** par tiroir, des tarifs facultatifs **Caissons de garde-robe** et **Meuble-lavabo / caisson d'évier de buanderie** (vides, ils sont facturés à vos tarifs de cuisine), et la case **L'installation est incluse dans le tarif**."],
              ["Coût majoré du matériau", "Un coût de base plus un montant au pouce pour le caisson, majoré, avec l'installation facturée à part.", "Un coût de base et un montant au pouce pour chacun de Base, Mural, Haute et Îlot, une **Majoration** (0,18 = 18 % sur le matériau) et **Installation par caisson**."],
            ],
          } },
          { p: "**L'installation est incluse dans le tarif** compte : désactivée, chaque soumission de cuisine gagne une ligne d'installation distincte. Il n'y a pas de tarif d'installation au pied linéaire sur l'écran parce que rien dans le concepteur ne facture l'installation ainsi — une case qui enregistrerait un chiffre et facturerait au caisson quand même serait un contrôle mort." },
        ],
      },
      {
        id: "multipliers-and-extras",
        heading: "Multiplicateurs de matériau et extras",
        blocks: [
          { bullets: [
            "Les **Multiplicateurs de matériau** s'appliquent au prix de l'armoire par matériau de porte et par matériau de caisson : 1,0 est votre référence, 1,4 signifie que le chêne blanc coûte 40 % de plus qu'elle. Le **Supplément coin** s'ajoute aux caissons de coin, qui demandent plus de travail que leur largeur ne le laisse croire.",
            "**Finition — par porte** et **par façade de tiroir**, **Livraison** (forfait) et **Retirer les anciennes armoires** (par caisson) sont facturés à la pièce et activés ou désactivés par design dans le concepteur.",
          ] },
          { warning: "**Revenir aux tarifs de départ** supprime vos tarifs enregistrés immédiatement, sans confirmation, et l'avis ambre revient. Notez vos chiffres avant d'appuyer." },
        ],
      },
      {
        id: "who-can-see-it",
        heading: "Qui peut le voir",
        blocks: [
          { p: "La ligne n'apparaît que lorsque votre entreprise a activé **Kitchen Design & New Installs** (conception de cuisine et installations neuves) sous Services et tarifs, ou a déjà enregistré ses propres tarifs. La lire et la modifier exige **user:manage** — les propriétaires, les administrateurs et les superviseurs (les niveaux Répartiteur et Gestionnaire). Le concepteur lui-même est décrit dans [[the-kitchen-designer|Le concepteur de cuisine]]." },
        ],
      },
    ],
    faq: [
      { q: "J'ai changé mes tarifs — la soumission de cuisine envoyée hier change-t-elle?", a: "Non. Les designs sont tarifés au moment où ils sont faits; les nouveaux tarifs s'appliquent aux nouveaux designs." },
      { q: "Pourquoi Tarifs des armoires n'est-il pas dans mon menu Paramètres?", a: "La ligne n'apparaît que pour les entreprises qui ont activé Kitchen Design & New Installs. Activez ce type de soumission sous Services et tarifs." },
    ],
  },

  "settings-overhead": {
    title: "Frais généraux",
    summary:
      "Tout ce que l'entreprise coûte à faire tourner en un mois — coûts fixes, salaires, dettes, actifs — et le prix minimum qu'un chantier doit rapporter pour le couvrir.",
    updated: "2026-09-12",
    intro: [
      "**Paramètres → Services et tarifs → Frais généraux** est l'endroit où vous notez ce que votre entreprise coûte, que vous décrochiez un chantier ou non : le loyer, l'assurance, votre propre retrait, le prêt du camion, le pulvérisateur que vous remplacerez un jour. Divisé par le nombre de chantiers que vous pouvez prendre, cela devient le prix le plus bas auquel un chantier peut sortir tout en couvrant l'entreprise.",
      "Ce chiffre — **Prix minimum** — est celui qu'un entrepreneur veut le plus et a le moins souvent. Il alimente aussi le panneau Coût et marge de chaque soumission comme frais généraux réels par chantier, à la place d'un pourcentage deviné.",
    ],
    sections: [
      {
        id: "overview",
        heading: "Ce qu'il y a à l'écran",
        blocks: [
          { p: "De haut en bas : **Votre prix minimum** (deux cases et quatre tuiles), **Heures payées qui n'ont jamais atteint un chantier**, puis cinq registres — **Coûts fixes**, **Salaires**, **Dette**, **Actifs et amortissement** et **Factures à payer**." },
          { figure: "live:app-settings-overhead", caption: "Paramètres → Frais généraux — Chantiers par semaine et Marge cible, les quatre tuiles, puis les registres qui les alimentent." },
        ],
      },
      {
        id: "your-minimum-price",
        heading: "Votre prix minimum",
        blocks: [
          { steps: [
            "Saisissez **Chantiers par semaine** — combien de chantiers votre équipe peut prendre dans une semaine normale — et, si vous voulez, **Marge cible %** (vide signifie la valeur par défaut de 20).",
            "Appuyez sur **Enregistrer**. Les quatre tuiles se remplissent : **Coûts fixes mensuels**, **Chantiers / mois**, **Coût par chantier** et **Prix minimum**.",
            "Lisez la note en dessous : elle dit quels registres le total inclut, et ajoute l'amortissement de vos actifs et les intérêts de vos prêts.",
          ] },
          { p: "Chantiers par mois = chantiers par semaine × 4,33; le coût par chantier est le total mensuel divisé par ce nombre; le prix minimum est le coût par chantier divisé par (1 − marge). Le minimum ne couvre que les frais généraux — les matériaux et la main-d'œuvre du chantier en question s'ajoutent par-dessus. Les factures à payer ne le changent pas : c'est de la trésorerie, pas du coût." },
        ],
      },
      {
        id: "the-registers",
        heading: "Ce qui va dans chaque registre",
        blocks: [
          { table: {
            head: ["Registre", "Ce qui y va", "Ce qu'il change"],
            rows: [
              ["Coûts fixes", "Loyer, assurance, facture de téléphone, abonnements — un montant, hebdomadaire, mensuel ou annuel.", "Compté dans le total mensuel. Un montant ponctuel est enregistré mais pas compté; la ligne le dit."],
              ["Salaires", "Frais généraux de l'entreprise seulement : votre propre retrait, un salaire de bureau, un comptable à l'heure. Pas le taux d'un équipier — ses heures sont déjà imputées à chaque chantier.", "Compté dans le total. Ils ne servent jamais à payer qui que ce soit; la paie vient de Gérer l'équipe et de la Paie."],
              ["Dette", "Prêts et contrats de financement : capital, paiement mensuel, taux d'intérêt.", "Compté dans le total. Lié à un actif, seuls les intérêts comptent, pour que le camion ne soit pas facturé deux fois."],
              ["Actifs et amortissement", "Ce qui est acheté une fois et utilisé des années, avec son coût, sa valeur de reprise, sa durée de vie utile et sa date de mise en service.", "Leur amortissement mensuel s'ajoute au total. Ceux qui sont vendus ou retirés cessent de compter; utilisez l'action de disposition plutôt que la suppression pour garder l'historique."],
              ["Factures à payer", "Ce qui est dû et pas encore payé, avec une date d'échéance, et **Marquer payée**.", "En souffrance, à sortir ce mois-ci et en retard. Rien ici ne touche le prix minimum."],
            ],
          } },
          { warning: "Supprimer une ligne demande d'abord, parce que le prix plancher change tout de suite et qu'il n'y a pas d'annulation. Pour un actif, la confirmation suggère de le marquer comme disposé à la place, ce qui garde ce qu'il vous a déjà coûté." },
        ],
      },
      {
        id: "unabsorbed-labour",
        heading: "Heures payées qui n'ont jamais atteint un chantier",
        blocks: [
          { p: "Ce panneau compare la semaine que vous garantissez aux gens avec les heures qu'ils ont réellement inscrites sur un chantier, sur les 30 derniers jours, et chiffre l'écart à leur taux horaire. Il n'est délibérément **pas** compté dans le coût par chantier ni dans le prix minimum — ceux-ci feraient bouger chaque soumission que vous rédigez sur des entrées de temps que personne n'a encore vérifiées. Quand un taux manque, il dit que le total est incomplet plutôt que de compter ces heures comme gratuites." },
        ],
      },
      {
        id: "who-can-see-it",
        heading: "Qui peut le voir",
        blocks: [
          { p: "Tout l'écran est la base de coûts de l'entreprise; il exige donc l'interrupteur **jobCosting** en plus de **user:manage** : les propriétaires, les administrateurs et le niveau Gestionnaire le voient; un Répartiteur, non. Salaires exige en plus la grille de paie qui vous laisse voir la paie de tout le monde, et Factures à payer exige l'accès aux dépenses de toute l'entreprise. Le plancher qu'il produit est expliqué dans [[overhead-and-your-minimum-price|Frais généraux et votre prix minimum]] et [[the-break-even-price|Le prix de seuil de rentabilité]]." },
        ],
      },
    ],
    faq: [
      { q: "Pourquoi mon prix minimum est-il « non défini »?", a: "Chantiers par semaine est vide. Le plancher a besoin d'une capacité par laquelle diviser; saisissez-en une et appuyez sur Enregistrer." },
      { q: "Dois-je mettre les salaires de mes peintres sous Salaires?", a: "Non. Leurs heures sont imputées à chaque chantier comme main-d'œuvre. Salaires ne sert qu'à la paie de frais généraux — votre retrait, le bureau, un comptable." },
      { q: "Enregistrer une facture ici la paie-t-elle?", a: "Non. Payez-la comme d'habitude, puis appuyez sur Marquer payée." },
    ],
  },

  "settings-custom-fields": {
    title: "Champs personnalisés",
    summary:
      "Où seront définies les cases supplémentaires pour les clients, les propriétés, les soumissions, les chantiers, les factures et les membres de l'équipe — marqué À venir, parce qu'aucune fiche ne les affiche encore.",
    updated: "2026-09-12",
    intro: [
      "Un champ personnalisé est une case supplémentaire pour ce que FieldQuo ne prévoit pas — un code de portail sur une propriété, un numéro de bon de commande sur une facture, l'expiration d'une carte de compétence sur un membre de l'équipe. **Paramètres → Services et tarifs → Champs personnalisés** est l'écran où ces cases sont définies.",
      "Aujourd'hui, l'écran porte un panneau **À venir**, et la phrase sous le titre dit pourquoi : rien n'affiche encore un champ personnalisé sur une fiche client, propriété, soumission, chantier, facture ou équipe, donc les réponses ne peuvent pas être saisies. FieldQuo ne dessine pas de bouton Ajouter mort par-dessus ce vide.",
    ],
    sections: [
      {
        id: "overview",
        heading: "Ce qu'il y a à l'écran",
        blocks: [
          { p: "Six sections — **Champs personnalisés du client**, **Champs personnalisés de la propriété**, **Champs personnalisés de la soumission**, **Champs personnalisés du chantier**, **Champs personnalisés de la facture** et **Champs personnalisés de l'équipe**. Chacune liste les champs définis pour ce type de fiche avec une pastille de type (Text, Number, Date, Checkbox ou Dropdown, en anglais à l'écran) et **Obligatoire** là où c'était réglé. Une section vide dit, par exemple, « Suivez les détails du client en ajoutant un champ personnalisé »." },
          { figure: "live:app-settings-custom-fields", caption: "Paramètres → Champs personnalisés — le panneau À venir, puis une section par type de fiche." },
        ],
      },
      {
        id: "what-works-today",
        heading: "Ce qui fonctionne aujourd'hui",
        blocks: [
          { bullets: [
            "Les définitions qu'une entreprise a créées avant le retrait du contrôle Ajouter sont encore listées, et un propriétaire, un administrateur ou un superviseur peut encore en supprimer une avec l'icône de corbeille.",
            "**Ajouter un champ** n'est pas affiché. Il reviendra le jour où un formulaire de fiche affichera un champ personnalisé, dans le même changement qui retirera le panneau À venir.",
            "Rien ici ne concerne le courriel. La ligne sous le titre vous renvoie à [[settings-email-templates|Modèles de courriel]] pour cela.",
          ] },
        ],
      },
      {
        id: "who-can-see-it",
        heading: "Qui peut le voir",
        blocks: [
          { p: "La ligne exige **user:manage** — les propriétaires, les administrateurs et les superviseurs — parce que définir un champ changerait chaque fiche de l'entreprise. Quand la fonction sera livrée, les employés verront la liste en lecture seule, puisque savoir ce qu'est « Code de portail » et s'il est obligatoire est utile à la personne qui le remplit." },
        ],
      },
    ],
  },

  "settings-quote-email": {
    title: "Courriel de soumission",
    summary:
      "Les deux sections facultatives du courriel qui transporte vos soumissions — les références d'anciens clients et les paires de photos avant-après — et la règle qui empêche une section vide de partir.",
    updated: "2026-09-12",
    intro: [
      "**Paramètres → Documents et modèles → Courriel de soumission** concerne ce que contient le courriel qui accompagne une soumission, au-delà de la soumission elle-même. La plus grande partie de ce courriel ne se configure pas ici et n'a pas d'interrupteur : l'étendue des travaux, ce qui est compris, le déroulement des travaux et ce qui pourrait modifier le prix viennent tous de la soumission et du texte que vous modifiez par métier sous Services et tarifs. Si la soumission le dit, le courriel le dit.",
      "Ce qui est facultatif, ce sont vos propres preuves — les gens qu'un propriétaire peut appeler, et les photos des chantiers que vous avez terminés. Cet écran contient les deux, décide s'ils partent par défaut sur chaque nouvelle soumission, et chaque changement s'enregistre à mesure.",
    ],
    sections: [
      {
        id: "overview",
        heading: "Ce qu'il y a à l'écran",
        blocks: [
          { p: "Trois cartes. **Ce que le courriel contient toujours** est une simple liste sans contrôles, avec un lien vers Services et tarifs où ce texte se modifie. **Références** et **Avant et après** ont chacune une case **Inclure dans chaque nouvelle soumission**, une liste et un formulaire d'ajout. Il n'y a pas de bouton Enregistrer; chaque modification s'enregistre aussitôt et la page se redessine à partir de ce qui a réellement été stocké." },
          { figure: "live:app-settings-quote-email", caption: "Paramètres → Courriel de soumission — ce que le courriel contient toujours, puis les cartes Références et Avant et après avec leurs cases Inclure dans chaque nouvelle soumission." },
        ],
      },
      {
        id: "references",
        heading: "Références",
        blocks: [
          { steps: [
            "Dans **Références**, tapez un **Nom** et un **Téléphone** et appuyez sur **Ajouter**. Les deux sont obligatoires — un nom sans numéro n'est pas une référence — et ils s'impriment exactement comme vous les saisissez.",
            "Cochez **Inclure dans chaque nouvelle soumission** pour mettre la liste sur chaque nouvelle soumission par défaut.",
            "Utilisez **Retirer** sur une ligne pour enlever quelqu'un.",
          ] },
          { warning: "N'inscrivez que des personnes qui ont réellement accepté ces appels. Leur numéro est transmis à chaque propriétaire que vous soumissionnez. Le courriel imprime au plus 6 références." },
        ],
      },
      {
        id: "before-and-after",
        heading: "Avant et après",
        blocks: [
          { steps: [
            "Sous **Avant et après**, appuyez sur **Nouvelle paire — téléversez l'avant et l'après** et ajoutez une photo dans chacune des cases **Avant** et **Après**. Les deux moitiés sont obligatoires.",
            "Ajoutez une **Description (facultatif)** et cochez **Inclure dans chaque nouvelle soumission** si les paires doivent partir par défaut.",
          ] },
          { p: "Le courriel imprime au plus 4 paires — huit images, c'est déjà lent sur un téléphone dans une entrée de garage. Les téléversements passent par le même téléversement signé que votre logo et vos photos de chantier." },
        ],
      },
      {
        id: "the-empty-section-rule",
        heading: "Ce que fait une section activée mais vide",
        blocks: [
          { p: "Une section activée sans rien dedans ne doit jamais atteindre un client. FieldQuo bloque donc l'envoi à la place : la page dit **Cette section est activée et vide. Tant qu'elle le reste, aucune soumission ne peut être envoyée.**, et quand quelqu'un appuie sur Envoyer sur une soumission, il reçoit une fenêtre qui nomme la section avec deux boutons — **Ajouter du contenu**, qui l'amène ici, et **Retirer de cette soumission**." },
          { p: "Chaque soumission peut aussi passer outre la valeur par défaut. Le panneau **Sections du courriel** d'une soumission affiche **Défaut (activé)** ou **Défaut (désactivé)** pour chaque section et permet de l'activer ou de la désactiver pour cette soumission seulement, ou de lui donner sa propre liste. Voir [[references-and-photos-in-the-quote-email|Références et photos avant-après dans le courriel de soumission]]." },
        ],
      },
      {
        id: "who-can-see-it",
        heading: "Qui peut le voir",
        blocks: [
          { p: "La ligne exige **user:manage** — les propriétaires, les administrateurs et les superviseurs. Toute autre personne qui atteint la page la voit en lecture seule avec l'avis **Voici ce que vos clients reçoivent avec chaque soumission.** Le courriel d'accompagnement lui-même part dans la langue de la soumission, au nom de votre entreprise." },
        ],
      },
    ],
    faq: [
      { q: "Puis-je modifier le reste du courriel de soumission ici?", a: "Non. L'étendue, les inclusions et les étapes viennent de la soumission et du texte par métier de Services et tarifs; la mise en page vient des Modèles de courriel seulement pour les relances et les campagnes. Cet écran possède les deux sections facultatives." },
      { q: "J'ai coché Inclure dans chaque nouvelle soumission — les anciennes soumissions l'auront-elles?", a: "Non. C'est la valeur par défaut des nouvelles soumissions. Une soumission existante garde ce que dit son propre panneau Sections du courriel." },
    ],
  },

  "settings-email-templates": {
    title: "Modèles de courriel",
    summary:
      "Des modèles de courriel construits par blocs, regroupés en Automatisé, Marketing et Personnalisé — ce que l'éditeur offre, quels envois les utilisent vraiment aujourd'hui, et ce que la pastille Actif change et ne change pas.",
    updated: "2026-09-12",
    intro: [
      "**Paramètres → Documents et modèles → Modèles de courriel** liste chaque modèle de courriel de votre entreprise, regroupé selon son usage, avec un modèle par type marqué **Actif**. Chaque modèle s'ouvre dans un éditeur par blocs avec un objet, votre image de marque, des champs de fusion, un aperçu en direct et un bouton d'envoi de test.",
      "Lisez la section suivante avant d'en construire un. Les modèles sont réellement envoyés par les **règles de relance** et les **campagnes de courriel**. La pastille Actif sur les types automatisés de soumission et de reçu ne change pas ce que dit un courriel de soumission ou de facture aujourd'hui — ceux-là viennent du document lui-même.",
    ],
    sections: [
      {
        id: "overview",
        heading: "Ce qu'il y a à l'écran",
        blocks: [
          { p: "En haut, **Ajouter les modèles par défaut**, qui crée un modèle de départ pour chaque type automatisé que vous n'avez pas encore. Puis trois groupes — **Automatisé** (Quote email, Instructions email, Receipt / invoice email, Follow-up email — les types portent leur nom anglais), **Marketing** (Marketing email) et **Personnalisé** — chaque type avec **Nouveau modèle** et sa liste de modèles. Une ligne affiche le nom, une pastille **Actif** sur celui qui sert, une étoile pour en activer un autre, et des icônes de modification, de duplication et de suppression. Un type sans modèle dit **Aucun modèle pour l'instant — utilisation de la valeur par défaut intégrée.**" },
          { figure: "live:app-settings-email-templates", caption: "Paramètres → Modèles de courriel — Automatisé, Marketing et Personnalisé, un modèle Actif par type." },
        ],
      },
      {
        id: "which-sends-use-them",
        heading: "Quels envois utilisent un modèle",
        blocks: [
          { table: {
            head: ["Type de modèle", "Utilisé par"],
            rows: [
              ["Follow-up email, Marketing email, Custom", "Les **règles de relance** — une règle choisit l'un de ceux-ci à sa création, et la tâche planifiée de relance rend ses blocs. Voir [[follow-up-rules|Règles de relance]]."],
              ["Marketing email, Custom", "Les **campagnes de courriel** de l'écran Marketing — une campagne choisit un modèle et l'envoie à vos abonnés. Voir [[email-campaigns-and-subscribers|Campagnes de courriel et abonnés]]."],
              ["Quote email, Instructions email, Receipt / invoice email", "Rien encore. Les vrais courriels de soumission et de facture sont construits à partir du document — son étendue, ses inclusions et ses étapes — et de la mise en page sous Modèles PDF. Marquer l'un de ceux-ci Actif déplace la pastille et ne change aucun courriel."],
            ],
          } },
          { note: "Le texte du courriel de soumission que vous POUVEZ changer vit ailleurs : par métier sous [[settings-services|Services et tarifs]], et les deux sections facultatives sous [[settings-quote-email|Courriel de soumission]]." },
        ],
      },
      {
        id: "build-a-template",
        heading: "Comment en construire un",
        blocks: [
          { steps: [
            "Appuyez sur **Nouveau modèle** sous le type voulu, donnez-lui un nom et appuyez sur **Créer et modifier**.",
            "Réglez l'**Objet** (les champs de fusion y fonctionnent aussi; vide, c'est l'objet intégré du type qui sert).",
            "Sous **Apparence**, le modèle démarre **Selon votre image de marque**; ne changez l'accent, l'en-tête et le fond que si vous le voulez.",
            "Appuyez sur **Ajouter un bloc** pour ajouter du texte, des images, des boutons, des séparateurs ou un sommaire, et glissez les blocs pour les réordonner. Les champs de fusion insèrent le nom du client, le montant, et ainsi de suite.",
            "Vérifiez l'**Aperçu du courriel** avec des données d'exemple, sur mobile et sur ordinateur, puis **Envoyer un test** à votre propre adresse.",
            "Appuyez sur **Enregistrer**. De retour dans la liste, appuyez sur l'étoile pour en faire le modèle **Actif** de son type.",
          ] },
          { figure: "create:app-settings-templates-create", caption: "Nouveau modèle — nommez-le, puis Créer et modifier ouvre l'éditeur par blocs." },
          { warning: "La suppression est définitive, avec une confirmation. Supprimer le modèle Actif d'un type ramène ce type à la valeur par défaut intégrée." },
        ],
      },
      {
        id: "who-can-see-it",
        heading: "Qui peut le voir",
        blocks: [
          { p: "Tout le monde peut lire les modèles, mais chaque contrôle — créer, modifier, activer, dupliquer, supprimer, ajouter les modèles par défaut — exige **user:manage**; la ligne n'est donc montrée qu'aux propriétaires, aux administrateurs et aux superviseurs plutôt que de dessiner des boutons qui seraient tous refusés." },
        ],
      },
    ],
    faq: [
      { q: "J'ai rendu un modèle Quote email Actif et mon courriel de soumission est pareil. Pourquoi?", a: "Parce que le courriel de soumission n'est pas rendu à partir d'un modèle aujourd'hui. Son texte vient de la soumission et de Services et tarifs; les sections facultatives, de Courriel de soumission." },
      { q: "Les modèles gardent-ils mon logo et ma couleur?", a: "Oui. Un nouveau modèle démarre Selon votre image de marque, depuis Paramètres → Image de marque, jusqu'à ce que vous personnalisiez son apparence." },
      { q: "Où est-ce que je choisis le modèle qu'une relance utilise?", a: "Sur la règle de relance elle-même, sous Paramètres → Relances. Seuls les modèles Follow-up, Marketing et Custom sont offerts." },
    ],
  },

  "settings-pdf-templates": {
    title: "Modèles PDF",
    summary:
      "L'ordre des sections des PDF de soumission et de facture que vos clients reçoivent — une mise en page en usage par document, modifiable section par section, avec un aperçu d'exemple.",
    updated: "2026-09-12",
    intro: [
      "**Paramètres → Documents et modèles → Modèles PDF** est la mise en page des deux PDF qu'un client reçoit vraiment : la soumission jointe quand vous en envoyez ou en téléchargez une, et la facture jointe aux factures et aux demandes de paiement. Une entreprise qui n'ouvre jamais cet écran obtient quand même un PDF complet sur la mise en page standard; cette page existe pour changer l'ordre de ses sections ou en retirer une.",
      "C'est le pendant des Modèles de courriel, séparé par support : un PDF est une page avec un ordre de sections fixe et sans boutons; un courriel défile et a des liens. Les deux se modifient séparément à dessein.",
    ],
    sections: [
      {
        id: "overview",
        heading: "Ce qu'il y a à l'écran",
        blocks: [
          { p: "Deux cartes, **PDF de soumission** et **PDF de facture**, chacune avec un bouton **Nouveau** et sa liste de mises en page. Une mise en page affiche son nom, son nombre de sections et une pastille **Actif** sur celle qui sert; les autres offrent **Use this** (le bouton reste en anglais à l'écran), plus des icônes de modification et de suppression. Une carte sans mise en page dit **Utilisation de la mise en page standard. Vos PDF fonctionnent déjà — n'en créez une que si vous voulez changer l'ordre ou retirer une section.** Si vous avez des mises en page mais qu'aucune n'est en usage, la carte avertit que les PDF sortent toujours sur la mise en page standard." },
          { figure: "live:app-settings-templates", caption: "Paramètres → Modèles PDF — les cartes PDF de soumission et PDF de facture, chacune avec ses mises en page et celle marquée Actif." },
        ],
      },
      {
        id: "the-standard-layout",
        heading: "La mise en page standard",
        blocks: [
          { p: "Une soumission se lit, de haut en bas : **Header** (en-tête), **Client details** (coordonnées du client), **Line items** (lignes), **Totals** (totaux), **How the work runs** (déroulement des travaux), **Payment terms** (conditions de paiement), **Notes**, **Signature block** (bloc de signature), **Footer** (pied de page) — les sections portent leur nom anglais dans l'éditeur. Les étapes viennent après le total à dessein — l'œil du client va d'abord au prix, et la question qui suit est de savoir si ça en vaut la peine. Une facture est une demande plutôt qu'un argumentaire; sa mise en page standard est donc Header, Client details, Line items, Totals, **Payments received** (paiements reçus), Notes et Footer : pas d'étapes, pas de signature. Les factures reflètent les soumissions pour que le client reconnaisse le second document comme le jumeau du premier." },
        ],
      },
      {
        id: "make-a-layout",
        heading: "Comment créer et utiliser une mise en page",
        blocks: [
          { steps: [
            "Appuyez sur **Nouveau** sur la carte PDF de soumission ou PDF de facture, nommez-la (le nom est pour vous — les clients ne le voient jamais) et choisissez **Partir de la mise en page standard** ou **Copier celle en cours**.",
            "Dans **Modifier la mise en page**, la liste **Sections, de haut en bas** a **Déplacer vers le haut**, **Déplacer vers le bas** et **Retirer la section** sur chaque ligne, et **Ajouter une section** pour celles que vous avez retirées. Si vous retirez une section qui compte, l'éditeur le dit : le PDF sera quand même généré, mais il n'aura pas l'air d'un document fini.",
            "Appuyez sur **Aperçu avec des données d'exemple**, puis sur **Enregistrer**.",
            "De retour dans la liste, appuyez sur **Use this**. Dès lors, chaque nouveau PDF de soumission (ou de facture) est rendu avec elle.",
          ] },
          { warning: "La suppression est définitive et demande d'abord. Supprimer la mise en page marquée **actuellement utilisée** ramène chaque futur PDF à la mise en page standard — un changement de ce que les clients reçoivent, depuis un écran qui a l'air d'un simple rangement." },
        ],
      },
      {
        id: "who-can-see-it",
        heading: "Qui peut le voir",
        blocks: [
          { p: "Chaque contrôle ici exige **user:manage**; la ligne est donc montrée aux propriétaires, aux administrateurs et aux superviseurs. Les couleurs du PDF viennent de votre couleur de marque sous [[settings-branding|Image de marque]], jamais de cet écran; ce que chaque section imprime est décrit dans [[the-quote-pdf|Le PDF de soumission]]." },
        ],
      },
    ],
    faq: [
      { q: "Ai-je besoin d'une mise en page pour que mes PDF fonctionnent?", a: "Non. Sans mise en page, ou sans mise en page en usage, les PDF utilisent la mise en page standard, qui est complète." },
      { q: "Puis-je changer le texte à l'intérieur d'une section?", a: "Pas ici. Cet écran ordonne et retire des sections. Les mots viennent de la soumission et du texte par métier de Services et tarifs." },
    ],
  },

  "settings-translations": {
    title: "Traductions",
    summary:
      "Relisez et corrigez les noms et descriptions traduits de vos produits et services, langue par langue, avec des ébauches IA que vous lisez avant qu'elles n'atteignent un document client.",
    updated: "2026-09-12",
    intro: [
      "**Paramètres → Documents et modèles → Traductions** est le libellé que les clients voient sur les soumissions et les factures rédigées dans une autre langue — le nom et la description de chaque article de votre liste de prix, en anglais, en espagnol ou dans toute autre langue que FieldQuo prend en charge. La page est disposée source à côté de traduction, une ligne par article, parce que le travail est une comparaison : vous ne pouvez pas juger si « finish » est juste sans « finition » à côté.",
      "Rien n'est traduit automatiquement au moment de l'envoi. Une soumission garde la langue dans laquelle elle a été créée, et un article y atterrit avec le libellé révisé pour cette langue quand il existe — sinon le texte source, de sorte qu'une traduction manquante fait une ligne d'allure inachevée, jamais une ligne vide.",
    ],
    sections: [
      {
        id: "overview",
        heading: "Ce qu'il y a à l'écran",
        blocks: [
          { p: "Un sélecteur de langue (toutes les langues que FieldQuo prend en charge sauf celle de votre entreprise), un compteur — **{count} manquent encore** ou **Les {count} sont traduits**, plus **{count} ébauchés, non lus** — et le bouton **Rédiger les ébauches manquantes**. En dessous, une ligne par produit ou service avec son texte source à gauche, les cases de traduction à droite, un état (**Non traduit**, **Ébauché — pas encore lu**, **Révisé** avec la date) et **Marquer comme révisé**. Les lignes qui demandent de l'attention remontent en haut." },
          { figure: "live:app-settings-translations", caption: "Paramètres → Traductions — le sélecteur de langue, le compteur des manquants, et la source à côté de la traduction pour chaque article." },
        ],
      },
      {
        id: "how-to-translate",
        heading: "Comment traduire votre liste de prix",
        blocks: [
          { steps: [
            "Choisissez la langue.",
            "Appuyez sur **Rédiger les ébauches manquantes**. Les ébauches s'affichent dans les cases vides, marquées **Ébauche IA — à lire avant d’enregistrer**; rien n'est encore enregistré. Ou tapez la traduction vous-même.",
            "Lisez chaque ligne face à la source. Corrigez le vocabulaire du métier — « finish », « trim », « coat » et « run » veulent dire une chose sur un chantier et une autre dans un dictionnaire.",
            "Appuyez sur **Marquer comme révisé** sur chaque ligne. C'est la seule action qui écrit quelque chose, et dès lors ce libellé va sur les documents des clients.",
          ] },
          { note: "La rédaction des ébauches consomme votre quota d'IA et s'arrête quand il est épuisé, en vous disant combien il en reste à faire. Si la rédaction automatique n'est pas activée sur le déploiement, la page le dit et vous pouvez tout de même saisir les traductions." },
        ],
      },
      {
        id: "what-it-changes",
        heading: "Ce que change une traduction révisée",
        blocks: [
          { bullets: [
            "Quand un article de la liste de prix est ajouté à une soumission dans cette langue, la ligne de la soumission prend le nom et la description traduits. Un nom traduit sans description traduite retombe sur la description source et compte encore comme manquant ici.",
            "Les documents envoyés ne sont pas touchés. Corriger une traduction change les nouvelles lignes, jamais une soumission qu'un client a déjà reçue — un PDF signé continue de dire ce qu'il disait.",
            "Les produits importés par CSV arrivent dans la langue dans laquelle ils ont été écrits et s'affichent ici comme **Non traduit** jusqu'à ce que vous les ébauchiez ou les tapiez.",
          ] },
          { p: "Les noms des métiers eux-mêmes (les types de soumission) ne se modifient pas ici; ils viennent du catalogue de FieldQuo dans chaque langue. Les langues dans lesquelles vous envoyez des documents et la langue de chaque client se règlent sous [[settings-language|Langue]] et sur la fiche du client — voir [[choose-your-language|Choisir votre langue, et celle de votre entreprise]]." },
        ],
      },
      {
        id: "who-can-see-it",
        heading: "Qui peut le voir",
        blocks: [
          { p: "Enregistrer une traduction et rédiger des ébauches exigent **user:manage**; la ligne est donc montrée aux propriétaires, aux administrateurs et aux superviseurs. La liste lit la liste de prix, et c'est pourquoi la page dit **Aucun service pour le moment. Ajoutez-les sous Paramètres → Produits et services** quand il n'y a rien à traduire." },
        ],
      },
    ],
    faq: [
      { q: "Une ébauche est-elle utilisée sur les soumissions avant que je la révise?", a: "Une ébauche faite avec Rédiger les ébauches manquantes n'est pas enregistrée tant que vous n'appuyez pas sur Marquer comme révisé; donc non. Seul un libellé enregistré atteint un document." },
      { q: "Corriger une traduction changera-t-il une soumission déjà envoyée?", a: "Non. Un document garde le libellé avec lequel il a été créé." },
      { q: "Pourquoi ne puis-je pas choisir ma propre langue dans le sélecteur?", a: "La langue source est la valeur par défaut de votre entreprise; vous traduisez à partir d'elle, pas vers elle." },
    ],
  },

  "settings-checklists": {
    title: "Listes de vérification",
    summary:
      "Des listes réutilisables des étapes que votre équipe suit sur le chantier, regroupées en Avant les travaux, Sur le chantier et Avant de partir, copiées sur une visite comme une liste neuve à cocher.",
    updated: "2026-09-12",
    intro: [
      "**Paramètres → Documents et modèles → Listes de vérification** est l'endroit où vous notez, une fois, les étapes que votre équipe répète à chaque chantier — masquer les comptoirs, photographier avant, photographier après — au lieu de compter sur la mémoire des gens. Attachez une liste à une visite de chantier et elle passe comme une copie neuve à cocher; modifier la copie plus tard ne change jamais l'original.",
      "Deux listes sur la page, séparées à dessein : celle du haut est ce que votre entreprise a écrit; celle du bas est la bibliothèque de départ de FieldQuo par métier. Prendre une liste de départ la copie dans votre propre liste au lieu de la lier, parce que la première chose que quiconque fait avec une liste de départ, c'est changer une ligne.",
    ],
    sections: [
      {
        id: "overview",
        heading: "Ce qu'il y a à l'écran",
        blocks: [
          { p: "**Nouvelle liste de vérification** en haut à droite. Puis vos propres listes, chacune avec son nom, une pastille de phase (**Avant les travaux**, **Sur le chantier** ou **Avant de partir**), son nombre d'étapes et le service auquel elle s'applique, avec **Modifier** et une icône de suppression. En dessous, **Listes de départ pour vos métiers** — rédigées pour les services que vous avez activés — chacune avec **Utiliser celle-ci**. Quand vous n'en avez encore aucune, la page dit **Aucune liste de vérification pour l'instant**." },
          { figure: "live:app-settings-checklists", caption: "Paramètres → Listes de vérification — vos propres listes avec leur phase et leur nombre d'étapes, puis les listes de départ pour vos métiers." },
        ],
      },
      {
        id: "write-a-checklist",
        heading: "Comment en écrire une",
        blocks: [
          { steps: [
            "Appuyez sur **Nouvelle liste de vérification** (ou sur **Utiliser celle-ci** sur une liste de départ pour partir d'une copie).",
            "Nommez-la — l'exemple suggère **Rénovation de cuisine — jour un** — et choisissez **Pour quel service**, ou laissez **Tout service**.",
            "Choisissez **À quel moment de la visite** : **Avant les travaux** pour la préparation du chantier et les matériaux, **Sur le chantier** pour le travail lui-même, **Avant de partir** pour le nettoyage et la visite avec le client. Une visite regroupe sa liste sous ces titres.",
            "Remplissez les **Étapes**, une par ligne, avec **Ajouter une étape** pour en ajouter, et appuyez sur **Créer** (ou **Enregistrer les modifications** en modification). Un nom et au moins une étape sont obligatoires.",
          ] },
          { figure: "create:app-settings-checklists-create", caption: "Nouvelle liste de vérification — le nom, le service, le moment de la visite où elle s'applique, et les étapes." },
        ],
      },
      {
        id: "how-it-reaches-a-visit",
        heading: "Comment une liste atteint une visite",
        blocks: [
          { bullets: [
            "Quand quelqu'un crée une visite sur un chantier, le champ **Liste de vérification** est facultatif : choisissez-en une ou plusieurs et l'équipe reçoit sa propre copie à cocher.",
            "Une visite qui existe déjà peut se voir appliquer un modèle après coup depuis le panneau de liste de vérification de la visite.",
            "Rien ne s'applique tout seul. La bibliothèque de départ est un ensemble de suggestions, et une liste que vous avez écrite reste ici tant que quelqu'un ne l'attache pas. Le cochage se fait sur la visite, sur le téléphone de l'équipe — voir [[checklists-on-site|Les listes de vérification sur le chantier]]."
          ] },
          { warning: "Supprimer une liste ici retire le modèle. Les copies déjà attachées à des visites sont des lignes distinctes et gardent leurs étapes." },
        ],
      },
      {
        id: "who-can-see-it",
        heading: "Qui peut le voir",
        blocks: [
          { p: "Créer, modifier et supprimer une liste est réservé aux propriétaires, aux administrateurs et aux superviseurs; la ligne leur est donc montrée. Lire les modèles est ouvert à tous à dessein : l'écran de nouvelle visite et la liste de la visite lisent la même liste, et ce sont exactement les écrans depuis lesquels un équipier travaille." },
        ],
      },
    ],
    faq: [
      { q: "Si je modifie une liste, les visites qui l'ont déjà changent-elles?", a: "Non. Chaque visite tient sa propre copie. La modification s'applique aux visites auxquelles elle est attachée à partir de maintenant." },
      { q: "Une étape peut-elle être une lecture plutôt qu'une coche?", a: "Une étape sur cet écran est une ligne de texte que l'équipe coche. Il n'y a pas de type de réponse numérique ni réussite/échec sur ce formulaire de paramètres aujourd'hui." },
      { q: "Pourquoi ne vois-je aucune liste de départ?", a: "Elles sont rédigées pour les services que vous avez activés sous Services et tarifs. Activez un métier et ses listes de départ apparaissent." },
    ],
  },
};
