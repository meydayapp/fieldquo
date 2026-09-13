// app/i18n/productPages/zh.js
//
// 中文，跟目录其余部分一样用工地上的白话，不用书面营销腔。
//
// 沿用已经上线的词：报价单、账单、工时表、承包工、保本价、经营开销、工种、
// 班次（shift）、打卡（time clock）、工资单（payroll）、调度员（dispatcher）、
// 当天排班板（day board）、顶班（cover）、换班（trade）。
// "conversion rate" 在最后一条里译成"成交率"——同一目录里 win rate 也是
// 成交率，在这个行业里本来就是同一个比例；若哪天两者要分开，这里最先看得出来。

const zh = {

  // /product/quoting
  "productPage.quoting.headline": "几分钟就把一份像样的报价单发出去",
  "productPage.quoting.description":
    "按你自己每项服务的价格做报价单，附上照片，让客户在线批准——不用打印，不用来回打电话。",
  "productPage.quoting.bullet.1": "按服务类别用你自己的价格，不是通用模板",
  "productPage.quoting.bullet.2": "客户在线批准并电子签字",
  "productPage.quoting.bullet.3": "一键把接受的报价单变成账单",
  "productPage.quoting.bullet.4": "改一张已发出的账单，旧的照样保留——当初谈好的是什么，从来不会说不清",
  "productPage.quoting.section.pricebook.heading": "你的服务、你的价格，设一次就好",
  "productPage.quoting.section.pricebook.body":
    "你做的每项服务都有自己的价目表——按平方、按延英尺、按小时，工种怎么算就怎么定。设一次，每张报价单自动填好。产品清单可以从表格导入，也能导出回去。",
  "productPage.quoting.section.pricebook.bullet.1": "每项服务一张价目表，用的是你这个工种真正在用的单位",
  "productPage.quoting.section.pricebook.bullet.2": "产品和服务从 CSV 导入，同样导出",
  "productPage.quoting.section.pricebook.bullet.3": "价格背后的材料成本和配方，永远不给客户看",
  "productPage.quoting.section.pricebook.alt":
    "“服务与价格”页面：屋顶、外墙板和天沟，各有各的价目表和计价用的材料",
  "productPage.quoting.section.builder.heading": "在客户家里就把报价单做出来",
  "productPage.quoting.section.builder.body":
    "点一下服务，你自己的价格就填进来。按房间或按范围把行分组，附上客户发来的照片，成本和利润放在客户永远看不到的面板里。",
  "productPage.quoting.section.builder.bullet.1": "按房间或范围分组，报价单读起来跟活儿的顺序一样",
  "productPage.quoting.section.builder.bullet.2": "客户的照片和视频留在报价单上，一直带到账单",
  "productPage.quoting.section.builder.bullet.3": "成本和利润就在价格旁边算——班组工时、材料、经营开销",
  "productPage.quoting.section.builder.alt":
    "报价单编辑器：客户、负责人、点一下就加的服务，以及内部的成本与利润面板",
  "productPage.quoting.section.review.heading": "发出前先审一遍，再加上客户可以勾选的加项",
  "productPage.quoting.section.review.body":
    "报价单发出去之前，FieldQuo AI 先读一遍：你漏写了什么，这个价格跟你已经拿下的报价比起来怎么样，哪些措辞可以更清楚。推荐的加项按你自己的历史定价，作为可选项出现在批准页面上，由客户勾选。",
  "productPage.quoting.section.review.bullet.1": "缺了什么、价格比起来怎么样、哪里要改措辞",
  "productPage.quoting.section.review.bullet.2": "只跟你自己被接受的报价单比——绝不跟别家比",
  "productPage.quoting.section.review.bullet.3": "加项的价格在你这边定；客户只选要不要",
  "productPage.quoting.section.review.alt":
    "AI 审核面板给一份报价单打了 76 分（满分 100），列出发出前值得改的三处",
  "productPage.quoting.section.approval.heading": "客户在手机上批准并签字",
  "productPage.quoting.section.approval.body":
    "报价单从你的邮箱地址发出，带着你的 logo 和你的颜色，打开的是一个写着你公司名字的页面。客户选加项、签字，活儿就定了。签字那一刻他看到的内容，和签名一起保存下来。",
  "productPage.quoting.section.approval.bullet.1": "你的 logo、你的颜色、你的名字——哪里都没写 FieldQuo",
  "productPage.quoting.section.approval.bullet.2": "签名和客户当时看到的那份文件一起记录",
  "productPage.quoting.section.approval.bullet.3": "报价单保持写它时用的语言；签过字的文件一个字都不会变",
  "productPage.quoting.section.invoice.heading": "一键出账单，客户用手机付款",
  "productPage.quoting.section.invoice.body":
    "批准的报价单变成一张长得跟报价单一样的账单，因为它就是从报价单生成的。可以收定金，可以把大活儿分成几期，客户用银行卡或银行扣款付——钱进你自己的账户，绝不进我们的。",
  "productPage.quoting.section.invoice.bullet.1": "改一张已开出的账单，之前的版本保留",
  "productPage.quoting.section.invoice.bullet.2": "定金和分期付款，按你定的时间表去要",
  "productPage.quoting.section.invoice.bullet.3": "银行卡，或加拿大和美国的银行扣款，直接打到你的账户",
  "productPage.quoting.section.invoice.alt":
    "新建账单页面：明细行和内部的成本与利润面板",
  "productPage.quoting.section.instant.heading": "网站上的即时估价",
  "productPage.quoting.section.instant.body":
    "访客答几个问题——或者按地址把屋顶描出来——就能按你设的价格拿到一个价格区间。在任何事情具有约束力之前，它先进入你的审核队列，而你的价目表本身从不公开。",
  "productPage.quoting.section.instant.bullet.1": "马上显示区间、提交后显示，或者根本不显示——每项服务由你选",
  "productPage.quoting.section.instant.bullet.2": "每份估价都在“估价审核”里等你确认或调整",
  "productPage.quoting.section.instant.bullet.3": "自助报价表：房主自己描述活儿、上传照片",
  "productPage.quoting.section.instant.alt":
    "即时报价设置：按地址测量的屋顶、房主看到的内容，以及预算档位",
  "productPage.quoting.faq.white-label.q": "我的客户会在哪里看到 FieldQuo 吗？",
  "productPage.quoting.faq.white-label.a":
    "不会。报价单、账单、批准页面、邮件和 PDF 上都是你的 logo、你的颜色，发件人是你的名字。我们的名字只出现在两个很小的地方：你的公司还没用付费方案时，网站页脚有一行“Site by FieldQuo”——一付费就没了；还有个人链接页底部一行“Made by FieldQuo”。",
  "productPage.quoting.faq.own-prices.q": "我能用自己的价格吗？",
  "productPage.quoting.faq.own-prices.a":
    "只能用你自己的。每项服务从你这个工种的常见价格起步，明确标为起点，由你按自己的市场改；报价单编辑器填的是你的数字，绝不是我们的。价目表也可以从表格导入，再导出回去。",
  "productPage.quoting.faq.after-approval.q": "客户批准之后会怎样？",
  "productPage.quoting.faq.after-approval.a":
    "报价单变成一个活儿，范围、地址和文件都已经在上面，再一键就变成一张跟报价单一致的账单。如果你要了定金，批准时就会去收。",
  "productPage.quoting.faq.instalments.q": "客户可以分期付吗？",
  "productPage.quoting.faq.instalments.a":
    "你可以把账单分成几期，每一期按你的时间表去要。结账时的分期付款通过 Stripe 提供，由放贷方决定——FieldQuo 不放贷，也不审批任何人。",

  // /product/scheduling
  "productPage.scheduling.headline": "每个人、每个小时，都在一块板上",
  "productPage.scheduling.description":
    "排好班组的一天和一周，发布一次，每个人都在手机上看到自己的班次。你在工地的时候，客户按你的真实空档预约上门。",
  "productPage.scheduling.bullet.1": "当天排班板：一人一行，一小时一列",
  "productPage.scheduling.bullet.2": "发布之前，班组看不到任何班次",
  "productPage.scheduling.bullet.3": "公开预约页面，带你的 logo 和颜色",
  "productPage.scheduling.bullet.4": "缓冲时间和每个人各自的空档，不是通用日历",
  "productPage.scheduling.hero.alt":
    "当天排班板：五个人各一行，小时是列，一人休假，一人已打卡，顶上是覆盖条",
  "productPage.scheduling.section.board.heading": "当天排班板：谁在哪，一小时一小时看",
  "productPage.scheduling.section.board.body":
    "一人一行，一小时一列。一个班次是一个方块，午饭和休息都画在里面；人一打卡，圆点就变绿变黄；批了假的人显示为“不在”一整行，谁也不会误排到他。",
  "productPage.scheduling.section.board.bullet.1": "覆盖条告诉你每个小时工地上还剩几个人——营业时间里缺人的地方标红",
  "productPage.scheduling.section.board.bullet.2": "排在某人声明的空档之外的草稿用虚线标出来，不会悄悄放过",
  "productPage.scheduling.section.board.bullet.3": "“迟到”和“准时”标签由打卡跟班次对比得出，直接标在方块上",
  "productPage.scheduling.section.board.alt":
    "老板视角的当天排班板：当天和本周的人工成本行、加班时数，以及班次上的“迟到”和“准时”标签",
  "productPage.scheduling.section.week.heading": "排好一周，只发布一次",
  "productPage.scheduling.section.week.body":
    "周视图是同样的班次按星期排开。一个班次可以一次套用到好几天，可以挂出谁都能认领的空班，发布前先在页脚看一眼工时和工资。你不发布，班组什么都看不到。",
  "productPage.scheduling.section.week.bullet.1": "按星期“套用到”的开关：周一设一次，勾上另外四天",
  "productPage.scheduling.section.week.bullet.2": "空班单独一行，直到有人认领",
  "productPage.scheduling.section.week.bullet.3": "工时、加班，以及——有工资权限时——按天按周的工资总额",
  "productPage.scheduling.section.week.alt":
    "周视图：“事件”和“空班”两行，每人每天一个班次，页脚是工资和工时",
  "productPage.scheduling.section.phone.heading": "发布了，就在每个人的手机上",
  "productPage.scheduling.section.phone.body":
    "你一发布，每个人的手机都会收到通知，班次挪了会再通知一次。他的排班是一天一张卡：活儿、地址、还有谁一起、你留的备注，今天那张卡上有个“打卡上班”按钮。",
  "productPage.scheduling.section.phone.bullet.1": "班次发布、挪动或取消时都有通知——草稿永远不会到手机上",
  "productPage.scheduling.section.phone.bullet.2": "同一班次的同事、工地备注和节假日那一行",
  "productPage.scheduling.section.phone.bullet.3": "从当天的卡片直接打卡；把排班加进手机日历",
  "productPage.scheduling.section.phone.alt":
    "手机上的“我的排班”：一天一张卡，有活儿、地址、同班的人和一个“打卡上班”按钮",
  "productPage.scheduling.section.requests.heading": "换班、顶班和请假，由该管的经理审批",
  "productPage.scheduling.section.requests.body":
    "工人在手机上找人顶班；同事先接，经理再批，每一步大家都收到通知。请假按你定的规矩走，余额自动累计，有封锁日期，还有你所在省或州的法定假日。",
  "productPage.scheduling.section.requests.bullet.1": "换班、找人顶班、认领空班——都在申请中心",
  "productPage.scheduling.section.requests.bullet.2": "请假规矩带余额、同时休假人数上限和封锁日期",
  "productPage.scheduling.section.requests.bullet.3": "空档变更从某一天起生效，排班板提前就知道",
  "productPage.scheduling.section.requests.alt":
    "申请中心：请假、换班、顶班和空档，下面列着工人自己的申请",
  "productPage.scheduling.section.booking.heading": "你在干活，预约页面在帮你填日历",
  "productPage.scheduling.section.booking.body":
    "客户按将要上门那个人的真实空档选时间，活儿之间留出路上时间，再加一个你承诺的到达时段，页面上写着你的名字。上门前发一条短信，还有一个让他们自己改时间的链接。",
  "productPage.scheduling.section.booking.bullet.1": "活儿之间的路上缓冲和到达时段——精确、±15、±30 或 ±60 分钟",
  "productPage.scheduling.section.booking.bullet.2": "预约时收一笔上门费，之后抵扣到账单里",
  "productPage.scheduling.section.booking.bullet.3": "上门前短信提醒；客户从链接里改时间，不用打电话给你",
  "productPage.scheduling.section.booking.alt":
    "预约页面设置：嵌入代码、一次上门多长、路上缓冲和承诺给客户的到达时段",
  "productPage.scheduling.section.clock.heading": "对着活儿打卡，休息也算",
  "productPage.scheduling.section.clock.body":
    "班组用随便哪部手机打卡，对着正在干的活儿——或者不对着任何活儿，因为赶路和在场子里也是实打实的工时。午饭和休息也打卡。按下去那一刻，手机只问一次位置；工时表随后显示那一下离工地多远。两次打卡之间不跟踪任何人。",
  "productPage.scheduling.section.clock.bullet.1": "今天两趟上门？打卡时问你是哪一趟；“没有活儿”永远是个诚实的选项",
  "productPage.scheduling.section.clock.bullet.2": "带薪和不带薪的休息，都在手机上打",
  "productPage.scheduling.section.clock.bullet.3": "只在打卡那一下记位置，中间绝不记——拒绝也不影响打卡",
  "productPage.scheduling.section.clock.alt":
    "打卡页面：当前时间、哪个活儿，以及“打卡上班”按钮",
  "productPage.scheduling.faq.phone.q": "我的班组需要装什么吗？",
  "productPage.scheduling.faq.phone.a":
    "不用。FieldQuo 在手机自带的浏览器里运行，可以固定到主屏幕，像别的图标一样打开。没有东西要安装，也没有东西要更新。",
  "productPage.scheduling.faq.reminders.q": "客户怎么收到提醒？",
  "productPage.scheduling.faq.reminders.a":
    "上门前发短信，附一个改时间或取消的链接。目前还没有邮件提醒，提醒的措辞也是固定的——能改的是“我在路上”那条短信。",
  "productPage.scheduling.faq.crew-sees.q": "工人能看到什么？",
  "productPage.scheduling.faq.crew-sees.a":
    "自己的班次、派给他的活儿、要为这些活儿买什么，以及自己的工时。看不到价格、报价单、账单，也看不到别人的申请——除非你给他单独开权限。",
  "productPage.scheduling.faq.book-account.q": "客户预约需要注册账号吗？",
  "productPage.scheduling.faq.book-account.a":
    "不需要。预约页面只要姓名、电话和地址，确认信息里带着管理这次上门的链接。",

  // /product/team
  "productPage.team.headline": "给团队权限，但控制权还在你手里",
  "productPage.team.description":
    "工人、估价员、调度员和经理各有预设权限，谁需要不一样的，每个板块单独拨一下，再加上每人一份档案：证件、入职、制度、工时和工资。",
  "productPage.team.bullet.1": "工人、估价员、调度员、经理四个预设，之后每人每个板块单独调",
  "productPage.team.bullet.2": "工时表绑着真实的活儿，不靠猜",
  "productPage.team.bullet.3": "从批准的工时生成工资批次和工资单",
  "productPage.team.bullet.4": "员工证件、入职和制度，都在一份档案里",
  "productPage.team.hero.alt":
    "经理的主页：今天的付薪工时和工资、两趟待派的上门、团队状态，以及等待审核的申请",
  "productPage.team.section.access.heading": "职位只是个称呼；权限是一个个开关",
  "productPage.team.section.access.body":
    "先选一个预设——工人、估价员、调度员、经理——再给这个人单独调任何一个开关：排班、工时表、工资、客户、报价单、活儿、账单，各能看到多少。这是在服务器上生效的，不只是屏幕上藏个按钮。",
  "productPage.team.section.access.bullet.1": "四个预设加一个自定义编辑器，每个板块一个开关",
  "productPage.team.section.access.bullet.2": "“显示价格”“活儿成本”和“收款”是各自独立的开关",
  "productPage.team.section.access.bullet.3": "工人登录免费；席位留给写报价单和账单的人",
  "productPage.team.section.access.alt":
    "新成员的权限面板：工人、估价员、调度员、经理四个预设，下面每个板块一个开关",
  "productPage.team.section.home.heading": "每个人自己的主页，在自己的手机上",
  "productPage.team.section.home.body":
    "工人打开 FieldQuo，看到下一个班次、你留的备注、今天挣了多少，还有真正用得上的几个按钮：打卡、找人顶班、换班、发消息。经理打开，看到当天的付薪工时、还没派出去的上门、谁在工地，以及等着拍板的申请。",
  "productPage.team.section.home.bullet.1": "下一个班次：活儿、地址，还有谁一起",
  "productPage.team.section.home.bullet.2": "找人顶班、换班、请假——都在同一个页面",
  "productPage.team.section.home.bullet.3": "经理视角：派工、团队状态，以及需要审核的事",
  "productPage.team.section.home.alt":
    "手机上的员工主页：下午好，下一个班次、班次备注、“找人顶班”和“换班”，以及“打卡下班”",
  "productPage.team.section.hr.heading": "每人一份人事档案",
  "productPage.team.section.hr.body":
    "执照、证书和资质，到期前有提醒。新人入职清单里，TD1 或 W-4 在手机上填好，存进档案——FieldQuo 不向任何税务机关申报，也从不索要社会保险号。制度有版本，用打出的姓名确认，合规视图显示谁还缺什么。",
  "productPage.team.section.hr.bullet.1": "证件带到期日，到期前提醒",
  "productPage.team.section.hr.bullet.2": "入职清单：要填的表、要上传的证件、要签的制度",
  "productPage.team.section.hr.bullet.3": "经理的记录簿：备注和书面警告，跟人存在一起",
  "productPage.team.section.hr.alt":
    "人事与合规：一人一行，显示待核验的证件、入职进度、未签的制度和书面警告",
  "productPage.team.section.chat.heading": "每个活儿一个聊天室，公司还有一个",
  "productPage.team.section.chat.body":
    "每个活儿都有一个聊天室，干这个活儿的班组和办公室共用，抽屉面板划伤的照片就在活儿旁边，而不是在谁的短信里。群聊和私信就在旁边，支持 @提及，手机和电脑都能用。",
  "productPage.team.section.chat.bullet.1": "一个活儿一个房间，从活儿打开，也能回到活儿",
  "productPage.team.section.chat.bullet.2": "群聊、私信和 @提及",
  "productPage.team.section.chat.bullet.3": "每个房间有未读计数，在手机上",
  "productPage.team.section.chat.alt":
    "团队聊天：一个活儿的房间，班组在讨论台面模板和开工前的现场确认，一条 @提及被高亮",
  "productPage.team.section.timesheets.heading": "工时表来自真实打卡，带着标记",
  "productPage.team.section.timesheets.body":
    "工时带着打卡时对应的活儿和班次一起进来。排班板显示谁迟到、迟到多久，谁本周超过四十小时，以及——对有工资权限的人——当天和本周的工资花了多少。工时先经你批准，才可能变成工资。",
  "productPage.team.section.timesheets.bullet.1": "迟到还是准时，由打卡跟班次对比得出，不靠记忆",
  "productPage.team.section.timesheets.bullet.2": "一周累积过程中，每个人的加班都标出来",
  "productPage.team.section.timesheets.bullet.3": "当天和本周的工资总额，对没有工资权限的人隐藏",
  "productPage.team.section.timesheets.alt":
    "调度员视角的当天排班板：排定的工时、超过四十小时的加班、“迟到”和“准时”标签，以及一句说明：人工成本只给能看工资标准的人看",
  "productPage.team.section.payroll.heading": "从批准的工时生成工资批次和工资单",
  "productPage.team.section.payroll.body":
    "批准的工时乘以每个人的工资标准，就是你选定周期的一个工资批次，每人一张工资单，再导出给会计。FieldQuo 算的是应发工资；它不给员工发钱，也不申报工资税。花名册上标为承包工的人，可以按打卡的工时通过真实转账付到他的银行账户。",
  "productPage.team.section.payroll.bullet.1": "按你的周期发薪，工资单是 PDF，批次可导出",
  "productPage.team.section.payroll.bullet.2": "花名册上的承包工按打卡工时、按你定的标准付款",
  "productPage.team.section.payroll.bullet.3": "分包公司存档，带保险信息和年末 T5018 清单",
  "productPage.team.section.payroll.alt":
    "工资：本期批准的工时、应发、扣除和实发，以及正在设置的新工资批次",
  "productPage.team.faq.taxes.q": "FieldQuo 会申报工资税吗？",
  "productPage.team.faq.taxes.a":
    "不会。它从批准的工时算出应发工资，生成工资单并导出批次。扣除项由你或你的会计提供，不会向任何税务机关申报。",
  "productPage.team.faq.crew-free.q": "工人登录免费吗？",
  "productPage.team.faq.crew-free.a":
    "免费。工人登录能看自己的排班、打卡上下班、归档照片——不占你的席位。席位是给创建和修改报价单、活儿和账单的人的。",
  "productPage.team.faq.see-pay.q": "调度员能看到我给谁付多少吗？",
  "productPage.team.faq.see-pay.a":
    "除非你给他工资权限。没有的话，排班板只显示工时和加班，并说明为什么没有钱数。每一个工资标准、每一个工资数字都在服务器上隐藏，不只是屏幕上不显示。",
  "productPage.team.faq.leaves.q": "有人离职怎么办？",
  "productPage.team.faq.leaves.a":
    "把他停用。他的工时、证件和记录留在档案里；他不能再登录，席位空出来给下一个人。",

  // /product/analytics
  "productPage.analytics.headline": "先把账算清楚，别靠猜",
  "productPage.analytics.description":
    "看清你真实的经营开销、每个活儿的保本价，以及你的价格跟同行比处在什么位置——还有一个能回答你自己生意问题的 AI 助手。",
  "productPage.analytics.bullet.1": "花钱速度和最低价，按你真实的开支算出来",
  "productPage.analytics.bullet.2": "营销花费按渠道拆开——Facebook、Google、TikTok 等等",
  "productPage.analytics.bullet.3": "匿名看看你的价格跟同行比怎么样",
  "productPage.analytics.bullet.4": "问 FieldQuo AI 这样的问题：“我的成交率正常吗？”",
  "productPage.analytics.section.kpis.heading": "KPI 面板：销售、钱、成本、利润、执行",
  "productPage.analytics.section.kpis.body":
    "成交率、单个活儿平均金额、线索到报价的转化、按天的收入对支出、人工占收入的比例、按时完工率。每个数字都来自 FieldQuo 里已有的内容——不用连银行，不用表格。背后没有数据的卡片会说明原因，而不是显示一个零。",
  "productPage.analytics.section.kpis.bullet.1": "本月、上月、本季度、年初至今或去年",
  "productPage.analytics.section.kpis.bullet.2": "财务报表、赢单与丢单、估价准确度，各是独立的报表",
  "productPage.analytics.section.kpis.bullet.3": "每周摘要，加上一份用句子而不是图表写的月度总结",
  "productPage.analytics.section.kpis.alt":
    "KPI 面板：销售卡片、按天收入对支出的资金流，以及经营成本",
  "productPage.analytics.section.overhead.heading": "经营开销，以及由此算出的最低价",
  "productPage.analytics.section.overhead.body":
    "房租、保险、电话、办公室工资、卡车贷款，还有卡车每个月掉的价——输入一次。告诉 FieldQuo 班组正常一周接几个活儿，它就告诉你一个活儿最低能报多少还能养住这门生意。",
  "productPage.analytics.section.overhead.bullet.1": "固定成本、工资、贷款、资产和折旧、待付账单",
  "productPage.analytics.section.overhead.bullet.2": "没落到任何活儿上的付薪工时算进经营开销，不藏起来",
  "productPage.analytics.section.overhead.bullet.3": "做报价单的时候，最低价就在总价旁边",
  "productPage.analytics.section.overhead.alt":
    "经营开销页面：每周活儿数、没落到活儿上的付薪工时，以及固定成本、工资和贷款几个板块",
  "productPage.analytics.section.expenses.heading": "开支、花钱速度和现金能撑多久",
  "productPage.analytics.section.expenses.body":
    "记下花的钱，或者从银行对账单 CSV 一次导入一个月，把属于活儿的和属于公司的分开。每月的花钱速度，以及手上的现金还能撑多久，都由此算出。",
  "productPage.analytics.section.expenses.bullet.1": "从银行 CSV 导入；从不登录你的银行",
  "productPage.analytics.section.expenses.bullet.2": "活儿开支对公司开支，按类别，看六个月",
  "productPage.analytics.section.expenses.bullet.3": "营销花费按渠道，可从 Meta Ads 自动导入",
  "productPage.analytics.section.expenses.alt":
    "开支跟踪：本月已记开支、每月花钱速度、现金能撑多久、明细拆分和六个月趋势",
  "productPage.analytics.section.costing.heading": "活儿成本：报的价对上实际的花费",
  "productPage.analytics.section.costing.body":
    "报价单带着一个估算成本——班组工时、按配方算的材料、一份经营开销——客户永远看不到。活儿干完后，打卡的工时、买的材料和记的开支放到价格对面，你就知道实际挣了多少，哪些估价超了。",
  "productPage.analytics.section.costing.bullet.1": "人工、材料和开支对上报价，一个活儿一个活儿看",
  "productPage.analytics.section.costing.bullet.2": "估价准确度：你已完工活儿的中位偏差",
  "productPage.analytics.section.costing.bullet.3": "活儿超过你设的阈值时，提醒你修正成本算法",
  "productPage.analytics.section.costing.alt":
    "报价单上的“成本与利润”面板：班组工时、经营开销占价格的比例、材料和人工，以及估算成本对报价",
  "productPage.analytics.section.benchmark.heading": "你的价格跟同行比怎么样，谁也不点名",
  "productPage.analytics.section.benchmark.body":
    "选择加入后，你按服务类别的平均报价会跟平台上同行其他店铺的匿名平均值放在一起。你的单张报价单绝不共享，也不点名任何一家公司——包括你的。",
  "productPage.analytics.section.benchmark.bullet.1": "在设置里选择加入；你不说，什么都不比",
  "productPage.analytics.section.benchmark.bullet.2": "按服务类别的平均价格和成交率",
  "productPage.analytics.section.benchmark.bullet.3": "只有汇总平均——店铺太少的类别什么都不显示",
  "productPage.analytics.section.benchmark.alt":
    "加入前的“同行对比”：说明对比需要选择加入，以及去设置的链接",
  "productPage.analytics.section.ai.heading": "问 FieldQuo AI 你自己的生意",
  "productPage.analytics.section.ai.body":
    "哪些客户还没开账单？我这个月的平均报价是多少？哪些材料涨得最厉害？FieldQuo AI 在你自己的报价单、账单、客户和成本里查答案，而不是猜。它只回答关于你公司的问题：拒绝泛泛的提问，也绝不看别家公司的数据。",
  "productPage.analytics.section.ai.bullet.1": "答案来自你自己的数字，并告诉你用了哪些",
  "productPage.analytics.section.ai.bullet.2": "跟你生意无关的一律拒绝",
  "productPage.analytics.section.ai.bullet.3": "按 AI 额度计量，每个方案都含一定额度",
  "productPage.analytics.section.ai.alt":
    "FieldQuo AI：四个可以试试的问题——没开账单的客户、平均报价金额、材料成本、没回音的报价单",
  "productPage.analytics.faq.other-data.q": "AI 会看到其他公司的数据吗？",
  "productPage.analytics.faq.other-data.a":
    "不会。FieldQuo AI 只读你自己公司的记录。价格对比用的是你选择加入的匿名平均值；你的报价单不会给任何人看。",
  "productPage.analytics.faq.general.q": "我能问它泛泛的问题吗？",
  "productPage.analytics.faq.general.a":
    "不能。它回答关于你自己生意的问题——你的报价单、活儿、账单、客户、成本和工时——其他一律拒绝。它不是通用助手。",
  "productPage.analytics.faq.bank.q": "我需要连接银行吗？",
  "productPage.analytics.faq.bank.a":
    "不需要，也连不了。收入来自 FieldQuo 里记录的收款；开支是你记下的，或者从你自己下载的银行对账单 CSV 导入的。",
  "productPage.analytics.faq.benchmark-source.q": "对比的数字从哪来？",
  "productPage.analytics.faq.benchmark-source.a":
    "来自 FieldQuo 上同样选择加入的同行公司，按服务类别取平均，不点名任何一家。背后公司太少的类别宁可什么都不显示，也不给一个误导的数字。",

  // Page furniture shared by all four
  "productPage.chrome.readHow": "看看它是怎么运作的",
  "productPage.chrome.inEnglish": "英文",
  "productPage.chrome.everythingTitle": "{label}包含的全部内容",
  "productPage.chrome.everythingBody":
    "这里列出的每一项功能今天都在产品里。哪一项有边界，会写清楚。",
  "productPage.chrome.faqTitle": "常见问题",
};

export default zh;
