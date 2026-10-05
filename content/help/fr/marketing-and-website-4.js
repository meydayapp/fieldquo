// content/help/fr/marketing-and-website-4.js
//
// Partie 4 de la catégorie « marketing-and-website » (fr) : Résultats
// marketing — app/app/marketing/results, calculés par lib/agency/metrics.js
// (le même code que l'API de l'agence marketing). Lu le 2026-10-05.
export const ARTICLES = {
  "marketing-results": {
    title: "Résultats marketing",
    summary:
      "Ce que vos publicités ont produit, présenté comme le tableau de bord d'une agence marketing — dépenses, demandes, rendez-vous, contrats, revenus et rendement des dépenses publicitaires, chacun comparé à la période précédente.",
    updated: "2026-10-05",
    intro: [
      "**Marketing → Résultats marketing** répond à une question : qu'est-ce que l'argent dépensé en publicité a rapporté? La page suit chaque demande arrivée pendant une période jusqu'au rendez-vous, à la soumission, au contrat et au paiement, et met les dépenses publicitaires en face.",
      "Elle montre exactement les chiffres que votre agence marketing voit par [[settings-agency-access|l'accès de l'agence marketing]], calculés par le même code — quand l'agence rapporte un coût par contrat, vous pouvez ouvrir cette page et le vérifier.",
    ],
    sections: [
      {
        id: "how-it-counts",
        heading: "Comment elle compte",
        blocks: [
          { p: "La période choisit des **demandes** — celles arrivées pour la première fois pendant la période — et chaque chiffre suivant est ce que ces demandes sont devenues, peu importe quand. Une demande de mars conclue en mai compte comme un contrat de mars. C'est ce qui garde les chiffres cohérents : une étape ne peut jamais dépasser la précédente, et un rendez-vous est compté une fois par demande." },
          { p: "Chaque chiffre est comparé à la **période précédente de même durée** : ce mois-ci jusqu'à maintenant (disons 5 jours) contre les 5 jours d'avant; le mois dernier contre les 30 ou 31 jours d'avant." },
          { p: "Chaque chiffre a un bouton **i** avec sa définition exacte. Un chiffre sans données pour le calculer affiche **—** et dit pourquoi, jamais un 0 qui n'en est pas un." },
        ],
      },
      {
        id: "the-figures",
        heading: "Les chiffres",
        blocks: [
          { table: {
            head: ["Chiffre", "Ce que c'est"],
            rows: [
              ["Dépenses publicitaires", "Ce que vos comptes publicitaires Meta et Google connectés ont dépensé pendant la période. Affiche **—** quand aucun n'est connecté."],
              ["Demandes · Coût par demande", "Chaque demande arrivée, les froides comprises · dépenses ÷ demandes."],
              ["Rendez-vous · Taux de rendez-vous · Coût par rendez-vous", "Demandes qui ont réservé une visite en personne, une fois chacune · ÷ demandes · dépenses ÷ rendez-vous."],
              ["Contrats conclus · Taux de conclusion · Coût par contrat", "Demandes dont la soumission a été acceptée · contrats après une visite ÷ rendez-vous · dépenses ÷ contrats."],
              ["Revenus · Encaissé", "La valeur acceptée des contrats · ce qui a vraiment été payé jusqu'ici."],
              ["Rendement des dépenses publicitaires · Valeur moyenne des travaux", "Revenus ÷ dépenses · revenus ÷ contrats."],
              ["Rendez-vous à venir · Taux de conclusion ajusté", "Visites dont la date n'est pas arrivée · contrats après une visite ÷ visites qui ont eu lieu (sans celles à venir ni les annulées)."],
              ["Délais de conversion", "Jours médians de la demande au rendez-vous, du rendez-vous à la soumission, de la soumission au contrat, et de la demande au contrat."],
            ],
          } },
          { note: "Des travaux obtenus sans visite en personne comptent quand même comme un contrat, et sont montrés à part sous **Conclus sans visite**." },
        ],
      },
      {
        id: "the-funnel",
        heading: "Du premier message au contrat conclu",
        blocks: [
          { p: "L'entonnoir commence par les **messages venant des publicités** — chaque conversation Facebook, Instagram et WhatsApp commencée à partir d'une publicité, simples touches comprises — puis les **vraies conversations** parmi elles, puis les demandes, les demandes qualifiées (tièdes ou chaudes, ou prouvées par une visite réservée), les rendez-vous, les soumissions envoyées après la visite et les contrats. Le **délai de réponse** est le temps médian entre le premier message d'une personne et votre première réponse." },
          { p: "Plus bas, **Par source** répartit les demandes selon leur provenance, et **Par campagne** met les dépenses de chaque campagne en face des demandes et contrats qui la nomment." },
          { p: "Utilisez **Source** et **Campagne** en haut pour regarder un seul canal ou une seule campagne. Une source sans dépenses publicitaires (votre site Web, une recommandation) n'affiche aucun coût plutôt que d'emprunter l'argent des publicités." },
        ],
      },
    ],
    faq: [
      { q: "Pourquoi ces chiffres diffèrent-ils de ceux de Meta?", a: "Meta compte ses propres événements — toucher un bouton de clavardage est une « conversation » pour Meta. Cette page compte des personnes : combien ont écrit de vrais mots, sont devenues des demandes, ont réservé et ont payé. Voir [[marketing-spend|Dépenses marketing]] pour les chiffres de Meta côte à côte." },
      { q: "Qui peut l'ouvrir?", a: "Les propriétaires, les administrateurs et les gestionnaires — les mêmes personnes qui voient les Dépenses marketing." },
    ],
  },
};
