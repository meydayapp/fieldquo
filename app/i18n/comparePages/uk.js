// app/i18n/comparePages/uk.js
//
// Ukrainian. Register is "ти-neutral plural" — the reader is addressed as «ви»
// throughout, plain and unadorned, matching the blunt English rather than the
// softer marketing Ukrainian these pages could easily drift into.
//
// Terms coined here, and why:
//   • "AI (phone) receptionist" → «ШІ-секретар на телефоні». «Ресепшіоніст» is
//     a real loanword but reads like a hotel desk; a contractor's phone is
//     answered by a секретар. The «на телефоні» half is what stops it being
//     read as an office assistant feature.
//   • "crew" → «бригада», "seat" → «місце», "shop" → «фірма». «Бригада» is the
//     ordinary trades word and keeps the free-vs-billed distinction audible.
//   • availability.* are written as feminine adjectival phrases agreeing with
//     «функція», because two of the three sentences they slot into use that
//     noun. That is why absent is «відсутня» and not «немає в тому тарифі» —
//     the tier lives in compare.featureOnThisTier's own frame instead, so the
//     sentence does not name the tier twice the way the English does.
//   • "Marketing Suite" is kept in Latin script even though the English lede
//     lowercases it, because it is Jobber's own product name.
//
// Plurals: Ukrainian has three forms and this catalogue has two keys. The
// plain key is written in the genitive plural (the 5+/0 form), which is the
// commonest case and the one a withheld-figure count usually lands in; counts
// of 2-4 will read slightly off («2 цифр» rather than «2 цифри»). Fixing that
// needs a third key, not a better translation.
//
// Not translated, per the English header: FieldQuo, competitor names and their
// tier names, QuickBooks, Xero, iOS, Android, CSV, FAQ, currency codes, every
// {placeholder}, and every amount.

