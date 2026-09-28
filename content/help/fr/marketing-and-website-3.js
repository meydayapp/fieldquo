// content/help/fr/marketing-and-website-3.js
//
// Partie 3 de la catégorie « marketing-and-website » en français (voir le
// composeur, marketing-and-website.js). Slugs assignés à cette partie
// (lib/help/tree.js) : get-facebook-and-instagram-lead-ads-into-fieldquo,
// answer-facebook-and-instagram-messages-from-fieldquo, whatsapp-coming-soon.
//
// Même structure que l'anglais (mêmes sections, mêmes blocs, mêmes figures) ;
// les mots à l'écran viennent du bloc `fr` de app/i18n/appMessages.js. Les
// écrans de Meta gardent les libellés anglais de Meta, entre guillemets, parce
// que c'est ce que le lecteur verra chez Meta. Les niveaux d'accès (**Requests**,
// **View only**…) sont cités tels que l'éditeur d'accès les affiche.
export const ARTICLES = {
  "get-facebook-and-instagram-lead-ads-into-fieldquo": {
    title: "Recevoir vos publicités à formulaire Facebook et Instagram dans FieldQuo",
    summary:
      "Connectez votre Page Facebook, trouvez vos formulaires de prospects, activez ceux qui comptent et envoyez un prospect test — la liste de contrôle de Paramètres → Publicités Meta se coche à mesure.",
    updated: "2026-09-28",
    intro: [
      "Une publicité à formulaire sur Facebook ou Instagram affiche un formulaire que Meta présente dans sa propre application. Quand un propriétaire le remplit, FieldQuo peut transformer sa réponse en carte sur votre tableau **Prospects** — notée, signalée et relancée comme toute autre demande. Tout se règle sur un seul écran : **Paramètres → Publicités Meta**, dans la carte **Formulaires de prospects Facebook**.",
      "Les formulaires et les prospects sont lus par votre connexion à la **Page Facebook** — la carte **Publication Facebook et Instagram** plus bas sur le même écran — et non par le compte publicitaire Meta du haut. Le compte publicitaire apporte vos dépenses ; la Page apporte les prospects.",
    ],
    sections: [
      {
        id: "before-you-start",
        heading: "Avant de commencer",
        blocks: [
          {
            bullets: [
              "Une connexion Facebook qui gère la Page d'où partent vos publicités.",
              "Au moins un formulaire de prospects sur une publicité de cette Page. FieldQuo trouve et lit vos formulaires ; il ne les crée pas — vous créez le formulaire chez Meta en créant la publicité.",
              "Un compte propriétaire ou administrateur dans FieldQuo. **Publicités Meta** se trouve sous **Encaissement** dans les paramètres, comme **Paiements**, et les autres rôles ne la voient pas et ne peuvent pas s'en servir.",
            ],
          },
          {
            note: "Si la carte affiche **Les formulaires de prospects Facebook nécessitent l'approbation par Meta d'une autorisation supplémentaire ; rien n'est encore reçu.**, chaque interrupteur et **Trouver mes formulaires de prospects** sont désactivés et la liste de contrôle ci-dessous n'est pas affichée. C'est l'examen de FieldQuo par Meta, pas votre configuration : il n'y a rien à faire tant que la phrase est là.",
          },
        ],
      },
      {
        id: "the-checklist",
        heading: "La liste de contrôle en haut de la carte",
        blocks: [
          {
            p: "La carte s'ouvre sur **Recevoir vos prospects publicitaires dans FieldQuo**, une courte liste qui se coche d'elle-même à partir de ce que FieldQuo voit déjà — rien à cocher à la main. Chaque ligne non cochée dit quoi faire et nomme le bouton de cet écran qui le fait. **Guide étape par étape** ouvre le présent article.",
          },
          {
            bullets: [
              "**Page Facebook connectée, avec les autorisations pour les prospects** — une Page est connectée et Meta lui a accordé toutes les autorisations dont les formulaires ont besoin.",
              "**Formulaires de prospects trouvés** — **Trouver mes formulaires de prospects** a listé au moins un formulaire.",
              "**Au moins un formulaire activé** — l'interrupteur d'un formulaire indique **Activé**.",
              "**Premier prospect reçu** — un prospect venu de Meta est arrivé dans FieldQuo.",
            ],
          },
          {
            figure: "live:app-settings-meta-ads",
            caption: "Paramètres → Publicités Meta — la carte des formulaires de prospects Facebook avec son bouton de recherche, et une Page connectée sous Publication Facebook et Instagram, plus bas.",
          },
        ],
      },
      {
        id: "connect-your-page",
        heading: "Étape 1 : connecter votre Page Facebook",
        blocks: [
          {
            steps: [
              "Ouvrez **Paramètres → Publicités Meta** et descendez jusqu'à **Publication Facebook et Instagram**.",
              "Appuyez sur **Connecter Facebook et Instagram** et connectez-vous à Facebook.",
              "Acceptez toutes les autorisations que Meta affiche. En décocher une laisse une connexion qui a l'air correcte mais ne peut pas lire vos prospects.",
              "Si votre connexion gère plusieurs Pages, choisissez celle d'où partent vos publicités sous **Quelle page ?** et appuyez sur **Connecter cette page**.",
              "De retour sur la carte des formulaires, vérifiez la ligne **Les formulaires et les prospects sont lus par votre connexion à la Page Facebook : …** — elle nomme la Page que FieldQuo lira.",
            ],
          },
          {
            tip: "FieldQuo lit les formulaires et les prospects d'une seule Page : celle qui est connectée. Si vos publicités partent d'une autre Page, appuyez sur **Reconnecter ou changer de page** et choisissez-la. Si Meta a retenu une autorisation, une ligne ambre la nomme et vous dit d'appuyer sur le même bouton pour l'accepter.",
          },
        ],
      },
      {
        id: "find-and-switch-on",
        heading: "Étapes 2 et 3 : trouver vos formulaires et les activer",
        blocks: [
          {
            steps: [
              "Appuyez sur **Trouver mes formulaires de prospects**. FieldQuo demande à Meta les formulaires de la Page connectée et affiche chacun avec sa Page, **Prospects : 0** et un interrupteur.",
              "Mettez l'interrupteur sur **Activé** pour chaque formulaire dont les réponses doivent devenir des prospects.",
              "Laissez les autres sur **Désactivé** — une inscription à une infolettre, par exemple. Rien n'est importé d'un formulaire désactivé.",
            ],
          },
          {
            p: "Un formulaire qui vient d'être trouvé commence toujours sur **Désactivé** : trouver un formulaire n'est pas accepter de l'importer, et appuyer de nouveau sur **Trouver mes formulaires de prospects** ne réactive jamais un formulaire que vous avez désactivé. Un formulaire supprimé chez Meta reste dans la liste, parce que les prospects qu'il a déjà produits y renvoient encore.",
          },
        ],
      },
      {
        id: "what-the-messages-mean",
        heading: "Ce que veulent dire les messages de la carte",
        blocks: [
          {
            table: {
              head: ["La carte affiche", "Ce que cela veut dire, et quoi faire"],
              rows: [
                ["**Page … consultée : 3 formulaires de prospects trouvés.**", "Tout fonctionne. Le nombre est celui des formulaires que Meta a renvoyés pour cette Page."],
                ["**Page … consultée : Meta n'y a renvoyé aucun formulaire de prospects.**", "La Page a été lue et n'a aucun formulaire. Créez le formulaire sur votre publicité chez Meta — ou connectez la Page d'où part réellement la publicité — puis appuyez de nouveau sur **Trouver mes formulaires de prospects**."],
                ["**Connectez d'abord votre Page Facebook dans Publication Facebook et Instagram ci-dessous …**", "Aucune Page n'est encore connectée. Faites l'étape 1."],
                ["**Meta n'a pas accordé à la connexion de la Page … ces autorisations : …**", "Appuyez sur **Reconnecter ou changer de page** et acceptez toutes les autorisations demandées par Meta."],
                ["**Meta n'accepte plus l'accès de FieldQuo à …**", "L'accès enregistré a expiré ou a été retiré chez Meta. Appuyez sur **Reconnecter ou changer de page**."],
                ["**Meta refuse de transmettre à FieldQuo les prospects de … : cette entreprise utilise le Leads Access Manager.**", "Votre entreprise limite qui peut lire ses prospects. Voyez la section suivante."],
                ["**Aucun prospect n'a encore été reçu depuis Meta.** ou **Dernier prospect reçu le …**", "Si un prospect est arrivé ou non. La seconde phrase prouve que toute la chaîne fonctionne."],
              ],
            },
          },
        ],
      },
      {
        id: "leads-access",
        heading: "L'accès aux prospects, seulement si Meta le demande",
        blocks: [
          {
            p: "La plupart des entreprises ne touchent jamais au Leads Access Manager de Meta, et pour elles la connexion à la Page suffit. Si la vôtre l'a restreint, Meta refuse les prospects à FieldQuo, **Trouver mes formulaires de prospects** répond par le message sur le Leads Access Manager ci-dessus, et la liste de contrôle gagne une étape : **FieldQuo attribué dans « Leads access » chez Meta**, avec le lien **Ouvrir Leads access chez Meta**. Seulement dans ce cas :",
          },
          {
            steps: [
              "Ouvrez les paramètres d'entreprise de Meta, puis « Integrations » → « Leads access ». L'adresse **business.facebook.com/settings/leads-accesses** y mène directement.",
              "Choisissez votre Page.",
              "Ouvrez l'onglet « CRMs » et appuyez sur « Assign CRMs ».",
              "Choisissez FieldQuo et confirmez.",
              "De retour dans FieldQuo, appuyez de nouveau sur **Trouver mes formulaires de prospects**. Dès que Meta ne refuse plus, l'étape quitte la liste de contrôle.",
            ],
          },
          {
            note: "Ce sont les écrans et les libellés de Meta, et FieldQuo ne peut pas s'attribuer lui-même : une personne qui gère votre entreprise chez Meta doit le faire.",
          },
        ],
      },
      {
        id: "test-it",
        heading: "Étape 4 : envoyer un prospect test",
        blocks: [
          {
            steps: [
              "Ouvrez le Lead Ads Testing Tool de Meta à **developers.facebook.com/tools/lead-ads-testing** — le lien **Ouvrir le Lead Ads Testing Tool de Meta** de la liste de contrôle l'ouvre — avec une connexion Facebook qui gère la Page.",
              "Choisissez votre Page et un formulaire que vous avez mis sur **Activé**, puis soumettez un prospect test.",
              "Rechargez **Paramètres → Publicités Meta** : **Dernier prospect reçu le …** apparaît, le compteur **Prospects** du formulaire augmente et **Premier prospect reçu** est coché.",
              "Ouvrez **Prospects**. La réponse test est une carte comme les autres — souvenez-vous que c'est un test en la voyant.",
            ],
          },
          {
            p: "FieldQuo apprend l'arrivée d'une réponse de deux façons : l'avis instantané de Meta, et sa propre relecture de chaque formulaire activé une fois par heure. Si l'avis instantané se perd, le prospect arrive quand même au passage horaire suivant — et jamais deux fois, parce que chacun est enregistré sous l'identifiant de Meta.",
          },
        ],
      },
    ],
    faq: [
      { q: "Faut-il aussi connecter le compte publicitaire Meta ?", a: "Pas pour les prospects — ils sont lus par la connexion à la Page. Connecter le compte publicitaire ajoute vos dépenses publicitaires à vos chiffres de marketing." },
      { q: "Pourquoi ma liste de contrôle n'affiche-t-elle pas l'étape de l'accès aux prospects ?", a: "Parce que Meta n'a pas refusé FieldQuo. L'étape n'apparaît qu'après une réponse de Trouver mes formulaires de prospects portant le refus du Leads Access Manager de Meta, puisque la plupart des entreprises ne restreignent jamais cet accès." },
      { q: "Un prospect venu d'un formulaire me sera-t-il signalé ?", a: "Oui. Il est créé comme toute autre demande : noté chaud, tiède ou froid, et annoncé aux mêmes personnes qu'un prospect de votre site Web." },
    ],
  },

  "answer-facebook-and-instagram-messages-from-fieldquo": {
    title: "Répondre aux messages Facebook et Instagram depuis FieldQuo",
    summary:
      "Connectez votre Page Facebook une fois et ses messages — et ceux du compte Instagram lié — arrivent dans Messages, où vous y répondez dans la fenêtre de 24 heures de Meta.",
    updated: "2026-09-28",
    intro: [
      "Quand un propriétaire écrit à votre Page Facebook, ou au compte Instagram professionnel qui y est lié, la conversation arrive dans **Messages** dans FieldQuo et vous y répondez de là. La réponse part de votre Page ou de votre compte Instagram — le client ne voit jamais FieldQuo.",
      "Deux règles viennent de Meta, pas de FieldQuo, et cet article en parle surtout : une entreprise ne peut répondre que dans les 24 heures qui suivent le dernier message du client, et une seule application à la fois peut répondre à une conversation donnée. Tant que **Messages** affiche **Aperçu anticipé.** en haut, la fonction marche et certaines parties peuvent encore changer.",
    ],
    sections: [
      {
        id: "connect",
        heading: "Connecter votre Page",
        blocks: [
          {
            steps: [
              "Ouvrez **Paramètres → Publicités Meta** (propriétaire et administrateurs seulement) et descendez jusqu'à **Publication Facebook et Instagram**.",
              "Appuyez sur **Connecter Facebook et Instagram**, connectez-vous à Facebook et acceptez toutes les autorisations que Meta affiche.",
              "Si votre connexion gère plusieurs Pages, choisissez-en une sous **Quelle page ?** et appuyez sur **Connecter cette page**.",
              "Vérifiez la ligne sous le nom de la Page. **Meta transmet les messages de cette Page à FieldQuo — activé le …** veut dire que les nouveaux messages arriveront d'eux-mêmes.",
            ],
          },
          {
            figure: "live:app-settings-meta-ads",
            caption: "Paramètres → Publicités Meta — une Page connectée avec son compte Instagram, la ligne indiquant que Meta transmet les messages de la Page à FieldQuo, et l'importation des conversations passées.",
          },
          {
            note: "D'autres lignes disent ce qui ne va pas : **Les messages de cette Page n'arrivent pas jusqu'à FieldQuo** vient avec **Réessayer l'abonnement** ; **Votre boîte de réception n'est pas encore activée pour cette Page** vient avec **Activer la boîte de réception** ; une ligne qui nomme des autorisations non accordées veut dire que Meta ne les a pas encore approuvées pour FieldQuo. Instagram exige un compte Instagram professionnel lié à la Page — sinon la carte indique **Aucun compte Instagram lié à cette page — Facebook uniquement.**",
          },
        ],
      },
      {
        id: "what-arrives",
        heading: "Ce qui arrive, et qui le voit",
        blocks: [
          {
            bullets: [
              "Chaque nouvelle conversation apparaît dans **Messages**, marquée Facebook ou Instagram. Les pastilles **Facebook** et **Instagram** filtrent la liste, et les conversations sont regroupées sous **À répondre**, **En attente de leur réponse**, **Mises de côté** et **Terminées**.",
              "Ce que la personne envoie arrive avec : le texte, les photos et autres pièces jointes, et une épingle sur la carte quand elle partage un lieu sur Messenger.",
              "Meta ne livre pas de lui-même les conversations d'avant la connexion. **Importer les conversations passées** sur la carte des paramètres, ou **Actualiser depuis Facebook** dans Messages, récupère jusqu'aux 30 derniers jours ; c'est possible une fois toutes les dix minutes.",
              "Vos réponses depuis FieldQuo sont du texte seulement sur Facebook et Instagram — le trombone pour les photos et fichiers n'apparaît que dans les conversations WhatsApp.",
              "Toute personne dont l'accès comprend **Requests** au niveau **View only** ou plus peut lire la boîte et reçoit une notification pour un nouveau message si elle a activé les notifications ; pour répondre, il faut **View, create, and edit**.",
            ],
          },
          {
            figure: "live:app-messages",
            caption: "Messages — les pastilles Facebook et Instagram, Actualiser depuis Facebook, et les conversations regroupées sous À répondre et En attente de leur réponse.",
          },
        ],
      },
      {
        id: "the-24-hour-window",
        heading: "La fenêtre de réponse de 24 heures",
        blocks: [
          {
            p: "Facebook et Instagram ne permettent à une entreprise de répondre que dans les 24 heures qui suivent le dernier message du client. La fenêtre repart chaque fois qu'il écrit de nouveau. FieldQuo la calcule avant que vous tapiez : la conversation vous dit où vous en êtes, au lieu de laisser Meta rejeter une réponse déjà écrite.",
          },
          {
            table: {
              head: ["La conversation affiche", "Ce que vous pouvez faire"],
              rows: [
                ["Rien — la fenêtre est ouverte", "Répondre normalement."],
                ["**Moins d'une heure pour répondre.**", "Répondre maintenant ; ensuite, impossible de répondre depuis FieldQuo tant qu'il n'a pas écrit de nouveau."],
                ["**Fenêtre de réponse fermée.** — plus de 24 heures ont passé", "Rien ne peut partir de FieldQuo. La conversation se rouvre dès qu'il écrit de nouveau ; d'ici là, appelez-le ou écrivez-lui un courriel — **Ouvrir la fiche client de … pour appeler ou écrire un courriel** vous y mène quand la conversation est liée à un client."],
                ["**Fenêtre de réponse fermée.** — cette personne n'a jamais écrit à votre Page ou à votre compte", "On ne peut répondre ici qu'à quelqu'un qui vous a écrit. Joignez-la autrement."],
              ],
            },
          },
          {
            note: "Meta prévoit une exception pour les réponses d'un agent humain jusqu'à sept jours plus tard, mais c'est une autorisation que FieldQuo ne détient pas : il n'y a donc aucun moyen de contourner les 24 heures depuis FieldQuo sur Facebook ou Instagram.",
          },
        ],
      },
      {
        id: "another-app",
        heading: "« Une autre application contrôle cette conversation »",
        blocks: [
          {
            p: "Meta ne laisse qu'une application à la fois répondre à une conversation. Si les réponses automatiques de Meta ou Business AI l'ont déjà prise, votre réponse échoue avec **Non envoyé — une autre application contrôle cette conversation chez Meta. Votre message est toujours dans la zone de saisie.** et la conversation indique quoi changer :",
          },
          {
            bullets: [
              "Dans Meta Business Suite, ouvrez « Inbox » → « Automations » et désactivez les réponses automatiques et Business AI pour la Page ou le compte Instagram.",
              "Facebook : dans les paramètres de votre Page, ouvrez l'onglet « Conversation Routing » et définissez FieldQuo comme application par défaut. Instagram : dans les paramètres de routage des conversations de Meta pour ce compte, définissez FieldQuo comme l'application qui répond aux messages.",
              "Appuyez ensuite de nouveau sur **Envoyer** — votre message est toujours dans la zone de saisie. Une conversation déjà prise par l'automatisation de Meta peut y rester jusqu'à ce qu'elle soit rendue ; les nouvelles conversations arrivent dans FieldQuo.",
              "Sur Facebook seulement, **Demander à reprendre cette conversation** demande à Meta de vous la céder. L'application qui la détient décide et FieldQuo n'est pas informé de sa réponse : appuyez sur **Envoyer** pour le savoir.",
            ],
          },
        ],
      },
      {
        id: "instagram-allow-access",
        heading: "Instagram : « Allow Access to Messages »",
        blocks: [
          {
            p: "Si une réponse Instagram échoue avec **Non envoyé — Meta a refusé cette réponse Instagram car la messagerie Instagram n'est pas activée pour cette connexion.**, la conversation explique pourquoi et quoi changer. De votre côté, il y a deux choses :",
          },
          {
            steps: [
              "Dans l'application Instagram, activez le réglage exigé par Meta : Instagram Settings > Messages and story replies > Message controls > Connected Tools > Allow Access to Messages.",
              "Si l'avis nomme une autorisation qui manque à votre connexion, appuyez sur **Reconnecter dans les réglages** et acceptez tout ce que Meta demande. La personne qui reconnecte doit avoir au moins l'accès « Moderate » à la Page Facebook.",
              "Appuyez de nouveau sur **Envoyer**. Si l'envoi échoue encore, communiquez avec le soutien de FieldQuo.",
            ],
          },
        ],
      },
    ],
    faq: [
      { q: "Puis-je écrire à quelqu'un qui n'a jamais écrit à ma Page ?", a: "Non. Facebook et Instagram ne permettent à une entreprise de répondre qu'à une personne qui lui a écrit dans les 24 dernières heures. Appelez-la ou écrivez-lui un courriel." },
      { q: "Déconnecter la Page supprime-t-il les conversations ?", a: "Non. L'accès est supprimé et les nouveaux messages cessent d'arriver, mais les conversations déjà dans Messages restent, et une reconnexion les reprend." },
      { q: "Pourquoi une réponse a-t-elle échoué alors que j'ai répondu dans l'heure ?", a: "Le plus souvent, une autre application détient la conversation — voyez « Une autre application contrôle cette conversation » plus haut. La réponse en échec dit de quel cas il s'agit." },
    ],
  },

  "whatsapp-coming-soon": {
    title: "WhatsApp (bientôt)",
    summary:
      "Les messages WhatsApp Business dans FieldQuo sont prêts et attendent l'approbation de Meta ; voici ce que dit la carte aujourd'hui et ce qu'elle fera quand Meta dira oui.",
    updated: "2026-09-28",
    intro: [
      "Vous ne pouvez pas encore connecter un numéro WhatsApp à FieldQuo. Le côté boîte de réception est prêt, mais Meta doit approuver FieldQuo avant qu'une entreprise puisse connecter son numéro WhatsApp, et cette approbation n'est pas arrivée. FieldQuo ne sait pas quand elle viendra.",
      "Plutôt qu'un bouton de connexion qui mènerait à une page de Meta qui vous refuse, la carte **WhatsApp Business** de **Paramètres → Publicités Meta** le dit en une phrase.",
    ],
    sections: [
      {
        id: "what-the-card-says",
        heading: "Ce que dit la carte aujourd'hui",
        blocks: [
          {
            p: "La carte indique **WhatsApp arrive bientôt. Nous attendons que Meta approuve FieldQuo pour WhatsApp, et nous vous préviendrons le jour où ce sera prêt.** Si votre Page Facebook ou votre compte Instagram est déjà connecté, elle ajoute par exemple **Vos messages Facebook et Instagram arrivent déjà ici.**",
          },
          {
            p: "Il n'y a ni bouton ni champ à remplir. Comme le reste de **Paramètres → Publicités Meta**, la carte est réservée au propriétaire et aux administrateurs.",
          },
        ],
      },
      {
        id: "what-is-missing",
        heading: "Ce que FieldQuo attend",
        blocks: [
          {
            p: "Pour qu'une entreprise puisse connecter son propre numéro WhatsApp, Meta doit approuver FieldQuo pour WhatsApp — l'autorisation de répondre aux messages WhatsApp et le droit de faire passer les entreprises par l'inscription WhatsApp de Meta. D'ici là, cette inscription refuse toute entreprise sauf celle de FieldQuo : un bouton de connexion finirait donc toujours sur le refus de Meta. C'est pourquoi aucun n'est affiché.",
          },
        ],
      },
      {
        id: "what-it-will-do",
        heading: "Ce que la fonction fera quand Meta l'approuvera",
        blocks: [
          {
            bullets: [
              "**Connecter WhatsApp** vous fera passer par l'inscription de Meta, où vous choisirez ou créerez un compte WhatsApp Business et le numéro auquel vos clients écrivent.",
              "Les messages envoyés à ce numéro arriveront dans **Messages** sous une pastille **WhatsApp**, à côté de vos conversations Facebook et Instagram.",
              "La règle des 24 heures de WhatsApp s'appliquera : des réponses écrites dans les 24 heures suivant le dernier message du client, puis seulement un modèle approuvé d'avance par Meta. FieldQuo lira vos modèles chez Meta avec **Actualiser les modèles**.",
              "Depuis une conversation WhatsApp, vous pourrez envoyer des photos, des vidéos et des documents, ainsi que l'adresse de votre entreprise en épingle sur la carte quand cette adresse a été choisie dans les suggestions de la carte.",
            ],
          },
        ],
      },
      {
        id: "until-then",
        heading: "D'ici là",
        blocks: [
          {
            bullets: [
              "Répondez à vos messages Facebook et Instagram dans FieldQuo — voyez [[answer-facebook-and-instagram-messages-from-fieldquo|Répondre aux messages Facebook et Instagram depuis FieldQuo]].",
              "Continuez de répondre à WhatsApp depuis votre téléphone comme aujourd'hui. Vous n'avez rien à demander à FieldQuo ; la carte change quand Meta approuve.",
              "Si vous avez déjà un compte WhatsApp Business chez Meta, vous pouvez rédiger vos modèles de messages à l'avance dans le WhatsApp Manager de Meta ; FieldQuo lira ceux qui sont approuvés une fois votre numéro connecté.",
            ],
          },
        ],
      },
    ],
    faq: [
      { q: "Puis-je avoir un accès anticipé ?", a: "Non. Tant que Meta n'a pas approuvé FieldQuo, son inscription refuse toute entreprise sauf celle de FieldQuo : il n'y a pas de porte à ouvrir plus tôt." },
      { q: "Quand est-ce que ce sera prêt ?", a: "Quand Meta l'approuvera — c'est Meta qui fixe le calendrier, pas FieldQuo. La carte change d'elle-même ce jour-là." },
    ],
  },
};
