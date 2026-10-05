// app/i18n/industries/pt.js
//
// Conteúdo das páginas por setor — um ficheiro por idioma.
//
// English is the source of truth. Missing keys in other languages fall back
// here rather than rendering raw key paths.

const pt = {
  // Elementos partilhados da página para os doze setores
  chrome: {
    seeItInAction: "Ver em ação",
    startTrial: "Iniciar período experimental gratuito",
    talkToUs: "Fale connosco",
    noCard:
      "Os primeiros 14 dias são gratuitos — o seu cartão só será cobrado quando terminarem.",
    videoSoon: "Demonstração do produto disponível em breve",
    videoDemoPrefix: "Prefere ver uma demonstração ao vivo?",
    videoDemoLink: "Marcar uma demonstração",
    soundFamiliar: "Parece-lhe familiar?",
    painIntro:
      "Estas são as coisas que silenciosamente fazem as empresas de {trade} perder dinheiro. Veja como o FieldQuo resolve cada uma delas.",
    ctaTitle: "Experimente no seu próximo trabalho de {trade}",
    ctaBody:
      "Configure os seus preços, envie um orçamento e veja se consegue poupar uma noite de trabalho administrativo. Esse é o teste.",
    nearby: "Também para setores relacionados",
    builtFor: "Criado para empresas de {trade}",
    builtForNote:
      "As três coisas que uma empresa de {trade} mais utiliza, pela ordem em que trazem resultados.",
    builtForFallback:
      "Apresentado em inglês — esta parte da página ainda não está disponível no seu idioma.",
  },

  // Demonstração de coberturas
  showcase: {
    eyebrow: "Exemplo",
    title: "Como é um orçamento instantâneo para uma cobertura",
    lede: "Percorra o processo como faria um proprietário e, depois, acompanhe o pedido até à conta FieldQuo da empresa de coberturas.",
    noticeTitle: "Esta página é apenas um exemplo",
    notice:
      "A Summit Ridge Roofing, o proprietário, a casa e todos os preços abaixo são fictícios e foram criados para esta demonstração. Cada empresa de coberturas define os seus próprios produtos e preços no FieldQuo. Nada do que introduzir no formulário é enviado ou guardado.",
    howTitle: "Como funciona",
    how: [
      {
        title: "O proprietário abre o seu link",
        body: "A partir do seu site, de um anúncio ou de uma mensagem. Confirma a morada e escolhe a cobertura que pretende.",
      },
      {
        title: "Deixa os seus dados",
        body: "Nome, telefone ou e-mail, quando precisa do trabalho e o seu orçamento disponível. É você que decide se o preço aparece antes deste passo, depois dele ou se não aparece de todo.",
      },
      {
        title: "Vê um intervalo de preços",
        body: "Calculado a partir da área medida da cobertura e dos seus próprios preços, com o nome da sua empresa.",
      },
      {
        title: "Você verifica e envia",
        body: "O pedido entra nos seus leads com uma classificação, e um orçamento em rascunho fica à espera da sua aprovação.",
      },
    ],
    homeownerSees: "O que o proprietário vê",
    contractorSees: "O que vê no FieldQuo",
    sampleTag: "Exemplo",
    step1Title: "A página do proprietário",
    step1Body:
      "A página de orçamento instantâneo utilizada pelos seus clientes, apresentada numa casa de exemplo. Escolha uma cobertura, responda às perguntas e carregue no botão no final.",
    roofIllustration:
      "A imagem da cobertura é uma ilustração criada para este exemplo. Num pedido real, será a fotografia de satélite da casa do proprietário.",
    formLanguageNote:
      "As páginas para proprietários estão disponíveis em inglês, francês e espanhol, por isso este exemplo é apresentado em inglês.",
    showingDefault:
      "A apresentar um pedido de exemplo. Envie o formulário acima para ver o seu pedido nos passos seguintes.",
    showingYours: "A apresentar o pedido que acabou de enviar.",
    startOver: "Recomeçar",
    step2Title: "O lead na sua aplicação",
    step2Body:
      "O pedido entra nos seus leads com a respetiva classificação, as razões dessa classificação, as respostas do proprietário e os seus dados de contacto. Abra o cartão.",
    step3Title: "A sua verificação antes do envio",
    step3Body:
      "Os orçamentos instantâneos ficam à sua espera antes de poder ser enviado um orçamento. Compare o que o proprietário viu com a cobertura medida e, depois, aprove.",
    step4Title: "O orçamento, pronto a enviar",
    step4Body:
      "O orçamento em rascunho criado a partir do pedido, juntamente com os cálculos que justificam o preço. Não pode ser aberto nem editado nesta página.",
    statusApproved: "Aprovado — pronto a enviar",
    waitingApproval: "À espera da sua aprovação no passo 3.",
    editNote:
      "Na sua conta, ainda pode alterar qualquer linha antes de enviar.",
    workingsTitle: "Como este preço foi calculado",
    workMeasured:
      "Cobertura medida: {area} sq ft, o equivalente a {squares} squares (1 square = 100 sq ft).",
    workMaterial: "{material}: {squares} squares × {rate}",
    workTearOff:
      "Remoção das camadas existentes: {layers} × {squares} squares × {rate}",
    workPitch: "Cobertura inclinada ({rise}/12): +{pct}",
    workSubtotal: "Subtotal",
    workTotal: "Total",
    workRange:
      "O proprietário viu um intervalo de {range} (±{pct} em torno do subtotal).",
    tiersTitle: "Todas as opções de cobertura, com preço para esta casa",
    tierRate: "{rate} por square",
    examplePrices: "Preços de exemplo — é você que define os seus.",
    ctaTitle: "Dê esta página aos seus clientes",
    ctaBody:
      "Comece com os seus próprios preços e o nome da sua empresa, ou marque uma demonstração e mostramos-lhe todo o processo.",
    exampleCompany: "Empresa de exemplo · fictícia",
    reportTitle: "Onde o proprietário chega depois de enviar",
    reportBody:
      "O relatório do orçamento: o intervalo de preços, a cobertura medida e as informações da própria empresa — apresentação, fotografias, documentos e processo.",
    reportLabel: "Relatório do orçamento",
    quotePageTitle: "Quando envia",
    quotePageBody:
      "O orçamento que o proprietário abre, com as confirmações que deve assinalar antes de aprovar.",
    quotePageLabel: "Página do orçamento",
    insuranceLink: "Abrir o certificado de seguro de exemplo (PDF)",

    liveTitle: "Experimente numa casa real",
    liveBody:
      "Introduza uma morada no Canadá ou nos EUA e a cobertura será medida através do modelo de coberturas por satélite da Google, tal como acontece no formulário real, sendo depois calculado o preço com os preços de exemplo da Summit Ridge.",
    livePrivacy:
      "A morada é enviada à Google para medir a cobertura, e a morada juntamente com a medição é guardada durante 30 dias para que a mesma casa não seja medida duas vezes. Nenhum nome, lead ou orçamento é guardado.",
    liveCta: "Utilizar uma morada real",
    liveAddressLabel: "Morada do imóvel",
    livePlaceholder: "Comece a escrever uma morada…",
    livePickHint: "Escolha a morada na lista para a medir.",
    liveMeasure: "Medir esta cobertura",
    liveMeasuring: "A medir a cobertura…",
    liveShowingMeasured:
      "A apresentar {address}: {squares} squares com uma inclinação de {pitch}, medidos através do modelo de coberturas por satélite da Google. Os preços são exemplos da Summit Ridge, em {currency}.",
    liveUntrusted:
      "O modelo da Google pode identificar o edifício errado ou apenas uma parte dele. Uma empresa de coberturas verificaria a fotografia de satélite antes de enviar o orçamento.",
    liveShowingTyped:
      "Preço calculado com base nos {squares} squares que introduziu, e não numa medição. A inclinação não foi medida, pelo que não está incluído qualquer acréscimo por cobertura inclinada.",
    liveBackToSample: "Voltar à casa de exemplo",
    liveOutside:
      "O exemplo interativo mede apenas moradas no Canadá e nos EUA. Introduza manualmente o tamanho da cobertura ou continue com a casa de exemplo.",
    liveNotFound:
      "Não conseguimos encontrar essa morada. Verifique-a ou introduza manualmente o tamanho da cobertura.",
    liveNoRoof:
      "A Google não tem um modelo de cobertura para este edifício, por isso não é possível medi-la. Introduza o tamanho da cobertura para ver o preço ou continue com a casa de exemplo.",
    liveCapped:
      "O exemplo interativo atingiu o limite de hoje — experimente a casa de exemplo.",
    liveDailyLimit:
      "Já experimentou três moradas hoje — experimente a casa de exemplo.",
    liveRateLimited:
      "Uma morada de cada vez — aguarde alguns segundos e tente novamente.",
    liveUnavailable:
      "O exemplo interativo não consegue efetuar a medição neste momento — experimente a casa de exemplo ou introduza manualmente o tamanho da cobertura.",
    liveSquaresLabel: "Tamanho da cobertura em squares (1 square = 100 sq ft)",
    liveSquaresInvalid:
      "Introduza um tamanho de cobertura entre {min} e {max} squares.",
    liveUseSquares: "Calcular preço para este tamanho",
    liveImageNote:
      "A imagem da cobertura é a fotografia de satélite da Google correspondente à morada que introduziu.",
    workTyped:
      "Tamanho da cobertura introduzido por si: {squares} squares ({area} sq ft), não medido.",
    typedAssumption:
      "{squares} roofing squares, introduzidos na página de exemplo, não medidos",
    viewLabel: "Ver como",
    viewPhone: "Telemóvel",
    viewDesktop: "Computador",
    previewBlocked:
      "Exemplo: o conteúdo da página altera esta pré-visualização, mas os botões e formulários não executam qualquer ação aqui.",

    materials: {
      asphalt_3tab: "Telhas asfálticas de 3 abas",
      asphalt_arch: "Telhas asfálticas arquitetónicas",
      asphalt_premium: "Telhas asfálticas premium / de design",
      metal_standing_seam: "Cobertura metálica de junta agrafada",
      metal_corrugated: "Cobertura metálica ondulada / nervurada",
    },
  },

  trades: {
    cleaning: {
      label: "Limpeza",
      headline:
        "Software para empresas de limpeza que mantém os trabalhos recorrentes sob controlo",
      description:
        "A limpeza residencial e comercial depende de visitas recorrentes, equipas rotativas e margens apertadas por trabalho. O FieldQuo mantém o calendário, a lista de verificação e a fatura num só lugar.",
      pains: [
        {
          pain: "Os clientes recorrentes são reagendados manualmente todas as semanas",
          fix: "Defina a frequência das visitas uma vez e deixe o calendário repeti-las automaticamente, com a equipa certa atribuída a cada visita.",
        },
        {
          pain: "As equipas saltam etapas e os clientes percebem antes de si",
          fix: "Listas de verificação por trabalho que a sua equipa assinala no telemóvel, para que o padrão seja sempre o mesmo, independentemente de quem aparece.",
        },
        {
          pain: "As pequenas faturas por pagar acumulam-se porque não compensa perder tempo a cobrá-las",
          fix: "Lembretes automáticos para faturas em atraso, e os clientes podem pagar online diretamente a partir do e-mail.",
        },
        {
          pain: "Não sabe quais contratos são realmente rentáveis",
          fix: "O tempo é registado em cada trabalho e comparado com o valor faturado, para que os contratos não rentáveis sejam identificados cedo.",
        },
      ],
    },

    "construction-contracting": {
      label: "Construção e Empreitadas",
      headline:
        "Software de construção que protege a sua margem em cada proposta",
      description:
        "Alterações ao âmbito dos trabalhos, subempreiteiros e preços de materiais que mudam entre o orçamento e o início da obra. O FieldQuo mantém propostas, calendários e custos reais ligados para que saiba sempre onde está cada projeto.",
      pains: [
        {
          pain: "As propostas ocupam uma noite inteira e mesmo assim ficam coisas de fora",
          fix: "Construa a partir do seu próprio catálogo com preços e grupos de trabalhos reutilizáveis, para que criar uma proposta seja montar peças em vez de escrever tudo de raiz.",
        },
        {
          pain: "Os custos dos materiais mudam entre o orçamento e o início da obra",
          fix: "Acompanhe os custos dos materiais com histórico de preços, para fazer orçamentos com base no que custam agora e não no que custavam na época passada.",
        },
        {
          pain: "Os trabalhos adicionais são acordados verbalmente e esquecidos na faturação",
          fix: "Reveja o orçamento, obtenha uma nova aprovação online e a fatura reflete automaticamente a alteração.",
        },
        {
          pain: "Só descobre que um projeto deu prejuízo depois de estar concluído",
          fix: "Mão de obra, materiais e despesas são acompanhados em cada trabalho à medida que este decorre, em vez de serem reconstruídos posteriormente.",
        },
      ],
    },

    electrical: {
      label: "Eletricidade",
      headline:
        "Software para eletricistas criado em torno das chamadas de assistência",
      description:
        "Entre chamadas de assistência, modernizações de quadros elétricos e marcações de inspeções, a administração acumula-se rapidamente. O FieldQuo trata da documentação para que as horas dos seus profissionais qualificados sejam dedicadas a trabalho faturável.",
      pains: [
        {
          pain: "Uma chamada de emergência destrói um dia inteiro de trabalho planeado",
          fix: "Arraste o trabalho para outro horário e os clientes e membros da equipa afetados são automaticamente notificados.",
        },
        {
          pain: "Orçamentar a modernização de um quadro elétrico significa reconstruir sempre as mesmas linhas",
          fix: "Utilize um catálogo de serviços guardado com as suas próprias tarifas — escolha o trabalho, ajuste e envie.",
        },
        {
          pain: "As fotografias do trabalho e as notas de inspeção ficam no telemóvel de alguém",
          fix: "As fotografias e notas ficam associadas ao registo do trabalho, para serem encontradas quando um cliente ou inspetor as pedir meses mais tarde.",
        },
        {
          pain: "As horas dos aprendizes são estimadas na altura de processar os salários",
          fix: "As horas são registadas em trabalhos reais, aprovadas por um supervisor e seguem diretamente para os pagamentos.",
        },
      ],
    },

    hvac: {
      label: "AVAC",
      headline: "Software AVAC para picos sazonais e contratos de manutenção",
      description:
        "O seu ano tem dois períodos de enorme procura e dois períodos mais calmos. O FieldQuo ajuda-o a preencher o calendário durante os picos sem perder clientes e a manter a receita de manutenção durante os meses mais tranquilos.",
      pains: [
        {
          pain: "A primeira vaga de calor gera mais chamadas do que consegue agendar",
          fix: "Uma página de marcações mostra a disponibilidade real, permitindo que os clientes escolham horários livres sem ficarem à espera ao telefone.",
        },
        {
          pain: "Os contratos de manutenção são esquecidos até o cliente ligar",
          fix: "Visitas recorrentes agendadas antecipadamente com lembretes automáticos, para que o trabalho contratado se agende praticamente sozinho.",
        },
        {
          pain: "Os técnicos chegam sem saber que equipamento está instalado no local",
          fix: "Todo o histórico do trabalho e do cliente fica disponível no telemóvel, incluindo o que foi feito na última visita.",
        },
        {
          pain: "Perde orçamentos de instalação para quem respondeu primeiro",
          fix: "Crie e envie o orçamento ainda no local; os clientes aprovam online sem terem de esperar que regresse ao escritório.",
        },
      ],
    },

    handyman: {
      label: "Serviços de manutenção",
      headline:
        "Software para profissionais de manutenção quando nunca há dois trabalhos iguais",
      description:
        "Muitos trabalhos pequenos, uma enorme variedade e preços que têm de ser rápidos sem serem descuidados. O FieldQuo mantém a carga administrativa proporcional ao tamanho do trabalho.",
      pains: [
        {
          pain: "Cada trabalho é diferente, por isso parece que nada pode ser reutilizado",
          fix: "Crie um catálogo das suas tarefas e tarifas mais comuns e combine-as como quiser, por mais invulgar que seja o trabalho.",
        },
        {
          pain: "Um trabalho pequeno não parece justificar um orçamento formal, até surgir uma disputa",
          fix: "Envie um orçamento pelo telemóvel em menos de um minuto — o cliente aprova por escrito e fica tudo registado.",
        },
        {
          pain: "Meio dia desaparece em chamadas para marcar trabalhos",
          fix: "Os clientes marcam diretamente os horários que realmente tem disponíveis.",
        },
        {
          pain: "Os pagamentos em dinheiro e por transferência nunca ficam devidamente registados",
          fix: "Registe qualquer método de pagamento na fatura, para que as contas correspondam à realidade.",
        },
      ],
    },

    landscaping: {
      label: "Paisagismo",
      headline:
        "Software de paisagismo para projetos completos e equipas sazonais",
      description:
        "Projetos desde o design até à execução, pessoal sazonal e condições meteorológicas que obrigam a reorganizar a semana. O FieldQuo mantém orçamentos, equipas e custos juntos quando o plano está sempre a mudar.",
      pains: [
        {
          pain: "A chuva muda a semana inteira e é preciso avisar toda a gente",
          fix: "Mova os trabalhos no calendário e os clientes e membros da equipa afetados são automaticamente notificados.",
        },
        {
          pain: "Os orçamentos de projetos completos são longos e demoram dias a preparar",
          fix: "Agrupe o âmbito dos trabalhos em secções com fotografias, para que um orçamento grande seja fácil de ler e rápido de construir.",
        },
        {
          pain: "As contratações sazonais dificultam perceber o custo real da mão de obra",
          fix: "Registe o tempo por trabalho e por trabalhador, para saber o custo real da mão de obra de cada projeto.",
        },
        {
          pain: "Os custos de plantas e materiais consomem silenciosamente a margem",
          fix: "Acompanhe os custos dos materiais com histórico de preços e compare-os com o que incluiu no orçamento.",
        },
      ],
    },

    "lawn-care": {
      label: "Manutenção de Relvados",
      headline:
        "Software para manutenção de relvados criado para rotas eficientes",
      description:
        "Grande volume, baixo valor por serviço e uma rentabilidade que depende da eficiência da rota. O FieldQuo mantém as visitas recorrentes e a faturação a funcionar com o mínimo de administração por paragem.",
      pains: [
        {
          pain: "Voltar a agendar os mesmos clientes todas as semanas já é um trabalho por si só",
          fix: "Defina a frequência uma vez — as visitas são criadas automaticamente com a equipa certa atribuída.",
        },
        {
          pain: "Faturar dezenas de pequenas contas ocupa uma noite inteira",
          fix: "Gere em lote as faturas das visitas concluídas, com ligações para pagamento online.",
        },
        {
          pain: "Uma visita ignorada ou cancelada pela chuva acaba por ser faturada na mesma",
          fix: "Marque as visitas como concluídas ou não realizadas diretamente no terreno, e a faturação segue aquilo que realmente aconteceu.",
        },
        {
          pain: "Não consegue perceber quais rotas vale a pena manter",
          fix: "Veja a receita e o tempo por trabalho para perceber quais clientes justificam a deslocação.",
        },
      ],
    },

    painting: {
      label: "Pintura",
      headline:
        "Software para empresas de pintura com orçamentos que os clientes realmente aprovam",
      description:
        "Na pintura, o trabalho ganha-se no orçamento — clareza, fotografias e chegar antes dos outros dois concorrentes. O FieldQuo ajuda-o a enviar um orçamento profissional no próprio dia.",
      pains: [
        {
          pain: "É o terceiro a visitar o cliente e o último a enviar o orçamento",
          fix: "Crie o orçamento no local com as suas próprias tarifas e envie-o antes de sair da propriedade.",
        },
        {
          pain: "Os clientes não percebem o que está incluído e começam a negociar o preço",
          fix: "Apresente um âmbito dos trabalhos detalhado, com fotografias e inclusões claras, para que a conversa seja sobre o trabalho e não apenas sobre o número.",
        },
        {
          pain: "As decisões sobre cores e preparação são acordadas verbalmente e depois contestadas",
          fix: "Ficam registadas no orçamento aprovado, com data e hora e a aprovação online do cliente associada.",
        },
        {
          pain: "A tinta e os materiais acabam por custar mais do que tinha previsto",
          fix: "Acompanhe os custos dos materiais com histórico, para que as premissas dos seus orçamentos estejam sempre atualizadas.",
        },
      ],
    },

    plumbing: {
      label: "Canalização",
      headline:
        "Software para canalizadores — para emergências e trabalhos planeados",
      description:
        "As emergências não respeitam o calendário, mas a administração continua a ter de ser feita. O FieldQuo mantém a atribuição das equipas, o histórico dos trabalhos e a faturação em movimento sem precisar de um escritório administrativo.",
      pains: [
        {
          pain: "Uma chamada de emergência destrói um dia que já estava todo marcado",
          fix: "Reagende os trabalhos afetados com alguns toques; os clientes e a equipa são notificados sem precisar de fazer chamadas.",
        },
        {
          pain: "Está a emitir faturas às 22h porque passou o dia inteiro de um lado para o outro",
          fix: "Transforme o trabalho concluído numa fatura no próprio local, com uma ligação de pagamento que o cliente pode utilizar imediatamente.",
        },
        {
          pain: "Ninguém se lembra do que foi feito nesta propriedade da última vez",
          fix: "Todo o histórico de trabalhos por cliente, incluindo fotografias e notas, fica disponível no telemóvel do técnico.",
        },
        {
          pain: "Os trabalhos de retorno acabam por ser feitos gratuitamente porque ninguém registou a intervenção original",
          fix: "Cada visita fica registada — o que foi substituído, quando e em que condições.",
        },
      ],
    },

    "pressure-washing": {
      label: "Lavagem à Pressão",
      headline:
        "Software para lavagem à pressão com orçamentos rápidos e trabalhos concluídos sem demora",
      description:
        "Trabalhos curtos, grande volume e orçamentos muitas vezes feitos a partir de uma fotografia. O FieldQuo mantém a administração suficientemente leve para valer a pena até num trabalho de duas horas.",
      pains: [
        {
          pain: "Fazer orçamentos a partir de fotografias significa adivinhar e esperar que esteja certo",
          fix: "Utilize preços por área do seu próprio catálogo para manter os orçamentos consistentes de trabalho para trabalho.",
        },
        {
          pain: "Nos trabalhos curtos, a papelada parece desproporcional",
          fix: "Crie o orçamento, agende e fature pelo telemóvel em apenas alguns minutos por etapa.",
        },
        {
          pain: "Atravessar a cidade entre trabalhos dispersos destrói o dia",
          fix: "Veja todos os trabalhos do dia em conjunto para os poder agrupar de forma eficiente.",
        },
        {
          pain: "As fotografias de antes e depois ficam perdidas na galeria do telemóvel",
          fix: "As fotografias ficam associadas ao trabalho — úteis para resolver disputas e mais tarde para marketing.",
        },
      ],
    },

    roofing: {
      label: "Coberturas",
      headline:
        "Software para empresas de coberturas — para orçamentos de alto valor e coordenação de equipas",
      description:
        "Trabalhos de elevado valor, dependência das condições meteorológicas e clientes que precisam de confiança antes de avançarem. O FieldQuo ajuda-o a apresentar orçamentos claros e a manter as equipas coordenadas depois de ganhar o trabalho.",
      pains: [
        {
          pain: "Um orçamento de cinco dígitos é enviado num e-mail de uma linha e nunca recebe resposta",
          fix: "Envie orçamentos detalhados com âmbito dos trabalhos, fotografias e opções que o cliente pode aprovar online — com acompanhamento automático se deixar de responder.",
        },
        {
          pain: "O tempo obriga a mudar o calendário e a equipa só descobre tarde demais",
          fix: "Reagende uma vez; as notificações para a equipa e para o cliente são enviadas automaticamente.",
        },
        {
          pain: "Os sinais e pagamentos por etapas são controlados de cabeça",
          fix: "Registe sinais e pagamentos parciais na fatura, mantendo o saldo sempre visível para ambas as partes.",
        },
        {
          pain: "O desperdício de materiais consome silenciosamente a margem",
          fix: "Acompanhe os custos dos materiais de cada trabalho e compare-os com o valor previsto no orçamento.",
        },
      ],
    },

    "tree-care": {
      label: "Cuidados de Árvores",
      headline:
        "Software para trabalhos em árvores de alto risco e elevado valor",
      description:
        "Equipamento, segurança da equipa e trabalhos cujo preço depende da avaliação profissional em vez de uma tabela fixa. O FieldQuo mantém um registo claro desde a avaliação inicial até à fatura.",
      pains: [
        {
          pain: "Cada trabalho é orçamentado com base na avaliação profissional e não há forma de comparar",
          fix: "Os trabalhos anteriores, com o respetivo âmbito, fotografias e preço final, continuam pesquisáveis, para que a sua avaliação tenha uma referência real.",
        },
        {
          pain: "Os riscos no local são discutidos no terreno e nunca ficam registados",
          fix: "Notas, fotografias e listas de verificação ficam associadas ao trabalho antes de a equipa chegar.",
        },
        {
          pain: "Os pedidos de emergência depois de uma tempestade chegam todos ao mesmo tempo",
          fix: "Receba os pedidos através de um formulário de marcação e defina prioridades sem o telefone estar constantemente a tocar.",
        },
        {
          pain: "O equipamento e o tempo da equipa não estão refletidos no preço",
          fix: "Registe o tempo por trabalho e compare-o com o valor faturado, para melhorar os preços com base em dados reais.",
        },
      ],
    },
  },
};

export default pt;
