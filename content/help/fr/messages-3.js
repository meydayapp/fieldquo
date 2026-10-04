// content/help/fr/messages-3.js
//
// Partie 3 de la catégorie « messages » en français (voir le compositeur,
// messages.js). Même structure que content/help/en/messages-3.js — sections,
// blocs et FAQ dans le même ordre, vérifiés par scripts/check-help-centre.mjs.
export const ARTICLES = {
  "fetch-older-facebook-and-instagram-history": {
    title: "Récupérer l'historique Facebook et Instagram plus ancien",
    summary:
      "Faites entrer les conversations et les réponses de formulaires antérieures à la connexion — discrètement, sans alertes ni réponses automatiques, et sans doublons.",
    updated: "2026-10-03",
    intro: [
      "Quand vous connectez votre Page Facebook, FieldQuo importe tout de suite les conversations récentes. **Historique plus ancien** va plus loin : chaque conversation Messenger et Instagram que Facebook renvoie encore, et les 90 derniers jours de réponses aux formulaires que Facebook conserve.",
    ],
    sections: [
      {
        id: "where",
        heading: "Où le trouver",
        blocks: [
          {
            bullets: [
              "**Conversations :** Paramètres › Publicités Meta, sur la carte Facebook et Instagram, sous la ligne d'importation — **Historique plus ancien**.",
              "**Formulaires :** Paramètres › Publicités Meta, dans le panneau des formulaires, dès qu'au moins un formulaire est activé.",
            ],
          },
          { p: "Chaque ligne indique combien de conversations, de messages ou de prospects sont arrivés, jusqu'à quelle date, la dernière exécution, et si Facebook a demandé une pause." },
        ],
      },
      {
        id: "what-happens",
        heading: "Ce qui se passe pendant la récupération",
        blocks: [
          {
            steps: [
              "Elle démarre seule après la connexion de la Page, et quand vous activez un formulaire. **Récupérer plus ancien** la relance depuis le début quand vous le voulez.",
              "Elle avance par tranches, plusieurs fois par heure, et reprend exactement là où elle s'était arrêtée. Si Facebook demande de ralentir, la ligne indique **En pause** et l'heure de reprise.",
              "Chaque conversation est enregistrée avec tous les messages que Facebook renvoie, y compris ceux au-delà des cinquante plus récents.",
              "Chaque réponse de formulaire devient un prospect, sauf si la personne est déjà dans votre tableau (voir [[facebook-leads-checked-against-your-records|Prospects Facebook vérifiés contre vos dossiers]]).",
            ],
          },
        ],
      },
      {
        id: "quiet",
        heading: "L'historique ne réveille personne",
        blocks: [
          {
            bullets: [
              "Les conversations antérieures au point de départ de votre boîte arrivent **marquées terminées**, sans badge non lu ni compteur d'attente. Un message récent dans la même conversation l'ouvre comme d'habitude.",
              "Aucune réponse automatique ni brouillon de l'employé IA n'est écrit pour l'historique.",
              "Les prospects de plus d'un jour sont ajoutés sans alerte **nouveau prospect**, et le prospect indique **Importé de l'historique Facebook**. Un formulaire rempli ce matin n'est pas de l'historique — il est annoncé comme tout autre prospect.",
            ],
          },
          { note: "Lancer la récupération deux fois ne crée jamais de doublon : chaque message et chaque prospect est reconnu par l'identifiant de Facebook." },
        ],
      },
    ],
    faq: [
      {
        q: "Pourquoi seulement 90 jours de formulaires ?",
        a: "Facebook conserve les réponses aux formulaires pendant 90 jours. Au-delà, elles ne sont plus disponibles pour aucune application.",
      },
      {
        q: "L'analyse des anciennes conversations utilise-t-elle mon crédit IA ?",
        a: "Seulement pour les conversations où le client a écrit pour la dernière fois dans les 90 derniers jours, et au plus 25 par exécution. Les plus anciennes sont vérifiées contre vos dossiers sans IA, gratuitement.",
      },
    ],
  },

  "photos-and-videos-from-facebook-and-instagram": {
    title: "Photos et vidéos de Facebook et Instagram",
    summary:
      "Les photos, vidéos, messages vocaux et fichiers envoyés sur Messenger et Instagram sont copiés dans FieldQuo pour ne jamais expirer — et un échec dit pourquoi.",
    updated: "2026-10-03",
    intro: [
      "Le lien que Facebook donne pour une pièce jointe expire au bout d'un moment. FieldQuo copie donc chaque photo, vidéo, message vocal et fichier dans son propre stockage en une minute environ, et la conversation affiche la copie, pas le lien de Facebook.",
    ],
    sections: [
      {
        id: "states",
        heading: "Ce que vous voyez dans la conversation",
        blocks: [
          {
            bullets: [
              "**En cours d'arrivée :** la copie n'est pas encore terminée.",
              "**La photo, la vidéo, le lecteur ou le fichier :** la copie est faite et reste.",
              "**Impossible à récupérer, avec la raison et un bouton Réessayer :** par exemple un fichier trop lourd, ou un lien que Facebook avait déjà fait expirer.",
            ],
          },
        ],
      },
      {
        id: "limits",
        heading: "Limites de taille",
        blocks: [
          { p: "Messenger et Instagram transportent des pièces jointes jusqu'à 25 Mo, et FieldQuo accepte la même chose. WhatsApp a ses propres limites, plus petites, par type." },
          { tip: "Une pièce jointe dont le lien avait expiré est récupérée de nouveau automatiquement à la prochaine actualisation de la conversation depuis Facebook, car Facebook fournit alors un lien neuf." },
        ],
      },
      {
        id: "history",
        heading: "Conversations plus anciennes",
        blocks: [
          { p: "Les pièces jointes de l'historique récupéré avec **Historique plus ancien** sont copiées de la même façon. Une photo déjà copiée n'est jamais téléchargée de nouveau quand la même conversation est récupérée une deuxième fois." },
        ],
      },
    ],
  },

  "facebook-leads-checked-against-your-records": {
    title: "Prospects Facebook vérifiés contre vos dossiers",
    summary:
      "Comment FieldQuo repère un prospect Facebook que vous avez déjà, l'intègre au lieu de créer une copie, et vous permet d'annuler.",
    updated: "2026-10-03",
    intro: [
      "La même personne remplit souvent votre formulaire Facebook et écrit aussi à votre Page. FieldQuo vérifie chaque prospect Facebook contre vos prospects ouverts, vos conversations Messenger et Instagram et vos clients avant de l'ajouter.",
    ],
    sections: [
      {
        id: "same-person",
        heading: "Quand c'est la même personne",
        blocks: [
          {
            bullets: [
              "**Lié :** le même courriel, le même numéro de téléphone (si les noms ne se contredisent pas), le même identifiant Facebook ou Instagram, ou le même nom complet **et** la même adresse.",
              "**Seulement affiché, jamais lié :** un nom seul, un téléphone familial partagé avec des noms différents, ou le même nom à une autre adresse.",
            ],
          },
          { p: "Une réponse de formulaire qui correspond à un prospect ouvert est intégrée à ce prospect au lieu d'en créer un deuxième. Le prospect ne reçoit que ce qui lui manquait — un téléphone ou un courriel vide, la campagne — et le panneau l'affiche sous **Même personne**, avec ce que disait le formulaire." },
        ],
      },
      {
        id: "undo",
        heading: "Pas la même personne ? Annulez",
        blocks: [
          {
            steps: [
              "Ouvrez le prospect et trouvez **Même personne** dans le panneau.",
              "Appuyez sur **Pas la même personne** sur le lien erroné, puis confirmez.",
            ],
          },
          { p: "Rien n'est supprimé. Une réponse de formulaire intégrée redevient un prospect distinct, ce que le lien avait rempli est remis tel quel si personne ne l'a modifié depuis, et ces deux ne seront plus jamais liés." },
        ],
      },
      {
        id: "review",
        heading: "L'analyse des messages",
        blocks: [
          { p: "Pour une conversation Messenger, Instagram ou WhatsApp, le panneau du prospect et la conversation affichent un verdict avec ses preuves :" },
          {
            table: {
              head: ["Verdict", "Ce que cela veut dire"],
              rows: [
                ["Vrai prospect", "La personne veut des travaux. Un prospect est créé."],
                ["Pas un prospect", "Spam, mauvais numéro, quelqu'un qui cherche un emploi, ou un fournisseur qui vend quelque chose. Aucun prospect."],
                ["Client existant", "Un client déjà au dossier. Un prospect n'est créé que s'il demande de nouveaux travaux, et il est rattaché à ce client."],
                ["Déjà converti", "Un devis, un chantier ou une facture existe déjà pour cette personne. Aucun nouveau prospect — les documents sont listés."],
              ],
            },
          },
          { p: "Qui est la personne vient de vos dossiers, gratuitement. Si elle veut des travaux vient de l'IA, payée par votre crédit IA. Sans crédit IA, l'analyse le dit et seuls les verdicts fondés sur les dossiers apparaissent." },
          { tip: "Si l'analyse a relié une conversation au mauvais client, appuyez sur **Pas ce client** dans la conversation." },
        ],
      },
      {
        id: "scoring",
        heading: "Une note juste pour les prospects Facebook",
        blocks: [
          { p: "Un budget ou un délai manquant ne compte contre un prospect que si le formulaire posait vraiment la question. Les formulaires Facebook, les conversations et les prospects saisis à la main sont notés sur ce qu'ils peuvent recueillir, et les raisons indiquent **Budget inconnu** ou **Délai inconnu — non compté**." },
        ],
      },
    ],
  },
};
