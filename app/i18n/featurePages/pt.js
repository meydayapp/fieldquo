// app/i18n/featurePages/pt.js
//
// O bloco em português para /features e /features/<slug>.
//
// ══ Porque é que o português está aqui ════════════════════════════════════
//
// Pela mesma razão que o bloco em inglês por trás de lib/marketing/featureLabels.js,
// e vale a pena repetir porque parece uma duplicação — e é:
// scripts/check-translations.mjs funciona comparando todos os idiomas com as
// CHAVES DO INGLÊS. Uma chave presente em ucraniano e ausente em inglês é
// reportada como "not in English" e faz a verificação falhar. Por isso, o inglês
// tem de existir no catálogo para que os outros cinco idiomas possam ser
// validados.
//
// Tudo em `featurePage.<slug>.*` é uma CÓPIA de app/data/featurePages.js
// e é gerado a partir desse ficheiro. Está fixado: scripts/check-feature-pages.mjs
// verifica que cada uma destas strings é exatamente igual, carácter por carácter,
// aos dados da página e identifica as que não são, para que esta duplicação não
// possa transformar-se numa segunda versão não verificada do texto. Para editar
// o texto, edite app/data/featurePages.js — que é lido pelas 1043 verificações —
// e depois atualize este ficheiro para corresponder. A verificação indica
// exatamente qual a chave que divergiu.
//
// O restante — `featurePage.chrome.*` e `featuresIndex.*` — NÃO é uma cópia.
// É conteúdo próprio da página e o catálogo é o seu único local, razão pela qual
// os componentes chamam t() sem qualquer fallback escrito no JSX.
// `featureGroup.*` e `feature.*.limits` estão igualmente fixados a
// lib/marketing/featureMatrix.js, tal como os nomes e os resumos.

