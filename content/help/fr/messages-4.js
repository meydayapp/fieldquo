// content/help/fr/messages-4.js
//
// Partie 4 de la catégorie « messages » en français (voir messages.js).
// Mêmes slugs, même structure que content/help/en/messages-4.js ; les
// libellés viennent du bloc `fr` de app/i18n/appMessages.js.
export const ARTICLES = {
  "ai-employee-reference-library": {
    title: "La bibliothèque de référence de l'employé IA : les manuels qu'il lit",
    summary:
      "Téléversez les manuels de l'équipement que vous installez — des PDF lus page par page et gardés privés — et votre employé IA y puise ses réponses en citant la page.",
    updated: "2026-10-04",
    intro: [
      "**Paramètres → Employé IA → Bibliothèque de référence** contient tout ce dont vos employés IA peuvent se servir pour répondre : votre politique, vos notes de dépannage et les manuels des fabricants de ce que vous installez. Chaque employé lit la même bibliothèque, et une réponse nomme le document — et, pour un PDF, la page — d'où elle vient.",
    ],
    sections: [
      {
        id: "what-it-reads",
        heading: "Ce que vous pouvez téléverser",
        blocks: [
          { bullets: [
            "**Un manuel PDF** — stocké en privé et lu page par page. Il n'est jamais montré à vos clients ; l'assistant le reformule et cite la page.",
            "**Une liste de codes .xlsx ou .csv** — lue comme du texte.",
            "**Du texte brut** (.txt, .md), ou du texte collé avec **Coller du texte à la place**.",
            "Les fichiers Word ne sont pas encore lus — collez le texte ou exportez-le en .txt. Un PDF protégé par un mot de passe est refusé avec la raison : enregistrez une copie sans mot de passe et téléversez-la.",
          ] },
          { p: "Jusqu'à 400 pages d'un même PDF sont lues. Au-delà, la ligne indique **Les pages après la 400e n'ont pas été lues — divisez le PDF pour ajouter la suite.**" },
        ],
      },
      {
        id: "pages",
        heading: "Pages lues, pages numérisées",
        blocks: [
          { p: "Chaque ligne PDF indique ce qui a réellement été lu : **41 pages lues sur 42**. Une page qui n'est qu'une image numérisée n'a pas de texte à lire, et la ligne la nomme : **Pages 12–14 illisibles (numérisées)**. Un PDF entièrement numérisé est marqué non lu — jamais comme prêt." },
          { p: "**Lire les pages numérisées avec l'IA — environ 28 crédits** lit ces pages à partir de leurs images, avec le modèle d'IA standard de FieldQuo, payé par votre crédit IA. Le prix figure sur le bouton avant que vous appuyiez (environ 2 crédits pour une page, 28 pour soixante). Les pages sont rendues dans votre navigateur à partir de votre propre copie — si vous rechargez l'écran, il vous demande de **Choisir de nouveau le même PDF** et vérifie que c'est bien le même fichier avant tout envoi." },
          { note: "La lecture des PDF texte est gratuite — elle se fait dans le code, sans IA. Seules la lecture des pages numérisées et l'extraction des codes d'erreur ci-dessous utilisent du crédit IA, et seulement quand vous appuyez sur leur bouton." },
        ],
      },
      {
        id: "tags",
        heading: "Les étiquettes : le bon manuel d'abord",
        blocks: [
          { p: "Les **Étiquettes** d'une ligne prennent une **Marque**, un **Modèle (ou son début)**, l'**Équipement, p. ex. fournaise** et un **Métier**. Quand la conversation d'un client dont l'équipement est enregistré arrive, le manuel étiqueté pour cette marque et ce modèle est lu en premier ; puis vos autres documents, ceux que le message nomme d'abord. La quantité de documents envoyée avec une réponse n'augmente pas — les étiquettes décident de l'ordre, pas du volume." },
        ],
      },
      {
        id: "codes",
        heading: "Les codes d'erreur de vos manuels",
        blocks: [
          { p: "**Extraire les codes d'erreur — environ 3 crédits** lit les pages d'un manuel qui ressemblent à un tableau de codes d'erreur et liste chaque code avec sa page, sous l'étiquette **Marque** du manuel (ajoutez-la d'abord). Les codes arrivent **pas encore vérifié** : tant que vous n'appuyez pas sur **C'est juste**, l'assistant ne s'en sert qu'en citant le manuel et la page. **Modifier** corrige une signification, **Ne pas utiliser** l'écarte (il est conservé, marqué **non utilisé**), **Utiliser de nouveau** le rétablit. Voir [[ai-employee-error-codes|Les codes d'erreur]]." },
        ],
      },
    ],
  },

  "ai-employee-error-codes": {
    title: "Les codes d'erreur : ce que dit l'employé IA quand un écran en affiche un",
    summary:
      "Quand un client dit que sa laveuse affiche UE ou que sa fournaise clignote 13, l'assistant cherche le code — vos manuels d'abord, puis les références de FieldQuo — et ne devine jamais.",
    updated: "2026-10-04",
    intro: [
      "Les clients écrivent souvent avec un code : « ma laveuse Samsung affiche UE ». Vos employés **Soutien technique** et **Réceptionniste** peuvent **chercher un code d'erreur** : ce qu'il veut dire, quelques gestes sûrs pour un propriétaire, quand s'arrêter, son degré d'urgence et d'où vient l'information.",
    ],
    sections: [
      {
        id: "where-from",
        heading: "D'où vient une réponse",
        blocks: [
          { steps: [
            "Les codes extraits de **vos propres manuels** dans la [[ai-employee-reference-library|bibliothèque de référence]] — ceux que vous avez confirmés avec **C'est juste** d'abord, puis ceux **pas encore vérifié** (cités avec le manuel et la page).",
            "**Les références de FieldQuo** : un tableau des codes courants des laveuses Samsung, LG et Whirlpool, des lave-vaisselle Bosch, des thermostats Google Nest, des fournaises Carrier et Goodman/Amana/Daikin, des chauffe-eau Rheem et Bradford White et des chauffe-eau instantanés Rinnai, chacun avec sa source. Il est rédigé dans les mots de FieldQuo à partir des manuels et des pages d'aide des fabricants.",
          ] },
          { p: "Trois réponses au plus reviennent. Si aucune source n'a le code, l'assistant dit qu'il ne figure pas dans vos références et note un rappel — il ne dit jamais ce qu'il croit qu'un code veut dire." },
        ],
      },
      {
        id: "brand",
        heading: "Il connaît la marque quand vous la connaissez",
        blocks: [
          { p: "Les mêmes lettres veulent dire des choses différentes selon la marque — OE est un débordement sur une laveuse Samsung et un problème de vidange sur une LG. Quand la conversation appartient à un client dont l'équipement est enregistré (voir [[client-equipment-and-warranties|Équipement des clients et garanties]]), l'assistant utilise cette marque et ce modèle sans redemander ; sinon il demande la marque, et le numéro de modèle sur l'étiquette si le client le voit. Si deux appareils enregistrés pourraient correspondre, il demande lequel, par son nom." },
        ],
      },
      {
        id: "urgent",
        heading: "Les codes urgents",
        blocks: [
          { p: "Un code marqué urgent — un détecteur de fuite, un débordement, un verrouillage de surchauffe d'un chauffe-eau — ne se règle pas pas à pas : l'assistant note un rappel urgent et confie la conversation à une personne. Tout ce qui ressemble à une urgence reçoit d'abord la consigne d'urgence, exactement comme avant." },
          { warning: "Les gestes du tableau de FieldQuo ne passent jamais derrière un panneau, n'utilisent jamais d'appareil de mesure et ne touchent jamais au gaz ni au câblage. Cela revient à un technicien, et l'assistant le lui confie." },
        ],
      },
    ],
  },

  "how-ai-employee-troubleshooting-works": {
    title: "Le dépannage par l'IA : d'un code à un rappel",
    summary:
      "L'assistant aide pour un problème mineur, promet un appel d'un technicien si cela persiste — et quand le client réécrit, le rappel est noté sans lui reposer de questions.",
    updated: "2026-10-04",
    intro: [
      "Voici ce que fait votre employé **Soutien technique** avec « ma laveuse s'est arrêtée en plein cycle », étape par étape — et ce qui arrive devant votre équipe à la fin.",
    ],
    sections: [
      {
        id: "steps",
        heading: "La conversation",
        blocks: [
          { steps: [
            "Il lit l'équipement enregistré du client, si la conversation appartient à un client connu : marque, modèle, date d'installation et date de garantie au dossier. Il ne voit jamais de prix, de facture ni de solde, et ne lit jamais un numéro de série à voix haute.",
            "Il ne demande que ce qui manque, puis cherche le code et donne au plus deux ou trois gestes sûrs tirés de votre manuel ou des références de FieldQuo, en disant d'où ils viennent.",
            "Il note ce qu'il a proposé, et la réponse se termine par : **Si le problème persiste, écrivez-nous de nouveau et nous planifierons un appel avec l'un de nos techniciens.** — ajouté par FieldQuo, dans la langue du client, pour qu'il soit là à chaque fois.",
            "Si le client réécrit que le problème continue, il note le rappel aussitôt — la note dit quel est l'appareil, le code et ce qui a déjà été essayé. Si cela semble maintenant urgent, cela passe en premier.",
          ] },
        ],
      },
      {
        id: "what-the-team-sees",
        heading: "Ce que voit votre équipe",
        blocks: [
          { bullets: [
            "**Un client connu** reçoit un billet à son dossier — de type **Garantie** quand la date de garantie enregistrée n'est pas passée, sinon **Réparation** — relié au travail qui a installé l'appareil, en priorité **Urgente** quand l'assistant l'a marqué ainsi. Voir [[client-tickets|Billets des clients]].",
            "**Toute autre personne** devient une demande portant le badge **Rappel demandé par votre assistant IA** sur le [[the-leads-board|tableau des demandes]], précédé de **Urgent** le cas échéant.",
          ] },
          { p: "L'assistant ne promet jamais d'heure, et ne dit jamais ce qui est couvert ou non — une date de garantie au dossier est une information qu'il mentionne et note pour l'équipe ; c'est l'équipe qui décide." },
        ],
      },
      {
        id: "reply-limit",
        heading: "La limite de réponses",
        blocks: [
          { p: "**Nombre maximal de réponses dans une conversation** s'applique toujours. Une seule exception : quand l'assistant a dit au client de réécrire si le problème persiste, son message suivant reçoit une réponse même si la limite est atteinte — une seule fois — et cette réponse ne peut que noter le rappel ou confier la conversation à une personne. Une limite de 0 (en pause) n'est jamais dépassée." },
        ],
      },
    ],
  },
};
