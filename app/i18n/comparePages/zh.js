// app/i18n/comparePages/zh.js
//
// Simplified Chinese. Catalogue-only: Mandarin is not offered in the language
// picker yet — no CJK font is registered for the PDF renderer — so this file is
// NOT gated by check:translations. It is the one catalogue that can fall behind
// English quietly, which is the reason to diff it against en.js by hand
// whenever /compare changes rather than waiting for a build to complain.
//
// The concessions and the hedges are kept exactly as narrow as the English.
// Chinese reads a bare negative as a statement about the competitor, so
// unverifiedConcessionNote, matchUnknownIntro and theirTiersNoMatchNote name
// who failed to check (我们没有查) instead of what is missing (他们没有). A
// translation that tightened those into an absence would be worse than leaving
// the English in place.
//
// {provenance} and {checked} arrive as English clauses out of competitors.js —
// they are quotations of our own record, not copy — so the sentences around
// them take them as an appended source rather than as a verb phrase.
// The One/plural pairs are identical: Chinese does not mark number, and both
// keys exist because the caller chooses by count, not by language.

const zh = {
  "compare.eyebrow": "对比",
  "compare.indexTitle": "对比 FieldQuo",
  "compare.indexLede": "五组对比，每一组都出自对方自己网站上公开的内容。这里没有任何汇率换算，没有任何促销价；凡是我们没能弄清楚的，都直说，而不是猜。五家里有一家的起步价比我们便宜，那一页在说别的之前，先说了这件事。",
  "compare.rulesTitle": "这些页面是怎么做出来的",
  "compare.entryGapTitle": "他们的起步价比我们便宜",
  "compare.entryGapIntro": "这个站上的对比并不是每一组都对我们有利，这一组就不是。下面两个价格，一个是他们公开的数字，一个是我们自己最便宜的一档，都取自本页其余部分所用的同一批记录。",
  "compare.entryGapTheirListIntro": "他们自己的页面上，这个套餐列了些什么，用的是他们的原话：",
  "compare.entryGapAdvice": "如果你要做的正是这些活，那就买他们的。我们宁愿把这句话写在这里，也不想卖给别人一堆用不上的软件，然后在退款环节再见一面。会改变答案的是班组：他们的套餐把每一个登录账号都算作付费用户，我们不这么算。",
  "compare.theirTiersTitle": "他们每一档各加了什么，用他们自己的话说",
  "compare.theirTiersIntro": "这是他们对自己套餐的描述，按他们页面上的呈现原样引用，并放在各自的价格旁边。我们没有把其中任何一句换成我们自己的说法：把竞争对手的功能改个名字去对上我们的叫法，正是一份对比悄悄变成稻草人的方式。所以下面的措辞是他们的，我们自己的清单在本页更靠下的地方，单独列出。",
  "compare.theirTiersNoMatchNote": "没有人逐项核对过：他们哪一档带有我们所卖的哪一项能力。他们的页面用整段文字描述套餐，我们的调查记录里也没有逐档的答案，所以本页在任何一个方向上都不作对应的断言——看他们的清单，看我们的清单，自己判断。",
  "compare.matchUnknownIntro": "没有人查证过他们哪一档带这一项，所以本页不点名任何一档。这不等于说他们没有——是我们没有查；而把没查过的事写成没有，那样的页面就是在编。",
  "compare.aiMeteringTitle": "两边各自怎么计量 AI 用量",
  "compare.aiMeteringIntro": "他们卖的是按月的额度，额度随档位变化，写在他们自己的页面上。我们不是这么卖的，而这句话老实讲有两半。",
  "compare.aiMeteringOurs": "FieldQuo 不按点数卖 AI：我们的价格页上没有哪个套餐配一份会用完的额度，也没有更大的包等着你升上去。接线员每个套餐都有，通话时长另外按预充值额度购买，没有每月最低消费，所以一个月没有来电，这一项就不花钱。另一半也该写在这里：模型用量是按公司计量的，上限由我们内部设定，所以本页没有一句话是在说它无限量。",
  "compare.concessionTitle": "FieldQuo 做不到的事",
  "compare.concessionIntro": "这一节在这些页面上每一页都有，位置一样，都放在我们好看的那部分前面。一张只有我们赢的对比表，卖出去的是一份对方随后会要求退款的订阅。",
  "compare.unverifiedConcessionNote": "我们没有查证这家公司是否提供这一项，所以我们不说他们有。",
  "compare.staleClaimNote": "这条记录距今已超过三个月，所以其中的金额一律先压下不显示，等有人重新看过他们的页面再说。点开链接，看看今天写的是什么。",
  "compare.advantageTitle": "FieldQuo 领先的地方",
  "compare.advantageIntro": "下面每一条，都是在标注的日期从他们自己的页面上读到的。点开链接自己核对——链接放在那里就是这个用途。",
  "compare.priceTitle": "价格，按各家自己公布的写法",
  "compare.featuresTitle": "用 FieldQuo 你能得到什么",
  "compare.featuresIntro": "下面每一行都是背后有实现的功能。这张清单由工程检查所依据的同一份记录生成，所以一项功能一旦不能用，就不会再出现在宣传里。",
  "compare.ctaTitle": "首月免费，绑卡即可；还没开始你就能看到价格",
  "compare.ctaBody": "不用预约通话，价格就写在价格页上，不藏在表单后面。注册时会绑定你的卡，免费月结束之前不会扣款。",
  "compare.ctaButton": "开始你的免费月",
  "compare.ctaSecondary": "查看价格",
  "compare.otherPagesTitle": "其他几组对比",
  "compare.rule.1": "每一个价格都是对方在自己价格页上印出的常规价。促销价一律不收：这样的页面做好一次要服务好几个月，它没办法察觉某个优惠已经结束。",
  "compare.rule.2": "金额保持公布时所用的货币。我们从不换算。汇率在你查的那天是对的，第二天就不对了；一个换算过的数字摆在静态页面上，是一道没人在核的算术。",
  "compare.rule.3": "凡是我们没能弄清楚一个数字到底指什么的，那一行会直说，并且不显示数字。这种情况比你以为的多，而这恰恰是本页我们最有把握的部分。",
  "compare.rule.4": "每个数字都带着读取它的日期和读取时所在的国家，因为价格会随这两者不同。",

  "compare.lede.jobber": "Jobber 把营销套件、AI 接线员和销售管道当作三个单独的按月加购来卖——在一个价格本来就随团队人数变动的套餐之上，再加每月 $177。FieldQuo 把这三样都放进每一个套餐、每一个价位，而且车上的人一律免费。",
  "compare.concession.jobber": "先说我们没有的。FieldQuo 是一个网页应用：没有可以从应用商店安装的东西，没信号就什么都用不了，也没有销售会带着你走一遍。",
  "compare.lede.housecall_pro": "Housecall Pro 每多一个用户就多收一份钱，所以套餐价只是你账单的起点。FieldQuo 只对真正给活定价的人收费——报价、工程、账单——车上的人都算班组，不收钱。所有功能每个套餐都有，$99 起。",
  "compare.concession.housecall_pro": "先说老实话。Housecall Pro 的页面把手机 App、离线使用和有人带的演示都列为标配。这三样 FieldQuo 一样都没有；如果其中哪一样对你是决定性的，那他们更值得买。",
  "compare.lede.servicetitan": "ServiceTitan 的价格页上任何地方都没有一个金额——你先约演示，数字再按你的营收和人数来谈。有承包商反映，除了五位数的实施费和一份好几年的合同之外，还要按技师人头按月付费。FieldQuo 的每一个价格都在本页上，没有开通费，你今晚就能开始，不用跟任何人说话。",
  "compare.concession.servicetitan": "我们给不了的，先说：没有手机 App，没有断网也能用的东西，也没有人在你决定之前带你走一遍。",
  "compare.lede.projul": "Projul 要求先按年一次性承诺。FieldQuo 是每月 $99，含一个席位和五名班组成员，所有功能都在里面，任何一个月末都可以走人——你不必先买下一整年，才知道它适不适合你。",
  "compare.concession.projul": "在说别的之前：FieldQuo 没有手机 App，没信号就用不了，也没有人会给你做演示。Projul 会给你约一场演示。",
  "compare.lede.quoteiq": "QuoteIQ 从 $29.99 起，而那个套餐不能给你做网站，不能接受预约，也不能让业主自己给自家的活估价。QuoteIQ 里装得下 FieldQuo 每个套餐都有的那些东西的，是他们的 Max 档，每月 $699。我们的是 $99——而且我们清单上有四十一项，他们的产品线里无论花多少钱都没有。",
  "compare.concession.quoteiq": "先说价格，因为你就是来看这个的。QuoteIQ 的起步价低于我们最便宜的套餐，有我们没有的手机 App，还会给你约一场实操讲解。FieldQuo 是一个网页应用，不配销售。",

  "compare.counterpoint.projul.monthly_billing": "他们的页面为年付方案讲了一番道理，而且讲得在理：Projul 说它的价格不按用户人头收费，工程数量也不设上限。经常加人的店铺，在那边可能更划算。",

  "compare.capability.mobile_app": "原生手机 App（iOS / Android）",
  "compare.capability.offline_use": "离线也能用",
  "compare.capability.self_serve_demo": "可以约销售做一场有人带的演示",
  "compare.capability.accounting_sync": "与 QuickBooks 或 Xero 双向同步",
  "compare.capability.gantt_charts": "甘特图与相互关联的工程时间线",
  "compare.capability.purchase_orders": "给供应商的采购单",
  "compare.capability.daily_logs": "每日施工日志",
  "compare.capability.geofencing": "定位与电子围栏打卡",
  "compare.capability.field_worker_quotes": "现场班组可以在车上定价并发出报价单",
  "compare.capability.entry_price_below_our_floor": "有比 FieldQuo 最便宜的一档更低的付费套餐",
  "compare.capability.ai_receptionist_no_monthly_floor": "AI 电话接线员每个套餐都有，没有每月最低消费",
  "compare.capability.self_serve_signup": "注册就能开始，不用跟任何人说话",
  "compare.capability.published_price": "价格公开，不必先跟销售通话",
  "compare.capability.monthly_billing": "按月付，不必承诺一年",
  "compare.capability.free_crew_seats": "现场班组免费包含——只对带来收入的人收费",

  "compare.teamSize.solo": "只有我一个",
  "compare.teamSize.2-5": "2-5 人",
  "compare.teamSize.6-10": "6-10 人",
  "compare.teamSize.11-15": "11-15 人",
  "compare.teamSize.16-plus": "16 人及以上",
  "compare.billing.annual_prepaid": "按年预付",
  "compare.billing.monthly_1yr": "按月付，承诺一年",
  "compare.billing.monthly_none": "按月付，无需承诺",

  "compare.comparableFeature.ai_receptionist": "AI 电话接线员",

  // ── The index page ──────────────────────────────────────────────────────
  "compare.vs": "FieldQuo 对比 {competitor}",
  "compare.preparedAsOf": "内容截至 {date}。",
  "compare.preparedAsOfLong": "内容截至 {date}。下面每个数字还带着读取当天的日期，以及读取时所在的国家。",
  "compare.readComparison": "看这组对比",

  // What one card may claim, assembled in ../../(marketing)/compare/summary.js.
  "compare.summary.amountsSourced": "他们公开的价格中，有 {count} 个可以和我们的并排放，用的是他们自己印出来的货币。",
  "compare.summary.amounts": "他们公开的价格中，有 {count} 个可以和我们的并排放。",
  "compare.summary.asserted": "其中 {count} 个在他们自己的页面上没写明货币，所以这组对比会说明货币是谁判断的，而不是当成他们写的印出来。",
  "compare.summary.onRequest": "他们有 {count} 个档位完全没有公布金额，要你自己去问。",
  "compare.summary.none": "他们公布的内容里，没有一项能和 FieldQuo 的价格作比较。",
  "compare.summary.withheldOne": "另有 {count} 个数字被压下不显示，并附上原因。",
  "compare.summary.withheld": "另有 {count} 个数字被压下不显示，每一个都附上原因。",

  // ── How a price reads ───────────────────────────────────────────────────
  //
  // {currency} is a code and {ask} is their button's own words: both arrive
  // already decided and neither is translated. {per} is resolved through
  // compare.per.* below, so the unit reads as 每月 / 每年 instead of an English
  // preposition sitting inside a Chinese sentence.
  "compare.price.amount": "${amount} {currency}／{per}",
  "compare.price.free": "免费（{currency}）",
  "compare.price.onRequest": "未公布价格——他们页面上写的是「{ask}」",
  "compare.price.notOffered": "这个人数规模不售",
  "compare.per.month": "月",
  "compare.per.year": "年",
  "compare.pricePerMonth": "每月 ${amount}",
  "compare.and": " 和 ",

  // ── How a feature's availability reads ──────────────────────────────────
  //
  // included and includedUsageExtra must NEVER collapse into one sentence.
  // Ours is the second: the receptionist is on every plan and the talk time is
  // prepaid credit, so 包含在套餐价里 beside our price would be a false claim
  // about our own price to somebody who then meets a top-up on their first call.
  "compare.availability.included": "包含在套餐价里",
  "compare.availability.includedUsageExtra": "每个套餐都有，通话时长另外按预充值额度购买",
  "compare.availability.addOn": "要在套餐之外另外付费加购",
  "compare.availability.absent": "不在这一档里",
  "compare.availability.unknown": "没有查证过",

  // ── The price section ───────────────────────────────────────────────────
  "compare.tierSeatsOne": "{seats} 个席位，另含 {crew} 名班组成员，不收费",
  "compare.tierSeats": "{seats} 个席位，另含 {crew} 名班组成员，不收费",
  "compare.sameNumberBothCurrencies": "我们销售所用的每一种货币（{currencies}）都是同一个数字——每一种里的 ${price} 都是真实的 FieldQuo 价格，所以本页不需要靠换算来把它们对齐。你按哪种货币结算，取决于注册时填写的营业地址。",
  "compare.soldIn": "以 {currencies} 销售。",
  "compare.nothingPublishable": "{competitor} 的价格页上，没有任何内容是我们可以当作价格公布的。我们手上的每个数字都列在下面，并附上不予显示的原因。",
  "compare.usersIncludedOne": "含 {count} 个用户",
  "compare.usersIncluded": "含 {count} 个用户",
  "compare.unlimitedUsers": "用户数不限，所以没有席位数可比",
  "compare.currencyNotTheirs": "金额是他们的，出自他们自己的页面；货币不是：{provenance}",
  "compare.withheldCountOne": "还有 {count} 个 {competitor} 的价格没有列在这里——要么这条记录已经过期，要么我们没能弄清楚公布的数字到底指什么。我们宁可少放一行，也不印一个自己站不住的数字。",
  "compare.withheldCount": "还有 {count} 个 {competitor} 的价格没有列在这里——要么这些记录已经过期，要么我们没能弄清楚公布的数字到底指什么。我们宁可少放一行，也不印一个自己站不住的数字。",

  // ── Their ladder, in their own words ────────────────────────────────────
  "compare.addsOverTier": "比下面一档多了：",
  "compare.onThisTier": "这一档里有：",
  "compare.aiCreditsTier": "他们的页面写明，这一档每月 {count} 个 AI 点数。",
  "compare.thisListFrom": "这份清单的来源：{provenance}",
  "compare.creditsAMonth": "每月 {count} 个点数",

  // ── The receptionist panel ──────────────────────────────────────────────
  "compare.receptionistTitle": "{feature}：两边各要多少钱",
  "compare.receptionistIntro": "档位是按内容对应的，不是按它在表格里的位置。这是我们查证过确实带这一项的、最便宜的 {competitor} 档位。",
  "compare.receptionistUnknownIntro": "{competitor} 这一项，我们答不上来。",
  "compare.featureOnThisTier": "在这一档，这项功能{availability}。",
  "compare.receptionistLowerDown": "在他们更低的档位里，它{availability}：{price}{at}。那是一个月里电话一通没响、你也照付的底价。",
  "compare.atCoordinates": "（{coordinates}）",
  "compare.ourAvailability": "它{availability}。一个月没有来电，这一项就不花钱。",
  "compare.theirWordsNotOurs": "他们的套餐在他们自己的页面上用他们自己的措辞描述，本对比不会把那些措辞当成我们的来读。他们的清单在上面，未经改动，那也正是该去他们自己网站上核对的东西。",

  // ── Where we are ahead, and where we are not ────────────────────────────
  "compare.readOnTheirSite": "在他们的网站上读到，{checked}",
  "compare.theySay": "{competitor} 说：「{claim}」。",
  "compare.entryOursNothingBelowOne": "{seats} 个席位，另含 {crew} 名班组成员，不收费。下面没有更低的了。",
  "compare.entryOursNothingBelow": "{seats} 个席位，另含 {crew} 名班组成员，不收费。下面没有更低的了。",

  // ── The head-to-head ────────────────────────────────────────────────────
  "compare.case.eyebrow": "并排来看",
  "compare.case.headlineOurs": "FieldQuo 做的每一件事，都是 {price}。",
  "compare.case.headlineTheirs": "在 {competitor}，同样这份清单是 {price}。",
  "compare.case.headlineNoPricesOurs": "FieldQuo 公布每一个价格。",
  "compare.case.headlineNoPricesTheirs": "{competitor} 一个都不公布。",
  "compare.case.sub": "我们不按档位卖功能。每个套餐都有全部功能——套餐之间只差能有多少人一起用。",
  "compare.case.missingOne": "{competitor} 还有 {count} 项，花多少钱都没有。",
  "compare.case.missing": "{competitor} 还有 {count} 项，花多少钱都没有。",
  "compare.case.missingBody": "这些全都在 {price} 的 {plan} 套餐里。",
  "compare.case.shopTitle": "像你这样规模的店铺要花多少",
  "compare.case.shopIntro": "{competitor} 对每一个登录账号都收费。我们只对给活定价的人收费；车上的人都算班组，不收钱。你每多雇一个人，这个差距就更大。",
  "compare.case.shop1": "你，加两个人在车上",
  "compare.case.shop2": "两名估价员，四个人在现场",
  "compare.case.shop3": "十一个人的店",
  "compare.case.shopSplit": "{estimators} 人做报价 · {crew} 人在现场",
  "compare.case.youKeep": "你省下",
  "compare.case.cheaperThere": "只有一个人的时候，他们那边更便宜。",
  "compare.case.calcBefore": "把你自己的数字填进",
  "compare.case.calcLink": "成本计算器",
  "compare.case.calcAfter": "里，五家并排看一遍。",
  "compare.case.wholeTitle": "每个套餐都包含的全部内容",
  "compare.case.wholeIntro": "不是精选集锦——是整个产品，以及它在 {competitor} 的套餐里有没有出现过。",
  "compare.case.both": "两边都有",
  "compare.case.only": "只有 FieldQuo 有",

  // ── The head-to-head rows ───────────────────────────────────────────────
  "compare.rows.perMo": "{amount}／月",
  "compare.rows.perYr": "{amount}／年",
  "compare.rows.usersOne": "{count} 个用户",
  "compare.rows.users": "{count} 个用户",
  "compare.rows.unlimitedUsers": "用户数不限",
  "compare.rows.cheapestPlan": "最便宜的套餐",
  "compare.rows.soloSub": "{plan} —— 1 个席位，{crew} 名班组成员免费",
  "compare.rows.annualEquivalent": "{plan} —— 折合每月 {amount}，按年结算",
  "compare.rows.tierUsers": "{plan} —— {users}",
  "compare.rows.parityLabel": "包含 FieldQuo 每个套餐都有的那些东西的最便宜套餐",
  "compare.rows.paritySub": "还是同一个套餐。我们不按档位锁功能。",
  "compare.rows.parityAnnual": "{plan} —— 折合每月 {amount}",
  "compare.rows.parityTheirs": "{plan} —— 他们更便宜的套餐里没有这些",
  "compare.rows.publishedPrice": "公开的价格",
  "compare.rows.everyPlanOnThisPage": "每个套餐，都在本页上",
  "compare.rows.nonePublished": "一个也没公布",
  "compare.rows.bookDemo": "先约演示；数字在通话里谈",
  "compare.rows.whatItCosts": "要花多少钱",
  "compare.rows.oneToTwentyFive": "1 到 25 人",
  "compare.rows.reportedNotPublished": "来自承包商的反映，非官方公布",
  "compare.rows.setupFee": "开通费",
  "compare.rows.none": "没有",
  "compare.rows.reported": "据反映",
  "compare.rows.howYouPay": "怎么付",
  "compare.rows.monthly": "按月",
  "compare.rows.leaveAnyMonth": "任何一个月末都能走",
  "compare.rows.aYearUpFront": "每年 {amount}，先付",
  "compare.rows.noMonthlyOption": "不提供按月付的选项——他们的 FAQ 里就是这么写的",
  "compare.rows.paidAddOns": "作为付费加购单卖",
  "compare.rows.everyFeature": "所有功能都在每个套餐里，按套餐价",
  "compare.rows.plusPerMo": "+{amount}／月",
  "compare.rows.peopleInField": "在现场的人",
  "compare.rows.free": "免费",
  "compare.rows.crewFreeSub": "班组能看排期和工程，不收费",
  "compare.rows.billed": "要计费",
  "compare.rows.everyLoginPaid": "在 {competitor}，每一个登录账号都是付费用户",
  "compare.rows.biggestPlan": "最大的套餐",
  "compare.rows.biggestSub": "{seats} 个席位加 {crew} 名班组成员 —— 25 人",
  "compare.rows.onRequest": "需询价",
  "compare.rows.everyPlan": "每个套餐",
  "compare.rows.tierAtPrice": "{plan} —— {amount}／月",
  "compare.rows.theirCheapestWithIt": "他们包含这一项的最便宜套餐",
  "compare.rows.notInTheirPlans": "他们的套餐里没有",
  "compare.rows.freeTrial": "免费试用",
  "compare.rows.firstMonthFree": "首月免费",
  "compare.rows.noCardCharged": "结束之前不扣卡",
  "compare.rows.trialOffered": "提供试用",
  "compare.rows.seeTheirSite": "现行条款以他们网站为准",

  // ── The add-on stack ────────────────────────────────────────────────────
  //
  // Rendered on /compare/fieldquo-vs-jobber AND on /pricing. These were the
  // keys the owner's report was actually about: the block had t() calls with
  // English fallbacks and no catalogue entries behind them, so every language
  // fell through to English on an otherwise translated page.
  "addOns.title": "{competitor} 另外收费的 {count} 项",
  "addOns.intro": "在他们自己的价格页上，这几项都加在套餐之上，各有各的月费。而这里面的每一项，FieldQuo 都在你已经付钱的那个套餐里做了。",
  "addOns.scope": "我们只从他们的价格页上读了名称和价格，别的没读。他们的加购项里到底装着什么，我们没有查过，所以下面没有一句是在描述它的内容。",
  "addOns.money": "${amount} {currency}／{per}",
  "addOns.provenance": "{checked} 从 {country} 的网络连接读取",
  "addOns.sourceLink": "他们的价格页",
  "addOns.oursTitle": "在 FieldQuo，每个套餐里都有：",
  "addOns.limits": "到哪儿为止：",
  "addOns.total": "每月 {total} {currency}，加在套餐价之上。",
  "addOns.totalBody": "这是我们在他们自己的选项上读取时，那三项加起来的价钱。在 FieldQuo，同样这三件事每个套餐都做，任何人数规模都做，从本页最便宜的那个套餐起。",
  "addOns.receptionist": "他们的接线员加购是一道月度底线：哪怕这个月电话一通没响，也照收。我们没有每月最低消费。这项功能每个套餐都有，通话时长是你需要时才买的预充值额度，所以清闲的二月不为它花一分钱。",

  // ── /pricing's own line under the add-on stack ──────────────────────────
  //
  // Referenced by PricingPlans.js since the block was written and never
  // defined, which is the second half of the same reported bug.
  "pricing.addOnsCompare": "上面每一个数字，都是在标注的日期从他们自己的价格页上读到的。完整的并排对比，包括 FieldQuo 做不到的事，在这里 →",
};

export default zh;
