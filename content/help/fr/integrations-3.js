// content/help/fr/integrations-3.js
//
// Partie 3 de la catégorie « integrations » (fr) : l'accès de l'agence
// marketing (lib/agency/). Lu sur l'écran des paramètres, l'API qu'il ouvre
// et la frontière de confidentialité (lib/agency/leadRow.js), le 2026-10-05.
export const ARTICLES = {
  "settings-agency-access": {
    title: "Donner l'accès à votre agence marketing",
    summary:
      "Créez une clé pour l'agence qui gère vos publicités, pour qu'elle voie quelles demandes sont devenues des rendez-vous, des contrats et des revenus — les coordonnées des clients restant privées sauf si vous choisissez de les partager.",
    updated: "2026-10-05",
    intro: [
      "Une agence qui gère vos publicités Facebook, Instagram ou Google ne peut optimiser que ce qu'elle voit. Sans vous, elle voit des clics et des formulaires remplis; elle n'apprend jamais lesquelles de ces personnes ont réservé une visite, signé une soumission et payé. **Paramètres → Accès de l'agence marketing** lui donne cette moitié : chaque demande qu'elle a amenée, jusqu'où elle s'est rendue, et ce que valaient les travaux.",
      "L'agence se connecte avec une **clé** que vous y créez. Elle lit vos résultats par l'API de FieldQuo — directement ou par Zapier — et la clé est la seule chose qui dit quelle entreprise elle lit. Vous pouvez créer une clé par agence, voir chaque appel de chaque clé et en révoquer une à tout moment.",
    ],
    sections: [
      {
        id: "create-a-key",
        heading: "Créer une clé",
        blocks: [
          { steps: [
            "Ouvrez **Paramètres → Accès de l'agence marketing** (propriétaires et administrateurs).",
            "Sous **Créer une clé**, tapez le nom de l'agence — c'est ainsi que vous reconnaîtrez la clé plus tard.",
            "Laissez **Permettre aussi à cette agence d'ajouter et de mettre à jour des demandes** décoché, sauf si l'agence gère ses propres pages ou formulaires et doit vous envoyer ces demandes (voir plus bas).",
            "Appuyez sur **Créer la clé**. La clé apparaît une seule fois : copiez-la et envoyez-la à l'agence. FieldQuo n'en garde qu'une empreinte; elle ne peut pas être réaffichée — si elle est perdue, révoquez-la et créez-en une autre.",
          ] },
          { p: "L'agence met la clé dans ses propres outils. La référence d'API dont elle a besoin est liée depuis l'écran : **Ce que l'agence peut voir (référence de l'API)**, à fieldquo.com/developers/marketing-api." },
        ],
      },
      {
        id: "what-the-agency-sees",
        heading: "Ce que l'agence voit",
        blocks: [
          { p: "Chaque demande arrive à l'agence sous forme d'une ligne. Par défaut, la ligne est construite pour n'identifier personne :" },
          { bullets: [
            "une **référence privée** comme **L-7F3A** — aléatoire, la même pour toute la vie de la demande, jamais tirée d'un numéro de téléphone ou d'un courriel;",
            "le **prénom** seulement;",
            "la date du premier contact et le **canal** : publicité Facebook, publicité Instagram, Google Ads, l'entonnoir de l'agence, votre site Web, une recommandation ou organique;",
            "la **publicité** qui l'a amenée quand on la connaît — campagne, ensemble de publicités et publicité, l'identifiant de clic (fbclid ou gclid) et les balises UTM;",
            "son niveau de qualification (le niveau de la conversation et la température chaude / tiède / froide), et l'heure de chaque étape : qualifiée, première réponse, rendez-vous réservé, date et issue du rendez-vous, soumission envoyée, vue, acceptée ou refusée, facturée, payée, travaux terminés;",
            "le service demandé et le service vendu;",
            "**une partie du code postal** — le code ZIP à 5 chiffres aux États-Unis, les trois premiers caractères au Canada. Jamais l'adresse civique;",
            "la **raison de la perte**, si votre équipe en a inscrit une.",
          ] },
          { p: "Deux options sur le même écran changent cela :" },
          { table: {
            head: ["Option", "Par défaut", "Ce qu'elle ajoute"],
            rows: [
              ["**Partager les coordonnées avec mon agence marketing**", "Désactivée", "Nom complet, numéro de téléphone, courriel et code postal complet. L'adresse civique n'est toujours jamais partagée."],
              ["**Partager la valeur des travaux**", "Activée", "Montants des soumissions, montants obtenus et sommes payées — ce dont l'agence a besoin pour les revenus et le rendement des dépenses publicitaires. Désactivée, elle ne voit que les nombres."],
            ],
          } },
          { note: "Chaque changement de ces options est inscrit dans votre journal d'activité avec la personne qui l'a fait. Désactiver les coordonnées s'applique à la prochaine lecture de l'agence — y compris les événements qui attendaient d'être envoyés." },
        ],
      },
      {
        id: "zapier-and-events",
        heading: "Zapier et les événements en direct",
        blocks: [
          { p: "En plus de lire, une agence peut s'abonner à des **événements** pour que son tableau de bord se mette à jour dès que quelque chose arrive : une demande arrive, devient qualifiée ou change d'étape; une visite est réservée (une estimation sur place) ou marquée tenue, absence, reportée ou annulée; une soumission est envoyée, vue, acceptée ou refusée; des travaux sont terminés; une facture est payée; un paiement est reçu. Chaque événement porte la même ligne privée." },
          { p: "Votre agence peut utiliser l'application Zapier de FieldQuo, ou appeler l'API depuis n'importe quel outil capable de faire une requête Web. Les événements partent une fois l'action qui les a causés terminée; rien de ce que fait votre équipe n'attend l'agence." },
          { note: "Une fois l'heure d'une visite passée, le calendrier demande ce qui s'est passé — **Tenue**, **Absence**, **Reportée** ou **Annulée** — et la personne assignée reçoit dans la journée qui suit un rappel « Cette visite a-t-elle eu lieu? ». Une visite passée que personne n'a marquée est déclarée **non marquée**, jamais comme tenue ni comme une absence." },
        ],
      },
      {
        id: "adding-leads",
        heading: "Permettre à l'agence d'ajouter et de mettre à jour des demandes",
        blocks: [
          { p: "Cocher **Permettre aussi à cette agence d'ajouter et de mettre à jour des demandes** à la création d'une clé lui permet quatre choses de plus, et aucune autre :" },
          { bullets: [
            "**Ajouter une demande** venant de l'entonnoir de l'agence. Elle arrive sur votre tableau des demandes comme toute autre, marquée comme venant de l'entonnoir de votre agence marketing, évaluée de la même façon. Si le même courriel ou le même téléphone vous a déjà écrit dans les six derniers mois, aucune deuxième demande n'est créée.",
            "**Faire avancer une demande dans votre pipeline** — selon les mêmes règles que votre tableau : Gagnée seulement avec une soumission acceptée ou des travaux derrière, Perdue seulement avec une raison.",
            "**Fixer la plage demandée pour une visite**, affichée sur la demande. Elle ne change jamais une visite déjà réservée, son heure ni qui y va.",
            "**Trouver une demande par courriel ou téléphone**, avec la même ligne privée en réponse.",
          ] },
          { warning: "Aucune clé ne peut texter, écrire ou envoyer un message à vos clients. C'est voulu : une tierce partie ne doit pas pouvoir parler à vos clients en votre nom." },
          { p: "Tout ce qu'une clé ajoute ou change figure dans votre journal d'activité au nom de l'agence." },
        ],
      },
      {
        id: "revoke",
        heading: "Voir ce que fait une clé, et la révoquer",
        blocks: [
          { p: "Chaque clé indique qui l'a créée et quand, sa dernière utilisation, le nombre d'appels des 7 derniers jours et les événements auxquels elle est abonnée. **Appels récents** liste chaque requête avec son heure et son résultat." },
          { p: "**Révoquer** arrête la clé immédiatement : chaque requête est refusée et ses Zaps ne reçoivent plus d'événements. Une clé révoquée reste listée sous **Clés révoquées**, comme trace de qui avait accès et quand." },
        ],
      },
    ],
    faq: [
      { q: "L'agence peut-elle voir les données d'une autre entreprise?", a: "Non. La clé appartient à votre entreprise et est la seule chose qui décide quelles données une requête lit." },
      { q: "Le soutien de FieldQuo peut-il créer une clé pour moi?", a: "Non. Une session de soutien peut voir cet écran mais ne peut ni créer ni révoquer de clé, ni changer ce qui est partagé." },
      { q: "Puis-je vérifier les chiffres de l'agence?", a: "Oui — Marketing → Résultats marketing montre les mêmes chiffres, calculés par le même code. Voir [[marketing-results|Résultats marketing]]." },
    ],
  },
};
