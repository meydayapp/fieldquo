// content/help/fr/integrations-2.js — partie 2 de « integrations » en français.
// Même structure que la version anglaise ; voir content/help/en/integrations-2.js.
export const ARTICLES = {
  "google-calendar": {
    title: "Mon calendrier",
    summary:
      "Connectez votre propre Google Agenda : chaque visite qui vous est assignée y apparaît et se déplace quand le bureau la déplace, et vos rendez-vous personnels empêchent qu'on vous réserve — sans que personne dans l'entreprise ne voie de quoi il s'agit.",
    updated: "2026-09-20",
    intro: [
      "**Réglages → Mon calendrier** est l'une des lignes que chaque membre voit, parce que rien ici n'appartient à l'entreprise : c'est là que vont **vos** visites, et ce que **vos** autres engagements bloquent. La page compte une section pour l'instant, **Connecter Google Agenda**, et elle fonctionne dans les deux sens à la fois.",
      "FieldQuo crée et met à jour uniquement ses propres événements ; il ne modifie jamais les vôtres. Cette phrase est imprimée à l'écran et c'est toute la règle : les événements écrits par FieldQuo portent une marque privée, et FieldQuo ne touche jamais qu'un événement qui la porte.",
    ],
    sections: [
      {
        id: "overview",
        heading: "Ce qu'il y a à l'écran",
        blocks: [
          { p: "Avant la connexion : un bouton **Connecter Google Agenda**. Après : **Connecté en tant que votre@gmail.com depuis le 20 sept. 2026**, deux interrupteurs — **Écrire mes visites dans Google Agenda** et **Utiliser mes indisponibilités Google** — un bouton **Déconnecter**, et un lien **Reconnecter** pour le jour où Google vous redemandera de vous identifier. Si la dernière synchronisation a échoué, la raison est imprimée sous l'adresse en une ligne." },
          { note: "Sur un déploiement FieldQuo où la connexion Google n'est pas encore configurée, la section le dit en une phrase et n'affiche aucun bouton. Un bouton qui ne peut pas fonctionner est pire qu'aucun." },
        ],
      },
      {
        id: "what-goes-to-google",
        heading: "Ce que FieldQuo écrit dans votre agenda",
        blocks: [
          { bullets: [
            "Chaque **rendez-vous, visite de chantier et réservation qui vous est assigné** — créé à l'assignation, déplacé quand le bureau ou le client le déplace, retiré quand il est annulé ou confié à quelqu'un d'autre ; une visite terminée reste comme historique.",
            "Le titre dit ce que c'est et pour qui : **Visite sur place — Jane Doe**, **Rappel — Jane Doe**, **Appel vidéo — Jane Doe**, ou le titre du chantier pour une visite d'équipe. Le lieu est l'adresse du chantier, donc la navigation Google Maps fonctionne directement depuis l'événement. La description porte le lien FieldQuo.",
            "Un **appel vidéo** reçoit un lien Google Meet créé avec l'événement, et le même lien est inscrit sur la réservation pour que la confirmation du client puisse le porter.",
            "Rien d'autre. FieldQuo ne lit jamais les titres de vos événements et n'écrit jamais rien qui ne soit pas l'un des siens.",
          ] },
          { warning: "Supprimez un événement FieldQuo à la main et il revient à la synchronisation suivante, parce que la visite est toujours réservée. Annulez-la plutôt dans FieldQuo." },
        ],
      },
      {
        id: "what-google-tells-fieldquo",
        heading: "Ce que votre agenda dit à FieldQuo",
        blocks: [
          { p: "Avec **Utiliser mes indisponibilités Google** activé, les créneaux que votre propre agenda marque comme occupés comptent comme occupés dans FieldQuo — sur la page de réservation publique, pour la réceptionniste téléphonique, pour l'employé IA et pour un répartiteur qui déplace une visite sur vous. Seulement les heures, jamais les titres : FieldQuo pose à Google une seule question, *quand cette personne est-elle occupée ?*, et la réponse de Google ne contient aucun mot. La page du calendrier dessine ces blocs en gris, étiquetés **occupé (Google)**, et rien de plus." },
          { p: "Désactivez-le et votre agenda personnel n'est plus lu du tout. Désactivez **Écrire mes visites** et chaque événement créé par FieldQuo quitte votre agenda immédiatement ; réactivez-le et ils reviennent." },
        ],
      },
      {
        id: "disconnect",
        heading: "Se déconnecter",
        blocks: [
          { steps: [
            "Appuyez sur **Déconnecter** et confirmez.",
            "Chaque événement créé par FieldQuo est retiré de votre agenda — chacun vérifié d'abord pour la marque FieldQuo, donc rien de vôtre n'est touché.",
            "L'accès de FieldQuo est révoqué chez Google et l'identifiant stocké est supprimé. Vos visites restent dans FieldQuo exactement comme elles étaient.",
          ] },
        ],
      },
    ],
    faq: [
      { q: "Mon gestionnaire peut-il voir ce qu'il y a dans mon agenda personnel ?", a: "Non. FieldQuo reçoit des intervalles d'occupation sans titre, et les montre comme des blocs gris qui disent seulement occupé (Google)." },
      { q: "Dans quel agenda écrit-il ?", a: "Votre agenda Google principal, sous le compte que vous avez choisi sur l'écran de consentement de Google." },
      { q: "Pourquoi Google avertit-il que l'application n'est pas vérifiée ?", a: "Tant que la vérification Google de FieldQuo est en attente, seuls les comptes que FieldQuo a inscrits comme testeurs peuvent se connecter, et Google montre d'abord un écran d'avertissement. Demandez au soutien de vous ajouter si l'écran vous refuse." },
      { q: "Est-ce que cela remplace le flux d'abonnement ?", a: "Non. Un flux auquel on s'abonne est à sens unique et en lecture seule ; cette connexion écrit dans votre agenda et lit vos indisponibilités. Utilisez celui qui vous convient, ou les deux." },
    ],
  },
};