const pt = {
  // ── Os elementos comuns de uma página de funcionalidade ────────────────
  "featurePage.chrome.startTrial":
    "Comece o seu período experimental gratuito de 14 dias",
  "featurePage.chrome.seePricing": "Ver preços",
  "featurePage.chrome.firstMonthFree":
    "Os primeiros 14 dias são gratuitos e não é cobrado qualquer valor até ao fim desse período.",
  "featurePage.chrome.painsTitle": "O que isto lhe tira da semana",
  "featurePage.chrome.howTitle": "Como funciona aqui",
  "featurePage.chrome.specificsTitle": "Os detalhes",
  "featurePage.chrome.getTitle": "O que está incluído",
  "featurePage.chrome.everyPlan":
    "Todos os planos incluem tudo isto. Os planos diferem pelo número de pessoas que podem trabalhar na conta, não pelas funcionalidades que podem utilizar.",
  "featurePage.chrome.whereStops": "Onde termina:",
  "featurePage.chrome.partialOne":
    "Um dos itens acima está apenas parcialmente desenvolvido, e isso está indicado.",
  "featurePage.chrome.partialMany":
    "{count} dos itens acima estão apenas parcialmente desenvolvidos, e isso está indicado.",
  "featurePage.chrome.partialTail":
    "Preferimos que conheça a limitação aqui em vez de a descobrir no segundo mês.",
  "featurePage.chrome.moreTitle": "Mais nesta área",
  "featurePage.chrome.moreBody":
    "Cada uma destas funcionalidades tem a sua própria página.",
  "featurePage.chrome.ctaTitle": "Experimente nos seus próprios trabalhos",
  "featurePage.chrome.ctaBody":
    "Os primeiros 14 dias são gratuitos. Traga os seus próprios preços, o seu logótipo e a lista de clientes que já tem.",
  "featurePage.chrome.talkToPerson": "Falar com uma pessoa",
  "featurePage.chrome.alsoRead":
    "Os prestadores de serviços que leem esta página também consultam",

  // ── O índice em /features ───────────────────────────────────────────────
  "featuresIndex.title": "Tudo o que o FieldQuo faz",
  "featuresIndex.intro":
    "Tudo o que aparece na página de preços tem a sua própria página abaixo, e o restante está agrupado pela forma como o trabalho acontece: ganhar o trabalho, executá-lo, receber por ele e gerir a empresa que faz as três coisas. Quando algo está apenas parcialmente desenvolvido, a respetiva página explica onde termina em vez de lhe mostrar simplesmente um visto.",
  "featuresIndex.directoryTitle":
    "As {count} funcionalidades da página de preços, uma página para cada uma",
  "featuresIndex.directoryBody":
    "Cada funcionalidade apresentada com o preço tem uma página que explica como funciona aqui, o que não faz e qual o ficheiro que comprova o seu funcionamento.",
  "featuresIndex.partlyBuilt":
    "Parcialmente desenvolvido — a página indica onde termina",
  "featuresIndex.byAreaTitle": "Ou pela parte do trabalho a que pertence",
  "featuresIndex.byAreaBody":
    "As mesmas páginas, agrupadas. Cada cartão representa uma área, e os cartões maiores ligam às páginas acima.",
  "featuresIndex.featureCountOne": "1 funcionalidade",
  "featuresIndex.featureCountMany": "{count} funcionalidades",
  "featuresIndex.closing":
    "{count} páginas, e todas as afirmações nelas feitas apontam para código que existe — uma verificação da compilação falha se alguma deixar de ser verdadeira.",
  "featuresIndex.askUs": "Pergunte-nos sobre algo que não encontre",

  // ── Os quatro títulos de grupo, fixados a lib/marketing/featureMatrix.js ──
  "featureGroup.winning_work.label": "Ganhar o trabalho",
  "featureGroup.winning_work.blurb":
    "Tudo o que acontece entre alguém ouvir falar de si e aceitar um preço: de onde vem o pedido, o que envia em resposta e com que rapidez.",
  "featureGroup.doing_the_job.label": "Executar o trabalho",
  "featureGroup.doing_the_job.blurb":
    "Levar a pessoa certa à morada certa com a informação certa, e saber quanto o trabalho realmente lhe custou.",
  "featureGroup.getting_paid.label": "Receber",
  "featureGroup.getting_paid.blurb":
    "Faturação que corresponde ao seu orçamento, pagamentos que o cliente pode fazer pelo telemóvel e o dinheiro a entrar na sua conta.",
  "featureGroup.running_the_business.label": "Gerir a empresa",
  "featureGroup.running_the_business.blurb":
    "Os seus números, a sua equipa, os seus preços e o seu nome em todos os documentos que o proprietário vê.",

  // ── Onde termina cada funcionalidade parcialmente desenvolvida. Fixado à matriz. ──
  // Oito frases, e as oito deste site em que uma paráfrase imprecisa causaria
  // mais danos: cada uma delas é a razão pela qual uma página não é enganadora.
  "feature.door_hanger_routes.limits":
    "O FieldQuo planeia e acompanha o percurso. Não imprime os folhetos de porta nem organiza a distribuição — o material impresso é fornecido por si.",
  "feature.appointment_reminders.limits":
    "Os lembretes são enviados apenas por mensagem de texto. Ainda não existe lembrete por email e o texto do lembrete ainda não pode ser editado — a mensagem de que está a caminho pode.",
  "feature.financing.limits":
    "O pagamento faseado é disponibilizado no checkout através da Stripe, sendo a decisão tomada pelo financiador. O FieldQuo não empresta dinheiro nem aprova ninguém. O valor mensal apresentado num orçamento só aparece se introduzir a sua própria taxa e prazo — nunca inventamos um.",
  "feature.payroll.limits":
    "O FieldQuo calcula a remuneração bruta e produz um recibo de vencimento por pessoa. Não paga aos funcionários, não entrega os seus impostos sobre salários nem exporta o processamento — as deduções são as que você ou o seu contabilista fornecerem.",
  "feature.contractor_payouts.limits":
    "Isto paga uma pessoa da sua própria equipa pelas horas que registou, à taxa definida por si. Não permite pagar um valor fixo contratado a outra empresa.",
  "feature.marketing_spend.limits":
    "O custo por lead de cada campanha cobre os leads que chegaram através de um formulário de leads da Meta. Todos os outros canais — incluindo um proprietário que viu o anúncio e telefonou — continuam agregados, porque nada liga essa despesa a esse lead.",

  // ══ Gerado a partir de app/data/featurePages.js — fixado, consulte o cabeçalho ══

  // /features/quotes
  "featurePage.quotes.label": "Orçamentos e estimativas",
  "featurePage.quotes.headline":
    "Calcule o preço uma vez e envie-o antes de sair da entrada da casa",
  "featurePage.quotes.oneLine":
    "Crie um orçamento com os seus próprios preços, envie-o em PDF com as suas cores e deixe o cliente assiná-lo online.",
  "featurePage.quotes.description":
    "Orçamentos para prestadores de serviços no terreno: os seus próprios preços, três opções de preço, um PDF com a sua marca e aprovação online com assinatura.",
  "featurePage.quotes.imageCaption":
    "Um orçamento a ser criado na casa do cliente, a partir da lista de serviços e dos preços do próprio prestador.",
  "featurePage.quotes.inlineCaption":
    "O mesmo orçamento tal como o cliente o recebe: o logótipo do prestador, a sua cor e um botão Aprovar no final. O que o cliente viu no momento em que assinou fica registado com a assinatura.",
  "featurePage.quotes.pain.1.pain":
    "Os valores são escritos no verso de um recibo na casa do cliente e passados a limpo às nove da noite — se ainda tiver energia.",
  "featurePage.quotes.pain.1.fix":
    "As linhas vêm diretamente da sua própria tabela de preços enquanto ainda está no local, por isso o orçamento fica concluído quando termina a visita.",
  "featurePage.quotes.pain.2.pain":
    "O proprietário pergunta quanto custaria fazer o trabalho como deve ser, por isso reescreve tudo e acaba com três ficheiros sem ninguém saber qual deles foi lido.",
  "featurePage.quotes.pain.2.fix":
    "Um trabalho, três preços, um documento. O cliente escolhe o que pretende e é essa opção que se transforma no trabalho.",
  "featurePage.quotes.pain.3.pain":
    "Liga duas vezes, não atendem, e três semanas depois descobre que escolheram outro pintor.",
  "featurePage.quotes.pain.3.fix":
    "Um orçamento sem resposta recebe seguimento de acordo com o seu calendário e com as suas palavras, sem ter de se lembrar de quem é a vez.",
  "featurePage.quotes.how.1.step":
    "É criado a partir dos seus preços, não de um modelo",
  "featurePage.quotes.how.1.body":
    "As linhas vêm dos serviços e preços que configura uma única vez. Agrupe-as por divisão, piso ou âmbito, adicione fotografias da visita, e os totais e o imposto seguem a morada onde o trabalho será realizado.",
  "featurePage.quotes.how.2.step": "É enviado com a imagem da sua empresa",
  "featurePage.quotes.how.2.body":
    "O PDF inclui o seu logótipo e a cor da sua marca, o email é enviado a partir do seu endereço e a mensagem é escrita no idioma em que o orçamento foi criado. Nada no documento diz FieldQuo.",
  "featurePage.quotes.how.3.step": "O cliente assina onde quer que esteja",
  "featurePage.quotes.how.3.body":
    "Abre uma ligação, seleciona os extras que ofereceu e assina. O que viu no momento em que assinou fica registado com a assinatura, para que duas semanas depois não haja discussão sobre o que foi acordado.",
  "featurePage.quotes.detail.1.label": "Um criador, dois caminhos",
  "featurePage.quotes.detail.1.body":
    "Criar um orçamento e editar um orçamento utilizam o mesmo ecrã. Antes eram dois e calculavam o imposto de forma diferente — um sobre o subtotal bruto e o outro depois do desconto — por isso o mesmo orçamento podia ter dois totais dependendo do último ecrã que o guardasse.",
  "featurePage.quotes.detail.2.label": "Primeiro é guardado, depois é enviado",
  "featurePage.quotes.detail.2.body":
    "Um orçamento é sempre guardado como rascunho antes de qualquer email ser enviado. Se o envio falhar, fica com um rascunho para tentar novamente, nunca com um orçamento marcado como enviado que ninguém recebeu.",
  "featurePage.quotes.detail.3.label": "O seu texto é copiado para o documento",
  "featurePage.quotes.detail.3.body":
    "Os seus termos e os próximos passos ficam guardados no próprio orçamento, por isso alterar os valores predefinidos em março não reescreve aquilo que enviou em fevereiro.",
  "featurePage.quotes.detail.4.label":
    "Trinta dias, salvo indicação em contrário",
  "featurePage.quotes.detail.4.body":
    "A validade predefinida é de trinta dias, calculada pelo calendário e não pelo relógio, para que uma mudança de hora nunca altere a data. Limpar o campo significa que não existe validade e essa escolha é respeitada em vez de ser preenchida novamente.",
  "featurePage.quotes.detail.5.label":
    "O desconto guardado é o que realmente foi aplicado",
  "featurePage.quotes.detail.5.body":
    "Um desconto superior ao valor do orçamento é limitado antes de ser guardado, para que um valor armazenado nunca contradiga o total apresentado ao lado.",
  "featurePage.quotes.detail.6.label":
    "As linhas ficam bloqueadas quando o orçamento é decidido",
  "featurePage.quotes.detail.6.body":
    "Assim que um orçamento deixa de estar em rascunho ou enviado, os respetivos itens ficam bloqueados.",

  // /features/ai-quote-review
  "featurePage.ai-quote-review.label": "Revisão de orçamentos por IA",
  "featurePage.ai-quote-review.headline":
    "Uma segunda leitura do orçamento antes de chegar ao cliente",
  "featurePage.ai-quote-review.oneLine":
    "Lê o orçamento que acabou de criar e indica o que falta, como o preço se compara com os trabalhos que ganhou e que frases um proprietário poderá não compreender.",
  "featurePage.ai-quote-review.description":
    "Uma revisão do seu orçamento por IA antes do envio: itens esquecidos, comparação do preço com os seus próprios trabalhos ganhos e sugestões de texto mais claro.",
  "featurePage.ai-quote-review.pain.1.pain":
    "Calculou o preço da tinta e esqueceu-se do primário, e só descobre no segundo dia quando não há nada para aplicar na parede.",
  "featurePage.ai-quote-review.pain.1.fix":
    "A revisão apresenta o que um trabalho descrito desta forma normalmente exige e que não incluiu.",
  "featurePage.ai-quote-review.pain.2.pain":
    "Faz o orçamento de memória, e a sua memória está dois anos desatualizada nos materiais.",
  "featurePage.ai-quote-review.pain.2.fix":
    "Coloca o preço ao lado dos trabalhos que realmente ganhou, para que um valor muito fora do normal seja assinalado antes do envio, não depois de perder o trabalho.",
  "featurePage.ai-quote-review.pain.3.pain":
    "O âmbito parece perfeitamente claro para si porque foi você que o escreveu, mas o proprietário interpreta-o como autorização para pedir mais.",
  "featurePage.ai-quote-review.pain.3.fix":
    "Reformula as partes que alguém fora da profissão poderia interpretar mal, e você decide se mantém ou ignora cada sugestão.",
  "featurePage.ai-quote-review.how.1.step": "Só lê o seu próprio trabalho",
  "featurePage.ai-quote-review.how.1.body":
    "A comparação é feita com os orçamentos que a sua empresa enviou e ganhou. Os preços de nenhuma outra empresa entram na comparação, e os seus nunca saem.",
  "featurePage.ai-quote-review.how.2.step": "A decisão continua a ser sua",
  "featurePage.ai-quote-review.how.2.body":
    "Nada é alterado por si. Cada sugestão é uma linha que aceita ou ignora, e o orçamento não muda até que seja você a alterá-lo.",
  "featurePage.ai-quote-review.how.3.step":
    "Os extras também são calculados a partir do histórico",
  "featurePage.ai-quote-review.how.3.body":
    "Os extras opcionais no final do orçamento são calculados com base no que cobrou anteriormente por esse trabalho, e o cliente seleciona os que pretende.",
  "featurePage.ai-quote-review.detail.1.label": "A maior parte é aritmética",
  "featurePage.ai-quote-review.detail.1.body":
    "As verificações de integridade e a comparação de preços são calculadas, não escritas por um modelo. Se o modelo estiver indisponível, a parte calculada continua a ser devolvida — perde as sugestões de texto, não a revisão.",
  "featurePage.ai-quote-review.detail.2.label":
    "Comparado com os seus próprios trabalhos ganhos",
  "featurePage.ai-quote-review.detail.2.body":
    "Os preços são comparados com os seus próprios orçamentos aceites e recusados, e com os de mais ninguém. Com menos de cinco trabalhos comparáveis, indica que não existem dados suficientes em vez de o avaliar com base em quatro.",
  "featurePage.ai-quote-review.detail.3.label": "O valor central, não a média",
  "featurePage.ai-quote-review.detail.3.body":
    "Um trabalho enorme não distorce a comparação. Alto significa acima do seu próprio quartil superior e mais de um quarto acima do valor central; baixo significa abaixo de setenta por cento desse valor.",
  "featurePage.ai-quote-review.detail.4.label": "O que considera em falta",
  "featurePage.ai-quote-review.detail.4.body":
    "Sem validade, validade expirada, sem email do cliente, sem itens, todo o trabalho numa única linha, descrições vagas, sem termos, sem fotografias. Cada elemento tem um peso e a pontuação de preparação é o que resta de cem.",
  "featurePage.ai-quote-review.detail.5.label":
    "Lê as fotografias para si, não para o cliente",
  "featurePage.ai-quote-review.detail.5.body":
    "Apenas fotografias reais são enviadas para o modelo, o número delas é indicado para que não possa inventar mais, e é proibido indicar uma medida, um material ou uma marca com base numa imagem. As notas regressam para o responsável pelo orçamento.",
  "featurePage.ai-quote-review.detail.6.label":
    "Nunca reescreve aquilo que escreveu",
  "featurePage.ai-quote-review.detail.6.body":
    "Os termos e textos sugeridos só são apresentados quando o orçamento não tem texto próprio. Não reescreve um parágrafo que já tenha escrito, por isso uma revisão nunca altera silenciosamente uma frase que pretendia enviar.",

  // /features/leads
  "featurePage.leads.label": "Leads e clientes",
  "featurePage.leads.headline":
    "Todos os pedidos numa única lista, em vez de quatro sítios",
  "featurePage.leads.oneLine":
    "Chamadas, formulários, referências e contactos presenciais entram numa única lista, classificados de quente a frio e a um clique de se tornarem um orçamento.",
  "featurePage.leads.description":
    "Gestão de leads para prestadores de serviços: uma lista para todos os pedidos, classificados pela probabilidade de fechar, com um registo de cliente e histórico associado.",
  "featurePage.leads.pain.1.pain":
    "Um pedido está nas mensagens, outro no correio de voz, outro num papel no tablier, e o melhor é precisamente aquele de que se esqueceu.",
  "featurePage.leads.pain.1.fix":
    "Todos chegam à mesma lista, já com a morada, o trabalho e a origem associados.",
  "featurePage.leads.pain.2.pain":
    "Passa a manhã de sábado a conduzir até alguém sem intenção real de comprar e nunca chega à cozinha que estava pronta para avançar.",
  "featurePage.leads.pain.2.fix":
    "Cada lead chega como quente, morno ou frio, acompanhado das razões que o colocaram nessa categoria, por isso a lista já está ordenada pelo que vale a pena tratar primeiro e pode discordar da classificação em cinco segundos.",
  "featurePage.leads.pain.3.pain":
    "Um cliente liga sobre o trabalho que fez há dois verões e não se lembra da cor, muito menos do preço.",
  "featurePage.leads.pain.3.fix":
    "Cada cliente mantém as suas propriedades e o respetivo histórico, por isso o último trabalho está a um clique.",
  "featurePage.leads.how.1.step":
    "O formulário é seu e não vai parar a uma caixa de entrada",
  "featurePage.leads.how.1.body":
    "Adicione o formulário de leads ao site que já tem. O resultado é um lead na lista com uma pontuação, não um email que só vai ler no domingo.",
  "featurePage.leads.how.2.step":
    "Quente, morno ou frio — e mostra como chegou lá",
  "featurePage.leads.how.2.body":
    "Cada pedido chega com uma classificação e a lista curta das razões que a produziram, cada uma com os pontos que acrescentou. Pode perceber porque este lead é quente e aquele não é sem perguntar a ninguém.",
  "featurePage.leads.how.3.step": "O que pesa e por que ordem",
  "featurePage.leads.how.3.body":
    "A urgência para começar pesa mais do que qualquer outra coisa: alguém que quer começar agora fica acima de um orçamento maior que está apenas a pesquisar. Depois vem o orçamento indicado, depois se o trabalho é uma emergência e depois a forma de contacto — para um profissional, um número de telefone vale mais do que um endereço de email. Por último vem o esforço, porque o esforço prevê intenção: fotografias da parede, um plano que exportaram, uma cozinha que desenharam, uma descrição que tiveram o cuidado de escrever. Nenhum destes elementos, por si só, pode tornar um lead quente.",
  "featurePage.leads.how.4.step": "É aritmética, e pode alterá-la",
  "featurePage.leads.how.4.body":
    "Não existe nenhum modelo aqui e nada está a aprender sobre si em segundo plano. É um conjunto fixo de pesos que poderia somar num papel — e esse é precisamente o objetivo, porque um número que ninguém consegue discutir é um número que ninguém utiliza. Se lhe disserem ao telefone que o orçamento é afinal quinze mil, altere a resposta no lead e a classificação acompanha a alteração.",
  "featurePage.leads.how.5.step": "Tudo é classificado da mesma forma",
  "featurePage.leads.how.5.body":
    "O formulário do seu site, uma estimativa instantânea, uma cozinha desenhada por alguém, um funil com várias etapas, uma chamada atendida pelo rececionista e a lista que importa na primeira semana passam todos pela mesma classificação. Uma lista, um significado para quente.",
  "featurePage.leads.how.6.step": "Um clique transforma-o num orçamento",
  "featurePage.leads.how.6.body":
    "O nome, a morada e o que foi pedido são transferidos. Está a calcular o preço, não a escrever tudo novamente.",
  "featurePage.leads.how.7.step": "Traga a lista que já tem",
  "featurePage.leads.how.7.body":
    "Os clientes são importados de onde estiverem atualmente, com as respetivas propriedades associadas, para que a primeira semana não seja passada a escrever dados.",

  // /features/lead-funnels
  "featurePage.lead-funnels.label": "Funis de leads",
  "featurePage.lead-funnels.headline":
    "Uma pergunta por ecrã, e descobre exatamente onde abandonam",
  "featurePage.lead-funnels.oneLine":
    "Uma landing page para um anúncio ou folheto: uma pergunta de cada vez no telemóvel, um preço real a meio e uma contagem de quantas pessoas chegaram até ali.",
  "featurePage.lead-funnels.description":
    "Funis de leads com várias etapas para prestadores de serviços: uma pergunta por ecrã no telemóvel, um preço opcional calculado a partir dos seus próprios valores a meio do processo e números por etapa que mostram onde as pessoas abandonam.",
  "featurePage.lead-funnels.pain.1.pain":
    "Paga pelo clique, a pessoa chega a uma página com um formulário de doze campos e nunca mais ouve falar dela.",
  "featurePage.lead-funnels.pain.1.fix":
    "Uma pergunta por ecrã, respostas suficientemente grandes para tocar com o polegar e os dados de contacto pedidos no final — depois de já terem dado cinco toques.",
  "featurePage.lead-funnels.pain.2.pain":
    "Alguma coisa nessa página está a fazer perder pessoas e não faz ideia do que é.",
  "featurePage.lead-funnels.pain.2.fix":
    "Cada ecrã mostra quantas pessoas chegaram até ele e que percentagem das pessoas do ecrã anterior continuou, por isso aquele que perde metade das pessoas é exatamente aquele que tem o número por baixo.",
  "featurePage.lead-funnels.pain.3.pain":
    "Metade das pessoas que preenche o formulário não tem intenção real de comprar, e só descobre isso ao telefone no sábado.",
  "featurePage.lead-funnels.pain.3.fix":
    "Aquilo em que tocaram é o que a classificação avalia, por isso o pedido chega quente, morno ou frio, já com as respetivas razões.",
  "featurePage.lead-funnels.how.1.step":
    "É construído com etapas, não a partir de uma página em branco",
  "featurePage.lead-funnels.how.1.body":
    "Um funil é um conjunto ordenado de ecrãs: uma abertura, perguntas com uma ou várias respostas, um preço opcional, um local para anexar fotografias, o formulário de contacto e um ecrã final. Não existe mais nada para colocar num funil, razão pela qual não pode acabar com um layout que deixa de funcionar num telemóvel.",
  "featurePage.lead-funnels.how.2.step":
    "Uma resposta pode decidir o que vem a seguir",
  "featurePage.lead-funnels.how.2.body":
    "Uma pergunta de escolha única pode enviar alguém diretamente para outro ecrã, por isso quem pede informações sobre uma casa de banho nunca tem de responder a quatro perguntas sobre cozinhas. Se não configurar uma ramificação, o processo continua simplesmente pela ordem definida.",
  "featurePage.lead-funnels.how.3.step": "Um preço real, a meio do processo",
  "featurePage.lead-funnels.how.3.body":
    "Uma das etapas pode mostrar quanto custaria o trabalho, calculado a partir dos seus próprios preços. Define os intervalos de tamanho com as suas próprias palavras — uma única divisão, cerca de 200 pés quadrados — e a pessoa escolhe um. O preço é calculado do nosso lado a partir dos seus valores; nada introduzido na página decide o preço e nenhum valor é alguma vez obtido do visitante.",
  "featurePage.lead-funnels.how.4.step":
    "Os números são por ecrã, não uma única taxa",
  "featurePage.lead-funnels.how.4.body":
    "Quantos começaram, quantos se tornaram leads, a percentagem que concluiu todo o processo e depois cada ecrã com a percentagem que continuou a partir do anterior. Uma única taxa de conversão diz-lhe que algo está errado. Um número por ecrã diz-lhe qual é o ecrã.",
  "featurePage.lead-funnels.how.5.step":
    "O resultado é um lead, não outra caixa de entrada",
  "featurePage.lead-funnels.how.5.body":
    "O fim do funil cria o mesmo lead que o formulário do seu site cria, classificado da mesma forma e a um clique de um orçamento. As respostas às perguntas sobre orçamento e prazo são as mesmas respostas que a classificação utiliza.",

  // /features/ai-receptionist
  "featurePage.ai-receptionist.label": "Rececionista de IA",
  "featurePage.ai-receptionist.headline":
    "O seu telefone é atendido enquanto está em cima de uma escada",
  "featurePage.ai-receptionist.oneLine":
    "Um assistente de voz no seu próprio número atende a chamada, recolhe os dados, marca a visita e deixa-lhe a gravação.",
  "featurePage.ai-receptionist.description":
    "Um rececionista de IA para prestadores de serviços: atende o telefone no seu próprio número, recolhe os dados do trabalho, marca a visita e prepara um rascunho do orçamento.",
  "featurePage.ai-receptionist.pain.1.pain":
    "Não consegue atender com uma lixadora nas mãos, e um proprietário que chega ao correio de voz liga para o nome seguinte da lista.",
  "featurePage.ai-receptionist.pain.1.fix":
    "A chamada é atendida ao primeiro toque, sempre, incluindo às sete da tarde de um domingo.",
  "featurePage.ai-receptionist.pain.2.pain":
    "Liga de volta às seis, a pessoa devolve a chamada às oito, e a semana passa sem conseguirem falar.",
  "featurePage.ai-receptionist.pain.2.fix":
    "Os dados são recolhidos na primeira chamada e a visita fica no seu calendário antes de descer da escada.",
  "featurePage.ai-receptionist.pain.3.pain":
    "Duas das visitas de amanhã não terão ninguém em casa, e só vai descobrir quando estiver à porta.",
  "featurePage.ai-receptionist.pain.3.fix":
    "O assistente liga no dia anterior para confirmar, para que a manhã não seja passada a conduzir até portas fechadas.",
  "featurePage.ai-receptionist.how.1.step":
    "Atende num número que lhe pertence",
  "featurePage.ai-receptionist.how.1.body":
    "Recebe um número com o indicativo da sua zona ou encaminha o seu número atual para ele. Quem liga ouve o nome da sua empresa, não o nosso.",
  "featurePage.ai-receptionist.how.2.step":
    "Conhece o seu trabalho e recusa-se a adivinhar",
  "featurePage.ai-receptionist.how.2.body":
    "Responde com base no que lhe indicou sobre os seus serviços e a sua área. Não dá um preço que você não tenha visto.",
  "featurePage.ai-receptionist.how.3.step":
    "A chamada regressa como um rascunho de orçamento",
  "featurePage.ai-receptionist.how.3.body":
    "O que a pessoa descreveu chega como um rascunho que abre, corrige e envia — juntamente com a gravação e a transcrição, para poder ouvir exatamente o que foi prometido.",
  "featurePage.ai-receptionist.detail.1.label":
    "Sete regras que prevalecem sobre tudo o que escrever",
  "featurePage.ai-receptionist.detail.1.body":
    "Nunca dar um preço, nem sequer um intervalo. Nunca prometer uma hora que não tenha sido disponibilizada. Nunca aceitar um âmbito de trabalho ou uma garantia. Dizer que é um assistente se a pessoa perguntar. Encaminhar situações de gás, incêndio, inundação e esgotos para os serviços de emergência e recolher um contacto para retorno. Nunca adivinhar os seus serviços ou horários. Nunca recolher dados de cartão.",
  "featurePage.ai-receptionist.detail.2.label":
    "A empresa é determinada pelo número marcado",
  "featurePage.ai-receptionist.detail.2.body":
    "A empresa para a qual a pessoa ligou é determinada pelo número que marcou e por mais nada dito durante a chamada, para que nada que a pessoa diga possa colocá-la na agenda de outra empresa.",
  "featurePage.ai-receptionist.detail.3.label": "No máximo, três horários",
  "featurePage.ai-receptionist.detail.3.body":
    "Quando disponibiliza marcações, apresenta até três opções, porque uma lista maior lida em voz alta deixa de ser uma lista.",
  "featurePage.ai-receptionist.detail.4.label":
    "Não aceita pagamentos por telefone",
  "featurePage.ai-receptionist.detail.4.body":
    "Uma visita que tenha uma taxa associada não é marcada durante a chamada. O assistente encaminha para a sua ligação de marcação em vez de inventar um valor.",
  "featurePage.ai-receptionist.detail.5.label": "O custo, sem esconder nada",
  "featurePage.ai-receptionist.detail.5.body":
    "Trinta e cinco cêntimos por minuto. Um número local custa quatro dólares por mês sem qualquer sobretaxa por minuto; um número gratuito custa nove dólares e mais cinco cêntimos por minuto. As chamadas efetuadas estão limitadas aos EUA e ao Canadá, onde estas tarifas se aplicam.",
  "featurePage.ai-receptionist.detail.6.label":
    "O dinheiro é adicionado antes de o saldo ser verificado",
  "featurePage.ai-receptionist.detail.6.body":
    "Quando uma chamada termina, o custo é deduzido, qualquer carregamento automático é efetuado e só depois o saldo é novamente verificado — para que o telefone não fique sem serviço nesse intervalo.",

  // /features/online-booking
  "featurePage.online-booking.label": "Marcações online",
  "featurePage.online-booking.headline":
    "Deixe-os marcar a visita sem lhe telefonarem",
  "featurePage.online-booking.oneLine":
    "Uma página de marcação baseada na sua disponibilidade real, com tempo de deslocação e janelas de chegada incluídos, e um sinal se quiser cobrar um.",
  "featurePage.online-booking.description":
    "Marcações online para prestadores de serviços: disponibilidade real, tempo de deslocação entre visitas, janelas de chegada, lembretes e um sinal opcional para reservar o horário.",
  "featurePage.online-booking.imageCaption":
    "A página de marcação tal como um proprietário a vê: disponibilidade real, o nome do prestador no topo e nenhuma conta para criar.",
  "featurePage.online-booking.pain.1.pain":
    "Marcar uma visita exige quatro mensagens e mesmo assim acaba num dia em que está do outro lado da cidade.",
  "featurePage.online-booking.pain.1.fix":
    "O cliente escolhe entre horários que já têm em conta onde termina o trabalho anterior e quanto tempo demora a chegar.",
  "featurePage.online-booking.pain.2.pain":
    "Reserva uma manhã de terça-feira para uma visita e não está ninguém em casa.",
  "featurePage.online-booking.pain.2.fix":
    "É enviado um lembrete antes de sair e, se cobrar uma taxa de visita, esta já está paga.",
  "featurePage.online-booking.pain.3.pain":
    "Um cliente precisa de alterar a marcação e isso custa-lhe duas chamadas telefónicas.",
  "featurePage.online-booking.pain.3.fix":
    "A confirmação inclui uma ligação que lhe permite alterar a marcação sozinho, para um horário em que realmente pode estar presente.",
  "featurePage.online-booking.how.1.step":
    "Disponibilidade que reflete o dia que realmente tem",
  "featurePage.online-booking.how.1.body":
    "Os horários disponíveis são calculados a partir do seu horário de trabalho, das visitas já marcadas e das deslocações entre elas. É apresentada uma janela de chegada em vez de uma hora ao minuto que ninguém consegue cumprir.",
  "featurePage.online-booking.how.2.step":
    "Um sinal que não fica como dinheiro perdido",
  "featurePage.online-booking.how.2.body":
    "Cobre uma taxa de visita no momento da marcação e, se o trabalho avançar, esse valor é creditado na fatura em vez de ficar separado à espera de um reembolso.",
  "featurePage.online-booking.how.3.step": "Funciona no site que já tem",
  "featurePage.online-booking.how.3.body":
    "Utilize a página de marcação no seu próprio endereço ou cole uma linha no site que já utiliza.",
  "featurePage.online-booking.detail.1.label":
    "Uma grelha de quinze minutos, no fuso horário do próprio trabalhador",
  "featurePage.online-booking.detail.1.body":
    "Os horários são calculados a partir da disponibilidade de cada pessoa, da duração da marcação e das margens de tempo de ambos os lados, e tudo o que já ficou no passado desaparece.",
  "featurePage.online-booking.detail.2.label":
    "Uma ausência aprovada ocupa o dia inteiro",
  "featurePage.online-booking.detail.2.body":
    "Incluindo meio dia. O pedido não regista qual das metades e inventar manhãs poderia deixar um proprietário à espera à porta.",
  "featurePage.online-booking.detail.3.label":
    "A deslocação é verificada nos dois sentidos",
  "featurePage.online-booking.detail.3.body":
    "Consegue chegar a este horário a partir do trabalho anterior e chegar ao seguinte depois deste? Quando a distância não pode ser calculada, o horário continua a ser apresentado — uma incógnita nunca esconde um horário.",
  "featurePage.online-booking.detail.4.label":
    "A morada é novamente verificada do nosso lado",
  "featurePage.online-booking.detail.4.body":
    "As coordenadas recebidas do navegador nunca são consideradas fiáveis, porque são essas coordenadas que determinam os outros horários apresentados.",
  "featurePage.online-booking.detail.5.label":
    "As janelas de chegada estão desativadas até definir uma",
  "featurePage.online-booking.detail.5.body":
    "Por predefinição é utilizada uma hora exata, com uma janela máxima de duas horas, apresentada apenas ao cliente — a sua equipa mantém a hora exata. O texto é escrito para cada idioma, porque em punjabi o conector aparece depois das duas horas em vez de entre elas.",
  "featurePage.online-booking.detail.6.label":
    "Um horário pago fica reservado, não marcado",
  "featurePage.online-booking.detail.6.body":
    "Não existe qualquer marcação até o pagamento ser recebido. A reserva dura trinta minutos e o pagamento pode ser confirmado de três formas independentes, para que fechar um separador do navegador não faça perder a marcação.",

  // /features/website
  "featurePage.website.label": "O seu próprio site",
  "featurePage.website.headline":
    "Um site escrito a partir daquilo que já nos disse",
  "featurePage.website.oneLine":
    "O seu próprio site, no seu próprio endereço, criado a partir dos seus serviços e fotografias — e editável bloco a bloco sempre que quiser alterar alguma coisa.",
  "featurePage.website.description":
    "Um site para a sua empresa de serviços, criado a partir dos serviços, fotografias e avaliações que já existem na sua conta, no seu próprio endereço.",
  "featurePage.website.pain.1.pain":
    "O site está na lista de tarefas há três anos. Continua na lista.",
  "featurePage.website.pain.1.fix":
    "A primeira versão é escrita a partir dos serviços, fotografias e avaliações que já existem na sua conta, para que tenha um site real antes de escrever uma única palavra.",
  "featurePage.website.pain.2.pain":
    "Pagou a alguém por um site e agora cada alteração exige um email e duas semanas de espera.",
  "featurePage.website.pain.2.fix":
    "Edita-o sozinho, bloco a bloco, e publica quando estiver satisfeito.",
  "featurePage.website.pain.3.pain":
    "O site diz uma coisa, o orçamento diz outra e a biografia do Instagram aponta para uma página que já não existe.",
  "featurePage.website.pain.3.fix":
    "Um único local contém os seus serviços e avaliações, e tudo o que um proprietário vê é obtido a partir daí.",
  "featurePage.website.how.1.step":
    "Escrito a partir dos seus dados, não inventado",
  "featurePage.website.how.1.body":
    "Os nomes dos serviços, preços e testemunhos vêm dos seus próprios registos. O texto é gerado; os factos não, e uma página pode sempre recorrer à versão simples construída apenas a partir dos seus dados.",
  "featurePage.website.how.2.step": "O seu endereço, o seu nome",
  "featurePage.website.how.2.body":
    "O seu próprio endereço em fieldquo.com, o seu logótipo e a sua cor. A única referência ao FieldQuo é uma pequena linha no rodapé dos sites gratuitos.",
  "featurePage.website.how.3.step": "Ou mantenha o site que já tem",
  "featurePage.website.how.3.body":
    "Cole uma linha nele e incorpore a sua página de marcação, o formulário de orçamento ou as avaliações no site que já utiliza.",
  "featurePage.website.detail.1.label": "O modelo escreve frases e nada mais",
  "featurePage.website.detail.1.body":
    "A ordem das secções, o layout e o estilo são escolhidos a partir de listas fechadas. Nunca gera uma cor, uma regra de estilo ou código de marcação.",
  "featurePage.website.detail.2.label":
    "Uma lista de coisas que não pode inventar",
  "featurePage.website.detail.2.body":
    "Anos de atividade, certificações, prémios, seguros, garantias, dimensão da equipa, duração de garantias, preços, planos de pagamento e prazos. Os nomes dos seus serviços têm de ser reproduzidos exatamente.",
  "featurePage.website.detail.3.label":
    "A geração nunca é essencial ao funcionamento",
  "featurePage.website.detail.3.body":
    "Qualquer falha recorre a um site construído a partir dos seus próprios factos. Se a IA estiver indisponível, o texto fica mais simples, nunca fica com uma página avariada.",
  "featurePage.website.detail.4.label":
    "Ao gerar novamente, lê aquilo que está guardado",
  "featurePage.website.detail.4.body":
    "Não aquilo que está no navegador, para que alterações não guardadas não sejam publicadas silenciosamente — e mantém as suas fotografias e o texto que escreveu.",
  "featurePage.website.detail.5.label": "Publicar nunca é um efeito secundário",
  "featurePage.website.detail.5.body":
    "Guardar não publica. É avisado antes de uma imagem provisória ficar pública, e um site não publicado é visível para si e para mais ninguém.",
  "featurePage.website.detail.6.label": "Cinco perguntas, todas opcionais",
  "featurePage.website.detail.6.body":
    "Há quanto tempo está em atividade, o que o diferencia, que tipo de trabalho prefere, a área que cobre e o estilo que pretende. Uma predefinição de estilo escreve palavras editáveis no campo em vez de configurar algo escondido.",

  // /features/instant-estimates
  "featurePage.instant-estimates.label": "Estimativas instantâneas",
  "featurePage.instant-estimates.headline":
    "Dê um valor enquanto ainda estão no seu site",
  "featurePage.instant-estimates.oneLine":
    "Um visitante responde a algumas perguntas e recebe um intervalo de preço com base nos valores definidos por si — e pode medir o telhado ou a entrada da casa sem ter de lá ir.",
  "featurePage.instant-estimates.description":
    "Estimativas online instantâneas com base nos seus próprios preços, um formulário público que os clientes preenchem sozinhos e medição de telhados e áreas através de imagens aéreas.",
  "featurePage.instant-estimates.pain.1.pain":
    "Metade dos pedidos só quer uma estimativa aproximada e descobrir isso custa-lhe quarenta minutos de viagem para cada lado.",
  "featurePage.instant-estimates.pain.1.fix":
    "Recebem imediatamente um intervalo baseado nos preços definidos por si, e quem estiver realmente interessado continua.",
  "featurePage.instant-estimates.pain.2.pain":
    "Passa o sábado a conduzir para medir telhados e duas das quatro pessoas nem sequer tinham orçamento.",
  "featurePage.instant-estimates.pain.2.fix":
    "Introduza a morada e obtenha a área e inclinação do telhado, ou trace a entrada ou o pátio, antes de decidir se vale a pena a deslocação.",
  "featurePage.instant-estimates.pain.3.pain":
    "A chamada inicial demora vinte minutos com as mesmas oito perguntas.",
  "featurePage.instant-estimates.pain.3.fix":
    "Um formulário público faz essas perguntas, permite anexar fotografias e chega como um orçamento já iniciado.",
  "featurePage.instant-estimates.how.1.step":
    "É você que decide quais são as perguntas e quanto custam",
  "featurePage.instant-estimates.how.1.body":
    "O intervalo é calculado a partir dos seus próprios preços. A sua tabela de preços nunca é publicada — o formulário público pergunta sobre o trabalho, não sobre os seus preços.",
  "featurePage.instant-estimates.how.2.step": "As fotografias vêm incluídas",
  "featurePage.instant-estimates.how.2.body":
    "O proprietário envia fotografias do que está a ver, para que possa calcular o preço a partir de uma imagem em vez de uma descrição de uma imagem.",
  "featurePage.instant-estimates.how.3.step":
    "Chega como trabalho, não como email",
  "featurePage.instant-estimates.how.3.body":
    "O resultado é um orçamento iniciado com o cliente, a morada e o âmbito já associados, pronto para corrigir e enviar.",
  "featurePage.instant-estimates.detail.1.label":
    "O valor do navegador nunca é o que fica guardado",
  "featurePage.instant-estimates.detail.1.body":
    "Tudo é novamente medido e calculado do nosso lado. A página pública nunca recebe os seus preços — publicar abertamente uma tabela de preços entrega-a a todos os concorrentes da cidade.",
  "featurePage.instant-estimates.detail.2.label":
    "Uma resposta de orçamento é uma posição, não um valor",
  "featurePage.instant-estimates.detail.2.body":
    "O proprietário escolhe um intervalo e esse intervalo é interpretado segundo os seus próprios limites, por isso o intervalo superior de uma empresa de armários conta da mesma forma que o intervalo superior de uma empresa de telhados, sem que nenhuma publique um preço.",
  "featurePage.instant-estimates.detail.3.label":
    "Uma profissão não pode ser ativada até conseguir calcular preços",
  "featurePage.instant-estimates.detail.3.body":
    "Ativar uma profissão faz primeiro a sua tabela de preços passar pelo sistema real de cálculo. Uma cópia manual dessas regras chegou a permitir uma profissão com um preço que o sistema de cálculo nunca tinha lido.",
  "featurePage.instant-estimates.detail.4.label":
    "Chega como rascunho assinalado para revisão",
  "featurePage.instant-estimates.detail.4.body":
    "Não como um orçamento enviado ao cliente. Abre-o, corrige-o e envia-o.",
  "featurePage.instant-estimates.detail.5.label":
    "As medições guardadas pertencem a uma lista fixa",
  "featurePage.instant-estimates.detail.5.body":
    "Área, quadrados de telhado, inclinação, camadas a remover, número de portas e gavetas e elementos semelhantes — não toda a resposta do serviço de imagens.",

  // /features/kitchen-designer
  "featurePage.kitchen-designer.label": "Designer de cozinhas e armários",
  "featurePage.kitchen-designer.headline":
    "Desenhe a cozinha e o preço vem incluído",
  "featurePage.kitchen-designer.oneLine":
    "Desenhe a disposição, escolha os acabamentos e os preços dos armários e a planta passam diretamente para o orçamento.",
  "featurePage.kitchen-designer.description":
    "Um designer de cozinhas e armários que calcula o preço enquanto desenha: disposições de armários, acabamentos e uma planta que passam diretamente para o orçamento.",
  "featurePage.kitchen-designer.pain.1.pain":
    "O cliente não consegue imaginar o resultado, por isso hesita e o trabalho fica parado.",
  "featurePage.kitchen-designer.pain.1.fix":
    "Vê a disposição desenhada com os acabamentos escolhidos, anexada ao orçamento que lhe está a ser pedido que assine.",
  "featurePage.kitchen-designer.pain.2.pain":
    "Contar módulos e portas para uma folha de cálculo ocupa uma noite inteira e basta um número trocado para perder dinheiro.",
  "featurePage.kitchen-designer.pain.2.fix":
    "Os armários são calculados com os seus próprios preços à medida que os coloca, e o total é o total do orçamento.",
  "featurePage.kitchen-designer.pain.3.pain":
    "O cliente muda o acabamento e tem de recalcular toda a cozinha manualmente.",
  "featurePage.kitchen-designer.pain.3.fix":
    "Altere o acabamento e o preço acompanha a alteração, porque foi calculado a partir do desenho em vez de ser escrito ao lado.",
  "featurePage.kitchen-designer.how.1.step": "Os seus preços, os seus módulos",
  "featurePage.kitchen-designer.how.1.body":
    "Os preços dos armários, portas e acabamentos são seus. O designer faz a contagem e a geometria; não decide quanto custa nada.",
  "featurePage.kitchen-designer.how.2.step": "O cliente pode abrir o desenho",
  "featurePage.kitchen-designer.how.2.body":
    "O projeto tem a sua própria ligação, para que o proprietário possa ver a disposição sem precisar de uma conta ou iniciar sessão.",
  "featurePage.kitchen-designer.how.3.step": "Passa a fazer parte do documento",
  "featurePage.kitchen-designer.how.3.body":
    "A planta e as linhas com preço entram no próprio orçamento, para que aquilo que o cliente aprova e aquilo que constrói sejam a mesma coisa.",

  // /features/marketing
  "featurePage.marketing.label": "Marketing",
  "featurePage.marketing.headline":
    "Preencha o calendário do próximo mês e saiba o que o preencheu",
  "featurePage.marketing.oneLine":
    "Campanhas, landing pages, percursos de distribuição porta a porta, pedidos de avaliações e referências — com a despesa comparada com os trabalhos que realmente trouxe.",
  "featurePage.marketing.description":
    "Marketing para prestadores de serviços: campanhas de email enviadas a partir do seu próprio endereço, landing pages com várias etapas, percursos para folhetos de porta, pedidos de avaliações, referências e relatórios de despesas por canal.",
  "featurePage.marketing.pain.1.pain":
    "Janeiro está vazio e só descobre em janeiro.",
  "featurePage.marketing.pain.1.fix":
    "Escreva uma vez e envie para a sua própria lista de clientes a partir do seu endereço antes de chegar o mês mais parado.",
  "featurePage.marketing.pain.2.pain":
    "Gasta dinheiro em anúncios todos os meses e não consegue dizer quais deles alguma vez produziram um trabalho.",
  "featurePage.marketing.pain.2.fix":
    "A despesa é registada por canal e aparece ao lado dos trabalhos que trouxe, para que um canal que não produz nada fique visível em vez de ser apenas uma suposição.",
  "featurePage.marketing.pain.3.pain":
    "Os seus melhores clientes recomendá-lo-iam com todo o gosto, mas ninguém lhes pede.",
  "featurePage.marketing.pain.3.fix":
    "Depois de o trabalho ser marcado como concluído, é enviado um único pedido educado — e um prestador de serviços que recomendar dá a ambos um mês gratuito.",
  "featurePage.marketing.how.1.step":
    "É enviado em seu nome, para a sua própria lista",
  "featurePage.marketing.how.1.body":
    "As campanhas são enviadas a partir do seu endereço verificado para os clientes que já estão na sua conta, e pode ver o que lhes chegou.",
  "featurePage.marketing.how.2.step":
    "O trabalho no bairro é planeado, não deixado à memória",
  "featurePage.marketing.how.2.body":
    "Planeie as ruas, atribua-as a quem as vai percorrer e os locais são assinalados à medida que são concluídos.",
  "featurePage.marketing.how.3.step":
    "O pedido é feito no momento certo, não repetidamente",
  "featurePage.marketing.how.3.body":
    "O pedido de avaliação espera até o trabalho ser marcado como concluído e depois é enviado uma vez, após o intervalo que escolher.",

  // /features/subcontractors
  "featurePage.subcontractors.label": "Preços de subempreiteiros",
  "featurePage.subcontractors.headline":
    "Inclua o preço de um subempreiteiro na sua proposta sem o voltar a escrever",
  "featurePage.subcontractors.oneLine":
    "Importe o orçamento de um subempreiteiro como custo, aplique a sua margem e o cliente vê apenas o seu preço.",
  "featurePage.subcontractors.description":
    "Importe o orçamento de um subempreiteiro para a sua própria proposta como linha de custo, aplique a sua margem e deixe o cliente ver apenas um preço — depois mantenha o mesmo subempreiteiro no trabalho, com a documentação e os pagamentos associados.",
  "featurePage.subcontractors.pain.1.pain":
    "O valor do eletricista chega como uma fotografia de uma folha e volta a escrevê-lo na proposta às onze da noite.",
  "featurePage.subcontractors.pain.1.fix":
    "O orçamento dele entra como linhas de custo às quais pode aplicar uma margem, sem voltar a escrever nada nem trocar números.",
  "featurePage.subcontractors.pain.2.pain":
    "Calcula a margem de cabeça, esquece-se de quais linhas eram dele e depois não consegue perceber quanto o trabalho realmente rendeu.",
  "featurePage.subcontractors.pain.2.fix":
    "O preço dele permanece no trabalho como custo, por isso a margem fica visível quando analisa quanto o trabalho rendeu.",
  "featurePage.subcontractors.pain.3.pain":
    "O proprietário recebe uma proposta que parece ter sido escrita por três empresas diferentes.",
  "featurePage.subcontractors.pain.3.fix":
    "O cliente vê um único documento, com as suas cores e o seu preço.",
  "featurePage.subcontractors.how.1.step":
    "Chega através da ligação do orçamento dele",
  "featurePage.subcontractors.how.1.body":
    "O subempreiteiro envia-lhe a mesma ligação que enviaria a um proprietário, e você importa-a como custos na sua própria proposta em vez de a aprovar.",
  "featurePage.subcontractors.how.2.step": "A margem é sua e não é mostrada",
  "featurePage.subcontractors.how.2.body":
    "As linhas importadas entram numa categoria de custos controlada por si. O cliente lê o seu preço, não o preço do subempreiteiro acrescido de uma percentagem.",
  "featurePage.subcontractors.how.3.step":
    "O subempreiteiro permanece no trabalho depois da proposta",
  "featurePage.subcontractors.how.3.body":
    "Depois de ganhar o trabalho, a mesma empresa fica associada a ele pelo preço acordado. As datas do seguro e das autorizações ficam no respetivo registo, aquilo que lhe paga entra nos custos do trabalho e o total pago a cada subempreiteiro durante o ano aparece no ecrã quando o seu contabilista perguntar.",

  // /features/quote-from-the-call
  "featurePage.quote-from-the-call.label": "Um orçamento a partir da chamada",
  "featurePage.quote-from-the-call.headline":
    "A chamada transforma-se num rascunho de orçamento, não numa nota que tem de decifrar",
  "featurePage.quote-from-the-call.oneLine":
    "O que a pessoa descreveu regressa escrito como âmbito de trabalho que pode abrir, corrigir e calcular — a partir das palavras da gravação e sem preços.",
  "featurePage.quote-from-the-call.description":
    "Transforme uma chamada gravada num rascunho de orçamento: o âmbito descrito pela pessoa, preparado para um responsável corrigir e calcular. Nunca é indicado qualquer preço por telefone.",
  "featurePage.quote-from-the-call.pain.1.pain":
    "Ouve uma mensagem de voz de dois minutos três vezes para tentar perceber de que lado da casa ela estava a falar.",
  "featurePage.quote-from-the-call.pain.1.fix":
    "As palavras da chamada regressam organizadas como âmbito de trabalho, para que esteja a corrigir um rascunho em vez de o reconstruir.",
  "featurePage.quote-from-the-call.pain.2.pain":
    "Alguém liga às quatro e, quando se senta às oito, já perdeu metade do que foi dito.",
  "featurePage.quote-from-the-call.pain.2.fix":
    "A chamada já é um rascunho quando abre o escritório. Edita-o em vez de começar do zero.",
  "featurePage.quote-from-the-call.pain.3.pain":
    "Nunca deixaria um serviço de atendimento indicar um preço, mas todos querem fazê-lo.",
  "featurePage.quote-from-the-call.pain.3.fix":
    "Este não consegue. Não existe forma de dizer um preço em voz alta, e o rascunho que cria não contém preços.",
  "featurePage.quote-from-the-call.how.1.step":
    "Escreve o âmbito, nunca um preço",
  "featurePage.quote-from-the-call.how.1.body":
    "O rascunho contém o trabalho tal como foi descrito pela pessoa. O preço é definido por si no criador de orçamentos com base na sua própria tabela de preços, porque dar um preço por telefone sem ter visto a casa é uma das formas mais rápidas de perder dinheiro num trabalho.",
  "featurePage.quote-from-the-call.how.2.step": "Pede-o depois, no escritório",
  "featurePage.quote-from-the-call.how.2.body":
    "O rascunho é criado mais tarde e apenas quando alguém com acesso aos orçamentos o pede. A chamada em si apenas regista aquilo que foi dito.",
  "featurePage.quote-from-the-call.how.3.step":
    "Quando não consegue, diz-lhe porquê",
  "featurePage.quote-from-the-call.how.3.body":
    "Quatro respostas específicas em vez de um único erro, para saber se deve ativar alguma coisa, ligar de volta à pessoa ou ignorar.",
  "featurePage.quote-from-the-call.detail.1.label":
    "Nunca é indicado um preço por telefone",
  "featurePage.quote-from-the-call.detail.1.body":
    "As regras sob as quais o rececionista responde têm prioridade sobre tudo o que escrever, e a primeira é nunca dar um preço — nem sequer um intervalo, mesmo quando insistem.",
  "featurePage.quote-from-the-call.detail.2.label":
    "O rascunho também não contém preços",
  "featurePage.quote-from-the-call.detail.2.body":
    "O que regressa é o trabalho descrito, como âmbito. Não existe caminho entre uma chamada telefónica e um documento com preço sem que um responsável pelo orçamento o abra, por isso nada chega ao cliente com um valor que ninguém escolheu.",
  "featurePage.quote-from-the-call.detail.3.label": "Voltar a lê-lo é gratuito",
  "featurePage.quote-from-the-call.detail.3.body":
    "O rascunho fica guardado junto da chamada, por isso abri-lo uma segunda vez não custa nada. Apenas pedir um novo utiliza o seu limite de utilização de IA.",
  "featurePage.quote-from-the-call.detail.4.label":
    "O próprio orçamento é guardado por uma pessoa",
  "featurePage.quote-from-the-call.detail.4.body":
    "O rascunho só se transforma num orçamento real quando alguém carrega em Guardar no criador de orçamentos normal, passando pelas verificações habituais.",
  "featurePage.quote-from-the-call.detail.5.label":
    "Quatro razões específicas em vez de uma resposta vaga",
  "featurePage.quote-from-the-call.detail.5.body":
    "IA desativada, serviço desativado, uma chamada sem palavras ou nada na chamada que descreva um trabalho. E quando não existe uma gravação para ler, o botão não aparece em vez de aparecer sem funcionar.",
  "featurePage.quote-from-the-call.detail.6.label":
    "Quem pode abrir as chamadas",
  "featurePage.quote-from-the-call.detail.6.body":
    "As chamadas ficam disponíveis para as pessoas que devolvem chamadas. Isto é determinado pelo mesmo nível de acesso utilizado para a lista de clientes, para que um responsável por orçamentos mantenha esse acesso e a equipa no terreno não.",

  // /features/suggested-add-ons
  "featurePage.suggested-add-ons.label": "Extras sugeridos",
  "featurePage.suggested-add-ons.headline":
    "Os extras que queria oferecer, no final do orçamento",
  "featurePage.suggested-add-ons.oneLine":
    "Extras opcionais que o cliente pode selecionar, sugeridos com base no que realmente vendeu juntamente com este tipo de trabalho e calculados por si, não por uma estimativa.",
  "featurePage.suggested-add-ons.description":
    "Extras opcionais num orçamento: sugeridos a partir dos seus próprios trabalhos aceites, com preços definidos por si, selecionados pelo cliente e transferidos para a fatura exatamente como foram escolhidos.",
  "featurePage.suggested-add-ons.pain.1.pain":
    "Lembra-se da melhoria dos puxadores no caminho para casa e, nessa altura, o orçamento já foi enviado.",
  "featurePage.suggested-add-ons.pain.1.fix":
    "Os extras que normalmente acompanham este trabalho são sugeridos enquanto ainda está a criar o orçamento.",
  "featurePage.suggested-add-ons.pain.2.pain":
    "As sugestões de venda adicional noutros programas são o catálogo de outra pessoa com o seu nome no topo.",
  "featurePage.suggested-add-ons.pain.2.fix":
    "A sugestão é calculada a partir dos seus próprios orçamentos: o que vendeu juntamente com este trabalho e com que frequência.",
  "featurePage.suggested-add-ons.pain.3.pain":
    "Um cliente seleciona um extra e agora a fatura e o orçamento têm totais diferentes.",
  "featurePage.suggested-add-ons.pain.3.fix":
    "Apenas os extras selecionados chegam à fatura, e a fatura é criada a partir dessas escolhas em vez de serem novamente escritos.",
  "featurePage.suggested-add-ons.how.1.step": "Contado, não adivinhado",
  "featurePage.suggested-add-ons.how.1.body":
    "As sugestões vêm da contagem do que aparece juntamente com este trabalho nos seus últimos duzentos ou poucos orçamentos, com a frequência indicada para poder discordar.",
  "featurePage.suggested-add-ons.how.2.step":
    "É você que define o preço, ou não existe extra",
  "featurePage.suggested-add-ons.how.2.body":
    "Um extra sem preço é recusado pelo nome. Um cliente não pode selecionar algo que não tenha preço.",
  "featurePage.suggested-add-ons.how.3.step":
    "Termina quando o orçamento é decidido",
  "featurePage.suggested-add-ons.how.3.body":
    "Assim que o cliente aceita ou recusa, os extras ficam fixos e a fatura é criada a partir daqueles que escolheu.",
  "featurePage.suggested-add-ons.detail.1.label": "No máximo, oito",
  "featurePage.suggested-add-ons.detail.1.body":
    "Um orçamento pode ter até oito extras opcionais. Mais do que alguns já é praticamente outro orçamento, e o limite deixa isso claro em vez de permitir que a lista cresça até ninguém a ler.",
  "featurePage.suggested-add-ons.detail.2.label":
    "Calculados a partir dos seus próprios orçamentos",
  "featurePage.suggested-add-ons.detail.2.body":
    "As sugestões são as três coisas que aparecem mais frequentemente juntamente com o trabalho já presente neste orçamento, contadas nos seus próprios orçamentos recentes enviados e aceites, cada uma com a percentagem de vezes em que apareceu. Não existe qualquer modelo envolvido nem trabalho de outra empresa.",
  "featurePage.suggested-add-ons.detail.3.label":
    "Nada gratuito pode ser oferecido",
  "featurePage.suggested-add-ons.detail.3.body":
    "Guardar um extra com valor zero ou inferior é recusado e os nomes em causa são apresentados. A fatura é criada a partir do que o cliente selecionou, por isso uma escolha sem preço tornar-se-ia uma linha sem preço numa fatura.",
  "featurePage.suggested-add-ons.detail.4.label":
    "Ficam bloqueados quando o orçamento é decidido",
  "featurePage.suggested-add-ons.detail.4.body":
    "Editar extras num orçamento aceite ou recusado é impedido, porque alteraria aquilo que alguém irá pagar.",
  "featurePage.suggested-add-ons.detail.5.label":
    "Os extras medidos atualizam-se sozinhos",
  "featurePage.suggested-add-ons.detail.5.body":
    "Os extras derivados de uma medição são novamente calculados sempre que guarda e aparecem acima daqueles que escreveu manualmente, para que uma alteração nunca seja silenciosamente substituída.",

  // /features/automatic-follow-ups
  "featurePage.automatic-follow-ups.label": "Seguimentos automáticos",
  "featurePage.automatic-follow-ups.headline":
    "O seguimento que continua a querer fazer, executado segundo um calendário",
  "featurePage.automatic-follow-ups.oneLine":
    "Um orçamento sem resposta, uma fatura vencida e um trabalho acabado de concluir recebem cada um uma mensagem no momento definido por si e com as suas palavras.",
  "featurePage.automatic-follow-ups.description":
    "Emails automáticos de seguimento com três gatilhos: um orçamento sem resposta, uma fatura vencida e um trabalho concluído. O seu texto, o seu intervalo e o seguimento para sozinho.",
  "featurePage.automatic-follow-ups.pain.1.pain":
    "Liga duas vezes, não atendem, e três semanas depois descobre que escolheram outra pessoa.",
  "featurePage.automatic-follow-ups.pain.1.fix":
    "Um orçamento sem resposta recebe seguimento segundo o seu calendário, sem ter de se lembrar de quem é a vez.",
  "featurePage.automatic-follow-ups.pain.2.pain":
    "Cobrar dinheiro faz com que se sinta um cobrador de dívidas, por isso a fatura fica ali parada.",
  "featurePage.automatic-follow-ups.pain.2.fix":
    "A mensagem de atraso é enviada com o texto que escreveu uma vez, no intervalo que definiu.",
  "featurePage.automatic-follow-ups.pain.3.pain":
    "Envia um lembrete e descobre que pagaram na terça-feira passada.",
  "featurePage.automatic-follow-ups.pain.3.fix":
    "O seguimento para porque o orçamento ou a fatura avançaram. Não existe outro interruptor que tenha de se lembrar de desligar.",
  "featurePage.automatic-follow-ups.how.1.step":
    "Três gatilhos, com os seus próprios intervalos",
  "featurePage.automatic-follow-ups.how.1.body":
    "Um orçamento sem resposta, uma fatura vencida e um trabalho acabado de concluir, cada um no intervalo que escolher em horas ou dias.",
  "featurePage.automatic-follow-ups.how.2.step": "Para sozinho",
  "featurePage.automatic-follow-ups.how.2.body":
    "Nada precisa de ser marcado como concluído no seguimento. Um orçamento deixa de ser acompanhado quando o seu estado deixa de ser enviado, o que significa que uma resposta, uma aceitação ou um pagamento termina o seguimento sem ninguém ter de o desligar.",
  "featurePage.automatic-follow-ups.how.3.step":
    "Aquilo que não conseguiu fazer é-lhe comunicado",
  "featurePage.automatic-follow-ups.how.3.body":
    "Clientes sem endereço de email e regras sem texto são contabilizados e comunicados em vez de serem silenciosamente ignorados.",
  "featurePage.automatic-follow-ups.detail.1.label":
    "Três gatilhos, e apenas três",
  "featurePage.automatic-follow-ups.detail.1.body":
    "Um orçamento sem resposta, uma fatura depois da data de vencimento e um trabalho acabado de concluir. Não pode escolher mais nenhum porque não existe nenhum outro configurado para enviar.",
  "featurePage.automatic-follow-ups.detail.2.label":
    "Três dias, cinco dias, dois dias",
  "featurePage.automatic-follow-ups.detail.2.body":
    "Os valores predefinidos, por essa ordem. Cada regra define o seu próprio número, em horas ou dias.",
  "featurePage.automatic-follow-ups.detail.3.label":
    "Email, e a página diz isso",
  "featurePage.automatic-follow-ups.detail.3.body":
    "Existe um único canal e é declarado uma vez, para que o diagrama no ecrã de definições não possa desenhar um ramo de mensagens de texto que nunca enviaria nada. Uma verificação da compilação falha se o desenho e o envio não coincidirem.",
  "featurePage.automatic-follow-ups.detail.4.label":
    "Não pode enviar duas vezes",
  "featurePage.automatic-follow-ups.detail.4.body":
    "Cada envio é reservado antes de sair, para que duas execuções sobrepostas não possam produzir duas cópias do mesmo seguimento.",
  "featurePage.automatic-follow-ups.detail.5.label":
    "Um trabalho concluído antes de registarmos conclusões é deixado em paz",
  "featurePage.automatic-follow-ups.detail.5.body":
    "Não existe uma data a partir da qual contar, por isso é ignorado em vez de receber seguimento com base numa data inventada.",
  "featurePage.automatic-follow-ups.detail.6.label":
    "Um cliente sem email é contabilizado, não contactado",
  "featurePage.automatic-follow-ups.detail.6.body":
    "Clientes sem endereço e regras sem texto são comunicados como ignorados em vez de falharem num local onde ninguém veria.",

  // /features/scheduling
  "featurePage.scheduling.label": "Agendamento e despacho",
  "featurePage.scheduling.headline": "A semana de toda a equipa num único ecrã",
  "featurePage.scheduling.oneLine":
    "Coloque visitas no calendário, atribua quem vai, publique a escala e deixe o trabalho recorrente voltar a aparecer sozinho.",
  "featurePage.scheduling.description":
    "Agendamento e despacho para equipas no terreno: visitas, atribuições, uma escala publicada, trabalho recorrente, lembretes e ausências num único calendário.",
  "featurePage.scheduling.pain.1.pain":
    "O calendário está na sua cabeça e num chat de grupo, e os dois já não coincidem na quarta-feira.",
  "featurePage.scheduling.pain.1.fix":
    "Um calendário publicado onde todos veem a sua própria semana e você vê tudo.",
  "featurePage.scheduling.pain.2.pain":
    "Duas equipas chegam à mesma morada e nenhuma trouxe a pistola de pintura.",
  "featurePage.scheduling.pain.2.fix":
    "Cada visita indica quem vai e qual é o trabalho, por isso uma marcação duplicada fica visível antes de se transformar numa manhã perdida.",
  "featurePage.scheduling.pain.3.pain":
    "A manutenção semanal é esquecida precisamente na semana em que está mais ocupado.",
  "featurePage.scheduling.pain.3.fix":
    "O trabalho recorrente volta sozinho ao calendário sem ninguém ter de se lembrar.",
  "featurePage.scheduling.how.1.step": "Atribua a pessoa, não apenas o dia",
  "featurePage.scheduling.how.1.body":
    "Uma visita inclui a pessoa que vai, a morada e o âmbito. A vista da própria equipa mostra os respetivos turnos e nada que não tenha necessidade de ver.",
  "featurePage.scheduling.how.2.step": "Publique uma vez",
  "featurePage.scheduling.how.2.body":
    "Prepare a escala da próxima semana, publique-a e todos veem os seus próprios turnos. Os pedidos de ausência vão para o responsável certo e o calendário tem-nos em conta.",
  "featurePage.scheduling.how.3.step": "O cliente é informado e pode alterar",
  "featurePage.scheduling.how.3.body":
    "É enviado um lembrete antes da chegada, e a confirmação inclui uma ligação que permite ao cliente alterar a visita sem lhe telefonar.",
  "featurePage.scheduling.detail.1.label":
    "Uma visita faz o trabalho avançar, uma vez",
  "featurePage.scheduling.detail.1.body":
    "Marcar uma visita faz um trabalho passar de não agendado para agendado e não mais do que isso, para que uma visita de acompanhamento num trabalho concluído não o faça recuar.",
  "featurePage.scheduling.detail.2.label":
    "Duas semanas da equipa, lidas de três formas",
  "featurePage.scheduling.detail.2.body":
    "O calendário da equipa cobre catorze dias e combina compromissos, visitas de trabalho e marcações — deixando de fora marcações já transformadas em compromissos, para que ninguém seja contado duas vezes. A pessoa mais ocupada aparece primeiro.",
  "featurePage.scheduling.detail.3.label":
    "Não ter autorização para ver a equipa não é um erro",
  "featurePage.scheduling.detail.3.body":
    "Vê a sua própria semana e uma indicação simples de que a vista da equipa não lhe está disponível. Perguntar por uma pessoa específica devolve uma única frase deliberadamente genérica, para que não seja possível descobrir nomes através do texto.",
  "featurePage.scheduling.detail.4.label":
    "Atribuir-se a si próprio não é atribuir outra pessoa",
  "featurePage.scheduling.detail.4.body":
    "Colocar-se a si próprio numa visita não exige qualquer permissão especial. Colocar outra pessoa exige autorização para atribuir, para que um membro da equipa possa assumir trabalho sem poder distribuí-lo.",
  "featurePage.scheduling.detail.5.label":
    "Os turnos são preparados e depois publicados",
  "featurePage.scheduling.detail.5.body":
    "Um turno não publicado é invisível para a pessoa atribuída. Agendar alguém que não está disponível é recusado com a lista das razões e, quando a razão é uma ausência aprovada, não existe qualquer botão para ignorar — nem sequer um botão desativado.",

  // /features/jobs
  "featurePage.jobs.label": "Gestão de trabalhos",
  "featurePage.jobs.headline":
    "O orçamento aprovado transforma-se no trabalho, com toda a documentação associada",
  "featurePage.jobs.oneLine":
    "Âmbito, morada, tarefas, listas de verificação, materiais e fotografias num único local para a pessoa que está realmente a executar o trabalho.",
  "featurePage.jobs.description":
    "Gestão de trabalhos para prestadores de serviços: o orçamento aprovado transforma-se num trabalho com o âmbito, a morada, a lista de verificação, os materiais e as fotografias.",
  "featurePage.jobs.pain.1.pain":
    "O âmbito foi acordado há seis semanas e a pessoa no local nunca o leu.",
  "featurePage.jobs.pain.1.fix":
    "O trabalho inclui o âmbito aprovado e a morada, para que aquilo que foi vendido e aquilo que é executado sejam o mesmo documento.",
  "featurePage.jobs.pain.2.pain":
    "Três divisões, duas pessoas e ninguém sabe ao certo quem tratava dos acabamentos.",
  "featurePage.jobs.pain.2.fix":
    "Divida o trabalho por divisões ou zonas e atribua cada uma a uma pessoa específica.",
  "featurePage.jobs.pain.3.pain":
    "Lembra-se da lista de retoques no caminho para casa e esquece-se dela quando chega.",
  "featurePage.jobs.pain.3.fix":
    "Tudo o que falta fazer fica numa única lista, ordenada pelo impacto que terá se ficar por fazer.",
  "featurePage.jobs.how.1.step": "Nada é introduzido novamente",
  "featurePage.jobs.how.1.body":
    "Um orçamento aprovado transforma-se num trabalho com as linhas, a morada e o cliente. As fotografias associadas ficam prontas para entrar na fatura ou no seu site.",
  "featurePage.jobs.how.2.step": "A lista escreve grande parte de si própria",
  "featurePage.jobs.how.2.body":
    "O trabalho sugere as tarefas normalmente necessárias num trabalho deste tipo. Mantém as que se aplicam.",
  "featurePage.jobs.how.3.step":
    "Os materiais são acompanhados à medida que são utilizados",
  "featurePage.jobs.how.3.body":
    "O que foi para o local, quanto custou e o que ainda falta comprar, para que o valor no final do trabalho seja real.",
  "featurePage.jobs.detail.1.label": "Arquivados e atuais nunca são misturados",
  "featurePage.jobs.detail.1.body":
    "Pedir trabalhos arquivados devolve trabalhos arquivados. Nenhuma lista mistura silenciosamente os dois.",
  "featurePage.jobs.detail.2.label":
    "A equipa vê os trabalhos em que participa",
  "featurePage.jobs.detail.2.body":
    "O acesso é determinado por existir uma visita nesse trabalho, através de uma única regra partilhada em vez de uma cópia por ecrã. Um trabalho sem visitas não aparece a ninguém, de propósito.",
  "featurePage.jobs.detail.3.label":
    "Criar um trabalho passa por duas permissões",
  "featurePage.jobs.detail.3.body":
    "A autorização geral para criar um trabalho e depois o nível definido para os próprios trabalhos.",
  "featurePage.jobs.detail.4.label": "Uma única definição do que é um trabalho",
  "featurePage.jobs.detail.4.body":
    "O mesmo processo de criação serve o percurso do orçamento e o da fatura, para que um trabalho criado a partir de qualquer um seja a mesma coisa e passe pelas mesmas verificações.",
  "featurePage.jobs.detail.5.label":
    "As visitas regressam pela ordem em que acontecem",
  "featurePage.jobs.detail.5.body":
    "Cada trabalho inclui o cliente e as visitas ordenadas por data, para que a lista possa ser lida sem uma segunda pesquisa.",

  // /features/crew
  "featurePage.crew.label": "A sua equipa no terreno",
  "featurePage.crew.headline":
    "A carrinha dá notícias sem ninguém ter de escrever nada",
  "featurePage.crew.oneLine":
    "A equipa envia fotografias e atualizações por mensagem para um único número e estas são automaticamente associadas ao trabalho certo; as horas são registadas no trabalho em que estão.",
  "featurePage.crew.description":
    "Ferramentas para equipas no terreno: uma caixa de entrada por mensagens que associa fotografias ao trabalho certo, registo de entrada e saída em qualquer navegador de telemóvel e folhas de horas para aprovação.",
  "featurePage.crew.pain.1.pain":
    "As fotografias de progresso estão em seis telemóveis diferentes e num chat de grupo, e nenhuma está associada a um trabalho.",
  "featurePage.crew.pain.1.fix":
    "A equipa envia-as para um único número e elas são automaticamente associadas ao trabalho a que pertencem.",
  "featurePage.crew.pain.2.pain":
    "As horas chegam na sexta-feira, escritas no verso de um envelope e lembradas em vez de registadas.",
  "featurePage.crew.pain.2.fix":
    "Registam a entrada no trabalho em que estão, e as horas ficam associadas a trabalho real quando as revê.",
  "featurePage.crew.pain.3.pain":
    "Quer dar à equipa aquilo de que precisa sem lhe entregar a sua lista de clientes e os seus preços.",
  "featurePage.crew.pain.3.fix":
    "A equipa vê os seus próprios turnos e os trabalhos em que participa. O acesso é fixo e limitado, e é aplicado no servidor em vez de simplesmente esconder botões.",
  "featurePage.crew.how.1.step": "Uma mensagem de texto, não uma instalação",
  "featurePage.crew.how.1.body":
    "A equipa não tem nada para instalar. Envia mensagens para um único número a partir do telemóvel que já utiliza, e o relógio e o calendário abrem num navegador móvel.",
  "featurePage.crew.how.2.step": "As horas ficam associadas a um trabalho",
  "featurePage.crew.how.2.body":
    "O registo de entrada está associado ao trabalho, não a uma folha de horas em branco, para que o custo de mão de obra apareça onde o apuramento de custos do trabalho o consegue ver.",
  "featurePage.crew.how.3.step": "Aprova antes de contar",
  "featurePage.crew.how.3.body":
    "Nada se transforma em remuneração até ter revisto e aprovado.",

  // /features/job-costing
  "featurePage.job-costing.label": "Custos por trabalho",
  "featurePage.job-costing.headline":
    "Descubra quanto o trabalho rendeu enquanto ainda pode fazer alguma coisa",
  "featurePage.job-costing.oneLine":
    "Mão de obra, materiais e despesas comparados com o preço que orçamentou, trabalho a trabalho.",
  "featurePage.job-costing.description":
    "Custos por trabalho para prestadores de serviços: mão de obra, materiais e despesas comparados com o preço orçamentado, com um ponto de equilíbrio calculado a partir dos seus custos gerais reais.",
  "featurePage.job-costing.pain.1.pain":
    "O ano foi cheio de trabalho, mas a conta bancária diz o contrário, e não consegue identificar quais trabalhos causaram isso.",
  "featurePage.job-costing.pain.1.fix":
    "Cada trabalho mostra o valor orçamentado e aquilo que consumiu, para que consiga identificar o tipo de trabalho que dá prejuízo.",
  "featurePage.job-costing.pain.2.pain":
    "Conhece a sua taxa horária. Não sabe quanto uma hora precisa de faturar antes de ficar com algum dinheiro.",
  "featurePage.job-costing.pain.2.fix":
    "Os seus custos gerais reais são convertidos no valor que um dia precisa de gerar antes de ganhar um cêntimo.",
  "featurePage.job-costing.pain.3.pain":
    "Os materiais são um recibo no porta-luvas e uma estimativa na folha de cálculo.",
  "featurePage.job-costing.pain.3.fix":
    "O custo de um litro de tinta ou de uma placa de contraplacado é registado uma vez, e a quantidade consumida por um trabalho desta dimensão é calculada a partir daí.",
  "featurePage.job-costing.how.1.step": "Utiliza as horas que já aprovou",
  "featurePage.job-costing.how.1.body":
    "A mão de obra vem das horas registadas e aprovadas nesse trabalho. Não é outro número que alguém tenha de introduzir novamente.",
  "featurePage.job-costing.how.2.step":
    "Despesas do trabalho e despesas da empresa ficam separadas",
  "featurePage.job-costing.how.2.body":
    "Uma despesa pertence ao trabalho ou à empresa. Mantê-las separadas é o que torna verdadeiras tanto a margem do trabalho como o valor dos custos gerais.",
  "featurePage.job-costing.how.3.step": "O orçamento é a referência",
  "featurePage.job-costing.how.3.body":
    "Os custos são apresentados em comparação com aquilo que orçamentou, porque essa comparação indica se deve cobrar de forma diferente por esse tipo de trabalho da próxima vez.",
  "featurePage.job-costing.detail.1.label":
    "Apenas as horas aprovadas são um custo",
  "featurePage.job-costing.detail.1.body":
    "As horas ainda à espera de aprovação são apresentadas separadamente e nunca incluídas no total.",
  "featurePage.job-costing.detail.2.label":
    "Uma taxa desconhecida não significa mão de obra gratuita",
  "featurePage.job-costing.detail.2.body":
    "Uma pessoa sem taxa horária acrescenta horas mas nenhum valor monetário, e o total é marcado como comprovadamente incompleto em vez de parecer simplesmente baixo.",
  "featurePage.job-costing.detail.3.label": "Em falta não é o mesmo que nada",
  "featurePage.job-costing.detail.3.body":
    "Um trabalho sem estimativa não tem variação nem margem — nunca é apresentado como estando dentro do orçamento.",
  "featurePage.job-costing.detail.4.label":
    "A estimativa é uma fotografia daquele momento",
  "featurePage.job-costing.detail.4.body":
    "A variação é medida em relação aos custos guardados quando o orçamento foi criado, não em relação à tabela de preços de hoje, e a data dessa referência aparece ao lado.",
  "featurePage.job-costing.detail.5.label":
    "Nada é recalculado enquanto o orçamento permanece igual",
  "featurePage.job-costing.detail.5.body":
    "Se um cálculo de custos foi guardado, regressa exatamente como foi guardado — nenhum campo é atualizado — para que nenhum valor mude entre uma consulta e a seguinte.",
  "featurePage.job-costing.detail.6.label":
    "É uma leitura separada do próprio orçamento",
  "featurePage.job-costing.detail.6.body":
    "A resposta do próprio orçamento alimenta o PDF e a ligação do cliente, para que custos e margens não possam ser expostos por acidente.",
  "featurePage.job-costing.detail.7.label": "Desativado significa recusado",
  "featurePage.job-costing.detail.7.body":
    "Não significa zeros. Um painel cheio de zeros parece um trabalho que não custou nada.",

  // /features/materials
  "featurePage.materials.label": "Materiais do trabalho",
  "featurePage.materials.headline":
    "O que foi para o local, quanto custou e o que ainda falta comprar",
  "featurePage.materials.oneLine":
    "Uma lista de compras derivada do âmbito que já orçamentou, assinalada à medida que compra, com os preços reais a melhorar a estimativa do próximo trabalho.",
  "featurePage.materials.description":
    "Uma lista de materiais criada a partir do próprio âmbito do orçamento: o que comprar, o custo estimado, o custo real e um histórico de preços que melhora a próxima estimativa.",
  "featurePage.materials.pain.1.pain":
    "A lista está no verso de uma guia de entrega na carrinha e mais ninguém a consegue ver.",
  "featurePage.materials.pain.1.fix":
    "A lista está no trabalho, derivada do âmbito que já orçamentou, e qualquer pessoa com acesso consegue ver o que falta.",
  "featurePage.materials.pain.2.pain":
    "Reconstrói a lista depois de uma alteração do âmbito e perde as três coisas que já comprou.",
  "featurePage.materials.pain.2.fix":
    "Reconstruir mantém tudo o que já foi comprado e tudo o que adicionou manualmente. Apenas as linhas derivadas ainda não compradas são substituídas.",
  "featurePage.materials.pain.3.pain":
    "Continua a estimar a gravilha ao preço do ano passado porque ninguém registou quanto pagou.",
  "featurePage.materials.pain.3.fix":
    "O preço que introduz quando assinala uma linha como comprada passa a fazer parte do cálculo da próxima estimativa.",
  "featurePage.materials.how.1.step":
    "Derivado do âmbito, não escrito duas vezes",
  "featurePage.materials.how.1.body":
    "As linhas vêm da mesma lista de materiais utilizada pelo painel de custos, usando as suas próprias substituições de preço quando as definiu, em vez de um valor predefinido que ninguém escolheu.",
  "featurePage.materials.how.2.step": "Reconstruir nunca destrói trabalho",
  "featurePage.materials.how.2.body":
    "Tudo o que foi comprado e tudo o que foi adicionado manualmente permanece, e o sistema indica o que foi criado, mantido e removido em vez de o obrigar a descobrir.",
  "featurePage.materials.how.3.step":
    "Assinalar uma compra ensina a tabela de preços",
  "featurePage.materials.how.3.body":
    "Um custo real introduzido numa compra é registado por unidade e incluído numa média completa de todas as entradas, para que um recibo introduzido incorretamente seja diluído em vez de se tornar o novo preço.",
  "featurePage.materials.detail.1.label":
    "A unidade faz parte da definição do material",
  "featurePage.materials.detail.1.body":
    "O mesmo material comprado por jarda cúbica e por tonelada é tratado como duas compras diferentes, porque é exatamente isso que são.",
  "featurePage.materials.detail.2.label":
    "Desmarque-o e o histórico de preços permanece",
  "featurePage.materials.detail.2.body":
    "Desmarcar elimina o custo, o fornecedor e quem comprou. A informação registada sobre o preço permanece, porque a compra aconteceu.",
  "featurePage.materials.detail.3.label":
    "Custos e quantidades têm permissões separadas",
  "featurePage.materials.detail.3.body":
    "Alguém sem autorização para ver valores monetários continua a ver a lista, as unidades e quanto foi comprado. Apenas os valores são removidos, e o facto de terem sido removidos é indicado em vez de deixar uma coluna em branco.",
  "featurePage.materials.detail.4.label":
    "Introduzir um custo que não pode ver é recusado",
  "featurePage.materials.detail.4.body":
    "É recusado diretamente, não aceite e depois ignorado. Adicionar uma linha sem preço continua a funcionar.",
  "featurePage.materials.detail.5.label":
    "Valores predefinidos ao adicionar manualmente",
  "featurePage.materials.detail.5.body":
    "A quantidade assume um e a unidade assume cada. A linha vai para o final e fica marcada como sua, para que reconstruir a lista a deixe intacta.",

  // /features/job-photos
  "featurePage.job-photos.label": "Fotografias de antes e depois",
  "featurePage.job-photos.headline":
    "As fotografias que a sua equipa já tira, organizadas por trabalho",
  "featurePage.job-photos.oneLine":
    "A equipa envia fotografias por mensagem, estas chegam ao trabalho certo já identificadas como antes ou depois, e as que escolher aparecem no seu próprio site.",
  "featurePage.job-photos.description":
    "Fotografias de trabalhos organizadas a partir das mensagens da equipa, classificadas como início, progresso, conclusão e problema, com apenas as que escolher apresentadas no seu site.",
  "featurePage.job-photos.pain.1.pain":
    "As fotografias de antes estão no telemóvel de alguém, e essa pessoa saiu da empresa em março.",
  "featurePage.job-photos.pain.1.fix":
    "As fotografias chegam associadas ao trabalho em vez de ficarem num álbum pessoal e permanecem lá.",
  "featurePage.job-photos.pain.2.pain":
    "Quer uma galeria no seu site e reconstruí-la a partir de quatro telemóveis ocupa uma tarde de domingo.",
  "featurePage.job-photos.pain.2.fix":
    "Selecione as que vale a pena mostrar e ficam no seu site. Nada é publicado apenas por ser recente.",
  "featurePage.job-photos.pain.3.pain":
    "Alguém coloca no site uma fotografia de um cano rebentado.",
  "featurePage.job-photos.pain.3.fix":
    "Uma fotografia marcada como problema não pode ser destacada, e a recusa indica-lhe o que deve alterar.",
  "featurePage.job-photos.how.1.step":
    "Chegam por mensagem a partir do telemóvel que a equipa já utiliza",
  "featurePage.job-photos.how.1.body":
    "Uma fotografia enviada para o número da sua equipa é associada ao trabalho em que essa pessoa está, e qualquer texto enviado juntamente com ela é adicionado à visita em vez de substituir a nota que já existe.",
  "featurePage.job-photos.how.2.step":
    "Início, progresso, conclusão ou problema",
  "featurePage.job-photos.how.2.body":
    "A categoria é inferida a partir das palavras da mensagem — palavras de problema têm prioridade sobre conclusão, conclusão sobre início, e tudo o que não for reconhecido é progresso. É apenas um ponto de partida e pode sempre alterá-lo.",
  "featurePage.job-photos.how.3.step":
    "É você que decide o que um desconhecido vê",
  "featurePage.job-photos.how.3.body":
    "Nada é público até decidir destacá-lo, e uma fotografia de problema é recusada em vez de ser silenciosamente ignorada, para que nunca tenha de perguntar porque não apareceu.",
  "featurePage.job-photos.detail.1.label": "Quatro categorias, não texto livre",
  "featurePage.job-photos.detail.1.body":
    "Início, progresso, conclusão e problema. Uma lista fechada, para que seja possível construir uma galeria e nenhuma fotografia acabe numa categoria só sua.",
  "featurePage.job-photos.detail.2.label":
    "Uma fotografia de problema não pode ser destacada",
  "featurePage.job-photos.detail.2.body":
    "A tentativa é recusada com a razão e a solução — altere primeiro a categoria — em vez de ser aceite e silenciosamente ignorada.",
  "featurePage.job-photos.detail.3.label": "Como pode ser uma legenda",
  "featurePage.job-photos.detail.3.body":
    "Até duzentos caracteres. Limpar a legenda não guarda nada em vez de guardar uma string vazia, e uma alteração sem conteúdo é recusada em vez de contar como uma gravação.",
  "featurePage.job-photos.detail.4.label":
    "Ver e publicar são permissões diferentes",
  "featurePage.job-photos.detail.4.body":
    "Ver as fotografias do trabalho e escolher quais aparecem no seu site são níveis separados, para que um coordenador possa ver sem publicar.",
  "featurePage.job-photos.detail.5.label": "O que pode ser enviado",
  "featurePage.job-photos.detail.5.body":
    "Fotografias até quinze megabytes, vídeo até cem e documentos até vinte e cinco. Os carregamentos são assinados do nosso lado e exigem que tenha sessão iniciada — nunca existe uma porta aberta na internet.",

  // /features/time-clock
  "featurePage.time-clock.label": "Registar entrada e saída",
  "featurePage.time-clock.headline":
    "Registar a entrada a partir de qualquer telemóvel, e nada mais",
  "featurePage.time-clock.oneLine":
    "Um botão que inicia e para o relógio, horas arredondadas da mesma forma que no escritório e nenhum acompanhamento da localização de ninguém.",
  "featurePage.time-clock.description":
    "Um ecrã de entrada e saída para a equipa num navegador de telemóvel: um botão, um cronómetro em direto, horas com o arredondamento utilizado pelo processamento salarial e nenhum acompanhamento de localização.",
  "featurePage.time-clock.pain.1.pain":
    "As horas chegam num pedaço de papel na sexta-feira e metade delas são a melhor recordação de alguém.",
  "featurePage.time-clock.pain.1.fix":
    "O relógio está a correr ou não está, e o total de hoje aparece no ecrã enquanto corre.",
  "featurePage.time-clock.pain.2.pain":
    "Não quer dizer à sua equipa que está a acompanhar onde se encontra.",
  "featurePage.time-clock.pain.2.fix":
    "Nada aqui regista localização. Não existe mapa, limite geográfico nem fotografia de entrada.",
  "featurePage.time-clock.pain.3.pain":
    "Alguém regista a entrada do colega a partir da carrinha.",
  "featurePage.time-clock.pain.3.fix":
    "O relógio pertence sempre à pessoa com sessão iniciada. Não existe campo para o nome de outra pessoa.",
  "featurePage.time-clock.how.1.step":
    "Um botão e um cronómetro que concorda com ele",
  "featurePage.time-clock.how.1.body":
    "Entrada e saída utilizam o mesmo botão. O total de hoje combina as horas já registadas com o tempo que ainda está a decorrer, para que o valor corresponda ao cronómetro acima em vez de saltar quando para.",
  "featurePage.time-clock.how.2.step":
    "Arredondado uma vez, da mesma forma em todo o lado",
  "featurePage.time-clock.how.2.body":
    "As horas são arredondadas quando o relógio para, utilizando exatamente o mesmo arredondamento de uma folha de horas introduzida manualmente, para que o processamento salarial leia um único valor independentemente da forma como foi criado.",
  "featurePage.time-clock.how.3.step":
    "Diz o que está errado em vez de não fazer nada",
  "featurePage.time-clock.how.3.body":
    "Alguém que não esteja configurado como trabalhador é informado disso e de onde um administrador pode corrigir. Registar a entrada duas vezes ou a saída sem ter entrado é recusado com a respetiva razão.",
  "featurePage.time-clock.detail.1.label": "Apenas registo de horas",
  "featurePage.time-clock.detail.1.body":
    "Sem localização, sem limites geográficos, sem fotografia de entrada, sem cálculos de pausas ou horas extraordinárias neste ecrã e sem dinheiro. O que faz é registar quando alguém começou e quando terminou.",
  "featurePage.time-clock.detail.2.label": "Um relógio de cada vez",
  "featurePage.time-clock.detail.2.body":
    "Registar a entrada quando já está dentro é recusado, tal como registar a saída quando nada está a decorrer. Ambos indicam claramente qual é o problema.",
  "featurePage.time-clock.detail.3.label":
    "O relógio pertence a quem tem sessão iniciada",
  "featurePage.time-clock.detail.3.body":
    "Não existe forma de indicar outra pessoa, por isso ninguém pode registar a entrada de um colega a partir do banco do passageiro.",
  "featurePage.time-clock.detail.4.label": "Aqui não é pedido nenhum trabalho",
  "featurePage.time-clock.detail.4.body":
    "Um registo feito neste ecrã é um registo do dia, não uma linha nos custos de um trabalho específico.",
  "featurePage.time-clock.detail.5.label": "As entradas começam como pendentes",
  "featurePage.time-clock.detail.5.body":
    "Nada conta até ser aprovado. As horas aprovadas são as que o processamento salarial e os custos por trabalho utilizam.",
  "featurePage.time-clock.detail.6.label":
    "Alguém que ainda não está na equipa",
  "featurePage.time-clock.detail.6.body":
    "Recebe um cartão que explica a situação e indica exatamente onde um administrador a corrige, em vez de um botão que não faz nada.",

  // /features/crew-inbox
  "featurePage.crew-inbox.label": "Caixa de entrada da equipa",
  "featurePage.crew-inbox.headline":
    "Um número para a sua equipa enviar mensagens, e as fotografias organizam-se sozinhas",
  "featurePage.crew-inbox.oneLine":
    "A sua equipa envia fotografias e atualizações para um único número a partir do telemóvel que já tem, e estas chegam ao trabalho certo — ou é feita uma pergunta sobre qual é.",
  "featurePage.crew-inbox.description":
    "Um único número de mensagens para a sua equipa: fotografias e notas associadas ao trabalho certo com base no conteúdo da mensagem, fazendo uma pergunta em vez de adivinhar.",
  "featurePage.crew-inbox.pain.1.pain":
    "As fotografias chegam a um chat de grupo e ninguém as move para lado nenhum.",
  "featurePage.crew-inbox.pain.1.fix":
    "Chegam ao trabalho, dentro da visita, juntamente com aquilo que foi escrito.",
  "featurePage.crew-inbox.pain.2.pain":
    "Teria de comprar um telemóvel a toda a gente para conseguir que utilizassem algo que tivesse de ser instalado.",
  "featurePage.crew-inbox.pain.2.fix":
    "Não existe nada para instalar. É uma mensagem enviada a partir do telemóvel que já utilizam.",
  "featurePage.crew-inbox.pain.3.pain":
    "O software adivinha a que trabalho pertence uma fotografia e engana-se duas vezes por semana.",
  "featurePage.crew-inbox.pain.3.fix":
    "Quando não tem a certeza, pergunta, apresentando os trabalhos do dia como botões, e associa a fotografia que estava a guardar em vez de associar a resposta.",
  "featurePage.crew-inbox.how.1.step": "Lê a mensagem antes de adivinhar",
  "featurePage.crew-inbox.how.1.body":
    "O nome de um cliente, o título de um trabalho ou até o número da porta no texto são suficientes para o associar. Dois resultados dão origem a uma pergunta mais específica, não a uma resposta, por isso pergunta.",
  "featurePage.crew-inbox.how.2.step":
    "Um trabalho hoje significa uma resposta",
  "featurePage.crew-inbox.how.2.body":
    "Se a pessoa que envia a mensagem tiver exatamente uma visita nesse dia, é para aí que vai. O dia é calculado no fuso horário da sua empresa, utilizando a meia-noite seguinte em vez de um período fixo de vinte e quatro horas, para que a mudança de hora não inclua o dia anterior.",
  "featurePage.crew-inbox.how.3.step": "A pergunta tem prazo",
  "featurePage.crew-inbox.how.3.body":
    "Uma pergunta sem resposta sobre qual é o trabalho pode ser respondida por mensagem durante doze horas. Antes e depois desse período, qualquer pessoa no escritório pode associar a fotografia retida a partir da caixa de entrada.",
  "featurePage.crew-inbox.detail.1.label":
    "A empresa é determinada pelo número para o qual enviaram a mensagem",
  "featurePage.crew-inbox.detail.1.body":
    "Nunca pelo remetente. Um subempreiteiro que trabalha para duas empresas tem um único telefone, e o número de um remetente pode ser falsificado; o número para o qual enviou a mensagem não.",
  "featurePage.crew-inbox.detail.2.label": "Dez imagens por mensagem",
  "featurePage.crew-inbox.detail.2.body":
    "Uma mensagem que diga ter cem anexos continua a produzir apenas dez. O limite é nosso, não do remetente.",
  "featurePage.crew-inbox.detail.3.label":
    "As notas são adicionadas, nunca substituídas",
  "featurePage.crew-inbox.detail.3.body":
    "Uma nota enviada por mensagem é acrescentada ao que a visita já contém.",
  "featurePage.crew-inbox.detail.4.label":
    "Durante a configuração, o silêncio nunca é a resposta",
  "featurePage.crew-inbox.detail.4.body":
    "Um número desconhecido recebe, nas primeiras mensagens, uma frase que indica o ecrã onde um administrador o adiciona — porque, num local de trabalho, silêncio e uma funcionalidade avariada parecem exatamente a mesma coisa.",
  "featurePage.crew-inbox.detail.5.label":
    "Quando o crédito acaba, é a resposta que fica retida",
  "featurePage.crew-inbox.detail.5.body":
    "A mensagem continua a ser arquivada, porque já foi paga. Apenas a resposta de cortesia fica retida, e isso é registado em vez de ser escondido.",
  "featurePage.crew-inbox.detail.6.label":
    "A localização não é utilizada atualmente",
  "featurePage.crew-inbox.detail.6.body":
    "Uma visita de trabalho não contém um ponto no mapa e a morada de faturação do cliente não é deliberadamente utilizada como substituição. É o conteúdo da mensagem que decide.",

  // /features/invoicing
  "featurePage.invoicing.label": "Faturação",
  "featurePage.invoicing.headline":
    "A fatura parece-se com o orçamento porque foi criada a partir dele",
  "featurePage.invoicing.oneLine":
    "Transforme um orçamento aprovado numa fatura, envie-a com uma ligação de pagamento e mantenha a versão anterior quando precisar de fazer uma alteração.",
  "featurePage.invoicing.description":
    "Faturação que corresponde ao seu orçamento: as mesmas linhas, o mesmo layout, enviada a partir do seu endereço com uma ligação para pagar agora e o imposto sobre vendas correto para a morada.",
  "featurePage.invoicing.pain.1.pain":
    "A fatura é novamente escrita a partir do orçamento, e a linha que fica esquecida é sempre a mais cara.",
  "featurePage.invoicing.pain.1.fix":
    "É criada a partir do orçamento aprovado, por isso as linhas, os totais e o imposto já estão corretos.",
  "featurePage.invoicing.pain.2.pain":
    "O cliente diz que a fatura não corresponde ao que assinou e nenhum dos dois consegue provar nada.",
  "featurePage.invoicing.pain.2.fix":
    "Altere uma fatura emitida e a versão anterior é mantida, para que exista um registo do que mudou e quando.",
  "featurePage.invoicing.pain.3.pain":
    "Trabalha em duas províncias e o imposto na fatura é aquele de que se lembrou nessa manhã.",
  "featurePage.invoicing.pain.3.fix":
    "Defina as suas taxas uma vez e a correta aparece no documento de acordo com a morada onde o trabalho é realizado.",
  "featurePage.invoicing.how.1.step":
    "Criada a partir do orçamento, não ao lado dele",
  "featurePage.invoicing.how.1.body":
    "Uma fatura é gerada a partir do orçamento aprovado e utiliza as mesmas secções e o mesmo layout, para que o proprietário reconheça o documento que assinou.",
  "featurePage.invoicing.how.2.step":
    "Enviada em seu nome, com uma forma de pagar",
  "featurePage.invoicing.how.2.body":
    "É enviada a partir do seu endereço com uma ligação para a fatura e um botão para pagar agora, no idioma em que o documento foi escrito.",
  "featurePage.invoicing.how.3.step":
    "Numerada para não irritar o seu contabilista",
  "featurePage.invoicing.how.3.body":
    "Os números das faturas seguem uma sequência e uma fatura alterada mantém o seu histórico em vez de se substituir silenciosamente.",
  "featurePage.invoicing.detail.1.label":
    "O número da fatura corresponde ao orçamento",
  "featurePage.invoicing.detail.1.body":
    "O orçamento Q-2026-0008 torna-se a fatura INV-2026-0008, para que um cliente que tenha ambos veja que pertencem ao mesmo trabalho.",
  "featurePage.invoicing.detail.2.label":
    "O que significa que a sequência tem intervalos",
  "featurePage.invoicing.detail.2.body":
    "Os orçamentos que ninguém aceitou levam o respetivo número consigo. Isto está correto quando é necessária uma referência única e errado quando é exigida uma sequência contínua, e está documentado em vez de ficar por descobrir.",
  "featurePage.invoicing.detail.3.label":
    "Aprovar duas vezes não cria duas faturas",
  "featurePage.invoicing.detail.3.body":
    "A criação de uma fatura a partir de um orçamento é associada ao próprio orçamento, por isso uma conversão automática e alguém a carregar no botão terminam numa única fatura.",
  "featurePage.invoicing.detail.4.label":
    "Criada a partir daquilo que realmente aceitaram",
  "featurePage.invoicing.detail.4.body":
    "Os grupos de âmbito são convertidos em linhas com o respetivo título à frente, e os totais dão prioridade aos valores aceites na página em que o cliente clicou.",
  "featurePage.invoicing.detail.5.label":
    "Os extras recusados nunca chegam à fatura",
  "featurePage.invoicing.detail.5.body":
    "Um extra opcional que o cliente não selecionou simplesmente não aparece na fatura. Não existe uma linha a zero nem uma nota a explicar aquilo que recusou.",
  "featurePage.invoicing.detail.6.label": "O saldo começa no total",
  "featurePage.invoicing.detail.6.body":
    "Parece óbvio e não era: com o valor predefinido começava em zero, fazendo com que cada nova fatura parecesse já estar paga.",

  // /features/payments
  "featurePage.payments.label": "Receber pagamentos",
  "featurePage.payments.headline":
    "Pagam à porta e o dinheiro entra na sua conta",
  "featurePage.payments.oneLine":
    "Cartão ou débito bancário a partir da fatura, de um sinal ou do portal do cliente, com liquidação na sua própria conta bancária — uma única taxa deduzida de cada pagamento e nada faturado separadamente.",
  "featurePage.payments.description":
    "Pagamentos por cartão e débito bancário que entram na conta bancária do próprio prestador com uma única taxa de processamento, sinais e pagamentos por fases, um portal do cliente que mostra o que está em dívida, reembolsos a partir da fatura e planos de manutenção recorrentes.",
  "featurePage.payments.imageCaption":
    "A lista de faturas tal como o escritório a vê: o que está por pagar, o que foi pago e aquela que está doze dias em atraso.",
  "featurePage.payments.imageAlt":
    "A lista de Faturas: valores por pagar, pagos e total faturado no topo, seguida de três faturas — uma enviada, uma paga e uma vencida com os dias de atraso",
  "featurePage.payments.section.invoice.heading":
    "Um clique a partir do orçamento aprovado, pago através da ligação",
  "featurePage.payments.section.invoice.body":
    "A fatura é criada a partir do orçamento, por isso diz aquilo que o orçamento dizia. É enviada num email a partir do seu endereço com um botão para pagar agora; o cliente paga pelo telemóvel e o histórico de pagamentos fica na fatura, com a taxa apresentada ao lado do valor que chegou ao seu banco.",
  "featurePage.payments.section.invoice.bullet.1":
    "Enviada por email a partir do seu endereço, com uma ligação para a fatura e um botão de pagamento",
  "featurePage.payments.section.invoice.bullet.2":
    "Dinheiro ou transferência eletrónica que já recebeu é descontado antes de o cartão ser cobrado",
  "featurePage.payments.section.invoice.bullet.3":
    "O pagamento, a taxa e o depósito na sua conta bancária, registados na fatura",
  "featurePage.payments.section.invoice.alt":
    "Uma fatura marcada como Totalmente paga: as linhas do orçamento, o conteúdo da fatura, o total e um saldo em dívida de zero",
  "featurePage.payments.section.fees.heading":
    "Uma única taxa, deduzida antes de o dinheiro chegar — nunca uma fatura",
  "featurePage.payments.section.fees.body":
    "Um pagamento por cartão custa 3% + $0.30. O débito bancário é mais barato: 1% + $0.40 com um máximo de $5.00 no Canadá, 0.8% com um máximo de $5.00 nos EUA — numa fatura de $5,000 são $5 em vez de $150. A taxa é deduzida de cada pagamento antes de o dinheiro chegar ao seu banco. Não existe mensalidade e nada é faturado separadamente.",
  "featurePage.payments.section.fees.bullet.1":
    "Cartões 3% + $0.30; débito bancário canadiano 1% + $0.40 (máx. $5.00); débito bancário nos EUA 0.8% (máx. $5.00)",
  "featurePage.payments.section.fees.bullet.2":
    "Um cartão internacional acrescenta 0.8% e uma conversão de moeda 2%, apenas quando aplicável",
  "featurePage.payments.section.fees.bullet.3":
    "A transferência imediata para a sua conta bancária é opcional, a 1% — a transferência normal não exige qualquer ativação",
  "featurePage.payments.section.fees.alt":
    "As definições de Pagamentos: Stripe ligada, seguida das taxas de processamento — pagamentos por cartão, débito bancário, cartão internacional e conversão de moeda — com o custo de cada uma",
  "featurePage.payments.section.deposits.heading":
    "Sinais e pagamentos por fases, no orçamento que o cliente assina",
  "featurePage.payments.section.deposits.body":
    "Peça um sinal para reservar o tempo de oficina e o saldo na instalação, ou divida um trabalho longo em fases. As condições aparecem no orçamento que o cliente aprova, cada fase é solicitada segundo o seu calendário e o cliente pode pagar qualquer uma por débito bancário através do portal, não apenas a fatura final.",
  "featurePage.payments.section.deposits.bullet.1":
    "Condições de pagamento impressas no orçamento, junto ao total que o cliente assina",
  "featurePage.payments.section.deposits.bullet.2":
    "Cada fase é solicitada quando vence — paga por cartão através da ligação ou por débito bancário através do portal",
  "featurePage.payments.section.deposits.bullet.3":
    "Um sinal já pago é automaticamente deduzido da fatura final",
  "featurePage.payments.section.deposits.alt":
    "A parte inferior da página de aprovação do orçamento de um cliente: condições de pagamento de 50% de sinal para reservar o tempo de oficina e 50% na instalação, o total e os botões Aprovar e Recusar",
  "featurePage.payments.section.portal.heading":
    "Uma ligação para tudo o que devem",
  "featurePage.payments.section.portal.body":
    "O portal do cliente é uma única ligação por cliente — sem conta para criar e sem palavra-passe para esquecer. Mostra o saldo em dívida, todas as faturas com o respetivo botão de pagamento e todos os orçamentos com o respetivo estado, sob o nome da sua empresa e de mais ninguém.",
  "featurePage.payments.section.portal.bullet.1":
    "Saldo em dívida no topo, seguido das faturas e dos orçamentos",
  "featurePage.payments.section.portal.bullet.2":
    "Pagamento a partir do portal por cartão ou débito bancário",
  "featurePage.payments.section.portal.bullet.3":
    "O seu nome, o seu logótipo — a página nunca diz FieldQuo",
  "featurePage.payments.section.portal.alt":
    "O portal do cliente: o saldo em dívida, uma fatura com um botão Pagar e dois orçamentos — um aprovado e um recusado",
  "featurePage.payments.section.chase.heading":
    "Lembretes e reembolsos, a partir da própria fatura",
  "featurePage.payments.section.chase.body":
    "Uma fatura vencida indica quantos dias está em atraso e quanto continua em dívida. Faça o seguimento com um clique através de uma mensagem no idioma do cliente, ou deixe as regras de seguimento definidas por si fazê-lo automaticamente. Um reembolso, total ou parcial, é emitido a partir da mesma fatura e regressa ao cartão ou conta de origem.",
  "featurePage.payments.section.chase.bullet.1":
    "Faça o seguimento a partir da fatura: uma mensagem curta, enviada no idioma do cliente",
  "featurePage.payments.section.chase.bullet.2":
    "Lembretes automáticos segundo o calendário definido por si, com as suas palavras",
  "featurePage.payments.section.chase.bullet.3":
    "Reembolse o pagamento total ou parcialmente a partir da fatura — a taxa de processamento não é devolvida, tal como acontece com qualquer processador de cartões",
  "featurePage.payments.section.chase.alt":
    "Uma fatura vencida com a janela de seguimento do pagamento aberta: uma mensagem para o cliente e um botão Enviar lembrete",
  "featurePage.payments.pain.1.pain":
    "O cheque está no correio, e está no correio há cinco semanas.",
  "featurePage.payments.pain.1.fix":
    "A fatura inclui uma ligação de pagamento. Pagam pelo telemóvel antes de acabar de carregar a carrinha.",
  "featurePage.payments.pain.2.pain":
    "As taxas de cartão num trabalho de $5,000 têm um impacto real.",
  "featurePage.payments.pain.2.fix":
    "Disponibilize débito bancário na mesma fatura: 1% com um máximo de $5.00 no Canadá, 0.8% com um máximo de $5.00 nos EUA, em vez de 3% + $0.30 num cartão.",
  "featurePage.payments.pain.3.pain":
    "Cobrar dinheiro significa ligar a pessoas de quem gosta para lhes pedir dinheiro.",
  "featurePage.payments.pain.3.fix":
    "O cliente pode abrir uma única ligação e ver todos os orçamentos, todas as faturas e exatamente quanto continua por pagar — e a fatura vencida faz o seu próprio seguimento segundo o seu calendário.",
  "featurePage.payments.pain.4.pain":
    "Os clientes de manutenção são faturados quando se lembra, o que não acontece todos os meses.",
  "featurePage.payments.pain.4.fix":
    "Um plano recorrente cobra o cartão ou a conta bancária segundo o calendário sem ter de pedir nada a ninguém.",
  "featurePage.payments.how.1.step": "O dinheiro vai para a sua conta",
  "featurePage.payments.how.1.body":
    "Liga a sua própria conta bancária uma vez. Os pagamentos dos clientes entram diretamente na sua conta; a taxa de processamento é deduzida de cada pagamento antes de chegar, e nada lhe é faturado separadamente.",
  "featurePage.payments.how.2.step": "Os sinais são tratados corretamente",
  "featurePage.payments.how.2.body":
    "Um cliente que já pagou um sinal é solicitado a pagar o saldo, não o valor total uma segunda vez — e um sinal também pode ser pago por débito bancário.",
  "featurePage.payments.how.3.step": "Uma ligação para tudo o que devem",
  "featurePage.payments.how.3.body":
    "O portal é uma única ligação por cliente — sem conta para criar e sem palavra-passe para esquecer.",
  "featurePage.payments.detail.1.label": "O dinheiro vai para a sua conta",
  "featurePage.payments.detail.1.body":
    "A cobrança é encaminhada para a sua própria conta ligada. A taxa de processamento é deduzida de cada pagamento antes de chegar ao seu banco — nunca é faturada separadamente e não existe mensalidade.",
  "featurePage.payments.detail.2.label": "Qual é a taxa",
  "featurePage.payments.detail.2.body":
    "Cartões 3% + $0.30. Débito bancário 1% + $0.40 com um máximo de $5.00 no Canadá e 0.8% com um máximo de $5.00 nos EUA. Um cartão internacional acrescenta 0.8% e uma conversão de moeda 2%, apenas quando aplicável. A transferência imediata é opcional a 1%.",
  "featurePage.payments.detail.3.label":
    "O dinheiro que já recebeu é descontado do valor do cartão",
  "featurePage.payments.detail.3.body":
    "O cliente paga o saldo, não o total, para que um sinal recebido em dinheiro ou por transferência e registado manualmente não seja cobrado uma segunda vez.",
  "featurePage.payments.detail.4.label":
    "Uma fatura paga é recusada em vez de gerar um erro",
  "featurePage.payments.detail.4.body":
    "Pedir uma ligação de pagamento para um saldo de zero é recusado em linguagem simples, em vez de ser enviado para o processador de cartões e falhar à frente de alguém.",
  "featurePage.payments.detail.5.label": "Um rascunho não pode ser pago",
  "featurePage.payments.detail.5.body":
    "A ligação do cliente verifica na mesma leitura que a fatura lhe pertence e que foi realmente emitida, para que um número adivinhado não abra uma página de pagamento.",
  "featurePage.payments.detail.6.label": "A moeda segue a sua empresa",
  "featurePage.payments.detail.6.body":
    "O checkout abre na moeda da sua própria empresa, determinada pelo país com que se registou, em vez de utilizar um valor predefinido escolhido por outra pessoa.",

  // /features/financing
  "featurePage.financing.label": "Financiamento para clientes",
  "featurePage.financing.headline":
    "Deixe o proprietário distribuir o custo de um trabalho grande",
  "featurePage.financing.oneLine":
    "Os seus clientes podem pagar parcelado com o Klarna — ou com o Affirm, apenas onde a Stripe aprova a sua empresa para isso. Recebe o valor total adiantado, descontadas as taxas, nos trabalhos que eles adiariam mais um ano.",
  "featurePage.financing.description":
    "Ofereça aos seus clientes pagamento parcelado com o Klarna através da Stripe e receba o valor total adiantado, descontadas as taxas — incluído, sem mais nada a subscrever.",
  "featurePage.financing.pain.1.pain":
    "A cozinha completa é o trabalho que quer, mas o proprietário continua a adiá-la para o próximo ano.",
  "featurePage.financing.pain.1.fix":
    "É apresentada uma forma de pagar parcelado no momento do pagamento, em vez de lhe ser pedido o valor total de uma só vez.",
  "featurePage.financing.pain.2.pain":
    "Cada empresa de financiamento quer a sua própria candidatura, contrato e portal.",
  "featurePage.financing.pain.2.fix":
    "Funciona na conta Stripe que já ligou. Um interruptor nas Definições e, assim que a Stripe o ativar, está na sua página de pagamento.",
  "featurePage.financing.pain.3.pain":
    "Indica um valor mensal ao telefone e depois fica preso a uma taxa que ninguém na sua empresa alguma vez aprovou.",
  "featurePage.financing.pain.3.fix":
    "O FieldQuo nunca inventa um valor mensal. Se aparecer um valor no orçamento, foi calculado a partir da taxa e do prazo que introduziu.",
  "featurePage.financing.how.1.step":
    "Klarna no pagamento, através da sua própria conta",
  "featurePage.financing.how.1.body":
    "Ative o pagamento parcelado e, assim que a Stripe o ativar para a sua empresa, a sua página de pagamento apresenta o Klarna juntamente com o cartão — e o Affirm, apenas onde a Stripe aprova a sua empresa para isso. Funciona através da conta Stripe onde o seu dinheiro já entra, por isso não existe uma segunda candidatura, um novo contrato ou outro fornecedor financeiro com quem se registar.",
  "featurePage.financing.how.2.step": "O valor total, pago adiantado",
  "featurePage.financing.how.2.body":
    "O valor total, descontadas as taxas, é-lhe pago adiantado; recebe-o segundo o seu calendário habitual de pagamentos (o Affirm pode demorar até dois dias úteis a liquidar). O fornecedor cobra as prestações ao seu cliente, por isso não tem de andar atrás dele nem de financiar o trabalho do seu próprio bolso.",
  "featurePage.financing.how.3.step":
    "Sem taxas de juro para indicar, sem prestações para cobrar",
  "featurePage.financing.how.3.body":
    "O fornecedor mostra ao cliente os seus próprios planos e toma a sua própria decisão sobre a aprovação. Nunca indica uma taxa de juro nem anda atrás de uma prestação — e se um cliente não conseguir pagar ao Klarna, o prejuízo é do Klarna. A FieldQuo não imprime um valor mensal no seu orçamento a menos que tenha introduzido a taxa e o prazo.",
  "featurePage.financing.detail.1.label":
    "Só o que a Stripe ativou",
  "featurePage.financing.detail.1.body":
    "O pagamento parcelado só é oferecido quando o ativou, a Stripe ativou o Klarna — ou o Affirm, apenas onde a Stripe aprova a sua empresa para isso — na sua conta, e o valor está dentro do intervalo desse fornecedor, em dólares canadianos ou americanos.",
  "featurePage.financing.detail.2.label":
    "Desligado é desligado",
  "featurePage.financing.detail.2.body":
    "Com o pagamento parcelado desligado, o seu link de pagamento usa uma configuração sem ele, por isso um fornecedor ativado na sua conta Stripe não aparece quando disse que não.",
  "featurePage.financing.detail.3.label":
    "A resposta da Stripe, nas suas definições",
  "featurePage.financing.detail.3.body":
    "O estado de cada fornecedor é lido da sua conta Stripe e mostrado nas Definições, com o motivo quando a Stripe não o ativou — e aos seus clientes só é oferecido um fornecedor ativo.",
  "featurePage.financing.detail.4.label":
    "Sem condições, não existe valor mensal",
  "featurePage.financing.detail.4.body":
    "Não existe uma taxa assumida nem um prazo típico. A menos que introduza a sua própria taxa e o seu próprio prazo, não aparece qualquer valor mensal num orçamento.",
  "featurePage.financing.detail.5.label":
    "Um pagamento que arredonda para menos de meio cêntimo não é nada",
  "featurePage.financing.detail.5.body":
    "Não é apresentado qualquer valor, em vez de um zero confiante — uma prestação mensal de nada seria uma promessa que nenhum financiador cumpriria.",

  // /features/invoice-changes
  "featurePage.invoice-changes.label": "Alterações de faturas, registadas",
  "featurePage.invoice-changes.headline":
    "Altere uma fatura emitida sem perder aquela que o cliente já tem",
  "featurePage.invoice-changes.oneLine":
    "Uma fatura que já saiu nunca é editada diretamente: a alteração cria uma nova versão com o mesmo número e a anterior permanece exatamente como estava.",
  "featurePage.invoice-changes.description":
    "Alterar uma fatura emitida cria uma nova versão com o mesmo número de fatura, mantendo a versão anterior e a razão da alteração, para que nunca haja dúvidas sobre aquilo que foi acordado.",
  "featurePage.invoice-changes.pain.1.pain":
    "Corrige uma fatura e agora o cliente está a ler um documento diferente daquele que você está a ver.",
  "featurePage.invoice-changes.pain.1.fix":
    "A versão anterior é mantida. Ambos conseguem ver o que mudou, quando e porquê.",
  "featurePage.invoice-changes.pain.2.pain":
    "Alguém pergunta o que dizia o original e a resposta verdadeira é que já não sabe.",
  "featurePage.invoice-changes.pain.2.fix":
    "Cada versão inclui uma razão, um nome e uma hora.",
  "featurePage.invoice-changes.pain.3.pain":
    "Editar uma fatura altera silenciosamente o número e agora o seu contabilista tem duas.",
  "featurePage.invoice-changes.pain.3.fix":
    "O número não muda. A versão dois de uma fatura continua a ser essa mesma fatura.",
  "featurePage.invoice-changes.how.1.step":
    "Os rascunhos são editados; as faturas emitidas recebem versões",
  "featurePage.invoice-changes.how.1.body":
    "Enquanto for um rascunho, altera-o diretamente. Assim que deixa de ser rascunho, uma alteração cria uma nova versão em vez de substituir aquilo que alguém já tem.",
  "featurePage.invoice-changes.how.2.step": "O número permanece igual",
  "featurePage.invoice-changes.how.2.body":
    "Uma nova versão mantém o mesmo número de fatura e apresenta um número de versão ao lado, para que qualquer cópia continue a representar a mesma fatura.",
  "featurePage.invoice-changes.how.3.step": "Nada é perdido na cópia",
  "featurePage.invoice-changes.how.3.body":
    "Se o imposto se aplica, o idioma em que foi escrita, as fotografias e os custos associados são todos deliberadamente transferidos — perder qualquer um deles alteraria silenciosamente o documento.",
  "featurePage.invoice-changes.detail.1.label": "A razão fica registada",
  "featurePage.invoice-changes.detail.1.body":
    "Uma alteração inclui a razão indicada, quem a fez e quando. Se não for indicada uma razão, é registada como uma atualização em vez de ficar em branco.",
  "featurePage.invoice-changes.detail.2.label":
    "Apenas um rascunho pode ser eliminado",
  "featurePage.invoice-changes.detail.2.body":
    "Eliminar qualquer documento emitido é recusado. Não existe qualquer estado em que uma fatura enviada desapareça.",
  "featurePage.invoice-changes.detail.3.label":
    "Associar um trabalho não cria uma versão",
  "featurePage.invoice-changes.detail.3.body":
    "Associar um trabalho grava deliberadamente a ligação diretamente — criar uma versão faria uma segunda cópia da fatura sempre que alguém organizasse uma.",
  "featurePage.invoice-changes.detail.4.label":
    "Um trabalho pertencente a outro cliente é recusado",
  "featurePage.invoice-changes.detail.4.body":
    "Associá-lo colocaria as horas de outra pessoa na margem deste trabalho.",
  "featurePage.invoice-changes.detail.5.label":
    "Os avisos são calculados, não armazenados",
  "featurePage.invoice-changes.detail.5.body":
    "Vencida, parcialmente paga e alterada são condições determinadas quando a fatura é lida, para que um indicador armazenado nunca possa discordar do dinheiro.",

  // /features/client-portal
  "featurePage.client-portal.label": "Portal do cliente",
  "featurePage.client-portal.headline":
    "Uma ligação onde podem ver tudo o que lhes enviou",
  "featurePage.client-portal.oneLine":
    "Orçamentos, faturas e o que continua por pagar, numa única página com as suas cores, sem o cliente ter de criar uma conta ou lembrar-se de uma palavra-passe.",
  "featurePage.client-portal.description":
    "Uma ligação privada onde um cliente vê os seus orçamentos, faturas e saldo em dívida com a sua marca, sem conta para criar e sem nada disponibilizado aos motores de pesquisa.",
  "featurePage.client-portal.pain.1.pain":
    "Pode reenviar a fatura? é metade da sua caixa de entrada.",
  "featurePage.client-portal.pain.1.fix":
    "O cliente tem uma ligação e esta mostra sempre a situação atual, não a versão que anexou da última vez.",
  "featurePage.client-portal.pain.2.pain":
    "Obrigar um proprietário a criar uma palavra-passe para ver a própria fatura é uma boa forma de perder o pagamento.",
  "featurePage.client-portal.pain.2.fix":
    "Não existe conta nem palavra-passe. É uma ligação que funciona para essa pessoa e para mais ninguém.",
  "featurePage.client-portal.pain.3.pain":
    "Um botão de pagamento que falha sob o seu logótipo é pior do que não ter botão.",
  "featurePage.client-portal.pain.3.fix":
    "O botão Pagar só aparece quando é realmente possível aceitar um cartão. Caso contrário, a página indica como lhe pagar.",
  "featurePage.client-portal.how.1.step": "Uma ligação, não uma conta",
  "featurePage.client-portal.how.1.body":
    "O endereço é longo e aleatório, e a página pede aos motores de pesquisa que a ignorem. Nada nele pode ser adivinhado a partir do nome do cliente.",
  "featurePage.client-portal.how.2.step": "Apenas aquilo que realmente enviou",
  "featurePage.client-portal.how.2.body":
    "Orçamentos em rascunho e faturas não emitidas não aparecem, e uma fatura conta como enviada quando o email foi aceite para entrega, não quando alguém carregou num botão.",
  "featurePage.client-portal.how.3.step": "O idioma deles, a sua moeda",
  "featurePage.client-portal.how.3.body":
    "A página utiliza primeiro o idioma do cliente, depois o idioma predefinido da sua empresa e depois inglês — e os valores são apresentados na sua moeda em vez de numa moeda predefinida.",
  "featurePage.client-portal.detail.1.label":
    "Nada sobre a sua configuração de pagamentos chega ao navegador",
  "featurePage.client-portal.detail.1.body":
    "A página apenas recebe a informação sobre se é possível aceitar um cartão. Os dados da sua conta de pagamentos nunca chegam ao navegador.",
  "featurePage.client-portal.detail.2.label":
    "Resíduos de arredondamento não criam uma dívida",
  "featurePage.client-portal.detail.2.body":
    "Um saldo só conta como devido acima de meio cêntimo, para que um resto de arredondamento nunca mostre ao cliente um botão Pagar sem haver nada para pagar.",
  "featurePage.client-portal.detail.3.label":
    "A frase sobre impostos fica associada à data do documento",
  "featurePage.client-portal.detail.3.body":
    "Uma fatura explica o imposto de acordo com o dia em que foi emitida, para que uma alteração da taxa no mês passado não volte a explicar uma fatura mais antiga.",
  "featurePage.client-portal.detail.4.label":
    "As suas definições fiscais continuam a ser suas",
  "featurePage.client-portal.detail.4.body":
    "A página inclui o tipo de imposto cobrado e a região assumida. A sua taxa, o seu registo fiscal e a sua preferência de imposto local não são enviados.",
  "featurePage.client-portal.detail.5.label":
    "A regra sobre aquilo que podem ver existe num único local",
  "featurePage.client-portal.detail.5.body":
    "É decidida do nosso lado, uma única vez. Uma segunda cópia dessa regra no navegador seria a cópia que acabaria por ficar desatualizada.",

  // /features/sales-tax
  "featurePage.sales-tax.label": "Imposto sobre vendas por morada",
  "featurePage.sales-tax.headline":
    "O imposto certo para o local do trabalho, ou uma recusa honesta",
  "featurePage.sales-tax.oneLine":
    "Defina as suas taxas uma vez e a correta aparece no documento para a morada onde o trabalho é realizado — e quando não é possível ter certeza, isso é indicado em vez de ser inventado um valor.",
  "featurePage.sales-tax.description":
    "Imposto sobre vendas determinado a partir da morada do trabalho: primeiro as suas próprias taxas identificadas, depois as tabelas de referência para o Canadá, os EUA e países com IVA, com um aviso explícito sempre que a resposta estiver incompleta.",
  "featurePage.sales-tax.pain.1.pain":
    "Trabalha em duas províncias e a taxa no orçamento é aquela que introduziu da última vez.",
  "featurePage.sales-tax.pain.1.fix":
    "A taxa segue a morada onde o trabalho é realizado, não o último documento que por acaso escreveu.",
  "featurePage.sales-tax.pain.2.pain":
    "O software fiscal assume silenciosamente uma taxa e só descobre no final do ano.",
  "featurePage.sales-tax.pain.2.fix":
    "Quando a resposta não é certa, isso é indicado por palavras no documento — não numa nota de rodapé que ninguém lê.",
  "featurePage.sales-tax.pain.3.pain":
    "Um orçamento é enviado com o imposto ativado e sem nada cobrado, e ninguém repara durante um mês.",
  "featurePage.sales-tax.pain.3.fix":
    "Essa combinação é recusada no momento do envio, indicando os campos em falta.",
  "featurePage.sales-tax.how.1.step": "As suas próprias taxas têm prioridade",
  "featurePage.sales-tax.how.1.body":
    "Se definiu uma taxa com um nome que corresponde à província do cliente, essa é a taxa utilizada. As tabelas de referência são a alternativa, não a autoridade principal — e a correspondência é feita por palavras completas, para que uma taxa com o nome de uma província não seja associada a uma cidade que por acaso contenha as mesmas letras.",
  "featurePage.sales-tax.how.2.step":
    "Depois vêm as tabelas, por uma ordem fixa",
  "featurePage.sales-tax.how.2.body":
    "Num país com IVA, é o seu próprio país que determina a regra, porque é assim que funciona o fornecimento a um proprietário. Caso contrário, é o país do cliente que decide: no Canadá é determinada uma taxa combinada real, enquanto nos EUA a taxa base do estado é apresentada para informação e é aplicada a sua própria taxa predefinida — porque os impostos distritais não estão incluídos, e dizer isso é a resposta honesta.",
  "featurePage.sales-tax.how.3.step": "Uma data, não apenas um local",
  "featurePage.sales-tax.how.3.body":
    "As taxas são guardadas juntamente com as datas a partir das quais se aplicaram, para que um documento emitido no ano passado nunca seja recalculado com a taxa deste ano.",
  "featurePage.sales-tax.detail.1.label": "Duas letras, ou nada",
  "featurePage.sales-tax.detail.1.body":
    "Um país é representado por um código de duas letras. Escrever a palavra Canada num campo é recusado em vez de ser parcialmente interpretado, porque o campo é preenchido através de uma pesquisa de morada ou de um seletor.",
  "featurePage.sales-tax.detail.2.label":
    "Não registado é uma declaração; desconhecido não é",
  "featurePage.sales-tax.detail.2.body":
    "Uma empresa que declarou não estar registada cobra zero como posição explícita. Uma empresa que nunca declarou nada cobra a sua taxa predefinida e fica marcada como desconhecida, porque uma taxa zero não é uma declaração.",
  "featurePage.sales-tax.detail.3.label":
    "A componente provincial não é silenciosamente removida",
  "featurePage.sales-tax.detail.3.body":
    "Quando a componente provincial pode não se aplicar a trabalhos em bens imóveis, é apresentado um aviso em vez de a taxa ser silenciosamente reduzida. Isso é um facto sobre o trabalho, não sobre a morada.",
  "featurePage.sales-tax.detail.4.label":
    "As taxas reduzidas para trabalhos de construção nunca são inferidas",
  "featurePage.sales-tax.detail.4.body":
    "Quando um país tem uma taxa mais baixa para trabalhos de renovação, esta só é aplicada quando o trabalho é declarado como renovação.",
  "featurePage.sales-tax.detail.5.label":
    "Uma suposição é identificada como tal",
  "featurePage.sales-tax.detail.5.body":
    "Quando o registo do cliente não permite determinar a região e é utilizada a província ou o estado da sua própria empresa, o documento indica que a região foi assumida — e apenas quando essa suposição tiver efetivamente determinado a taxa.",
  "featurePage.sales-tax.detail.6.label":
    "Imposto ativo, nenhum valor cobrado e nenhuma explicação",
  "featurePage.sales-tax.detail.6.body":
    "O envio é recusado no momento em que é efetuado, com a indicação dos campos em falta. Não existe uma opção para confirmar e enviar na mesma.",

  // /features/reporting
  "featurePage.reporting.label": "Os seus números",
  "featurePage.reporting.headline":
    "Saiba como está o ano, sem ter de criar uma folha de cálculo",
  "featurePage.reporting.oneLine":
    "Orçamentado, ganho, agendado e por receber num único ecrã, juntamente com o seu ponto de equilíbrio, o seu objetivo e a forma como os seus preços se comparam com os do seu setor.",
  "featurePage.reporting.description":
    "Relatórios para prestadores de serviços: um painel com valores orçamentados, ganhos, agendados e por receber, um preço de equilíbrio calculado a partir dos custos gerais reais e uma referência anónima de preços.",
  "featurePage.reporting.pain.1.pain":
    "Só descobre que o trimestre correu mal quando o contabilista lhe diz em março.",
  "featurePage.reporting.pain.1.fix":
    "Orçamentado, ganho, agendado e por receber estão num único ecrã, atualizados até esta manhã.",
  "featurePage.reporting.pain.2.pain":
    "Não faz ideia se os seus preços são normais ou se é o mais barato da cidade por uma diferença de um terço.",
  "featurePage.reporting.pain.2.fix":
    "As suas tarifas e a sua taxa de sucesso são comparadas com outras empresas do seu setor, sem identificar ninguém — incluindo a sua empresa.",
  "featurePage.reporting.pain.3.pain":
    "Os gráficos não lhe dizem nada em que possa agir antes de acabar o café.",
  "featurePage.reporting.pain.3.fix":
    "Uma vez por mês, os números são apresentados em frases, explicando o que mudou e o que isso significa.",
  "featurePage.reporting.how.1.step":
    "São os seus próprios dados, e apenas os seus",
  "featurePage.reporting.how.1.body":
    "A comparação é agregada. Os números de nenhuma outra empresa lhe são mostrados, e os seus nunca são mostrados a outras empresas.",
  "featurePage.reporting.how.2.step":
    "Os custos gerais são um valor real, não uma percentagem",
  "featurePage.reporting.how.2.body":
    "Os custos fixos, a dívida e as despesas da empresa produzem o valor que um dia de trabalho tem de gerar antes de começar a ganhar dinheiro.",
  "featurePage.reporting.how.3.step":
    "Um custo médio por lead, não uma estimativa",
  "featurePage.reporting.how.3.body":
    "Registe quanto gasta por canal e veja um único número real — o gasto total dividido pelos leads reais de toda a empresa. Não lhe dirá qual canal está a funcionar; dir-lhe-á quanto custa o conjunto.",

  // /features/payroll
  "featurePage.payroll.label": "Processamento salarial e pagamentos",
  "featurePage.payroll.headline":
    "As horas aprovadas tornam-se num processamento salarial",
  "featurePage.payroll.oneLine":
    "As folhas de horas que aprovou transformam-se em remuneração bruta e num recibo de vencimento por pessoa — e um prestador de serviços da equipa pode receber diretamente na sua conta bancária.",
  "featurePage.payroll.description":
    "Processamento salarial a partir de folhas de horas aprovadas: remuneração bruta e um recibo de vencimento em PDF por pessoa, além de transferências bancárias para prestadores de serviços da equipa — com os limites claramente indicados.",
  "featurePage.payroll.pain.1.pain":
    "O processamento salarial começa a tentar perceber a caligrafia de cinco pessoas e acaba à meia-noite.",
  "featurePage.payroll.pain.1.fix":
    "As horas já estão registadas, já estão associadas aos trabalhos e já foram aprovadas por si.",
  "featurePage.payroll.pain.2.pain":
    "As horas no recibo de vencimento e as horas nos custos do trabalho são dois números diferentes vindos de dois sistemas diferentes.",
  "featurePage.payroll.pain.2.fix":
    "São exatamente as mesmas horas. O processamento salarial é criado a partir das folhas de horas utilizadas nos custos do trabalho.",
  "featurePage.payroll.pain.3.pain":
    "Pagar a um prestador de serviços da equipa é uma transferência separada que faz manualmente e depois se esquece de registar.",
  "featurePage.payroll.pain.3.fix":
    "As horas aprovadas são pagas através de uma transferência real para a conta bancária do prestador, registada no processamento.",
  "featurePage.payroll.how.1.step": "Nada é pago sem a sua aprovação",
  "featurePage.payroll.how.1.body":
    "As horas têm de ser aprovadas antes de poderem entrar num processamento salarial. A aprovação é a condição de entrada, e é a única.",
  "featurePage.payroll.how.2.step":
    "Os recibos de vencimento são gerados pelo processamento",
  "featurePage.payroll.how.2.body":
    "O processamento gera um recibo de vencimento para cada pessoa, em PDF, que pode descarregar e entregar.",
  "featurePage.payroll.how.3.step": "Veja exatamente o que isto não faz",
  "featurePage.payroll.how.3.body":
    "O FieldQuo não é um serviço de processamento salarial e não pretende ser. Os limites exatos — impostos, declarações, moedas — estão descritos abaixo.",
  "featurePage.payroll.detail.1.label":
    "Remuneração bruta e as designações para o restante",
  "featurePage.payroll.detail.1.body":
    "Não existem tabelas fiscais aqui. Os nomes das deduções seguem o seu país — imposto sobre o rendimento, CPP e EI, ou imposto federal, Social Security e Medicare — e cada valor é fornecido por si ou pelo seu contabilista.",
  "featurePage.payroll.detail.2.label": "Os escalões são fornecidos por si",
  "featurePage.payroll.detail.2.body":
    "O imposto progressivo é calculado anualizando a remuneração bruta do período, percorrendo os escalões fornecidos pelo seu contabilista e dividindo novamente pelo período. Os escalões são seus.",
  "featurePage.payroll.detail.3.label":
    "Horas extraordinárias a uma vez e meia",
  "featurePage.payroll.detail.3.body":
    "Por predefinição, acima de quarenta horas por semana, e o limite ajusta-se ao período — oitenta horas regulares em duas semanas, não quarenta.",
  "featurePage.payroll.detail.4.label":
    "Um recibo de vencimento nunca pode ser negativo",
  "featurePage.payroll.detail.4.body":
    "O valor líquido tem como mínimo zero e a linha é sinalizada. Qualquer processamento que contenha uma linha sinalizada é recusado até alguém a verificar.",
  "featurePage.payroll.detail.5.label":
    "Pagar duas vezes o mesmo período de duas semanas é detetado",
  "featurePage.payroll.detail.5.body":
    "Um processamento sobreposto e um período que não corresponda ao seu ciclo de pagamento são ambos assinalados antes da aprovação e recusados no momento da aprovação — continuando, no entanto, a ser permitido criar deliberadamente um processamento de correção.",
  "featurePage.payroll.detail.6.label": "Não deduzido não é o mesmo que zero",
  "featurePage.payroll.detail.6.body":
    "Um recibo de vencimento apresenta apenas as deduções calculadas para essa pessoa. Se não houver nenhuma configurada, isso é indicado e são apresentados os valores brutos, porque não deduzimos isto e não deduzimos nada são afirmações diferentes.",

  // /features/price-book
  "featurePage.price-book.label": "A sua tabela de preços",
  "featurePage.price-book.headline":
    "Os seus preços num único lugar, para que todos os orçamentos utilizem os mesmos valores",
  "featurePage.price-book.oneLine":
    "Serviços, tarifas, custos de materiais e quanto de cada material um trabalho consome — importados de uma folha de cálculo, sem voltar a introduzir tudo.",
  "featurePage.price-book.description":
    "Uma tabela de preços para prestadores de serviços: serviços e tarifas, custos e fórmulas de materiais, importação de folhas de cálculo e impostos determinados pela morada.",
  "featurePage.price-book.pain.1.pain":
    "Cada pessoa que prepara orçamentos atribui um preço diferente ao mesmo trabalho, e só descobre quando dois vizinhos comparam os orçamentos.",
  "featurePage.price-book.pain.1.fix":
    "Existe um único conjunto de tarifas, e todos os orçamentos são criados a partir dele.",
  "featurePage.price-book.pain.2.pain":
    "Os custos dos materiais aumentaram na primavera e os seus preços não.",
  "featurePage.price-book.pain.2.fix":
    "Altere o custo uma vez e os trabalhos calculados a partir dele acompanham a alteração.",
  "featurePage.price-book.pain.3.pain":
    "Os seus preços estão numa folha de cálculo que não quer voltar a introduzir e que também não tem a certeza de querer partilhar.",
  "featurePage.price-book.pain.3.fix":
    "Importe tudo de uma só vez em vez de voltar a introduzir os dados. As suas tarifas determinam os seus orçamentos e os de mais ninguém.",
  "featurePage.price-book.how.1.step":
    "Tarifas por serviço, agrupadas da forma como trabalha",
  "featurePage.price-book.how.1.body":
    "Os serviços ficam organizados nas suas próprias categorias, para que a tabela de preços seja apresentada da forma como fala sobre o trabalho, e não da forma como uma base de dados o organiza.",
  "featurePage.price-book.how.2.step": "Fórmulas, não apenas preços unitários",
  "featurePage.price-book.how.2.body":
    "Quanto lhe custa um litro de tinta ou uma folha de contraplacado, e quanto desse material é consumido por um trabalho de determinada dimensão, para que o custo dos materiais seja calculado em vez de estimado.",
  "featurePage.price-book.how.3.step": "O imposto acompanha o trabalho",
  "featurePage.price-book.how.3.body":
    "Configure as suas tarifas uma vez e a tarifa correta é aplicada ao documento de acordo com a morada onde o trabalho será realizado.",
  "featurePage.price-book.detail.1.label":
    "Preços ocultos significa acesso recusado, não campos em branco",
  "featurePage.price-book.detail.1.body":
    "Quem não tiver autorização para ver preços recebe uma recusa, em vez de um catálogo de nomes sem valores. Um ecrã cheio de campos em branco parece estar avariado.",
  "featurePage.price-book.detail.2.label":
    "As categorias ocultam apenas o necessário",
  "featurePage.price-book.detail.2.body":
    "Uma categoria de serviço mantém a respetiva unidade quando os preços estão ocultos, porque por pé quadrado indica como o trabalho é medido, não quanto custa.",
  "featurePage.price-book.detail.3.label":
    "Os nomes são traduzidos ao serem introduzidos",
  "featurePage.price-book.detail.3.body":
    "Um novo serviço é traduzido para os idiomas em que envia documentos no momento em que é criado, e uma falha de tradução nunca impede que seja guardado.",
  "featurePage.price-book.detail.4.label":
    "A importação é simples, e deixa isso claro",
  "featurePage.price-book.detail.4.body":
    "Colunas separadas por vírgulas, sem campos entre aspas. As linhas sem nome são ignoradas e é-lhe indicado o número de registos efetivamente importados.",
  "featurePage.price-book.detail.5.label":
    "As substituições são limitadas e controladas",
  "featurePage.price-book.detail.5.body":
    "Apenas os campos que um setor efetivamente define podem ser substituídos, para que tudo o que não alterou continue a beneficiar das melhorias feitas aos valores predefinidos.",
  "featurePage.price-book.detail.6.label":
    "Uma definição que existia mas não fazia nada",
  "featurePage.price-book.detail.6.body":
    "Uma escolha do modelo de preços — preço fixo, por unidade ou por hora — não alterava qualquer preço. Por isso deixou de ser apresentada, em vez de permanecer no ecrã a dar a impressão de ter algum efeito.",

  // /features/branding
  "featurePage.branding.label": "O seu nome em tudo",
  "featurePage.branding.headline":
    "O proprietário não deve conseguir perceber que software utiliza",
  "featurePage.branding.oneLine":
    "O seu logótipo, a sua cor, o seu endereço no campo De e os seus termos em todos os documentos que o cliente vê.",
  "featurePage.branding.description":
    "Marca branca por predefinição: o seu logótipo e a cor da sua marca em todos os orçamentos, faturas, páginas e emails, enviados a partir do seu próprio domínio verificado.",
  "featurePage.branding.pain.1.pain":
    "Está a concorrer com outros dois pintores e os três documentos parecem claramente ter sido criados pelo mesmo software.",
  "featurePage.branding.pain.1.fix":
    "O seu orçamento apresenta o seu logótipo e a sua cor. Não existe qualquer distintivo, marca de água ou nome do fornecedor.",
  "featurePage.branding.pain.2.pain":
    "O orçamento é enviado a partir de um endereço que o cliente nunca viu e acaba no spam.",
  "featurePage.branding.pain.2.fix":
    "Verifique o seu domínio uma vez e tudo passa a ser enviado em seu nome.",
  "featurePage.branding.pain.3.pain":
    "As suas condições de pagamento estão num parágrafo que copia e cola manualmente, quando se lembra.",
  "featurePage.branding.pain.3.fix":
    "Os termos e o texto contratual são automaticamente anexados ao que envia.",
  "featurePage.branding.how.1.step": "Uma cor, medida em todo o lado",
  "featurePage.branding.how.1.body":
    "Escolhe uma cor para a marca e todas as superfícies são derivadas dessa cor. O contraste é calculado em vez de presumido, para que uma marca amarela ou cinzenta de tom médio não produza um documento impossível de ler.",
  "featurePage.branding.how.2.step": "O seu texto, secção a secção",
  "featurePage.branding.how.2.body":
    "Altere o texto do email de acompanhamento e este mantém-se no idioma em que o documento foi escrito — um documento assinado mantém as palavras com que foi assinado.",
  "featurePage.branding.how.3.step": "O seu esquema na página impressa",
  "featurePage.branding.how.3.body":
    "Escolha quais as secções que aparecem no documento e qual o esquema utilizado por predefinição.",
  "featurePage.branding.detail.1.label": "Uma cor, medida em todo o lado",
  "featurePage.branding.detail.1.body":
    "Todas as superfícies de todos os documentos derivam da única cor da sua marca, e o contraste é calculado segundo a norma de 4.5:1 em vez de ser avaliado a olho.",
  "featurePage.branding.detail.2.label":
    "Porque foi rejeitada a regra mais óbvia",
  "featurePage.branding.detail.2.body":
    "A regra se for escuro, usar branco falha nos tons médios: um laranja médio recebe texto branco com um contraste de cerca de 3:1 e torna-se ilegível à porta de casa. As duas opções são medidas e é escolhida a melhor.",
  "featurePage.branding.detail.3.label":
    "Quando o texto não pode mudar, muda o fundo",
  "featurePage.branding.detail.3.body":
    "Numa faixa de cor sólida, o fundo é progressivamente afastado da cor do texto até atingir o contraste necessário, em vez de deixar o texto num ponto em que ninguém o consegue ler.",
  "featurePage.branding.detail.4.label":
    "O cinzento é transparente quanto ao seu limite",
  "featurePage.branding.detail.4.body":
    "Uma marca em cinzento médio atinge no máximo cerca de 4.4:1 contra branco, abaixo do objetivo. O cálculo devolve o melhor resultado que conseguiu e indica que ficou aquém, em vez de fingir que passou.",
  "featurePage.branding.detail.5.label": "A mesma cor duas vezes, de propósito",
  "featurePage.branding.detail.5.body":
    "A cor da sua marca utilizada como preenchimento e a mesma cor utilizada como texto são dois valores diferentes, porque são medidas contra fundos diferentes.",
  "featurePage.branding.detail.6.label": "Verde e vermelho nunca são derivados",
  "featurePage.branding.detail.6.body":
    "Aprovado, em atraso e aviso mantêm cores fixas. Derivar o verde da cor da marca poderia fazer com que um orçamento aprovado parecesse recusado numa empresa cuja marca fosse vermelha.",

  // /features/languages
  "featurePage.languages.label": "Seis idiomas",
  "featurePage.languages.headline":
    "Envie o orçamento no idioma que o cliente realmente fala",
  "featurePage.languages.oneLine":
    "O FieldQuo foi criado em torno de seis idiomas, e cada documento mantém o idioma em que foi criado.",
  "featurePage.languages.description":
    "Seis idiomas: textos de orçamentos e faturas em inglês, francês, espanhol, ucraniano, punjabi e tagalo, mantendo cada documento no idioma em que foi escrito.",
  "featurePage.languages.pain.1.pain":
    "O inglês do cliente é suficiente para uma conversa, mas não para uma página inteira sobre o âmbito do trabalho e as condições de pagamento.",
  "featurePage.languages.pain.1.fix":
    "O orçamento e o email de acompanhamento são enviados no idioma do cliente, para que a parte que realmente importa seja uma parte que ele consegue ler.",
  "featurePage.languages.pain.2.pain":
    "Alguém envia depois uma versão traduzida e agora existem dois documentos que não dizem exatamente a mesma coisa.",
  "featurePage.languages.pain.2.fix":
    "Um documento mantém o idioma em que foi criado. Nada é traduzido automaticamente no momento do envio, por isso um PDF assinado continua a dizer exatamente aquilo que dizia.",
  "featurePage.languages.pain.3.pain":
    "Metade da sua equipa e metade dos seus clientes não partilham o mesmo idioma materno, mas o software parte do princípio de que todos partilham.",
  "featurePage.languages.pain.3.fix":
    "Os idiomas foram escolhidos para os setores profissionais — aqueles que realmente aparecem nos locais de trabalho que servimos, e não simplesmente os que têm os maiores números nacionais.",
  "featurePage.languages.how.1.step": "O documento é que decide",
  "featurePage.languages.how.1.body":
    "O email de acompanhamento utiliza o mesmo idioma do documento que acompanha. Tudo o que não estiver associado a um documento segue o idioma do próprio cliente.",
  "featurePage.languages.how.2.step":
    "Escolhidos para o setor, não a partir de uma lista",
  "featurePage.languages.how.2.body":
    "Inglês e francês devido à região onde estamos; espanhol pela sua dimensão; punjabi, tagalo e ucraniano por serem idiomas efetivamente falados nos locais de trabalho que servimos.",
  "featurePage.languages.how.3.step":
    "Transparência sobre quais estão concluídos",
  "featurePage.languages.how.3.body":
    "Dois dos seis estão concluídos e foram revistos por pessoas. Os restantes estão traduzidos e ainda estão a ser revistos por falantes desses idiomas antes de serem apresentados como concluídos — o estado de cada um está indicado abaixo.",

  // /features/fieldquo-ai
  "featurePage.fieldquo-ai.label": "FieldQuo AI",
  "featurePage.fieldquo-ai.headline":
    "Faça uma pergunta à sua própria empresa e obtenha uma resposta",
  "featurePage.fieldquo-ai.oneLine":
    "Perguntas em linguagem natural respondidas com base nos seus próprios números — além da revisão de orçamentos, do resumo mensal e das tarefas sugeridas por cada trabalho.",
  "featurePage.fieldquo-ai.description":
    "Um assistente de IA que responde a perguntas sobre a sua própria empresa com base nos seus próprios dados, revê orçamentos antes de os enviar e resume o seu mês.",
  "featurePage.fieldquo-ai.pain.1.pain":
    "A resposta está nos dados, mas encontrá-la significa criar um relatório que provavelmente só vai utilizar uma vez.",
  "featurePage.fieldquo-ai.pain.1.fix":
    "Faça a pergunta com as palavras que utilizaria numa conversa e a resposta é obtida a partir dos seus próprios registos.",
  "featurePage.fieldquo-ai.pain.2.pain":
    "Não confia num assistente que possa estar a ler os números de outra empresa ou a disponibilizar os seus a terceiros.",
  "featurePage.fieldquo-ai.pain.2.fix":
    "Só vê os dados da sua empresa. As comparações com o seu histórico utilizam exclusivamente o seu próprio histórico.",
  "featurePage.fieldquo-ai.pain.3.pain":
    "Os assistentes de uso geral respondem facilmente a perguntas sobre as quais nada sabem.",
  "featurePage.fieldquo-ai.pain.3.fix":
    "Este recusa. Responde sobre a sua empresa e recusa tudo o resto em vez de inventar uma resposta.",
  "featurePage.fieldquo-ai.how.1.step": "Lê os seus registos para responder",
  "featurePage.fieldquo-ai.how.1.body":
    "As perguntas sobre orçamentos, trabalhos, faturas e dinheiro são respondidas a partir dos seus próprios registos, por isso qualquer número apresentado é um número que poderia encontrar por si próprio.",
  "featurePage.fieldquo-ai.how.2.step": "Aparece onde o trabalho acontece",
  "featurePage.fieldquo-ai.how.2.body":
    "O mesmo modelo revê um orçamento antes de o enviar, propõe as tarefas necessárias para um trabalho desse tipo e resume o seu mês em frases.",
  "featurePage.fieldquo-ai.how.3.step": "A utilização é medida e visível",
  "featurePage.fieldquo-ai.how.3.body":
    "Cada pedido à IA é contabilizado na sua conta, para que o custo seja um número que pode ver em vez de uma surpresa.",
  "featurePage.fieldquo-ai.detail.1.label":
    "Nove coisas que pode consultar, e nenhuma delas altera nada",
  "featurePage.fieldquo-ai.detail.1.body":
    "Taxa de conversão, principais clientes, fluxo de caixa, lucro por categoria, taxa de clientes recorrentes, próximos trabalhos e pesquisa de um orçamento, uma fatura ou um trabalho. Não existe nenhuma função que crie, edite ou envie.",
  "featurePage.fieldquo-ai.detail.2.label":
    "Só conhece aquilo que tem autorização para ver",
  "featurePage.fieldquo-ai.detail.2.body":
    "A lista é criada individualmente para cada pessoa. Quem não tiver autorização para ver valores financeiros nunca é informado de que existem perguntas financeiras — em vez de lhe ser dito que a fatura foi encontrada mas que não tem autorização para ver o total.",
  "featurePage.fieldquo-ai.detail.3.label":
    "Tudo o que não tiver uma regra fica indisponível",
  "featurePage.fieldquo-ai.detail.3.body":
    "Se ninguém tiver definido quem pode utilizar determinada função, ninguém pode utilizá-la. Por predefinição, o acesso é recusado e essa recusa fica registada.",
  "featurePage.fieldquo-ai.detail.4.label":
    "Não pode ser convencido a aceder aos dados de outra empresa",
  "featurePage.fieldquo-ai.detail.4.body":
    "A empresa sobre a qual está a responder é definida antes de o modelo ser executado e nunca é determinada a partir de qualquer conteúdo produzido pelo modelo.",
  "featurePage.fieldquo-ai.detail.5.label":
    "Recusa tudo o resto numa única frase",
  "featurePage.fieldquo-ai.detail.5.body":
    "Programação, receitas, ensaios, trabalhos de casa, conhecimentos gerais — são recusados, indicando em alternativa aquilo em que pode ajudar. E quando não existe forma de consultar determinada informação, diz isso claramente em vez de tentar deduzi-la a partir de algo relacionado.",
  "featurePage.fieldquo-ai.detail.6.label":
    "O limite é verificado antes de a pergunta ser feita",
  "featurePage.fieldquo-ai.detail.6.body":
    "E o ecrã avisa-o aos oitenta por cento, em vez de esperar até atingir o limite.",

  // /features/team
  "featurePage.team.label": "Equipa e acessos",
  "featurePage.team.headline":
    "Dê às pessoas aquilo de que precisam e nada mais",
  "featurePage.team.oneLine":
    "Decida, definição a definição, o que cada pessoa pode ver e alterar, e mantenha um registo de quem alterou o quê.",
  "featurePage.team.description":
    "Acessos de equipa para prestadores de serviços: permissões individuais aplicadas no servidor e um registo de atividade de cada envio, edição e aprovação.",
  "featurePage.team.pain.1.pain":
    "Dar acesso ao novo responsável pelos orçamentos significa dar-lhe toda a sua lista de clientes e todos os preços que cobra.",
  "featurePage.team.pain.1.fix":
    "O acesso é configurado definição a definição. Ninguém recebe acesso à lista de clientes apenas porque precisava do calendário.",
  "featurePage.team.pain.2.pain":
    "Um controlo estava oculto para alguém, mas isso acabou por não significar que essa pessoa não conseguia aceder à funcionalidade.",
  "featurePage.team.pain.2.fix":
    "A permissão é aplicada no servidor. Ocultar um botão não é controlo de acesso aqui e nunca foi.",
  "featurePage.team.pain.3.pain":
    "Alguma coisa mudou num orçamento e ninguém se lembra de o ter feito.",
  "featurePage.team.pain.3.fix":
    "Cada envio, edição e aprovação fica registado com um nome e uma hora.",
  "featurePage.team.how.1.step": "Comece com uma predefinição e depois ajuste",
  "featurePage.team.how.1.body":
    "As predefinições permitem que alguém comece a trabalhar num minuto; os controlos existem para os casos em que as funções dessa pessoa não se enquadram numa predefinição.",
  "featurePage.team.how.2.step": "É o servidor que recusa",
  "featurePage.team.how.2.body":
    "A mesma permissão é novamente verificada quando o pedido chega, por isso um pedido criado manualmente recebe exatamente a mesma resposta que receberia através do ecrã.",
  "featurePage.team.how.3.step": "As ausências chegam à pessoa certa",
  "featurePage.team.how.3.body":
    "Os pedidos chegam ao responsável que os deve analisar, os saldos acumulam-se automaticamente e o calendário tem em conta os dias de ausência.",
  "featurePage.team.detail.1.label": "Treze controlos",
  "featurePage.team.detail.1.body":
    "Dez níveis — agenda, tempo, processamento salarial, notas, despesas, clientes, pedidos, orçamentos, trabalhos e faturas — e três interruptores para preços, custos dos trabalhos e recebimento de pagamentos. Trinta e oito definições no total.",
  "featurePage.team.detail.2.label": "Dois deles não são definições",
  "featurePage.team.detail.2.body":
    "As comunicações com clientes e os relatórios são apresentados como consequências das outras permissões, em vez de terem controlos próprios, porque um controlo que não decide nada é um controlo que não funciona.",
  "featurePage.team.detail.3.label":
    "A posição no nível, não uma correspondência pelo nome",
  "featurePage.team.detail.3.body":
    "Um nível é comparado pela posição que ocupa, por isso ver e editar também satisfaz a permissão de ver sem ser necessário listar todas as combinações.",
  "featurePage.team.detail.4.label": "Não pode conceder aquilo que não possui",
  "featurePage.team.detail.4.body":
    "Aquilo que uma pessoa pode conceder a outra está limitado ao seu próprio nível, no servidor. O editor oculta aquilo que essa pessoa não pode oferecer para que nada falhe ao clicar, e o servidor volta a aplicar o limite de qualquer forma.",
  "featurePage.team.detail.5.label": "Na dúvida, a resposta é não",
  "featurePage.team.detail.5.body":
    "Um membro que não possa ser carregado falha todas as verificações. Um nível guardado que não exista na hierarquia também falha. Alguém limitado aos seus próprios registos mas sem identidade associada não corresponde a nada, em vez de corresponder a tudo.",
  "featurePage.team.detail.6.label":
    "As alterações de função passam por outra porta",
  "featurePage.team.detail.6.body":
    "Enviar uma função ou um conjunto de permissões através da atualização normal de um membro é recusado com a respetiva razão, em vez de ser aceite e ignorado.",

  // /features/break-even
  "featurePage.break-even.label": "O seu preço de equilíbrio",
  "featurePage.break-even.headline":
    "Quanto um dia tem de faturar antes de ganhar um cêntimo",
  "featurePage.break-even.oneLine":
    "Os seus custos gerais reais, divididos pelo trabalho que consegue efetivamente realizar, transformados no valor que um orçamento tem de superar — e uma recusa quando não existem dados suficientes para calcular esse valor.",
  "featurePage.break-even.description":
    "Um preço mínimo calculado a partir dos seus próprios custos gerais, salários, dívida e depreciação, dividido pela capacidade que indicou: custo por trabalho, preço mínimo e valor mínimo por hora.",
  "featurePage.break-even.imageCaption":
    "Custo por trabalho e o preço mínimo correspondente, calculados a partir dos seus próprios custos gerais e dos seus próprios orçamentos aceites.",
  "featurePage.break-even.pain.1.pain":
    "Define os preços com base no que os outros cobram e espera que sobre alguma coisa no fim.",
  "featurePage.break-even.pain.1.fix":
    "O valor mínimo utiliza os seus próprios números — a sua renda, a sua carrinha, os seus salários — em vez de uma regra aproximada.",
  "featurePage.break-even.pain.2.pain":
    "Tem uma ideia aproximada dos custos gerais, mas não faz ideia de quanto lhe custa simplesmente aparecer para trabalhar.",
  "featurePage.break-even.pain.2.fix":
    "O custo por trabalho é o seu custo mensal distribuído pelo trabalho que consegue efetivamente realizar num mês.",
  "featurePage.break-even.pain.3.pain":
    "Uma ferramenta apresenta um preço mínimo sem saber quantos trabalhos realiza.",
  "featurePage.break-even.pain.3.fix":
    "Se não tiver indicado a sua capacidade, recusa-se a apresentar um valor, em vez de utilizar uma predefinição e apresentar um número errado com toda a confiança.",
  "featurePage.break-even.how.1.step":
    "Dois totais, porque respondem a perguntas diferentes",
  "featurePage.break-even.how.1.body":
    "Um representa o dinheiro que sai todos os meses: custos gerais, salários e pagamentos integrais dos empréstimos. O outro representa aquilo que o trabalho realmente lhe custa: custos gerais, salários, depreciação e juros sobre aquilo que comprou através de um empréstimo.",
  "featurePage.break-even.how.2.step":
    "O valor mínimo utiliza o custo, não a saída de dinheiro",
  "featurePage.break-even.how.2.body":
    "O custo por trabalho é o segundo total dividido pelo número de trabalhos mensais implícito na capacidade que indicou, e o preço mínimo é esse valor ajustado para incluir a sua margem pretendida.",
  "featurePage.break-even.how.3.step":
    "Nada é inventado para preencher uma lacuna",
  "featurePage.break-even.how.3.body":
    "Sem uma capacidade indicada, não existe qualquer valor. Um preço mínimo predefinido seria o pior tipo de preenchimento: é um número com base no qual tomaria decisões.",
  "featurePage.break-even.detail.1.label": "Um mês corresponde a 4.33 semanas",
  "featurePage.break-even.detail.1.body":
    "Os custos semanais e a capacidade semanal são convertidos utilizando o mesmo valor, para que os dois lados da divisão sejam coerentes entre si.",
  "featurePage.break-even.detail.2.label": "A margem tem limites",
  "featurePage.break-even.detail.2.body":
    "A margem pretendida é, por predefinição, de vinte por cento e é limitada a menos de cem, porque uma margem de cem por cento implicaria uma divisão por zero — e um campo vazio é tratado como ausência de valor em vez de zero, o que faria com que todos os orçamentos fossem calculados exatamente no ponto de equilíbrio.",
  "featurePage.break-even.detail.3.label":
    "O mínimo por hora utiliza horas faturáveis",
  "featurePage.break-even.detail.3.body":
    "Não horas trabalhadas. Condução, preparação de orçamentos e trabalho administrativo são deliberadamente excluídos, e o valor por pessoa é o mínimo dividido pelo tamanho da equipa.",
  "featurePage.break-even.detail.4.label":
    "A depreciação entra num total e não no outro",
  "featurePage.break-even.detail.4.body":
    "A saída de caixa não inclui depreciação. O valor de custo inclui a depreciação e os juros dos empréstimos e exclui o pagamento mensal bruto do empréstimo, para que a mesma carrinha não seja contabilizada duas vezes.",
  "featurePage.break-even.detail.5.label":
    "Uma frequência desconhecida não acrescenta nada",
  "featurePage.break-even.detail.5.body":
    "Em vez de acrescentar um valor errado. Um salário sem horas associadas também não acrescenta nada, em vez de se presumir que corresponde a tempo inteiro.",
  "featurePage.break-even.detail.6.label":
    "Precisa de ter a sua base de custos ativada",
  "featurePage.break-even.detail.6.body":
    "Ambos os valores precisam dos custos por trabalho e da autorização para ver preços. Sem estes elementos, o cálculo é recusado em vez de apresentar zeros, porque um painel cheio de zeros parece indicar uma empresa que não custa nada a operar.",

  // /features/expenses
  "featurePage.expenses.label": "Despesas e custos gerais",
  "featurePage.expenses.headline":
    "Aquilo que gasta, separado daquilo que um trabalho lhe custa",
  "featurePage.expenses.oneLine":
    "Registe o dinheiro que sai, identifique o que pertence a um trabalho e deixe que o restante se transforme nos custos gerais utilizados para calcular o seu preço de equilíbrio.",
  "featurePage.expenses.description":
    "Acompanhamento de despesas para prestadores de serviços: custos dos trabalhos separados dos custos gerais, custos fixos recorrentes que alimentam o preço mínimo e empréstimos amortizados em vez de guardados como um saldo desatualizado.",
  "featurePage.expenses.pain.1.pain":
    "A renda, o seguro e a conta do telefone vivem numa folha de cálculo que só serve para lhe estragar o humor.",
  "featurePage.expenses.pain.1.fix":
    "Os custos recorrentes são utilizados para calcular o ponto de equilíbrio, por isso introduzi-los altera um número que realmente utiliza.",
  "featurePage.expenses.pain.2.pain":
    "Um recibo é um custo de um trabalho ou um custo geral, e metade acaba arquivada como ambos.",
  "featurePage.expenses.pain.2.fix":
    "Uma despesa associada a um trabalho não pode também ser um custo geral. É recusada em vez de ser contabilizada duas vezes.",
  "featurePage.expenses.pain.3.pain":
    "Toda a gente no escritório consegue ver todas as despesas da empresa.",
  "featurePage.expenses.pain.3.fix":
    "Existe um nível que permite a uma pessoa ver apenas os seus próprios registos e nada mais.",
  "featurePage.expenses.how.1.step": "Um único tipo de registo, não dois",
  "featurePage.expenses.how.1.body":
    "Um custo fixo é uma despesa normal marcada como custo geral e recorrente — exatamente a mesma definição que o cálculo do ponto de equilíbrio já utiliza. Uma lista separada permitir-lhe-ia introduzir a renda duas vezes e aumentar acidentalmente o seu próprio preço mínimo.",
  "featurePage.expenses.how.2.step": "O nome torna-se no título",
  "featurePage.expenses.how.2.body":
    "Um custo fixo chamado Renda da oficina recebe a sua própria barra na discriminação, em vez de desaparecer numa categoria chamada outros.",
  "featurePage.expenses.how.3.step":
    "Os empréstimos são calculados, não guardados",
  "featurePage.expenses.how.3.body":
    "Um saldo registado fica errado no mês seguinte, por isso o que é guardado é o capital, a taxa e a data de início, e o saldo é calculado quando é necessário.",
  "featurePage.expenses.detail.1.label": "Semanal, mensal ou anual",
  "featurePage.expenses.detail.1.body":
    "Uma ocorrência única não é deliberadamente oferecida para um custo fixo. Seria multiplicada por nada e não alteraria qualquer valor — um registo que poderia guardar mas que não faria absolutamente nada.",
  "featurePage.expenses.detail.2.label":
    "Superior a zero, não apenas preenchido",
  "featurePage.expenses.detail.2.body":
    "Um custo fixo de zero não altera nada e um valor negativo reduziria o seu próprio preço mínimo, por isso ambos são recusados.",
  "featurePage.expenses.detail.3.label":
    "Fica registado quem introduziu a despesa",
  "featurePage.expenses.detail.3.body":
    "A identificação é registada no momento em que a linha é criada, para que um nível que permita a alguém ver apenas os seus próprios registos possa realmente ser aplicado em vez de ser apenas uma indicação no ecrã.",
  "featurePage.expenses.detail.4.label":
    "Os custos fixos são considerados ao nível de toda a empresa",
  "featurePage.expenses.detail.4.body":
    "Ao contrário da lista de despesas, para que a discriminação corresponda ao total apresentado ao lado.",
  "featurePage.expenses.detail.5.label":
    "Uma despesa associada a um trabalho não pode também ser um custo geral",
  "featurePage.expenses.detail.5.body":
    "É recusada com a respetiva razão. Respondem a perguntas diferentes, e contabilizar a mesma despesa nas duas categorias duplicaria o valor.",
};

export default pt;
