// app/i18n/industries/zh.js — see en.js for structure and rationale.
//
// Simplified Chinese (zh-Hans). Trade labels are the words a Chinese-speaking
// contractor in Vancouver or Toronto actually uses for their own trade, not a
// dictionary rendering of the English category name.

const zh = {
  chrome: {
    // The hero link to the trade's showcase, drawn only when it has one.
    seeItInAction: "看看实际效果",
    startTrial: "开始免费试用",
    talkToUs: "联系我们",
    noCard: "首月免费——试用结束前不会扣你的卡。",
    videoSoon: "产品操作视频即将上线",
    videoDemoPrefix: "想看真人实操？",
    videoDemoLink: "预约演示",
    soundFamiliar: "是不是很耳熟？",
    painIntro: "下面这些事，正在悄悄让做{trade}的生意亏钱。FieldQuo 对每一条的做法如下。",
    ctaTitle: "下一单{trade}的活就试试看",
    ctaBody: "设好你的价格，发一份报价单，看看它能不能帮你把晚上省下来。就测这一件事。",
    nearby: "相邻工种也在用",
    // The "built for" section — the three selling points from lib/sales/tradeSellingPoints.js.
    builtFor: "为{trade}企业而建",
    builtForNote: "{trade}企业用得最多的三件事，按见效顺序排列。",
    builtForFallback: "以英文显示——页面这一部分尚未提供您的语言版本。",
  },

  // The roofing walk-through (app/(marketing)/industries/[slug]/showcase/).
  // Every key exists in every language; check:roofing-example holds that.
  showcase: {
    eyebrow: "示例",
    title: "屋顶即时报价是什么样子",
    lede: "像房主一样走一遍，然后跟着这条请求进入屋顶公司的 FieldQuo 账户。",
    noticeTitle: "本页面是一个示例",
    notice: "Summit Ridge Roofing、房主、房屋以及下方所有价格都是为本演示虚构的。每家屋顶公司都在 FieldQuo 中设置自己的产品和价格。您在这里输入的任何内容都不会被发送或保存。",
    howTitle: "运作方式",
    how: [
      { title: "房主打开您的链接", body: "来自您的网站、广告或短信。房主核对地址并选择想要的屋顶。" },
      { title: "房主留下联系方式", body: "姓名、电话或邮箱、需要施工的时间和预算。由您决定价格在这一步之前显示、之后显示，还是完全不显示。" },
      { title: "房主看到价格区间", body: "根据测量的屋顶和您自己的价格计算，以您公司的名义显示。" },
      { title: "您审核并发送", body: "请求带着评分进入您的潜在客户列表，一份报价草稿等待您批准。" },
    ],
    homeownerSees: "房主看到的内容",
    contractorSees: "您在 FieldQuo 中看到的内容",
    sampleTag: "示例",
    step1Title: "房主的页面",
    step1Body: "您的客户使用的即时报价页面，这里以一栋示例房屋运行。选择屋顶、回答问题，然后按下底部的按钮。",
    roofIllustration: "屋顶图片是为本示例绘制的插图。在真实请求中，这里是房主房屋的卫星照片。",
    formLanguageNote: "房主页面提供英语、法语和西班牙语版本，因此这里以英语显示。",
    showingDefault: "当前显示的是示例请求。提交上方表单，即可在后续步骤中看到您自己的请求。",
    showingYours: "当前显示的是您刚提交的请求。",
    startOver: "重新开始",
    step2Title: "您应用中的潜在客户",
    step2Body: "请求进入您的潜在客户列表，附带评分及原因、房主的回答和联系方式。打开卡片即可查看。",
    step3Title: "发送前由您审核",
    step3Body: "即时估价会先等待您审核，之后报价才能发送。将房主看到的内容与测量的屋顶进行对比，然后批准。",
    step4Title: "报价，准备发送",
    step4Body: "根据请求生成的报价草稿，以及其价格背后的计算过程。无法在本页面打开或编辑。",
    statusApproved: "已批准 — 可以发送",
    waitingApproval: "等待您在第 3 步批准。",
    editNote: "在您的账户中，发送前仍可修改任何一行。",
    workingsTitle: "这个价格是如何计算的",
    workMeasured: "测量的屋顶：{area} 平方英尺，即 {squares} 方（1 方 = 100 平方英尺）。",
    workMaterial: "{material}：{squares} 方 × {rate}",
    workTearOff: "拆除旧层：{layers} × {squares} 方 × {rate}",
    workPitch: "陡坡屋顶（{rise}/12）：+{pct}",
    workSubtotal: "小计",
    workTotal: "合计",
    workRange: "房主看到的区间为 {range}（小计上下浮动 ±{pct}）。",
    tiersTitle: "此房屋的每种屋顶选项及价格",
    tierRate: "每方 {rate}",
    examplePrices: "示例价格 — 您可以设置自己的价格。",
    ctaTitle: "把这个页面提供给您的客户",
    ctaBody: "用您自己的价格和公司名称开始，或预约演示，我们会带您了解全部流程。",
    exampleCompany: "示例公司 · 虚构",
    reportTitle: "房主提交后会看到什么",
    reportBody: "房主的估价报告：价格区间、测量的屋顶，以及公司自己的简介、照片、文件和施工流程。",
    reportLabel: "估价报告",
    quotePageTitle: "当您发送报价时",
    quotePageBody: "房主打开的报价页面，以及他们在批准前需要勾选的确认事项。",
    quotePageLabel: "报价页面",
    insuranceLink: "打开示例保险证书（PDF）",
    materials: {
      asphalt_3tab: "三片式沥青瓦",
      asphalt_arch: "建筑沥青瓦",
      asphalt_premium: "高端 / 设计款沥青瓦",
      metal_standing_seam: "直立锁边金属屋面",
      metal_corrugated: "波纹 / 肋型金属板",
    },
  },

  trades: {
    cleaning: {
      label: "保洁",
      headline: "让周期性保洁活不脱节的保洁生意软件",
      description: "住宅和商业保洁靠的是回头上门、轮换班组，还有每单薄薄的利润。FieldQuo 把排期、检查表和账单放在一处。",
      pains: [
        {
          pain: "回头客每周都要手工重排一遍",
          fix: "上门频率设一次，排期自己重复下去，每次都派上合适的班组。",
        },
        {
          pain: "班组漏了步骤，客户比你先发现",
          fix: "每单一张检查表，团队在手机上打勾，谁去干标准都一样。",
        },
        {
          pain: "小额账单欠着没人付，追起来又不值那个时间",
          fix: "逾期账单自动跟进，客户直接从邮件里在线付款。",
        },
        {
          pain: "你不知道哪些合同其实是赚钱的",
          fix: "工时挂到每一单上，跟你开出的金额比对，亏钱的合同早早浮出来。",
        },
      ],
    },

    "construction-contracting": {
      label: "建筑施工与总承包",
      headline: "让每一次投标都守住利润的施工软件",
      description: "范围一点点被撑大、分包商、还有从报价到开工之间不停变的材料价。FieldQuo 把投标、排期和真实成本串在一起，让你随时知道一个项目走到哪了。",
      pains: [
        {
          pain: "一份标做整整一晚上，还是有漏项",
          fix: "从你自己带价的目录里拼，施工范围可以整组复用，做标是拼装而不是从头写。",
        },
        {
          pain: "从报价到破土之间，材料价变了",
          fix: "材料成本带价格历史，你报的是现在的行情，不是上个季度的。",
        },
        {
          pain: "变更口头说定，开账单时忘得一干二净",
          fix: "改一版报价单，让客户在线重新批准，账单会自动跟着变。",
        },
        {
          pain: "一个项目亏了钱，做完才发现",
          fix: "人工、材料和支出边做边挂到工程上，不用事后回头拼凑。",
        },
      ],
    },

    electrical: {
      label: "电工",
      headline: "围绕上门维修单打造的电工承包商软件",
      description: "上门维修、电箱升级、约验收，杂事很快就堆起来。FieldQuo 替你处理文书，让你持证的工时用在能收钱的活上。",
      pains: [
        {
          pain: "一个急单毁掉排好的一天",
          fix: "把活拖到别的时段，受影响的客户和班组会自动收到通知。",
        },
        {
          pain: "报一个电箱升级，又要把同样的明细项重新敲一遍",
          fix: "带你自己单价的服务目录存着——挑好项目，调一调，发出去。",
        },
        {
          pain: "施工照片和验收记录留在某个人的手机里",
          fix: "照片和记录挂在工程档案上，几个月后客户或验收员问起也找得到。",
        },
        {
          pain: "学徒的工时到发工资时靠猜",
          fix: "工时记录挂到真实的工程上，由主管审批，直接进打款。",
        },
      ],
    },

    hvac: {
      label: "暖通空调",
      headline: "应对旺季高峰和保养合同的暖通空调软件",
      description: "你的一年是两波爆单加两段淡季。FieldQuo 帮你在高峰期接住单又不丢客户，让保养收入在淡季照样进账。",
      pains: [
        {
          pain: "第一波热浪一来，电话多到排不过来",
          fix: "预约页显示真实空档，客户自己挑空位，不用在电话里排队。",
        },
        {
          pain: "保养协议被忘掉，直到客户打电话来",
          fix: "周期性上门提前排好并自动提醒，合同里的活自己会排上日程。",
        },
        {
          pain: "技工到现场才发现不知道装的是什么设备",
          fix: "完整的工程和客户历史都在手机上，包括上次上门做了什么。",
        },
        {
          pain: "安装的报价输给了回复最快的那家",
          fix: "在人家车道上就能做完报价单发出去；客户在线批准，不用等你回办公室。",
        },
      ],
    },

    handyman: {
      label: "综合维修",
      headline: "为没有两单一样的活做的综合维修软件",
      description: "活小、种类杂，报价既要快又不能糙。FieldQuo 让杂事的量跟活的大小成正比。",
      pains: [
        {
          pain: "每单都不一样，什么都复用不了",
          fix: "把你常做的工序和单价做成目录，再怪的组合也是从里面拼出来的。",
        },
        {
          pain: "小活觉得不值得正式报价，回头就起争执",
          fix: "一分钟内用手机发出一份报价单——客户书面批准，白纸黑字留着。",
        },
        {
          pain: "半天时间全耗在约时间的电话上",
          fix: "客户自己约进你真正空着的时段。",
        },
        {
          pain: "现金和转账收款从来没好好记过",
          fix: "任何付款方式都能挂到账单上，账目跟实际对得上。",
        },
      ],
    },

    landscaping: {
      label: "园艺绿化",
      headline: "为设计施工一体和季节性班组做的园艺绿化软件",
      description: "设计施工一体的项目、季节性用工，还有把你一周计划全打乱的天气。计划一直在动的时候，FieldQuo 把报价、班组和成本拴在一起。",
      pains: [
        {
          pain: "一场雨把一周重排了，还得挨个通知",
          fix: "在日历上挪一下工程，受影响的客户和班组会自动收到通知。",
        },
        {
          pain: "设计施工一体的报价单又长，还要做好几天",
          fix: "把施工范围分段并配上照片，长报价单读起来清楚，做起来也快。",
        },
        {
          pain: "季节工让人工成本算不准",
          fix: "工时按工程、按人记录，你能知道一个项目真实的人工成本。",
        },
        {
          pain: "苗木和材料成本悄悄吃掉利润",
          fix: "材料成本带价格历史，还能跟你报的价直接对比。",
        },
      ],
    },

    "lawn-care": {
      label: "草坪养护",
      headline: "为路线密度而生的草坪养护软件",
      description: "单量大、单价低，赚不赚钱全看路线排得紧不紧。FieldQuo 让周期性上门和收款跑起来，每一站的杂事都压到最少。",
      pains: [
        {
          pain: "每周给同一批客户重新排单，本身就是一份工作",
          fix: "频率设一次——上门自动生成，班组也一并带上。",
        },
        {
          pain: "给几十个小客户开账单要耗掉一晚上",
          fix: "从已完成的上门批量生成账单，带在线付款链接。",
        },
        {
          pain: "跳过或因雨取消的上门照样开了账单",
          fix: "在现场标记上门是完成还是跳过，收款跟着实际发生的走。",
        },
        {
          pain: "分不清哪些路线值得留着",
          fix: "每单的营收和用时都在，你能看出哪些客户值得跑这一趟。",
        },
      ],
    },

    painting: {
      label: "油漆",
      headline: "让客户真的会点批准的油漆软件",
      description: "油漆活是靠报价单赢的——说清楚、有照片，还要抢在另外两家之前送到。FieldQuo 帮你当天就发出一份像样的报价单。",
      pains: [
        {
          pain: "你是第三家报价的，还是发得最慢的那家",
          fix: "在现场用自己的单价做好报价单，车没开出人家车道就发出去。",
        },
        {
          pain: "客户搞不清哪些包含在内，就开始砍价",
          fix: "逐项列出施工范围，配上照片和明确的包含项，谈的是活本身而不是那个数字。",
        },
        {
          pain: "颜色和基层处理口头说定，事后起争执",
          fix: "都写在已批准的报价单里，带时间戳，还附着客户的在线批准。",
        },
        {
          pain: "漆和材料比预留的贵",
          fix: "材料成本带历史记录，你报价时的假设一直是新的。",
        },
      ],
    },

    plumbing: {
      label: "水暖",
      headline: "同时应付急单和计划内工程的水暖软件",
      description: "急单不管你排了什么班，杂事该做还是要做。FieldQuo 让派工、工程历史和开账单转起来，不用养一个后勤办公室。",
      pains: [
        {
          pain: "一个急单炸掉排满的一天",
          fix: "点几下就重排受影响的工程；客户和班组自动收到通知，不用你挨个打电话。",
        },
        {
          pain: "白天忙到脚不沾地，晚上十点还在开账单",
          fix: "活干完当场变成账单，带一个客户马上就能用的付款链接。",
        },
        {
          pain: "这处物业上次做了什么，没人记得",
          fix: "每位客户的完整工程历史，含照片和记录，都在技工手机上。",
        },
        {
          pain: "返工白干，因为当初那次没人记录",
          fix: "每一次上门都是一条记录——换了什么、什么时候换的、按什么条款。",
        },
      ],
    },

    "pressure-washing": {
      label: "高压清洗",
      headline: "为快速报价、快进快出而做的高压清洗软件",
      description: "活短、量大，而且经常是看照片就要报价。FieldQuo 把杂事压得够轻，两小时的活也值得走一遍流程。",
      pains: [
        {
          pain: "看照片报价，就是连猜带蒙",
          fix: "从你自己的目录按面积单价定价，单和单之间的估价保持一致。",
        },
        {
          pain: "活很短，文书却显得大得离谱",
          fix: "报价、排期、开账单，在手机上各花两分钟。",
        },
        {
          pain: "为几个分散的活横穿全城，一天就没了",
          fix: "一天的活放在一起看，你可以把活合理地聚成一堆。",
        },
        {
          pain: "施工前后的照片躺在相册里",
          fix: "照片挂到工程上——起争执时有用，以后做宣传也用得上。",
        },
      ],
    },

    roofing: {
      label: "屋顶施工",
      headline: "应对大额报价和班组协调的屋顶施工软件",
      description: "单值高、看天吃饭，客户签字前还要被说服。FieldQuo 帮你把报价说清楚，接下单之后把班组安排明白。",
      pains: [
        {
          pain: "五位数的报价只配了一行邮件，然后就没下文",
          fix: "详细的报价单带施工范围、照片和可选方案，客户在线批准——没回音还会自动跟进。",
        },
        {
          pain: "天气把排期挪了，班组最后才知道",
          fix: "重排一次；班组和客户的通知自动发出去。",
        },
        {
          pain: "定金和进度款全靠脑子记",
          fix: "把定金和部分付款记在账单上，余额双方随时都看得到。",
        },
        {
          pain: "材料损耗悄悄吃掉利润",
          fix: "材料成本挂到每一单上，跟你报价时预留的数对比。",
        },
      ],
    },

    "tree-care": {
      label: "树木养护",
      headline: "为高风险、高价值的活做的树木养护软件",
      description: "设备、班组安全，加上靠经验而不是价目表定价的活。FieldQuo 把从勘察到账单的记录理得清清楚楚。",
      pains: [
        {
          pain: "每单都靠经验定价，没有可比的东西",
          fix: "过去的工程连同施工范围、照片和最终价格都可以搜到，你的经验有据可依。",
        },
        {
          pain: "现场风险在现场说说，从来没写下来",
          fix: "记录、照片和检查表在班组到场前就挂在工程上。",
        },
        {
          pain: "暴风雨后的急单一下子全涌过来",
          fix: "用预约表单接需求并分轻重缓急，不用电话响个不停。",
        },
        {
          pain: "设备和班组的时间没体现在价格里",
          fix: "每单的工时跟你开出的金额对照，定价靠证据一点点变准。",
        },
      ],
    },

  },
};

export default zh;