const uk = {
  "compare.eyebrow": "Порівняння",
  "compare.indexTitle": "Порівняйте FieldQuo",
  "compare.indexLede": "П’ять порівнянь, кожне зібране з того, що інша компанія публікує на власному сайті. Тут ніщо не конвертується між валютами, ніщо не є акційною ціною, а все, чого ми не змогли з’ясувати, назване, а не вгадане. Одна з п’яти стартує дешевше за нас, і та сторінка говорить про це раніше, ніж про будь-що інше.",
  "compare.rulesTitle": "Як зроблені ці сторінки",
  "compare.entryGapTitle": "Вони стартують дешевше за нас",
  "compare.entryGapIntro": "Не кожне порівняння на цьому сайті на нашу користь, і це — ні. Дві ціни нижче — їхня опублікована цифра і наш власний найдешевший щабель, обидві взяті з тих самих записів, якими користується решта сторінки.",
  "compare.entryGapTheirListIntro": "Що їхня власна сторінка перелічує в цьому плані, їхніми словами:",
  "compare.entryGapAdvice": "Якщо це та робота, яка вам потрібна, купуйте їхнє. Ми радше напишемо це тут, ніж продамо комусь більше програми, ніж він використає, і зустрінемося з ним знову на поверненні грошей. Відповідь змінює бригада: їхні плани рахують кожен логін як платного користувача, а наші — ні.",
  "compare.theirTiersTitle": "Що додає кожен їхній план, їхніми словами",
  "compare.theirTiersIntro": "Їхні власні описи їхніх власних тарифів, процитовані так, як їх подає їхня сторінка, і поставлені поруч із ціною, до якої приходить кожен. Ми нічого з цього не переклали нашим словником: перейменувати функцію конкурента під одну з наших — це те, як порівняння тихо перетворюється на бій із солом’яним опудалом, тож слова нижче — їхні, а список наших — далі на цій сторінці, окремо.",
  "compare.theirTiersNoMatchNote": "Ніхто не встановив, функція за функцією, який із їхніх тарифів несе які з можливостей, що продаємо ми. Їхня сторінка описує свої плани прозою, а наше дослідження не фіксує відповіді за тарифами, тож ця сторінка не робить зіставленого твердження в жодному напрямку — прочитайте їхній список, прочитайте наш і вирішуйте.",
  "compare.matchUnknownIntro": "Ніхто не встановив, який із їхніх тарифів це несе, тож ця сторінка не називає жодного. Це не твердження, що в них цього немає — ми не перевіряли, а сторінка, яка вважає неперевірене відсутнім, — це сторінка, яка вигадує.",
  "compare.aiMeteringTitle": "Як кожна сторона тарифікує свій ШІ",
  "compare.aiMeteringIntro": "Їхній продається як місячний ліміт, що змінюється разом із тарифом, надрукований на їхній власній сторінці. Наш продається не так, і чесна версія цього речення має дві половини.",
  "compare.aiMeteringOurs": "FieldQuo не продає ШІ покредитно: на нашій сторінці цін немає ліміту на план, який можна вичерпати, і немає більшого пакета, заради якого треба піднятися вище. Секретар є в кожному плані, а час розмов купується окремо як передплачений кредит, без місячного мінімуму, тож місяць без дзвінків не коштує за нього нічого. Друга половина, якій теж місце тут: використання моделі тарифікується для кожної компанії проти стелі, яку ми встановлюємо всередині, тож ніщо на цій сторінці не стверджує, що воно безлімітне.",
  "compare.concessionTitle": "Чого FieldQuo не робить",
  "compare.concessionIntro": "Цей розділ є на кожній із цих сторінок, на тому самому місці, вище за ту частину, де ми маємо гарний вигляд. Таблиця порівняння, зроблена лише з наших перемог, продає комусь підписку, за яку він попросить гроші назад.",
  "compare.unverifiedConcessionNote": "Ми не перевіряли, чи пропонує це ця компанія, тож ми не кажемо, що пропонує.",
  "compare.staleClaimNote": "Це зчитування старше за три місяці, тож будь-яка сума в ньому притримана, доки хтось знову не перевірить їхню сторінку. Перейдіть за посиланням і подивіться, що там сьогодні.",
  "compare.advantageTitle": "Де FieldQuo попереду",
  "compare.advantageIntro": "Кожне з цього зчитано з їхньої власної сторінки в указану дату. Перейдіть за посиланням і перевірте — саме для цього посилання й існує.",
  "compare.priceTitle": "Ціна, як її публікує кожна компанія",
  "compare.featuresTitle": "Що ви отримуєте з FieldQuo",
  "compare.featuresIntro": "Кожен рядок нижче — це функція, за якою стоїть реалізація. Список генерується з того самого запису, проти якого виконуються інженерні перевірки, тож функція, яка перестала працювати, перестає й рекламуватися.",
  "compare.ctaTitle": "Перший місяць безкоштовно з прив’язаною карткою, і ціну можна прочитати ще до старту",
  "compare.ctaBody": "Не треба записуватися на дзвінок, а ціна лежить на сторінці цін, а не за формою. Картку беремо при реєстрації і не списуємо, доки безкоштовний місяць не завершиться.",
  "compare.ctaButton": "Почати безкоштовний місяць",
  "compare.ctaSecondary": "Подивитися ціни",
  "compare.otherPagesTitle": "Інші порівняння",
  "compare.rule.1": "Кожна ціна — це звичайна ціна, яку компанія друкує на власній сторінці цін. Акційні ціни не беремо: така сторінка, як ця, будується один раз і віддається місяцями, і вона не може помітити, що акція скінчилася.",
  "compare.rule.2": "Гроші лишаються у валюті, в якій їх опублікували. Ми ніколи не конвертуємо. Курс правильний того дня, коли ви його дивитесь, і хибний наступного, а конвертована цифра на статичній сторінці — це арифметика, якої ніхто не перевіряє.",
  "compare.rule.3": "Там, де ми не змогли з’ясувати, що означає цифра, рядок так і каже й не показує числа. Це трапляється частіше, ніж ви думаєте, і це та частина сторінки, в якій ми впевнені найбільше.",
  "compare.rule.4": "Кожна цифра несе дату, коли її зчитали, і країну, з якої зчитали, бо ціна може відрізнятися і за одним, і за другим.",

  "compare.lede.jobber": "Jobber продає свій Marketing Suite, свого ШІ-секретаря на телефоні і свою воронку продажів як окремі щомісячні доповнення — {addOnTotal} на місяць поверх плану, ціна якого й так рухається разом із розміром вашої команди. FieldQuo кладе всі три в кожен план, за будь-якої ціни, а кожен, хто у фургоні, — безкоштовно.",
  "compare.concession.jobber": "Почнемо з того, чого в нас немає. FieldQuo — це вебзастосунок: немає чого встановлювати з магазину застосунків, ніщо не працює без зв’язку, і немає продавця, який проведе вас за руку.",
  "compare.lede.housecall_pro": "Housecall Pro бере плату за кожного додаткового користувача, тож ціна плану — це лише те, з чого починається ваш рахунок. FieldQuo виставляє рахунок тим, хто справді оцінює роботу — кошториси, замовлення, рахунки, — а кожен, хто у фургоні, — це бригада, безкоштовно. Кожна функція є в кожному плані, від {ourEntry}.",
  "compare.concession.housecall_pro": "Спершу чесна частина. Сторінка Housecall Pro перелічує застосунок для телефона, офлайн-доступ і демонстрацію із супроводом як стандарт. У FieldQuo немає жодного з трьох, і якщо щось із цього для вас вирішальне — вони кращий вибір.",
  "compare.lede.servicetitan": "На сторінці цін ServiceTitan немає жодної суми в доларах — ви бронюєте демо, і число узгоджують під ваш дохід і вашу чисельність. Підрядники повідомляють про щомісячну плату за кожного техніка поверх п’ятизначної плати за впровадження і багаторічного контракту. Кожна ціна FieldQuo є на цій сторінці, плати за налаштування немає, і ви можете почати сьогодні ввечері, ні з ким не розмовляючи.",
  "compare.concession.servicetitan": "Чого ми не можемо запропонувати, і про це першим: немає застосунку для телефона, немає нічого, що працює без мережі, і немає нікого, хто проведе вам екскурсію до того, як ви вирішите.",
  "compare.lede.projul": "Projul просить рівне річне зобов’язання наперед. FieldQuo — це {ourEntry} на місяць за одне місце і п’ять бригадників, з усіма функціями, і ви можете піти в кінці будь-якого місяця — вам не треба купувати рік, щоб дізнатися, чи це вам підходить.",
  "compare.concession.projul": "Перед рештою: у FieldQuo немає застосунку для телефона, він не працює без зв’язку, і немає нікого, хто вам його продемонструє. Projul запише вас на демо.",
  "compare.lede.quoteiq": "QuoteIQ починається від {theirEntry}, і цей план не збудує вам сайт, не прийме бронювання і не дасть господарю оцінити власну роботу. План QuoteIQ, який несе те, що FieldQuo кладе в кожен план, — це їхній тариф Max, за {theirParity} на місяць. Наш — {ourEntry}, і сорок одна річ із нашого списку відсутня в їхній лінійці за будь-яку ціну.",
  "compare.concession.quoteiq": "Спершу ціна, бо саме її ви прийшли перевірити. QuoteIQ починається нижче за наш найдешевший план, має застосунки для телефона, яких немає в нас, і запише вас на огляд. FieldQuo — це вебзастосунок без прикріпленого продавця.",

  "compare.counterpoint.projul.monthly_billing": "Їхня сторінка обстоює річний план, і аргумент справедливий: Projul каже, що в його ціні немає плати за користувача і немає обмеження на кількість проєктів. Фірмі, яка часто додає людей, може бути краще там.",

  "compare.capability.mobile_app": "Нативний мобільний застосунок (iOS / Android)",
  "compare.capability.offline_use": "Працює офлайн",
  "compare.capability.self_serve_demo": "Записатися на демо із супроводом продавця",
  "compare.capability.accounting_sync": "Двостороння синхронізація з QuickBooks або Xero",
  "compare.capability.gantt_charts": "Діаграми Ганта і пов’язані таймлайни проєктів",
  "compare.capability.purchase_orders": "Замовлення постачальникам",
  "compare.capability.daily_logs": "Щоденні журнали на об’єкті",
  "compare.capability.geofencing": "Геолокація і відмітка приходу в геозоні",
  "compare.capability.field_worker_quotes": "Бригада в полі може оцінити й надіслати кошторис прямо з фургона",
  "compare.capability.entry_price_below_our_floor": "Платний план, дешевший за найдешевший щабель FieldQuo",
  "compare.capability.ai_receptionist_no_monthly_floor": "ШІ-секретар на телефоні в кожному плані, без місячного мінімуму",
  "compare.capability.bank_debit_capped": "Банківський дебет у Канаді з обмеженням п'ять доларів за платіж",
  "compare.capability.self_serve_signup": "Зареєструватися і почати, ні з ким не розмовляючи",
  "compare.capability.published_price": "Ціна опублікована відкрито, без дзвінка з продажів",
  "compare.capability.monthly_billing": "Оплата помісячно, без обов’язкового річного зобов’язання",
  "compare.capability.free_crew_seats": "Бригада в полі включена безкоштовно — рахунок лише за тих, хто приносить гроші",

  "compare.teamSize.solo": "Тільки я",
  "compare.teamSize.2-5": "2-5 осіб",
  "compare.teamSize.6-10": "6-10 осіб",
  "compare.teamSize.11-15": "11-15 осіб",
  "compare.teamSize.16-plus": "16 і більше",
  "compare.billing.annual_prepaid": "Річна, наперед",
  "compare.billing.monthly_1yr": "Помісячна, зобов’язання на 1 рік",
  "compare.billing.monthly_none": "Помісячна, без зобов’язань",

  "compare.comparableFeature.ai_receptionist": "ШІ-секретар на телефоні",

  // ── The index page ──────────────────────────────────────────────────────
  "compare.vs": "FieldQuo проти {competitor}",
  "compare.preparedAsOf": "Підготовлено станом на {date}.",
  "compare.preparedAsOfLong": "Підготовлено станом на {date}. Кожна цифра нижче також несе день, коли її зчитали, і країну, з якої зчитали.",
  "compare.readComparison": "Читати порівняння",

  // What one card may claim, assembled in ../../(marketing)/compare/summary.js.
  "compare.summary.amountsSourced": "{count} їхніх опублікованих цін можна поставити поруч із нашими, у валюті, в якій вони їх друкують.",
  "compare.summary.amounts": "{count} їхніх опублікованих цін можна поставити поруч із нашими.",
  "compare.summary.asserted": "{count} з них не називають валюти на власній сторінці, тож порівняння каже, чиє це судження про валюту, а не друкує її як їхню.",
  "compare.summary.onRequest": "{count} їхніх тарифів не публікують жодної суми і просять вас її запитати.",
  "compare.summary.none": "Ніщо з того, що вони публікують, не можна порівняти з ціною FieldQuo.",
  "compare.summary.withheldOne": "Ще {count} цифру притримано, показану з причиною.",
  "compare.summary.withheld": "Ще {count} цифр притримано, кожну показано з причиною.",

  // ── How a price reads ───────────────────────────────────────────────────
  //
  // {currency} is a code and {ask} is their button's own words: both arrive
  // already decided and neither is translated. {per} is resolved through
  // compare.per.* below, because "per month" with an English preposition inside
  // a Ukrainian sentence is what this whole change is fixing.
  "compare.price.amount": "${amount} {currency} за {per}",
  "compare.price.free": "Безкоштовно ({currency})",
  "compare.price.onRequest": "Ціну не опубліковано — їхня сторінка каже «{ask}»",
  "compare.price.notOffered": "Не продається для цього розміру",
  "compare.per.month": "місяць",
  "compare.per.year": "рік",
  "compare.pricePerMonth": "${amount} на місяць",
  "compare.and": " і ",

  // ── How a feature's availability reads ──────────────────────────────────
  //
  // included and includedUsageExtra must NEVER collapse into one sentence.
  // Ours is the second: the receptionist is on every plan and the talk time is
  // prepaid credit, so «включена в ціну плану» beside our price would be a
  // false claim about our own price to somebody who then meets a top-up on
  // their first call. All five agree with «функція», feminine.
  "compare.availability.included": "включена в ціну плану",
  "compare.availability.includedUsageExtra": "включена в кожен план, а час розмов купується окремо як передплачений кредит",
  "compare.availability.addOn": "доступна як платне доповнення поверх плану",
  "compare.availability.absent": "відсутня",
  "compare.availability.unknown": "не з’ясована",

  // ── The price section ───────────────────────────────────────────────────
  "compare.tierSeatsOne": "{seats} місце, плюс {crew} бригадників безкоштовно",
  "compare.tierSeats": "{seats} місць, плюс {crew} бригадників безкоштовно",
  "compare.sameNumberBothCurrencies": "Те саме число в кожній валюті, в якій ми продаємо ({currencies}) — ${price} у кожній із них є справжньою ціною FieldQuo, тож ніщо на цій сторінці не треба конвертувати, щоб їх зіставити. У якій валюті вам виставлять рахунок, визначає адреса бізнесу, яку ви вкажете при реєстрації.",
  "compare.soldIn": "Продається в {currencies}.",
  "compare.nothingPublishable": "На сторінці цін {competitor} немає нічого, що ми могли б опублікувати як ціну. Кожна цифра, яку ми маємо, перелічена нижче з причиною, чому її притримано.",
  "compare.usersIncludedOne": "{count} користувач включений",
  "compare.usersIncluded": "{count} користувачів включено",
  "compare.unlimitedUsers": "Безлімітні користувачі, тож немає кількості місць, яку можна порівняти",
  "compare.currencyNotTheirs": "Сума їхня, з їхньої власної сторінки. Валюта — ні: {provenance}",
  "compare.withheldCountOne": "Ще {count} ціну {competitor} тут не показано — або зчитування застаріло, або ми не змогли з’ясувати, що означала опублікована цифра. Ми радше пропустимо рядок, ніж надрукуємо число, за яке не можемо ручатися.",
  "compare.withheldCount": "Ще {count} цін {competitor} тут не показано — або зчитування застаріли, або ми не змогли з’ясувати, що означали опубліковані цифри. Ми радше пропустимо рядок, ніж надрукуємо число, за яке не можемо ручатися.",

  // ── Their ladder, in their own words ────────────────────────────────────
  "compare.addsOverTier": "Додає до тарифу, що нижче:",
  "compare.onThisTier": "У цьому тарифі:",
  "compare.aiCreditsTier": "Їхня сторінка вказує {count} ШІ-кредитів на місяць у цьому тарифі.",
  "compare.thisListFrom": "Цей список {provenance}",
  "compare.creditsAMonth": "{count} кредитів на місяць",

  // ── The receptionist panel ──────────────────────────────────────────────
  "compare.receptionistTitle": "{feature}: скільки це коштує з кожного боку",
  "compare.receptionistIntro": "Тарифи зіставляються за тим, що в них є, а не за тим, де вони стоять у таблиці. Це найдешевший тариф {competitor}, у якому ми перевірили, що це справді є.",
  "compare.receptionistUnknownIntro": "На це питання ми не можемо відповісти щодо {competitor}.",
  "compare.featureOnThisTier": "У цьому тарифі ця функція {availability}.",
  "compare.receptionistLowerDown": "Нижче в їхній лінійці вона {availability}: {price}{at}. Це поріг, який ви платите в місяць, коли телефон жодного разу не задзвонив.",
  "compare.atCoordinates": " на {coordinates}",
  "compare.ourAvailability": "Вона {availability}. Місяць без дзвінків не коштує за неї нічого.",
  "compare.theirWordsNotOurs": "Їхні плани описані на їхній сторінці їхніми власними словами, і це порівняння не читатиме ті слова як наші. Їхній список вище, без редагування, і саме його варто перевірити на їхньому власному сайті.",

  // ── Where we are ahead, and where we are not ────────────────────────────
  "compare.readOnTheirSite": "Прочитано на їхньому сайті {checked}",
  "compare.theySay": "{competitor} каже: «{claim}».",
  "compare.entryOursNothingBelowOne": "{seats} місце, плюс {crew} бригадників безкоштовно. Нижче немає нічого.",
  "compare.entryOursNothingBelow": "{seats} місць, плюс {crew} бригадників безкоштовно. Нижче немає нічого.",

  // ── The head-to-head ────────────────────────────────────────────────────
  "compare.case.eyebrow": "Пліч-о-пліч",
  "compare.case.headlineOurs": "Усе, що робить FieldQuo, коштує {price}.",
  "compare.case.headlineTheirs": "У {competitor} той самий список коштує {price}.",
  "compare.case.headlineTheirsAnnual": "У {competitor} той самий список коштує {price} на рік.",
  "compare.case.headlineNoPricesOurs": "FieldQuo публікує кожну ціну.",
  "compare.case.headlineNoPricesTheirs": "{competitor} не публікує жодної.",
  "compare.case.sub": "Ми не продаємо функції за тарифами. У кожному плані є кожна функція — плани відрізняються лише тим, скільки в них людей.",
  "compare.case.missingOne": "Ще {count} річ, якої {competitor} не пропонує за жодну ціну.",
  "compare.case.missing": "Ще {count} речей, яких {competitor} не пропонує за жодну ціну.",
  "compare.case.missingBody": "Усе це є в плані {plan} за {price}.",
  "compare.case.shopTitle": "Скільки це коштує для такої фірми, як ваша",
  "compare.case.shopIntro": "{competitor} виставляє рахунок за кожен логін. Ми виставляємо рахунок тим, хто оцінює роботу; кожен, хто у фургоні, — це бригада, безкоштовно. Цей розрив росте з кожною найнятою людиною.",
  "compare.case.shop1": "Ви і двоє у фургоні",
  "compare.case.shop2": "Двоє кошторисників, четверо в полі",
  "compare.case.shop3": "Фірма з одинадцяти",
  "compare.case.shopSplit": "{estimators} оцінюють роботу · {crew} у полі",
  "compare.case.youKeep": "ви лишаєте собі",
  "compare.case.cheaperThere": "На одній людині дешевше в них.",
  "compare.case.calcBefore": "Підставте власні числа в",
  "compare.case.calcLink": "калькулятор витрат",
  "compare.case.calcAfter": "і подивіться всі п’ять поруч.",
  "compare.case.wholeTitle": "Усе, що ви отримуєте, у кожному плані",
  "compare.case.wholeIntro": "Не добірка найкращого — увесь продукт, і чи трапляється він десь у планах {competitor}.",
  "compare.case.both": "В обох",
  "compare.case.only": "Тільки FieldQuo",

  // ── The head-to-head rows ───────────────────────────────────────────────
  "compare.rows.perMo": "{amount}/міс",
  "compare.rows.perYr": "{amount}/рік",
  "compare.rows.usersOne": "{count} користувач",
  "compare.rows.users": "{count} користувачів",
  "compare.rows.unlimitedUsers": "безлімітні користувачі",
  "compare.rows.cheapestPlan": "Найдешевший план",
  "compare.rows.soloSub": "{plan} — 1 місце, {crew} бригадників безкоштовно",
  "compare.rows.annualEquivalent": "{plan} — {amount} на місяць в еквіваленті, рахунок за рік",
  "compare.rows.annualOnlyPlain": "{plan} — рахунок за рік",
  "compare.rows.tierUsers": "{plan} — {users}",
  "compare.rows.parityLabel": "Найдешевший план із тим, що FieldQuo кладе в кожен план",
  "compare.rows.paritySub": "Той самий план. Ми не закриваємо функції тарифами.",
  "compare.rows.parityAnnual": "{plan} — {amount} на місяць в еквіваленті",
  "compare.rows.parityTheirs": "{plan} — їхні дешевші плани цього не несуть",
  "compare.rows.publishedPrice": "Опублікована ціна",
  "compare.rows.everyPlanOnThisPage": "Кожен план, на цій сторінці",
  "compare.rows.nonePublished": "Не опубліковано жодної",
  "compare.rows.bookDemo": "Забронюйте демо; число узгоджують на дзвінку",
  "compare.rows.whatItCosts": "Скільки це коштує",
  "compare.rows.oneToTwentyFive": "Від 1 до 25 осіб",
  "compare.rows.reportedNotPublished": "за словами підрядників, не опубліковано",
  "compare.rows.setupFee": "Плата за налаштування",
  "compare.rows.none": "Немає",
  "compare.rows.reported": "за повідомленнями",
  "compare.rows.howYouPay": "Як ви платите",
  "compare.rows.monthly": "Помісячно",
  "compare.rows.leaveAnyMonth": "Піти в кінці будь-якого місяця",
  "compare.rows.aYearUpFront": "{amount} на рік, наперед",
  "compare.rows.noMonthlyOption": "Помісячного варіанта не пропонують — так каже їхній FAQ",
  "compare.rows.paidAddOns": "Продається як платні доповнення",
  "compare.rows.everyFeature": "Кожна функція є в кожному плані, за ціною плану",
  "compare.rows.plusPerMo": "+{amount}/міс",
  "compare.rows.peopleInField": "Люди в полі",
  "compare.rows.free": "Безкоштовно",
  "compare.rows.crewFreeSub": "Бригада бачить графік і роботу безкоштовно",
  "compare.rows.billed": "Платно",
  "compare.rows.everyLoginPaid": "У {competitor} кожен логін — це платний користувач",
  "compare.rows.biggestPlan": "Найбільший план",
  "compare.rows.biggestSub": "{seats} місць плюс {crew} бригадників — 25 осіб",
  "compare.rows.onRequest": "За запитом",
  "compare.rows.everyPlan": "Кожен план",
  "compare.rows.tierAtPrice": "{plan} — {amount}/міс",
  "compare.rows.tierAtAnnualPrice": "{plan} — {amount}/рік",
  "compare.rows.theirCheapestWithIt": "їхній найдешевший план, який це включає",
  "compare.rows.notInTheirPlans": "Немає в їхніх планах",
  "compare.rows.freeTrial": "Безкоштовний пробний період",
  "compare.rows.firstMonthFree": "Перший місяць безкоштовно",
  "compare.rows.noCardCharged": "Картку не списують, доки він не завершиться",
  "compare.rows.trialOffered": "Пробний період пропонують",
  "compare.rows.seeTheirSite": "актуальні умови — на їхньому сайті",

  // ── The add-on stack ────────────────────────────────────────────────────
  //
  // Rendered on /compare/fieldquo-vs-jobber AND on /pricing. These were the
  // keys the owner's report was actually about: the block had t() calls with
  // English fallbacks and no catalogue entries behind them, so every language
  // fell through to English and "the 3 things jobber charges extra for and
  // below" stayed in English on an otherwise translated page.
  "addOns.title": "{count} речей, за які {competitor} бере окремо",
  "addOns.intro": "Вони лежать поверх плану на їхній власній сторінці цін, кожне зі своєю місячною ціною. Кожне з них — це робота, яку FieldQuo робить усередині плану, за який ви вже платите.",
  "addOns.scope": "Ми зчитали з їхньої сторінки цін назву і ціну, і більше нічого. Що всередині їхнього доповнення — це те, чого ми не перевіряли, тож ніщо нижче цього не описує.",
  "addOns.money": "${amount} {currency} за {per}",
  "addOns.provenance": "Зчитано з підключення в {country} {checked}",
  "addOns.sourceLink": "їхня сторінка цін",
  "addOns.oursTitle": "У FieldQuo, у кожному плані:",
  "addOns.limits": "Де це закінчується:",
  "addOns.total": "{total} {currency} на місяць, поверх ціни плану.",
  "addOns.totalBody": "Саме стільки ці три коштують разом у тій точці їхніх власних перемикачів, де ми їх зчитали. У FieldQuo ті самі три роботи є в кожному плані, за будь-якого розміру, починаючи з найдешевшого на цій сторінці.",
  "addOns.receptionist": "Їхнє доповнення-секретар — це місячний поріг: воно нараховується і в той місяць, коли телефон жодного разу не задзвонив. У нашого місячного мінімуму немає. Функція є в кожному плані, а час розмов — це передплачений кредит, який ви купуєте, коли він потрібен, тож тихий лютий не коштує за неї нічого.",

  // ── /pricing's own line under the add-on stack ──────────────────────────
  //
  // Referenced by PricingPlans.js since the block was written and never
  // defined, which is the second half of the same reported bug.
  "pricing.addOnsCompare": "Кожна цифра вище зчитана з їхньої власної сторінки цін, у вказану дату. Повне порівняння пліч-о-пліч, включно з тим, чого FieldQuo не робить, — тут →",
};

export default uk;
