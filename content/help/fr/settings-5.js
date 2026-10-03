// content/help/fr/settings-5.js
//
// settings-business-number — Paramètres → Numéro d'entreprise. Same
// structure as content/help/en/settings-5.js.
export const ARTICLES = {
  "settings-business-number": {
    title: "Votre numéro d'entreprise",
    summary:
      "Gardez le numéro que vos clients connaissent déjà, et retrouvez chaque appel et texto reçu sur la demande ou le chantier dans FieldQuo.",
    updated: "2026-10-03",
    intro: [
      "**Paramètres → Numéro d'entreprise** fait entrer dans FieldQuo le numéro inscrit sur votre camion et vos factures. Les textos qu'on y envoie arrivent dans votre boîte FieldQuo, liés au bon client, à la bonne demande ou au bon chantier, et vos réponses partent de ce numéro. Seuls les propriétaires et administrateurs voient cet écran.",
    ],
    sections: [
      {
        id: "which-path",
        heading: "Par où votre numéro entre",
        blocks: [
          { p: "Tapez le numéro et appuyez sur **Vérifier**. FieldQuo détermine le type de ligne et l'affiche sous forme de pastille — par exemple **Cellulaire · Bell Mobilité** — puis propose le seul chemin possible pour ce type de ligne." },
          { bullets: [
            "**Un cellulaire ou une ligne Internet (VoIP)** — le numéro est transféré vers FieldQuo. Les appels font alors sonner les téléphones que vous choisissez, et les textos arrivent dans la boîte de réception.",
            "**Une ligne fixe ou un numéro sans frais** — les appels restent chez votre fournisseur tels quels, et seuls les textos passent à FieldQuo.",
            "**Tout numéro hors des États-Unis et du Canada** — pas encore offert. L'écran le dit.",
          ] },
          { note: "Une ligne VoIP doit être transférée plutôt que de garder ses appels, parce que Twilio — l'opérateur qu'utilise FieldQuo — n'héberge pas les textos sur les lignes VoIP." },
        ],
      },
      {
        id: "move",
        heading: "Transférer un numéro de cellulaire",
        blocks: [
          { steps: [
            "Inscrivez le titulaire du compte et l'adresse de service exactement comme sur la facture de votre fournisseur, votre numéro de compte et votre NIP de transfert.",
            "Téléversez une facture récente (PDF ou photo, moins de 4 Mo).",
            "Cochez les trois avertissements et signez l'autorisation en tapant votre nom.",
            "Appuyez sur **Transférer mon numéro**. L'écran suit ensuite la demande : autorisation signée, facture téléversée, numéro de compte et NIP, et les jours d'attente chez votre fournisseur.",
          ] },
          { warning: "Votre fournisseur enverra un texto au téléphone pour approuver le transfert. Répondez dans les 90 minutes, sinon il est annulé. Comptez 5 à 7 jours ouvrables, jusqu'à 4 semaines; ensuite, le numéro ne fonctionne plus sur votre carte SIM — demandez un nouveau numéro à votre fournisseur pour le téléphone, ou annulez cette ligne, et vérifiez d'abord les frais de résiliation de votre contrat." },
          { tip: "Votre NIP et votre numéro de compte sont conservés chiffrés seulement le temps du transfert, puis supprimés. Pour un numéro américain, ils vont directement à Twilio et ne sont jamais conservés." },
        ],
      },
      {
        id: "texts-only",
        heading: "Transférer les textos d'une ligne fixe ou d'un numéro sans frais",
        blocks: [
          { steps: [
            "Inscrivez le nom du propriétaire, un courriel pour l'autorisation, un téléphone où vous joindre et l'adresse du propriétaire, puis appuyez sur **Commencer le transfert des textos**.",
            "Quand l'écran l'indique, appuyez sur **Appeler le numéro maintenant** et restez près de ce téléphone. Twilio l'appelle et demande le code affiché à l'écran.",
            "Signez l'autorisation que Twilio vous envoie par courriel.",
            "Le fournisseur bascule les textos, généralement en 1 à 3 jours ouvrables. Vos appels ne sont jamais touchés.",
          ] },
          { note: "Si le numéro peut déjà envoyer des textos par une autre entreprise — une appli de textos ou une option de textos d'affaires de votre fournisseur — Twilio le refuse. L'écran vous dit de demander à cette entreprise de retirer les textos du numéro, puis de recommencer." },
        ],
      },
      {
        id: "once-moved",
        heading: "Une fois transféré",
        blocks: [
          { bullets: [
            "**Les appels sonnent** — jusqu'à trois téléphones que vous choisissez sonnent ensemble. Sans réponse, l'appel va à votre réceptionniste IA si elle est activée, sinon à une messagerie vocale enregistrée dans la conversation. Réglez-le sous **Où sonnent les appels**.",
            "**Les textos** — arrivent dans la boîte de réception avec une alerte sur le téléphone, classés sous le client, la demande ou le chantier; le premier texto d'un inconnu devient une demande comme un message Facebook.",
            "**Les appels sortants** — appuyez sur **Appeler** sur une demande, un client ou un chantier. FieldQuo fait sonner votre téléphone; appuyez sur 1 et il appelle le client, qui voit votre numéro d'entreprise. Les appels sont permis de 9 h à 20 h à l'heure du client, jamais vers quelqu'un qui a demandé de ne pas être appelé, et ne sont pas enregistrés.",
          ] },
        ],
      },
      {
        id: "cost",
        heading: "Ce que ça coûte",
        blocks: [
          { p: "Tout est pris sur votre solde téléphonique (celui de la réceptionniste) : 4,00 $ par mois pour le numéro, facturés dès la mise en service, 2 ¢ par texto, 5 ¢ par photo et, sur un numéro transféré, 5 ¢ la minute pour les appels qu'on vous transfère ou que vous passez avec le bouton Appeler. L'écran affiche une estimation mensuelle d'après vos textos des 30 derniers jours avant que vous commenciez. FieldQuo ne facture rien pour transférer le numéro." },
        ],
      },
    ],
    faq: [
      { q: "Puis-je annuler?", a: "Oui, avec Annuler cette demande, tant que le numéro n'est pas actif. Une fois actif, contactez-nous pour le transférer ailleurs, afin que vos clients ne soient pas coupés en pleine conversation." },
      { q: "Est-ce que ça fonctionne dans un compte de démonstration?", a: "Les écrans fonctionnent, mais rien n'est envoyé à un fournisseur et aucun numéro n'est transféré." },
    ],
  },
};
