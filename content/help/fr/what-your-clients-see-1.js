// content/help/fr/what-your-clients-see-1.js
//
// Partie 1 de la catégorie « what-your-clients-see » en français (voir le
// composeur, what-your-clients-see.js). Slugs de cette partie
// (lib/help/tree.js) : nothing-says-fieldquo, the-quote-email,
// the-quote-approval-page, the-invoice-email-and-pay-page,
// the-client-portal-as-a-client, the-booking-page, managing-a-booked-visit,
// the-instant-estimate-page.
//
// Même structure que l'anglais, article par article, bloc par bloc. Les mots
// que le client lit viennent des blocs `fr` de lib/i18n/clientDocCopy.js,
// lib/i18n/emailCopy.js et lib/i18n/documentLabels.js ; les mots des écrans de
// paramètres, du bloc `fr` de app/i18n/appMessages.js.
export const ARTICLES = {
  "nothing-says-fieldquo": {
    title: "Rien ne dit FieldQuo",
    summary:
      "Chaque soumission, facture, page et courriel qu'un client voit porte votre logo, votre couleur et votre nom — d'où cela vient, comment une seule couleur devient un document lisible, et la courte liste des endroits où le nom FieldQuo peut apparaître.",
    updated: "2026-09-12",
    intro: [
      "Un client qui compare trois entrepreneurs ne devrait pas pouvoir deviner que deux d'entre eux utilisent le même logiciel. C'est la règle sur laquelle chaque surface client de FieldQuo est bâtie : le courriel de soumission arrive de votre entreprise, la page d'approbation est sur votre papier à en-tête, la page de facture et le portail sont dans votre couleur, la page de rendez-vous porte votre logo, et les textos commencent par votre nom. Aucun logo FieldQuo, aucune mention « propulsé par », aucun compte à créer pour le client.",
      "Cet article réunit la règle de la marque blanche en un seul endroit — ce qui porte votre nom, comment une couleur de marque devient une palette complète qui reste lisible sur un téléphone dans une entrée de garage, et les exceptions, pour que vous sachiez exactement où le nom FieldQuo peut se montrer.",
    ],
    sections: [
      {
        id: "overview",
        heading: "Vue d'ensemble",
        blocks: [
          { p: "Tout part de deux choses que vous réglez une fois sous **Paramètres → Image de marque** : un logo et une couleur **Principale**. Les documents et les pages que le client ouvre lisent ces deux champs et rien d'autre — il n'y a pas de thème par document à garder synchronisé, donc une soumission ne peut pas ressembler à FieldQuo pendant qu'une facture vous ressemble. Le nom sur la bande de marque, dans la ligne « De » du courriel, dans le pied de page et dans la ligne « Des questions ? » est le nom de votre entreprise, pris dans **Paramètres → Profil de l'entreprise**." },
          { p: "Les pages que le client ouvre sont complètement en dehors de l'application : pas de navigation, pas de connexion, rien qui laisse croire qu'il a un compte quelque part. Un lien de soumission ouvre un document ; un lien de portail ouvre un état de compte ; un lien de rendez-vous ouvre un calendrier. Chacune est écrite dans la langue du client, et chacune se termine par votre numéro de téléphone, pas le nôtre." },
        ],
      },
      {
        id: "what-carries-your-name",
        heading: "Ce qui porte votre nom",
        blocks: [
          { table: {
            head: ["Surface", "Ce qui est à vous dessus"],
            rows: [
              ["Le courriel de soumission et le courriel de facture", "La ligne « De » au nom de votre entreprise, votre logo sur une bande de marque dans votre couleur, votre couleur sur le bouton, votre téléphone, courriel, site web et numéro de taxes dans le pied de page."],
              ["La page d'approbation de la soumission et le PDF", "Le filet de marque en haut, votre logo et votre nom, votre couleur sur chaque titre, chaque section et la bande du total."],
              ["La page de facture et le portail client", "Votre logo, « Compte de [client] », vos factures et vos soumissions, les boutons Payer dans votre couleur, et une ligne « Des questions ? » avec votre téléphone et votre courriel."],
              ["La page de rendez-vous et la page de visite", "Votre logo et votre nom en haut, votre couleur sur la journée choisie et les boutons ; votre nom dans l'objet et le corps du courriel de confirmation."],
              ["L'estimation instantanée, le formulaire de demande de soumission et les entonnoirs", "Votre logo, votre couleur, vos services seulement — et jamais votre grille de tarifs."],
              ["Votre site web et votre page bio", "Votre sous-domaine, vos pages, vos photos, vos heures ; la seule ligne de pied de page est décrite plus bas."],
              ["Les textos (rappels, En route)", "Le nom de votre entreprise au début du message, et votre numéro de téléphone à rappeler sur le texto En route. Les réponses à ces textos ne sont lues par personne — seul STOP est pris en compte."],
            ],
          } },
          { note: "Le libellé des parties fixes — « Consulter et approuver votre soumission », « Approuver cette soumission », « Solde dû », « Changer l'heure » — appartient à FieldQuo, traduit dans chaque langue où un document peut être rédigé. Vous ne pouvez pas modifier ces phrases, et aucune ne nomme le logiciel." },
        ],
      },
      {
        id: "the-from-line",
        heading: "La ligne « De », et où vont les réponses",
        blocks: [
          { p: "Chaque courriel qu'un client reçoit est envoyé au nom de **Votre entreprise** dans la ligne « De ». L'adresse derrière le nom dépend d'une seule chose : si vous avez vérifié votre propre domaine sous **Paramètres → Domaine d'envoi**. Avec un domaine vérifié, l'adresse est la vôtre — **quotes@votredomaine.com**, sauf si vous avez choisi un autre mot avant le @. Sans domaine, l'adresse est l'adresse d'envoi partagée de FieldQuo, toujours au nom de votre entreprise." },
          { p: "Les réponses vous reviennent toujours. L'adresse de réponse est le courriel de votre entreprise dans **Paramètres → Profil de l'entreprise** ; si ce champ est vide, elle se rabat sur le courriel de connexion du propriétaire du compte, pour qu'une réponse de client ne disparaisse jamais dans une boîte que personne ne lit." },
          { tip: "Vérifiez votre domaine si vous le pouvez. C'est la seule différence visible entre « votre nom sur l'adresse de FieldQuo » et « votre nom sur votre adresse », et cela aide le courriel à arriver dans la boîte de réception plutôt que dans les promotions. Voir [[send-from-your-own-domain|Envoyer depuis votre propre domaine]]." },
        ],
      },
      {
        id: "how-the-colour-works",
        heading: "Comment une couleur devient un document",
        blocks: [
          { p: "Vous choisissez un code de couleur. FieldQuo en dérive chaque couleur de la page — le filet en haut, les titres de section, le fond derrière une carte de résumé, la bande du total et le bouton — et mesure le contraste de chaque paire texte-fond avant de l'utiliser. C'est important, parce que les entrepreneurs choisissent du jaune, du blanc, du noir et du gris moyen, et que la règle naïve « couleur foncée, texte blanc » échoue précisément sur ceux-là. Une marque blanche obtient quand même une bande de total visible ; un jaune pâle, des titres lisibles ; un logo repose toujours sur une plaque blanche dans la bande de marque, pour qu'un mot-symbole marine ne disparaisse jamais dans une barre marine." },
          { steps: [
            "Ouvrez **Paramètres → Image de marque**.",
            "Sous **Logo**, appuyez sur **Téléverser un logo** (PNG, JPG, WebP ou SVG, jusqu'à 8 Mo).",
            "Sous **Couleurs de marque**, réglez **Principale** — les boutons, les barres de progression et votre nom dans l'en-tête des courriels. **Secondaire** et **Neutre** sont facultatives et suivent des valeurs par défaut raisonnables.",
            "Vérifiez **L'apparence de vos documents**, en **Clair** et en **Sombre**. Cet aperçu utilise le même calcul que la soumission, la facture et les courriels.",
          ] },
          { figure: "live:app-settings-branding", caption: "Paramètres → Image de marque — la carte Logo, la carte Couleurs de marque avec Principale, Secondaire et Neutre, et l'aperçu du document." },
          { note: "La couleur de marque sert sur tout ce que vos clients voient et **pas dans l'application** : les écrans de votre équipe restent neutres pour qu'une marque criarde ne rende jamais le bureau pénible à utiliser. Une entreprise qui n'a réglé aucune couleur obtient le marine par défaut de FieldQuo sur ses documents — le seul cas où la couleur est la nôtre. Le courriel de confirmation de rendez-vous est la seule lettre avec un en-tête sombre fixe plutôt que votre couleur ; votre nom est tout de même dans son objet et sa première ligne." },
        ],
      },
      {
        id: "where-fieldquo-does-appear",
        heading: "Où le nom FieldQuo apparaît quand même",
        blocks: [
          { p: "Les exceptions sont courtes et chacune a sa raison :" },
          { bullets: [
            "**Le pied de page d'un site web gratuit.** Le site d'une entreprise qui n'est pas sur un forfait payant porte une petite ligne **Site par FieldQuo** sous le droit d'auteur. Les forfaits payants n'en ont pas. Voir [[the-site-by-fieldquo-footer|Le pied de page Site par FieldQuo]].",
            "**La page de parrainage.** Votre lien Parrainer ouvre une page adressée à un autre propriétaire d'entreprise qui dit que vous utilisez FieldQuo — tout son but est de recommander le logiciel. Voir [[the-referral-page|La page de parrainage]].",
            "**Les adresses web.** Les liens de soumission, de portail, de rendez-vous et de visite s'ouvrent sur le domaine de FieldQuo, et votre site web vit à votreentreprise.fieldquo.com. La page est à vous ; la barre d'adresse ne l'est pas.",
            "**L'adresse d'envoi** quand vous n'avez pas vérifié votre propre domaine, comme ci-dessus. Le nom est le vôtre ; ce qui suit le @ ne l'est pas.",
            "**La page de paiement de Stripe.** Un client qui paie par carte ou depuis un compte bancaire est amené sur la page hébergée de Stripe pour votre compte connecté, au nom de votre entreprise — cette page est celle de Stripe, et le dit.",
          ] },
        ],
      },
      {
        id: "only-in-fieldquo",
        heading: "Pourquoi cet article est classé sous Seulement dans FieldQuo",
        blocks: [
          { p: "Des cinq pages de tarifs auxquelles FieldQuo se compare — Jobber, Housecall Pro, ServiceTitan, Projul et QuoteIQ — aucune n'indique, à aucun palier, que les documents et les pages reçus par le client portent la marque de l'entrepreneur plutôt que celle du logiciel. La page de Jobber mentionne « Customize quotes with rich visuals and reviews », que FieldQuo lit comme des mises en page de documents, pas comme de la marque blanche. C'est toute la prétention : non listé sur leur page de tarifs, jamais « ils ne peuvent pas le faire »." },
        ],
      },
    ],
    faq: [
      { q: "Le client doit-il créer un compte à un moment ou l'autre ?", a: "Non. Chaque lien est un jeton dans l'adresse — la soumission, le portail, la page de visite. Aucun mot de passe, aucune inscription, aucun compte FieldQuo pour un client." },
      { q: "Puis-je retirer la ligne Site par FieldQuo ?", a: "Elle n'apparaît que sur une entreprise qui n'est pas sur un forfait payant. Sur un forfait payant, elle n'est pas affichée ; il n'y a pas d'interrupteur distinct." },
      { q: "Ma couleur de marque est le blanc. Que se passe-t-il ?", a: "Chaque couleur de texte est mesurée contre elle, et là où la paire échoue, la page substitue une puce neutre ou fonce l'accent pour le texte. Le document reste lisible ; il porte simplement moins de couleur. Vérifiez l'aperçu dans Image de marque." },
      { q: "La langue de la page dépend-elle du client ou de moi ?", a: "Du client. Une soumission garde la langue dans laquelle elle a été créée, et tout le reste que le client reçoit suit sa propre langue sur sa fiche, puis la langue par défaut de votre entreprise. Voir [[a-clients-language|La langue d'un client]]." },
    ],
  },

  "the-quote-email": {
    title: "Le courriel de soumission",
    summary:
      "Ce qui arrive dans la boîte de réception du client quand vous appuyez sur Envoyer : la ligne « De », l'objet, le total et le bouton d'approbation, l'étendue des travaux et les étapes, les références et les photos avant-après facultatives, et le PDF joint.",
    updated: "2026-09-12",
    intro: [
      "Appuyer sur **Envoyer** sur une soumission envoie un seul message à l'adresse du client, de la part de votre entreprise, dans la langue de la soumission, avec le PDF joint. Ce n'est pas un simple lien. Le courriel porte la substance de la soumission — ce que ça coûte, ce qui est compris, comment les travaux se déroulent — parce qu'un client lit trois soumissions côte à côte, et celle qui n'est qu'un lien passe pour l'entreprise qui ne s'est pas donné la peine.",
      "Le bouton d'approbation se trouve juste sous le total, avant le moindre détail, puis de nouveau tout en bas. Il y a exactement un appel à l'action et il apparaît deux fois.",
    ],
    sections: [
      {
        id: "overview",
        heading: "Vue d'ensemble",
        blocks: [
          { p: "Le courriel est construit quand vous appuyez sur **Envoyer** (ou **Renvoyer**, ou **Relancer**) sur la page de la soumission, et ce n'est qu'une fois le message réellement accepté pour livraison que la soumission passe à **Envoyée**. Un envoi qui échoue laisse la soumission en brouillon, garde le bouton Envoyer et ajoute une ligne dans vos notifications — la soumission ne prétend jamais en silence être partie." },
          { p: "Le lien dans le courriel ouvre la page d'approbation. Si la soumission n'avait pas encore de lien client, il est créé au moment de l'envoi, pour qu'un courriel ne contienne jamais de lien mort. Voir [[the-quote-approval-page|La page d'approbation de la soumission]] pour ce que le client y fait." },
          { figure: "live:app-settings-quote-email", caption: "Paramètres → Courriel de soumission — ce que le courriel contient toujours, la liste des Références avec son interrupteur Inclure dans chaque nouvelle soumission, et les paires avant-après." },
        ],
      },
      {
        id: "what-the-client-receives",
        heading: "Ce que le client reçoit, de haut en bas",
        blocks: [
          { bullets: [
            "**De :** le nom de votre entreprise. **Objet :** « Votre soumission de [Votre entreprise] — Q-1042 ». Une relance s'intitule « Suivi : soumission Q-1042 de [Votre entreprise] ».",
            "**La bande de marque** dans votre couleur : votre logo sur une plaque blanche à gauche, le mot du document (**DEVIS**) et le numéro à droite.",
            "« Bonjour [prénom], » puis une phrase d'ouverture : « Merci de nous avoir permis de soumissionner pour votre projet. Tout ce dont nous avons discuté se trouve au lien ci-dessous. »",
            "**TOTAL** avec le montant, et « Valide jusqu'au [date] » quand la soumission a une date d'expiration.",
            "Le bouton **Consulter et approuver votre soumission**, avec « Ou copiez ce lien dans votre navigateur : » et le lien en dessous, pour un logiciel de courriel qui avale les boutons.",
            "L'étendue des travaux, service par service, avec les lignes chiffrées ; **Ce qui est inclus** dans chaque service ; **Ce qui pourrait modifier ce prix** pour les métiers qui en déclarent ; et **Déroulement des travaux**, étape par étape, avec les délais publiés.",
            "**Parlez à d'anciens clients** — les références que vous avez inscrites, nom et numéro de téléphone tels que saisis — quand cette section est activée pour cette soumission.",
            "**Avant et après** — jusqu'à quatre paires de photos avec leur description — quand cette section est activée.",
            "Le bouton de nouveau, puis le pied de page : « Des questions ? Répondez à ce courriel ou appelez le [téléphone]. », le nom de votre entreprise, et votre courriel, téléphone, site web et numéro de taxes, selon ce que vous avez rempli.",
          ] },
          { p: "Le PDF de la soumission est joint sous le nom **Quote-Q-1042.pdf**, produit par le même moteur que Télécharger le PDF et dans la même langue, pour que la pièce jointe et la page disent la même chose. Si le PDF ne peut pas être produit, le courriel part quand même — une soumission sans pièce jointe vaut mieux qu'une qui n'arrive jamais — et le soutien en est informé." },
          { note: "Aucun bloc de financement dans le courriel. Les modalités de paiement échelonné, quand vous les avez saisies, apparaissent sur la page d'approbation sous le total, pas dans le message." },
        ],
      },
      {
        id: "the-language",
        heading: "Dans quelle langue il est rédigé",
        blocks: [
          { p: "Le courriel est dans la langue de la **soumission** — celle dans laquelle elle a été créée — pour que la note d'accompagnement corresponde au document qu'elle porte. Une soumission en français donne un courriel en français et un PDF en français, quelle que soit la langue dans laquelle vous travaillez. Quand une soumission n'a pas de langue propre, c'est la langue du client sur sa fiche qui sert, puis la langue par défaut de votre entreprise. La devise est toujours la vôtre : la langue change le format, jamais l'argent. Voir [[quote-language|Une soumission garde sa langue]]." },
        ],
      },
      {
        id: "what-you-control",
        heading: "Ce que vous contrôlez",
        blocks: [
          { p: "**Paramètres → Courriel de soumission** montre ce que le courriel contient toujours — « Ces sections proviennent de la soumission elle-même : il n'y a donc pas d'interrupteur. Si la soumission le dit, le courriel le dit. » L'étendue des travaux, ce qui est compris, les étapes et ce qui pourrait modifier le prix se modifient par métier sous **Paramètres → Services et tarifs**. Les deux sections facultatives sont à vous de remplir et d'activer :" },
          { table: {
            head: ["Section", "Ce que c'est", "L'interrupteur"],
            rows: [
              ["**Références**", "D'anciens clients qui ont accepté de recevoir un appel, avec **Nom** et **Téléphone**, imprimés exactement comme vous les saisissez. Au plus six sont envoyés.", "**Inclure dans chaque nouvelle soumission** règle le défaut ; le panneau **Sections du courriel** de chaque soumission peut le mettre **Activé** ou **Désactivé** pour cette soumission seulement."],
              ["**Avant et après**", "Des paires de photos de chantiers terminés, les deux moitiés obligatoires, avec une **Description (facultatif)**. Au plus quatre paires sont envoyées.", "Même chose : un défaut d'entreprise, et une exception par soumission sur la page de la soumission."],
            ],
          } },
          { warning: "Une section **Activée** mais vide bloque l'envoi. La page de la soumission dit « Cette section est activée mais vide : la soumission ne peut pas encore être envoyée. » et propose **Ajouter du contenu** ou **Retirer de cette soumission**, puis **Envoyer maintenant**. Une section vide n'est jamais retirée en silence ni envoyée comme un titre au-dessus d'un espace blanc." },
          { p: "La ligne de consentement sur l'écran de paramètres est une règle, pas une décoration : « N'inscrivez que des personnes qui ont réellement accepté ces appels. Leur numéro est transmis à chaque client que vous soumissionnez. »" },
        ],
      },
      {
        id: "when-it-cannot-be-sent",
        heading: "Quand une soumission ne peut pas être envoyée",
        blocks: [
          { bullets: [
            "Le client n'a pas d'adresse courriel sur sa fiche — ajoutez-en une, puis envoyez.",
            "La soumission est une estimation instantanée encore marquée **À réviser** — confirmez d'abord le prix dans **Révision des estimations**.",
            "La soumission dit que la taxe s'applique mais aucun taux n'a pu être déterminé pour l'adresse du client — l'envoi s'arrête plutôt que de promettre un total sans la taxe. Corrigez l'adresse dans la fenêtre et réessayez.",
            "Une section facultative du courriel est activée et vide, comme ci-dessus.",
            "L'entreprise n'a pas terminé son paiement d'abonnement — un essai sans carte peut bâtir des soumissions, pas les envoyer.",
          ] },
        ],
      },
      {
        id: "who-can-send-it",
        heading: "Qui peut l'envoyer",
        blocks: [
          { p: "Envoyer demande le même accès que modifier une soumission : **Soumissions** au niveau **voir, créer et modifier** ou plus — un propriétaire, un administrateur, un Gestionnaire, un Estimateur, ou un accès personnalisé de ce niveau. **Paramètres → Courriel de soumission** demande pour sa part le niveau Gestionnaire ou plus (un propriétaire, un administrateur, un Gestionnaire ou un Répartiteur)." },
        ],
      },
    ],
    faq: [
      { q: "Puis-je changer le texte du courriel ?", a: "Les phrases fixes — la salutation, la phrase d'ouverture, le bouton — appartiennent à FieldQuo et ne se modifient pas. Ce que vous contrôlez, c'est le contenu : le texte de l'étendue des travaux par métier, les références et les photos. Les relances automatiques utilisent plutôt vos propres modèles de courriel." },
      { q: "Le client reçoit-il une copie du PDF ?", a: "Oui, jointe au courriel sous le nom Quote-[numéro].pdf, dans la même langue que le courriel et la page." },
      { q: "Le client dit qu'il n'a rien reçu.", a: "Ouvrez la soumission : si elle est encore en Brouillon et que le bouton Envoyer est là, l'envoi a échoué et vos notifications disent pourquoi. Si elle est Envoyée, demandez-lui de vérifier les promotions et les pourriels, ou ouvrez Faire approuver et copiez-lui directement le lien client." },
      { q: "Pourquoi le courriel est-il en français alors que je travaille en anglais ?", a: "Parce que la soumission a été créée en français. Le courriel suit le document, pas votre écran. Voir [[quote-language|Une soumission garde sa langue]]." },
    ],
  },

  "the-quote-approval-page": {
    title: "La page d'approbation de la soumission",
    summary:
      "La page que le client ouvre depuis le courriel de soumission : le document sur votre papier à en-tête, les options supplémentaires qu'il peut cocher, la signature qu'il donne pour approuver, ce que fait Refuser, et ce qui se passe de votre côté dès qu'il répond.",
    updated: "2026-09-12",
    intro: [
      "Le lien du courriel de soumission ouvre une seule page : la soumission, présentée comme un document sur votre papier à en-tête, avec deux boutons au bas — **Approuver cette soumission** et **Refuser**. Elle est volontairement hors de l'application. Pas de navigation, pas de connexion, pas de marque FieldQuo qui concurrence la vôtre ; elle doit se lire comme un document de l'entreprise qu'ils ont engagée.",
      "L'approbation est une vraie signature. Le client tape son nom, signe dans une case, coche un accord qui nomme le total, et confirme. Un tapotement sur un téléphone en plein soleil ne peut pas créer un contrat par accident.",
    ],
    sections: [
      {
        id: "overview",
        heading: "Vue d'ensemble",
        blocks: [
          { p: "La page est publique pour quiconque détient le lien — un long jeton aléatoire, et la page est tenue hors des moteurs de recherche. Elle ne montre la soumission qu'une fois celle-ci envoyée ; le lien d'un brouillon répond que la soumission n'est pas encore prête. La langue est celle de la soumission, pour que la page, le PDF reçu et le courriel d'accompagnement disent la même chose avec les mêmes mots." },
          { figure: "harness:client-quote-approval", caption: "La page d'approbation telle que le client la voit — le filet de marque, le logo et le téléphone de l'entreprise, le mot du document et Q-1042, Préparé pour, les groupes de travaux avec ce qui est inclus, les termes expliqués, Options supplémentaires, Déroulement des travaux, Modalités de paiement, la bande TOTAL, puis Approuver cette soumission et Refuser." },
        ],
      },
      {
        id: "what-is-on-the-page",
        heading: "Ce qu'il y a sur la page, de haut en bas",
        blocks: [
          { bullets: [
            "Le filet de marque, votre logo (ou votre initiale sur votre couleur), votre nom et votre téléphone ; le mot du document (**DEVIS**) et le numéro à droite.",
            "**Préparé pour** le nom du client, et **Valide jusqu'au** la date quand la soumission en a une.",
            "Une carte numérotée par groupe de travaux — le nom du groupe et son sous-total, une description, les lignes chiffrées avec les quantités, **Ce qui est inclus**, et **Ce qui pourrait modifier ce prix** là où le métier en déclare.",
            "**Les termes de cette soumission, expliqués** — un court glossaire des mots de métier utilisés plus haut (« Shaker », « Rift sawn »).",
            "**Options supplémentaires** — « Cochez ce que vous souhaitez ajouter. Le total se met à jour au fur et à mesure — rien n'est facturé avant votre approbation. » Chaque option a une description et un prix ; une option taxable ajoute sa taxe dès qu'elle est cochée.",
            "**Déroulement des travaux** — les étapes numérotées avec leur semaine ou leur jour, et vos notes de procédé.",
            "**Modalités de paiement** — votre calendrier de paiement en tuiles (« 50 % Dépôt pour réserver », « 50 % Solde à l'installation ») ou votre texte de modalités ; puis **Notes**.",
            "**Sous-total**, **Rabais**, **Taxes** (ou la raison de leur absence), « Comprend les options supplémentaires » quand il y en a de cochées, et la bande **TOTAL**.",
            "**Payer mensuellement** — « Environ 410 $ par mois », la durée et le TAEG, et « Estimation seulement, selon les conditions annoncées par [Votre entreprise]… » — seulement si vous avez saisi un taux et une durée sous financement ; sinon un simple panneau **Financement** avec votre note et un lien **Voir les options de financement**, ou rien.",
            "**Approuver cette soumission** et **Refuser** ; en dessous, « Des questions ? Répondez au courriel ou appelez [Votre entreprise] au [téléphone]. »",
          ] },
        ],
      },
      {
        id: "approving",
        heading: "Comment le client approuve",
        blocks: [
          { steps: [
            "Il coche les **Options supplémentaires** qu'il veut. Le total de la page bouge à mesure ; le navigateur n'envoie jamais que les identifiants des options — le serveur recalcule à partir de ses propres lignes, donc rien sur la page ne peut changer ce qui est facturé.",
            "Il appuie sur **Approuver cette soumission**. La page demande « Approuver cette soumission pour 21 212,89 $ ? » — « Comprend 640,00 $ d'options supplémentaires. Cela leur indique d'aller de l'avant. » quand des options sont cochées.",
            "Il tape **Votre nom complet**, signe dans la case **Signature**, et coche « J'accepte que ma signature ici constitue ma signature électronique et approuve cette soumission pour 21 212,89 $. » Le bouton **Oui, approuver** reste inactif tant que les trois ne sont pas faits.",
            "La page devient **Approuvée — merci** : « [Votre entreprise] a été avisé et vous contactera au sujet des prochaines étapes. »",
          ] },
          { p: "La signature est conservée avec la soumission comme un dossier — le nom, la signature tracée, l'heure, l'adresse IP et le navigateur du client, et une empreinte de ce qui a été approuvé exactement (lignes, options, totaux). Le PDF de la soumission porte ensuite un bloc **Approbation** avec la signature, le nom, la date et « Signé électroniquement »." },
          { note: "Une soumission dont la date **Valide jusqu'au** est passée ne peut pas être approuvée : la page indique **Cette soumission est expirée** — « Contactez [Votre entreprise] pour obtenir un prix à jour. » Il en va de même si elle expire entre l'ouverture de la page et l'appui sur le bouton." },
        ],
      },
      {
        id: "declining",
        heading: "Refuser",
        blocks: [
          { p: "**Refuser** demande « Refuser cette soumission ? » — « Vous pouvez toujours demander une soumission révisée. » — puis **Oui, refuser**. La page devient **Soumission refusée** : « [Votre entreprise] a été avisé. S'il s'agit d'une erreur, appelez-les. » Aucune signature n'est nécessaire pour refuser, et une soumission refusée peut être modifiée et renvoyée." },
        ],
      },
      {
        id: "what-happens-on-your-side",
        heading: "Ce qui se passe de votre côté",
        blocks: [
          { bullets: [
            "La soumission passe à **Approuvée** (ou **Refusée**) avec le total accepté, options comprises. Les propriétaires et les administrateurs reçoivent un courriel — « Sophie Dubois approved Q-1042 — plus $640.00 in extras » — avec le PDF signé en pièce jointe et un lien vers la soumission ; une notification apparaît dans l'application.",
            "Le client reçoit une copie signée par courriel : objet « Approuvée — merci — Q-1042 », « Merci d'avoir approuvé votre soumission avec [Votre entreprise]. Une copie est jointe pour vos dossiers. », de la part de votre entreprise.",
            "Un **chantier** est créé à partir de la soumission, prêt à planifier, et une **facture** en brouillon qui reflète la soumission est produite.",
            "Si votre entreprise a un calendrier de paiement avec une étape **Dépôt pour réserver**, cette étape se déclenche immédiatement : le client reçoit par courriel une demande pour exactement le dépôt, avec un lien pour le payer depuis son portail. Voir [[deposits-and-payment-schedules|Dépôts et calendriers de paiement]].",
            "Le prospect d'où vient la soumission est marqué **Gagné** ou **Perdu**, et une tâche de suivi est créée pour une soumission approuvée.",
          ] },
          { tip: "Si le client a répondu par téléphone, ouvrez **Faire approuver** sur la soumission et utilisez **Consigner leur réponse** — **Ils l'ont approuvée** ou **Ils l'ont refusée** — pour que le pipeline reste juste. Le même écran offre **Lien client** avec **Copier**, **Aperçu de ce qu'ils voient**, et **Remplacer le lien**, qui tue l'ancien lien si la mauvaise personne l'a reçu (tout courriel déjà envoyé cesse de fonctionner)." },
        ],
      },
      {
        id: "who-can-see-it",
        heading: "Qui peut la voir",
        blocks: [
          { p: "La page elle-même est ouverte à quiconque a le lien, et c'est pourquoi le lien n'est envoyé qu'au client. De votre côté, la soumission, son dossier de signature et l'écran Faire approuver suivent votre accès **Soumissions** ; consigner une réponse téléphonique demande le même niveau que modifier la soumission." },
        ],
      },
    ],
    faq: [
      { q: "Le client peut-il changer le prix ou les lignes ?", a: "Non. Il peut cocher ou décocher les options supplémentaires que vous avez offertes, et rien d'autre. Le total est recalculé sur le serveur à partir de vos prix enregistrés, quoi que la page prétende." },
      { q: "La signature est-elle légalement une signature ?", a: "C'est une signature électronique avec un dossier de vérification : nom, signature tracée, heure, adresse IP, navigateur et empreinte du document approuvé, imprimés dans le bloc Approbation du PDF. Savoir si cela satisfait un contrat donné est une question pour votre avocat, pas pour le logiciel." },
      { q: "Le client a approuvé, puis a changé d'idée.", a: "Une soumission ne peut recevoir qu'une seule réponse depuis la page. Modifiez la soumission et renvoyez-la, ou consignez le changement depuis la page de la soumission." },
      { q: "Le client paie-t-il sur cette page ?", a: "Non. L'approbation et le paiement sont séparés. Si vous avez une étape de dépôt, la demande de dépôt est envoyée par courriel juste après l'approbation avec son propre lien de paiement ; sinon la facture suit quand vous l'envoyez. Voir [[the-invoice-email-and-pay-page|Le courriel de facture et la page de paiement]]." },
    ],
  },

  "the-invoice-email-and-pay-page": {
    title: "Le courriel de facture et la page de paiement",
    summary:
      "Ce que le client reçoit quand vous envoyez une facture — un court courriel avec le montant, l'échéance et un bouton Payer en ligne — et la page qu'il ouvre, où il paie par carte ou depuis un compte bancaire et voit la facture marquée payée.",
    updated: "2026-09-12",
    intro: [
      "Appuyer sur **Envoyer** sur une facture envoie au client un court message de la part de votre entreprise, dans la langue de la facture : le montant dû, l'échéance, et un seul bouton. Le bouton ouvre la facture dans le portail du client, où toute la facture est présentée dans vos couleurs et où l'argent est encaissé sur la page de Stripe — au nom de votre entreprise, dans votre propre compte bancaire.",
      "Le courriel est volontairement bref. Contrairement au courriel de soumission, il ne porte ni lignes ni pièce jointe : la page de facture est le document, et le seul travail du courriel est d'y amener le client.",
    ],
    sections: [
      {
        id: "overview",
        heading: "Vue d'ensemble",
        blocks: [
          { p: "L'envoi exige un client avec une adresse courriel, et refuse deux choses plutôt que de deviner : une facture saisie comme chantier passé (rien n'est envoyé pour ceux-là), et une facture qui dit que la taxe s'applique mais n'a pas de taux pour l'adresse du client. La facture passe à **Envoyée** seulement une fois le message accepté pour livraison, et une tâche de relance vous est créée une semaine plus tard." },
          { p: "Le lien ouvre **la page de la facture** dans le portail du client — une page sans connexion, liée au client par un long jeton aléatoire, tenue hors des moteurs de recherche. Voir [[the-client-portal-as-a-client|Le portail client]] pour la page de compte derrière elle." },
          { figure: "harness:client-portal", caption: "Le portail du client — la ligne de facture avec son bouton Payer, telle que le client la voit après avoir ouvert le lien du courriel et être revenu à son compte." },
        ],
      },
      {
        id: "what-the-email-says",
        heading: "Ce que dit le courriel",
        blocks: [
          { bullets: [
            "**De :** le nom de votre entreprise. **Objet :** « Facture INV-2071 de [Votre entreprise] — 10 606,44 $ à payer ».",
            "La bande de marque dans votre couleur avec votre logo, le mot **FACTURE** et le numéro.",
            "« Bonjour [prénom], » puis « Voici la facture INV-2071 pour les travaux réalisés. » — ou, quand une partie a déjà été payée, « Voici le solde de la facture INV-2071, après le versement de 5 000,00 $ déjà reçu. Merci beaucoup. »",
            "Une note quand il y en a une : le message que vous avez tapé sur une demande de paiement, ou le nom de l'étape (« Dépôt ») sur une demande du calendrier de paiement.",
            "**MONTANT DÛ** (ou **SOLDE À PAYER**) avec le montant, puis « Échéance le [date] » — ou « Échue le [date] » en rouge une fois en retard.",
            "Le bouton **Payer en ligne** quand votre compte Stripe peut encaisser ; sinon **Consulter votre facture**, suivi de « Veuillez nous contacter pour organiser le paiement. »",
            "« Modes de paiement acceptés : Cash, E Transfer, Cheque. » — seulement les modes que vous avez cochés sous **Paramètres → Paiements**, et seulement si vous en avez coché.",
            "« Ou copiez ce lien dans votre navigateur : » avec le lien, puis le pied de page : « Des questions ? Répondez à ce courriel ou appelez le [téléphone]. », le nom de votre entreprise, et votre courriel, téléphone, site web et numéro de taxes.",
          ] },
          { note: "Aucun PDF n'est joint, et le client ne peut pas en télécharger un depuis le portail. Le PDF de la facture est à vous de télécharger depuis la page de la facture et d'envoyer à la main si un client demande un fichier." },
        ],
      },
      {
        id: "the-invoice-page",
        heading: "La page de la facture",
        blocks: [
          { bullets: [
            "**Retour à votre compte**, puis une carte blanche avec le filet de marque, votre logo, votre nom, votre téléphone et votre numéro de taxes ; **FACTURE**, le numéro, **Date** et **Échéance** (ou **Était dû** en rouge).",
            "Les lignes : description, quantité et montant, une par rangée — ou « Aucun détail sur cette facture. » Puis **Notes** quand la facture en a.",
            "**Sous-total**, **Rabais**, **Taxes** (un montant, ou **À confirmer**, ou **Aucune**), **Total**, et **Payé** en ligne négative quand un paiement a été enregistré.",
            "Une bande dans votre couleur avec le seul chiffre qui compte : **SOLDE DÛ** et le montant — ou le nom de l'étape et sa part quand le lien vient d'une demande du calendrier de paiement — ou **Payée en totalité** avec le total.",
            "La bande d'action : les boutons de paiement décrits plus bas, ou « Veuillez nous contacter pour organiser le paiement. » et les modes acceptés quand vous ne pouvez pas encaisser de cartes, ou un **Payée en totalité — merci** en vert.",
          ] },
          { note: "La page du portail liste les lignes de la facture à plat. Les groupes de travaux, ce qui est inclus et les étapes qui font de la facture la jumelle de la soumission sont sur le PDF et sur votre propre écran de facture — voir [[invoices-mirror-quotes|Les factures reflètent les soumissions]]." },
        ],
      },
      {
        id: "paying",
        heading: "Comment le client paie",
        blocks: [
          { steps: [
            "Il appuie sur **Payer 10 606,44 $** — ou, une fois que Stripe a activé les paiements bancaires sur votre compte, **Payer 10 606,44 $ par carte** ou **Payer 10 606,44 $ depuis un compte bancaire**, avec la note « Un paiement bancaire prend de 3 à 5 jours ouvrables pour être compensé. D'ici là, la facture apparaît en attente. »",
            "La page hébergée de Stripe s'ouvre au nom de votre entreprise. Le montant est calculé sur le serveur à partir du vrai solde de la facture (ou de la part de l'étape demandée) — le navigateur n'envoie jamais de montant.",
            "Par carte, il revient à son compte avec un « Paiement reçu — merci. Son affichage ci-dessous peut prendre une minute. » en vert, la ligne indique **Payé**, et la page de la facture indique **Payée en totalité — merci**.",
            "Depuis un compte bancaire, il revient à un « Paiement bancaire reçu — il faut de 3 à 5 jours ouvrables pour qu'il soit compensé. La facture apparaîtra comme payée ensuite. » en ambre. La ligne indique **Paiement bancaire en attente** jusqu'à l'arrivée de l'argent ; si la banque le retourne, la page dit « Le paiement bancaire a échoué — [raison]. Vous pouvez réessayer ou payer par carte. » et les boutons reviennent.",
          ] },
          { table: {
            head: ["Mode", "Quand il est offert"],
            rows: [
              ["Carte", "Dès que votre compte Stripe peut encaisser (Paramètres → Paiements indique Stripe connecté · Actif)."],
              ["Compte bancaire — débit préautorisé au Canada, ACH aux États-Unis", "Une fois que Stripe a activé la capacité sur votre compte et que votre devise de facturation correspond (CAD pour le Canada, USD pour les États-Unis). Paramètres → Paiements dit lequel c'est."],
              ["Paiement échelonné (Affirm)", "Sur la page de Stripe seulement, à côté de la carte, quand vous avez activé Proposer le paiement échelonné (Affirm), que la facture est entre 50 $ et 30 000 $, et que la devise est USD ou CAD."],
            ],
          } },
          { p: "Le client ne voit jamais de frais de traitement. Les frais sont retenus de votre côté du paiement ; le total de la facture est ce qu'il paie. Voir [[payment-processing-fees-and-payouts|Frais de traitement des paiements et versements]]." },
          { warning: "FieldQuo n'envoie pas de reçu par courriel au client après un paiement de facture ordinaire — la confirmation est la page elle-même. Vous êtes avisé, le paiement est enregistré sur la facture, et Stripe peut envoyer son propre reçu selon les réglages de votre tableau de bord Stripe." },
        ],
      },
      {
        id: "reminders-and-requests",
        heading: "Rappels et demandes de paiement",
        blocks: [
          { bullets: [
            "**Demander un paiement** sur la facture envoie le même courriel en rappel : objet « 10 606,44 $ à payer — facture INV-2071 », « Un rappel : le solde de la facture INV-2071 est de 10 606,44 $. », avec votre note facultative et le même bouton.",
            "Une **étape du calendrier de paiement** (un dépôt, un versement à mi-parcours) envoie le même courriel avec le nom de l'étape en note et la part de l'étape comme montant ; la page met alors cette part en vedette plutôt que le solde entier. Voir [[progress-payments-by-stage|Paiements progressifs par étape]].",
            "Un **rappel automatique de retard** n'est envoyé que si vous avez créé une règle de relance pour les factures en retard, avec l'un de vos propres modèles de courriel — rien n'est envoyé autrement. Voir [[invoice-reminders-and-chasing|Rappels et relances de factures]].",
          ] },
        ],
      },
      {
        id: "what-you-control",
        heading: "Ce que vous contrôlez",
        blocks: [
          { table: {
            head: ["Où", "Ce que cela change pour le client"],
            rows: [
              ["Paramètres → Paiements — Stripe", "Si le bouton dit Payer en ligne ou Consulter votre facture, et si la page offre la carte, le compte bancaire et Affirm."],
              ["Paramètres → Paiements — Modes de paiement que vous acceptez", "La ligne « Modes de paiement acceptés : » — Comptant, Virement électronique, Chèque — sur le courriel, la page et le PDF."],
              ["Paramètres → Image de marque", "Le logo, la bande de marque, la couleur du bouton et la bande du solde."],
              ["Paramètres → Profil de l'entreprise — Calendrier de paiement", "Les noms d'étapes que le client voit en vedette sur une demande de dépôt ou de versement."],
              ["La langue du client", "Le courriel suit la langue de la facture ; la page suit la langue du client sur sa fiche, puis la langue par défaut de votre entreprise."],
            ],
          } },
          { figure: "live:app-settings-payments", caption: "Paramètres → Paiements — le compte Stripe connecté, si les paiements bancaires sont actifs, et les modes de paiement que vous acceptez." },
        ],
      },
      {
        id: "who-can-send-it",
        heading: "Qui peut l'envoyer",
        blocks: [
          { p: "Envoyer une facture ou une demande de paiement demande **Factures** au niveau **voir, créer et modifier** ou plus. **Paramètres → Paiements** est réservé aux propriétaires et aux administrateurs." },
        ],
      },
    ],
    faq: [
      { q: "Pourquoi le courriel dit-il Consulter votre facture au lieu de Payer en ligne ?", a: "Stripe n'a pas encore activé les paiements sur votre compte. La page affiche alors « Veuillez nous contacter pour organiser le paiement. » et vos modes acceptés. Paramètres → Paiements dit ce que Stripe attend." },
      { q: "Pourquoi la facture est-elle encore impayée des jours après le paiement du client ?", a: "Il a payé depuis un compte bancaire. Un débit bancaire prend de 3 à 5 jours ouvrables pour être compensé ; la facture indique Paiement bancaire en attente jusqu'à l'arrivée de l'argent et n'est marquée payée qu'à ce moment." },
      { q: "Le client peut-il payer une partie du solde ?", a: "Seulement ce que vous demandez. Une demande du calendrier de paiement demande exactement la part de cette étape ; sinon le bouton demande le solde entier." },
      { q: "Le client reçoit-il un reçu ?", a: "Pas de FieldQuo. Il voit la page marquée Payée en totalité — merci, et la ligne dans son compte indique Payé. Un fichier de reçu est à vous d'envoyer à la main." },
    ],
  },

  "the-client-portal-as-a-client": {
    title: "Le portail client",
    summary:
      "La page unique où un client voit ses factures, ce qu'il doit encore et ses soumissions — comment il y arrive, ce qu'elle contient, ce qu'il peut faire ou non, et le fait qu'il n'y a rien à configurer.",
    updated: "2026-09-12",
    intro: [
      "Le portail client est une seule page, sur votre papier à en-tête, intitulée **Compte de [client]** : un solde, les factures qui le composent avec leurs boutons Payer, et les soumissions avec l'état de chacune. Pas de connexion, pas de mot de passe, pas d'application — le lien est la clé, et il n'expire jamais.",
      "Il n'y a rien à activer. Chaque courriel de facture porte déjà un lien vers le portail, donc un client à qui vous avez déjà envoyé une facture a un portail.",
    ],
    sections: [
      {
        id: "overview",
        heading: "Vue d'ensemble",
        blocks: [
          { p: "La page est rédigée dans la langue du client (sa fiche, puis la langue par défaut de votre entreprise), formate l'argent dans votre devise, et dérive chaque couleur de votre couleur de marque, contraste mesuré. Elle est tenue hors des moteurs de recherche et ne montre que ce qui est dû au client et ce qu'il doit — pas de chantiers, pas de visites, pas de photos." },
          { figure: "harness:client-portal", caption: "Le portail tel que le client le voit — le logo de l'entreprise, Compte de Sophie Dubois, Solde dû réparti sur 1 facture, la carte Factures avec Payer 10 606,44 $, et la carte Soumissions avec les pastilles Approuvée et Refusée." },
        ],
      },
      {
        id: "how-the-client-gets-there",
        heading: "Comment le client y arrive",
        blocks: [
          { bullets: [
            "Le bouton **Payer en ligne** / **Consulter votre facture** de chaque courriel de facture, demande de paiement, demande de dépôt ou de versement et facture de plan d'entretien ouvre la page de la facture ; **Retour à votre compte** en haut de celle-ci ouvre le portail.",
            "Après avoir payé sur la page de Stripe, le client est ramené au portail avec une bannière « Paiement reçu ».",
            "Un rappel automatique de retard bâti sur votre propre modèle peut porter le même lien de facture.",
          ] },
          { note: "Il n'y a pas de bouton dans l'application pour copier ou envoyer un lien de portail, et les courriels de soumission n'en portent pas — on atteint le portail par les factures. Le lien est créé une fois par client et réutilisé ; FieldQuo n'offre pas de moyen de le faire expirer ou de le remplacer depuis l'application." },
        ],
      },
      {
        id: "what-is-on-the-page",
        heading: "Ce qu'il y a sur la page",
        blocks: [
          { bullets: [
            "Votre logo (ou votre initiale sur votre couleur), le nom de votre entreprise, et **Compte de [client]**.",
            "**Solde dû** — la somme de toutes les factures émises — puis « Réparti sur 2 factures. » ou « Rien en souffrance. Merci. »",
            "**Factures** — une ligne par facture : le numéro, le total, « 5 000,00 $ payé » quand une partie est réglée, « échéance [date] », et à droite la même action que sur la page de la facture : **Payer 10 606,44 $** (ou **Payer … par carte** et **Payer … depuis un compte bancaire**), **Paiement bancaire en attente**, un crochet **Payé**, ou la ligne pour organiser le paiement. Seule la dernière version d'une facture modifiée est listée.",
            "**Soumissions** — une ligne par soumission envoyée : le numéro, le total, la date, et une pastille — **En attente de votre réponse**, **Approuvée** ou **Refusée** — avec un lien **Consulter** qui ouvre la page d'approbation tant que la soumission attend.",
            "Le pied de page : « Des questions à ce sujet ? Contactez [Votre entreprise] au [téléphone] · [courriel]. »",
          ] },
        ],
      },
      {
        id: "what-the-client-can-do",
        heading: "Ce que le client peut faire, et ne peut pas",
        blocks: [
          { p: "Depuis le portail, un client peut ouvrir une facture, la payer (par carte, depuis un compte bancaire, ou avec Affirm sur la page de Stripe), et ouvrir une soumission en attente pour l'approuver ou la refuser. C'est toute la liste." },
          { bullets: [
            "Il ne peut pas changer son nom, son adresse ou son courriel — cela vit sur sa fiche client, que vous modifiez.",
            "Il ne peut pas télécharger un PDF de facture ou de soumission depuis le portail.",
            "Il ne peut pas voir les chantiers, les visites, les rendez-vous, les photos ou un historique de paiements — le portail ne montre que les factures et les soumissions.",
            "Il ne peut pas vous écrire depuis la page ; le pied de page lui donne votre téléphone et votre courriel.",
          ] },
        ],
      },
      {
        id: "what-you-control",
        heading: "Ce que vous contrôlez",
        blocks: [
          { table: {
            head: ["Où", "Ce que cela change sur le portail"],
            rows: [
              ["Paramètres → Image de marque et Paramètres → Profil de l'entreprise", "Le logo, la couleur, le nom, le téléphone et le courriel du pied de page, le numéro de taxes sur la page de facture."],
              ["Paramètres → Paiements", "Si les boutons Payer apparaissent, si un bouton de compte bancaire est offert, et les modes hors ligne acceptés."],
              ["La langue du client et la langue par défaut de votre entreprise", "La langue de chaque libellé de la page."],
              ["L'envoi", "Ce qui est listé : une facture ou une soumission en brouillon n'est jamais montrée ; seules les envoyées le sont."],
            ],
          } },
          { p: "Il n'y a pas d'écran de paramètres du portail. FieldQuo ne permet pas de cacher la carte des soumissions, d'ajouter un message ou de désactiver le portail." },
        ],
      },
      {
        id: "who-can-see-it",
        heading: "Qui peut le voir",
        blocks: [
          { p: "Quiconque a le lien — et c'est pourquoi il n'est jamais envoyé qu'à l'adresse courriel du client. De votre côté, il n'y a rien à ouvrir : ce que le portail liste est exactement les factures et les soumissions que vous voyez déjà sous **Factures** et **Soumissions**." },
        ],
      },
    ],
    faq: [
      { q: "Comment envoyer à un client son lien de portail ?", a: "Envoyez-lui une facture, ou appuyez sur Demander un paiement sur une facture qu'il a déjà. Les deux courriels portent le lien. Il n'y a pas de bouton distinct pour envoyer le portail." },
      { q: "Le lien expire-t-il ?", a: "Non. Il est créé une fois par client et réutilisé dans chaque courriel, et FieldQuo n'offre pas de moyen de le remplacer depuis l'application." },
      { q: "Le client peut-il voir son prochain rendez-vous dans le portail ?", a: "Non. Les visites se gèrent depuis le lien du courriel de confirmation de rendez-vous — voir [[managing-a-booked-visit|Gérer une visite réservée]]. Le portail ne montre que les factures et les soumissions." },
    ],
  },

  "the-booking-page": {
    title: "La page de rendez-vous",
    summary:
      "Ce qu'un client voit quand il ouvre votre lien de rendez-vous : qui ou quoi réserver, comment se rencontrer, un calendrier de vraies disponibilités, ses coordonnées, des frais de visite si vous en demandez, et la confirmation qui suit.",
    updated: "2026-09-12",
    intro: [
      "Votre lien de rendez-vous ouvre une page avec votre logo, votre nom et la ligne **Book an appointment**. Le client choisit ce qu'il veut, choisit une heure dans un calendrier qui n'offre que les plages que votre équipe peut vraiment tenir, laisse ses coordonnées, paie des frais de visite si vous en demandez, et lit **You're booked**. La plage atterrit sur votre calendrier de rendez-vous avec un badge « Client booking ».",
      "Le calendrier n'est pas une liste de souhaits. Chaque plage est calculée à partir des heures réservables que la personne a réglées sous Paramètres → Disponibilités, moins ses réservations, ses rendez-vous et ses congés approuvés, et — si vous l'activez — moins les heures où elle ne pourrait pas se rendre depuis le chantier précédent.",
    ],
    sections: [
      {
        id: "overview",
        heading: "Vue d'ensemble",
        blocks: [
          { p: "La même page sert trois portes : le lien lui-même, le bouton Réserver de votre site web, et l'extrait à intégrer de **Paramètres → Page de rendez-vous** pour un site que vous avez déjà (dans votre propre page, elle abandonne la bande du logo). L'étape Stripe pour des frais s'ouvre toujours dans la fenêtre entière, jamais dans un cadre." },
          { figure: "harness:client-booking-page", caption: "La page de rendez-vous telle qu'un client la voit — le logo de l'entreprise et Book an appointment, Change service, Kitchen design consultation · 60 min, How would you like to meet?, Where should we come?, et le calendrier avec les heures du matin et de l'après-midi d'une journée." },
          { note: "La page de rendez-vous est rédigée en anglais, quelle que soit la langue de votre entreprise : seules les puces « De quel type de travaux s'agit-il ? » et le champ de notes sont traduits, selon la langue du navigateur du visiteur. Le courriel de confirmation et la page de visite qui suivent sont dans la langue du client." },
        ],
      },
      {
        id: "the-steps",
        heading: "Ce que le client fait",
        blocks: [
          { steps: [
            "**Choisir.** Si des membres de votre équipe ont réglé des heures réservables, la page demande avec qui il veut se rencontrer et les liste avec leur prochaine disponibilité ; sinon elle demande en quoi elle peut aider et liste vos types de rendez-vous avec leur durée et leurs frais éventuels. Une entreprise avec un seul type de rendez-vous saute cette étape.",
            "**Choisir une heure.** La question du mode — « Visit my place », « Phone call » ou « Video call » — n'apparaît que si vous en offrez plus d'un. Pour une visite, un champ d'adresse facultatif permet de cacher les heures où vous ne pourriez pas arriver à temps. Puis la grille du mois et les heures d'une journée sous Matin, Après-midi et Soir.",
            "**Ses coordonnées.** Son nom, son courriel (où la confirmation est envoyée), son téléphone (facultatif), « De quel type de travaux s'agit-il ? » quand vous avez des services activés, et « Autre chose à nous signaler ? ».",
            "**Confirmer.** Le bouton dit « Confirm booking » — ou « Pay $49.00 & book » quand le type de rendez-vous a des frais, après une carte de frais de visite : payés maintenant pour tenir la place, et que votre entreprise peut créditer sur la facture si les travaux vont de l'avant.",
            "**You're booked.** Une confirmation est en route vers son courriel, et votre entreprise le contactera si quelque chose change. Une réservation payante montre d'abord « One more step » et « Continue to secure payment » — le paiement est traité par Stripe et la plage est tenue 30 minutes.",
          ] },
          { p: "Si deux personnes visent la même plage, la seconde lit que la plage vient d'être prise par quelqu'un d'autre et voit un calendrier rafraîchi. Une entreprise sans type de rendez-vous actif montre que la réservation en ligne n'est pas encore configurée, avec votre numéro de téléphone." },
        ],
      },
      {
        id: "what-decides-the-times",
        heading: "Ce qui décide des heures au calendrier",
        blocks: [
          { bullets: [
            "**Les heures réservables** de la personne à qui appartient le type de rendez-vous, réglées sous **Paramètres → Disponibilités**. Une personne sans heures réservables n'offre aucune plage.",
            "**Ce qui est déjà à son calendrier** — réservations confirmées, rendez-vous planifiés, et congés approuvés, qui bloquent la journée entière.",
            "**Le déplacement**, quand **N'offrez pas d'heures où vous ne pouvez pas vous rendre** est activé et que le client a donné une adresse : une plage est cachée s'il ne pourrait pas s'y rendre depuis le chantier précédent (plus votre **Temps supplémentaire entre les chantiers**), ou de là au suivant. Une adresse introuvable montre toutes les heures et le dit.",
            "Les plages commencent toutes les 15 minutes et doivent finir dans la fenêtre réservable ; une nouvelle réservation peut se faire pour n'importe quelle heure future, sans préavis minimum et sans limite d'avance.",
            "Les heures s'affichent dans le fuseau horaire du visiteur. La fenêtre d'arrivée que vous promettez apparaît dans le courriel de confirmation et sur la page de visite, pas au calendrier.",
          ] },
        ],
      },
      {
        id: "the-visit-fee",
        heading: "Les frais de visite",
        blocks: [
          { p: "Un type de rendez-vous peut porter des **Frais de visite** et, au choix, un **Prix promo** affiché avec le prix courant barré tant que **Promo activée** est coché. Les frais sont perçus par carte seulement, sur la page de Stripe, dans votre compte connecté ; pendant que le client paie, la plage est tenue 30 minutes et le rendez-vous n'est créé qu'une fois le paiement réglé. Une réservation qui n'est pas payée à temps est libérée, et apparaît d'ici là sur votre tableau de bord comme en attente de paiement." },
          { p: "Des frais ne sont perçus que si Stripe peut encaisser sur votre compte ; sans Stripe, le même type de rendez-vous est simplement gratuit. Ce qui arrive aux frais si le client annule relève de votre politique **Modifications et annulations** — voir [[managing-a-booked-visit|Gérer une visite réservée]] et [[booking-fees-and-visit-deposits|Frais de réservation et dépôts de visite]]." },
        ],
      },
      {
        id: "after-they-book",
        heading: "Après la réservation",
        blocks: [
          { bullets: [
            "Le client reçoit un courriel de votre entreprise, dans sa langue : objet « Confirmé : Kitchen design consultation avec [Votre entreprise] », **Votre rendez-vous est confirmé**, **Quand** (avec votre fenêtre d'arrivée, si vous en promettez une) et **Où**, et le bouton pour modifier ou annuler la visite. FieldQuo n'envoie pas de texto de confirmation ; un texto de rappel ne part que si vous en avez configuré un.",
            "De votre côté, le client est retrouvé par son courriel ou créé, et la visite apparaît sous **Rendez-vous** avec un badge « Client booking », assignée à la personne dont c'est le calendrier, avec l'adresse et les notes tapées par le client.",
            "FieldQuo ne vous envoie ni courriel ni notification pour une nouvelle réservation — le calendrier en est la trace. Vous recevez un courriel quand un client la déplace ou l'annule plus tard.",
          ] },
        ],
      },
      {
        id: "what-you-control",
        heading: "Ce que vous contrôlez",
        blocks: [
          { table: {
            head: ["Réglage sur Paramètres → Page de rendez-vous", "Ce que cela change sur la page"],
            rows: [
              ["**Combien de temps dure une visite?**", "La durée de la consultation que FieldQuo crée pour chaque membre de l'équipe qui règle des heures réservables."],
              ["**Comment les clients peuvent-ils vous rencontrer?** — Se rendre chez eux · Appel téléphonique · Appel vidéo", "Les modes de rencontre offerts par la page ; avec plus d'un, le client choisit."],
              ["**N'offrez pas d'heures où vous ne pouvez pas vous rendre** et **Temps supplémentaire entre les chantiers**", "Si une adresse cache les plages inatteignables, et combien de marge s'ajoute au trajet."],
              ["**Que promettez-vous au client?** — Heure exacte ou ± 15 / 30 / 60 min", "Ce que disent le courriel de confirmation et la page de visite sous Quand."],
              ["Chaque type de rendez-vous — **Durée**, **Actif**, **Frais de visite**, **Prix promo**, **Promo activée**", "Ce qui est listé, pour combien de temps, et à quel prix ; un type inactif disparaît de la page."],
              ["**Nouveau type de rendez-vous**", "Ajoute un genre de rendez-vous qu'un client peut réserver lui-même."],
            ],
          } },
          { figure: "live:app-settings-booking-page", caption: "Paramètres → Page de rendez-vous — l'extrait à intégrer, Combien de temps dure une visite?, les modes de rencontre, le déplacement et la fenêtre d'arrivée, Modifications et annulations, et une carte par type de rendez-vous." },
        ],
      },
      {
        id: "who-can-see-it",
        heading: "Qui peut la voir",
        blocks: [
          { p: "La page est publique. **Paramètres → Page de rendez-vous** demande le niveau Gestionnaire ou plus — un propriétaire, un administrateur, un Gestionnaire ou un Répartiteur. Chaque membre de l'équipe règle ses propres heures réservables sous **Paramètres → Disponibilités**, et c'est ce qui le place sur la page." },
        ],
      },
    ],
    faq: [
      { q: "Pourquoi la page montre-t-elle un choix de personne plutôt que mes types de rendez-vous ?", a: "Parce qu'au moins un membre de l'équipe a réglé des heures réservables ; la page liste alors les personnes, chacune avec sa propre consultation. Les types de rendez-vous sont listés quand personne ne l'a fait." },
      { q: "Un client peut-il réserver demain matin à minuit ce soir ?", a: "Oui, si la plage est libre — la page n'applique aucun préavis minimum à une nouvelle réservation. Le préavis que vous réglez sous Modifications et annulations s'applique au déplacement ou à l'annulation, pas à la réservation." },
      { q: "Où vont les frais de visite ?", a: "Dans votre compte Stripe connecté, comme un paiement de facture. Le courriel de confirmation n'en parle pas ; la page de visite les montre comme un dépôt payé." },
      { q: "Puis-je mettre le calendrier sur mon propre site web ?", a: "Oui — Paramètres → Page de rendez-vous offre l'extrait à intégrer. Voir [[embed-booking-and-quote-forms|Intégrer les formulaires de rendez-vous et de soumission sur n'importe quel site]]." },
    ],
  },

  "managing-a-booked-visit": {
    title: "Gérer une visite réservée",
    summary:
      "La page derrière le bouton de modification ou d'annulation du courriel de confirmation : ce que le client voit, comment il déplace ou annule une visite dans votre préavis, ce qui arrive aux frais de visite, et ce qu'on vous dit.",
    updated: "2026-09-12",
    intro: [
      "Chaque courriel de confirmation de rendez-vous porte un seul bouton pour modifier ou annuler la visite. Il ouvre une page sur votre papier à en-tête avec les détails de la visite et deux choix — **Changer l'heure** et **Annuler ce rendez-vous** — tant que votre préavis le permet. Dans cette fenêtre, la page le dit, avec des mots qui nomment votre politique, et lui donne plutôt votre numéro de téléphone.",
      "L'argent suit vos règles, pas celles du client. Des frais payés sont reportés quand il déplace la visite, et sur une annulation ils ne sont remboursés que si vous l'avez activé et qu'il a annulé à temps.",
    ],
    sections: [
      {
        id: "overview",
        heading: "Vue d'ensemble",
        blocks: [
          { p: "Le lien est un long jeton aléatoire créé à la confirmation de la réservation ; il est dans le courriel de confirmation et dans le courriel envoyé après un déplacement, et dans aucun texto. La page est rédigée dans la langue de la soumission à laquelle la visite se rapporte, sinon dans la langue par défaut de votre entreprise." },
          { figure: "harness:client-visit-manage", caption: "La page de visite telle que le client la voit — Votre rendez-vous, Kitchen design consultation, Au sujet de votre soumission Q-1042, Quand avec la fenêtre d'arrivée, Où avec Nous nous déplaçons chez vous, Dépôt de 49,00 $ payé, puis Changer l'heure et Annuler ce rendez-vous." },
        ],
      },
      {
        id: "what-is-on-the-page",
        heading: "Ce qu'il y a sur la page",
        blocks: [
          { bullets: [
            "Votre logo et votre nom, **Votre rendez-vous**, le type de rendez-vous, et **Au sujet de votre soumission Q-1042** quand la visite est liée à une soumission.",
            "**Quand** — la fenêtre d'arrivée que vous promettez (« entre 8 h 30 et 10 h 30 ») ou l'heure exacte, dans le fuseau horaire de votre entreprise.",
            "**Où** — l'adresse avec « Nous nous déplaçons chez vous », ou « Appel téléphonique — nous vous appellerons », ou « Appel vidéo — nous vous enverrons un lien par courriel ».",
            "**Dépôt de 49,00 $ payé** quand des frais de visite ont été perçus.",
            "**Besoin de changer quelque chose ?** avec **Changer l'heure** et **Annuler ce rendez-vous** — ou, quand la visite ne peut plus être modifiée ici, la raison et « Appelez [Votre entreprise] au [téléphone] — ils peuvent encore le déplacer pour vous. »",
            "« Des questions ? Appelez [Votre entreprise] au [téléphone]. »",
          ] },
        ],
      },
      {
        id: "changing-the-time",
        heading: "Changer l'heure",
        blocks: [
          { steps: [
            "Il appuie sur **Changer l'heure**. **Choisissez une nouvelle heure** montre le même calendrier que la page de rendez-vous, n'offrant que les plages libres et à au moins votre préavis de distance.",
            "Il choisit une journée et une heure et appuie sur **Déplacer mon rendez-vous ici** (ou **Garder mon heure actuelle** pour reculer).",
            "La page indique **Votre rendez-vous a été déplacé** — « [Votre entreprise] a été avisé, et une nouvelle confirmation vous sera envoyée. » Des frais déjà payés sont reportés ; rien n'est facturé ni remboursé.",
          ] },
          { p: "Si la plage est partie à quelqu'un d'autre entre-temps : « Cette heure vient d'être prise. Choisissez-en une autre. » Si elle est trop proche : « Cette heure ne leur laisse pas assez de préavis. Choisissez-en une plus tardive. »" },
        ],
      },
      {
        id: "cancelling",
        heading: "Annuler, et ce qui arrive aux frais",
        blocks: [
          { p: "**Annuler ce rendez-vous** demande « Annuler ce rendez-vous ? » — « [Votre entreprise] en sera avisé immédiatement, et votre plage horaire sera libérée. » — avec **Garder mon rendez-vous** et **Oui, annuler**. Sous la question, quand des frais ont été payés, l'une de trois phrases dit ce que votre politique en fera :" },
          { table: {
            head: ["Ce que dit la page", "Quand"],
            rows: [
              ["« Votre dépôt de 49,00 $ sera remboursé sur la carte utilisée. »", "**Rembourser les frais de visite en cas d'annulation à temps** est activé, et il annule avec au moins le préavis de remboursement."],
              ["« Votre dépôt de 49,00 $ n'est pas remboursé automatiquement — communiquez avec eux à ce sujet. »", "L'interrupteur de remboursement est désactivé (le défaut), ou il est à l'intérieur du préavis de remboursement."],
              ["« Votre dépôt de 49,00 $ a déjà été remboursé. »", "Vous l'avez remboursé à la main avant son annulation."],
            ],
          } },
          { p: "Après **Oui, annuler**, la page indique **Rendez-vous annulé** — « [Votre entreprise] a été avisé. S'il s'agit d'une erreur, communiquez avec eux et ils vous trouveront un autre moment. » — et, quand un remboursement s'applique, « Votre dépôt de 49,00 $ est en route. Quelques jours peuvent s'écouler avant qu'il paraisse sur votre relevé. » Le remboursement est le montant réellement payé, retourné sur la même carte ; les frais de traitement de la carte ne vous sont pas rendus. Si Stripe ne peut pas faire le remboursement, rien n'est annulé et la page le dit." },
        ],
      },
      {
        id: "when-it-cannot-be-changed",
        heading: "Quand la page refuse",
        blocks: [
          { bullets: [
            "« [Votre entreprise] demande un préavis d'au moins 24 heures; ce rendez-vous ne peut donc plus être modifié ici. » — à l'intérieur de votre préavis. Le nombre est le vôtre.",
            "« Ce rendez-vous a déjà eu lieu. » / « Ce rendez-vous a déjà été annulé. »",
            "« Ce rendez-vous n'est pas encore confirmé — le paiement n'est pas passé. » — des frais encore en cours de paiement.",
            "Un lien inconnu ou remplacé donne une simple page indiquant que le lien n'est pas valide.",
          ] },
        ],
      },
      {
        id: "what-you-see",
        heading: "Ce que vous voyez de votre côté",
        blocks: [
          { bullets: [
            "Le rendez-vous est déplacé ou marqué annulé sous **Rendez-vous** ; l'ancienne plage redevient réservable immédiatement.",
            "L'adresse courriel de votre entreprise reçoit une lettre : une réservation a été déplacée — « [Client] a déplacé sa Kitchen design consultation avec le lien de son courriel de confirmation. » — ou une réservation a été annulée, avec la mention que les frais de visite de 49,00 $ ont été remboursés automatiquement selon votre politique, ou qu'ils n'ont PAS été remboursés.",
            "Le client reçoit le miroir : **Votre rendez-vous a été déplacé** avec la nouvelle heure, ou l'avis d'annulation avec la phrase sur les frais.",
          ] },
          { note: "La lettre de bureau va à l'adresse courriel de l'entreprise sous Paramètres → Profil de l'entreprise. Il n'y a pas de notification dans l'application pour un déplacement ou une annulation par le client." },
        ],
      },
      {
        id: "what-you-control",
        heading: "Ce que vous contrôlez",
        blocks: [
          { table: {
            head: ["Réglage sous Paramètres → Page de rendez-vous → Modifications et annulations", "Ce qu'il fait"],
            rows: [
              ["**Préavis nécessaire pour modifier ou annuler** (heures)", "Jusqu'à quelle proximité de la visite la page offre encore Changer l'heure et Annuler ce rendez-vous ; 24 heures si vous ne l'avez jamais réglé. Une nouvelle heure doit aussi être au moins aussi éloignée."],
              ["**Rembourser les frais de visite en cas d'annulation à temps**", "Désactivé tant que vous ne l'activez pas. Désactivé, une annulation passe et les frais vous restent."],
              ["**Préavis nécessaire pour être remboursé** (heures)", "Seulement avec l'interrupteur activé. Vide signifie le même préavis que ci-dessus ; plus long crée une fenêtre où il peut encore annuler mais où les frais vous restent."],
              ["**Que promettez-vous au client?**", "Si Quand montre une heure exacte ou une fenêtre d'arrivée."],
            ],
          } },
          { p: "Les lignes d'aperçu sous les champs vous redisent la politique avec les mots du client — « Les clients peuvent annuler ou déplacer une visite jusqu'à 24 heures avant son début. Passé ce délai, ils doivent vous téléphoner. » — pour que la phrase sur la page du client et votre réglage ne puissent pas se contredire." },
        ],
      },
      {
        id: "who-can-change-it",
        heading: "Qui peut la modifier",
        blocks: [
          { p: "La page du client est ouverte à quiconque détient le lien. La politique sous **Paramètres → Page de rendez-vous** demande le niveau Gestionnaire ou plus — un propriétaire, un administrateur, un Gestionnaire ou un Répartiteur." },
        ],
      },
    ],
    faq: [
      { q: "Le client peut-il déplacer une visite à demain à 20 h ce soir ?", a: "Seulement si votre préavis le permet. Avec 24 heures de préavis, la visite qu'il déplace et la nouvelle heure doivent toutes deux être à au moins une journée ; sinon la page lui dit de vous appeler." },
      { q: "Le client a annulé et les frais n'ont pas été remboursés. Pourquoi ?", a: "L'interrupteur de remboursement est désactivé par défaut — des frais de visite sont votre argent dès qu'ils sont perçus. Activez Rembourser les frais de visite en cas d'annulation à temps, ou remboursez-les à la main depuis le paiement." },
      { q: "Déplacer une visite facture-t-il quelque chose ?", a: "Non. Des frais déjà payés sont reportés à la nouvelle heure ; la page du client et les deux courriels le disent." },
    ],
  },

  "the-instant-estimate-page": {
    title: "La page d'estimation instantanée",
    summary:
      "Ce qu'un client voit sur votre lien d'estimation instantanée : les questions par métier, les photos exigées, la fourchette affichée — ou volontairement non affichée — le courriel qu'il reçoit, et la révision que votre équipe fait avant que quoi que ce soit devienne une soumission.",
    updated: "2026-09-12",
    intro: [
      "Votre lien d'estimation instantanée ouvre une page intitulée « Get an instant estimate » : un formulaire à gauche, un panneau **Votre estimation** à droite. Le client choisit un métier, décrit les travaux, ajoute des photos et ses coordonnées, et — selon ce que vous avez choisi pour ce métier — voit une fourchette estimée à mesure qu'il tape, après l'envoi, ou pas du tout. Chaque envoi atterrit sur votre écran **Révision des estimations** et ne peut pas être envoyé comme soumission tant qu'une personne n'a pas confirmé le prix.",
      "Deux choses ne sont jamais sur cette page : une grille de tarifs, et un chiffre unique. Le point d'accès public renvoie vos services et leurs questions, jamais vos tarifs ; ce que le client voit est une fourchette calculée sur le serveur à partir de vos propres chiffres.",
    ],
    sections: [
      {
        id: "overview",
        heading: "Vue d'ensemble",
        blocks: [
          { p: "La page porte votre logo, votre nom et votre couleur, et — contrairement à un lien de soumission ou de portail — n'est pas cachée des moteurs de recherche. Par l'extrait à intégrer de **Paramètres → Soumissions instantanées**, elle se place aussi dans n'importe quel site web que vous avez déjà. Un métier n'y apparaît que si sa carte est **Activé** et que FieldQuo peut vraiment produire un chiffre à partir des tarifs que vous avez enregistrés." },
          { figure: "harness:client-instant-estimate", caption: "L'estimation instantanée telle qu'un client la voit — le logo de l'entreprise, le titre « Get an instant estimate », le choix du métier, les questions sur la propriété, les tranches de budget, l'adresse des travaux, les coordonnées, et le panneau d'estimation qui attend à droite." },
          { note: "La page et son courriel existent en anglais et en français seulement, selon la langue par défaut de votre entreprise ; en français, les questions du formulaire restent en anglais et seuls le panneau, les messages et le courriel sont traduits. Une entreprise dont la langue par défaut est l'espagnol obtient la page anglaise." },
        ],
      },
      {
        id: "what-the-homeowner-fills-in",
        heading: "Ce que le client remplit",
        blocks: [
          { bullets: [
            "**What do you need?** — vos métiers en ligne, en puces (toiture, refinition d'armoires, peinture, enlèvement de rebuts, et ainsi de suite).",
            "**Tell us about the property** — les questions de ce métier : une adresse pour la toiture (le toit est mesuré par imagerie satellite), une pelouse tracée sur une carte pour la tonte, une superficie en pieds carrés avec un choix d'état ou d'accès, un compte de portes et de tiroirs pour les armoires, un nombre de marches, ou les articles à enlever.",
            "**Which option?** — les matériaux que vous avez tarifés, par nom seulement, quand il y en a plus d'un.",
            "**Your budget** — quatre tranches dans votre devise (« Moins de 1 000 $ », « 1 000 $ – 5 000 $ »…). Le navigateur envoie la tranche choisie, jamais un montant.",
            "**Where's the job?** — une adresse avec autocomplétion (la toiture en a déjà une).",
            "**Your details** — un nom et un courriel ou un numéro de téléphone.",
            "**Photos** — au moins une photo, une vidéo ou un plan est exigé.",
            "Le bouton : « Get my estimate », ou « Reveal my estimate » quand la fourchette est montrée après l'envoi. Tant qu'il manque quelque chose, il le liste, jusqu'à la photo manquante.",
          ] },
          { p: "Le formulaire ne demande pas quand ils veulent que les travaux soient faits — c'est une conversation pour la soumission." },
        ],
      },
      {
        id: "what-they-see",
        heading: "Ce qu'ils voient, selon votre choix par métier",
        blocks: [
          { table: {
            head: ["Ce que voit le propriétaire (Paramètres → Soumissions instantanées)", "Sur la page", "Après l'envoi, et dans le courriel"],
            rows: [
              ["**Ne pas afficher de prix**", "« Nous ne publions pas nos prix en ligne pour ce service. Laissez-nous vos coordonnées et nous confirmerons votre prix sous peu. »", "« Aucun prix n'est affiché ici : nous examinons chaque projet et vous envoyons votre soumission nous-mêmes. » Le courriel dit que la soumission se prépare, sans chiffre."],
              ["**Afficher la fourchette après l'envoi**", "Un « $X,XXX – $X,XXX » flouté avec un cadenas : **Soumettez pour voir votre estimation**. Le chiffre n'est jamais envoyé à la page avant l'envoi.", "La fourchette apparaît dans le panneau, et le courriel la porte."],
              ["**Afficher la fourchette immédiatement**", "La fourchette se met à jour à mesure qu'ils décrivent les travaux, avant toute coordonnée.", "La même fourchette, sur la page et dans le courriel."],
            ],
          } },
          { p: "Une fourchette se lit **Fourchette estimée** « 4 200 $ – 5 500 $ » dans votre devise, puis ce qui l'a mesurée et une phrase disant que c'est une estimation, pas une soumission finale, et que votre entreprise la confirmera avant tout engagement. Si les travaux tombent sous votre frais minimum, le panneau le dit. Après l'envoi, une carte de confirmation dit que votre entreprise a ses coordonnées et confirmera sa soumission sous peu — avec une référence Q-2026-0042, et un panneau **Réserver une visite** quand votre page de rendez-vous est configurée." },
          { p: "Le financement, quand vous l'avez activé, est une phrase dans vos propres mots et un bouton facultatif **Voir les options de financement**. Aucune mensualité n'est montrée sur cette page ; elle n'apparaît que sur la page d'approbation de la soumission, quand vous avez saisi un taux et une durée." },
        ],
      },
      {
        id: "after-they-submit",
        heading: "Après l'envoi",
        blocks: [
          { bullets: [
            "S'il a donné un courriel, il reçoit « Votre estimation de [Votre entreprise] » de la part de votre entreprise — la fourchette dans un encadré marqué « avant taxes » quand elle était montrée sur la page, le même avertissement, un bouton **Réserver une visite** quand vous prenez des rendez-vous, et la référence.",
            "De votre côté, une soumission en brouillon est créée, marquée **À réviser**, avec la fourchette vue par le client, son budget déclaré, la mesure, ses photos et un prospect noté d'après la tranche de budget. Tous ceux qui peuvent approuver des estimations sont avisés : « L'estimation Q-2026-0042 pour [client] attend une validation ».",
            "La soumission attend sur **Révision des estimations** avec la fourchette que le client a vue et son budget, et un montant **Approuver à** que vous pouvez changer avant d'appuyer sur **Approuver**. D'ici là, **Envoyer** sur la soumission refuse : cette estimation instantanée n'a pas encore été approuvée — confirmez le prix dans Révision des estimations, puis envoyez. Le lien de partage refuse de la même façon.",
            "Une fois approuvée, la soumission se lit **Approuvée — prête à envoyer** et part comme toute autre. Voir [[estimate-reviews|Révision des estimations]].",
          ] },
        ],
      },
      {
        id: "what-is-never-shown",
        heading: "Ce qui n'est jamais montré",
        blocks: [
          { p: "La page publique reçoit vos métiers, leurs questions, vos noms de matériaux et vos tranches de budget — jamais un tarif, un supplément ou un minimum. Chaque chiffre est calculé sur le serveur à partir des lignes que vous avez enregistrées, et le navigateur n'envoie jamais que des quantités, une adresse ou un contour, et une tranche de budget. Publier une grille de tarifs ouvertement la remettrait à chaque concurrent de la ville ; la page est bâtie pour que ce soit impossible." },
        ],
      },
      {
        id: "what-you-control",
        heading: "Ce que vous contrôlez",
        blocks: [
          { table: {
            head: ["Sur Paramètres → Soumissions instantanées", "Ce que cela change"],
            rows: [
              ["**Activé** / **Désactivé** sur chaque carte de métier, et **Enregistrer et activer**", "Si le métier est offert. Une carte dont les tarifs ne peuvent pas produire de chiffre indique « Les propriétaires ne peuvent pas encore obtenir de prix pour ce service. » et ne peut pas être activée."],
              ["**Ce que voit le propriétaire**", "Les trois modes du tableau ci-dessus, par métier. Le défaut est Ne pas afficher de prix."],
              ["**Tranches de budget**", "Les trois seuils derrière les quatre puces parmi lesquelles le client choisit."],
              ["**Matériaux et prix de vente**, les suppléments, **Largeur de la fourchette (±)** et **Frais minimum**", "Les chiffres à partir desquels la fourchette est calculée, et sa largeur."],
              ["**Financement**", "La phrase, le lien du fournisseur, et — pour la page d'approbation — votre taux et votre durée annoncés."],
              ["**Voir ce que voient les propriétaires** et l'extrait à intégrer", "Ouvre la page publique ; l'extrait la place sur votre propre site."],
            ],
          } },
          { figure: "live:app-settings-instant-quotes", caption: "Paramètres → Soumissions instantanées — le compte de services en ligne, Voir ce que voient les propriétaires, l'extrait à intégrer, et une carte par métier avec son interrupteur, Ce que voit le propriétaire, et les tarifs." },
        ],
      },
      {
        id: "who-can-see-it",
        heading: "Qui peut la voir",
        blocks: [
          { p: "La page est publique. Ouvrir **Paramètres → Soumissions instantanées** demande l'option des prix dans votre accès — un Estimateur peut la lire, l'Équipe non — et modifier les tarifs ou activer un métier est réservé aux propriétaires et aux administrateurs. Approuver une estimation dans Révision des estimations demande le niveau Gestionnaire ou plus." },
        ],
      },
    ],
    faq: [
      { q: "Un client peut-il voir mes tarifs ?", a: "Non. La page reçoit les services, les questions, les noms de matériaux et les tranches de budget ; chaque chiffre est calculé sur le serveur à partir de tarifs qui n'en sortent jamais." },
      { q: "Pourquoi un métier n'apparaît-il pas sur la page ?", a: "Sa carte est Désactivé, ou ses tarifs ne peuvent pas encore produire de chiffre — la carte dit ce qui manque — ou, pour la peinture, ni Peinture intérieure ni Peinture extérieure n'est activée sous Services et tarifs." },
      { q: "La fourchette est-elle une soumission ?", a: "Non. C'est un brouillon marqué À réviser ; une personne confirme le prix dans Révision des estimations avant qu'elle puisse être envoyée, et la page comme le courriel le disent au client." },
      { q: "Pourquoi la page est-elle en anglais pour mon entreprise francophone ?", a: "Elle suit la langue par défaut de votre entreprise, et existe en anglais et en français. Réglez le défaut sur le français sous Paramètres → Langue et le panneau, les messages et le courriel passent au français ; les questions du formulaire restent en anglais." },
    ],
  },
};
