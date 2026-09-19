// lib/prepGuide/content.fr.js
//
// Ce que le client doit FAIRE avant l'arrivée de l'équipe, par métier — en
// français. Même forme et mêmes règles que content.en.js : rien n'affirme un
// nombre de jours, un temps de séchage, une marque ou un prix. Les clés sont
// celles de GUIDES_EN ; scripts/check-prep-guide.mjs exige qu'elles
// correspondent une à une et que chaque liste ait au moins quatre éléments.

export const GUIDES_FR = {
  cabinet_refinishing: {
    checklist: [
      "Videz complètement les comptoirs — retirez tout, y compris les petits appareils, l'égouttoir, la déco et le micro-ondes. Rangez le tout ailleurs, en sécurité.",
      "Déplacez la table à manger — sortez-la de la cuisine ou placez-la dans une zone protégée, loin de l'aire de travail.",
      "Retirez les décorations murales près des armoires — tableaux, miroirs, étagères ou tout objet sur les murs adjacents.",
      "Cuisinière et réfrigérateur — si nous travaillons autour ou derrière ces appareils, veuillez les avancer pour un accès complet. Les déplacer donne le résultat le plus propre.",
      "Intérieurs d'armoires — vous n'avez pas à vider les armoires. Les intérieurs ne sont pas refinis, sauf si votre soumission les inclut comme option.",
      "Préparation générale — assurez-vous que le plancher est dégagé et passé à l'aspirateur. Nous protégeons planchers, comptoirs et appareils avec des barrières professionnelles et des toiles.",
      "Animaux — gardez-les hors de la cuisine et des pièces voisines pendant notre présence ; les portes seront scellées et le pistolet est bruyant.",
    ],
    warning:
      "Si vous avez demandé ou attendez la peinture des intérieurs d'armoires, vous devez vider toutes les armoires avant le début des travaux. Des armoires non vidées ne peuvent pas être peintes à l'intérieur, et cela peut retarder le projet.",
    dayOf: [
      "Nous protégeons planchers, comptoirs et appareils avec des barrières et des bâches avant toute chose, puis installons une station de pulvérisation confinée et ventilée dans la cuisine.",
      "La cuisine est inutilisable pendant les travaux : pas d'évier, pas de cuisinière, portes scellées. Nous recommandons de prévoir des repas à l'extérieur ou d'utiliser une autre pièce pendant le projet.",
      "Nous minimisons les perturbations et nettoyons soigneusement à la fin de chaque journée.",
    ],
    afterCare:
      "Vos armoires sont prêtes pour une utilisation légère dès que nous vous les remettons. Fermez les portes doucement et évitez d'y suspendre quelque chose de lourd ou de les essuyer avec des nettoyants tant que le fini n'a pas complètement durci — nous vous dirons combien de temps cela prend pour le produit utilisé.",
  },

  cabinet_refacing: {
    checklist: [
      "Videz complètement les comptoirs — les nouvelles portes et façades de tiroirs se posent par l'avant, et nous avons besoin de tout le comptoir pour travailler.",
      "Videz les tiroirs et les armoires dont les façades sont remplacées — les caissons de tiroirs sortent, les portes s'enlèvent, et ce qui est à l'intérieur gêne.",
      "Retirez les décorations murales près des armoires — tout ce qui est sur les murs adjacents descend pendant la finition des caissons.",
      "Cuisinière et réfrigérateur — si les panneaux à côté sont refinis, avancez les appareils pour que nous atteignions les côtés.",
      "Confirmez l'emplacement des poignées — nous perçons les nouvelles façades aux positions choisies sur la soumission ; pour changer, dites-le-nous avant notre arrivée.",
      "Gardez le plancher de la cuisine dégagé et les animaux hors de la pièce pendant notre présence.",
    ],
    warning:
      "Les nouvelles portes ont été fabriquées aux mesures prises sur place. Si une armoire a été déplacée, remplacée ou modifiée depuis, dites-le-nous avant notre arrivée — une porte faite pour une ouverture qui a changé n'entrera pas.",
    dayOf: [
      "Les anciennes portes et façades s'enlèvent en premier et partent avec nous. Les caissons sont ensuite finis pour s'accorder aux nouvelles façades, ce qui rend la cuisine inutilisable pour la journée.",
      "Les nouvelles portes sont posées, ajustées pour être d'aplomb, et les poignées installées. Nous faisons le tour de la cuisine avec vous avant de partir.",
    ],
    afterCare:
      "Les charnières neuves se placent au cours des premières semaines. Si une porte se désaligne, dites-le-nous — c'est un petit réglage, et il fait partie du travail.",
  },

  kitchen_design: {
    checklist: [
      "Videz complètement la cuisine — chaque armoire, chaque tiroir, le garde-manger et les comptoirs. Tout ce qui reste dans la maison doit trouver une place dans une autre pièce.",
      "Prévoyez les électroménagers — dites-nous lesquels sont réutilisés et où les entreposer pendant que l'ancienne cuisine est démontée ; un réfrigérateur que vous gardez a besoin d'une prise ailleurs.",
      "Dégagez un passage de la porte à la cuisine — les armoires et les comptoirs sont longs et lourds, et ils entrent par votre porte d'entrée.",
      "Installez une cuisine temporaire — une bouilloire, un micro-ondes et un frigo dans une autre pièce rendent les prochaines semaines bien plus faciles.",
      "Décrochez tout ce qui est sur les murs adjacents à la cuisine — l'ossature, la plomberie et la pose des armoires font vibrer le mur.",
      "Animaux et enfants — la cuisine est un chantier pendant notre présence ; gardez-la fermée en dehors des heures de travail.",
    ],
    warning:
      "La plomberie et l'électricité de la nouvelle cuisine sont faites par des métiers licenciés aux jours que nous planifions. L'évier, le lave-vaisselle et la cuisinière ne sont pas utilisables avant la fin de ces journées — prévoyez une cuisine hors service pour tout le projet, pas seulement le premier jour.",
    dayOf: [
      "L'ancienne cuisine sort en premier. C'est la journée la plus bruyante et la plus poussiéreuse ; nous scellons les portes avant de commencer.",
      "Les armoires se posent par étapes : bas, puis hauts, puis le comptoir est gabarié. Le comptoir est fabriqué sur les armoires posées, il y a donc un délai de quelques jours entre les deux.",
      "Nous faisons le tour de la cuisine avec vous à la fin de chaque étape et à la remise.",
    ],
    afterCare:
      "Portes et tiroirs sont ajustés à la remise et peuvent bouger quand la maison travaille ; dites-le-nous et nous les réalignons. Évitez l'eau stagnante sur les joints du comptoir jusqu'au durcissement du scellant — nous vous dirons combien de temps.",
  },

  countertop: {
    checklist: [
      "Videz complètement les comptoirs — tout ce qui est dessus, dans l'évier et sur le rebord de fenêtre au-dessus de l'évier.",
      "Videz l'armoire sous l'évier et les tiroirs voisins — la plomberie se déconnecte par en dessous et nous avons besoin de l'espace.",
      "Prévoyez la plomberie et le gaz — déconnecter l'évier, le lave-vaisselle et la plaque de cuisson est un travail distinct sauf si votre soumission l'inclut. Confirmez qui le fait et quel jour.",
      "Assurez-vous que les armoires sont solides et de niveau — un comptoir ne peut être plus droit que ce qui le porte. Signalez toute armoire qui bouge.",
      "Dégagez un passage de la porte à la cuisine — une dalle est longue, lourde, portée à deux, et tourne mal dans les coins.",
      "Gardez les animaux hors de la cuisine les jours de retrait et de pose.",
    ],
    warning:
      "L'évier et le lave-vaisselle sont hors service du moment où l'ancien comptoir s'enlève jusqu'au raccordement de la plomberie une fois le nouveau scellé. Ce n'est pas le même jour sauf si votre soumission le précise — prévoyez-le.",
    dayOf: [
      "Le jour du gabarit, nous mesurons vos armoires exactement ; rien n'est enlevé. Le jour de la pose, l'ancien comptoir s'enlève, part avec nous, et le nouveau est posé, mis de niveau, jointé et scellé.",
      "Les coupes se font dehors quand c'est possible. Quand elles doivent se faire sur place, nous confinons la poussière et nettoyons avant de partir.",
    ],
    afterCare:
      "Gardez les joints et le bord de l'évier au sec jusqu'au durcissement du scellant — nous vous dirons combien de temps pour le produit utilisé. Essuyez la surface avec un chiffon doux et un savon doux ; évitez les tampons abrasifs.",
  },

  interior_painting: {
    checklist: [
      "Sortez les petits meubles et tout ce qui est dessus des pièces à peindre — lampes, plantes, livres, électronique. Les gros meubles peuvent rester s'ils peuvent être regroupés au centre de la pièce et couverts.",
      "Décrochez tableaux, miroirs, horloges et rideaux — et leurs crochets, sauf si vous voulez qu'on peigne autour. Gardez la quincaillerie dans un sac par pièce.",
      "Dégagez le dessus des garde-robes, des étagères et des rebords de fenêtres dans chaque pièce de la liste.",
      "Choisissez couleurs et finis avant notre arrivée — un changement le jour même, c'est un aller au magasin et une journée perdue.",
      "Animaux — gardez-les dans une pièce que nous ne peignons pas. Des murs humides et un chat curieux, c'est mauvais pour les deux.",
      "Dites-nous ce qui est fragile ou précieux et que vous préférez déplacer vous-même.",
    ],
    warning:
      "Les pièces que nous peignons sont inutilisables tant que la peinture est humide, y compris la nuit entre deux couches. Les chambres sont généralement faites en premier pour être libérées en premier — dites-nous si vous avez besoin d'un autre ordre.",
    dayOf: [
      "Nous couvrons les planchers et les meubles qui restent, masquons les moulures et les prises, puis remplissons et ponçons avant toute peinture. La première heure est de la préparation, pas de la peinture.",
      "Attendez-vous à une odeur de peinture pendant un jour ou deux ; nous ventilons au fur et à mesure. Portes et fenêtres des pièces peintes restent ouvertes quand le temps le permet.",
      "Nous nettoyons à la fin de chaque journée et laissons un passage dégagé dans la maison.",
    ],
    afterCare:
      "La peinture fraîche est sèche au toucher bien avant d'être dure. Évitez de frotter, d'accrocher des cadres ou de pousser des meubles contre les murs jusqu'au durcissement complet — nous vous dirons combien de temps pour le produit utilisé.",
  },

  exterior_painting: {
    checklist: [
      "Éloignez les voitures de la maison — les projections et les échelles ont toutes deux besoin de l'entrée. Stationnez dans la rue ou dans le garage.",
      "Dégagez le pourtour — mobilier de patio, barbecue, jardinières, boyaux, ornements et tout ce qui est à moins d'un mètre des murs.",
      "Fermez toutes les fenêtres et coupez les arroseurs pour les jours où nous sommes là — un mur mouillé ne se peint pas.",
      "Taillez les arbustes et les branches qui touchent la maison, ou dites-nous si vous voulez que nous le fassions ; nous devons atteindre le mur derrière.",
      "Déverrouillez les barrières latérales et signalez-nous tout capteur d'alarme sur les portes et fenêtres autour desquelles nous travaillons.",
      "Animaux — gardez-les à l'intérieur tant que les échelles sont dressées et la peinture humide.",
    ],
    warning:
      "La peinture extérieure exige une surface sèche et une météo sèche. S'il pleut, nous arrêtons et la date de fin se déplace — pas le travail. Laissez les arroseurs fermés pendant tout le projet, y compris les jours où nous ne sommes pas là.",
    dayOf: [
      "Nous lavons d'abord les surfaces et les laissons sécher, puis grattons, ponçons, calfeutrons et apprêtons avant les couches de finition. Sur une grande maison, les premiers jours ne sont que de la préparation.",
      "Les fenêtres autour desquelles nous peignons sont masquées et ne s'ouvrent pas pendant que nous travaillons sur ce mur.",
      "Nous retirons le masquage et rangeons notre matériel à la fin de chaque journée.",
    ],
    afterCare:
      "Laissez les arroseurs fermés et les arbustes loin des murs jusqu'au durcissement de la peinture — nous vous dirons combien de temps. Arrosez les murs doucement au boyau, jamais au jet à pression.",
  },

  flooring: {
    checklist: [
      "Videz complètement les pièces — meubles, tapis, lampes, tout ce qui est au sol. Nous pouvons déplacer les gros meubles si votre soumission le prévoit ; sinon, ils doivent être sortis avant notre arrivée.",
      "Décrochez ou fixez ce qui est sur les murs — le ponçage fait vibrer la maison, et un cadre sur un clou peut tomber.",
      "Videz les tablettes du bas des garde-robes dans les pièces concernées, et dégagez leur plancher.",
      "Coupez le ventilateur de la fournaise ou de la climatisation les jours de ponçage, pour que la poussière ne circule pas dans les conduits.",
      "Prévoyez de ne pas utiliser ces pièces — et, pendant le séchage du fini, de quitter la maison — pour les durées que nous vous donnerons le jour même.",
      "Animaux et plantes hors des pièces, et idéalement hors de la maison, pendant l'application du fini.",
    ],
    warning:
      "Personne ne peut marcher sur le plancher tant que le fini est humide, même pour rejoindre une autre pièce. Si les pièces concernées sont le seul accès à une salle de bain ou une chambre, dites-le-nous avant de commencer pour que nous organisions le travail en conséquence.",
    dayOf: [
      "Nous scellons les portes et les bouches d'air, puis ponçons le plancher avec des grains de plus en plus fins. Les ponceuses sont bruyantes, et il reste une poussière fine malgré les aspirateurs.",
      "La teinture, si vous en avez choisi une, vient ensuite, puis les couches protectrices avec un temps de séchage entre chacune. La maison peut sentir le fini pendant un jour ou deux.",
    ],
    afterCare:
      "Attendez le délai que nous vous donnons avant d'y marcher en chaussettes, plus longtemps avant de remettre les meubles, et plus longtemps encore avant les tapis — le fini continue de durcir pendant des semaines. Mettez des feutres sous chaque pied.",
  },

  flooring_install: {
    checklist: [
      "Videz complètement les pièces — meubles, tapis, lampes, et tout ce qui est au fond des garde-robes.",
      "Laissez le nouveau plancher s'acclimater — s'il a été livré, gardez les boîtes à plat, à l'intérieur, dans les pièces où il sera posé, pendant le délai exigé par le fabricant.",
      "Dégagez un passage de la porte aux pièces — le plancher arrive en boîtes longues et lourdes.",
      "Dites-nous ce qu'il y a sous l'ancien plancher si vous le savez — un plancher précédent, un plancher chauffant, un sous-plancher avec un historique.",
      "Portes — certaines devront peut-être être rabotées pour passer au-dessus du nouveau plancher. Signalez-nous toute porte que vous préférez ne pas voir coupée.",
      "Animaux hors des pièces pendant que l'ancien plancher s'enlève et que le nouveau se pose.",
    ],
    warning:
      "Le sous-plancher ne peut pas être inspecté avant le retrait de l'ancien plancher. S'il est abîmé, inégal ou humide, c'est un travail supplémentaire que nous vous montrerons et chiffrerons avant de continuer.",
    dayOf: [
      "L'ancien plancher s'enlève en premier, puis le sous-plancher est vérifié et préparé. Le nouveau plancher est ensuite posé, et les moulures remises.",
      "Les coupes se font dehors ou dans une zone confinée ; attendez-vous à du bruit et à un peu de poussière.",
    ],
    afterCare:
      "Des feutres sous chaque meuble avant de le remettre. Utilisez la méthode d'entretien recommandée par le fabricant pour ce plancher — la mauvaise peut annuler la garantie.",
  },

  tiling: {
    checklist: [
      "Dégagez complètement la zone — pour un plancher, chaque meuble ; pour un dosseret, tout ce qui est sur les comptoirs ; pour une salle de bain, tout ce qui est sur la vanité et dans la douche.",
      "Confirmez la tuile, le motif de pose et la couleur du coulis avant notre arrivée — un changement le jour même est un changement sur un travail déjà commencé.",
      "La salle de bain ou la cuisine carrelée est inutilisable pendant le durcissement de la tuile et du coulis. Assurez-vous d'en avoir une autre disponible.",
      "Signalez-nous ce que vous savez derrière le mur ou sous le plancher — câbles de plancher chauffant, plomberie déplacée.",
      "Gardez les animaux hors de la pièce du premier jour jusqu'au scellement du coulis.",
    ],
    warning:
      "Tuile et coulis ne peuvent être ni piétinés ni mouillés avant d'avoir durci. Une douche carrelée aujourd'hui ne s'utilise pas ce soir. Nous vous dirons exactement quand — organisez-vous en conséquence.",
    dayOf: [
      "Nous préparons d'abord la surface : ancienne tuile enlevée s'il y en a, support nivelé et imperméabilisé là où la pièce l'exige.",
      "La tuile se pose, puis un jour ou plus après le coulis, puis le scellant. Les coupes se font à la scie à eau, dehors quand c'est possible.",
    ],
    afterCare:
      "Gardez la zone au sec pendant le délai indiqué, puis nettoyez avec un produit neutre — rien d'acide sur le coulis. Rescellez le coulis selon le calendrier que nous vous donnons.",
  },

  stairs: {
    checklist: [
      "Dégagez l'escalier, le palier et les couloirs en haut et en bas — rien sur les marches, rien d'appuyé contre les murs voisins.",
      "Décrochez les cadres des murs de la cage d'escalier et tout ce qui est suspendu au-dessus.",
      "Prévoyez de rester sur un seul étage pendant les délais que nous vous donnerons — un escalier au fini humide ne se traverse pas, même prudemment.",
      "Montez (ou descendez) ce dont vous aurez besoin avant chaque couche : médicaments, chargeurs, la nourriture du chien.",
      "Animaux — gardez-les à l'étage où sont leur nourriture et leur lit, derrière une porte fermée, pendant le séchage.",
    ],
    warning:
      "Une fois le fini appliqué, l'escalier est hors d'usage pendant le délai que nous vous donnons le jour même, sans exception. S'il n'y a qu'une salle de bain et qu'elle est à l'autre étage, dites-le-nous avant de commencer et nous organiserons le travail — une marche sur deux, ou un côté à la fois — pour que vous puissiez passer.",
    dayOf: [
      "Nous masquons les murs, les barreaux et le plancher du bas, ponçons les éléments de votre soumission jusqu'au bois nu, remplissons les entailles, puis teignons et finissons avec un temps de séchage entre les couches.",
      "Le ponçage est bruyant et poussiéreux ; nous confinons ce que nous pouvons et nettoyons chaque jour.",
    ],
    afterCare:
      "Chaussettes seulement les premiers jours après notre départ, pas de tapis d'escalier tant que le fini n'a pas durci, et rien de traîné dans l'escalier — nous vous dirons combien de temps pour le produit utilisé.",
  },

  drywall: {
    checklist: [
      "Videz la pièce, ou regroupez tout au centre et couvrez — la poussière de gypse va partout où elle peut.",
      "Décrochez tout ce qui est sur les murs concernés, et de l'autre côté de ces murs ; les vis et le ponçage traversent.",
      "Coupez le ventilateur de la fournaise ou de la climatisation pendant le ponçage, pour que la poussière reste dans la pièce.",
      "Signalez-nous ce qu'il y a dans le mur — filage ajouté, plomberie, câble de haut-parleur.",
      "Gardez animaux et enfants hors de la pièce jusqu'au ponçage final et au nettoyage.",
    ],
    warning:
      "Le composé à joints doit sécher entre les couches, et il sèche à la vitesse que la pièce permet. Une pièce froide ou humide ajoute des jours. Gardez le chauffage allumé et les fenêtres fermées, sauf indication contraire.",
    dayOf: [
      "Les réparations sont découpées, rapiécées et rubanées d'abord ; puis deux ou trois couches de composé avec séchage entre chacune, puis ponçage, puis apprêt si votre soumission l'inclut.",
      "Les journées entre les couches sont de courtes visites. La journée de ponçage est la poussiéreuse.",
    ],
    afterCare:
      "Un gypse apprêté se peint dès que l'apprêt est sec. N'accrochez rien de lourd sur une réparation fraîche avant qu'elle soit peinte.",
  },

  plumbing: {
    checklist: [
      "Dégagez sous l'évier, autour de la toilette, ou là où se fait le travail — tout hors de l'armoire, et un mètre libre autour de l'appareil.",
      "Sachez où est votre entrée d'eau principale et assurez-vous que nous pouvons l'atteindre — elle est souvent derrière des boîtes au sous-sol.",
      "Signalez-nous tout autre appareil qui fait des siennes ; l'eau coupée, c'est le moment le moins cher pour regarder.",
      "Ayez le nouvel appareil sur place si vous le fournissez, encore dans sa boîte, avec toutes ses pièces.",
      "Gardez les animaux loin de la zone de travail et de tout plancher ou plafond ouvert.",
    ],
    warning:
      "L'eau sera coupée pendant une partie de la visite, parfois pour toute la maison. Remplissez une cruche et organisez-vous. Un appareil que vous fournissez doit être complet et sur place avant notre arrivée, sinon la visite est perdue.",
    dayOf: [
      "Nous évaluons d'abord, confirmons la réparation avec vous, puis isolons l'eau et faisons le travail. Tout est testé sous pression avant de remettre l'eau dans la maison.",
      "Certains travaux exigent d'ouvrir un mur ou un plafond. Nous vous prévenons avant d'ouvrir quoi que ce soit, et laissons l'ouverture propre et prête à être refermée.",
    ],
    afterCare:
      "Faites couler les robinets une minute après notre départ pour chasser l'air des conduites. Si quelque chose goutte, suinte ou sonne différemment, appelez-nous — un joint neuf doit être silencieux.",
  },

  electrical: {
    checklist: [
      "Dégagez l'accès à votre panneau électrique — un mètre libre devant, rien d'empilé contre.",
      "Dégagez la zone de travail — autour des prises, des interrupteurs, des luminaires ou de l'appareil à raccorder.",
      "Sauvegardez votre travail et éteignez ordinateurs et appareils électroniques avant notre arrivée ; le courant sera coupé pendant une partie de la visite.",
      "Signalez-nous tout ce qui déclenche, clignote, bourdonne ou chauffe — panneau ouvert, c'est le moment de regarder.",
      "Gardez animaux et enfants loin de la zone de travail et de toute boîte ou mur ouvert.",
    ],
    warning:
      "Le courant sera coupé — sur le circuit, et parfois sur toute la maison — pendant une partie de la visite. Équipement médical, aquarium, congélateur et tout ce qui ne doit pas perdre le courant : dites-le-nous avant de commencer pour que nous le prévoyions.",
    dayOf: [
      "Nous confirmons l'étendue des travaux avec vous, coupons le courant, faisons le travail, puis testons chaque circuit touché avant de partir.",
      "Quand le travail exige une inspection ou un permis, nous vous disons la suite et quand.",
    ],
    afterCare:
      "Remettez à l'heure les horloges et minuteries qui ont perdu le courant. Si un disjoncteur déclenche encore après notre départ, ne le réarmez pas sans cesse — appelez-nous.",
  },

  hvac: {
    checklist: [
      "Dégagez autour de la fournaise, de l'unité intérieure ou de l'unité extérieure — un mètre libre de chaque côté, et le passage de la porte jusque-là.",
      "Assurez-vous que la trappe du grenier, le vide sanitaire ou le placard technique sont accessibles si les conduits y passent.",
      "Notez vos réglages de thermostat — un thermostat de remplacement repart de zéro.",
      "Dites-nous quelles pièces sont trop chaudes ou trop froides ; c'est la meilleure information à avoir quand le système est ouvert.",
      "Gardez les animaux loin de la zone de travail — conduites de réfrigérant, conduits ouverts et ventilateur en marche sont tous des dangers.",
    ],
    warning:
      "Le chauffage ou la climatisation sera coupé pendant toute la visite, et le jour d'une installation parfois pour la nuit. En plein hiver ou en canicule, prévoyez-le — une chaufferette ou un ventilateur d'appoint dans la pièce que vous utilisez le plus.",
    dayOf: [
      "Pour une réparation, nous diagnostiquons d'abord, confirmons la réparation et le coût avec vous, puis faisons le travail et faisons tourner le système sur un cycle complet avant de partir.",
      "Pour une installation, l'ancien équipement sort en premier et part avec nous ; le nouveau est posé, raccordé, mis en service et testé, et nous vous montrons les commandes.",
    ],
    afterCare:
      "Changez ou nettoyez le filtre selon le calendrier que nous vous donnons — c'est ce qui influence le plus la durée de vie de l'équipement. Si le système fait des cycles courts, un bruit nouveau, ou si le thermostat et la pièce ne s'entendent pas, appelez-nous.",
  },

  appliance_repair: {
    checklist: [
      "Videz l'appareil — un réfrigérateur à réparer a besoin d'une glacière pour son contenu ; un lave-vaisselle ou une laveuse doit être vide ; un four doit être froid et assez propre pour y travailler.",
      "Dégagez l'espace autour et devant — nous devons généralement le sortir.",
      "Trouvez le numéro de modèle et de série et gardez-le à portée ; il est sur une étiquette à l'intérieur de la porte ou à l'arrière. Il nous dit quelles pièces apporter.",
      "Décrivez la panne aussi précisément que possible — le bruit, l'odeur, quand ça a commencé, ce qu'il fait et ne fait pas.",
      "Gardez les animaux hors de la cuisine ou de la buanderie pendant que l'appareil est ouvert.",
    ],
    warning:
      "Certaines réparations exigent une pièce à commander. Dans ce cas, la première visite est un diagnostic et la réparation une seconde visite ; nous vous le dirons avant de partir, avec le coût.",
    dayOf: [
      "Nous diagnostiquons d'abord, vous disons ce que nous avons trouvé et ce que coûte la réparation, et procédons seulement avec votre accord. L'appareil est testé sur un cycle complet avant notre départ.",
    ],
    afterCare:
      "Attendez le délai indiqué avant de recharger un réfrigérateur ou un congélateur. Si la panne revient, dites-le-nous — une réparation est garantie, et le second regard est à nos frais quand notre travail est en cause.",
  },

  locksmith: {
    checklist: [
      "Ayez une preuve que vous avez droit aux lieux — une pièce d'identité avec l'adresse, un bail ou un titre. Nous la demanderons ; c'est ce qui nous empêche d'ouvrir la porte de quelqu'un d'autre.",
      "Dégagez l'embrasure et la zone autour de chaque serrure concernée, à l'intérieur comme à l'extérieur.",
      "Rassemblez toutes les clés existantes des serrures à changer, pour savoir combien sont remplacées.",
      "Décidez combien de nouvelles clés il vous faut et qui en reçoit une.",
      "Signalez-nous tout câblage d'alarme ou de serrure intelligente sur les portes.",
    ],
    warning:
      "Nous n'ouvrons, ne recodons ni ne remplaçons une serrure sans preuve que vous avez droit aux lieux. Sans elle, la visite s'arrête à la porte, et elle est quand même facturée.",
    dayOf: [
      "Nous confirmons les portes et serrures de la soumission avec vous, faisons le travail, et testons chaque clé dans chaque serrure avant de partir. Les anciennes clés ne fonctionneront plus — c'est le but.",
    ],
    afterCare:
      "Testez chaque clé vous-même avant de quitter la maison. Une serrure doit tourner en douceur ; si elle accroche, dites-le-nous le jour même.",
  },

  garage_door: {
    checklist: [
      "Videz la baie de garage sous et à côté de la porte — la voiture dehors, et un espace libre sur toute la largeur de la porte et deux mètres de profondeur.",
      "Dégagez le plafond où passent les rails et l'ouvre-porte — vélos suspendus, rangements, tout ce qui est à portée du rail.",
      "Assurez-vous qu'il y a une prise fonctionnelle près du plafond pour l'ouvre-porte, et dites-nous s'il n'y en a pas.",
      "Sortez les voitures de l'entrée devant la porte — les panneaux et les ressorts entrent par là.",
      "Gardez animaux et enfants hors du garage pendant le travail sur les ressorts.",
    ],
    warning:
      "Un ressort de porte de garage est sous une tension énorme. N'essayez pas de desserrer, régler ou « aider » quoi que ce soit sur la porte avant notre arrivée, et gardez tout le monde hors du garage pendant les travaux.",
    dayOf: [
      "L'ancienne porte s'enlève en premier et part avec nous. La nouvelle porte, les rails, les ressorts et l'ouvre-porte sont posés, et la porte est équilibrée et actionnée sous tension avant notre départ.",
      "Nous vous montrons le déclencheur manuel et comment programmer les télécommandes et le clavier.",
    ],
    afterCare:
      "Ne réglez pas vous-même les ressorts ni la force de l'ouvre-porte — appelez-nous. Une fois par an, faites équilibrer la porte et lubrifier les roulettes ; c'est ce qui la garde silencieuse.",
  },

  elevator_services: {
    checklist: [
      "Prévenez l'immeuble — locataires et personnel doivent savoir quelle cabine est hors service, et de quand à quand.",
      "Donnez-nous accès à la salle des machines, à la cuvette et à chaque palier, avec des clés ou un contact qui peut ouvrir.",
      "Affichez les avis « hors service » à chaque palier, ou dites-nous de les apporter.",
      "Signalez-nous tout ce qui est prévu dans l'immeuble ce jour-là — un déménagement, une livraison — qui dépend de la cabine.",
      "Ayez le registre d'entretien et le dernier certificat d'inspection disponibles.",
    ],
    warning:
      "La cabine est hors service pendant toute la visite. Si l'immeuble n'a qu'un ascenseur et des résidents qui ne peuvent pas prendre l'escalier, prévoyez-le avant notre arrivée — le travail ne peut pas être interrompu à mi-chemin.",
    dayOf: [
      "Nous verrouillons la cabine, faisons le travail de la soumission, et la testons sur toute sa course en charge avant de la remettre en service. Le registre est signé avant notre départ.",
    ],
    afterCare:
      "Si la cabine se comporte différemment — un bruit nouveau, un arrêt brusque, une porte qui hésite — mettez-la hors service et appelez-nous ; n'attendez pas la prochaine visite planifiée.",
  },

  well_water: {
    checklist: [
      "Dégagez l'accès à la tête de puits — coupez ce qui pousse dessus et déplacez ce qui est entreposé autour.",
      "Dégagez autour du réservoir à pression, des commandes de la pompe et de tout filtre ou adoucisseur dans la maison.",
      "Remplissez quelques contenants d'eau avant notre arrivée — l'alimentation sera coupée pendant une partie de la visite.",
      "Dites-nous ce que vous avez remarqué : changements de pression, air dans les conduites, goût, couleur, ou une pompe qui tourne sans robinet ouvert.",
      "Gardez les animaux loin d'un tubage de puits ouvert.",
    ],
    warning:
      "L'eau sera coupée pendant la visite et, pour certains travaux, jusqu'au retour d'un résultat d'analyse. Ne buvez pas l'eau du robinet avant que nous vous disions qu'elle est sûre.",
    dayOf: [
      "Nous inspectons et testons d'abord, confirmons le travail avec vous, puis le faisons. Le système est remis en pression et mis en marche avant notre départ, et nous purgeons les conduites devant vous.",
    ],
    afterCare:
      "Faites couler le robinet extérieur pendant le délai indiqué pour évacuer les sédiments remués avant d'utiliser les robinets intérieurs. Gardez la tête de puits dégagée et au-dessus du sol — c'est le facteur le plus important pour la qualité de votre eau.",
  },

  mechanical_contracting: {
    checklist: [
      "Confirmez la fenêtre d'arrêt avec tous ceux qui dépendent du système — locataires, production, gestionnaire d'immeuble — et affichez-la.",
      "Donnez-nous accès à la salle mécanique, au toit, aux plénums et à la salle électrique, avec des clés ou un contact.",
      "Dégagez les zones de travail et un passage assez large pour l'équipement.",
      "Signalez-nous tout autre problème sur le système — une fuite, un bruit, une zone qui n'atteint jamais sa température.",
      "Ayez les plans de l'immeuble et les manuels des équipements disponibles si vous les avez.",
    ],
    warning:
      "Le système est arrêté pendant la fenêtre convenue. Un arrêt qui ne peut pas être prolongé doit nous être signalé avant de commencer, pas quand la fenêtre se ferme — le travail ne peut pas rester à moitié raccordé.",
    dayOf: [
      "Nous isolons le système, faisons le travail de la soumission, et le mettons en service avant de le remettre en fonction. Quand un démarrage exige que l'immeuble soit occupé, nous le planifions avec vous.",
    ],
    afterCare:
      "Signalez tout ce qui diffère la première semaine — une zone lente à répondre, un bruit nouveau, une pression qui dérive. Le rapport de mise en service que nous laissons est la référence pour comparer.",
  },

  installation_services: {
    checklist: [
      "Ayez le produit sur place, non ouvert, avec toutes ses pièces et les instructions du fabricant — vérifiez la boîte pour des dommages avant notre arrivée.",
      "Dégagez l'emplacement prévu et un passage de la porte jusque-là.",
      "S'il faut du courant, de l'eau ou une fixation murale, dites-nous ce qu'il y a actuellement — une prise, une valve, ce que vous savez du mur.",
      "Retirez l'ancien article, ou dites-nous qu'il fait partie du travail.",
      "Gardez animaux et enfants hors de la zone pendant l'installation.",
    ],
    warning:
      "S'il manque une pièce au produit ou s'il arrive endommagé, l'installation ne peut pas être terminée et la visite est quand même facturée. Ouvrez la boîte et vérifiez-la contre la liste des pièces la veille.",
    dayOf: [
      "Nous déballons, vérifions, installons selon les instructions du fabricant, testons, et emportons l'emballage. Nous vous montrons le fonctionnement avant de partir.",
    ],
    afterCare:
      "Gardez le manuel et le reçu ensemble — la garantie du fabricant exige les deux. Dites-nous dans les premiers jours si quelque chose est lâche, pas de niveau ou ne fonctionne pas comme montré.",
  },

  roofing_service: {
    checklist: [
      "Sortez les voitures de l'entrée et éloignez-les de la maison la veille au soir — c'est là que vont le conteneur et la livraison de matériaux, et les bardeaux tombent.",
      "Dégagez le pourtour de la maison — mobilier de patio, barbecue, jardinières, boyaux, jouets et tout ce qui est à quelques mètres des murs. Couvrez ce qui ne peut pas être déplacé.",
      "Décrochez ou fixez ce qui est suspendu aux murs et sur les étagères à l'intérieur — le martelage fait vibrer toute la maison. Les cadres tombent ; les objets en hauteur aussi.",
      "Retirez du grenier ce que vous ne voulez pas voir couvert de poussière, et couvrez le reste — des débris passent entre les planches du platelage pendant l'arrachage.",
      "Animaux — un arrachage de toiture est bruyant toute la journée. Gardez-les dans la pièce la plus calme, ou faites-les garder ailleurs.",
      "Déverrouillez les barrières latérales et coupez les arroseurs. Signalez-nous une antenne parabolique, un panneau solaire ou une antenne à conserver.",
    ],
    warning:
      "Personne sous les avant-toits pendant l'arrachage — ni dans l'entrée, ni sur le patio, ni sur le chemin de la porte. Utilisez la porte convenue et gardez les enfants loin du pourtour toute la journée.",
    dayOf: [
      "Nous installons les protections au sol et un conteneur, arrachons l'ancienne toiture jusqu'au platelage, inspectons les planches, et vous montrons ce qui doit être remplacé avant de le recouvrir.",
      "Membrane, solins, nouveau revêtement et ventilation se posent le jour même quand la taille du toit le permet. Le toit n'est jamais laissé ouvert la nuit.",
      "Nous passons l'aimant sur le terrain pour les clous avant de partir, et de nouveau le lendemain matin si nous revenons.",
    ],
    afterCare:
      "Faites vous-même le tour du terrain les premiers jours et signalez-nous tout clou trouvé — nous revenons avec l'aimant. Une légère perte de granules aux premières pluies est normale sur une toiture d'asphalte neuve.",
  },

  gutter_services: {
    checklist: [
      "Sortez les voitures de l'entrée et éloignez-les des murs — les échelles se dressent tout autour de la maison.",
      "Dégagez le pourtour — mobilier de patio, jardinières et boyaux loin des murs où les échelles s'appuieront.",
      "Déverrouillez les barrières latérales et signalez-nous toute plate-bande à protéger sous les avant-toits.",
      "Dites-nous où l'eau doit aller — une descente qui se déverse sur l'entrée du voisin est la raison la plus fréquente de nos retours.",
      "Animaux à l'intérieur pendant que les échelles sont dressées.",
    ],
    warning:
      "Nous travaillons sur des échelles autour de chaque mur de la maison. Tout ce qui est sous les avant-toits — une voiture, un couvercle de spa, une table en verre — est sur la trajectoire d'une pelletée de feuilles mouillées ou d'un outil échappé. Déplacez-le ou couvrez-le.",
    dayOf: [
      "Pour un nettoyage, nous vidons à la main, rinçons chaque descente et inspectons les gouttières vides. Pour une installation, l'ancienne gouttière descend et la nouvelle est formée sur place et posée avec une pente vers les sorties.",
      "Nous faisons couler l'eau partout avant de partir, pour que vous la voyiez s'écouler.",
    ],
    afterCare:
      "Après la première grosse pluie, regardez si l'eau déborde de la gouttière ou s'accumule près des fondations et dites-le-nous — c'est une pente ou une sortie, et c'est vite réglé.",
  },

  siding: {
    checklist: [
      "Éloignez les voitures de la maison et dégagez le pourtour — mobilier, jardinières, boyaux, tout ce qui est à quelques mètres des murs à revêtir.",
      "Décrochez les cadres et les objets sur les étagères du côté intérieur des murs concernés — le clouage les fait vibrer.",
      "Coupez les arroseurs et déverrouillez les barrières latérales.",
      "Signalez-nous tout ce qui est fixé aux murs et que vous voulez garder — luminaires, dévidoir, antenne parabolique, numéros civiques — et si cela retourne au même endroit.",
      "Taillez les arbustes qui touchent les murs, ou demandez-nous de le faire.",
      "Animaux à l'intérieur pendant les heures de travail.",
    ],
    warning:
      "Le revêtement intermédiaire derrière l'ancien parement ne peut pas être inspecté avant son retrait. S'il est pourri ou humide, c'est un travail distinct que nous vous montrerons en photos et chiffrerons avant de le recouvrir.",
    dayOf: [
      "L'ancien parement s'enlève un mur à la fois et part avec nous. Le revêtement intermédiaire est vérifié, le pare-intempéries posé, puis le nouveau parement et les moulures.",
      "Attendez-vous au bruit des coupes et du clouage toute la journée, et à un chantier plus propre que prévu à la fin.",
    ],
    afterCare:
      "Lavez le parement neuf au boyau et à la brosse douce, jamais au jet à pression de près. Signalez-nous un panneau qui claque au vent — c'est une fixation, et c'est vite réglé.",
  },

  insulation: {
    checklist: [
      "Dégagez la trappe du grenier et un mètre autour — le boyau de la souffleuse y monte et y reste toute la journée.",
      "Retirez du grenier ce que vous voulez garder propre, et signalez-nous ce qui doit y rester.",
      "Dégagez le couloir ou le placard sous la trappe, et un passage de la porte jusque-là.",
      "Signalez-nous les luminaires encastrés, les ventilateurs de salle de bain, une cheminée ou un ventilateur d'entretoit — chacun exige un dégagement.",
      "Animaux — la souffleuse est bruyante. Gardez-les derrière une porte fermée, loin de la trappe.",
    ],
    warning:
      "Tout ce qui reste au grenier sera enseveli. Si vous voulez le récupérer, il doit descendre avant notre arrivée. Nous ne creuserons pas pour une boîte de photos après coup — l'isolant est le produit, et le remuer défait le travail.",
    dayOf: [
      "Nous scellons d'abord les fuites d'air — lisses hautes, percements et trappe — puis soufflons l'isolant à l'épaisseur exigée par la valeur R de votre soumission, en gardant le chemin de ventilation ouvert.",
      "Nous mesurons l'épaisseur avant et après, et laissons des repères pour qu'elle puisse être vérifiée.",
    ],
    afterCare:
      "Laissez le grenier tel quel. Si un entrepreneur doit y monter plus tard — un électricien, un couvreur — demandez-lui de marcher sur les solives et de remettre l'isolant en place là où il s'est agenouillé.",
  },

  masonry: {
    checklist: [
      "Sortez les voitures et dégagez la zone autour du mur, des marches ou de la cheminée concernés — un espace libre de deux mètres, et un passage pour les brouettes.",
      "Coupez les arroseurs et laissez-les fermés jusqu'à nouvel ordre — le mortier neuf ne doit pas être mouillé pendant son durcissement.",
      "Signalez-nous toute plate-bande, dalle de patio ou descente dans la zone de travail à protéger.",
      "Déverrouillez les barrières et dites-nous où installer le malaxeur et déposer les matériaux.",
      "Animaux loin de la zone de travail et du mortier frais jusqu'à sa prise.",
    ],
    warning:
      "Mortier et crépi frais ne doivent ni geler ni recevoir de pluie pendant le délai indiqué. Si la météo tourne, nous devrons peut-être déplacer la date — le travail ne change pas, le jour peut-être.",
    dayOf: [
      "Nous protégeons les alentours, retirons ce qui a lâché, préparons le support, et posons ou appliquons le nouveau matériau. Le durcissement commence dès la fin, alors tenez eau et passage à l'écart.",
    ],
    afterCare:
      "Tenez eau, arroseurs et passage à l'écart du travail neuf pendant le délai indiqué. Une légère différence de teinte entre mortier neuf et ancien s'estompe la première année.",
  },

  paving: {
    checklist: [
      "Sortez toutes les voitures de l'entrée la veille au soir, et prévoyez un autre stationnement pour tout le projet — l'entrée est inutilisable dès le premier matin.",
      "Dégagez les bords — jardinières, panier de basket, boyaux, pierres décoratives et tout ce qui longe l'entrée ou l'allée.",
      "Coupez les arroseurs et laissez-les fermés jusqu'à nouvel ordre. Dites-nous où passent les conduites d'irrigation près des travaux.",
      "Dites-nous où les services entrent dans la maison — gaz, eau, câble — pour que l'excavation les évite. Nous organisons la localisation ; vous nous dites ce que vous savez.",
      "Animaux et enfants hors de la zone de travail de la première excavation jusqu'à ce que la surface puisse être foulée.",
    ],
    warning:
      "Rien ne roule sur la nouvelle surface avant notre feu vert — ni voiture, ni bac roulant — et rien de pointu n'y est posé. Rouler trop tôt laisse des marques qui ne partent pas.",
    dayOf: [
      "Nous excavons, posons une fondation compactée par couches, plaçons les pavés selon le motif convenu, retenons les bordures, remplissons les joints et compactons toute la surface. Le terrain autour est nivelé et remis en état.",
      "Il y a du bruit du compacteur et de la scie, et un peu de poussière ; nous gardons la rue libre de matériaux.",
    ],
    afterCare:
      "Tenez les véhicules à l'écart pendant le délai indiqué. Un peu de sable de joint se tasse les premières semaines et peut être complété. Balayez ; ne lavez pas à pression la première saison.",
  },

  driveway_sealing: {
    checklist: [
      "Sortez toutes les voitures de l'entrée la veille au soir, et stationnez ailleurs jusqu'au durcissement du scellant — nous vous dirons combien de temps le jour même.",
      "Dégagez la surface — bacs, jardinières, boyaux, panier de basket, tout ce qui est posé dessus.",
      "Coupez les arroseurs la veille et laissez-les fermés jusqu'à nouvel ordre ; une entrée mouillée ne se scelle pas et un scellant mouillé se délave.",
      "Signalez-nous les taches d'huile, fissures et creux que vous avez remarqués — les traiter est un travail distinct, et nous ne pouvons chiffrer que ce que nous connaissons.",
      "Animaux et enfants hors de l'entrée du début des travaux jusqu'au durcissement.",
    ],
    warning:
      "Personne et rien sur l'entrée avant le durcissement du scellant. Empreintes de pas, de pneus et de pattes se fixent dans un scellant frais et y restent. Si vous devez traverser, passez par la pelouse.",
    dayOf: [
      "Nous balayons et soufflons la surface, traitons les taches d'huile, masquons les bords, et appliquons le scellant au nombre de couches de votre soumission. Nous bloquons l'entrée en partant.",
    ],
    afterCare:
      "Laissez la barrière en place pendant le délai indiqué. Évitez de tourner le volant à l'arrêt sur l'entrée les premières semaines — cela marque un scellant frais.",
  },

  epoxy: {
    checklist: [
      "Videz complètement le garage — voitures, étagères, vélos, tout ce qui est au sol. Le plancher doit être nu d'un mur à l'autre.",
      "Signalez-nous taches d'huile, fissures, anciens revêtements et tout endroit où l'eau entre ; la préparation en dépend.",
      "Vérifiez la météo et la température — le plancher doit être sec et au-dessus de la température indiquée pendant tout le durcissement. Gardez le garage fermé et chauffé s'il fait froid.",
      "Prévoyez un stationnement pour tout le projet, y compris le temps de durcissement que nous vous donnerons.",
      "Gardez animaux et enfants hors du garage du premier meulage jusqu'au durcissement complet.",
    ],
    warning:
      "Rien ne retourne sur le plancher avant le durcissement — ni un pied, ni un vélo, et la voiture en dernier. Y marcher trop tôt laisse des empreintes ; y stationner trop tôt décolle le revêtement sous les pneus. Nous vous donnons les délais le jour même ; respectez-les.",
    dayOf: [
      "Nous meulons le béton, réparons les fissures et comblons les écaillages, puis appliquons les couches de votre soumission avec le temps de durcissement que chacune exige. Le garage sentira le revêtement ; gardez la porte vers la maison fermée.",
    ],
    afterCare:
      "D'abord la circulation à pied, puis les objets légers, puis la voiture, chacun après le délai indiqué. Des pneus chauds peuvent marquer un plancher pas tout à fait durci — attendez le délai complet avant de stationner.",
  },

  fence: {
    checklist: [
      "Confirmez le tracé de la clôture — parcourez-le avec nous ou marquez-le avant notre arrivée. Une clôture du mauvais côté de la limite est une erreur très coûteuse, et seul un certificat de localisation la tranche.",
      "Prévenez vos voisins — l'équipe, le bruit et les poteaux sont des deux côtés de la limite pendant une journée.",
      "Organisez la localisation des services publics, ou confirmez que nous le faisons — aucun trou de poteau n'est creusé avant le marquage des conduites.",
      "Dégagez le tracé — plantes, objets entreposés, compost, le toit de cabanon qui déborde.",
      "Coupez les arroseurs et dites-nous où passent les conduites d'irrigation près de la clôture.",
      "Animaux — il n'y a pas de clôture pendant les travaux. Gardez les chiens à l'intérieur ou en laisse jusqu'à ce que les barrières soient posées et verrouillées.",
    ],
    warning:
      "La localisation des services doit être faite avant de creuser. Si elle n'est pas marquée à notre arrivée, nous ne pouvons pas commencer, et la visite est reportée. Personne ne creuse un trou de poteau dans une conduite de gaz pour gagner un jour.",
    dayOf: [
      "L'ancienne clôture descend d'abord, s'il y en a une. Les trous sont creusés, les poteaux posés, et les panneaux ou planches montés. Les barrières sont posées et ajustées en dernier.",
      "Le béton autour des poteaux a besoin de temps avant que la clôture supporte une charge — nous vous dirons combien avant d'y appuyer une échelle.",
    ],
    afterCare:
      "Gardez chiens et enfants loin des barrières et des panneaux jusqu'à la prise des poteaux. Le bois neuf grisonne en vieillissant ; teignez-le ou scellez-le selon le calendrier recommandé, pas avant qu'il ait séché.",
  },

  chimney_sweep: {
    checklist: [
      "Pas de feu pendant les 24 heures précédant notre arrivée — le conduit et le foyer doivent être froids pour être ramonés, et une cheminée tiède est une visite reportée.",
      "Dégagez l'âtre et la zone devant — meubles, tapis et ornements à deux mètres.",
      "Retirez les cendres et le bois restant du foyer.",
      "Signalez-nous ce que vous avez remarqué — fumée dans la pièce, odeur, oiseaux, un registre qui coince.",
      "Gardez les animaux hors de la pièce ; l'aspirateur et les brosses sont bruyants.",
    ],
    warning:
      "Une cheminée utilisée dans les dernières 24 heures ne peut pas être ramonée en sécurité. S'il y a eu un feu hier soir, dites-le-nous avant notre départ et nous déplacerons la visite.",
    dayOf: [
      "Nous scellons l'ouverture du foyer, ramonons le conduit par le haut ou par le bas, aspirons le foyer, et inspectons la chemise, le chapeau et le registre. Vous recevez une note écrite de ce que nous avons trouvé.",
    ],
    afterCare:
      "Si nous avons trouvé quelque chose à corriger avant le prochain feu, n'en allumez pas avant que ce soit fait. Sinon, brûlez du bois sec et bien séché — c'est ce qui garde la cheminée propre entre les visites.",
  },

  restoration: {
    checklist: [
      "Dites-nous ce qui s'est passé et quand — la chronologie décide de ce qui peut être sauvé. Un dégât d'eau, surtout, empire d'heure en heure.",
      "Sortez vous-même de la zone touchée ce que vous pouvez sauver — documents, photos, électronique — et dites-nous ce que vous aimeriez que nous tentions de récupérer.",
      "Dégagez un passage de la porte aux pièces touchées pour l'équipement : déshumidificateurs, ventilateurs, et les matériaux qui sortent.",
      "Signalez-nous tout ce qui est sensible dans la maison — une personne avec des difficultés respiratoires, un animal, un système d'alarme.",
      "Sachez où sont votre panneau électrique et votre entrée d'eau ; nous pourrions avoir besoin des deux.",
    ],
    warning:
      "L'équipement de séchage doit tourner sans arrêt, jour et nuit, tant que nous le laissons. L'éteindre la nuit pour économiser ou pour le bruit défait le séchage de la journée et ajoute des jours au travail.",
    dayOf: [
      "Nous évaluons et documentons d'abord les dégâts, confinons la zone touchée, retirons ce qui ne peut pas être sauvé, et installons l'équipement de séchage ou de nettoyage. Nous relevons les mesures à chaque visite.",
      "La reconstruction — gypse, plancher, peinture — ne commence que quand les relevés disent que la structure est sèche.",
    ],
    afterCare:
      "Laissez l'équipement tourner jusqu'à ce que nous le retirions. Signalez-nous immédiatement toute nouvelle odeur, tache ou humidité — c'est bien moins cher pris tôt.",
  },

  earthworks: {
    checklist: [
      "Organisez la localisation des services publics, ou confirmez que nous le faisons — rien n'est creusé avant que chaque conduite soit marquée.",
      "Prévenez vos voisins — machinerie lourde, bruit et camions pendant les jours où nous sommes là.",
      "Sortez les voitures de l'entrée et de la rue devant la maison — la machinerie et les camions ont besoin de la place.",
      "Décrochez ou fixez les objets fragiles à l'intérieur — une démolition ou une pelle à côté de la maison la fait trembler.",
      "Signalez-nous la fosse septique, le puits, les conduites d'irrigation, les câbles enfouis et tout ce que vous savez sous le sol.",
      "Animaux et enfants bien loin de la zone de travail en tout temps, y compris après les heures.",
    ],
    warning:
      "La localisation des services doit être faite et visible à notre arrivée, et tout ce qui est enfoui que les services publics ne marquent pas — une conduite de gaz privée vers un chauffe-piscine, un champ d'épuration — c'est à vous de nous le dire. Nous ne voyons pas à travers le sol.",
    dayOf: [
      "Nous protégeons ce qui reste, clôturons la zone de travail, et travaillons le site dans l'ordre de votre soumission. Les débris partent en conteneurs ou en camions au fur et à mesure, pas à la fin.",
      "Le site est laissé sécuritaire chaque soir : trous clôturés, machinerie verrouillée, rien de lâche.",
    ],
    afterCare:
      "Tenez-vous à l'écart du sol remué jusqu'à ce qu'il soit nivelé et tassé. Signalez-nous tout affaissement, eau stagnante ou fissure qui apparaît les premières semaines.",
  },

  home_inspection: {
    checklist: [
      "Assurez-vous que tous les services sont en marche — électricité, eau, gaz — et que les veilleuses sont allumées. Un système éteint ne peut pas être inspecté et sera noté comme non inspecté.",
      "Dégagez l'accès au panneau électrique, à la fournaise, au chauffe-eau, à la trappe du grenier et à l'entrée du vide sanitaire — un mètre libre devant chacun.",
      "Éloignez les objets entreposés des murs de fondation au sous-sol et dans le garage, pour que les murs soient visibles.",
      "Déverrouillez chaque pièce, placard, dépendance et barrière, et désarmez l'alarme.",
      "Animaux — en cage ou hors de la maison. Nous ouvrons chaque porte et fenêtre et montons au grenier ; un chien libre dans la maison est un retard et un risque.",
      "Prévoyez d'être là pour la visite de fin ; c'est la partie la plus utile.",
    ],
    warning:
      "L'inspection est visuelle et non invasive. Tout ce que nous ne pouvons pas atteindre ou voir — un mur derrière des boîtes, une trappe de grenier peinte, une pièce verrouillée — est noté comme non inspecté, pas comme correct. Rendez tout accessible.",
    dayOf: [
      "Nous parcourons la propriété du toit vers le bas — extérieur, toiture, grenier, chaque pièce, le sous-sol et les systèmes — en faisant fonctionner tout avec ses commandes normales et en photographiant ce que nous trouvons.",
      "À la fin, nous passons en revue les constats importants avec vous, et le rapport écrit suit.",
    ],
    afterCare:
      "Lisez le rapport au complet, pas seulement le sommaire — et demandez-nous ce que vous ne comprenez pas. Les points marqués pour évaluation approfondie ne sont pas un verdict ; ce sont les questions à poser à un spécialiste avant de décider.",
  },

  renovation: {
    checklist: [
      "Videz complètement les pièces du projet, garde-robes comprises. Tout ce qui doit rester dans la maison a besoin d'une place loin de la zone de travail pour tout le projet.",
      "Aménagez la pièce où vous vivrez — une cuisine temporaire si la cuisine est dans le projet, une salle de bain qui reste utilisable, un endroit calme pour travailler.",
      "Dégagez un passage de la porte à la zone de travail, et décidez quelle porte l'équipe utilise. Couvrez le plancher le long du passage ou demandez-nous de le faire.",
      "Décrochez ce qui est sur les murs de l'autre côté des pièces concernées ; l'ossature et la démolition font vibrer.",
      "Signalez-nous l'alarme, le stationnement, les voisins à prévenir, et ce que vous savez dans les murs.",
      "Animaux et enfants — la zone de travail est un chantier même en dehors des heures. Gardez-la fermée.",
    ],
    warning:
      "Une fois la démolition commencée, ce qu'il y a derrière les murs et sous les planchers devient visible pour la première fois. Tout ce que nous trouvons qui change le travail — pourriture, vieux filage, un drain déplacé — vous est montré et chiffré avant de continuer. Le calendrier peut bouger ; le prix, pas sans votre accord.",
    dayOf: [
      "La démolition d'abord — les journées les plus bruyantes et poussiéreuses. Nous scellons les portes et les conduits avant de commencer. Puis le gros œuvre — ossature, plomberie, électricité — puis les inspections, puis les finitions.",
      "L'équipe est sur place la plupart des jours, mais pas chaque métier chaque jour ; certaines journées seront calmes pendant qu'un produit durcit ou qu'un inspecteur est attendu.",
      "Nous faisons le tour des travaux avec vous à la fin de chaque étape.",
    ],
    afterCare:
      "Gypse, peinture et calfeutrage neufs continuent de durcir après notre départ ; de petites fissures aux joints la première saison, c'est la maison qui travaille, et nous revenons les retoucher. Gardez ensemble la garantie et les manuels que nous laissons.",
  },

  carpentry: {
    checklist: [
      "Dégagez la zone où va le travail — meubles sortis ou regroupés au centre et couverts, le mur nu.",
      "Ayez sur place tout matériau que vous fournissez et, pour le bois, à l'intérieur de la maison pendant le délai d'acclimatation nécessaire.",
      "Dites-nous ce qu'il y a derrière le mur si vous le savez — filage, plomberie, un montant coupé.",
      "Décidez du fini — teint, peint, laissé brut — avant notre arrivée.",
      "Gardez les animaux hors de la pièce pendant les coupes.",
    ],
    warning:
      "Les coupes se font sur place, et la sciure voyage. S'il y a une pièce qui doit rester propre — une chambre d'enfant, un bureau avec de l'équipement — dites-le-nous et nous la scellerons avant de commencer.",
    dayOf: [
      "Nous remesurons, coupons et ajustons, fixons et finissons. Les coupes se font dehors ou dans une zone confinée quand le temps le permet.",
      "Ce qui doit être fabriqué hors site est posé lors d'une seconde visite.",
    ],
    afterCare:
      "Le bois bouge avec les saisons. Une fine ligne qui s'ouvre à un joint la première année est normale ; une pièce qui se décolle du mur ne l'est pas — dites-le-nous.",
  },

  residential_cleaning: {
    checklist: [
      "Rangez — vêtements, jouets, papiers et vaisselle à leur place, pour que le temps serve à nettoyer les surfaces plutôt qu'à déplacer ce qui est dessus.",
      "Rangez objets de valeur, argent et tout ce qui est fragile que vous préférez que nous ne touchions pas.",
      "Signalez-nous ce qui demande un soin particulier — un comptoir de marbre, une antiquité, un produit auquel vous êtes allergique — et nous apporterons le bon ou utiliserons le vôtre.",
      "Animaux — dites-nous qui est dans la maison, où ils restent, et s'ils sont amicaux. Un chat qui s'échappe par une porte ouverte est notre pire journée.",
      "Organisez l'accès : une clé, un code, ou quelqu'un à la maison. Parlez-nous de l'alarme.",
    ],
    warning:
      "Une pièce encombrée est rangée autour, pas nettoyée. Si vous voulez les surfaces faites, elles doivent être dégagées à notre arrivée — nous ne pouvons pas décider ce qui est à jeter et ce qui ne l'est pas.",
    dayOf: [
      "Nous travaillons de haut en bas, pièce par pièce, avec les produits de votre soumission. Les planchers sont faits en dernier, et nous laissons une note de ce que nous avons remarqué — une fuite sous un évier, une fenêtre qui ne ferme pas.",
    ],
    afterCare:
      "Les planchers peuvent rester humides un moment après notre départ. Si quelque chose a été oublié, dites-le-nous le jour même et nous revenons — c'est la norme.",
  },

  commercial_cleaning: {
    checklist: [
      "Organisez l'accès hors des heures — une clé, une carte ou un code — et dites-nous comment l'alarme s'arme et se désarme.",
      "Demandez au personnel de dégager les bureaux des papiers et objets personnels les jours de ménage ; nous ne déplaçons pas les documents.",
      "Dites-nous quelles zones sont interdites, et lesquelles demandent plus d'attention — la cuisine, les toilettes, la réception.",
      "Montrez-nous où sont rangées les fournitures, où prendre l'eau, et où sortent les déchets.",
      "Signalez-nous toute restriction de produit dans l'immeuble — sans parfum, une surface qui ne supporte pas de désinfectant.",
    ],
    warning:
      "Nous suivons les consignes d'accès et d'alarme exactement comme données. Si un code change ou qu'une porte s'ajoute à la tournée, dites-le-nous avant la visite — une fausse alarme à deux heures du matin vous est facturée par la centrale, pas par nous.",
    dayOf: [
      "Nous nettoyons selon l'horaire et la liste convenus, signons le registre, et verrouillons. Tout ce que nous trouvons — une fuite, un appareil brisé, une porte qui ne verrouille pas — vous est noté le soir même.",
    ],
    afterCare:
      "Consultez le registre et signalez-nous dans la journée ce qui a été oublié. La liste s'ajuste, elle ne se discute pas.",
  },

  carpet_cleaning: {
    checklist: [
      "Passez l'aspirateur sur les tapis avant notre arrivée — le nettoyage s'attaque alors à la saleté incrustée, pas à celle qui est libre.",
      "Sortez les petits meubles, lampes, plantes et tout ce qui est au sol des pièces. Les gros meubles peuvent rester si votre soumission le prévoit ; nous travaillerons autour.",
      "Montrez-nous les taches et dites-nous ce qu'elles sont si vous le savez — animal, vin, encre — parce que chacune demande un traitement différent.",
      "Animaux — gardez-les hors du tapis jusqu'au séchage complet, et hors des pièces pendant le travail.",
      "Prévoyez de ne pas utiliser les pièces jusqu'au séchage. Nous vous dirons combien de temps le jour même ; ventilation et chauffage le raccourcissent.",
    ],
    warning:
      "Certaines taches sont permanentes. Nous traitons chacune, mais une tache fixée dans la fibre, ou travaillée avec le mauvais produit, peut pâlir plutôt que partir. Nous vous dirons honnêtement lesquelles avant de commencer.",
    dayOf: [
      "Nous prétraitons, nettoyons, rinçons et extrayons, pièce par pièce, et plaçons des protecteurs sous tout pied de meuble qui reste sur un tapis humide.",
    ],
    afterCare:
      "Restez hors du tapis, ou portez des chaussettes propres, jusqu'à ce qu'il soit sec. Laissez les protecteurs sous les meubles jusque-là. Ouvrez les fenêtres ou faites tourner le ventilateur pour accélérer.",
  },

  window_cleaning: {
    checklist: [
      "Remontez les stores, ouvrez les rideaux et dégagez les rebords de fenêtres intérieurs — plantes, ornements et tout ce qui serait mouillé.",
      "Reculez les meubles d'un pas des fenêtres faites à l'intérieur.",
      "Dehors, sortez les voitures de l'entrée et tout ce qui est sous les fenêtres où les échelles s'appuieront.",
      "Signalez-nous toute fenêtre qui n'ouvre pas, un scellant brisé, ou une moustiquaire fragile.",
      "Déverrouillez les barrières latérales et gardez les animaux à l'intérieur pendant que les échelles sont dressées.",
    ],
    warning:
      "Une fenêtre au scellant brisé — buée entre les vitres — ne peut pas être nettoyée clairement ; l'humidité est à l'intérieur de l'unité. Nous vous dirons lesquelles plutôt que de vous facturer le nettoyage de ce qui ne peut pas l'être.",
    dayOf: [
      "Nous nettoyons l'extérieur d'abord, puis l'intérieur, en sortant les moustiquaires pour les laver. Rebords et cadres sont essuyés. Nous laissons les fenêtres comme nous les avons trouvées — ouvertes ou fermées.",
    ],
    afterCare:
      "Rien à faire. Si une traînée apparaît au soleil de demain, dites-le-nous et nous revenons pour cette fenêtre.",
  },

  pressure_washing: {
    checklist: [
      "Fermez chaque fenêtre et porte, et signalez-nous celles qui ne sont pas étanches — l'eau sous pression trouve l'interstice.",
      "Sortez les voitures de l'entrée et éloignez-les des murs, et dégagez mobilier extérieur, jardinières, tapis et jouets de la zone lavée.",
      "Couvrez ou déplacez les plantes près des murs, et signalez-nous une plate-bande à protéger — le ruissellement emporte ce qui se détache du mur.",
      "Coupez les prises extérieures et signalez-nous tout luminaire, caméra ou haut-parleur fixé au mur.",
      "Animaux à l'intérieur pendant la visite.",
    ],
    warning:
      "Le lavage à pression enlève ce qui est lâche. Une peinture qui s'écaille déjà, une planche décollée, un joint de mortier qui s'effrite ou un vieux scellant partiront avec la saleté. Nous regardons d'abord et vous disons ce que nous voyons, mais nous ne pouvons pas laver un mur qui n'est pas sain sans le révéler.",
    dayOf: [
      "Nous prétraitons, lavons à la pression que la surface tolère, rinçons, et évacuons le ruissellement. La surface est mouillée à notre départ et montre sa vraie couleur une fois sèche.",
    ],
    afterCare:
      "Laissez la surface sécher complètement avant de sceller, teindre ou remettre les meubles. Si une tache réapparaît en quelques jours, c'est probablement de la moisissure ou des algues, et nous pouvons la traiter.",
  },

  auto_detailing: {
    checklist: [
      "Retirez vos effets du véhicule — boîte à gants, console, vide-poches, coffre et sous les sièges. Nous nettoyons ce qui est là ; nous ne pouvons pas décider ce qui est à jeter.",
      "Sortez les sièges d'enfant, ou dites-nous de le faire ; un siège en place depuis un an a une voiture de miettes en dessous.",
      "Signalez-nous les taches, les odeurs et toute zone où concentrer nos efforts.",
      "Laissez la clé, et dites-nous ce qui ne fonctionne pas — une vitre, un verrou, un témoin allumé.",
      "Ne lavez pas la voiture la veille — nous voulons voir ce qu'il y a vraiment.",
    ],
    warning:
      "Certaines marques sont permanentes : une brûlure dans le tissu, une rayure à travers le vernis, une teinture transférée sur du cuir clair. Nous vous disons lesquelles avant de commencer plutôt qu'après.",
    dayOf: [
      "L'intérieur d'abord — aspirateur, shampoing ou vapeur, cuir et garnitures — puis l'extérieur : lavage, décontamination, polissage si chiffré, et protection. La voiture est sèche et prête à la reprise.",
    ],
    afterCare:
      "Évitez le lave-auto automatique les premiers jours après un polissage et une protection ; lavez à la main avec deux seaux. Gardez une microfibre dans la voiture pour les marques du premier jour.",
  },

  junk_removal: {
    checklist: [
      "Marquez ce qui part — un ruban, une note autocollante, ou tout au même endroit. Nous prenons ce que vous montrez et rien d'autre.",
      "Mettez à part ce que vous gardez, dans un endroit où nous n'irons pas.",
      "Signalez-nous les articles dangereux — peinture, produits chimiques, piles, propane, un frigo avec réfrigérant — certains exigent une autre filière et certains ne peuvent pas être pris.",
      "Dégagez un passage des articles à la porte, et de la porte à l'endroit où le camion peut se garer.",
      "Animaux enfermés dans une pièce pendant que les portes sont ouvertes et que des objets lourds bougent.",
    ],
    warning:
      "Nous ne pouvons pas prendre certaines choses — produits chimiques, amiante, certains appareils sans certificat — et nous vous dirons lesquelles en les voyant. Ne les cachez pas dans une boîte ; cela rend tout le chargement problématique au site d'élimination.",
    dayOf: [
      "Nous confirmons le chargement avec vous, le sortons, balayons l'espace, et l'apportons pour être trié entre don, recyclage et élimination. Vous recevez un reçu de ce qui est parti.",
    ],
    afterCare:
      "Rien à faire. Si un article emporté s'avère être une erreur, appelez le jour même — un chargement est trié le lendemain matin.",
  },

  landscaping_design: {
    checklist: [
      "Parcourez le plan avec nous avant le début — confirmez ce qui reste, ce qui part et où sont les lignes. Il est bien plus facile de déplacer une plate-bande sur papier que dans le sol.",
      "Organisez la localisation des services publics, ou confirmez que nous le faisons ; rien n'est creusé avant le marquage.",
      "Dites-nous où sont les conduites et les têtes d'irrigation, et coupez le système pour le projet.",
      "Sortez les voitures de l'entrée les jours de livraison — terre, pierre et plantes arrivent par camion.",
      "Prévenez vos voisins du bruit et des camions, et de toute plante près de la limite qui est à eux.",
      "Animaux — la cour est un chantier pendant notre présence, et une plate-bande fraîchement plantée est irrésistible pour un chien. Gardez-les à l'intérieur ou en laisse.",
    ],
    warning:
      "Les nouvelles plantes doivent être arrosées selon le calendrier que nous vous donnons, dès le jour de la plantation — y compris les fins de semaine où nous ne sommes pas là. Une plante qui sèche dans ses deux premières semaines ne revient pas, et c'est la seule chose que nous ne pouvons pas garantir.",
    dayOf: [
      "Retrait et nivellement d'abord, puis les aménagements en dur, puis l'irrigation, puis les plates-bandes et la plantation, puis la pelouse. Le site est en désordre au milieu et pas à la fin.",
    ],
    afterCare:
      "Arrosez selon le calendrier que nous vous laissons. Restez hors de la tourbe neuve et des plates-bandes neuves pendant le délai indiqué. Le paillis se tasse ; complétez-le la deuxième saison.",
  },

  lawn_care: {
    checklist: [
      "Ramassez sur la pelouse — jouets, boyaux, bols du chien, mobilier et tout ce qui est sur l'herbe. Ce qui gêne est contourné, et ce qui est caché dans l'herbe longue est passé à la tondeuse.",
      "Ramassez après le chien. Nous tondons à travers ce que nous trouvons, et ça finit sur la tondeuse, sur nous et sur vos murs.",
      "Déverrouillez la barrière latérale, ou donnez-nous le code, et dites-nous si une barrière doit rester fermée pour un animal.",
      "Marquez ce qui est bas et difficile à voir — une tête d'arroseur, une plante nouvelle, une dalle dans l'herbe.",
      "Signalez-nous les zones à laisser — un coin de fleurs sauvages, une plate-bande que vous semez.",
    ],
    warning:
      "Tout ce qui reste dans l'herbe sera frappé. Un boyau, un jouet ou une tête d'arroseur sous une lame de tondeuse, c'est une pièce brisée et une visite arrêtée. Faites le tour de la pelouse avant notre arrivée.",
    dayOf: [
      "Nous tondons, taillons les bordures et soufflons les surfaces dures. Un traitement, si votre soumission l'inclut, s'applique après la coupe ; nous laissons un fanion et une note pour rester à l'écart.",
    ],
    afterCare:
      "Gardez animaux et enfants hors d'une pelouse traitée jusqu'à ce qu'elle soit sèche, ou pendant le délai sur le fanion. Arrosez selon le calendrier que nous vous donnons, pas tous les jours.",
  },

  irrigation: {
    checklist: [
      "Ouvrez l'eau des robinets extérieurs et de l'alimentation d'irrigation, et dites-nous où sont le dispositif anti-refoulement et le contrôleur.",
      "Organisez la localisation des services pour une nouvelle installation, ou confirmez que nous le faisons.",
      "Marquez les plates-bandes et les plantes à protéger, et signalez-nous tout ce que vous savez d'enfoui.",
      "Dites-nous quelles zones ne fonctionnent pas, et comment — plaque sèche, inondation, une tête qui ne sort pas.",
      "Animaux à l'intérieur pendant que les tranchées sont ouvertes.",
    ],
    warning:
      "Pour une nouvelle installation, la pelouse est tranchée et la tourbe soulevée le long de chaque conduite. Elle est remise et se rétablit en quelques semaines avec de l'arrosage, mais elle aura l'air creusée un moment. Restez hors des lignes de tranchée jusqu'à ce qu'elles se tassent.",
    dayOf: [
      "Pour une réparation, nous testons chaque zone, trouvons la panne, la réparons et faisons tourner le système. Pour une installation, nous tranchons, posons la conduite, installons les têtes, câblons le contrôleur, et faisons tourner chaque zone devant vous.",
    ],
    afterCare:
      "Laissez tourner l'horaire programmé une semaine avant de le changer, et signalez-nous une zone sèche ou inondée. Faites purger le système avant le premier gel — c'est la seule chose qui empêche une conduite d'éclater.",
  },

  tree_care_service: {
    checklist: [
      "Sortez les voitures de l'entrée et éloignez-les de sous l'arbre — les branches tombent là où elles doivent, pas là où c'est pratique.",
      "Dégagez le sol sous l'arbre — mobilier, jardinières, jouets, le trampoline — et couvrez ce qui ne peut pas être déplacé.",
      "Prévenez vos voisins si l'arbre est près de la limite, et signalez-nous toute branche au-dessus de chez eux.",
      "Déverrouillez des barrières assez larges pour la déchiqueteuse, et dites-nous où souffler les copeaux ou s'ils partent avec nous.",
      "Animaux et enfants à l'intérieur pendant toute la visite. Couper en hauteur est le seul travail où personne ne traverse la zone.",
    ],
    warning:
      "Personne sous l'arbre pendant que nous y sommes — même pour aller à la voiture. Nous délimitons la zone de chute et vous demandons d'en rester à l'écart, de la première coupe à la dernière.",
    dayOf: [
      "Nous délimitons la zone de chute, grimpons ou montons en nacelle, et abattons l'arbre par sections ou élaguons selon le plan de votre soumission. Les branches sont déchiquetées au fur et à mesure et le bois coupé aux longueurs demandées ou emporté.",
      "La déchiqueteuse est bruyante. Un abattage complet, c'est une journée entière de bruit.",
    ],
    afterCare:
      "Restez à l'écart d'une souche fraîchement essouchée jusqu'à ce qu'elle soit remblayée. Surveillez un arbre élagué pendant la saison suivante ; un peu de dépérissement sur une branche coupée est normal, une branche entière qui meurt ne l'est pas — dites-le-nous.",
  },

  snow_removal: {
    checklist: [
      "Placez des balises le long des bords de l'entrée, de la pelouse et des plates-bandes avant la première neige, ou demandez-nous — une fois couverts, personne ne les voit.",
      "Rentrez les voitures au garage ou dans la rue avant une tempête. Une voiture dans l'entrée, c'est une entrée que nous ne pouvons pas déneiger.",
      "Dites-nous où la neige peut être empilée et où elle ne peut pas — pas sur la fosse septique, pas contre la borne-fontaine, pas du côté du voisin.",
      "Gardez boyaux, bacs et jouets hors de l'entrée pour la saison ; un bac sous la neige est un bac plié.",
      "Signalez-nous toute surface de l'entrée qui ne supporte pas une lame — pavés, section chauffante, scellant neuf.",
    ],
    warning:
      "Nous venons quand la neige atteint l'épaisseur de votre plan, dans l'ordre de la tournée. Une voiture dans l'entrée à notre arrivée signifie que nous déneigeons autour, pas dessous, et nous ne revenons pas pour cet espace avant la prochaine tempête.",
    dayOf: [
      "Nous déneigeons les zones de votre plan, empilons la neige où convenu, et salons ou sablons les allées si votre plan l'inclut. Marches et allées sont déneigées à la main quand votre plan les inclut.",
    ],
    afterCare:
      "Signalez-nous à la fonte toute marque sur la pelouse ou un pavé déplacé ; nous réparons au printemps.",
  },

  pest_control: {
    checklist: [
      "Rangez nourriture, vaisselle, bols des animaux et tout ce qui est sur les comptoirs ; couvrez ou retirez ce qui est dans un garde-manger ouvert.",
      "Dégagez sous les éviers et le long des murs où les plinthes rejoignent le plancher — c'est là que nous traitons.",
      "Parlez-nous des animaux et de l'endroit où ils seront — les aquariums surtout doivent être couverts et la pompe arrêtée pendant une pulvérisation.",
      "Signalez-nous toute personne enceinte, asthmatique ou sensible aux produits dans la maison, pour choisir le produit et le moment.",
      "Prévoyez de quitter les pièces traitées, ou la maison, pendant le délai que nous vous donnerons le jour même.",
    ],
    warning:
      "Les pièces traitées sont inutilisables pendant le délai indiqué, et animaux et enfants en restent à l'écart jusqu'au séchage du traitement. Un traitement piétiné est un traitement qui ne fonctionne pas et doit être repris.",
    dayOf: [
      "Nous inspectons d'abord, vous disons ce que nous avons trouvé et où, puis traitons selon le plan de votre soumission. Les postes d'appât et les moniteurs sont étiquetés et laissés en place ; ne les déplacez pas.",
    ],
    afterCare:
      "Ne lavez pas les zones traitées pendant le délai indiqué. Attendez-vous à plus d'activité pendant un jour ou deux — c'est le traitement qui agit. Dites-nous si vous en voyez encore après la période donnée ; le suivi fait partie du travail.",
  },

  pool_spa: {
    checklist: [
      "Dégagez la terrasse de la piscine du mobilier et des jouets là où nous devons travailler, et déverrouillez la barrière de l'enceinte.",
      "Assurez-vous que la plate-forme d'équipement — pompe, filtre, chauffe-eau — est accessible, et dites-nous où est la coupure de courant.",
      "Dites-nous ce que vous avez remarqué — une fuite, une eau trouble, une erreur sur le chauffe-eau, une pompe bruyante.",
      "Gardez le niveau d'eau où il doit être, sauf si nous avons demandé de le baisser pour les travaux.",
      "Animaux et enfants hors de l'enceinte pendant la visite.",
    ],
    warning:
      "Après un traitement chimique, personne ne se baigne avant que les niveaux indiqués soient atteints. Nous testons avant de partir et vous disons quand c'est sûr — attendez-le.",
    dayOf: [
      "Nous testons l'eau, inspectons l'équipement, faisons le travail de votre soumission et faisons tourner le système sur un cycle avant de partir. Tout ce que nous trouvons au-delà de la soumission vous est montré et chiffré avant d'être fait.",
    ],
    afterCare:
      "Laissez tourner la pompe pendant le délai indiqué après un traitement. Surveillez les niveaux les premiers jours et signalez-nous s'ils dérivent.",
  },

  dog_walking: {
    checklist: [
      "Laissez la laisse, le harnais, une serviette et les gâteries à l'endroit convenu, et dites-nous si le chien porte autre chose — une muselière, un manteau, une lumière.",
      "Donnez-nous l'accès — une clé, un code, une boîte à clé — et dites-nous comment fonctionne l'alarme et où le chien attend quand vous êtes sorti.",
      "Parlez-nous du chien : comment il est avec les autres chiens, les enfants, les inconnus à la porte, et ce qui lui fait peur.",
      "Dites-nous pour la nourriture et les médicaments si l'un ou l'autre tombe pendant la visite, et où ils sont rangés.",
      "Laissez le numéro de votre vétérinaire et un contact d'urgence.",
    ],
    warning:
      "Un chien malade, blessé ou en chaleur reste à la maison — dites-le-nous avant la visite. Si à notre arrivée le chien ne peut pas marcher en sécurité, la visite devient une vérification et reste facturée.",
    dayOf: [
      "Nous arrivons à l'heure convenue, faisons le trajet convenu pendant la durée convenue, essuyons les pattes, renouvelons l'eau, et laissons une note ou un message sur le déroulement.",
    ],
    afterCare:
      "Signalez-nous tout changement — un nouveau médicament, une nouvelle peur, un nouveau chien à côté — avant la prochaine promenade, pas après.",
  },

  pooper_scooper: {
    checklist: [
      "Déverrouillez la barrière ou donnez-nous le code, et gardez les chiens à l'intérieur pendant que nous sommes dans la cour.",
      "Ramassez jouets et boyaux dans les zones desservies ; c'est bien plus rapide sur une pelouse dégagée.",
      "Dites-nous quelles zones couvrir et lesquelles sauter — le potager, le côté du voisin.",
      "Dites-nous où laisser le sac, ou s'il part avec nous.",
    ],
    warning:
      "Un chien en liberté dans la cour à notre arrivée signifie que nous ne pouvons pas entrer, et la visite est facturée. Gardez-les à l'intérieur jusqu'à notre départ.",
    dayOf: [
      "Nous parcourons toute la cour en quadrillage, ensachons ce que nous trouvons, traitons la zone si votre plan l'inclut, et verrouillons la barrière derrière nous.",
    ],
    afterCare:
      "Rien à faire. Dites-nous si la santé des chiens change — ce que nous trouvons en est souvent le premier signe.",
  },
};
